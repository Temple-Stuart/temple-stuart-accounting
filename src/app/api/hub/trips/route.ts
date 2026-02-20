import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const trips = await prisma.trips.findMany({
      where: { 
        userId: user.id,
        status: 'committed'
      },
      include: {
        budget_line_items: {
          select: { amount: true }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    const tripsWithBudget = trips.map(trip => ({
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      latitude: trip.latitude ? Number(trip.latitude) : null,
      longitude: trip.longitude ? Number(trip.longitude) : null,
      startDate: trip.startDate,
      endDate: trip.endDate,
      destinationPhoto: trip.destinationPhoto,
      totalBudget: trip.budget_line_items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    }));

    return NextResponse.json({ trips: tripsWithBudget });
  } catch (error) {
    console.error('Hub trips error:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}
