import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
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
