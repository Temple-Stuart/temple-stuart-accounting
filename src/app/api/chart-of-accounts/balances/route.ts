import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.chart_of_accounts.findMany({
      where: { is_archived: false },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({
      accounts: accounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        accountType: acc.account_type,
        balanceType: acc.balance_type,
        settledBalance: acc.settledBalance.toString(),
        entityType: acc.entityType
      }))
    });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
