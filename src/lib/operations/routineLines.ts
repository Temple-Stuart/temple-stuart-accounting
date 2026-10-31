/**
 * LINES-01 — THE ROUTINE'S FIGURE IS THE SUM OF ITS LINES, OR ITS OWN WHEN IT
 * HAS NONE.
 *
 * THE RULE, STATED ONCE. Every reader of a routine's planned amount reads THIS
 * leaf and nothing else — the monthly figure (routineBudget.ts), the homepage
 * bridge behind it, the window feed, the grid mapper, the day view's Routines
 * part, the today strip, the routine row and DRILL-01's census. The rule:
 *
 *   If a routine has ANY active line carrying an amount, the routine's planned
 *   figure is the SUM of its lines' amounts, and the routine-level budget_amount
 *   is IGNORED for that routine — reported, not silently. If it has none, the
 *   routine-level field stands. The two are NEVER added.
 *
 * WHY NOT ADD THEM. A routine-level $15 and a coffee line's $80 are two claims
 * about the same morning, made at different grains. Adding them would count the
 * coffee twice the day it was costed and once the day before. The line is the
 * finer truth, so it wins; the coarser figure is shown as set aside, so the
 * founder can see it and clear it.
 *
 * WHY THE ROUTINE-LEVEL FIELD STAYS. A stepless routine has no lines to sum and
 * still needs a figure. Dropping the column would zero every one of them.
 *
 * BLANK IS BLANK. A line with no amount contributes nothing and is counted OUT of
 * the coverage ("$280 across 2 of 3 lines"). It is never read as 0.
 *
 * ATTRIBUTION BY COA. The monthly figure attributes money to an account. A line
 * with an amount and a COA goes to its own account; a line with an amount and NO
 * COA is in the total but attributable to nothing — the same posture HB-4c
 * already takes for a routine with a budget and no COA. A lined routine's
 * routine-level coa_code attributes NOTHING, because the routine-level amount is
 * the one being ignored.
 */

export interface RoutineLineInput {
  readonly id: string;
  /**
   * Absent means ACTIVE, and that is not a guess: every feed that hands lines to
   * this leaf already filters `is_active: true` on the server (routines list
   * route.ts:95, today route.ts:108, the window feed, the HB-4d bridge), so a
   * line without the flag on the client is one the server has vetted. An
   * explicit `false` is honoured — an archived line contributes nothing.
   */
  readonly is_active?: boolean;
  /** Prisma Decimal → string in JSON, or a number. null/undefined = no amount. */
  readonly budget_amount?: number | string | null;
  readonly coa_code?: string | null;
  readonly activity?: string;
  readonly step_order?: number;
  readonly time_of_day?: string | null;
}

export interface RoutinePlannedInput {
  readonly budget_amount: number | string | null;
  readonly coa_code: string | null;
  readonly steps?: readonly RoutineLineInput[] | null;
}

export type PlannedFrom = 'lines' | 'routine' | 'none';

export interface LinePlanned {
  readonly id: string;
  readonly activity: string;
  readonly stepOrder: number;
  readonly timeOfDay: string | null;
  /** Dollars, or null — and null is BLANK, never 0. */
  readonly amount: number | null;
  readonly coaCode: string | null;
}

export interface RoutinePlanned {
  /** Dollars, or null when nothing carries an amount. */
  readonly amount: number | null;
  /** Where the figure came from. 'none' when nothing carries one. */
  readonly from: PlannedFrom;
  /** The active lines, in order, each with what it knows. Empty for a stepless routine. */
  readonly lines: readonly LinePlanned[];
  /** How many lines carry an amount, of how many active lines. */
  readonly coverage: { readonly counted: number; readonly of: number };
  /** The routine-level figure set aside because lines carry amounts. Null otherwise. */
  readonly ignoredRoutineLevel: number | null;
  /** The routine-level COA, ONLY when the routine-level figure is the one in force. */
  readonly coaCode: string | null;
  /** Amount per account, for the monthly figure. A costed line with no COA is absent here. */
  readonly byCoa: Readonly<Record<string, number>>;
  /** Dollars carrying an amount but no account — in `amount`, absent from `byCoa`. */
  readonly unattributed: number;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** "$280 across 2 of 3 lines" — the coverage sentence, or a plain figure for a stepless routine. */
export function plannedLine(p: RoutinePlanned): string {
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (p.from === 'none') return 'no amount';
  if (p.from === 'routine') return `${money(p.amount as number)} / occurrence`;
  return `${money(p.amount as number)} across ${p.coverage.counted} of ${p.coverage.of} line${p.coverage.of === 1 ? '' : 's'}`;
}

/** The sentence the routine row prints when its own figure is set aside. */
export function ignoredLine(p: RoutinePlanned): string | null {
  if (p.ignoredRoutineLevel === null) return null;
  return `The routine-level $${p.ignoredRoutineLevel.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} is set aside: this routine's figure is the sum of its lines. Clear it, or move it onto a line.`;
}

export function routinePlanned(r: RoutinePlannedInput): RoutinePlanned {
  const active = (r.steps ?? []).filter((s) => s.is_active !== false);
  const lines: LinePlanned[] = [...active]
    .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
    .map((s) => ({
      id: s.id,
      activity: s.activity ?? '',
      stepOrder: s.step_order ?? 0,
      timeOfDay: s.time_of_day ?? null,
      amount: num(s.budget_amount ?? null),
      coaCode: s.coa_code?.trim() ? s.coa_code.trim() : null,
    }));
  const costed = lines.filter((l) => l.amount !== null);
  const routineLevel = num(r.budget_amount);

  if (costed.length > 0) {
    const byCoa: Record<string, number> = {};
    let unattributed = 0;
    let sum = 0;
    for (const l of costed) {
      sum += l.amount as number;
      if (l.coaCode) byCoa[l.coaCode] = round2((byCoa[l.coaCode] ?? 0) + (l.amount as number));
      else unattributed += l.amount as number;
    }
    return {
      amount: round2(sum),
      from: 'lines',
      lines,
      coverage: { counted: costed.length, of: lines.length },
      ignoredRoutineLevel: routineLevel,
      coaCode: null,
      byCoa,
      unattributed: round2(unattributed),
    };
  }

  const coa = r.coa_code?.trim() ? r.coa_code.trim() : null;
  if (routineLevel !== null) {
    return {
      amount: routineLevel,
      from: 'routine',
      lines,
      coverage: { counted: 0, of: lines.length },
      ignoredRoutineLevel: null,
      coaCode: coa,
      byCoa: coa ? { [coa]: routineLevel } : {},
      unattributed: coa ? 0 : routineLevel,
    };
  }
  return { amount: null, from: 'none', lines, coverage: { counted: 0, of: lines.length }, ignoredRoutineLevel: null, coaCode: null, byCoa: {}, unattributed: 0 };
}
