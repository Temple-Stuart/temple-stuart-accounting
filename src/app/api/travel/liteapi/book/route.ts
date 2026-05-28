import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookRate, type BookGuest, type BookHolder } from '@/lib/liteapiClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';

// POST /api/travel/liteapi/book
// Body: {
//   tripId,
//   prebookId,
//   paymentTransactionId,       // from the SDK after the user pays
//   holder: { firstName, lastName, email },
//   guests: [{ occupancyNumber, firstName, lastName, email }],
//   // Persisted for our reservation row (LiteAPI's response is the source
//   // of truth, but we capture client-supplied values defensively):
//   checkinDate, checkoutDate, hotelName?, guestCount, finalPriceCents?,
//   currency?, commissionAmountCents?
// }
// Auth: cookie verify → user lookup → trip ownership. On success: book →
// write reservation + commission_ledger in a Prisma transaction.

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
  finalPriceCents?: number;      // client passes prebook.price * 100 if known
  currency?: string;
  commissionAmountCents?: number; // from prebook.commission * 100
}

export async function POST(request: NextRequest) {
  // ─── Auth (cookie verify + user lookup FIRST) ────────────────────────────
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

  if (!tripId || !prebookId || !paymentTransactionId) {
    return NextResponse.json(
      { error: 'tripId, prebookId, and paymentTransactionId are required' },
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

  // ─── Ownership check — user-scoped query per security mandate ────────────
  const trip = await prisma.trips.findFirst({
    where: { id: tripId, userId: user.id },
    select: { id: true },
  });
  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  // ─── Book at LiteAPI (real call — sandbox or production per env) ─────────
  let booked;
  try {
    booked = await bookRate({
      prebookId,
      holder,
      guests,
      paymentTransactionId,
    });
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
  // Use LiteAPI's response as the source of truth where present, fall back to
  // client-supplied values (set at prebook time) where it didn't echo back.
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
          userId: user.id,
          tripId,
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

      // Commission row — 'estimated' on book, flipped to 'confirmed' by a
      // later reconciliation/webhook PR (LiteAPI confirms payouts weekly).
      await tx.commission_ledger.create({
        data: {
          userId: user.id,
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
      },
    });
  } catch (dbErr) {
    // LiteAPI booked the hotel but we failed to persist — surface loudly so
    // ops can manually reconcile (the upstream booking is real and chargeable).
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
}
