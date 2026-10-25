/**
 * JOURNAL-07 (Alex, 2026-10-24) — THE JOURNALS DAY OVER DAY, PURE.
 *
 * "Daily journals, morning and evening, should be tables of data collected day
 * over day, stacked rows." Two tables on /time under the task ledger, in the
 * shared idiom (IDIOM-01: src/lib/table, components/table/DataTable.tsx), each
 * over the rows the range route answers (api/operations/journal/range — the
 * days that HAVE a journal row; a day without one is no row, ruling D):
 *
 *   MORNING  DAY · DATE · GOALS · BLOCKER · PLAN · DONE
 *   EVENING  DAY · DATE · ACCOMPLISHED · GAPS · EVOLUTION · DIRECTION · ALIGNMENT · ON TRACK · NEXT
 *
 * (ruling C — EVENING_ORDER's order and the card's labels, journal.ts). DAY is
 * the weekday (the ledger's dayLongWords, sorted by its number), DATE the ISO
 * day, DONE the ticks "n of m" (doneWords; "—" with no plan); the rest are TEXT
 * columns — GOALS one goal per line, PLAN one step per line each prefixed ✓ or
 * ☐ from plan_done through the card's one rule (planStepWords, the index
 * included — ruling 3), the evening's seven as typed. A null answer prints "—"
 * (BLANK) and is an EMPTY field in the CSV; a filter matches the FULL text,
 * never the preview; the CSV carries the full text (csv.ts quotes line breaks).
 * The retired fields (journal.ts RETIRED_FIELDS) are read by nothing here.
 *
 * LONG TEXT (ruling E): a cell shows the first 160 code points, then
 * "… (<n> chars)" and a control that opens all of it — "all of it" / "less"
 * (ruling 5) — the projects' notes precedent (projectsTableText.ts
 * notesPreview), counted in code points so a character is never cut in half.
 *
 * Under each table one line: "<n> of <m> days in the period have a journal"
 * (n the rows loaded, m the span's days — the ledger's spanDays). Zero rows
 * loaded is the ledger's idiom (ruling 2(a)): "no journal ‹period›", no table.
 * Pure: no React, no fetch, no clock.
 */
import type { TableColumn } from '@/lib/table/columns';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { dayLongWords, periodWords, weekdayNumber, type Period } from '@/lib/operations/ledger';
import { EVENING_LABELS, EVENING_ORDER, planStepWords, type EveningField, type JournalRow } from '@/lib/operations/journal';

export const JOURNAL_TABLE_KINDS = ['morning', 'evening'] as const;
export type JournalTableKind = (typeof JOURNAL_TABLE_KINDS)[number];

/** One row of either table: a day that HAS a journal — the row as the range route answers it, keyed by its id. */
export interface JournalDayRow {
  readonly id: string;
  readonly day: string;
  readonly journal: JournalRow;
}
/** The route's rows as the tables' rows, in the order given (day ascending — the table's own order). */
export const journalDayRows = (journals: readonly JournalRow[]): JournalDayRow[] => journals.map((j) => ({ id: j.id, day: j.day, journal: j }));

// ── THE CELLS' TEXTS ────────────────────────────────────────────────────────

/** GOALS — one per line; null when none was typed. */
export const goalsText = (j: JournalRow): string | null => (j.goals.length === 0 ? null : j.goals.join('\n'));
/** PLAN — one step per line, each "✓ 1. step" or "☐ 1. step" (the card's planStepWords); null with no plan. A tick count that is not the steps' is the database's error (the migration's CHECK holds one tick per step), thrown. */
export function planText(j: JournalRow): string | null {
  if (j.plan_steps.length === 0) return null;
  if (j.plan_done.length !== j.plan_steps.length) throw new Error(`journal ${j.day}: ${j.plan_done.length} ticks for ${j.plan_steps.length} steps — one tick per step`);
  return j.plan_steps.map((step, i) => planStepWords(i + 1, step, j.plan_done[i])).join('\n');
}
/** The ticks of a plan — the steps done. */
export const ticksOf = (j: JournalRow): number => j.plan_done.filter((done) => done).length;
/** "2 of 3" — DONE's words (ruling 4; the card's "2 of 3 done" sits under the plan, this column's head already says DONE). */
export const doneWords = (done: number, of: number): string => `${done} of ${of}`;
/** DONE's cell: the ticks over the steps; "—" with no plan. */
export const doneCellWords = (j: JournalRow): string => (j.plan_steps.length === 0 ? BLANK : doneWords(ticksOf(j), j.plan_steps.length));

// ── THE COLUMNS ─────────────────────────────────────────────────────────────

export const MORNING_COLUMNS = ['day', 'date', 'goals', 'blocker', 'plan', 'done'] as const;
export type MorningColumn = (typeof MORNING_COLUMNS)[number];
export const MORNING_HEAD_WORDS = ['DAY', 'DATE', 'GOALS', 'BLOCKER', 'PLAN', 'DONE'] as const;
export const EVENING_COLUMNS = ['day', 'date', ...EVENING_ORDER] as const;
export type EveningColumn = 'day' | 'date' | EveningField;
/** The evening's heads: the card's labels (EVENING_LABELS), in the card's order (EVENING_ORDER). */
export const EVENING_HEAD_WORDS: readonly string[] = ['DAY', 'DATE', ...EVENING_ORDER.map((f) => EVENING_LABELS[f])];

/** DAY — the weekday, sorted Monday 1 … Sunday 7 (the ledger's rule). */
const DAY_COLUMN: TableColumn<JournalDayRow, 'day'> = { key: 'day', label: 'DAY', kind: 'value', words: (r) => dayLongWords(r.day), sortKey: (r) => numberKey(weekdayNumber(r.day)), csv: (r) => dayLongWords(r.day) };
/** DATE — the ISO day; sorted by its text, which orders by day (IDIOM-01: a date column is a VALUE column). */
const DATE_COLUMN: TableColumn<JournalDayRow, 'date'> = { key: 'date', label: 'DATE', kind: 'value', words: (r) => r.day, sortKey: (r) => textKey(r.day), csv: (r) => r.day };
/** A TEXT column over one answer: "—" on screen and '' in the CSV for null; the filter and the sort read the full text. */
const textColumn = <K extends string>(key: K, label: string, text: (j: JournalRow) => string | null): TableColumn<JournalDayRow, K> => ({
  key, label, kind: 'text',
  words: (r) => text(r.journal) ?? BLANK,
  sortKey: (r) => textKey(text(r.journal)),
  csv: (r) => text(r.journal) ?? '',
  text: (r) => text(r.journal),
});
/** DONE — "n of m" as a VALUE column: a checklist of its words, sorted by them (numeric), the blank last. */
const DONE_COLUMN: TableColumn<JournalDayRow, 'done'> = {
  key: 'done', label: 'DONE', kind: 'value',
  words: (r) => doneCellWords(r.journal),
  sortKey: (r) => (r.journal.plan_steps.length === 0 ? null : textKey(doneCellWords(r.journal))),
  csv: (r) => (r.journal.plan_steps.length === 0 ? '' : doneCellWords(r.journal)),
};

export const MORNING_TABLE: readonly TableColumn<JournalDayRow, MorningColumn>[] = [
  DAY_COLUMN,
  DATE_COLUMN,
  textColumn('goals', 'GOALS', goalsText),
  textColumn('blocker', 'BLOCKER', (j) => j.blocker),
  textColumn('plan', 'PLAN', planText),
  DONE_COLUMN,
];
export const EVENING_TABLE: readonly TableColumn<JournalDayRow, EveningColumn>[] = [
  DAY_COLUMN,
  DATE_COLUMN,
  ...EVENING_ORDER.map((f) => textColumn<EveningField>(f, EVENING_LABELS[f], (j) => j[f])),
];
export const JOURNAL_TABLES: Readonly<Record<JournalTableKind, readonly TableColumn<JournalDayRow, string>[]>> = { morning: MORNING_TABLE, evening: EVENING_TABLE };

// ── LONG TEXT (ruling E) ────────────────────────────────────────────────────

// COLUMNS-01b (Alex, 2026-10-25, ruling 3): the preview rule — PREVIEW_CHARS, previewMoreWords, previewOf, EXPAND_WORDS ("all of it"),
// COLLAPSE_WORDS ("less") — moved verbatim to the table idiom (src/lib/table/preview.ts), where components/table/TextCell.tsx reads it for
// the journal tables and PROJECTS alike; re-exported here so this module still names its rule.
export { COLLAPSE_WORDS, EXPAND_WORDS, PREVIEW_CHARS, previewMoreWords, previewOf } from '@/lib/table/preview';
/** One expanded state per cell: the row's id and the column's key. */
export const cellKeyOf = (row: JournalDayRow, column: string): string => `${row.id}:${column}`;

// ── WORDS ───────────────────────────────────────────────────────────────────

export const JOURNAL_TITLE_WORDS: Readonly<Record<JournalTableKind, string>> = { morning: 'Morning journal', evening: 'Evening journal' };
export const JOURNALS_LOADING_WORDS = 'reading the journals…';
export const journalsFailedWords = (words: string): string => `The journals could not be read — ${words}`;
/** Zero rows loaded — the ledger's idiom: the words, no table (ruling 2(a)). */
export const noJournalWords = (p: Period): string => `no journal ${periodWords(p)}`;
/** ALL with no journal yet: there is no first day to start from (ruling 1(b)). */
export const NO_FIRST_JOURNAL_WORDS = 'no journal yet — ALL starts at the first journal';
/** Under each table: the days that have a journal over the span's days (ruling D). */
export const daysWithJournalWords = (n: number, m: number): string => `${n} of ${m} days in the period have a journal`;
/** "journal-morning_2026-10-01_2026-10-31.csv" (ruling B). */
export const journalCsvFileName = (which: JournalTableKind, from: string, to: string): string => `journal-${which}_${from}_${to}.csv`;
