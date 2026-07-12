/**
 * TRADE-SHOWCASE-REAL-COMPONENTS: the declared example payload the REAL
 * cockpit components mount on (ScannerResultsTable + TickerChapter).
 *
 * WHAT IS ENGINE-REAL vs DECLARED EXAMPLE:
 *  • TickerDetail.scores — ENGINE-REAL: the complete gate result objects
 *    (VolEdgeResult/QualityGateResult/RegimeResult/InfoEdgeResult with every
 *    breakdown and trace) come from the real pure scoreAll() on the declared
 *    fictional inputs (TRADE_SHOWCASE_FULL, tradeShowcaseRows.ts). Composite
 *    score/direction/gate strings are the engine's own values verbatim.
 *  • The GLOBEX Iron Condor card, the chain-fetch table, and the strategy-
 *    scoring counts — DECLARED EXAMPLE values (chain data needs a live options
 *    feed), internally coherent and Example-tagged at the mount site.
 *
 * IRON CONDOR RECONCILIATION (GLOBEX @ ~$96.80, 30 DTE — the engine's own
 * suggested DTE for GLOBEX):
 *   legs  SELL PUT 90 @ 1.15 · BUY PUT 85 @ 0.55 · SELL CALL 105 @ 1.05 · BUY CALL 110 @ 0.45
 *   COLLECT $120   = ((1.15 − 0.55) + (1.05 − 0.45)) × 100
 *   MAX LOSS $380  = ($5 wing width − $1.20 credit) × 100
 *   MAX PROFIT $120 = the credit
 *   R:R 0.32       = 120 / 380
 *   B/E $88.80 / $106.20 = 90 − 1.20 and 105 + 1.20
 *   EV +$10        = 0.78 × 120 − 0.22 × 380 (two-outcome sanity math; the
 *                    live card's EV uses the engine's three-outcome model) —
 *                    EV > 0 as it must be: strategy Gate A rejects EV ≤ 0
 *   EV/RISK 0.026  = 10 / 380
 *   KELLY          → computed BY THE REAL COMPONENT (quarter-Kelly from
 *                    hv_pop 0.79 and 120/380, ConvergenceIntelligence.tsx:704-708)
 *   Greeks: near-zero delta (condor), +theta ($3.10/day), −vega — the correct
 *   signs for a defined-risk premium-selling structure.
 *   Strategy-scoring counts reconcile: 14 built = 6 (Gate A) + 3 (Gate B) +
 *   2 (Gate C) failures + 3 passed; winner Iron Condor at 0.052.
 *
 * TRIPWIRE: this file declares data and calls nothing external — zero fetches,
 * zero paid calls; the engine is only CALLED (via the fixture), never modified.
 */

import type { TickerDetail } from '@/lib/convergence/filter-engine';
import type { TradeCardData } from '@/lib/convergence/types';
import { TRADE_SHOWCASE_FULL } from '@/components/home/tradeShowcaseRows';

// ── the GLOBEX Iron Condor card (declared example, reconciled above) ─────────

const GLOBEX_CONDOR: TradeCardData = {
  symbol: 'GLOBEX',
  label: 'Iron Condor · 30 DTE',
  setup: {
    strategy_name: 'Iron Condor',
    legs: [
      { type: 'put', side: 'sell', strike: 90, price: 1.15 },
      { type: 'put', side: 'buy', strike: 85, price: 0.55 },
      { type: 'call', side: 'sell', strike: 105, price: 1.05 },
      { type: 'call', side: 'buy', strike: 110, price: 0.45 },
    ],
    expiration_date: '2026-08-11',
    dte: 30,
    net_credit: 1.2,
    net_debit: null,
    max_profit: 120,
    max_loss: 380,
    breakevens: [88.8, 106.2],
    probability_of_profit: 0.78,
    pop_method: 'breakeven_d2',
    hv_pop: 0.79,
    risk_reward_ratio: 0.32,
    greeks: { delta: -0.02, gamma: -0.01, theta: 0.031, vega: -0.09, theta_per_day: 3.1 },
    ev: 10,
    ev_per_risk: 0.026,
    has_wide_spread: false,
    is_unlimited_risk: false,
  },
  why: {
    composite_score: TRADE_SHOWCASE_FULL.GLOBEX.composite.score,
    letter_grade: 'C+',
    direction: TRADE_SHOWCASE_FULL.GLOBEX.composite.direction,
    convergence_gate: TRADE_SHOWCASE_FULL.GLOBEX.composite.convergence_gate,
    category_scores: TRADE_SHOWCASE_FULL.GLOBEX.composite.category_scores,
    plain_english_signals: [
      'All four gates cleared 50 — a marginal but unanimous signal (example)',
      'Options modestly rich vs realized movement — premium seller collects the gap (example)',
      'Direction NEUTRAL — a range-bound structure fits better than a directional bet (example)',
    ],
    regime_context: TRADE_SHOWCASE_FULL.GLOBEX.composite.regime_brake.declaration,
    risk_flags: [],
  },
  key_stats: {
    // Values match the declared GLOBEX fixture inputs (tradeShowcaseRows.ts).
    current_price: 96.8,
    iv_rank: 52,
    iv_percentile: 55,
    iv30: 30,
    hv30: 26,
    iv_hv_spread: 4,
    vol_cone: { hv10: 24, hv20: 25, hv30: 26, hv60: 27, hv90: 27, current_iv: 30, candles_used: 130, note: 'example vol cone (declared demo candles)' },
    forward_vol: null,
    earnings_date: null,
    days_to_earnings: 52,
    earnings_pattern: null,
    market_cap: 22_000_000_000,
    sector: 'Industrials',
    beta: 0.9,
    spy_correlation: 0.7,
    pe_ratio: 17,
    dividend_yield: 2.1,
    liquidity_rating: 3,
    lendability: 'Easy To Borrow',
    borrow_rate: 0.3,
    buzz_ratio: null,
    sentiment_momentum: null,
    analyst_consensus: 'Hold',
  },
};

// ── TickerDetail rows — gate results ENGINE-REAL, cards/chain declared ───────

function detailFor(sym: 'ACME' | 'GLOBEX' | 'INITECH', cards?: TradeCardData[]): TickerDetail {
  const full = TRADE_SHOWCASE_FULL[sym];
  return {
    symbol: sym,
    pipeline_runtime_ms: 94_000, // example runtime, matches the funnel footer
    scores: {
      vol_edge: full.vol_edge,
      quality: full.quality,
      regime: full.regime,
      info_edge: full.info_edge,
      composite: {
        // Non-null for all three demo tickers (all four gates scored).
        score: full.composite.score as number,
        direction: full.composite.direction,
        convergence_gate: full.composite.convergence_gate,
        categories_above_50: full.composite.categories_above_50,
        category_scores: full.composite.category_scores as {
          vol_edge: number; quality: number; regime: number; info_edge: number;
        },
      },
    },
    trade_cards: cards,
    data_gaps: [],
  };
}

/** Table rows: GLOBEX carries the full condor card; ACME and INITECH are the
 *  honest no-card cases (strategy gates / convergence said no). */
export const SHOWCASE_RESULTS: TickerDetail[] = [
  detailFor('GLOBEX', [GLOBEX_CONDOR]),
  detailFor('ACME'),
  detailFor('INITECH'),
];

/** Per-ticker strategy rejections — the real rejection_reasons shape
 *  (filter-engine.ts TickerDetail._rejection_reasons / SRT rejectionMap). */
export const SHOWCASE_REJECTIONS: Record<string, { strategy: string; reason: string; gate: string; details?: { value: number; threshold: number } }[]> = {
  ACME: [
    { strategy: 'Bull Put Spread', reason: 'net credit below the minimum', gate: 'Gate C (min credit)', details: { value: 0.27, threshold: 0.3 } },
    { strategy: 'Iron Condor', reason: 'expected value not positive', gate: 'Gate A (EV ≤ 0)', details: { value: -4, threshold: 0 } },
  ],
  INITECH: [
    { strategy: 'ALL', reason: TRADE_SHOWCASE_FULL.INITECH.composite.convergence_gate, gate: 'Convergence gate' },
  ],
};

// ── the pipelineProgress slice TickerChapter reads (steps K, N, P) ───────────
// Field names match exactly what the real component reads
// (ConvergenceIntelligence.tsx:225-368): step_k.data.rankings,
// step_n.data.tickers, step_p.data.tickers.

const rank = (sym: 'ACME' | 'GLOBEX' | 'INITECH', selection: string) => {
  const c = TRADE_SHOWCASE_FULL[sym].composite;
  return {
    symbol: sym,
    composite: c.score,
    vol_edge: c.category_scores.vol_edge,
    quality: c.category_scores.quality,
    regime: c.category_scores.regime,
    info_edge: c.category_scores.info_edge,
    sector: sym === 'GLOBEX' ? 'Industrials' : 'Technology',
    direction: c.direction,
    selection_status: selection,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SHOWCASE_PROGRESS: Record<string, any> = {
  step_k: {
    data: {
      // Ranked by the engine's own composites (62.5 > 52 > 36.3).
      rankings: [
        rank('ACME', '✓ Selected — ranked #1 (example scan)'),
        rank('GLOBEX', '✓ Selected — ranked #2 (example scan)'),
        rank('INITECH', '✗ Not selected — NO TRADE (convergence too weak)'),
      ],
    },
  },
  step_n: {
    data: {
      tickers: [
        {
          symbol: 'GLOBEX',
          expirationsEvaluated: 3,
          winningExpiration: '2026-08-11',
          winningDte: 30,
          strikeCount: 48,
          priceSource: 'live_quotes',
          allExpirations: [
            { expiration: '2026-07-31', dte: 19, strikeCount: 42, strategiesBuilt: 12, bestScore: 0.041 },
            { expiration: '2026-08-11', dte: 30, strikeCount: 48, strategiesBuilt: 14, bestScore: 0.052 },
            { expiration: '2026-09-18', dte: 68, strikeCount: 36, strategiesBuilt: 11, bestScore: 0.038 },
          ],
        },
      ],
    },
  },
  step_p: {
    data: {
      tickers: [
        {
          symbol: 'GLOBEX',
          // 14 built = 6 + 3 + 2 failures + 3 passed (reconciles).
          strategiesBuilt: 14,
          gateAFailed: 6,
          gateBFailed: 3,
          gateCFailed: 2,
          strategiesPassed: 3,
          winner: 'Iron Condor',
          winnerScore: 0.052,
        },
      ],
    },
  },
};

export const SHOWCASE_DEEP_DIVE: TickerDetail = SHOWCASE_RESULTS[0];
