import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';
import { requireTabAccess } from '@/lib/auth-helpers';
import { exportBlocksOf, statementsOf } from '@/lib/books/statements';
import { readStatements } from '@/lib/books/statementsRead';

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
  totalDebits: number;   // FX-01 (2026-10-30, ruling B): integer cents
  totalCredits: number;  // integer cents
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // TAB-SERVER-GATE: tab:tax entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:tax');
    if (tabGate) return tabGate;

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
      // FX-01 (2026-10-30, ruling B): integer CENTS on the wire — the export writes them through the books'
      // one formatter (src/lib/books/functionalCurrency.ts); nothing is divided into float dollars here.
      totalDebits: Number(r.total_debits),
      totalCredits: Number(r.total_credits),
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
      amount: Number(r.amount),
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

    const tbTotalDebits = wholeCents(
      trialBalanceRows.reduce((s, r) => s + r.debitBalance, 0)
    );
    const tbTotalCredits = wholeCents(
      trialBalanceRows.reduce((s, r) => s + r.creditBalance, 0)
    );
    const tbDifference = wholeCents(tbTotalDebits - tbTotalCredits);

    // ── Income Statement and Balance Sheet ──
    // BOOKS-01 (Alex, 2026-11-11): both come from ONE function (src/lib/books/statements.ts) over ONE read
    // (src/lib/books/statementsRead.ts) — the pair /api/statements calls — so the Export and Financial Statements
    // show the same figures for the same book and year. The income statement is the year's, closing entries left
    // out. The balance sheet runs through Dec 31 of the year with every earlier year in it: until this, both were
    // summed from the year's own aggregate above, so the "balance sheet" was one year's movements, and the equity
    // line added that year's net income alone. `retainedEarnings` carries the earnings no closing entry has moved
    // into equity yet; `totals` are the function's. The trial balance above and the general ledger stay the year's
    // activity, as they were.
    const read = await readStatements(prisma, { userId: user.id, entityId: entityId ? entityId : null, year });
    const statements = statementsOf({ toDate: read.toDate, inPeriod: read.inPeriod });
    const { incomeStatement, balanceSheet } = exportBlocksOf(statements);

    return NextResponse.json({
      period: { year, entityId: entityId || null, through: read.scope.through, entityName: read.scope.entityName },
      trialBalance: {
        rows: trialBalanceRows,
        totals: {
          totalDebits: tbTotalDebits,
          totalCredits: tbTotalCredits,
          difference: tbDifference,
          isBalanced: tbDifference === 0,
        },
      },
      incomeStatement,
      balanceSheet,
      // BOOKS-01: accounts whose type is not one of the five — named, and in no total above.
      unclassified: statements.unclassified,
      generalLedger,
    });
  } catch (error) {
    return failClosedResponse('CPA export API', 'CPA export read failed', error);
  }
}

/** FX-01 (2026-10-30, ruling B): every figure here is integer CENTS summed from bigint text — a non-integer is a fault, refused by name, never rounded. */
function wholeCents(n: number): number {
  if (!Number.isSafeInteger(n)) throw new Error(`CPA export: ${n} is not an integer number of cents`);
  return n;
}
