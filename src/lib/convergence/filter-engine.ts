/**
 * Client-side filter engine for scanner results.
 * Applies institutional 3-tier filters to already-fetched data.
 *
 * Data availability notes:
 * - Open interest: NOT on client-side trade cards (only in StrikeData during server build).
 *   We use has_wide_spread as a proxy for bad liquidity at the strike level.
 * - Underlying volume: NOT directly on client cards. Skipped; logged below.
 * - Bid-ask spread: has_wide_spread boolean is the closest proxy on the client.
 * - Liquidity rating: available via key_stats.liquidity_rating
 * - IV/HV: available via key_stats.iv30 and key_stats.hv30
 * - IV Rank: available via key_stats.iv_rank
 */

import type { ScannerFilters } from './filter-types';
import { isCreditStrategy, DEFAULT_FILTERS } from './filter-types';
import type {
  VolEdgeResult,
  QualityGateResult,
  RegimeResult,
  InfoEdgeResult,
  TradeCardSetup,
  TradeCardWhy,
  TradeCardKeyStats,
  TradeCardData,
} from './types';

export interface TickerDetail {
  symbol: string;
  pipeline_runtime_ms: number;
  scores: {
    vol_edge: VolEdgeResult;
    quality: QualityGateResult;
    regime: RegimeResult;
    info_edge: InfoEdgeResult;
    composite: {
      score: number;
      direction: string;
      convergence_gate: string;
      categories_above_50: number;
      category_scores: { vol_edge: number; quality: number; regime: number; info_edge: number };
    };
  };
  trade_cards?: TradeCardData[];
  data_gaps: string[];
  _chain_stats?: Record<string, unknown>;
  _fetch_errors?: Record<string, string>;
  _rejection_reasons?: { strategy: string; reason: string; gate: string; details?: { value: number; threshold: number; spreadWidth?: number } }[];
}

// ── Filter result ───────────────────────────────────────────────────

export interface FilteredResult {
  result: TickerDetail;
  reasons: string[];
}

export interface FilterOutput {
  passed: TickerDetail[];
  filtered: FilteredResult[];
  totalStrategies: number;
  passedStrategies: number;
}

// ── Main filter function ────────────────────────────────────────────

interface SocialSentimentData {
  score: number;
  magnitude: number;
  postCount: number;
  error?: string;
}

export function applyFilters(
  results: TickerDetail[],
  filters: ScannerFilters,
  sentimentMap?: Record<string, SocialSentimentData>,
): FilterOutput {
  const passed: TickerDetail[] = [];
  const filtered: FilteredResult[] = [];
  let totalStrategies = 0;
  let passedStrategies = 0;

  for (const result of results) {
    const cards = result.trade_cards ?? [];
    if (cards.length === 0) {
      // No strategies — pass through as-is (no cards to filter)
      passed.push(result);
      continue;
    }

    // Ticker-level: social sentiment filter
    if (filters.edge.minSentiment > -100 && sentimentMap) {
      const s = sentimentMap[result.symbol];
      if (s && !s.error && s.postCount > 0) {
        const minScore = filters.edge.minSentiment / 100;
        if (s.score < minScore) {
          filtered.push({
            result,
            reasons: [`Social sentiment ${s.score.toFixed(2)} below min ${minScore.toFixed(1)}`],
          });
          continue;
        }
      }
    }

    totalStrategies += cards.length;
    const survivingCards: TradeCardData[] = [];
    const tickerReasons: string[] = [];

    for (const card of cards) {
      const reasons = filterCard(card, result, filters);
      if (reasons.length === 0) {
        survivingCards.push(card);
      } else {
        tickerReasons.push(`${card.setup.strategy_name}: ${reasons.join('; ')}`);
      }
    }

    passedStrategies += survivingCards.length;

    if (survivingCards.length > 0) {
      passed.push({ ...result, trade_cards: survivingCards });
    } else {
      filtered.push({ result, reasons: tickerReasons });
    }
  }

  return { passed, filtered, totalStrategies, passedStrategies };
}

// ── Per-card filter ─────────────────────────────────────────────────

function filterCard(
  card: TradeCardData,
  ticker: TickerDetail,
  filters: ScannerFilters,
): string[] {
  const reasons: string[] = [];
  const s = card.setup;
  const ks = card.key_stats;

  // ── TIER 1: Liquidity Gates ───────────────────────────────────────

  // OI: not available per-strike on client. Use has_wide_spread as proxy.
  // When maxBidAskSpreadPct is tight (< 10), wide-spread cards are rejected.
  if (s.has_wide_spread && filters.liquidity.maxBidAskSpreadPct < 10) {
    reasons.push(`Wide bid-ask spread (theo pricing)`);
  }

  // Underlying volume: not available on client-side cards.
  // Skipped — pre-filter on server already removes very low volume names.

  // Liquidity rating
  if (ks.liquidity_rating != null && ks.liquidity_rating < filters.liquidity.minLiquidityRating) {
    reasons.push(`Liquidity ${ks.liquidity_rating}/5 below min ${filters.liquidity.minLiquidityRating}`);
  }

  // ── TIER 2: Risk Profile ──────────────────────────────────────────

  // Risk type
  if (filters.risk.riskType === 'DEFINED_ONLY' && s.is_unlimited_risk) {
    reasons.push('Unlimited risk excluded');
  }

  // Direction
  if (filters.risk.direction !== 'ALL') {
    const dir = ticker.scores.composite.direction.toUpperCase();
    if (dir !== filters.risk.direction) {
      reasons.push(`Direction ${dir} does not match ${filters.risk.direction}`);
    }
  }

  // Premium stance
  if (filters.risk.premiumStance !== 'BOTH') {
    const isCredit = isCreditStrategy(s.strategy_name);
    if (filters.risk.premiumStance === 'SELL' && !isCredit) {
      reasons.push('Debit strategy excluded (sell premium only)');
    }
    if (filters.risk.premiumStance === 'BUY' && isCredit) {
      reasons.push('Credit strategy excluded (buy premium only)');
    }
  }

  // Strategy filter
  if (filters.risk.strategies.length > 0 && !filters.risk.strategies.includes(s.strategy_name)) {
    reasons.push(`Strategy "${s.strategy_name}" not in selected list`);
  }

  // DTE range
  if (s.dte < filters.risk.minDte) {
    reasons.push(`DTE ${s.dte} below min ${filters.risk.minDte}`);
  }
  if (s.dte > filters.risk.maxDte) {
    reasons.push(`DTE ${s.dte} above max ${filters.risk.maxDte}`);
  }

  // Spread width filter
  if (s.legs && s.legs.length >= 2) {
    const strikes = s.legs.map(l => l.strike).sort((a, b) => a - b);
    // For spreads/IC: width = difference between first two strikes
    const spreadWidth = Math.round((strikes[1] - strikes[0]) * 100) / 100;
    if (spreadWidth > 0) {
      if (spreadWidth < filters.risk.minSpreadWidth) {
        reasons.push(`Spread $${spreadWidth} below min $${filters.risk.minSpreadWidth}`);
      }
      if (spreadWidth > filters.risk.maxSpreadWidth) {
        reasons.push(`Spread $${spreadWidth} above max $${filters.risk.maxSpreadWidth}`);
      }
    }
  }

  // ── TIER 3: Edge Metrics ──────────────────────────────────────────

  // Min PoP
  if (s.probability_of_profit != null) {
    const popPct = s.probability_of_profit * 100;
    if (popPct < filters.edge.minPop) {
      reasons.push(`Est. PoP ${popPct.toFixed(0)}% below min ${filters.edge.minPop}%`);
    }
  }

  // Min EV
  if (s.ev < filters.edge.minEv) {
    reasons.push(`Est. EV $${Math.round(s.ev)} below min $${filters.edge.minEv}`);
  }

  // Min EV/Risk (stored as integer /100 in the slider)
  const minEvPerRiskRatio = filters.edge.minEvPerRisk / 100;
  if (s.ev_per_risk < minEvPerRiskRatio) {
    reasons.push(`EV/Risk ${s.ev_per_risk.toFixed(3)} below min ${minEvPerRiskRatio.toFixed(2)}`);
  }

  // Vol Edge
  if (filters.edge.volEdge !== 'ANY' && ks.iv30 != null && ks.hv30 != null && ks.hv30 > 0) {
    const ratio = ks.iv30 / ks.hv30;
    if (filters.edge.volEdge === 'IV_ABOVE_HV' && ratio <= 1.0) {
      reasons.push(`IV (${ks.iv30.toFixed(1)}%) not above HV (${ks.hv30.toFixed(1)}%)`);
    }
    if (filters.edge.volEdge === 'IV_BELOW_HV' && ratio >= 1.0) {
      reasons.push(`IV (${ks.iv30.toFixed(1)}%) not below HV (${ks.hv30.toFixed(1)}%)`);
    }
  }

  // Min IV Rank
  if (filters.edge.minIvRank > 0 && ks.iv_rank != null) {
    // iv_rank can be 0-1 scale or 0-100 depending on source; normalize
    const ivRankPct = ks.iv_rank <= 1 ? ks.iv_rank * 100 : ks.iv_rank;
    if (ivRankPct < filters.edge.minIvRank) {
      reasons.push(`IV Rank ${ivRankPct.toFixed(0)}% below min ${filters.edge.minIvRank}%`);
    }
  }

  return reasons;
}

// ── Human-readable active filter summary ────────────────────────────

export function describeActiveFilters(filters: ScannerFilters): string[] {
  const d = DEFAULT_FILTERS as ScannerFilters;
  const parts: string[] = [];

  if (filters.liquidity.minOpenInterest !== d.liquidity.minOpenInterest)
    parts.push(`Min OI \u2265 ${filters.liquidity.minOpenInterest}`);
  if (filters.liquidity.maxBidAskSpreadPct !== d.liquidity.maxBidAskSpreadPct)
    parts.push(`Max Spread \u2264 ${filters.liquidity.maxBidAskSpreadPct}%`);
  if (filters.liquidity.minUnderlyingVolume !== d.liquidity.minUnderlyingVolume) {
    const v = filters.liquidity.minUnderlyingVolume;
    parts.push(`Min Vol \u2265 ${v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`}`);
  }
  if (filters.liquidity.minLiquidityRating !== d.liquidity.minLiquidityRating)
    parts.push(`Liquidity \u2265 ${filters.liquidity.minLiquidityRating}\u2605`);

  if (filters.risk.riskType !== d.risk.riskType)
    parts.push(filters.risk.riskType === 'DEFINED_ONLY' ? 'Defined risk only' : 'Including unlimited');
  if (filters.risk.direction !== d.risk.direction)
    parts.push(`${filters.risk.direction} only`);
  if (filters.risk.premiumStance !== d.risk.premiumStance)
    parts.push(filters.risk.premiumStance === 'SELL' ? 'Sell premium' : 'Buy premium');
  if (filters.risk.strategies.length > 0)
    parts.push(`${filters.risk.strategies.length} strategies selected`);
  if (filters.risk.minDte !== d.risk.minDte || filters.risk.maxDte !== d.risk.maxDte)
    parts.push(`DTE ${filters.risk.minDte}-${filters.risk.maxDte}`);
  if (filters.risk.minSpreadWidth !== d.risk.minSpreadWidth || filters.risk.maxSpreadWidth !== d.risk.maxSpreadWidth)
    parts.push(`Width $${filters.risk.minSpreadWidth}-$${filters.risk.maxSpreadWidth}`);

  if (filters.edge.minPop !== d.edge.minPop)
    parts.push(`Min PoP \u2265 ${filters.edge.minPop}%`);
  if (filters.edge.minEv !== d.edge.minEv)
    parts.push(`Min EV \u2265 $${filters.edge.minEv}`);
  if (filters.edge.minEvPerRisk !== d.edge.minEvPerRisk)
    parts.push(`Min EV/Risk \u2265 ${(filters.edge.minEvPerRisk / 100).toFixed(2)}`);
  if (filters.edge.volEdge !== d.edge.volEdge)
    parts.push(filters.edge.volEdge === 'IV_ABOVE_HV' ? 'IV > HV only' : 'IV < HV only');
  if (filters.edge.minIvRank !== d.edge.minIvRank)
    parts.push(`Min IVR \u2265 ${filters.edge.minIvRank}%`);
  if (filters.edge.minSentiment !== d.edge.minSentiment)
    parts.push(`Min Sentiment \u2265 ${(filters.edge.minSentiment / 100).toFixed(1)}`);

  return parts;
}
