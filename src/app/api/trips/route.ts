import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET all trips for current user
export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();

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
    const userEmail = await getVerifiedEmail();

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
    const {
      name,
      destination,
      activity,      // backward compat: single activity (deprecated)
      activities,    // NEW: array of activities
      month,
      year,
      daysTravel,
      daysRiding,
      startDate,
      endDate,
      tripType,
    } = body;

    // Calculate duration and month/year from dates if provided
    let computedMonth = month;
    let computedYear = year;
    let computedDaysTravel = daysTravel;

    if (startDate) {
      const start = new Date(startDate + 'T12:00:00');
      computedMonth = computedMonth || (start.getMonth() + 1);
      computedYear = computedYear || start.getFullYear();

      if (endDate) {
        const end = new Date(endDate + 'T12:00:00');
        const diffMs = end.getTime() - start.getTime();
        computedDaysTravel = Math.round(diffMs / 86400000) + 1;
      }
    }

    // Validate required fields
    if (!name || !computedMonth || !computedYear || !computedDaysTravel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Default to 'all' activities — activity field is no longer used as a filter
    const primaryActivity = activity || 'all';
    const activityArray = activities && activities.length > 0 ? activities : [primaryActivity];

    // Generate invite token for the trip
    const tripInviteToken = randomBytes(16).toString('hex');

    // Create trip with owner as first participant
    const parsedDays = typeof computedDaysTravel === 'number' ? computedDaysTravel : parseInt(computedDaysTravel);
    const tripTypeValue = tripType === 'business' ? 'business' : tripType === 'mixed' ? 'mixed' : 'personal';

    const trip = await prisma.trips.create({
      data: {
        userId: user.id,
        name,
        destination: destination || null,
        activity: primaryActivity,            // backward compat: store primary activity
        activities: activityArray,            // NEW: store full array
        month: typeof computedMonth === 'number' ? computedMonth : parseInt(computedMonth),
        year: typeof computedYear === 'number' ? computedYear : parseInt(computedYear),
        daysTravel: parsedDays,
        daysRiding: daysRiding ? parseInt(daysRiding) : parsedDays,
        startDate: startDate ? new Date(startDate + 'T12:00:00') : null,
        endDate: endDate ? new Date(endDate + 'T12:00:00') : null,
        tripType: tripTypeValue as any,
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
