/**
 * PROJECTS-01 (2026-09-30) — THE PROJECTS ARE ONE TABLE.
 *
 * Every task of every project on screen at once, a row per task under its
 * project, the project's detail one click away as a full-width row, codes as
 * account strings. The table's words are pure and DRIVEN over fixtures; the
 * table is client components, so — the repo's TEST-TRUTH-01 way — it is anchored
 * to its source with comments stripped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  NOTES_PREVIEW_CHARS, PROJECTS_TABLE_COLUMNS, UNLABELED_STATUS_PILL,
  costPair, formatDate, minutesPair, notesPreview, requestsWords, statusCounts, taskStatusPill, taskStatusWords,
} from '@/components/workbench/operations/projects/projectsTableText';
import { TASK_STATUS_LABELS, TASK_STATUS_PILL_CLASSES } from '@/components/workbench/operations/projects/types';

const OPS = 'src/components/workbench/operations';
const P = `${OPS}/projects`;
const SECTION_D = `${OPS}/SectionD_ProjectBacklog.tsx`;
const TABLE = `${P}/ProjectsTable.tsx`;
const ROWS = `${P}/ProjectTableRows.tsx`;
// WORK-01 (Alex, 2026-10-24): TaskTableRow left — the task rows are THE WORK's (SectionE_Work), their one home; the pins below moved there.
const SECTION_E = `${OPS}/SectionE_Work.tsx`;
const TEXT = `${P}/projectsTableText.ts`;
const TASK_ACTIONS = `${P}/useTaskActions.ts`;
const PROJECT_TASKS = `${P}/useProjectTasks.ts`;
const PARTS = [`${P}/TaskEditInputs.tsx`, `${P}/TaskScheduleMenu.tsx`, `${P}/TaskHistoryList.tsx`, `${P}/TaskCreateInputs.tsx`];
const ROW_VIEW = `${P}/TaskRowView.tsx`;
const LIST_VIEW = `${P}/TaskListView.tsx`;
const TASK_ROW_CONTAINER = `${P}/TaskRow.tsx`;
const TASK_LIST_CONTAINER = `${P}/TaskList.tsx`;
const PROJECT_ROW = `${P}/ProjectRow.tsx`;
const TABLE_FILES = [TABLE, ROWS, TEXT, ...PARTS];

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) out.push(...tsFilesUnder(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** Each piece found in order, each after the last. */
function inOrder(body: string, pieces: string[], what: string) {
  let at = -1;
  for (const piece of pieces) {
    const next = body.indexOf(piece, at + 1);
    assert.ok(next > at, `${what} draws ${piece} (in order)`);
    at = next;
  }
}

// ── T1 · THE TABLE'S WORDS (pure, driven) ────────────────────────────────────

test('T1 the notes: in full when they fit, else the first 160 characters and how many — never a character cut in half', () => {
  assert.equal(NOTES_PREVIEW_CHARS, 160);
  assert.deepEqual(notesPreview('call the bank'), { shown: 'call the bank', more: null });
  const exactly = 'x'.repeat(160);
  assert.deepEqual(notesPreview(exactly), { shown: exactly, more: null }, '160 is not longer than 160');
  const longer = 'y'.repeat(161);
  assert.deepEqual(notesPreview(longer), { shown: 'y'.repeat(160), more: '… (161 chars — all of it in edit)' });
  const emoji = `${'z'.repeat(159)}🎬🎬`;
  assert.deepEqual(notesPreview(emoji), { shown: `${'z'.repeat(159)}🎬`, more: '… (161 chars — all of it in edit)' });
});

test('T1 a status in TASK_STATUS_LABELS\' words — and an unlabeled one (superseded) shows its raw value, never blank', () => {
  for (const [status, label] of Object.entries(TASK_STATUS_LABELS)) {
    assert.equal(taskStatusWords(status), label);
    assert.equal(taskStatusPill(status), TASK_STATUS_PILL_CLASSES[status as keyof typeof TASK_STATUS_PILL_CLASSES]);
  }
  assert.equal(taskStatusWords('superseded'), 'superseded');
  assert.equal(taskStatusPill('superseded'), UNLABELED_STATUS_PILL);
  assert.equal(taskStatusWords('toString'), 'toString', 'an inherited name is not a label');
  // The database allows it; the client's union does not name it — which is why the raw value is drawn.
  assert.match(code('prisma/schema.prisma'), /enum OperationsTaskStatus \{[^}]*\bsuperseded\b/);
  assert.equal(Object.prototype.hasOwnProperty.call(TASK_STATUS_LABELS, 'superseded'), false);
});

test('T1 the tasks counted by status, in the labels\' words and the order the read returns them', () => {
  assert.equal(statusCounts(['pending_review', 'open', 'open', 'open', 'completed', 'completed']), '1 pending review · 3 new · 2 done');
  assert.equal(statusCounts(['open', 'superseded', 'open']), '2 new · 1 superseded');
  assert.equal(statusCounts([]), '');
  assert.equal(requestsWords(0), '0 requests');
  assert.equal(requestsWords(1), '1 request');
  assert.equal(requestsWords(3), '3 requests');
});

test('T1 minutes and cost: est · actual, a blank side is "—" — never 0, never $0', () => {
  assert.equal(minutesPair(30, 45), 'est 30 · actual 45');
  assert.equal(minutesPair(null, 45), 'est — · actual 45');
  assert.equal(minutesPair(0, null), 'est 0 · actual —', 'a saved 0 is 0; a blank is —');
  assert.equal(costPair('12.50', '9.99'), 'est $12.50 · actual $9.99');
  assert.equal(costPair(null, null), 'est — · actual —');
  assert.equal(costPair('0.00', ''), 'est $0.00 · actual —');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('2026-10-01T00:00:00.000Z'), new Date('2026-10-01T00:00:00.000Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
  // The date is the task row's own four lines, copied as R3 allows.
  const view = code(ROW_VIEW);
  const text = code(TEXT);
  const body = (src: string) => /function formatDate\(iso: string \| null\): string \{([\s\S]*?)\n\}/.exec(src)?.[1];
  assert.ok(body(view) && body(view) === body(text), 'formatDate is the view\'s, line for line');
});

// ── T1 · THE TABLE (source pins) ─────────────────────────────────────────────

test('T1 one table: Project · Tasks (WORK-01, 2026-10-24: the task columns left with the task rows — THE WORK is their one home)', () => {
  const table = code(TABLE);
  assert.equal((table.match(/<table\b/g) ?? []).length, 1);
  for (const f of [SECTION_D, ROWS, ...PARTS]) assert.doesNotMatch(code(f), /<table\b/, `${f} draws rows of the one table`);
  const heads = [...table.matchAll(/<th\b[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(heads, ['Project', 'Tasks']);
  assert.equal(PROJECTS_TABLE_COLUMNS, heads.length);
  // The projects in the order the GET returns them — no sort, no filter on the way.
  assert.match(table, /\{projects\.map\(\(p\) => \(\n\s*<ProjectTableRows\n\s*key=\{p\.id\}/);
  for (const f of [TABLE, ROWS]) assert.doesNotMatch(code(f), /\.sort\(|projects\.filter\(/);
  const d = code(SECTION_D);
  assert.match(d, /setProjects\(body\.projects \?\? \[\]\);/);
  assert.match(d, /<ProjectsTable\n\s*projects=\{projects\}/);
  // The header, the create form above the table, and the error, loading and empty lines stay.
  inOrder(d, ['Projects', "{projects.length === 1 ? 'project' : 'projects'}", 'show archived', '+ new project', '{error && (', '<ProjectCreateForm', 'loading projects…', 'no projects yet', '<ProjectsTable'], 'the section');
  assert.equal(existsSync(resolve(process.cwd(), `${P}/TaskTableRow.tsx`)), false, 'the task row left with the task rows (WORK-01)');
});

test('T1 the queue card is gone — deleted, imported by nothing', () => {
  assert.equal(existsSync(resolve(process.cwd(), `${P}/ProjectQueueCard.tsx`)), false);
  const self = 'src/lib/__tests__/projects01.test.ts';
  const mentions = [...tsFilesUnder('src'), ...tsFilesUnder('scripts')].filter((f) => f !== self && /ProjectQueueCard/.test(code(f)));
  assert.deepEqual(mentions, []);
});

test('T1 nothing collapses: no ▸/▾ and no expanded state in the table\'s files', () => {
  for (const f of [SECTION_D, ...TABLE_FILES]) {
    const body = code(f);
    assert.doesNotMatch(body, /[▸▾]/, `${f} draws no expand arrow`);
    // The two sanctioned words: the detail's own prop, and the details button's a11y state.
    const rest = body.replace(/\bdefaultExpanded\b/g, '').replace(/aria-expanded=/g, '');
    assert.doesNotMatch(rest, /xpanded/, `${f} holds no expanded state`);
    assert.doesNotMatch(body, /<(tr|tbody|td)\b[^>]*onClick/, `${f}: no row opens on a click`);
  }
});

test('T1 the project cell: title, pill, book, the small print, and details; the Tasks cell counts by status (WORK-01: "+ task" and the task rows are THE WORK\'s)', () => {
  const rows = code(ROWS);
  const cell = rows.slice(rows.indexOf('const projectCell = ('), rows.indexOf('\n  );\n', rows.indexOf('const projectCell = (')));
  assert.match(cell, /<td className="[^"]*" data-project-cell>/);
  inOrder(cell, [
    '{project.title}',
    'STATUS_PILL_CLASSES[project.status]',
    '{STATUS_LABELS[project.status]}',
    '{book ? book.name : ACCOUNT_CELL_WORDS.bookNotLoaded}',
    'target {formatDate(project.target_completion_date)}',
    '{project.estimated_total_minutes !== null && ',
    'est {project.estimated_total_minutes} min',
    '{!isBlankPlanValue(project.estimated_total_cost_usd) && ',
    'est ${project.estimated_total_cost_usd}',
    '{project.run_count !== undefined && ',
    '{requestsWords(project.run_count)}',
    '{project.ledger_allocated && (',
    'title="allocated from ledger"',
    '{formatAllocatedCents(project.ledger_allocated.cents)}',
    'onClick={() => setDetailsOpen((x) => !x)}',
    "{detailsOpen ? 'hide details' : 'details'}",
  ], 'the project cell');
  assert.match(rows, /const book = entities\.find\(\(e\) => e\.id === project\.entity_id\);/);
  assert.doesNotMatch(cell, /\?\? 0|task_count/, 'no count is imputed: requests are drawn only when the GET sent them');
  assert.doesNotMatch(cell, /\+ task|startCreate|statusCounts/, 'WORK-01: no "+ task" on the project row; the counts moved to the Tasks cell');
  // One row per project: the cell, then the Tasks cell — loading, the error, "no tasks", or the counts by status.
  assert.match(rows, /<tr data-project-row>\n\s*\{projectCell\}/);
  assert.match(rows, /data-project-tasks>\n\s*\{t\.loading \? \(\n\s*<span className="italic">loading tasks…<\/span>\n\s*\) : t\.error \? \(/);
  assert.match(rows, /\) : t\.tasks\.length === 0 \? \(\n\s*<span className="italic">no tasks<\/span>\n\s*\) : \(\n\s*<span data-project-status-counts>\{statusCounts\(t\.tasks\.map\(\(task\) => task\.status\)\)\}<\/span>/);
  assert.doesNotMatch(rows, /rowSpan|openRows|editIds|historyIds|projectCell=\{i === 0/);
});

test('T1 a task row is THE WORK\'s (WORK-01, 2026-10-24): the spec\'s cells, then edit · ↗ schedule · history · archive/unarchive · delete — TaskTableRow left, named by nothing', () => {
  assert.equal(existsSync(resolve(process.cwd(), `${P}/TaskTableRow.tsx`)), false);
  for (const f of [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components')]) assert.doesNotMatch(code(f), /TaskTableRow/, `${f} names the task row`);
  const row = code(SECTION_E).slice(code(SECTION_E).indexOf('function TaskWorkRow('));
  const tr = row.slice(row.indexOf('<tr className='), row.indexOf('</tr>'));
  inOrder(tr, [
    '{columns.map((c) => <WorkCell key={c.key} name={name} column={c} row={row} />)}', // WORK-01d (2026-10-25): the cell is shared by the two tables (workShared.tsx) and takes the table's name
    'onClick={a.enterEdit}',
    '↗ schedule',
    'onClick={() => a.handleToggleHistory()}',
    "task.status === 'archived' ? (",
    'onClick={a.handleUnarchive}',
    'onClick={a.handleArchive}',
    'onClick={a.handleDelete}',
  ], 'the task row');
  // Its words are the pure spec's (work01.test.ts): the title, the project, the status words, the deadline, the account through the helper.
  const w = code('src/lib/operations/work.ts');
  assert.match(w, /export const taskStatusOf = \(row: TaskRow\): string => taskStatusWords\(row\.task\.status\);/); // WORK-01d (2026-10-25): a TaskRow, no `of` — the tasks have their own table
  assert.match(w, /import \{ formatDate, taskStatusWords \} from '@\/components\/workbench\/operations\/projects\/projectsTableText';/);
});

test('T1 the quick actions are exactly today\'s — each on the statuses it shows for now', () => {
  const row = code(SECTION_E).slice(code(SECTION_E).indexOf('function TaskWorkRow('));
  const view = code(ROW_VIEW);
  for (const [guard, label] of [
    ["task.status === 'pending_review'", '✓ accept'],
    ["task.status === 'pending_review'", '✕ reject'],
    ["task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'pending_review'", '✓ complete'],
    ["task.status === 'completed'", '↩ uncomplete'],
    ["task.status !== 'completed' && task.status !== 'cancelled'", '↗ schedule'],
  ] as const) {
    for (const [f, body] of [[SECTION_E, row], [ROW_VIEW, view]] as const) {
      const at = body.indexOf(label);
      assert.ok(at > -1, `${f} offers ${label}`);
      // The status guard nearest before the label is exactly this one — no other status test between.
      const nearest = body.lastIndexOf('{task.status', at);
      const after = body.slice(nearest + 1 + guard.length);
      assert.ok(
        body.startsWith(`{${guard}`, nearest) && (after.startsWith(' && (') || after.startsWith(' && onAcceptPending && onRejectPending && (')),
        `${f} shows ${label} on ${guard}`,
      );
    }
  }
  assert.match(row, /onClick=\{a\.handleAcceptPending\}/);
  assert.match(row, /onClick=\{a\.handleRejectPending\}/);
  assert.match(row, /onClick=\{a\.handleQuickComplete\}/);
  assert.match(row, /onClick=\{\(\) => a\.handleUncomplete\(\)\}/);
});

test('T1 the Account column only through ROUTINES-01\'s helper — P-6110, never 6110, never B-B-5130 (WORK-01: THE WORK\'s ACCOUNT reads it in work.ts)', () => {
  const w = code('src/lib/operations/work.ts');
  assert.match(w, /import \{ ACCOUNT_CELL_WORDS, accountCell, type AccountCellBook \} from '@\/lib\/coa\/accountCell';/);
  assert.match(w, /const cell = accountCell\(books, bookId, savedCode\);/); // WORK-01d (2026-10-25): one helper call under both tables' ACCOUNT (accountWordsOf takes the book and the saved code)
  assert.equal((w.match(/accountCell\(/g) ?? []).length, 1);
  assert.match(w, /if \(cell\.state === 'blank'\) return null;\n\s*if \(cell\.state !== 'account'\) return cell\.text;/, 'the helper\'s states, as it states them');
  for (const f of TABLE_FILES.filter((x) => !PARTS.includes(x))) {
    const body = code(f);
    assert.doesNotMatch(body, /\{\s*task\.coa_code\s*\}/, `${f} draws a saved code verbatim`);
    assert.doesNotMatch(body, /deriveAccountString|parseCode/, `${f} restates the helper`);
  }
  for (const f of [TABLE, ROWS, SECTION_D, SECTION_E]) assert.doesNotMatch(code(f), /coa_code/);
});

test('T1 editing in place: edit, + task, ↗ schedule and history open where the task is', () => {
  // WORK-01 (2026-10-24): where the task is, is THE WORK's row.
  const row = code(SECTION_E).slice(code(SECTION_E).indexOf('function TaskWorkRow('));
  const trEnd = row.indexOf('</tr>');
  // ↗ schedule: today's date menu, ON the task's row.
  const menuAt = row.indexOf('{a.scheduleMenuOpen && (\n            <TaskScheduleMenu');
  assert.ok(menuAt > -1 && menuAt < trEnd, 'the date menu is on the task\'s row');
  // history, then edit: each a row directly under the task, across the task's columns.
  inOrder(row.slice(trEnd), [
    '{a.showHistory && (', "<tr {...dataAttr(name, 'history', row.id)}>", '<td colSpan={columns.length + 1}', '<TaskHistoryList history={a.history} historyLoading={a.historyLoading} historyError={a.historyError} />',
    '{a.editing && (', "<tr {...dataAttr(name, 'editing', row.id)}>", '<td colSpan={columns.length + 1}', '<TaskEditInputs',
    'form={a.form}', 'coaAccounts={coaAccounts}', 'onSave={a.handleSave}', 'onCancelEdit={a.cancelEdit}',
  ], 'the rows under a task');
  // The edit opens today's inputs, prefilled by taskToForm; history is read only when asked.
  const actions = code(TASK_ACTIONS);
  assert.match(actions, /export function taskToForm\(t: Task\): TaskForm \{/);
  assert.match(actions, /const enterEdit = \(\) => \{\n\s*setForm\(taskToForm\(task\)\);\n\s*setEditing\(true\);/);
  assert.match(actions, /setShowHistory\(true\);\n\s*if \(history !== null\) return;\s*\n\s*setHistoryLoading\(true\);/);
  // + task: today's create inputs, a row at the end of the project's rows, before the details.
  // WORK-01 (2026-10-24, ruling 3): "+ task" is THE WORK's — the task form under a required project select, posting the same create.
  const work = code(SECTION_E);
  inOrder(work, ['function NewTaskForm(', "dataAttr(name, 'task-project')", '<TaskCreateInputs', 'onCreate={handleCreate}'], 'THE WORK\'s new task');
  assert.doesNotMatch(code(ROWS), /TaskCreateInputs|data-project-create-task|\+ task/);
  // The parts the table renders are the SAME the views render.
  assert.match(code(ROW_VIEW), /<TaskScheduleMenu\n/);
  assert.match(code(ROW_VIEW), /<TaskHistoryList history=\{history\}/);
  assert.match(code(ROW_VIEW), /<TaskEditInputs\n/);
  assert.match(code(LIST_VIEW), /<TaskCreateInputs\n/);
  // Every refusal is the route's own message where the row is — the build-fire error and the notice included.
  assert.match(actions, /setError\(body\?\.message \?\? body\?\.error \?\? `failed to \$\{verb\}`\);/);
  assert.match(actions, /if \(newStatus === 'open'\) setReviewNotice\('building… PR incoming'\);/);
  assert.match(row, /\{a\.reviewNotice && \(\n\s*<div[^>]*>\{a\.reviewNotice\}<\/div>/);
  assert.match(row, /\{a\.error && !a\.editing && \(\n\s*<div[^>]*>\{a\.error\}<\/div>/);
  assert.match(code(PARTS[0]), /\{error && \(\n\s*<div[^>]*>\n\s*\{error\}/);
  assert.match(code(PARTS[3]), /\{createError && \(\n\s*<div[^>]*>\n\s*\{createError\}/);
});

test('T1 ONE "show archived": the section\'s toggle reaches every project\'s tasks read', () => {
  const d = code(SECTION_D);
  assert.equal((d.match(/show archived/g) ?? []).length, 1);
  assert.match(d, /if \(showArchived\) params\.set\('include_archived', 'true'\);/);
  assert.match(d, /showArchived=\{showArchived\}/);
  assert.match(code(TABLE), /showArchived=\{showArchived\}/);
  assert.match(code(ROWS), /useProjectTasks\(\{ projectId: project\.id, entity_id: project\.entity_id, showArchived, refreshKey: version \}\)/); // WORK-01b (2026-10-24): the page's task-change signal
  assert.match(code(PROJECT_TASKS), /`\/api\/operations\/projects\/\$\{projectId\}\/tasks\$\{showArchived \? '\?include_archived=true' : ''\}`/);
  for (const f of TABLE_FILES) {
    assert.doesNotMatch(code(f), /show archived|onShowArchivedChange|type="checkbox"/, `${f} carries no second archived toggle`);
  }
});

// WORK-01d (Alex, 2026-10-25, ruling B): the details keep their task list again — THE WORK reads only the OPEN projects' tasks, so a task of an
// archived, completed, dropped or cancelled project has its home in PROJECTS → show archived → the row's details. `withoutTaskSection` left the
// mount (the prop stays on ProjectRow, pinned below, unused here).
test('T1 details: ProjectRow with its task section, a full-width row under the project; its callback re-reads the tasks', () => {
  const rows = code(ROWS);
  const details = rows.slice(rows.indexOf('{detailsOpen && ('));
  inOrder(details, [
    '<tr data-project-details>', '<td colSpan={PROJECTS_TABLE_COLUMNS}', '<ProjectRow', 'project={project}', 'entities={entities}',
    'allProjects={allProjects}', 'onUpdate={onProjectsChanged}', 'onDelete={onProjectsChanged}', 'isJumpTarget={isJumpTarget}',
    'onClearTarget={onClearTarget}', 'onJumpTo={onJumpTo}', 'defaultExpanded',
    'onTasksChanged={bump}', // WORK-01b (2026-10-24): bumps the page's signal
  ], 'the details row');
  assert.doesNotMatch(details, /withoutTaskSection/, 'WORK-01d: the details list the project\'s tasks');
  // A dependency jump opens the target's details; ProjectRow scrolls to itself.
  assert.match(rows, /useEffect\(\(\) => \{\n\s*if \(isJumpTarget\) setDetailsOpen\(true\);\n\s*\}, \[isJumpTarget\]\);/);
  assert.match(code(TABLE), /isJumpTarget=\{targetProjectId === p\.id\}/);
  assert.match(code(SECTION_D), /onJumpTo=\{setTargetProjectId\}/);
  const pr = code(PROJECT_ROW);
  assert.match(pr, /rowRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\);/);
  // ProjectRow's two props: no task section in either mode; the callback where its tasks change.
  assert.equal((pr.match(/taskSection=\{withoutTaskSection \? null : <TaskList projectId=\{project\.id\} entity_id=\{project\.entity_id\} refreshKey=\{taskRefresh\} \/>\}/g) ?? []).length, 2);
  assert.match(pr, /setTaskRefresh\(\(n\) => n \+ 1\);\s*onTasksChangedRef\.current\?\.\(\);/);
  assert.equal((pr.match(/onTasksAccepted=\{\(\) => \{ setTasksPreview\(null\); setTasksGenError\(null\); onTasksChanged\?\.\(\); \}\}/g) ?? []).length, 2);
  // The views keep rendering {taskSection}, unchanged.
  assert.match(code(`${P}/ProjectRowView.tsx`), /\{taskSection\}/);
  assert.match(code(`${P}/TruthMachineView.tsx`), /\{taskSection\}/);
});

test('T1 one writer per action: the handlers\' one home is the two hooks — no fetch in the table\'s files', () => {
  for (const f of [...TABLE_FILES, TASK_ROW_CONTAINER, TASK_LIST_CONTAINER]) {
    assert.doesNotMatch(code(f), /\bfetch\s*\(/, `${f} fires no fetch of its own`);
  }
  const actions = code(TASK_ACTIONS);
  assert.equal((actions.match(/\bfetch\s*\(/g) ?? []).length, 9, 'save, complete, history, uncomplete, schedule, delete, archive, unarchive, accept/reject');
  for (const h of ['handleSave', 'handleQuickComplete', 'handleToggleHistory', 'handleUncomplete', 'handleSchedule', 'handleDelete', 'handleArchive', 'handleUnarchive', 'handleAcceptPending', 'handleRejectPending']) {
    assert.match(actions, new RegExp(`const ${h} = `), `${h} lives in the hook`);
    assert.match(code(TASK_ROW_CONTAINER), new RegExp(`=\\{a\\.${h}\\}`), `the task row fires the hook's ${h}`);
  }
  for (const h of ['handleSave', 'handleQuickComplete', 'handleDelete', 'handleArchive', 'handleUnarchive', 'handleAcceptPending', 'handleRejectPending', 'handleSchedule']) {
    assert.match(code(SECTION_E), new RegExp(`=\\{a\\.${h}\\}`), `THE WORK fires the hook's ${h}`);
  }
  assert.match(code(SECTION_E), /const a = useTaskActions\(/);
  assert.match(code(TASK_ROW_CONTAINER), /const a = useTaskActions\(/);
  const projectTasks = code(PROJECT_TASKS);
  assert.equal((projectTasks.match(/\bfetch\s*\(/g) ?? []).length, 3, 'the tasks read, the category list, the create');
  assert.match(projectTasks, /fetch\(`\/api\/chart-of-accounts\?entity_id=\$\{encodeURIComponent\(entity_id\)\}`\)/);
  assert.match(code(ROWS), /const t = useProjectTasks\(/);
  assert.match(code(TASK_LIST_CONTAINER), /const t = useProjectTasks\(/);
  // Every task route the handlers call is called from one file in the app.
  for (const route of ['/history`', '/uncomplete`']) {
    const callers = [...tsFilesUnder('src/components'), ...tsFilesUnder('src/app')].filter((f) => !f.startsWith('src/app/api/') && code(f).includes(route) && /operations\/projects/.test(code(f)));
    assert.deepEqual(callers, [TASK_ACTIONS], `${route} has one home`);
  }
});

test('T1 the four parts are pure and on the showroom law\'s list; the views render them where the blocks were', () => {
  for (const f of PARTS) {
    const body = code(f);
    assert.doesNotMatch(body, /\bfetch\s*\(|\buseEffect\s*\(|\buseOperationsEntity\s*\(|['"`]\/api\//, `${f} is props only`);
  }
  const law = code('scripts/assert-showroom-fetch-free.ts');
  for (const name of ['TaskEditInputs', 'TaskScheduleMenu', 'TaskHistoryList', 'TaskCreateInputs']) {
    assert.ok(law.includes(`\`\${BASE}/${name}.tsx\``), `the showroom law lists ${name}`);
  }
  // The markup moved — the views hold none of it now.
  const view = code(ROW_VIEW);
  for (const gone of ['schedule for:', 'no status changes recorded yet', 'notes (institutional context)', 'const STATUS_OPTIONS']) {
    assert.equal(view.includes(gone), false, `TaskRowView no longer holds "${gone}"`);
  }
  assert.equal(code(LIST_VIEW).includes('what is the atomic unit of work?'), false);
  assert.ok(code(PARTS[3]).includes('what is the atomic unit of work?'));
  assert.ok(code(PARTS[0]).includes('notes (institutional context)'));
  assert.match(comments(PARTS[0]), /Moved verbatim out of TaskRowView\.tsx/);
});
