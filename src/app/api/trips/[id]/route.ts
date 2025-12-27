import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET single trip with full details
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
      where: { 
        id,
        userId: user.id 
      },
      include: {
        participants: {
          include: {
            expenseSplits: {
              include: {
                expense: true
              }
            },
            paidExpenses: true
          }
        },
        expenses: {
          include: {
            paidBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            splits: {
              include: {
                participant: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: { date: 'asc' }
        },
        itinerary: {
          orderBy: [{ day: 'asc' }, { homeDate: 'asc' }]
        }
      }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Calculate settlement matrix
    const settlementMatrix = calculateSettlementMatrix(trip.participants, trip.expenses);

    return NextResponse.json({ trip, settlementMatrix });
  } catch (error) {
    console.error('Get trip error:', error);
    return NextResponse.json({ error: 'Failed to fetch trip' }, { status: 500 });
  }
}

// PATCH update trip details
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

    const body = await request.json();
    const { name, destination, month, year, daysTravel, daysRiding, rsvpDeadline, status } = body;

    const trip = await prisma.trips.updateMany({
      where: { 
        id,
        userId: user.id 
      },
      data: {
        ...(name && { name }),
        ...(destination !== undefined && { destination }),
        ...(month && { month: parseInt(month) }),
        ...(year && { year: parseInt(year) }),
        ...(daysTravel && { daysTravel: parseInt(daysTravel) }),
        ...(daysRiding && { daysRiding: parseInt(daysRiding) }),
        ...(rsvpDeadline !== undefined && { rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null }),
        ...(status && { status })
      }
    });

    if (trip.count === 0) {
      return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });
    }

    const updatedTrip = await prisma.trips.findUnique({
      where: { id },
      include: { participants: true }
    });

    return NextResponse.json({ trip: updatedTrip });
  } catch (error) {
    console.error('Update trip error:', error);
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 });
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

    const deleted = await prisma.trips.deleteMany({
      where: { 
        id,
        userId: user.id 
      }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trip error:', error);
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 });
  }
}

// Settlement matrix calculation
function calculateSettlementMatrix(participants: any[], expenses: any[]) {
  const matrix: Record<string, Record<string, number>> = {};
  
  // Initialize matrix
  for (const p of participants) {
    matrix[p.id] = {};
    for (const other of participants) {
      if (p.id !== other.id) {
        matrix[p.id][other.id] = 0;
      }
    }
  }

  // Calculate who owes whom based on expense splits
  for (const expense of expenses) {
    if (!expense.splits || expense.splits.length === 0) continue;
    
    const payerId = expense.paidById;
    
    for (const split of expense.splits) {
      if (split.participantId !== payerId && !split.settled) {
        const amount = parseFloat(split.amount.toString());
        // split.participant owes payer
        if (matrix[split.participantId] && matrix[split.participantId][payerId] !== undefined) {
          matrix[split.participantId][payerId] += amount;
        }
      }
    }
  }

  // Net out the matrix (if A owes B $50 and B owes A $30, show A owes B $20)
  const netMatrix: Record<string, Record<string, number>> = {};
  const processed = new Set<string>();

  for (const p of participants) {
    netMatrix[p.id] = {};
    for (const other of participants) {
      if (p.id === other.id) continue;
      
      const pairKey = [p.id, other.id].sort().join('-');
      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      const pOwesOther = matrix[p.id]?.[other.id] || 0;
      const otherOwesP = matrix[other.id]?.[p.id] || 0;
      const net = pOwesOther - otherOwesP;

      if (net > 0) {
        netMatrix[p.id][other.id] = net;
        netMatrix[other.id] = netMatrix[other.id] || {};
        netMatrix[other.id][p.id] = 0;
      } else if (net < 0) {
        netMatrix[other.id] = netMatrix[other.id] || {};
        netMatrix[other.id][p.id] = Math.abs(net);
        netMatrix[p.id][other.id] = 0;
      } else {
        netMatrix[p.id][other.id] = 0;
        netMatrix[other.id] = netMatrix[other.id] || {};
        netMatrix[other.id][p.id] = 0;
      }
    }
  }

  return netMatrix;
}
