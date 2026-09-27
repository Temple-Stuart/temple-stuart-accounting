import type { Prisma, PrismaClient } from '@prisma/client';
import type { RoutineBudgetInput } from './routineBudget';

/**
 * LINES-02 — ONE LOADER BUILDS A ROUTINE'S BUDGET INPUTS, FOR EVERY BUDGET ROUTE.
 *
 * THE DEFECT THIS CLOSES. The Personal budget (/api/hub/year-calendar) read
 * routines with its own query: it kept only routines whose ROUTINE-LEVEL
 * budget_amount and coa_code were both set, and it selected neither the lines
 * nor start_date. The Business budget (/api/hub/business-budget) read every
 * active routine with its active lines and its start date. The same routine
 * therefore had two monthly figures depending on which book it sat in:
 *   · a routine budgeted only on its lines was DROPPED from Personal;
 *   · a routine with both used the routine-level figure LINES-01 sets aside;
 *   · a one-off expanded from the fixed 1971 anchor, so it landed in no month.
 *
 * THE SHAPE. The select, the row → input mapping and the query live here, once.
 * Both routes call loadRoutineBudgetInputs(); the monthly figure is still
 * routinesMonthlyByCoa() in routineBudget.ts, and what a routine contributes is
 * still decided by routinePlanned() in routineLines.ts — never here. This file
 * does not filter on money: every active routine is read, and the leaf decides.
 *
 * SERVER-SIDE BY USE. Only API routes import the loader, and the client is
 * handed in, so the pure mapping below can be tested without a database.
 */

/** The columns a routine's monthly budget is built from — the lines and the anchor included. */
export const ROUTINE_BUDGET_SELECT = {
  budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true,
  // ONEOFF-01: the anchor the month's occurrence count is built on.
  start_date: true,
  // LINES-01: the routine's active lines; routinePlanned() decides whether they carry the figure.
  steps: { where: { is_active: true }, select: { id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true } },
} as const;

export type RoutineBudgetRow = Prisma.operations_routinesGetPayload<{ select: typeof ROUTINE_BUDGET_SELECT }>;

/** A row as read → the input routinesMonthlyByCoa() takes. Decimal → number; null stays null, never 0. */
export function toRoutineBudgetInput(r: RoutineBudgetRow): RoutineBudgetInput {
  return {
    budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null,
    coa_code: r.coa_code,
    schedule_rrule: r.schedule_rrule,
    timezone: r.timezone,
    start_date: r.start_date,
    steps: r.steps.map((s) => ({ id: s.id, is_active: s.is_active, budget_amount: s.budget_amount != null ? Number(s.budget_amount) : null, coa_code: s.coa_code, step_order: s.step_order })),
  };
}

/** Every active routine of one entity, as budget inputs. No filter on money — the leaf decides. */
export async function loadRoutineBudgetInputs(
  db: Pick<PrismaClient, 'operations_routines'>,
  userId: string,
  entityId: string,
): Promise<RoutineBudgetInput[]> {
  const rows = await db.operations_routines.findMany({
    where: { user_id: userId, entity_id: entityId, is_active: true },
    select: ROUTINE_BUDGET_SELECT,
  });
  return rows.map(toRoutineBudgetInput);
}
