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

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { 
        module: { in: ['assets', 'debt', 'equity'] },
        entity_type: 'personal'
      },
      select: { code: true, name: true, module: true, settled_balance: true }
    });

    const codes = accounts.map(a => a.code);
    const transactions = await prisma.transactions.findMany({
      where: { accountCode: { in: codes } }
    });

    const balanceByCode: Record<string, number> = {};
    transactions.forEach(t => {
      const code = t.accountCode!;
      balanceByCode[code] = (balanceByCode[code] || 0) + t.amount;
    });

    const assets: Array<{ code: string; name: string; balance: number }> = [];
    const debt: Array<{ code: string; name: string; balance: number }> = [];
    const equity: Array<{ code: string; name: string; balance: number }> = [];

    accounts.forEach(a => {
      const balance = Math.abs(balanceByCode[a.code] || 0);
      const item = { code: a.code, name: a.name, balance };
      
      if (a.module === 'assets') assets.push(item);
      else if (a.module === 'debt') debt.push(item);
      else if (a.module === 'equity') equity.push(item);
    });

    assets.sort((a, b) => b.balance - a.balance);
    debt.sort((a, b) => b.balance - a.balance);
    equity.sort((a, b) => b.balance - a.balance);

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalDebt = debt.reduce((sum, d) => sum + d.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);
    const netWorth = totalAssets - totalDebt;

    return NextResponse.json({
      summary: { totalAssets, totalDebt, totalEquity, netWorth },
      assets, debt, equity
    });
  } catch (error) {
    console.error('Net Worth API error:', error);
    return NextResponse.json({ error: 'Failed to fetch net worth data' }, { status: 500 });
  }
}
