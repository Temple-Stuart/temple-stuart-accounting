import type {
  ConvergenceInput,
  QualityGateResult,
  LiquidityTrace,
  FundamentalsTrace,
  EarningsQualityTrace,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== LIQUIDITY SUB-SCORE (40%) =====

function scoreLiquidity(input: ConvergenceInput): LiquidityTrace {
  const tt = input.ttScanner;
  const candles = input.candles;

  // TT liquidity rating (0-5 scale from TT, 5 is best)
  const liqRating = tt?.liquidityRating ?? null;
  let liquidityRatingScore = 50;
  if (liqRating !== null) {
    // TT uses ~1-5 scale. Map: 5→95, 4→80, 3→60, 2→40, 1→20
    liquidityRatingScore = clamp(liqRating * 20 - 5, 0, 100);
  }

  // Market cap score
  const marketCap = tt?.marketCap ?? null;
  let marketCapScore = 50;
  if (marketCap !== null) {
    // Mega cap (>200B)=90, Large (>10B)=75, Mid (>2B)=60, Small (>300M)=40, Micro=20
    if (marketCap > 200_000_000_000) marketCapScore = 90;
    else if (marketCap > 10_000_000_000) marketCapScore = 75;
    else if (marketCap > 2_000_000_000) marketCapScore = 60;
    else if (marketCap > 300_000_000) marketCapScore = 40;
    else marketCapScore = 20;
  }

  // Volume score from candles
  let volumeScore = 50;
  let avgVol20d: number | null = null;
  if (candles.length >= 20) {
    const vols = candles.slice(-20).map(c => c.volume);
    avgVol20d = round(vols.reduce((a, b) => a + b, 0) / vols.length);
    // >50M = 90, >10M = 75, >1M = 60, >100K = 40, less = 20
    if (avgVol20d > 50_000_000) volumeScore = 90;
    else if (avgVol20d > 10_000_000) volumeScore = 75;
    else if (avgVol20d > 1_000_000) volumeScore = 60;
    else if (avgVol20d > 100_000) volumeScore = 40;
    else volumeScore = 20;
  }

  // Lendability score (HTB risk)
  const lendability = tt?.lendability ?? null;
  let lendabilityScore = 60; // Default: assume easy to borrow
  if (lendability !== null) {
    const lend = lendability.toLowerCase();
    if (lend === 'easy to borrow' || lend === 'easy') lendabilityScore = 80;
    else if (lend === 'locate required' || lend === 'hard to borrow') lendabilityScore = 30;
    else lendabilityScore = 55;
  }

  // Weighted: liquidity_rating 35%, market_cap 25%, volume 25%, lendability 15%
  const score = round(
    0.35 * liquidityRatingScore + 0.25 * marketCapScore + 0.25 * volumeScore + 0.15 * lendabilityScore,
    1,
  );

  const formula = `0.35×LiqRating(${round(liquidityRatingScore)}) + 0.25×MktCap(${round(marketCapScore)}) + 0.25×Volume(${round(volumeScore)}) + 0.15×Lend(${round(lendabilityScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.40,
    inputs: {
      liquidity_rating: liqRating,
      market_cap: marketCap,
      avg_volume_20d: avgVol20d,
      lendability: lendability,
      borrow_rate: tt?.borrowRate ?? null,
    },
    formula,
    notes: `Liquidity rating: ${liqRating ?? 'N/A'}, Mkt cap: ${marketCap ? '$' + (marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}`,
    sub_scores: {
      liquidity_rating_score: round(liquidityRatingScore),
      market_cap_score: round(marketCapScore),
      volume_score: round(volumeScore),
      lendability_score: round(lendabilityScore),
    },
  };
}

// ===== FUNDAMENTALS SUB-SCORE (30%) =====

function scoreFundamentals(input: ConvergenceInput): FundamentalsTrace {
  const tt = input.ttScanner;
  const fh = input.finnhubFundamentals;
  const metric = fh?.metric ?? {};

  // P/E score: moderate P/E (10-25) = highest, extreme = lower
  const pe = tt?.peRatio ?? (typeof metric['peNormalizedAnnual'] === 'number' ? metric['peNormalizedAnnual'] : null);
  let peScore = 50;
  if (pe !== null && typeof pe === 'number') {
    if (pe < 0) peScore = 20;           // Negative earnings
    else if (pe < 5) peScore = 35;      // Suspiciously cheap
    else if (pe < 10) peScore = 60;     // Value
    else if (pe <= 25) peScore = 75;    // Fair value
    else if (pe <= 40) peScore = 55;    // Growth premium
    else if (pe <= 60) peScore = 40;    // Expensive
    else peScore = 25;                  // Extremely expensive
  }

  // Dividend yield score: having a dividend = stability indicator
  const divYield = tt?.dividendYield ?? (typeof metric['dividendYieldIndicatedAnnual'] === 'number' ? metric['dividendYieldIndicatedAnnual'] : null);
  let dividendScore = 50;
  if (divYield !== null && typeof divYield === 'number') {
    if (divYield > 6) dividendScore = 40;     // Unsustainably high
    else if (divYield > 2) dividendScore = 75; // Healthy yield
    else if (divYield > 0.5) dividendScore = 65;
    else if (divYield > 0) dividendScore = 55;
    else dividendScore = 45;                   // No dividend (not necessarily bad for options)
  }

  // Gross margin score (from Finnhub)
  const grossMargin = typeof metric['grossMarginTTM'] === 'number' ? metric['grossMarginTTM'] as number : null;
  let marginScore = 50;
  if (grossMargin !== null) {
    if (grossMargin > 60) marginScore = 85;
    else if (grossMargin > 40) marginScore = 70;
    else if (grossMargin > 20) marginScore = 55;
    else if (grossMargin > 0) marginScore = 35;
    else marginScore = 20;
  }

  // FCF yield (from Finnhub)
  const fcfShareTTM = typeof metric['freeCashFlowPerShareTTM'] === 'number' ? metric['freeCashFlowPerShareTTM'] as number : null;
  const currentPrice = typeof metric['marketCapitalization'] === 'number' && typeof metric['shareOutstanding'] === 'number' && (metric['shareOutstanding'] as number) > 0
    ? (metric['marketCapitalization'] as number) * 1e6 / ((metric['shareOutstanding'] as number) * 1e6)
    : null;
  let fcfScore = 50;
  if (fcfShareTTM !== null && currentPrice !== null && currentPrice > 0) {
    const fcfYield = (fcfShareTTM / currentPrice) * 100;
    if (fcfYield > 8) fcfScore = 85;
    else if (fcfYield > 4) fcfScore = 70;
    else if (fcfYield > 1) fcfScore = 55;
    else if (fcfYield > 0) fcfScore = 40;
    else fcfScore = 25; // Negative FCF
  }

  // Partial Piotroski F-Score (computable signals from available data)
  const roe = typeof metric['roeTTM'] === 'number' ? metric['roeTTM'] as number : null;
  const roa = typeof metric['roaTTM'] === 'number' ? metric['roaTTM'] as number : null;
  const cfoa = typeof metric['currentRatioQuarterly'] === 'number' ? metric['currentRatioQuarterly'] as number : null;

  const piotroski: Record<string, boolean | null> = {
    positive_net_income: roe !== null ? roe > 0 : null,
    positive_roa: roa !== null ? roa > 0 : null,
    positive_fcf: fcfShareTTM !== null ? fcfShareTTM > 0 : null,
    fcf_exceeds_net_income: null, // Requires net income comparison
    current_ratio_improving: cfoa !== null ? cfoa > 1 : null, // Proxy: current ratio > 1
    gross_margin_expanding: null, // Requires YoY trend
    asset_turnover_improving: null, // Requires YoY trend
    no_equity_issuance: null, // Requires shares outstanding trend
    leverage_decreasing: null, // Requires YoY debt comparison
  };

  const computedSignals = Object.values(piotroski).filter(v => v !== null);
  const passedSignals = computedSignals.filter(v => v === true).length;

  // Weighted: PE 30%, dividend 20%, margin 25%, FCF 25%
  const score = round(0.30 * peScore + 0.20 * dividendScore + 0.25 * marginScore + 0.25 * fcfScore, 1);

  const formula = `0.30×PE(${round(peScore)}) + 0.20×Div(${round(dividendScore)}) + 0.25×Margin(${round(marginScore)}) + 0.25×FCF(${round(fcfScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      pe_ratio: pe as number | null,
      dividend_yield: divYield as number | null,
      gross_margin_ttm: grossMargin,
      fcf_per_share_ttm: fcfShareTTM,
      roe_ttm: roe,
      roa_ttm: roa,
    },
    formula,
    notes: `PE=${pe ?? 'N/A'}, Div=${divYield ?? 'N/A'}%, Margin=${grossMargin ?? 'N/A'}%, FCF/sh=${fcfShareTTM ?? 'N/A'}`,
    sub_scores: {
      pe_score: round(peScore),
      dividend_score: round(dividendScore),
      margin_score: round(marginScore),
      fcf_score: round(fcfScore),
    },
    piotroski: {
      available_signals: computedSignals.length,
      total_signals: 9,
      computable: piotroski,
      note: `${passedSignals}/${computedSignals.length} signals passing (${9 - computedSignals.length} require YoY trend data)`,
    },
  };
}

// ===== EARNINGS QUALITY SUB-SCORE (30%) =====

function scoreEarningsQuality(input: ConvergenceInput): EarningsQualityTrace {
  const earnings = input.finnhubEarnings;
  const tt = input.ttScanner;
  const daysTillEarnings = tt?.daysTillEarnings ?? null;

  if (earnings.length === 0) {
    return {
      score: 50,
      weight: 0.30,
      inputs: { quarters_available: 0, days_till_earnings: daysTillEarnings },
      formula: 'No earnings data available → default 50',
      notes: 'No Finnhub earnings history',
      sub_scores: { surprise_consistency: 50, days_to_earnings_score: 50, beat_rate: 0 },
      earnings_detail: {
        total_quarters: 0, beats: 0, misses: 0, in_line: 0,
        avg_surprise_pct: null, streak: 'UNKNOWN',
      },
    };
  }

  // Classify each quarter
  let beats = 0;
  let misses = 0;
  let inLine = 0;
  const surprises: number[] = [];

  for (const e of earnings) {
    const surp = e.surprisePercent;
    surprises.push(surp);
    if (surp > 2) beats++;
    else if (surp < -2) misses++;
    else inLine++;
  }

  const totalQ = earnings.length;
  const beatRate = round(beats / totalQ * 100, 1);

  // Average surprise %
  const avgSurprise = surprises.length > 0
    ? round(surprises.reduce((a, b) => a + b, 0) / surprises.length, 2)
    : null;

  // Streak detection (most recent first)
  let consecutiveBeats = 0;
  let consecutiveMisses = 0;
  for (const e of earnings) {
    if (e.surprisePercent > 2) {
      if (consecutiveMisses === 0) consecutiveBeats++;
      else break;
    } else if (e.surprisePercent < -2) {
      if (consecutiveBeats === 0) consecutiveMisses++;
      else break;
    } else {
      break;
    }
  }

  let streak = 'MIXED';
  if (consecutiveBeats >= 4) streak = `${consecutiveBeats}Q BEAT STREAK`;
  else if (consecutiveBeats >= 2) streak = `${consecutiveBeats}Q BEATS`;
  else if (consecutiveMisses >= 2) streak = `${consecutiveMisses}Q MISS STREAK`;

  // Surprise consistency score: high beat rate + consistent beats = high score
  let surpriseConsistency = 50;
  if (totalQ > 0) {
    // Beat rate directly maps: 100% beats = 90, 75% = 72, 50% = 55, 25% = 38, 0% = 20
    surpriseConsistency = clamp(20 + beatRate * 0.7, 0, 100);
    // Bonus for streak
    if (consecutiveBeats >= 4) surpriseConsistency = Math.min(surpriseConsistency + 10, 100);
    // Penalty for miss streak
    if (consecutiveMisses >= 2) surpriseConsistency = Math.max(surpriseConsistency - 15, 0);
  }

  // Days to earnings score: for options traders, proximity matters
  let dteScore = 50;
  if (daysTillEarnings !== null) {
    if (daysTillEarnings < 0) dteScore = 60;      // Just passed → IV crush opportunity
    else if (daysTillEarnings <= 7) dteScore = 30; // Too close → binary risk
    else if (daysTillEarnings <= 14) dteScore = 45;
    else if (daysTillEarnings <= 30) dteScore = 55;
    else if (daysTillEarnings <= 45) dteScore = 65; // Sweet spot for premium selling
    else dteScore = 60;                             // Far away → less event risk
  }

  // Weighted: consistency 50%, DTE 30%, beat_rate_bonus 20%
  const beatRateScore = clamp(beatRate, 0, 100);
  const score = round(0.50 * surpriseConsistency + 0.30 * dteScore + 0.20 * beatRateScore, 1);

  const formula = `0.50×Consistency(${round(surpriseConsistency)}) + 0.30×DTE(${round(dteScore)}) + 0.20×BeatRate(${round(beatRateScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      quarters_available: totalQ,
      days_till_earnings: daysTillEarnings,
      earnings_date: tt?.earningsDate ?? null,
    },
    formula,
    notes: `${beats} beats, ${misses} misses, ${inLine} in-line out of ${totalQ}Q. Avg surprise: ${avgSurprise ?? 'N/A'}%`,
    sub_scores: {
      surprise_consistency: round(surpriseConsistency),
      days_to_earnings_score: round(dteScore),
      beat_rate: beatRate,
    },
    earnings_detail: {
      total_quarters: totalQ,
      beats,
      misses,
      in_line: inLine,
      avg_surprise_pct: avgSurprise,
      streak,
    },
  };
}

// ===== MAIN QUALITY GATE SCORER =====

export function scoreQualityGate(input: ConvergenceInput): QualityGateResult {
  const liquidity = scoreLiquidity(input);
  const fundamentals = scoreFundamentals(input);
  const earningsQuality = scoreEarningsQuality(input);

  const score = round(
    liquidity.weight * liquidity.score +
    fundamentals.weight * fundamentals.score +
    earningsQuality.weight * earningsQuality.score,
    1,
  );

  return {
    score,
    breakdown: {
      liquidity,
      fundamentals,
      earnings_quality: earningsQuality,
    },
  };
}
