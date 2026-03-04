import type {
  ConvergenceInput,
  InfoEdgeResult,
  AnalystConsensusTrace,
  PriceTargetSignalTrace,
  UpgradeDowngradeSignalTrace,
  InsiderActivityTrace,
  EarningsMomentumTrace,
  FlowSignalTrace,
  NewsSentimentTrace,
  InstitutionalOwnershipTrace,
  FilingRecencyTrace,
  EarningsSurpriseSignal,
  DataConfidence,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// Bernard & Thomas (1989, 1990 JAR): SUE-relative thresholds — beat/miss
// classification should scale with the stock's own surprise variability.
// Threshold = max(1%, 0.5 × stdDev of historical surprise percentages).
// Falls back to ±2% with fewer than 3 quarters of history.
function computeSurpriseThreshold(surprises: number[]): number {
  if (surprises.length < 3) return 2.0; // Fallback: insufficient history
  const mean = surprises.reduce((a, b) => a + b, 0) / surprises.length;
  const variance = surprises.reduce((a, b) => a + (b - mean) ** 2, 0) / (surprises.length - 1);
  const stdDev = Math.sqrt(variance);
  return Math.max(1.0, 0.5 * stdDev);
}

// ===== ANALYST CONSENSUS SUB-SCORE =====
// Estimate revision momentum: EPS level, dispersion, revenue-EPS alignment, consensus breadth
// (Chan, Jegadeesh & Lakonishok 1996). Price targets and U/D events now scored independently.

function scoreAnalystConsensus(input: ConvergenceInput): AnalystConsensusTrace {
  const recs = input.finnhubRecommendations;
  const estimates = input.finnhubEstimates;
  const earnings = input.finnhubEarnings;

  // --- Extract latest recommendation counts ---
  const sorted = [...recs].sort((a, b) => b.period.localeCompare(a.period));
  const latest = sorted.length > 0 ? sorted[0] : null;
  const total = latest
    ? latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
    : 0;

  // --- Find next-quarter forward EPS estimate ---
  const today = new Date().toISOString().slice(0, 10);
  const futureEps = estimates?.epsEstimates
    .filter(e => e.period >= today)
    .sort((a, b) => a.period.localeCompare(b.period)) ?? [];
  const nextQEps = futureEps.length > 0 ? futureEps[0] : null;
  const forwardEps = nextQEps?.epsAvg ?? null;

  // --- Find trailing actual EPS (latest reported quarter) ---
  const trailingActualEps = earnings.length > 0 ? earnings[0].actual : null;

  // --- Find next-quarter forward revenue estimate ---
  const futureRev = estimates?.revenueEstimates
    .filter(e => e.period >= today)
    .sort((a, b) => a.period.localeCompare(b.period)) ?? [];
  const nextQRev = futureRev.length > 0 ? futureRev[0] : null;

  // ===== SUB-SCORE 1: Estimate Level (25%) =====
  // Chan, Jegadeesh & Lakonishok 1996: forward-vs-trailing EPS growth proxy
  let estimateLevelScore = 40; // penalty default
  let epsGrowthDirection: string | null = null;
  if (forwardEps !== null && trailingActualEps !== null && Math.abs(trailingActualEps) > 0.01) {
    const growth = (forwardEps - trailingActualEps) / Math.abs(trailingActualEps);
    epsGrowthDirection = growth > 0 ? 'UP' : growth < 0 ? 'DOWN' : 'FLAT';
    if (growth > 0.20) estimateLevelScore = 80;
    else if (growth > 0.10) estimateLevelScore = 70;
    else if (growth > 0) estimateLevelScore = 60;
    else if (growth > -0.10) estimateLevelScore = 45;
    else estimateLevelScore = 30;
  }

  // ===== SUB-SCORE 2: Estimate Dispersion (25%) =====
  // Diether, Malloy & Scherbina 2002: high disagreement predicts low returns
  let estimateDispersionScore = 40; // penalty default
  let epsDispersionPct: number | null = null;
  if (nextQEps && Math.abs(nextQEps.epsAvg) > 0.01) {
    epsDispersionPct = round(((nextQEps.epsHigh - nextQEps.epsLow) / Math.abs(nextQEps.epsAvg)) * 100, 2);
    if (epsDispersionPct < 5) estimateDispersionScore = 85;
    else if (epsDispersionPct < 10) estimateDispersionScore = 75;
    else if (epsDispersionPct < 20) estimateDispersionScore = 60;
    else if (epsDispersionPct < 35) estimateDispersionScore = 45;
    else if (epsDispersionPct < 50) estimateDispersionScore = 35;
    else estimateDispersionScore = 20;
  }

  // ===== SUB-SCORE 3: Revenue-EPS Alignment (15%) =====
  // Cross-validates earnings quality: both up = organic growth, mixed = fragile
  let revenueEpsAlignmentScore = 50; // neutral default
  let revenueGrowthDirection: string | null = null;
  if (nextQRev && nextQRev.revenueAvg > 0) {
    const pastRev = estimates?.revenueEstimates
      .filter(e => e.period < today)
      .sort((a, b) => b.period.localeCompare(a.period)) ?? [];
    const trailingRev = pastRev.length > 0 ? pastRev[0] : null;

    if (trailingRev && trailingRev.revenueAvg > 0) {
      revenueGrowthDirection = nextQRev.revenueAvg > trailingRev.revenueAvg ? 'UP' : 'DOWN';
    }

    if (epsGrowthDirection !== null && revenueGrowthDirection !== null) {
      if (epsGrowthDirection === 'UP' && revenueGrowthDirection === 'UP') revenueEpsAlignmentScore = 80;
      else if (epsGrowthDirection === 'DOWN' && revenueGrowthDirection === 'DOWN') revenueEpsAlignmentScore = 30;
      else revenueEpsAlignmentScore = 50;
    }
  }

  // ===== SUB-SCORE 4: Consensus Breadth (35%) =====
  // Buy/sell ratio (60%) + coverage depth (40%)
  let consensusBreadthScore = 40; // penalty default
  if (latest && total > 0) {
    const bullish = latest.strongBuy + latest.buy;
    const bullishPct = bullish / total;
    const ratioScore = clamp(15 + bullishPct * 70, 0, 100);

    const numAnalysts = Math.max(
      nextQEps?.numberAnalysts ?? 0,
      estimates?.priceTarget?.numberAnalysts ?? 0,
      total,
    );
    let coverageScore: number;
    if (numAnalysts >= 25) coverageScore = 80;
    else if (numAnalysts >= 15) coverageScore = 70;
    else if (numAnalysts >= 8) coverageScore = 60;
    else if (numAnalysts >= 3) coverageScore = 45;
    else coverageScore = 30;

    consensusBreadthScore = round(0.60 * ratioScore + 0.40 * coverageScore, 1);
  }

  // ===== Weighted combination =====
  // 0.25 EstLevel + 0.25 Dispersion + 0.15 RevEpsAlign + 0.35 ConsensusBreadth
  const score = round(
    0.25 * estimateLevelScore +
    0.25 * estimateDispersionScore +
    0.15 * revenueEpsAlignmentScore +
    0.35 * consensusBreadthScore,
    1,
  );

  const formula = `0.25×EstLevel(${round(estimateLevelScore)}) + 0.25×Dispersion(${round(estimateDispersionScore)}) + 0.15×RevEpsAlign(${round(revenueEpsAlignmentScore)}) + 0.35×Breadth(${round(consensusBreadthScore)}) = ${score}`;

  const notes = [
    `fwdEPS=${forwardEps ?? 'N/A'}`,
    `trailEPS=${trailingActualEps ?? 'N/A'}`,
    `dispersion=${epsDispersionPct ?? 'N/A'}%`,
    latest ? `${latest.strongBuy}SB/${latest.buy}B/${latest.hold}H/${latest.sell}S/${latest.strongSell}SS` : 'no recs',
  ].join(', ');

  return {
    score: round(score),
    weight: 0.15,
    inputs: {
      periods_available: sorted.length,
      latest_period: latest?.period ?? null,
      total_analysts: total,
      forward_eps: forwardEps,
      trailing_actual_eps: trailingActualEps,
      eps_dispersion_pct: epsDispersionPct,
    },
    formula,
    notes,
    sub_scores: {
      estimate_level_score: round(estimateLevelScore),
      estimate_dispersion_score: round(estimateDispersionScore),
      revenue_eps_alignment_score: round(revenueEpsAlignmentScore),
      consensus_breadth_score: round(consensusBreadthScore),
    },
    indicators: {
      forward_eps: forwardEps,
      trailing_actual_eps: trailingActualEps,
      eps_dispersion_pct: epsDispersionPct,
      revenue_growth_direction: revenueGrowthDirection,
      eps_growth_direction: epsGrowthDirection,
      number_analysts_estimates: nextQEps?.numberAnalysts ?? null,
      number_analysts_recommendations: total > 0 ? total : null,
    },
    raw_counts: {
      strongBuy: latest?.strongBuy ?? 0,
      buy: latest?.buy ?? 0,
      hold: latest?.hold ?? 0,
      sell: latest?.sell ?? 0,
      strongSell: latest?.strongSell ?? 0,
      total,
    },
  };
}

// ===== PRICE TARGET SIGNAL SUB-SCORE =====
// Da & Schaumburg (2011): ΔTPER — sector-neutralized change in implied return.
// Analysts average 22-28% optimism, so we score relative to peer group, not absolute.

function scorePriceTargetSignal(input: ConvergenceInput): PriceTargetSignalTrace {
  const estimates = input.finnhubEstimates;
  const pt = estimates?.priceTarget ?? null;
  const latestClose = input.candles.length > 0
    ? input.candles[input.candles.length - 1].close
    : null;

  // --- Compute raw implied return ---
  const ptMedian = pt?.targetMedian ?? null;
  let rawImpliedReturn: number | null = null;
  if (ptMedian !== null && latestClose !== null && latestClose > 0) {
    rawImpliedReturn = round(((ptMedian - latestClose) / latestClose) * 100, 2);
  }

  // --- Compute peer median implied return (ΔTPER) ---
  // Use peerStats if available for sector neutralization
  let peerMedianImpliedReturn: number | null = null;
  let deltaTper: number | null = null;

  const peerStats = input.peerStats;
  if (peerStats && rawImpliedReturn !== null) {
    // Look for price_target_implied_return or similar metric in peer stats
    // Find any peer group that has implied return data
    for (const [, groupData] of Object.entries(peerStats)) {
      const irMetric = groupData.metrics?.['price_target_implied_return'];
      if (irMetric && irMetric.mean !== undefined) {
        // Use peer group median (mean as proxy when sorted values unavailable)
        if (irMetric.sortedValues && irMetric.sortedValues.length > 0) {
          const mid = Math.floor(irMetric.sortedValues.length / 2);
          peerMedianImpliedReturn = irMetric.sortedValues.length % 2 === 0
            ? (irMetric.sortedValues[mid - 1] + irMetric.sortedValues[mid]) / 2
            : irMetric.sortedValues[mid];
        } else {
          peerMedianImpliedReturn = irMetric.mean;
        }
        peerMedianImpliedReturn = round(peerMedianImpliedReturn, 2);
        break;
      }
    }
  }

  if (rawImpliedReturn !== null && peerMedianImpliedReturn !== null) {
    deltaTper = round(rawImpliedReturn - peerMedianImpliedReturn, 2);
  }

  // --- Score: use ΔTPER if available, else use raw implied return as fallback ---
  let priceTargetScore = 40; // penalty default — no data
  const numAnalysts = pt?.numberAnalysts ?? 0;

  if (rawImpliedReturn !== null) {
    // Use the effective signal: ΔTPER when we have peer data, raw otherwise
    const signal = deltaTper ?? rawImpliedReturn;

    // Continuous mapping via lerp:
    // ΔTPER > +20 (or raw > +30): strongly above peers → 85
    // ΔTPER ~ 0 (or raw ~ +15): neutral vs peers → 55 (slight upward bias to account for analyst optimism)
    // ΔTPER < -20 (or raw < -5): well below peers → 20
    if (deltaTper !== null) {
      // Sector-neutralized: 0 = in line with peers
      if (deltaTper > 15) priceTargetScore = lerp(deltaTper, 15, 30, 75, 90);
      else if (deltaTper > 5) priceTargetScore = lerp(deltaTper, 5, 15, 60, 75);
      else if (deltaTper > -5) priceTargetScore = lerp(deltaTper, -5, 5, 45, 60);
      else if (deltaTper > -15) priceTargetScore = lerp(deltaTper, -15, -5, 30, 45);
      else priceTargetScore = lerp(deltaTper, -30, -15, 15, 30);
    } else {
      // Raw implied return: discount for analyst optimism bias (22-28%)
      if (rawImpliedReturn > 30) priceTargetScore = 80;
      else if (rawImpliedReturn > 15) priceTargetScore = lerp(rawImpliedReturn, 15, 30, 60, 80);
      else if (rawImpliedReturn > 5) priceTargetScore = lerp(rawImpliedReturn, 5, 15, 50, 60);
      else if (rawImpliedReturn > -5) priceTargetScore = lerp(rawImpliedReturn, -5, 5, 40, 50);
      else if (rawImpliedReturn > -15) priceTargetScore = lerp(rawImpliedReturn, -15, -5, 25, 40);
      else priceTargetScore = 20;
    }
    priceTargetScore = round(clamp(priceTargetScore, 0, 100));

    // Confidence discount for low coverage
    if (numAnalysts < 3) {
      priceTargetScore = round(50 + (priceTargetScore - 50) * 0.5); // shrink toward neutral
    }
  }

  const usedDeltaTper = deltaTper !== null;
  const formula = usedDeltaTper
    ? `ΔTPER(${deltaTper}) → ${priceTargetScore} [peer-neutralized, ${numAnalysts} analysts]`
    : `RawImplied(${rawImpliedReturn ?? 'N/A'}%) → ${priceTargetScore} [no peer data, ${numAnalysts} analysts]`;

  const notes = [
    `ptMedian=${ptMedian ?? 'N/A'}`,
    `close=${latestClose ?? 'N/A'}`,
    `rawReturn=${rawImpliedReturn ?? 'N/A'}%`,
    `peerMedian=${peerMedianImpliedReturn ?? 'N/A'}%`,
    `deltaTper=${deltaTper ?? 'N/A'}`,
    `analysts=${numAnalysts}`,
    usedDeltaTper ? 'sector_neutralized' : 'raw_fallback',
  ].join(', ');

  return {
    score: round(priceTargetScore),
    weight: 0.10,
    inputs: {
      raw_implied_return_pct: rawImpliedReturn,
      peer_median_implied_return_pct: peerMedianImpliedReturn,
      delta_tper: deltaTper,
      num_analysts: numAnalysts,
    },
    formula,
    notes,
    sub_scores: {
      price_target_score: round(priceTargetScore),
    },
    indicators: {
      raw_implied_return_pct: rawImpliedReturn,
      peer_median_implied_return_pct: peerMedianImpliedReturn,
      delta_tper: deltaTper,
      num_analysts: numAnalysts,
      price_target_median: ptMedian,
      price_target_mean: pt?.targetMean ?? null,
      price_target_high: pt?.targetHigh ?? null,
      price_target_low: pt?.targetLow ?? null,
      latest_close: latestClose,
    },
  };
}

// ===== UPGRADE/DOWNGRADE SIGNAL SUB-SCORE =====
// Womack (1996): downgrades drift -9.1% vs +2.4% for upgrades → asymmetric scoring.
// Time-decayed with different half-lives: upgrades 30d, downgrades 90d.

const POSITIVE_GRADES = ['buy', 'outperform', 'overweight', 'strong buy', 'positive', 'market outperform', 'sector outperform', 'accumulate', 'add'];
const NEGATIVE_GRADES = ['sell', 'underperform', 'underweight', 'strong sell', 'negative', 'market underperform', 'sector underperform', 'reduce'];

function isPositiveGrade(grade: string): boolean {
  return POSITIVE_GRADES.some(g => grade.toLowerCase().includes(g));
}

function isNegativeGrade(grade: string): boolean {
  return NEGATIVE_GRADES.some(g => grade.toLowerCase().includes(g));
}

function timeDecay(daysAgo: number, halfLifeDays: number): number {
  return Math.pow(0.5, daysAgo / halfLifeDays);
}

function scoreUpgradeDowngradeSignal(input: ConvergenceInput): UpgradeDowngradeSignalTrace {
  const estimates = input.finnhubEstimates;
  const allUd = estimates?.upgradeDowngrade ?? [];

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentUd = allUd.filter(ud => ud.gradeTime * 1000 >= ninetyDaysAgo);

  let upgradesCount = 0;
  let downgradesCount = 0;
  let initiationsCount = 0;
  let reiterationsCount = 0;
  let netMomentum = 0;

  for (const ud of recentUd) {
    const daysAgo = (Date.now() - ud.gradeTime * 1000) / (24 * 60 * 60 * 1000);
    const action = ud.action?.toLowerCase() ?? '';

    if (action === 'up' || action === 'upgrade') {
      upgradesCount++;
      // +1 base, half-life 30 days
      netMomentum += 1 * timeDecay(daysAgo, 30);
    } else if (action === 'down' || action === 'downgrade') {
      downgradesCount++;
      // -2 base (Womack asymmetry), half-life 90 days (3x longer persistence)
      netMomentum += -2 * timeDecay(daysAgo, 90);
    } else if (action === 'init' || action === 'initiated') {
      initiationsCount++;
      // Initiations: directional based on grade
      if (isPositiveGrade(ud.toGrade)) {
        netMomentum += 0.5 * timeDecay(daysAgo, 30);
      } else if (isNegativeGrade(ud.toGrade)) {
        netMomentum += -1.0 * timeDecay(daysAgo, 90);
      }
    } else if (action === 'reiterated' || action === 'main') {
      reiterationsCount++;
      if (isPositiveGrade(ud.toGrade)) {
        netMomentum += 0.3 * timeDecay(daysAgo, 30);
      } else if (isNegativeGrade(ud.toGrade)) {
        netMomentum += -0.3 * timeDecay(daysAgo, 90);
      }
    }
  }
  netMomentum = round(netMomentum, 3);

  // Normalize to 0-100 using empirical distribution:
  // Most stocks: net momentum in range [-5, +5]
  // Strong upgrade wave: +5 to +10
  // Heavy downgrade: -5 to -10
  let udScore: number;
  if (recentUd.length === 0) {
    udScore = 50; // No events: neutral
  } else {
    // Sigmoid-like mapping: momentum → 0-100
    // 0 → 50, +5 → 75, -5 → 25, ±10 → saturates at ~90/10
    udScore = round(clamp(50 + netMomentum * 5, 5, 95));
  }

  const formula = `netMomentum(${netMomentum}) → sigmoid → ${udScore} [${recentUd.length} events, ${upgradesCount}↑/${downgradesCount}↓]`;

  const notes = [
    `events_90d=${recentUd.length}`,
    `up=${upgradesCount}`,
    `down=${downgradesCount}`,
    `init=${initiationsCount}`,
    `reit=${reiterationsCount}`,
    `netMomentum=${netMomentum}`,
    recentUd.length === 0 ? 'no_recent_events' : '',
  ].filter(Boolean).join(', ');

  return {
    score: udScore,
    weight: 0.10,
    inputs: {
      total_events_90d: recentUd.length,
      upgrades_count: upgradesCount,
      downgrades_count: downgradesCount,
      net_rating_momentum_raw: netMomentum,
    },
    formula,
    notes,
    sub_scores: {
      upgrade_downgrade_score: udScore,
    },
    indicators: {
      total_events_90d: recentUd.length,
      upgrades_count: upgradesCount,
      downgrades_count: downgradesCount,
      initiations_count: initiationsCount,
      reiterations_count: reiterationsCount,
      net_rating_momentum_raw: netMomentum,
    },
  };
}

// ===== INSIDER ACTIVITY SUB-SCORE (20%) =====

function scoreInsiderActivity(input: ConvergenceInput): InsiderActivityTrace {
  const sentiment = input.finnhubInsiderSentiment;

  if (sentiment.length === 0) {
    return {
      score: 40,
      weight: 0.15,
      inputs: { months_available: 0 },
      formula: 'No insider sentiment data → penalty default 40 (missing data)',
      notes: 'No Finnhub insider sentiment data (may be premium endpoint)',
      sub_scores: { mspr_score: 40, trend_score: 40 },
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
    weight: 0.15,
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

// ===== EARNINGS MOMENTUM SUB-SCORE (20%) =====

function scoreEarningsMomentum(input: ConvergenceInput): EarningsMomentumTrace {
  const earnings = input.finnhubEarnings;

  if (earnings.length === 0) {
    return {
      score: 40,
      weight: 0.20,
      inputs: { quarters_available: 0 },
      formula: 'No earnings data → penalty default 40 (missing data)',
      notes: 'No Finnhub earnings history available',
      sub_scores: { beat_streak_score: 40, surprise_magnitude_score: 40, consistency_score: 40 },
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

  // SUE-relative threshold (Bernard & Thomas 1989) — uses all available earnings
  // for stdDev, not just last 4, to get a more stable estimate
  const allSurprises = earnings.map(e => e.surprisePercent);
  const sueThreshold = computeSurpriseThreshold(allSurprises);

  // Beat streak — uses SUE threshold instead of fixed 0%
  let consecutiveBeats = 0;
  let consecutiveMisses = 0;
  for (const e of recent) {
    if (e.surprisePercent > sueThreshold) {
      if (consecutiveMisses === 0) consecutiveBeats++;
      else break;
    } else if (e.surprisePercent < -sueThreshold) {
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
    weight: 0.20,
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

// ===== FLOW SIGNAL SUB-SCORE (15%) =====

/** Linear interpolation: map value in [inLow, inHigh] to [outLow, outHigh], clamped. */
function lerp(value: number, inLow: number, inHigh: number, outLow: number, outHigh: number): number {
  if (inHigh === inLow) return (outLow + outHigh) / 2;
  const t = (value - inLow) / (inHigh - inLow);
  return clamp(outLow + t * (outHigh - outLow), Math.min(outLow, outHigh), Math.max(outLow, outHigh));
}

function scorePutCallRatio(pcr: number): number {
  // Compressed range: unsigned public PCR has weak predictive power (Johnson & So 2012).
  // Pan & Poteshman (2006): predictive PCR power comes from signed (buy-to-open) flow.
  // Old: 70-point range (90→10). New: 35-point range (70→30), half conviction.
  if (pcr <= 0.7) return lerp(pcr, 0.3, 0.7, 70, 65);
  if (pcr <= 0.9) return lerp(pcr, 0.7, 0.9, 65, 55);
  if (pcr <= 1.1) return lerp(pcr, 0.9, 1.1, 55, 45);
  if (pcr <= 1.3) return lerp(pcr, 1.1, 1.3, 45, 35);
  return lerp(pcr, 1.3, 1.6, 35, 30);
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
  // Continuous tiered scoring replacing binary 2× OI threshold.
  // Stock-specific norms vary widely (TSLA routinely >2× OI, JNJ never).
  // Tiers reflect how extreme the vol/OI ratio is on an absolute basis.
  if (ratio >= 0.5) return lerp(ratio, 0.5, 0.8, 85, 90);
  if (ratio >= 0.3) return lerp(ratio, 0.3, 0.5, 72, 85);
  if (ratio >= 0.15) return lerp(ratio, 0.15, 0.3, 58, 72);
  if (ratio >= 0.05) return lerp(ratio, 0.05, 0.15, 45, 58);
  return lerp(ratio, 0.0, 0.05, 35, 45);
}

function scoreOptionStockRatio(osRatio: number): number {
  // Johnson & So (2012, JFE): O/S ratio is a stronger predictor than unsigned PCR.
  // Lowest O/S decile outperforms highest by 0.34%/week (19.3% annualized).
  // Low O/S = less informed option trading = bullish for stock.
  if (osRatio < 0.1) return lerp(osRatio, 0.0, 0.1, 75, 70);
  if (osRatio <= 0.3) return lerp(osRatio, 0.1, 0.3, 70, 55);
  if (osRatio <= 0.5) return lerp(osRatio, 0.3, 0.5, 55, 45);
  return lerp(osRatio, 0.5, 1.0, 45, 35);
}

function scoreFlowSignal(input: ConvergenceInput): FlowSignalTrace {
  const flow = input.optionsFlow;

  if (!flow) {
    return {
      score: 50,
      weight: 0.10,
      inputs: { data_available: false },
      formula: 'No options flow data → neutral 50',
      notes: 'Finnhub option chain fetch failed or returned no data.',
      sub_scores: {
        put_call_ratio_score: 50,
        unusual_activity_score: 50,
        volume_bias_score: 50,
        option_stock_ratio_score: 50,
      },
      flow_detail: {
        data_available: false,
        option_stock_ratio: null,
        note: 'Finnhub option chain fetch failed or returned no data.',
      },
    };
  }

  // Score each sub-component
  const pcrScore = flow.put_call_ratio !== null
    ? round(scorePutCallRatio(flow.put_call_ratio))
    : 40; // penalty default — missing PCR data

  const biasScore = flow.volume_bias !== null
    ? round(scoreVolumeBias(flow.volume_bias))
    : 40; // penalty default — missing volume bias

  const activityScore = flow.unusual_activity_ratio !== null
    ? round(scoreUnusualActivity(flow.unusual_activity_ratio))
    : 40; // penalty default — missing activity data

  // O/S ratio: total option volume / avg daily stock volume (Johnson & So 2012, JFE)
  const candles = input.candles;
  let osRatio: number | null = null;
  let osScore: number | null = null;
  if (candles.length >= 20) {
    const recentVols = candles.slice(-20).map(c => c.volume);
    const avgStockVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
    if (avgStockVol > 0) {
      const totalOptionVol = flow.total_call_volume + flow.total_put_volume;
      osRatio = round(totalOptionVol / avgStockVol, 4);
      osScore = round(scoreOptionStockRatio(osRatio));
    }
  }

  // Weights depend on O/S availability
  let score: number;
  let formula: string;
  if (osScore !== null) {
    // Full weights: 0.25 PCR + 0.25 bias + 0.25 activity + 0.25 O/S
    score = round(0.25 * pcrScore + 0.25 * biasScore + 0.25 * activityScore + 0.25 * osScore, 1);
    formula = `0.25×PCR(${pcrScore}) + 0.25×Bias(${biasScore}) + 0.25×Activity(${activityScore}) + 0.25×O/S(${osScore}) = ${score}`;
  } else {
    // No candle data for O/S: 0.30 PCR + 0.35 bias + 0.35 activity
    score = round(0.30 * pcrScore + 0.35 * biasScore + 0.35 * activityScore, 1);
    formula = `0.30×PCR(${pcrScore}) + 0.35×Bias(${biasScore}) + 0.35×Activity(${activityScore}) = ${score} [no O/S — missing candle data]`;
  }

  const notes = [
    `PCR=${flow.put_call_ratio ?? 'N/A'}`,
    `bias=${flow.volume_bias ?? 'N/A'}`,
    `unusual=${flow.unusual_activity_ratio ?? 'N/A'}`,
    `O/S=${osRatio ?? 'N/A'}`,
    `${flow.strikes_analyzed} strikes across ${flow.expirations_analyzed} exps`,
    `call_vol=${flow.total_call_volume} put_vol=${flow.total_put_volume}`,
    `${flow.high_activity_strikes} high-activity strikes`,
  ].join(', ');

  return {
    score: round(score),
    weight: 0.10,
    inputs: {
      data_available: true,
      put_call_ratio: flow.put_call_ratio,
      volume_bias: flow.volume_bias,
      unusual_activity_ratio: flow.unusual_activity_ratio,
      option_stock_ratio: osRatio,
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
      option_stock_ratio_score: osScore ?? 50,
    },
    flow_detail: {
      data_available: true,
      option_stock_ratio: osRatio,
      note: `Finnhub option chain: ${flow.expirations_analyzed} expirations, ${flow.strikes_analyzed} strikes analyzed.${osRatio !== null ? ` O/S ratio: ${osRatio}` : ' O/S unavailable (no candle data).'}`,
    },
  };
}

// ===== NEWS SENTIMENT SUB-SCORE (15%) =====

function scoreToDirection(score: number): 'bullish' | 'bearish' | 'neutral' {
  if (score > 55) return 'bullish';
  if (score < 45) return 'bearish';
  return 'neutral';
}

function directionsAgree(a: 'bullish' | 'bearish' | 'neutral', b: 'bullish' | 'bearish' | 'neutral'): boolean {
  // Two directions agree if they're the same, or if one is neutral (not opposing)
  return a === b;
}

function scoreNewsSentiment(input: ConvergenceInput): NewsSentimentTrace {
  const news = input.newsSentiment;

  if (!news) {
    return {
      score: 50,
      weight: 0.15,
      inputs: { data_available: false },
      formula: 'No news sentiment data → neutral 50',
      notes: 'Finnhub company-news fetch failed or returned no data.',
      sub_scores: { buzz_score: 50, sentiment_score: 50, source_quality_score: 50 },
      news_detail: {
        data_available: false,
        total_articles_30d: 0,
        articles_7d: 0,
        buzz_ratio: null,
        sentiment_7d_score: null,
        sentiment_momentum: null,
        tier1_ratio: null,
        source_distribution: {},
        headlines: [],
        classification_method: 'none',
      },
    };
  }

  // --- Buzz score (30%) ---
  let buzzScore: number;
  if (news.articles_7d === 0) {
    buzzScore = 20;
  } else if (news.buzz_ratio !== null) {
    if (news.buzz_ratio >= 1.5) buzzScore = lerp(news.buzz_ratio, 1.5, 3.0, 80, 90);
    else if (news.buzz_ratio >= 0.8) buzzScore = lerp(news.buzz_ratio, 0.8, 1.5, 50, 80);
    else if (news.buzz_ratio >= 0.5) buzzScore = lerp(news.buzz_ratio, 0.5, 0.8, 35, 50);
    else buzzScore = lerp(news.buzz_ratio, 0.0, 0.5, 20, 35);
  } else {
    // No baseline (0 articles in 8-30d range), but have 7d articles
    buzzScore = news.articles_7d >= 5 ? 65 : news.articles_7d >= 1 ? 50 : 20;
  }
  buzzScore = round(buzzScore);

  // --- Sentiment score (40%) ---
  let sentimentScore = round(news.sentiment_7d.score);
  // Apply momentum bonus/penalty
  if (news.sentiment_momentum > 10) {
    sentimentScore = round(clamp(sentimentScore + 5, 0, 100));
  } else if (news.sentiment_momentum < -10) {
    sentimentScore = round(clamp(sentimentScore - 5, 0, 100));
  }

  // --- Source quality score (30%) ---
  let sourceQualityScore: number;
  if (news.tier1_ratio > 0.5) sourceQualityScore = lerp(news.tier1_ratio, 0.5, 1.0, 80, 90);
  else if (news.tier1_ratio > 0.3) sourceQualityScore = lerp(news.tier1_ratio, 0.3, 0.5, 65, 80);
  else if (news.tier1_ratio > 0.1) sourceQualityScore = lerp(news.tier1_ratio, 0.1, 0.3, 50, 65);
  else if (news.tier1_ratio > 0) sourceQualityScore = lerp(news.tier1_ratio, 0.0, 0.1, 35, 50);
  else sourceQualityScore = 25;
  sourceQualityScore = round(sourceQualityScore);

  // Weighted: buzz 30%, sentiment 40%, source quality 30%
  let score = round(0.30 * buzzScore + 0.40 * sentimentScore + 0.30 * sourceQualityScore, 1);

  // --- 3-Leg Ensemble: Keyword + Haiku LLM + Finnhub FinBERT ---
  const classMethod = news.classification_method ?? 'keyword-fallback';
  const finbert = input.finnhubNewsSentiment;

  // Determine direction from each leg:
  // Leg 1 (keyword): always available — uses the raw keyword-based sentiment from 7d headlines
  const keywordDirection = scoreToDirection(news.sentiment_7d.score);

  // Leg 2 (Haiku LLM): available when classification_method === 'llm-haiku'
  // The LLM classification overwrites headline sentiments in-place, so sentiment_7d.score
  // already reflects LLM when available. Use classification method to determine if LLM ran.
  const haikuDirection: 'bullish' | 'bearish' | 'neutral' | null =
    classMethod === 'llm-haiku' ? scoreToDirection(sentimentScore) : null;

  // Leg 3 (FinBERT): companyNewsScore from /news-sentiment (0-1, 0.5 = neutral)
  let finbertDirection: 'bullish' | 'bearish' | 'neutral' | null = null;
  let finbertScore: number | null = null;
  if (finbert) {
    // Convert 0-1 scale to 0-100
    finbertScore = round(finbert.companyNewsScore * 100, 1);
    finbertDirection = scoreToDirection(finbertScore);
  }

  // Compute ensemble agreement and confidence modifier
  const activeLegDirections: ('bullish' | 'bearish' | 'neutral')[] = [keywordDirection];
  if (haikuDirection) activeLegDirections.push(haikuDirection);
  if (finbertDirection) activeLegDirections.push(finbertDirection);

  let ensembleAgreement: 'unanimous' | 'majority' | 'split' | 'two-leg';
  let ensembleConfidenceModifier: number;

  if (activeLegDirections.length <= 2) {
    // 2-leg mode: FinBERT unavailable (or Haiku unavailable)
    if (activeLegDirections.length === 2 && directionsAgree(activeLegDirections[0], activeLegDirections[1])) {
      ensembleAgreement = 'two-leg';
      ensembleConfidenceModifier = 0; // Standard weight — 2 legs agree but missing 3rd
    } else if (activeLegDirections.length === 2) {
      ensembleAgreement = 'two-leg';
      ensembleConfidenceModifier = -0.15; // 2 legs disagree — mild reduction
    } else {
      ensembleAgreement = 'two-leg';
      ensembleConfidenceModifier = 0; // Only 1 leg — no ensemble signal
    }
  } else {
    // 3-leg mode: all three available
    const allSame = activeLegDirections.every(d => d === activeLegDirections[0]);
    if (allSame) {
      ensembleAgreement = 'unanimous';
      ensembleConfidenceModifier = 0.20; // High confidence — increase weight by 20%
    } else {
      // Check for majority (2 of 3 agree)
      const counts = { bullish: 0, bearish: 0, neutral: 0 };
      for (const d of activeLegDirections) counts[d]++;
      const hasMajority = counts.bullish >= 2 || counts.bearish >= 2 || counts.neutral >= 2;
      if (hasMajority) {
        ensembleAgreement = 'majority';
        ensembleConfidenceModifier = 0; // Normal confidence — standard weight
      } else {
        ensembleAgreement = 'split';
        ensembleConfidenceModifier = -0.30; // Low confidence — reduce weight by 30%
      }
    }
  }

  // Apply ensemble confidence modifier to final score
  // Modifier scales the distance from neutral (50):
  // unanimous: score moves 20% further from 50
  // split: score moves 30% closer to 50
  if (ensembleConfidenceModifier !== 0) {
    const distFromNeutral = score - 50;
    score = round(clamp(50 + distFromNeutral * (1 + ensembleConfidenceModifier), 0, 100), 1);
  }

  const formula = `0.30×Buzz(${buzzScore}) + 0.40×Sentiment(${sentimentScore}) + 0.30×SourceQuality(${sourceQualityScore}) [ensemble=${ensembleAgreement}, modifier=${ensembleConfidenceModifier > 0 ? '+' : ''}${round(ensembleConfidenceModifier * 100)}%] = ${score}`;

  const notesParts = [
    `${news.articles_7d} articles (7d), ${news.articles_8_30d} articles (8-30d)`,
    `buzz_ratio=${news.buzz_ratio ?? 'N/A'}`,
    `sentiment_7d=${news.sentiment_7d.score}`,
    `momentum=${news.sentiment_momentum}`,
    `tier1=${round(news.tier1_ratio * 100, 1)}%`,
    `7d: ${news.sentiment_7d.bullish_matches}B/${news.sentiment_7d.bearish_matches}b/${news.sentiment_7d.neutral}N`,
    `method=${classMethod}`,
    `ensemble=${ensembleAgreement}`,
  ];
  if (!finbert) notesParts.push('finnhub_sentiment_unavailable');
  const notes = notesParts.join(', ');

  return {
    score: round(score),
    weight: 0.15,
    inputs: {
      data_available: true,
      total_articles_30d: news.total_articles_30d,
      articles_7d: news.articles_7d,
      articles_8_30d: news.articles_8_30d,
      buzz_ratio: news.buzz_ratio,
      sentiment_7d_score: news.sentiment_7d.score,
      sentiment_momentum: news.sentiment_momentum,
      tier1_ratio: news.tier1_ratio,
      classification_method: classMethod,
    },
    formula,
    notes,
    sub_scores: {
      buzz_score: buzzScore,
      sentiment_score: sentimentScore,
      source_quality_score: sourceQualityScore,
    },
    news_detail: {
      data_available: true,
      total_articles_30d: news.total_articles_30d,
      articles_7d: news.articles_7d,
      buzz_ratio: news.buzz_ratio,
      sentiment_7d_score: news.sentiment_7d.score,
      sentiment_momentum: news.sentiment_momentum,
      tier1_ratio: news.tier1_ratio,
      source_distribution: news.source_distribution,
      headlines: news.headlines,
      classification_method: classMethod,
    },
    ensemble: {
      finnhub_sentiment_score: finbertScore,
      finnhub_buzz: finbert?.buzz ?? null,
      finnhub_sector_avg: finbert?.sectorAverageNewsScore ?? null,
      ensemble_agreement: ensembleAgreement,
      ensemble_confidence_modifier: ensembleConfidenceModifier,
      leg_directions: {
        keyword: keywordDirection,
        haiku: haikuDirection,
        finbert: finbertDirection,
      },
    },
  };
}

// ===== FILING RECENCY SIGNAL (SEC EDGAR) =====
// Event-driven overlay: fires when a 10-Q/10-K was filed within 72 hours.
// Asymmetric response: bad news travels faster (Barberis, Shleifer & Vishny 1998).

function scoreFilingRecency(input: ConvergenceInput): FilingRecencyTrace {
  const filing = input.secFilingData;
  const estimates = input.finnhubEstimates;

  // Dormant state: no filing or filing older than 72 hours
  if (!filing || filing.filingAgeHours > 72) {
    return {
      filing_signal_active: false,
      filing_type: filing?.latestFilingType ?? null,
      filing_age_hours: filing?.filingAgeHours ?? null,
      eps_surprise_pct: null,
      revenue_surprise_pct: null,
      filing_recency_score: 50,
      filing_modifier: 0,
      earnings_surprise: null,
    };
  }

  // Active state: recent filing within 72 hours
  const epsActual = filing.epsActual;
  const revenueActual = filing.revenueActual;

  // Cross-reference with Finnhub estimates
  // Find the estimate matching the filing's fiscal period
  let epsEstimate: number | null = null;
  let revenueEstimate: number | null = null;

  if (estimates?.epsEstimates && epsActual !== null) {
    // Match by period end date (filing period end ≈ estimate period)
    const match = estimates.epsEstimates.find(e => {
      // Fuzzy match: same quarter/year
      return e.period <= filing.latestFilingDate;
    });
    if (match) epsEstimate = match.epsAvg;
  }

  if (estimates?.revenueEstimates && revenueActual !== null) {
    const match = estimates.revenueEstimates.find(e => {
      return e.period <= filing.latestFilingDate;
    });
    if (match) revenueEstimate = match.revenueAvg;
  }

  // Compute surprise percentages
  const epsSurprisePct = epsActual !== null && epsEstimate !== null && Math.abs(epsEstimate) > 0.001
    ? round(((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100, 2)
    : null;

  const revenueSurprisePct = revenueActual !== null && revenueEstimate !== null && revenueEstimate > 0
    ? round(((revenueActual - revenueEstimate) / revenueEstimate) * 100, 2)
    : null;

  // Compute filing recency score (0-100)
  let filingRecencyScore = 50;

  // EPS surprise is primary signal
  if (epsSurprisePct !== null) {
    if (epsSurprisePct > 20) filingRecencyScore = 85;
    else if (epsSurprisePct > 10) filingRecencyScore = 78;
    else if (epsSurprisePct > 5) filingRecencyScore = 70;
    else if (epsSurprisePct > 2) filingRecencyScore = 60;
    else if (epsSurprisePct > -2) filingRecencyScore = 50;
    else if (epsSurprisePct > -5) filingRecencyScore = 40;
    else if (epsSurprisePct > -10) filingRecencyScore = 30;
    else if (epsSurprisePct > -20) filingRecencyScore = 20;
    else filingRecencyScore = 15;
  }

  // Revenue surprise secondary modifier (±5 pts)
  if (revenueSurprisePct !== null) {
    if (revenueSurprisePct > 5) filingRecencyScore = clamp(filingRecencyScore + 5, 0, 100);
    else if (revenueSurprisePct < -5) filingRecencyScore = clamp(filingRecencyScore - 5, 0, 100);
  }

  // Filing age modifier: fresher = stronger signal
  // 0-6 hours: full weight, 6-24h: 80%, 24-72h: 50%
  let ageMultiplier = 1.0;
  if (filing.filingAgeHours <= 6) ageMultiplier = 1.0;
  else if (filing.filingAgeHours <= 24) ageMultiplier = 0.80;
  else ageMultiplier = 0.50; // 24-72h

  // Compute additive modifier on Info-Edge score
  // Positive surprise: up to +8, Negative surprise: up to -12 (asymmetric)
  const distFromNeutral = filingRecencyScore - 50;
  let filingModifier: number;
  if (distFromNeutral > 0) {
    // Bullish: scale 0-35 range → 0 to +8
    filingModifier = round((distFromNeutral / 35) * 8 * ageMultiplier, 1);
  } else {
    // Bearish: scale 0 to -35 range → 0 to -12 (asymmetric penalty)
    filingModifier = round((distFromNeutral / 35) * 12 * ageMultiplier, 1);
  }

  const earningsSurprise: EarningsSurpriseSignal = {
    epsActual,
    epsEstimate,
    epsSurprisePct,
    revenueActual,
    revenueEstimate,
    revenueSurprisePct,
    filingAgeHours: filing.filingAgeHours,
    isRecentFiling: true,
  };

  return {
    filing_signal_active: true,
    filing_type: filing.latestFilingType,
    filing_age_hours: filing.filingAgeHours,
    eps_surprise_pct: epsSurprisePct,
    revenue_surprise_pct: revenueSurprisePct,
    filing_recency_score: filingRecencyScore,
    filing_modifier: filingModifier,
    earnings_surprise: earningsSurprise,
  };
}

// ===== INSTITUTIONAL OWNERSHIP SUB-SCORE =====
// Chen, Jegadeesh & Wermers (2000): ΔIO — institutional purchases outperform sales.
// Score the CHANGE in ownership, not the level.

function scoreInstitutionalOwnership(input: ConvergenceInput): InstitutionalOwnershipTrace {
  const ownership = input.finnhubInstitutionalOwnership;

  if (!ownership) {
    return {
      score: 50,
      weight: 0.05,
      inputs: { data_available: false },
      formula: 'No institutional ownership data → neutral 50',
      notes: 'Finnhub ownership endpoints returned no data',
      sub_scores: { institutional_ownership_score: 50 },
      indicators: {
        net_buyer_ratio: null,
        net_buyers: 0,
        net_sellers: 0,
        total_holders: 0,
        total_change: 0,
        filing_staleness_days: null,
        staleness_discounted: false,
      },
    };
  }

  const { netBuyerCount, netSellerCount, latestFilingDate, totalInstitutionalChange, topHolderCount } = ownership;
  const totalActive = netBuyerCount + netSellerCount;

  // Net buyer ratio: what fraction of active holders are buying?
  let netBuyerRatio: number | null = null;
  let ioScore = 50; // neutral default

  if (totalActive > 0) {
    netBuyerRatio = round(netBuyerCount / totalActive, 4);

    // Map ratio to score: 1.0 → 85, 0.65 → 70, 0.50 → 50, 0.35 → 30, 0.0 → 15
    if (netBuyerRatio > 0.80) ioScore = lerp(netBuyerRatio, 0.80, 1.0, 75, 85);
    else if (netBuyerRatio > 0.65) ioScore = lerp(netBuyerRatio, 0.65, 0.80, 65, 75);
    else if (netBuyerRatio > 0.50) ioScore = lerp(netBuyerRatio, 0.50, 0.65, 50, 65);
    else if (netBuyerRatio > 0.35) ioScore = lerp(netBuyerRatio, 0.35, 0.50, 35, 50);
    else if (netBuyerRatio > 0.20) ioScore = lerp(netBuyerRatio, 0.20, 0.35, 20, 35);
    else ioScore = lerp(netBuyerRatio, 0.0, 0.20, 15, 20);

    ioScore = round(clamp(ioScore, 0, 100));
  }

  // Staleness discount: 13F filings have 45-day delay; if > 90 days old, compress toward neutral by 30%
  let stalenessDays: number | null = null;
  let stalenessDiscounted = false;
  if (latestFilingDate) {
    stalenessDays = Math.round((Date.now() - new Date(latestFilingDate).getTime()) / (24 * 60 * 60 * 1000));
    if (stalenessDays > 90) {
      const distFromNeutral = ioScore - 50;
      ioScore = round(50 + distFromNeutral * 0.70); // compress 30% toward neutral
      stalenessDiscounted = true;
    }
  }

  const formula = `NetBuyerRatio(${netBuyerRatio ?? 'N/A'}) → ${ioScore}${stalenessDiscounted ? ` [staleness discount: ${stalenessDays}d > 90d]` : ''} [${topHolderCount} holders]`;
  const notes = [
    `buyers=${netBuyerCount}`,
    `sellers=${netSellerCount}`,
    `ratio=${netBuyerRatio ?? 'N/A'}`,
    `holders=${topHolderCount}`,
    `change=${totalInstitutionalChange}`,
    `filing=${latestFilingDate ?? 'N/A'}`,
    stalenessDiscounted ? `stale(${stalenessDays}d)` : '',
  ].filter(Boolean).join(', ');

  return {
    score: ioScore,
    weight: 0.05,
    inputs: {
      data_available: true,
      net_buyer_ratio: netBuyerRatio,
      net_buyers: netBuyerCount,
      net_sellers: netSellerCount,
    },
    formula,
    notes,
    sub_scores: { institutional_ownership_score: ioScore },
    indicators: {
      net_buyer_ratio: netBuyerRatio,
      net_buyers: netBuyerCount,
      net_sellers: netSellerCount,
      total_holders: topHolderCount,
      total_change: totalInstitutionalChange,
      filing_staleness_days: stalenessDays,
      staleness_discounted: stalenessDiscounted,
    },
  };
}

// ===== MAIN INFO EDGE SCORER =====
// Weight rebalance history:
//   Round 1 (2A/2B):                    Round 2 (2F):
//   analyst_consensus:  0.15             0.15  (unchanged)
//   price_target:       0.10             0.10  (unchanged)
//   upgrade_downgrade:  0.10             0.10  (unchanged)
//   insider_activity:   0.15             0.15  (unchanged)
//   earnings_momentum:  0.20             0.20  (unchanged)
//   flow_signal:        0.15          →  0.10  (reduced — weakest academic signal)
//   news_sentiment:     0.15             0.15  (unchanged)
//   institutional_own:  (new)            0.05  (Chen, Jegadeesh & Wermers 2000)
//   Total:              1.00             1.00

export function scoreInfoEdge(input: ConvergenceInput): InfoEdgeResult {
  const analystConsensus = scoreAnalystConsensus(input);
  const priceTargetSignal = scorePriceTargetSignal(input);
  const upgradeDowngradeSignal = scoreUpgradeDowngradeSignal(input);
  const insiderActivity = scoreInsiderActivity(input);
  const earningsMomentum = scoreEarningsMomentum(input);
  const flowSignal = scoreFlowSignal(input);
  const newsSentiment = scoreNewsSentiment(input);
  const institutionalOwnership = scoreInstitutionalOwnership(input);
  const filingRecency = scoreFilingRecency(input);

  let score = round(
    analystConsensus.weight * analystConsensus.score +
    priceTargetSignal.weight * priceTargetSignal.score +
    upgradeDowngradeSignal.weight * upgradeDowngradeSignal.score +
    insiderActivity.weight * insiderActivity.score +
    earningsMomentum.weight * earningsMomentum.score +
    flowSignal.weight * flowSignal.score +
    newsSentiment.weight * newsSentiment.score +
    institutionalOwnership.weight * institutionalOwnership.score,
    1,
  );

  // Filing recency: event-driven overlay (does NOT rebalance weights)
  // Positive surprise: up to +8 pts, Negative surprise: up to -12 pts (asymmetric)
  if (filingRecency.filing_signal_active && filingRecency.filing_modifier !== 0) {
    score = clamp(round(score + filingRecency.filing_modifier, 1), 0, 100);
  }

  // Build DataConfidence
  const imputedFields: string[] = [];
  if (input.finnhubRecommendations.length === 0 && !input.finnhubEstimates) imputedFields.push('analyst_consensus');
  else if (!input.finnhubEstimates) imputedFields.push('analyst_consensus.estimates');
  if (!input.finnhubEstimates?.priceTarget) imputedFields.push('price_target_signal');
  if ((input.finnhubEstimates?.upgradeDowngrade ?? []).length === 0) imputedFields.push('upgrade_downgrade_signal');
  if (input.finnhubInsiderSentiment.length === 0) imputedFields.push('insider_activity');
  if (input.finnhubEarnings.length === 0) imputedFields.push('earnings_momentum');
  if (!input.optionsFlow) {
    imputedFields.push('flow_signal');
  } else {
    if (input.optionsFlow.put_call_ratio == null) imputedFields.push('flow_signal.pcr');
    if (input.optionsFlow.volume_bias == null) imputedFields.push('flow_signal.volume_bias');
    if (input.optionsFlow.unusual_activity_ratio == null) imputedFields.push('flow_signal.unusual_activity');
  }
  if (!input.newsSentiment) imputedFields.push('news_sentiment');
  if (!input.finnhubInstitutionalOwnership) imputedFields.push('institutional_ownership');

  const totalSubScores = 8; // analyst, price_target, upgrade_downgrade, insider, earnings, flow, news, institutional
  const dataConfidence: DataConfidence = {
    total_sub_scores: totalSubScores,
    imputed_sub_scores: imputedFields.length,
    confidence: round(1 - imputedFields.length / totalSubScores, 4),
    imputed_fields: imputedFields,
  };

  return {
    score,
    data_confidence: dataConfidence,
    filing_recency: filingRecency,
    breakdown: {
      analyst_consensus: analystConsensus,
      price_target_signal: priceTargetSignal,
      upgrade_downgrade_signal: upgradeDowngradeSignal,
      insider_activity: insiderActivity,
      earnings_momentum: earningsMomentum,
      flow_signal: flowSignal,
      news_sentiment: newsSentiment,
      institutional_ownership: institutionalOwnership,
    },
  };
}
