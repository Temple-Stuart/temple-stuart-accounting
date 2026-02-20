import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { transactionIds, accountCode, subAccount, strategy, tradeNum } = await request.json();

    console.log('Investment transaction IDs received:', transactionIds);

    await prisma.investment_transactions.updateMany({
      where: {
        id: { in: transactionIds }
      },
      data: {
        accountCode: accountCode || null,
        subAccount: subAccount || null,
        strategy: strategy || null,
        tradeNum: tradeNum || null
      }
    });

    console.log('✓ Updated investment_transactions table');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating investment transactions:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
