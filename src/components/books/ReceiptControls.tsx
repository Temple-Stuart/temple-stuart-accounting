'use client';

/**
 * DOCUMENTS-01 (Alex, 2026-10-28, ruling F) — THE RECEIPT ON ITS POSTING, on the /books ledger.
 *
 * Bookkeeping's own controls, mounted only by its general ledger (GeneralLedger.tsx, on /books):
 *   · ReceiptLine — under a row's source: "Receipt: <name> · 1.2 MB · PDF — open · replace", or
 *     "No receipt — attach". A reversal or a reversed posting offers no attach (it shows a receipt it
 *     already carries, read-only). "open" is a plain link to the authed file route — a download.
 *   · ReceiptPanel — the attach (or replace) panel, rendered UNDER the table: the ledger's rows are
 *     virtualized at a fixed height, the DRILL-01 precedent. One <input type="file"> limited to the three
 *     types kept, the limit said before the file is chosen, the server's refusal shown by name.
 *   · readReceipts — the ledger's read of its postings' current receipts, in pages of 200.
 *
 * Every word comes from src/lib/books/sourceDocuments.ts; this file types none. Nothing is kept in the
 * browser — React state only — and nothing is guessed: a read that fails says so and shows no receipt
 * as missing.
 */
import { useState } from 'react';
import {
  ATTACH_WORDS, CANCEL_WORDS, NO_RECEIPT_WORDS, OPEN_WORDS, RECEIPT_ACCEPT, RECEIPT_LIMIT_WORDS, RECEIPTS_LOADING_WORDS, REPLACE_WORDS,
  UPLOAD_FIELDS, pagesOf, receiptLineWords, sizeRule, uploadFailedWords, type ReceiptMeta,
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
    for (const d of body.documents as ReceiptMeta[]) receipts.set(d.journal_entry_id, d);
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
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const send = async () => {
    if (file === null) return;
    // The same size rule the route holds — a file over the cap is refused here by its words, before it is sent.
    const size = sizeRule(file.size);
    if (!size.ok) { setRefusal(uploadFailedWords(size.error)); return; }
    setSending(true);
    setRefusal(null);
    try {
      const form = new FormData();
      form.append(UPLOAD_FIELDS.file, file);
      form.append(UPLOAD_FIELDS.entry, entryId);
      if (replacing) form.append(UPLOAD_FIELDS.replace, 'true');
      const res = await fetch('/api/books/documents', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setRefusal(uploadFailedWords(typeof body.error === 'string' ? body.error : `the upload answered ${res.status}`)); return; }
      onKept();
    } catch (err) {
      setRefusal(uploadFailedWords(err instanceof Error ? err.message : 'the upload did not reach the server'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-1 rounded border border-border bg-white p-2 text-xs space-y-1" data-receipt-panel={entryId} data-receipt-replacing={replacing ? 'true' : 'false'}>
      <p className="text-text-secondary">{RECEIPT_LIMIT_WORDS}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept={RECEIPT_ACCEPT} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRefusal(null); }} data-receipt-input={entryId} />
        <button type="button" onClick={send} disabled={file === null || sending}
          className="h-6 px-2 rounded border border-border bg-brand-purple text-white disabled:opacity-40" data-receipt-submit={entryId}>
          {replacing ? REPLACE_WORDS : ATTACH_WORDS}
        </button>
        <button type="button" onClick={onClose} className="h-6 px-2 rounded border border-border text-text-secondary hover:bg-bg-row" data-receipt-cancel={entryId}>
          {CANCEL_WORDS}
        </button>
      </div>
      {refusal !== null && <p className="text-brand-red" role="alert" data-receipt-error>{refusal}</p>}
    </div>
  );
}
