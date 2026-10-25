/**
 * WORK-01d (Alex, 2026-10-25) — TASKS IS THREE TABLES.
 *
 * /tasks mounts THE WORK · PROJECTS · ROUTINE EXPENSES — three DataTables; the
 * merged KIND table leaves; routines and tasks are never one table (ruling A).
 * THE WORK is one row per TASK of an OPEN project — the one set, morningLog.ts
 * OPEN_PROJECT_STATUSES — TASK · PROJECT · BOOK · STATUS · DEADLINE · ESTIMATE ·
 * ACCOUNT · DONE, "STATUS: open only" at first (ruling B). ROUTINE EXPENSES is
 * one row per routine LINE — ROUTINE · BOOK · CADENCE · DAYS · TIME · AMOUNT ·
 * ACCOUNT · STATUS, "STATUS: active only" at first (ruling C). PROJECTS and THE
 * LOG are unchanged (ruling D). The pure rules are driven over fixtures; the
 * screens and the law are pinned to their source with comments stripped
 * (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { code, comments, functionBody } from '../sourceText';
import {
  ALL_DAY_WORDS, ROUTINE_COLUMNS, ROUTINE_DEFAULT, ROUTINE_HEAD_WORDS, ROUTINE_TABLE_NAME, TASK_COLUMNS, TASK_DEFAULT, TASK_HEAD_WORDS, TASK_TABLE_NAME,
  routineCadenceOf, routineDefaultFilters, routineExpensesCsvFileName, routineRowsOf, routineTable, routineTimeOf, statusChipWords, statusDroppedOf, taskDefaultFilters,
  taskRowsOf, taskStatusOf, taskTable, withoutStatusFilter, workCsvFileName, type WorkBook, type WorkProject,
} from '../operations/work';
import { OPEN_PROJECT_STATUSES, isOpenProjectStatus } from '../operations/morningLog';
import { filterRows } from '../table/filters';
import type { Routine, RoutineStep } from '@/components/workbench/operations/routines/types';
import type { Project, Task } from '@/components/workbench/operations/projects/types';

const OPS = 'src/components/workbench/operations';
const PAGE = 'src/app/tasks/page.tsx';
const SECTION_E = `${OPS}/SectionE_Work.tsx`;
const SECTION_F = `${OPS}/SectionF_RoutineExpenses.tsx`;
const SECTION_D = `${OPS}/SectionD_ProjectBacklog.tsx`;
const ROWS = `${OPS}/projects/ProjectTableRows.tsx`;
const SHARED = `${OPS}/workShared.tsx`;
const WORK_LIB = 'src/lib/operations/work.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const DAY_READS = `${OPS}/day/dayReads.ts`;
const MORNING_LOG = `${OPS}/stops/MorningLog.tsx`;
const TASKS_ROUTE = 'src/app/api/operations/projects/[id]/tasks/route.ts';
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';

// ── THE FIXTURES ──────────────────────────────────────────────────────────────

const NOW = new Date('2026-10-25T06:00:00.000Z');
const BOOKS: WorkBook[] = [{ id: 'p', name: 'Personal', entity_type: 'personal' }];
const project = (o: Partial<Project> & { id: string; title: string }): Project => ({ entity_id: 'p', status: 'in_progress', ...o } as Project);
const task = (o: Partial<Task> & { id: string; title: string; project_id: string }): Task => ({ entity_id: 'p', status: 'open', estimated_cost_usd: null, deadline: null, coa_code: null, completed_at: null, ...o } as Task);
const OPEN = project({ id: 'open', title: 'Open project', status: 'backlog' });
const ARCHIVED = project({ id: 'arch', title: 'Archived project', status: 'archived' });
const COMPLETED = project({ id: 'comp', title: 'Completed project', status: 'completed' });
const T_NEW = task({ id: 'n', title: 'new one', project_id: 'open' });
const T_DONE = task({ id: 'd', title: 'done one', project_id: 'open', status: 'completed', completed_at: '2026-10-24T10:00:00.000Z' });
const T_PENDING = task({ id: 'r', title: 'pending one', project_id: 'open', status: 'pending_review' });
const T_CANCELLED = task({ id: 'c', title: 'cancelled one', project_id: 'open', status: 'cancelled' });
const T_ARCHIVED_TASK = task({ id: 'a', title: 'archived task of an open project', project_id: 'open', status: 'archived' });
const T_OF_ARCHIVED = task({ id: 'x', title: 'task of an archived project', project_id: 'arch' });
const T_OF_COMPLETED = task({ id: 'y', title: 'task of a completed project', project_id: 'comp' });
const PROJECTS: WorkProject[] = [
  { project: OPEN, tasks: [T_NEW, T_DONE, T_PENDING, T_CANCELLED, T_ARCHIVED_TASK] },
  { project: ARCHIVED, tasks: [T_OF_ARCHIVED] },
  { project: COMPLETED, tasks: [T_OF_COMPLETED] },
];
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
const THREE_LINES = routine({ id: 'm', name: 'Morning', steps: [
  step({ id: 's1', activity: 'Coffee', step_order: 1, budget_amount: '3.00', coa_code: '6150' }),
  step({ id: 's2', activity: 'Stretch', step_order: 2 }),
  step({ id: 's3', activity: 'Journal', step_order: 3, budget_amount: '0.50', coa_code: '6150' }),
] });
const ONCE = routine({ id: 'o', name: 'Dentist', schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', start_date: '2026-11-03', end_date: '2026-11-03', start_time: '1970-01-01T14:00:00.000Z', end_time: '1970-01-01T15:00:00.000Z', budget_amount: '40', coa_code: '6150' });
const ALL_DAY = routine({ id: 'a', name: 'Apple storage', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0;BYSECOND=0', start_time: null, end_time: null, budget_amount: '2.99', coa_code: '6200' });
const ENDED = routine({ id: 'e', name: 'Old bill', end_date: '2026-10-13', budget_amount: '12', coa_code: '6150' });
const INACTIVE = routine({ id: 'i', name: 'Paused', is_active: false });
const R_ROWS = routineRowsOf([THREE_LINES, ONCE, ALL_DAY, ENDED, INACTIVE], NOW);
const R_COLUMNS = routineTable(BOOKS, {}, new Map()); // ROUTINES-03 (2026-10-25): the spec takes the month's figures too
const T_ROWS = taskRowsOf(PROJECTS);
const T_COLUMNS = taskTable(BOOKS, {});

// ── RULING B · THE WORK ───────────────────────────────────────────────────────

test('B taskRowsOf: a task of an archived or completed project is NOT a row even when passed; every task of an open project is — done, cancelled, archived and pending review included', () => {
  assert.deepEqual(T_ROWS.map((r) => r.id), ['task:n', 'task:d', 'task:r', 'task:c', 'task:a']);
  assert.ok(T_ROWS.every((r) => r.project.id === 'open'));
  assert.deepEqual(taskRowsOf([{ project: ARCHIVED, tasks: [T_OF_ARCHIVED] }]), []);
  assert.deepEqual(taskRowsOf([{ project: COMPLETED, tasks: [T_OF_COMPLETED] }]), []);
  for (const status of ['dropped', 'cancelled', 'archived', 'completed'] as const) assert.deepEqual(taskRowsOf([{ project: project({ id: 'q', title: 'Q', status }), tasks: [T_NEW] }]), [], `a ${status} project's task is no row`);
  for (const status of OPEN_PROJECT_STATUSES) assert.equal(taskRowsOf([{ project: project({ id: 'q', title: 'Q', status }), tasks: [T_NEW] }]).length, 1, `a ${status} project's task is a row`);
  // The one set: morningLog.ts's, read through isOpenProjectStatus — work.ts defines none of its own.
  assert.deepEqual([...OPEN_PROJECT_STATUSES], ['backlog', 'scoped', 'scheduled', 'in_progress', 'blocked', 'not_started']);
  assert.ok(isOpenProjectStatus('blocked') && !isOpenProjectStatus('archived'));
  const w = code(WORK_LIB);
  assert.match(w, /import \{ isOpenProjectStatus \} from '@\/lib\/operations\/morningLog';/);
  assert.match(w, /if \(!isOpenProjectStatus\(project\.status\)\) continue;/);
  assert.doesNotMatch(w, /OPEN_PROJECT_STATUSES\s*=|BACKLOG_STATUSES/, 'no second set');
});

test('B the default chip "STATUS: open only" drops the done, the cancelled and the archived task; pending review stays; the chip cleared shows every row', () => {
  const filters = taskDefaultFilters(T_COLUMNS);
  assert.deepEqual(statusDroppedOf(filters), ['done', 'cancelled', 'archived']);
  assert.equal(statusChipWords(statusDroppedOf(filters), TASK_DEFAULT), 'STATUS: open only');
  assert.deepEqual(filterRows(T_ROWS, filters, T_COLUMNS).map((r) => r.id), ['task:n', 'task:r'], 'the done task is a row the default chip drops; pending review stays');
  assert.deepEqual(T_ROWS.map(taskStatusOf), ['new', 'done', 'pending review', 'cancelled', 'archived'], 'TASK_STATUS_LABELS\' words');
  assert.deepEqual(filterRows(T_ROWS, withoutStatusFilter(filters), T_COLUMNS).map((r) => r.id), T_ROWS.map((r) => r.id));
  // DONE is completed_at as a date, "—" while open.
  const done = T_COLUMNS.find((c) => c.key === 'done')!;
  assert.equal(done.csv(T_ROWS[1]), '2026-10-24');
  assert.equal(done.words(T_ROWS[0]), '—');
  assert.equal(workCsvFileName('2026-10-25'), 'work_2026-10-25.csv');
  assert.deepEqual([...TASK_COLUMNS], ['task', 'project', 'book', 'status', 'deadline', 'estimate', 'account', 'done']);
  assert.deepEqual(TASK_COLUMNS.map((k) => TASK_HEAD_WORDS[k]), ['TASK', 'PROJECT', 'BOOK', 'STATUS', 'DEADLINE', 'ESTIMATE', 'ACCOUNT', 'DONE']);
  assert.equal(TASK_TABLE_NAME, 'work');
});

test('B THE WORK reads the projects GET without include_archived, narrows to the open set, then each open project\'s tasks with include_archived=true — the route\'s default excludes archived tasks', () => {
  const e = code(SECTION_E);
  assert.match(e, /readJson\('\/api\/operations\/projects', 'projects'\)/);
  assert.match(e, /const projects = openProjects\(\(projectsBody\.projects \?\? \[\]\) as Project\[\]\);/);
  assert.match(e, /projects\.map\(\(p\) => readJson\(`\/api\/operations\/projects\/\$\{p\.id\}\/tasks\?include_archived=true`/);
  assert.doesNotMatch(e, /include_archived=true', 'projects'|\/api\/operations\/routines/);
  // The route facts the reads rest on (FACTS 6 of the prompt): the tasks GET excludes archived unless asked; the projects GET's default excludes
  // only the archived project — the completed, dropped and cancelled still come back, which is why the open set is applied here.
  assert.match(code(TASKS_ROUTE), /const includeArchived = request\.nextUrl\.searchParams\.get\('include_archived'\) === 'true';\n\s*const where: Prisma\.operations_project_tasksWhereInput = \{ project_id: projectId \};\n\s*if \(!includeArchived\) \{\n\s*where\.status = \{ not: 'archived' \};\n\s*\}/);
  assert.match(code(PROJECTS_ROUTE), /include_archived/);
  assert.match(e, /const rows: readonly TaskRow\[\] = read\.kind === 'loaded' \? taskRowsOf\(read\.projects\) : \[\];/);
  assert.match(e, /<NewTaskForm projects=\{projects\} charts=\{charts\}/, '"+ task" picks among the open projects alone');
  assert.match(e, /\{statusChipWords\(statusDroppedOf\(filters\), TASK_DEFAULT\)\} \{CLEAR_CHIP_MARK\}/);
  assert.match(e, /\{ name: workCsvFileName\(localToday\(\)\) \}/);
  for (const piece of ['dataAttr(name, \'complete\')', 'dataAttr(name, \'uncomplete\')', 'dataAttr(name, \'archive\')', 'dataAttr(name, \'unarchive\')', 'dataAttr(name, \'delete\')', 'dataAttr(name, \'edit\')']) assert.ok(e.includes(piece), `the row's ${piece}`);
});

// ── RULING C · ROUTINE EXPENSES ──────────────────────────────────────────────

test('C routineRowsOf: a 3-line routine is 3 rows, a stepless routine one; Once reads "once"; a null clock reads "all day"; ended is dropped by default', () => {
  assert.deepEqual(R_ROWS.map((r) => r.id), ['routine:a', 'routine:m:s1', 'routine:m:s2', 'routine:m:s3', 'routine:e', 'routine:i', 'routine:o']);
  assert.equal(R_ROWS.filter((r) => r.routine.id === 'm').length, 3);
  const cell = (id: string, key: typeof ROUTINE_COLUMNS[number]) => R_COLUMNS.find((c) => c.key === key)!.words(R_ROWS.find((r) => r.id === id)!);
  // ROUTINES-03 (Alex, 2026-10-25, ruling B): ROUTINE is the routine's name alone; the line is SUB ACCOUNT NAME's cell (the "<routine> — <step>" join retired).
  assert.deepEqual(['s1', 's2', 's3'].map((s) => cell(`routine:m:${s}`, 'routine')), ['Morning', 'Morning', 'Morning']);
  assert.deepEqual(['s1', 's2', 's3'].map((s) => cell(`routine:m:${s}`, 'sub_account')), ['Coffee', 'Stretch', 'Journal']);
  assert.equal(cell('routine:o', 'cadence'), 'once');
  assert.equal(routineCadenceOf(R_ROWS.find((r) => r.id === 'routine:o')!), 'once');
  assert.equal(cell('routine:a', 'time'), 'all day');
  assert.equal(routineTimeOf(R_ROWS.find((r) => r.id === 'routine:a')!), ALL_DAY_WORDS);
  assert.equal(cell('routine:m:s1', 'time'), '07:00 – 07:30');
  assert.deepEqual(['routine:a', 'routine:e', 'routine:i', 'routine:o'].map((id) => cell(id, 'status')), ['active', 'ended', 'inactive', 'active']);
  const filters = routineDefaultFilters(R_COLUMNS);
  assert.deepEqual(statusDroppedOf(filters), ['ended', 'inactive']);
  assert.equal(statusChipWords(statusDroppedOf(filters), ROUTINE_DEFAULT), 'STATUS: active only');
  assert.deepEqual(filterRows(R_ROWS, filters, R_COLUMNS).map((r) => r.id), ['routine:a', 'routine:m:s1', 'routine:m:s2', 'routine:m:s3', 'routine:o'], 'the ended and the inactive are dropped by default');
  assert.deepEqual(filterRows(R_ROWS, withoutStatusFilter(filters), R_COLUMNS).map((r) => r.id), R_ROWS.map((r) => r.id), 'the chip cleared shows the ended one');
  assert.equal(routineExpensesCsvFileName('2026-10-25'), 'routine-expenses_2026-10-25.csv');
  // ROUTINES-03 (Alex, 2026-10-25, ruling A): the 21 columns in Alex's order — pinned in full in routines03.test.ts; here the eight WORK-01d named still sit among them.
  for (const k of ['routine', 'book', 'cadence', 'days', 'time', 'budget', 'account', 'status'] as const) assert.ok((ROUTINE_COLUMNS as readonly string[]).includes(k), `${k} is still a column`);
  assert.equal(ROUTINE_COLUMNS.length, 21);
  assert.equal(ROUTINE_HEAD_WORDS.budget, 'BUDGET', 'WORK-01d\'s AMOUNT, renamed by ROUTINES-03');
  assert.equal(ROUTINE_TABLE_NAME, 'routine-expenses');
  const f = code(SECTION_F);
  assert.match(f, /const rows: readonly RoutineRow\[\] = read\.kind === 'loaded' \? routineRowsOf\(read\.routines, new Date\(\)\) : \[\];/);
  assert.match(f, /\{statusChipWords\(statusDroppedOf\(filters\), ROUTINE_DEFAULT\)\} \{CLEAR_CHIP_MARK\}/);
  assert.match(f, /\{ name: routineExpensesCsvFileName\(localToday\(\)\) \}/);
  assert.match(f, /<RoutineCreateForm\n\s*entities=\{entities\}/, '"+ routine" is FORM-01\'s form');
  assert.match(f, /<RoutineEditForm routine=\{routine\} end=\{end\} entities=\{entities\} onChanged=\{onChanged\} onClose=\{\(\) => setEditing\(false\)\} \/>/);
});

test('the two chips\' words are the named default\'s alone — any other narrowing spells its values', () => {
  assert.equal(statusChipWords(['done', 'cancelled', 'archived'], TASK_DEFAULT), 'STATUS: open only');
  assert.equal(statusChipWords(['ended', 'inactive'], ROUTINE_DEFAULT), 'STATUS: active only');
  assert.equal(statusChipWords(['inactive', 'ended'], ROUTINE_DEFAULT), 'STATUS: active only', 'the same set in another order');
  assert.equal(statusChipWords(['ended'], ROUTINE_DEFAULT), 'STATUS: not ended');
  assert.equal(statusChipWords(['done', 'cancelled'], TASK_DEFAULT), 'STATUS: not done, not cancelled');
  assert.equal(statusChipWords(['ended', 'inactive'], TASK_DEFAULT), 'STATUS: not ended, not inactive', 'one table\'s default is not the other\'s words');
});

// ── RULING A · THE PAGE AND THE LAW ──────────────────────────────────────────

test('A /tasks mounts THE WORK, PROJECTS (in its boundary) and ROUTINE EXPENSES, in that order; the two-lists law holds exactly the three', () => {
  const page = code(PAGE);
  const box = page.slice(page.indexOf('data-tool-page="Tasks"'), page.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...box.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['SectionE_Work', 'Suspense', 'SectionD_ProjectBacklog', 'SectionF_RoutineExpenses']);
  assert.match(comments(PAGE), /WORK-01d \(Alex, 2026-10-25, ruling A\): Tasks is three tables/);
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>', '<SectionF_RoutineExpenses \/>'\];/);
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionE_Work SectionD_ProjectBacklog SectionF_RoutineExpenses'/);
  assert.match(comments(LAW), /WORK-01d — the ruling \(Alex, 2026-10-25\): Tasks is THREE TABLES/);
  for (const re of [/SectionF_RoutineExpenses\.tsx', \/ADD_ROUTINE_WORDS\//, /SectionE_Work\.tsx', \/ADD_TASK_WORDS\//, /SectionF_RoutineExpenses\.tsx', \/statusChipWords\\\(\//, /SectionF_RoutineExpenses\.tsx', \/<DataTable\//]) assert.match(law, re, `the law holds ${re}`);
  // Three sections, each the shared DataTable, each its own name; neither of the two reads the other's rows.
  const e = code(SECTION_E); const f = code(SECTION_F);
  assert.match(e, /name=\{name\}/); assert.match(f, /name=\{name\}/);
  assert.match(e, /const name = TASK_TABLE_NAME;/); assert.match(f, /const name = ROUTINE_TABLE_NAME;/);
  assert.doesNotMatch(e, /routineRowsOf|RoutineRow\b|Routine\b/); assert.doesNotMatch(f, /taskRowsOf|TaskRow\b|useTaskActions/);
  assert.match(code(SHARED), /export function useBookCharts\(entities: readonly Entity\[\]\): ChartsRead \{/, 'the charts read is the one shared hook');
});

// ROUTINES-03 (Alex, 2026-10-25, ruling E): the merged table's KIND (WORK-01's once | repeated over routines AND tasks, with workRowsOf, workTable,
// WORK_KINDS, kindOf) stays gone; KIND is ROUTINE EXPENSES' own column now — once | repeated over its routines (routines03.test.ts). The pin
// narrowed to the merged table's names; THE WORK still carries no KIND.
test('A the merged table\'s KIND stays gone: no workRowsOf, workTable, WORK_KINDS or kindOf in work.ts, either section or the shared cell; THE WORK has no KIND', () => {
  for (const f of [WORK_LIB, SECTION_E, SECTION_F, SHARED]) assert.doesNotMatch(code(f), /\bkindOf\b|WORK_KINDS|\bworkRowsOf\b|\bworkTable\b/, `${f} holds none of the merged table's names`);
  assert.ok(!(TASK_COLUMNS as readonly string[]).includes('kind'));
  assert.ok(!Object.values(TASK_HEAD_WORDS).includes('KIND'));
  assert.ok((ROUTINE_COLUMNS as readonly string[]).includes('kind'), 'ROUTINES-03: KIND is ROUTINE EXPENSES\' own column');
  assert.equal(ROUTINE_HEAD_WORDS.kind, 'KIND');
  // The law's two-lists block (the kind-views law elsewhere in the file is TABLES-01's, another KIND).
  const law = code(LAW);
  const block = law.slice(law.indexOf('const TWO_LISTS_MOUNTS'), law.indexOf('const TIME_MOUNTS'));
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /KIND|kindOf/);
});

// ── RULING D · PROJECTS AND THE LOG UNCHANGED ────────────────────────────────

test('D THE LOG\'s read is unchanged — readBacklog in dayReads.ts byte for byte (its sha256), and MorningLog.tsx untouched; PROJECTS keeps its section', () => {
  const fn = functionBody(code(DAY_READS), 'readBacklog');
  assert.ok(fn !== null, 'readBacklog is there');
  assert.equal(createHash('sha256').update(fn!).digest('hex'), 'e15f77bea1a202914796e9fca4ddbd8ce3dfa2fbd7022385ff76ab8c5fb75636', 'THE LOG\'s read as it stood on main at 76094d20 (2026-10-25)');
  assert.doesNotMatch(code(DAY_READS) + comments(DAY_READS), /WORK-01d/);
  assert.doesNotMatch(code(MORNING_LOG) + comments(MORNING_LOG), /WORK-01/);
  assert.doesNotMatch(code(SECTION_D) + comments(SECTION_D), /WORK-01d/, 'PROJECTS is unchanged');
  // The details list the project's tasks again — the home of a non-open project's tasks (ruling B).
  assert.match(code(ROWS), /defaultExpanded\n\s*onTasksChanged=\{bump\}/);
  assert.doesNotMatch(code(ROWS), /withoutTaskSection/);
});
