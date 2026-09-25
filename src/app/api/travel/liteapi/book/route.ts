import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookRate, parseBookResult, type BookGuest, type BookHolder, type BookResult } from '@/lib/liteapiClient';
import { landLiteApiBooking } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { sendTransactionalEmail } from '@/lib/email';
import { bookingConfirmation } from '@/lib/emailTemplates/bookingConfirmation';
// CAL-01: the one calendar row a booking earns, and the prisma port behind it.
import { stayCalendarDecision, writeBookingCalendarEvent } from '@/lib/calendar/bookingEvent';
import { prismaBookingCalendar } from '@/lib/calendar/prismaBookingCalendar';

// POST /api/travel/liteapi/book  — PUBLIC (PR-G2: guest booking).
// Body: {
//   tripId?,                     // account bookings only (the save-to-trip linkage)
//   prebookId, paymentTransactionId,   // from prebook (sandbox passthrough; SDK = PR-B2)
//   holder: { firstName, lastName, email },
//   guests: [{ occupancyNumber, firstName, lastName, email }],
//   checkinDate, checkoutDate, hotelName?, guestCount, currency?,
//   commissionAmountCents?
// }
// SEC-03 (2026-09-25): the body carries NO finalPriceCents any more. The price
// in the ledger is what the vendor's BOOK answer states, or NULL (logged loudly
// by bookingId) — never a number the confirm page relayed from its own URL, and
// never 0. `currency` is the currency the SEARCH was made in, as the confirm
// page states it; it is used only when the vendor's answer states no currency,
// and when neither exists the route throws — no literal anywhere.
// AUTH IS OPTIONAL: logged-in → ACCOUNT booking (userId + owned tripId + bookingType
// 'account', links into the trip/budget). Logged-out → GUEST booking (userId/tripId
// null, guestEmail = holder.email, bookingType 'guest', standalone reservation).
// Commission is recorded for BOTH (margin earned regardless of account).
//
// Public + money-spending → MANDATORY guards BEFORE the LiteAPI book call:
//   1. rateLimit('hotel-book:'+ip) — tight (booking is the real spend) → 429.
//   2. reserveTravelSearch('hotelbooking') — durable daily booking cap → 503.

interface BookRequestBody {
  tripId?: string;
  prebookId?: string;
  paymentTransactionId?: string;
  holder?: BookHolder;
  guests?: BookGuest[];
  checkinDate?: string;          // ISO YYYY-MM-DD
  checkoutDate?: string;
  hotelName?: string;
  guestCount?: number;
  currency?: string;
  commissionAmountCents?: number;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (tight window; booking is the real spend).
    await rateLimit(`hotel-book:${ip}`, { limit: 3, windowSeconds: 300 });

    let body: BookRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      tripId, prebookId, paymentTransactionId, holder, guests,
      checkinDate, checkoutDate, hotelName, guestCount,
      currency, commissionAmountCents,
    } = body;

    // ─── Validation (ALWAYS — guest + account both need these) ───────────────
    if (!prebookId || !paymentTransactionId) {
      return NextResponse.json(
        { error: 'prebookId and paymentTransactionId are required' },
        { status: 400 }
      );
    }
    if (!holder?.firstName || !holder?.lastName || !holder?.email) {
      return NextResponse.json(
        { error: 'holder.firstName, holder.lastName, holder.email are required' },
        { status: 400 }
      );
    }
    if (!guests || guests.length === 0) {
      return NextResponse.json(
        { error: 'guests must include at least one occupant' },
        { status: 400 }
      );
    }
    if (!checkinDate || !checkoutDate) {
      return NextResponse.json(
        { error: 'checkinDate and checkoutDate are required' },
        { status: 400 }
      );
    }
    // SEC-03: the search currency, when stated, is an ISO 4217 code — a stated
    // input, validated by name, never defaulted.
    if (currency !== undefined && !(typeof currency === 'string' && /^[A-Z]{3}$/.test(currency))) {
      return NextResponse.json(
        { error: 'currency must be a three-letter ISO 4217 code when provided' },
        { status: 400 }
      );
    }

    // ─── Auth is OPTIONAL — resolve account vs guest ─────────────────────────
    // getVerifiedEmail returns null for a guest (no throw). A present-but-stale
    // email that resolves to no user is also treated as a guest.
    const userEmail = await getVerifiedEmail();
    const user = userEmail
      ? await prisma.users.findFirst({
          where: { email: { equals: userEmail, mode: 'insensitive' } },
          select: { id: true },
        })
      : null;
    const isAccount = !!user;

    // tripId is OPTIONAL (PR-G3). When PRESENT it links the booking to a trip —
    // the save-to-trip/budget value-add — which requires an authed OWNER. When
    // ABSENT the booking is STANDALONE (a public guest, OR an authed user not
    // saving to a trip). This keeps the authed trip-linked flow unchanged while
    // letting the public surface book with no trip (guest or logged-in alike).
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

    // GUARD 2 — durable daily booking cap, immediately before the LiteAPI book.
    await reserveTravelSearch('hotelbooking');

    // ─── Book at LiteAPI (real call — sandbox or production per env) ──────────
    // REBUILD-01 PR-5: the client hands the answer back as received (the
    // bytes) beside the parsed result; `booked` serves the failure branch
    // below and the ids — what is persisted and answered is parsed from the
    // arrival.
    let bookedAnswer;
    try {
      bookedAnswer = await bookRate({ prebookId, holder, guests, paymentTransactionId });
    } catch (err) {
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
      return failClosedResponse('LiteAPI book', 'Book failed', err);
    }
    const { answer, object, booked } = bookedAnswer;

    // ─── Land, then persist — ONE transaction (REBUILD-01 PR-5) ──────────────
    // The book answer's exact bytes land (provider_responses), the booking
    // object lands as one arrival (liteapi · booking, kind event by the rule
    // book), and the reservation + commission rows are written FROM THE
    // ARRIVAL PAYLOAD, pointed at it (reservations.arrival_id). A landing
    // failure rolls all of it back and the catch below declares it — never a
    // booking recorded without its evidence. The same answer again is
    // already_landed: the reservation it recorded is handed back, no second
    // row (src/lib/arrivals/liteapiBooking.ts).
    const resolvedGuestCount = guestCount ?? guests.length;

    try {
      const landed = await prisma.$transaction(async (tx) =>
        landLiteApiBooking({
          landing: prismaLanding(tx),
          log: (line) => console.log(line),
          findReservation: async (bookingId) =>
            tx.reservations.findFirst({ where: { provider: 'liteapi', providerBookingId: bookingId } }),
          createReservation: async (parsed: BookResult, arrivalId) => {
            // SEC-03: THE MONEY IS WHAT THE VENDOR STATED, OR NULL. The book answer's
            // price goes in the ledger; a price it does not carry is NULL in both
            // ledgers and said loudly by bookingId — never the number the confirm
            // page relayed from its URL, never 0.
            const statedPrice = typeof parsed.price === 'number' ? parsed.price : null;
            if (statedPrice === null) {
              console.error('[LiteAPI book] SEC-03 the vendor stated NO price — finalPriceCents and grossAmountCents recorded NULL; reconcile against the bank:', {
                bookingId: parsed.bookingId,
              });
            }
            const statedCents = statedPrice === null ? null : Math.round(statedPrice * 100);
            // The commission column is NOT NULL and the ruling did not open it:
            // the vendor's stated commission, else the prebook-time figure the
            // confirm page carried, else 0 — unchanged by SEC-03, reported.
            const resolvedCommission = parsed.commission ?? (commissionAmountCents != null ? commissionAmountCents / 100 : 0);
            // The currency is the vendor's, else the currency the SEARCH was made in
            // (stated by the confirm page, validated above). Neither → throw, the
            // way the client throws on a 2xx without its documented shape: the
            // landing rolls back and the catch below declares it. Never a literal.
            const resolvedCurrency = parsed.currency ?? currency;
            if (resolvedCurrency === undefined) {
              throw new LiteApiError(
                '/hotels/book',
                200,
                `Book 2xx missing currency for ${parsed.bookingId} and the checkout stated no search currency — contract deviation from the documented shape`,
              );
            }
            const resolvedHotelName = parsed.hotelName ?? hotelName ?? null;
            const status = (parsed.status || 'CONFIRMED').toUpperCase() === 'CONFIRMED'
              ? 'confirmed'
              : 'pending';

            const reservation = await tx.reservations.create({
              data: {
                // PR-G2: account → userId/tripId set + bookingType 'account';
                // guest → both null, guestEmail captured, bookingType 'guest'.
                userId: user?.id ?? null,
                tripId: resolvedTripId,
                bookingType: isAccount ? 'account' : 'guest',
                guestEmail: isAccount ? null : holder.email,
                provider: 'liteapi',
                // LANE-01 (2026-09-25): the lane this route already hands the
                // landing (below, lane: 'hotel') is written on the row, so a reader
                // never derives it from `provider`. The stated name rides beside
                // hotelName as displayName — the one column every lane's name lives
                // in; null here means the vendor stated no name, and the reader
                // shows the lane word and the confirmation, never 'liteapi'.
                lane: 'hotel',
                displayName: resolvedHotelName,
                providerBookingId: parsed.bookingId,
                providerConfirmationCode: parsed.hotelConfirmationCode || parsed.supplierConfirmationNum || null,
                status,
                hotelName: resolvedHotelName,
                checkinDate: new Date(checkinDate + 'T12:00:00Z'),
                checkoutDate: new Date(checkoutDate + 'T12:00:00Z'),
                guestCount: resolvedGuestCount,
                finalPriceCents: statedCents,
                currency: resolvedCurrency,
                cancellationPolicyJson: (parsed.cancellationPolicies ?? null) as object,
                // PR-5: the arrival this row was parsed from.
                arrival_id: arrivalId,
              },
            });

            // Commission row — 'estimated' on book, flipped to 'confirmed' by a later
            // reconciliation/webhook PR. userId null for a guest (margin earned anyway).
            await tx.commission_ledger.create({
              data: {
                userId: user?.id ?? null,
                reservationId: reservation.id,
                provider: 'liteapi',
                grossAmountCents: statedCents,
                commissionAmountCents: Math.round(resolvedCommission * 100),
                currency: resolvedCurrency,
                status: 'estimated',
              },
            });

            return reservation;
          },
        }, {
          answer,
          object: { theirId: booked.bookingId, payload: object },
          parse: parseBookResult,
          userId: user?.id ?? null,
          lane: 'hotel',
        }),
      );
      const result = landed.reservation;

      // ─── CAL-01: the booking lands on the calendar ─────────────────────────
      // OUTSIDE the transaction, with its own try/catch, exactly like the audit
      // log in the flights route (flights/book/route.ts:202-232) and the existing
      // calendar writer in vendor-commit (trips/[id]/vendor-commit/route.ts:573,
      // :598-600). The ruling asked for the same transaction as the reservation
      // AND that a calendar failure never roll back a paid booking; those two
      // cannot both hold, and real money outranks a calendar row — so the row is
      // written after the money is safe and a failure is declared, loudly, while
      // the booking still returns 200.
      //
      // It runs on the retry path too (landed.already ⇒ the same reservation came
      // back), so a first attempt whose calendar write failed heals on the retry
      // instead of staying missing. The write is keyed on (source, source_id) and
      // inserts nothing when the row is already there.
      try {
        const outcome = await writeBookingCalendarEvent(
          prismaBookingCalendar(prisma),
          stayCalendarDecision({
            reservationId: result.id,
            userId: result.userId ?? null,
            hotelName: result.hotelName,
            checkinDate,
            checkoutDate,
          }),
        );
        if (outcome.landed === 'no_row') {
          console.error('[LiteAPI book] CAL-01 no calendar row (booking + persist succeeded):', outcome.reason);
        }
      } catch (calErr) {
        console.error('[LiteAPI book] CAL-01 calendar write FAILED (booking + persist succeeded):', {
          reservationId: result.id,
          bookingId: landed.bookingId,
          error: calErr instanceof Error ? calErr.message : calErr,
        });
      }

      // ─── Booking confirmation email (PR-3, D5) ─────────────────────────────
      // Sent ONLY after both the provider booking AND the DB persist succeeded.
      // Recipient is holder.email — the universally validated contact (the
      // reservations.guestEmail column is null for ACCOUNT bookings by design,
      // and account bookings must receive confirmations too). Failure handling
      // is declared, never hidden: any throw is caught, logged loudly with the
      // bookingId, and reported in the response as email.sent=false — no retry,
      // no alternate transport, and the booking response itself never fails
      // because email failed (D5).
      let emailStatus: { sent: true; id: string } | { sent: false; error: string };
      try {
        const rendered = bookingConfirmation({
          guestName: `${holder.firstName} ${holder.lastName}`,
          hotelName: result.hotelName,
          checkinDate,
          checkoutDate,
          confirmationCode: result.providerConfirmationCode,
          bookingId: landed.bookingId,
          // Integer cents, or NULL — the template says "price not stated" (SEC-03).
          totalAmountCents: result.finalPriceCents,
          currency: result.currency,
        });
        const { id } = await sendTransactionalEmail({
          to: holder.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        emailStatus = { sent: true, id };
      } catch (emailErr) {
        const errorClass = emailErr instanceof Error ? emailErr.name : 'UnknownError';
        const message = emailErr instanceof Error ? emailErr.message : String(emailErr);
        console.error('[LiteAPI book] confirmation email FAILED (booking itself succeeded):', {
          bookingId: landed.bookingId, errorClass, message,
        });
        emailStatus = { sent: false, error: errorClass };
      }

      return NextResponse.json({
        reservation: {
          id: result.id,
          provider: 'liteapi',
          bookingId: landed.bookingId,
          confirmationCode: result.providerConfirmationCode,
          status: result.status,
          hotelName: result.hotelName,
          checkinDate,
          checkoutDate,
          finalPriceCents: result.finalPriceCents,
          currency: result.currency,
          bookingType: result.bookingType,
        },
        email: emailStatus,
      });
    } catch (dbErr) {
      // LiteAPI booked the hotel but we failed to land or persist — the whole
      // transaction rolled back (no evidence without the booking, no booking
      // without its evidence); surface loudly so ops can manually reconcile
      // (the upstream booking is real and chargeable).
      console.error('[LiteAPI book] DB persist failed AFTER successful booking:', {
        bookingId: booked.bookingId, error: dbErr,
      });
      return NextResponse.json(
        {
          error: 'Booking succeeded at LiteAPI but failed to persist locally — contact support with bookingId',
          bookingId: booked.bookingId,
          confirmationCode: booked.hotelConfirmationCode,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // Guard rejections (rate-limit / daily cap) map BEFORE the generic 500 — the
    // LiteAPI book call was never reached on these paths.
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many booking attempts — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Booking is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    return failClosedResponse('LiteAPI book', 'Book failed', error);
  }
}
