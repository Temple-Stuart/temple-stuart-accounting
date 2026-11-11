/**
 * BOOKS-GATE-01 (Alex, 2026-10-28, ruling B) — THE BOOKS SUMMARY NEVER COUNTS AN UNREADABLE FIGURE AS ZERO.
 *
 * The Books panel's cockpit bar (ModuleLauncher.tsx BooksPanel) draws three figures from the trial balance's
 * accounts — assets, liabilities, equity. Until that ruling the sum read `Math.abs(Number(a.normalBalance) || 0)`:
 * a balance that was not a number (null, which is what JSON makes of a NaN; undefined; "abc") was summed as 0, and
 * the bar showed a total that left an account out without saying so.
 *
 * A figure is READABLE when it is a finite number, or a non-empty string that reads as one (the route answers
 * numbers — src/app/api/trial-balance/route.ts; a numeric string reads the same). Anything else throws by name —
 * the account's code and the field — and the panel catches it into its existing error words, exactly as it does a
 * trial balance that carries no isBalanced/hasActivity. Pure — no fetch, no clock, no React.
 *
 * BOOKS-GATE-01 (Alex, 2026-10-28, ruling 6): the same for the list itself. `Array.isArray(tb.accounts) ? tb.accounts
 * : []` stood in the panel — a trial balance that came back without its accounts was read as NO accounts, and the bar
 * drew $0 for assets, liabilities and equity. trialBalanceAccountsOf throws by name instead; an empty list is a real
 * empty ledger and stays one.
 *
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE BAR ADDS UP. Until this the three figures were
 * Σ |normalBalance| per type (sumByType): an account with a negative balance RAISED its type's figure, and revenue and
 * expense entered no figure — so "A = L + E ✓ Balanced" (then the trial balance's debits = credits) stood over three
 * figures that did not add up. Now they are the ONE balance sheet (src/lib/books/statements.ts balanceSheetOf) over
 * the trial balance's own rows — each row's accountType, totalDebits and totalCredits — all books, all time:
 * Assets = totalAssets, Liabilities = totalLiabilities, Equity = totalEquity (the equity accounts PLUS the earnings no
 * closing entry has moved into equity yet). The readable rule is the same rule, now asked of the two fields read; every
 * row is read — revenue and expense are inside Equity, and a type the statements do not read is named, in no figure.
 */
import { balanceSheetOf, type BalanceSheet } from './statements';

/** What the summary reads of one trial-balance account row (the route's `accounts[]`). */
export interface TrialBalanceAccountRow {
  readonly accountCode?: unknown;
  readonly accountType?: unknown;
  readonly totalDebits?: unknown;
  readonly totalCredits?: unknown;
}

/** The words a trial balance without its `accounts` array throws with. */
export const MISSING_ACCOUNTS_WORDS = 'trial balance came back without its accounts';

/** The trial balance's account rows; an answer whose `accounts` is not an array throws by name — never an empty list in its place. */
export function trialBalanceAccountsOf(tb: { readonly accounts?: unknown } | null | undefined): readonly TrialBalanceAccountRow[] {
  const accounts = tb?.accounts;
  if (!Array.isArray(accounts)) throw new Error(MISSING_ACCOUNTS_WORDS);
  return accounts as readonly TrialBalanceAccountRow[];
}

/** The two figures the bar reads of a row. */
export type BarFigure = 'totalDebits' | 'totalCredits';

/** The words an unreadable figure throws with — the account named by its code, and the field. */
export const unreadableFigureWords = (accountCode: unknown, field: BarFigure): string =>
  `trial balance account ${String(accountCode)} has no readable ${field}`;

/** A row's totalDebits or totalCredits as a finite number; anything else throws by name — never a 0 in its place. */
export function readableFigureOf(account: TrialBalanceAccountRow, field: BarFigure): number {
  const v = account[field];
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) throw new Error(unreadableFigureWords(account.accountCode, field));
  return n;
}

/** The words a row whose accountType is not a string throws with. */
export const unreadableTypeWords = (accountCode: unknown): string =>
  `trial balance account ${String(accountCode)} has no readable accountType`;

/**
 * THE BAR'S FIGURES: the one balance sheet over the trial balance's rows. The trial balance answers one row per
 * account per entry-book, so an account may arrive more than once — the balance sheet sums them. The bar draws no
 * line, so a row is named by its code alone. A figure that is readable and not a whole number of cents is refused by
 * the statements' own rule.
 */
export function barFiguresOf(accounts: readonly TrialBalanceAccountRow[]): BalanceSheet {
  return balanceSheetOf(accounts.map((account) => {
    if (typeof account.accountType !== 'string') throw new Error(unreadableTypeWords(account.accountCode));
    const code = String(account.accountCode);
    return {
      code,
      name: code,
      type: account.accountType,
      debits: readableFigureOf(account, 'totalDebits'),
      credits: readableFigureOf(account, 'totalCredits'),
    };
  }));
}
