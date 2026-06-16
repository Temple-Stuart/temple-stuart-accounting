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
          // PR-Trip-Ledger-1: the ledger table shows the date/time/cadence/vendor that
          // live on the linked trip_itinerary — we were already loading the row but only
          // pulling the vendor-option keys. Select the rest too (no new query, no schema
          // change). Manual lines (no itineraryId) stay null → blank "—" in the table.
          select: {
            id: true, vendorOptionId: true, vendorOptionType: true,
            homeDate: true, homeTime: true, destDate: true, destTime: true,
            recurrence: true, vendor: true, vendor_name: true,
          },
        })
      : [];
    const byItineraryId = new Map(itineraries.map((t) => [t.id, t]));

    const withKeys = items.map((it) => {
      const itin = it.itineraryId ? byItineraryId.get(it.itineraryId) : undefined;
      return {
        ...it,
        vendorOptionId: itin?.vendorOptionId ?? null,
        vendorOptionType: itin?.vendorOptionType ?? null,
        // PR-Trip-Ledger-1: the itinerary fields the ledger surfaces. Null on manual
        // lines (no itinerary) → the table renders "—" (truth-first, never imputed).
        startDate: itin?.homeDate ?? null,
        startTime: itin?.homeTime ?? null,
        endDate: itin?.destDate ?? null,
        endTime: itin?.destTime ?? null,
        cadence: itin?.recurrence ?? null,
        vendor: itin?.vendor_name ?? itin?.vendor ?? null,
      };
    });

    return NextResponse.json({ items: withKeys });
  } catch (error) {
    console.error('Error fetching trip budget:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}
