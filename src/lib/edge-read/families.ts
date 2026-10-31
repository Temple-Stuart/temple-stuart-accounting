/**
 * EDGE-01 — the strategy-family map and the two premium-direction readers.
 *
 * ONE const, cited to the EDGE-01 ruling §3 taxonomy (the research docs
 * follow in MODEL-01):
 *   SELL-DEFINED   put/call credit spread, bull put, bear call, iron condor, iron butterfly, jade lizard
 *   SELL-UNDEFINED short strangle, short straddle
 *   BUY            long straddle, long strangle, debit spread, bull call, bear put
 *   TERM           calendar, diagonal
 * Any string the const does not match lands in UNMAPPED with its raw value —
 * never guessed. In particular the position side's own vocabulary
 * (batch-trade-processor.ts detectStrategy: 'iron-condor', 'call-spread',
 * 'put-spread', 'straddle-strangle', 'single', 'multi-leg-N') does not say
 * credit or debit, short or long, so only 'iron-condor' maps; the rest are
 * UNMAPPED by design and reported as such.
 *
 * Premium direction is read INDEPENDENTLY of the string (ruling §3): from
 * trading_positions.position_type (LONG/SHORT) on the position side and from
 * the card's legs (side buy/sell × price) on the card side. A disagreement
 * between the family the string implies and the direction the legs show is
 * REPORTED, never resolved.
 */
export type StrategyFamily = 'SELL-DEFINED' | 'SELL-UNDEFINED' | 'BUY' | 'TERM' | 'UNMAPPED';
export type PremiumSide = 'SELL' | 'BUY' | 'UNKNOWN';

export function normalizeStrategyString(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const STRATEGY_FAMILY_MAP: Readonly<Record<string, Exclude<StrategyFamily, 'UNMAPPED'>>> = {
  // SELL-DEFINED
  'put credit spread': 'SELL-DEFINED',
  'call credit spread': 'SELL-DEFINED',
  'bull put': 'SELL-DEFINED',
  'bull put spread': 'SELL-DEFINED',
  'bear call': 'SELL-DEFINED',
  'bear call spread': 'SELL-DEFINED',
  'iron condor': 'SELL-DEFINED',
  'iron butterfly': 'SELL-DEFINED',
  'jade lizard': 'SELL-DEFINED',
  // SELL-UNDEFINED
  'short strangle': 'SELL-UNDEFINED',
  'short straddle': 'SELL-UNDEFINED',
  // BUY
  'long straddle': 'BUY',
  'long strangle': 'BUY',
  'debit spread': 'BUY',
  'bull call': 'BUY',
  'bull call spread': 'BUY',
  'bear put': 'BUY',
  'bear put spread': 'BUY',
  // TERM
  'calendar': 'TERM',
  'calendar spread': 'TERM',
  'diagonal': 'TERM',
  'diagonal spread': 'TERM',
};

export interface FamilyReading {
  raw: string;
  normalized: string;
  family: StrategyFamily;
}

export function familyOf(raw: string | null | undefined): FamilyReading {
  const normalized = normalizeStrategyString(raw);
  const family = STRATEGY_FAMILY_MAP[normalized] ?? 'UNMAPPED';
  return { raw: raw ?? '(null)', normalized, family };
}

/** The side a family implies; TERM and UNMAPPED imply nothing. */
export function familyImpliedSide(family: StrategyFamily): PremiumSide | null {
  if (family === 'SELL-DEFINED' || family === 'SELL-UNDEFINED') return 'SELL';
  if (family === 'BUY') return 'BUY';
  return null;
}

/**
 * Ruling §5: PUT beside the spreads, CMBO beside the condors/strangles.
 * Reads the NORMALIZED strategy string; null = no benchmark named for it.
 */
export function benchmarkIndexFor(normalized: string): 'PUT' | 'CMBO' | null {
  const put = ['put credit spread', 'call credit spread', 'bull put', 'bull put spread', 'bear call', 'bear call spread'];
  const cmbo = ['iron condor', 'iron butterfly', 'jade lizard', 'short strangle', 'short straddle'];
  if (put.includes(normalized)) return 'PUT';
  if (cmbo.includes(normalized)) return 'CMBO';
  return null;
}

export interface CardLeg { side: string | null | undefined; price: number | null | undefined }
export interface PositionLeg { positionType: string | null | undefined; openPrice: number | null | undefined; quantity: number | null | undefined }

/**
 * Card side: net premium = Σ sell-leg price − Σ buy-leg price (per share).
 * Any leg without a price, an unknown side, or a net of exactly zero →
 * UNKNOWN (declared, never guessed).
 */
export function sideFromCardLegs(legs: readonly CardLeg[]): PremiumSide {
  if (legs.length === 0) return 'UNKNOWN';
  let net = 0;
  for (const l of legs) {
    const side = (l.side ?? '').toLowerCase();
    const price = typeof l.price === 'number' && Number.isFinite(l.price) ? l.price : null;
    if (price === null) return 'UNKNOWN';
    if (side === 'sell') net += price;
    else if (side === 'buy') net -= price;
    else return 'UNKNOWN';
  }
  if (net > 0) return 'SELL';
  if (net < 0) return 'BUY';
  return 'UNKNOWN';
}

/**
 * Position side: net premium = Σ SHORT open_price×quantity − Σ LONG
 * open_price×quantity (position-tracker-service.ts:179-181 writes
 * position_type LONG|SHORT, open_price = the leg price, quantity = contracts).
 * A leg with a null price/quantity or an unknown type → UNKNOWN.
 */
export function sideFromPositionLegs(legs: readonly PositionLeg[]): PremiumSide {
  if (legs.length === 0) return 'UNKNOWN';
  let net = 0;
  for (const l of legs) {
    const t = (l.positionType ?? '').toUpperCase();
    const price = typeof l.openPrice === 'number' && Number.isFinite(l.openPrice) ? l.openPrice : null;
    const qty = typeof l.quantity === 'number' && Number.isFinite(l.quantity) ? Math.abs(l.quantity) : null;
    if (price === null || qty === null) return 'UNKNOWN';
    if (t === 'SHORT') net += price * qty;
    else if (t === 'LONG') net -= price * qty;
    else return 'UNKNOWN';
  }
  if (net > 0) return 'SELL';
  if (net < 0) return 'BUY';
  return 'UNKNOWN';
}
