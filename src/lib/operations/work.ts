/**
 * WORK-01d (Alex, 2026-10-25) — TASKS IS THREE TABLES: THE WORK AND ROUTINE EXPENSES, PURE.
 *
 * /tasks mounts, in order: THE WORK · PROJECTS · ROUTINE EXPENSES — three sections,
 * three DataTables (IDIOM-01: src/lib/table, components/table/DataTable.tsx).
 * Routines and tasks are never one table: different inputs, different tables.
 * This module holds the two pure specs and their row builders; PROJECTS has its
 * own (projects/projectsTableText.ts).
 *
 * THE WORK (ruling B) — table 'work': one row per TASK of an OPEN project. A
 * project is open when its status is in OPEN_PROJECT_STATUSES — the ONE set in
 * src/lib/operations/morningLog.ts that THE LOG, the reorder route and the
 * reflection prompt read (isOpenProjectStatus); a task of an archived, completed,
 * dropped or cancelled project is NOT a row here even when passed — its home is
 * PROJECTS → show archived → the row's details.
 *
 *   TASK · PROJECT · BOOK · STATUS · DEADLINE · ESTIMATE · ACCOUNT · DONE · controls
 *
 *   · TASK      the task's title.
 *   · PROJECT   the project's title.
 *   · BOOK      the task's book by name (the tab's entity list); a book the tab has
 *               not listed is "book not loaded" (ROUTINES-01's words), never dropped.
 *   · STATUS    the task's status words (TASK_STATUS_LABELS via taskStatusWords:
 *               new · in process · blocked · done · cancelled · archived · pending
 *               review).
 *   · DEADLINE  the task's deadline, drawn as the projects table drew it; sorted
 *               and written as the ISO day.
 *   · ESTIMATE  the task's estimated cost (money). Blank is blank, never 0.
 *   · ACCOUNT   the saved code through ROUTINES-01's helper (accountCell: the book's
 *               letter and the four digits) with the chart's name beside it —
 *               "P-6150 Food & drink" (WORK-01b ruling 4); the helper's other states
 *               print their words.
 *   · DONE      completed_at as a date, "—" while open; sorted and written as the
 *               ISO day.
 *
 *   THE DEFAULT: a VISIBLE STATUS chip "STATUS: open only" dropping done, cancelled
 *   and archived tasks; clearing it shows them. The reads bring every task of every
 *   open project (archived included); the filter alone narrows. CSV work_<day>.csv.
 *   The rows come project by project as the projects read returns them, each
 *   project's tasks in display order.
 *
 * ROUTINE EXPENSES (ruling C) — table 'routine-expenses': one row per routine LINE
 * (a stepless routine one row), every book, in clock order then name (FORM-01's
 * byClockThenName), a routine's lines in step order under it:
 *
 *   ROUTINE · BOOK · CADENCE · DAYS · TIME · AMOUNT · ACCOUNT · STATUS · controls
 *
 *   · ROUTINE   "<routine> — <step>" for a line row (WORK-01b ruling 2 — one
 *               string, so the filter, the sort and the CSV read it whole); the
 *               bare name for a stepless routine.
 *   · CADENCE   the rule's word as FORM-01 prints it (rruleHelpers cadenceWords);
 *               a Once routine reads "once".
 *   · DAYS      the days the rule falls on (daysWords); a rule no choice reproduces
 *               has none.
 *   · TIME      the window (timeWords, "HH:MM – HH:MM"); "all day" where the rule
 *               names no clock or the routine is all day (ALLDAY-01).
 *   · AMOUNT    the line's amount, a stepless routine's own — through the LINES-01
 *               leaf (routinePlanned), never the column read bare. Blank, never 0.
 *   · ACCOUNT   as above.
 *   · STATUS    active | ended | inactive — ended first (ROUTINE-02a's endedBy,
 *               judged now in the routine's own zone), then is_active.
 *               ROUTINE-02a (Alex, 2026-10-18) — THE ARCHIVE lives here: an ended
 *               routine is a row with STATUS ended, dropped by the default STATUS
 *               filter and shown again when its chip is cleared — never deleted,
 *               never deactivated, read-only but for edit (RoutineEditForm).
 *
 *   THE DEFAULT: a VISIBLE STATUS chip "STATUS: active only" dropping ended and
 *   inactive; clearing it shows them. CSV routine-expenses_<day>.csv.
 *
 * A cell with nothing is "—" (BLANK) on screen and '' in the CSV. Pure: no React,
 * no fetch, no clock — `now` is handed in.
 *
 * HISTORY. WORK-01 (Alex, 2026-10-24) made Tasks ONE table — every routine line
 * and every task in one DataTable with a KIND column (once | repeated) telling
 * them apart, one default chip ("STATUS: not ended, not inactive, not archived",
 * WORK-01b ruling 1) and one builder (workRowsOf). WORK-01d replaced the KIND
 * column with the two tables themselves, the one builder with taskRowsOf and
 * routineRowsOf, the one chip with each table's own ("open only" / "active
 * only"), and the merged projects?include_archived=true read with the open
 * projects alone. The cells' rules (NAME's join, TIME's "all day", AMOUNT through
 * the leaf, ACCOUNT through the helper and the chart) are unchanged.
 */
import type { TableColumn } from '@/lib/table/columns';
import { csvMoney } from '@/lib/table/csv';
import { NO_VALUE_FILTER, noFilters, valueFilterOf, withFilter, type TableFilters } from '@/lib/table/filters';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { ACCOUNT_CELL_WORDS, accountCell, type AccountCellBook } from '@/lib/coa/accountCell';
import { routinePlanned, type LinePlanned, type RoutinePlanned } from '@/lib/operations/routineLines';
import { DAYS_NONE_WORDS, byClockThenName, cadenceWords, daysWords, endedBy, timeWords, type RoutineEnd } from '@/lib/operations/rruleHelpers';
import { isOpenProjectStatus } from '@/lib/operations/morningLog';
import type { Routine } from '@/components/workbench/operations/routines/types';
import type { CoaAccountSummary, Project, Task } from '@/components/workbench/operations/projects/types';
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

// ── SHARED CELLS ─────────────────────────────────────────────────────────────

const numberOrNull = (v: string | number | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** "$12.00" — a money cell on screen (the CSV writes the bare csvMoney). */
export const moneyWords = (cents: number): string => `$${csvMoney(cents)}`;
/** A book's name from the tab's entity list; a book the tab has not listed is said (ROUTINES-01's words), never dropped. */
export const bookNameOf = (books: readonly WorkBook[], bookId: string): string => books.find((b) => b.id === bookId)?.name ?? ACCOUNT_CELL_WORDS.bookNotLoaded;

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
export function accountWordsOf(books: readonly WorkBook[], charts: WorkCharts, bookId: string, savedCode: string | null): string | null {
  const cell = accountCell(books, bookId, savedCode);
  if (cell.state === 'blank') return null;
  if (cell.state !== 'account') return cell.text;
  const chart = charts[bookId];
  if (chart === undefined) return `${cell.text} — ${CHART_UNREAD_WORDS}`;
  const name = chartNameOf(chart, cell.text);
  return name === null ? `${cell.text} — ${CHART_MISSING_WORDS}` : `${cell.text} ${name}`;
}

/** A VALUE column over one reader: "—" on screen for null; `key` (when given) is what it sorts by and writes — an ISO day under its drawn date. */
function valueColumn<Row, Key extends string>(column: Key, label: string, words: (row: Row) => string | null, key: (row: Row) => string | null = words): TableColumn<Row, Key> {
  return { key: column, label, kind: 'value', words: (r) => words(r) ?? BLANK, sortKey: (r) => textKey(key(r)), csv: (r) => key(r) ?? '' };
}
/** A TEXT column over one reader: the filter and the sort read the full text. */
function textColumn<Row, Key extends string>(column: Key, label: string, text: (row: Row) => string | null): TableColumn<Row, Key> {
  return { key: column, label, kind: 'text', words: (r) => text(r) ?? BLANK, sortKey: (r) => textKey(text(r)), csv: (r) => text(r) ?? '', text };
}
/** A MONEY column over one reader of cents: "$12.00" on screen, bare in the CSV, blanks sorted last. */
function moneyColumn<Row, Key extends string>(column: Key, label: string, cents: (row: Row) => number | null): TableColumn<Row, Key> {
  return { key: column, label, kind: 'money', cents, words: (r) => { const c = cents(r); return c === null ? BLANK : moneyWords(c); }, sortKey: (r) => numberKey(cents(r)), csv: (r) => csvMoney(cents(r)) };
}

// ── THE DEFAULT CHIP (shared rule) ───────────────────────────────────────────

/** A table's named default: the STATUS values it drops at first, and the chip's words while exactly those are dropped. */
export interface NamedDefault { readonly dropped: readonly string[]; readonly words: string }
/** Every filter off but STATUS, which drops the default: the state at first, and what a re-read keeps. */
export const defaultFiltersOf = <Row, Key extends string>(columns: readonly TableColumn<Row, Key>[], statusKey: Key, named: NamedDefault): TableFilters =>
  withFilter(noFilters(columns), statusKey, { dropped: [...named.dropped] });
/** The STATUS values a filter drops now. */
export const statusDroppedOf = (filters: TableFilters, statusKey = 'status'): readonly string[] => valueFilterOf(filters, statusKey).dropped;
const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
/** The chip's words while STATUS narrows: the named default's own words while exactly its values are dropped; otherwise the values spelled out ("STATUS: not done, not archived"). */
export const statusChipWords = (dropped: readonly string[], named: NamedDefault): string =>
  (sameSet(dropped, named.dropped) ? named.words : `STATUS: ${dropped.map((d) => `not ${d}`).join(', ')}`);
/** The filters with STATUS cleared — the chip's click: everything shows. */
export const withoutStatusFilter = (filters: TableFilters, statusKey = 'status'): TableFilters => withFilter(filters, statusKey, NO_VALUE_FILTER);
export const EDIT_WORDS = 'edit';
export const CLEAR_CHIP_MARK = '✕';
/** "12 of 40 rows" — under a table: the rows shown over the rows loaded. */
export const rowCountWords = (shown: number, loaded: number): string => `${shown} of ${loaded} rows`;

// ═════════════════════════════════════════════════════════════════════════════
// THE WORK — one row per task of an open project (ruling B)
// ═════════════════════════════════════════════════════════════════════════════

/** One row of THE WORK: a task with its (open) project. */
export interface TaskRow { readonly id: string; readonly task: Task; readonly project: Project }

/** The projects a task may belong to, and the only ones THE WORK reads: morningLog.ts OPEN_PROJECT_STATUSES, the one set. */
export const openProjects = (projects: readonly Project[]): Project[] => projects.filter((p) => isOpenProjectStatus(p.status));

/** The rows: every task of every OPEN project, project by project as given, each project's tasks in the order given; a task of a project that is not open is no row, however it arrived. */
export function taskRowsOf(projects: readonly WorkProject[]): TaskRow[] {
  const rows: TaskRow[] = [];
  for (const { project, tasks } of projects) {
    if (!isOpenProjectStatus(project.status)) continue;
    for (const task of tasks) rows.push({ id: `task:${task.id}`, task, project });
  }
  return rows;
}

export const TASK_COLUMNS = ['task', 'project', 'book', 'status', 'deadline', 'estimate', 'account', 'done'] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];
export const TASK_HEAD_WORDS: Readonly<Record<TaskColumn, string>> = {
  task: 'TASK', project: 'PROJECT', book: 'BOOK', status: 'STATUS', deadline: 'DEADLINE', estimate: 'ESTIMATE', account: 'ACCOUNT', done: 'DONE',
};
export const TASK_TABLE_NAME = 'work';

/** STATUS — the task's status words (TASK_STATUS_LABELS; an unlabeled status is its raw value). */
export const taskStatusOf = (row: TaskRow): string => taskStatusWords(row.task.status);
/** DEADLINE — the task's ISO day, or null. */
export const taskDeadlineOf = (row: TaskRow): string | null => (row.task.deadline ? row.task.deadline.slice(0, 10) : null);
/** DONE — the day the task was completed (completed_at's ISO day), or null while it is not. */
export const taskDoneOf = (row: TaskRow): string | null => (row.task.completed_at ? row.task.completed_at.slice(0, 10) : null);
/** ESTIMATE in cents — the task's estimated cost; null is blank. */
export function taskEstimateCentsOf(row: TaskRow): number | null {
  const dollars = numberOrNull(row.task.estimated_cost_usd);
  return dollars === null ? null : Math.round(dollars * 100);
}

/** THE WORK's spec, over the tab's books and their charts (BOOK and ACCOUNT read them). */
export function taskTable(books: readonly WorkBook[], charts: WorkCharts): readonly TableColumn<TaskRow, TaskColumn>[] {
  const head = TASK_HEAD_WORDS;
  return [
    textColumn<TaskRow, TaskColumn>('task', head.task, (r) => r.task.title),
    textColumn<TaskRow, TaskColumn>('project', head.project, (r) => r.project.title),
    valueColumn<TaskRow, TaskColumn>('book', head.book, (r) => bookNameOf(books, r.task.entity_id)),
    valueColumn<TaskRow, TaskColumn>('status', head.status, taskStatusOf),
    valueColumn<TaskRow, TaskColumn>('deadline', head.deadline, (r) => { const d = taskDeadlineOf(r); return d === null ? null : formatDate(d); }, taskDeadlineOf),
    moneyColumn<TaskRow, TaskColumn>('estimate', head.estimate, taskEstimateCentsOf),
    textColumn<TaskRow, TaskColumn>('account', head.account, (r) => accountWordsOf(books, charts, r.task.entity_id, r.task.coa_code ?? null)),
    valueColumn<TaskRow, TaskColumn>('done', head.done, (r) => { const d = taskDoneOf(r); return d === null ? null : formatDate(d); }, taskDoneOf),
  ];
}

/** THE WORK's default: the done, cancelled and archived tasks dropped — the chip reads "STATUS: open only" (ruling B). */
export const TASK_DEFAULT: NamedDefault = { dropped: ['done', 'cancelled', 'archived'], words: 'STATUS: open only' };
export const taskDefaultFilters = (columns: readonly TableColumn<TaskRow, TaskColumn>[]): TableFilters => defaultFiltersOf(columns, 'status', TASK_DEFAULT);

export const WORK_TITLE_WORDS = 'The work';
export const WORK_LOADING_WORDS = 'reading the work…';
export const workFailedWords = (words: string): string => `The work could not be read — ${words}`;
export const NO_WORK_WORDS = 'no task yet in an open project — "+ task" plans the first';
export const ADD_TASK_WORDS = '+ task';
export const PROJECT_FIELD_WORDS = 'project';
export const PICK_PROJECT_WORDS = '— pick the project —';
export const PROJECT_REQUIRED_WORDS = 'pick the project — a task belongs to one';
export const NO_OPEN_PROJECT_WORDS = 'no open project — capture one under PROJECTS first';
/** "work_2026-10-25.csv" — the day the CSV was downloaded (the viewer's local day). */
export const workCsvFileName = (day: string): string => `work_${day}.csv`;

// ═════════════════════════════════════════════════════════════════════════════
// ROUTINE EXPENSES — one row per routine line (ruling C)
// ═════════════════════════════════════════════════════════════════════════════

/** One row of ROUTINE EXPENSES: a routine line (or a stepless routine, `line` null) with the leaf's judgement and the end's. */
export interface RoutineRow { readonly id: string; readonly routine: Routine; readonly planned: RoutinePlanned; readonly line: LinePlanned | null; readonly end: RoutineEnd }

/** The rows, in clock order then name (FORM-01's byClockThenName), each routine's lines in step order under it; ended is judged now, in the routine's own zone (ROUTINE-02a). */
export function routineRowsOf(routines: readonly Routine[], now: Date): RoutineRow[] {
  const rows: RoutineRow[] = [];
  for (const routine of [...routines].sort(byClockThenName)) {
    const planned = routinePlanned({ budget_amount: routine.budget_amount ?? null, coa_code: routine.coa_code ?? null, steps: routine.steps });
    const end = endedBy(routine.end_date, routine.timezone, now);
    if (planned.lines.length === 0) rows.push({ id: `routine:${routine.id}`, routine, planned, line: null, end });
    else for (const line of planned.lines) rows.push({ id: `routine:${routine.id}:${line.id}`, routine, planned, line, end });
  }
  return rows;
}

export const ROUTINE_STATUSES = ['active', 'ended', 'inactive'] as const;
export type RoutineStatus = (typeof ROUTINE_STATUSES)[number];
/** A routine's STATUS: ended first (the end has passed — ROUTINE-02a), then inactive, else active. */
export const routineStatusOf = (routine: Pick<Routine, 'is_active'>, end: RoutineEnd): RoutineStatus => (end.ended ? 'ended' : routine.is_active ? 'active' : 'inactive');

/** TIME — where the rule names no clock, or the routine is all day (ALLDAY-01: a charge on a date, not a stop). */
export const ALL_DAY_WORDS = 'all day';
export function routineTimeOf(row: RoutineRow): string {
  const words = timeWords(row.routine);
  return words === DAYS_NONE_WORDS ? ALL_DAY_WORDS : words;
}
/** ROUTINE — WORK-01b (Alex, 2026-10-24, ruling 2): a line row is "<routine> — <line>"; a stepless routine's row keeps the bare name. */
export const LINE_NAME_JOIN = ' — ';
export const routineNameOf = (row: RoutineRow): string => (row.line === null ? row.routine.name : `${row.routine.name}${LINE_NAME_JOIN}${row.line.activity}`);
/** CADENCE — the rule's word as FORM-01 prints it; a Once routine reads "once". */
export const routineCadenceOf = (row: RoutineRow): string => cadenceWords(row.routine.schedule_rrule);
/** DAYS — the rule's days; a rule no choice reproduces (Custom) names none, which is a blank cell here. */
export function routineDaysOf(row: RoutineRow): string | null {
  const words = daysWords(row.routine.schedule_rrule, row.routine.start_date);
  return words === DAYS_NONE_WORDS ? null : words;
}
/** AMOUNT in cents — the line's, a stepless routine's own when it is the figure in force (the leaf); null is blank. */
export function routineAmountCentsOf(row: RoutineRow): number | null {
  const dollars = row.line !== null ? row.line.amount : row.planned.from === 'routine' ? row.planned.amount : null;
  return dollars === null ? null : Math.round(dollars * 100);
}
/** The saved code a row carries: the line's, or a stepless routine's own. */
export const routineSavedCodeOf = (row: RoutineRow): string | null => (row.line !== null ? row.line.coaCode : row.routine.coa_code ?? null);

export const ROUTINE_COLUMNS = ['routine', 'book', 'cadence', 'days', 'time', 'amount', 'account', 'status'] as const;
export type RoutineColumn = (typeof ROUTINE_COLUMNS)[number];
export const ROUTINE_HEAD_WORDS: Readonly<Record<RoutineColumn, string>> = {
  routine: 'ROUTINE', book: 'BOOK', cadence: 'CADENCE', days: 'DAYS', time: 'TIME', amount: 'AMOUNT', account: 'ACCOUNT', status: 'STATUS',
};
export const ROUTINE_TABLE_NAME = 'routine-expenses';

/** ROUTINE EXPENSES' spec, over the tab's books and their charts. */
export function routineTable(books: readonly WorkBook[], charts: WorkCharts): readonly TableColumn<RoutineRow, RoutineColumn>[] {
  const head = ROUTINE_HEAD_WORDS;
  return [
    textColumn<RoutineRow, RoutineColumn>('routine', head.routine, routineNameOf),
    valueColumn<RoutineRow, RoutineColumn>('book', head.book, (r) => bookNameOf(books, r.routine.entity_id)),
    valueColumn<RoutineRow, RoutineColumn>('cadence', head.cadence, routineCadenceOf),
    valueColumn<RoutineRow, RoutineColumn>('days', head.days, routineDaysOf),
    valueColumn<RoutineRow, RoutineColumn>('time', head.time, routineTimeOf),
    moneyColumn<RoutineRow, RoutineColumn>('amount', head.amount, routineAmountCentsOf),
    textColumn<RoutineRow, RoutineColumn>('account', head.account, (r) => accountWordsOf(books, charts, r.routine.entity_id, routineSavedCodeOf(r))),
    valueColumn<RoutineRow, RoutineColumn>('status', head.status, (r) => routineStatusOf(r.routine, r.end)),
  ];
}

/** ROUTINE EXPENSES' default: the ended and the inactive routines dropped — the chip reads "STATUS: active only" (ruling C). */
export const ROUTINE_DEFAULT: NamedDefault = { dropped: ['ended', 'inactive'], words: 'STATUS: active only' };
export const routineDefaultFilters = (columns: readonly TableColumn<RoutineRow, RoutineColumn>[]): TableFilters => defaultFiltersOf(columns, 'status', ROUTINE_DEFAULT);

export const ROUTINE_EXPENSES_TITLE_WORDS = 'Routine expenses';
export const ROUTINE_EXPENSES_LOADING_WORDS = 'reading the routines…';
export const routineExpensesFailedWords = (words: string): string => `Routine expenses could not be read — ${words}`;
export const NO_ROUTINE_EXPENSES_WORDS = 'no routine yet — "+ routine" plans the first (Days = Once for a one-off)';
export const ADD_ROUTINE_WORDS = '+ routine';
/** "routine-expenses_2026-10-25.csv" — the day the CSV was downloaded (the viewer's local day). */
export const routineExpensesCsvFileName = (day: string): string => `routine-expenses_${day}.csv`;
