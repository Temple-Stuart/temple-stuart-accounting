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
 *
 * TAB13-02b (2026-09-27): the budget report (/api/budget/report) reads routines
 * here too — the same read, not a second one. It needs a routine's id, name and
 * end_date as well, so the select and the mapping GREW by those three columns,
 * additively: every field the month tables read is unchanged, and
 * routinesMonthlyByCoa() ignores the three it does not take.
 *
 * TAB13-04 (2026-09-29): the report lists the day's plan lines by their words, so
 * a line's activity and time_of_day are read here too — the same read, grown
 * additively again. The time is read ONCE, here: a @db.Time value's UTC parts as
 * 'HH:MM', as src/lib/calendar/ics.ts:133-135 reads one — so it is the string
 * RoutineLineInput already types (routineLines.ts). The month tables read neither.
 */

/** The columns a routine's monthly budget is built from — the lines and the anchor included. */
export const ROUTINE_BUDGET_SELECT = {
  // TAB13-02b: who the routine is and the last day it counts — the budget report's, additive.
  id: true, name: true, end_date: true,
  budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true,
  // ONEOFF-01: the anchor the month's occurrence count is built on.
  start_date: true,
  // LINES-01: the routine's active lines; routinePlanned() decides whether they carry the figure.
  steps: { where: { is_active: true }, select: { id: true, is_active: true, budget_amount: true, coa_code: true, step_order: true, activity: true, time_of_day: true } },
} as const;

export type RoutineBudgetRow = Prisma.operations_routinesGetPayload<{ select: typeof ROUTINE_BUDGET_SELECT }>;

/**
 * What the loader hands back: the input routinesMonthlyByCoa() takes, plus the
 * routine's id, name and end_date (TAB13-02b). The month tables read it as a
 * RoutineBudgetInput and never see the three.
 */
export interface LoadedRoutineBudgetInput extends RoutineBudgetInput {
  id: string;
  name: string;
  start_date: Date | null;
  end_date: Date | null;
  /** TAB13-04: activity and time_of_day ('HH:MM', or null when the line has no time) are the day's plan lines' words — the month tables read neither. */
  steps: { id: string; is_active: boolean; budget_amount: number | null; coa_code: string | null; step_order: number; activity: string; time_of_day: string | null }[];
}

/** A row as read → the input routinesMonthlyByCoa() takes. Decimal → number; null stays null, never 0. */
export function toRoutineBudgetInput(r: RoutineBudgetRow): LoadedRoutineBudgetInput {
  return {
    id: r.id,
    name: r.name,
    end_date: r.end_date,
    budget_amount: r.budget_amount != null ? Number(r.budget_amount) : null,
    coa_code: r.coa_code,
    schedule_rrule: r.schedule_rrule,
    timezone: r.timezone,
    start_date: r.start_date,
    steps: r.steps.map((s) => ({ id: s.id, is_active: s.is_active, budget_amount: s.budget_amount != null ? Number(s.budget_amount) : null, coa_code: s.coa_code, step_order: s.step_order, activity: s.activity, time_of_day: s.time_of_day === null ? null : s.time_of_day.toISOString().slice(11, 16) })),
  };
}

/** Every active routine of one entity, as budget inputs. No filter on money — the leaf decides. */
export async function loadRoutineBudgetInputs(
  db: Pick<PrismaClient, 'operations_routines'>,
  userId: string,
  entityId: string,
): Promise<LoadedRoutineBudgetInput[]> {
  const rows = await db.operations_routines.findMany({
    where: { user_id: userId, entity_id: entityId, is_active: true },
    select: ROUTINE_BUDGET_SELECT,
  });
  return rows.map(toRoutineBudgetInput);
}
