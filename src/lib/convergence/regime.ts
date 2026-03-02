import type { ConvergenceInput, RegimeResult, DataConfidence } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x / 10));
}

// Baselines derived from FRED series medians 1990-2024. Review annually.
// Hamilton (1989): regime detection should use data-estimated thresholds.
// EIB (2019): fixed thresholds unlikely to anticipate structural breaks.
// Rate-of-change note: GDP, NFP, CPI are already rate-of-change indicators.
// Unemployment, sentiment, fed funds, 10Y are levels — rate-of-change for
// these would require historical FRED storage (not yet implemented).
const MACRO_BASELINES = {
  gdp_growth:         { median: 2.5,   spread: 2.0 },   // QoQ annualized %
  unemployment:       { median: 5.0,   spread: 1.5 },   // Unemployment rate %
  nfp:                { median: 150,   spread: 150 },    // Monthly change (thousands)
  consumer_sentiment: { median: 85,    spread: 15 },     // U of Michigan index
  cpi_yoy:            { median: 2.5,   spread: 1.5 },   // CPI YoY %
  cpi_mom:            { median: 0.2,   spread: 0.3 },   // CPI MoM % (~2.4% ann.)
  fed_funds:          { median: 3.0,   spread: 2.5 },   // Fed Funds rate %
  treasury_10y:       { median: 3.5,   spread: 1.5 },   // 10Y yield %
};

// ===== STEP A — NORMALIZE MACRO INDICATORS TO 0-100 =====
// Each indicator scored relative to its long-run median via sigmoid.
// At median → 50. Above → >50. Below → <50.
// spread ≈ 1 std dev of the series; controls sensitivity.
// invert=true for indicators where lower is better (e.g., unemployment).

function baselineScore(value: number, median: number, spread: number, invert = false): number {
  const deviation = (value - median) / spread;
  const oriented = invert ? -deviation : deviation;
  return round(clamp(100 / (1 + Math.exp(-oriented)), 0, 100), 1);
}

// GDP growth (%): Higher = stronger economy. Baseline 2.5%.
function normalizeGdp(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.gdp_growth;
  return baselineScore(v, b.median, b.spread);
}

// Unemployment (%): INVERTED — lower = better. Baseline 5.0%.
function normalizeUnemployment(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.unemployment;
  return baselineScore(v, b.median, b.spread, true);
}

// Non-farm payrolls (thousands/month): Higher = better. Baseline 150K.
function normalizeNfp(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.nfp;
  return baselineScore(v, b.median, b.spread);
}

// Consumer Confidence (U of Michigan): Higher = better. Baseline 85.
function normalizeConsumerConfidence(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.consumer_sentiment;
  return baselineScore(v, b.median, b.spread);
}

// CPI YoY (%): Higher = more inflation. Baseline 2.5%.
function normalizeCpiYoy(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.cpi_yoy;
  return baselineScore(v, b.median, b.spread);
}

// CPI MoM (%): Higher = more inflation. Baseline 0.2%.
function normalizeCpiMom(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.cpi_mom;
  return baselineScore(v, b.median, b.spread);
}

// Fed Funds Rate (%): Higher = tighter / more inflationary signal. Baseline 3.0%.
function normalizeFedFunds(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.fed_funds;
  return baselineScore(v, b.median, b.spread);
}

// 10Y Treasury Yield (%): Higher = more inflation signal. Baseline 3.5%.
function normalizeTreasury10y(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.treasury_10y;
  return baselineScore(v, b.median, b.spread);
}

// ===== STEP A — COMPOSITE GROWTH & INFLATION SIGNALS =====

interface SignalResult {
  score: number;
  sub_scores: Record<string, number>;
}

function computeGrowthSignal(input: ConvergenceInput): SignalResult {
  const m = input.fredMacro;
  const gdpScore = normalizeGdp(m.gdp);
  const unempScore = normalizeUnemployment(m.unemployment);
  const nfpScore = normalizeNfp(m.nonfarmPayrolls);
  const ccScore = normalizeConsumerConfidence(m.consumerConfidence);

  const score = round(
    0.30 * gdpScore + 0.25 * unempScore + 0.25 * nfpScore + 0.20 * ccScore,
    1,
  );

  return {
    score,
    sub_scores: {
      gdp_score: gdpScore,
      unemployment_score: unempScore,
      nfp_score: nfpScore,
      consumer_confidence_score: ccScore,
    },
  };
}

function computeInflationSignal(input: ConvergenceInput): SignalResult {
  const m = input.fredMacro;
  const cpiYoyScore = normalizeCpiYoy(m.cpi);
  const cpiMomScore = normalizeCpiMom(m.cpiMom ?? null);
  const fedFundsScore = normalizeFedFunds(m.fedFunds);
  const t10yScore = normalizeTreasury10y(m.treasury10y);

  const score = round(
    0.40 * cpiYoyScore + 0.30 * cpiMomScore + 0.15 * fedFundsScore + 0.15 * t10yScore,
    1,
  );

  return {
    score,
    sub_scores: {
      cpi_yoy_score: cpiYoyScore,
      cpi_mom_score: cpiMomScore,
      fed_funds_score: fedFundsScore,
      treasury_10y_score: t10yScore,
    },
  };
}

// ===== STEP B — REGIME CLASSIFICATION (SIGMOID) =====

interface RegimeClassification {
  probabilities: { goldilocks: number; reflation: number; stagflation: number; deflation: number };
  dominant: string;
}

function classifyRegime(growth: number, inflation: number): RegimeClassification {
  // Inflection at 50 = long-run baseline (was fixed 60/40).
  // Above baseline → "high" branch, below → "low" branch.
  // At exactly baseline, all 4 regimes get equal probability (0.25).
  const rawGold = sigmoid(growth - 50) * sigmoid(50 - inflation);
  const rawRefl = sigmoid(growth - 50) * sigmoid(inflation - 50);
  const rawStag = sigmoid(50 - growth) * sigmoid(inflation - 50);
  const rawDefl = sigmoid(50 - growth) * sigmoid(50 - inflation);

  const total = rawGold + rawRefl + rawStag + rawDefl;

  const probabilities = {
    goldilocks: round(rawGold / total, 4),
    reflation: round(rawRefl / total, 4),
    stagflation: round(rawStag / total, 4),
    deflation: round(rawDefl / total, 4),
  };

  // Pick dominant regime (highest probability)
  const entries = Object.entries(probabilities) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const dominant = entries[0][0].toUpperCase();

  return { probabilities, dominant };
}

// ===== STEP C — STRATEGY-REGIME SCORING MATRIX =====

const STRATEGIES = [
  'Iron Condor',
  'Short Put Spread',
  'Short Call Spread',
  'Long Call Spread',
  'Long Put Spread',
  'Short Straddle',
  'Short Strangle',
  'Covered Call',
  'Cash Secured Put',
  'Calendar Spread',
] as const;

type Strategy = (typeof STRATEGIES)[number];

// [Goldilocks, Reflation, Stagflation, Deflation]
const STRATEGY_REGIME_MATRIX: Record<Strategy, [number, number, number, number]> = {
  'Iron Condor':       [90, 60, 30, 70],
  'Short Put Spread':  [85, 70, 25, 50],
  'Short Call Spread': [40, 30, 75, 85],
  'Long Call Spread':  [85, 75, 20, 35],
  'Long Put Spread':   [30, 25, 80, 75],
  'Short Straddle':    [85, 55, 25, 65],
  'Short Strangle':    [90, 60, 30, 70],
  'Covered Call':      [70, 60, 50, 60],
  'Cash Secured Put':  [80, 65, 30, 45],
  'Calendar Spread':   [75, 65, 45, 55],
};

// ===== STEP D — VIX OVERLAY CLASSIFICATION =====

const SHORT_VOL_STRATEGIES: ReadonlySet<string> = new Set([
  'Iron Condor', 'Short Put Spread', 'Short Call Spread',
  'Short Straddle', 'Short Strangle', 'Covered Call', 'Cash Secured Put',
]);

const LONG_VOL_STRATEGIES: ReadonlySet<string> = new Set([
  'Long Call Spread', 'Long Put Spread', 'Calendar Spread',
]);

interface StrategyScoreResult {
  strategy: string;
  raw_score: number;
  vix_adjustment: number;
  final_score: number;
}

function scoreStrategies(
  probabilities: { goldilocks: number; reflation: number; stagflation: number; deflation: number },
  vix: number | null,
): { scores: StrategyScoreResult[]; adjustmentType: string } {
  // VIX overlay adjustments
  let adjustmentType = 'NEUTRAL';
  let shortVolAdj = 0;
  let longVolAdj = 0;

  if (vix !== null) {
    // Bansal & Stivers 2023: VIX 80th percentile ≈ 23-25; most excess short-vol
    // returns earned above this level. VIX >30 only ~5-8% of the time; >24 ≈ 15-20%.
    if (vix > 24) {
      adjustmentType = 'ELEVATED_VOL';
      shortVolAdj = 10;
      longVolAdj = -5;
    } else if (vix < 15) {
      adjustmentType = 'COMPLACENT';
      shortVolAdj = -5;
      longVolAdj = 5;
    }
  }

  const scores: StrategyScoreResult[] = STRATEGIES.map((strategy) => {
    const m = STRATEGY_REGIME_MATRIX[strategy];
    const rawScore = round(
      probabilities.goldilocks * m[0] +
      probabilities.reflation * m[1] +
      probabilities.stagflation * m[2] +
      probabilities.deflation * m[3],
      1,
    );

    let adj = 0;
    if (SHORT_VOL_STRATEGIES.has(strategy)) adj = shortVolAdj;
    else if (LONG_VOL_STRATEGIES.has(strategy)) adj = longVolAdj;

    return {
      strategy,
      raw_score: rawScore,
      vix_adjustment: adj,
      final_score: clamp(round(rawScore + adj, 1), 0, 100),
    };
  });

  // Sort descending by final_score
  scores.sort((a, b) => b.final_score - a.final_score);

  return { scores, adjustmentType };
}

// ===== MAIN REGIME SCORER =====

export function scoreRegime(input: ConvergenceInput): RegimeResult {
  const macro = input.fredMacro;

  // Step A: Growth & Inflation signals
  const growth = computeGrowthSignal(input);
  const inflation = computeInflationSignal(input);

  // Step B: Regime classification
  const { probabilities, dominant } = classifyRegime(growth.score, inflation.score);

  // Steps C + D: Strategy scoring with VIX overlay
  const { scores: strategyScores, adjustmentType } = scoreStrategies(probabilities, macro.vix);

  // Step E: Best strategy's final_score is the base regime score
  const best = strategyScores[0];
  const baseScore = best.final_score;

  // Step F: SPY correlation modifier — scales regime influence per-ticker
  // Longin & Solnik 2001: correlations rise in bear markets, but we use a static
  // floor here. Uncorrelated stocks should get minimal regime effect (10%), not 50%.
  // Negative correlations are floored at 10% — inverted signals are Phase 4.
  // corrSpy = 1.0 → multiplier = 1.0 (full regime signal)
  // corrSpy = 0.5 → multiplier = 0.55 (moderate regime effect)
  // corrSpy = 0.0 → multiplier = 0.10 (minimal regime effect)
  // corrSpy < 0  → multiplier = 0.10 (floored)
  // TODO Phase 4: handle negative correlations with inverted regime signals
  const corrSpy = input.ttScanner?.corrSpy ?? null;
  let score: number;
  let multiplier: number;
  let modifierNote: string;

  if (corrSpy != null) {
    multiplier = round(0.1 + 0.9 * Math.max(0, corrSpy), 4);
    score = round(baseScore * multiplier, 1);
    modifierNote = `corrSpy=${corrSpy} → multiplier=${multiplier} → ${baseScore} * ${multiplier} = ${score}`;
  } else {
    multiplier = 1.0;
    score = baseScore;
    modifierNote = 'spy_correlation: not_available — using base regime score unmodified';
  }

  // Build DataConfidence — track which macro fields are imputed (null → default 50)
  const imputedFields: string[] = [];
  if (macro.gdp === null) imputedFields.push('growth.gdp');
  if (macro.unemployment === null) imputedFields.push('growth.unemployment');
  if (macro.nonfarmPayrolls === null) imputedFields.push('growth.nfp');
  if (macro.consumerConfidence === null) imputedFields.push('growth.consumer_confidence');
  if (macro.cpi === null) imputedFields.push('inflation.cpi_yoy');
  if ((macro.cpiMom ?? null) === null) imputedFields.push('inflation.cpi_mom');
  if (macro.fedFunds === null) imputedFields.push('inflation.fed_funds');
  if (macro.treasury10y === null) imputedFields.push('inflation.treasury_10y');
  const totalSubScores = 8; // 4 growth + 4 inflation
  const dataConfidence: DataConfidence = {
    total_sub_scores: totalSubScores,
    imputed_sub_scores: imputedFields.length,
    confidence: round(1 - imputedFields.length / totalSubScores, 4),
    imputed_fields: imputedFields,
  };

  return {
    score,
    data_confidence: dataConfidence,
    breakdown: {
      growth_signal: {
        score: growth.score,
        sub_scores: {
          gdp_score: growth.sub_scores.gdp_score,
          unemployment_score: growth.sub_scores.unemployment_score,
          nfp_score: growth.sub_scores.nfp_score,
          consumer_confidence_score: growth.sub_scores.consumer_confidence_score,
        },
        raw_values: {
          gdp: macro.gdp,
          unemployment: macro.unemployment,
          nfp: macro.nonfarmPayrolls,
          consumer_confidence: macro.consumerConfidence,
        },
      },
      inflation_signal: {
        score: inflation.score,
        sub_scores: {
          cpi_yoy_score: inflation.sub_scores.cpi_yoy_score,
          cpi_mom_score: inflation.sub_scores.cpi_mom_score,
          fed_funds_score: inflation.sub_scores.fed_funds_score,
          treasury_10y_score: inflation.sub_scores.treasury_10y_score,
        },
        raw_values: {
          cpi_yoy: macro.cpi,
          cpi_mom: macro.cpiMom,
          fed_funds: macro.fedFunds,
          treasury_10y: macro.treasury10y,
        },
      },
      regime_probabilities: probabilities,
      dominant_regime: dominant,
      vix_overlay: {
        vix: macro.vix,
        adjustment_type: adjustmentType,
      },
      strategy_scores: strategyScores,
      best_strategy: best.strategy,
      spy_correlation_modifier: {
        corr_spy: corrSpy,
        multiplier,
        base_regime_score: baseScore,
        adjusted_regime_score: score,
        formula: 'adjusted_regime = base_regime * (0.1 + 0.9 * max(0, corrSpy))',
        note: modifierNote,
      },
    },
  };
}
