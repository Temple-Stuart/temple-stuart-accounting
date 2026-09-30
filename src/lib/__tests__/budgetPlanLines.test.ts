/**
 * TAB13-04 (2026-09-29) — THE DAY'S PLAN AND ITS VENDORS.
 *
 * T1 drives days.ts's one key format — built and read back, each kind — and pins
 * that the builders and VENDOR-01's rule use it. T2 drives the pure module
 * (src/lib/budget/planLines.ts) over plans /budget's own builders build — a set
 * like Alex's: two meal lines a day, a stepless coffee, a monthly bill, a task —
 * and vendor rows as the route reads them. T6's law pin is here too. This file
 * imports nothing from @prisma/client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { viewRange, type BudgetView } from '../budget/report';
import {
  buildRoutineBudgetLines, buildTaskBudgetLines, occurrenceKey, readOccurrenceKey, wholeRoutineKey,
  type RoutinePlanInput, type TaskPlanInput,
} from '../budget/days';
import {
  STRANDED_WORDS, YEAR_WORDS, dayPlanOf, planDays, vendorWindow,
  type DayPlan, type PlanVendorRow, type RoutineWords,
} from '../budget/planLines';
import { toRoutineBudgetInput, type RoutineBudgetRow } from '../operations/routineBudgetInputs';

const LA = 'America/Los_Angeles';
const MEALS = '10000000-0000-4000-8000-000000000001';
const LUNCH = '20000000-0000-4000-8000-000000000001';
const DINNER = '20000000-0000-4000-8000-000000000002';
const SNACK = '20000000-0000-4000-8000-000000000003';
const COFFEE = '10000000-0000-4000-8000-000000000002';
const NETFLIX = '10000000-0000-4000-8000-000000000003';
const BRAKES = '30000000-0000-4000-8000-000000000001';

const base = { entityId: 'ent-p', entityType: 'personal', timezone: LA, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [] } as const;
const meals: RoutinePlanInput = {
  ...base, id: MEALS, name: 'Meals', scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0',
  steps: [
    { id: LUNCH, isActive: true, stepOrder: 0, budgetAmount: '20.00', coaCode: 'P-6150' },
    { id: DINNER, isActive: true, stepOrder: 1, budgetAmount: '35.00', coaCode: 'P-6150' },
    { id: SNACK, isActive: true, stepOrder: 2, budgetAmount: '4.00', coaCode: 'P-6150' },
  ],
};
const coffee: RoutinePlanInput = { ...base, id: COFFEE, name: 'Coffee', scheduleRrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0', budgetAmount: '5.00', coaCode: 'P-6150' };
const netflix: RoutinePlanInput = { ...base, id: NETFLIX, name: 'Netflix', scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=29;BYHOUR=9;BYMINUTE=0;BYSECOND=0', budgetAmount: '15.49', coaCode: 'P-6300' };
const brakes: TaskPlanInput = { id: BRAKES, title: 'Brakes', entityId: 'ent-p', entityType: 'personal', status: 'open', estimatedCostUsd: '480.00', coaCode: 'P-6400', planItems: [{ planDate: '2026-09-29', blocks: [{ status: 'scheduled' }] }] };

// The words the loader reads: each line's activity and its own time — the snack has none.
const WORDS = new Map<string, RoutineWords>([
  [MEALS, { name: 'Meals', timezone: LA, steps: new Map([[LUNCH, { activity: 'Lunch', timeOfDay: '12:30' }], [DINNER, { activity: 'Dinner', timeOfDay: '19:00' }], [SNACK, { activity: 'Snack', timeOfDay: null }]]) }],
  [COFFEE, { name: 'Coffee', timezone: LA, steps: new Map() }],
  [NETFLIX, { name: 'Netflix', timezone: LA, steps: new Map() }],
]);
const TITLES = new Map([[BRAKES, 'Brakes']]);

const DAY: BudgetView = { kind: 'day', day: '2026-09-29' };
const WEEK: BudgetView = { kind: 'week', weekOf: '2026-09-29' };
const YEAR: BudgetView = { kind: 'year', year: 2026 };
// 12:00 in Los Angeles on the 29th — the meals' occurrence.
const NOON_29 = new Date('2026-09-29T19:00:00.000Z');

function plan(view: BudgetView, vendors: readonly PlanVendorRow[] | null, routines: RoutinePlanInput[] = [meals, coffee, netflix], words = WORDS) {
  const { rangeFrom, rangeTo } = viewRange(view);
  const r = buildRoutineBudgetLines(routines, rangeFrom, rangeTo);
  const t = buildTaskBudgetLines([brakes], rangeFrom, rangeTo);
  return dayPlanOf({ view, lines: [...r.lines, ...t.lines], notPlaced: [...r.notPlaced, ...t.notPlaced], routines: words, tasks: TITLES, vendors });
}
const listed = (result: ReturnType<typeof plan>): Extract<DayPlan, { listed: true }> => {
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.ok(result.plan.listed);
  return result.plan;
};

const vendorRow = (over: Partial<PlanVendorRow> & { name: string }): PlanVendorRow => ({
  id: `pv-${over.name}`, routine_id: null, step_id: null, task_id: null, occurrence_at: null,
  vendor: { id: `v-${over.name}`, vendor_name: over.name, entity_id: 'ent-p' },
  routine: null, step: null, task: null,
  ...over,
});
const lineRow = (step: string, activity: string, at: Date, name: string, zone = LA): PlanVendorRow =>
  vendorRow({ name, step_id: step, occurrence_at: at, step: { activity, routine_id: MEALS, routine: { name: 'Meals', timezone: zone } } });

// ── T1 · ONE FORMAT ──────────────────────────────────────────────────────────

test('T1 the occurrence key is built and read back by days.ts — each kind, the address the vendor routes speak', () => {
  const line = occurrenceKey({ routineId: MEALS, lineId: LUNCH, instant: NOON_29 });
  assert.equal(line, `routine:${MEALS}:line:${LUNCH}:2026-09-29T19:00:00.000Z`);
  assert.deepEqual(readOccurrenceKey(line), { address: { kind: 'routine_line', id: LUNCH, instant: NOON_29 }, routineId: MEALS });
  const stepless = occurrenceKey({ routineId: COFFEE, lineId: null, instant: NOON_29 });
  assert.equal(stepless, `routine:${COFFEE}:routine:2026-09-29T19:00:00.000Z`);
  assert.deepEqual(readOccurrenceKey(stepless), { address: { kind: 'routine', id: COFFEE, instant: NOON_29 }, routineId: COFFEE });
  const task = occurrenceKey({ taskId: BRAKES });
  assert.equal(task, `task:${BRAKES}`);
  assert.deepEqual(readOccurrenceKey(task), { address: { kind: 'project_task', id: BRAKES, instant: null }, routineId: null });
  // Not an occurrence's key: the whole routine, an instant not written as the builder writes it, anything else.
  assert.equal(readOccurrenceKey(wholeRoutineKey(COFFEE)), null);
  assert.equal(readOccurrenceKey(`routine:${COFFEE}:routine:2026-09-29T19:00:00Z`), null, 'the exact toISOString form only');
  assert.equal(readOccurrenceKey(`routine:${COFFEE}:line:${LUNCH}:not-a-time`), null);
  assert.equal(readOccurrenceKey('trip:abc'), null);
  // Every key the builders write reads back.
  const { rangeFrom, rangeTo } = viewRange(WEEK);
  const built = buildRoutineBudgetLines([meals, coffee, netflix, { ...coffee, id: 'r-bad', timezone: 'Mars/Olympus' }], rangeFrom, rangeTo);
  for (const l of built.lines) assert.ok(readOccurrenceKey(l.sourceId) !== null, l.sourceId);
  assert.ok(built.notPlaced.some((n) => n.sourceId === wholeRoutineKey('r-bad')), 'the whole routine keeps its own key');
  for (const l of buildTaskBudgetLines([brakes], rangeFrom, rangeTo).lines) assert.equal(readOccurrenceKey(l.sourceId)?.address.kind, 'project_task');
});

test('T1 the builders use the one function, and VENDOR-01\'s rule asks days.ts — no second copy of the format', () => {
  const days = code('src/lib/budget/days.ts');
  assert.match(days, /const sourceId = occurrenceKey\(\{ routineId: routine\.id, lineId: item\.lineId, instant \}\);/);
  assert.match(days, /sourceId: occurrenceKey\(\{ taskId: task\.id \}\)/);
  assert.match(days, /sourceId: wholeRoutineKey\(routine\.id\)/);
  assert.equal((days.match(/`routine:\$\{/g) ?? []).length, 2, 'written in occurrenceKey and wholeRoutineKey, nowhere else');
  assert.equal((days.match(/`task:\$\{/g) ?? []).length, 1);
  const rule = code('src/lib/operations/planVendor.ts');
  assert.doesNotMatch(rule, /`routine:|`task:|occurrenceSourceId/, 'the rule builds no key of its own');
  assert.match(rule, /const key = occurrenceKey\(\{ routineId: routine\.id, lineId: address\.kind === 'routine_line' \? address\.id : null, instant: address\.instant \}\);/);
  assert.match(rule, /n\.sourceId === wholeRoutineKey\(routine\.id\)/);
});

// ── T2 · THE DAY'S PLAN ──────────────────────────────────────────────────────

test('T2 a DAY lists the day\'s lines — not the month to date the MTD column spans — each with its label, line, time, amount and address', () => {
  const day = listed(plan(DAY, []));
  assert.deepEqual(day.days, ['2026-09-29']);
  assert.ok(day.lines.every((l) => l.day === '2026-09-29'), 'the builder built the month to date; the plan lists the day');
  // By time — a stated time first, in order — then by label; a line with no time last.
  assert.deepEqual(day.lines.map((l) => [l.time, l.label, l.line, l.cents, l.code, l.source]), [
    ['08:00', 'Coffee', null, 500, '6150', 'routine'],
    ['09:00', 'Netflix', null, 1549, '6300', 'routine'],
    ['12:30', 'Meals', 'Lunch', 2000, '6150', 'routine'],
    ['19:00', 'Meals', 'Dinner', 3500, '6150', 'routine'],
    [null, 'Brakes', null, 48000, '6400', 'task'],
    [null, 'Meals', 'Snack', 400, '6150', 'routine'],
  ]);
  const lunch = day.lines.find((l) => l.line === 'Lunch')!;
  assert.deepEqual(lunch.address, { kind: 'routine_line', id: LUNCH, instant: '2026-09-29T19:00:00.000Z' });
  assert.deepEqual(day.lines.find((l) => l.label === 'Coffee')!.address, { kind: 'routine', id: COFFEE, instant: '2026-09-29T15:00:00.000Z' });
  assert.deepEqual(day.lines.find((l) => l.label === 'Brakes')!.address, { kind: 'project_task', id: BRAKES, instant: null });
  // A line with no time_of_day has none — never the routine's 12:00 in its place.
  assert.equal(day.lines.find((l) => l.line === 'Snack')!.time, null);
});

test('T2 a WEEK lists its seven days\' lines', () => {
  const week = listed(plan(WEEK, []));
  assert.deepEqual(week.days, ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  const perDay = week.days.map((d) => week.lines.filter((l) => l.day === d).length);
  assert.deepEqual(perDay, [4, 6, 4, 4, 4, 4, 4], 'coffee and three meal lines a day; the 29th adds the bill and the task');
  assert.equal(week.lines.length, 30);
  assert.deepEqual(week.stranded, []);
});

test('T2 the vendor by the plan\'s ONE grain: none, every time, this occurrence — another occurrence\'s is never shown on this one', () => {
  const every = vendorRow({ name: 'Netflix Inc', routine_id: NETFLIX, routine: { name: 'Netflix', timezone: LA } });
  const pho = lineRow(LUNCH, 'Lunch', NOON_29, 'Pho 24');
  const week = listed(plan(WEEK, [every, pho]));
  const bill = week.lines.find((l) => l.label === 'Netflix')!;
  assert.deepEqual(bill.vendor, { id: 'v-Netflix Inc', name: 'Netflix Inc', entityId: 'ent-p', grain: 'every' });
  const lunches = week.lines.filter((l) => l.line === 'Lunch');
  assert.deepEqual(lunches.map((l) => (l.vendor === null ? null : `${l.day}:${l.vendor.name}:${l.vendor.grain}`)), [null, '2026-09-29:Pho 24:occurrence', null, null, null, null, null]);
  assert.ok(week.lines.filter((l) => l.line === 'Dinner').every((l) => l.vendor === null), 'the lunch vendor is the lunch line\'s — never the dinner\'s');
  assert.ok(week.lines.filter((l) => l.label === 'Coffee').every((l) => l.vendor === null), 'none → none');
});

test('T2 a plan found holding both grains is refused by name — never resolved by picking one', () => {
  const every = vendorRow({ name: 'Every', step_id: LUNCH, step: { activity: 'Lunch', routine_id: MEALS, routine: { name: 'Meals', timezone: LA } } });
  const one = lineRow(LUNCH, 'Lunch', NOON_29, 'One');
  for (const rows of [[every, one], [one, every]]) {
    const r = plan(DAY, rows);
    assert.ok(!r.ok && r.code === 'plan-vendor-both-grains', JSON.stringify(r));
    assert.match(r.ok ? '' : r.message, /holds "Every" for every occurrence AND "One" at 2026-09-29T19:00:00\.000Z/);
  }
});

test('T2 stranded: a row on a day of the view that matches nothing is listed; one matching a neighbour day\'s occurrence, or outside the view, is not; an unreadable zone is listed undated', () => {
  const offByMinute = lineRow(LUNCH, 'Lunch', new Date('2026-09-29T19:01:00.000Z'), 'Pho 24');
  const neighbour = lineRow(LUNCH, 'Lunch', new Date('2026-09-28T19:00:00.000Z'), 'Banh Mi 25');
  const outside = lineRow(LUNCH, 'Lunch', new Date('2026-10-15T19:00:00.000Z'), 'Far away');
  const matched = lineRow(LUNCH, 'Lunch', NOON_29, 'Matched');
  const badZone = vendorRow({ name: 'Ghost', routine_id: COFFEE, occurrence_at: NOON_29, routine: { name: 'Coffee', timezone: 'Mars/Olympus' } });
  const day = listed(plan(DAY, [offByMinute, neighbour, outside, matched, badZone]));
  assert.deepEqual(day.stranded.map((s) => [s.vendor.name, s.label, s.line, s.day, s.time]), [
    ['Pho 24', 'Meals', 'Lunch', '2026-09-29', '12:01'],
    ['Ghost', 'Coffee', null, null, null],
  ]);
  assert.equal(day.stranded[0].reason, STRANDED_WORDS);
  assert.deepEqual(day.stranded[0].address, { kind: 'routine_line', id: LUNCH, instant: '2026-09-29T19:01:00.000Z' });
  assert.match(day.stranded[1].reason, /^its routine's zone "Mars\/Olympus" cannot be read \(.+\) — this vendor cannot be dated$/);
  // A vendor on an occurrence the view built but did not place — its account unreadable — is not stranded.
  const unreadable: RoutinePlanInput = { ...meals, steps: [{ id: LUNCH, isActive: true, stepOrder: 0, budgetAmount: '20.00', coaCode: 'B-6150' }] };
  assert.deepEqual(listed(plan(DAY, [matched], [unreadable])).stranded, [], 'placed or not placed, the view built it');
});

test('T2 a YEAR lists no plan lines — in words — and the route\'s rows must match the view', () => {
  assert.deepEqual(plan(YEAR, null), { ok: true, plan: { listed: false, words: YEAR_WORDS } });
  assert.equal(YEAR_WORDS, 'a year lists no plan lines — open a day or a week');
  const yearWithRows = plan(YEAR, []);
  assert.ok(!yearWithRows.ok && yearWithRows.code === 'plan-vendors-read-for-year');
  const dayWithout = plan(DAY, null);
  assert.ok(!dayWithout.ok && dayWithout.code === 'plan-vendors-not-read');
  assert.equal(planDays(YEAR), null);
  assert.equal(vendorWindow(YEAR), null);
  // The route's read: [first day − 1 day, last day + 2 days) — every zone's local days.
  assert.deepEqual(vendorWindow(DAY), { from: new Date('2026-09-28T00:00:00.000Z'), to: new Date('2026-10-01T00:00:00.000Z') });
  assert.deepEqual(vendorWindow(WEEK), { from: new Date('2026-09-27T00:00:00.000Z'), to: new Date('2026-10-06T00:00:00.000Z') });
});

test('T2 the loader reads a line\'s words once: its activity, and its @db.Time as HH:MM from the UTC parts (ics.ts)', () => {
  const row = {
    id: 'r', name: 'Meals', end_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY', timezone: LA, start_date: null,
    steps: [
      { id: LUNCH, is_active: true, budget_amount: null, coa_code: null, step_order: 0, activity: 'Lunch', time_of_day: new Date('1970-01-01T12:30:00.000Z') },
      { id: SNACK, is_active: true, budget_amount: null, coa_code: null, step_order: 1, activity: 'Snack', time_of_day: null },
    ],
  } as unknown as RoutineBudgetRow;
  assert.deepEqual(toRoutineBudgetInput(row).steps.map((s) => [s.activity, s.time_of_day]), [['Lunch', '12:30'], ['Snack', null]]);
  assert.match(code('src/lib/operations/routineBudgetInputs.ts'), /steps: \{ where: \{ is_active: true \}, select: \{ id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true \} \}/);
});

// ── T6 · THE LAWS ────────────────────────────────────────────────────────────

test('T6 the budget route law carries clause 6 — the one input — and the purity law\'s comment no longer names the strip', () => {
  const lawComments = comments('scripts/assert-tool-registry.ts');
  assert.match(lawComments, /6\. THE ONE INPUT \(TAB13-04, 2026-09-29\)\. In a Budget file, every fetch that\s+\/\/\s+writes/);
  assert.doesNotMatch(lawComments, /the strip's counts/);
  const law = code('scripts/assert-tool-registry.ts');
  assert.match(law, /const BR_WRITES_ALLOWED: Readonly<Record<string, readonly string\[\]>> = \{ '\/api\/operations\/plan-vendors': \['POST', 'DELETE'\], '\/api\/operations\/vendor-directory': \['POST'\] \};/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetPlanLines.test.ts'), /['"]@prisma\/client/);
});
