/**
 * LinkPicker — LINK-01's list, on the ledger row (LEDGER-03, Alex, 2026-10-19).
 *
 * "Match — amount from Books … never auto link due to risk for error." One leaf
 * the task ledger mounts under a row: the record's own (kind, target_id,
 * occurrence_at) as the links route keys a routine occurrence or a line, and
 * `near` the record's day. It prints the postings already linked, each with
 * "unlink", and the CANDIDATES AS THE ROUTE ANSWERS THEM — this user's postings
 * within the route's window, in date order, not already linked to any item —
 * each a row of date · description · amount with one "link". Nothing is
 * pre-selected, nothing ranked, no amount closeness, no vendor match: the
 * drill panel's own sentence says so above the list. Every word is
 * src/lib/operations/ledger.ts's.
 *
 * The requests are useItemLinks' (hub/useLineLinks.tsx — the three LINK-01
 * requests, shared with the drill panel's lines); after a link or an unlink the
 * route accepted, the leaf reads its own links again (the linked posting leaves
 * the candidates) and tells the ledger (onChanged), which reads its span again.
 * Nothing is stored in the browser.
 */

'use client';

import { useEffect } from 'react';
import { useItemLinks } from '@/components/hub/useLineLinks';
import type { LinkableKind } from '@/lib/calendar/linkKeys';
import {
  CANDIDATES_WORDS, LINKED_POSTINGS_WORDS, LINKS_LOADING_WORDS, LINK_WORDS, NO_CANDIDATES_WORDS, NO_LINKED_POSTINGS_WORDS, NO_SUGGESTION_WORDS, PICKER_CANCEL_WORDS, UNLINK_WORDS,
  postingAmountWords, postingDateWords,
} from '@/lib/operations/ledger';

interface Props {
  readonly kind: LinkableKind;
  readonly id: string;
  readonly instant: string;
  /** The record's day, 'YYYY-MM-DD' — the route's `near`. */
  readonly near: string;
  /** The route accepted a link or an unlink: the ledger reads its span again. */
  readonly onChanged: () => void;
  readonly onClose: () => void;
}

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const head = 'text-text-faint uppercase tracking-wide';

export default function LinkPicker({ kind, id, instant, near, onChanged, onClose }: Props) {
  const item = useItemLinks(kind, id, instant);
  const { openPicker } = item;
  useEffect(() => { void openPicker(near); }, [openPicker, near]);

  return (
    <div className="space-y-2 rounded border border-border bg-white p-2 text-xs" data-link-picker={`${kind}:${id}:${instant}`}>
      <p className="text-text-faint" data-link-picker-no-suggestion>{NO_SUGGESTION_WORDS}</p>
      {item.refusal !== null && <p className="text-brand-red" data-link-picker-refusal>{item.refusal}</p>}
      <p className={head}>{LINKED_POSTINGS_WORDS}</p>
      {item.links === null && <p className="text-text-muted" data-link-picker-loading>{LINKS_LOADING_WORDS}</p>}
      {item.links !== null && item.links.length === 0 && <p className="text-text-muted" data-link-picker-none-linked>{NO_LINKED_POSTINGS_WORDS}</p>}
      {item.links !== null && item.links.length > 0 && (
        <ul className="space-y-0.5">
          {item.links.map((l) => (
            <li key={l.journalEntryId} className="flex items-center gap-2" data-link-picker-linked={l.journalEntryId}>
              <span className="font-mono text-text-muted">{postingDateWords(l.date)}</span>
              <span className="min-w-0 flex-1 truncate">{l.description}</span>
              <span className="font-mono tabular-nums">{postingAmountWords(l.amountCents)}</span>
              <button type="button" className={chip} disabled={item.busy} onClick={async () => { if (await item.unlink(l.journalEntryId, near)) onChanged(); }} data-link-picker-unlink={l.journalEntryId}>{UNLINK_WORDS}</button>
            </li>
          ))}
        </ul>
      )}
      <p className={head}>{CANDIDATES_WORDS}</p>
      {item.candidates === null && item.refusal === null && <p className="text-text-muted" data-link-picker-loading-candidates>{LINKS_LOADING_WORDS}</p>}
      {item.candidates !== null && item.candidates.length === 0 && <p className="text-text-muted" data-link-picker-no-candidates>{NO_CANDIDATES_WORDS}</p>}
      {item.candidates !== null && item.candidates.length > 0 && (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {item.candidates.map((c) => (
            <li key={c.journalEntryId} className="flex items-center gap-2" data-link-picker-candidate={c.journalEntryId}>
              <span className="font-mono text-text-muted">{postingDateWords(c.date)}</span>
              <span className="min-w-0 flex-1 truncate">{c.description}</span>
              <span className="font-mono tabular-nums">{postingAmountWords(c.amountCents)}</span>
              <button type="button" className={chip} disabled={item.busy} onClick={async () => { if (await item.link(c.journalEntryId, near)) onChanged(); }} data-link-picker-link={c.journalEntryId}>{LINK_WORDS}</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="text-text-faint hover:text-text-muted" onClick={onClose} data-link-picker-cancel>{PICKER_CANCEL_WORDS}</button>
    </div>
  );
}
