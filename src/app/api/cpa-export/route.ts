import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

// ═══════════════════════════════════════════════════════════════════
// CPA Export API — Single source of truth for the 4 accountant reports.
// All amounts are derived from the GENERAL LEDGER (journal_entries +
// ledger_entries), NOT from raw Plaid transactions. Debit/credit is
// taken from ledger_entries.entry_type ('D' or 'C'), NOT from amount sign.
// ═══════════════════════════════════════════════════════════════════

interface AccountAggregate {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  balanceType: 'D' | 'C';
  totalDebits: number;   // dollars
  totalCredits: number;  // dollars
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const entityId = searchParams.get('entityId');

    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    // Verify entity belongs to user (defense-in-depth; raw SQL filter is also applied)
    if (entityId) {
      const entity = await prisma.entities.findFirst({
        where: { id: entityId, userId: user.id },
      });
      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }
    }

    // Shared WHERE clause — user-scoped, reversals excluded (ASC 250), year-filtered,
    // optionally entity-filtered. Same pattern as /api/trial-balance.
    const conditions: Prisma.Sql[] = [
      Prisma.sql`je."userId" = ${user.id}`,
      Prisma.sql`je.is_reversal = false`,
      Prisma.sql`je.reversed_by_entry_id IS NULL`,
      Prisma.sql`EXTRACT(YEAR FROM je.date) = ${year}`,
    ];
    if (entityId) {
      conditions.push(Prisma.sql`je.entity_id = ${entityId}`);
    }
    const whereClause = Prisma.join(conditions, ' AND ');

    // ── Aggregate per-account debits/credits (cents) ──
    const aggregateRows: Array<{
      account_id: string;
      code: string;
      name: string;
      account_type: string;
      balance_type: string;
      total_debits: string;
      total_credits: string;
    }> = await prisma.$queryRaw`
      SELECT
        coa.id as account_id,
        coa.code,
        coa.name,
        coa.account_type,
        coa.balance_type,
        COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text as total_debits,
        COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text as total_credits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE ${whereClause}
      GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.balance_type
      ORDER BY coa.code
    `;

    const accounts: AccountAggregate[] = aggregateRows.map((r) => ({
      accountId: r.account_id,
      code: r.code,
      name: r.name,
      accountType: r.account_type,
      balanceType: r.balance_type as 'D' | 'C',
      totalDebits: Number(r.total_debits) / 100,
      totalCredits: Number(r.total_credits) / 100,
    }));

    // ── General Ledger detail rows (chronological) ──
    const detailRows: Array<{
      date: Date;
      journal_entry_id: string;
      description: string;
      code: string;
      name: string;
      account_type: string;
      entry_type: string;
      amount: string;
      source_type: string;
      source_id: string | null;
    }> = await prisma.$queryRaw`
      SELECT
        je.date,
        je.id AS journal_entry_id,
        je.description,
        je.source_type,
        je.source_id,
        coa.code,
        coa.name,
        coa.account_type,
        le.entry_type,
        le.amount::text as amount
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      WHERE ${whereClause}
      ORDER BY je.date ASC, je.id ASC, le.entry_type DESC
    `;

    const generalLedger = detailRows.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      journalEntryId: r.journal_entry_id,
      description: r.description,
      accountCode: r.code,
      accountName: r.name,
      accountType: r.account_type,
      entryType: r.entry_type as 'D' | 'C',
      amount: Number(r.amount) / 100,
      sourceType: r.source_type,
      sourceId: r.source_id,
    }));

    // ── Trial Balance ──
    // For each account, place its absolute balance on its natural (normal) side.
    // Negative normal balance → contra, swap to the opposite side.
    const trialBalanceRows = accounts.map((a) => {
      const normalBalance =
        a.balanceType === 'D'
          ? a.totalDebits - a.totalCredits
          : a.totalCredits - a.totalDebits;
      const abs = Math.abs(normalBalance);
      const displaySide: 'debit' | 'credit' =
        a.balanceType === 'D'
          ? normalBalance >= 0
            ? 'debit'
            : 'credit'
          : normalBalance >= 0
            ? 'credit'
            : 'debit';
      return {
        accountCode: a.code,
        accountName: a.name,
        accountType: a.accountType,
        balanceType: a.balanceType,
        totalDebits: a.totalDebits,
        totalCredits: a.totalCredits,
        debitBalance: displaySide === 'debit' ? abs : 0,
        creditBalance: displaySide === 'credit' ? abs : 0,
      };
    });

    const tbTotalDebits = round2(
      trialBalanceRows.reduce((s, r) => s + r.debitBalance, 0)
    );
    const tbTotalCredits = round2(
      trialBalanceRows.reduce((s, r) => s + r.creditBalance, 0)
    );
    const tbDifference = round2(tbTotalDebits - tbTotalCredits);

    // ── Income Statement ──
    const revenueAccounts = accounts.filter((a) => a.accountType === 'revenue');
    const expenseAccounts = accounts.filter((a) => a.accountType === 'expense');

    const revenueLines = revenueAccounts.map((a) => ({
      accountCode: a.code,
      accountName: a.name,
      amount: round2(a.totalCredits - a.totalDebits), // revenue is credit-normal
    }));
    const expenseLines = expenseAccounts.map((a) => ({
      accountCode: a.code,
      accountName: a.name,
      amount: round2(a.totalDebits - a.totalCredits), // expense is debit-normal
    }));
    const totalRevenue = round2(revenueLines.reduce((s, l) => s + l.amount, 0));
    const totalExpenses = round2(expenseLines.reduce((s, l) => s + l.amount, 0));
    const netIncome = round2(totalRevenue - totalExpenses);

    // ── Balance Sheet ──
    const assetAccounts = accounts.filter((a) => a.accountType === 'asset');
    const liabilityAccounts = accounts.filter((a) => a.accountType === 'liability');
    const equityAccounts = accounts.filter((a) => a.accountType === 'equity');

    const assetLines = assetAccounts.map((a) => ({
      accountCode: a.code,
      accountName: a.name,
      amount: round2(a.totalDebits - a.totalCredits), // asset is debit-normal
    }));
    const liabilityLines = liabilityAccounts.map((a) => ({
      accountCode: a.code,
      accountName: a.name,
      amount: round2(a.totalCredits - a.totalDebits), // liability is credit-normal
    }));
    const equityLines = equityAccounts.map((a) => ({
      accountCode: a.code,
      accountName: a.name,
      amount: round2(a.totalCredits - a.totalDebits), // equity is credit-normal
    }));

    const totalAssets = round2(assetLines.reduce((s, l) => s + l.amount, 0));
    const totalLiabilities = round2(
      liabilityLines.reduce((s, l) => s + l.amount, 0)
    );
    // Retained earnings for the period = net income (rolled into equity for the
    // balance-sheet equation). This matches the traditional close-the-books flow.
    const totalEquityExcludingRetained = round2(
      equityLines.reduce((s, l) => s + l.amount, 0)
    );
    const totalEquity = round2(totalEquityExcludingRetained + netIncome);
    const balanceSheetDifference = round2(
      totalAssets - (totalLiabilities + totalEquity)
    );

    return NextResponse.json({
      period: { year, entityId: entityId || null },
      trialBalance: {
        rows: trialBalanceRows,
        totals: {
          totalDebits: tbTotalDebits,
          totalCredits: tbTotalCredits,
          difference: tbDifference,
          isBalanced: Math.abs(tbDifference) < 0.01,
        },
      },
      incomeStatement: {
        revenue: revenueLines,
        expenses: expenseLines,
        totals: { totalRevenue, totalExpenses, netIncome },
      },
      balanceSheet: {
        assets: assetLines,
        liabilities: liabilityLines,
        equity: equityLines,
        retainedEarnings: netIncome,
        totals: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          difference: balanceSheetDifference,
          isBalanced: Math.abs(balanceSheetDifference) < 0.01,
        },
      },
      generalLedger,
    });
  } catch (error) {
    console.error('CPA export API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
