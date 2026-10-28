/**
 * BOOKS-GATE-01 (Alex, 2026-10-28, ruling B) — THE BOOKS SUMMARY NEVER COUNTS AN UNREADABLE BALANCE AS ZERO.
 *
 * The Books panel's cockpit bar (ModuleLauncher.tsx BooksPanel) sums the trial balance's accounts by type —
 * assets, liabilities, equity — each as |normalBalance|, the sum the bar has always drawn. Until this ruling
 * the sum read `Math.abs(Number(a.normalBalance) || 0)`: a balance that was not a number (null, which is what
 * JSON makes of a NaN; undefined; "abc") was summed as 0, and the bar showed a total that left an account out
 * without saying so.
 *
 * A balance is READABLE when it is a finite number, or a non-empty string that reads as one (the route answers
 * numbers — src/app/api/trial-balance/route.ts; a numeric string reads the same). Anything else throws by name,
 * and the panel catches it into its existing error words, exactly as it does a trial balance that carries no
 * isBalanced/hasActivity. Only the accounts a sum reads are read: a balance outside the three types enters no
 * figure here, as before. Pure — no fetch, no clock, no React.
 */

/** What the summary reads of one trial-balance account row (the route's `accounts[]`). */
export interface TrialBalanceAccountRow {
  readonly accountCode?: unknown;
  readonly accountType?: unknown;
  readonly normalBalance?: unknown;
}

/** The words an unreadable balance throws with — the account named by its code. */
export const unreadableBalanceWords = (accountCode: unknown): string =>
  `trial balance account ${String(accountCode)} has no readable normalBalance`;

/** An account's normalBalance as a finite number; anything else throws by name — never a 0 in its place. */
export function readableBalanceOf(account: TrialBalanceAccountRow): number {
  const v = account.normalBalance;
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN;
  if (!Number.isFinite(n)) throw new Error(unreadableBalanceWords(account.accountCode));
  return n;
}

/** The bar's sum for one account type: Σ |normalBalance| over the accounts of that type, each read by readableBalanceOf. */
export function sumByType(accounts: readonly TrialBalanceAccountRow[], type: string): number {
  return accounts
    .filter((a) => a.accountType === type)
    .reduce((s, a) => s + Math.abs(readableBalanceOf(a)), 0);
}
