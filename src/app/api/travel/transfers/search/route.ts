import { NextRequest, NextResponse } from 'next/server';
import { searchViatorProductsByTags, viatorProductToRecommendation } from '@/lib/viatorClient';
import { findViatorDestIdFor } from '@/lib/destinations';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC ground-transit SEARCH (Getting Around) ───────────────────────────
// Net-new public route, guarded EXACTLY like the public activity search
// (src/app/api/travel/activities/search/route.ts). Open to all visitors — there
// is NO auth gate. Cost is bounded by the SAME TWO guards that run BEFORE the
// Viator call, on every path:
//   1. rateLimit(ip) — per-IP burst defense (429 + Retry-After when exceeded).
//   2. reserveTravelSearch('viator') — durable daily spend cap (503 when hit).
// SAME cost profile as activities: a rate-limited, daily-capped Viator call (this
// reuses the existing 'viator' cap — no new provider, no new key, no new
// unauthenticated cost surface). reserveTravelSearch counts ONE logical search
// even though the two-tag merge issues two underlying /products/search calls.
//
// VERIFIED TAGS (from live discovery — ground truth): tag 21745 "Transfers" and
// tag 12044 "Airport & Hotel Transfers" return REAL Viator transfer products for
// Bali (e.g. "Private Arrival Transfer: Bali Airport to Hotel"). We query BOTH,
// MERGE, and DEDUPE by productCode (handled in searchViatorProductsByTags).
//
// AFFILIATE-URL LOCK: same as activities — the two affiliate-bearing fields the
// mapper emits (`bookingUrl` + `website`) are STRIPPED before the result leaves
// the route; "Book" is gated at the UI (onRequireAuth). No fabricated data — a
// city with no transfers returns an empty list, and the UI shows an honest empty.
const TRANSFERS_TAG = 21745;               // verified Viator tag "Transfers"
const AIRPORT_HOTEL_TRANSFERS_TAG = 12044; // verified Viator tag "Airport & Hotel Transfers"
const TRANSFER_MAX_RESULTS = 12;

export async function GET(request: NextRequest) {
  // Client IP for the rate-limit key. A missing/absent header still gets limited
  // against a shared 'unknown' key — the guard is NEVER skipped.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`transfers-search:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const params = request.nextUrl.searchParams;

    const city = params.get('city');
    const country = params.get('country');

    if (!city || !country) {
      return NextResponse.json(
        { error: 'Missing required params: city, country' },
        { status: 400 }
      );
    }

    // GUARD 2 — daily provider spend cap, immediately before the provider call.
    await reserveTravelSearch('viator');

    // PROVIDER CALL — only reachable after BOTH guards passed. Resolve the destId from
    // the static VERIFIED map FIRST (skips the rate-limited /destinations for known cities,
    // incl Bali/Canggu → 98); null → searchViatorProductsByTags falls to dynamic findDestinationId.
    console.log(`[Viator] Searching transfers: ${city}, ${country}`);

    const preResolvedDestId = findViatorDestIdFor(city);

    const products = await searchViatorProductsByTags(
      city,
      country,
      [TRANSFERS_TAG, AIRPORT_HOTEL_TRANSFERS_TAG],
      TRANSFER_MAX_RESULTS,
      preResolvedDestId,
    );

    // Map to the canonical recommendation shape, then STRIP the two affiliate-URL
    // fields (`bookingUrl` + `website`) so the live affiliate link never leaves the
    // route — identical to the activities route. No fake results: the grid renders
    // exactly the REAL transfer products Viator returned (empty when there are none).
    const results = products.map((p) => {
      const rec = viatorProductToRecommendation(p, 'activities', 'midrange');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { bookingUrl, website, ...publicRec } = rec;
      return publicRec;
    });

    return NextResponse.json({
      results,
      count: results.length,
    });

  } catch (error) {
    // Guard rejections map to their own statuses BEFORE the generic 500 — the
    // provider call was never made on these paths.
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many searches — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Transfer search is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('Transfer search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transfer search failed' },
      { status: 500 }
    );
  }
}
