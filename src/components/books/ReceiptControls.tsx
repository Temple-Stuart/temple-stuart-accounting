'use client';

/**
 * DOCUMENTS-01 (Alex, 2026-10-28, ruling F) — THE RECEIPT ON ITS POSTING, on the /books ledger.
 *
 * Bookkeeping's own controls, mounted only by its general ledger (GeneralLedger.tsx, on /books):
 *   · ReceiptLine — under a row's source: "Receipt: <name> · 1.2 MiB · PDF — open · replace", or
 *     "No receipt — attach". A reversal or a reversed posting offers no attach (it shows a receipt it
 *     already carries, read-only). "open" is a plain link to the authed file route — a download.
 *   · ReceiptPanel — the attach (or replace) panel, rendered UNDER the table: the ledger's rows are
 *     virtualized at a fixed height, the DRILL-01 precedent. DOCUMENTS-02 (Alex, 2026-10-30): the panel
 *     itself is DocumentPanel.tsx, generalized to an address — the receipt's posting here, the statement's
 *     account-month on the bank reconciliation; this is its receipt mount.
 *   · readReceipts — the ledger's read of its postings' current receipts, in pages of 200.
 *
 * Every word comes from src/lib/books/sourceDocuments.ts; this file types none. Nothing is kept in the
 * browser — React state only — and nothing is guessed: a read that fails says so and shows no receipt
 * as missing.
 */
import { DocumentPanel } from '@/components/books/DocumentPanel';
import {
  ATTACH_WORDS, NO_RECEIPT_WORDS, OPEN_WORDS, RECEIPT_KIND_WORDS, RECEIPTS_LOADING_WORDS, REPLACE_WORDS,
  pagesOf, receiptLineWords, type ReceiptMeta,
} from '@/lib/books/sourceDocuments';

export type ReceiptsRead =
  | { readonly state: 'loading' }
  | { readonly state: 'failed'; readonly reason: string }
  | { readonly state: 'done'; readonly receipts: ReadonlyMap<string, ReceiptMeta> };

/** The current receipts of these postings, keyed by posting — every page read, or the first failure, by name. */
export async function readReceipts(entryIds: readonly string[]): Promise<Map<string, ReceiptMeta>> {
  const receipts = new Map<string, ReceiptMeta>();
  for (const page of pagesOf(entryIds)) {
    const res = await fetch(`/api/books/documents?entries=${page.map(encodeURIComponent).join(',')}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `the receipts read answered ${res.status}`);
    for (const d of body.documents as ReceiptMeta[]) if (d.journal_entry_id !== null) receipts.set(d.journal_entry_id, d);
  }
  return receipts;
}

/** The line under a row's source. `canCarry` is canCarryReceipt(entry); the panel is placed by the ledger. */
export function ReceiptLine({ entryId, read, canCarry, onAttach }: {
  entryId: string;
  read: ReceiptsRead;
  canCarry: boolean;
  onAttach: (entryId: string, replacing: boolean) => void;
}) {
  if (read.state === 'failed') return null;
  if (read.state === 'loading') {
    return canCarry ? <div className="text-text-faint" data-receipt-line={entryId} data-receipt-state="reading">{RECEIPTS_LOADING_WORDS}</div> : null;
  }
  const receipt = read.receipts.get(entryId);
  if (receipt === undefined) {
    if (!canCarry) return null;
    return (
      <div className="flex items-baseline gap-1 min-w-0" data-receipt-line={entryId} data-receipt-state="none">
        <span className="text-text-faint">{NO_RECEIPT_WORDS} —</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onAttach(entryId, false); }}
          className="shrink-0 text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover" data-receipt-attach={entryId}>
          {ATTACH_WORDS}
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-1 min-w-0" data-receipt-line={entryId} data-receipt-state="kept" data-receipt-id={receipt.id}>
      <span className="truncate text-text-secondary" title={receiptLineWords(receipt)}>{receiptLineWords(receipt)}</span>
      <span className="shrink-0 text-text-faint">—</span>
      <a href={`/api/books/documents/${encodeURIComponent(receipt.id)}/file`} onClick={(e) => e.stopPropagation()}
        className="shrink-0 text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover" data-receipt-open={receipt.id}>
        {OPEN_WORDS}
      </a>
      {canCarry && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onAttach(entryId, true); }}
          className="shrink-0 text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover" data-receipt-replace={entryId}>
          {REPLACE_WORDS}
        </button>
      )}
    </div>
  );
}

/** The attach / replace panel, under the table. On a kept file it calls onKept (the ledger re-reads its receipts). */
export function ReceiptPanel({ entryId, replacing, onKept, onClose }: {
  entryId: string;
  replacing: boolean;
  onKept: () => void;
  onClose: () => void;
}) {
  return <DocumentPanel address={{ journal_entry_id: entryId }} kind={RECEIPT_KIND_WORDS} panelId={entryId} replacing={replacing} onKept={onKept} onClose={onClose} />;
}
