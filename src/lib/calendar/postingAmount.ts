/**
 * postingAmount — THE AMOUNT OF A POSTING, IN CENTS, OR NULL (LEDGER-03, Alex, 2026-10-19).
 *
 * The one rule two routes read a posting's amount by: the LINK-01 route
 * (src/app/api/calendar/links/route.ts — the links' and the candidates'
 * amounts) and the ledger route (src/app/api/operations/ledger/route.ts — the
 * MATCH column, LEDGER-03). It lived inside the links route until LEDGER-03
 * needed it too; it moved here so there is ONE copy, not two.
 *
 * The amount is the DEBIT line's, as the books hold it: integer cents in
 * ledger_entries.amount (a bigint). A posting with no readable debit line is
 * NULL — reported by every reader, never summed as zero. EDGE-01 found the
 * opposite at src/app/api/trade-card-links/route.ts:80 and :255
 * (`sum + (p.realized_pl ?? 0)`), which counts an unknown as nothing; this
 * leaf is the answer to it. Pure: no Prisma, no fetch, no React.
 */

/** What the rule reads of a posting: its lines' type and amount — the select both routes make. */
export const POSTING_LINES_SELECT = { ledger_entries: { select: { entry_type: true, amount: true } } } as const;

export interface PostingLines {
  readonly ledger_entries: readonly { readonly entry_type: string; readonly amount: bigint }[];
}

/** The debit's amount in cents; NULL when there is no debit line or its amount is not a finite number. */
export function amountCentsOf(entry: PostingLines): number | null {
  const debit = entry.ledger_entries.find((l) => l.entry_type === 'D');
  if (!debit) return null;
  const n = Number(debit.amount);
  return Number.isFinite(n) ? n : null;
}

/**
 * LINK-LAW-01 (Alex, 2026-10-28, ruling C) — A REVERSED POSTING PAYS NOTHING.
 *
 * The books un-commit a posting by reversing it (journal-entry-service.ts reversePlaidTransaction, through POST
 * /api/transactions/uncommit): the original is marked status 'reversed' with reversed_by_entry_id, and a reversal entry
 * is written with is_reversal true (prisma/schema.prisma journal_entries). Neither half pays anything — the pair nets to
 * zero — so a link to either is no payment. The Books' own reads exclude both by the same two columns
 * (src/lib/budget/reportReads.ts, `is_reversal: false, reversed_by_entry_id: null`); this rule reads the third the
 * ruling names (status) too. The links POST refuses such a posting by name; every MATCH read excludes it and says how
 * many it excluded — never sums it. Pure, like the amount rule above.
 */

/** What the rule reads of a posting's reversal: the three columns. */
export const POSTING_STATE_SELECT = { status: true, is_reversal: true, reversed_by_entry_id: true } as const;

export interface PostingState {
  readonly status: string;
  readonly is_reversal: boolean;
  readonly reversed_by_entry_id: string | null;
}

/** The select every MATCH read makes of a linked posting: its lines (the amount) and its reversal state. */
export const LINKED_POSTING_SELECT = { ...POSTING_LINES_SELECT, ...POSTING_STATE_SELECT } as const;

export type LinkedPostingRow = PostingLines & PostingState;

/** A posting that is a reversal, or has been reversed — either way it pays nothing. */
export function isReversedPosting(entry: PostingState): boolean {
  return entry.is_reversal || entry.reversed_by_entry_id !== null || entry.status === 'reversed';
}

/** The same rule as a query: the postings that may pay (a candidate), and the ones that may not (counted). */
export const PAYING_POSTING_WHERE = { is_reversal: false, reversed_by_entry_id: null, status: { not: 'reversed' } } as const;
export const REVERSED_POSTING_WHERE = { OR: [{ is_reversal: true }, { reversed_by_entry_id: { not: null } }, { status: 'reversed' }] };

/** What a MATCH read says of the linked postings it left out (the ruling's words). */
export const reversedLinkedWords = (n: number): string =>
  `${n} linked posting${n === 1 ? ' was' : 's were'} reversed — MATCH leaves ${n === 1 ? 'it' : 'them'} out`;

/** What the candidate list says of the reversed postings in its window it does not offer. */
export const reversedCandidatesWords = (n: number): string =>
  `${n} reversed posting${n === 1 ? '' : 's'} in this window ${n === 1 ? 'is' : 'are'} not offered — a reversed posting pays nothing`;

/** The links POST's refusal, naming the posting. */
export function reversedRefusalWords(entry: PostingState & { readonly id: string; readonly description: string; readonly date: Date }): string {
  const what = `${JSON.stringify(entry.description)} (${entry.date.toISOString().slice(0, 10)}, ${entry.id})`;
  return entry.is_reversal
    ? `${what} is a reversal entry — it pays nothing, so it cannot be linked`
    : `${what} has been reversed — it pays nothing, so it cannot be linked`;
}
