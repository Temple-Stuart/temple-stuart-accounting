import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET — Load saved scanner results for this trip
// Auth: trip owner OR confirmed participant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Check: trip owner OR confirmed participant
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) {
      const participant = await prisma.trip_participants.findFirst({
        where: { tripId: id, email: { equals: userEmail, mode: 'insensitive' }, rsvpStatus: 'confirmed' },
      });
      if (!participant) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const results = await prisma.trip_scanner_results.findMany({
      where: { tripId: id },
      orderBy: { category: 'asc' },
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Scanner results GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch scanner results' }, { status: 500 });
  }
}

// DELETE — Clear scanner results for a specific category
// Auth: trip owner only
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const destination = searchParams.get('destination');

    if (category && destination) {
      await prisma.trip_scanner_results.deleteMany({
        where: { tripId: id, category, destination },
      });
    } else {
      await prisma.trip_scanner_results.deleteMany({
        where: { tripId: id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Scanner results DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete scanner results' }, { status: 500 });
  }
}
