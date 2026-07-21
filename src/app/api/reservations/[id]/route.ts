import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// PATCH /api/reservations/[id] — T4 retroactive attach/detach.
//
// Body: { tripId: string | null }. tripId is the ONLY field this route can
// EVER write — attach (a trip id) or detach (null). No deletes, no other
// columns, by construction.
//
// Auth chain (the review centerpiece — mirrors the SEC-2 defensive-404
// convention, transfers/[optionId]/route.ts:18-19 and the quad-scoped
// budget-line delete):
//   1. getVerifiedEmail → 401.
//   2. reservation ownership: findFirst({ id, userId: user.id }) → 404. The
//      userId scope is ALSO the guest fence: guest rows have userId = null and
//      can never match — unattachable by design (claim-flow is a separate
//      decision, T0 §5).
//   3. attach target ownership: trips.findFirst({ id: tripId, userId }) → 404
//      (defensive — never confirms a foreign trip exists).
//
// No rate limit: mirrors the authed trips/[id]/* CRUD convention (auth +
// ownership only; rateLimit is this codebase's PUBLIC-paid-route guard —
// verified absent across src/app/api/trips/). Stated, not omitted.

// Provider channel → plain item type (same map as trips/[id]/reservations —
// kept local per that route's own convention).
const PROVIDER_TYPE: Record<string, string> = {
  liteapi: 'hotel',
  viator: 'activity',
  duffel: 'flight',
};

export async function PATCH(
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

    let body: { tripId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const tripId = body.tripId;
    if (tripId !== null && typeof tripId !== 'string') {
      return NextResponse.json(
        { error: 'tripId must be a trip id string (attach) or null (detach)' },
        { status: 400 }
      );
    }

    // Gate 2 — the reservation must be THIS user's account row (guest rows,
    // userId null, can never match: the unattachable-guest fence).
    const owned = await prisma.reservations.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Gate 3 — attaching requires owning the target trip (defensive 404).
    if (tripId !== null) {
      const trip = await prisma.trips.findFirst({
        where: { id: tripId, userId: user.id },
        select: { id: true },
      });
      if (!trip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
      }
    }

    const r = await prisma.reservations.update({
      where: { id: owned.id },
      data: { tripId },
    });

    // Same field shape as the trip read-back, for UI reuse.
    return NextResponse.json({
      reservation: {
        id: r.id,
        name: r.hotelName ?? r.provider,
        provider: r.provider,
        type: PROVIDER_TYPE[r.provider] ?? r.provider,
        amountUsd: r.finalPriceCents / 100,
        currency: r.currency,
        checkIn: r.checkinDate,
        checkOut: r.checkoutDate,
        status: r.status,
        bookingType: r.bookingType,
        confirmationCode: r.providerConfirmationCode,
        tripId: r.tripId,
      },
    });
  } catch (error) {
    console.error('Error updating reservation trip link:', error);
    return NextResponse.json({ error: 'Failed to update reservation' }, { status: 500 });
  }
}
