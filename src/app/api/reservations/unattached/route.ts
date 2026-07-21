import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET /api/reservations/unattached — T4 companion read: the authed user's
// ACCOUNT bookings with no trip (tripId null), i.e. the adoptable orphans.
// Same auth pattern and field shape as trips/[id]/reservations so the UI
// reuses one row renderer. userId scoping excludes guest rows by design.
// Ordered by createdAt desc (checkinDate is null for flights — creation time
// is the honest sort for orphans). Read-only; no broader listing exists.

const PROVIDER_TYPE: Record<string, string> = {
  liteapi: 'hotel',
  viator: 'activity',
  duffel: 'flight',
};

export async function GET() {
  try {
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

    const rows = await prisma.reservations.findMany({
      where: { userId: user.id, tripId: null },
      orderBy: { createdAt: 'desc' },
    });

    const reservations = rows.map((r) => ({
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
    }));

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Error fetching unattached reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}
