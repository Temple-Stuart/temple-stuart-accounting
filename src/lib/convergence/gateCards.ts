/**
 * MODEL-01 STEP 6 — THE GATE CARDS: one entry per gate per side.
 *
 * Each card says, in the customer's language, what the gate is FOR, what it
 * reads and from where, what it weighs and when that was set, the evidence
 * it rests on, and what it is NOT. The gate tooltips (metricExplainers.ts)
 * render from these cards and README's "The scanner's gates" section is
 * generated from them byte-for-byte (scripts/regen-gate-cards-readme.ts; the
 * build asserts the block matches). Weights are cited to the code and dated;
 * none is tuned on an outcome — there are no graded outcomes under any
 * current model (EDGE-01).
 */
import type { GateKey, PremiumSide, ScoreModel } from './types';
import { MODEL_WEIGHTS_SET_ON } from './input-signs';

export interface GateCard {
  gate: GateKey;
  side: PremiumSide;
  model: ScoreModel;
  title: string;
  /** One sentence: what the gate is for, on this side. */
  purpose: string;
  /** Inputs and their sources. */
  inputs: string;
  /** Weight and the date it was set. */
  weight: string;
  /** The evidence citation. */
  evidence: string;
  /** What it is NOT. */
  isNot: string;
}

const GATE_TITLES: Record<GateKey, string> = {
  vol_edge: 'Vol Edge',
  quality: 'Quality',
  regime: 'Regime',
  info_edge: 'Info Edge',
};

export const GATE_CARDS: readonly GateCard[] = [
  {
    gate: 'vol_edge', side: 'SELL', model: 'seller', title: GATE_TITLES.vol_edge,
    purpose: 'Are these options priced above what the stock actually moves — is there a premium to sell?',
    inputs: 'Mispricing 0.40 (VRP own-history percentile 0.30; IV percentile/rank level 0.30; |IV − HV| 0.25; HV30/60/90 trend 0.15 — TastyTrade market-metrics and the ticker\'s own scan_snapshots history); term structure 0.25 (TastyTrade expiration IVs); technicals 0.15 (TastyTrade candles, Finnhub 52-week range); skew 0.10 and dealer gamma 0.10 (Finnhub option chain, FRED DGS10).',
    weight: '0.25 static, blended toward the regime table (0.15–0.30) by regime confidence — set at #1082 (2026-06-20); untuned on any outcome.',
    evidence: 'Goyal & Saretto 2009 and Carr & Wu 2009 (the variance risk premium); Vasquez 2017 (term structure — the code cites it with the reverse sign of its result; reported in MODEL-01, not changed); Cremers & Weinbaum 2010 (skew).',
    isNot: 'Not a forecast of realized volatility, and not the buyer\'s read — the same inputs invert for a buyer of premium. The VRP leg is excluded until 20 scan days of own history exist.',
  },
  {
    gate: 'vol_edge', side: 'BUY', model: 'buyer', title: GATE_TITLES.vol_edge,
    purpose: 'Are these options priced below what the stock actually moves — is premium cheap enough to own?',
    inputs: 'Six admitted components at equal weight: VRP percentile (inverted), IV percentile/rank level (inverted), HV over IV from the raw spread, the HV30/60/90 ladder (inverted — rising realized vol), dealer gamma (inverted), volume ratio (kept) — TastyTrade market-metrics and candles, Finnhub chain, FRED DGS10.',
    weight: `0.25 of the buy score, equal and untuned, set ${MODEL_WEIGHTS_SET_ON} — awaiting EDGE-01's third book (LOG-01 scan_candidates, the BUY bucket).`,
    evidence: 'Goyal & Saretto 2009 (HV above IV predicts positive straddle returns); Coval & Shumway 2001 (unconditional long vol loses — hence the catalyst gate on this side).',
    isNot: 'Not a sign flip of the seller\'s number: term structure, RSI, Bollinger position, trend, the 52-week high and skew do NOT enter — input-signs.ts says why for each; MODEL-02 owns term structure and the SKEW index.',
  },
  {
    gate: 'quality', side: 'SELL', model: 'seller', title: GATE_TITLES.quality,
    purpose: 'Is the underlying a company that will not blow up under a short-premium structure?',
    inputs: 'Safety 0.40 (liquidity rating, size, share volume, lendability, beta, debt-to-equity; the Altman cap, the borrow-rate penalty and the revenue-concentration modifier), profitability 0.30 (margins, returns, valuation, free cash flow, earnings quality, plus the Piotroski change modifier), growth 0.15, fundamental risk 0.15; ±5 for insider MSPR — Finnhub fundamentals and financials, TastyTrade, SEC EDGAR.',
    weight: '0.25 static → 0.20–0.40 by regime — set at #1082 (2026-06-20); untuned on any outcome.',
    evidence: 'Piotroski 2000; Altman 1968; Christoffersen, Goyenko, Jacobs & Karoui 2018 (options illiquidity); Cao & Han 2013 (idiosyncratic vol, not beta).',
    isNot: 'Not a stock-picking score — a quality company can still carry expensive or cheap options. The ranking\'s 40-floor reads this gate; an ETF scores here on safety alone (profitability, growth and risk excluded, weights renormalized).',
  },
  {
    gate: 'quality', side: 'BUY', model: 'buyer', title: GATE_TITLES.quality,
    purpose: 'Can this option be bought and unwound at a fair price, on an underlying that will not vanish?',
    inputs: 'The six safety components only, at equal weight: TastyTrade liquidity rating, market cap, 20-day share volume (candles), lendability, beta, debt-to-equity (Finnhub).',
    weight: `0.25 of the buy score, equal and untuned, set ${MODEL_WEIGHTS_SET_ON}.`,
    evidence: 'Christoffersen, Goyenko, Jacobs & Karoui 2018 (the buyer pays the illiquidity premium too); Altman 1968 (solvency).',
    isNot: 'Not profitability, growth, fundamental risk, the Piotroski change or MSPR — those are a long-side return tilt (Asness, Frazzini & Pedersen 2019) and feed the directional overlay, never the buy score; the borrow penalty and the concentration modifier do not enter.',
  },
  {
    gate: 'regime', side: 'SELL', model: 'seller', title: GATE_TITLES.regime,
    purpose: 'Does the macro and volatility backdrop favor the best premium-selling structure right now?',
    inputs: 'FRED growth (6 series) and inflation (5 series) → regime probabilities with the yield-curve, high-yield-spread and cross-asset modifiers → the best strategy\'s fit in the strategy-regime matrix 0.70, VIX/VIX3M 0.20, VVIX 0.10, then × the ticker\'s SPY correlation (TastyTrade).',
    weight: '0.25 static → 0.20–0.30 by regime — set at #1082 (2026-06-20) and EDGE-6 (2026-07-08); untuned on any outcome.',
    evidence: 'Hamilton 1989 (the regime framework); Bansal & Stivers 2023 (the VIX overlay); CBOE PUT and BXM index history behind the matrix.',
    isNot: 'The VVIX leg has been dead since 2026-07-08 — VVIXCLS is not a FRED series (DATA-01); MODEL-02 restores it from Cboe. The survival brake (VIX/VIX3M > 1 or VVIX ≥ 110) is declared on every card and suppresses short-premium suggestions; it does not move this number.',
  },
  {
    gate: 'regime', side: 'BUY', model: 'buyer', title: GATE_TITLES.regime,
    purpose: 'Is the market in a state where owning volatility is affordable — the same brake, read for the buyer?',
    inputs: 'The survival brake\'s two inputs only, same sign: VIX/VIX3M (FRED VIXCLS ÷ VXVCLS) and VVIX (dead — see the seller card).',
    weight: `0.25 of the buy score, equal and untuned, set ${MODEL_WEIGHTS_SET_ON}.`,
    evidence: 'STRATEGY-EVIDENCE §6 (the anti-wipeout rule — a brake applies to both sides); Park 2015 (the tail-risk premium binds when VVIX is elevated).',
    isNot: 'Not the macro classification, the strategy matrix or the SPY-correlation multiplier — those are seller-shaped and do not enter. Until VVIX returns this gate is VIX/VIX3M alone, or EXCLUDED when that is missing.',
  },
  {
    gate: 'info_edge', side: 'SELL', model: 'seller', title: GATE_TITLES.info_edge,
    purpose: 'Do the informed footprints — insiders, institutions, analysts, the news — lean positive on this name?',
    inputs: 'Analyst consensus 0.15, price target 0.10, upgrades/downgrades 0.10, insiders 0.15, earnings momentum 0.20, options flow 0.05, news 0.15, institutional ownership 0.05, fund flow 0.05, 8-K events 0.05, recommendation revision 0.05 (raw sum 1.10, renormalized over what is present); a filing-recency overlay of +8/−12 — Finnhub, SEC EDGAR.',
    weight: '0.25 static → 0.15–0.30 by regime — set at #1082 (2026-06-20) and EDGE-7b (2026-07-08); untuned on any outcome.',
    evidence: 'Womack 1996; Da & Schaumburg 2011; Seyhun 1986; Bernard & Thomas 1989; Johnson & So 2012; Chen, Jegadeesh & Wermers 2000; Chan, Jegadeesh & Lakonishok 1996.',
    isNot: 'Not direction-neutral — this gate is the directional overlay\'s source (BULLISH above 65, BEARISH below 35), so a seller\'s iron condor is scored by a bull/bear read here; MODEL-01 reports that and leaves the seller\'s composite unchanged.',
  },
  {
    gate: 'info_edge', side: 'BUY', model: 'buyer', title: GATE_TITLES.info_edge,
    purpose: 'Is there attention and activity on this name — reasons the stock may move, without saying which way?',
    inputs: 'Four admitted components at equal weight: unusual option activity (Finnhub chain), news buzz and the tier-1 share of coverage (Finnhub company-news), the 8-K count (SEC EDGAR, inverted — more material events, more catalysts).',
    weight: `0.25 of the buy score, equal and untuned, set ${MODEL_WEIGHTS_SET_ON}.`,
    evidence: 'Gao, Xing & Zhang (straddles bought into the announcement window); the ruling\'s direction-neutral rule — a buyer of a straddle needs movement, not a side.',
    isNot: 'Not sentiment, targets, upgrades, insiders, earnings beats, the put/call ratio, O/S, institutions, fund flows, revisions or the filing overlay — every one is direction-bearing and feeds the overlay (bull call vs bear put debit spread), never this score.',
  },
];

export function gateCard(gate: GateKey, model: ScoreModel): GateCard {
  const card = GATE_CARDS.find((c) => c.gate === gate && c.model === model);
  if (!card) throw new Error(`MODEL-01: no gate card for ${gate} / ${model}`);
  return card;
}

export const README_GATE_CARDS_START = '<!-- gate-cards:start — generated from src/lib/convergence/gateCards.ts by scripts/regen-gate-cards-readme.ts; the build asserts this block byte-for-byte; do not edit by hand -->';
export const README_GATE_CARDS_END = '<!-- gate-cards:end -->';

/** The README block, deterministic — the same input always renders the same bytes. */
export function gateCardsMarkdown(): string {
  const lines: string[] = [];
  lines.push('The scanner scores every candidate on ONE of two models — the seller model (the composite as it was, unchanged) or the buyer model (the recomposition per the input-sign table, `src/lib/convergence/input-signs.ts`) — never both, never a sign flip in place. Each gate has one card per side. PoP and EV on a card are pricing quantities under a lognormal model at scan-time IV, not forecasts; realized frequency is measured in EDGE-01. No weight below is tuned on an outcome: there are none yet.');
  lines.push('');
  lines.push('| Gate | Side | Purpose | Inputs and sources | Weight, date set | Evidence | What it is NOT |');
  lines.push('|---|---|---|---|---|---|---|');
  const cell = (s: string) => s.replace(/\|/g, '\\|');
  for (const c of GATE_CARDS) {
    lines.push(`| ${c.title} | ${c.side} (${c.model} model) | ${cell(c.purpose)} | ${cell(c.inputs)} | ${cell(c.weight)} | ${cell(c.evidence)} | ${cell(c.isNot)} |`);
  }
  return lines.join('\n');
}
