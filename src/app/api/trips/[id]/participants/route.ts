import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// GET all participants for a trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const participants = await prisma.trip_participants.findMany({
      where: { tripId: id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentMethod: true,
        paymentHandle: true,
        inviteToken: true,
        unavailableDays: true,
        rsvpStatus: true,
        rsvpAt: true,
        isOwner: true
      },
      orderBy: [{ isOwner: 'desc' }, { firstName: 'asc' }]
    });

    // Generate invite URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const participantsWithLinks = participants.map(p => ({
      ...p,
      inviteUrl: `${baseUrl}/trips/rsvp?token=${p.inviteToken}`
    }));

    return NextResponse.json({ participants: participantsWithLinks });
  } catch (error) {
    console.error('Get participants error:', error);
    return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 });
  }
}

// POST add new participant
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const body = await request.json();
    const { firstName, lastName, email, phone } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if participant already exists
    const existing = await prisma.trip_participants.findUnique({
      where: {
        tripId_email: {
          tripId: id,
          email
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Participant already added' }, { status: 409 });
    }

    const inviteToken = randomBytes(32).toString('hex');

    const participant = await prisma.trip_participants.create({
      data: {
        tripId: id,
        firstName,
        lastName,
        email,
        phone: phone || null,
        inviteToken,
        isOwner: false,
        rsvpStatus: 'pending'
      }
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
      participant: {
        ...participant,
        inviteUrl: `${baseUrl}/trips/rsvp?token=${inviteToken}`
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Add participant error:', error);
    return NextResponse.json({ error: 'Failed to add participant' }, { status: 500 });
  }
}

// DELETE remove participant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const body = await request.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json({ error: 'Missing participantId' }, { status: 400 });
    }

    // Don't allow deleting the owner
    const participant = await prisma.trip_participants.findUnique({
      where: { id: participantId }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (participant.isOwner) {
      return NextResponse.json({ error: 'Cannot remove trip owner' }, { status: 400 });
    }

    await prisma.trip_participants.delete({
      where: { id: participantId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete participant error:', error);
    return NextResponse.json({ error: 'Failed to remove participant' }, { status: 500 });
  }
}
