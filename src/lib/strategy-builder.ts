// Strategy Builder — client-side option strategy generation
// No API calls; purely computes from chain + Greeks data

import { probAbove, probBetween } from './convergence/probability';
import { numOrNull } from './parse-num';

// ─── Math Utilities ─────────────────────────────────────────────────

// Standard normal CDF — Abramowitz & Stegun approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

// HV-adjusted PoP for credit strategies — uses realized vol instead of IV-inflated delta
const CREDIT_STRATEGIES = ['Iron Condor', 'Put Credit Spread', 'Call Credit Spread', 'Short Strangle', 'Short Straddle', 'Jade Lizard'];

function computeHvAdjustedPoP(
  card: StrategyCard,
  price: number,
  hv30: number,  // decimal (e.g. 0.247 for 24.7%)
  dte: number
): number {
  if (!CREDIT_STRATEGIES.includes(card.name)) return card.pop ?? 0; // debit: keep delta PoP
  if (!hv30 || hv30 <= 0) return card.pop ?? 0; // no HV data: keep delta PoP

  const vol = price * hv30 * Math.sqrt(dte / 365);
  if (vol <= 0) return card.pop ?? 0;

  const shortPuts = card.legs.filter(l => l.side === 'sell' && l.type === 'put');
  const shortCalls = card.legs.filter(l => l.side === 'sell' && l.type === 'call');
  const credit = card.netCredit || 0;

  if (shortPuts.length > 0 && shortCalls.length > 0) {
    // Two-sided: iron condor, short strangle, jade lizard
    const beLow = Math.min(...shortPuts.map(l => l.strike)) - credit;
    const beHigh = Math.max(...shortCalls.map(l => l.strike)) + credit;
    const zDown = (price - beLow) / vol;
    const zUp = (beHigh - price) / vol;
    return Math.max(0, Math.min(1, normalCDF(zDown) + normalCDF(zUp) - 1));
  } else if (shortPuts.length > 0) {
    // Put credit spread
    const beLow = Math.min(...shortPuts.map(l => l.strike)) - credit;
    const z = (price - beLow) / vol;
    return Math.max(0, Math.min(1, normalCDF(z)));
  } else if (shortCalls.length > 0) {
    // Call credit spread
    const beHigh = Math.max(...shortCalls.map(l => l.strike)) + credit;
    const z = (beHigh - price) / vol;
    return Math.max(0, Math.min(1, normalCDF(z)));
  }
  return card.pop ?? 0;
}

// ─── Breakeven-Based PoP (N(d2)) ────────────────────────────────────

/**
 * Calculate Probability of Profit using N(d2) at breakeven prices.
 *
 * More accurate than delta approximation because:
 * 1. Uses N(d2) not N(d1) — true expiration probability, not hedge ratio
 * 2. Evaluates at actual breakeven prices, not strike prices
 * 3. For credit spreads, breakevens account for premium received
 *
 * IV source: params.iv30 — the underlying's 30-day implied volatility
 * from TastyTrade market metrics (GenerateParams.iv30).
 *
 * @param breakevens - calculated breakeven price(s) from P&L curve
 * @param spotPrice - current underlying price
 * @param iv - implied volatility (annualized decimal, e.g. 0.25 for 25%)
 * @param dte - days to expiration
 * @param isCredit - true if strategy receives credit
 * @returns { pop, method } or null if calculation not possible
 */
function calculateBreakevenPoP(
  breakevens: number[],
  spotPrice: number,
  iv: number,
  dte: number,
  isCredit: boolean,
  riskFreeRate: number,
): { pop: number; method: 'breakeven_d2' } | null {
  if (breakevens.length === 0 || spotPrice <= 0 || iv <= 0 || dte <= 0) return null;

  const dteYears = dte / 365;
  const sorted = [...breakevens].sort((a, b) => a - b);

  if (sorted.length === 1) {
    // Single breakeven: credit spread or debit spread
    const be = sorted[0];
    if (isCredit) {
      // Credit spread: profit if price stays on the "safe" side of breakeven
      // Put credit spread: breakeven is below spot → profit if price ABOVE breakeven
      // Call credit spread: breakeven is above spot → profit if price BELOW breakeven
      if (be < spotPrice) {
        const p = probAbove(spotPrice, be, iv, dteYears, riskFreeRate);
        if (p === null) return null;
        return { pop: Math.max(0, Math.min(1, p)), method: 'breakeven_d2' };
      } else {
        const p = probAbove(spotPrice, be, iv, dteYears, riskFreeRate);
        if (p === null) return null;
        // Price needs to stay below breakeven
        return { pop: Math.max(0, Math.min(1, 1 - p)), method: 'breakeven_d2' };
      }
    } else {
      // Debit spread: profit if price moves past breakeven
      // Bull call spread: breakeven above spot → profit if price ABOVE breakeven
      // Bear put spread: breakeven below spot → profit if price BELOW breakeven
      if (be > spotPrice) {
        const p = probAbove(spotPrice, be, iv, dteYears, riskFreeRate);
        if (p === null) return null;
        return { pop: Math.max(0, Math.min(1, p)), method: 'breakeven_d2' };
      } else {
        const p = probAbove(spotPrice, be, iv, dteYears, riskFreeRate);
        if (p === null) return null;
        return { pop: Math.max(0, Math.min(1, 1 - p)), method: 'breakeven_d2' };
      }
    }
  }

  if (sorted.length === 2) {
    const [lowerBE, upperBE] = sorted;
    if (isCredit) {
      // Iron condor, short strangle, short straddle: profit if price stays BETWEEN breakevens
      const p = probBetween(spotPrice, lowerBE, upperBE, iv, dteYears, riskFreeRate);
      if (p === null) return null;
      return { pop: Math.max(0, Math.min(1, p)), method: 'breakeven_d2' };
    } else {
      // Long straddle, long strangle: profit if price goes OUTSIDE breakevens
      const p = probBetween(spotPrice, lowerBE, upperBE, iv, dteYears, riskFreeRate);
      if (p === null) return null;
      return { pop: Math.max(0, Math.min(1, 1 - p)), method: 'breakeven_d2' };
    }
  }

  // 3+ breakevens: unusual strategy, skip
  return null;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface StrikeData {
  strike: number;
  callBid: number | null;
  callAsk: number | null;
  putBid: number | null;
  putAsk: number | null;
  callDelta: number | null;
  putDelta: number | null;
  callTheta: number | null;
  putTheta: number | null;
  callGamma: number | null;
  putGamma: number | null;
  callVega: number | null;
  putVega: number | null;
  callIv: number | null;
  putIv: number | null;
  callVolume: number | null;
  putVolume: number | null;
  callOI: number | null;
  putOI: number | null;
  callTheoPrice: number | null;
  putTheoPrice: number | null;
  priceSource: 'live' | 'theo' | 'mixed' | 'none'; // audit trail
  callWideSpread: boolean;
  putWideSpread: boolean;
}

export interface StrategyLeg {
  type: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  price: number; // entry price (positive)
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  wideSpread: boolean;
  // Chain IV of this leg (dxfeed, decimal e.g. 0.42). EDGE-3: the HV10>IV gate
  // compares realized vol against the IV actually being SOLD (short legs).
  // null = feed provided no IV for this contract; the gate declares itself
  // not-evaluated rather than inventing a value. Optional so the custom-card
  // path (buildCustomCard) is unaffected.
  iv?: number | null;
}

export interface StrategyCard {
  name: string;
  label: string; // e.g. "A", "B", "C"
  legs: StrategyLeg[];
  expiration: string;
  dte: number;
  netCredit: number | null; // positive = credit received
  netDebit: number | null;  // positive = debit paid
  maxProfit: number | null;  // dollars per contract
  maxLoss: number | null;    // dollars per contract (null = unlimited)
  breakevens: number[];
  pop: number | null;        // probability of profit 0-1
  popMethod: 'breakeven_d2' | 'delta_approx'; // which calculation produced pop
  riskReward: number | null;
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  thetaPerDay: number;       // positive = collecting, negative = paying
  isUnlimited: boolean;      // unlimited risk or profit
  pnlPoints: { price: number; pnl: number }[];
  hasWideSpread: boolean;
  ev: number;                // expected value in dollars
  evPerRisk: number;         // EV per dollar risked
  hvPop: number | null;      // HV-adjusted PoP for credit strategies
  compositeScore: number;    // edge-aware composite score used for ranking
}

export interface GenerateParams {
  strikes: StrikeData[];
  currentPrice: number;
  ivRank: number;
  expiration: string;
  dte: number;
  symbol?: string;        // for debug logging
  iv30?: number;          // implied volatility decimal (e.g. 0.42 for 42%)
  hv30?: number;          // 30-day HV decimal (e.g. 0.25 for 25%)
  // EDGE-3: 10-day realized vol, decimal (e.g. 0.55 for 55%). Required — the caller
  // must decide; null = not computable from candle history, in which case the
  // HV10>IV gate declares itself not-evaluated (never imputed, never silent).
  hv10: number | null;
  // Risk-free rate from FRED FEDFUNDS series, converted to decimal. Required — no default.
  riskFreeRate: number;
}

// ─── Rejection Tracking ─────────────────────────────────────────────

export interface RejectionReason {
  strategy: string;
  reason: string;
  gate: 'A' | 'B' | 'C' | 'construction';
  details?: {
    value: number;
    threshold: number;
    spreadWidth?: number;
  };
}

export interface GenerateResult {
  strategies: StrategyCard[];
  rejections: RejectionReason[];
}

// ─── Three-Outcome EV Model ─────────────────────────────────────────

/**
 * Three-outcome Expected Value model for spread strategies.
 *
 * Accounts for the partial P/L zone between short and long strikes
 * that binary EV ignores.
 *
 * @param pop - Estimated probability of profit (0-1, from delta approximation)
 * @param maxProfit - Maximum profit in dollars (positive number)
 * @param maxLoss - Maximum loss in dollars (positive number, absolute value)
 * @param shortDelta - Absolute delta of the short strike (e.g., 0.30)
 * @param longDelta - Absolute delta of the long strike (e.g., 0.16)
 * @returns { ev: number, evPerRisk: number }
 */
function calculateThreeOutcomeEV(
  pop: number,
  maxProfit: number,
  maxLoss: number,
  shortDelta: number | null,
  longDelta: number | null,
): { ev: number; evPerRisk: number } {
  const absMaxLoss = Math.abs(maxLoss);

  // If we don't have both deltas, fall back to binary model
  if (shortDelta == null || longDelta == null || shortDelta <= longDelta) {
    // Binary model: EV = PoP × MaxProfit - (1-PoP) × |MaxLoss|
    const ev = pop * maxProfit - (1 - pop) * absMaxLoss;
    const evPerRisk = absMaxLoss > 0 ? ev / absMaxLoss : 0;
    return { ev: Math.round(ev * 100) / 100, evPerRisk: Math.round(evPerRisk * 1000) / 1000 };
  }

  // Three-outcome model
  const pFullProfit = 1 - shortDelta;                    // probability price stays safe
  const pPartial = Math.abs(shortDelta - longDelta);     // probability in partial zone
  const pFullLoss = longDelta;                           // probability beyond long strike

  // Partial P/L approximation: midpoint between max profit and max loss
  const partialPL = (maxProfit - absMaxLoss) / 2;

  const ev = pFullProfit * maxProfit
           + pPartial * partialPL
           + pFullLoss * (-absMaxLoss);

  const evPerRisk = absMaxLoss > 0 ? ev / absMaxLoss : 0;

  return {
    ev: Math.round(ev * 100) / 100,
    evPerRisk: Math.round(evPerRisk * 1000) / 1000
  };
}

// ─── Tier 1: Strategy Labels ────────────────────────────────────────

export interface StrategyLabel {
  name: string;
  type: 'credit' | 'debit' | 'neutral';
}

export function getStrategyLabels(ivRank: number): StrategyLabel[] {
  // ivRank is 0-1 scale from API; multiply by 100 for percentage
  const pct = ivRank * 100;
  if (pct > 70) return [
    { name: 'Iron Condor', type: 'credit' },
    { name: 'Put Credit Spread', type: 'credit' },
    { name: 'Short Strangle', type: 'credit' },
  ];
  if (pct > 50) return [
    { name: 'Iron Condor', type: 'credit' },
    { name: 'Put Credit Spread', type: 'credit' },
    { name: 'Call Credit Spread', type: 'credit' },
  ];
  if (pct > 30) return [
    { name: 'Bull Call Spread', type: 'debit' },
    { name: 'Iron Condor', type: 'neutral' },
    { name: 'Jade Lizard', type: 'credit' },
  ];
  if (pct > 20) return [
    { name: 'Bull Call Spread', type: 'debit' },
    { name: 'Calendar Spread', type: 'neutral' },
    { name: 'Diagonal Spread', type: 'neutral' },
  ];
  return [
    { name: 'Long Straddle', type: 'debit' },
    { name: 'Long Strangle', type: 'debit' },
    { name: 'Debit Spread', type: 'debit' },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────

function mid(bid: number | null, ask: number | null): number | null {
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid;
  if (ask != null) return ask;
  return null;
}

function findByDelta(
  strikes: StrikeData[],
  target: number,
  side: 'call' | 'put'
): StrikeData | null {
  let best: StrikeData | null = null;
  let bestDiff = Infinity;
  for (const s of strikes) {
    const d = side === 'call' ? s.callDelta : s.putDelta;
    if (d == null) continue;
    const diff = Math.abs(d - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

function nextStrikeBelow(strikes: StrikeData[], refStrike: number): StrikeData | null {
  const below = strikes.filter(s => s.strike < refStrike).sort((a, b) => b.strike - a.strike);
  return below[0] || null;
}

function nextStrikeAbove(strikes: StrikeData[], refStrike: number): StrikeData | null {
  const above = strikes.filter(s => s.strike > refStrike).sort((a, b) => a.strike - b.strike);
  return above[0] || null;
}

/**
 * Find the strike closest to a target price in a given direction.
 * Unlike nextStrikeBelow which always gets adjacent, this finds
 * the strike nearest to an arbitrary target price.
 */
function findClosestStrike(
  strikes: StrikeData[],
  targetPrice: number,
  direction: 'below' | 'above'
): StrikeData | null {
  const candidates = direction === 'below'
    ? strikes.filter(s => s.strike < targetPrice + 0.01)
    : strikes.filter(s => s.strike > targetPrice - 0.01);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, s) =>
    Math.abs(s.strike - targetPrice) < Math.abs(best.strike - targetPrice) ? s : best
  );
}

/**
 * Compute spread width candidates based on the actual strike spacing
 * in the chain. Returns multiplied widths: 1x, 2x, 3x, 5x min spacing.
 */
function getSpreadWidthCandidates(strikes: StrikeData[]): number[] {
  const sorted = strikes.map(s => s.strike).sort((a, b) => a - b);
  const spacings = new Set<number>();
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((sorted[i] - sorted[i - 1]) * 100) / 100;
    if (gap > 0) spacings.add(gap);
  }
  if (spacings.size === 0) return [1];
  const minSpacing = Math.min(...spacings);
  const multipliers = [1, 2, 3, 5];
  return multipliers.map(m => Math.round(m * minSpacing * 100) / 100);
}

function makeLeg(
  strike: StrikeData,
  type: 'call' | 'put',
  side: 'buy' | 'sell'
): StrategyLeg | null {
  const bid = type === 'call' ? strike.callBid : strike.putBid;
  const ask = type === 'call' ? strike.callAsk : strike.putAsk;
  const price = side === 'sell' ? bid : ask;
  if (price == null || price <= 0) return null;
  // KILL-2: a leg without complete greeks from the feed cannot be built —
  // greeks feed delta strike-selection, delta PoP (Gate B), the three-outcome
  // EV deltas, and thetaEff in composite ranking. They are NEVER imputed as 0
  // (an imputed 0 delta inflated credit PoP and could even win low-delta
  // strike selection). Missing → leg dead, declared in generateStrategies.
  const delta = type === 'call' ? strike.callDelta : strike.putDelta;
  const gamma = type === 'call' ? strike.callGamma : strike.putGamma;
  const theta = type === 'call' ? strike.callTheta : strike.putTheta;
  const vega = type === 'call' ? strike.callVega : strike.putVega;
  if (delta == null || gamma == null || theta == null || vega == null) return null;

  return {
    type,
    side,
    strike: strike.strike,
    price,
    delta: side === 'sell' ? -delta : delta,
    gamma: side === 'sell' ? -gamma : gamma,
    theta: side === 'sell' ? -theta : theta,
    vega: side === 'sell' ? -vega : vega,
    wideSpread: type === 'call' ? strike.callWideSpread : strike.putWideSpread,
    iv: (type === 'call' ? strike.callIv : strike.putIv) ?? null,
  };
}

function computePnlPoints(legs: StrategyLeg[], currentPrice: number): { price: number; pnl: number }[] {
  // Extend range to cover all strikes with margin so diagrams show full loss tails
  const allStrikes = legs.map(l => l.strike);
  const minStrike = Math.min(...allStrikes);
  const maxStrike = Math.max(...allStrikes);
  const spread = Math.max(maxStrike - minStrike, currentPrice * 0.1);
  const lo = Math.max(0, Math.min(currentPrice * 0.85, minStrike - spread));
  const hi = Math.max(currentPrice * 1.15, maxStrike + spread);
  const step = (hi - lo) / 50;
  const points: { price: number; pnl: number }[] = [];
  for (let p = lo; p <= hi + 0.01; p += step) {
    let pnl = 0;
    for (const leg of legs) {
      const intrinsic = leg.type === 'call'
        ? Math.max(0, p - leg.strike)
        : Math.max(0, leg.strike - p);
      if (leg.side === 'buy') {
        pnl += (intrinsic - leg.price) * 100;
      } else {
        pnl += (leg.price - intrinsic) * 100;
      }
    }
    points.push({ price: Math.round(p * 100) / 100, pnl: Math.round(pnl * 100) / 100 });
  }
  return points;
}

function buildCard(
  name: string,
  label: string,
  legs: StrategyLeg[],
  expiration: string,
  dte: number,
  currentPrice: number,
  isUnlimited: boolean
): StrategyCard {
  let netCredit: number | null = null;
  let netDebit: number | null = null;
  let cashFlow = 0; // positive = net credit
  for (const leg of legs) {
    if (leg.side === 'sell') cashFlow += leg.price;
    else cashFlow -= leg.price;
  }
  if (cashFlow >= 0) {
    netCredit = Math.round(cashFlow * 100) / 100;
  } else {
    netDebit = Math.round(Math.abs(cashFlow) * 100) / 100;
  }

  const pnlPoints = computePnlPoints(legs, currentPrice);
  const pnls = pnlPoints.map(p => p.pnl);
  const maxProfit = Math.round(Math.max(...pnls) * 100) / 100;

  // Compute max loss analytically at critical prices (0, each strike, high price)
  // rather than relying on sampled points which may miss the true worst case
  let maxLoss: number | null = null;
  if (!isUnlimited) {
    const criticalPrices = [0, ...legs.map(l => l.strike), Math.max(...legs.map(l => l.strike)) * 2];
    let worstPnl = 0;
    for (const p of criticalPrices) {
      let pnl = 0;
      for (const leg of legs) {
        const intrinsic = leg.type === 'call'
          ? Math.max(0, p - leg.strike)
          : Math.max(0, leg.strike - p);
        pnl += leg.side === 'buy' ? (intrinsic - leg.price) * 100 : (leg.price - intrinsic) * 100;
      }
      worstPnl = Math.min(worstPnl, pnl);
    }
    maxLoss = Math.round(Math.abs(worstPnl) * 100) / 100;
  }

  // Breakevens: where P&L crosses zero
  const breakevens: number[] = [];
  for (let i = 1; i < pnlPoints.length; i++) {
    const prev = pnlPoints[i - 1];
    const curr = pnlPoints[i];
    if ((prev.pnl <= 0 && curr.pnl > 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
      // Linear interpolation
      const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
      breakevens.push(Math.round((prev.price + ratio * (curr.price - prev.price)) * 100) / 100);
    }
  }

  const netDelta = legs.reduce((s, l) => s + l.delta, 0);
  const netGamma = legs.reduce((s, l) => s + l.gamma, 0);
  const netTheta = legs.reduce((s, l) => s + l.theta, 0);
  const netVega = legs.reduce((s, l) => s + l.vega, 0);
  const thetaPerDay = Math.round(netTheta * 100 * 100) / 100; // theta * 100 contracts scaling

  // Pop approximation
  let pop: number | null = null;
  if (cashFlow >= 0) {
    // Credit strategy: PoP ≈ 1 - sum of |short deltas in direction of risk|
    const shortPutDelta = legs.filter(l => l.side === 'sell' && l.type === 'put').reduce((s, l) => s + Math.abs(l.delta), 0);
    const shortCallDelta = legs.filter(l => l.side === 'sell' && l.type === 'call').reduce((s, l) => s + Math.abs(l.delta), 0);
    pop = Math.max(0, Math.min(1, 1 - shortPutDelta - shortCallDelta));
  } else {
    // Debit strategy: PoP ≈ delta of the long leg
    const longLegs = legs.filter(l => l.side === 'buy');
    if (longLegs.length > 0) {
      pop = Math.abs(longLegs[0].delta);
    }
  }

  const riskReward = maxLoss != null && maxLoss > 0 ? Math.round((maxProfit / maxLoss) * 100) / 100 : null;

  return {
    name, label, legs, expiration, dte,
    netCredit, netDebit,
    maxProfit: maxProfit > 0 ? maxProfit : null,
    maxLoss,
    breakevens,
    pop: pop != null ? Math.round(pop * 100) / 100 : null,
    popMethod: 'delta_approx',
    riskReward,
    netDelta: Math.round(netDelta * 1000) / 1000,
    netGamma: Math.round(netGamma * 10000) / 10000,
    netTheta: Math.round(netTheta * 1000) / 1000,
    netVega: Math.round(netVega * 1000) / 1000,
    thetaPerDay,
    isUnlimited,
    pnlPoints,
    hasWideSpread: legs.some(l => l.wideSpread),
    ev: 0,
    evPerRisk: 0,
    hvPop: null,
    compositeScore: 0,
  };
}

// ─── Delta Range Scanners ────────────────────────────────────────

const IC_DELTAS = [0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.25];
const PCS_DELTAS = [0.15, 0.18, 0.20, 0.22, 0.25, 0.28, 0.30];
const SS_DELTAS = [0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.25];

function scanBestIronCondor(
  valid: StrikeData[], label: string, expiration: string, dte: number, currentPrice: number, sym = '??'
): StrategyCard | null {
  let best: StrategyCard | null = null;
  let bestScore = -Infinity;
  const widths = getSpreadWidthCandidates(valid);
  console.log(`[StrategyBuilder] ${sym}: IC width candidates: [${widths.map(w => '$' + w).join(', ')}]`);

  for (const d of IC_DELTAS) {
    const sp = findByDelta(valid, -d, 'put');
    const sc = findByDelta(valid, d, 'call');
    if (!sp || !sc) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — findByDelta failed (shortPut=${sp?.strike ?? 'null'}, shortCall=${sc?.strike ?? 'null'})`);
      continue;
    }

    for (const width of widths) {
      // Both sides use same width for symmetry
      const lp = findClosestStrike(valid, sp.strike - width, 'below');
      const lc = findClosestStrike(valid, sc.strike + width, 'above');
      if (!lp || !lc || lp.strike === sp.strike || lc.strike === sc.strike) {
        continue;
      }
      const legs = [
        makeLeg(sp, 'put', 'sell'),
        makeLeg(lp, 'put', 'buy'),
        makeLeg(sc, 'call', 'sell'),
        makeLeg(lc, 'call', 'buy'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length !== 4) continue;

      const card = buildCard('Iron Condor', label, legs, expiration, dte, currentPrice, false);
      if (card.netCredit == null || card.netCredit <= 0) continue;
      if (card.pop == null || card.maxLoss == null || card.maxLoss <= 0) continue;
      const mp = card.maxProfit ?? 0;
      if (mp <= 0) continue;

      const actualWidth = sp.strike - lp.strike;
      const score = card.pop * (mp / card.maxLoss);
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} w=$${actualWidth} — score=${score.toFixed(3)} (pop=${card.pop}, mp=$${mp}, ml=$${card.maxLoss})`);
      if (score > bestScore) { bestScore = score; best = card; }
    }
  }
  console.log(`[StrategyBuilder] ${sym}: IC result → ${best ? `PASS (score=${bestScore.toFixed(3)})` : 'FAIL (no valid candidate)'}`);
  return best;
}

function scanBestPutCreditSpread(
  valid: StrikeData[], label: string, expiration: string, dte: number, currentPrice: number, sym = '??'
): StrategyCard | null {
  let best: StrategyCard | null = null;
  let bestScore = -Infinity;
  const widths = getSpreadWidthCandidates(valid);
  console.log(`[StrategyBuilder] ${sym}: PCS width candidates: [${widths.map(w => '$' + w).join(', ')}]`);

  for (const d of PCS_DELTAS) {
    const sp = findByDelta(valid, -d, 'put');
    if (!sp) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — findByDelta(put) returned null`);
      continue;
    }

    for (const width of widths) {
      const lp = findClosestStrike(valid, sp.strike - width, 'below');
      if (!lp || lp.strike === sp.strike) continue;

      const legs = [
        makeLeg(sp, 'put', 'sell'),
        makeLeg(lp, 'put', 'buy'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length !== 2) continue;

      const card = buildCard('Put Credit Spread', label, legs, expiration, dte, currentPrice, false);
      if (card.netCredit == null || card.netCredit <= 0) continue;
      if (card.pop == null || card.maxLoss == null || card.maxLoss <= 0) continue;
      const mp = card.maxProfit ?? 0;
      if (mp <= 0) continue;

      const actualWidth = sp.strike - lp.strike;
      const score = card.pop * (mp / card.maxLoss);
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} w=$${actualWidth} — score=${score.toFixed(3)} (pop=${card.pop}, mp=$${mp}, ml=$${card.maxLoss})`);
      if (score > bestScore) { bestScore = score; best = card; }
    }
  }
  console.log(`[StrategyBuilder] ${sym}: PCS result → ${best ? `PASS (score=${bestScore.toFixed(3)})` : 'FAIL (no valid candidate)'}`);
  return best;
}

function scanBestShortStrangle(
  valid: StrikeData[], label: string, expiration: string, dte: number, currentPrice: number, sym = '??'
): StrategyCard | null {
  let best: StrategyCard | null = null;
  let bestScore = -Infinity;
  for (const d of SS_DELTAS) {
    const sp = findByDelta(valid, -d, 'put');
    const sc = findByDelta(valid, d, 'call');
    if (!sp || !sc) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — findByDelta failed (put=${sp?.strike ?? 'null'}, call=${sc?.strike ?? 'null'})`);
      continue;
    }
    const legs = [
      makeLeg(sp, 'put', 'sell'),
      makeLeg(sc, 'call', 'sell'),
    ].filter((l): l is StrategyLeg => l != null);
    if (legs.length !== 2) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — makeLeg failed, only ${legs.length}/2 legs`);
      continue;
    }
    const card = buildCard('Short Strangle', label, legs, expiration, dte, currentPrice, true);
    if (card.netCredit == null || card.netCredit <= 0) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — rejected: netCredit=${card.netCredit}`);
      continue;
    }
    if (card.pop == null) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — rejected: pop=null`);
      continue;
    }
    const score = card.pop * card.netCredit * 100;
    console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — candidate score=${score.toFixed(3)} (pop=${card.pop}, credit=$${card.netCredit})`);
    if (score > bestScore) { bestScore = score; best = card; }
  }
  console.log(`[StrategyBuilder] ${sym}: SS result → ${best ? `PASS (score=${bestScore.toFixed(3)})` : 'FAIL (no valid candidate)'}`);
  return best;
}

// ─── Tier 2: Full Strategy Generation ───────────────────────────────

export function generateStrategies(params: GenerateParams): GenerateResult {
  const { strikes, currentPrice, ivRank, expiration, dte, symbol } = params;
  const sym = symbol || '??';
  const pct = ivRank * 100;
  const rejections: RejectionReason[] = [];

  // Filter to strikes with at least some Greeks data AND a real two-sided quote on a leg.
  // (EDGE-1: buildStrikeData already nulls both sides of any leg without a live bid+ask,
  // so a strike with no live leg has all four price fields null and is excluded here.)
  const valid = strikes.filter(s =>
    (s.callDelta != null || s.putDelta != null) &&
    (s.callBid != null || s.callAsk != null || s.putBid != null || s.putAsk != null)
  );

  // EDGE-1: declare, don't silently shrink. Count strikes that had greeks but no live
  // two-sided quote on any leg (their prices were nulled at the quote layer). Surface it
  // as a rejection so the scan stats show WHY fewer cards appear.
  const droppedNoLiveQuote = strikes.filter(s =>
    (s.callDelta != null || s.putDelta != null) &&
    s.callBid == null && s.callAsk == null && s.putBid == null && s.putAsk == null
  ).length;
  if (droppedNoLiveQuote > 0) {
    rejections.push({ strategy: 'all', reason: `${droppedNoLiveQuote} strikes skipped: no live bid+ask (missing_live_quote)`, gate: 'construction' });
  }

  // KILL-2: declare, don't silently shrink (same surface as missing_live_quote).
  // A live-quoted side whose greeks are incomplete has its legs excluded by
  // makeLeg — missing greeks are never imputed as 0.
  const sideGreeksIncomplete = (s: StrikeData, side: 'call' | 'put') =>
    side === 'call'
      ? (s.callDelta == null || s.callGamma == null || s.callTheta == null || s.callVega == null)
      : (s.putDelta == null || s.putGamma == null || s.putTheta == null || s.putVega == null);
  const droppedIncompleteGreeks = strikes.filter(s =>
    (s.callBid != null && s.callAsk != null && sideGreeksIncomplete(s, 'call')) ||
    (s.putBid != null && s.putAsk != null && sideGreeksIncomplete(s, 'put'))
  ).length;
  if (droppedIncompleteGreeks > 0) {
    rejections.push({ strategy: 'all', reason: `${droppedIncompleteGreeks} live-quoted strike(s) lacked complete greeks from the feed — those legs excluded from construction (missing_greeks, never imputed as 0)`, gate: 'construction' });
  }

  const noGreeks = strikes.filter(s => s.callDelta == null && s.putDelta == null).length;
  console.log(`[StrategyBuilder] ${sym}: ENTER — price=$${currentPrice}, ivRank=${ivRank.toFixed(3)} (${pct.toFixed(1)}%), dte=${dte}, exp=${expiration}`);
  console.log(`[StrategyBuilder] ${sym}: strikes total=${strikes.length}, valid=${valid.length}, noGreeks=${noGreeks}`);
  if (valid.length > 0) {
    const putDeltas = valid.map(s => s.putDelta).filter(d => d != null) as number[];
    const callDeltas = valid.map(s => s.callDelta).filter(d => d != null) as number[];
    console.log(`[StrategyBuilder] ${sym}: putDeltas range=[${Math.min(...putDeltas).toFixed(3)}..${Math.max(...putDeltas).toFixed(3)}] (${putDeltas.length} strikes)`);
    console.log(`[StrategyBuilder] ${sym}: callDeltas range=[${Math.min(...callDeltas).toFixed(3)}..${Math.max(...callDeltas).toFixed(3)}] (${callDeltas.length} strikes)`);
    console.log(`[StrategyBuilder] ${sym}: strike range=[$${Math.min(...valid.map(s => s.strike))}..$${Math.max(...valid.map(s => s.strike))}]`);
  }
  if (valid.length < 3) {
    console.log(`[StrategyBuilder] ${sym}: ABORT — only ${valid.length} valid strikes (need ≥3)`);
    rejections.push({ strategy: 'all', reason: `Only ${valid.length} valid strikes (need ≥3)`, gate: 'construction' });
    return { strategies: [], rejections };
  }

  const tier = pct > 50 ? 'HIGH_IV (>50)' : pct >= 20 ? 'NORMAL_IV (20-50)' : 'LOW_IV (<20)';
  console.log(`[StrategyBuilder] ${sym}: IV tier=${tier} → generating strategies...`);

  const cards: StrategyCard[] = [];

  if (pct > 50) {
    // ─── High IV: Sell Premium — scan delta ranges ─────
    const ic = scanBestIronCondor(valid, 'A', expiration, dte, currentPrice, sym);
    if (ic) cards.push(ic);

    const pcs = scanBestPutCreditSpread(valid, 'B', expiration, dte, currentPrice, sym);
    if (pcs) cards.push(pcs);

    const ss = scanBestShortStrangle(valid, 'C', expiration, dte, currentPrice, sym);
    if (ss) cards.push(ss);

  } else if (pct >= 20) {
    // ─── Normal IV: Mild Directional ─────────────────────
    // A) Bull Call Spread (debit — fixed delta, no scan)
    const longBCS = findByDelta(valid, 0.50, 'call');
    const shortBCS = findByDelta(valid, 0.30, 'call');
    if (longBCS && shortBCS && longBCS.strike !== shortBCS.strike) {
      const legs = [
        makeLeg(longBCS, 'call', 'buy'),
        makeLeg(shortBCS, 'call', 'sell'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Bull Call Spread', 'A', legs, expiration, dte, currentPrice, false));
      }
    }

    // B) Iron Condor — scan
    const icW = scanBestIronCondor(valid, 'B', expiration, dte, currentPrice, sym);
    if (icW) cards.push(icW);

    // C) Put Credit Spread — scan
    const pcs2 = scanBestPutCreditSpread(valid, 'C', expiration, dte, currentPrice, sym);
    if (pcs2) cards.push(pcs2);

  } else {
    // ─── Low IV: Buy Premium ──────────────────────────
    // A) Long Straddle
    const atm = findByDelta(valid, 0.50, 'call');
    if (atm) {
      const legs = [
        makeLeg(atm, 'call', 'buy'),
        makeLeg(atm, 'put', 'buy'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Long Straddle', 'A', legs, expiration, dte, currentPrice, false));
      }
    }

    // B) Long Strangle
    const buyCallLS = findByDelta(valid, 0.30, 'call');
    const buyPutLS = findByDelta(valid, -0.30, 'put');
    if (buyCallLS && buyPutLS && buyCallLS.strike !== buyPutLS.strike) {
      const legs = [
        makeLeg(buyCallLS, 'call', 'buy'),
        makeLeg(buyPutLS, 'put', 'buy'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Long Strangle', 'B', legs, expiration, dte, currentPrice, false));
      }
    }

    // C) Bull Call Debit Spread
    const longDBS = findByDelta(valid, 0.50, 'call');
    const shortDBS = findByDelta(valid, 0.30, 'call');
    if (longDBS && shortDBS && longDBS.strike !== shortDBS.strike) {
      const legs = [
        makeLeg(longDBS, 'call', 'buy'),
        makeLeg(shortDBS, 'call', 'sell'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Debit Spread', 'C', legs, expiration, dte, currentPrice, false));
      }
    }
  }

  console.log(`[StrategyBuilder] ${sym}: pre-filter cards=${cards.length} [${cards.map(c => c.name).join(', ')}]`);

  // ─── Upgrade PoP: delta approximation → N(d2) at breakeven ────
  const iv = params.iv30 ?? 0.30;

  for (const card of cards) {
    if (card.breakevens.length === 0 || card.pop == null) continue;
    const isCredit = CREDIT_STRATEGIES.includes(card.name) || (card.netCredit != null && card.netCredit > 0);
    const bePoP = calculateBreakevenPoP(card.breakevens, currentPrice, iv, dte, isCredit, params.riskFreeRate);
    if (bePoP) {
      const deltaPop = card.pop;
      card.pop = Math.round(bePoP.pop * 100) / 100;
      card.popMethod = bePoP.method;
      console.log(`[StrategyBuilder] ${sym}: PoP upgrade "${card.name}" — delta=${(deltaPop * 100).toFixed(1)}% → N(d2)=${(bePoP.pop * 100).toFixed(1)}% (IV=${(iv * 100).toFixed(1)}%, DTE=${dte}, BEs=[${card.breakevens.join(', ')}])`);
    }
  }

  // ─── Compute HV-Adjusted EV for each card ──────────────────────
  const hv = params.hv30 ?? iv;
  // Safety cap: if IV/HV ratio > 4, cap at 4 to prevent unrealistic adjustments
  const cappedHv = iv > 0 && hv > 0 && iv / hv > 4 ? iv / 4 : hv;
  const hvProxyML = currentPrice * cappedHv * Math.sqrt(dte / 365) * 2.5 * 100;

  for (const card of cards) {
    if (card.pop == null) continue;
    const mp = card.maxProfit ?? 0;
    const isCredit = CREDIT_STRATEGIES.includes(card.name);

    // HV-adjusted PoP for credit strategies; delta PoP for debit
    const hvPop = isCredit ? computeHvAdjustedPoP(card, currentPrice, cappedHv, dte) : card.pop;
    card.hvPop = isCredit ? Math.round(hvPop * 1000) / 1000 : null;

    // Use HV-based proxy for unlimited risk (actual expected movement, not inflated IV)
    const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);
    const evPop = isCredit ? hvPop : card.pop;

    if (mp > 0 && effectiveML > 0) {
      // Extract short/long deltas for three-outcome model
      const shortLegs = card.legs.filter(l => l.side === 'sell');
      const longLegs = card.legs.filter(l => l.side === 'buy');

      // For spreads: use absolute deltas of short and long strikes
      const shortDelta = shortLegs.length > 0 ? Math.max(...shortLegs.map(l => Math.abs(l.delta))) : null;
      const longDelta = longLegs.length > 0 ? Math.max(...longLegs.map(l => Math.abs(l.delta))) : null;

      // Three-outcome EV for defined-risk spreads; binary for unlimited/single-leg
      if (!card.isUnlimited && shortLegs.length > 0 && longLegs.length > 0) {
        const result = calculateThreeOutcomeEV(evPop, mp, effectiveML, shortDelta, longDelta);
        card.ev = result.ev;
        card.evPerRisk = result.evPerRisk;
      } else {
        // Binary model for unlimited-risk or single-leg strategies
        card.ev = Math.round((evPop * mp - (1 - evPop) * effectiveML) * 100) / 100;
        card.evPerRisk = Math.round((card.ev / effectiveML) * 10000) / 10000;
      }
    }
  }

  // ─── 3-Tier Gate System ─────────────────────────────────────────
  const POP_FLOORS: Record<string, number> = {
    'Put Credit Spread': 0.55, 'Call Credit Spread': 0.55,
    'Iron Condor': 0.50, 'Short Strangle': 0.60, 'Jade Lizard': 0.55,
    'Bull Call Spread': 0.30, 'Bear Put Spread': 0.30, 'Debit Spread': 0.30,
    'Calendar Spread': 0.30, 'Diagonal Spread': 0.30,
    'Long Straddle': 0.25, 'Long Strangle': 0.25,
  };

  // EDGE-3: track whether the HV10>IV gate ever passed a premium-selling card
  // without being evaluable — the non-evaluation is DECLARED below, never silent.
  let hv10GateSkippedNoHv10 = 0;
  const hv10GateSkippedNoLegIv: string[] = [];

  const filtered = cards.filter(card => {
    // ─── EDGE-3 Sanity Gate 1: strike-price monotonicity ─────────────
    // No-arbitrage ordering at the prices this card actually transacts at
    // (sell legs @ bid, buy legs @ ask — see makeLeg): a put at a lower strike
    // must not cost more than a put at a higher strike; a call at a higher
    // strike must not cost more than a call at a lower strike. A violating
    // chain is broken — the candidate is REJECTED and declared, never repaired.
    for (const legType of ['put', 'call'] as const) {
      const sameType = card.legs
        .filter(l => l.type === legType)
        .sort((a, b) => a.strike - b.strike);
      for (let i = 0; i < sameType.length; i++) {
        for (let j = i + 1; j < sameType.length; j++) {
          const lo = sameType[i];
          const hi = sameType[j];
          if (lo.strike === hi.strike) continue;
          const violated = legType === 'put' ? lo.price > hi.price : hi.price > lo.price;
          if (violated) {
            const detail = `${legType} ${lo.strike} @ $${lo.price.toFixed(2)} (${lo.side}) vs ${legType} ${hi.strike} @ $${hi.price.toFixed(2)} (${hi.side})`;
            console.log(`[StrategyBuilder] ${sym}: MONOTONICITY GATE rejected "${card.name}" — ${detail}`);
            rejections.push({
              strategy: card.name,
              reason: `monotonicity_violation: ${detail}`,
              gate: 'construction',
            });
            return false;
          }
        }
      }
    }

    // ─── EDGE-3 Sanity Gate 2: HV10 > sold IV disqualification ───────
    // Premium-selling only: if 10-day realized vol exceeds the IV of the legs
    // being SOLD, the premium is underpriced for current movement — REJECT.
    // Unevaluable (hv10 null or no short-leg IV from the feed) → the candidate
    // proceeds and the non-evaluation is DECLARED after the filter (no silent
    // gap, no invented value, no waiver logic).
    if (CREDIT_STRATEGIES.includes(card.name)) {
      const shortIvs = card.legs
        .filter(l => l.side === 'sell' && l.iv != null && l.iv > 0)
        .map(l => l.iv as number);
      if (params.hv10 == null) {
        hv10GateSkippedNoHv10++;
      } else if (shortIvs.length === 0) {
        hv10GateSkippedNoLegIv.push(card.name);
      } else {
        const soldIv = shortIvs.reduce((a, b) => a + b, 0) / shortIvs.length;
        if (params.hv10 > soldIv) {
          const detail = `hv10=${(params.hv10 * 100).toFixed(1)}% iv=${(soldIv * 100).toFixed(1)}%`;
          console.log(`[StrategyBuilder] ${sym}: HV10>IV GATE rejected "${card.name}" — ${detail} (short-leg IVs: [${shortIvs.map(v => (v * 100).toFixed(1)).join(', ')}])`);
          rejections.push({
            strategy: card.name,
            reason: `hv10_exceeds_iv: ${detail}`,
            gate: 'construction',
            details: { value: params.hv10, threshold: soldIv },
          });
          return false;
        }
      }
    }

    // Gate A: EV must be positive (uses hvPoP for credit, deltaPoP for debit)
    if (card.ev <= 0) {
      const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);
      console.log(`[StrategyBuilder] ${sym}: EV GATE rejected "${card.name}" — EV=$${card.ev.toFixed(0)} (hvPoP=${card.hvPop?.toFixed(3) ?? 'n/a'}, deltaPoP=${card.pop?.toFixed(3)}, mp=$${card.maxProfit}, ml=$${effectiveML.toFixed(0)})`);
      const strikes = card.legs.map(l => l.strike).sort((a, b) => a - b);
      const sw = strikes.length >= 2 ? strikes[1] - strikes[0] : 0;
      rejections.push({
        strategy: card.name,
        reason: `EV $${card.ev.toFixed(0)} below minimum $0`,
        gate: 'A',
        details: { value: card.ev, threshold: 0, spreadWidth: sw },
      });
      return false;
    }

    // Gate B: Strategy-specific PoP floor (uses delta PoP — conservative)
    const threshold = POP_FLOORS[card.name] ?? 0.40;
    if (card.pop == null || card.pop < threshold) {
      console.log(`[StrategyBuilder] ${sym}: PoP GATE rejected "${card.name}" — pop=${card.pop != null ? (card.pop * 100).toFixed(1) + '%' : 'null'}, threshold=${(threshold * 100).toFixed(0)}%`);
      rejections.push({
        strategy: card.name,
        reason: `Est. PoP ${card.pop != null ? (card.pop * 100).toFixed(0) + '%' : 'null'} below floor ${(threshold * 100).toFixed(0)}%`,
        gate: 'B',
        details: { value: card.pop ?? 0, threshold },
      });
      return false;
    }

    // Gate C: Minimum credit for credit strategies ($0.10/share = $10/contract)
    if (card.netCredit != null && card.netCredit < 0.10) {
      console.log(`[StrategyBuilder] ${sym}: MIN CREDIT rejected "${card.name}" — credit=$${card.netCredit.toFixed(2)} < $0.10 floor`);
      rejections.push({
        strategy: card.name,
        reason: `Credit $${card.netCredit.toFixed(2)} below $0.10 minimum`,
        gate: 'C',
        details: { value: card.netCredit, threshold: 0.10 },
      });
      return false;
    }

    return true;
  });

  // EDGE-3: declare, don't silently pass. If the HV10>IV gate could not be
  // evaluated for premium-selling candidates, say so on the same surface as
  // missing_live_quote (EDGE-1 precedent) — these are declarations, not
  // rejections; the candidates proceeded UNCHECKED.
  if (hv10GateSkippedNoHv10 > 0) {
    console.log(`[StrategyBuilder] ${sym}: HV10>IV gate NOT EVALUATED for ${hv10GateSkippedNoHv10} premium-selling candidate(s) — hv10 unavailable (insufficient candle history)`);
    rejections.push({
      strategy: 'all',
      reason: `hv10 unavailable — HV10>IV gate not evaluated (${hv10GateSkippedNoHv10} premium-selling candidate(s) proceeded unchecked)`,
      gate: 'construction',
    });
  }
  if (hv10GateSkippedNoLegIv.length > 0) {
    console.log(`[StrategyBuilder] ${sym}: HV10>IV gate NOT EVALUATED for [${hv10GateSkippedNoLegIv.join(', ')}] — no short-leg IV from the chain feed`);
    rejections.push({
      strategy: 'all',
      reason: `no short-leg IV from chain feed — HV10>IV gate not evaluated (${hv10GateSkippedNoLegIv.join(', ')} proceeded unchecked)`,
      gate: 'construction',
    });
  }

  // ─── Edge-Aware Composite Scoring ───────────────────────────────
  const edgeRatio = iv > 0 ? Math.max(0, (iv - hv)) / iv : 0;
  filtered.sort((a, b) => {
    const scoreA = computeCompositeScore(a);
    const scoreB = computeCompositeScore(b);
    return scoreB - scoreA;
  });

  function computeCompositeScore(card: StrategyCard): number {
    const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);
    const thetaEff = effectiveML > 0 ? Math.abs(card.thetaPerDay) / effectiveML * 100 : 0;
    return (card.evPerRisk * 50) + (thetaEff * 30) + (edgeRatio * 20);
  }

  // Persist composite scores on each card
  filtered.forEach(card => { card.compositeScore = Math.round(computeCompositeScore(card) * 1000) / 1000; });

  // Re-label sequentially based on strategies that actually generated
  filtered.forEach((card, i) => { card.label = String.fromCharCode(65 + i); });
  console.log(`[StrategyBuilder] ${sym}: RESULT → ${filtered.length} strategies [${filtered.map(c => `${c.label}) ${c.name} (EV=$${c.ev.toFixed(0)})`).join(', ')}], ${rejections.length} rejections`);
  return { strategies: filtered, rejections };
}

// ─── Build from strikes data ────────────────────────────────────────

export function buildStrikeData(
  expStrikes: any[],
  greeksData: Record<string, any>
): StrikeData[] {
  const result: StrikeData[] = [];
  for (const s of expStrikes) {
    const cg = greeksData[s.callStreamerSymbol] || {};
    const pg = greeksData[s.putStreamerSymbol] || {};

    let callBid: number | null = cg.bid ?? null;
    let callAsk: number | null = cg.ask ?? null;
    let putBid: number | null = pg.bid ?? null;
    let putAsk: number | null = pg.ask ?? null;

    // EDGE-1: a leg is VALID only with a real bid > 0 AND a real ask > 0 from the chain.
    // No estimation from one side (removed the old 0.4/2.5 blocks), no exchange-theo
    // substitution (removed the old theo × 0.85/1.15 blocks), no one-sided fill. A leg
    // missing either live side is dead — BOTH its sides are nulled so nothing downstream
    // can build, price, or score a strategy on a fabricated quote.
    const callLive = callBid != null && callBid > 0 && callAsk != null && callAsk > 0;
    const putLive = putBid != null && putBid > 0 && putAsk != null && putAsk > 0;
    if (!callLive) { callBid = null; callAsk = null; }
    if (!putLive) { putBid = null; putAsk = null; }

    // Exchange theo is retained as INFORMATIONAL context only (recorded in the row below);
    // it is never substituted into bid/ask.
    const callTheo = cg.theoPrice > 0 ? cg.theoPrice : null;
    const putTheo = pg.theoPrice > 0 ? pg.theoPrice : null;

    // Price source is now live-only: a strike is 'live' if it carries at least one leg with
    // a real two-sided quote, else 'none'. 'theo'/'mixed' can no longer occur.
    const priceSource: 'live' | 'theo' | 'mixed' | 'none' = (callLive || putLive) ? 'live' : 'none';

    // Inverted quotes — null out that side entirely
    if (callBid != null && callAsk != null && callBid > callAsk) {
      callBid = null; callAsk = null;
    }
    if (putBid != null && putAsk != null && putBid > putAsk) {
      putBid = null; putAsk = null;
    }

    // Wide spread detection: (ask - bid) / midpoint > 50%
    const callMid = callBid != null && callAsk != null ? (callAsk + callBid) / 2 : 0;
    const callWideSpread = callMid > 0 ? (callAsk! - callBid!) / callMid > 0.50 : false;
    const putMid = putBid != null && putAsk != null ? (putAsk + putBid) / 2 : 0;
    const putWideSpread = putMid > 0 ? (putAsk! - putBid!) / putMid > 0.50 : false;

    result.push({
      strike: s.strike,
      callBid, callAsk, putBid, putAsk,
      callDelta: cg.delta ?? null,
      putDelta: pg.delta ?? null,
      callTheta: cg.theta ?? null,
      putTheta: pg.theta ?? null,
      callGamma: cg.gamma ?? null,
      putGamma: pg.gamma ?? null,
      callVega: cg.vega ?? null,
      putVega: pg.vega ?? null,
      callIv: cg.iv ?? null,
      putIv: pg.iv ?? null,
      callVolume: cg.volume ?? null,
      putVolume: pg.volume ?? null,
      callOI: cg.openInterest ?? null,
      putOI: pg.openInterest ?? null,
      callTheoPrice: callTheo,
      putTheoPrice: putTheo,
      priceSource,
      callWideSpread,
      putWideSpread,
    });
  }
  return result;
}

// ─── Custom Strategy Builder ────────────────────────────────────────

export interface CustomLeg {
  type: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  streamerSymbol: string;
}

export function detectStrategyName(legs: CustomLeg[]): string {
  const sorted = [...legs].sort((a, b) => a.strike - b.strike);
  const n = sorted.length;

  if (n === 1) {
    const l = sorted[0];
    return l.side === 'buy'
      ? (l.type === 'call' ? 'Long Call' : 'Long Put')
      : (l.type === 'call' ? 'Short Call' : 'Short Put');
  }

  if (n === 2) {
    const [lo, hi] = sorted;
    // Vertical spreads
    if (lo.type === 'call' && hi.type === 'call') {
      if (lo.side === 'buy' && hi.side === 'sell') return 'Bull Call Spread';
      if (lo.side === 'sell' && hi.side === 'buy') return 'Bear Call Spread';
    }
    if (lo.type === 'put' && hi.type === 'put') {
      if (lo.side === 'buy' && hi.side === 'sell') return 'Bear Put Spread';
      if (lo.side === 'sell' && hi.side === 'buy') return 'Bull Put Spread';
    }
    // Straddle
    if (lo.strike === hi.strike && lo.type !== hi.type) {
      return lo.side === 'buy' && hi.side === 'buy' ? 'Long Straddle' : 'Short Straddle';
    }
    // Strangle
    if (lo.type === 'put' && hi.type === 'call') {
      return lo.side === 'buy' && hi.side === 'buy' ? 'Long Strangle' : 'Short Strangle';
    }
  }

  if (n === 4) {
    const puts = sorted.filter(l => l.type === 'put');
    const calls = sorted.filter(l => l.type === 'call');
    if (puts.length === 2 && calls.length === 2) {
      const hasBuyPut = puts.some(p => p.side === 'buy');
      const hasSellPut = puts.some(p => p.side === 'sell');
      const hasBuyCall = calls.some(c => c.side === 'buy');
      const hasSellCall = calls.some(c => c.side === 'sell');
      if (hasBuyPut && hasSellPut && hasBuyCall && hasSellCall) return 'Iron Condor';
    }
    // Iron Butterfly
    const sells = sorted.filter(l => l.side === 'sell');
    if (sells.length === 2 && sells[0].strike === sells[1].strike) return 'Iron Butterfly';
  }

  if (n === 3) {
    // Jade Lizard: short put + short call spread
    const sellPuts = sorted.filter(l => l.type === 'put' && l.side === 'sell');
    const sellCalls = sorted.filter(l => l.type === 'call' && l.side === 'sell');
    const buyCalls = sorted.filter(l => l.type === 'call' && l.side === 'buy');
    if (sellPuts.length === 1 && sellCalls.length === 1 && buyCalls.length === 1) return 'Jade Lizard';
  }

  return 'Custom Strategy';
}

export function buildCustomCard(
  customLegs: CustomLeg[],
  greeksData: Record<string, any>,
  expiration: string,
  dte: number,
  currentPrice: number
): StrategyCard | null {
  const legs: StrategyLeg[] = [];
  for (const cl of customLegs) {
    const g = greeksData[cl.streamerSymbol] || {};
    const bid: number | null = g.bid ?? null;
    const ask: number | null = g.ask ?? null;
    const price = cl.side === 'sell' ? bid : ask;
    if (price == null || price <= 0) continue;
    const midVal = bid != null && ask != null ? (ask + bid) / 2 : 0;
    const wide = midVal > 0 ? (ask! - bid!) / midVal > 0.50 : false;
    // KILL-2: same rule as makeLeg — a leg without complete greeks cannot be
    // built; the whole custom card fails rather than carrying imputed-0 greeks.
    const delta = numOrNull(g.delta);
    const gamma = numOrNull(g.gamma);
    const theta = numOrNull(g.theta);
    const vega = numOrNull(g.vega);
    if (delta == null || gamma == null || theta == null || vega == null) return null;
    legs.push({
      type: cl.type,
      side: cl.side,
      strike: cl.strike,
      price,
      delta: cl.side === 'sell' ? -delta : delta,
      gamma: cl.side === 'sell' ? -gamma : gamma,
      theta: cl.side === 'sell' ? -theta : theta,
      vega: cl.side === 'sell' ? -vega : vega,
      wideSpread: wide,
    });
  }
  if (legs.length === 0) return null;

  const hasNaked = legs.some(l => l.side === 'sell') &&
    !legs.every(l => l.side === 'sell' ? legs.some(l2 => l2.side === 'buy' && l2.type === l.type) : true);

  const name = detectStrategyName(customLegs);
  return buildCard(name, 'Custom', legs, expiration, dte, currentPrice, hasNaked);
}

// ─── P&L Chart SVG ──────────────────────────────────────────────────

export function renderPnlSvg(
  pnlPoints: { price: number; pnl: number }[],
  breakevens: number[],
  currentPrice: number,
  width = 280,
  height = 140
): string {
  if (pnlPoints.length < 2) return '';

  const pad = { top: 15, right: 10, bottom: 20, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const prices = pnlPoints.map(p => p.price);
  const pnls = pnlPoints.map(p => p.pnl);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 0);
  const pnlRange = maxPnl - minPnl || 1;

  const scaleX = (p: number) => pad.left + ((p - minP) / (maxP - minP)) * w;
  const scaleY = (pnl: number) => pad.top + h - ((pnl - minPnl) / pnlRange) * h;

  const zeroY = scaleY(0);

  // Build polyline points
  const linePoints = pnlPoints.map(p => `${scaleX(p.price).toFixed(1)},${scaleY(p.pnl).toFixed(1)}`).join(' ');

  // Green/red fill areas
  let greenPath = '';
  let redPath = '';

  // Build fill paths by splitting at zero crossings
  for (let i = 0; i < pnlPoints.length - 1; i++) {
    const p1 = pnlPoints[i];
    const p2 = pnlPoints[i + 1];
    const x1 = scaleX(p1.price);
    const x2 = scaleX(p2.price);
    const y1 = scaleY(p1.pnl);
    const y2 = scaleY(p2.pnl);

    if (p1.pnl >= 0 && p2.pnl >= 0) {
      greenPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
    } else if (p1.pnl <= 0 && p2.pnl <= 0) {
      redPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
    } else {
      // Crossing: split at zero
      const ratio = Math.abs(p1.pnl) / (Math.abs(p1.pnl) + Math.abs(p2.pnl));
      const xCross = x1 + ratio * (x2 - x1);
      if (p1.pnl > 0) {
        greenPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${xCross.toFixed(1)},${zeroY.toFixed(1)} Z `;
        redPath += `M${xCross.toFixed(1)},${zeroY.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
      } else {
        redPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${xCross.toFixed(1)},${zeroY.toFixed(1)} Z `;
        greenPath += `M${xCross.toFixed(1)},${zeroY.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
      }
    }
  }

  // Breakeven lines
  let beLines = '';
  for (const be of breakevens) {
    if (be >= minP && be <= maxP) {
      const x = scaleX(be);
      beLines += `<line x1="${x.toFixed(1)}" y1="${pad.top}" x2="${x.toFixed(1)}" y2="${pad.top + h}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
  }

  // Current price line
  const cpX = scaleX(currentPrice);
  const cpLine = (currentPrice >= minP && currentPrice <= maxP)
    ? `<line x1="${cpX.toFixed(1)}" y1="${pad.top}" x2="${cpX.toFixed(1)}" y2="${pad.top + h}" stroke="#6366f1" stroke-width="1" stroke-dasharray="2,2"/>`
    : '';

  // Max profit / loss labels
  const mpVal = Math.max(...pnls);
  const mlVal = Math.min(...pnls);
  const mpLabel = mpVal > 0 ? `<text x="${pad.left + 2}" y="${pad.top + 10}" font-size="9" fill="#16a34a">+$${Math.round(mpVal)}</text>` : '';
  const mlLabel = mlVal < 0 ? `<text x="${pad.left + 2}" y="${pad.top + h - 2}" font-size="9" fill="#dc2626">-$${Math.round(Math.abs(mlVal))}</text>` : '';

  // Zero line
  const zeroLine = `<line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${pad.left + w}" y2="${zeroY.toFixed(1)}" stroke="#d1d5db" stroke-width="1"/>`;

  // Price axis labels
  const pLo = Math.round(minP);
  const pHi = Math.round(maxP);
  const axisLabels = `<text x="${pad.left}" y="${height - 3}" font-size="8" fill="#9ca3af">${pLo}</text><text x="${width - pad.right}" y="${height - 3}" font-size="8" fill="#9ca3af" text-anchor="end">${pHi}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="${greenPath}" fill="#bbf7d0" opacity="0.6"/>
    <path d="${redPath}" fill="#fecaca" opacity="0.6"/>
    ${zeroLine}
    ${beLines}
    ${cpLine}
    <polyline points="${linePoints}" fill="none" stroke="#374151" stroke-width="1.5"/>
    ${mpLabel}
    ${mlLabel}
    ${axisLabels}
  </svg>`;
}
