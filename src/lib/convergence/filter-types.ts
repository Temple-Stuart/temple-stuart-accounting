/**
 * Institutional-grade scanner filter configuration.
 * Three tiers: Liquidity Gates → Risk Profile → Edge Metrics
 */

// ── TIER 1: Liquidity Gates (pass/fail) ─────────────────────────────

export interface LiquidityGates {
  minOpenInterest: number;      // per strike, default 100
  maxBidAskSpreadPct: number;   // % of mid price, default 10
  minUnderlyingVolume: number;  // daily shares, default 500000
  minLiquidityRating: number;   // TastyTrade 1-5 stars, default 2
}

// ── TIER 2: Risk Profile (user preference) ──────────────────────────

export type Direction = 'ALL' | 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type PremiumStance = 'SELL' | 'BUY' | 'BOTH';
export type RiskType = 'DEFINED_ONLY' | 'INCLUDE_UNLIMITED';

export interface RiskProfile {
  riskType: RiskType;
  direction: Direction;
  premiumStance: PremiumStance;
  strategies: string[];         // empty = all strategies allowed
  minDte: number;               // default 30
  maxDte: number;               // default 60
  minSpreadWidth: number;       // dollars, default 1
  maxSpreadWidth: number;       // dollars, default 10
}

// ── TIER 3: Edge Metrics (quantitative filters) ─────────────────────

export type VolEdge = 'IV_ABOVE_HV' | 'IV_BELOW_HV' | 'ANY';

export interface EdgeMetrics {
  minPop: number;               // 0-100, default 50
  minEv: number;                // dollars, default 0
  minEvPerRisk: number;         // ratio, default 0
  volEdge: VolEdge;
  minIvRank: number;            // 0-100, default 0
}

// ── Combined Filter State ───────────────────────────────────────────

export interface ScannerFilters {
  liquidity: LiquidityGates;
  risk: RiskProfile;
  edge: EdgeMetrics;
}

export const DEFAULT_FILTERS: ScannerFilters = {
  liquidity: {
    minOpenInterest: 100,
    maxBidAskSpreadPct: 10,
    minUnderlyingVolume: 500000,
    minLiquidityRating: 2,
  },
  risk: {
    riskType: 'DEFINED_ONLY',
    direction: 'ALL',
    premiumStance: 'BOTH',
    strategies: [],
    minDte: 30,
    maxDte: 60,
    minSpreadWidth: 1,
    maxSpreadWidth: 10,
  },
  edge: {
    minPop: 50,
    minEv: 0,
    minEvPerRisk: 0,
    volEdge: 'ANY',
    minIvRank: 0,
  },
};

/**
 * MODEL-02 STEP 5 — NO PHANTOMS. Exactly the strategies the scanner BUILDS:
 * one entry per `buildCard('<name>', …)` in strategy-builder.ts
 * generateStrategies (SELL: Iron Condor, Put Credit Spread, Short Strangle;
 * BUY: Long Straddle, Long Strangle, Debit Spread). Until 2026-09-16 this list
 * held 16 names — ten with no builder, selectable in every panel and never
 * produced (a selection of one of them returned zero cards with the reason
 * "not in selected list" on every real card). The ten are listed with a
 * reason each in gateCards.ts NOT_BUILT_STRATEGIES; the build (the phantom
 * law) holds this list equal to the builder's names and the panels to this
 * list. Set 2026-09-16.
 */
export const AVAILABLE_STRATEGIES: string[] = [
  'Iron Condor',
  'Put Credit Spread',
  'Short Strangle',
  'Long Straddle',
  'Long Strangle',
  'Debit Spread',
];
export const AVAILABLE_STRATEGIES_SET_ON = '2026-09-16';

/** Credit strategies — entry receives premium */
const CREDIT_STRATEGIES = new Set([
  'Iron Condor', 'Put Credit Spread', 'Call Credit Spread',
  'Short Strangle', 'Short Straddle', 'Jade Lizard',
]);

export function isCreditStrategy(name: string): boolean {
  return CREDIT_STRATEGIES.has(name);
}
