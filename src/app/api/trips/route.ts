import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// GET all trips for current user
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const trips = await prisma.trips.findMany({
      where: { userId: user.id },
      include: {
        participants: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            rsvpStatus: true,
            isOwner: true
          }
        },
        _count: {
          select: {
            expenses: true,
            itinerary: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error('Get trips error:', error);
    return NextResponse.json({ error: 'Failed to fetch trips' }, { status: 500 });
  }
}

// POST create new trip
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, destination, month, year, daysTravel, daysRiding, rsvpDeadline, participants } = body;

    // Validate required fields
    if (!name || !month || !year || !daysTravel || !daysRiding) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create trip with owner as first participant
    const trip = await prisma.trips.create({
      data: {
        userId: user.id,
        name,
        destination: destination || null,
        month: parseInt(month),
        year: parseInt(year),
        daysTravel: parseInt(daysTravel),
        daysRiding: parseInt(daysRiding),
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
        participants: {
          create: {
            email: user.email,
            firstName: user.name.split(' ')[0] || user.name,
            lastName: user.name.split(' ').slice(1).join(' ') || '',
            inviteToken: randomBytes(32).toString('hex'),
            isOwner: true,
            rsvpStatus: 'confirmed',
            rsvpAt: new Date()
          }
        }
      },
      include: {
        participants: true
      }
    });

    // Add additional participants if provided
    if (participants && Array.isArray(participants) && participants.length > 0) {
      const participantData = participants.map((p: { firstName: string; lastName: string; email: string; phone?: string }) => ({
        tripId: trip.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone || null,
        inviteToken: randomBytes(32).toString('hex'),
        isOwner: false,
        rsvpStatus: 'pending'
      }));

      await prisma.trip_participants.createMany({
        data: participantData,
        skipDuplicates: true
      });
    }

    // Fetch complete trip with all participants
    const completeTrip = await prisma.trips.findUnique({
      where: { id: trip.id },
      include: {
        participants: true
      }
    });

    return NextResponse.json({ trip: completeTrip }, { status: 201 });
  } catch (error) {
    console.error('Create trip error:', error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
