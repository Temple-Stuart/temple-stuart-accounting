import type {
  ConvergenceInput,
  InfoEdgeResult,
  AnalystConsensusTrace,
  InsiderActivityTrace,
  EarningsMomentumTrace,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== ANALYST CONSENSUS SUB-SCORE (40%) =====

function scoreAnalystConsensus(input: ConvergenceInput): AnalystConsensusTrace {
  const recs = input.finnhubRecommendations;

  if (recs.length === 0) {
    return {
      score: 50,
      weight: 0.40,
      inputs: { periods_available: 0 },
      formula: 'No analyst recommendation data → default 50',
      notes: 'No Finnhub recommendation data available',
      sub_scores: { buy_sell_ratio_score: 50, strong_conviction_score: 50, coverage_score: 50 },
      raw_counts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, total: 0 },
    };
  }

  const latest = recs[0]; // Most recent period
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;

  if (total === 0) {
    return {
      score: 50,
      weight: 0.40,
      inputs: { periods_available: recs.length, total_analysts: 0 },
      formula: 'Zero analyst coverage → default 50',
      notes: 'Latest period has 0 analysts',
      sub_scores: { buy_sell_ratio_score: 50, strong_conviction_score: 50, coverage_score: 50 },
      raw_counts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, total: 0 },
    };
  }

  // Buy/Sell ratio score: bullish consensus = higher score
  const bullish = latest.strongBuy + latest.buy;
  const bearish = latest.sell + latest.strongSell;
  const bullishPct = bullish / total;
  // Map: 100% bullish = 85, 50% = 50, 0% = 15
  const buySellScore = clamp(15 + bullishPct * 70, 0, 100);

  // Strong conviction score: high proportion of strong ratings = clearer signal
  const strongPct = (latest.strongBuy + latest.strongSell) / total;
  // Higher conviction = more informative (both directions)
  // Strong buy heavy = bullish, strong sell heavy = bearish
  let strongConvictionScore = 50;
  if (latest.strongBuy > latest.strongSell) {
    strongConvictionScore = clamp(50 + (latest.strongBuy / total) * 60, 50, 85);
  } else if (latest.strongSell > latest.strongBuy) {
    strongConvictionScore = clamp(50 - (latest.strongSell / total) * 60, 15, 50);
  }

  // Coverage score: more analysts = more reliable signal
  let coverageScore = 50;
  if (total >= 30) coverageScore = 80;
  else if (total >= 20) coverageScore = 70;
  else if (total >= 10) coverageScore = 60;
  else if (total >= 5) coverageScore = 50;
  else coverageScore = 35;

  // Weighted: buy_sell 50%, conviction 30%, coverage 20%
  const score = round(0.50 * buySellScore + 0.30 * strongConvictionScore + 0.20 * coverageScore, 1);

  const formula = `0.50×BuySell(${round(buySellScore)}) + 0.30×Conviction(${round(strongConvictionScore)}) + 0.20×Coverage(${round(coverageScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.40,
    inputs: {
      periods_available: recs.length,
      latest_period: latest.period,
      total_analysts: total,
      bullish_pct: round(bullishPct * 100, 1),
      bearish_count: bearish,
      strong_conviction_pct: round(strongPct * 100, 1),
    },
    formula,
    notes: `${latest.strongBuy} StrongBuy, ${latest.buy} Buy, ${latest.hold} Hold, ${latest.sell} Sell, ${latest.strongSell} StrongSell (${total} analysts)`,
    sub_scores: {
      buy_sell_ratio_score: round(buySellScore),
      strong_conviction_score: round(strongConvictionScore),
      coverage_score: round(coverageScore),
    },
    raw_counts: {
      strongBuy: latest.strongBuy,
      buy: latest.buy,
      hold: latest.hold,
      sell: latest.sell,
      strongSell: latest.strongSell,
      total,
    },
  };
}

// ===== INSIDER ACTIVITY SUB-SCORE (30%) =====

function scoreInsiderActivity(input: ConvergenceInput): InsiderActivityTrace {
  const sentiment = input.finnhubInsiderSentiment;

  if (sentiment.length === 0) {
    return {
      score: 50,
      weight: 0.30,
      inputs: { months_available: 0 },
      formula: 'No insider sentiment data → default 50',
      notes: 'No Finnhub insider sentiment data (may be premium endpoint)',
      sub_scores: { mspr_score: 50, trend_score: 50 },
      insider_detail: {
        months_available: 0,
        latest_mspr: null,
        avg_mspr_3m: null,
        net_direction: 'UNKNOWN',
      },
    };
  }

  // Sort by most recent first (year desc, month desc)
  const sorted = [...sentiment].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const latestMspr = sorted[0].mspr;

  // Average MSPR over last 3 months
  const recent3 = sorted.slice(0, 3);
  const avgMspr3m = recent3.length > 0
    ? round(recent3.reduce((s, r) => s + r.mspr, 0) / recent3.length, 4)
    : null;

  // MSPR (Monthly Share Purchase Ratio): >0 = net buying, <0 = net selling
  // Range is typically -100 to +100
  let msprScore = 50;
  if (latestMspr > 20) msprScore = 80;       // Strong insider buying
  else if (latestMspr > 5) msprScore = 65;   // Moderate buying
  else if (latestMspr > -5) msprScore = 50;  // Neutral
  else if (latestMspr > -20) msprScore = 35; // Moderate selling
  else msprScore = 20;                         // Heavy selling

  // Trend score: is insider sentiment improving or deteriorating?
  let trendScore = 50;
  let netDirection = 'NEUTRAL';
  if (sorted.length >= 3) {
    const recentAvg = (sorted[0].mspr + sorted[1].mspr) / 2;
    const olderAvg = sorted.length >= 4
      ? (sorted[2].mspr + sorted[3].mspr) / 2
      : sorted[2].mspr;

    if (recentAvg > olderAvg + 5) {
      trendScore = 70;
      netDirection = 'IMPROVING';
    } else if (recentAvg < olderAvg - 5) {
      trendScore = 30;
      netDirection = 'DETERIORATING';
    } else {
      trendScore = 50;
      netDirection = 'STABLE';
    }
  } else if (latestMspr > 5) {
    netDirection = 'NET_BUYING';
    trendScore = 60;
  } else if (latestMspr < -5) {
    netDirection = 'NET_SELLING';
    trendScore = 40;
  }

  // Weighted: MSPR 60%, trend 40%
  const score = round(0.60 * msprScore + 0.40 * trendScore, 1);

  const formula = `0.60×MSPR(${round(msprScore)}) + 0.40×Trend(${round(trendScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      months_available: sorted.length,
      latest_mspr: latestMspr,
      avg_mspr_3m: avgMspr3m,
    },
    formula,
    notes: `Latest MSPR: ${latestMspr}, 3mo avg: ${avgMspr3m ?? 'N/A'}, direction: ${netDirection}`,
    sub_scores: {
      mspr_score: round(msprScore),
      trend_score: round(trendScore),
    },
    insider_detail: {
      months_available: sorted.length,
      latest_mspr: latestMspr,
      avg_mspr_3m: avgMspr3m,
      net_direction: netDirection,
    },
  };
}

// ===== EARNINGS MOMENTUM SUB-SCORE (30%) =====

function scoreEarningsMomentum(input: ConvergenceInput): EarningsMomentumTrace {
  const earnings = input.finnhubEarnings;

  if (earnings.length === 0) {
    return {
      score: 50,
      weight: 0.30,
      inputs: { quarters_available: 0 },
      formula: 'No earnings data → default 50',
      notes: 'No Finnhub earnings history available',
      sub_scores: { beat_streak_score: 50, surprise_magnitude_score: 50, consistency_score: 50 },
      momentum_detail: {
        last_4_surprises: [],
        consecutive_beats: 0,
        consecutive_misses: 0,
        avg_surprise_pct: null,
        direction: 'UNKNOWN',
      },
    };
  }

  // Take last 4 quarters max
  const recent = earnings.slice(0, 4);
  const surprises = recent.map(e => e.surprisePercent);

  // Beat streak
  let consecutiveBeats = 0;
  let consecutiveMisses = 0;
  for (const e of recent) {
    if (e.surprisePercent > 0) {
      if (consecutiveMisses === 0) consecutiveBeats++;
      else break;
    } else if (e.surprisePercent < 0) {
      if (consecutiveBeats === 0) consecutiveMisses++;
      else break;
    } else {
      break;
    }
  }

  // Beat streak score: longer streaks = stronger momentum
  let beatStreakScore = 50;
  if (consecutiveBeats >= 4) beatStreakScore = 85;
  else if (consecutiveBeats >= 3) beatStreakScore = 75;
  else if (consecutiveBeats >= 2) beatStreakScore = 65;
  else if (consecutiveBeats >= 1) beatStreakScore = 55;
  else if (consecutiveMisses >= 3) beatStreakScore = 20;
  else if (consecutiveMisses >= 2) beatStreakScore = 30;
  else if (consecutiveMisses >= 1) beatStreakScore = 40;

  // Surprise magnitude: average surprise % → larger positive = stronger bullish signal
  const avgSurprise = surprises.length > 0
    ? round(surprises.reduce((a, b) => a + b, 0) / surprises.length, 2)
    : null;

  let surpriseMagnitudeScore = 50;
  if (avgSurprise !== null) {
    if (avgSurprise > 10) surpriseMagnitudeScore = 85;
    else if (avgSurprise > 5) surpriseMagnitudeScore = 70;
    else if (avgSurprise > 1) surpriseMagnitudeScore = 60;
    else if (avgSurprise > -1) surpriseMagnitudeScore = 50;
    else if (avgSurprise > -5) surpriseMagnitudeScore = 35;
    else surpriseMagnitudeScore = 20;
  }

  // Consistency: are surprises in the same direction?
  const positiveSurprises = surprises.filter(s => s > 0).length;
  const negativeSurprises = surprises.filter(s => s < 0).length;
  let consistencyScore = 50;
  if (surprises.length > 0) {
    const maxSameDir = Math.max(positiveSurprises, negativeSurprises);
    const consistencyPct = maxSameDir / surprises.length;
    // All same direction = 80+, mixed = 50
    consistencyScore = clamp(50 + (consistencyPct - 0.5) * 60, 20, 85);
    // Boost if consistent + positive
    if (positiveSurprises === surprises.length) consistencyScore = clamp(consistencyScore + 10, 0, 90);
    // Penalize if consistent + negative
    if (negativeSurprises === surprises.length) consistencyScore = clamp(consistencyScore - 20, 10, 100);
  }

  // Direction
  let direction = 'NEUTRAL';
  if (consecutiveBeats >= 2 && (avgSurprise ?? 0) > 2) direction = 'BULLISH_MOMENTUM';
  else if (consecutiveBeats >= 1 && (avgSurprise ?? 0) > 0) direction = 'POSITIVE';
  else if (consecutiveMisses >= 2 && (avgSurprise ?? 0) < -2) direction = 'BEARISH_MOMENTUM';
  else if (consecutiveMisses >= 1 && (avgSurprise ?? 0) < 0) direction = 'NEGATIVE';

  // Weighted: streak 40%, magnitude 35%, consistency 25%
  const score = round(
    0.40 * beatStreakScore + 0.35 * surpriseMagnitudeScore + 0.25 * consistencyScore, 1,
  );

  const formula = `0.40×Streak(${round(beatStreakScore)}) + 0.35×Magnitude(${round(surpriseMagnitudeScore)}) + 0.25×Consistency(${round(consistencyScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      quarters_available: recent.length,
      consecutive_beats: consecutiveBeats,
      consecutive_misses: consecutiveMisses,
    },
    formula,
    notes: `${consecutiveBeats} consecutive beats, avg surprise: ${avgSurprise ?? 'N/A'}%, direction: ${direction}`,
    sub_scores: {
      beat_streak_score: round(beatStreakScore),
      surprise_magnitude_score: round(surpriseMagnitudeScore),
      consistency_score: round(consistencyScore),
    },
    momentum_detail: {
      last_4_surprises: surprises,
      consecutive_beats: consecutiveBeats,
      consecutive_misses: consecutiveMisses,
      avg_surprise_pct: avgSurprise,
      direction,
    },
  };
}

// ===== MAIN INFO EDGE SCORER =====

export function scoreInfoEdge(input: ConvergenceInput): InfoEdgeResult {
  const analystConsensus = scoreAnalystConsensus(input);
  const insiderActivity = scoreInsiderActivity(input);
  const earningsMomentum = scoreEarningsMomentum(input);

  const score = round(
    analystConsensus.weight * analystConsensus.score +
    insiderActivity.weight * insiderActivity.score +
    earningsMomentum.weight * earningsMomentum.score,
    1,
  );

  return {
    score,
    breakdown: {
      analyst_consensus: analystConsensus,
      insider_activity: insiderActivity,
      earnings_momentum: earningsMomentum,
    },
  };
}
