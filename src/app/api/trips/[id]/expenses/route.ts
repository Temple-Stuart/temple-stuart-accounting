import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// GET all expenses for a trip
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify user owns this trip
    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const expenses = await prisma.trip_expenses.findMany({
      where: { tripId: id },
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
      orderBy: [{ day: 'asc' }, { date: 'asc' }]
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST create new expense
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify user owns this trip
    const trip = await prisma.trips.findFirst({
      where: { id, userId: user.id },
      include: { participants: true }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      paidById,
      day,
      category,
      vendor,
      description,
      amount,
      date,
      location,
      splitWith // Array of participant IDs to split with
    } = body;

    // Validate required fields
    if (!paidById || !category || !vendor || !amount || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify paidBy is a participant
    const payer = trip.participants.find(p => p.id === paidById);
    if (!payer) {
      return NextResponse.json({ error: 'Payer not found in trip participants' }, { status: 400 });
    }

    const amountDecimal = new Decimal(amount);
    const isShared = splitWith && Array.isArray(splitWith) && splitWith.length > 0;
    const splitCount = isShared ? splitWith.length : 1;
    const perPerson = isShared ? amountDecimal.div(splitCount) : amountDecimal;

    // Create expense
    const expense = await prisma.trip_expenses.create({
      data: {
        tripId: id,
        paidById,
        day: day ? parseInt(day) : null,
        category,
        vendor,
        description: description || null,
        amount: amountDecimal,
        date: new Date(date),
        isShared,
        splitCount,
        perPerson,
        location: location || null,
        status: 'pending'
      }
    });

    // Create expense splits if shared
    if (isShared && splitWith.length > 0) {
      const splitData = splitWith.map((participantId: string) => ({
        expenseId: expense.id,
        participantId,
        amount: perPerson,
        settled: participantId === paidById // Payer's share is auto-settled
      }));

      await prisma.expense_splits.createMany({
        data: splitData
      });
    }

    // Fetch complete expense with splits
    const completeExpense = await prisma.trip_expenses.findUnique({
      where: { id: expense.id },
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
      }
    });

    return NextResponse.json({ expense: completeExpense }, { status: 201 });
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
