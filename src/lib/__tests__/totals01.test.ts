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
import { TOTAL_WORD, dayMeter, dayStops, dayTotals, dayVerdict, planBeyondStopsWords, type DayCardInput } from '@/components/workbench/operations/day/dayCard';

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
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: [], ...over });

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

test('T1 the meter and the verdict keep their rules — the totals change where they sit, not what they say', () => {
  const under = day({ brunch: 969, activities: 1500, dinner: 2200, gym: 500 });
  assert.deepEqual(dayMeter(dayTotals(under, 7500).actualCents, 7500), { percent: 69, over: false });
  assert.deepEqual(dayVerdict(under, 7500), { text: '▼ $23.31 under', over: false });
  const over = day({ brunch: 969, activities: 3000, dinner: 3500, gym: 1200 });
  assert.deepEqual(dayMeter(dayTotals(over, 7500).actualCents, 7500), { percent: 100, over: true });
  assert.deepEqual(dayVerdict(over, 7500), { text: '▲ $11.69 over', over: true });
  assert.equal(dayVerdict(day({ brunch: 969 }), 7500), null, 'one stop recorded — no verdict, the TOTAL row still says $9.69');
});

// ── T2 · THE SCREEN ─────────────────────────────────────────────────────────

test('T2 the full card, top to bottom: where, the hero, the hook, the table and its TOTAL row, the meter, the verdict — the spent line gone', () => {
  const c = code(CARD);
  const full = c.slice(c.indexOf('{loaded && focus === null && ('), c.indexOf('{loaded && focus !== null && ('));
  const at = (s: string) => { const i = full.indexOf(s); assert.ok(i >= 0, `${s} is on the full card`); return i; };
  const order = ['data-day-where>', 'data-day-hero>', 'data-day-hook>{HOOK_WORDS}</div>', 'data-day-stops>', '<thead>', '<tbody>', '<tfoot>', 'data-day-total>', '</table>', 'data-day-meter=', 'data-day-verdict>', 'data-day-all-day>'];
  for (let i = 1; i < order.length; i += 1) assert.ok(at(order[i - 1]) < at(order[i]), `${order[i - 1]} before ${order[i]}`);
  assert.doesNotMatch(c, /data-day-spent>|spentOutOfWords/, 'no spent line');
  for (const f of [CARD, RULES]) assert.doesNotMatch(code(f), /spentOutOfWords|SPENT_WORD|PLANNED_NOT_READ_WORDS/, `${f} keeps none of its words`);
  assert.match(c, /const totals = dayTotals\(result, plannedCents\);\n\s*const spent = totals\.actualCents;\n\s*const meter = dayMeter\(spent, plannedCents\);\n\s*const verdict = dayVerdict\(result, plannedCents\);/, 'one rule for the row and the meter; the verdict’s rule unchanged');
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
