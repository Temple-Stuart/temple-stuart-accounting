import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRoutineBudgetLines, buildTaskBudgetLines, parseBudgetCode, centsFromDecimalString, centsFromDollars,
  BudgetDaysError, NOT_PLACED_REASONS, EXCLUDED_TASK_STATUSES,
  type BudgetDaysErrorCode, type NotPlaced, type RoutinePlanInput, type TaskPlanInput,
} from '../budget/days';
import { buildBudgetReport, viewRange, BudgetReportError, type BudgetLine } from '../budget/report';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { code } from '../sourceText';

// TAB13-02a — the day rules, pure. Tests named for the rule they pin. Every
// expected figure is integer cents, worked by hand beside it. This file imports
// nothing from @prisma/client.

const DAYS = 'src/lib/budget/days.ts';
const DAILY_08 = 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0';

const routine = (over: Partial<RoutinePlanInput> & { id: string }): RoutinePlanInput => ({
  name: `Routine ${over.id}`, entityId: 'ent-p', entityType: 'personal', timezone: 'UTC', scheduleRrule: DAILY_08,
  startDate: '2026-01-01', endDate: null, budgetAmount: 15, coaCode: '6150', steps: [], ...over,
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
      { id: 'coffee', stepOrder: 0, budgetAmount: 4, coaCode: '6150' },
      { id: 'lunch', stepOrder: 1, budgetAmount: '12.00', coaCode: '6160' },
      { id: 'walk', stepOrder: 2, budgetAmount: null, coaCode: null },
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
  const zero = buildRoutineBudgetLines([routine({ id: 'z', steps: [{ id: 's', stepOrder: 0, budgetAmount: 0, coaCode: '6150' }] })], '2026-10-05', '2026-10-05');
  assert.deepEqual(zero.lines.map((l) => l.cents), [0]);
  assert.equal(Object.is(zero.lines[0].cents, 0), true, 'a positive zero');
  const refund = buildRoutineBudgetLines([routine({ id: 'n', steps: [{ id: 's', stepOrder: 0, budgetAmount: -5, coaCode: '6150' }] })], '2026-10-05', '2026-10-05');
  assert.deepEqual(refund.lines.map((l) => l.cents), [-500]);
  const stepless = buildRoutineBudgetLines([routine({ id: 'r', budgetAmount: '15.50', coaCode: '6150' })], '2026-10-05', '2026-10-05');
  assert.deepEqual(stepless.lines.map((l) => [l.code, l.cents]), [['6150', 1550]]);
});

test('R2 ROUTINE MONEY — a costed line with no code is Not placed \'no account\' WITH its day and cents; a routine with no money is nothing', () => {
  const r = routine({ id: 'm', steps: [{ id: 'tip', stepOrder: 0, budgetAmount: 7, coaCode: null }, { id: 'coffee', stepOrder: 1, budgetAmount: 4, coaCode: '6150' }] });
  const { lines, notPlaced } = buildRoutineBudgetLines([r], '2026-10-05', '2026-10-06');
  assert.deepEqual(lines.map((l) => [l.day, l.cents]), [['2026-10-05', 400], ['2026-10-06', 400]]);
  assert.deepEqual(notPlaced.map((n) => [n.day, n.cents, n.reason]), [['2026-10-05', 700, 'no account'], ['2026-10-06', 700, 'no account']]);
  // A routine-level amount with no code: the same, per occurrence.
  const bare = buildRoutineBudgetLines([routine({ id: 'b', budgetAmount: 9, coaCode: null })], '2026-10-05', '2026-10-05');
  assert.deepEqual(bare.notPlaced.map((n) => [n.day, n.cents, n.reason]), [['2026-10-05', 900, 'no account']]);
  // from 'none' — no amount anywhere — contributes nothing and lists nothing, even with a zone
  // and a schedule that would not be read (the zone check runs only for routines with money).
  const none = buildRoutineBudgetLines([routine({ id: 'x', budgetAmount: null, coaCode: null, timezone: 'Mars/Olympus', scheduleRrule: 'FREQ=BOGUS', steps: [{ id: 's', stepOrder: 0, budgetAmount: null, coaCode: '6150' }] })], '2026-10-05', '2026-10-06');
  assert.deepEqual(none, { lines: [], notPlaced: [] });
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

test('R4 BOOK AND CODE — NNNN or L-NNNN after trimming, the letter the entity\'s own; anything else is Not placed by name', () => {
  assert.deepEqual(parseBudgetCode('P-6100', 'sole_prop'), { ok: false, reason: 'code names another book', detail: '"P-6100" on a sole_prop entity, whose letter is B' });
  assert.deepEqual(parseBudgetCode('p-6100', 'personal'), { ok: false, reason: 'account code not recognised', detail: '"p-6100"' });
  assert.deepEqual(parseBudgetCode(' 6100 ', 'personal'), { ok: true, code: '6100' });
  assert.deepEqual(parseBudgetCode('6100-10', 'personal'), { ok: false, reason: 'account code not recognised', detail: '"6100-10"' });
  assert.deepEqual(parseBudgetCode('', 'personal'), { ok: false, reason: 'no account', detail: '""' });
  assert.deepEqual(parseBudgetCode(null, 'personal'), { ok: false, reason: 'no account', detail: null });
  assert.deepEqual(parseBudgetCode('T-6100', 'business'), { ok: false, reason: 'code names another book', detail: '"T-6100" on a business entity, whose letter is none' });
  assert.deepEqual(parseBudgetCode('B-6100', 'sole_prop'), { ok: true, code: '6100' });
  assert.deepEqual(parseBudgetCode('P-6100', 'personal'), { ok: true, code: '6100' });
  // Through a builder: the parsed four digits go on the line; a code for another book is listed with its cents.
  const r = buildTaskBudgetLines([
    task({ id: 'ok', entityId: 'ent-b', entityType: 'sole_prop', coaCode: 'B-6250', planItems: [planned('2026-10-05', 'scheduled')] }),
    task({ id: 'other', entityId: 'ent-b', entityType: 'sole_prop', coaCode: 'P-6100', planItems: [planned('2026-10-05', 'scheduled')] }),
  ], '2026-10-01', '2026-10-31');
  assert.deepEqual(r.lines.map((l) => [l.entityId, l.code]), [['ent-b', '6250']]);
  assert.deepEqual(r.notPlaced.map((n) => [n.sourceId, n.cents, n.reason]), [['task:other', 5000, 'code names another book']]);
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
  assert.deepEqual([...NOT_PLACED_REASONS].sort(), [
    'account code not recognised', 'amount not whole cents', 'code names another book', 'no account',
    'not on the calendar', 'schedule does not parse', 'start date not recognised', 'timezone not recognised',
  ]);
});

// ── R8 · TRACEABILITY ───────────────────────────────────────────────────────

test('R8 TRACEABILITY — every sourceId names its origin: the routine, the line or the routine figure, the instant; the task', () => {
  const r = buildRoutineBudgetLines([
    routine({ id: 'r1', steps: [{ id: 'st1', stepOrder: 0, budgetAmount: 4, coaCode: '6150' }] }),
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
      { entityId: 'ent-p', code: '6150', name: 'Coffee', accountType: 'expense', balanceType: 'D' },
      { entityId: 'ent-p', code: '6300', name: 'Office', accountType: 'expense', balanceType: 'D' },
    ],
    budgetLines: lines, postings: [],
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
    routine({ id: 'coffee', steps: [{ id: 'c', stepOrder: 0, budgetAmount: 4, coaCode: '6150' }, { id: 'tip', stepOrder: 1, budgetAmount: 7, coaCode: null }] }),
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
  // Every catch records the plan as Not placed and moves on; none returns an empty result.
  const catches = [...src.matchAll(/catch \(error\) \{([\s\S]*?)continue;/g)].map((m) => `${m[1]}continue;`);
  assert.equal(catches.length, 2);
  for (const body of catches) {
    assert.match(body, /whole\('/);
    assert.match(body, /continue;/);
    assert.doesNotMatch(body, /return/);
  }
});
