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
  BRAND_WORDS, TASK_WORD, TODAY_WORD, UNTITLED_WORDS, badDateWords, badStepWords, dayStops, dayWords, focusStop,
  linesUnreadWords, linesWithoutStopWords, notPlacedWords, notPricedWords, ofWords, provenanceWords, routineFigureWords, soFarWords, stopsWords, strandedWords, unmatchedWords,
  type DayCardInput,
} from '@/components/workbench/operations/day/dayCard';
import { dayReportFailedWords, readDayReport } from '@/components/workbench/operations/day/dayReads';
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
  location: null, steps: [], ...over,
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
  id, title, status, project_id: 'proj', coa_code: null, estimated_cost_usd: null, actual_cost_usd: null, actual_minutes: null,
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

const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, ...over });

// ── T1 · THE RULES ───────────────────────────────────────────────────────────

test('T1 a routine with three lines gives three stops in step order by time; the untimed one takes the occurrence’s time in the routine’s zone', () => {
  const r = dayStops(input({ entries: [entry(morning)] }));
  assert.deepEqual(r.stops.map((s) => [s.kind, s.key, s.time, s.label, s.line, s.place, s.minutes, s.cents, s.status]), [
    ['line', `line:stretch:${AT}`, '06:30', 'Morning', 'Stretch', 'Home', null, null, 'open'],
    ['line', `line:journal:${AT}`, '07:00', 'Morning', 'Journal', 'Home', null, null, 'open'],
    ['line', `line:coffee:${AT}`, '07:30', 'Morning', 'Coffee', 'Roots Thonglor', 30, null, 'open'],
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
  assert.deepEqual(r.stops[3], { kind: 'routine', key: `routine:gym:${GYM_AT}`, time: '20:00', label: 'Gym', line: null, place: 'Fitness First', minutes: null, cents: null, status: 'done' });
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
  assert.deepEqual(viewer.stops[0], { kind: 'task', key: 'task:i1', time: '10:00', label: 'Ship DAYCARD-01', line: null, place: null, minutes: null, cents: null, status: 'open' });
  const la = dayStops(input({ viewerZone: 'America/Los_Angeles', items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship DAYCARD-01'), calendar_blocks: [block('2026-10-11T03:00:00.000Z')] })] }));
  assert.equal(la.stops[0].time, '20:00', 'the day before in Los Angeles, at 20:00 — the block’s clock in the viewer’s zone, as Tab 1 draws it');
  const none = dayStops(input({ items: [item({ id: 'i2', task_id: 't2', task: task('t2', 'Audit the week', 'completed'), calendar_blocks: [block('2026-10-11T03:00:00.000Z', 'cancelled')] }), item({ id: 'i3', ad_hoc_title: 'Walk', calendar_blocks: [block('2026-10-11T04:00:00.000Z')] })] }));
  assert.deepEqual(none.stops.map((s) => [s.key, s.time, s.label, s.status]), [['task:i3', '11:00', 'Walk', 'open'], ['task:i2', null, 'Audit the week', 'done']]);
  assert.equal(dayStops(input({ items: [item({ id: 'i4' })] })).stops[0].label, UNTITLED_WORDS, 'an item with no task and no title is named as such, never a blank row');
});

test('T1 the place: the vendor beats the line’s location, which beats the routine’s, which beats null; a blank location is no place', () => {
  const vendor = { id: 'v1', name: 'Luka Sathorn', entityId: 'P', grain: 'occurrence' as const };
  const priced = line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee', vendor });
  const withVendor = dayStops(input({ entries: [entry(morning)], lines: [priced] }));
  assert.equal(withVendor.stops.find((s) => s.line === 'Coffee')?.place, 'Luka Sathorn');
  const noVendor = dayStops(input({ entries: [entry(morning)], lines: [{ ...priced, vendor: null }] }));
  assert.equal(noVendor.stops.find((s) => s.line === 'Coffee')?.place, 'Roots Thonglor');
  assert.equal(noVendor.stops.find((s) => s.line === 'Stretch')?.place, 'Home');
  const nowhere = routine({ id: 'n', name: 'Nowhere', steps: [step({ id: 'n1', step_order: 1, activity: 'Sit', location: '   ' })] });
  assert.equal(dayStops(input({ entries: [entry(nowhere)] })).stops[0].place, null);
  assert.equal(dayStops(input({ entries: [entry(routine({ id: 'g', name: 'G', location: '' }), 'pending', GYM_AT)] })).stops[0].place, null);
});

// ── T2 · MATCHING, EXACT ─────────────────────────────────────────────────────

test('T2 a line whose kind, id and instant match gives the stop its cents and its vendor; the instant one hour off is unmatched, both instants named, cents null', () => {
  const exact = line({ address: { kind: 'routine_line', id: 'coffee', instant: AT }, cents: 500, label: 'Morning', line: 'Coffee', time: '07:30', vendor: { id: 'v', name: 'Roots', entityId: 'P', grain: 'every' } });
  const r = dayStops(input({ entries: [entry(morning)], lines: [exact] }));
  const coffee = r.stops.find((s) => s.line === 'Coffee')!;
  assert.equal(coffee.cents, 500);
  assert.equal(coffee.place, 'Roots');
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
  assert.deepEqual(focusStop(r, 1), { index: 1, of: 4, stop: r.stops[0], soFarCents: 0 });
  assert.deepEqual(focusStop(r, 3), { index: 3, of: 4, stop: r.stops[2], soFarCents: 500 });
  assert.deepEqual(focusStop(r, 4), { index: 4, of: 4, stop: r.stops[3], soFarCents: 2000 });
  for (const n of [0, 5, 2.5, Number.NaN, -1]) assert.equal(focusStop(r, n), null, `step ${n}`);
  assert.equal(focusStop(dayStops(input()), 1), null, 'no stops, no step');
});

test('T3 the words, exact', () => {
  assert.equal(BRAND_WORDS, 'TEMPLE STUART');
  assert.equal(TODAY_WORD, 'today');
  assert.equal(TASK_WORD, 'task');
  assert.equal(UNTITLED_WORDS, 'untitled item');
  // 2026-10-11 is a Sunday (the prompt's example said "Sat" — the calendar says otherwise); the words come from the day's UTC parts.
  assert.equal(dayWords('2026-10-11'), 'Sun Oct 11 2026');
  assert.equal(dayWords('2026-01-01'), 'Thu Jan 1 2026');
  assert.equal(dayWords('2026-10-10'), 'Sat Oct 10 2026');
  assert.equal(stopsWords(1), '1 stop');
  assert.equal(stopsWords(7), '7 stops');
  assert.equal(notPricedWords(3), '3 not priced');
  assert.equal(ofWords(4, 7), '4 of 7');
  assert.equal(soFarWords(1400, 5000), 'so far $14.00 of $50.00');
  assert.equal(soFarWords(null, null), 'so far — of —');
  assert.equal(provenanceWords('2026-10-11', '2026-10-11'), "amounts: the Budget's plan lines for 2026-10-11 · as of 2026-10-11");
  assert.equal(badDateWords('yesterday'), '?date=yesterday is not a day (YYYY-MM-DD) — showing today');
  assert.equal(badStepWords('9', 7), "?step=9 is not one of this day's 7 stops — showing the whole card");
  assert.equal(unmatchedWords([{ label: 'Morning', line: 'Coffee', cents: 500, lineInstant: '2026-10-11T01:00:00.000Z', stopInstant: AT, reason: 'instant differs' }]),
    "1 plan line is at another instant than its stop — Morning — Coffee $5.00: planned at 2026-10-11T01:00:00.000Z, the day's one stop is at 2026-10-11T00:00:00.000Z (the today read names one occurrence per routine per day — this line has no stop)");
  assert.equal(unmatchedWords([
    { label: 'Gym', line: null, cents: 1500, lineInstant: GYM_AT, stopInstant: GYM_AT, reason: 'two plan lines for one stop' },
    { label: 'Gym', line: null, cents: 1600, lineInstant: GYM_AT, stopInstant: GYM_AT, reason: 'two plan lines for one stop' },
  ]), '2 plan lines are at another instant than their stops — Gym $15.00: two plan lines for one stop — neither used · Gym $16.00: two plan lines for one stop — neither used');
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
  assert.match(code(CARD), /import \{ readDayReport \} from '\.\/dayReads';/);
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
    assert.doesNotMatch(body, /plan-vendors|vendor-directory|VendorBox|completeRoutine|editCompletionNote|completions/, `${f} writes nothing — no vendor box, no mark-done, no note`);
    assert.doesNotMatch(body, /method:\s*'(POST|PATCH|PUT|DELETE)'/, `${f} sends no write`);
    assert.doesNotMatch(body, /localStorage|sessionStorage|document\.cookie/, `${f} stores nothing`);
    assert.doesNotMatch(body, /\b(bg-black|bg-brand-purple|bg-panel|bg-brand-gold|bg-brand-green|bg-brand-red)\b(?!\/)/, `${f} paints no dark surface (the repaint law)`);
    assert.doesNotMatch(body, /consecutive_(completion|miss)_streak/, `${f} reads no streak (the two-lists law)`);
  }
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date\(\)|Date\.now\(|from 'react'|@prisma\/client/, 'the rules are pure: no fetch, no clock, no React, no Prisma');
});

// ── T6 · THE SCREEN, THE PAGE AND THE DOORS ──────────────────────────────────

test('T6 the stage, the hero, the rows, the focus, the URL — pinned in the screen', () => {
  const c = code(CARD);
  assert.match(c, /^'use client';/m);
  assert.match(c, /className="bg-white border border-border rounded-lg overflow-hidden flex flex-col mx-auto" style=\{\{ width: 540, height: 960 \}\} data-day-card/, 'the stage: 9:16, half of 1080×1920, white, the app’s border, centered');
  assert.match(c, /data-day-planned>\{formatCents\(plannedCents\)\}/, 'the hero is the Budget’s figure through formatCents');
  assert.match(c, /const plannedCents = report !== null && report\.ok \? result\.plannedCents : null;/, 'the hero is ’—’ while the report cannot be read — never a sum of the stops');
  assert.match(c, /data-day-amount>\{formatCents\(s\.cents\)\}/, 'every row amount through formatCents — ’—’ for null, never $0.00');
  assert.match(c, /data-day-amount>\{formatCents\(focus\.stop\.cents\)\}/);
  assert.match(c, /\{stopsWords\(N\)\}\{result\.notPriced > 0 && ` · \$\{notPricedWords\(result\.notPriced\)\}`\}/);
  for (const attr of ['data-day-card', 'data-day-stop=', 'data-day-status=', 'data-day-focus', 'data-day-unmatched', 'data-day-routine-figures', 'data-day-lines-without-stop', 'data-day-not-placed', 'data-day-stranded', 'data-day-report-failed', 'data-day-bad-date', 'data-day-bad-step', 'data-day-failed', 'data-day-so-far', 'data-day-provenance', 'data-day-controls']) {
    assert.ok(c.includes(attr), `the screen carries ${attr}`);
  }
  assert.match(c, /import \{ useRouter, useSearchParams \} from 'next\/navigation';/);
  assert.match(c, /const search = useSearchParams\(\);/);
  assert.match(c, /const dateParam = search\.get\('date'\);\n\s*const stepParam = search\.get\('step'\);/);
  assert.match(c, /const day = today === null \? null : dateParam !== null && isIsoDay\(dateParam\) \? dateParam : today;/, 'the day is ?date= when it is a day, else today');
  assert.match(c, /const badDate = dateParam !== null && !isIsoDay\(dateParam\) \? dateParam : null;/, 'a ?date= that is not a day is named');
  assert.match(c, /const focus = loaded && n !== null \? focusStop\(result, n\) : null;/, 'the step is the rules’ focus, judged once the reads are in — never clamped on the screen');
  assert.match(c, /const badStep = loaded && n !== null && focus === null \? stepParam : null;/, 'a step outside 1..N is named, never clamped — and not before the day has its stops');
  assert.match(c, /data-day-words>\{dayWords\(day\)\}/, 'the header day is written from the day string — never the browser’s zone');
  assert.match(c, /const go = \(href: string\) => router\.push\(href\);/);
  // The controls push the URLs the rules name: the day either side, today, all, the step either side.
  assert.match(c, /aria-label="Back one day" onClick=\{\(\) => go\(hrefFor\(shiftDay\(day, -1\), null\)\)\}/);
  assert.match(c, /aria-label="Forward one day" onClick=\{\(\) => go\(hrefFor\(shiftDay\(day, 1\), null\)\)\}/);
  assert.match(c, /disabled=\{day === today\} onClick=\{\(\) => go\(hrefFor\(today, null\)\)\}>\{TODAY_WORD\}<\/button>/);
  assert.match(c, /disabled=\{stepParam === null\} onClick=\{\(\) => go\(hrefFor\(day, null\)\)\}>all<\/button>/, '"all" clears any step, a bad one too');
  assert.match(c, /aria-label="Back one step" disabled=\{focus === null \|\| focus\.index === 1\} onClick=\{\(\) => \{ if \(focus !== null\) go\(hrefFor\(day, focus\.index - 1\)\); \}\}>‹ step<\/button>/);
  assert.match(c, /aria-label="Forward one step" disabled=\{N === 0 \|\| \(focus !== null && focus\.index === N\)\} onClick=\{\(\) => go\(hrefFor\(day, focus === null \? 1 : focus\.index \+ 1\)\)\}>step ›<\/button>/);
  // A read that lands after the day changed is dropped — the live guard.
  assert.match(c, /let live = true;\n[\s\S]*?if \(!live\) return;\n[\s\S]*?return \(\) => \{ live = false; \};/);
  // The stage is centered; the foot scrolls rather than clips; the day's lines read "could not be read" while the day read failed.
  assert.match(c, /overflow-hidden flex flex-col mx-auto" style=\{\{ width: 540, height: 960 \}\} data-day-card/);
  assert.match(c, /shrink-0 overflow-y-auto" style=\{\{ maxHeight: 320 \}\} data-day-foot/);
  assert.match(c, /data-day-lines-without-stop>\{dayFailed \? linesUnreadWords\(result\.linesWithoutStop\) : linesWithoutStopWords\(result\.linesWithoutStop\)\}/);
  assert.match(c, /data-day-routine-figures>\{routineFigureWords\(result\.routineFigures\)\}/);
  assert.match(c, /data-day-stranded>\{strandedWords\(stranded\)\}/);
  assert.match(c, /<button\n\s*type="button"\n\s*key=\{s\.key\}\n\s*className="[^"]*"\n\s*data-day-stop=\{s\.key\}\n\s*data-day-status=\{s\.status\}\n\s*onClick=\{\(\) => go\(hrefFor\(day, i \+ 1\)\)\}/, 'a row is a real button that pushes ?step=');
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\/tasks\/day\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.match(c, /import \{ localToday \} from '@\/lib\/localToday';/);
  assert.match(c, /setToday\(localToday\(\)\);\n\s*setZone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\);/);
  assert.match(c, /import \{ isIsoDay \} from '@\/lib\/budget\/days';/);
  assert.match(c, /import \{ shiftDay \} from '@\/lib\/budget\/reportView';/);
  assert.match(c, /await Promise\.all\(\[readDay\(day\), readDayReport\(day, today\), readItems\(day, day\)\]\)/, 'the three reads, in parallel, asOf today');
  assert.match(c, /<RefusedRoutines refused=\{refused\} \/>/);
  assert.match(c, /soFarWords\(plannedCents === null \? null : focus\.soFarCents, plannedCents\)/);
  assert.match(c, /\{provenanceWords\(day, today\)\}/);
  // The controls sit outside the stage: the stage's box opens after the controls' div closes.
  assert.ok(c.indexOf('data-day-controls') < c.indexOf('data-day-card'), 'the controls come before the stage');
  // Tokens only: text, border, bg-white, bg-bg-row, the purple heading, the green and amber marks, mono.
  const classes = [...c.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).concat([...c.matchAll(/className=\{`([^`]*)`\}/g)].flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/)));
  const colour = classes.filter((k) => /^(text|bg|border)-/.test(k));
  const allowed = /^(text-text-(primary|secondary|muted|faint)|text-brand-(purple|green|amber|red)|text-left|text-xs|text-lg|border-border(-light)?|border-t|border|bg-white|bg-bg-row|hover:bg-bg-row)$/;
  assert.deepEqual(colour.filter((k) => !allowed.test(k)), [], 'every colour class is a token');
});

test('T6 the page: dynamic, AppLayout and the card — nothing else', () => {
  const p = code(PAGE);
  assert.match(p, /export const dynamic = 'force-dynamic';/);
  assert.match(p, /<AppLayout page>\n\s*<DayCard \/>\n\s*<\/AppLayout>/);
  assert.doesNotMatch(p, /OperationsEntityProvider|ToolOpener|'use client'/);
  assert.deepEqual([...p.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]), ['@/components/ui/AppLayout', '@/components/workbench/operations/day/DayCard']);
});

test('T6 the doors: the registry link on the Tasks row, and the week bar’s chip', () => {
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.deepEqual(tasks.links?.[3], { label: 'Day card', href: '/tasks/day' });
  assert.match(code(REGISTRY), /\{ label: 'Audit trail', href: '\/operations\/audit-log' \},\n\s*\{ label: 'Day card', href: '\/tasks\/day' \},/);
  const w = code(WEEK);
  assert.match(w, /import Link from 'next\/link';/);
  assert.match(w, /<Link href=\{`\/tasks\/day\?date=\$\{today\}`\} className=\{chip\} data-week-day-card>day card<\/Link>/);
  assert.ok(w.indexOf('>this week</button>') < w.indexOf('data-week-day-card'), 'beside "this week"');
  assert.ok(w.indexOf('data-week-day-card') < w.indexOf('data-week-time-filter'), 'in the week bar, above the time filter');
  assert.doesNotMatch(w, /\/tasks\/day[^?]/, 'the chip is the one door the week opens');
});
