/**
 * RoutineVendorPanel — THE VENDOR, DECIDED ON THE ROW (EXPENSES-02, Alex, 2026-10-26, ruling A).
 *
 * Under a ROUTINE EXPENSES row, the line's book's vendor list — VENDOR-01's one
 * list (GET /api/operations/vendor-directory, the caller's active vendors, shown
 * for the line's book by the vendor box's own rule, reportView.ts vendorChoices)
 * — with "+ add <name> to <book>" (the directory's existing POST) and "clear".
 *
 * Picking writes the EVERY-OCCURRENCE grain through the existing route and rule:
 * POST /api/operations/plan-vendors { kind: 'routine_line' | 'routine' (a
 * stepless routine), id, instant: null, vendorId } — work.ts
 * routineVendorAddressOf; planVendor.ts decides, the migration's trigger holds
 * the grain. "clear" is the route's DELETE at the same address (ClearVendor, the
 * budget box's own control). "+ add" creates the vendor in the book, then writes
 * it the same way — one grain, nothing to choose. A line already at the
 * OCCURRENCE grain gets no picker: the section hands this panel a refusal
 * (work.ts routineVendorControlOf, by the month line's grain) and it prints the
 * refusal by name and writes nothing — the grain is never overridden here.
 *
 * Every write is the budget box's own call (budget/VendorBox.tsx setVendor,
 * addVendor, ClearVendor — exported for this panel): the same JSON, the same
 * refusal words, signed out read the same way. After a write the section
 * re-reads the routines and their month (ruling B) — the VENDOR cell shows what
 * the server holds, never an optimistic copy. React state only: the typed text
 * and the last refusal; the directory is read while the panel is open.
 */

'use client';

import { useState } from 'react';
import { ClearVendor, addVendor, setVendor, useDirectory } from '@/components/budget/VendorBox';
import { dataAttr } from '@/components/table/dataAttr';
import { vendorNameKey } from '@/lib/operations/planVendor';
import { vendorChoices, type DirectoryVendor } from '@/lib/budget/reportView';
import {
  ROUTINE_TABLE_NAME, VENDOR_CLEAR_WORDS, routineVendorAddressOf, vendorAddWords, vendorHeldWords, type RoutineRow, type RoutineVendorControl,
} from '@/lib/operations/work';

const name = ROUTINE_TABLE_NAME;
const chip = 'px-2 py-0.5 border border-border text-text-muted rounded hover:bg-bg-row disabled:opacity-50 text-xs';

/** The book's vendors, by name, when nothing is typed; the one name rule's choices once something is. */
function offeredOf(typed: string, vendors: readonly DirectoryVendor[], bookId: string): { offered: readonly DirectoryVendor[]; add: string | null; refusal: string | null } {
  if (vendorNameKey(typed) === '') {
    const book = vendors.filter((v) => v.entity_id === bookId).sort((a, b) => (vendorNameKey(a.vendor_name) < vendorNameKey(b.vendor_name) ? -1 : vendorNameKey(a.vendor_name) > vendorNameKey(b.vendor_name) ? 1 : 0));
    return { offered: book, add: null, refusal: null };
  }
  const choices = vendorChoices(typed, vendors, bookId);
  return { offered: choices.offered, add: choices.add, refusal: choices.refusal };
}

export default function RoutineVendorPanel({ row, control, bookName, onChanged, onClose }: {
  row: RoutineRow;
  control: RoutineVendorControl;
  bookName: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const directory = useDirectory();
  const address = routineVendorAddressOf(row);
  const bookId = row.routine.entity_id;

  // The refusal: printed by name, nothing offered, nothing written (ruling A).
  if (control.kind === 'refusal') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs" {...dataAttr(name, 'vendor-panel', row.id)} {...dataAttr(name, 'vendor-refusal')}>
        <span className="text-text-muted">{control.words}</span>
        <button type="button" className="text-text-faint underline" onClick={onClose} {...dataAttr(name, 'vendor-close')}>close</button>
      </div>
    );
  }

  // The write — every occurrence (instant null), then the section reads again.
  const write = async (vendorId: string) => {
    setBusy(true);
    setWords(null);
    const answer = await setVendor(address, null, vendorId);
    setBusy(false);
    if (answer.ok) { onChanged(); onClose(); } else setWords(answer.words);
  };
  // "+ add <name> to <book>": the directory's POST, then the same write; a 409 carries the vendor the book already has, which IS that vendor (D1).
  const add = async (vendorName: string) => {
    setBusy(true);
    setWords(null);
    const answer = await addVendor(bookId, vendorName);
    const matched = !answer.ok && answer.status === 409 && answer.body !== null && typeof answer.body.vendor === 'object' && answer.body.vendor !== null
      ? (answer.body.vendor as { id: string }).id
      : null;
    if (answer.ok && typeof answer.body.id === 'string') { directory.refresh(); await write(answer.body.id); return; }
    setBusy(false);
    if (matched !== null) { await write(matched); return; }
    setWords(answer.ok ? 'the vendor came back without its id' : answer.words);
  };

  const choices = directory.vendors === null ? null : offeredOf(typed, directory.vendors, bookId);
  return (
    <div className="flex flex-col gap-1.5 text-xs" {...dataAttr(name, 'vendor-panel', row.id)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-text-faint uppercase tracking-wide">vendor · {bookName}</span>
        {control.held !== null && (
          <>
            <span className="text-text-primary" {...dataAttr(name, 'vendor-held')}>{vendorHeldWords(control.held.name)}</span>
            <ClearVendor address={address} reload={() => { onChanged(); onClose(); }} label={VENDOR_CLEAR_WORDS} />
          </>
        )}
        <button type="button" className="text-text-faint underline" onClick={onClose} {...dataAttr(name, 'vendor-close')}>close</button>
      </div>
      <input
        className="border border-border bg-white px-2 py-1 text-sm max-w-md"
        aria-label="Vendor"
        placeholder="Type a vendor"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        {...dataAttr(name, 'vendor-typed')}
      />
      {directory.words !== null && <span className="text-brand-red" {...dataAttr(name, 'vendor-directory-failed')}>{directory.words}</span>}
      {choices !== null && (
        <div className="flex flex-wrap gap-1.5" {...dataAttr(name, 'vendor-choices')}>
          {choices.offered.map((v) => (
            <button key={v.id} type="button" className={chip} disabled={busy} onClick={() => write(v.id)} {...dataAttr(name, 'vendor-choice', v.id)}>{v.vendor_name}</button>
          ))}
          {choices.add !== null && (
            <button type="button" className={chip} disabled={busy} onClick={() => add(choices.add as string)} {...dataAttr(name, 'vendor-add')}>{vendorAddWords(choices.add, bookName)}</button>
          )}
          {choices.offered.length === 0 && choices.add === null && choices.refusal === null && <span className="text-text-faint" {...dataAttr(name, 'vendor-none')}>no vendor in {bookName} yet — type a name to add one</span>}
          {choices.refusal !== null && <span className="text-brand-red">{choices.refusal}</span>}
        </div>
      )}
      {words !== null && <span className="text-brand-red" {...dataAttr(name, 'vendor-refused')}>{words}</span>}
    </div>
  );
}
