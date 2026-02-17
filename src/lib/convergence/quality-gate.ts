import type {
  ConvergenceInput,
  QualityGateResult,
  SafetyTrace,
  ProfitabilityTrace,
  GrowthTrace,
  EfficiencyTrace,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== Z-SCORE HELPERS =====

interface MetricDef {
  /** Key used to look up sector stats */
  key: string;
  /** If true, lower values are better (e.g. debt, beta) */
  invert: boolean;
}

/**
 * Extract a numeric value from Finnhub metrics by key.
 */
function getMetric(metric: Record<string, number | string | null>, key: string): number | null {
  const v = metric[key];
  return typeof v === 'number' ? v : null;
}

/**
 * Score a single metric using z-score transform when sector stats are available.
 * Returns 50 (neutral) when the raw value or sector stats are missing.
 *
 * Formula: 50 + clamp(z * 15, -50, 50)  where z = (value - mean) / std
 * For inverted metrics (lower = better), z is negated before scoring.
 */
function zScore(
  value: number | null,
  def: MetricDef,
  sectorMetrics: Record<string, { mean: number; std: number }> | undefined,
): number {
  if (value === null) return 50;
  const stats = sectorMetrics?.[def.key];
  if (!stats || stats.std === 0) return 50;
  let z = (value - stats.mean) / stats.std;
  if (def.invert) z = -z;
  return round(50 + clamp(z * 15, -50, 50), 1);
}

/**
 * Average an array of sub-scores into a single component score.
 */
function avgScore(scores: number[]): number {
  if (scores.length === 0) return 50;
  return round(scores.reduce((a, b) => a + b, 0) / scores.length, 1);
}

/**
 * Look up sector metrics from the input's sectorStats.
 */
function getSectorMetrics(
  input: ConvergenceInput,
): Record<string, { mean: number; std: number }> | undefined {
  const sector = input.ttScanner?.sector;
  if (!sector || !input.sectorStats) return undefined;
  return input.sectorStats[sector]?.metrics;
}

// ===== SAFETY SUB-SCORE (40%) =====

const SAFETY_METRICS: MetricDef[] = [
  { key: 'totalDebt/totalEquityQuarterly', invert: true },
  { key: 'beta', invert: true },
  { key: 'currentRatioQuarterly', invert: false },
  { key: 'returnVariability', invert: true },
];

function scoreSafety(input: ConvergenceInput): SafetyTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};
  const sectorMetrics = getSectorMetrics(input);

  // Extract raw values
  const debtToEquity = getMetric(metric, 'totalDebt/totalEquityQuarterly');
  const beta = getMetric(metric, 'beta');
  const currentRatio = getMetric(metric, 'currentRatioQuarterly');

  // Return variability: std dev of daily returns from candles
  let returnVariability: number | null = null;
  if (input.candles.length >= 20) {
    const closes = input.candles.slice(-60).map(c => c.close);
    if (closes.length >= 2) {
      const returns: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        if (closes[i - 1] > 0) {
          returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        }
      }
      if (returns.length > 1) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
        returnVariability = round(Math.sqrt(variance) * 100, 4); // as percentage
      }
    }
  }

  const deScore = zScore(debtToEquity, SAFETY_METRICS[0], sectorMetrics);
  const betaScore = zScore(beta, SAFETY_METRICS[1], sectorMetrics);
  const crScore = zScore(currentRatio, SAFETY_METRICS[2], sectorMetrics);
  const rvScore = zScore(returnVariability, SAFETY_METRICS[3], sectorMetrics);

  const score = avgScore([deScore, betaScore, crScore, rvScore]);

  const parts = [
    `D/E(${deScore})`,
    `Beta(${betaScore})`,
    `CR(${crScore})`,
    `RetVar(${rvScore})`,
  ];
  const formula = `avg(${parts.join(', ')}) = ${score}`;

  return {
    score,
    weight: 0.40,
    inputs: {
      debt_to_equity: debtToEquity,
      beta,
      current_ratio: currentRatio,
      return_variability: returnVariability,
    },
    formula,
    notes: `D/E=${debtToEquity ?? 'N/A'}, Beta=${beta ?? 'N/A'}, CR=${currentRatio ?? 'N/A'}, RetVar=${returnVariability ?? 'N/A'}%${sectorMetrics ? '' : ' (no sector stats)'}`,
    sub_scores: {
      debt_to_equity_score: deScore,
      beta_score: betaScore,
      current_ratio_score: crScore,
      return_variability_score: rvScore,
    },
  };
}

// ===== PROFITABILITY SUB-SCORE (30%) =====

const PROFITABILITY_METRICS: MetricDef[] = [
  { key: 'grossMarginTTM', invert: false },
  { key: 'roeTTM', invert: false },
  { key: 'roaTTM', invert: false },
  { key: 'fcfYield', invert: false },
];

function scoreProfitability(input: ConvergenceInput): ProfitabilityTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};
  const sectorMetrics = getSectorMetrics(input);

  const grossMargin = getMetric(metric, 'grossMarginTTM');
  const roe = getMetric(metric, 'roeTTM');
  const roa = getMetric(metric, 'roaTTM');

  // FCF yield: freeCashFlowPerShare / price
  const fcfPerShare = getMetric(metric, 'freeCashFlowPerShareTTM');
  const mktCap = getMetric(metric, 'marketCapitalization');
  const sharesOut = getMetric(metric, 'shareOutstanding');
  let fcfYield: number | null = null;
  if (fcfPerShare !== null && mktCap !== null && sharesOut !== null && sharesOut > 0) {
    const price = (mktCap * 1e6) / (sharesOut * 1e6);
    if (price > 0) {
      fcfYield = round((fcfPerShare / price) * 100, 2);
    }
  }

  const gmScore = zScore(grossMargin, PROFITABILITY_METRICS[0], sectorMetrics);
  const roeScore = zScore(roe, PROFITABILITY_METRICS[1], sectorMetrics);
  const roaScore = zScore(roa, PROFITABILITY_METRICS[2], sectorMetrics);
  const fcfScore = zScore(fcfYield, PROFITABILITY_METRICS[3], sectorMetrics);

  const score = avgScore([gmScore, roeScore, roaScore, fcfScore]);

  const parts = [
    `GM(${gmScore})`,
    `ROE(${roeScore})`,
    `ROA(${roaScore})`,
    `FCF(${fcfScore})`,
  ];
  const formula = `avg(${parts.join(', ')}) = ${score}`;

  return {
    score,
    weight: 0.30,
    inputs: {
      gross_margin_ttm: grossMargin,
      roe_ttm: roe,
      roa_ttm: roa,
      fcf_yield: fcfYield,
    },
    formula,
    notes: `GM=${grossMargin ?? 'N/A'}%, ROE=${roe ?? 'N/A'}%, ROA=${roa ?? 'N/A'}%, FCFy=${fcfYield ?? 'N/A'}%${sectorMetrics ? '' : ' (no sector stats)'}`,
    sub_scores: {
      gross_margin_score: gmScore,
      roe_score: roeScore,
      roa_score: roaScore,
      fcf_yield_score: fcfScore,
    },
  };
}

// ===== GROWTH SUB-SCORE (15%) =====

const GROWTH_METRICS: MetricDef[] = [
  { key: 'revenueGrowthTTMYoy', invert: false },
  { key: 'epsGrowthTTMYoy', invert: false },
];

function scoreGrowth(input: ConvergenceInput): GrowthTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};
  const sectorMetrics = getSectorMetrics(input);

  const revenueGrowth = getMetric(metric, 'revenueGrowthTTMYoy');
  const epsGrowth = getMetric(metric, 'epsGrowthTTMYoy');

  const revScore = zScore(revenueGrowth, GROWTH_METRICS[0], sectorMetrics);
  const epsScore = zScore(epsGrowth, GROWTH_METRICS[1], sectorMetrics);

  const score = avgScore([revScore, epsScore]);

  const formula = `avg(RevGr(${revScore}), EPSGr(${epsScore})) = ${score}`;

  return {
    score,
    weight: 0.15,
    inputs: {
      revenue_growth_ttm_yoy: revenueGrowth,
      eps_growth_ttm_yoy: epsGrowth,
    },
    formula,
    notes: `RevGr=${revenueGrowth ?? 'N/A'}%, EPSGr=${epsGrowth ?? 'N/A'}%${sectorMetrics ? '' : ' (no sector stats)'}`,
    sub_scores: {
      revenue_growth_score: revScore,
      eps_growth_score: epsScore,
    },
  };
}

// ===== EFFICIENCY SUB-SCORE (15%) =====

const EFFICIENCY_METRICS: MetricDef[] = [
  { key: 'assetTurnoverTTM', invert: false },
  { key: 'inventoryTurnoverTTM', invert: false },
];

function scoreEfficiency(input: ConvergenceInput): EfficiencyTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};
  const sectorMetrics = getSectorMetrics(input);

  const assetTurnover = getMetric(metric, 'assetTurnoverTTM');
  const inventoryTurnover = getMetric(metric, 'inventoryTurnoverTTM');

  const atScore = zScore(assetTurnover, EFFICIENCY_METRICS[0], sectorMetrics);
  const itScore = zScore(inventoryTurnover, EFFICIENCY_METRICS[1], sectorMetrics);

  const score = avgScore([atScore, itScore]);

  const formula = `avg(AT(${atScore}), IT(${itScore})) = ${score}`;

  return {
    score,
    weight: 0.15,
    inputs: {
      asset_turnover_ttm: assetTurnover,
      inventory_turnover_ttm: inventoryTurnover,
    },
    formula,
    notes: `AT=${assetTurnover ?? 'N/A'}, IT=${inventoryTurnover ?? 'N/A'}${sectorMetrics ? '' : ' (no sector stats)'}`,
    sub_scores: {
      asset_turnover_score: atScore,
      inventory_turnover_score: itScore,
    },
  };
}

// ===== MAIN QUALITY GATE SCORER =====

export function scoreQualityGate(input: ConvergenceInput): QualityGateResult {
  const safety = scoreSafety(input);
  const profitability = scoreProfitability(input);
  const growth = scoreGrowth(input);
  const efficiency = scoreEfficiency(input);

  const score = round(
    safety.weight * safety.score +
    profitability.weight * profitability.score +
    growth.weight * growth.score +
    efficiency.weight * efficiency.score,
    1,
  );

  return {
    score,
    breakdown: {
      safety,
      profitability,
      growth,
      efficiency,
    },
  };
}
