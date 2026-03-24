import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const entries = await prisma.trip_itinerary.findMany({
      where: { tripId: id },
      orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Itinerary load error:', error);
    return NextResponse.json({ error: 'Failed to load itinerary' }, { status: 500 });
  }
}
