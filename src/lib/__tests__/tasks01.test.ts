import test from 'node:test';
import assert from 'node:assert/strict';
import { navLaw, navToolByName, phasesRenderedOn, PHASES_RENDERED_AT, THE_SORT } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { assessDeletion, describeBlockers, removalSummary, type DeletionFacts } from '../operations/projectDeletion';
import { code, comments } from '../sourceText';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
// TASKS-ONE-02 (2026-10-14): TodaysStrip.tsx is deleted (Alex's ruling: the day card replaces the Today strip). The
// path stays named so the tests below can say it is gone; Today's mark-done is the stop form's "✓ done now".
const TODAY = 'src/components/workbench/operations/routines/TodaysStrip.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const DAY_CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const DELETE_ROUTE = 'src/app/api/operations/projects/[id]/route.ts';
const PREVIEW_ROUTE = 'src/app/api/operations/projects/[id]/deletion/route.ts';

// TASKS-ONE-02 (2026-10-14): TodaysStrip, SectionC_DailyPlan, DailyPlanRoutineRow, WeekSection and WeekCell are
// DELETED (Alex's ruling: the day card replaces the week grid, the Daily plan and the Today strip) — they leave the
// tree with their code (TASKS_GONE, checked absent below); the day card and its stop form, now on the page, join it.
// TIME-01 (2026-10-19): the day card and its stop form moved to /time with the ledger; they stay listed here as
// "draws no strip" files (true on either page), and the page pins below moved to the two lists.
const TASKS_TREE = [PAGE, SECTION_D, SECTION_E, ROW, ROW_VIEW, PIPE_VIEW, ROUTINE_LIST, ROUTINE_ROW,
  'src/components/workbench/operations/projects/TaskList.tsx',
  // PROJECTS-01 (2026-09-30): the projects list's markup moved into the one
  // table — its files are in the tree, and draw no strip either.
  'src/components/workbench/operations/projects/ProjectsTable.tsx',
  'src/components/workbench/operations/projects/ProjectTableRows.tsx',
  'src/components/workbench/operations/projects/TaskTableRow.tsx',
  // WEEK-01 (2026-09-30): this week, first on the page — its files are in the tree too.
  'src/components/workbench/operations/routines/RefusedRoutines.tsx',
  DAY_CARD, STOP_FORM];
const TASKS_GONE = [TODAY,
  'src/components/workbench/operations/SectionC_DailyPlan.tsx',
  'src/components/workbench/operations/dailyplan/DailyPlanRoutineRow.tsx',
  'src/components/workbench/operations/week/WeekSection.tsx',
  'src/components/workbench/operations/week/WeekCell.tsx'];

// ───────────────────────────────────────────────────────────────────────────
// TASKS-ONE-02 (2026-10-14): the title said "and the daily plan" — the Daily plan is deleted (Alex's ruling), so the
// pin moved with the page: the day card, then the two lists.
test('the page is two lists — no strip, no pipe label, no receipts', () => {
  const page = code(PAGE);
  assert.match(page, /<SectionD_ProjectBacklog \/>/);
  assert.match(page, /<SectionE_Routines \/>/);
  // WEEK-01 (2026-09-30): a fourth mount, FIRST — this week, then the two lists and the daily plan.
  // TASKS-ONE-02 (2026-10-14): the week and the daily plan are deleted — the day card replaces them. Three mounts, in order.
  // LEDGER-01 (Alex, 2026-10-16): the city ledger is a fourth mount, LAST — under Routines. Four mounts, in order.
  // TIME-01 (Alex, 2026-10-19): the day card and the ledger moved to /time (time01.test.ts). Two mounts, in order.
  assert.match(page, /<div className="space-y-3" data-tool-page="Tasks">\s*<SectionD_ProjectBacklog \/>\s*<SectionE_Routines \/>\s*<\/div>/);
  assert.doesNotMatch(page, /DayCard|LedgerSection|Suspense/, 'the day card and the ledger are /time\'s (TIME-01)');
  assert.doesNotMatch(page, /WeekSection|SectionC_DailyPlan|TodaysStrip/);
  for (const f of TASKS_GONE) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is deleted`);
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

// TASKS-ONE-02 (2026-10-14): the title said "with Today above it" — Today is deleted (Alex's ruling: the day card
// replaces the Today strip). The pin moved: the list alone, and Today's mark-done is the day card's stop form.
test('the routines list keeps its controls: in clock order (FORM-01), + new, edit, delete, show inactive — and mark-done is the day card\'s', () => {
  const e = code(SECTION_E);
  assert.doesNotMatch(e, /TodaysStrip/, 'Today is gone from the section — here and in the cockpit that mounts it');
  assert.match(e, /<RoutineList entities=\{entities\} \/>/);
  assert.match(e, />Routines</);
  assert.doesNotMatch(e, /StageStrip|ProofStrip|PIPE_PHASES|SectionHeader|onTotals|hasStreak/);
  // The two counters let Today and the list refetch each other — with Today gone, they went (moved, not loosened:
  // there is no other surface on the section to refetch).
  assert.doesNotMatch(e, /refreshKey|onCommitted|listVersion|todayVersion|createRequest/);
  const l = code(ROUTINE_LIST);
  assert.match(l, /\+ new routine/);
  assert.match(l, /show inactive/);
  // FORM-01 (2026-10-19): the current routines are one flat table in clock order — no cadence groups.
  assert.match(l, /byClockThenName/);
  assert.doesNotMatch(l, /CADENCE_GROUP_ORDER\.map/);
  assert.match(l, /createRequest > 0 && entities\.length > 0\) startCreate\(\)/, "Today's zero-state opens the list's own form");
  const r = code(ROUTINE_ROW);
  assert.match(r, /setEditing\(true\)/, 'edit is a control on the row');
  assert.match(r, /handleDelete/, 'delete is a control on the row');
  assert.match(r, /data-routine-next-due/);
  // Today's "✓ mark done" moved to the day card's stop form — its done record is the routine's done
  // (src/lib/operations/routineCompletion.ts); the done · due · missed line went with the strip.
  assert.ok(!existsSync(resolve(process.cwd(), TODAY)), 'TodaysStrip is deleted');
  assert.match(code(STOP_FORM), /onClick=\{doneNow\} data-stop-done-now>✓ done now</);
  assert.match(code(DAY_CARD), /<StopForm/);
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
  // TASKS-ONE-02 (2026-10-14): TodaysStrip and DailyPlanRoutineRow are deleted — they leave the list with their code;
  // the day card and its stop form, where a routine is marked done now, join it.
  for (const f of [ROUTINE_ROW, ROUTINE_LIST, SECTION_E, DAY_CARD, STOP_FORM,
    'src/components/workbench/operations/day/dayCard.ts',
    'src/components/home/RoutinesShowcaseSections.tsx',
    'src/app/agenda/[id]/page.tsx']) {
    const body = code(f);
    assert.ok(!body.includes('🔥'), `${f} draws no 🔥`);
    assert.doesNotMatch(body, /\.consecutive_(completion|miss)_streak\b/, `${f} reads no streak`);
  }
  // The row still shows what is planned and when: the lines' figure and next-due.
  const r = code(ROUTINE_ROW);
  assert.match(r, /routinePlanned\(/);
  // ROUTINE-02a (2026-10-18): the next, or "ended <date>" once nothing remains before the end.
  assert.match(r, /`next: \$\{formatDateTime\(routine\.next_due_at, routine\.timezone\)\}`/);
  // Today's DONE / DUE / MISSED came from the today feed's statuses, not from a streak — TASKS-ONE-02 (2026-10-14):
  // Today is deleted, and the feed's statuses are still the today route's (the day card reads it, no streak).
  assert.doesNotMatch(code('src/app/api/operations/routines/today/route.ts'), /consecutive_/);
  // The writers are untouched, and the columns are still in the schema.
  // TASKS-ONE-02 (2026-10-14): the completions route is deleted; its streak write moved, as it was, into the one
  // completion writer the stops routes call — moved, never loosened.
  assert.match(code('src/lib/operations/routineCompletion.ts'), /consecutive_completion_streak: routine\.consecutive_completion_streak \+ 1/);
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
  // DAYCARD-01 (2026-10-11): the day card, by the same door — the pin moved from three to four.
  // TASKS-ONE-01 (2026-10-14): four became two — the Issue log's page is deleted (an unbuilt placeholder), and the
  // day card is the first section of /tasks. The link still says trail.
  assert.deepEqual(tasks.links?.map((l) => [l.label, l.href]), [
    ['North Star', '/operations/north-star'],
    ['Audit trail', '/operations/audit-log'],
  ]);
});

test('every lettered header lost its letter', () => {
  // TASKS-ONE-02 (2026-10-14): SectionC_DailyPlan.tsx ('DAILY PLAN') is deleted with the Daily plan — it leaves
  // the list with its code; it cannot wear a letter it does not have.
  assert.ok(!existsSync(resolve(process.cwd(), 'src/components/workbench/operations/SectionC_DailyPlan.tsx')));
  for (const [f, header] of [
    ['src/components/workbench/operations/SectionB_NorthStar.tsx', 'NORTH STAR'],
    ['src/components/workbench/operations/SectionK_AuditTail.tsx', 'AUDIT TRAIL'],
    ['src/components/workbench/operations/content/SectionG_Content.tsx', 'CONTENT'],
  ] as const) {
    const body = code(f);
    assert.match(body, new RegExp(`>\\s*${header}\\s*<`), `${f} says ${header}`);
    assert.doesNotMatch(body, /<h2[^>]*>\s*[A-Z] · /, `${f} wears no letter`);
  }
});

// TASKS-ONE-01 (2026-10-14): the title said four links; two now — the pin moved with the registry row.
test('the rail under Tasks shows its two links and no phase — the rail never rendered phases, and the opener lists none', () => {
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const tasks = navToolByName('Tasks', TOOL_GATE);
  // DAYCARD-01 (2026-10-11): three became four — the day card, by the same door.
  // TASKS-ONE-01 (2026-10-14): four became two — the Issue log's page is deleted, the day card is on /tasks itself.
  assert.deepEqual(tasks.subRows.map((r) => r.label), ['North Star', 'Audit trail']);
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
