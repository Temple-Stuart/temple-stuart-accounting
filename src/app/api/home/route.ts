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

    const homeCodes = await prisma.chart_of_accounts.findMany({
      where: { module: 'home' },
      select: { code: true, name: true }
    });

    const codes = homeCodes.map(c => c.code);

    const transactions = await prisma.transactions.findMany({
      where: { accountCode: { in: codes } },
      orderBy: { date: 'desc' }
    });

    const byCode: Record<string, { name: string; total: number; count: number; monthlyAvg: number }> = {};
    homeCodes.forEach(c => {
      byCode[c.code] = { name: c.name, total: 0, count: 0, monthlyAvg: 0 };
    });

    const byMonth: Record<string, Record<string, number>> = {};
    
    transactions.forEach(t => {
      const code = t.accountCode!;
      const amount = Math.abs(t.amount);
      
      if (byCode[code]) {
        byCode[code].total += amount;
        byCode[code].count += 1;
      }

      const monthKey = t.date.toISOString().slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = {};
      byMonth[monthKey][code] = (byMonth[monthKey][code] || 0) + amount;
    });

    const monthCount = Object.keys(byMonth).length || 1;
    Object.keys(byCode).forEach(code => {
      byCode[code].monthlyAvg = byCode[code].total / monthCount;
    });

    const totalMonthly = Object.values(byCode).reduce((sum, c) => sum + c.monthlyAvg, 0);
    const totalAllTime = Object.values(byCode).reduce((sum, c) => sum + c.total, 0);

    return NextResponse.json({
      summary: { totalMonthly, totalAllTime, monthCount, transactionCount: transactions.length },
      byCode: Object.entries(byCode).map(([code, data]) => ({ code, ...data })),
      byMonth: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, codes]) => ({
        month, total: Object.values(codes).reduce((sum, v) => sum + v, 0), breakdown: codes
      })),
      recentTransactions: transactions.slice(0, 15).map(t => ({
        id: t.id, date: t.date, name: t.name, amount: t.amount, accountCode: t.accountCode
      }))
    });
  } catch (error) {
    console.error('Home API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}
