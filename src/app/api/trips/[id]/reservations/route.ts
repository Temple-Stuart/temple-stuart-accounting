import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET /api/trips/[id]/reservations — a trip's ACTUAL (booked/paid) items.
//
// The twin of GET /api/trips/[id]/budget (the BUDGETED lines). Where budget reads
// budget_line_items (the planned amounts), this reads `reservations` (the real paid
// bookings — hotels write here on pay, finalPriceCents). It mirrors the budget
// route's auth + ownership pattern exactly: verify the session user, then scope the
// query to { tripId, userId } so a user can ONLY read their OWN trip's reservations
// (the userId filter is the ownership gate; guest rows have userId = null and are
// never returned to an account user). Read-only — no writes.
//
// Money is returned as USD (finalPriceCents / 100) so the Actual row matches the
// budget route's USD amounts.

// The provider channel → a plain item type for the UI.
const PROVIDER_TYPE: Record<string, string> = {
  liteapi: 'hotel',
  viator: 'activity',
  duffel: 'flight',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ownership gate (mirrors /budget): scope to this user's rows on this trip.
    const rows = await prisma.reservations.findMany({
      where: { tripId: id, userId: user.id },
      orderBy: { checkinDate: 'asc' },
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
      // PR-Cancel-1: the STORED policy (written at book time) — the pre-cancel
      // dialog renders exactly this, never a fabricated policy.
      cancellationPolicyJson: r.cancellationPolicyJson ?? null,
    }));

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Error fetching trip reservations:', error);
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 });
  }
}
