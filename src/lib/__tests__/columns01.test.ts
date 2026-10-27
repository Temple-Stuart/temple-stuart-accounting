/**
 * COLUMNS-01 (Alex, 2026-10-25) — FOUR CORRECTIONS AFTER ROUTINES-03 AND PROJECTS-02.
 *
 *   A. An INACTIVE routine is not budgeted — /budget excludes it, and ROUTINE EXPENSES agrees: THIS MONTH · TO DATE · VARIANCE blank
 *      with the words "inactive — not budgeted (/budget excludes it)"; ACTUAL and MATCH stay; the line stays in the response.
 *   B. Every ISO day is drawn at LOCAL midnight (work.ts dayWords) — DEADLINE · DONE (THE WORK) and TARGET · CAPTURED · PROMOTED ·
 *      SCHEDULED · DONE (PROJECTS) join START · END · NEXT, so no column shows the previous day west of Greenwich.
 *   C. The project PATCH stamps scheduled_at (the latest transition INTO scheduled) and done_at (INTO completed; null once the status
 *      leaves completed) on its existing status-change path — a pure rule, projectStamps.ts.
 *   D. ONE text cell: the journal tables' TextCell lives in components/table/TextCell.tsx and both tables render it (the journal
 *      tables' DOM byte-identical — proven in the PR by snapshot).
 *   E. SectionD_ProjectBacklog's empty-object signature is gone.
 *
 * The rules are DRIVEN over fixtures; the screens and routes are anchored to their source with comments stripped (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  INACTIVE_NOT_BUDGETED_WORDS, ROUTINE_MONTH_CALCULATED, monthLineKey, routineMonthOf, type RoutineMonthInput, type RoutineMonthLine, type RoutineMonthRoutine,
} from '../operations/routineMonth';
import {
  dayWords, routineBudgetWordsOf, routineRowsOf, routineTable, taskRowsOf, taskTable, type RoutineColumn, type RoutineMonthMap, type RoutineRow, type WorkBook, type WorkCharts, type WorkProject,
} from '../operations/work';
import { projectRowsOf, projectTable } from '../operations/projectsTable';
import { statusStampsOf } from '../operations/projectStamps';
import { columnOf } from '../table/columns';
import { BLANK } from '../table/words';
import type { StopRecordRow } from '../operations/stopRecord';
import type { LedgerLinkInput } from '../operations/ledger';
import { formatDate } from '@/components/workbench/operations/projects/projectsTableText';
import type { Project, Task } from '@/components/workbench/operations/projects/types';
import type { Routine, RoutineStep } from '@/components/workbench/operations/routines/types';


const OPS = 'src/components/workbench/operations';
const SECTION_D = `${OPS}/SectionD_ProjectBacklog.tsx`;
const SECTION_F = `${OPS}/SectionF_RoutineExpenses.tsx`;
const ROWS = `${OPS}/projects/ProjectTableRows.tsx`;
const JOURNAL_TABLE = `${OPS}/journal/JournalDayTable.tsx`;
const TEXT_CELL = 'src/components/table/TextCell.tsx';
const WORK = 'src/lib/operations/work.ts';
const SPEC = 'src/lib/operations/projectsTable.ts';
const RULE = 'src/lib/operations/routineMonth.ts';
const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const DAYS = 'src/lib/budget/days.ts';
const MONTH_ROUTE = 'src/app/api/operations/routines/month/route.ts';
const PATCH = 'src/app/api/operations/projects/[id]/route.ts';
const STAMPS = 'src/lib/operations/projectStamps.ts';
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';
const TYPES = `${OPS}/projects/types.ts`;
const SCHEMA = 'prisma/schema.prisma';
const BUDGET_CALLERS = ['src/app/api/hub/year-calendar/route.ts', 'src/app/api/hub/business-budget/route.ts', 'src/app/api/budget/report/route.ts'];

const under = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? under(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));

// ── FIXTURES ─────────────────────────────────────────────────────────────────

const BKK = 'Asia/Bangkok';
const BOOKS: WorkBook[] = [{ id: 'p', name: 'Personal', entity_type: 'personal' }];
const CHARTS: WorkCharts = { p: [{ code: '6150', name: 'Coffee', account_type: 'expense', entity_id: 'p' }] };
const NOW = new Date('2026-10-25T06:00:00.000Z');
const at = (day: string) => `${day}T00:00:00.000Z`; // 07:00 Bangkok — the daily routines' occurrence instant

const plan = (o: Partial<RoutineMonthRoutine> & { id: string; name: string }): RoutineMonthRoutine => ({
  entityId: 'p', entityType: 'personal', timezone: BKK, scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', startDate: null, endDate: null,
  budgetAmount: null, coaCode: null, steps: [], isActive: true, ...o,
});
const record = (o: Partial<StopRecordRow> & { id: string; kind: 'routine' | 'routine_line'; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: o.occurrence_at, actual_cents: null, rating: null, note: null, actual_minutes: null, ...o,
});
const link = (o: Partial<LedgerLinkInput> & { targetId: string; journalEntryId: string; instant: string; amountCents: number | null }): LedgerLinkInput => ({ kind: 'routine_line', ...o });
const step = (o: Partial<RoutineStep> & { id: string; activity: string; step_order: number }): RoutineStep => ({
  routine_id: 'r', user_id: 'u', entity_id: 'p', time_of_day: null, sub_activity: null, location: null, duration_minutes: null, notes: null,
  created_at: '', updated_at: '', created_by: null, ...o,
});
const routine = (o: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'p', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T07:30:00.000Z',
  is_active: true, created_at: '', updated_at: '', created_by: null, budget_amount: null, coa_code: null, role: 'place', steps: [], ...o,
});
const project = (o: Partial<Project> & { id: string; title: string }): Project => ({
  user_id: 'u', entity_id: 'p', goal: null, problem: null, diagnosis: null, design: null, goal_items: [], problem_items: [], diagnosis_items: [],
  deep_research_input: null, claude_code_audit_input: null, status: 'backlog', type: null, size: null, why: null, definition_of_done: null, links: [], notes: null,
  rulings: null, open_questions: null, deadline_reason: null, rank: null, promoted_at: null, scheduled_at: null, done_at: null, target_completion_date: null,
  estimated_total_minutes: null, estimated_total_cost_usd: null, priority_score: null, priority_inputs_hash: null, priority_computed_at: null, priority_rationale: null,
  created_at: at('2026-10-20'), updated_at: at('2026-10-20'), created_by: null, ...o,
});
const task = (o: Partial<Task> & { id: string; title: string; project_id: string }): Task => ({ entity_id: 'p', status: 'open', estimated_cost_usd: null, deadline: null, coa_code: null, completed_at: null, ...o } as Task);

/** Run with the process in another zone — Node re-reads TZ on assignment — and put it back. */
function inZone(zone: string, fn: () => void): void {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try { fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
}

// ── RULING A · AN INACTIVE ROUTINE IS NOT BUDGETED ───────────────────────────

const INACTIVE = plan({ id: 'inact', name: 'Inactive daily', isActive: false, steps: [{ id: 'i1', stepOrder: 1, budgetAmount: '10', coaCode: '6150' }] });
const ACTIVE = plan({ id: 'act', name: 'Active daily', steps: [{ id: 'a1', stepOrder: 1, budgetAmount: '10', coaCode: '6150' }] });
/** Ended on the 5th and still active — the budget rule bounds it by end_date; unchanged by this ruling. */
const ENDED = plan({ id: 'ended', name: 'Ended', endDate: '2026-10-05', budgetAmount: '5', coaCode: '6150' });
const INPUT: RoutineMonthInput = {
  asOf: '2026-10-10',
  routines: [INACTIVE, ACTIVE, ENDED],
  records: [
    record({ id: 'r1', kind: 'routine_line', target_id: 'i1', occurrence_at: at('2026-10-02'), actual_cents: 900 }),
    record({ id: 'r2', kind: 'routine_line', target_id: 'a1', occurrence_at: at('2026-10-02'), actual_cents: 800 }),
  ],
  links: [link({ targetId: 'i1', journalEntryId: 'je1', instant: at('2026-10-02'), amountCents: 950 }), link({ targetId: 'a1', journalEntryId: 'je2', instant: at('2026-10-03'), amountCents: 1000 })],
  vendors: [],
};
const RESULT = routineMonthOf(INPUT);
const lineOf = (routineId: string, stepId: string | null): RoutineMonthLine => {
  assert.ok(RESULT.ok, 'the rule read');
  const l = RESULT.lines.find((x) => x.routine_id === routineId && x.step_id === stepId);
  assert.ok(l !== undefined, `a line for ${routineId}/${stepId}`);
  return l;
};

test('A an inactive daily $10 routine: THIS MONTH, TO DATE and VARIANCE null with the words why; ACTUAL and MATCH as recorded; its line still in the response', () => {
  const inactive = lineOf('inact', 'i1');
  assert.deepEqual(
    [inactive.budget_month_cents, inactive.budget_to_date_cents, inactive.variance_cents, inactive.actual_cents, inactive.actual_records, inactive.match_cents, inactive.match_links, inactive.budget_words],
    [null, null, null, 900, 1, 950, 1, INACTIVE_NOT_BUDGETED_WORDS],
  );
  assert.equal(INACTIVE_NOT_BUDGETED_WORDS, 'inactive — not budgeted (/budget excludes it)');
  assert.ok(RESULT.ok);
  assert.deepEqual(RESULT.lines.map((l) => monthLineKey(l.routine_id, l.step_id)), [monthLineKey('inact', 'i1'), monthLineKey('act', 'a1'), monthLineKey('ended', null)], 'listed, in the order the routines came — never dropped');
  assert.deepEqual(RESULT.said, [], 'nothing to say — an inactive routine is not an anomaly');
});

test('A an active routine is unchanged: 31 days × $10, ten days to the 10th, VARIANCE = TO DATE − ACTUAL, no words; an ended routine still computes to its end date', () => {
  const active = lineOf('act', 'a1');
  assert.deepEqual(
    [active.budget_month_cents, active.budget_to_date_cents, active.actual_cents, active.match_cents, active.variance_cents, active.budget_words],
    [31000, 10000, 800, 1000, 9200, null],
  );
  const ended = lineOf('ended', null);
  assert.deepEqual([ended.budget_month_cents, ended.budget_to_date_cents, ended.budget_words], [2500, 2500, null], 'five $5 days to the 5th — the budget rule bounds it, as before');
  assert.match(ROUTINE_MONTH_CALCULATED.budget_month_cents, /over the active routines; an inactive routine is not budgeted$/);
  assert.match(ROUTINE_MONTH_CALCULATED.budget_to_date_cents, /over the active routines; an inactive routine is not budgeted$/);
});

test('A on the table: the inactive line\'s THIS MONTH · TO DATE · VARIANCE are "—" (empty in the CSV) and say why in the cell\'s tooltip; ACTUAL and MATCH print; the active line and the other cells carry no tooltip', () => {
  assert.ok(RESULT.ok);
  const month: RoutineMonthMap = new Map(RESULT.lines.map((l) => [monthLineKey(l.routine_id, l.step_id), l]));
  const inactive = routine({ id: 'inact', name: 'Inactive daily', is_active: false, steps: [step({ id: 'i1', activity: 'Ten', step_order: 1, budget_amount: '10', coa_code: '6150' })] });
  const active = routine({ id: 'act', name: 'Active daily', steps: [step({ id: 'a1', activity: 'Ten', step_order: 1, budget_amount: '10', coa_code: '6150' })] });
  const rows = routineRowsOf([inactive, active], NOW);
  const columns = routineTable(BOOKS, CHARTS, month);
  const cell = (key: RoutineColumn) => columnOf(columns, key);
  const rowOf = (id: string): RoutineRow => { const r = rows.find((x) => x.id === id); assert.ok(r !== undefined, id); return r; };
  const ri = rowOf(monthLineKey('inact', 'i1'));
  const ra = rowOf(monthLineKey('act', 'a1'));
  for (const key of ['this_month', 'to_date', 'variance'] as const) {
    assert.equal(cell(key).words(ri), BLANK, `${key} blank`);
    assert.equal(cell(key).csv(ri), '', `${key} empty in the CSV`);
    assert.equal(routineBudgetWordsOf(month, ri, key), INACTIVE_NOT_BUDGETED_WORDS, `${key} says why`);
    assert.equal(routineBudgetWordsOf(month, ra, key), undefined, `${key} on the active line: no tooltip`);
  }
  assert.equal(cell('actual').words(ri), '$9.00');
  assert.equal(cell('match').words(ri), '$9.50');
  assert.equal(cell('budget').words(ri), '$10.00', 'BUDGET is the line\'s own amount — a fact, not a calculation');
  assert.equal(cell('status').words(ri), 'inactive');
  for (const key of ['actual', 'match', 'budget', 'status', 'routine'] as const) assert.equal(routineBudgetWordsOf(month, ri, key), undefined, `${key}: no tooltip`);
  assert.equal(routineBudgetWordsOf(new Map(), ri, 'this_month'), undefined, 'a line the route did not return: blank, counted under the table, no words');
  assert.equal(cell('this_month').words(ra), '$310.00');
});

test('A the plumbing: the loader reads the routine\'s is_active (its default read still filters on it), the month route hands isActive, the rule budgets the active alone, the section passes the words; RoutinePlanInput and the /budget callers are untouched', () => {
  const loader = code(LOADER);
  assert.match(loader, /start_date: true,\n\s*is_active: true,\n/, 'the select grew by the routine\'s own is_active');
  assert.match(loader, /is_active: boolean;/);
  assert.match(loader, /is_active: r\.is_active,/);
  assert.match(loader, /where: \{ user_id: userId, entity_id: entityId, \.\.\.\(options\.includeInactive === true \? \{\} : \{ is_active: true \}\) \},/, 'the default read is the active ones, as before (lines02 holds it)');
  assert.match(code(MONTH_ROUTE), /\(\{ \.\.\.toRoutinePlanInput\(row, bookOf\(group\.entityId\)\), isActive: row\.is_active \}\)/);
  const rule = code(RULE);
  assert.match(rule, /export interface RoutineMonthRoutine extends RoutinePlanInput \{ readonly isActive: boolean \}/);
  assert.match(rule, /readonly routines: readonly RoutineMonthRoutine\[\];/);
  assert.match(rule, /const built = buildRoutineBudgetLines\(input\.routines\.filter\(\(r\) => r\.isActive\), from, to\);/);
  assert.match(rule, /budget_words: inactive \? INACTIVE_NOT_BUDGETED_WORDS : null,/);
  assert.match(code(SECTION_F), /<WorkCell key=\{c\.key\} name=\{name\} column=\{c\} row=\{row\} title=\{routineBudgetWordsOf\(month, row, c\.key\)\} \/>/);
  assert.match(code(SECTION_F), /<RoutineWorkRow key=\{row\.id\} row=\{row\} columns=\{columns\} month=\{month\}/);
  // RoutinePlanInput has no routine-level isActive — the steps' stays as it was; the budget routes read the active ones through the unchanged default.
  const days = code(DAYS);
  const planInput = days.slice(days.indexOf('export interface RoutinePlanInput {'), days.indexOf('export interface DayRuleResult'));
  assert.doesNotMatch(planInput, /isActive/, 'RoutinePlanInput is unchanged (its /budget callers too)');
  assert.doesNotMatch(days + comments(DAYS), /COLUMNS-01/);
  for (const f of BUDGET_CALLERS) assert.doesNotMatch(code(f) + comments(f), /includeInactive|COLUMNS-01/, `${f} reads the active routines, as before`);
});

// ── RULING B · EVERY ISO DAY DRAWN AT LOCAL MIDNIGHT ─────────────────────────

test('B in America/Los_Angeles: the DAYs — DEADLINE, START, END and TARGET — for 2026-10-25 read "Oct 25, 2026" (dayWords); formatDate(day) alone read Oct 24 (COLUMNS-01b: the event instants have their own rule)', () => {
  // COLUMNS-01b (Alex, 2026-10-25, ruling 2): the DAYs — DEADLINE · TARGET · START · END — draw their UTC day at local midnight; the EVENT INSTANTS
  // (DONE, CAPTURED · PROMOTED · SCHEDULED · DONE) draw the viewer's day and left this loop for columns01b.test.ts.
  const projectRow = project({ id: 'x', title: 'X', target_completion_date: at('2026-10-25') });
  const work: WorkProject[] = [{ project: projectRow, tasks: [task({ id: 't', title: 'T', project_id: 'x', deadline: at('2026-10-25') })] }];
  const taskCols = taskTable(BOOKS, CHARTS);
  const taskRow = taskRowsOf(work)[0];
  const routineCols = routineTable(BOOKS, CHARTS, new Map());
  const routineRow = routineRowsOf([routine({ id: 'r', name: 'R', start_date: at('2026-10-25'), end_date: at('2026-10-25') })], NOW)[0];
  const projectCols = projectTable(BOOKS);
  const pRow = projectRowsOf([projectRow], new Map())[0];
  for (const zone of ['America/Los_Angeles', 'Asia/Bangkok', 'UTC']) {
    inZone(zone, () => {
      assert.equal(dayWords('2026-10-25'), 'Oct 25, 2026', zone);
      assert.equal(columnOf(taskCols, 'deadline').words(taskRow), 'Oct 25, 2026', `${zone} DEADLINE`);
      assert.equal(columnOf(routineCols, 'start').words(routineRow), 'Oct 25, 2026', `${zone} START`);
      assert.equal(columnOf(routineCols, 'end').words(routineRow), 'Oct 25, 2026', `${zone} END`);
      assert.equal(columnOf(projectCols, 'target').words(pRow), 'Oct 25, 2026', `${zone} TARGET`);
      assert.equal(columnOf(projectCols, 'target').csv(pRow), '2026-10-25', `${zone} TARGET ISO under`);
      assert.equal(columnOf(taskCols, 'deadline').csv(taskRow), '2026-10-25');
    });
  }
  // The defect, for the record: an ISO day alone parses as UTC midnight — the day before, west of Greenwich.
  inZone('America/Los_Angeles', () => {
    assert.equal(formatDate('2026-10-25'), 'Oct 24, 2026', 'what DEADLINE drew before');
    assert.equal(formatDate(at('2026-10-25')), 'Oct 24, 2026', 'what TARGET drew before (the instant in the viewer\'s zone, against the ISO day under it)');
  });
});

test('B one rule, one place: dayWords is defined once in work.ts and every DAY column draws through it; no column draws formatDate(day) of its own (COLUMNS-01b: the instants have their own rule, instantDayWords)', () => {
  const w = code(WORK);
  assert.equal((w.match(/export const dayWords = \(day: string\): string => formatDate\(`\$\{day\}T00:00:00`\);/g) ?? []).length, 1);
  assert.match(w, /valueColumn<TaskRow, TaskColumn>\('deadline', head\.deadline, \(r\) => \{ const d = taskDeadlineOf\(r\); return d === null \? null : dayWords\(d\); \}, taskDeadlineOf\),/);
  assert.match(w, /instantColumn<TaskRow, TaskColumn>\('done', head\.done, taskDoneAtOf\),/); // COLUMNS-01b (2026-10-25, ruling 2): DONE is an EVENT INSTANT
  assert.match(w, /\(r\) => \{ const d = routineStartOf\(r\); return d === null \? null : dayWords\(d\); \}, routineStartOf\),/);
  assert.match(w, /n\.day === null \? n\.words : dayWords\(n\.day\)/, 'NEXT, as ROUTINES-03 drew it');
  assert.equal((w.match(/formatDate\(/g) ?? []).length, 2, 'formatDate is called twice in work.ts — inside dayWords and inside instantDayWords (COLUMNS-01b)');
  const s = code(SPEC);
  assert.match(s, /\(r\) => \{ const d = projectDayOf\(r, column\); return d === null \? null : dayWords\(d\); \}, \(r\) => projectDayOf\(r, column\)\)/); // COLUMNS-01b: the DAY column (TARGET)
  assert.doesNotMatch(s, /formatDate/, 'the projects spec draws no date of its own');
  for (const f of [...under('src/lib/operations'), ...under('src/components/workbench/operations')]) {
    if (f === WORK) continue;
    assert.doesNotMatch(code(f), /formatDate\(`\$\{[a-z]+\}T00:00:00`\)/, `${f} restates dayWords`);
  }
});

// ── RULING C · THE PATCH STAMPS scheduled_at AND done_at ─────────────────────

test('C the stamps: scoped → scheduled sets scheduled_at; scheduled → in_progress leaves it; in_progress → completed sets done_at; completed → in_progress nulls it; backlog → scoped stamps nothing here (promoted_at is the route\'s)', () => {
  assert.deepEqual(statusStampsOf('scoped', 'scheduled', NOW), { scheduled_at: NOW });
  assert.deepEqual(statusStampsOf('scheduled', 'in_progress', NOW), {}, 'the day it was scheduled stays a fact');
  assert.deepEqual(statusStampsOf('in_progress', 'completed', NOW), { done_at: NOW });
  assert.deepEqual(statusStampsOf('completed', 'in_progress', NOW), { done_at: null }, 'a project in process is not done');
  assert.deepEqual(statusStampsOf('backlog', 'scoped', NOW), {});
  assert.deepEqual(statusStampsOf('in_progress', 'scheduled', NOW), { scheduled_at: NOW }, 'the LATEST transition into scheduled');
  assert.deepEqual(statusStampsOf('scheduled', 'completed', NOW), { done_at: NOW });
  assert.deepEqual(statusStampsOf('completed', 'archived', NOW), {}, 'COLUMNS-01b ruling 1: archived does not contradict done — done_at kept (columns01b.test.ts)');
  assert.deepEqual(statusStampsOf('backlog', 'completed', NOW), { done_at: NOW });
  assert.deepEqual(statusStampsOf('completed', 'completed', NOW), {}, 'no transition, nothing stamped');
  assert.deepEqual(statusStampsOf('scheduled', 'scheduled', NOW), {});
  const later = new Date('2026-10-26T06:00:00.000Z');
  assert.deepEqual(statusStampsOf('in_progress', 'scheduled', later), { scheduled_at: later }, 'the instant is the caller\'s');
});

test('C the route: the stamps ride the existing status-change path and its existing audit entry; promoted_at keeps its rule; no new audit type, no route, no migration', () => {
  const r = code(PATCH);
  assert.match(r, /import \{ statusStampsOf \} from '@\/lib\/operations\/projectStamps';/);
  assert.match(r, /if \(incoming !== existing\.status\) \{\n\s*statusChange = \{ from: existing\.status, to: incoming \};\n\s*const stamps = statusStampsOf\(statusChange\.from, statusChange\.to, new Date\(\)\);\n\s*if \(stamps\.scheduled_at !== undefined\) data\.scheduled_at = stamps\.scheduled_at;\n\s*if \(stamps\.done_at !== undefined\) data\.done_at = stamps\.done_at;\n\s*\}\n\s*data\.status = incoming;/);
  assert.match(r, /data\.promoted_at = existing\.promoted_at \?\? new Date\(\);/, 'promoted_at: set once, backlog → scoped (BACKLOG-01b)');
  assert.equal((r.match(/data\.scheduled_at = |data\.done_at = /g) ?? []).length, 2, 'the two columns are written on this path alone');
  assert.match(r, /type: statusChange \? 'operations_project_status_changed' : 'operations_project_updated'/, 'the audit entry\'s type is unchanged');
  // ARCHIVE-01 (Alex, 2026-10-27): two — the write's type above, and the restore's READ of the project's latest entry of the same type (the cascade's audit entry, its one source); still no new type.
  assert.equal((r.match(/operations_project_status_changed/g) ?? []).length, 2);
  assert.match(r, /action_type: 'operations_project_status_changed',\n\s*payload_metadata: \{ path: \['status_to'\], equals: 'archived' \},/);
  assert.match(r, /payload: \{\n\s*before: existing,\n\s*after: project,/, 'before/after carry the stamps');
  assert.doesNotMatch(code(STAMPS), /prisma|fetch|new Date\(\)/, 'pure — the instant is handed in');
  assert.match(comments(STAMPS), /COLUMNS-01 \(Alex, 2026-10-25, ruling C\)/);
  // The columns exist (BACKLOG-01) and reach the client; no schema or migration moves.
  assert.match(code(TYPES), /scheduled_at: string \| null;\n\s*done_at: string \| null;/);
  assert.match(code(PROJECTS_ROUTE), /\.\.\.p,\n\s*task_count: _count\.tasks,/, 'the GET spreads the row — scheduled_at and done_at ride it');
  assert.doesNotMatch(code(SCHEMA) + comments(SCHEMA), /COLUMNS-01/);
  assert.equal(readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /columns[_-]?01/i.test(d)).length, 0, 'no migration');
  assert.equal(existsSync(resolve(process.cwd(), 'src/app/api/operations/projects/[id]/stamps')), false, 'no new route');
});

// ── RULING D · ONE TEXT CELL ─────────────────────────────────────────────────

test('D the journal tables\' TextCell lives in components/table/TextCell.tsx, as it stood, and both tables render it — no copy anywhere under src', () => {
  const tc = code(TEXT_CELL);
  assert.match(tc, /^'use client';/m);
  assert.match(tc, /export default function TextCell\(\{ name, column, text, open, onToggle \}: \{ name: string; column: string; text: string \| null; open: boolean; onToggle: \(\) => void \}\) \{/);
  assert.match(tc, /if \(text === null\) return <td className=\{`\$\{cell\} \$\{BLANK_CLASS\}`\} \{\.\.\.dataAttr\(name, 'cell', column\)\}>\{BLANK\}<\/td>;/);
  assert.match(tc, /const preview = previewOf\(text\);/);
  assert.match(tc, /<td className=\{`\$\{cell\} max-w-\[24rem\] whitespace-pre-line break-words`\} \{\.\.\.dataAttr\(name, 'cell', column\)\} \{\.\.\.dataAttr\(name, 'cell-open', open \? '' : undefined\)\}>/);
  assert.match(tc, /\{open \|\| preview\.more === null \? text : preview\.shown\}/);
  assert.match(tc, /\{!open && <span className="text-text-faint"> \{preview\.more\}<\/span>\}/);
  assert.match(tc, /<button type="button" className=\{link\} onClick=\{onToggle\} \{\.\.\.dataAttr\(name, 'cell-toggle'\)\}>\{open \? COLLAPSE_WORDS : EXPAND_WORDS\}<\/button>/);
  assert.match(tc, /import \{ COLLAPSE_WORDS, EXPAND_WORDS, previewOf \} from '@\/lib\/table\/preview';/, 'COLUMNS-01b (2026-10-25, ruling 3): the rule is the idiom\'s — no journal import in components/table');
  assert.match(tc, /const BLANK_CLASS = 'text-text-faint';\nconst link = 'underline text-brand-purple hover:text-text-primary';/);
  assert.doesNotMatch(tc, /fetch\(|useState|useEffect/, 'the opened state is the caller\'s');
  const j = code(JOURNAL_TABLE);
  assert.match(j, /import TextCell from '@\/components\/table\/TextCell';/);
  assert.match(j, /<TextCell key=\{c\.key\} name=\{name\} column=\{c\.key\} text=\{c\.text\(row\)\} open=\{opened\.has\(cellKeyOf\(row, c\.key\)\)\} onToggle=\{\(\) => toggle\(cellKeyOf\(row, c\.key\)\)\} \/>/);
  const p = code(ROWS);
  assert.match(p, /import TextCell from '@\/components\/table\/TextCell';/);
  assert.match(p, /<TextCell name=\{name\} column=\{column\.key\} text=\{column\.text\(row\)\} open=\{open\} onToggle=\{onToggle\} \/>/);
  const definers = under('src').filter((f) => /function TextCell\(/.test(code(f)));
  assert.deepEqual(definers, [TEXT_CELL], 'one definition');
  for (const f of [JOURNAL_TABLE, ROWS]) assert.doesNotMatch(code(f), /const link = |previewOf|EXPAND_WORDS|COLLAPSE_WORDS/, `${f} keeps nothing of the cell`);
});

// ── RULING E · THE SECTION'S SIGNATURE ───────────────────────────────────────

test('E SectionD_ProjectBacklog takes no props — the empty-object signature that tripped no-empty-object-type is gone', () => {
  const d = code(SECTION_D);
  assert.match(d, /export default function SectionD_ProjectBacklog\(\) \{/);
  assert.doesNotMatch(d, /\{ \}: \{ \}/);
  assert.match(code('src/app/tasks/page.tsx'), /<SectionD_ProjectBacklog \/>/);
});
