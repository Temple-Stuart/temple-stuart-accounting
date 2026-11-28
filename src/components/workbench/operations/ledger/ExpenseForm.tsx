/**
 * ExpenseForm — "+ expense" on the task ledger (RETRO-01, Alex, 2026-10-16: the city ledger; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger).
 *
 * "He also wants to add an expense straight from the ledger and have it land on
 * that day's card." A form: day, time, name, amount, COA, book, vendor
 * (optional — one of the book's, or a new name), actual, stars, note; the zone
 * is the viewer's browser zone, shown. Save runs the writes in order, each
 * through its existing route (ledgerWrites.ts; the record through the stops'
 * one writer): the one-off stop with its one line, the line read back, the
 * vendor added when a new name was given, the vendor on the line's occurrence
 * when one was given, the record. The rule and every body are
 * src/lib/operations/ledger.ts's (expenseInput, oneOffBody, vendorBody,
 * recordBody); every sentence is its words. A failure stops at its step: the
 * outcome lists every step — written, not written with the route's words,
 * not tried, or none given — never a silent retry, never a silent roll-back.
 * On success the caller is told the day (the ledger reads again; the card is
 * told through dayWritten.ts). The books are the provider's list (the entity
 * selector's choice is not read); the COA list is the book's (CoaSelect).
 * Nothing is stored in the browser.
 *
 * SHEET-01 (Alex, 2026-11-28) — "+ EXPENSE" IS THE SHEET'S BLANK ROW. "+ expense" (ExpenseOpen) opens a blank row at the TOP of the time
 * sheet's table — ExpenseRow, handed to the shared table as its `first` (LedgerSection.tsx) — and the next tap shuts it. The row is one
 * cell under every column of the sheet, drawn from LEDGER_COLUMNS: a box under every column he types (DATE, START, END, LOCATION,
 * CATEGORY, ENTITY, TYPE, ITEMS, VENDOR, INSTAGRAM TAG, STARS, LOGGED MIN, BUDGET, ACTUAL, NOTES); DAY and PLANNED MIN worked out as he
 * types; WENT, COA, VARIANCE, MATCH and UNDER / OVER the sheet's blank until the row is saved. CITY · REGION · COUNTRY are the trip that
 * covers DATE (day/dayReads.ts readStays — the day card's own reader); on a date no trip covers they are three boxes, and saving writes
 * that trip FIRST (stays/stayWrites.ts createStay), from DATE to TRIP ENDS. VENDOR is ONE typed box over the book's vendors — the
 * directory's GET (week/weekReads.ts readJson), read by the paste's own rule (pasteRows.ts vendorsOf, with the tag each carries; one of
 * the book's by pastedVendorOf, else new) in place of the Budget's useDirectory. Under the row: save, cancel, the zone, the trip, the
 * refusal and what each write did, in EXPENSE_STEPS' order — the trip, the stop, its line, END's minutes, the vendor added, the vendor
 * set, the tag (only on a vendor that carries none), the record (now carrying NOTES and LOGGED MIN). Enter in a box saves; after a save
 * the row clears (the book kept), stays open, and both reads run again. Every sentence is ledger.ts's or a rule file's.
 */

'use client';

import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cellClass as cell } from '@/components/table/DataTable';
import { isIsoDay } from '@/lib/budget/days';
import { BLANK } from '@/lib/budget/format';
import {
  CANCEL_EXPENSE_WORDS, EMPTY_EXPENSE, EMPTY_ROW_TRIP, EXPENSE_WORDS, LEDGER_COLUMNS, NO_BOOK_WORDS,
  ROW_LATER_MARK, ROW_LATER_WORDS, ROW_TRIP_FIELD_WORDS, SAVE_EXPENSE_WORDS, TAG_SAME_WORDS, TAG_STANDS_WORDS, VENDORS_LOADING_WORDS,
  coveringTripWords, dayLongWords, expenseInput, expenseLandedWords, minutesCellWords, noTripRowWords, oneOffBody, outcomeWords, recordBody, rowPlannedMinutes, rowTripInput, vendorBody, withNotTried, zoneWords,
  type ExpenseDraft, type ExpenseField, type ExpenseOutcome, type LedgerColumn, type RowTripDraft, type RowTripField, type RowTripRead,
} from '@/lib/operations/ledger';
import { pastedVendorOf, vendorsOf, vendorsUnreadWords, type PasteVendor } from '@/lib/operations/pasteRows';
import { instagramTagKey } from '@/lib/operations/planVendor';
import { STAY_LOADING_WORDS, placeParts, type StayRow } from '@/lib/operations/stay';
import { readStays } from '../day/dayReads';
import { useOperationsEntity } from '../EntitySelector';
import ColumnBox from './ColumnBox'; // EDIT-01 (2026-11-28): the one box of a column — this row's boxes, and the sheet's open cell
import { setStopRecord } from '../stops/stopWrites';
import { createStay } from '../stays/stayWrites';
import { readJson } from '../week/weekReads';
import { addVendor, createOneOff, readOneOffLine, setLineMinutes, setVendor, setVendorTag } from './ledgerWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
/** The chip while the row is open — pressed: outlined in the brand's ink, no dark fill. Typed whole. */
const chipOn = 'px-2 py-0.5 border border-brand-purple text-brand-purple font-semibold rounded text-xs';
// EDIT-01 (Alex, 2026-11-28): the boxes' two classes stood here; they went with the boxes to ColumnBox.tsx — the one box of a column, which this
// row draws under every column he types and the sheet draws in a cell that opens. These three lines keep the file's line count, so ExpenseRow
// keeps the line the registry cites.
/** The blank row's light tint — both its rows. */
const ROW_TINT = 'bg-amber-50';

/** The vendors as read: still reading, read, or not readable — said in the read's own words, never taken as none. */
type VendorsRead = { readonly kind: 'reading' } | { readonly kind: 'read'; readonly vendors: readonly PasteVendor[] } | { readonly kind: 'failed'; readonly words: string };
/** The trip that covers DATE: no DATE yet, reading, read (the trip or none), or not readable. */
type TripRead = { readonly kind: 'no day' } | { readonly kind: 'reading' } | { readonly kind: 'read'; readonly covering: StayRow | null } | { readonly kind: 'failed'; readonly words: string };

/** "+ expense" — one tap opens the blank row at the top of the table, the next shuts it. */
export function ExpenseOpen({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button type="button" className={open ? chipOn : chip} onClick={onToggle} aria-pressed={open} data-ledger-expense-open>{EXPENSE_WORDS}</button>;
}

/** THE BLANK ROW and the row beneath it — mounted only while "+ expense" is open; the reads run then, not before. */
export default function ExpenseRow({ onWritten, close }: { onWritten: (day: string) => void; close: () => void }) {
  const { entities } = useOperationsEntity();
  const [zone, setZone] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_EXPENSE);
  const [vendorTyped, setVendorTyped] = useState('');
  const [trip, setTrip] = useState<RowTripDraft>(EMPTY_ROW_TRIP);
  const [vendorsRead, setVendorsRead] = useState<VendorsRead>({ kind: 'reading' });
  const [tripRead, setTripRead] = useState<TripRead>({ kind: 'no day' });
  /** Bumped after a save: both reads run again. */
  const [reads, setReads] = useState(0);
  const [refusal, setRefusal] = useState<{ readonly field: ExpenseField | RowTripField; readonly message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<readonly ExpenseOutcome[] | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  // The browser's zone, read on mount only — the server render has no business guessing it.
  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  // The book: the default one once the list is in, shown in its box — never a hidden choice.
  useEffect(() => {
    if (draft.book !== '' || entities.length === 0) return;
    const first = entities.find((e) => e.is_default) ?? entities[0];
    setDraft((d) => (d.book === '' ? { ...d, book: first.id } : d));
  }, [entities, draft.book]);
  // The vendors: the directory's GET, read by the paste's rule — each with the tag it carries. Read again after a save.
  useEffect(() => {
    let live = true;
    setVendorsRead({ kind: 'reading' });
    void (async () => {
      const listed = await readJson('/api/operations/vendor-directory');
      if (!live) return;
      if (!listed.ok) { setVendorsRead({ kind: 'failed', words: vendorsUnreadWords(listed.words) }); return; }
      const read = vendorsOf(listed.value);
      setVendorsRead(read.ok ? { kind: 'read', vendors: read.vendors } : { kind: 'failed', words: vendorsUnreadWords(read.words) });
    })();
    return () => { live = false; };
  }, [reads]);
  // The trip that covers DATE: the day card's own reader, once DATE is a day. Read again after a save.
  useEffect(() => {
    if (!isIsoDay(draft.day)) { setTripRead({ kind: 'no day' }); return; }
    let live = true;
    setTripRead({ kind: 'reading' });
    void (async () => {
      const read = await readStays(draft.day);
      if (!live) return;
      setTripRead(read.ok ? { kind: 'read', covering: read.value.covering } : { kind: 'failed', words: read.words });
    })();
    return () => { live = false; };
  }, [draft.day, reads]);

  const set = (field: keyof ExpenseDraft) => (value: string) => setDraft((d) => ({ ...d, [field]: value }));
  /** DATE — and TRIP ENDS follows it, in its box: never a hidden choice. */
  const setDay = (value: string) => { setDraft((d) => ({ ...d, day: value })); setTrip((t) => ({ ...t, endsOn: value })); };
  const setTripBox = (field: RowTripField) => (value: string) => setTrip((t) => ({ ...t, [field]: value }));
  const vendors = vendorsRead.kind === 'read' ? vendorsRead.vendors.filter((v) => v.entity_id === draft.book) : [];
  const covering = tripRead.kind === 'read' ? tripRead.covering : null;

  const save = async () => {
    if (busy || zone === null) return;
    const refuse = (field: ExpenseField | RowTripField, message: string) => setRefusal({ field, message });
    // (1) THE TRIP — while no trip covers DATE, its boxes are read (a refusal is said, nothing written). The covering trip must be read first.
    let tripToAdd: Extract<RowTripRead, { readonly kind: 'add' }> | null = null;
    if (isIsoDay(draft.day)) {
      if (tripRead.kind === 'failed') { refuse('city', tripRead.words); return; }
      if (tripRead.kind !== 'read') { refuse('city', STAY_LOADING_WORDS); return; }
      if (tripRead.covering === null) {
        const read = rowTripInput(trip, draft.day);
        if (read.kind === 'refused') { refuse(read.field, read.message); return; }
        if (read.kind === 'add') tripToAdd = read;
      }
    }
    // (2) VENDOR, typed — one of the book's by the paste's own rule, else new; none typed, none. A name typed while the vendors are unread is refused, never guessed.
    const typed = vendorTyped.trim();
    let vendorId = '';
    let vendorName = '';
    let carries: string | null = null;
    if (typed !== '') {
      if (vendorsRead.kind === 'reading') { refuse('vendor', VENDORS_LOADING_WORDS); return; }
      if (vendorsRead.kind === 'failed') { refuse('vendor', vendorsRead.words); return; }
      const picked = pastedVendorOf(typed, { id: draft.book }, vendorsRead.vendors);
      if (picked.kind === 'own') {
        const own = vendorsRead.vendors.find((v) => v.id === picked.id);
        if (own === undefined) throw new Error(`ExpenseForm: the vendor ${picked.id} the rule picked is not among the vendors read`);
        vendorId = own.id;
        carries = own.instagram_tag;
      } else if (picked.kind === 'new') {
        vendorName = picked.name;
      }
    }
    // (3) THE RULE — every box, the first bad one named.
    const read = expenseInput({ ...draft, vendorId, vendorName }, zone, new Date());
    if (!read.ok) { refuse(read.field, read.message); return; }
    setRefusal(null);
    setBusy(true);
    setOutcome(null);
    setLanded(null);
    const v = read.value;
    const done: ExpenseOutcome[] = [];
    const failed = (step: ExpenseOutcome['step'], words: string) => { done.push({ step, state: 'failed', words }); setOutcome(withNotTried(done)); };
    try {
      // 1. The trip — only on a date no trip covers, its place typed; else not asked. A request that never reached the route is its refusal, in the error's words.
      if (tripToAdd !== null) {
        let added: Awaited<ReturnType<typeof createStay>>;
        try {
          added = await createStay({ place: tripToAdd.place, starts_on: tripToAdd.startsOn, ends_on: tripToAdd.endsOn });
        } catch (error) {
          failed('trip', error instanceof Error ? error.message : String(error));
          return;
        }
        if (!added.ok) { failed('trip', added.message); return; }
        done.push({ step: 'trip', state: 'written', words: '' });
      } else {
        done.push({ step: 'trip', state: 'not asked', words: '' });
      }
      // 2. The one-off stop, with its one line; the line read back.
      const created = await createOneOff(oneOffBody(v));
      if (!created.ok) { failed('stop', created.words); return; }
      done.push({ step: 'stop', state: 'written', words: '' });
      const line = await readOneOffLine(created.value.routineId);
      if (!line.ok) { failed('line', line.words); return; }
      done.push({ step: 'line', state: 'written', words: '' });
      // 3. END's minutes, on the line; no END, not asked.
      if (v.minutes !== null) {
        const timed = await setLineMinutes(line.value.lineId, v.minutes);
        if (!timed.ok) { failed('minutes', timed.words); return; }
        done.push({ step: 'minutes', state: 'written', words: '' });
      } else {
        done.push({ step: 'minutes', state: 'not asked', words: '' });
      }
      // 4. The vendor — added when a new name was typed, then set on the line's occurrence; none typed, none asked.
      let onStop: string | null = v.vendor.kind === 'existing' ? v.vendor.id : null;
      if (v.vendor.kind === 'new') {
        const added = await addVendor(v.bookId, v.vendor.name);
        if (!added.ok) { failed('directory', added.words); return; }
        done.push({ step: 'directory', state: 'written', words: '' });
        onStop = added.value.vendorId;
      } else {
        done.push({ step: 'directory', state: 'not asked', words: '' });
      }
      if (onStop !== null) {
        const setAnswer = await setVendor(vendorBody(v, line.value.lineId, onStop));
        if (!setAnswer.ok) { failed('vendor', setAnswer.words); return; }
        done.push({ step: 'vendor', state: 'written', words: '' });
      } else {
        done.push({ step: 'vendor', state: 'not asked', words: '' });
      }
      // 5. The tag — only on a vendor that carries none; one that carries one STANDS, said in its own words; none typed, not asked.
      if (v.tag === null) {
        done.push({ step: 'tag', state: 'not asked', words: '' });
      } else if (onStop === null) {
        throw new Error('ExpenseForm: an INSTAGRAM TAG with no vendor on the stop — the rule refuses one before any write (TAG_NEEDS_VENDOR_WORDS)');
      } else if (carries !== null) {
        done.push({ step: 'tag', state: 'stands', words: instagramTagKey(carries) === instagramTagKey(v.tag) ? TAG_SAME_WORDS(v.tag) : TAG_STANDS_WORDS(carries) });
      } else {
        const tagged = await setVendorTag(onStop, v.tag);
        if (!tagged.ok) { failed('tag', tagged.words); return; }
        done.push({ step: 'tag', state: 'written', words: '' });
      }
      // 6. The record, through the one writer — a charge on its date takes none, a stop ahead is planned, else the record with its NOTES and LOGGED MIN.
      if (v.allDay) {
        done.push({ step: 'record', state: 'charge', words: '' });
      } else if (v.ahead) {
        done.push({ step: 'record', state: 'ahead', words: '' });
      } else {
        let record: Awaited<ReturnType<typeof setStopRecord>>;
        try {
          record = await setStopRecord(recordBody(v, line.value.lineId));
        } catch (error) {
          failed('record', error instanceof Error ? error.message : String(error));
          return;
        }
        if (!record.ok) { failed('record', record.message); return; }
        done.push({ step: 'record', state: 'written', words: '' });
      }
      setOutcome(done);
      setLanded(v.day);
      // The row clears — the book kept — and stays open for the next one; both reads run again.
      setDraft((d) => ({ ...EMPTY_EXPENSE, book: d.book }));
      setVendorTyped('');
      setTrip(EMPTY_ROW_TRIP);
      setReads((n) => n + 1);
      onWritten(v.day);
    } finally {
      setBusy(false);
    }
  };

  /** Enter in a box saves. */
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
    e.preventDefault();
    void save();
  };

  /** What stands under one column of the sheet — a box he types, the rule's work as he types, the covering trip, or the sheet's blank until the row is saved. */
  const cellOf = (key: LedgerColumn): ReactNode => {
    switch (key) {
      case 'day': return isIsoDay(draft.day) ? dayLongWords(draft.day) : null;
      case 'date': return <ColumnBox column="date" value={draft.day} onChange={setDay} />;
      case 'start': return <ColumnBox column="start" value={draft.time} onChange={set('time')} />;
      case 'end': return <ColumnBox column="end" value={draft.end} onChange={set('end')} />;
      case 'city': {
        if (covering !== null) return <span title={coveringTripWords(covering)} data-ledger-expense-trip-part="city">{placeParts(covering.place).city}</span>;
        if (tripRead.kind === 'failed') return <span className="text-brand-red" data-ledger-expense-trip-failed>{tripRead.words}</span>;
        return <ColumnBox column="city" value={trip.city} onChange={setTripBox('city')} />;
      }
      case 'region': {
        if (covering !== null) { const part = placeParts(covering.place).region; return <span title={coveringTripWords(covering)} data-ledger-expense-trip-part="region">{part === null ? BLANK : part}</span>; }
        if (tripRead.kind === 'failed') return null;
        return <ColumnBox column="region" value={trip.region} onChange={setTripBox('region')} />;
      }
      case 'country': {
        if (covering !== null) { const part = placeParts(covering.place).country; return <span title={coveringTripWords(covering)} data-ledger-expense-trip-part="country">{part === null ? BLANK : part}</span>; }
        if (tripRead.kind === 'failed') return null;
        return <ColumnBox column="country" value={trip.country} onChange={setTripBox('country')} />;
      }
      case 'location': return <ColumnBox column="location" value={draft.location} onChange={set('location')} />;
      // CATEGORY is the book's chart, in a group that carries the box's word (ColumnBox).
      case 'accountName': return <ColumnBox column="accountName" value={draft.coa} onChange={set('coa')} entityId={draft.book} />;
      case 'book': return entities.length === 0
        ? <span className="text-brand-amber" data-ledger-expense-no-book>{NO_BOOK_WORDS}</span>
        : <ColumnBox column="book" value={draft.book} onChange={set('book')} books={entities} />;
      case 'subAccountName': return <ColumnBox column="subAccountName" value={draft.name} onChange={set('name')} />;
      case 'description': return <ColumnBox column="description" value={draft.note} onChange={set('note')} />;
      case 'vendor': return <ColumnBox column="vendor" value={vendorTyped} onChange={setVendorTyped} vendors={vendors} listId="ledger-expense-vendors" />;
      case 'instagramTag': return <ColumnBox column="instagramTag" value={draft.tag} onChange={set('tag')} />;
      case 'went': return <span title={ROW_LATER_WORDS} data-ledger-expense-later>{ROW_LATER_MARK}</span>;
      case 'stars': return <ColumnBox column="stars" value={draft.stars} onChange={set('stars')} />;
      case 'plannedMinutes': return <span data-ledger-expense-planned-minutes>{minutesCellWords(rowPlannedMinutes(draft))}</span>;
      case 'loggedMinutes': return <ColumnBox column="loggedMinutes" value={draft.logged} onChange={set('logged')} />;
      case 'account': return <span title={ROW_LATER_WORDS} data-ledger-expense-later>{ROW_LATER_MARK}</span>;
      case 'budget': return <ColumnBox column="budget" value={draft.amount} onChange={set('amount')} />;
      case 'actual': return <ColumnBox column="actual" value={draft.actual} onChange={set('actual')} />;
      case 'variance': return <span title={ROW_LATER_WORDS} data-ledger-expense-later>{ROW_LATER_MARK}</span>;
      case 'match': return <span title={ROW_LATER_WORDS} data-ledger-expense-later>{ROW_LATER_MARK}</span>;
      case 'underOver': return <span title={ROW_LATER_WORDS} data-ledger-expense-later>{ROW_LATER_MARK}</span>;
      case 'notes': return <ColumnBox column="notes" value={draft.notes} onChange={set('notes')} />;
      default: { const none: never = key; throw new Error(`ExpenseForm: no cell for the column ${String(none)}`); }
    }
  };

  return (
    <>
      <tr className={`border-t border-border ${ROW_TINT}`} onKeyDown={onKeyDown} data-ledger-expense-form>
        {LEDGER_COLUMNS.map((key) => <td key={key} className={`${cell} align-middle`} data-ledger-expense-cell={key}>{cellOf(key)}</td>)}
      </tr>
      <tr className={`border-t border-border ${ROW_TINT}`} data-ledger-expense-said>
        <td colSpan={LEDGER_COLUMNS.length} className={cell}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" className={chip} disabled={busy || zone === null} aria-busy={busy} onClick={save} data-ledger-expense-save>{SAVE_EXPENSE_WORDS}</button>
            <button type="button" className={chip} disabled={busy} onClick={close} data-ledger-expense-cancel>{CANCEL_EXPENSE_WORDS}</button>
            {zone !== null && <span className="text-text-muted" data-ledger-expense-zone>{zoneWords(zone)}</span>}
            {covering !== null && <span className="text-text-muted" data-ledger-expense-trip>{coveringTripWords(covering)}</span>}
            {tripRead.kind === 'read' && covering === null && (
              <span className="inline-flex items-center gap-1 text-text-muted" data-ledger-expense-trip-none>
                <span>{noTripRowWords(draft.day)}</span>
                <input type="date" value={trip.endsOn} onChange={(e) => setTripBox('endsOn')(e.target.value)} aria-label={ROW_TRIP_FIELD_WORDS.endsOn} className="px-1 py-0.5 border border-border rounded text-xs bg-white" data-ledger-expense-trip-ends />
              </span>
            )}
            {refusal !== null && <span className="text-brand-red" data-ledger-expense-refused={refusal.field}>{refusal.message}</span>}
          </div>
          {outcome !== null && (
            <ul className="space-y-0.5 text-xs mt-1" data-ledger-expense-outcome>
              {outcome.map((o) => <li key={o.step} className={o.state === 'failed' ? 'text-brand-red' : o.state === 'written' ? 'text-brand-green' : 'text-text-muted'} data-ledger-expense-step={o.step} data-ledger-expense-state={o.state}>{outcomeWords(o)}</li>)}
            </ul>
          )}
          {landed !== null && <p className="text-xs text-text-muted" data-ledger-expense-landed>{expenseLandedWords(landed)}</p>}
        </td>
      </tr>
    </>
  );
}
