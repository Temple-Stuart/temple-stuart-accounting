/**
 * DAYCARD-01 (2026-10-11) — THE DAY CARD: the day's stops in clock order with
 * their planned cost from the Budget's own plan lines, one phone-shaped card at
 * /tasks/day, one stop at a time by URL; the card writes nothing.
 *
 * The rules (day/dayCard.ts) are pure and DRIVEN over fixtures; the day's one
 * read of its own (day/dayReads.ts) is driven over a stubbed fetch; the screen,
 * the page and the two doors are anchored to their source with comments
 * stripped (TEST-TRUTH-01, through code() — the reader law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code } from '../sourceText';
import type { NotPlaced } from '../budget/days';
import type { PlanLine } from '../budget/planLines';
import { TOOL_REGISTRY } from '../toolRegistry';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { Routine, RoutineStep, TodayRoutineEntry, TodayStatus } from '@/components/workbench/operations/routines/types';
import {
  ACTUAL_HEAD_WORD, BADGE_WORDS, BRAND_WORDS, BUDGET_HEAD_WORD, DESCRIPTION_HEAD_WORD, HOOK_WORDS, ON_BUDGET_WORDS, PLAN_WORD, PLANNED_NOT_READ_WORDS, PLANNED_WORD, STOPS_NOT_READ_WORDS, TASK_WORD, TIME_HEAD_WORD, TODAY_WORD, UNTITLED_WORDS, VENDOR_HEAD_WORD,
  CELL_GAP, COLUMN_WIDTHS, FIGURE_WIDTH, badDateWords, badStepWords, completenessWords, dayCarryWords, dayMeter, dayShortWords, dayStops, dayVerdict, focusStop,
  headerWords, heroWord, intervalWords, linesUnreadWords, linesWithoutStopWords, notPlacedWords, notPricedWords, openStepWords, planDollars, progressPercent, provenanceWords,
  routineFigureWords, planSoFarWords, spentOutOfWords, stepHeaderWords, PLATE_BORDER, PLATE_INNER_WIDTH, PLATE_PADDING_X, PLATE_WIDTH, spentSoFarWords, strandedWords, unmatchedWords, whereWords,
  type DayCardInput,
} from '@/components/workbench/operations/day/dayCard';
import { dayReportFailedWords, readDayReport } from '@/components/workbench/operations/day/dayReads';
import type { StopRecordRow } from '@/lib/operations/stopRecord';
import { CARD_IMAGE_PIXEL_RATIO, DOWNLOAD_IMAGE_WORDS, cardImageFailedWords, cardImageName, slugWords } from '@/components/workbench/operations/cardImage';
import { readJson } from '@/components/workbench/operations/week/weekReads';

const DAY_DIR = 'src/components/workbench/operations/day';
const RULES = `${DAY_DIR}/dayCard.ts`;
const READS = `${DAY_DIR}/dayReads.ts`;
const CARD = `${DAY_DIR}/DayCard.tsx`;
const PAGE = 'src/app/tasks/day/page.tsx';
const WEEK = 'src/components/workbench/operations/week/WeekSection.tsx';
const WEEK_READS = 'src/components/workbench/operations/week/weekReads.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';

// ── FIXTURES ────────────────────────────────────────────────────────────────

const DAY = '2026-10-11';
const BKK = 'Asia/Bangkok';
/** 07:00 Bangkok on the day. */
const AT = '2026-10-11T00:00:00.000Z';

const step = (over: Partial<RoutineStep> & { id: string; step_order: number; activity: string }): RoutineStep => ({
  routine_id: 'morning', user_id: 'u', entity_id: 'P', time_of_day: null, sub_activity: null, location: null, duration_minutes: null,
  notes: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
});

const routine = (over: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], role: 'none', ...over,
});

const entry = (r: Routine, status: TodayStatus = 'pending', expected_at: string = AT): TodayRoutineEntry => ({ routine: r, expected_at, status, completion: null });

const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});

const item = (over: Partial<DailyPlanItem> & { id: string }): DailyPlanItem => ({
  user_id: 'u', entity_id: 'P', plan_date: `${DAY}T00:00:00.000Z`, task_id: null, ad_hoc_title: null, ad_hoc_description: null, display_order: 0,
  notes: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', created_by: null, task: null, calendar_blocks: [], ...over,
});

const block = (scheduled_start: string, status: DailyPlanItem['calendar_blocks'][number]['status'] = 'scheduled') => ({
  id: `b-${scheduled_start}`, scheduled_start, scheduled_end: scheduled_start, actual_start: null, actual_end: null, status, notes: null,
});

const task = (id: string, title: string, status: NonNullable<DailyPlanItem['task']>['status'] = 'open') => ({
  id, title, status, project_id: 'proj', coa_code: null, estimated_cost_usd: null, actual_cost_usd: null, actual_minutes: null, completed_at: null,
});

/** The morning: three lines — two timed, one not — and a routine-level location. */
const morning = routine({
  id: 'morning', name: 'Morning', location: 'Home', steps: [
    step({ id: 'coffee', step_order: 2, activity: 'Coffee', time_of_day: '1970-01-01T07:30:00.000Z', location: 'Roots Thonglor', duration_minutes: 30 }),
    step({ id: 'stretch', step_order: 1, activity: 'Stretch', time_of_day: '1970-01-01T06:30:00.000Z' }),
    step({ id: 'journal', step_order: 3, activity: 'Journal' }),
  ],
});
/** A stepless routine at 20:00 Bangkok. */
const gym = routine({ id: 'gym', name: 'Gym', location: 'Fitness First', schedule_rrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0' });
const GYM_AT = '2026-10-11T13:00:00.000Z';

/** records: null — not read (STOP-01); the record-side rules are stop01.test.ts's. */
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: null, ...over });
/** STOP-01: what every stop carries when the records were not read — the status its routine's (or the task's), nothing recorded. */
const unrecorded = (statusSource: 'routine' | 'task' = 'routine') => ({ statusSource, record: null, actualCents: null, actualSource: null, doneAt: null, lateMinutes: null, actualMinutes: null, role: 'none' as const, planLine: null, planLineState: 'none' as const });

/** Each step found AFTER the one before it — a missing or out-of-order step fails by name (TABLE-01). */
function inOrderOf(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── T1 · THE RULES ───────────────────────────────────────────────────────────

test('T1 a routine with three lines gives three stops in step order by time; the untimed one takes the occurrence’s time in the routine’s zone', () => {
  const r = dayStops(input({ entries: [entry(morning)] }));
  // TABLE-01: the one place became the vendor (null — no plan line) and the location (the line's, else the routine's).
  assert.deepEqual(r.stops.map((s) => [s.kind, s.key, s.time, s.label, s.line, s.vendor, s.location, s.minutes, s.cents, s.status]), [
    ['line', `line:stretch:${AT}`, '06:30', 'Morning', 'Stretch', null, 'Home', null, null, 'open'],
    ['line', `line:journal:${AT}`, '07:00', 'Morning', 'Journal', null, 'Home', null, null, 'open'],
    ['line', `line:coffee:${AT}`, '07:30', 'Morning', 'Coffee', null, 'Roots Thonglor', 30, null, 'open'],
  ]);
  assert.equal(r.plannedCents, 0);
  assert.equal(r.notPriced, 3);
});

test('T1 a stepless routine is one stop at its occurrence’s time; the statuses map; a done routine’s stops are done', () => {
  const r = dayStops(input({ entries: [entry(gym, 'completed', GYM_AT), entry(morning, 'missed')] }));
  assert.deepEqual(r.stops.map((s) => [s.key, s.time, s.status]), [
    [`line:stretch:${AT}`, '06:30', 'missed'],
    [`line:journal:${AT}`, '07:00', 'missed'],
    [`line:coffee:${AT}`, '07:30', 'missed'],
    [`routine:gym:${GYM_AT}`, '20:00', 'done'],
  ]);
  assert.deepEqual(r.stops[3], { kind: 'routine', key: `routine:gym:${GYM_AT}`, time: '20:00', label: 'Gym', line: null, vendor: null, location: 'Fitness First', minutes: null, cents: null, status: 'done', address: { kind: 'routine', id: 'gym', instant: GYM_AT }, zone: BKK, ...unrecorded() });
  for (const [status, expected] of [['pending', 'open'], ['upcoming', 'later'], ['completed', 'done'], ['missed', 'missed']] as const) {
    assert.equal(dayStops(input({ entries: [entry(gym, status, GYM_AT)] })).stops[0].status, expected);
  }
});

test('T1 order: by time, then label, then line; stops with no time last, as they arrived (routines, then items)', () => {
  const a = routine({ id: 'a', name: 'Alpha', steps: [step({ id: 'a2', step_order: 1, activity: 'Zed', time_of_day: '1970-01-01T09:00:00.000Z' }), step({ id: 'a1', step_order: 2, activity: 'Able', time_of_day: '1970-01-01T09:00:00.000Z' })] });
  const b = routine({ id: 'b', name: 'Beta', steps: [step({ id: 'b1', step_order: 1, activity: 'Run', time_of_day: '1970-01-01T09:00:00.000Z' })] });
  const r = dayStops(input({
    entries: [entry(b), entry(a)],
    items: [item({ id: 'i-late', ad_hoc_title: 'Call mum', calendar_blocks: [block('2026-10-11T03:00:00.000Z', 'cancelled')] }), item({ id: 'i-timed', ad_hoc_title: 'Ship it', calendar_blocks: [block('2026-10-11T01:00:00.000Z')] })],
  }));
  assert.deepEqual(r.stops.map((s) => [s.time, s.label, s.line]), [
    ['08:00', 'Ship it', null],
    ['09:00', 'Alpha', 'Able'],
    ['09:00', 'Alpha', 'Zed'],
    ['09:00', 'Beta', 'Run'],
    [null, 'Call mum', null],
  ]);
});

test('T1 a task: its first block that is not cancelled, in the viewer’s zone; a cancelled-only task has no time and comes last; done when completed; the title or the ad hoc title', () => {
  const viewer = dayStops(input({
    viewerZone: 'Asia/Bangkok',
    items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship DAYCARD-01'), calendar_blocks: [block('2026-10-11T02:00:00.000Z', 'cancelled'), block('2026-10-11T03:00:00.000Z'), block('2026-10-11T05:00:00.000Z')] })],
  }));
  assert.deepEqual(viewer.stops[0], { kind: 'task', key: 'task:i1', time: '10:00', label: 'Ship DAYCARD-01', line: null, vendor: null, location: null, minutes: null, cents: null, status: 'open', address: null, zone: null, ...unrecorded('task') });
  const la = dayStops(input({ viewerZone: 'America/Los_Angeles', items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship DAYCARD-01'), calendar_blocks: [block('2026-10-11T03:00:00.000Z')] })] }));
  assert.equal(la.stops[0].time, '20:00', 'the day before in Los Angeles, at 20:00 — the block’s clock in the viewer’s zone, as Tab 1 draws it');
  const none = dayStops(input({ items: [item({ id: 'i2', task_id: 't2', task: task('t2', 'Audit the week', 'completed'), calendar_blocks: [block('2026-10-11T03:00:00.000Z', 'cancelled')] }), item({ id: 'i3', ad_hoc_title: 'Walk', calendar_blocks: [block('2026-10-11T04:00:00.000Z')] })] }));
  assert.deepEqual(none.stops.map((s) => [s.key, s.time, s.label, s.status]), [['task:i3', '11:00', 'Walk', 'open'], ['task:i2', null, 'Audit the week', 'done']]);
  assert.equal(dayStops(input({ items: [item({ id: 'i4' })] })).stops[0].label, UNTITLED_WORDS, 'an item with no task and no title is named as such, never a blank row');
});

test('T1 TABLE-01: the vendor and the location are two facts — the vendor is the matched line’s and nothing else; the location is the line’s, else the routine’s; a blank location is no location; neither is ever the other', () => {
  const vendor = { id: 'v1', name: 'Luka Sathorn', entityId: 'P', grain: 'occurrence' as const };
  const priced = line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee', vendor });
  // A line stop with a vendor AND a step location: both, each its own.
  const withVendor = dayStops(input({ entries: [entry(morning)], lines: [priced] }));
  const coffee = withVendor.stops.find((s) => s.line === 'Coffee')!;
  assert.equal(coffee.vendor, 'Luka Sathorn');
  assert.equal(coffee.location, 'Roots Thonglor', 'the vendor does not displace the location');
  // No vendor on the line: the vendor is null — the location never stands in for it.
  const noVendor = dayStops(input({ entries: [entry(morning)], lines: [{ ...priced, vendor: null }] }));
  assert.equal(noVendor.stops.find((s) => s.line === 'Coffee')?.vendor, null);
  assert.equal(noVendor.stops.find((s) => s.line === 'Coffee')?.location, 'Roots Thonglor', 'the line’s own location');
  assert.equal(noVendor.stops.find((s) => s.line === 'Stretch')?.location, 'Home', 'a line with no location takes the routine’s');
  assert.equal(noVendor.stops.find((s) => s.line === 'Stretch')?.vendor, null);
  // A stepless routine with a routine location and no vendor: — · the location.
  const gymStop = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)] })).stops[0];
  assert.deepEqual([gymStop.vendor, gymStop.location], [null, 'Fitness First']);
  // A stepless routine with a vendor on its line: the vendor, and still the routine's location.
  const gymLine = line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 2000, label: 'Gym', vendor: { ...vendor, name: 'Fitness First Thonglor' } });
  const gymVendored = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [gymLine] })).stops[0];
  assert.deepEqual([gymVendored.vendor, gymVendored.location], ['Fitness First Thonglor', 'Fitness First']);
  // Neither: — · —. A blank location is no location.
  const nowhere = routine({ id: 'n', name: 'Nowhere', steps: [step({ id: 'n1', step_order: 1, activity: 'Sit', location: '   ' })] });
  assert.deepEqual([dayStops(input({ entries: [entry(nowhere)] })).stops[0].vendor, dayStops(input({ entries: [entry(nowhere)] })).stops[0].location], [null, null]);
  const blank = dayStops(input({ entries: [entry(routine({ id: 'g', name: 'G', location: '' }), 'pending', GYM_AT)] })).stops[0];
  assert.deepEqual([blank.vendor, blank.location], [null, null]);
  // A vendor and no stated location: the location is null — the vendor never stands in for it (the old place's last resort), on a routine and on a line.
  const gymNowhere = dayStops(input({ entries: [entry(routine({ ...gym, location: null }), 'pending', GYM_AT)], lines: [gymLine] })).stops[0];
  assert.deepEqual([gymNowhere.vendor, gymNowhere.location], ['Fitness First Thonglor', null], 'a stepless routine with a vendor and no location');
  const sitLine = line({ address: { kind: 'routine_line', id: 'n1', instant: AT }, cents: 300, label: 'Nowhere', line: 'Sit', vendor });
  const sitVendored = dayStops(input({ entries: [entry(nowhere)], lines: [sitLine] })).stops[0];
  assert.deepEqual([sitVendored.planLineState, sitVendored.vendor, sitVendored.location], ['matched', 'Luka Sathorn', null], 'a line with a vendor, a blank step location and no routine location');
  // A task with no line states neither; a task whose matched project_task line carries a vendor states that vendor (never dropped) and still no location — a task has no step and no routine.
  const taskStop = dayStops(input({ items: [item({ id: 'i1', ad_hoc_title: 'Ship it' })] })).stops[0];
  assert.deepEqual([taskStop.kind, taskStop.vendor, taskStop.location], ['task', null, null]);
  const taskLine = line({ address: { kind: 'project_task', id: 't1', instant: null }, cents: 2000, label: 'Ship DAYCARD-01', source: 'task', vendor: { ...vendor, name: 'Kinkos Silom', grain: 'every' } });
  const vendoredTask = dayStops(input({ items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship DAYCARD-01') })], lines: [taskLine] })).stops[0];
  assert.deepEqual([vendoredTask.kind, vendoredTask.vendor, vendoredTask.location, vendoredTask.cents], ['task', 'Kinkos Silom', null, 2000]);
  assert.match(code(RULES), /kind: 'task',[\s\S]*?vendor: vendorOf\(line\),\n\s*location: null,/, 'the task stop reads its line’s vendor like every stop; its location is null');
  // The rules name no `place` any more — the two facts are the two fields.
  assert.doesNotMatch(code(RULES), /\bplaceOf\b|readonly place\b|\bplace: /, 'no one field for two facts');
});

test('T1 TABLE-01: intervalWords — the start and its end from the minutes, the start alone, nothing; an end past the day names its days', () => {
  assert.equal(intervalWords('07:00', 30), '07:00–07:30');
  assert.equal(intervalWords('07:00', 90), '07:00–08:30');
  assert.equal(intervalWords('07:00', 0), '07:00–07:00', 'a stated duration of 0 is a stated duration');
  assert.equal(intervalWords('00:00', 1439), '00:00–23:59', 'the last minute of the day is still the day');
  assert.equal(intervalWords('23:45', 30), '23:45–00:15 +1d', 'past midnight: the clock it lands on and the day it carried');
  assert.equal(intervalWords('07:00', 1440), '07:00–07:00 +1d', 'a day-long step is not a 0-minute one — the modulo never hides a day');
  assert.equal(intervalWords('07:00', 1500), '07:00–08:00 +1d');
  assert.equal(intervalWords('07:00', 2880), '07:00–07:00 +2d');
  assert.deepEqual([dayCarryWords(0), dayCarryWords(1), dayCarryWords(3)], ['', ' +1d', ' +3d']);
  assert.equal(intervalWords('07:00', null), '07:00', 'a start alone — no default duration');
  assert.equal(intervalWords(null, 30), null, 'no time, no interval — the minutes alone place nothing');
  assert.equal(intervalWords(null, null), null);
  assert.throws(() => intervalWords('07:00', -1), /a duration is a whole number of minutes/);
  assert.throws(() => intervalWords('07:00', 1.5), /a duration is a whole number of minutes/);
  for (const bad of ['7:00', '25:00', '07:60', '0700', '']) assert.throws(() => intervalWords(bad, 30), /a time is HH:MM/, `${JSON.stringify(bad)} is not a clock — never NaN`);
  // CLEAN-02 (2026-10-14): LOCATION is off the step card too — LOCATION_HEAD_WORD had no other reader and is deleted (the stop still carries its location, T1).
  assert.deepEqual([TIME_HEAD_WORD, VENDOR_HEAD_WORD, DESCRIPTION_HEAD_WORD, BUDGET_HEAD_WORD], ['TIME', 'VENDOR', 'DESCRIPTION', 'BUDGET']);
  assert.doesNotMatch(code(RULES), /LOCATION_HEAD_WORD/);
  assert.equal(openStepWords(6, 'Brunch'), 'Open step 6: Brunch', 'a row’s door is named for the step it opens, its visible words inside the name');
});

// ── T2 · MATCHING, EXACT ─────────────────────────────────────────────────────

test('T2 a line whose kind, id and instant match gives the stop its cents and its vendor; the instant one hour off is unmatched, both instants named, cents null', () => {
  const exact = line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee', time: '07:30', vendor: { id: 'v', name: 'Roots', entityId: 'P', grain: 'every' } });
  const r = dayStops(input({ entries: [entry(morning)], lines: [exact] }));
  const coffee = r.stops.find((s) => s.line === 'Coffee')!;
  assert.equal(coffee.cents, 500);
  assert.equal(coffee.vendor, 'Roots');
  assert.equal(coffee.location, 'Roots Thonglor', 'the step’s own location, beside the vendor — not displaced by it');
  assert.deepEqual(r.unmatched, []);
  assert.deepEqual(r.linesWithoutStop, []);

  const offByAnHour = { ...exact, address: { ...exact.address, instant: '2026-10-11T01:00:00.000Z' } };
  const u = dayStops(input({ entries: [entry(morning)], lines: [offByAnHour] }));
  assert.equal(u.stops.find((s) => s.line === 'Coffee')!.cents, null, 'nothing is matched by nearness');
  assert.deepEqual(u.unmatched, [{ label: 'Morning', line: 'Coffee', cents: 500, lineInstant: '2026-10-11T01:00:00.000Z', stopInstant: AT, reason: 'instant differs' }]);
  assert.deepEqual(u.linesWithoutStop, [], 'a line named as unmatched is named once');
  assert.equal(u.plannedCents, 500, 'the Budget’s figure for the day counts it still');
});

test('T2 two lines matching one stop → both unmatched, neither used; a stepless routine’s line by the routine’s id; a task line by its id with no instant', () => {
  const l1 = line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' });
  const twice = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [l1, { ...l1, cents: 1600 }] }));
  assert.equal(twice.stops[0].cents, null);
  assert.deepEqual(twice.unmatched.map((x) => [x.cents, x.reason]), [[1500, 'two plan lines for one stop'], [1600, 'two plan lines for one stop']]);
  assert.deepEqual(twice.linesWithoutStop, []);
  assert.equal(twice.plannedCents, 3100);

  const one = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [l1] }));
  assert.equal(one.stops[0].cents, 1500);

  const t = line({ address: { kind: 'project_task', id: 't1', instant: null }, cents: 2000, label: 'Ship DAYCARD-01', source: 'task' });
  const tasks = dayStops(input({ items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship DAYCARD-01') }), item({ id: 'i9', task_id: 't9', task: task('t9', 'Other') })], lines: [t] }));
  assert.deepEqual(tasks.stops.map((s) => [s.key, s.cents]), [['task:i1', 2000], ['task:i9', null]]);
  assert.deepEqual(tasks.unmatched, []);
});

test('T2 the kind decides too: a routine-kind line whose id is a STEP’s id, and a line-kind line whose id is a ROUTINE’s, match nothing; a $0 line is priced', () => {
  const wrongKind = line({ address: { kind: 'routine', id: 'coffee', instant: AT }, cents: 500, label: 'Morning' });
  const r = dayStops(input({ entries: [entry(morning)], lines: [wrongKind] }));
  assert.equal(r.stops.find((s) => s.line === 'Coffee')!.cents, null, 'a routine-kind line is not a step’s');
  assert.deepEqual(r.linesWithoutStop, [wrongKind]);
  const lineKind = line({ address: { kind: 'routine_line', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' });
  const g = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [lineKind] }));
  assert.equal(g.stops[0].cents, null, 'a line-kind line is not a stepless routine’s');
  assert.deepEqual(g.linesWithoutStop, [lineKind]);
  const free = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 0, label: 'Gym' })] }));
  assert.equal(free.stops[0].cents, 0, 'a planned $0 is a price');
  assert.equal(free.notPriced, 0, '— and the stop is priced');
});

test('T2 a routine priced as a whole (its lines carry no amount): the Budget’s routine-kind line at its occurrence is a routine figure, named as such, in the hero and on no stop', () => {
  const whole = line({ address: { kind: 'routine', id: 'morning', instant: AT }, cents: 6000, label: 'Morning', time: '07:00' });
  const r = dayStops(input({ entries: [entry(morning)], lines: [whole] }));
  assert.deepEqual(r.stops.map((s) => s.cents), [null, null, null], 'no one stop carries the routine’s figure');
  assert.equal(r.notPriced, 3);
  assert.equal(r.plannedCents, 6000, 'the hero is the Budget’s figure');
  assert.deepEqual(r.routineFigures, [whole]);
  assert.deepEqual(r.linesWithoutStop, [], 'named once, as the routine’s own figure');
  assert.deepEqual(r.unmatched, []);
  // At another instant it is not this occurrence's figure: a line with no stop.
  const moved = { ...whole, address: { ...whole.address, instant: '2026-10-11T01:00:00.000Z' } };
  const m = dayStops(input({ entries: [entry(morning)], lines: [moved] }));
  assert.deepEqual(m.routineFigures, []);
  assert.deepEqual(m.linesWithoutStop, [moved]);
  // A stepless routine's routine-kind line is its stop's, never a routine figure.
  const g = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' })] }));
  assert.deepEqual(g.routineFigures, []);
  assert.equal(g.stops[0].cents, 1500);
});

test('T2 a line on the day that no stop carries → linesWithoutStop; a line on another day is not the card’s', () => {
  const orphan = line({ address: { kind: 'routine_line', id: 'no-such-step', instant: AT }, cents: 700, label: 'Gone', line: 'Gone line' });
  const other = line({ address: { kind: 'routine_line', id: 'coffee', instant: '2026-10-12T00:00:00.000Z' }, cents: 500, label: 'Morning', line: 'Coffee', day: '2026-10-12' });
  const r = dayStops(input({ entries: [entry(morning)], lines: [orphan, other] }));
  assert.deepEqual(r.linesWithoutStop, [orphan]);
  assert.deepEqual(r.unmatched, [], 'the other day’s line is not this stop’s — neither matched nor unmatched');
  assert.equal(r.plannedCents, 700);
  assert.equal(r.notPriced, 3);
});

// ── T3 · TOTALS, FOCUS, WORDS ────────────────────────────────────────────────

test('T3 plannedCents is every line of the day, matched or not; notPriced counts the null-cents stops; notPlacedToday takes the day’s entries and the undated ones', () => {
  const lines = [
    line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee' }),
    line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' }),
    line({ address: { kind: 'routine_line', id: 'ghost', instant: AT }, cents: 300, label: 'Ghost', line: 'Boo' }),
  ];
  const notPlaced: NotPlaced[] = [
    { source: 'routine', sourceId: 'routine:night', entityId: 'P', label: 'Night', cents: null, day: null, reason: 'timezone not recognised', detail: '"Mars/Olympus"' },
    { source: 'routine', sourceId: `routine:dinner:routine:${AT}`, entityId: 'P', label: 'Dinner', cents: 1500, day: DAY, reason: 'no account', detail: null },
    { source: 'task', sourceId: 'task:t5', entityId: 'P', label: 'Elsewhere', cents: 100, day: '2026-10-12', reason: 'no account', detail: null },
  ];
  const r = dayStops(input({ entries: [entry(morning), entry(gym, 'pending', GYM_AT)], lines, notPlaced }));
  assert.equal(r.plannedCents, 2300);
  assert.equal(r.notPriced, 2, 'Stretch and Journal');
  assert.deepEqual(r.notPlacedToday.map((n) => n.label), ['Night', 'Dinner']);
  assert.deepEqual(r.linesWithoutStop.map((l) => l.label), ['Ghost']);
});

test('T3 focusStop: 1..N with soFarCents over the priced stops only; 0, N+1, a fraction and NaN return null — never clamped', () => {
  const lines = [
    line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee' }),
    line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' }),
  ];
  const r = dayStops(input({ entries: [entry(morning), entry(gym, 'pending', GYM_AT)], lines }));
  assert.equal(r.stops.length, 4);
  // spentSoFarCents null and withoutActualSoFar 0 while the records were not read (STOP-01).
  assert.deepEqual(focusStop(r, 1), { index: 1, of: 4, stop: r.stops[0], soFarCents: 0, spentSoFarCents: null, withoutActualSoFar: 0, withActualSoFar: 0 });
  assert.deepEqual(focusStop(r, 3), { index: 3, of: 4, stop: r.stops[2], soFarCents: 500, spentSoFarCents: null, withoutActualSoFar: 0, withActualSoFar: 0 });
  assert.deepEqual(focusStop(r, 4), { index: 4, of: 4, stop: r.stops[3], soFarCents: 2000, spentSoFarCents: null, withoutActualSoFar: 0, withActualSoFar: 0 });
  for (const n of [0, 5, 2.5, Number.NaN, -1]) assert.equal(focusStop(r, n), null, `step ${n}`);
  assert.equal(focusStop(dayStops(input()), 1), null, 'no stops, no step');
});

test('T3 the words, exact', () => {
  assert.equal(BRAND_WORDS, 'TEMPLE STUART');
  assert.equal(TODAY_WORD, 'today');
  assert.equal(TASK_WORD, 'task');
  assert.equal(UNTITLED_WORDS, 'untitled item');
  // 2026-10-11 is a Sunday (the prompt's example said "Sat" — the calendar says otherwise); the words come from the day's UTC parts.
  assert.equal(dayShortWords('2026-10-11'), 'Sun Oct 11');
  assert.equal(dayShortWords('2026-01-01'), 'Thu Jan 1');
  assert.equal(dayShortWords('2026-10-10'), 'Sat Oct 10');
  // CLEAN-02 (2026-10-14): stopsWords ("7 stops") is gone with TODAY's planned/stops line, its last reader (CLEAN-01 took it off the hook).
  assert.doesNotMatch(code(RULES), /\bstopsWords\b/);
  assert.equal(notPricedWords(3), '3 not priced');
  // PLAN-01 (2026-10-13): the step view's PLAN bar says "plan so far" — soFarWords became planSoFarWords; the figures are the same.
  assert.equal(planSoFarWords(1400, 5000), 'plan so far $14 of $50');
  assert.equal(planSoFarWords(1461, 5000), 'plan so far $14.61 of $50');
  assert.equal(planSoFarWords(null, null), 'plan so far — of —');
  // STOP-01: the records are a source too — each named NOT READ when it was not.
  assert.equal(provenanceWords('2026-10-11', true, true), 'Budget plan lines · stop records · as of 2026-10-11');
  assert.equal(provenanceWords('2026-10-11', false, true), 'Budget plan lines NOT READ · stop records · as of 2026-10-11');
  assert.equal(provenanceWords('2026-10-11', true, false), 'Budget plan lines · stop records NOT READ · as of 2026-10-11');
  assert.equal(provenanceWords('2026-10-11', false, false), 'Budget plan lines NOT READ · stop records NOT READ · as of 2026-10-11');
  assert.equal(badDateWords('yesterday'), '?date=yesterday is not a day (YYYY-MM-DD) — showing today');
  assert.equal(badStepWords('9', 7), "?step=9 is not one of this day's 7 stops — showing the whole card");
  assert.equal(unmatchedWords([{ label: 'Morning', line: 'Coffee', cents: 500, lineInstant: '2026-10-11T01:00:00.000Z', stopInstant: AT, reason: 'instant differs' }]),
    "1 plan line is at another instant than its stop — Morning — Coffee $5.00: planned at 2026-10-11T01:00:00.000Z, the day's one stop is at 2026-10-11T00:00:00.000Z (the today read names one occurrence per routine per day — this line has no stop)");
  assert.equal(unmatchedWords([
    { label: 'Gym', line: null, cents: 1500, lineInstant: GYM_AT, stopInstant: GYM_AT, reason: 'two plan lines for one stop' },
    { label: 'Gym', line: null, cents: 1600, lineInstant: GYM_AT, stopInstant: GYM_AT, reason: 'two plan lines for one stop' },
  ]), '2 plan lines for one stop — Gym $15.00: two plan lines for one stop — neither used · Gym $16.00: two plan lines for one stop — neither used');
  assert.equal(unmatchedWords([
    { label: 'Morning', line: 'Coffee', cents: 500, lineInstant: '2026-10-11T01:00:00.000Z', stopInstant: AT, reason: 'instant differs' },
    { label: 'Gym', line: null, cents: 1500, lineInstant: GYM_AT, stopInstant: GYM_AT, reason: 'two plan lines for one stop' },
  ]).split(' — ')[0], '2 plan lines not matched to a stop');
  assert.equal(linesWithoutStopWords([line({ address: { kind: 'routine_line', id: 'ghost', instant: AT }, cents: 300, label: 'Ghost', line: 'Boo', time: '09:00' })]),
    '1 plan line has no stop today — Ghost — Boo $3.00 at 09:00');
  assert.equal(linesWithoutStopWords([
    line({ address: { kind: 'routine', id: 'g', instant: AT }, cents: 300, label: 'Ghost' }),
    line({ address: { kind: 'project_task', id: 't', instant: null }, cents: 2000, label: 'Task' }),
  ]), '2 plan lines have no stop today — Ghost $3.00 · Task $20.00');
  assert.equal(linesUnreadWords([line({ address: { kind: 'routine', id: 'g', instant: AT }, cents: 300, label: 'Ghost' })]),
    '1 plan line today — its stop could not be read — Ghost $3.00');
  assert.equal(linesUnreadWords([
    line({ address: { kind: 'routine', id: 'g', instant: AT }, cents: 300, label: 'Ghost' }),
    line({ address: { kind: 'project_task', id: 't', instant: null }, cents: 2000, label: 'Task' }),
  ]), '2 plan lines today — their stops could not be read — Ghost $3.00 · Task $20.00');
  assert.equal(routineFigureWords([line({ address: { kind: 'routine', id: 'morning', instant: AT }, cents: 6000, label: 'Morning', time: '07:00' })]),
    "1 routine is priced as a whole — its lines carry no amount, so none of its stops is — Morning $60.00 at 07:00");
  assert.equal(routineFigureWords([
    line({ address: { kind: 'routine', id: 'morning', instant: AT }, cents: 6000, label: 'Morning' }),
    line({ address: { kind: 'routine', id: 'night', instant: AT }, cents: 1000, label: 'Night' }),
  ]), '2 routines are priced as a whole — their lines carry no amount, so none of their stops is — Morning $60.00 · Night $10.00');
  const v = { id: 'v', name: 'Luka', entityId: 'P' };
  assert.equal(strandedWords([{ vendor: v, label: 'Morning', line: 'Coffee', day: DAY, time: '07:30', address: { kind: 'routine_line', id: 'coffee', instant: AT }, reason: 'no occurrence' }]),
    '1 vendor stranded — Luka (Morning — Coffee, 2026-10-11): no occurrence');
  assert.equal(strandedWords([
    { vendor: v, label: 'Gym', line: null, day: null, time: null, address: { kind: 'routine', id: 'gym', instant: GYM_AT }, reason: 'zone unreadable' },
    { vendor: v, label: 'Gym', line: null, day: DAY, time: '20:00', address: { kind: 'routine', id: 'gym', instant: GYM_AT }, reason: 'no occurrence' },
  ]), '2 vendors stranded — Luka (Gym): zone unreadable · Luka (Gym, 2026-10-11): no occurrence');
  assert.equal(notPlacedWords([
    { source: 'routine', sourceId: 'routine:night', entityId: 'P', label: 'Night', cents: null, day: null, reason: 'timezone not recognised', detail: '"Mars/Olympus"' },
    { source: 'routine', sourceId: 'x', entityId: 'P', label: 'Dinner', cents: 1500, day: DAY, reason: 'no account', detail: null },
  ]), '2 plans not placed — Night: timezone not recognised ("Mars/Olympus"), undated · Dinner: no account');
  assert.equal(notPlacedWords([{ source: 'task', sourceId: 'task:t', entityId: 'P', label: 'T', cents: 100, day: DAY, reason: 'no account', detail: null }]), '1 plan not placed — T: no account');
});

test('T3 the reel plate’s words, exact (DAYCARD-01b): whole dollars, the day of the quarter, the hook line, the step header, the bar, the completeness line', () => {
  assert.equal(BADGE_WORDS, 'TS');
  // CLEAN-01 (2026-10-14) — Alex's ruling: the hook is "Under or Over?" exactly (was 'under or over?' after the stop count).
  assert.equal(HOOK_WORDS, 'Under or Over?');
  assert.equal(PLAN_WORD, 'PLAN');
  // planDollars: lossless — a trailing ".00" removed, cents kept, null '—', a negative kept.
  assert.equal(planDollars(7500), '$75');
  assert.equal(planDollars(507), '$5.07');
  assert.equal(planDollars(0), '$0');
  assert.equal(planDollars(123456), '$1,234.56');
  assert.equal(planDollars(-1200), '−$12');
  assert.equal(planDollars(550), '$5.50', 'only ".00" goes — never ".50"');
  assert.equal(planDollars(1000000), '$10,000');
  assert.equal(planDollars(null), '—');
  assert.equal(dayShortWords('2026-10-13'), 'Tue Oct 13');
  // STAY-01: the header counts the stay covering the day — never the calendar quarter; no stay says so.
  const chiangMai = { id: 's1', place: 'Chiang Mai', starts_on: '2026-10-20', ends_on: '2026-11-02' };
  const read = (stay: typeof chiangMai | null) => ({ kind: 'read' as const, stay });
  assert.equal(headerWords(read(chiangMai), '2026-10-22'), 'DAY 3 OF 14');
  assert.equal(headerWords(read(chiangMai), '2026-10-20'), 'DAY 1 OF 14');
  assert.equal(headerWords(read(chiangMai), '2026-11-02'), 'DAY 14 OF 14');
  assert.equal(headerWords(read(null), '2026-10-13'), 'NO STAY', 'read, and none covers the day');
  assert.equal(headerWords({ kind: 'unread' }, '2026-10-13'), '', 'in flight: nothing, never a false NO STAY');
  assert.equal(headerWords({ kind: 'failed' }, '2026-10-13'), 'STAY NOT READ');
  assert.throws(() => headerWords(read(chiangMai), '2026-11-03'), /does not cover 2026-11-03/, 'a stay that does not cover the day is the route’s error, never counted');
  assert.equal(whereWords('2026-10-22', read(chiangMai)), 'Thu Oct 22 · Chiang Mai');
  assert.equal(whereWords('2026-10-13', read(null)), 'Tue Oct 13');
  assert.equal(whereWords('2026-10-13', { kind: 'unread' }), 'Tue Oct 13');
  assert.equal(whereWords('2026-10-13', { kind: 'failed' }), 'Tue Oct 13');
  // CLEAN-01 (2026-10-14): hookWords and its stop count are gone — the hook is HOOK_WORDS alone (pinned above); a day that
  // could not be read is named above the card and counted "stops not read" in the fine print under it (completenessWords).
  assert.equal(STOPS_NOT_READ_WORDS, 'stops not read');
  assert.equal(PLANNED_WORD, 'planned');
  assert.equal(heroWord('2026-10-13', '2026-10-13'), 'today');
  assert.equal(heroWord('2026-10-20', '2026-10-13'), 'planned', 'another day is not "today"');
  assert.equal(stepHeaderWords(4, 7, '12:30'), '4 OF 7 · 12:30');
  assert.equal(stepHeaderWords(7, 7, null), '7 OF 7 · —');
  // The bar: whole percent of the plan, 0..100; null when the plan is unknown or nothing is planned.
  assert.equal(progressPercent(1461, 5000), 29);
  assert.equal(progressPercent(1475, 5000), 30, 'rounded, not floored');
  assert.equal(progressPercent(0, 5000), 0);
  assert.equal(progressPercent(5000, 5000), 100);
  assert.equal(progressPercent(6000, 5000), 100, 'never past the end');
  assert.equal(progressPercent(500, 0), null, 'nothing planned — no bar');
  assert.equal(progressPercent(null, 5000), null);
  assert.equal(progressPercent(500, null), null);
  // The completeness line counts; the sentences name.
  const READ = { day: true, report: true, records: true };
  const empty = dayStops(input({ records: [] }));
  assert.equal(completenessWords(empty, 0, READ), null);
  // What was not read is unknown, not zero: said as such, never counted.
  assert.equal(completenessWords(empty, 0, { ...READ, day: false }), 'stops not read');
  assert.equal(completenessWords(dayStops(input({ entries: [entry(morning)], records: [] })), 0, { ...READ, report: false }), 'amounts not read · 3 not recorded', 'three unpriced stops are not "3 not priced" while the amounts were not read');
  const unread = dayStops(input({ lines: [line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee' })], records: [] }));
  assert.equal(completenessWords(unread, 0, { ...READ, day: false }), 'stops not read · 1 line, its stop not read');
  assert.equal(completenessWords(empty, 0, { day: false, report: false, records: false }), 'stops not read · amounts not read · records not read');
  assert.equal(completenessWords(dayStops(input({ entries: [entry(morning)] })), 0, { ...READ, records: false }), 'records not read · 3 not priced', 'three unrecorded stops are not "3 not recorded" while the records were not read (STOP-01) — their prices were read, so "3 not priced" stands');
  const r = dayStops(input({
    entries: [entry(morning)],
    lines: [
      line({ address: { kind: 'routine_line', id: 'coffee', instant: '2026-10-11T01:00:00.000Z' }, cents: 500, label: 'Morning', line: 'Coffee' }),
      line({ address: { kind: 'routine_line', id: 'ghost', instant: AT }, cents: 300, label: 'Ghost', line: 'Boo' }),
    ],
    notPlaced: [{ source: 'routine', sourceId: 'routine:night', entityId: 'P', label: 'Night', cents: null, day: null, reason: 'timezone not recognised', detail: null }],
  }));
  assert.equal(completenessWords(r, 2, { ...READ, records: false }), 'records not read · 3 not priced · 1 line at another instant · 1 line with no stop · 1 plan not placed · 2 vendors stranded');
  const whole = dayStops(input({ entries: [entry(morning)], lines: [line({ address: { kind: 'routine', id: 'morning', instant: AT }, cents: 6000, label: 'Morning' })] }));
  assert.equal(completenessWords(whole, 0, { ...READ, records: false }), 'records not read · 3 not priced · 1 routine priced as a whole');
  const priced = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' })], records: [] }));
  assert.equal(completenessWords(priced, 0, READ), '1 not recorded');
  const l1 = line({ address: { kind: 'routine', id: 'gym', instant: GYM_AT }, cents: 1500, label: 'Gym' });
  const doubled = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], lines: [l1, { ...l1, cents: 1600 }], records: [] }));
  assert.equal(completenessWords(doubled, 0, READ), '1 not priced · 1 not recorded · 2 plan lines for one stop', 'two lines at the stop’s own instant are not "at another instant"');
});

// ── T4 · THE READS ───────────────────────────────────────────────────────────

test('T4 readJson is the week’s, exported; readDayReport asks the one URL and reads the answer as the week does; a failure is in the card’s words', async () => {
  assert.equal(typeof readJson, 'function');
  assert.match(code(WEEK_READS), /\nexport async function readJson\(url: string\)/);
  const sent: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  let answer: () => Response = () => new Response(JSON.stringify({ asOf: '2026-10-11', plans: { listed: true, days: ['2026-10-11'], lines: [], stranded: [] }, notPlaced: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string, init: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  try {
    const ok = await readDayReport('2026-10-11', '2026-10-11');
    assert.ok(ok.ok && ok.value.plans.listed && ok.value.plans.days[0] === '2026-10-11');
    answer = () => new Response(JSON.stringify({ error: 'bad-day', message: 'day "x" is not a day' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const bad = await readDayReport('x', '2026-10-11');
    assert.deepEqual(bad, { ok: false, words: "The day's amounts and places could not be read — bad-day: day \"x\" is not a day" });
    answer = () => new Response('', { status: 401 });
    const out = await readDayReport('2026-10-11', '2026-10-11');
    assert.deepEqual(out, { ok: false, words: "The day's amounts and places could not be read — You are signed out — sign in to see this week." });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => s.url), ['/api/budget/report?view=day&day=2026-10-11&asOf=2026-10-11', '/api/budget/report?view=day&day=x&asOf=2026-10-11', '/api/budget/report?view=day&day=2026-10-11&asOf=2026-10-11']);
  assert.deepEqual(sent[0].init, { cache: 'no-store', redirect: 'manual' });
  assert.equal(dayReportFailedWords('x'), "The day's amounts and places could not be read — x");
  // The day folder's reads: the week's two, by name, and its own one — DayCard.tsx fetches nothing.
  const reads = code(READS);
  assert.match(reads, /import \{ readJson, type Read \} from '\.\.\/week\/weekReads';/);
  assert.equal((reads.match(/\bfetch\s*\(/g) ?? []).length, 0, 'the read goes through readJson');
  assert.match(code(CARD), /import \{ readDay, readItems, type DayAnswer, type Read \} from '\.\.\/week\/weekReads';/);
  // JOURNAL-01 (2026-10-13): the journal read joins the line — the pin moved with it.
  assert.match(code(CARD), /import \{ readDayReport, readJournal, readStays, readStopRecords, type JournalAnswer, type StaysAnswer, type StopRecordsAnswer \} from '\.\/dayReads';/);
  assert.match(reads, /await readJson\(`\/api\/operations\/stops\?\$\{new URLSearchParams\(\{ day \}\)\.toString\(\)\}`\)/, 'the records read, through the one reader (STOP-01)');
  assert.match(reads, /await readJson\(`\/api\/operations\/stays\?\$\{new URLSearchParams\(\{ day \}\)\.toString\(\)\}`\)/, 'the stays read, through the one reader (STAY-01)');
  for (const f of [CARD, RULES]) assert.doesNotMatch(code(f), /\bfetch\s*\(/, `${f} fetches nothing of its own`);
  // The week's reader still makes its one fetch and lists its four URLs (week01 pins them); exporting readJson added nothing.
  assert.equal((code(WEEK_READS).match(/\bfetch\s*\(/g) ?? []).length, 1);
});

// ── T5 · THE LINES LAW STANDS; THE CARD WRITES NOTHING; NO DARK PAINT ────────

test('T5 the day folder prices nothing, writes nothing and paints no dark surface', () => {
  const files = readdirSync(resolve(process.cwd(), DAY_DIR)).map((f) => `${DAY_DIR}/${f}`);
  assert.deepEqual(files.sort(), [CARD, RULES, READS].sort(), 'the folder is the three files');
  for (const f of files) {
    const body = code(f);
    assert.doesNotMatch(body, /budget_amount|coa_code|routinePlanned/, `${f} reads no routine figure — the report's lines are the only amounts`);
    assert.doesNotMatch(body, /plan-vendors|vendor-directory|VendorBox|completeRoutine|editCompletionNote|completions|stopWrites/, `${f} writes nothing of its own — no vendor box, no mark-done, no note; the stop form (stops/StopForm.tsx) is the one writer's caller`);
    assert.doesNotMatch(body, /method:\s*'(POST|PATCH|PUT|DELETE)'/, `${f} sends no write`);
    assert.doesNotMatch(body, /localStorage|sessionStorage|document\.cookie/, `${f} stores nothing`);
    // Alex, 2026-10-14: the full card's meter — green under, red over. bg-brand-red is admitted as that ONE bar's fill (no ink on
    // it), named in the fills list below; every other dark surface stays forbidden here.
    assert.doesNotMatch(body, /\b(bg-black|bg-brand-purple|bg-panel)\b(?!\/)/, `${f} paints no dark surface (the repaint law)`);
    // DAYCARD-01b: the reel plate's solid fills, and only those — the gold TS badge (dark ink on it) and the progress bar (no ink on it).
    // PLAN-01 (2026-10-13) — Alex's ruling: two bars on the step view, the PLAN bar gold and the SPENT (actual) bar green. The list
    // moved from [badge gold, bar green] to [badge gold, plan bar gold, spent bar green]; nothing else is a fill.
    // CLEAN-01 — Alex, 2026-10-14: the full card's meter — green under, red over. The list moved to [badge gold, meter red | meter
    // green, plan bar gold, spent bar green], and red is matched now so a second red fill fails here.
    assert.deepEqual([...body.matchAll(/\b(bg-brand-gold|bg-brand-green|bg-brand-red)\b/g)].map((m) => m[1]), f === CARD ? ['bg-brand-gold', 'bg-brand-red', 'bg-brand-green', 'bg-brand-gold', 'bg-brand-green'] : [], `${f}: the badge, the meter and the two bars are the only solid fills`);
    assert.doesNotMatch(body, /consecutive_(completion|miss)_streak/, `${f} reads no streak (the two-lists law)`);
  }
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date\(\)|Date\.now\(|from 'react'|@prisma\/client/, 'the rules are pure: no fetch, no clock, no React, no Prisma');
  assert.doesNotMatch(code(RULES), /\.get(Day|Month|Date|FullYear|Hours|Minutes)\(|new Date\(\s*\w+\s*,/, 'every day is read by its UTC parts — never the process’s zone (no local getters, no new Date(y, m, d))');
});

// ── T6 · THE SCREEN, THE PAGE AND THE DOORS ──────────────────────────────────

test('T6 the plate, the hero, the rows, the focus, the URL — pinned in the screen', () => {
  const c = code(CARD);
  assert.match(c, /^'use client';/m);
  // THE PLATE (DAYCARD-01b): the reel's card at two thirds — 540 wide, white, the app's hairline, rounded, centered; its height is its content's.
  // PLAN-01 (2026-10-13): the plate's width is dayCard.ts PLATE_WIDTH (640, Alex's ruling) and its side padding PLATE_PADDING_X — one constant each, no number typed here.
  assert.match(c, /className="bg-ts-white border border-border flex flex-col mx-auto" style=\{\{ width: PLATE_WIDTH, borderRadius: 23, padding: `25px \$\{PLATE_PADDING_X\}px 24px`, gap: 11 \}\} data-day-card/, 'the plate: card cream, the app’s hairline, no shadow (the demo has none)');
  assert.match(code(RULES), /export const PLATE_WIDTH = 640;\n/);
  assert.match(code(RULES), /export const PLATE_INNER_WIDTH = PLATE_WIDTH - 2 \* PLATE_PADDING_X - 2 \* PLATE_BORDER;/);
  assert.deepEqual([PLATE_WIDTH, PLATE_PADDING_X, PLATE_BORDER, PLATE_INNER_WIDTH], [640, 29, 1, 580]);
  assert.doesNotMatch(c, /\b540\b/, 'no width typed in the screen — every one is the constant');
  assert.doesNotMatch(c, /height: 960/, 'no fixed 9:16 box — the plate grows with its stops');
  // PLAN-01 (2026-10-13): two bars, each its own track — two clipped tracks, nothing else.
  // CLEAN-01 (2026-10-14): the full card's meter is a third track — three clipped tracks, nothing else.
  assert.equal((c.match(/overflow-hidden/g) ?? []).length, 3, 'nothing clipped but the meter’s and the two bars’ own tracks');
  // The header: the badge, the wordmark, DAY n OF m on the full card, "n OF N · time" on the step card.
  assert.match(c, /className="bg-brand-gold text-text-primary rounded-lg flex items-center justify-center font-extrabold" style=\{\{ width: 32, height: 32, fontSize: 16 \}\} aria-hidden="true">\{BADGE_WORDS\}/, 'the gold TS badge, dark ink');
  assert.match(c, /\{BRAND_WORDS\}<\/span>/);
  assert.match(c, /<PlateHeader right=\{focus === null \? headerWords\(stayState, day\) : stepHeaderWords\(focus\.index, focus\.of, focus\.stop\.time\)\} \/>/, 'the header counts the stay (STAY-01)');
  // The stays are kept WITH the day they were read for: a day change never pairs the old answer with the new day (that pairing threw).
  assert.match(c, /useState<\{ readonly day: string; readonly read: Read<StaysAnswer> \} \| null>\(null\)/);
  assert.match(c, /if \(live\) setStays\(\{ day, read: s \}\);/, 'the read lands with its day, under the live guard');
  assert.match(c, /const staysRead = stays !== null && stays\.day === day \? stays\.read : null;/, 'another day’s answer is unread here');
  assert.match(c, /const stayState: StayState = staysRead === null \? \{ kind: 'unread' \} : !staysRead\.ok \? \{ kind: 'failed' \} : \{ kind: 'read', stay: staysRead\.value\.covering \};/, 'unread, failed and read are three states — never one null');
  assert.match(c, /data-day-where>\{whereWords\(day, stayState\)\}/, 'the day and the place');
  assert.match(c, /<StayBar day=\{day\} stays=\{staysRead\} onChanged=\{\(\) => setStayReads\(\(n\) => n \+ 1\)\} \/>/, 'the stay bar, outside the plate, re-reading after a write');
  assert.doesNotMatch(c, /setStays\(null\)/, 'a re-read never blanks the plate first');
  assert.ok(c.indexOf('<StayBar') < c.indexOf('data-day-card'), 'the stay bar sits above the plate');
  assert.match(c, /data-day-words>\{right\}/, 'the header words are the rules’ — never the browser’s zone');
  // The hero: the Budget's figure in whole dollars; '—' while the report cannot be read — never a sum of the stops.
  assert.match(c, /data-day-planned>\{planDollars\(plannedCents\)\}/);
  assert.match(c, /const plannedCents = report !== null && report\.ok \? result\.plannedCents : null;/);
  // CLEAN-01 (2026-10-14): the hook is HOOK_WORDS alone — no stop count (was hookWords(dayFailed ? null : N)).
  assert.match(c, /data-day-hook>\{HOOK_WORDS\}<\/div>/, 'the hook line under the hero — the words alone');
  assert.match(c, /data-day-hero-word>\{heroWord\(day, today\)\}/, '"today" only on today; "planned" on another day');
  // TABLE-01 (2026-10-13): the rows are a table — the flex row's size pins (the 22/87 widths, the 31/23 px texts) are replaced by the table's column widths and the cells' sizes below.
  assert.match(c, /\{N > 0 && \(\n\s*<div className="flex flex-col">\n\s*<table className="w-full" style=\{\{ tableLayout: 'fixed', borderCollapse: 'collapse' \}\} data-day-stops>/, 'a real table, fixed widths, no horizontal scroll — and no lone header on a day with no stops');
  assert.match(c, /<\/table>\n\s*<div className="border-t border-border" aria-hidden="true" \/>\n\s*<\/div>\n\s*\)\}/, 'the closing rule sits flush under the last row, in the table’s gap-less column — not a plate item 11 px below it');
  assert.doesNotMatch(c, /\{N > 0 && <div className="border-t border-border"/, 'no closing rule loose on the plate');
  // PLAN-01 (2026-10-13) — Alex's ruling: LOCATION is off the full card's table (the step view's LOCATION line stays): four columns, re-balanced for 640.
  // CLEAN-01 (2026-10-14) — Alex's ruling: five columns, ACTUAL after BUDGET; every width is dayCard.ts COLUMN_WIDTHS (derived from the
  // plate's inner width — its sum is pinned in T7), none typed here. The PLAN-01 pins on the four widths (110/140/auto/98) moved with it.
  assert.match(c, /<colgroup>\n\s*<col style=\{\{ width: COLUMN_WIDTHS\.time \}\} \/>\n\s*<col style=\{\{ width: COLUMN_WIDTHS\.vendor \}\} \/>\n\s*<col style=\{\{ width: COLUMN_WIDTHS\.description \}\} \/>\n\s*<col style=\{\{ width: COLUMN_WIDTHS\.budget \}\} \/>\n\s*<col style=\{\{ width: COLUMN_WIDTHS\.actual \}\} \/>\n\s*<\/colgroup>/, 'five columns, each its width from the rules');
  assert.doesNotMatch(c, /const COLUMN_WIDTHS/, 'the widths live with the plate’s constants (dayCard.ts), not in the screen');
  assert.equal(PLATE_INNER_WIDTH, 580, 'the plate’s inner width: 640 − 2 × 29 padding − 2 × 1 border');
  assert.match(c, /const MARK_SLOT = 17;/, 'the mark’s slot: ✓ is 13.3 px at 15 px');
  inOrderOf(c, ['<thead>', '{TIME_HEAD_WORD}</th>', '{VENDOR_HEAD_WORD}</th>', '{DESCRIPTION_HEAD_WORD}</th>', '{BUDGET_HEAD_WORD}</th>', '{ACTUAL_HEAD_WORD}</th>', '</thead>'], 'the header row, in the table’s order');
  assert.doesNotMatch(c, /\{LOCATION_HEAD_WORD\}<\/th>|data-day-col="location"|COLUMN_WIDTHS\.location/, 'no LOCATION column on the full card');
  const row = /<tr\n\s*key=\{s\.key\}([\s\S]*?)<\/tr>/.exec(c);
  assert.ok(row !== null, 'a row per stop');
  const cols = [...row![1].matchAll(/data-day-col="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(cols, ['time', 'vendor', 'description', 'budget', 'actual'], 'CLEAN-01: the five cells, once each, in the header’s order');
  assert.match(row![1], /<span className="inline-block font-extrabold" style=\{\{ width: MARK_SLOT, fontSize: 15, lineHeight: 1 \}\}><Mark status=\{s\.status\} \/><\/span>/, 'the ✓/✕/– mark in its own slot on every row — an open row’s slot is empty, so every clock starts at one x');
  assert.match(row![1], /style=\{\{ fontSize: 13, lineHeight: 1\.2 \}\} data-day-interval>\{factOf\(intervalWords\(s\.time, s\.minutes\)\)\}/, 'the interval — the start and its end, or the start, or — at 13 px mono');
  assert.doesNotMatch(row![1], /marginLeft/, 'no offset that depends on the status — the slot holds the mark');
  assert.match(row![1], /data-day-col="vendor">\{factOf\(s\.vendor\)\}/, 'the vendor, or —');
  assert.match(row![1], /<button type="button" className="block w-full text-left font-bold text-text-primary break-words" style=\{\{ fontSize: 19, lineHeight: 1\.1 \}\} aria-label=\{openStepWords\(i \+ 1, boldOf\(s\)\)\} data-day-bold>\{boldOf\(s\)\}<\/button>/, 'the description — the line or the name, the same words function — is the row’s door: a real button, named for the step it opens; Enter and Space are the browser’s own');
  assert.equal((row![1].match(/<button\b/g) ?? []).length, 1, 'one door per row');
  assert.doesNotMatch(row![1], /<button[^>]*onClick/, 'the button has no handler of its own — its click reaches the row’s one onClick, so a step opens once');
  assert.match(row![1], /\{smallOf\(s\) !== null && <span className="block font-medium text-text-muted break-words" style=\{\{ fontSize: 14, lineHeight: 1\.15 \}\} data-day-small>\{smallOf\(s\)\}<\/span>\}/, 'the routine under its line');
  assert.match(c, /const factOf = \(fact: string \| null\): string => \(fact === null \? '—' : fact\);/);
  assert.match(c, /function smallOf\(s: Stop\): string \| null \{\n\s*if \(s\.kind === 'task'\) return TASK_WORD;\n\s*if \(s\.kind === 'routine'\) return null;\n\s*return s\.label;\n\}/, 'the small text names no place — the vendor and the location have their columns');
  assert.doesNotMatch(c, /\.place\b|placeOf/, 'no place in the screen');
  const cellClasses = [...row![1].matchAll(/<td className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map((m) => m[1] ?? m[2]);
  assert.equal(cellClasses.length, 5, 'CLEAN-01: five cells in the row');
  assert.deepEqual(cellClasses.map((k) => /\bbreak-words\b/.test(k)), [true, true, true, false, false], 'the three text cells wrap; the two money cells do not');
  const budgetCell = /data-day-col="budget">([\s\S]*?)<\/td>/.exec(row![1]);
  assert.ok(budgetCell !== null);
  assert.doesNotMatch(budgetCell![1], /break-words|break-all/, 'a figure is never split mid-digit ("$12.5" over "0")');
  const actualCell = /data-day-col="actual">([\s\S]*?)<\/td>/.exec(row![1]);
  assert.ok(actualCell !== null);
  assert.doesNotMatch(actualCell![1], /break-words|break-all/, 'the actual’s figures are never split mid-digit; its words still wrap at their spaces');
  assert.doesNotMatch(c, /overflow-x|whitespace-nowrap/, 'no horizontal scroll, nothing kept on one line');
  // The step view shows the vendor as a labeled line. CLEAN-02 (2026-10-14) — Alex's ruling: LOCATION is off the stop card (the
  // TABLE-01 pin on its line moved to the absence below), and the journal card shows no vendor — the line is the stop card's alone.
  assert.match(c, /\{focus\.stop\.role !== 'journal' && \(\n\s*<div className="flex items-baseline gap-2" data-day-vendor>\n\s*<span className="font-bold text-text-faint" style=\{\{ fontSize: 13, letterSpacing: '0\.14em' \}\}>\{VENDOR_HEAD_WORD\}<\/span>\n\s*<span className=\{`font-medium break-words min-w-0 \$\{focus\.stop\.vendor === null \? 'text-text-faint' : 'text-text-primary'\}`\} style=\{\{ fontSize: 21, lineHeight: 1\.1 \}\}>\{factOf\(focus\.stop\.vendor\)\}<\/span>/, 'VENDOR on the stop card');
  assert.doesNotMatch(c, /data-day-location|LOCATION_HEAD_WORD|\.location\b/, 'no LOCATION on any card');
  assert.ok(c.indexOf('data-day-focus>') < c.indexOf('data-day-vendor>') && c.indexOf('data-day-vendor>') < c.indexOf('{PLAN_WORD}'), 'in the step card’s header area, before the record');
  assert.match(c, /style=\{\{ fontSize: 69, lineHeight: 1, letterSpacing: '-0\.02em' \}\} data-day-planned/, 'the hero at 69 px');
  assert.match(c, /style=\{\{ fontSize: 27, lineHeight: 1\.15 \}\} data-day-hook/, 'the hook at 27 px');
  assert.doesNotMatch(c, /truncate/, 'nothing is cut on the recorded plate');
  // The rows: every amount through planDollars — '—' for null, never $0.00 for a blank; a row's door is its description's button, and a click anywhere on the row pushes ?step=.
  assert.match(c, /data-day-amount>\{planDollars\(s\.cents\)\}/);
  // TABLE-01: the actual under the plan sat in the BUDGET cell (block, 13 px). CLEAN-01 (2026-10-14): it is the ACTUAL column's own cell —
  // the BUDGET cell carries the budget only; the pins on both cells are in T7.
  assert.match(c, /data-day-amount>\{planDollars\(focus\.stop\.cents\)\}/);
  // TABLE-01: a click anywhere on the <tr> pushes ?step=; the row is not a tab stop of its own — its button is (a focusable row is announced as a nameless row).
  assert.match(c, /<tr\n\s*key=\{s\.key\}\n\s*className="border-t border-border hover:bg-bg-row focus-within:bg-bg-row cursor-pointer align-top"\n\s*data-day-stop=\{s\.key\}\n\s*data-day-status=\{s\.status\}\n\s*onClick=\{\(\) => go\(hrefFor\(day, i \+ 1\)\)\}\n\s*>/, 'a row pushes ?step= on a click, and its button’s focus paints what hover paints');
  assert.doesNotMatch(row![1], /tabIndex|onKeyDown/, 'the keyboard reaches the row through its button — no hand-made key handling');
  // The completeness line counts, the provenance names the source; the sentences sit under the plate.
  // CLEAN-01 (2026-10-14): on the full card both lines moved from the plate's foot to the fine print directly under it (pinned in T7);
  // the step card kept its own source line on its plate. CLEAN-02 (2026-10-14): the stop card's moved to the same fine print — one
  // source line in the screen, under the plate, for both views (the journal card has none).
  assert.match(c, /const reportRead = report !== null && report\.ok;\n\s*const recordsOk = recordsRead !== null && recordsRead\.ok;\n\s*const completeness = completenessWords\(result, stranded\.length, \{ day: !dayFailed, report: reportRead, records: recordsOk \}\);/, 'the count knows what was not read');
  assert.match(c, /data-day-count>\{completeness\}/);
  assert.equal((c.match(/data-day-provenance>\{provenanceWords\(today, reportRead, recordsOk\)\}/g) ?? []).length, 1, 'one source line, in the fine print under the full card and the stop card — the records a source too (STOP-01)');
  assert.ok(c.indexOf('data-day-fine-print') < c.indexOf('data-day-foot'), 'the fine print first under the plate; the sentences after it');
  assert.match(c, /\{foot && \(\n\s*<div className="mx-auto space-y-1 text-xs" style=\{\{ width: PLATE_WIDTH \}\} data-day-foot>/, 'the sentences under the plate render whenever there is one');
  assert.match(c, /const foot = loaded && \(result\.unmatched\.length > 0 \|\| result\.routineFigures\.length > 0 \|\| result\.linesWithoutStop\.length > 0 \|\| result\.notPlacedToday\.length > 0 \|\| stranded\.length > 0 \|\| refused\.length > 0 \|\| \(report !== null && !report\.ok\) \|\| \(plans !== null && !plans\.listed\) \|\| result\.recordsWithoutStop\.length > 0 \|\| unplacedRecords\.length > 0 \|\| \(recordsRead !== null && !recordsRead\.ok\)\);/);
  assert.match(c, /data-day-lines-without-stop>\{dayFailed \? linesUnreadWords\(result\.linesWithoutStop\) : linesWithoutStopWords\(result\.linesWithoutStop\)\}/);
  assert.match(c, /data-day-routine-figures>\{routineFigureWords\(result\.routineFigures\)\}/);
  assert.match(c, /data-day-stranded>\{strandedWords\(stranded\)\}/);
  assert.match(c, /<RefusedRoutines refused=\{refused\} \/>/);
  // The step card: PLAN and its amount, "so far" and the bar — both null-safe while the report cannot be read.
  assert.match(c, /\{PLAN_WORD\}<\/div>/);
  // PLAN-01 (2026-10-13) — two bars, each with its own words: PLAN (gold) the planned money so far, SPENT (green) the actuals so far, both of the day's planned total.
  assert.match(c, /data-day-plan-so-far>\{planSoFarWords\(plannedCents === null \? null : focus\.soFarCents, plannedCents\)\}/);
  assert.match(c, /const planBar = progressPercent\(plannedCents === null \|\| focus === null \? null : focus\.soFarCents, plannedCents\);/, 'the plan bar is the rules’ percent, once');
  assert.match(c, /const spentBar = focus === null \|\| focus\.spentSoFarCents === null \|\| focus\.withActualSoFar === 0 \? null : progressPercent\(focus\.spentSoFarCents, plannedCents\);/, 'no spent bar while the records are unread or nothing so far carries an actual — unknown, not zero');
  assert.match(c, /\{planBar !== null && \(/, 'no bar without a known plan');
  assert.match(c, /\{planBar !== null && spentBar !== null && \(/, 'the spent bar only beside a plan bar — its denominator is the plan');
  assert.match(c, /className="bg-brand-gold rounded-full" style=\{\{ height: 9, width: `\$\{planBar\}%` \}\}/, 'the PLAN bar gold');
  assert.match(c, /className="bg-brand-green rounded-full" style=\{\{ height: 9, width: `\$\{spentBar\}%` \}\}/, 'the SPENT bar green');
  // CLEAN-01 (2026-10-14): data-day-plate-foot left the screen with the plate's foot; the fine print, the meter and the verdict joined.
  // CLEAN-02 (2026-10-14): data-day-status> (the stop card's status line) left; the download button and its failure words joined.
  for (const attr of ['data-day-card', 'data-day-header', 'data-day-hero', 'data-day-hook', 'data-day-stop=', 'data-day-status=', 'data-day-focus', 'data-day-fine-print', 'data-day-meter=', 'data-day-verdict', 'data-day-count', 'data-day-provenance', 'data-day-foot', 'data-day-unmatched', 'data-day-routine-figures', 'data-day-lines-without-stop', 'data-day-not-placed', 'data-day-stranded', 'data-day-report-failed', 'data-day-bad-date', 'data-day-bad-step', 'data-day-failed', 'data-day-so-far', 'data-day-controls', 'data-day-spent', 'data-day-record', 'data-day-download-image', 'data-day-image-failed', 'data-day-actual', 'data-day-delta', 'data-day-rating', 'data-day-note', 'data-day-minutes', 'data-day-spent-so-far', 'data-day-records-without-stop', 'data-day-records-unplaced', 'data-day-records-failed']) {
    assert.ok(c.includes(attr), `the screen carries ${attr}`);
  }
  // The URL: ?date= and ?step= read with useSearchParams, pushed with router.push; the step judged once the reads are in, never clamped.
  assert.match(c, /import \{ useRouter, useSearchParams \} from 'next\/navigation';/);
  assert.match(c, /const search = useSearchParams\(\);/);
  assert.match(c, /const dateParam = search\.get\('date'\);\n\s*const stepParam = search\.get\('step'\);/);
  assert.match(c, /const day = today === null \? null : dateParam !== null && isIsoDay\(dateParam\) \? dateParam : today;/, 'the day is ?date= when it is a day, else today');
  assert.match(c, /const badDate = dateParam !== null && !isIsoDay\(dateParam\) \? dateParam : null;/, 'a ?date= that is not a day is named');
  assert.match(c, /const focus = loaded && n !== null \? focusStop\(result, n\) : null;/);
  assert.match(c, /const badStep = loaded && n !== null && focus === null \? stepParam : null;/);
  assert.match(c, /const go = \(href: string\) => router\.push\(href\);/);
  // TASKS-ONE-01 (2026-10-14): the card is the first section of /tasks — every URL it pushes is DAY_CARD_PATH's
  // (dayCard.ts, '/tasks'), same parameters, same rules; the pin moved from the '/tasks/day' literal.
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.match(c, /\bDAY_CARD_PATH,\n[\s\S]*?\} from '\.\/dayCard';/);
  assert.doesNotMatch(c, /\/tasks\/day/, 'the card names no /tasks/day URL');
  assert.match(c, /import \{ localToday \} from '@\/lib\/localToday';/);
  assert.match(c, /setToday\(localToday\(\)\);\n\s*setZone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\);/);
  assert.match(c, /import \{ isIsoDay \} from '@\/lib\/budget\/days';/);
  assert.match(c, /import \{ shiftDay \} from '@\/lib\/budget\/reportView';/);
  assert.match(c, /await Promise\.all\(\[readDay\(day\), readDayReport\(day, today\), readItems\(day, day\)\]\)/, 'the three reads, in parallel, asOf today');
  // The controls push the URLs the rules name, and sit outside the plate.
  assert.match(c, /aria-label="Back one day" onClick=\{\(\) => go\(hrefFor\(shiftDay\(day, -1\), null\)\)\}/);
  assert.match(c, /aria-label="Forward one day" onClick=\{\(\) => go\(hrefFor\(shiftDay\(day, 1\), null\)\)\}/);
  assert.match(c, /disabled=\{day === today\} onClick=\{\(\) => go\(hrefFor\(today, null\)\)\}>\{TODAY_WORD\}<\/button>/);
  assert.match(c, /disabled=\{stepParam === null\} onClick=\{\(\) => go\(hrefFor\(day, null\)\)\}>all<\/button>/, '"all" clears any step, a bad one too');
  assert.match(c, /aria-label="Back one step" disabled=\{focus === null \|\| focus\.index === 1\} onClick=\{\(\) => \{ if \(focus !== null\) go\(hrefFor\(day, focus\.index - 1\)\); \}\}>‹ step<\/button>/);
  assert.match(c, /aria-label="Forward one step" disabled=\{N === 0 \|\| \(focus !== null && focus\.index === N\)\} onClick=\{\(\) => go\(hrefFor\(day, focus === null \? 1 : focus\.index \+ 1\)\)\}>step ›<\/button>/);
  assert.ok(c.indexOf('data-day-controls') < c.indexOf('data-day-card'), 'the controls come before the plate');
  // A read that lands after the day changed is dropped — the live guard.
  assert.match(c, /let live = true;\n[\s\S]*?if \(!live\) return;\n[\s\S]*?return \(\) => \{ live = false; \};/);
  // Tokens only: text, border, bg-white, bg-bg-row, the purple heading, the gold badge, the green bar and marks, the amber marks and notices, mono.
  const headCell = c.match(/const headCell = '([^']*)';/);
  assert.ok(headCell !== null, 'the head cells’ classes are one named const');
  const classes = [...c.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).concat([...c.matchAll(/className=\{`([^`]*)`\}/g)].flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/))).concat(headCell![1].split(/\s+/));
  const colour = classes.filter((k) => /^(?:[a-z-]+:)?(text|bg|border)-/.test(k));
  const allowed = /^(text-text-(primary|secondary|muted|faint)|text-brand-(purple|green|amber|red)|text-left|text-right|text-center|text-xs|text-lg|border-border(-light)?|border-t|border|bg-ts-white|bg-bg-row|bg-brand-gold|bg-brand-green|hover:bg-bg-row|focus-within:bg-bg-row)$/;
  assert.deepEqual(colour.filter((k) => !allowed.test(k)), [], 'every colour class is a token');
});

// TASKS-ONE-01 (2026-10-14): the page was "dynamic, AppLayout and the card — nothing else". The card moved to the top
// of /tasks (Alex's ruling: one Tasks page, no sub-tabs), so /tasks/day is a server redirect and nothing else — the
// pin moved with it; tasksOne01.test.ts drives the hop's rule.
test('T6 the page: /tasks/day is one server hop to /tasks — date and step kept, nothing else', () => {
  const p = code(PAGE);
  assert.match(p, /export default async function TasksDayRedirect\(\{ searchParams \}: \{ searchParams: Promise<Record<string, string \| string\[\] \| undefined>> \}\) \{\n\s*redirect\(dayCardRedirectHref\(await searchParams\)\);\n\}/);
  assert.doesNotMatch(p, /'use client'|AppLayout|<DayCard|force-dynamic|OperationsEntityProvider|ToolOpener/);
  assert.deepEqual([...p.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]), ['next/navigation', '@/components/workbench/operations/day/dayCard']);
});

// TASKS-ONE-01 (2026-10-14): the doors were the registry link on the Tasks row and the week bar's chip. The card is
// the first section of /tasks now — on the same page as the week — so both doors are gone, and the pin moved to
// their absence: no link and no chip leads to /tasks/day (old URLs still land, through the redirect above).
test('T6 the doors: the card is on /tasks itself — no registry link and no week chip lead to /tasks/day', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.equal((tasks.links ?? []).some((l) => l.label === 'Day card' || l.href?.startsWith('/tasks/day') === true), false);
  assert.doesNotMatch(code(REGISTRY), /\/tasks\/day/);
  const w = code(WEEK);
  assert.doesNotMatch(w, /data-week-day-card|\/tasks\/day|import Link from 'next\/link';/);
  assert.match(w, /disabled=\{weekOf === shiftWeek\(today, 0\)\} onClick=\{\(\) => setWeekOf\(shiftWeek\(today, 0\)\)\}>this week<\/button>\n\s*<\/div>/, 'the week bar ends at "this week"');
});

// ── T7 · CLEAN-01 (2026-10-14): THE FULL CARD, CLEANED ───────────────────────

/** The browser check's day: four place stops, three priced — $25 + $20 + $30 = $75 planned; the Gym asks an amount and has no plan. */
const CLEAN_STOPS = [
  { id: 'brunch', name: 'Brunch', hour: 11, at: '2026-10-11T04:00:00.000Z', cents: 2500 },
  { id: 'activities', name: 'Activities', hour: 15, at: '2026-10-11T08:00:00.000Z', cents: 2000 },
  { id: 'dinner', name: 'Dinner', hour: 19, at: '2026-10-11T12:00:00.000Z', cents: 3000 },
  { id: 'gym-place', name: 'Gym', hour: 20, at: '2026-10-11T13:00:00.000Z', cents: null },
] as const;
type CleanId = (typeof CLEAN_STOPS)[number]['id'];

/** The day with these actuals recorded (each a done record with its amount); null — the records were not read. */
function cleanDay(actuals: Partial<Record<CleanId, number>> | null, more: TodayRoutineEntry[] = []) {
  const records = actuals === null ? null : CLEAN_STOPS.filter((s) => actuals[s.id] !== undefined).map((s): StopRecordRow => ({
    id: `rec-${s.id}`, kind: 'routine', target_id: s.id, occurrence_at: s.at, outcome: 'done', done_at: s.at, actual_cents: actuals[s.id] as number, rating: null, note: null, actual_minutes: null,
  }));
  return dayStops(input({
    entries: [...CLEAN_STOPS.map((s) => entry(routine({ id: s.id, name: s.name, role: 'place', schedule_rrule: `FREQ=DAILY;BYHOUR=${s.hour};BYMINUTE=0` }), 'pending', s.at)), ...more],
    lines: CLEAN_STOPS.flatMap((s) => (s.cents === null ? [] : [line({ address: { kind: 'routine', id: s.id, instant: s.at }, cents: s.cents, label: s.name })])),
    records,
  }));
}
const ALL_UNDER = { brunch: 969, activities: 1500, dinner: 2200, 'gym-place': 500 } as const;
const ALL_OVER = { brunch: 969, activities: 3000, dinner: 3500, 'gym-place': 1200 } as const;
/** The screen's spent (DayCard.tsx, pinned below): unknown while the records are unread or nothing carries an actual. */
const spentOf = (r: ReturnType<typeof dayStops>): number | null => (r.spentCents === null || r.withActual === 0 ? null : r.spentCents);

/** The index just past the `</div>` closing the `<div` opened at `openAt` — each tag read to its `>` with its attributes' braces balanced; a self-closing `<div … />` opens nothing. */
function divEnd(body: string, openAt: number): number {
  let depth = 0;
  let i = openAt;
  for (;;) {
    const open = body.indexOf('<div', i);
    const close = body.indexOf('</div>', i);
    assert.notEqual(close, -1, 'the element closes');
    if (open !== -1 && open < close) {
      let j = open + 4;
      let braces = 0;
      while (!(body[j] === '>' && braces === 0)) {
        if (body[j] === '{') braces += 1;
        if (body[j] === '}') braces -= 1;
        j += 1;
      }
      if (body[j - 1] !== '/') depth += 1;
      i = j + 1;
    } else {
      depth -= 1;
      i = close + '</div>'.length;
      if (depth === 0) return i;
    }
  }
}

test('T7 CLEAN-01 the full card’s order — where under the header, the hero, "Under or Over?", the spent line, the meter, the verdict, the table', () => {
  const c = code(CARD);
  assert.equal(HOOK_WORDS, 'Under or Over?', 'the hook, exactly');
  assert.match(c, /\{loaded && focus === null && \(\n\s*<>\n\s*\{\s*\}\n\s*<div className="font-semibold text-text-secondary" style=\{\{ fontSize: 27, lineHeight: 1\.15 \}\} data-day-where>\{whereWords\(day, stayState\)\}<\/div>\n\s*<div className="flex items-baseline gap-3 pt-1" data-day-hero>/, 'the where line is the full card’s first line under the header, the hero right under it');
  inOrderOf(c, [
    'data-day-card', '<PlateHeader', '{loaded && focus === null && (', 'data-day-where>', 'data-day-hero>', 'data-day-hook>{HOOK_WORDS}</div>',
    'data-day-spent>{spentOutOfWords(spent, plannedCents)}</div>', 'data-day-meter=', 'data-day-verdict>', 'data-day-stops>', '{loaded && focus !== null && (',
  ], 'the full card, top to bottom');
  assert.doesNotMatch(code(RULES), /hookWords/, 'hookWords is gone — nothing reads it');
  assert.doesNotMatch(c, /hookWords|spentLineWords|stopsWords|doneOfWords|withoutAmountWords/, 'no stop count on the hook; no "without an amount" or "of M done" on the spent line');
});

test('T7 CLEAN-01 spentOutOfWords — "spent $9.69 out of $75"; "—" while nothing is recorded; "planned not read" while the total is unknown', () => {
  assert.equal(spentOutOfWords(969, 7500), 'spent $9.69 out of $75');
  assert.equal(spentOutOfWords(null, 7500), 'spent — out of $75', 'nothing recorded is unknown — never $0');
  assert.equal(spentOutOfWords(969, null), 'spent $9.69 · planned not read');
  assert.equal(spentOutOfWords(null, null), 'spent — · planned not read');
  assert.equal(spentOutOfWords(0, 7500), 'spent $0 out of $75', 'a recorded $0 is an actual');
  assert.equal(PLANNED_NOT_READ_WORDS, 'planned not read');
  // Through the day's own rules and the screen's spent: one stop recorded, none recorded, the records not read.
  const one = cleanDay({ brunch: 969 });
  assert.equal(one.plannedCents, 7500);
  assert.equal(spentOutOfWords(spentOf(one), one.plannedCents), 'spent $9.69 out of $75');
  assert.equal(spentOutOfWords(spentOf(cleanDay({})), 7500), 'spent — out of $75', 'records read, no actual — "—", not $0');
  assert.equal(spentOutOfWords(spentOf(cleanDay(null)), 7500), 'spent — out of $75', 'records not read — "—" (the fine print says what was not read)');
  const c = code(CARD);
  assert.match(c, /const spent = result\.spentCents === null \|\| result\.withActual === 0 \? null : result\.spentCents;/, 'the screen’s spent: unknown while the records are unread or nothing carries an actual');
  assert.match(c, /data-day-spent>\{spentOutOfWords\(spent, plannedCents\)\}<\/div>/);
});

test('T7 CLEAN-01 the budget meter — green at its width under, red and full over, an empty track while spent is unknown, none while the plan is', () => {
  assert.deepEqual(dayMeter(969, 7500), { percent: 13, over: false }, 'under: green, spent ÷ planned');
  assert.deepEqual(dayMeter(7500, 7500), { percent: 100, over: false }, 'on the total: green and full');
  assert.deepEqual(dayMeter(8669, 7500), { percent: 100, over: true }, 'over: red and full');
  assert.deepEqual(dayMeter(7501, 7500), { percent: 100, over: true });
  assert.deepEqual(dayMeter(null, 7500), { percent: null, over: false }, 'spent unknown: an empty track, never a $0 fill');
  assert.equal(dayMeter(969, null), null, 'planned unknown: no meter');
  assert.equal(dayMeter(null, null), null);
  assert.equal(dayMeter(500, 0), null, 'nothing planned: a track of $0 has no scale (progressPercent’s rule)');
  const c = code(CARD);
  assert.match(c, /const meter = dayMeter\(spent, plannedCents\);/);
  assert.match(c, /\{meter !== null && \(\n\s*<div className="bg-bg-row rounded-full overflow-hidden" style=\{\{ height: 13 \}\} aria-hidden="true" data-day-meter=\{meter\.percent === null \? 'empty' : meter\.percent\}>\n\s*\{meter\.percent !== null && <div className=\{`\$\{meter\.over \? 'bg-brand-red' : 'bg-brand-green'\} rounded-full`\} style=\{\{ height: 13, width: `\$\{meter\.percent\}%` \}\} \/>\}\n\s*<\/div>\n\s*\)\}/, 'one track at the plate’s content width (no width of its own), its fill green or red, none while spent is unknown');
  assert.equal((c.match(/\bbg-brand-red\b/g) ?? []).length, 1, 'red fills the meter and nothing else');
});

test('T7 CLEAN-01 the verdict — only once every stop that asks an amount carries one: under, over, on budget; absent while one is missing or none is recorded', () => {
  assert.equal(ON_BUDGET_WORDS, 'on budget');
  assert.equal(dayVerdict(cleanDay({ brunch: 969 }), 7500), null, 'one stop recorded — no verdict');
  assert.equal(dayVerdict(cleanDay({ brunch: 969, activities: 1500, dinner: 2200 }), 7500), null, 'the Gym asks an amount and has none — no verdict');
  assert.deepEqual(dayVerdict(cleanDay(ALL_UNDER), 7500), { text: '▼ $23.31 under', over: false }, 'every amount in, under');
  assert.deepEqual(dayVerdict(cleanDay(ALL_OVER), 7500), { text: '▲ $11.69 over', over: true }, 'every amount in, over');
  assert.deepEqual(dayVerdict(cleanDay({ brunch: 2500, activities: 2000, dinner: 3000, 'gym-place': 0 }), 7500), { text: 'on budget', over: false }, 'equal — a recorded $0 is an amount');
  assert.equal(dayVerdict(cleanDay({}), 7500), null, 'none recorded');
  assert.equal(dayVerdict(cleanDay(null), 7500), null, 'the records not read');
  assert.equal(dayVerdict(cleanDay(ALL_UNDER), null), null, 'the planned total unknown');
  // A work stop asks no amount (asksAmount — the PLAN-01 count): a journal stop with none does not hold the verdict back.
  const journal = entry(routine({ id: 'vision', name: 'Vision journal', role: 'journal', schedule_rrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0' }), 'pending', '2026-10-10T23:00:00.000Z');
  const withJournal = cleanDay(ALL_UNDER, [journal]);
  assert.equal(withJournal.stops.length, 5);
  assert.deepEqual(dayVerdict(withJournal, 7500), { text: '▼ $23.31 under', over: false });
  const c = code(CARD);
  assert.match(c, /const verdict = dayVerdict\(result, plannedCents\);/);
  assert.match(c, /\{verdict !== null && <div className=\{`font-bold tabular-nums \$\{actualTone\(verdict\.over\)\}`\} style=\{\{ fontSize: 27, lineHeight: 1\.15 \}\} data-day-verdict>\{verdict\.text\}<\/div>\}/, 'the verdict in the card’s under/over tone, only when there is one');
});

test('T7 CLEAN-01 the table — five headers in order, the ACTUAL cell, the BUDGET cell the budget only, the widths summing to the plate’s content width', () => {
  const c = code(CARD);
  assert.equal(ACTUAL_HEAD_WORD, 'ACTUAL');
  inOrderOf(c, ['<thead>', '{TIME_HEAD_WORD}</th>', '{VENDOR_HEAD_WORD}</th>', '{DESCRIPTION_HEAD_WORD}</th>', '{BUDGET_HEAD_WORD}</th>', '{ACTUAL_HEAD_WORD}</th>', '</thead>'], 'five headers');
  assert.match(c, /<th scope="col" className=\{`\$\{headCell\} text-right`\} style=\{\{ \.\.\.headStyle, paddingRight: CELL_GAP \}\}>\{BUDGET_HEAD_WORD\}<\/th>\n\s*<th scope="col" className=\{`\$\{headCell\} text-right`\} style=\{headStyle\}>\{ACTUAL_HEAD_WORD\}<\/th>/, 'ACTUAL right-aligned after BUDGET; BUDGET’s head keeps its cell’s gap, so it sits over its figure');
  const row = /<tr\n\s*key=\{s\.key\}([\s\S]*?)<\/tr>/.exec(c)![1];
  assert.match(row, /<td className="text-right" style=\{\{ padding: CELL_PADDING \}\} data-day-col="budget">\n\s*<span className=\{`block font-extrabold tabular-nums \$\{s\.cents === null \? 'text-text-faint' : 'text-text-primary'\}`\} style=\{\{ fontSize: 19, lineHeight: 1\.1 \}\} data-day-amount>\{planDollars\(s\.cents\)\}<\/span>\n\s*<\/td>/, 'the BUDGET cell carries the budget only');
  assert.match(row, /<td className="text-right" style=\{\{ padding: '7px 0' \}\} data-day-col="actual">\n\s*<span className=\{`block font-extrabold tabular-nums \$\{s\.actualCents === null \? 'text-text-faint' : actualTone\(deltaWords\(s\.actualCents, s\.cents\)\.over\)\}`\} style=\{\{ fontSize: 19, lineHeight: 1\.1 \}\} data-day-actual>\{s\.actualCents === null \? factOf\(null\) : rowActualWords\(s\.actualCents, s\.cents\)\}<\/span>\n\s*<\/td>/, 'the ACTUAL cell: the row’s actual against its plan in the under/over tone, or — ; the last cell, no gap');
  const budgetCell = /data-day-col="budget">([\s\S]*?)<\/td>/.exec(row)![1];
  assert.doesNotMatch(budgetCell, /data-day-actual|rowActualWords|actualCents/, 'no actual in the BUDGET cell');
  assert.match(c, /const CELL_PADDING = `7px \$\{CELL_GAP\}px 7px 0`;/);
  assert.equal((row.match(/padding: CELL_PADDING/g) ?? []).length, 4, 'every cell but the last keeps the gap');
  assert.doesNotMatch(c, /'7px 4px 7px 0'/, 'the gap is CELL_GAP, never typed');
  // The widths: from the plate's inner width — five, in the table's order, summing to it exactly.
  assert.deepEqual(Object.keys(COLUMN_WIDTHS), ['time', 'vendor', 'description', 'budget', 'actual']);
  const widths = Object.values(COLUMN_WIDTHS);
  assert.equal(widths.reduce((a, b) => a + b, 0), PLATE_INNER_WIDTH, `the five sum to the plate’s content width (${PLATE_INNER_WIDTH})`);
  assert.ok(widths.every((w) => Number.isInteger(w) && w > 0), 'whole pixels');
  // Measured in the card's own fonts (TABLE-01): '$9,999.99' at 19 px extrabold is 96.4 px; the clock "06:30–06:45" at 13 px mono 86 px; 'DESCRIPTION' at 12 px tracked 100 px.
  assert.equal(FIGURE_WIDTH, 98);
  assert.equal(CELL_GAP, 4);
  assert.ok(COLUMN_WIDTHS.budget - CELL_GAP >= 97, `BUDGET holds '$9,999.99' whole beside its gap (${COLUMN_WIDTHS.budget} − ${CELL_GAP})`);
  assert.ok(COLUMN_WIDTHS.actual >= 97, `ACTUAL holds '$9,999.99' whole (${COLUMN_WIDTHS.actual})`);
  const markSlot = Number(/const MARK_SLOT = (\d+);/.exec(c)![1]);
  assert.ok(COLUMN_WIDTHS.time >= markSlot + 86 + CELL_GAP, 'TIME keeps its mark slot and the clock');
  assert.ok(Math.abs(COLUMN_WIDTHS.vendor - COLUMN_WIDTHS.description) <= 1, 'VENDOR and DESCRIPTION share the rest');
  assert.ok(COLUMN_WIDTHS.description >= 100 + CELL_GAP, 'DESCRIPTION holds its head word and its gap');
});

test('T7 CLEAN-01 the fine print — the completeness and source lines render after the plate’s closing element, small and muted, the same words', () => {
  const c = code(CARD);
  const plateOpen = c.lastIndexOf('<div', c.indexOf('data-day-card'));
  const plateEnd = divEnd(c, plateOpen);
  const plate = c.slice(plateOpen, plateEnd);
  assert.match(plate.slice(-40), /<\/div>$/, 'the slice ends on the plate’s own closing tag');
  assert.ok(plate.includes('data-day-focus>') && plate.includes('data-day-stops>'), 'both views are inside the plate');
  assert.doesNotMatch(plate, /data-day-count|data-day-plate-foot|data-day-fine-print/, 'the completeness line is off the plate');
  // CLEAN-01 kept the step view's source line on its plate (1 here); CLEAN-02 (2026-10-14) moved it to the fine print — none on the plate.
  assert.doesNotMatch(plate, /data-day-provenance|data-day-bars-why/, 'no source line and no why-line on any plate');
  const after = c.slice(plateEnd);
  // CLEAN-02 (2026-10-14): "download image" is directly under the plate (T8); the fine print follows it — the CLEAN-01 block, now shown
  // on a stop card too, carrying that card's why-line. The full card's lines and words are unchanged.
  assert.match(after, /\{loaded && \(focus === null \|\| focus\.stop\.role !== 'journal'\) && \(\n\s*<div className="mx-auto space-y-1 text-xs text-text-muted" style=\{\{ width: PLATE_WIDTH \}\} data-day-fine-print>\n\s*\{focus === null && completeness !== null && <p data-day-count>\{completeness\}<\/p>\}\n\s*\{focus !== null && planBar === null && <p data-day-bars-why>\{plannedCents === null \? BARS_PLAN_NOT_READ_WORDS : BARS_NOTHING_PLANNED_WORDS\}<\/p>\}\n\s*<p className="font-mono" data-day-provenance>\{provenanceWords\(today, reportRead, recordsOk\)\}<\/p>\n\s*<\/div>\n\s*\)\}/, 'under the plate: the completeness line (full card) or the why-line (stop card), then the source line — small, muted, at the plate’s width');
  inOrderOf(after, ['data-day-download-image', 'data-day-fine-print', 'data-day-hint', 'data-day-foot', 'data-day-stranded>'], 'the download button, the fine print, then the hint, then the sentences beside the stranded-vendor line');
});

// ── T8 · CLEAN-02 (2026-10-14): THE JOURNAL AND STOP CARDS, CLEANED; THE CARD AS AN IMAGE ──

const CARD_IMAGE = 'src/components/workbench/operations/cardImage.ts';

test('T8 CLEAN-02 the journal card renders only its five blocks — none of the removed parts, no money', () => {
  const c = code(CARD);
  const plate = c.slice(c.indexOf('function JournalPlate('), c.indexOf('function PlateHeader('));
  const attrs = [...new Set([...plate.matchAll(/\b(data-day-[a-z-]+)/g)].map((m) => m[1]))];
  assert.deepEqual(attrs, [
    'data-day-journal', 'data-day-journal-yesterday', 'data-day-yesterday-loading', 'data-day-yesterday-journal-failed', 'data-day-yesterday-steps', 'data-day-yesterday-note',
    'data-day-journal-today', 'data-day-journal-goals-none', 'data-day-journal-goal', 'data-day-journal-blockers', 'data-day-journal-blocker',
    'data-day-journal-plan-block', 'data-day-journal-steps-none', 'data-day-journal-step', 'data-day-journal-step-done', 'data-day-journal-plan-done', 'data-day-journal-tick-words',
    'data-day-journal-end-of-day', 'data-day-journal-shipped', 'data-day-journal-loading', 'data-day-journal-failed', 'data-day-journal-none',
  ], 'YESTERDAY, TODAY, BLOCKERS, PLAN, END OF DAY and the read’s own state — nothing else');
  assert.doesNotMatch(plate, /planDollars|Cents|spent|tally|statusWords|minutesLine|provenance|todayPlanWords|vendor|location/i, 'no money, no status, no source on the journal card');
  // The step view draws the stop card's parts only for a stop that is not the journal.
  assert.match(c, /\{focus\.stop\.role !== 'journal' && \(\n\s*<div className="flex items-baseline gap-2" data-day-vendor>/, 'no VENDOR on the journal card');
  assert.match(c, /\{focus\.stop\.role !== 'journal' && \(\n\s*<div className="shrink-0 flex flex-col items-end" style=\{\{ gap: 3 \}\}>\n\s*<div [^>]*>\{PLAN_WORD\}<\/div>/, 'no PLAN amount on the journal card');
  const branch = /\{focus\.stop\.role === 'journal' \? \(\n\s*<JournalPlate [^\n]*\/>\n\s*\) : \(\n\s*<>([\s\S]*?)\n\s*<\/>\n\s*\)\}/.exec(c);
  assert.ok(branch !== null, 'the journal plate, or the stop card’s record and bars');
  inOrderOf(branch![1], ['data-day-record>', 'data-day-plan-so-far>', 'data-day-plan-bar=', 'data-day-spent-so-far>', 'data-day-spent-bar='], 'the record and both bars — the stop card’s alone');
  assert.match(c, /\{loaded && \(focus === null \|\| focus\.stop\.role !== 'journal'\) && \(/, 'no fine print under the journal card — no source line');
});

test('T8 CLEAN-02 the stop card: no LOCATION, no status line, the stars alone, "spent so far $x of $y", the why-line and the source line after the plate’s closing element', () => {
  const c = code(CARD);
  assert.doesNotMatch(c, /data-day-location|LOCATION_HEAD_WORD/, 'no LOCATION');
  assert.doesNotMatch(c, /data-day-status>|statusWords/, 'no status line — the full card’s ✓ says done');
  assert.match(c, /data-day-rating>\{starsWords\(focus\.stop\.record\.rating\)\}<\/div>/, 'the stars alone');
  assert.doesNotMatch(c, /ratingWords|RATING_WORDS/, 'no rubric words on the plate');
  assert.equal(spentSoFarWords(969, 7500), 'spent so far $9.69 of $75');
  assert.equal(spentSoFarWords(null, 7500), 'spent so far — of $75', 'nothing recorded — unknown, never $0');
  assert.doesNotMatch(spentSoFarWords(969, 7500), /without an amount/);
  assert.match(c, /data-day-spent-so-far>\{spentSoFarWords\(focus\.spentSoFarCents === null \|\| focus\.withActualSoFar === 0 \? null : focus\.spentSoFarCents, plannedCents\)\}/);
  for (const kept of ['data-day-note>', 'data-day-amount>{planDollars(focus.stop.cents)}', 'data-day-actual>{planDollars(focus.stop.actualCents)}', 'data-day-delta>', 'data-day-plan-bar={planBar}', 'data-day-spent-bar={spentBar}']) assert.ok(c.includes(kept), `the stop card keeps ${kept}`);
  const plateOpen = c.lastIndexOf('<div', c.indexOf('data-day-card'));
  const plateEnd = divEnd(c, plateOpen);
  assert.ok(c.indexOf('data-day-bars-why>') > plateEnd && c.indexOf('data-day-provenance>') > plateEnd, 'the why-line and the source line render after the plate’s closing element');
  assert.equal((c.match(/data-day-bars-why>/g) ?? []).length, 1);
});

test('T8 CLEAN-02 "download image": under both views outside the plate, the library imported in the click’s own work, the name, the failure words', () => {
  const c = code(CARD);
  const plateOpen = c.lastIndexOf('<div', c.indexOf('data-day-card'));
  const plateEnd = divEnd(c, plateOpen);
  assert.match(c.slice(plateOpen, plateOpen + 40), /^<div ref=\{plateRef\} /, 'the plate element is the one rendered');
  const after = c.slice(plateEnd);
  assert.match(after, /^\s*\n\s*\{\s*\}\n\s*\{loaded && \(\n\s*<div className="mx-auto flex flex-col items-start gap-1 text-xs" style=\{\{ width: PLATE_WIDTH \}\} data-day-image>\n\s*<button type="button" className=\{chip\} disabled=\{imageBusy\} aria-busy=\{imageBusy\} onClick=\{downloadImage\} data-day-download-image>\{DOWNLOAD_IMAGE_WORDS\}<\/button>\n\s*\{imageFailed !== null && imageFailed\.view === view && <p className="text-brand-red" data-day-image-failed>\{imageFailed\.words\}<\/p>\}\n\s*<\/div>\n\s*\)\}/, 'directly under the plate, on every loaded view — the full card and every step card, the journal’s included; busy while it renders; the failure in words under it');
  assert.doesNotMatch(c.slice(plateOpen, plateEnd), /data-day-download-image|data-day-image/, 'outside the plate — never in the recording');
  inOrderOf(c, ['const downloadImage = async () => {', 'if (imageBusy) return;', 'setImageBusy(true);', 'setImageFailed(null);', 'try {', "if (plateRef.current === null) throw new Error('the card is not on the page');", 'await downloadCardImage(plateRef.current, cardImageName(day, focus === null ? null : { index: focus.index, label: boldOf(focus.stop) }));', '} catch (error) {', 'setImageFailed({ view, words: cardImageFailedWords(error instanceof Error ? error.message : String(error)) });', '} finally {', 'setImageBusy(false);'], 'busy, render, say the failure, done');
  assert.equal((c.match(/downloadCardImage\(/g) ?? []).length, 1, 'one path — no second try');
  assert.match(c, /import \{ DOWNLOAD_IMAGE_WORDS, cardImageFailedWords, cardImageName, downloadCardImage \} from '\.\.\/cardImage';/, 'the helper lives outside the day folder');
  assert.doesNotMatch(c, /html-to-image|\bfetch\s*\(|method:/, 'the card names no library and fetches nothing of its own');
  // The helper: the library imported inside the function the click runs — loaded only when pressed; pixel ratio 3; no background of its own
  // (transparent outside the rounded corners); the copy's margin zero, so the image is the plate's box exactly.
  const h = code(CARD_IMAGE);
  assert.match(h, /export async function downloadCardImage\(plate: HTMLElement, name: string\): Promise<void> \{\n\s*const \{ toPng \} = await import\('html-to-image'\);\n\s*const url = await toPng\(plate, \{ pixelRatio: CARD_IMAGE_PIXEL_RATIO, style: \{ margin: '0' \} \}\);\n\s*const link = document\.createElement\('a'\);\n\s*link\.href = url;\n\s*link\.download = name;\n\s*link\.click\(\);\n\}/);
  assert.equal(CARD_IMAGE_PIXEL_RATIO, 3);
  assert.doesNotMatch(h, /backgroundColor|toJpeg|toBlob|toSvg|html2canvas|catch/, 'transparent; one renderer, one format; the caller says a failure');
  assert.match(code('package.json'), /"html-to-image": "1\.11\.13",/, 'pinned exactly');
  // The name: the day, then "all" or the step and its label slugged.
  assert.equal(cardImageName('2026-10-14', null), 'temple-stuart-2026-10-14-all.png');
  assert.equal(cardImageName('2026-10-14', { index: 2, label: 'Brunch' }), 'temple-stuart-2026-10-14-step-2-brunch.png');
  assert.equal(cardImageName('2026-10-14', { index: 1, label: 'Daily Vision - Journal' }), 'temple-stuart-2026-10-14-step-1-daily-vision-journal.png');
  assert.equal(cardImageName('2026-10-13', { index: 10, label: '  Brunch @ Luka Café!! ' }), 'temple-stuart-2026-10-13-step-10-brunch-luka-caf.png', 'lowercase, every run of non-alphanumerics one hyphen, none at either end');
  assert.equal(slugWords('--a--b--'), 'a-b');
  assert.throws(() => cardImageName('2026-10-14', { index: 3, label: '☕ — ☕' }), /has no letter or digit to name the file/, 'a label that slugs to nothing is refused by name — never a name made up');
  assert.equal(DOWNLOAD_IMAGE_WORDS, 'download image');
  assert.equal(cardImageFailedWords('the card is not on the page'), 'could not make the image — the card is not on the page');
});
