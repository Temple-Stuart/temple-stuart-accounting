import { combineWeighted } from './weighted-combiner';
import type {
  ConvergenceInput,
  VolEdgeResult,
  MispricingTrace,
  TermStructureTrace,
  TechnicalsTrace,
  SkewTrace,
  GEXTrace,
  CandleData,
  DataConfidence,
  OptionsChainExpiration,
  OptionsChainStrike,
} from './types';

// ===== HELPERS =====

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

/** Look up the peer stats entry for a given symbol using peerGroupAssignment. */
function lookupPeerStats(input: ConvergenceInput): { peerEntry: { ticker_count?: number; peer_group_type?: string; peer_group_name?: string; metrics: Record<string, { mean: number; std: number; sortedValues?: number[] }> } | undefined; peerGroupKey: string | null } {
  const symbol = input.symbol;
  const groupKey = input.peerGroupAssignment?.[symbol] ?? null;
  if (!groupKey || !input.peerStats) return { peerEntry: undefined, peerGroupKey: null };
  return { peerEntry: input.peerStats[groupKey], peerGroupKey: groupKey };
}

// ===== TECHNICAL INDICATOR COMPUTATIONS =====

function computeRSI(candles: CandleData[], period = 14): {
  rsi: number | null;
  avgGain: number;
  avgLoss: number;
  rs: number;
} {
  if (candles.length < period + 1) {
    return { rsi: null, avgGain: 0, avgLoss: 0, rs: 0 };
  }

  const changes: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    changes.push(Number.isFinite(diff) ? diff : 0);
  }

  // Initial averages from first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smoothed averages for remaining changes
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) {
    return { rsi: 100, avgGain: round(avgGain, 4), avgLoss: 0, rs: Infinity };
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return { rsi: round(rsi, 2), avgGain: round(avgGain, 4), avgLoss: round(avgLoss, 4), rs: round(rs, 4) };
}

function computeSMA(candles: CandleData[], period: number): number | null {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  return round(mean(slice.map(c => c.close)), 2);
}

function computeBollinger(candles: CandleData[], period = 20, mult = 2): {
  upper: number | null;
  lower: number | null;
  middle: number | null;
  position: number | null;
  width: number | null;
} {
  if (candles.length < period) {
    return { upper: null, lower: null, middle: null, position: null, width: null };
  }
  const slice = candles.slice(-period);
  const closes = slice.map(c => c.close);
  const middle = mean(closes);
  const sd = stddev(closes);
  const upper = middle + mult * sd;
  const lower = middle - mult * sd;
  const lastClose = candles[candles.length - 1].close;
  const position = upper !== lower ? (lastClose - lower) / (upper - lower) : 0.5;
  const width = middle > 0 ? (upper - lower) / middle : 0;
  return {
    upper: round(upper, 2),
    lower: round(lower, 2),
    middle: round(middle, 2),
    position: round(position, 4),
    width: round(width, 4),
  };
}

// ===== PERCENTILE RANKING (Mandelbrot 1963; Fama 1965) =====
// Nonparametric — immune to fat-tail distortions in financial data.

function percentileRank(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 50;
  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
    else if (v === value) count += 0.5;
  }
  return (count / sortedValues.length) * 100;
}

// ===== Z-SCORE COMPUTATION =====

function zScore(value: number | null, m: number, s: number): number | null {
  if (value === null || s < 0.001) return null;
  return round((value - m) / s, 2);
}

function computeZScores(
  input: ConvergenceInput,
  ivp: number | null,
  ivHvSpread: number | null,
  vrp: number | null,
  hv30: number | null,
  hv60: number | null,
): MispricingTrace['z_scores'] {
  const { peerEntry: stats, peerGroupKey } = lookupPeerStats(input);

  // EDGE-4: vrp_z is scored against the ticker's OWN historical VRP
  // distribution (scan_snapshots, 365d, >= 20 distinct scan days) — never a
  // peer proxy, never a fabricated mean=0 / scaled std. No distribution ⇒ null.
  const vrpHist = input.vrpHistory;
  let vrpZ: number | null = null;
  let vrpZSource: string | null = null;
  if (vrp !== null && vrpHist && vrpHist.values.length >= 2) {
    vrpZ = zScore(vrp, mean(vrpHist.values), stddev(vrpHist.values));
    if (vrpZ !== null) {
      vrpZSource = `own ${vrpHist.distinct_days}-obs VRP history, ${vrpHist.window_days}d, source: ${vrpHist.source}`;
    }
  }

  if (!stats?.metrics) {
    return {
      vrp_z: vrpZ,
      vrp_z_source: vrpZSource,
      ivp_z: null,
      iv_hv_z: null,
      hv_accel_z: null,
      note: `peer_z: null (no peer group data available); vrp_z: ${vrpZSource ?? 'null (no own-history VRP distribution)'}`,
      transform: 'raw' as const,
    };
  }

  const m = stats.metrics;
  const rawIvpStats = m['iv_percentile'];
  const ivHvStats = m['iv_hv_spread'];

  // Peer stats for IVP are computed from raw scanner data (0-1 scale),
  // but the scorer normalizes IVP to 0-100. Align scales before z-score.
  let ivpStats = rawIvpStats;
  if (rawIvpStats && rawIvpStats.mean <= 1.0) {
    ivpStats = { mean: rawIvpStats.mean * 100, std: rawIvpStats.std * 100 };
  }

  const ivpZ = ivpStats ? zScore(ivp, ivpStats.mean, ivpStats.std) : null;
  const ivHvZ = ivHvStats ? zScore(ivHvSpread, ivHvStats.mean, ivHvStats.std) : null;

  // KILL-7 gray ruling (b): the HV-acceleration z uses the REAL peer
  // distribution of hv30 − hv60 (sector-stats now computes it) — never the
  // old assumed mean=0 against the peers' hv30-LEVEL std. No distribution →
  // no z (the component keeps its raw own-data tier score).
  const hvAccel = (hv30 !== null && hv60 !== null) ? hv30 - hv60 : null;
  const hvAccelStats = m['hv_accel'];
  const hvAccelZ = hvAccelStats ? zScore(hvAccel, hvAccelStats.mean, hvAccelStats.std) : null;

  // Determine transform type based on peer count
  const peerCount = stats.ticker_count ?? 0;
  const peerGroupName = stats.peer_group_name ?? peerGroupKey;
  const transform: 'percentile' | 'z-score-fallback' | 'raw' =
    peerCount >= 5 ? 'percentile' : peerCount >= 3 ? 'z-score-fallback' : 'raw';

  return {
    vrp_z: vrpZ,
    vrp_z_source: vrpZSource,
    ivp_z: ivpZ,
    iv_hv_z: ivHvZ,
    hv_accel_z: hvAccelZ,
    note: `peer z-scores vs ${peerGroupName} peers (n=${peerCount}, transform=${transform}); vrp_z: ${vrpZSource ?? 'null (no own-history VRP distribution)'}`,
    transform,
  };
}

// ===== MISPRICING SUB-SCORE =====

function scoreMispricing(input: ConvergenceInput): MispricingTrace {
  const tt = input.ttScanner;
  const iv30 = tt?.iv30 ?? null;
  const hv30 = tt?.hv30 ?? null;
  const hv60 = tt?.hv60 ?? null;
  const hv90 = tt?.hv90 ?? null;
  let ivp = tt?.ivPercentile ?? null;
  // TastyTrade returns IVP as decimal (0.693 = 69.3%); normalize to 0-100 scale
  if (ivp !== null && ivp <= 1.0) ivp = round(ivp * 100, 1);
  const ivHvSpread = tt?.ivHvSpread ?? null;
  let ivr = tt?.ivRank ?? null;
  // TastyTrade may return IVR as decimal; normalize to 0-100 scale
  if (ivr !== null && ivr > 0 && ivr <= 1.0) ivr = round(ivr * 100, 1);

  // VRP = IV30 - HV30 simple difference (Goyal & Saretto 2009, JFE; Carr & Wu 2009, RFS)
  // Simple difference avoids ratio-form compression in high-IV environments
  let vrp: number | null = null;
  let vrpStr = 'N/A (missing IV30 or HV30)';
  if (iv30 !== null && hv30 !== null) {
    vrp = iv30 - hv30;
    vrpStr = `${iv30} − ${hv30} = ${round(vrp, 2)} (${vrp > 0 ? 'positive = IV overpriced vs RV' : 'negative = IV underpriced vs RV'})`;
  }

  // Compute z-scores for sector-relative comparison
  const zScores = computeZScores(input, ivp, ivHvSpread, vrp, hv30, hv60);
  const { peerEntry, peerGroupKey } = lookupPeerStats(input);
  // Peer-relative transforms apply to IVP / IV_HV / HV_accel only — VRP is
  // own-history-based (EDGE-4) and never enters a peer transform.
  const hasPeerZScores = zScores.ivp_z !== null ||
                     zScores.iv_hv_z !== null || zScores.hv_accel_z !== null;
  const peerCount = peerEntry?.ticker_count ?? 0;

  // --- VRP component (0.30) — EDGE-4: own-history distribution ONLY ---
  // Percentile of today's VRP within the ticker's own 365d VRP series from
  // scan_snapshots (>= 20 distinct scan days). No peer proxy, no fixed linear
  // map, no fabricated mean/std. If the distribution cannot be computed the
  // signal is null → EXCLUDED from the composite → weights renormalize.
  const vrpHist = input.vrpHistory;
  let vrpScore: number | null = null;
  let vrpSourceLabel: string;
  if (vrp !== null && vrpHist && vrpHist.values.length >= 20) {
    const sortedHist = [...vrpHist.values].sort((a, b) => a - b);
    vrpScore = round(percentileRank(vrp, sortedHist), 1);
    vrpSourceLabel = `calculated: percentile of VRP vs own ${vrpHist.distinct_days}-obs history, ${vrpHist.window_days}d, source: ${vrpHist.source}`;
  } else if (vrp === null) {
    vrpSourceLabel = 'EXCLUDED — VRP not computable (missing IV30 or HV30)';
  } else {
    vrpSourceLabel = 'EXCLUDED — no own-history VRP distribution (< 20 distinct scan days in 365d of scan_snapshots)';
  }

  // --- Raw scores (KILL-6: missing → null → EXCLUDED + renormalized; the
  // old penalty-40s entered the composite whenever a feed was absent) ---

  // IVP component: IVP directly maps 0-100
  const ivpScoreRaw: number | null = ivp !== null ? clamp(ivp, 0, 100) : null;

  // IVR component: same identity mapping as IVP (null if unavailable)
  const ivrScoreRaw = ivr !== null ? clamp(ivr, 0, 100) : null;

  // IV-HV spread component: higher absolute spread = more mispricing
  let ivHvSpreadScoreRaw: number | null = null;
  if (ivHvSpread !== null) {
    ivHvSpreadScoreRaw = clamp((Math.abs(ivHvSpread) / 20) * 100, 0, 100);
  }

  // HV acceleration component: HV30 vs HV60 vs HV90 trend
  let hvAccelScoreRaw: number | null = null;
  let hvTrend = 'UNKNOWN (missing HV data)';
  if (hv30 !== null && hv60 !== null && hv90 !== null) {
    if (hv30 < hv60 && hv60 < hv90) {
      hvTrend = `FALLING (HV30=${hv30} < HV60=${hv60} < HV90=${hv90}) → bullish for premium selling`;
      hvAccelScoreRaw = 80;
    } else if (hv30 < hv60) {
      hvTrend = `DECLINING (HV30=${hv30} < HV60=${hv60}, HV90=${hv90}) → moderately bullish`;
      hvAccelScoreRaw = 65;
    } else if (hv30 > hv60 && hv60 > hv90) {
      hvTrend = `RISING (HV30=${hv30} > HV60=${hv60} > HV90=${hv90}) → bearish for premium selling`;
      hvAccelScoreRaw = 20;
    } else if (hv30 > hv60) {
      hvTrend = `ACCELERATING (HV30=${hv30} > HV60=${hv60}, HV90=${hv90}) → caution`;
      hvAccelScoreRaw = 35;
    } else {
      hvTrend = `FLAT (HV30=${hv30}, HV60=${hv60}, HV90=${hv90})`;
      hvAccelScoreRaw = 50;
    }
  }

  // --- Apply peer-relative transform when peers available (pipeline mode) ---
  // Mandelbrot 1963; Fama 1965: fat-tailed financial data distorts linear z-score transforms.
  // ≥5 peers → percentile ranking (nonparametric, immune to distributional assumptions)
  // 3-4 peers → z-score fallback (multiplier=10, clip=±5 SD — less aggressive)
  // <3 peers → raw scores (no normalization)
  // EDGE-4: VRP is NOT in these branches — it is scored only against its own
  // history above (the old peer iv_hv_spread proxy percentile and the
  // zScore(vrp, 0, …) fallback are removed).
  let ivpScore: number | null = ivpScoreRaw;
  let ivHvSpreadScore: number | null = ivHvSpreadScoreRaw;
  let hvAccelScore: number | null = hvAccelScoreRaw;

  const peerMetrics = peerEntry?.metrics;

  if (hasPeerZScores && zScores.transform === 'percentile' && peerMetrics) {
    // Percentile ranking: value's rank within sorted peer values → 0-100 score
    const rawIvpSorted = peerMetrics['iv_percentile']?.sortedValues;
    const ivHvSorted = peerMetrics['iv_hv_spread']?.sortedValues;
    // KILL-7: HV accel ranks against the REAL peer hv_accel distribution
    const hvAccelSorted = peerMetrics['hv_accel']?.sortedValues;

    if (ivp !== null && rawIvpSorted?.length) {
      // Align scale: sorted values may be 0-1, ivp is 0-100
      const ivpSorted = rawIvpSorted[0] <= 1.0 && rawIvpSorted.length > 0
        ? rawIvpSorted.map(v => v * 100)
        : rawIvpSorted;
      ivpScore = round(percentileRank(ivp, ivpSorted), 1);
    }
    if (ivHvSpread !== null && ivHvSorted?.length) {
      ivHvSpreadScore = round(percentileRank(ivHvSpread, ivHvSorted), 1);
    }
    if (hv30 !== null && hv60 !== null && hvAccelSorted?.length) {
      const hvAccelVal = hv30 - hv60;
      hvAccelScore = round(percentileRank(hvAccelVal, hvAccelSorted), 1);
    }
  } else if (hasPeerZScores && zScores.transform === 'z-score-fallback') {
    // 3-4 peers: z-score with reduced multiplier (10) and extended clip (±5 SD)
    if (zScores.ivp_z !== null) {
      ivpScore = round(50 + clamp(zScores.ivp_z * 10, -50, 50), 1);
    }
    if (zScores.iv_hv_z !== null) {
      ivHvSpreadScore = round(50 + clamp(zScores.iv_hv_z * 10, -50, 50), 1);
    }
    if (zScores.hv_accel_z !== null) {
      hvAccelScore = round(50 + clamp(zScores.hv_accel_z * 10, -50, 50), 1);
    }
  }
  // else: transform === 'raw' — use raw scores unchanged

  // --- IV Composite: blend IVP and IVR when both available ---
  // IVR uses raw score (no IVR-specific peer stats); IVP retains peer transform.
  const ivrScore = ivrScoreRaw; // null if IVR unavailable
  let ivCompositeScore: number | null;
  let ivCompositeMethod: string;
  // KILL-6: IVP missing no longer scores 40 — the composite renormalizes over
  // whichever of IVP/IVR is present; both missing → EXCLUDED (null).
  const ivcCombined = combineWeighted([
    { key: 'ivp', weight: 0.60, score: ivpScore },
    { key: 'ivr', weight: 0.40, score: ivrScore },
  ]);
  ivCompositeScore = ivcCombined.score;
  if (ivpScore !== null && ivrScore !== null) ivCompositeMethod = '0.60×IVP + 0.40×IVR';
  else if (ivpScore !== null) ivCompositeMethod = 'IVP only (IVR unavailable)';
  else if (ivrScore !== null) ivCompositeMethod = 'IVR only (IVP unavailable)';
  else ivCompositeMethod = 'EXCLUDED (IVP and IVR unavailable)';

  // Weights: 0.30×VRP + 0.30×IVComposite + 0.25×IV_HV_spread + 0.15×HV_accel
  // EDGE-4/KILL-6 combiner: every missing component is EXCLUDED and the
  // remaining weights renormalize (never imputed, never proxied). All four
  // missing → the whole mispricing section is EXCLUDED from vol-edge.
  const mispricingCombined = combineWeighted([
    { key: 'vrp', weight: 0.30, score: vrpScore },
    { key: 'ivp', weight: 0.30, score: ivCompositeScore },
    { key: 'iv_hv_spread', weight: 0.25, score: ivHvSpreadScore },
    { key: 'hv_accel', weight: 0.15, score: hvAccelScore },
  ]);
  const activeWeight = mispricingCombined.activeWeight;
  let score = mispricingCombined.score;

  // High Conviction Bonus: when IVP and IVR both > 50 and within 15 points, add +5
  const highConvictionIv = ivp !== null && ivr !== null &&
    ivp > 50 && ivr > 50 && Math.abs(ivp - ivr) <= 15;
  if (score !== null && highConvictionIv) {
    score = Math.min(100, round(score + 5, 1));
  }

  // Post-Spike Detector (trace only — does NOT affect score)
  let volRegime: 'POST_SPIKE' | 'SPIKE_BUILDING' | 'NORMAL' = 'NORMAL';
  let volRegimeNote = '';
  if (ivp !== null && ivr !== null) {
    if (ivp > 60 && ivr < 30) {
      volRegime = 'POST_SPIKE';
      volRegimeNote = 'IVP>60 + IVR<30 = vol recently spiked, now normalizing — historically favorable for premium selling (mean reversion)';
    } else if (ivp < 30 && ivr > 60) {
      volRegime = 'SPIKE_BUILDING';
      volRegimeNote = 'IVP<30 + IVR>60 = vol building from low base — watch for breakout';
    }
  }

  const peerGroupName = peerEntry?.peer_group_name ?? peerGroupKey;
  const mode = hasPeerZScores
    ? `${zScores.transform} mode (peers: ${peerGroupName}, n=${peerCount})`
    : 'raw mode (single ticker, no peer group)';
  // EDGE-4: the formula string the UI shows carries the VRP source label —
  // own-history percentile when present, or the explicit exclusion +
  // renormalization when absent. What the UI shows == what fires.
  const fmtM = (v: number | null) => (v !== null ? String(round(v, 1)) : 'EXCLUDED');
  const vrpTerm = vrpScore !== null
    ? `0.30×VRP(${round(vrpScore, 1)} [${vrpSourceLabel}])`
    : `VRP ${vrpSourceLabel}`;
  const formula = `${vrpTerm} + 0.30×IVComposite(${fmtM(ivCompositeScore)} [${ivCompositeMethod}]) + 0.25×IV_HV(${fmtM(ivHvSpreadScore)}) + 0.15×HV_accel(${fmtM(hvAccelScore)})${mispricingCombined.excludedKeys.length > 0 && score !== null ? ` [missing excluded, weights renormalized ÷${round(activeWeight, 2)}]` : ''} = ${score !== null ? round(score) : 'EXCLUDED (no component data)'}${highConvictionIv && score !== null ? ' +5 high conviction' : ''} [${mode}]`;

  const vrpNote = vrpScore !== null
    ? `VRP=${round(vrpScore)}(own-history percentile,z=${zScores.vrp_z ?? 'null'})`
    : 'VRP=EXCLUDED(no own-history distribution)';
  const fmtN = (v: number | null) => (v !== null ? String(round(v)) : 'EXCLUDED');
  return {
    // KILL-6: 0 + weight set to 0 by scoreVolEdge when the whole section is
    // EXCLUDED (no component data) — never an imputed value.
    score: score !== null ? round(score) : 0,
    weight: 0.50,
    active_signal_count: mispricingCombined.activeCount,
    total_signal_count: mispricingCombined.totalCount,
    excluded_components: mispricingCombined.excludedKeys.map(k => `mispricing.${k}`),
    inputs: {
      IV_30: iv30,
      HV_30: hv30,
      HV_60: hv60,
      HV_90: hv90,
      IV_rank: ivr,
      IV_percentile: ivp,
      IV_HV_spread: ivHvSpread,
      VRP: vrpStr,
    },
    vrp_score: vrpScore,
    z_scores: zScores,
    formula,
    notes: hasPeerZScores
      ? `${vrpNote}, IVComposite=${fmtN(ivCompositeScore)}(IVP=${fmtN(ivpScore)},IVR=${ivrScore !== null ? round(ivrScore) : 'N/A'}), IV_HV=${fmtN(ivHvSpreadScore)}(raw=${fmtN(ivHvSpreadScoreRaw)},z=${zScores.iv_hv_z}), HV_accel=${fmtN(hvAccelScore)}(raw=${fmtN(hvAccelScoreRaw)},z=${zScores.hv_accel_z})`
      : `${vrpNote}, IVComposite=${fmtN(ivCompositeScore)}(IVP=${fmtN(ivpScore)},IVR=${ivrScore !== null ? round(ivrScore) : 'N/A'}), IV_HV=${fmtN(ivHvSpreadScore)}, HV_accel=${fmtN(hvAccelScore)}`,
    hv_trend: hvTrend,
    iv_composite: {
      iv_rank: ivr,
      iv_percentile: ivp,
      iv_composite_score: ivCompositeScore !== null ? round(ivCompositeScore, 1) : null,
      iv_composite_method: ivCompositeMethod,
      high_conviction_iv: highConvictionIv,
      vol_regime: volRegime,
      vol_regime_note: volRegimeNote,
    },
  };
}

// ===== TERM STRUCTURE SUB-SCORE =====

function scoreTermStructure(input: ConvergenceInput): TermStructureTrace {
  const ts = input.ttScanner?.termStructure ?? [];
  const earningsDate = input.ttScanner?.earningsDate ?? null;

  if (ts.length < 2) {
    // KILL-6: < 2 expirations means the slope is NOT COMPUTABLE — the section
    // is EXCLUDED (weight 0, renormalized by scoreVolEdge), never a penalty 40.
    return {
      score: 0,
      weight: 0.30,
      active_signal_count: 0,
      total_signal_count: 1,
      excluded_components: ['term_structure'],
      inputs: { expirations_available: ts.length },
      formula: 'EXCLUDED — insufficient term structure data (< 2 expirations); no imputed score, weight renormalized',
      notes: 'Need at least 2 expirations to compute slope',
      shape: 'UNKNOWN',
      richest_tenor: null,
      cheapest_tenor: null,
      optimal_expiration: null,
      expirations_analyzed: ts.length,
      earnings_kink_detected: false,
    };
  }

  // Sort by date ascending
  const sorted = [...ts].sort((a, b) => a.date.localeCompare(b.date));
  const frontIV = sorted[0].iv;
  const backIV = sorted[sorted.length - 1].iv;

  // Slope: percentage difference front to back
  const slope = frontIV > 0 ? (backIV - frontIV) / frontIV : 0;
  const slopeStr = `${round(slope * 100, 1)}%`;

  // Find richest and cheapest tenors
  let richestIdx = 0;
  let cheapestIdx = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].iv > sorted[richestIdx].iv) richestIdx = i;
    if (sorted[i].iv < sorted[cheapestIdx].iv) cheapestIdx = i;
  }
  const richest = sorted[richestIdx];
  const cheapest = sorted[cheapestIdx];

  // Compute DTE for all tenors
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nowMs = now.getTime();
  const sortedWithDte = sorted.map(exp => ({
    ...exp,
    dte: Math.round((new Date(exp.date + 'T00:00:00').getTime() - nowMs) / 86400000),
  }));
  const richestDte = sortedWithDte[richestIdx].dte;

  // Find optimal expiration within theta-efficient DTE range (25-60, fallback 20-90)
  let optCandidates = sortedWithDte.filter(e => e.dte >= 25 && e.dte <= 60);
  let optRangeUsed = '25-60';
  if (optCandidates.length === 0) {
    optCandidates = sortedWithDte.filter(e => e.dte >= 20 && e.dte <= 90);
    optRangeUsed = '20-90';
  }
  let optimalExpirationStr: string;
  if (optCandidates.length > 0) {
    const best = optCandidates.reduce((a, b) => a.iv > b.iv ? a : b);
    optimalExpirationStr = `${best.date} (${best.dte} DTE, IV=${round(best.iv, 3)}) — within ${optRangeUsed} DTE sweet spot`;
  } else {
    optimalExpirationStr = `${richest.date} — highest IV tenor at ${richestDte} DTE (no expirations in 20-90 DTE range)`;
  }

  // Shape classification (kept for trace output; score may be overridden by percentile ranking)
  let shape: string;
  if (slope > 0.15) shape = 'STEEP_CONTANGO';
  else if (slope > 0.05) shape = 'CONTANGO';
  else if (slope > -0.05) shape = 'FLAT';
  else if (slope > -0.15) shape = 'BACKWARDATION';
  else shape = 'STEEP_BACKWARDATION';

  // Percentile-based scoring (Vasquez 2017, JFQA — uses decile sorts, not fixed cutoffs)
  const { peerEntry: tsPeerEntry } = lookupPeerStats(input);
  const slopeSorted = tsPeerEntry?.metrics?.['term_structure_slope']?.sortedValues;
  const slopeStats = tsPeerEntry?.metrics?.['term_structure_slope'];
  const tsPeerCount = tsPeerEntry?.ticker_count ?? 0;

  let shapeScore: number;
  let tsTransform: string;
  if (slopeSorted && slopeSorted.length >= 5 && tsPeerCount >= 5) {
    // >=5 peers: percentile ranking of slope within peer group
    shapeScore = round(percentileRank(slope, slopeSorted), 1);
    tsTransform = 'percentile';
  } else if (slopeStats && slopeStats.std > 0.001 && tsPeerCount >= 3) {
    // 3-4 peers: z-score fallback (multiplier=10, clip=±5 SD)
    const z = (slope - slopeStats.mean) / slopeStats.std;
    shapeScore = round(50 + clamp(z * 10, -50, 50), 1);
    tsTransform = 'z-score-fallback';
  } else {
    // <3 peers or no peer stats: fixed tier fallback
    if (slope > 0.15) shapeScore = 85;
    else if (slope > 0.05) shapeScore = 70;
    else if (slope > -0.05) shapeScore = 50;
    else if (slope > -0.15) shapeScore = 35;
    else shapeScore = 20;
    tsTransform = 'fixed-tiers';
  }

  // Earnings kink detection: if there's an expiration near earnings with notably higher IV
  let earningsKinkDetected = false;
  if (earningsDate) {
    const earningsTime = new Date(earningsDate + 'T00:00:00').getTime();
    for (const exp of sorted) {
      const expTime = new Date(exp.date + 'T00:00:00').getTime();
      const daysDiff = Math.abs(expTime - earningsTime) / 86400000;
      if (daysDiff <= 7) {
        // Check if this expiration's IV is >15% above neighbors
        const idx = sorted.indexOf(exp);
        const prevIV = idx > 0 ? sorted[idx - 1].iv : null;
        const nextIV = idx < sorted.length - 1 ? sorted[idx + 1].iv : null;
        const neighborAvg = prevIV !== null && nextIV !== null
          ? (prevIV + nextIV) / 2
          : prevIV ?? nextIV ?? 0;
        if (neighborAvg > 0 && exp.iv > neighborAvg * 1.15) {
          earningsKinkDetected = true;
        }
      }
    }
  }

  // Kink modifier: if detected, slightly reduce score (earnings inflate near-term IV artificially)
  if (earningsKinkDetected) {
    shapeScore = clamp(shapeScore - 5, 0, 100);
  }

  const formula = `slope=${slopeStr} → shape=${shape} → score=${shapeScore} [${tsTransform}${tsPeerCount > 0 ? ', n=' + tsPeerCount : ''}]${earningsKinkDetected ? ' − 5 (earnings kink)' : ''}`;

  return {
    score: round(shapeScore),
    weight: 0.30,
    active_signal_count: 1,
    total_signal_count: 1,
    excluded_components: [],
    inputs: {
      front_month_iv: round(frontIV, 2),
      back_month_iv: round(backIV, 2),
      slope: `${slopeStr} → ${shape}`,
      expirations_analyzed: sorted.length,
      earnings_date: earningsDate,
    },
    formula,
    notes: `${sorted.length} expirations analyzed. Richest: ${richest.date} (IV=${round(richest.iv, 2)}), Cheapest: ${cheapest.date} (IV=${round(cheapest.iv, 2)})`,
    shape,
    richest_tenor: `${richest.date} (${richestDte} DTE, IV=${round(richest.iv, 2)})`,
    cheapest_tenor: `${cheapest.date} (IV=${round(cheapest.iv, 2)})`,
    optimal_expiration: optimalExpirationStr,
    expirations_analyzed: sorted.length,
    earnings_kink_detected: earningsKinkDetected,
  };
}

// ===== TECHNICALS SUB-SCORE =====

function scoreTechnicals(input: ConvergenceInput): TechnicalsTrace {
  // Sanitize: filter out candles with non-finite OHLCV values
  const rawCandles = input.candles;
  const candles = rawCandles.filter(c =>
    Number.isFinite(c.open) && c.open > 0 &&
    Number.isFinite(c.close) && c.close > 0 &&
    Number.isFinite(c.high) && c.high > 0 &&
    Number.isFinite(c.low) && c.low > 0 &&
    Number.isFinite(c.volume) && c.volume >= 0
  );

  if (candles.length < 20) {
    // KILL-6: fewer than 20 SANITIZED candles (raw feed may have had more —
    // this path was reachable and scored a penalty 40) → the whole technicals
    // section is EXCLUDED (weight 0, renormalized by scoreVolEdge).
    return {
      score: 0,
      weight: 0.20,
      active_signal_count: 0,
      total_signal_count: 1,
      excluded_components: ['technicals'],
      inputs: { candles_available: candles.length },
      formula: `EXCLUDED — insufficient candle data (${candles.length} sanitized < 20 required); no imputed score, weight renormalized`,
      notes: 'Need at least 20 candles for Bollinger Bands and SMA calculations',
      sub_scores: { rsi_score: null, trend_score: null, bollinger_score: null, volume_score: null, high52w_score: null },
      indicators: {
        rsi_14: null, rsi_trace: null, sma_20: null, sma_50: null, latest_close: null,
        bb_upper: null, bb_lower: null, bb_middle: null, bb_position: null, bb_width: null,
        high52w_ratio: null, high52w_range_position: null,
        avg_volume_5d: null, avg_volume_20d: null, volume_ratio: null,
      },
      candles_used: candles.length,
    };
  }

  const latestClose = candles[candles.length - 1].close;

  // RSI — asymmetric scoring for premium-selling context.
  // Oversold (low RSI) drives IV higher than overbought via leverage effect
  // (Carr & Wu 2009, Bollerslev et al. 2009). VRP is highest during elevated
  // uncertainty, making post-selloff environments the best premium-selling setups.
  const rsiResult = computeRSI(candles, 14);
  let rsiScore = 55;
  if (rsiResult.rsi !== null) {
    const rsi = rsiResult.rsi;
    if (rsi <= 20) rsiScore = 90;       // Extreme oversold — peak premium opportunity
    else if (rsi <= 30) rsiScore = 80;  // Oversold — strong premium opportunity
    else if (rsi <= 40) rsiScore = 65;  // Mildly oversold — above average
    else if (rsi <= 60) rsiScore = 55;  // Neutral — baseline, no edge signal
    else if (rsi <= 70) rsiScore = 60;  // Mildly overbought — slightly above neutral
    else if (rsi <= 80) rsiScore = 70;  // Overbought — elevated IV, good for premium
    else rsiScore = 75;                  // Extreme overbought — high IV but less reliable
  }

  // SMAs
  const sma20 = computeSMA(candles, 20);
  const sma50 = computeSMA(candles, 50);

  // Trend score: price position relative to moving averages
  let trendScore = 50;
  if (sma20 !== null && sma50 !== null) {
    if (latestClose > sma20 && sma20 > sma50) {
      trendScore = 70; // Clear uptrend
    } else if (latestClose > sma50 && latestClose > sma20) {
      trendScore = 65; // Above both but not ordered
    } else if (latestClose > sma50) {
      trendScore = 55; // Between SMAs
    } else if (latestClose < sma20 && sma20 < sma50) {
      trendScore = 30; // Clear downtrend
    } else if (latestClose < sma50) {
      trendScore = 35; // Below both
    }
  } else if (sma20 !== null) {
    trendScore = latestClose > sma20 ? 60 : 40;
  }

  // Bollinger Bands
  const bb = computeBollinger(candles, 20, 2);
  // For neutral strategies: price near middle = best, extremes = opportunity but risky
  let bollingerScore = 50;
  if (bb.position !== null) {
    // Score peaks at center (position=0.5), drops at extremes
    bollingerScore = round(100 - 100 * Math.abs(bb.position - 0.5) * 2);
    bollingerScore = clamp(bollingerScore, 0, 100);
  }

  // Volume
  const vol5d = candles.length >= 5 ? round(mean(candles.slice(-5).map(c => c.volume))) : null;
  const vol20d = candles.length >= 20 ? round(mean(candles.slice(-20).map(c => c.volume))) : null;
  const volumeRatio = vol5d !== null && vol20d !== null && vol20d > 0 ? round(vol5d / vol20d, 4) : null;

  // KILL-7 gray ruling (a): volumeRatio is null only when vol20d === 0 — the
  // ratio vol5d/0 is mathematically UNDEFINED, so the component is EXCLUDED
  // (renormalized by the technicals combiner), never a neutral 50. A true
  // vol5d=0 over a positive vol20d IS data and scores the low-volume tier.
  let volumeScore: number | null = null;
  if (volumeRatio !== null) {
    if (volumeRatio > 1.5) volumeScore = 70;      // Elevated volume → more liquid
    else if (volumeRatio > 1.2) volumeScore = 62;
    else if (volumeRatio > 0.8) volumeScore = 55;  // Normal
    else volumeScore = 40;                          // Low volume → less liquid
  }

  // 52-Week High Ratio (George & Hwang 2004, Journal of Finance)
  // Strongest documented momentum signal: 0.65% monthly returns, dominates
  // Jegadeesh-Titman momentum (0.38%), does not reverse long-run.
  // Stocks near 52-week highs have lower realized vol and cleaner VRP capture.
  const high52w = input.finnhubFundamentals?.metric?.['52WeekHigh'];
  const low52w = input.finnhubFundamentals?.metric?.['52WeekLow'];
  const high52wNum = typeof high52w === 'number' && high52w > 0 ? high52w : null;
  const low52wNum = typeof low52w === 'number' && low52w > 0 ? low52w : null;
  const high52wRatio = high52wNum !== null ? round(latestClose / high52wNum, 4) : null;
  const high52wRangePosition = high52wNum !== null && low52wNum !== null && high52wNum > low52wNum
    ? round((latestClose - low52wNum) / (high52wNum - low52wNum), 4)
    : null;

  // KILL-6: missing Finnhub 52-week data → component EXCLUDED + renormalized
  // (was a penalty 40 entering at 0.15 weight).
  let high52wScore: number | null = null;
  if (high52wRatio !== null) {
    if (high52wRatio >= 0.95) high52wScore = 85;
    else if (high52wRatio >= 0.90) high52wScore = 75;
    else if (high52wRatio >= 0.80) high52wScore = 60;
    else if (high52wRatio >= 0.70) high52wScore = 45;
    else if (high52wRatio >= 0.60) high52wScore = 35;
    else high52wScore = 25;
  }

  // Weighted combination: RSI 25%, trend 25%, bollinger 20%, volume 15%, 52-week high 15%
  // KILL-6 combiner: a missing 52-week-high component is EXCLUDED and the
  // remaining weights renormalize (RSI/trend/BB/volume are always computable
  // from the >= 20 real candles guaranteed above).
  const techCombined = combineWeighted([
    { key: 'rsi', weight: 0.25, score: rsiScore },
    { key: 'trend', weight: 0.25, score: trendScore },
    { key: 'bollinger', weight: 0.20, score: bollingerScore },
    { key: 'volume', weight: 0.15, score: volumeScore },
    { key: 'high52w', weight: 0.15, score: high52wScore },
  ]);
  const score = techCombined.score as number; // >= 4 components always present

  const fmtT = (v: number | null) => (v !== null ? String(round(v)) : 'EXCLUDED');
  const excludedTech = [volumeScore === null ? 'volume' : null, high52wScore === null ? 'high52w' : null].filter(Boolean);
  const formula = `0.25×RSI(${round(rsiScore)}) + 0.25×Trend(${round(trendScore)}) + 0.20×BB(${round(bollingerScore)}) + 0.15×Vol(${fmtT(volumeScore)}) + 0.15×52WkHigh(${fmtT(high52wScore)})${excludedTech.length > 0 ? ` [${excludedTech.join('+')} excluded, weights renormalized ÷${round(techCombined.activeWeight, 2)}]` : ''} = ${score}`;

  return {
    score: round(score),
    weight: 0.20,
    active_signal_count: techCombined.activeCount,
    total_signal_count: techCombined.totalCount,
    excluded_components: techCombined.excludedKeys.map(k => `technicals.${k}`),
    inputs: {
      candles_available: candles.length,
      latest_close: latestClose,
    },
    formula,
    notes: `RSI(14)=${rsiResult.rsi ?? 'N/A'}, SMA20=${sma20 ?? 'N/A'}, SMA50=${sma50 ?? 'N/A'}, BB_pos=${bb.position ?? 'N/A'}, 52WkHigh_ratio=${high52wRatio ?? 'N/A'}`,
    sub_scores: {
      rsi_score: round(rsiScore),
      trend_score: round(trendScore),
      bollinger_score: round(bollingerScore),
      volume_score: volumeScore !== null ? round(volumeScore) : null,
      high52w_score: high52wScore !== null ? round(high52wScore) : null,
    },
    indicators: {
      rsi_14: rsiResult.rsi,
      rsi_trace: rsiResult.rsi !== null ? { avg_gain: rsiResult.avgGain, avg_loss: rsiResult.avgLoss, rs: rsiResult.rs } : null,
      sma_20: sma20,
      sma_50: sma50,
      latest_close: round(latestClose, 2),
      bb_upper: bb.upper,
      bb_lower: bb.lower,
      bb_middle: bb.middle,
      bb_position: bb.position,
      bb_width: bb.width,
      high52w_ratio: high52wRatio,
      high52w_range_position: high52wRangePosition,
      avg_volume_5d: vol5d,
      avg_volume_20d: vol20d,
      volume_ratio: volumeRatio,
    },
    candles_used: candles.length,
  };
}

// ===== OPTIONS SKEW SUB-SCORE (Cremers & Weinbaum 2010) =====
// Deviations from put-call parity predict stock returns.
// High put-vs-call skew = downside fear = bearish. Low skew = bullish.

function scoreOptionsSkew(input: ConvergenceInput): SkewTrace {
  const flow = input.optionsFlow;
  const chain = flow?.chainDetail;
  const spot = flow?.underlyingPrice ?? null;

  if (!chain || chain.length === 0 || spot === null || spot <= 0) {
    // KILL-6: no chain data → EXCLUDED (weight 0, renormalized) — the old
    // trace displayed a fabricated neutral 50.
    return {
      score: 0, weight: 0.10,
      active_signal_count: 0, total_signal_count: 1, excluded_components: ['skew'],
      inputs: { data_available: false },
      formula: 'EXCLUDED — no options chain data; no imputed score, weight renormalized',
      notes: 'Skew scoring requires per-strike IV data from options chain',
      vol_skew_25d: null, pc_iv_ratio_atm: null,
      skew_direction: 'neutral', skew_score: 0,
    };
  }

  // Use nearest monthly expiration (closest to 30 DTE, minimum 7 DTE)
  const sorted = [...chain]
    .filter(e => e.dte >= 7)
    .sort((a, b) => Math.abs(a.dte - 30) - Math.abs(b.dte - 30));

  if (sorted.length === 0) {
    // KILL-6: chain present but no usable expiration — the metric inputs are
    // MISSING, not thin: EXCLUDED, never a neutral 50 at live weight.
    return {
      score: 0, weight: 0.10,
      active_signal_count: 0, total_signal_count: 1, excluded_components: ['skew'],
      inputs: { data_available: false, expirations: chain.length },
      formula: 'EXCLUDED — no expirations >= 7 DTE; no imputed score, weight renormalized',
      notes: 'Need at least one expiration with 7+ DTE for skew computation',
      vol_skew_25d: null, pc_iv_ratio_atm: null,
      skew_direction: 'neutral', skew_score: 0,
    };
  }

  const nearExp = sorted[0];
  const strikes = nearExp.strikes;

  // --- Metric 1: Volatility Skew (25-delta approximation) ---
  // Use OTM puts at ~5% below spot vs OTM calls at ~5% above spot
  const putTarget = spot * 0.95;
  const callTarget = spot * 1.05;

  // Find closest strike to each target that has IV data
  let bestPutStrike: OptionsChainStrike | null = null;
  let bestPutDist = Infinity;
  let bestCallStrike: OptionsChainStrike | null = null;
  let bestCallDist = Infinity;

  for (const s of strikes) {
    if (s.putIV !== null && s.putIV > 0 && s.strike <= spot) {
      const dist = Math.abs(s.strike - putTarget);
      if (dist < bestPutDist) { bestPutDist = dist; bestPutStrike = s; }
    }
    if (s.callIV !== null && s.callIV > 0 && s.strike >= spot) {
      const dist = Math.abs(s.strike - callTarget);
      if (dist < bestCallDist) { bestCallDist = dist; bestCallStrike = s; }
    }
  }

  const putIV25d = bestPutStrike?.putIV ?? null;
  const callIV25d = bestCallStrike?.callIV ?? null;
  let volSkew25d: number | null = null;
  if (putIV25d !== null && callIV25d !== null && callIV25d > 0) {
    volSkew25d = round(putIV25d - callIV25d, 4);
  }

  // --- Metric 2: Put-Call IV Ratio (ATM) ---
  // Find ATM strike (closest to spot)
  let atmStrike: OptionsChainStrike | null = null;
  let atmDist = Infinity;
  for (const s of strikes) {
    const dist = Math.abs(s.strike - spot);
    if (dist < atmDist && s.callIV !== null && s.putIV !== null && s.callIV > 0 && s.putIV > 0) {
      atmDist = dist;
      atmStrike = s;
    }
  }

  let pcIvRatioAtm: number | null = null;
  if (atmStrike?.putIV !== null && atmStrike?.callIV !== null && atmStrike!.callIV! > 0) {
    pcIvRatioAtm = round(atmStrike!.putIV! / atmStrike!.callIV!, 4);
  }

  // --- Combine into skew score (0-100) ---
  // Bullish skew (low vol skew + low PC IV ratio) → high score
  // Bearish skew (high vol skew + high PC IV ratio) → low score
  let skewScoreFromVol = 50;
  if (volSkew25d !== null) {
    // Typical skew ranges: -0.05 (calls rich) to +0.20 (puts rich)
    // Map: -0.05 → 90, 0.0 → 70, 0.05 → 55, 0.10 → 40, 0.15 → 25, 0.20 → 10
    skewScoreFromVol = clamp(round(70 - (volSkew25d / 0.20) * 60), 0, 100);
  }

  let skewScoreFromPCR = 50;
  if (pcIvRatioAtm !== null) {
    // Ratio < 0.95 → calls overpriced → bullish → score ~70
    // Ratio 0.95-1.05 → neutral → 50
    // Ratio > 1.05 → puts overpriced → bearish → score ~30
    if (pcIvRatioAtm < 0.95) {
      skewScoreFromPCR = clamp(round(50 + (0.95 - pcIvRatioAtm) * 400), 50, 90);
    } else if (pcIvRatioAtm > 1.05) {
      skewScoreFromPCR = clamp(round(50 - (pcIvRatioAtm - 1.05) * 400), 10, 50);
    }
  }

  // Weighted blend: 60% vol skew (more informative), 40% PC IV ratio
  const hasVolSkew = volSkew25d !== null;
  const hasPCR = pcIvRatioAtm !== null;
  // KILL-6: single-metric paths STAY (computed from present data, labeled by
  // the formula); NEITHER metric computable = the per-strike IV needed is
  // MISSING → the section is EXCLUDED, never a fabricated neutral 50.
  if (!hasVolSkew && !hasPCR) {
    return {
      score: 0, weight: 0.10,
      active_signal_count: 0, total_signal_count: 1, excluded_components: ['skew'],
      inputs: { data_available: false, expiration_used: nearExp.expirationDate, dte: nearExp.dte, spot_price: round(spot, 2) },
      formula: 'EXCLUDED — no per-strike IV usable for either skew metric; no imputed score, weight renormalized',
      notes: 'Neither 25d vol skew nor ATM put/call IV ratio computable from the chain feed',
      vol_skew_25d: null, pc_iv_ratio_atm: null,
      skew_direction: 'neutral', skew_score: 0,
    };
  }
  let skewScore: number;
  if (hasVolSkew && hasPCR) {
    skewScore = round(0.60 * skewScoreFromVol + 0.40 * skewScoreFromPCR, 1);
  } else if (hasVolSkew) {
    skewScore = skewScoreFromVol;
  } else {
    skewScore = skewScoreFromPCR;
  }

  const skewDirection: 'bullish' | 'bearish' | 'neutral' =
    skewScore >= 60 ? 'bullish' : skewScore <= 40 ? 'bearish' : 'neutral';

  const formula = `0.60×VolSkew(${round(skewScoreFromVol)}) + 0.40×PCIVR(${round(skewScoreFromPCR)}) = ${round(skewScore)} [exp=${nearExp.expirationDate}, ${nearExp.dte}DTE]`;

  return {
    score: round(skewScore),
    weight: 0.10,
    active_signal_count: 1,
    total_signal_count: 1,
    excluded_components: [],
    inputs: {
      data_available: true,
      expiration_used: nearExp.expirationDate,
      dte: nearExp.dte,
      spot_price: round(spot, 2),
      put_strike_25d: bestPutStrike?.strike ?? null,
      call_strike_25d: bestCallStrike?.strike ?? null,
      atm_strike: atmStrike?.strike ?? null,
    },
    formula,
    notes: `Vol skew 25d=${volSkew25d !== null ? round(volSkew25d, 4) : 'N/A'}, PC IV ratio ATM=${pcIvRatioAtm !== null ? round(pcIvRatioAtm, 4) : 'N/A'}, direction=${skewDirection}`,
    vol_skew_25d: volSkew25d,
    pc_iv_ratio_atm: pcIvRatioAtm,
    skew_direction: skewDirection,
    skew_score: round(skewScore),
  };
}

// ===== GAMMA EXPOSURE (GEX) SUB-SCORE =====
// Net dealer gamma exposure predicts realized volatility.
// Positive GEX (spot above flip) → vol suppressed → good for premium selling.
// Negative GEX (spot below flip) → vol amplified → risky.

/** Standard normal PDF */
function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Black-Scholes gamma for a single option */
function bsGamma(spot: number, strike: number, iv: number, dte: number, riskFreeRate: number): number {
  if (iv <= 0 || dte <= 0 || spot <= 0) return 0;
  const T = dte / 365;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (riskFreeRate + 0.5 * iv * iv) * T) / (iv * sqrtT);
  return normalPdf(d1) / (spot * iv * sqrtT);
}

function scoreGammaExposure(input: ConvergenceInput): GEXTrace {
  const flow = input.optionsFlow;
  const chain = flow?.chainDetail;
  const spot = flow?.underlyingPrice ?? null;

  if (!chain || chain.length === 0 || spot === null || spot <= 0) {
    // KILL-6: no chain data → EXCLUDED (weight 0, renormalized) — the old
    // trace displayed a fabricated neutral 50.
    return {
      score: 0, weight: 0.10,
      active_signal_count: 0, total_signal_count: 1, excluded_components: ['gex'],
      inputs: { data_available: false },
      formula: 'EXCLUDED — no options chain data; no imputed score, weight renormalized',
      notes: 'GEX scoring requires per-strike OI and IV data from options chain',
      net_gex: null, gex_flip_strike: null,
      distance_to_flip_pct: null, gex_regime: 'neutral', gex_score: 0,
    };
  }

  // KILL-6: the risk-free rate is the REAL fetched FRED 10Y (DGS10) — the old
  // `?? 4.5` silently priced BS gamma off a hardcoded rate whenever the series
  // was missing. Missing rate → GEX is not computable honestly → EXCLUDED.
  if (input.fredMacro?.treasury10y == null) {
    return {
      score: 0, weight: 0.10,
      active_signal_count: 0, total_signal_count: 1, excluded_components: ['gex'],
      inputs: { data_available: true, risk_free_rate: null },
      formula: 'EXCLUDED — FRED treasury10y (DGS10) unavailable; BS gamma needs the real risk-free rate (never a hardcoded 4.5%); weight renormalized',
      notes: 'GEX requires the fetched DGS10 rate — feed unavailable this run',
      net_gex: null, gex_flip_strike: null,
      distance_to_flip_pct: null, gex_regime: 'neutral', gex_score: 0,
    };
  }
  const rfr = input.fredMacro.treasury10y / 100;

  // Compute GEX across all near-term expirations
  // For each strike: call_GEX = call_OI × call_gamma × 100 × spot
  //                  put_GEX  = -1 × put_OI × put_gamma × 100 × spot
  // (puts negative because dealers are typically short puts)

  let totalGex = 0;
  const perStrikeGex: { strike: number; gex: number }[] = [];

  for (const exp of chain) {
    if (exp.dte < 1) continue;
    for (const s of exp.strikes) {
      let strikeGex = 0;

      if (s.callIV !== null && s.callIV > 0 && s.callOI != null && s.callOI > 0) {
        const gamma = bsGamma(spot, s.strike, s.callIV, exp.dte, rfr);
        strikeGex += s.callOI * gamma * 100 * spot;
      }
      if (s.putIV !== null && s.putIV > 0 && s.putOI != null && s.putOI > 0) {
        const gamma = bsGamma(spot, s.strike, s.putIV, exp.dte, rfr);
        strikeGex += -1 * s.putOI * gamma * 100 * spot;
      }

      if (strikeGex !== 0) {
        totalGex += strikeGex;
        perStrikeGex.push({ strike: s.strike, gex: strikeGex });
      }
    }
  }

  // Find GEX flip point: strike where cumulative gamma crosses zero
  // Sort by strike ascending and find zero-crossing
  perStrikeGex.sort((a, b) => a.strike - b.strike);
  let flipStrike: number | null = null;
  let cumulativeGex = 0;
  for (let i = 0; i < perStrikeGex.length; i++) {
    const prevCumulative = cumulativeGex;
    cumulativeGex += perStrikeGex[i].gex;
    // Detect sign change
    if (prevCumulative >= 0 && cumulativeGex < 0) {
      flipStrike = perStrikeGex[i].strike;
      break;
    } else if (prevCumulative < 0 && cumulativeGex >= 0) {
      flipStrike = perStrikeGex[i].strike;
      break;
    }
  }

  // If no flip found, set flip to highest or lowest strike based on net GEX sign
  if (flipStrike === null && perStrikeGex.length > 0) {
    if (totalGex > 0) {
      // All positive — flip is below the chain
      flipStrike = perStrikeGex[0].strike;
    } else {
      // All negative — flip is above the chain
      flipStrike = perStrikeGex[perStrikeGex.length - 1].strike;
    }
  }

  // Distance to flip
  const distanceToFlipPct = flipStrike !== null
    ? round((spot - flipStrike) / spot * 100, 2)
    : null;

  // Determine regime
  let gexRegime: 'long_gamma' | 'short_gamma' | 'neutral';
  if (distanceToFlipPct !== null) {
    if (distanceToFlipPct > 1) gexRegime = 'long_gamma';       // spot well above flip
    else if (distanceToFlipPct < -1) gexRegime = 'short_gamma'; // spot below flip
    else gexRegime = 'neutral';                                  // near flip point
  } else {
    gexRegime = 'neutral';
  }

  // Scoring:
  // High positive GEX (spot well above flip) → low realized vol → high score
  // Negative GEX (spot below flip) → amplified moves → low score
  // Near flip → neutral
  // KILL-6: distanceToFlipPct is null only when NO strike had usable OI+IV
  // (perStrikeGex empty) — the inputs are MISSING → EXCLUDED, never a 50.
  if (distanceToFlipPct === null) {
    return {
      score: 0, weight: 0.10,
      active_signal_count: 0, total_signal_count: 1, excluded_components: ['gex'],
      inputs: { data_available: true, spot_price: round(spot, 2), risk_free_rate: round(rfr * 100, 2), strikes_computed: 0 },
      formula: 'EXCLUDED — no strike had usable OI+IV to compute dealer gamma; no imputed score, weight renormalized',
      notes: 'GEX flip point not computable from the chain feed',
      net_gex: null, gex_flip_strike: null,
      distance_to_flip_pct: null, gex_regime: 'neutral', gex_score: 0,
    };
  }
  // Map distance: +5% → 85, +2% → 70, 0% → 50, -2% → 30, -5% → 15
  const gexScore: number = clamp(round(50 + distanceToFlipPct * 7), 0, 100);

  // Normalize net GEX for display (in millions of dollar-gamma)
  const netGexDisplay = round(totalGex / 1_000_000, 2);

  const formula = `distToFlip=${distanceToFlipPct ?? 'N/A'}% → regime=${gexRegime} → score=${round(gexScore)} [netGEX=${netGexDisplay}M, flip=${flipStrike ?? 'N/A'}]`;

  return {
    score: round(gexScore),
    weight: 0.10,
    active_signal_count: 1,
    total_signal_count: 1,
    excluded_components: [],
    inputs: {
      data_available: true,
      spot_price: round(spot, 2),
      risk_free_rate: round(rfr * 100, 2),
      strikes_computed: perStrikeGex.length,
      expirations_used: chain.filter(e => e.dte >= 1).length,
    },
    formula,
    notes: `Net GEX=${netGexDisplay}M $-gamma, flip=${flipStrike ?? 'N/A'}, dist=${distanceToFlipPct ?? 'N/A'}%, regime=${gexRegime}`,
    net_gex: netGexDisplay,
    gex_flip_strike: flipStrike,
    distance_to_flip_pct: distanceToFlipPct,
    gex_regime: gexRegime,
    gex_score: round(gexScore),
  };
}

// ===== MAIN VOL EDGE SCORER =====

export function scoreVolEdge(input: ConvergenceInput): VolEdgeResult {
  const mispricing = scoreMispricing(input);
  const termStructure = scoreTermStructure(input);
  const skew = scoreOptionsSkew(input);
  const gex = scoreGammaExposure(input);
  // KILL-6: scoreTechnicals handles its own exclusion (< 20 SANITIZED candles
  // → EXCLUDED trace) — the old raw-length check here missed the case where
  // raw >= 20 but sanitized < 20, which then scored a penalty 40.
  const technicals: TechnicalsTrace = scoreTechnicals(input);

  // Weight rebalance (before → after):
  //   Mispricing:      0.50 → 0.40
  //   Term Structure:  0.30 → 0.25
  //   Technicals:      0.20 → 0.15
  //   Skew (NEW):      —    → 0.10
  //   GEX (NEW):       —    → 0.10
  //   Total:           1.00 → 1.00
  // Skew and GEX are partially independent from mispricing (IVP/IVR):
  //   - Skew measures directionality of the vol surface, not the level
  //   - GEX measures dealer positioning's effect on realized volatility

  // KILL-6 / EDGE-2 combiner: a section whose trace declares zero computable
  // components (active_signal_count 0) is EXCLUDED and the remaining section
  // weights renormalize — generalizing the old hand-written branch tree.
  const sectionActive = (t: { active_signal_count?: number }) => (t.active_signal_count ?? 1) > 0;
  const gateCombined = combineWeighted([
    { key: 'mispricing', weight: 0.40, score: sectionActive(mispricing) ? mispricing.score : null },
    { key: 'term_structure', weight: 0.25, score: sectionActive(termStructure) ? termStructure.score : null },
    { key: 'technicals', weight: 0.15, score: sectionActive(technicals) ? technicals.score : null },
    { key: 'skew', weight: 0.10, score: sectionActive(skew) ? skew.score : null },
    { key: 'gex', weight: 0.10, score: sectionActive(gex) ? gex.score : null },
  ]);

  // KILL-6 fail-loud: with zero real data across all five sections there is
  // nothing honest to score (scan_snapshots.volEdgeScore is non-nullable —
  // gate-level exclusion is a migration, flagged for Alex).
  if (gateCombined.score == null) {
    throw new Error('Vol-edge gate cannot compute: all five sections lack source data — no imputation (KILL-6)');
  }
  const score = gateCombined.score;

  // Renormalized section weights written back onto the traces; excluded
  // sections show weight 0 with an EXCLUDED formula.
  const renorm = (w: number, active: boolean) => (active ? round(w / gateCombined.activeWeight, 4) : 0);
  mispricing.weight = renorm(0.40, sectionActive(mispricing));
  termStructure.weight = renorm(0.25, sectionActive(termStructure));
  technicals.weight = renorm(0.15, sectionActive(technicals));
  skew.weight = renorm(0.10, sectionActive(skew));
  gex.weight = renorm(0.10, sectionActive(gex));

  // Build DataConfidence — KILL-6: nothing is imputed anywhere in vol-edge
  // anymore; every missing component/section is EXCLUDED + renormalized, and
  // the tracking is derived from the traces' own exclusions (cannot drift).
  const technicalsExcluded = !sectionActive(technicals);
  const excludedFields: string[] = [
    ...(mispricing.excluded_components ?? []),
    ...(sectionActive(termStructure) ? [] : ['term_structure']),
    ...(technicalsExcluded ? ['technicals'] : (technicals.excluded_components ?? [])),
    ...(sectionActive(skew) ? [] : ['skew']),
    ...(sectionActive(gex) ? [] : ['gex']),
  ];
  // mispricing(4) + term(1) + technicals(5, or 1 when the whole section is
  // excluded) + skew(1) + gex(1)
  const totalSubScores = 4 + 1 + (technicalsExcluded ? 1 : 5) + 1 + 1;
  const dataConfidence: DataConfidence = {
    total_sub_scores: totalSubScores,
    imputed_sub_scores: excludedFields.length,
    confidence: round(1 - excludedFields.length / totalSubScores, 4),
    imputed_fields: [],
    excluded_fields: excludedFields,
    // "computed from N/M signals"
    active_signal_count: totalSubScores - excludedFields.length,
  };

  return {
    score,
    data_confidence: dataConfidence,
    breakdown: {
      mispricing,
      term_structure: termStructure,
      technicals,
      skew,
      gex,
    },
  };
}
