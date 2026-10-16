/**
 * ExpenseForm — "+ expense" on the city ledger (RETRO-01, Alex, 2026-10-16).
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
 * outcome lists all five steps — written, not written with the route's words,
 * not tried, or none given — never a silent retry, never a silent roll-back.
 * On success the caller is told the day (the ledger reads again; the card is
 * told through dayWritten.ts). The books are the provider's list (the entity
 * selector's choice is not read); the COA list is the book's (CoaSelect); the
 * vendors are the directory's (budget/DayPlanDrill.tsx useDirectory), the
 * book's own. Nothing is stored in the browser.
 */

'use client';

import { useEffect, useState } from 'react';
import { useDirectory } from '@/components/budget/DayPlanDrill';
import {
  CANCEL_EXPENSE_WORDS, EMPTY_EXPENSE, EXPENSE_FIELD_WORDS, EXPENSE_TITLE_WORDS, EXPENSE_WORDS, NEW_VENDOR_WORDS, NO_BOOK_WORDS, NO_VENDOR_WORDS, SAVE_EXPENSE_WORDS, VENDORS_LOADING_WORDS,
  expenseInput, expenseLandedWords, oneOffBody, outcomeWords, recordBody, vendorBody, withNotTried, zoneWords,
  type ExpenseDraft, type ExpenseField, type ExpenseOutcome,
} from '@/lib/operations/ledger';
import { useOperationsEntity } from '../EntitySelector';
import CoaSelect from '../routines/CoaSelect';
import { setStopRecord } from '../stops/stopWrites';
import { addVendor, createOneOff, readOneOffLine, setVendor } from './ledgerWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs';
const label = 'text-text-faint tracking-wide';

export default function ExpenseForm({ onWritten }: { onWritten: (day: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2" data-ledger-expense>
      {!open && <button type="button" className={chip} onClick={() => setOpen(true)} data-ledger-expense-open>{EXPENSE_WORDS}</button>}
      {open && <Fields onWritten={onWritten} close={() => setOpen(false)} />}
    </div>
  );
}

/** The boxes, mounted only while the form is open — the directory is read then, not before. */
function Fields({ onWritten, close }: { onWritten: (day: string) => void; close: () => void }) {
  const { entities } = useOperationsEntity();
  const directory = useDirectory();
  const [zone, setZone] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(EMPTY_EXPENSE);
  const [refusal, setRefusal] = useState<{ readonly field: ExpenseField; readonly message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<readonly ExpenseOutcome[] | null>(null);
  const [landed, setLanded] = useState<string | null>(null);

  // The browser's zone, read on mount only — the server render has no business guessing it.
  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);
  // The book: the default one once the list is in, shown in the box — never a hidden choice.
  useEffect(() => {
    if (draft.book !== '' || entities.length === 0) return;
    const first = entities.find((e) => e.is_default) ?? entities[0];
    setDraft((d) => (d.book === '' ? { ...d, book: first.id } : d));
  }, [entities, draft.book]);

  const vendors = directory.vendors === null ? null : directory.vendors.filter((v) => v.entity_id === draft.book);
  const set = (field: keyof ExpenseDraft) => (value: string) => setDraft((d) => ({ ...d, [field]: value }));

  const save = async () => {
    if (busy || zone === null) return;
    const read = expenseInput(draft, zone);
    if (!read.ok) { setRefusal(read); return; }
    setRefusal(null);
    setBusy(true);
    setOutcome(null);
    setLanded(null);
    const v = read.value;
    const done: ExpenseOutcome[] = [];
    const failed = (step: ExpenseOutcome['step'], words: string) => { done.push({ step, state: 'failed', words }); setOutcome(withNotTried(done)); };
    try {
      // 1. The one-off stop, with its one line.
      const created = await createOneOff(oneOffBody(v));
      if (!created.ok) { failed('stop', created.words); return; }
      done.push({ step: 'stop', state: 'written', words: '' });
      const line = await readOneOffLine(created.value.routineId);
      if (!line.ok) { failed('line', line.words); return; }
      done.push({ step: 'line', state: 'written', words: '' });
      // 2. The vendor — added when a new name was given, then set on the line's occurrence; none given, none asked.
      let vendorId: string | null = v.vendor.kind === 'existing' ? v.vendor.id : null;
      if (v.vendor.kind === 'new') {
        const added = await addVendor(v.bookId, v.vendor.name);
        if (!added.ok) { failed('directory', added.words); return; }
        done.push({ step: 'directory', state: 'written', words: '' });
        vendorId = added.value.vendorId;
      } else {
        done.push({ step: 'directory', state: 'not asked', words: '' });
      }
      if (vendorId !== null) {
        const setAnswer = await setVendor(vendorBody(v, line.value.lineId, vendorId));
        if (!setAnswer.ok) { failed('vendor', setAnswer.words); return; }
        done.push({ step: 'vendor', state: 'written', words: '' });
      } else {
        done.push({ step: 'vendor', state: 'not asked', words: '' });
      }
      // 3. The record, through the one writer.
      let record: Awaited<ReturnType<typeof setStopRecord>>;
      try {
        record = await setStopRecord(recordBody(v, line.value.lineId));
      } catch (error) {
        failed('record', error instanceof Error ? error.message : String(error));
        return;
      }
      if (!record.ok) { failed('record', record.message); return; }
      done.push({ step: 'record', state: 'written', words: '' });
      setOutcome(done);
      setLanded(v.day);
      setDraft((d) => ({ ...EMPTY_EXPENSE, book: d.book }));
      onWritten(v.day);
    } finally {
      setBusy(false);
    }
  };

  const field = (name: ExpenseField, control: React.ReactNode) => (
    <label className="flex items-center gap-1" data-ledger-expense-field={name}>
      <span className={label}>{EXPENSE_FIELD_WORDS[name]}</span>
      {control}
    </label>
  );

  return (
    <div className="space-y-2 text-xs border border-border rounded p-2 bg-white" data-ledger-expense-form>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text-secondary">{EXPENSE_TITLE_WORDS}</span>
        {zone !== null && <span className="text-text-muted" data-ledger-expense-zone>{zoneWords(zone)}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {field('day', <input type="date" value={draft.day} onChange={(e) => set('day')(e.target.value)} className={box} data-ledger-expense-day />)}
        {field('time', <input type="text" inputMode="numeric" value={draft.time} onChange={(e) => set('time')(e.target.value)} placeholder="HH:MM" maxLength={5} className={`${box} w-16 font-mono`} data-ledger-expense-time />)}
        {field('name', <input type="text" value={draft.name} onChange={(e) => set('name')(e.target.value)} className={`${box} w-44`} maxLength={200} data-ledger-expense-name />)}
        {field('amount', <input type="text" inputMode="decimal" value={draft.amount} onChange={(e) => set('amount')(e.target.value)} className={`${box} w-20 font-mono tabular-nums`} data-ledger-expense-amount />)}
        {field('book', entities.length === 0
          ? <span className="text-brand-amber" data-ledger-expense-no-book>{NO_BOOK_WORDS}</span>
          : <select value={draft.book} onChange={(e) => set('book')(e.target.value)} className={box} data-ledger-expense-book>{entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>)}
        {field('coa', <CoaSelect entityId={draft.book} value={draft.coa} onChange={set('coa')} className={box} />)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {field('vendor', vendors === null
          ? <span className="text-text-muted" data-ledger-expense-vendors-loading>{directory.words ?? VENDORS_LOADING_WORDS}</span>
          : <select value={draft.vendorId} onChange={(e) => set('vendorId')(e.target.value)} className={box} data-ledger-expense-vendor><option value="">{NO_VENDOR_WORDS}</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.vendor_name}</option>)}</select>)}
        <span className={label}>{NEW_VENDOR_WORDS}</span>
        <input type="text" value={draft.vendorName} onChange={(e) => set('vendorName')(e.target.value)} className={`${box} w-40`} data-ledger-expense-vendor-name />
        {field('actual', <input type="text" inputMode="decimal" value={draft.actual} onChange={(e) => set('actual')(e.target.value)} className={`${box} w-20 font-mono tabular-nums`} data-ledger-expense-actual />)}
        {field('stars', <input type="text" inputMode="numeric" value={draft.stars} onChange={(e) => set('stars')(e.target.value)} className={`${box} w-10`} maxLength={1} data-ledger-expense-stars />)}
        {field('note', <input type="text" value={draft.note} onChange={(e) => set('note')(e.target.value)} className={`${box} w-56`} maxLength={280} data-ledger-expense-note />)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} disabled={busy || zone === null} aria-busy={busy} onClick={save} data-ledger-expense-save>{SAVE_EXPENSE_WORDS}</button>
        <button type="button" className={chip} disabled={busy} onClick={close} data-ledger-expense-cancel>{CANCEL_EXPENSE_WORDS}</button>
        {refusal !== null && <span className="text-brand-red" data-ledger-expense-refused={refusal.field}>{refusal.message}</span>}
      </div>
      {outcome !== null && (
        <ul className="space-y-0.5" data-ledger-expense-outcome>
          {outcome.map((o) => <li key={o.step} className={o.state === 'failed' ? 'text-brand-red' : o.state === 'written' ? 'text-brand-green' : 'text-text-muted'} data-ledger-expense-step={o.step} data-ledger-expense-state={o.state}>{outcomeWords(o)}</li>)}
        </ul>
      )}
      {landed !== null && <p className="text-text-muted" data-ledger-expense-landed>{expenseLandedWords(landed)}</p>}
    </div>
  );
}
