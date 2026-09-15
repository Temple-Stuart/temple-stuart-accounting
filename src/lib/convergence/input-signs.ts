/**
 * MODEL-01 — THE INPUT-SIGN TABLE (STEP 0.1, the table that decides).
 *
 * WHY: the composite scored both premium directions with one seller-shaped
 * score — high IV rank + IV above HV + high PoP = "good" — which inverts for
 * a buyer of premium. The research rules SEPARATE models per side, never a
 * sign flip in place. This table is the ruling's 0.1 audit made executable:
 * every input of the four gates, its weight in today's composite (cited), the
 * direction of its effect for the SELLER (today's composite, unchanged) and
 * for the BUYER, and whether it is direction-neutral.
 *
 *   seller  '+'  higher component score = better for a seller of premium
 *                (today's composite reads every input this way — that is the
 *                defect the table names, not a claim that it is right)
 *   buyer   '+'  enters the buy score as is
 *           '-'  enters the buy score INVERTED (100 − score)
 *           '0'  does NOT enter the buy score: either direction-bearing (it
 *                feeds the directional overlay — bull/bear debit spreads — via
 *                composite.direction, not the buy score) or seller-shaped with
 *                no cited buyer thesis (declared, awaiting MODEL-02 / EDGE-01's
 *                third book)
 *   directionNeutral  true = the input says nothing about up or down
 *
 * No input's meaning is changed by a sign flip in place: composite.ts
 * buyerScore() looks every component up HERE and applies the sign the row
 * states; a component the table does not admit cannot enter the buy score.
 * Weights in the buy score are EQUAL and UNTUNED (set 2026-09-15) — there are
 * zero graded outcomes under any current model (EDGE-01), so nothing may be
 * tuned on outcomes; they await EDGE-01's third book (LOG-01 scan_candidates).
 *
 * Citations are file:line on main at 2f3562c9 (LOG-01 merge, 2026-09-15).
 */

export type Sign = '+' | '-' | '0';

export interface InputSign {
  gate: 'vol_edge' | 'quality' | 'regime' | 'info_edge';
  section: string;
  /** The component key as the gate's trace names it. */
  input: string;
  /** Weight in today's seller composite, as cited. */
  sellerWeight: string;
  seller: Sign;
  buyer: Sign;
  directionNeutral: boolean;
  why: string;
}

/** The day the buyer table's equal weights were set. Untuned: awaiting EDGE-01's third book. */
export const MODEL_WEIGHTS_SET_ON = '2026-09-15';

export const INPUT_SIGNS: readonly InputSign[] = [
  // ── Vol-Edge (vol-edge.ts) ────────────────────────────────────────────
  { gate: 'vol_edge', section: 'mispricing', input: 'vrp', sellerWeight: '0.40 × 0.30 (vol-edge.ts:379, :1182)', seller: '+', buyer: '-', directionNeutral: true,
    why: 'percentile of IV30 − HV30 vs the ticker\'s own history (vol-edge.ts:239-264): a rich premium is the seller\'s edge; a cheap one (HV above IV) is the buyer\'s — Goyal & Saretto 2009' },
  { gate: 'vol_edge', section: 'mispricing', input: 'iv_composite', sellerWeight: '0.40 × 0.30 (vol-edge.ts:380; 0.60 IVP + 0.40 IVR :365-366)', seller: '+', buyer: '-', directionNeutral: true,
    why: 'IV percentile / IV rank level (vol-edge.ts:269-273): high = options expensive = seller; low = cheap = buyer' },
  { gate: 'vol_edge', section: 'mispricing', input: 'iv_hv_spread', sellerWeight: '0.40 × 0.25 (vol-edge.ts:381)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'seller: |spread|/20 in raw mode (vol-edge.ts:283 — direction-blind) or the signed peer rank (:337); buyer: the magnitude of HV OVER IV from the raw spread (same iv_hv_spread, opposite sign, composite.ts buyerScore) — the sign inconsistency between the seller\'s two modes is reported, not touched' },
  { gate: 'vol_edge', section: 'mispricing', input: 'hv_accel', sellerWeight: '0.40 × 0.15 (vol-edge.ts:382)', seller: '+', buyer: '-', directionNeutral: true,
    why: 'raw ladder: falling HV30<HV60<HV90 = 80 "bullish for premium selling", rising = 20 (vol-edge.ts:289-305); the buyer wants realized vol rising — inverted from the raw ladder over HV_30/60/90. The peer path ranks hv30−hv60 ascending (:339-341), the reverse sign of the ladder — reported, untouched for the seller' },
  { gate: 'vol_edge', section: 'mispricing', input: 'high_conviction_bonus', sellerWeight: '+5 when IVP & IVR > 50 (vol-edge.ts:389-393)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'a bonus for HIGH IV agreement — seller-shaped; the buyer recomposes from components, so the bonus never enters the buy score' },
  { gate: 'vol_edge', section: 'term_structure', input: 'term_structure', sellerWeight: '0.25 (vol-edge.ts:1183)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'contango scores 85, backwardation 20 (vol-edge.ts:531-546, "theta works best in contango" composite.ts:362-366) citing Vasquez 2017 — whose result is that BUYING high-slope (contango) straddles earns positive returns, the reverse of the coded seller sign. Two authorities disagree: excluded from the buy score, not inverted by accident; MODEL-02 owns term structure' },
  { gate: 'vol_edge', section: 'technicals', input: 'rsi', sellerWeight: '0.15 × 0.25 (vol-edge.ts:755)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'asymmetric premium-opportunity mapping (oversold 90, overbought 70, neutral 55 — vol-edge.ts:667-681): encodes IV richness for a seller; no cited buyer thesis — excluded' },
  { gate: 'vol_edge', section: 'technicals', input: 'trend', sellerWeight: '0.15 × 0.25 (vol-edge.ts:756)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'uptrend 70 / downtrend 30 (vol-edge.ts:688-704) — direction-bearing; feeds the directional overlay, not the buy score' },
  { gate: 'vol_edge', section: 'technicals', input: 'bollinger', sellerWeight: '0.15 × 0.20 (vol-edge.ts:757)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'price at the band centre = 100, at the bands = 0 ("for neutral strategies" vol-edge.ts:708-714) — a short-strangle shape; no cited buyer thesis — excluded' },
  { gate: 'vol_edge', section: 'technicals', input: 'volume', sellerWeight: '0.15 × 0.15 (vol-edge.ts:758)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'elevated volume = more liquid (vol-edge.ts:727-733): tradability, good for both sides' },
  { gate: 'vol_edge', section: 'technicals', input: 'high52w', sellerWeight: '0.15 × 0.15 (vol-edge.ts:759)', seller: '+', buyer: '0', directionNeutral: false,
    why: '52-week-high ratio, George & Hwang 2004 momentum (vol-edge.ts:735-753) — direction-bearing; overlay, not the buy score' },
  { gate: 'vol_edge', section: 'skew', input: 'skew', sellerWeight: '0.10 (vol-edge.ts:1184)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'Cremers & Weinbaum 2010: put-call parity deviations predict stock returns; bullish skew high, bearish low (vol-edge.ts:920-940) — direction-bearing; overlay' },
  { gate: 'vol_edge', section: 'gex', input: 'gex', sellerWeight: '0.10 (vol-edge.ts:1185)', seller: '+', buyer: '-', directionNeutral: true,
    why: 'positive dealer gamma suppresses realized vol (good for a seller), negative amplifies it (vol-edge.ts:1130-1140) — the buyer of vol wants amplification: inverted' },

  // ── Quality (quality-gate.ts) ─────────────────────────────────────────
  { gate: 'quality', section: 'safety', input: 'liquidity_rating', sellerWeight: '0.40 × 0.25 (quality-gate.ts:377)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'TastyTrade liquidity rating (quality-gate.ts:42-47): tradability — a debit buyer pays the spread too' },
  { gate: 'quality', section: 'safety', input: 'market_cap', sellerWeight: '0.40 × 0.15 (quality-gate.ts:378)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'size tiers (quality-gate.ts:50-58): liquidity/size, direction-neutral' },
  { gate: 'quality', section: 'safety', input: 'volume', sellerWeight: '0.40 × 0.15 (quality-gate.ts:379)', seller: '+', buyer: '+', directionNeutral: true,
    why: '20-day average share volume tiers (quality-gate.ts:61-71): liquidity, both sides' },
  { gate: 'quality', section: 'safety', input: 'lendability', sellerWeight: '0.40 × 0.10 (quality-gate.ts:380)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'easy-to-borrow 80 / hard 30 (quality-gate.ts:74-86): a borrow-market state, direction-neutral' },
  { gate: 'quality', section: 'safety', input: 'beta', sellerWeight: '0.40 × 0.10 (quality-gate.ts:381)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'low beta scores high (quality-gate.ts:88-97): a market-exposure measure, not a bull/bear call; kept as the safety read for both sides' },
  { gate: 'quality', section: 'safety', input: 'debt_to_equity', sellerWeight: '0.40 × 0.25 (quality-gate.ts:382)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'solvency (quality-gate.ts:99-107): ruin of the underlying is a hazard for every structure the scanner builds on either side' },
  { gate: 'quality', section: 'safety', input: 'altman_cap / borrow_penalty / hhi', sellerWeight: 'cap at 40 if Z<1.8; −min(20, borrow×0.8); ×(1±HHI) (quality-gate.ts:389-431)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'section-level modifiers on the seller\'s safety score; the borrow penalty is by its own comment "premium-selling edge friction" (:397). The buyer takes the six safety components directly, so none of the three modifiers enters the buy score' },
  { gate: 'quality', section: 'profitability', input: 'profitability (9 components + Piotroski change modifier)', sellerWeight: '0.30 (quality-gate.ts:1116; components :779-787; modifier :1103-1110)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'margins, returns, valuation, FCF, earnings quality: the quality factor is a LONG-side return tilt (Asness, Frazzini & Pedersen 2019, QMJ) — direction-bearing for a debit-spread buyer and irrelevant to a straddle\'s vol thesis; overlay' },
  { gate: 'quality', section: 'growth', input: 'growth (revenue / eps / dividend)', sellerWeight: '0.15 (quality-gate.ts:1117; :906-908)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'growth is a level of company health with a bullish tilt, not a vol read — direction-bearing; overlay' },
  { gate: 'quality', section: 'fundamentalRisk', input: 'fundamentalRisk (cash-flow stability / earnings predictability / asset turnover)', sellerWeight: '0.15 (quality-gate.ts:1118; :1054-1056)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'stability is the seller\'s friend; whether unpredictable earnings are a buyer\'s edge is uncited here — excluded rather than inverted on a guess' },
  { gate: 'quality', section: 'gate', input: 'mspr_adjustment', sellerWeight: '±5 on the gate (quality-gate.ts:1135-1149)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'insider sentiment sign — direction-bearing; overlay' },

  // ── Regime (regime.ts) ────────────────────────────────────────────────
  { gate: 'regime', section: 'macro', input: 'growth_signal', sellerWeight: 'via classifyRegime → strategy-regime matrix 0.70 (regime.ts:251-256, :410-470, :837)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'the regime score is the best strategy\'s fit in a matrix tuned for premium sellers (STRATEGY_REGIME_MATRIX: iron condor 85 in goldilocks; VIX>24 adds +10 to short-vol strategies, regime.ts:492-503) — seller-shaped; not inverted, not kept for the buyer' },
  { gate: 'regime', section: 'macro', input: 'inflation_signal', sellerWeight: 'same path (regime.ts:280-284)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'as growth_signal' },
  { gate: 'regime', section: 'macro', input: 'yield_curve / hy_spread / cross_asset', sellerWeight: 'classification modifiers (regime.ts:331-345; ±10% :490, :796-799)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'modifiers on the seller-shaped classification; not in the buy score' },
  { gate: 'regime', section: 'vol_conditioners', input: 'vix_term_structure', sellerWeight: '0.20 of the conditioned base (regime.ts:838)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'VIX/VIX3M: backwardation scores low (regime.ts:86-91) and trips the survival brake at > 1.0 (:100-104). A brake applies to both sides — the buyer keeps its sign' },
  { gate: 'regime', section: 'vol_conditioners', input: 'vvix', sellerWeight: '0.10 of the conditioned base (regime.ts:839)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'elevated VVIX scores low and trips the brake at ≥ 110 (regime.ts:93-97, :104-108); kept for both sides. Dead 2026-07-08 (VVIXCLS is not a FRED series, DATA-01) → restored 2026-09-16 from Cboe\'s VVIX daily file (cboe-daily.ts, MODEL-02)' },
  { gate: 'regime', section: 'gate', input: 'corrSpy multiplier', sellerWeight: '×(0.1 + 0.9·max(0, corrSpy)) (regime.ts:847-852)', seller: '+', buyer: '0', directionNeutral: true,
    why: 'scales the seller-shaped regime score per ticker; the buyer\'s regime read is the two brake inputs only, unscaled' },

  // ── Info-Edge (info-edge.ts) ──────────────────────────────────────────
  { gate: 'info_edge', section: 'analyst_consensus', input: 'estimate_level', sellerWeight: '0.15 × 0.25 (info-edge.ts:155)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'forward vs trailing EPS growth (info-edge.ts:79-88) — bullish high; overlay' },
  { gate: 'info_edge', section: 'analyst_consensus', input: 'estimate_dispersion', sellerWeight: '0.15 × 0.25 (info-edge.ts:156)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'coded per Diether, Malloy & Scherbina 2002 (high disagreement → low RETURNS, info-edge.ts:91-102): direction-bearing as coded; overlay. Dispersion as an uncertainty (vol) signal is a MODEL-02 question, not assumed here' },
  { gate: 'info_edge', section: 'analyst_consensus', input: 'revenue_eps_alignment', sellerWeight: '0.15 × 0.15 (info-edge.ts:157)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'both up 80 / both down 30 (info-edge.ts:108-125) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'analyst_consensus', input: 'consensus_breadth', sellerWeight: '0.15 × 0.35 (info-edge.ts:158)', seller: '+', buyer: '0', directionNeutral: false,
    why: '60% buy-ratio + 40% coverage (info-edge.ts:129-147): the buy ratio is direction-bearing and the blend cannot be split on the trace; overlay' },
  { gate: 'info_edge', section: 'price_target_signal', input: 'price_target', sellerWeight: '0.10 (info-edge.ts:320)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'implied return to the median target (Da & Schaumburg 2011, info-edge.ts:222-350) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'upgrade_downgrade_signal', input: 'upgrade_downgrade', sellerWeight: '0.10 (info-edge.ts:442)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'Womack 1996 asymmetric rating momentum (info-edge.ts:365-465) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'insider_activity', input: 'insider (MSPR / Form 4 flow / opportunistic)', sellerWeight: '0.15 (info-edge.ts:588; 0.40/0.30/0.30 :574-576)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'net insider buying scores high (info-edge.ts:496-501, :555-565) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'earnings_momentum', input: 'earnings_momentum (streak / magnitude / consistency)', sellerWeight: '0.20 (info-edge.ts:712; 0.40/0.35/0.25 :700-702)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'beats score high, misses low (info-edge.ts:653-697) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'flow_signal', input: 'put_call_ratio', sellerWeight: '0.05 × 0.25–0.30 (info-edge.ts:827)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'low PCR bullish (info-edge.ts:744-752) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'flow_signal', input: 'volume_bias', sellerWeight: '0.05 × 0.25–0.35 (info-edge.ts:828)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'call-vs-put volume bias (info-edge.ts:755-762) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'flow_signal', input: 'unusual_activity', sellerWeight: '0.05 × 0.25–0.35 (info-edge.ts:829)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'option volume / open interest (info-edge.ts:764-773): activity level with no sign — kept for both' },
  { gate: 'info_edge', section: 'flow_signal', input: 'option_stock_ratio', sellerWeight: '0.05 × 0.25 (info-edge.ts:830)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'Johnson & So 2012: low O/S bullish (info-edge.ts:775-783) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'news_sentiment', input: 'buzz', sellerWeight: '0.15 × 0.30 (info-edge.ts:912-925)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'article count vs its 8–30d baseline: attention level, no sign — kept for both' },
  { gate: 'info_edge', section: 'news_sentiment', input: 'sentiment', sellerWeight: '0.15 × 0.40 (info-edge.ts:928-937)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'keyword + FinBERT tone (info-edge.ts:955-998) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'news_sentiment', input: 'source_quality', sellerWeight: '0.15 × 0.30 (info-edge.ts:940-946)', seller: '+', buyer: '+', directionNeutral: true,
    why: 'tier-1 share of coverage: quality of evidence, no sign — kept for both' },
  { gate: 'info_edge', section: 'institutional_ownership', input: 'institutional_ownership', sellerWeight: '0.05 (info-edge.ts:1248)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'net-buyer ratio (Chen, Jegadeesh & Wermers 2000, info-edge.ts:1190-1290) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'fund_ownership_flow', input: 'fund_ownership_flow', sellerWeight: '0.05 (info-edge.ts:1385-1398)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'funds buying 75 / selling 25 — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'material_event_flag', input: 'material_event', sellerWeight: '0.05 (info-edge.ts:1400-1422)', seller: '+', buyer: '-', directionNeutral: true,
    why: 'zero 8-Ks score 65, many score 20 ("material event risk", info-edge.ts:1417-1421): fewer events = a calmer underlying for the seller; more events = more catalysts for a buyer of movement — inverted; an 8-K count has no bull/bear sign' },
  { gate: 'info_edge', section: 'recommendation_revision', input: 'recommendation_revision', sellerWeight: '0.05 (info-edge.ts:1293-1367)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'month-over-month consensus change (Chan, Jegadeesh & Lakonishok 1996) — direction-bearing; overlay' },
  { gate: 'info_edge', section: 'overlay', input: 'filing_recency', sellerWeight: '+8 / −12 on the gate (info-edge.ts:1070-1188, :1460-1463)', seller: '+', buyer: '0', directionNeutral: false,
    why: 'signed earnings-surprise overlay within 72h of a filing — direction-bearing; overlay' },
];

/** The rows that enter the buy score, in table order (sign '+' or '-'). */
export function buyerAdmittedInputs(): readonly InputSign[] {
  return INPUT_SIGNS.filter((r) => r.buyer !== '0');
}

export function signFor(gate: InputSign['gate'], input: string): InputSign {
  const row = INPUT_SIGNS.find((r) => r.gate === gate && r.input === input);
  if (!row) throw new Error(`MODEL-01: ${gate}.${input} is not in the input-sign table — a component the table does not name cannot enter a score`);
  return row;
}

/** Apply a row's buyer sign to a seller-oriented component score (0–100). */
export function applyBuyerSign(row: InputSign, sellerOriented: number | null): number | null {
  if (sellerOriented === null) return null;
  if (row.buyer === '+') return sellerOriented;
  if (row.buyer === '-') return Math.round((100 - sellerOriented) * 10) / 10;
  return null; // '0' — not admitted
}
