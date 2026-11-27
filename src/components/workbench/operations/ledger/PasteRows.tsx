/**
 * PasteRows — "+ paste rows from a sheet" on the time sheet (PASTE-01, Alex, 2026-11-25).
 *
 * The rows of his spreadsheet, pasted with its header row, READ AND PLACED HERE — and, since PASTE-02, SAVED from here. A chip
 * under "+ expense" opens a box, mounted only while it is open: its title and the zone its times are read in, how to paste, the
 * textarea, then "read the rows", "clear" and "close", with any refusal in red beside them. "read the rows" hands the text to the
 * rule (src/lib/operations/pasteRows.ts readPaste) and then reads what the paste is placed against — ONE read function, by GET
 * only, each read awaited: the sheet's own span rule first (ledger.ts spanInput: its refusal is shown and nothing is sent), then
 *   · the time sheet's answer for those days (ledgerReads.ts readLedger);
 *   · each offered book's chart (week/weekReads.ts readJson over the chart route; a chart that cannot be read is said with the
 *     book's name, never shown as an empty list);
 *   · the vendors (readJson over the directory route, through pasteRows.ts vendorsOf; a list that cannot be read is said);
 *   · the books (the provider's list).
 * The clock is the browser's, read once per read; the zone is the browser's, read on mount.
 *
 * Then, in order: the lines naming the columns not read; the one line of counts; the picks — one select a kind of row, nothing
 * chosen for him; the save box; and the table, every row twice on one line (YOUR SHEET, ON THE TIME SHEET) with where it LANDS
 * last and, under that, how the row came out of a save. A pick places every row again, at once (pasteRows.ts placePaste — pure).
 *
 * PASTE-02 (Alex, 2026-11-27) — THE SAVE. Until then this leaf wrote nothing, read the vendors through the Budget's hook
 * (budget/VendorBox.tsx useDirectory), and a new read forgot the picks. Now:
 *   · the picks live in the outer component: kept through a read and through closing the box; "clear" forgets them. React
 *     state only — nothing is stored. After a read a pick is applied, and shown in its select, only while it still stands
 *     (pasteRows.ts standingPicks);
 *   · ONE button over the table says what it writes. Pressing it reads everything again first — the same one read function —
 *     and places the rows again with the same picks. If the table's rows are no longer what was on screen at the press, NOTHING
 *     is written: the rows are shown placed again, and a line says so. Else the writes of the new placements are run by the ONE
 *     runner (src/lib/operations/pasteSave.ts runPaste), handed the six writers — ledgerWrites.ts's five and the stops' one.
 *     This leaf calls no writer itself, and sends no request of its own;
 *   · each row says how it came out, under where it lands. A write a route refuses stops the save; nothing is retried or undone;
 *   · every day a write reached is handed up, once (onWritten): the time sheet above reads again and the day's card is told;
 *   · after a run there is no save until the rows are read again — what is in is never written twice.
 * Every sentence printed here is typed in one of the two rule files; the zone's line is "+ expense"'s own (ledger.ts zoneWords).
 */

'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { cellClass as cell, chipClass as chip, headClass as head, moneyClass as money } from '@/components/table/DataTable';
import { spanInput, zoneWords } from '@/lib/operations/ledger';
import {
  LANDS_WORDS, ON_TIME_SHEET_COLUMNS, ON_TIME_SHEET_WORDS, PASTE_CLEAR_WORDS, PASTE_CLOSE_WORDS, PASTE_HOW_WORDS, PASTE_NO_PICK_WORDS, PASTE_ONE_OFF_WORDS, PASTE_ON_PLAN_WORDS,
  PASTE_OPEN_WORDS, PASTE_PICKS_WORDS, PASTE_READ_WORDS, PASTE_TITLE_WORDS, YOUR_SHEET_COLUMNS, YOUR_SHEET_WORDS,
  accountWords, chartOf, chartUnreadWords, countsWords, notReadLines, offeredBooksOf, pasteKindsOf, pasteShown, pasteSpanOf, pickOfValue, pickOffersOf, pickValueOf, placePaste, readPaste, standingPicks,
  vendorsOf, vendorsUnreadWords,
  type Paste, type PasteAccount, type PasteBook, type PasteColumn, type PasteContext, type PastePick, type PasteTone,
} from '@/lib/operations/pasteRows';
import {
  CHANGED_WORDS, CHECKING_WORDS, NOTHING_TO_SAVE_WORDS, SPENT_WORDS, VENDORS_STAY_WORDS,
  daysReached, newVendorLines, pasteOutcomeWords, pasteWritesOf, runPaste, runStopped, runWords, saveWords, savingWords, shownChanged,
  type PasteOutcome, type PasteProgress,
} from '@/lib/operations/pasteSave';
import { useOperationsEntity } from '../EntitySelector';
import { setStopRecord } from '../stops/stopWrites';
import { readJson, type Read } from '../week/weekReads';
import { readLedger } from './ledgerReads';
import { addVendor, createOneOff, readOneOffLine, setLineMinutes, setVendor } from './ledgerWrites';

const box = 'px-1.5 py-0.5 border border-border rounded text-xs';
const label = 'text-text-faint tracking-wide';
/** A row's class by its tone, each typed whole: placed in the table's own ink; waiting for a pick amber; refused red; a booking and a blank date muted. */
const ROW_CLASS: Readonly<Record<PasteTone, string>> = {
  placed: 'border-t border-border',
  pick: 'border-t border-border text-brand-amber',
  refused: 'border-t border-border text-brand-red',
  quiet: 'border-t border-border text-text-muted',
};
/** How a row came out of a save, by its state — green · red · muted, as "+ expense" colours its steps. */
const SAVED_CLASS: Readonly<Record<PasteOutcome['state'], string>> = {
  written: 'text-brand-green',
  failed: 'text-brand-red',
  'not tried': 'text-text-muted',
};
/** A column's cell in the shared table's classes: money set right, a short cell kept on one line. */
const cellOf = (column: PasteColumn): string => (column.money ? money : column.short ? `${cell} whitespace-nowrap` : cell);
const headOf = (column: PasteColumn): string => (column.money ? `${head} text-right` : head);

/** The picks he has made, by a kind's key. */
type Picks = Readonly<Record<string, PastePick>>;

export default function PasteRows({ onWritten }: { onWritten: (days: readonly string[]) => void }) {
  const [open, setOpen] = useState(false);
  // PASTE-02: the picks live here, above the box — kept through a read and through closing the box. React state only: nothing is stored.
  const [picks, setPicks] = useState<Picks>({});
  return (
    <div className="space-y-2" data-ledger-paste>
      {!open && <button type="button" className={chip} onClick={() => setOpen(true)} data-ledger-paste-open>{PASTE_OPEN_WORDS}</button>}
      {open && <Box close={() => setOpen(false)} picks={picks} setPicks={setPicks} onWritten={onWritten} />}
    </div>
  );
}

/** A paste as it was read, with everything its rows are placed against. */
interface ReadRows {
  readonly paste: Paste;
  readonly context: PasteContext;
}

/**
 * THE ONE READ FUNCTION — what a paste is placed against, read by GET, each read awaited; the browser's clock, read once per read.
 * "read the rows" and the save's second read are this one function, so both hold the time sheet, the charts and the vendors as
 * they stand at that moment. The sheet's own span rule first: its refusal is the answer, and nothing is sent. A read that fails
 * is said in its own words — a chart with its book's name — and never taken as an empty list.
 */
async function readAgainst(paste: Paste, books: readonly PasteBook[], zone: string): Promise<Read<PasteContext>> {
  const now = new Date();
  // The days the readable rows cover. No readable row: no row is placed against anything, so nothing is read.
  const span = pasteSpanOf(paste);
  if (span === null) return { ok: true, value: { books, sheet: [], recording: {}, charts: {}, vendors: [], zone, now } };
  const days = spanInput(span.from, span.to);
  if (!days.ok) return { ok: false, words: days.message };
  const ledger = await readLedger(days.from, days.to);
  if (!ledger.ok) return { ok: false, words: ledger.words };
  const charts: Record<string, readonly PasteAccount[]> = {};
  for (const book of offeredBooksOf(books)) {
    const answer = await readJson(`/api/chart-of-accounts?entity_id=${encodeURIComponent(book.id)}`);
    if (!answer.ok) return { ok: false, words: chartUnreadWords(book.name, answer.words) };
    const chart = chartOf(answer.value);
    if (!chart.ok) return { ok: false, words: chartUnreadWords(book.name, chart.words) };
    charts[book.id] = chart.accounts;
  }
  const listed = await readJson('/api/operations/vendor-directory');
  if (!listed.ok) return { ok: false, words: vendorsUnreadWords(listed.words) };
  const vendors = vendorsOf(listed.value);
  if (!vendors.ok) return { ok: false, words: vendorsUnreadWords(vendors.words) };
  return { ok: true, value: { books, sheet: ledger.value.sheet, recording: ledger.value.recording, charts, vendors: vendors.vendors, zone, now } };
}

/**
 * Every row placed against what was read, by the picks that still stand — and what a save of them would write. The two rules',
 * pure: nothing here decides where a row lands or what is written.
 */
function placedOf(read: ReadRows, picks: Picks) {
  const kinds = pasteKindsOf(read.paste);
  const standing = standingPicks(picks, kinds, read.context);
  const placed = placePaste(read.paste, standing, read.context);
  const writes = pasteWritesOf(read.paste.rows, placed);
  return { kinds, standing, counts: countsWords(placed), table: pasteShown(read.paste, placed), notRead: notReadLines(read.paste), writes, newVendors: newVendorLines(writes) };
}

/** The box, mounted only while it is open. The picks are the outer component's, handed in with their setter. */
function Box({ close, picks, setPicks, onWritten }: { close: () => void; picks: Picks; setPicks: Dispatch<SetStateAction<Picks>>; onWritten: (days: readonly string[]) => void }) {
  const { entities } = useOperationsEntity();
  const [zone, setZone] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ReadRows | null>(null);
  /** THE SAVE: where it is while it runs ('checking' — reading again; then the row being written); each row's outcome as it comes, and whether the run has finished; whether the time sheet had changed. */
  const [saving, setSaving] = useState<'checking' | NonNullable<PasteProgress['at']> | null>(null);
  const [run, setRun] = useState<{ readonly outcomes: readonly PasteOutcome[]; readonly done: boolean } | null>(null);
  const [changed, setChanged] = useState(false);

  // The browser's zone, read on mount only — the server render has no business guessing it.
  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);

  /** The books as the provider lists them. */
  const booksNow = (): PasteBook[] => entities.map((e) => ({ id: e.id, name: e.name, entityType: e.entity_type }));

  const read = async () => {
    if (busy || zone === null) return;
    // A new read forgets the rows, the run and the changed line of the one before — never the picks.
    setRefusal(null);
    setRows(null);
    setRun(null);
    setChanged(false);
    const paste = readPaste(text);
    if (!paste.ok) { setRefusal(paste.words); return; }
    setBusy(true);
    try {
      const against = await readAgainst(paste.value, booksNow(), zone);
      if (!against.ok) { setRefusal(against.words); return; }
      setRows({ paste: paste.value, context: against.value });
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setText('');
    setRefusal(null);
    setRows(null);
    setRun(null);
    setChanged(false);
    setPicks({});
  };

  /** A pick for a kind — or none again: every row is placed again, at once. */
  const pick = (kind: string, value: string) => setPicks((held) => {
    const chosen = pickOfValue(value);
    const next: Record<string, PastePick> = {};
    for (const [key, standing] of Object.entries(held)) if (key !== kind) next[key] = standing;
    if (chosen !== null) next[kind] = chosen;
    return next;
  });

  // Every row placed against what was read, by the picks as they stand — nothing here decides where a row lands.
  const shown = useMemo(() => (rows === null ? null : placedOf(rows, picks)), [rows, picks]);
  /** A run has finished: there is no save until the rows are read again. */
  const spent = run !== null && run.done;

  const save = async () => {
    if (busy || zone === null || rows === null || shown === null || spent || shown.writes.length === 0) return;
    // (1) Busy from the press on — set before the first await.
    setBusy(true);
    setRefusal(null);
    setChanged(false);
    setSaving('checking');
    try {
      // (2) The one read function, again. A read that fails is said by the buttons, and nothing is written.
      const against = await readAgainst(rows.paste, booksNow(), zone);
      if (!against.ok) { setRefusal(against.words); return; }
      // (3) The rows placed again with the same picks, and shown.
      const again: ReadRows = { paste: rows.paste, context: against.value };
      const placed = placedOf(again, picks);
      setRows(again);
      // (4) The table's rows are not what was on screen at the press: the changed line, and nothing is written.
      if (shownChanged(shown.table, placed.table)) { setChanged(true); return; }
      // (5) The writes of the NEW placements, run by the one runner through the six writers. This leaf calls no writer itself.
      const outcomes = await runPaste(placed.writes, { createOneOff, readOneOffLine, setLineMinutes, addVendor, setVendor, setRecord: setStopRecord }, (progress) => {
        setRun({ outcomes: progress.outcomes, done: false });
        setSaving(progress.at);
      });
      setRun({ outcomes, done: true });
      // (6) Every day a write reached, handed up once: the time sheet reads again, and the day's card is told.
      onWritten(daysReached(placed.writes, outcomes));
    } finally {
      setSaving(null);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 text-xs border border-border rounded p-2 bg-white" data-ledger-paste-box>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text-secondary">{PASTE_TITLE_WORDS}</span>
        {zone !== null && <span className="text-text-muted" data-ledger-paste-zone>{zoneWords(zone)}</span>}
      </div>
      <p className="text-text-muted" data-ledger-paste-how>{PASTE_HOW_WORDS}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} spellCheck={false} disabled={busy} aria-label={PASTE_HOW_WORDS} className={`${box} w-full font-mono whitespace-pre`} data-ledger-paste-text />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} disabled={busy || zone === null} aria-busy={busy} onClick={read} data-ledger-paste-read>{PASTE_READ_WORDS}</button>
        <button type="button" className={chip} disabled={busy} onClick={clear} data-ledger-paste-clear>{PASTE_CLEAR_WORDS}</button>
        <button type="button" className={chip} disabled={busy} onClick={close} data-ledger-paste-close>{PASTE_CLOSE_WORDS}</button>
        {refusal !== null && <span className="text-brand-red" data-ledger-paste-refused>{refusal}</span>}
      </div>
      {rows !== null && shown !== null && (
        <>
          {shown.notRead.map((line) => <p key={line} className="text-text-muted" data-ledger-paste-not-read>{line}</p>)}
          <p className="font-semibold text-text-secondary" data-ledger-paste-counts>{shown.counts}</p>
          {shown.kinds.length > 0 && (
            <div className="space-y-1" data-ledger-paste-picks>
              <p className="text-text-muted">{PASTE_PICKS_WORDS}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {shown.kinds.map((kind) => {
                  const offers = pickOffersOf(kind, rows.context);
                  return (
                    <label key={kind.key} className="flex items-center gap-1" data-ledger-paste-kind={kind.key}>
                      <span className={label}>{kind.label}</span>
                      <span className="text-text-faint tabular-nums" data-ledger-paste-kind-rows>{kind.rows}</span>
                      <select value={pickValueOf(shown.standing[kind.key])} disabled={busy || offers === null} onChange={(e) => pick(kind.key, e.target.value)} className={box} data-ledger-paste-pick>
                        <option value="">{PASTE_NO_PICK_WORDS}</option>
                        {offers !== null && offers.plans.length > 0 && (
                          <optgroup label={PASTE_ON_PLAN_WORDS}>
                            {offers.plans.map((plan) => <option key={plan} value={pickValueOf({ kind: 'plan', plan })}>{plan}</option>)}
                          </optgroup>
                        )}
                        {offers !== null && offers.accounts.length > 0 && (
                          <optgroup label={PASTE_ONE_OFF_WORDS}>
                            {offers.accounts.map((account) => <option key={account.code} value={pickValueOf({ kind: 'oneOff', code: account.code })}>{accountWords(account)}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="space-y-1" data-ledger-paste-save-box>
            {!spent && shown.newVendors.map((line) => <p key={line} className="text-text-muted" data-ledger-paste-new-vendors>{line}</p>)}
            {!spent && shown.newVendors.length > 0 && <p className="text-brand-amber" data-ledger-paste-vendors-stay>{VENDORS_STAY_WORDS}</p>}
            {!spent && shown.writes.length > 0 && <button type="button" className={chip} disabled={busy} aria-busy={saving !== null} onClick={save} data-ledger-paste-save>{saveWords(shown.writes)}</button>}
            {!spent && shown.writes.length === 0 && <p className="text-text-muted" data-ledger-paste-nothing>{NOTHING_TO_SAVE_WORDS}</p>}
            {saving === 'checking' && <p className="text-text-muted" data-ledger-paste-checking>{CHECKING_WORDS}</p>}
            {saving !== null && saving !== 'checking' && <p className="text-text-muted" data-ledger-paste-saving>{savingWords(saving.i, saving.of, saving.row)}</p>}
            {changed && <p className="text-brand-red" data-ledger-paste-changed>{CHANGED_WORDS}</p>}
            {run !== null && run.done && <p className={runStopped(run.outcomes) ? 'text-brand-red' : 'text-brand-green'} data-ledger-paste-saved-line>{runWords(run.outcomes)}</p>}
            {spent && <p className="text-text-muted" data-ledger-paste-spent>{SPENT_WORDS}</p>}
          </div>
          <div className="overflow-x-auto border border-border rounded bg-white">
            <table className="w-full border-collapse text-xs" data-ledger-paste-table>
              <thead>
                <tr className="text-text-faint uppercase tracking-wide">
                  <th colSpan={YOUR_SHEET_COLUMNS.length} className={head} data-ledger-paste-group="yours">{YOUR_SHEET_WORDS}</th>
                  <th colSpan={ON_TIME_SHEET_COLUMNS.length} className={`${head} border-l border-border`} data-ledger-paste-group="sheet">{ON_TIME_SHEET_WORDS}</th>
                  <th rowSpan={2} className={`${head} border-l border-border align-bottom`} data-ledger-paste-group="lands">{LANDS_WORDS}</th>
                </tr>
                <tr className="text-text-faint uppercase tracking-wide">
                  {YOUR_SHEET_COLUMNS.map((column) => <th key={column.head} className={headOf(column)}>{column.head}</th>)}
                  {ON_TIME_SHEET_COLUMNS.map((column, i) => <th key={column.head} className={i === 0 ? `${headOf(column)} border-l border-border` : headOf(column)}>{column.head}</th>)}
                </tr>
              </thead>
              <tbody>
                {shown.table.map((row) => {
                  // How this row came out of the save — while it runs, as each row is written; after it, every row a write was made for.
                  const outcome = run === null ? undefined : run.outcomes.find((o) => o.row === row.number);
                  return (
                    <tr key={row.number} className={ROW_CLASS[row.tone]} data-ledger-paste-row={row.number} data-ledger-paste-tone={row.tone}>
                      {row.yours.map((words, i) => <td key={YOUR_SHEET_COLUMNS[i].head} className={cellOf(YOUR_SHEET_COLUMNS[i])}>{words}</td>)}
                      {row.sheet.map((words, i) => <td key={ON_TIME_SHEET_COLUMNS[i].head} className={i === 0 ? `${cellOf(ON_TIME_SHEET_COLUMNS[i])} border-l border-border` : cellOf(ON_TIME_SHEET_COLUMNS[i])}>{words}</td>)}
                      <td className={`${cell} border-l border-border`} data-ledger-paste-lands>
                        <span>{row.lands}</span>
                        {outcome !== undefined && <div className={SAVED_CLASS[outcome.state]} data-ledger-paste-saved={outcome.state}>{pasteOutcomeWords(outcome)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
