/**
 * RecordForm — A ROW'S RECORD, ON THE TIME SHEET (TIMESHEET-02, Alex, 2026-11-24).
 *
 * "Id love to make sure I can add in the spending details into the time tab, and can cut out the spread sheets."
 * "can we build it, and once its built, we can make adjustments as needed?"
 *
 * One leaf the time sheet mounts under a row that takes a record
 * (LedgerSection.tsx — the "record" chip in the WENT cell), on ExpenseForm.tsx's
 * and LinkPicker.tsx's model. It is handed the row and the row's entry in the
 * answer's `recording` (src/lib/operations/ledger.ts LedgerRecording): the
 * stop's planned instant, the record the row holds (or none) and the vendor
 * slot — so it opens with no read of its own. It is NOT the day card's
 * StopForm: that one takes the card's Stop, built from the card's own reads,
 * and is sized to the card.
 *
 * A title line, always. THE VENDOR, in its own block ABOVE the form and never
 * inside it — Enter in the vendor's box must not save the record: the day
 * card's own vendor block, unchanged (stops/StopVendor.tsx — the Budget's box,
 * budget/VendorBox.tsx, on the plan line; the reason's words on a recorded row
 * with no line to plan on). Its writes go through the two vendor routes the
 * box already calls, by the line's own entityId; its reload reads the ledger's
 * span again. The book's name is only words in the box's sentences — named as
 * the card names it, from the provider's list (EntitySelector.tsx
 * useOperationsEntity, ExpenseForm's own source), and a book that list does not
 * hold by the card's own words (accountCell.ts ACCOUNT_CELL_WORDS.bookNotLoaded).
 * StopVendor takes the width of what holds it (stops/DayDeck.tsx underStyle):
 * this leaf bounds its own width, so the block sits with the form, to the left.
 *
 * THE FORM: went | skipped (the WENT column's own two words), ACTUAL, STARS
 * (a box, 1 to 5, its title the rubric), LOGGED MIN, DESCRIPTION, NOTES (TIMESHEET-04b, 2026-11-27: the record's notes, never required; the draft is the row's — ledger.ts rowDraftOf, the blank draft with DESCRIPTION holding the row's planned items), then save,
 * clear (only when a record is held) and cancel. A <form>: Enter saves. The
 * draft, the rule and the body are ledger.ts's (recordDraftOf, recordInput —
 * the clock handed in: the browser's, read once at save); every label is the
 * column's own head word or the "+ expense" form's. Save goes through the ONE
 * writer (stops/stopWrites.ts setStopRecord); clear asks first
 * (stopRecord.ts clearStopQuestion over the row's WENT words) and then goes
 * through the same writer (clearStopRecord) — StopForm.tsx's way. A refusal —
 * the rule's, or the route's in its own words — shows in the form in red, and
 * the form stays open with what was typed. After an accepted write the caller
 * is told the row's day: the section closes the form, reads its span again and
 * announces the day, as it does after "+ expense". Never an optimistic copy.
 *
 * This leaf names no route and sends no request of its own; it prints no
 * sentence of its own — every word is ledger.ts's or a rule file's. Nothing is
 * stored in the browser.
 */

'use client';

import { useState } from 'react';
import { ACCOUNT_CELL_WORDS } from '@/lib/coa/accountCell';
import { NOTES_MAX, NOTE_MAX, SKIPPED_WORD, clearStopQuestion } from '@/lib/operations/stopRecord';
import {
  CANCEL_EXPENSE_WORDS, CLEAR_RECORD_WORDS, RECORD_FIELD_WORDS, RECORD_TITLE_WORDS, SAVE_RECORD_WORDS, SKIP_REASON_PLACEHOLDER_WORDS, STARS_RUBRIC_WORDS, WENT_WORD,
  recordInput, rowDraftOf, wentCellWords,
  type LedgerRecordingTaken, type LedgerSheetRow, type RecordDraft, type RecordField, type RecordWent,
} from '@/lib/operations/ledger';
import { useOperationsEntity } from '../EntitySelector';
import StopVendor from '../stops/StopVendor';
import { clearStopRecord, setStopRecord } from '../stops/stopWrites';

interface Props {
  /** The sheet's row: its address is where the record is written, its day is told to the caller after a write, its WENT words name the record a clear asks about. */
  readonly row: LedgerSheetRow;
  /** The row's entry in the answer's `recording` — a row that takes a record. */
  readonly entry: LedgerRecordingTaken;
  /** The route accepted a save or a clear: the row's day, for the section to read its span again and announce. */
  readonly onWritten: (day: string) => void;
  /** The vendor's box wrote: the section reads its span again. */
  readonly onVendor: () => void;
  readonly onClose: () => void;
}

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs disabled:opacity-50';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs';
const label = 'text-text-faint tracking-wide';

/** A refusal shown in the form: the rule's names its box; the route's, and a request that never arrived, name none. */
type Refusal = { readonly field: RecordField | null; readonly message: string };

export default function RecordForm({ row, entry, onWritten, onVendor, onClose }: Props) {
  const { entities } = useOperationsEntity();
  const [draft, setDraft] = useState<RecordDraft>(() => rowDraftOf(row, entry.held)); // TIMESHEET-04b (2026-11-27): the row's own draft — its record's, or the blank draft with DESCRIPTION holding the row's planned items (recordDraftOf(entry.held) until then)
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [busy, setBusy] = useState(false);

  // The book, by name, as the card names it (day/DayCard.tsx bookNameOf) — from the provider's list, by the line's entityId; a book the list does not hold is named so.
  const bookNameOf = (entityId: string): string => {
    const book = entities.find((e) => e.id === entityId);
    return book === undefined ? ACCOUNT_CELL_WORDS.bookNotLoaded : book.name;
  };
  const bookName = entry.vendor.kind === 'box' ? bookNameOf(entry.vendor.line.entityId) : ACCOUNT_CELL_WORDS.bookNotLoaded;

  const set = (name: Exclude<RecordField, 'went'>) => (value: string) => setDraft((d) => ({ ...d, [name]: value }));
  const went = (value: RecordWent) => setDraft((d) => ({ ...d, went: value }));

  /** One write through the one writer: its refusal is shown in its own words and the form stays; accepted, the caller is told the day. */
  const write = async (send: () => ReturnType<typeof setStopRecord>) => {
    setBusy(true);
    setRefusal(null);
    try {
      const answer = await send();
      if (!answer.ok) { setRefusal({ field: null, message: answer.message }); return; }
      onWritten(row.day);
    } catch (error) {
      setRefusal({ field: null, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (busy) return;
    let read: ReturnType<typeof recordInput>;
    try {
      // The clock is the browser's, read once here and handed to the rule; the route reads its own.
      read = recordInput(draft, row.address, entry, new Date());
    } catch (error) {
      // What the rule throws by name (a held record it cannot read) is said where the form is — never left in the console.
      setRefusal({ field: null, message: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (!read.ok) { setRefusal(read); return; }
    const body = read.body;
    void write(() => setStopRecord(body));
  };

  const clear = () => {
    const held = entry.held;
    if (held === null || busy || !window.confirm(clearStopQuestion(wentCellWords(row)))) return;
    void write(() => clearStopRecord(held.id));
  };

  const field = (name: Exclude<RecordField, 'went'>, control: React.ReactNode) => (
    <label className="flex items-center gap-1" data-record-form-field={name}>
      <span className={label}>{RECORD_FIELD_WORDS[name]}</span>
      {control}
    </label>
  );

  return (
    <div className="max-w-3xl space-y-2 rounded border border-border bg-white p-2 text-xs" data-record-form={row.key}>
      <p className="font-semibold text-text-secondary" data-record-form-title>{RECORD_TITLE_WORDS}</p>
      {/* THE VENDOR — its own block, above the form and outside it: Enter in the vendor's box never saves the record. The day card's own block, unchanged. */}
      <StopVendor slot={entry.vendor} bookName={bookName} reload={onVendor} />
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(); }} data-record-form-boxes>
        <span className="flex items-center gap-1" role="group" aria-label={RECORD_FIELD_WORDS.went} data-record-form-field="went">
          <span className={label}>{RECORD_FIELD_WORDS.went}</span>
          <button type="button" className={draft.went === WENT_WORD ? chipOn : chip} disabled={busy} aria-pressed={draft.went === WENT_WORD} onClick={() => went(WENT_WORD)} data-record-form-went={WENT_WORD}>{WENT_WORD}</button>
          <button type="button" className={draft.went === SKIPPED_WORD ? chipOn : chip} disabled={busy} aria-pressed={draft.went === SKIPPED_WORD} onClick={() => went(SKIPPED_WORD)} data-record-form-went={SKIPPED_WORD}>{SKIPPED_WORD}</button>
        </span>
        {field('actual', <input type="text" inputMode="decimal" value={draft.actual} onChange={(e) => set('actual')(e.target.value)} className={`${box} w-20 font-mono tabular-nums`} data-record-form-actual />)}
        {field('stars', <input type="text" inputMode="numeric" value={draft.stars} onChange={(e) => set('stars')(e.target.value)} className={`${box} w-10`} maxLength={1} title={STARS_RUBRIC_WORDS} data-record-form-stars />)}
        {field('minutes', <input type="text" inputMode="numeric" value={draft.minutes} onChange={(e) => set('minutes')(e.target.value)} className={`${box} w-16 font-mono tabular-nums`} data-record-form-minutes />)}
        {field('note', <input type="text" value={draft.note} onChange={(e) => set('note')(e.target.value)} className={`${box} w-64`} maxLength={NOTE_MAX} placeholder={draft.went === SKIPPED_WORD ? SKIP_REASON_PLACEHOLDER_WORDS : undefined} data-record-form-note />)}{field('notes', <input type="text" value={draft.notes} onChange={(e) => set('notes')(e.target.value)} className={`${box} w-96`} maxLength={NOTES_MAX} data-record-form-notes />)}
        <button type="submit" className={chip} disabled={busy} aria-busy={busy} data-record-form-save>{SAVE_RECORD_WORDS}</button>
        {entry.held !== null && <button type="button" className={chip} disabled={busy} onClick={clear} data-record-form-clear>{CLEAR_RECORD_WORDS}</button>}
        <button type="button" className={chip} disabled={busy} onClick={onClose} data-record-form-cancel>{CANCEL_EXPENSE_WORDS}</button>
        {refusal !== null && <span className="text-brand-red" data-record-form-refused={refusal.field === null ? '' : refusal.field}>{refusal.message}</span>}
      </form>
    </div>
  );
}
