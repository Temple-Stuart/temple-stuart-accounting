/**
 * The lines law's seeded regressions for the clauses LINES-02 adds (2026-09-27).
 *
 * LINES-02 moved the routine read behind both budget routes into ONE loader
 * (src/lib/operations/routineBudgetInputs.ts) and taught the lines law to hold
 * every API file that builds a monthly budget from routines to it. These five
 * seeds are those clauses, each the shape the code had — or could drift back to:
 *
 *   · the Personal route gets its pre-LINES-02 read back: routine-level
 *     budget_amount/coa_code NOT NULL, no lines, no start_date (clause: inputs
 *     not built by the loader);
 *   · the loader stops reading the lines (clause: active lines);
 *   · the loader stops reading start_date (clause: the one-off anchor);
 *   · the loader filters on money (clause: no routine-level filter);
 *   · the Business route keeps the loader but adds a routine query beside it
 *     (clause: no query of its own).
 *
 * Each must fail THE LINES LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const PERSONAL = 'src/app/api/hub/year-calendar/route.ts';
const BUSINESS = 'src/app/api/hub/business-budget/route.ts';

export const SEEDS: Seed[] = [
  {
    name: 'lines-a the Personal route reads routines its own way again (no lines, no anchor, routine-level filter)',
    file: PERSONAL,
    find: '      const routineInputs = await loadRoutineBudgetInputs(prisma, user.id, personalEntity.id);',
    replace: [
      '      const budgetedRoutines = await prisma.operations_routines.findMany({',
      '        where: { user_id: user.id, entity_id: personalEntity.id, is_active: true, budget_amount: { not: null }, coa_code: { not: null } },',
      '        select: { budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true },',
      '      });',
      '      const routineInputs = budgetedRoutines.map(r => ({ budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null, coa_code: r.coa_code, schedule_rrule: r.schedule_rrule, timezone: r.timezone }));',
    ].join('\n'),
    expect: 'calls routinesMonthlyByCoa with inputs not built by src/lib/operations/routineBudgetInputs.ts',
  },
  {
    name: 'lines-b the loader stops reading the lines',
    file: LOADER,
    // TAB13-04: the select grew by the line's activity and time_of_day — the anchor follows it; the seed still removes the whole read.
    find: '  steps: { where: { is_active: true }, select: { id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true } },',
    replace: '',
    expect: "does not hand the leaf the routine's active lines",
  },
  {
    name: 'lines-c the loader stops reading start_date',
    file: LOADER,
    find: '  start_date: true,',
    replace: '',
    expect: 'does not read start_date',
  },
  {
    name: 'lines-d the loader filters routines on the routine-level amount',
    file: LOADER,
    find: '    where: { user_id: userId, entity_id: entityId, is_active: true },',
    replace: '    where: { user_id: userId, entity_id: entityId, is_active: true, budget_amount: { not: null } },',
    expect: 'filters routines on a routine-level column',
  },
  {
    name: 'lines-e the Business route adds a routine query beside the loader',
    file: BUSINESS,
    find: '      const routineInputs = await loadRoutineBudgetInputs(prisma, user.id, businessEntity.id);',
    replace: '      const routineInputs = [...(await loadRoutineBudgetInputs(prisma, user.id, businessEntity.id)), ...(await prisma.operations_routines.findMany({ where: { user_id: user.id, is_active: true }, select: { budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true } })).map((r) => ({ ...r, budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null }))];',
    expect: 'reads routines with a query of its own beside the loader',
  },
];
