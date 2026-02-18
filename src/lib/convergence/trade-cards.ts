// Trade Card Generator — wraps StrategyCard + scoring into unified TradeCard
// Purely transforms existing data; no API calls.

import type { FullScoringResult } from './composite';
import type {
  ConvergenceInput,
  TradeCard,
  TradeCardSetup,
  TradeCardWhy,
  TradeCardKeyStats,
} from './types';
import type { StrategyCard } from '@/lib/strategy-builder';

// ===== LETTER GRADE =====

function letterGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ===== PLAIN ENGLISH SIGNALS =====

function formatPlainEnglish(scoring: FullScoringResult, input: ConvergenceInput): string[] {
  const signals: string[] = [];

  // --- Vol Edge signals ---
  const ve = scoring.vol_edge;
  const ivp = input.ttScanner?.ivPercentile ?? null;
  const ivRank = input.ttScanner?.ivRank ?? null;

  if (ivp !== null) {
    const pct = ivp <= 1 ? Math.round(ivp * 100) : Math.round(ivp);
    if (pct > 70) {
      signals.push(`Options are expensive right now — IV percentile is ${pct}%, meaning premiums are higher than ${pct}% of the past year. Good for selling.`);
    } else if (pct > 50) {
      signals.push(`Options are moderately priced — IV percentile at ${pct}%. Premiums are above average but not extreme.`);
    } else if (pct < 25) {
      signals.push(`Options are cheap — IV percentile at ${pct}%. Premiums are compressed, which can favor buying strategies.`);
    }
  }

  const ivHvSpread = input.ttScanner?.ivHvSpread ?? null;
  const iv30 = input.ttScanner?.iv30 ?? null;
  const hv30 = input.ttScanner?.hv30 ?? null;
  if (iv30 !== null && hv30 !== null && hv30 > 0) {
    const ratio = iv30 / hv30;
    if (ratio > 1.3) {
      signals.push(`The market is pricing in ${ratio.toFixed(1)}x more movement than actually happens — implied vol (${iv30.toFixed(1)}%) is well above realized vol (${hv30.toFixed(1)}%). Edge for sellers.`);
    } else if (ratio < 0.85) {
      signals.push(`Unusual: the market underestimates this stock's actual movement. Realized vol (${hv30.toFixed(1)}%) exceeds implied (${iv30.toFixed(1)}%).`);
    }
  }

  // Term structure shape
  const termShape = ve.breakdown.term_structure.shape;
  if (termShape === 'BACKWARDATION' || termShape === 'STEEP_BACKWARDATION') {
    signals.push('Near-term IV is higher than long-term — the market is pricing in a short-term event or catalyst.');
  } else if (termShape === 'CONTANGO' || termShape === 'STEEP_CONTANGO') {
    signals.push('IV term structure is normal (contango) — time decay works in your favor at standard DTE.');
  }

  // --- Quality signals ---
  const q = scoring.quality;
  if (q.score >= 70) {
    signals.push(`Strong fundamentals — quality score of ${q.score.toFixed(0)}/100. This company passes key safety and profitability checks.`);
  } else if (q.score < 40) {
    signals.push(`Weaker fundamentals — quality score of ${q.score.toFixed(0)}/100. Extra caution warranted on position sizing.`);
  }

  // Earnings proximity
  const dte_to_earnings = input.ttScanner?.daysTillEarnings ?? null;
  if (dte_to_earnings !== null && dte_to_earnings > 0 && dte_to_earnings <= 14) {
    signals.push(`Earnings in ${dte_to_earnings} days — expect higher IV and potential for large moves around the report.`);
  }

  // --- Info Edge signals ---
  const ie = scoring.info_edge;

  // Analyst consensus
  const analystTrace = ie.breakdown.analyst_consensus;
  const totalAnalysts = analystTrace.raw_counts.total;
  if (totalAnalysts > 0) {
    const buyPct = Math.round(((analystTrace.raw_counts.strongBuy + analystTrace.raw_counts.buy) / totalAnalysts) * 100);
    if (buyPct >= 70) {
      signals.push(`Wall Street is bullish — ${buyPct}% of ${totalAnalysts} analysts rate this a Buy or Strong Buy.`);
    } else if (buyPct <= 30) {
      signals.push(`Wall Street is cautious — only ${buyPct}% of ${totalAnalysts} analysts are bullish.`);
    }
  }

  // Insider activity
  const insiderTrace = ie.breakdown.insider_activity;
  const insiderDir = insiderTrace.insider_detail.net_direction;
  if (insiderDir === 'BULLISH' && insiderTrace.insider_detail.latest_mspr !== null) {
    signals.push('Insiders have been net buyers recently — they\'re putting their own money behind the stock.');
  } else if (insiderDir === 'BEARISH' && insiderTrace.insider_detail.latest_mspr !== null) {
    signals.push('Insiders have been net sellers recently — worth noting, though routine selling is common.');
  }

  // Earnings momentum
  const emTrace = ie.breakdown.earnings_momentum;
  const beats = emTrace.momentum_detail.consecutive_beats;
  if (beats >= 3) {
    signals.push(`${beats}-quarter earnings beat streak — the company keeps surprising to the upside.`);
  }

  // Flow signal
  const flowTrace = ie.breakdown.flow_signal;
  if (flowTrace.flow_detail.data_available) {
    const pcr = flowTrace.inputs.put_call_ratio as number | null;
    if (pcr !== null && pcr < 0.5) {
      signals.push('Options flow is call-heavy — traders are positioning for upside.');
    } else if (pcr !== null && pcr > 1.5) {
      signals.push('Options flow is put-heavy — traders are hedging or betting on downside.');
    }
  }

  // News sentiment
  const newsTrace = ie.breakdown.news_sentiment;
  if (newsTrace.news_detail.data_available && newsTrace.news_detail.buzz_ratio !== null) {
    const buzz = newsTrace.news_detail.buzz_ratio;
    if (buzz > 2.0) {
      signals.push(`High news buzz — ${buzz.toFixed(1)}x normal coverage volume. Something is driving attention.`);
    }
    const sentMom = newsTrace.news_detail.sentiment_momentum ?? 0;
    if (sentMom > 30) {
      signals.push('News sentiment has turned notably more positive in the past week vs. prior month.');
    } else if (sentMom < -30) {
      signals.push('News sentiment has shifted negative recently compared to the prior month.');
    }
  }

  // --- Regime context ---
  const regime = scoring.regime;
  const dom = regime.breakdown.dominant_regime;
  if (dom === 'goldilocks') {
    signals.push('Macro backdrop is favorable (Goldilocks regime) — growth is solid and inflation is contained.');
  } else if (dom === 'stagflation') {
    signals.push('Caution: stagflationary macro environment — growth is slowing while inflation persists.');
  } else if (dom === 'deflation') {
    signals.push('Deflationary macro signal — consider long vol or defensive positions.');
  }

  // Cap at top 5 signals (most impactful)
  return signals.slice(0, 5);
}

// ===== RISK FLAGS =====

function computeRiskFlags(
  card: StrategyCard,
  scoring: FullScoringResult,
  input: ConvergenceInput,
): string[] {
  const flags: string[] = [];

  if (card.isUnlimited) {
    flags.push('UNLIMITED RISK — naked short legs. Requires margin and active management.');
  }

  if (card.hasWideSpread) {
    flags.push('WIDE BID-ASK SPREAD — fill may be worse than midpoint. Use limit orders.');
  }

  const dte_to_earnings = input.ttScanner?.daysTillEarnings ?? null;
  if (dte_to_earnings !== null && dte_to_earnings > 0 && dte_to_earnings <= card.dte) {
    flags.push(`EARNINGS WITHIN DTE — report in ${dte_to_earnings} days, trade expires in ${card.dte}. Expect IV crush post-earnings.`);
  }

  const liq = input.ttScanner?.liquidityRating ?? null;
  if (liq !== null && liq < 2) {
    flags.push(`LOW LIQUIDITY RATING (${liq}/5) — wider spreads and harder fills expected.`);
  }

  if (card.pop !== null && card.pop < 0.4) {
    flags.push(`LOW PROBABILITY — PoP is ${(card.pop * 100).toFixed(0)}%. This is a speculative trade.`);
  }

  const vixOverlay = scoring.regime.breakdown.vix_overlay;
  if (vixOverlay.vix !== null && vixOverlay.vix > 25) {
    flags.push(`ELEVATED VIX (${vixOverlay.vix.toFixed(1)}) — market stress is above normal. Position size accordingly.`);
  }

  const above50 = scoring.composite.categories_above_50;
  if (above50 < 3) {
    flags.push(`WEAK CONVERGENCE (${above50}/4 categories above 50) — signals are not well-aligned.`);
  }

  // Insider selling pressure
  const insiderTrace = scoring.info_edge.breakdown.insider_activity;
  const avgMspr3m = insiderTrace.insider_detail.avg_mspr_3m;
  if (avgMspr3m !== null && avgMspr3m < -20) {
    flags.push(`INSIDER SELLING (MSPR ${avgMspr3m.toFixed(1)}) — insiders have been net sellers recently. 3-month trend is bearish.`);
  }

  return flags;
}

// ===== REGIME CONTEXT =====

function regimeContext(scoring: FullScoringResult): string {
  const r = scoring.regime.breakdown;
  const dom = r.dominant_regime;
  const prob = r.regime_probabilities[dom as keyof typeof r.regime_probabilities] ?? 0;
  const vix = r.vix_overlay.vix;
  const best = r.best_strategy;

  let ctx = `Dominant macro regime: ${dom} (${(prob * 100).toFixed(0)}% probability).`;
  if (vix !== null) {
    ctx += ` VIX at ${vix.toFixed(1)}.`;
  }
  ctx += ` Regime favors: ${best}.`;

  const spy = r.spy_correlation_modifier;
  if (spy.corr_spy !== null) {
    ctx += ` SPY correlation: ${spy.corr_spy.toFixed(2)} (modifier: ${spy.multiplier.toFixed(2)}x).`;
  }

  return ctx;
}

// ===== ANALYST CONSENSUS LABEL =====

function analystConsensusLabel(scoring: FullScoringResult): string | null {
  const counts = scoring.info_edge.breakdown.analyst_consensus.raw_counts;
  if (counts.total === 0) return null;
  const buyPct = (counts.strongBuy + counts.buy) / counts.total;
  const sellPct = (counts.strongSell + counts.sell) / counts.total;
  if (buyPct >= 0.7) return 'Strong Buy';
  if (buyPct >= 0.5) return 'Buy';
  if (sellPct >= 0.5) return 'Sell';
  if (sellPct >= 0.7) return 'Strong Sell';
  return 'Hold';
}

// ===== KEY STATS BUILDER =====

function buildKeyStats(input: ConvergenceInput, scoring: FullScoringResult): TradeCardKeyStats {
  const tt = input.ttScanner;
  const news = input.newsSentiment;

  return {
    iv_rank: tt?.ivRank ?? null,
    iv_percentile: tt?.ivPercentile ?? null,
    iv30: tt?.iv30 ?? null,
    hv30: tt?.hv30 ?? null,
    iv_hv_spread: tt?.ivHvSpread ?? null,
    earnings_date: tt?.earningsDate ?? null,
    days_to_earnings: tt?.daysTillEarnings ?? null,
    market_cap: tt?.marketCap ?? null,
    sector: tt?.sector ?? null,
    beta: tt?.beta ?? null,
    spy_correlation: tt?.corrSpy ?? null,
    pe_ratio: tt?.peRatio ?? null,
    dividend_yield: tt?.dividendYield ?? null,
    liquidity_rating: tt?.liquidityRating ?? null,
    lendability: tt?.lendability ?? null,
    buzz_ratio: news?.buzz_ratio ?? null,
    sentiment_momentum: news?.sentiment_momentum ?? null,
    analyst_consensus: analystConsensusLabel(scoring),
  };
}

// ===== MAIN EXPORT =====

export function generateTradeCards(
  strategyCards: StrategyCard[],
  scoring: FullScoringResult,
  input: ConvergenceInput,
): TradeCard[] {
  const now = new Date().toISOString();
  const plainEnglish = formatPlainEnglish(scoring, input);
  const regimeCtx = regimeContext(scoring);
  const keyStats = buildKeyStats(input, scoring);

  return strategyCards.map((card) => {
    const setup: TradeCardSetup = {
      strategy_name: card.name,
      legs: card.legs.map(l => ({
        type: l.type,
        side: l.side,
        strike: l.strike,
        price: l.price,
      })),
      expiration_date: card.expiration,
      dte: card.dte,
      net_credit: card.netCredit,
      net_debit: card.netDebit,
      max_profit: card.maxProfit,
      max_loss: card.maxLoss,
      breakevens: card.breakevens,
      probability_of_profit: card.pop,
      hv_pop: card.hvPop,
      risk_reward_ratio: card.riskReward,
      greeks: {
        delta: card.netDelta,
        gamma: card.netGamma,
        theta: card.netTheta,
        vega: card.netVega,
        theta_per_day: card.thetaPerDay,
      },
      ev: card.ev,
      ev_per_risk: card.evPerRisk,
      has_wide_spread: card.hasWideSpread,
      is_unlimited_risk: card.isUnlimited,
    };

    const why: TradeCardWhy = {
      composite_score: scoring.composite.score,
      letter_grade: letterGrade(scoring.composite.score),
      direction: scoring.composite.direction,
      convergence_gate: scoring.composite.convergence_gate,
      category_scores: { ...scoring.composite.category_scores },
      plain_english_signals: plainEnglish,
      regime_context: regimeCtx,
      risk_flags: computeRiskFlags(card, scoring, input),
    };

    return {
      symbol: input.symbol,
      generated_at: now,
      label: card.label,
      setup,
      why,
      key_stats: keyStats,
    };
  });
}
