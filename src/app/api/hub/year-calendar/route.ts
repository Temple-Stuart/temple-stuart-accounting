import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { routinesMonthlyByCoa } from '@/lib/operations/routineBudget';

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
    // BUDGET DATA — Personal planned. SINGLE source: BUDGETED ROUTINES.
    // Planned comes ONLY from operations_routines (the canonical bridge). A (coa, month)
    // with no matching budgeted routine contributes NOTHING (empty / $0) — it is NOT
    // backfilled from any other table. The legacy flat `budgets` table is no longer read
    // here (it produced ghost rows the user never set as routines); the path to surface a
    // figure is to create a budgeted routine, not to fall back to the legacy table.
    // ═══════════════════════════════════════════════════════════════════
    const homebaseCodes = Object.keys(COA_NAMES);
    const budgetData: Record<string, Record<number, number>> = {};
    let budgetGrandTotal = 0;

    // ── BUDGETED ROUTINES (HB-4d) — the ONLY planned source ──────────────
    // A Personal-entity routine with a per-occurrence budget + COA contributes
    // (occurrences-in-month × budget_amount) to its COA's monthly figure, computed via
    // routinesMonthlyByCoa (HB-4c → expandBetween, the same recurrence helper the calendar uses).
    // Gated on COA_NAMES so the contribution renders as a row (a routine on an excluded/travel COA
    // belongs to nomad-budget). Only is_active + fully-budgeted routines count (the helper returns
    // null otherwise — no guessed amounts). A COA with no budgeted routine simply has no planned
    // figure — nothing fills it.
    if (personalEntity) {
      const budgetedRoutines = await prisma.operations_routines.findMany({
        where: {
          user_id: user.id,
          entity_id: personalEntity.id,
          is_active: true,
          budget_amount: { not: null },
          coa_code: { not: null },
        },
        select: { budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true },
      });
      if (budgetedRoutines.length > 0) {
        const routineInputs = budgetedRoutines.map(r => ({
          budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null,
          coa_code: r.coa_code,
          schedule_rrule: r.schedule_rrule,
          timezone: r.timezone,
        }));
        for (let m = 0; m < 12; m++) {
          const byCoa = routinesMonthlyByCoa(routineInputs, year, m);
          for (const [rawCoa, amount] of Object.entries(byCoa)) {
            const coa = rawCoa.replace(/^[PB]-/, ''); // bare code, mirroring the budgets read
            if (!COA_NAMES[coa]) continue; // not a homebase account → not this table's row
            if (!budgetData[coa]) budgetData[coa] = {};
            budgetData[coa][m] = (budgetData[coa][m] || 0) + amount;
            budgetGrandTotal += amount;
          }
        }
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
