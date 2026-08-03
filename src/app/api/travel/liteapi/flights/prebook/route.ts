import { NextRequest, NextResponse } from 'next/server';
import {
  prebookFlight,
  FlightOfferExpiredError,
  FlightPrebookContact,
  FlightPrebookPassenger,
} from '@/lib/liteapiFlightsClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC LiteAPI flight PREBOOK (PR-FL-3) ─────────────────────────────────
// POST /api/travel/liteapi/flights/prebook — creates the flight checkout
// session (offer reserved + Stripe intent minted by Nuitee). Public (guest-ok,
// booking is never locked), same guard ORDER as the FL-2 routes / the prebook
// reference (travel/liteapi/prebook/route.ts:22-38): rateLimit → validate →
// reserveTravelSearch, both guards BEFORE the LiteAPI call.
//   1. rateLimit('liteapi-flight-prebook:'+ip) — own per-IP bucket.
//   2. reserveTravelSearch('flightprebook') — NEW quota string (plain string
//      column, schema.prisma:1192 — no schema change), money-adjacent tier
//      with a 100/day safe default mirroring 'hotelprebook'
//      (travelSearchQuota.ts PROVIDER_SAFE_DEFAULT_CAP).
//
// NO CARD DATA EVER TOUCHES THIS SERVER: prebook returns the Stripe context
// (secretKey = the intent's client secret) and the BROWSER collects the card
// via Stripe Elements (FL-4). This route sees names/emails/documents only —
// never a PAN/CVV — keeping us out of PCI scope, same posture as the hotel
// Payment-SDK lane.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else). Window mirrors the
    // prebook reference (prebook/route.ts:23).
    await rateLimit(`liteapi-flight-prebook:${ip}`, { limit: 5, windowSeconds: 60 });

    let body: { offerId?: unknown; contact?: unknown; passengers?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // ── Validation (between the guards, per the reference order) ─────────────
    // Only the validated whitelist below is forwarded — unknown fields die here.
    const offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';
    if (!offerId) {
      return NextResponse.json({ error: 'offerId is required' }, { status: 400 });
    }

    const rawContact = (body.contact ?? {}) as Record<string, unknown>;
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const contactFirst = str(rawContact.firstName);
    const contactLast = str(rawContact.lastName);
    const email = str(rawContact.email);
    const phoneNumber = str(rawContact.phoneNumber);
    if (!contactFirst || !contactLast) {
      return NextResponse.json({ error: 'contact.firstName and contact.lastName are required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'contact.email must be a valid email address' }, { status: 400 });
    }
    if (!phoneNumber) {
      return NextResponse.json({ error: 'contact.phoneNumber is required' }, { status: 400 });
    }
    const contact: FlightPrebookContact = {
      firstName: contactFirst,
      lastName: contactLast,
      email,
      phoneNumber,
      ...(str(rawContact.phoneCountryCode) ? { phoneCountryCode: str(rawContact.phoneCountryCode) } : {}),
      ...(str(rawContact.middleName) ? { middleName: str(rawContact.middleName) } : {}),
    };

    if (!Array.isArray(body.passengers) || body.passengers.length < 1 || body.passengers.length > 9) {
      return NextResponse.json({ error: 'passengers must be an array of 1-9 passengers' }, { status: 400 });
    }
    const DATE = /^\d{4}-\d{2}-\d{2}$/;
    const now = new Date();
    const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

    const passengers: FlightPrebookPassenger[] = [];
    for (let i = 0; i < body.passengers.length; i++) {
      const raw = body.passengers[i] as Record<string, unknown>;
      const passengerType = raw?.passengerType;
      if (passengerType !== 0 && passengerType !== 1 && passengerType !== 2) {
        return NextResponse.json(
          { error: `passengers[${i}].passengerType must be 0 (adult), 1 (child) or 2 (infant)` },
          { status: 400 }
        );
      }
      const firstName = str(raw.firstName);
      const lastName = str(raw.lastName);
      if (!firstName || !lastName) {
        return NextResponse.json(
          { error: `passengers[${i}]: firstName and lastName are required` },
          { status: 400 }
        );
      }
      const birthday = str(raw.birthday);
      // Birthday must be a real past date — a birthday today/future is malformed.
      if (!DATE.test(birthday) || birthday >= todayUtc) {
        return NextResponse.json(
          { error: `passengers[${i}].birthday must be YYYY-MM-DD and in the past` },
          { status: 400 }
        );
      }
      const gender = str(raw.gender).toUpperCase();
      if (gender && gender !== 'M' && gender !== 'F') {
        return NextResponse.json(
          { error: `passengers[${i}].gender must be 'M' or 'F' when provided` },
          { status: 400 }
        );
      }
      const documentExpiry = str(raw.documentExpiry);
      if (documentExpiry && !DATE.test(documentExpiry)) {
        return NextResponse.json(
          { error: `passengers[${i}].documentExpiry must be YYYY-MM-DD when provided` },
          { status: 400 }
        );
      }
      passengers.push({
        passengerType,
        firstName,
        lastName,
        birthday,
        ...(str(raw.middleName) ? { middleName: str(raw.middleName) } : {}),
        ...(gender ? { gender: gender as 'M' | 'F' } : {}),
        ...(str(raw.nationality) ? { nationality: str(raw.nationality) } : {}),
        ...(str(raw.documentType) ? { documentType: str(raw.documentType) } : {}),
        ...(str(raw.documentNumber) ? { documentNumber: str(raw.documentNumber) } : {}),
        ...(str(raw.documentIssueCountry) ? { documentIssueCountry: str(raw.documentIssueCountry) } : {}),
        ...(documentExpiry ? { documentExpiry } : {}),
      });
    }

    // GUARD 2 — durable daily cap, immediately before the LiteAPI call.
    await reserveTravelSearch('flightprebook');

    const prebook = await prebookFlight({ offerId, contact, passengers });
    // WHITELISTED envelope (ruled, PR-FL-3): the card-collection context +
    // price ONLY — the provider's booking/servicesAttachable/paymentTypes
    // internals stay server-side. secretKey is the Stripe client secret the
    // browser needs for Elements; it is returned, never logged.
    return NextResponse.json({
      prebookId: prebook.prebookId,
      transactionId: prebook.transactionId,
      secretKey: prebook.secretKey,
      publishableKey: prebook.publishableKey,
      price: prebook.price,
      currency: prebook.currency,
    });
  } catch (err) {
    // Envelopes mirror the prebook reference (prebook/route.ts:49-77) + the
    // flights dead-offer branch. FlightOfferExpiredError extends LiteApiError,
    // so it MUST be tested before the generic 502 branch.
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      );
    }
    if (err instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Flight checkout is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    if (err instanceof FlightOfferExpiredError) {
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
    console.error('[LiteAPI flights prebook] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Flight prebook failed' },
      { status: 500 }
    );
  }
}
