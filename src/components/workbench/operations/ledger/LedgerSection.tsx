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
 * (ledgerReads.ts readLedger, the route's rows). Until LEDGER-04 CITY, COUNTRY
 * and COA were three dropdowns, chosen among the values present in the period,
 * plus "all"; they changed only what is shown — the totals and the summary
 * follow the rows shown, as every column's filter does now. Every rule
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
 *
 * LEDGER-02 AMENDMENT (Alex, 2026-10-19): ONE MARKER — every null cell prints
 * "—" (VARIANCE, MATCH and UNDER / OVER as the others; the CSV keeps its empty
 * field). ONE TRUTH in the TOTAL row — its VARIANCE is the column's sum
 * (ledgerTotals), and its ACTUAL tone and its UNDER / OVER follow that sign;
 * nothing in the TOTAL row is toned from the recorded-rows comparison
 * (totals.over, totals.words), which the summary's words still print. The
 * coverage is said under the table, before the MATCH line
 * (varianceCoverageWords: the n of m rows that carry both).
 *
 * LEDGER-03 (Alex, 2026-10-19): MATCH READS THE BOOKS' LINK. The cell prints the
 * row's match (ledger.ts matchCellWords — the readable sum, "—" with no link or
 * any unreadable posting, the title naming them) in a cue tone (matchState:
 * equal to ACTUAL to the cent green, differing red, none when ACTUAL is null),
 * with one "link" chip that opens, under the row, LinkPicker.tsx — LINK-01's
 * list for the record's own (kind, target_id, occurrence_at), `near` the
 * record's day; a link or unlink makes the ledger read its span again (writes).
 * The TOTAL row's MATCH is the column's sum over the rows with a readable sum,
 * its coverage said under the table in place of the LEDGER-02 note. Nothing is
 * fetched here (the picker's hook fetches through the links route); nothing is
 * stored in the browser.
 *
 * LEDGER-04 (Alex, 2026-10-20): AFTER THE FIRST READ. (1) The heads say SUB
 * ACCOUNT NAME for the stop's name (it IS the sub-account's) and DESCRIPTION
 * for the record's note; the cells print the same fields (row.description,
 * row.note). (2) The three dropdowns are gone: every header carries the head
 * word (a click sorts — ascending, descending, then the ledger's own order;
 * one column at a time, the mark showing the direction) and a ▾ that opens
 * ColumnFilter.tsx under it — one popover at a time, fixed under its ▾ (the
 * anchor, kept in a ref map) so the table's scroll box never clips it, following
 * the ▾ on scroll. The filters are ledger.ts's
 * ColumnFilters (applyColumnFilters: OR within a column, AND across), the
 * checklists ledger.ts's columnValues over the rows LOADED for the period, the
 * sort ledger.ts's sortRows; `shown` is the rows filtered then sorted, and the
 * TOTAL row, the coverage, the summary and the CSV all read `shown` as before
 * (the CSV in the shown order). A header with an active filter shows a mark;
 * "clear filters" appears beside "download CSV" while any is active. THE
 * FILTERS RESET WHEN THE PERIOD CHANGES (a checklist is built from the rows
 * loaded — a set carried into another period would hide rows whose values the
 * person never saw unticked); a re-read of the same period after a write keeps
 * them; the sort persists across periods (it hides nothing). (3) The sentences
 * under the TOTAL row fold into one toggle — "n notes ▸", closed on every load
 * (ledger.ts notesCount: the lines with something to say; a line whose count
 * is 0 is neither counted nor shown; the TODAY rule and the every-book line
 * shown only when open, never counted) — the same words, one per line, when
 * open. React state only: nothing stored in the browser.
 */

'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { localToday } from '@/lib/localToday';
import type { Read } from '../week/weekReads';
import { deltaWords } from '../day/dayCard';
import { readLedger, type LedgerAnswer } from './ledgerReads';
import ExpenseForm from './ExpenseForm';
import LinkPicker from './LinkPicker';
import ColumnFilter from './ColumnFilter';
import { announceDayWritten } from '../dayWritten';
import {
  BY_WORDS, CELL_WORDS, CLEAR_FILTERS_WORDS, CSV_DOWNLOAD_WORDS, CSV_NO_ROWS_WORDS, EVERY_BOOK_WORDS, FILTER_ON_MARK, FILTER_OPEN_WORDS, GROUP_KEYS, GROUP_WORDS, LEDGER_COLUMNS, LEDGER_HEAD_WORDS,
  LEDGER_LOADING_WORDS, LEDGER_TITLE_WORDS, LINK_WORDS, MONEY_HEAD_WORDS, NEXT_WORDS, NO_COLUMN_FILTERS, NO_FIRST_RECORD_WORDS, NO_ROWS_SHOWN_WORDS, PERIOD_KINDS, PERIOD_WORDS, PREVIOUS_WORDS,
  SORT_MARKS, SUMMARY_HEAD_WORDS, SUMMARY_TITLE_WORDS, TODAY_RULE_WORDS, TOTAL_WORDS,
  accountCellWords, accountNameCellWords, actualCellWords, anyColumnFilterOn, applyColumnFilters, averageStarsWords, bookCellWords, budgetCellWords, columnFilterOn, columnKind, columnValues,
  dayLongWords, daysWords, filterLabelWords, firstRecordUnplacedWords, headWordOf, ledgerCsv, ledgerCsvFileName, ledgerSummary, ledgerTotals, leftOutTotal, leftOutWords, matchCellTitle, matchCellWords,
  matchCoverageWords, matchState, matchTotalWords, nextSort, noLineWords, noRowsWords, noStayWords, notPlacedWords, notRecordedWords, noteCellWords, notesCount, notesToggleWords, perDayWords,
  periodOf, periodWords, readableMatchCents, sortLabelWords, sortRows, starsCellWords, stepAnchor, underOverWords, unplacedWords, varianceCellWords, varianceCoverageWords, vendorCellWords,
  type ColumnFilters, type GroupKey, type LedgerColumn, type LedgerRow, type LedgerSort, type MatchState, type MoneyColumn, type Period, type PeriodKind, type TextColumn, type ValueColumn,
} from '@/lib/operations/ledger';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const head = 'px-2 py-1.5 font-normal text-left whitespace-nowrap';
const cell = 'px-2 py-1.5 align-top';
const money = 'px-2 py-1.5 align-top text-right tabular-nums whitespace-nowrap';
const BLANK_CLASS = 'text-text-faint';

/** The colour of an actual against its budget, as the card's: over red, under or on it green, no budget to compare muted. */
const actualTone = (over: boolean | null): string => (over === null ? 'text-text-muted' : over ? 'text-brand-red' : 'text-brand-green');
/** LEDGER-02 (amended): the tone of a variance — over red, under or even green; a null variance is a blank cell. */
const varianceTone = (cents: number | null): string => (cents === null ? BLANK_CLASS : actualTone(cents > 0));
/** LEDGER-03: the cue on a MATCH — equal to ACTUAL green, differing red, no cue when either is unknown. */
const matchTone = (state: MatchState | null): string => (state === null ? '' : state === 'equal' ? 'text-brand-green' : 'text-brand-red');

export default function LedgerSection() {
  const [today, setToday] = useState<string | null>(null);
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState<string | null>(null);
  // LEDGER-04: one filter per column (ledger.ts ColumnFilters), the sort (one column, or the ledger's own order), the column whose popover is
  // open and the notes toggle — React state only, nothing stored. The ▾ buttons by column (a ref map): the open popover is anchored under its own.
  const [filters, setFilters] = useState<ColumnFilters>(NO_COLUMN_FILTERS);
  const [sort, setSort] = useState<LedgerSort | null>(null);
  const [openFilter, setOpenFilter] = useState<LedgerColumn | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const filterButtons = useRef(new Map<LedgerColumn, HTMLButtonElement>());
  const [by, setBy] = useState<GroupKey>('city');
  // The last answer and the period it was read for; the first record's day rides every answer, so ALL can start from it.
  const [answer, setAnswer] = useState<{ readonly period: Period; readonly read: Read<LedgerAnswer> } | null>(null);
  const [firstRecord, setFirstRecord] = useState<LedgerAnswer['first_record'] | null>(null);
  // RETRO-01: an expense written from the form — the period is read again. LEDGER-03: a link or unlink from the picker, the same.
  const [writes, setWrites] = useState(0);
  // LEDGER-03: the row whose picker is open (its key), or none. React state only — nothing stored.
  const [picking, setPicking] = useState<string | null>(null);

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
      if (read.ok) setFirstRecord(read.value.first_record);
    })();
    return () => { live = false; };
  }, [period?.from, period?.to, writes]); // eslint-disable-line react-hooks/exhaustive-deps
  // LEDGER-04: a new period starts with every filter off and no popover open — the checklists are the period's own; a re-read after a write keeps them.
  useEffect(() => {
    setFilters(NO_COLUMN_FILTERS);
    setOpenFilter(null);
  }, [period?.from, period?.to]);
  const closeFilter = useCallback(() => setOpenFilter(null), []);

  const rows: readonly LedgerRow[] = answer !== null && answer.read.ok ? answer.read.value.rows : [];
  // LEDGER-04: the rows filtered (every column, AND across), then sorted — the TOTAL row, the coverage, the summary and the CSV read these.
  const shown = sortRows(applyColumnFilters(rows, filters), sort);
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

  /** LEDGER-04: the one popover open — the leaf by the column's kind, under that column's ▾, with its filter and (a VALUE column) the values among the rows loaded. */
  const popover = (c: LedgerColumn) => {
    const anchor = filterButtons.current.get(c);
    if (anchor === undefined) return null;
    const kind = columnKind(c);
    if (kind === 'value') return <ColumnFilter kind="value" column={c} anchor={anchor} values={columnValues(rows, c as ValueColumn)} filter={filters[c as ValueColumn]} onChange={(f) => setFilters({ ...filters, [c]: f })} onClose={closeFilter} />;
    if (kind === 'money') return <ColumnFilter kind="money" column={c} anchor={anchor} filter={filters[c as MoneyColumn]} onChange={(f) => setFilters({ ...filters, [c]: f })} onClose={closeFilter} />;
    return <ColumnFilter kind="text" column={c} anchor={anchor} filter={filters[c as TextColumn]} onChange={(f) => setFilters({ ...filters, [c]: f })} onClose={closeFilter} />;
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
        {anyColumnFilterOn(filters) && <button type="button" className={chip} onClick={() => setFilters(NO_COLUMN_FILTERS)} data-ledger-clear-filters>{CLEAR_FILTERS_WORDS}</button>}
        {answer !== null && answer.read.ok && shown.length === 0 && <span className="text-text-faint" data-ledger-csv-why>{CSV_NO_ROWS_WORDS}</span>}
        {kind === 'all' && period === null && firstRecord === null && <span className="text-text-muted" data-ledger-no-first>{NO_FIRST_RECORD_WORDS}</span>}
        {kind === 'all' && period === null && firstRecord !== null && 'words' in firstRecord && <span className="text-brand-red" data-ledger-no-first>{firstRecordUnplacedWords(firstRecord.words)}</span>}
      </div>

      {period !== null && answer === null && <div className="text-xs text-text-muted" data-ledger-loading>{LEDGER_LOADING_WORDS}</div>}
      {answer !== null && !answer.read.ok && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-ledger-failed>{answer.read.words}</div>}
      {answer !== null && answer.read.ok && (
        <>
          {rows.length === 0 && <div className="text-xs text-text-muted" data-ledger-none>{noRowsWords(answer.period)}</div>}
          {rows.length > 0 && shown.length === 0 && <div className="text-xs text-text-muted" data-ledger-none-shown>{NO_ROWS_SHOWN_WORDS}</div>}
          {/* LEDGER-04: the table stays while rows are LOADED, even when a filter leaves none shown — the filters live in its headers, so they must stay to be undone. */}
          {rows.length > 0 && (
            <div className="overflow-x-auto border border-border rounded bg-white">
              <table className="w-full min-w-[96rem] border-collapse text-xs" data-ledger-table>
                <thead>
                  <tr className="text-text-faint uppercase tracking-wide">
                    {/* LEDGER-04: each header is its head word (a click sorts — nextSort — the mark showing the direction) and a ▾ that opens the column's popover; a mark while its filter is on. */}
                    {LEDGER_COLUMNS.map((c) => {
                      const h = headWordOf(c);
                      const on = columnFilterOn(filters, c);
                      const sorted = sort !== null && sort.column === c;
                      return (
                        <th key={c} className={(MONEY_HEAD_WORDS as readonly string[]).includes(h) ? `${head} text-right` : head}>
                          <span className="inline-flex items-center gap-1">
                            <button type="button" className="hover:text-text-primary" onClick={() => setSort(nextSort(sort, c))} aria-label={sortLabelWords(h)} data-ledger-sort={c} data-ledger-sort-direction={sorted ? sort.direction : undefined}>{h}</button>
                            {sorted && <span data-ledger-sort-mark>{SORT_MARKS[sort.direction]}</span>}
                            <button type="button" ref={(el) => { if (el === null) filterButtons.current.delete(c); else filterButtons.current.set(c, el); }} className={on ? 'text-brand-purple' : 'hover:text-text-primary'} onClick={() => setOpenFilter(c)} aria-label={filterLabelWords(h)} aria-expanded={openFilter === c} data-ledger-filter={c} data-ledger-filter-on={on ? '' : undefined}>
                              {on && <span data-ledger-filter-mark>{FILTER_ON_MARK}</span>}
                              <span data-ledger-filter-open>{FILTER_OPEN_WORDS}</span>
                            </button>
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => {
                    const delta = deltaWords(row.actualCents, row.cents);
                    return (
                      <Fragment key={row.id}>
                      <tr className="border-t border-border" data-ledger-row={row.key} data-ledger-day={row.day}>
                        <td className={`${cell} whitespace-nowrap`} data-ledger-cell="day">{dayLongWords(row.day)}</td>
                        <td className={`${cell} whitespace-nowrap tabular-nums`} data-ledger-cell="date">{row.day}</td>
                        <td className={`${cell} ${row.place === null ? BLANK_CLASS : ''}`} data-ledger-cell="city">{CELL_WORDS.city(row)}</td>
                        <td className={`${cell} ${row.place === null || row.place.country === null ? BLANK_CLASS : ''}`} data-ledger-cell="country">{CELL_WORDS.country(row)}</td>
                        <td className={`${cell} whitespace-nowrap ${row.book === null ? BLANK_CLASS : ''}`} data-ledger-cell="book">{bookCellWords(row)}</td>
                        <td className={`${cell} whitespace-nowrap ${row.coa === null ? BLANK_CLASS : ''}`} data-ledger-cell="account">{accountCellWords(row)}</td>
                        <td className={`${cell} ${row.coa === null || row.coa.name === null ? BLANK_CLASS : ''}`} data-ledger-cell="account-name">{accountNameCellWords(row)}</td>
                        <td className={`${cell} font-semibold text-text-primary`} data-ledger-cell="sub-account-name">{row.description}</td>
                        <td className={`${cell} ${row.vendor === null ? BLANK_CLASS : ''}`} data-ledger-cell="vendor">{vendorCellWords(row.vendor)}</td>
                        <td className={`${cell} whitespace-nowrap ${row.rating === null ? BLANK_CLASS : ''}`} data-ledger-cell="stars">{starsCellWords(row.rating)}</td>
                        <td className={`${money} ${row.cents === null ? BLANK_CLASS : 'font-semibold text-text-primary'}`} data-ledger-cell="budget">{budgetCellWords(row.cents)}</td>
                        <td className={`${money} ${row.outcome === 'skipped' ? 'text-text-muted' : row.actualCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="actual">{actualCellWords(row)}</td>
                        <td className={`${money} ${row.varianceCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="variance">{varianceCellWords(row.varianceCents)}</td>
                        <td className={`${money} ${readableMatchCents(row.match) === null ? BLANK_CLASS : `font-semibold ${matchTone(matchState(row.match, row.actualCents))}`}`} data-ledger-cell="match" title={matchCellTitle(row.match) ?? undefined}>
                          <span data-ledger-match>{matchCellWords(row.match)}</span>
                          <button type="button" className={`${chip} ml-1 font-normal`} onClick={() => setPicking(picking === row.key ? null : row.key)} data-ledger-link={row.key} aria-expanded={picking === row.key}>{LINK_WORDS}</button>
                        </td>
                        <td className={`${cell} whitespace-nowrap ${row.varianceCents === null ? BLANK_CLASS : actualTone(delta.over)}`} data-ledger-cell="under-over">{underOverWords(row.varianceCents)}</td>
                        <td className={`${cell} ${row.note === null ? BLANK_CLASS : 'text-text-muted'}`} data-ledger-cell="description">{noteCellWords(row.note)}</td>
                      </tr>
                      {picking === row.key && (
                        <tr className="border-t border-border" data-ledger-picker={row.key}>
                          <td colSpan={LEDGER_HEAD_WORDS.length} className={cell}>
                            <LinkPicker kind={row.address.kind} id={row.address.id} instant={row.address.instant} near={row.day} onChanged={() => setWrites((n) => n + 1)} onClose={() => setPicking(null)} />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* LEDGER-02 (amended): TOTAL spans the ten columns before BUDGET; VARIANCE is the column's sum (ledgerTotals), and the ACTUAL tone and UNDER / OVER follow its sign — one truth per row; "—" when no row carries both. */}
                  <tr className="border-t border-border font-bold text-text-primary" data-ledger-total>
                    <th scope="row" colSpan={10} className={`${cell} text-left`}>{TOTAL_WORDS}</th>
                    <td className={`${money} ${totals.budgetCents === null ? BLANK_CLASS : ''}`} data-ledger-total-budget>{budgetCellWords(totals.budgetCents)}</td>
                    <td className={`${money} ${totals.actualCents === null ? BLANK_CLASS : totals.varianceCents === null ? '' : varianceTone(totals.varianceCents)}`} data-ledger-total-actual>{budgetCellWords(totals.actualCents)}</td>
                    <td className={`${money} ${varianceTone(totals.varianceCents)}`} data-ledger-total-variance>{varianceCellWords(totals.varianceCents)}</td>
                    <td className={`${money} ${totals.matchCents === null ? BLANK_CLASS : ''}`} data-ledger-total-match>{matchTotalWords(totals.matchCents)}</td>
                    <td className={`${cell} whitespace-nowrap ${varianceTone(totals.varianceCents)}`} data-ledger-total-under-over>{underOverWords(totals.varianceCents)}</td>
                    <td className={cell} data-ledger-total-description />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {openFilter !== null && popover(openFilter)}
          {/* LEDGER-04 (Alex, 2026-10-20): THE NOTES — the sentences under the TOTAL row, folded into one toggle closed on every load: "n notes ▸" (notesCount — the lines
              with something to say; a line whose count is 0 is neither counted nor shown; the TODAY rule and the every-book line shown only when open, never counted). Open, the
              same words as before, one per line. React state only. */}
          <div className="text-xs text-text-muted" data-ledger-notes>
            <button type="button" className="hover:text-text-primary" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen} data-ledger-notes-toggle>{notesToggleWords(notesCount(answer.read.value.said, shown.length), notesOpen)}</button>
            {notesOpen && (
              <div className="space-y-0.5 mt-1" data-ledger-said>
                {shown.length > 0 && <p data-ledger-said-variance>{varianceCoverageWords(totals.withVariance, shown.length)}</p>}
                {shown.length > 0 && <p data-ledger-said-match>{matchCoverageWords(totals.withMatch, shown.length)}</p>}
                {answer.read.value.said.noLine > 0 && <p data-ledger-said-no-line>{noLineWords(answer.read.value.said.noLine, answer.read.value.said.doubled)}</p>}
                {answer.read.value.said.noStay > 0 && <p data-ledger-said-no-stay>{noStayWords(answer.read.value.said.noStay)}</p>}
                {answer.read.value.said.unplaced.length > 0 && <p data-ledger-said-unplaced>{unplacedWords(answer.read.value.said.unplaced)}</p>}
                {answer.read.value.said.notRecorded > 0 && <p data-ledger-said-not-recorded>{notRecordedWords(answer.read.value.said.notRecorded)}</p>}
                {leftOutTotal(answer.read.value.said.leftOut) > 0 && <p data-ledger-said-left-out>{leftOutWords(answer.read.value.said.leftOut)}</p>}
                {answer.read.value.said.notPlaced > 0 && <p data-ledger-said-not-placed>{notPlacedWords(answer.read.value.said.notPlaced)}</p>}
                <p data-ledger-said-today-rule>{TODAY_RULE_WORDS}</p>
                <p data-ledger-said-every-book>{EVERY_BOOK_WORDS}</p>
              </div>
            )}
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
