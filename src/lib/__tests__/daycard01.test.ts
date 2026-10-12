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
  BADGE_WORDS, BRAND_WORDS, HOOK_WORDS, PLAN_WORD, PLANNED_WORD, STOPS_NOT_READ_WORDS, TASK_WORD, TODAY_WORD, UNTITLED_WORDS, badDateWords, badStepWords, completenessWords, dayShortWords, dayStops, focusStop,
  headerWords, heroWord, hookWords, linesUnreadWords, linesWithoutStopWords, notPlacedWords, notPricedWords, planDollars, progressPercent, provenanceWords,
  routineFigureWords, soFarWords, stepHeaderWords, stopsWords, strandedWords, unmatchedWords, whereWords,
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
const unrecorded = (statusSource: 'routine' | 'task' = 'routine') => ({ statusSource, record: null, actualCents: null, actualSource: null, doneAt: null, lateMinutes: null, actualMinutes: null });

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
  assert.deepEqual(r.stops[3], { kind: 'routine', key: `routine:gym:${GYM_AT}`, time: '20:00', label: 'Gym', line: null, place: 'Fitness First', minutes: null, cents: null, status: 'done', address: { kind: 'routine', id: 'gym', instant: GYM_AT }, zone: BKK, ...unrecorded() });
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
  assert.deepEqual(viewer.stops[0], { kind: 'task', key: 'task:i1', time: '10:00', label: 'Ship DAYCARD-01', line: null, place: null, minutes: null, cents: null, status: 'open', address: null, zone: null, ...unrecorded('task') });
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
  // spentSoFarCents null and withoutActualSoFar 0 while the records were not read (STOP-01).
  assert.deepEqual(focusStop(r, 1), { index: 1, of: 4, stop: r.stops[0], soFarCents: 0, spentSoFarCents: null, withoutActualSoFar: 0 });
  assert.deepEqual(focusStop(r, 3), { index: 3, of: 4, stop: r.stops[2], soFarCents: 500, spentSoFarCents: null, withoutActualSoFar: 0 });
  assert.deepEqual(focusStop(r, 4), { index: 4, of: 4, stop: r.stops[3], soFarCents: 2000, spentSoFarCents: null, withoutActualSoFar: 0 });
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
  assert.equal(stopsWords(1), '1 stop');
  assert.equal(stopsWords(7), '7 stops');
  assert.equal(notPricedWords(3), '3 not priced');
  assert.equal(soFarWords(1400, 5000), 'so far $14 of $50');
  assert.equal(soFarWords(1461, 5000), 'so far $14.61 of $50');
  assert.equal(soFarWords(null, null), 'so far — of —');
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
  assert.equal(HOOK_WORDS, 'under or over?');
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
  assert.equal(hookWords(7), '7 stops · under or over?');
  assert.equal(hookWords(1), '1 stop · under or over?');
  assert.equal(hookWords(null), 'stops not read · under or over?', 'unknown is not zero');
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
  assert.match(code(CARD), /import \{ readDayReport, readStays, readStopRecords, type StaysAnswer, type StopRecordsAnswer \} from '\.\/dayReads';/);
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
    assert.doesNotMatch(body, /\b(bg-black|bg-brand-purple|bg-panel|bg-brand-red)\b(?!\/)/, `${f} paints no dark surface (the repaint law)`);
    // DAYCARD-01b: the reel plate's two solid fills, and only those — the gold TS badge (dark ink on it) and the green progress bar (no ink on it).
    assert.deepEqual([...body.matchAll(/\b(bg-brand-gold|bg-brand-green)\b/g)].map((m) => m[1]), f === CARD ? ['bg-brand-gold', 'bg-brand-green'] : [], `${f}: the badge and the bar are the only solid fills`);
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
  assert.match(c, /className="bg-ts-white border border-border flex flex-col mx-auto" style=\{\{ width: 540, borderRadius: 23, padding: '25px 29px 24px', gap: 11 \}\} data-day-card/, 'the plate: card cream, the app’s hairline, no shadow (the demo has none)');
  assert.doesNotMatch(c, /height: 960/, 'no fixed 9:16 box — the plate grows with its stops');
  assert.equal((c.match(/overflow-hidden/g) ?? []).length, 1, 'nothing clipped but the bar’s own track');
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
  assert.match(c, /data-day-hook>\{hookWords\(dayFailed \? null : N\)\}/, 'the hook line under the place — the stops unknown while the day read failed');
  assert.match(c, /data-day-hero-word>\{heroWord\(day, today\)\}/, '"today" only on today; "planned" on another day');
  // The rows: the mark, the time or '—', the bold and the place at the reel's sizes (two thirds of the demo's 46/42/34), wrapping, never clipped.
  assert.match(c, /style=\{\{ width: 22, fontSize: 26, lineHeight: 1 \}\}><Mark status=\{s\.status\} \/><\/span>/, 'the ✓/✕ mark');
  assert.match(c, /style=\{\{ width: 87, fontSize: 28 \}\}>\{s\.time === null \? '—' : s\.time\}<\/span>/, 'the time, or — when nothing states one');
  assert.match(c, /className="font-bold text-text-primary break-words" style=\{\{ fontSize: 31, lineHeight: 1\.05 \}\} data-day-bold>\{boldOf\(s\)\}/, 'the line or the name, 31 px, wrapping');
  assert.match(c, /\{smallOf\(s\) !== null && <span className="font-medium text-text-muted break-words" style=\{\{ fontSize: 23, lineHeight: 1\.1 \}\} data-day-small>\{smallOf\(s\)\}<\/span>\}/, 'the place under it, 23 px');
  assert.match(c, /style=\{\{ fontSize: 69, lineHeight: 1, letterSpacing: '-0\.02em' \}\} data-day-planned/, 'the hero at 69 px');
  assert.match(c, /style=\{\{ fontSize: 27, lineHeight: 1\.15 \}\} data-day-hook/, 'the hook at 27 px');
  assert.doesNotMatch(c, /truncate/, 'nothing is cut on the recorded plate');
  // The rows: every amount through planDollars — '—' for null, never $0.00 for a blank; the row is a real button that pushes ?step=.
  assert.match(c, /data-day-amount>\{planDollars\(s\.cents\)\}/);
  assert.match(c, /\{s\.actualCents !== null && <span className=\{`font-semibold tabular-nums text-right \$\{actualTone\(deltaWords\(s\.actualCents, s\.cents\)\.over\)\}`\} style=\{\{ fontSize: 21, lineHeight: 1\.05 \}\} data-day-actual>\{rowActualWords\(s\.actualCents, s\.cents\)\}<\/span>\}/, 'STOP-01: the actual under the plan, red over, green under or on');
  assert.match(c, /data-day-amount>\{planDollars\(focus\.stop\.cents\)\}/);
  assert.match(c, /<button\n\s*type="button"\n\s*key=\{s\.key\}\n\s*className="[^"]*"\n\s*style=\{\{ padding: '8px 0' \}\}\n\s*data-day-stop=\{s\.key\}\n\s*data-day-status=\{s\.status\}\n\s*onClick=\{\(\) => go\(hrefFor\(day, i \+ 1\)\)\}/, 'a row is a real button that pushes ?step=');
  // The plate's foot: the completeness line counts, the provenance names the source; the sentences sit under the plate.
  assert.match(c, /const reportRead = report !== null && report\.ok;\n\s*const recordsOk = recordsRead !== null && recordsRead\.ok;\n\s*const completeness = completenessWords\(result, stranded\.length, \{ day: !dayFailed, report: reportRead, records: recordsOk \}\);/, 'the plate’s count knows what was not read');
  assert.match(c, /data-day-count>\{completeness\}/);
  assert.equal((c.match(/data-day-provenance>\{provenanceWords\(today, reportRead, recordsOk\)\}/g) ?? []).length, 2, 'the source line on the full card AND on the step card — the records a source too (STOP-01)');
  assert.ok(c.indexOf('data-day-provenance') < c.indexOf('data-day-foot'), 'the provenance is on the plate; the sentences are under it');
  assert.match(c, /\{foot && \(\n\s*<div className="mx-auto space-y-1 text-xs" style=\{\{ width: 540 \}\} data-day-foot>/, 'the sentences under the plate render whenever there is one');
  assert.match(c, /const foot = loaded && \(result\.unmatched\.length > 0 \|\| result\.routineFigures\.length > 0 \|\| result\.linesWithoutStop\.length > 0 \|\| result\.notPlacedToday\.length > 0 \|\| stranded\.length > 0 \|\| refused\.length > 0 \|\| \(report !== null && !report\.ok\) \|\| \(plans !== null && !plans\.listed\) \|\| result\.recordsWithoutStop\.length > 0 \|\| unplacedRecords\.length > 0 \|\| \(recordsRead !== null && !recordsRead\.ok\)\);/);
  assert.match(c, /data-day-lines-without-stop>\{dayFailed \? linesUnreadWords\(result\.linesWithoutStop\) : linesWithoutStopWords\(result\.linesWithoutStop\)\}/);
  assert.match(c, /data-day-routine-figures>\{routineFigureWords\(result\.routineFigures\)\}/);
  assert.match(c, /data-day-stranded>\{strandedWords\(stranded\)\}/);
  assert.match(c, /<RefusedRoutines refused=\{refused\} \/>/);
  // The step card: PLAN and its amount, "so far" and the bar — both null-safe while the report cannot be read.
  assert.match(c, /\{PLAN_WORD\}<\/div>/);
  assert.match(c, /data-day-so-far>\{soFarWords\(plannedCents === null \? null : focus\.soFarCents, plannedCents\)\}/);
  assert.match(c, /const bar = progressPercent\(plannedCents === null \|\| focus === null \? null : focus\.soFarCents, plannedCents\);/, 'the bar is the rules’ percent, once');
  assert.match(c, /\{bar !== null && \(/, 'no bar without a known plan');
  assert.match(c, /className="bg-brand-green rounded-full" style=\{\{ height: 9, width: `\$\{bar\}%` \}\}/);
  for (const attr of ['data-day-card', 'data-day-header', 'data-day-hero', 'data-day-hook', 'data-day-stop=', 'data-day-status=', 'data-day-focus', 'data-day-plate-foot', 'data-day-count', 'data-day-provenance', 'data-day-foot', 'data-day-unmatched', 'data-day-routine-figures', 'data-day-lines-without-stop', 'data-day-not-placed', 'data-day-stranded', 'data-day-report-failed', 'data-day-bad-date', 'data-day-bad-step', 'data-day-failed', 'data-day-so-far', 'data-day-controls', 'data-day-spent', 'data-day-record', 'data-day-status>', 'data-day-actual', 'data-day-delta', 'data-day-rating', 'data-day-note', 'data-day-minutes', 'data-day-spent-so-far', 'data-day-records-without-stop', 'data-day-records-unplaced', 'data-day-records-failed']) {
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
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\/tasks\/day\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
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
  const classes = [...c.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).concat([...c.matchAll(/className=\{`([^`]*)`\}/g)].flatMap((m) => m[1].replace(/\$\{[^}]*\}/g, '').split(/\s+/)));
  const colour = classes.filter((k) => /^(text|bg|border)-/.test(k));
  const allowed = /^(text-text-(primary|secondary|muted|faint)|text-brand-(purple|green|amber|red)|text-left|text-right|text-center|text-xs|text-lg|border-border(-light)?|border-t|border|bg-ts-white|bg-bg-row|bg-brand-gold|bg-brand-green|hover:bg-bg-row)$/;
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
