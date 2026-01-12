import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Load trip data for a participant using their token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Find participant by token
    const participant = await prisma.trip_participants.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        rsvpStatus: true,
        isOwner: true,
        unavailableDays: true,
        tripId: true
      }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify participant belongs to this trip
    if (participant.tripId !== id) {
      return NextResponse.json({ error: 'Token does not match trip' }, { status: 403 });
    }

    // Load trip with all participants
    const trip = await prisma.trips.findUnique({
      where: { id },
      include: {
        owner: {
          select: { name: true, email: true }
        },
        participants: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            rsvpStatus: true,
            isOwner: true,
            unavailableDays: true
          },
          orderBy: [{ isOwner: 'desc' }, { firstName: 'asc' }]
        }
      }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    return NextResponse.json({
      trip: {
        id: trip.id,
        name: trip.name,
        destination: trip.destination,
        activity: trip.activity,
        month: trip.month,
        year: trip.year,
        daysTravel: trip.daysTravel,
        startDate: trip.startDate,
        endDate: trip.endDate,
        status: trip.status,
        owner: trip.owner,
        participants: trip.participants
      },
      participant: {
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: participant.email,
        rsvpStatus: participant.rsvpStatus,
        isOwner: participant.isOwner
      }
    });
  } catch (error) {
    console.error('Participant trip GET error:', error);
    return NextResponse.json({ error: 'Failed to load trip' }, { status: 500 });
  }
}
