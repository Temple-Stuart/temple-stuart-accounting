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
  GateKey,
  PremiumSide,
  ScoreModel,
  BuyerComponent,
  BuyerComponentTrace,
} from './types';
import { scoreVolEdge } from './vol-edge';
import { combineWeighted } from './weighted-combiner';
import { scoreQualityGate } from './quality-gate';
import { scoreRegime } from './regime';
import { scoreInfoEdge } from './info-edge';
import { INPUT_SIGNS, MODEL_WEIGHTS_SET_ON, applyBuyerSign, signFor } from './input-signs';
import { CURRENT_MODEL_ERA } from '../edge-read/eras';

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
  // MIG-1: an EXCLUDED regime gate (score null — no classification computed)
  // falls back to static weights, same as no regime at all.
  const staticFallback: GateWeightTrace = {
    gate_weights: { ...STATIC_WEIGHTS },
    weight_mode: 'static_fallback',
    regime_used: 'UNKNOWN',
    regime_confidence: 0,
    blend_factor: 0,
  };
  if (!regime || regime.score == null) return staticFallback;
  const breakdown = regime.breakdown;
  const probs = breakdown.regime_scores;
  if (probs == null || breakdown.dominant_regime == null) return staticFallback;
  let dominantRegime: string = breakdown.dominant_regime;

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

// ===== MODEL-01: TWO SCORES, ONE PER PREMIUM DIRECTION =====
//
// sellerScore = today's composite, unchanged, renamed: the four gate scores
// under the regime-dynamic weights above (STATIC_WEIGHTS / REGIME_WEIGHT_TABLE,
// dated at #1082, 2026-06-20; untuned on any outcome — EDGE-01 found zero
// graded outcomes under this model).
//
// buyerScore = a recomposition of the four gates per the input-sign table
// (input-signs.ts): only the inputs the table admits enter, each with the sign
// the table states, at EQUAL UNTUNED weights (MODEL_WEIGHTS_SET_ON,
// 2026-09-15) — they await EDGE-01's third book (LOG-01 scan_candidates,
// bucketed by side). A gate with no admitted component present is EXCLUDED and
// the gate weights renormalize; all four excluded → score null (never a
// number). No input's meaning is changed by a sign flip in place.

export interface ModelScore {
  model: ScoreModel;
  score: number | null;
  category_scores: CompositeResult['category_scores'];
  gate_weight_trace: GateWeightTrace;
  excluded_gates: GateKey[];
  scored_by: GateKey[];
  buyer_components: BuyerComponentTrace | null;
  note: string;
}

const GATE_KEYS: readonly GateKey[] = ['vol_edge', 'quality', 'regime', 'info_edge'];

function combineGates(
  scores: CompositeResult['category_scores'],
  w: GateWeights,
): { score: number | null; excluded: GateKey[]; scoredBy: GateKey[] } {
  const combined = combineWeighted(GATE_KEYS.map((k) => ({ key: k, weight: w[k], score: scores[k] })));
  const excluded = combined.excludedKeys as GateKey[];
  return { score: combined.score, excluded, scoredBy: GATE_KEYS.filter((k) => !excluded.includes(k)) };
}

/** The SELLER model — today's composite, unchanged. */
export function sellerScore(
  volEdge: VolEdgeResult,
  quality: QualityGateResult,
  regime: RegimeResult,
  infoEdge: InfoEdgeResult,
): ModelScore {
  // Dynamic gate weighting: regime-dependent with confidence blending
  const gateWeightTrace = computeDynamicGateWeights(regime);
  const w = gateWeightTrace.gate_weights;
  const category_scores = {
    vol_edge: volEdge.score,
    quality: quality.score,
    regime: regime.score,
    info_edge: infoEdge.score,
  };
  // MIG-1: an excluded gate (score null) is dropped and the remaining gate
  // weights renormalize — the composite is computed only from present gates.
  // All four gates null (a ticker with literally zero data) → composite null,
  // recorded as an honest null in scan_snapshots.
  const { score, excluded, scoredBy } = combineGates(category_scores, w);
  return {
    model: 'seller',
    score,
    category_scores,
    gate_weight_trace: gateWeightTrace,
    excluded_gates: excluded,
    scored_by: scoredBy,
    buyer_components: null,
    note: `Gate weights: VE=${round(w.vol_edge, 2)} Q=${round(w.quality, 2)} R=${round(w.regime, 2)} IE=${round(w.info_edge, 2)} [${gateWeightTrace.weight_mode}, regime=${gateWeightTrace.regime_used}, blend=${round(gateWeightTrace.blend_factor, 2)}]`,
  };
}

/** The raw HV-acceleration ladder as scoreMispricing scores it for the seller (vol-edge.ts:289-305). */
function hvAccelLadderSellerOriented(hv30: number | null, hv60: number | null, hv90: number | null): number | null {
  if (hv30 === null || hv60 === null || hv90 === null) return null;
  if (hv30 < hv60 && hv60 < hv90) return 80;
  if (hv30 < hv60) return 65;
  if (hv30 > hv60 && hv60 > hv90) return 20;
  if (hv30 > hv60) return 35;
  return 50;
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function equalCombine(components: BuyerComponent[]): { score: number | null; present: number } {
  const combined = combineWeighted(components.map((c) => ({ key: `${c.gate}.${c.input}`, weight: 1, score: c.buyer_value })));
  return { score: combined.score, present: combined.activeCount };
}

/**
 * The BUYER model — Vol-Edge inverts (HV above IV is the edge); Regime keeps
 * its sign only for the survival brake's inputs; Quality and Info-Edge enter
 * with direction-neutral inputs only; direction-bearing inputs feed the
 * directional overlay (composite.direction → bull/bear debit spreads), not
 * this score. The table decides every row — see input-signs.ts.
 */
export function buyerScore(
  volEdge: VolEdgeResult,
  quality: QualityGateResult,
  regime: RegimeResult,
  infoEdge: InfoEdgeResult,
): ModelScore {
  const components: BuyerComponent[] = [];
  const admit = (gate: GateKey, input: string, sellerOriented: number | null, note: string, buyerOverride?: number | null): BuyerComponent => {
    const row = signFor(gate, input);
    if (row.buyer === '0') throw new Error(`MODEL-01: ${gate}.${input} is not admitted to the buy score by the input-sign table`);
    const buyerValue = buyerOverride !== undefined ? buyerOverride : applyBuyerSign(row, sellerOriented);
    const c: BuyerComponent = { gate, input, sign: row.buyer, seller_oriented: sellerOriented, buyer_value: buyerValue, note };
    components.push(c);
    return c;
  };

  // ── Vol-Edge: the IV-level inputs invert; liquidity keeps; the rest is the table's '0'
  const m = volEdge.breakdown.mispricing;
  const mispricingActive = (m.active_signal_count ?? 0) > 0;
  const cs = m.component_scores;
  admit('vol_edge', 'vrp', mispricingActive ? cs.vrp : null, 'own-history VRP percentile, inverted');
  admit('vol_edge', 'iv_composite', mispricingActive ? cs.iv_composite : null, 'IVP/IVR level, inverted');
  const spread = numOrNull(m.inputs.IV_HV_spread);
  const hvOverIv = spread === null ? null : round(clamp((-spread / 20) * 100, 0, 100), 1);
  admit('vol_edge', 'iv_hv_spread', mispricingActive ? cs.iv_hv_spread : null,
    spread === null ? 'IV-HV spread unavailable — excluded' : `HV over IV by ${round(-spread, 2)} pts → ${hvOverIv} (magnitude of the opposite sign, from the raw spread)`, hvOverIv);
  const ladder = hvAccelLadderSellerOriented(numOrNull(m.inputs.HV_30), numOrNull(m.inputs.HV_60), numOrNull(m.inputs.HV_90));
  admit('vol_edge', 'hv_accel', ladder, ladder === null ? 'HV30/60/90 not all present — excluded' : 'raw HV30/60/90 ladder, inverted (rising realized vol = the buyer\'s side)');
  const gexActive = (volEdge.breakdown.gex.active_signal_count ?? 0) > 0;
  admit('vol_edge', 'gex', gexActive ? volEdge.breakdown.gex.gex_score : null, gexActive ? 'dealer gamma, inverted (negative GEX amplifies realized moves)' : 'GEX excluded — no chain/OI data');
  const techActive = (volEdge.breakdown.technicals.active_signal_count ?? 0) > 0;
  admit('vol_edge', 'volume', techActive ? volEdge.breakdown.technicals.sub_scores.volume_score : null, 'volume ratio — liquidity, kept');
  const ve = equalCombine(components.filter((c) => c.gate === 'vol_edge'));

  // ── Quality: the six safety components only (direction-neutral tradability + solvency)
  const safety = quality.breakdown.safety;
  const safetyActive = (safety.active_signal_count ?? 0) > 0;
  const ss = safety.sub_scores;
  admit('quality', 'liquidity_rating', safetyActive ? ss.liquidity_rating_score : null, 'TastyTrade liquidity rating, kept');
  admit('quality', 'market_cap', safetyActive ? ss.market_cap_score : null, 'size tier, kept');
  admit('quality', 'volume', safetyActive ? ss.volume_score : null, '20-day share volume tier, kept');
  admit('quality', 'lendability', safetyActive ? ss.lendability_score : null, 'borrow-market state, kept');
  admit('quality', 'beta', safetyActive ? ss.beta_score : null, 'market exposure, kept');
  admit('quality', 'debt_to_equity', safetyActive ? ss.debt_to_equity_score : null, 'solvency, kept');
  const q = equalCombine(components.filter((c) => c.gate === 'quality'));

  // ── Regime: the survival brake's two inputs only, same sign (a brake applies to both sides)
  const vc = regime.breakdown.vol_conditioners;
  admit('regime', 'vix_term_structure', vc.vix_term_structure.score, vc.vix_term_structure.score === null ? 'VIX/VIX3M unavailable — excluded' : `VIX/VIX3M = ${vc.vix_term_structure.raw_value} (backwardation scores low), kept`);
  admit('regime', 'vvix', vc.vvix.score, vc.vvix.score === null ? 'VVIX unavailable (VVIXCLS is not a FRED series — dead since 2026-07-08; MODEL-02) — excluded' : 'VVIX level (elevated scores low), kept');
  const r = equalCombine(components.filter((c) => c.gate === 'regime'));

  // ── Info-Edge: direction-neutral inputs only (activity, attention, evidence quality, event count)
  const flow = infoEdge.breakdown.flow_signal;
  const news = infoEdge.breakdown.news_sentiment;
  const event = infoEdge.breakdown.material_event_flag;
  admit('info_edge', 'unusual_activity', flow ? flow.sub_scores.unusual_activity_score : null, flow ? 'option volume / OI, kept' : 'flow signal excluded — no chain');
  admit('info_edge', 'buzz', news ? news.sub_scores.buzz_score : null, news ? 'news buzz vs baseline, kept' : 'news excluded — no feed');
  admit('info_edge', 'source_quality', news ? news.sub_scores.source_quality_score : null, news ? 'tier-1 share of coverage, kept' : 'news excluded — no feed');
  admit('info_edge', 'material_event', event ? event.score : null, event ? '8-K count, inverted (more material events = more catalysts for a buyer of movement)' : '8-K scan excluded — no data');
  const ie = equalCombine(components.filter((c) => c.gate === 'info_edge'));

  const category_scores = { vol_edge: ve.score, quality: q.score, regime: r.score, info_edge: ie.score };
  const w: GateWeights = { vol_edge: 0.25, quality: 0.25, regime: 0.25, info_edge: 0.25 };
  const { score, excluded, scoredBy } = combineGates(category_scores, w);
  const gateNote = (k: GateKey, g: { score: number | null; present: number }) => ({
    score: g.score,
    present: g.present,
    admitted: components.filter((c) => c.gate === k).length,
    note: g.score === null ? `EXCLUDED — none of the ${components.filter((c) => c.gate === k).length} admitted components present; gate weight renormalized` : `equal weights over ${g.present} present component(s)`,
  });
  const trace: BuyerComponentTrace = {
    components,
    gates: {
      vol_edge: gateNote('vol_edge', ve),
      quality: gateNote('quality', q),
      regime: gateNote('regime', r),
      info_edge: gateNote('info_edge', ie),
    },
    weights_set_on: MODEL_WEIGHTS_SET_ON,
  };
  const admittedRows = INPUT_SIGNS.filter((x) => x.buyer !== '0').length;
  if (admittedRows !== components.length) throw new Error(`MODEL-01: the buy score admitted ${components.length} components but the input-sign table admits ${admittedRows} — the table decides, the scorer must read every admitted row`);
  return {
    model: 'buyer',
    score,
    category_scores,
    gate_weight_trace: {
      gate_weights: w,
      weight_mode: 'equal_untuned',
      regime_used: 'n/a — buyer model: regime enters through its survival-brake inputs only',
      regime_confidence: 0,
      blend_factor: 0,
    },
    excluded_gates: excluded,
    scored_by: scoredBy,
    buyer_components: trace,
    note: `Buyer model: equal untuned gate weights 0.25×4 (set ${MODEL_WEIGHTS_SET_ON}, awaiting EDGE-01's third book); VE=${ve.score ?? 'EXCLUDED'} Q=${q.score ?? 'EXCLUDED'} R=${r.score ?? 'EXCLUDED'} IE=${ie.score ?? 'EXCLUDED'} [${components.filter((c) => c.buyer_value !== null).length}/${components.length} admitted components present]`,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
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

/**
 * Score a ticker on ONE side's model. `side` defaults to SELL — today's
 * composite — so every existing caller keeps its behaviour; the pipeline
 * passes the side the symbol came through the pre-filter on.
 */
export function scoreAll(input: ConvergenceInput, side: PremiumSide = 'SELL'): FullScoringResult {
  const volEdge = scoreVolEdge(input);
  const quality = scoreQualityGate(input);
  const regime = scoreRegime(input);
  const infoEdge = scoreInfoEdge(input);

  const model = side === 'BUY'
    ? buyerScore(volEdge, quality, regime, infoEdge)
    : sellerScore(volEdge, quality, regime, infoEdge);
  const gateWeightTrace = model.gate_weight_trace;
  const compositeScore = model.score;
  const excludedGates = model.excluded_gates;

  // Convergence gate: how many categories above 50 (an excluded gate cannot
  // be "above 50" — it counts against convergence, which is honest: less
  // evidence, smaller size). Counted on the MODEL's gate scores.
  const scores = [model.category_scores.vol_edge, model.category_scores.quality, model.category_scores.regime, model.category_scores.info_edge];
  const above50 = scores.filter((s): s is number => s !== null && s > 50).length;

  // EDGE-6 (STRATEGY-EVIDENCE §6): the survival brake is market-level state
  // from the regime gate. ON or UNVERIFIED → short-premium suggestions are
  // suppressed in deriveStrategy and the state is DECLARED on the convergence
  // gate string and on CompositeResult.regime_brake — never a silent change.
  const survivalBrake = regime.breakdown.survival_brake;

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
    // 3+ gates: continuous sizing from composite score (composite is non-null
    // here — at least 3 gates scored above 50)
    // composite=50 → 30%, composite=75 → 65%, composite=100 → 100%
    const clampedComposite = Math.max(50, Math.min(100, compositeScore as number));
    positionSizePct = 30 + ((clampedComposite - 50) / 50) * 70;
    positionSizePct = Math.round(positionSizePct / 5) * 5; // Round to nearest 5%
    convergenceGate = `${above50}/4 above 50 → ${positionSizePct}% position size (continuous)`;
  }
  if (survivalBrake.state !== 'OFF') {
    convergenceGate += ` | ${survivalBrake.declaration}`;
  }

  // Direction signal from Info Edge. MIG-1: an excluded info-edge gate gives
  // no direction evidence — labeled UNKNOWN, never imputed as neutral.
  // MODEL-01: this is the directional OVERLAY — it reads the direction-bearing
  // info-edge inputs on BOTH sides; on the buy side it picks bull/bear debit
  // spreads and never enters the buy score.
  let direction: string;
  if (infoEdge.score == null) direction = 'UNKNOWN (info-edge excluded — no signal data)';
  else if (infoEdge.score > 65) direction = 'BULLISH';
  else if (infoEdge.score < 35) direction = 'BEARISH';
  else direction = 'NEUTRAL';

  // Aggregate DataConfidence from all 4 gates. MIG-1: exclusions count too —
  // post-KILL-3 the gates stopped imputing, so aggregating only imputed_fields
  // silently pinned the snapshot's dataConfidence/imputedCount at full.
  const allImputed = [
    ...volEdge.data_confidence.imputed_fields.map(f => `vol_edge.${f}`),
    ...quality.data_confidence.imputed_fields.map(f => `quality.${f}`),
    ...regime.data_confidence.imputed_fields.map(f => `regime.${f}`),
    ...infoEdge.data_confidence.imputed_fields.map(f => `info_edge.${f}`),
  ];
  const allExcluded = [
    ...(volEdge.data_confidence.excluded_fields ?? []).map(f => `vol_edge.${f}`),
    ...(quality.data_confidence.excluded_fields ?? []).map(f => `quality.${f}`),
    ...(regime.data_confidence.excluded_fields ?? []).map(f => `regime.${f}`),
    ...(infoEdge.data_confidence.excluded_fields ?? []).map(f => `info_edge.${f}`),
  ];
  const totalSub =
    volEdge.data_confidence.total_sub_scores +
    quality.data_confidence.total_sub_scores +
    regime.data_confidence.total_sub_scores +
    infoEdge.data_confidence.total_sub_scores;
  const activeTotal =
    (volEdge.data_confidence.active_signal_count ?? volEdge.data_confidence.total_sub_scores) +
    (quality.data_confidence.active_signal_count ?? quality.data_confidence.total_sub_scores) +
    (regime.data_confidence.active_signal_count ?? regime.data_confidence.total_sub_scores) +
    (infoEdge.data_confidence.active_signal_count ?? infoEdge.data_confidence.total_sub_scores);
  // Same convention as each gate: confidence = active/total sub-signals.
  // A zero-data ticker reads 0, matching its per-gate confidences — never a
  // dot-depth-filtered count that flatters missing data.
  const compositeConfidence: DataConfidence = {
    total_sub_scores: totalSub,
    imputed_sub_scores: totalSub - activeTotal,
    confidence: round(activeTotal / totalSub, 4),
    imputed_fields: allImputed,
    excluded_fields: allExcluded,
    active_signal_count: activeTotal,
  };

  const composite: CompositeResult = {
    score: compositeScore,
    rank_method: model.model === 'seller' ? 'dynamic_regime_weighted' : 'buyer_equal_untuned',
    note: model.note,
    convergence_gate: convergenceGate,
    direction,
    category_scores: model.category_scores,
    categories_above_50: above50,
    position_size_pct: positionSizePct,
    sizing_method: 'continuous_v1',
    data_confidence: compositeConfidence,
    gate_weight_trace: gateWeightTrace,
    regime_brake: { state: survivalBrake.state, declaration: survivalBrake.declaration },
    score_model: model.model,
    model_era: CURRENT_MODEL_ERA.id,
    scored_by: model.scored_by,
    excluded_gates: excludedGates,
    buyer_components: model.buyer_components,
  };

  // Strategy suggestion
  const strategySuggestion = deriveStrategy(volEdge, quality, regime, infoEdge, direction, side);

  // Data gaps
  const dataGaps = computeDataGaps(input, volEdge, quality);
  // MIG-1: a fully-excluded gate is DECLARED on the existing surface
  for (const g of excludedGates) {
    dataGaps.push(`gate_excluded: ${g} — zero computable signals${model.model === 'buyer' ? ' among the components the input-sign table admits to the buy score' : ''}; recorded as null in scan_snapshots, composite renormalized over the present gates`);
  }

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
  side: PremiumSide,
): StrategySuggestion {
  if (side === 'BUY') return deriveBuyStrategy(volEdge, regime, direction);
  const regimeScore = regime.score;
  const volScore = volEdge.score;
  let ivp = volEdge.breakdown.mispricing.inputs.IV_percentile as number | null;
  // Guard: normalize IVP from decimal (0-1) to percentage (0-100) if needed
  if (ivp !== null && ivp <= 1.0) ivp = Math.round(ivp * 1000) / 10;
  const termShape = volEdge.breakdown.term_structure.shape;

  // EDGE-6 (STRATEGY-EVIDENCE §6): survival brake — ON or UNVERIFIED means
  // short-premium suggestions are suppressed below regardless of how
  // attractive the regime/vol scores look. UNVERIFIED (missing brake inputs)
  // fails SAFE: exposure is not confirmed safe, so it is treated like ON,
  // with its own declared reason — never a silent pass.
  const brake = regime.breakdown.survival_brake;
  const brakeActive = brake.state !== 'OFF';

  // Regime-based preference
  // MIG-1: an excluded regime gate (score null) is DECLARED, never scored.
  let regimePreferred: string;
  if (brakeActive) {
    regimePreferred = `${brake.declaration}${regimeScore !== null ? ` (regime_score=${round(regimeScore)})` : ''}`;
  } else if (regimeScore === null) {
    regimePreferred = 'Regime gate EXCLUDED (zero computable signals) — defined risk preferred by default, not scored';
  } else if (regimeScore >= 75) {
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

  if (volScore === null) {
    // MIG-1: vol-edge gate excluded — no premium/vol read exists; suggesting a
    // vol strategy would be an imputation. Declared, never defaulted.
    suggestedStrategy = 'NOT COMPUTABLE — vol-edge gate excluded (zero computable signals); no strategy suggested without a vol read';
  } else if (brakeActive && direction === 'NEUTRAL') {
    // EDGE-6: every neutral-income structure here is short premium — under
    // the brake none is suggested, and the reason is declared.
    suggestedStrategy = `${brake.declaration} — no neutral premium-selling strategy suggested`;
    suggestedDte = 30;
  } else if (brakeActive && direction === 'BULLISH') {
    suggestedStrategy = `Call Debit Spread (defined-risk debit only — ${brake.declaration})`;
    suggestedDte = 30;
  } else if (brakeActive && direction === 'BEARISH') {
    suggestedStrategy = `Put Debit Spread (defined-risk debit only — ${brake.declaration})`;
    suggestedDte = 30;
  } else if (direction === 'NEUTRAL') {
    if (volScore >= 65 && regimeScore !== null && regimeScore >= 60) {
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
  } else if (direction === 'BEARISH') {
    if (volScore >= 65) {
      suggestedStrategy = 'Call Credit Spread or Short Call';
      suggestedDte = 45;
    } else {
      suggestedStrategy = 'Put Debit Spread or Bear Call Spread';
      suggestedDte = 30;
    }
  } else {
    // MIG-1: direction UNKNOWN (info-edge excluded) — a directional strategy
    // would be fabricated. Declared, never defaulted to BEARISH.
    suggestedStrategy = 'NOT COMPUTABLE — direction unknown (info-edge gate excluded); no directional strategy suggested';
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

/**
 * MODEL-01: the buy side's suggestion. The regime gate speaks only through its
 * brake here; the vol read is HV over IV; the directional overlay picks the
 * debit spread. No premium-selling structure is ever suggested on this side.
 */
function deriveBuyStrategy(volEdge: VolEdgeResult, regime: RegimeResult, direction: string): StrategySuggestion {
  const brake = regime.breakdown.survival_brake;
  const spread = volEdge.breakdown.mispricing.inputs.IV_HV_spread;
  const termShape = volEdge.breakdown.term_structure.shape;
  const regimePreferred = brake.state !== 'OFF'
    ? `${brake.declaration} — a brake applies to both sides`
    : 'Regime enters the buy score through its brake inputs only (VIX/VIX3M, VVIX) — brake off';
  const volEdgeConfirms = typeof spread === 'number'
    ? `IV−HV = ${round(spread, 1)} → HV above IV by ${round(-spread, 1)} pts → long premium`
    : 'IV−HV spread unavailable — no long-premium read';
  let suggestedStrategy: string;
  let suggestedDte = 30;
  if (volEdge.score === null) {
    suggestedStrategy = 'NOT COMPUTABLE — vol-edge excluded (no admitted buy-side signal); no strategy without a vol read';
  } else if (direction === 'BULLISH') {
    suggestedStrategy = 'Bull Call Debit Spread';
  } else if (direction === 'BEARISH') {
    suggestedStrategy = 'Bear Put Debit Spread — no builder exists in the scanner yet (MODEL-02); not built';
  } else if (direction === 'NEUTRAL') {
    suggestedStrategy = 'Long Straddle or Long Strangle';
  } else {
    suggestedStrategy = 'Long Straddle or Long Strangle (direction unknown — info-edge excluded; no debit spread)';
  }
  if (termShape === 'BACKWARDATION' || termShape === 'STEEP_BACKWARDATION') suggestedDte = 21;
  return {
    direction,
    regime_preferred: regimePreferred,
    vol_edge_confirms: volEdgeConfirms,
    suggested_strategy: suggestedStrategy,
    suggested_dte: suggestedDte,
    note: 'Buy side: a candidate exists only with a catalyst (earnings inside the DTE window, or HV over IV by the stated margin) — trade cards generated from real chain data when run via pipeline',
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
