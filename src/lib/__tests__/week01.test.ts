/**
 * WEEK-01 (2026-09-30) — THIS WEEK: every routine on every day, done with its
 * note, each paid routine's place for the day, each day's tasks; the today read
 * takes any day and drops nothing.
 *
 * The day module and the week's rules are pure and DRIVEN over fixtures; the
 * shared completion writer is driven over a stubbed fetch; the route and the
 * screens are anchored to their source with comments stripped (TEST-TRUTH-01).
 *
 * TASKS-ONE-02 (2026-10-14) — Alex's ruling: the day card replaces the week grid,
 * the Daily plan and the Today strip. The week (WeekSection, WeekCell, weekPlan),
 * the shared writer (completeRoutine), TodaysStrip and SectionC_DailyPlan are
 * DELETED, and the completions POST with them; the pins on their code went with
 * the code — each replaced by a pin that it is gone and nothing imports it (T3/T4
 * below, and tasksOne02.test.ts). Every pin on code that stays is kept or moved:
 * the day module and the today route (T1, T2), weekReads' reads, the browser's
 * date, Budget's vendor box, the status words, and the screen scan for a
 * completions URL — which now finds none.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code } from '../sourceText';
import { NOT_PLACED_REASONS } from '../budget/days';
import { parseDayParam, routineDay, routineStatus, type RoutineDayInput } from '../operations/routineDay';
import { TODAY_STATUS_LABEL } from '@/components/workbench/operations/routines/types';

const ROUTE = 'src/app/api/operations/routines/today/route.ts';
const MODULE = 'src/lib/operations/routineDay.ts';
// TASKS-ONE-02 (2026-10-14): the first six are deleted — named so the tests below can say so.
const STRIP = 'src/components/workbench/operations/routines/TodaysStrip.tsx';
const PLAN = 'src/components/workbench/operations/SectionC_DailyPlan.tsx';
const WEEK = 'src/components/workbench/operations/week/WeekSection.tsx';
const CELL = 'src/components/workbench/operations/week/WeekCell.tsx';
const RULES = 'src/components/workbench/operations/week/weekPlan.ts';
const WRITER = 'src/components/workbench/operations/routines/completeRoutine.ts';
const GONE = [STRIP, PLAN, WEEK, CELL, RULES, WRITER];
const READS = 'src/components/workbench/operations/week/weekReads.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
// BUDGET-02 (2026-10-20): the box's file is VendorBox.tsx — DayPlanDrill.tsx less the drill, which left /budget.
const DRILL = 'src/components/budget/VendorBox.tsx';
const SCREEN = 'src/components/budget/BudgetReport.tsx';
const TODAY_MODULE = 'src/lib/localToday.ts';
const PAGE = 'src/app/tasks/page.tsx';

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) out.push(...tsFilesUnder(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

const routine = (over: Partial<RoutineDayInput> = {}): RoutineDayInput => ({
  timezone: 'Asia/Bangkok',
  schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0',
  start_date: null,
  end_date: null,
  ...over,
});
const NOW = new Date('2026-09-30T20:00:00.000Z'); // Bangkok: Oct 1, 03:00 · Los Angeles: Sep 30, 13:00
const iso = (d: ReturnType<typeof routineDay>) => (d.kind === 'occurrence' ? d.expectedAt.toISOString() : d.kind);

// ── T1 · THE PURE DAY MODULE ─────────────────────────────────────────────────

test('T1 a daily routine on a given day — the instant and the local day, in Bangkok and in Los Angeles', () => {
  const bkk = routineDay(routine(), '2026-09-30', NOW);
  assert.deepEqual(bkk, { kind: 'occurrence', day: '2026-09-30', expectedAt: new Date('2026-09-30T00:00:00.000Z') }, '07:00 +07');
  const la = routineDay(routine({ timezone: 'America/Los_Angeles' }), '2026-09-30', NOW);
  assert.deepEqual(la, { kind: 'occurrence', day: '2026-09-30', expectedAt: new Date('2026-09-30T14:00:00.000Z') }, '07:00 PDT');
  // No day asked: TODAY — each routine's own, at now.
  assert.deepEqual(routineDay(routine(), null, NOW), { kind: 'occurrence', day: '2026-10-01', expectedAt: new Date('2026-10-01T00:00:00.000Z') }, 'already Oct 1 in Bangkok');
  assert.deepEqual(routineDay(routine({ timezone: 'America/Los_Angeles' }), null, NOW), { kind: 'occurrence', day: '2026-09-30', expectedAt: new Date('2026-09-30T14:00:00.000Z') }, 'still Sep 30 in LA');
  // DAYBOUNDS-01 (2026-10-11): the day is the Budget's day, stated once — the module
  // expands over days.ts dayWindow and places by days.ts within; dayBounds (local
  // midnight as a real instant, off by the zone's offset) is gone. The pin on it
  // moved here to the new truth; the instants above did not move.
  const m = code(MODULE);
  assert.match(m, /import \{ dayWindow, isIsoDay, within \} from '@\/lib\/budget\/days';/, 'the Budget’s window and its test, imported by name');
  assert.doesNotMatch(m, /dayBounds/, 'no second definition of a day');
});

test('T1 a weekly routine not on that day → none; the start and end dates bound the day', () => {
  const mondays = routine({ schedule_rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0' });
  assert.deepEqual(routineDay(mondays, '2026-09-30', NOW), { kind: 'none', day: '2026-09-30' }, 'a Wednesday');
  assert.equal(iso(routineDay(mondays, '2026-09-28', NOW)), '2026-09-28T02:00:00.000Z', 'a Monday, 09:00 +07');
  const starts = routine({ start_date: new Date('2026-10-01T00:00:00.000Z') });
  assert.equal(iso(routineDay(starts, '2026-09-30', NOW)), 'none', 'before its start date');
  assert.equal(iso(routineDay(starts, '2026-10-01', NOW)), '2026-10-01T00:00:00.000Z', 'on it');
  const ends = routine({ end_date: new Date('2026-09-29T00:00:00.000Z') });
  assert.equal(iso(routineDay(ends, '2026-09-29', NOW)), '2026-09-29T00:00:00.000Z', 'on its end date');
  assert.equal(iso(routineDay(ends, '2026-09-30', NOW)), 'none', 'after it');
});

test('T1 a one-off on its date and off it', () => {
  const once = routine({ schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', start_date: new Date('2026-10-02T00:00:00.000Z'), end_date: new Date('2026-10-02T00:00:00.000Z') });
  assert.equal(iso(routineDay(once, '2026-10-02', NOW)), '2026-10-02T05:00:00.000Z', '12:00 +07 on its day');
  assert.equal(iso(routineDay(once, '2026-10-01', NOW)), 'none');
  assert.equal(iso(routineDay(once, '2026-10-03', NOW)), 'none');
  // Without its end date it still happens once — the anchor, not a bound, makes it one.
  const unbounded = routine({ schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', start_date: new Date('2026-10-02T00:00:00.000Z') });
  assert.equal(iso(routineDay(unbounded, '2026-10-03', NOW)), 'none');
});

test('T1 the status against a fixed now: completed, missed, pending, upcoming', () => {
  const at = new Date('2026-09-30T00:00:00.000Z');
  const min = 60_000;
  assert.equal(routineStatus(at, true, 30, new Date(at.getTime() + 999 * min)), 'completed');
  assert.equal(routineStatus(at, false, 30, new Date(at.getTime() + 31 * min)), 'missed');
  assert.equal(routineStatus(at, false, 30, new Date(at.getTime() + 30 * min)), 'pending', 'at the threshold, still pending');
  assert.equal(routineStatus(at, false, 30, at), 'pending');
  assert.equal(routineStatus(at, false, 30, new Date(at.getTime() - min)), 'upcoming');
});

test('T1 an unreadable zone and an unparsable schedule are REFUSED in the day rules\' words — never UTC, never skipped', () => {
  const mars = routineDay(routine({ timezone: 'Mars/Olympus' }), '2026-09-30', NOW);
  assert.equal(mars.kind, 'refused');
  assert.ok(mars.kind === 'refused' && mars.reason === 'timezone not recognised' && mars.detail.startsWith('"Mars/Olympus": '));
  const blank = routineDay(routine({ timezone: '' }), null, NOW);
  assert.ok(blank.kind === 'refused' && blank.reason === 'timezone not recognised', 'an empty zone is not the system zone');
  const garbled = routineDay(routine({ schedule_rrule: 'NOT A RULE' }), '2026-09-30', NOW);
  assert.ok(garbled.kind === 'refused' && garbled.reason === 'schedule does not parse' && garbled.detail.startsWith('"NOT A RULE": '));
  for (const r of [mars, blank, garbled]) assert.ok(r.kind === 'refused' && NOT_PLACED_REASONS.includes(r.reason), 'days.ts’s own words');
});

test('T1 the date parameter: absent is today; anything but a real YYYY-MM-DD day is refused by name', () => {
  assert.deepEqual(parseDayParam(null), { ok: true, day: null });
  assert.deepEqual(parseDayParam('2026-09-30'), { ok: true, day: '2026-09-30' });
  for (const bad of ['', '2026-02-30', '2026-13-01', '2026-9-3', 'today', '2026-09-30T00:00:00Z']) {
    const r = parseDayParam(bad);
    assert.ok(!r.ok, `${JSON.stringify(bad)} is refused`);
    assert.equal(r.ok ? null : r.message, `date ${JSON.stringify(bad)} is not a 'YYYY-MM-DD' day`);
  }
});

test('T1 the module is pure: no client, no request, no clock', () => {
  const m = code(MODULE);
  assert.doesNotMatch(m, /@prisma\/client|@\/lib\/prisma|next\/server|process\.env|Date\.now\(|new Date\(\s*\)|console\./);
  // DAYBOUNDS-01: the window's names are the Budget's (dayWindow) — the pin moved with them.
  assert.match(m, /expandBetween\(r\.schedule_rrule, r\.timezone, windowFrom, windowTo, scheduleAnchor\(r\.start_date\)\);/, 'the one anchored expansion');
  assert.match(m, /instantToZoned\(now, r\.timezone\);/, 'the zone is read first');
});

// ── T2 · THE ROUTE ───────────────────────────────────────────────────────────

test('T2 the route: the auth gate first, then the optional date — a bad one is a 400 naming the field', () => {
  const r = code(ROUTE);
  const order = [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const asked = parseDayParam(request.nextUrl.searchParams.get('date'));",
    "return NextResponse.json({ error: 'Validation', field: 'date', message: asked.message }, { status: 400 });",
    'const now = new Date();',
    'prisma.operations_routines.findMany(',
  ].map((piece) => r.indexOf(piece));
  assert.ok(order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1])), 'in that order');
});

test('T2 the route drops nothing: refused in the response, no console-and-skip, no UTC stand-in', () => {
  const r = code(ROUTE);
  assert.match(r, /const day = routineDay\(r, asked\.day, now\);\n\s*if \(day\.kind === 'refused'\) \{\n\s*refused\.push\(\{ routine_id: r\.id, name: r\.name, reason: day\.reason, detail: day\.detail \}\);\n\s*continue;/);
  assert.match(r, /return NextResponse\.json\(\{\n\s*generated_at: now\.toISOString\(\),\n\s*entries,\n\s*refused,\n\s*\}\);/);
  assert.doesNotMatch(r, /console\./, 'no console line in place of a refusal');
  assert.doesNotMatch(r, /todayBounds|formatLocalDate|toISOString\(\)\.slice\(0, 10\)|expandBetween/, 'the day logic lives in the module');
  assert.match(r, /const status: TodayStatus = routineStatus\(expectedAt, completion !== null, r\.fail_threshold_minutes, now\);/);
});

// ── T3 · THE WEEK ────────────────────────────────────────────────────────────
// TASKS-ONE-02 (2026-10-14): the week is DELETED (Alex's ruling: the day card replaces the week grid). Its rules
// (weekDays, shiftWeek, orderRoutines, timeWindow, placeLines, offersDone over COMPLETABLE), its section's reads and
// rows, its cell's done/note/vendor box and its named-above-the-grid lines were pinned here; they went with the code.
// What stays is pinned below: the reads file (the ruling keeps it — the day card reads through it), the browser's
// date, Budget's vendor box, and that the week is gone with nothing importing it.

test('T3 the week is gone — its files deleted and nothing imports them; the page mounts no week', () => {
  for (const f of GONE) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is deleted`);
  // The tests name the deleted paths to say they are gone; a test that IMPORTED one would not load (tsc, npm test).
  const importers = [...tsFilesUnder('src'), ...tsFilesUnder('scripts')]
    .filter((f) => !f.includes('__tests__'))
    .filter((f) => /\/(TodaysStrip|SectionC_DailyPlan|WeekSection|WeekCell|weekPlan|completeRoutine)'/.test(code(f)));
  assert.deepEqual(importers, [], 'no file imports a deleted one');
  // TASKS-ONE-01 (2026-10-14): this week came directly under the day card. TASKS-ONE-02: the week is deleted — the
  // pin moved to its absence: the day card, then the projects list.
  const page = code(PAGE);
  assert.doesNotMatch(page, /WeekSection/);
  // TIME-01 (2026-10-19): the day card moved to /time — the projects list is first on /tasks now.
  // BACKLOG-02 (Alex, 2026-10-20): a boundary is back on /tasks — around the projects list ALONE, which reads ?project= and ?new=project (useSearchParams); the day card stays /time's — still first.
  assert.match(page, /<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>/); // WORK-01 (2026-10-24): THE WORK first
});

test('T3 the reads stay: four URLs through one fetch in the one reader; signed out named; the day card reads through it', () => {
  const reads = code(READS);
  const urls = [...reads.matchAll(/await readJson\((.+)\);$/gm)].map((m) => m[1]);
  assert.deepEqual(urls, [
    "'/api/operations/routines?is_active=true'",
    '`/api/operations/routines/today?date=${encodeURIComponent(day)}`',
    '`/api/budget/report?${query.toString()}`',
    '`/api/operations/daily-plan/items?${new URLSearchParams({ from, to }).toString()}`',
  ]);
  assert.match(reads, /new URLSearchParams\(\{ view: 'week', weekOf, asOf \}\)/);
  assert.equal((reads.match(/\bfetch\s*\(/g) ?? []).length, 1, 'one fetch, in the one reader');
  assert.equal((reads.match(/SIGNED_OUT_WORDS/g) ?? []).length, 2, 'a redirect or a 401 reads as signed out');
  // TASKS-ONE-02: the week's readDay / readItems callers moved — the day card is the reader now.
  assert.match(code(CARD), /import \{ readDay, readItems, type DayAnswer, type Read \} from '\.\.\/week\/weekReads';/);
  for (const f of tsFilesUnder('src/components/workbench/operations/week')) {
    assert.doesNotMatch(code(f), /plan-vendors|vendor-directory|function VendorBox/, `${f} copies no vendor box`);
  }
});

test('T3 the browser\'s date, once: moved out of BudgetReport, outside the Budget code', () => {
  assert.match(code(TODAY_MODULE), /export function localToday\(\): string \{/);
  assert.match(code(SCREEN), /import \{ localToday \} from '@\/lib\/localToday';/);
  assert.doesNotMatch(code(SCREEN), /function localToday\(/);
  // TASKS-ONE-02 (2026-10-14): the week read it; the week is deleted — the day card reads it (moved).
  assert.match(code(CARD), /import \{ localToday \} from '@\/lib\/localToday';/);
  const readers = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components'), ...tsFilesUnder('src/lib')]
    .filter((f) => !f.includes('__tests__') && /getFullYear\(\)/.test(code(f)) && /getMonth\(\)/.test(code(f)) && /getDate\(\)/.test(code(f)) && /padStart/.test(code(f)));
  assert.ok(readers.includes(TODAY_MODULE));
  for (const f of tsFilesUnder('src/lib/budget')) assert.doesNotMatch(code(f), /localToday/, `${f} does not read the clock`);
  // The vendor box (was DayPlanDrill): two exports, and no fetch added (setVendor, clearVendor, addVendor, the directory).
  const d = code(DRILL);
  assert.match(d, /\nexport function useDirectory\(\): /);
  assert.match(d, /\nexport function VendorBox\(\{ line, bookName, directory, reload \}: \{/);
  assert.equal((d.match(/\bfetch\s*\(/g) ?? []).length, 4);
});

// ── T4 · ONE WRITER; TODAY AND THE DAILY PLAN NAME WHAT THEY CANNOT PLACE ────
// TASKS-ONE-02 (2026-10-14): the shared writer (completeRoutine — its body, its note, its refusal words), Today's
// mark-done through it and the Daily Plan's refused list were pinned here; all three are DELETED. A routine is done
// now when its stop records say so (routineDone.ts, tasksOne02.test.ts), and the day card names a refused routine.

test('T4 no screen posts a completion now; the status words stay one copy; the day card names every refused routine', () => {
  // WEEK-02 (2026-09-30): the scan reads every completions URL — the POST's and the PATCH's.
  // TASKS-ONE-02 (2026-10-14): the writer was the only one; it is deleted with both routes — the scan finds none.
  const posters = [...tsFilesUnder('src/components'), ...tsFilesUnder('src/app')].filter((f) => /\/completions(`|\/\$\{|')/.test(code(f)));
  assert.deepEqual(posters, []);
  assert.deepEqual(TODAY_STATUS_LABEL, { pending: 'pending', completed: 'completed', missed: 'missed', upcoming: 'upcoming' });
  const c = code(CARD);
  assert.match(c, /const refused = dayRead !== null && dayRead\.ok \? dayRead\.value\.refused : \[\];/);
  assert.match(c, /<RefusedRoutines refused=\{refused\} \/>/);
});
