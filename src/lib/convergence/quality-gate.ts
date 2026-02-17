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

// ===== SAFETY SUB-SCORE (40%) =====

function scoreSafety(input: ConvergenceInput): SafetyTrace {
  const tt = input.ttScanner;
  const candles = input.candles;
  const metric = input.finnhubFundamentals?.metric ?? {};

  // --- Liquidity rating (15%) ---
  const liqRating = tt?.liquidityRating ?? null;
  let liquidityRatingScore = 50;
  if (liqRating !== null) {
    // TT uses ~1-5 scale. Map: 5->95, 4->80, 3->60, 2->40, 1->20
    liquidityRatingScore = clamp(liqRating * 20 - 5, 0, 100);
  }

  // --- Market cap (15%) ---
  const marketCap = tt?.marketCap ?? null;
  let marketCapScore = 50;
  if (marketCap !== null) {
    if (marketCap > 200_000_000_000) marketCapScore = 90;
    else if (marketCap > 10_000_000_000) marketCapScore = 75;
    else if (marketCap > 2_000_000_000) marketCapScore = 60;
    else if (marketCap > 300_000_000) marketCapScore = 40;
    else marketCapScore = 20;
  }

  // --- Volume (15%) ---
  let volumeScore = 50;
  let avgVol20d: number | null = null;
  if (candles.length >= 20) {
    const vols = candles.slice(-20).map(c => c.volume);
    avgVol20d = round(vols.reduce((a, b) => a + b, 0) / vols.length);
    if (avgVol20d > 50_000_000) volumeScore = 90;
    else if (avgVol20d > 10_000_000) volumeScore = 75;
    else if (avgVol20d > 1_000_000) volumeScore = 60;
    else if (avgVol20d > 100_000) volumeScore = 40;
    else volumeScore = 20;
  }

  // --- Lendability (10%) ---
  const lendability = tt?.lendability ?? null;
  let lendabilityScore = 60; // Default: assume easy to borrow
  if (lendability !== null) {
    const lend = lendability.toLowerCase();
    if (lend === 'easy to borrow' || lend === 'easy') lendabilityScore = 80;
    else if (lend === 'locate required' || lend === 'hard to borrow') lendabilityScore = 30;
    else lendabilityScore = 55;
  }

  // --- Beta (20%) ---
  const beta = tt?.beta ?? (typeof metric['beta'] === 'number' ? metric['beta'] as number : null);
  let betaScore = 50;
  if (beta !== null) {
    if (beta < 0.8) betaScore = 90;
    else if (beta <= 1.0) betaScore = 80;
    else if (beta <= 1.2) betaScore = 65;
    else if (beta <= 1.5) betaScore = 50;
    else betaScore = 30;
  }

  // --- Debt-to-Equity (25%) ---
  const debtToEquity = typeof metric['totalDebt/totalEquityQuarterly'] === 'number'
    ? metric['totalDebt/totalEquityQuarterly'] as number : null;
  let debtToEquityScore = 50;
  if (debtToEquity !== null) {
    if (debtToEquity < 0.3) debtToEquityScore = 95;
    else if (debtToEquity <= 0.5) debtToEquityScore = 80;
    else if (debtToEquity <= 1.0) debtToEquityScore = 65;
    else if (debtToEquity <= 2.0) debtToEquityScore = 45;
    else debtToEquityScore = 25;
  }

  // --- Piotroski F-Score (partial, from available data) ---
  const roe = typeof metric['roeTTM'] === 'number' ? metric['roeTTM'] as number : null;
  const roa = typeof metric['roaTTM'] === 'number' ? metric['roaTTM'] as number : null;
  const fcfShareTTM = typeof metric['freeCashFlowPerShareTTM'] === 'number' ? metric['freeCashFlowPerShareTTM'] as number : null;
  const cfoa = typeof metric['currentRatioQuarterly'] === 'number' ? metric['currentRatioQuarterly'] as number : null;

  const piotroskiSignals: Record<string, boolean | null> = {
    positive_net_income: roe !== null ? roe > 0 : null,
    positive_roa: roa !== null ? roa > 0 : null,
    positive_fcf: fcfShareTTM !== null ? fcfShareTTM > 0 : null,
    fcf_exceeds_net_income: null, // Requires net income comparison
    current_ratio_improving: cfoa !== null ? cfoa > 1 : null, // Proxy: current ratio > 1
    gross_margin_expanding: null, // Requires YoY trend
    asset_turnover_improving: null, // Requires YoY trend
    no_equity_issuance: null, // Requires shares outstanding trend
    leverage_decreasing: null, // Requires YoY debt comparison
  };

  const computedSignals = Object.values(piotroskiSignals).filter(v => v !== null);
  const passedSignals = computedSignals.filter(v => v === true).length;

  // --- Altman Z-Score (partial) ---
  // Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
  const hasX1 = cfoa !== null; // Current ratio as WC/TA proxy
  const hasX2 = roa !== null;  // ROA as RE/TA proxy
  const opMargin = typeof metric['operatingMarginTTM'] === 'number' ? metric['operatingMarginTTM'] as number : null;
  const hasX3 = opMargin !== null; // Operating margin as EBIT/TA proxy
  const hasX4 = debtToEquity !== null && debtToEquity > 0; // 1/(D/E) as MV Equity/Liab proxy
  const assetTurnoverAZ = typeof metric['assetTurnoverTTM'] === 'number' ? metric['assetTurnoverTTM'] as number : null;
  const hasX5 = assetTurnoverAZ !== null; // Asset turnover as Sales/TA

  const altmanComputable: Record<string, boolean> = {
    x1_working_capital: hasX1,
    x2_retained_earnings: hasX2,
    x3_ebit: hasX3,
    x4_equity_to_liabilities: hasX4,
    x5_asset_turnover: hasX5,
  };
  const altmanComponentsAvailable = Object.values(altmanComputable).filter(Boolean).length;
  let altmanScore: number | null = null;
  let altmanCapped = false;

  if (altmanComponentsAvailable >= 3) {
    let z = 0;
    if (hasX1) z += 1.2 * Math.max(Math.min((cfoa! - 1) * 0.5, 1), -1);
    if (hasX2) z += 1.4 * Math.max(Math.min(roa! / 100, 0.5), -0.5);
    if (hasX3) z += 3.3 * Math.max(Math.min(opMargin! / 100, 0.5), -0.5);
    if (hasX4) z += 0.6 * Math.min(1 / debtToEquity!, 5);
    if (hasX5) z += 1.0 * Math.min(assetTurnoverAZ!, 3);
    altmanScore = round(z, 2);
  }

  // --- Weighted sum ---
  const hasCandles = candles.length >= 20;
  let score: number;
  let formula: string;

  if (hasCandles) {
    score = round(
      0.15 * liquidityRatingScore + 0.15 * marketCapScore + 0.15 * volumeScore +
      0.10 * lendabilityScore + 0.20 * betaScore + 0.25 * debtToEquityScore,
      1,
    );
    formula = `0.15*LiqRating(${round(liquidityRatingScore)}) + 0.15*MktCap(${round(marketCapScore)}) + 0.15*Vol(${round(volumeScore)}) + 0.10*Lend(${round(lendabilityScore)}) + 0.20*Beta(${round(betaScore)}) + 0.25*D/E(${round(debtToEquityScore)}) = ${score}`;
  } else {
    // No candle data: exclude volume (15%), renormalize remaining 85% to 100%
    volumeScore = 0;
    avgVol20d = null;
    const w = 0.85;
    score = round(
      (0.15 / w) * liquidityRatingScore + (0.15 / w) * marketCapScore +
      (0.10 / w) * lendabilityScore + (0.20 / w) * betaScore + (0.25 / w) * debtToEquityScore,
      1,
    );
    formula = `Volume EXCLUDED (no candles). Renorm: LiqRating(${round(liquidityRatingScore)}) + MktCap(${round(marketCapScore)}) + Lend(${round(lendabilityScore)}) + Beta(${round(betaScore)}) + D/E(${round(debtToEquityScore)}) = ${score}`;
  }

  // Altman Z hard gate: if computable and Z < 1.8, cap safety at 40
  if (altmanScore !== null && altmanScore < 1.8) {
    score = Math.min(score, 40);
    altmanCapped = true;
  }

  return {
    score: round(score),
    weight: 0.40,
    inputs: {
      liquidity_rating: liqRating,
      market_cap: marketCap,
      avg_volume_20d: avgVol20d,
      lendability: lendability,
      borrow_rate: tt?.borrowRate ?? null,
      beta: beta,
      debt_to_equity: debtToEquity,
    },
    formula,
    notes: `Liquidity: ${liqRating ?? 'N/A'}, MktCap: ${marketCap ? '$' + (marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}, Beta: ${beta ?? 'N/A'}, D/E: ${debtToEquity ?? 'N/A'}${altmanCapped ? '. ALTMAN Z CAPPED: Z=' + altmanScore + ' < 1.8' : ''}${!hasCandles ? '. Volume excluded (no candle data)' : ''}`,
    sub_scores: {
      liquidity_rating_score: round(liquidityRatingScore),
      market_cap_score: round(marketCapScore),
      volume_score: round(volumeScore),
      lendability_score: round(lendabilityScore),
      beta_score: round(betaScore),
      debt_to_equity_score: round(debtToEquityScore),
    },
    piotroski: {
      available_signals: computedSignals.length,
      total_signals: 9,
      computable: piotroskiSignals,
      note: `${passedSignals}/${computedSignals.length} signals passing (${9 - computedSignals.length} require YoY trend data)`,
    },
    altman_z: {
      score: altmanScore,
      components_available: altmanComponentsAvailable,
      components_total: 5,
      computable: altmanComputable,
      capped: altmanCapped,
    },
  };
}

// ===== PROFITABILITY SUB-SCORE (30%) =====

function scoreProfitability(input: ConvergenceInput): ProfitabilityTrace {
  const tt = input.ttScanner;
  const metric = input.finnhubFundamentals?.metric ?? {};
  const earnings = input.finnhubEarnings;
  const daysTillEarnings = tt?.daysTillEarnings ?? null;

  // --- Gross margin (15%) ---
  const grossMargin = typeof metric['grossMarginTTM'] === 'number' ? metric['grossMarginTTM'] as number : null;
  let grossMarginScore = 50;
  if (grossMargin !== null) {
    if (grossMargin > 60) grossMarginScore = 85;
    else if (grossMargin > 40) grossMarginScore = 70;
    else if (grossMargin > 20) grossMarginScore = 55;
    else if (grossMargin > 0) grossMarginScore = 35;
    else grossMarginScore = 20;
  }

  // --- ROE (15%) ---
  const roe = typeof metric['roeTTM'] === 'number' ? metric['roeTTM'] as number : null;
  let roeScore = 50;
  if (roe !== null) {
    if (roe > 25) roeScore = 90;
    else if (roe > 15) roeScore = 75;
    else if (roe > 10) roeScore = 60;
    else if (roe > 5) roeScore = 45;
    else if (roe > 0) roeScore = 30;
    else roeScore = 15;
  }

  // --- ROA (10%) ---
  const roa = typeof metric['roaTTM'] === 'number' ? metric['roaTTM'] as number : null;
  let roaScore = 50;
  if (roa !== null) {
    if (roa > 15) roaScore = 90;
    else if (roa > 10) roaScore = 75;
    else if (roa > 5) roaScore = 60;
    else if (roa > 2) roaScore = 45;
    else if (roa > 0) roaScore = 30;
    else roaScore = 15;
  }

  // --- P/E ratio (15%) ---
  const pe = tt?.peRatio ?? (typeof metric['peNormalizedAnnual'] === 'number' ? metric['peNormalizedAnnual'] : null);
  let peScore = 50;
  if (pe !== null && typeof pe === 'number') {
    if (pe < 0) peScore = 20;           // Negative earnings
    else if (pe < 5) peScore = 35;      // Suspiciously cheap
    else if (pe < 10) peScore = 60;     // Value
    else if (pe <= 25) peScore = 75;    // Fair value
    else if (pe <= 40) peScore = 55;    // Growth premium
    else if (pe <= 60) peScore = 40;    // Expensive
    else peScore = 25;                  // Extremely expensive
  }

  // --- FCF yield (20%) ---
  const fcfShareTTM = typeof metric['freeCashFlowPerShareTTM'] === 'number' ? metric['freeCashFlowPerShareTTM'] as number : null;
  const currentPrice = typeof metric['marketCapitalization'] === 'number' && typeof metric['shareOutstanding'] === 'number' && (metric['shareOutstanding'] as number) > 0
    ? (metric['marketCapitalization'] as number) * 1e6 / ((metric['shareOutstanding'] as number) * 1e6)
    : null;
  let fcfScore = 50;
  if (fcfShareTTM !== null && currentPrice !== null && currentPrice > 0) {
    const fcfYield = (fcfShareTTM / currentPrice) * 100;
    if (fcfYield > 8) fcfScore = 85;
    else if (fcfYield > 4) fcfScore = 70;
    else if (fcfYield > 1) fcfScore = 55;
    else if (fcfYield > 0) fcfScore = 40;
    else fcfScore = 25; // Negative FCF
  }

  // --- Earnings quality (25%) — full scoreEarningsQuality logic inlined ---
  let surpriseConsistency = 50;
  let dteScore = 50;
  let beatRate = 0;
  let totalQ = 0;
  let beats = 0;
  let misses = 0;
  let inLine = 0;
  let avgSurprise: number | null = null;
  let streak = 'UNKNOWN';

  if (earnings.length > 0) {
    const surprises: number[] = [];
    for (const e of earnings) {
      const surp = e.surprisePercent;
      surprises.push(surp);
      if (surp > 2) beats++;
      else if (surp < -2) misses++;
      else inLine++;
    }

    totalQ = earnings.length;
    beatRate = round(beats / totalQ * 100, 1);

    avgSurprise = surprises.length > 0
      ? round(surprises.reduce((a, b) => a + b, 0) / surprises.length, 2)
      : null;

    // Streak detection (most recent first)
    let consecutiveBeats = 0;
    let consecutiveMisses = 0;
    for (const e of earnings) {
      if (e.surprisePercent > 2) {
        if (consecutiveMisses === 0) consecutiveBeats++;
        else break;
      } else if (e.surprisePercent < -2) {
        if (consecutiveBeats === 0) consecutiveMisses++;
        else break;
      } else {
        break;
      }
    }

    streak = 'MIXED';
    if (consecutiveBeats >= 4) streak = `${consecutiveBeats}Q BEAT STREAK`;
    else if (consecutiveBeats >= 2) streak = `${consecutiveBeats}Q BEATS`;
    else if (consecutiveMisses >= 2) streak = `${consecutiveMisses}Q MISS STREAK`;

    // Surprise consistency: beat rate maps 100%->90, 75%->72, 50%->55, 25%->38, 0%->20
    surpriseConsistency = clamp(20 + beatRate * 0.7, 0, 100);
    if (consecutiveBeats >= 4) surpriseConsistency = Math.min(surpriseConsistency + 10, 100);
    if (consecutiveMisses >= 2) surpriseConsistency = Math.max(surpriseConsistency - 15, 0);
  }

  // Days-to-earnings score
  if (daysTillEarnings !== null) {
    if (daysTillEarnings < 0) dteScore = 60;      // Just passed: IV crush opportunity
    else if (daysTillEarnings <= 7) dteScore = 30; // Too close: binary risk
    else if (daysTillEarnings <= 14) dteScore = 45;
    else if (daysTillEarnings <= 30) dteScore = 55;
    else if (daysTillEarnings <= 45) dteScore = 65; // Sweet spot for premium selling
    else dteScore = 60;                             // Far away: less event risk
  }

  // Earnings quality composite: consistency 50%, DTE 30%, beat_rate 20%
  const beatRateScore = clamp(beatRate, 0, 100);
  const earningsQualityScore = round(
    0.50 * surpriseConsistency + 0.30 * dteScore + 0.20 * beatRateScore,
    1,
  );

  // --- Weighted sum ---
  const score = round(
    0.15 * grossMarginScore + 0.15 * roeScore + 0.10 * roaScore +
    0.15 * peScore + 0.20 * fcfScore + 0.25 * earningsQualityScore,
    1,
  );

  const formula = `0.15*Margin(${round(grossMarginScore)}) + 0.15*ROE(${round(roeScore)}) + 0.10*ROA(${round(roaScore)}) + 0.15*PE(${round(peScore)}) + 0.20*FCF(${round(fcfScore)}) + 0.25*EQ(${round(earningsQualityScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      gross_margin_ttm: grossMargin,
      roe_ttm: roe,
      roa_ttm: roa,
      pe_ratio: pe as number | null,
      fcf_per_share_ttm: fcfShareTTM,
      quarters_available: totalQ,
      days_till_earnings: daysTillEarnings,
    },
    formula,
    notes: `Margin=${grossMargin ?? 'N/A'}%, ROE=${roe ?? 'N/A'}%, ROA=${roa ?? 'N/A'}%, PE=${pe ?? 'N/A'}, FCF/sh=${fcfShareTTM ?? 'N/A'}. ${beats} beats, ${misses} misses, ${inLine} in-line out of ${totalQ}Q`,
    sub_scores: {
      gross_margin_score: round(grossMarginScore),
      roe_score: round(roeScore),
      roa_score: round(roaScore),
      pe_score: round(peScore),
      fcf_score: round(fcfScore),
    },
    earnings_quality: {
      surprise_consistency: round(surpriseConsistency),
      dte_score: round(dteScore),
      beat_rate: beatRate,
      earnings_detail: {
        total_quarters: totalQ,
        beats,
        misses,
        in_line: inLine,
        avg_surprise_pct: avgSurprise,
        streak,
      },
    },
  };
}

// ===== GROWTH SUB-SCORE (15%) =====

function scoreGrowth(input: ConvergenceInput): GrowthTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};

  // --- Revenue growth (40%) ---
  const revGrowth = typeof metric['revenueGrowthTTMYoy'] === 'number' ? metric['revenueGrowthTTMYoy'] as number : null;
  let revenueGrowthScore = 50;
  if (revGrowth !== null) {
    if (revGrowth > 20) revenueGrowthScore = 90;
    else if (revGrowth > 10) revenueGrowthScore = 75;
    else if (revGrowth > 5) revenueGrowthScore = 60;
    else if (revGrowth > 0) revenueGrowthScore = 50;
    else revenueGrowthScore = 30;
  }

  // --- EPS growth (40%) ---
  const epsGrowth = typeof metric['epsGrowthTTMYoy'] === 'number' ? metric['epsGrowthTTMYoy'] as number : null;
  let epsGrowthScore = 50;
  if (epsGrowth !== null) {
    if (epsGrowth > 25) epsGrowthScore = 90;
    else if (epsGrowth > 15) epsGrowthScore = 75;
    else if (epsGrowth > 5) epsGrowthScore = 60;
    else if (epsGrowth > 0) epsGrowthScore = 50;
    else epsGrowthScore = 30;
  }

  // --- Dividend growth (20%) ---
  const divGrowth = typeof metric['dividendGrowthRate5Y'] === 'number' ? metric['dividendGrowthRate5Y'] as number : null;
  let dividendGrowthScore = 50;
  if (divGrowth !== null) {
    if (divGrowth > 10) dividendGrowthScore = 85;
    else if (divGrowth > 5) dividendGrowthScore = 70;
    else if (divGrowth > 0) dividendGrowthScore = 55;
    else dividendGrowthScore = 35;
  }

  const score = round(
    0.40 * revenueGrowthScore + 0.40 * epsGrowthScore + 0.20 * dividendGrowthScore,
    1,
  );

  const formula = `0.40*RevGrowth(${round(revenueGrowthScore)}) + 0.40*EPSGrowth(${round(epsGrowthScore)}) + 0.20*DivGrowth(${round(dividendGrowthScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.15,
    inputs: {
      revenue_growth_yoy: revGrowth,
      eps_growth_yoy: epsGrowth,
      dividend_growth_5y: divGrowth,
    },
    formula,
    notes: `RevGrowth=${revGrowth ?? 'N/A'}%, EPSGrowth=${epsGrowth ?? 'N/A'}%, DivGrowth=${divGrowth ?? 'N/A'}%`,
    sub_scores: {
      revenue_growth_score: round(revenueGrowthScore),
      eps_growth_score: round(epsGrowthScore),
      dividend_growth_score: round(dividendGrowthScore),
    },
  };
}

// ===== EFFICIENCY SUB-SCORE (15%) =====

function scoreEfficiency(input: ConvergenceInput): EfficiencyTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};

  // --- Asset turnover (40%) ---
  const assetTurnover = typeof metric['assetTurnoverTTM'] === 'number' ? metric['assetTurnoverTTM'] as number : null;
  let assetTurnoverScore = 50;
  if (assetTurnover !== null) {
    if (assetTurnover > 1.5) assetTurnoverScore = 90;
    else if (assetTurnover > 1.0) assetTurnoverScore = 75;
    else if (assetTurnover > 0.5) assetTurnoverScore = 60;
    else if (assetTurnover > 0.3) assetTurnoverScore = 45;
    else assetTurnoverScore = 30;
  }

  // --- Margin spread (30%): operatingMarginTTM / grossMarginTTM ---
  const operatingMargin = typeof metric['operatingMarginTTM'] === 'number' ? metric['operatingMarginTTM'] as number : null;
  const grossMargin = typeof metric['grossMarginTTM'] === 'number' ? metric['grossMarginTTM'] as number : null;
  let marginSpreadScore = 50;
  if (operatingMargin !== null && grossMargin !== null && grossMargin > 0) {
    const ratio = operatingMargin / grossMargin;
    if (ratio > 0.7) marginSpreadScore = 90;
    else if (ratio > 0.5) marginSpreadScore = 75;
    else if (ratio > 0.3) marginSpreadScore = 60;
    else if (ratio > 0.1) marginSpreadScore = 40;
    else marginSpreadScore = 25;
  }

  // --- Inventory turnover (30%) ---
  const invTurnover = typeof metric['inventoryTurnoverTTM'] === 'number' ? metric['inventoryTurnoverTTM'] as number : null;
  let inventoryTurnoverScore = 50;
  if (invTurnover !== null) {
    if (invTurnover > 10) inventoryTurnoverScore = 90;
    else if (invTurnover > 5) inventoryTurnoverScore = 70;
    else if (invTurnover > 2) inventoryTurnoverScore = 55;
    else inventoryTurnoverScore = 35;
  }

  const score = round(
    0.40 * assetTurnoverScore + 0.30 * marginSpreadScore + 0.30 * inventoryTurnoverScore,
    1,
  );

  const formula = `0.40*AssetTurn(${round(assetTurnoverScore)}) + 0.30*MarginSpread(${round(marginSpreadScore)}) + 0.30*InvTurn(${round(inventoryTurnoverScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.15,
    inputs: {
      asset_turnover_ttm: assetTurnover,
      operating_margin_ttm: operatingMargin,
      gross_margin_ttm: grossMargin,
      inventory_turnover_ttm: invTurnover,
    },
    formula,
    notes: `AssetTurn=${assetTurnover ?? 'N/A'}, OpMargin/GrossMargin=${operatingMargin !== null && grossMargin !== null && grossMargin > 0 ? round(operatingMargin / grossMargin, 2) : 'N/A'}, InvTurn=${invTurnover ?? 'N/A'}`,
    sub_scores: {
      asset_turnover_score: round(assetTurnoverScore),
      margin_spread_score: round(marginSpreadScore),
      inventory_turnover_score: round(inventoryTurnoverScore),
    },
  };
}

// ===== MAIN QUALITY GATE SCORER =====

export function scoreQualityGate(input: ConvergenceInput): QualityGateResult {
  const safety = scoreSafety(input);
  const profitability = scoreProfitability(input);
  const growth = scoreGrowth(input);
  const efficiency = scoreEfficiency(input);

  let score = round(
    safety.weight * safety.score +
    profitability.weight * profitability.score +
    growth.weight * growth.score +
    efficiency.weight * efficiency.score,
    1,
  );

  // MSPR bonus: latest insider sentiment month
  let msprAdjustment = 0;
  const sentiments = input.finnhubInsiderSentiment;
  if (sentiments.length > 0) {
    let latest = sentiments[0];
    for (let i = 1; i < sentiments.length; i++) {
      const s = sentiments[i];
      if (s.year > latest.year || (s.year === latest.year && s.month > latest.month)) {
        latest = s;
      }
    }
    if (latest.mspr > 50) msprAdjustment = 5;
    else if (latest.mspr < -50) msprAdjustment = -5;
  }
  score = clamp(round(score + msprAdjustment, 1), 0, 100);

  return {
    score,
    mspr_adjustment: msprAdjustment,
    breakdown: {
      safety,
      profitability,
      growth,
      efficiency,
    },
  };
}
