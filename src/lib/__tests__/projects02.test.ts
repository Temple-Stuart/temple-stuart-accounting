/**
 * PROJECTS-02 (Alex, 2026-10-25) — PROJECTS IS THE BRIEF AS A TABLE.
 *
 * PROJECTS renders through the shared DataTable (IDIOM-01) over the pure spec in
 * src/lib/operations/projectsTable.ts: one row per project, Alex's twenty-six
 * columns in his order, the brief's text whole for the filter, the sort and the
 * CSV and previewed on screen, EST the sum of the tasks' estimates, ACTUAL the
 * Books rollup, "STATUS: open only" the visible default, and a project update
 * bumping THE WORK's signal. The spec is DRIVEN over fixtures here; the screens
 * are anchored to their source with comments stripped (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  ACTUAL_TOOLTIP_WORDS, DETAILS_WORDS, HIDE_DETAILS_WORDS, NO_TASKS_WORDS, PROJECT_COLUMNS, PROJECT_DEFAULT_WORDS, PROJECT_HEAD_WORDS, PROJECT_TABLE_NAME,
  PROJECT_TOOLTIPS, TASKS_LOADING_WORDS, estimateCoverageWords, estimateSumOf, previewOf, projectActualCentsOf, projectCellKeyOf, projectDefault, projectDefaultFilters,
  projectEstimateOf, projectRowsOf, projectTable, projectTasksWordsOf, projectsCsvFileName, type ProjectColumn, type ProjectTableRow, type ProjectTasksRead,
} from '../operations/projectsTable';
import { dayWords, estimateCentsOf, instantDayWords, statusChipWords, withoutStatusFilter } from '../operations/work';
import { OPEN_PROJECT_STATUSES, isOpenProjectStatus } from '../operations/morningLog';
import { CAPTURE_QUESTIONS, captureQuestion } from '../operations/projectBrief';
import { EXPAND_WORDS, COLLAPSE_WORDS, PREVIEW_CHARS } from '../table/preview'; // COLUMNS-01b (2026-10-25, ruling 3): the rule is the idiom's
import { columnOf } from '../table/columns';
import { filterRows, noFilters, withFilter } from '../table/filters';
import { sortRows } from '../table/sort';
import { csvField, tableCsv } from '../table/csv';
import { BLANK } from '../table/words';
import { STATUS_LABELS, type Project, type ProjectStatus, type Task } from '@/components/workbench/operations/projects/types';
import { statusCounts } from '@/components/workbench/operations/projects/projectsTableText';

const OPS = 'src/components/workbench/operations';
const SECTION_D = `${OPS}/SectionD_ProjectBacklog.tsx`;
const TABLE = `${OPS}/projects/ProjectsTable.tsx`;
const ROWS = `${OPS}/projects/ProjectTableRows.tsx`;
const TEXT = `${OPS}/projects/projectsTableText.ts`;
const SHARED = `${OPS}/workShared.tsx`;
const SPEC = 'src/lib/operations/projectsTable.ts';
const WORK = 'src/lib/operations/work.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';
const TASKS_ROUTE = 'src/app/api/operations/projects/[id]/tasks/route.ts';
const SCHEMA = 'prisma/schema.prisma';

/** Each piece found in order, each after the last. */
function inOrder(body: string, pieces: string[], what: string) {
  let at = -1;
  for (const piece of pieces) {
    const next = body.indexOf(piece, at + 1);
    assert.ok(next > at, `${what} draws ${piece} (in order)`);
    at = next;
  }
}
const under = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? under(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));

// ── FIXTURES ─────────────────────────────────────────────────────────────────

const BOOKS = [{ id: 'b-personal', entity_type: 'personal', name: 'Personal' }, { id: 'b-business', entity_type: 'business', name: 'Business' }];

const project = (over: Partial<Project> & { id: string; title: string }): Project => ({
  user_id: 'u', entity_id: 'b-personal', goal: null, problem: null, diagnosis: null, design: null, goal_items: [], problem_items: [], diagnosis_items: [],
  deep_research_input: null, claude_code_audit_input: null, status: 'backlog', type: null, size: null, why: null, definition_of_done: null, links: [], notes: null,
  rulings: null, open_questions: null, deadline_reason: null, rank: null, promoted_at: null, scheduled_at: null, done_at: null, target_completion_date: null,
  estimated_total_minutes: null, estimated_total_cost_usd: null, priority_score: null, priority_inputs_hash: null, priority_computed_at: null, priority_rationale: null,
  created_at: '2026-10-20T03:00:00.000Z', updated_at: '2026-10-20T03:00:00.000Z', created_by: null,
  ...over,
});
const task = (estimated_cost_usd: string | null, status: Task['status'] = 'open'): Task => ({
  id: `t-${Math.random()}`, project_id: 'p', user_id: 'u', entity_id: 'b-personal', title: 'a task', description: null, status, estimated_minutes: null, estimated_cost_usd,
  deadline: null, priority_score: null, priority_inputs_hash: null, priority_computed_at: null, priority_rationale: null, unblocks_label: null, link_url: null, notes: null,
  coa_code: null, actual_cost_usd: '55.00', actual_minutes: null, display_order: 0, completed_at: null, created_at: '2026-10-20T03:00:00.000Z', updated_at: '2026-10-20T03:00:00.000Z', created_by: null,
});
const loaded = (tasks: readonly Task[]): ProjectTasksRead => ({ kind: 'loaded', tasks });

const LONG = 'a'.repeat(100) + '😀' + 'b'.repeat(300); // 401 code points, 402 UTF-16 units — the emoji is the 101st character.
const FULL = project({
  id: 'p-full', title: 'Ship the brief table', entity_id: 'b-business', status: 'scoped', type: 'engineering', size: 'M', rank: 2,
  problem: LONG, why: 'It costs an hour a day.', goal: 'One table, every field.', rulings: 'DataTable.\nNo route.', open_questions: 'Which order?',
  target_completion_date: '2026-11-01T00:00:00.000Z', deadline_reason: 'Before the quarter closes.', definition_of_done: '26 heads in order.',
  links: ['https://a.example/prompt', 'https://b.example/pr'], notes: 'none', diagnosis: 'The two-column table hid the brief.', design: 'Spec, then the screen.',
  promoted_at: '2026-10-21T03:00:00.000Z', scheduled_at: '2026-10-22T03:00:00.000Z', done_at: null,
  estimated_total_minutes: 30, estimated_total_cost_usd: '99.00',
  ledger_allocated: { cents: 1234, dollars: '12.34', link_count: 1, line_count: 1 },
});
const BARE = project({ id: 'p-bare', title: 'Captured, nothing else' }); // no ledger_allocated at all — the rollup was not read
const NONE = project({ id: 'p-none', title: 'No links', ledger_allocated: null, rank: 10 });
const DONE = project({ id: 'p-done', title: 'Finished', status: 'completed', done_at: '2026-10-24T03:00:00.000Z' });
const ARCHIVED = project({ id: 'p-arch', title: 'Shelved', status: 'archived' });

const COLUMNS = projectTable(BOOKS);
const col = (key: ProjectColumn) => columnOf(COLUMNS, key);
const rowsOf = (projects: readonly Project[], reads: readonly (readonly [string, ProjectTasksRead])[] = []) => projectRowsOf(projects, new Map(reads));
const ROW_FULL: ProjectTableRow = rowsOf([FULL], [['p-full', loaded([task('12.50'), task(null), task('7.50', 'completed')])]])[0];

// ── RULING A · THE COLUMNS, IN ALEX'S ORDER ──────────────────────────────────

test('A the twenty-six heads, in order and no other; the brief\'s own words for the brief\'s columns; table "projects"', () => {
  assert.deepEqual(COLUMNS.map((c) => c.label), [
    'RANK', 'PROJECT', 'TYPE', 'BOOK', 'STATUS', 'TASKS', 'EST', 'ACTUAL',
    'WHAT IS WRONG TODAY', 'WHY IT MATTERS', 'THE ONE CORRECT OUTCOME', 'ALREADY RULED', 'WANT A RECOMMENDATION ON',
    'TARGET', 'WHY BY THEN', 'PROOF OF DONE', 'LINKS', 'NOTES', 'THE AUDIT', 'THE PLAN', 'SIZE',
    'CAPTURED', 'PROMOTED', 'SCHEDULED', 'DONE', 'ID',
  ]);
  assert.equal(COLUMNS.length, 26);
  assert.deepEqual(COLUMNS.map((c) => c.key), [...PROJECT_COLUMNS]);
  assert.deepEqual(Object.keys(PROJECT_HEAD_WORDS), [...PROJECT_COLUMNS]);
  assert.equal(PROJECT_TABLE_NAME, 'projects');
  // The brief's words are the capture form's, without its numbers — one source (projectBrief.ts).
  assert.equal(captureQuestion('problem').label, '1 WHAT IS WRONG TODAY');
  for (const [column, key] of [['problem', 'problem'], ['why', 'why'], ['goal', 'goal'], ['rulings', 'rulings'], ['open_questions', 'open_questions'], ['definition_of_done', 'definition_of_done'], ['links', 'links'], ['notes', 'notes'], ['size', 'size']] as const) {
    assert.equal(PROJECT_HEAD_WORDS[column], captureQuestion(key).label.replace(/^\d+ /, ''));
  }
  assert.ok(CAPTURE_QUESTIONS.some((q) => q.key === 'by_when' && q.label === '6 BY WHEN, AND WHY'), 'the capture\'s one date question is two columns here: TARGET and WHY BY THEN');
  // The kinds: RANK a number-sorted value; the brief's text whole; EST and ACTUAL money; the dates values with the ISO day under.
  const kinds = Object.fromEntries(COLUMNS.map((c) => [c.key, c.kind]));
  assert.deepEqual(kinds, {
    rank: 'value', title: 'text', type: 'value', book: 'value', status: 'value', tasks: 'text', est: 'money', actual: 'money',
    problem: 'text', why: 'text', goal: 'text', rulings: 'text', open_questions: 'text', target: 'value', deadline_reason: 'text', definition_of_done: 'text', links: 'text', notes: 'text',
    diagnosis: 'text', design: 'text', size: 'value', captured: 'value', promoted: 'value', scheduled: 'value', done: 'value', id: 'text',
  });
  // The calculated columns name their rule in the head's tooltip (ROUTINES-03's convention); the others carry none.
  assert.deepEqual(Object.keys(PROJECT_TOOLTIPS).sort(), ['actual', 'est']);
  for (const c of COLUMNS) assert.equal(c.title, PROJECT_TOOLTIPS[c.key]);
});

// ── RULING B · THE CELLS ─────────────────────────────────────────────────────

test('B RANK, PROJECT, TYPE, BOOK, STATUS, SIZE and ID — the label maps\' words, the book by name, blank "—" for a rank or a label not set; RANK sorts as a number, blanks last', () => {
  assert.equal(col('rank').words(ROW_FULL), '2');
  assert.equal(col('title').words(ROW_FULL), 'Ship the brief table');
  assert.equal(col('type').words(ROW_FULL), 'engineering');
  assert.equal(col('book').words(ROW_FULL), 'Business');
  assert.equal(col('status').words(ROW_FULL), 'scoped');
  assert.equal(col('size').words(ROW_FULL), 'medium');
  assert.equal(col('id').words(ROW_FULL), 'p-full');
  const bare = rowsOf([BARE])[0];
  for (const key of ['rank', 'type', 'size'] as const) {
    assert.equal(col(key).words(bare), BLANK, `${key} blank`);
    assert.equal(col(key).csv(bare), '', `${key} empty in the CSV`);
  }
  assert.equal(col('book').words(rowsOf([project({ id: 'x', title: 'x', entity_id: 'not-listed' })])[0]), 'book not loaded', 'a book the tab has not listed is said, never dropped');
  const rows = rowsOf([NONE, FULL, BARE]); // ranks 10, 2, null
  assert.deepEqual(sortRows(rows, { column: 'rank', direction: 'asc' }, COLUMNS).map((r) => r.id), ['p-full', 'p-none', 'p-bare'], '2 before 10 — a number, not a text');
  assert.deepEqual(sortRows(rows, { column: 'rank', direction: 'desc' }, COLUMNS).map((r) => r.id), ['p-none', 'p-full', 'p-bare'], 'blank last in both directions');
  assert.deepEqual(col('rank').sortKey(ROW_FULL), { kind: 'number', n: 2 });
  assert.equal(col('rank').csv(ROW_FULL), '2');
});

test('B TASKS — the counts by status from the row\'s tasks read, as before; "loading tasks…" while it reads; the route\'s words when it failed; "no tasks" when none', () => {
  assert.equal(col('tasks').words(ROW_FULL), statusCounts(['open', 'open', 'completed']));
  assert.equal(col('tasks').words(ROW_FULL), '2 new · 1 done');
  assert.equal(projectTasksWordsOf(rowsOf([FULL])[0]), TASKS_LOADING_WORDS, 'a project whose hook has not reported yet is reading');
  assert.equal(projectTasksWordsOf(rowsOf([FULL], [['p-full', { kind: 'loading' }]])[0]), 'loading tasks…');
  assert.equal(projectTasksWordsOf(rowsOf([FULL], [['p-full', { kind: 'failed', words: 'HTTP 500' }]])[0]), 'HTTP 500');
  assert.equal(projectTasksWordsOf(rowsOf([FULL], [['p-full', loaded([])]])[0]), NO_TASKS_WORDS);
  assert.equal(NO_TASKS_WORDS, 'no tasks');
  // A TEXT column: "contains blocked" finds the project with a blocked task.
  const rows = rowsOf([FULL, NONE], [['p-full', loaded([task(null, 'blocked')])], ['p-none', loaded([task(null)])]]);
  assert.deepEqual(filterRows(rows, withFilter(noFilters(COLUMNS), 'tasks', { contains: 'blocked' }), COLUMNS).map((r) => r.id), ['p-full']);
});

test('B EST — the SUM of the tasks\' estimates: [12.50, null, 7.50] → $20.00 and "2 of 3 tasks carry an estimate"; no estimate → blank, never 0; the same cents as THE WORK\'s ESTIMATE', () => {
  assert.deepEqual(estimateSumOf([task('12.50'), task(null), task('7.50')]), { cents: 2000, counted: 2, of: 3 });
  assert.equal(estimateCoverageWords(estimateSumOf([task('12.50'), task(null), task('7.50')])), '2 of 3 tasks carry an estimate');
  assert.equal(col('est').words(ROW_FULL), '$20.00');
  assert.equal(col('est').csv(ROW_FULL), '20.00');
  assert.deepEqual(col('est').sortKey(ROW_FULL), { kind: 'number', n: 2000 });
  assert.deepEqual(projectEstimateOf(ROW_FULL), { cents: 2000, counted: 2, of: 3 });
  assert.equal(estimateCoverageWords(estimateSumOf([task('12.50'), task('7.50')])), '2 of 2 tasks carry an estimate');
  // No estimates: blank, and the coverage says so.
  assert.deepEqual(estimateSumOf([task(null), task(null)]), { cents: null, counted: 0, of: 2 });
  assert.deepEqual(estimateSumOf([]), { cents: null, counted: 0, of: 0 });
  const unestimated = rowsOf([FULL], [['p-full', loaded([task(null)])]])[0];
  assert.equal(col('est').words(unestimated), BLANK);
  assert.equal(col('est').csv(unestimated), '');
  assert.equal(col('est').sortKey(unestimated), null);
  // Not read yet, or failed: blank.
  assert.equal(col('est').words(rowsOf([FULL])[0]), BLANK);
  assert.equal(projectEstimateOf(rowsOf([FULL], [['p-full', { kind: 'failed', words: 'x' }]])[0]), null);
  // One rule: each task's cents are THE WORK's ESTIMATE's (work.ts estimateCentsOf).
  assert.equal(estimateCentsOf({ estimated_cost_usd: '12.50' }), 1250);
  assert.equal(estimateCentsOf({ estimated_cost_usd: null }), null);
  assert.match(code(WORK), /export const taskEstimateCentsOf = \(row: TaskRow\): number \| null => estimateCentsOf\(row\.task\);/);
  // The project's own figures are NOT printed anywhere in the row — the edit view writes them through the PATCH.
  const fields = COLUMNS.map((c) => c.csv(ROW_FULL)).concat(COLUMNS.map((c) => c.words(ROW_FULL)));
  assert.ok(fields.every((f) => !/\b99\.00\b|\b30 min\b|\b30\b/.test(f)), 'estimated_total_cost_usd 99.00 and estimated_total_minutes 30 are not cells');
  assert.ok(fields.every((f) => !/55\.00/.test(f)), 'the tasks\' actual_cost_usd 55.00 is not a cell');
});

test('B ACTUAL — ledger_allocated\'s cents from the books: $12.34 with the tooltip "allocated from the books"; null (no links) and absent (rollup not read) are blank', () => {
  assert.equal(projectActualCentsOf(ROW_FULL), 1234);
  assert.equal(col('actual').words(ROW_FULL), '$12.34');
  assert.equal(col('actual').csv(ROW_FULL), '12.34');
  assert.equal(ACTUAL_TOOLTIP_WORDS, 'allocated from the books');
  for (const p of [BARE, NONE]) {
    const row = rowsOf([p])[0];
    assert.equal(projectActualCentsOf(row), null, `${p.id}: ${'ledger_allocated' in p ? 'null' : 'absent'} is blank`);
    assert.equal(col('actual').words(row), BLANK);
    assert.equal(col('actual').csv(row), '');
  }
});

test('B the brief\'s text: the spec holds it WHOLE — the filter and the sort read it, the CSV writes it; the screen previews the first 160 code points with "… (n chars)" and "all of it" / "less"', () => {
  assert.equal(col('problem').words(ROW_FULL), LONG, 'the cell\'s words are the full text');
  const problem = col('problem');
  assert.ok(problem.kind === 'text');
  assert.equal(problem.text(ROW_FULL), LONG, 'the text the contains-filter reads is the whole text');
  const preview = previewOf(LONG);
  assert.equal([...preview.shown].length, PREVIEW_CHARS);
  assert.equal(PREVIEW_CHARS, 160);
  assert.equal(preview.shown, 'a'.repeat(100) + '😀' + 'b'.repeat(59), 'the emoji is one character — never cut in half');
  assert.equal(preview.more, '… (401 chars)');
  assert.equal(EXPAND_WORDS, 'all of it');
  assert.equal(COLLAPSE_WORDS, 'less');
  assert.equal(previewOf('fits').more, null);
  // The CSV carries the whole text; "contains" reads beyond the preview.
  const csv = tableCsv(COLUMNS, [ROW_FULL]);
  assert.ok(csv.includes(LONG), 'the CSV field is the whole text');
  assert.deepEqual(filterRows([ROW_FULL], withFilter(noFilters(COLUMNS), 'problem', { contains: 'b'.repeat(200) }), COLUMNS).length, 1, 'a needle past the 160th character still matches');
  // Every brief field is its column; a field not stated, or blank, is a blank cell.
  for (const [key, text] of [['why', 'It costs an hour a day.'], ['goal', 'One table, every field.'], ['rulings', 'DataTable.\nNo route.'], ['open_questions', 'Which order?'], ['deadline_reason', 'Before the quarter closes.'], ['definition_of_done', '26 heads in order.'], ['notes', 'none'], ['diagnosis', 'The two-column table hid the brief.'], ['design', 'Spec, then the screen.']] as const) {
    assert.equal(col(key).words(ROW_FULL), text, key);
    assert.equal(col(key).csv(ROW_FULL), text, key);
  }
  const bare = rowsOf([BARE])[0];
  for (const key of ['problem', 'why', 'goal', 'rulings', 'open_questions', 'deadline_reason', 'definition_of_done', 'notes', 'diagnosis', 'design'] as const) {
    assert.equal(col(key).words(bare), BLANK, `${key} not stated`);
    assert.equal(col(key).csv(bare), '');
  }
  assert.equal(col('notes').words(rowsOf([project({ id: 'x', title: 'x', notes: '   ' })])[0]), BLANK, 'all-space is not stated');
  assert.equal(projectCellKeyOf(ROW_FULL, 'problem'), 'p-full:problem', 'one opened state per cell');
});

test('B LINKS — one per line; the CSV field carries the line break, quoted; none is blank', () => {
  assert.equal(col('links').words(ROW_FULL), 'https://a.example/prompt\nhttps://b.example/pr');
  assert.equal(col('links').csv(ROW_FULL), 'https://a.example/prompt\nhttps://b.example/pr');
  assert.equal(csvField(col('links').csv(ROW_FULL)), '"https://a.example/prompt\nhttps://b.example/pr"');
  assert.ok(tableCsv(COLUMNS, [ROW_FULL]).includes('"https://a.example/prompt\nhttps://b.example/pr"'));
  assert.equal(col('links').words(rowsOf([BARE])[0]), BLANK);
  assert.equal(col('links').csv(rowsOf([BARE])[0]), '');
});

// COLUMNS-01b (Alex, 2026-10-25, ruling 2): TARGET is a DAY (dayWords of the ISO day; the ISO day in the sort and the CSV); CAPTURED · PROMOTED ·
// SCHEDULED · DONE are EVENT INSTANTS (the viewer's local day on screen, the instant in the sort, the ISO instant as stored in the CSV).
test('B the dates — TARGET a day drawn at local midnight with its ISO day under; CAPTURED · PROMOTED · SCHEDULED · DONE event instants: the viewer\'s day on screen, the instant in the sort and the CSV; unset is blank', () => {
  assert.equal(col('target').words(ROW_FULL), dayWords('2026-11-01'));
  assert.equal(col('target').csv(ROW_FULL), '2026-11-01');
  assert.deepEqual(col('target').sortKey(ROW_FULL), { kind: 'text', t: '2026-11-01' });
  for (const [key, iso] of [['captured', '2026-10-20T03:00:00.000Z'], ['promoted', '2026-10-21T03:00:00.000Z'], ['scheduled', '2026-10-22T03:00:00.000Z']] as const) {
    assert.equal(col(key).words(ROW_FULL), instantDayWords(iso), key);
    assert.equal(col(key).csv(ROW_FULL), iso, `${key}: the instant as stored`);
    assert.deepEqual(col(key).sortKey(ROW_FULL), { kind: 'text', t: iso }, key);
  }
  assert.equal(col('done').words(ROW_FULL), BLANK);
  assert.equal(col('done').csv(ROW_FULL), '');
  assert.equal(col('done').sortKey(ROW_FULL), null);
  const done = rowsOf([DONE])[0];
  assert.equal(col('done').words(done), instantDayWords('2026-10-24T03:00:00.000Z'));
  assert.equal(col('done').csv(done), '2026-10-24T03:00:00.000Z');
  assert.equal(col('target').words(rowsOf([BARE])[0]), BLANK);
});

test('B the CSV — the twenty-six heads as the head line, the rows shown in the table\'s order, named projects_<day>.csv', () => {
  const csv = tableCsv(COLUMNS, rowsOf([FULL, BARE]));
  const lines = csv.split('\r\n');
  assert.equal(lines[0], COLUMNS.map((c) => c.label).join(','));
  assert.equal(lines.length, 1 + 2 + 1, 'a head line, two rows, and the empty piece after the trailing CRLF — the long row\'s quoted fields hold a bare LF (rulings, links), never a CRLF');
  assert.ok(csv.includes('"DataTable.\nNo route."'), 'the brief\'s own line break rides inside the quoted field');
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(projectsCsvFileName('2026-10-25'), 'projects_2026-10-25.csv');
});

// ── RULING C · THE DEFAULT CHIP ──────────────────────────────────────────────

test('C "STATUS: open only" drops every status not in OPEN_PROJECT_STATUSES — completed, cancelled, dropped; and archived once "show archived" has read them', () => {
  assert.deepEqual(projectDefault(false), { dropped: ['completed', 'cancelled', 'dropped'], words: 'STATUS: open only' });
  assert.deepEqual(projectDefault(true), { dropped: ['completed', 'cancelled', 'archived', 'dropped'], words: 'STATUS: open only' });
  assert.equal(PROJECT_DEFAULT_WORDS, 'STATUS: open only');
  // Derived from the one set: every status is open, or dropped once the archived are read.
  const statuses = Object.keys(STATUS_LABELS) as ProjectStatus[];
  for (const s of statuses) assert.equal(isOpenProjectStatus(s) || projectDefault(true).dropped.includes(STATUS_LABELS[s]), true, s);
  assert.deepEqual(statuses.filter(isOpenProjectStatus).sort(), [...OPEN_PROJECT_STATUSES].sort());
  // The chip's words: the default's while exactly its values are dropped; the values spelled out otherwise.
  assert.equal(statusChipWords(['dropped', 'completed', 'cancelled'], projectDefault(false)), 'STATUS: open only');
  assert.equal(statusChipWords(['archived', 'dropped', 'completed', 'cancelled'], projectDefault(true)), 'STATUS: open only');
  assert.equal(statusChipWords(['completed', 'cancelled'], projectDefault(false)), 'STATUS: not completed, not cancelled');
  assert.equal(statusChipWords(['completed', 'cancelled', 'dropped'], projectDefault(true)), 'STATUS: not completed, not cancelled, not dropped', 'with the archived read, three dropped is not the default');
});

test('C a completed project is dropped by default and shown when the chip is cleared, its DONE dated; archived likewise once read', () => {
  const rows = rowsOf([FULL, DONE]);
  const filters = projectDefaultFilters(COLUMNS, false);
  assert.deepEqual(filterRows(rows, filters, COLUMNS).map((r) => r.id), ['p-full']);
  assert.deepEqual(filterRows(rows, withoutStatusFilter(filters), COLUMNS).map((r) => r.id), ['p-full', 'p-done']);
  assert.equal(col('done').words(filterRows(rows, withoutStatusFilter(filters), COLUMNS)[1]), instantDayWords('2026-10-24T03:00:00.000Z'));
  const withArchived = rowsOf([FULL, DONE, ARCHIVED]);
  assert.deepEqual(filterRows(withArchived, projectDefaultFilters(COLUMNS, true), COLUMNS).map((r) => r.id), ['p-full']);
  assert.deepEqual(filterRows(withArchived, withoutStatusFilter(projectDefaultFilters(COLUMNS, true)), COLUMNS).map((r) => r.id), ['p-full', 'p-done', 'p-arch']);
  // Every other filter is off at first — only STATUS narrows.
  const off = noFilters(COLUMNS);
  for (const key of PROJECT_COLUMNS) if (key !== 'status') assert.deepEqual(filters[key], off[key], key);
});

// ── THE SCREENS (source pins) ────────────────────────────────────────────────

test('A the table is the shared DataTable named "projects" over the spec; the two-column <table> left; the rows in the GET\'s order, sorted and filtered by the idiom alone', () => {
  const t = code(TABLE);
  assert.match(t, /import DataTable from '@\/components\/table\/DataTable';/);
  assert.match(t, /const name = PROJECT_TABLE_NAME;/);
  assert.match(t, /<DataTable\n\s*name=\{name\}\n\s*columns=\{columns\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{loaded\}/);
  assert.match(t, /useMemo\(\(\) => projectTable\(entities\), \[entities\]\)/);
  assert.match(t, /const shown = sortRows\(filterRows\(rows, filters, columns\), sort, columns\);/);
  assert.match(t, /renderRow=\{renderRow\}/);
  for (const f of [TABLE, ROWS, SECTION_D, TEXT]) assert.doesNotMatch(code(f), /<table\b/, `${f} draws no table of its own`);
  for (const f of [TABLE, ROWS]) assert.doesNotMatch(code(f), /\.sort\(|projects\.filter\(/, `${f}: the GET's order; the idiom sorts and filters`);
  for (const f of under('src').filter((x) => !x.includes('/__tests__/'))) assert.doesNotMatch(code(f), /PROJECTS_TABLE_COLUMNS/, `${f} names the two-column count`);
  // The CSV: the rows shown, projects_<day>.csv; "n of m rows" under the table.
  assert.match(t, /const csv = loaded && shown\.length > 0 \? \{ name: projectsCsvFileName\(localToday\(\)\) \} : null;/);
  assert.match(t, /csv=\{csv\}/);
  assert.match(t, /\{loaded && rows\.length > 0 && <p className="text-xs text-text-muted" \{\.\.\.dataAttr\(name, 'count'\)\}>\{rowCountWords\(shown\.length, rows\.length\)\}<\/p>\}/);
  // Nothing stored in the browser.
  for (const f of [TABLE, ROWS, SECTION_D]) assert.doesNotMatch(code(f), /localStorage|sessionStorage|document\.cookie/, f);
});

test('B the row: the spec\'s cells through the shared WorkCell — a TEXT cell through previewOf with "all of it" / "less", EST and ACTUAL with their tooltips — then "details"; the details row is ProjectRow with every prop, spanning the columns', () => {
  const r = code(ROWS);
  assert.match(r, /\{columns\.map\(\(c\) => <ProjectCell key=\{c\.key\} column=\{c\} row=\{row\} open=\{opened\.has\(projectCellKeyOf\(row, c\.key\)\)\} onToggle=\{\(\) => onToggleCell\(projectCellKeyOf\(row, c\.key\)\)\} \/>\)\}/);
  // COLUMNS-01 (Alex, 2026-10-25, ruling D): the text cell is the shared one (components/table/TextCell.tsx — the journal tables' own, lifted); the copy left.
  assert.match(r, /if \(column\.kind === 'text'\) return <TextCell name=\{name\} column=\{column\.key\} text=\{column\.text\(row\)\} open=\{open\} onToggle=\{onToggle\} \/>;/);
  assert.match(r, /import TextCell from '@\/components\/table\/TextCell';/);
  assert.doesNotMatch(r, /function TextCell\(|const link = /, 'no copy of the cell');
  assert.match(r, /title=\{sum !== null && sum\.of > 0 \? estimateCoverageWords\(sum\) : undefined\}/);
  assert.match(r, /title=\{projectActualCentsOf\(row\) === null \? undefined : ACTUAL_TOOLTIP_WORDS\}/);
  assert.match(r, /return <WorkCell name=\{name\} column=\{column\} row=\{row\} \/>;/);
  assert.match(code(SHARED), /title\?: string/, 'the shared cell takes the tooltip');
  assert.match(code(SHARED), /title=\{title\}/);
  const text = code('src/components/table/TextCell.tsx');
  assert.match(text, /const preview = previewOf\(text\);/);
  assert.match(text, /\{open \|\| preview\.more === null \? text : preview\.shown\}/);
  assert.match(text, /\{!open && <span className="text-text-faint"> \{preview\.more\}<\/span>\}/);
  assert.match(text, /<button type="button" className=\{link\} onClick=\{onToggle\} \{\.\.\.dataAttr\(name, 'cell-toggle'\)\}>\{open \? COLLAPSE_WORDS : EXPAND_WORDS\}<\/button>/);
  assert.match(r, /\{detailsOpen \? HIDE_DETAILS_WORDS : DETAILS_WORDS\}/);
  assert.equal(DETAILS_WORDS, 'details');
  assert.equal(HIDE_DETAILS_WORDS, 'hide details');
  const details = r.slice(r.indexOf('{detailsOpen && ('));
  inOrder(details, [
    "<tr {...dataAttr(name, 'details', row.id)}>", '<td colSpan={columns.length + 1}', '<ProjectRow', 'project={project}', 'entities={entities}',
    'allProjects={allProjects}', 'onUpdate={projectChanged}', 'onDelete={projectChanged}', 'isJumpTarget={isJumpTarget}',
    'onClearTarget={onClearTarget}', 'onJumpTo={onJumpTo}', 'defaultExpanded', 'onTasksChanged={bump}',
  ], 'the details row');
  assert.doesNotMatch(details, /withoutTaskSection/, 'WORK-01d: the details list the project\'s tasks');
  assert.match(r, /useEffect\(\(\) => \{\n\s*if \(isJumpTarget\) setDetailsOpen\(true\);\n\s*\}, \[isJumpTarget\]\);/);
  assert.match(code(TABLE), /isJumpTarget=\{targetProjectId === row\.id\}/);
  // The spec reads the one preview rule (journalTables.ts) and the one default-chip rule (work.ts) — shared, not copied.
  const s = code(SPEC);
  assert.match(s, /export \{ COLLAPSE_WORDS, EXPAND_WORDS, PREVIEW_CHARS, previewMoreWords, previewOf \} from '@\/lib\/table\/preview';/); // COLUMNS-01b (2026-10-25, ruling 3)
  assert.match(s, /defaultFiltersOf\(columns, 'status', projectDefault\(archivedRead\)\)/);
  assert.match(s, /bookNameOf, dayWords, defaultFiltersOf, estimateCentsOf, instantColumn, isoDayOf, moneyColumn, textColumn, valueColumn, type NamedDefault, type WorkBook,\n\} from '@\/lib\/operations\/work';/); // COLUMNS-01 (2026-10-25): dayWords; COLUMNS-01b: instantColumn
  assert.doesNotMatch(s, /function valueColumn|function textColumn|function moneyColumn|PREVIEW_CHARS = |function previewOf/, 'no second copy of a shared rule');
  for (const name of ['valueColumn', 'textColumn', 'moneyColumn']) assert.match(code(WORK), new RegExp(`export function ${name}<Row, Key extends string>\\(`), `work.ts exports ${name}`);
  assert.doesNotMatch(s, /import .* from 'react'|fetch\(|new Date\(\)/, 'pure');
});

test('C the chip is VISIBLE in the controls row — "STATUS: open only" at first, cleared by its click; "show archived" starts the filters over for what the read now returns', () => {
  const t = code(TABLE);
  assert.match(t, /useState<TableFilters>\(\(\) => projectDefaultFilters\(columns, showArchived\)\)/);
  assert.match(t, /useEffect\(\(\) => \{ setFilters\(projectDefaultFilters\(columns, showArchived\)\); \}, \[showArchived\]\);/);
  assert.match(t, /filterOn\(filters, 'status', 'value'\) && \(\n\s*<button type="button" className=\{chipOn\} onClick=\{\(\) => setFilters\(withoutStatusFilter\(filters\)\)\} \{\.\.\.dataAttr\(name, 'status-chip'\)\}>\n\s*\{statusChipWords\(statusDroppedOf\(filters\), projectDefault\(showArchived\)\)\} \{CLEAR_CHIP_MARK\}/);
  // The read is the section's, unchanged (ruling E): include_archived by the checkbox; the table shows what it loaded, its loading and nothing-yet lines inside it.
  const d = code(SECTION_D);
  assert.match(d, /if \(showArchived\) params\.set\('include_archived', 'true'\);/);
  assert.equal((d.match(/show archived/g) ?? []).length, 1);
  assert.match(d, /\+ new project/);
  assert.match(d, /<ProjectCreateForm/);
  assert.match(d, /\{projects\.length\} \{projects\.length === 1 \? 'project' : 'projects'\}/, 'the header\'s count is the rows loaded');
  inOrder(d, ['<ProjectsTable', 'projects={projects}', 'entities={entities}', 'loaded={!loading}', 'showArchived={showArchived}', 'onProjectsChanged={fetchProjects}', 'loading projects…', 'no projects yet', '</ProjectsTable>'], 'the section mounts the table once, its words inside');
  assert.equal((d.match(/<ProjectsTable/g) ?? []).length, 1);
  assert.match(comments(SECTION_D), /PROJECTS-02 \(Alex, 2026-10-25\) — PROJECTS IS THE BRIEF AS A TABLE\./);
});

test('E the reads are unchanged — one useProjectTasks per project LOADED (the reader, mounted whether or not the row is shown), the same arguments; no route, no schema, no migration', () => {
  const r = code(ROWS);
  assert.match(r, /export function ProjectTasksReader\(\{ project, showArchived, onRead \}: ReaderProps\) \{\n\s*const \{ version \} = useWorkChanges\(\);\n\s*const t = useProjectTasks\(\{ projectId: project\.id, entity_id: project\.entity_id, showArchived, refreshKey: version \}\);/);
  assert.match(r, /onRead\(project\.id, t\.loading \? \{ kind: 'loading' \} : t\.error !== null \? \{ kind: 'failed', words: t\.error \} : \{ kind: 'loaded', tasks: t\.tasks \}\);/);
  assert.match(r, /\}, \[onRead, project\.id, t\.loading, t\.error, t\.tasks\]\);\n\s*return null;/);
  assert.match(code(TABLE), /\{projects\.map\(\(p\) => <ProjectTasksReader key=\{p\.id\} project=\{p\} showArchived=\{showArchived\} onRead=\{onRead\} \/>\)\}/);
  assert.match(code(TABLE), /const rows: readonly ProjectTableRow\[\] = useMemo\(\(\) => projectRowsOf\(projects, reads\), \[projects, reads\]\);/);
  assert.equal((r.match(/useProjectTasks\(/g) ?? []).length, 1, 'one call — the reader\'s');
  for (const f of [TABLE, ROWS, SECTION_D]) assert.doesNotMatch(code(f), /include_archived=true/, `${f} hard-codes no read switch — useProjectTasks and the section's checkbox carry it`);
  for (const f of [PROJECTS_ROUTE, TASKS_ROUTE, SCHEMA]) assert.doesNotMatch(code(f) + comments(f), /PROJECTS-02/, `${f} is untouched`);
  assert.equal(readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /projects[_-]?02/i.test(d)).length, 0, 'no migration');
});

test('D a project update in the details — save, scope, archive, unarchive, delete — re-reads the projects AND bumps the page\'s WorkChanges signal, so THE WORK re-reads without a reload', () => {
  const r = code(ROWS);
  assert.match(r, /const \{ bump \} = useWorkChanges\(\);/);
  assert.match(r, /const projectChanged = \(\) => \{\n\s*onProjectsChanged\(\);\n\s*bump\(\);\n\s*\};/);
  assert.match(r, /onUpdate=\{projectChanged\}\n\s*onDelete=\{projectChanged\}/);
  assert.doesNotMatch(r, /onUpdate=\{onProjectsChanged\}|onDelete=\{onProjectsChanged\}/, 'neither callback skips the bump');
  // ProjectRow fires onUpdate from each of its writes and onDelete from the delete (the callbacks are the existing ones — none added).
  const pr = code(`${OPS}/projects/ProjectRow.tsx`);
  assert.ok((pr.match(/onUpdate\(\);/g) ?? []).length >= 5, 'save, scope it, save inputs, evolve, archive, unarchive call onUpdate');
  assert.match(pr, /onDelete\(\);/);
  // Only THE WORK and PROJECTS' rows read the signal (work01 pins the pair); the reader reads the version, the row the bump.
  assert.equal((r.match(/useWorkChanges\(\)/g) ?? []).length, 2);
  assert.match(comments(LAW), /PROJECTS-02 \(Alex, 2026-10-25\): PROJECTS is the shared DataTable too/);
  assert.match(code(LAW), /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>', '<SectionF_RoutineExpenses \/>'\];/, 'the two-lists mount is unchanged');
});
