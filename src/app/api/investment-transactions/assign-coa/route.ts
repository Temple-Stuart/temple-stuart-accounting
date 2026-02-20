import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { transactionIds, accountCode, subAccount, strategy, tradeNum } = await request.json();

    console.log('Investment transaction IDs received:', transactionIds);

    // Verify ownership of all transactions
    const ownedTxns = await prisma.investment_transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } }
    });
    if (ownedTxns.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Forbidden: not all transactions belong to user' }, { status: 403 });
    }

    await prisma.investment_transactions.updateMany({
      where: {
        id: { in: ownedTxns.map(t => t.id) }
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
