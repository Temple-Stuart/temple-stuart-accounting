import { NextRequest, NextResponse } from 'next/server';
import { validatedAffiliateUrl } from '@/config/affiliates';
import { searchViatorProducts, viatorProductToRecommendation } from '@/lib/viatorClient';
import { findViatorDestIdFor } from '@/lib/destinations';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC activity SEARCH (PR-A1) ──────────────────────────────────────────
// Net-new public route, guarded EXACTLY like the public hotel search
// (src/app/api/travel/hotels/search/route.ts). Open to all visitors — there is
// NO auth gate. Cost is bounded by TWO guards that run BEFORE the Viator call,
// on every path:
//   1. rateLimit(ip) — per-IP burst defense (429 + Retry-After when exceeded).
//   2. reserveTravelSearch('viator') — durable daily spend cap (503 when hit).
// If EITHER guard throws, control jumps straight to catch and returns 429/503 —
// the searchViatorProducts() provider call below is never reached. Param
// validation sits between the two guards so a malformed (400) request can't
// consume a daily-cap slot; both guards still precede the provider call,
// rate-limit first.
//
// FAN-OUT CONTROL: one searchViatorProducts() call can issue MANY underlying
// Viator HTTP requests (paginated/per-term), but reserveTravelSearch counts one
// logical search. We pass the 'activities' unified bucket (hits /products/search
// directly) + maxResults=12 (< Viator's 50/page), so the paginated loop fills on
// the FIRST page and exits → one reservation ≈ one real Viator call.
//
// AFFILIATE LOCK — REVERSED FOR ACTIVITIES ONLY (PR-CHIP-1, Alex's ruling,
// 2026-08-03; supersedes the original lock): `bookingUrl` now SHIPS in the
// public payload so the chip's Book can link out to Viator — the guest-
// completable booking this chip never had (TRAVEL-CHIPS-AUDIT). `website`
// stays stripped. Emission is VALIDATED, never arbitrary: the mapper's
// bookingUrl can fall back to the raw `product.productUrl` when a productCode
// is missing (viatorClient.ts:629-631,659), so only a URL that (a) parses,
// (b) is https on viator.com/www.viator.com and (c) carries our partner id
// leaves the route; anything else is OMITTED with a loud log. TILE-CFG-1
// moved the gate to the shared config — validatedAffiliateUrl(url, 'viator')
// in src/config/affiliates.ts, recipe + partner id single-sourced there —
// with behavior identical to the CHIP-1 inline version. The transfers
// route's stripping is UNTOUCHED (no vendor exists for ground).
const ACTIVITY_MAX_RESULTS = 12;

export async function GET(request: NextRequest) {
  // Client IP for the rate-limit key. A missing/absent header still gets limited
  // against a shared 'unknown' key — the guard is NEVER skipped.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`activity-search:${ip}`, {
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

    // PROVIDER CALL — only reachable after BOTH guards passed. 'activities' is the
    // unified bucket; empty userInterests; small maxResults to bound the fan-out.
    console.log(`[Viator] Searching activities: ${city}, ${country}`);

    // PR-3: resolve the destId from the static VERIFIED map FIRST — skips the rate-limited
    // /destinations call for the 17 known cities (incl Bali/Canggu → 98). null for unknown
    // cities → searchViatorProducts falls to the dynamic findDestinationId (honest post-PR-1).
    const preResolvedDestId = findViatorDestIdFor(city);

    const products = await searchViatorProducts(city, country, 'activities', [], ACTIVITY_MAX_RESULTS, preResolvedDestId);

    // Map to the canonical recommendation shape. PR-CHIP-1: `bookingUrl` ships
    // when it passes the affiliate validation above (viator.com + our pid);
    // `website` stays stripped. A result whose URL fails validation simply has
    // no bookingUrl — the view falls back to its no-URL behavior.
    const results = products.map((p) => {
      const rec = viatorProductToRecommendation(p, 'activities', 'midrange');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { bookingUrl, website, ...publicRec } = rec;
      const safeBookingUrl = validatedAffiliateUrl(bookingUrl, 'viator');
      return safeBookingUrl ? { ...publicRec, bookingUrl: safeBookingUrl } : publicRec;
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
        { error: 'Activity search is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('Activity search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Activity search failed' },
      { status: 500 }
    );
  }
}
