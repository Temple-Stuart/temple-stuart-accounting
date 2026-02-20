import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch counts filtered by this user
    const [accountsCount, transactionsCount, coaCount, tripsCount] = await Promise.all([
      prisma.accounts.count({ where: { userId: user.id } }),
      prisma.transactions.count({ 
        where: { accounts: { userId: user.id } } 
      }),
      prisma.chart_of_accounts.count({ where: { userId: user.id } }),
      prisma.trips.count({ where: { userId: user.id } }).catch(() => 0),
    ]);

    return NextResponse.json({
      accounts: accountsCount,
      transactions: transactionsCount,
      chartOfAccounts: coaCount,
      trips: tripsCount,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
