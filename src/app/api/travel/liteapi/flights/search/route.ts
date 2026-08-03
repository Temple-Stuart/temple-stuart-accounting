import { NextRequest, NextResponse } from 'next/server';
import { searchFlightRates, FlightLeg, FlightCabinClass } from '@/lib/liteapiFlightsClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC LiteAPI flight SEARCH (PR-FL-2) ──────────────────────────────────
// POST /api/travel/liteapi/flights/search — open to logged-out guests AND
// account users alike (same public-paid posture as the hotel lane). Cost is
// bounded by the two mandatory guards, both BEFORE the LiteAPI call, in the
// prebook reference's order (prebook/route.ts:22-38 — rateLimit → validate →
// reserve, so a malformed 400 can't consume a daily-cap slot):
//   1. rateLimit('liteapi-flight-search:'+ip) — per-IP burst defense (429 +
//      Retry-After). NOTE: the key is deliberately NOT 'flight-search:{ip}' —
//      the Duffel search route already owns that bucket
//      (api/flights/search/route.ts:27); sharing it would couple the two
//      rails' limits.
//   2. reserveTravelSearch('liteapi') — the existing LiteAPI provider search
//      cap (the same durable daily spend cap the hotel search route reserves,
//      hotels/search/route.ts:66). Flights search bills the same LiteAPI
//      account, so it meters against the same provider bucket — no new quota
//      value, no schema change.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else). Window mirrors the
    // prebook reference (prebook/route.ts:23).
    await rateLimit(`liteapi-flight-search:${ip}`, { limit: 5, windowSeconds: 60 });

    let body: {
      legs?: unknown;
      adults?: unknown;
      currency?: unknown;
      cabinClass?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Validation (between the guards, per the reference order) ─────────────
    // Only the validated whitelist below ever reaches the provider call —
    // nothing else from the request body is forwarded.
    if (!Array.isArray(body.legs) || body.legs.length < 1 || body.legs.length > 2) {
      return NextResponse.json({ error: 'legs must be an array of 1-2 legs' }, { status: 400 });
    }
    const IATA = /^[A-Z]{3}$/;
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    // Today's UTC date, same construction as travelSearchQuota.ts:32-35 —
    // "future" is enforced as not-in-the-past (same-day searches are legal).
    const now = new Date();
    const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    const legs: FlightLeg[] = [];
    for (let i = 0; i < body.legs.length; i++) {
      const raw = body.legs[i] as { origin?: unknown; destination?: unknown; date?: unknown };
      const origin = typeof raw?.origin === 'string' ? raw.origin.trim().toUpperCase() : '';
      const destination = typeof raw?.destination === 'string' ? raw.destination.trim().toUpperCase() : '';
      const date = typeof raw?.date === 'string' ? raw.date.trim() : '';
      if (!IATA.test(origin) || !IATA.test(destination)) {
        return NextResponse.json(
          { error: `legs[${i}]: origin and destination must be 3-letter IATA codes` },
          { status: 400 }
        );
      }
      if (!DATE.test(date)) {
        return NextResponse.json(
          { error: `legs[${i}]: date must be YYYY-MM-DD` },
          { status: 400 }
        );
      }
      if (date < todayUtc) {
        return NextResponse.json(
          { error: `legs[${i}]: date must not be in the past` },
          { status: 400 }
        );
      }
      legs.push({ origin, destination, date });
    }

    const adults = body.adults;
    if (!Number.isInteger(adults) || (adults as number) < 1) {
      return NextResponse.json({ error: 'adults must be an integer >= 1' }, { status: 400 });
    }

    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: 'currency is required (3-letter ISO 4217 code)' }, { status: 400 });
    }

    const CABIN_CLASSES: FlightCabinClass[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];
    let cabinClass: FlightCabinClass | undefined;
    if (body.cabinClass !== undefined) {
      const c = typeof body.cabinClass === 'string' ? (body.cabinClass.trim().toUpperCase() as FlightCabinClass) : ('' as FlightCabinClass);
      if (!CABIN_CLASSES.includes(c)) {
        return NextResponse.json(
          { error: `cabinClass must be one of ${CABIN_CLASSES.join(', ')}` },
          { status: 400 }
        );
      }
      cabinClass = c;
    }

    // GUARD 2 — durable daily provider cap, immediately before the LiteAPI call.
    await reserveTravelSearch('liteapi');

    const results = await searchFlightRates({
      legs,
      adults: adults as number,
      currency,
      ...(cabinClass ? { cabinClass } : {}),
    });
    return NextResponse.json({ results });
  } catch (err) {
    // Guard rejections map to their own statuses BEFORE the provider errors —
    // the searchFlightRates call was never reached on these paths. Envelopes
    // mirror the prebook reference (prebook/route.ts:49-77).
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      );
    }
    if (err instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Flight search is temporarily paused. Please try again later.' },
        { status: 503 }
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
    console.error('[LiteAPI flights search] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Flight search failed' },
      { status: 500 }
    );
  }
}
