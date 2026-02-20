import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { getCurrentUser } from '@/lib/auth-helpers';

// GET all trips for current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
            budget_line_items: true,
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { 
      name, 
      destination, 
      activity,      // backward compat: single activity (deprecated)
      activities,    // NEW: array of activities
      month, 
      year, 
      daysTravel, 
      daysRiding, 
      startDate 
    } = body;

    // Validate required fields
    if (!name || !month || !year || !daysTravel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Require at least one activity
    const activityArray = activities || (activity ? [activity] : []);
    if (activityArray.length === 0) {
      return NextResponse.json({ error: 'At least one activity is required' }, { status: 400 });
    }

    // Generate invite token for the trip
    const tripInviteToken = randomBytes(16).toString('hex');

    // Create trip with owner as first participant
    const trip = await prisma.trips.create({
      data: {
        userId: user.id,
        name,
        destination: destination || null,
        activity: activityArray[0] || null,  // backward compat: store primary activity
        activities: activityArray,            // NEW: store full array
        month: parseInt(month),
        year: parseInt(year),
        daysTravel: parseInt(daysTravel),
        daysRiding: daysRiding ? parseInt(daysRiding) : parseInt(daysTravel), // default to daysTravel
        startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
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
