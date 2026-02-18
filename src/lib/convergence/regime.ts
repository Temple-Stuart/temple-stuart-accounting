import type { ConvergenceInput, RegimeResult } from './types';

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

// ===== STEP A — NORMALIZE MACRO INDICATORS TO 0-100 =====

// GDP growth (%): Range -2% to 6%. Higher = stronger economy.
function normalizeGdp(v: number | null): number {
  if (v === null) return 50;
  return round(clamp((v + 2) * (100 / 8), 0, 100), 1);
}

// Unemployment (%): Range 3% to 10%. INVERTED — lower = better.
function normalizeUnemployment(v: number | null): number {
  if (v === null) return 50;
  return round(clamp((10 - v) * (100 / 7), 0, 100), 1);
}

// Non-farm payrolls (thousands/month): Range -200K to 500K. Higher = better.
function normalizeNfp(v: number | null): number {
  if (v === null) return 50;
  return round(clamp((v + 200) * (100 / 700), 0, 100), 1);
}

// Consumer Confidence Index: Range 60 to 140. Higher = better.
function normalizeConsumerConfidence(v: number | null): number {
  if (v === null) return 50;
  return round(clamp((v - 60) * (100 / 80), 0, 100), 1);
}

// CPI YoY (%): Range 0% to 10%. Higher = more inflation.
function normalizeCpiYoy(v: number | null): number {
  if (v === null) return 50;
  return round(clamp(v * 10, 0, 100), 1);
}

// CPI MoM (%): Range -0.5% to 1.0%. Higher = more inflation.
function normalizeCpiMom(v: number | null): number {
  if (v === null) return 50;
  return round(clamp((v + 0.5) * (100 / 1.5), 0, 100), 1);
}

// Fed Funds Rate (%): Range 0% to 8%. Higher = tighter / more inflationary signal.
function normalizeFedFunds(v: number | null): number {
  if (v === null) return 50;
  return round(clamp(v * (100 / 8), 0, 100), 1);
}

// 10Y Treasury Yield (%): Range 0% to 8%. Higher = more inflation signal.
function normalizeTreasury10y(v: number | null): number {
  if (v === null) return 50;
  return round(clamp(v * (100 / 8), 0, 100), 1);
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
  const rawGold = sigmoid(growth - 60) * sigmoid(40 - inflation);
  const rawRefl = sigmoid(growth - 60) * sigmoid(inflation - 60);
  const rawStag = sigmoid(40 - growth) * sigmoid(inflation - 60);
  const rawDefl = sigmoid(40 - growth) * sigmoid(40 - inflation);

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
    if (vix > 30) {
      adjustmentType = 'HIGH_FEAR';
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
  // corrSpy = 1.0 → multiplier = 1.0 (full regime signal)
  // corrSpy = 0.5 → multiplier = 0.75 (dampened)
  // corrSpy = 0.0 → multiplier = 0.5 (regime halved toward neutral)
  const corrSpy = input.ttScanner?.corrSpy ?? null;
  let score: number;
  let multiplier: number;
  let modifierNote: string;

  if (corrSpy != null) {
    multiplier = round(0.5 + 0.5 * corrSpy, 4);
    score = round(baseScore * multiplier, 1);
    modifierNote = `corrSpy=${corrSpy} → multiplier=${multiplier} → ${baseScore} * ${multiplier} = ${score}`;
  } else {
    multiplier = 1.0;
    score = baseScore;
    modifierNote = 'spy_correlation: not_available — using base regime score unmodified';
  }

  return {
    score,
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
        formula: 'adjusted_regime = base_regime * (0.5 + 0.5 * corrSpy)',
        note: modifierNote,
      },
    },
  };
}
