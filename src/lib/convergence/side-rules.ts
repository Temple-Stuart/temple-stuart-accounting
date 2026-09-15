/**
 * MODEL-01 — THE SIDE'S RULES: the pre-filter per premium direction (STEP 2),
 * the buy-side catalyst gate and the seller's earnings hazard (STEP 3).
 *
 * Pure functions, no I/O. Every threshold is a named const, dated, UNTUNED —
 * EDGE-01 found zero graded outcomes under any current model, so nothing here
 * is fitted; the numbers await EDGE-01's third book (LOG-01 scan_candidates).
 *
 * Evidence (the ruling's WHY):
 *   - Unconditional long vol loses (Coval & Shumway 2001, ~3%/week on zero-beta
 *     straddles). The buy side has documented positive expectancy only WITH a
 *     catalyst: the earnings window (Gao, Xing & Zhang — straddles bought before
 *     the announcement, +3.34%) or HV well above IV (Goyal & Saretto 2009 —
 *     the top decile of log(HV/IV) earns positive straddle returns).
 *   - Earnings inside a seller's window is a hazard on single names (the
 *     announcement jump is the tail the premium pays for); it is FLAGGED on
 *     the card, never excluded, never silent.
 */
import type { Catalyst, EarningsWindow, PremiumSide } from './types';

/** STEP 2 — BUY pre-filter: HV must be above IV by at least this many vol points (TastyTrade iv-hv-30-day-difference ≤ −margin). Set 2026-09-15, untuned. */
export const BUY_PREFILTER_HV_OVER_IV_MIN_PTS = 1.0;
/** STEP 3 (b) — the catalyst threshold: HV over IV by at least this many vol points (Goyal & Saretto 2009, "HV well above IV"). Set 2026-09-15, untuned. */
export const BUY_CATALYST_HV_OVER_IV_PTS = 5.0;
/** The liquidity floor Step C applies on both sides (pipeline.ts Step C, unchanged). */
export const STEP_C_MIN_LIQUIDITY_RATING = 2;
export const SIDE_RULES_SET_ON = '2026-09-15';

export const EARNINGS_SOURCE_FINNHUB = 'Finnhub calendar/earnings';
export const EARNINGS_SOURCE_TASTYTRADE = 'TastyTrade market-metrics earnings.expected-report-date';

// ── STEP 2: the pre-filter per side ─────────────────────────────────────

export interface StepCInputs {
  ivHvSpread: number | null;
  liquidityRating: number | null;
}

/**
 * The Step C exclusion reason for ONE side, or null when the symbol passes
 * that side. SELL keeps today's rule (IV ≤ HV excluded — no vol premium); BUY
 * requires the opposite: HV above IV by the stated margin. The liquidity floor
 * applies to both. Every reason names the side.
 */
export function stepCReason(side: PremiumSide, t: StepCInputs): string | null {
  if (t.ivHvSpread == null) return `${side}: IV-HV spread unavailable — cannot assess vol premium`;
  if (side === 'SELL' && t.ivHvSpread <= 0) {
    return `SELL: no vol premium — IV-HV spread is ${t.ivHvSpread.toFixed(1)} (realized vol exceeds implied)`;
  }
  if (side === 'BUY' && t.ivHvSpread > -BUY_PREFILTER_HV_OVER_IV_MIN_PTS) {
    return `BUY: HV not above IV by ≥ ${BUY_PREFILTER_HV_OVER_IV_MIN_PTS.toFixed(1)} pts — IV-HV spread is ${t.ivHvSpread.toFixed(1)} (no long-premium edge)`;
  }
  if (t.liquidityRating == null) return `${side}: liquidity rating unavailable — cannot score liquidity`;
  if (t.liquidityRating < STEP_C_MIN_LIQUIDITY_RATING) return `${side}: low liquidity rating (${t.liquidityRating}/5)`;
  return null;
}

/** BOTH mode: the side a symbol passes on (the two rules are mutually exclusive on the spread), or null with both reasons. */
export function sideOf(t: StepCInputs): { side: PremiumSide | null; reasons: { SELL: string | null; BUY: string | null } } {
  const reasons = { SELL: stepCReason('SELL', t), BUY: stepCReason('BUY', t) };
  const side: PremiumSide | null = reasons.SELL === null ? 'SELL' : reasons.BUY === null ? 'BUY' : null;
  return { side, reasons };
}

// ── STEP 3: the earnings window and the catalysts ───────────────────────

export interface EarningsDateSource {
  /** ISO date YYYY-MM-DD */
  date: string;
  source: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every earnings date the run already has for a symbol, each named by its
 * source: the Finnhub calendar/earnings entries (the call the pipeline
 * already makes at Step I7) and the TastyTrade expected-report-date. Both are
 * evidence; neither substitutes for the other — a window is INSIDE if any
 * named date falls in it, and UNKNOWN only when no source delivered a date.
 */
export function earningsDateSources(finnhubCalendarDates: readonly string[], ttEarningsDate: string | null): EarningsDateSource[] {
  const out: EarningsDateSource[] = [];
  for (const d of finnhubCalendarDates) if (ISO.test(d)) out.push({ date: d, source: EARNINGS_SOURCE_FINNHUB });
  if (ttEarningsDate && ISO.test(ttEarningsDate.slice(0, 10))) out.push({ date: ttEarningsDate.slice(0, 10), source: EARNINGS_SOURCE_TASTYTRADE });
  return out;
}

/**
 * The earnings date against the structure's window [scanDate, expiration],
 * inclusive (an announcement on expiration day still lands inside the trade).
 */
export function earningsWindow(sources: readonly EarningsDateSource[], scanDate: string, expiration: string): EarningsWindow {
  if (!ISO.test(scanDate) || !ISO.test(expiration)) throw new Error(`MODEL-01: earningsWindow needs ISO dates (scan=${scanDate}, expiration=${expiration})`);
  if (sources.length === 0) {
    return { state: 'unknown', detail: 'earnings date unknown — neither the Finnhub calendar nor TastyTrade delivered a date', date: null, source: null };
  }
  const inside = sources.filter((s) => s.date >= scanDate && s.date <= expiration).sort((a, b) => a.date.localeCompare(b.date));
  if (inside.length > 0) {
    const first = inside[0];
    return {
      state: 'inside',
      detail: `earnings ${first.date} inside [${scanDate}, ${expiration}] (${first.source})`,
      date: first.date,
      source: first.source,
    };
  }
  const nearest = [...sources].sort((a, b) => a.date.localeCompare(b.date)).find((s) => s.date >= scanDate) ?? sources[0];
  return {
    state: 'outside',
    detail: `no earnings date inside [${scanDate}, ${expiration}] — nearest known ${nearest.date} (${nearest.source})`,
    date: nearest.date,
    source: nearest.source,
  };
}

/**
 * The buy-side catalysts that hold for a structure. Empty = the BUY candidate
 * is not built (the builder records the reason).
 */
export function buyCatalysts(args: { ivHvSpread: number | null; window: EarningsWindow }): Catalyst[] {
  const out: Catalyst[] = [];
  if (args.window.state === 'inside' && args.window.date && args.window.source) {
    out.push({
      kind: 'earnings_in_window',
      detail: args.window.detail,
      source: args.window.source,
    });
  }
  if (args.ivHvSpread != null && -args.ivHvSpread >= BUY_CATALYST_HV_OVER_IV_PTS) {
    out.push({
      kind: 'hv_over_iv',
      detail: `HV over IV by ${(-args.ivHvSpread).toFixed(1)} pts ≥ ${BUY_CATALYST_HV_OVER_IV_PTS.toFixed(1)} (Goyal & Saretto 2009; threshold set ${SIDE_RULES_SET_ON}, untuned)`,
      source: 'TastyTrade market-metrics iv-hv-30-day-difference',
    });
  }
  return out;
}

/** The reason a BUY structure is not built when no catalyst holds. */
export function noCatalystReason(args: { ivHvSpread: number | null; window: EarningsWindow }): string {
  const hv = args.ivHvSpread == null
    ? 'IV-HV spread unavailable'
    : `HV over IV by ${(-args.ivHvSpread).toFixed(1)} pts < ${BUY_CATALYST_HV_OVER_IV_PTS.toFixed(1)} threshold`;
  return `BUY: no catalyst — ${args.window.detail}; ${hv}. A buy-side candidate exists only with a catalyst (Coval & Shumway 2001: unconditional long vol loses)`;
}

/** The seller's hazard line for a card whose window holds an earnings date (flagged, never excluded). */
export function sellerEarningsHazard(window: EarningsWindow, dte: number): string | null {
  if (window.state !== 'inside') return null;
  return `EARNINGS INSIDE WINDOW — ${window.date} (${window.source}), trade expires in ${dte} DTE. The announcement jump is the tail this premium pays for (single-name hazard; flagged, not excluded).`;
}
