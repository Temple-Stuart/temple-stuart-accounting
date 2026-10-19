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
