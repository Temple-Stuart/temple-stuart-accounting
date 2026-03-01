import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// COA code → homebase budget category mapping
const CODE_TO_CATEGORY: Record<string, string> = {
  '8100': 'home', '8110': 'home', '8120': 'home', '8200': 'home',
  '8210': 'home', '8220': 'home', '8230': 'home', '8310': 'home',
  '8320': 'home', '8330': 'home',
  '6400': 'auto', '6500': 'auto', '6510': 'auto', '6520': 'auto',
  '6530': 'auto', '6610': 'auto', '6620': 'auto', '6630': 'auto',
  '8160': 'shopping',
  '6100': 'personal', '6110': 'personal', '6120': 'personal', '6150': 'personal',
  '8150': 'personal', '8170': 'personal', '8180': 'personal', '8190': 'personal',
  '8520': 'personal', '8900': 'personal',
  '8130': 'health', '8140': 'health', '8410': 'health', '8420': 'health', '8430': 'health',
  '8510': 'growth', '8530': 'growth',
};

const HOMEBASE_CODES = Object.keys(CODE_TO_CATEGORY);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

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

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    // ═══════════════════════════════════════════════════════════════════
    // BUDGET DATA - From calendar_events
    // ═══════════════════════════════════════════════════════════════════
    const events = await prisma.$queryRaw<Array<{
      source: string;
      start_date: Date;
      budget_amount: number;
    }>>`
      SELECT source, start_date, budget_amount
      FROM calendar_events
      WHERE user_id = ${user.id}
        AND start_date >= ${startOfYear}
        AND start_date <= ${endOfYear}
    `;

    const budgetData: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      budgetData[m] = { home: 0, auto: 0, shopping: 0, personal: 0, health: 0, growth: 0, trip: 0, total: 0 };
    }

    for (const event of events) {
      const month = new Date(event.start_date).getMonth();
      const amount = Number(event.budget_amount || 0);
      const source = event.source || 'personal';

      if (budgetData[month][source] !== undefined) {
        budgetData[month][source] += amount;
      }
      if (source !== 'trip') {
        budgetData[month].total += amount;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTUALS DATA - From ledger_entries (single source of truth)
    // Matches statements, metrics, and tax engine queries.
    // ═══════════════════════════════════════════════════════════════════
    const ledgerRows: Array<{ code: string; month: number; debits: string }> = await prisma.$queryRaw`
      SELECT
        coa.code,
        EXTRACT(MONTH FROM je.date)::int as month,
        SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END)::text as debits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      JOIN entities e ON coa.entity_id = e.id
      WHERE je."userId" = ${user.id}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND EXTRACT(YEAR FROM je.date) = ${year}
        AND e.entity_type = 'personal'
        AND coa.account_type = 'expense'
        AND coa.code IN (${Prisma.join(HOMEBASE_CODES)})
      GROUP BY coa.code, EXTRACT(MONTH FROM je.date)
    `;

    const actualData: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      actualData[m] = { home: 0, auto: 0, shopping: 0, personal: 0, health: 0, growth: 0, trip: 0, total: 0 };
    }

    for (const row of ledgerRows) {
      const category = CODE_TO_CATEGORY[row.code];
      if (!category) continue;
      const month = Number(row.month) - 1; // EXTRACT(MONTH) is 1-based → 0-based
      const dollars = Number(row.debits) / 100; // ledger stores cents
      if (month >= 0 && month < 12) {
        actualData[month][category] += dollars;
        actualData[month].total += dollars;
      }
    }

    // Round to 2 decimal places
    for (let m = 0; m < 12; m++) {
      Object.keys(actualData[m]).forEach(key => {
        actualData[m][key] = Math.round(actualData[m][key] * 100) / 100;
      });
    }

    return NextResponse.json({
      year,
      budgetData,
      actualData,
      monthlyData: budgetData
    });
  } catch (error) {
    console.error('Year calendar error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
