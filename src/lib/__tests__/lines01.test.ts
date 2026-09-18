import test from 'node:test';
import assert from 'node:assert/strict';
import { ignoredLine, plannedLine, routinePlanned } from '../operations/routineLines';
import { routineMonthlyByCoa, routinesMonthlyByCoa } from '../operations/routineBudget';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { buildDay, dayParts } from '../calendar/day';
import { buildChain, buildDrill } from '../calendar/chain';
import { sumLinks } from '../calendar/links';
import { LINKABLE_KINDS, requiresInstant } from '../calendar/linkKeys';
import { code } from '../sourceText';

// LINES-01 — a routine is made of lines, and each line carries its own cost and category.

const MIGRATION = 'prisma/migrations/20260918090000_lines_01_step_cost_and_coa/migration.sql';
const MORNING = {
  budget_amount: 15, coa_code: '5200',   // a routine-level figure, to be SET ASIDE
  steps: [
    { id: 's-gym', step_order: 0, activity: 'Gym', time_of_day: '1970-01-01T07:00:00.000Z', budget_amount: null, coa_code: null },
    { id: 's-coffee', step_order: 1, activity: 'Coffee', time_of_day: '1970-01-01T08:15:00.000Z', budget_amount: '80', coa_code: '5200' },
    { id: 's-dine', step_order: 2, activity: 'Dining out', time_of_day: '1970-01-01T12:30:00.000Z', budget_amount: 200, coa_code: null },
  ],
};
const STEPLESS = { budget_amount: '15', coa_code: '5200', steps: [] };

test('THE RULE: a routine with three lines (one uncosted) shows $280 across 2 of 3, and never adds the routine-level figure', () => {
  const p = routinePlanned(MORNING);
  assert.equal(p.from, 'lines');
  assert.equal(p.amount, 280, '80 + 200 — NOT 80 + 200 + 15');
  assert.deepEqual(p.coverage, { counted: 2, of: 3 });
  assert.equal(plannedLine(p), '$280 across 2 of 3 lines');
  // The uncosted gym line is BLANK, never 0.
  assert.equal(p.lines.find((l) => l.id === 's-gym')!.amount, null);
  // The routine-level figure is REPORTED as set aside, not silently dropped.
  assert.equal(p.ignoredRoutineLevel, 15);
  assert.match(ignoredLine(p)!, /routine-level \$15 is set aside/);
  // And its COA attributes nothing: the lines carry their own.
  assert.equal(p.coaCode, null);
  assert.deepEqual(p.byCoa, { '5200': 80 }, 'the coffee line to its account; the dining line has none');
  assert.equal(p.unattributed, 200, 'in the total, attributable to nothing');
});

test('a stepless routine with a routine-level $15 shows $15 — the field is not dropped', () => {
  const p = routinePlanned(STEPLESS);
  assert.equal(p.from, 'routine');
  assert.equal(p.amount, 15);
  assert.equal(p.coaCode, '5200');
  assert.equal(p.ignoredRoutineLevel, null);
  assert.equal(ignoredLine(p), null);
  assert.equal(plannedLine(p), '$15 / occurrence');
  assert.deepEqual(p.byCoa, { '5200': 15 });
});

test('a routine with lines that carry NO amount falls through to the routine-level figure', () => {
  const p = routinePlanned({ budget_amount: 15, coa_code: '5200', steps: [{ id: 'a', activity: 'Stretch', budget_amount: null, coa_code: null }] });
  assert.equal(p.from, 'routine');
  assert.equal(p.amount, 15);
  assert.deepEqual(p.coverage, { counted: 0, of: 1 });
  // And nothing anywhere: no amount, from 'none', and no chain later.
  const none = routinePlanned({ budget_amount: null, coa_code: null, steps: [] });
  assert.equal(none.from, 'none');
  assert.equal(none.amount, null);
  assert.equal(plannedLine(none), 'no amount');
});

test('an archived line contributes nothing; an absent flag means active (the feeds filter server-side)', () => {
  const p = routinePlanned({ budget_amount: null, coa_code: null, steps: [
    { id: 'live', is_active: true, budget_amount: 10, coa_code: '1' },
    { id: 'gone', is_active: false, budget_amount: 999, coa_code: '1' },
    { id: 'vetted', budget_amount: 5, coa_code: '1' },
  ] });
  assert.equal(p.amount, 15);
  assert.equal(p.coverage.of, 2);
});

test('MONTH AND DAY AGREE, for both shapes', () => {
  const rrule = 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0';
  const tz = 'UTC';
  // September 2026 has 30 days → 30 occurrences.
  const monthLined = routineMonthlyByCoa({ ...MORNING, schedule_rrule: rrule, timezone: tz }, 2026, 8);
  assert.deepEqual(monthLined, { '5200': 80 * 30 }, 'the coffee line × occurrences, to its account; the uncategorised $200 attributes to nothing');
  const monthStepless = routineMonthlyByCoa({ ...STEPLESS, schedule_rrule: rrule, timezone: tz }, 2026, 8);
  assert.deepEqual(monthStepless, { '5200': 15 * 30 });

  // The DAY: one occurrence through the real mapper into the real day leaf.
  const window = (r: typeof MORNING | typeof STEPLESS, name: string) => ({
    routines: [{
      routine_id: `r-${name}`, name, entity_id: 'e', timezone: tz,
      start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T09:00:00.000Z',
      occurrences: ['2026-09-19T07:00:00.000Z'],
      coa_code: r.coa_code, budget_amount: typeof r.budget_amount === 'string' ? Number(r.budget_amount) : r.budget_amount,
      steps: r.steps.map((s) => ({ ...s, is_active: true, time_of_day: s.time_of_day ?? null, budget_amount: s.budget_amount == null ? null : Number(s.budget_amount) })),
    }],
    truncated: false,
  });
  const linedTile = mapOperationsRoutines(window(MORNING, 'morning'))[0];
  assert.equal(linedTile.budgetAmount, 280, 'the day tile carries the sum of the lines');
  assert.equal(linedTile.coaCode, null, 'and NO single chip for a routine with three accounts');
  const steplessTile = mapOperationsRoutines(window(STEPLESS, 'stepless'))[0];
  assert.equal(steplessTile.budgetAmount, 15);
  assert.equal(steplessTile.coaCode, '5200');

  // The day's Routines part sums the tiles — the same figures the month is built from.
  const rows = buildDay([linedTile, steplessTile].map((t) => ({ ...t, budgetAmount: t.budgetAmount ?? null })), '2026-09-19');
  const parts = dayParts(rows);
  const routines = parts.parts.find((p) => p.key === 'routines')!;
  assert.equal(routines.total.total, 295, '$280 + $15 — the day agrees with the month, per occurrence');
  assert.equal(routines.total.covered, 2);
  // And per occurrence, month ÷ occurrences === the day's figure, for each shape.
  assert.equal(Object.values(monthLined).reduce((a, b) => a + b, 0) / 30, 80, 'the attributable part per day');
  assert.equal(routinePlanned(MORNING).amount, 280, 'the whole figure per day, uncategorised included');
  assert.equal(Object.values(monthStepless)[0] / 30, steplessTile.budgetAmount);
});

test('the day-blocks bridge and the month never add routine-level and line-level amounts', () => {
  // A routine with BOTH a routine-level $15 and a $80 coffee line contributes 80 per
  // occurrence to the month — not 95.
  const both = routinesMonthlyByCoa([{ budget_amount: 15, coa_code: '5200', steps: [{ id: 'c', budget_amount: 80, coa_code: '5200' }], schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', timezone: 'UTC' }], 2026, 8);
  assert.deepEqual(both, { '5200': 2400 });
});

test('a coffee posting linked to the coffee LINE moves the line and the occurrence to settled', () => {
  const coffeeLinks = sumLinks([{ journalEntryId: 'je-coffee', date: '2026-09-19', description: 'CAFE', amountCents: 8000 }]);
  assert.equal(coffeeLinks.actual, 80);
  // The occurrence's actual is the sum of its lines' actuals — the pooled links, summed once.
  const occurrence = sumLinks([
    { journalEntryId: 'je-coffee', date: '2026-09-19', description: 'CAFE', amountCents: 8000 },
  ]);
  const chain = buildChain({ kind: 'routine', planned: 280, actual: occurrence.actual, actualSource: 'linked', linkLine: 'linked to 1 posting in Books' })!;
  assert.equal(chain.state, 'PLANNED_AND_SETTLED');
  assert.equal(chain.actualSource, 'linked');
  // Unlinked, the occurrence is NOT LINKED — never $0.
  assert.equal(buildChain({ kind: 'routine', planned: 280, actual: sumLinks([]).actual })!.state, 'NOT_LINKED');
});

test("the link's new kind is 'routine_line', keyed on the instant like 'routine' — and 'routine' is never repurposed", () => {
  assert.deepEqual([...LINKABLE_KINDS], ['calendar_event', 'project_task', 'routine', 'routine_line']);
  assert.equal(requiresInstant('routine_line'), true);
  assert.equal(requiresInstant('routine'), true);
  const m = code(MIGRATION);
  assert.match(m, /CHECK \("target_kind" IN \('calendar_event', 'project_task', 'routine', 'routine_line'\)\)/);
  assert.match(m, /CHECK \(\("target_kind" IN \('routine', 'routine_line'\)\) = \("target_instant" IS NOT NULL\)\)/);
  // No link is migrated. No line amount is imputed. Nothing is dropped.
  assert.doesNotMatch(m, /(^|\n)\s*UPDATE\s+"/);
  assert.doesNotMatch(m, /INSERT INTO/);
  assert.doesNotMatch(m, /DROP COLUMN/);
  assert.doesNotMatch(m, /DEFAULT 0/);
  assert.match(m, /ADD COLUMN "budget_amount" DECIMAL\(12,2\)/);
  assert.match(m, /ADD COLUMN "coa_code"\s+VARCHAR\(50\)/);
});

test('THE MIGRATION LEAVES EVERY EXISTING ROUTINE\'S FIGURE UNCHANGED — before/after on both shapes', () => {
  // BEFORE the migration no step carries an amount (the columns did not exist).
  // AFTER it, they exist and are NULL. The rule falls through to the routine-level
  // field in both states, for both shapes — so the figure is the same number.
  const before = (r: { budget_amount: number | null; coa_code: string | null; steps: { id: string }[] }) =>
    routinePlanned({ budget_amount: r.budget_amount, coa_code: r.coa_code, steps: r.steps.map((s) => ({ id: s.id })) });
  const after = (r: { budget_amount: number | null; coa_code: string | null; steps: { id: string }[] }) =>
    routinePlanned({ budget_amount: r.budget_amount, coa_code: r.coa_code, steps: r.steps.map((s) => ({ id: s.id, budget_amount: null, coa_code: null })) });
  const stepless = { budget_amount: 15, coa_code: '5200', steps: [] };
  const lined = { budget_amount: 15, coa_code: '5200', steps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  const unbudgeted = { budget_amount: null, coa_code: null, steps: [{ id: 'a' }] };
  for (const r of [stepless, lined, unbudgeted]) {
    assert.equal(before(r).amount, after(r).amount);
    assert.equal(before(r).from, after(r).from);
    assert.deepEqual(before(r).byCoa, after(r).byCoa);
  }
  assert.equal(after(lined).amount, 15, 'a lined routine with no costed line still reads its routine-level figure');
});

test('the drill row carries the lines, the coverage and the set-aside figure for a lined occurrence only', () => {
  const lines = [
    { stepId: 's-gym', activity: 'Gym', timeOfDay: '07:00', amount: null, coaCode: null },
    { stepId: 's-coffee', activity: 'Coffee', timeOfDay: '08:15', amount: 80, coaCode: '5200' },
  ];
  const row = buildDrill({ id: 'routine:r1:2026-09-19T07:00:00.000Z', source: 'routines', title: 'Morning', startDate: '2026-09-19', budgetAmount: 80 }, null, { lines, coverage: { counted: 1, of: 2 }, ignoredRoutineLevel: 15 });
  assert.equal(row.lines?.length, 2);
  assert.deepEqual(row.lineCoverage, { counted: 1, of: 2 });
  assert.equal(row.ignoredRoutineLevel, 15);
  const stepless = buildDrill({ id: 'routine:r2:2026-09-19T07:00:00.000Z', source: 'routines', title: 'Walk', startDate: '2026-09-19', budgetAmount: 15 }, null, { lines: [], coverage: { counted: 0, of: 0 }, ignoredRoutineLevel: null });
  assert.equal(stepless.lines, undefined);
  const event = buildDrill({ id: 'e1', source: 'manual', title: 'x', startDate: '2026-09-19', budgetAmount: 1 }, null, { lines, coverage: { counted: 1, of: 2 }, ignoredRoutineLevel: null });
  assert.equal(event.lines, undefined, 'lines are a routine thing');
});

test('every HB-4a reader reads the leaf — none restates the rule', () => {
  for (const f of [
    'src/lib/operations/routineBudget.ts',
    'src/lib/hub/mapOperationsRoutines.ts',
    'src/components/workbench/operations/routines/RoutineRow.tsx',
    'src/components/workbench/operations/routines/TodaysStrip.tsx',
    'src/components/hub/HubCalendar.tsx',
  ]) assert.match(code(f), /routinePlanned\(/, `${f} reads the leaf`);
  // The HB-4d bridge reads it THROUGH routinesMonthlyByCoa, and no longer hides a
  // lined routine with blank routine-level fields.
  const bridge = code('src/app/api/hub/business-budget/route.ts');
  assert.match(bridge, /routinesMonthlyByCoa/);
  assert.doesNotMatch(bridge, /budget_amount: \{ not: null \}/);
  assert.match(bridge, /steps: \{ where: \{ is_active: true \}/);
  // The window feed carries the lines.
  assert.match(code('src/app/api/hub/operations-routines/route.ts'), /include: \{ steps: \{ where: \{ is_active: true \}/);
  // The census cites the leaf.
  assert.match(code('src/lib/calendar/chain.ts'), /routinePlanned\(\) over operations_routine_steps\.budget_amount/);
  // The step editor uses the SAME picker HB-4a uses.
  const editor = code('src/components/workbench/operations/routines/RoutineStepList.tsx');
  assert.match(editor, /<CoaSelect/);
  assert.match(editor, /data-step-amount/);
  // The panel drops the routine-level Category row for a lined routine.
  const panel = code('src/components/hub/EventDetailPanel.tsx');
  assert.match(panel, /!\(row\.lines && row\.lines\.length > 0\) && \(\s*<Row label="Category \(COA\)"/);
  assert.match(panel, /data-drill-lines-total/);
});
