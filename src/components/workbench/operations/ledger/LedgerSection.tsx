/**
 * LedgerSection — THE TASK LEDGER on /time (LEDGER-01, Alex, 2026-10-16: the
 * city ledger, under Routines on the Tasks page; TIME-01: moved under the day
 * card on /time; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger).
 *
 * TIME-03 (Alex, 2026-10-26): WHERE THE HOURS WENT — Time is LIVE. Two cells
 * after STARS, nothing reordered: PLANNED MIN (the line's duration, the day
 * card's rule) and LOGGED MIN (the record's minutes), whole minutes, "—" for
 * null (ledger.ts minutesCellWords); the TOTAL row spans the twelve columns
 * before BUDGET now. The summary gains PLANNED HOURS · LOGGED HOURS — each
 * group's minutes as hours to one decimal (hoursWords), "—" when no row
 * carries minutes — and their coverage is said under the table beside the
 * VARIANCE and MATCH lines (plannedCoverageWords, loggedCoverageWords).
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
 *
 * IDIOM-01 (Alex, 2026-10-24): THE TABLE RENDERS THROUGH THE SHARED IDIOM. The
 * controls row (with "download CSV", "clear filters" and the reason), the
 * headers (the sort button and the ▾), the one popover, the "no row matches"
 * state and the table element moved VERBATIM into components/table/DataTable.tsx
 * (ColumnFilter.tsx beside it), generic over src/lib/table's spec; this section
 * hands it the ledger's spec (ledger.ts LEDGER_TABLE), the rows loaded and the
 * rows shown, its own period controls, its ‹ nothing recorded › lines, each row's
 * cells (renderRow), the TOTAL row whole (foot) and the CSV's file name, and
 * keeps around it what is the ledger's: the title, "+ expense", the period, the
 * notes toggle and the summary. The DOM is byte for byte what it was (the
 * attributes keep the ledger's `data-ledger-*` name), the CSV's bytes too; the
 * state stays here — `shown` is still filtered then sorted in this file, the
 * filters still reset with the period. The pins that moved carry dated notes
 * in ledger01, ledger02 and ledger04; idiom01.test.ts pins the extraction.
 *
 * TIMESHEET-01 (Alex, 2026-11-24): THE TIME SHEET, PART ONE.
 * "its so much more than trip sheet... this is just all time sheet...."
 * The table draws the answer's `sheet` (ledgerReads.ts), not its `rows`: every
 * stop and every charge planned on Expenses that carries an amount, one row
 * per occurrence, on its day — a row he recorded as it read before, a row he
 * has not recorded as its plan with "—" where a record would be. Oldest day
 * first; within a day the all-day rows, then the clock (ledger.ts orders it).
 * Three cells more, twenty-one now: START and END after DATE, WENT after
 * VENDOR (ledger.ts startOf, endOf, wentOf through their cell words; a null
 * cell wears the blank class, as every other). Each row is keyed by its own
 * key — a plan row has no record id. "link" stands on every row, recorded or
 * not: a link is keyed on the occurrence. The TOTAL row's label spans the
 * fifteen columns before BUDGET; its figures are ledgerTotals over the rows
 * shown, as they were. The title, the period controls, "+ expense", the
 * filters, the sort, the notes and the summary are where they were; nothing
 * is written here that was not written before.
 *
 * TIMESHEET-03 (Alex, 2026-11-24): THE TIME SHEET'S LOOK — TODAY FIRST, PILLS, THE TINT.
 * "also we made it look like this before, i want this style table for sure...."
 * "the only thing that i see here is the COA column in the table, this would be great to include to how it SHOULD look..."
 * Nothing is renamed, moved, added or removed: the same rows, the same
 * twenty-one columns in the same order with the same words, and the CSV byte
 * for byte what it was. Three things about how it is drawn:
 *   TODAY FIRST — the period starts on Day, anchored today as before (Month
 * until then); Month, Week, All, ‹ ›, the date box and the period's words work
 * as they did.
 *   THE PILLS — two cells, in this file's own row: BOOK prints its word in the
 * app's pill, toned by the book; ACCOUNT NAME prints the account's name in a
 * pill toned by the account's place among the accounts the active plans use —
 * the answer's `tones` (ledgerReads.ts), read through ledger.ts
 * (bookPillClassOf, accountPillClassOf: the pill's classes, or null). A row
 * with no book, and a cell with no name, print their blank as before, with no
 * pill. The ACCOUNT cell — the code — is not touched.
 *   THE TINT — on every body row the four cells nobody types on a row (BUDGET,
 * VARIANCE, MATCH, UNDER / OVER) carry one tint, whatever else their classes
 * say; the TOTAL row is not tinted. One legend line above the table while rows
 * are shown — a swatch of the same tint and ledger.ts's words
 * (NOT_TYPED_WORDS) — in the shared table's children slot, where the loading
 * and nothing-recorded lines stand. The shared table (DataTable.tsx) is not
 * edited: the pills and the tint are in this section's own cells. No box in a
 * row, nothing typed here that was not typed before.
 */

'use client';

import { Fragment, useEffect, useState } from 'react';
import { localToday } from '@/lib/localToday';
import type { Read } from '../week/weekReads';
import { deltaWords } from '../day/dayCard';
import { readLedger, type LedgerAnswer } from './ledgerReads';
import ExpenseForm from './ExpenseForm';
import LinkPicker from './LinkPicker';
import { reversedLinkedWords } from '@/lib/calendar/postingAmount';
import DataTable, { cellClass as cell, chipClass as chip, headClass as head, moneyClass as money } from '@/components/table/DataTable';
import { announceDayWritten } from '../dayWritten';
import {
  BY_WORDS, CELL_WORDS, EVERY_BOOK_WORDS, GROUP_KEYS, GROUP_WORDS, LEDGER_HEAD_WORDS, LEDGER_LOADING_WORDS, LEDGER_TABLE, LEDGER_TITLE_WORDS, LINK_WORDS, NEXT_WORDS, NO_COLUMN_FILTERS,
  NO_FIRST_RECORD_WORDS, PERIOD_KINDS, PERIOD_WORDS, PREVIOUS_WORDS, SUMMARY_HEAD_WORDS, SUMMARY_TITLE_WORDS, TODAY_RULE_WORDS, TOTAL_WORDS,
  accountCellWords, accountNameCellWords, actualCellWords, applyColumnFilters, averageStarsWords, bookCellWords, budgetCellWords, dayLongWords, daysWords, firstRecordUnplacedWords,
  ledgerCsvFileName, ledgerSummary, ledgerTotals, leftOutTotal, leftOutWords, matchCellTitle, matchCellWords, matchCoverageWords, matchState, matchTotalWords, noLineWords, noRowsWords,
  noStayWords, notPlacedWords, notRecordedWords, noteCellWords, notesCount, notesToggleWords, perDayWords, periodOf, periodWords, readableMatchCents, sortRows, starsCellWords, stepAnchor,
  underOverWords, unplacedWords, varianceCellWords, varianceCoverageWords, vendorCellWords,
  endCellWords, endOf, startCellWords, startOf, wentCellWords, wentOf, // TIMESHEET-01 (2026-11-24): the three facts of a sheet row and their cells
  hoursWords, loggedCoverageWords, minutesCellWords, plannedCoverageWords, // TIME-03 (2026-10-26): the minutes cells, the hours and their coverage
  NOT_TYPED_WORDS, accountPillClassOf, bookPillClassOf, type AccountPlaces, // TIMESHEET-03 (2026-11-24): the legend's words, the two pills' classes, and the accounts' places they are toned by
  type ColumnFilters, type GroupKey, type LedgerColumn, type LedgerSheetRow, type LedgerSort, type MatchState, type Period, type PeriodKind,
} from '@/lib/operations/ledger';

// IDIOM-01 (2026-10-24): the chip, head, cell and money classes are the shared table's (DataTable.tsx), imported under the names this file always used.
const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const BLANK_CLASS = 'text-text-faint';
/** TIMESHEET-03 (2026-11-24): the tint of the cells nobody types on a row — BUDGET, VARIANCE, MATCH, UNDER / OVER — and of the legend's swatch. One class, typed whole. */
const NOT_TYPED_TINT = 'bg-blue-50';

/** The colour of an actual against its budget, as the card's: over red, under or on it green, no budget to compare muted. */
const actualTone = (over: boolean | null): string => (over === null ? 'text-text-muted' : over ? 'text-brand-red' : 'text-brand-green');
/** LEDGER-02 (amended): the tone of a variance — over red, under or even green; a null variance is a blank cell. */
const varianceTone = (cents: number | null): string => (cents === null ? BLANK_CLASS : actualTone(cents > 0));
/** LEDGER-03: the cue on a MATCH — equal to ACTUAL green, differing red, no cue when either is unknown. */
const matchTone = (state: MatchState | null): string => (state === null ? '' : state === 'equal' ? 'text-brand-green' : 'text-brand-red');

export default function LedgerSection() {
  const [today, setToday] = useState<string | null>(null);
  // TIMESHEET-03 (Alex, 2026-11-24, ruling A): TODAY FIRST — the period starts on Day, anchored today (below); 'month' until then. Month, Week and All are one tap away, as before.
  const [kind, setKind] = useState<PeriodKind>('day');
  const [anchor, setAnchor] = useState<string | null>(null);
  // LEDGER-04: one filter per column (ledger.ts ColumnFilters), the sort (one column, or the ledger's own order), the column whose popover is
  // open and the notes toggle — React state only, nothing stored. IDIOM-01 (2026-10-24): the ▾ buttons' ref map is DataTable's now; the state stays here.
  const [filters, setFilters] = useState<ColumnFilters>(NO_COLUMN_FILTERS);
  const [sort, setSort] = useState<LedgerSort | null>(null);
  const [openFilter, setOpenFilter] = useState<LedgerColumn | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
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
  // TIMESHEET-01 (Alex, 2026-11-24): the table's rows are the answer's `sheet` — every priced line of the period, planned and recorded (its `rows`, the recorded expenses alone, are the home ledger's).
  const rows: readonly LedgerSheetRow[] = answer !== null && answer.read.ok ? answer.read.value.sheet : [];
  // TIMESHEET-03 (Alex, 2026-11-24): each account's place among the accounts the active plans use — the answer's `tones`; the ACCOUNT NAME pill is toned by it (ledger.ts accountPillClassOf).
  const tones: AccountPlaces = answer !== null && answer.read.ok ? answer.read.value.tones : {};
  // LEDGER-04: the rows filtered (every column, AND across), then sorted — the TOTAL row, the coverage, the summary and the CSV read these.
  const shown = sortRows(applyColumnFilters(rows, filters), sort);
  const totals = ledgerTotals(shown);
  const groups = ledgerSummary(shown, by);
  // LEDGER-02: the rows SHOWN as a CSV, named by the period read. IDIOM-01 (2026-10-24): the writing (ledger.ts ledgerCsv = the idiom's tableCsv over
  // LEDGER_TABLE — a Blob, UTF-8, no BOM, an object URL revoked after the click) is DataTable's; this file names the file, and nothing to download until a row is shown.
  const csvPeriod: Period | null = answer !== null && answer.read.ok && shown.length > 0 ? answer.period : null;
  const csv = csvPeriod === null ? null : { name: ledgerCsvFileName(csvPeriod.from, csvPeriod.to) };

  return (
    <section className="space-y-3" data-ledger>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">{LEDGER_TITLE_WORDS}</h2>
      </div>
      {/* RETRO-01: "+ expense" — a one-off stop, its vendor and its record for a day; the ledger and that day's card read again. */}
      <ExpenseForm onWritten={(day) => { setWrites((n) => n + 1); announceDayWritten(day); }} />
      {/* IDIOM-01 (Alex, 2026-10-24): the controls row (with "download CSV", "clear filters" and the reason), the headers, the one popover, the "no row matches"
          state and the table element are the shared DataTable's (components/table/DataTable.tsx) — the ledger's spec, its rows loaded and shown, and its state
          handed in; its own period controls, its lines, each row's cells and the TOTAL row rendered HERE and handed to it, so every cell is still the ledger's words. */}
      <DataTable
        name="ledger"
        columns={LEDGER_TABLE}
        rows={rows}
        shown={shown}
        loaded={answer !== null && answer.read.ok}
        tableClassName="min-w-[96rem]"
        filters={filters}
        onFilters={setFilters}
        noFilters={NO_COLUMN_FILTERS}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={csv}
        controls={(
          <>
            {PERIOD_KINDS.map((k) => (
              <button key={k} type="button" className={kind === k ? chipOn : chip} onClick={() => setKind(k)} data-ledger-period={k} aria-pressed={kind === k}>{PERIOD_WORDS[k]}</button>
            ))}
            <button type="button" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, -1))} data-ledger-previous aria-label="previous">{PREVIOUS_WORDS}</button>
            <input type="date" value={anchor ?? ''} disabled={kind === 'all'} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setAnchor(e.target.value); }} className="px-1.5 py-0.5 border border-border rounded text-xs" data-ledger-anchor />
            <button type="button" className={chip} disabled={kind === 'all' || anchor === null} onClick={() => anchor !== null && setAnchor(stepAnchor(kind, anchor, 1))} data-ledger-next aria-label="next">{NEXT_WORDS}</button>
            {period !== null && <span className="font-semibold text-text-secondary" data-ledger-period-words>{periodWords(period)}</span>}
          </>
        )}
        trailing={(
          <>
            {kind === 'all' && period === null && firstRecord === null && <span className="text-text-muted" data-ledger-no-first>{NO_FIRST_RECORD_WORDS}</span>}
            {kind === 'all' && period === null && firstRecord !== null && 'words' in firstRecord && <span className="text-brand-red" data-ledger-no-first>{firstRecordUnplacedWords(firstRecord.words)}</span>}
          </>
        )}
        renderRow={(row) => {
          const delta = deltaWords(row.actualCents, row.cents);
          // TIMESHEET-03 (2026-11-24): THE PILLS — BOOK and ACCOUNT NAME print the same words in the app's pill, toned by the book and by the account's place; the classes are the
          // rule's, null when the cell prints its blank (a row with no book; a cell with no name) — a blank stays a blank, no pill. ACCOUNT, the code between them, is as it was.
          // THE TINT — BUDGET, VARIANCE, MATCH and UNDER / OVER carry NOT_TYPED_TINT on every body row, whatever else their classes say: nobody types them on a row. ACTUAL,
          // among them, is not tinted, and neither is the TOTAL row.
          const bookPill = bookPillClassOf(row);
          const accountPill = accountPillClassOf(row, tones);
          return (
            <Fragment key={row.key}>
              <tr className="border-t border-border" data-ledger-row={row.key} data-ledger-day={row.day}>
                <td className={`${cell} whitespace-nowrap`} data-ledger-cell="day">{dayLongWords(row.day)}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums`} data-ledger-cell="date">{row.day}</td>
                {/* TIMESHEET-01 (2026-11-24): START and END after DATE — the clock, the all-day word on a charge, "—" for a blank. */}
                <td className={`${cell} whitespace-nowrap tabular-nums ${startOf(row) === null ? BLANK_CLASS : ''}`} data-ledger-cell="start">{startCellWords(row)}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums ${endOf(row) === null ? BLANK_CLASS : ''}`} data-ledger-cell="end">{endCellWords(row)}</td>
                <td className={`${cell} ${row.place === null ? BLANK_CLASS : ''}`} data-ledger-cell="city">{CELL_WORDS.city(row)}</td>
                <td className={`${cell} ${row.place === null || row.place.country === null ? BLANK_CLASS : ''}`} data-ledger-cell="country">{CELL_WORDS.country(row)}</td>
                <td className={`${cell} whitespace-nowrap ${row.book === null ? BLANK_CLASS : ''}`} data-ledger-cell="book">{bookPill === null ? bookCellWords(row) : <span className={bookPill} data-ledger-pill="book">{bookCellWords(row)}</span>}</td>
                <td className={`${cell} whitespace-nowrap ${row.coa === null ? BLANK_CLASS : ''}`} data-ledger-cell="account">{accountCellWords(row)}</td>
                <td className={`${cell} ${row.coa === null || row.coa.name === null ? BLANK_CLASS : ''}`} data-ledger-cell="account-name">{accountPill === null ? accountNameCellWords(row) : <span className={accountPill} data-ledger-pill="account-name">{accountNameCellWords(row)}</span>}</td>
                <td className={`${cell} font-semibold text-text-primary`} data-ledger-cell="sub-account-name">{row.description}</td>
                <td className={`${cell} ${row.vendor === null ? BLANK_CLASS : ''}`} data-ledger-cell="vendor">{vendorCellWords(row.vendor)}</td>
                {/* TIMESHEET-01 (2026-11-24): WENT after VENDOR — went, skipped, planned, not recorded; "—" on a charge. */}
                <td className={`${cell} whitespace-nowrap ${wentOf(row) === null ? BLANK_CLASS : ''}`} data-ledger-cell="went">{wentCellWords(row)}</td>
                <td className={`${cell} whitespace-nowrap ${row.rating === null ? BLANK_CLASS : ''}`} data-ledger-cell="stars">{starsCellWords(row.rating)}</td>
                {/* TIME-03 (2026-10-26): the minutes after STARS — the line's planned and the record's logged, whole minutes, "—" for null. */}
                <td className={`${cell} whitespace-nowrap tabular-nums ${row.plannedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-cell="planned-minutes">{minutesCellWords(row.plannedMinutes)}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums ${row.loggedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-cell="logged-minutes">{minutesCellWords(row.loggedMinutes)}</td>
                <td className={`${money} ${NOT_TYPED_TINT} ${row.cents === null ? BLANK_CLASS : 'font-semibold text-text-primary'}`} data-ledger-cell="budget">{budgetCellWords(row.cents)}</td>
                <td className={`${money} ${row.outcome === 'skipped' ? 'text-text-muted' : row.actualCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="actual">{actualCellWords(row)}</td>
                <td className={`${money} ${NOT_TYPED_TINT} ${row.varianceCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="variance">{varianceCellWords(row.varianceCents)}</td>
                <td className={`${money} ${NOT_TYPED_TINT} ${readableMatchCents(row.match) === null ? BLANK_CLASS : `font-semibold ${matchTone(matchState(row.match, row.actualCents))}`}`} data-ledger-cell="match" title={matchCellTitle(row.match) ?? undefined}>
                  <span data-ledger-match>{matchCellWords(row.match)}</span>
                  <button type="button" className={`${chip} ml-1 font-normal`} onClick={() => setPicking(picking === row.key ? null : row.key)} data-ledger-link={row.key} aria-expanded={picking === row.key}>{LINK_WORDS}</button>
                </td>
                <td className={`${cell} whitespace-nowrap ${NOT_TYPED_TINT} ${row.varianceCents === null ? BLANK_CLASS : actualTone(delta.over)}`} data-ledger-cell="under-over">{underOverWords(row.varianceCents)}</td>
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
        }}
        foot={(
          <tfoot>
            {/* LEDGER-02 (amended): TOTAL spans the columns before BUDGET (fifteen since TIMESHEET-01, 2026-11-24 — START, END and WENT sit among them; twelve since TIME-03 — PLANNED MIN and LOGGED MIN sit among them; their sums are the summary's hours, not this row's); VARIANCE is the column's sum (ledgerTotals), and the ACTUAL tone and UNDER / OVER follow its sign — one truth per row; "—" when no row carries both. */}
            <tr className="border-t border-border font-bold text-text-primary" data-ledger-total>
              <th scope="row" colSpan={15} className={`${cell} text-left`}>{TOTAL_WORDS}</th>
              <td className={`${money} ${totals.budgetCents === null ? BLANK_CLASS : ''}`} data-ledger-total-budget>{budgetCellWords(totals.budgetCents)}</td>
              <td className={`${money} ${totals.actualCents === null ? BLANK_CLASS : totals.varianceCents === null ? '' : varianceTone(totals.varianceCents)}`} data-ledger-total-actual>{budgetCellWords(totals.actualCents)}</td>
              <td className={`${money} ${varianceTone(totals.varianceCents)}`} data-ledger-total-variance>{varianceCellWords(totals.varianceCents)}</td>
              <td className={`${money} ${totals.matchCents === null ? BLANK_CLASS : ''}`} data-ledger-total-match>{matchTotalWords(totals.matchCents)}</td>
              <td className={`${cell} whitespace-nowrap ${varianceTone(totals.varianceCents)}`} data-ledger-total-under-over>{underOverWords(totals.varianceCents)}</td>
              <td className={cell} data-ledger-total-description />
            </tr>
          </tfoot>
        )}
      >
        {period !== null && answer === null && <div className="text-xs text-text-muted" data-ledger-loading>{LEDGER_LOADING_WORDS}</div>}
        {answer !== null && !answer.read.ok && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-ledger-failed>{answer.read.words}</div>}
        {answer !== null && answer.read.ok && rows.length === 0 && <div className="text-xs text-text-muted" data-ledger-none>{noRowsWords(answer.period)}</div>}
        {/* TIMESHEET-03 (Alex, 2026-11-24): THE TINT'S LEGEND — one line above the table while rows are shown: a swatch of the same tint, and what it means in ledger.ts's words. */}
        {answer !== null && answer.read.ok && shown.length > 0 && <div className="flex items-center gap-1.5 text-xs text-text-muted" data-ledger-legend><span className={`inline-block h-3 w-3 rounded-sm border border-border ${NOT_TYPED_TINT}`} aria-hidden="true" data-ledger-legend-swatch /><span>{NOT_TYPED_WORDS}</span></div>}
      </DataTable>
      {answer !== null && answer.read.ok && (
        <>
          {/* LEDGER-04 (Alex, 2026-10-20): THE NOTES — the sentences under the TOTAL row, folded into one toggle closed on every load: "n notes ▸" (notesCount — the lines
              with something to say; a line whose count is 0 is neither counted nor shown; the TODAY rule and the every-book line shown only when open, never counted). Open, the
              same words as before, one per line. React state only. */}
          <div className="text-xs text-text-muted" data-ledger-notes>
            <button type="button" className="hover:text-text-primary" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen} data-ledger-notes-toggle>{notesToggleWords(notesCount(answer.read.value.said, shown.length), notesOpen)}</button>
            {notesOpen && (
              <div className="space-y-0.5 mt-1" data-ledger-said>
                {shown.length > 0 && <p data-ledger-said-variance>{varianceCoverageWords(totals.withVariance, shown.length)}</p>}
                {shown.length > 0 && <p data-ledger-said-match>{matchCoverageWords(totals.withMatch, shown.length)}</p>}
                {shown.length > 0 && <p data-ledger-said-planned>{plannedCoverageWords(totals.withPlanned, shown.length)}</p>}
                {shown.length > 0 && <p data-ledger-said-logged>{loggedCoverageWords(totals.withLogged, shown.length)}</p>}
                {answer.read.value.said.noLine > 0 && <p data-ledger-said-no-line>{noLineWords(answer.read.value.said.noLine, answer.read.value.said.doubled)}</p>}
                {answer.read.value.said.noStay > 0 && <p data-ledger-said-no-stay>{noStayWords(answer.read.value.said.noStay)}</p>}
                {answer.read.value.said.unplaced.length > 0 && <p data-ledger-said-unplaced>{unplacedWords(answer.read.value.said.unplaced)}</p>}
                {answer.read.value.said.notRecorded > 0 && <p data-ledger-said-not-recorded>{notRecordedWords(answer.read.value.said.notRecorded)}</p>}
                {leftOutTotal(answer.read.value.said.leftOut) > 0 && <p data-ledger-said-left-out>{leftOutWords(answer.read.value.said.leftOut)}</p>}
                {answer.read.value.said.notPlaced > 0 && <p data-ledger-said-not-placed>{notPlacedWords(answer.read.value.said.notPlaced)}</p>}
                {/* LINK-LAW-01 (ruling C): the linked postings MATCH left out because they were reversed. */}
                {answer.read.value.said.reversed > 0 && <p data-ledger-said-reversed>{reversedLinkedWords(answer.read.value.said.reversed)}</p>}
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
                        {/* TIME-03 (2026-10-26): the group's minutes as hours to one decimal; "—" when no row of the group carries them. */}
                        <td className={`${money} ${g.totals.plannedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-group-planned-hours>{hoursWords(g.totals.plannedMinutes)}</td>
                        <td className={`${money} ${g.totals.loggedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-group-logged-hours>{hoursWords(g.totals.loggedMinutes)}</td>
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
