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

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's accounts
    const userAccounts = await prisma.accounts.findMany({
      where: { userId: user.id },
      select: { id: true }
    });
    const accountIds = userAccounts.map(a => a.id);

    if (accountIds.length === 0) {
      return NextResponse.json({
        assets: [],
        debt: [],
        equity: [],
        summary: { totalAssets: 0, totalDebt: 0, totalEquity: 0, netWorth: 0 }
      });
    }

    const accounts = await prisma.chart_of_accounts.findMany({
      where: { 
        module: { in: ['assets', 'debt', 'equity'] },
        entity_type: 'personal'
      },
      select: { code: true, name: true, module: true, settled_balance: true }
    });

    const codes = accounts.map(a => a.code);
    
    // Filter transactions by user's accounts
    const transactions = await prisma.transactions.findMany({
      where: { 
        accountCode: { in: codes },
        accountId: { in: accountIds }
      }
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
      if (balance === 0) return;
      
      const item = { code: a.code, name: a.name, balance };
      
      if (a.module === 'assets') assets.push(item);
      else if (a.module === 'debt') debt.push(item);
      else if (a.module === 'equity') equity.push(item);
    });

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalDebt = debt.reduce((sum, d) => sum + d.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

    return NextResponse.json({
      assets: assets.sort((a, b) => b.balance - a.balance),
      debt: debt.sort((a, b) => b.balance - a.balance),
      equity: equity.sort((a, b) => b.balance - a.balance),
      summary: {
        totalAssets,
        totalDebt,
        totalEquity,
        netWorth: totalAssets - totalDebt
      }
    });
  } catch (error) {
    console.error('Net Worth API error:', error);
    return NextResponse.json({ error: 'Failed to fetch net worth data' }, { status: 500 });
  }
}
