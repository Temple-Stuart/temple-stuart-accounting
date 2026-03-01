import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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

    // ═══════════════════════════════════════════════════════════════════
    // Get Personal COA expense accounts (exclude travel 7xxx codes)
    // ═══════════════════════════════════════════════════════════════════
    const personalEntity = await prisma.entities.findFirst({
      where: { userId: user.id, entity_type: 'personal' }
    });

    const personalAccounts = personalEntity
      ? await prisma.chart_of_accounts.findMany({
          where: {
            userId: user.id,
            entity_id: personalEntity.id,
            account_type: 'expense',
            is_archived: false,
          },
          select: { code: true, name: true }
        })
      : [];

    // Exclude travel codes (7xxx) — handled by nomad-budget API
    const homebaseAccounts = personalAccounts.filter(acc => !acc.code.startsWith('7'));

    // Build COA name mapping dynamically from database
    const COA_NAMES: Record<string, string> = {};
    homebaseAccounts.forEach(acc => {
      COA_NAMES[acc.code] = acc.name;
    });

    // If no homebase accounts exist yet, return empty data
    if (Object.keys(COA_NAMES).length === 0) {
      return NextResponse.json({
        year,
        budgetData: {},
        actualData: {},
        coaNames: {},
        budgetGrandTotal: 0,
        actualGrandTotal: 0
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUDGET DATA - From budget_line_items (homebase source)
    // ═══════════════════════════════════════════════════════════════════
    const items = await prisma.budget_line_items.findMany({
      where: {
        userId: user.id,
        year: year,
        source: 'homebase'
      }
    });

    // Aggregate budget by COA and month
    const budgetData: Record<string, Record<number, number>> = {};
    let budgetGrandTotal = 0;

    for (const item of items) {
      const coa = item.coaCode || 'UNCATEGORIZED';
      const month = item.month - 1; // 0-indexed
      const amount = Number(item.amount || 0);

      if (!budgetData[coa]) {
        budgetData[coa] = {};
      }
      budgetData[coa][month] = (budgetData[coa][month] || 0) + amount;
      budgetGrandTotal += amount;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ACTUALS DATA - From ledger_entries (single source of truth)
    // Matches statements, metrics, and tax engine queries.
    // ═══════════════════════════════════════════════════════════════════
    const homebaseCodes = Object.keys(COA_NAMES);

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
        AND coa.code IN (${Prisma.join(homebaseCodes)})
      GROUP BY coa.code, EXTRACT(MONTH FROM je.date)
    `;

    // Aggregate actuals by COA and month
    const actualData: Record<string, Record<number, number>> = {};
    let actualGrandTotal = 0;

    for (const row of ledgerRows) {
      const coa = row.code;
      const month = Number(row.month) - 1; // EXTRACT(MONTH) is 1-based → 0-based
      const dollars = Math.round(Number(row.debits) / 100 * 100) / 100; // cents → dollars

      if (!actualData[coa]) {
        actualData[coa] = {};
      }
      actualData[coa][month] = (actualData[coa][month] || 0) + dollars;
      actualGrandTotal += dollars;
    }

    actualGrandTotal = Math.round(actualGrandTotal * 100) / 100;

    return NextResponse.json({
      year,
      budgetData,
      actualData,
      coaNames: COA_NAMES,
      budgetGrandTotal,
      actualGrandTotal
    });
  } catch (error) {
    console.error('Year calendar error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
