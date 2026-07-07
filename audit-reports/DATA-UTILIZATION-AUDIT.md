# DATA-UTILIZATION-AUDIT — what we fetch, what we score, what's on the shelf

**Date:** 2026-07-07 · **Branch:** `claude/data-utilization-audit` · **Base:** main @ `940185dd` · **READ-ONLY** (no code changed)

Reconnaissance for strategy-research synthesis: every paid external call, whether its output
enters a gate score, and where unused signal could plug in. Every claim cites `file:line`.
The scoring pipeline is `src/lib/convergence/data-fetchers.ts` → `pipeline.ts` (assembles
`ConvergenceInput` at `pipeline.ts:1171`) → `scoreAll` (`composite.ts`). `data-observatory/check`
and `test/convergence` are a **health dashboard** + **single-ticker lookup** — they ping/score
but are not the batch scoring path.

---

## SECTION 1 — What we fetch today (by source)

| source | endpoint (file:line) | signal produced | consumer |
|---|---|---|---|
| **TastyTrade** | market-metrics (`pipeline.ts:277-319`) | IV30, HV30/60/90, IV rank, IV percentile, IV-HV spread, term-structure IVs, beta, corrSpy, mktCap, PE, EPS, divYield, borrowRate, lendability, liquidity, earnings date | vol-edge (IV/HV/term/skew), quality (liq/beta/PE/mktCap/borrow/lend), regime (corrSpy), PoP (divYield) |
| TastyTrade | DXLink daily candles (`data-fetchers.ts:2296`) | OHLCV history | vol-edge technicals (RSI/trend/Bollinger/volume), quality volume |
| TastyTrade | option chain + DXLink greeks (`chain-fetcher.ts:500-560`) | per-strike IV/OI/greeks, spot | vol-edge skew + GEX, info-edge flow, trade-card PoP/greeks |
| **Finnhub** | `/stock/metric?metric=all` (`data-fetchers.ts:214`) | margins, ROE/ROA, valuation multiples, growth rates, 52wk hi/lo, debt/equity | quality (profitability/growth/safety), vol-edge (52wk ratio) |
| Finnhub | `/stock/financials` bs/ic/cf (`:445-447`) | quarterly balance/income/cashflow | quality (Altman-Z, FCF CoV) |
| Finnhub | `/stock/financials-reported` (`:389`) | annual reported financials | quality (ROIC, FCF yield) |
| Finnhub | `/stock/earnings` (`:262`) | EPS surprise history | quality (earnings quality), info-edge (earnings momentum) |
| Finnhub | `/stock/earnings-quality-score` (`:2074`) | ML earnings-quality grade | quality (EQ ensemble modifier) |
| Finnhub | `/stock/recommendation` (`:230`) | analyst buy/hold/sell trend | info-edge (analyst consensus) |
| Finnhub | `/stock/eps-estimate`, `/revenue-estimate`, `/price-target`, `/upgrade-downgrade` (`:110-113`) | forward estimates, targets, rating changes | info-edge (consensus, price-target, upgrade/downgrade) |
| Finnhub | `/stock/insider-sentiment` (`:247`) | MSPR | quality (±5 adj), info-edge (insider activity) |
| Finnhub | `/stock/insider-transactions` (`:1038`) | Form-4 insider flow | info-edge (insider activity) |
| Finnhub | `/stock/ownership` (`:1823`) | institutional holders | info-edge (institutional ownership 0.05) |
| Finnhub | `/stock/fund-ownership` (`:1824`) | mutual-fund holders | info-edge (fund ownership 0.05) |
| Finnhub | `/stock/revenue-breakdown2` (`:1920`) | segment revenue mix → HHI | quality (revenue-concentration modifier) |
| Finnhub | `/company-news` (`:2143`) + `/news-sentiment` FinBERT (`:2024`) | news buzz + sentiment | info-edge (news sentiment 0.15) |
| Finnhub | `/stock/peers` (`:1210`) | industry peer set | peer-relative transforms (vol-edge z/percentile, info-edge price-target neutralization) |
| Finnhub | `/stock/profile2` (`:894`) | sector/industry/CIK | peer grouping, SEC CIK resolution |
| Finnhub | **`/stock/ebitda-estimate` (`:2405`)** | forward EBITDA | **fetched-unused (diagnostics `pipeline.ts:1092`)** |
| Finnhub | **`/stock/ebit-estimate` (`:2436`)** | forward EBIT | **fetched-unused (diagnostics `pipeline.ts:1094`)** |
| Finnhub | **`/stock/dividend` (`:2470`)** | dividend history | **fetched-unused (diagnostics `pipeline.ts:1096`)** |
| Finnhub | **`/stock/price-metric` (`:2506`)** | 52wk price stats, returns | **fetched-unused (`priceMetricsMap` `pipeline.ts:1011`, never in `ConvergenceInput`)** |
| Finnhub | **`/calendar/earnings` (`:2632`)** | earnings calendar | **fetched-unused (diagnostics `pipeline.ts:1104`; redundant with TT earnings date)** |
| **FRED** | 20 series (`data-fetchers.ts:598-620` + PAYEMS `:663`, CPIAUCSL `:683`) | macro | regime (14 scored) — see §3 |
| FRED | cross-asset (DGS10/SP500/DCOILWTICO, `cross-asset.ts`) | asset-return correlation cluster | regime (cross-asset modifier) |
| **SEC EDGAR** | XBRL companyfacts `/api/xbrl` (`:931`) | 10-Q/10-K financials | info-edge (filing recency overlay) |
| SEC EDGAR | 8-K full-text `efts.sec.gov` (`:1569`) | material-event hits | info-edge (material_event 0.05) |
| SEC EDGAR | submissions/Form-4 (`:1243`) | insider transactions (deprecated path; Finnhub now primary) | info-edge insider |
| **xAI/Grok** | `api.x.ai` (`data-observatory/check:633`) | sentiment probe | **health-dashboard only — not in the scoring pipeline** |
| **Anthropic/OpenAI** | `/api/ai/*` | narrative synthesis of scored output | display (post-scoring briefs) — not a gate input |

---

## SECTION 2 — Finnhub Premium: paid vs used

Every named premium endpoint checked against the codebase (`git grep`):

| endpoint | called? (file:line) | if unused → candidate gate |
|---|---|---|
| `/stock/insider-sentiment` (MSPR) | **YES** — `data-fetchers.ts:247` | (used: quality ±5, info-edge insider) |
| `/stock/insider-transactions` | **YES** — `data-fetchers.ts:1038` | (used: info-edge insider) |
| `/stock/ownership` (institutional) | **YES** — `data-fetchers.ts:1823` | (used: info-edge 0.05) |
| `/stock/fund-ownership` | **YES** — `data-fetchers.ts:1824` | (used: info-edge 0.05) |
| `/stock/revenue-breakdown2` | **YES** — `data-fetchers.ts:1920` | (used: quality HHI) |
| `/news-sentiment` (FinBERT) | **YES** — `data-fetchers.ts:2024` | (used: info-edge news) |
| `/stock/congressional-trading` | **NO — never called** | **info-edge** (informed-flow, alongside insider) |
| `/stock/lobbying` | **NO** | info-edge (regulatory positioning) |
| `/stock/usa-spending` (govt contracts) | **NO** | info-edge (revenue-catalyst, defense/gov names) |
| `/stock/social-sentiment` (Reddit/X) | **NO** | **info-edge** (retail-sentiment leg for news_sentiment) |
| `/stock/financials/sentiment` (filing NLP) | **NO** | **quality** or info-edge (MD&A tone / forward risk) |
| `/stock/earnings-call-transcripts` | **NO** | info-edge / quality (guidance & call tone) |
| `/calendar/fda` (PDUFA/advisory) | **NO** | info-edge material_event (biotech catalysts) |
| `/stock/visa-application` (H1-B) | **NO** | quality growth (hiring proxy — noisy) |
| `/stock/supply-chain` | **NO** | quality / info-edge (concentration/disruption risk) |
| `/stock/esg` | **NO** | quality (risk screen — lower alpha) |

**10 premium endpoints are paid-for-by-the-plan but never fetched.** (Note: whether each is inside the current Finnhub package tier is not verified here — verify entitlement before wiring.)

---

## SECTION 3 — FRED: scored vs display

Of 20 FRED series fetched, **14 enter regime scoring math; 6 are fetched-and-computed but never touch the score** (surfaced only in the breakdown), plus 2 date fields (staleness flags) and 2 vol-of-vol series unused by regime.

**Scored (14)** — growth composite: `gdp`/A191RL1Q225SBEA, `unemployment`/UNRATE, `nonfarmPayrolls`/PAYEMS, `consumerConfidence`/UMCSENT, `initialClaims`/ICSA, `nfci`/NFCI (`regime.ts:162-167`); inflation composite: `cpi`/CPIAUCSL, `cpiMom`, `fedFunds`/FEDFUNDS, `treasury10y`/DGS10, `breakeven5y`/T5YIE (`regime.ts:191-195`); classification modifiers: `yieldCurveSpread`/T10Y2Y (`regime.ts:242-248`), `hySpread`/BAMLH0A0HYM2 (`regime.ts:253-261`); `vix`/VIXCLS overlay (`regime.ts:357-365`). DGS10 is also the vol-edge GEX risk-free rate (`vol-edge.ts:1027`).

**Fetched but NOT scored (display/ancillary only):**

| field | FRED id | status (file:line) |
|---|---|---|
| `bbbSpread` | BAMLC0A4CBBB | ancillary "audit-only, not wired into composite" — breakdown only (`regime.ts:501-507, 815`) |
| `t10y3m` | T10Y3M | ancillary audit-only (`regime.ts:511-517, 816`) |
| `dollarIndex` | DTWEXBGS | ancillary audit-only (`regime.ts:521-527, 817`) |
| `fedBalanceSheet` | WALCL | fed net-liquidity ancillary (`regime.ts:529-543`) |
| `treasuryGeneralAccount` | WTREGEN | fed net-liquidity ancillary |
| `overnightReverseRepo` | RRPONTSYD | fed net-liquidity ancillary |
| `vxvShortTerm` | VXVCLS | not referenced in regime; used only for a VIX/VXV display ratio (`pipeline.ts:679`) |
| `vvix` | VVIXCLS | not referenced in any gate — display only (`pipeline.ts:691`) |

We pull the macro data we score, plus six credit/curve/USD/liquidity series and two vol-of-vol series that we compute and show but never let move a score.

---

## SECTION 4 — TastyTrade: consumed vs available

The scanner maps ~25 market-metrics fields (`pipeline.ts:277-319`). Consumption:

| TT field | consumed by (file:line) |
|---|---|
| ivRank, ivPercentile | vol-edge IVComposite (`vol-edge.ts:227,231`) |
| iv30, hv30/60/90, ivHvSpread | vol-edge mispricing (`vol-edge.ts:225-291`) |
| termStructure | vol-edge term-structure section (`vol-edge.ts:464`) |
| liquidityRating | quality safety 0.25 (`quality-gate.ts:377`) + hard filter (`pipeline.ts:492`) |
| marketCap | quality safety 0.15 (`quality-gate.ts:50`) |
| beta | quality safety 0.10 (`quality-gate.ts:88`) |
| lendability, borrowRate | quality safety 0.10 + penalty (`quality-gate.ts:74,398`) |
| peRatio | quality profitability P/E (`quality-gate.ts:580`) |
| corrSpy | regime SPY-correlation multiplier (`regime.ts:698`) |
| dividendYield | Black-Scholes PoP `q` (chain/trade-cards; not a gate) |
| candles (DXLink) | vol-edge technicals + quality volume |
| option chain greeks/OI | vol-edge skew+GEX, info-edge flow, PoP |
| **eps** (raw) | **not scored** — `peRatio` used instead; `earningsActualEps`/`earningsEstimate` feed beat detection, but raw `eps` is dropped |

TastyTrade utilization is high — every IV/liquidity/greeks field the pipeline models is consumed by a gate or the PoP math. The only near-drop is the raw `eps` scalar (superseded by peRatio + earnings-surprise history). No IV-rank/percentile/liquidity field is fetched-and-ignored.

---

## SECTION 5 — The gate-input map (what the composite is made of NOW)

Composite = `combineWeighted` over the 4 gates with dynamic regime weights (`composite.ts`), null gates excluded + renormalized (MIG-1).

**VOL-EDGE** — 5 sections (`vol-edge.ts:1178-1182`): mispricing 0.40 (VRP-percentile-vs-own-history, IVP/IVR composite, IV-HV spread, HV-accel), term-structure 0.25 (front-back IV slope), technicals 0.15 (RSI/trend/Bollinger/volume + Finnhub 52wk-high), skew 0.10 (25Δ skew + ATM P/C IV), GEX 0.10 (dealer gamma, BS risk-free = FRED DGS10). Source: ~90% TastyTrade, + Finnhub 52wk, + FRED DGS10, + own scan_snapshots VRP history. No dead signals.

**QUALITY** — 4 sections (`quality-gate.ts:1115-1118`): safety 0.40 (liquidity/mktCap/volume/lendability/beta/debt-equity, Altman-Z cap, borrow + revenue-HHI modifiers), profitability 0.30 (margins/ROE/ROA/ROIC/PE/PS/EV-EBITDA/FCF + 0.23 earnings-quality block), growth 0.15 (rev/EPS/dividend growth), fundamentalRisk 0.15 (cashflow-CoV/earnings-predictability/asset-turnover); + Piotroski *change* ±10, + MSPR ±5. Source: Finnhub `/metric`+`/financials`+`/earnings`+`/earnings-quality-score`+`/revenue-breakdown2`+`/insider-sentiment`, TT scanner. **Dead: Piotroski level signals 1-4** (`quality-gate.ts:261-264`).

**REGIME** — growth+inflation composites → 4 regime probabilities × strategy matrix, VIX overlay, yield-curve + HY-stress modifiers, SPY-corr multiplier, cross-asset cluster (§3). Source: 14 FRED series + TT corrSpy + cross-asset returns.

**INFO-EDGE** — 10 renormalizing sub-scores (`info-edge.ts:1344`): earnings-momentum 0.20, analyst-consensus 0.15, insider-activity 0.15, news-sentiment 0.15, price-target 0.10, upgrade-downgrade 0.10, options-flow 0.10, institutional-ownership 0.05, fund-ownership 0.05, material-event(8-K) 0.05; + filing-recency overlay. Source: Finnhub-heavy + SEC 8-K/XBRL + TT chain (flow leg). Note: `/revenue-breakdown2` is not read by info-edge (it feeds quality).

---

## REPORT — plain-language synthesis

### (a) Paid data we fetch but don't score — "edge on the shelf," ranked by likely value

**Already paying AND already fetching, just not wired into a score (fastest wins — no new API cost):**
1. **FRED fed net-liquidity** (WALCL − WTREGEN − RRPONTSYD) — a well-documented risk-asset driver, already fetched and computed as an ancillary regime signal but never in the composite (`regime.ts:529-543`). Wire into **regime**. Highest value-per-effort.
2. **FRED VIX term structure (VIX/VXV) + VVIX** (VXVCLS, VVIXCLS) — direct volatility-regime signals already fetched; a VIX/VXV ratio is even computed for display (`pipeline.ts:679`) but scored by nothing. Wire into **vol-edge** (backwardation/vol-of-vol is squarely a vol-edge concept). High value.
3. **FRED credit/curve/USD** (BBB spread, T10Y3M, dollar index) — real regime inputs, computed audit-only (`regime.ts:501-527`). Wire into **regime**. Moderate (partly redundant with HY spread / T10Y2Y).
4. **Finnhub forward EBITDA/EBIT estimates** (`/ebitda-estimate`, `/ebit-estimate`) — fetched, diagnostics-only (`pipeline.ts:1092-1095`). Forward EV/EBITDA into **quality** profitability. Moderate.
5. **Finnhub dividend history + price-metric** — fetched, diagnostics-only. Low incremental (quality already has divGrowth5Y from `/metric`; vol-edge has 52wk from `/metric`).

**Paid by the plan but never fetched (new integration, ranked by likely alpha):**
6. **`/stock/social-sentiment`** → **info-edge** — retail-sentiment leg to complement the news_sentiment block; strong for short-horizon vol/direction.
7. **`/stock/congressional-trading`** → **info-edge** — informed-flow signal alongside insider activity; documented edge.
8. **`/stock/financials/sentiment`** (filing NLP) → **quality** — management/MD&A tone as a forward-risk overlay; pairs with earnings-quality.
9. **`/stock/earnings-call-transcripts`** → **info-edge** — guidance/call tone (needs NLP processing to score).
10. **`/stock/supply-chain`** → **quality** — concentration/disruption risk; complements revenue-HHI.
11. **`/stock/usa-spending`, `/lobbying`** → info-edge — revenue-catalyst / regulatory positioning (sector-specific, lower frequency).
12. **`/calendar/fda`** → info-edge material_event — biotech catalyst dates (sector-specific).
13. **`/stock/visa-application`, `/esg`** → quality — hiring proxy / risk screen (noisy, lowest priority).

### (b) Which gate each unused signal extends
- **regime:** fed net-liquidity, BBB spread, T10Y3M, dollar index (all already fetched).
- **vol-edge:** VIX/VXV term structure, VVIX (already fetched); no new-fetch candidates.
- **quality:** forward EBITDA/EBIT (fetched), financials-sentiment, supply-chain, ESG, visa (new).
- **info-edge:** social-sentiment, congressional-trading, transcripts, usa-spending, lobbying, FDA calendar (new).

### (c) Displayed but never scored
- **Regime ancillary block:** BBB spread, T10Y3M, dollar index, fed net-liquidity — computed, shown in the breakdown, excluded from the score (`regime.ts:485-555`).
- **VVIX / VIX-VXV ratio:** computed for display (`pipeline.ts:679,691`), scored by nothing.
- **Pipeline diagnostics object:** ebitda/ebit estimates, dividend history, price-metric, earnings-calendar — fetched, surfaced as diagnostics (`pipeline.ts:1092-1105`), never in `ConvergenceInput`.
- **xAI/Grok sentiment:** only in the `data-observatory/check` health dashboard — never in the batch scoring path.
- **Dead code:** Piotroski F-score *level* signals 1-4 (`quality-gate.ts:261-264`); vol-edge `vrp_z`, post-spike detector, peer z-scores are trace-only (`vol-edge.ts:394-405, 421`).

**Bottom line:** utilization is high on TastyTrade (near-total) and Finnhub core fundamentals/info. The cheapest untapped edge is **already-fetched FRED macro** — fed net-liquidity and VIX-term-structure/VVIX are pulled every run, computed, shown, and thrown away before scoring; wiring them into regime and vol-edge respectively costs zero new API calls. The biggest *new* edge is the **unfetched Finnhub premium alternative-data set** (social/congressional/transcripts/filing-NLP), all of which map cleanly onto info-edge or quality — pending an entitlement check that they're in the current package.

### Not verified
- Whether each unfetched premium endpoint is included in the current Finnhub package tier (entitlement not checked — verify before integration).
- Historical backtested signal value of any candidate — this audit maps *utilization*, not measured alpha.
