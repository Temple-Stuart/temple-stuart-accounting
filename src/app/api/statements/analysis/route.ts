import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';

    // Get all journal entries with ledger entries
    const journalEntries = await prisma.journal_transactions.findMany({
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

    // Convert to array and calculate net income
    const periods = Array.from(periodMap.values())
      .map(p => ({
        ...p,
        netIncome: p.revenue - p.expenses
      }))
      .sort((a, b) => b.period.localeCompare(a.period)); // Most recent first

    return NextResponse.json({ periods });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}
