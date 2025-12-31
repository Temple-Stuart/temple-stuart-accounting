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

    const incomeCodes = await prisma.chart_of_accounts.findMany({
      where: { module: 'income' },
      select: { code: true, name: true }
    });

    const codes = incomeCodes.map(c => c.code);

    const transactions = await prisma.transactions.findMany({
      where: { accountCode: { in: codes } },
      orderBy: { date: 'desc' }
    });

    const byCode: Record<string, { name: string; total: number; count: number }> = {};
    incomeCodes.forEach(c => {
      byCode[c.code] = { name: c.name, total: 0, count: 0 };
    });

    const byMonth: Record<string, number> = {};
    
    transactions.forEach(t => {
      const code = t.accountCode!;
      const amount = Math.abs(t.amount);
      
      if (byCode[code]) {
        byCode[code].total += amount;
        byCode[code].count += 1;
      }

      const monthKey = t.date.toISOString().slice(0, 7);
      byMonth[monthKey] = (byMonth[monthKey] || 0) + amount;
    });

    const currentYear = new Date().getFullYear();
    const ytdTotal = transactions
      .filter(t => t.date.getFullYear() === currentYear)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const allTimeTotal = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const months = Object.keys(byMonth).length || 1;
    const monthlyAvg = allTimeTotal / months;

    return NextResponse.json({
      summary: { ytdTotal, allTimeTotal, monthlyAvg, transactionCount: transactions.length },
      byCode: Object.entries(byCode).map(([code, data]) => ({ code, ...data })),
      byMonth: Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, total]) => ({ month, total })),
      recentTransactions: transactions.slice(0, 20).map(t => ({
        id: t.id, date: t.date, name: t.name, amount: t.amount, accountCode: t.accountCode
      }))
    });
  } catch (error) {
    console.error('Income API error:', error);
    return NextResponse.json({ error: 'Failed to fetch income data' }, { status: 500 });
  }
}
