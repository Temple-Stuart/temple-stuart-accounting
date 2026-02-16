import type {
  ConvergenceInput,
  RegimeResult,
  MacroEnvironmentTrace,
  CorrelationContextTrace,
  VolatilityRegimeTrace,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== MACRO ENVIRONMENT SUB-SCORE (40%) =====

function scoreMacroEnvironment(input: ConvergenceInput): MacroEnvironmentTrace {
  const macro = input.fredMacro;

  // VIX score: "sweet spot" for premium selling is VIX 15-25
  const vix = macro.vix;
  let vixScore = 50;
  let vixRegime = 'UNKNOWN';
  if (vix !== null) {
    if (vix < 12) {
      vixRegime = 'COMPRESSED (VIX < 12)';
      vixScore = 30; // Low premiums, not great for selling
    } else if (vix < 16) {
      vixRegime = 'LOW (12-16)';
      vixScore = 50;
    } else if (vix < 20) {
      vixRegime = 'NORMAL (16-20)';
      vixScore = 70; // Sweet spot begins
    } else if (vix < 25) {
      vixRegime = 'ELEVATED (20-25)';
      vixScore = 85; // Optimal for premium selling
    } else if (vix < 30) {
      vixRegime = 'HIGH (25-30)';
      vixScore = 75; // Good but increasing risk
    } else if (vix < 40) {
      vixRegime = 'VERY_HIGH (30-40)';
      vixScore = 55; // Fat premiums but high risk
    } else {
      vixRegime = 'EXTREME (40+)';
      vixScore = 35; // Crisis — premium selling dangerous
    }
  }

  // Yield curve score: 10Y treasury level signals economic environment
  const t10y = macro.treasury10y;
  let yieldCurveScore = 50;
  if (t10y !== null) {
    // Normal range (2-5%) is stable for equity options
    if (t10y >= 2 && t10y <= 5) yieldCurveScore = 70;
    else if (t10y > 5) yieldCurveScore = 45; // High rates = equity pressure
    else if (t10y >= 0) yieldCurveScore = 55; // Low rates
    else yieldCurveScore = 35; // Negative rates = unusual regime
  }

  // Monetary policy score: Fed funds + SOFR
  const fedFunds = macro.fedFunds;
  const sofr = macro.sofr;
  let monetaryScore = 50;
  if (fedFunds !== null) {
    // Moderate rates (2-5%) = normal. Very high (>5.5%) = tightening pressure. Near-zero = ZIRP
    if (fedFunds >= 2 && fedFunds <= 4) monetaryScore = 70;
    else if (fedFunds < 2) monetaryScore = 60; // Easing, good for equities
    else if (fedFunds <= 5.5) monetaryScore = 55; // Tight but manageable
    else monetaryScore = 35; // Very tight
  }

  // Employment score: unemployment signals economic health
  const unemployment = macro.unemployment;
  let employmentScore = 50;
  if (unemployment !== null) {
    if (unemployment < 4) employmentScore = 75;     // Strong labor market
    else if (unemployment < 5) employmentScore = 65;
    else if (unemployment < 6) employmentScore = 50;
    else if (unemployment < 8) employmentScore = 35; // Weakening
    else employmentScore = 20;                        // Recessionary
  }

  // Weighted: VIX 40%, yield_curve 20%, monetary 20%, employment 20%
  const score = round(
    0.40 * vixScore + 0.20 * yieldCurveScore + 0.20 * monetaryScore + 0.20 * employmentScore, 1,
  );

  const formula = `0.40×VIX(${round(vixScore)}) + 0.20×Yield(${round(yieldCurveScore)}) + 0.20×Mon(${round(monetaryScore)}) + 0.20×Emp(${round(employmentScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.40,
    inputs: {
      vix: vix,
      treasury_10y: t10y,
      fed_funds: fedFunds,
      sofr: sofr,
      unemployment: unemployment,
      cpi: macro.cpi,
      gdp: macro.gdp,
      consumer_confidence: macro.consumerConfidence,
      nonfarm_payrolls: macro.nonfarmPayrolls,
    },
    formula,
    notes: `VIX regime: ${vixRegime}. Fed funds: ${fedFunds ?? 'N/A'}%. 10Y: ${t10y ?? 'N/A'}%. Unemployment: ${unemployment ?? 'N/A'}%`,
    sub_scores: {
      vix_score: round(vixScore),
      yield_curve_score: round(yieldCurveScore),
      monetary_score: round(monetaryScore),
      employment_score: round(employmentScore),
    },
    vix_regime: vixRegime,
  };
}

// ===== CORRELATION CONTEXT SUB-SCORE (30%) =====

function scoreCorrelationContext(input: ConvergenceInput): CorrelationContextTrace {
  const tt = input.ttScanner;
  const beta = tt?.beta ?? null;
  const corrSpy = tt?.corrSpy ?? null;

  // Beta score: moderate beta (0.5-1.5) = predictable, extreme = risky
  let betaScore = 50;
  if (beta !== null) {
    if (beta >= 0.8 && beta <= 1.2) betaScore = 75;     // Market-like, predictable
    else if (beta >= 0.5 && beta <= 1.5) betaScore = 65; // Moderate deviation
    else if (beta >= 0 && beta < 0.5) betaScore = 50;    // Low beta, independent
    else if (beta > 1.5 && beta <= 2.5) betaScore = 45;  // High beta, volatile
    else if (beta > 2.5) betaScore = 30;                  // Very high beta
    else betaScore = 35;                                   // Negative beta
  }

  // Correlation score: moderate correlation = more predictable for hedging
  let correlationScore = 50;
  if (corrSpy !== null) {
    const absCorrSpy = Math.abs(corrSpy);
    if (absCorrSpy > 0.7) correlationScore = 70;     // High correlation = predictable
    else if (absCorrSpy > 0.4) correlationScore = 65; // Moderate
    else if (absCorrSpy > 0.2) correlationScore = 55; // Low — idiosyncratic
    else correlationScore = 45;                         // Very low — hard to hedge
  }

  // Diversification value: low correlation + low beta = good portfolio diversifier
  let diversificationValue = 50;
  if (beta !== null && corrSpy !== null) {
    const absCorrSpy = Math.abs(corrSpy);
    if (absCorrSpy < 0.3 && Math.abs(beta) < 0.5) diversificationValue = 80;
    else if (absCorrSpy < 0.5 && Math.abs(beta) < 1.0) diversificationValue = 65;
    else diversificationValue = 50;
  }

  // Weighted: beta 40%, correlation 40%, diversification 20%
  const score = round(0.40 * betaScore + 0.40 * correlationScore + 0.20 * diversificationValue, 1);

  const formula = `0.40×Beta(${round(betaScore)}) + 0.40×Corr(${round(correlationScore)}) + 0.20×Div(${round(diversificationValue)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      beta: beta,
      corr_spy_3m: corrSpy,
    },
    formula,
    notes: `Beta=${beta ?? 'N/A'}, SPY corr=${corrSpy ?? 'N/A'}`,
    sub_scores: {
      beta_score: round(betaScore),
      correlation_score: round(correlationScore),
      diversification_value: round(diversificationValue),
    },
  };
}

// ===== VOLATILITY REGIME SUB-SCORE (30%) =====

function scoreVolatilityRegime(input: ConvergenceInput): VolatilityRegimeTrace {
  const tt = input.ttScanner;
  const macro = input.fredMacro;

  const vix = macro.vix;
  const iv30 = tt?.iv30 ?? null;
  const hv30 = tt?.hv30 ?? null;
  let ivp = tt?.ivPercentile ?? null;
  // TastyTrade returns IVP as decimal (0.693 = 69.3%); normalize to 0-100 scale
  if (ivp !== null && ivp <= 1.0) ivp = round(ivp * 100, 1);

  // VIX level score (same logic as macro but for vol regime context)
  let vixLevelScore = 50;
  let regimeClassification = 'UNKNOWN';
  if (vix !== null) {
    if (vix < 15) {
      vixLevelScore = 40;
      regimeClassification = 'LOW_VOL';
    } else if (vix < 20) {
      vixLevelScore = 70;
      regimeClassification = 'NORMAL_VOL';
    } else if (vix < 30) {
      vixLevelScore = 80;
      regimeClassification = 'ELEVATED_VOL';
    } else {
      vixLevelScore = 50;
      regimeClassification = 'CRISIS_VOL';
    }
  }

  // IV regime: is this stock's IV aligned with market regime?
  let ivRegimeScore = 50;
  if (ivp !== null && vix !== null) {
    // If stock IVP is elevated AND VIX is elevated → regime alignment = good for selling
    if (ivp > 60 && vix > 18) ivRegimeScore = 80;
    else if (ivp > 60) ivRegimeScore = 65;
    else if (ivp < 30 && vix < 15) ivRegimeScore = 35; // Both low = compressed
    else ivRegimeScore = 55;
  } else if (ivp !== null) {
    ivRegimeScore = ivp > 50 ? 60 : 45;
  }

  // HV regime: is realized vol stable or chaotic?
  let hvRegimeScore = 50;
  if (hv30 !== null) {
    if (hv30 < 15) hvRegimeScore = 65;      // Low RV = stable underlying
    else if (hv30 < 25) hvRegimeScore = 70;  // Normal RV
    else if (hv30 < 40) hvRegimeScore = 55;  // Elevated but manageable
    else if (hv30 < 60) hvRegimeScore = 40;  // High RV = risky
    else hvRegimeScore = 25;                   // Extreme RV
  }

  // Weighted: vix_level 40%, iv_regime 35%, hv_regime 25%
  const score = round(0.40 * vixLevelScore + 0.35 * ivRegimeScore + 0.25 * hvRegimeScore, 1);

  const formula = `0.40×VIXlevel(${round(vixLevelScore)}) + 0.35×IVregime(${round(ivRegimeScore)}) + 0.25×HVregime(${round(hvRegimeScore)}) = ${score}`;

  // Upgrade regime classification with more context
  if (ivp !== null && vix !== null) {
    if (ivp > 70 && vix > 20) regimeClassification += '_HIGH_OPPORTUNITY';
    else if (ivp < 30 && vix < 15) regimeClassification += '_LOW_OPPORTUNITY';
  }

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      vix: vix,
      iv30: iv30,
      hv30: hv30,
      iv_percentile: ivp,
    },
    formula,
    notes: `Regime: ${regimeClassification}. VIX=${vix ?? 'N/A'}, Stock IV30=${iv30 ?? 'N/A'}, HV30=${hv30 ?? 'N/A'}`,
    sub_scores: {
      vix_level_score: round(vixLevelScore),
      iv_regime_score: round(ivRegimeScore),
      hv_regime_score: round(hvRegimeScore),
    },
    regime_classification: regimeClassification,
  };
}

// ===== MAIN REGIME SCORER =====

export function scoreRegime(input: ConvergenceInput): RegimeResult {
  const macroEnvironment = scoreMacroEnvironment(input);
  const correlationContext = scoreCorrelationContext(input);
  const volatilityRegime = scoreVolatilityRegime(input);

  const score = round(
    macroEnvironment.weight * macroEnvironment.score +
    correlationContext.weight * correlationContext.score +
    volatilityRegime.weight * volatilityRegime.score,
    1,
  );

  return {
    score,
    breakdown: {
      macro_environment: macroEnvironment,
      correlation_context: correlationContext,
      volatility_regime: volatilityRegime,
    },
  };
}
