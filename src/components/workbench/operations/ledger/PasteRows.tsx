/**
 * PasteRows — "+ paste rows from a sheet" on the time sheet (PASTE-01, Alex, 2026-11-25).
 *
 * The rows of his spreadsheet, pasted with its header row, READ AND PLACED HERE — and nothing written. A chip under "+ expense"
 * opens a box, mounted only while it is open: its title, how to paste, the textarea, then "read the rows", "clear" and "close",
 * with any refusal in red beside them. "read the rows" hands the text to the rule (src/lib/operations/pasteRows.ts readPaste)
 * and then, for the days its readable rows cover — the sheet's own span rule first (ledger.ts spanInput: its refusal is shown and
 * nothing is sent) — READS, by GET only:
 *   · the time sheet's answer for those days (ledgerReads.ts readLedger);
 *   · each offered book's chart (week/weekReads.ts readJson over the chart route; a chart that cannot be read is said with the
 *     book's name, never shown as an empty list);
 *   · the vendors (budget/VendorBox.tsx useDirectory, as the expense form reads them);
 *   · the books (the provider's list).
 * The clock is the browser's, read once per read; the zone is the browser's, read on mount.
 *
 * Then, in order: the lines naming the columns not read; the one line of counts; the picks — one select a kind of row, nothing
 * chosen for him; and the table, every row twice on one line (YOUR SHEET, ON THE TIME SHEET) with where it LANDS last. A pick
 * places every row again, at once (pasteRows.ts placePaste — pure). A new read forgets the picks.
 *
 * IT WRITES NOTHING: no request with a method, no writer imported, nothing stored in the browser. The rule is pasteRows.ts's and
 * every word printed here is typed there; this leaf prints no sentence of its own.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDirectory } from '@/components/budget/VendorBox';
import { cellClass as cell, chipClass as chip, headClass as head, moneyClass as money } from '@/components/table/DataTable';
import { spanInput, type LedgerRecording, type LedgerSheetRow } from '@/lib/operations/ledger';
import {
  LANDS_WORDS, ON_TIME_SHEET_COLUMNS, ON_TIME_SHEET_WORDS, PASTE_CLEAR_WORDS, PASTE_CLOSE_WORDS, PASTE_HOW_WORDS, PASTE_NO_PICK_WORDS, PASTE_ONE_OFF_WORDS, PASTE_ON_PLAN_WORDS,
  PASTE_OPEN_WORDS, PASTE_PICKS_WORDS, PASTE_READ_WORDS, PASTE_TITLE_WORDS, YOUR_SHEET_COLUMNS, YOUR_SHEET_WORDS,
  accountWords, chartOf, chartUnreadWords, countsWords, notReadLines, offeredBooksOf, pasteKindsOf, pasteShown, pasteSpanOf, pickOfValue, pickOffersOf, pickValueOf, placePaste, readPaste, vendorsUnreadWords,
  type Paste, type PasteAccount, type PasteBook, type PasteColumn, type PasteContext, type PastePick, type PasteTone,
} from '@/lib/operations/pasteRows';
import { useOperationsEntity } from '../EntitySelector';
import { readJson } from '../week/weekReads';
import { readLedger } from './ledgerReads';

const box = 'px-1.5 py-0.5 border border-border rounded text-xs';
const label = 'text-text-faint tracking-wide';
/** A row's class by its tone, each typed whole: placed in the table's own ink; waiting for a pick amber; refused red; a booking and a blank date muted. */
const ROW_CLASS: Readonly<Record<PasteTone, string>> = {
  placed: 'border-t border-border',
  pick: 'border-t border-border text-brand-amber',
  refused: 'border-t border-border text-brand-red',
  quiet: 'border-t border-border text-text-muted',
};
/** A column's cell in the shared table's classes: money set right, a short cell kept on one line. */
const cellOf = (column: PasteColumn): string => (column.money ? money : column.short ? `${cell} whitespace-nowrap` : cell);
const headOf = (column: PasteColumn): string => (column.money ? `${head} text-right` : head);

export default function PasteRows() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2" data-ledger-paste>
      {!open && <button type="button" className={chip} onClick={() => setOpen(true)} data-ledger-paste-open>{PASTE_OPEN_WORDS}</button>}
      {open && <Box close={() => setOpen(false)} />}
    </div>
  );
}

/** A paste as it was read, with everything its rows are placed against — read once, at "read the rows". */
interface ReadRows {
  readonly paste: Paste;
  readonly context: PasteContext;
}

/** The box, mounted only while it is open — the directory is read then, not before. */
function Box({ close }: { close: () => void }) {
  const { entities } = useOperationsEntity();
  const directory = useDirectory();
  const [zone, setZone] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ReadRows | null>(null);
  const [picks, setPicks] = useState<Readonly<Record<string, PastePick>>>({});

  // The browser's zone, read on mount only — the server render has no business guessing it.
  useEffect(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); }, []);

  /** The directory has not answered yet: "read the rows" waits for it — a row's vendor is never placed on a guess. */
  const directoryPending = directory.vendors === null && directory.words === null;

  const read = async () => {
    if (busy || zone === null || directoryPending) return;
    // A new read forgets the rows and the picks of the one before.
    setRefusal(null);
    setRows(null);
    setPicks({});
    const paste = readPaste(text);
    if (!paste.ok) { setRefusal(paste.words); return; }
    // The vendors: the directory's own list — or, when it could not be read, its own words, and nothing is placed.
    const vendors = directory.vendors;
    if (vendors === null) {
      if (directory.words !== null) setRefusal(vendorsUnreadWords(directory.words));
      return;
    }
    // The browser's clock, read once per read; the books as the provider lists them.
    const now = new Date();
    const books: PasteBook[] = entities.map((e) => ({ id: e.id, name: e.name, entityType: e.entity_type }));
    let sheet: readonly LedgerSheetRow[] = [];
    let recording: Readonly<Record<string, LedgerRecording>> = {};
    const charts: Record<string, readonly PasteAccount[]> = {};
    // The days the readable rows cover — by the sheet's own span rule first: its refusal is shown and nothing is sent. No readable row: nothing to read.
    const span = pasteSpanOf(paste.value);
    if (span !== null) {
      const days = spanInput(span.from, span.to);
      if (!days.ok) { setRefusal(days.message); return; }
      setBusy(true);
      try {
        const ledger = await readLedger(days.from, days.to);
        if (!ledger.ok) { setRefusal(ledger.words); return; }
        sheet = ledger.value.sheet;
        recording = ledger.value.recording;
        for (const book of offeredBooksOf(books)) {
          const answer = await readJson(`/api/chart-of-accounts?entity_id=${encodeURIComponent(book.id)}`);
          if (!answer.ok) { setRefusal(chartUnreadWords(book.name, answer.words)); return; }
          const chart = chartOf(answer.value);
          if (!chart.ok) { setRefusal(chartUnreadWords(book.name, chart.words)); return; }
          charts[book.id] = chart.accounts;
        }
      } finally {
        setBusy(false);
      }
    }
    setRows({ paste: paste.value, context: { books, sheet, recording, charts, vendors, zone, now } });
  };

  const clear = () => {
    setText('');
    setRefusal(null);
    setRows(null);
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

  // Every row placed against what was read, by the picks as they stand — the rule's, pure; nothing here decides where a row lands.
  const shown = useMemo(() => {
    if (rows === null) return null;
    const placed = placePaste(rows.paste, picks, rows.context);
    return { counts: countsWords(placed), table: pasteShown(rows.paste, placed), kinds: pasteKindsOf(rows.paste), notRead: notReadLines(rows.paste) };
  }, [rows, picks]);

  return (
    <div className="space-y-2 text-xs border border-border rounded p-2 bg-white" data-ledger-paste-box>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text-secondary">{PASTE_TITLE_WORDS}</span>
      </div>
      <p className="text-text-muted" data-ledger-paste-how>{PASTE_HOW_WORDS}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} spellCheck={false} aria-label={PASTE_HOW_WORDS} className={`${box} w-full font-mono whitespace-pre`} data-ledger-paste-text />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip} disabled={busy || zone === null || directoryPending} aria-busy={busy} onClick={read} data-ledger-paste-read>{PASTE_READ_WORDS}</button>
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
                      <select value={pickValueOf(picks[kind.key])} disabled={offers === null} onChange={(e) => pick(kind.key, e.target.value)} className={box} data-ledger-paste-pick>
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
                {shown.table.map((row) => (
                  <tr key={row.number} className={ROW_CLASS[row.tone]} data-ledger-paste-row={row.number} data-ledger-paste-tone={row.tone}>
                    {row.yours.map((words, i) => <td key={YOUR_SHEET_COLUMNS[i].head} className={cellOf(YOUR_SHEET_COLUMNS[i])}>{words}</td>)}
                    {row.sheet.map((words, i) => <td key={ON_TIME_SHEET_COLUMNS[i].head} className={i === 0 ? `${cellOf(ON_TIME_SHEET_COLUMNS[i])} border-l border-border` : cellOf(ON_TIME_SHEET_COLUMNS[i])}>{words}</td>)}
                    <td className={`${cell} border-l border-border`} data-ledger-paste-lands>{row.lands}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
