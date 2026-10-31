import { NextResponse } from 'next/server';
import { ValidationError } from '@/lib/errors/ValidationError';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { positionTrackerService } from '@/lib/position-tracker-service';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { pairs, strategy, tradeNum, entityId } = await request.json();

    if (!pairs || !Array.isArray(pairs)) {
      return NextResponse.json({ error: 'pairs array required' }, { status: 400 });
    }

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 });
    }

    // Verify entity belongs to user
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id }
    });
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found or not owned by user' }, { status: 404 });
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
        throw new ValidationError(`Transaction not found or not owned: ${transferId} or ${stockId}`, { status: 404 });
      }

      const result = await positionTrackerService.handleAssignmentExercise({
        exerciseTransfer: transferTxn,
        stockTransaction: stockTxn,
        strategy: strategy || 'ITM Spread Expiration',
        tradeNum: tradeNum || 'AUTO',
        userId: user.id,
        entityId,
        createdBy: userEmail,
      });

      results.push(result);
    }

    return NextResponse.json({
      success: true,
      processed: pairs.length,
      results
    });

  } catch (error: any) {
    return failClosedResponse('Assignment/Exercise', 'Failed to process assignment/exercise', error);
  }
}
