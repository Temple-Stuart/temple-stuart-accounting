import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getOffer,
  createOrder,
  createPaymentIntent,
  confirmPaymentIntent,
  getPaymentIntent,
  applyMarkup,
  duffelMode,
  type PassengerDetails,
} from '@/lib/duffel';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── FLIGHT BOOK via DUFFEL PAYMENTS (PR-Duffel-Pay-1, backend) ──────────────────
// Booking is PUBLIC + guest-ok — booking is never locked, mirroring hotels
// (liteapi/book). Cost is bounded by a per-IP rate limit + a tight durable daily cap
// before any provider spend. The Duffel Payments flow runs server-side here so it is
// testable end-to-end on TEST mode without a frontend:
//   re-fetch offer (authoritative price + expiry) → create Payment Intent (customer's
//   card tops up our balance; markup is a config point) → confirm intent → createOrder
//   type:'instant' paid from balance. The order payment type is UNCHANGED — the intent
//   in front is what makes "balance" the CUSTOMER's money.
// PR-2 (frontend) will likely split this: a create-intent call hands the client_token
// to Duffel's Card component, the component confirms, then a finalize call does the
// order. The lib functions are already shaped for that. STAY ON TEST this PR.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Tracks whether the customer's card was already captured, so the catch can tell the
  // TRUTH: a failure AFTER this point means money moved but the flight didn't book.
  let paymentConfirmed = false;

  try {
    // GUARD 1 — per-IP burst limit (also blunts rapid double-submits).
    await rateLimit(`flight-book:${ip}`, {
      limit: Number(process.env.BOOK_RATE_LIMIT) || 5,
      windowSeconds: Number(process.env.BOOK_RATE_WINDOW) || 60,
    });

    // Auth is OPTIONAL — booking is guest-ok (mirrors liteapi/book). A logged-in user
    // owns the persisted reservation row (bookingType 'account'); a guest books
    // standalone (bookingType 'guest'). NO 401 here.
    const userEmail = await getVerifiedEmail();
    const user = userEmail
      ? await prisma.users.findFirst({
          where: { email: { equals: userEmail, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;

    const body = await request.json();
    // paymentIntentId is present on the PR-2 panel/component flow (the Duffel Card
    // component already collected the card + confirmed the intent client-side). When
    // absent, the PR-1 server-side test path creates + confirms the intent here.
    const { offerId, passengers, idempotencyKey, paymentIntentId } = body;

    if (!offerId || !passengers || passengers.length === 0) {
      return NextResponse.json(
        { error: 'Missing offerId or passengers' },
        { status: 400 }
      );
    }

    // GUARD 2 — durable daily booking cap, BEFORE ANY Duffel call (real money, public
    // route — same protection hotels' booking has). Reserved ahead of getOffer too, so
    // even the offer re-fetch below can never run uncapped.
    await reserveTravelSearch('flightbooking');

    // SAFETY GUARD — fail-closed mode gate. Only explicitly recognized modes proceed:
    // 'test' always; 'live' only when BOTH the live token AND the explicit
    // DUFFEL_ALLOW_LIVE_BOOKING flag are set together (the separate, deliberate
    // switch). 'unknown' (missing/malformed token) is BLOCKED, never assumed safe.
    // Mode is read from the token prefix — the token itself is never exposed.
    const mode = duffelMode();
    const liveAllowed = process.env.DUFFEL_ALLOW_LIVE_BOOKING === 'true';
    if (!(mode === 'test' || (mode === 'live' && liveAllowed))) {
      console.error(`[Duffel] Booking blocked — mode '${mode}' not permitted`);
      return NextResponse.json(
        { error: 'Flight booking is not available right now.' },
        { status: 503 }
      );
    }
    console.log(`[Duffel] Booking in ${mode} mode`); // safe: mode only, never the token

    // Re-fetch the offer for the AUTHORITATIVE price + expiry — never trust client.
    const offer = await getOffer(offerId);

    // Expired-offer guard — Duffel offers expire in minutes. Fail loud, no order.
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: 'This fare expired. Please search again for current prices.' },
        { status: 409 }
      );
    }

    // Map submitted passengers onto the OFFER's passenger ids.
    const mappedPassengers: PassengerDetails[] = offer.passengers.map((offerPax: any, idx: number) => {
      const paxDetails = passengers[idx] || {};
      return {
        id: offerPax.id,
        title: paxDetails.title || 'mr',
        given_name: paxDetails.given_name || paxDetails.firstName,
        family_name: paxDetails.family_name || paxDetails.lastName,
        born_on: paxDetails.born_on || paxDetails.dateOfBirth,
        email: paxDetails.email,
        phone_number: paxDetails.phone_number || paxDetails.phone,
        gender: paxDetails.gender || 'm',
        // Passport — passed through ONLY when collected (international itineraries).
        ...(paxDetails.identity_documents ? { identity_documents: paxDetails.identity_documents } : {}),
      };
    });

    // ── DUFFEL PAYMENTS — two shapes, both ending in createOrder(instant, balance) ──
    //  (A) PR-2 panel/component flow: paymentIntentId present. The Duffel Card component
    //      already collected the card + confirmed the intent client-side; we VERIFY the
    //      intent succeeded SERVER-SIDE (never trust the client) — no re-charge here.
    //  (B) PR-1 server-side test path: no paymentIntentId → create + confirm here.
    // Markup is a CONFIG POINT (applyMarkup) — 0 for now; finance owns it later.
    if (paymentIntentId) {
      const intent = await getPaymentIntent(paymentIntentId);
      if (intent.status !== 'succeeded') {
        // The component did not complete the charge — do NOT order (never fake success).
        return NextResponse.json(
          { error: 'Payment was not completed. Please try again.' },
          { status: 402 }
        );
      }
      paymentConfirmed = true;
    } else {
      const intentAmount = applyMarkup(offer.total_amount);
      const intent = await createPaymentIntent(intentAmount, offer.total_currency, idempotencyKey);
      const confirmed = await confirmPaymentIntent(intent.id);
      if (confirmed.status !== 'succeeded') {
        // Card was not captured — do NOT create an order (never a fake success).
        return NextResponse.json(
          { error: 'Payment was not completed. Please try a different card.' },
          { status: 402 }
        );
      }
      paymentConfirmed = true;
    }

    // Pay the order from balance (now funded by the customer's confirmed intent).
    const order = await createOrder(
      offerId,
      mappedPassengers,
      { type: 'balance', amount: offer.total_amount, currency: offer.total_currency },
      idempotencyKey,
    );

    // ─── Persist the order (PR-Duffel-Pay-4) ─────────────────────────────────
    // Mirrors liteapi/book: account → userId + bookingType 'account'; guest →
    // userId null + first passenger's email as the contact (nullable column —
    // passenger emails are validated in the checkout panel, not re-parsed here).
    // Flight rows carry no stay window: checkin/checkout/hotelName null (D3).
    // status is the literal 'confirmed': createOrder is type:'instant' and runs
    // ONLY after the payment intent was verified 'succeeded' server-side above,
    // so a returned order is a paid, ticketed order (Duffel's order payload has
    // no reservations-vocabulary status field to source instead).
    let reservationRow;
    try {
      reservationRow = await prisma.reservations.create({
        data: {
          userId: user?.id ?? null,
          tripId: null,
          bookingType: user ? 'account' : 'guest',
          guestEmail: user ? null : (passengers[0]?.email ?? null),
          provider: 'duffel',
          providerBookingId: order.id,
          providerConfirmationCode: order.booking_reference ?? null,
          status: 'confirmed',
          hotelName: null,
          checkinDate: null,
          checkoutDate: null,
          guestCount: passengers.length,
          finalPriceCents: Math.round(Number(order.total_amount) * 100),
          currency: order.total_currency,
        },
      });
    } catch (dbErr) {
      // Duffel ticketed the order but we failed to persist — THE ORDER EXISTS
      // AND MONEY MOVED. Surface loudly for manual reconciliation (mirrors the
      // liteapi/book DB-fail-after-book convention, same 500).
      console.error('[Duffel book] DB persist failed AFTER successful order:', {
        orderId: order.id, bookingReference: order.booking_reference, error: dbErr,
      });
      return NextResponse.json(
        {
          error:
            'Your flight is booked and paid — the order exists at the airline — but we could not save it locally. Contact support with your order id.',
          orderId: order.id,
          bookingReference: order.booking_reference,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mode,
      order: {
        id: order.id,
        bookingReference: order.booking_reference,
        status: order.status,
        totalAmount: order.total_amount,
        totalCurrency: order.total_currency,
        passengers: order.passengers,
        slices: order.slices,
      },
      reservation: {
        id: reservationRow.id,
        provider: 'duffel',
        bookingId: order.id,
        confirmationCode: reservationRow.providerConfirmationCode,
        status: reservationRow.status,
        finalPriceCents: reservationRow.finalPriceCents,
        currency: reservationRow.currency,
        bookingType: reservationRow.bookingType,
      },
    });
  } catch (error) {
    // Guard rejections map to their own statuses first (no spend happened on these).
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many booking attempts — please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Flight booking is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }

    const msg = error instanceof Error ? error.message : '';
    const code = /already_paid/i.test(msg)
      ? 'already_paid'
      : /past_payment_required_by_date|expired|no longer available|not\s+found/i.test(msg)
        ? 'expired'
        : 'failed';
    // PCI-safe: log the error CODE + a truncated message only — never card data,
    // payment secrets, client tokens, or the request body (passenger PII).
    console.error('[Duffel] Booking error:', code, msg.slice(0, 200));

    if (paymentConfirmed) {
      // CRITICAL real-money case: the customer's card was charged (intent confirmed)
      // but the order did not finalize. Tell the TRUTH — do NOT claim "no charge". A
      // refund or manual completion is owed; surface it for support follow-up.
      console.error('[Duffel] ORDER FAILED AFTER PAYMENT CONFIRMED — needs refund/review');
      return NextResponse.json(
        {
          error:
            'Your payment went through but the booking did not finalize. Our team will refund or complete it — please contact support.',
          paymentConfirmedNoOrder: true,
        },
        { status: 502 }
      );
    }

    if (code === 'already_paid') {
      return NextResponse.json({ error: 'This booking was already completed.' }, { status: 409 });
    }
    if (code === 'expired') {
      return NextResponse.json(
        { error: 'This fare expired before booking. Please search again.' },
        { status: 409 }
      );
    }
    // Failure BEFORE any payment — safe to say nothing was charged.
    return NextResponse.json(
      { error: 'We could not complete the booking. No charge was made.' },
      { status: 502 }
    );
  }
}
