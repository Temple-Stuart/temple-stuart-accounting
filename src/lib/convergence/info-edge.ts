import type {
  ConvergenceInput,
  InfoEdgeResult,
  AnalystConsensusTrace,
  InsiderActivityTrace,
  EarningsMomentumTrace,
  FlowSignalTrace,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== ANALYST CONSENSUS SUB-SCORE (20%) =====

function scoreAnalystConsensus(input: ConvergenceInput): AnalystConsensusTrace {
  const recs = input.finnhubRecommendations;

  if (recs.length === 0) {
    return {
      score: 50,
      weight: 0.20,
      inputs: { periods_available: 0 },
      formula: 'No analyst recommendation data → default 50',
      notes: 'No Finnhub recommendation data available',
      sub_scores: { buy_sell_ratio_score: 50, strong_conviction_score: 50, coverage_score: 50 },
      raw_counts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, total: 0 },
    };
  }

  // Sort by period descending to ensure latest first
  const sorted = [...recs].sort((a, b) => b.period.localeCompare(a.period));

  const latest = sorted[0];
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;

  if (total === 0) {
    return {
      score: 50,
      weight: 0.20,
      inputs: { periods_available: sorted.length, total_analysts: 0 },
      formula: 'Zero analyst coverage → default 50',
      notes: 'Latest period has 0 analysts',
      sub_scores: { buy_sell_ratio_score: 50, strong_conviction_score: 50, coverage_score: 50 },
      raw_counts: { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, total: 0 },
    };
  }

  // Consensus score (35%): ratio of bullish to total analysts
  const bullish = latest.strongBuy + latest.buy;
  const bearish = latest.sell + latest.strongSell;
  const bullishPct = bullish / total;
  // Map: 100% bullish = 85, 50% = 50, 0% = 15
  const consensusScore = clamp(15 + bullishPct * 70, 0, 100);

  // Momentum score (65%): compare current vs previous period bullish count
  let momentumScore = 50;
  if (sorted.length >= 2) {
    const previous = sorted[1];
    const bullishCurrent = latest.strongBuy + latest.buy;
    const bullishPrevious = previous.strongBuy + previous.buy;
    if (bullishCurrent > bullishPrevious) momentumScore = 75;
    else if (bullishCurrent === bullishPrevious) momentumScore = 50;
    else momentumScore = 35;
  }

  // Coverage score: kept as trace field, not in weighted formula
  let coverageScore = 50;
  if (total >= 30) coverageScore = 80;
  else if (total >= 20) coverageScore = 70;
  else if (total >= 10) coverageScore = 60;
  else if (total >= 5) coverageScore = 50;
  else coverageScore = 35;

  // Weighted: consensus 35%, momentum 65%
  const score = round(0.35 * consensusScore + 0.65 * momentumScore, 1);

  const formula = `0.35×Consensus(${round(consensusScore)}) + 0.65×Momentum(${round(momentumScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.20,
    inputs: {
      periods_available: sorted.length,
      latest_period: latest.period,
      total_analysts: total,
      bullish_pct: round(bullishPct * 100, 1),
      bearish_count: bearish,
    },
    formula,
    notes: `${latest.strongBuy} StrongBuy, ${latest.buy} Buy, ${latest.hold} Hold, ${latest.sell} Sell, ${latest.strongSell} StrongSell (${total} analysts)`,
    sub_scores: {
      buy_sell_ratio_score: round(consensusScore),
      strong_conviction_score: round(momentumScore),
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

// ===== FLOW SIGNAL SUB-SCORE (20%) =====

/** Linear interpolation: map value in [inLow, inHigh] to [outLow, outHigh], clamped. */
function lerp(value: number, inLow: number, inHigh: number, outLow: number, outHigh: number): number {
  if (inHigh === inLow) return (outLow + outHigh) / 2;
  const t = (value - inLow) / (inHigh - inLow);
  return clamp(outLow + t * (outHigh - outLow), Math.min(outLow, outHigh), Math.max(outLow, outHigh));
}

function scorePutCallRatio(pcr: number): number {
  // PCR < 0.7 → 80 (bullish), 0.7-0.9 → 65, 0.9-1.1 → 50, 1.1-1.3 → 35, > 1.3 → 20
  if (pcr <= 0.7) return lerp(pcr, 0.3, 0.7, 90, 80);
  if (pcr <= 0.9) return lerp(pcr, 0.7, 0.9, 80, 65);
  if (pcr <= 1.1) return lerp(pcr, 0.9, 1.1, 65, 35);
  if (pcr <= 1.3) return lerp(pcr, 1.1, 1.3, 35, 20);
  return lerp(pcr, 1.3, 1.6, 20, 10);
}

function scoreVolumeBias(bias: number): number {
  // bias > 50 → 80+, 20-50 → 65, -20 to 20 → 50, -50 to -20 → 35, < -50 → 20
  if (bias >= 50) return lerp(bias, 50, 100, 80, 90);
  if (bias >= 20) return lerp(bias, 20, 50, 65, 80);
  if (bias >= -20) return lerp(bias, -20, 20, 35, 65);
  if (bias >= -50) return lerp(bias, -50, -20, 20, 35);
  return lerp(bias, -100, -50, 10, 20);
}

function scoreUnusualActivity(ratio: number): number {
  // ratio > 0.3 → 80 (lots of new positioning = conviction)
  // 0.15-0.3 → 65, 0.05-0.15 → 50, < 0.05 → 35 (quiet)
  if (ratio >= 0.3) return lerp(ratio, 0.3, 0.5, 80, 90);
  if (ratio >= 0.15) return lerp(ratio, 0.15, 0.3, 65, 80);
  if (ratio >= 0.05) return lerp(ratio, 0.05, 0.15, 50, 65);
  return lerp(ratio, 0.0, 0.05, 35, 50);
}

function scoreFlowSignal(input: ConvergenceInput): FlowSignalTrace {
  const flow = input.optionsFlow;

  if (!flow) {
    return {
      score: 50,
      weight: 0.20,
      inputs: { data_available: false },
      formula: 'No options flow data → neutral 50',
      notes: 'Finnhub option chain fetch failed or returned no data.',
      sub_scores: {
        put_call_ratio_score: 50,
        unusual_activity_score: 50,
        volume_bias_score: 50,
      },
      flow_detail: {
        data_available: false,
        note: 'Finnhub option chain fetch failed or returned no data.',
      },
    };
  }

  // Score each sub-component
  const pcrScore = flow.put_call_ratio !== null
    ? round(scorePutCallRatio(flow.put_call_ratio))
    : 50;

  const biasScore = flow.volume_bias !== null
    ? round(scoreVolumeBias(flow.volume_bias))
    : 50;

  const activityScore = flow.unusual_activity_ratio !== null
    ? round(scoreUnusualActivity(flow.unusual_activity_ratio))
    : 50;

  // Weighted: PCR 40%, volume bias 35%, unusual activity 25%
  const score = round(0.40 * pcrScore + 0.35 * biasScore + 0.25 * activityScore, 1);

  const formula = `0.40×PCR(${pcrScore}) + 0.35×Bias(${biasScore}) + 0.25×Activity(${activityScore}) = ${score}`;

  const notes = [
    `PCR=${flow.put_call_ratio ?? 'N/A'}`,
    `bias=${flow.volume_bias ?? 'N/A'}`,
    `unusual=${flow.unusual_activity_ratio ?? 'N/A'}`,
    `${flow.strikes_analyzed} strikes across ${flow.expirations_analyzed} exps`,
    `call_vol=${flow.total_call_volume} put_vol=${flow.total_put_volume}`,
    `${flow.high_activity_strikes} high-activity strikes`,
  ].join(', ');

  return {
    score: round(score),
    weight: 0.20,
    inputs: {
      data_available: true,
      put_call_ratio: flow.put_call_ratio,
      volume_bias: flow.volume_bias,
      unusual_activity_ratio: flow.unusual_activity_ratio,
      total_call_volume: flow.total_call_volume,
      total_put_volume: flow.total_put_volume,
      total_call_oi: flow.total_call_oi,
      total_put_oi: flow.total_put_oi,
      strikes_analyzed: flow.strikes_analyzed,
      high_activity_strikes: flow.high_activity_strikes,
      expirations_analyzed: flow.expirations_analyzed,
    },
    formula,
    notes,
    sub_scores: {
      put_call_ratio_score: pcrScore,
      unusual_activity_score: activityScore,
      volume_bias_score: biasScore,
    },
    flow_detail: {
      data_available: true,
      note: `Finnhub option chain: ${flow.expirations_analyzed} expirations, ${flow.strikes_analyzed} strikes analyzed.`,
    },
  };
}

// ===== MAIN INFO EDGE SCORER =====

export function scoreInfoEdge(input: ConvergenceInput): InfoEdgeResult {
  const analystConsensus = scoreAnalystConsensus(input);
  const insiderActivity = scoreInsiderActivity(input);
  const earningsMomentum = scoreEarningsMomentum(input);
  const flowSignal = scoreFlowSignal(input);

  const score = round(
    analystConsensus.weight * analystConsensus.score +
    insiderActivity.weight * insiderActivity.score +
    earningsMomentum.weight * earningsMomentum.score +
    flowSignal.weight * flowSignal.score,
    1,
  );

  return {
    score,
    breakdown: {
      analyst_consensus: analystConsensus,
      insider_activity: insiderActivity,
      earnings_momentum: earningsMomentum,
      flow_signal: flowSignal,
    },
  };
}
