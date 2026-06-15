import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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

    const items = await prisma.budget_line_items.findMany({
      where: { tripId: id, userId: user.id }
    });

    // PR-Trips7: surface the vendor-option keys so the home queue can uncommit a
    // committed line via the existing DELETE /vendor-commit. Those keys live on the
    // linked trip_itinerary (vendorOptionId/vendorOptionType), NOT on
    // budget_line_items, joined by itineraryId. Manual lines (no itineraryId / no
    // vendor option) get nulls. Additive — the existing item fields are unchanged.
    const itineraryIds = items
      .map((it) => it.itineraryId)
      .filter((x): x is string => !!x);
    const itineraries = itineraryIds.length
      ? await prisma.trip_itinerary.findMany({
          where: { id: { in: itineraryIds }, tripId: id },
          select: { id: true, vendorOptionId: true, vendorOptionType: true },
        })
      : [];
    const byItineraryId = new Map(itineraries.map((t) => [t.id, t]));

    const withKeys = items.map((it) => {
      const itin = it.itineraryId ? byItineraryId.get(it.itineraryId) : undefined;
      return {
        ...it,
        vendorOptionId: itin?.vendorOptionId ?? null,
        vendorOptionType: itin?.vendorOptionType ?? null,
      };
    });

    return NextResponse.json({ items: withKeys });
  } catch (error) {
    console.error('Error fetching trip budget:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}
