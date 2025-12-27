import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// GET trip info by invite token (public - no auth)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing invite token' }, { status: 400 });
    }

    const participant = await prisma.trip_participants.findUnique({
      where: { inviteToken: token },
      include: {
        trip: {
          select: {
            id: true,
            name: true,
            destination: true,
            month: true,
            year: true,
            daysTravel: true,
            daysRiding: true,
            rsvpDeadline: true,
            status: true,
            owner: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 });
    }

    // Return trip info and participant's current RSVP status
    return NextResponse.json({
      trip: participant.trip,
      participant: {
        id: participant.id,
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: participant.email,
        rsvpStatus: participant.rsvpStatus,
        unavailableDays: participant.unavailableDays,
        paymentMethod: participant.paymentMethod,
        hasPassword: !!participant.passwordHash
      }
    });
  } catch (error) {
    console.error('RSVP GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invite' }, { status: 500 });
  }
}

// POST submit RSVP response (public - no auth)
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
      return NextResponse.json({ error: 'Missing invite token' }, { status: 400 });
    }

    const participant = await prisma.trip_participants.findUnique({
      where: { inviteToken: token }
    });

    if (!participant) {
      return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 });
    }

    // Hash password if provided
    let passwordHash = participant.passwordHash;
    if (password && password.length >= 6) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Update participant with RSVP data
    const updated = await prisma.trip_participants.update({
      where: { inviteToken: token },
      data: {
        firstName: firstName || participant.firstName,
        lastName: lastName || participant.lastName,
        email: email || participant.email,
        phone: phone || participant.phone,
        paymentMethod: paymentMethod || participant.paymentMethod,
        paymentHandle: paymentHandle || participant.paymentHandle,
        unavailableDays: unavailableDays || participant.unavailableDays,
        passwordHash,
        rsvpStatus: rsvpStatus || 'confirmed',
        rsvpAt: new Date()
      },
      include: {
        trip: {
          select: {
            id: true,
            name: true,
            destination: true,
            month: true,
            year: true
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      participant: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        rsvpStatus: updated.rsvpStatus,
        trip: updated.trip
      }
    });
  } catch (error) {
    console.error('RSVP POST error:', error);
    return NextResponse.json({ error: 'Failed to submit RSVP' }, { status: 500 });
  }
}
