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

    const body = await request.json();
    const { transactionIds } = body;

    console.log('Investment transaction IDs received:', transactionIds);

    // Verify ownership of all transactions
    const ownedTxns = await prisma.investment_transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } }
    });
    if (ownedTxns.length !== transactionIds.length) {
      return NextResponse.json({ error: 'Forbidden: not all transactions belong to user' }, { status: 403 });
    }

    // Only update fields that were explicitly provided in the request body
    const updateData: Record<string, string | null> = {};
    if ('accountCode' in body) updateData.accountCode = body.accountCode || null;
    if ('subAccount' in body) updateData.subAccount = body.subAccount || null;
    if ('strategy' in body) updateData.strategy = body.strategy || null;
    if ('tradeNum' in body) updateData.tradeNum = body.tradeNum || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await prisma.investment_transactions.updateMany({
      where: {
        id: { in: ownedTxns.map(t => t.id) }
      },
      data: updateData
    });

    console.log('✓ Updated investment_transactions table');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating investment transactions:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
