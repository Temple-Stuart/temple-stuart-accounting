/**
 * PENDING-01 (Alex, 2026-11-11 12:40: "my bank trannies were not pulling … we need to get this working 100% today" ·
 * 16:25: "would be better to get the sync and data issues fixed") — A PENDING BANK ROW IS NEVER A POSTING'S SOURCE.
 *
 * WHAT THIS CLOSES. The Categorize screen let a row be committed while the bank still listed it as pending, and the
 * sync then removed that row when the posted copy arrived. A posting was left pointing at a bank row that was gone;
 * where the posted copy was committed too, the same charge sat in the ledger twice (production, 2026-11-11: 46 live
 * postings on bank rows that no longer exist, 28 of them posted twice; 62 of the 86 pending rows still held were
 * committed).
 *
 * THE RULE, HERE ONCE. A bank row is pending at the bank when its `pending` is true — the bank's own word, as Plaid
 * states it and the sync stores it (transactions.pending, written by src/lib/arrivals/plaidTransactionsPage.ts). Such
 * a row is marked and cannot be committed; it can be once the bank has posted it. The screen
 * (src/components/dashboard/SpendingTab.tsx) and the commit route (src/app/api/transactions/commit-to-ledger/route.ts)
 * read the rule and every word below from this file.
 *
 * WHAT IT DOES NOT DO. Nothing here reverses or removes a posting. A row committed before this rule keeps its
 * posting: it carries the chip, it is counted above the committed table, and it is uncommitted by hand there.
 *
 * THIS FILE IS PURE. No fetch, no env, no clock, no React, no Prisma, no import.
 */

/** What the rule reads of a bank row: the bank's own flag. */
export interface BankRowFlag {
  readonly pending: boolean;
}

/** A row is pending at the bank when its `pending` is true. */
export function isPendingAtBank(row: BankRowFlag): boolean {
  return row.pending === true;
}

/** Which rows of a set may be committed: the ones the bank has posted — in the set's own order. */
export function committableRows<Row extends BankRowFlag>(rows: readonly Row[]): Row[] {
  return rows.filter((row) => !isPendingAtBank(row));
}

/** The rows of a set the bank still lists as pending — in the set's own order. */
export function rowsPendingAtBank<Row extends BankRowFlag>(rows: readonly Row[]): Row[] {
  return rows.filter((row) => isPendingAtBank(row));
}

/**
 * Which ids of a selection may be committed: every id but those of rows still pending at the bank, in the selection's
 * own order. An id the set holds no row for is kept — the rule judges a row it can read, and the commit route judges
 * every row again.
 */
export function committableIds<Row extends BankRowFlag & { readonly id: string }>(ids: readonly string[], rows: readonly Row[]): string[] {
  const pending = new Set(rowsPendingAtBank(rows).map((row) => row.id));
  return ids.filter((id) => !pending.has(id));
}

// ─── THE WORDS ───────────────────────────────────────────────────────────────

/** The chip beside a row's description — in the queue and in the committed table. */
export const PENDING_AT_BANK_CHIP = 'PENDING AT BANK';

/** The queue's cell where the account would be picked: such a row has no tick box and no account select. */
export const PENDING_AT_BANK_CELL = 'pending at the bank — commit it once it posts';

/** The line above the committed table: how many committed rows the bank still lists as pending. Drawn only when there are any. */
export function committedStillPendingWords(count: number): string {
  return count === 1 ? '1 committed row is still pending at the bank' : `${count} committed rows are still pending at the bank`;
}

/** The line's button: show only those rows — to tick and Uncommit — and show all again. */
export const SHOW_ONLY_PENDING_AT_BANK = 'Show only these';
export const SHOW_ALL_COMMITTED = 'Show all';

/** The commit route's refusal, per row, by name: the row's own description, then why and when. */
export function pendingCommitRefusal(description: string): string {
  return `"${description}" is still pending at the bank — commit it once the bank has posted it`;
}
