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

    // Get home expense items
    const expenses = await prisma.$queryRaw`
      SELECT * FROM home_expenses 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    ` as any[];

    // Get historical transactions for home COA codes
    const homeCodes = await prisma.chart_of_accounts.findMany({
      where: { module: 'home' },
      select: { code: true, name: true }
    });

    const codes = homeCodes.map(c => c.code);

    const transactions = await prisma.transactions.findMany({
      where: { accountCode: { in: codes } },
      orderBy: { date: 'desc' }
    });

    // Calculate historical averages
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

    const totalMonthlyHistorical = Object.values(byCode).reduce((sum, c) => sum + c.monthlyAvg, 0);
    const totalMonthlyCommitted = expenses
      .filter(e => e.status === 'committed')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    return NextResponse.json({
      expenses,
      historicalByCode: Object.entries(byCode).map(([code, data]) => ({ code, ...data })),
      summary: {
        totalMonthlyHistorical,
        totalMonthlyCommitted,
        draftCount: expenses.filter(e => e.status === 'draft').length,
        committedCount: expenses.filter(e => e.status === 'committed').length,
      },
      recentTransactions: transactions.slice(0, 15).map(t => ({
        id: t.id, date: t.date, name: t.name, amount: t.amount, accountCode: t.accountCode
      }))
    });
  } catch (error) {
    console.error('Home API error:', error);
    return NextResponse.json({ error: 'Failed to fetch home data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { name, coaCode, amount, cadence, dueDay, startDate, endDate } = body;

    const result = await prisma.$queryRaw`
      INSERT INTO home_expenses (user_id, name, coa_code, amount, cadence, due_day, start_date, end_date, status)
      VALUES (${user.id}, ${name}, ${coaCode}, ${amount}, ${cadence || 'monthly'}, ${dueDay || null}, 
              ${startDate ? new Date(startDate) : null}, ${endDate ? new Date(endDate) : null}, 'draft')
      RETURNING *
    `;

    return NextResponse.json({ expense: (result as any[])[0] });
  } catch (error) {
    console.error('Create home expense error:', error);
    return NextResponse.json({ error: 'Failed to create home expense' }, { status: 500 });
  }
}
