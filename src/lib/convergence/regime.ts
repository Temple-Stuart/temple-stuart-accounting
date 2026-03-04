import type { ConvergenceInput, RegimeResult, DataConfidence, CrossAssetCorrelations } from './types';

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
  // New institutional-grade baselines
  icsa:               { median: 225,   spread: 50 },     // Initial claims (thousands) — INVERTED (lower = better)
  nfci:               { median: -0.5,  spread: 0.5 },    // NFCI: negative = loose (bullish), positive = tight (bearish) — INVERTED
  breakeven_5y:       { median: 2.0,   spread: 0.75 },   // T5YIE: deviation from 2% Fed target
  yield_curve:        { median: 1.0,   spread: 1.5 },    // T10Y2Y: positive = normal, negative = inverted
  hy_spread:          { median: 4.0,   spread: 2.0 },    // BAMLH0A0HYM2: HY credit spread %
};

// ===== STALENESS DETECTION =====
const STALE_THRESHOLD_DAYS = 14;

function isStale(dateStr: string | null): boolean {
  if (!dateStr) return false; // can't determine — don't flag
  const obsDate = new Date(dateStr + 'T00:00:00Z').getTime();
  const now = Date.now();
  return (now - obsDate) / 86400000 > STALE_THRESHOLD_DAYS;
}

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

// Initial Jobless Claims (thousands): INVERTED — lower = better. Baseline 225K.
// Rising claims (above trailing average) = bearish labor signal.
function normalizeIcsa(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.icsa;
  return baselineScore(v, b.median, b.spread, true);
}

// NFCI: INVERTED — negative values = loose conditions (bullish), positive = tight (bearish).
// Zero = neutral. Positive values signal tightening financial conditions.
function normalizeNfci(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.nfci;
  return baselineScore(v, b.median, b.spread, true);
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

// 5-Year Breakeven Inflation (%): Score as deviation from 2.0% Fed target.
// > 3.0% → elevated inflation expectations. < 1.5% → deflation risk. 2.0-2.5% → neutral.
function normalizeBreakeven5y(v: number | null): number {
  if (v === null) return 50;
  const b = MACRO_BASELINES.breakeven_5y;
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
  const icsaScore = normalizeIcsa(m.initialClaims);
  const nfciScore = normalizeNfci(m.nfci);

  // Reweighted: original 4 indicators + 2 new ones
  // GDP 0.25, Unemployment 0.20, NFP 0.20, Consumer Confidence 0.15, ICSA 0.10, NFCI 0.10
  const score = round(
    0.25 * gdpScore + 0.20 * unempScore + 0.20 * nfpScore +
    0.15 * ccScore + 0.10 * icsaScore + 0.10 * nfciScore,
    1,
  );

  return {
    score,
    sub_scores: {
      gdp_score: gdpScore,
      unemployment_score: unempScore,
      nfp_score: nfpScore,
      consumer_confidence_score: ccScore,
      icsa_score: icsaScore,
      nfci_score: nfciScore,
    },
  };
}

function computeInflationSignal(input: ConvergenceInput): SignalResult {
  const m = input.fredMacro;
  const cpiYoyScore = normalizeCpiYoy(m.cpi);
  const cpiMomScore = normalizeCpiMom(m.cpiMom ?? null);
  const fedFundsScore = normalizeFedFunds(m.fedFunds);
  const t10yScore = normalizeTreasury10y(m.treasury10y);
  const breakeven5yScore = normalizeBreakeven5y(m.breakeven5y);

  // Reweighted: original 4 + breakeven5y
  // CPI YoY 0.30, CPI MoM 0.20, Fed Funds 0.15, Treasury 10Y 0.15, Breakeven 5Y 0.20
  const score = round(
    0.30 * cpiYoyScore + 0.20 * cpiMomScore + 0.15 * fedFundsScore +
    0.15 * t10yScore + 0.20 * breakeven5yScore,
    1,
  );

  return {
    score,
    sub_scores: {
      cpi_yoy_score: cpiYoyScore,
      cpi_mom_score: cpiMomScore,
      fed_funds_score: fedFundsScore,
      treasury_10y_score: t10yScore,
      breakeven_5y_score: breakeven5yScore,
    },
  };
}

// ===== STEP B — REGIME CLASSIFICATION (SIGMOID + STRESS SIGNALS) =====

interface RegimeClassification {
  probabilities: { goldilocks: number; reflation: number; stagflation: number; deflation: number };
  dominant: string;
}

function classifyRegime(
  growth: number,
  inflation: number,
  yieldCurveSpread: number | null,
  hySpread: number | null,
): RegimeClassification {
  // Inflection at 50 = long-run baseline (was fixed 60/40).
  // Above baseline → "high" branch, below → "low" branch.
  // At exactly baseline, all 4 regimes get equal probability (0.25).
  let rawGold = sigmoid(growth - 50) * sigmoid(50 - inflation);
  let rawRefl = sigmoid(growth - 50) * sigmoid(inflation - 50);
  let rawStag = sigmoid(50 - growth) * sigmoid(inflation - 50);
  let rawDefl = sigmoid(50 - growth) * sigmoid(50 - inflation);

  // T10Y2Y modifier: yield curve inversion is a strong recession signal
  // When inverted (< 0), boost contraction regimes (stagflation, deflation)
  if (yieldCurveSpread !== null && yieldCurveSpread < 0) {
    // Inversion strength: -0.5 → moderate, -1.0+ → strong
    const inversionFactor = 1 + clamp(Math.abs(yieldCurveSpread) * 0.3, 0, 0.5);
    rawStag *= inversionFactor;
    rawDefl *= inversionFactor;
    rawGold /= inversionFactor;
  }

  // BAMLH0A0HYM2 modifier: elevated HY spreads signal credit stress
  // > 5.0% → elevated → boost contraction regimes
  // > 8.0% → crisis levels → strong boost
  if (hySpread !== null && hySpread > 5.0) {
    const stressFactor = hySpread > 8.0
      ? 1.4  // crisis
      : 1 + (hySpread - 5.0) / 7.5;  // gradual: 5% → 1.0, 8% → 1.4
    rawStag *= stressFactor;
    rawDefl *= stressFactor;
    rawGold /= stressFactor;
    rawRefl /= stressFactor;
  }

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
// Calibrated per CBOE index evidence (PUT, BXM, iron butterfly benchmarks)
// and MSCI 2022 regime-dependent premium-selling returns.
// Key insight: stagflation scores increased for premium sellers — elevated IV
// provides edge when managed with appropriate position sizing. The VIX overlay
// (Step D) already handles extreme fear (VIX >24) with separate adjustments.
// Direction of adjustments matters more than exact values — validate in Phase 5.
const STRATEGY_REGIME_MATRIX: Record<Strategy, [number, number, number, number]> = {
  // Iron Condor: range-bound best; trending hurts. Stag 30→50: elevated premium compensates
  'Iron Condor':       [85, 55, 50, 45],
  // Short Put Spread: CBOE PUT outperforms in moderate stress. Gold 85→70: low premium
  'Short Put Spread':  [70, 75, 45, 40],
  // Short Call Spread: bearish bias; stag/defl less extreme than intuition
  'Short Call Spread': [40, 30, 65, 75],
  // Long Call Spread: refl best (strong trend); stag/defl poor (no premium income)
  'Long Call Spread':  [80, 80, 20, 30],
  // Long Put Spread: hedging vehicle; defl best, gold/refl worst
  'Long Put Spread':   [25, 20, 75, 80],
  // Short Straddle: highest vega risk; stag 25→45: premium compensates but gap risk
  'Short Straddle':    [80, 50, 45, 40],
  // Short Strangle: similar to iron condor profile. Stag 30→50: elevated premium
  'Short Strangle':    [85, 55, 50, 45],
  // Covered Call: CBOE BXM underperforms in bull (capped). Refl 60→70: premium + trend
  'Covered Call':      [65, 70, 55, 50],
  // Cash Secured Put: CBOE PUT index evidence — premium income in moderate stress
  'Cash Secured Put':  [75, 65, 50, 45],
  // Calendar Spread: needs contango; refl vol expansion hurts, stag backwardation hurts
  'Calendar Spread':   [70, 60, 40, 55],
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

// ===== CROSS-ASSET CORRELATION MODIFIER (Bridgewater All Weather / AQR) =====
// Adjusts regime probabilities ±10% based on cross-asset correlation cluster.
// cluster → which regime probabilities to boost/reduce.
// Magnitude scales with cluster confidence.

const MAX_CORR_ADJUSTMENT = 0.10; // ±10% max probability adjustment

interface CorrProbabilityAdjustment {
  goldilocks: number;
  reflation: number;
  stagflation: number;
  deflation: number;
  note: string;
}

function computeCrossAssetProbabilityAdjustment(
  corr: CrossAssetCorrelations | null,
): CorrProbabilityAdjustment {
  const zero = { goldilocks: 0, reflation: 0, stagflation: 0, deflation: 0 };

  if (!corr) {
    return { ...zero, note: 'cross_asset_correlations: not available' };
  }

  const confidence = corr.cluster_confidence;
  const magnitude = MAX_CORR_ADJUSTMENT * confidence;

  // Cluster → probability adjustments (sum to 0)
  // risk_on: boost goldilocks + reflation, reduce stagflation + deflation
  // risk_off: boost deflation + stagflation, reduce goldilocks + reflation
  // inflation: boost reflation + stagflation, reduce goldilocks + deflation
  // deflation: boost deflation, reduce reflation + stagflation
  // transition: no adjustment
  let adj: typeof zero;
  switch (corr.cluster) {
    case 'risk_on':
      adj = {
        goldilocks: magnitude * 0.6,
        reflation: magnitude * 0.4,
        stagflation: -magnitude * 0.4,
        deflation: -magnitude * 0.6,
      };
      break;
    case 'risk_off':
      adj = {
        goldilocks: -magnitude * 0.5,
        reflation: -magnitude * 0.5,
        stagflation: magnitude * 0.4,
        deflation: magnitude * 0.6,
      };
      break;
    case 'inflation':
      adj = {
        goldilocks: -magnitude * 0.3,
        reflation: magnitude * 0.5,
        stagflation: magnitude * 0.5,
        deflation: -magnitude * 0.7,
      };
      break;
    case 'deflation':
      adj = {
        goldilocks: -magnitude * 0.3,
        reflation: -magnitude * 0.4,
        stagflation: -magnitude * 0.3,
        deflation: magnitude * 1.0,
      };
      break;
    case 'transition':
    default:
      adj = { ...zero };
      break;
  }

  // Add regime shift boost: if 60d vs 252d divergence is large, amplify the adjustment
  // (correlation regime is changing — lean into the new signal)
  if (corr.regime_shift_detected && corr.cluster !== 'transition') {
    const shiftBoost = 1 + Math.min(0.5, corr.regime_shift_magnitude);
    adj.goldilocks *= shiftBoost;
    adj.reflation *= shiftBoost;
    adj.stagflation *= shiftBoost;
    adj.deflation *= shiftBoost;
  }

  return {
    ...adj,
    note: `cluster=${corr.cluster}, confidence=${confidence}, magnitude=${round(magnitude, 4)}${corr.regime_shift_detected ? ', regime_shift_amplified' : ''}`,
  };
}

// ===== MAIN REGIME SCORER =====

export function scoreRegime(input: ConvergenceInput): RegimeResult {
  const macro = input.fredMacro;

  // Step A: Growth & Inflation signals
  const growth = computeGrowthSignal(input);
  const inflation = computeInflationSignal(input);

  // Step B: Regime classification (with yield curve + credit stress modifiers)
  const { probabilities, dominant } = classifyRegime(
    growth.score,
    inflation.score,
    macro.yieldCurveSpread,
    macro.hySpread,
  );

  // Regime stress signals for trace output
  const yieldCurveInverted = macro.yieldCurveSpread !== null && macro.yieldCurveSpread < 0;
  const hyStressLevel: 'normal' | 'elevated' | 'crisis' | null =
    macro.hySpread === null ? null
      : macro.hySpread > 8.0 ? 'crisis'
      : macro.hySpread > 5.0 ? 'elevated'
      : 'normal';

  // Step B2: Cross-asset correlation modifier (±10% on regime probabilities)
  const corrAdj = computeCrossAssetProbabilityAdjustment(input.crossAssetCorrelations);
  const adjustedProbabilities = { ...probabilities };

  if (input.crossAssetCorrelations && input.crossAssetCorrelations.cluster !== 'transition') {
    adjustedProbabilities.goldilocks = Math.max(0, probabilities.goldilocks + corrAdj.goldilocks);
    adjustedProbabilities.reflation = Math.max(0, probabilities.reflation + corrAdj.reflation);
    adjustedProbabilities.stagflation = Math.max(0, probabilities.stagflation + corrAdj.stagflation);
    adjustedProbabilities.deflation = Math.max(0, probabilities.deflation + corrAdj.deflation);

    // Re-normalize to sum to 1.0
    const adjSum = adjustedProbabilities.goldilocks + adjustedProbabilities.reflation +
      adjustedProbabilities.stagflation + adjustedProbabilities.deflation;
    if (adjSum > 0) {
      adjustedProbabilities.goldilocks = round(adjustedProbabilities.goldilocks / adjSum, 4);
      adjustedProbabilities.reflation = round(adjustedProbabilities.reflation / adjSum, 4);
      adjustedProbabilities.stagflation = round(adjustedProbabilities.stagflation / adjSum, 4);
      adjustedProbabilities.deflation = round(1 - adjustedProbabilities.goldilocks - adjustedProbabilities.reflation - adjustedProbabilities.stagflation, 4);
    }
  }

  // Steps C + D: Strategy scoring with VIX overlay (uses adjusted probabilities)
  const { scores: strategyScores, adjustmentType } = scoreStrategies(adjustedProbabilities, macro.vix);

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
  if (macro.initialClaims === null) imputedFields.push('growth.initial_claims');
  if (macro.nfci === null) imputedFields.push('growth.nfci');
  if (macro.cpi === null) imputedFields.push('inflation.cpi_yoy');
  if ((macro.cpiMom ?? null) === null) imputedFields.push('inflation.cpi_mom');
  if (macro.fedFunds === null) imputedFields.push('inflation.fed_funds');
  if (macro.treasury10y === null) imputedFields.push('inflation.treasury_10y');
  if (macro.breakeven5y === null) imputedFields.push('inflation.breakeven_5y');
  // Regime signals (not scored directly but tracked for completeness)
  if (macro.yieldCurveSpread === null) imputedFields.push('regime.yield_curve_spread');
  if (macro.hySpread === null) imputedFields.push('regime.hy_spread');
  if (!input.crossAssetCorrelations) imputedFields.push('regime.cross_asset_correlations');
  const totalSubScores = 14; // 6 growth + 5 inflation + 2 regime signals + 1 cross-asset
  const dataConfidence: DataConfidence = {
    total_sub_scores: totalSubScores,
    imputed_sub_scores: imputedFields.length,
    confidence: round(1 - imputedFields.length / totalSubScores, 4),
    imputed_fields: imputedFields,
  };

  // Staleness flags for weekly series
  const staleFlags: string[] = [];
  if (isStale(macro.initialClaimsDate)) staleFlags.push(`ICSA stale (last obs: ${macro.initialClaimsDate})`);
  if (isStale(macro.nfciDate)) staleFlags.push(`NFCI stale (last obs: ${macro.nfciDate})`);

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
          icsa_score: growth.sub_scores.icsa_score,
          nfci_score: growth.sub_scores.nfci_score,
        },
        raw_values: {
          gdp: macro.gdp,
          unemployment: macro.unemployment,
          nfp: macro.nonfarmPayrolls,
          consumer_confidence: macro.consumerConfidence,
          initial_claims: macro.initialClaims,
          nfci: macro.nfci,
        },
        stale_flags: staleFlags.length > 0 ? staleFlags : undefined,
      },
      inflation_signal: {
        score: inflation.score,
        sub_scores: {
          cpi_yoy_score: inflation.sub_scores.cpi_yoy_score,
          cpi_mom_score: inflation.sub_scores.cpi_mom_score,
          fed_funds_score: inflation.sub_scores.fed_funds_score,
          treasury_10y_score: inflation.sub_scores.treasury_10y_score,
          breakeven_5y_score: inflation.sub_scores.breakeven_5y_score,
        },
        raw_values: {
          cpi_yoy: macro.cpi,
          cpi_mom: macro.cpiMom,
          fed_funds: macro.fedFunds,
          treasury_10y: macro.treasury10y,
          breakeven_5y: macro.breakeven5y,
        },
      },
      regime_probabilities: probabilities,
      dominant_regime: dominant,
      regime_signals: {
        yield_curve_spread: macro.yieldCurveSpread,
        yield_curve_inverted: yieldCurveInverted,
        hy_spread: macro.hySpread,
        hy_stress_level: hyStressLevel,
      },
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
      cross_asset_correlations: input.crossAssetCorrelations ? {
        correlations: input.crossAssetCorrelations,
        probability_adjustment: {
          goldilocks: round(corrAdj.goldilocks, 4),
          reflation: round(corrAdj.reflation, 4),
          stagflation: round(corrAdj.stagflation, 4),
          deflation: round(corrAdj.deflation, 4),
        },
        note: corrAdj.note,
      } : undefined,
    },
  };
}
