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

    // SECURITY: Scoped to user's COA only
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
      orderBy: { transaction_date: 'asc' }
    });

    // Build per-account activity by period
    // Key: accountCode, Value: { name, type, balanceType, periods: { periodKey: netChange } }
    const accountActivity = new Map<string, {
      name: string;
      type: string;
      balanceType: string;
      periods: Map<string, number>;
    }>();

    // Track all period keys for ordering
    const allPeriodKeys = new Set<string>();

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

      allPeriodKeys.add(periodKey);

      je.ledger_entries.forEach(le => {
        if (le.chart_of_accounts.userId !== user.id) return;

        const code = le.chart_of_accounts.code;
        if (!accountActivity.has(code)) {
          accountActivity.set(code, {
            name: le.chart_of_accounts.name,
            type: le.chart_of_accounts.account_type.toLowerCase(),
            balanceType: le.chart_of_accounts.balance_type,
            periods: new Map()
          });
        }

        const account = accountActivity.get(code)!;
        const amount = Number(le.amount) / 100;
        const isNormalBalance = le.entry_type === le.chart_of_accounts.balance_type;
        const effectiveAmount = isNormalBalance ? amount : -amount;

        const current = account.periods.get(periodKey) || 0;
        account.periods.set(periodKey, current + effectiveAmount);
      });
    });

    // Sort period keys chronologically
    const sortedPeriods = Array.from(allPeriodKeys).sort();

    // Build type-level period summaries (for backwards compat)
    const periodMap = new Map<string, {
      period: string;
      revenue: number;
      expenses: number;
      assets: number;
      liabilities: number;
      equity: number;
    }>();

    for (const pk of sortedPeriods) {
      periodMap.set(pk, {
        period: pk,
        revenue: 0,
        expenses: 0,
        assets: 0,
        liabilities: 0,
        equity: 0
      });
    }

    // Build account-level output with running balances for B/S accounts
    const BS_TYPES = new Set(['asset', 'liability', 'equity']);

    const accounts: Array<{
      code: string;
      name: string;
      type: string;
      periods: Record<string, number>;
    }> = [];

    for (const [code, acct] of accountActivity) {
      const isBSAccount = BS_TYPES.has(acct.type);
      const periodsOut: Record<string, number> = {};

      if (isBSAccount) {
        // Running balance: cumulative sum through each period
        let cumulative = 0;
        for (const pk of sortedPeriods) {
          const activity = acct.periods.get(pk) || 0;
          cumulative += activity;
          periodsOut[pk] = Math.round(cumulative * 100) / 100;
        }
      } else {
        // Income/Expense: activity per period
        for (const pk of sortedPeriods) {
          periodsOut[pk] = Math.round((acct.periods.get(pk) || 0) * 100) / 100;
        }
      }

      accounts.push({
        code,
        name: acct.name,
        type: acct.type,
        periods: periodsOut
      });

      // Also aggregate type-level summaries
      for (const pk of sortedPeriods) {
        const pd = periodMap.get(pk)!;
        const val = periodsOut[pk] || 0;
        if (acct.type === 'revenue') pd.revenue += val;
        else if (acct.type === 'expense') pd.expenses += val;
        else if (acct.type === 'asset') pd.assets += val;
        else if (acct.type === 'liability') pd.liabilities += val;
        else if (acct.type === 'equity') pd.equity += val;
      }
    }

    const periods = Array.from(periodMap.values())
      .map(p => ({
        ...p,
        revenue: Math.round(p.revenue * 100) / 100,
        expenses: Math.round(p.expenses * 100) / 100,
        assets: Math.round(p.assets * 100) / 100,
        liabilities: Math.round(p.liabilities * 100) / 100,
        equity: Math.round(p.equity * 100) / 100,
        netIncome: Math.round((p.revenue - p.expenses) * 100) / 100
      }))
      .sort((a, b) => b.period.localeCompare(a.period));

    return NextResponse.json({
      periods,
      accounts: accounts.sort((a, b) => a.code.localeCompare(b.code)),
      periodKeys: sortedPeriods
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}
