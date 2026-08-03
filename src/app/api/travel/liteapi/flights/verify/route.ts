import { NextRequest, NextResponse } from 'next/server';
import { verifyFlightOffer, FlightOfferExpiredError } from '@/lib/liteapiFlightsClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC LiteAPI flight VERIFY (PR-FL-2) ──────────────────────────────────
// POST /api/travel/liteapi/flights/verify — re-price + availability-check one
// offer before checkout. Body: { offerId }. Public (guest-ok), same guarded
// posture and guard ORDER as the search route / the prebook reference
// (prebook/route.ts:22-38): rateLimit → validate → reserveTravelSearch, both
// guards BEFORE the LiteAPI call. Verify is a re-pricing SEARCH call to the
// same LiteAPI account, so it meters the same 'liteapi' provider cap the
// hotel/flight search routes reserve — NOT 'flightbooking' (that cap guards
// actual booking spend, and verify must never drain it).
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else). Window mirrors the
    // prebook reference (prebook/route.ts:23); distinct bucket per route.
    await rateLimit(`liteapi-flight-verify:${ip}`, { limit: 5, windowSeconds: 60 });

    let body: { offerId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';
    if (!offerId) {
      return NextResponse.json({ error: 'offerId is required' }, { status: 400 });
    }

    // GUARD 2 — durable daily provider cap, immediately before the LiteAPI call.
    await reserveTravelSearch('liteapi');

    const results = await verifyFlightOffer({ offerId });
    // The provider does NOT echo the offerId back (documented — the caller
    // retains it; liteapiFlightsClient.ts verify notes). OUR envelope echoes
    // the one the client sent so the checkout flow can correlate, and hoists
    // the two change flags the panel keys on: any journey re-priced or
    // re-fared since search → surface it before prebook.
    const priceChanged = results.some((r) => r.changes?.priceChanged === true);
    const fareChanged = results.some((r) => r.changes?.fareChanged === true);
    return NextResponse.json({ offerId, priceChanged, fareChanged, results });
  } catch (err) {
    // Envelopes mirror the prebook reference (prebook/route.ts:49-77), plus
    // the flights-specific dead-offer branch. Order matters:
    // FlightOfferExpiredError extends LiteApiError, so it MUST be tested
    // before the generic 502 branch.
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      );
    }
    if (err instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Flight verification is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    if (err instanceof FlightOfferExpiredError) {
      // Declared re-search body: the offer is dead (provider codes 42004/42017)
      // — retrying the same offerId is futile; the client swaps to a fresh
      // search. Same code-keyed contract as the Duffel expiry envelope.
      return NextResponse.json(
        {
          error: 'This flight offer expired — run a new search for current prices.',
          code: 'offer_expired',
        },
        { status: 410 }
      );
    }
    if (err instanceof MissingLiteApiKeyError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
        { status: 500 }
      );
    }
    if (err instanceof LiteApiError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
        { status: 502 }
      );
    }
    console.error('[LiteAPI flights verify] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Flight verification failed' },
      { status: 500 }
    );
  }
}
