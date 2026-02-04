import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { positionTrackerService } from '@/lib/position-tracker-service';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { pairs, strategy, tradeNum } = await request.json();

    if (!pairs || !Array.isArray(pairs)) {
      return NextResponse.json({ error: 'pairs array required' }, { status: 400 });
    }

    const results = [];

    for (const pair of pairs) {
      const { transferId, stockId } = pair;

      const [transferTxn, stockTxn] = await Promise.all([
        prisma.investment_transactions.findFirst({
          where: { id: transferId, accounts: { userId: user.id } },
          include: { security: true }
        }),
        prisma.investment_transactions.findFirst({
          where: { id: stockId, accounts: { userId: user.id } },
          include: { security: true }
        })
      ]);

      if (!transferTxn || !stockTxn) {
        throw new Error(`Transaction not found or not owned: ${transferId} or ${stockId}`);
      }

      const result = await positionTrackerService.handleAssignmentExercise({
        exerciseTransfer: transferTxn,
        stockTransaction: stockTxn,
        strategy: strategy || 'ITM Spread Expiration',
        tradeNum: tradeNum || 'AUTO'
      });

      results.push(result);
    }

    return NextResponse.json({
      success: true,
      processed: pairs.length,
      results
    });

  } catch (error: any) {
    console.error('Assignment/Exercise error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process assignment/exercise' },
      { status: 500 }
    );
  }
}
