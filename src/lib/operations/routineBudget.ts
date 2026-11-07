import type { RoutineLineInput } from './routineLines';

/**
 * routineBudget — THE INPUT a routine's budget is built from (RoutineBudgetInput), and nothing else.
 *
 * HOME-LEDGER-02b (Alex, 2026-11-07, ruling C): the two month tables this file computed — routineMonthlyByCoa and
 * routinesMonthlyByCoa, HB-4c's "occurrences in the month × budget_amount", read by the cockpit's /api/hub/year-calendar
 * and /api/hub/business-budget routes alone — are deleted with those routes and the cockpit's second month table (its
 * HubBudgetSection / BudgetComparison). One month table, one budget model: a routine's month is the sum of its DAY lines,
 * built by src/lib/budget/days.ts buildRoutineBudgetLines (expandBetween anchored on start_date — ONEOFF-01 — and bounded
 * by end_date — ROUTINE-02a; what an occurrence costs is decided by routinePlanned in routineLines.ts: the lines when any
 * carries an amount, else the routine-level pair, never both — LINES-01) and summed into months by src/lib/budget/report.ts
 * for the two Budget routes (/api/budget/report, /api/budget/report/cell). The lines law (scripts/assert-tool-registry.ts)
 * names those two routes as the bridges that read routines through the ONE loader.
 *
 * What remains is the interface the loader's row type extends (routineBudgetInputs.ts LoadedRoutineBudgetInput): the
 * columns a routine's budget is read from, each documented where its reader's rule lives. No DB, no writes, no figure.
 */

export interface RoutineBudgetInput {
  /** Per-occurrence amount (Prisma Decimal → string in JSON, or a number). null = no budget. */
  budget_amount: number | string | null;
  /** Bare chart_of_accounts.code (e.g. "B-9200"); null = unattributed. */
  coa_code: string | null;
  schedule_rrule: string;
  timezone: string;
  /**
   * ONEOFF-01: the routine's start_date — the anchor every expansion of it is
   * built on (rruleHelpers.ts scheduleAnchor). A one-off (COUNT=1) counts from
   * it, so its lines land in the month it happens and in no other. Absent or
   * null ⇒ the fixed anchor, as before, for a routine with no start date.
   */
  start_date?: Date | string | null;
  /**
   * LINES-01: the routine's active lines. When any carries an amount, the
   * monthly figure is built from the LINES (each to its own COA) and the two
   * fields above are set aside — the rule in routineLines.ts, read here, not
   * restated. Absent or empty ⇒ the routine-level fields stand, as before.
   */
  steps?: readonly RoutineLineInput[] | null;
  /**
   * ROUTINE-02a: the routine's end_date — the last local day an occurrence may
   * fall on (rruleHelpers.ts endDayOf). The loader hands it over
   * (routineBudgetInputs.ts); the month's count stops at it. Absent or null ⇒
   * no end, as before.
   */
  end_date?: Date | string | null;
}
