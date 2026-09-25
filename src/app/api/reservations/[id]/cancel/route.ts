import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { cancelBooking, parseCancelResult, type CancelBookingResult } from '@/lib/liteapiClient';
// CANCEL-01 (2026-09-26): the FLIGHT lane's own two endpoints — the quote a
// customer reads first, and the action — plus the post-202 read of cancelIntentAt.
import {
  cancelFlightBooking,
  getFlightBooking,
  getFlightCancellationQuote,
  parseFlightCancellationResult,
  LiteApiFlightsApiError,
  type FlightCancellationResult,
} from '@/lib/liteapiFlightsClient';
import { landLiteApiCancellation } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { flightCancelDecision, hotelCancelMoneyEvents } from '@/lib/reservations/cancellation';
import { markBookingCalendarCancelled } from '@/lib/calendar/bookingEvent';
import { prismaBookingCalendar } from '@/lib/calendar/prismaBookingCalendar';

// /api/reservations/[id]/cancel — in-app cancellation. ONE resource, two verbs:
//   GET  — THE QUOTE (CANCEL-01, flights only): what cancelling would do, read
//          from the vendor and shown to the customer BEFORE they can confirm.
//          Authed, user-scoped, no vendor money moved, reserved against
//          'liteapiflightcancelquote'. A hotel has no quote endpoint at the vendor;
//          its stored policy is what the dialog shows.
//   POST — THE ACTION: the same guards as PR-Cancel-1 (getVerifiedEmail → user →
//          ownership → status gate), then the LANE decides the endpoint:
//            hotel  → PUT /v3.0/bookings/{id} (liteapiClient cancelBooking), as
//                     since PR-Cancel-1 — and now its refund and fee are KEPT as
//                     money_events rows pointed at the arrival, not discarded.
//            flight → POST /flights/bookings/{id}/cancellations (CANCEL-01):
//                     200 CANCELLED / CANCELLED_WITH_CHARGES → 'cancelled' + the
//                     money facts; 202 → 'cancel_pending' with the vendor's own
//                     cancelIntentAt (one GET); 409 → named refusal, nothing changed.
//            other  → 409 cancel_lane_unsupported, before any vendor call.
//   Why one route with two verbs: the quote and the action are two reads of the
//   SAME resource under the SAME auth chain and ownership row; a second file would
//   carry a second copy of that chain and a second pin.
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
//   4. status must be 'confirmed' → 409 (nothing to cancel otherwise; a
//      'cancel_pending' row is already awaiting the airline, said by name).
//
// Money truth: the provider's response is the ONLY authority; absent fields
// are null ("not stated"), never defaulted. Rows are NEVER deleted — the
// financial record lives forever. NOT in middleware PUBLIC_PATHS (authed
// route). No rate limit on the action: mirrors the authed reservations/[id]
// PATCH convention (rateLimit is this codebase's PUBLIC-paid-route guard).
//
// NOT IN THIS PR, by name: the cancellation EMAIL (CANCEL-02); the webhook
// receiver and scheduled refresh that resolve a 202 into its final status and
// money facts (item 3); refund matching in the bank matcher (item 8); journal
// posting of the money facts (item 7). Each is named at the point it attaches.

type OwnedRow = { id: string; status: string; provider: string; providerBookingId: string; lane: string };

/** The auth chain, shared by both verbs: the user, and the row they own. */
async function gate(id: string): Promise<{ ok: true; userId: string; owned: OwnedRow } | { ok: false; response: NextResponse }> {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }
  // Ownership + scope gate (defensive 404 — never confirms a foreign or
  // guest row exists; provider scope covers the two cancel lanes only).
  const owned = await prisma.reservations.findFirst({
    where: { id, userId: user.id, provider: { in: ['liteapi', 'duffel'] } },
    // CANCEL-01: the lane decides which vendor endpoint a cancel may reach.
    select: { id: true, status: true, provider: true, providerBookingId: true, lane: true },
  });
  if (!owned) {
    return { ok: false, response: NextResponse.json({ error: 'Reservation not found' }, { status: 404 }) };
  }
  return { ok: true, userId: user.id, owned };
}

/** The status gate, shared: only a confirmed booking can be quoted or cancelled. */
function statusRefusal(owned: OwnedRow): NextResponse | null {
  if (owned.status === 'confirmed') return null;
  if (owned.status === 'cancel_pending') {
    return NextResponse.json(
      { error: 'A cancellation of this booking is already awaiting the airline — nothing more to request.', code: 'cancel_already_pending' },
      { status: 409 }
    );
  }
  return NextResponse.json(
    { error: `Only a confirmed booking can be cancelled — this one is ${owned.status}.`, code: 'cancel_status' },
    { status: 409 }
  );
}

// ─── GET — THE QUOTE (CANCEL-01) ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const g = await gate(id);
    if (!g.ok) return g.response;
    const { owned } = g;
    if (owned.lane !== 'flight') {
      return NextResponse.json(
        { error: 'Only a flight cancellation has a quote — a hotel shows the terms stored at booking.', code: 'quote_lane_unsupported', lane: owned.lane },
        { status: 409 }
      );
    }
    const refused = statusRefusal(owned);
    if (refused) return refused;

    // Metered immediately before the vendor read — the reference says nothing
    // about this call's cost.
    await reserveTravelSearch('liteapiflightcancelquote');

    let quoted;
    try {
      quoted = await getFlightCancellationQuote(owned.providerBookingId);
    } catch (err) {
      if (err instanceof MissingLiteApiKeyError) {
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
          { status: 500 }
        );
      }
      if (err instanceof LiteApiFlightsApiError && err.status === 409) {
        // 49006 "cannot be quoted in its current state" / 49007 "a cancellation
        // is already in progress" — the vendor's refusal, by its own words.
        return NextResponse.json(
          { error: err.providerMessage !== null ? err.providerMessage : err.message, source: 'liteapi', kind: 'quote_refused', code: 'quote_refused', providerCode: err.providerCode },
          { status: 409 }
        );
      }
      if (err instanceof LiteApiError) {
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
          { status: 502 }
        );
      }
      return failClosedResponse('Reservation cancel quote', 'Cancellation quote failed', err);
    }
    // The parsed quote, verbatim shape — every field the vendor did not state is
    // null; the dialog renders the words as words (confidence, destination).
    return NextResponse.json({ quote: quoted.quote });
  } catch (error) {
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Cancellation quotes are temporarily paused. Please try again later.', code: 'quote_paused' },
        { status: 503 }
      );
    }
    console.error('[Reservation cancel quote] request error:', error);
    return NextResponse.json({ error: 'Failed to quote the cancellation' }, { status: 500 });
  }
}

// ─── POST — THE ACTION ───────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const g = await gate(id);
    if (!g.ok) return g.response;
    const { owned, userId } = g;
    const refused = statusRefusal(owned);
    if (refused) return refused;

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

    // ─── CANCEL-01: THE LANE DECIDES THE ENDPOINT ────────────────────────────
    if (owned.lane === 'hotel') return cancelHotel(owned, userId);
    if (owned.lane === 'flight') return cancelFlight(owned, userId);
    // An activity has no cancel lane. Refused by name, before any vendor call,
    // and the row is untouched.
    return NextResponse.json(
      {
        error: `This cancellation is not available yet — the ${owned.lane} lane has no in-app cancel; contact support and we will cancel it with the vendor.`,
        code: 'cancel_lane_unsupported',
        lane: owned.lane,
      },
      { status: 409 }
    );
  } catch (error) {
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Cancellation is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    console.error('[Reservation cancel] request error:', error);
    return NextResponse.json({ error: 'Failed to cancel the reservation' }, { status: 500 });
  }
}

/** After a FINAL cancel, outside the transaction, in its own try/catch (CAL-01's
 *  posture: real money outranks a calendar row): the reservation's calendar row is
 *  MARKED cancelled — never removed (src/lib/calendar/bookingEvent.ts). */
async function markCalendar(reservationId: string, providerBookingId: string): Promise<'marked' | 'no_row' | 'failed'> {
  try {
    const { marked } = await markBookingCalendarCancelled(prismaBookingCalendar(prisma), reservationId);
    if (marked === 0) {
      console.error('[Reservation cancel] CANCEL-01 no calendar row to mark (cancel + persist succeeded):', { reservationId, providerBookingId });
      return 'no_row';
    }
    return 'marked';
  } catch (calErr) {
    console.error('[Reservation cancel] CANCEL-01 calendar mark FAILED (cancel + persist succeeded):', {
      reservationId, providerBookingId, error: calErr instanceof Error ? calErr.message : calErr,
    });
    return 'failed';
  }
}

// ─── provider 'liteapi' HOTEL (PR-Cancel-1; money kept by CANCEL-01) ─────────
async function cancelHotel(owned: OwnedRow, userId: string) {
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

  // ─── Land, then persist — ONE transaction (REBUILD-01 PR-5) ──────────────
  // The cancel answer's exact bytes land (provider_responses) and its object
  // lands as one arrival (liteapi · cancellation; the answer carries no id of
  // its own, so their_id is composed from the booking and labeled composed);
  // then the status write exactly as before, AND — CANCEL-01 — the money facts
  // the answer states (refund_amount, cancellation_fee) as money_events rows
  // pointed at that arrival, and the 'estimated' commission moved to
  // 'cancelled'. A landing failure rolls all of it back and the catch declares
  // it (src/lib/arrivals/liteapiBooking.ts).
  let landed;
  try {
    landed = await prisma.$transaction(async (tx) =>
      landLiteApiCancellation({
        landing: prismaLanding(tx),
        log: (line) => console.log(line),
        writeStatus: async (parsed: CancelBookingResult, arrivalId) => {
          const row = await tx.reservations.update({
            where: { id: owned.id },
            data: { status: 'cancelled' },
          });
          const moneyEvents = hotelCancelMoneyEvents(parsed, { reservationId: owned.id, arrivalId, statedAt: answer.arrived });
          await tx.money_events.createMany({ data: moneyEvents });
          // item 7: journal posting of these money facts attaches here — NOT this PR.
          const commission = await tx.commission_ledger.updateMany({
            where: { reservationId: owned.id, status: 'estimated' },
            data: { status: 'cancelled' },
          });
          return { row, moneyEvents: moneyEvents.length, commissionMoved: commission.count };
        },
      }, {
        answer,
        bookingId: owned.providerBookingId,
        payload: object,
        parse: parseCancelResult,
        userId,
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
  const { row, moneyEvents, commissionMoved } = landed.reservation;
  const calendar = await markCalendar(owned.id, owned.providerBookingId);
  // CANCEL-02: the cancellation EMAIL attaches here — NOT this PR.

  return NextResponse.json({
    reservation: { id: row.id, status: row.status },
    // Provider verbatim (parsed from the arrival) — null means "not stated by
    // provider", never zero.
    cancellation: {
      providerStatus: landed.parsed.status,
      cancellationFee: landed.parsed.cancellationFee,
      refundAmount: landed.parsed.refundAmount,
      currency: landed.parsed.currency,
      destination: null,
      vouchers: [],
      pending: false,
      cancelIntentAt: null,
      moneyEvents,
      commissionMoved,
      calendar,
    },
  });
}

// ─── provider 'liteapi' FLIGHT (CANCEL-01) ───────────────────────────────────
async function cancelFlight(owned: OwnedRow, userId: string) {
  let cancelledAnswer;
  try {
    cancelledAnswer = await cancelFlightBooking(owned.providerBookingId);
  } catch (err) {
    if (err instanceof MissingLiteApiKeyError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
        { status: 500 }
      );
    }
    if (err instanceof LiteApiFlightsApiError && err.status === 409) {
      // The vendor REFUSED — nothing changed, at the airline or here. Its own
      // words are what the customer reads.
      return NextResponse.json(
        { error: err.providerMessage !== null ? err.providerMessage : err.message, source: 'liteapi', kind: 'cancel_refused', code: 'cancel_refused', providerCode: err.providerCode },
        { status: 409 }
      );
    }
    if (err instanceof LiteApiError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
        { status: 502 }
      );
    }
    return failClosedResponse('Reservation cancel', 'Cancellation failed', err);
  }
  const { answer, object, cancelled } = cancelledAnswer;

  // ─── Land, then persist — ONE transaction ────────────────────────────────
  // The answer lands as an arrival (liteapi · cancellation, composed id), and
  // the leaf decides the writes from the ARRIVAL payload and the HTTP status:
  //   200 → 'cancelled' + money_events (refund, cancellation_fee, a voucher_issued
  //         per voucher) + vouchers rows, each pointed at the arrival; the
  //         'estimated' commission moves to 'cancelled'.
  //   202 → 'cancel_pending'; NOTHING to money_events (item 3 resolves it).
  let landed;
  try {
    landed = await prisma.$transaction(async (tx) =>
      landLiteApiCancellation({
        landing: prismaLanding(tx),
        log: (line) => console.log(line),
        writeStatus: async (parsed: FlightCancellationResult, arrivalId) => {
          const decision = flightCancelDecision(parsed, answer.httpStatus, { reservationId: owned.id, arrivalId, statedAt: answer.arrived });
          const row = await tx.reservations.update({
            where: { id: owned.id },
            data: { status: decision.status },
          });
          if (decision.moneyEvents.length > 0) await tx.money_events.createMany({ data: decision.moneyEvents });
          if (decision.vouchers.length > 0) {
            await tx.vouchers.createMany({
              data: decision.vouchers.map((v) => ({
                ...v,
                // NULL = the vendor stated no names (SQL NULL, not JSON null).
                passengerNames: v.passengerNames === null ? Prisma.DbNull : v.passengerNames,
              })),
            });
          }
          for (const v of decision.vouchersWithoutCode) {
            console.error('[Reservation cancel] CANCEL-01 the vendor stated a voucher with no code — its money fact is recorded, no voucher row:', { reservationId: owned.id, voucher: v });
          }
          // item 7: journal posting of these money facts attaches here — NOT this PR.
          const commission = decision.commission === 'cancel'
            ? await tx.commission_ledger.updateMany({ where: { reservationId: owned.id, status: 'estimated' }, data: { status: 'cancelled' } })
            : { count: 0 };
          return { row, decision, commissionMoved: commission.count };
        },
      }, {
        answer,
        bookingId: owned.providerBookingId,
        payload: object,
        parse: parseFlightCancellationResult,
        userId,
      }),
    );
  } catch (dbErr) {
    console.error('[Reservation cancel] DB update failed AFTER provider cancel (flight):', {
      reservationId: owned.id, providerBookingId: owned.providerBookingId, httpStatus: answer.httpStatus, error: dbErr,
    });
    return NextResponse.json(
      {
        error:
          'The cancellation was accepted at the provider, but we could not update the local record — refresh, and contact support if it still shows confirmed.',
        cancellation: {
          providerStatus: cancelled.status,
          cancellationFee: cancelled.cancellationFee,
          refundAmount: cancelled.refundAmount,
          currency: cancelled.currency,
          destination: cancelled.destination,
          vouchers: cancelled.vouchers,
          pending: answer.httpStatus === 202,
        },
      },
      { status: 500 }
    );
  }
  const { row, decision, commissionMoved } = landed.reservation;

  // ─── 202: the vendor's own cancelIntentAt, one GET ───────────────────────
  // The 202 body carries no cancelIntentAt; GET /flights/bookings/{id} does
  // ("set when a cancellation was requested and is awaiting airline
  // confirmation"). One read, reserved against LANE-01's bucket, outside the
  // transaction, in its own try/catch: a failed or silent read leaves the
  // column NULL and says so — never our clock in the vendor's column.
  // item 3: the webhook receiver and scheduled refresh that resolve this 202
  // into CANCELLED / CANCELLED_WITH_CHARGES and its money facts attach here —
  // NOT this PR.
  let cancelIntentAt: string | null = null;
  if (!decision.final) {
    try {
      await reserveTravelSearch('liteapiflightbookingread');
      const { details } = await getFlightBooking(owned.providerBookingId);
      if (details.cancelIntentAt !== null && !Number.isNaN(Date.parse(details.cancelIntentAt))) {
        await prisma.reservations.update({ where: { id: owned.id }, data: { cancelIntentAt: new Date(details.cancelIntentAt) } });
        cancelIntentAt = details.cancelIntentAt;
      } else {
        console.error('[Reservation cancel] CANCEL-01 202 accepted but GET /flights/bookings stated no cancelIntentAt — left NULL:', {
          reservationId: owned.id, providerBookingId: owned.providerBookingId, stated: details.cancelIntentAt,
        });
      }
    } catch (readErr) {
      console.error('[Reservation cancel] CANCEL-01 cancelIntentAt read FAILED after a 202 (cancel_pending persisted) — left NULL:', {
        reservationId: owned.id, providerBookingId: owned.providerBookingId, error: readErr instanceof Error ? readErr.message : readErr,
      });
    }
  }

  // A FINAL cancel marks the day; a pending one leaves the row — the flight is
  // still booked at the airline until it says otherwise.
  const calendar = decision.final ? await markCalendar(owned.id, owned.providerBookingId) : 'pending';
  // CANCEL-02: the cancellation EMAIL attaches here — NOT this PR.

  return NextResponse.json({
    reservation: { id: row.id, status: row.status },
    // Provider verbatim (parsed from the arrival) — null means "not stated by
    // provider", never zero.
    cancellation: {
      providerStatus: landed.parsed.status,
      cancellationFee: landed.parsed.cancellationFee,
      refundAmount: landed.parsed.refundAmount,
      currency: landed.parsed.currency,
      destination: landed.parsed.destination,
      vouchers: landed.parsed.vouchers,
      pending: !decision.final,
      cancelIntentAt,
      moneyEvents: decision.moneyEvents.length,
      commissionMoved,
      calendar,
    },
  });
}
