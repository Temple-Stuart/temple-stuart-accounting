import test from 'node:test';
import assert from 'node:assert/strict';
import { buyerScore, sellerScore, scoreAll } from '../convergence/composite';
import { INPUT_SIGNS, buyerAdmittedInputs } from '../convergence/input-signs';
import { BUY_CATALYST_HV_OVER_IV_PTS, BUY_PREFILTER_HV_OVER_IV_MIN_PTS, buyCatalysts, earningsDateSources, earningsWindow, sellerEarningsHazard, sideOf, stepCReason } from '../convergence/side-rules';
import { UNDEFINED_RISK_OPEN_POSITION_CAP, checkUndefinedRiskCap, countUndefinedRiskPositions } from '../convergence/undefined-risk';
import { computePreFilter } from '../convergence/pre-filter';
import { generateStrategies, type StrikeData } from '../strategy-builder';
import { generateTradeCards } from '../convergence/trade-cards';
import { GATE_CARDS, gateCardsMarkdown } from '../convergence/gateCards';
import type { BuyerComponent, ConvergenceInput, FredMacroData, InfoEdgeResult, QualityGateResult, RegimeResult, TTScannerData, VolEdgeResult } from '../convergence/types';

// MODEL-01 STEP 7 — tests on fixtures. Pure modules: no database, no vendor.

// ── gate-output fixtures (what the four gates hand the composite) ─────────

function volEdgeFx(o: { score?: number | null; vrp?: number | null; ivc?: number | null; spread?: number | null; hv?: [number, number, number] | null; gex?: number | null; volume?: number | null } = {}): VolEdgeResult {
  const hv = o.hv === undefined ? [22, 24, 25] : o.hv;
  return {
    score: o.score === undefined ? 60 : o.score,
    data_confidence: { total_sub_scores: 12, imputed_sub_scores: 0, confidence: 1, imputed_fields: [], excluded_fields: [], active_signal_count: 12 },
    breakdown: {
      mispricing: {
        score: 60, weight: 0.4, active_signal_count: 4, total_signal_count: 4, excluded_components: [],
        inputs: { IV_30: 28, HV_30: hv ? hv[0] : null, HV_60: hv ? hv[1] : null, HV_90: hv ? hv[2] : null, IV_HV_spread: o.spread === undefined ? 6 : o.spread },
        component_scores: { vrp: o.vrp === undefined ? 70 : o.vrp, iv_composite: o.ivc === undefined ? 62 : o.ivc, iv_hv_spread: 30, hv_accel: 80 },
      },
      term_structure: { score: 85, weight: 0.25, active_signal_count: 1, total_signal_count: 1, excluded_components: [], shape: 'CONTANGO' },
      technicals: { score: 55, weight: 0.15, active_signal_count: 5, total_signal_count: 5, excluded_components: [], sub_scores: { rsi_score: 55, trend_score: 70, bollinger_score: 90, volume_score: o.volume === undefined ? 62 : o.volume, high52w_score: 75 }, indicators: { latest_close: 100 } },
      skew: { score: 60, weight: 0.1, active_signal_count: 1, total_signal_count: 1, excluded_components: [], skew_score: 60 },
      gex: { score: 70, weight: 0.1, active_signal_count: o.gex === null ? 0 : 1, total_signal_count: 1, excluded_components: [], gex_score: o.gex === undefined ? 70 : (o.gex ?? 0) },
    },
  } as unknown as VolEdgeResult;
}
function qualityFx(o: { score?: number | null; safety?: Partial<Record<string, number | null>> | null } = {}): QualityGateResult {
  const ss = o.safety === null ? null : { liquidity_rating_score: 75, market_cap_score: 90, volume_score: 75, lendability_score: 80, beta_score: 65, debt_to_equity_score: 65, ...(o.safety ?? {}) };
  return {
    score: o.score === undefined ? 58 : o.score,
    mspr_adjustment: 0,
    data_confidence: { total_sub_scores: 23, imputed_sub_scores: 0, confidence: 1, imputed_fields: [], excluded_fields: [], active_signal_count: 23 },
    breakdown: {
      safety: { score: 74, weight: 0.4, active_signal_count: ss ? 6 : 0, total_signal_count: 6, excluded_components: [], sub_scores: ss ?? { liquidity_rating_score: null, market_cap_score: null, volume_score: null, lendability_score: null, beta_score: null, debt_to_equity_score: null }, piotroski: { available_signals: 9, total_signals: 9 }, altman_z: { components_available: 5, components_total: 5, capped: false } },
      profitability: { score: 55, weight: 0.3, active_signal_count: 9, earnings_quality: { earnings_detail: { streak: 'MIXED' } } },
      growth: { score: 50, weight: 0.15, active_signal_count: 3 },
      fundamentalRisk: { score: 50, weight: 0.15, active_signal_count: 3 },
    },
  } as unknown as QualityGateResult;
}
function regimeFx(o: { score?: number | null; ts?: number | null; vvix?: number | null; brake?: 'OFF' | 'ON' | 'UNVERIFIED' } = {}): RegimeResult {
  const brake = o.brake ?? 'UNVERIFIED';
  return {
    score: o.score === undefined ? 52 : o.score,
    data_confidence: { total_sub_scores: 16, imputed_sub_scores: 0, confidence: 1, imputed_fields: [], excluded_fields: [], active_signal_count: 16 },
    breakdown: {
      regime_scores: o.score === null ? null : { goldilocks: 0.4, reflation: 0.3, stagflation: 0.2, deflation: 0.1 },
      dominant_regime: o.score === null ? null : 'GOLDILOCKS',
      regime_signals: { yield_curve_spread: 0.5, yield_curve_inverted: false, hy_spread: 3.5, hy_stress_level: 'normal' },
      vix_overlay: { vix: 18, adjustment_type: 'NEUTRAL' },
      best_strategy: 'Iron Condor',
      spy_correlation_modifier: { corr_spy: 0.7, multiplier: 0.73 },
      vol_conditioners: { vix_term_structure: { score: o.ts === undefined ? 58 : o.ts, raw_value: 0.9 }, vvix: { score: o.vvix === undefined ? null : o.vvix, raw_value: null } },
      survival_brake: { state: brake, reasons: [], vix_term_structure_ratio: 0.9, vvix: null, thresholds: { backwardation_ratio: 1, vvix_elevated: 110 }, declaration: brake === 'OFF' ? 'Regime brake off' : 'REGIME BRAKE UNVERIFIED: brake inputs unavailable (VVIX)' },
    },
  } as unknown as RegimeResult;
}
function infoEdgeFx(o: { score?: number | null; flow?: number | null; buzz?: number | null; sq?: number | null; event?: number | null } = {}): InfoEdgeResult {
  return {
    score: o.score === undefined ? 45 : o.score,
    data_confidence: { total_sub_scores: 11, imputed_sub_scores: 0, confidence: 1, imputed_fields: [], excluded_fields: [], active_signal_count: 11 },
    filing_recency: { filing_signal_active: false, filing_modifier: 0 },
    breakdown: {
      analyst_consensus: null, price_target_signal: null, upgrade_downgrade_signal: null, earnings_momentum: null, institutional_ownership: null, fund_ownership_flow: null, recommendation_revision: null,
      insider_activity: { insider_detail: { latest_mspr: 3, avg_mspr_3m: 2 } },
      flow_signal: o.flow === null ? null : { sub_scores: { unusual_activity_score: o.flow === undefined ? 72 : o.flow, put_call_ratio_score: 55, volume_bias_score: 50, option_stock_ratio_score: 60 } },
      news_sentiment: o.buzz === null ? null : { sub_scores: { buzz_score: o.buzz === undefined ? 65 : o.buzz, sentiment_score: 58, source_quality_score: o.sq === undefined ? 80 : o.sq } },
      material_event_flag: o.event === null ? null : { score: o.event === undefined ? 65 : o.event, weight: 0.05 },
    },
  } as unknown as InfoEdgeResult;
}

const mean = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

test('the input-sign table drives both scores — every admitted row enters by name with its sign, nothing else does', () => {
  const b = buyerScore(volEdgeFx(), qualityFx(), regimeFx(), infoEdgeFx());
  assert.equal(b.model, 'buyer');
  const admitted = buyerAdmittedInputs();
  assert.equal(b.buyer_components?.components.length, admitted.length);
  for (const row of admitted) {
    const c: BuyerComponent | undefined = b.buyer_components!.components.find((x) => x.gate === row.gate && x.input === row.input);
    assert.ok(c, `${row.gate}.${row.input} entered the buy score`);
    assert.equal(c.sign, row.buyer);
    if (row.buyer === '-' && c.seller_oriented !== null) assert.equal(c.buyer_value, Math.round((100 - c.seller_oriented) * 10) / 10, `${row.input} inverted`);
  }
  // the table's '0' rows never enter
  for (const row of INPUT_SIGNS.filter((r) => r.buyer === '0')) {
    assert.equal(b.buyer_components!.components.some((x) => x.gate === row.gate && x.input === row.input), false, `${row.gate}.${row.input} stays out`);
  }
  // Vol-Edge: vrp 70→30, ivc 62→38, spread +6 → HV over IV 0, ladder falling(80)→20, gex 70→30, volume 62 kept
  assert.equal(b.category_scores.vol_edge, mean([30, 38, 0, 20, 30, 62]));
  // Quality: the six safety components only
  assert.equal(b.category_scores.quality, mean([75, 90, 75, 80, 65, 65]));
  // Regime: the brake's inputs — VVIX dead → VIX/VIX3M alone
  assert.equal(b.category_scores.regime, 58);
  // Info-Edge: activity, buzz, source quality kept; 8-K count inverted
  assert.equal(b.category_scores.info_edge, mean([72, 65, 80, 35]));
  assert.equal(b.gate_weight_trace.weight_mode, 'equal_untuned');
  assert.deepEqual(b.scored_by, ['vol_edge', 'quality', 'regime', 'info_edge']);
  assert.equal(b.score, mean([b.category_scores.vol_edge!, b.category_scores.quality!, b.category_scores.regime!, b.category_scores.info_edge!]));

  // the seller model is today's composite: the four gate scores under the regime weights
  const s = sellerScore(volEdgeFx(), qualityFx(), regimeFx(), infoEdgeFx());
  assert.equal(s.model, 'seller');
  assert.deepEqual(s.category_scores, { vol_edge: 60, quality: 58, regime: 52, info_edge: 45 });
  assert.equal(s.gate_weight_trace.weight_mode, 'dynamic');
  assert.equal(s.buyer_components, null);
  // every seller sign is '+' and no direction-bearing row enters the buy score
  for (const row of INPUT_SIGNS) {
    assert.equal(row.seller, '+');
    if (!row.directionNeutral) assert.equal(row.buyer, '0', `${row.input} is direction-bearing → overlay`);
  }
});

test('an IV>HV symbol passes SELL and is excluded for BUY; HV>IV the reverse — every reason names the side', () => {
  const rich = { ivHvSpread: 6, liquidityRating: 4 };
  const cheap = { ivHvSpread: -7, liquidityRating: 4 };
  assert.equal(stepCReason('SELL', rich), null);
  assert.match(stepCReason('BUY', rich) ?? '', /^BUY: HV not above IV/);
  assert.match(stepCReason('SELL', cheap) ?? '', /^SELL: no vol premium/);
  assert.equal(stepCReason('BUY', cheap), null);
  assert.equal(sideOf(rich).side, 'SELL');
  assert.equal(sideOf(cheap).side, 'BUY');
  // the margin: −0.5 is not HV above IV by ≥ 1 pt — neither side
  const flat = sideOf({ ivHvSpread: -0.5, liquidityRating: 4 });
  assert.equal(flat.side, null);
  assert.match(flat.reasons.SELL ?? '', /^SELL:/);
  assert.match(flat.reasons.BUY ?? '', new RegExp(`≥ ${BUY_PREFILTER_HV_OVER_IV_MIN_PTS.toFixed(1)} pts`));
  assert.match(stepCReason('BUY', { ivHvSpread: -7, liquidityRating: 1 }) ?? '', /^BUY: low liquidity/);
  // the pre-filter ranks by the side's own pre-score
  const tt = (symbol: string, spread: number): TTScannerData => ({ symbol, ivRank: spread > 0 ? 0.7 : 0.2, ivPercentile: 0.5, impliedVolatility: 0.3, liquidityRating: 4, earningsDate: null, daysTillEarnings: null, hv30: 22, hv60: 24, hv90: 25, iv30: 28, ivHvSpread: spread, beta: 1, corrSpy: 0.7, marketCap: 5e10, sector: null, industry: null, peRatio: null, eps: null, dividendYield: null, lendability: null, borrowRate: null, earningsActualEps: null, earningsEstimate: null, earningsTimeOfDay: null, termStructure: [] });
  const sell = computePreFilter([tt('RICH', 6), tt('CHEAP', -7)], 'SELL');
  const buy = computePreFilter([tt('RICH', 6), tt('CHEAP', -7)], 'BUY');
  assert.equal(sell[0].symbol, 'RICH');
  assert.equal(buy[0].symbol, 'CHEAP');
});

// ── a synthetic chain for the builder (Black-Scholes, spot 100, σ 0.28) ─────
function ncdf(x: number): number { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
function chain(spot = 100, dte = 35, sigma = 0.28): StrikeData[] {
  const T = dte / 365; const r = 0.04; const out: StrikeData[] = [];
  for (let k = 80; k <= 120; k += 2.5) {
    const d1 = (Math.log(spot / k) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T)); const d2 = d1 - sigma * Math.sqrt(T);
    const pdf = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
    const call = Math.max(0.05, spot * ncdf(d1) - k * Math.exp(-r * T) * ncdf(d2));
    const put = Math.max(0.05, k * Math.exp(-r * T) * ncdf(-d2) - spot * ncdf(-d1));
    const gamma = pdf / (spot * sigma * Math.sqrt(T)); const theta = -(spot * pdf * sigma) / (2 * Math.sqrt(T)) / 365; const vega = spot * pdf * Math.sqrt(T) / 100;
    out.push({ strike: k, callBid: call - 0.05, callAsk: call + 0.05, putBid: put - 0.05, putAsk: put + 0.05, callDelta: ncdf(d1), putDelta: ncdf(d1) - 1, callTheta: theta, putTheta: theta, callGamma: gamma, putGamma: gamma, callVega: vega, putVega: vega, callIv: sigma, putIv: sigma, callVolume: 400, putVolume: 400, callOI: 1500, putOI: 1500, callTheoPrice: call, putTheoPrice: put, priceSource: 'live', callWideSpread: false, putWideSpread: false });
  }
  return out;
}
const SCAN = '2026-09-15';
const EXP = '2026-10-20'; // 35 DTE
const quiet = <T,>(fn: () => T): T => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };
function build(o: { side: 'SELL' | 'BUY'; ivRank?: number; spread?: number | null; earnings?: string[]; tt?: string | null; direction?: string; capAllowed?: boolean; capOpen?: number | null; hv30?: number }) {
  return quiet(() => generateStrategies({
    strikes: chain(), currentPrice: 100, ivRank: o.ivRank ?? 0.6, expiration: EXP, dte: 35, symbol: 'FX',
    iv30: 0.28, hv30: o.hv30 ?? 0.22, dividendYield: 0, hv10: 0.2, riskFreeRate: 0.04,
    side: o.side, direction: o.direction ?? 'NEUTRAL', scanDate: SCAN,
    earningsDates: earningsDateSources(o.earnings ?? [], o.tt ?? null),
    ivHvSpread: o.spread === undefined ? (o.side === 'SELL' ? 6 : -7) : o.spread,
    undefinedRisk: checkUndefinedRiskCap(o.capAllowed ?? false, o.capOpen === undefined ? 0 : o.capOpen),
  }));
}

test('the earnings catalyst admits a BUY inside the window and rejects one outside; HV well above IV is the other catalyst', () => {
  // inside: earnings 2026-10-02 ∈ [2026-09-15, 2026-10-20]; spread −2 (past the pre-filter margin, below the catalyst threshold)
  const inside = build({ side: 'BUY', spread: -2, earnings: ['2026-10-02'] });
  assert.ok(inside.strategies.length > 0, 'a BUY candidate exists with the earnings catalyst');
  // Gate A (model EV > 0) is not the existence test on the buy side — the catalyst is; the exemption is declared
  assert.match(inside.rejections.map((r) => r.reason).join('\n'), /Gate A \(model EV > 0\) is not an existence test on the buy side/);
  for (const c of inside.strategies) {
    assert.equal(c.side, 'BUY');
    assert.equal(c.catalysts.length, 1);
    assert.equal(c.catalysts[0].kind, 'earnings_in_window');
    assert.equal(c.catalysts[0].source, 'Finnhub calendar/earnings');
    assert.equal(c.earningsWindow.state, 'inside');
    assert.equal(c.netDebit !== null && c.netDebit > 0, true, `${c.name} is a debit structure`);
  }
  // outside: earnings 2026-12-04, spread −2 → no catalyst → not built, reason says so
  const outside = build({ side: 'BUY', spread: -2, earnings: ['2026-12-04'] });
  assert.equal(outside.strategies.length, 0);
  assert.match(outside.rejections.map((r) => r.reason).join('\n'), /BUY: no catalyst — no earnings date inside \[2026-09-15, 2026-10-20\].*HV over IV by 2\.0 pts < 5\.0 threshold/);
  // outside, but HV over IV by 7 ≥ 5 → the Goyal-Saretto catalyst holds
  const hv = build({ side: 'BUY', spread: -7, earnings: ['2026-12-04'] });
  assert.ok(hv.strategies.length > 0);
  assert.deepEqual(hv.strategies.map((c) => c.catalysts[0].kind), hv.strategies.map(() => 'hv_over_iv'));
  assert.match(hv.strategies[0].catalysts[0].detail, new RegExp(`≥ ${BUY_CATALYST_HV_OVER_IV_PTS.toFixed(1)}`));
  // the window is the structure's: the same dates against a farther expiration
  const w = earningsWindow(earningsDateSources(['2026-10-02'], null), SCAN, '2026-09-30');
  assert.equal(w.state, 'outside');
  assert.equal(buyCatalysts({ ivHvSpread: -2, window: w }).length, 0);
  // no date from either source → unknown, never silent
  assert.equal(earningsWindow([], SCAN, EXP).state, 'unknown');
  // the overlay picks the debit spread: BULLISH builds it, NEUTRAL does not and says why
  const bull = build({ side: 'BUY', spread: -7, direction: 'BULLISH' });
  assert.ok(bull.strategies.some((c) => c.name === 'Debit Spread'));
  assert.equal(inside.strategies.some((c) => c.name === 'Debit Spread'), false);
  assert.match(inside.rejections.map((r) => r.reason).join('\n'), /directional overlay is NEUTRAL/);
  const bear = build({ side: 'BUY', spread: -7, direction: 'BEARISH' });
  assert.match(bear.rejections.map((r) => r.reason).join('\n'), /no bear put debit-spread builder exists/);
});

test('the seller earnings hazard flags, never excludes — and a side builds only its own structures', () => {
  const sell = build({ side: 'SELL', earnings: ['2026-10-02'], tt: '2026-10-02' });
  assert.ok(sell.strategies.length > 0, 'the seller structures are built with earnings inside the window');
  for (const c of sell.strategies) {
    assert.equal(c.side, 'SELL');
    assert.equal(c.earningsWindow.state, 'inside');
    assert.deepEqual(c.catalysts, []);
    assert.match(sellerEarningsHazard(c.earningsWindow, c.dte) ?? '', /^EARNINGS INSIDE WINDOW — 2026-10-02 \(Finnhub calendar\/earnings\), trade expires in 35 DTE/);
    assert.equal(c.netCredit !== null && c.netCredit > 0, true, `${c.name} is a credit structure`);
  }
  assert.equal(sellerEarningsHazard({ state: 'outside', detail: '', date: null, source: null }, 35), null);
  // the NORMAL tier no longer builds the bull call spread on the SELL side — declared
  const normal = build({ side: 'SELL', ivRank: 0.35 });
  assert.equal(normal.strategies.some((c) => c.name === 'Bull Call Spread'), false);
  assert.match(normal.rejections.map((r) => r.reason).join('\n'), /bull call spread is a debit structure — built on the BUY side only/);
  const low = build({ side: 'SELL', ivRank: 0.1 });
  assert.equal(low.strategies.length, 0);
  assert.match(low.rejections.map((r) => r.reason).join('\n'), /SELL side: IV rank 10\.0 < 20/);
});

test('the cap blocks a second undefined-risk build; the filter alone is not enough; the candidate says so', () => {
  assert.equal(UNDEFINED_RISK_OPEN_POSITION_CAP, 1);
  assert.equal(checkUndefinedRiskCap(false, 0).allowed, false);
  assert.match(checkUndefinedRiskCap(false, 0).reason, /Risk = Defined/);
  assert.equal(checkUndefinedRiskCap(true, null).allowed, false);
  assert.equal(checkUndefinedRiskCap(true, 0).allowed, true);
  assert.equal(checkUndefinedRiskCap(true, 1).allowed, false);
  assert.match(checkUndefinedRiskCap(true, 1).reason, /1 open undefined-risk position\(s\) ≥ cap 1/);
  // a naked short counts; a short covered by a same-symbol/type/expiry long does not
  const exp = new Date('2026-10-16T00:00:00Z');
  assert.equal(countUndefinedRiskPositions([
    { symbol: 'AAPL', option_type: 'put', expiration_date: exp, position_type: 'SHORT', status: 'OPEN' },
    { symbol: 'MSFT', option_type: 'call', expiration_date: exp, position_type: 'SHORT', status: 'OPEN' },
    { symbol: 'MSFT', option_type: 'call', expiration_date: exp, position_type: 'LONG', status: 'OPEN' },
    { symbol: 'XOM', option_type: 'put', expiration_date: exp, position_type: 'SHORT', status: 'CLOSED' },
    { symbol: 'JPM', option_type: null, expiration_date: null, position_type: 'SHORT', status: 'OPEN' },
  ]), 1);
  // the builder: HIGH IV, SELL — a strangle only when the filter says Unlimited AND the cap has room
  // (hv30 0.12: a calm underlying so the strangle's HV-priced EV clears Gate A — the test is the cap, not the EV gate)
  const blocked = build({ side: 'SELL', capAllowed: true, capOpen: 1, hv30: 0.12 });
  assert.equal(blocked.strategies.some((c) => c.name === 'Short Strangle'), false);
  assert.ok(blocked.strategies.some((c) => c.name === 'Iron Condor' || c.name === 'Put Credit Spread'), 'the defined-risk structures still build');
  assert.match(blocked.rejections.find((r) => r.strategy === 'Short Strangle')?.reason ?? '', /≥ cap 1/);
  const defined = build({ side: 'SELL', capAllowed: false, capOpen: 0, hv30: 0.12 });
  assert.match(defined.rejections.find((r) => r.strategy === 'Short Strangle')?.reason ?? '', /Risk = Defined/);
  const allowed = build({ side: 'SELL', capAllowed: true, capOpen: 0, hv30: 0.12 });
  const ss = allowed.strategies.find((c) => c.name === 'Short Strangle');
  assert.ok(ss, 'the strangle builds with the filter and the cap');
  assert.equal(ss.isUnlimited, true);
  assert.match(ss.undefinedRiskCap ?? '', /allowed — filter Risk = Unlimited and 0 open/);
  assert.equal(allowed.strategies.find((c) => c.name === 'Iron Condor')?.undefinedRiskCap, null);
});

// ── an ETF-shaped input: no fundamentals, no analyst/insider/news, macro present ──
const FRED: FredMacroData = {
  vix: 18, treasury10y: 4.1, fedFunds: 4.3, unemployment: 4.2, cpi: 2.9, gdp: 2.4, consumerConfidence: 70, nonfarmPayrolls: 150, cpiMom: 0.2,
  yieldCurveSpread: 0.3, breakeven5y: 2.3, hySpread: 3.4, nfci: -0.4, initialClaims: 230, initialClaimsDate: '2026-09-10', nfciDate: '2026-09-11',
  vxvShortTerm: 20, vvix: null, fedBalanceSheet: null, treasuryGeneralAccount: null, overnightReverseRepo: null, bbbSpread: null, t10y3m: null, dollarIndex: null,
};
function etfInput(symbol: string, spread: number): ConvergenceInput {
  return {
    symbol,
    ttScanner: { symbol, ivRank: 0.3, ivPercentile: 0.35, impliedVolatility: 0.18, liquidityRating: null, earningsDate: null, daysTillEarnings: null, hv30: 18 - spread, hv60: 17, hv90: 16, iv30: 18, ivHvSpread: spread, beta: null, corrSpy: 1, marketCap: null, sector: null, industry: null, peRatio: null, eps: null, dividendYield: 1.3, lendability: null, borrowRate: null, earningsActualEps: null, earningsEstimate: null, earningsTimeOfDay: null, termStructure: [{ date: '2026-10-16', iv: 0.18 }, { date: '2026-11-20', iv: 0.19 }] },
    candles: [],
    finnhubFundamentals: null, finnhubRecommendations: [], finnhubInsiderSentiment: [], finnhubEarnings: [], finnhubEstimates: null,
    fredMacro: FRED, annualFinancials: null, quarterlyFinancials: null, optionsFlow: null, newsSentiment: null, finnhubNewsSentiment: null,
    finnhubEarningsQuality: null, finnhubInstitutionalOwnership: null, finnhubRevenueBreakdown: null, secFilingData: null, secForm4Data: null,
    finnhubFundOwnership: null, edgar8kScan: null, crossAssetCorrelations: null,
  };
}

test('SPY scores on Vol-Edge + Regime with Quality and Info-Edge null — and the card says which gates scored it, on both models', () => {
  const sell = scoreAll(etfInput('SPY', 2), 'SELL');
  assert.equal(sell.quality.score, null);
  assert.equal(sell.info_edge.score, null);
  assert.deepEqual(sell.composite.scored_by, ['vol_edge', 'regime']);
  assert.deepEqual(sell.composite.excluded_gates, ['quality', 'info_edge']);
  assert.equal(sell.composite.score_model, 'seller');
  assert.equal(sell.composite.model_era, 'E9');
  assert.ok(sell.composite.score !== null);
  assert.match(sell.composite.direction, /^UNKNOWN/);
  const buy = scoreAll(etfInput('SPY', -6), 'BUY');
  assert.equal(buy.composite.score_model, 'buyer');
  assert.deepEqual(buy.composite.scored_by, ['vol_edge', 'regime']);
  assert.ok(buy.composite.buyer_components);
  assert.equal(buy.composite.buyer_components.gates.quality.score, null);
  assert.equal(buy.composite.buyer_components.gates.info_edge.score, null);
  assert.equal(buy.composite.category_scores.quality, null);
  // the card
  const cards = quiet(() => generateTradeCards(build({ side: 'SELL' }).strategies, sell, etfInput('SPY', 2)));
  assert.ok(cards.length > 0);
  assert.deepEqual(cards[0].why.scored_by, ['vol_edge', 'regime']);
  assert.equal(cards[0].why.score_model, 'seller');
  assert.equal(cards[0].why.model_era, 'E9');
  assert.equal(cards[0].why.side, 'SELL');
  assert.deepEqual(cards[0].why.catalysts, []);
  assert.equal(cards[0].why.earnings_window.state, 'unknown');
  assert.ok(cards[0].why.risk_flags.some((f) => f.startsWith('EARNINGS DATE UNKNOWN')));
  // a BUY card carries its catalyst and the seller hazard line is a SELL flag
  const buyCards = quiet(() => generateTradeCards(build({ side: 'BUY', spread: -6, earnings: ['2026-10-02'] }).strategies, buy, etfInput('SPY', -6)));
  assert.ok(buyCards.length > 0);
  assert.equal(buyCards[0].why.side, 'BUY');
  assert.equal(buyCards[0].why.score_model, 'buyer');
  assert.ok(buyCards[0].why.catalysts.length >= 1);
  assert.equal(buyCards[0].why.risk_flags.some((f) => f.startsWith('EARNINGS INSIDE WINDOW')), false);
  const sellInside = quiet(() => generateTradeCards(build({ side: 'SELL', earnings: ['2026-10-02'] }).strategies, sell, etfInput('SPY', 2)));
  assert.ok(sellInside[0].why.risk_flags.some((f) => f.startsWith('EARNINGS INSIDE WINDOW')));
  // a card built on one side and scored on the other's model is refused
  assert.throws(() => quiet(() => generateTradeCards(build({ side: 'BUY', spread: -6 }).strategies, sell, etfInput('SPY', -6))), /built on the BUY side but scored by the seller model/);
});

test('the gate cards — one per gate per side, every field said; README renders byte-stable', () => {
  assert.equal(GATE_CARDS.length, 8);
  for (const c of GATE_CARDS) for (const k of ['purpose', 'inputs', 'weight', 'evidence', 'isNot'] as const) assert.ok(c[k].length > 20, `${c.gate}/${c.model} ${k}`);
  assert.equal(gateCardsMarkdown(), gateCardsMarkdown());
  assert.match(gateCardsMarkdown(), /\| Regime \| SELL \(seller model\) \|.*VVIX leg has been dead since 2026-07-08/);
});
