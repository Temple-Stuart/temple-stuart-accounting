import type {
  ConvergenceInput,
  QualityGateResult,
  SafetyTrace,
  ProfitabilityTrace,
  GrowthTrace,
  FundamentalRiskTrace,
  DataConfidence,
} from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

// Bernard & Thomas (1989, 1990 JAR): SUE-relative thresholds — beat/miss
// classification should scale with the stock's own surprise variability.
// Threshold = max(1%, 0.5 × stdDev of historical surprise percentages).
// Falls back to ±2% with fewer than 3 quarters of history.
function computeSurpriseThreshold(surprises: number[]): number {
  if (surprises.length < 3) return 2.0; // Fallback: insufficient history
  const mean = surprises.reduce((a, b) => a + b, 0) / surprises.length;
  const variance = surprises.reduce((a, b) => a + (b - mean) ** 2, 0) / (surprises.length - 1);
  const stdDev = Math.sqrt(variance);
  return Math.max(1.0, 0.5 * stdDev);
}

// ===== SAFETY SUB-SCORE (40%) =====

function scoreSafety(input: ConvergenceInput): SafetyTrace {
  const tt = input.ttScanner;
  const candles = input.candles;
  const metric = input.finnhubFundamentals?.metric ?? {};

  // --- Liquidity rating (15%) ---
  const liqRating = tt?.liquidityRating ?? null;
  let liquidityRatingScore = 40; // penalty default — missing data
  if (liqRating !== null) {
    // TT uses ~1-5 scale. Map: 5->95, 4->80, 3->60, 2->40, 1->20
    liquidityRatingScore = clamp(liqRating * 20 - 5, 0, 100);
  }

  // --- Market cap (15%) ---
  const marketCap = tt?.marketCap ?? null;
  let marketCapScore = 40; // penalty default — missing data
  if (marketCap !== null) {
    if (marketCap > 200_000_000_000) marketCapScore = 90;
    else if (marketCap > 10_000_000_000) marketCapScore = 75;
    else if (marketCap > 2_000_000_000) marketCapScore = 60;
    else if (marketCap > 300_000_000) marketCapScore = 40;
    else marketCapScore = 20;
  }

  // --- Volume (15%) ---
  let volumeScore = 40; // penalty default — missing data
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
  let betaScore = 40; // penalty default — missing data
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
  let debtToEquityScore = 40; // penalty default — missing data
  if (debtToEquity !== null) {
    if (debtToEquity < 0.3) debtToEquityScore = 95;
    else if (debtToEquity <= 0.5) debtToEquityScore = 80;
    else if (debtToEquity <= 1.0) debtToEquityScore = 65;
    else if (debtToEquity <= 2.0) debtToEquityScore = 45;
    else debtToEquityScore = 25;
  }

  // --- Piotroski F-Score ---
  // Try quarterly financials first (real), then annual financials, then proxy/metric
  const qf = input.quarterlyFinancials;
  const af = input.annualFinancials;
  let piotroskiSource = 'proxy_imputed';

  // Helper: sum last N quarters of a field (TTM = 4 quarters)
  const sumQ = (periods: typeof qf extends { periods: infer P } ? P : never[], field: keyof NonNullable<typeof qf>['periods'][number], n: number): number | null => {
    if (!Array.isArray(periods)) return null;
    const valid = periods.slice(0, n).filter(p => p[field] !== null && p[field] !== undefined);
    if (valid.length < n) return null;
    return valid.reduce((s, p) => s + (p[field] as number), 0);
  };

  // Build Piotroski signals with best available data
  const piotroskiSignals: Record<string, boolean | null> = {
    positive_net_income: null,
    positive_roa: null,
    positive_fcf: null,
    fcf_exceeds_net_income: null,
    current_ratio_improving: null,
    gross_margin_expanding: null,
    asset_turnover_improving: null,
    no_equity_issuance: null,
    leverage_decreasing: null,
  };

  if (qf && qf.periods.length >= 4) {
    // REAL quarterly data available
    piotroskiSource = 'quarterly_financials';
    const q = qf.periods;
    const latestTA = q[0]?.totalAssets;

    // Signal 1: ROA > 0 (net income TTM / total assets)
    const niTTM = sumQ(q, 'netIncome', 4);
    piotroskiSignals.positive_net_income = niTTM !== null ? niTTM > 0 : null;
    piotroskiSignals.positive_roa = niTTM !== null && latestTA !== null && latestTA > 0
      ? (niTTM / latestTA) > 0 : null;

    // Signal 3: Operating Cash Flow > 0 (TTM)
    const ocfTTM = sumQ(q, 'operatingCashFlow', 4);
    piotroskiSignals.positive_fcf = ocfTTM !== null ? ocfTTM > 0 : null;

    // Signal 4: Accruals — CFO > Net Income (quality of earnings)
    piotroskiSignals.fcf_exceeds_net_income = ocfTTM !== null && niTTM !== null ? ocfTTM > niTTM : null;

    // YoY comparisons (need 8 quarters)
    if (q.length >= 8) {
      // Current TTM = q[0..3], Prior TTM = q[4..7]
      const curNI = sumQ(q, 'netIncome', 4);
      const priQ = q.slice(4);
      const priNI = sumQ(priQ, 'netIncome', 4);
      const curTA = q[0]?.totalAssets;
      const priTA = q[4]?.totalAssets;

      // Signal 3 (revised): ΔROA > 0
      if (curNI !== null && priNI !== null && curTA && curTA > 0 && priTA && priTA > 0) {
        piotroskiSignals.positive_roa = (curNI / curTA) > (priNI / priTA);
      }

      // Signal 5: ΔLeverage — long-term debt decreased YoY
      const curLTD = q[0]?.longTermDebt;
      const priLTD = q[4]?.longTermDebt;
      if (curLTD !== null && priLTD !== null && curTA && curTA > 0 && priTA && priTA > 0) {
        piotroskiSignals.leverage_decreasing = (curLTD / curTA) < (priLTD / priTA);
      }

      // Signal 6: ΔLiquidity — current ratio improved YoY
      const curCA = q[0]?.totalCurrentAssets;
      const curCL = q[0]?.totalCurrentLiabilities;
      const priCA = q[4]?.totalCurrentAssets;
      const priCL = q[4]?.totalCurrentLiabilities;
      if (curCA !== null && curCL !== null && curCL > 0 && priCA !== null && priCL !== null && priCL > 0) {
        piotroskiSignals.current_ratio_improving = (curCA / curCL) > (priCA / priCL);
      }

      // Signal 7: No equity dilution
      const curShares = q[0]?.sharesOutstanding;
      const priShares = q[4]?.sharesOutstanding;
      if (curShares !== null && priShares !== null) {
        piotroskiSignals.no_equity_issuance = curShares <= priShares;
      }

      // Signal 8: ΔGross Margin > 0 YoY
      const curGP = sumQ(q, 'grossProfit', 4);
      const curRev = sumQ(q, 'revenue', 4);
      const priGP = sumQ(priQ, 'grossProfit', 4);
      const priRev = sumQ(priQ, 'revenue', 4);
      if (curGP !== null && curRev !== null && curRev > 0 && priGP !== null && priRev !== null && priRev > 0) {
        piotroskiSignals.gross_margin_expanding = (curGP / curRev) > (priGP / priRev);
      }

      // Signal 9: ΔAsset Turnover > 0 YoY
      if (curRev !== null && curTA && curTA > 0 && priRev !== null && priTA && priTA > 0) {
        piotroskiSignals.asset_turnover_improving = (curRev / curTA) > (priRev / priTA);
      }
    }
  } else {
    // Fallback: annual financials or metric proxies
    const roe = typeof metric['roeTTM'] === 'number' ? metric['roeTTM'] as number : null;
    const roa = typeof metric['roaTTM'] === 'number' ? metric['roaTTM'] as number : null;
    const fcfShareTTM = typeof metric['freeCashFlowPerShareTTM'] === 'number' ? metric['freeCashFlowPerShareTTM'] as number : null;
    const netIncomePerShare = typeof metric['netIncomePerShareTTM'] === 'number' ? metric['netIncomePerShareTTM'] as number : null;

    const cur = af?.currentYear ?? null;
    const pri = af?.priorYear ?? null;

    if (af) piotroskiSource = 'annual_financials';
    // else remains 'proxy_imputed'

    piotroskiSignals.positive_net_income = roe !== null ? roe > 0 : null;
    piotroskiSignals.positive_roa = roa !== null ? roa > 0 : null;
    piotroskiSignals.positive_fcf =
      cur?.operatingCashFlow != null && cur?.capitalExpenditure != null
        ? (cur.operatingCashFlow - cur.capitalExpenditure) > 0
        : fcfShareTTM !== null ? fcfShareTTM > 0 : null;
    piotroskiSignals.fcf_exceeds_net_income =
      cur?.operatingCashFlow != null && cur?.capitalExpenditure != null && cur?.netIncome != null
        ? (cur.operatingCashFlow - cur.capitalExpenditure) > cur.netIncome
        : fcfShareTTM !== null && netIncomePerShare !== null ? fcfShareTTM > netIncomePerShare : null;
    piotroskiSignals.current_ratio_improving =
      cur?.currentAssets != null && cur?.currentLiabilities != null && cur.currentLiabilities > 0 &&
      pri?.currentAssets != null && pri?.currentLiabilities != null && pri.currentLiabilities > 0
        ? (cur.currentAssets / cur.currentLiabilities) > (pri.currentAssets / pri.currentLiabilities)
        : null;
    piotroskiSignals.gross_margin_expanding =
      cur?.grossProfit != null && cur?.revenue != null && cur.revenue > 0 &&
      pri?.grossProfit != null && pri?.revenue != null && pri.revenue > 0
        ? (cur.grossProfit / cur.revenue) > (pri.grossProfit / pri.revenue)
        : null;
    piotroskiSignals.asset_turnover_improving =
      cur?.revenue != null && cur?.totalAssets != null && cur.totalAssets > 0 &&
      pri?.revenue != null && pri?.totalAssets != null && pri.totalAssets > 0
        ? (cur.revenue / cur.totalAssets) > (pri.revenue / pri.totalAssets)
        : null;
    piotroskiSignals.no_equity_issuance =
      cur?.sharesOutstanding != null && pri?.sharesOutstanding != null
        ? cur.sharesOutstanding <= pri.sharesOutstanding
        : null;
    piotroskiSignals.leverage_decreasing =
      cur?.longTermDebt != null && cur?.totalAssets != null && cur.totalAssets > 0 &&
      pri?.longTermDebt != null && pri?.totalAssets != null && pri.totalAssets > 0
        ? (cur.longTermDebt / cur.totalAssets) < (pri.longTermDebt / pri.totalAssets)
        : null;
  }

  const computedSignals = Object.values(piotroskiSignals).filter(v => v !== null);
  const passedSignals = computedSignals.filter(v => v === true).length;

  // Schwartz & Hanauer (2024): F-Score alpha explained by style factors.
  // Level signals (1-4) duplicate ROE/ROA/FCF already in profitability.
  // Change signals (5-9) provide unique directional info → used as ±10 modifier.
  const changeSignalKeys = [
    'current_ratio_improving', 'gross_margin_expanding',
    'asset_turnover_improving', 'no_equity_issuance', 'leverage_decreasing',
  ] as const;
  const changeComputable = changeSignalKeys.filter(k => piotroskiSignals[k] !== null);
  const changePassed = changeComputable.filter(k => piotroskiSignals[k] === true).length;
  const changeScore = changeComputable.length > 0
    ? round(changePassed / changeComputable.length, 2)
    : null;
  // Map 0-1 ratio to ±10: 1.0→+10, 0.5→0, 0.0→-10
  const piotroskiChangeModifier = changeScore !== null
    ? round((changeScore - 0.5) * 20, 1)
    : 0;

  // --- Altman Z-Score ---
  // Z = 1.2*(WC/TA) + 1.4*(RE/TA) + 3.3*(EBIT/TA) + 0.6*(MVE/TL) + 1.0*(Sales/TA)
  // Prefer real quarterly financials. Fall back to metric proxies.
  let altmanSource = 'proxy_imputed';
  let x1_wc_ta: number | null = null;
  let x2_re_ta: number | null = null;
  let x3_ebit_ta: number | null = null;
  let x4_mve_tl: number | null = null;
  let x5_sales_ta: number | null = null;

  if (qf && qf.periods.length >= 4) {
    // REAL Altman Z from quarterly financials
    altmanSource = 'quarterly_financials';
    const latest = qf.periods[0];
    const ta = latest.totalAssets;
    const tl = latest.totalLiabilities;

    if (ta && ta > 0) {
      // X1: WC / TA (balance sheet: most recent quarter)
      if (latest.workingCapital !== null) x1_wc_ta = latest.workingCapital / ta;

      // X2: RE / TA (balance sheet: most recent quarter)
      if (latest.retainedEarnings !== null) x2_re_ta = latest.retainedEarnings / ta;

      // X3: EBIT / TA (income stmt: TTM — sum 4 quarters)
      const ebitTTM = sumQ(qf.periods, 'ebit', 4);
      if (ebitTTM !== null) x3_ebit_ta = ebitTTM / ta;

      // X5: Sales / TA (income stmt: TTM)
      const revTTM = sumQ(qf.periods, 'revenue', 4);
      if (revTTM !== null) x5_sales_ta = revTTM / ta;
    }

    // X4: MVE / TL (market data for MVE, balance sheet for TL)
    const marketCap2 = tt?.marketCap ?? null;
    if (marketCap2 !== null && tl && tl > 0) {
      x4_mve_tl = marketCap2 / tl;
    }
  }

  // Fill any remaining null components with proxy metrics
  if (x1_wc_ta === null) {
    const cfoa = typeof metric['currentRatioQuarterly'] === 'number' ? metric['currentRatioQuarterly'] as number : null;
    if (cfoa !== null) x1_wc_ta = (cfoa - 1) * 0.5; // proxy
    if (altmanSource === 'quarterly_financials') altmanSource = 'mixed'; // partial real
  }
  if (x2_re_ta === null) {
    const roa2 = typeof metric['roaTTM'] === 'number' ? metric['roaTTM'] as number : null;
    if (roa2 !== null) x2_re_ta = roa2 / 100; // proxy
    if (altmanSource === 'quarterly_financials') altmanSource = 'mixed';
  }
  if (x3_ebit_ta === null) {
    const opMargin = typeof metric['operatingMarginTTM'] === 'number' ? metric['operatingMarginTTM'] as number : null;
    if (opMargin !== null) x3_ebit_ta = opMargin / 100; // proxy
    if (altmanSource === 'quarterly_financials') altmanSource = 'mixed';
  }
  if (x4_mve_tl === null) {
    if (debtToEquity !== null && debtToEquity > 0) x4_mve_tl = 1 / debtToEquity; // proxy
    if (altmanSource === 'quarterly_financials') altmanSource = 'mixed';
  }
  if (x5_sales_ta === null) {
    const assetTurnoverAZ = typeof metric['assetTurnoverTTM'] === 'number' ? metric['assetTurnoverTTM'] as number : null;
    if (assetTurnoverAZ !== null) x5_sales_ta = assetTurnoverAZ;
    if (altmanSource === 'quarterly_financials') altmanSource = 'mixed';
  }

  const altmanComputable: Record<string, boolean> = {
    x1_working_capital: x1_wc_ta !== null,
    x2_retained_earnings: x2_re_ta !== null,
    x3_ebit: x3_ebit_ta !== null,
    x4_equity_to_liabilities: x4_mve_tl !== null,
    x5_asset_turnover: x5_sales_ta !== null,
  };
  const altmanComponentValues: Record<string, number | null> = {
    x1_wc_ta: x1_wc_ta !== null ? round(x1_wc_ta, 4) : null,
    x2_re_ta: x2_re_ta !== null ? round(x2_re_ta, 4) : null,
    x3_ebit_ta: x3_ebit_ta !== null ? round(x3_ebit_ta, 4) : null,
    x4_mve_tl: x4_mve_tl !== null ? round(x4_mve_tl, 4) : null,
    x5_sales_ta: x5_sales_ta !== null ? round(x5_sales_ta, 4) : null,
  };
  const altmanComponentsAvailable = Object.values(altmanComputable).filter(Boolean).length;
  let altmanScore: number | null = null;
  let altmanCapped = false;

  if (altmanComponentsAvailable >= 3) {
    let z = 0;
    if (x1_wc_ta !== null) z += 1.2 * clamp(x1_wc_ta, -1, 1);
    if (x2_re_ta !== null) z += 1.4 * clamp(x2_re_ta, -0.5, 0.5);
    if (x3_ebit_ta !== null) z += 3.3 * clamp(x3_ebit_ta, -0.5, 0.5);
    if (x4_mve_tl !== null) z += 0.6 * Math.min(x4_mve_tl, 5);
    if (x5_sales_ta !== null) z += 1.0 * Math.min(x5_sales_ta, 3);
    altmanScore = round(z, 2);
  }

  // --- Weighted sum ---
  const hasCandles = candles.length >= 20;
  let score: number;
  let formula: string;

  // Christoffersen, Goyenko, Jacobs & Karoui (2018, RFS): options illiquidity
  // premium is ~3.4%/day for ATM calls — liquidity dominates beta for spread traders.
  // Cao & Han (2013, JFE): idiosyncratic vol, not beta, predicts option returns.
  // Weights: 0.25 liq + 0.15 mktcap + 0.15 vol + 0.10 lend + 0.10 beta + 0.25 D/E = 1.0
  if (hasCandles) {
    score = round(
      0.25 * liquidityRatingScore + 0.15 * marketCapScore + 0.15 * volumeScore +
      0.10 * lendabilityScore + 0.10 * betaScore + 0.25 * debtToEquityScore,
      1,
    );
    formula = `0.25*LiqRating(${round(liquidityRatingScore)}) + 0.15*MktCap(${round(marketCapScore)}) + 0.15*Vol(${round(volumeScore)}) + 0.10*Lend(${round(lendabilityScore)}) + 0.10*Beta(${round(betaScore)}) + 0.25*D/E(${round(debtToEquityScore)}) = ${score}`;
  } else {
    // No candle data: exclude volume (15%), renormalize remaining 85% to 100%
    volumeScore = 0;
    avgVol20d = null;
    const w = 0.85;
    score = round(
      (0.25 / w) * liquidityRatingScore + (0.15 / w) * marketCapScore +
      (0.10 / w) * lendabilityScore + (0.10 / w) * betaScore + (0.25 / w) * debtToEquityScore,
      1,
    );
    formula = `Volume EXCLUDED (no candles). Renorm: LiqRating(${round(liquidityRatingScore)}) + MktCap(${round(marketCapScore)}) + Lend(${round(lendabilityScore)}) + Beta(${round(betaScore)}) + D/E(${round(debtToEquityScore)}) = ${score}`;
  }

  // Altman Z hard gate: if computable and Z < 1.8, cap safety at 40
  if (altmanScore !== null && altmanScore < 1.8) {
    score = Math.min(score, 40);
    altmanCapped = true;
  }

  // Borrow rate continuous penalty (Drechsler & Drechsler 2016, JFE)
  // Higher borrow cost directly reduces premium-selling edge through friction.
  // Penalty = min(20, borrowRate × 0.8): 5%→-4pts, 12.5%→-10pts, 25%+→-20pts cap
  const borrowRate = tt?.borrowRate ?? null;
  const borrowRatePenalty = round(Math.min(20, (borrowRate ?? 0) * 0.8), 1);
  const safetyScorePreBorrowPenalty = score;
  if (borrowRatePenalty > 0) {
    score = Math.max(0, round(score - borrowRatePenalty, 1));
    formula += ` → -${borrowRatePenalty} borrow rate penalty (${borrowRate}% × 0.8) = ${score}`;
  }

  // Revenue concentration HHI modifier
  // HHI > 0.70 = concentrated revenue → higher fundamental risk → penalty
  // HHI < 0.30 = diversified → lower risk → small bonus
  const revBreakdown = input.finnhubRevenueBreakdown;
  let concentrationModifier = 0;
  let hhi: number | null = null;
  let segmentCount = 0;
  let largestSegmentPct: number | null = null;

  if (revBreakdown) {
    hhi = revBreakdown.hhi;
    segmentCount = revBreakdown.segments.length;
    if (revBreakdown.totalRevenue > 0 && revBreakdown.segments.length > 0) {
      const largestRev = Math.max(...revBreakdown.segments.map(s => s.revenue));
      largestSegmentPct = round((largestRev / revBreakdown.totalRevenue) * 100, 1);
    }

    if (hhi > 0.85) concentrationModifier = -0.15;       // Extremely concentrated
    else if (hhi > 0.70) concentrationModifier = -0.10;   // Highly concentrated
    else if (hhi < 0.20) concentrationModifier = 0.03;    // Well diversified — small bonus
    else if (hhi < 0.30) concentrationModifier = 0.01;    // Moderately diversified
    // 0.30-0.70: no modifier

    if (concentrationModifier !== 0) {
      score = clamp(round(score * (1 + concentrationModifier), 1), 0, 100);
      formula += ` → ×${round(1 + concentrationModifier, 2)} HHI(${hhi}) = ${score}`;
    }
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
    notes: `Liquidity: ${liqRating ?? 'N/A'}, MktCap: ${marketCap ? '$' + (marketCap / 1e9).toFixed(1) + 'B' : 'N/A'}, Beta: ${beta ?? 'N/A'}, D/E: ${debtToEquity ?? 'N/A'}${altmanCapped ? '. ALTMAN Z CAPPED: Z=' + altmanScore + ' < 1.8' : ''}${!hasCandles ? '. Volume excluded (no candle data)' : ''}${revBreakdown ? `. HHI=${hhi}, ${segmentCount} segments, largest=${largestSegmentPct}%` : ''}`,
    sub_scores: {
      liquidity_rating_score: round(liquidityRatingScore),
      market_cap_score: round(marketCapScore),
      volume_score: round(volumeScore),
      lendability_score: round(lendabilityScore),
      beta_score: round(betaScore),
      debt_to_equity_score: round(debtToEquityScore),
    },
    piotroski_source: piotroskiSource,
    piotroski: {
      available_signals: computedSignals.length,
      total_signals: 9,
      computable: piotroskiSignals,
      change_signals: {
        computable_count: changeComputable.length,
        passed_count: changePassed,
        change_score: changeScore,
        modifier: piotroskiChangeModifier,
      },
      note: computedSignals.length === 9
        ? `${passedSignals}/9 signals passing (all computable). Change signals: ${changePassed}/${changeComputable.length} → modifier ${piotroskiChangeModifier > 0 ? '+' : ''}${piotroskiChangeModifier} on profitability. Source: ${piotroskiSource}`
        : `${passedSignals}/${computedSignals.length} signals passing (${9 - computedSignals.length} not computable). Change signals: ${changePassed}/${changeComputable.length} → modifier ${piotroskiChangeModifier > 0 ? '+' : ''}${piotroskiChangeModifier} on profitability. Source: ${piotroskiSource}`,
    },
    altman_z: {
      score: altmanScore,
      components_available: altmanComponentsAvailable,
      components_total: 5,
      computable: altmanComputable,
      component_values: altmanComponentValues,
      capped: altmanCapped,
      source: altmanSource,
    },
    borrow_rate_adjustment: {
      borrow_rate: borrowRate,
      penalty: borrowRatePenalty,
      score_before_penalty: safetyScorePreBorrowPenalty,
    },
    revenue_concentration: {
      hhi,
      segment_count: segmentCount,
      largest_segment_pct: largestSegmentPct,
      concentration_modifier: concentrationModifier,
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
  let grossMarginScore = 40; // penalty default — missing data
  if (grossMargin !== null) {
    if (grossMargin > 60) grossMarginScore = 85;
    else if (grossMargin > 40) grossMarginScore = 70;
    else if (grossMargin > 20) grossMarginScore = 55;
    else if (grossMargin > 0) grossMarginScore = 35;
    else grossMarginScore = 20;
  }

  // --- ROE (15%) ---
  const roe = typeof metric['roeTTM'] === 'number' ? metric['roeTTM'] as number : null;
  let roeScore = 40; // penalty default — missing data
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
  let roaScore = 40; // penalty default — missing data
  if (roa !== null) {
    if (roa > 15) roaScore = 90;
    else if (roa > 10) roaScore = 75;
    else if (roa > 5) roaScore = 60;
    else if (roa > 2) roaScore = 45;
    else if (roa > 0) roaScore = 30;
    else roaScore = 15;
  }

  // --- ROIC (8%) — capital efficiency, calculated from XBRL financials ---
  const afProf = input.annualFinancials;
  const afCur = afProf?.currentYear ?? null;
  let roic: number | null = null;
  let roicSource = 'N/A';
  if (afCur) {
    const opIncome = afCur.operatingIncome;
    const taxExp = afCur.incomeTaxExpense;
    const preTax = afCur.preTaxIncome;
    const equity = afCur.stockholdersEquity;
    const ltDebtCur = afCur.longTermDebtCurrent ?? 0;
    const ltDebtNon = afCur.longTermDebtNoncurrent ?? 0;
    const cash = afCur.cashAndEquivalents;

    if (opIncome !== null && taxExp !== null && preTax !== null && preTax !== 0
        && equity !== null && cash !== null) {
      const etr = Math.max(0, Math.min(1, taxExp / preTax)); // clamp ETR to [0, 1]
      const nopat = opIncome * (1 - etr);
      const investedCapital = equity + ltDebtCur + ltDebtNon - cash;
      if (investedCapital > 0) {
        roic = round((nopat / investedCapital) * 100, 2);
        roicSource = 'CALCULATED';
      }
    }
  }
  let roicScore = 50; // neutral default — missing data
  if (roic !== null) {
    if (roic > 25) roicScore = 90;
    else if (roic > 15) roicScore = 80;
    else if (roic > 10) roicScore = 65;
    else if (roic > 5) roicScore = 50;
    else if (roic > 0) roicScore = 30;
    else roicScore = 15;
  }

  // --- P/E ratio (10%) ---
  const pe = tt?.peRatio ?? (typeof metric['peNormalizedAnnual'] === 'number' ? metric['peNormalizedAnnual'] : null);
  let peScore = 40; // penalty default — missing data
  if (pe !== null && typeof pe === 'number') {
    if (pe < 0) peScore = 20;           // Negative earnings
    else if (pe < 5) peScore = 35;      // Suspiciously cheap
    else if (pe < 10) peScore = 60;     // Value
    else if (pe <= 25) peScore = 75;    // Fair value
    else if (pe <= 40) peScore = 55;    // Growth premium
    else if (pe <= 60) peScore = 40;    // Expensive
    else peScore = 25;                  // Extremely expensive
  }

  // --- P/S ratio (7%) — revenue-based valuation (TTM preferred, Annual fallback) ---
  const psTTM = typeof metric['psTTM'] === 'number' ? metric['psTTM'] as number : null;
  const psAnnual = typeof metric['psAnnual'] === 'number' ? metric['psAnnual'] as number : null;
  const ps = psTTM ?? psAnnual;
  const psSource = psTTM !== null ? 'TTM' : psAnnual !== null ? 'Annual' : 'N/A';
  let psScore = 50; // neutral default — missing data
  if (ps !== null) {
    if (ps < 0) psScore = 20;           // Negative revenue
    else if (ps < 1) psScore = 70;       // Very low — possible distress, don't reward maximally
    else if (ps < 3) psScore = 80;       // Value
    else if (ps < 5) psScore = 65;       // Fair
    else if (ps < 10) psScore = 50;      // Growth premium
    else if (ps < 20) psScore = 30;      // Expensive
    else psScore = 15;                    // Extremely expensive
  }

  // --- EV/EBITDA (7%) — enterprise valuation (TTM preferred, Annual fallback) ---
  const evEbitdaTTM = typeof metric['evEbitdaTTM'] === 'number' ? metric['evEbitdaTTM'] as number : null;
  const evEbitdaAnnual = typeof metric['evEbitdaAnnual'] === 'number' ? metric['evEbitdaAnnual'] as number : null;
  const evEbitda = evEbitdaTTM ?? evEbitdaAnnual;
  const evEbitdaSource = evEbitdaTTM !== null ? 'TTM' : evEbitdaAnnual !== null ? 'Annual' : 'N/A';
  let evEbitdaScore = 50; // neutral default — missing data
  if (evEbitda !== null) {
    if (evEbitda < 0) evEbitdaScore = 20;       // Negative EBITDA
    else if (evEbitda < 4) evEbitdaScore = 50;   // Suspiciously cheap — possible distress
    else if (evEbitda < 7) evEbitdaScore = 85;   // Attractive
    else if (evEbitda < 10) evEbitdaScore = 70;  // Good
    else if (evEbitda < 15) evEbitdaScore = 55;  // Fair
    else if (evEbitda < 25) evEbitdaScore = 35;  // Expensive
    else evEbitdaScore = 20;                      // Very expensive
  }

  // --- FCF yield (18%) — calculated from XBRL financials ---
  let fcfShareTTM: number | null = null;
  let fcfSource = 'N/A';
  if (afCur) {
    const opCf = afCur.operatingCashFlow;
    const capex = afCur.capitalExpenditure;
    const shares = afCur.weightedAvgShares;
    if (opCf !== null && capex !== null && shares !== null && shares > 0) {
      const fcf = opCf - Math.abs(capex); // capex reported as positive outflow
      fcfShareTTM = round(fcf / shares, 4);
      fcfSource = 'CALCULATED';
    }
  }
  const currentPrice = typeof metric['marketCapitalization'] === 'number' && typeof metric['shareOutstanding'] === 'number' && (metric['shareOutstanding'] as number) > 0
    ? (metric['marketCapitalization'] as number) * 1e6 / ((metric['shareOutstanding'] as number) * 1e6)
    : null;
  let fcfScore = 40; // penalty default — missing data
  if (fcfShareTTM !== null && currentPrice !== null && currentPrice > 0) {
    const fcfYield = (fcfShareTTM / currentPrice) * 100;
    if (fcfYield > 8) fcfScore = 85;
    else if (fcfYield > 4) fcfScore = 70;
    else if (fcfYield > 1) fcfScore = 55;
    else if (fcfYield > 0) fcfScore = 40;
    else fcfScore = 25; // Negative FCF
  }

  // --- Earnings quality (25%) — full scoreEarningsQuality logic inlined ---
  let surpriseConsistency = 40; // penalty default — missing earnings data
  let dteScore = 40; // penalty default — missing earnings date
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
      surprises.push(e.surprisePercent);
    }

    // SUE-relative threshold (Bernard & Thomas 1989)
    const sueThreshold = computeSurpriseThreshold(surprises);

    for (const surp of surprises) {
      if (surp > sueThreshold) beats++;
      else if (surp < -sueThreshold) misses++;
      else inLine++;
    }

    totalQ = earnings.length;
    beatRate = round(beats / totalQ * 100, 1);

    avgSurprise = surprises.length > 0
      ? round(surprises.reduce((a, b) => a + b, 0) / surprises.length, 2)
      : null;

    // Streak detection (most recent first) — uses same SUE threshold
    let consecutiveBeats = 0;
    let consecutiveMisses = 0;
    for (const e of earnings) {
      if (e.surprisePercent > sueThreshold) {
        if (consecutiveMisses === 0) consecutiveBeats++;
        else break;
      } else if (e.surprisePercent < -sueThreshold) {
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
  let earningsQualityScore = round(
    0.50 * surpriseConsistency + 0.30 * dteScore + 0.20 * beatRateScore,
    1,
  );

  // --- SUE + Finnhub ML Ensemble ---
  // Cross-validate our SUE-based score against Finnhub's ML earnings quality score.
  // Agreement increases confidence; disagreement compresses toward neutral.
  const finnhubEQ = input.finnhubEarningsQuality;
  let eqEnsembleAgreement: 'agree' | 'disagree' | 'unavailable' = 'unavailable';
  let eqConfidenceModifier = 0;
  let finnhubEqScore: number | null = null;
  let finnhubEqLetter: string | null = null;

  if (finnhubEQ) {
    finnhubEqScore = finnhubEQ.score;
    finnhubEqLetter = finnhubEQ.letterScore;

    // Both scores on 0-100 scale. Determine if they agree on quality level.
    // SUE score is earningsQualityScore (0-100), Finnhub score is 0-100.
    // "High quality" = both > 60, "Low quality" = both < 40
    const sueHigh = earningsQualityScore > 60;
    const sueLow = earningsQualityScore < 40;
    const mlHigh = finnhubEqScore > 60;
    const mlLow = finnhubEqScore < 40;

    if ((sueHigh && mlHigh) || (sueLow && mlLow)) {
      // Both agree on direction (both high or both low)
      eqEnsembleAgreement = 'agree';
      eqConfidenceModifier = 0.15; // Boost: move 15% further from neutral
    } else if ((sueHigh && mlLow) || (sueLow && mlHigh)) {
      // Strong disagreement: one sees high quality, other sees low
      eqEnsembleAgreement = 'disagree';
      eqConfidenceModifier = -0.20; // Compress: move 20% closer to neutral
    } else {
      // One is neutral zone — mild signal, no modifier
      eqEnsembleAgreement = 'agree'; // No strong disagreement
      eqConfidenceModifier = 0;
    }

    // Apply modifier: scale distance from neutral (50)
    if (eqConfidenceModifier !== 0) {
      const distFromNeutral = earningsQualityScore - 50;
      earningsQualityScore = round(clamp(50 + distFromNeutral * (1 + eqConfidenceModifier), 0, 100), 1);
    }
  }

  // --- Weighted sum (9 components, sum=1.00) ---
  // 0.10+0.10+0.07+0.08+0.10+0.07+0.07+0.18+0.23 = 1.00
  const score = round(
    0.10 * grossMarginScore + 0.10 * roeScore + 0.07 * roaScore +
    0.08 * roicScore + 0.10 * peScore + 0.07 * psScore +
    0.07 * evEbitdaScore + 0.18 * fcfScore + 0.23 * earningsQualityScore,
    1,
  );

  const ensembleTag = finnhubEQ
    ? ` [EQ_ensemble=${eqEnsembleAgreement}, mod=${eqConfidenceModifier > 0 ? '+' : ''}${round(eqConfidenceModifier * 100)}%]`
    : '';
  const formula = `0.10*Margin(${round(grossMarginScore)}) + 0.10*ROE(${round(roeScore)}) + 0.07*ROA(${round(roaScore)}) + 0.08*ROIC(${round(roicScore)}) + 0.10*PE(${round(peScore)}) + 0.07*PS(${round(psScore)}) + 0.07*EV/EBITDA(${round(evEbitdaScore)}) + 0.18*FCF(${round(fcfScore)}) + 0.23*EQ(${round(earningsQualityScore)})${ensembleTag} = ${score}`;

  return {
    score: round(score),
    weight: 0.30,
    inputs: {
      gross_margin_ttm: grossMargin,
      roe_ttm: roe,
      roa_ttm: roa,
      roic: roic,
      roic_source: roicSource,
      pe_ratio: pe as number | null,
      ps_ratio: ps,
      ps_source: psSource,
      ev_ebitda: evEbitda,
      ev_ebitda_source: evEbitdaSource,
      fcf_per_share_ttm: fcfShareTTM,
      fcf_source: fcfSource,
      quarters_available: totalQ,
      days_till_earnings: daysTillEarnings,
    },
    formula,
    notes: `Margin=${grossMargin ?? 'N/A'}%, ROE=${roe ?? 'N/A'}%, ROA=${roa ?? 'N/A'}%, ROIC=${roic ?? 'N/A'}%(${roicSource}), PE=${pe ?? 'N/A'}, P/S=${ps ?? 'N/A'}(${psSource}), EV/EBITDA=${evEbitda ?? 'N/A'}(${evEbitdaSource}), FCF/sh=${fcfShareTTM ?? 'N/A'}(${fcfSource}). ${beats} beats, ${misses} misses, ${inLine} in-line out of ${totalQ}Q${finnhubEQ ? `. EQ_ML=${finnhubEqLetter}(${finnhubEqScore}), ensemble=${eqEnsembleAgreement}` : ''}`,
    sub_scores: {
      gross_margin_score: round(grossMarginScore),
      roe_score: round(roeScore),
      roa_score: round(roaScore),
      roic_score: round(roicScore),
      pe_score: round(peScore),
      ps_score: round(psScore),
      ev_ebitda_score: round(evEbitdaScore),
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
      earnings_quality_ensemble: {
        finnhub_eq_score: finnhubEqScore,
        finnhub_eq_letter: finnhubEqLetter,
        sue_score: round(0.50 * round(surpriseConsistency) + 0.30 * round(dteScore) + 0.20 * beatRateScore, 1), // pre-ensemble SUE score
        ensemble_agreement: eqEnsembleAgreement,
        confidence_modifier: eqConfidenceModifier,
      },
    },
  };
}

// ===== GROWTH SUB-SCORE (15%) =====

function scoreGrowth(input: ConvergenceInput): GrowthTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};

  // --- Revenue growth (40%) ---
  const revGrowth = typeof metric['revenueGrowthTTMYoy'] === 'number' ? metric['revenueGrowthTTMYoy'] as number : null;
  let revenueGrowthScore = 40; // penalty default — missing data
  if (revGrowth !== null) {
    if (revGrowth > 20) revenueGrowthScore = 90;
    else if (revGrowth > 10) revenueGrowthScore = 75;
    else if (revGrowth > 5) revenueGrowthScore = 60;
    else if (revGrowth > 0) revenueGrowthScore = 50;
    else revenueGrowthScore = 30;
  }

  // --- EPS growth (40%) ---
  const epsGrowth = typeof metric['epsGrowthTTMYoy'] === 'number' ? metric['epsGrowthTTMYoy'] as number : null;
  let epsGrowthScore = 40; // penalty default — missing data
  if (epsGrowth !== null) {
    if (epsGrowth > 25) epsGrowthScore = 90;
    else if (epsGrowth > 15) epsGrowthScore = 75;
    else if (epsGrowth > 5) epsGrowthScore = 60;
    else if (epsGrowth > 0) epsGrowthScore = 50;
    else epsGrowthScore = 30;
  }

  // --- Dividend growth (20%) ---
  const divGrowth = typeof metric['dividendGrowthRate5Y'] === 'number' ? metric['dividendGrowthRate5Y'] as number : null;
  let dividendGrowthScore = 40; // penalty default — missing data
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

// ===== FUNDAMENTAL RISK SUB-SCORE (15%) =====
// Zhan, Han, Cao & Tong (2022, RFS): cash flow variance and earnings predictability
// predict delta-hedged option returns; traditional efficiency metrics do not.

function scoreFundamentalRisk(input: ConvergenceInput): FundamentalRiskTrace {
  const metric = input.finnhubFundamentals?.metric ?? {};
  const af = input.annualFinancials;
  const qf = input.quarterlyFinancials;
  const earnings = input.finnhubEarnings;

  // --- Cash flow stability (40%) ---
  // Prefer quarterly financials (up to 40 quarters), then annual, then TTM sign check
  let cashFlowStabilityScore = 40; // penalty default — missing data
  let cfSource = 'missing';
  let cfQuartersUsed = 0;
  let cfCoV: number | null = null;
  let fcfPositivePct: number | null = null;

  if (qf && qf.periods.length >= 4) {
    // REAL quarterly cash flow data
    const ocfValues = qf.periods
      .map(p => p.operatingCashFlow)
      .filter((v): v is number => v !== null);
    cfQuartersUsed = ocfValues.length;

    if (ocfValues.length >= 4) {
      // Coefficient of variation over all available quarters
      const cfMean = ocfValues.reduce((a, b) => a + b, 0) / ocfValues.length;
      const cfStd = Math.sqrt(ocfValues.reduce((s, v) => s + (v - cfMean) ** 2, 0) / (ocfValues.length - 1));
      const cov = cfMean !== 0 ? Math.abs(cfStd / cfMean) : Infinity;
      cfCoV = round(cov, 4);

      // More quarters → more reliable. Continuous scoring.
      if (cov < 0.3) cashFlowStabilityScore = 85;
      else if (cov < 0.5) cashFlowStabilityScore = 75;
      else if (cov < 0.8) cashFlowStabilityScore = 65;
      else if (cov < 1.0) cashFlowStabilityScore = 55;
      else if (cov < 1.5) cashFlowStabilityScore = 40;
      else cashFlowStabilityScore = 25;

      cfSource = `quarterly_financials CoV=${round(cov, 2)} (${ocfValues.length}Q)`;

      // FCF consistency: % of quarters with positive free cash flow
      const fcfValues = qf.periods
        .map(p => p.freeCashFlow)
        .filter((v): v is number => v !== null);
      if (fcfValues.length >= 4) {
        const posCount = fcfValues.filter(v => v > 0).length;
        fcfPositivePct = round((posCount / fcfValues.length) * 100, 1);
        // Blend FCF consistency into score (±10 modifier)
        const fcfModifier = fcfPositivePct >= 80 ? 5 : fcfPositivePct >= 60 ? 0 : fcfPositivePct >= 40 ? -5 : -10;
        cashFlowStabilityScore = clamp(cashFlowStabilityScore + fcfModifier, 0, 100);
        cfSource += `, FCF+=${fcfPositivePct}%`;
      }
    }
  }

  if (cfSource === 'missing') {
    // Fallback tier 1: 2-year annual financials
    const curOCF = af?.currentYear?.operatingCashFlow ?? null;
    const priOCF = af?.priorYear?.operatingCashFlow ?? null;

    if (curOCF !== null && priOCF !== null) {
      const cfValues = [curOCF, priOCF];
      const cfMean = cfValues.reduce((a, b) => a + b, 0) / cfValues.length;
      const cfStd = Math.sqrt(cfValues.reduce((s, v) => s + (v - cfMean) ** 2, 0) / (cfValues.length - 1));
      const cov = cfMean !== 0 ? Math.abs(cfStd / cfMean) : Infinity;
      cfCoV = round(cov, 4);
      cfQuartersUsed = 0; // annual, not quarterly

      if (cov < 0.2) cashFlowStabilityScore = 85;
      else if (cov < 0.5) cashFlowStabilityScore = 70;
      else if (cov < 1.0) cashFlowStabilityScore = 55;
      else if (cov < 2.0) cashFlowStabilityScore = 40;
      else cashFlowStabilityScore = 25;
      cfSource = `annual_financials CoV=${round(cov, 2)}`;
    } else {
      // Fallback tier 2: TTM free cash flow sign check
      const fcfTTM = typeof metric['freeCashFlowPerShareTTM'] === 'number' ? metric['freeCashFlowPerShareTTM'] as number : null;
      if (fcfTTM !== null) {
        cashFlowStabilityScore = fcfTTM > 0 ? 60 : 35;
        cfSource = `proxy_imputed TTM FCF/sh=${round(fcfTTM, 2)} (${fcfTTM > 0 ? 'positive' : 'negative'})`;
      }
    }
  }

  // --- Earnings predictability (35%) ---
  // StdDev of surprise percentages — same computation as computeSurpriseThreshold
  let earningsPredictabilityScore = 40; // penalty default — missing or insufficient data
  let epSource = 'missing';

  if (earnings.length >= 2) {
    const surprises = earnings.map(e => e.surprisePercent);
    const surpriseMean = surprises.reduce((a, b) => a + b, 0) / surprises.length;
    const surpriseVariance = surprises.reduce((s, v) => s + (v - surpriseMean) ** 2, 0) / (surprises.length - 1);
    const surpriseStdDev = Math.sqrt(surpriseVariance);

    if (surpriseStdDev < 2) earningsPredictabilityScore = 85;
    else if (surpriseStdDev < 5) earningsPredictabilityScore = 70;
    else if (surpriseStdDev < 10) earningsPredictabilityScore = 55;
    else if (surpriseStdDev < 20) earningsPredictabilityScore = 40;
    else earningsPredictabilityScore = 25;
    epSource = `stdDev=${round(surpriseStdDev, 2)}% over ${surprises.length}Q`;
  }

  // --- Asset turnover (25%) — retained from original efficiency score ---
  const assetTurnover = typeof metric['assetTurnoverTTM'] === 'number' ? metric['assetTurnoverTTM'] as number : null;
  let assetTurnoverScore = 40; // penalty default — missing data
  if (assetTurnover !== null) {
    if (assetTurnover > 1.5) assetTurnoverScore = 90;
    else if (assetTurnover > 1.0) assetTurnoverScore = 75;
    else if (assetTurnover > 0.5) assetTurnoverScore = 60;
    else if (assetTurnover > 0.3) assetTurnoverScore = 45;
    else assetTurnoverScore = 30;
  }

  const score = round(
    0.40 * cashFlowStabilityScore + 0.35 * earningsPredictabilityScore + 0.25 * assetTurnoverScore,
    1,
  );

  const formula = `0.40*CFStability(${round(cashFlowStabilityScore)}) + 0.35*EarnPredict(${round(earningsPredictabilityScore)}) + 0.25*AssetTurn(${round(assetTurnoverScore)}) = ${score}`;

  return {
    score: round(score),
    weight: 0.15,
    inputs: {
      cash_flow_stability: cfSource,
      earnings_predictability: epSource,
      asset_turnover_ttm: assetTurnover,
    },
    formula,
    notes: `CF: ${cfSource}, Earnings: ${epSource}, AssetTurn=${assetTurnover ?? 'N/A'}`,
    sub_scores: {
      cash_flow_stability_score: round(cashFlowStabilityScore),
      earnings_predictability_score: round(earningsPredictabilityScore),
      asset_turnover_score: round(assetTurnoverScore),
    },
    cash_flow_detail: {
      cf_stability_source: cfSource.split(' ')[0], // "quarterly_financials" | "annual_financials" | "proxy_imputed" | "missing"
      cf_quarters_used: cfQuartersUsed,
      cov: cfCoV,
      fcf_positive_pct: fcfPositivePct,
    },
  };
}

// ===== MAIN QUALITY GATE SCORER =====

export function scoreQualityGate(input: ConvergenceInput): QualityGateResult {
  const safety = scoreSafety(input);
  const profitability = scoreProfitability(input);
  const growth = scoreGrowth(input);
  const fundamentalRisk = scoreFundamentalRisk(input);

  // Piotroski change-signal modifier on profitability (Schwartz & Hanauer 2024)
  // Level signals (1-4) already captured by ROE/ROA/FCF; change signals (5-9) are unique.
  const fScoreModifier = safety.piotroski.change_signals.modifier;
  profitability.score = clamp(round(profitability.score + fScoreModifier, 1), 0, 100);
  if (fScoreModifier !== 0) {
    profitability.formula += ` → ${fScoreModifier > 0 ? '+' : ''}${fScoreModifier} (F-Score change signals) = ${profitability.score}`;
  }

  let score = round(
    safety.weight * safety.score +
    profitability.weight * profitability.score +
    growth.weight * growth.score +
    fundamentalRisk.weight * fundamentalRisk.score,
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

  // Build DataConfidence
  const tt = input.ttScanner;
  const metric = input.finnhubFundamentals?.metric ?? {};
  const imputedFields: string[] = [];
  // Safety sub-scores
  if (tt?.liquidityRating == null) imputedFields.push('safety.liquidity_rating');
  if (tt?.marketCap == null) imputedFields.push('safety.market_cap');
  if (input.candles.length < 20) imputedFields.push('safety.volume');
  if (tt?.beta == null && typeof metric['beta'] !== 'number') imputedFields.push('safety.beta');
  if (typeof metric['totalDebt/totalEquityQuarterly'] !== 'number') imputedFields.push('safety.debt_to_equity');
  // Profitability sub-scores
  if (typeof metric['grossMarginTTM'] !== 'number') imputedFields.push('profitability.gross_margin');
  if (typeof metric['roeTTM'] !== 'number') imputedFields.push('profitability.roe');
  if (typeof metric['roaTTM'] !== 'number') imputedFields.push('profitability.roa');
  if (tt?.peRatio == null && typeof metric['peNormalizedAnnual'] !== 'number') imputedFields.push('profitability.pe_ratio');
  if (profitability.inputs.fcf_source === 'N/A') imputedFields.push('profitability.fcf');
  if (profitability.inputs.roic_source === 'N/A') imputedFields.push('profitability.roic');
  if (typeof metric['psTTM'] !== 'number' && typeof metric['psAnnual'] !== 'number') imputedFields.push('profitability.ps');
  if (typeof metric['evEbitdaTTM'] !== 'number' && typeof metric['evEbitdaAnnual'] !== 'number') imputedFields.push('profitability.ev_ebitda');
  if (input.finnhubEarnings.length === 0) imputedFields.push('profitability.earnings_consistency');
  if (tt?.daysTillEarnings == null) imputedFields.push('profitability.earnings_dte');
  if (safety.piotroski.change_signals.computable_count === 0) imputedFields.push('profitability.fscore_change_signals');
  // Growth sub-scores
  if (typeof metric['revenueGrowthTTMYoy'] !== 'number') imputedFields.push('growth.revenue');
  if (typeof metric['epsGrowthTTMYoy'] !== 'number') imputedFields.push('growth.eps');
  if (typeof metric['dividendGrowthRate5Y'] !== 'number') imputedFields.push('growth.dividend');
  // Fundamental risk sub-scores
  const af = input.annualFinancials;
  const hasCfData = af?.currentYear?.operatingCashFlow != null && af?.priorYear?.operatingCashFlow != null;
  const hasFcfTTM = typeof metric['freeCashFlowPerShareTTM'] === 'number';
  if (!hasCfData && !hasFcfTTM) imputedFields.push('fundamentalRisk.cash_flow_stability');
  if (input.finnhubEarnings.length < 2) imputedFields.push('fundamentalRisk.earnings_predictability');
  if (typeof metric['assetTurnoverTTM'] !== 'number') imputedFields.push('fundamentalRisk.asset_turnover');

  const totalSubScores = 5 + 10 + 3 + 3; // safety(5 main) + profitability(10: 6 margin/return/valuation + 1 fcf + 3 earnings) + growth(3) + fundamentalRisk(3)
  const dataConfidence: DataConfidence = {
    total_sub_scores: totalSubScores,
    imputed_sub_scores: imputedFields.length,
    confidence: round(1 - imputedFields.length / totalSubScores, 4),
    imputed_fields: imputedFields,
  };

  return {
    score,
    mspr_adjustment: msprAdjustment,
    data_confidence: dataConfidence,
    breakdown: {
      safety,
      profitability,
      growth,
      fundamentalRisk,
    },
  };
}
