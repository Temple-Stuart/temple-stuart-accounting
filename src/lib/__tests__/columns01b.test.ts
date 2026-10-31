/**
 * COLUMNS-01b (Alex, 2026-10-25) — THE AMENDMENT ON COLUMNS-01, BEFORE MERGE.
 *
 *   1. done_at is cleared ONLY when the status moves INTO an open status (morningLog.ts OPEN_PROJECT_STATUSES) — reopened is not done;
 *      every other move out of completed keeps it (archived · cancelled · dropped do not contradict done). scheduled_at unchanged.
 *   2. Two kinds of date column, one rule each, in work.ts beside dayWords: a DAY (START · END, and DEADLINE · TARGET — stored as
 *      new Date('YYYY-MM-DD') from <input type="date">) draws its UTC day at local midnight and writes the ISO day; an EVENT INSTANT
 *      (THE WORK's DONE completed_at; PROJECTS' CAPTURED · PROMOTED · SCHEDULED · DONE) draws the VIEWER's local day, sorts by the
 *      instant and writes the ISO instant as stored.
 *   3. previewOf, EXPAND_WORDS, COLLAPSE_WORDS live in src/lib/table/preview.ts (the idiom); journalTables.ts and components/table/
 *      TextCell.tsx import from there; no journal import remains under components/table (the DOM byte-identical — proven in the PR).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { statusStampsOf } from '../operations/projectStamps';
import { OPEN_PROJECT_STATUSES, isOpenProjectStatus } from '../operations/morningLog';
import { dayWords, instantColumn, instantDayWords, routineRowsOf, routineTable, taskRowsOf, taskTable, type WorkBook, type WorkCharts, type WorkProject } from '../operations/work';
import { PROJECT_DAY_FIELDS, PROJECT_INSTANT_FIELDS, projectRowsOf, projectTable } from '../operations/projectsTable';
import { COLLAPSE_WORDS, EXPAND_WORDS, PREVIEW_CHARS, previewMoreWords, previewOf } from '../table/preview';
import * as journalTables from '../operations/journalTables';
import { columnOf } from '../table/columns';
import { tableCsv } from '../table/csv';
import { BLANK } from '../table/words';
import { STATUS_LABELS, type Project, type ProjectStatus, type Task } from '@/components/workbench/operations/projects/types';
import type { Routine } from '@/components/workbench/operations/routines/types';

const OPS = 'src/components/workbench/operations';
const WORK = 'src/lib/operations/work.ts';
const SPEC = 'src/lib/operations/projectsTable.ts';
const STAMPS = 'src/lib/operations/projectStamps.ts';
const PREVIEW = 'src/lib/table/preview.ts';
const JOURNAL_RULE = 'src/lib/operations/journalTables.ts';
const TEXT_CELL = 'src/components/table/TextCell.tsx';
const TASKS_POST = 'src/app/api/operations/projects/[id]/tasks/route.ts';
const TASK_PATCH = 'src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts';
const PROJECT_POST = 'src/app/api/operations/projects/route.ts';
const PROJECT_PATCH = 'src/app/api/operations/projects/[id]/route.ts';
const FORMS = [`${OPS}/projects/TaskCreateInputs.tsx`, `${OPS}/projects/TaskEditInputs.tsx`, `${OPS}/projects/ProjectCreateForm.tsx`, `${OPS}/projects/ProjectRowView.tsx`];

const under = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? under(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));

const NOW = new Date('2026-10-25T06:00:00.000Z');
const BOOKS: WorkBook[] = [{ id: 'p', name: 'Personal', entity_type: 'personal' }];
const CHARTS: WorkCharts = { p: [] };
const project = (o: Partial<Project> & { id: string; title: string }): Project => ({
  user_id: 'u', entity_id: 'p', goal: null, problem: null, diagnosis: null, design: null, goal_items: [], problem_items: [], diagnosis_items: [],
  deep_research_input: null, claude_code_audit_input: null, status: 'backlog', type: null, size: null, why: null, definition_of_done: null, links: [], notes: null,
  rulings: null, open_questions: null, deadline_reason: null, rank: null, promoted_at: null, scheduled_at: null, done_at: null, target_completion_date: null,
  estimated_total_minutes: null, estimated_total_cost_usd: null, priority_score: null, priority_inputs_hash: null, priority_computed_at: null, priority_rationale: null,
  created_at: '2026-10-20T03:00:00.000Z', updated_at: '2026-10-20T03:00:00.000Z', created_by: null, ...o,
});
const task = (o: Partial<Task> & { id: string; title: string; project_id: string }): Task => ({ entity_id: 'p', status: 'open', estimated_cost_usd: null, deadline: null, coa_code: null, completed_at: null, ...o } as Task);
const routine = (o: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'p', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', timezone: 'Asia/Bangkok',
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T07:30:00.000Z',
  is_active: true, created_at: '', updated_at: '', created_by: null, budget_amount: null, coa_code: null, role: 'place', steps: [], ...o,
});
function inZone(zone: string, fn: () => void): void {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try { fn(); } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
}

// ── RULING 1 · done_at CLEARS ONLY ON REOPENING ──────────────────────────────

test('1 done_at: completed → archived keeps it; completed → in_progress and completed → scoped null it; completed → cancelled and → dropped keep it; in_progress → completed sets it; scheduled_at as before', () => {
  assert.deepEqual(statusStampsOf('completed', 'archived', NOW), {}, 'archived does not contradict done');
  assert.deepEqual(statusStampsOf('completed', 'in_progress', NOW), { done_at: null }, 'reopened is not done');
  assert.deepEqual(statusStampsOf('completed', 'scoped', NOW), { done_at: null });
  assert.deepEqual(statusStampsOf('completed', 'cancelled', NOW), {});
  assert.deepEqual(statusStampsOf('completed', 'dropped', NOW), {});
  assert.deepEqual(statusStampsOf('in_progress', 'completed', NOW), { done_at: NOW });
  // The rule is the ONE open set: every open status clears it, every other keeps it.
  for (const to of Object.keys(STATUS_LABELS) as ProjectStatus[]) {
    if (to === 'completed') continue;
    assert.deepEqual(statusStampsOf('completed', to, NOW), { ...(to === 'scheduled' ? { scheduled_at: NOW } : {}), ...(isOpenProjectStatus(to) ? { done_at: null } : {}) }, `completed → ${to}`);
  }
  assert.deepEqual([...OPEN_PROJECT_STATUSES], ['backlog', 'scoped', 'scheduled', 'in_progress', 'blocked', 'not_started']);
  assert.deepEqual(statusStampsOf('completed', 'scheduled', NOW), { scheduled_at: NOW, done_at: null }, 'rescheduled: scheduled_at stamped, done_at cleared (scheduled is open)');
  assert.deepEqual(statusStampsOf('scheduled', 'in_progress', NOW), {}, 'scheduled_at kept on every move out');
  assert.deepEqual(statusStampsOf('scheduled', 'archived', NOW), {});
  assert.match(code(STAMPS), /if \(from === 'completed' && isOpenProjectStatus\(to\)\) stamps\.done_at = null;/);
  assert.match(code(STAMPS), /import \{ isOpenProjectStatus \} from '@\/lib\/operations\/morningLog';/);
  assert.match(comments(STAMPS), /COLUMNS-01b \(Alex, 2026-10-25, ruling 1\)/);
});

// ── RULING 2 · DAYS AND EVENT INSTANTS ───────────────────────────────────────

test('2 an event instant 2026-10-25T23:30:00Z draws Oct 26 in Manila and Oct 25 in Los Angeles; the CSV writes 2026-10-25T23:30:00.000Z in both; a DEADLINE of 2026-10-25T00:00:00Z draws Oct 25 in both', () => {
  const INSTANT = '2026-10-25T23:30:00.000Z';
  const DAY = '2026-10-25T00:00:00.000Z';
  // An OPEN project (THE WORK reads the open projects' tasks alone); its stamps are fixture data.
  const p = project({ id: 'x', title: 'X', status: 'in_progress', target_completion_date: DAY, created_at: INSTANT, promoted_at: INSTANT, scheduled_at: INSTANT, done_at: INSTANT });
  const pCols = projectTable(BOOKS);
  const pRow = projectRowsOf([p], new Map())[0];
  const work: WorkProject[] = [{ project: p, tasks: [task({ id: 't', title: 'T', project_id: 'x', deadline: DAY, status: 'completed', completed_at: INSTANT })] }];
  const tCols = taskTable(BOOKS, CHARTS);
  const tRow = taskRowsOf(work)[0];
  const rCols = routineTable(BOOKS, CHARTS, new Map());
  const rRow = routineRowsOf([routine({ id: 'r', name: 'R', start_date: DAY, end_date: DAY })], NOW)[0];
  const seen: Record<string, string> = {};
  for (const [zone, day] of [['Asia/Manila', 'Oct 26, 2026'], ['America/Los_Angeles', 'Oct 25, 2026']] as const) {
    inZone(zone, () => {
      assert.equal(instantDayWords(INSTANT), day, zone);
      for (const key of ['captured', 'promoted', 'scheduled', 'done'] as const) {
        assert.equal(columnOf(pCols, key).words(pRow), day, `${zone} ${key}`);
        assert.equal(columnOf(pCols, key).csv(pRow), INSTANT, `${zone} ${key} CSV: the instant as stored`);
        assert.deepEqual(columnOf(pCols, key).sortKey(pRow), { kind: 'text', t: INSTANT }, `${zone} ${key} sorts by the instant`);
      }
      assert.equal(columnOf(tCols, 'done').words(tRow), day, `${zone} THE WORK's DONE`);
      assert.equal(columnOf(tCols, 'done').csv(tRow), INSTANT);
      assert.deepEqual(columnOf(tCols, 'done').sortKey(tRow), { kind: 'text', t: INSTANT });
      // The DAYs: the same day on both sides of Greenwich.
      assert.equal(columnOf(tCols, 'deadline').words(tRow), 'Oct 25, 2026', `${zone} DEADLINE`);
      assert.equal(columnOf(tCols, 'deadline').csv(tRow), '2026-10-25');
      assert.equal(columnOf(pCols, 'target').words(pRow), 'Oct 25, 2026', `${zone} TARGET`);
      assert.equal(columnOf(pCols, 'target').csv(pRow), '2026-10-25');
      assert.equal(columnOf(rCols, 'start').words(rRow), 'Oct 25, 2026', `${zone} START`);
      assert.equal(columnOf(rCols, 'end').words(rRow), 'Oct 25, 2026', `${zone} END`);
      assert.equal(dayWords('2026-10-25'), 'Oct 25, 2026');
      seen[zone] = tableCsv(pCols, [pRow]);
    });
  }
  assert.equal(seen['Asia/Manila'], seen['America/Los_Angeles'], 'the CSV is the same bytes in every zone — instants and ISO days, never a drawn day');
  assert.ok(seen['Asia/Manila'].includes(INSTANT) && seen['Asia/Manila'].includes(',2026-10-25,'), 'the instant and the day, as stored');
  // Unset: blank on screen, empty in the CSV, last in the sort.
  const bare = projectRowsOf([project({ id: 'b', title: 'B' })], new Map())[0];
  assert.equal(columnOf(pCols, 'done').words(bare), BLANK);
  assert.equal(columnOf(pCols, 'done').csv(bare), '');
  assert.equal(columnOf(pCols, 'done').sortKey(bare), null);
  const c = instantColumn<{ at: string | null }, 'at'>('at', 'AT', (r) => r.at);
  assert.equal(c.kind, 'value');
  assert.equal(c.csv({ at: null }), '');
  assert.equal(c.csv({ at: INSTANT }), INSTANT);
});

test('2 the classification is written over the two rules in work.ts; DEADLINE and TARGET are DAYs because the forms send YYYY-MM-DD from <input type="date"> and the routes store new Date(it); the stamps are now()', () => {
  const w = code(WORK);
  assert.match(w, /export const dayWords = \(day: string\): string => formatDate\(`\$\{day\}T00:00:00`\);\n/);
  assert.match(w, /export const instantDayWords = \(instant: string\): string => formatDate\(instant\);/);
  assert.match(comments(WORK), /TWO KINDS OF DATE COLUMN, ONE RULE EACH \(COLUMNS-01 ruling B; COLUMNS-01b, Alex, 2026-10-25, ruling 2\)/);
  assert.match(comments(WORK), /A DAY — a @db\.Date column \(START · END/);
  assert.match(comments(WORK), /An EVENT INSTANT — a Timestamptz its writer stamps with now\(\)/);
  assert.match(w, /export function instantColumn<Row, Key extends string>\(column: Key, label: string, instant: \(row: Row\) => string \| null\): TableColumn<Row, Key> \{\n\s*return \{ key: column, label, kind: 'value', words: \(r\) => \{ const i = instant\(r\); return i === null \? BLANK : instantDayWords\(i\); \}, sortKey: \(r\) => textKey\(instant\(r\)\), csv: \(r\) => instant\(r\) \?\? '' \};/);
  assert.match(w, /export const taskDoneAtOf = \(row: TaskRow\): string \| null => row\.task\.completed_at \|\| null;/);
  assert.match(w, /instantColumn<TaskRow, TaskColumn>\('done', head\.done, taskDoneAtOf\),/);
  assert.match(w, /valueColumn<TaskRow, TaskColumn>\('deadline', head\.deadline, \(r\) => \{ const d = taskDeadlineOf\(r\); return d === null \? null : dayWords\(d\); \}, taskDeadlineOf\),/);
  assert.doesNotMatch(w, /taskDoneOf\b/, 'the ISO-day reader of completed_at left with the day drawing');
  const s = code(SPEC);
  assert.deepEqual(PROJECT_DAY_FIELDS, { target: 'target_completion_date' });
  assert.deepEqual(PROJECT_INSTANT_FIELDS, { captured: 'created_at', promoted: 'promoted_at', scheduled: 'scheduled_at', done: 'done_at' });
  assert.match(s, /dayColumn\('target'\),\n/);
  assert.match(s, /stampColumn\('captured'\),\n\s*stampColumn\('promoted'\),\n\s*stampColumn\('scheduled'\),\n\s*stampColumn\('done'\),\n/);
  assert.match(s, /instantColumn<ProjectTableRow, ProjectColumn>\(column, PROJECT_HEAD_WORDS\[column\], \(r\) => projectInstantOf\(r, column\)\)/);
  assert.doesNotMatch(s, /formatDate|dateColumn|PROJECT_DATE_FIELDS/);
  // The writers: a 'YYYY-MM-DD' from the forms' date inputs, stored as new Date(it) — UTC midnight of the day.
  for (const f of FORMS) assert.match(code(f), /type="date"/, `${f} sends a YYYY-MM-DD`);
  assert.match(code(TASKS_POST), /typeof body\.deadline === 'string' && body\.deadline\.length > 0\n\s*\? new Date\(body\.deadline\)/);
  assert.match(code(TASK_PATCH), /typeof body\.deadline === 'string' && body\.deadline\.length > 0\n\s*\? new Date\(body\.deadline\)/);
  assert.match(code(PROJECT_POST), /typeof body\.target_completion_date === 'string' && body\.target_completion_date\.length > 0\n\s*\? new Date\(body\.target_completion_date\)/);
  assert.match(code(PROJECT_PATCH), /typeof body\.target_completion_date === 'string' && body\.target_completion_date\.length > 0\n\s*\? new Date\(body\.target_completion_date\)/);
  assert.match(code(`${OPS}/projects/useTaskActions.ts`), /deadline: t\.deadline \? t\.deadline\.slice\(0, 10\) : '',/, 'the edit form re-reads the day');
  assert.match(code(`${OPS}/projects/ProjectRow.tsx`), /target_completion_date: p\.target_completion_date\n\s*\? p\.target_completion_date\.slice\(0, 10\)/);
  // The instants' writers stamp now().
  assert.match(code(TASK_PATCH), /data\.completed_at = new Date\(\);/);
  assert.match(code(PROJECT_PATCH), /const stamps = statusStampsOf\(statusChange\.from, statusChange\.to, new Date\(\)\);/);
});

// ── RULING 3 · THE PREVIEW RULE IS THE IDIOM'S ──────────────────────────────

test('3 previewOf, EXPAND_WORDS and COLLAPSE_WORDS live in src/lib/table/preview.ts; journalTables.ts and TextCell.tsx read them there; no journal import under components/table; the rule unchanged', () => {
  assert.equal(PREVIEW_CHARS, 160);
  assert.deepEqual(previewOf('short'), { shown: 'short', more: null });
  assert.deepEqual(previewOf('a'.repeat(161)), { shown: 'a'.repeat(160), more: '… (161 chars)' });
  assert.deepEqual([previewMoreWords(300), EXPAND_WORDS, COLLAPSE_WORDS], ['… (300 chars)', 'all of it', 'less']);
  assert.equal(journalTables.previewOf, previewOf, 'the journal tables name the same function');
  assert.equal(journalTables.EXPAND_WORDS, EXPAND_WORDS);
  assert.equal(journalTables.COLLAPSE_WORDS, COLLAPSE_WORDS);
  assert.equal(journalTables.PREVIEW_CHARS, PREVIEW_CHARS);
  const pv = code(PREVIEW);
  assert.match(pv, /export const PREVIEW_CHARS = 160;/);
  assert.match(pv, /export function previewOf\(text: string\): \{ readonly shown: string; readonly more: string \| null \} \{\n\s*const chars = \[\.\.\.text\];\n\s*if \(chars\.length <= PREVIEW_CHARS\) return \{ shown: text, more: null \};\n\s*return \{ shown: chars\.slice\(0, PREVIEW_CHARS\)\.join\(''\), more: previewMoreWords\(chars\.length\) \};\n\}/);
  assert.match(pv, /export const EXPAND_WORDS = 'all of it';\nexport const COLLAPSE_WORDS = 'less';/);
  assert.doesNotMatch(pv, /import /, 'pure, imports nothing');
  const j = code(JOURNAL_RULE);
  assert.match(j, /export \{ COLLAPSE_WORDS, EXPAND_WORDS, PREVIEW_CHARS, previewMoreWords, previewOf \} from '@\/lib\/table\/preview';/);
  assert.doesNotMatch(j, /function previewOf|PREVIEW_CHARS = |EXPAND_WORDS = |COLLAPSE_WORDS = /, 'no second copy');
  assert.match(code(TEXT_CELL), /import \{ COLLAPSE_WORDS, EXPAND_WORDS, previewOf \} from '@\/lib\/table\/preview';/);
  for (const f of under('src/components/table')) assert.doesNotMatch(code(f), /\/operations\/journal/, `${f} imports nothing of the journal`);
  const definers = under('src').filter((f) => /function previewOf\(/.test(code(f)));
  assert.deepEqual(definers, [PREVIEW]);
  assert.match(code(SPEC), /export \{ COLLAPSE_WORDS, EXPAND_WORDS, PREVIEW_CHARS, previewMoreWords, previewOf \} from '@\/lib\/table\/preview';/);
});
