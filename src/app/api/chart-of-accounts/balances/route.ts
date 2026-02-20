import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // SECURITY: Scoped to user's COA only
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { userId: user.id, is_archived: false },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({
      accounts: accounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        balanceType: acc.balance_type,
        settledBalance: acc.settled_balance.toString(),
        entityType: acc.entity_type
      }))
    });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
