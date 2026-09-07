import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookFlight, parseFlightBookResult, FlightOfferExpiredError, type FlightBookResult } from '@/lib/liteapiFlightsClient';
import { landLiteApiBooking } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

// ─── PUBLIC LiteAPI flight BOOK (PR-FL-5) ────────────────────────────────────
// POST /api/travel/liteapi/flights/book — completes the flight booking AFTER
// the browser confirmed the Stripe payment (FL-4 panel). Body:
// { prebookId, transactionId }. Public (guest-ok — booking is never locked);
// auth is OPTIONAL exactly like the hotel book route (liteapi/book/route.ts:
// 93-103): logged-in → ACCOUNT reservation (userId set), logged-out → GUEST
// reservation (userId null). The upstream call is IDEMPOTENT per prebookId
// (docs: "Returns the existing booking if one already exists for the given
// prebookId") — a client retry cannot double-book or double-charge.
//
// Public + money-completing → MANDATORY guards BEFORE the LiteAPI call, in the
// hotel book route's order (:51-129):
//   1. rateLimit('liteapi-flight-book:'+ip) — the hotel BOOK window (3/300s,
//      liteapi/book/route.ts:52): booking is the money tier, not the search
//      tier.
//   2. reserveTravelSearch('liteapiflightbooking') — NEW plain-string quota
//      value (string column, schema.prisma:1290-region — no schema change),
//      DISTINCT from Duffel's 'flightbooking' cap; money-tier 25/day safe
//      default mirroring hotelbooking (travelSearchQuota.ts).
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (tight window; booking is the real spend).
    await rateLimit(`liteapi-flight-book:${ip}`, { limit: 3, windowSeconds: 300 });

    let body: { prebookId?: unknown; transactionId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const prebookId = typeof body.prebookId === 'string' ? body.prebookId.trim() : '';
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    if (!prebookId || !transactionId) {
      return NextResponse.json(
        { error: 'prebookId and transactionId are required' },
        { status: 400 }
      );
    }

    // ─── Auth is OPTIONAL — account vs guest (hotel pattern :93-103) ─────────
    const userEmail = await getVerifiedEmail();
    const user = userEmail
      ? await prisma.users.findFirst({
          where: { email: { equals: userEmail, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;
    const isAccount = !!user;

    // GUARD 2 — durable daily booking cap, immediately before the LiteAPI call.
    await reserveTravelSearch('liteapiflightbooking');

    // ─── Book at LiteAPI (real call — sandbox or production per env) ─────────
    // REBUILD-01 PR-5: the client hands the answer back as received (the
    // bytes) beside the parsed result; `booked` serves the failure branch
    // below and the ids — what is persisted and answered is parsed from the
    // arrival.
    let bookedAnswer;
    try {
      bookedAnswer = await bookFlight({ prebookId, transactionId });
    } catch (err) {
      if (err instanceof MissingLiteApiKeyError) {
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
          { status: 500 }
        );
      }
      // Dead offer/session (42004/42017) — subclass of LiteApiError, so this
      // branch MUST precede the generic 502.
      if (err instanceof FlightOfferExpiredError) {
        return NextResponse.json(
          {
            error: 'This flight offer expired — run a new search for current prices.',
            code: 'offer_expired',
          },
          { status: 410 }
        );
      }
      if (err instanceof LiteApiError) {
        return NextResponse.json(
          { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
          { status: 502 }
        );
      }
      return failClosedResponse('LiteAPI flights book', 'Flight book failed', err);
    }
    const { answer, object, booked } = bookedAnswer;

    // ─── Land, then persist — ONE transaction (REBUILD-01 PR-5; hotel pattern) ─
    // The book answer's exact bytes land (provider_responses), the booking
    // object (data[0].booking) lands as one arrival (liteapi · booking, kind
    // event by the rule book), and the reservation + commission rows are
    // written FROM THE ARRIVAL PAYLOAD, pointed at it (reservations.arrival_id).
    // A landing failure rolls all of it back and the catch below declares it —
    // never a booking recorded without its evidence. The upstream call is
    // idempotent per prebookId, so a retry's same booking is already_landed:
    // the reservation it recorded is handed back, no second row
    // (src/lib/arrivals/liteapiBooking.ts).
    try {
      const landed = await prisma.$transaction(async (tx) =>
        landLiteApiBooking({
          landing: prismaLanding(tx),
          log: (line) => console.log(line),
          findReservation: async (bookingId) =>
            tx.reservations.findFirst({ where: { provider: 'liteapi', providerBookingId: bookingId } }),
          createReservation: async (parsed: FlightBookResult, arrivalId) => {
            // Flight rows carry no stay window: hotelName/checkinDate/checkoutDate null
            // (the D3 convention the Duffel book route established, flights/book/
            // route.ts:191,208-210). PENDING_CONFIRMATION and PENDING are SUCCESS-
            // shaped (the provider is finalizing — not an error): they persist as
            // 'pending'; CONFIRMED/TICKETED → 'confirmed'; CANCELLED → 'cancelled';
            // absent/unknown → 'pending' (never invented as confirmed).
            const providerStatus = (parsed.status ?? '').toUpperCase();
            const status =
              providerStatus === 'CONFIRMED' || providerStatus === 'TICKETED'
                ? 'confirmed'
                : providerStatus === 'CANCELLED'
                  ? 'cancelled'
                  : 'pending';
            const resolvedPrice = parsed.price ?? 0; // hotel-pattern fallback
            const resolvedCurrency = parsed.currency ?? 'USD';

            const reservation = await tx.reservations.create({
              data: {
                userId: user?.id ?? null,
                tripId: null,
                bookingType: isAccount ? 'account' : 'guest',
                // The book body carries no contact (prebook collected it; Nuitee
                // holds it) — guestEmail stays null for guests. FL-5b (confirmation
                // email) is where a contact re-enters this lane.
                guestEmail: null,
                provider: 'liteapi',
                providerBookingId: parsed.bookingId,
                providerConfirmationCode: parsed.pnr ?? parsed.bookingRef ?? null,
                status,
                hotelName: null,
                checkinDate: null,
                checkoutDate: null,
                finalPriceCents: Math.round(resolvedPrice * 100),
                currency: resolvedCurrency,
                // PR-5: the arrival this row was parsed from.
                arrival_id: arrivalId,
              },
            });

            // Commission row — 'estimated' on book, mirroring the hotel pattern.
            // The flights booking response documents NO commission field, so
            // the margin is recorded as 0 until a real reconciliation source
            // exists — never guessed.
            await tx.commission_ledger.create({
              data: {
                userId: user?.id ?? null,
                reservationId: reservation.id,
                provider: 'liteapi',
                grossAmountCents: Math.round(resolvedPrice * 100),
                commissionAmountCents: 0,
                currency: resolvedCurrency,
                status: 'estimated',
              },
            });

            return reservation;
          },
        }, {
          answer,
          object: { theirId: booked.bookingId, payload: object },
          parse: parseFlightBookResult,
          userId: user?.id ?? null,
          lane: 'flight',
        }),
      );
      const result = landed.reservation;
      // Parsed from the arrival — the audit trail and the envelope speak from the table.
      const parsed = landed.parsed;

      // ─── Audit trail (PR-FL-5) ─────────────────────────────────────────────
      // Neither booking route wrote audit_log before this PR; FL-5 starts the
      // practice. AuditActionType has no reservation value (adding one is an
      // enum migration — HARD GATE, deliberately not taken), so this uses the
      // enum's documented escape hatch 'system_other' with a precise
      // description. request_id keys on the bookingId, so the upstream
      // idempotent-retry case cannot double-log. A failed audit write is
      // DECLARED (loud log) but never fails a real, paid booking (the D5
      // rationale the confirmation email follows).
      try {
        await writeAuditLog({
          actor: {
            user_id: user?.id ?? null,
            email: userEmail ?? null,
            type: 'human_user',
            ip,
          },
          action: {
            type: 'system_other',
            description: `liteapi_flight_booking_created — reservation ${result.id} persisted for /flights/bookings`,
          },
          target: { table: 'reservations', id: result.id },
          payload: {
            metadata: {
              bookingId: parsed.bookingId,
              bookingRef: parsed.bookingRef,
              providerStatus: parsed.status,
              paymentStatus: parsed.paymentStatus,
              bookingType: result.bookingType,
            },
          },
          request_id: `liteapi-flight-book-${parsed.bookingId}`,
        });
      } catch (auditErr) {
        console.error('[LiteAPI flights book] audit log FAILED (booking + persist succeeded):', {
          bookingId: parsed.bookingId,
          reservationId: result.id,
          error: auditErr instanceof Error ? auditErr.message : auditErr,
        });
      }

      // WHITELISTED envelope (ruled): the seven fields, provider status
      // VERBATIM — PENDING_CONFIRMATION arrives here as a 200 success shape.
      return NextResponse.json({
        bookingId: parsed.bookingId,
        bookingRef: parsed.bookingRef,
        status: parsed.status,
        paymentStatus: parsed.paymentStatus,
        pnr: parsed.pnr,
        price: parsed.price,
        currency: parsed.currency,
      });
    } catch (dbErr) {
      // LiteAPI booked the flight but we failed to land or persist — the whole
      // transaction rolled back (no evidence without the booking, no booking
      // without its evidence); surface loudly so ops can reconcile (the
      // upstream booking is real and paid). Hotel pattern.
      console.error('[LiteAPI flights book] DB persist failed AFTER successful booking:', {
        bookingId: booked.bookingId, error: dbErr,
      });
      return NextResponse.json(
        {
          error: 'Booking succeeded at LiteAPI but failed to persist locally — contact support with bookingId',
          bookingId: booked.bookingId,
          bookingRef: booked.bookingRef,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // Guard rejections map BEFORE the generic 500 — the LiteAPI book call was
    // never reached on these paths (hotel pattern :276-296).
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many booking attempts — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Flight booking is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    return failClosedResponse('LiteAPI flights book', 'Flight book failed', error);
  }
}
