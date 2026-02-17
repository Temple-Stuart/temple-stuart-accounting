import type {
  ConvergenceInput,
  VolEdgeResult,
  QualityGateResult,
  RegimeResult,
  InfoEdgeResult,
  CompositeResult,
  StrategySuggestion,
} from './types';
import { scoreVolEdge } from './vol-edge';
import { scoreQualityGate } from './quality-gate';
import { scoreRegime } from './regime';
import { scoreInfoEdge } from './info-edge';

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

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

  // Equal-weighted composite: 25% each
  const compositeScore = round(
    0.25 * volEdge.score +
    0.25 * quality.score +
    0.25 * regime.score +
    0.25 * infoEdge.score,
    1,
  );

  // Convergence gate: how many categories above 50
  const scores = [volEdge.score, quality.score, regime.score, infoEdge.score];
  const above50 = scores.filter(s => s > 50).length;

  let convergenceGate: string;
  let positionSize: string;
  if (above50 === 4) {
    convergenceGate = `4/4 above 50 → 100% position size`;
    positionSize = '100%';
  } else if (above50 === 3) {
    convergenceGate = `3/4 above 50 → 60% position size`;
    positionSize = '60%';
  } else if (above50 === 2) {
    convergenceGate = `2/4 above 50 → 30% position size`;
    positionSize = '30%';
  } else {
    convergenceGate = `${above50}/4 above 50 → NO TRADE (convergence too weak)`;
    positionSize = '0%';
  }

  // Direction signal from Info Edge
  let direction: string;
  if (infoEdge.score > 65) direction = 'BULLISH';
  else if (infoEdge.score < 35) direction = 'BEARISH';
  else direction = 'NEUTRAL';

  const composite: CompositeResult = {
    score: compositeScore,
    rank_method: 'equal_weighted_percentile_rank',
    note: 'Single ticker — percentile ranks not meaningful. Scores shown as raw 0-100.',
    convergence_gate: convergenceGate,
    direction,
    category_scores: {
      vol_edge: volEdge.score,
      quality: quality.score,
      regime: regime.score,
      info_edge: infoEdge.score,
    },
    categories_above_50: above50,
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

  // Sector z-score gap
  if (!input.sectorStats || !input.ttScanner?.sector) {
    gaps.push('sector_z_scores: requires peer data (pipeline mode)');
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
