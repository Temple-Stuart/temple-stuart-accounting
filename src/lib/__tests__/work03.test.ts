/**
 * WORK-03 (Alex, 2026-10-26) — THE WORK BLOCK REACHES THE REEL.
 *
 * An execute stop's scene gains one line after the note line — "Done in this block: <task>, <task>." in completed_at order, or
 * "Nothing ticked in this block." — from WORK-02's doneInBlockOf over the day's done tasks; an execute stop gets a scene when it
 * shows money OR has at least one task done in its block (ruling A). The caption gains "<name>: <k> tasks done" ("1 task done") for
 * an execute stop with at least one, after its money lines; none ticked adds nothing (ruling B). ReelDay carries, per stop, the tasks
 * done in its block, handed in by the card from the backlog read it already holds; a failed backlog read makes the reel wait on
 * "the backlog" by name (ruling C). A block of ≤ 0 minutes has no length, as a block with no minutes (ruling D). The tag, the plates,
 * the step view and the record form are unchanged; no schema, no migration, no route (ruling E). The pure rules are driven over the
 * reel's own fixture and a day with an execute line; every other stop's scene and caption are proved byte-identical against the
 * texts captured before this change; the card is pinned to its source with comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, functionBody } from '../sourceText';
import type { Routine, RoutineStep } from '@/components/workbench/operations/routines/types';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  DONE_IN_BLOCK_SCENE_WORDS, NOTHING_TICKED_WORDS, REEL_READ_NAMES, captionText, dayStops, doneCountWords, doneInBlockSceneWords, reelDoneOf, reelReadsWords, scriptText, stopSceneLines, stopScriptText,
  type ReelReads,
} from '@/components/workbench/operations/day/dayCard';
import { NO_DONE_IN_BLOCKS, NO_LENGTH_WORDS, blockWindowOf, carriesDoneTasks, doneInBlocksOf } from '../operations/workBlock';
import { DAY, FULL, HALF, STAY, STOPS, build, entry, input, line, reelDay, routine, vendor } from './fixtureReelDay';

const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULE = 'src/lib/operations/workBlock.ts';
const PANEL = 'src/components/workbench/operations/stops/WorkBlock.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const TAG = 'src/components/workbench/operations/stops/StopTag.tsx';
const FIXTURE = 'src/lib/__tests__/fixtureReelDay.ts';

// ── THE TEXTS BEFORE THIS CHANGE (captured on main f6b25aaa, 2026-10-26) — the reel's own fixture: no execute stop with a scene ──
const BEFORE = {
  captionHalf: "Chiang Mai, Thailand 🇹🇭 Day 8 of 15!\nBudget today: $100. Under or Over? 👇\n\nToday’s plan:\nShip the reel kit\nCall the bank\nBlocker: waiting on the bank\n\nBrunch at Luka Café\nBudget: $25\nActual: $9.69\n▼ $15.31 under\n⭐️⭐️⭐️⭐️\nEggs benedict\n\nDinner\nBudget: $30\nActual: $35\n▲ $5 over\n⭐️⭐️⭐️⭐️⭐️\n\nGym at Fitness First: skipped\nBudget: $15\nActual: —\nclosed for a holiday\n\nTotal budget: $100\nSpent: $44.69\n\n#chiangmai #thailand #digitalnomad #costofliving #buildinpublic",
  scriptHalf: "Budget today: $100. Under or Over? Let’s find out.\n\nHappy Thursday everyone, welcome to day 8 of 15, here in Chiang Mai, Thailand 🇹🇭. Today: Vision journal, Brunch at Luka Café, Co-working, Dinner, Gym at Fitness First, Activities, Ship REEL-01.\n\nToday’s list: Ship the reel kit, Call the bank.\nBlocker: waiting on the bank.\n\nBrunch at Luka Café.\nEggs benedict\nBudget $25, actual $9.69, ▼ $15.31 under.\n4 out of 5.\n\nDinner.\n[what you got]\nBudget $30, actual $35, ▲ $5 over.\n5 out of 5.\n\nGym: skipped.\nclosed for a holiday\n\nActivities.\n[what you got]\nBudget $20, actual [actual].\n[stars] out of 5.\n\nShip REEL-01.\n[what you got]\nBudget $10, actual [actual].\n[stars] out of 5.\n\nFinal tally: [actual] out of $100. [verdict]. Day 8 of 15, done.",
  captionFull: "Chiang Mai, Thailand 🇹🇭 Day 8 of 15!\nBudget today: $100. Under or Over? 👇\n\nToday’s plan:\nShip the reel kit\nCall the bank\nBlocker: waiting on the bank\n\nBrunch at Luka Café\nBudget: $25\nActual: $9.69\n▼ $15.31 under\n⭐️⭐️⭐️⭐️\nEggs benedict\n\nDinner\nBudget: $30\nActual: $35\n▲ $5 over\n⭐️⭐️⭐️⭐️⭐️\n\nGym at Fitness First\nBudget: $15\nActual: $15\non plan\n⭐️⭐️⭐️\nleg day\n\nActivities\nBudget: $20\nActual: $12\n▼ $8 under\n\nTotal budget: $100\nSpent: $80.19\n▼ $19.81 under\n\n#chiangmai #thailand #digitalnomad #costofliving #buildinpublic",
  scriptFull: "Budget today: $100. Under or Over? Let’s find out.\n\nHappy Thursday everyone, welcome to day 8 of 15, here in Chiang Mai, Thailand 🇹🇭. Today: Vision journal, Brunch at Luka Café, Co-working, Dinner, Gym at Fitness First, Activities, Ship REEL-01.\n\nToday’s list: Ship the reel kit, Call the bank.\nBlocker: waiting on the bank.\n\nBrunch at Luka Café.\nEggs benedict\nBudget $25, actual $9.69, ▼ $15.31 under.\n4 out of 5.\n\nDinner.\n[what you got]\nBudget $30, actual $35, ▲ $5 over.\n5 out of 5.\n\nGym at Fitness First.\nleg day\nBudget $15, actual $15, on plan.\n3 out of 5.\n\nActivities.\n[what you got]\nBudget $20, actual $12, ▼ $8 under.\n[stars] out of 5.\n\nShip REEL-01.\n[what you got]\nBudget $10, actual $8.50, ▼ $1.50 under.\n[stars] out of 5.\n\nFinal tally: $80.19 out of $100. ▼ $19.81 under. Day 8 of 15, done.",
  brunch: "Brunch at Luka Café.\nEggs benedict\nBudget $25, actual $9.69, ▼ $15.31 under.\n4 out of 5.",
  gym: "Gym: skipped.\nclosed for a holiday",
  cowork: "Co-working.\n[what you got]\n[stars] out of 5.",
};

// ── A DAY WITH AN EXECUTE LINE: Deep work 10:00–18:00 Bangkok ($5 when priced), Brunch at Luka Café ──
const WORK_AT = '2026-10-15T03:00:00.000Z'; // 10:00 Bangkok
const BRUNCH_AT = '2026-10-15T05:00:00.000Z';
const KEY = `line:s1:${WORK_AT}`;
const step = (over: Partial<RoutineStep> & { id: string; routine_id: string; activity: string }): RoutineStep => ({
  user_id: 'u', entity_id: 'P', step_order: 1, time_of_day: '1970-01-01T10:00:00.000Z', sub_activity: null, location: null, duration_minutes: 480, notes: null,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
});
const WORK: Routine = routine({ id: 'work', name: 'Work', role: 'execute', schedule_rrule: 'FREQ=DAILY;BYHOUR=10;BYMINUTE=0', steps: [step({ id: 's1', routine_id: 'work', activity: 'Deep work' })] });
const BRUNCH: Routine = routine({ id: 'brunch', name: 'Brunch', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=0' });
const brunchRecord: StopRecordRow = { id: 'rec-brunch', kind: 'routine', target_id: 'brunch', occurrence_at: BRUNCH_AT, outcome: 'done', done_at: BRUNCH_AT, actual_cents: 969, rating: 4, note: 'Eggs benedict', actual_minutes: null };
const workRecord = (over: Partial<StopRecordRow> = {}): StopRecordRow => ({ id: 'rec-work', kind: 'routine_line', target_id: 's1', occurrence_at: WORK_AT, outcome: 'done', done_at: WORK_AT, actual_cents: 400, rating: 4, note: 'focused', actual_minutes: 420, ...over });
function workDay(opts: { readonly money: boolean; readonly record: StopRecordRow | null }) {
  return dayStops(input({
    entries: [entry(WORK, WORK_AT), entry(BRUNCH, BRUNCH_AT)],
    lines: [
      line({ address: { kind: 'routine', id: 'brunch', instant: BRUNCH_AT }, cents: 2500, label: 'Brunch', vendor: vendor('Luka Café') }),
      ...(opts.money ? [line({ address: { kind: 'routine_line', id: 's1', instant: WORK_AT }, cents: 500, label: 'Work', line: 'Deep work' })] : []),
    ],
    records: [brunchRecord, ...(opts.record === null ? [] : [opts.record])],
  }));
}
const A = { id: 'a', title: 'write the brief', completedAt: '2026-10-15T04:00:00.000Z' }; // 11:00 — in
const B = { id: 'b', title: 'cut the trailer', completedAt: '2026-10-15T05:30:00.000Z' }; // 12:30 — in
const C = { id: 'c', title: 'after the block', completedAt: '2026-10-15T12:00:00.000Z' }; // 19:00 — out
const project = (done: readonly typeof A[]) => ({ title: 'The project', doneTasks: done });
const dayWith = (r: ReturnType<typeof workDay>, done: readonly typeof A[]) => reelDay(r, { journal: null, done: doneInBlocksOf(r.stops, DAY, [project(done)]) });
const workStop = (r: ReturnType<typeof workDay>) => { const s = r.stops.find((x) => x.key === KEY); assert.ok(s !== undefined, 'the execute line is a stop'); return s; };

// ── RULING A · THE SCENE ─────────────────────────────────────────────────────

test('A the execute stop’s scene: after the note line, "Done in this block: a, b." in completed_at order (the out-of-window one left out); none → "Nothing ticked in this block."; the step view’s script prints it; every other line as before', () => {
  const r = workDay({ money: true, record: workRecord() });
  assert.deepEqual(r.stops.map((s) => s.key), [KEY, `routine:brunch:${BRUNCH_AT}`], 'the table’s order: 10:00, then 12:00');
  const two = dayWith(r, [B, C, A]);
  assert.deepEqual(two.done.get(KEY)?.map((t) => t.title), ['write the brief', 'cut the trailer'], 'in completed_at order — the 19:00 one is outside 10:00–18:00');
  assert.equal(two.done.has(`routine:brunch:${BRUNCH_AT}`), false, 'only the execute stops are keyed');
  const scene = stopSceneLines(workStop(r), reelDoneOf(two, workStop(r)));
  assert.deepEqual(scene, ['Deep work.', 'focused', 'Done in this block: write the brief, cut the trailer.', 'Budget $5, actual $4, ▼ $1 under.', '4 out of 5.']);
  assert.deepEqual(stopScriptText(DAY, STAY, workStop(r), reelDoneOf(two, workStop(r))), { ok: true, text: scene.join('\n') }, 'the step view’s "copy script"');
  assert.deepEqual(stopSceneLines(workStop(r), [A]), ['Deep work.', 'focused', 'Done in this block: write the brief.', 'Budget $5, actual $4, ▼ $1 under.', '4 out of 5.']);
  assert.deepEqual(stopSceneLines(workStop(r), []), ['Deep work.', 'focused', NOTHING_TICKED_WORDS, 'Budget $5, actual $4, ▼ $1 under.', '4 out of 5.']);
  // The full script: the scene in its place, the rest as the rule always wrote it.
  const s = scriptText(two);
  assert.ok(s.ok);
  const blocks = s.text.split('\n\n');
  assert.equal(blocks[0], 'Budget today: $30. Under or Over? Let’s find out.');
  assert.equal(blocks[1], 'Happy Thursday everyone, welcome to day 8 of 15, here in Chiang Mai, Thailand 🇹🇭. Today: Deep work, Brunch at Luka Café.');
  assert.equal(blocks[2], scene.join('\n'));
  assert.equal(blocks[3], 'Brunch at Luka Café.\nEggs benedict\nBudget $25, actual $9.69, ▼ $15.31 under.\n4 out of 5.', 'the place stop’s scene, byte for byte');
  assert.equal(blocks[4], 'Final tally: $13.69 out of $30. ▼ $16.31 under. Day 8 of 15, done.');
  assert.equal(blocks.length, 5);
  // A skipped execute stop: the line after its reason.
  const skipped = workDay({ money: true, record: workRecord({ outcome: 'skipped', done_at: null, actual_cents: null, rating: null, note: 'called away', actual_minutes: null }) });
  assert.deepEqual(stopSceneLines(workStop(skipped), [A]), ['Deep work: skipped.', 'called away', 'Done in this block: write the brief.']);
  // An unrecorded execute stop with money: the blanks, the line between them.
  const open = workDay({ money: true, record: null });
  assert.deepEqual(stopSceneLines(workStop(open), []), ['Deep work.', '[what you got]', NOTHING_TICKED_WORDS, 'Budget $5, actual [actual].', '[stars] out of 5.']);
  // The words.
  assert.deepEqual([DONE_IN_BLOCK_SCENE_WORDS, NOTHING_TICKED_WORDS, doneInBlockSceneWords([A, B]), doneInBlockSceneWords([])], ['Done in this block:', 'Nothing ticked in this block.', 'Done in this block: write the brief, cut the trailer.', 'Nothing ticked in this block.']);
  // An execute stop without its list is the caller’s error; a place stop takes none.
  assert.throws(() => stopSceneLines(workStop(r)), /is an execute stop — its scene needs the tasks done in its block/);
  assert.throws(() => reelDoneOf({ done: NO_DONE_IN_BLOCKS }, workStop(r)), /is an execute stop with no done list/);
  assert.equal(reelDoneOf(two, r.stops[1]), null, 'a place stop: null');
});

test('A an execute stop with no money gets a scene when at least one task was done in its block — and none otherwise; the scene has no money sentence', () => {
  const r = workDay({ money: false, record: null });
  assert.deepEqual([workStop(r).cents, workStop(r).actualCents], [null, null]);
  const one = scriptText(dayWith(r, [A]));
  assert.ok(one.ok);
  const blocks = one.text.split('\n\n');
  assert.equal(blocks[2], 'Deep work.\n[what you got]\nDone in this block: write the brief.\n[stars] out of 5.', 'a scene, no money sentence');
  assert.equal(blocks.length, 5);
  const none = scriptText(dayWith(r, []));
  assert.ok(none.ok);
  assert.equal(none.text.split('\n\n').length, 4, 'no scene for it — money only, as before');
  assert.doesNotMatch(none.text, /Deep work\.\n/);
  assert.match(none.text, /Today: Deep work, Brunch at Luka Café\./, 'the greeting still names it');
});

// ── RULING B · THE CAPTION ───────────────────────────────────────────────────

test('B the caption: "<name>: 2 tasks done" after the execute stop’s money lines; "1 task done" singular; none ticked adds nothing; with no money the line is a section of its own; in the table’s order; every other line as before', () => {
  const r = workDay({ money: true, record: workRecord() });
  const two = captionText(dayWith(r, [B, A]));
  assert.ok(two.ok);
  const sections = two.text.split('\n\n');
  assert.equal(sections[0], 'Chiang Mai, Thailand 🇹🇭 Day 8 of 15!\nBudget today: $30. Under or Over? 👇');
  assert.equal(sections[1], 'Deep work\nBudget: $5\nActual: $4\n▼ $1 under\n⭐️⭐️⭐️⭐️\nfocused\nDeep work: 2 tasks done', 'the count line after the money lines, the stars and the note');
  assert.equal(sections[2], 'Brunch at Luka Café\nBudget: $25\nActual: $9.69\n▼ $15.31 under\n⭐️⭐️⭐️⭐️\nEggs benedict', 'the place stop, byte for byte');
  assert.equal(sections[3], 'Total budget: $30\nSpent: $13.69\n▼ $16.31 under');
  assert.equal(sections[4], '#chiangmai #thailand #digitalnomad #costofliving #buildinpublic');
  assert.equal(sections.length, 5);
  const one = captionText(dayWith(r, [A]));
  assert.ok(one.ok);
  assert.match(one.text, /\nfocused\nDeep work: 1 task done\n\nBrunch/);
  const none = captionText(dayWith(r, []));
  assert.ok(none.ok);
  assert.match(none.text, /\nfocused\n\nBrunch/, 'none ticked: no line');
  assert.doesNotMatch(none.text, /tasks? done/);
  // No money, one done: a section of the one line, in its place.
  const bare = captionText(dayWith(workDay({ money: false, record: null }), [A]));
  assert.ok(bare.ok);
  assert.equal(bare.text.split('\n\n')[1], 'Deep work: 1 task done');
  // No money, none done: no section at all.
  const quiet = captionText(dayWith(workDay({ money: false, record: null }), []));
  assert.ok(quiet.ok);
  assert.doesNotMatch(quiet.text, /Deep work/);
  assert.deepEqual([doneCountWords('Deep work', 1), doneCountWords('Deep work', 2)], ['Deep work: 1 task done', 'Deep work: 2 tasks done']);
});

// ── BYTE FOR BYTE · EVERY OTHER STOP ─────────────────────────────────────────

test('every other stop’s scene and caption are byte-identical to the texts captured before this change — the reel’s own day, half and full; the place stop’s and the skipped stop’s step-view scenes; the execute stop with nothing ticked gains its one line', () => {
  const half = build(HALF);
  const full = build(FULL, { taskActual: '8.50' });
  const text = (t: ReturnType<typeof captionText>) => { assert.ok(t.ok); return t.text; };
  assert.equal(text(captionText(reelDay(half))), BEFORE.captionHalf);
  assert.equal(text(scriptText(reelDay(half))), BEFORE.scriptHalf);
  assert.equal(text(captionText(reelDay(full))), BEFORE.captionFull);
  assert.equal(text(scriptText(reelDay(full))), BEFORE.scriptFull);
  const stopOf = (id: string) => half.stops.find((s) => s.key === `routine:${id}:${STOPS.find((x) => x.id === id)?.at}`)!;
  assert.equal(text(stopScriptText(DAY, STAY, stopOf('brunch'))), BEFORE.brunch);
  assert.equal(text(stopScriptText(DAY, STAY, stopOf('gym'))), BEFORE.gym);
  assert.equal(text(stopScriptText(DAY, STAY, stopOf('cowork'), [])), `${BEFORE.cowork.split('\n').slice(0, 2).join('\n')}\n${NOTHING_TICKED_WORDS}\n${BEFORE.cowork.split('\n').slice(2).join('\n')}`, 'Co-working (execute, stepless, no money): the one line after the note line');
  assert.equal(BEFORE.cowork, 'Co-working.\n[what you got]\n[stars] out of 5.');
  // The fixture composes `done` as the card does — nothing ticked, so the reel's own day is as REEL-01 and REEL-02 pinned it.
  assert.match(code(FIXTURE), /done: doneInBlocksOf\(r\.stops, DAY, \[\]\), \.\.\.over \};/);
  assert.deepEqual([...reelDay(half).done.keys()], [`routine:cowork:${STOPS.find((x) => x.id === 'cowork')?.at}`]);
});

// ── RULING C · THE HAND-OFF AND THE WAIT ─────────────────────────────────────

test('C ReelDay carries each execute stop’s done tasks (workBlock.ts doneInBlocksOf — only the execute stops keyed, a block with no length none); the card hands them in from the backlog read it holds; a waiting or failed backlog read makes the reel wait on "the backlog" by name; no new read', () => {
  // doneInBlocksOf: every project's done tasks, narrowed per execute stop; a project read without them is the card's error.
  const r = workDay({ money: true, record: workRecord() });
  const map = doneInBlocksOf(r.stops, DAY, [project([C]), project([B, A])]);
  assert.deepEqual([...map.entries()].map(([k, v]) => [k, v.map((t) => t.id)]), [[KEY, ['a', 'b']]]);
  assert.throws(() => doneInBlocksOf(r.stops, DAY, [{ title: 'Unread', doneTasks: undefined }]), /"Unread" was read without its done tasks/);
  assert.deepEqual([carriesDoneTasks([project([]), project([A])]), carriesDoneTasks([project([]), { title: 'x', doneTasks: undefined }]), carriesDoneTasks([])], [true, false, true]);
  const stepless = build(HALF);
  assert.deepEqual([...doneInBlocksOf(stepless.stops, DAY, [project([A])]).values()], [[]], 'Co-working has no length: none, even with a task done at 11:00');
  assert.equal(NO_DONE_IN_BLOCKS.size, 0);
  // The wait: the backlog is a named read, last in the order; null on a day with no execute stop.
  const ok: ReelReads = { day: 'ok', tasks: 'ok', report: 'ok', records: 'ok', stay: 'ok', journal: 'ok', backlog: 'ok' };
  assert.equal(reelReadsWords(ok), null);
  assert.equal(reelReadsWords({ ...ok, backlog: null }), null, 'no execute stop: the reel does not use it');
  assert.equal(reelReadsWords({ ...ok, backlog: 'waiting' }), 'not ready — waiting for the backlog');
  assert.equal(reelReadsWords({ ...ok, backlog: 'failed' }), 'not made — the backlog could not be read');
  assert.equal(reelReadsWords({ ...ok, journal: 'waiting', backlog: 'waiting' }), 'not ready — waiting for the journal, the backlog');
  assert.equal(reelReadsWords({ ...ok, stay: 'failed', backlog: 'failed' }), 'not made — the stay, the backlog could not be read');
  assert.equal(REEL_READ_NAMES.backlog, 'the backlog');
  const rules = code(RULES);
  assert.match(rules, /const REEL_READ_ORDER: readonly \(keyof ReelReads\)\[\] = \['day', 'tasks', 'report', 'records', 'stay', 'journal', 'backlog'\];/);
  assert.match(rules, /readonly journal: ReelRead \| null;\n\s*readonly backlog: ReelRead \| null;\n\}/);
  assert.match(rules, /readonly done: ReadonlyMap<string, readonly ReelDoneTask\[\]>;\n\}/);
  assert.match(rules, /import \{ showsWorkBlock \} from '@\/lib\/operations\/workBlock';/);
  // The card: the backlog's state on a day with an execute stop, in once it carries the day's done tasks; the lists from the read it holds; both stop scripts hand the list in.
  const c = code(CARD);
  assert.match(c, /backlog: !hasExecuteStop \? null : backlog === null \|\| backlog\.day !== day \? 'waiting' : !backlog\.read\.ok \? 'failed' : carriesDoneTasks\(backlog\.read\.value\) \? 'ok' : 'waiting',/);
  assert.match(c, /const reelDone = reelReads\.backlog === 'ok' && backlog !== null && backlog\.read\.ok \? doneInBlocksOf\(result\.stops, day, backlog\.read\.value\) : NO_DONE_IN_BLOCKS;\n\s*const reelDay = \{ day, stay: reelStay, stops: result\.stops, totals, verdict, journal: reelJournal, done: reelDone \};/);
  assert.match(c, /stopScriptText\(day, reelStay, focus\.stop, reelDoneOf\(reelDay, focus\.stop\)\)/);
  assert.match(c, /stopScriptText\(day, reelStay, journalStop, reelDoneOf\(reelDay, journalStop\)\)/);
  assert.equal((c.match(/readBacklog\(/g) ?? []).length, 1, 'the one backlog read — no new read');
  assert.doesNotMatch(c, /done_from|done_to|\/api\//, 'no route named on the card');
});

// ── RULING D · A BLOCK OF NO LENGTH ──────────────────────────────────────────

test('D a block of 0 or −5 minutes has no length — null, the same words as no minutes; a fraction is still thrown; the words gain nothing', () => {
  const stop = (minutes: number | null) => ({ key: 'line:s1:x', role: 'execute' as const, time: '10:00', zone: 'Asia/Bangkok', minutes });
  assert.equal(blockWindowOf(stop(0), DAY), null);
  assert.equal(blockWindowOf(stop(-5), DAY), null);
  assert.equal(blockWindowOf(stop(null), DAY), null);
  assert.deepEqual(blockWindowOf(stop(30), DAY), { from: new Date('2026-10-15T03:00:00.000Z'), to: new Date('2026-10-15T03:30:00.000Z') });
  assert.throws(() => blockWindowOf(stop(1.5), DAY), /whole number of minutes/);
  assert.equal(NO_LENGTH_WORDS, "this block has no length — set the line's minutes on /expenses to count what was done in it");
  assert.match(code(RULE), /if \(stop\.minutes === null \|\| stop\.minutes <= 0\) return null;/);
  assert.match(code(PANEL), /\{block === null && <div className="text-text-muted" data-day-work-no-length>\{NO_LENGTH_WORDS\}<\/div>\}/, 'the panel prints the one words for both');
});

// ── RULING E · UNCHANGED ─────────────────────────────────────────────────────

test('E the tag, the plates, the step view and the record form are unchanged; no schema, no migration, no route', () => {
  const tag = functionBody(code(RULES), 'stopTagWords');
  assert.ok(tag !== null);
  assert.doesNotMatch(tag!, /done|reelDoneOf|showsWorkBlock/, 'the tag reads nothing of the block');
  assert.doesNotMatch(code(TAG) + code(STOP_FORM) + comments(TAG) + comments(STOP_FORM), /WORK-03|reelDone|doneInBlock|NOTHING_TICKED|doneCountWords/, 'the tag element and the record form are untouched');
  assert.doesNotMatch(code(PANEL), /reel|scriptText|captionText/, 'the panel knows nothing of the reel — the card hands the reel the lists');
  const c = code(CARD);
  const stepView = c.slice(c.indexOf('<StopVendor key='), c.indexOf('data-day-journal-section'));
  assert.doesNotMatch(stepView, /reelDone|done=/, 'the step view mounts the same three — the block takes no new prop');
  assert.doesNotMatch(code(RULES) + c, /prisma\.\$executeRaw|ALTER TABLE|migrations|\/api\/operations\/projects/, 'no migration, no route');
  assert.match(comments(RULES), /WORK-03 \(Alex, 2026-10-26\): THE BLOCK IN THE REEL/);
  assert.match(comments(PANEL), /WORK-03 \(Alex, 2026-10-26\): the block reaches the reel/);
});
