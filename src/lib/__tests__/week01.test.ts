/**
 * WEEK-01 (2026-09-30) — THIS WEEK: every routine on every day, done with its
 * note, each paid routine's place for the day, each day's tasks; the today read
 * takes any day and drops nothing.
 *
 * The day module and the week's rules are pure and DRIVEN over fixtures; the
 * shared completion writer is driven over a stubbed fetch; the route and the
 * screens are anchored to their source with comments stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { NOT_PLACED_REASONS } from '../budget/days';
import { viewRange } from '../budget/report';
import type { PlanLine } from '../budget/planLines';
import { dayBounds, parseDayParam, routineDay, routineStatus, type RoutineDayInput } from '../operations/routineDay';
import { completeRoutine } from '@/components/workbench/operations/routines/completeRoutine';
import { TODAY_STATUS_LABEL } from '@/components/workbench/operations/routines/types';
import {
  COMPLETABLE, cellKey, offersDone, orderRoutines, placeLines, shiftWeek, timeWindow, weekDays, type WeekRoutine,
} from '@/components/workbench/operations/week/weekPlan';

const ROUTE = 'src/app/api/operations/routines/today/route.ts';
const MODULE = 'src/lib/operations/routineDay.ts';
const STRIP = 'src/components/workbench/operations/routines/TodaysStrip.tsx';
const PLAN = 'src/components/workbench/operations/SectionC_DailyPlan.tsx';
const WEEK = 'src/components/workbench/operations/week/WeekSection.tsx';
const CELL = 'src/components/workbench/operations/week/WeekCell.tsx';
const RULES = 'src/components/workbench/operations/week/weekPlan.ts';
const READS = 'src/components/workbench/operations/week/weekReads.ts';
const WRITER = 'src/components/workbench/operations/routines/completeRoutine.ts';
const DRILL = 'src/components/budget/DayPlanDrill.tsx';
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
  // The bounds are today's rule for any day: local midnight, then 24 hours.
  assert.deepEqual(dayBounds('2026-11-01', 'America/Los_Angeles'), { start: new Date('2026-11-01T07:00:00.000Z'), end: new Date('2026-11-02T07:00:00.000Z') });
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
  assert.match(m, /expandBetween\(r\.schedule_rrule, r\.timezone, start, end, scheduleAnchor\(r\.start_date\)\);/, 'the one anchored expansion');
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

test('T3 the seven days from viewRange — Monday to Sunday, across a month and a year', () => {
  assert.deepEqual(weekDays('2026-10-01'), ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(weekDays('2026-12-31').slice(3), ['2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  for (const d of ['2026-10-01', '2026-12-31', '2027-03-08']) {
    const { rangeFrom, rangeTo } = viewRange({ kind: 'week', weekOf: d });
    assert.equal(weekDays(d)[0], rangeFrom);
    assert.equal(weekDays(d)[6], rangeTo);
  }
  assert.equal(shiftWeek('2026-10-01', 0), '2026-09-28');
  assert.equal(shiftWeek('2026-10-01', 1), '2026-10-05');
  assert.equal(shiftWeek('2026-10-01', -1), '2026-09-21');
  assert.match(code(RULES), /const \{ rangeFrom, rangeTo \} = viewRange\(\{ kind: 'week', weekOf \}\);/, 'the model’s one Monday rule');
});

test('T3 the rows: by start time, then name; no start time last', () => {
  const r = (id: string, name: string, start: string | null): WeekRoutine => ({ id, name, start_time: start === null ? null : `1970-01-01T${start}:00.000Z`, steps: [] });
  const rows = orderRoutines([r('e', 'Evening', null), r('d', 'Dinner', '17:30'), r('x', 'Execution Plan', '07:30'), r('v', 'Daily Vision', '07:00'), r('b', 'Brunch', '11:00'), r('a', 'Anchor', null)]);
  assert.deepEqual(rows.map((x) => x.name), ['Daily Vision', 'Execution Plan', 'Brunch', 'Dinner', 'Anchor', 'Evening']);
  assert.equal(timeWindow('1970-01-01T07:00:00.000Z', '1970-01-01T07:30:00.000Z'), '07:00–07:30');
  assert.equal(timeWindow('1970-01-01T17:30:00.000Z', null), 'from 17:30');
  assert.equal(timeWindow(null, null), null);
});

test('T3 the report\'s lines, placed by address kind — a line with no row is named, never dropped', () => {
  const line = (kind: PlanLine['address']['kind'], id: string, day: string, label = 'x'): PlanLine => ({
    entityId: 'e_me', code: '6110', day, cents: 1500, source: kind === 'project_task' ? 'task' : 'routine', label, line: null, time: null,
    address: { kind, id, instant: kind === 'project_task' ? null : `${day}T05:00:00.000Z` }, vendor: null,
  });
  const routines: WeekRoutine[] = [
    { id: 'brunch', name: 'Brunch', start_time: null, steps: [] },
    { id: 'evening', name: 'Evening', start_time: null, steps: [{ id: 'step-bar' }, { id: 'step-taxi' }] },
  ];
  const p = placeLines([
    line('routine', 'brunch', '2026-09-30'),
    line('routine_line', 'step-bar', '2026-09-30'),
    line('routine_line', 'step-taxi', '2026-09-30'),
    line('project_task', 'task-1', '2026-10-01'),
    line('routine', 'gone', '2026-09-30', 'Gone'),
    line('routine_line', 'step-gone', '2026-09-30', 'Gone too'),
  ], routines);
  assert.equal(p.routineCells.get(cellKey('brunch', '2026-09-30'))?.length, 1);
  assert.deepEqual(p.routineCells.get(cellKey('evening', '2026-09-30'))?.map((l) => l.address.id), ['step-bar', 'step-taxi'], "a line sits in its routine's row");
  assert.deepEqual(p.taskCells.get('2026-10-01')?.map((l) => l.address.id), ['task-1']);
  assert.deepEqual(p.withoutRow.map((l) => l.label), ['Gone', 'Gone too']);
});

test('T3 a cell\'s done: today or earlier, on the statuses Today completes — never a later day', () => {
  assert.deepEqual(COMPLETABLE, ['pending', 'upcoming', 'missed']);
  // Held to Today's own rule, line for line.
  assert.match(code(STRIP), /const canComplete = e\.status === 'pending' \|\| e\.status === 'upcoming' \|\| e\.status === 'missed';/);
  assert.equal(offersDone('pending', '2026-09-30', '2026-09-30'), true, 'today');
  assert.equal(offersDone('missed', '2026-09-28', '2026-09-30'), true, 'an earlier day');
  assert.equal(offersDone('upcoming', '2026-10-01', '2026-09-30'), false, 'a later day offers no done');
  assert.equal(offersDone('completed', '2026-09-30', '2026-09-30'), false);
});

test('T3 the section: seven day reads, one report read, one range read of the daily plan — and no other fetch', () => {
  const w = code(WEEK);
  assert.match(w, /Promise\.all\(days\.map\(async \(day\) => \[day, await readDay\(day\)\] as const\)\)/, 'one today?date read per day');
  assert.match(w, /readItems\(days\[0\], days\[6\]\)/, 'Monday to Sunday, one read');
  assert.match(w, /const r = await readReport\(weekOf, today\);/, 'asOf is the browser’s date');
  assert.match(w, /const directory = useDirectory\(\);/);
  assert.equal((w.match(/useDirectory\(\)/g) ?? []).length, 1, 'one directory for the section');
  assert.match(w, /const t = localToday\(\);/);
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
  for (const f of [WEEK, CELL, RULES]) assert.doesNotMatch(code(f), /\bfetch\s*\(/, `${f} fetches nothing of its own`);
  // The rows: the active routines, ordered; the head reads the lines leaf.
  assert.match(w, /const rows = routines !== null && routines\.ok \? orderRoutines\(routines\.value\) : \[\];/);
  assert.match(w, /routinePlanned\(\{ budget_amount: r\.budget_amount \?\? null, coa_code: r\.coa_code \?\? null, steps: r\.steps \}\)/);
  assert.match(w, /\{plannedLine\(planned\)\}/);
  assert.match(w, /return book \? book\.name : ACCOUNT_CELL_WORDS\.bookNotLoaded;/);
});

test('T3 a cell: "—", done with its note in full, or a note box and ✓ done sent through the shared writer', () => {
  const c = code(CELL);
  assert.match(c, /if \(entry === undefined\) \{\n\s*return \(\n\s*<>\n\s*<span className="text-text-muted">—<\/span>/);
  assert.match(c, /✓ done \{instantToZoned\(new Date\(entry\.completion\.completed_at\), timezone\)\.time\}/);
  assert.match(c, /\{entry\.completion\.notes !== null && \(\n\s*<div className="mt-0\.5 whitespace-pre-wrap[^"]*" data-week-note>\{entry\.completion\.notes\}<\/div>/, 'the note in full');
  assert.match(c, /\{TODAY_STATUS_LABEL\[entry\.status\]\}/, "Today's words");
  assert.match(c, /\{offersDone\(entry\.status, day, today\) && \(/);
  assert.match(c, /const answer = await completeRoutine\(entry\.routine\.id, entry\.expected_at, note\.trim\(\) === '' \? undefined : note\);/);
  assert.match(c, /if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}/, "a refusal is the route's own words, in the cell");
  // WEEK-02 (2026-09-30): a done's note is edited now — through the one writer; the cell still sends nothing of its own.
  assert.doesNotMatch(c, /method: 'PATCH'|\/completions/, 'the edit goes through the one writer — the cell names no route');
  assert.match(c, /await editCompletionNote\(entry\.routine\.id, entry\.completion\.id, draft\)/, "the writer's edit, with the row's routine and its completion");
  // The amount and Budget's own vendor box — imported, never copied.
  assert.match(c, /import \{ VendorBox, type useDirectory \} from '@\/components\/budget\/DayPlanDrill';/);
  assert.match(c, /<VendorBox line=\{line\} bookName=\{bookName\(line\.entityId\)\} directory=\{directory\} reload=\{reload\} \/>/);
  assert.match(c, /\{formatCents\(line\.cents\)\}/);
  for (const f of tsFilesUnder('src/components/workbench/operations/week')) {
    assert.doesNotMatch(code(f), /plan-vendors|vendor-directory|function VendorBox/, `${f} copies no vendor box`);
  }
});

test('T3 named above the grid: refused routines, the report\'s own words, stranded vendors, lines with no row; the Tasks row from the range read', () => {
  const w = code(WEEK);
  assert.match(w, /<RefusedRoutines refused=\{refused\} \/>/);
  assert.match(w, /\{report !== null && !report\.ok && <p[^>]*data-week-report-failed>\{report\.words\}<\/p>\}/);
  assert.match(w, /\{plans !== null && plans\.listed && plans\.stranded\.length > 0 && \(/);
  assert.match(w, /\{placed\.withoutRow\.length > 0 && \(/);
  // The report's failure leaves the rest standing: the rows, cells and tasks do not read it.
  assert.match(w, /const plans = report !== null && report\.ok \? report\.value\.plans : null;/);
  // The Tasks row: the day's items — the task's title and its status in the labels' words, or an ad hoc title.
  assert.match(w, /it\.plan_date\.slice\(0, 10\) === day/);
  assert.match(w, /\{it\.task\.title\}<\/span>\n\s*<span className="text-text-muted"> · \{taskStatusWords\(it\.task\.status\)\}<\/span>/);
  assert.match(w, /\{it\.ad_hoc_title\}/);
  assert.match(w, /const lines = placed\.taskCells\.get\(day\) \?\? \[\];/);
  assert.equal((code(READS).match(/SIGNED_OUT_WORDS/g) ?? []).length, 2, 'a redirect or a 401 reads as signed out');
  // Today's column is marked.
  assert.match(w, /data-week-today=\{day === today \? '' : undefined\}/);
});

test('T3 the browser\'s date, once: moved out of BudgetReport, outside the Budget code', () => {
  assert.match(code(TODAY_MODULE), /export function localToday\(\): string \{/);
  assert.match(code(SCREEN), /import \{ localToday \} from '@\/lib\/localToday';/);
  assert.doesNotMatch(code(SCREEN), /function localToday\(/);
  assert.match(code(WEEK), /import \{ localToday \} from '@\/lib\/localToday';/);
  const readers = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components'), ...tsFilesUnder('src/lib')]
    .filter((f) => !f.includes('__tests__') && /getFullYear\(\)/.test(code(f)) && /getMonth\(\)/.test(code(f)) && /getDate\(\)/.test(code(f)) && /padStart/.test(code(f)));
  assert.ok(readers.includes(TODAY_MODULE));
  for (const f of tsFilesUnder('src/lib/budget')) assert.doesNotMatch(code(f), /localToday/, `${f} does not read the clock`);
  // DayPlanDrill: two exports, and no fetch added (setVendor, clearVendor, addVendor, the directory).
  const d = code(DRILL);
  assert.match(d, /\nexport function useDirectory\(\): /);
  assert.match(d, /\nexport function VendorBox\(\{ line, bookName, directory, reload \}: \{/);
  assert.equal((d.match(/\bfetch\s*\(/g) ?? []).length, 4);
});

test('T3 the page mounts this week first', () => {
  const page = code(PAGE);
  assert.match(page, /<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<WeekSection \/>\n\s*<SectionD_ProjectBacklog \/>/);
});

// ── T4 · ONE WRITER; TODAY AND THE DAILY PLAN NAME WHAT THEY CANNOT PLACE ────

test('T4 the shared writer: with no note the body is Today\'s, byte for byte; with one, the note rides along', async () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    return new Response(JSON.stringify({ completion: { id: 'c1' } }), { status: 201, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    assert.deepEqual(await completeRoutine('r1', '2026-09-30T00:00:00.000Z'), { ok: true });
    assert.deepEqual(await completeRoutine('r1', '2026-09-30T00:00:00.000Z', 'Clear head. Ship WEEK-01.'), { ok: true });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(sent[0].url, '/api/operations/routines/r1/completions');
  assert.equal(sent[0].init.method, 'POST');
  assert.deepEqual(sent[0].init.headers, { 'Content-Type': 'application/json' });
  assert.equal(sent[0].init.body, '{"expected_at":"2026-09-30T00:00:00.000Z"}', 'exactly what Today always sent');
  assert.equal(sent[1].init.body, '{"expected_at":"2026-09-30T00:00:00.000Z","notes":"Clear head. Ship WEEK-01."}');
});

test('T4 the writer\'s refusal is the route\'s own words — the order Today read them in', async () => {
  const realFetch = globalThis.fetch;
  const answer = (body: object, status: number) => {
    globalThis.fetch = (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    return completeRoutine('r1', '2026-09-30T00:00:00.000Z');
  };
  try {
    assert.deepEqual(await answer({ error: 'Duplicate', message: 'a completion already exists for this expected occurrence' }, 409), { ok: false, message: 'a completion already exists for this expected occurrence' });
    assert.deepEqual(await answer({ error: 'Not found' }, 404), { ok: false, message: 'Not found' });
    assert.deepEqual(await answer({}, 500), { ok: false, message: 'failed to mark complete' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('T4 Today marks done through the one writer; Today and the Daily Plan name every refused routine', () => {
  const s = code(STRIP);
  assert.match(s, /const answer = await completeRoutine\(routineId, expectedAt\);/, 'no note from Today');
  assert.doesNotMatch(s, /\/completions/, 'the POST lives in the writer alone');
  assert.equal((s.match(/<RefusedRoutines refused=\{refused\} \/>/g) ?? []).length, 2, 'in the list and in the empty state');
  assert.match(s, /setRefused\(body\.refused\);/);
  assert.match(s, /\{TODAY_STATUS_LABEL\[e\.status\]\}/);
  assert.doesNotMatch(s, /const STATUS_LABEL/, 'one copy of the words');
  assert.deepEqual(TODAY_STATUS_LABEL, { pending: 'pending', completed: 'completed', missed: 'missed', upcoming: 'upcoming' });
  const p = code(PLAN);
  assert.match(p, /setRefused\(body\.refused\);/);
  assert.match(p, /<RefusedRoutines refused=\{refused\} \/>/);
  assert.match(p, /const showEmpty = !hasRoutines && !hasRefused && !hasItems && !loading && !error;/, 'a refused routine is never hidden behind "nothing scheduled"');
  // The writer is the only place a completion is posted from a screen.
  // WEEK-02 (2026-09-30): the scan reads every completions URL — the POST's and the PATCH's.
  const posters = [...tsFilesUnder('src/components'), ...tsFilesUnder('src/app')].filter((f) => !f.startsWith('src/app/api/') && /\/completions(`|\/\$\{)/.test(code(f)));
  assert.deepEqual(posters, [WRITER]);
  assert.match(comments(WRITER), /With no note the body\s*\n\s*\*\s*is exactly what Today always sent/);
});
