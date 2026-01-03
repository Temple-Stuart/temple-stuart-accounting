import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      totalBudget: trip.budget_line_items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    }));

    return NextResponse.json({ trips: tripsWithBudget });
  } catch (error) {
    console.error('Hub trips error:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}
