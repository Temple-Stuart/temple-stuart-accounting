/**
 * WORK-01 (Alex, 2026-10-24) — TASKS IS ONE TABLE: THE WORK, PURE.
 *
 * /tasks is THE WORK first, then PROJECTS. THE WORK is one DataTable (IDIOM-01:
 * src/lib/table, components/table/DataTable.tsx; name 'work'): one row per
 * routine LINE (a routine with no lines is one row) and one row per task, every
 * book, in the shared idiom — filters, sort, CSV. Its columns (ruling A):
 *
 *   KIND · NAME · PROJECT · BOOK · CADENCE · DAYS · TIME · DEADLINE · AMOUNT · ACCOUNT · STATUS · controls
 *
 *   · KIND     once | repeated — a task is once; a routine is once when its rule
 *              is Once (rruleHelpers isOnceRRule: FREQ=DAILY;COUNT=1), else repeated.
 *   · NAME     the routine's name (on each of its line rows) or the task's title.
 *   · PROJECT  the task's project title; a routine has none.
 *   · BOOK     the row's book by name (the tab's entity list); a book the tab has
 *              not listed is "book not loaded" (ROUTINES-01's words), never dropped.
 *   · CADENCE  the rule's word as FORM-01 prints it (rruleHelpers cadenceWords).
 *   · DAYS     the days the rule falls on (daysWords); a rule no choice reproduces
 *              has none.
 *   · TIME     the window (timeWords, "HH:MM – HH:MM"); "all day" where the rule
 *              names no clock or the routine is all day (ALLDAY-01); a task has none.
 *   · DEADLINE the task's deadline, drawn as the projects table drew it; sorted and
 *              written as the ISO day; a routine has none.
 *   · AMOUNT   the line's amount, a stepless routine's own, a task's estimated cost
 *              — a routine's figure through the LINES-01 leaf (routinePlanned), never
 *              the column read bare. Blank is blank, never 0.
 *   · ACCOUNT  the saved code drawn through ROUTINES-01's helper (accountCell: the
 *              book's letter and the four digits) with the chart's name beside it —
 *              "P-6150 Food & drink"; the helper's other states print their words.
 *   · STATUS   a routine's active | ended | inactive — ended first (ROUTINE-02a's
 *              endedBy, judged now in the routine's own zone), then is_active — or
 *              a task's status words (TASK_STATUS_LABELS, via taskStatusWords).
 *              ROUTINE-02a (Alex, 2026-10-18) — THE ARCHIVE lives here now: an ended
 *              routine is a row with STATUS ended, dropped by the default STATUS filter
 *              and shown again when its chip is cleared — never deleted, never
 *              deactivated, read-only but for edit (RoutineEditForm).
 *
 * A cell with nothing is "—" (BLANK) on screen and '' in the CSV. Kinds: AMOUNT
 * money; KIND, BOOK, CADENCE, DAYS, TIME, DEADLINE, STATUS value; NAME, PROJECT,
 * ACCOUNT text.
 *
 * THE DEFAULT (ruling B): the rows shown at first are the active routines and the
 * non-archived tasks — as a VISIBLE STATUS filter already applied, the chip
 * reading "STATUS: not ended, not archived", which the user clears to see
 * everything. Never a hidden default: the reads bring every routine and every
 * task (archived included); the filter alone narrows.
 *
 * THE TABLE'S OWN ORDER: the routines in clock order then name (FORM-01's
 * byClockThenName), each routine's lines in step order under it; then the tasks,
 * project by project as the projects read returns them, each project's tasks in
 * display order. Pure: no React, no fetch, no clock — `now` is handed in.
 */
import type { TableColumn } from '@/lib/table/columns';
import { csvMoney } from '@/lib/table/csv';
import { NO_VALUE_FILTER, noFilters, valueFilterOf, withFilter, type TableFilters } from '@/lib/table/filters';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { ACCOUNT_CELL_WORDS, accountCell, type AccountCellBook } from '@/lib/coa/accountCell';
import { routinePlanned, type LinePlanned, type RoutinePlanned } from '@/lib/operations/routineLines';
import { DAYS_NONE_WORDS, byClockThenName, cadenceWords, daysWords, endedBy, isOnceRRule, timeWords, type RoutineEnd } from '@/lib/operations/rruleHelpers';
import type { Routine } from '@/components/workbench/operations/routines/types';
import type { CoaAccountSummary, Project, ProjectStatus, Task } from '@/components/workbench/operations/projects/types';
import { formatDate, taskStatusWords } from '@/components/workbench/operations/projects/projectsTableText';

// ── THE INPUTS ───────────────────────────────────────────────────────────────

/** One book of the tab's entity list: its id, its type (the letter) and its name. */
export interface WorkBook extends AccountCellBook { readonly name: string }
/** A book's chart as GET /api/chart-of-accounts?entity_id= lists it. */
export type WorkChart = readonly CoaAccountSummary[];
/** The charts by book id — one read per book of the entity list. */
export type WorkCharts = Readonly<Record<string, WorkChart>>;
/** A project with its tasks as the tasks GET returns them (archived included — the filter narrows, never the read). */
export interface WorkProject { readonly project: Project; readonly tasks: readonly Task[] }

// ── THE ROWS ─────────────────────────────────────────────────────────────────

/** One row of THE WORK: a routine line (or a stepless routine, `line` null) with the leaf's judgement, or a task with its project. */
export type WorkRow =
  | { readonly id: string; readonly of: 'routine'; readonly routine: Routine; readonly planned: RoutinePlanned; readonly line: LinePlanned | null; readonly end: RoutineEnd }
  | { readonly id: string; readonly of: 'task'; readonly task: Task; readonly project: Project };

/** The rows, in the table's own order (the header above). One row per routine line, one per stepless routine, one per task. */
export function workRowsOf(routines: readonly Routine[], projects: readonly WorkProject[], now: Date): WorkRow[] {
  const rows: WorkRow[] = [];
  for (const routine of [...routines].sort(byClockThenName)) {
    const planned = routinePlanned({ budget_amount: routine.budget_amount ?? null, coa_code: routine.coa_code ?? null, steps: routine.steps });
    const end = endedBy(routine.end_date, routine.timezone, now);
    if (planned.lines.length === 0) rows.push({ id: `routine:${routine.id}`, of: 'routine', routine, planned, line: null, end });
    else for (const line of planned.lines) rows.push({ id: `routine:${routine.id}:${line.id}`, of: 'routine', routine, planned, line, end });
  }
  for (const { project, tasks } of projects) for (const task of tasks) rows.push({ id: `task:${task.id}`, of: 'task', task, project });
  return rows;
}

// ── THE CELLS ────────────────────────────────────────────────────────────────

export const WORK_KINDS = ['once', 'repeated'] as const;
export type WorkKind = (typeof WORK_KINDS)[number];
/** KIND — a task is once; a routine is once when its rule is Once, else repeated. */
export const kindOf = (row: WorkRow): WorkKind => (row.of === 'task' || isOnceRRule(row.routine.schedule_rrule) ? 'once' : 'repeated');

export const ROUTINE_STATUSES = ['active', 'ended', 'inactive'] as const;
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number];
/** A routine's STATUS: ended first (the end has passed — ROUTINE-02a), then inactive, else active. */
export const routineStatusOf = (routine: Pick<Routine, 'is_active'>, end: RoutineEnd): RoutineStatus => (end.ended ? 'ended' : routine.is_active ? 'active' : 'inactive');
/** STATUS — the routine's word, or the task's status words (TASK_STATUS_LABELS; an unlabeled status is its raw value). */
export const statusWordsOf = (row: WorkRow): string => (row.of === 'task' ? taskStatusWords(row.task.status) : routineStatusOf(row.routine, row.end));

/** TIME — where the rule names no clock, or the routine is all day (ALLDAY-01: a charge on a date, not a stop). */
export const ALL_DAY_WORDS = 'all day';
export function timeWordsOf(row: WorkRow): string | null {
  if (row.of === 'task') return null;
  const words = timeWords(row.routine);
  return words === DAYS_NONE_WORDS ? ALL_DAY_WORDS : words;
}
export const nameOf = (row: WorkRow): string => (row.of === 'task' ? row.task.title : row.routine.name);
export const projectOf = (row: WorkRow): string | null => (row.of === 'task' ? row.project.title : null);
export const bookIdOf = (row: WorkRow): string => (row.of === 'task' ? row.task.entity_id : row.routine.entity_id);
export const bookNameOf = (books: readonly WorkBook[], row: WorkRow): string => books.find((b) => b.id === bookIdOf(row))?.name ?? ACCOUNT_CELL_WORDS.bookNotLoaded;
export const cadenceOf = (row: WorkRow): string | null => (row.of === 'task' ? null : cadenceWords(row.routine.schedule_rrule));
/** DAYS — the rule's days; a rule no choice reproduces (Custom) names none, which is a blank cell here. */
export function daysOf(row: WorkRow): string | null {
  if (row.of === 'task') return null;
  const words = daysWords(row.routine.schedule_rrule, row.routine.start_date);
  return words === DAYS_NONE_WORDS ? null : words;
}
/** DEADLINE — the task's ISO day, or null. */
export const deadlineOf = (row: WorkRow): string | null => (row.of === 'task' && row.task.deadline ? row.task.deadline.slice(0, 10) : null);

const numberOrNull = (v: string | number | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** AMOUNT in cents — the line's, a stepless routine's own when it is the figure in force (the leaf), a task's estimated cost; null is blank. */
export function amountCentsOf(row: WorkRow): number | null {
  const dollars = row.of === 'task'
    ? numberOrNull(row.task.estimated_cost_usd)
    : row.line !== null ? row.line.amount : row.planned.from === 'routine' ? row.planned.amount : null;
  return dollars === null ? null : Math.round(dollars * 100);
}
/** "$12.00" — the AMOUNT cell on screen (the CSV writes the bare csvMoney). */
export const moneyWords = (cents: number): string => `$${csvMoney(cents)}`;

/** The saved code a row carries: the line's, a stepless routine's own (as its row drew it), the task's. */
export const savedCodeOf = (row: WorkRow): string | null =>
  (row.of === 'task' ? row.task.coa_code ?? null : row.line !== null ? row.line.coaCode : row.routine.coa_code ?? null);

export const CHART_MISSING_WORDS = 'not in the chart';
export const CHART_UNREAD_WORDS = 'chart not read';
const digitsOf = (code: string): string | null => /(\d{4})$/.exec(code.trim())?.[1] ?? null;
/** The chart's name for an account string ("P-6150" → "Food & drink"); null when the chart lists no row with those four digits. */
export function chartNameOf(chart: WorkChart, accountText: string): string | null {
  const digits = digitsOf(accountText);
  if (digits === null) return null;
  const row = chart.find((a) => digitsOf(a.code) === digits);
  return row === undefined ? null : row.name;
}
/** ACCOUNT — the helper's string and the chart's name; the helper's other states print their words; blank is null. */
export function accountWordsOf(books: readonly WorkBook[], charts: WorkCharts, row: WorkRow): string | null {
  const bookId = bookIdOf(row);
  const cell = accountCell(books, bookId, savedCodeOf(row));
  if (cell.state === 'blank') return null;
  if (cell.state !== 'account') return cell.text;
  const chart = charts[bookId];
  if (chart === undefined) return `${cell.text} — ${CHART_UNREAD_WORDS}`;
  const name = chartNameOf(chart, cell.text);
  return name === null ? `${cell.text} — ${CHART_MISSING_WORDS}` : `${cell.text} ${name}`;
}

// ── THE COLUMNS ──────────────────────────────────────────────────────────────

export const WORK_COLUMNS = ['kind', 'name', 'project', 'book', 'cadence', 'days', 'time', 'deadline', 'amount', 'account', 'status'] as const;
export type WorkColumn = (typeof WORK_COLUMNS)[number];
export const WORK_HEAD_WORDS: Readonly<Record<WorkColumn, string>> = {
  kind: 'KIND', name: 'NAME', project: 'PROJECT', book: 'BOOK', cadence: 'CADENCE', days: 'DAYS', time: 'TIME', deadline: 'DEADLINE', amount: 'AMOUNT', account: 'ACCOUNT', status: 'STATUS',
};
export const WORK_TABLE_NAME = 'work';

/** A VALUE column over one reader: "—" on screen for null; `key` (when given) is what it sorts by and writes — DEADLINE's ISO day under its drawn date. */
const valueColumn = (column: WorkColumn, words: (row: WorkRow) => string | null, key: (row: WorkRow) => string | null = words): TableColumn<WorkRow, WorkColumn> => ({
  key: column, label: WORK_HEAD_WORDS[column], kind: 'value',
  words: (r) => words(r) ?? BLANK,
  sortKey: (r) => textKey(key(r)),
  csv: (r) => key(r) ?? '',
});
/** A TEXT column over one reader: the filter and the sort read the full text. */
const textColumn = (column: WorkColumn, text: (row: WorkRow) => string | null): TableColumn<WorkRow, WorkColumn> => ({
  key: column, label: WORK_HEAD_WORDS[column], kind: 'text',
  words: (r) => text(r) ?? BLANK,
  sortKey: (r) => textKey(text(r)),
  csv: (r) => text(r) ?? '',
  text,
});
const AMOUNT_COLUMN: TableColumn<WorkRow, WorkColumn> = {
  key: 'amount', label: WORK_HEAD_WORDS.amount, kind: 'money',
  cents: amountCentsOf,
  words: (r) => { const c = amountCentsOf(r); return c === null ? BLANK : moneyWords(c); },
  sortKey: (r) => numberKey(amountCentsOf(r)),
  csv: (r) => csvMoney(amountCentsOf(r)),
};

/** The spec, over the tab's books and their charts (BOOK and ACCOUNT read them). */
export function workTable(books: readonly WorkBook[], charts: WorkCharts): readonly TableColumn<WorkRow, WorkColumn>[] {
  return [
    valueColumn('kind', kindOf),
    textColumn('name', nameOf),
    textColumn('project', projectOf),
    valueColumn('book', (r) => bookNameOf(books, r)),
    valueColumn('cadence', cadenceOf),
    valueColumn('days', daysOf),
    valueColumn('time', timeWordsOf),
    valueColumn('deadline', (r) => { const d = deadlineOf(r); return d === null ? null : formatDate(d); }, deadlineOf),
    AMOUNT_COLUMN,
    textColumn('account', (r) => accountWordsOf(books, charts, r)),
    valueColumn('status', statusWordsOf),
  ];
}

// ── THE DEFAULT (ruling B) ───────────────────────────────────────────────────

/** The STATUS values dropped at first — the ended routines and the archived tasks; the rest shows. */
export const WORK_DEFAULT_DROPPED: readonly string[] = ['ended', 'archived'];
/** Every filter off but STATUS, which drops the default: the state at first, and what a re-read keeps. */
export const workDefaultFilters = (columns: readonly TableColumn<WorkRow, WorkColumn>[]): TableFilters =>
  withFilter(noFilters(columns), 'status', { dropped: [...WORK_DEFAULT_DROPPED] });
/** The STATUS values a filter drops now. */
export const statusDroppedOf = (filters: TableFilters): readonly string[] => valueFilterOf(filters, 'status').dropped;
/** The chip's words while STATUS narrows: "STATUS: not ended, not archived". */
export const statusChipWords = (dropped: readonly string[]): string => `STATUS: ${dropped.map((d) => `not ${d}`).join(', ')}`;
/** The filters with STATUS cleared — the chip's click: everything shows. */
export const withoutStatusFilter = (filters: TableFilters): TableFilters => withFilter(filters, 'status', NO_VALUE_FILTER);

// ── THE DOORS ────────────────────────────────────────────────────────────────

/** A project a new task may belong to: not completed, cancelled, dropped or archived. */
export const OPEN_PROJECT_STATUSES: readonly ProjectStatus[] = ['not_started', 'in_progress', 'blocked', 'backlog', 'scoped', 'scheduled'];
export const openProjects = (projects: readonly Project[]): Project[] => projects.filter((p) => OPEN_PROJECT_STATUSES.includes(p.status));

// ── WORDS ────────────────────────────────────────────────────────────────────

export const WORK_TITLE_WORDS = 'The work';
export const WORK_LOADING_WORDS = 'reading the work…';
export const workFailedWords = (words: string): string => `The work could not be read — ${words}`;
export const NO_WORK_WORDS = 'no routine and no task yet — "+ routine" plans the first routine, "+ task" the first task';
export const ADD_ROUTINE_WORDS = '+ routine';
export const ADD_TASK_WORDS = '+ task';
export const EDIT_WORDS = 'edit';
export const CLEAR_CHIP_MARK = '✕';
export const PROJECT_FIELD_WORDS = 'project';
export const PICK_PROJECT_WORDS = '— pick the project —';
export const PROJECT_REQUIRED_WORDS = 'pick the project — a task belongs to one';
export const NO_OPEN_PROJECT_WORDS = 'no open project — capture one under PROJECTS first';
/** "12 of 40 rows" — under the table: the rows shown over the rows loaded. */
export const workCountWords = (shown: number, loaded: number): string => `${shown} of ${loaded} rows`;
/** "work_2026-10-24.csv" — the day the CSV was downloaded (the viewer's local day). */
export const workCsvFileName = (day: string): string => `work_${day}.csv`;
