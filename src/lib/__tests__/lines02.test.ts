import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { toRoutineBudgetInput, type RoutineBudgetRow } from '../operations/routineBudgetInputs';
import { code } from '../sourceText';

// LINES-02 — the Personal budget reads a routine's lines and its anchor, the way
// Business already does: one loader builds the inputs for both budget routes.
//
// HOME-LEDGER-02b (Alex, 2026-11-07, rulings C, D, F): the hub routes (year-calendar,
// business-budget) and routinesMonthlyByCoa are deleted — the month is the day lines'
// sum, one budget model. The five month-table cases this file held retired where
// budgetDays.test.ts proves the same rule through buildRoutineBudgetLines (lines win:
// 'R2 ROUTINE MONEY — lines win'; a one-off counts once: R1 'a one-off (COUNT=1)'),
// and the three with no equivalent there (a routine budgeted only on its lines; an
// archived line contributes nothing; a NULL amount is absent, never 0) were ADDED to
// budgetDays.test.ts first. The mapping and the loader pins below stand; the loader
// pins are re-pointed to the two Budget routes.

const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const REPORT = 'src/app/api/budget/report/route.ts';
const CELL = 'src/app/api/budget/report/cell/route.ts';

const DAILY = 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0';

const dec = (v: string) => new Prisma.Decimal(v);
type Step = RoutineBudgetRow['steps'][number];
const line = (id: string, amount: string | null, coa: string | null, order: number, isActive = true): Step =>
  // TAB13-04: the select grew by the line's activity and time_of_day; the month tables read neither.
  ({ id, is_active: isActive, budget_amount: amount === null ? null : dec(amount), coa_code: coa, step_order: order, activity: `line ${id}`, time_of_day: null, duration_minutes: null });
// TAB13-02b: the select grew by id, name and end_date (the budget report's); the month tables read none of them.
// COLUMNS-01 (Alex, 2026-10-25, ruling A): the select grew by the routine's own is_active (the month route reads inactive routines too); the month tables read it not.
// BILLPAY-01 (Alex, 2026-10-28, ruling C): and by the routine's role (Bill Pay keeps the all_day ones); the month tables read it not.
const row = (over: Partial<RoutineBudgetRow>): RoutineBudgetRow =>
  ({ id: 'r1', name: 'a routine', is_active: true, role: 'none', end_date: null, budget_amount: null, coa_code: null, schedule_rrule: DAILY, timezone: 'UTC', start_date: null, start_time: null, end_time: null, steps: [], ...over });

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
  // HOME-LEDGER-02b (Alex, 2026-11-07, ruling D): the two Budget routes — the report reads per entity, the cell per book.
  for (const f of [REPORT, CELL]) {
    const body = code(f);
    assert.match(body, /import \{ loadRoutineBudgetInputs \} from '@\/lib\/operations\/routineBudgetInputs';/, `${f} imports the loader`);
    assert.match(body, /loadRoutineBudgetInputs\(prisma, user\.id, (e|book)\.id\)/, `${f} reads through it`);
    assert.doesNotMatch(body, /operations_routines\.findMany/, `${f} keeps no query of its own`);
    assert.doesNotMatch(body, /budget_amount: \{ not: null \}/, `${f} does not hide a lined routine`);
  }
  const loader = code(LOADER);
  // ROUTINES-03 (Alex, 2026-10-25, ruling C): the routines' month route reads active AND inactive routines through the same loader — one option,
  // off by default, so both budget routes still read the active ones alone; the pin moved to the option's two branches.
  assert.match(loader, /where: \{ user_id: userId, entity_id: entityId, \.\.\.\(options\.includeInactive === true \? \{\} : \{ is_active: true \}\) \},/);
  assert.match(loader, /options: \{ readonly includeInactive\?: boolean \} = \{\},/);
  for (const f of [REPORT, CELL]) assert.doesNotMatch(code(f), /includeInactive/, `${f} reads the active ones, as before`);
  // TAB13-04: the lines' select grew, additively, by the words the day's plan lines print. SUPERSEDE-01a (2026-11-07): and by duration_minutes, carried, consumed by nothing until 01b.
  assert.match(loader, /steps: \{ where: \{ is_active: true \}, select: \{ id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true, duration_minutes: true \} \}/);
  assert.match(loader, /start_date: true,/);
  assert.match(loader, /start_date: r\.start_date,/);
});
