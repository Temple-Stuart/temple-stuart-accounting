/**
 * MODEL-02 addendum (ruled 2026-09-16) — THE STRUCTURE CUT'S ELIGIBILITY RULE,
 * as one pure function so the test can hit it without a database.
 *
 * Step G (pipeline.ts rankAndDiversify) admits a ranked row to the structure
 * cut only when it clears four rules — the convergence gate (BUG 4), the
 * quality-null rule (MIG-1), the 40 quality floor and the miss-streak rule
 * (BUG 5). SINGLE NAMES ARE UNTOUCHED: those four rules read exactly as they
 * did.
 *
 * For a member of ETF_UNIVERSE only (etf-universe.ts, 15 dated names):
 *   • the quality-null rule does not bar the cut — an index/sector ETF has no
 *     issuer fundamentals, so "quality gate EXCLUDED" is the instrument's
 *     nature, not a missing read; the 40-floor still applies when the gate
 *     DID score (safety inputs from TastyTrade), and so does the miss-streak
 *     rule;
 *   • convergence is judged on the gates that can score: the same 3-of-4
 *     fraction over `scored_gates` — 2 of 2 when only Vol-Edge and Regime
 *     score, 3 of 3, 3 of 4 — never over gates that were excluded.
 * The card states "scored on N of 4 gates" (why.scored_by renders it on both
 * card surfaces) and the admission is written on the diversification
 * adjustments so the trace says why an ETF is in the cut.
 */

/** Single names: categories above 50 out of the four gates (BUG 4, unchanged). */
export const STRUCTURE_CUT_CONVERGENCE_MIN = 3;
/** The fraction the ETF rule applies over the gates that scored: ceil(scored × 3/4) — 2 of 2, 3 of 3, 3 of 4. */
export const STRUCTURE_CUT_CONVERGENCE_FRACTION = 3 / 4;
/** The quality floor (BUG 5, unchanged) — applies to every row whose quality gate scored. */
export const STRUCTURE_CUT_QUALITY_FLOOR = 40;
/** The quality level under which a ≥ 3-quarter miss streak excludes (BUG 5, unchanged). */
export const STRUCTURE_CUT_QUALITY_STREAK_CEILING = 50;
export const STRUCTURE_CUT_QUALITY_MISS_STREAK = 3;
/** The day the ETF-only amendment was ruled and set. */
export const ETF_STRUCTURE_CUT_SET_ON = '2026-09-16';

export interface StructureCutRow {
  symbol: string;
  rank: number;
  composite: number | null;
  quality: number | null;
  beat_streak: string;
  /** The composite's count of gates scoring above 50. */
  categories_above_50: number;
  /** How many of the four gates scored at all (composite.scored_by.length). */
  scored_gates: number;
}

export type StructureCutVerdict =
  | { eligible: true; note: string | null }
  | { eligible: false; reason: string };

/** The number of scored gates that must be above 50 for a row judged over `scored` gates. */
export function convergenceRequiredOf(scored: number): number {
  return Math.ceil(scored * STRUCTURE_CUT_CONVERGENCE_FRACTION);
}

/**
 * The verdict for one ranked row. `isEtfMember` is the caller's read of
 * ETF_UNIVERSE (never inferred from the data).
 */
export function structureCutEligibility(row: StructureCutRow, isEtfMember: boolean): StructureCutVerdict {
  const above = row.categories_above_50;
  const notes: string[] = [];

  if (isEtfMember) {
    // Convergence over the gates that can score.
    if (row.scored_gates <= 0) {
      return { eligible: false, reason: `Excluded ${row.symbol} (rank ${row.rank}) — ETF member: no gate scored; nothing to judge convergence on.` };
    }
    const required = convergenceRequiredOf(row.scored_gates);
    if (above < required) {
      return { eligible: false, reason: `Excluded ${row.symbol} (rank ${row.rank}, composite=${row.composite}) — ETF member: convergence ${above}/${row.scored_gates} over the gates that can score, below the ${required}/${row.scored_gates} minimum (scored on ${row.scored_gates} of 4 gates; set ${ETF_STRUCTURE_CUT_SET_ON}).` };
    }
    notes.push(`convergence ${above}/${row.scored_gates} over the gates that can score (scored on ${row.scored_gates} of 4 gates)`);
    if (row.quality === null) {
      // The quality-null rule does not bar an ETF member: the gate is excluded
      // by the instrument's nature, and the 40-floor is not evaluable — declared.
      notes.push('quality gate EXCLUDED — the 40-floor is not applicable to an index/sector ETF, declared');
    }
  } else {
    // Single names — unchanged (BUG 4 / MIG-1 / BUG 5).
    if (above < STRUCTURE_CUT_CONVERGENCE_MIN) {
      return { eligible: false, reason: `Excluded ${row.symbol} (rank ${row.rank}, composite=${row.composite}) — convergence ${above}/4, below ${STRUCTURE_CUT_CONVERGENCE_MIN}/4 minimum.` };
    }
    if (row.quality === null) {
      // MIG-1: quality gate excluded — the 40-floor cannot be evaluated.
      // Missing is NOT treated as passing (that would impute "fine").
      return { eligible: false, reason: `Excluded ${row.symbol} (rank ${row.rank}) — quality gate EXCLUDED (zero computable signals); ${STRUCTURE_CUT_QUALITY_FLOOR}-quality floor not evaluable, missing is not treated as passing.` };
    }
  }

  if (row.quality !== null) {
    if (row.quality < STRUCTURE_CUT_QUALITY_FLOOR) {
      return { eligible: false, reason: `Excluded ${row.symbol} (rank ${row.rank}, quality=${row.quality}) — quality below ${STRUCTURE_CUT_QUALITY_FLOOR} floor.` };
    }
    if (row.quality < STRUCTURE_CUT_QUALITY_STREAK_CEILING && /\d+Q MISS STREAK/.test(row.beat_streak)) {
      const missCount = parseInt(row.beat_streak, 10);
      if (missCount >= STRUCTURE_CUT_QUALITY_MISS_STREAK) {
        return { eligible: false, reason: `Excluded ${row.symbol} (rank ${row.rank}, quality=${row.quality}, ${row.beat_streak}) — quality <${STRUCTURE_CUT_QUALITY_STREAK_CEILING} with consecutive miss streak ≥${STRUCTURE_CUT_QUALITY_MISS_STREAK}.` };
      }
    }
  }

  return { eligible: true, note: isEtfMember ? `Admitted ${row.symbol} (rank ${row.rank}, composite=${row.composite}) — ETF member (set ${ETF_STRUCTURE_CUT_SET_ON}): ${notes.join('; ')}.` : null };
}
