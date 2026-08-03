import { NextRequest, NextResponse } from 'next/server';
import { getOffer, applyMarkup, duffelMode, DuffelApiError } from '@/lib/duffel';
// PR-PAY-1: the intent rail is Stripe now (duffel.ts is untouched — its
// createPaymentIntent keeps its one remaining caller, the legacy
// no-paymentIntentId path in book/route.ts:163-166, which PAY-3 retires).
import { createFlightPaymentIntent, stripeKeyMode } from '@/lib/stripePayments';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── FLIGHT PAYMENT INTENT (PR-Duffel-Pay-2 → PR-PAY-1) ──────────────────────────
// Step 1 of the flight checkout: create a STRIPE PaymentIntent for the selected
// offer and return its client_secret (as `clientToken`) so the frontend can
// collect the card — the card NEVER touches our server (PCI). Duffel Payments
// is closed to new customers (DUFFEL-AUDIT-1), so Stripe collects; the Duffel
// balance is pre-funded out-of-band; the order itself (the airline spend)
// happens at /api/flights/book, still payments:[{type:'balance'}]. This route
// is PUBLIC + guest-ok (booking is never locked) and bounded by a per-IP rate
// limit + the same durable 'flightbooking' daily cap as /book — one paid
// Duffel call (getOffer) + one Stripe intent create, capped BEFORE either
// fires. Markup is a CONFIG POINT (applyMarkup), 0 for now. Gating: the
// Duffel mode gate stays (the order side), PLUS the Stripe/Duffel mode
// cross-check (ruling 3) — both fail closed.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Hoisted for the catch's instrumentation — the expiry investigation needs the
  // offer id on every error line (assigned after body parse; null before it).
  let offerId: string | undefined;

  try {
    await rateLimit(`flight-intent:${ip}`, {
      limit: Number(process.env.BOOK_RATE_LIMIT) || 5,
      windowSeconds: Number(process.env.BOOK_RATE_WINDOW) || 60,
    });

    const body = await request.json();
    offerId = body.offerId;
    // PR-PAY-1: body.idempotencyKey is no longer read here (it fed the Duffel
    // intent's Idempotency-Key; Stripe idempotency is PAY-2's concern). The
    // panel never sent one anyway (FlightCheckoutPanel posts offerId only).
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

    // PR-PAY-1 (ruling 3): BOTH gates. The Duffel gate above stays exactly
    // as-is (it still governs the order side); the Stripe rail must agree
    // with it — a live Duffel token with a test Stripe key (or vice versa)
    // would charge play-money for real flights or real money for test
    // inventory. Fail closed, declared, loud. stripeKeyMode() itself THROWS
    // on a missing/unrecognized key — caught here as a declared config 503,
    // never a silent fall-through. `mode` is the Duffel-gate variable
    // (this file, the `const mode = duffelMode()` line above).
    let stripeMode: 'live' | 'test';
    try {
      stripeMode = stripeKeyMode();
    } catch (cfgErr) {
      console.error('[Stripe] Payment blocked — key mode unresolved:', cfgErr instanceof Error ? cfgErr.message : cfgErr);
      return NextResponse.json(
        { error: 'Payment rail is not configured.' },
        { status: 503 }
      );
    }
    if (stripeMode !== mode) {
      console.error(`[Stripe] Payment blocked — payment rail mode mismatch (stripe '${stripeMode}' vs duffel '${mode}')`);
      return NextResponse.json(
        { error: 'Payment rail mode mismatch.' },
        { status: 503 }
      );
    }

    // PR-PAY-1: the browser needs the publishable key to mount Stripe
    // Elements (PAY-2). Missing key → declared 503 BEFORE any Stripe spend —
    // the envelope never ships an undefined field.
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('[Stripe] Payment blocked — NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
      return NextResponse.json(
        { error: 'Payment rail is not configured.' },
        { status: 503 }
      );
    }

    // Authoritative price + expiry from a fresh offer fetch — never trust the client.
    const offer = await getOffer(offerId);
    // EXPIRY INSTRUMENTATION (behavior-preserving): what Duffel says about this
    // offer AT INTENT TIME, against our server clock. Stamps + id only.
    console.log('[Duffel] Offer at intent time:', JSON.stringify({
      offerId,
      expiresAt: offer.expires_at ?? null,
      serverNow: new Date().toISOString(),
    }));
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
      // EXPIRY INSTRUMENTATION: exactly why the pre-check rejected — raw stamp,
      // server clock, and the signed delta (positive = past per our clock).
      console.error('[Duffel] Offer expiry pre-check REJECTED:', JSON.stringify({
        offerId,
        rawExpiresAt: offer.expires_at,
        serverNow: new Date().toISOString(),
        deltaMs: Date.now() - new Date(offer.expires_at).getTime(),
      }));
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
    // offer total; the delta funds the balance top-up that pays the order. 0 for now.
    // PR-PAY-1: the intent is now a STRIPE PaymentIntent (Duffel Payments is
    // closed to new customers — DUFFEL-AUDIT-1). Amount stays SERVER-derived
    // from the fresh offer above, never client-supplied; the string→minor-units
    // conversion (incl. zero-decimal currencies) lives in stripePayments.ts.
    // The Duffel idempotencyKey plumbing is not forwarded — Stripe intent
    // creation is not retried by the client, and PAY-2 owns any Stripe
    // idempotency semantics.
    const intentAmount = applyMarkup(offer.total_amount);
    const intent = await createFlightPaymentIntent({
      amountDecimal: intentAmount,
      currency: offer.total_currency,
      offerId,
    });

    // The client_secret is RETURNED to the browser (Stripe Elements needs it)
    // but is NEVER logged. Nothing card-related is logged here.
    // PR-PAY-1 envelope (ruling 2): `clientToken` carries the Stripe
    // client_secret so the field name the panel hard-requires stays present
    // (FlightCheckoutPanel.tsx keys on data.clientToken); amount/currency are
    // the offer-derived DECIMAL string + ISO code (the old envelope's
    // semantics — NOT Stripe's minor-units integer); mode is the literal
    // 'stripe' (PAY-2 keys its banner/component on it). Dark window until
    // PAY-2 swaps the card component — accepted by ruling.
    return NextResponse.json({
      clientToken: intent.client_secret,
      paymentIntentId: intent.id,
      amount: intentAmount,
      currency: offer.total_currency,
      mode: 'stripe',
      publishableKey,
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
    // EXPIRY INSTRUMENTATION: the RAW provider message VERBATIM (no truncation)
    // + the offer id, so a misclassified or genuinely-stale offer is provable
    // from one log line. Provider error messages are prose — no card data,
    // secrets, or client tokens flow through them (this route sends no
    // passenger fields), so untruncated logging stays PCI-safe.
    // PR-PAY-1: STRIPE failures (createFlightPaymentIntent / toMinorUnits
    // throws) land in this SAME log line — rawDuffelMessage then carries the
    // Stripe/conversion message and the duffelErr fields are null; the expiry
    // classifier below still applies only to real DuffelApiErrors (now only
    // getOffer can produce one here), then everything else → the declared 502.
    // Nothing Duffel-specific was REMOVED from this catch: the expiry branches
    // remain correct for getOffer, and the 502 is the ruled Stripe-failure
    // response.
    const msg = error instanceof Error ? error.message : '';
    const duffelErr = error instanceof DuffelApiError ? error : null;
    console.error('[Duffel] Payment intent error:', JSON.stringify({
      offerId: offerId ?? null,
      rawDuffelMessage: msg,
      httpStatus: duffelErr?.httpStatus ?? null,
      code: duffelErr?.code ?? null,
      type: duffelErr?.type ?? null,
      title: duffelErr?.title ?? null,
      requestId: duffelErr?.requestId ?? null,
      serverNow: new Date().toISOString(),
    }));
    // Stale/expired-offer rejection from Duffel — two tiers:
    // PRIMARY: Duffel's own structured error code, preserved by DuffelApiError
    //   (offer_expired / offer_no_longer_available are the documented dead-offer
    //   codes). Authoritative — no prose matching involved.
    // SECONDARY (kept): the message-substring match shipped in the expiry PR, for
    //   any response where Duffel omits a structured code. Message text is
    //   byte-identical to before (DuffelApiError's message invariant), so this
    //   tier behaves exactly as it always did.
    const expiredByCode =
      duffelErr !== null &&
      (duffelErr.code === 'offer_expired' || duffelErr.code === 'offer_no_longer_available');
    if (expiredByCode || /select another offer|create a new offer request|expired|no longer available/i.test(msg)) {
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
