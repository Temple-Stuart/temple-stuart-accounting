import type {
  ConvergenceInput,
  VolEdgeResult,
  MispricingTrace,
  TermStructureTrace,
  TechnicalsTrace,
  CandleData,
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
    changes.push(candles[i].close - candles[i - 1].close);
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

function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeMACD(candles: CandleData[], fast = 12, slow = 26, signal = 9): {
  macdLine: number | null;
  signalLine: number | null;
  histogram: number | null;
} {
  if (candles.length < slow + signal) {
    return { macdLine: null, signalLine: null, histogram: null };
  }
  const closes = candles.map(c => c.close);
  const emaFast = computeEMA(closes, fast);
  const emaSlow = computeEMA(closes, slow);
  const macdValues = emaFast.map((v, i) => v - emaSlow[i]);
  const signalValues = computeEMA(macdValues.slice(slow - 1), signal);

  const macdLine = round(macdValues[macdValues.length - 1], 4);
  const signalLine = round(signalValues[signalValues.length - 1], 4);
  return {
    macdLine,
    signalLine,
    histogram: round(macdLine - signalLine, 4),
  };
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
  const sector = input.ttScanner?.sector;
  const stats = sector ? input.sectorStats?.[sector] : undefined;

  if (!stats?.metrics) {
    return {
      vrp_z: null,
      ivp_z: null,
      iv_hv_z: null,
      hv_accel_z: null,
      note: 'sector_z: null (no sector peer data available)',
    };
  }

  const m = stats.metrics;
  const ivpStats = m['iv_percentile'];
  const ivHvStats = m['iv_hv_spread'];
  const hv30Stats = m['hv30'];

  const ivpZ = ivpStats ? zScore(ivp, ivpStats.mean, ivpStats.std) : null;
  const ivHvZ = ivHvStats ? zScore(ivHvSpread, ivHvStats.mean, ivHvStats.std) : null;

  // HV acceleration z-score: how unusual is HV30-HV60 spread vs peers' HV30 spread
  const hvAccel = (hv30 !== null && hv60 !== null) ? hv30 - hv60 : null;
  const hvAccelZ = hv30Stats ? zScore(hvAccel, 0, hv30Stats.std) : null;

  // VRP z-score: use iv_hv_spread stats as proxy (VRP ≈ IV-HV spread direction)
  const vrpZ = ivHvStats ? zScore(vrp, ivHvStats.mean * (ivHvStats.mean + hv30Stats?.mean || 0), ivHvStats.std * 10) : null;

  return {
    vrp_z: vrpZ,
    ivp_z: ivpZ,
    iv_hv_z: ivHvZ,
    hv_accel_z: hvAccelZ,
    note: `sector z-scores vs ${sector} peers`,
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
  let ivr = tt?.ivRank ?? null;
  // TastyTrade returns IVP/IVR as decimals (0.693 = 69.3%); normalize to 0-100 scale
  if (ivp !== null && ivp <= 1.0) ivp = round(ivp * 100, 1);
  if (ivr !== null && ivr <= 1.0) ivr = round(ivr * 100, 1);
  const ivHvSpread = tt?.ivHvSpread ?? null;

  // VRP = IV30² - HV30² (variance risk premium)
  let vrp: number | null = null;
  let vrpStr = 'N/A (missing IV30 or HV30)';
  if (iv30 !== null && hv30 !== null && iv30 > 0) {
    vrp = iv30 ** 2 - hv30 ** 2;
    vrpStr = `${iv30}² − ${hv30}² = ${round(vrp, 2)} (${vrp > 0 ? 'positive = IV overpricing RV' : 'negative = IV underpricing RV'})`;
  }

  // IVP component (30%): IVP directly maps 0-100
  const ivpScore = ivp !== null ? clamp(ivp, 0, 100) : 50;

  // IVR component (15%): IVR directly maps 0-100
  const ivrScore = ivr !== null ? clamp(ivr, 0, 100) : 50;

  // VRP component (30%): normalized VRP ratio
  let vrpScore = 50;
  if (iv30 !== null && hv30 !== null && iv30 > 0) {
    const vrpRatio = (iv30 - hv30) / iv30; // -1 to +1 range
    vrpScore = clamp(50 + vrpRatio * 50, 0, 100);
  }

  // HV trend component (25%)
  let hvTrendScore = 50;
  let hvTrend = 'UNKNOWN (missing HV data)';
  if (hv30 !== null && hv60 !== null && hv90 !== null) {
    if (hv30 < hv60 && hv60 < hv90) {
      hvTrend = `FALLING (HV30=${hv30} < HV60=${hv60} < HV90=${hv90}) → bullish for premium selling`;
      hvTrendScore = 80;
    } else if (hv30 < hv60) {
      hvTrend = `DECLINING (HV30=${hv30} < HV60=${hv60}, HV90=${hv90}) → moderately bullish`;
      hvTrendScore = 65;
    } else if (hv30 > hv60 && hv60 > hv90) {
      hvTrend = `RISING (HV30=${hv30} > HV60=${hv60} > HV90=${hv90}) → bearish for premium selling`;
      hvTrendScore = 20;
    } else if (hv30 > hv60) {
      hvTrend = `ACCELERATING (HV30=${hv30} > HV60=${hv60}, HV90=${hv90}) → caution`;
      hvTrendScore = 35;
    } else {
      hvTrend = `FLAT (HV30=${hv30}, HV60=${hv60}, HV90=${hv90})`;
      hvTrendScore = 50;
    }
  }

  // Weighted combination: 0.30×IVP + 0.15×IVR + 0.30×VRP + 0.25×HV_trend
  const score = round(0.30 * ivpScore + 0.15 * ivrScore + 0.30 * vrpScore + 0.25 * hvTrendScore, 1);
  const formula = `0.30×${round(ivpScore, 1)} + 0.15×${round(ivrScore, 1)} + 0.30×${round(vrpScore, 1)} + 0.25×${round(hvTrendScore, 1)} = ${score}`;

  return {
    score: round(score),
    weight: 0.50,
    inputs: {
      IV_30: iv30,
      HV_30: hv30,
      HV_60: hv60,
      HV_90: hv90,
      IV_percentile: ivp,
      IV_rank: ivr,
      IV_HV_spread: ivHvSpread,
      VRP: vrpStr,
    },
    z_scores: computeZScores(input, ivp, ivHvSpread, vrp, hv30, hv60),
    formula,
    notes: `IVP=${ivpScore}, IVR=${ivrScore}, VRP=${round(vrpScore)}, HV_trend=${round(hvTrendScore)}`,
    hv_trend: hvTrend,
  };
}

// ===== TERM STRUCTURE SUB-SCORE =====

function scoreTermStructure(input: ConvergenceInput): TermStructureTrace {
  const ts = input.ttScanner?.termStructure ?? [];
  const earningsDate = input.ttScanner?.earningsDate ?? null;

  if (ts.length < 2) {
    return {
      score: 50,
      weight: 0.30,
      inputs: { expirations_available: ts.length },
      formula: 'Insufficient term structure data (< 2 expirations) → default 50',
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

  // Shape classification
  let shape: string;
  let shapeScore: number;
  if (slope > 0.15) {
    shape = 'STEEP_CONTANGO';
    shapeScore = 85;
  } else if (slope > 0.05) {
    shape = 'CONTANGO';
    shapeScore = 70;
  } else if (slope > -0.05) {
    shape = 'FLAT';
    shapeScore = 50;
  } else if (slope > -0.15) {
    shape = 'BACKWARDATION';
    shapeScore = 35;
  } else {
    shape = 'STEEP_BACKWARDATION';
    shapeScore = 20;
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

  const formula = `slope=${slopeStr} → shape=${shape} → base=${shapeScore}${earningsKinkDetected ? ' − 5 (earnings kink)' : ''} = ${shapeScore}`;

  return {
    score: round(shapeScore),
    weight: 0.30,
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
  const candles = input.candles;

  if (candles.length < 20) {
    return {
      score: 50,
      weight: 0.20,
      inputs: { candles_available: candles.length },
      formula: `Insufficient candle data (${candles.length} < 20 required) → default 50`,
      notes: 'Need at least 20 candles for Bollinger Bands and SMA calculations',
      sub_scores: { rsi_score: 50, trend_score: 50, bollinger_score: 50, volume_score: 50, macd_score: 50 },
      indicators: {
        rsi_14: null, rsi_trace: null, sma_20: null, sma_50: null, latest_close: null,
        bb_upper: null, bb_lower: null, bb_middle: null, bb_position: null, bb_width: null,
        macd_line: null, macd_signal: null, macd_histogram: null,
        avg_volume_5d: null, avg_volume_20d: null, volume_ratio: null,
      },
      candles_used: candles.length,
    };
  }

  const latestClose = candles[candles.length - 1].close;

  // RSI
  const rsiResult = computeRSI(candles, 14);
  // For neutral/premium-selling: penalize extremes. RSI near 50 = best
  let rsiScore = 50;
  if (rsiResult.rsi !== null) {
    rsiScore = round(100 - 2 * Math.abs(rsiResult.rsi - 50));
    rsiScore = clamp(rsiScore, 0, 100);
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

  let volumeScore = 50;
  if (volumeRatio !== null) {
    if (volumeRatio > 1.5) volumeScore = 70;      // Elevated volume → more liquid
    else if (volumeRatio > 1.2) volumeScore = 62;
    else if (volumeRatio > 0.8) volumeScore = 55;  // Normal
    else volumeScore = 40;                          // Low volume → less liquid
  }

  // MACD
  const macd = computeMACD(candles, 12, 26, 9);
  let macdScore = 50;
  if (macd.histogram !== null) {
    // Positive histogram = bullish momentum, negative = bearish
    // For neutral strategies, near-zero is ideal
    const absHist = Math.abs(macd.histogram);
    const lastClose = candles[candles.length - 1].close;
    const normalizedHist = lastClose > 0 ? absHist / lastClose * 100 : 0;
    // Small histogram = 60 (range-bound, good for neutral), large = lower
    if (normalizedHist < 0.5) macdScore = 60;
    else if (normalizedHist < 1.0) macdScore = 50;
    else if (normalizedHist < 2.0) macdScore = 40;
    else macdScore = 30;
  }

  // Weighted combination: RSI 25%, trend 25%, bollinger 20%, volume 15%, MACD 15%
  const score = round(
    0.25 * rsiScore + 0.25 * trendScore + 0.20 * bollingerScore + 0.15 * volumeScore + 0.15 * macdScore, 1,
  );

  const formula = `0.25×RSI(${round(rsiScore)}) + 0.25×Trend(${round(trendScore)}) + 0.20×BB(${round(bollingerScore)}) + 0.15×Vol(${round(volumeScore)}) + 0.15×MACD(${round(macdScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.20,
    inputs: {
      candles_available: candles.length,
      latest_close: latestClose,
    },
    formula,
    notes: `RSI(14)=${rsiResult.rsi ?? 'N/A'}, SMA20=${sma20 ?? 'N/A'}, SMA50=${sma50 ?? 'N/A'}, BB_pos=${bb.position ?? 'N/A'}, MACD_hist=${macd.histogram ?? 'N/A'}`,
    sub_scores: {
      rsi_score: round(rsiScore),
      trend_score: round(trendScore),
      bollinger_score: round(bollingerScore),
      volume_score: round(volumeScore),
      macd_score: round(macdScore),
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
      macd_line: macd.macdLine,
      macd_signal: macd.signalLine,
      macd_histogram: macd.histogram,
      avg_volume_5d: vol5d,
      avg_volume_20d: vol20d,
      volume_ratio: volumeRatio,
    },
    candles_used: candles.length,
  };
}

// ===== MAIN VOL EDGE SCORER =====

export function scoreVolEdge(input: ConvergenceInput): VolEdgeResult {
  const mispricing = scoreMispricing(input);
  const termStructure = scoreTermStructure(input);
  const technicals = scoreTechnicals(input);

  // Weighted combination: 50% mispricing, 30% term structure, 20% technicals
  const score = round(
    mispricing.weight * mispricing.score +
    termStructure.weight * termStructure.score +
    technicals.weight * technicals.score,
    1,
  );

  return {
    score,
    breakdown: {
      mispricing,
      term_structure: termStructure,
      technicals,
    },
  };
}
