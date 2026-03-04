import type { FredDailyHistory, CrossAssetCorrelations } from './types';

function round(v: number, decimals = 4): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== DAILY RETURNS =====
// Convert price levels to daily log returns. Bonds: yield changes (not log).
// Align dates across series by inner-joining on date strings.

interface DailyReturn {
  date: string;
  value: number;
}

function computeDailyReturns(observations: { date: string; value: number }[], isYield = false): DailyReturn[] {
  const returns: DailyReturn[] = [];
  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1].value;
    const curr = observations[i].value;
    if (prev === 0) continue;
    // Yields: use simple difference (basis points conceptually).
    // Prices: use log return for better statistical properties.
    const ret = isYield ? (curr - prev) : Math.log(curr / prev);
    returns.push({ date: observations[i].date, value: ret });
  }
  return returns;
}

// ===== ROLLING PEARSON CORRELATION =====
// Computes Pearson r over the most recent `window` aligned observations.

function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 20) return null; // Need at least 20 observations for meaningful correlation

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return null;

  return (n * sumXY - sumX * sumY) / denom;
}

// ===== ALIGN SERIES BY DATE =====
// Inner join on date strings. Returns arrays of aligned values.

function alignSeries(
  a: DailyReturn[],
  b: DailyReturn[],
): { dates: string[]; aVals: number[]; bVals: number[] } {
  const bMap = new Map(b.map(r => [r.date, r.value]));
  const dates: string[] = [];
  const aVals: number[] = [];
  const bVals: number[] = [];

  for (const r of a) {
    const bVal = bMap.get(r.date);
    if (bVal !== undefined) {
      dates.push(r.date);
      aVals.push(r.value);
      bVals.push(bVal);
    }
  }

  return { dates, aVals, bVals };
}

// ===== CORRELATION CLUSTER CLASSIFICATION =====
// Based on Bridgewater All Weather framework and AQR regime analysis.
//
// bond_equity < -0.3 and oil_equity > 0    → risk_on (stocks up, bonds down = growth)
// bond_equity > 0.3 and oil_equity < 0     → risk_off (stocks+bonds up, oil down = deflation fear)
// oil_equity > 0.3 and oil_bond > 0        → inflation (oil driving everything)
// bond_equity > 0.3 and oil_equity < -0.2  → deflation (bonds rally, everything else down)
// Otherwise                                → transition

interface ClusterResult {
  cluster: CrossAssetCorrelations['cluster'];
  confidence: number;
}

function classifyCorrelationCluster(
  bondEquity: number | null,
  oilEquity: number | null,
  oilBond: number | null,
): ClusterResult {
  if (bondEquity === null || oilEquity === null || oilBond === null) {
    return { cluster: 'transition', confidence: 0 };
  }

  // Score each regime hypothesis (0-1 scale)
  // risk_on: negative bond-equity correlation (stocks up, bonds down), positive oil-equity
  const riskOnScore = Math.max(0, -bondEquity) * 0.6 + Math.max(0, oilEquity) * 0.4;

  // risk_off: positive bond-equity (both sell off or both rally), negative oil-equity
  const riskOffScore = Math.max(0, bondEquity) * 0.5 + Math.max(0, -oilEquity) * 0.5;

  // inflation: positive oil-equity and oil-bond (oil drives correlations)
  const inflationScore = Math.max(0, oilEquity) * 0.4 + Math.max(0, oilBond) * 0.4 +
    Math.max(0, bondEquity) * 0.2;

  // deflation: positive bond-equity (flight to safety), negative oil-equity
  const deflationScore = Math.max(0, bondEquity) * 0.4 + Math.max(0, -oilEquity) * 0.4 +
    Math.max(0, -oilBond) * 0.2;

  const scores = [
    { cluster: 'risk_on' as const, score: riskOnScore },
    { cluster: 'risk_off' as const, score: riskOffScore },
    { cluster: 'inflation' as const, score: inflationScore },
    { cluster: 'deflation' as const, score: deflationScore },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];

  // Confidence: how far the best cluster is from the second
  const spread = best.score - second.score;
  if (spread < 0.1) {
    return { cluster: 'transition', confidence: round(spread, 4) };
  }

  return { cluster: best.cluster, confidence: round(Math.min(1, best.score), 4) };
}

// ===== MAIN COMPUTATION =====

export function computeCrossAssetCorrelations(
  dailyHistory: Map<string, FredDailyHistory>,
): CrossAssetCorrelations | null {
  const dgs10 = dailyHistory.get('DGS10');
  const sp500 = dailyHistory.get('SP500');
  const oil = dailyHistory.get('DCOILWTICO');

  // Need at least 2 of 3 series with adequate data
  const available = [dgs10, sp500, oil].filter(s => s && s.observations.length >= 60);
  if (available.length < 2) {
    return null;
  }

  // Compute daily returns
  const bondReturns = dgs10 ? computeDailyReturns(dgs10.observations, true) : [];
  const equityReturns = sp500 ? computeDailyReturns(sp500.observations, false) : [];
  const oilReturns = oil ? computeDailyReturns(oil.observations, false) : [];

  // Compute correlations at two windows: 60-day (rolling) and 252-day (full year)
  function corrPair(
    a: DailyReturn[], b: DailyReturn[], window: number,
  ): number | null {
    const { aVals, bVals } = alignSeries(a, b);
    if (aVals.length < window) {
      // Use whatever we have if at least 20 observations
      return pearsonCorrelation(aVals, bVals);
    }
    // Use most recent `window` observations
    const startIdx = aVals.length - window;
    return pearsonCorrelation(
      aVals.slice(startIdx),
      bVals.slice(startIdx),
    );
  }

  // 60-day rolling correlations
  const bondEquity60 = corrPair(bondReturns, equityReturns, 60);
  const oilEquity60 = corrPair(oilReturns, equityReturns, 60);
  const oilBond60 = corrPair(oilReturns, bondReturns, 60);

  // 252-day (full year) correlations
  const bondEquity252 = corrPair(bondReturns, equityReturns, 252);
  const oilEquity252 = corrPair(oilReturns, equityReturns, 252);
  const oilBond252 = corrPair(oilReturns, bondReturns, 252);

  // Regime shift detection: significant divergence between short and long window
  const diffs: number[] = [];
  if (bondEquity60 !== null && bondEquity252 !== null) diffs.push(Math.abs(bondEquity60 - bondEquity252));
  if (oilEquity60 !== null && oilEquity252 !== null) diffs.push(Math.abs(oilEquity60 - oilEquity252));
  if (oilBond60 !== null && oilBond252 !== null) diffs.push(Math.abs(oilBond60 - oilBond252));

  const maxDiff = diffs.length > 0 ? Math.max(...diffs) : 0;
  const regimeShiftDetected = maxDiff > 0.25; // >0.25 correlation change = significant

  // Cluster classification from 60-day correlations
  const { cluster, confidence } = classifyCorrelationCluster(bondEquity60, oilEquity60, oilBond60);

  const notes: string[] = [];
  if (bondReturns.length === 0) notes.push('DGS10: no data');
  if (equityReturns.length === 0) notes.push('SP500: no data');
  if (oilReturns.length === 0) notes.push('DCOILWTICO: no data');
  if (regimeShiftDetected) notes.push(`regime_shift: 60d vs 252d divergence=${round(maxDiff, 2)}`);

  return {
    bond_equity: bondEquity60 !== null ? round(bondEquity60) : null,
    oil_equity: oilEquity60 !== null ? round(oilEquity60) : null,
    oil_bond: oilBond60 !== null ? round(oilBond60) : null,
    bond_equity_252d: bondEquity252 !== null ? round(bondEquity252) : null,
    oil_equity_252d: oilEquity252 !== null ? round(oilEquity252) : null,
    oil_bond_252d: oilBond252 !== null ? round(oilBond252) : null,
    regime_shift_detected: regimeShiftDetected,
    regime_shift_magnitude: round(maxDiff),
    cluster,
    cluster_confidence: confidence,
    note: notes.length > 0 ? notes.join('; ') : `cluster=${cluster}, confidence=${confidence}`,
  };
}
