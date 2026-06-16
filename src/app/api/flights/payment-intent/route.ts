import { NextRequest, NextResponse } from 'next/server';
import { getOffer, createPaymentIntent, applyMarkup, duffelMode } from '@/lib/duffel';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// ─── FLIGHT PAYMENT INTENT (PR-Duffel-Pay-2) ─────────────────────────────────────
// Step 1 of the flight checkout: create a Duffel Payment Intent for the selected
// offer and return its client_token so the frontend Card component (@duffel/components)
// can collect the card + confirm the payment — the card NEVER touches our server (PCI).
// The order itself (the airline spend + the daily cap) happens at /api/flights/book
// AFTER the component confirms. This route is PUBLIC + guest-ok (booking is never
// locked) and bounded by a per-IP rate limit. Markup is a CONFIG POINT (applyMarkup),
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

    // SAFETY — TEST mode only this PR. Live charges real cards; block it unless the
    // live token AND the explicit flag are both set (the separate deliberate switch).
    // Read from the token prefix — the token itself is never exposed.
    const mode = duffelMode();
    if (mode === 'live' && process.env.DUFFEL_ALLOW_LIVE_BOOKING !== 'true') {
      console.error('[Duffel] Live payment blocked — DUFFEL_ALLOW_LIVE_BOOKING not set');
      return NextResponse.json(
        { error: 'Flight booking is not available right now.' },
        { status: 503 }
      );
    }

    // Authoritative price + expiry from a fresh offer fetch — never trust the client.
    const offer = await getOffer(offerId);
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'This fare expired. Please search again for current prices.' },
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
    // PCI-safe: log a short message only — never card data, secrets, or client tokens.
    const msg = error instanceof Error ? error.message : '';
    console.error('[Duffel] Payment intent error:', msg.slice(0, 200));
    return NextResponse.json(
      { error: 'Could not start payment. Please try again.' },
      { status: 502 }
    );
  }
}
