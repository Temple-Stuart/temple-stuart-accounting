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
    const yearParam = searchParams.get('year');
    const selectedYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const BS_TYPES = new Set(['asset', 'liability', 'equity']);

    // SECURITY: Scoped to user's COA only — fetch ALL journal entries
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

    // Determine the year boundary
    const yearStart = new Date(selectedYear, 0, 1);  // Jan 1 of selected year
    const yearEnd = new Date(selectedYear + 1, 0, 1); // Jan 1 of next year

    // Track available years for the year selector
    const availableYears = new Set<number>();

    // Per-account data:
    //   openingBalance: sum of all BS entries BEFORE selectedYear
    //   periods: activity within selectedYear grouped by period key
    const accountData = new Map<string, {
      name: string;
      type: string;
      balanceType: string;
      openingBalance: number; // only used for BS accounts
      periods: Map<string, number>;
    }>();

    // Period keys within the selected year
    const yearPeriodKeys = new Set<string>();

    journalEntries.forEach(je => {
      const date = new Date(je.transaction_date);
      availableYears.add(date.getFullYear());

      const isBeforeYear = date < yearStart;
      const isWithinYear = date >= yearStart && date < yearEnd;

      // Skip entries after selected year entirely
      if (!isBeforeYear && !isWithinYear) return;

      je.ledger_entries.forEach(le => {
        if (le.chart_of_accounts.userId !== user.id) return;

        const code = le.chart_of_accounts.code;
        const acctType = le.chart_of_accounts.account_type.toLowerCase();

        if (!accountData.has(code)) {
          accountData.set(code, {
            name: le.chart_of_accounts.name,
            type: acctType,
            balanceType: le.chart_of_accounts.balance_type,
            openingBalance: 0,
            periods: new Map()
          });
        }

        const account = accountData.get(code)!;
        const amount = Number(le.amount) / 100;
        const isNormalBalance = le.entry_type === le.chart_of_accounts.balance_type;
        const effectiveAmount = isNormalBalance ? amount : -amount;

        if (isBeforeYear) {
          // Prior-year entry: only accumulate for BS accounts
          if (BS_TYPES.has(acctType)) {
            account.openingBalance += effectiveAmount;
          }
          // I/S accounts: skip prior-year entries (periodic, resets each year)
        } else {
          // Within selected year: compute period key and accumulate
          let periodKey = '';
          if (period === 'monthly') {
            periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          } else if (period === 'quarterly') {
            const quarter = Math.floor(date.getMonth() / 3) + 1;
            periodKey = `${date.getFullYear()}-Q${quarter}`;
          } else {
            periodKey = `${date.getFullYear()}`;
          }

          yearPeriodKeys.add(periodKey);
          const current = account.periods.get(periodKey) || 0;
          account.periods.set(periodKey, current + effectiveAmount);
        }
      });
    });

    // Sort period keys chronologically
    const sortedPeriods = Array.from(yearPeriodKeys).sort();

    // Build type-level period summaries
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

    // Build account-level output
    const accounts: Array<{
      code: string;
      name: string;
      type: string;
      periods: Record<string, number>;
    }> = [];

    for (const [code, acct] of accountData) {
      const isBSAccount = BS_TYPES.has(acct.type);
      const periodsOut: Record<string, number> = {};

      // Skip accounts with no activity in the year AND no opening balance
      const hasYearActivity = acct.periods.size > 0;
      if (!isBSAccount && !hasYearActivity) continue;
      if (isBSAccount && !hasYearActivity && Math.abs(acct.openingBalance) < 0.005) continue;

      if (isBSAccount) {
        // Cumulative running balance: opening + activity through each period
        let cumulative = acct.openingBalance;
        for (const pk of sortedPeriods) {
          const activity = acct.periods.get(pk) || 0;
          cumulative += activity;
          periodsOut[pk] = Math.round(cumulative * 100) / 100;
        }
        // If no periods exist but account has an opening balance,
        // we still need it to show — handled by the filter above
      } else {
        // Income/Expense: activity per period within selected year only
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

      // Aggregate type-level summaries
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

    // Handle BS accounts that have opening balances but NO activity in selected year.
    // They need to appear with their opening balance carried forward into every period.
    for (const [code, acct] of accountData) {
      if (!BS_TYPES.has(acct.type)) continue;
      if (acct.periods.size > 0) continue; // already handled above
      if (Math.abs(acct.openingBalance) < 0.005) continue; // no meaningful balance

      const periodsOut: Record<string, number> = {};
      const balance = Math.round(acct.openingBalance * 100) / 100;
      for (const pk of sortedPeriods) {
        periodsOut[pk] = balance;
      }

      accounts.push({
        code,
        name: acct.name,
        type: acct.type,
        periods: periodsOut
      });

      // Add to type-level summaries
      for (const pk of sortedPeriods) {
        const pd = periodMap.get(pk)!;
        if (acct.type === 'asset') pd.assets += balance;
        else if (acct.type === 'liability') pd.liabilities += balance;
        else if (acct.type === 'equity') pd.equity += balance;
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
      periodKeys: sortedPeriods,
      availableYears: Array.from(availableYears).sort((a, b) => b - a),
      selectedYear
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
  }
}
