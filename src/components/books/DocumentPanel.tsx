'use client';

/**
 * DOCUMENTS-02 (Alex, 2026-10-30, ruling A) — THE ATTACH / REPLACE PANEL, FOR ANY ADDRESS.
 *
 * DOCUMENTS-01's ReceiptPanel (ReceiptControls.tsx) generalized: one panel that keeps a source document at an
 * address — a posting ({ journal_entry_id }: the receipt, mounted by the /books ledger through ReceiptControls)
 * or an account's month ({ account_id, period }: the statement, mounted by the bank reconciliation). One
 * <input type="file"> limited to the three types kept, the limit said before the file is chosen, the same
 * size rule the route holds (refused here by its words before the upload leaves the browser), the server's
 * refusal shown by name. The words (noun, none, loading, line) come from the kind (sourceDocuments.ts); this
 * file types none. Nothing is kept in the browser — React state only.
 */
import { useState } from 'react';
import {
  ATTACH_WORDS, CANCEL_WORDS, RECEIPT_ACCEPT, RECEIPT_LIMIT_WORDS, REPLACE_WORDS, UPLOAD_FIELDS,
  sizeRule, uploadFailedWords, type DocumentAddress, type DocumentKindWords, type ReceiptMeta,
} from '@/lib/books/sourceDocuments';

/** The attach / replace panel. On a kept file it calls onKept with the kept document's meta. */
export function DocumentPanel({ address, kind, panelId, replacing, onKept, onClose }: {
  address: DocumentAddress;
  kind: DocumentKindWords;
  /** The data attribute's value — the posting's id, or "<account>:<period>". */
  panelId: string;
  replacing: boolean;
  onKept: (kept: ReceiptMeta) => void;
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
      if ('journal_entry_id' in address) {
        form.append(UPLOAD_FIELDS.entry, address.journal_entry_id);
      } else {
        form.append(UPLOAD_FIELDS.account, address.account_id);
        form.append(UPLOAD_FIELDS.period, address.period);
      }
      if (replacing) form.append(UPLOAD_FIELDS.replace, 'true');
      const res = await fetch('/api/books/documents', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setRefusal(uploadFailedWords(typeof body.error === 'string' ? body.error : `the upload answered ${res.status}`)); return; }
      onKept(body.document as ReceiptMeta);
    } catch (err) {
      setRefusal(uploadFailedWords(err instanceof Error ? err.message : 'the upload did not reach the server'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-1 rounded border border-border bg-white p-2 text-xs space-y-1" data-document-panel={panelId} data-document-kind={kind.noun} data-document-replacing={replacing ? 'true' : 'false'}>
      <p className="text-text-secondary">{RECEIPT_LIMIT_WORDS}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept={RECEIPT_ACCEPT} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRefusal(null); }} data-document-input={panelId} />
        <button type="button" onClick={send} disabled={file === null || sending}
          className="h-6 px-2 rounded border border-border bg-brand-purple text-white disabled:opacity-40" data-document-submit={panelId}>
          {replacing ? REPLACE_WORDS : ATTACH_WORDS}
        </button>
        <button type="button" onClick={onClose} className="h-6 px-2 rounded border border-border text-text-secondary hover:bg-bg-row" data-document-cancel={panelId}>
          {CANCEL_WORDS}
        </button>
      </div>
      {refusal !== null && <p className="text-brand-red" role="alert" data-document-error>{refusal}</p>}
    </div>
  );
}
