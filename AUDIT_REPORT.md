# Convergence Pipeline — Full Code Audit Report

**Date:** 2026-03-12
**Scope:** 27 files across `src/lib/convergence/`, `src/lib/`, `src/app/api/`, `src/components/convergence/`
**Status:** AUDIT ONLY — no modifications made

---

## 1. EVERY EXTERNAL API CALL — Line Number, Service, Endpoint, Data Returned, Variable Stored Into

### A. TastyTrade SDK (via `src/lib/tastytrade.ts` client)

| File | Line | Service | Endpoint / Method | Data Returned | Variable |
|------|------|---------|-------------------|---------------|----------|
| `pipeline.ts` | 352 | TastyTrade | `client.marketMetricsService.getMarketMetrics()` | Raw market metrics array (IV, HV, liquidity, earnings, beta, etc.) | `raw` → `items` → `allScannerData` |
| `chain-fetcher.ts` | 131 | TastyTrade | `client.accountsAndCustomersService.getCustomerResource()` | Token refresh (auth keepalive) | (side effect) |
| `chain-fetcher.ts` | 153 | TastyTrade | `client.instrumentsService.getNestedOptionChain(ticker.symbol)` | Nested option chain (expirations, strikes, OI, IV) | `rawChain` |
| `chain-fetcher.ts` | 296-301 | TastyTrade | `client.quoteStreamer.subscribe()` (WebSocket) | Live Greeks (delta, gamma, theta, vega), Quote (bid/ask), Trade, Summary | `greeksMap`, `quoteMap` |
| `data-fetchers.ts` | 2156-2158 | TastyTrade | `getTastytradeClient()` → `client.accountsAndCustomersService.getCustomerResource()` | Token refresh for candle WebSocket | (side effect) |
| `data-fetchers.ts` | 2160-2193 | TastyTrade | `client.quoteStreamer` (WebSocket, `subscribeCandles`) | Daily OHLCV candle data | `data` Map<string, CandleData[]> |

### B. Finnhub API (`https://finnhub.io/api/v1/...`)

| File | Line | Service | Endpoint | Data Returned | Variable |
|------|------|---------|----------|---------------|----------|
| `data-fetchers.ts` | 82-86 | Finnhub | `/stock/eps-estimate`, `/stock/revenue-estimate`, `/stock/price-target`, `/stock/upgrade-downgrade` | EPS estimates, revenue estimates, price targets, upgrades/downgrades | `epsEstimates`, `revenueEstimates`, `priceTarget`, `upgradeDowngrade` → combined as `FinnhubEstimates` |
| `data-fetchers.ts` | 176-178 | Finnhub | `/stock/metric?metric=all` | Full fundamental metrics (PE, ROE, ROA, margins, growth, etc.) | `fundamentals` (metric object) |
| `data-fetchers.ts` | 192-194 | Finnhub | `/stock/recommendation` | Analyst buy/hold/sell recommendations array | `recommendations` |
| `data-fetchers.ts` | 209-210 | Finnhub | `/stock/insider-sentiment` | Insider MSPR, change data by month | `insiderSentiment` |
| `data-fetchers.ts` | 224-225 | Finnhub | `/stock/earnings` | Quarterly EPS actual vs estimate, surprise % | `earnings` |
| `data-fetchers.ts` | 338-339 | Finnhub | `/stock/financials-reported?freq=annual` | Annual 10-K financial data (revenue, OCF, assets, etc.) | `AnnualFinancials` |
| `data-fetchers.ts` | 387-391 | Finnhub | `/stock/financials?statement=bs&freq=quarterly`, `/stock/financials?statement=ic&freq=quarterly`, `/stock/financials?statement=cf&freq=quarterly` | Quarterly balance sheet, income, cash flow | `QuarterlyFinancials` |
| `data-fetchers.ts` | 807-809 | Finnhub | `/stock/profile2?symbol=...` | Company profile with CIK | `cik` (used for SEC lookups) |
| `data-fetchers.ts` | 951-952 | Finnhub | `/stock/insider-transactions?symbol=...&from=...` | 90-day insider transactions (P/S codes, shares, prices) | `SECForm4Data` |
| `data-fetchers.ts` | 1106-1107 | Finnhub | `/stock/peers?symbol=...&grouping=industry` | Peer company ticker list | `peers` string[] |
| `data-fetchers.ts` | 1699-1701 | Finnhub | `/stock/ownership?symbol=...` + `/stock/fund-ownership?symbol=...` | Institutional holders, share changes, filing dates | `FinnhubInstitutionalOwnership` |
| `data-fetchers.ts` | 1778-1779 | Finnhub | `/stock/revenue-breakdown2?symbol=...` | Segment revenue breakdown, HHI concentration | `FinnhubRevenueBreakdown` |
| `data-fetchers.ts` | 1882-1883 | Finnhub | `/news-sentiment?symbol=...` | FinBERT sentiment score, buzz, sector average | `FinnhubNewsSentiment` |
| `data-fetchers.ts` | 1932-1933 | Finnhub | `/stock/earnings-quality-score?symbol=...&freq=quarterly` | ML earnings quality score + letter grade | `FinnhubEarningsQuality` |
| `data-fetchers.ts` | 2001-2006 | Finnhub | `/company-news?symbol=...&from=...&to=...` (×2: 7d + 8-30d) | News articles (headline, source, datetime) | `articles7dRaw`, `articles8_30dRaw` → `NewsSentimentData` |

### C. FRED API (`https://api.stlouisfed.org/fred/series/observations`)

| File | Line | Service | Endpoint | Data Returned | Variable |
|------|------|---------|----------|---------------|----------|
| `data-fetchers.ts` | 549-553 | FRED | `/fred/series/observations` for: VIXCLS, DGS10, FEDFUNDS, UNRATE, A191RL1Q225SBEA, UMCSENT, T10Y2Y, T5YIE, BAMLH0A0HYM2, NFCI, ICSA, PAYEMS, CPIAUCSL | Macro economic indicators (latest values) | `FredMacroData` |
| `data-fetchers.ts` | 673-676 | FRED | `/fred/series/observations` for: DGS10, SP500, DCOILWTICO | Daily observations (252 business days) for cross-asset correlation | `Map<string, {date,value}[]>` |

### D. SEC EDGAR

| File | Line | Service | Endpoint | Data Returned | Variable |
|------|------|---------|----------|---------------|----------|
| `data-fetchers.ts` | 845 | SEC EDGAR | `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json` | XBRL facts (EPS, revenue, net income from 10-Q/10-K) | `SECFilingData` |
| `data-fetchers.ts` | 1157 | SEC EDGAR | `https://data.sec.gov/submissions/CIK{cik}.json` | Recent filing submissions (Form 4 indices) | `recent` filings array |
| `data-fetchers.ts` | 1219 | SEC EDGAR | `https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}` (×15 max) | Individual Form 4 XML filings | `SECForm4Transaction[]` (DEPRECATED path) |
| `data-fetchers.ts` | 1453-1454 | SEC EDGAR | `https://efts.sec.gov/LATEST/search-index` | Full-text search for 10-K filing | `accessionNumber` |
| `data-fetchers.ts` | 1472 | SEC EDGAR | `https://data.sec.gov/submissions/CIK{cik}.json` | Submissions fallback for 10-K accession | `accessionNumber` |
| `data-fetchers.ts` | 1505-1506 | SEC EDGAR | `https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/index.json` | Filing index (primary document path) | `primaryDoc` |
| `data-fetchers.ts` | 1556-1557 | SEC EDGAR | `https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{doc}` | Full 10-K HTML document | `htmlText` → `CompanyTextProfile` |

### E. Anthropic Claude API

| File | Line | Service | Endpoint | Data Returned | Variable |
|------|------|---------|----------|---------------|----------|
| `news-classifier.ts` | 24 | Anthropic | `client.messages.create()` (model: `claude-haiku-4-5-20251001`) | JSON array of {idx, s: sentiment, c: confidence} | `ClassifiedHeadline[]` |
| `convergence-synthesis/route.ts` | 351 | Anthropic | `client.messages.create()` (model: `claude-sonnet-4-20250514`) | AI synthesis text of pipeline results | `synthesis` text |

### F. xAI Grok API

| File | Line | Service | Endpoint | Data Returned | Variable |
|------|------|---------|----------|---------------|----------|
| `sentiment.ts` | 148 | xAI | `https://api.x.ai/v1/responses` (model: `grok-4-1-fast`, tool: `x_search`) | X/Twitter posts about ticker | `posts` array with text, author |
| `sentiment.ts` | 211 | xAI | `https://api.x.ai/v1/chat/completions` (model: `grok-4-1-fast-non-reasoning`) | Sentiment scoring JSON {score, magnitude, themes, posts} | `SentimentResult` |

### G. Internal Next.js API Routes (client-side calls)

| File | Line | Service | Endpoint | Data Returned | Variable |
|------|------|---------|----------|---------------|----------|
| `ConvergenceIntelligence.tsx` | 2966 | Internal | `GET /api/trade-cards?status=queued` | Saved trade cards | `savedCards` Map |
| `ConvergenceIntelligence.tsx` | 3041 | Internal | `POST /api/trade-cards` | Created card with ID | `savedCards` entry |
| `ConvergenceIntelligence.tsx` | 3070 | Internal | `DELETE /api/trade-cards` | Deletion confirmation | removes from `savedCards` |
| `ConvergenceIntelligence.tsx` | 3103 | Internal | `GET /api/trading/convergence?stream=true` (SSE) | Pipeline progress events + final result | `pipelineProgress`, `pipelineResult` |
| `ConvergenceIntelligence.tsx` | 3112 | Internal | `GET /api/trading/convergence` | Cached pipeline result JSON | `pipelineResults` |
| `ConvergenceIntelligence.tsx` | 3140 | Internal | `POST /api/ai/convergence-synthesis` | BatchResponse with top_9, timing, sentiment | `batchData` |
| `ConvergenceIntelligence.tsx` | 3162 | Internal | `GET /api/test/convergence?symbol=...` | Per-ticker TickerDetail (scores, trade cards) | `enriched[]` |
| `ConvergenceIntelligence.tsx` | 3188 | Internal | `GET /api/test/convergence?symbol=...` | Single ticker lookup TickerDetail | `lookupData` |

---

## 2. EVERY PIPELINE STEP IN `pipeline.ts` — Exact Comment Label, Progress Key, Line Range, What It Does, Reads, Outputs

| Step | Comment Label | Progress Key | Lines | What It Does | Reads | Outputs |
|------|-------------|-------------|-------|-------------|-------|---------|
| **A** | `STEP A: Fetch TT Scanner` | `'a'` | 332-409 | Batches all symbols (50/batch) to TastyTrade `getMarketMetrics()`. Parses into `TTScannerData[]` via `parseMarketMetrics()`. | Universe symbol list, TastyTrade SDK | `allScannerData: TTScannerData[]` |
| **A2** | `STEP A2: Pre-Filter` | `'a2'` | 411-448 | Calls `computePreFilter(allScannerData)`. Scores `preScore = ivRank*0.6 + liquidity*0.4`. Excludes liquidity < 2. Warns earnings < 3d. Takes top `limit*5`. | `allScannerData` | `preFilteredScannerData`, `preFilterResults` |
| **B** | `STEP B: Hard Filters` | `'b'` | 450-454 | Calls `applyHardFilters(preFilteredScannerData)`. 5 binary rules: market cap >$2B, liquidity ≥2, IV30 exists, borrow <50%, no earnings within 7d. | `preFilteredScannerData` | `hardFilters.survivors` |
| **C1** | Finnhub peers fetch | (no dedicated key) | 464-483 | Fetches `fetchPeerTickers()` for each survivor with 10s timeout cap. | `hardFilters.survivors` | `finnhubPeersMap` |
| **C2** | `STEP C: Peer Grouping` | `'c'` | 485-519 | Calls `computePeerStats()`. 4-tier peer grouping: text_nlp → finnhub_peers → GICS industry → GICS sector. Computes z-scores for IV percentile, IV30, beta vs peers. | `hardFilters.survivors`, `finnhubPeersMap`, `allScannerData` | `peerStats`, `peerGroupAssignment` |
| **D** | `STEP D: Pre-Score` | `'d'` | 521-545 | Calls `computePreScores()`. Formula: `IVP*0.4 + IV-HV*0.3 + Liquidity*0.3`. Takes top `limit*2` for Finnhub enrichment. | `hardFilters.survivors`, scanner data | `topSymbols`, `preScoreRows` |
| **E** | `STEP E: Data Enrichment` | `'e'` | 547-789 | Massive parallel data fetch. Sub-steps: E1 = Finnhub batch (fundamentals, recommendations, insider sentiment, earnings, estimates). E2 = FRED macro + FRED daily. E3-E11 = news sentiment, FinBERT, earnings quality, institutional ownership, revenue breakdown, quarterly financials, SEC EDGAR XBRL, insider transactions (Finnhub), 10-K text. E11b = recompute peer stats with text peers. | `topSymbols` | Multiple maps: `finnhubDataMap`, `fredMacro`, `fredDaily`, `newsSentimentMap`, `finbertMap`, `earningsQualityMap`, `instOwnershipMap`, `revenueBreakdownMap`, `quarterlyFinancialsMap`, `secFilingDataMap`, `insiderTxMap`, `tenKTextMap` |
| **F** | `STEP F: 4-Gate Scoring` | `'f'` | 791-928 | Assembles `ConvergenceInput` per ticker from all fetched data. Calls `scoreAll()` which runs `scoreVolEdge()`, `scoreQualityGate()`, `scoreRegime()`, `scoreInfoEdge()`, then `composite.ts` dynamic weighting. | All enrichment data, `peerStats`, `fredMacro`, `crossAssetCorrelations` | `scoredTickers: {symbol, scoring: FullScoringResult}[]` |
| **F2** | Candle re-score | (no dedicated key) | 850-912 | Fetches candle data via `fetchTTCandlesBatch()` (WebSocket). Re-scores each ticker with real technical indicators. | `scoredTickers`, TastyTrade candle WebSocket | Updated `scoredTickers` with technicals |
| **G** | `STEP G: Rank & Diversify` | (no dedicated key) | 930-932 | Calls `rankAndDiversify()`. Convergence gate (3/4 above 50), quality floor (≥40), sector cap (2 per sector). | `scoredTickers` | `top9`, `alsoScored`, `diversification` |
| **G1.5** | Social sentiment | (no dedicated key) | 934-953 | Parallel social sentiment via `fetchSentimentBatch()` (xAI Grok x_search). | `top9` symbols | `sentimentMap` |
| **G2** | `STEP G2: Trade Cards` | `'j'`, `'k'`, `'g'` | 955-1113 | Fetches option chains via `fetchChainAndBuildCards()` (TastyTrade REST + WebSocket). Builds `StrategyCard[]` via `generateStrategies()`. Converts to `TradeCard[]` via `generateTradeCards()`. | `top9`, TastyTrade option chain + Greeks stream | `tradeCardMap`, `chainStats`, `rejectionReasons` |
| **G2.5** | Re-score with real flow | (no dedicated key) | 1049-1102 | Re-scores tickers using real `OptionsFlowData` from chain fetch (PCR, volume bias, unusual activity, O/S ratio). | `chainFetchResults`, `scoredTickers` | Updated scoring with real flow data |
| **H** | Final assembly | (no dedicated key) | 1165+ | Assembles `PipelineResult` with all data: pipeline_summary, hard_filters, peer_stats, rankings, scoring_details, trade cards, social sentiment, rejection reasons, data gaps, errors. Calls `logScanSnapshotBatch()` for persistence. | All computed data | `PipelineResult` |

---

## 3. FILE INVENTORY — Complete List with Line Counts

| # | File | Lines | API Calls | Description |
|---|------|-------|-----------|-------------|
| 1 | `src/lib/convergence/pipeline.ts` | ~1200 | TastyTrade (2), indirect calls to all fetchers | Master pipeline orchestrator |
| 2 | `src/lib/convergence/data-fetchers.ts` | 2247 | Finnhub (15), FRED (2), SEC EDGAR (6), TastyTrade (1) | All external data fetching |
| 3 | `src/lib/convergence/chain-fetcher.ts` | 538 | TastyTrade (3: REST + WebSocket) | Options chain fetch + strategy building |
| 4 | `src/lib/convergence/vol-edge.ts` | 1154 | None | Vol Edge gate scorer (5 sub-scores) |
| 5 | `src/lib/convergence/quality-gate.ts` | 1137 | None | Quality gate scorer (4 sub-scores) |
| 6 | `src/lib/convergence/regime.ts` | 660 | None | Regime scorer (macro signals + strategy matrix) |
| 7 | `src/lib/convergence/info-edge.ts` | 1376 | None | Info Edge scorer (8 sub-scores + filing overlay) |
| 8 | `src/lib/convergence/composite.ts` | 361 | None | Dynamic gate weighting + convergence gate |
| 9 | `src/lib/convergence/pre-filter.ts` | 86 | None | Pre-filter (ivRank*0.6 + liquidity*0.4) |
| 10 | `src/lib/convergence/types.ts` | 1195 | None | All type definitions |
| 11 | `src/lib/convergence/trade-cards.ts` | 473 | None | TradeCard generation (no API calls) |
| 12 | `src/lib/convergence/probability.ts` | 113 | None | Black-Scholes probability utilities |
| 13 | `src/lib/convergence/outcome-tracker.ts` | 34 | Prisma (1) | Snapshot outcome updater |
| 14 | `src/lib/convergence/news-classifier.ts` | 73 | Anthropic Claude (1) | Haiku headline sentiment classifier |
| 15 | `src/lib/convergence/sentiment.ts` | 342 | xAI Grok (2) | X/Twitter social sentiment |
| 16 | `src/lib/convergence/sector-stats.ts` | 568 | None | Peer grouping + TF-IDF text similarity |
| 17 | `src/lib/convergence/cross-asset.ts` | 214 | None | Pearson correlation clustering |
| 18 | `src/lib/convergence/snapshot-logger.ts` | 100 | Prisma (2) | Fire-and-forget scan snapshot logging |
| 19 | `src/lib/convergence/filter-engine.ts` | 302 | None | Client-side 3-tier filter application |
| 20 | `src/lib/convergence/filter-types.ts` | 113 | None | Filter type definitions + defaults |
| 21 | `src/lib/strategy-builder.ts` | ~1400+ | None | Client-side option strategy generation |
| 22 | `src/lib/convergence/strategy-builder.ts` | — | — | **FILE DOES NOT EXIST** |
| 23 | `src/app/api/trading/convergence/route.ts` | 147 | Prisma (1), calls `runPipeline()` | GET route, 15-min cache, SSE streaming |
| 24 | `src/app/api/ai/convergence-synthesis/route.ts` | 406 | Anthropic Claude (1) | POST route, 30-min cache, Sonnet synthesis |
| 25 | `src/components/convergence/ConvergenceIntelligence.tsx` | 3352 | Internal API (8) | Main dashboard component |
| 26 | `src/components/convergence/FilterPanel.tsx` | 394 | None | 3-tier filter UI with sliders + toggles |
| 27 | `src/components/convergence/ScannerResultsTable.tsx` | 743 | None | Sortable results table with expanded view |

---

## 4. SCORING ARCHITECTURE SUMMARY

### Gate Weights (Dynamic by Regime)

| Regime | Vol Edge | Quality | Regime | Info Edge |
|--------|----------|---------|--------|-----------|
| Goldilocks | 30% | 20% | 20% | 30% |
| Reflation | 30% | 20% | 25% | 25% |
| Deflation | 20% | 35% | 25% | 20% |
| Stagflation | 20% | 30% | 30% | 20% |
| Crisis | 15% | 40% | 30% | 15% |

### Vol Edge Sub-Scores (vol-edge.ts)
- Mispricing: 0.40 weight (IVP, IVR, VRP z-score, IV-HV spread, HV acceleration)
- Term Structure: 0.25 weight (contango/backwardation shape)
- Technicals: 0.15 weight (RSI, SMA trend, Bollinger, volume, 52w high)
- Skew: 0.10 weight (25-delta vol skew + P/C IV ratio ATM)
- GEX: 0.10 weight (net dealer gamma, flip point distance)

### Quality Gate Sub-Scores (quality-gate.ts)
- Safety: 0.40 weight (Piotroski F-Score, Altman Z-Score, liquidity, market cap, volume, beta, D/E)
- Profitability: 0.30 weight (gross margin, ROE, ROA, ROIC, PE, P/S, EV/EBITDA, FCF, earnings quality)
- Growth: 0.15 weight (revenue growth YoY, EPS growth YoY, dividend growth 5Y)
- Fundamental Risk: 0.15 weight (CF stability CoV, earnings predictability, asset turnover)

### Info Edge Sub-Scores (info-edge.ts)
- Analyst Consensus: 0.15 weight
- Price Target Signal: 0.10 weight
- Upgrade/Downgrade: 0.10 weight (Womack asymmetric)
- Insider Activity: 0.15 weight (MSPR + Form4 ensemble)
- Earnings Momentum: 0.20 weight (SUE-based)
- Flow Signal: 0.10 weight (PCR, bias, unusual activity, O/S ratio)
- News Sentiment: 0.15 weight (3-leg ensemble: keyword + Haiku LLM + FinBERT)
- Institutional Ownership: 0.05 weight (net buyer ratio, staleness discount)
- Filing Recency: additive overlay (±8/−12 pts, asymmetric)

---

## 5. NOTES

1. **`src/lib/convergence/strategy-builder.ts`** — This file does not exist. The actual strategy builder is at `src/lib/strategy-builder.ts`.

2. **Deprecated code preserved**: `fetchSECForm4Data()` (data-fetchers.ts:1140-1312) is the old 3-hop SEC EDGAR chain (profile2 → submissions → XML). Replaced by `fetchInsiderTransactions()` using Finnhub `/stock/insider-transactions`. Both functions exist in the file.

3. **Empty universe arrays**: `RUSSELL_2000`, `SP400`, `SP600`, `WILSHIRE_5000`, `MSCI_USA`, `RUSSELL_1000` are all empty arrays with TODO comments (pipeline.ts:207-212). The UI shows these as dropdown options but they will produce zero results.

4. **Trade card save/remove**: The `ConvergenceIntelligence.tsx` component calls `POST /api/trade-cards` and `DELETE /api/trade-cards` — these routes were not in the audit scope but are referenced from the component.

5. **No API calls in scoring files**: `vol-edge.ts`, `quality-gate.ts`, `regime.ts`, `info-edge.ts`, `composite.ts` — all scoring is purely computational. They receive pre-fetched data via `ConvergenceInput` and produce score objects. Zero external calls.
