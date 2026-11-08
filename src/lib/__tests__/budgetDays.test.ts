import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildRoutineBudgetLines, buildTaskBudgetLines, parseBudgetCode, centsFromDecimalString, centsFromDollars,
  BudgetDaysError, NOT_PLACED_REASONS, EXCLUDED_TASK_STATUSES,
  type BudgetDaysErrorCode, type NotPlaced, type RoutinePlanInput, type TaskPlanInput,
} from '../budget/days';
// SUPERSEDE-01b (Alex, 2026-11-08, ruling C): the one expansion, the windows and the marks — and what they are built from.
import { dayWindow, occurrenceKey, routineOccurrencesOf, routineSupersessionOf, type RoutineLinePlanInput } from '../budget/days';
import { expandBetween, scheduleAnchor } from '../operations/rruleHelpers';
import { recordKey } from '../operations/stopRecord';
import type { TravelBlock } from '../operations/supersession';
import { buildBudgetReport, markLines, viewRange, BudgetReportError, type BudgetLine } from '../budget/report';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { parseCode } from '../coa/scheme';
import { ValidationError } from '../errors/ValidationError';
import { code } from '../sourceText';

// TAB13-02a — the day rules, pure. Tests named for the rule they pin. Every
// expected figure is integer cents, worked by hand beside it. This file imports
// nothing from @prisma/client.

const DAYS = 'src/lib/budget/days.ts';
const DAILY_08 = 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0';

const routine = (over: Partial<RoutinePlanInput> & { id: string }): RoutinePlanInput => ({
  name: `Routine ${over.id}`, entityId: 'ent-p', entityType: 'personal', timezone: 'UTC', scheduleRrule: DAILY_08,
  startDate: '2026-01-01', endDate: null, budgetAmount: 15, coaCode: '6150', steps: [], startTime: null, endTime: null, ...over,
});
const task = (over: Partial<TaskPlanInput> & { id: string }): TaskPlanInput => ({
  title: `Task ${over.id}`, entityId: 'ent-p', entityType: 'personal', status: 'open', estimatedCostUsd: '50.00', coaCode: '6300', planItems: [], ...over,
});
const planned = (planDate: string, ...statuses: string[]) => ({ planDate, blocks: statuses.map((status) => ({ status })) });

/** The occurrence instant a routine line's sourceId names (R8). */
const instantOf = (sourceId: string): string => {
  const m = /^routine:[^:]+:(?:routine|line:[^:]+):(.+)$/.exec(sourceId);
  assert.ok(m, `a routine sourceId: ${sourceId}`);
  return m[1];
};
const daysOf = (lines: readonly BudgetLine[]) => lines.map((l) => l.day);
const sum = (xs: readonly (number | null)[]) => xs.reduce<number>((a, x) => a + (x === null ? 0 : x), 0);
const throwsCode = (fn: () => unknown, c: BudgetDaysErrorCode) =>
  assert.throws(fn, (e: unknown) => e instanceof BudgetDaysError && e.code === c, `throws BudgetDaysError ${c}`);

// ── R1 · ROUTINE DAY ────────────────────────────────────────────────────────

// The fixtures R1 and TAB 1 PARITY share: [label, routine, rangeFrom, rangeTo, expected days].
const R1_FIXTURES: ReadonlyArray<[string, RoutinePlanInput, string, string, string[]]> = [
  ['a daily 08:00 routine in Los Angeles across 2026-11-01, when DST ends',
    routine({ id: 'la', timezone: 'America/Los_Angeles', startDate: '2026-09-01' }), '2026-10-29', '2026-11-04',
    ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']],
  ['a 23:30 routine in Asia/Bangkok',
    routine({ id: 'bkk', timezone: 'Asia/Bangkok', scheduleRrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0' }), '2026-10-05', '2026-10-06',
    ['2026-10-05', '2026-10-06']],
  ['a 05:00 routine in Asia/Bangkok — the UTC instant is on the day before',
    routine({ id: 'bkk5', timezone: 'Asia/Bangkok', scheduleRrule: 'FREQ=DAILY;BYHOUR=5;BYMINUTE=0;BYSECOND=0' }), '2026-10-05', '2026-10-06',
    ['2026-10-05', '2026-10-06']],
  ['a 23:30 routine in Los Angeles — the UTC instant is on the day after',
    routine({ id: 'la2330', timezone: 'America/Los_Angeles', scheduleRrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0' }), '2026-10-05', '2026-10-06',
    ['2026-10-05', '2026-10-06']],
  ['a 00:15 routine in Pacific/Auckland, just past midnight',
    routine({ id: 'akl', timezone: 'Pacific/Auckland', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=15;BYSECOND=0' }), '2026-10-05', '2026-10-06',
    ['2026-10-05', '2026-10-06']],
  ['a one-off (COUNT=1) dated 2026-10-15',
    routine({ id: 'once', timezone: 'America/Los_Angeles', startDate: '2026-10-15', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0' }), '2026-10-01', '2026-10-31',
    ['2026-10-15']],
  ['end_date 2026-10-03 clamps inclusively',
    routine({ id: 'ends', startDate: '2026-10-01', endDate: '2026-10-03' }), '2026-10-01', '2026-10-07',
    ['2026-10-01', '2026-10-02', '2026-10-03']],
  ['a range that starts after the routine began',
    routine({ id: 'old', startDate: '2026-01-01' }), '2026-10-05', '2026-10-07',
    ['2026-10-05', '2026-10-06', '2026-10-07']],
];

test('R1 ROUTINE DAY — each occurrence lands on its local date in the routine\'s own zone, one per local day', () => {
  for (const [label, r, from, to, expected] of R1_FIXTURES) {
    const { lines, notPlaced } = buildRoutineBudgetLines([r], from, to);
    assert.deepEqual(daysOf(lines), expected, label);
    assert.deepEqual(notPlaced, [], `${label}: nothing unplaced`);
  }
  // The zone decides, not UTC: Bangkok 05:00 on 10-05 is 2026-10-04T22:00Z; Los Angeles 23:30 on 10-05 is 2026-10-06T06:30Z;
  // Auckland 00:15 on 10-05 (NZDT, UTC+13) is 2026-10-04T11:15Z.
  const first = (id: string) => {
    const [, r, from, to] = R1_FIXTURES.find(([, x]) => x.id === id)!;
    return instantOf(buildRoutineBudgetLines([r], from, to).lines[0].sourceId);
  };
  assert.equal(first('bkk5'), '2026-10-04T22:00:00.000Z');
  assert.equal(first('la2330'), '2026-10-06T06:30:00.000Z');
  assert.equal(first('akl'), '2026-10-04T11:15:00.000Z');
  // The one-off is on its date and in no other month.
  const once = R1_FIXTURES.find(([, x]) => x.id === 'once')![1];
  assert.deepEqual(buildRoutineBudgetLines([once], '2026-09-01', '2026-09-30').lines, []);
  assert.deepEqual(buildRoutineBudgetLines([once], '2026-11-01', '2026-11-30').lines, []);
});

test('R1 ROUTINE DAY — an occurrence whose local day falls outside the range is not kept (Asia/Beirut, spring forward at midnight on 2026-03-29)', () => {
  // Beirut jumps 00:00 → 01:00 on Sunday 2026-03-29, so 00:30 that night does not exist. The ONE expansion
  // (rruleHelpers.ts, its stated DST limit — time.ts:18-20) places it at 2026-03-28T21:30Z = 23:30 on the 28th.
  const bey = routine({ id: 'bey', timezone: 'Asia/Beirut', startDate: '2026-03-01', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=30;BYSECOND=0' });
  // A range of the 29th alone: the floating window finds it, its local day is the 28th — outside, so no line.
  assert.deepEqual(buildRoutineBudgetLines([bey], '2026-03-29', '2026-03-29'), { lines: [], notPlaced: [] });
  // A range holding both days: both occurrences are on the 28th — exactly where Tab 1 draws them.
  const both = buildRoutineBudgetLines([bey], '2026-03-28', '2026-03-29');
  assert.deepEqual(both.lines.map((l) => [l.day, instantOf(l.sourceId)]), [
    ['2026-03-28', '2026-03-27T22:30:00.000Z'],
    ['2026-03-28', '2026-03-28T21:30:00.000Z'],
  ]);
  const drawn = mapOperationsRoutines({
    routines: [{ routine_id: 'bey', name: 'Bey', entity_id: 'ent-p', timezone: 'Asia/Beirut', start_time: null, end_time: null,
      occurrences: both.lines.map((l) => instantOf(l.sourceId)), coa_code: '6150', budget_amount: 15, steps: null }],
    truncated: false,
  });
  assert.deepEqual(drawn.map((e) => e.startDate), ['2026-03-28', '2026-03-28']);
});

test('TAB 1 PARITY — every R1 occurrence lands on the day mapOperationsRoutines draws for the same instant and zone', () => {
  let checked = 0;
  for (const [label, r, from, to] of R1_FIXTURES) {
    const { lines } = buildRoutineBudgetLines([r], from, to);
    const instants = lines.map((l) => instantOf(l.sourceId));
    const drawn = mapOperationsRoutines({
      routines: [{
        routine_id: r.id, name: r.name, entity_id: r.entityId, timezone: r.timezone, start_time: null, end_time: null,
        occurrences: instants, coa_code: r.coaCode, budget_amount: Number(r.budgetAmount), steps: null,
      }],
      truncated: false,
    });
    assert.equal(drawn.length, lines.length, `${label}: one tile per occurrence`);
    assert.deepEqual(drawn.map((e) => e.startDate), daysOf(lines), `${label}: the same day as Tab 1`);
    checked += lines.length;
  }
  assert.equal(checked, 7 + 2 + 2 + 2 + 2 + 1 + 3 + 3);
});

// ── R2 · ROUTINE MONEY ──────────────────────────────────────────────────────

test('R2 ROUTINE MONEY — lines win: once any line has an amount the routine-level amount is ignored', () => {
  const r = routine({
    id: 'morning', budgetAmount: 15, coaCode: '6200',
    steps: [
      { id: 'coffee', stepOrder: 0, budgetAmount: 4, coaCode: '6150', durationMinutes: null, timeOfDay: null },
      { id: 'lunch', stepOrder: 1, budgetAmount: '12.00', coaCode: '6160', durationMinutes: null, timeOfDay: null },
      { id: 'walk', stepOrder: 2, budgetAmount: null, coaCode: null, durationMinutes: null, timeOfDay: null },
    ],
  });
  const { lines, notPlaced } = buildRoutineBudgetLines([r], '2026-10-05', '2026-10-06');
  // Two days × two costed lines = 4 lines: 400 on 6150 and 1200 on 6160 each day. No 6200, no line for the walk.
  assert.deepEqual(lines.map((l) => [l.day, l.code, l.cents]), [
    ['2026-10-05', '6150', 400], ['2026-10-05', '6160', 1200],
    ['2026-10-06', '6150', 400], ['2026-10-06', '6160', 1200],
  ]);
  assert.deepEqual(notPlaced, []);
});

test('R2 ROUTINE MONEY — a $0 line is a planned 0; a negative amount is kept; a routine-level amount stands when no line is costed', () => {
  const zero = buildRoutineBudgetLines([routine({ id: 'z', steps: [{ id: 's', stepOrder: 0, budgetAmount: 0, coaCode: '6150', durationMinutes: null, timeOfDay: null }] })], '2026-10-05', '2026-10-05');
  assert.deepEqual(zero.lines.map((l) => l.cents), [0]);
  assert.equal(Object.is(zero.lines[0].cents, 0), true, 'a positive zero');
  const refund = buildRoutineBudgetLines([routine({ id: 'n', steps: [{ id: 's', stepOrder: 0, budgetAmount: -5, coaCode: '6150', durationMinutes: null, timeOfDay: null }] })], '2026-10-05', '2026-10-05');
  assert.deepEqual(refund.lines.map((l) => l.cents), [-500]);
  const stepless = buildRoutineBudgetLines([routine({ id: 'r', budgetAmount: '15.50', coaCode: '6150' })], '2026-10-05', '2026-10-05');
  assert.deepEqual(stepless.lines.map((l) => [l.code, l.cents]), [['6150', 1550]]);
});

test('R2 ROUTINE MONEY — a costed line with no code is Not placed \'no account\' WITH its day and cents; a routine with no money is nothing', () => {
  const r = routine({ id: 'm', steps: [{ id: 'tip', stepOrder: 0, budgetAmount: 7, coaCode: null, durationMinutes: null, timeOfDay: null }, { id: 'coffee', stepOrder: 1, budgetAmount: 4, coaCode: '6150', durationMinutes: null, timeOfDay: null }] });
  const { lines, notPlaced } = buildRoutineBudgetLines([r], '2026-10-05', '2026-10-06');
  assert.deepEqual(lines.map((l) => [l.day, l.cents]), [['2026-10-05', 400], ['2026-10-06', 400]]);
  assert.deepEqual(notPlaced.map((n) => [n.day, n.cents, n.reason]), [['2026-10-05', 700, 'no account'], ['2026-10-06', 700, 'no account']]);
  // A routine-level amount with no code: the same, per occurrence.
  const bare = buildRoutineBudgetLines([routine({ id: 'b', budgetAmount: 9, coaCode: null })], '2026-10-05', '2026-10-05');
  assert.deepEqual(bare.notPlaced.map((n) => [n.day, n.cents, n.reason]), [['2026-10-05', 900, 'no account']]);
  // from 'none' — no amount anywhere — contributes nothing and lists nothing, even with a zone
  // and a schedule that would not be read (the zone check runs only for routines with money).
  const none = buildRoutineBudgetLines([routine({ id: 'x', budgetAmount: null, coaCode: null, timezone: 'Mars/Olympus', scheduleRrule: 'FREQ=BOGUS', steps: [{ id: 's', stepOrder: 0, budgetAmount: null, coaCode: '6150', durationMinutes: null, timeOfDay: null }] })], '2026-10-05', '2026-10-06');
  assert.deepEqual(none, { lines: [], notPlaced: [] });
});

// HOME-LEDGER-02b (Alex, 2026-11-07, ruling F): the month tables' cases that had no equivalent here, moved from lines02.test.ts
// before their subject (routinesMonthlyByCoa) was deleted — the day lines are the one month model now. Figures as there: a
// daily routine over September 2026 is 30 occurrences; the dollars there are cents here.
const centsByCode = (lines: readonly BudgetLine[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const l of lines) out[l.code] = (out[l.code] ?? 0) + l.cents;
  return out;
};

test('R2 ROUTINE MONEY — a routine budgeted ONLY on its lines (no routine-level figure) contributes each costed line × occurrences to its own account', () => {
  const lined = routine({ id: 'lined', budgetAmount: null, coaCode: null, steps: [
    { id: 'coffee', stepOrder: 0, budgetAmount: '4.00', coaCode: '5210', durationMinutes: null, timeOfDay: null },
    { id: 'lunch', stepOrder: 1, budgetAmount: '12.00', coaCode: '5220', durationMinutes: null, timeOfDay: null },
  ] });
  const sep = buildRoutineBudgetLines([lined], '2026-09-01', '2026-09-30');
  assert.equal(sep.lines.length, 60, 'two costed lines × 30 September days');
  assert.deepEqual(centsByCode(sep.lines), { '5210': 400 * 30, '5220': 1200 * 30 });
  assert.deepEqual(sep.notPlaced, []);
});

test('R2 ROUTINE MONEY — an archived line (isActive false) contributes nothing', () => {
  const r = routine({ id: 'arch', budgetAmount: null, coaCode: null, steps: [
    { id: 'coffee', stepOrder: 0, budgetAmount: '4.00', coaCode: '5210', durationMinutes: null, timeOfDay: null },
    { id: 'gone', stepOrder: 1, budgetAmount: '99.00', coaCode: '5210', isActive: false, durationMinutes: null, timeOfDay: null },
  ] });
  const sep = buildRoutineBudgetLines([r], '2026-09-01', '2026-09-30');
  assert.deepEqual(centsByCode(sep.lines), { '5210': 400 * 30 });
  assert.equal(sep.lines.some((l) => l.sourceId.includes(':gone:')), false, 'no line is the archived one');
});

test('R2 ROUTINE MONEY — a line with a NULL amount is absent from the month — no line on its account, never a 0', () => {
  const r = routine({ id: 'unc', budgetAmount: null, coaCode: null, steps: [
    { id: 'gym', stepOrder: 0, budgetAmount: null, coaCode: '5230', durationMinutes: null, timeOfDay: null },
    { id: 'coffee', stepOrder: 1, budgetAmount: '4.00', coaCode: '5210', durationMinutes: null, timeOfDay: null },
  ] });
  const sep = buildRoutineBudgetLines([r], '2026-09-01', '2026-09-30');
  assert.deepEqual(centsByCode(sep.lines), { '5210': 400 * 30 });
  assert.equal(sep.lines.some((l) => l.code === '5230'), false, 'the uncosted gym line puts no line, and no 0, on its account');
  assert.deepEqual(sep.notPlaced, []);
  // A routine whose only line is uncosted, with no routine-level figure, contributes nothing at all.
  assert.deepEqual(buildRoutineBudgetLines([routine({ id: 'only', budgetAmount: null, coaCode: null, steps: [{ id: 'gym', stepOrder: 0, budgetAmount: null, coaCode: '5230', durationMinutes: null, timeOfDay: null }] })], '2026-09-01', '2026-09-30'), { lines: [], notPlaced: [] });
});

// ── R3 · TASK DAY ───────────────────────────────────────────────────────────

test('R3 TASK DAY — the earliest plan day with a live block wins; block-less items and cancelled blocks are ignored; a missed block counts', () => {
  const t = task({
    id: 't1',
    planItems: [planned('2026-10-08', 'scheduled'), planned('2026-10-03', 'cancelled'), planned('2026-10-04'), planned('2026-10-05', 'missed', 'cancelled')],
  });
  const { lines, notPlaced } = buildTaskBudgetLines([t], '2026-10-01', '2026-10-31');
  // 10-03: cancelled only · 10-04: no block · 10-05: a missed block (live) → the day is 10-05. Once — not again on 10-08.
  assert.deepEqual(lines, [{ entityId: 'ent-p', code: '6300', day: '2026-10-05', cents: 5000, source: 'task', sourceId: 'task:t1' }]);
  assert.deepEqual(notPlaced, []);
  // Its day is outside a view that ends before it: no line in that view, nothing listed.
  assert.deepEqual(buildTaskBudgetLines([t], '2026-10-01', '2026-10-04'), { lines: [], notPlaced: [], excluded: EXCLUDED_TASK_STATUSES.map((status) => ({ status, tasks: 0, cents: null })) });
});

test('R3 TASK DAY — a costed task not on the calendar is Not placed, undated, with its cents; no estimate is not money; no code is Not placed, dated', () => {
  const { lines, notPlaced } = buildTaskBudgetLines([
    task({ id: 'nowhere', estimatedCostUsd: '120.00', planItems: [planned('2026-10-05', 'cancelled')] }),
    task({ id: 'free', estimatedCostUsd: null, planItems: [planned('2026-10-05', 'scheduled')] }),
    task({ id: 'nocode', estimatedCostUsd: '30.00', coaCode: null, planItems: [planned('2026-10-06', 'scheduled')] }),
  ], '2026-10-01', '2026-10-31');
  assert.deepEqual(lines, []);
  assert.deepEqual(notPlaced.map((n) => [n.sourceId, n.day, n.cents, n.reason]), [
    ['task:nowhere', null, 12000, 'not on the calendar'],
    ['task:nocode', '2026-10-06', 3000, 'no account'],
  ]);
});

test('R3 TASK DAY — accepted statuses are plans; pending_review, cancelled, superseded and archived are excluded and counted per status', () => {
  const onCal = [planned('2026-10-05', 'scheduled')];
  const r = buildTaskBudgetLines([
    ...(['open', 'in_progress', 'blocked', 'completed'] as const).map((status, i) => task({ id: `a${i}`, status, estimatedCostUsd: `${i + 1}.00`, planItems: onCal })),
    task({ id: 'p1', status: 'pending_review', estimatedCostUsd: '10.00', planItems: onCal }),
    task({ id: 'p2', status: 'pending_review', estimatedCostUsd: '2.50' }),
    task({ id: 'c1', status: 'cancelled', estimatedCostUsd: '7.00', planItems: onCal }),
    task({ id: 's1', status: 'superseded', estimatedCostUsd: '8.00' }),
    task({ id: 'x1', status: 'archived', estimatedCostUsd: null }),
  ], '2026-10-01', '2026-10-31');
  // Plans: 100 + 200 + 300 + 400 cents on 10-05.
  assert.deepEqual(r.lines.map((l) => [l.sourceId, l.cents]), [['task:a0', 100], ['task:a1', 200], ['task:a2', 300], ['task:a3', 400]]);
  assert.deepEqual(r.notPlaced, []);
  // pending_review: 2 tasks, 1000 + 250 = 1250 · cancelled 700 · superseded 800 · archived: none costed (no estimate is not money).
  assert.deepEqual(r.excluded, [
    { status: 'pending_review', tasks: 2, cents: 1250 },
    { status: 'cancelled', tasks: 1, cents: 700 },
    { status: 'superseded', tasks: 1, cents: 800 },
    { status: 'archived', tasks: 0, cents: null },
  ]);
});

// ── R4 · BOOK AND CODE ──────────────────────────────────────────────────────

// TAB13-02d (ruled 2026-09-27, "there is only one truth.. one way"): a code is read by the chart's OWN rule,
// scheme.ts parseCode. The old copy (its own regex, its own 'code names another book') is deleted.
test('R4 BOOK AND CODE — the chart\'s own rule: its digits when it accepts, its words when it refuses; no code is \'no account\'', () => {
  // Was 'code names another book' in the copy's words; now the chart's refusal, which names the other book itself.
  assert.deepEqual(parseBudgetCode('P-6100', 'sole_prop'), { ok: false, reason: 'account code not recognised', detail: '"P-6100" — code P-6100 carries the P- letter; this is a B- chart (sole_prop) — enter B-6100 or 6100' });
  // Was refused by the copy; the chart upper-cases (scheme.ts:94), so it is P-6100.
  assert.deepEqual(parseBudgetCode('p-6100', 'personal'), { ok: true, code: '6100' });
  assert.deepEqual(parseBudgetCode(' 6100 ', 'personal'), { ok: true, code: '6100' });
  // Same reason as before; the detail is now the chart's own words.
  assert.deepEqual(parseBudgetCode('6100-10', 'personal'), { ok: false, reason: 'account code not recognised', detail: '"6100-10" — code "6100-10" is not in the scheme — four digits (6250) or the entity letter and four digits (B-6250)' });
  assert.deepEqual(parseBudgetCode('', 'personal'), { ok: false, reason: 'no account', detail: '""' });
  assert.deepEqual(parseBudgetCode(null, 'personal'), { ok: false, reason: 'no account', detail: null });
  // Was 'code names another book'; the chart says this type has no letter.
  assert.deepEqual(parseBudgetCode('T-6100', 'business'), { ok: false, reason: 'account code not recognised', detail: '"T-6100" — this entity (business) has no code letter — enter the four digits only' });
  assert.deepEqual(parseBudgetCode('B-6100', 'sole_prop'), { ok: true, code: '6100' });
  assert.deepEqual(parseBudgetCode('P-6100', 'personal'), { ok: true, code: '6100' });
  // New: a leading 0 is outside every family — refused as the chart refuses it (the copy read it).
  assert.deepEqual(parseBudgetCode('0100', 'personal'), { ok: false, reason: 'account code not recognised', detail: '"0100" — code 0100 is outside every family — codes run 1000–9999' });
  // Through a builder: the parsed four digits go on the line; a code for another book is listed with its cents.
  const r = buildTaskBudgetLines([
    task({ id: 'ok', entityId: 'ent-b', entityType: 'sole_prop', coaCode: 'B-6250', planItems: [planned('2026-10-05', 'scheduled')] }),
    task({ id: 'other', entityId: 'ent-b', entityType: 'sole_prop', coaCode: 'P-6100', planItems: [planned('2026-10-05', 'scheduled')] }),
  ], '2026-10-01', '2026-10-31');
  assert.deepEqual(r.lines.map((l) => [l.entityId, l.code]), [['ent-b', '6250']]);
  assert.deepEqual(r.notPlaced.map((n) => [n.sourceId, n.cents, n.reason, n.detail]), [
    ['task:other', 5000, 'account code not recognised', '"P-6100" — code P-6100 carries the P- letter; this is a B- chart (sole_prop) — enter B-6100 or 6100'],
  ]);
});

// T1 — ONE TRUTH: the table is the proof the two cannot drift. Every expected value is the chart's own answer.
test('ONE TRUTH — parseBudgetCode agrees with the chart\'s parseCode on every input and every entity type', () => {
  const inputs: (string | null)[] = ['5100', ' 5100 ', 'B-5100', 'b-5100', 'P-5100', 'T-5100', 'X-5100', '5100-10', 'B5100', 'B-B-5100', '0100', '51000', 'B-510', '', '   ', null];
  const types = ['personal', 'sole_prop', 'trading', 'llc'];
  let accepted = 0;
  let refused = 0;
  for (const raw of inputs) {
    for (const type of types) {
      const got = parseBudgetCode(raw, type);
      if (raw === null || raw.trim() === '') {
        assert.deepEqual(got, { ok: false, reason: 'no account', detail: raw === null ? null : JSON.stringify(raw) }, `${JSON.stringify(raw)} on ${type} is no account`);
        continue;
      }
      let chart: { ok: true; code: string } | { ok: false; message: string };
      try {
        chart = { ok: true, code: parseCode(raw, type) };
      } catch (error) {
        assert.ok(error instanceof ValidationError, `the chart refuses ${JSON.stringify(raw)} with a ValidationError`);
        chart = { ok: false, message: error.message };
      }
      const want = chart.ok
        ? { ok: true, code: chart.code }
        : { ok: false, reason: 'account code not recognised', detail: `${JSON.stringify(raw)} — ${chart.message}` };
      assert.deepEqual(got, want, `${JSON.stringify(raw)} on ${type}`);
      if (chart.ok) accepted += 1;
      else refused += 1;
    }
  }
  // The table is not vacuous: both answers occur, and the cases that drove this change are in it.
  assert.ok(accepted > 0 && refused > 0, `accepted ${accepted}, refused ${refused}`);
  assert.deepEqual(parseBudgetCode('b-5100', 'sole_prop'), { ok: true, code: '5100' }, 'lowercase reads as the chart reads it');
  assert.equal(parseBudgetCode('0100', 'sole_prop').ok, false, 'a leading 0 is refused as the chart refuses it');
  assert.equal(parseBudgetCode('B-5100', 'llc').ok, false, 'a letter on a book that has none');
  assert.equal(parseBudgetCode('T-5100', 'trading').ok, true);
});

// T3 — A SOURCE PIN: the day rules call the chart's rule and hold no code rule of their own.
test('ONE RULE — days.ts imports parseCode from the chart\'s scheme and holds no code regex, letter table or case-folding of its own', () => {
  const src = code(DAYS);
  assert.match(src, /import \{ parseCode \} from '@\/lib\/coa\/scheme';/);
  assert.match(src, /code: parseCode\(raw, entityType\)/);
  assert.doesNotMatch(src, /CODE_RE|\[A-Z\]|\[PBT\]|entityLetter|toUpperCase|toLowerCase/);
});

// ── R5 · MONEY IS EXACT ─────────────────────────────────────────────────────

test('R5 MONEY IS EXACT — a Decimal string by string arithmetic; routine dollars only when whole cents; past the safe range is refused', () => {
  assert.deepEqual(centsFromDecimalString('0.10'), { ok: true, cents: 10 });
  assert.deepEqual(centsFromDecimalString('-5.00'), { ok: true, cents: -500 });
  assert.deepEqual(centsFromDecimalString('5'), { ok: true, cents: 500 });
  assert.equal(Object.is((centsFromDecimalString('-0.00') as { cents: number }).cents, 0), true, '-0.00 is 0, never −0');
  assert.deepEqual(centsFromDecimalString('12.345'), { ok: false, detail: '12.345 has more than two decimals' });
  // The largest safe cents is 9007199254740991 = $90,071,992,547,409.91.
  assert.deepEqual(centsFromDecimalString('90071992547409.91'), { ok: true, cents: Number.MAX_SAFE_INTEGER });
  assert.equal(centsFromDecimalString('90071992547409.92').ok, false);
  throwsCode(() => centsFromDecimalString('12,00'), 'bad-amount');
  // Dollars as numbers: 0.29 × 100 = 28.999999999999996 → 29, within 1e-6 of a whole cent.
  assert.deepEqual(centsFromDollars(0.29), { ok: true, cents: 29 });
  assert.deepEqual(centsFromDollars(-5), { ok: true, cents: -500 });
  assert.equal(centsFromDollars(12.345).ok, false);
  // TAB13-02b (T2): 0.4 of a cent off — kills a tolerance loosened from 1e-6 toward half a cent.
  assert.equal(centsFromDollars(12.344).ok, false);
  assert.equal(centsFromDollars(1e17).ok, false, '10^19 cents is past the safe range');
  assert.equal(centsFromDollars(Number.NaN).ok, false);
  // Through the builders: never on a line, listed with cents null (the whole number of cents is unknown).
  const t = buildTaskBudgetLines([task({ id: 'odd', estimatedCostUsd: '12.345', planItems: [planned('2026-10-05', 'scheduled')] })], '2026-10-01', '2026-10-31');
  assert.deepEqual(t.notPlaced.map((n) => [n.day, n.cents, n.reason]), [['2026-10-05', null, 'amount not whole cents']]);
  const r = buildRoutineBudgetLines([routine({ id: 'odd', budgetAmount: 12.345 })], '2026-10-05', '2026-10-05');
  assert.deepEqual(r.notPlaced.map((n) => [n.day, n.cents, n.reason]), [['2026-10-05', null, 'amount not whole cents']]);
  assert.deepEqual(r.lines, []);
});

// ── R6 · FAIL LOUD, NEVER SKIP ──────────────────────────────────────────────

test('R6 FAIL LOUD — a schedule that does not parse, a bogus zone and a start date that is not a date each give exactly one Not placed entry; others are unaffected', () => {
  const good = routine({ id: 'good' });
  const { lines, notPlaced } = buildRoutineBudgetLines([
    good,
    routine({ id: 'badrule', scheduleRrule: 'FREQ=BOGUS' }),
    routine({ id: 'badzone', timezone: 'Mars/Olympus' }),
    routine({ id: 'baddate', startDate: '10/05/2026' }),
    routine({ id: 'feb30', startDate: '2026-02-30' }),
  ], '2026-10-05', '2026-10-06');
  assert.deepEqual(lines.map((l) => l.sourceId.split(':')[1]), ['good', 'good'], 'the good routine is untouched');
  assert.deepEqual(notPlaced.map((n) => [n.sourceId, n.day, n.cents, n.reason]), [
    ['routine:baddate', null, null, 'start date not recognised'],
    ['routine:badrule', null, null, 'schedule does not parse'],
    ['routine:badzone', null, null, 'timezone not recognised'],
    ['routine:feb30', null, null, 'start date not recognised'],
  ]);
  assert.match(notPlaced.find((n) => n.sourceId === 'routine:badrule')!.detail!, /Invalid frequency/);
  assert.match(notPlaced.find((n) => n.sourceId === 'routine:badzone')!.detail!, /Mars\/Olympus/);
});

test('R6 FAIL LOUD — a bad call throws by name: range, end date, plan date, status, amount', () => {
  for (const build of [(f: string, t: string) => buildRoutineBudgetLines([], f, t), (f: string, t: string) => buildTaskBudgetLines([], f, t)]) {
    throwsCode(() => build('2026-10-5', '2026-10-06'), 'bad-range');
    throwsCode(() => build('2026-10-05', '2026-13-01'), 'bad-range');
    throwsCode(() => build('2026-10-07', '2026-10-06'), 'bad-range');
  }
  throwsCode(() => buildRoutineBudgetLines([routine({ id: 'e', endDate: '2026-10-32' })], '2026-10-05', '2026-10-06'), 'bad-end-date');
  throwsCode(() => buildTaskBudgetLines([task({ id: 'p', planItems: [planned('2026-9-5', 'scheduled')] })], '2026-10-01', '2026-10-31'), 'bad-plan-date');
  throwsCode(() => buildTaskBudgetLines([task({ id: 's', status: 'done' })], '2026-10-01', '2026-10-31'), 'bad-task-status');
  throwsCode(() => buildTaskBudgetLines([task({ id: 'b', planItems: [planned('2026-10-05', 'skipped')] })], '2026-10-01', '2026-10-31'), 'bad-block-status');
  throwsCode(() => buildTaskBudgetLines([task({ id: 'a', estimatedCostUsd: 'fifty' })], '2026-10-01', '2026-10-31'), 'bad-amount');
});

// ── R7 · NOT PLACED IS A RECORD ─────────────────────────────────────────────

test('R7 NOT PLACED IS A RECORD — every field, a closed reason; undated entries in every view, dated ones only in theirs', () => {
  const tasks = [
    task({ id: 'nowhere', title: 'Buy a desk', estimatedCostUsd: '240.00' }),
    task({ id: 'nocode', title: 'Print flyers', coaCode: '  ', estimatedCostUsd: '30.00', planItems: [planned('2026-10-06', 'scheduled')] }),
  ];
  const october = buildTaskBudgetLines(tasks, '2026-10-01', '2026-10-31');
  const expected: NotPlaced[] = [
    { source: 'task', sourceId: 'task:nowhere', entityId: 'ent-p', label: 'Buy a desk', cents: 24000, day: null, reason: 'not on the calendar', detail: null },
    { source: 'task', sourceId: 'task:nocode', entityId: 'ent-p', label: 'Print flyers', cents: 3000, day: '2026-10-06', reason: 'no account', detail: '"  "' },
  ];
  assert.deepEqual(october.notPlaced, expected);
  // A view that does not hold 10-06 still lists the undated desk, and not the flyers.
  assert.deepEqual(buildTaskBudgetLines(tasks, '2026-11-01', '2026-11-30').notPlaced, [expected[0]]);
  for (const n of october.notPlaced) assert.ok(NOT_PLACED_REASONS.includes(n.reason));
  // TAB13-02d: 'code names another book' is deleted — the chart's refusal names the other book in its own words.
  assert.deepEqual([...NOT_PLACED_REASONS].sort(), [
    'account code not recognised', 'amount not whole cents', 'no account',
    'not on the calendar', 'schedule does not parse', 'start date not recognised', 'timezone not recognised',
  ]);
});

// ── R8 · TRACEABILITY ───────────────────────────────────────────────────────

test('R8 TRACEABILITY — every sourceId names its origin: the routine, the line or the routine figure, the instant; the task', () => {
  const r = buildRoutineBudgetLines([
    routine({ id: 'r1', steps: [{ id: 'st1', stepOrder: 0, budgetAmount: 4, coaCode: '6150', durationMinutes: null, timeOfDay: null }] }),
    routine({ id: 'r2' }),
  ], '2026-10-05', '2026-10-05');
  assert.deepEqual(r.lines.map((l) => l.sourceId), [
    'routine:r1:line:st1:2026-10-05T08:00:00.000Z',
    'routine:r2:routine:2026-10-05T08:00:00.000Z',
  ]);
  const t = buildTaskBudgetLines([task({ id: 't9', planItems: [planned('2026-10-05', 'scheduled')] })], '2026-10-01', '2026-10-31');
  assert.equal(t.lines[0].sourceId, 'task:t9');
});

// ── R9 · ONE RANGE ──────────────────────────────────────────────────────────

test('R9 ONE RANGE — viewRange is the span the model reads, and the day rules feed the model directly', () => {
  const asOf = '2026-10-07';
  const span = (r: ReturnType<typeof buildBudgetReport>) => {
    const cols = r.columns.filter((c) => c.kind !== 'ytd');
    return { rangeFrom: cols[0].from, rangeTo: cols[cols.length - 1].to };
  };
  const report = (view: Parameters<typeof viewRange>[0]) => buildBudgetReport({ asOf, view, entities: [], accounts: [], budgetLines: [], postings: [] });
  assert.deepEqual(viewRange({ kind: 'day', day: '2026-10-07' }), { rangeFrom: '2026-10-01', rangeTo: '2026-10-07' });
  assert.deepEqual(viewRange({ kind: 'week', weekOf: '2026-10-07' }), { rangeFrom: '2026-10-05', rangeTo: '2026-10-11' });
  assert.deepEqual(viewRange({ kind: 'year', year: 2026 }), { rangeFrom: '2026-01-01', rangeTo: '2026-12-31' });
  for (const view of [{ kind: 'day', day: '2026-10-07' }, { kind: 'week', weekOf: '2026-10-07' }, { kind: 'year', year: 2026 }] as const) {
    assert.deepEqual(viewRange(view), span(report(view)), `${view.kind}: the model's own span`);
  }
  assert.throws(() => viewRange({ kind: 'quarter' } as unknown as Parameters<typeof viewRange>[0]), (e: unknown) => e instanceof BudgetReportError && e.code === 'bad-view');
  // End to end: the week's routine and task lines go straight into the model.
  const { rangeFrom, rangeTo } = viewRange({ kind: 'week', weekOf: '2026-10-07' });
  const lines = [
    ...buildRoutineBudgetLines([routine({ id: 'coffee', budgetAmount: 4, coaCode: '6150' })], rangeFrom, rangeTo).lines,
    ...buildTaskBudgetLines([task({ id: 'desk', coaCode: '6300', planItems: [planned('2026-10-06', 'scheduled')] })], rangeFrom, rangeTo).lines,
  ];
  const r = buildBudgetReport({
    asOf, view: { kind: 'week', weekOf: '2026-10-07' },
    entities: [{ id: 'ent-p', name: 'Personal', entityType: 'personal' }],
    accounts: [
      // BUDGET-02 (2026-10-20): the chart hands in each account's archived flag — active accounts.
      { entityId: 'ent-p', code: '6150', name: 'Coffee', accountType: 'expense', balanceType: 'D', archived: false },
      { entityId: 'ent-p', code: '6300', name: 'Office', accountType: 'expense', balanceType: 'D', archived: false },
    ],
    budgetLines: markLines(lines, new Map()), postings: [], // SUPERSEDE-01b (2026-11-08): the model takes marked lines — these stated unmarked
  });
  // WEEK column: Coffee 7 × 400 = 2800 in full, 3 × 400 = 1200 to date (Mon 5 … Wed 7); Office 5000 on Tue 6.
  const row = (c: string) => r.books[0].rows.find((x) => x.code === c)!.cells[0];
  assert.deepEqual([row('6150').budgetFull, row('6150').budgetToDate], [2800, 1200]);
  assert.deepEqual([row('6300').budgetFull, row('6300').budgetToDate], [5000, 5000]);
});

// ── CONSERVATION ────────────────────────────────────────────────────────────

test('CONSERVATION — the cents on lines, on Not placed entries and in the exclusions add up to the money in; nothing lost, nothing invented', () => {
  // Routines over 3 days (10-05 … 10-07):
  //   coffee 4.00 on 6150 + tip 7.00 with no code (lines win over the routine's 15.00) → 3 × (400 + 700) = 3300
  //   gym 25.00 on 'X-6100' (another book)                                                   → 3 × 2500       = 7500
  //   rent 2000.00 routine-level on 6200, end_date 10-06                                     → 2 × 200000     = 400000
  const routines = [
    routine({ id: 'coffee', steps: [{ id: 'c', stepOrder: 0, budgetAmount: 4, coaCode: '6150', durationMinutes: null, timeOfDay: null }, { id: 'tip', stepOrder: 1, budgetAmount: 7, coaCode: null, durationMinutes: null, timeOfDay: null }] }),
    routine({ id: 'gym', budgetAmount: 25, coaCode: 'X-6100' }),
    routine({ id: 'rent', budgetAmount: '2000.00', coaCode: '6200', endDate: '2026-10-06' }),
  ];
  const rr = buildRoutineBudgetLines(routines, '2026-10-05', '2026-10-07');
  assert.equal(sum(rr.lines.map((l) => l.cents)) + sum(rr.notPlaced.map((n) => n.cents)), 3300 + 7500 + 400000);
  assert.ok(rr.notPlaced.every((n) => n.cents !== null), 'every entry here has known cents');
  // Tasks — every costed task is on a line, Not placed, or excluded:
  //   placed 50.00 · no code 30.00 · not on the calendar 120.00 · pending_review 10.00 · cancelled 7.00 → 21700
  const tasks = [
    task({ id: 'placed', planItems: [planned('2026-10-05', 'scheduled')] }),
    task({ id: 'nocode', coaCode: null, estimatedCostUsd: '30.00', planItems: [planned('2026-10-05', 'scheduled')] }),
    task({ id: 'nowhere', estimatedCostUsd: '120.00' }),
    task({ id: 'review', status: 'pending_review', estimatedCostUsd: '10.00' }),
    task({ id: 'dropped', status: 'cancelled', estimatedCostUsd: '7.00' }),
    task({ id: 'free', estimatedCostUsd: null, planItems: [planned('2026-10-05', 'scheduled')] }),
  ];
  const tr = buildTaskBudgetLines(tasks, '2026-10-01', '2026-10-31');
  assert.equal(sum(tr.lines.map((l) => l.cents)) + sum(tr.notPlaced.map((n) => n.cents)) + sum(tr.excluded.map((e) => e.cents)), 5000 + 3000 + 12000 + 1000 + 700);
});

// ── PURITY ──────────────────────────────────────────────────────────────────

test('PURITY — the day rules import no database client, framework or network, and read no clock and no environment', () => {
  const src = code(DAYS);
  assert.doesNotMatch(src, /['"]@prisma\/client/);
  assert.doesNotMatch(src, /from\s+['"]next(\/|['"])/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /\bDate\.now\s*\(/);
  assert.doesNotMatch(src, /\bnew\s+Date\s*\(\s*\)/);
  assert.doesNotMatch(src, /\bprocess\.env\b/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetDays.test.ts'), /['"]@prisma\/client/);
  // TAB13-02d: three catches. The routine builder's two record the plan as Not placed and move on;
  // none returns an empty result.
  assert.equal([...src.matchAll(/catch \(error\) \{/g)].length, 3);
  // SUPERSEDE-01b (2026-11-08, ruling C1): the two moved into the ONE expansion (routineOccurrencesOf) — each answers its reason by
  // name, never an empty list; the builder records it as Not placed and moves on (the supersession counts it unreadable).
  const expansion = src.slice(src.indexOf('export function routineOccurrencesOf('), src.indexOf('export function buildRoutineBudgetLines('));
  const catches = [...expansion.matchAll(/catch \(error\) \{([\s\S]*?)\}/g)].map((m) => m[1]);
  assert.equal(catches.length, 2);
  for (const body of catches) assert.match(body, /^\s*return \{ ok: false, reason: '(timezone not recognised|schedule does not parse)', detail: /);
  const routineRules = src.slice(src.indexOf('export function buildRoutineBudgetLines('), src.indexOf('export type TaskStatus'));
  assert.doesNotMatch(routineRules, /catch \(/, 'no catch of its own');
  assert.match(routineRules, /const expanded = routineOccurrencesOf\(routine, windowFrom, windowTo\);\n\s*if \(!expanded\.ok\) \{\n\s*notPlaced\.push\(\{ \.\.\.base, sourceId: wholeRoutineKey\(routine\.id\), cents: null, day: null, reason: expanded\.reason, detail: expanded\.detail \}\);\n\s*continue;\n\s*\}/);
  // The parser's one maps ONLY the chart's refusal to a reason, in the chart's words, and throws every other error on.
  const parser = src.slice(src.indexOf('export function parseBudgetCode('), src.indexOf('export type CentsResult'));
  assert.match(parser, /catch \(error\) \{\s*if \(error instanceof ValidationError\) \{\s*return \{ ok: false, reason: 'account code not recognised', detail: `\$\{JSON\.stringify\(raw\)\} — \$\{error\.message\}` \};\s*\}\s*throw error;\s*\}/);
});

// ── SUPERSEDE-01b · ONE EXPANSION, THE WINDOWS, THE MARKS (Alex, 2026-11-08, ruling C) ──────────────────────────────────

test('SUPERSEDE-01b ONE EXPANSION — routineOccurrencesOf answers what expandBetween gives in the window, or its reason by name: the zone first (even in an empty window), then the start date, then the schedule — the reasons buildRoutineBudgetLines records', () => {
  const { windowFrom, windowTo } = dayWindow('2026-10-05', '2026-10-07');
  const ok = routineOccurrencesOf(routine({ id: 'ok', timezone: 'Asia/Bangkok' }), windowFrom, windowTo);
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.deepEqual(
    ok.occurrences.map((d) => d.toISOString()),
    expandBetween(DAILY_08, 'Asia/Bangkok', windowFrom, windowTo, scheduleAnchor('2026-01-01')).map((d) => d.toISOString()),
    'the one expansion, anchored on the start date — nothing added, nothing dropped',
  );
  assert.deepEqual(ok.occurrences.map((d) => d.toISOString()), ['2026-10-05T01:00:00.000Z', '2026-10-06T01:00:00.000Z', '2026-10-07T01:00:00.000Z'], '08:00 Bangkok is 01:00Z, one a day');
  const refusal = (r: RoutinePlanInput) => {
    const answer = routineOccurrencesOf(r, windowFrom, windowTo);
    assert.equal(answer.ok, false, `${r.id} is refused`);
    return answer.ok ? null : { reason: answer.reason, detail: answer.detail };
  };
  const zone = refusal(routine({ id: 'z', timezone: 'Mars/Olympus' }));
  assert.equal(zone?.reason, 'timezone not recognised');
  assert.match(zone?.detail ?? '', /^"Mars\/Olympus": /);
  assert.equal(refusal(routine({ id: 'zs', timezone: 'Mars/Olympus', scheduleRrule: 'FREQ=BOGUS' }))?.reason, 'timezone not recognised', 'the zone is read first');
  // A one-off outside the window: no occurrence would ever consult the zone, so it is read before the expansion.
  assert.equal(refusal(routine({ id: 'ze', timezone: 'Mars/Olympus', startDate: '2026-12-01', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=8' }))?.reason, 'timezone not recognised', 'even in an empty window');
  assert.deepEqual(refusal(routine({ id: 'sd', startDate: '2026-02-30' })), { reason: 'start date not recognised', detail: '"2026-02-30"' });
  const schedule = refusal(routine({ id: 'sc', scheduleRrule: 'FREQ=BOGUS' }));
  assert.equal(schedule?.reason, 'schedule does not parse');
  assert.match(schedule?.detail ?? '', /^"FREQ=BOGUS": /);
  // The builder records the very answer as Not placed for a costed routine.
  for (const r of [routine({ id: 'z', timezone: 'Mars/Olympus' }), routine({ id: 'sd', startDate: '2026-02-30' }), routine({ id: 'sc', scheduleRrule: 'FREQ=BOGUS' })]) {
    const { notPlaced } = buildRoutineBudgetLines([r], '2026-10-05', '2026-10-07');
    assert.deepEqual(notPlaced.map((n) => ({ reason: n.reason, detail: n.detail })), [refusal(r)], `${r.id}: the builder's Not placed is the expansion's answer`);
  }
});

// The fixture set the builder's lines were hashed over on MAIN 8099fe59 (its days.ts, before the expansion moved into
// routineOccurrencesOf) — 23 cases, 1970 lines, 13 Not placed, 291581 bytes of JSON. The same set on this head must give
// the same bytes: the expansion moved, the lines did not.
const byteStep = (over: Partial<RoutineLinePlanInput> & { id: string }): RoutineLinePlanInput => ({ stepOrder: 0, budgetAmount: null, coaCode: null, durationMinutes: null, timeOfDay: null, ...over });
const BYTES_MANY = [
  routine({ id: 'm-la', timezone: 'America/Los_Angeles', scheduleRrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0', budgetAmount: '3.50' }),
  routine({ id: 'm-bkk', timezone: 'Asia/Bangkok', scheduleRrule: 'FREQ=DAILY;BYHOUR=5;BYMINUTE=0;BYSECOND=0', coaCode: '6200' }),
  routine({ id: 'm-lined', timezone: 'Asia/Bangkok', budgetAmount: null, coaCode: null, steps: [byteStep({ id: 'm-a', stepOrder: 1, budgetAmount: 2, coaCode: '6150', timeOfDay: '09:00', durationMinutes: 15 }), byteStep({ id: 'm-b', stepOrder: 0, budgetAmount: '1.25', coaCode: '6160' })] }),
  routine({ id: 'm-wk', timezone: 'Europe/Lisbon', scheduleRrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0', endDate: '2026-10-20' }),
  routine({ id: 'm-bad', timezone: 'Mars/Olympus' }),
];
const BYTES_CASES: ReadonlyArray<readonly [string, readonly RoutinePlanInput[], string, string]> = [
  ['la across DST', [routine({ id: 'la', timezone: 'America/Los_Angeles', startDate: '2026-09-01' })], '2026-10-29', '2026-11-04'],
  ['bkk 23:30', [routine({ id: 'bkk', timezone: 'Asia/Bangkok', scheduleRrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0' })], '2026-10-05', '2026-10-06'],
  ['bkk 05:00', [routine({ id: 'bkk5', timezone: 'Asia/Bangkok', scheduleRrule: 'FREQ=DAILY;BYHOUR=5;BYMINUTE=0;BYSECOND=0' })], '2026-10-05', '2026-10-06'],
  ['la 23:30', [routine({ id: 'la2330', timezone: 'America/Los_Angeles', scheduleRrule: 'FREQ=DAILY;BYHOUR=23;BYMINUTE=30;BYSECOND=0' })], '2026-10-05', '2026-10-06'],
  ['akl 00:15', [routine({ id: 'akl', timezone: 'Pacific/Auckland', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=15;BYSECOND=0' })], '2026-10-05', '2026-10-06'],
  ['one-off', [routine({ id: 'once', timezone: 'America/Los_Angeles', startDate: '2026-10-15', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0' })], '2026-10-01', '2026-10-31'],
  ['end date', [routine({ id: 'ends', startDate: '2026-10-01', endDate: '2026-10-03' })], '2026-10-01', '2026-10-07'],
  ['weekly year', [routine({ id: 'wk', timezone: 'Europe/Lisbon', scheduleRrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0' })], '2026-01-01', '2026-12-31'],
  ['lines win', [routine({ id: 'lined', coaCode: '6200', steps: [byteStep({ id: 'c', budgetAmount: 4, coaCode: '6150' }), byteStep({ id: 'l', stepOrder: 1, budgetAmount: '12.00', coaCode: '6160' }), byteStep({ id: 'w', stepOrder: 2 })] })], '2026-10-05', '2026-10-11'],
  ['the routine figure', [routine({ id: 'fig', budgetAmount: '9.99', steps: [byteStep({ id: 'a', timeOfDay: '07:30', durationMinutes: 20 })] })], '2026-10-01', '2026-10-31'],
  ['archived line', [routine({ id: 'arch', budgetAmount: null, coaCode: null, steps: [byteStep({ id: 'k', budgetAmount: '4.00', coaCode: '5210' }), byteStep({ id: 'g', stepOrder: 1, budgetAmount: '99.00', coaCode: '5210', isActive: false })] })], '2026-09-01', '2026-09-30'],
  ['no account', [routine({ id: 'na', steps: [byteStep({ id: 't', budgetAmount: 7 }), byteStep({ id: 'c2', stepOrder: 1, budgetAmount: 4, coaCode: '6150' })] })], '2026-10-05', '2026-10-06'],
  ['another book', [routine({ id: 'bc', coaCode: 'X-6100' })], '2026-10-05', '2026-10-07'],
  ['not whole cents', [routine({ id: 'nc', budgetAmount: 4.005 })], '2026-10-05', '2026-10-05'],
  ['a refund', [routine({ id: 'neg', steps: [byteStep({ id: 's', budgetAmount: -5, coaCode: '6150' })] })], '2026-10-05', '2026-10-05'],
  ['bad zone', [routine({ id: 'bz', timezone: 'Mars/Olympus' })], '2026-10-05', '2026-10-06'],
  ['bad start date', [routine({ id: 'bs', startDate: '2026-02-30' })], '2026-10-05', '2026-10-06'],
  ['bad schedule', [routine({ id: 'br', scheduleRrule: 'FREQ=BOGUS' })], '2026-10-05', '2026-10-06'],
  ['the zone first', [routine({ id: 'zf', timezone: 'Nowhere/X', scheduleRrule: 'FREQ=BOGUS' })], '2026-10-05', '2026-10-06'],
  ['a bad zone in an empty window', [routine({ id: 'ew', timezone: 'Mars/Olympus', startDate: '2026-10-15', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=8' })], '2026-01-01', '2026-01-02'],
  ['no money', [routine({ id: 'x', budgetAmount: null, coaCode: null, timezone: 'Mars/Olympus', scheduleRrule: 'FREQ=BOGUS', steps: [byteStep({ id: 's', coaCode: '6150' })] })], '2026-10-05', '2026-10-06'],
  ['many, a month', BYTES_MANY, '2026-10-01', '2026-10-31'],
  ['many, a year', BYTES_MANY, '2026-01-01', '2026-12-31'],
];

test('SUPERSEDE-01b THE LINES, BYTE-IDENTICAL — buildRoutineBudgetLines over the fixture set gives the bytes main gave before the expansion moved (sha256 of the JSON)', () => {
  const results = BYTES_CASES.map(([label, routines, from, to]) => [label, buildRoutineBudgetLines(routines, from, to)] as const);
  const json = JSON.stringify(results);
  assert.deepEqual(
    [results.length, results.reduce((n, [, r]) => n + r.lines.length, 0), results.reduce((n, [, r]) => n + r.notPlaced.length, 0), json.length],
    [23, 1970, 13, 291581],
  );
  assert.equal(createHash('sha256').update(json).digest('hex'), 'b4bad9eba9f322a77a1d293de5e0fefd70c50d9be62ebd545f6c7b7ac854ee63', 'main 8099fe59 gave these bytes');
});

// The windows on 2026-10-15 in Bangkok (UTC+7) and the one block: a planned flight 14:10–17:05, both instants stated.
const S_DAY = '2026-10-15';
const bkkAt = (clock: string, day: string = S_DAY): string => new Date(`${day}T${clock}:00.000+07:00`).toISOString();
const FLIGHT: TravelBlock = { key: 'planned:ti-flight', kind: 'flight', name: 'AirAsia', time: '14:10', startAt: bkkAt('14:10'), endAt: bkkAt('17:05') };
const bkkRoutine = (id: string, clock: string, over: Partial<RoutinePlanInput> = {}): RoutinePlanInput =>
  routine({ id, timezone: 'Asia/Bangkok', scheduleRrule: `FREQ=DAILY;BYHOUR=${Number(clock.slice(0, 2))};BYMINUTE=${Number(clock.slice(3, 5))};BYSECOND=0`, ...over });
const keyOf = (routineId: string, lineId: string | null, clock: string, day: string = S_DAY): string => occurrenceKey({ routineId, lineId, instant: new Date(bkkAt(clock, day)) });
const NONE: ReadonlySet<string> = new Set();

test('SUPERSEDE-01b A POINT OCCURRENCE INSIDE A BLOCK — a stepless routine with no clocks is a point at its occurrence: inside [start, end) it is marked by the block, at the end it is not', () => {
  const gym = bkkRoutine('gym', '15:00');
  const start = bkkRoutine('start', '14:10');
  const end = bkkRoutine('end', '17:05');
  const s = routineSupersessionOf([gym, start, end], S_DAY, S_DAY, [FLIGHT], NONE);
  assert.deepEqual(s.occurrences, [keyOf('gym', null, '15:00'), keyOf('start', null, '14:10'), keyOf('end', null, '17:05')], 'every window, in order');
  assert.deepEqual(s.marks.get(keyOf('gym', null, '15:00')), { by: FLIGHT, more: 0 });
  assert.deepEqual(s.marks.get(keyOf('start', null, '14:10')), { by: FLIGHT, more: 0 }, 'the start is inside');
  assert.equal(s.marks.has(keyOf('end', null, '17:05')), false, 'the end is not');
  assert.equal(s.unreadable, 0);
});

test('SUPERSEDE-01b A TIMED LINE OVERLAPPING — a line\'s window is its own time of day on the occurrence\'s LOCAL day in the routine\'s zone, its length the line\'s duration; a stepless routine\'s length is its clocks\'', () => {
  // The lined routine runs at 07:00; its lines carry their own clocks (or none — then the occurrence) and durations.
  const day = bkkRoutine('day', '07:00', { budgetAmount: null, coaCode: null, steps: [
    byteStep({ id: 'walk', stepOrder: 0, timeOfDay: '13:30', durationMinutes: 60 }), // [13:30, 14:30) shares 14:10–14:30
    byteStep({ id: 'read', stepOrder: 1, timeOfDay: '17:05', durationMinutes: 30 }), // [17:05, 17:35) only touches the end
    byteStep({ id: 'nap', stepOrder: 2, timeOfDay: null, durationMinutes: 600 }), // at the occurrence, 07:00 + 10h → 17:00
    byteStep({ id: 'old', stepOrder: 3, timeOfDay: '15:00', durationMinutes: 30, isActive: false }), // inactive: no window
  ] });
  const cowork = bkkRoutine('cowork', '13:00', { startTime: '1970-01-01T13:00:00.000Z', endTime: '1970-01-01T18:00:00.000Z' });
  const s = routineSupersessionOf([day, cowork], S_DAY, S_DAY, [FLIGHT], NONE);
  assert.deepEqual(s.occurrences, [keyOf('day', 'walk', '07:00'), keyOf('day', 'read', '07:00'), keyOf('day', 'nap', '07:00'), keyOf('cowork', null, '13:00')], 'one window per ACTIVE line, keyed by the occurrence');
  assert.deepEqual([...s.marks.keys()], [keyOf('day', 'walk', '07:00'), keyOf('day', 'nap', '07:00'), keyOf('cowork', null, '13:00')]);
  // The local day, not the UTC one: a 05:00 Bangkok routine occurs at 22:00Z the evening before; its 06:00 line is 06:00 on the LOCAL day.
  const early = bkkRoutine('early', '05:00', { steps: [byteStep({ id: 'tea', timeOfDay: '06:00', durationMinutes: 30 })] });
  const dawn: TravelBlock = { ...FLIGHT, key: 'planned:ti-dawn', time: '05:45', startAt: bkkAt('05:45'), endAt: bkkAt('06:15') };
  const e = routineSupersessionOf([early], S_DAY, S_DAY, [dawn], NONE);
  assert.equal(new Date(bkkAt('05:00')).toISOString(), '2026-10-14T22:00:00.000Z', 'the occurrence is on the UTC day before');
  assert.deepEqual(e.marks.get(keyOf('early', 'tea', '05:00')), { by: dawn, more: 0 }, '06:00 on 2026-10-15 in Bangkok — the local day');
});

test('SUPERSEDE-01b A RECORDED OCCURRENCE IS NEVER MARKED — the one record key (stopRecord.ts recordKey) at the occurrence: the record wins, the window stays listed', () => {
  const gym = bkkRoutine('gym', '15:00');
  const lined = bkkRoutine('lined', '07:00', { steps: [byteStep({ id: 'walk', timeOfDay: '14:30', durationMinutes: 30 })] });
  const recorded = new Set([
    recordKey({ kind: 'routine', target_id: 'gym', occurrence_at: bkkAt('15:00') }),
    // A line's record is at its ROUTINE's occurrence (the card's key: line:<step>:<expected_at>), never the line's own clock.
    recordKey({ kind: 'routine_line', target_id: 'walk', occurrence_at: bkkAt('07:00') }),
  ]);
  const s = routineSupersessionOf([gym, lined], S_DAY, S_DAY, [FLIGHT], recorded);
  assert.deepEqual(s.occurrences, [keyOf('gym', null, '15:00'), keyOf('lined', 'walk', '07:00')], 'both listed');
  assert.equal(s.marks.size, 0, 'neither marked — a record wins');
  const unrecorded = routineSupersessionOf([gym, lined], S_DAY, S_DAY, [FLIGHT], NONE);
  assert.equal(unrecorded.marks.size, 2, 'without the records, both are');
});

test('SUPERSEDE-01b A LINED ROUTINE\'S OWN FIGURE IS UNMARKED — its budget line is keyed by the routine while its windows are its lines\': the line is marked, the figure never', () => {
  // The routine is priced at the routine level (no line carries an amount — routinePlanned 'routine'); its one line is on the flight.
  const fig = bkkRoutine('fig', '07:00', { budgetAmount: '10.00', coaCode: '6150', steps: [byteStep({ id: 'walk', timeOfDay: '15:00', durationMinutes: 30 })] });
  const built = buildRoutineBudgetLines([fig], S_DAY, S_DAY);
  assert.deepEqual(built.lines.map((l) => [l.sourceId, l.cents]), [[keyOf('fig', null, '07:00'), 1000]], 'one line, keyed routine:<r>:routine:<instant>');
  const s = routineSupersessionOf([fig], S_DAY, S_DAY, [FLIGHT], NONE);
  assert.deepEqual(s.occurrences, [keyOf('fig', 'walk', '07:00')], 'the window is the line\'s');
  assert.ok(s.marks.has(keyOf('fig', 'walk', '07:00')), 'the line is marked');
  assert.equal(s.marks.has(built.lines[0].sourceId), false, 'the figure is never — the report counts it (routineFiguresUnmarked)');
});

test('SUPERSEDE-01b A YEAR COUNTS ONLY — every occurrence of the range is a window and only the ones a block covers are marked; costed or not; an unreadable routine is counted, never a window', () => {
  const coffee = bkkRoutine('coffee', '15:00');
  const free = bkkRoutine('free', '15:30', { budgetAmount: null, coaCode: null }); // no money: no budget line, still a window
  const ended = bkkRoutine('ended', '15:00', { endDate: '2026-10-14' }); // its last day is the day before the flight
  const lost = bkkRoutine('lost', '15:00', { timezone: 'Mars/Olympus' });
  const year = routineSupersessionOf([coffee, free, ended, lost], '2026-01-01', '2026-12-31', [FLIGHT], NONE);
  assert.equal(year.occurrences.length, 365 + 365 + 287, 'coffee and free every day of 2026; ended Jan 1 … Oct 14');
  assert.deepEqual([...year.marks.keys()], [keyOf('coffee', null, '15:00'), keyOf('free', null, '15:30')], 'only the two on the flight');
  assert.equal(year.unreadable, 1, 'the routine whose zone cannot be read');
  // The same occurrence is marked the same way in the year and in its day.
  const day = routineSupersessionOf([coffee, free, ended, lost], S_DAY, S_DAY, [FLIGHT], NONE);
  assert.deepEqual([...day.marks.entries()], [...year.marks.entries()]);
  assert.deepEqual(buildRoutineBudgetLines([free], '2026-01-01', '2026-12-31'), { lines: [], notPlaced: [] }, 'the free routine prices nothing — its marks are the card\'s');
  // A bad call is refused by name, as the builder refuses it.
  throwsCode(() => routineSupersessionOf([bkkRoutine('bad', '15:00', { endDate: '2026-13-01' })], S_DAY, S_DAY, [], NONE), 'bad-end-date');
  throwsCode(() => routineSupersessionOf([], '2026-10-16', S_DAY, [], NONE), 'bad-range');
});
