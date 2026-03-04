import type {
  ConvergenceInput,
  VolEdgeResult,
  QualityGateResult,
  RegimeResult,
  InfoEdgeResult,
  CompositeResult,
  StrategySuggestion,
  DataConfidence,
  GateWeights,
  GateWeightTrace,
} from './types';
import { scoreVolEdge } from './vol-edge';
import { scoreQualityGate } from './quality-gate';
import { scoreRegime } from './regime';
import { scoreInfoEdge } from './info-edge';

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// ===== DYNAMIC GATE WEIGHTING (AQR factor timing — regime-dependent) =====
// Signal importance shifts with market regime. In a credit crisis, Quality matters
// more than Vol-Edge. In a low-vol expansion, Vol-Edge is king.

const STATIC_WEIGHTS: GateWeights = { vol_edge: 0.25, quality: 0.25, regime: 0.25, info_edge: 0.25 };

// Regime label → dynamic weight table
// Existing regime labels: GOLDILOCKS, REFLATION, STAGFLATION, DEFLATION
// Plus CRISIS override from HY spread stress level
const REGIME_WEIGHT_TABLE: Record<string, GateWeights> = {
  // GOLDILOCKS → EXPANSION: vol signals + info signals dominate in bull markets
  GOLDILOCKS:  { vol_edge: 0.30, quality: 0.20, regime: 0.20, info_edge: 0.30 },
  // REFLATION → RECOVERY: vol-edge returns as opportunity signal, regime confirms direction
  REFLATION:   { vol_edge: 0.30, quality: 0.20, regime: 0.25, info_edge: 0.25 },
  // DEFLATION → CONTRACTION: quality becomes critical — avoid blowups
  DEFLATION:   { vol_edge: 0.20, quality: 0.35, regime: 0.25, info_edge: 0.20 },
  // STAGFLATION: regime + quality — stagflation is hardest to trade
  STAGFLATION: { vol_edge: 0.20, quality: 0.30, regime: 0.30, info_edge: 0.20 },
  // CRISIS: quality + regime awareness paramount, vol surface unreliable
  CRISIS:      { vol_edge: 0.15, quality: 0.40, regime: 0.30, info_edge: 0.15 },
};

function computeDynamicGateWeights(regime: RegimeResult | null): GateWeightTrace {
  if (!regime) {
    return {
      gate_weights: { ...STATIC_WEIGHTS },
      weight_mode: 'static_fallback',
      regime_used: 'UNKNOWN',
      regime_confidence: 0,
      blend_factor: 0,
    };
  }

  const breakdown = regime.breakdown;
  const probs = breakdown.regime_probabilities;
  let dominantRegime = breakdown.dominant_regime;

  // Crisis override: if HY spread is at crisis levels, override to CRISIS
  if (breakdown.regime_signals.hy_stress_level === 'crisis') {
    dominantRegime = 'CRISIS';
  }

  // Regime confidence = dominant regime probability
  // Normalize from [0.25, 1.0] → [0.0, 1.0] so equal probability maps to 0 confidence
  const dominantProb = dominantRegime === 'CRISIS'
    ? Math.max(probs.stagflation, probs.deflation)  // crisis confidence from contraction probs
    : Math.max(probs.goldilocks, probs.reflation, probs.stagflation, probs.deflation);
  const regimeConfidence = round(Math.max(0, (dominantProb - 0.25) / 0.75), 4);

  // Blend factor = regime confidence (0 = fully static, 1 = fully dynamic)
  const blendFactor = regimeConfidence;

  // Look up dynamic weights for the regime
  const dynamicWeights = REGIME_WEIGHT_TABLE[dominantRegime] ?? STATIC_WEIGHTS;

  // Confidence-blended weights: finalWeight = blend × dynamic + (1 - blend) × static
  const gateWeights: GateWeights = {
    vol_edge: round(blendFactor * dynamicWeights.vol_edge + (1 - blendFactor) * STATIC_WEIGHTS.vol_edge, 4),
    quality:  round(blendFactor * dynamicWeights.quality  + (1 - blendFactor) * STATIC_WEIGHTS.quality, 4),
    regime:   round(blendFactor * dynamicWeights.regime   + (1 - blendFactor) * STATIC_WEIGHTS.regime, 4),
    info_edge: round(blendFactor * dynamicWeights.info_edge + (1 - blendFactor) * STATIC_WEIGHTS.info_edge, 4),
  };

  // Normalize to ensure weights sum to exactly 1.0 (prevent floating point drift)
  const sum = gateWeights.vol_edge + gateWeights.quality + gateWeights.regime + gateWeights.info_edge;
  if (Math.abs(sum - 1.0) > 0.001) {
    gateWeights.vol_edge = round(gateWeights.vol_edge / sum, 4);
    gateWeights.quality = round(gateWeights.quality / sum, 4);
    gateWeights.regime = round(gateWeights.regime / sum, 4);
    gateWeights.info_edge = round(1 - gateWeights.vol_edge - gateWeights.quality - gateWeights.regime, 4);
  }

  return {
    gate_weights: gateWeights,
    weight_mode: blendFactor > 0 ? 'dynamic' : 'static_fallback',
    regime_used: dominantRegime,
    regime_confidence: round(dominantProb, 4),
    blend_factor: round(blendFactor, 4),
  };
}

// ===== MAIN COMPOSITE SCORER =====

export interface FullScoringResult {
  vol_edge: VolEdgeResult;
  quality: QualityGateResult;
  regime: RegimeResult;
  info_edge: InfoEdgeResult;
  composite: CompositeResult;
  strategy_suggestion: StrategySuggestion;
  data_gaps: string[];
}

export function scoreAll(input: ConvergenceInput): FullScoringResult {
  const volEdge = scoreVolEdge(input);
  const quality = scoreQualityGate(input);
  const regime = scoreRegime(input);
  const infoEdge = scoreInfoEdge(input);

  // Dynamic gate weighting: regime-dependent with confidence blending
  const gateWeightTrace = computeDynamicGateWeights(regime);
  const w = gateWeightTrace.gate_weights;

  const compositeScore = round(
    w.vol_edge * volEdge.score +
    w.quality * quality.score +
    w.regime * regime.score +
    w.info_edge * infoEdge.score,
    1,
  );

  // Convergence gate: how many categories above 50
  const scores = [volEdge.score, quality.score, regime.score, infoEdge.score];
  const above50 = scores.filter(s => s > 50).length;

  // Continuous position sizing (Kelly 1956, Grinold & Kahn 1999)
  // Gate qualification preserved as circuit-breaker; sizing is continuous for 3+ gates.
  let positionSizePct: number;
  let convergenceGate: string;
  if (above50 < 2) {
    positionSizePct = 0;
    convergenceGate = `${above50}/4 above 50 → NO TRADE (convergence too weak)`;
  } else if (above50 === 2) {
    positionSizePct = 20;
    convergenceGate = `2/4 above 50 → 20% position size (marginal signal)`;
  } else {
    // 3+ gates: continuous sizing from composite score
    // composite=50 → 30%, composite=75 → 65%, composite=100 → 100%
    const clampedComposite = Math.max(50, Math.min(100, compositeScore));
    positionSizePct = 30 + ((clampedComposite - 50) / 50) * 70;
    positionSizePct = Math.round(positionSizePct / 5) * 5; // Round to nearest 5%
    convergenceGate = `${above50}/4 above 50 → ${positionSizePct}% position size (continuous)`;
  }

  // Direction signal from Info Edge
  let direction: string;
  if (infoEdge.score > 65) direction = 'BULLISH';
  else if (infoEdge.score < 35) direction = 'BEARISH';
  else direction = 'NEUTRAL';

  // Aggregate DataConfidence from all 4 gates
  const allImputed = [
    ...volEdge.data_confidence.imputed_fields.map(f => `vol_edge.${f}`),
    ...quality.data_confidence.imputed_fields.map(f => `quality.${f}`),
    ...regime.data_confidence.imputed_fields.map(f => `regime.${f}`),
    ...infoEdge.data_confidence.imputed_fields.map(f => `info_edge.${f}`),
  ];
  const totalSub =
    volEdge.data_confidence.total_sub_scores +
    quality.data_confidence.total_sub_scores +
    regime.data_confidence.total_sub_scores +
    infoEdge.data_confidence.total_sub_scores;
  const compositeConfidence: DataConfidence = {
    total_sub_scores: totalSub,
    imputed_sub_scores: allImputed.length,
    confidence: round(1 - allImputed.length / totalSub, 4),
    imputed_fields: allImputed,
  };

  const composite: CompositeResult = {
    score: compositeScore,
    rank_method: 'dynamic_regime_weighted',
    note: `Gate weights: VE=${round(w.vol_edge, 2)} Q=${round(w.quality, 2)} R=${round(w.regime, 2)} IE=${round(w.info_edge, 2)} [${gateWeightTrace.weight_mode}, regime=${gateWeightTrace.regime_used}, blend=${round(gateWeightTrace.blend_factor, 2)}]`,
    convergence_gate: convergenceGate,
    direction,
    category_scores: {
      vol_edge: volEdge.score,
      quality: quality.score,
      regime: regime.score,
      info_edge: infoEdge.score,
    },
    categories_above_50: above50,
    position_size_pct: positionSizePct,
    sizing_method: 'continuous_v1',
    data_confidence: compositeConfidence,
    gate_weight_trace: gateWeightTrace,
  };

  // Strategy suggestion
  const strategySuggestion = deriveStrategy(volEdge, quality, regime, infoEdge, direction);

  // Data gaps
  const dataGaps = computeDataGaps(input, volEdge, quality);

  return {
    vol_edge: volEdge,
    quality,
    regime,
    info_edge: infoEdge,
    composite,
    strategy_suggestion: strategySuggestion,
    data_gaps: dataGaps,
  };
}

function deriveStrategy(
  volEdge: VolEdgeResult,
  _quality: QualityGateResult,
  regime: RegimeResult,
  _infoEdge: InfoEdgeResult,
  direction: string,
): StrategySuggestion {
  const regimeScore = regime.score;
  const volScore = volEdge.score;
  let ivp = volEdge.breakdown.mispricing.inputs.IV_percentile as number | null;
  // Guard: normalize IVP from decimal (0-1) to percentage (0-100) if needed
  if (ivp !== null && ivp <= 1.0) ivp = Math.round(ivp * 1000) / 10;
  const termShape = volEdge.breakdown.term_structure.shape;

  // Regime-based preference
  let regimePreferred: string;
  if (regimeScore >= 75) {
    regimePreferred = `Short premium favored (regime_score=${round(regimeScore)})`;
  } else if (regimeScore >= 55) {
    regimePreferred = `Neutral strategies favored (regime_score=${round(regimeScore)})`;
  } else {
    regimePreferred = `Defined risk preferred (regime_score=${round(regimeScore)})`;
  }

  // Vol edge confirmation
  let volEdgeConfirms: string;
  if (ivp !== null && ivp > 60) {
    volEdgeConfirms = `IVP=${ivp}% → short premium appropriate`;
  } else if (ivp !== null && ivp > 40) {
    volEdgeConfirms = `IVP=${ivp}% → neutral premium levels`;
  } else {
    volEdgeConfirms = `IVP=${ivp ?? 'N/A'}% → premiums compressed, long vol or pass`;
  }

  // Suggested strategy
  let suggestedStrategy: string;
  let suggestedDte = 45; // Default

  if (direction === 'NEUTRAL') {
    if (volScore >= 65 && regimeScore >= 60) {
      suggestedStrategy = 'Iron Condor';
      suggestedDte = 45;
    } else if (volScore >= 55) {
      suggestedStrategy = 'Short Strangle (if margin allows) or Iron Condor';
      suggestedDte = 45;
    } else {
      suggestedStrategy = 'Iron Butterfly or Calendar Spread';
      suggestedDte = 30;
    }
  } else if (direction === 'BULLISH') {
    if (volScore >= 65) {
      suggestedStrategy = 'Put Credit Spread or Short Put';
      suggestedDte = 45;
    } else {
      suggestedStrategy = 'Call Debit Spread or Bull Put Spread';
      suggestedDte = 30;
    }
  } else {
    // BEARISH
    if (volScore >= 65) {
      suggestedStrategy = 'Call Credit Spread or Short Call';
      suggestedDte = 45;
    } else {
      suggestedStrategy = 'Put Debit Spread or Bear Call Spread';
      suggestedDte = 30;
    }
  }

  // Adjust DTE based on term structure
  if (termShape === 'STEEP_CONTANGO' || termShape === 'CONTANGO') {
    suggestedDte = 45; // Theta works best in contango
  } else if (termShape === 'BACKWARDATION' || termShape === 'STEEP_BACKWARDATION') {
    suggestedDte = 21; // Shorter DTE in backwardation to avoid vol expansion
  }

  return {
    direction,
    regime_preferred: regimePreferred,
    vol_edge_confirms: volEdgeConfirms,
    suggested_strategy: suggestedStrategy,
    suggested_dte: suggestedDte,
    note: 'Trade cards generated from real chain data when run via pipeline',
  };
}

function computeDataGaps(
  input: ConvergenceInput,
  _volEdge: VolEdgeResult,
  quality: QualityGateResult,
): string[] {
  const gaps: string[] = [];

  // Z-score gap — only if peerStats not provided
  if (!input.peerStats || Object.keys(input.peerStats).length === 0) {
    gaps.push('peer_z_scores: requires peer data (pipeline mode)');
  }

  // Piotroski gap
  const piotroski = quality.breakdown.safety.piotroski;
  const missing = 9 - piotroski.available_signals;
  if (missing > 0) {
    gaps.push(`piotroski_f_score: ${piotroski.available_signals}/9 signals computable, ${missing} missing annual financial data`);
  }

  // Altman Z gap
  const altmanZ = quality.breakdown.safety.altman_z;
  if (altmanZ.components_available < altmanZ.components_total) {
    const altmanMissing = altmanZ.components_total - altmanZ.components_available;
    gaps.push(`altman_z: ${altmanZ.components_available}/${altmanZ.components_total} components computable, ${altmanMissing} missing from Finnhub fields${altmanZ.capped ? ' (CAPPED: Z < 1.8)' : ''}`);
  }

  // Scanner data
  if (!input.ttScanner) {
    gaps.push('tastytrade_scanner: no scanner data returned');
  }

  // Candle data
  if (input.candles.length < 50) {
    gaps.push(`candle_technicals: only ${input.candles.length} candles (need 50+ for SMA50, MACD)`);
  }

  // Insider sentiment
  if (input.finnhubInsiderSentiment.length === 0) {
    gaps.push('insider_sentiment: no data (may be Finnhub premium endpoint)');
  }

  // Earnings
  if (input.finnhubEarnings.length === 0) {
    gaps.push('earnings_history: no Finnhub earnings data');
  }

  // FRED gaps
  const fred = input.fredMacro;
  const fredMissing: string[] = [];
  if (fred.vix === null) fredMissing.push('VIX');
  if (fred.treasury10y === null) fredMissing.push('10Y');
  if (fred.fedFunds === null) fredMissing.push('FedFunds');
  if (fredMissing.length > 0) {
    gaps.push(`fred_macro: missing ${fredMissing.join(', ')}`);
  }

  return gaps;
}
