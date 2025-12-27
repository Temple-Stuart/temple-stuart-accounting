import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

// GET - Load trip info from invite token
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // First try trip-level invite token
    let trip = await prisma.trips.findUnique({
      where: { inviteToken: token },
      include: {
        owner: {
          select: { name: true, email: true }
        }
      }
    });

    if (trip) {
      // Trip-level token - return trip info for new participant
      return NextResponse.json({
        trip: {
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
          activity: trip.activity,
          month: trip.month,
          year: trip.year,
          daysTravel: trip.daysTravel,
          daysRiding: trip.daysRiding,
          rsvpDeadline: trip.rsvpDeadline,
          owner: trip.owner
        },
        isNewParticipant: true
      });
    }

    // Fall back to participant-level token (for existing invites)
    const participant = await prisma.trip_participants.findUnique({
      where: { inviteToken: token },
      include: {
        trip: {
          include: {
            owner: {
              select: { name: true, email: true }
            }
          }
        }
      }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 });
    }

    return NextResponse.json({
      trip: {
        id: participant.trip.id,
        name: participant.trip.name,
        destination: participant.trip.destination,
        activity: participant.trip.activity,
        month: participant.trip.month,
        year: participant.trip.year,
        daysTravel: participant.trip.daysTravel,
        daysRiding: participant.trip.daysRiding,
        rsvpDeadline: participant.trip.rsvpDeadline,
        owner: participant.trip.owner
      },
      participant: {
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: participant.email,
        rsvpStatus: participant.rsvpStatus,
        unavailableDays: participant.unavailableDays,
        paymentMethod: participant.paymentMethod,
        hasPassword: !!participant.passwordHash
      },
      isNewParticipant: false
    });
  } catch (error) {
    console.error('RSVP GET error:', error);
    return NextResponse.json({ error: 'Failed to load invite' }, { status: 500 });
  }
}

// POST - Submit RSVP (create new participant or update existing)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      token, 
      firstName, 
      lastName, 
      email, 
      phone,
      paymentMethod,
      paymentHandle,
      unavailableDays,
      password,
      rsvpStatus 
    } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Check if trip-level token (new participant)
    const trip = await prisma.trips.findUnique({
      where: { inviteToken: token }
    });

    if (trip) {
      // Create new participant
      if (!firstName || !email) {
        return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
      }

      // Check if participant with this email already exists
      const existing = await prisma.trip_participants.findFirst({
        where: { tripId: trip.id, email }
      });

      if (existing) {
        return NextResponse.json({ error: 'You have already joined this trip' }, { status: 400 });
      }

      const passwordHash = password ? await bcrypt.hash(password, 10) : null;

      const participant = await prisma.trip_participants.create({
        data: {
          tripId: trip.id,
          firstName,
          lastName: lastName || '',
          email,
          phone: phone || null,
          paymentMethod: paymentMethod || null,
          paymentHandle: paymentHandle || null,
          unavailableDays: unavailableDays || [],
          inviteToken: randomBytes(32).toString('hex'),
          isOwner: false,
          rsvpStatus: rsvpStatus || 'confirmed',
          rsvpAt: new Date(),
          passwordHash
        }
      });

      return NextResponse.json({ success: true, participant });
    }

    // Existing participant token
    const participant = await prisma.trip_participants.findUnique({
      where: { inviteToken: token }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 404 });
    }

    // Update participant
    const updateData: any = {
      rsvpStatus: rsvpStatus || participant.rsvpStatus,
      rsvpAt: new Date()
    };

    if (firstName) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (paymentHandle) updateData.paymentHandle = paymentHandle;
    if (unavailableDays) updateData.unavailableDays = unavailableDays;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    const updated = await prisma.trip_participants.update({
      where: { id: participant.id },
      data: updateData
    });

    return NextResponse.json({ success: true, participant: updated });
  } catch (error) {
    console.error('RSVP POST error:', error);
    return NextResponse.json({ error: 'Failed to submit RSVP' }, { status: 500 });
  }
}
