/**
 * WORK-01 (Alex, 2026-10-24) — TASKS IS ONE TABLE.
 *
 * /tasks is THE WORK first, then PROJECTS. THE WORK is one DataTable (IDIOM-01,
 * name 'work'): one row per routine LINE (a stepless routine is one row), one
 * row per task — KIND · NAME · PROJECT · BOOK · CADENCE · DAYS · TIME ·
 * DEADLINE · AMOUNT · ACCOUNT · STATUS · controls (ruling A); the active
 * routines and the non-archived tasks shown at first as a VISIBLE STATUS filter
 * (ruling B); "+ routine" the existing form, "+ task" the task form under a
 * required project select posting to the existing route (ruling C); a row's
 * "edit" the EXISTING editor under it (ruling D; ruling 2 lifted RoutineRow's
 * into RoutineEditForm); PROJECTS keeps project rows only (ruling E; ruling 3:
 * the project row's "+ task" left, THE LOG's stays); the cockpit's Routines and
 * Projects tabs retired (ruling F; ruling 1: the Projects deck reads
 * claimForTool('Tasks')); the two-lists law holds the two mounts in order
 * (ruling G). The pure rules are driven over fixtures; the screens are pinned
 * to their source with comments stripped (TEST-TRUTH-01).
 *
 * WORK-01d (Alex, 2026-10-25) — TASKS IS THREE TABLES. The one table split in
 * two: THE WORK (SectionE_Work — one row per task of an OPEN project, 'work')
 * and ROUTINE EXPENSES (SectionF_RoutineExpenses — one row per routine line,
 * 'routine-expenses'), PROJECTS between them; KIND left with the merge, the one
 * builder became taskRowsOf and routineRowsOf, the one chip became each table's
 * own ("STATUS: open only" / "STATUS: active only"). Every pin below moved to
 * the table its subject now sits in — none was loosened; the merged table's
 * own pins (KIND, the one order, the one chip) are retired here and their
 * subjects pinned over the two builders in work01d.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  ALL_DAY_WORDS, CHART_MISSING_WORDS, PROJECT_REQUIRED_WORDS, ROUTINE_COLUMNS, ROUTINE_DEFAULT, ROUTINE_HEAD_WORDS, TASK_COLUMNS, TASK_DEFAULT, TASK_HEAD_WORDS,
  accountWordsOf, openProjects, routineAmountCentsOf, routineDefaultFilters, routineExpensesCsvFileName, routineNameOf, routineRowsOf, routineStatusOf, routineSubAccountOf,
  routineTable, routineTimeOf, rowCountWords, statusChipWords, statusDroppedOf, taskDefaultFilters, taskRowsOf, taskTable, workCsvFileName, withoutStatusFilter,
  type WorkBook, type WorkCharts, type WorkProject,
} from '../operations/work';
import { OPEN_PROJECT_STATUSES } from '../operations/morningLog';
import { daysWords } from '../operations/rruleHelpers';
import { filterRows, noFilters, withFilter } from '../table/filters';
import { sortRows } from '../table/sort';
import { tableCsv } from '../table/csv';
import { BLANK } from '../table/words';
import { COCKPIT_PATH, COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY } from '../toolRegistry';
import { OfferLawError, claimForCockpit, claimForTool } from '../offer';
import { DEFAULT_ROUTINE_FORM, type Routine, type RoutineStep } from '@/components/workbench/operations/routines/types';
import type { Project, Task } from '@/components/workbench/operations/projects/types';

const OPS = 'src/components/workbench/operations';
const PAGE = 'src/app/tasks/page.tsx';
const SECTION_E = `${OPS}/SectionE_Work.tsx`;
const SECTION_F = `${OPS}/SectionF_RoutineExpenses.tsx`; // WORK-01d (2026-10-25): the routines' own table
const SHARED = `${OPS}/workShared.tsx`; // WORK-01d: the GET helper, the charts hook and the cell the two tables share
const SECTION_D = `${OPS}/SectionD_ProjectBacklog.tsx`;
const ROWS = `${OPS}/projects/ProjectTableRows.tsx`;
const TABLE = `${OPS}/projects/ProjectsTable.tsx`;
const SPEC = 'src/lib/operations/projectsTable.ts'; // PROJECTS-02 (Alex, 2026-10-25): PROJECTS' pure spec
const EDIT_FORM = `${OPS}/routines/RoutineEditForm.tsx`;
const WORK_LIB = 'src/lib/operations/work.ts';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const DECK = 'src/components/home/ProjectsShowcaseSections.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const MORNING_LOG = `${OPS}/stops/MorningLog.tsx`;
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';
const GONE = [`${OPS}/routines/RoutineRow.tsx`, `${OPS}/routines/RoutineList.tsx`, `${OPS}/projects/TaskTableRow.tsx`, `${OPS}/SectionE_Routines.tsx`];

const at = (f: string) => resolve(process.cwd(), f);
const walk = (dir: string): string[] => readdirSync(at(dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));

// ── THE FIXTURES ──────────────────────────────────────────────────────────────

const NOW = new Date('2026-10-24T12:00:00.000Z');
const BOOKS: WorkBook[] = [{ id: 'p', name: 'Personal', entity_type: 'personal' }, { id: 'b', name: 'Business', entity_type: 'sole_prop' }];
const CHARTS: WorkCharts = {
  p: [{ code: '6150', name: 'Food & drink', account_type: 'expense', entity_id: 'p' }, { code: '6200', name: 'Fitness', account_type: 'expense', entity_id: 'p' }],
  b: [{ code: '6080', name: 'Office Expense', account_type: 'expense', entity_id: 'b' }],
};
const step = (o: Partial<RoutineStep> & { id: string; activity: string; step_order: number }): RoutineStep => ({
  routine_id: 'r', user_id: 'u', entity_id: 'p', time_of_day: null, sub_activity: null, location: null, duration_minutes: null, notes: null,
  created_at: '', updated_at: '', created_by: null, ...o,
});
const routine = (o: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'p', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', timezone: 'Asia/Bangkok',
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T07:30:00.000Z',
  is_active: true, created_at: '', updated_at: '', created_by: null, budget_amount: null, coa_code: null, role: 'place', steps: [], ...o,
});
/** A 3-line routine: Coffee $3 / 6150, Stretch (no amount), Journal $0.50 / 6150 — each row's ROUTINE is "Morning — <line>" (WORK-01b, ruling 2). */
const MORNING = routine({ id: 'morning', name: 'Morning', steps: [
  step({ id: 's3', activity: 'Journal', step_order: 3, budget_amount: '0.50', coa_code: '6150' }),
  step({ id: 's1', activity: 'Coffee', step_order: 1, budget_amount: '3.00', coa_code: '6150' }),
  step({ id: 's2', activity: 'Stretch', step_order: 2 }),
] });
/** A Once routine (ONEOFF-01: FREQ=DAILY;COUNT=1 on its day) — CADENCE "once". */
const DENTIST = routine({ id: 'dentist', name: 'Dentist', schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', start_date: '2026-11-03', end_date: '2026-11-03', start_time: '1970-01-01T14:00:00.000Z', end_time: '1970-01-01T15:00:00.000Z', budget_amount: '40', coa_code: '6150' });
/** An all-day charge (ALLDAY-01): no clock — TIME "all day". */
const APPLE = routine({ id: 'apple', name: 'Apple storage', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0;BYSECOND=0', start_time: null, end_time: null, budget_amount: '2.99', coa_code: '6200' });
/** Ended on 2026-10-20 (ROUTINE-02a) — STATUS ended, whatever is_active says; a Business account. */
const OLD = routine({ id: 'old', name: 'Old bill', entity_id: 'b', end_date: '2026-10-20', is_active: false, budget_amount: '12', coa_code: '6080' });
/** Deactivated, not ended — STATUS inactive; no amount, no account; a code the chart does not list would say so. */
const PAUSED = routine({ id: 'paused', name: 'Paused', is_active: false });
const project = (o: Partial<Project> & { id: string; title: string }): Project => ({ entity_id: 'p', status: 'in_progress', ...o } as Project);
const task = (o: Partial<Task> & { id: string; title: string; project_id: string }): Task => ({ entity_id: 'p', status: 'open', estimated_cost_usd: null, deadline: null, coa_code: null, completed_at: null, ...o } as Task);
const HOME = project({ id: 'home', title: 'HOME-01' });
const SHIP = project({ id: 'ship', title: 'Ship it', status: 'archived' });
const T_ROUTE = task({ id: 't1', title: 'write the route', project_id: 'home', estimated_cost_usd: '12.50', coa_code: '6150', deadline: '2026-10-30T00:00:00.000Z' });
const T_GONE = task({ id: 't2', title: 'old chore', project_id: 'ship', status: 'archived' });
const T_DONE = task({ id: 't3', title: 'merged', project_id: 'home', status: 'completed', completed_at: '2026-10-22T09:00:00.000Z' });
const PROJECTS: WorkProject[] = [{ project: HOME, tasks: [T_ROUTE, T_DONE] }, { project: SHIP, tasks: [T_GONE] }];
// WORK-01d (Alex, 2026-10-25): two builders, two specs — the routines' rows and the tasks' rows are never one list.
const R_ROWS = routineRowsOf([MORNING, DENTIST, APPLE, OLD, PAUSED], NOW);
const T_ROWS = taskRowsOf(PROJECTS);
const R_COLUMNS = routineTable(BOOKS, CHARTS, new Map()); // ROUTINES-03 (2026-10-25): the spec takes the month's figures too — none here (routines03.test.ts drives them)
const T_COLUMNS = taskTable(BOOKS, CHARTS);
const rcell = (id: string, key: typeof ROUTINE_COLUMNS[number]) => R_COLUMNS.find((c) => c.key === key)!.words(R_ROWS.find((r) => r.id === id)!);
const tcell = (id: string, key: typeof TASK_COLUMNS[number]) => T_COLUMNS.find((c) => c.key === key)!.words(T_ROWS.find((r) => r.id === id)!);
const drawn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// ── T1 · THE ROWS ─────────────────────────────────────────────────────────────

test('T1 one row per routine line, one per stepless routine — in clock order then name; one row per task of an OPEN project, project by project', () => {
  // Clock order then name (FORM-01's byClockThenName): the all-day charge's derived clock is 00:00, then the 07:00 three by name, then 14:00.
  assert.deepEqual(R_ROWS.map((r) => r.id), ['routine:apple', 'routine:morning:s1', 'routine:morning:s2', 'routine:morning:s3', 'routine:old', 'routine:paused', 'routine:dentist']);
  // WORK-01d (Alex, 2026-10-25, ruling B): the archived project's task is NOT a row — THE WORK is the open projects' tasks; its home is PROJECTS → show archived → the row's details.
  assert.deepEqual(T_ROWS.map((r) => r.id), ['task:t1', 'task:t3']);
  // The 3-line routine is 3 rows — each line's own budget and account; ROUTINES-03 (Alex, 2026-10-25, ruling B): ROUTINE is the routine's name alone
  // (WORK-01b ruling 2's "<routine> — <line>" join retired), the line is SUB ACCOUNT NAME's, AMOUNT is BUDGET, ACCOUNT and ACCOUNT NAME are two cells.
  assert.deepEqual(['s1', 's2', 's3'].map((s) => rcell(`routine:morning:${s}`, 'routine')), ['Morning', 'Morning', 'Morning']);
  assert.deepEqual(['s1', 's2', 's3'].map((s) => rcell(`routine:morning:${s}`, 'sub_account')), ['Coffee', 'Stretch', 'Journal']);
  assert.equal(rcell('routine:dentist', 'routine'), 'Dentist');
  assert.equal(rcell('routine:dentist', 'sub_account'), 'Dentist', 'a stepless routine: its own name (stopName)');
  assert.equal(tcell('task:t1', 'task'), 'write the route');
  assert.deepEqual(['s1', 's2', 's3'].map((s) => rcell(`routine:morning:${s}`, 'budget')), ['$3.00', BLANK, '$0.50']);
  assert.deepEqual(['s1', 's2', 's3'].map((s) => rcell(`routine:morning:${s}`, 'account')), ['P-6150', BLANK, 'P-6150']);
  assert.deepEqual(['s1', 's2', 's3'].map((s) => rcell(`routine:morning:${s}`, 'account_name')), ['Food & drink', BLANK, 'Food & drink']);
  assert.equal(rcell('routine:dentist', 'budget'), '$40.00');
  assert.equal(rcell('routine:old', 'account'), 'B-6080', 'the book\'s letter');
  assert.equal(rcell('routine:old', 'account_name'), 'Office Expense', 'the chart\'s name');
  assert.equal(rcell('routine:old', 'book'), 'Business');
});

test('T1 the merged KIND left (WORK-01d, Alex, 2026-10-25): work.ts holds no kindOf, no merged builder; THE WORK has no KIND — ROUTINE EXPENSES\' own KIND is ROUTINES-03\'s', () => {
  // WORK-01 said: a task is once; a routine is once when its rule is Once, else repeated. WORK-01d: a task is a row of THE WORK, a routine line a row of
  // ROUTINE EXPENSES — the table says what the column said, so the column is retired, not loosened (its subjects: work01d.test.ts).
  // ROUTINES-03 (Alex, 2026-10-25, ruling E): KIND is ROUTINE EXPENSES' own column again — once | repeated over its routines alone (routines03.test.ts);
  // the pin narrowed to the merged table's names.
  const w = code(WORK_LIB);
  assert.doesNotMatch(w, /\bkindOf\b|WORK_KINDS|\bworkRowsOf\b|\bworkTable\b/);
  assert.ok(!(TASK_COLUMNS as readonly string[]).includes('kind') && !Object.values(TASK_HEAD_WORDS).includes('KIND'));
  assert.ok((ROUTINE_COLUMNS as readonly string[]).includes('kind') && ROUTINE_HEAD_WORDS.kind === 'KIND');
  assert.deepEqual(['routine:dentist', 'routine:morning:s1'].map((id) => rcell(id, 'kind')), ['once', 'repeated']);
  assert.equal(rcell('routine:dentist', 'cadence'), 'once', 'a Once routine still reads "once" — under CADENCE');
  assert.match(comments(WORK_LIB), /WORK-01d replaced the KIND\s*\n?\s*\*?\s*column with the two tables themselves/);
});

test('T1 the words by column: a routine has its cadence, days and time, "all day" for a null clock; a task its project, deadline, estimate and done day; nulls are "—"', () => {
  assert.deepEqual([rcell('routine:morning:s1', 'cadence'), rcell('routine:morning:s1', 'days'), rcell('routine:morning:s1', 'time')], ['daily', 'Mon–Sun', '07:00 – 07:30']);
  assert.equal(rcell('routine:dentist', 'cadence'), 'once');
  assert.equal(rcell('routine:dentist', 'days'), daysWords(DENTIST.schedule_rrule, DENTIST.start_date), 'the once date, as FORM-01 prints it');
  assert.equal(rcell('routine:apple', 'time'), ALL_DAY_WORDS);
  assert.equal(ALL_DAY_WORDS, 'all day');
  assert.equal(routineTimeOf(R_ROWS[0]), 'all day');
  assert.equal(tcell('task:t1', 'project'), 'HOME-01');
  assert.equal(tcell('task:t1', 'deadline'), drawn('2026-10-30'));
  assert.equal(T_COLUMNS.find((c) => c.key === 'deadline')!.csv(T_ROWS.find((r) => r.id === 'task:t1')!), '2026-10-30', 'the CSV and the sort read the ISO day');
  assert.equal(tcell('task:t3', 'deadline'), BLANK);
  assert.equal(tcell('task:t1', 'estimate'), '$12.50');
  assert.equal(tcell('task:t3', 'estimate'), BLANK);
  assert.equal(tcell('task:t1', 'account'), 'P-6150 Food & drink');
  // WORK-01d (ruling B): DONE is completed_at, "—" while open. COLUMNS-01b (Alex, 2026-10-25, ruling 2): an EVENT INSTANT — the viewer's day on screen,
  // the ISO instant as stored in the CSV (columns01b.test.ts holds the two zones).
  assert.equal(tcell('task:t1', 'done'), BLANK);
  assert.equal(tcell('task:t3', 'done'), drawn('2026-10-22'));
  assert.equal(T_COLUMNS.find((c) => c.key === 'done')!.csv(T_ROWS.find((r) => r.id === 'task:t3')!), '2026-10-22T09:00:00.000Z');
  assert.equal(rcell('routine:paused', 'budget'), BLANK);
  assert.equal(rcell('routine:paused', 'account'), BLANK);
  assert.equal(rcell('routine:paused', 'account_name'), BLANK);
  assert.equal(routineAmountCentsOf(R_ROWS.find((r) => r.id === 'routine:apple')!), 299);
  // A code the book's chart does not list is said, never silently bare; a book with no chart read is said too (THE WORK's one cell, one helper).
  assert.equal(accountWordsOf(BOOKS, CHARTS, 'p', '6999'), `P-6999 — ${CHART_MISSING_WORDS}`);
  assert.equal(accountWordsOf(BOOKS, {}, 'p', '6999'), 'P-6999 — chart not read');
  assert.equal(accountWordsOf([], CHARTS, 'p', '6999'), 'book not loaded', 'ROUTINES-01\'s helper states the book');
  // ROUTINES-03 (Alex, 2026-10-25, ruling B): on ROUTINE EXPENSES the chart's two states and the helper's non-account states print under ACCOUNT NAME.
  const stray = routineRowsOf([routine({ id: 'stray', name: 'Stray', budget_amount: '5', coa_code: '6999' })], NOW)[0];
  const strayColumns = routineTable(BOOKS, CHARTS, new Map());
  assert.equal(strayColumns.find((c) => c.key === 'account')!.words(stray), 'P-6999');
  assert.equal(strayColumns.find((c) => c.key === 'account_name')!.words(stray), CHART_MISSING_WORDS);
});

test('T1 STATUS: a routine is ended first (ROUTINE-02a, judged now in its zone), then inactive, else active; a task wears its status words', () => {
  assert.deepEqual(['routine:apple', 'routine:old', 'routine:paused', 'routine:dentist'].map((id) => rcell(id, 'status')), ['active', 'ended', 'inactive', 'active']);
  assert.deepEqual(['task:t1', 'task:t3'].map((id) => tcell(id, 'status')), ['new', 'done']);
  const old = R_ROWS.find((r) => r.id === 'routine:old')!;
  assert.equal(routineStatusOf(old.routine, old.end), 'ended', 'ended wins over inactive');
});

// ── T2 · THE SPECS ────────────────────────────────────────────────────────────

// TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. ACTUAL · MATCH sit after ESTIMATE (tasks03.test.ts).
test('T2 the two specs (WORK-01d): THE WORK — TASK · PROJECT · BOOK · STATUS · DEADLINE · ESTIMATE · ACTUAL · MATCH · ACCOUNT · DONE (TASKS-03); ROUTINE EXPENSES — its 21 columns in Alex\'s order (ROUTINES-03)', () => {
  assert.deepEqual([...TASK_COLUMNS], ['task', 'project', 'book', 'status', 'deadline', 'estimate', 'actual', 'match', 'account', 'done']);
  assert.deepEqual(T_COLUMNS.map((c) => c.key), [...TASK_COLUMNS]);
  assert.deepEqual(T_COLUMNS.map((c) => c.label), ['TASK', 'PROJECT', 'BOOK', 'STATUS', 'DEADLINE', 'ESTIMATE', 'ACTUAL', 'MATCH', 'ACCOUNT', 'DONE']);
  assert.deepEqual(T_COLUMNS.map((c) => c.label), TASK_COLUMNS.map((k) => TASK_HEAD_WORDS[k]));
  assert.deepEqual(Object.fromEntries(T_COLUMNS.map((c) => [c.key, c.kind])), {
    task: 'text', project: 'text', book: 'value', status: 'value', deadline: 'value', estimate: 'money', actual: 'money', match: 'money', account: 'text', done: 'value',
  });
  // ROUTINES-03 (Alex, 2026-10-25, ruling A): the 21 columns in Alex's order — WORK-01d's eight sit among them (AMOUNT renamed BUDGET); the full
  // order, heads and kinds are routines03.test.ts's pins.
  assert.equal(ROUTINE_COLUMNS.length, 21);
  assert.deepEqual(R_COLUMNS.map((c) => c.key), [...ROUTINE_COLUMNS]);
  assert.deepEqual(R_COLUMNS.map((c) => c.label), ROUTINE_COLUMNS.map((k) => ROUTINE_HEAD_WORDS[k]));
  assert.deepEqual(['routine', 'book', 'cadence', 'days', 'time', 'budget', 'account', 'status'].map((k) => R_COLUMNS.find((c) => c.key === k)!.kind), ['text', 'value', 'value', 'value', 'value', 'money', 'value', 'value']);
  // A text column's filter reads the full text; a blank is null there, "—" on screen, '' in the CSV (ROUTINES-03: SUB ACCOUNT NAME is the text column; ACCOUNT a value).
  const sub = R_COLUMNS.find((c) => c.key === 'sub_account')!;
  assert.equal(sub.kind === 'text' && sub.text(R_ROWS.find((r) => r.id === 'routine:paused')!), 'Paused');
  const account = R_COLUMNS.find((c) => c.key === 'account')!;
  assert.equal(account.words(R_ROWS.find((r) => r.id === 'routine:paused')!), BLANK);
  assert.equal(account.csv(R_ROWS.find((r) => r.id === 'routine:paused')!), '');
});

// ── T3 · THE DEFAULTS (ruling B of WORK-01; rulings B and C of WORK-01d) ─────

test('T3 each table\'s default is a VISIBLE STATUS chip — "STATUS: open only" over the tasks, "STATUS: active only" over the routines — already applied, and its clear shows everything', () => {
  // WORK-01 ruling B / WORK-01b ruling 1 said one chip: "STATUS: not ended, not inactive, not archived". WORK-01d (Alex, 2026-10-25): each table its own —
  // the tasks drop done, cancelled and archived; the routines drop ended and inactive.
  assert.deepEqual(TASK_DEFAULT, { dropped: ['done', 'cancelled', 'archived'], words: 'STATUS: open only' });
  assert.deepEqual(ROUTINE_DEFAULT, { dropped: ['ended', 'inactive'], words: 'STATUS: active only' });
  const tf = taskDefaultFilters(T_COLUMNS);
  assert.deepEqual(statusDroppedOf(tf), ['done', 'cancelled', 'archived']);
  assert.equal(statusChipWords(statusDroppedOf(tf), TASK_DEFAULT), 'STATUS: open only');
  for (const c of T_COLUMNS) if (c.key !== 'status') assert.deepEqual(tf[c.key], noFilters(T_COLUMNS)[c.key]);
  assert.deepEqual(filterRows(T_ROWS, tf, T_COLUMNS).map((r) => r.id), ['task:t1'], 'the done task is hidden');
  assert.deepEqual(filterRows(T_ROWS, withoutStatusFilter(tf), T_COLUMNS).map((r) => r.id), ['task:t1', 'task:t3']);
  const rf = routineDefaultFilters(R_COLUMNS);
  assert.deepEqual(statusDroppedOf(rf), ['ended', 'inactive']);
  assert.equal(statusChipWords(statusDroppedOf(rf), ROUTINE_DEFAULT), 'STATUS: active only');
  for (const c of R_COLUMNS) if (c.key !== 'status') assert.deepEqual(rf[c.key], noFilters(R_COLUMNS)[c.key]);
  assert.deepEqual(filterRows(R_ROWS, rf, R_COLUMNS).map((r) => r.id), ['routine:apple', 'routine:morning:s1', 'routine:morning:s2', 'routine:morning:s3', 'routine:dentist'], 'the ended and the inactive routines are hidden');
  assert.deepEqual(filterRows(R_ROWS, withoutStatusFilter(rf), R_COLUMNS).map((r) => r.id), R_ROWS.map((r) => r.id));
  assert.deepEqual(statusDroppedOf(withoutStatusFilter(rf)), []);
  // A chip narrowed by hand spells its values; the named words are the exact default's alone.
  assert.equal(statusChipWords(['done'], TASK_DEFAULT), 'STATUS: not done');
  assert.equal(statusChipWords(['archived', 'cancelled', 'done'], TASK_DEFAULT), 'STATUS: open only', 'the same set in any order');
  // THE WORK's reads: the projects GET (no include_archived — its default leaves the archived out; the open set narrows the rest here), then each OPEN
  // project's tasks with include_archived=true (the tasks route's default excludes archived); the filter alone narrows the rows.
  const e = code(SECTION_E);
  assert.match(e, /const projectsBody = await readJson\('\/api\/operations\/projects', 'projects'\);\n\s*const projects = openProjects\(\(projectsBody\.projects \?\? \[\]\) as Project\[\]\);/);
  assert.match(e, /readJson\(`\/api\/operations\/projects\/\$\{p\.id\}\/tasks\?include_archived=true`/);
  assert.doesNotMatch(e, /projects\?include_archived|\/api\/operations\/routines/, 'no archived project is read; no routine is read here');
  assert.match(e, /const \[filters, setFilters\] = useState<TableFilters>\(\(\) => taskDefaultFilters\(taskTable\(\[\], \{\}\)\)\);/, 'applied at first');
  assert.match(e, /\{filterOn\(filters, 'status', 'value'\) && \(\n\s*<button type="button" className=\{chipOn\} onClick=\{\(\) => setFilters\(withoutStatusFilter\(filters\)\)\} \{\.\.\.dataAttr\(name, 'status-chip'\)\}>\n\s*\{statusChipWords\(statusDroppedOf\(filters\), TASK_DEFAULT\)\} \{CLEAR_CHIP_MARK\}/, 'the chip, and its click clears it');
  // ROUTINE EXPENSES' reads: every routine, active or not; the filter alone narrows.
  const f = code(SECTION_F);
  assert.match(f, /readJson\('\/api\/operations\/routines', 'routines'\)/, 'every routine, active or not (no ?is_active=true)');
  assert.doesNotMatch(f, /\/api\/operations\/projects/, 'no project is read here');
  assert.match(f, /const \[filters, setFilters\] = useState<TableFilters>\(\(\) => routineDefaultFilters\(routineTable\(\[\], \{\}, NO_MONTH\)\)\);/, 'applied at first'); // ROUTINES-03: the spec takes the month too
  assert.match(f, /\{filterOn\(filters, 'status', 'value'\) && \(\n\s*<button type="button" className=\{chipOn\} onClick=\{\(\) => setFilters\(withoutStatusFilter\(filters\)\)\} \{\.\.\.dataAttr\(name, 'status-chip'\)\}>\n\s*\{statusChipWords\(statusDroppedOf\(filters\), ROUTINE_DEFAULT\)\} \{CLEAR_CHIP_MARK\}/, 'the chip, and its click clears it');
  // Each book's chart, for ACCOUNT's names — the shared hook, once per table.
  assert.match(code(SHARED), /readJson\(`\/api\/chart-of-accounts\?entity_id=\$\{encodeURIComponent\(e\.id\)\}`/);
  for (const s of [e, f]) {
    assert.match(s, /const chartsRead = useBookCharts\(entities\);/);
    assert.doesNotMatch(s, /show inactive|show ended|showInactive|showEnded/, 'the toggles are the STATUS checklist now');
    assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie/);
  }
});

// ── T4 · SORT AND CSV ────────────────────────────────────────────────────────

test('T4 sort by BUDGET / ESTIMATE descending puts the dearest first and the blanks last; each CSV is its spec\'s, money bare, a blank an empty field, each file its own name', () => {
  // ROUTINES-03 (Alex, 2026-10-25): AMOUNT is BUDGET; the CSV carries the 21 columns in Alex's order — dates ISO, money bare, the full id.
  const desc = sortRows(R_ROWS, { column: 'budget', direction: 'desc' }, R_COLUMNS).map((r) => r.id);
  assert.deepEqual(desc, ['routine:dentist', 'routine:old', 'routine:morning:s1', 'routine:apple', 'routine:morning:s3', 'routine:morning:s2', 'routine:paused'], 'blanks last, in the order given');
  assert.deepEqual(sortRows(T_ROWS, { column: 'estimate', direction: 'desc' }, T_COLUMNS).map((r) => r.id), ['task:t1', 'task:t3']);
  assert.equal(tableCsv(R_COLUMNS, R_ROWS.filter((r) => r.id === 'routine:morning:s1')), 'START,END,KIND,BOOK,ACCOUNT,ACCOUNT NAME,SUB ACCOUNT NAME,VENDOR,ROUTINE,TIME,DAYS,CADENCE,NEXT,BUDGET,THIS MONTH,TO DATE,ACTUAL,MATCH,VARIANCE,STATUS,ID\r\n'
    + ',,repeated,Personal,P-6150,Food & drink,Coffee,,Morning,07:00 – 07:30,Mon–Sun,daily,,3.00,,,,,,active,s1\r\n');
  // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13. Two empty money fields more per row — the fixtures log no actual and carry no match.
  assert.equal(tableCsv(T_COLUMNS, T_ROWS), 'TASK,PROJECT,BOOK,STATUS,DEADLINE,ESTIMATE,ACTUAL,MATCH,ACCOUNT,DONE\r\n'
    + 'write the route,HOME-01,Personal,new,2026-10-30,12.50,,,P-6150 Food & drink,\r\n'
    + 'merged,HOME-01,Personal,done,,,,,,2026-10-22T09:00:00.000Z\r\n'); // COLUMNS-01b (2026-10-25, ruling 2): DONE writes the instant as stored
  assert.equal(workCsvFileName('2026-10-24'), 'work_2026-10-24.csv');
  assert.equal(routineExpensesCsvFileName('2026-10-24'), 'routine-expenses_2026-10-24.csv'); // WORK-01d (ruling C)
  assert.equal(rowCountWords(8, 10), '8 of 10 rows');
  const e = code(SECTION_E); const f = code(SECTION_F);
  assert.match(e, /\{ name: workCsvFileName\(localToday\(\)\) \}/);
  assert.match(f, /\{ name: routineExpensesCsvFileName\(localToday\(\)\) \}/);
});

// ── T5 · THE PAGE, THE LAW, THE SECTIONS ─────────────────────────────────────

test('T5 /tasks mounts THE WORK, PROJECTS in its Suspense boundary, then ROUTINE EXPENSES; the two-lists law says so', () => {
  const page = code(PAGE);
  // WORK-01d (Alex, 2026-10-25, ruling A): three mounts, in order.
  // EXPENSES-01 (Alex, 2026-10-25): ROUTINE EXPENSES moved to /expenses (src/app/expenses/page.tsx) — Tasks is THE WORK and PROJECTS. Two mounts, in order.
  assert.match(page, /<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<\/div>/);
  assert.doesNotMatch(page, /SectionE_Routines/);
  assert.match(comments(PAGE), /WORK-01 \(Alex, 2026-10-24\) — TASKS IS ONE TABLE/);
  assert.match(comments(PAGE), /WORK-01d \(Alex, 2026-10-25, ruling A\): Tasks is three tables/);
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>'\];/); // EXPENSES-01 (2026-10-25): two — ROUTINE EXPENSES is /expenses'
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionE_Work SectionD_ProjectBacklog'/);
  assert.match(comments(LAW), /WORK-01 — the ruling \(Alex, 2026-10-24\): Tasks is ONE TABLE/);
  assert.match(comments(LAW), /WORK-01d — the ruling \(Alex, 2026-10-25\): Tasks is THREE TABLES/);
  const controls = law.slice(law.indexOf('const controls: Array<[string, RegExp, string]> = ['), law.indexOf('for (const [f, re, why] of controls)'));
  assert.match(controls, /\['src\/components\/workbench\/operations\/SectionF_RoutineExpenses\.tsx', \/ADD_ROUTINE_WORDS\//, 'the law holds ROUTINE EXPENSES\' "+ routine"');
  assert.match(controls, /\['src\/components\/workbench\/operations\/SectionE_Work\.tsx', \/ADD_TASK_WORDS\//, 'the law holds THE WORK\'s "+ task"');
  for (const f of ['SectionE_Work', 'SectionF_RoutineExpenses']) {
    assert.match(controls, new RegExp(`\\['src/components/workbench/operations/${f}\\.tsx', /statusChipWords\\\\\\(/`), `the law holds ${f}'s chip`);
    assert.match(controls, new RegExp(`\\['src/components/workbench/operations/${f}\\.tsx', /<DataTable/`), `the law holds ${f}'s shared table`);
  }
  assert.doesNotMatch(controls, /SectionE_Work\.tsx', \/ADD_ROUTINE_WORDS\//, 'THE WORK has no "+ routine" to hold');
  assert.doesNotMatch(law, /routines\/RoutineList\.tsx|routines\/RoutineRow\.tsx|SectionE_Routines/, 'no law names a file that left');
  // The sections: the shared table over the pure specs, named 'work' and 'routine-expenses'.
  const e = code(SECTION_E); const f = code(SECTION_F);
  for (const s of [e, f]) {
    assert.match(s, /import DataTable, \{ cellClass as cell, chipClass as chip \} from '@\/components\/table\/DataTable';/);
    assert.match(s, /<DataTable\n\s*name=\{name\}\n\s*columns=\{columns\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{loaded\}/);
    assert.match(s, /const shown = sortRows\(filterRows\(rows, filters, columns\), sort, columns\);/);
    assert.doesNotMatch(s, /<table\b|<thead\b|ROUTINE_TABLE_COLUMNS|data-routines-book|data-all-day-band|booksInOrder/, 'no table of its own, no per-book tables, no ALL DAY band');
    assert.doesNotMatch(s, /StageStrip|ProofStrip|PIPE_PHASES|TodaysStrip/);
  }
  assert.match(e, /const name = TASK_TABLE_NAME;/); assert.match(f, /const name = ROUTINE_TABLE_NAME;/);
  assert.match(e, /taskRowsOf\(read\.projects\)/);
  assert.match(f, /routineRowsOf\(read\.routines, new Date\(\)\)/);
  assert.match(code(SHARED), /export function WorkCell<Row, Key extends string>/, 'one cell for both tables');
});

test('T5 "+ routine" is the existing form on ROUTINE EXPENSES; "+ task" on THE WORK is the task form under a REQUIRED project select, refused by name without one, posting to the existing route', () => {
  const e = code(SECTION_E); const f = code(SECTION_F);
  assert.match(f, /<RoutineCreateForm\n\s*entities=\{entities\}\n\s*defaultEntityId=\{createEntityId\}/); // WORK-01d: the routines' table
  assert.doesNotMatch(e, /RoutineCreateForm|ADD_ROUTINE_WORDS/);
  assert.match(e, /<NewTaskForm projects=\{projects\} charts=\{charts\}/);
  const form = e.slice(e.indexOf('function NewTaskForm('));
  const refusal = form.indexOf('if (project === null) {\n      setError(PROJECT_REQUIRED_WORDS);\n      return;\n    }');
  const post = form.indexOf('fetch(`/api/operations/projects/${project.id}/tasks`, {\n        method: \'POST\'');
  assert.ok(refusal > -1 && post > refusal, 'refused before any request');
  assert.match(form, /<select value=\{projectId\} onChange=[\s\S]*?required \{\.\.\.dataAttr\(name, 'task-project'\)\}>/);
  assert.match(form, /body: JSON\.stringify\(form\),/, 'the same body useProjectTasks posts');
  assert.match(form, /<TaskCreateInputs\n\s*createForm=\{form\}/);
  assert.equal(PROJECT_REQUIRED_WORDS, 'pick the project — a task belongs to one');
  // WORK-01d (ruling B): the open set is morningLog.ts's — the ONE set (THE LOG, the reorder route, the reflection prompt read it); work.ts defines none of its own.
  assert.deepEqual([...OPEN_PROJECT_STATUSES].sort(), ['backlog', 'blocked', 'in_progress', 'not_started', 'scheduled', 'scoped']);
  assert.match(code(WORK_LIB), /import \{ isOpenProjectStatus \} from '@\/lib\/operations\/morningLog';/);
  assert.doesNotMatch(code(WORK_LIB), /OPEN_PROJECT_STATUSES\s*=/, 'no second set');
  assert.deepEqual(openProjects([HOME, SHIP, project({ id: 'done', title: 'Done', status: 'completed' }), project({ id: 'cut', title: 'Cut', status: 'cancelled' })]).map((p) => p.id), ['home']);
  // No new write route: the only writers each section calls are the routes that exist — THE WORK the projects routes, ROUTINE EXPENSES the routines routes.
  for (const u of [...e.matchAll(/fetch\(\s*([`'][^`']*[`'])/g)].map((m) => m[1])) assert.match(u, /^[`']\/api\/operations\/projects/, `an existing projects route, not ${u}`);
  for (const u of [...f.matchAll(/fetch\(\s*([`'][^`']*[`'])/g)].map((m) => m[1])) assert.match(u, /^[`']\/api\/operations\/routines/, `an existing routines route, not ${u}`);
  assert.equal(existsSync(at('src/app/api/operations/work')), false, 'no work route');
  assert.equal(existsSync(at('src/app/api/operations/routine-expenses')), false, 'no routine-expenses route');
});

test('T5 EDIT: a row\'s "edit" expands the EXISTING editor under the row — RoutineEditForm for a routine line\'s routine (ROUTINE EXPENSES), TaskEditInputs through useTaskActions for a task (THE WORK)', () => {
  const e = code(SECTION_E); const f = code(SECTION_F);
  // WORK-01d (2026-10-25): the routine row and its editor are SectionF's.
  assert.match(f, /\{editing && \(\n\s*<tr \{\.\.\.dataAttr\(name, 'editing', row\.id\)\}>\n\s*<td colSpan=\{columns\.length \+ 1\}[^>]*>\n\s*<RoutineEditForm routine=\{routine\} end=\{end\} entities=\{entities\} onChanged=\{onChanged\} onClose=\{\(\) => setEditing\(false\)\} \/>/);
  assert.match(e, /const a = useTaskActions\(\{ task, projectId: row\.project\.id, onUpdate: onChanged, onDelete: onChanged, editing, setEditing, showHistory, setShowHistory \}\);/);
  assert.match(e, /\{a\.editing && \(\n\s*<tr \{\.\.\.dataAttr\(name, 'editing', row\.id\)\}>\n\s*<td colSpan=\{columns\.length \+ 1\}[^>]*>\n\s*<TaskEditInputs\n\s*form=\{a\.form\}/);
  for (const h of ['handleSave', 'handleQuickComplete', 'handleDelete', 'handleArchive', 'handleUnarchive', 'handleAcceptPending', 'handleRejectPending', 'handleSchedule']) {
    assert.match(e, new RegExp(`=\\{a\\.${h}\\}`), `the task row fires the hook's ${h}`);
  }
  assert.match(e, /onClick=\{\(\) => a\.handleUncomplete\(\)\}/);
  assert.match(e, /onClick=\{\(\) => a\.handleToggleHistory\(\)\}/);
  assert.doesNotMatch(e, /RoutineEditForm|handleToggleActive/); assert.doesNotMatch(f, /useTaskActions|TaskEditInputs/);
  // The routine row's other controls are RoutineRow's, moved: deactivate / reactivate · delete; an ended routine keeps edit alone.
  assert.match(f, /\{!end\.ended && \(\n\s*<>\n\s*<button type="button" onClick=\{handleToggleActive\}/);
  assert.match(f, /body: JSON\.stringify\(\{ is_active: !routine\.is_active \}\),/);
  assert.match(f, /if \(!confirm\(`Delete routine "\$\{routine\.name\}"\? All completion history will also be deleted\.`\)\) return;/);
  // The editor (ruling 2): lifted, the lines through RoutineStepList above the form, the small print kept.
  const r = code(EDIT_FORM);
  assert.match(r, /export function routineToForm\(r: Routine\): RoutineForm \{/);
  assert.match(r, /<RoutineStepList routine=\{routine\} entities=\{entities\} onUpdate=\{onChanged\} routineCell=\{routineCell\} readOnly=\{end\.ended\} \/>/);
  assert.match(r, /data-routine-editing>/);
  for (const piece of ['data-routine-small-print', 'data-routine-zone', 'data-routine-next-due', 'data-routine-last-done', 'data-routine-planned=', 'data-routine-ignored', 'data-routine-ended']) assert.ok(r.includes(piece), `the editor keeps ${piece}`);
  assert.match(r, /if \(JSON\.stringify\(form\) === JSON\.stringify\(routineToForm\(routine\)\)\) \{\n\s*setError\(null\);\n\s*onClose\(\);\n\s*return;\n\s*\}/, 'FORM-01: a form equal to the one it opened with writes nothing');
  assert.match(comments(EDIT_FORM), /WORK-01 \(Alex, 2026-10-24\) — ruling D and ruling 2/);
  for (const g of GONE) assert.equal(existsSync(at(g)), false, `${g} left`);
  for (const file of [...walk('src'), ...walk('scripts')]) {
    assert.doesNotMatch(code(file), /\/(RoutineRow|RoutineList|TaskTableRow|SectionE_Routines)'/, `${file} imports a file that left`);
  }
});

test('T5 the PATCH body shape is unchanged (ruling 2): the editor sends the form whole with the same six overrides, and the form\'s keys are the same', () => {
  const f = code(EDIT_FORM);
  assert.match(f, /body: JSON\.stringify\(\{\n\s*\.\.\.form,\n\s*start_date: form\.start_date \|\| null,\n\s*end_date: onceForm \? \(form\.start_date \|\| null\) : \(form\.end_date \|\| null\),\n\s*start_time: form\.start_time \|\| null,\n\s*end_time: form\.end_time \|\| null,\n\s*location: undefined,\n\s*latitude: undefined,\n\s*longitude: undefined,\n\s*\}\),/);
  assert.deepEqual(Object.keys(DEFAULT_ROUTINE_FORM).sort(), [
    'byhour', 'byminute', 'cadence_mode', 'custom_rrule', 'days', 'description', 'end_date', 'end_time', 'entity_id', 'fail_threshold_minutes',
    'ideal_time_label', 'is_active', 'latitude', 'lines', 'location', 'longitude', 'monthly_day_of_month', 'monthly_nth', 'monthly_weekday', 'name', 'role',
    'start_date', 'start_time', 'timezone', 'weekly_byday',
  ], 'the wire fields, as before (budget_amount and coa_code ride optional)');
  assert.match(f, /method: 'PATCH',/);
  assert.equal((f.match(/fetch\(/g) ?? []).length, 1, 'one request: the PATCH');
});

// ── T6 · PROJECTS (ruling E, ruling 3; WORK-01d ruling B and D) ──────────────

test('T6 PROJECTS keeps project rows only: no task rows, no "+ task" on the project row; the details list the project\'s tasks again (WORK-01d); the brief, "+ new project", "show archived" and THE LOG\'s read unchanged', () => {
  const rows = code(ROWS);
  assert.doesNotMatch(rows, /TaskTableRow|TaskCreateInputs|data-task-row|data-project-create-task|\+ task|editIds|historyIds|rowSpan/);
  // PROJECTS-02 (Alex, 2026-10-25): the project cell and the Tasks cell are the spec's columns (projects02.test.ts) — the row is the cells, then "details";
  // the count by status is the TASKS column, from the same read: one useProjectTasks per project (the reader), the page's signal as its refreshKey.
  assert.match(rows, /\{columns\.map\(\(c\) => <ProjectCell key=\{c\.key\} column=\{c\} row=\{row\}/);
  assert.match(code(SPEC), /statusCounts\(read\.tasks\.map\(\(task\) => task\.status\)\)/, 'the count by status, the one line the task rows left');
  assert.match(rows, /const t = useProjectTasks\(\{ projectId: project\.id, entity_id: project\.entity_id, showArchived, refreshKey: version \}\);/); // WORK-01b: the page's task-change signal
  assert.match(rows, /<td colSpan=\{columns\.length \+ 1\}/);
  // WORK-01d (Alex, 2026-10-25, ruling B): THE WORK reads only the OPEN projects' tasks, so the details are the home of every other project's tasks —
  // WORK-01's `withoutTaskSection` left the mount (the prop stays on ProjectRow, projects01 pins it).
  assert.match(rows, /defaultExpanded\n\s*onTasksChanged=\{bump\}/);
  assert.doesNotMatch(rows, /withoutTaskSection/);
  assert.match(comments(ROWS), /WORK-01d \(Alex, 2026-10-25, ruling B\): the detail keeps its task list again/);
  const table = code(TABLE);
  assert.match(table, /<DataTable\n\s*name=\{name\}/, 'PROJECTS-02: the shared DataTable; its heads are the spec\'s (projects02.test.ts)');
  assert.doesNotMatch(table, /<th\b|<table\b/);
  const d = code(SECTION_D);
  assert.match(d, /\+ new project/); assert.match(d, /show archived/); assert.match(d, /<ProjectCreateForm/);
  assert.match(comments(SECTION_D), /WORK-01 \(Alex, 2026-10-24\) — ruling E/);
  assert.doesNotMatch(code(SECTION_D) + comments(SECTION_D), /WORK-01d/, 'PROJECTS is unchanged by WORK-01d (ruling D)');
  // THE LOG (BACKLOG-02): the morning card and its read are untouched.
  assert.doesNotMatch(code(MORNING_LOG) + comments(MORNING_LOG), /WORK-01/, 'MorningLog.tsx is not touched (ruling 3)');
  assert.match(code(PROJECTS_ROUTE), /open_tasks: openTasksByProject\.get\(p\.id\) \?\? \[\],/);
  assert.doesNotMatch(code(PROJECTS_ROUTE) + comments(PROJECTS_ROUTE), /WORK-01/, 'the projects GET is used as it is');
});

// ── T7 · THE COCKPIT (ruling F, ruling 1, ruling 4) ───────────────────────────

test('T7 the cockpit\'s Routines and Projects tabs are gone; the keys left both maps; the Projects deck reads claimForTool(\'Tasks\'); old links keep landing', () => {
  const launcher = code(LAUNCHER);
  assert.doesNotMatch(launcher, /key: 'routines'|key: 'projects'|routines: 'routines'|projects: 'projects'|routines: '\/routines'|projects: '\/projects'|=== 'routines'|=== 'projects'|SectionE_Routines|SectionE_Work|SectionF_RoutineExpenses|SectionD_ProjectBacklog|OperationsEntityProvider|pillarId="routines"|pillarId="projects"|routinesModule|projectsModule|Repeat|FolderKanban/);
  assert.match(comments(LAUNCHER), /RETIRED by WORK-01 \(Alex, 2026-10-24\)/);
  assert.equal(COCKPIT_PRIMARY_TOOL.routines, undefined);
  assert.equal(COCKPIT_PRIMARY_TOOL.projects, undefined);
  assert.equal(COCKPIT_PATH.routines, undefined);
  assert.equal(COCKPIT_PATH.projects, undefined);
  assert.deepEqual(Object.keys(COCKPIT_PATH).sort(), Object.keys(COCKPIT_PRIMARY_TOOL).sort(), 'the two maps agree (the registry law)');
  assert.ok(TOOL_REGISTRY.every((t) => t.cockpitKey !== 'routines' && t.cockpitKey !== 'projects'));
  assert.throws(() => claimForCockpit('projects'), OfferLawError);
  assert.throws(() => claimForCockpit('routines'), OfferLawError);
  // Ruling 1: the same claim line by the tool's name — the words the offer pin held.
  assert.equal(claimForTool('Tasks'), 'built and running'); // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13.
  assert.throws(() => claimForTool('nope'), OfferLawError);
  const deck = code(DECK);
  assert.match(deck, /\{label\} — \{claimForTool\('Tasks'\)\}/);
  assert.doesNotMatch(deck, /claimForCockpit/);
  // Ruling 4: the public decks stay reachable; old links land — the redirect pages and the front door's map.
  for (const f of ['src/app/routines/page.tsx', 'src/app/projects/page.tsx']) assert.match(code(f), /redirect\('\/tasks'\)/);
  assert.match(code('src/app/page.tsx'), /routines: '\/routines',\n\s*projects: '\/projects'/, 'the front door still sends ?tab=routines and ?tab=projects to their redirect pages');
  assert.ok(existsSync(at('src/components/home/RoutinesShowcaseSections.tsx')) && existsSync(at(DECK)), 'the decks stay');
  assert.match(code('src/lib/modulePillars.ts'), /id: 'routines'/); assert.match(code('src/lib/modulePillars.ts'), /id: 'projects'/);
});

// ── WORK-01b (Alex, 2026-10-24) · THE FOUR RULINGS ON #1850 ─────────────────

// ROUTINES-03 (Alex, 2026-10-25, ruling B): WORK-01b ruling 2's "<routine> — <line>" join is RETIRED — ROUTINE is the routine's name alone and the line is
// SUB ACCOUNT NAME's cell (the ledger's stopName rule), so each column holds one fact; LINE_NAME_JOIN left work.ts. The pins moved to the two columns.
test('WORK-01b ruling 2, as ROUTINES-03 re-cut it: ROUTINE is the routine alone, the line is SUB ACCOUNT NAME — the filter, the sort and the CSV read each; a stepless routine is its name in both', () => {
  assert.equal(routineNameOf(R_ROWS.find((r) => r.id === 'routine:morning:s2')!), 'Morning');
  assert.equal(routineSubAccountOf(R_ROWS.find((r) => r.id === 'routine:morning:s2')!), 'Stretch');
  assert.equal(routineNameOf(R_ROWS.find((r) => r.id === 'routine:dentist')!), 'Dentist');
  assert.equal(routineSubAccountOf(R_ROWS.find((r) => r.id === 'routine:dentist')!), 'Dentist');
  // The sort by SUB ACCOUNT NAME orders the three Morning rows by their line.
  const bySub = sortRows(R_ROWS, { column: 'sub_account', direction: 'asc' }, R_COLUMNS).filter((r) => r.routine.id === 'morning').map(routineSubAccountOf);
  assert.deepEqual(bySub, ['Coffee', 'Journal', 'Stretch']);
  // The SUB ACCOUNT NAME filter finds the one row; the ROUTINE filter finds the routine's three.
  assert.deepEqual(filterRows(R_ROWS, withFilter(noFilters(R_COLUMNS), 'sub_account', { contains: 'Stretch' }), R_COLUMNS).map((r) => r.id), ['routine:morning:s2']);
  assert.deepEqual(filterRows(R_ROWS, withFilter(noFilters(R_COLUMNS), 'routine', { contains: 'Morning' }), R_COLUMNS).map((r) => r.id), ['routine:morning:s1', 'routine:morning:s2', 'routine:morning:s3']);
  // The CSV carries each in its column.
  assert.match(tableCsv(R_COLUMNS, R_ROWS.filter((r) => r.id === 'routine:morning:s2')), /\n,,repeated,Personal,,,Stretch,,Morning,/);
  assert.match(code(WORK_LIB), /export const routineNameOf = \(row: RoutineRow\): string => row\.routine\.name;/);
  assert.match(code(WORK_LIB), /export const routineSubAccountOf = \(row: RoutineRow\): string => stopName\(\{ line: row\.line === null \? null : row\.line\.activity, label: row\.routine\.name \}\);/);
  assert.doesNotMatch(code(WORK_LIB), /LINE_NAME_JOIN/, 'the join left');
});

test('WORK-01b ruling 3: the page holds one task-change signal — THE WORK bumps it on a task change and re-reads on every bump; PROJECTS\' counts read the same version; ROUTINE EXPENSES does not touch it', () => {
  const CHANGES = `${OPS}/WorkChanges.tsx`;
  const c = code(CHANGES);
  assert.match(c, /const WorkChangesContext = createContext<WorkChanges \| null>\(null\);/);
  assert.match(c, /const \[version, setVersion\] = useState\(0\);\n\s*const bump = useCallback\(\(\) => setVersion\(\(n\) => n \+ 1\), \[\]\);/, 'React state only');
  assert.match(c, /if \(value === null\) throw new Error\(NO_WORK_CHANGES_PROVIDER_WORDS\);/, 'outside the provider it throws — never a silent no-op');
  assert.doesNotMatch(c, /localStorage|sessionStorage|document\.cookie|dispatchEvent|addEventListener/);
  // The page wraps the sections in it, outside the entity provider — the Tasks container's mounts are the law's (WORK-01d: three; EXPENSES-01, 2026-10-25: two — ROUTINE EXPENSES is /expenses').
  const page = code(PAGE);
  assert.match(page, /<WorkChangesProvider>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>\n\s*<\/WorkChangesProvider>/);
  // THE WORK: re-reads on the version; task rows and the new-task form bump.
  const e = code(SECTION_E);
  assert.match(e, /const \{ version: workVersion, bump: taskChanged \} = useWorkChanges\(\);/);
  assert.match(e, /useEffect\(\(\) => \{ readWork\(\); \}, \[workVersion\]\);/);
  assert.match(e, /<TaskWorkRow key=\{row\.id\}[^\n]*onChanged=\{taskChanged\} \/>/);
  assert.match(e, /<NewTaskForm projects=\{projects\} charts=\{charts\} onCreated=\{\(\) => \{ setCreating\(false\); taskChanged\(\); \}\}/);
  assert.equal((e.match(/useWorkChanges\(\)/g) ?? []).length, 1);
  // ROUTINE EXPENSES (WORK-01d): a routine change re-reads its own table alone — PROJECTS counts no routines, so it never bumps.
  const f = code(SECTION_F);
  assert.match(f, /<RoutineWorkRow key=\{row\.id\}[^\n]*onChanged=\{refresh\} \/>/);
  assert.match(f, /const refresh = \(\) => \{ readRoutines\(\); \};/);
  assert.doesNotMatch(f, /useWorkChanges|WorkChanges/);
  // PROJECTS: each project's count reads the version and the detail's task writes bump it.
  const rows = code(ROWS);
  // PROJECTS-02 (Alex, 2026-10-25): the read moved to the reader (one per project loaded) — it reads the version; the row reads the bump for the detail's
  // task writes and, ruling D, for a project update (projectChanged — projects02.test.ts).
  assert.match(rows, /const \{ version \} = useWorkChanges\(\);\n\s*const t = useProjectTasks\(\{ projectId: project\.id, entity_id: project\.entity_id, showArchived, refreshKey: version \}\);/);
  assert.match(rows, /const \{ bump \} = useWorkChanges\(\);/);
  assert.match(rows, /onTasksChanged=\{bump\}/);
  assert.doesNotMatch(rows, /tasksVersion|setTasksVersion/, 'no local tasks version beside the page\'s');
  // Only THE WORK and PROJECTS read it.
  const under = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? under(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));
  const readers = [...under('src/app'), ...under('src/components')].filter((f) => /= useWorkChanges\(\);/.test(code(f)));
  assert.deepEqual(readers.sort(), [ROWS, SECTION_E].sort());
});
