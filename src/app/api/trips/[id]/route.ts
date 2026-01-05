import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET single trip
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
      where: { id, userId: user.id },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' }
        },
        expenses: {
          include: {
            paidBy: {
              select: { id: true, firstName: true, lastName: true }
            },
            splits: {
              include: {
                participant: {
                  select: { id: true, firstName: true, lastName: true }
                }
              }
            }
          },
          orderBy: { day: 'asc' }
        },
        itinerary: {
          orderBy: { day: 'asc' }
        }
      }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Calculate settlement matrix
    const confirmedParticipants = trip.participants.filter(p => p.rsvpStatus === 'confirmed');
    const settlementMatrix: Record<string, Record<string, number>> = {};

    confirmedParticipants.forEach(p => {
      settlementMatrix[p.id] = {};
      confirmedParticipants.forEach(other => {
        settlementMatrix[p.id][other.id] = 0;
      });
    });

    trip.expenses.forEach(expense => {
      if (expense.isShared && expense.splits.length > 0) {
        const paidById = expense.paidById;
        expense.splits.forEach(split => {
          if (split.participantId !== paidById && !split.settled) {
            const amount = parseFloat(split.amount.toString());
            if (settlementMatrix[split.participantId] && settlementMatrix[split.participantId][paidById] !== undefined) {
              settlementMatrix[split.participantId][paidById] += amount;
            }
          }
        });
      }
    });

    return NextResponse.json({ trip, settlementMatrix });
  } catch (error) {
    console.error('Get trip error:', error);
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
  }
}

// DELETE trip
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
      return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });
    }

    // Delete related records first (correct model names)
    await prisma.expense_splits.deleteMany({
      where: { expense: { tripId: id } }
    });
    await prisma.trip_expenses.deleteMany({
      where: { tripId: id }
    });
    await prisma.trip_itinerary.deleteMany({
      where: { tripId: id }
    });
    await prisma.trip_destinations.deleteMany({
      where: { tripId: id }
    });
    // Clean up budget and calendar
    await prisma.budget_line_items.deleteMany({
      where: { tripId: id }
    });
    await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'trip' AND source_id::text = ${id}`;
    await prisma.trip_participants.deleteMany({
      where: { tripId: id }
    });
    await prisma.trips.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trip error:', error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}

// PATCH - Update trip (e.g., destination)
export async function PATCH(
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
      return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });
    }

    const body = await request.json();
    const { destination } = body;

    const updatedTrip = await prisma.trips.update({
      where: { id },
      data: { destination }
    });

    return NextResponse.json({ trip: updatedTrip });
  } catch (error) {
    console.error('Update trip error:', error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
  }
}
