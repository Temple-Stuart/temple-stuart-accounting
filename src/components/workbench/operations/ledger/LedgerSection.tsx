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
 *
 * TIMESHEET-02 (Alex, 2026-11-24): THE TIME SHEET, PART TWO — RECORD ON THE ROW.
 * "Id love to make sure I can add in the spending details into the time tab, and can cut out the spread sheets."
 * "can we build it, and once its built, we can make adjustments as needed?"
 * Beside WENT, every row that takes a record carries one "record" chip; it
 * opens, under the row, RecordForm.tsx — its own state (the row's key, React
 * state only), its own <tr> spanning the columns, the leaf keyed by the row's
 * key. The "link" chip, the picker's row and its state are untouched; both may
 * be open. WHICH ROWS TAKE ONE, and what the form is given, is the answer's
 * `recording` (ledger.ts LedgerRecording, by the row's key): the section asks
 * no row which kind it is. A row that takes none has no chip, and its WENT
 * cell's title is the entry's own sentence. After a write the form closes and
 * the section does what it does after "+ expense": the span is read again and
 * the day is announced; a write of the vendor's box reads the span again and
 * leaves the form open.
 *   A WRITE NO LONGER TAKES THE TABLE AWAY. The read effect blanked the answer
 * on every re-read, and the shared table draws only while loaded, so each
 * write — a link, an expense — unmounted every row until the read returned,
 * and would have taken an open form with what was typed in it. Now the answer
 * on screen is blanked only when the period's span changes: a re-read of the
 * same span leaves it drawn, with the loading words shown where the loading
 * line stands while the read is in flight; the new answer replaces it when it
 * arrives, and a read that fails replaces it with its failure, as before. No
 * column is added; the table's width is what it was.
 *
 * SHEET-01 (Alex, 2026-11-28) — THE PAGE IS THE TABLE. Every view, Day too, draws the twenty-five columns (TIMEDAY-01's fold is
 * gone with its class and its place line); the TOTAL row sums PLANNED MIN and LOGGED MIN under their own columns, over the rows
 * shown; and nothing stands under the table — the notes and the summary are deleted here (their words stay in ledger.ts, uncalled).
 */

'use client';

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { localToday } from '@/lib/localToday';
import type { Read } from '../week/weekReads';
import { deltaWords } from '../day/dayCard';
import { readLedger, type LedgerAnswer } from './ledgerReads';
import ExpenseRow, { ExpenseOpen } from './ExpenseForm'; import PasteRows from './PasteRows';
import LinkPicker from './LinkPicker';
import RecordForm from './RecordForm';
import ColumnBox, { type ColumnBoxProps } from './ColumnBox'; import { useOperationsEntity } from '../EntitySelector'; // EDIT-01 (2026-11-28): the one box of a column — an open cell draws it; EDIT-02 (2026-11-28): the provider's books — ENTITY's box lists them, never its selection
import { clearRecordCell, deleteRow, readCellVendors, saveCell, type CellSave, type CellVendors } from './cellSaves'; // EDIT-01 (2026-11-28): what a cell's save writes
import DataTable, { cellClass as cell, chipClass as chip, moneyClass as money } from '@/components/table/DataTable';
import { announceDayWritten } from '../dayWritten';
import {
  CELL_WORDS, LEDGER_COLUMNS, LEDGER_LOADING_WORDS, LEDGER_TABLE, LEDGER_TABLE_CLASS, LEDGER_TITLE_WORDS, LINK_WORDS, NEXT_WORDS, NO_COLUMN_FILTERS,
  NO_FIRST_RECORD_WORDS, PERIOD_KINDS, PERIOD_WORDS, PREVIOUS_WORDS, TOTAL_WORDS,
  accountNameCellWords, actualCellWords, applyColumnFilters, bookCellWords, budgetCellWords, codeCellWords, dayLongWords, firstRecordUnplacedWords,
  ledgerCsvFileName, ledgerTotals, locationCellWords, matchCellTitle, matchCellWords, matchState, matchTotalWords, noRowsWords,
  noteCellWords, periodOf, periodWords, readableMatchCents, regionWords, sortRows, starsCellWords, stepAnchor,
  underOverWords, varianceCellWords, vendorCellWords,
  endCellWords, endOf, startCellWords, startOf, wentCellWords, wentOf, // TIMESHEET-01 (2026-11-24): the three facts of a sheet row and their cells
  minutesCellWords, // TIME-03 (2026-10-26): the minutes cells — SHEET-01 (2026-11-28): and the TOTAL row's two sums; the hours and their coverage went with the summary and the notes
  NOT_TYPED_WORDS, accountPillClassOf, bookPillClassOf, type AccountPlaces, // TIMESHEET-03 (2026-11-24): the legend's words, the two pills' classes, and the accounts' places they are toned by
  RECORD_WORDS, type LedgerRecording, PLANNED_ITEMS_TITLE_WORDS, descriptionOf, plannedDescription, tagCellWords, // TIMESHEET-02 (2026-11-24): the chip's word, and a row's entry in the answer's `recording` · TIMESHEET-04b (2026-11-27): the planned cell's title, what DESCRIPTION says of a row and whether it is planned, and the tag's cell
  type ColumnFilters, type LedgerColumn, type LedgerSheetRow, type LedgerSort, type MatchState, type Period, type PeriodKind,
  CELL_KEYS_WORDS, CLEAR_CELL_QUESTION, CLEAR_RECORD_WORDS, DELETE_ROW_WORDS, DELETE_WORDS, KEEP_WORDS, NEVER_OPENS_WORDS, NO_BOOK_WORDS, boxTextOf, cellOpens, cellReachWords, headWordOf, isTypedColumn, nextOpeningColumn, rowDeleteOf, type LedgerEditing, type RowDelete, type TypedColumn, // EDIT-01 (2026-11-28): the frame's rule and its words
} from '@/lib/operations/ledger';

// IDIOM-01 (2026-10-24): the chip, head, cell and money classes are the shared table's (DataTable.tsx), imported under the names this file always used.
const chipOn = 'px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs';
const BLANK_CLASS = 'text-text-faint'; const PLANNED_CLASS = 'text-text-faint italic'; const CODE_CLASS = 'font-mono text-[11px] text-text-muted mr-1.5 tabular-nums'; // TIMESHEET-04b (2026-11-27): a plan row's planned items under DESCRIPTION — faint and italic: planned, not a record's note. Typed whole, on this line so the file keeps its line count · COALEVELS-01 (2026-11-27): the class of a level's code, printed before its word in four cells (LOCATION, CATEGORY, ENTITY, TYPE) — typed whole, on this line for the same reason
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
  // LEDGER-04: one filter per column (ledger.ts ColumnFilters), the sort (one column, or the ledger's own order) and the column whose popover is
  // open — React state only, nothing stored. IDIOM-01 (2026-10-24): the ▾ buttons' ref map is DataTable's now; the state stays here. SHEET-01 (2026-11-28): the notes toggle and the summary's grouping went with them.
  const [filters, setFilters] = useState<ColumnFilters>(NO_COLUMN_FILTERS);
  const [sort, setSort] = useState<LedgerSort | null>(null);
  const [openFilter, setOpenFilter] = useState<LedgerColumn | null>(null);
  // The last answer and the period it was read for; the first record's day rides every answer, so ALL can start from it.
  const [answer, setAnswer] = useState<{ readonly period: Period; readonly read: Read<LedgerAnswer> } | null>(null);
  const [firstRecord, setFirstRecord] = useState<LedgerAnswer['first_record'] | null>(null);
  // RETRO-01: an expense written from the form — the period is read again. LEDGER-03: a link or unlink from the picker, the same.
  const [writes, setWrites] = useState(0);
  // LEDGER-03: the row whose picker is open (its key), or none. React state only — nothing stored.
  const [picking, setPicking] = useState<string | null>(null);
  // TIMESHEET-02 (2026-11-24): the row whose record form is open (its key), or none — its own state, beside the picker's; both may be open. React state only — nothing stored.
  const [entering, setEntering] = useState<string | null>(null);
  // SHEET-01 (Alex, 2026-11-28): "+ expense" is open — its blank row stands at the top of the table, handed to the shared table as its `first`. Shut at first; React state only.
  const [adding, setAdding] = useState(false);
  // TIMESHEET-02 (2026-11-24): a read is in flight — said where the loading line stands while the answer already on screen stays drawn.
  const [reading, setReading] = useState(false);

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
    // TIMESHEET-02 (Alex, 2026-11-24, ruling E): A WRITE NO LONGER TAKES THE TABLE AWAY. The answer on screen is blanked only when the period's span changes; a
    // re-read of the same span (a write bumped `writes`) leaves it drawn — every row, and a form open under one with what is typed in it — until the new answer
    // replaces it, or the read's failure does. (Until then: setAnswer(null) on every re-read, which unmounted the table for the length of the read.)
    setAnswer((held) => (held !== null && held.period.from === period.from && held.period.to === period.to ? held : null));
    setReading(true);
    (async () => {
      const read = await readLedger(period.from, period.to);
      if (!live) return;
      setAnswer({ period, read });
      setReading(false);
      if (read.ok) setFirstRecord(read.value.first_record);
    })();
    return () => { live = false; };
  }, [period?.from, period?.to, writes]); // eslint-disable-line react-hooks/exhaustive-deps
  // LEDGER-04: a new period starts with every filter off and no popover open — the checklists are the period's own; a re-read after a write keeps them.
  useEffect(() => {
    setFilters(NO_COLUMN_FILTERS);
    setOpenFilter(null);
  }, [period?.from, period?.to]);
  // TIMESHEET-01 (Alex, 2026-11-24): the table's rows are the answer's `sheet` — every line of the period (SHEET-01, 2026-11-28: "every priced line" until then), planned and recorded (its `rows`, the recorded expenses alone, are the home ledger's).
  const rows: readonly LedgerSheetRow[] = answer !== null && answer.read.ok ? answer.read.value.sheet : [];
  // TIMESHEET-03 (Alex, 2026-11-24): each account's place among the accounts the active plans use — the answer's `tones`; the ACCOUNT NAME pill is toned by it (ledger.ts accountPillClassOf).
  const tones: AccountPlaces = answer !== null && answer.read.ok ? answer.read.value.tones : {};
  // TIMESHEET-02 (Alex, 2026-11-24): whether each row takes a record, and what its form is given — the answer's `recording`, by the row's key (the read refuses an answer that lacks a row's entry). No row is asked which kind it is.
  const recording: Readonly<Record<string, LedgerRecording>> = answer !== null && answer.read.ok ? answer.read.value.recording : {};
  // EDIT-01 (Alex, 2026-11-28): what each row's cells can change — the answer's `editing`, by the row's key (the read refuses an answer that lacks a row's entry).
  const editing: Readonly<Record<string, LedgerEditing>> = answer !== null && answer.read.ok ? answer.read.value.editing : {};
  // EDIT-01 (Alex, 2026-11-28): THE FRAME — the open cell, its keys, its save (useCellFrame, below the section in this file); an accepted save reads the span again and announces the day, as "+ expense" does.
  const { open, clearing, cellRefusal, setOpenCell, titleOf, clickCell, boxIn, clearCell, asking, questionOf, askDelete, keepRow, deleteAsked } = useCellFrame(rows, recording, editing, (day) => { setWrites((n) => n + 1); announceDayWritten(day); });
  // LEDGER-04: the rows filtered (every column, AND across), then sorted — the TOTAL row and the CSV read these (SHEET-01, 2026-11-28: the coverage and the summary are gone).
  const shown = sortRows(applyColumnFilters(rows, filters), sort);
  const totals = ledgerTotals(shown);
  // LEDGER-02: the rows SHOWN as a CSV, named by the period read. IDIOM-01 (2026-10-24): the writing (ledger.ts ledgerCsv = the idiom's tableCsv over
  // LEDGER_TABLE — a Blob, UTF-8, no BOM, an object URL revoked after the click) is DataTable's; this file names the file, and nothing to download until a row is shown.
  const csvPeriod: Period | null = answer !== null && answer.read.ok && shown.length > 0 ? answer.period : null;
  const csv = csvPeriod === null ? null : { name: ledgerCsvFileName(csvPeriod.from, csvPeriod.to) };


  return (
    <section className="space-y-1.5 [&_div:has(>[data-ledger-table])]:max-h-[calc(100vh-8rem)] [&_div:has(>[data-ledger-table])]:overflow-y-auto" data-ledger>
      {/* COALEVELS-01 (2026-11-27), Alex — ONE LINE OF CONTROLS. Here stood, each on a line of its own above the table, the title's block,
          then RETRO-01's "+ expense" (a one-off stop, its vendor and its record for a day; the ledger and that day's card read again) and "+ paste rows from a sheet" beside it.
          They stand at the HEAD of the shared table's controls row now (below, where the period's chips begin), so that one row is all that stands above the table. A leaf that is
          shut is its button in that row; open, it takes the row's whole width beneath (its own root's class). The section's class gives the table's box what is left of
          the window, so its head and its TOTAL row hold their place while the rows scroll. These five lines keep the file's line count — every line below keeps its number. */}
      {/* IDIOM-01 (Alex, 2026-10-24): the controls row (with "download CSV", "clear filters" and the reason), the headers, the one popover, the "no row matches"
          state and the table element are the shared DataTable's (components/table/DataTable.tsx) — the ledger's spec, its rows loaded and shown, and its state
          handed in; its own period controls, its lines, each row's cells and the TOTAL row rendered HERE and handed to it, so every cell is still the ledger's words. */}
      <DataTable
        name="ledger"
        columns={LEDGER_TABLE}
        rows={rows}
        shown={shown}
        loaded={answer !== null && answer.read.ok}
        tableClassName={LEDGER_TABLE_CLASS}
        filters={filters}
        onFilters={setFilters}
        noFilters={NO_COLUMN_FILTERS}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={csv}
        first={adding ? <ExpenseRow onWritten={(day) => { setWrites((n) => n + 1); announceDayWritten(day); }} close={() => setAdding(false)} /> : undefined}
        controls={(
          <><h2 className="text-sm font-bold text-brand-purple" data-ledger-title>{LEDGER_TITLE_WORDS}</h2><ExpenseOpen open={adding} onToggle={() => setAdding((open) => !open)} /><PasteRows onWritten={(days) => { setWrites((n) => n + 1); days.forEach(announceDayWritten); }} /><span className="h-4 w-px bg-border" aria-hidden="true" />
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
          <>{answer !== null && answer.read.ok && shown.length > 0 && <span className={`inline-block h-3 w-3 rounded-sm border border-border ${NOT_TYPED_TINT}`} role="img" aria-label={NOT_TYPED_WORDS} title={NOT_TYPED_WORDS} data-ledger-legend data-ledger-legend-swatch />}
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
          // TIMESHEET-02 (2026-11-24): the row's entry in `recording` — it takes a record (the chip, and what its form is given), or it does not (its one sentence).
          const entry = recording[row.key];
          return (
            <Fragment key={row.key}>
              <tr className="border-t border-border" data-ledger-row={row.key} data-ledger-day={row.day}>
                <td className={`${cell} whitespace-nowrap`} data-ledger-cell="day" title={titleOf(row, 'day')}>{questionOf(row) !== null && <button type="button" className={`${chip} mr-1 text-text-faint hover:text-brand-red focus:text-brand-red`} aria-label={DELETE_ROW_WORDS} aria-expanded={asking !== null && asking.key === row.key} onClick={() => askDelete(row)} data-ledger-delete={row.key}>✕</button>}{dayLongWords(row.day)}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums`} data-ledger-cell="date" title={titleOf(row, 'date')} onClick={(e) => clickCell(e, row, 'date')}>{boxIn(row, 'date') ?? row.day}</td>
                {/* TIMESHEET-01 (2026-11-24): START and END after DATE — the clock, the all-day word on a charge, "—" for a blank. */}
                <td className={`${cell} whitespace-nowrap tabular-nums ${startOf(row) === null ? BLANK_CLASS : ''}`} data-ledger-cell="start" title={titleOf(row, 'start')} onClick={(e) => clickCell(e, row, 'start')}>{boxIn(row, 'start') ?? startCellWords(row)}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums ${endOf(row) === null ? BLANK_CLASS : ''}`} data-ledger-cell="end" title={titleOf(row, 'end')} onClick={(e) => clickCell(e, row, 'end')}>{boxIn(row, 'end') ?? endCellWords(row)}</td>
                <td className={`${cell} ${row.place === null ? BLANK_CLASS : ''}`} data-ledger-cell="city" title={titleOf(row, 'city')} onClick={(e) => clickCell(e, row, 'city')}>{boxIn(row, 'city') ?? CELL_WORDS.city(row)}</td><td className={`${cell} ${row.place === null || row.place.region === null ? BLANK_CLASS : ''}`} data-ledger-cell="region" title={titleOf(row, 'region')} onClick={(e) => clickCell(e, row, 'region')}>{boxIn(row, 'region') ?? regionWords(row)}</td>
                <td className={`${cell} ${row.place === null || row.place.country === null ? BLANK_CLASS : ''}`} data-ledger-cell="country" title={titleOf(row, 'country')} onClick={(e) => clickCell(e, row, 'country')}>{boxIn(row, 'country') ?? CELL_WORDS.country(row)}</td><td className={`${cell} ${row.location === null ? BLANK_CLASS : ''}`} data-ledger-cell="location" title={titleOf(row, 'location')} onClick={(e) => clickCell(e, row, 'location')}>{boxIn(row, 'location') ?? <>{row.segments !== null && row.segments.location !== null && <span className={CODE_CLASS}>{row.segments.location}</span>}{locationCellWords(row)}</>}</td>
                {/* COALEVELS-01 (2026-11-27): THE SHEET'S ORDER AND ITS CODES — CITY · REGION · COUNTRY · LOCATION above; CATEGORY · ENTITY · TYPE · ITEMS below (the book's cell stood on this line and the account's code on the next: the entity is the second of the four now, and the row's WHOLE code — COA — stands before BUDGET). A level's code is printed before its word (CODE_CLASS), and never where the row has none. A cell the table's class cuts says itself whole in its title. Each cell keeps its data-ledger-cell name. */}
                <td className={`${cell} ${row.coa === null || row.coa.name === null ? BLANK_CLASS : ''}`} data-ledger-cell="account-name" title={titleOf(row, 'accountName')} onClick={(e) => clickCell(e, row, 'accountName')}>{boxIn(row, 'accountName') ?? <>{row.segments !== null && <span className={CODE_CLASS}>{row.segments.category}</span>}{accountPill === null ? accountNameCellWords(row) : <span className={accountPill} data-ledger-pill="account-name">{accountNameCellWords(row)}</span>}</>}</td>
                <td className={`${cell} whitespace-nowrap ${row.book === null ? BLANK_CLASS : ''}`} data-ledger-cell="book" title={titleOf(row, 'book')} onClick={(e) => clickCell(e, row, 'book')}>{boxIn(row, 'book') ?? <>{row.segments !== null && row.segments.entity !== null && <span className={CODE_CLASS}>{row.segments.entity}</span>}{bookPill === null ? bookCellWords(row) : <span className={bookPill} data-ledger-pill="book">{bookCellWords(row)}</span>}</>}</td>
                <td className={`${cell} font-semibold text-text-primary`} data-ledger-cell="sub-account-name" title={titleOf(row, 'subAccountName', row.description)} onClick={(e) => clickCell(e, row, 'subAccountName')}>{boxIn(row, 'subAccountName') ?? <>{row.segments !== null && row.segments.type !== null && <span className={CODE_CLASS}>{row.segments.type}</span>}{row.description}</>}</td><td className={`${cell} ${descriptionOf(row) === null ? BLANK_CLASS : plannedDescription(row) ? PLANNED_CLASS : 'text-text-muted'}`} data-ledger-cell="description" data-ledger-planned={plannedDescription(row) ? '' : undefined} title={titleOf(row, 'description', plannedDescription(row) ? `${PLANNED_ITEMS_TITLE_WORDS} — ${noteCellWords(descriptionOf(row))}` : descriptionOf(row) ?? undefined)} onClick={(e) => clickCell(e, row, 'description')}>{boxIn(row, 'description') ?? noteCellWords(descriptionOf(row))}</td>
                <td className={`${cell} ${row.vendor === null ? BLANK_CLASS : ''}`} data-ledger-cell="vendor" title={titleOf(row, 'vendor', row.vendor ?? undefined)} onClick={(e) => clickCell(e, row, 'vendor')}>{boxIn(row, 'vendor') ?? vendorCellWords(row.vendor)}</td><td className={`${cell} whitespace-nowrap ${row.instagramTag === null ? BLANK_CLASS : ''}`} data-ledger-cell="instagram-tag" title={titleOf(row, 'instagramTag')} onClick={(e) => clickCell(e, row, 'instagramTag')}>{boxIn(row, 'instagramTag') ?? tagCellWords(row.instagramTag)}</td>
                {/* TIMESHEET-01 (2026-11-24): WENT after VENDOR — went, skipped, planned, not recorded; "—" on a charge. TIMESHEET-02 (2026-11-24): after the word, the
                    "record" chip on every row whose entry takes a record — it opens the row's form beneath; a row that takes none has no chip, its WENT reads "—", and the
                    cell's title is the entry's own sentence saying why. */}
                <td className={`${cell} whitespace-nowrap ${wentOf(row) === null ? BLANK_CLASS : ''}`} data-ledger-cell="went" title={titleOf(row, 'went')} onClick={(e) => clickCell(e, row, 'went')}>
                  {boxIn(row, 'went') ?? <span data-ledger-went>{wentCellWords(row)}</span>}
                  {entry.takes && <button type="button" className={`${chip} ml-1 font-normal`} onClick={() => setEntering(entering === row.key ? null : row.key)} data-ledger-record={row.key} aria-expanded={entering === row.key}>{RECORD_WORDS}</button>}
                </td>
                <td className={`${cell} whitespace-nowrap ${row.rating === null ? BLANK_CLASS : ''}`} data-ledger-cell="stars" title={titleOf(row, 'stars')} onClick={(e) => clickCell(e, row, 'stars')}>{boxIn(row, 'stars') ?? starsCellWords(row.rating)}</td>
                {/* TIME-03 (2026-10-26): the minutes after STARS — the line's planned and the record's logged, whole minutes, "—" for null. */}
                <td className={`${cell} whitespace-nowrap tabular-nums ${row.plannedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-cell="planned-minutes" title={titleOf(row, 'plannedMinutes')}>{minutesCellWords(row.plannedMinutes)}</td>
                <td className={`${cell} whitespace-nowrap tabular-nums ${row.loggedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-cell="logged-minutes" title={titleOf(row, 'loggedMinutes')} onClick={(e) => clickCell(e, row, 'loggedMinutes')}>{boxIn(row, 'loggedMinutes') ?? minutesCellWords(row.loggedMinutes)}</td><td className={`${cell} whitespace-nowrap ${row.segments === null ? BLANK_CLASS : 'font-mono text-[11px] font-semibold text-text-primary'}`} data-ledger-cell="account" title={titleOf(row, 'account')}>{codeCellWords(row)}</td>
                <td className={`${money} ${NOT_TYPED_TINT} ${row.cents === null ? BLANK_CLASS : 'font-semibold text-text-primary'}`} data-ledger-cell="budget" title={titleOf(row, 'budget')} onClick={(e) => clickCell(e, row, 'budget')}>{boxIn(row, 'budget') ?? budgetCellWords(row.cents)}</td>
                <td className={`${money} ${row.outcome === 'skipped' ? 'text-text-muted' : row.actualCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="actual" title={titleOf(row, 'actual')} onClick={(e) => clickCell(e, row, 'actual')}>{boxIn(row, 'actual') ?? actualCellWords(row)}</td>
                <td className={`${money} ${NOT_TYPED_TINT} ${row.varianceCents === null ? BLANK_CLASS : `font-semibold ${actualTone(delta.over)}`}`} data-ledger-cell="variance" title={titleOf(row, 'variance')}>{varianceCellWords(row.varianceCents)}</td>
                <td className={`${money} ${NOT_TYPED_TINT} ${readableMatchCents(row.match) === null ? BLANK_CLASS : `font-semibold ${matchTone(matchState(row.match, row.actualCents))}`}`} data-ledger-cell="match" title={titleOf(row, 'match', matchCellTitle(row.match) ?? undefined)}>
                  <span data-ledger-match>{matchCellWords(row.match)}</span>
                  <button type="button" className={`${chip} ml-1 font-normal`} onClick={() => setPicking(picking === row.key ? null : row.key)} data-ledger-link={row.key} aria-expanded={picking === row.key}>{LINK_WORDS}</button>
                </td>
                <td className={`${cell} whitespace-nowrap ${NOT_TYPED_TINT} ${row.varianceCents === null ? BLANK_CLASS : actualTone(delta.over)}`} data-ledger-cell="under-over" title={titleOf(row, 'underOver')}>{underOverWords(row.varianceCents)}</td>
                <td className={`${cell} ${row.notes === null ? BLANK_CLASS : 'text-text-muted'}`} data-ledger-cell="notes" title={titleOf(row, 'notes', row.notes ?? undefined)} onClick={(e) => clickCell(e, row, 'notes')}>{boxIn(row, 'notes') ?? noteCellWords(row.notes)}</td>
              </tr>
              {/* EDIT-01 (Alex, 2026-11-28): THE OPEN CELL'S LINE — the column's head word, what the change reaches, the keys; WENT none asks first (clear · keep);
                  a refusal in red, the box staying open with what was typed. */}
              {open !== null && open.key === row.key && (
                <tr className="border-t border-border" data-ledger-cell-said={row.key}>
                  <td colSpan={LEDGER_COLUMNS.length} className={cell}>
                    <span className="inline-flex flex-wrap items-center gap-2"><span className="font-semibold text-text-primary" data-ledger-cell-head>{headWordOf(open.column)}</span><span data-ledger-cell-reach>{cellReachWords(open.column, editing[row.key], row.day)}</span><span className="text-text-muted" data-ledger-cell-keys>{CELL_KEYS_WORDS}</span>
                      {clearing && <><span className="text-brand-red" data-ledger-cell-clear>{CLEAR_CELL_QUESTION}</span><button type="button" className={chip} onClick={() => void clearCell(row)} data-ledger-cell-clear-yes>{CLEAR_RECORD_WORDS}</button><button type="button" className={chip} onClick={() => setOpenCell(null)} data-ledger-cell-keep>{KEEP_WORDS}</button></>}
                      {cellRefusal !== null && <span className="text-brand-red" data-ledger-cell-refused>{cellRefusal}</span>}
                    </span>
                  </td>
                </tr>
              )}
              {/* EDIT-01 (Alex, 2026-11-28): THE ✕'S QUESTION — asked in place, in red, by the row's entry: delete · keep; a refusal in the route's words, nothing changed. */}
              {asking !== null && asking.key === row.key && (
                <tr className="border-t border-border" data-ledger-delete-ask={row.key}>
                  <td colSpan={LEDGER_COLUMNS.length} className={cell}>
                    <span className="inline-flex flex-wrap items-center gap-2 text-brand-red"><span data-ledger-delete-question>{questionOf(row)}</span><button type="button" className={`${chip} text-brand-red`} onClick={() => void deleteAsked(row)} data-ledger-delete-yes>{DELETE_WORDS}</button><button type="button" className={chip} onClick={keepRow} data-ledger-delete-keep>{KEEP_WORDS}</button>
                      {asking.refusal !== null && <span data-ledger-delete-refused>{asking.refusal}</span>}
                    </span>
                  </td>
                </tr>
              )}
              {picking === row.key && (
                <tr className="border-t border-border" data-ledger-picker={row.key}>
                  <td colSpan={LEDGER_COLUMNS.length} className={cell}>
                    <LinkPicker kind={row.address.kind} id={row.address.id} instant={row.address.instant} near={row.day} onChanged={() => setWrites((n) => n + 1)} onClose={() => setPicking(null)} />
                  </td>
                </tr>
              )}
              {/* TIMESHEET-02 (Alex, 2026-11-24): THE ROW'S RECORD — its own row beneath, as the picker's: the leaf keyed by the row's key, handed the row and its entry. An accepted
                  write closes it, reads the span again and announces the day ("+ expense"'s own two); the vendor's box reads the span again and leaves it open. */}
              {entering === row.key && entry.takes && (
                <tr className="border-t border-border" data-ledger-recording={row.key}>
                  <td colSpan={LEDGER_COLUMNS.length} className={cell}>
                    <RecordForm key={row.key} row={row} entry={entry} onWritten={(day) => { setEntering(null); setWrites((n) => n + 1); announceDayWritten(day); }} onVendor={() => setWrites((n) => n + 1)} onClose={() => setEntering(null)} />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        }}
        foot={(
          <tfoot>
            {/* LEDGER-02 (amended): TOTAL spans the columns before BUDGET (nineteen since COALEVELS-01 (2026-11-27) — REGION, LOCATION, ITEMS and COA sit among them, and one cell follows the five, under NOTES; sixteen since TIMESHEET-04b, 2026-11-27 — INSTAGRAM TAG sits among them; fifteen since TIMESHEET-01, 2026-11-24 — START, END and WENT sit among them; less the columns a single day folds, TIMEDAY-01, 2026-11-24 — ledger.ts dayFoldCount; twelve since TIME-03 — PLANNED MIN and LOGGED MIN sit among them; their sums are the summary's hours, not this row's); VARIANCE is the column's sum (ledgerTotals), and the ACTUAL tone and UNDER / OVER follow its sign — one truth per row; "—" when no row carries both. */}
            <tr className="border-t border-border font-bold text-text-primary" data-ledger-total>
              {/* SHEET-01 (Alex, 2026-11-28): the label spans the columns before PLANNED MIN — LEDGER_COLUMNS.indexOf('plannedMinutes'), sixteen, worked out and never typed;
                  then PLANNED MIN and LOGGED MIN, each its column's sum over the rows shown (ledgerTotals, by any filter; "—" when no row shown carries one); then COA's
                  cell, empty; then BUDGET … NOTES as before. Nineteen, typed, until then — and the day view's fold took its five off. */}
              <th scope="row" colSpan={LEDGER_COLUMNS.indexOf('plannedMinutes')} className={`${cell} text-left`}>{TOTAL_WORDS}</th>
              <td className={`${cell} whitespace-nowrap tabular-nums ${totals.plannedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-total-planned-minutes>{minutesCellWords(totals.plannedMinutes)}</td>
              <td className={`${cell} whitespace-nowrap tabular-nums ${totals.loggedMinutes === null ? BLANK_CLASS : ''}`} data-ledger-total-logged-minutes>{minutesCellWords(totals.loggedMinutes)}</td>
              <td className={cell} data-ledger-total-account />
              <td className={`${money} ${totals.budgetCents === null ? BLANK_CLASS : ''}`} data-ledger-total-budget>{budgetCellWords(totals.budgetCents)}</td>
              <td className={`${money} ${totals.actualCents === null ? BLANK_CLASS : totals.varianceCents === null ? '' : varianceTone(totals.varianceCents)}`} data-ledger-total-actual>{budgetCellWords(totals.actualCents)}</td>
              <td className={`${money} ${varianceTone(totals.varianceCents)}`} data-ledger-total-variance>{varianceCellWords(totals.varianceCents)}</td>
              <td className={`${money} ${totals.matchCents === null ? BLANK_CLASS : ''}`} data-ledger-total-match>{matchTotalWords(totals.matchCents)}</td>
              <td className={`${cell} whitespace-nowrap ${varianceTone(totals.varianceCents)}`} data-ledger-total-under-over>{underOverWords(totals.varianceCents)}</td>
              <td className={cell} data-ledger-total-notes />
            </tr>
          </tfoot>
        )}
      >
        {/* TIMESHEET-02 (2026-11-24): the loading words while no answer is on screen — and, the answer kept through a re-read of the same span, while that read is in flight. */}
        {period !== null && (answer === null || reading) && <div className="text-xs text-text-muted" data-ledger-loading>{LEDGER_LOADING_WORDS}</div>}
        {answer !== null && !answer.read.ok && <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-ledger-failed>{answer.read.words}</div>}
        {answer !== null && answer.read.ok && rows.length === 0 && <div className="text-xs text-text-muted" data-ledger-none>{noRowsWords(answer.period)}</div>}
        {/* COALEVELS-01 (2026-11-27), Alex — THE TINT'S LEGEND IS ITS SWATCH: it stands in the controls row's trailing now (above), and what it means — ledger.ts NOT_TYPED_WORDS — is its label and its title,
            said on hover. The line of its own it stood on here (TIMESHEET-03, 2026-11-24: the swatch, and the sentence beside it) went with the white space above the table. */}
      </DataTable>
      {/* SHEET-01 (Alex, 2026-11-28): "just one, bad ass table … built like an excel table". THE NOTES stood here (LEDGER-04's toggle, the four coverage lines,
          the said lines, the TODAY rule, the every-book line) and THE SUMMARY under them (over time, by place and by entity — the groups, their days, sums and hours):
          both are deleted, with the state only they used. The page is the table; nothing stands under it. Their words stay in ledger.ts, uncalled. */}
    </section>
  );
}

// ── EDIT-01 (Alex, 2026-11-28): THE FRAME — a cell he types opens as its box and saves where its value lives ──────
//
// "built like an excel table. Filterable, Editable, so I can clean my data !!!" The section's own hook, in its own file: THE OPEN CELL — its row's key
// and its column, or none (one cell at a time) — the text in its box, the last save's refusal, and WENT none asking first; React state only, nothing
// stored, the refs holding the same for a save that runs on past the render that started it. A typed cell opens on click where the rule says its row's
// entries allow (ledger.ts cellOpens), holding the cell's value as typed text (boxTextOf), in its column's own box (ColumnBox.tsx). Enter saves; Tab
// saves, then opens the next cell to the right on the row that opens; Esc puts it back, nothing written; leaving the box saves when its text changed and
// closes when it did not; opening another cell saves the open one first. A save goes through its column's writer (cellSaves.ts); refused, the words
// stay on the line beneath in red and the box stays open with what was typed; accepted, `written` is told the row's day. It stands below the section so
// that the section's lines the registry cites stay where they stand while the frame grows.
//   PART 3 (2026-11-28): the plan's cells and the vendor's open by the row's `editing` entry too, and a cell that does not open says why after its own
// title. A VENDOR cell reads the book's vendors once when it opens (cellSaves.ts readCellVendors) and lists the row's book's under its box; CATEGORY
// lists the row's book's chart. Every save goes through cellSaves.ts saveCell, which sorts a cell to its writer.
//   PART 4 (2026-11-28): THE ✕'S QUESTION — the row whose ✕ was pressed, and the route's refusal, or none (one question at a time; React state only).
// What a ✕ deletes and what it asks are the rule's (ledger.ts rowDeleteOf); delete goes through cellSaves.ts deleteRow; keep closes the question,
// nothing deleted. Opening a cell, or another ✕, closes it; so does its row leaving the sheet. No window.confirm, no browser pop-up.
//   EDIT-02 (Alex, 2026-11-28): EVERY typed cell opens on every row. A refusal the rule knows before any typing (ledger.ts cellOpens) is said on the
// line beneath as the cell opens, and Enter is refused in those words while the text stands changed — a box never opens to fail silently; such a cell's
// title says it too. ENTITY's box lists the provider's books (its list, never its selection) — the blank row's no-book words while it has none. A row
// with no plan has no book: its CATEGORY lists no chart and its VENDOR no vendors, and its line says why nothing there saves.

/** An open cell — its row's key and its column. */
type OpenCell = { readonly key: string; readonly column: TypedColumn };

function useCellFrame(rows: readonly LedgerSheetRow[], recording: Readonly<Record<string, LedgerRecording>>, editing: Readonly<Record<string, LedgerEditing>>, written: (day: string) => void) {
  const [open, setOpen] = useState<OpenCell | null>(null);
  const [text, setText] = useState('');
  const [cellRefusal, setCellRefusal] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const openRef = useRef<OpenCell | null>(null);
  const textRef = useRef('');
  const heldRef = useRef('');
  const refusedRef = useRef<string | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const [vendors, setVendors] = useState<CellVendors>({ kind: 'reading' });
  const vendorsRef = useRef<CellVendors>({ kind: 'reading' });
  const vendorsAsked = useRef(0);
  const [asking, setAsking] = useState<{ readonly key: string; readonly refusal: string | null } | null>(null);
  const deletingRef = useRef(false);
  const { entities } = useOperationsEntity();
  /** The book's vendors, read once a VENDOR cell opens — the last read asked is the one kept; a name refused while they were read may be sent again once they are. */
  const readTheVendors = () => {
    const asked = vendorsAsked.current + 1;
    vendorsAsked.current = asked; vendorsRef.current = { kind: 'reading' }; setVendors({ kind: 'reading' });
    void readCellVendors().then((read) => { if (vendorsAsked.current !== asked) return; vendorsRef.current = read; refusedRef.current = null; setVendors(read); });
  };
  /** The open cell, set in state and in its refs together: a cell opens with its text and the refusal the rule knows before any typing (none: null); a VENDOR cell reads the vendors. */
  const setOpenCell = (next: OpenCell | null, opened = '', ruled: string | null = null) => {
    openRef.current = next; textRef.current = opened; heldRef.current = opened; refusedRef.current = null;
    setOpen(next); setText(opened); setCellRefusal(ruled); setClearing(false);
    if (next !== null && next.column === 'vendor') readTheVendors();
    if (next !== null) setAsking(null);
  };
  const typeInCell = (value: string) => { textRef.current = value; refusedRef.current = null; setText(value); setClearing(false); };
  // An open cell whose row is no longer on the sheet (another period, or a write that moved the row) closes — there is no row to save it to.
  useEffect(() => {
    setAsking((held) => (held === null || rows.some((r) => r.key === held.key) ? held : null));
    const at = openRef.current;
    if (at === null || rows.some((r) => r.key === at.key)) return;
    openRef.current = null; setOpen(null); setCellRefusal(null); setClearing(false);
  }, [rows]);
  /** A typed cell's refusal before any typing — the rule's, by the row's entries; null: it saves what is typed. */
  const refusalOf = (row: LedgerSheetRow, column: TypedColumn): string | null => cellOpens(column, row, recording[row.key], editing[row.key]).refusal;
  /** A cell's title: a column that never opens says why, and a typed cell whose save is refused before any typing says why — each after the cell's own, when it has one; else the cell's own. */
  const titleOf = (row: LedgerSheetRow, column: LedgerColumn, own?: string): string | undefined => {
    if (!isTypedColumn(column)) return own === undefined ? NEVER_OPENS_WORDS[column] : `${own} — ${NEVER_OPENS_WORDS[column]}`;
    const ruled = refusalOf(row, column);
    if (ruled === null) return own;
    return own === undefined ? ruled : `${own} — ${ruled}`;
  };
  /** A cell's save, by its column and the row's entries — sorted to its writer by cellSaves.ts; VENDOR with the vendors as read. */
  const saveOf = (row: LedgerSheetRow, column: TypedColumn, typed: string): Promise<CellSave> => saveCell(row, recording[row.key], editing[row.key], column, typed, vendorsRef.current, new Date());
  /** Saves the open cell when its text changed: true when it closed (saved, or nothing changed), false when it stays open (refused, or WENT none asking first). One save at a time. */
  const commit = (): Promise<boolean> => {
    if (savingRef.current !== null) return savingRef.current;
    const at = openRef.current;
    if (at === null) return Promise.resolve(true);
    const row = rows.find((r) => r.key === at.key);
    if (row === undefined || textRef.current === heldRef.current) { setOpenCell(null); return Promise.resolve(true); }
    // Refused before any typing (the rule's, by the row's entries): said on the line, nothing sent.
    const ruled = refusalOf(row, at.column);
    if (ruled !== null) { setCellRefusal(ruled); return Promise.resolve(false); }
    const typed = textRef.current;
    // Refused as it stands: said already on the line beneath, not sent again until it changes.
    if (refusedRef.current === typed) return Promise.resolve(false);
    // WENT none on a held record is a clear — asked first, on the line beneath.
    if (at.column === 'went' && typed === '') { setClearing(true); return Promise.resolve(false); }
    const run = (async (): Promise<boolean> => {
      setCellRefusal(null);
      const saved = await saveOf(row, at.column, typed);
      if (!saved.ok) { refusedRef.current = typed; setCellRefusal(saved.words); return false; }
      setOpenCell(null);
      written(row.day);
      return true;
    })();
    savingRef.current = run;
    void run.finally(() => { savingRef.current = null; });
    return run;
  };
  /** WENT none, asked and answered: the record cleared through the one writer. */
  const clearCell = async (row: LedgerSheetRow) => {
    const entry = recording[row.key];
    if (!entry.takes || entry.held === null) throw new Error(`LedgerSection: ${row.key} was asked to clear a record it does not hold`);
    const cleared = await clearRecordCell(entry.held);
    if (!cleared.ok) { setClearing(false); refusedRef.current = textRef.current; setCellRefusal(cleared.words); return; }
    setOpenCell(null);
    written(row.day);
  };
  /** What a row's ✕ deletes, and its question — the rule's; null: the row has no ✕. */
  const deleteOf = (row: LedgerSheetRow): RowDelete | null => rowDeleteOf(row, recording[row.key], editing[row.key]);
  const questionOf = (row: LedgerSheetRow): string | null => { const target = deleteOf(row); return target === null ? null : target.question; };
  /** A ✕ pressed: its question asked on the line beneath the row — one at a time, another ✕ asks its own instead. */
  const askDelete = (row: LedgerSheetRow) => setAsking({ key: row.key, refusal: null });
  /** keep: the question closed, nothing deleted. */
  const keepRow = () => setAsking(null);
  /** delete, answered: the row's routine or its record deleted through its writer — refused, the route's words on the line and nothing changed; accepted, the span read again and the day told. One at a time. */
  const deleteAsked = async (row: LedgerSheetRow) => {
    const target = deleteOf(row);
    if (target === null) throw new Error(`LedgerSection: ${row.key} was asked to delete, and it has nothing to delete`);
    if (deletingRef.current) return;
    deletingRef.current = true;
    try {
      const done = await deleteRow(target);
      if (!done.ok) { setAsking({ key: row.key, refusal: done.words }); return; }
      setAsking(null);
      written(row.day);
    } finally {
      deletingRef.current = false;
    }
  };
  /** A typed cell opens when its row's entries allow — the open one saved first (refused, it stays open, and this one does not). */
  const openCell = async (row: LedgerSheetRow, column: TypedColumn) => {
    const at = openRef.current;
    if (at !== null && at.key === row.key && at.column === column) return;
    if (at !== null && !(await commit())) return;
    setOpenCell({ key: row.key, column }, boxTextOf(row, column, editing[row.key]), refusalOf(row, column));
  };
  /** A click on a typed cell — a chip in it (the record's, the link's) and the open box keep their own clicks. */
  const clickCell = (e: MouseEvent<HTMLElement>, row: LedgerSheetRow, column: TypedColumn) => {
    if ((e.target as HTMLElement).closest('button, input, select, a') !== null) return;
    void openCell(row, column);
  };
  /** The open box's keys: Enter saves; Tab saves, then opens the next cell to the right on the row that opens; Esc puts it back, nothing written. */
  const keyOf = (e: KeyboardEvent<HTMLElement>, row: LedgerSheetRow, column: TypedColumn) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpenCell(null); return; }
    if (e.key === 'Enter') { e.preventDefault(); void commit(); return; }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const next = nextOpeningColumn(column);
      void commit().then((closed) => { if (closed && next !== null) setOpenCell({ key: row.key, column: next }, boxTextOf(row, next, editing[row.key]), refusalOf(row, next)); });
    }
  };
  /** What an open box lists: CATEGORY the row's book's chart; VENDOR the row's book's vendors as read — none while they are read or when the read failed (a name typed then is refused on save, in the read's words). */
  const listsOf = (row: LedgerSheetRow, column: TypedColumn): Pick<ColumnBoxProps, 'entityId' | 'vendors' | 'listId' | 'books' | 'code'> => {
    if (column === 'book') return { books: entities, code: boxTextOf(row, 'accountName', editing[row.key]) }; // EDIT-04 (2026-11-29): and the row's CATEGORY — each other book's accounts listed under ENTITY; { books: entities } until then
    if (column !== 'accountName' && column !== 'vendor') return {};
    const can = editing[row.key];
    // A row with no plan has no book — no chart, no vendors; its line says why nothing there saves (the rule's refusal, before any typing).
    if (column === 'accountName') return { entityId: can.plan ? can.entityId : '' };
    return { vendors: can.plan && vendors.kind === 'read' ? vendors.vendors.filter((v) => v.entity_id === can.entityId) : [], listId: 'ledger-cell-vendors' };
  };
  /** The open cell's box — its column's own (ColumnBox), holding the text, with what it lists, its keys, its leaving (blur saves a change) and its focus; null on every other cell. */
  const boxIn = (row: LedgerSheetRow, column: TypedColumn): ReactNode => {
    if (open === null || open.key !== row.key || open.column !== column) return null;
    if (column === 'book' && entities.length === 0) return <span className="text-brand-amber" data-ledger-cell-no-book>{NO_BOOK_WORDS}</span>;
    return <ColumnBox column={column} value={text} onChange={typeInCell} {...listsOf(row, column)} onKeyDown={(e) => keyOf(e, row, column)} onBlur={() => void commit()} autoFocus />;
  };
  return { open, clearing, cellRefusal, setOpenCell, titleOf, clickCell, boxIn, clearCell, asking, questionOf, askDelete, keepRow, deleteAsked };
}
