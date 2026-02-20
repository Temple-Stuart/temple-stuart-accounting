import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// POST: Fix orphaned transactions that were processed but not marked
export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { transactionId, tradeNum, strategy, accountCode } = await request.json();

    if (!transactionId || !tradeNum) {
      return NextResponse.json({ error: 'Required: transactionId, tradeNum' }, { status: 400 });
    }

    // Verify ownership of the transaction
    const txn = await prisma.investment_transactions.findFirst({
      where: { id: transactionId, accounts: { userId: user.id } }
    });
    if (!txn) {
      return NextResponse.json({ error: 'Forbidden: transaction not found or does not belong to user' }, { status: 403 });
    }

    const result = await prisma.investment_transactions.update({
      where: { id: transactionId },
      data: {
        tradeNum,
        strategy: strategy || null,
        accountCode: accountCode || null
      }
    });

    return NextResponse.json({
      success: true,
      updated: {
        id: result.id,
        tradeNum: result.tradeNum,
        strategy: result.strategy
      }
    });
  } catch (error) {
    console.error('Fix orphan error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fix transaction' 
    }, { status: 500 });
  }
}
