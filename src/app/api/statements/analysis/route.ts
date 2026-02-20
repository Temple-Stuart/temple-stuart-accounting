import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';

    // SECURITY: Scoped journals to user's COA
    const journalEntries = await prisma.journal_transactions.findMany({
      where: {
        ledger_entries: {
          some: {
            chart_of_accounts: { userId: user.id }
          }
        }
      },
      include: {
        ledger_entries: {
          include: {
            chart_of_accounts: true
          }
        }
      },
      orderBy: { transaction_date: 'desc' }
    });

    // Group by period
    const periodMap = new Map<string, any>();

    journalEntries.forEach(je => {
      const date = new Date(je.transaction_date);
      let periodKey = '';

      if (period === 'monthly') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = `${date.getFullYear()}`;
      }

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          period: periodKey,
          revenue: 0,
          expenses: 0,
          assets: 0,
          liabilities: 0,
          equity: 0
        });
      }

      const periodData = periodMap.get(periodKey);

      je.ledger_entries.forEach(le => {
        if (le.chart_of_accounts.userId !== user.id) return;
        const amount = Number(le.amount) / 100;
        const accountType = le.chart_of_accounts.account_type.toLowerCase();
        const isNormalBalance = le.entry_type === le.chart_of_accounts.balance_type;
        const effectiveAmount = isNormalBalance ? amount : -amount;

        if (accountType === 'revenue') {
          periodData.revenue += effectiveAmount;
        } else if (accountType === 'expense') {
          periodData.expenses += effectiveAmount;
        } else if (accountType === 'asset') {
          periodData.assets += effectiveAmount;
        } else if (accountType === 'liability') {
          periodData.liabilities += effectiveAmount;
        } else if (accountType === 'equity') {
          periodData.equity += effectiveAmount;
        }
      });
    });

    const periods = Array.from(periodMap.values())
      .map(p => ({
        ...p,
        netIncome: p.revenue - p.expenses
      }))
      .sort((a, b) => b.period.localeCompare(a.period));

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}
