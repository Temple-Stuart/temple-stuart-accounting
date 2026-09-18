import test from 'node:test';
import assert from 'node:assert/strict';
import { navLaw, navToolByName, phasesRenderedOn, PHASES_RENDERED_AT, THE_SORT } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { assessDeletion, describeBlockers, removalSummary, type DeletionFacts } from '../operations/projectDeletion';
import { code, comments } from '../sourceText';

/**
 * TASKS-01 — TASKS IS TWO LISTS — PROJECTS AND ROUTINES — AND EVERYTHING ELSE
 * COMES OFF. Source reads strip comments first (TEST-TRUTH-01), so a note about
 * a strip can never satisfy an assertion that the strip is gone.
 */

const PAGE = 'src/app/tasks/page.tsx';
const SECTION_D = 'src/components/workbench/operations/SectionD_ProjectBacklog.tsx';
const SECTION_E = 'src/components/workbench/operations/SectionE_Routines.tsx';
const ROW = 'src/components/workbench/operations/projects/ProjectRow.tsx';
const ROW_VIEW = 'src/components/workbench/operations/projects/ProjectRowView.tsx';
const PIPE_VIEW = 'src/components/workbench/operations/projects/TruthMachineView.tsx';
const ROUTINE_LIST = 'src/components/workbench/operations/routines/RoutineList.tsx';
const ROUTINE_ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
const TODAY = 'src/components/workbench/operations/routines/TodaysStrip.tsx';
const DELETE_ROUTE = 'src/app/api/operations/projects/[id]/route.ts';
const PREVIEW_ROUTE = 'src/app/api/operations/projects/[id]/deletion/route.ts';

const TASKS_TREE = [PAGE, SECTION_D, SECTION_E, ROW, ROW_VIEW, PIPE_VIEW, ROUTINE_LIST, ROUTINE_ROW, TODAY,
  'src/components/workbench/operations/SectionC_DailyPlan.tsx',
  'src/components/workbench/operations/projects/TaskList.tsx',
  'src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx'];

// ───────────────────────────────────────────────────────────────────────────
test('the page is two lists and the daily plan — no strip, no pipe label, no receipts', () => {
  const page = code(PAGE);
  assert.match(page, /<SectionD_ProjectBacklog \/>/);
  assert.match(page, /<SectionE_Routines \/>/);
  assert.match(page, /<SectionC_DailyPlan \/>/);
  assert.doesNotMatch(page, /data-pipe-section|data-pipe-label|PIPE_LABEL|PIPE_PHASES|<StageStrip|<ProofStrip/);
  // The tool header stays: family, name, registry line — nothing else.
  assert.equal((page.match(/<ToolOpener/g) ?? []).length, 1);
  for (const f of TASKS_TREE) {
    assert.doesNotMatch(code(f), /<StageStrip|<ProofStrip/, `${f} draws no strip and no receipts`);
  }
  // The declaration agrees: nothing drawn, nothing advertised.
  assert.deepEqual(PHASES_RENDERED_AT['/tasks'], []);
  assert.deepEqual(phasesRenderedOn('/tasks', navToolByName('Tasks', TOOL_GATE)), []);
});

test('the projects list keeps its controls: + new, edit, delete, archive, show archived — and a plain door to the pipeline', () => {
  const d = code(SECTION_D);
  assert.match(d, /\+ new project/);
  assert.match(d, /show archived/);
  assert.match(d, /include_archived/);
  const v = code(ROW_VIEW);
  for (const handler of ['onEnterEdit', 'onDelete', 'onArchive', 'onUnarchive', 'onEnterPipeline']) {
    assert.match(v, new RegExp(`onClick=\\{${handler}\\}`), `the row wires ${handler} to a button`);
  }
  assert.match(v, /data-project-pipeline/);
  // The standard row is the default; the pipeline is opened, never landed on.
  const row = code(ROW);
  assert.match(row, /useState\(false\)/);
  assert.match(row, /const \[pipelineMode, setPipelineMode\] = useState\(false\)/);
  assert.match(row, /onEnterPipeline=\{\(\) => setPipelineMode\(true\)\}/);
  // Every action the six phases offered survives as a plain control in the pipeline view.
  const p = code(PIPE_VIEW);
  for (const [handler, label] of [
    ['onRunResearch', '✨ run deep research'], ['onSaveInputs', 'save research + audit'],
    ['onGenerateTasks', '↑ generate tasks'], ['onRunPipe', '⚡ run pipe (auto)'],
    ['onEvolveStart', '↻ evolve — new goals, loop again'], ['onExit', 'standard view'],
  ] as const) {
    assert.match(p, new RegExp(`onClick=\\{${handler}\\}`), `${handler} is a control`);
    assert.ok(p.includes(label), `"${label}" is still the control's text`);
  }
  assert.match(p, /<AITaskPreview/, 'the accept gate stays');
  assert.match(p, /\{taskSection\}/, 'the live task list stays');
  // And they are no longer tabs: no phase key, no show/hide.
  assert.doesNotMatch(p, /activePhase|ProjectPhaseKey|PIPE_PHASES|doneByPhase|'block' : 'hidden'/);
  assert.match(comments(PIPE_VIEW), /TASKS-01 \(2026-09-18\): the per-project StageStrip and the ProofStrip receipts are GONE/);
});

test('the routines list keeps its controls: grouped by cadence, + new, edit, delete, show inactive — with Today above it', () => {
  const e = code(SECTION_E);
  assert.match(e, /<TodaysStrip/);
  assert.match(e, /<RoutineList/);
  assert.match(e, />Routines</);
  assert.doesNotMatch(e, /StageStrip|ProofStrip|PIPE_PHASES|SectionHeader|onTotals|hasStreak/);
  // Two counters, so a commit on one surface refetches only the OTHER.
  assert.match(e, /refreshKey=\{listVersion\}/);
  assert.match(e, /refreshKey=\{todayVersion\}/);
  assert.match(e, /onCommitted=\{\(\) => setTodayVersion\(\(n\) => n \+ 1\)\}/);
  assert.match(e, /onCommitted=\{\(\) => setListVersion\(\(n\) => n \+ 1\)\}/);
  const l = code(ROUTINE_LIST);
  assert.match(l, /\+ new routine/);
  assert.match(l, /show inactive/);
  assert.match(l, /CADENCE_GROUP_ORDER\.map/);
  assert.match(l, /createRequest > 0 && entities\.length > 0\) startCreate\(\)/, "Today's zero-state opens the list's own form");
  const r = code(ROUTINE_ROW);
  assert.match(r, /setEditing\(true\)/, 'edit is a control on the row');
  assert.match(r, /handleDelete/, 'delete is a control on the row');
  assert.match(r, /data-routine-next-due/);
  const t = code(TODAY);
  assert.match(t, /✓ mark done/);
  assert.match(t, /\{totalDone\} done · \{totalDue\} due · \{totalMissed\} missed/);
  assert.match(t, /\}, \[refreshKey\]\);/);
});

// ───────────────────────────────────────────────────────────────────────────
// The delete rules, from facts alone — no database.
// ───────────────────────────────────────────────────────────────────────────
function facts(over: Partial<DeletionFacts> = {}): DeletionFacts {
  return {
    project: { id: 'p1', title: 'Launch the truck' },
    tasks: [
      { id: 't1', title: 'Buy the fryer', actual_cost_usd: null },
      { id: 't2', title: 'Print the menu', actual_cost_usd: null },
    ],
    ledgerLinkCount: 0,
    plannedLinkTaskIds: [],
    calendarBlockTaskIds: [],
    scheduledItemTaskIds: [],
    dependencyCount: 1,
    planItemCount: 0,
    statusHistoryCount: 3,
    issueCount: 0,
    contentPieceCount: 0,
    ...over,
  };
}

test('an unlinked project deletes — with its tasks and dependencies, and the dialog names them', () => {
  const p = assessDeletion(facts());
  assert.deepEqual(p.blockers, []);
  assert.deepEqual(p.removes, { tasks: 2, dependencies: 1, plan_items: 0, status_history: 3 });
  assert.equal(removalSummary(p), 'Delete project "Launch the truck"? This removes the project and its 2 tasks, 1 dependency, 3 status-history rows. This cannot be undone.');
  // A severed link is named too — the row survives without its project.
  const q = assessDeletion(facts({ issueCount: 1, contentPieceCount: 2, planItemCount: 1 }));
  assert.match(removalSummary(q), /1 daily-plan item/);
  assert.match(removalSummary(q), /1 issue-log entry and 2 content pieces will lose the link to it \(they stay\)\./);
});

test('a linked task refuses the delete, naming the task and the reason — one blocker per live link', () => {
  const linked = assessDeletion(facts({ plannedLinkTaskIds: ['t2', 't2'] }));
  assert.equal(linked.blockers.length, 1);
  assert.equal(linked.blockers[0].kind, 'planned_item_link');
  assert.equal(linked.blockers[0].task_title, 'Print the menu');
  assert.equal(linked.blockers[0].message, 'task "Print the menu" is linked to 2 postings');
  assert.equal(describeBlockers(linked), 'Can\'t delete "Launch the truck": task "Print the menu" is linked to 2 postings. Archive it instead — every record stays.');

  const actual = assessDeletion(facts({ tasks: [{ id: 't1', title: 'Buy the fryer', actual_cost_usd: '412.50' }] }));
  assert.deepEqual(actual.blockers.map((b) => [b.kind, b.message]), [['posted_actual', 'task "Buy the fryer" carries a posted actual']]);

  const block = assessDeletion(facts({ calendarBlockTaskIds: ['t1'] }));
  assert.deepEqual(block.blockers.map((b) => [b.kind, b.task_id]), [['calendar_block', 't1']]);
  assert.match(block.blockers[0].message, /task "Buy the fryer" has 1 calendar block/);

  const posting = assessDeletion(facts({ ledgerLinkCount: 3 }));
  assert.deepEqual(posting.blockers.map((b) => [b.kind, b.task_id, b.message]), [['posting_link', null, '3 ledger lines are allocated to it']]);

  const scheduled = assessDeletion(facts({ scheduledItemTaskIds: [null, 't2'] }));
  assert.deepEqual(scheduled.blockers.map((b) => b.message), ['1 scheduled item is on the project', 'task "Print the menu" is on 1 scheduled item']);

  // Several at once: every one named, in a stable order.
  const all = assessDeletion(facts({ ledgerLinkCount: 1, plannedLinkTaskIds: ['t1'], calendarBlockTaskIds: ['t2'], tasks: [{ id: 't1', title: 'Buy the fryer', actual_cost_usd: '1' }, { id: 't2', title: 'Print the menu', actual_cost_usd: null }] }));
  assert.deepEqual(all.blockers.map((b) => b.kind), ['posting_link', 'planned_item_link', 'posted_actual', 'calendar_block']);
  // Nothing is ever cascaded through: a blocked preview still counts what WOULD go, and the route never reaches delete.
  assert.equal(all.removes.tasks, 2);
});

test('the route: user-scoped 404, the check inside the transaction, 409 naming the reason; the row previews before it confirms', () => {
  const route = code(DELETE_ROUTE);
  const del = route.slice(route.indexOf('export async function DELETE('));
  assert.match(del, /loadAuthorizedProject\(id, user\.id\)/);
  assert.match(del, /if \(!existing\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/, 'another user\'s project is a defensive 404');
  assert.doesNotMatch(del, /status: 403/);
  const tx = del.indexOf('prisma.$transaction(');
  const check = del.indexOf('projectDeletionCheck(tx, id, user.id)');
  const drop = del.indexOf('tx.operations_projects.delete({ where: { id } })');
  assert.ok(tx > 0 && check > tx && drop > check, 'check, then delete, inside one transaction');
  assert.match(del, /if \(preview\.blockers\.length > 0\) return \{ kind: 'blocked', preview \}/);
  assert.match(del, /error: 'ProjectHasLiveLinks', message: describeBlockers\(outcome\.preview\), blockers: outcome\.preview\.blockers \},\s*\{ status: 409 \}/);
  // The TRADE-LOG-01 precedent: a refusal is a 409 with its reason.
  assert.match(code('src/app/api/trade-log/manual/route.ts'), /status: 409/);
  // The preview reads the same leaf, and writes nothing.
  const preview = code(PREVIEW_ROUTE);
  assert.match(preview, /projectDeletionCheck\(prisma, id, user\.id\)/);
  assert.match(preview, /summary: removalSummary\(preview\)/);
  assert.doesNotMatch(preview, /\.delete\(|\.update\(|\.create\(|method:/);
  // The row: preview → refuse with the reason, or confirm with what goes → DELETE.
  const row = code(ROW);
  const h = row.slice(row.indexOf('const handleDelete'));
  const a = h.indexOf('/deletion`');
  const b = h.indexOf('setError(preview.message)');
  const c = h.indexOf('confirm(preview.summary)');
  const d = h.indexOf("method: 'DELETE'");
  assert.ok(a > 0 && b > a && c > b && d > c, 'preview, refusal, confirm, delete — in that order');
  // The read view has an error slot now, so a refusal is seen where the button is.
  assert.match(code(ROW_VIEW), /data-project-error/);
});

// ───────────────────────────────────────────────────────────────────────────
test('no 🔥 — no streak renders on any customer surface; the writers and the columns stay', () => {
  for (const f of [ROUTINE_ROW, TODAY, ROUTINE_LIST, SECTION_E,
    'src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx',
    'src/components/home/RoutinesShowcaseSections.tsx',
    'src/app/agenda/[id]/page.tsx']) {
    const body = code(f);
    assert.ok(!body.includes('🔥'), `${f} draws no 🔥`);
    assert.doesNotMatch(body, /\.consecutive_(completion|miss)_streak\b/, `${f} reads no streak`);
  }
  // The row still shows what is planned and when: the lines' figure and next-due.
  const r = code(ROUTINE_ROW);
  assert.match(r, /routinePlanned\(/);
  assert.match(r, /next: \{formatDateTime\(routine\.next_due_at, routine\.timezone\)\}/);
  // Today's DONE / DUE / MISSED come from the today feed's statuses, not from a streak.
  const t = code(TODAY);
  assert.match(t, /e\.status === 'completed'/);
  assert.match(t, /e\.status === 'missed'/);
  assert.doesNotMatch(t, /consecutive_/);
  // The writers are untouched, and the columns are still in the schema.
  assert.match(code('src/app/api/operations/routines/[id]/completions/route.ts'), /consecutive_completion_streak: routine\.consecutive_completion_streak \+ 1/);
  assert.match(code('src/inngest/functions/routine-evaluator.ts'), /consecutive_miss_streak: r\.consecutive_miss_streak \+ routineMissCount/);
  assert.match(code('prisma/schema.prisma'), /consecutive_completion_streak/);
  assert.match(code('prisma/schema.prisma'), /consecutive_miss_streak/);
  // The showcase mirrors the row as it is now: the next-due cell, no counter.
  const show = code('src/components/home/RoutinesShowcaseSections.tsx');
  assert.match(show, /function ListPanel\(/);
  assert.doesNotMatch(show, /StreaksPanel|streak counts both ways/);
});

test('the registry why is a customer\'s line; the founder note is a code comment; the link says trail', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.doesNotMatch(tasks.why ?? '', /founder|Claude Code|paid|build pipeline/i);
  assert.match(tasks.why ?? '', /a task's actual cost is still typed by hand/, 'what is not done for a customer, named');
  assert.equal(tasks.status, 'PARTIAL');
  assert.deepEqual(tasks.beats, { discover: true, decide: true, commit: true, record: true });
  // The founder's note moved into the comment beside the row — prose, read as prose.
  assert.match(comments('src/lib/toolRegistry.ts'), /accepting a task fires a paid Claude Code\s*\n?\s*\/\/\s*build; not a customer's task tool/);
  assert.match(comments('src/lib/toolRegistry.ts'), /fireExecutionRoutine — a Claude Code Routine that builds THIS repository/);
  assert.deepEqual(tasks.links?.map((l) => [l.label, l.href]), [
    ['North Star', '/operations/north-star'],
    ['Issue log', '/operations/issues'],
    ['Audit trail', '/operations/audit-log'],
  ]);
});

test('every lettered header lost its letter', () => {
  for (const [f, header] of [
    ['src/components/workbench/operations/SectionC_DailyPlan.tsx', 'DAILY PLAN'],
    ['src/components/workbench/operations/SectionB_NorthStar.tsx', 'NORTH STAR'],
    ['src/components/workbench/operations/SectionK_AuditTail.tsx', 'AUDIT TRAIL'],
    ['src/components/workbench/operations/content/SectionG_Content.tsx', 'CONTENT'],
  ] as const) {
    const body = code(f);
    assert.match(body, new RegExp(`>\\s*${header}\\s*<`), `${f} says ${header}`);
    assert.doesNotMatch(body, /<h2[^>]*>\s*[A-Z] · /, `${f} wears no letter`);
  }
});

test('the rail under Tasks shows three links and no phase — the rail never rendered phases, and the opener lists none', () => {
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const tasks = navToolByName('Tasks', TOOL_GATE);
  assert.deepEqual(tasks.subRows.map((r) => r.label), ['North Star', 'Issue log', 'Audit trail']);
  // The rail's sub-rows are the registry links — never tool.phases.
  const rail = code('src/components/shell/Rail.tsx');
  assert.match(rail, /tool\.subRows\.map/);
  assert.doesNotMatch(rail, /tool\.phases|\.phases\b/);
  assert.match(code('src/lib/nav.ts'), /subRows: \(tool\.links \?\? \[\]\)/);
  // Tasks still OWNS both pipes (nothing moved), and declares every phase undrawn.
  assert.equal(tasks.phases.length, 10);
  for (const a of THE_SORT.filter((x) => x.pipe === 'routines' || x.pipe === 'projects')) {
    assert.equal(a.rendersSurface, false, `${a.pipe} ${a.num} is declared undrawn`);
    assert.match(a.surfaceNote ?? '', /TASKS-01 \(2026-09-18\): drawn nowhere/);
  }
});
