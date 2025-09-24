import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all transactions for the user
    const accounts = await prisma.accounts.findMany({
      where: { userId: user.id },
      include: { transactions: true }
    });

    // Flatten all transactions
    const allTransactions = accounts.flatMap(account => 
      account.transactions.map(txn => ({
        id: txn.id,
        date: txn.date,
        description: txn.name,
        amount: txn.amount,
        category: txn.category || 'Uncategorized',
        accountId: txn.accountId,
        accountName: account.name,
        transactionId: txn.transactionId,
        merchantName: txn.merchantName,
        pending: txn.pending
      }))
    );

    // Sort by date (newest first)
    allTransactions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return NextResponse.json(allTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
