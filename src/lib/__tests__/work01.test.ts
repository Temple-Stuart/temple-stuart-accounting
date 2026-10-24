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
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  ALL_DAY_WORDS, CHART_MISSING_WORDS, WORK_COLUMNS, WORK_DEFAULT_DROPPED, WORK_HEAD_WORDS, OPEN_PROJECT_STATUSES, PROJECT_REQUIRED_WORDS,
  accountWordsOf, amountCentsOf, kindOf, openProjects, statusChipWords, statusDroppedOf, statusWordsOf, timeWordsOf, workCountWords,
  workCsvFileName, workDefaultFilters, workRowsOf, workTable, withoutStatusFilter, type WorkBook, type WorkCharts, type WorkProject,
  nameOf,
} from '../operations/work';
import { daysWords } from '../operations/rruleHelpers';
import { filterRows, noFilters, withFilter } from '../table/filters';
import { sortRows } from '../table/sort';
import { tableCsv } from '../table/csv';
import { BLANK } from '../table/words';
import { COCKPIT_PATH, COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY } from '../toolRegistry';
import { OfferLawError, claimForCockpit, claimForTool } from '../offer';
import { DEFAULT_ROUTINE_FORM, type Routine, type RoutineStep } from '@/components/workbench/operations/routines/types';
import { PROJECTS_TABLE_COLUMNS } from '@/components/workbench/operations/projects/projectsTableText';
import type { Project, Task } from '@/components/workbench/operations/projects/types';

const OPS = 'src/components/workbench/operations';
const PAGE = 'src/app/tasks/page.tsx';
const SECTION_E = `${OPS}/SectionE_Work.tsx`;
const SECTION_D = `${OPS}/SectionD_ProjectBacklog.tsx`;
const ROWS = `${OPS}/projects/ProjectTableRows.tsx`;
const TABLE = `${OPS}/projects/ProjectsTable.tsx`;
const EDIT_FORM = `${OPS}/routines/RoutineEditForm.tsx`;
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
/** A 3-line routine: Coffee $3 / 6150, Stretch (no amount), Journal $0.50 / 6150 — each row's NAME is "Morning — <line>" (WORK-01b, ruling 2). */
const MORNING = routine({ id: 'morning', name: 'Morning', steps: [
  step({ id: 's3', activity: 'Journal', step_order: 3, budget_amount: '0.50', coa_code: '6150' }),
  step({ id: 's1', activity: 'Coffee', step_order: 1, budget_amount: '3.00', coa_code: '6150' }),
  step({ id: 's2', activity: 'Stretch', step_order: 2 }),
] });
/** A Once routine (ONEOFF-01: FREQ=DAILY;COUNT=1 on its day) — KIND once. */
const DENTIST = routine({ id: 'dentist', name: 'Dentist', schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', start_date: '2026-11-03', end_date: '2026-11-03', start_time: '1970-01-01T14:00:00.000Z', end_time: '1970-01-01T15:00:00.000Z', budget_amount: '40', coa_code: '6150' });
/** An all-day charge (ALLDAY-01): no clock — TIME "all day". */
const APPLE = routine({ id: 'apple', name: 'Apple storage', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0;BYSECOND=0', start_time: null, end_time: null, budget_amount: '2.99', coa_code: '6200' });
/** Ended on 2026-10-20 (ROUTINE-02a) — STATUS ended, whatever is_active says; a Business account. */
const OLD = routine({ id: 'old', name: 'Old bill', entity_id: 'b', end_date: '2026-10-20', is_active: false, budget_amount: '12', coa_code: '6080' });
/** Deactivated, not ended — STATUS inactive; no amount, no account; a code the chart does not list would say so. */
const PAUSED = routine({ id: 'paused', name: 'Paused', is_active: false });
const project = (o: Partial<Project> & { id: string; title: string }): Project => ({ entity_id: 'p', status: 'in_progress', ...o } as Project);
const task = (o: Partial<Task> & { id: string; title: string; project_id: string }): Task => ({ entity_id: 'p', status: 'open', estimated_cost_usd: null, deadline: null, coa_code: null, ...o } as Task);
const HOME = project({ id: 'home', title: 'HOME-01' });
const SHIP = project({ id: 'ship', title: 'Ship it', status: 'archived' });
const T_ROUTE = task({ id: 't1', title: 'write the route', project_id: 'home', estimated_cost_usd: '12.50', coa_code: '6150', deadline: '2026-10-30T00:00:00.000Z' });
const T_GONE = task({ id: 't2', title: 'old chore', project_id: 'ship', status: 'archived' });
const T_DONE = task({ id: 't3', title: 'merged', project_id: 'home', status: 'completed' });
const PROJECTS: WorkProject[] = [{ project: HOME, tasks: [T_ROUTE, T_DONE] }, { project: SHIP, tasks: [T_GONE] }];
const ROWS_IN = workRowsOf([MORNING, DENTIST, APPLE, OLD, PAUSED], PROJECTS, NOW);
const COLUMNS = workTable(BOOKS, CHARTS);
const cell = (id: string, key: typeof WORK_COLUMNS[number]) => COLUMNS.find((c) => c.key === key)!.words(ROWS_IN.find((r) => r.id === id)!);

// ── T1 · THE ROWS ─────────────────────────────────────────────────────────────

test('T1 one row per routine line, one per stepless routine, one per task — in the table\'s own order', () => {
  // Clock order then name (FORM-01's byClockThenName): the all-day charge's derived clock is 00:00, then the 07:00 three by name, then 14:00; the tasks after, project by project.
  assert.deepEqual(ROWS_IN.map((r) => r.id), [
    'routine:apple', 'routine:morning:s1', 'routine:morning:s2', 'routine:morning:s3', 'routine:old', 'routine:paused', 'routine:dentist', 'task:t1', 'task:t3', 'task:t2',
  ]);
  // The 3-line routine is 3 rows — NAME "<routine> — <line>" (WORK-01b, Alex, 2026-10-24, ruling 2) — each line's own amount and account; the stepless routine its bare name.
  assert.deepEqual(['s1', 's2', 's3'].map((s) => cell(`routine:morning:${s}`, 'name')), ['Morning — Coffee', 'Morning — Stretch', 'Morning — Journal']);
  assert.equal(cell('routine:dentist', 'name'), 'Dentist');
  assert.equal(cell('task:t1', 'name'), 'write the route');
  assert.deepEqual(['s1', 's2', 's3'].map((s) => cell(`routine:morning:${s}`, 'amount')), ['$3.00', BLANK, '$0.50']);
  assert.deepEqual(['s1', 's2', 's3'].map((s) => cell(`routine:morning:${s}`, 'account')), ['P-6150 Food & drink', BLANK, 'P-6150 Food & drink']);
  assert.equal(cell('routine:dentist', 'amount'), '$40.00');
  assert.equal(cell('routine:old', 'account'), 'B-6080 Office Expense', 'the book\'s letter and the chart\'s name');
  assert.equal(cell('routine:old', 'book'), 'Business');
});

test('T1 KIND: a task is once; a routine is once when its rule is Once, else repeated', () => {
  assert.deepEqual(ROWS_IN.map((r) => [r.id, kindOf(r)]), [
    ['routine:apple', 'repeated'], ['routine:morning:s1', 'repeated'], ['routine:morning:s2', 'repeated'], ['routine:morning:s3', 'repeated'],
    ['routine:old', 'repeated'], ['routine:paused', 'repeated'], ['routine:dentist', 'once'], ['task:t1', 'once'], ['task:t3', 'once'], ['task:t2', 'once'],
  ]);
  assert.equal(cell('routine:dentist', 'kind'), 'once');
});

test('T1 the words by column: a task has its project and deadline and no cadence, days or time; a routine the reverse; "all day" for a null clock; nulls are "—"', () => {
  assert.equal(cell('task:t1', 'project'), 'HOME-01');
  assert.equal(cell('routine:morning:s1', 'project'), BLANK);
  assert.deepEqual([cell('task:t1', 'cadence'), cell('task:t1', 'days'), cell('task:t1', 'time')], [BLANK, BLANK, BLANK]);
  assert.deepEqual([cell('routine:morning:s1', 'cadence'), cell('routine:morning:s1', 'days'), cell('routine:morning:s1', 'time')], ['daily', 'Mon–Sun', '07:00 – 07:30']);
  assert.equal(cell('routine:dentist', 'cadence'), 'once');
  assert.equal(cell('routine:dentist', 'days'), daysWords(DENTIST.schedule_rrule, DENTIST.start_date), 'the once date, as FORM-01 prints it');
  assert.equal(cell('routine:apple', 'time'), ALL_DAY_WORDS);
  assert.equal(ALL_DAY_WORDS, 'all day');
  assert.equal(timeWordsOf(ROWS_IN[0]), 'all day');
  assert.equal(cell('routine:dentist', 'deadline'), BLANK);
  assert.equal(cell('task:t1', 'deadline'), new Date('2026-10-30').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  assert.equal(COLUMNS.find((c) => c.key === 'deadline')!.csv(ROWS_IN.find((r) => r.id === 'task:t1')!), '2026-10-30', 'the CSV and the sort read the ISO day');
  assert.equal(cell('task:t3', 'deadline'), BLANK);
  assert.equal(cell('task:t1', 'amount'), '$12.50');
  assert.equal(cell('task:t3', 'amount'), BLANK);
  assert.equal(cell('task:t1', 'account'), 'P-6150 Food & drink');
  assert.equal(cell('routine:paused', 'amount'), BLANK);
  assert.equal(cell('routine:paused', 'account'), BLANK);
  assert.equal(amountCentsOf(ROWS_IN.find((r) => r.id === 'routine:apple')!), 299);
  // A code the book's chart does not list is said, never silently bare; a book with no chart read is said too.
  const stray = workRowsOf([routine({ id: 'stray', name: 'Stray', budget_amount: '5', coa_code: '6999' })], [], NOW)[0];
  assert.equal(accountWordsOf(BOOKS, CHARTS, stray), `P-6999 — ${CHART_MISSING_WORDS}`);
  assert.equal(accountWordsOf(BOOKS, {}, stray), 'P-6999 — chart not read');
  assert.equal(accountWordsOf([], CHARTS, stray), 'book not loaded', 'ROUTINES-01\'s helper states the book');
});

test('T1 STATUS: a routine is ended first (ROUTINE-02a, judged now in its zone), then inactive, else active; a task wears its status words', () => {
  assert.deepEqual(['routine:apple', 'routine:old', 'routine:paused', 'routine:dentist', 'task:t1', 'task:t3', 'task:t2'].map((id) => cell(id, 'status')), ['active', 'ended', 'inactive', 'active', 'new', 'done', 'archived']);
  assert.equal(statusWordsOf(ROWS_IN.find((r) => r.id === 'routine:old')!), 'ended', 'ended wins over inactive');
});

// ── T2 · THE SPEC ─────────────────────────────────────────────────────────────

test('T2 the columns, their heads and their kinds — AMOUNT money; KIND, BOOK, CADENCE, DAYS, TIME, DEADLINE, STATUS value; NAME, PROJECT, ACCOUNT text', () => {
  assert.deepEqual([...WORK_COLUMNS], ['kind', 'name', 'project', 'book', 'cadence', 'days', 'time', 'deadline', 'amount', 'account', 'status']);
  assert.deepEqual(COLUMNS.map((c) => c.key), [...WORK_COLUMNS]);
  assert.deepEqual(COLUMNS.map((c) => c.label), ['KIND', 'NAME', 'PROJECT', 'BOOK', 'CADENCE', 'DAYS', 'TIME', 'DEADLINE', 'AMOUNT', 'ACCOUNT', 'STATUS']);
  assert.deepEqual(COLUMNS.map((c) => c.label), WORK_COLUMNS.map((k) => WORK_HEAD_WORDS[k]));
  assert.deepEqual(Object.fromEntries(COLUMNS.map((c) => [c.key, c.kind])), {
    kind: 'value', name: 'text', project: 'text', book: 'value', cadence: 'value', days: 'value', time: 'value', deadline: 'value', amount: 'money', account: 'text', status: 'value',
  });
  // A text column's filter reads the full text; a blank is null there, "—" on screen, '' in the CSV.
  const account = COLUMNS.find((c) => c.key === 'account')!;
  assert.equal(account.kind === 'text' && account.text(ROWS_IN.find((r) => r.id === 'routine:paused')!), null);
  assert.equal(account.csv(ROWS_IN.find((r) => r.id === 'routine:paused')!), '');
});

// ── T3 · THE DEFAULT (ruling B) ──────────────────────────────────────────────

test('T3 the default is a VISIBLE STATUS filter — "STATUS: not ended, not inactive, not archived" (WORK-01b, ruling 1) — already applied, and its clear shows everything', () => {
  assert.deepEqual([...WORK_DEFAULT_DROPPED], ['ended', 'inactive', 'archived']);
  const filters = workDefaultFilters(COLUMNS);
  assert.deepEqual(statusDroppedOf(filters), ['ended', 'inactive', 'archived']);
  assert.equal(statusChipWords(statusDroppedOf(filters)), 'STATUS: not ended, not inactive, not archived');
  // Every other filter is off — the default narrows by STATUS alone.
  for (const c of COLUMNS) if (c.key !== 'status') assert.deepEqual(filters[c.key], noFilters(COLUMNS)[c.key]);
  const shown = filterRows(ROWS_IN, filters, COLUMNS).map((r) => r.id);
  assert.deepEqual(shown, ['routine:apple', 'routine:morning:s1', 'routine:morning:s2', 'routine:morning:s3', 'routine:dentist', 'task:t1', 'task:t3'], 'the ended and the inactive routines and the archived task are hidden; the done task shows');
  // Cleared: everything.
  assert.deepEqual(filterRows(ROWS_IN, withoutStatusFilter(filters), COLUMNS).map((r) => r.id), ROWS_IN.map((r) => r.id));
  assert.deepEqual(statusDroppedOf(withoutStatusFilter(filters)), []);
  // The reads bring everything — the section fetches every routine and every task, archived included; the filter alone narrows.
  const e = code(SECTION_E);
  assert.match(e, /readJson\('\/api\/operations\/routines', 'routines'\)/, 'every routine, active or not (no ?is_active=true)');
  assert.match(e, /readJson\('\/api\/operations\/projects\?include_archived=true', 'projects'\)/);
  assert.match(e, /readJson\(`\/api\/operations\/projects\/\$\{p\.id\}\/tasks\?include_archived=true`/);
  assert.match(e, /readJson\(`\/api\/chart-of-accounts\?entity_id=\$\{encodeURIComponent\(e\.id\)\}`/, 'each book\'s chart, for ACCOUNT\'s names');
  assert.match(e, /const \[filters, setFilters\] = useState<TableFilters>\(\(\) => workDefaultFilters\(workTable\(\[\], \{\}\)\)\);/, 'applied at first');
  assert.match(e, /\{filterOn\(filters, 'status', 'value'\) && \(\n\s*<button type="button" className=\{chipOn\} onClick=\{\(\) => setFilters\(withoutStatusFilter\(filters\)\)\} \{\.\.\.dataAttr\(name, 'status-chip'\)\}>\n\s*\{statusChipWords\(statusDroppedOf\(filters\)\)\} \{CLEAR_CHIP_MARK\}/, 'the chip, and its click clears it');
  assert.doesNotMatch(e, /show inactive|show ended|showInactive|showEnded/, 'the toggles are the STATUS checklist now');
  assert.doesNotMatch(e, /localStorage|sessionStorage|document\.cookie/);
});

// ── T4 · SORT AND CSV ────────────────────────────────────────────────────────

test('T4 sort by AMOUNT descending puts the dearest first and the blanks last; the CSV is the spec\'s, money bare, a blank an empty field', () => {
  const desc = sortRows(ROWS_IN, { column: 'amount', direction: 'desc' }, COLUMNS).map((r) => r.id);
  assert.deepEqual(desc.slice(0, 5), ['routine:dentist', 'task:t1', 'routine:old', 'routine:morning:s1', 'routine:apple']);
  assert.deepEqual(desc.slice(-4), ['routine:morning:s2', 'routine:paused', 'task:t3', 'task:t2'], 'blanks last, in the order given');
  const csv = tableCsv(COLUMNS, ROWS_IN.filter((r) => r.id === 'routine:morning:s1' || r.id === 'task:t1'));
  assert.equal(csv, 'KIND,NAME,PROJECT,BOOK,CADENCE,DAYS,TIME,DEADLINE,AMOUNT,ACCOUNT,STATUS\r\n'
    + 'repeated,Morning — Coffee,,Personal,daily,Mon–Sun,07:00 – 07:30,,3.00,P-6150 Food & drink,active\r\n'
    + 'once,write the route,HOME-01,Personal,,,,2026-10-30,12.50,P-6150 Food & drink,new\r\n');
  assert.equal(workCsvFileName('2026-10-24'), 'work_2026-10-24.csv');
  assert.equal(workCountWords(8, 10), '8 of 10 rows');
});

// ── T5 · THE PAGE, THE LAW, THE SECTION ──────────────────────────────────────

test('T5 /tasks mounts THE WORK then PROJECTS, the projects list in its Suspense boundary; the two-lists law says so', () => {
  const page = code(PAGE);
  assert.match(page, /<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<\/div>/);
  assert.doesNotMatch(page, /SectionE_Routines/);
  assert.match(comments(PAGE), /WORK-01 \(Alex, 2026-10-24\) — TASKS IS ONE TABLE/);
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>'\];/);
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionE_Work SectionD_ProjectBacklog'/);
  assert.match(comments(LAW), /WORK-01 — the ruling \(Alex, 2026-10-24\): Tasks is ONE TABLE/);
  for (const re of [/\/ADD_ROUTINE_WORDS\//, /\/ADD_TASK_WORDS\//, /\/statusChipWords\\\(\//, /\/<DataTable\//]) assert.match(law, re, `the law holds THE WORK's control ${re}`);
  assert.doesNotMatch(law, /routines\/RoutineList\.tsx|routines\/RoutineRow\.tsx|SectionE_Routines/, 'no law names a file that left');
  // The section: the shared table over the pure spec, named 'work'.
  const e = code(SECTION_E);
  assert.match(e, /import DataTable, \{ cellClass as cell, chipClass as chip, moneyClass \} from '@\/components\/table\/DataTable';/);
  assert.match(e, /<DataTable\n\s*name=\{name\}\n\s*columns=\{columns\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{loaded\}/);
  assert.match(e, /const shown = sortRows\(filterRows\(rows, filters, columns\), sort, columns\);/);
  assert.match(e, /workRowsOf\(read\.routines, read\.projects, new Date\(\)\)/);
  assert.doesNotMatch(e, /<table\b|<thead\b|ROUTINE_TABLE_COLUMNS|data-routines-book|data-all-day-band|booksInOrder/, 'no table of its own, no per-book tables, no ALL DAY band');
  assert.doesNotMatch(e, /StageStrip|ProofStrip|PIPE_PHASES|TodaysStrip/);
});

test('T5 "+ routine" is the existing form; "+ task" is the task form under a REQUIRED project select, refused by name without one, posting to the existing route', () => {
  const e = code(SECTION_E);
  assert.match(e, /<RoutineCreateForm\n\s*entities=\{entities\}\n\s*defaultEntityId=\{createEntityId\}/);
  assert.match(e, /<NewTaskForm projects=\{openProjects\(allProjects\)\} charts=\{charts\}/);
  const form = e.slice(e.indexOf('function NewTaskForm('));
  const refusal = form.indexOf('if (project === null) {\n      setError(PROJECT_REQUIRED_WORDS);\n      return;\n    }');
  const post = form.indexOf('fetch(`/api/operations/projects/${project.id}/tasks`, {\n        method: \'POST\'');
  assert.ok(refusal > -1 && post > refusal, 'refused before any request');
  assert.match(form, /<select value=\{projectId\} onChange=[\s\S]*?required \{\.\.\.dataAttr\(name, 'task-project'\)\}>/);
  assert.match(form, /body: JSON\.stringify\(form\),/, 'the same body useProjectTasks posts');
  assert.match(form, /<TaskCreateInputs\n\s*createForm=\{form\}/);
  assert.equal(PROJECT_REQUIRED_WORDS, 'pick the project — a task belongs to one');
  assert.deepEqual([...OPEN_PROJECT_STATUSES], ['not_started', 'in_progress', 'blocked', 'backlog', 'scoped', 'scheduled']);
  assert.deepEqual(openProjects([HOME, SHIP]).map((p) => p.id), ['home']);
  // No new write route: the only writers the section calls are the routes that exist.
  const urls = [...e.matchAll(/fetch\(\s*([`'][^`']*[`'])/g)].map((m) => m[1]);
  for (const u of urls) assert.match(u, /^[`']\/api\/(operations\/(routines|projects)|chart-of-accounts)/, `an existing route, not ${u}`);
  assert.equal(existsSync(at('src/app/api/operations/work')), false, 'no work route');
});

test('T5 EDIT: a row\'s "edit" expands the EXISTING editor under the row — RoutineEditForm for a routine line\'s routine, TaskEditInputs through useTaskActions for a task', () => {
  const e = code(SECTION_E);
  assert.match(e, /\{editing && \(\n\s*<tr \{\.\.\.dataAttr\(name, 'editing', row\.id\)\}>\n\s*<td colSpan=\{columns\.length \+ 1\}[^>]*>\n\s*<RoutineEditForm routine=\{routine\} end=\{end\} entities=\{entities\} onChanged=\{onChanged\} onClose=\{\(\) => setEditing\(false\)\} \/>/);
  assert.match(e, /const a = useTaskActions\(\{ task, projectId: row\.project\.id, onUpdate: onChanged, onDelete: onChanged, editing, setEditing, showHistory, setShowHistory \}\);/);
  assert.match(e, /\{a\.editing && \(\n\s*<tr \{\.\.\.dataAttr\(name, 'editing', row\.id\)\}>\n\s*<td colSpan=\{columns\.length \+ 1\}[^>]*>\n\s*<TaskEditInputs\n\s*form=\{a\.form\}/);
  for (const h of ['handleSave', 'handleQuickComplete', 'handleDelete', 'handleArchive', 'handleUnarchive', 'handleAcceptPending', 'handleRejectPending', 'handleSchedule']) {
    assert.match(e, new RegExp(`=\\{a\\.${h}\\}`), `the task row fires the hook's ${h}`);
  }
  assert.match(e, /onClick=\{\(\) => a\.handleUncomplete\(\)\}/);
  assert.match(e, /onClick=\{\(\) => a\.handleToggleHistory\(\)\}/);
  // The routine row's other controls are RoutineRow's, moved: deactivate / reactivate · delete; an ended routine keeps edit alone.
  assert.match(e, /\{!end\.ended && \(\n\s*<>\n\s*<button type="button" onClick=\{handleToggleActive\}/);
  assert.match(e, /body: JSON\.stringify\(\{ is_active: !routine\.is_active \}\),/);
  assert.match(e, /if \(!confirm\(`Delete routine "\$\{routine\.name\}"\? All completion history will also be deleted\.`\)\) return;/);
  // The editor (ruling 2): lifted, the lines through RoutineStepList above the form, the small print kept.
  const f = code(EDIT_FORM);
  assert.match(f, /export function routineToForm\(r: Routine\): RoutineForm \{/);
  assert.match(f, /<RoutineStepList routine=\{routine\} entities=\{entities\} onUpdate=\{onChanged\} routineCell=\{routineCell\} readOnly=\{end\.ended\} \/>/);
  assert.match(f, /data-routine-editing>/);
  for (const piece of ['data-routine-small-print', 'data-routine-zone', 'data-routine-next-due', 'data-routine-last-done', 'data-routine-planned=', 'data-routine-ignored', 'data-routine-ended']) assert.ok(f.includes(piece), `the editor keeps ${piece}`);
  assert.match(f, /if \(JSON\.stringify\(form\) === JSON\.stringify\(routineToForm\(routine\)\)\) \{\n\s*setError\(null\);\n\s*onClose\(\);\n\s*return;\n\s*\}/, 'FORM-01: a form equal to the one it opened with writes nothing');
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

// ── T6 · PROJECTS (ruling E, ruling 3) ───────────────────────────────────────

test('T6 PROJECTS keeps project rows only: no task rows, no "+ task" on the project row; the brief, "+ new project", "show archived" and THE LOG\'s read unchanged', () => {
  const rows = code(ROWS);
  assert.doesNotMatch(rows, /TaskTableRow|TaskCreateInputs|data-task-row|data-project-create-task|\+ task|editIds|historyIds|rowSpan/);
  assert.match(rows, /<tr data-project-row>\n\s*\{projectCell\}\n\s*\{[^}]*\}\n\s*<td[^>]*data-project-tasks>/);
  assert.match(rows, /\{statusCounts\(t\.tasks\.map\(\(task\) => task\.status\)\)\}/, 'the count by status, the one line the task rows left');
  assert.match(rows, /const t = useProjectTasks\(\{ projectId: project\.id, entity_id: project\.entity_id, showArchived, refreshKey: version \}\);/); // WORK-01b: the page's task-change signal
  assert.match(rows, /<tr data-project-details>\n\s*<td colSpan=\{PROJECTS_TABLE_COLUMNS\}/);
  assert.match(rows, /defaultExpanded\n\s*withoutTaskSection/);
  assert.equal(PROJECTS_TABLE_COLUMNS, 2);
  const table = code(TABLE);
  assert.deepEqual([...table.matchAll(/<th\b[^>]*>([^<]*)</g)].map((m) => m[1]), ['Project', 'Tasks']);
  const d = code(SECTION_D);
  assert.match(d, /\+ new project/); assert.match(d, /show archived/); assert.match(d, /<ProjectCreateForm/);
  assert.match(comments(SECTION_D), /WORK-01 \(Alex, 2026-10-24\) — ruling E/);
  // THE LOG (BACKLOG-02): the morning card and its read are untouched.
  assert.doesNotMatch(code(MORNING_LOG) + comments(MORNING_LOG), /WORK-01/, 'MorningLog.tsx is not touched (ruling 3)');
  assert.match(code(PROJECTS_ROUTE), /open_tasks: openTasksByProject\.get\(p\.id\) \?\? \[\],/);
  assert.doesNotMatch(code(PROJECTS_ROUTE) + comments(PROJECTS_ROUTE), /WORK-01/, 'the projects GET is used as it is');
});

// ── T7 · THE COCKPIT (ruling F, ruling 1, ruling 4) ───────────────────────────

test('T7 the cockpit\'s Routines and Projects tabs are gone; the keys left both maps; the Projects deck reads claimForTool(\'Tasks\'); old links keep landing', () => {
  const launcher = code(LAUNCHER);
  assert.doesNotMatch(launcher, /key: 'routines'|key: 'projects'|routines: 'routines'|projects: 'projects'|routines: '\/routines'|projects: '\/projects'|=== 'routines'|=== 'projects'|SectionE_Routines|SectionE_Work|SectionD_ProjectBacklog|OperationsEntityProvider|pillarId="routines"|pillarId="projects"|routinesModule|projectsModule|Repeat|FolderKanban/);
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
  assert.equal(claimForTool('Tasks'), "partial — the work, planned: projects with costed tasks and routines with costed lines, both landing on the calendar and linkable to a posting — a task's actual cost is still typed by hand; nothing posts it from the books");
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

test('WORK-01b ruling 2: a line row\'s NAME is "<routine> — <line>", one string — the filter, the sort and the CSV read it whole; a stepless routine keeps its bare name', () => {
  assert.equal(nameOf(ROWS_IN.find((r) => r.id === 'routine:morning:s2')!), 'Morning — Stretch');
  assert.equal(nameOf(ROWS_IN.find((r) => r.id === 'routine:dentist')!), 'Dentist');
  assert.equal(nameOf(ROWS_IN.find((r) => r.id === 'task:t2')!), 'old chore');
  // The sort by NAME orders the full string: the three Morning rows by their line.
  const byName = sortRows(ROWS_IN, { column: 'name', direction: 'asc' }, COLUMNS).map((r) => nameOf(r));
  assert.deepEqual(byName.filter((n) => n.startsWith('Morning')), ['Morning — Coffee', 'Morning — Journal', 'Morning — Stretch']);
  // The NAME filter matches the line's half too: "Stretch" finds the one row.
  const stretch = filterRows(ROWS_IN, withFilter(noFilters(COLUMNS), 'name', { contains: 'Stretch' }), COLUMNS).map((r) => r.id);
  assert.deepEqual(stretch, ['routine:morning:s2']);
  // The CSV carries the same string.
  assert.match(tableCsv(COLUMNS, ROWS_IN.filter((r) => r.id === 'routine:morning:s2')), /\nrepeated,Morning — Stretch,,Personal,/);
  assert.match(code('src/lib/operations/work.ts'), /row\.line === null \? row\.routine\.name : `\$\{row\.routine\.name\}\$\{LINE_NAME_JOIN\}\$\{row\.line\.activity\}`/);
});

test('WORK-01b ruling 3: the page holds one task-change signal — THE WORK bumps it on a task change and re-reads on every bump; PROJECTS\' counts read the same version; routines do not bump it', () => {
  const CHANGES = `${OPS}/WorkChanges.tsx`;
  const c = code(CHANGES);
  assert.match(c, /const WorkChangesContext = createContext<WorkChanges \| null>\(null\);/);
  assert.match(c, /const \[version, setVersion\] = useState\(0\);\n\s*const bump = useCallback\(\(\) => setVersion\(\(n\) => n \+ 1\), \[\]\);/, 'React state only');
  assert.match(c, /if \(value === null\) throw new Error\(NO_WORK_CHANGES_PROVIDER_WORDS\);/, 'outside the provider it throws — never a silent no-op');
  assert.doesNotMatch(c, /localStorage|sessionStorage|document\.cookie|dispatchEvent|addEventListener/);
  // The page wraps both sections in it, outside the entity provider — the Tasks container's mounts are unchanged (the two-lists law).
  const page = code(PAGE);
  assert.match(page, /<WorkChangesProvider>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>\n\s*<\/WorkChangesProvider>/);
  // THE WORK: re-reads on the version; task rows and the new-task form bump; routine rows re-read here alone.
  const e = code(SECTION_E);
  assert.match(e, /const \{ version: workVersion, bump: taskChanged \} = useWorkChanges\(\);/);
  assert.match(e, /useEffect\(\(\) => \{ readWork\(\); \}, \[workVersion\]\);/);
  assert.match(e, /<TaskWorkRow key=\{row\.id\}[^\n]*onChanged=\{taskChanged\} \/>/);
  assert.match(e, /<NewTaskForm projects=\{openProjects\(allProjects\)\} charts=\{charts\} onCreated=\{\(\) => \{ setCreating\(null\); taskChanged\(\); \}\}/);
  assert.match(e, /<RoutineWorkRow key=\{row\.id\}[^\n]*onChanged=\{refresh\} \/>/, 'a routine change re-reads THE WORK alone — PROJECTS counts no routines');
  assert.equal((e.match(/useWorkChanges\(\)/g) ?? []).length, 1);
  // PROJECTS: each project's count reads the version and the detail's task writes bump it.
  const rows = code(ROWS);
  assert.match(rows, /const \{ version, bump \} = useWorkChanges\(\);\n\s*const t = useProjectTasks\(\{ projectId: project\.id, entity_id: project\.entity_id, showArchived, refreshKey: version \}\);/);
  assert.match(rows, /onTasksChanged=\{bump\}/);
  assert.doesNotMatch(rows, /tasksVersion|setTasksVersion/, 'no local tasks version beside the page\'s');
  // Only /tasks' two sections read it.
  const under = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? under(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));
  const readers = [...under('src/app'), ...under('src/components')].filter((f) => /= useWorkChanges\(\);/.test(code(f)));
  assert.deepEqual(readers.sort(), [ROWS, SECTION_E].sort());
});
