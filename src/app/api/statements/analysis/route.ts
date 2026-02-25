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

    const journalEntries = await prisma.journal_entries.findMany({
      where: { userId: user.id, status: 'posted' },
      include: {
        ledger_entries: {
          include: { account: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear + 1, 0, 1);
    const availableYears = new Set<number>();

    const accountData = new Map<string, {
      code: string;
      name: string;
      type: string;
      balanceType: string;
      openingBalance: number;
      periods: Map<string, number>;
    }>();

    const yearPeriodKeys = new Set<string>();

    for (const je of journalEntries) {
      const date = new Date(je.date);
      availableYears.add(date.getFullYear());

      const isBeforeYear = date < yearStart;
      const isWithinYear = date >= yearStart && date < yearEnd;
      if (!isBeforeYear && !isWithinYear) continue;

      for (const le of je.ledger_entries) {
        if (le.account.userId !== user.id) continue;

        const code = le.account.code;
        const acctType = le.account.account_type.toLowerCase();

        if (!accountData.has(le.account_id)) {
          accountData.set(le.account_id, {
            code,
            name: le.account.name,
            type: acctType,
            balanceType: le.account.balance_type,
            openingBalance: 0,
            periods: new Map()
          });
        }

        const account = accountData.get(le.account_id)!;
        const amount = Number(le.amount) / 100;
        const isNormalBalance = le.entry_type === le.account.balance_type;
        const effectiveAmount = isNormalBalance ? amount : -amount;

        if (isBeforeYear) {
          if (BS_TYPES.has(acctType)) {
            account.openingBalance += effectiveAmount;
          }
        } else {
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
      }
    }

    const sortedPeriods = Array.from(yearPeriodKeys).sort();

    const periodMap = new Map<string, {
      period: string; revenue: number; expenses: number;
      assets: number; liabilities: number; equity: number;
    }>();
    for (const pk of sortedPeriods) {
      periodMap.set(pk, { period: pk, revenue: 0, expenses: 0, assets: 0, liabilities: 0, equity: 0 });
    }

    const accounts: Array<{ code: string; name: string; type: string; periods: Record<string, number> }> = [];

    for (const [, acct] of accountData) {
      const isBSAccount = BS_TYPES.has(acct.type);
      const periodsOut: Record<string, number> = {};
      const hasYearActivity = acct.periods.size > 0;
      if (!isBSAccount && !hasYearActivity) continue;
      if (isBSAccount && !hasYearActivity && Math.abs(acct.openingBalance) < 0.005) continue;

      if (isBSAccount) {
        let cumulative = acct.openingBalance;
        for (const pk of sortedPeriods) {
          cumulative += acct.periods.get(pk) || 0;
          periodsOut[pk] = Math.round(cumulative * 100) / 100;
        }
      } else {
        for (const pk of sortedPeriods) {
          periodsOut[pk] = Math.round((acct.periods.get(pk) || 0) * 100) / 100;
        }
      }

      accounts.push({ code: acct.code, name: acct.name, type: acct.type, periods: periodsOut });

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
      .map(p => ({ ...p, netIncome: Math.round((p.revenue - p.expenses) * 100) / 100 }))
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
