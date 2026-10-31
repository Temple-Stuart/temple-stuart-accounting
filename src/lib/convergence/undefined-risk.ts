/**
 * MODEL-01 STEP 5 — undefined risk needs the filter AND the cap.
 *
 * A short strangle, short straddle or any unbounded structure is built only
 * when (1) the scan filter says Risk = Unlimited (the default filter state is
 * defined-risk — filter-types.ts DEFAULT_FILTERS.risk.riskType) AND (2) the
 * per-user cap on OPEN undefined-risk positions is not reached. The cap is a
 * named const, dated, default 1 open undefined-risk position (LJM Partners,
 * Feb 2018: undefined-risk short-vol carries ruin risk — one at a time until
 * EDGE-01's book says otherwise). Checked at build time against
 * trading_positions; the candidate says so when blocked.
 *
 * Pure logic here; the Prisma loader is undefined-risk.prisma.ts.
 */

export const UNDEFINED_RISK_OPEN_POSITION_CAP = 1;
export const UNDEFINED_RISK_CAP_SET_ON = '2026-09-15';

export interface UndefinedRiskCapCheck {
  allowed: boolean;
  filter_allows_unlimited: boolean;
  /** OPEN undefined-risk positions of the scanning user; null = not countable (no user). */
  open_undefined_risk_positions: number | null;
  cap: number;
  /** The one line the candidate carries — why it was built, or why it was not. */
  reason: string;
}

export function checkUndefinedRiskCap(filterAllowsUnlimited: boolean, openCount: number | null): UndefinedRiskCapCheck {
  const cap = UNDEFINED_RISK_OPEN_POSITION_CAP;
  if (!filterAllowsUnlimited) {
    return {
      allowed: false, filter_allows_unlimited: false, open_undefined_risk_positions: openCount, cap,
      reason: 'undefined-risk structure not built — the scan filter is Risk = Defined (the default); set Risk = Unlimited to build one',
    };
  }
  if (openCount === null) {
    return {
      allowed: false, filter_allows_unlimited: true, open_undefined_risk_positions: null, cap,
      reason: `undefined-risk structure not built — the open-position cap (${cap}) cannot be checked without a user`,
    };
  }
  if (openCount >= cap) {
    return {
      allowed: false, filter_allows_unlimited: true, open_undefined_risk_positions: openCount, cap,
      reason: `undefined-risk structure not built — ${openCount} open undefined-risk position(s) ≥ cap ${cap} (UNDEFINED_RISK_OPEN_POSITION_CAP, set ${UNDEFINED_RISK_CAP_SET_ON})`,
    };
  }
  return {
    allowed: true, filter_allows_unlimited: true, open_undefined_risk_positions: openCount, cap,
    reason: `undefined-risk structure allowed — filter Risk = Unlimited and ${openCount} open undefined-risk position(s) < cap ${cap} (UNDEFINED_RISK_OPEN_POSITION_CAP, set ${UNDEFINED_RISK_CAP_SET_ON}); checked against trading_positions at build time`,
  };
}

export interface OpenOptionPosition {
  symbol: string;
  option_type: string | null;
  expiration_date: Date | string | null;
  position_type: string;
  status: string;
}

const dayOf = (d: Date | string | null): string => (d === null ? '' : typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * An OPEN short option position with no OPEN long of the same symbol, type
 * and expiration is naked — undefined risk (a short call is unbounded; a short
 * put is bounded only by the strike × 100, which the trade counts as
 * undefined, as EDGE-01's family map does for short strangles/straddles).
 */
export function countUndefinedRiskPositions(positions: readonly OpenOptionPosition[]): number {
  const open = positions.filter((p) => p.status === 'OPEN' && p.option_type != null);
  const longs = new Set(
    open.filter((p) => p.position_type.toUpperCase() === 'LONG').map((p) => `${p.symbol}|${(p.option_type ?? '').toLowerCase()}|${dayOf(p.expiration_date)}`),
  );
  let n = 0;
  for (const p of open) {
    if (p.position_type.toUpperCase() !== 'SHORT') continue;
    const key = `${p.symbol}|${(p.option_type ?? '').toLowerCase()}|${dayOf(p.expiration_date)}`;
    if (!longs.has(key)) n += 1;
  }
  return n;
}
