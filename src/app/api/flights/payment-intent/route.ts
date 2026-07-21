import { NextRequest, NextResponse } from 'next/server';
import { getOffer, createPaymentIntent, applyMarkup, duffelMode } from '@/lib/duffel';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── FLIGHT PAYMENT INTENT (PR-Duffel-Pay-2) ─────────────────────────────────────
// Step 1 of the flight checkout: create a Duffel Payment Intent for the selected
// offer and return its client_token so the frontend Card component (@duffel/components)
// can collect the card + confirm the payment — the card NEVER touches our server (PCI).
// The order itself (the airline spend) happens at /api/flights/book AFTER the
// component confirms. This route is PUBLIC + guest-ok (booking is never locked) and
// bounded by a per-IP rate limit + the same durable 'flightbooking' daily cap as
// /book — it makes two paid Duffel calls (getOffer + createPaymentIntent), so it is
// capped BEFORE either fires. Markup is a CONFIG POINT (applyMarkup),
// 0 for now. TEST MODE only — live is blocked unless the explicit live flag is set.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    await rateLimit(`flight-intent:${ip}`, {
      limit: Number(process.env.BOOK_RATE_LIMIT) || 5,
      windowSeconds: Number(process.env.BOOK_RATE_WINDOW) || 60,
    });

    const body = await request.json();
    const { offerId, idempotencyKey } = body;
    if (!offerId) {
      return NextResponse.json({ error: 'Missing offerId' }, { status: 400 });
    }

    // GUARD 2 — durable daily cap, BEFORE the first Duffel call. Same 'flightbooking'
    // reservation /api/flights/book uses (book/route.ts GUARD 2): one shared money cap
    // across the whole checkout, so this route's two paid calls (getOffer +
    // createPaymentIntent) can never spend uncapped.
    await reserveTravelSearch('flightbooking');

    // SAFETY — fail-closed mode gate. Only explicitly recognized modes proceed:
    // 'test' always; 'live' only with the deliberate DUFFEL_ALLOW_LIVE_BOOKING flag.
    // 'unknown' (missing/malformed token) is BLOCKED, never assumed safe. Mode is
    // read from the token prefix — the token itself is never exposed.
    const mode = duffelMode();
    const liveAllowed = process.env.DUFFEL_ALLOW_LIVE_BOOKING === 'true';
    if (!(mode === 'test' || (mode === 'live' && liveAllowed))) {
      console.error(`[Duffel] Payment blocked — mode '${mode}' not permitted`);
      return NextResponse.json(
        { error: 'Flight booking is not available right now.' },
        { status: 503 }
      );
    }

    // Authoritative price + expiry from a fresh offer fetch — never trust the client.
    const offer = await getOffer(offerId);
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
      // Same dead-offer concept as the 410 classifier below — carries the typed
      // code so the panel swaps its futile same-offer retry for Refresh. 409
      // status kept (semantically fine; the client keys on `code`, not status).
      return NextResponse.json(
        {
          error:
            'This fare quote expired — airlines only hold prices for a few minutes. Refresh to see current flights and prices.',
          code: 'offer_expired',
        },
        { status: 409 }
      );
    }

    // Markup is a CONFIG POINT (applyMarkup) — the intent may collect more than the
    // offer total; the delta stays in our balance after the order is paid. 0 for now.
    const intentAmount = applyMarkup(offer.total_amount);
    const intent = await createPaymentIntent(intentAmount, offer.total_currency, idempotencyKey);

    // client_token is RETURNED to the browser (its intended use — the Card component
    // needs it) but is NEVER logged. Nothing card-related is logged here.
    return NextResponse.json({
      clientToken: intent.client_token,
      paymentIntentId: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      mode,
      expiresAt: offer.expires_at ?? null,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many attempts — please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      // Same exhausted-cap response shape as /api/flights/book (no spend happened).
      return NextResponse.json(
        { error: 'Flight booking is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    // PCI-safe: log a short message only — never card data, secrets, or client tokens.
    const msg = error instanceof Error ? error.message : '';
    console.error('[Duffel] Payment intent error:', msg.slice(0, 200));
    // Stale/expired-offer rejection from Duffel. Only the MESSAGE string survives
    // the duffel.ts throw sites (getOffer :106 / createPaymentIntent :229 discard
    // the structured errors[0].code), so classification matches Duffel's known
    // wording — production log 2026-07-20: "Please select another offer, or create
    // a new offer request to get the latest availability." Same substring-classifier
    // convention as the book route's expired matcher. 410 Gone + a typed code so
    // the panel can offer an honest refresh instead of a dead same-offer retry.
    if (/select another offer|create a new offer request|expired|no longer available/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'This fare quote expired — airlines only hold prices for a few minutes. Refresh to see current flights and prices.',
          code: 'offer_expired',
        },
        { status: 410 }
      );
    }
    return NextResponse.json(
      { error: 'Could not start payment. Please try again.' },
      { status: 502 }
    );
  }
}
