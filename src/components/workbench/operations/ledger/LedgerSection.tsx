/**
 * LedgerSection — THE TASK LEDGER on /time (LEDGER-01, Alex, 2026-10-16: the
 * city ledger, under Routines on the Tasks page; TIME-01: moved under the day
 * card on /time; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger).
 *
 * Under the day card: every stop Alex recorded in a period, one row per record,
 * newest day first — the sixteen columns of ledger.ts LEDGER_HEAD_WORDS (DAY ·
 * DATE · CITY · COUNTRY · BOOK · ACCOUNT · ACCOUNT NAME · DESCRIPTION · VENDOR ·
 * STARS · BUDGET · ACTUAL · VARIANCE · MATCH · UNDER / OVER · NOTES; until
 * LEDGER-02 the ten: DATE · CITY · COUNTRY · COA · VENDOR · DESCRIPTION · STARS ·
 * NOTES · BUDGET · ACTUAL) — with the TOTAL row under it, what is said under
 * that (by name and count), and a summary grouped by Day · Week · Month · City ·
 * Country · COA · Book.
 *
 * The period is Month (the default, anchored today) · Week (Monday–Sunday) ·
 * Day · All, with a date to anchor it and ‹ › to step; a period is one read
 * (ledgerReads.ts readLedger, the route's rows). CITY, COUNTRY and COA are
 * chosen among the values present in the period, plus "all"; they change only
 * what is shown — the totals and the summary follow the rows shown. Every rule
 * and every sentence is src/lib/operations/ledger.ts's; the cells print the
 * day card's own words (planDollars; the delta's tone from deltaWords; until
 * LEDGER-02 dayShortWords and rowActualWords). The entity selector is not read: the ledger is every book, and the COA says
 * which. Nothing is written here; nothing is stored in the browser.
 *
 * RETRO-01 (Alex, 2026-10-16): EXPENSES ONLY — the rows are the records whose
 * plan takes money; the ones left out are said by role under the table. And
 * "+ expense" (ExpenseForm.tsx) above the table: an expense typed here lands on
 * that day's card through the three existing routes; once written, the ledger
 * reads its period again and the card is told the day (dayWritten.ts).
 *
 * LEDGER-02 (Alex, 2026-10-19): A REAL DATA TABLE. One fact per cell, in
 * Alex's order: the DAY cell the full weekday, the DATE cell the day alone;
 * BOOK, ACCOUNT and ACCOUNT NAME each their own column (the COA cell is gone);
 * ACTUAL the amount alone; VARIANCE the signed difference, EMPTY when unknown;
 * MATCH a column of blank cells until LEDGER-03, said under the table
 * (MATCH_NOTE_WORDS); UNDER / OVER the word, blank with VARIANCE. The TOTAL row
 * spans the columns before BUDGET, and its VARIANCE and UNDER / OVER are the
 * two totals' difference and its sign (nothing summed from a blank). The
 * summary gains Book. And "download CSV" beside the period controls: the rows
 * SHOWN as ledger.ts ledgerCsv writes them, a Blob and an object URL (the shape
 * dashboard/GeneralLedger.tsx exports), named ledgerCsvFileName, the URL revoked
 * after the click; disabled, with the reason, when no row is shown.
 */

'use client';

import { useEffect, useState } from 'react';
import { localToday } from '@/lib/localToday';
import type { Read } from '../week/weekReads';
import { deltaWords } from '../day/dayCard';
import { readLedger, type LedgerAnswer } from './ledgerReads';
import ExpenseForm from './ExpenseForm';
import { announceDayWritten } from '../dayWritten';
import {
  ALL_WORDS, BY_WORDS, CELL_WORDS, CSV_DOWNLOAD_WORDS, CSV_NO_ROWS_WORDS, EVERY_BOOK_WORDS, FILTER_KEYS, FILTER_WORDS, GROUP_KEYS, GROUP_WORDS, LEDGER_HEAD_WORDS, LEDGER_LOADING_WORDS,
  LEDGER_TITLE_WORDS, MATCH_NOTE_WORDS, MONEY_HEAD_WORDS, NEXT_WORDS, NO_FILTERS, NO_FIRST_RECORD_WORDS, NO_ROWS_SHOWN_WORDS, PERIOD_KINDS, PERIOD_WORDS, PREVIOUS_WORDS, SUMMARY_HEAD_WORDS,
  SUMMARY_TITLE_WORDS, TODAY_RULE_WORDS, TOTAL_WORDS,
  accountCellWords, accountNameCellWords, actualCellWords, averageStarsWords, bookCellWords, budgetCellWords, choicesOf, dayLongWords, daysWords, filterRows, firstRecordUnplacedWords, ledgerCsv,
  ledgerCsvFileName, ledgerSummary, ledgerTotals, leftOutWords, noLineWords, noRowsWords, noStayWords, notPlacedWords, notRecordedWords, noteCellWords, perDayWords, periodOf, periodWords,
  starsCellWords, stepAnchor, underOverWords, unplacedWords, varianceCellWords, vendorCellWords,
  type FilterKey, type Filters, type GroupKey, type LedgerRow, type Period, type PeriodKind,
} from '@/lib/operations/ledger';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const head = 'px-2 py-1.5 font-normal text-left whitespace-nowrap';
const cell = 'px-2 py-1.5 align-top';
const money = 'px-2 py-1.5 align-top text-right tabular-nums whitespace-nowrap';
const BLANK_CLASS = 'text-text-faint';

/** The colour of an actual against its budget, as the card's: over red, under or on it green, no budget to compare muted. */
const actualTone = (over: boolean | null): string => (over === null ? 'text-text-muted' : over ? 'text-brand-red' : 'text-brand-green');

export default function LedgerSection() {
  const [today, setToday] = useState<string | null>(null);
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [by, setBy] = useState<GroupKey>('city');
  // The last answer and the period it was read for; the first record's day rides every answer, so ALL can start from it.
  const [answer, setAnswer] = useState<{ readonly period: Period; readonly read: Read<LedgerAnswer> } | null>(null);
  const [firstRecord, setFirstRecord] = useState<LedgerAnswer['first_record'] | null>(null);
  // RETRO-01: an expense written from the form — the period is read again.
  const [writes, setWrites] = useState(0);

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setAnchor(t);
  }, []);

  const firstRecordDay = firstRecord !== null && 'day' in firstRecord ? firstRecord.day : null;
  const period = today === null || anchor === null ? null : periodOf(kind, anchor, today, firstRecordDay);

  useEffect(() => {
    if (period === null) return;
    let live = true;
    setAnswer(null);
    (async () => {
      const read = await readLedger(period.from, period.to);
      if (!live) return;
      setAnswer({ period, read });
      setFilters(NO_FILTERS);
      if (read.ok) setFirstRecord(read.value.first_record);
    })();
    return () => { live = false; };
  }, [period?.from, period?.to, writes]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: readonly LedgerRow[] = answer !== null && answer.read.ok ? answer.read.value.rows : [];
  const shown = filterRows(rows, filters);
  const totals = ledgerTotals(shown);
  const groups = ledgerSummary(shown, by);
  // LEDGER-02: the rows SHOWN as a CSV (ledger.ts ledgerCsv) — a Blob (UTF-8, no BOM) and an object URL, the shape dashboard/GeneralLedger.tsx
  // exports; the file is named by the period read; the URL is revoked after the click. Nothing to download until a row is shown.
  const csvPeriod: Period | null = answer !== null && answer.read.ok && shown.length > 0 ? answer.period : null;
  const downloadCsv = (p: Period): void => {
    const url = URL.createObjectURL(new Blob([ledgerCsv(shown)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = ledgerCsvFileName(p.from, p.to);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3" data-ledger>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">{LEDGER_TITLE_WORDS}</h2>
      </div>
      {/* RETRO-01: "+ expense" — a one-off stop, its vendor and its record for a day; the ledger and that day's card read again. */}
      <ExpenseForm onWritten={(day) => { setWrites((n) => n + 1); announceDayWritten(day); }} />
      <div className="flex flex-wrap items-center gap-2 text-xs" data-ledger-controls>
        {PERIOD_KINDS.map((k) => (
          <button key={k} type="button" className={kind === k ? chipOn : chip} onClick={() => setKind(k)} data-ledger-period={k} aria-pressed={kind === k}>{PERIOD_WORDS[k]}</button>
        ))}
        <button type="button" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, -1))} data-ledger-previous aria-label="previous">{PREVIOUS_WORDS}</button>
        <input type="date" value={anchor ?? ''} disabled={kind === 'all'} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setAnchor(e.target.value); }} className="px-1.5 py-0.5 border border-border rounded text-xs" data-ledger-anchor />
        <button type="button" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, 1))} data-ledger-next aria-label="next">{NEXT_WORDS}</button>
        {period !== null && <span className="font-semibold text-text-secondary" data-ledger-period-words>{periodWords(period)}</span>}
        <button type="button" className={chip} disabled={csvPeriod === null} title={csvPeriod === null ? CSV_NO_ROWS_WORDS : undefined} onClick={() => csvPeriod !== null && downloadCsv(csvPeriod)} data-ledger-csv>{CSV_DOWNLOAD_WORDS}</button>
        {answer !== null && answer.read.ok && shown.length === 0 && <span className="text-text-faint" data-ledger-csv-why>{CSV_NO_ROWS_WORDS}</span>}
        {kind === 'all' && period === null && firstRecord === null && <span className="text-text-muted" data-ledger-no-first>{NO_FIRST_RECORD_WORDS}</span>}
        {kind === 'all' && period === null && firstRecord !== null && 'words' in firstRecord && <span className="text-brand-red" data-ledger-no-first>{firstRecordUnplacedWords(firstRecord.words)}</span>}
        {FILTER_KEYS.map((key: FilterKey) => (
          <label key={key} className="flex items-center gap-1">
            <span className="text-text-faint tracking-wide">{FILTER_WORDS[key]}</span>
            <select value={filters[key] ?? ''} onChange={(e) => setFilters({ ...filters, [key]: e.target.value === '' ? null : e.target.value })} className="px-1 py-0.5 border border-border rounded text-xs" data-ledger-filter={key}>
              <option value="">{ALL_WORDS}</option>
              {choicesOf(rows, key).map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
        ))}
      </div>

      {period !== null && answer === null && <div className="text-xs text-text-muted" data-ledger-loading>{LEDGER_LOADING_WORDS}</div>}
      {answer !== null && !answer.read.ok && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-ledger-failed>{answer.read.words}</div>}
      {answer !== null && answer.read.ok && (
        <>
          {rows.length === 0 && <div className="text-xs text-text-muted" data-ledger-none>{noRowsWords(answer.period)}</div>}
          {rows.length > 0 && shown.length === 0 && <div className="text-xs text-text-muted" data-ledger-none-shown>{NO_ROWS_SHOWN_WORDS}</div>}
          {shown.length > 0 && (
            <div className="overflow-x-auto border border-border rounded bg-white">
              <table className="w-full min-w-[96rem] border-collapse text-xs" data-ledger-table>
                <thead>
                  <tr className="text-text-faint uppercase tracking-wide">
                    {LEDGER_HEAD_WORDS.map((h) => <th key={h} className={(MONEY_HEAD_WORDS as readonly string[]).includes(h) ? `${head} text-right` : head}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const delta = deltaWords(row.actualCents, row.cents);
                    return (
                      <tr key={row.id} className="border-t border-border" data-ledger-row={row.key} data-ledger-day={row.day}>
                        <td className={`${cell} whitespace-nowrap`} data-ledger-cell="day">{dayLongWords(row.day)}</td>
                        <td className={`${cell} whitespace-nowrap tabular-nums`} data-ledger-cell="date">{row.day}</td>
                        <td className={`${cell} ${row.place === null ? BLANK_CLASS : ''}`} data-ledger-cell="city">{CELL_WORDS.city(row)}</td>
                        <td className={`${cell} ${row.place === null || row.place.country === null ? BLANK_CLASS : ''}`} data-ledger-cell="country">{CELL_WORDS.country(row)}</td>
                        <td className={`${cell} whitespace-nowrap ${row.book === null ? BLANK_CLASS : ''}`} data-ledger-cell="book">{bookCellWords(row)}</td>
                        <td className={`${cell} whitespace-nowrap ${row.coa === null ? BLANK_CLASS : ''}`} data-ledger-cell="account">{accountCellWords(row)}</td>
                        <td className={`${cell} ${row.coa === null || row.coa.name === null ? BLANK_CLASS : ''}`} data-ledger-cell="account-name">{accountNameCellWords(row)}</td>
                        <td className={`${cell} font-semibold text-text-primary`} data-ledger-cell="description">{row.description}</td>
                        <td className={`${cell} ${row.vendor === null ? BLANK_CLASS : ''}`} data-ledger-cell="vendor">{vendorCellWords(row.vendor)}</td>
                        <td className={`${cell} whitespace-nowrap ${row.rating === null ? BLANK_CLASS : ''}`} data-ledger-cell="stars">{starsCellWords(row.rating)}</td>
                        <td className={`${money} ${row.cents === null ? BLANK_CLASS : 'font-semibold text-text-primary'}`} data-ledger-cell="budget">{budgetCellWords(row.cents)}</td>
                        <td className={`${money} ${row.outcome === 'skipped' ? 'text-text-muted' : row.actualCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="actual">{actualCellWords(row)}</td>
                        <td className={`${money} ${row.varianceCents === null ? '' : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="variance">{varianceCellWords(row.varianceCents)}</td>
                        <td className={money} data-ledger-cell="match" />
                        <td className={`${cell} whitespace-nowrap ${row.varianceCents === null ? '' : actualTone(delta.over)}`} data-ledger-cell="under-over">{underOverWords(row.varianceCents)}</td>
                        <td className={`${cell} ${row.note === null ? BLANK_CLASS : 'text-text-muted'}`} data-ledger-cell="notes">{noteCellWords(row.note)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* LEDGER-02: TOTAL spans the ten columns before BUDGET; VARIANCE and UNDER / OVER are the two totals' difference and its sign — blank, not 0, when either total is unknown. */}
                  <tr className="border-t border-border font-bold text-text-primary" data-ledger-total>
                    <th scope="row" colSpan={10} className={`${cell} text-left`}>{TOTAL_WORDS}</th>
                    <td className={`${money} ${totals.budgetCents === null ? BLANK_CLASS : ''}`} data-ledger-total-budget>{budgetCellWords(totals.budgetCents)}</td>
                    <td className={`${money} ${totals.actualCents === null ? BLANK_CLASS : actualTone(totals.over)}`} data-ledger-total-actual>{budgetCellWords(totals.actualCents)}</td>
                    <td className={`${money} ${totals.varianceCents === null ? '' : actualTone(totals.varianceCents > 0)}`} data-ledger-total-variance>{varianceCellWords(totals.varianceCents)}</td>
                    <td className={money} data-ledger-total-match />
                    <td className={`${cell} whitespace-nowrap ${totals.varianceCents === null ? '' : actualTone(totals.varianceCents > 0)}`} data-ledger-total-under-over>{underOverWords(totals.varianceCents)}</td>
                    <td className={cell} data-ledger-total-notes />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="text-xs text-text-muted space-y-0.5" data-ledger-said>
            <p data-ledger-said-match>{MATCH_NOTE_WORDS}</p>
            <p data-ledger-said-no-line>{noLineWords(answer.read.value.said.noLine, answer.read.value.said.doubled)}</p>
            <p data-ledger-said-no-stay>{noStayWords(answer.read.value.said.noStay)}</p>
            <p data-ledger-said-unplaced>{unplacedWords(answer.read.value.said.unplaced)}</p>
            <p data-ledger-said-not-recorded>{notRecordedWords(answer.read.value.said.notRecorded)}</p>
            <p data-ledger-said-left-out>{leftOutWords(answer.read.value.said.leftOut)}</p>
            {answer.read.value.said.notPlaced > 0 && <p data-ledger-said-not-placed>{notPlacedWords(answer.read.value.said.notPlaced)}</p>}
            <p data-ledger-said-today-rule>{TODAY_RULE_WORDS}</p>
            <p data-ledger-said-every-book>{EVERY_BOOK_WORDS}</p>
          </div>
          {shown.length > 0 && (
            <div className="space-y-2" data-ledger-summary>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-text-secondary">{SUMMARY_TITLE_WORDS}</span>
                <span className="text-text-faint">{BY_WORDS}</span>
                {GROUP_KEYS.map((g) => (
                  <button key={g} type="button" className={by === g ? chipOn : chip} onClick={() => setBy(g)} data-ledger-by={g} aria-pressed={by === g}>{GROUP_WORDS[g]}</button>
                ))}
              </div>
              <div className="overflow-x-auto border border-border rounded bg-white">
                <table className="w-full min-w-[48rem] border-collapse text-xs" data-ledger-summary-table>
                  <thead>
                    <tr className="text-text-faint uppercase tracking-wide">
                      <th className={head}>{GROUP_WORDS[by]}</th>
                      {SUMMARY_HEAD_WORDS.map((h) => <th key={h} className={h === 'STARS' || h === 'DAYS' ? head : `${head} text-right`}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key} className="border-t border-border" data-ledger-group={g.key}>
                        <td className={`${cell} font-semibold text-text-primary`} data-ledger-group-label>{g.label}</td>
                        <td className={`${cell} whitespace-nowrap`} data-ledger-group-days>{daysWords(g.days)}</td>
                        <td className={`${money} ${g.totals.budgetCents === null ? BLANK_CLASS : ''}`} data-ledger-group-budget>{budgetCellWords(g.totals.budgetCents)}</td>
                        <td className={`${money} ${g.totals.actualCents === null ? BLANK_CLASS : actualTone(g.totals.over)}`} data-ledger-group-actual>{budgetCellWords(g.totals.actualCents)}</td>
                        <td className={`${money} ${g.totals.over === null ? BLANK_CLASS : actualTone(g.totals.over)}`} data-ledger-group-words>{g.totals.words}</td>
                        <td className={`${money} ${g.perDayCents === null ? BLANK_CLASS : ''}`} data-ledger-group-per-day>{perDayWords(g.perDayCents)}</td>
                        <td className={`${cell} whitespace-nowrap ${g.stars === null ? BLANK_CLASS : ''}`} data-ledger-group-stars>{g.stars === null ? starsCellWords(null) : averageStarsWords(g.stars)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
