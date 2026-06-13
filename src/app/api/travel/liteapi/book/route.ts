import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookRate, type BookGuest, type BookHolder } from '@/lib/liteapiClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// POST /api/travel/liteapi/book  — PUBLIC (PR-G2: guest booking).
// Body: {
//   tripId?,                     // account bookings only (the save-to-trip linkage)
//   prebookId, paymentTransactionId,   // from prebook (sandbox passthrough; SDK = PR-B2)
//   holder: { firstName, lastName, email },
//   guests: [{ occupancyNumber, firstName, lastName, email }],
//   checkinDate, checkoutDate, hotelName?, guestCount, finalPriceCents?, currency?,
//   commissionAmountCents?
// }
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
  finalPriceCents?: number;
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
      finalPriceCents, currency, commissionAmountCents,
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

    // ACCOUNT path requires a tripId the user owns — that ownership-checked trip
    // is the save-to-trip/budget linkage (the value-add). GUEST path: no trip.
    let resolvedTripId: string | null = null;
    if (isAccount) {
      if (!tripId) {
        return NextResponse.json(
          { error: 'tripId is required for an account booking' },
          { status: 400 }
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
    let booked;
    try {
      booked = await bookRate({ prebookId, holder, guests, paymentTransactionId });
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
      console.error('[LiteAPI book] unexpected error:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Book failed' },
        { status: 500 }
      );
    }

    // ─── Persist reservation + commission ledger (single transaction) ────────
    // LiteAPI's response is the source of truth where present; fall back to the
    // client-supplied (prebook-time) values where it didn't echo back.
    const resolvedPrice = booked.price ?? (finalPriceCents != null ? finalPriceCents / 100 : 0);
    const resolvedCommission = booked.commission ?? (commissionAmountCents != null ? commissionAmountCents / 100 : 0);
    const resolvedCurrency = booked.currency ?? currency ?? 'USD';
    const resolvedHotelName = booked.hotelName ?? hotelName ?? null;
    const resolvedGuestCount = guestCount ?? guests.length;
    const status = (booked.status || 'CONFIRMED').toUpperCase() === 'CONFIRMED'
      ? 'confirmed'
      : 'pending';

    try {
      const result = await prisma.$transaction(async (tx) => {
        const reservation = await tx.reservations.create({
          data: {
            // PR-G2: account → userId/tripId set + bookingType 'account';
            // guest → both null, guestEmail captured, bookingType 'guest'.
            userId: user?.id ?? null,
            tripId: resolvedTripId,
            bookingType: isAccount ? 'account' : 'guest',
            guestEmail: isAccount ? null : holder.email,
            provider: 'liteapi',
            providerBookingId: booked.bookingId,
            providerConfirmationCode: booked.hotelConfirmationCode || booked.supplierConfirmationNum || null,
            status,
            hotelName: resolvedHotelName,
            checkinDate: new Date(checkinDate + 'T12:00:00Z'),
            checkoutDate: new Date(checkoutDate + 'T12:00:00Z'),
            guestCount: resolvedGuestCount,
            finalPriceCents: Math.round(resolvedPrice * 100),
            currency: resolvedCurrency,
            cancellationPolicyJson: (booked.cancellationPolicies ?? null) as object,
          },
        });

        // Commission row — 'estimated' on book, flipped to 'confirmed' by a later
        // reconciliation/webhook PR. userId null for a guest (margin earned anyway).
        await tx.commission_ledger.create({
          data: {
            userId: user?.id ?? null,
            reservationId: reservation.id,
            provider: 'liteapi',
            grossAmountCents: Math.round(resolvedPrice * 100),
            commissionAmountCents: Math.round(resolvedCommission * 100),
            currency: resolvedCurrency,
            status: 'estimated',
          },
        });

        return reservation;
      });

      return NextResponse.json({
        reservation: {
          id: result.id,
          provider: 'liteapi',
          bookingId: booked.bookingId,
          confirmationCode: result.providerConfirmationCode,
          status: result.status,
          hotelName: result.hotelName,
          checkinDate,
          checkoutDate,
          finalPriceCents: result.finalPriceCents,
          currency: result.currency,
          bookingType: result.bookingType,
        },
      });
    } catch (dbErr) {
      // LiteAPI booked the hotel but we failed to persist — surface loudly so ops
      // can manually reconcile (the upstream booking is real and chargeable).
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
    console.error('[LiteAPI book] request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Book failed' },
      { status: 500 }
    );
  }
}
