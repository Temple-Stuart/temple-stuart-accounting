import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { routinesMonthlyByCoa } from '../operations/routineBudget';
import { toRoutineBudgetInput, type RoutineBudgetRow } from '../operations/routineBudgetInputs';
import { code } from '../sourceText';

// LINES-02 — the Personal budget reads a routine's lines and its anchor, the way
// Business already does: one loader builds the inputs for both budget routes.

const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const PERSONAL = 'src/app/api/hub/year-calendar/route.ts';
const BUSINESS = 'src/app/api/hub/business-budget/route.ts';

const DAILY = 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0';
const SEP = 8; // 0-indexed month; September 2026 has 30 days → 30 daily occurrences.
const SEP_DAYS = 30;

const dec = (v: string) => new Prisma.Decimal(v);
type Step = RoutineBudgetRow['steps'][number];
const line = (id: string, amount: string | null, coa: string | null, order: number, isActive = true): Step =>
  // TAB13-04: the select grew by the line's activity and time_of_day; the month tables read neither.
  ({ id, is_active: isActive, budget_amount: amount === null ? null : dec(amount), coa_code: coa, step_order: order, activity: `line ${id}`, time_of_day: null });
// TAB13-02b: the select grew by id, name and end_date (the budget report's); the month tables read none of them.
const row = (over: Partial<RoutineBudgetRow>): RoutineBudgetRow =>
  ({ id: 'r1', name: 'a routine', end_date: null, budget_amount: null, coa_code: null, schedule_rrule: DAILY, timezone: 'UTC', start_date: null, steps: [], ...over });

// What the Personal route handed routinesMonthlyByCoa before this PR: no lines, no anchor.
const beforeInput = (r: RoutineBudgetRow) => ({
  budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null,
  coa_code: r.coa_code, schedule_rrule: r.schedule_rrule, timezone: r.timezone,
});

const month = (r: RoutineBudgetRow, m: number) => routinesMonthlyByCoa([toRoutineBudgetInput(r)], 2026, m);

test('a routine budgeted ONLY on its lines ($4.00 and $12.00, no routine-level figure) contributes each line × occurrences to its own account', () => {
  const lined = row({ steps: [line('coffee', '4.00', '5210', 0), line('lunch', '12.00', '5220', 1)] });
  assert.deepEqual(month(lined, SEP), { '5210': 4 * SEP_DAYS, '5220': 12 * SEP_DAYS });
  // Before: the Personal query refused this routine (routine-level budget_amount IS NULL),
  // and even handed over it would have contributed nothing — it had no lines to read.
  assert.deepEqual(routinesMonthlyByCoa([beforeInput(lined)], 2026, SEP), {});
});

test('the same routine with a routine-level $15.00 gives the identical figure — the lines win, the routine-level figure is set aside', () => {
  const lines = [line('coffee', '4.00', '5210', 0), line('lunch', '12.00', '5220', 1)];
  const onlyLines = row({ steps: lines });
  const both = row({ budget_amount: dec('15.00'), coa_code: '5200', steps: lines });
  assert.deepEqual(month(both, SEP), month(onlyLines, SEP));
  assert.equal(month(both, SEP)['5200'], undefined, 'the routine-level account attributes nothing');
  // Before: the Personal route used the $15.00 the rule sets aside.
  assert.deepEqual(routinesMonthlyByCoa([beforeInput(both)], 2026, SEP), { '5200': 15 * SEP_DAYS });
});

test('an archived line (is_active false) contributes nothing', () => {
  const r = row({ steps: [line('coffee', '4.00', '5210', 0), line('gone', '99.00', '5210', 1, false)] });
  assert.deepEqual(month(r, SEP), { '5210': 4 * SEP_DAYS });
});

test('a one-off (COUNT=1) dated 2026-09-26 counts once in September and in no other month', () => {
  const once = row({
    budget_amount: dec('45.00'), coa_code: '5300',
    schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0',
    timezone: 'America/Los_Angeles',
    start_date: new Date('2026-09-26T00:00:00.000Z'), // a @db.Date column reads back as UTC midnight
  });
  assert.deepEqual(month(once, 7), {}, 'nothing in August');
  assert.deepEqual(month(once, SEP), { '5300': 45 }, 'once in September');
  assert.deepEqual(month(once, 9), {}, 'nothing in October');
  // Before: with no anchor the single occurrence falls in 1971, so September showed nothing.
  assert.deepEqual(routinesMonthlyByCoa([beforeInput(once)], 2026, SEP), {});
});

test('a line with a NULL amount is absent from the result — never 0', () => {
  const r = row({ steps: [line('gym', null, '5230', 0), line('coffee', '4.00', '5210', 1)] });
  const sep = month(r, SEP);
  assert.deepEqual(sep, { '5210': 4 * SEP_DAYS });
  assert.equal('5230' in sep, false, 'the uncosted gym line puts no key, and no 0, on its account');
  // A routine whose only line is uncosted, with no routine-level figure, contributes nothing at all.
  assert.deepEqual(month(row({ steps: [line('gym', null, '5230', 0)] }), SEP), {});
});

test('the mapping turns Decimals into numbers and keeps null as null', () => {
  const input = toRoutineBudgetInput(row({ budget_amount: dec('15.50'), coa_code: '5200', steps: [line('a', '4.25', '5210', 0), line('b', null, null, 1)] }));
  assert.equal(input.budget_amount, 15.5);
  assert.equal(typeof input.budget_amount, 'number');
  assert.equal(input.steps?.[0].budget_amount, 4.25);
  assert.equal(input.steps?.[1].budget_amount, null);
  assert.equal(input.steps?.[1].coa_code, null);
  assert.equal(toRoutineBudgetInput(row({})).budget_amount, null, 'a blank routine-level figure stays blank');
});

test('both budget routes read routines through the one loader, and the loader filters on nothing but the user, the entity and is_active', () => {
  for (const f of [PERSONAL, BUSINESS]) {
    const body = code(f);
    assert.match(body, /import \{ loadRoutineBudgetInputs \} from '@\/lib\/operations\/routineBudgetInputs';/, `${f} imports the loader`);
    assert.match(body, /const routineInputs = await loadRoutineBudgetInputs\(prisma, user\.id, \w+Entity\.id\);/, `${f} reads through it`);
    assert.doesNotMatch(body, /operations_routines\.findMany/, `${f} keeps no query of its own`);
    assert.doesNotMatch(body, /budget_amount: \{ not: null \}/, `${f} does not hide a lined routine`);
  }
  const loader = code(LOADER);
  assert.match(loader, /where: \{ user_id: userId, entity_id: entityId, is_active: true \},/);
  // TAB13-04: the lines' select grew, additively, by the words the day's plan lines print.
  assert.match(loader, /steps: \{ where: \{ is_active: true \}, select: \{ id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true \} \}/);
  assert.match(loader, /start_date: true,/);
  assert.match(loader, /start_date: r\.start_date,/);
});
