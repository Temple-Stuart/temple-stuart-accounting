import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// POST: Fix orphaned transactions that were processed but not marked
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { transactionId, tradeNum, strategy, accountCode } = await request.json();

    if (!transactionId || !tradeNum) {
      return NextResponse.json({ error: 'Required: transactionId, tradeNum' }, { status: 400 });
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
