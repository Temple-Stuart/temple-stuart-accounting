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
    const { name, destination, activity, month, year, daysTravel, daysRiding } = body;

    // Validate required fields
    if (!name || !month || !year || !daysTravel || !daysRiding) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate invite token for the trip
    const tripInviteToken = randomBytes(16).toString('hex');

    // Create trip with owner as first participant
    const trip = await prisma.trips.create({
      data: {
        userId: user.id,
        name,
        destination: destination || null,
        activity: activity || null,
        month: parseInt(month),
        year: parseInt(year),
        daysTravel: parseInt(daysTravel),
        daysRiding: parseInt(daysRiding),
        inviteToken: tripInviteToken,
        participants: {
          create: {
            email: user.email,
            firstName: user.name?.split(' ')[0] || 'Owner',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
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

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.templestuart.com';
    const inviteUrl = `${baseUrl}/trips/rsvp?token=${tripInviteToken}`;

    return NextResponse.json({ trip, inviteUrl }, { status: 201 });
  } catch (error) {
    console.error('Create trip error:', error);
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
  }
}
