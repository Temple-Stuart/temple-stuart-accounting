# Convergence/Scanner System — Full Read-Only Audit

**Date:** 2026-03-03
**State:** Post-improvement (18 scoring changes applied)
**Purpose:** Complete inventory for Finnhub premium data integration planning

---

## STEP 1: FILE INVENTORY

| # | File | Lines | Purpose |
|---|------|-------|---------|
| 1 | `types.ts` | 694 | All TypeScript interfaces for inputs, outputs, scoring traces, trade cards |
| 2 | `pipeline.ts` | 1156 | Main orchestrator — fetches TT scanner, applies hard filters, fetches data, scores, builds trade cards |
| 3 | `data-fetchers.ts` | 910 | All external API calls: Finnhub (4 endpoints), FRED (10 series), TT candles, options flow, news sentiment |
| 4 | `vol-edge.ts` | 770 | Gate 1: Mispricing + term structure + technicals scoring |
| 5 | `quality-gate.ts` | 724 | Gate 2: Safety + profitability + growth + fundamental risk scoring |
| 6 | `regime.ts` | 416 | Gate 3: Macro regime classification + strategy scoring matrix |
| 7 | `info-edge.ts` | 675 | Gate 4: Analyst consensus + insider activity + earnings momentum + flow signal + news sentiment |
| 8 | `composite.ts` | 271 | Combines 4 gates → composite score, position sizing, strategy suggestion |
| 9 | `pre-filter.ts` | 85 | Quick pre-score for pipeline ranking before full scoring |
| 10 | `news-classifier.ts` | 72 | Claude Haiku LLM-based news headline sentiment classification |
| 11 | `snapshot-logger.ts` | 99 | Persists scan results to Prisma `scan_snapshots` table |
| 12 | `chain-fetcher.ts` | 345 | TastyTrade options chain fetcher + trade card builder |
| 13 | `sentiment.ts` | 341 | xAI/Grok social sentiment (X/Twitter) — two-stage pipeline |
| 14 | `sector-stats.ts` | 137 | Computes per-sector mean/std/sorted values for z-score normalization |
| 15 | `filter-engine.ts` | 361 | User-configurable filter engine for scanner results |
| 16 | `filter-types.ts` | 112 | Filter type definitions and presets |
| 17 | `trade-cards.ts` | 335 | Trade card generation from options chain data |
| 18 | `probability.ts` | 112 | Black-Scholes probability of profit calculations |
| 19 | `outcome-tracker.ts` | 34 | Outcome tracking stub for future backtesting |

**Total: 19 files, 7,649 lines**

---

## STEP 2: FILE-BY-FILE DETAIL

### === FILE: data-fetchers.ts (910 lines) ===
**PURPOSE:** All external data fetching with caching and rate-limit handling.

**EXTERNAL API CALLS:**
1. `https://finnhub.io/api/v1/stock/metric?symbol={}&metric=all&token={}` — Basic financials (117+ metrics)
2. `https://finnhub.io/api/v1/stock/recommendation?symbol={}&token={}` — Analyst recommendations
3. `https://finnhub.io/api/v1/stock/insider-sentiment?symbol={}&from={}&token={}` — Insider sentiment (18-month rolling)
4. `https://finnhub.io/api/v1/stock/earnings?symbol={}&token={}` — Earnings history
5. `https://finnhub.io/api/v1/stock/financials-reported?symbol={}&freq=annual&token={}` — Annual financial statements (XBRL)
6. `https://finnhub.io/api/v1/stock/option-chain?symbol={}&token={}` — Options chain data
7. `https://finnhub.io/api/v1/company-news?symbol={}&from={}&to={}&token={}` — Company news (two calls: 7d + 8-30d)
8. `https://api.stlouisfed.org/fred/series/observations?series_id={}&api_key={}` — FRED macro data (10 series)
9. TastyTrade WebSocket API — Daily candles (via `@tastytrade/api` SDK)

**CACHES:**
- `fredCache`: FRED macro data, **TTL 1 hour** (module-level singleton)
- `optionsFlowCache`: Per-symbol options flow, **TTL 1 hour** (Map)
- `newsSentimentCache`: Per-symbol news sentiment, **TTL 30 minutes** (Map)
- No cache on Finnhub fundamentals/recommendations/insider/earnings (fetched fresh each scan)
- No cache on TastyTrade candles (WebSocket stream, fresh each scan)

**DEFAULTS/FALLBACKS:**
- Missing API key → return null/empty data (no crash)
- HTTP 429 → wait 5s, retry once
- All fetchers individually try/catch — one failure doesn't kill others

---

### === FILE: vol-edge.ts (770 lines) ===
**PURPOSE:** Gate 1 scoring — volatility mispricing, term structure, technicals.

**SCORING LOGIC:**

**Mispricing (weight 0.50 of Vol Edge):**
- VRP (30%): `IV30 - HV30`, mapped linearly: +20pt diff→100, 0→50, -20→0. Default if missing: 40
- IVP (30%): Raw IVP clamped 0-100 (normalized from TT decimal). Default if missing: 40
- IV-HV Spread (25%): `|ivHvSpread| / 20 * 100`, clamped 0-100. Default if missing: 40
- HV Acceleration (15%): HV30 vs HV60 vs HV90 trend: FALLING→80, DECLINING→65, FLAT→50, ACCELERATING→35, RISING→20. Default: 40

Sector-relative transform (when pipeline provides sectorStats):
- ≥5 peers → percentile ranking (nonparametric)
- 3-4 peers → z-score fallback (multiplier=10, clip ±5 SD)
- <3 peers → raw scores unchanged

**Term Structure (weight 0.30 of Vol Edge):**
- Slope = `(backIV - frontIV) / frontIV`
- Same 3-tier transform as mispricing (percentile / z-score / fixed tiers)
- Fixed tiers: STEEP_CONTANGO→85, CONTANGO→70, FLAT→50, BACKWARDATION→35, STEEP_BACKWARDATION→20
- Earnings kink detection: if expiration within 7 days of earnings has IV >15% above neighbors → -5 penalty
- Optimal expiration: highest IV within 25-60 DTE (fallback 20-90 DTE)

**Technicals (weight 0.20 of Vol Edge):**
- RSI 14 (25%): Asymmetric for premium selling — oversold (RSI≤20)→90, 20-30→80, 30-40→65, 40-60→55, 60-70→60, 70-80→70, >80→75
- Trend (25%): Price vs SMA20/SMA50 — clear uptrend→70, above both→65, between→55, below both→35, clear downtrend→30
- Bollinger (20%): `100 - 100 * |position - 0.5| * 2` (center = 100, edges = 0)
- Volume (15%): 5d/20d ratio — >1.5→70, >1.2→62, >0.8→55, else→40
- MACD (15%): Normalized histogram magnitude — <0.5%→60, <1%→50, <2%→40, else→30

**No candle data fallback:** Technicals excluded entirely, weights renormalized: mispricing 62.5%, term structure 37.5%

**DATA FIELDS CONSUMED:** iv30, hv30, hv60, hv90, ivPercentile, ivHvSpread, termStructure[], earningsDate, candles (OHLCV), sector, sectorStats

---

### === FILE: quality-gate.ts (724 lines) ===
**PURPOSE:** Gate 2 scoring — safety, profitability, growth, fundamental risk.

**SCORING LOGIC:**

**Safety (weight 0.40 of Quality):**
- Liquidity Rating (25%): TT 1-5 scale → `liqRating * 20 - 5`, clamped 0-100. Default: 40
- Market Cap (15%): >$200B→90, >$10B→75, >$2B→60, >$300M→40, else→20. Default: 40
- Volume (15%): 20d avg: >50M→90, >10M→75, >1M→60, >100K→40, else→20. Default: 40
- Lendability (10%): Easy→80, Locate Required→30, else→55. Default: 60
- Beta (10%): <0.8→90, ≤1.0→80, ≤1.2→65, ≤1.5→50, else→30. Default: 40
- Debt/Equity (25%): Finnhub `totalDebt/totalEquityQuarterly`: <0.3→95, ≤0.5→80, ≤1.0→65, ≤2.0→45, else→25. Default: 40
- **Piotroski F-Score (modifier only):** 9 signals computed, 5 "change signals" used as ±10 modifier on profitability
- **Altman Z-Score (hard gate):** If computable (≥3 of 5 components) and Z < 1.8 → cap safety at 40

**Profitability (weight 0.30 of Quality):**
- Gross Margin (15%): >60%→85, >40%→70, >20%→55, >0%→35, else→20. Default: 40
- ROE (15%): >25%→90, >15%→75, >10%→60, >5%→45, >0%→30, else→15. Default: 40
- ROA (10%): >15%→90, >10%→75, >5%→60, >2%→45, >0%→30, else→15. Default: 40
- P/E (15%): <0→20, <5→35, <10→60, ≤25→75, ≤40→55, ≤60→40, else→25. Default: 40
- FCF Yield (20%): FCF/sh ÷ price × 100: >8%→85, >4%→70, >1%→55, >0→40, else→25. Default: 40
- Earnings Quality (25%): Composite of surprise consistency (50%), DTE score (30%), beat rate (20%)
  - SUE-relative thresholds (Bernard & Thomas 1989): `max(1%, 0.5 × stdDev)`
  - DTE scoring: <0d→60, ≤7d→30, ≤14d→45, ≤30d→55, ≤45d→65, else→60

**Growth (weight 0.15 of Quality):**
- Revenue Growth YoY (40%): >20%→90, >10%→75, >5%→60, >0%→50, else→30. Default: 40
- EPS Growth YoY (40%): >25%→90, >15%→75, >5%→60, >0%→50, else→30. Default: 40
- Dividend Growth 5Y (20%): >10%→85, >5%→70, >0%→55, else→35. Default: 40

**Fundamental Risk (weight 0.15 of Quality):**
- Cash Flow Stability (40%): 2-year OCF CoV: <0.2→85, <0.5→70, <1.0→55, <2.0→40, else→25. Fallback: TTM FCF sign (positive→60, negative→35). Default: 40
- Earnings Predictability (35%): Surprise StdDev: <2%→85, <5%→70, <10%→55, <20%→40, else→25. Default: 40
- Asset Turnover (25%): >1.5→90, >1.0→75, >0.5→60, >0.3→45, else→30. Default: 40

**MSPR bonus (post-composite):** Latest insider sentiment month: MSPR > 50 → +5, MSPR < -50 → -5

**DATA FIELDS CONSUMED FROM FINNHUB `/stock/metric`:**
- `totalDebt/totalEquityQuarterly`, `roeTTM`, `roaTTM`, `freeCashFlowPerShareTTM`, `netIncomePerShareTTM`
- `currentRatioQuarterly`, `operatingMarginTTM`, `assetTurnoverTTM`, `beta`
- `grossMarginTTM`, `peNormalizedAnnual`, `marketCapitalization`, `shareOutstanding`
- `revenueGrowthTTMYoy`, `epsGrowthTTMYoy`, `dividendGrowthRate5Y`
**Total: 16 of 117+ metrics actually used**

**DATA FIELDS FROM ANNUAL FINANCIALS (`/stock/financials-reported`):**
- `GrossProfit`, `Revenues` (multiple XBRL names), `AssetsCurrent`, `LiabilitiesCurrent`
- `Assets`, `LongTermDebt`, `CommonStockSharesOutstanding`, `NetCashProvidedByUsedInOperatingActivities`
- `PaymentsToAcquirePropertyPlantAndEquipment`, `NetIncomeLoss`

---

### === FILE: regime.ts (416 lines) ===
**PURPOSE:** Gate 3 scoring — macro regime classification and strategy-regime matrix.

**SCORING LOGIC:**

**Step A — Normalize 8 macro indicators to 0-100 via sigmoid:**
- Growth Signal (composite): GDP (30%) + Unemployment (25%, inverted) + NFP (25%) + Consumer Confidence (20%)
- Inflation Signal (composite): CPI YoY (40%) + CPI MoM (30%) + Fed Funds (15%) + 10Y Treasury (15%)

Baselines (1990-2024 medians):
| Indicator | Median | Spread |
|-----------|--------|--------|
| GDP Growth | 2.5% | 2.0 |
| Unemployment | 5.0% | 1.5 |
| NFP | 150K | 150 |
| Consumer Sentiment | 85 | 15 |
| CPI YoY | 2.5% | 1.5 |
| CPI MoM | 0.2% | 0.3 |
| Fed Funds | 3.0% | 2.5 |
| 10Y Treasury | 3.5% | 1.5 |

**Step B — Regime Classification (sigmoid):**
Four regimes: Goldilocks, Reflation, Stagflation, Deflation. Probabilities normalized to sum to 1.

**Step C — Strategy-Regime Matrix (10 strategies × 4 regimes):**
| Strategy | Gold | Refl | Stag | Defl |
|----------|------|------|------|------|
| Iron Condor | 85 | 55 | 50 | 45 |
| Short Put Spread | 70 | 75 | 45 | 40 |
| Short Call Spread | 40 | 30 | 65 | 75 |
| Long Call Spread | 80 | 80 | 20 | 30 |
| Long Put Spread | 25 | 20 | 75 | 80 |
| Short Straddle | 80 | 50 | 45 | 40 |
| Short Strangle | 85 | 55 | 50 | 45 |
| Covered Call | 65 | 70 | 55 | 50 |
| Cash Secured Put | 75 | 65 | 50 | 45 |
| Calendar Spread | 70 | 60 | 40 | 55 |

**Step D — VIX Overlay:**
- VIX > 24 → short vol +10, long vol -5
- VIX < 15 → short vol -5, long vol +5

**Step E:** Best strategy's final score = base regime score.

**Step F — SPY Correlation Modifier:**
- `multiplier = 0.1 + 0.9 * max(0, corrSpy)`
- `adjusted_regime = base_regime * multiplier`
- corrSpy=1.0 → full regime signal; corrSpy=0.0 → 10% regime effect

**DATA FIELDS CONSUMED:** All 9 FRED macro values + VIX + corrSpy from TT scanner

---

### === FILE: info-edge.ts (675 lines) ===
**PURPOSE:** Gate 4 scoring — analyst consensus, insider activity, earnings momentum, flow signal, news sentiment.

**SCORING LOGIC:**

**Analyst Consensus (weight 0.15 of Info Edge):**
- Consensus Score (35%): Bullish/total ratio → `15 + bullishPct * 70`. Default: 40
- Momentum Score (65%): Current vs previous period bullish count change: up→75, same→50, down→35. Default: 40
- Coverage Score: Tracked but not in formula (trace only)

**Insider Activity (weight 0.25 of Info Edge):**
- MSPR Score (60%): Latest MSPR: >20→80, >5→65, >-5→50, >-20→35, else→20. Default: 40
- Trend Score (40%): Recent 2-month avg vs older avg: improving→70, deteriorating→30, stable→50. Default: 50

**Earnings Momentum (weight 0.25 of Info Edge):**
- Beat Streak (40%): ≥4 beats→85, ≥3→75, ≥2→65, ≥1→55; ≥3 misses→20, ≥2→30, ≥1→40. Default: 50
- Surprise Magnitude (35%): Avg surprise%: >10%→85, >5%→70, >1%→60, >-1%→50, >-5%→35, else→20. Default: 50
- Consistency (25%): Same-direction ratio mapped: all positive→90, all negative capped. Default: 50
- Uses SUE-relative thresholds (Bernard & Thomas 1989)

**Flow Signal (weight 0.20 of Info Edge):**
- Put/Call Ratio (25%): Compressed 35-point range per Johnson & So 2012. Default: 40
- Volume Bias (25%): OTM call vs put bias, linear interpolation. Default: 40
- Unusual Activity (25%): vol/OI ratio continuous scoring. Default: 40
- Option/Stock Ratio (25%): Johnson & So 2012 — low O/S = bullish. Requires candle data for avg stock vol. Default: 50

Without candle data: weights renormalize to PCR 30%, bias 35%, activity 35%.

**News Sentiment (weight 0.15 of Info Edge):**
- Buzz Score (30%): 7d article count vs 8-30d weekly baseline ratio. Default: 20 (no articles)
- Sentiment Score (40%): Confidence-weighted sentiment from keyword or LLM classification, ±5 momentum modifier
- Source Quality (30%): Tier-1 source ratio (Reuters, Bloomberg, CNBC, WSJ, etc.)

**DATA FIELDS CONSUMED:** finnhubRecommendations, finnhubInsiderSentiment (MSPR), finnhubEarnings (surprise%), optionsFlow (PCR, bias, unusual, vol/OI), newsSentiment (buzz, sentiment, sources), candles

---

### === FILE: composite.ts (271 lines) ===
**PURPOSE:** Combines all 4 gates into final composite score.

**SCORING LOGIC:**
- `composite = 0.25 * vol_edge + 0.25 * quality + 0.25 * regime + 0.25 * info_edge`
- **Convergence gate:** Count categories > 50
  - <2 gates → NO TRADE (0% position)
  - 2 gates → 20% position (marginal)
  - 3+ gates → Continuous sizing: `30% + ((clampedComposite - 50) / 50) * 70%`, rounded to nearest 5%
- **Direction:** info_edge > 65 → BULLISH, < 35 → BEARISH, else NEUTRAL

---

### === FILE: news-classifier.ts (72 lines) ===
**PURPOSE:** Claude Haiku LLM classification of news headlines.

**API CALL:** Anthropic Messages API with model `claude-haiku-4-5-20251001`
**INPUT:** Array of headline strings + ticker symbol
**OUTPUT:** Array of `{sentiment: 'bullish'|'bearish'|'neutral', confidence: 0-1}`
**COST:** ~$0.01-0.05 per scan of 50-200 headlines
**FALLBACK:** If API fails or ANTHROPIC_API_KEY missing → keyword-based classification (in data-fetchers.ts)
**ENV VAR:** `ANTHROPIC_API_KEY`

---

### === FILE: sentiment.ts (341 lines) ===
**PURPOSE:** xAI/Grok social sentiment from X/Twitter.

**API CALLS:**
1. `https://api.x.ai/v1/responses` — Stage 1: Grok 4.1 Fast + x_search tool (fetch posts)
2. `https://api.x.ai/v1/chat/completions` — Stage 2: Grok 4.1 Fast Non-Reasoning (score sentiment)

**OUTPUT:** SentimentResult with score (-1 to +1), magnitude (0-1), post count, themes, sample posts
**ENV VAR:** `XAI_API_KEY`
**USED IN PIPELINE:** Yes — called in pipeline.ts via `fetchSentimentBatch()`, results attached to trade cards as `social_sentiment` field on `TradeCardKeyStats`
**USED IN SCORING:** NO — not part of any gate's score formula. Informational only on trade cards.

---

### === FILE: snapshot-logger.ts (99 lines) ===
**PURPOSE:** Persists scan results to database.

**PERSISTED FIELDS:**
| Field | Source |
|-------|--------|
| userId, ticker, scanDate | Pipeline context |
| spotPrice, iv30, hv30, ivPercentile | TT scanner data |
| volEdgeScore, qualityScore, regimeScore, infoEdgeScore, compositeScore | Gate scores |
| gatesAbove50, positionSizePct, sizingMethod | Position sizing |
| dataConfidence, imputedCount | Data quality |
| regimeLabel, vixLevel | Regime context |
| suggestedStrategy, suggestedDTE | Strategy output |
| fullTrace (JSON) | Complete FullScoringResult serialized |
| outcomeDate, outcomePnl, outcomeSpotPrice, outcomeIV, ivCompressed, stayedInRange | Future outcome tracking (filled later) |

---

### === FILE: sector-stats.ts (137 lines) ===
**PURPOSE:** Computes per-sector statistics from scanner batch for z-score normalization.

**METRICS COMPUTED PER SECTOR:** iv_percentile, iv_hv_spread, hv30, hv60, hv90, iv30, pe_ratio, market_cap, beta, corr_spy, dividend_yield, eps, term_structure_slope

Each metric: mean, std, sortedValues (for percentile ranking). Minimum 3 peers per sector.

---

### === FILE: pipeline.ts (1,156 lines) ===
**PURPOSE:** Main orchestrator.

**PIPELINE FLOW:**
1. Fetch TT scanner data (via TastyTrade API)
2. Apply hard filters (price ≥ $5, market cap ≥ $300M, liquidity rating ≥ 2)
3. Pre-score survivors with vol-edge quick estimate
4. Rank by pre-score, take top N (configurable, default 40)
5. Batch fetch: Finnhub data + TT candles + FRED macro + options flow + news sentiment (parallel)
6. Compute sector stats for z-score normalization
7. Score all 4 gates via `scoreAll()`
8. Build trade cards from options chain data
9. Fetch social sentiment (xAI/Grok) for top tickers
10. Log snapshots to database
11. Return ranked results

---

## STEP 3: COMPLETE DATA SOURCE INVENTORY

### TastyTrade Scanner Fields (25 defined in types.ts)

| Field | Used in Scoring? | Where Used |
|-------|-----------------|------------|
| symbol | Yes (identifier) | pipeline.ts |
| ivRank | NO | Defined but not consumed in any gate |
| ivPercentile | Yes | vol-edge.ts:232 (mispricing IVP sub-score) |
| impliedVolatility | NO | Defined but not consumed in scoring |
| liquidityRating | Yes | quality-gate.ts:40-45 (safety) |
| earningsDate | Yes | vol-edge.ts:385 (term structure kink) |
| daysTillEarnings | Yes | quality-gate.ts:291,416 (profitability DTE) |
| hv30 | Yes | vol-edge.ts:229 (mispricing VRP, HV accel) |
| hv60 | Yes | vol-edge.ts:230 (mispricing HV accel) |
| hv90 | Yes | vol-edge.ts:231 (mispricing HV accel) |
| iv30 | Yes | vol-edge.ts:228 (mispricing VRP) |
| ivHvSpread | Yes | vol-edge.ts:235 (mispricing IV-HV sub-score) |
| beta | Yes | quality-gate.ts:82 (safety) |
| corrSpy | Yes | regime.ts:331 (SPY correlation modifier) |
| marketCap | Yes | quality-gate.ts:48 (safety), pipeline hard filter |
| sector | Yes | vol-edge.ts (sector z-scores), sector-stats.ts |
| industry | NO | Defined but not consumed |
| peRatio | Yes | quality-gate.ts:329 (profitability P/E) |
| eps | NO | Defined but used only in sector-stats, not in any gate formula |
| dividendYield | NO | Defined, used in sector-stats only, not scored |
| lendability | Yes | quality-gate.ts:72-79 (safety) |
| borrowRate | NO | Passed through to trace output but not scored |
| earningsActualEps | NO | Defined but not consumed |
| earningsEstimate | NO | Defined but not consumed |
| earningsTimeOfDay | NO | Defined but not consumed |
| termStructure[] | Yes | vol-edge.ts:384 (term structure sub-score) |

**TT Scanner: 25 fields defined, ~16 used in scoring, ~9 unused**

### Finnhub FREE Endpoints Currently Called

#### 1. `/stock/metric` (basic financials) — Fields Actually Used

| Finnhub Metric Key | Used In | Gate | Sub-Score |
|---|---|---|---|
| `totalDebt/totalEquityQuarterly` | quality-gate.ts:93 | Quality/Safety | D/E (25%) |
| `roeTTM` | quality-gate.ts:105,305 | Quality/Safety+Profitability | Piotroski + ROE (15%) |
| `roaTTM` | quality-gate.ts:106,317 | Quality/Safety+Profitability | Piotroski + ROA (10%) |
| `freeCashFlowPerShareTTM` | quality-gate.ts:107,342 | Quality/Safety+Profitability+FundRisk | Piotroski + FCF (20%) + CF stability fallback |
| `netIncomePerShareTTM` | quality-gate.ts:108 | Quality/Safety | Piotroski (FCF > NI check) |
| `currentRatioQuarterly` | quality-gate.ts:109 | Quality/Safety | Altman Z proxy (X1) |
| `operatingMarginTTM` | quality-gate.ts:177 | Quality/Safety | Altman Z proxy (X3) |
| `assetTurnoverTTM` | quality-gate.ts:180,599 | Quality/Safety+FundRisk | Altman Z (X5) + Asset turnover (25%) |
| `beta` | quality-gate.ts:82 | Quality/Safety | Beta fallback (10%) |
| `grossMarginTTM` | quality-gate.ts:294 | Quality/Profitability | Gross margin (15%) |
| `peNormalizedAnnual` | quality-gate.ts:329 | Quality/Profitability | P/E fallback (15%) |
| `marketCapitalization` | quality-gate.ts:343 | Quality/Profitability | FCF yield price calc |
| `shareOutstanding` | quality-gate.ts:343 | Quality/Profitability | FCF yield price calc |
| `revenueGrowthTTMYoy` | quality-gate.ts:484 | Quality/Growth | Revenue growth (40%) |
| `epsGrowthTTMYoy` | quality-gate.ts:495 | Quality/Growth | EPS growth (40%) |
| `dividendGrowthRate5Y` | quality-gate.ts:506 | Quality/Growth | Dividend growth (20%) |

**USED: 16 of 117+ available metrics**

**AVAILABLE BUT UNUSED from `/stock/metric` (sampling of the 100+ unused):**
- Valuation: `psTTM`, `pbQuarterly`, `pbAnnual`, `peBasicExclExtraTTM`, `peExclExtraTTM`, `enterpriseValueEBITDA`, `evToRevenue`
- Profitability: `operatingMarginAnnual`, `netProfitMarginTTM`, `pretaxMarginTTM`, `ebitdaMargin`
- Returns: `roicTTM`, `roeAnnual`, `roaAnnual`
- Per-share: `bookValuePerShareQuarterly`, `tangibleBookValuePerShare`, `cashPerShareQuarterly`
- Dividends: `dividendYieldIndicatedAnnual`, `payoutRatioTTM`, `dividendPerShareAnnual`
- Growth: `revenueGrowth3Y`, `revenueGrowth5Y`, `epsGrowth3Y`, `epsGrowth5Y`
- Debt: `totalDebtToEquityAnnual`, `longTermDebtToEquity`, `netDebtToEquity`, `interestCoverage`
- Efficiency: `inventoryTurnoverTTM`, `receivablesTurnoverTTM`
- Technical: `52WeekHigh`, `52WeekLow`, `52WeekHighDate`, `52WeekLowDate`, `10DayAverageTradingVolume`, `3MonthAverageTradingVolume`
- And many more...

#### 2. `/company-news` — Used in scoring
Called twice per ticker (7d window + 8-30d window). Headlines classified by keyword matching or Claude Haiku LLM. Feeds into Info Edge → News Sentiment sub-score.

#### 3. `/stock/recommendation` — Used in scoring
Analyst recommendations (strongBuy, buy, hold, sell, strongSell, period). Feeds into Info Edge → Analyst Consensus.

#### 4. `/stock/insider-sentiment` — Used in scoring
Monthly MSPR (Monthly Share Purchase Ratio). 18-month rolling window. Feeds into Info Edge → Insider Activity AND Quality Gate → MSPR bonus.

#### 5. `/stock/earnings` — Used in scoring
Quarterly earnings (actual, estimate, surprise, surprisePercent). Feeds into Quality → Profitability (earnings quality) AND Info Edge → Earnings Momentum.

#### 6. `/stock/financials-reported` (annual) — Used in scoring
XBRL annual reports parsed for 10 line items across BS/IS/CF. Used for Piotroski F-Score (9 signals) and Altman Z-Score (5 components).

#### 7. `/stock/option-chain` — Used in scoring
Full options chain within 60 DTE. Aggregated into: put/call ratio, volume bias, unusual activity ratio, total volumes/OI. Feeds into Info Edge → Flow Signal.

### FRED Series Currently Fetched

| Series ID | Field | Used In |
|-----------|-------|---------|
| VIXCLS | vix | regime.ts (VIX overlay) |
| DGS10 | treasury10y | regime.ts (inflation signal, 15%) |
| FEDFUNDS | fedFunds | regime.ts (inflation signal, 15%) |
| UNRATE | unemployment | regime.ts (growth signal, 25%) |
| A191RL1Q225SBEA | gdp | regime.ts (growth signal, 30%) |
| UMCSENT | consumerConfidence | regime.ts (growth signal, 20%) |
| SOFR | sofr | Fetched but **NOT USED in any scoring** |
| PAYEMS | nonfarmPayrolls | regime.ts (growth signal, 25%) — computed as month-over-month change |
| CPIAUCSL | cpi (YoY), cpiMom | regime.ts (inflation signal, 40% + 30%) — computed from 13 observations |

**9 series fetched, 8 used in scoring, 1 unused (SOFR)**

### Claude Haiku (news-classifier.ts)
- **Input:** Array of headline strings + ticker symbol
- **Output:** Array of `{sentiment, confidence}` per headline
- **Integration point:** Called from `fetchNewsSentiment()` in data-fetchers.ts after keyword classification
- **Fallback:** If ANTHROPIC_API_KEY missing or API fails → keyword classification retained

### xAI/Grok (sentiment.ts)
- **Input:** Ticker symbol
- **Output:** SentimentResult (score, magnitude, themes, sample posts)
- **Integration point:** Called from pipeline.ts for top-ranked tickers after scoring
- **Usage:** Attached to trade cards as `key_stats.social_sentiment` — **NOT used in any gate scoring formula**
- **ENV VAR:** `XAI_API_KEY`

---

## STEP 4: SCORING ARCHITECTURE SUMMARY

```
PIPELINE ENTRY → Cron job or API call to /api/trading/convergence
  ↓
TT SCANNER FETCH → TastyTrade market scanner API (all optionable equities)
  ↓
HARD FILTERS → price ≥ $5, marketCap ≥ $300M, liquidityRating ≥ 2
  ↓
PRE-FILTER → Quick vol-edge estimate (IVP + IV-HV spread), rank, take top N (default 40)
  ↓
PARALLEL DATA FETCH (per ticker):
  ├── Finnhub: /stock/metric, /stock/recommendation, /stock/insider-sentiment, /stock/earnings
  ├── Finnhub: /stock/financials-reported (annual)
  ├── Finnhub: /stock/option-chain
  ├── Finnhub: /company-news (7d + 8-30d, with Claude Haiku LLM classification)
  ├── TastyTrade: WebSocket daily candles (90 days)
  └── FRED: 10 macro series (cached 1 hour)
  ↓
SECTOR STATS → Compute mean/std/sortedValues per sector for z-score normalization
  ↓
GATE 1: VOL-EDGE (25% of composite)
  ├── Mispricing (50%): VRP(30%) + IVP(30%) + IV_HV(25%) + HV_accel(15%)
  ├── Term Structure (30%): Slope scoring + earnings kink detection
  └── Technicals (20%): RSI(25%) + Trend(25%) + Bollinger(20%) + Volume(15%) + MACD(15%)
  ↓
GATE 2: QUALITY (25% of composite)
  ├── Safety (40%): Liquidity(25%) + MktCap(15%) + Volume(15%) + Lendability(10%) + Beta(10%) + D/E(25%)
  │   + Piotroski F-Score (±10 modifier on profitability)
  │   + Altman Z-Score (hard cap at 40 if Z < 1.8)
  ├── Profitability (30%): Margin(15%) + ROE(15%) + ROA(10%) + PE(15%) + FCF(20%) + EarningsQuality(25%)
  ├── Growth (15%): RevGrowth(40%) + EPSGrowth(40%) + DivGrowth(20%)
  └── FundamentalRisk (15%): CFStability(40%) + EarnPredict(35%) + AssetTurn(25%)
  + MSPR bonus (±5 post-composite)
  ↓
GATE 3: REGIME (25% of composite)
  ├── Growth Signal: GDP(30%) + Unemployment(25%) + NFP(25%) + ConsConf(20%)
  ├── Inflation Signal: CPI_YoY(40%) + CPI_MoM(30%) + FedFunds(15%) + 10Y(15%)
  ├── Regime Classification: Goldilocks / Reflation / Stagflation / Deflation
  ├── Strategy-Regime Matrix: 10 strategies × 4 regimes
  ├── VIX Overlay: ±10/±5 adjustments
  └── SPY Correlation Modifier: 0.1 + 0.9 * max(0, corrSpy)
  ↓
GATE 4: INFO-EDGE (25% of composite)
  ├── Analyst Consensus (15%): Consensus(35%) + Momentum(65%)
  ├── Insider Activity (25%): MSPR(60%) + Trend(40%)
  ├── Earnings Momentum (25%): Streak(40%) + Magnitude(35%) + Consistency(25%)
  ├── Flow Signal (20%): PCR(25%) + Bias(25%) + Activity(25%) + O/S(25%)
  └── News Sentiment (15%): Buzz(30%) + Sentiment(40%) + SourceQuality(30%)
  ↓
COMPOSITE → 0.25 × each gate
  Convergence gate: <2 above 50 → 0%, 2 → 20%, 3+ → continuous 30-100%
  Direction: info_edge > 65 → BULLISH, < 35 → BEARISH, else NEUTRAL
  ↓
TRADE CARDS → Built from TT options chain (chain-fetcher.ts + trade-cards.ts)
  ↓
SOCIAL SENTIMENT → xAI/Grok (optional, informational only)
  ↓
SNAPSHOT LOGGING → Prisma scan_snapshots table (fire-and-forget)
```

---

## STEP 5: SPECIFIC QUESTIONS ANSWERED

### Q1: How many of Finnhub's 117+ basic financial metrics are actually consumed in scoring?

**16 metrics used out of 117+ available.** That's roughly 14% utilization.

Used metrics: `totalDebt/totalEquityQuarterly`, `roeTTM`, `roaTTM`, `freeCashFlowPerShareTTM`, `netIncomePerShareTTM`, `currentRatioQuarterly`, `operatingMarginTTM`, `assetTurnoverTTM`, `beta`, `grossMarginTTM`, `peNormalizedAnnual`, `marketCapitalization`, `shareOutstanding`, `revenueGrowthTTMYoy`, `epsGrowthTTMYoy`, `dividendGrowthRate5Y`.

### Q2: Are any premium Finnhub endpoints already being called?

**No.** All 7 Finnhub endpoints currently called are free-tier endpoints:
- `/stock/metric` (free)
- `/stock/recommendation` (free)
- `/stock/insider-sentiment` (free)
- `/stock/earnings` (free)
- `/stock/financials-reported` (free, annual frequency)
- `/stock/option-chain` (free)
- `/company-news` (free)

None of the premium endpoints listed in the task are called anywhere.

### Q3: What is the exact Finnhub API key env var name?

**`FINNHUB_API_KEY`** — The `.env` file comment says `# FINNHUB (News + Analyst Ratings) — Free tier, 60 calls/min`. This confirms the key is configured as a **free tier key**, not a premium key. The env var name is the same regardless, but the comment indicates free tier. To use premium endpoints, you'd need to either upgrade the same key or add a separate `FINNHUB_PREMIUM_KEY`.

### Q4: How many TastyTrade scanner fields are available vs used?

**25 fields defined in `TTScannerData` interface. ~16 used in scoring, ~9 unused.**

Unused: `ivRank`, `impliedVolatility`, `industry`, `eps` (sector-stats only), `dividendYield` (sector-stats only), `borrowRate` (trace only), `earningsActualEps`, `earningsEstimate`, `earningsTimeOfDay`.

### Q5: Is xAI/Grok used anywhere in the convergence pipeline?

**Yes, but only for informational display — NOT for scoring.** The `sentiment.ts` module is called from `pipeline.ts` for top-ranked tickers. Results are attached to trade cards as `key_stats.social_sentiment`. The `SocialSentiment` interface exists in types.ts. It does NOT feed into any of the 4 gate scores.

### Q6: What data does the news-classifier.ts receive and return?

**Receives:** Array of headline strings + ticker symbol
**Sends to:** Anthropic Messages API with `claude-haiku-4-5-20251001` model
**System prompt:** Financial news sentiment classifier for options trading context
**Returns:** Array of `{sentiment: 'bullish'|'bearish'|'neutral', confidence: 0-1}` — one per headline
**Fallback:** Returns `null` → caller keeps keyword-based classifications
**Cost:** ~$0.01-0.05 per scan batch
**Integration:** Called from `fetchNewsSentiment()` in data-fetchers.ts. Results override keyword classifications and feed into Info Edge → News Sentiment scoring (confidence-weighted).

### Q7: How does ScanSnapshot logging work?

**Trigger:** Called from pipeline.ts after scoring via `logScanSnapshotBatch()`
**Method:** Individual Prisma `create()` calls (not `createMany`) so partial failures don't lose all data
**Fire-and-forget:** `void logScanSnapshot()` — errors logged, never propagated

**Persisted fields:** userId, ticker, scanDate, spotPrice, iv30, hv30, ivPercentile, volEdgeScore, qualityScore, regimeScore, infoEdgeScore, compositeScore, gatesAbove50, positionSizePct, sizingMethod, dataConfidence, imputedCount, regimeLabel, vixLevel, suggestedStrategy, suggestedDTE

**fullTrace JSON:** Complete `FullScoringResult` object serialized — contains all 4 gate results with every sub-score, formula, trace, inputs, z-scores, etc.

**Outcome fields (filled later):** outcomeDate, outcomePnl, outcomeSpotPrice, outcomeIV, ivCompressed, stayedInRange

### Q8: Are there any API calls whose results are never used in scoring?

**Yes:**
1. **FRED SOFR** (`SOFR` series) — fetched and stored in `FredMacroData.sofr` but never consumed by any scoring function
2. **xAI/Grok social sentiment** — fetched for top tickers but only displayed on trade cards, not scored
3. **TT scanner `ivRank`** — fetched from scanner but never used (only `ivPercentile` is used)
4. **TT scanner `impliedVolatility`** — fetched but not scored
5. **TT scanner `borrowRate`** — passed to safety trace output but not part of weighted formula
6. **TT scanner `earningsActualEps`, `earningsEstimate`, `earningsTimeOfDay`** — fetched, not scored
7. **TT scanner `dividendYield`** — used in sector-stats computation but not in any gate formula
8. **TT scanner `eps`** — used in sector-stats computation but not in any gate formula

### Q9: What is the total number of sub-scores across all 4 gates?

Counting every individually weighted component:

| Gate | Sub-Scores | Count |
|------|-----------|-------|
| Vol Edge | VRP, IVP, IV_HV, HV_accel, Term Structure, RSI, Trend, Bollinger, Volume, MACD | **10** |
| Quality/Safety | Liquidity, MktCap, Volume, Lendability, Beta, D/E | **6** |
| Quality/Profitability | GrossMargin, ROE, ROA, PE, FCF, SurpriseConsistency, DTE, BeatRate | **8** |
| Quality/Growth | RevGrowth, EPSGrowth, DivGrowth | **3** |
| Quality/FundRisk | CFStability, EarnPredict, AssetTurnover | **3** |
| Regime | GDP, Unemployment, NFP, ConsConf, CPI_YoY, CPI_MoM, FedFunds, 10Y | **8** |
| Info Edge | Consensus, Momentum(analyst), MSPR, Trend(insider), BeatStreak, SurpriseMag, Consistency, PCR, VolBias, UnusualActivity, O/S, Buzz, Sentiment, SourceQuality | **14** |

**Total: 52 individually weighted sub-scores** (plus 2 modifiers: Piotroski ±10, MSPR ±5)

### Q10: For each sub-score, theoretical range (min-max) and what causes extremes?

All sub-scores operate on a **0-100 scale** (clamped). In practice:

| Sub-Score | Practical Min | Practical Max | Min Cause | Max Cause |
|-----------|--------------|---------------|-----------|-----------|
| VRP (mispricing) | 0 | 100 | IV30 - HV30 = -20 or worse | IV30 - HV30 = +20 or better |
| IVP | 0 | 100 | IVP = 0% (lowest IV in year) | IVP = 100% (highest IV in year) |
| IV-HV Spread | 0 | 100 | ivHvSpread = 0 | ivHvSpread ≥ 20 |
| HV Accel | 20 | 80 | HV30 > HV60 > HV90 (rising) | HV30 < HV60 < HV90 (falling) |
| Term Structure | 0-20 | 85-100 | Steep backwardation or bottom percentile | Steep contango or top percentile |
| RSI | 55 | 90 | RSI 40-60 (neutral) | RSI ≤ 20 (extreme oversold) |
| Safety components | 20-30 | 80-95 | Missing data or worst tier | Best tier |
| Growth components | 30 | 90 | Negative growth | >20-25% growth |
| MSPR Score | 20 | 80 | Heavy insider selling (<-20) | Strong insider buying (>+20) |
| Buzz | 20 | 90 | Zero articles | buzz_ratio ≥ 3.0 |
| Missing data default | **40** | **40** | Any field missing → penalty default 40 | N/A |

---

## STEP 6: DATA GAPS ANALYSIS

### A. Fields Fetched But Not Scored (data we already have but throw away)

| Data Source | Field | Status |
|-------------|-------|--------|
| FRED | SOFR | Fetched, stored in FredMacroData, never consumed |
| TT Scanner | ivRank | Fetched, stored in TTScannerData, never scored |
| TT Scanner | impliedVolatility | Fetched, stored, never scored |
| TT Scanner | borrowRate | Stored in safety trace output, not weighted |
| TT Scanner | earningsActualEps | Fetched, never scored |
| TT Scanner | earningsEstimate | Fetched, never scored |
| TT Scanner | earningsTimeOfDay | Fetched, never scored |
| TT Scanner | industry | Fetched, never used (only sector used) |
| TT Scanner | dividendYield | Only in sector-stats, not scored |
| TT Scanner | eps | Only in sector-stats, not scored |
| Finnhub /stock/metric | ~101 unused metrics | Fetched via `metric=all`, only 16 consumed |
| xAI/Grok Sentiment | Full social sentiment | Fetched for top tickers, displayed only, not scored |

### B. Premium Endpoints Available But Not Called ($550/mo Package 1)

| Endpoint | What It Provides | Potential Use |
|----------|-----------------|---------------|
| `/stock/price-target` | Analyst price targets (high, low, median, mean) | Info Edge: target vs current price spread |
| `/stock/upgrade-downgrade` | Individual analyst actions with dates | Info Edge: momentum of rating changes |
| `/stock/eps-estimate` | Forward EPS consensus estimates | Quality: forward P/E, estimate revision momentum |
| `/stock/revenue-estimate` | Forward revenue consensus | Quality: forward revenue growth expectations |
| `/stock/ebitda-estimate` | Forward EBITDA consensus | Quality: profitability expectations |
| `/stock/ebit-estimate` | Forward EBIT consensus | Quality: operating profitability expectations |
| `/stock/earnings-quality-score` | Finnhub proprietary earnings quality | Quality: replace proxy-based earnings quality |
| `/stock/revenue-breakdown2` | Revenue by segment/geography | Quality: concentration risk |
| `/stock/financials` (quarterly, 40Q) | Full quarterly financial history | Quality: multi-quarter trend analysis vs current 2-year annual |
| `/stock/price-metric` | 52wk high/low, avg volumes, returns | Vol Edge: relative price position metrics |
| `/stock/ownership` | Institutional ownership details | Info Edge: smart money positioning |
| `/stock/fund-ownership` | Mutual fund holdings | Info Edge: fund flow signals |
| `/institutional/ownership` | Institutional portfolio data | Info Edge: institutional conviction |
| `/stock/profile2` | Company profile with market cap, IPO date | Quality: company maturity signal |
| `/stock/peers` | Peer companies list | Sector stats: better peer group selection |
| `/news-sentiment` | Finnhub's own news sentiment scoring | Info Edge: cross-validate LLM sentiment |
| `/stock/filings` | SEC filing dates and types | Info Edge: filing activity signal |
| `/stock/executive` | Executive team and compensation | Quality: governance signal |
| `/stock/dividend` | Dividend history and ex-dates | Quality: dividend consistency |
| `/calendar/earnings` | Upcoming earnings calendar | Quality: market-wide earnings density |
| `/calendar/ipo` | Upcoming IPOs | Regime: IPO activity as sentiment proxy |
| `/stock/symbol` | Full symbol listing | Pipeline: universe expansion |
| `/stock/market-status` | Exchange open/close status | Pipeline: scheduling |
| `/stock/market-holiday` | Market holiday calendar | Pipeline: scheduling |
| `/stock/historical-market-cap` | Historical market cap | Quality: market cap trend |
| `/stock/historical-employee-count` | Employee count history | Quality: growth signal |
| `/press-releases2` | Press releases | Info Edge: corporate communication volume |
| `/sector/metrics` | Sector-level aggregate metrics | Regime/Quality: sector health context |

### C. Scoring Components Using Proxies When Better Data Exists

| Current Proxy | Better Premium Alternative |
|--------------|---------------------------|
| Altman Z X1: `currentRatioQuarterly` as Working Capital/Total Assets proxy | `/stock/financials` quarterly: actual WC/TA ratio |
| Altman Z X2: `roaTTM` as Retained Earnings/Total Assets proxy | `/stock/financials` quarterly: actual RE/TA |
| Altman Z X3: `operatingMarginTTM` as EBIT/Total Assets proxy | `/stock/financials` quarterly: actual EBIT/TA |
| Altman Z X4: `1/debtToEquity` as Market Value Equity/Liabilities proxy | `/stock/price-metric` + `/stock/financials`: actual MV equity / total liabilities |
| Piotroski F-Score: 2-year annual data only | `/stock/financials` 40 quarters: multi-year trends |
| Earnings Quality: surprise-based proxy | `/stock/earnings-quality-score`: Finnhub's dedicated score |
| Forward valuation: uses trailing P/E only | `/stock/eps-estimate`: forward P/E from consensus |
| Analyst signal: rating counts only | `/stock/price-target` + `/stock/upgrade-downgrade`: price targets + individual actions |
| Cash flow stability: 2-year CoV | `/stock/financials` quarterly: 10-year cash flow series |

### D. Data That Would Be Valuable But Has No Source Currently

| Missing Data | Impact | Possible Source |
|-------------|--------|-----------------|
| Short interest / days to cover | Would improve flow signal accuracy | FINRA/Exchange data (not in Finnhub) |
| Dark pool activity | Institutional flow visibility | Not publicly available at reasonable cost |
| Options order flow direction (buy-to-open vs sell-to-close) | PCR is unsigned — loses predictive power per Pan & Poteshman 2006 | Requires Level 2 options data |
| Implied volatility surface (full skew) | Only term structure slope used; no skew scoring | TT chain data has individual strike IVs (available) |
| Historical VIX term structure | Only spot VIX used | CBOE VIX futures data |
| Credit default swap spreads | Corporate credit risk signal | Bloomberg/ICE (expensive) |
| Macro rate-of-change for levels (unemployment Δ, fed funds Δ) | Currently only levels scored for some indicators | Requires FRED historical storage (noted in regime.ts TODO) |

---

## SUMMARY STATISTICS

| Metric | Value |
|--------|-------|
| Total convergence files | 19 |
| Total lines of code | 7,649 |
| External API sources | 5 (Finnhub, FRED, TastyTrade, Anthropic/Haiku, xAI/Grok) |
| Finnhub endpoints called | 7 (all free tier) |
| Finnhub premium endpoints called | **0** |
| Finnhub basic metrics used | 16 of 117+ (~14%) |
| FRED series fetched | 9 (8 used, 1 dead: SOFR) |
| TT scanner fields | 25 (16 used, 9 unused) |
| Scoring gates | 4 (equal weighted 25% each) |
| Total sub-scores | 52 + 2 modifiers |
| Caches | 3 (FRED 1hr, options flow 1hr, news 30min) |
| Monthly Finnhub cost | $550 (Package 1) |
| Premium data utilization | **0%** |
