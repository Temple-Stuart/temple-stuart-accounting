/**
 * The lines law's seeded regressions for the clauses LINES-02 adds (2026-09-27).
 *
 * LINES-02 moved the routine read behind both budget routes into ONE loader
 * (src/lib/operations/routineBudgetInputs.ts) and taught the lines law to hold
 * every API file that builds a monthly budget from routines to it. These five
 * seeds are those clauses, each the shape the code had — or could drift back to:
 *
 *   · a budget route reads routines its own way again: a query of its own in the
 *     loader's place, no lines, no start_date (clause: through the loader);
 *   · the loader stops reading the lines (clause: active lines);
 *   · the loader stops reading start_date (clause: the one-off anchor);
 *   · the loader filters on money (clause: no routine-level filter);
 *   · a budget route keeps the loader but adds a routine query beside it
 *     (clause: no query of its own).
 *
 * HOME-LEDGER-02b (Alex, 2026-11-07, ruling D): the bridges the law names are the
 * two Budget routes — /api/budget/report and /api/budget/report/cell — now that the
 * cockpit's hub routes (year-calendar, business-budget) are deleted; lines-a is
 * re-seeded against the report route and lines-e against the cell route. The three
 * loader seeds (b, c, d) are unchanged.
 *
 * Each must fail THE LINES LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const REPORT = 'src/app/api/budget/report/route.ts';
const CELL = 'src/app/api/budget/report/cell/route.ts';

export const SEEDS: Seed[] = [
  {
    name: 'lines-a the report route reads routines its own way again (a query of its own in the loader\'s place: no lines, no anchor)',
    file: REPORT,
    find: '      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id) }))),',
    replace: [
      '      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: (await prisma.operations_routines.findMany({',
      '        where: { user_id: user.id, entity_id: e.id, is_active: true },',
      '        select: { id: true, name: true, end_date: true, budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true },',
      '      })).map((r) => ({ ...r, is_active: true, role: \'none\', start_date: null, budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null, steps: [] })) }))),',
    ].join('\n'),
    expect: 'src/app/api/budget/report/route.ts does not read routines through loadRoutineBudgetInputs()',
  },
  {
    name: 'lines-b the loader stops reading the lines',
    file: LOADER,
    // TAB13-04: the select grew by the line's activity and time_of_day — the anchor follows it; the seed still removes the whole read.
    // SUPERSEDE-01a (Alex, 2026-11-07, SUPERSEDE-00 ruling 4): and by duration_minutes — the anchor follows it again.
    find: '  steps: { where: { is_active: true }, select: { id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true, duration_minutes: true } },',
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
    // ROUTINES-03 (Alex, 2026-10-25, ruling C) grew the where by the includeInactive option; HOME-LEDGER-02b (2026-11-07) re-reads
    // the anchor where it stands — the clause this seed proves is unchanged.
    find: '    where: { user_id: userId, entity_id: entityId, ...(options.includeInactive === true ? {} : { is_active: true }) },',
    replace: '    where: { user_id: userId, entity_id: entityId, ...(options.includeInactive === true ? {} : { is_active: true }), budget_amount: { not: null } },',
    expect: 'filters routines on a routine-level column',
  },
  {
    name: 'lines-e the cell route adds a routine query beside the loader',
    file: CELL,
    find: '      loadRoutineBudgetInputs(prisma, user.id, book.id),',
    replace: '      Promise.all([loadRoutineBudgetInputs(prisma, user.id, book.id), prisma.operations_routines.findMany({ where: { user_id: user.id, entity_id: book.id, is_active: true }, select: { id: true, budget_amount: true } })]).then(([rows]) => rows),',
    expect: 'src/app/api/budget/report/cell/route.ts reads routines with a query of its own beside the loader',
  },
];
