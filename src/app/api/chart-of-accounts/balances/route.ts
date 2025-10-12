import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { isArchived: false },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({
      accounts: accounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        balanceType: acc.balanceType,
        settledBalance: acc.settledBalance.toString(),
        entityType: acc.entityType
      }))
    });
  } catch (error) {
    console.error('COA fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
