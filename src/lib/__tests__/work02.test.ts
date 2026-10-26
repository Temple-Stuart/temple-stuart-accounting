/**
 * WORK-02 (Alex, 2026-10-26) — THE WORK BLOCK: tick tasks done inside the execute stop.
 *
 * On the step view, when the focused stop's role is `execute`, THE WORK BLOCK mounts between the VENDOR row and the
 * record form — for no other role, never on the journal card (ruling A). TO DO = the open tasks of the open projects from
 * the card's existing backlog read, grouped under their project, each with one ✓ — the existing quick-complete, lifted,
 * never copied; after a write the card re-reads (ruling B). DONE IN THIS BLOCK = the tasks whose completed_at falls inside
 * [the stop's planned instant, + the line's minutes]; no minutes → nothing and the declared words; each row with its
 * time in the viewer's zone and ↩ (the existing uncomplete POST); derived from completed_at, labelled so (ruling C). The
 * projects GET takes ?done_from=&done_to= and answers done_tasks — one query, user-scoped twice; without the params the
 * answer is as it was; one without the other, a non-instant and from after to are refused by name (ruling D). The record
 * form, the reel's words and THE LOG are unchanged; no schema, no migration, no new route (ruling E). The pure rules are
 * driven over fixtures; the route, the read, the card and the panel are pinned to their source with comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  DONE_BY_WORDS, DONE_IN_BLOCK_WORD, DONE_NOT_READ_WORDS, NOTHING_DONE_WORDS, NO_LENGTH_WORDS, TICK_WORDS, TO_DO_WORD, UNTICK_REASON_WORDS, UNTICK_WORDS, WORK_BLOCK_WORD,
  blockWindowOf, dayWindowOf, doneInBlockOf, doneRowWords, doneTimeWords, doneWindowInput, isIsoInstant, notAnInstantWords, showsWorkBlock, tickWords, untickWords, windowOrderWords, withoutTheOtherWords,
  type BlockStop,
} from '../operations/workBlock';
import { readBacklog } from '@/components/workbench/operations/day/dayReads';

const RULE = 'src/lib/operations/workBlock.ts';
const PANEL = 'src/components/workbench/operations/stops/WorkBlock.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const ROUTE = 'src/app/api/operations/projects/route.ts';
const ACTIONS = 'src/components/workbench/operations/projects/useTaskActions.ts';
const MORNING_LOG = 'src/components/workbench/operations/stops/MorningLog.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const STOP_ROLE = 'src/lib/operations/stopRole.ts';
const SHAPES = 'src/lib/operations/morningLog.ts';
const LAW = 'scripts/assert-tool-registry.ts';

const LA = 'America/Los_Angeles';
const DAY = '2026-10-26';
const stop = (over: Partial<BlockStop> & { readonly role: BlockStop['role'] }): BlockStop => ({ key: 'line:s1:2026-10-26T17:00:00.000Z', time: '10:00', zone: LA, minutes: 480, ...over });
const EXECUTE = stop({ role: 'execute' });
const done = (id: string, title: string, completedAt: string) => ({ id, title, completedAt });

// ── RULING A · WHERE IT MOUNTS ───────────────────────────────────────────────

test('A the block shows for the execute role alone — not place, none, journal, plan or all_day; the card mounts it between the VENDOR row and the record form, keyed on the stop; never on the journal card', () => {
  assert.equal(showsWorkBlock(EXECUTE), true);
  for (const role of ['place', 'none', 'journal', 'plan', 'all_day'] as const) assert.equal(showsWorkBlock(stop({ role })), false, `${role}: no block`);
  const c = code(CARD);
  assert.match(c, /import \{ dayWindowOf, showsWorkBlock \} from '@\/lib\/operations\/workBlock';/);
  assert.match(c, /import WorkBlock from '\.\.\/stops\/WorkBlock';/);
  // VENDOR → WORK BLOCK → StopForm, in that order, each under its own gate; the block's gate is the rule (showsWorkBlock), not a retyped role.
  assert.match(c, /<StopVendor key=\{focus\.stop\.key\}[^\n]*\/>\n\s*\)\}\n(?:\s*\{\s*\}\n)?\s*\{loaded && focus !== null && showsWorkBlock\(focus\.stop\) && \(\n\s*<WorkBlock key=\{focus\.stop\.key\} stop=\{focus\.stop\} day=\{day\} viewerZone=\{zone\} log=\{backlogRead\} onChanged=\{\(\) => setLogReads\(\(n\) => n \+ 1\)\} \/>\n\s*\)\}\n(?:\s*\{\s*\}\n)?\s*\{loaded && recordsOk && focus !== null && focus\.stop\.address !== null && \(\n\s*<StopForm key=/, 'the VENDOR row, then the block, then the record form');
  assert.equal((c.match(/<WorkBlock /g) ?? []).length, 1, 'mounted once');
  const journalSection = c.slice(c.indexOf('data-day-journal-section'), c.indexOf('data-day-foot'));
  assert.doesNotMatch(journalSection, /WorkBlock|showsWorkBlock/, 'never on the journal card');
  assert.equal((c.match(/role === 'execute'/g) ?? []).length, 1, 'the card names the role once — the day’s gate (hasExecuteStop, beside hasJournalStop); the mount is the rule’s (showsWorkBlock)');
  // The panel refuses any other stop by name — the rule, not a case.
  const p = code(PANEL);
  assert.match(p, /if \(!showsWorkBlock\(stop\)\) throw new Error\(`WorkBlock: \$\{stop\.key\} is a \$\{stop\.role\} stop — the work block mounts on an execute stop alone`\);/);
  assert.match(p, /^'use client';/m);
  assert.doesNotMatch(p, /\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|\/api\//, 'the panel fetches nothing of its own — the writers are the hook file’s, the read the card’s');
});

// ── RULING B · TO DO ─────────────────────────────────────────────────────────

test('B TO DO is the card’s backlog read: every open project with open tasks, in THE LOG’s order, each task with one ✓ through the lifted quick-complete; a write re-reads the backlog (logReads); no other control', () => {
  const p = code(PANEL);
  assert.match(p, /import \{ completeTask, uncompleteTask, type TaskWriteAnswer \} from '\.\.\/projects\/useTaskActions';/, 'the one writer, lifted');
  assert.match(p, /const toDo = projects === null \? null : projects\.filter\(\(p\) => p\.tasks\.length > 0\);/, 'the open tasks of the open projects, in the order the read gave (THE LOG’s)');
  assert.match(p, /\{toDo !== null && toDo\.map\(\(p\) => \(\n\s*<div key=\{p\.id\} data-day-work-project=\{p\.id\}>\n\s*<div className="font-semibold text-text-primary" data-day-work-project-title>\{p\.title\}<\/div>/, 'grouped under the project');
  assert.match(p, /onClick=\{\(\) => write\(t\.id, \(\) => completeTask\(p\.id, t\.id\)\)\} data-day-work-tick=\{t\.id\}>\{TICK_WORDS\}<\/button>\n\s*<span data-day-work-task-title>\{t\.title\}<\/span>/, 'the row: ✓ and the title');
  assert.doesNotMatch(p, /edit|schedule|archive|<input|<Link|href=/, 'no other control — edit, schedule, archive stay on /tasks');
  assert.match(p, /if \(!answer\.ok\) \{ setRefused\(\{ id, words: answer\.words \}\); return; \}\n\s*onChanged\(\);/, 'ok → the card re-reads; refused → the words beside the row');
  assert.match(p, /data-day-work-refused=\{t\.id\}>\{refused\.words\}<\/span>/);
  // The writers: lifted out of the hook's two handlers into the same file — the handlers call them; nine fetches still (projects01 pins the count).
  const a = code(ACTIONS);
  assert.match(a, /export async function completeTask\(projectId: string, taskId: string\): Promise<TaskWriteAnswer> \{\n\s*const res = await fetch\(\n\s*`\/api\/operations\/projects\/\$\{projectId\}\/tasks\/\$\{taskId\}`,\n\s*\{\n\s*method: 'PATCH',\n\s*headers: \{ 'Content-Type': 'application\/json' \},\n\s*body: JSON\.stringify\(\{ status: 'completed' \}\),/);
  assert.match(a, /export async function uncompleteTask\(projectId: string, taskId: string, reason: string \| undefined\): Promise<TaskWriteAnswer> \{\n\s*const res = await fetch\(\n\s*`\/api\/operations\/projects\/\$\{projectId\}\/tasks\/\$\{taskId\}\/uncomplete`,\n\s*\{\n\s*method: 'POST',/);
  assert.match(a, /const handleQuickComplete = async \(e: React\.MouseEvent\) => \{[\s\S]*?const answer = await completeTask\(projectId, task\.id\);\n\s*if \(!answer\.ok\) \{\n\s*setError\(answer\.words\);\n\s*return;\n\s*\}\n\s*onUpdate\(\);/, 'the hook’s quick-complete calls the lifted writer');
  assert.match(a, /const handleUncomplete = async \(\) => \{\n\s*const reason = window\.prompt\('Reason for uncompleting\? \(optional\)'\) \?\? undefined;\n\s*try \{\n\s*const answer = await uncompleteTask\(projectId, task\.id, reason \|\| undefined\);\n\s*if \(!answer\.ok\) throw new Error\(answer\.words\);\n\s*onUpdate\(\);/, 'the hook’s uncomplete calls the lifted writer, its prompt and alert kept');
  assert.equal((a.match(/\bfetch\s*\(/g) ?? []).length, 9, 'nine fetches in the one home, as before — two of them lifted, none copied');
  assert.equal((a.match(/status: 'completed'/g) ?? []).length, 1, 'one quick-complete body in the codebase’s task writers');
  assert.doesNotMatch(code(PANEL) + code(CARD) + code(READS), /status: 'completed'|\/uncomplete/, 'no copied fetch on the card');
});

// ── RULING C · DONE IN THIS BLOCK ────────────────────────────────────────────

test('C the window: [the stop’s planned instant, + the line’s minutes] — a 10:00 stop with 480 minutes is [10:00, 18:00] in the stop’s instant terms; no minutes → null and the declared words; a stepless routine has none', () => {
  const w = blockWindowOf(EXECUTE, DAY);
  assert.ok(w !== null);
  assert.deepEqual([w.from.toISOString(), w.to.toISOString()], ['2026-10-26T17:00:00.000Z', '2026-10-27T01:00:00.000Z'], '10:00–18:00 Los Angeles (PDT) as instants');
  assert.equal(w.from.toISOString(), EXECUTE.key.split(':').slice(2).join(':'), 'the window starts at the stop’s instant');
  assert.equal(blockWindowOf(stop({ role: 'execute', minutes: null }), DAY), null, 'no minutes: no length');
  assert.equal(blockWindowOf(stop({ role: 'execute', key: 'routine:r1:2026-10-26T17:00:00.000Z', minutes: null }), DAY), null, 'a stepless routine has none (dayCard.ts: minutes null)');
  assert.deepEqual(blockWindowOf(stop({ role: 'execute', minutes: 0 }), DAY), { from: new Date('2026-10-26T17:00:00.000Z'), to: new Date('2026-10-26T17:00:00.000Z') }, 'zero minutes is a window of no span, not "no length"');
  assert.throws(() => blockWindowOf(stop({ role: 'execute', minutes: 1.5 }), DAY), /whole number of minutes/);
  assert.throws(() => blockWindowOf(stop({ role: 'execute', time: null }), DAY), /has minutes but no clock/);
  assert.equal(NO_LENGTH_WORDS, "this block has no length — set the line's minutes on /expenses to count what was done in it");
  // The rule is the day card's: the line's duration_minutes, a stepless routine's null — dayCard.ts, unchanged.
  assert.match(code(CARD_RULES), /minutes: step\.duration_minutes,/);
  assert.match(code(CARD_RULES), /minutes: null,\n\s*cents: line === null \? null : line\.cents,\n\s*role: r\.role,/, 'a stepless routine: minutes null');
  assert.match(code(RULE), /const from = zonedToInstant\(day, stop\.time, stop\.zone\);\n\s*return \{ from, to: new Date\(from\.getTime\(\) \+ stop\.minutes \* 60_000\) \};/);
});

test('C doneInBlockOf: completed_at inside [10:00, 18:00] (both ends in), earliest first; 09:59 and 18:01 excluded; a non-instant thrown by name; the row words "<title> · HH:MM" in the viewer’s zone; the tooltip says by completed_at', () => {
  const w = blockWindowOf(EXECUTE, DAY)!;
  const rows = [
    done('late', 'after the block', '2026-10-27T01:01:00.000Z'),   // 18:01
    done('end', 'at the end', '2026-10-27T01:00:00.000Z'),          // 18:00 — in
    done('mid', 'in the middle', '2026-10-26T21:30:00.000Z'),       // 14:30
    done('early', 'before the block', '2026-10-26T16:59:59.999Z'), // 09:59
    done('start', 'at the start', '2026-10-26T17:00:00.000Z'),      // 10:00 — in
    done('mid2', 'also in the middle', '2026-10-26T21:30:00.000Z'), // 14:30 — tie, by title
  ];
  assert.deepEqual(doneInBlockOf(rows, w).map((t) => t.id), ['start', 'mid2', 'mid', 'end']);
  assert.deepEqual(doneInBlockOf([], w), []);
  assert.throws(() => doneInBlockOf([done('x', 'bad', 'yesterday')], w), /task x completed_at "yesterday" is not an instant/);
  assert.equal(doneTimeWords('2026-10-26T21:30:00.000Z', LA), '14:30');
  assert.equal(doneTimeWords('2026-10-26T21:30:00.000Z', 'Asia/Bangkok'), '04:30', 'the viewer’s zone');
  assert.equal(doneRowWords('in the middle', '14:30'), 'in the middle · 14:30');
  assert.deepEqual([WORK_BLOCK_WORD, TO_DO_WORD, DONE_IN_BLOCK_WORD, DONE_BY_WORDS, NOTHING_DONE_WORDS, DONE_NOT_READ_WORDS, TICK_WORDS, UNTICK_WORDS, UNTICK_REASON_WORDS], ['THE WORK BLOCK', 'TO DO', 'DONE IN THIS BLOCK', 'by completed_at', '— nothing done in this block yet —', 'the tasks done today were not read with the backlog', '✓', '↩', 'unticked on the work block']);
  assert.deepEqual([tickWords('film the day'), untickWords('film the day')], ['done: film the day', 'not done after all: film the day']);
  // The panel: the two parts in order, the window from the rule, the day's done tasks narrowed here, the tooltip, ↩ through the lifted uncomplete with the declared reason, the words for no length and for nothing done.
  const p = code(PANEL);
  assert.ok(p.indexOf('data-day-work-todo') < p.indexOf('data-day-work-done'), 'TO DO, then DONE IN THIS BLOCK');
  assert.match(p, /const block = blockWindowOf\(stop, day\);/);
  assert.match(p, /const done = doneToday === null \|\| doneToday === 'not read' \|\| block === null \? null : doneInBlockOf\(doneToday, block\);/, 'narrowed client-side by the pure rule');
  assert.match(p, /<div className="space-y-1" data-day-work-done title=\{DONE_BY_WORDS\}>/, 'labelled: by completed_at');
  assert.match(p, /\{block === null && <div className="text-text-muted" data-day-work-no-length>\{NO_LENGTH_WORDS\}<\/div>\}/);
  assert.match(p, /\{done !== null && done\.length === 0 && <div className="text-text-muted" data-day-work-nothing-done>\{NOTHING_DONE_WORDS\}<\/div>\}/);
  assert.match(p, /onClick=\{\(\) => write\(t\.id, \(\) => uncompleteTask\(t\.projectId, t\.id, UNTICK_REASON_WORDS\)\)\} data-day-work-untick=\{t\.id\}>\{UNTICK_WORDS\}<\/button>\n\s*<span data-day-work-done-words>\{doneRowWords\(t\.title, doneTimeWords\(t\.completedAt, viewerZone\)\)\}<\/span>/);
  assert.match(p, /if \(p\.doneTasks === undefined\) return 'not read';/, 'an answer without the done tasks is said, never an empty list');
  // No sentence of its own: every string the panel prints is a constant or a words function.
  const printed = [...p.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.ok(printed.length >= 8);
  for (const s of printed) assert.doesNotMatch(s, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${s} is not a literal sentence`);
  assert.doesNotMatch(p, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
});

// ── RULING D · THE READ ──────────────────────────────────────────────────────

test('D doneWindowInput: none → no window; both ISO instants in order → the window; one without the other, a non-instant, from after to — refused by name; dayWindowOf is the day’s midnight to the last millisecond before the next, in the viewer’s zone', () => {
  assert.deepEqual(doneWindowInput(null, null), { kind: 'none' });
  const ok = doneWindowInput('2026-10-26T07:00:00.000Z', '2026-10-27T06:59:59.999Z');
  assert.deepEqual(ok, { kind: 'window', from: new Date('2026-10-26T07:00:00.000Z'), to: new Date('2026-10-27T06:59:59.999Z') });
  assert.deepEqual(doneWindowInput('2026-10-26T07:00:00Z', '2026-10-26T07:00:00Z'), { kind: 'window', from: new Date('2026-10-26T07:00:00Z'), to: new Date('2026-10-26T07:00:00Z') }, 'the fraction is optional; from = to is a window');
  assert.deepEqual(doneWindowInput('2026-10-26T07:00:00.000Z', null), { kind: 'refused', field: 'done_to', message: 'done_from is given without done_to — both or neither' });
  assert.deepEqual(doneWindowInput(null, '2026-10-26T07:00:00.000Z'), { kind: 'refused', field: 'done_from', message: 'done_to is given without done_from — both or neither' });
  assert.deepEqual(doneWindowInput('2026-10-26', '2026-10-27T06:59:59.999Z'), { kind: 'refused', field: 'done_from', message: 'done_from "2026-10-26" is not an ISO instant (YYYY-MM-DDTHH:MM:SS.sssZ)' });
  assert.deepEqual(doneWindowInput('2026-10-26T07:00:00.000Z', 'yesterday'), { kind: 'refused', field: 'done_to', message: 'done_to "yesterday" is not an ISO instant (YYYY-MM-DDTHH:MM:SS.sssZ)' });
  assert.deepEqual(doneWindowInput('2026-10-26T07:00:00.000', '2026-10-27T06:59:59.999Z').kind, 'refused', 'no Z: not an instant');
  assert.deepEqual(doneWindowInput('2026-13-26T07:00:00.000Z', '2026-10-27T06:59:59.999Z').kind, 'refused', 'month 13: no real moment');
  assert.deepEqual(doneWindowInput('2026-10-27T06:59:59.999Z', '2026-10-26T07:00:00.000Z'), { kind: 'refused', field: 'done_from', message: 'done_from 2026-10-27T06:59:59.999Z is after done_to 2026-10-26T07:00:00.000Z' });
  assert.deepEqual([isIsoInstant('2026-10-26T07:00:00.000Z'), isIsoInstant('2026-10-26T07:00:00.000+07:00'), isIsoInstant('')], [true, false, false]);
  assert.deepEqual([withoutTheOtherWords('done_from', 'done_to'), notAnInstantWords('done_to', 'x'), windowOrderWords('a', 'b')], ['done_from is given without done_to — both or neither', 'done_to "x" is not an ISO instant (YYYY-MM-DDTHH:MM:SS.sssZ)', 'done_from a is after done_to b']);
  const dayW = dayWindowOf(DAY, LA);
  assert.deepEqual([dayW.from.toISOString(), dayW.to.toISOString()], ['2026-10-26T07:00:00.000Z', '2026-10-27T06:59:59.999Z'], 'the WHAT MOVED TODAY window');
  // The route: refused by name BEFORE any read; the done query only with a window — status completed, completed_at in [from, to], user-scoped twice, one query; done_tasks on the row only then.
  const r = code(ROUTE);
  assert.match(r, /import \{ doneWindowInput \} from '@\/lib\/operations\/workBlock';/);
  assert.match(r, /const done = doneWindowInput\(searchParams\.get\('done_from'\), searchParams\.get\('done_to'\)\);\n\s*if \(done\.kind === 'refused'\) return NextResponse\.json\(\{ error: 'Validation', field: done\.field, message: done\.message \}, \{ status: 400 \}\);/);
  assert.ok(r.indexOf("searchParams.get('done_from')") < r.indexOf('prisma.operations_projects.findMany('), 'refused before the first read');
  assert.match(r, /const doneTasks = done\.kind === 'window' && projectIds\.length\n\s*\? await prisma\.operations_project_tasks\.findMany\(\{\n\s*where: \{ user_id: user\.id, project_id: \{ in: projectIds \}, status: 'completed', completed_at: \{ gte: done\.from, lte: done\.to \} \},\n\s*select: \{ id: true, project_id: true, title: true, completed_at: true \},\n\s*orderBy: \[\{ completed_at: 'asc' \}, \{ created_at: 'asc' \}\],\n\s*\}\)\n\s*: \[\];/, 'one query, user-scoped twice (the user’s projects and the task’s user_id)');
  assert.match(r, /if \(t\.completed_at === null\) throw new Error\(`Projects GET: task \$\{t\.id\} is completed inside the window with no completed_at`\);/);
  assert.match(r, /open_tasks: openTasksByProject\.get\(p\.id\) \?\? \[\],\n\s*\.\.\.\(done\.kind === 'window' \? \{ done_tasks: doneTasksByProject\.get\(p\.id\) \?\? \[\] \} : \{\}\),\n\s*run_count: runCountByProject\.get\(p\.id\) \?\? 0,/, 'done_tasks only when asked — without the params the row is as it was');
  assert.equal((r.match(/done_tasks/g) ?? []).length, 1, 'the field is written in one place, under the one condition');
  // The open query is untouched (backlog02 pins it); this adds a second tasks read, still one for every project.
  assert.match(r, /where: \{ user_id: user\.id, project_id: \{ in: projectIds \}, status: \{ in: \[\.\.\.OPEN_TASK_STATUSES\] \} \},/);
});

test('D readBacklog with a window asks the GET for it and carries doneTasks per row; without one it reads as it did (no doneTasks key); a row without done_tasks, or a done task without its facts, is a failure in words', async () => {
  const realFetch = globalThis.fetch;
  let body: unknown = null;
  const asked: string[] = [];
  globalThis.fetch = (async (url: string) => { asked.push(url); return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
  const project = (id: string, title: string, rank: number | null, tasks: unknown[], extra: Record<string, unknown> = {}) => ({ id, entity_id: 'ent-1', title, status: 'in_progress', rank, type: 'engineering', size: null, target_completion_date: null, open_task_count: tasks.length, open_tasks: tasks, ...extra });
  const window = dayWindowOf(DAY, LA);
  try {
    body = { projects: [
      project('p1', 'Ship the reel kit', 1, [{ id: 't1', title: 'film the day', status: 'open', display_order: 0 }], { done_tasks: [{ id: 'd1', title: 'cut the trailer', completed_at: '2026-10-26T21:30:00.000Z' }] }),
      project('p2', 'Fix the ledger CSV', 2, [], { done_tasks: [] }),
    ] };
    const withWindow = await readBacklog(window);
    assert.equal(asked[0], '/api/operations/projects?done_from=2026-10-26T07%3A00%3A00.000Z&done_to=2026-10-27T06%3A59%3A59.999Z', 'the same read, with the day’s bounds');
    assert.ok(withWindow.ok);
    if (!withWindow.ok) return;
    assert.deepEqual(withWindow.value.map((p) => [p.id, p.doneTasks]), [['p1', [{ id: 'd1', title: 'cut the trailer', completedAt: '2026-10-26T21:30:00.000Z' }]], ['p2', []]]);
    assert.deepEqual(withWindow.value[0].tasks, [{ id: 't1', title: 'film the day', status: 'open', displayOrder: 0 }], 'the open tasks as before');
    // Without a window: the URL and the rows as they were — no doneTasks key at all.
    body = { projects: [project('p1', 'Ship the reel kit', 1, [])] };
    const plain = await readBacklog();
    assert.equal(asked[1], '/api/operations/projects');
    assert.ok(plain.ok);
    if (!plain.ok) return;
    assert.equal('doneTasks' in plain.value[0], false, 'no key when no window was asked');
    // A row without done_tasks when a window was asked — a failure, never an empty list.
    body = { projects: [project('p1', 'Ship the reel kit', 1, [])] };
    assert.deepEqual(await readBacklog(window), { ok: false, words: 'The backlog could not be read — "Ship the reel kit" came back without its done tasks' });
    body = { projects: [project('p1', 'Ship the reel kit', 1, [], { done_tasks: [{ id: 'd1', title: 'cut the trailer' }] })] };
    assert.deepEqual(await readBacklog(window), { ok: false, words: 'The backlog could not be read — a done task of "Ship the reel kit" came back without its id, title or completed_at' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.match(code(SHAPES), /export interface LogDoneTask \{\n\s*readonly id: string;\n\s*readonly title: string;\n\s*readonly completedAt: string;\n\}/);
  assert.match(code(SHAPES), /readonly tasks: readonly LogTask\[\];\n\s*readonly doneTasks\?: readonly LogDoneTask\[\];\n\}/);
  assert.doesNotMatch(code(READS), /catch \(|\?\? \[\]|\?\? 0|\?\? ''/, 'no silent catch, no invented value');
  // The card: the read runs for a journal OR an execute stop; the window — the day's bounds in the viewer's zone — only for an execute stop.
  const c = code(CARD);
  assert.match(c, /const hasExecuteStop = readsDay === day && dayRead !== null && dayRead\.ok && dayRead\.value\.entries\.some\(\(e\) => e\.routine\.role === 'execute'\);/);
  assert.match(c, /if \(day === null \|\| !\(hasJournalStop \|\| hasExecuteStop\)\) return;\n\s*const doneWindow = hasExecuteStop && zone !== null \? dayWindowOf\(day, zone\) : null;\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const b = await readBacklog\(doneWindow\);/);
});

// ── RULING E · UNCHANGED ─────────────────────────────────────────────────────

test('E the record form, the execute words, the reel’s words and THE LOG are unchanged; no schema, no migration, no new route; the law’s mount rule holds — the panel is the card’s own, under stops/, and names the rule', () => {
  for (const f of [STOP_FORM, STOP_ROLE, CARD_RULES, MORNING_LOG]) assert.doesNotMatch(code(f) + comments(f), /WORK-02|WorkBlock|workBlock|doneTasks|done_tasks/, `${f} is untouched`);
  assert.match(code(STOP_FORM), /: \{ amount: false, rating: false, minutes: true, note: true \};/, 'a work stop (plan · execute): the minutes and one line, as before');
  assert.match(code(STOP_ROLE), /execute: 'execute — a work block; what got finished',/);
  assert.match(code(CARD_RULES), /export function stopScriptText\(day: string, stay: StayRow \| null, stop: Stop\): ReelText \{/, 'the reel’s words — WORK-03’s line is not built here');
  assert.match(comments(PANEL), /WORK-03 \(not built here\): a line for the block in the reel's words — dayCard\.ts stopScriptText is unchanged by WORK-02\./);
  assert.doesNotMatch(code(ROUTE) + code(READS) + code(PANEL) + code(RULE), /prisma\.\$executeRaw|ALTER TABLE|migrations/, 'no migration, no raw SQL');
  assert.doesNotMatch(code(RULE), /from 'react'|from 'next|\bfetch\b|@prisma\/client|document\.|window\./, 'the rule stays pure');
  // TOOL-LAW-01 rule 5: a component belonging to tool A may not be mounted on tool B's page — the panel is a Time-owned component reading through the card's read and writing through Tasks' routes; it mounts nothing of Tasks'.
  assert.match(comments(LAW), /5\. A component belonging to tool A may not be mounted on tool B's page\./);
  assert.match(comments(PANEL), /TOOL-LAW-01 rule 5 — "a component belonging to tool A may not be mounted on\s*\n?\s*\*?\s*tool B's page"/);
  assert.doesNotMatch(code(PANEL), /from '\.\.\/projects\/(?!useTaskActions')/, 'nothing of Tasks’ is mounted — the one import from projects/ is the writer file');
  assert.doesNotMatch(code(PANEL), /<TaskRow|<TaskList|<SectionE|<SectionD|<ProjectRow/);
  assert.doesNotMatch(code(CARD), /TaskRow|TaskList|SectionE_Work|SectionD_ProjectBacklog/, 'the card mounts no Tasks component');
});
