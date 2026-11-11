/**
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — ONE FUNCTION UNDER EVERY STATEMENT.
 *
 * Three screens read the same books and disagreed (BOOKS-00, the same day, read-only): the bar added each account's
 * balance as an absolute value and left net income out; Financial Statements added |debits − credits| per account
 * per MONTH for one year and checked assets against liabilities + equity with no net income; the Export read one
 * book, and one year's movements as a balance sheet. The postings were never the difference — the readers were.
 * These functions are the one arithmetic every statement uses now: the bar (src/lib/books/cockpitSums.ts),
 * /api/statements and /api/cpa-export (both through src/lib/books/statementsRead.ts).
 *
 * WHY IT BALANCES. Every entry's debits equal its credits. So over any set of WHOLE entries
 *     assets − liabilities − equity − (revenue − expenses) = 0.
 * That is why a statement is scoped by the ENTRY's book (journal_entries.entity_id), never by the account's: a set
 * of whole entries balances; a set of lines picked by their account does not. A line of one book's entry on another
 * book's account — a personal account paying a business bill — rides the entry's book.
 *
 * WHAT A CALLER HANDS IN: rows of { code, name, type, debits, credits } in integer cents — an account's summed debits
 * and summed credits over the entries the statement covers. An account may arrive on more than one row (the trial
 * balance answers one row per account per entry-book); rows are summed.
 *     inPeriod — the entries of the period (an income statement); the caller leaves closing entries out.
 *     toDate   — every entry through the statement's last day (a balance sheet); closing entries stay in.
 *
 * PURE: no Prisma, no React, no clock, no formatter. Nothing is defaulted, rounded or skipped — a figure that is
 * not a whole number of cents throws by name.
 */

/** An account's summed debits and credits over the entries a statement covers. */
export interface StatementRow {
  readonly code: string;
  readonly name: string;
  /** chart_of_accounts.account_type, as stored. */
  readonly type: string;
  /** Integer cents. */
  readonly debits: number;
  /** Integer cents. */
  readonly credits: number;
}

/** The five types a statement reads. */
export const STATEMENT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
export type StatementType = (typeof STATEMENT_TYPES)[number];

/** One account on a statement: its balance on its own type's side, SIGNED, in integer cents. */
export interface StatementLine {
  readonly code: string;
  readonly name: string;
  readonly amount: number;
}

/** An account whose type is not one of the five — named, with the type as stored, and in NO total. */
export interface UnclassifiedAccount {
  readonly code: string;
  readonly name: string;
  readonly type: string;
}

export interface IncomeStatement {
  readonly revenue: StatementLine[];
  readonly expenses: StatementLine[];
  readonly totalRevenue: number;
  readonly totalExpenses: number;
  /** totalRevenue − totalExpenses. */
  readonly netIncome: number;
  readonly unclassified: UnclassifiedAccount[];
}

export interface BalanceSheet {
  readonly assets: StatementLine[];
  readonly liabilities: StatementLine[];
  readonly equity: StatementLine[];
  readonly totalAssets: number;
  readonly totalLiabilities: number;
  /** The equity lines' sum. */
  readonly equityAccounts: number;
  /** Revenue − expenses over the SAME rows: what no closing entry has moved into equity yet. */
  readonly earningsNotClosed: number;
  /** equityAccounts + earningsNotClosed. */
  readonly totalEquity: number;
  /** totalAssets − totalLiabilities − totalEquity. */
  readonly difference: number;
  /** The difference is 0. */
  readonly isBalanced: boolean;
  readonly unclassified: UnclassifiedAccount[];
}

export interface Statements {
  readonly incomeStatement: IncomeStatement;
  readonly balanceSheet: BalanceSheet;
  /** Every unclassified account of either statement, each once. */
  readonly unclassified: UnclassifiedAccount[];
}

const isStatementType = (t: string): t is StatementType => (STATEMENT_TYPES as readonly string[]).includes(t);

/** RULE: a figure that is not a safe integer number of cents is a fault — refused by name, never rounded (the Export's own wholeCents is the model). */
function wholeCents(n: unknown, what: string): number {
  if (typeof n !== 'number' || !Number.isSafeInteger(n)) throw new Error(`statements: ${what} ${String(n)} is not an integer number of cents`);
  return n;
}

interface Read {
  readonly lines: Record<StatementType, StatementLine[]>;
  readonly totals: Record<StatementType, number>;
  readonly unclassified: UnclassifiedAccount[];
}

const sameAccount = (a: UnclassifiedAccount, b: UnclassifiedAccount): boolean => a.code === b.code && a.name === b.name && a.type === b.type;

/** By code, then by name — the order every statement lists its accounts in. */
const byCode = (a: StatementLine, b: StatementLine): number =>
  a.code < b.code ? -1 : a.code > b.code ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

/** The one pass every statement is built from: each row read by its type, the rows of one account summed, the five totals. */
function read(rows: readonly StatementRow[]): Read {
  const amounts = new Map<string, { type: StatementType; code: string; name: string; amount: number }>();
  const unclassified: UnclassifiedAccount[] = [];
  for (const row of rows) {
    if (typeof row.type !== 'string') throw new Error(`statements: account ${String(row.code)} carries no type — nothing is assumed for it`);
    const debits = wholeCents(row.debits, `account ${row.code} debits`);
    const credits = wholeCents(row.credits, `account ${row.code} credits`);
    // RULE: a type is read trimmed and lower-cased.
    const type = row.type.trim().toLowerCase();
    if (!isStatementType(type)) {
      // RULE: a type that is not one of the five enters NO total — the account is named, with its type as stored.
      const named: UnclassifiedAccount = { code: row.code, name: row.name, type: row.type };
      if (!unclassified.some((u) => sameAccount(u, named))) unclassified.push(named);
      continue;
    }
    // RULE: asset and expense are debits − credits; liability, equity and revenue are credits − debits.
    // SIGNED: a refund lowers an expense, a credit balance on an asset lowers assets. Nothing is made absolute.
    const amount = type === 'asset' || type === 'expense' ? debits - credits : credits - debits;
    // An account may arrive on more than one row: rows of one type, code and name are one line, summed.
    const key = `${type}\u0000${row.code}\u0000${row.name}`;
    const line = amounts.get(key);
    if (line === undefined) amounts.set(key, { type, code: row.code, name: row.name, amount });
    else line.amount = wholeCents(line.amount + amount, `account ${row.code} balance`);
  }
  const lines: Record<StatementType, StatementLine[]> = { asset: [], liability: [], equity: [], revenue: [], expense: [] };
  for (const line of amounts.values()) lines[line.type].push({ code: line.code, name: line.name, amount: line.amount });
  const totalOf = (type: StatementType): number => wholeCents(lines[type].reduce((sum, line) => sum + line.amount, 0), `total ${type}`);
  for (const type of STATEMENT_TYPES) lines[type].sort(byCode);
  return {
    lines,
    totals: { asset: totalOf('asset'), liability: totalOf('liability'), equity: totalOf('equity'), revenue: totalOf('revenue'), expense: totalOf('expense') },
    unclassified,
  };
}

/** THE INCOME STATEMENT of a period: revenue lines, expense lines, their totals, net income = revenue − expenses. */
export function incomeStatementOf(inPeriod: readonly StatementRow[]): IncomeStatement {
  const r = read(inPeriod);
  return {
    revenue: r.lines.revenue,
    expenses: r.lines.expense,
    totalRevenue: r.totals.revenue,
    totalExpenses: r.totals.expense,
    netIncome: wholeCents(r.totals.revenue - r.totals.expense, 'net income'),
    unclassified: r.unclassified,
  };
}

/**
 * THE BALANCE SHEET through a date: asset, liability and equity lines and their totals — and, in equity, the
 * earnings no closing entry has moved there yet (revenue − expenses over the SAME rows). A closing entry zeroes a
 * year's revenue and expense accounts into an equity account: equityAccounts rises, earningsNotClosed falls by the
 * same figure, and totalEquity does not move. `difference` is 0 over whole entries whose every account is one of the
 * five types; an unclassified account's balance is exactly what it is out by.
 */
export function balanceSheetOf(toDate: readonly StatementRow[]): BalanceSheet {
  const r = read(toDate);
  const earningsNotClosed = wholeCents(r.totals.revenue - r.totals.expense, 'earnings not yet closed');
  const totalEquity = wholeCents(r.totals.equity + earningsNotClosed, 'total equity');
  const difference = wholeCents(r.totals.asset - r.totals.liability - totalEquity, 'the balance sheet difference');
  return {
    assets: r.lines.asset,
    liabilities: r.lines.liability,
    equity: r.lines.equity,
    totalAssets: r.totals.asset,
    totalLiabilities: r.totals.liability,
    equityAccounts: r.totals.equity,
    earningsNotClosed,
    totalEquity,
    difference,
    isBalanced: difference === 0,
    unclassified: r.unclassified,
  };
}

/** BOTH: the income statement of the period and the balance sheet through its last day. */
export function statementsOf(input: { readonly toDate: readonly StatementRow[]; readonly inPeriod: readonly StatementRow[] }): Statements {
  const incomeStatement = incomeStatementOf(input.inPeriod);
  const balanceSheet = balanceSheetOf(input.toDate);
  const unclassified = [...balanceSheet.unclassified];
  for (const u of incomeStatement.unclassified) if (!unclassified.some((seen) => sameAccount(seen, u))) unclassified.push(u);
  return { incomeStatement, balanceSheet, unclassified };
}

/**
 * THE EXPORT'S TWO BLOCKS, in the keys /api/cpa-export has always answered — the same figures under the Export's
 * names, nothing recomputed: `retainedEarnings` carries earningsNotClosed, and `totals` are the function's.
 */
export function exportBlocksOf(statements: Statements) {
  const line = (l: StatementLine) => ({ accountCode: l.code, accountName: l.name, amount: l.amount });
  const { incomeStatement, balanceSheet } = statements;
  return {
    incomeStatement: {
      revenue: incomeStatement.revenue.map(line),
      expenses: incomeStatement.expenses.map(line),
      totals: { totalRevenue: incomeStatement.totalRevenue, totalExpenses: incomeStatement.totalExpenses, netIncome: incomeStatement.netIncome },
    },
    balanceSheet: {
      assets: balanceSheet.assets.map(line),
      liabilities: balanceSheet.liabilities.map(line),
      equity: balanceSheet.equity.map(line),
      retainedEarnings: balanceSheet.earningsNotClosed,
      totals: {
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        totalEquity: balanceSheet.totalEquity,
        difference: balanceSheet.difference,
        isBalanced: balanceSheet.isBalanced,
      },
    },
  };
}
