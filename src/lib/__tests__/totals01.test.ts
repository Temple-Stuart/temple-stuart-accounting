/**
 * TOTALS-01 (2026-10-14) — THE DAY CARD'S TOTALS AT THE BOTTOM: a TOTAL row
 * under the table, the meter and the verdict below it.
 *
 * Alex's ruling: on the FULL card the hero ("$X today") and "Under or Over?"
 * stay on top; the spent line goes — its numbers live in a <tfoot> TOTAL row in
 * the table's five columns (the BUDGET cells shown summed, a "—" adding nothing;
 * the day's spent or "—", never $0, in a row's tone against the BUDGET of the
 * recorded rows); the meter and the verdict, their rules unchanged, sit
 * directly under the table. When the hero's day plan differs from the BUDGET
 * total — the all-day band, lines no stop carries — the fine print under the
 * plate says by how much, computed.
 *
 * Amendment (Alex, 2026-10-15): the meter and the verdict sit directly under
 * the TOTAL row, so they measure ITS two figures — the spent against the BUDGET
 * total (dayTotals budgetCents, the stops' budget), not the hero's plannedCents.
 * An all-day line no stop can record made every such day "under" by it; the
 * off-the-table line names that money. Their rules are unchanged; a null BUDGET
 * total, no meter and no verdict.
 *
 * The rule (dayCard.ts dayTotals) is DRIVEN over the card's own days, built by
 * dayStops; the screen is anchored to its source with comments stripped
 * (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import type { PlanLine } from '../budget/planLines';
import type { StopRecordRow } from '../operations/stopRecord';
import type { StopRole } from '../operations/stopRole';
import type { Routine, RoutineStep, TodayRoutineEntry } from '@/components/workbench/operations/routines/types';
import { BARS_NO_STOP_BUDGET_WORDS, BARS_NOTHING_PLANNED_WORDS, BARS_PLAN_NOT_READ_WORDS, TOTAL_WORD, barsStopsBudgetWords, barsWhyWords, dayMeter, dayStops, dayTotals, dayVerdict, focusStop, overByWords, planBeyondStopsWords, planSoFarWords, progressPercent, spentSoFarWords, type DayCardInput } from '@/components/workbench/operations/day/dayCard';

const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULES = 'src/components/workbench/operations/day/dayCard.ts';

// ── FIXTURES (the day card's own shapes) ────────────────────────────────────

const DAY = '2026-10-11';
const BKK = 'Asia/Bangkok';
const routine = (over: Partial<Routine> & { id: string; name: string; role: StopRole; schedule_rrule: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], ...over,
});
const step = (over: Partial<RoutineStep> & { id: string; routine_id: string; step_order: number; activity: string }): RoutineStep => ({
  user_id: 'u', entity_id: 'P', time_of_day: null, sub_activity: null, location: null, duration_minutes: null,
  notes: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
});
const entry = (r: Routine, expected_at: string): TodayRoutineEntry => ({ routine: r, expected_at, status: 'pending', completion: null });
const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});
// TRAVEL-01b (Alex, 2026-10-31): the input gains `travel` — null here (unread).
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: [], travel: null, ...over });

/** The browser check's day (daycard01's CLEAN_STOPS): four place stops, three priced — $25 + $20 + $30 = $75; the Gym has no plan. */
const STOPS = [
  { id: 'brunch', name: 'Brunch', hour: 11, at: '2026-10-11T04:00:00.000Z', cents: 2500 },
  { id: 'activities', name: 'Activities', hour: 15, at: '2026-10-11T08:00:00.000Z', cents: 2000 },
  { id: 'dinner', name: 'Dinner', hour: 19, at: '2026-10-11T12:00:00.000Z', cents: 3000 },
  { id: 'gym', name: 'Gym', hour: 20, at: '2026-10-11T13:00:00.000Z', cents: null },
] as const;
type Id = (typeof STOPS)[number]['id'];
const HBO_AT = '2026-10-11T01:00:00.000Z';
const hbo = routine({ id: 'hbo', name: 'HBO', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=8;BYMINUTE=0' });
const hboLine = line({ address: { kind: 'routine', id: 'hbo', instant: HBO_AT }, cents: 1100, label: 'HBO', time: '08:00' });

/** The day with these actuals recorded (done records with amounts); null — the records were not read; extra entries and lines on top. */
function day(actuals: Partial<Record<Id, number>> | null, more: { entries?: TodayRoutineEntry[]; lines?: PlanLine[] } = {}) {
  const records = actuals === null ? null : STOPS.filter((s) => actuals[s.id] !== undefined).map((s): StopRecordRow => ({
    id: `rec-${s.id}`, kind: 'routine', target_id: s.id, occurrence_at: s.at, outcome: 'done', done_at: s.at, actual_cents: actuals[s.id] as number, rating: null, note: null, actual_minutes: null,
  }));
  return dayStops(input({
    entries: [...STOPS.map((s) => entry(routine({ id: s.id, name: s.name, role: 'place', schedule_rrule: `FREQ=DAILY;BYHOUR=${s.hour};BYMINUTE=0` }), s.at)), ...(more.entries ?? [])],
    lines: [...STOPS.flatMap((s) => (s.cents === null ? [] : [line({ address: { kind: 'routine', id: s.id, instant: s.at }, cents: s.cents, label: s.name })])), ...(more.lines ?? [])],
    records,
  }));
}

// ── T1 · THE TOTALS, DRIVEN ─────────────────────────────────────────────────

test('T1 the BUDGET total is the BUDGET cells the rows show — a "—" row adds nothing; no row with one is "—", not $0', () => {
  const r = day({});
  assert.deepEqual(r.stops.map((s) => s.cents), [2500, 2000, 3000, null], 'three cells show an amount, the Gym shows "—"');
  assert.equal(dayTotals(r, r.plannedCents).budgetCents, 7500, '$25 + $20 + $30 — the Gym’s "—" adds nothing');
  assert.equal(r.notPriced, 1, 'and the fine print still counts it ("1 not priced")');
  // The amounts not read: every cell is "—", so is the total — unknown, never $0.
  const unread = dayStops(input({ entries: STOPS.map((s) => entry(routine({ id: s.id, name: s.name, role: 'place', schedule_rrule: `FREQ=DAILY;BYHOUR=${s.hour};BYMINUTE=0` }), s.at)), lines: [] }));
  assert.equal(dayTotals(unread, null).budgetCents, null);
});

test('T1 the ACTUAL total is the day’s spent — the recorded actuals summed; "—" while none is recorded or the records unread; never $0', () => {
  assert.equal(dayTotals(day({ brunch: 969 }), 7500).actualCents, 969);
  assert.equal(dayTotals(day({ brunch: 969, activities: 1500, dinner: 2200, gym: 500 }), 7500).actualCents, 5169, 'the Gym’s actual counts in the spent, plan or no plan');
  assert.equal(dayTotals(day({}), 7500).actualCents, null, 'records read, none recorded — "—", not $0');
  assert.equal(dayTotals(day(null), 7500).actualCents, null, 'records not read — "—"');
  assert.equal(dayTotals(day({ gym: 0 }), 7500).actualCents, 0, 'a recorded $0 is an actual');
  for (const r of [day({ brunch: 969 }), day({}), day(null)]) assert.equal(dayTotals(r, 7500).actualCents, r.spentCents === null || r.withActual === 0 ? null : r.spentCents, 'spentCents, as the screen reads it');
});

test('T1 the ACTUAL total’s tone is a row’s — against the BUDGET of the RECORDED rows only; unknown is muted', () => {
  assert.equal(dayTotals(day({ brunch: 969 }), 7500).over, false, '$9.69 against Brunch’s $25 — under (green), though $75 is planned');
  assert.equal(dayTotals(day({ brunch: 3000 }), 7500).over, true, '$30 against Brunch’s $25 — over (red), though the day’s $75 is not reached');
  assert.equal(dayTotals(day({ brunch: 2500 }), 7500).over, false, 'on plan — green, as a row');
  assert.equal(dayTotals(day({ brunch: 969, gym: 500 }), 7500).over, false, '$14.69 against $25 — the Gym’s "—" adds nothing to the budget, its $5 counts in the spent');
  assert.equal(dayTotals(day({ brunch: 2400, gym: 500 }), 7500).over, true, '$29 against $25 — the unplanned $5 tips it over');
  assert.equal(dayTotals(day({ gym: 500 }), 7500).over, null, 'no recorded row shows a budget — unknown, muted');
  assert.equal(dayTotals(day({}), 7500).over, null, 'nothing recorded — muted "—"');
});

test('T1 the hero against the column — every case where the day plan differs from the BUDGET total, and by how much; equal says nothing', () => {
  const plain = day({});
  assert.equal(plain.plannedCents, 7500);
  assert.equal(dayTotals(plain, plain.plannedCents).beyondCents, null, 'equal — no line');
  // (a) an all-day line: in the hero (every line of the day), in the band, on no row.
  const allDay = day({}, { entries: [entry(hbo, HBO_AT)], lines: [hboLine] });
  assert.equal(allDay.plannedCents, 8600);
  assert.equal(allDay.allDayCents, 1100);
  assert.equal(dayTotals(allDay, allDay.plannedCents).budgetCents, 7500);
  assert.equal(dayTotals(allDay, allDay.plannedCents).beyondCents, 1100, 'the band’s $11');
  // (b) a plan line no stop carries.
  const orphan = day({}, { lines: [line({ address: { kind: 'routine', id: 'ghost', instant: HBO_AT }, cents: 300, label: 'Ghost' })] });
  assert.equal(orphan.linesWithoutStop.length, 1);
  assert.equal(dayTotals(orphan, orphan.plannedCents).beyondCents, 300);
  // (c) a line of a stop's kind and id at another instant — unmatched, on no row; the stop shows "—".
  const moved = day({}, { lines: [line({ address: { kind: 'routine', id: 'gym', instant: '2026-10-11T14:00:00.000Z' }, cents: 1200, label: 'Gym' })] });
  assert.equal(moved.unmatched.length, 1);
  assert.equal(dayTotals(moved, moved.plannedCents).budgetCents, 7500, 'the Gym still shows "—"');
  assert.equal(dayTotals(moved, moved.plannedCents).beyondCents, 1200);
  // (d) a routine priced as a whole (its lines carry no amount): the routine's own line is on no row.
  const MORNING_AT = '2026-10-11T00:00:00.000Z';
  const morning = routine({ id: 'morning', name: 'Morning', role: 'none', schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', steps: [step({ id: 'coffee', routine_id: 'morning', step_order: 1, activity: 'Coffee' })] });
  const whole = day({}, { entries: [entry(morning, MORNING_AT)], lines: [line({ address: { kind: 'routine', id: 'morning', instant: MORNING_AT }, cents: 600, label: 'Morning' })] });
  assert.equal(whole.routineFigures.length, 1);
  assert.equal(dayTotals(whole, whole.plannedCents).beyondCents, 600);
  // Every case at once: the difference is the sum of what the table does not show.
  const all = day({}, { entries: [entry(hbo, HBO_AT), entry(morning, MORNING_AT)], lines: [hboLine, line({ address: { kind: 'routine', id: 'morning', instant: MORNING_AT }, cents: 600, label: 'Morning' }), line({ address: { kind: 'routine', id: 'ghost', instant: HBO_AT }, cents: 300, label: 'Ghost' })] });
  assert.equal(dayTotals(all, all.plannedCents).beyondCents, 1100 + 600 + 300);
  // Only all-day money, no priced row: the whole day plan is off the table; the plan unread: nothing is said.
  const onlyBand = dayStops(input({ entries: [entry(hbo, HBO_AT)], lines: [hboLine] }));
  assert.deepEqual([dayTotals(onlyBand, onlyBand.plannedCents).budgetCents, dayTotals(onlyBand, onlyBand.plannedCents).beyondCents], [null, 1100]);
  assert.equal(dayTotals(allDay, null).beyondCents, null, 'the plan not read — no line');
});

test('T1 the words: "$11 more planned off the table (all day / no stop)" — computed, cents kept; less, if ever, said as less', () => {
  assert.equal(TOTAL_WORD, 'TOTAL');
  assert.equal(planBeyondStopsWords(1100), '$11 more planned off the table (all day / no stop)');
  assert.equal(planBeyondStopsWords(507), '$5.07 more planned off the table (all day / no stop)');
  assert.equal(planBeyondStopsWords(-500), '$5 less planned off the table (all day / no stop)', 'a negative line off the table is said as it is, never flipped');
  assert.doesNotMatch(code(RULES).slice(code(RULES).indexOf('export function dayTotals(')), /\bfetch\s*\(|new Date\(\)|from 'react'/, 'the rule stays pure');
});

// TOTALS-01 amendment (Alex, 2026-10-15): moved, not loosened — the cases below were driven against 7500 (the hero, equal to
// the column on this day); they are now driven as the card drives them, against the TOTAL row's BUDGET, and the all-day day
// and the no-BUDGET day are added: there the two inputs part, and the row's own figures win.
test('T1 the meter and the verdict measure the TOTAL row — its ACTUAL against its BUDGET, not the hero’s plan; their rules unchanged', () => {
  /** The meter and the verdict exactly as the card computes them (DayCard.tsx: dayMeter(spent, totals.budgetCents), dayVerdict(result, totals.budgetCents)). */
  const underTheRow = (r: ReturnType<typeof day>) => {
    const t = dayTotals(r, r.plannedCents);
    return { meter: dayMeter(t.actualCents, t.budgetCents), verdict: dayVerdict(r, t.budgetCents) };
  };
  const ALL_UNDER = { brunch: 969, activities: 1500, dinner: 2200, gym: 500 } as const;
  const ALL_OVER = { brunch: 969, activities: 3000, dinner: 3500, gym: 1200 } as const;
  const ON_PLAN = { brunch: 2500, activities: 2000, dinner: 3000, gym: 0 } as const;
  // The plain day: the hero and the column agree ($75), the figures are the ones before the amendment.
  assert.deepEqual(underTheRow(day(ALL_UNDER)), { meter: { percent: 69, over: false }, verdict: { text: '▼ $23.31 under', over: false } });
  assert.deepEqual(underTheRow(day(ALL_OVER)), { meter: { percent: 100, over: true }, verdict: { text: '▲ $11.69 over', over: true } });
  assert.equal(underTheRow(day({ brunch: 969 })).verdict, null, 'one stop recorded — no verdict, the TOTAL row still says $9.69');
  assert.deepEqual(underTheRow(day({ brunch: 969 })).meter, { percent: 13, over: false });
  // The all-day day: the hero is $86 (HBO's $11 in the band), the TOTAL row's BUDGET $75 — the meter and the verdict read the row.
  const band = { entries: [entry(hbo, HBO_AT)], lines: [hboLine] };
  const under = day(ALL_UNDER, band);
  assert.deepEqual([under.plannedCents, dayTotals(under, under.plannedCents).budgetCents], [8600, 7500]);
  assert.deepEqual(underTheRow(under), { meter: { percent: 69, over: false }, verdict: { text: '▼ $23.31 under', over: false } }, 'under by what the stops left, not by the subscription too');
  assert.deepEqual(dayVerdict(under, under.plannedCents), { text: '▼ $34.31 under', over: false }, 'the hero’s plan would have said $11 more under — the money no stop can record');
  const onPlan = day(ON_PLAN, band);
  assert.deepEqual(underTheRow(onPlan), { meter: { percent: 100, over: false }, verdict: { text: 'on budget', over: false } }, 'every stop on plan — on budget, full and green');
  assert.deepEqual(dayVerdict(onPlan, onPlan.plannedCents), { text: '▼ $11 under', over: false }, 'against the hero: "under" by the subscription, every day');
  const over = day(ALL_OVER, band);
  assert.deepEqual(underTheRow(over), { meter: { percent: 100, over: true }, verdict: { text: '▲ $11.69 over', over: true } });
  assert.deepEqual(dayVerdict(over, over.plannedCents), { text: '▲ $0.69 over', over: true }, 'the hero’s plan would have hidden $11 of the overspend');
  // No BUDGET total (no row shows one) — no meter and no verdict, though the hero has a plan and an amount is recorded.
  const GYM_AT = '2026-10-11T13:00:00.000Z';
  const gymOnly = dayStops(input({
    entries: [entry(routine({ id: 'gym', name: 'Gym', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0' }), GYM_AT), entry(hbo, HBO_AT)],
    lines: [hboLine],
    records: [{ id: 'rec-gym', kind: 'routine', target_id: 'gym', occurrence_at: GYM_AT, outcome: 'done', done_at: GYM_AT, actual_cents: 500, rating: null, note: null, actual_minutes: null }],
  }));
  const t = dayTotals(gymOnly, gymOnly.plannedCents);
  assert.deepEqual([gymOnly.plannedCents, t.budgetCents, t.actualCents], [1100, null, 500], 'the row reads TOTAL — | $5; the hero $11');
  assert.deepEqual(underTheRow(gymOnly), { meter: null, verdict: null }, 'no BUDGET total — no meter, no verdict');
  assert.deepEqual(dayVerdict(gymOnly, gymOnly.plannedCents), { text: '▼ $6 under', over: false }, 'the hero’s plan would have judged $5 of Gym against $11 of HBO');
  // The band alone (no stop): nothing to measure.
  const onlyBand = dayStops(input(band));
  assert.deepEqual(underTheRow(onlyBand), { meter: null, verdict: null });
});

// ── T3 · TOTALS-01 AMENDMENT II (Alex, 2026-10-15): THE STEP VIEW AGAINST THE TOTAL ROW'S BUDGET ──
// Every "against the plan" figure of the step view — the plan-so-far line, the plan bar, the spent bar, "over by", the
// spent-so-far line and the why-line — takes totals.budgetCents, exactly as the meter and the verdict did (T1 above).
// Rules unchanged; only their plan input moved. The "· $N all day" note beside the plan-so-far line is unchanged.

/** The step view's figures exactly as DayCard.tsx composes them, with the TOTAL row's BUDGET as the plan. */
function stepView(r: ReturnType<typeof day>, n: number) {
  const budget = dayTotals(r, r.plannedCents).budgetCents;
  const f = focusStop(r, n);
  assert.ok(f !== null, `stop ${n} exists`);
  const spentSoFar = f.spentSoFarCents === null || f.withActualSoFar === 0 ? null : f.spentSoFarCents;
  return {
    planLine: planSoFarWords(budget === null ? null : f.soFarCents, budget),
    planBar: progressPercent(budget === null ? null : f.soFarCents, budget),
    spentLine: spentSoFarWords(spentSoFar, budget),
    spentBar: spentSoFar === null ? null : progressPercent(spentSoFar, budget),
    overBy: spentSoFar === null || budget === null || spentSoFar <= budget ? null : overByWords(spentSoFar - budget),
  };
}

test('T3 the step view measures the TOTAL row’s BUDGET — the plan so far, both bars, the spent so far and "over by"; the hero’s all-day money is not in them', () => {
  const band = { entries: [entry(hbo, HBO_AT)], lines: [hboLine] };
  const under = day({ brunch: 969 }, band);
  assert.deepEqual([under.plannedCents, dayTotals(under, under.plannedCents).budgetCents], [8600, 7500]);
  assert.deepEqual(stepView(under, 1), { planLine: 'plan so far $25 of $75', planBar: 33, spentLine: 'spent so far $9.69 of $75', spentBar: 13, overBy: null },
    'Brunch, the first stop: $25 of the stops’ $75 (33%), not of the hero’s $86 (29%)');
  const over = day({ brunch: 969, activities: 3000, dinner: 3500, gym: 1200 }, band);
  assert.deepEqual(stepView(over, 4), { planLine: 'plan so far $75 of $75', planBar: 100, spentLine: 'spent so far $86.69 of $75', spentBar: 100, overBy: 'over by $11.69' },
    'the last stop: over the stops’ budget by $11.69 — against the hero it would have read $0.69');
  // The plain day — the hero and the column agree — reads as before.
  assert.deepEqual(stepView(day({ brunch: 969 }), 1), { planLine: 'plan so far $25 of $75', planBar: 33, spentLine: 'spent so far $9.69 of $75', spentBar: 13, overBy: null });
});

test('T3 no bars, and why — each answer true: not read; nothing planned; a plan the stops do not carry is off the table, never "nothing is planned"', () => {
  assert.equal(barsWhyWords(null, null), BARS_PLAN_NOT_READ_WORDS, 'the report not read');
  assert.equal(barsWhyWords(0, null), BARS_NOTHING_PLANNED_WORDS, 'nothing planned at all');
  assert.equal(barsWhyWords(0, 0), BARS_NOTHING_PLANNED_WORDS);
  assert.equal(barsWhyWords(1100, null), BARS_NO_STOP_BUDGET_WORDS, 'only all-day money: the hero has $11, no stop is priced');
  assert.equal(BARS_NO_STOP_BUDGET_WORDS, 'no bars — no stop of the day is priced; the day’s plan is off the table (all day / no stop)');
  assert.equal(barsWhyWords(1100, 0), barsStopsBudgetWords(0));
  assert.equal(barsStopsBudgetWords(0), 'no bars — the stops’ budget is $0; the day’s plan is off the table (all day / no stop)');
  assert.throws(() => barsWhyWords(8600, 7500), /draws the bars/, 'a positive BUDGET total draws the bars — asking why there are none is the caller’s error');
  // Driven: a day whose one stop (the Gym) is unpriced and whose only money is the all-day HBO line — the step view draws no bars.
  const GYM_AT = '2026-10-11T13:00:00.000Z';
  const gymOnly = dayStops(input({
    entries: [entry(routine({ id: 'gym', name: 'Gym', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0' }), GYM_AT), entry(hbo, HBO_AT)],
    lines: [hboLine],
  }));
  const budget = dayTotals(gymOnly, gymOnly.plannedCents).budgetCents;
  const f = focusStop(gymOnly, 1);
  assert.ok(f !== null);
  assert.equal(progressPercent(budget === null ? null : f.soFarCents, budget), null, 'no plan bar');
  assert.equal(barsWhyWords(gymOnly.plannedCents, budget), BARS_NO_STOP_BUDGET_WORDS, 'the hero’s $11 is off the table — not "nothing is planned for the day"');
});

test('T3 the screen: every step-view figure takes totals.budgetCents; none takes the hero’s plannedCents; the all-day note is unchanged', () => {
  const c = code(CARD);
  // DECK-01 (Alex, 2026-10-16): moved, not loosened — the three figures are barsOf(f), one object per stop card of the deck, the same
  // expressions with the card's focus handed in (f); every one still takes totals.budgetCents.
  assert.match(c, /const barsOf = \(f: Focus\) => \(\{\n\s*planBar: progressPercent\(totals\.budgetCents === null \? null : f\.soFarCents, totals\.budgetCents\),\n\s*spentBar: f\.spentSoFarCents === null \|\| f\.withActualSoFar === 0 \? null : progressPercent\(f\.spentSoFarCents, totals\.budgetCents\),\n\s*overCents: f\.spentSoFarCents === null \|\| f\.withActualSoFar === 0 \|\| totals\.budgetCents === null \|\| f\.spentSoFarCents <= totals\.budgetCents \? null : f\.spentSoFarCents - totals\.budgetCents,\n\s*\}\);/);
  assert.match(c, /const planBar = focus === null \? null : barsOf\(focus\)\.planBar;/);
  assert.match(c, /data-day-plan-so-far>\{planSoFarWords\(totals\.budgetCents === null \? null : f\.soFarCents, totals\.budgetCents\)\}\{plannedCents !== null && result\.allDayCents > 0 && <span className="font-medium text-text-muted" data-day-so-far-all-day> · \{allDayCentsWords\(planDollars\(result\.allDayCents\)\)\}<\/span>\}/, 'the line on the budget; its all-day note as it was');
  // REEL-01 (Alex, 2026-10-15): moved, not loosened — the line is stepSpentSoFarWords(focus, totals.budgetCents), whose body is this expression.
  assert.match(c, /data-day-spent-so-far>\{stepSpentSoFarWords\(f, totals\.budgetCents\)\}/);
  assert.match(code(RULES), /export const stepSpentSoFarWords = \(focus: Pick<Focus, 'spentSoFarCents' \| 'withActualSoFar'>, budgetCents: number \| null\): string =>\n\s*spentSoFarWords\(focus\.spentSoFarCents === null \|\| focus\.withActualSoFar === 0 \? null : focus\.spentSoFarCents, budgetCents\);/, 'the same words, the same null — one rule for the line and the tag');
  assert.match(c, /\{focus !== null && planBar === null && <p data-day-bars-why>\{barsWhyWords\(plannedCents, totals\.budgetCents\)\}<\/p>\}/);
  for (const call of [/progressPercent\([^,]*plannedCents[^)]*\)/, /planSoFarWords\([^)]*plannedCents[^)]*\)/, /spentSoFarWords\([^)]*plannedCents[^)]*\)/, /overCents: [^,]*plannedCents/]) {
    assert.doesNotMatch(c, call, `no step-view figure is of the hero’s plannedCents: ${call}`);
  }
  // The totals are read before the step view's figures that use them.
  assert.ok(c.indexOf('const totals = dayTotals(result, plannedCents);') < c.indexOf('const barsOf = '), 'the TOTAL row first, then the bars that measure it');
  assert.match(comments(RULES), /TOTALS-01 amendment II \(Alex, 2026-10-15\): why the step view draws no bars/);
});

// ── T2 · THE SCREEN ─────────────────────────────────────────────────────────

test('T2 the full card, top to bottom: where, the hero, the hook, the table and its TOTAL row, the meter, the verdict — the spent line gone', () => {
  const c = code(CARD);
  // DECK-01 (Alex, 2026-10-16): the full card's body is fullPlate (to `const under`), handed to the deck's first card.
  const full = c.slice(c.indexOf('const fullPlate = ('), c.indexOf('const under = '));
  const at = (s: string) => { const i = full.indexOf(s); assert.ok(i >= 0, `${s} is on the full card`); return i; };
  const order = ['data-day-where>', 'data-day-hero>', 'data-day-hook>{HOOK_WORDS}</div>', 'data-day-stops>', '<thead>', '<tbody>', '<tfoot>', 'data-day-total>', '</table>', 'data-day-meter=', 'data-day-verdict>', 'data-day-all-day>'];
  for (let i = 1; i < order.length; i += 1) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  assert.doesNotMatch(c, /data-day-spent>|spentOutOfWords/, 'no spent line');
  for (const f of [CARD, RULES]) assert.doesNotMatch(code(f), /spentOutOfWords|SPENT_WORD|PLANNED_NOT_READ_WORDS/, `${f} keeps none of its words`);
  // TOTALS-01 amendment (Alex, 2026-10-15): moved, not loosened — the meter and the verdict are given the TOTAL row's BUDGET, not plannedCents.
  assert.match(c, /const totals = dayTotals\(result, plannedCents\);\n\s*const spent = totals\.actualCents;\n\s*const meter = dayMeter\(spent, totals\.budgetCents\);\n\s*const verdict = dayVerdict\(result, totals\.budgetCents\);/, 'one rule for the row, the meter and the verdict: the row’s ACTUAL against the row’s BUDGET');
});

test('T2 the TOTAL row: a <tfoot> in the five columns — TOTAL across TIME to DESCRIPTION, the BUDGET and ACTUAL totals bold, the ACTUAL in a row’s tone, above the closing rule', () => {
  const c = code(CARD);
  const foot = /<tfoot>([\s\S]*?)<\/tfoot>/.exec(c);
  assert.ok(foot !== null, 'one foot row group');
  assert.equal((c.match(/<tfoot>/g) ?? []).length, 1);
  const f = foot![1];
  assert.match(f, /<tr className="border-t border-border align-top" data-day-total>/);
  assert.match(f, /<th scope="row" colSpan=\{3\} className="text-left font-extrabold text-text-primary" style=\{\{ fontSize: 19, lineHeight: 1\.1, padding: CELL_PADDING \}\} data-day-col="total">\{TOTAL_WORD\}<\/th>/, 'TOTAL spans TIME, VENDOR and DESCRIPTION');
  assert.match(f, /<td className="text-right" style=\{\{ padding: CELL_PADDING \}\} data-day-col="budget">\n\s*<span className=\{`block font-extrabold tabular-nums \$\{totals\.budgetCents === null \? 'text-text-faint' : 'text-text-primary'\}`\} style=\{\{ fontSize: 19, lineHeight: 1\.1 \}\} data-day-total-budget>\{planDollars\(totals\.budgetCents\)\}<\/span>/, 'the BUDGET total, bold, in the BUDGET column — a row’s cell');
  assert.match(f, /<td className="text-right" style=\{\{ padding: '7px 0' \}\} data-day-col="actual">\n\s*<span className=\{`block font-extrabold tabular-nums \$\{totals\.actualCents === null \? 'text-text-faint' : actualTone\(totals\.over\)\}`\} style=\{\{ fontSize: 19, lineHeight: 1\.1 \}\} data-day-total-actual>\{planDollars\(totals\.actualCents\)\}<\/span>/, 'the ACTUAL total, bold, "—" faint when unknown, else a row’s tone');
  assert.deepEqual([...f.matchAll(/data-day-col="(\w+)"/g)].map((m) => m[1]), ['total', 'budget', 'actual'], 'three cells over five columns');
  // Above the closing rule: the table ends, then the rule.
  assert.match(c, /<\/tfoot>\n\s*<\/table>\n\s*<div className="border-t border-border" aria-hidden="true" \/>/);
  // Inside the plate — "download image" renders the plate (plateRef), so the PNG carries the row.
  const plateOpen = c.lastIndexOf('<div', c.indexOf('data-day-card'));
  assert.ok(c.indexOf('<tfoot>') > plateOpen && c.indexOf('<tfoot>') < c.indexOf('data-day-image>'), 'the TOTAL row is on the plate, before the download block under it');
  assert.match(c, /<div ref=\{plateRef\}/);
});

test('T2 the fine print under the plate says the day plan beyond the BUDGET total, only when the two differ', () => {
  const c = code(CARD);
  assert.match(c, /\{focus === null && completeness !== null && <p data-day-count>\{completeness\}<\/p>\}\n\s*\{\s*\}\n\s*\{focus === null && totals\.beyondCents !== null && <p data-day-beyond>\{planBeyondStopsWords\(totals\.beyondCents\)\}<\/p>\}/, 'after the count, on the full card, only when there is a difference');
  const plateOpen = c.lastIndexOf('<div', c.indexOf('data-day-card'));
  assert.ok(c.indexOf('data-day-beyond>') > c.indexOf('data-day-fine-print>') && c.indexOf('data-day-fine-print>') > plateOpen, 'under the plate, in the fine print');
  assert.match(comments(RULES), /TOTALS-01 \(2026-10-14, Alex's ruling\): the full card's totals at the bottom/);
});
