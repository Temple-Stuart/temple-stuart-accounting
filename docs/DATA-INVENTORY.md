# DATA-01 — Data inventory: every feed, every field

**What arrives, what is read, what is paid for and thrown away.** A read-only census of every
external feed the options scanner (`src/lib/convergence/pipeline.ts`), the data observatory
(`src/app/api/data-observatory/check/route.ts`) and the background jobs call, field by field.

| | |
|---|---|
| Dated | **2026-09-15** |
| Branch | `claude/data-01-inventory` off `main` `247e33c2` (TRADE-COST-01 merged) |
| Changes | **None.** No parser fixed, no input added or removed, no weight touched. This document is the only artifact. |
| Metered calls made | **None.** Every Finnhub fact below comes from the code, from the vendor's own documentation, or from replaying the vendor's own published sample responses through the real parsers on a throwaway Postgres in this environment. |
| Free calls made | Finnhub's public docs page (1 GET), FRED series pages for VVIXCLS / VXVCLS / VIXCLS (3 GETs, no key), SEC EFTS full-text search (2 GETs), and the public CBOE / FRED / SEC / FINRA / OCC / CFTC pages listed in §5 (read by the research pass; each URL is cited on its row). |

## 0. How to read this document

**Provenance.** Every row carries one of these codes. A row with no code is a heading.

| Code | Means |
|---|---|
| **C** | Derived from the code at the cited `file:line` (read in full before the row was written). |
| **V** | Read from the vendor's documentation at the cited URL on 2026-09-15. Finnhub rows cite the Swagger spec embedded in `https://finnhub.io/docs/api` (`window.docSchema`); a vendor sample is the `sampleResponse` that spec carries for the endpoint. |
| **S** | Observed by replaying the vendor's published sample through the real parser in this environment (Appendix B). Not a production response. |
| **F** | The founder's vendor-run log, as quoted in the DATA-01 ruling: `[PriceMetric] AAPL {}` beside a full RAW payload; `revenue-breakdown2` failing "no positive revenue segments" on all 10 symbols; `dividend` crashing on non-payers. |
| **P** | A free, unmetered probe made in this environment on 2026-09-15 (the URL is on the row). |
| **NV** | **Not verified.** Stated as a gap, never as a fact. Appendix A gives Alex the query that settles each one on Azure. |

**What could not be verified here, and why.** Claude Code cannot reach Azure Postgres, so the
`finnhub_responses` rows the founder's vendor run wrote are unreadable from this session; the repo
carries no fixture; the arrivals store holds no Finnhub row. The daily-tier endpoints (`stock/metric`,
`stock/price-metric`, `stock/peers`, `company-news`, `news-sentiment`, `stock/upgrade-downgrade`,
`calendar/earnings`) bypass the store (`finnhub-ttl.ts` `ttlMs: 0`), so **no captured row can exist
for them anywhere**. Finnhub's spec types four maps as bare `object` with no documented keys
(`MetricMap`, `PriceMetricMap`, `FinancialMap`, `ReportDataMap`, `MetricSeriesMap`), so for those
endpoints the "returned" column is the sample's keys plus the docs' prose, not a closed list.

**The scan's shape** (C — `pipeline.ts`). Step A pulls TastyTrade market-metrics for the whole
universe in batches of 50 (`:253`, `:424`); the pre-filter (`:2318-2323`) and six hard filters
(`:2117-2272`) cut it; then `topSymbols = min(limit × 2, survivors)` (`:652-654`) buys every Finnhub
and SEC feed. Scoring runs twice: pass 1 with `candles: []` (`:1225`), pass 2 after the DXLink candle
subscription (`:1271`, "Rebuild input with real candles and re-score" `:1284`). Every "present?" cell
below is about the input that reaches `scoreConvergence`, not about the HTTP response.

---

## 1. Endpoint census — per provider

### 1.1 Finnhub — metered per call (feedCost.ts:45, COA B-B-5130), 23 endpoints, 26 calls per symbol cold / 8 warm

Tier = the vendor's access flag from the docs (V). Scan tier = the TRADE-COST-01 TTL row (C,
`src/lib/convergence/finnhub-ttl.ts:62-137`; `finnhubCallsPerSymbol('cold') = 26`, `'warm' = 8`,
`slowTierEndpoints().length = 16`, run in this environment). Every URL is built by one helper
(`finnhub-cache.ts:52` `FINNHUB_BASE`; `finnhubDirect` `:209`, `finnhubCached` `:230`).

| # | Endpoint | Vendor tier (V) | Scan tier / TTL (C) | Calls per symbol | Call site (C, `data-fetchers.ts`) | Params sent (C) | Params the docs require but the scan omits (V vs C) |
|---|---|---|---|---|---|---|---|
| 1 | `stock/metric` | free | daily · 0 | 1 | `:217` `fetchFinnhubTicker` | `metric=all` | — |
| 2 | `stock/recommendation` | free | weekly · 24h | 1 | `:227` | — | — |
| 3 | `stock/insider-sentiment` | free | monthly · 24h | 1 | `:237` | `from` (−540d) | **`to` is documented required; not sent** |
| 4 | `stock/earnings` | free (free tier: last 4 quarters) | quarterly · 7d | 1 | `:246` | — | — |
| 5 | `stock/eps-estimate` | Premium | weekly · 24h | 1 | `:131` `fetchFinnhubEstimates` | `freq=quarterly` | — |
| 6 | `stock/revenue-estimate` | Premium | weekly · 24h | 1 | `:132` | `freq=quarterly` | — |
| 7 | `stock/price-target` | Premium | weekly · 24h | 1 | `:133` | — | — |
| 8 | `stock/upgrade-downgrade` | Premium | daily · 0 (vendor title "Real-time") | 1 | `:134` | — | — |
| 9 | `stock/financials-reported` | free | quarterly · 7d | 1 | `:379` `fetchAnnualFinancials` | `freq=annual` | — |
| 10 | `stock/financials` | Premium | quarterly · 7d | **3** (bs · ic · cf) | `:426` `fetchQuarterlyFinancials` | `statement`, `freq=quarterly` | — (the `ttm`/`ytd` freq and `preliminary` flag the docs offer are never asked) |
| 11 | `stock/insider-transactions` | free | monthly · 24h | 1 | `:1041` `fetchInsiderTransactions` | `from` (−90d) | — |
| 12 | `stock/peers` | free | daily · 0 | 1 | `:1206` `fetchPeerTickers` | `grouping=industry` | — |
| 13 | `stock/ownership` | Premium | monthly · 24h | 1 | `:1821` `fetchFinnhubInstitutionalOwnership` | — | — |
| 14 | `stock/fund-ownership` | Premium | monthly · 24h | 1 | `:1822` (Step E6) and `:2508` `fetchFinnhubFundOwnership` (Step I5) read ONE store key, coalesced | — | — |
| 15 | `stock/revenue-breakdown2` | Premium | quarterly · 7d | 1 | `:1900` `fetchFinnhubRevenueBreakdown` | — | — |
| 16 | `news-sentiment` | Premium | daily · 0 | 1 | `:1995` `fetchFinnhubNewsSentiment` | — | — |
| 17 | `stock/earnings-quality-score` | Premium | quarterly · 7d | 1 | `:2037` `fetchFinnhubEarningsQuality` | `freq=quarterly` | — |
| 18 | `company-news` | free (free tier: 1 year) | daily · 0 | **2** (7d window; 8–30d baseline) | `:2104-2105` `fetchNewsSentiment` | `from`, `to` | — |
| 19 | `stock/ebitda-estimate` | Premium | weekly · 24h | 1 | `:2364` | `freq=quarterly` | — |
| 20 | `stock/ebit-estimate` | Premium | weekly · 24h | 1 | `:2394` | `freq=quarterly` | — |
| 21 | `stock/dividend` | Premium | quarterly · 7d | 1 | `:2427` `fetchFinnhubDividendHistory` | `from` (−365d), `to` (today) | — |
| 22 | `stock/price-metric` | Premium | daily · 0 | 1 | `:2464` `fetchFinnhubPriceMetrics` | **`date=today` — a param the docs do not list** (they list `symbol` only) | — |
| 23 | `calendar/earnings` | free (free tier: 1 month) | daily · 0 | 1 | `:2595` `fetchFinnhubEarningsCalendar` | `from` (today), `to` (+90d), `symbol` | — |

Totals (C): 26 calls per symbol cold; 8 per symbol warm (rows 1, 8, 12, 16, 18 ×2, 22, 23); 16
endpoints served from `finnhub_responses` inside their TTL (`prisma/migrations/20260915000000_trade_cost_01_finnhub_responses`).

### 1.2 FRED — free with a key (`FRED_API_KEY`), 24 series once per scan, 1-hour in-process cache

| Call | Series | Site (C) | Cadence (C) |
|---|---|---|---|
| `fred/series/observations?…&limit=1` | VIXCLS, DGS10, FEDFUNDS, UNRATE, A191RL1Q225SBEA, UMCSENT, T10Y2Y, T5YIE, BAMLH0A0HYM2, NFCI, ICSA, VXVCLS, **VVIXCLS**, WALCL, WTREGEN, RRPONTSYD, BAMLC0A4CBBB, T10Y3M, DTWEXBGS (19) | `data-fetchers.ts:583-603` `seriesMap`, loop `:621-643` | once per scan (`pipeline.ts:676` `fetchFredMacro`), cached 1h |
| `…series_id=PAYEMS&limit=2` | PAYEMS | `:649` | same |
| `…series_id=CPIAUCSL&limit=13` | CPIAUCSL | `:669` | same |
| `fetchFredDailySeries` | DGS10, SP500, DCOILWTICO daily history | `:714` `CROSS_ASSET_SERIES`, `:716` | once per scan (`pipeline.ts:677`), cached 1h |

**VVIXCLS does not exist on FRED** (P — `https://fred.stlouisfed.org/series/VVIXCLS` answers HTTP
404 while `/series/VXVCLS` and `/series/VIXCLS` answer 200, checked 2026-09-15; FRED's search for
"VVIX" lists 0 series). The loop records `VVIXCLS: HTTP <status>` in `errors` and leaves `vvix`
null (`:636-641`); the API's exact status code for a nonexistent series is NV (no key here).
Consequence in §4.4.

### 1.3 SEC EDGAR — free, no key, 10 req/s (V — `https://www.sec.gov/os/accessing-edgar-data`), 6 calls per symbol + 1 per scan

| Call | URL | Site (C) | Per |
|---|---|---|---|
| CIK map | `https://www.sec.gov/files/company_tickers.json` | `data-fetchers.ts:871`, `fetchCIKMap` `:877` (30-day cache) | scan / process |
| companyfacts | `https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json` | `:942` `fetchSECFilingData` (`pipeline.ts:965`) | symbol |
| EFTS 10-K search | `https://efts.sec.gov/LATEST/search-index?q="SYM"&forms=10-K&dateRange=custom…` | `:1566` `fetch10KBusinessDescription` (`pipeline.ts:1000`) | symbol |
| submissions (fallback) | `https://data.sec.gov/submissions/CIK{cik}.json` | `:1585` — only when EFTS returns no hit | symbol |
| filing index | `https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/index.json` | `:1618` | symbol |
| primary document | the `.htm` the index names | `:1671`; text sliced `text.slice(2000, 17000)` `:1764` | symbol |
| EFTS 8-K search | `https://efts.sec.gov/LATEST/search-index?q="SYM"&forms=8-K` (30-day window) | `:2546` `fetchSECEdgar8KScan` (`pipeline.ts:1078`) | symbol |

Two User-Agent strings are sent: `TempleStuart/1.0 (astuart@templestuart.com)` (`:872`) and
`TempleStudart/1.0 (temple-stuart-accounting; contact@example.com)` (`:2549`, a typo and a
placeholder domain) — C. `fetchSECForm4Data` (`:1238`, submissions → Form 4 XML `:1256`, `:1320`) is
**not called by the pipeline**: `secForm4Map` is filled from Finnhub `stock/insider-transactions`
(`pipeline.ts:982-983`) — C.

### 1.4 TastyTrade — account access, not metered (feedCost.ts `TT_ACCOUNT`)

| Call | SDK / transport | Site (C) | Per |
|---|---|---|---|
| market-metrics | `marketMetricsService.getMarketMetrics({ symbols })`, REST | `pipeline.ts:424`, batches of 50 (`:253`) | 1 per 50 symbols |
| nested option chain | `instrumentsService.getNestedOptionChain(symbol)`, REST | `chain-fetcher.ts:166` | 1 per surviving symbol |
| Greeks · Quote · Trade · Summary | DXLink WebSocket, one socket, all streamer symbols | `chain-fetcher.ts:313-315` (`subscribe`), events `:283-305` | per option streamer symbol |
| daily candles | `quoteStreamer.subscribeCandles(sym, fromTime, 1, CandleType.Day)` | `data-fetchers.ts:2298` `fetchTTCandlesBatch` (`pipeline.ts:1271`, 90 days) | per scored symbol |

The SDK types market-metrics as `Promise<any>` (`node_modules/@tastytrade/api/dist/services/market-metrics-service.d.ts:5`,
read by the research pass) — no field list exists in the repo; the returned list in §2.4 is V.

### 1.5 Other

| Provider | Call | Site (C) | Per |
|---|---|---|---|
| Nasdaq Trader | `https://www.nasdaqtrader.com/dynamic/symdir/regsho/nasdaqth.txt` (Reg SHO threshold list) | `pipeline.ts:351` `fetchRegShoThreshold` → hard filter 6 `:2271` | scan |

### 1.6 The observatory and the background jobs

- **Observatory** (`src/app/api/data-observatory/check/route.ts`, 1,202 lines): 32 feed rows
  (`feedCost.ts:112` `EXPECTED_FEED_COUNT`), each a probe function (`route.ts:136-918`). Since
  PIPE-01 the Finnhub probes run through the same fetchers and store as the scan (`feedCost.ts:69-87`);
  where a probe asks different params it is its own store row (`:75`, `:76`, `:78`, `:79`, `:80`).
  One label drift (C): feed 19 is titled "FRED Macro (14 series)" (`route.ts:582`) while the code pulls
  24 series (§1.2).
- **Background jobs**: the only cron route is `src/app/api/cron/auto-categorize` and no file under
  `src/app/api/cron`, `src/inngest`, `src/lib/inngest` or `src/lib/cron` references finnhub.io,
  stlouisfed, sec.gov or tastytrade (grep, this session) — no job calls a scanner provider. C.

---

## 2. Returned / parsed / scored — per endpoint

Three columns per endpoint. **Returned** = every field the vendor documents (V) and every key the
vendor's sample carries (S). **Parsed** = what the fetcher copies out (C). **Scored** = what a gate,
a modifier or a filter reads on the way to the composite (C; §4 has the weights). **Not read** =
returned but neither parsed nor scored, or parsed and then ignored. The parsed-shape interfaces live in
`src/lib/convergence/types.ts` (line cited per row).

### 2.1 Finnhub

| # | Endpoint | Returned (V + S) | Parsed (C) | Scored (C) | Not read | Prov. |
|---|---|---|---|---|---|---|
| 1 | `stock/metric` | `{ metric: MetricMap, metricType, series: { annual, quarterly }: MetricSeriesMap, symbol }`; the map is undocumented ("`all`" — docs); the sample shows 6 keys: `10DayAverageTradingVolume`, `52WeekHigh`, `52WeekLow`, `52WeekLowDate`, `52WeekPriceReturnDaily`, `beta`; `series.annual` holds per-period `[{period, v}]` histories of every ratio | the whole `metric` map, uncounted (`data-fetchers.ts:219-220`, `types.ts:44` `FinnhubFundamentals { metric, fieldCount }`) | 23 keys: `beta` `:88` (only if TT beta is null), `totalDebt/totalEquityQuarterly` `:100`, `currentRatioQuarterly` `:317`, `operatingMarginTTM` `:327`, `assetTurnoverTTM` `:336`, `roeTTM` `:208`, `roaTTM` `:209`, `freeCashFlowPerShareTTM` `:210`, `netIncomePerShareTTM` `:211`, `grossMarginTTM` `:510`, `peNormalizedAnnual` `:580`, `psTTM`/`psAnnual` `:593-594`, `evEbitdaTTM`/`evEbitdaAnnual` `:609-610`, `marketCapitalization`/`shareOutstanding` `:637`, `revenueGrowthTTMYoy` `:870`, `epsGrowthTTMYoy` `:881`, `dividendGrowthRate5Y` `:892` (all `quality-gate.ts`); `52WeekHigh`/`52WeekLow` (`vol-edge.ts:729-730`, and the progress payload `pipeline.ts:1145-1146`) | the entire `series` block; every `metric` key beyond the 23 — the docs do not enumerate the map, so the unread set cannot be closed from here (**NV**: `10DayAverageTradingVolume` and `52WeekPriceReturnDaily` are in the sample and unread) | V, S, C |
| 2 | `stock/recommendation` | `[{ buy, hold, period, sell, strongBuy, strongSell, symbol }]` | the array as-is (`:229`, cast, no per-field check; `types.ts:70`) | `buy`, `hold`, `sell`, `strongBuy`, `strongSell`, `period` of `[0]` and `[1]` (`info-edge.ts` latest/prior) | `symbol` | V, S, C |
| 3 | `stock/insider-sentiment` | `{ data: [{ change, month, mspr, symbol, year }], symbol }` | the array as-is (`:239`; `types.ts:79`) | `mspr` (`info-edge.ts:491`, `quality-gate.ts:1146` ±5 modifier), `change`, `year`, `month` (ordering) | `symbol` | V, S, C |
| 4 | `stock/earnings` | `[{ actual, estimate, period, quarter, surprise, surprisePercent, symbol, year }]` | the array as-is (`:248`; `types.ts:87`) | `surprisePercent`, `period` (`info-edge.ts` SUE streak `:636-648`; `quality-gate.ts` beat rate `:706`, predictability `:1028`), `actual`/`estimate` (progress payload `pipeline.ts:1111`) | `surprise`, `quarter`, `year`, `symbol` | V, S, C |
| 5 | `stock/eps-estimate` | `{ data: [{ epsAvg, epsHigh, epsLow, numberAnalysts, period, quarter, year }], freq, symbol }` | `data` as-is (`:138`, cast) | `epsAvg`, `epsHigh`, `epsLow`, `numberAnalysts`, `period` (`info-edge.ts:62-94`) | `quarter`, `year`, `freq` | V, S, C |
| 6 | `stock/revenue-estimate` | `{ data: [{ numberAnalysts, period, quarter, revenueAvg, revenueHigh, revenueLow, year }], freq, symbol }` | `data` as-is (`:145`) | `revenueAvg`, `period` (next vs trailing) | `revenueHigh`, `revenueLow`, `numberAnalysts`, `quarter`, `year` | V, S, C |
| 7 | `stock/price-target` | `{ lastUpdated, numberAnalysts, symbol, targetHigh, targetLow, targetMean, targetMedian }` | the object when `targetMedian` is a number (`:152-153`) | `targetMedian`, `targetMean`, `targetHigh`, `targetLow`, `numberAnalysts` against the latest candle close (`info-edge.ts:225-226`) — **pass 1 has no candles, so this sub-score is null until the F2 re-score** | `lastUpdated` (the docs' own freshness stamp is never checked) | V, S, C |
| 8 | `stock/upgrade-downgrade` | `[{ action, company, fromGrade, gradeTime, symbol, toGrade }]` | the array as-is (`:161`) | `gradeTime`, `action`, `toGrade` (`info-edge.ts:367-420`, 90-day decay) | `fromGrade`, `company`, `symbol` | V, S, C |
| 9 | `stock/financials-reported` | `{ cik, data: [{ accessNumber, symbol, cik, year, quarter, form, startDate, endDate, filedDate, acceptedDate, report: { bs, cf, ic } }], symbol }`; `report.*` is `ReportDataMap` (untyped); the sample shows each statement as a **map** `{ "Assets": …, "GrossProfit": … }` | 19 concepts via `findConcept` (`:343-368`), which expects each statement as an **array** of `{ concept, value }` (`:332`): revenue (4 tag names), grossProfit, netIncome, operatingIncome, incomeTaxExpense, preTaxIncome (2), weightedAvgShares (2), totalAssets, currentAssets, currentLiabilities, stockholdersEquity, longTermDebt (2), longTermDebtCurrent, longTermDebtNoncurrent, cashAndEquivalents (2), sharesOutstanding (2), operatingCashFlow (2), capitalExpenditure (3); needs ≥ 2 reports (`:387`) (`types.ts:186`) | ROIC (`quality-gate.ts:544-566`), FCF yield (`:624-636`), the Piotroski annual fallback (`:216-250`), cash-flow stability fallback (`:995-996`) | `accessNumber`, `form`, `startDate`, `endDate`, `filedDate`, `acceptedDate`, `quarter`, and every concept not in the 19 — **and, if the live shape is the map the docs show, everything** (§3 P6) | V, S, C; live shape **NV** |
| 10 | `stock/financials` (bs · ic · cf) | `{ financials: FinancialMap[], symbol }`; the map is undocumented; the one sample is an **ic** row: `costOfGoodsSold, ebit, grossIncome, interestExpense, netIncome, netIncomeAfterTaxes, period, pretaxIncome, provisionforIncomeTaxes, researchDevelopment, revenue, sgaExpense, totalOperatingExpense, year`; no bs or cf sample exists | per quarter (`:440-545`, `types.ts:215`): bs `totalAssets`, `totalCurrentAssets\|currentAssets`, `totalCurrentLiabilities\|currentLiabilities`, `totalLiabilities`, `totalStockholderEquity\|stockholdersEquity\|totalEquity`, `retainedEarnings`, `longTermDebt\|longTermDebtNoncurrent`, `cashAndCashEquivalents\|cashAndShortTermInvestments\|cash`, `totalDebt\|netDebt`, `commonStockSharesOutstanding\|sharesOutstanding`; ic `revenue\|totalRevenue\|netRevenue`, `netIncome\|netIncomeLoss`, `operatingIncome\|operatingIncomeLoss`, `ebit\|operatingIncome\|operatingIncomeLoss`, **`grossProfit`**; cf `netCashProvidedByOperatingActivities\|operatingCashflow\|cashFromOperatingActivities`, `capitalExpenditure\|capitalExpenditures\|purchaseOfPropertyPlantAndEquipment` | Piotroski (`quality-gate.ts:136-205`: netIncome, totalAssets, operatingCashFlow, longTermDebt, current assets/liabilities, sharesOutstanding, grossProfit, revenue), Altman (`:285-318`: workingCapital, retainedEarnings, totalAssets, totalLiabilities), cash-flow stability (`:948-990`: operatingCashFlow, freeCashFlow) | on the ic row the vendor sends: `grossIncome` (the parser asks `grossProfit` — §3 P5), `costOfGoodsSold`, `interestExpense`, `pretaxIncome`, `provisionforIncomeTaxes`, `researchDevelopment`, `sgaExpense`, `totalOperatingExpense`, `netIncomeAfterTaxes`; the bs and cf key names the parser tries are **NV** against any vendor row | V, S, C; bs/cf **NV** |
| 11 | `stock/insider-transactions` | `{ data: [{ change, filingDate, name, share, symbol, transactionCode, transactionDate, transactionPrice }], symbol }`; the docs cap a response at 100 transactions (V) | `name`, `share`, `change`, `filingDate`, `transactionDate`, `transactionCode`, `transactionPrice` (`:1050-1100`), aggregated into `SECForm4Data` (`types.ts:359`): buy/sell counts and dollar values, `netDollarFlow`, `uniqueFilers`, `opportunisticScore`, `officerBuyCount` **always 0** (`:1103`, `:1159`, `:1174` — "Finnhub doesn't provide role data") | `netDollarFlow`, `totalBuyCount`, `totalSellCount`, `opportunisticScore`, `officerBuyCount` (`info-edge.ts:532-576`) | `symbol`; the 100-transaction cap is not paged (no `to`/pagination sent — C `:1041`) | V, S, C |
| 12 | `stock/peers` | `[string]` (tickers) | the array (`:1206-1225`) | peer-group membership → `sector-stats.ts` z-stats (iv_percentile, iv_hv_spread, hv30/60/90, hv_accel, iv30, pe_ratio, market_cap, beta, corr_spy, dividend_yield, eps, term_structure_slope — `:121-134`) | — | V, S, C |
| 13 | `stock/ownership` | `{ ownership: [{ change, filingDate, name, share }], symbol }` | `share`, `change`, `filingDate` summed per holder (`:1855-1871`; `types.ts:403`: totalInstitutionalShares, totalInstitutionalChange, topHolderCount, netBuyerCount, netSellerCount, latestFilingDate) | `totalInstitutionalChange`, `netBuyerCount`, `netSellerCount`, `topHolderCount` (`info-edge.ts:1199`), `latestFilingDate` (`:1101`) | `name` (the holder identity is dropped) | V, S, C |
| 14 | `stock/fund-ownership` | `{ ownership: [{ change, filingDate, name, portfolioPercent, share }], symbol }` | Step E6: the same aggregation as row 13; Step I5 (`:2508-2532`, `types.ts:1426`): `name`, `share`, `change`, `filingDate` per fund, `totalFunds` | `funds[].change` net (`info-edge.ts:1385-1398`, weight 0.05) | `portfolioPercent` | V, S, C |
| 15 | `stock/revenue-breakdown2` | `{ currency, data: { annual: { revenue_by_geography, revenue_by_product }, quarterly: {…} }, symbol }`; each `revenue_by_*` is an **array of arrays** of `{ label, data: [{ period, value }] }` | three shape cases, **none of which is the vendor's** (`:1890-1982`; `types.ts:414` segments/totalRevenue/hhi) | HHI modifier (`quality-gate.ts:409-431`) — **never reached** (§3 P2) | everything: every `label`, `period`, `value`, by product and by geography, annual and quarterly | V, S, F, C |
| 16 | `news-sentiment` | `{ buzz: { articlesInLastWeek, buzz, weeklyAverage }, companyNewsScore, sectorAverageBullishPercent, sectorAverageNewsScore, sentiment: { bearishPercent, bullishPercent }, symbol }` | `companyNewsScore`, `sectorAverageNewsScore`, `sectorAverageBullishPercent`, `buzz.buzz`, `sentiment.bullishPercent`, `sentiment.bearishPercent` (`:1995-2026`; `types.ts:422`) | `companyNewsScore`, `sectorAverageNewsScore`, `buzz` (`info-edge.ts:959-1010`) | `articlesInLastWeek`, `weeklyAverage`; `bullishPercent`/`bearishPercent`/`sectorAverageBullishPercent` are parsed and not scored | V, S, C |
| 17 | `stock/earnings-quality-score` | `{ data: [{ cashGenerationCapitalAllocation (definition) / capitalAllocation (sample — the docs contradict themselves), growth, letterScore, leverage, period, profitability, score }], freq, symbol }` | newest `period`: `score`, `letterScore` (`'N/A'` when absent — `:2061`) (`types.ts:326`) | `score` vs the SUE composite (`quality-gate.ts:736-771`, ±0.15 / −0.20 confidence modifier); `letterScore` (progress payload) | `growth`, `leverage`, `profitability`, `cashGenerationCapitalAllocation` — the four sub-scores the vendor's model exposes | V, S, C |
| 18 | `company-news` (×2) | `[{ category, datetime, headline, id, image, related, source, summary, url }]` | `headline`, `source`, `datetime` (`\|\| 0` — `:2140`), `url` (`:2110-2165`); classified by keyword (`:803` `classifyHeadline`; the Claude classifier is "no longer used" `:47`) (`types.ts:307`) | `buzz_ratio`, `sentiment_7d`, `sentiment_momentum`, `tier1_ratio`, `articles_7d` … (`info-edge.ts:908-1010`) | `summary` (the article body is never classified), `category`, `related`, `image`, `id` | V, S, C |
| 19 | `stock/ebitda-estimate` | `{ data: [{ ebitdaAvg, ebitdaHigh, ebitdaLow, numberAnalysts, period, quarter, year }], freq, symbol }` | `ebitdaAvg/High/Low`, `numberAnalysts`, `period` (`:2364-2383`; `types.ts:1374`) | **nothing** — the progress payload only (`pipeline.ts:1139-1140`) | all of it, after parsing | V, S, C |
| 20 | `stock/ebit-estimate` | `{ data: [{ ebitAvg, ebitHigh, ebitLow, numberAnalysts, period, quarter, year }], freq, symbol }` | `ebitAvg/High/Low`, `numberAnalysts`, `period` (`:2394-2412`; `types.ts:1387`) | **nothing** — the progress payload only (`pipeline.ts:1141-1142`) | all of it | V, S, C |
| 21 | `stock/dividend` | `[{ adjustedAmount, amount, currency, date (ex-dividend date — docs), declarationDate, freq, payDate, recordDate, symbol }]` | `date`, `amount`, `adjustedAmount`, `currency`, `payDate`, **`exDate` (does not exist)** (`:2435-2440`; `types.ts:1401`) | **nothing** — the progress payload only (`dividend_count`, `next_ex_date` `pipeline.ts:1143-1144`); no gate reads dividends (growth's dividend leg reads `metric.dividendGrowthRate5Y`) | `declarationDate`, `recordDate`, `freq`; `next_ex_date` is always null (§3 P4) | V, S, C |
| 22 | `stock/price-metric` | `{ atDate, data: PriceMetricMap, symbol }`; the sample's `data`: `5DayEMA, 10DayEMA, 10DaySMA, 50DayEMA, 50DaySMA, 100DayEMA, 100DaySMA, 14DayRSI, 10DayAverageTradingVolume, 1MonthHigh, 1MonthHighDate, 52WeekHigh, 52WeekHighDate, 52WeekLow, 52WeekLowDate, ytdPriceReturn` ("52-week high/low, YTD return and much more" — docs) | reads `json.metric` — a key the vendor never sends (`:2470`); copies `52WeekHigh/Low(+Date)` and `priceRelativeToSMA10…200`, keys the vendor never sends either (`types.ts:1406`) | **nothing**: `priceMetricsMap` is set (`pipeline.ts:1055`) and read by no consumer (`:846`, `:1055` are its only references) | **everything, twice over**: the parser gets `{}` (§3 P1) and even a correct parse would go unread | V, S, F, C |
| 23 | `calendar/earnings` | `{ earningsCalendar: [{ date, epsActual, epsEstimate, hour, quarter, revenueActual, revenueEstimate, symbol, year }] }` | all nine fields (`:2595-2614`; `types.ts:1457`) | **nothing** — the progress payload only (`earnings_calendar_count`, `next_earnings_date` `pipeline.ts:1151-1152`); the earnings-date filter and DTE score read TastyTrade's `earnings.expected-report-date` instead (`pipeline.ts:263-264`) | all of it, after parsing | V, S, C |

### 2.2 FRED

Returned per observation (V — `https://fred.stlouisfed.org/docs/api/fred/series_observations.html`):
`realtime_start, realtime_end, date, value` inside `observations[]`, with top-level `realtime_start,
realtime_end, observation_start, observation_end, units, output_type, file_type, order_by, sort_order,
count, offset, limit`. Parsed (C, `:623-635`): `observations[0].value` (skipped when `'.'`),
`observations[0].date` only for ICSA and NFCI (`trackDate`); PAYEMS `[0]−[1]` (`:649-660`);
CPIAUCSL `[0]/[12]−1` and `[0]/[1]−1` (`:669-695`); daily history `date`,`value` for the three
cross-asset series (`:716+`). Not read: `realtime_*` (vintage) on every series; the observation `date`
on 17 of 19 series (staleness is unknown for them). Scored — see §4.4 for the field → weight map.

| Series | Parsed into (C `types.ts:148`) | Scored? (C `regime.ts`) |
|---|---|---|
| VIXCLS | `vix` | yes — VIX/VIX3M ratio `:661-665` |
| VXVCLS | `vxvShortTerm` | yes — same ratio |
| VVIXCLS | `vvix` | **wired (`:659`, weight 0.10 `:839`) but the series does not exist — always null** |
| DGS10 | `treasury10y` | yes — inflation 0.15 `:283`; vol-edge GEX risk-free rate `vol-edge.ts:1016-1027` |
| FEDFUNDS | `fedFunds` | yes — inflation 0.15 `:282` |
| UNRATE | `unemployment` | yes — growth 0.20 `:252` |
| A191RL1Q225SBEA | `gdp` | yes — growth 0.25 `:251` |
| UMCSENT | `consumerConfidence` | yes — growth 0.15 `:254` |
| T10Y2Y | `yieldCurveSpread` | modifier only (inversion factor `:331-333`) |
| T5YIE | `breakeven5y` | yes — inflation 0.20 `:284` |
| BAMLH0A0HYM2 | `hySpread` | modifier only (stress factor `:342-345`; CRISIS override `composite.ts:62-64`) |
| NFCI | `nfci` (+ `nfciDate`) | yes — growth 0.10 `:256` |
| ICSA | `initialClaims` (+ `initialClaimsDate`) | yes — growth 0.10 `:255` |
| PAYEMS | `nonfarmPayrolls` | yes — growth 0.20 `:253` |
| CPIAUCSL | `cpi`, `cpiMom` | yes — inflation 0.30 + 0.20 `:280-281` |
| WALCL, WTREGEN, RRPONTSYD | `fedBalanceSheet`, `treasuryGeneralAccount`, `overnightReverseRepo` | **no** — "audit-only breakdown, not wired into composite score" (`:651`, `computeAncillarySignals` `:582-640`) |
| BAMLC0A4CBBB | `bbbSpread` | **no** — ancillary `:590-596` |
| T10Y3M | `t10y3m` | **no** — ancillary `:599-605` |
| DTWEXBGS | `dollarIndex` | **no** — ancillary `:610` |
| DGS10 · SP500 · DCOILWTICO (daily) | `crossAssetCorrelations` (`cross-asset.ts:140-142`, 60- and 252-day pairs `:156`) | modifier only — ±10 % max (`regime.ts:490` `MAX_CORR_ADJUSTMENT`, `:796-799`) |

### 2.3 SEC EDGAR

| Call | Returned (V / P) | Parsed (C) | Scored (C) | Not read | Prov. |
|---|---|---|---|---|---|
| companyfacts | `{ cik, entityName, facts: { dei: {Tag…}, 'us-gaap': { Tag: { label, description, units: { USD \| shares \| 'USD/shares': [{ start, end, val, accn, fy, fp, form, filed, frame }] } } } } }` (V — `https://www.sec.gov/search-filings/edgar-application-programming-interfaces`) | `us-gaap` `EarningsPerShareDiluted\|Basic`, `Revenues\|RevenueFromContractWithCustomer(Excl\|Incl)udingAssessedTax\|RevenueNet`, `NetIncomeLoss` → newest 10-Q/10-K unit by `filed` (`:958-1002`); `filed`, `fy`, `fp`, `form` → `SECFilingData` (`types.ts:333`: cik, latestFilingDate, latestFilingType, filingAgeHours, epsActual, revenueActual, netIncomeActual, fiscalPeriod) | `filingAgeHours`, `latestFilingType` — the filing-recency overlay (`info-edge.ts:1071-1085`; **score 50 when missing or older than 72 h**); `epsActual`, `revenueActual` appear in the trace only | `dei` is read (`:958`) and never used; every other us-gaap tag; `accn`, `frame`, `start`, `end`; 20-F / 40-F filers are filtered out (`'10-Q'`/`'10-K'` only) | V, C |
| EFTS 10-K search | `hits.total.value`, `hits.hits[]._id` (`"<adsh>:<file>"`), `_source: { adsh, biz_locations, biz_states, ciks, display_names, file_date, file_description, file_num, file_type, film_num, form, inc_states, items, period_ending, root_forms, sequence, sics, xsl }` (P — one query, `q="AAPL"&forms=10-K`) | `_source.file_num \|\| _id`, `_source.file_date` (`:1578-1579`) | nothing directly; feeds the 10-K text → `textPeerGroups` (`sector-stats.ts` `text_nlp`) | **`file_num` is an array of SEC file numbers (`['001-36743']`), not the accession** — §3 S1; `adsh` (the real accession) is never read; no CIK filter is sent, so a ticker string can match another filer (P: the 8-K probe's first hit was an unrelated registrant) | P, C |
| submissions | `filings.recent.{ accessionNumber[], filingDate[], reportDate[], form[], items[], primaryDocument[], … }` and `filings.files[]` (older pages) (V) | `form`, `accessionNumber`, `filingDate` of the first `10-K`/`10-K/A` (`:1600-1606`) — only when EFTS returned no hit | — | `items`, `primaryDocument` (which would skip the index.json hop), `filings.files` is never paged | V, C |
| index.json · primary doc | directory listing; the filing's HTML | the largest `.htm` by `size` (`:1643`); `text.slice(2000, 17000)` (`:1764`) | text peers | the rest of the document; Item 1 is located by character offset, not by heading | C |
| EFTS 8-K search | as the 10-K row (P — `q="AAPL"&forms=8-K`; `_source.items` observed `["2.02","9.01"]`) | `hits.total.value` → `totalHits`; `file_date\|filed_at`; **`form_type`, `display_description`, `entity_name` — keys that do not exist in `_source`** (`:2558-2566`; `types.ts:1439`) | `totalHits` only (`info-edge.ts:1407-1413`, weight 0.05; progress `pipeline.ts:1149-1150`) | `items` (the 8-K item codes — 2.02 earnings vs 5.02 officer change vs 1.01/8.01), `display_names`, `file_description`, `period_ending`; `formType` is always the literal `'8-K'` and `description`/`entityName` always null | P, C |
| Form 4 XML | (dead code — `fetchSECForm4Data :1238` is not called) | — | — | — | C |

### 2.4 TastyTrade

**market-metrics.** Returned (V — the official reference
`https://developer.tastytrade.com/reference/market-metrics/getMarketMetricsIndex/` and the
tastyware Python model `https://raw.githubusercontent.com/tastyware/tastytrade/master/tastytrade/metrics.py`
lines 27-113, read by the research pass; the live shape is **NV** — no TastyTrade call was made):
`symbol, implied-volatility-index, implied-volatility-index-5-day-change, implied-volatility-index-rank,
tos-implied-volatility-index-rank, tw-implied-volatility-index-rank, implied-volatility-index-rank-source,
tos-implied-volatility-index-rank-updated-at, implied-volatility-percentile, implied-volatility-updated-at,
liquidity-value, liquidity-rank, liquidity-rating, liquidity-running-state { sum, count, started-at, updated-at },
beta, beta-updated-at, corr-spy-3month, market-cap, dividend-rate-per-share, dividend-yield, dividend-ex-date,
dividend-next-date, dividend-pay-date, dividend-updated-at, earnings { actual-eps, consensus-estimate,
estimated, late-flag, visible, quarter-end-date, expected-report-date, time-of-day, updated-at },
historical-volatility-30-day / -60-day / -90-day, implied-volatility-30-day, iv-hv-30-day-difference,
price-earnings-ratio, earnings-per-share, lendability, borrow-rate, listed-market, updated-at, created-at,
option-expiration-implied-volatilities[] { expiration-date, settlement-type, option-chain-type, implied-volatility }`.
The reference names `implied-volatility-rank` and `liquidity` where the model and the scan use
`implied-volatility-index-rank` and `liquidity-value`; `sector` and `industry`, which the scan maps,
appear in neither source (V).

| Field (V) | Parsed as (C `pipeline.ts:259-329` → `types.ts` `TTScannerData`) | Read by (C) |
|---|---|---|
| `implied-volatility-index-rank` \| `tos-…` \| `tw-…` | `ivRank` (`:284-286`) | vol-edge ivr 0.40 of the IV composite (`vol-edge.ts:366`); pre-filter payload |
| `implied-volatility-percentile` | `ivPercentile` (`:288`) | pre-score 0.40 (`pipeline.ts:2319`); vol-edge ivp 0.60 (`:365`); peer z |
| `implied-volatility-index` | `impliedVolatility` (`:289`) | **no gate** — the Step A payload only (`:457`) |
| `liquidity-rating` | `liquidityRating` (`:290`) | pre-filter (`:517` `< 2` excluded), pre-score 0.30 (`:2321`), hard filter 2 (`:2152`), safety 0.25 (`quality-gate.ts:42`, `:377`) |
| `earnings.expected-report-date` \| `next-earnings-date` | `earningsDate`, `daysTillEarnings` (`:263-264`) | hard filter 5 (`:2243`), EQ dte 0.30 (`quality-gate.ts:714-720`), term structure (`vol-edge.ts:465`) |
| `historical-volatility-30/60/90-day` | `hv30`, `hv60`, `hv90` (`:293-295`) | vol-edge hv_accel, VRP; peer z |
| `implied-volatility-30-day` | `iv30` (`:296`) | hard filter 3 (`:2181`), VRP, IV/HV; peer z |
| `iv-hv-30-day-difference` | `ivHvSpread` (`:297`) | pre-score 0.30 (`:2320`), vol-edge iv_hv_spread 0.25 (`:381`) |
| `beta` | `beta` (`:298`) | safety 0.10 (`quality-gate.ts:88`) |
| `corr-spy-3month` | `corrSpy` (`:299`) | regime multiplier (`regime.ts:852`, floor 0.10) |
| `market-cap` | `marketCap` (`:300`) | hard filter 1 (`:2122`), safety 0.15 (`quality-gate.ts:50`), Altman market value (`:309`) |
| `sector`, `industry` | `sector`, `industry` (`:301-302`) | peer grouping only (`sector-stats.ts` gics_sector / gics_industry) |
| `price-earnings-ratio`, `earnings-per-share`, `dividend-yield` | `peRatio`, `eps`, `dividendYield` (`:303-305`) | peer z-stats only (`sector-stats.ts:128`, `:132-133`); `dividendYield` also the card (`strategy-builder.ts`) |
| `lendability`, `borrow-rate` | `lendability`, `borrowRate` (`:306-307`) | safety 0.10 (`quality-gate.ts:74-84`); hard filter 4 (`:2215`); borrow penalty `min(20, (borrowRate ?? 0) × 0.8)` (`:399` — **a missing rate is silently 0**) |
| `earnings.actual-eps`, `earnings.consensus-estimate`, `earnings.time-of-day` | `earningsActualEps`, `earningsEstimate`, `earningsTimeOfDay` (`:309-317`) | **no gate** — the Step A payload only (`:476-478`) |
| `option-expiration-implied-volatilities[].expiration-date`, `.implied-volatility` | `termStructure` (`:319-325`) | vol-edge term_structure 0.25 (`vol-edge.ts:464`) |
| `implied-volatility-index-5-day-change`, `implied-volatility-updated-at`, `*-updated-at`, `liquidity-value`, `liquidity-rank`, `liquidity-running-state`, `dividend-rate-per-share`, `dividend-ex-date`, `dividend-next-date`, `dividend-pay-date`, `earnings.estimated`, `.late-flag`, `.visible`, `.quarter-end-date`, `listed-market`, `[].settlement-type`, `[].option-chain-type` | **not mapped** (grep of `src/` and `scripts/` for each name: no reader) | — |

**Nested option chain** (`chain-fetcher.ts:166-250`, C): parsed `expirations[]` → `expiration-date`,
`strikes[]` → `strike-price`, `call`, `put`, `call-streamer-symbol`, `put-streamer-symbol`. Not read
(V — the instruments reference, NV live): `deliverables`, `shares-per-contract`, `tick-sizes`,
`settlement-type`, `option-chain-type`, `expiration-type`, `root-symbol`, `days-to-expiration`
(the scan recomputes DTE itself).

**DXLink events** (C `chain-fetcher.ts:283-305`): Greeks → `volatility, delta, gamma, theta, vega,
rho, price`; Quote → `bidPrice, askPrice, bidSize, askSize`; Trade → `dayVolume | volume`;
Summary → `openInterest`. The gates read `strike, callIV, putIV, callOI, putOI` (`vol-edge.ts`
skew `:812-813`, GEX `:995-1027`) and the volumes (`chain-fetcher.ts:483-545` → `put_call_ratio`,
`volume_bias`, `unusual_activity_ratio`, `total_*_oi` → `info-edge.ts:796-880`); the Greeks and
quotes reach the card builder, not the gates. Not read (V — dxFeed event schema, NV): Quote
`bidTime, askTime, bidExchangeCode, askExchangeCode`; Summary `dayOpenPrice, dayHighPrice,
dayLowPrice, dayClosePrice, prevDayClosePrice, prevDayVolume`; Trade `price, size, time`.
**Candles** (C `data-fetchers.ts:2256-2273`): parsed `time, open, high, low, close, volume`; not
read (V dxFeed Candle): `vwap, bidVolume, askVolume, impVolatility, openInterest, count`.

---

## 3. Parsers that fail or discard on a real payload

**Method.** Every Finnhub parser in `src/lib/convergence/data-fetchers.ts` was run in this
environment against the vendor's own sample for its endpoint (Appendix B). `fetch` was stubbed to
serve the sample for the path requested; the real cache helper wrote the real `finnhub_responses`
table on a throwaway Postgres; nothing left the machine. Five of the 23 samples are not valid JSON
as published (trailing commas, a missing comma in `ebit-estimate`, an elided `...` in
`financials-reported`) and were repaired mechanically first. Where the founder's run log (F) and
the sample (S) agree, the row says so.

| # | Parser | Endpoint | The parser expects | The vendor sends (V + S) | Outcome | Fields lost | Prov. |
|---|---|---|---|---|---|---|---|
| **P1** | `fetchFinnhubPriceMetrics` `:2452-2492` | `stock/price-metric` | `json.metric[…]` (`:2470` `const m = json?.metric ?? {}`), then keys `priceRelativeToSMA10…200` | `{ atDate, data: { 5DayEMA, 10DayEMA, 10DaySMA, 50DayEMA, 50DaySMA, 100DayEMA, 100DaySMA, 14DayRSI, 10DayAverageTradingVolume, 1MonthHigh(+Date), 52WeekHigh(+Date), 52WeekLow(+Date), ytdPriceReturn, … }, symbol }` | `m = {}` → every parsed field null, `error: null` — the founder's `[PriceMetric] AAPL {}` beside a full RAW payload is this line | **all of them**, plus `atDate` | S, F, C |
| **P2** | `fetchFinnhubRevenueBreakdown` `:1890-1982` | `stock/revenue-breakdown2` | case A: `data` as `{ segment: number }`; case B: `{ period: { segment: number } }`; case C: `{ segment: [{ period, v }] }` | `data.{annual\|quarterly}.{revenue_by_product\|revenue_by_geography}` = array of arrays of `{ label, data: [{ period, value }] }` | case B fires on the keys `annual`/`quarterly`, picks `quarterly`, `Number(array)` is NaN for every entry → `"revenue-breakdown2: no positive revenue segments"` (`:1961`) — the founder saw it on all 10 symbols. The observatory's probe reads the real shape (`check/route.ts:355-360` `annual.revenue_by_product`, "array of arrays — flatten one level"): two readers of one endpoint, one of them right | **every segment**: every `label`, `period`, `value`, by product and geography, annual and quarterly → the HHI safety modifier never fires | S, F, C |
| **P3** | `fetchFinnhubDividendHistory` `:2415-2448` | `stock/dividend` | a non-empty array; `JSON.stringify(raw[0]).slice(0, 200)` (`:2443`) | an array — **empty for a non-payer** | `JSON.stringify(undefined)` is `undefined` → throws `Cannot read properties of undefined (reading 'slice')`, caught and declared `dividend BRK.B: …` — the founder's "crashes on non-payers" (reproduced with a synthetic `[]`; the vendor publishes no non-payer sample) | the honest answer "no dividends" (an empty history is data; the parser reports an error instead) | S (synthetic), F, C |
| **P4** | `fetchFinnhubDividendHistory` `:2439` | `stock/dividend` | `exDate` | the ex-dividend date is `date` ("Ex-Dividend date." — definition `Dividends`); no `exDate` exists | `exDate: null` on every row of the vendor's payer sample → `next_ex_date` (`pipeline.ts:1144` `dividends[0].exDate`) is always null | `date` as the ex-date; `declarationDate`, `recordDate`, `freq` never read | S, V, C |
| **P5** | `fetchQuarterlyFinancials` `:408-545` | `stock/financials` (ic) | `num(ic, 'grossProfit')` (`:521`); `num(ic, 'operatingIncome', 'operatingIncomeLoss')` | ic row keys `revenue, netIncome, ebit, grossIncome, costOfGoodsSold, interestExpense, netIncomeAfterTaxes, pretaxIncome, provisionforIncomeTaxes, researchDevelopment, sgaExpense, totalOperatingExpense, period, year` | `grossProfit: null`, `operatingIncome: null` while `revenue`, `netIncome`, `ebit` parse; the observatory probe reads `grossIncome` (`check/route.ts:512`), the scan reads `grossProfit` | `grossIncome` (→ Piotroski `gross_margin_expanding` is null on the quarterly path, `quality-gate.ts:193-198`), `costOfGoodsSold`, `interestExpense`, `pretaxIncome`, `provisionforIncomeTaxes`, `researchDevelopment`, `sgaExpense`, `totalOperatingExpense`, `netIncomeAfterTaxes`. **bs and cf: NV** — no vendor sample exists for either statement, so the ten bs keys and two cf key chains the parser tries (`:440-545`) are unverified against any row | S, C; bs/cf **NV** |
| **P6** | `fetchAnnualFinancials` → `parseAnnualReport` → `findConcept` `:332-368` | `stock/financials-reported` | `report.bs/ic/cf` as an **array** of `{ concept, value }` (`items.find(i => i.concept === name …)` `:332`) — the shape the admin test route and the observatory probe (`check/route.ts:481`) also assume | the sample shows `report.ic` as a **map** `{ "GrossProfit": …, "NetIncomeLoss": …, "OperatingExpenses": … }` (likewise `bs`, `cf`); `ReportDataMap` is untyped | not reached on the sample (one report → `"only 1 annual report(s) available"` `:387`); with the map shape `items.find` would throw and be declared | **unresolved — needs one captured row** (Appendix A, query 2). If the live shape is the array, nothing is lost; if it is the map the docs show, every annual concept is lost: ROIC 0.08, FCF 0.18, the Piotroski annual fallback, the cash-flow-stability fallback | S vs C; **NV** |
| **P7** | `fetchFinnhubTicker` `:217-220` | `stock/metric` | `json.metric` | `{ metric, metricType, series: { annual: { ratio: [{ period, v }] }, quarterly: {…} }, symbol }` | parses; `series` is never read | the entire `series` block (per-quarter and per-year history of every ratio) and every `metric` key beyond the 23 read (§2.1 row 1) | S, V, C |
| **S1** | `fetch10KBusinessDescription` `:1578` | SEC EFTS (10-K) | `_source.file_num` to be the accession string (`accessionNumber.replace(/-/g, '')` `:1615`) | `file_num` is an **array** of SEC file numbers (`['001-36743']`); the accession is `adsh` / the `_id` prefix | when EFTS returns a hit, `accessionNumber` is an array → `.replace` is not a function → thrown, caught, declared; the submissions fallback (`:1585`) runs only when EFTS returns **no** hit | the 10-K text → `textPeerGroups` (`sector-stats.ts` `text_nlp`) whenever EFTS finds the filing; one probe, **NV across symbols** | P, C |
| **S2** | `fetchSECEdgar8KScan` `:2558-2566` | SEC EFTS (8-K) | `_source.form_type`, `display_description`, `entity_name` | `_source` has `form`, `file_description`, `display_names`, `items`, … — none of the three | `formType` is always the literal `'8-K'`, `description` and `entityName` always null; only `totalHits` survives | the item codes (`items`) that would separate an earnings 8-K from an officer-change 8-K | P, C |

**Parsers that ran clean on the vendor sample (S):** `stock/recommendation`, `stock/insider-sentiment`,
`stock/earnings`, `stock/eps-estimate`, `stock/revenue-estimate`, `stock/price-target`,
`stock/upgrade-downgrade`, `stock/insider-transactions`, `stock/peers`, `stock/ownership` +
`stock/fund-ownership`, `news-sentiment`, `stock/earnings-quality-score`, `company-news` (both
windows), `stock/ebitda-estimate`, `stock/ebit-estimate`, `calendar/earnings`, and `stock/dividend`
on a payer (P4's `exDate` aside).

**Silent-on-2xx patterns worth naming (C):** the ticker-level arrays are cast, not validated
(`:229`, `:239`, `:248`, `:138`, `:145`, `:161` — a 200 with an unexpected shape becomes `[]` with no
declaration); `letterScore` becomes `'N/A'` (`:2061`); `datetime || 0` (`:2140`); `tx.change ?? 0`,
`tx.name ?? 'Unknown'`, `dollarValue ?? 0` (`:1064`, `:1081`, `:1115-1119`); `h.share ?? 0`,
`h.change ?? 0` (`:1855-1856`); `epsHigh − epsLow` with no null check (`info-edge.ts:94` — two
absent bounds read as zero dispersion → score 85); the SUE threshold falls to `2.0` under three
quarters (`info-edge.ts` `computeSurpriseThreshold`); the pre-score imputes 0 for a null
`ivPercentile`, `ivHvSpread` or `liquidityRating` (`pipeline.ts:2319-2321`); the filing-recency
overlay imputes 50 when the SEC row is missing (`info-edge.ts:1082`).

---

## 4. The composite's input map

For each of the four gates: every input, its weight, its source endpoint and field, and whether it
is present in the input that reaches the scorer. **Present?** is answered from the code and the
sample replay; where only the founder's live run can answer, the cell says NV. All line numbers are C.

### 4.1 Quality gate (`quality-gate.ts`) — sections safety 0.40 · profitability 0.30 · growth 0.15 · fundamentalRisk 0.15 (`:1115-1118`)

| Section · input | Weight | Source endpoint · field | Present? |
|---|---|---|---|
| safety · liquidity_rating | 0.25 (`:377`) | TT market-metrics `liquidity-rating` | yes — a null one is cut at the pre-filter (`pipeline.ts:517`) and hard filter 2 |
| safety · market_cap | 0.15 (`:378`) | TT `market-cap` | yes — hard filter 1 requires it |
| safety · volume | 0.15 (`:379`) | DXLink candles, 20-day mean (`:63-70`) | pass 1: **excluded** (`candles: []`, `pipeline.ts:1225`); pass 2: yes |
| safety · lendability | 0.10 (`:380`) | TT `lendability` | yes when TT sends it; excluded (not imputed) when absent (`:74-84`) |
| safety · beta | 0.10 (`:381`) | TT `beta`, else metric `beta` (`:88`) | yes |
| safety · debt_to_equity | 0.25 (`:382`) | metric `totalDebt/totalEquityQuarterly` (`:100`) | **NV** — not in the vendor's 6-key sample; the docs do not enumerate the map |
| safety · Altman Z cap (score ≤ 40 if Z < 1.8) | gate (`:389-392`) | quarterly bs `workingCapital`, `retainedEarnings`, `totalAssets`, `totalLiabilities` (`:285-318`); fallbacks metric `currentRatioQuarterly`, `operatingMarginTTM`, `assetTurnoverTTM`, `roaTTM`, TT `market-cap` | **NV** — bs keys unverified (P5) |
| safety · borrow-rate penalty | −min(20, rate × 0.8) (`:397-403`) | TT `borrow-rate` | yes; **a null rate is 0 penalty, silently** |
| safety · HHI modifier | ×0.85 … ×1.03 (`:419-431`) | `stock/revenue-breakdown2` → `hhi` | **never** — P2 (S + F). **Dead weight.** |
| profitability · gross_margin | 0.10 (`:779`) | metric `grossMarginTTM` (`:510`) | NV (map key not in sample) |
| profitability · roe | 0.10 | metric `roeTTM` (`:208`) | NV |
| profitability · roa | 0.07 | metric `roaTTM` (`:209`) | NV |
| profitability · roic | 0.08 (`:782`) | `stock/financials-reported` `operatingIncome, incomeTaxExpense, preTaxIncome, stockholdersEquity, longTermDebt(Current\|Noncurrent), cashAndEquivalents` (`:544-566`); **no fallback** | **conditional on P6** — dead if the live report is the map the docs show |
| profitability · pe_ratio | 0.10 | metric `peNormalizedAnnual` (`:580`) | NV |
| profitability · ps | 0.07 | metric `psTTM` → `psAnnual` (`:593-594`) | NV |
| profitability · ev_ebitda | 0.07 | metric `evEbitdaTTM` → `evEbitdaAnnual` (`:609-610`) | NV |
| profitability · fcf | 0.18 (`:786`) | `stock/financials-reported` `operatingCashFlow − \|capitalExpenditure\|` ÷ `weightedAvgShares` (`:624-636`) over price = metric `marketCapitalization` ÷ `shareOutstanding` (`:637`); **no fallback** | **conditional on P6** |
| profitability · earnings_quality | 0.23 (`:787`) | consistency 0.50 + dte 0.30 + beat_rate 0.20 (`:727-729`): `stock/earnings` `surprisePercent`; TT `daysTillEarnings` | yes (S) |
| profitability · EQ ensemble modifier | ±0.15 / −0.20 (`:736-771`) | `stock/earnings-quality-score` `score` | yes (S) |
| profitability · Piotroski change modifier | up to ±10 (`:255-271`) | quarterly (`:136-205`) then annual (`:216-250`) then metric proxies | partial: the quarterly `gross_margin_expanding` signal is null (P5); annual path conditional on P6 |
| growth · revenue | 0.40 (`:906`) | metric `revenueGrowthTTMYoy` (`:870`) | NV |
| growth · eps | 0.40 | metric `epsGrowthTTMYoy` (`:881`) | NV |
| growth · dividend | 0.20 | metric `dividendGrowthRate5Y` (`:892`) — **not** `stock/dividend` | NV |
| fundamentalRisk · cash_flow_stability | 0.40 (`:1054`) | quarterly cf `operatingCashFlow` CoV + `freeCashFlow` (`:948-990`) → annual fallback (`:995-996`) → metric `freeCashFlowPerShareTTM` (`:1014`) | quarterly cf keys **NV** (P5); annual conditional on P6; metric fallback NV |
| fundamentalRisk · earnings_predictability | 0.35 | `stock/earnings` `surprisePercent` std-dev (`:1024-1038`) | yes (S) |
| fundamentalRisk · asset_turnover | 0.25 | metric `assetTurnoverTTM` (`:1042`) | NV |
| overall · MSPR modifier | ±5 (`:1135-1149`) | `stock/insider-sentiment` `mspr` | yes (S) |

The data-confidence denominator is 23 (`quality-gate.ts`, the census's count); every NV row above is
a metric-map key the vendor does not document and the sample truncates — Appendix A query 3 lists
the keys the live map actually carries.

### 4.2 Info-edge (`info-edge.ts`) — raw weights sum 1.10, the combiner divides by the active sum (`:1363-1367`)

| Sub-score | Weight | Source endpoint · field | Present? |
|---|---|---|---|
| analyst_consensus | 0.15 (`:178`) | `stock/eps-estimate` `epsAvg/High/Low, numberAnalysts, period`; `stock/revenue-estimate` `revenueAvg, period`; `stock/recommendation` counts (internal 0.25 level / 0.25 dispersion / 0.15 alignment / 0.35 breadth `:155-158`) | yes (S); a `sector`-neutral ΔTPER branch reads `peerStats[…].metrics['price_target_implied_return']` (`:246`), **a key `sector-stats.ts` never computes** — dead branch |
| price_target | 0.10 (`:320`) | `stock/price-target` `targetMedian…` vs the latest candle close (`:225-226`) | pass 1: **null** (no candles); pass 2: yes |
| upgrade_downgrade | 0.10 (`:442`) | `stock/upgrade-downgrade` `gradeTime, action, toGrade` | yes (S) |
| insider | 0.15 (`:588`) | MSPR 0.40 (`stock/insider-sentiment` `mspr`), Form4Flow 0.30 + Opportunistic 0.30 (`stock/insider-transactions` → `netDollarFlow`, `opportunisticScore`) (`:574-576`); `officerBuyCount` bump +5/+10 (`:562-563`) | yes (S), except the bump: `officerBuyCount` is **always 0** (`data-fetchers.ts:1103`) — dead |
| earnings_momentum | 0.20 (`:712`) | `stock/earnings` `surprisePercent, period` (SUE streak `:636-648`) | yes (S) |
| flow | 0.05 (`:863`) | TT chain → `put_call_ratio`, `volume_bias`, `unusual_activity_ratio`, O/S (`:796-830`) | yes when the chain fetch succeeds (NV live) |
| news | 0.15 (`:1021`) | `company-news` ×2 → `buzz_ratio`, `sentiment_7d`, `sentiment_momentum`, `tier1_ratio`; `news-sentiment` → `companyNewsScore`, `sectorAverageNewsScore`, `buzz` | yes (S) |
| institutional | 0.05 (`:1248`) | `stock/ownership` → `totalInstitutionalChange`, `netBuyerCount`, `netSellerCount`, `topHolderCount` (`:1199`) | yes (S) |
| recommendation_revision | 0.05 | `stock/recommendation` `[1]` vs `[0]` | yes (S) |
| fund_ownership_flow | 0.05 (`:1385-1398`) | `stock/fund-ownership` `funds[].change` | yes (S) |
| material_event | 0.05 (`:1400-1422`) | SEC EFTS 8-K `hits.total.value` | yes (P) — but only the count; `items` never read (S2) |
| filing_recency overlay | additive (`:1071-1085`) | SEC companyfacts `filingAgeHours`, `latestFilingType` | **50 imputed** when missing or older than 72 h |
| `feedErrors` | — | `FinnhubData.feedErrors` (`types.ts`) | declared by the fetchers, **read by no gate**; the pipeline copies only the count (`pipeline.ts:1105`, `:2044`) |

### 4.3 Vol-edge (`vol-edge.ts`) — sections mispricing 0.40 · term_structure 0.25 · technicals 0.15 · skew 0.10 · gex 0.10 (`:1178-1182`)

| Section · input | Weight | Source endpoint · field | Present? |
|---|---|---|---|
| mispricing · vrp | 0.30 (`:379`) | TT `iv30`, `hv30` against the ticker's own `scan_snapshots` history (`vrpHistory`, ≥ 20 distinct days) | excluded until 20 scan days exist (`pipeline.ts:1183`) |
| mispricing · iv composite | 0.30 (`:380`) | ivp 0.60 ← TT `implied-volatility-percentile`; ivr 0.40 ← TT `implied-volatility-index-rank` (`:365-366`) | yes |
| mispricing · iv_hv_spread | 0.25 (`:381`) | TT `iv-hv-30-day-difference` | yes |
| mispricing · hv_accel | 0.15 (`:382`) | TT `hv30 − hv60` vs peer distribution (`sector-stats.ts:126`) | yes |
| term_structure | 0.25 (`:464-500`) | TT `option-expiration-implied-volatilities[]` `expiration-date`, `implied-volatility` (+ `earningsDate`) | yes when TT sends the array (NV live) |
| technicals · rsi, trend, bollinger, volume | 0.25 / 0.25 / 0.20 / 0.15 (`:755-758`) | DXLink candles `close`, `volume` | pass 1: **excluded**; pass 2: yes |
| technicals · high52w | 0.15 (`:759`) | metric `52WeekHigh`, `52WeekLow` (`:729-730`) — **not** `stock/price-metric` | yes (in the sample) |
| skew | 0.10 (`:812-813`) | chain `strike`, `putIV`, `callIV` | yes when the chain fetch succeeds |
| gex | 0.10 (`:995-1027`) | chain `strike`, `callOI`, `putOI`, IV + FRED DGS10 as the risk-free rate (`:1016-1027`) | yes; **excluded when DGS10 is null** ("never a hardcoded 4.5%") |

### 4.4 Regime (`regime.ts`)

| Block · input | Weight | FRED series → field | Present? |
|---|---|---|---|
| growth · gdp | 0.25 (`:251`) | A191RL1Q225SBEA → `gdp` | yes (V: the series exists) |
| growth · unemployment | 0.20 | UNRATE → `unemployment` | yes |
| growth · nfp | 0.20 | PAYEMS Δ → `nonfarmPayrolls` | yes |
| growth · consumer_confidence | 0.15 | UMCSENT → `consumerConfidence` | yes |
| growth · initial_claims | 0.10 | ICSA → `initialClaims` | yes |
| growth · nfci | 0.10 | NFCI → `nfci` | yes |
| inflation · cpi_yoy / cpi_mom | 0.30 / 0.20 (`:280-281`) | CPIAUCSL → `cpi`, `cpiMom` | yes |
| inflation · fed_funds | 0.15 | FEDFUNDS → `fedFunds` | yes |
| inflation · treasury_10y | 0.15 | DGS10 → `treasury10y` | yes |
| inflation · breakeven_5y | 0.20 | T5YIE → `breakeven5y` | yes |
| modifier · yield-curve inversion | ×(1 + min(0.5, abs(spread) × 0.3)) (`:331-333`) | T10Y2Y → `yieldCurveSpread` | yes |
| modifier · HY stress | ×1.0 → ×1.4 above 5 % (`:342-345`); CRISIS above 8 % (`composite.ts:62-64`) | BAMLH0A0HYM2 → `hySpread` | yes |
| modifier · cross-asset cluster | ±10 % max (`:490`, `:796-799`) | DGS10 · SP500 · DCOILWTICO daily → correlations | yes |
| conditioner · strategy_regime | 0.70 (`:837`) | the growth × inflation composite | yes |
| conditioner · vix_term_structure | 0.20 (`:838`) | VIXCLS ÷ VXVCLS (`:661-665`) | yes |
| conditioner · vvix | 0.10 (`:839`) | **VVIXCLS → `vvix` — the series does not exist on FRED** (P) | **never. Dead weight** — renormalized away every scan; the survival brake's VVIX leg (`:94-105`, threshold 110) can never fire and always reports `VVIX` missing |
| multiplier · corrSpy | 0.10 → 1.0 (`:847-852`) | TT `corr-spy-3month` | yes |
| ancillary (not scored) | — (`:651`) | BAMLC0A4CBBB, T10Y3M, DTWEXBGS, WALCL, WTREGEN, RRPONTSYD | pulled every scan; **read by no score** |

### 4.5 Composite (`composite.ts`)

Static weights 0.25 × 4 (`:28`); by regime (`:35-43`): GOLDILOCKS vol 0.30 / quality 0.20 / regime
0.20 / info 0.30; REFLATION 0.30 / 0.20 / 0.25 / 0.25; DEFLATION 0.20 / 0.35 / 0.25 / 0.20;
STAGFLATION 0.20 / 0.30 / 0.30 / 0.20; CRISIS 0.15 / 0.40 / 0.30 / 0.15. The regime label comes from
§4.4; CRISIS is the HY-spread override.

### 4.6 The dead-weight list — a weight attached to an input that never arrives

| # | Weight | Where | Why it never arrives | Prov. |
|---|---|---|---|---|
| D1 | quality · safety **HHI modifier** ×0.85–×1.03 | `quality-gate.ts:409-431` | `stock/revenue-breakdown2` never parses (P2) | S, F |
| D2 | regime · **vvix 0.10** and the VVIX survival-brake leg | `regime.ts:839`, `:94-105` | `VVIXCLS` is not a FRED series (HTTP 404) | P |
| D3 | info-edge · analyst **ΔTPER peer branch** | `info-edge.ts:246` | `price_target_implied_return` is never in `peerStats` | C |
| D4 | info-edge · insider **`officerBuyCount` bump** +5/+10 | `info-edge.ts:562-563` | always 0 from the Finnhub feed | C |
| D5 | quality · Piotroski **`gross_margin_expanding`** (quarterly path) | `quality-gate.ts:193-198` | `grossProfit` is null — the vendor's key is `grossIncome` (P5) | S |
| D6 | quality · profitability **roic 0.08** and **fcf 0.18** | `quality-gate.ts:544-566`, `:624-636` | annual-only, no fallback; **dead if** the live `financials-reported` shape is the map the docs show (P6) | **NV — conditional** |
| D7 | the progress field **`next_ex_date`** | `pipeline.ts:1144` | `exDate` never exists (P4) | S |
| D8 | the progress fields **`formType`/`description`/`entityName`** of the 8-K scan | `data-fetchers.ts:2562-2564` | keys absent from EFTS `_source` (S2) | P |
| D9 | `stock/price-metric` — **the whole call** | `data-fetchers.ts:2464`, `pipeline.ts:1055` | parsed to `{}` (P1) and, even parsed, read by nothing | S, F, C |

Pass-1-only exclusions (present in the final F2 re-score, so not dead): safety `volume` 0.15,
technicals `rsi/trend/bollinger/volume`, info-edge `price_target` 0.10 (`pipeline.ts:1225`, `:1271-1306`).

---

## 5. Free sources not yet used — premium selling on US large caps only

Each row: what it is, whether it is free at scan volume, the URL, and **one** hypothesis sentence.
No claim about value is made. Every URL was observed on 2026-09-15 by the research pass (P) unless
marked; licence text is quoted where the page carries one. **Web content is untrusted reference
data** — nothing in it was followed as an instruction.

### 5.1 CBOE — `https://cdn.cboe.com/api/global/us_indices/daily_prices/<INDEX>_History.csv` (no key, no login, HTTP 200; one file per scan)

Licence (`https://www.cboe.com/terms/`): "one copy of the Materials for your personal non-commercial
use … [no] derivative work (for example, a financial product, service or index) … without Cboe's prior
written consent except to the extent that such use constitutes 'fair use'". Not on FRED (FRED search
2026-09-15): VIX9D, VIX6M, VIX1Y, SKEW, VVIX, PUT, BXM, CNDR, COR*, DSPX.

| Index | What | Free at scan volume | Columns · range observed | Hypothesis |
|---|---|---|---|---|
| **VVIX** | VIX of VIX, daily close | yes, per scan | `DATE, VVIX`; 2006-03-06 → 2026-09-14 (94.89) | The regime brake's VVIX leg (D2) fires when fed this file instead of the null FRED returns. |
| VIX9D | 9-day S&P 500 vol | yes | OHLC; 2011 → | VIX9D/VIX above 1 (front-end inversion) precedes short-DTE credit-spread losses. |
| VIX3M · VIX | (already pulled as FRED VXVCLS / VIXCLS, close only) | yes | OHLC | The intraday high−low range flags days when the close-based regime read was stale. |
| VIX6M · VIX1Y | 6-month / 1-year vol | yes | OHLC; 2008 / 2007 → | The VIX3M→VIX6M slope separates a shock (front-loaded) from a repricing (whole curve) for 45-DTE strangles. |
| SKEW | S&P 500 tail-risk skew | yes | `DATE, SKEW`; 1990 → (152.09) | High SKEW with low VIX predicts asymmetric put-side losses for short strangles. |
| VXN · RVX | Nasdaq-100 / Russell 2000 vol | yes | OHLC; 2009 → | VXN/VIX conditions the NASDAQ_100 half of the universe separately from S&P names. |
| OVX · GVZ · VXTLT | oil / gold / 20y-Treasury ETF vol | yes | `DATE, value` | Rate-vol and commodity-vol spikes lead equity-vol spikes by days for the sectors they touch. |
| VXAPL, VXAZN, VXGOG, VXGS, VXIBM | single-name CBOE VIX | yes | OHLC; 2011 → | An exchange-computed single-name IV cross-checks TT's `implied-volatility-index` on the largest names. |
| PUT · BXM · BXMD · CNDR · BFLY · PPUT · CLL · CMBO | PutWrite, BuyWrite (ATM / 30-delta), Iron Condor, Butterfly, Protective Put, Collar, Combo benchmarks | yes | `DATE, value`; PUT 1991 →, CNDR 1986 → (818.33) | CNDR drawdowns mark the regimes in which the scanner's own iron-condor cards historically lost. |
| COR1M · COR3M · DSPX · VIXEQ | implied correlation, dispersion, equal-weight VIX | yes | OHLC / `DATE, value`; 2006 / 2014 → | The VIXEQ − VIX gap measures how far single-name IV exceeds index IV — the raw material of a strangle book. |
| Daily market statistics | put/call ratios and volume/OI by category, JSON per trading day | yes (one per scan) | `https://cdn.cboe.com/data/us/options/market_statistics/daily/YYYY-MM-DD_daily_options` (2019-10-07 → 2026-09-11 observed 200; older dates 403); history to 2019 at `https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/{totalpc,indexpc,equitypc,etppc,vixpc}.csv` | An exchange-wide equity put/call extreme conditions the per-symbol PCR (`info-edge.ts:796`, weight 0.05, "WEAK — noise until proven"). |

### 5.2 FRED series not pulled (free with the existing key; `https://fred.stlouisfed.org/series/<ID>` observed 200)

Terms (`https://fred.stlouisfed.org/docs/api/terms_of_use.html`): third-party series "may be owned by
third parties … contact the data owner to obtain permission" for commercial use; FRED states no
numeric rate limit (120/min is a third-party figure).

| Series | What | Copyright note on the page | Hypothesis |
|---|---|---|---|
| VXNCLS, VXDCLS, RVXCLS, OVXCLS, GVZCLS | CBOE Nasdaq-100 / DJIA / Russell / oil / gold vol | "Copyright, 2016, Chicago Board Options Exchange, Inc. Reprinted with permission." | VXN/VIX conditions the NASDAQ_100 universe's IV-rank thresholds. |
| VXAPLCLS, VXGOGCLS, VXAZNCLS, VXGSCLS, VXIBMCLS | single-name CBOE VIX | same | Same cross-check as the CBOE row, one call per series. |
| DGS1MO, DGS3MO, DGS1, DGS2, DGS5, DGS30 | the rest of the Treasury curve | none | The correct risk-free rate per DTE replaces the single DGS10 the GEX gamma uses (`vol-edge.ts:1027`). |
| DFII10, T10YIE, T5YIFR | 10-year TIPS yield, 10-year breakeven, 5y5y forward | "Copyrighted: Citation Required" | Real-rate shocks precede equity-vol repricing. |
| SOFR, DFF, DTB3 | overnight / effective / 3-month | SOFR "Copyrighted: Citation Required" | Overnight vs monthly-average FEDFUNDS gives an intra-month policy read. |
| BAMLH0A0HYM2EY, BAMLC0A0CM, BAMLH0A3HYC, BAMLH0A1HYBB | HY yield, IG OAS, CCC OAS, BB OAS | "Copyright, 2023, ICE Data Indices. Reproduction of this data in any form is prohibited ex…" (truncated in the probe) | CCC − BB is a purer stress signal than the aggregate HY OAS already scored. |
| ANFCI, NFCILEVERAGE, NFCIRISK, NFCICREDIT, STLFSI4, KCFSI | adjusted NFCI, its subindices, St Louis / KC stress | "Copyrighted: Citation Required"; discontinued status of the stress indices NV | The leverage subindex isolates the deleveraging regime in which short-vol drawdowns cluster. |
| NASDAQBXN (+ BXNT, BXNH, BXNTU) | Nasdaq-100 BuyWrite | "Copyright © 2025, NASDAQ, Inc." | BXN vs NDX return measures the realized call-overwrite edge on the Nasdaq half of the universe. |

### 5.3 SEC — filings the scan does not read (free, 10 req/s, User-Agent required; `https://www.sec.gov/os/accessing-edgar-data`)

| Source | Read today? | URL | Shape observed | Hypothesis |
|---|---|---|---|---|
| Form 4 per issuer | no — the scan buys Finnhub `stock/insider-transactions` (`pipeline.ts:982`); the free chain is dead code (`data-fetchers.ts:1238-1419`) | `https://data.sec.gov/submissions/CIK{10}.json` → `filings.recent` (`accessionNumber, filingDate, reportDate, form, items, primaryDocument`) → `https://www.sec.gov/Archives/edgar/data/{cik}/{acc}/{primaryDocument}` | AAPL: 590 Form 4 rows among the 1,000 "recent", 8 in the last 90 days (P) | Form 4 transaction codes and the 10b5-1 flag sharpen the opportunistic-insider signal (`data-fetchers.ts:1027`), and the officer/director flag revives D4. |
| Insider Transactions Data Sets | no | `https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets` → `/files/structureddata/data/insider-transactions-data-sets/{YYYY}q{Q}_form345.zip` | quarterly zip, flattened | One quarterly bulk file backfills insider history for every symbol without per-symbol calls. |
| 13F holdings | no — the scan buys `stock/ownership` + `stock/fund-ownership` | `https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets` → `/files/structureddata/data/form-13f-data-sets/{range}_form13f.zip`; readme `/files/form_13f_readme.pdf` | quarterly bulk, per filer (holder → issuer must be inverted client-side) | Quarter-over-quarter institutional-share change from the bulk file replaces two metered calls per symbol. |
| 8-K item codes | partial — the count is read, the codes are not (S2) | the same EFTS `_source.items` (observed `["2.02","9.01"]`), or submissions `filings.recent.items` (`"2.02,9.01"`, `"5.02"`) | — | Item 2.02 (earnings) vs 5.02 (officer change) vs 1.01/8.01 separate benign from IV-moving 8-Ks that a raw count treats alike. |
| XBRL frames | no | `https://data.sec.gov/api/xbrl/frames/us-gaap/Revenues/USD/CY2025Q4.json` (observed 200, 379 rows `{ accn, cik, entityName, loc, start, end, val }`) | one concept, all filers, one period | One frames call per concept replaces ~500 companyfacts calls for cross-sectional peer fundamentals. |
| companyconcept | no | `https://data.sec.gov/api/xbrl/companyconcept/CIK{10}/us-gaap/{Concept}.json` | per the SEC page | A smaller payload than companyfacts when only EPS and revenue are wanted. |
| Financial Statement Data Sets | NV (not fetched) | — | — | — |

### 5.4 TastyTrade — returned and not mapped (§2.4)

| Field | Hypothesis |
|---|---|
| `implied-volatility-index-5-day-change` | Flags post-spike mean-reversion timing before the rank catches up. |
| `liquidity-value`, `liquidity-rank` | A continuous cost-to-trade measure replaces the 1–5 rating that hard filter 2 and safety 0.25 read. |
| `dividend-ex-date`, `dividend-next-date`, `dividend-pay-date`, `dividend-rate-per-share` | An ex-date inside the DTE flags early-assignment risk on the short call — today the scan buys `stock/dividend` for this and reads a key that does not exist (P4). |
| `earnings.quarter-end-date`, `earnings.late-flag`, `earnings.estimated`, `earnings.visible` | Catch an unconfirmed date that hard filter 5 currently trusts. |
| `[].settlement-type`, `[].option-chain-type` | Separate standard from non-standard chains before pricing. |
| `implied-volatility-updated-at`, `tos-…-rank-updated-at`, `beta-updated-at`, `updated-at` | Reject a stale IV rank instead of scoring it — the scan has no staleness check on any TT field. |
| SDK methods with no call site: `getHistoricalDividendData` → `/market-metrics/historic-corporate-events/dividends/{symbol}`; `getHistoricalEarningsData` → `/market-metrics/historic-corporate-events/earnings-reports/{symbol}` (`lib/services/market-metrics-service.ts:16`, `:21`) | Free replacements for the metered `stock/dividend` and `calendar/earnings` calls whose output no gate reads. |

### 5.5 Other free sources that fit the strategy set

| Source | What | Free at scan volume | URL | Observed | Hypothesis |
|---|---|---|---|---|---|
| OCC volume query | daily options volume by exchange, account type (customer / firm / market-maker) and put/call, per underlying | per symbol (one GET each; no stated limit); theocc.com terms pages answer 403 to non-browser fetches — **licence NV** | `https://marketdata.theocc.com/volume-query?reportDate=YYYYMMDD&format=csv&volumeQueryType=O&symbolType=U&symbol=AAPL&reportType=D` | 200, CSV `quantity, underlying, symbol, actype, porc, exchange, actdate` | The customer-vs-firm put/call split is a cleaner positioning read than the chain-volume PCR. |
| OCC series search | cleared open interest per strike and expiry | per symbol | `https://marketdata.theocc.com/series-search?symbolType=U&symbol=AAPL` | 200, 1,954 rows for AAPL | OI walls independent of the TT chain for strike selection. |
| OCC daily totals | market-wide volume and open interest | per scan | `https://marketdata.theocc.com/daily-volume-statistics?reportDate=YYYYMMDD&format=csv` | 200 | OI growth vs volume as a crowding measure for the short-premium trade. |
| FINRA daily short-sale volume | per-symbol short volume / total volume, one file for all symbols | per scan ("Free, no login required" — the FINRA page) | `https://cdn.finra.org/equity/regsho/daily/CNMSshvol{YYYYMMDD}.txt` | 200, 540 KB, `Date\|Symbol\|ShortVolume\|ShortExemptVolume\|TotalVolume\|Market` | Short-volume-ratio spikes precede the squeezes that break call-side credit spreads. |
| FINRA consolidated short interest | short position, days-to-cover, semi-monthly | per symbol; answered 200 **without a token** — the developer docs say a token is required and "FINRA Data provides non-commercial use", so licence NV | `https://api.finra.org/data/group/otcMarket/name/consolidatedShortInterest` (POST) | `currentShortPositionQuantity, daysToCoverQuantity, changePercent …` | Days-to-cover grades the squeeze risk that Reg SHO (hard filter 6) treats as binary. |
| CFTC Commitments of Traders | weekly VIX-futures positioning by trader class | per scan (US-government data, no key) | `https://www.cftc.gov/dea/newcot/deafut.txt`, `…/FinFutWk.txt`, `https://publicreporting.cftc.gov/resource/6dca-aqww.json` | 200; row "VIX FUTURES - CBOE FUTURES EXCHANGE" | Extreme net-short VIX positioning by leveraged funds marks a crowded short-vol regime before the unwind. |
| Nasdaq short-interest files | — | **not free** (SFTP subscription — `https://www.nasdaqtrader.com/Trader.aspx?id=ShortInterest`) | — | — | excluded |

---

## 6. Cost join — `SCAN_COST` (feedCost.ts:143-163) × read / unread

Per symbol, per scan, cold (every store row expired) and warm (every slow-tier row inside its TTL).
Finnhub is the only metered provider (`feedCost.ts:45`). Verdicts: **SCORED** = a gate reads it;
**PAYLOAD** = parsed into the progress payload, read by no gate; **DEAD** = parsed to nothing or read
by nothing; **CONDITIONAL** = scored only if the live shape matches (§3).

| Endpoint | Calls cold | Calls warm | Verdict | What is paid for and thrown away | Prov. |
|---|---|---|---|---|---|
| `stock/metric` | 1 | 1 | SCORED (23 keys) | the `series` block; every other map key | S, C |
| `stock/recommendation` | 1 | 0 | SCORED | — | S, C |
| `stock/insider-sentiment` | 1 | 0 | SCORED | — | S, C |
| `stock/earnings` | 1 | 0 | SCORED | `surprise`, `quarter`, `year` | S, C |
| `stock/eps-estimate` | 1 | 0 | SCORED | `quarter`, `year` | S, C |
| `stock/revenue-estimate` | 1 | 0 | SCORED | `revenueHigh/Low`, `numberAnalysts` | S, C |
| `stock/price-target` | 1 | 0 | SCORED (pass 2) | `lastUpdated` | S, C |
| `stock/upgrade-downgrade` | 1 | 1 | SCORED | `fromGrade`, `company` | S, C |
| `stock/financials-reported` | 1 | 0 | **CONDITIONAL** (P6) | filing metadata; every concept beyond 19 | S, **NV** |
| `stock/financials` ×3 | 3 | 0 | PARTIAL: ic `grossProfit`/`operatingIncome` never parse (P5); bs/cf NV | 9 ic keys; bs/cf unknown | S, **NV** |
| `stock/insider-transactions` | 1 | 0 | SCORED (role bump dead) | the 100-transaction cap is never paged | S, C |
| `stock/peers` | 1 | 1 | SCORED (peer z) | — | S, C |
| `stock/ownership` | 1 | 0 | SCORED | holder names | S, C |
| `stock/fund-ownership` | 1 | 0 | SCORED (0.05) | `portfolioPercent` | S, C |
| `stock/revenue-breakdown2` | 1 | 0 | **DEAD** (P2) | the whole payload | S, F |
| `news-sentiment` | 1 | 1 | SCORED | `articlesInLastWeek`, `weeklyAverage`, the bullish/bearish split | S, C |
| `stock/earnings-quality-score` | 1 | 0 | SCORED | the four sub-scores | S, C |
| `company-news` ×2 | 2 | 2 | SCORED | `summary`, `category`, `related` | S, C |
| `stock/ebitda-estimate` | 1 | 0 | **PAYLOAD** | all of it | S, C |
| `stock/ebit-estimate` | 1 | 0 | **PAYLOAD** | all of it | S, C |
| `stock/dividend` | 1 | 0 | **PAYLOAD** (+ P3 crash on non-payers, P4 null ex-date) | all of it | S, F, C |
| `stock/price-metric` | 1 | 1 | **DEAD** (P1 + no reader) | all of it | S, F, C |
| `calendar/earnings` | 1 | 1 | **PAYLOAD** | all of it | S, C |
| **Finnhub total** | **26** | **8** | | | C (`finnhubCallsPerSymbol`) |

**The join, counted (C).** Of the 26 metered calls a cold scan buys per symbol, **6 buy nothing a
gate reads** — `revenue-breakdown2` (dead), `price-metric` (dead), `ebitda-estimate`, `ebit-estimate`,
`dividend`, `calendar/earnings` (payload only): 23 % of cold calls. Of the 8 warm calls, **2**
(`price-metric`, `calendar/earnings`): 25 % of every warm scan. Four more calls are conditional on
P5/P6 (`financials` ×3, `financials-reported`). On the founder's 10-symbol measurement run that is
60 of 260 cold calls and 20 of 80 warm calls (`scripts/measure-finnhub-scan-cost.ts` two-run
shape; the founder's own counts are NV here).

| Provider | Per symbol | Per scan | Metered | Bought and not scored (C) |
|---|---|---|---|---|
| Finnhub | 26 cold / 8 warm | — | yes | 6 of 26 cold; 2 of 8 warm |
| TastyTrade | 1 REST chain + WS | 1 market-metrics per 50 symbols | no (account) | `implied-volatility-index`, `earnings.actual-eps/consensus-estimate/time-of-day` (Step A payload only); the unmapped fields in §2.4 |
| SEC | 6 | 1 | no | `dei`; 8-K `items`; the 10-K walk via EFTS (S1) |
| FRED | 0 | 24 | no | 6 series pulled and unscored (ancillary); 1 series that does not exist (VVIXCLS) |
| Nasdaq Trader | 0 | 1 | no | — |

---

## Appendix A — queries for Alex (Azure, `psql`; read-only)

Claude Code cannot run these. Each settles one NV row above.

```sql
-- 1. What the store holds, by endpoint (which slow-tier rows the founder's run wrote).
SELECT endpoint, count(*) AS rows, min(fetched_at) AS oldest, max(fetched_at) AS newest
FROM finnhub_responses GROUP BY 1 ORDER BY 1;

-- 2. P6 — the live shape of financials-reported: an ARRAY of {concept,value} (the parser's
--    assumption) or a MAP {"Assets": …} (the docs' sample)?
SELECT symbol, jsonb_typeof(response->'data'->0->'report'->'ic') AS ic_shape,
       left((response->'data'->0->'report'->'ic')::text, 300) AS ic_head
FROM finnhub_responses WHERE endpoint = 'stock/financials-reported' LIMIT 3;

-- 3. §4.1 NV rows — which keys the live stock/metric map carries (metric is daily-tier and never
--    stored; this reads the quarterly ic row instead — for the metric map, log one live response).
--    P5 — the ic/bs/cf keys the vendor actually sends:
SELECT params_hash, sent_params->>'statement' AS stmt,
       (SELECT string_agg(k, ', ' ORDER BY k) FROM jsonb_object_keys(response->'financials'->0) k) AS keys
FROM finnhub_responses WHERE endpoint = 'stock/financials' LIMIT 3;

-- 4. P2 — the live revenue-breakdown2 shape (expect data.annual / data.quarterly).
SELECT symbol, (SELECT string_agg(k, ', ') FROM jsonb_object_keys(response->'data') k) AS data_keys
FROM finnhub_responses WHERE endpoint = 'stock/revenue-breakdown2' LIMIT 3;

-- 5. P3/P4 — dividend rows: empty arrays (non-payers) and the key names on payers.
SELECT symbol, jsonb_array_length(response) AS n,
       CASE WHEN jsonb_array_length(response) > 0
            THEN (SELECT string_agg(k, ', ') FROM jsonb_object_keys(response->0) k) END AS keys
FROM finnhub_responses WHERE endpoint = 'stock/dividend' ORDER BY n LIMIT 10;
```

## Appendix B — how the replay was run (this environment, no vendor call)

1. `https://finnhub.io/docs/api` (one free GET) → the embedded Swagger spec (`window.docSchema`,
   116 paths, 205 definitions) → the 23 scan endpoints' `sampleResponse`, `premium`/`freeTier`
   flags, params and response definitions.
2. A harness stubbed `globalThis.fetch` for `https://finnhub.io/api/v1/*` to answer each path with
   its sample (404 when the spec has none — it had all 23), set `FINNHUB_API_KEY` to a dummy, and
   ran every fetcher in `data-fetchers.ts` for one symbol through the committed cache helper against
   the real `finnhub_responses` table on a throwaway local Postgres 16. Results in §3.
3. The dividend non-payer case used a synthetic `[]` (the vendor publishes no non-payer sample).
4. SEC EFTS: two free queries (`q="AAPL"&forms=10-K`, `…&forms=8-K`) to read the `_source` keys.
5. FRED: three free series pages (VVIXCLS 404, VXVCLS 200, VIXCLS 200).
6. Every code citation was read in the working tree at `247e33c2` before it was written down.
