import { expandBetween } from './rruleHelpers';
import { routinePlanned, type RoutineLineInput } from './routineLines';

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
  /**
   * LINES-01: the routine's active lines. When any carries an amount, the
   * monthly figure is built from the LINES (each to its own COA) and the two
   * fields above are set aside — the rule in routineLines.ts, read here, not
   * restated. Absent or empty ⇒ the routine-level fields stand, as before.
   */
  steps?: readonly RoutineLineInput[] | null;
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
 * The monthly budget a SINGLE routine contributes, PER COA. Returns an empty map when the routine
 * has nothing attributable, a malformed/empty schedule, or zero occurrences that month.
 *
 * LINES-01: per-occurrence money comes from routinePlanned() — the sum of the lines when any
 * carries an amount (each line to its own account; a costed line with no account is in the
 * routine's total but attributable to nothing), else the routine-level pair. The two are never
 * added. This function used to return ONE (coa, amount); a lined routine can span several
 * accounts, so it returns the map and routinesMonthlyByCoa merges it.
 */
export function routineMonthlyByCoa(
  routine: RoutineBudgetInput,
  year: number,
  monthIdx: number,
): Record<string, number> {
  const planned = routinePlanned({ budget_amount: routine.budget_amount, coa_code: routine.coa_code, steps: routine.steps ?? null });
  const attributable = Object.entries(planned.byCoa).filter(([, amt]) => Number.isFinite(amt) && amt > 0);
  if (attributable.length === 0) return {}; // no budget, or money with no account → nothing to attribute

  const { from, to } = monthBounds(year, monthIdx);
  let count: number;
  try {
    count = expandBetween(routine.schedule_rrule, routine.timezone, from, to).length;
  } catch {
    return {}; // malformed rrule → contributes nothing (mirrors the feed's skip-malformed)
  }
  if (count <= 0) return {};

  const out: Record<string, number> = {};
  for (const [coa, perOccurrence] of attributable) out[coa] = Math.round(perOccurrence * count * 100) / 100;
  return out;
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
    for (const [coa, amount] of Object.entries(routineMonthlyByCoa(r, year, monthIdx))) {
      out[coa] = Math.round(((out[coa] || 0) + amount) * 100) / 100;
    }
  }
  return out;
}
