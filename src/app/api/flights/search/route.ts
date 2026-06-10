import { NextRequest, NextResponse } from 'next/server';
import { searchFlights, parseOffer } from '@/lib/duffel';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC flight SEARCH (PR-3) ─────────────────────────────────────────────
// Open to all visitors — the auth gate is GONE. Cost is bounded by TWO guards
// that run BEFORE the Duffel offer_requests call, on every path:
//   1. rateLimit(ip) — per-IP burst defense (429 + Retry-After when exceeded).
//   2. reserveTravelSearch('duffel') — durable daily spend cap (503 when hit).
// If EITHER guard throws, control jumps straight to catch and returns 429/503 —
// the searchFlights() provider call below is never reached. Param validation sits
// between the two guards so a malformed (400) request can't consume a daily-cap
// slot (avoids a junk-request self-DoS); both guards still precede the provider
// call, rate-limit first. BOOKING stays auth-gated (flights/book, vendor-commit) —
// untouched by this PR.
export async function GET(request: NextRequest) {
  // Client IP for the rate-limit key. A missing/absent header still gets limited
  // against a shared 'unknown' key — the guard is NEVER skipped.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`flight-search:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const params = request.nextUrl.searchParams;

    const origin = params.get('origin');
    const destination = params.get('destination');
    const departureDate = params.get('departureDate');
    const returnDate = params.get('returnDate');
    const passengers = parseInt(params.get('passengers') || '1');
    const cabinClass = params.get('cabinClass') as any || 'economy';

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: 'Missing required params: origin, destination, departureDate' },
        { status: 400 }
      );
    }

    // GUARD 2 — daily provider spend cap, immediately before the provider call.
    await reserveTravelSearch('duffel');

    // PROVIDER CALL — only reachable after BOTH guards passed.
    console.log(`[Duffel] Searching: ${origin} → ${destination}, ${departureDate}${returnDate ? ` - ${returnDate}` : ""}, ${passengers} pax`);

    const result = await searchFlights({
      origin,
      destination,
      departureDate,
      returnDate: returnDate || undefined,
      passengers,
      cabinClass,
    });

    // Parse offers for UI
    const offers = (result.offers || []).map(parseOffer);

    // Sort by price, then by duration
    offers.sort((a: any, b: any) => {
      if (a.price !== b.price) return a.price - b.price;
      return (a.outbound?.durationMinutes || 999) - (b.outbound?.durationMinutes || 999);
    });

    // Return top 10
    return NextResponse.json({
      offers: offers.slice(0, 10),
      offerRequestId: result.id,
      count: offers.length,
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
        { error: 'Flight search is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('Flight search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Flight search failed' },
      { status: 500 }
    );
  }
}
