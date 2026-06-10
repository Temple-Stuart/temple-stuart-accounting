import { NextRequest, NextResponse } from 'next/server';
import { searchHotelRates, liteApiHotelToRecommendation } from '@/lib/liteapiClient';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC hotel SEARCH (PR-H1) ─────────────────────────────────────────────
// Net-new public route, guarded EXACTLY like the public flight search
// (src/app/api/flights/search/route.ts, PR-3). Open to all visitors — there is
// NO auth gate. Cost is bounded by TWO guards that run BEFORE the LiteAPI
// /hotels/rates call, on every path:
//   1. rateLimit(ip) — per-IP burst defense (429 + Retry-After when exceeded).
//   2. reserveTravelSearch('liteapi') — durable daily spend cap (503 when hit).
// If EITHER guard throws, control jumps straight to catch and returns 429/503 —
// the searchHotelRates() provider call below is never reached. Param validation
// sits between the two guards so a malformed (400) request can't consume a
// daily-cap slot (avoids a junk-request self-DoS); both guards still precede the
// provider call, rate-limit first. LiteAPI runs in sandbox (free) by default
// (liteapiClient.ts:36) — the daily cap bounds the worst case regardless.
// BOOKING stays auth-gated (travel/liteapi/prebook + book, getVerifiedEmail) —
// untouched by this PR. Results are image-rich via liteApiHotelToRecommendation
// (photoUrl, images[], name, rating, price/pricePerNight, liteapiHotelId/OfferId).
export async function GET(request: NextRequest) {
  // Client IP for the rate-limit key. A missing/absent header still gets limited
  // against a shared 'unknown' key — the guard is NEVER skipped.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`hotel-search:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const params = request.nextUrl.searchParams;

    const city = params.get('city');
    const country = params.get('country');
    const checkin = params.get('checkin');
    const checkout = params.get('checkout');
    const adults = parseInt(params.get('adults') || '2');
    const currency = params.get('currency') || undefined;
    const guestNationality = params.get('guestNationality') || undefined;
    const latParam = params.get('latitude');
    const lngParam = params.get('longitude');
    const radiusParam = params.get('radiusMeters');
    const latitude = latParam != null ? Number(latParam) : undefined;
    const longitude = lngParam != null ? Number(lngParam) : undefined;
    const radiusMeters = radiusParam != null ? Number(radiusParam) : undefined;

    if (!city || !country || !checkin || !checkout) {
      return NextResponse.json(
        { error: 'Missing required params: city, country, checkin, checkout' },
        { status: 400 }
      );
    }

    // GUARD 2 — daily provider spend cap, immediately before the provider call.
    await reserveTravelSearch('liteapi');

    // PROVIDER CALL — only reachable after BOTH guards passed.
    console.log(`[LiteAPI] Searching: ${city}, ${country}, ${checkin} → ${checkout}, ${adults} adults`);

    const hotels = await searchHotelRates({
      city,
      country,
      checkin,
      checkout,
      occupancies: [{ adults }],
      ...(currency ? { currency } : {}),
      ...(guestNationality ? { guestNationality } : {}),
      ...(Number.isFinite(latitude) ? { latitude } : {}),
      ...(Number.isFinite(longitude) ? { longitude } : {}),
      ...(Number.isFinite(radiusMeters) ? { radiusMeters } : {}),
    });

    // Map into the canonical, image-rich recommendation shape (same mapper the
    // tier-gated AI assistant uses — exported lib fn, no TripPlannerAI coupling).
    const results = hotels.map((h, idx) => liteApiHotelToRecommendation(h, idx, 'accommodation'));

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
        { error: 'Hotel search is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('Hotel search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Hotel search failed' },
      { status: 500 }
    );
  }
}
