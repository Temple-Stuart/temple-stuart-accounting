import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
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
        byCode: [],
        byMonth: [],
        summary: { ytdTotal: 0, allTimeTotal: 0, monthlyAvg: 0, transactionCount: 0 },
        recentTransactions: []
      });
    }

    const incomeCodes = await prisma.chart_of_accounts.findMany({
      where: { module: 'income' },
      select: { code: true, name: true }
    });

    const codes = incomeCodes.map(c => c.code);

    // Filter by user's accounts AND income codes
    const transactions = await prisma.transactions.findMany({
      where: { 
        accountCode: { in: codes },
        accountId: { in: accountIds }
      },
      orderBy: { date: 'desc' }
    });

    const byCode: Record<string, { name: string; total: number; count: number }> = {};
    incomeCodes.forEach(c => {
      byCode[c.code] = { name: c.name, total: 0, count: 0 };
    });

    const byMonth: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    let ytdTotal = 0;
    
    transactions.forEach(t => {
      const code = t.accountCode!;
      const amount = Math.abs(t.amount);
      
      if (byCode[code]) {
        byCode[code].total += amount;
        byCode[code].count += 1;
      }

      const monthKey = t.date.toISOString().slice(0, 7);
      byMonth[monthKey] = (byMonth[monthKey] || 0) + amount;

      if (t.date.getFullYear() === currentYear) {
        ytdTotal += amount;
      }
    });

    const allTimeTotal = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const monthCount = Object.keys(byMonth).length || 1;

    return NextResponse.json({
      byCode: Object.entries(byCode)
        .filter(([_, data]) => data.total > 0)
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => b.total - a.total),
      byMonth: Object.entries(byMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
        .map(([month, total]) => ({ month, total })),
      summary: {
        ytdTotal,
        allTimeTotal,
        monthlyAvg: allTimeTotal / monthCount,
        transactionCount: transactions.length
      },
      recentTransactions: transactions.slice(0, 20).map(t => ({
        id: t.id,
        date: t.date,
        name: t.name,
        amount: t.amount,
        accountCode: t.accountCode
      }))
    });
  } catch (error) {
    console.error('Income API error:', error);
    return NextResponse.json({ error: 'Failed to fetch income data' }, { status: 500 });
  }
}
