/**
 * BOOKS-01 — A MADE-UP LEDGER THAT BALANCES, 2024–2026. A test helper (not a test): the statements' tests
 * (books01.test.ts), the bar's (booksGate01.test.ts) and the panels' read it. Every amount is integer cents, and
 * every entry's debits equal its credits. It holds, on purpose:
 *   · two books — Personal (the default) and Business;
 *   · a month where a refund outweighs an expense (February 2026, Travel);
 *   · an asset account with a credit balance (Venmo) and a liability with a debit balance (the card, overpaid);
 *   · a 2024 year-end closing entry (source_type 'year_end_close', dated Dec 31, 2024);
 *   · a line of one book's entry on the other book's account (Business pays Software from Personal's Checking);
 *   · two accounts that share a code across the books (1000), and a type stored with a capital ('Revenue');
 *   · one account of an unknown type ('suspense');
 *   · a reversed entry and its reversal — the read leaves both out.
 *
 * rowsOf() is the read's rule written in TypeScript — src/lib/books/statementsRead.ts says the same in SQL: live
 * entries only, the ENTRY's book when one is asked for, grouped by ACCOUNT, a closing entry out of a period and in
 * to-date. trialBalanceRowsOf() is the shape /api/trial-balance answers: one row per account per entry-book.
 */
import type { StatementRow } from '../books/statements';

export type BookId = 'P' | 'B';

export const BOOKS: ReadonlyArray<{ id: BookId; name: string; entity_type: string; is_default: boolean }> = [
  { id: 'P', name: 'Personal', entity_type: 'personal', is_default: true },
  { id: 'B', name: 'Business', entity_type: 'sole_prop', is_default: false },
];

export interface LedgerAccount {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** As stored. */
  readonly type: string;
  readonly balanceType: 'D' | 'C';
  readonly book: BookId;
}

export const ACCOUNTS: readonly LedgerAccount[] = [
  { id: 'p1000', code: '1000', name: 'Checking', type: 'asset', balanceType: 'D', book: 'P' },
  { id: 'p1050', code: '1050', name: 'Venmo', type: 'asset', balanceType: 'D', book: 'P' },
  { id: 'p2000', code: '2000', name: 'Credit card', type: 'liability', balanceType: 'C', book: 'P' },
  { id: 'p3000', code: '3000', name: 'Owner equity', type: 'equity', balanceType: 'C', book: 'P' },
  { id: 'p3900', code: '3900', name: 'Retained Earnings', type: 'equity', balanceType: 'C', book: 'P' },
  { id: 'p4000', code: '4000', name: 'Salary', type: 'revenue', balanceType: 'C', book: 'P' },
  { id: 'p6000', code: '6000', name: 'Dining', type: 'expense', balanceType: 'D', book: 'P' },
  { id: 'p6100', code: '6100', name: 'Travel', type: 'expense', balanceType: 'D', book: 'P' },
  { id: 'p9000', code: '9000', name: 'Suspense', type: 'suspense', balanceType: 'D', book: 'P' },
  { id: 'b1000', code: '1000', name: 'Business checking', type: 'asset', balanceType: 'D', book: 'B' },
  { id: 'b4100', code: '4100', name: 'Sales', type: 'Revenue', balanceType: 'C', book: 'B' },
  { id: 'b6200', code: '6200', name: 'Software', type: 'expense', balanceType: 'D', book: 'B' },
];

export interface LedgerEntry {
  readonly id: string;
  /** The ENTRY's book (journal_entries.entity_id). */
  readonly book: BookId;
  /** 'YYYY-MM-DD' */
  readonly date: string;
  readonly sourceType: string;
  readonly isReversal?: true;
  readonly reversedBy?: string;
  readonly lines: ReadonlyArray<readonly [accountId: string, side: 'D' | 'C', cents: number]>;
}

/** The id of the entry that posts to the unknown-type account. */
export const UNKNOWN_TYPE_ENTRY = 'e15';
/** The id of the 2024 closing entry. */
export const CLOSING_ENTRY = 'e4';

export const ENTRIES: readonly LedgerEntry[] = [
  // 2024 — Personal only.
  { id: 'e1', book: 'P', date: '2024-01-10', sourceType: 'manual', lines: [['p1000', 'D', 500_000], ['p3000', 'C', 500_000]] },
  { id: 'e2', book: 'P', date: '2024-03-05', sourceType: 'plaid_txn', lines: [['p1000', 'D', 400_000], ['p4000', 'C', 400_000]] },
  { id: 'e3', book: 'P', date: '2024-06-20', sourceType: 'plaid_txn', lines: [['p6000', 'D', 12_000], ['p2000', 'C', 12_000]] },
  // The 2024 close: revenue 4,000.00 and expenses 120.00 zeroed, the 3,880.00 between them to Retained Earnings.
  { id: 'e4', book: 'P', date: '2024-12-31', sourceType: 'year_end_close', lines: [['p4000', 'D', 400_000], ['p6000', 'C', 12_000], ['p3900', 'C', 388_000]] },
  // 2025.
  { id: 'e5', book: 'P', date: '2025-02-11', sourceType: 'plaid_txn', lines: [['p1000', 'D', 420_000], ['p4000', 'C', 420_000]] },
  { id: 'e6', book: 'B', date: '2025-04-02', sourceType: 'plaid_txn', lines: [['b1000', 'D', 90_000], ['b4100', 'C', 90_000]] },
  // Business's entry, with its credit on Personal's Checking.
  { id: 'e7', book: 'B', date: '2025-07-15', sourceType: 'plaid_txn', lines: [['b6200', 'D', 4_999], ['p1000', 'C', 4_999]] },
  { id: 'e8', book: 'P', date: '2025-09-09', sourceType: 'plaid_txn', lines: [['p2000', 'D', 10_000], ['p1000', 'C', 10_000]] },
  // 2026.
  { id: 'e9', book: 'P', date: '2026-01-08', sourceType: 'plaid_txn', lines: [['p6000', 'D', 8_000], ['p2000', 'C', 8_000]] },
  { id: 'e10', book: 'P', date: '2026-02-03', sourceType: 'plaid_txn', lines: [['p6100', 'D', 30_000], ['p2000', 'C', 30_000]] },
  // The refund that outweighs February's Travel.
  { id: 'e11', book: 'P', date: '2026-02-20', sourceType: 'plaid_txn', lines: [['p2000', 'D', 45_000], ['p6100', 'C', 45_000]] },
  // Spent from Venmo with nothing in it: an asset with a credit balance.
  { id: 'e12', book: 'P', date: '2026-03-12', sourceType: 'plaid_txn', lines: [['p6000', 'D', 5_000], ['p1050', 'C', 5_000]] },
  { id: 'e13', book: 'P', date: '2026-05-01', sourceType: 'plaid_txn', lines: [['p1000', 'D', 450_000], ['p4000', 'C', 450_000]] },
  { id: 'e14', book: 'B', date: '2026-06-30', sourceType: 'plaid_txn', lines: [['b1000', 'D', 120_001], ['b4100', 'C', 120_001]] },
  // The posting to an account of an unknown type.
  { id: 'e15', book: 'P', date: '2026-08-08', sourceType: 'manual', lines: [['p9000', 'D', 2_500], ['p1000', 'C', 2_500]] },
  // An uncommitted row: the original (reversed) and its reversal — neither is live.
  { id: 'e16', book: 'P', date: '2026-10-10', sourceType: 'plaid_txn', reversedBy: 'e16r', lines: [['p6000', 'D', 20_000], ['p1000', 'C', 20_000]] },
  { id: 'e16r', book: 'P', date: '2026-11-11', sourceType: 'reversal', isReversal: true, lines: [['p1000', 'D', 20_000], ['p6000', 'C', 20_000]] },
];

const accountOf = (id: string): LedgerAccount => {
  const account = ACCOUNTS.find((a) => a.id === id);
  if (account === undefined) throw new Error(`booksLedger: no account ${id}`);
  return account;
};

export interface RowsFilter {
  /** The ENTRY's book; null is all books. */
  readonly book: BookId | null;
  /** First day, inclusive; absent = from the beginning. */
  readonly from?: string;
  /** Last day, inclusive. */
  readonly through: string;
  /** Whether a closing entry (source_type 'year_end_close') is kept. */
  readonly closing: 'in' | 'out';
  /** Entry ids left out — for the tests that set one entry aside. */
  readonly without?: readonly string[];
}

/** The live entries a filter keeps. */
export function entriesOf(filter: RowsFilter, entries: readonly LedgerEntry[] = ENTRIES): LedgerEntry[] {
  return entries.filter((e) =>
    e.isReversal !== true && e.reversedBy === undefined
    && (filter.book === null || e.book === filter.book)
    && (filter.from === undefined || e.date >= filter.from)
    && e.date <= filter.through
    && (filter.closing === 'in' || e.sourceType !== 'year_end_close')
    && !(filter.without ?? []).includes(e.id));
}

/** THE READ'S RULE: one row per account — its summed debits and credits over the entries the filter keeps. */
export function rowsOf(filter: RowsFilter, entries: readonly LedgerEntry[] = ENTRIES): StatementRow[] {
  const sums = new Map<string, { debits: number; credits: number }>();
  for (const entry of entriesOf(filter, entries)) {
    for (const [accountId, side, cents] of entry.lines) {
      const sum = sums.get(accountId) ?? { debits: 0, credits: 0 };
      if (side === 'D') sum.debits += cents; else sum.credits += cents;
      sums.set(accountId, sum);
    }
  }
  return [...sums.entries()].map(([accountId, sum]) => {
    const account = accountOf(accountId);
    return { code: account.code, name: account.name, type: account.type, debits: sum.debits, credits: sum.credits };
  });
}

/** What readStatements answers for a year: every live entry through Dec 31 (closing in), and the year's (closing out). */
export function readOf(year: number, book: BookId | null, without: readonly string[] = []): { toDate: StatementRow[]; inPeriod: StatementRow[] } {
  return {
    toDate: rowsOf({ book, through: `${year}-12-31`, closing: 'in', without }),
    inPeriod: rowsOf({ book, from: `${year}-01-01`, through: `${year}-12-31`, closing: 'out', without }),
  };
}

/** One row of /api/trial-balance's `accounts` (src/app/api/trial-balance/route.ts). */
export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  balanceType: string;
  entityId: string;
  entityName: string;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
  normalBalance: number;
  displaySide: 'debit' | 'credit';
}

/** The trial balance's rows: all books, all time, live entries, ONE ROW PER ACCOUNT PER ENTRY-BOOK. */
export function trialBalanceRowsOf(without: readonly string[] = []): TrialBalanceRow[] {
  const sums = new Map<string, { accountId: string; book: BookId; debits: number; credits: number }>();
  for (const entry of entriesOf({ book: null, through: '9999-12-31', closing: 'in', without })) {
    for (const [accountId, side, cents] of entry.lines) {
      const key = `${accountId}@${entry.book}`;
      const sum = sums.get(key) ?? { accountId, book: entry.book, debits: 0, credits: 0 };
      if (side === 'D') sum.debits += cents; else sum.credits += cents;
      sums.set(key, sum);
    }
  }
  return [...sums.values()].map((sum) => {
    const account = accountOf(sum.accountId);
    const normalBalance = account.balanceType === 'D' ? sum.debits - sum.credits : sum.credits - sum.debits;
    const natural = account.balanceType === 'D' ? 'debit' : 'credit';
    const other = account.balanceType === 'D' ? 'credit' : 'debit';
    return {
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      balanceType: account.balanceType,
      entityId: account.book,
      entityName: BOOKS.find((b) => b.id === sum.book)!.name,
      totalDebits: sum.debits,
      totalCredits: sum.credits,
      netBalance: sum.debits - sum.credits,
      normalBalance,
      displaySide: normalBalance >= 0 ? natural : other,
    };
  });
}
