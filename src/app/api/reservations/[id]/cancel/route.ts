import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { cancelBooking, parseCancelResult } from '@/lib/liteapiClient';
import { landLiteApiCancellation } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';

// POST /api/reservations/[id]/cancel — in-app cancellation.
//   PR-Cancel-1: provider 'liteapi' (hotels and flights) — single-step provider
//   cancel.
//   LAUNCH-01 RETIRE-01: provider 'duffel' rows are HISTORY — Duffel is retired
//   (no client, no credentials), so an in-app cancel of one is refused with a
//   declared 409 naming the manual path; the row is never touched. The bookings
//   lists no longer offer the action for those rows; this branch answers a
//   direct call honestly instead of a 404 that would deny the record exists.
//
// Auth chain (mirrors the T4 PATCH, ../route.ts:40-74, the SEC-2
// defensive-404 convention):
//   1. getVerifiedEmail → 401.
//   2. user lookup → 404.
//   3. reservations.findFirst({ id, userId: user.id, provider: in
//      ['liteapi','duffel'] }) → 404. The userId scope is ALSO the guest
//      fence: guest rows (userId null) can never match — guest cancellation
//      stays a SUPPORT path until the claim flow exists. Viator (and any
//      future provider) rows 404 until their cancel lane exists.
//   4. status must be 'confirmed' → 409 (nothing to cancel otherwise).
//
// Money truth: the provider's response is the ONLY authority; absent fields
// return null ("not stated"), never defaulted. Rows are NEVER deleted — the
// financial record lives forever. NOT in middleware PUBLIC_PATHS (authed
// route). No rate limit: mirrors the authed reservations/[id] PATCH
// convention (rateLimit is this codebase's PUBLIC-paid-route guard).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ownership + scope gate (defensive 404 — never confirms a foreign or
    // guest row exists; provider scope covers the two cancel lanes only).
    const owned = await prisma.reservations.findFirst({
      where: { id, userId: user.id, provider: { in: ['liteapi', 'duffel'] } },
      select: { id: true, status: true, provider: true, providerBookingId: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }
    if (owned.status !== 'confirmed') {
      return NextResponse.json(
        { error: `Only a confirmed booking can be cancelled — this one is ${owned.status}.` },
        { status: 409 }
      );
    }

    // ─── Provider dispatch ───────────────────────────────────────────────────
    if (owned.provider === 'duffel') {
      // LAUNCH-01 RETIRE-01: a history row from the retired provider — declared,
      // untouched. The carrier holds the booking; support cancels it by hand.
      return NextResponse.json(
        {
          error:
            "This flight was booked through Duffel, a provider Temple Stuart no longer uses — it can't be cancelled in-app. Contact support and we will cancel it with the carrier.",
          source: 'duffel',
          kind: 'provider_retired',
        },
        { status: 409 }
      );
    }

    // ─── provider 'liteapi' (PR-Cancel-1) ────────────────────────────────────
    // The provider cancel — the only money authority. REBUILD-01 PR-5: the
    // client hands the answer back as received (the bytes) beside the parsed
    // result; `cancelled` serves the failure branch below — what is answered
    // is parsed from the arrival.
    let cancelledAnswer;
    try {
      cancelledAnswer = await cancelBooking(owned.providerBookingId);
    } catch (err) {
      if (err instanceof MissingLiteApiKeyError) {
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
          { status: 500 }
        );
      }
      if (err instanceof LiteApiError) {
        // Policy-rejected (NRFN / past deadline) or provider-side failure: the
        // booking stands, our row is untouched, the provider's message surfaces.
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
          { status: 502 }
        );
      }
      return failClosedResponse('Reservation cancel', 'Cancellation failed', err);
    }
    const { answer, object, cancelled } = cancelledAnswer;

    // ─── Land, then persist the flip — ONE transaction (REBUILD-01 PR-5) ─────
    // The cancel answer's exact bytes land (provider_responses) and its object
    // lands as one arrival (liteapi · cancellation; the answer carries no id of
    // its own, so their_id is composed from the booking and labeled composed);
    // then the status write exactly as today — status is the ONLY field
    // written. A landing failure rolls both back and the catch declares it
    // (src/lib/arrivals/liteapiBooking.ts).
    let landed;
    try {
      landed = await prisma.$transaction(async (tx) =>
        landLiteApiCancellation({
          landing: prismaLanding(tx),
          log: (line) => console.log(line),
          writeStatus: async () =>
            tx.reservations.update({
              where: { id: owned.id },
              data: { status: 'cancelled' },
            }),
        }, {
          answer,
          bookingId: owned.providerBookingId,
          payload: object,
          parse: parseCancelResult,
          userId: user.id,
        }),
      );
    } catch (dbErr) {
      // The provider ALREADY cancelled — the money truth exists upstream but our
      // row still says confirmed (the landing rolled back with the flip).
      // Surface loudly (mirrors the book routes' DB-fail-after convention);
      // include the provider outcome so it isn't lost.
      console.error('[Reservation cancel] DB update failed AFTER provider cancel:', {
        reservationId: owned.id, providerBookingId: owned.providerBookingId, error: dbErr,
      });
      return NextResponse.json(
        {
          error:
            'The booking was cancelled at the provider, but we could not update the local record — refresh, and contact support if it still shows confirmed.',
          cancellation: {
            providerStatus: cancelled.status,
            cancellationFee: cancelled.cancellationFee,
            refundAmount: cancelled.refundAmount,
            currency: cancelled.currency,
          },
        },
        { status: 500 }
      );
    }
    const row = landed.reservation;

    return NextResponse.json({
      reservation: { id: row.id, status: row.status },
      // Provider verbatim (parsed from the arrival) — null means "not stated by
      // provider", never zero.
      cancellation: {
        providerStatus: landed.parsed.status,
        cancellationFee: landed.parsed.cancellationFee,
        refundAmount: landed.parsed.refundAmount,
        currency: landed.parsed.currency,
      },
    });
  } catch (error) {
    console.error('[Reservation cancel] request error:', error);
    return NextResponse.json({ error: 'Failed to cancel the reservation' }, { status: 500 });
  }
}
