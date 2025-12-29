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

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch counts filtered by this user
    const [accountsCount, transactionsCount, coaCount, destinationsCount] = await Promise.all([
      prisma.accounts.count({ where: { userId: user.id } }),
      prisma.transactions.count({ 
        where: { accounts: { userId: user.id } } 
      }),
      prisma.chart_of_accounts.count({ where: { userId: user.id } }),
      prisma.destinations.count().catch(() => 0), // Global table, or 0 if doesn't exist
    ]);

    return NextResponse.json({
      accounts: accountsCount,
      transactions: transactionsCount,
      chartOfAccounts: coaCount,
      destinations: destinationsCount,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
