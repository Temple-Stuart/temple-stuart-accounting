/**
 * WORK-03b (Alex, 2026-10-26) — A STEPLESS ROUTINE WITH A WINDOW IS AS LONG AS ITS WINDOW; NO BLOCK LINE WITHOUT A LENGTH.
 *
 * Ruling 1: when blockWindowOf is null the execute stop's scene carries NO block line — neither "Done in this block" nor
 * "Nothing ticked in this block." — the reel never claims a count nothing could count; the panel's no-length words on the step
 * view stand. The scene condition (money OR at least one task done) is unchanged.
 * Ruling 2: the ONE planned-minutes rule grows (dayCard.ts plannedMinutesOf — what the work block, the ledger's PLANNED MIN and
 * the stop's minutes read): a line → its duration_minutes; a stepless routine with both start_time and end_time → end − start in
 * whole minutes, an end before the start ending the next day (rruleHelpers' window convention, EMPTY_WINDOW_WORDS); else null.
 * Applied in one place, every reader follows: the ledger route's RECORD_PLAN gains the routine's start_time and end_time
 * additively, so a stepless record's PLANNED MIN prints the window's length.
 * Ruling 3: nothing else changes — the caption (adds nothing at k = 0 already), the tag, the forms, the routes.
 * The rule is driven over the fixtures Alex named; the card, the route, the panel and the registry are pinned to their source
 * with comments stripped (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, functionBody } from '../sourceText';
import type { RoutineWords } from '../budget/planLines';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  DONE_IN_BLOCK_SCENE_WORDS, NOTHING_TICKED_WORDS, captionText, dayStops, plannedMinutesOf, reelDoneOf, scriptText, stopSceneLines, stopScriptText,
} from '@/components/workbench/operations/day/dayCard';
import { NO_LENGTH_WORDS, blockWindowOf, doneInBlocksOf } from '../operations/workBlock';
import { EMPTY_WINDOW_WORDS } from '../operations/rruleHelpers';
import { ledgerCsv, ledgerOf, type LedgerInput, type LedgerRecordInput } from '../operations/ledger';
import { TOOL_REGISTRY } from '../toolRegistry';
import { BKK, DAY, HALF, STAY, STOPS, build, entry, input, line, reelDay, routine } from './fixtureReelDay';

const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULE = 'src/lib/operations/workBlock.ts';
const PANEL = 'src/components/workbench/operations/stops/WorkBlock.tsx';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const LEDGER = 'src/lib/operations/ledger.ts';
const ROUTINES_ROUTE = 'src/app/api/operations/routines/route.ts';
const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const PROJECTS_ROUTE = 'src/app/api/operations/projects/route.ts';
const ROUTINE_FORM = 'src/components/workbench/operations/routines/RoutineEditForm.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const TAG = 'src/components/workbench/operations/stops/StopTag.tsx';

/** A @db.Time as the card reads it — its JSON, '1970-01-01THH:MM:SS.000Z' (routines/types.ts Routine.start_time). */
const t = (hhmm: string): string => `1970-01-01T${hhmm}:00.000Z`;
const WORK_AT = '2026-10-15T03:00:00.000Z'; // 10:00 Bangkok
const NIGHT_AT = '2026-10-15T15:00:00.000Z'; // 22:00 Bangkok
const A = { id: 'a', title: 'write the brief', completedAt: '2026-10-15T05:00:00.000Z' }; // 12:00 Bangkok — in 10:00–18:00
const C = { id: 'c', title: 'after the block', completedAt: '2026-10-15T12:00:00.000Z' }; // 19:00 — out
const N = { id: 'n', title: 'night shift', completedAt: '2026-10-15T18:00:00.000Z' }; // 01:00 Bangkok, the next day — in 22:00–02:00
const project = (done: readonly typeof A[]) => ({ title: 'The project', doneTasks: done });
/** A stepless execute routine at 10:00 Bangkok; its window as given. */
const stepless = (over: { readonly start_time: string | null; readonly end_time: string | null; readonly id?: string; readonly hour?: number }) =>
  routine({ id: over.id ?? 'work', name: 'Work', role: 'execute', schedule_rrule: `FREQ=DAILY;BYHOUR=${over.hour ?? 10};BYMINUTE=0`, start_time: over.start_time, end_time: over.end_time });
const dayOf = (r: ReturnType<typeof routine>, at: string, opts: { readonly money: boolean } = { money: false }) =>
  dayStops(input({ entries: [entry(r, at)], lines: opts.money ? [line({ address: { kind: 'routine', id: r.id, instant: at }, cents: 500, label: r.name })] : [] }));

// ── RULING 2 · THE ONE PLANNED-MINUTES RULE ──────────────────────────────────

test('2 plannedMinutesOf — a line’s 45 → 45; a stepless routine 10:00–18:00 → 480; 22:00–02:00 → 240 (an end before the start ends the next day); 10:00–10:00 → 0, then no length; a start only → null; a Date reads as its JSON does', () => {
  assert.equal(plannedMinutesOf({ kind: 'line', duration_minutes: 45 }), 45);
  assert.equal(plannedMinutesOf({ kind: 'line', duration_minutes: null }), null, 'a line that states none');
  assert.equal(plannedMinutesOf({ kind: 'line', duration_minutes: 0 }), 0, 'a line of 0 is 0 — then no length (WORK-03 ruling D)');
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: t('10:00'), end_time: t('18:00') }), 480);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: t('22:00'), end_time: t('02:00') }), 240, 'the next-day convention');
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: t('23:30'), end_time: t('00:15') }), 45);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: t('10:00'), end_time: t('10:00') }), 0, 'an empty window — refused on write — is 0 here');
  assert.equal(blockWindowOf({ key: 'routine:work:x', role: 'execute', time: '10:00', zone: BKK, minutes: 0 }, DAY), null, 'then WORK-03 ruling D: no length');
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: t('10:00'), end_time: null }), null, 'a start only: none');
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: null, end_time: t('18:00') }), null);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: null, end_time: null }), null);
  // The server's rows hold Dates (Prisma's @db.Time); the ledger route hands them in as they are.
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: new Date(t('10:00')), end_time: new Date(t('18:00')) }), 480);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: new Date(t('22:00')), end_time: new Date(t('02:00')) }), 240);
  assert.equal(plannedMinutesOf({ kind: 'routine', start_time: new Date(t('10:00')), end_time: null }), null);
  // A value that is no time is the read's error, by name.
  assert.throws(() => plannedMinutesOf({ kind: 'routine', start_time: 'ten', end_time: t('18:00') }), /start_time "ten" is not a time — a @db\.Time arrives as 1970-01-01THH:MM:SS\.000Z/);
  assert.throws(() => plannedMinutesOf({ kind: 'routine', start_time: t('10:00'), end_time: '18:00' }), /end_time "18:00" is not a time/, 'a bare clock is not the JSON of a @db.Time');
  // The convention is rruleHelpers': the same words the routes refuse an empty window with.
  assert.equal(EMPTY_WINDOW_WORDS, 'end_time equals start_time — the window is empty; an end before the start ends the next day');
  // The rule, in its one place — applied at the card's two sites.
  const rules = code(RULES);
  assert.match(rules, /export function plannedMinutesOf\(plan: PlannedMinutesPlan\): number \| null \{\n\s*if \(plan\.kind === 'line'\) return plan\.duration_minutes;\n\s*const start = windowMinutesOf\('start_time', plan\.start_time\);\n\s*const end = windowMinutesOf\('end_time', plan\.end_time\);\n\s*if \(start === null \|\| end === null\) return null;\n\s*return end >= start \? end - start : end \+ 24 \* 60 - start;\n\}/);
  assert.match(rules, /minutes: plannedMinutesOf\(\{ kind: 'routine', start_time: r\.start_time, end_time: r\.end_time \}\),/, 'the stepless site');
  assert.match(rules, /minutes: plannedMinutesOf\(\{ kind: 'line', duration_minutes: step\.duration_minutes \}\),/, 'the line site');
  assert.equal((rules.match(/plannedMinutesOf\(/g) ?? []).length, 3, 'defined once, applied twice — no third reading on the card');
  assert.match(rules, /import \{ minutesOf \} from '@\/lib\/calendar\/day';/, 'the clock arithmetic is the calendar’s minutesOf — reused, not rebuilt');
});

test('2 the card: a stepless execute routine 10:00–18:00 Bangkok has 480 minutes — its block is [10:00, 18:00], a task ticked at 12:00 is done in it; 22:00–02:00 reaches 01:00 the next day; a stepless routine without a window has none', () => {
  const r = dayOf(stepless({ start_time: t('10:00'), end_time: t('18:00') }), WORK_AT);
  const s = r.stops[0];
  assert.deepEqual([s.key, s.kind, s.role, s.time, s.zone, s.minutes], [`routine:work:${WORK_AT}`, 'routine', 'execute', '10:00', BKK, 480]);
  assert.deepEqual(blockWindowOf(s, DAY), { from: new Date('2026-10-15T03:00:00.000Z'), to: new Date('2026-10-15T11:00:00.000Z') }, '10:00–18:00 Bangkok as instants');
  assert.deepEqual([...doneInBlocksOf(r.stops, DAY, [project([C, A])]).entries()], [[s.key, [A]]], 'the 12:00 tick is in, the 19:00 one out');
  // The reel: the scene says it, the caption counts it — the rules of WORK-03, now reached by a stepless routine.
  const day = reelDay(r, { journal: null, done: doneInBlocksOf(r.stops, DAY, [project([A])]) });
  assert.deepEqual(stopSceneLines(s, reelDoneOf(day, s)), ['Work.', '[what you got]', `${DONE_IN_BLOCK_SCENE_WORDS} write the brief.`, '[stars] out of 5.']);
  const script = scriptText(day);
  assert.ok(script.ok);
  assert.equal(script.text.split('\n\n')[2], 'Work.\n[what you got]\nDone in this block: write the brief.\n[stars] out of 5.', 'a scene — one task done, no money');
  const caption = captionText(day);
  assert.ok(caption.ok);
  assert.equal(caption.text.split('\n\n')[1], 'Work: 1 task done');
  // Overnight: 22:00–02:00 Bangkok is 240 minutes; a tick at 01:00 the next day is in.
  const night = dayOf(stepless({ id: 'night', start_time: t('22:00'), end_time: t('02:00'), hour: 22 }), NIGHT_AT);
  assert.equal(night.stops[0].minutes, 240);
  assert.deepEqual(blockWindowOf(night.stops[0], DAY), { from: new Date('2026-10-15T15:00:00.000Z'), to: new Date('2026-10-15T19:00:00.000Z') });
  assert.deepEqual([...doneInBlocksOf(night.stops, DAY, [project([N, A])]).values()], [[N]]);
  // No window: none — as DAYCARD-01's Gym (daycard01.test.ts) and the reel's Co-working still read.
  assert.equal(dayOf(stepless({ start_time: null, end_time: null }), WORK_AT).stops[0].minutes, null);
  assert.equal(dayOf(stepless({ start_time: t('10:00'), end_time: null }), WORK_AT).stops[0].minutes, null, 'a start only');
  assert.equal(build(HALF).stops.find((x) => x.key === `routine:cowork:${STOPS.find((x) => x.id === 'cowork')?.at}`)?.minutes, null, 'the reel’s Co-working: stepless, no window');
});

test('2 the ledger: a stepless record’s PLANNED MIN prints the window’s length — the route reads the routine’s start_time and end_time with the record’s plan words (RECORD_PLAN, additive) and applies the one rule to both kinds; the Time row cites the two lines', () => {
  const GYM_13 = '2026-10-13T13:00:00.000Z'; // 20:00 Bangkok
  const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
    outcome: 'done', done_at: `${over.occurrence_at.slice(0, 11)}13:41:00.000Z`, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
  });
  const WORDS = new Map<string, RoutineWords>([['gym', { name: 'Gym', timezone: BKK, steps: new Map() }]]);
  // What the route hands the rule for a stepless record at a 20:00–21:00 routine: plannedMinutesOf over its Dates.
  const records: LedgerRecordInput[] = [
    { record: record({ id: 'r-gym', kind: 'routine', target_id: 'gym', occurrence_at: GYM_13, actual_minutes: 30 }), routineId: 'gym', routineName: 'Gym', zone: BKK, role: 'place', activity: null, timeOfDay: null, durationMinutes: plannedMinutesOf({ kind: 'routine', start_time: new Date(t('20:00')), end_time: new Date(t('21:00')) }) },
  ];
  const INPUT: LedgerInput = {
    from: '2026-10-13', to: '2026-10-13', now: new Date('2026-10-14T00:00:00.000Z'), records, links: [], lines: [], notPlaced: [], routines: WORDS,
    roles: new Map([['gym', 'place']]), vendors: [], stays: [], accounts: [], books: [{ id: 'P', entityType: 'personal' }],
  };
  const ledger = ledgerOf(INPUT);
  assert.equal(ledger.rows.length, 1);
  assert.deepEqual([ledger.rows[0].plannedMinutes, ledger.rows[0].loggedMinutes], [60, 30], 'PLANNED MIN 60 — the window’s length; LOGGED MIN the record’s own');
  assert.equal(ledgerCsv(ledger.rows).split('\r\n')[1], 'Tuesday,2026-10-13,,,,,,Gym,,,60,30,,,,,,', 'the CSV: 60 where TIME-03’s stepless fixture printed nothing');
  // The route: the routine select grows by the two times; the step's select is TIME-03's, byte for byte; both kinds through the one rule.
  const route = code(ROUTE);
  assert.match(route, /routine: \{ select: \{ name: true, timezone: true, role: true, start_time: true, end_time: true \} \},\n\s*step: \{ select: \{ activity: true, time_of_day: true, duration_minutes: true, routine_id: true, routine: \{ select: \{ name: true, timezone: true, role: true \} \} \} \},/);
  assert.match(route, /readonly routine: \{ readonly name: string; readonly timezone: string; readonly role: string; readonly start_time: Date \| null; readonly end_time: Date \| null \} \| null;/);
  assert.match(route, /durationMinutes: plannedMinutesOf\(\{ kind: 'line', duration_minutes: row\.step\.duration_minutes \}\) \};/);
  assert.match(route, /durationMinutes: plannedMinutesOf\(\{ kind: 'routine', start_time: row\.routine\.start_time, end_time: row\.routine\.end_time \}\) \};/);
  assert.match(route, /import \{ plannedMinutesOf \} from '@\/components\/workbench\/operations\/day\/dayCard';/);
  assert.equal((route.match(/plannedMinutesOf\(/g) ?? []).length, 2, 'the route applies the rule; it restates nothing');
  assert.equal((route.match(/prisma\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 9, 'no new query — the times ride the record include');
  assert.doesNotMatch(route, /start_time\.|end_time\.|getUTCHours|toISOString\(\)\.slice\(11, 16\)\) -/, 'no arithmetic on the times in the route');
  // The pure half: the row copies the figure; the words say what it is now.
  assert.match(code(LEDGER), /plannedMinutes: r\.durationMinutes,\n\s*loggedMinutes: r\.record\.actual_minutes,/);
  assert.match(comments(LEDGER), /a stepless routine\s*\n?\s*\*?\s*without a window has none; WORK-03b, Alex, 2026-10-26: with one, its length/);
  // The Time row's citation names the two lines, and each is what it says.
  const time = TOOL_REGISTRY.find((x) => x.name === 'Time');
  assert.ok(time);
  const lineOf = (file: string, n: number): string => code(file).split('\n')[n - 1] ?? '';
  const stepLine = time.citation.match(/src\/app\/api\/operations\/ledger\/route\.ts:(\d+) \(the line's duration\)/);
  const routineLine = time.citation.match(/src\/app\/api\/operations\/ledger\/route\.ts:(\d+) \(the routine's window\)/);
  assert.ok(stepLine && routineLine, 'the citation names both');
  assert.match(lineOf(ROUTE, Number(stepLine[1])), /^\s*step: \{ select: \{ activity: true, time_of_day: true, duration_minutes: true,/);
  assert.match(lineOf(ROUTE, Number(routineLine[1])), /^\s*routine: \{ select: \{ name: true, timezone: true, role: true, start_time: true, end_time: true \} \},/);
  assert.match(time.citation, /the one planned-minutes rule's, dayCard\.ts plannedMinutesOf — a line's duration_minutes or, WORK-03b \(2026-10-26\), a stepless routine's window length/);
});

// ── RULING 1 · NO BLOCK LINE WITHOUT A LENGTH ────────────────────────────────

test('1 an execute stop with no length and a task done in the day: the block maps to null, the scene carries no block line (neither sentence), with money it still has its scene — without the line; the panel’s no-length words stand; a block WITH length and nothing ticked still says so', () => {
  // The reel's Co-working: stepless, no window — a task done at 11:00 in the day is not counted, and not denied either.
  const half = build(HALF);
  const coworkKey = `routine:cowork:${STOPS.find((x) => x.id === 'cowork')?.at}`;
  const cowork = half.stops.find((s) => s.key === coworkKey)!;
  assert.equal(blockWindowOf(cowork, DAY), null);
  const done = doneInBlocksOf(half.stops, DAY, [project([A])]);
  assert.deepEqual([...done.entries()], [[coworkKey, null]], 'null — not an empty list');
  const day = reelDay(half, { done });
  assert.equal(reelDoneOf(day, cowork), null);
  const scene = stopSceneLines(cowork, reelDoneOf(day, cowork));
  assert.deepEqual(scene, ['Co-working.', '[what you got]', '[stars] out of 5.'], 'no block line');
  assert.doesNotMatch(scene.join('\n'), /Done in this block|Nothing ticked/);
  assert.deepEqual(stopScriptText(DAY, STAY, cowork, null), { ok: true, text: 'Co-working.\n[what you got]\n[stars] out of 5.' }, 'the step view’s "copy script"');
  // The full card: no scene for it (no money, no count) — the reel's own texts, byte for byte as with nothing ticked at all.
  const quiet = reelDay(half);
  const same = (f: typeof scriptText) => { const a = f(day); const b = f(quiet); assert.ok(a.ok && b.ok); assert.equal(a.text, b.text); };
  same(scriptText);
  same(captionText);
  // With money: a scene — and no block line in it.
  const priced = dayOf(stepless({ start_time: null, end_time: null }), WORK_AT, { money: true });
  const pricedDay = reelDay(priced, { journal: null, done: doneInBlocksOf(priced.stops, DAY, [project([A])]) });
  assert.deepEqual(stopSceneLines(priced.stops[0], reelDoneOf(pricedDay, priced.stops[0])), ['Work.', '[what you got]', 'Budget $5, actual [actual].', '[stars] out of 5.']);
  const pricedScript = scriptText(pricedDay);
  assert.ok(pricedScript.ok);
  assert.equal(pricedScript.text.split('\n\n')[2], 'Work.\n[what you got]\nBudget $5, actual [actual].\n[stars] out of 5.');
  const pricedCaption = captionText(pricedDay);
  assert.ok(pricedCaption.ok);
  assert.doesNotMatch(pricedCaption.text, /tasks? done/, 'the caption adds nothing at k = 0 — as before');
  // A line of 0 minutes (WORK-03 ruling D): the same — null, no line.
  const zero = dayOf(stepless({ start_time: t('10:00'), end_time: t('10:00') }), WORK_AT);
  assert.equal(zero.stops[0].minutes, 0);
  assert.deepEqual([...doneInBlocksOf(zero.stops, DAY, [project([A])]).values()], [null]);
  // A block WITH length and nothing ticked still says so; an execute stop handed nothing is still the caller's error.
  const long = dayOf(stepless({ start_time: t('10:00'), end_time: t('18:00') }), WORK_AT);
  assert.deepEqual(stopSceneLines(long.stops[0], []), ['Work.', '[what you got]', NOTHING_TICKED_WORDS, '[stars] out of 5.']);
  assert.throws(() => stopSceneLines(long.stops[0]), /is an execute stop — its scene needs the tasks done in its block/);
  assert.throws(() => stopSceneLines(cowork), /is an execute stop — its scene needs the tasks done in its block/, 'no length is still handed — as null');
  // The words: the panel's, unchanged; the rule and the scene, pinned.
  assert.equal(NO_LENGTH_WORDS, "this block has no length — set the line's minutes on /expenses to count what was done in it");
  assert.match(code(PANEL), /\{block === null && <div className="text-text-muted" data-day-work-no-length>\{NO_LENGTH_WORDS\}<\/div>\}/);
  assert.match(code(RULE), /map\.set\(s\.key, block === null \? null : doneInBlockOf\(all, block\)\);/);
  assert.match(code(RULE), /export const NO_DONE_IN_BLOCKS: ReadonlyMap<string, readonly LogDoneTask\[\] \| null> = new Map\(\);/);
  const rules = code(RULES);
  assert.match(rules, /export function stopSceneLines\(s: Stop, done\?: readonly ReelDoneTask\[\] \| null\): string\[\] \{\n\s*const block = \(\(\): string \| null => \{\n\s*if \(!showsWorkBlock\(s\)\) return null;\n\s*if \(done === undefined\) throw new Error\(`dayCard: \$\{s\.key\} is an execute stop — its scene needs the tasks done in its block`\);\n\s*return done === null \? null : doneInBlockSceneWords\(done\);\n\s*\}\)\(\);/);
  assert.match(rules, /export function reelDoneOf\(d: Pick<ReelDay, 'done'>, s: Stop\): readonly ReelDoneTask\[\] \| null \{\n\s*if \(!showsWorkBlock\(s\)\) return null;\n\s*const list = d\.done\.get\(s\.key\);\n\s*if \(list === undefined\) throw/);
  // The card hands the reel what reelDoneOf reads — unchanged (work03.test.ts pins the lines).
  assert.match(code(CARD), /stopScriptText\(day, reelStay, focus\.stop, reelDoneOf\(reelDay, focus\.stop\)\)/);
});

// ── RULING 3 · NOTHING ELSE CHANGES ──────────────────────────────────────────

test('3 the caption’s rule, the tag, the forms and the routes are untouched; the panel knows nothing of this change; no schema, no migration', () => {
  assert.doesNotMatch(functionBody(code(RULES), 'captionText') ?? '', /plannedMinutesOf|WORK-03b/, 'the caption reads the lists as before');
  assert.match(functionBody(code(RULES), 'captionText') ?? '', /const ticked = done === null \? 0 : done\.length;/);
  assert.doesNotMatch(functionBody(code(RULES), 'stopTagWords') ?? '', /done|minutes/, 'the tag reads nothing of the block');
  for (const f of [TAG, STOP_FORM, ROUTINE_FORM, ROUTINE_ROUTE, PROJECTS_ROUTE, PANEL]) {
    assert.doesNotMatch(code(f) + comments(f), /WORK-03b|plannedMinutesOf/, `${f}: untouched`);
  }
  // COCKPIT-PERF-01 (Alex, 2026-10-27, ruling C): the create route's MOVE-01 comment said "nothing reads the pair as a duration" —
  // false since this ruling's rule — and now cites it (WORK-03b, dayCard.ts plannedMinutesOf) by name. Its CODE is still untouched.
  assert.doesNotMatch(code(ROUTINES_ROUTE), /WORK-03b|plannedMinutesOf/, `${ROUTINES_ROUTE}: its code untouched`);
  assert.doesNotMatch(code(ROUTE) + code(RULE) + code(RULES), /prisma\.\$executeRaw|ALTER TABLE|migrations/, 'no migration, no raw SQL');
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date\(\)|Date\.now\(|from 'react'|@prisma\/client/, 'the card’s rules stay pure');
});
