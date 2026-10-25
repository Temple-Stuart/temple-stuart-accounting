/**
 * backlog02.test.ts — BACKLOG-02 (Alex, 2026-10-20): THE MORNING CARD'S RUNNING LOG.
 *
 * Alex, 15:42: "the morning card — it's a running log of all the projects that are ongoing and tasks that need to be
 * executed, and I need a way to rank them, and also add to them if needed, or adjust the scope if things are evolving."
 *
 * Rulings A–F, and the three answered after the stop (C is a LINK — /tasks?new=project — never the capture form
 * mounted on the card, TOOL-LAW-01; the projects GET carries each project's open tasks; /tasks reads ?project= and
 * ?new=project, says "project not found", and clears both).
 *
 * T1 the migration · T2 the reorder route in source · T3 the reorder rule driven · T4 the pure log rules driven ·
 * T5 the projects GET · T6 the card's one read driven · T7 THE LOG on the morning card · T8 the doors to /tasks ·
 * T9 nothing else · T10 BACKLOG-02b: not_started is open work. The ladder pins moved by one in fourteen files; the /tasks page pins (tasks01, tasksOne01,
 * tasksOne02, time01, week01), the morning form's mount (journal01), journal06's read and card pins and the route
 * census (sec02) moved with it, each dated.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  ADD_PROJECT_WORDS, ADD_TASK_WORDS, LOG_LOADING_WORDS, LOG_WORD, NEW_PROJECT_WAITS_WORDS, NO_OPEN_PROJECTS_WORDS, NO_OPEN_TASKS_WORDS, OPEN_PROJECT_STATUSES,
  OPEN_TASK_STATUSES, PROJECT_NOT_FOUND_WORDS, REORDER_SHAPE_WORDS, TASKS_NEW_PARAM, TASKS_NEW_PROJECT, TASKS_PROJECT_PARAM, USE_AS_GOALS_WORDS,
  appendGoalLines, canMove, duplicateWords, isOpenProjectStatus, isProjectId, logOrder, missingWords, moveInLog, moveWords, newParamWords, newProjectHref, notOpenWords,
  notYoursWords, picksToGoals, picksWords, projectHref, rankWords, ranksAfter, ranksChange, reorderCheck, reorderIds,
  type OwnedProject,
} from '../operations/morningLog';
import { REFLECTION_PROMPT_NO_BACKLOG, backlogOrder, linesOf, reflectionPromptText, stripListMarker } from '../operations/journal';
import { readBacklog } from '@/components/workbench/operations/day/dayReads';

const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261020160000_backlog_02_reranked';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const RULE = 'src/lib/operations/morningLog.ts';
const ROUTE = 'src/app/api/operations/projects/reorder/route.ts';
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';
const TASKS_ROUTE = 'src/app/api/operations/projects/[id]/tasks/route.ts';
const AUDIT_ROUTE = 'src/app/api/audit-log/route.ts';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const MORNING_FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const LOG = 'src/components/workbench/operations/stops/MorningLog.tsx';
const WRITES = 'src/components/workbench/operations/stops/logWrites.ts';
const LIST = 'src/components/workbench/operations/SectionD_ProjectBacklog.tsx';
const TASKS_PAGE = 'src/app/tasks/page.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const DONE = '44444444-4444-4444-8444-444444444444';
const FOREIGN = '99999999-9999-4999-8999-999999999999';
/** What the route reads for this user: every open project, and the listed ids the user owns (here, a completed one). */
const OWNED: readonly OwnedProject[] = [
  { id: A, title: 'Ship the reel kit', status: 'in_progress', rank: 2 },
  { id: B, title: 'Fix the ledger CSV', status: 'backlog', rank: 1 },
  { id: C, title: 'Write the SOC 2 narrative', status: 'scoped', rank: null },
  { id: DONE, title: 'Old project', status: 'completed', rank: 3 },
];

// ── T1 · THE MIGRATION ───────────────────────────────────────────────────────

test('T1 the migration: the newest; ONE ADD VALUE IF NOT EXISTS line, the precedent’s way, nothing else; the schema and the client carry the value; the audit read lists it', () => {
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261020150000_journal_06_reflection', 'right after JOURNAL-06’s');
  const sql = code(MIGRATION).trim();
  assert.equal(sql, `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_reranked';`, 'the one statement, and nothing else — no BEGIN, no row, no column');
  const head = comments(MIGRATION);
  assert.match(head, /BACKLOG-02 \(Alex, 2026-10-20\) — THE MORNING CARD'S RUNNING LOG: one audit value for the rank\./);
  assert.match(head, /`ALTER TYPE \.\.\. ADD VALUE` cannot run inside a BEGIN\/COMMIT block/);
  assert.match(head, /20260605000000_pr_ops_archive_task_status\/migration\.sql:9, :20/, 'the precedent, cited');
  assert.match(head, /applied at deploy after merge/);
  assert.match(code(SCHEMA), /\n\s+operations_project_deleted\n\s+operations_project_reranked\n\s+operations_project_task_created\n/, 'the schema: beside the project family');
  assert.equal(AuditActionType.operations_project_reranked, 'operations_project_reranked', 'prisma generate ran — the client knows it');
  const list = /operations_: \[([\s\S]*?)\n\s*\],/.exec(code(AUDIT_ROUTE))![1];
  assert.match(list, /'operations_project_reranked'/, 'the audit read’s operations_ family returns it (WHAT MOVED TODAY, the trail)');
});

// ── T2 · THE REORDER ROUTE, IN SOURCE ────────────────────────────────────────

test('T2 the reorder route: PATCH only; the projects routes’ auth order before anything else; every query user-scoped; the shape, then the rule INSIDE one transaction; ranks written 1..n; one audit row, after the commit, only when a rank changed; refusals 400 by name; no paid call', () => {
  const r = code(ROUTE);
  assert.deepEqual([...r.matchAll(/export async function (\w+)/g)].map((m) => m[1]), ['PATCH'], 'one handler');
  inOrder(r, [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    'const user = await prisma.users.findFirst({',
    "where: { email: { equals: userEmail, mode: 'insensitive' } },",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    'body = await request.json();',
    'const shape = reorderIds(body);',
    "if (!shape.ok) return NextResponse.json({ error: 'Validation', field: 'ids', rule: shape.rule, message: shape.message }, { status: 400 });",
    'const saved: Saved = await prisma.$transaction(async (tx) => {',
    'const owned = await tx.operations_projects.findMany({',
    'where: { user_id: user.id, OR: [{ id: { in: ids.filter(isProjectId) } }, { status: { in: [...OPEN_PROJECT_STATUSES] } }] },',
    'const check = reorderCheck(ids, owned);',
    'if (!check.ok) return check;',
    'const after = ranksAfter(ids);',
    'if (!ranksChange(ids, owned)) return { ok: true, changed: false, before, after };',
    'await tx.operations_projects.update({ where: { id, user_id: user.id }, data: { rank } });',
    "if (!saved.ok) return NextResponse.json({ error: 'Validation', field: 'ids', rule: saved.rule, message: saved.message }, { status: 400 });",
    'if (saved.changed) {',
    'await writeAuditLog({',
    "type: 'operations_project_reranked',",
    'metadata: {',
    'before: saved.before.map((p) => ({ id: p.id, title: p.title, rank: p.rank })),',
    'after: saved.after,',
  ], 'the route, in order');
  assert.equal((r.match(/\$transaction\(/g) ?? []).length, 1, 'ONE transaction');
  assert.equal((r.match(/writeAuditLog\(/g) ?? []).length, 1, 'ONE audit write');
  assert.ok(r.indexOf('prisma.users.findFirst') < r.indexOf('$transaction'), 'the user before any project query');
  for (const q of r.matchAll(/(?:tx|prisma)\.operations_projects\.(\w+)\(\{\s*where: \{([^}]*)/g)) assert.match(q[2], /user_id: user\.id/, `${q[1]} is scoped to the user`);
  assert.doesNotMatch(r, /@\/lib\/ai|anthropic|openai|fetch\(/, 'no paid call, no outbound request');
  assert.doesNotMatch(r, /updateMany|deleteMany|\.delete\(|\$queryRaw|\$executeRaw/, 'it writes rank, nothing else, never raw');
  const head = comments(ROUTE);
  for (const rule of ['shape', 'duplicate', 'not_yours', 'not_open', 'missing']) assert.match(head, new RegExp(`· ${rule}\\b`), `the header names ${rule}`);
  assert.match(head, /the same words whether\s*\n?\s*\*?\s*the row belongs to another user or to no one/);
  assert.match(head, /Auth: the projects routes' order — getVerifiedEmail → 401, the user → 404, every query scoped to user_id\./);
  // Nothing else writes rank.
  for (const f of [PROJECTS_ROUTE, 'src/app/api/operations/projects/[id]/route.ts', TASKS_ROUTE]) assert.doesNotMatch(code(f), /\brank\s*:/, `${f} writes no rank`);
});

// ── T3 · THE REORDER RULE, DRIVEN ────────────────────────────────────────────

test('T3 reorderCheck: the four refusals by name, in order — duplicate, not yours (another user’s or no one’s: the same words), not open, missing; the whole open list passes; ranks 1..n; no change, no write', () => {
  // The shape.
  for (const bad of [null, [], 'x', { ids: 'a' }, { ids: [A, 7] }, { ids: [A, ''] }, {}]) assert.deepEqual(reorderIds(bad), { ok: false, rule: 'shape', message: REORDER_SHAPE_WORDS }, JSON.stringify(bad));
  assert.deepEqual(reorderIds({ ids: [A, B] }), { ok: true, ids: [A, B] });
  // The whole open list, in any order, passes.
  assert.deepEqual(reorderCheck([C, A, B], OWNED), { ok: true });
  // 1. duplicate — first, before anything is looked up.
  assert.deepEqual(reorderCheck([A, B, A, C], OWNED), { ok: false, rule: 'duplicate', message: duplicateWords(A) });
  assert.equal(duplicateWords(A), `${A} is listed twice — each open project appears once`);
  // 2. not yours — another user's id and a non-id get the SAME words as an id no one has.
  assert.deepEqual(reorderCheck([A, B, C, FOREIGN], OWNED), { ok: false, rule: 'not_yours', message: notYoursWords(FOREIGN) });
  assert.deepEqual(reorderCheck([A, B, C, 'not-a-uuid'], OWNED), { ok: false, rule: 'not_yours', message: notYoursWords('not-a-uuid') });
  assert.equal(notYoursWords(FOREIGN), `${FOREIGN} is not one of your projects`);
  assert.equal(isProjectId(A), true);
  assert.equal(isProjectId('not-a-uuid'), false);
  // 3. not open.
  assert.deepEqual(reorderCheck([A, B, C, DONE], OWNED), { ok: false, rule: 'not_open', message: notOpenWords('Old project', 'completed') });
  // BACKLOG-02b (Alex, 2026-10-20): not_started joined the open set — the words name it; the pin moved with it, as exact.
  assert.equal(notOpenWords('Old project', 'completed'), '"Old project" is completed — only open projects (backlog · scoped · scheduled · in_progress · blocked · not_started) are ranked');
  // 4. missing — named in rank order.
  assert.deepEqual(reorderCheck([A], OWNED), { ok: false, rule: 'missing', message: missingWords(['Fix the ledger CSV', 'Write the SOC 2 narrative']) });
  assert.equal(missingWords(['Fix the ledger CSV']), 'the list is missing 1 open project: "Fix the ledger CSV" — send every open project, in order');
  assert.deepEqual(reorderCheck([], OWNED).ok, false, 'an empty list while open projects exist is missing them');
  assert.deepEqual(reorderCheck([], []), { ok: true }, 'no open project, nothing to rank');
  // The order of the checks: a duplicate is named before a foreign id, a foreign id before a closed one, a closed one before a missing one.
  assert.equal((reorderCheck([FOREIGN, FOREIGN], OWNED) as { rule: string }).rule, 'duplicate');
  assert.equal((reorderCheck([DONE, FOREIGN], OWNED) as { rule: string }).rule, 'not_yours');
  assert.equal((reorderCheck([DONE], OWNED) as { rule: string }).rule, 'not_open');
  // Ranks 1..n; unranked get theirs the first time; no change, no write.
  assert.deepEqual(ranksAfter([C, A, B]), [{ id: C, rank: 1 }, { id: A, rank: 2 }, { id: B, rank: 3 }]);
  assert.equal(ranksChange([B, A, C], OWNED), true, 'C is unranked — the first save ranks it');
  assert.equal(ranksChange([B, A], OWNED.filter((p) => p.id !== C)), false, 'B 1, A 2 already — nothing written, nothing audited');
});

// ── T4 · THE LOG'S PURE RULES, DRIVEN ────────────────────────────────────────

test('T4 the log’s rules: rank order (unranked last, then title); ▲ ▼ as a pure list move, refused at the edges; picks append to the goals — never replacing, duplicates skipped (the box and among the picks), order kept', () => {
  const rows = [
    { rank: null, title: 'b unranked' }, { rank: 2, title: 'second' }, { rank: null, title: 'a unranked' }, { rank: 1, title: 'first' },
  ];
  assert.deepEqual(logOrder(rows).map((r) => r.title), ['first', 'second', 'a unranked', 'b unranked']);
  assert.deepEqual(backlogOrder(rows).map((r) => r.title), logOrder(rows).map((r) => r.title), 'the reflection prompt and THE LOG share one order (journal.ts delegates)');
  assert.match(code('src/lib/operations/journal.ts'), /export const backlogOrder = <T extends \{ readonly rank: number \| null; readonly title: string \}>\(rows: readonly T\[\]\): T\[\] => logOrder\(rows\);/);
  // The move.
  const ids = [A, B, C];
  assert.deepEqual(moveInLog(ids, B, 'up'), [B, A, C]);
  assert.deepEqual(moveInLog(ids, B, 'down'), [A, C, B]);
  assert.deepEqual(moveInLog(ids, A, 'down'), [B, A, C]);
  assert.deepEqual(ids, [A, B, C], 'pure — the list passed in is untouched');
  assert.equal(canMove(ids, A, 'up'), false, 'the first cannot go up');
  assert.equal(canMove(ids, C, 'down'), false, 'the last cannot go down');
  assert.equal(canMove(ids, FOREIGN, 'up'), false, 'an id not listed cannot move');
  assert.throws(() => moveInLog(ids, A, 'up'), /cannot move up/, 'a move that cannot happen throws — the card disables it, never sends it');
  // The picks.
  const typed = linesOf('1. ship JOURNAL-06\n  review   the PR  \n').map(stripListMarker);
  assert.deepEqual(typed, ['ship JOURNAL-06', 'review the PR'], 'the box as the save reads it');
  const { add, skipped } = picksToGoals(typed, ['Film the day card', 'REVIEW the  PR', 'Post the reel', 'film the day card']);
  assert.deepEqual(add, ['Film the day card', 'Post the reel'], 'in the order picked, each once');
  assert.deepEqual(skipped, ['REVIEW the  PR', 'film the day card'], 'already in the box (case and spaces ignored), and the repeat pick');
  assert.equal(appendGoalLines('1. ship JOURNAL-06\n  review   the PR  \n', add), '1. ship JOURNAL-06\n  review   the PR\nFilm the day card\nPost the reel', 'under what is typed — what is typed stays as typed');
  assert.equal(appendGoalLines('', add), 'Film the day card\nPost the reel', 'an empty box takes them alone');
  assert.equal(appendGoalLines('typed', []), 'typed', 'nothing to add changes nothing');
  // A second click adds nothing: the box now holds them.
  const again = picksToGoals(linesOf(appendGoalLines('ship JOURNAL-06', add)).map(stripListMarker), ['Film the day card', 'Post the reel']);
  assert.deepEqual(again, { add: [], skipped: ['Film the day card', 'Post the reel'] });
  assert.equal(picksWords(0, 2), 'nothing added — already in today\'s goals', 'said, never silent');
  assert.equal(picksWords(2, 1), '2 added to today\'s goals · 1 already there — save to keep them');
  assert.equal(picksWords(1, 0), '1 added to today\'s goals — save to keep them');
});

// ── T5 · THE PROJECTS GET: EACH PROJECT'S OPEN TASKS, ONE READ ───────────────

test('T5 the projects GET carries open_tasks beside open_task_count — the same four statuses, display_order, scoped by the user’s own projects and the task’s user_id', () => {
  const p = code(PROJECTS_ROUTE);
  inOrder(p, [
    'const openCountByProject = new Map<string, number>();',
    'const openTasks = projectIds.length',
    'await prisma.operations_project_tasks.findMany({',
    'where: { user_id: user.id, project_id: { in: projectIds }, status: { in: [...OPEN_TASK_STATUSES] } },',
    'select: { id: true, project_id: true, title: true, status: true, display_order: true },',
    "orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],",
    'open_task_count: openCountByProject.get(p.id) ?? 0,',
    'open_tasks: openTasksByProject.get(p.id) ?? [],',
  ], 'the GET');
  const countStatuses = /where: \{ project_id: \{ in: projectIds \}, status: \{ in: \[([^\]]*)\] \} \},\n\s*_count/.exec(p)![1];
  assert.deepEqual([...countStatuses.matchAll(/'(\w+)'/g)].map((m) => m[1]), [...OPEN_TASK_STATUSES], 'the count and the list count the same four');
  assert.deepEqual([...OPEN_TASK_STATUSES], ['open', 'in_progress', 'blocked', 'pending_review']);
  // BACKLOG-02b (Alex, 2026-10-20): not_started is open work — the schema's default, discovery's status (T10 drives it through the log, the rank and THE BACKLOG).
  assert.deepEqual([...OPEN_PROJECT_STATUSES], ['backlog', 'scoped', 'scheduled', 'in_progress', 'blocked', 'not_started']);
  assert.equal((p.match(/operations_project_tasks\.findMany\(/g) ?? []).length, 1, 'one tasks read for every project — never one per project');
});

// ── T6 · THE CARD'S ONE READ, DRIVEN ─────────────────────────────────────────

test('T6 readBacklog (the card’s one projects read) — open projects only, rank order, each with id, book and its open tasks in order; a row without its tasks or a task without its facts is a failure in words', async () => {
  const realFetch = globalThis.fetch;
  let body: unknown = null;
  const asked: string[] = [];
  globalThis.fetch = (async (url: string) => { asked.push(url); return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
  const project = (id: string, title: string, status: string, rank: number | null, tasks: unknown[]) => ({ id, entity_id: 'ent-1', title, status, rank, type: 'engineering', size: null, target_completion_date: null, open_task_count: tasks.length, open_tasks: tasks });
  try {
    body = { projects: [
      project(A, 'Ship the reel kit', 'in_progress', 2, [{ id: 't2', title: 'cut the trailer', status: 'blocked', display_order: 1 }, { id: 't1', title: 'film the day', status: 'open', display_order: 0 }]),
      project(B, 'Fix the ledger CSV', 'backlog', 1, []),
      project(DONE, 'Old project', 'completed', 3, []),
      project(C, 'Write the SOC 2 narrative', 'scoped', null, []),
    ] };
    const ok = await readBacklog();
    assert.equal(asked[0], '/api/operations/projects', 'the one read — the reflection prompt’s');
    assert.ok(ok.ok);
    if (!ok.ok) return;
    assert.deepEqual(ok.value.map((p) => p.title), ['Fix the ledger CSV', 'Ship the reel kit', 'Write the SOC 2 narrative'], 'open only, rank order, unranked last');
    const reel = ok.value[1];
    assert.deepEqual([reel.id, reel.entityId, reel.openTasks], [A, 'ent-1', 2]);
    assert.deepEqual(reel.tasks, [{ id: 't2', title: 'cut the trailer', status: 'blocked', displayOrder: 1 }, { id: 't1', title: 'film the day', status: 'open', displayOrder: 0 }], 'as the GET ordered them');
    // A row without open_tasks — a failure, never an empty log.
    body = { projects: [{ ...project(A, 'Ship the reel kit', 'in_progress', 1, []), open_tasks: undefined }] };
    assert.deepEqual(await readBacklog(), { ok: false, words: 'The backlog could not be read — "Ship the reel kit" came back without its id, its book or its open tasks' });
    body = { projects: [project(A, 'Ship the reel kit', 'in_progress', 1, [{ id: 't1', title: 'film', status: 'open' }])] };
    assert.deepEqual(await readBacklog(), { ok: false, words: 'The backlog could not be read — a task of "Ship the reel kit" came back without its id, title, status or order' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.doesNotMatch(code(READS), /catch \(|\?\? \[\]|\?\? 0|\?\? ''/, 'no silent catch, no invented value');
});

// ── T7 · THE LOG ON THE MORNING CARD ─────────────────────────────────────────

test('T7 THE LOG: above the goals box, outside the journal form; in flight, failed and empty said; ▲ ▼ save the whole list; "+ task" posts the title; "+ project" and the title are LINKS; the picks append to the draft; the save still sends the whole row; no Tasks component mounted', () => {
  const f = code(MORNING_FORM);
  inOrder(f, ['data-journal-form>', '<MorningLog log={log} disabled={busy} onChanged={onLogChanged} onUseAsGoals={useAsGoals} />', '<form className="flex flex-col gap-2 text-xs"', '{MORNING_GOALS_QUESTION}', 'data-journal-field="goals"'], 'THE LOG above the goals box, outside the <form>');
  inOrder(f, ['const useAsGoals = (titles: readonly string[]): { readonly added: number; readonly skipped: number } => {', 'const { add, skipped } = picksToGoals(linesOf(draft.goals).map(stripListMarker), titles);', 'if (add.length > 0) setDraft({ ...draft, goals: appendGoalLines(draft.goals, add) });', 'return { added: add.length, skipped: skipped.length };'], 'the picks: the draft only, against the box as the save reads it');
  assert.match(f, /const read = journalInput\(\{ day, goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: draft\.blocker === '' \? null : draft\.blocker, plan_steps: steps, plan_done: ticks, audit: journal === null \? null : journal\.audit, gaps: journal === null \? null : journal\.gaps, evolution: journal === null \? null : journal\.evolution, direction: journal === null \? null : journal\.direction, alignment: journal === null \? null : journal\.alignment, on_track: journal === null \? null : journal\.on_track, next: journal === null \? null : journal\.next \}\);/, 'F: the save still sends the whole row — the eleven');
  const l = code(LOG);
  inOrder(l, ['data-morning-log>', '{LOG_WORD}', '<Link href={newProjectHref} className={chip} data-log-new-project>{ADD_PROJECT_WORDS}</Link>', 'data-log-loading>{LOG_LOADING_WORDS}', 'data-log-failed>{log.words}', 'data-log-empty>{NO_OPEN_PROJECTS_WORDS}', 'data-log-projects>', 'data-log-rank>{rankWords(p.rank)}', '<Link href={projectHref(p.id)}', 'data-log-project-link>{p.title}</Link>', 'data-log-up>▲', 'data-log-down>▼', 'data-log-add-task>{ADD_TASK_WORDS}', 'data-log-task-form>', 'data-log-tasks>', 'data-log-no-tasks>{NO_OPEN_TASKS_WORDS}', 'data-log-pick={t.id}', 'data-log-use-as-goals>{USE_AS_GOALS_WORDS}', 'data-log-words>{words.words}'], 'THE LOG, in order');
  assert.match(l, /const projects = log !== null && log\.ok \? logOrder\(log\.value\) : \[\];/, 'rank order, always');
  assert.match(l, /const answer = await reorderProjects\(moveInLog\(ids, id, dir\)\);/, '▲ ▼ send the WHOLE ordered list');
  assert.match(l, /const answer = await reorderProjects\(moveInLog\(ids, id, dir\)\);\n[^\n]*\n\s*if \(!answer\.ok\) \{ setWords\(\{ ok: false, words: answer\.message \}\); onChanged\(\); return; \}/, 'a refused rank re-reads the log — a project opened elsewhere joins the next list');
  assert.match(l, /const answer = await addTask\(projectId, title\);/, '"+ task" posts the title');
  assert.match(l, /const answer = await addTask\(projectId, title\);\n\s*if \(!answer\.ok\) \{ setWords\(\{ ok: false, words: answer\.message \}\); return; \}\n\s*setAddingFor\(null\);\n\s*setTaskTitle\(''\);\n\s*onChanged\(\);/, 'a refused task is said and its box kept; an added one closes the box and re-reads the log');
  assert.doesNotMatch(l, /ProjectCreateForm|from '\.\.\/projects\/|from '\.\.\/SectionD|localStorage|sessionStorage|document\.cookie|dnd|draggable/, 'no Tasks component (TOOL-LAW-01), nothing stored, no drag library');
  for (const fl of [MORNING_FORM, LOG, WRITES, CARD]) assert.doesNotMatch(code(fl), /ProjectCreateForm|SectionD_ProjectBacklog|ProjectsTable|ProjectRow\b/, `${fl} mounts nothing of Tasks’`);
  const w = code(WRITES);
  assert.match(w, /fetch\('\/api\/operations\/projects\/reorder', \{\n\s*method: 'PATCH',[\s\S]*?body: JSON\.stringify\(\{ ids \}\),/);
  assert.match(w, /fetch\(`\/api\/operations\/projects\/\$\{encodeURIComponent\(projectId\)\}\/tasks`, \{\n\s*method: 'POST',[\s\S]*?body: JSON\.stringify\(\{ title \}\),/, 'title only');
  assert.match(w, /import \{ answerOf, type JournalWriteAnswer \} from '\.\/journalWrites';/, 'the journal writer’s reader — one, not two');
  // The card: the one read, re-read after a log write, handed to the form.
  const c = code(CARD);
  assert.match(c, /log=\{backlogRead\} onChanged=\{\(\) => setJournalReads\(\(n\) => n \+ 1\)\} onLogChanged=\{\(\) => setLogReads\(\(n\) => n \+ 1\)\} \/>/);
  assert.match(c, /\}, \[day, hasJournalStop, journalReads, recordReads, dayWrites, logReads\]\);/, 'the log re-read after a log write');
  // The words.
  assert.deepEqual([LOG_WORD, LOG_LOADING_WORDS, NO_OPEN_PROJECTS_WORDS, NO_OPEN_TASKS_WORDS, ADD_PROJECT_WORDS, ADD_TASK_WORDS, USE_AS_GOALS_WORDS], ['THE LOG', 'reading the projects…', '— no open projects —', '— no open tasks —', '+ project', '+ task', 'use as today\'s goals']);
  assert.equal(REFLECTION_PROMPT_NO_BACKLOG, NO_OPEN_PROJECTS_WORDS, 'the prompt and the card say the same words, from one home');
  assert.equal(rankWords(3), '#3');
  assert.equal(rankWords(null), '#—');
  assert.equal(moveWords('Ship it', 'up'), 'move "Ship it" up');
  // The /time page still mounts the ledger first — HOME-01 (Alex, 2026-10-24): the card is on the dashboard (the Runway panel mounts it; home01.test.ts).
  assert.match(code(TIME_PAGE), /data-tool-page="Time">\n\s*<LedgerSection \/>/);
  assert.match(code('src/components/home/ModuleLauncher.tsx'), /<Suspense>\n\s*<DayCard \/>\n\s*<\/Suspense>/);
});

// ── T8 · THE DOORS TO /tasks ─────────────────────────────────────────────────

test('T8 the doors: /tasks?project=<id> makes that row the jump target or says "project not found"; /tasks?new=project opens the capture form through startCreate once the books are read; both cleared from the URL after use; the list in its own Suspense boundary', () => {
  assert.equal(newProjectHref, '/tasks?new=project');
  assert.equal(projectHref(A), `/tasks?project=${A}`);
  assert.equal(projectHref('a b'), '/tasks?project=a%20b', 'encoded');
  assert.deepEqual([TASKS_PROJECT_PARAM, TASKS_NEW_PARAM, TASKS_NEW_PROJECT], ['project', 'new', 'project']);
  assert.equal(PROJECT_NOT_FOUND_WORDS, 'project not found');
  assert.equal(NEW_PROJECT_WAITS_WORDS, 'the capture form opens once your books are read');
  assert.equal(newParamWords('task'), 'nothing opens for new=task — only new=project');
  const s = code(LIST);
  assert.match(s, /import \{ useSearchParams \} from 'next\/navigation';/);
  inOrder(s, [
    'const projectParam = search.get(TASKS_PROJECT_PARAM);',
    'const newParam = search.get(TASKS_NEW_PARAM);',
    'const dropParam = (name: string) => {',
    'const next = new URLSearchParams(window.location.search);',
    'next.delete(name);',
    "window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);",
    'if (projectParam === null || loading || error !== null) return;',
    'if (projects.some((p) => p.id === projectParam)) {',
    'setTargetProjectId(projectParam);',
    'setDoorWords(PROJECT_NOT_FOUND_WORDS);',
    'dropParam(TASKS_PROJECT_PARAM);',
    'if (newParam !== TASKS_NEW_PROJECT) {',
    'setDoorWords(newParamWords(newParam));',
    'if (entities.length === 0) return;',
    'startCreate();',
    'dropParam(TASKS_NEW_PARAM);',
  ], 'the two params, read, acted on and cleared');
  inOrder(s, ['data-projects-new-waits>{NEW_PROJECT_WAITS_WORDS}', 'data-projects-door-words>', '{doorWords}', '<ProjectCreateForm'], 'the words said above the form and the list');
  assert.match(s, /onClick=\{startCreate\}/, '"+ new project" and the door open the form the same way');
  assert.match(code('src/components/workbench/operations/projects/ProjectRow.tsx'), /if \(!isJumpTarget\) return;\n\s*rowRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'center' \}\);\n\s*setExpanded\(true\);/, 'the jump target scrolls to and expands the row — the dependency jump’s own path');
  const page = code(TASKS_PAGE);
  assert.match(page, /import \{ Suspense \} from 'react';/);
  // WORK-01d (Alex, 2026-10-25): ROUTINE EXPENSES mounts after the boundary — the boundary still holds the projects list alone.
  assert.match(page, /<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<SectionF_RoutineExpenses \/>\n\s*<\/div>/, 'the boundary holds the projects list alone');
  assert.match(comments(TASKS_PAGE), /BACKLOG-02 \(Alex, 2026-10-20\): the projects list reads two URL params/);
});

// ── T9 · NOTHING ELSE ────────────────────────────────────────────────────────

test('T9 nothing else: the capture form is mounted on /tasks alone; the tasks route is unchanged; nothing schedules a pick; the day folder keeps its files', () => {
  const mounts = ['src/components/workbench/operations/SectionD_ProjectBacklog.tsx'];
  for (const f of [CARD, MORNING_FORM, LOG, TIME_PAGE]) assert.ok(!mounts.includes(f) && !/<ProjectCreateForm/.test(code(f)), `${f} does not mount the capture form`);
  assert.match(code(LIST), /<ProjectCreateForm/, 'its one home');
  assert.doesNotMatch(code(LOG) + code(WRITES), /daily-plan|daily_plan|schedule/i, 'picking does not schedule (ruling E)');
  assert.doesNotMatch(code(TASKS_ROUTE), /BACKLOG-02/, 'the tasks route is used as it is');
  // morningLog.ts imports only TYPES from journal.ts, and journal.ts imports logOrder from it — one direction at run time, no cycle.
  assert.match(code(RULE), /^import type \{ ReflectionBacklogRow \} from '\.\/journal';$/m);
  assert.doesNotMatch(code(RULE), /^import (?!type)[^\n]*from '\.\/journal';$/m, 'no runtime import of journal.ts');
  assert.match(code('src/lib/operations/journal.ts'), /import \{ NO_OPEN_PROJECTS_WORDS, logOrder \} from '\.\/morningLog';/);
  const day = readdirSync(resolve(process.cwd(), 'src/components/workbench/operations/day')).sort();
  assert.ok(!day.includes('MorningLog.tsx'), 'THE LOG lives with the forms (stops/), not in the day folder');
});

// ── T10 · BACKLOG-02b: not_started IS OPEN WORK ──────────────────────────────

test('T10 BACKLOG-02b not_started is open work — the schema’s default and discovery’s status: in THE LOG (its status as it is), rankable by the reorder rule (and named when left out), and in THE BACKLOG', async () => {
  // BACKLOG-02b (Alex, 2026-10-20): "not_started is open work … and must not be invisible."
  const NS = '55555555-5555-4555-8555-555555555555';
  assert.equal(isOpenProjectStatus('not_started'), true);
  assert.equal(isOpenProjectStatus('completed'), false, 'done is still done');
  assert.match(code('prisma/schema.prisma'), /status\s+ProjectStatus @default\(not_started\)/, 'the schema’s default — why it must be open');
  assert.match(code('src/lib/discovery/materializeProposal.ts'), /status: 'not_started'/, 'discovery creates projects that way');
  // THE LOG — the card's one read keeps it, in rank order, its status as the GET answers it.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ projects: [
    { id: B, entity_id: 'ent-1', title: 'Fix the ledger CSV', status: 'backlog', rank: 1, type: 'engineering', size: 'M', target_completion_date: null, open_task_count: 0, open_tasks: [] },
    { id: NS, entity_id: 'ent-1', title: 'Discovered: tidy the vendor names', status: 'not_started', rank: null, type: 'engineering', size: null, target_completion_date: null, open_task_count: 1, open_tasks: [{ id: 't9', title: 'list the duplicates', status: 'open', display_order: 0 }] },
    { id: DONE, entity_id: 'ent-1', title: 'Old project', status: 'completed', rank: 3, type: null, size: null, target_completion_date: null, open_task_count: 0, open_tasks: [] },
  ] }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  let log;
  try {
    log = await readBacklog();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(log.ok);
  if (!log.ok) return;
  assert.deepEqual(log.value.map((p) => [p.title, p.status]), [['Fix the ledger CSV', 'backlog'], ['Discovered: tidy the vendor names', 'not_started']], 'in the log, unranked after the ranked, the completed one still out');
  assert.deepEqual(log.value[1].tasks.map((t) => t.title), ['list the duplicates'], 'with its open tasks');
  assert.match(code(LOG), /<span className="text-text-muted" data-log-status>\{p\.status\}<\/span>/, 'THE LOG prints its status pill as it prints every status — unchanged');
  // THE RANK — the reorder rule ranks it, and refuses a list that leaves it out, by name.
  const owned: OwnedProject[] = [
    { id: B, title: 'Fix the ledger CSV', status: 'backlog', rank: 1 },
    { id: NS, title: 'Discovered: tidy the vendor names', status: 'not_started', rank: null },
  ];
  assert.deepEqual(reorderCheck([NS, B], owned), { ok: true }, 'a list with it passes');
  assert.deepEqual(ranksAfter([NS, B]), [{ id: NS, rank: 1 }, { id: B, rank: 2 }], 'and ranks it');
  assert.equal(ranksChange([NS, B], owned), true);
  assert.deepEqual(reorderCheck([B], owned), { ok: false, rule: 'missing', message: missingWords(['Discovered: tidy the vendor names']) }, 'a list without it is missing it — every open project is ranked');
  assert.match(code(ROUTE), /\{ status: \{ in: \[\.\.\.OPEN_PROJECT_STATUSES\] \} \}/, 'the route reads the open projects through the one set — not_started among them');
  // THE BACKLOG — the reflection prompt prints it from the same read.
  const text = reflectionPromptText({ dayWords: 'Tue Oct 20', journal: null, stops: [], budgetWords: '—', actualWords: '—', verdictWords: null, backlog: log.value, moved: [] });
  inOrder(text, ['\nTHE BACKLOG\n', '- #1 · Fix the ledger CSV · engineering · backlog · M · target — · open tasks 0\n', '- #— · Discovered: tidy the vendor names · engineering · not_started · — · target — · open tasks 1\n', '\nWHAT MOVED TODAY\n'], 'THE BACKLOG lists it');
  assert.doesNotMatch(text, /Old project/, 'the completed one is still not the backlog');
});
