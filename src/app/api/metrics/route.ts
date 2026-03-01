import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = user.id;

    // 1. BALANCE — Sum of all connected account balances (currentBalance is dollars, convert to cents)
    const balanceRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM("currentBalance")::numeric, 0) as total_balance
      FROM accounts
      WHERE "userId" = ${userId}
    `;
    const balance = Math.round(Number(balanceRows[0]?.total_balance ?? 0) * 100);

    // 2. EXP YTD — Total expense debits from ledger this year
    const expRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total_cents
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense'
        AND le.entry_type = 'D'
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const expYtd = Number(expRows[0]?.total_cents ?? 0);

    // 3. REV YTD — Total revenue credits from ledger this year
    const revRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total_cents
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'revenue'
        AND le.entry_type = 'C'
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const revYtd = Number(revRows[0]?.total_cents ?? 0);

    // 4. BIZ EXP — Business entity expenses only
    const bizExpRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as total_cents
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense'
        AND le.entry_type = 'D'
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
        AND coa.entity_id IN (
          SELECT id FROM entities WHERE "userId" = ${userId} AND entity_type = 'business'
        )
    `;
    const bizExpYtd = Number(bizExpRows[0]?.total_cents ?? 0);

    // 5. DONE — Categorization completeness
    const doneRows: any[] = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE t.review_status = 'committed')::bigint as committed,
        COUNT(*)::bigint as total
      FROM transactions t
      JOIN accounts a ON t."accountId" = a.id
      WHERE a."userId" = ${userId}
    `;
    const committed = Number(doneRows[0]?.committed ?? 0);
    const total = Number(doneRows[0]?.total ?? 0);

    // 6. MONTH vs PRIOR MONTH — Current month and prior month expenses
    const currentMonthRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as current_month_cents
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense'
        AND le.entry_type = 'D'
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
        AND EXTRACT(MONTH FROM je.date) = EXTRACT(MONTH FROM NOW())
    `;
    const currentMonth = Number(currentMonthRows[0]?.current_month_cents ?? 0);

    const priorMonthRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as prior_month_cents
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense'
        AND le.entry_type = 'D'
        AND EXTRACT(MONTH FROM je.date) = CASE
          WHEN EXTRACT(MONTH FROM NOW()) = 1 THEN 12
          ELSE EXTRACT(MONTH FROM NOW()) - 1
        END
        AND EXTRACT(YEAR FROM je.date) = CASE
          WHEN EXTRACT(MONTH FROM NOW()) = 1 THEN EXTRACT(YEAR FROM NOW()) - 1
          ELSE EXTRACT(YEAR FROM NOW())
        END
    `;
    const priorMonth = Number(priorMonthRows[0]?.prior_month_cents ?? 0);

    // 7. DEDUCTIBLE — Business expenses mapped to tax form lines
    const deductibleRows: any[] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(le.amount)::bigint, 0) as deductible_cents
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
        AND coa.account_type = 'expense'
        AND le.entry_type = 'D'
        AND coa.tax_form_line IS NOT NULL
        AND EXTRACT(YEAR FROM je.date) = EXTRACT(YEAR FROM NOW())
    `;
    const deductible = Number(deductibleRows[0]?.deductible_cents ?? 0);

    // Derived values
    const net = revYtd - expYtd;
    const persExpYtd = expYtd - bizExpYtd;
    const bizPercent = expYtd > 0 ? Math.round((bizExpYtd / expYtd) * 100) : 0;
    const donePercent = total > 0 ? Math.round((committed / total) * 100) : 0;
    const momChange = priorMonth === 0
      ? 0
      : Math.round(((currentMonth - priorMonth) / priorMonth) * 100);

    return NextResponse.json({
      balance,
      expYtd,
      revYtd,
      net,
      bizExpYtd,
      persExpYtd,
      bizPercent,
      committed,
      total,
      donePercent,
      currentMonth,
      priorMonth,
      momChange,
      deductible,
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
