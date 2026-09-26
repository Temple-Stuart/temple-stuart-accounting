import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookFlight, parseFlightBookResult, FlightOfferExpiredError, LiteApiFlightsApiError, type FlightBookResult } from '@/lib/liteapiFlightsClient';
import { landLiteApiBooking } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
// FL-5b: the confirmation email, restored to this lane.
import { sendTransactionalEmail } from '@/lib/email';
import { flightConfirmation } from '@/lib/emailTemplates/flightConfirmation';
// LANE-01 (2026-09-25): a flight's day, name and current status come from the
// vendor's GET /flights/bookings/{id}, applied AFTER the reservation is committed
// — CAL-01's ordering. The status mapping is the one leaf both this route and the
// refresh use.
import { prismaBookingCalendar } from '@/lib/calendar/prismaBookingCalendar';
import { getFlightBooking } from '@/lib/liteapiFlightsClient';
import { refreshFlightReservation, type FlightRefreshOutcome, type FlightReservationPatch } from '@/lib/reservations/refreshFlightReservation';
// STATUS-01 (2026-09-26): the refresh hands the status to the one apply leaf, which
// may owe a 'ticketed' email (marker stamped in its write); the one attempt is made
// here, after the refresh, and never fails the paid booking.
import { sendLifecycleEmail } from '@/lib/reservations/lifecycleSend';
import { flightProviderStatusToReservation } from '@/lib/reservations/flightStatus';

// ─── PUBLIC LiteAPI flight BOOK (PR-FL-5) ────────────────────────────────────
// POST /api/travel/liteapi/flights/book — completes the flight booking AFTER
// the browser confirmed the Stripe payment (FL-4 panel). Body:
// { prebookId, transactionId, tripId? }. Public (guest-ok — booking is never locked);
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
//      money-tier 25/day safe default mirroring hotelbooking
//      (travelSearchQuota.ts).
//
// SEC-03 (2026-09-25) — NO PII IN A URL, NO FABRICATED NUMBER IN A LEDGER.
//   · The contact is READ from prebook_contacts by prebookId (the prebook route
//     wrote it), never taken from the body or a query string. No row → a named
//     400 BEFORE the quota reservation and the vendor call. A retry reads the
//     same row.
//   · The price the vendor did not state is NULL in reservations.finalPriceCents
//     and commission_ledger.grossAmountCents — logged loudly by bookingId —
//     never 0. The currency the vendor did not state is the currency the
//     SEARCH was made in, stored with the contact; when neither exists the
//     route throws the way a 2xx without data[] throws. No literal anywhere.
//   · One confirmation email per booking: sent to the STORED address when this
//     request created the reservation; a retry that finds the reservation
//     already recorded reports email.sent = 'earlier' and sends nothing.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (tight window; booking is the real spend).
    await rateLimit(`liteapi-flight-book:${ip}`, { limit: 3, windowSeconds: 300 });

    let body: { prebookId?: unknown; transactionId?: unknown; tripId?: unknown };
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

    // ─── SEC-03: THE CONTACT, STORED — read by prebookId, never carried ──────
    // FL-5b made the contact REQUIRED here ("a paid flight with nowhere to send
    // the confirmation is not a booking anyone can use") and had the panel hand
    // it over in the returnUrl. SEC-03 keeps the requirement and moves the
    // address off the URL: the prebook route validated it with its own regex and
    // wrote it to prebook_contacts under the vendor's prebookId, and this route
    // reads that row. No row (or a row from another lane) is refused BY NAME and
    // BEFORE the quota reservation and the provider call, so it costs nothing.
    // Nothing here defaults a recipient, reads a query string, or substitutes
    // the account's email. A retry reads the same row.
    const contact = await prisma.prebook_contacts.findUnique({ where: { prebookId } });
    if (!contact || contact.lane !== 'flight') {
      return NextResponse.json(
        {
          error: 'No stored contact for this prebookId — the checkout did not record one, so the booking cannot continue',
          code: 'contact_not_stored',
        },
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

    // ─── LANE-01: tripId is OPTIONAL, with the hotel route's OWN gate ─────────
    // (liteapi/book/route.ts:111-132, verbatim in substance.) When PRESENT it
    // links the booking to a trip, which requires an authed OWNER: a guest is
    // refused by name (401), a trip that is not this user's is a defensive 404.
    // When ABSENT the booking is STANDALONE — a public guest, or an authed user
    // booking from a surface with no trip selected (the homepage) — and stays
    // unattached; the unattached list is where it is adopted from.
    const tripId = typeof body.tripId === 'string' ? body.tripId.trim() : '';
    let resolvedTripId: string | null = null;
    if (tripId) {
      if (!isAccount) {
        return NextResponse.json(
          { error: 'Sign in to save a booking to a trip.' },
          { status: 401 }
        );
      }
      const trip = await prisma.trips.findFirst({
        where: { id: tripId, userId: user!.id },
        select: { id: true },
      });
      if (!trip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
      }
      resolvedTripId = tripId;
    }

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
            // (the D3 convention). PENDING_CONFIRMATION and PENDING are SUCCESS-
            // shaped (the provider is finalizing — not an error): they persist as
            // 'pending'; CONFIRMED/TICKETED → 'confirmed'; CANCELLED → 'cancelled';
            // absent/unknown → 'pending' (never invented as confirmed).
            // LANE-01: the mapping lives in ONE leaf (reservations/flightStatus.ts)
            // that the refresh below uses too, so the two can never drift. At
            // creation an unmapped status is 'pending' — never invented as confirmed.
            const mapped = flightProviderStatusToReservation(parsed.status);
            const status = mapped === null ? 'pending' : mapped;
            // SEC-03: THE MONEY IS WHAT THE VENDOR STATED, OR NULL. A price the book
            // answer does not carry is NULL in both ledgers and said loudly by
            // bookingId — never 0, which the matcher used to have to read as
            // "unknown" and which made a real $0 indistinguishable from a gap.
            const statedPrice = parsed.price;
            if (statedPrice === null) {
              console.error('[LiteAPI flights book] SEC-03 the vendor stated NO price — finalPriceCents and grossAmountCents recorded NULL; reconcile against the bank:', {
                bookingId: parsed.bookingId,
              });
            }
            const statedCents = statedPrice === null ? null : Math.round(statedPrice * 100);
            // The currency is the vendor's, else the currency the SEARCH was made in
            // (stated by the panel, stored with the contact). Neither → the same
            // contract-deviation throw a 2xx without data[] raises: the landing rolls
            // back and the catch below declares it. Never a literal.
            const resolvedCurrency = parsed.currency ?? contact.searchCurrency;
            if (resolvedCurrency === null) {
              throw new LiteApiFlightsApiError(
                '/flights/bookings',
                200,
                null,
                `Book 2xx missing pricing.currency for ${parsed.bookingId} and the checkout stated no search currency — contract deviation from the documented shape`,
              );
            }

            const reservation = await tx.reservations.create({
              data: {
                userId: user?.id ?? null,
                // LANE-01: the owner-verified trip, or null (standalone).
                tripId: resolvedTripId,
                bookingType: isAccount ? 'account' : 'guest',
                // The contact lives in prebook_contacts under the prebookId (SEC-03);
                // this row does not copy it — guestEmail stays null for guests.
                guestEmail: null,
                provider: 'liteapi',
                // LANE-01: the lane this route already hands the landing (below,
                // lane: 'flight') is written on the row, so a reader never derives
                // it from `provider`. The name is NOT stated by the book answer (no
                // route on it — CAL-01 STEP 1.5); the refresh after the commit
                // writes it from GET /flights/bookings once the vendor states it.
                lane: 'flight',
                displayName: null,
                providerBookingId: parsed.bookingId,
                providerConfirmationCode: parsed.pnr ?? parsed.bookingRef ?? null,
                status,
                hotelName: null,
                checkinDate: null,
                checkoutDate: null,
                finalPriceCents: statedCents,
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
                grossAmountCents: statedCents,
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

      // ─── LANE-01: the flight's day, its name and its status — vendor-stated ──
      // CAL-01's ordering, exactly: the reservation transaction has COMMITTED
      // above (`result` is its row), this runs OUTSIDE it, in its own try/catch,
      // against the top-level client — a failure here is declared loudly and the
      // paid booking still returns 200. One GET /flights/bookings/{id}: the
      // OUTBOUND departure → the calendar row on that day (source='reservation',
      // source_id=reservation.id, as CAL-01); carrier + route → displayName; the
      // vendor's current status → the row, through the same mapping as above.
      // Idempotent: a retry that lands the same booking finds its row, its name and
      // its status already in place and changes nothing.
      //
      // THE SAME GUARD DISCIPLINE AS THE BOOK CALL: this request already passed the
      // per-IP rate limit (GUARD 1) and the read rides the same request; its own
      // durable daily cap ('liteapiflightbookingread') is reserved immediately
      // before it — the vendor documents no cost for this GET, so it is treated as
      // metered. A cap refusal is the named failure below, never a bypass.
      // STATUS-01 (2026-09-26): the refresh's outcome and its one write are kept
      // for the emails the apply leaf owes, attempted AFTER this block (below).
      let refreshed: FlightRefreshOutcome | null = null;
      const wrote: { patch: FlightReservationPatch | null } = { patch: null };
      try {
        await reserveTravelSearch('liteapiflightbookingread');
        const outcome = await refreshFlightReservation(
          {
            fetchBooking: async (bookingId) => {
              const read = await getFlightBooking(bookingId);
              return { ...read.details, readAt: read.answer.arrived };
            },
            calendar: prismaBookingCalendar(prisma),
            writeReservation: async (id, patch) => {
              wrote.patch = patch;
              await prisma.reservations.update({ where: { id }, data: patch });
            },
            cancelCommission: async (reservationId) => (await prisma.commission_ledger.updateMany({ where: { reservationId, status: 'estimated' }, data: { status: 'cancelled' } })).count,
          },
          // The committed row: every column the refresh reads (LANE-01's seven, STATUS-01's five).
          result,
        );
        refreshed = outcome;
        if (!outcome.fetched) {
          console.error('[LiteAPI flights book] LANE-01 refresh did not apply (booking + persist succeeded):', outcome.reason);
        } else {
          console.log(`[LiteAPI flights book] LANE-01 refresh: reservation ${result.id} — calendar ${outcome.calendar}${outcome.day ? ` on ${outcome.day}` : ''}${outcome.calendarReason ? ` (${outcome.calendarReason})` : ''}; name ${outcome.name}${outcome.nameValue ? ` "${outcome.nameValue}"` : ''}; status ${outcome.status} (${outcome.providerStatus ?? 'absent'} → ${outcome.statusValue})${outcome.changes.length ? `; changed: ${outcome.changes.join('; ')}` : ''}`);
        }
      } catch (calErr) {
        console.error('[LiteAPI flights book] LANE-01 refresh FAILED (booking + persist succeeded):', {
          bookingId: parsed.bookingId,
          reservationId: result.id,
          error: calErr instanceof Error ? calErr.message : calErr,
        });
      }

      // ─── STATUS-01: the emails the apply leaf owes ────────────────────────
      // Their markers rode the refresh's one write (ticketedEmailSentAt), so this
      // is the ONE attempt: after the write, in its own try/catch, logged by name
      // on failure inside sendLifecycleEmail (audit_log) — never failing the paid
      // booking, never retried here.
      if (refreshed !== null && refreshed.fetched) {
        for (const request of refreshed.emails) {
          try {
            const sent = await sendLifecycleEmail(
              { ...result, providerConfirmationCode: wrote.patch?.providerConfirmationCode ?? result.providerConfirmationCode, displayName: wrote.patch?.displayName ?? result.displayName },
              request,
            );
            console.log(`[LiteAPI flights book] STATUS-01 lifecycle email ${request.kind}: ${sent.sent ? `sent ${sent.id}` : `not sent (${sent.error})`}`);
          } catch (emailErr) {
            console.error('[LiteAPI flights book] STATUS-01 lifecycle email FAILED (booking + persist succeeded):', { reservationId: result.id, kind: request.kind, error: emailErr instanceof Error ? emailErr.message : emailErr });
          }
        }
      }

      // ─── FL-5b: the confirmation email ─────────────────────────────────────
      // The hotel hook's pattern, exactly (liteapi/book/route.ts:277-311): sent
      // ONLY after the provider booking AND the db persist both succeeded, in its
      // own try/catch, logged loudly on failure, reported as email.sent — and the
      // booking response NEVER fails because email failed. No retry, no alternate
      // transport, no substituted recipient.
      //
      // SEC-03: the recipient is the STORED contact (contact.contactEmail), and
      // ONE attempt per booking: only the request that CREATED the reservation
      // sends; a retry that found it already recorded (landed.reservationOutcome
      // 'existing') reports 'earlier' and sends nothing — the first attempt's
      // outcome, sent or failed, was already reported to that request.
      //
      // The passenger's name comes off the LANDED payload's own passengers array
      // (`object` is data[0].booking). parseFlightBookResult does not map it, so
      // it is read here rather than invented — and when the payload names nobody,
      // the template drops the line instead of guessing.
      const paxList = Array.isArray((object as { passengers?: unknown }).passengers)
        ? ((object as { passengers: Array<Record<string, unknown>> }).passengers)
        : [];
      const firstPax = paxList[0];
      const paxName = firstPax
        ? [firstPax.firstName, firstPax.lastName].filter((n): n is string => typeof n === 'string' && n.trim().length > 0).join(' ').trim()
        : '';

      let emailStatus: { sent: true; id: string } | { sent: false; error: string } | { sent: 'earlier' };
      if (landed.reservationOutcome === 'existing') {
        emailStatus = { sent: 'earlier' };
      } else {
        try {
          const rendered = flightConfirmation({
            passengerName: paxName || null,
            passengerCount: paxList.length,
            bookingId: parsed.bookingId,
            bookingRef: parsed.bookingRef,
            pnr: parsed.pnr,
            // The reservation's own stored figure, already integer cents — or NULL,
            // which the template says as "price not stated" (SEC-03).
            totalAmountCents: result.finalPriceCents,
            currency: result.currency,
            status: parsed.status ?? null,
          });
          const { id } = await sendTransactionalEmail({
            to: contact.contactEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });
          emailStatus = { sent: true, id };
        } catch (emailErr) {
          const errorClass = emailErr instanceof Error ? emailErr.name : 'UnknownError';
          const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
          console.error('[LiteAPI flights book] confirmation email FAILED (booking itself succeeded):', {
            bookingId: parsed.bookingId, reservationId: result.id, errorClass, message,
          });
          emailStatus = { sent: false, error: errorClass };
        }
      }

      // WHITELISTED envelope (ruled): the seven fields, provider status
      // VERBATIM — PENDING_CONFIRMATION arrives here as a 200 success shape.
      // FL-5b adds `email`, the hotel envelope's own eighth field.
      return NextResponse.json({
        bookingId: parsed.bookingId,
        bookingRef: parsed.bookingRef,
        status: parsed.status,
        paymentStatus: parsed.paymentStatus,
        pnr: parsed.pnr,
        price: parsed.price,
        currency: parsed.currency,
        email: emailStatus,
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
