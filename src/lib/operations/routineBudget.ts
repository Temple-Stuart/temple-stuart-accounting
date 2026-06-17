import { expandBetween } from './rruleHelpers';

/**
 * routineBudget (HB-4c) — turn a budgeted routine into a MONTHLY budget figure by COUNTING its
 * real occurrences in the month (NOT assuming a fixed weekly×4). Pure functions, no DB, no writes.
 *
 *   monthly = expandBetween(schedule_rrule, timezone, monthStart, monthEnd).length × budget_amount
 *
 * Reuses the SAME recurrence helper the calendar feed uses (rruleHelpers.expandBetween,
 * /api/hub/operations-routines/route.ts:147) — no new recurrence logic. budget_amount is
 * PER-OCCURRENCE (operations_routines schema + the routine form's "budget / occurrence" label).
 *
 * NO FALLBACK: a routine with no budget_amount OR no coa_code contributes NOTHING (returns null) —
 * an honest absence, never a guessed default account or a fabricated amount. A malformed rrule is
 * skipped (contributes nothing), mirroring the feed's skip-malformed posture (route.ts:148) — that
 * is "no computable schedule ⇒ no budget", not a silent default value.
 */

export interface RoutineBudgetInput {
  /** Per-occurrence amount (Prisma Decimal → string in JSON, or a number). null = no budget. */
  budget_amount: number | string | null;
  /** Bare chart_of_accounts.code (e.g. "B-9200"); null = unattributed. */
  coa_code: string | null;
  schedule_rrule: string;
  timezone: string;
}

/** UTC bounds of a calendar month: [first instant, last instant]. monthIdx is 0-indexed. The
 *  inclusive upper bound is the month's last ms, so an adjacent month's call (from = next-month
 *  start) never double-counts a boundary occurrence. */
function monthBounds(year: number, monthIdx: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0) - 1);
  return { from, to };
}

/**
 * The monthly budget a SINGLE routine contributes, attributed to its COA. Returns null when the
 * routine has no budget, no COA, a malformed/empty schedule, or zero occurrences that month.
 */
export function routineMonthlyByCoa(
  routine: RoutineBudgetInput,
  year: number,
  monthIdx: number,
): { coaCode: string; amount: number } | null {
  const perOccurrence = routine.budget_amount == null ? null : Number(routine.budget_amount);
  if (perOccurrence == null || !Number.isFinite(perOccurrence) || perOccurrence <= 0) return null; // no budget
  if (!routine.coa_code) return null; // no COA → can't attribute → skip (no default account)

  const { from, to } = monthBounds(year, monthIdx);
  let count: number;
  try {
    count = expandBetween(routine.schedule_rrule, routine.timezone, from, to).length;
  } catch {
    return null; // malformed rrule → contributes nothing (mirrors the feed's skip-malformed)
  }
  if (count <= 0) return null;

  return { coaCode: routine.coa_code, amount: Math.round(perOccurrence * count * 100) / 100 };
}

/**
 * Sum many routines' monthly budgets BY COA — the shape the HB-4d bridge merges into
 * budgetData[coaCode][month]. Routines with no budget/COA are simply absent from the map.
 */
export function routinesMonthlyByCoa(
  routines: RoutineBudgetInput[],
  year: number,
  monthIdx: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of routines) {
    const c = routineMonthlyByCoa(r, year, monthIdx);
    if (c) out[c.coaCode] = Math.round(((out[c.coaCode] || 0) + c.amount) * 100) / 100;
  }
  return out;
}
