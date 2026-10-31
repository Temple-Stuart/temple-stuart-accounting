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
 *   · DEADLINE  the task's deadline, its ISO day drawn at local midnight (dayWords,
 *               COLUMNS-01); sorted and written as the ISO day.
 *   · ESTIMATE  the task's estimated cost (money). Blank is blank, never 0.
 *   · ACTUAL    TASKS-03 (Alex, 2026-10-26, ruling A): the task's actual_cost_usd —
 *               what was logged (TaskEditInputs and the calendar card write it);
 *               blank is blank, never $0.00. Tooltip "as you logged it".
 *   · MATCH     TASKS-03: the sum of the postings linked to the task in Books
 *               (planned_item_links project_task — LINK-01; the amount by
 *               postingAmount.ts amountCentsOf, summed by the tasks GET through
 *               taskMatch.ts, ROUTINES-03's convention: an unreadable posting is
 *               counted and the sum blank); blank with no link. Tooltip "postings
 *               linked in Books". The money sits together — ESTIMATE · ACTUAL ·
 *               MATCH — in the ledger's words.
 *   · ACCOUNT   the saved code through ROUTINES-01's helper (accountCell: the book's
 *               letter and the four digits) with the chart's name beside it —
 *               "P-6150 Food & drink" (WORK-01b ruling 4); the helper's other states
 *               print their words.
 *   · DONE      completed_at — an EVENT INSTANT (COLUMNS-01b): the viewer's local day
 *               on screen, "—" while open; sorted by the instant; the CSV writes the
 *               ISO instant as stored.
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
 *   START · END · KIND · BOOK · ACCOUNT · ACCOUNT NAME · SUB ACCOUNT NAME · VENDOR ·
 *   ROUTINE · TIME · DAYS · CADENCE · NEXT · BUDGET · THIS MONTH · TO DATE · ACTUAL ·
 *   MATCH · VARIANCE · STATUS · ID · controls
 *
 *   ROUTINES-03 (Alex, 2026-10-25, rulings A–B) — the columns, in Alex's order:
 *   when it's in force → what kind → the accounting classification coarse to fine
 *   → who's paid → the schedule → the money → the state → the identifier. The head
 *   words are the task ledger's (ledger.ts LEDGER_HEAD_WORDS) wherever the fact is
 *   the same.
 *
 *   · START · END  start_date, end_date drawn as a date (formatDate, at local
 *               midnight), the ISO day under it for sort and CSV; blank "—".
 *   · KIND      once when isOnceRRule(schedule_rrule), else repeated — a value
 *               column; the filter reads it.
 *   · ACCOUNT   the helper's string alone ("P-8180", accountCell).
 *   · ACCOUNT NAME  the chart's name alone ("Streaming & Subscriptions",
 *               chartNameOf); the helper's non-account states and "not in the
 *               chart" / "chart not read" print here.
 *   · SUB ACCOUNT NAME  the stop's name by the ledger's rule (dayCard.ts
 *               stopName): the line's activity; a stepless routine's own name.
 *   · VENDOR    the plan's vendor at its one grain (VENDOR-01, through the month
 *               route — routineMonth.ts): an every-occurrence row → the vendor's
 *               name; occurrence rows only → "by occurrence"; none → "—"; a plan
 *               holding both → the planLines.ts refusal's words, never one picked.
 *               EXPENSES-02 (Alex, 2026-10-26, ruling A): this cell is where a
 *               line's vendor is DECIDED — the row's "vendor" control opens the
 *               book's directory under the row and writes the EVERY-OCCURRENCE
 *               grain through plan-vendors (routineVendorAddressOf: instant null;
 *               kind routine_line, or routine for a stepless routine); "clear" is
 *               the route's DELETE at the same address. A line at the occurrence
 *               grain gets no picker — routineVendorControlOf names the refusal.
 *   · ROUTINE   the routine's name alone. WORK-01b ruling 2's "<routine> — <step>"
 *               join (LINE_NAME_JOIN) is retired: the line is SUB ACCOUNT NAME's.
 *   · CADENCE   the rule's word as FORM-01 prints it (rruleHelpers cadenceWords);
 *               a Once routine reads "once".
 *   · DAYS      the days the rule falls on (daysWords); a rule no choice reproduces
 *               has none.
 *   · TIME      the window (timeWords, "HH:MM – HH:MM"); "all day" where the rule
 *               names no clock or the routine is all day (ALLDAY-01).
 *   · NEXT      next_due_at as a day in the routine's zone; null → "—".
 *   · BUDGET    the line's per-occurrence amount (WORK-01's AMOUNT, renamed), a
 *               stepless routine's own — through the LINES-01 leaf (routinePlanned),
 *               never the column read bare. Blank, never 0.
 *   · THIS MONTH · TO DATE · ACTUAL · MATCH · VARIANCE  CALCULATED by the month
 *               route (routineMonth.ts — the /budget rule, the ledger's placing,
 *               LEDGER-03's match, links.ts variance), read by row id; each head
 *               carries a tooltip naming its rule (ROUTINE_TOOLTIPS). A line the
 *               route did not return is blank and counted (withoutMonthWords).
 *   · STATUS    active | ended | inactive — ended first (ROUTINE-02a's endedBy,
 *               judged now in the routine's own zone), then is_active.
 *               ROUTINE-02a (Alex, 2026-10-18) — THE ARCHIVE lives here: an ended
 *               routine is a row with STATUS ended, dropped by the default STATUS
 *               filter and shown again when its chip is cleared — never deleted,
 *               never deactivated, read-only but for edit (RoutineEditForm).
 *   · ID        the line's id (a stepless routine: the routine's), monospace.
 *
 *   THE DEFAULT: a VISIBLE STATUS chip "STATUS: active only" dropping ended and
 *   inactive; clearing it shows them. CSV routine-expenses_<day>.csv — every
 *   column in the order above, money bare, dates ISO, the full id.
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
import { ACCOUNT_CELL_WORDS, accountCell, type AccountCell, type AccountCellBook } from '@/lib/coa/accountCell';
import { routinePlanned, type LinePlanned, type RoutinePlanned } from '@/lib/operations/routineLines';
import { DAYS_NONE_WORDS, byClockThenName, cadenceWords, daysWords, endedBy, isOnceRRule, timeWords, zoneUnreadWords, type RoutineEnd } from '@/lib/operations/rruleHelpers';
import { isOpenProjectStatus } from '@/lib/operations/morningLog';
import { monthLineKey, type RoutineMonthLine } from '@/lib/operations/routineMonth';
import { varianceCellWords } from '@/lib/operations/ledger';
import { instantToZoned } from '@/lib/time';
import type { Routine } from '@/components/workbench/operations/routines/types';
import type { CoaAccountSummary, Project, Task } from '@/components/workbench/operations/projects/types';
import { formatDate, taskStatusWords } from '@/components/workbench/operations/projects/projectsTableText';
import { stopName } from '@/components/workbench/operations/day/dayCard';

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
/**
 * TWO KINDS OF DATE COLUMN, ONE RULE EACH (COLUMNS-01 ruling B; COLUMNS-01b, Alex, 2026-10-25, ruling 2).
 *
 *   · A DAY — a @db.Date column (START · END — routines.start_date / end_date) or a Timestamptz its writer stores as new Date('YYYY-MM-DD'),
 *     i.e. UTC midnight of a day the form sent as 'YYYY-MM-DD' from <input type="date"> (DEADLINE: tasks/route.ts and tasks/[taskId]/route.ts
 *     — TaskCreateInputs / TaskEditInputs; TARGET: projects/route.ts and projects/[id]/route.ts — ProjectCreateForm / ProjectRowView). Its
 *     fact is the day: drawn as that UTC day at LOCAL midnight (dayWords — an ISO day alone parses as UTC midnight and shifts a day west of
 *     Greenwich); sorted and written as the ISO day (isoDayOf). NEXT draws its day in the routine's own zone the same way.
 *   · An EVENT INSTANT — a Timestamptz its writer stamps with now() (THE WORK's DONE: completed_at; PROJECTS' CAPTURED created_at ·
 *     PROMOTED promoted_at · SCHEDULED scheduled_at · DONE done_at). Its fact is the instant: drawn as the VIEWER's local day of it
 *     (instantDayWords — Manila and Los Angeles see their own day); sorted by the instant; the CSV writes the ISO instant as stored (UTC,
 *     'Z'), never a day.
 */
export const dayWords = (day: string): string => formatDate(`${day}T00:00:00`);
/** An event instant drawn as the viewer's local day of it (formatDate parses the ISO instant and prints it in the process's zone). */
export const instantDayWords = (instant: string): string => formatDate(instant);
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
/** The one read of a saved code: ROUTINES-01's helper, then the chart's name for an account (or the chart's two states); the helper's other states carry no name. */
function readAccount(books: readonly WorkBook[], charts: WorkCharts, bookId: string, savedCode: string | null): { readonly cell: AccountCell; readonly name: string | null } {
  const cell = accountCell(books, bookId, savedCode);
  if (cell.state !== 'account') return { cell, name: null };
  const chart = charts[bookId];
  return { cell, name: chart === undefined ? CHART_UNREAD_WORDS : chartNameOf(chart, cell.text) ?? CHART_MISSING_WORDS };
}
/** THE WORK's ACCOUNT — the helper's string and the chart's name in one cell; the helper's other states print their words; blank is null. */
export function accountWordsOf(books: readonly WorkBook[], charts: WorkCharts, bookId: string, savedCode: string | null): string | null {
  const { cell, name } = readAccount(books, charts, bookId, savedCode);
  if (cell.state === 'blank') return null;
  if (cell.state !== 'account') return cell.text;
  return name === CHART_UNREAD_WORDS || name === CHART_MISSING_WORDS ? `${cell.text} — ${name}` : `${cell.text} ${name}`;
}
/**
 * ROUTINE EXPENSES' ACCOUNT and ACCOUNT NAME (ROUTINES-03, Alex, 2026-10-25, ruling B): the helper's string alone ("P-8180"), and the
 * chart's name alone ("Streaming & Subscriptions"); the helper's non-account states and the chart's "not in the chart" / "chart not read"
 * print under ACCOUNT NAME. The one-cell "P-8180 Streaming & Subscriptions" left this table (THE WORK keeps it).
 */
export function accountCellsOf(books: readonly WorkBook[], charts: WorkCharts, bookId: string, savedCode: string | null): { readonly account: string | null; readonly name: string | null } {
  const { cell, name } = readAccount(books, charts, bookId, savedCode);
  if (cell.state === 'blank') return { account: null, name: null };
  if (cell.state !== 'account') return { account: null, name: cell.text };
  return { account: cell.text, name };
}

// PROJECTS-02 (Alex, 2026-10-25): the three column factories are exported — projectsTable.ts builds PROJECTS' spec from the same three (shared, not copied).
/** A VALUE column over one reader: "—" on screen for null; `key` (when given) is what it sorts by and writes — an ISO day under its drawn date. */
export function valueColumn<Row, Key extends string>(column: Key, label: string, words: (row: Row) => string | null, key: (row: Row) => string | null = words): TableColumn<Row, Key> {
  return { key: column, label, kind: 'value', words: (r) => words(r) ?? BLANK, sortKey: (r) => textKey(key(r)), csv: (r) => key(r) ?? '' };
}
/** A TEXT column over one reader: the filter and the sort read the full text. */
export function textColumn<Row, Key extends string>(column: Key, label: string, text: (row: Row) => string | null): TableColumn<Row, Key> {
  return { key: column, label, kind: 'text', words: (r) => text(r) ?? BLANK, sortKey: (r) => textKey(text(r)), csv: (r) => text(r) ?? '', text };
}
/** A MONEY column over one reader of cents: "$12.00" on screen, bare in the CSV, blanks sorted last. */
export function moneyColumn<Row, Key extends string>(column: Key, label: string, cents: (row: Row) => number | null): TableColumn<Row, Key> {
  return { key: column, label, kind: 'money', cents, words: (r) => { const c = cents(r); return c === null ? BLANK : moneyWords(c); }, sortKey: (r) => numberKey(cents(r)), csv: (r) => csvMoney(cents(r)) };
}
/** An EVENT INSTANT column (COLUMNS-01b ruling 2): the viewer's local day on screen, sorted by the instant, the ISO instant as stored in the CSV. */
export function instantColumn<Row, Key extends string>(column: Key, label: string, instant: (row: Row) => string | null): TableColumn<Row, Key> {
  return { key: column, label, kind: 'value', words: (r) => { const i = instant(r); return i === null ? BLANK : instantDayWords(i); }, sortKey: (r) => textKey(instant(r)), csv: (r) => instant(r) ?? '' };
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

// ── EXPENSES-02 (Alex, 2026-10-26, ruling A): THE VENDOR IS DECIDED ON THE ROW ──
/** The row control that opens the book's vendor list under the row. */
export const VENDOR_CONTROL_WORDS = 'vendor';
/** The panel's clear — the plan-vendors DELETE at the every-occurrence address. */
export const VENDOR_CLEAR_WORDS = 'clear';
/** A line already at the OCCURRENCE grain: the control prints this and writes nothing — the grain is never overridden here. */
export const VENDOR_BY_OCCURRENCE_REFUSAL_WORDS = 'this line names its vendor per stop — set it on the day card';
/** A line the month route did not return: nothing is known of its vendor here, so nothing is offered. */
export const VENDOR_MONTH_NOT_READ_WORDS = 'the month route did not return this line — its vendor cannot be read here';
/** "<name> · every time" — what the panel says of the vendor it holds. */
export const vendorHeldWords = (name: string): string => `${name} · every time`;
/** "+ add <name> to <book>" — the directory's POST, in the vendor box's own words. */
export const vendorAddWords = (name: string, book: string): string => `+ add ${name} to ${book}`;

/** The every-occurrence address of a row's plan: the line (routine_line) or, for a stepless routine, the routine itself. instant is null — EVERY occurrence; never an instant here. */
export const routineVendorAddressOf = (row: Pick<RoutineRow, 'routine' | 'line'>): { readonly kind: 'routine_line' | 'routine'; readonly id: string; readonly instant: null } =>
  (row.line === null ? { kind: 'routine', id: row.routine.id, instant: null } : { kind: 'routine_line', id: row.line.id, instant: null });

/** What the vendor control may do on a line: pick (holding nothing, or an every-occurrence vendor it can clear), or a named refusal that writes nothing. */
export type RoutineVendorControl =
  | { readonly kind: 'pick'; readonly held: { readonly name: string } | null }
  | { readonly kind: 'refusal'; readonly words: string };

/** By the month line's GRAIN, never its words: null or 'every' → pick; 'occurrence' → the ruling's refusal; 'both' → the month's own refusal; no line → not read. */
export function routineVendorControlOf(line: Pick<RoutineMonthLine, 'vendor_words' | 'vendor_grain'> | undefined): RoutineVendorControl {
  if (line === undefined) return { kind: 'refusal', words: VENDOR_MONTH_NOT_READ_WORDS };
  if (line.vendor_grain === 'occurrence') return { kind: 'refusal', words: VENDOR_BY_OCCURRENCE_REFUSAL_WORDS };
  if (line.vendor_grain === 'both') return { kind: 'refusal', words: line.vendor_words ?? VENDOR_MONTH_NOT_READ_WORDS };
  if (line.vendor_grain === 'every') return { kind: 'pick', held: { name: line.vendor_words ?? '' } };
  return { kind: 'pick', held: null };
}
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

// TASKS-03 (Alex, 2026-10-26, ruling A): the money together — ESTIMATE · ACTUAL · MATCH — in the ledger's words.
export const TASK_COLUMNS = ['task', 'project', 'book', 'status', 'deadline', 'estimate', 'actual', 'match', 'account', 'done'] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];
export const TASK_HEAD_WORDS: Readonly<Record<TaskColumn, string>> = {
  task: 'TASK', project: 'PROJECT', book: 'BOOK', status: 'STATUS', deadline: 'DEADLINE', estimate: 'ESTIMATE', actual: 'ACTUAL', match: 'MATCH', account: 'ACCOUNT', done: 'DONE',
};
/** TASKS-03: the heads' tooltips — ACTUAL is what was logged, MATCH what Books linked; the other heads have none. */
export const TASK_TOOLTIPS: Readonly<Partial<Record<TaskColumn, string>>> = { actual: 'as you logged it', match: 'postings linked in Books' };
export const TASK_TABLE_NAME = 'work';

/** STATUS — the task's status words (TASK_STATUS_LABELS; an unlabeled status is its raw value). */
export const taskStatusOf = (row: TaskRow): string => taskStatusWords(row.task.status);
/** DEADLINE — the task's ISO day, or null. */
export const taskDeadlineOf = (row: TaskRow): string | null => (row.task.deadline ? row.task.deadline.slice(0, 10) : null);
/** DONE — the instant the task was completed (completed_at — the task PATCH stamps now()), or null while it is not. COLUMNS-01b: an EVENT INSTANT, not a day. */
export const taskDoneAtOf = (row: TaskRow): string | null => row.task.completed_at || null;
/** A task's estimated cost in cents; null is blank. PROJECTS-02 (Alex, 2026-10-25): the one rule under THE WORK's ESTIMATE and PROJECTS' EST (the sum of these). */
export function estimateCentsOf(task: Pick<Task, 'estimated_cost_usd'>): number | null {
  const dollars = numberOrNull(task.estimated_cost_usd);
  return dollars === null ? null : Math.round(dollars * 100);
}
/** ESTIMATE in cents — the task's estimated cost; null is blank. */
export const taskEstimateCentsOf = (row: TaskRow): number | null => estimateCentsOf(row.task);
/** TASKS-03: ACTUAL in cents — the task's actual_cost_usd as logged; null is blank, never 0. */
export function actualCentsOf(task: Pick<Task, 'actual_cost_usd'>): number | null {
  const dollars = numberOrNull(task.actual_cost_usd);
  return dollars === null ? null : Math.round(dollars * 100);
}
export const taskActualCentsOf = (row: TaskRow): number | null => actualCentsOf(row.task);
/** TASKS-03: MATCH in cents — the tasks GET's sum of the postings linked to the task (taskMatch.ts); null with no link, an unreadable posting, or a task the GET did not carry. */
export const taskMatchCentsOf = (row: TaskRow): number | null => row.task.match_cents ?? null;
/** LINK-LAW-01 (ruling C): the linked postings the rows' MATCH left out because they were reversed — a task the GET did not answer carries no match, and adds none. */
export const tasksReversedOf = (rows: readonly TaskRow[]): number => rows.reduce((sum, row) => sum + (row.task.match_reversed === undefined ? 0 : row.task.match_reversed), 0);

/** THE WORK's spec, over the tab's books and their charts (BOOK and ACCOUNT read them). */
export function taskTable(books: readonly WorkBook[], charts: WorkCharts): readonly TableColumn<TaskRow, TaskColumn>[] {
  const head = TASK_HEAD_WORDS;
  const columns: readonly TableColumn<TaskRow, TaskColumn>[] = [
    textColumn<TaskRow, TaskColumn>('task', head.task, (r) => r.task.title),
    textColumn<TaskRow, TaskColumn>('project', head.project, (r) => r.project.title),
    valueColumn<TaskRow, TaskColumn>('book', head.book, (r) => bookNameOf(books, r.task.entity_id)),
    valueColumn<TaskRow, TaskColumn>('status', head.status, taskStatusOf),
    // COLUMNS-01 (Alex, 2026-10-25, ruling B): the ISO day drawn at LOCAL midnight (dayWords) — formatDate(day) alone parsed it as UTC midnight and showed the previous day west of Greenwich.
    valueColumn<TaskRow, TaskColumn>('deadline', head.deadline, (r) => { const d = taskDeadlineOf(r); return d === null ? null : dayWords(d); }, taskDeadlineOf),
    moneyColumn<TaskRow, TaskColumn>('estimate', head.estimate, taskEstimateCentsOf),
    // TASKS-03 (Alex, 2026-10-26, ruling A): ACTUAL as logged, MATCH from Books — the ledger's pair, the CSV bare like every money column.
    moneyColumn<TaskRow, TaskColumn>('actual', head.actual, taskActualCentsOf),
    moneyColumn<TaskRow, TaskColumn>('match', head.match, taskMatchCentsOf),
    textColumn<TaskRow, TaskColumn>('account', head.account, (r) => accountWordsOf(books, charts, r.task.entity_id, r.task.coa_code ?? null)),
    // COLUMNS-01b (Alex, 2026-10-25, ruling 2): DONE is an EVENT INSTANT — the viewer's day on screen, the instant in the sort and the CSV.
    instantColumn<TaskRow, TaskColumn>('done', head.done, taskDoneAtOf),
  ];
  return columns.map((c) => (TASK_TOOLTIPS[c.key] === undefined ? c : { ...c, title: TASK_TOOLTIPS[c.key] }));
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
    // ROUTINES-03: the row's id is the month record's key (routineMonth.ts monthLineKey) — one builder, so the figures land on their row.
    if (planned.lines.length === 0) rows.push({ id: monthLineKey(routine.id, null), routine, planned, line: null, end });
    else for (const line of planned.lines) rows.push({ id: monthLineKey(routine.id, line.id), routine, planned, line, end });
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
/**
 * ROUTINE — the routine's name alone (ROUTINES-03, Alex, 2026-10-25, ruling B). WORK-01b ruling 2's "<routine> — <line>" join
 * (LINE_NAME_JOIN) is RETIRED: the line is SUB ACCOUNT NAME's cell now, by the ledger's stop-name rule, so each column holds one fact.
 */
export const routineNameOf = (row: RoutineRow): string => row.routine.name;
/** SUB ACCOUNT NAME — the stop's name by the ledger's rule (dayCard.ts stopName): the line's activity; a stepless routine's own name. */
export const routineSubAccountOf = (row: RoutineRow): string => stopName({ line: row.line === null ? null : row.line.activity, label: row.routine.name });
/** CADENCE — the rule's word as FORM-01 prints it; a Once routine reads "once". */
export const routineCadenceOf = (row: RoutineRow): string => cadenceWords(row.routine.schedule_rrule);
/** DAYS — the rule's days; a rule no choice reproduces (Custom) names none, which is a blank cell here. */
export function routineDaysOf(row: RoutineRow): string | null {
  const words = daysWords(row.routine.schedule_rrule, row.routine.start_date);
  return words === DAYS_NONE_WORDS ? null : words;
}
/** BUDGET in cents (WORK-01's AMOUNT, renamed by ROUTINES-03) — the line's per-occurrence amount, a stepless routine's own when it is the figure in force (the leaf); null is blank. */
export function routineAmountCentsOf(row: RoutineRow): number | null {
  const dollars = row.line !== null ? row.line.amount : row.planned.from === 'routine' ? row.planned.amount : null;
  return dollars === null ? null : Math.round(dollars * 100);
}
/** The saved code a row carries: the line's, or a stepless routine's own. */
export const routineSavedCodeOf = (row: RoutineRow): string | null => (row.line !== null ? row.line.coaCode : row.routine.coa_code ?? null);

// ── ROUTINES-03 (Alex, 2026-10-25) — the cells Alex's order added ─────────────

/** KIND — once when the rule is a one-off (ONEOFF-01's isOnceRRule), else repeated. */
export const KIND_WORDS = { once: 'once', repeated: 'repeated' } as const;
export const routineKindOf = (row: RoutineRow): string => (isOnceRRule(row.routine.schedule_rrule) ? KIND_WORDS.once : KIND_WORDS.repeated);
/** A 'YYYY-MM-DD' day from the API's date text (a @db.Date comes as an ISO instant at UTC midnight); null stays null. */
export const isoDayOf = (text: string | null | undefined): string | null => (text ? text.slice(0, 10) : null);
/** START · END — the routine's start_date and end_date as ISO days. */
export const routineStartOf = (row: RoutineRow): string | null => isoDayOf(row.routine.start_date);
export const routineEndOf = (row: RoutineRow): string | null => isoDayOf(row.routine.end_date);
// COLUMNS-01 (Alex, 2026-10-25, ruling B): dayWords moved up to SHARED CELLS — the ONE way an ISO day is drawn, in every table.
/** NEXT — next_due_at as a day in the routine's own zone; null when none; a zone Intl cannot read is said (zoneUnreadWords), never placed in UTC. */
export function routineNextOf(row: RoutineRow): { readonly day: string | null; readonly words: string | null } {
  if (row.routine.next_due_at === null) return { day: null, words: null };
  try {
    return { day: instantToZoned(new Date(row.routine.next_due_at), row.routine.timezone).date, words: null };
  } catch (error) {
    return { day: null, words: zoneUnreadWords(row.routine.timezone, error instanceof Error ? error.message : String(error)) };
  }
}
/** ID — the line's id; a stepless routine's the routine's. */
export const routineIdOf = (row: RoutineRow): string => (row.line === null ? row.routine.id : row.line.id);

/** The month's figures by row id (routineMonth.ts monthLineKey) — the routines' month route's lines, read beside the routines. */
export type RoutineMonthMap = ReadonlyMap<string, RoutineMonthLine>;
/** A line the route did not return has blank figures — and is counted under the table (withoutMonthWords), never shown as 0. */
export const withoutMonthWords = (n: number): string => `${n} line${n === 1 ? '' : 's'} without month figures`;

export const ROUTINE_COLUMNS = [
  'start', 'end', 'kind', 'book', 'account', 'account_name', 'sub_account', 'vendor', 'routine', 'time', 'days', 'cadence', 'next',
  'budget', 'this_month', 'to_date', 'actual', 'match', 'variance', 'status', 'id',
] as const;
export type RoutineColumn = (typeof ROUTINE_COLUMNS)[number];
/**
 * The heads, in Alex's order (ROUTINES-03 ruling A): when it's in force → what kind → the accounting classification coarse to fine → who's
 * paid → the schedule → the money → the state → the identifier. The words are the task ledger's (ledger.ts LEDGER_HEAD_WORDS) wherever the
 * fact is the same — BOOK · ACCOUNT · ACCOUNT NAME · SUB ACCOUNT NAME · VENDOR · BUDGET · ACTUAL · VARIANCE · MATCH.
 */
export const ROUTINE_HEAD_WORDS: Readonly<Record<RoutineColumn, string>> = {
  start: 'START', end: 'END', kind: 'KIND', book: 'BOOK', account: 'ACCOUNT', account_name: 'ACCOUNT NAME', sub_account: 'SUB ACCOUNT NAME', vendor: 'VENDOR',
  routine: 'ROUTINE', time: 'TIME', days: 'DAYS', cadence: 'CADENCE', next: 'NEXT', budget: 'BUDGET', this_month: 'THIS MONTH', to_date: 'TO DATE',
  actual: 'ACTUAL', match: 'MATCH', variance: 'VARIANCE', status: 'STATUS', id: 'ID',
};
/** The CALCULATED columns' tooltips — each names its rule (the route labels the same figures). */
export const ROUTINE_TOOLTIPS: Readonly<Partial<Record<RoutineColumn, string>>> = {
  this_month: 'calculated: occurrences in the month × amount — the /budget rule',
  to_date: 'calculated: occurrences from the 1st to today × amount — the /budget rule',
  actual: 'calculated: recorded at the stops, the 1st to today',
  match: 'calculated: postings linked in Books, the 1st to today',
  variance: 'calculated: TO DATE − ACTUAL',
};
export const ROUTINE_TABLE_NAME = 'routine-expenses';

/**
 * COLUMNS-01 (Alex, 2026-10-25, ruling A): THIS MONTH · TO DATE · VARIANCE are blank for an INACTIVE routine — /budget excludes it
 * (routineBudgetInputs.ts reads is_active: true) and ROUTINE EXPENSES agrees — and the cell says why: the month rule's budget_words
 * ("inactive — not budgeted (/budget excludes it)"). undefined, no tooltip, on every other cell; ACTUAL and MATCH keep their figures.
 */
export function routineBudgetWordsOf(month: RoutineMonthMap, row: RoutineRow, column: RoutineColumn): string | undefined {
  if (column !== 'this_month' && column !== 'to_date' && column !== 'variance') return undefined;
  const line = month.get(row.id);
  if (line === undefined || line.budget_words === null) return undefined;
  return line.budget_words;
}
/** The figure a row's month record holds, or null when the route returned none for it. */
const figureOf = (month: RoutineMonthMap, row: RoutineRow, pick: (line: RoutineMonthLine) => number | null): number | null => {
  const line = month.get(row.id);
  return line === undefined ? null : pick(line);
};

/** ROUTINE EXPENSES' spec, over the tab's books, their charts and the month's figures (ruling A's 21 columns, in its order). */
export function routineTable(books: readonly WorkBook[], charts: WorkCharts, month: RoutineMonthMap): readonly TableColumn<RoutineRow, RoutineColumn>[] {
  const head = ROUTINE_HEAD_WORDS;
  const columns: TableColumn<RoutineRow, RoutineColumn>[] = [
    valueColumn<RoutineRow, RoutineColumn>('start', head.start, (r) => { const d = routineStartOf(r); return d === null ? null : dayWords(d); }, routineStartOf),
    valueColumn<RoutineRow, RoutineColumn>('end', head.end, (r) => { const d = routineEndOf(r); return d === null ? null : dayWords(d); }, routineEndOf),
    valueColumn<RoutineRow, RoutineColumn>('kind', head.kind, routineKindOf),
    valueColumn<RoutineRow, RoutineColumn>('book', head.book, (r) => bookNameOf(books, r.routine.entity_id)),
    valueColumn<RoutineRow, RoutineColumn>('account', head.account, (r) => accountCellsOf(books, charts, r.routine.entity_id, routineSavedCodeOf(r)).account),
    valueColumn<RoutineRow, RoutineColumn>('account_name', head.account_name, (r) => accountCellsOf(books, charts, r.routine.entity_id, routineSavedCodeOf(r)).name),
    textColumn<RoutineRow, RoutineColumn>('sub_account', head.sub_account, routineSubAccountOf),
    valueColumn<RoutineRow, RoutineColumn>('vendor', head.vendor, (r) => month.get(r.id)?.vendor_words ?? null),
    textColumn<RoutineRow, RoutineColumn>('routine', head.routine, routineNameOf),
    valueColumn<RoutineRow, RoutineColumn>('time', head.time, routineTimeOf),
    valueColumn<RoutineRow, RoutineColumn>('days', head.days, routineDaysOf),
    valueColumn<RoutineRow, RoutineColumn>('cadence', head.cadence, routineCadenceOf),
    valueColumn<RoutineRow, RoutineColumn>('next', head.next, (r) => { const n = routineNextOf(r); return n.day === null ? n.words : dayWords(n.day); }, (r) => { const n = routineNextOf(r); return n.day ?? n.words; }),
    moneyColumn<RoutineRow, RoutineColumn>('budget', head.budget, routineAmountCentsOf),
    moneyColumn<RoutineRow, RoutineColumn>('this_month', head.this_month, (r) => figureOf(month, r, (l) => l.budget_month_cents)),
    moneyColumn<RoutineRow, RoutineColumn>('to_date', head.to_date, (r) => figureOf(month, r, (l) => l.budget_to_date_cents)),
    moneyColumn<RoutineRow, RoutineColumn>('actual', head.actual, (r) => figureOf(month, r, (l) => l.actual_cents)),
    moneyColumn<RoutineRow, RoutineColumn>('match', head.match, (r) => figureOf(month, r, (l) => l.match_cents)),
    // VARIANCE wears the ledger's sign (varianceCellWords: "+$2.00" / "−$1.02" / "$0.00"); the CSV the bare cents.
    { key: 'variance', label: head.variance, kind: 'money', cents: (r) => figureOf(month, r, (l) => l.variance_cents), words: (r) => varianceCellWords(figureOf(month, r, (l) => l.variance_cents)), sortKey: (r) => numberKey(figureOf(month, r, (l) => l.variance_cents)), csv: (r) => csvMoney(figureOf(month, r, (l) => l.variance_cents)) },
    valueColumn<RoutineRow, RoutineColumn>('status', head.status, (r) => routineStatusOf(r.routine, r.end)),
    textColumn<RoutineRow, RoutineColumn>('id', head.id, routineIdOf),
  ];
  return columns.map((c) => (ROUTINE_TOOLTIPS[c.key] === undefined ? c : { ...c, title: ROUTINE_TOOLTIPS[c.key] }));
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
