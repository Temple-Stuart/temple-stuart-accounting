# FALLBACK-CENSUS — exhaustive inventory of every default, fallback, imputation, and silent-catch in the trading path

**Date:** 2026-07-06 · **Read-only** (no code changes) · **Base:** main @ `c12e48f7`
**Scope:** all of `src/lib/convergence/**` (20 files) + `src/lib/strategy-builder.ts` + `src/app/api/trading/**` + `src/app/api/tastytrade/**` + `src/app/api/ai/convergence-synthesis` + `src/app/api/ai/strategy-analysis` — 43 files, ~18,500 lines.

**Method:** five exact pattern greps per file — (A) `?? <literal>`, (B) `|| <number>/''/[]`, (C) `= 40/50/30/25` assignments, (D) keyword mentions `default|fallback|imputed|proxy|estimat|neutral` (comments included), (E) every `catch` — plus (F) a manual read of every scoring/pricing/persistence function for literal-on-false-branch ternaries the greps miss. One table row per unique `file:line`; line numbers taken from `grep -n` on the actual files, code verbatim. Census was produced by 8 parallel read-only passes (one per file group), each with a self-check reconciling grep hit counts against rows emitted (self-checks appear at the end of each file block); assembled counts were independently re-derived by re-grepping the assembled tables, and the catch-block total (110) exactly matches an independent whole-scope grep for `catch`.

**Classification legend:**
- **LEGITIMATE** — computed from PRESENT data, display/log-only, `?? null` normalization, guarded-unreachable, config constants, or comment/doc mentions. Justified per row.
- **VIOLATION** — a silent default/fabrication in a scoring, pricing, sizing, or persistence path (the kill list), or a silent-swallow catch (fail-loud violation).
- **GRAY** — needs a product ruling; the question Alex must answer is stated in the row.

## FINAL COUNT

| metric | count |
|---|---|
| **Total hits inventoried** | **1,529** (1,419 pattern rows + 110 catch blocks) |
| LEGITIMATE (pattern) | 1,215 |
| **VIOLATION (pattern)** | **103** |
| GRAY (pattern) | 101 |
| Catch (a) rethrow/propagate | 2 |
| Catch (b) declare loudly | 66 |
| **Catch (c) SWALLOW silently — fail-loud violations** | **42** |
| **Total violations (pattern + silent catch)** | **145** |

**Violation hot spots (by file):** quality-gate.ts (22) · api routes (25 — greeks 9, simulate 7, quotes 4, scanner 3, chains 1, commit-to-ledger 1) · strategy-builder/chain-fetcher/probability (16) · vol-edge.ts (12) · regime.ts (11) · data-fetchers.ts (7 pattern + 21 silent catches) · pipeline.ts (3 pattern + 12 silent catches) · info-edge.ts (5) · sentiment.ts (2).

**Highest-stakes single findings:**
1. `strategy-builder.ts:833` `const iv = params.iv30 ?? 0.30;` — a fabricated 30% vol drives σ in every breakeven_d2 PoP (compounds with `pipeline.ts:1578` `iv30 ?? 30`).
2. `probability.ts:56` — d2 has no dividend-yield q (drift `r − σ²/2`), overstating PoP-above for dividend payers on every card.
3. `commit-to-ledger/route.ts:117` `…, null) || new Date()` — a fabricated "now" close date is PERSISTED into journal entries.
4. `regime.ts:63-136` — all 11 macro signals impute neutral 50 when their FRED series is null; imputations enter the regime composite (tracked in confidence, never excluded/renormalized).
5. `backtest/simulate/route.ts:79-88` — missing backtester fields become $0 prices/P&L presented as results.
6. `scanner/route.ts:221-223` + `pipeline.ts:276/278` — missing IV rank/percentile imputed as 0 at the parse boundary, then sorts the universe / enters scoring and snapshots.
7. `vol-edge.ts:940` `(fredMacro?.treasury10y ?? 4.5)` — imputed risk-free rate silently shifts BS gamma → GEX flip → gex score, trace shows 4.5 as if real.
8. `data-fetchers.ts` — 21 silent catches; FinnhubData has no error channel, so partial fetch failures are invisible to scoring and the N/M declarations.

The 101 GRAY questions for Alex are in the rows (search "GRAY"); the recurring themes: (1) `parseFloat(x) || null` nulls a true 0 (dividendYield 0% is the clearest case) — is that intended?; (2) filter-engine passes cards OPEN when a filtered metric is missing and displays two filters (`minOpenInterest`, `minUnderlyingVolume`) that are never enforced — fail-closed, pass-open, or pass-with-declaration?; (3) missing volume/OI counted as 0 in flow ratios — exclude instead?; (4) Altman-Z component proxies in quality-gate (:313-:327) — approved proxy or exclude?; (5) sub-window cross-asset correlations silently labeled as 60d/252d (cross-asset.ts:160-162).

---

# SECTION 1 — THE PATTERN CENSUS (complete, per file; each file block ends with its self-check)

Every hit appears below. Catch-block tables per file double as the Section 4 detail.

# Fallback census — src/lib/convergence/pipeline.ts (main @ c12e48f7, read-only)

## src/lib/convergence/pipeline.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| src/lib/convergence/pipeline.ts:2 | `import { fetchFinnhubBatch, ..., fetchFinnhubEbitdaEstimates, fetchFinnhubEbitEstimates, ... }` | LEGITIMATE | Keyword-only D hit ("Estimat" in import names); no behavior. |
| src/lib/convergence/pipeline.ts:38 | `FinnhubEbitdaEstimate,` | LEGITIMATE | Keyword-only D hit; type import name. |
| src/lib/convergence/pipeline.ts:39 | `FinnhubEbitEstimate,` | LEGITIMATE | Keyword-only D hit; type import name. |
| src/lib/convergence/pipeline.ts:245 | `const BATCH_SIZE = 50;` | LEGITIMATE | Non-data config constant (TT fetch batch size); never enters a score, price, size, or stored value. |
| src/lib/convergence/pipeline.ts:267 | `const symbol = (m['symbol'] as string) \|\| '';` | LEGITIMATE | Guard, not imputation: line 268 `if (!symbol) return null` drops the record; '' never persists. |
| src/lib/convergence/pipeline.ts:276 | `ivRank: Number(m['implied-volatility-index-rank'] \|\| m['tos-...-rank'] \|\| m['tw-...-rank'] \|\| 0,)` (272-277; STEP-F multiline hit) | VIOLATION | Missing IV rank silently becomes 0 and flows into scoring: vol-edge.ts:227 `tt?.ivRank ?? null` keeps 0, :273 `ivrScoreRaw = clamp(0,0,100)=0` — a penalty score enters the mispricing composite instead of null→excluded→renormalized; also conflates a genuine IVR of 0 with missing (pre-filter.ts:33 then nulls real zeros). |
| src/lib/convergence/pipeline.ts:278 | `ivPercentile: Number(m['implied-volatility-percentile'] \|\| 0),` | VIOLATION | Missing IVP fabricated as 0: reaches vol-edge scoring (vol-edge.ts:223 `?? null` keeps 0 → IVP component scores 0, and :1170 `== null` check misses it so it is not even flagged imputed), passes pipeline.ts:1564's `IV_percentile == null` exclusion gate into chainInputs `ivRank: 0/100` (pricing), and is persisted to scan_snapshots via line 1960. |
| src/lib/convergence/pipeline.ts:279 | `impliedVolatility: Number(m['implied-volatility-index'] \|\| 0),` | GRAY | Only consumer found is the step_a onProgress display (line 428) — cannot reach a score/price/persisted value today — but the UI shows a fabricated IV of 0 as if real. Alex: may missing implied-volatility-index render as 0 in step_a, or must it be null? |
| src/lib/convergence/pipeline.ts:302 | `earningsEstimate:` | LEGITIMATE | Keyword-only D hit (field name); behavior on 303-305 is honest null normalization. |
| src/lib/convergence/pipeline.ts:303 | `(m['earnings'] as Record<string, unknown>)?.['consensus-estimate'] != null` | LEGITIMATE | Explicit null check feeding parse-or-null — no value invented (else branch is `null`, line 305). |
| src/lib/convergence/pipeline.ts:304 | `? parseFloat(String((m['earnings'] as Record<string, unknown>)['consensus-estimate']))` | LEGITIMATE | True branch parses PRESENT data; false branch is null (305). |
| src/lib/convergence/pipeline.ts:309 | `(m['option-expiration-implied-volatilities'] as Array<Record<string, unknown>>) \|\| []` | LEGITIMATE | `\|\| []` on an optional array; empty termStructure is informationally identical to the field being absent ("no expirations reported") — no value fabricated. |
| src/lib/convergence/pipeline.ts:334 | `default: return [...SP500];` | GRAY | `undefined` → SP500 is the intended default, but any UNRECOGNIZED universe string (typo, stale enum) also silently maps to SP500 instead of failing loud. Alex: should an unknown non-empty universe value throw rather than default? |
| src/lib/convergence/pipeline.ts:448 | `earningsEstimate: d.earningsEstimate,` | LEGITIMATE | Keyword-only D hit; passthrough of parsed value into step_a display. |
| src/lib/convergence/pipeline.ts:504 | `.map(r => ({ symbol: r.symbol, days_to_earnings: ...?.daysTillEarnings ?? null }));` | LEGITIMATE | `?? null` normalization in an earnings-warning display list; honest null. |
| src/lib/convergence/pipeline.ts:525 | `const cutoffScore = stepCIncluded[preFilterTopN - 1]?.preScore ?? 0;` | LEGITIMATE | Used only as `cutoff_score` in the step_d onProgress payload (line 529); display-only, never enters selection math (selection already done by slice at 517-519). |
| src/lib/convergence/pipeline.ts:568 | `console.log('[Pipeline] Step C2: Computing initial peer stats (finnhub-peers → industry → sector fallback)...');` | LEGITIMATE | Log line describing the tiered peer-grouping method (behavior lives in computePeerStats, outside this file); method is declared loudly in data_gaps at line 1894. |
| src/lib/convergence/pipeline.ts:585 | `peer_group: ps?.peer_group_name ?? 'No peer group found',` | LEGITIMATE | Display label in step_f progress payload; honest "not found" string, no score impact. |
| src/lib/convergence/pipeline.ts:586 | `peer_count: ps?.ticker_count ?? 0,` | LEGITIMATE | Display-only count in step_f payload; 0 peers is the honest reading when no group exists (row also shows 'No peer group found'). |
| src/lib/convergence/pipeline.ts:587 | `group_type: ps?.peer_group_type ?? 'unknown',` | LEGITIMATE | Display-only honest 'unknown' label. |
| src/lib/convergence/pipeline.ts:588 | `group_key: groupKey ?? null,` | LEGITIMATE | `?? null` normalization, display-only. |
| src/lib/convergence/pipeline.ts:589 | `insufficient_peers: ps?.insufficient_peers ?? false,` | LEGITIMATE | Display flag in step_f payload; when no group exists the same row shows peer_group='No peer group found'/peer_count=0, so absence is declared; never enters scoring. |
| src/lib/convergence/pipeline.ts:596 | `my_iv_percentile: s.ivPercentile ?? null,` | LEGITIMATE | `?? null` normalization, display-only (note: upstream line 278 means this is never null in practice — that issue is rowed at 278). |
| src/lib/convergence/pipeline.ts:597 | `my_iv30: s.iv30 ?? null,` | LEGITIMATE | `?? null` normalization, display-only. |
| src/lib/convergence/pipeline.ts:598 | `my_beta: s.beta ?? null,` | LEGITIMATE | `?? null` normalization, display-only. |
| src/lib/convergence/pipeline.ts:637 | `... Score ${Math.round(r.pre_score)} vs cutoff ${Math.round(preScores[fetchCount - 1]?.pre_score ?? 0)}` | LEGITIMATE | Human-readable reason string in step_g payload; message-only, selection already decided by index. |
| src/lib/convergence/pipeline.ts:775 | `// Before G2, all tickers score with null optionsFlow (neutral imputation).` | LEGITIMATE | Comment/doc — but STALE: verified actual behavior is null → signal EXCLUDED and weights renormalized (info-edge.ts:770-777, EDGE-2b), not neutral imputation. Recommend doc fix; no code behavior on this line. |
| src/lib/convergence/pipeline.ts:790 | `const ebitdaEstimateMap = new Map<string, FinnhubEbitdaEstimate \| null>();` | LEGITIMATE | Keyword-only D hit; map declaration, null = honest absence. |
| src/lib/convergence/pipeline.ts:791 | `const ebitEstimateMap = new Map<string, FinnhubEbitEstimate \| null>();` | LEGITIMATE | Keyword-only D hit; map declaration. |
| src/lib/convergence/pipeline.ts:936 | `// I1: EBITDA Estimates` | LEGITIMATE | Comment; keyword-only. |
| src/lib/convergence/pipeline.ts:938 | `console.log('[Pipeline] Step I1: Fetching EBITDA estimates...');` | LEGITIMATE | Log line; keyword-only. |
| src/lib/convergence/pipeline.ts:940 | `const result = await fetchFinnhubEbitdaEstimates(symbol);` | LEGITIMATE | Fetch call; failures declared via errors.push at 942. |
| src/lib/convergence/pipeline.ts:941 | `ebitdaEstimateMap.set(symbol, result.data);` | LEGITIMATE | Stores fetched data or honest null. |
| src/lib/convergence/pipeline.ts:942 | `if (result.error) errors.push(\`Step I1 (ebitda-estimate ${symbol}): ${result.error}\`);` | LEGITIMATE | Fail-loud error declaration. |
| src/lib/convergence/pipeline.ts:945 | `console.log(\`[Pipeline] Step I1: EBITDA estimates fetched for ${topSymbols.length} symbols\`);` | LEGITIMATE | Log line; keyword-only. |
| src/lib/convergence/pipeline.ts:947 | `// I2: EBIT Estimates` | LEGITIMATE | Comment; keyword-only. |
| src/lib/convergence/pipeline.ts:949 | `console.log('[Pipeline] Step I2: Fetching EBIT estimates...');` | LEGITIMATE | Log line. |
| src/lib/convergence/pipeline.ts:951 | `const result = await fetchFinnhubEbitEstimates(symbol);` | LEGITIMATE | Fetch call; failures declared at 953. |
| src/lib/convergence/pipeline.ts:952 | `ebitEstimateMap.set(symbol, result.data);` | LEGITIMATE | Stores fetched data or honest null. |
| src/lib/convergence/pipeline.ts:953 | `if (result.error) errors.push(\`Step I2 (ebit-estimate ${symbol}): ${result.error}\`);` | LEGITIMATE | Fail-loud error declaration. |
| src/lib/convergence/pipeline.ts:956 | `console.log(\`[Pipeline] Step I2: EBIT estimates fetched for ${topSymbols.length} symbols\`);` | LEGITIMATE | Log line. |
| src/lib/convergence/pipeline.ts:1025 | `const earnings = fh?.earnings ?? [];` | LEGITIMATE | `?? []` for step_i display stats only (earnings_quarters/beat_count); empty honestly means none; scoring uses finnhubData directly (line 1140), not this. |
| src/lib/convergence/pipeline.ts:1027 | `e => (e.actual ?? 0) > (e.estimate ?? 0)` | GRAY | Display-only (step_i beat_count/beat_rate — never reaches scoring), but imputes 0 for a missing actual/estimate, so a quarter with actual>0 and missing estimate displays as a "beat". Alex: must the displayed beat_rate exclude quarters with missing actual/estimate instead of zero-filling them? |
| src/lib/convergence/pipeline.ts:1029 | `const recs = fh?.recommendations ?? [];` | LEGITIMATE | `?? []` for display stats; empty = none; analyst_rating renders null when empty (1043-1045). |
| src/lib/convergence/pipeline.ts:1031 | `const insider = fh?.insiderSentiment ?? [];` | LEGITIMATE | `?? []` for display; insider_sentiment renders null when empty (1046-1048). |
| src/lib/convergence/pipeline.ts:1049 | `news_sentiment: news?.sentiment_7d?.score ?? null,` | LEGITIMATE | `?? null` normalization in step_i display payload. |
| src/lib/convergence/pipeline.ts:1050 | `institutional_holders: institutional?.topHolderCount ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1051 | `earnings_quality_score: earningsQuality?.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1052 | `earnings_quality_letter: earningsQuality?.letterScore ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1053 | `pe_ratio: (fh?.fundamentals?.metric?.['peBasicExclExtraTTM'] as number) ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1054 | `market_cap: (fh?.fundamentals?.metric?.['marketCapitalization'] as number) ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1055 | `ebitda_estimates: ebitdaEstimateMap.get(symbol)?.estimates?.slice(0, 4) ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1056 | `ebitda_estimate_count: ebitdaEstimateMap.get(symbol)?.estimates?.length ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1057 | `ebit_estimates: ebitEstimateMap.get(symbol)?.estimates?.slice(0, 4) ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1058 | `ebit_estimate_count: ebitEstimateMap.get(symbol)?.estimates?.length ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1059 | `dividend_count: dividendHistoryMap.get(symbol)?.dividends?.length ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1060 | `next_ex_date: dividendHistoryMap.get(symbol)?.dividends?.[0]?.exDate ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1061 | `week52_high: (fh?.fundamentals?.metric?.['52WeekHigh'] as number) ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1062 | `week52_low: (fh?.fundamentals?.metric?.['52WeekLow'] as number) ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1063 | `fund_count: fundOwnershipMap.get(symbol)?.totalFunds ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1064 | `top_fund: fundOwnershipMap.get(symbol)?.funds?.[0]?.name ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1065 | `edgar_8k_count: edgar8kMap.get(symbol)?.totalHits ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1066 | `edgar_8k_latest: edgar8kMap.get(symbol)?.filings?.[0]?.filedAt ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1067 | `earnings_calendar_count: earningsCalendarMap.get(symbol)?.earningsCalendar?.length ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1068 | `next_earnings_date: earningsCalendarMap.get(symbol)?.earningsCalendar?.[0]?.date ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1092 | `// No proxy distribution is ever substituted.` | LEGITIMATE | Comment/doc describing EDGE-4 no-proxy policy; behavior (exclusion) verified at 1093-1109 and vol-edge.ts VRP block. |
| src/lib/convergence/pipeline.ts:1099 | `dataGaps.push(\`vrp_history: ... VRP sub-score is excluded and mispricing weights renormalized (no proxy distribution)\`);` | LEGITIMATE | Loud data-gap declaration of exclusion+renormalization — the mandated pattern, not a fallback. |
| src/lib/convergence/pipeline.ts:1104 | `dataGaps.push('vrp_history: scan_snapshots query FAILED — VRP sub-score excluded for ALL tickers ...');` | LEGITIMATE | Loud declaration on failure; paired with errors.push at 1103. |
| src/lib/convergence/pipeline.ts:1124 | `const finnhubData = finnhubResult.data.get(symbol) \|\| { fundamentals: null, recommendations: [], ..., estimateData: null };` (STEP-F hit, 1124-1130) | LEGITIMATE | Placeholder contains ONLY nulls/empty arrays — honest absence, no fabricated values; downstream scorers exclude null signals and renormalize (EDGE-1/2); fetch failures are declared via finnhubResult.stats.errors in pipeline_summary. |
| src/lib/convergence/pipeline.ts:1129 | `estimateData: null,` | LEGITIMATE | Member of the honest-absence default object — behavior classified at file:line 1124. |
| src/lib/convergence/pipeline.ts:1141 | `finnhubEstimates: finnhubData.estimateData ?? null,` | LEGITIMATE | `?? null` normalization assembling ConvergenceInput; forwards absence honestly (scorers exclude nulls). |
| src/lib/convergence/pipeline.ts:1143 | `annualFinancials: annualFinancialsMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization (Map miss → null); honest absence. |
| src/lib/convergence/pipeline.ts:1144 | `quarterlyFinancials: quarterlyFinancialsMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1145 | `optionsFlow: optionsFlowMap.get(symbol) ?? null,` | LEGITIMATE | `?? null`; null flow → signal excluded + renormalized (info-edge.ts:773-777). |
| src/lib/convergence/pipeline.ts:1146 | `newsSentiment: newsSentimentMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1147 | `finnhubNewsSentiment: finbertMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1148 | `finnhubEarningsQuality: earningsQualityMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1149 | `finnhubInstitutionalOwnership: institutionalOwnershipMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1150 | `finnhubRevenueBreakdown: revenueBreakdownMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1151 | `secFilingData: secFilingMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1152 | `secForm4Data: secForm4Map.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1153 | `finnhubFundOwnership: fundOwnershipMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1154 | `edgar8kScan: edgar8kMap.get(symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1159 | `vrpHistory: vrpHistoryMap.get(symbol) ?? null,` | LEGITIMATE | `?? null`; null → VRP excluded + renormalized (EDGE-4, declared at 1099/1104/1108). |
| src/lib/convergence/pipeline.ts:1203 | `finnhubEstimates: ticker.finnhubData.estimateData ?? null,` | LEGITIMATE | `?? null` input normalization (F2 re-score input). |
| src/lib/convergence/pipeline.ts:1205 | `annualFinancials: annualFinancialsMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1206 | `quarterlyFinancials: quarterlyFinancialsMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1207 | `optionsFlow: optionsFlowMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null`; null → flow signal excluded + renormalized. |
| src/lib/convergence/pipeline.ts:1208 | `newsSentiment: newsSentimentMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1209 | `finnhubNewsSentiment: finbertMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1210 | `finnhubEarningsQuality: earningsQualityMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1211 | `finnhubInstitutionalOwnership: institutionalOwnershipMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1212 | `finnhubRevenueBreakdown: revenueBreakdownMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1213 | `secFilingData: secFilingMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1214 | `secForm4Data: secForm4Map.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1215 | `finnhubFundOwnership: fundOwnershipMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1216 | `edgar8kScan: edgar8kMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1221 | `vrpHistory: vrpHistoryMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null`; null → VRP excluded + renormalized (declared). |
| src/lib/convergence/pipeline.ts:1241 | `candles_used: tech?.candles_used ?? null,` | LEGITIMATE | `?? null` in step_l display payload. |
| src/lib/convergence/pipeline.ts:1242 | `vol_edge_score: ticker.scoring?.vol_edge.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1243 | `composite_score: ticker.scoring?.composite.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1244 | `technicals_score: tech?.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1245 | `technicals_formula: tech?.formula ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1246 | `rsi_14: tech?.indicators.rsi_14 ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1247 | `sma_20: tech?.indicators.sma_20 ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1248 | `sma_50: tech?.indicators.sma_50 ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1249 | `bb_position: tech?.indicators.bb_position ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1250 | `volume_ratio: tech?.indicators.volume_ratio ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1251 | `high52w_ratio: tech?.indicators.high52w_ratio ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1252 | `sub_scores: tech?.sub_scores ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1270 | `candle_count: candleDataMap.get(sym)?.length ?? null,` | LEGITIMATE | `?? null` display normalization (step_j payload). |
| src/lib/convergence/pipeline.ts:1299 | `regime: _gwt?.regime_used ?? 'UNKNOWN',` | LEGITIMATE | Honest 'UNKNOWN' label in step_k display when no gate-weight trace exists. |
| src/lib/convergence/pipeline.ts:1301 | `vol_edge: Math.round((_gw?.vol_edge ?? 0.25) * 100),` | GRAY | Display-only (step_k weights) so it cannot enter a score, but when the trace is absent the UI shows fabricated 25/25/25/25 weights while `regime` honestly shows 'UNKNOWN' (1299) — no-drift concern. Alex: may the weights display default to 25% when gate_weight_trace is missing, or must it show null/UNKNOWN? |
| src/lib/convergence/pipeline.ts:1302 | `quality: Math.round((_gw?.quality ?? 0.25) * 100),` | GRAY | Same question as 1301. |
| src/lib/convergence/pipeline.ts:1303 | `regime: Math.round((_gw?.regime ?? 0.25) * 100),` | GRAY | Same question as 1301. |
| src/lib/convergence/pipeline.ts:1304 | `info_edge: Math.round((_gw?.info_edge ?? 0.25) * 100),` | GRAY | Same question as 1301. |
| src/lib/convergence/pipeline.ts:1310 | `data_confidence: scoring?.composite.data_confidence.confidence ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1311 | `position_size_pct: scoring?.composite.position_size_pct ?? null,` | LEGITIMATE | `?? null` display normalization — reports a size computed elsewhere; imputes nothing. |
| src/lib/convergence/pipeline.ts:1342 | `active_signal_count: scoring.vol_edge.data_confidence.active_signal_count ?? null,` | LEGITIMATE | `?? null` display of EDGE-4 exclusion count. |
| src/lib/convergence/pipeline.ts:1386 | `yield_curve_spread: scoring.regime.breakdown.regime_signals.yield_curve_spread ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1387 | `hy_spread: scoring.regime.breakdown.regime_signals.hy_spread ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1389 | `bbb_spread: scoring.regime.breakdown.bbb_spread_signal.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1390 | `bbb_spread_raw: scoring.regime.breakdown.bbb_spread_signal.raw_value ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1391 | `t10y3m: scoring.regime.breakdown.t10y3m_signal.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1392 | `t10y3m_raw: scoring.regime.breakdown.t10y3m_signal.raw_value ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1393 | `dollar_index: scoring.regime.breakdown.dollar_index_signal.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1394 | `dollar_index_raw: scoring.regime.breakdown.dollar_index_signal.raw_value ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1395 | `fed_net_liquidity: scoring.regime.breakdown.fed_net_liquidity_signal.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1396 | `fed_net_liquidity_raw: scoring.regime.breakdown.fed_net_liquidity_signal.raw_value ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1406 | `score: scoring.info_edge.breakdown.price_target_signal?.score ?? null,` | LEGITIMATE | `?? null` display of EDGE-2b excluded signal (comment 1403-1404: "never a number invented for display"). |
| src/lib/convergence/pipeline.ts:1407 | `weight: scoring.info_edge.breakdown.price_target_signal?.weight ?? null,` | LEGITIMATE | Same as 1406. |
| src/lib/convergence/pipeline.ts:1410 | `score: scoring.info_edge.breakdown.upgrade_downgrade_signal?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1411 | `weight: scoring.info_edge.breakdown.upgrade_downgrade_signal?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1414 | `score: scoring.info_edge.breakdown.insider_activity?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1415 | `weight: scoring.info_edge.breakdown.insider_activity?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1418 | `score: scoring.info_edge.breakdown.earnings_momentum?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1419 | `weight: scoring.info_edge.breakdown.earnings_momentum?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1422 | `score: scoring.info_edge.breakdown.flow_signal?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1423 | `weight: scoring.info_edge.breakdown.flow_signal?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1430 | `score: scoring.info_edge.breakdown.institutional_ownership?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1431 | `weight: scoring.info_edge.breakdown.institutional_ownership?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1434 | `score: scoring.info_edge.breakdown.fund_ownership_flow?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1435 | `weight: scoring.info_edge.breakdown.fund_ownership_flow?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1438 | `score: scoring.info_edge.breakdown.material_event_flag?.score ?? null,` | LEGITIMATE | `?? null` display of excluded signal. |
| src/lib/convergence/pipeline.ts:1439 | `weight: scoring.info_edge.breakdown.material_event_flag?.weight ?? null,` | LEGITIMATE | Same. |
| src/lib/convergence/pipeline.ts:1444 | `active_signal_count: scoring.info_edge.data_confidence.active_signal_count ?? null,` | LEGITIMATE | `?? null` display of EDGE-2 exclusion count. |
| src/lib/convergence/pipeline.ts:1446 | `filing_recency: scoring.info_edge.filing_recency ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1563 | `// Exclude ticker if IV_percentile is null — no fallback` | LEGITIMATE | Comment/doc — behavior itself (the null-exclusion at 1564) is honest; note the gate is defeated by the fabricated 0 from line 278 (rowed there). |
| src/lib/convergence/pipeline.ts:1569 | `// gate then declares itself not-evaluated (never imputed).` | LEGITIMATE | Comment/doc — behavior classified at file:line 1570/1580. |
| src/lib/convergence/pipeline.ts:1570 | `const hv10Pct = computeCloseToCloseHV(candleDataMap.get(row.symbol) ?? [], 10);` | LEGITIMATE | `?? []` → computeCloseToCloseHV returns null on insufficient candles → hv10 null (1580) → HV10>IV gate declares not-evaluated; nothing imputed. |
| src/lib/convergence/pipeline.ts:1578 | `iv30: (tt.iv30 ?? 30) / 100,` | GRAY | Literal 30-vol default in the chainInputs PRICING path (feeds generateStrategies, chain-fetcher.ts:366); unreachable today because hard Filter 3 (lines 2046-2072) guarantees iv30 != null && > 0 for every survivor/top-9 — but it is a silent fallback literal in a money path. Alex: replace with fail-loud/exclude (yes/no)? |
| src/lib/convergence/pipeline.ts:1579 | `hv30: (tt.hv30 ?? 25) / 100,` | VIOLATION | REACHABLE imputation in the pricing path: hv30 is nullable (parse line 283) and NO filter gates it; a missing HV30 silently becomes 25 vol and enters generateStrategies (chain-fetcher.ts:367) where IV/HV comparisons gate and score strategy/trade-card construction. |
| src/lib/convergence/pipeline.ts:1599 | `market_note: chainMarketNote ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1602 | `strike_count: perTickerStats.get(sym)?.strikeCount ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1603 | `expiration: perTickerStats.get(sym)?.expiration ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1604 | `dte: perTickerStats.get(sym)?.dte ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1656 | `put_call_ratio: flow?.put_call_ratio ?? null,` | LEGITIMATE | `?? null` display normalization (step_q payload). |
| src/lib/convergence/pipeline.ts:1657 | `volume_bias: flow?.volume_bias ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1658 | `unusual_activity_ratio: flow?.unusual_activity_ratio ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1659 | `total_call_volume: flow?.total_call_volume ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1660 | `total_put_volume: flow?.total_put_volume ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1661 | `total_call_oi: flow?.total_call_oi ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1662 | `total_put_oi: flow?.total_put_oi ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1663 | `strikes_analyzed: flow?.strikes_analyzed ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1679 | `candles: candleDataMap.get(ticker.symbol) ?? [],` | LEGITIMATE | `?? []` in G2.5 re-score input; empty candles → technicals sub-score excluded + weights renormalized, absence declared in data_gaps (1890/1892). |
| src/lib/convergence/pipeline.ts:1684 | `finnhubEstimates: ticker.finnhubData.estimateData ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1686 | `annualFinancials: annualFinancialsMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1687 | `quarterlyFinancials: quarterlyFinancialsMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1689 | `newsSentiment: newsSentimentMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1690 | `finnhubNewsSentiment: finbertMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1691 | `finnhubEarningsQuality: earningsQualityMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1692 | `finnhubInstitutionalOwnership: institutionalOwnershipMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1693 | `finnhubRevenueBreakdown: revenueBreakdownMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1694 | `secFilingData: secFilingMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1695 | `secForm4Data: secForm4Map.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1696 | `finnhubFundOwnership: fundOwnershipMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1697 | `edgar8kScan: edgar8kMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1702 | `vrpHistory: vrpHistoryMap.get(ticker.symbol) ?? null,` | LEGITIMATE | `?? null`; null → VRP excluded + renormalized (declared). |
| src/lib/convergence/pipeline.ts:1725 | `composite: ticker.scoring?.composite.score ?? null,` | LEGITIMATE | `?? null` display normalization (step_r payload). |
| src/lib/convergence/pipeline.ts:1726 | `vol_edge: ticker.scoring?.vol_edge.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1727 | `info_edge: ticker.scoring?.info_edge.score ?? null,` | LEGITIMATE | `?? null` display normalization. |
| src/lib/convergence/pipeline.ts:1778 | `totalStrikes: top9Syms.reduce((sum, sym) => sum + (perTickerStats.get(sym)?.strikeCount ?? 0), 0),` | LEGITIMATE | Display-only total in step_n payload; a symbol with no chain stats honestly contributes 0 strikes. |
| src/lib/convergence/pipeline.ts:1843 | `candles: candleDataMap.get(row.symbol) ?? [],` | LEGITIMATE | `?? []` in generateTradeCards input; empty = honest none, candle gaps declared in data_gaps (1890/1892); card copy handles missing signals via null checks (trade-cards.ts). |
| src/lib/convergence/pipeline.ts:1848 | `finnhubEstimates: ticker.finnhubData.estimateData ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1850 | `annualFinancials: annualFinancialsMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1851 | `quarterlyFinancials: quarterlyFinancialsMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1852 | `optionsFlow: optionsFlowMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1853 | `newsSentiment: newsSentimentMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1854 | `finnhubNewsSentiment: finbertMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1855 | `finnhubEarningsQuality: earningsQualityMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1856 | `finnhubInstitutionalOwnership: institutionalOwnershipMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1857 | `finnhubRevenueBreakdown: revenueBreakdownMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1858 | `secFilingData: secFilingMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1859 | `secForm4Data: secForm4Map.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1860 | `finnhubFundOwnership: fundOwnershipMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1861 | `edgar8kScan: edgar8kMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null` input normalization. |
| src/lib/convergence/pipeline.ts:1866 | `vrpHistory: vrpHistoryMap.get(row.symbol) ?? null,` | LEGITIMATE | `?? null`; null → VRP excluded + renormalized (declared). |
| src/lib/convergence/pipeline.ts:1894 | `dataGaps.push('peer_z_scores: computed per-ticker using industry peers (>=5) or sector fallback ...');` | LEGITIMATE | Loud data-gap declaration of the tiered peer method; the tiering behavior lives in the peer-stats module, and this line is the declaration, not a silent fallback. |
| src/lib/convergence/pipeline.ts:1957 | `spotPrice: t.scoring.vol_edge.breakdown.technicals.indicators.latest_close ?? undefined,` | LEGITIMATE | `?? undefined` normalization for snapshot persistence; snapshot-logger.ts:34-36 stores null — honest absence, nothing fabricated. |
| src/lib/convergence/pipeline.ts:1958 | `iv30: t.scannerData.iv30 ?? undefined,` | LEGITIMATE | `?? undefined` → stored as null; honest absence in persistence. |
| src/lib/convergence/pipeline.ts:1959 | `hv30: t.scannerData.hv30 ?? undefined,` | LEGITIMATE | `?? undefined` → stored as null; honest absence. |
| src/lib/convergence/pipeline.ts:1960 | `ivPercentile: t.scannerData.ivPercentile ?? undefined,` | LEGITIMATE | `?? undefined` normalization itself is honest — but note it persists the fabricated 0 produced by line 278 (violation rowed at 278, not here). |
| src/lib/convergence/pipeline.ts:1961 | `vixLevel: fredResult.data.vix ?? undefined,` | LEGITIMATE | `?? undefined` → stored as null; honest absence. |
| src/lib/convergence/pipeline.ts:2032 | `actual_value: \`${t.liquidityRating ?? 0}/5\`,` | LEGITIMATE | Rejection-message string for a ticker ALREADY rejected by Filter 2 (null or <2) — cannot bias selection; cosmetic nit: renders "unavailable" as 0/5. |
| src/lib/convergence/pipeline.ts:2034 | `reason: \`Liquidity score ${t.liquidityRating ?? 0}/5 is too low. ...\`,` | LEGITIMATE | Same as 2032 — error-message string only. |
| src/lib/convergence/pipeline.ts:2190 | `const ivpComponent = ivp != null ? ivp : 0; // already 0-100 after normalization` (STEP-F hit) | GRAY | Zero-imputation branch inside the pre_score RANKING formula. Dead today: TTScannerData.ivPercentile is `number` (line 278 coerces, never null) so the false branch is unreachable — the real leak is at 278. Alex: convert these `: 0` branches to exclusion/fail-loud so a future guard change cannot silently zero-penalize? |
| src/lib/convergence/pipeline.ts:2191 | `const ivHvComponent = ivHvSpread != null ? Math.min((Math.abs(ivHvSpread) / 20) * 100, 100) : 0;` (STEP-F hit) | GRAY | Same pattern; dead today because Step C (line 480) hard-excludes null ivHvSpread before survivors reach computePreScores — but a silent `: 0` sits in a scoring formula. Same ruling as 2190. |
| src/lib/convergence/pipeline.ts:2192 | `const liqComponent = liquidityRating != null ? (liquidityRating / 5) * 100 : 0;` (STEP-F hit) | GRAY | Same pattern; dead today because hard Filter 2 (line 2023) guarantees liquidityRating != null && >= 2 — but a silent `: 0` sits in a scoring formula. Same ruling as 2190. |
| src/lib/convergence/pipeline.ts:2334 | `const count = sectorCounts[sector] \|\| 0;` | LEGITIMATE | Counter initialization over PRESENT rows (sector-cap bookkeeping); "no entries yet" is genuinely 0. |
| src/lib/convergence/pipeline.ts:2353 | `if ((sectorCounts[sector] \|\| 0) < MAX_PER_SECTOR) {` | LEGITIMATE | Counter idiom, same as 2334. |
| src/lib/convergence/pipeline.ts:2354 | `sectorCounts[sector] = (sectorCounts[sector] \|\| 0) + 1;` | LEGITIMATE | Counter idiom. |
| src/lib/convergence/pipeline.ts:2367 | `sectorCounts[sector] = (sectorCounts[sector] \|\| 0) + 1;` | LEGITIMATE | Counter idiom. |
| src/lib/convergence/pipeline.ts:2400 | `sectorDistribution[sector] = (sectorDistribution[sector] \|\| 0) + 1;` | LEGITIMATE | Counter idiom for the sector-distribution display map. |
| src/lib/convergence/pipeline.ts:2237 | `const mspr = s.info_edge.breakdown.insider_activity?.insider_detail.latest_mspr ?? null;` | LEGITIMATE | `?? null` — null mspr is simply omitted from the key_signal display (2259-2262) and rendered null in RankedRow (2279); honest. |

(Note: rows 2190-2192 and 2237 appear out of strict numeric order above; every union line is present exactly once.)

### Catch blocks

| file:line | what the catch does (verbatim key line) | class | note |
|---|---|---|---|
| src/lib/convergence/pipeline.ts:399 | `errors.push(\`Step A batch error: ${msg}\`); return [];` (+ console.error at 401) | (b) declare loudly | Per-batch TT scanner failure recorded in errors[]; empty batch result is honest "no rows from this batch". |
| src/lib/convergence/pipeline.ts:412 | `errors.push(\`Step A (TT Scanner): ${msg}\`);` (+ console.error at 415) | (b) declare loudly | Whole-step failure declared; pipeline continues with 0 tickers, visible in total_universe. |
| src/lib/convergence/pipeline.ts:555 | `} catch { // Non-critical — fall through to GICS grouping }` | (c) SWALLOW | VIOLATION of fail-loud: per-symbol Finnhub peers fetch error recorded nowhere (no errors[], no log); grouping silently degrades to industry/sector tier with no per-symbol trace (the generic 1894 data-gap is unconditional, not failure-triggered). |
| src/lib/convergence/pipeline.ts:769 | `} catch (e: unknown) { annualFinancialsMap.set(symbol, null); }` | (c) SWALLOW | VIOLATION: thrown errors (vs. the loud `result.error` path at 768) produce a silent null — signal exclusion happens downstream but the failure cause is never declared. |
| src/lib/convergence/pipeline.ts:807 | `newsSentimentMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same silent-null-on-throw pattern (E3). |
| src/lib/convergence/pipeline.ts:822 | `finbertMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E4). |
| src/lib/convergence/pipeline.ts:837 | `earningsQualityMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E5). |
| src/lib/convergence/pipeline.ts:852 | `institutionalOwnershipMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E6). |
| src/lib/convergence/pipeline.ts:867 | `revenueBreakdownMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E7). |
| src/lib/convergence/pipeline.ts:882 | `quarterlyFinancialsMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E8). |
| src/lib/convergence/pipeline.ts:897 | `secFilingMap.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E9). |
| src/lib/convergence/pipeline.ts:912 | `secForm4Map.set(symbol, null);` | (c) SWALLOW | VIOLATION: same pattern (E10). |
| src/lib/convergence/pipeline.ts:929 | `// Non-fatal: text peer classification is an enhancement, not required` | (c) SWALLOW | VIOLATION: E11 10-K text fetch throw silently dropped; symbol just missing from textProfiles with no errors[]/log entry. |
| src/lib/convergence/pipeline.ts:1101 | `errors.push(\`Step E12 (VRP history fetch): ${msg}\`);` (+ dataGaps.push 1104, console.error 1105) | (b) declare loudly | Model behavior: error + data-gap declaring VRP excluded for ALL tickers, weights renormalized, no proxy. |
| src/lib/convergence/pipeline.ts:1165 | `errors.push(\`Step F (score ${symbol}): ${msg}\`);` | (b) declare loudly | Scoring failure per symbol recorded; ticker simply not in scoredTickers (honest absence). |
| src/lib/convergence/pipeline.ts:1227 | `errors.push(\`Step F2 (re-score ${ticker.symbol}): ${msg}\`);` | (b) declare loudly | Re-score failure declared; prior (real) scoring retained. |
| src/lib/convergence/pipeline.ts:1283 | `errors.push(\`Step F2 (candle fetch): ${msg}\`);` (+ console.error 1286) | (b) declare loudly | Candle-fetch failure declared; technicals exclusion also declared via data_gaps 1892. |
| src/lib/convergence/pipeline.ts:1511 | `errors.push(\`Step G1.5 (sentiment): ${msg}\`); ... return new Map();` (+ console.error 1514) | (b) declare loudly | Sentiment failure in errors[]; empty map additionally declared via data_gaps at 1756. |
| src/lib/convergence/pipeline.ts:1713 | `errors.push(\`Step G2.5 (flow re-score ${ticker.symbol}): ${msg}\`);` | (b) declare loudly | Flow re-score failure declared; prior scoring retained. |
| src/lib/convergence/pipeline.ts:1740 | `errors.push(\`Step G2 (chain fetch): ${msg}\`);` (+ console.error 1743) | (b) declare loudly | Chain-fetch failure declared; no-cards case also covered by data_gaps 1896-1899. |
| src/lib/convergence/pipeline.ts:1872 | `console.error(\`[Pipeline] generateTradeCards failed for ${row.symbol}:\`, msg); fullTradeCardsPerTicker[row.symbol] = [];` | (c) SWALLOW | VIOLATION of fail-loud: console.error only (server log) — the failure never reaches errors[] or data_gaps, so an exception-emptied card list is indistinguishable from a legitimate "no strategies passed" result in the returned payload. |

### Self-check
- grep A: 168 lines, B: 9, C: 1, D: 40, E: 21; unique A∪B∪C∪D lines: 209; STEP-F additions not caught by A-D: 5 (276 multiline `\|\| 0` chain, 1124 `\|\|` default-object, 2190, 2191, 2192 ternary `: 0`); pattern rows emitted: 214 = 209 + 5. No union line excluded.
- Catch rows emitted: 21 = grep E count. No catch omitted.
- Pattern classification tally: 200 LEGITIMATE, 3 VIOLATION (276, 278, 1579), 11 GRAY (279, 334, 1027, 1301, 1302, 1303, 1304, 1578, 2190, 2191, 2192).
- Catch tally: 9 × (b) declare loudly, 12 × (c) SWALLOW (555, 769, 807, 822, 837, 852, 867, 882, 897, 912, 929, 1872) — the 12 (c) hits are fail-loud VIOLATIONS.
- Cross-file traces used for classification (read, not assumed): src/lib/convergence/vol-edge.ts:223-273/1170, src/lib/convergence/pre-filter.ts:33-51, src/lib/convergence/info-edge.ts:769-790, src/lib/convergence/chain-fetcher.ts:355-370, src/lib/convergence/snapshot-logger.ts:34-36, src/lib/convergence/trade-cards.ts:35-60.

# Fallback census — src/lib/convergence/data-fetchers.ts (main @ c12e48f7)

## src/lib/convergence/data-fetchers.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| src/lib/convergence/data-fetchers.ts:7 | `FinnhubEstimateData,` | LEGITIMATE | Keyword "estimat" in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:8 | `FinnhubEpsEstimate,` | LEGITIMATE | Keyword in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:9 | `FinnhubRevenueEstimate,` | LEGITIMATE | Keyword in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:30 | `FinnhubEbitdaEstimateEntry,` | LEGITIMATE | Keyword in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:31 | `FinnhubEbitdaEstimate,` | LEGITIMATE | Keyword in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:32 | `FinnhubEbitEstimateEntry,` | LEGITIMATE | Keyword in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:33 | `FinnhubEbitEstimate,` | LEGITIMATE | Keyword in imported type name only; no behavior. |
| src/lib/convergence/data-fetchers.ts:55 | `estimateData: FinnhubEstimateData \| null;` | LEGITIMATE | Type declaration; `null` is the declared-absent shape, no default value. |
| src/lib/convergence/data-fetchers.ts:78 | `// ===== FINNHUB ESTIMATE CACHE (1-hour TTL) =====` | LEGITIMATE | Comment/section header; keyword match only. |
| src/lib/convergence/data-fetchers.ts:80 | `const estimateCache = new Map<string, { data: FinnhubEstimateData; timestamp: number }>();` | LEGITIMATE | Cache container declaration; non-data infrastructure. |
| src/lib/convergence/data-fetchers.ts:81 | `const ESTIMATE_CACHE_TTL = 60 * 60 * 1000; // 1 hour` | LEGITIMATE | Non-data config constant (TTL). |
| src/lib/convergence/data-fetchers.ts:83 | `async function fetchFinnhubEstimates(symbol: string, key: string): Promise<FinnhubEstimateData> {` | LEGITIMATE | Function signature; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:84 | `const cached = estimateCache.get(symbol);` | LEGITIMATE | Cache lookup; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:85 | `if (cached && Date.now() - cached.timestamp < ESTIMATE_CACHE_TTL) {` | LEGITIMATE | TTL check on cache; no default injected. |
| src/lib/convergence/data-fetchers.ts:89 | `let epsEstimates: FinnhubEpsEstimate[] = [];` | LEGITIMATE | Empty-array initializer, overwritten on fetch success; empty means "none obtained" — but note: fetch failures leave it [] with only console.error declaration (see catch table 95/105). |
| src/lib/convergence/data-fetchers.ts:90 | `let revenueEstimates: FinnhubRevenueEstimate[] = [];` | LEGITIMATE | Same as :89 — initializer; failure declaration weakness classified in catch table. |
| src/lib/convergence/data-fetchers.ts:95 | `fetchWithRetry(\`...eps-estimate...\`).catch((e) => { console.error(...); return null; }),` | LEGITIMATE | Keyword match on endpoint URL; the `.catch → null` behavior is classified in the catch table at :95. |
| src/lib/convergence/data-fetchers.ts:96 | `fetchWithRetry(\`...revenue-estimate...\`).catch((e) => { console.error(...); return null; }),` | LEGITIMATE | Keyword match on endpoint URL; catch behavior classified in catch table at :96. |
| src/lib/convergence/data-fetchers.ts:104 | `epsEstimates = Array.isArray(json?.data) ? json.data : [];` | LEGITIMATE | Type-guard normalization: non-array payload → []; empty honestly means "none returned", no value fabricated. |
| src/lib/convergence/data-fetchers.ts:106 | `console.error(\`[Finnhub] eps-estimate ${symbol}:\`, e instanceof Error ? e.message : String(e));` | LEGITIMATE | Error-log line; keyword match only. |
| src/lib/convergence/data-fetchers.ts:109 | `console.error(\`[Finnhub] eps-estimate ${symbol}: HTTP ${epsResp.status}\`);` | LEGITIMATE | Error-log line; keyword match only. |
| src/lib/convergence/data-fetchers.ts:115 | `revenueEstimates = Array.isArray(json?.data) ? json.data : [];` | LEGITIMATE | Same type-guard normalization as :104. |
| src/lib/convergence/data-fetchers.ts:117 | `console.error(\`[Finnhub] revenue-estimate ${symbol}:\`, ...);` | LEGITIMATE | Error-log line; keyword match only. |
| src/lib/convergence/data-fetchers.ts:120 | `console.error(\`[Finnhub] revenue-estimate ${symbol}: HTTP ${revResp.status}\`);` | LEGITIMATE | Error-log line; keyword match only. |
| src/lib/convergence/data-fetchers.ts:147 | `const result: FinnhubEstimateData = { epsEstimates, revenueEstimates, priceTarget, upgradeDowngrade };` | LEGITIMATE | Result assembly from fetched values; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:150 | `const hasData = epsEstimates.length > 0 \|\| revenueEstimates.length > 0 \|\| priceTarget !== null ...` | LEGITIMATE | Anti-fallback control: prevents caching empty results poisoned by rate limits; cannot bias a value. |
| src/lib/convergence/data-fetchers.ts:152 | `estimateCache.set(symbol, { data: result, timestamp: Date.now() });` | LEGITIMATE | Cache write; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:155 | `estimateCache.delete(symbol);` | LEGITIMATE | Stale-cache eviction; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:158 | `console.log(\`[DEBUG-ESTIMATES] ${symbol}: eps=${epsEstimates.length}, ...\`);` | LEGITIMATE | Debug log only. |
| src/lib/convergence/data-fetchers.ts:176 | `estimateData: null,` (inside no-API-key early return of all-empty FinnhubData, :171-178) | GRAY | Missing FINNHUB_API_KEY returns empty FinnhubData with NO error channel (unlike sibling fetchers that return `{data:null,error:'FINNHUB_API_KEY not configured'}`); Alex must rule: should fetchFinnhubTicker declare the missing key loudly instead of returning silently-empty data? |
| src/lib/convergence/data-fetchers.ts:185 | `let estimateData: FinnhubEstimateData \| null = null;` | LEGITIMATE | Null initializer; null is the declared-absent shape. |
| src/lib/convergence/data-fetchers.ts:194 | `const metric = json?.metric \|\| {};` | LEGITIMATE | Missing metric → `fundamentals = { metric: {}, fieldCount: 0 }`; emptiness is declared via fieldCount 0 and per-field absence stays absent (undefined) rather than fabricated; note batch error counter (:279) only fires on null fundamentals, not empty. |
| src/lib/convergence/data-fetchers.ts:227 | `insiderSentiment = json?.data \|\| [];` | LEGITIMATE | Missing payload → []; empty honestly means "no insider sentiment rows"; nothing imputed into scoring. |
| src/lib/convergence/data-fetchers.ts:250 | `// 5. Premium estimates (EPS, revenue, price target, upgrade/downgrade)` | LEGITIMATE | Comment; keyword match only. |
| src/lib/convergence/data-fetchers.ts:252 | `estimateData = await fetchFinnhubEstimates(symbol, key);` | LEGITIMATE | Plain assignment from fetch; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:254 | `console.error(\`[Finnhub] estimates ${symbol}:\`, ...);` | LEGITIMATE | Error-log line; catch behavior classified in catch table at :253. |
| src/lib/convergence/data-fetchers.ts:257 | `return { fundamentals, recommendations, insiderSentiment, earnings, estimateData };` | LEGITIMATE | Return of fetched values; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:289 | `estimateData: null,` (inside batch per-symbol catch, :284-290) | LEGITIMATE | Failure placeholder paired with `stats.errors++` at :283 — failure is declared in returned FinnhubBatchStats; null/[] is the declared-absent shape. |
| src/lib/convergence/data-fetchers.ts:317 | `const bs = report.bs \|\| [];` | LEGITIMATE | Missing statement section → []; findConcept over [] returns null (honest absent) for every field — no value fabricated. |
| src/lib/convergence/data-fetchers.ts:318 | `const ic = report.ic \|\| [];` | LEGITIMATE | Same as :317. |
| src/lib/convergence/data-fetchers.ts:319 | `const cf = report.cf \|\| [];` | LEGITIMATE | Same as :317. |
| src/lib/convergence/data-fetchers.ts:359 | `const reports: { year: number; report: ReportData }[] = json?.data \|\| [];` | LEGITIMATE | Missing payload → []; immediately gated at :361 with declared error "only N annual report(s) available". |
| src/lib/convergence/data-fetchers.ts:409 | `const bsData: FinRow[] = bsResp?.ok ? ((await bsResp.json()) as FinResp)?.financials ?? [] : [];` | LEGITIMATE | Missing/failed statement → []; all-empty case declared as error at :413-414; per-period absence surfaces as honest nulls via num(); no number fabricated. |
| src/lib/convergence/data-fetchers.ts:410 | `const icData: FinRow[] = icResp?.ok ? ((await icResp.json()) as FinResp)?.financials ?? [] : [];` | LEGITIMATE | Same as :409. |
| src/lib/convergence/data-fetchers.ts:411 | `const cfData: FinRow[] = cfResp?.ok ? ((await cfResp.json()) as FinResp)?.financials ?? [] : [];` | LEGITIMATE | Same as :409. |
| src/lib/convergence/data-fetchers.ts:420 | `const p = String(row['period'] ?? '');` | LEGITIMATE | '' sentinel immediately filtered by `if (p)` at :421 — rows without period are excluded, not defaulted. |
| src/lib/convergence/data-fetchers.ts:425 | `const p = String(row['period'] ?? '');` | LEGITIMATE | Same as :420 (filter at :426). |
| src/lib/convergence/data-fetchers.ts:430 | `const p = String(row['period'] ?? '');` | LEGITIMATE | Same as :420 (filter at :431). |
| src/lib/convergence/data-fetchers.ts:671 | `// Default series for cross-asset correlations` | LEGITIMATE | Comment for CROSS_ASSET_SERIES default parameter (:672-675) — non-data config choosing which FRED series to fetch, not a value default. |
| src/lib/convergence/data-fetchers.ts:761 | `function classifyHeadline(headline: string): { sentiment: 'bullish' \| 'bearish' \| 'neutral'; ... }` | LEGITIMATE | Signature; 'neutral' is a union-type member, not a default. |
| src/lib/convergence/data-fetchers.ts:784 | `let sentiment: 'bullish' \| 'bearish' \| 'neutral' = 'neutral';` | LEGITIMATE | Neutral computed from PRESENT headline text: zero keyword matches on a real headline genuinely is neutral (but see VIOLATION at :2060 where a MISSING headline reaches this classifier). |
| src/lib/convergence/data-fetchers.ts:794 | `let neutral = 0;` | LEGITIMATE | Counter initializer over present classifications. |
| src/lib/convergence/data-fetchers.ts:799 | `const conf = h.confidence ?? 1.0;` | GRAY | Missing confidence is imputed as FULL weight 1.0 inside the sentiment score (:809-810); today the only producer (:2065) always sets confidence 1.0 so it never fires, but Alex must rule: if a future producer omits confidence, should the headline be excluded/re-normalized instead of imputed at max weight 1.0? |
| src/lib/convergence/data-fetchers.ts:802 | `else neutral++;` | LEGITIMATE | Counts genuinely-neutral present classifications; no missing data involved at this line. |
| src/lib/convergence/data-fetchers.ts:813 | `return { bullish_matches: bullish, bearish_matches: bearish, neutral, score };` | LEGITIMATE | Returns computed counts; score is null when total===0 (:809-811) — honest absent. |
| src/lib/convergence/data-fetchers.ts:890 | `const usGaap = facts['us-gaap'] ?? {};` | LEGITIMATE | Missing taxonomy → {}; getLatest over {} returns null and the all-null case is declared as error at :920-922. |
| src/lib/convergence/data-fetchers.ts:891 | `const dei = facts['dei'] ?? {};` | LEGITIMATE | Same as :890 (dei is not even read for values afterward). |
| src/lib/convergence/data-fetchers.ts:902 | `const values = units['USD'] ?? units['USD/shares'] ?? units['shares'] ?? Object.values(units)[0];` | GRAY | Unit-preference chain ends in "any unit at all": a concept reported only in a non-USD currency would silently flow its value into epsActual/revenueActual/netIncomeActual (persisted SECFilingData); Alex must rule: is the arbitrary-unit last resort acceptable, or must non-USD units be excluded/declared? |
| src/lib/convergence/data-fetchers.ts:907 | `.sort((a: FactUnit, b: FactUnit) => (b.filed ?? '').localeCompare(a.filed ?? ''));` | LEGITIMATE | '' only as a sort-key normalization (missing filed sorts last); no value stored. |
| src/lib/convergence/data-fetchers.ts:924 | `allLatest.sort((a, b) => (b.filed ?? '').localeCompare(a.filed ?? ''));` | LEGITIMATE | Same sort-key normalization as :907. |
| src/lib/convergence/data-fetchers.ts:926 | `const filedDate = mostRecent.filed ?? '';` | LEGITIMATE | '' yields NaN date → filingAgeHours = Infinity (:930-931), a fail-safe that can only make the filing look maximally stale, never fresher; latestFilingDate '' is honest-empty metadata. |
| src/lib/convergence/data-fetchers.ts:927 | `const filingType = mostRecent.form ?? 'unknown';` | LEGITIMATE | 'unknown' is a declared honest label in metadata; getLatest pre-filters to 10-Q/10-K so form is always present in practice; cannot bias a number. |
| src/lib/convergence/data-fetchers.ts:931 | `const filingAgeHours = isNaN(filedTime) ? Infinity : Math.round((Date.now() - filedTime) / ...);` | LEGITIMATE | (F hit) Missing/unparseable filed date → Infinity age: conservative fail-safe that biases toward "stale", cannot make absent data look current. |
| src/lib/convergence/data-fetchers.ts:934 | `const fy = mostRecent.fy ?? 0;` | GRAY | Missing fiscal year renders the persisted label fiscalPeriod as "FY 0" / "Q? 0" (:936) — a fake-looking value rather than a declared 'unknown'; label-only (no math), but Alex must rule: should missing fy/fp produce fiscalPeriod 'unknown' instead of fabricated "FY 0"? |
| src/lib/convergence/data-fetchers.ts:935 | `const fp = mostRecent.fp ?? '';` | GRAY | Same ruling as :934 — feeds the same fabricated-looking fiscalPeriod label. |
| src/lib/convergence/data-fetchers.ts:943 | `epsActual: latestEps?.val ?? null,` | LEGITIMATE | `?? null` normalization — declared honest absent. |
| src/lib/convergence/data-fetchers.ts:944 | `revenueActual: latestRevenue?.val ?? null,` | LEGITIMATE | `?? null` normalization. |
| src/lib/convergence/data-fetchers.ts:945 | `netIncomeActual: latestNetIncome?.val ?? null,` | LEGITIMATE | `?? null` normalization. |
| src/lib/convergence/data-fetchers.ts:997 | `}> = json?.data ?? [];` | LEGITIMATE | Missing payload → []; empty case explicitly handled at :1078-1094 as a declared "no transactions in 90 days" empty result with opportunisticScore null (not imputed). |
| src/lib/convergence/data-fetchers.ts:1002 | `const code = (tx.transactionCode ?? '').toUpperCase();` | GRAY | A real transaction with MISSING code still enters `transactions` and filerTxCounts with 0 buys/0 sells, adding weight with zero signal and diluting opportunisticScore toward neutral 50 (:1061-1075); Alex must rule: should missing-code transactions be excluded from the opportunistic weighting rather than diluting it? |
| src/lib/convergence/data-fetchers.ts:1003 | `const change = tx.change ?? 0;` | LEGITIMATE | 0 sentinel immediately filtered at :1004 (`if (change === 0) continue;`) — missing change excludes the row, nothing imputed. |
| src/lib/convergence/data-fetchers.ts:1006 | `const price = tx.transactionPrice != null && tx.transactionPrice > 0 ? tx.transactionPrice : null;` | LEGITIMATE | (F hit) Missing/zero price normalized to declared null; dollarValue stays null too (:1023). |
| src/lib/convergence/data-fetchers.ts:1010 | `filerName: tx.name ?? 'Unknown',` | GRAY | 'Unknown' is not just a label — filerName is the AGGREGATION KEY for uniqueFilers and per-filer trade counts (:1037, :1053-1058): several anonymous insiders collapse into one "Unknown" filer, inflating trade frequency and flipping them from opportunistic (3x weight) to routine (1x) in opportunisticScore; Alex must rule: exclude unnamed filers from filerTxCounts or key them uniquely? |
| src/lib/convergence/data-fetchers.ts:1011 | `transactionDate: tx.transactionDate ?? tx.filingDate ?? 'unknown',` | VIOLATION | Double silent fallback into persisted data: filingDate silently substitutes for transactionDate, and the literal 'unknown' lexically sorts ABOVE every ISO date ('u' > '2') so at :1038 a dateless transaction becomes latestTransactionDate='unknown', corrupting the recency field consumed downstream. |
| src/lib/convergence/data-fetchers.ts:1015 | `sharesOwnedAfter: tx.share != null ? tx.share : null,` | LEGITIMATE | (F hit) Presence-check to declared null — honest absent. |
| src/lib/convergence/data-fetchers.ts:1023 | `dollarValue: price !== null ? Math.round(shares * price) : null,` | LEGITIMATE | (F hit) Computed only from present price, else declared null. |
| src/lib/convergence/data-fetchers.ts:1044 | `totalBuyDollarValue += tx.dollarValue ?? 0;` | GRAY | Missing-price purchases add $0 to totalBuyDollarValue/netDollarFlow (persisted, scored downstream) while still counting in totalBuyCount — a real trade silently contributes zero dollar flow with no data-gap declaration; Alex must rule: is `?? 0`-in-sum acceptable as exclusion, or must missing-price transactions be declared (e.g. a gap counter)? |
| src/lib/convergence/data-fetchers.ts:1048 | `totalSellDollarValue += tx.dollarValue ?? 0;` | GRAY | Same ruling as :1044, sell side. |
| src/lib/convergence/data-fetchers.ts:1281 | `totalBuyDollarValue += tx.dollarValue ?? 0;` | GRAY | Same pattern as :1044 in the DEPRECATED fetchSECForm4Data path (still exported); same ruling needed. |
| src/lib/convergence/data-fetchers.ts:1285 | `totalSellDollarValue += tx.dollarValue ?? 0;` | GRAY | Same as :1281. |
| src/lib/convergence/data-fetchers.ts:1317 | `// Normalize to 0-100 (50 = neutral, >50 = net buying, <50 = net selling)` | LEGITIMATE | Comment/doc — the score at :1319-1322 is computed from PRESENT trades and is null when totalWeight===0 (honest absent), not an imputed 50. |
| src/lib/convergence/data-fetchers.ts:1351 | `const filerName = extractXmlValue(xml, 'rptOwnerName') ?? 'Unknown';` | GRAY | Same 'Unknown'-as-aggregation-key issue as :1010, in the DEPRECATED Form 4 XML path; same ruling needed. |
| src/lib/convergence/data-fetchers.ts:1371 | `const shares = sharesStr ? parseFloat(sharesStr) : 0;` | LEGITIMATE | (F hit) 0 sentinel immediately filtered at :1375 (`if (shares === 0 \|\| !codeStr) continue;`) — missing shares excludes the transaction. |
| src/lib/convergence/data-fetchers.ts:1372 | `const price = priceStr ? parseFloat(priceStr) : null;` | LEGITIMATE | (F hit) Declared null on absence; NaN re-checked at :1385/:1390. |
| src/lib/convergence/data-fetchers.ts:1373 | `const sharesAfter = sharesAfterStr ? parseFloat(sharesAfterStr) : null;` | LEGITIMATE | (F hit) Declared null on absence; NaN re-checked at :1386. |
| src/lib/convergence/data-fetchers.ts:1382 | `transactionDate: transactionDate ?? 'unknown',` | VIOLATION | Same defect as :1011 in the DEPRECATED path: persisted 'unknown' lexically beats ISO dates in the latestTransactionDate max at :1275, corrupting the recency field. |
| src/lib/convergence/data-fetchers.ts:1385 | `pricePerShare: price !== null && !isNaN(price) ? price : null,` | LEGITIMATE | (F hit) NaN/absence normalized to declared null. |
| src/lib/convergence/data-fetchers.ts:1386 | `sharesOwnedAfter: sharesAfter !== null && !isNaN(sharesAfter) ? sharesAfter : null,` | LEGITIMATE | (F hit) Same null normalization. |
| src/lib/convergence/data-fetchers.ts:1390 | `dollarValue: price !== null && !isNaN(price) ? Math.round(Math.abs(shares) * price) : null,` | LEGITIMATE | (F hit) Computed only from present price, else declared null. |
| src/lib/convergence/data-fetchers.ts:1401 | `return m?.[1]?.trim() ?? null;` | LEGITIMATE | `?? null` normalization in XML helper. |
| src/lib/convergence/data-fetchers.ts:1405 | `return match?.[1]?.trim() ?? null;` | LEGITIMATE | `?? null` normalization. |
| src/lib/convergence/data-fetchers.ts:1411 | `return match?.[1]?.trim() ?? null;` | LEGITIMATE | `?? null` normalization. |
| src/lib/convergence/data-fetchers.ts:1496 | `filingDate = hits[0]?._source?.file_date \|\| '';` | LEGITIMATE | '' = unknown filing date, stored as display metadata in CompanyTextProfile; not used in any computation. |
| src/lib/convergence/data-fetchers.ts:1500 | `// Fallback: use submissions endpoint to find 10-K accession number` | LEGITIMATE | Comment — the "fallback" (:1501-1524) is an alternate AUTHORITATIVE source (SEC submissions API) for the same real accession number, with declared errors on failure; not data fabrication. |
| src/lib/convergence/data-fetchers.ts:1520 | `filingDate = recent.filingDate?.[i] \|\| '';` | LEGITIMATE | Same as :1496 — '' honest-empty metadata. |
| src/lib/convergence/data-fetchers.ts:1560 | `const size = Number(item?.size ?? 0);` | LEGITIMATE | Document-selection heuristic (pick largest .htm): missing size just makes that file non-preferred; non-data selection logic, with declared error if no doc found (:1579-1581). |
| src/lib/convergence/data-fetchers.ts:1569 | `// Fallback: just pick the first .htm file` | LEGITIMATE | Comment — behavior (:1570-1577) is a document-DISCOVERY heuristic over real filing files, not value fabrication; a wrong pick is partially guarded by the <50-word declared error at :1600-1602 (residual garbage-text risk is captured at :1681). |
| src/lib/convergence/data-fetchers.ts:1681 | `rawSection = text.slice(2000, 17000);` | GRAY | (F hit) When Item 1 cannot be located, an ARBITRARY 15k-char slice of the filing (possibly TOC/risk factors) silently becomes the "business description" feeding TF-IDF peer classification; the only guard is a 50-word minimum; Alex must rule: should Item-1-not-found return a declared error instead of a positional text slice? |
| src/lib/convergence/data-fetchers.ts:1702 | `freq.set(w, (freq.get(w) ?? 0) + 1);` | LEGITIMATE | Standard counter initialization over present tokens. |
| src/lib/convergence/data-fetchers.ts:1763 | `totalShares += h.share ?? 0;` | GRAY | Holders with missing share add 0 to persisted totalInstitutionalShares while still counting in topHolderCount — undeclared partial exclusion; Alex must rule (same question as :1044): acceptable exclusion-in-sum, or must the gap be declared? |
| src/lib/convergence/data-fetchers.ts:1764 | `const change = h.change ?? 0;` | GRAY | Missing change → 0: excluded from netBuyers/netSellers and adds 0 to totalChange, but the holder still counts in topHolderCount with no gap declaration; same ruling as :1763. |
| src/lib/convergence/data-fetchers.ts:1848 | `String(b.period ?? '').localeCompare(String(a.period ?? '')),` | LEGITIMATE | Sort-key normalization only. |
| src/lib/convergence/data-fetchers.ts:1850 | `const rev = Number(sorted[0].v ?? sorted[0].value ?? sorted[0].revenue ?? 0);` | LEGITIMATE | Key-name alias chain over a present object; trailing 0 sentinel filtered by `if (rev > 0)` at :1851 — segments without a positive value are excluded, and the all-excluded case is a declared error at :1869-1871. |
| src/lib/convergence/data-fetchers.ts:1978 | `(b.period ?? '').localeCompare(a.period ?? ''),` | LEGITIMATE | Sort-key normalization only. |
| src/lib/convergence/data-fetchers.ts:1987 | `letterScore: typeof latest.letterScore === 'string' ? latest.letterScore : 'N/A',` | LEGITIMATE | (F hit) 'N/A' is a declared honest label in display metadata; numeric score is gated at :1981-1983 with a declared error when missing. |
| src/lib/convergence/data-fetchers.ts:2060 | `const headline = article.headline \|\| '';` | VIOLATION | An article with a MISSING headline is fed '' into classifyHeadline, comes back 'neutral', and enters the sentiment score denominator (:791-813) — a missing signal imputed as a neutral observation that dilutes sentiment_7d/8_30d toward 50 and is persisted as a headline entry. |
| src/lib/convergence/data-fetchers.ts:2061 | `const source = article.source \|\| '';` | LEGITIMATE | '' becomes a sourceDistribution bucket key and is never tier-1 matched, so tier1Ratio is not inflated; label/aggregation only, no score fabricated. |
| src/lib/convergence/data-fetchers.ts:2062 | `const datetime = article.datetime \|\| 0;` | LEGITIMATE | datetime is used only as a display sort key (:2083); period bucketing is done by the API date-range query, not by this field — epoch-0 cosmetic artifact only. |
| src/lib/convergence/data-fetchers.ts:2063 | `const url = article.url \|\| '';` | LEGITIMATE | Display-only metadata. |
| src/lib/convergence/data-fetchers.ts:2072 | `sourceDistribution[entry.source] = (sourceDistribution[entry.source] \|\| 0) + 1;` | LEGITIMATE | Standard counter initialization. |
| src/lib/convergence/data-fetchers.ts:2079 | `sourceDistribution[entry.source] = (sourceDistribution[entry.source] \|\| 0) + 1;` | LEGITIMATE | Standard counter initialization. |
| src/lib/convergence/data-fetchers.ts:2113 | `const tier1Ratio = totalArticles > 0 ? Math.round((tier1Count / totalArticles) * 1000) / 1000 : 0;` | GRAY | (F hit, :2113-2115) With ZERO articles tier1_ratio is imputed as 0 and persisted, while the sibling no-data fields (buzz_ratio :2092, sentiment score :809) use null — inconsistent: 0 reads as "0% tier-1 coverage" on missing data; Alex must rule: should tier1_ratio be null when totalArticles===0? |
| src/lib/convergence/data-fetchers.ts:2173 | `const type = (evt['eventType'] as string) \|\| '';` | LEGITIMATE | '' sentinel filtered at :2174 (`type !== 'Candle' continue`) — event excluded, nothing imputed. |
| src/lib/convergence/data-fetchers.ts:2177 | `const eventSymbol = (evt['eventSymbol'] as string) \|\| '';` | LEGITIMATE | '' sentinel filtered at :2179 (`if (!sym \|\| !data.has(sym)) continue;`). |
| src/lib/convergence/data-fetchers.ts:2181 | `const time = Number(evt['time'] \|\| 0);` | VIOLATION | A candle event missing its timestamp is stamped time=0 → date '1970-01-01' and PUSHED into the persisted candle series (open/close checks at :2184 do not filter it) — a fabricated epoch candle entering price history used for technical scoring. |
| src/lib/convergence/data-fetchers.ts:2182 | `const open = evt['open'] != null ? Number(evt['open']) : 0;` | LEGITIMATE | (F hit) 0 sentinel filtered at :2184 (`if (open <= 0 \|\| close <= 0) continue;`) — candle with missing open is excluded. |
| src/lib/convergence/data-fetchers.ts:2183 | `const close = evt['close'] != null ? Number(evt['close']) : 0;` | LEGITIMATE | (F hit) Same sentinel-and-skip as :2182. |
| src/lib/convergence/data-fetchers.ts:2190 | `high: evt['high'] != null ? Number(evt['high']) : open,` | VIOLATION | (F hit) Missing high is silently IMPUTED as open in persisted candle data — fabricated market value that flattens the daily range and biases any range/volatility computation downward, with no gap declaration. |
| src/lib/convergence/data-fetchers.ts:2191 | `low: evt['low'] != null ? Number(evt['low']) : open,` | VIOLATION | (F hit) Same fabrication as :2190 for low. |
| src/lib/convergence/data-fetchers.ts:2193 | `volume: evt['volume'] != null ? Number(evt['volume']) : 0,` | VIOLATION | (F hit) Missing volume silently stored as 0 in persisted candle data — indistinguishable from a genuine zero-volume day and biases liquidity/volume metrics, with no gap declaration. |
| src/lib/convergence/data-fetchers.ts:2259 | `// ===== FINNHUB EBITDA ESTIMATES FETCHER =====` | LEGITIMATE | Comment/section header; keyword match only. |
| src/lib/convergence/data-fetchers.ts:2261 | `export async function fetchFinnhubEbitdaEstimates(` | LEGITIMATE | Function name keyword match only. |
| src/lib/convergence/data-fetchers.ts:2264 | `): Promise<{ data: FinnhubEbitdaEstimate \| null; error: string \| null }> {` | LEGITIMATE | Declared {data,error} return shape — the constitutional honest-failure contract. |
| src/lib/convergence/data-fetchers.ts:2270 | `\`https://finnhub.io/api/v1/stock/ebitda-estimate?symbol=${symbol}&freq=quarterly&token=${key}\`,` | LEGITIMATE | URL keyword match only. |
| src/lib/convergence/data-fetchers.ts:2272 | `if (!resp.ok) return { data: null, error: \`ebitda-estimate ${symbol}: HTTP ${resp.status}\` };` | LEGITIMATE | Declared error on HTTP failure — fail-loud shape. |
| src/lib/convergence/data-fetchers.ts:2276 | `const estimates: FinnhubEbitdaEstimateEntry[] = raw.map((e: Record<string, unknown>) => ({` | LEGITIMATE | Identifier keyword match; mapping normalizes to explicit nulls (:2278-2281). |
| src/lib/convergence/data-fetchers.ts:2277 | `period: String(e.period ?? ''),` | LEGITIMATE | '' normalization of a missing period label; numeric fields alongside use declared null — no number fabricated. |
| src/lib/convergence/data-fetchers.ts:2284 | `return { data: { symbol, estimates }, error: null };` | LEGITIMATE | Return statement; keyword in identifier only. |
| src/lib/convergence/data-fetchers.ts:2286 | `return { data: null, error: \`ebitda-estimate ${symbol}: ...\` };` | LEGITIMATE | Declared error shape — behavior classified in catch table at :2285. |
| src/lib/convergence/data-fetchers.ts:2290 | `// ===== FINNHUB EBIT ESTIMATES FETCHER =====` | LEGITIMATE | Comment/section header. |
| src/lib/convergence/data-fetchers.ts:2292 | `export async function fetchFinnhubEbitEstimates(` | LEGITIMATE | Function name keyword match only. |
| src/lib/convergence/data-fetchers.ts:2295 | `): Promise<{ data: FinnhubEbitEstimate \| null; error: string \| null }> {` | LEGITIMATE | Declared {data,error} shape. |
| src/lib/convergence/data-fetchers.ts:2301 | `\`https://finnhub.io/api/v1/stock/ebit-estimate?symbol=${symbol}&freq=quarterly&token=${key}\`,` | LEGITIMATE | URL keyword match only. |
| src/lib/convergence/data-fetchers.ts:2303 | `if (!resp.ok) return { data: null, error: \`ebit-estimate ${symbol}: HTTP ${resp.status}\` };` | LEGITIMATE | Declared error on HTTP failure. |
| src/lib/convergence/data-fetchers.ts:2307 | `const estimates: FinnhubEbitEstimateEntry[] = raw.map((e: Record<string, unknown>) => ({` | LEGITIMATE | Identifier keyword match; explicit-null mapping (:2309-2312). |
| src/lib/convergence/data-fetchers.ts:2308 | `period: String(e.period ?? ''),` | LEGITIMATE | Same as :2277. |
| src/lib/convergence/data-fetchers.ts:2315 | `return { data: { symbol, estimates }, error: null };` | LEGITIMATE | Return statement; keyword match only. |
| src/lib/convergence/data-fetchers.ts:2317 | `return { data: null, error: \`ebit-estimate ${symbol}: ...\` };` | LEGITIMATE | Declared error shape — catch table :2316. |
| src/lib/convergence/data-fetchers.ts:2343 | `date: String(d.date ?? ''),` | LEGITIMATE | '' normalization of missing date label; amount fields use declared null (:2344-2345). |
| src/lib/convergence/data-fetchers.ts:2377 | `const m = json?.metric ?? {};` | LEGITIMATE | Missing metric object → every FinnhubPriceMetrics field becomes declared null via typeof checks (:2383-2391); no value fabricated (all-null data returned with error:null — nulls are the honest-absent shape). |
| src/lib/convergence/data-fetchers.ts:2419 | `name: String(f.name ?? ''),` | LEGITIMATE | '' honest-empty fund-name label; unlike :1010 it is not used as a scoring aggregation key in this file. |
| src/lib/convergence/data-fetchers.ts:2461 | `const src = (h._source ?? {}) as Record<string, unknown>;` | LEGITIMATE | Missing _source → all fields '' / null via the explicit normalizations at :2463-2466; no value fabricated. |
| src/lib/convergence/data-fetchers.ts:2463 | `filedAt: String(src.file_date ?? src.filed_at ?? ''),` | LEGITIMATE | Key-alias chain over schema variants of present data, then '' honest-empty; display metadata. |
| src/lib/convergence/data-fetchers.ts:2464 | `formType: String(src.form_type ?? '8-K'),` | LEGITIMATE | The EFTS query is restricted to forms=8-K (:2448), so the default can only label a hit with the sole form type the search can return — cannot mislabel. |
| src/lib/convergence/data-fetchers.ts:2504 | `date: typeof e.date === 'string' ? e.date : '',` | LEGITIMATE | (F hit) '' honest-empty date label in earnings-calendar entry; numeric fields use declared null. |
| src/lib/convergence/data-fetchers.ts:2506 | `epsEstimate: typeof e.epsEstimate === 'number' ? e.epsEstimate : null,` | LEGITIMATE | Presence-check to declared null — honest absent. |
| src/lib/convergence/data-fetchers.ts:2510 | `revenueEstimate: typeof e.revenueEstimate === 'number' ? e.revenueEstimate : null,` | LEGITIMATE | Same null normalization. |
| src/lib/convergence/data-fetchers.ts:2511 | `symbol: typeof e.symbol === 'string' ? e.symbol : symbol,` | LEGITIMATE | (F hit) Falls back to the REQUESTED symbol — the endpoint is queried per-symbol, so the default equals the only correct value. |

### Catch blocks

| file:line | what the catch does (verbatim key line) | class | note |
|---|---|---|---|
| src/lib/convergence/data-fetchers.ts:95 | `.catch((e) => { console.error(\`[Finnhub] eps-estimate ${symbol} fetch error:\`, ...); return null; })` | (c) SWALLOW | console.error only; null → epsEstimates stays [] and FinnhubEstimateData carries no error channel — caller cannot distinguish fetch failure from "no estimates exist". Mitigated only by the no-cache-on-empty gate (:150-156). Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:96 | `.catch((e) => { console.error(\`[Finnhub] revenue-estimate ...\`); return null; })` | (c) SWALLOW | Same as :95. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:97 | `.catch((e) => { console.error(\`[Finnhub] price-target ...\`); return null; })` | (c) SWALLOW | Same as :95 — priceTarget stays null with no error declaration. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:98 | `.catch((e) => { console.error(\`[Finnhub] upgrade-downgrade ...\`); return null; })` | (c) SWALLOW | Same as :95. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:105 | `console.error(\`[Finnhub] eps-estimate ${symbol}:\`, e instanceof Error ? e.message : String(e));` | (c) SWALLOW | JSON parse failure logged to console only; empty [] flows into result with no error declaration. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:116 | `console.error(\`[Finnhub] revenue-estimate ${symbol}:\`, ...);` | (c) SWALLOW | Same as :105. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:129 | `console.error(\`[Finnhub] price-target ${symbol}:\`, ...);` | (c) SWALLOW | Same as :105. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:140 | `console.error(\`[Finnhub] upgrade-downgrade ${symbol}:\`, ...);` | (c) SWALLOW | Same as :105. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:199 | `console.error(\`[Finnhub] fundamentals ${symbol}:\`, ...);` | (c) SWALLOW | console.error only; fundamentals stays null — FinnhubData has NO error field, so single-ticker callers get silent nulls (batch callers get stats.errors via :279). Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:214 | `console.error(\`[Finnhub] recommendations ${symbol}:\`, ...);` | (c) SWALLOW | Same as :199 — [] flows with no error channel. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:231 | `console.error(\`[Finnhub] insider-sentiment ${symbol}:\`, ...);` | (c) SWALLOW | Same as :199. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:246 | `console.error(\`[Finnhub] earnings ${symbol}:\`, ...);` | (c) SWALLOW | Same as :199. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:253 | `console.error(\`[Finnhub] estimates ${symbol}:\`, ...);` | (c) SWALLOW | Same as :199 — estimateData stays null with no error declaration. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:281 | `console.error(\`[Finnhub Batch] ${symbol} failed:\`, ...); stats.errors++;` | (b) declare loudly | Failure counted in returned FinnhubBatchStats.errors and logged; per-symbol empty shape set explicitly. |
| src/lib/convergence/data-fetchers.ts:372 | `return { data: null, error: \`financials-reported: ${...}\` };` | (b) declare loudly | Declared {data:null,error} honest-failure shape. |
| src/lib/convergence/data-fetchers.ts:401 | `.catch(() => null),` (bs statement fetch) | (c) SWALLOW | NO logging at all; a single-statement failure silently yields null fields for that statement in every period — only the ALL-three-empty case is declared (:413-414). Fail-loud VIOLATION for partial failure. |
| src/lib/convergence/data-fetchers.ts:402 | `.catch(() => null),` (ic statement fetch) | (c) SWALLOW | Same as :401. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:403 | `.catch(() => null),` (cf statement fetch) | (c) SWALLOW | Same as :401. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:504 | `return { data: null, error: \`quarterly-financials: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:598 | `errors.push(\`${series.id}: ${e instanceof Error ? e.message : String(e)}\`);` | (b) declare loudly | Per-series failure pushed to errors[] and returned joined in the error field (:661); the field stays null (honest absent). |
| src/lib/convergence/data-fetchers.ts:619 | `errors.push(\`PAYEMS: ${...}\`);` | (b) declare loudly | Same errors[] mechanism. |
| src/lib/convergence/data-fetchers.ts:653 | `errors.push(\`CPIAUCSL: ${...}\`);` | (b) declare loudly | Same errors[] mechanism. |
| src/lib/convergence/data-fetchers.ts:725 | `errors.push(\`${seriesId}: ${...}\`);` | (b) declare loudly | Same errors[] mechanism (:734). |
| src/lib/convergence/data-fetchers.ts:849 | `} catch { return null; }` (lookupCIK) | (b) declare loudly | null is the function's declared failure signal and every caller converts it to a declared error ('CIK lookup failed' at :870/:1182/:1473); note the underlying cause (network vs missing cik) is discarded. |
| src/lib/convergence/data-fetchers.ts:951 | `return { data: null, error: \`sec-edgar: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1111 | `return { data: null, error: \`insider-transactions: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1155 | `return { data: null, error: \`stock/peers: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1257 | `} catch { // Skip individual filing parse errors }` | (c) SWALLOW | A Form 4 filing that fails fetch/parse is silently omitted from transactions with no log and no gap counter — aggregates silently undercount. DEPRECATED path but still exported. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:1339 | `return { data: null, error: \`sec-form4: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1620 | `return { data: null, error: \`sec-10k-text: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1730 | `.catch(() => null),` (stock/ownership fetch) | (c) SWALLOW | No logging; if only this endpoint fails, fund-ownership data still flows and the failure is invisible — only the BOTH-empty case is declared (:1752-1754). Fail-loud VIOLATION for partial failure. |
| src/lib/convergence/data-fetchers.ts:1731 | `.catch(() => null),` (fund-ownership fetch) | (c) SWALLOW | Same as :1730. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:1742 | `} catch { /* ignore parse errors */ }` | (c) SWALLOW | JSON parse failure of ownership response ignored with no log; holders from that endpoint silently dropped (both-empty case declared at :1752). Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:1749 | `} catch { /* ignore parse errors */ }` | (c) SWALLOW | Same as :1742 for fund-ownership response. Fail-loud VIOLATION. |
| src/lib/convergence/data-fetchers.ts:1784 | `return { data: null, error: \`institutional-ownership: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1889 | `return { data: null, error: \`revenue-breakdown2: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1939 | `return { data: null, error: \`news-sentiment: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:1992 | `return { data: null, error: \`earnings-quality-score: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2132 | `return { data: null, error: \`company-news: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2248 | `console.error(\`[CandleBatch] Connection failed:\`, msg); stats.symbols_failed = [...symbols];` | (b) declare loudly | All symbols recorded in returned stats.symbols_failed plus console.error — failure visible in returned stats. |
| src/lib/convergence/data-fetchers.ts:2285 | `return { data: null, error: \`ebitda-estimate ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2316 | `return { data: null, error: \`ebit-estimate ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2353 | `return { data: null, error: \`dividend ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2395 | `return { data: null, error: \`price-metric ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2433 | `return { data: null, error: \`fund-ownership ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2478 | `return { data: null, error: \`sec-8k-scan ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |
| src/lib/convergence/data-fetchers.ts:2516 | `return { data: null, error: \`earnings-calendar ${symbol}: ${...}\` };` | (b) declare loudly | Declared {data:null,error} shape. |

### Self-check
- grep A: 47 lines, B: 16, C: 0, D: 63, E: 47; unique lines rowed in pattern table: 148.
  - Dedup union of A∪B∪C∪D = 126 (no line matched more than one of A/B/C/D).
  - Step F added 22 lines not caught by A–D: 194, 902, 931, 1006, 1015, 1023, 1371, 1372, 1373, 1385, 1386, 1390, 1681, 1987, 2113, 2182, 2183, 2190, 2191, 2193, 2504, 2511. 126 + 22 = 148 rows. No A/B/C/D hit line was excluded.
  - Lines 95 and 96 appear in both the pattern table (grep D keyword) and the catch table (grep E) — intentional, per the two-table structure.
- Catch table: 47 rows = 47 grep E hits, none excluded.
- Pattern-table classification counts: VIOLATION 7, GRAY 16, LEGITIMATE 125.
- Catch-table (c) silent-swallow rows (fail-loud violations): 21 (lines 95, 96, 97, 98, 105, 116, 129, 140, 199, 214, 231, 246, 253, 401, 402, 403, 1257, 1730, 1731, 1742, 1749).

# Fallback census — vol-edge.ts + quality-gate.ts
Repo: /home/user/temple-stuart-accounting @ main c12e48f7 (read-only). Date: 2026-07-06.
Method: grep -nE patterns A-E per task + full-file Read for F (ternary/initializer literals in scoring paths). Line numbers from grep -n / Read output.

Key composite facts used in classification (traced, not assumed):
- vol-edge composite (src/lib/convergence/vol-edge.ts:1054-1155): technicals excluded+renormalized only when RAW `input.candles.length < 20` (:1059,:1080); skew+GEX excluded+renormalized only when `chainDetail.length === 0` (:1060,:1094-1109,:1128-1154). Any skew/GEX neutral-50 produced while chain is non-empty (spot missing, no ≥7-DTE expiration, no valid strike IVs) stays at weight 0.10 and is NOT tracked in imputed/excluded fields (:1183 keys off chain length only).
- quality-gate composite (src/lib/convergence/quality-gate.ts:1059-1065): all four sub-scores always enter at fixed weights; sub-components are never excluded/renormalized (sole exception: safety volume when candles < 20, :380-391). Missing-data component defaults therefore always enter the stored score; most are tracked in data_confidence.imputed_fields (:1086-1115) but per the fail-loud mandate ("missing signals are excluded and re-normalized, never imputed") they are classified VIOLATION.

---

## src/lib/convergence/vol-edge.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| vol-edge.ts:27 | `if (arr.length === 0) return 0;` | LEGITIMATE | mean() helper guard; every scoring call site passes a length-guarded array (:93, :108, :161, :678-679) — cannot fire as an imputation. |
| vol-edge.ts:32 | `if (arr.length < 2) return 0;` | LEGITIMATE | stddev() returning 0 makes zScore return null via the `s < 0.001` guard (:140) — produces exclusion, not fabrication. |
| vol-edge.ts:40 | `const groupKey = input.peerGroupAssignment?.[symbol] ?? null;` | LEGITIMATE | `?? null` normalization; no group ⇒ raw mode (no peer transform), nothing imputed. |
| vol-edge.ts:60 | `changes.push(Number.isFinite(diff) ? diff : 0);` | LEGITIMATE | Dead guard — RSI runs only on candles pre-sanitized to finite closes (:600-606), so diff is always finite. |
| vol-edge.ts:113 | `const position = upper !== lower ? (lastClose - lower) / (upper - lower) : 0.5;` | LEGITIMATE | BB position 0.5 only when upper===lower on a real zero-variance 20-candle window — computed from PRESENT data. |
| vol-edge.ts:128 | `if (sortedValues.length === 0) return 50;` | LEGITIMATE | Defensive; every percentileRank call site guards non-empty (:257-259, :324-336, :526-528) — unreachable as a default. |
| vol-edge.ts:156 | `// peer proxy, never a fabricated mean=0 / scaled std. No distribution ⇒ null.` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:158-165 (null on missing distribution). |
| vol-edge.ts:174 | `note: \`peer_z: null (no peer group data available); vrp_z: ${vrpZSource ?? 'null (…)'}\`` | LEGITIMATE | Display-only trace string; `?? 'null…'` substitutes text, not a score. |
| vol-edge.ts:196 | `const hvAccelZ = hv30Stats ? zScore(hvAccel, 0, hv30Stats.std) : null;` | GRAY | Assumes peer mean=0 and reuses the peers' HV30 std as the HV30−HV60 spread std; this z enters hvAccelScore in z-score-fallback mode (:346-348). Question for Alex: is mean=0 / std(hv30) an acceptable prior for the peer spread distribution, or must hv_accel skip the peer transform without a true spread distribution? |
| vol-edge.ts:199 | `const peerCount = stats.ticker_count ?? 0;` | LEGITIMATE | Missing count → 0 → transform 'raw' (:201-202) — conservative: disables the peer transform rather than fabricating one. |
| vol-edge.ts:201 | `const transform: 'percentile' \| 'z-score-fallback' \| 'raw' =` | LEGITIMATE | Type/label declaration for the transform selector; selection logic classified at :202. |
| vol-edge.ts:202 | `peerCount >= 5 ? 'percentile' : peerCount >= 3 ? 'z-score-fallback' : 'raw';` | LEGITIMATE | Selects transform from present peer count; "fallback" here is a labeled degradation of method, not a fabricated value. |
| vol-edge.ts:210 | `note: \`peer z-scores vs ${peerGroupName} peers (…); vrp_z: ${vrpZSource ?? 'null (…)'}\`` | LEGITIMATE | Display-only trace string. |
| vol-edge.ts:219 | `const iv30 = tt?.iv30 ?? null;` | LEGITIMATE | `?? null` normalization; downstream null handling classified per component. |
| vol-edge.ts:220 | `const hv30 = tt?.hv30 ?? null;` | LEGITIMATE | `?? null` normalization. |
| vol-edge.ts:221 | `const hv60 = tt?.hv60 ?? null;` | LEGITIMATE | `?? null` normalization. |
| vol-edge.ts:222 | `const hv90 = tt?.hv90 ?? null;` | LEGITIMATE | `?? null` normalization. |
| vol-edge.ts:223 | `let ivp = tt?.ivPercentile ?? null;` | LEGITIMATE | `?? null` normalization; the consequential default classified at :270. |
| vol-edge.ts:226 | `const ivHvSpread = tt?.ivHvSpread ?? null;` | LEGITIMATE | `?? null` normalization; consequence classified at :276. |
| vol-edge.ts:227 | `let ivr = tt?.ivRank ?? null;` | LEGITIMATE | `?? null` normalization; null IVR is excluded (:273, :360-362). |
| vol-edge.ts:247 | `const peerCount = peerEntry?.ticker_count ?? 0;` | LEGITIMATE | Same conservative pattern as :199. |
| vol-edge.ts:251 | `// scan_snapshots (>= 20 distinct scan days). No peer proxy, no fixed linear` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:255-265 (VRP excluded when no own history). |
| vol-edge.ts:270 | `const ivpScoreRaw = ivp !== null ? clamp(ivp, 0, 100) : 40; // penalty default — missing IVP` | VIOLATION | Missing IVP imputes 40 into the IV composite (0.30 of mispricing, which is 0.40 of vol edge); tracked in imputed_fields (:1170) but ENTERS the score instead of being excluded + renormalized like VRP. |
| vol-edge.ts:272 | `// IVR component: same identity mapping as IVP (null if unavailable → fallback to IVP only)` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:273. |
| vol-edge.ts:273 | `const ivrScoreRaw = ivr !== null ? clamp(ivr, 0, 100) : null;` | LEGITIMATE | Null IVR is EXCLUDED — composite degrades to IVP-only (:360-362); no fabricated value. |
| vol-edge.ts:276 | `let ivHvSpreadScoreRaw = 40; // penalty default — missing IV-HV spread` | VIOLATION | Missing IV-HV spread imputes 40 at 0.25 weight of mispricing; tracked (:1171) but enters the score rather than exclusion + renormalization. |
| vol-edge.ts:282 | `let hvAccelScoreRaw = 40; // penalty default — missing HV data` | VIOLATION | Missing HV30/60/90 imputes 40 at 0.15 weight of mispricing; tracked (:1172) but enters the score rather than exclusion + renormalization. |
| vol-edge.ts:299 | `hvAccelScoreRaw = 50;` | LEGITIMATE | FLAT tier computed from PRESENT HV30/HV60/HV90 (:284-300). |
| vol-edge.ts:306 | `// 3-4 peers → z-score fallback (multiplier=10, clip=±5 SD — less aggressive)` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:338-349. |
| vol-edge.ts:309 | `// history above (the old peer iv_hv_spread proxy percentile and the` | LEGITIMATE | comment/doc — describes removed legacy behavior. |
| vol-edge.ts:310 | `// zScore(vrp, 0, …) fallback are removed).` | LEGITIMATE | comment/doc — describes removed legacy behavior. |
| vol-edge.ts:338 | `} else if (hasPeerZScores && zScores.transform === 'z-score-fallback') {` | LEGITIMATE | Branch applying the labeled z-transform to PRESENT metrics only (each guarded `!== null`, :340-348). |
| vol-edge.ts:368 | `// remaining weights renormalize (never imputed, never proxied).` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:369-375 (VRP exclusion + renormalization, the EDGE-4 pattern). |
| vol-edge.ts:410 | `? \`VRP=${round(vrpScore)}(own-history percentile,z=${zScores.vrp_z ?? 'null'})\`` | LEGITIMATE | Display-only trace string. |
| vol-edge.ts:447 | `const ts = input.ttScanner?.termStructure ?? [];` | LEGITIMATE | Normalization to empty array; the consequential score default classified at :452. |
| vol-edge.ts:448 | `const earningsDate = input.ttScanner?.earningsDate ?? null;` | LEGITIMATE | `?? null` normalization; missing date only disables kink detection (:547). |
| vol-edge.ts:452 | `score: 40,` | VIOLATION | <2 expirations imputes the WHOLE term-structure sub-score as 40 at composite weight 0.25; tracked as imputed (:1175) but enters the score — never excluded/renormalized like technicals/skew/gex. |
| vol-edge.ts:455 | `formula: 'Insufficient term structure data (< 2 expirations) → penalty default 40 (missing data)',` | LEGITIMATE | comment/doc (loud formula string) — behavior itself classified at vol-edge.ts:452. |
| vol-edge.ts:472 | `const slope = frontIV > 0 ? (backIV - frontIV) / frontIV : 0;` | GRAY | A non-positive front-month IV (degenerate present data) is silently scored as slope 0 → FLAT → ~50. Question for Alex: should a term structure with front IV ≤ 0 be treated as missing/excluded instead of flat-neutral? |
| vol-edge.ts:495 | `// Find optimal expiration within theta-efficient DTE range (25-60, fallback 20-90)` | LEGITIMATE | comment/doc — the 20-90 fallback range (:498-501) affects only the `optimal_expiration` display string, never the score. |
| vol-edge.ts:522 | `const tsPeerCount = tsPeerEntry?.ticker_count ?? 0;` | LEGITIMATE | Same conservative pattern as :199. |
| vol-edge.ts:531 | `// 3-4 peers: z-score fallback (multiplier=10, clip=±5 SD)` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:532-534 (z from present peer stats). |
| vol-edge.ts:534 | `tsTransform = 'z-score-fallback';` | LEGITIMATE | Label assignment recording the transform used; no value fabricated. |
| vol-edge.ts:536 | `// <3 peers or no peer stats: fixed tier fallback` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:537-542. |
| vol-edge.ts:539 | `else if (slope > -0.05) shapeScore = 50;` | LEGITIMATE | Fixed-tier score computed from the PRESENT slope in raw mode (<3 peers); a method degradation on real data, not an imputation. |
| vol-edge.ts:559 | `: prevIV ?? nextIV ?? 0;` | LEGITIMATE | Kink-detection neighborAvg; the 0 fails the `neighborAvg > 0` guard (:560), so missing neighbors can only DISABLE kink detection, never fabricate one. |
| vol-edge.ts:610 | `score: 40,` | VIOLATION | Reachable: scoreTechnicals is called when RAW candles ≥ 20 (:1080) but SANITIZED candles (:600-606) can drop below 20 — this imputes technicals=40 at weight 0.15 into the composite, and data-confidence tracking misses it because hasCandles (:1059,:1177) checks raw length. |
| vol-edge.ts:613 | `formula: \`Insufficient candle data (${candles.length} < 20 required) → penalty default 40 (missing data)\`,` | LEGITIMATE | comment/doc (loud formula string) — behavior itself classified at vol-edge.ts:610. |
| vol-edge.ts:615 | `sub_scores: { rsi_score: 40, trend_score: 40, bollinger_score: 40, volume_score: 40, high52w_score: 40 },` | LEGITIMATE | Trace display of the imputed sub-scores; the scoring behavior itself classified at vol-edge.ts:610. |
| vol-edge.ts:633 | `let rsiScore = 55;` | LEGITIMATE | Dead default — the :608 guard guarantees ≥ 20 sanitized candles, so RSI(14) (needs 15) is always computable; 55 otherwise only arises from a PRESENT RSI in the 40-60 band (:639). |
| vol-edge.ts:639 | `else if (rsi <= 60) rsiScore = 55;  // Neutral — baseline, no edge signal` | LEGITIMATE | RSI neutral band computed from real candles. |
| vol-edge.ts:640 | `else if (rsi <= 70) rsiScore = 60;  // Mildly overbought — slightly above neutral` | LEGITIMATE | Tier from present RSI. |
| vol-edge.ts:650 | `let trendScore = 50;` | LEGITIMATE | sma20 is guaranteed non-null (≥20 candles), so 50 persists only when BOTH SMAs are present but price sits in an unmatched configuration — computed-from-present-data edge, not a missing-data default. |
| vol-edge.ts:659 | `trendScore = 30; // Clear downtrend` | LEGITIMATE | Tier from present close/SMA data. |
| vol-edge.ts:664 | `trendScore = latestClose > sma20 ? 60 : 40;` | LEGITIMATE | Computed from present close vs present SMA20 (sma50 legitimately null with 20-49 candles — coarser method on real data). |
| vol-edge.ts:669 | `// For neutral strategies: price near middle = best, extremes = opportunity but risky` | LEGITIMATE | comment/doc — behavior at :671-675 computed from present BB position. |
| vol-edge.ts:670 | `let bollingerScore = 50;` | LEGITIMATE | Dead default — bb.position is non-null whenever candles ≥ 20 (:96-105), which :608 guarantees. |
| vol-edge.ts:682 | `let volumeScore = 50;` | GRAY | volumeRatio is null here only when the 20d average volume is exactly 0 (volume data PRESENT but all zeros, passes the `volume >= 0` filter) — the neutral 50 then enters technicals at the 0.15 sub-weight. Question for Alex: should an all-zero-volume window score neutral 50 or the low-liquidity tier (≤40)? |
| vol-edge.ts:687 | `else volumeScore = 40;                          // Low volume → less liquid` | LEGITIMATE | Tier from PRESENT volume ratio. |
| vol-edge.ts:703 | `let high52wScore = 40; // penalty default — missing Finnhub 52-week data` | VIOLATION | Missing Finnhub 52WeekHigh imputes 40 at 0.15 weight of technicals; tracked (:1180) but enters the score rather than exclusion + renormalization. |
| vol-edge.ts:710 | `else high52wScore = 25;` | LEGITIMATE | Tier from PRESENT 52-week ratio. |
| vol-edge.ts:728 | `notes: \`RSI(14)=${rsiResult.rsi ?? 'N/A'}, SMA20=${sma20 ?? 'N/A'}, …\`` | LEGITIMATE | Display-only trace string. |
| vol-edge.ts:764 | `const spot = flow?.underlyingPrice ?? null;` | LEGITIMATE | `?? null` normalization; the consequential neutral default classified at :768. |
| vol-edge.ts:768 | `score: 50, weight: 0.10,` | VIOLATION | The guard (:766) conflates two cases: chain empty → weight later zeroed + excluded (:1107,:1152,:1183-1186, harmless); but chain PRESENT with spot null/≤0 → this neutral 50 stays at composite weight 0.10 and is NOT tracked (data confidence keys off chain length only, :1060). Neutral imputation on missing spot. |
| vol-edge.ts:770 | `formula: 'No options chain data → neutral default 50',` | LEGITIMATE | comment/doc (formula string) — behavior itself classified at vol-edge.ts:768. |
| vol-edge.ts:773 | `skew_direction: 'neutral', skew_score: 50,` | LEGITIMATE | Trace display of the same return; behavior classified at vol-edge.ts:768. |
| vol-edge.ts:784 | `score: 50, weight: 0.10,` | VIOLATION | Chain data PRESENT (so skew weight stays 0.10) but no expiration ≥ 7 DTE — neutral 50 enters the composite and is not recorded in imputed/excluded fields; missing-signal imputed as neutral. |
| vol-edge.ts:786 | `formula: 'No expirations >= 7 DTE → neutral default 50',` | LEGITIMATE | comment/doc (formula string) — behavior itself classified at vol-edge.ts:784. |
| vol-edge.ts:789 | `skew_direction: 'neutral', skew_score: 50,` | LEGITIMATE | Trace display; behavior classified at vol-edge.ts:784. |
| vol-edge.ts:818 | `const putIV25d = bestPutStrike?.putIV ?? null;` | LEGITIMATE | `?? null` normalization; null path handled by exclusion in the blend (:868-876). |
| vol-edge.ts:819 | `const callIV25d = bestCallStrike?.callIV ?? null;` | LEGITIMATE | `?? null` normalization. |
| vol-edge.ts:845 | `let skewScoreFromVol = 50;` | LEGITIMATE | Dead-when-missing: if volSkew25d is null the blend (:868-876) never uses this variable; overwritten from present data otherwise. |
| vol-edge.ts:852 | `let skewScoreFromPCR = 50;` | LEGITIMATE | Same dead-when-missing pattern as :845. |
| vol-edge.ts:855 | `// Ratio 0.95-1.05 → neutral → 50` | LEGITIMATE | comment/doc — behavior at :857-861 computed from present PC IV ratio. |
| vol-edge.ts:875 | `skewScore = 50;` | VIOLATION | Fires when BOTH skew metrics are null (no strikes with valid put/call IV) while chain+spot are present — neutral 50 enters the composite at 0.10 weight, untracked in data confidence. |
| vol-edge.ts:878 | `const skewDirection: 'bullish' \| 'bearish' \| 'neutral' =` | LEGITIMATE | Label declaration. |
| vol-edge.ts:879 | `skewScore >= 60 ? 'bullish' : skewScore <= 40 ? 'bearish' : 'neutral';` | LEGITIMATE | Display label derived from the already-computed score. |
| vol-edge.ts:891 | `put_strike_25d: bestPutStrike?.strike ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| vol-edge.ts:892 | `call_strike_25d: bestCallStrike?.strike ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| vol-edge.ts:893 | `atm_strike: atmStrike?.strike ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| vol-edge.ts:926 | `const spot = flow?.underlyingPrice ?? null;` | LEGITIMATE | `?? null` normalization; consequential default classified at :930. |
| vol-edge.ts:930 | `score: 50, weight: 0.10,` | VIOLATION | Same conflation as :768, for GEX: chain empty → excluded+renormalized upstream (harmless), but chain PRESENT with spot null/≤0 → neutral 50 enters the composite at 0.10, untracked. |
| vol-edge.ts:932 | `formula: 'No options chain data → neutral default 50',` | LEGITIMATE | comment/doc (formula string) — behavior itself classified at vol-edge.ts:930. |
| vol-edge.ts:935 | `distance_to_flip_pct: null, gex_regime: 'neutral', gex_score: 50,` | LEGITIMATE | Trace display; behavior classified at vol-edge.ts:930. |
| vol-edge.ts:939 | `// Risk-free rate from FRED treasury 10Y, fallback 4.5%` | LEGITIMATE | comment/doc — behavior itself classified at vol-edge.ts:940. |
| vol-edge.ts:940 | `const rfr = (input.fredMacro?.treasury10y ?? 4.5) / 100;` | VIOLATION | Missing FRED macro silently imputes a 4.5% risk-free rate that feeds Black-Scholes d1 (:919) → every per-strike gamma → net GEX and the cumulative-GEX flip strike (:971-998) → distance-to-flip (:1001) → gexScore = 50 + dist×7 (:1022) at 0.10 composite weight. Biases: BS gamma → GEX flip location → gex score, with no imputed_fields entry and no trace flag that the rate was assumed (inputs.risk_free_rate shows 4.5 as if real). |
| vol-edge.ts:1006 | `let gexRegime: 'long_gamma' \| 'short_gamma' \| 'neutral';` | LEGITIMATE | Type declaration for a display label. |
| vol-edge.ts:1010 | `else gexRegime = 'neutral';                                  // near flip point` | LEGITIMATE | Label computed from present distance-to-flip. |
| vol-edge.ts:1012 | `gexRegime = 'neutral';` | LEGITIMATE | Display label for the null-distance case; the score consequence is classified at vol-edge.ts:1024. |
| vol-edge.ts:1018 | `// Near flip → neutral` | LEGITIMATE | comment/doc — behavior at :1019-1025. |
| vol-edge.ts:1024 | `gexScore = 50;` | VIOLATION | distanceToFlipPct is null only when NO strike had valid IV+OI (perStrikeGex empty) though the chain is present — neutral 50 enters the composite at 0.10 weight, untracked in data confidence. |
| vol-edge.ts:1030 | `const formula = \`distToFlip=${distanceToFlipPct ?? 'N/A'}% → … flip=${flipStrike ?? 'N/A'}]\`` | LEGITIMATE | Display-only trace string. |
| vol-edge.ts:1043 | `notes: \`Net GEX=${netGexDisplay}M $-gamma, flip=${flipStrike ?? 'N/A'}, dist=${distanceToFlipPct ?? 'N/A'}%, …\`` | LEGITIMATE | Display-only trace string. |
| vol-edge.ts:1060 | `const hasChainData = (input.optionsFlow?.chainDetail?.length ?? 0) > 0;` | LEGITIMATE | Presence check driving exclusion + renormalization (the correct pattern); its blind spot (spot/strike validity) is classified at :768/:930/:875/:1024. |
| vol-edge.ts:1158 | `// imputed = a placeholder value is still in the score (penalty defaults);` | LEGITIMATE | comment/doc — bookkeeping definition. |
| vol-edge.ts:1163 | `const imputedFields: string[] = [];` | LEGITIMATE | Data-confidence bookkeeping initializer. |
| vol-edge.ts:1166 | `// EDGE-4: VRP is excluded+renormalized (never imputed) when its own-history` | LEGITIMATE | comment/doc — behavior classified at vol-edge.ts:369-375. |
| vol-edge.ts:1170 | `if (tt?.ivPercentile == null) imputedFields.push('mispricing.ivp');` | LEGITIMATE | Bookkeeping that DECLARES the :270 imputation (does not bias any score). |
| vol-edge.ts:1171 | `if (tt?.ivHvSpread == null) imputedFields.push('mispricing.iv_hv_spread');` | LEGITIMATE | Bookkeeping declaring the :276 imputation. |
| vol-edge.ts:1172 | `if (tt?.hv30 == null \|\| tt?.hv60 == null \|\| tt?.hv90 == null) imputedFields.push('mispricing.hv_accel');` | LEGITIMATE | Bookkeeping declaring the :282 imputation. |
| vol-edge.ts:1174 | `const tsLen = tt?.termStructure?.length ?? 0;` | LEGITIMATE | Bookkeeping presence count. |
| vol-edge.ts:1175 | `if (tsLen < 2) imputedFields.push('term_structure');` | LEGITIMATE | Bookkeeping declaring the :452 imputation. |
| vol-edge.ts:1180 | `if (!input.finnhubFundamentals?.metric?.['52WeekHigh']) imputedFields.push('technicals.high52w');` | LEGITIMATE | Bookkeeping declaring the :703 imputation (truthiness vs the `> 0` check at :696 is consistent since 0 is invalid there too). |
| vol-edge.ts:1189 | `const missingCount = imputedFields.length + excludedFields.length;` | LEGITIMATE | Bookkeeping arithmetic. |
| vol-edge.ts:1192 | `imputed_sub_scores: missingCount,` | LEGITIMATE | Bookkeeping output field. |
| vol-edge.ts:1194 | `imputed_fields: imputedFields,` | LEGITIMATE | Bookkeeping output field. |

### Catch blocks

| file:line | what the catch does | class | note |
|---|---|---|---|
| (none) | — | — | grep E returned 0 hits: vol-edge.ts contains no try/catch at all. |

### Self-check
- grep A: 30 lines, B: 0, C: 15, D: 48, E: 0; unique grep lines rowed: 90 (A∪C∪D; overlaps C∩D = 276, 282, 703); F additions rowed: 16 (27, 32, 60, 113, 128, 196, 273, 452, 472, 610, 615, 633, 664, 768, 784, 930); total rows: 106. No grep hit excluded.
- VIOLATION: 12 — :270, :276, :282, :452, :610, :703, :768, :784, :875, :930, :940, :1024. GRAY: 3 — :196, :472, :682.

---

## src/lib/convergence/quality-gate.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| quality-gate.ts:26 | `if (surprises.length < 3) return 2.0; // Fallback: insufficient history` | LEGITIMATE | A documented classification-threshold parameter (±2%, Bernard & Thomas) applied to PRESENT surprise data with short history — degrades granularity, does not fabricate a score or datum. |
| quality-gate.ts:38 | `const metric = input.finnhubFundamentals?.metric ?? {};` | LEGITIMATE | `?? {}` normalization; each missing-metric consequence is classified at its consumer line. |
| quality-gate.ts:41 | `const liqRating = tt?.liquidityRating ?? null;` | LEGITIMATE | `?? null` normalization; consequence classified at :42. |
| quality-gate.ts:42 | `let liquidityRatingScore = 40; // penalty default — missing data` | VIOLATION | Missing liquidity rating imputes 40 at 0.25 weight of safety (0.40 of the gate); tracked (:1088) but enters the stored score — never excluded/renormalized. |
| quality-gate.ts:49 | `const marketCap = tt?.marketCap ?? null;` | LEGITIMATE | `?? null` normalization; consequence classified at :50. |
| quality-gate.ts:50 | `let marketCapScore = 40; // penalty default — missing data` | VIOLATION | Missing market cap imputes 40 at 0.15 weight of safety; tracked (:1089) but enters the score. |
| quality-gate.ts:55 | `else if (marketCap > 300_000_000) marketCapScore = 40;` | LEGITIMATE | Tier from PRESENT market cap. |
| quality-gate.ts:60 | `let volumeScore = 40; // penalty default — missing data` | LEGITIMATE | Dead default: candles ≥ 20 always overwrites it (:62-70); candles < 20 takes the exclusion branch (:380-391) which zeroes volumeScore and renormalizes the remaining 85% — the one correctly-excluded component in this file. |
| quality-gate.ts:68 | `else if (avgVol20d > 100_000) volumeScore = 40;` | LEGITIMATE | Tier from PRESENT 20d volume. |
| quality-gate.ts:73 | `const lendability = tt?.lendability ?? null;` | LEGITIMATE | `?? null` normalization; consequence classified at :74. |
| quality-gate.ts:74 | `let lendabilityScore = 60; // Default: assume easy to borrow` | VIOLATION | Missing lendability imputes a FAVORABLE 60 (above the file's own 40 missing-data convention) at 0.10 weight of safety, and it is NOT tracked — imputed_fields (:1088-1092) has no lendability entry. Silent optimistic imputation. |
| quality-gate.ts:78 | `else if (lend === 'locate required' \|\| lend === 'hard to borrow') lendabilityScore = 30;` | LEGITIMATE | Tier from PRESENT lendability string. |
| quality-gate.ts:79 | `else lendabilityScore = 55;` | LEGITIMATE | Catch-all for a PRESENT but unrecognized lendability string — data exists; 55 is a mid tier, and the raw string is echoed in inputs/notes. |
| quality-gate.ts:83 | `const beta = tt?.beta ?? (typeof metric['beta'] === 'number' ? metric['beta'] as number : null);` | LEGITIMATE | Source fallback between two PRESENT-data providers, else null; missing-case consequence classified at :84. |
| quality-gate.ts:84 | `let betaScore = 40; // penalty default — missing data` | VIOLATION | Missing beta imputes 40 at 0.10 weight of safety; tracked (:1091) but enters the score. |
| quality-gate.ts:89 | `else if (beta <= 1.5) betaScore = 50;` | LEGITIMATE | Tier from PRESENT beta. |
| quality-gate.ts:90 | `else betaScore = 30;` | LEGITIMATE | Tier from PRESENT beta. |
| quality-gate.ts:96 | `let debtToEquityScore = 40; // penalty default — missing data` | VIOLATION | Missing D/E imputes 40 at 0.25 weight of safety (largest safety weight); tracked (:1092) but enters the score. |
| quality-gate.ts:102 | `else debtToEquityScore = 25;` | LEGITIMATE | Tier from PRESENT D/E. |
| quality-gate.ts:106 | `// Try quarterly financials first (real), then annual financials, then proxy/metric` | LEGITIMATE | comment/doc — Piotroski source cascade classified at :131-248. |
| quality-gate.ts:109 | `let piotroskiSource = 'proxy_imputed';` | LEGITIMATE | Source LABEL initializer (disclosure), not a value; overwritten when real data exists (:133, :211). |
| quality-gate.ts:202 | `// Fallback: annual financials or metric proxies` | LEGITIMATE | comment/doc — behavior classified at :203-247: every Piotroski signal is computed from PRESENT annual/metric data or set to null and EXCLUDED from the pass ratio (:250, :260-264); nothing imputed. |
| quality-gate.ts:208 | `const cur = af?.currentYear ?? null;` | LEGITIMATE | `?? null` normalization. |
| quality-gate.ts:209 | `const pri = af?.priorYear ?? null;` | LEGITIMATE | `?? null` normalization. |
| quality-gate.ts:212 | `// else remains 'proxy_imputed'` | LEGITIMATE | comment/doc — label behavior at :109/:211. |
| quality-gate.ts:268 | `: 0;` (piotroskiChangeModifier when changeScore null) | LEGITIMATE | No computable change signals → modifier 0 = NO-OP on profitability (a ±delta, not a score), and the gap is tracked (:1104). |
| quality-gate.ts:273 | `let altmanSource = 'proxy_imputed';` | LEGITIMATE | Source LABEL initializer (disclosure); overwritten at :282 or downgraded to 'mixed'. |
| quality-gate.ts:304 | `const marketCap2 = tt?.marketCap ?? null;` | LEGITIMATE | `?? null` normalization. |
| quality-gate.ts:310 | `// Fill any remaining null components with proxy metrics` | LEGITIMATE | comment/doc — behavior itself classified at quality-gate.ts:313/:318/:323/:327. |
| quality-gate.ts:313 | `if (cfoa !== null) x1_wc_ta = (cfoa - 1) * 0.5; // proxy` | GRAY | Altman X1 (WC/TA) fabricated from a linear transform of currentRatio; the proxied Z hard-caps safety at 40 when Z < 1.8 (:394) so a proxy can wrongly trigger or suppress the cap. Disclosed via altman_z.source, but per fail-loud this is imputation into a gating value. Question for Alex: may Altman components be metric-proxied (source-labeled), or must Z require ≥3 REAL components and otherwise be null (no cap)? |
| quality-gate.ts:318 | `if (roa2 !== null) x2_re_ta = roa2 / 100; // proxy` | GRAY | X2 (retained earnings/TA) proxied by roaTTM — a different economic quantity (one-year return vs accumulated earnings). Same product ruling as :313. |
| quality-gate.ts:323 | `if (opMargin !== null) x3_ebit_ta = opMargin / 100; // proxy` | GRAY | X3 (EBIT/TA) proxied by operating margin, which is EBIT/Revenue, not EBIT/TA — scale mismatch for low-turnover firms. Same product ruling as :313. |
| quality-gate.ts:327 | `if (debtToEquity !== null && debtToEquity > 0) x4_mve_tl = 1 / debtToEquity; // proxy` | GRAY | X4 (MARKET equity/TL) proxied by 1/(book D/E) — book vs market equity substitution. Same product ruling as :313. |
| quality-gate.ts:402 | `const borrowRate = tt?.borrowRate ?? null;` | LEGITIMATE | `?? null` normalization; consequence classified at :403. |
| quality-gate.ts:403 | `const borrowRatePenalty = round(Math.min(20, (borrowRate ?? 0) * 0.8), 1);` | LEGITIMATE | Missing borrow rate ⇒ penalty 0 = no-op MODIFIER (absence of adjustment, matching the mspr/HHI/F-Score modifier pattern), and borrow_rate is echoed as null in the trace (:486). It cannot fabricate a score, only skip a deduction. |
| quality-gate.ts:447 | `borrow_rate: tt?.borrowRate ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| quality-gate.ts:452 | `notes: \`Liquidity: ${liqRating ?? 'N/A'}, MktCap: …\`` | LEGITIMATE | Display-only trace string. |
| quality-gate.ts:503 | `const metric = input.finnhubFundamentals?.metric ?? {};` | LEGITIMATE | `?? {}` normalization (same as :38). |
| quality-gate.ts:505 | `const daysTillEarnings = tt?.daysTillEarnings ?? null;` | LEGITIMATE | `?? null` normalization; consequence classified at :650. |
| quality-gate.ts:509 | `let grossMarginScore = 40; // penalty default — missing data` | VIOLATION | Missing gross margin imputes 40 at 0.10 weight of profitability; tracked (:1094) but enters the score. |
| quality-gate.ts:520 | `let roeScore = 40; // penalty default — missing data` | VIOLATION | Missing ROE imputes 40 at 0.10 weight; tracked (:1095) but enters the score. |
| quality-gate.ts:526 | `else if (roe > 0) roeScore = 30;` | LEGITIMATE | Tier from PRESENT ROE. |
| quality-gate.ts:532 | `let roaScore = 40; // penalty default — missing data` | VIOLATION | Missing ROA imputes 40 at 0.07 weight; tracked (:1096) but enters the score. |
| quality-gate.ts:538 | `else if (roa > 0) roaScore = 30;` | LEGITIMATE | Tier from PRESENT ROA. |
| quality-gate.ts:544 | `const afCur = afProf?.currentYear ?? null;` | LEGITIMATE | `?? null` normalization. |
| quality-gate.ts:552 | `const ltDebtCur = afCur.longTermDebtCurrent ?? 0;` | GRAY | Missing XBRL long-term-debt-current tag imputed as 0 inside ROIC invested capital (:560) — understates capital and inflates ROIC when debt exists but is untagged; a missing tag often legitimately means zero debt. Question for Alex: treat absent LT-debt tags as 0 (accounting convention) or as missing ⇒ roic = null? |
| quality-gate.ts:553 | `const ltDebtNon = afCur.longTermDebtNoncurrent ?? 0;` | GRAY | Same imputation and same question as :552. |
| quality-gate.ts:567 | `let roicScore = 50; // neutral default — missing data` | VIOLATION | ROIC not calculable ⇒ NEUTRAL 50 imputed at 0.08 weight; tracked (:1099) but this is exactly the "imputed as neutral" pattern the constitution forbids. |
| quality-gate.ts:572 | `else if (roic > 5) roicScore = 50;` | LEGITIMATE | Tier from PRESENT ROIC. |
| quality-gate.ts:573 | `else if (roic > 0) roicScore = 30;` | LEGITIMATE | Tier from PRESENT ROIC. |
| quality-gate.ts:578 | `const pe = tt?.peRatio ?? (typeof metric['peNormalizedAnnual'] === 'number' ? metric['peNormalizedAnnual'] : null);` | LEGITIMATE | Source fallback between PRESENT-data providers, else null; missing-case consequence classified at :579. |
| quality-gate.ts:579 | `let peScore = 40; // penalty default — missing data` | VIOLATION | Missing P/E imputes 40 at 0.10 weight; tracked (:1097) but enters the score. |
| quality-gate.ts:586 | `else if (pe <= 60) peScore = 40;    // Expensive` | LEGITIMATE | Tier from PRESENT P/E. |
| quality-gate.ts:587 | `else peScore = 25;                  // Extremely expensive` | LEGITIMATE | Tier from PRESENT P/E. |
| quality-gate.ts:590 | `// --- P/S ratio (7%) — revenue-based valuation (TTM preferred, Annual fallback) ---` | LEGITIMATE | comment/doc — TTM→Annual source fallback at :593 uses present data and is source-labeled (:594). |
| quality-gate.ts:593 | `const ps = psTTM ?? psAnnual;` | LEGITIMATE | Present-data source fallback, labeled in psSource and the trace; null case classified at :595. |
| quality-gate.ts:595 | `let psScore = 50; // neutral default — missing data` | VIOLATION | Missing P/S imputes NEUTRAL 50 at 0.07 weight; tracked (:1100) but imputed-as-neutral. |
| quality-gate.ts:601 | `else if (ps < 10) psScore = 50;      // Growth premium` | LEGITIMATE | Tier from PRESENT P/S. |
| quality-gate.ts:602 | `else if (ps < 20) psScore = 30;      // Expensive` | LEGITIMATE | Tier from PRESENT P/S. |
| quality-gate.ts:606 | `// --- EV/EBITDA (7%) — enterprise valuation (TTM preferred, Annual fallback) ---` | LEGITIMATE | comment/doc — source fallback at :609, labeled (:610). |
| quality-gate.ts:609 | `const evEbitda = evEbitdaTTM ?? evEbitdaAnnual;` | LEGITIMATE | Present-data source fallback, labeled; null case classified at :611. |
| quality-gate.ts:611 | `let evEbitdaScore = 50; // neutral default — missing data` | VIOLATION | Missing EV/EBITDA imputes NEUTRAL 50 at 0.07 weight; tracked (:1101) but imputed-as-neutral. |
| quality-gate.ts:614 | `else if (evEbitda < 4) evEbitdaScore = 50;   // Suspiciously cheap — possible distress` | LEGITIMATE | Tier from PRESENT EV/EBITDA. |
| quality-gate.ts:638 | `let fcfScore = 40; // penalty default — missing data` | VIOLATION | Missing FCF/price imputes 40 at 0.18 weight (second-largest profitability weight); tracked (:1098) but enters the score. |
| quality-gate.ts:644 | `else if (fcfYield > 0) fcfScore = 40;` | LEGITIMATE | Tier from PRESENT FCF yield. |
| quality-gate.ts:645 | `else fcfScore = 25; // Negative FCF` | LEGITIMATE | Tier from PRESENT FCF yield. |
| quality-gate.ts:649 | `let surpriseConsistency = 40; // penalty default — missing earnings data` | VIOLATION | Zero earnings history imputes 40 into the EQ composite (0.50 sub-weight of the 0.23 EQ component); tracked (:1102) but enters the score. |
| quality-gate.ts:650 | `let dteScore = 40; // penalty default — missing earnings date` | VIOLATION | Missing daysTillEarnings imputes 40 (0.30 sub-weight of EQ); tracked (:1103) but enters the score. |
| quality-gate.ts:651 | `let beatRate = 0;` | VIOLATION | With zero earnings quarters, beatRateScore = clamp(0) = 0 — the WORST-case value — still enters the EQ composite at the 0.20 sub-weight (:718-721); a fabricated 0 on absent data, not an exclusion, and not separately tracked (only the umbrella earnings_consistency entry at :1102). |
| quality-gate.ts:710 | `else if (daysTillEarnings <= 7) dteScore = 30; // Too close: binary risk` | LEGITIMATE | Tier from PRESENT days-till-earnings. |
| quality-gate.ts:726 | `// Agreement increases confidence; disagreement compresses toward neutral.` | LEGITIMATE | comment/doc — ensemble behavior classified at :745-763. |
| quality-gate.ts:748 | `eqConfidenceModifier = 0.15; // Boost: move 15% further from neutral` | LEGITIMATE | Modifier computed from PRESENT SUE + Finnhub ML scores. |
| quality-gate.ts:752 | `eqConfidenceModifier = -0.20; // Compress: move 20% closer to neutral` | LEGITIMATE | Modifier from PRESENT ensemble disagreement. |
| quality-gate.ts:754 | `// One is neutral zone — mild signal, no modifier` | LEGITIMATE | comment/doc — no-op branch at :755-756. |
| quality-gate.ts:759 | `// Apply modifier: scale distance from neutral (50)` | LEGITIMATE | comment/doc — behavior at :760-763. |
| quality-gate.ts:761 | `const distFromNeutral = earningsQualityScore - 50;` | LEGITIMATE | Arithmetic on PRESENT computed scores. |
| quality-gate.ts:762 | `earningsQualityScore = round(clamp(50 + distFromNeutral * (1 + eqConfidenceModifier), 0, 100), 1);` | LEGITIMATE | Ensemble adjustment computed entirely from present data. |
| quality-gate.ts:800 | `notes: \`Margin=${grossMargin ?? 'N/A'}%, ROE=${roe ?? 'N/A'}%, …\`` | LEGITIMATE | Display-only trace string. |
| quality-gate.ts:837 | `const metric = input.finnhubFundamentals?.metric ?? {};` | LEGITIMATE | `?? {}` normalization. |
| quality-gate.ts:841 | `let revenueGrowthScore = 40; // penalty default — missing data` | VIOLATION | Missing revenue growth imputes 40 at 0.40 weight of growth (0.15 of gate); tracked (:1106) but enters the score. |
| quality-gate.ts:846 | `else if (revGrowth > 0) revenueGrowthScore = 50;` | LEGITIMATE | Tier from PRESENT growth. |
| quality-gate.ts:847 | `else revenueGrowthScore = 30;` | LEGITIMATE | Tier from PRESENT growth. |
| quality-gate.ts:852 | `let epsGrowthScore = 40; // penalty default — missing data` | VIOLATION | Missing EPS growth imputes 40 at 0.40 weight of growth; tracked (:1107) but enters the score. |
| quality-gate.ts:857 | `else if (epsGrowth > 0) epsGrowthScore = 50;` | LEGITIMATE | Tier from PRESENT growth. |
| quality-gate.ts:858 | `else epsGrowthScore = 30;` | LEGITIMATE | Tier from PRESENT growth. |
| quality-gate.ts:863 | `let dividendGrowthScore = 40; // penalty default — missing data` | VIOLATION | Missing dividendGrowthRate5Y imputes 40 at 0.20 weight of growth; tracked (:1108) but enters the score — and non-dividend payers structurally lack this metric, so they are systematically penalized 40 (materiality flag for Alex). |
| quality-gate.ts:887 | `notes: \`RevGrowth=${revGrowth ?? 'N/A'}%, …\`` | LEGITIMATE | Display-only trace string. |
| quality-gate.ts:901 | `const metric = input.finnhubFundamentals?.metric ?? {};` | LEGITIMATE | `?? {}` normalization. |
| quality-gate.ts:908 | `let cashFlowStabilityScore = 40; // penalty default — missing data` | VIOLATION | When all three tiers (quarterly, annual, TTM-FCF sign) are missing, 40 is imputed at 0.40 weight of fundamentalRisk; tracked (:1113) but enters the score. |
| quality-gate.ts:925 | `const cov = cfMean !== 0 ? Math.abs(cfStd / cfMean) : Infinity;` | LEGITIMATE | Degenerate zero-mean OCF (present data) maps to Infinity → worst tier 25 — conservative handling of real data, cannot flatter the score. |
| quality-gate.ts:933 | `else if (cov < 1.5) cashFlowStabilityScore = 40;` | LEGITIMATE | Tier from PRESENT CoV. |
| quality-gate.ts:934 | `else cashFlowStabilityScore = 25;` | LEGITIMATE | Tier from PRESENT CoV. |
| quality-gate.ts:954 | `// Fallback tier 1: 2-year annual financials` | LEGITIMATE | comment/doc — tier-1 behavior at :955-971 computes CoV from PRESENT annual data and labels the source. |
| quality-gate.ts:955 | `const curOCF = af?.currentYear?.operatingCashFlow ?? null;` | LEGITIMATE | `?? null` normalization. |
| quality-gate.ts:956 | `const priOCF = af?.priorYear?.operatingCashFlow ?? null;` | LEGITIMATE | `?? null` normalization. |
| quality-gate.ts:962 | `const cov = cfMean !== 0 ? Math.abs(cfStd / cfMean) : Infinity;` | LEGITIMATE | Same conservative degenerate-data handling as :925. |
| quality-gate.ts:969 | `else if (cov < 2.0) cashFlowStabilityScore = 40;` | LEGITIMATE | Tier from PRESENT CoV. |
| quality-gate.ts:970 | `else cashFlowStabilityScore = 25;` | LEGITIMATE | Tier from PRESENT CoV. |
| quality-gate.ts:973 | `// Fallback tier 2: TTM free cash flow sign check` | LEGITIMATE | comment/doc — behavior classified at quality-gate.ts:976. |
| quality-gate.ts:976 | `cashFlowStabilityScore = fcfTTM > 0 ? 60 : 35;` | LEGITIMATE | Computed from PRESENT TTM FCF sign (coarse but real data) and loudly labeled `proxy_imputed` in cfSource/trace (:977, :1035). |
| quality-gate.ts:977 | `cfSource = \`proxy_imputed TTM FCF/sh=${round(fcfTTM, 2)} (…)\`;` | LEGITIMATE | Disclosure label for :976 — declares the proxy in the trace. |
| quality-gate.ts:984 | `let earningsPredictabilityScore = 40; // penalty default — missing or insufficient data` | VIOLATION | <2 earnings quarters imputes 40 at 0.35 weight of fundamentalRisk; tracked (:1114) but enters the score. |
| quality-gate.ts:996 | `else if (surpriseStdDev < 20) earningsPredictabilityScore = 40;` | LEGITIMATE | Tier from PRESENT surprise stdDev. |
| quality-gate.ts:997 | `else earningsPredictabilityScore = 25;` | LEGITIMATE | Tier from PRESENT surprise stdDev. |
| quality-gate.ts:1003 | `let assetTurnoverScore = 40; // penalty default — missing data` | VIOLATION | Missing asset turnover imputes 40 at 0.25 weight of fundamentalRisk; tracked (:1115) but enters the score. |
| quality-gate.ts:1009 | `else assetTurnoverScore = 30;` | LEGITIMATE | Tier from PRESENT asset turnover. |
| quality-gate.ts:1028 | `notes: \`CF: ${cfSource}, Earnings: ${epSource}, AssetTurn=${assetTurnover ?? 'N/A'}\`` | LEGITIMATE | Display-only trace string. |
| quality-gate.ts:1035 | `cf_stability_source: cfSource.split(' ')[0], // "quarterly_financials" \| "annual_financials" \| "proxy_imputed" \| "missing"` | LEGITIMATE | Trace source-label extraction (disclosure bookkeeping). |
| quality-gate.ts:1085 | `const metric = input.finnhubFundamentals?.metric ?? {};` | LEGITIMATE | `?? {}` normalization for bookkeeping. |
| quality-gate.ts:1086 | `const imputedFields: string[] = [];` | LEGITIMATE | Data-confidence bookkeeping initializer. |
| quality-gate.ts:1088 | `if (tt?.liquidityRating == null) imputedFields.push('safety.liquidity_rating');` | LEGITIMATE | Bookkeeping declaring the :42 imputation. |
| quality-gate.ts:1089 | `if (tt?.marketCap == null) imputedFields.push('safety.market_cap');` | LEGITIMATE | Bookkeeping declaring the :50 imputation. |
| quality-gate.ts:1090 | `if (input.candles.length < 20) imputedFields.push('safety.volume');` | LEGITIMATE | Bookkeeping (slightly mislabeled: volume is actually excluded+renormalized at :380-391, not imputed — labeling nit, no score effect). |
| quality-gate.ts:1091 | `if (tt?.beta == null && typeof metric['beta'] !== 'number') imputedFields.push('safety.beta');` | LEGITIMATE | Bookkeeping declaring the :84 imputation. |
| quality-gate.ts:1092 | `if (typeof metric['totalDebt/totalEquityQuarterly'] !== 'number') imputedFields.push('safety.debt_to_equity');` | LEGITIMATE | Bookkeeping declaring the :96 imputation. Note: NO entry exists for safety.lendability (the :74 gap). |
| quality-gate.ts:1094 | `if (typeof metric['grossMarginTTM'] !== 'number') imputedFields.push('profitability.gross_margin');` | LEGITIMATE | Bookkeeping declaring :509. |
| quality-gate.ts:1095 | `if (typeof metric['roeTTM'] !== 'number') imputedFields.push('profitability.roe');` | LEGITIMATE | Bookkeeping declaring :520. |
| quality-gate.ts:1096 | `if (typeof metric['roaTTM'] !== 'number') imputedFields.push('profitability.roa');` | LEGITIMATE | Bookkeeping declaring :532. |
| quality-gate.ts:1097 | `if (tt?.peRatio == null && typeof metric['peNormalizedAnnual'] !== 'number') imputedFields.push('profitability.pe_ratio');` | LEGITIMATE | Bookkeeping declaring :579. |
| quality-gate.ts:1098 | `if (profitability.inputs.fcf_source === 'N/A') imputedFields.push('profitability.fcf');` | LEGITIMATE | Bookkeeping declaring :638. |
| quality-gate.ts:1099 | `if (profitability.inputs.roic_source === 'N/A') imputedFields.push('profitability.roic');` | LEGITIMATE | Bookkeeping declaring :567. |
| quality-gate.ts:1100 | `if (typeof metric['psTTM'] !== 'number' && typeof metric['psAnnual'] !== 'number') imputedFields.push('profitability.ps');` | LEGITIMATE | Bookkeeping declaring :595. |
| quality-gate.ts:1101 | `if (typeof metric['evEbitdaTTM'] !== 'number' && typeof metric['evEbitdaAnnual'] !== 'number') imputedFields.push('profitability.ev_ebitda');` | LEGITIMATE | Bookkeeping declaring :611. |
| quality-gate.ts:1102 | `if (input.finnhubEarnings.length === 0) imputedFields.push('profitability.earnings_consistency');` | LEGITIMATE | Bookkeeping declaring :649 (and, by umbrella only, :651). |
| quality-gate.ts:1103 | `if (tt?.daysTillEarnings == null) imputedFields.push('profitability.earnings_dte');` | LEGITIMATE | Bookkeeping declaring :650. |
| quality-gate.ts:1104 | `if (safety.piotroski.change_signals.computable_count === 0) imputedFields.push('profitability.fscore_change_signals');` | LEGITIMATE | Bookkeeping declaring the :268 no-op. |
| quality-gate.ts:1106 | `if (typeof metric['revenueGrowthTTMYoy'] !== 'number') imputedFields.push('growth.revenue');` | LEGITIMATE | Bookkeeping declaring :841. |
| quality-gate.ts:1107 | `if (typeof metric['epsGrowthTTMYoy'] !== 'number') imputedFields.push('growth.eps');` | LEGITIMATE | Bookkeeping declaring :852. |
| quality-gate.ts:1108 | `if (typeof metric['dividendGrowthRate5Y'] !== 'number') imputedFields.push('growth.dividend');` | LEGITIMATE | Bookkeeping declaring :863. |
| quality-gate.ts:1113 | `if (!hasCfData && !hasFcfTTM) imputedFields.push('fundamentalRisk.cash_flow_stability');` | LEGITIMATE | Bookkeeping declaring :908 (note: does not check quarterlyFinancials, so it can over-report imputation when quarterly data existed — tracking nit, no score effect). |
| quality-gate.ts:1114 | `if (input.finnhubEarnings.length < 2) imputedFields.push('fundamentalRisk.earnings_predictability');` | LEGITIMATE | Bookkeeping declaring :984. |
| quality-gate.ts:1115 | `if (typeof metric['assetTurnoverTTM'] !== 'number') imputedFields.push('fundamentalRisk.asset_turnover');` | LEGITIMATE | Bookkeeping declaring :1003. |
| quality-gate.ts:1120 | `imputed_sub_scores: imputedFields.length,` | LEGITIMATE | Bookkeeping output field. |
| quality-gate.ts:1121 | `confidence: round(1 - imputedFields.length / totalSubScores, 4),` | LEGITIMATE | Bookkeeping arithmetic. |
| quality-gate.ts:1122 | `imputed_fields: imputedFields,` | LEGITIMATE | Bookkeeping output field. |

### Catch blocks

| file:line | what the catch does | class | note |
|---|---|---|---|
| (none) | — | — | grep E returned 0 hits: quality-gate.ts contains no try/catch at all. |

### Self-check
- grep A: 24 lines, B: 0, C: 50, D: 72, E: 0; unique grep lines rowed: 125 (A∪C∪D; C∩D overlap = 21 lines: 42, 50, 60, 84, 96, 509, 520, 532, 567, 579, 595, 611, 638, 649, 650, 841, 852, 863, 908, 984, 1003); F additions rowed: 10 (79, 83, 268, 578, 593, 609, 651, 925, 962, 976); total rows: 135. No grep hit excluded.
- VIOLATION: 22 — :42, :50, :74, :84, :96, :509, :520, :532, :567, :579, :595, :611, :638, :649, :650, :651, :841, :852, :863, :908, :984, :1003. GRAY: 6 — :313, :318, :323, :327, :552, :553.

---

## Totals
- VIOLATION rows: 34 (vol-edge 12, quality-gate 22). GRAY rows: 9 (vol-edge 3, quality-gate 6). Catch blocks: 0 in both files.

# Fallback census — src/lib/convergence/info-edge.ts + src/lib/convergence/types.ts
Repo: temple-stuart-accounting, branch main @ c12e48f7. Read-only census; line numbers from `grep -nE` / Read on the actual files.

## src/lib/convergence/info-edge.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| info-edge.ts:32 | `if (surprises.length < 3) return 2.0; // Fallback: insufficient history` | GRAY | Fixed ±2% SUE threshold substitutes for an un-computable stdDev when <3 quarters of surprise history exist; earnings data itself is present and this sets a beat/miss classification threshold (not a score), but it changes beatStreakScore tiering (:629-648). Question for Alex: is the documented ±2% floor acceptable with <3 quarters, or must beat-streak scoring require ≥3 quarters (exclude otherwise)? |
| info-edge.ts:40 | `// Estimate revision momentum: EPS level, dispersion, revenue-EPS alignment, consensus breadth` | LEGITIMATE | comment/doc — keyword match only; methodology header. |
| info-edge.ts:45 | `const estimates = input.finnhubEstimates;` | LEGITIMATE | Keyword-only match ("estimat" in identifier); plain assignment, no default. |
| info-edge.ts:51 | `const total = latest ? latest.strongBuy + latest.buy + latest.hold + ... : 0;` (spans 51-53) | LEGITIMATE | 0 when no recommendation rows; used only as a gate (:124 requires total > 0) and in trace raw_counts where absence is separately declared (periods_available: 0, latest_period: null); the scoring consequence of no recs is rowed at :123. |
| info-edge.ts:55 | `// --- Find next-quarter forward EPS estimate ---` | LEGITIMATE | comment/doc — keyword match only. |
| info-edge.ts:57 | `const futureEps = estimates?.epsEstimates` | LEGITIMATE | Start of the expression whose `?? []` is classified at :59; keyword match only. |
| info-edge.ts:59 | `.sort((a, b) => a.period.localeCompare(b.period)) ?? [];` | LEGITIMATE | null→[] normalization on optional feed; it imputes no score itself — the scoring consequence of the resulting null forwardEps is the deferred default rowed at :74. |
| info-edge.ts:61 | `const forwardEps = nextQEps?.epsAvg ?? null;` | LEGITIMATE | `?? null` normalization — absence stays null. |
| info-edge.ts:66 | `// --- Find next-quarter forward revenue estimate ---` | LEGITIMATE | comment/doc — keyword match only. |
| info-edge.ts:67 | `const futureRev = estimates?.revenueEstimates` | LEGITIMATE | Start of expression classified at :69; keyword match only. |
| info-edge.ts:69 | `.sort((a, b) => a.period.localeCompare(b.period)) ?? [];` | LEGITIMATE | null→[] normalization; scoring consequence of missing revenue estimates rowed at :102. |
| info-edge.ts:72 | `// ===== SUB-SCORE 1: Estimate Level (25%) =====` | LEGITIMATE | comment/doc — keyword match only. |
| info-edge.ts:73 | `// Chan, Jegadeesh & Lakonishok 1996: forward-vs-trailing EPS growth proxy` | LEGITIMATE | comment/doc — "proxy" names the academic construct; behavior classified at :74. |
| info-edge.ts:74 | `let estimateLevelScore = 40; // penalty default` | VIOLATION | KNOWN RESIDUAL (deferred per :1343-1345). When forwardEps or trailingActualEps is absent (guard :76), an imputed 40 enters the 0.25-weighted analyst_consensus combo (:147), and analyst_consensus is ALWAYS in the info-edge score (:1319, :1332). Declared via imputed_fields only when finnhubEstimates is entirely null (:1347-1348) — NOT when estimates exist but have no future period, and NOT when finnhubEarnings is empty (trailingActualEps null), so the default can enter the score undeclared. |
| info-edge.ts:79 | `if (growth > 0.20) estimateLevelScore = 80;` | LEGITIMATE | Tier assignment computed from present forward/trailing EPS (inside :76 guard). |
| info-edge.ts:80 | `else if (growth > 0.10) estimateLevelScore = 70;` | LEGITIMATE | Present-data tier (inside :76 guard). |
| info-edge.ts:81 | `else if (growth > 0) estimateLevelScore = 60;` | LEGITIMATE | Present-data tier (inside :76 guard). |
| info-edge.ts:82 | `else if (growth > -0.10) estimateLevelScore = 45;` | LEGITIMATE | Present-data tier (inside :76 guard). |
| info-edge.ts:83 | `else estimateLevelScore = 30;` | LEGITIMATE | Present-data tier (inside :76 guard) — real negative growth, not a default. |
| info-edge.ts:86 | `// ===== SUB-SCORE 2: Estimate Dispersion (25%) =====` | LEGITIMATE | comment/doc — keyword match only. |
| info-edge.ts:88 | `let estimateDispersionScore = 40; // penalty default` | VIOLATION | KNOWN RESIDUAL (deferred per :1343-1345). When no next-quarter EPS estimate exists (or epsAvg ≈ 0, guard :90), imputed 40 enters the 0.25-weighted combo (:148) → info-edge score; same partial-declaration gap as :74. |
| info-edge.ts:92 | `if (epsDispersionPct < 5) estimateDispersionScore = 85;` | LEGITIMATE | Present-data tier (inside :90 guard). |
| info-edge.ts:93 | `else if (epsDispersionPct < 10) estimateDispersionScore = 75;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:94 | `else if (epsDispersionPct < 20) estimateDispersionScore = 60;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:95 | `else if (epsDispersionPct < 35) estimateDispersionScore = 45;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:96 | `else if (epsDispersionPct < 50) estimateDispersionScore = 35;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:97 | `else estimateDispersionScore = 20;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:102 | `let revenueEpsAlignmentScore = 50; // neutral default` | VIOLATION | KNOWN RESIDUAL (deferred per :1343-1345). When revenue estimates are absent (guard :104) or growth directions un-derivable (:114), an imputed neutral 50 enters the 0.15-weighted combo (:149) → info-edge score, undeclared unless finnhubEstimates is entirely null. |
| info-edge.ts:105 | `const pastRev = estimates?.revenueEstimates` | LEGITIMATE | Keyword match; start of `?? []` at :107. |
| info-edge.ts:107 | `.sort((a, b) => b.period.localeCompare(a.period)) ?? [];` | LEGITIMATE | null→[] normalization; scoring consequence rowed at :102. |
| info-edge.ts:116 | `else if (epsGrowthDirection === 'DOWN' && revenueGrowthDirection === 'DOWN') revenueEpsAlignmentScore = 30;` | LEGITIMATE | Present-data branch — both directions derived from real estimates (guard :114). |
| info-edge.ts:117 | `else revenueEpsAlignmentScore = 50;` | LEGITIMATE | Present-data branch — mixed directions from real data is genuinely neutral (guard :114). |
| info-edge.ts:123 | `let consensusBreadthScore = 40; // penalty default` | VIOLATION | KNOWN RESIDUAL (deferred per :1343-1345). When no recommendation rows exist (guard :124), imputed 40 enters the 0.35-weighted combo (:150) → info-edge score; declared at :1347 only when finnhubEstimates is ALSO null — recs-empty-but-estimates-present enters undeclared. |
| info-edge.ts:130 | `nextQEps?.numberAnalysts ?? 0,` | LEGITIMATE | Inside `Math.max(..., total)` with total > 0 guaranteed (:124), so `?? 0` can never lower the result; numberAnalysts is typed non-nullable (types.ts:76 area). |
| info-edge.ts:131 | `estimates?.priceTarget?.numberAnalysts ?? 0,` | LEGITIMATE | Same Math.max floor as :130; cannot bias downward. |
| info-edge.ts:139 | `else coverageScore = 30;` | LEGITIMATE | Present-data tier — numAnalysts ≥ total > 0 is real coverage data. |
| info-edge.ts:147 | `0.25 * estimateLevelScore +` | LEGITIMATE | Weighted-sum arithmetic; the imputation risk lives at :74/:88/:102/:123 (rowed there). |
| info-edge.ts:148 | `0.25 * estimateDispersionScore +` | LEGITIMATE | Same as :147. |
| info-edge.ts:154 | `const formula = \`0.25×EstLevel(${round(estimateLevelScore)}) + ...\`;` | LEGITIMATE | Display-only formula string. |
| info-edge.ts:157 | `` `fwdEPS=${forwardEps ?? 'N/A'}`, `` | LEGITIMATE | Notes/display-only 'N/A' label. |
| info-edge.ts:158 | `` `trailEPS=${trailingActualEps ?? 'N/A'}`, `` | LEGITIMATE | Display-only. |
| info-edge.ts:159 | `` `dispersion=${epsDispersionPct ?? 'N/A'}%`, `` | LEGITIMATE | Display-only. |
| info-edge.ts:168 | `latest_period: latest?.period ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:177 | `estimate_level_score: round(estimateLevelScore),` | LEGITIMATE | Trace echo of sub-score; keyword match only (score origin classified at :74). |
| info-edge.ts:178 | `estimate_dispersion_score: round(estimateDispersionScore),` | LEGITIMATE | Trace echo; origin classified at :88. |
| info-edge.ts:188 | `number_analysts_estimates: nextQEps?.numberAnalysts ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:192 | `strongBuy: latest?.strongBuy ?? 0,` | LEGITIMATE | Trace-only count; absence separately declared (periods_available: 0, latest_period: null at :167-168); not a score input. |
| info-edge.ts:193 | `buy: latest?.buy ?? 0,` | LEGITIMATE | Same as :192. |
| info-edge.ts:194 | `hold: latest?.hold ?? 0,` | LEGITIMATE | Same as :192. |
| info-edge.ts:195 | `sell: latest?.sell ?? 0,` | LEGITIMATE | Same as :192. |
| info-edge.ts:196 | `strongSell: latest?.strongSell ?? 0,` | LEGITIMATE | Same as :192. |
| info-edge.ts:203 | `// Da & Schaumburg (2011): ΔTPER — sector-neutralized change in implied return.` | LEGITIMATE | comment/doc — keyword match only. |
| info-edge.ts:207 | `const estimates = input.finnhubEstimates;` | LEGITIMATE | Keyword-only match; plain assignment. |
| info-edge.ts:208 | `const pt = estimates?.priceTarget ?? null;` | LEGITIMATE | `?? null` normalization. |
| info-edge.ts:214 | `const ptMedian = pt?.targetMedian ?? null;` | LEGITIMATE | `?? null` normalization; if null the whole sub-score returns null at :253-255 (excluded, renormalized). |
| info-edge.ts:221 | `// Use peerStats if available for sector neutralization` | LEGITIMATE | comment/doc. |
| info-edge.ts:232 | `// Use peer group median (mean as proxy when sorted values unavailable)` | LEGITIMATE | comment/doc — the behavior (:238-240) substitutes the peer MEAN (a real present aggregate) for the median when sortedValues absent; computed from present peer data, no fabrication. |
| info-edge.ts:252 | `// from real data. Return null — excluded, weights re-normalize. Never imputed.` | LEGITIMATE | comment/doc — behavior itself (return null at :253-255) is the EDGE-2b exclusion mechanism. |
| info-edge.ts:258 | `const numAnalysts = pt?.numberAnalysts ?? 0;` | LEGITIMATE | pt is guaranteed non-null here (rawImpliedReturn non-null requires ptMedian, :216/:253) and numberAnalysts is typed non-nullable (types.ts:98) — dead defensive `?? 0`; even if it fired, effect is the conservative shrink-toward-50 at :283-284, a discount not a fabricated signal. |
| info-edge.ts:262 | `// ΔTPER ~ 0 (or raw ~ +15): neutral vs peers → 55 (slight upward bias...)` | LEGITIMATE | comment/doc — describes present-data mapping at :264-279. |
| info-edge.ts:265 | `// Sector-neutralized: 0 = in line with peers` | LEGITIMATE | comment/doc. |
| info-edge.ts:284 | `priceTargetScore = round(50 + (priceTargetScore - 50) * 0.5); // shrink toward neutral` | LEGITIMATE | Confidence shrink of a score computed from present data when real coverage (<3 analysts) is thin; discounts conviction, fabricates nothing. |
| info-edge.ts:289 | `` ? `ΔTPER(${deltaTper}) → ${priceTargetScore} [peer-neutralized, ...]` `` | LEGITIMATE | Display-only formula string. |
| info-edge.ts:290 | `` : `RawImplied(${rawImpliedReturn ?? 'N/A'}%) → ${priceTargetScore} [no peer data, ...]` `` | LEGITIMATE | Display-only; rawImpliedReturn is non-null on this path anyway (:253). |
| info-edge.ts:293 | `` `ptMedian=${ptMedian ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:294 | `` `close=${latestClose ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:295 | `` `rawReturn=${rawImpliedReturn ?? 'N/A'}%`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:296 | `` `peerMedian=${peerMedianImpliedReturn ?? 'N/A'}%`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:297 | `` `deltaTper=${deltaTper ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:299 | `usedDeltaTper ? 'sector_neutralized' : 'raw_fallback',` | LEGITIMATE | Display label; the "raw fallback" path scores the PRESENT raw implied return when peer stats are absent — real data, tier-mapped (:273-278), loudly labeled. |
| info-edge.ts:322 | `price_target_mean: pt?.targetMean ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:323 | `price_target_high: pt?.targetHigh ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:324 | `price_target_low: pt?.targetLow ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:350 | `const estimates = input.finnhubEstimates;` | LEGITIMATE | Keyword-only match. |
| info-edge.ts:351 | `const allUd = estimates?.upgradeDowngrade ?? [];` | LEGITIMATE | null→[] normalization immediately guarded: empty ⇒ return null at :358-360 (excluded, renormalized; provenance rationale documented :353-357). |
| info-edge.ts:373 | `const action = ud.action?.toLowerCase() ?? '';` | LEGITIMATE | An event with absent action matches no branch (:375-398) and contributes 0 to netMomentum — exclusion from the sum (direction unknowable), not an imputed direction; the event only appears in display counts. |
| info-edge.ts:478 | `let msprScore = 50;` | LEGITIMATE | Reached only with insider-sentiment months present (:463 guard) and branches :479-483 are exhaustive over present latestMspr — initializer is dead code. |
| info-edge.ts:481 | `else if (latestMspr > -5) msprScore = 50;` | LEGITIMATE | Genuine neutral band over present latestMspr (-5 < mspr ≤ 5). |
| info-edge.ts:485 | `let trendScore = 50;` | LEGITIMATE | Stays 50 only when <3 months AND \|latestMspr\| ≤ 5 — keyed off a present, near-zero MSPR (neutral read of real data); with \|mspr\| > 5 the 60/40 directional proxy (:505/:508) also uses present data. Data presence guaranteed by :463 guard. |
| info-edge.ts:486 | `let netDirection = 'NEUTRAL';` | LEGITIMATE | Label for trace/notes only; overwritten or accurate for present near-zero MSPR; never a score. |
| info-edge.ts:497 | `trendScore = 30;` | LEGITIMATE | Present-data branch (recentAvg < olderAvg - 5, ≥3 real months). |
| info-edge.ts:500 | `trendScore = 50;` | LEGITIMATE | Present-data STABLE band (≥3 real months, flat trend). |
| info-edge.ts:508 | `trendScore = 40;` | LEGITIMATE | Present-data branch (latestMspr < -5 with <3 months) — directional proxy from real MSPR. |
| info-edge.ts:522 | `// Return null — excluded, weights re-normalize. Never imputed.` | LEGITIMATE | comment/doc — behavior (return null :523-525) is the exclusion mechanism. |
| info-edge.ts:542 | `else if (form4.netDollarFlow > -1_000_000) form4FlowScore = 30;` | LEGITIMATE | Present-data tier over real Form 4 net dollar flow (hasForm4 guard :535). |
| info-edge.ts:550 | `// has no opportunistic read it stays null and is excluded — not imputed as 50.` | LEGITIMATE | comment/doc — behavior at :551. |
| info-edge.ts:551 | `form4OpportunisticComponent = form4.opportunisticScore ?? null;` | LEGITIMATE | `?? null` normalization; null component is excluded and ensemble weights renormalize (:557-563). |
| info-edge.ts:574 | `months_available: mspr?.monthsAvailable ?? 0,` | LEGITIMATE | Trace-only; 0 months is the accurate count when MSPR feed empty, and form4_available flag sits alongside. |
| info-edge.ts:575 | `latest_mspr: mspr?.latestMspr ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:576 | `avg_mspr_3m: mspr?.avgMspr3m ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:580 | `` notes: `Latest MSPR: ${mspr?.latestMspr ?? 'N/A (no insider-sentiment data — MSPR component excluded)'}...` `` | LEGITIMATE | Display-only, and loudly declares the exclusion. |
| info-edge.ts:586 | `months_available: mspr?.monthsAvailable ?? 0,` | LEGITIMATE | Trace-only accurate count (same as :574). |
| info-edge.ts:587 | `latest_mspr: mspr?.latestMspr ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:588 | `avg_mspr_3m: mspr?.avgMspr3m ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:589 | `net_direction: mspr?.netDirection ?? 'UNKNOWN',` | LEGITIMATE | Trace label 'UNKNOWN' declares absence loudly; display-only. |
| info-edge.ts:594 | `form4_buy_count: form4?.totalBuyCount ?? 0,` | LEGITIMATE | Trace-only; form4_available: false is declared alongside (:592), so 0 cannot be mistaken for data. |
| info-edge.ts:595 | `form4_sell_count: form4?.totalSellCount ?? 0,` | LEGITIMATE | Same as :594. |
| info-edge.ts:596 | `net_dollar_flow: form4?.netDollarFlow ?? 0,` | LEGITIMATE | Same as :594 — trace-only with availability flag. |
| info-edge.ts:597 | `officer_buys: form4?.officerBuyCount ?? 0,` | LEGITIMATE | Same as :594. |
| info-edge.ts:598 | `opportunistic_score: form4?.opportunisticScore ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:611 | `// Return null — excluded, weights re-normalize. Never imputed as a penalty 40.` | LEGITIMATE | comment/doc — behavior at :612-614. |
| info-edge.ts:621 | `// for stdDev, not just last 4, to get a more stable estimate` | LEGITIMATE | comment/doc — keyword match only. |
| info-edge.ts:641 | `let beatStreakScore = 50;` | LEGITIMATE | Earnings present (:612 guard); 50 = no streak in either direction over present surprises — genuine neutral. |
| info-edge.ts:647 | `else if (consecutiveMisses >= 2) beatStreakScore = 30;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:648 | `else if (consecutiveMisses >= 1) beatStreakScore = 40;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:655 | `let surpriseMagnitudeScore = 50;` | LEGITIMATE | avgSurprise cannot be null on this path (recent = earnings.slice(0,4) non-empty given :612 guard), so the initializer is dead; all live values come from present surprises. |
| info-edge.ts:660 | `else if (avgSurprise > -1) surpriseMagnitudeScore = 50;` | LEGITIMATE | Genuine neutral band over present avgSurprise. |
| info-edge.ts:668 | `let consistencyScore = 50;` | LEGITIMATE | surprises.length > 0 always true here (:612 guard), so :673 always overwrites from present data; initializer dead. |
| info-edge.ts:681 | `let direction = 'NEUTRAL';` | LEGITIMATE | Label for notes/momentum_detail only; never enters the score. |
| info-edge.ts:682 | `if (consecutiveBeats >= 2 && (avgSurprise ?? 0) > 2) direction = 'BULLISH_MOMENTUM';` | LEGITIMATE | avgSurprise never null on this path (see :655); affects only the direction LABEL, not the score. |
| info-edge.ts:683 | `else if (consecutiveBeats >= 1 && (avgSurprise ?? 0) > 0) direction = 'POSITIVE';` | LEGITIMATE | Same as :682. |
| info-edge.ts:684 | `else if (consecutiveMisses >= 2 && (avgSurprise ?? 0) < -2) direction = 'BEARISH_MOMENTUM';` | LEGITIMATE | Same as :682. |
| info-edge.ts:685 | `else if (consecutiveMisses >= 1 && (avgSurprise ?? 0) < 0) direction = 'NEGATIVE';` | LEGITIMATE | Same as :682. |
| info-edge.ts:703 | `` notes: `... avg surprise: ${avgSurprise ?? 'N/A'}%, direction: ${direction}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:723 | `if (inHigh === inLow) return (outLow + outHigh) / 2;` | LEGITIMATE | (F) Degenerate-range guard in the lerp helper; every call site passes distinct constant bounds, and the midpoint is math over caller-supplied constants, not imputed data. |
| info-edge.ts:811 | `if (pcrScore !== null) flowComponents.push({ label: 'PCR', weight: osScore !== null ? 0.25 : 0.30, ... });` (same pattern :812-814) | LEGITIMATE | (F) Conditional base weights documented at :806-809; components exist only when computed from present data, missing ones are excluded and remaining weights renormalize (:818-823). |
| info-edge.ts:817 | `// to score. Return null — excluded. Never imputed.` | LEGITIMATE | comment/doc — behavior at :818-820. |
| info-edge.ts:833 | `` `PCR=${flow.put_call_ratio ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:834 | `` `bias=${flow.volume_bias ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:835 | `` `unusual=${flow.unusual_activity_ratio ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:836 | `` `O/S=${osRatio ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:877 | `function scoreToDirection(score: number): 'bullish' \| 'bearish' \| 'neutral' {` | LEGITIMATE | Keyword-only match; direction labeling over a present score. |
| info-edge.ts:880 | `return 'neutral';` | LEGITIMATE | Genuine neutral band (45-55) over a present score; label only. |
| info-edge.ts:883 | `function directionsAgree(a: 'bullish' \| 'bearish' \| 'neutral', b: ...): boolean {` | LEGITIMATE | Keyword-only match. NOTE (doc drift, not a fallback): comment :884 says "or if one is neutral (not opposing)" but code is strict `a === b`. |
| info-edge.ts:884 | `// Two directions agree if they're the same, or if one is neutral (not opposing)` | LEGITIMATE | comment/doc — describes :885; see drift note at :883. Effect of the drift: neutral+directional counts as disagreement → -0.15 compression toward 50, a conservative direction. |
| info-edge.ts:897 | `if (news.articles_7d === 0) { buzzScore = 20;` (assignment on :898) | LEGITIMATE | (F) News feed present (:891 guard); zero 7d articles is present data → low-buzz score computed from a real count. |
| info-edge.ts:906 | `buzzScore = news.articles_7d >= 5 ? 65 : news.articles_7d >= 1 ? 50 : 20;` | LEGITIMATE | (F) Fires when buzz baseline is zero articles in the present feed's 8-30d window — tiers computed from the present articles_7d count, not imputed. |
| info-edge.ts:927 | `else sourceQualityScore = 25;` | LEGITIMATE | tier1_ratio === 0 computed from the present article set (news non-null, :891); real "no tier-1 sources" datum. |
| info-edge.ts:936 | `score = round(0.50 * buzzScore + 0.50 * sourceQualityScore, 1);` | LEGITIMATE | (F) When the sentiment leg is null (no classifiable headlines) it is EXCLUDED and the remaining present-data legs re-weight — exclusion, not imputation. |
| info-edge.ts:944 | `const keywordDirection: 'bullish' \| 'bearish' \| 'neutral' \| null =` | LEGITIMATE | Ternary to null (:945) — absence stays null. |
| info-edge.ts:947 | `// Leg 2 (FinBERT): companyNewsScore from /news-sentiment (0-1, 0.5 = neutral)` | LEGITIMATE | comment/doc. |
| info-edge.ts:948 | `let finbertDirection: 'bullish' \| 'bearish' \| 'neutral' \| null = null;` | LEGITIMATE | null initialization — absence stays null. |
| info-edge.ts:957 | `const activeLegDirections: ('bullish' \| 'bearish' \| 'neutral')[] = [];` | LEGITIMATE | Keyword-only match; array of present legs only. |
| info-edge.ts:967 | `ensembleConfidenceModifier = 0; // 2 legs agree` | LEGITIMATE | (F) Present-data branch (both legs computed); 0 = no adjustment. |
| info-edge.ts:970 | `ensembleConfidenceModifier = -0.15; // 2 legs disagree — mild reduction` | LEGITIMATE | (F) Present-data branch; compresses toward 50 on real disagreement — a discount, not fabrication. |
| info-edge.ts:973 | `ensembleConfidenceModifier = 0; // 0 or 1 leg — no ensemble signal` | LEGITIMATE | (F) Missing leg ⇒ modifier 0 = identity (no ensemble adjustment applied) — exclusion of the ensemble signal, nothing imputed. |
| info-edge.ts:977 | `// Modifier scales the distance from neutral (50):` | LEGITIMATE | comment/doc. |
| info-edge.ts:981 | `const distFromNeutral = score - 50;` | LEGITIMATE | Arithmetic over a present score; keyword-only match. |
| info-edge.ts:982 | `score = round(clamp(50 + distFromNeutral * (1 + ensembleConfidenceModifier), 0, 100), 1);` | LEGITIMATE | Scaling of a present-data score; only fires when modifier ≠ 0 (both legs present, :980). |
| info-edge.ts:989 | `` `buzz_ratio=${news.buzz_ratio ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:993 | `` `7d: ${...bullish_matches}B/${...bearish_matches}b/${news.sentiment_7d.neutral}N`, `` | LEGITIMATE | Display-only notes; keyword match on field name. |
| info-edge.ts:1035 | `finnhub_buzz: finbert?.buzz ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:1036 | `finnhub_sector_avg: finbert?.sectorAverageNewsScore ?? null,` | LEGITIMATE | `?? null` trace normalization. |
| info-edge.ts:1053 | `const estimates = input.finnhubEstimates;` | LEGITIMATE | Keyword-only match. |
| info-edge.ts:1059 | `filing_type: filing?.latestFilingType ?? null,` | LEGITIMATE | `?? null` in the dormant-state trace; filing_signal_active: false declared alongside (:1058). |
| info-edge.ts:1060 | `filing_age_hours: filing?.filingAgeHours ?? null,` | LEGITIMATE | Same as :1059. |
| info-edge.ts:1063 | `filing_recency_score: 50,` (with `filing_modifier: 0,` at :1064) | LEGITIMATE | (F) Dormant state (no filing ≤72h): modifier 0 means ZERO effect on the info-edge score (:1338 requires active && modifier ≠ 0); the 50 is a trace placeholder explicitly flagged by filing_signal_active: false. |
| info-edge.ts:1073 | `// Cross-reference with Finnhub estimates` | LEGITIMATE | comment/doc. |
| info-edge.ts:1074 | `// Find the estimate matching the filing's fiscal period` | LEGITIMATE | comment/doc. |
| info-edge.ts:1075 | `let epsEstimate: number \| null = null;` | LEGITIMATE | null initialization — absence stays null. |
| info-edge.ts:1076 | `let revenueEstimate: number \| null = null;` | LEGITIMATE | null initialization. |
| info-edge.ts:1078 | `if (estimates?.epsEstimates && epsActual !== null) {` | LEGITIMATE | Presence guard; keyword-only match. |
| info-edge.ts:1079 | `// Match by period end date (filing period end ≈ estimate period)` | LEGITIMATE | comment/doc. |
| info-edge.ts:1080 | `const match = estimates.epsEstimates.find(e => {` | LEGITIMATE | Keyword-only match; no match ⇒ estimate stays null ⇒ surprise null ⇒ score stays 50 ⇒ modifier 0 (no effect). |
| info-edge.ts:1084 | `if (match) epsEstimate = match.epsAvg;` | LEGITIMATE | Assignment from present data only. |
| info-edge.ts:1087 | `if (estimates?.revenueEstimates && revenueActual !== null) {` | LEGITIMATE | Presence guard; keyword-only match. |
| info-edge.ts:1088 | `const match = estimates.revenueEstimates.find(e => {` | LEGITIMATE | Keyword-only match; same null-propagation as :1080. |
| info-edge.ts:1091 | `if (match) revenueEstimate = match.revenueAvg;` | LEGITIMATE | Assignment from present data only. |
| info-edge.ts:1095 | `const epsSurprisePct = epsActual !== null && epsEstimate !== null && Math.abs(epsEstimate) > 0.001` | LEGITIMATE | Ternary to null (:1097) — absence stays null. |
| info-edge.ts:1096 | `? round(((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100, 2)` | LEGITIMATE | Computed from present data; keyword-only match. |
| info-edge.ts:1099 | `const revenueSurprisePct = revenueActual !== null && revenueEstimate !== null && revenueEstimate > 0` | LEGITIMATE | Ternary to null (:1101). |
| info-edge.ts:1100 | `? round(((revenueActual - revenueEstimate) / revenueEstimate) * 100, 2)` | LEGITIMATE | Computed from present data. |
| info-edge.ts:1104 | `let filingRecencyScore = 50;` | LEGITIMATE | If both surprises are null the 50 gives distFromNeutral 0 ⇒ filingModifier 0 ⇒ no score effect; any nonzero modifier traces to a present EPS/revenue surprise (:1107-1123). |
| info-edge.ts:1112 | `else if (epsSurprisePct > -2) filingRecencyScore = 50;` | LEGITIMATE | Genuine neutral band over a present surprise. |
| info-edge.ts:1113 | `else if (epsSurprisePct > -5) filingRecencyScore = 40;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:1114 | `else if (epsSurprisePct > -10) filingRecencyScore = 30;` | LEGITIMATE | Present-data tier. |
| info-edge.ts:1127 | `let ageMultiplier = 1.0;` | LEGITIMATE | (F) Branches :1128-1130 are exhaustive over present filingAgeHours (filing non-null on this path); initializer dead. |
| info-edge.ts:1134 | `const distFromNeutral = filingRecencyScore - 50;` | LEGITIMATE | Arithmetic; keyword-only match. |
| info-edge.ts:1136 | `if (distFromNeutral > 0) {` | LEGITIMATE | Keyword-only match. |
| info-edge.ts:1138 | `filingModifier = round((distFromNeutral / 35) * 8 * ageMultiplier, 1);` | LEGITIMATE | Computed from present surprise + filing age. |
| info-edge.ts:1141 | `filingModifier = round((distFromNeutral / 35) * 12 * ageMultiplier, 1);` | LEGITIMATE | Computed from present data (asymmetric bearish scale, documented :1133). |
| info-edge.ts:1146 | `epsEstimate,` | LEGITIMATE | Trace field (null-preserving); keyword-only match. |
| info-edge.ts:1149 | `revenueEstimate,` | LEGITIMATE | Trace field; keyword-only match. |
| info-edge.ts:1175 | `// from real data. Return null — excluded, weights re-normalize. Never imputed.` | LEGITIMATE | comment/doc — behavior at :1176-1178. |
| info-edge.ts:1185 | `// exist and none changed position — zero net flow is genuinely neutral` | LEGITIMATE | comment/doc — behavior classified at :1188. |
| info-edge.ts:1186 | `// (legitimate-neutral, not imputation; ownership data was verified above).` | LEGITIMATE | comment/doc — behavior classified at :1188. |
| info-edge.ts:1188 | `let ioScore = 50;` | LEGITIMATE | Ownership presence verified (:1176 guard); stays 50 only when totalActive === 0 — holders exist and none changed position, a genuine neutral over present data (documented :1183-1186). |
| info-edge.ts:1204 | `// Staleness discount: 13F filings have 45-day delay; if > 90 days old, compress toward neutral by 30%` | LEGITIMATE | comment/doc — behavior at :1209-1212. |
| info-edge.ts:1210 | `const distFromNeutral = ioScore - 50;` | LEGITIMATE | Arithmetic over present-data score. |
| info-edge.ts:1211 | `ioScore = round(50 + distFromNeutral * 0.70); // compress 30% toward neutral` | LEGITIMATE | Staleness discount of a real score using the real filing date — a conservative compression, not imputation. |
| info-edge.ts:1216 | `` const formula = `NetBuyerRatio(${netBuyerRatio ?? 'N/A'}) → ${ioScore}...`; `` | LEGITIMATE | Display-only formula. |
| info-edge.ts:1220 | `` `ratio=${netBuyerRatio ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:1223 | `` `filing=${latestFilingDate ?? 'N/A'}`, `` | LEGITIMATE | Display-only notes. |
| info-edge.ts:1278 | `// never imputed as a neutral 50. Mirrors scoreNewsSentiment's null handling.` | LEGITIMATE | comment/doc — behavior at :1282-1284. |
| info-edge.ts:1281 | `const funds = input.finnhubFundOwnership?.funds ?? [];` | LEGITIMATE | null→[] normalization immediately guarded: empty ⇒ return null (:1282-1284), excluded and renormalized. |
| info-edge.ts:1285 | `const netChange = funds.reduce((sum, f) => sum + (f.change ?? 0), 0);` | GRAY | `change` is nullable (types.ts:1304). For PARTIAL nulls, `?? 0` in a sum is arithmetically identical to excluding the null entries — legitimate exclusion. But when EVERY fund's change is null, netChange = 0 scores a neutral 50 (:1289) that enters the 0.05-weighted sub-score with zero actual change data behind it. Question for Alex: should the all-null-change case force exclusion (return null) instead of scoring 50? |
| info-edge.ts:1289 | `else if (netChange === 0) s = 50;` | LEGITIMATE | With any real change data, netChange 0 = genuinely flat flows (present data); the all-null corner is the GRAY at :1285. |
| info-edge.ts:1291 | `else s = 25;` | LEGITIMATE | Present-data tier (netChange ≤ -1M). |
| info-edge.ts:1292 | `return { score: s, ... notes: netChange > 0 ? 'funds buying' : netChange < 0 ? 'funds selling' : 'neutral' };` | LEGITIMATE | Display-only notes label; score origin classified at :1285/:1289. |
| info-edge.ts:1297 | `// and its weight drops out of the re-normalized denominator — never imputed` | LEGITIMATE | comment/doc — behavior at :1301-1303. |
| info-edge.ts:1298 | `// as a neutral 50. Mirrors scoreNewsSentiment's null handling.` | LEGITIMATE | comment/doc. |
| info-edge.ts:1304 | `const count = input.edgar8kScan.totalHits ?? 0;` | VIOLATION | totalHits is nullable (types.ts:1324) and the fetcher sets it null when the EDGAR response's hit count can't be parsed (data-fetchers.ts:2474: `typeof json?.hits?.total?.value === 'number' ? ... : null`). A scan whose hit count is ABSENT is imputed as 0 hits ⇒ s = 65 (:1306), the MOST bullish tier ("no material events"), entering the 0.05-weighted info-edge score with no imputed/excluded-fields declaration. |
| info-edge.ts:1307 | `else if (count <= 2) s = 50;` | LEGITIMATE | Tier over a real hit count; the absent-count corner is the violation at :1304. |
| info-edge.ts:1315 | `// the remaining weights re-normalize. No sub-score is ever imputed with a` | LEGITIMATE | comment/doc — describes the combiner :1318-1334, which sums only PRESENT traces (verified: nulls skipped :1320-1328, denominator = activeWeight :1331-1334). |
| info-edge.ts:1316 | `// neutral value. All nine data-dependent sub-scores are nullable; only` | LEGITIMATE | comment/doc — same as :1315; also states analyst_consensus always returns a trace, which is why the :74/:88/:102/:123 defaults always reach the score. |
| info-edge.ts:1343 | `// EDGE-2b: imputedFields now covers ONLY analyst_consensus, the one sub-score` | LEGITIMATE | comment/doc — the deferred-residual documentation; defaults classified at :74/:88/:102/:123. |
| info-edge.ts:1344 | `// that still blends component-level defaults internally when parts of its data` | LEGITIMATE | comment/doc — same as :1343. |
| info-edge.ts:1346 | `const imputedFields: string[] = [];` | LEGITIMATE | Declaration bookkeeping; keyword-only match. |
| info-edge.ts:1347 | `if (input.finnhubRecommendations.length === 0 && !input.finnhubEstimates) imputedFields.push('analyst_consensus');` | LEGITIMATE | Loud declaration code — but note it UNDER-declares: it misses (a) recs empty with estimates present (:123 default undeclared), (b) estimates present but no future-period entries (:74/:88 undeclared), (c) finnhubEarnings empty (:74 undeclared). The score-side violations are rowed at :74/:88/:102/:123. |
| info-edge.ts:1348 | `else if (!input.finnhubEstimates) imputedFields.push('analyst_consensus.estimates');` | LEGITIMATE | Same declaration bookkeeping and same under-declaration caveat as :1347. |
| info-edge.ts:1350 | `// EDGE-2/EDGE-2b: excluded (dropped + re-normalized), NOT imputed. Derived from` | LEGITIMATE | comment/doc — excludedFields derivation :1354-1371 mirrors the actual nulls. |
| info-edge.ts:1373 | `// A sub-score not backed by full real data is either imputed (a placeholder` | LEGITIMATE | comment/doc. |
| info-edge.ts:1379 | `const missingCount = [...imputedFields, ...excludedFields].filter(f => !f.includes('.')).length;` | LEGITIMATE | Confidence bookkeeping over declared fields; keyword-only match. |
| info-edge.ts:1382 | `imputed_sub_scores: missingCount,` | LEGITIMATE | Trace field; keyword-only match. |
| info-edge.ts:1384 | `imputed_fields: imputedFields,` | LEGITIMATE | Trace field; keyword-only match. |

### Catch blocks

No `catch` blocks in this file (grep E: 0 hits).

| file:line | what the catch does | class | note |
|---|---|---|---|
| — | — | — | no catch blocks |

### Self-check
- grep A: 64 lines, B: 0, C: 30, D: 109, E: 0; unique grep-hit lines: 194 (A∩D = {131, 188, 208, 351}; C∩D = {74, 83, 88, 102, 123}; A∩C = ∅) — all 194 rowed.
- F (manual read) added 11 rows not matched by A-D: 51, 723, 811(-814), 897(-898), 906, 936, 967, 970, 973, 1063(-1064), 1127. Total rows: 205.
- Not individually rowed (rationale): `? ... : null` ternaries and null initializers at :50, :60, :64, :70, :108, :189, :215, :222-223, :528-530, :532-533, :582-583, :599-600, :651-653, :794-795, :911, :945, :949, :1205-1206 — these are the EDGE-2 null-exclusion mechanism itself (`?? null`-class normalization; absence stays null and is excluded/renormalized downstream), cannot inject a value into a score. Saturation-tier literals fed by present data (e.g. :273/:278 priceTargetScore 80/20, :479-483, :538-543, :642-646, :657-662, :900-903, :923-926, :1108-1116, :1194-1199, :1287-1291 tier tops/bottoms) are tier ends over present inputs, not defaults. :1128-1130 ageMultiplier tiers use present filingAgeHours.
- Combiner verified (:1318-1334): only non-null traces enter activeSubScores; score = Σ(w·s)/Σ(w) over present traces — so every VIOLATION above reaches the info-edge score only via analyst_consensus (always included, :1319) or a non-null trace it fabricated into (:1304 → materialEventFlag trace with s=65).

## src/lib/convergence/types.ts

### Pattern hits

All hits are grep D (keyword) matches; grep A/B/C/E: 0 hits. This file contains only type declarations and doc comments — no runtime behavior, so nothing here can itself bias a score, price, size, or stored value.

| file:line | verbatim code | class | justification |
|---|---|---|---|
| types.ts:37 | `earningsEstimate: number \| null;` | LEGITIMATE | Nullable type declaration — keyword-only match. |
| types.ts:66 | `estimate: number;` | LEGITIMATE | Type declaration. |
| types.ts:73 | `export interface FinnhubEpsEstimate {` | LEGITIMATE | Interface name — keyword-only match. |
| types.ts:83 | `export interface FinnhubRevenueEstimate {` | LEGITIMATE | Interface name. |
| types.ts:111 | `export interface FinnhubEstimateData {` | LEGITIMATE | Interface name. |
| types.ts:112 | `epsEstimates: FinnhubEpsEstimate[];` | LEGITIMATE | Type declaration. |
| types.ts:113 | `revenueEstimates: FinnhubRevenueEstimate[];` | LEGITIMATE | Type declaration. |
| types.ts:256 | `sentiment: 'bullish' \| 'bearish' \| 'neutral';` | LEGITIMATE | Union label in type — keyword-only match. |
| types.ts:263 | `neutral: number;` | LEGITIMATE | Count field (neutral article matches) — type declaration. |
| types.ts:331 | `epsEstimate: number \| null;       // from Finnhub estimates (already fetched)` | LEGITIMATE | Nullable type declaration + doc comment. |
| types.ts:332 | `epsSurprisePct: number \| null;    // (actual - estimate) / \|estimate\| * 100` | LEGITIMATE | Nullable type declaration + formula doc. |
| types.ts:334 | `revenueEstimate: number \| null;` | LEGITIMATE | Nullable type declaration. |
| types.ts:380 | `companyNewsScore: number;               // FinBERT overall company sentiment score (0-1, 0.5 = neutral)` | LEGITIMATE | Type-definition comment describing scale semantics. |
| types.ts:423 | `// for vrp_z / the VRP percentile — never a peer proxy, never a fabricated` | LEGITIMATE | comment/doc — EDGE-4 policy comment stating exclusion (null ⇒ excluded + renormalized); behavior implemented outside the assigned files. |
| types.ts:443 | `finnhubEstimates: FinnhubEstimateData \| null;` | LEGITIMATE | Nullable input declaration — null handling classified in info-edge.ts rows. |
| types.ts:469 | `imputed_sub_scores: number;    // sub-scores not backed by full real data (imputed + excluded)` | LEGITIMATE | Type-definition comment; behavior itself classified at info-edge.ts:1379-1384. |
| types.ts:470 | `confidence: number; // 1 - (imputed / total), range 0 to 1` | LEGITIMATE | Type-definition comment; behavior at info-edge.ts:1383. |
| types.ts:471 | `imputed_fields: string[];` | LEGITIMATE | Type declaration; behavior at info-edge.ts:1346-1348. |
| types.ts:473 | `// weights re-normalized — never imputed with a neutral value. These fields` | LEGITIMATE | comment/doc — describes EDGE-2 exclusion; behavior at info-edge.ts:1313-1334. |
| types.ts:505 | `transform: 'percentile' \| 'z-score-fallback' \| 'raw';` | LEGITIMATE | Union label naming a transform mode implemented in the volatility scorer (outside assigned files); type-only here. |
| types.ts:559 | `skew_direction: 'bullish' \| 'bearish' \| 'neutral';` | LEGITIMATE | Union label — keyword-only match. |
| types.ts:567 | `gex_regime: 'long_gamma' \| 'short_gamma' \| 'neutral';` | LEGITIMATE | Union label. |
| types.ts:606 | `piotroski_source: string;  // "quarterly_financials" \| "annual_financials" \| "proxy_imputed"` | LEGITIMATE | Type-definition comment naming a "proxy_imputed" mode implemented in the financial-stability scorer (outside assigned files) — flagged for that file's census; type-only here. |
| types.ts:614 | `source: string;           // "quarterly_financials" \| "proxy_imputed"` | LEGITIMATE | Same as :606 (altman_z source label) — behavior owned by the financial-stability scorer's census. |
| types.ts:813 | `estimate_level_score: number;` | LEGITIMATE | Trace-shape declaration; the value's origin classified at info-edge.ts:74. |
| types.ts:814 | `estimate_dispersion_score: number;` | LEGITIMATE | Trace-shape declaration; origin at info-edge.ts:88. |
| types.ts:824 | `number_analysts_estimates: number \| null;` | LEGITIMATE | Nullable trace declaration. |
| types.ts:959 | `keyword: 'bullish' \| 'bearish' \| 'neutral' \| null;` | LEGITIMATE | Nullable union — absence representable as null. |
| types.ts:960 | `finbert: 'bullish' \| 'bearish' \| 'neutral' \| null;` | LEGITIMATE | Same as :959. |
| types.ts:1022 | `weight_mode: 'dynamic' \| 'static_fallback';` | LEGITIMATE | Union label naming a gate-weight mode implemented outside the assigned files; type-only here. |
| types.ts:1137 | `sentiment: 'bullish' \| 'bearish' \| 'neutral';` | LEGITIMATE | Union label. |
| types.ts:1248 | `export interface FinnhubEbitdaEstimateEntry {` | LEGITIMATE | Interface name — keyword-only match. |
| types.ts:1256 | `export interface FinnhubEbitdaEstimate {` | LEGITIMATE | Interface name. |
| types.ts:1258 | `estimates: FinnhubEbitdaEstimateEntry[];` | LEGITIMATE | Type declaration. |
| types.ts:1261 | `export interface FinnhubEbitEstimateEntry {` | LEGITIMATE | Interface name. |
| types.ts:1269 | `export interface FinnhubEbitEstimate {` | LEGITIMATE | Interface name. |
| types.ts:1271 | `estimates: FinnhubEbitEstimateEntry[];` | LEGITIMATE | Type declaration. |
| types.ts:1330 | `epsEstimate: number \| null;` | LEGITIMATE | Nullable type declaration. |
| types.ts:1334 | `revenueEstimate: number \| null;` | LEGITIMATE | Nullable type declaration. |

Census-relevant type facts surfaced while classifying info-edge.ts: `FinnhubFundOwnershipEntry.change: number \| null` (types.ts:1304) makes info-edge.ts:1285 GRAY live; `SECEdgar8KScan.totalHits: number \| null` (types.ts:1324) makes info-edge.ts:1304 a live violation; `FinnhubPriceTarget.numberAnalysts: number` (types.ts:98, non-nullable) makes info-edge.ts:258 dead-defensive.

### Catch blocks

No `catch` blocks in this file (grep E: 0 hits).

| file:line | what the catch does | class | note |
|---|---|---|---|
| — | — | — | no catch blocks |

### Self-check
- grep A: 0 lines, B: 0, C: 0, D: 39, E: 0; unique lines rowed: 39 (no exclusions).

## Summary
- VIOLATION: 5 — info-edge.ts:74, :88, :102, :123 (the EDGE-2b deferred analyst_consensus internal defaults, quoted verbatim above), info-edge.ts:1304 (edgar8kScan.totalHits ?? 0 → bullish 65 on unparseable hit count).
- GRAY: 2 — info-edge.ts:32 (±2% SUE threshold with <3 quarters), info-edge.ts:1285 (all-fund-changes-null → neutral 50 instead of exclusion).
- Catch blocks: 0 in both files.

# Fallback census — regime group (READ-ONLY, main @ c12e48f7)

Files: regime.ts, cross-asset.ts, sentiment.ts, composite.ts (src/lib/convergence/).
All line numbers from `grep -nE` / Read on the actual files. Pipes in code escaped as `\|`.

## src/lib/convergence/regime.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| regime.ts:17 | `// Hamilton (1989): regime detection should use data-estimated thresholds.` | LEGITIMATE | comment/doc — cites methodology, no behavior. |
| regime.ts:43 | `if (!dateStr) return false; // can't determine — don't flag` | LEGITIMATE | staleness display flag only; a null date implies the series itself is null, which is separately tracked in imputed_fields (631-645); cannot bias a score. |
| regime.ts:63 | `if (v === null) return 50;` (normalizeGdp) | VIOLATION | GDP null → imputed neutral 50 enters computeGrowthSignal weighted sum (line 160, weight 0.25) → regime score; tracked in imputed_fields (631) but NOT excluded/re-normalized per the missing-signals mandate. |
| regime.ts:70 | `if (v === null) return 50;` (normalizeUnemployment) | VIOLATION | same pattern: null → 50 enters growth composite (line 160, weight 0.20); tracked at 632, not excluded. |
| regime.ts:77 | `if (v === null) return 50;` (normalizeNfp) | VIOLATION | null → 50 enters growth composite (line 160, weight 0.20); tracked at 633, not excluded. |
| regime.ts:84 | `if (v === null) return 50;` (normalizeConsumerConfidence) | VIOLATION | null → 50 enters growth composite (line 161, weight 0.15); tracked at 634, not excluded. |
| regime.ts:92 | `if (v === null) return 50;` (normalizeIcsa) | VIOLATION | null → 50 enters growth composite (line 161, weight 0.10); tracked at 635, not excluded. |
| regime.ts:98 | `// Zero = neutral. Positive values signal tightening financial conditions.` | LEGITIMATE | comment/doc — behavior itself classified at regime.ts:100. |
| regime.ts:100 | `if (v === null) return 50;` (normalizeNfci) | VIOLATION | null → 50 enters growth composite (line 161, weight 0.10); tracked at 636, not excluded. |
| regime.ts:107 | `if (v === null) return 50;` (normalizeCpiYoy) | VIOLATION | null → 50 enters computeInflationSignal weighted sum (line 189, weight 0.30); tracked at 637, not excluded. |
| regime.ts:114 | `if (v === null) return 50;` (normalizeCpiMom) | VIOLATION | null → 50 enters inflation composite (line 189, weight 0.20); tracked at 638, not excluded. |
| regime.ts:121 | `if (v === null) return 50;` (normalizeFedFunds) | VIOLATION | null → 50 enters inflation composite (line 189, weight 0.15); tracked at 639, not excluded. |
| regime.ts:128 | `if (v === null) return 50;` (normalizeTreasury10y) | VIOLATION | null → 50 enters inflation composite (line 190, weight 0.15); tracked at 640, not excluded. |
| regime.ts:134 | `// > 3.0% → elevated inflation expectations. < 1.5% → deflation risk. 2.0-2.5% → neutral.` | LEGITIMATE | comment/doc — behavior itself classified at regime.ts:136. |
| regime.ts:136 | `if (v === null) return 50;` (normalizeBreakeven5y) | VIOLATION | null → 50 enters inflation composite (line 190, weight 0.20); tracked at 641, not excluded. |
| regime.ts:181 | `const cpiMomScore = normalizeCpiMom(m.cpiMom ?? null);` | LEGITIMATE | `?? null` normalization of an optional field to explicit null; the imputation itself is classified at regime.ts:114. |
| regime.ts:221 | `// by Hamilton (1989) regime-switching framework. Not HMM-estimated` | LEGITIMATE | comment/doc — describes the model, no behavior. |
| regime.ts:342 | `let adjustmentType = 'NEUTRAL';` | GRAY | when `macro.vix === null` the overlay stays 0 (exclusion of an additive modifier — fine) but is labeled 'NEUTRAL', indistinguishable from a real mid-band VIX (15-24), and VIX absence is NOT counted in regime data_confidence (totalSubScores=14 at 646 excludes vix; only composite.ts:352 notes it as a gap). Question for Alex: should missing VIX render a distinct 'NOT_AVAILABLE' adjustment_type and count as an imputed sub-score? |
| regime.ts:408 | `return { ...zero, note: 'cross_asset_correlations: not available' };` | LEGITIMATE | missing correlations → zero adjustment (exclusion, not imputation), declared in the note and tracked in imputed_fields (645). |
| regime.ts:456 | `default:` (→ 457 `adj = { ...zero };`) | LEGITIMATE | switch exhaustiveness for cluster 'transition' → zero adjustment; input data is PRESENT, transition genuinely means "no adjustment". |
| regime.ts:497 | `else if (macro.bbbSpread < 3.0) bbbScore = 40;` | LEGITIMATE | banded score computed from PRESENT bbbSpread (guarded `!== null` at 493); ancillary signal is audit-only, not wired into the composite (comment 477, only returned in breakdown 732). |
| regime.ts:507 | `else if (macro.t10y3m > -0.5) t10y3mScore = 40;` | LEGITIMATE | banded score from PRESENT t10y3m (guard 503); audit-only ancillary (breakdown 733). |
| regime.ts:516 | `else if (macro.dollarIndex < 105) dollarScore = 50;` | LEGITIMATE | banded score from PRESENT dollarIndex (guard 513); audit-only ancillary (breakdown 734). |
| regime.ts:517 | `else if (macro.dollarIndex < 110) dollarScore = 40;` | LEGITIMATE | same banding from present data; audit-only. |
| regime.ts:518 | `else dollarScore = 25;` | LEGITIMATE | same banding from present data; audit-only. |
| regime.ts:532 | `else if (fedNetLiquidity > 4500) fedNetLiquidityScore = 50;` | LEGITIMATE | banded score from PRESENT WALCL/WTREGEN/RRPONTSYD (all-non-null guard 524-528); audit-only ancillary (breakdown 735). |
| regime.ts:533 | `else if (fedNetLiquidity > 4000) fedNetLiquidityScore = 40;` | LEGITIMATE | same banding from present data; audit-only. |
| regime.ts:534 | `else fedNetLiquidityScore = 25;` | LEGITIMATE | same banding from present data; audit-only. |
| regime.ts:614 | `const corrSpy = input.ttScanner?.corrSpy ?? null;` | LEGITIMATE | `?? null` normalization of an optional chain; downstream behavior classified at regime.ts:624. |
| regime.ts:624 | `multiplier = 1.0;` (corrSpy null branch, note at 626 `'spy_correlation: not_available — using base regime score unmodified'`) | GRAY | missing corrSpy → full regime effect (multiplier 1.0) instead of the 0.1 floor a present-but-zero correlation would get; declared in modifierNote but NOT counted in imputed_fields/data_confidence. Question for Alex: when corrSpy is absent should the ticker get the full base regime score (current), the 0.1 minimal floor, or an imputed-tracked exclusion? |
| regime.ts:629 | `// Build DataConfidence — track which macro fields are imputed (null → default 50)` | LEGITIMATE | comment/doc — behavior classified at regime.ts:63-136 (imputation) and 630-651 (tracking). |
| regime.ts:630 | `const imputedFields: string[] = [];` | LEGITIMATE | bookkeeping initializer for imputation tracking; cannot bias a score. |
| regime.ts:631 | `if (macro.gdp === null) imputedFields.push('growth.gdp');` | LEGITIMATE | records the imputation (violation classified at 63); tracking increases transparency, does not enter scoring. |
| regime.ts:632 | `if (macro.unemployment === null) imputedFields.push('growth.unemployment');` | LEGITIMATE | tracking only (imputation classified at 70). |
| regime.ts:633 | `if (macro.nonfarmPayrolls === null) imputedFields.push('growth.nfp');` | LEGITIMATE | tracking only (imputation classified at 77). |
| regime.ts:634 | `if (macro.consumerConfidence === null) imputedFields.push('growth.consumer_confidence');` | LEGITIMATE | tracking only (imputation classified at 84). |
| regime.ts:635 | `if (macro.initialClaims === null) imputedFields.push('growth.initial_claims');` | LEGITIMATE | tracking only (imputation classified at 92). |
| regime.ts:636 | `if (macro.nfci === null) imputedFields.push('growth.nfci');` | LEGITIMATE | tracking only (imputation classified at 100). |
| regime.ts:637 | `if (macro.cpi === null) imputedFields.push('inflation.cpi_yoy');` | LEGITIMATE | tracking only (imputation classified at 107). |
| regime.ts:638 | `if ((macro.cpiMom ?? null) === null) imputedFields.push('inflation.cpi_mom');` | LEGITIMATE | `?? null` normalization inside tracking bookkeeping (imputation classified at 114). |
| regime.ts:639 | `if (macro.fedFunds === null) imputedFields.push('inflation.fed_funds');` | LEGITIMATE | tracking only (imputation classified at 121). |
| regime.ts:640 | `if (macro.treasury10y === null) imputedFields.push('inflation.treasury_10y');` | LEGITIMATE | tracking only (imputation classified at 128). |
| regime.ts:641 | `if (macro.breakeven5y === null) imputedFields.push('inflation.breakeven_5y');` | LEGITIMATE | tracking only (imputation classified at 136). |
| regime.ts:643 | `if (macro.yieldCurveSpread === null) imputedFields.push('regime.yield_curve_spread');` | LEGITIMATE | tracking only; a null yieldCurveSpread is genuinely EXCLUDED from classifyRegime (guard at 234), not imputed. |
| regime.ts:644 | `if (macro.hySpread === null) imputedFields.push('regime.hy_spread');` | LEGITIMATE | tracking only; null hySpread is excluded from the stress modifier (guard at 245), not imputed. |
| regime.ts:645 | `if (!input.crossAssetCorrelations) imputedFields.push('regime.cross_asset_correlations');` | LEGITIMATE | tracking only; absence yields zero adjustment (408), not an imputed value. |
| regime.ts:649 | `imputed_sub_scores: imputedFields.length,` | LEGITIMATE | confidence bookkeeping from tracked counts; output metadata, not a score input. |
| regime.ts:650 | `confidence: round(1 - imputedFields.length / totalSubScores, 4),` | LEGITIMATE | confidence math over real tracked counts; metadata only. |
| regime.ts:651 | `imputed_fields: imputedFields,` | LEGITIMATE | metadata passthrough. |

### Catch blocks

| file:line | what the catch does | mode | note |
|---|---|---|---|
| (none) | grep E returned 0 hits in regime.ts | — | no catch blocks in this file. |

### Self-check
- grep A: 3 lines, B: 0, C: 8, D: 25, E: 0; unique grep lines rowed: 35 (638 matched both A and D — one row). STEP-F additions rowed: 14 (43; the 11 `return 50` normalize guards at 63/70/77/84/92/100/107/114/121/128/136; 408; 624). Total rows: 49. No grep hit excluded.

## src/lib/convergence/cross-asset.ts

### Pattern hits

Greps A-E returned zero hits. All rows below are STEP-F finds (ternaries/guards assigning literals in scoring paths).

| file:line | verbatim code | class | justification |
|---|---|---|---|
| cross-asset.ts:36 | `if (n < 20) return null; // Need at least 20 observations for meaningful correlation` | LEGITIMATE | insufficient data → explicit null (fail-explicit), which propagates to 'transition'/zero-adjustment downstream; nothing fabricated. |
| cross-asset.ts:48 | `if (denom === 0) return null;` | LEGITIMATE | degenerate variance → explicit null, same propagation; no fabricated value. |
| cross-asset.ts:97 | `return { cluster: 'transition', confidence: 0 };` (any input null) | LEGITIMATE | missing correlation input → 'transition' with confidence 0, which regime.ts treats as ZERO score adjustment (581 skips transition) — exclusion, not imputation, and per-series absence is declared in `note` (195-197). |
| cross-asset.ts:129 | `return { cluster: 'transition', confidence: round(spread, 4) };` | LEGITIMATE | genuine neutral band over PRESENT correlation values (best-vs-second spread < 0.1); computed, not defaulted. |
| cross-asset.ts:147 | `if (available.length < 2) { return null; }` | LEGITIMATE | fewer than 2 usable series → explicit null; regime.ts tracks the absence as imputed (regime.ts:645) and applies zero adjustment. |
| cross-asset.ts:151 | `const bondReturns = dgs10 ? computeDailyReturns(dgs10.observations, true) : [];` | LEGITIMATE | missing series → empty returns → corrPair yields null → that pair excluded; absence declared in `note` ('DGS10: no data', 195). |
| cross-asset.ts:152 | `const equityReturns = sp500 ? computeDailyReturns(sp500.observations, false) : [];` | LEGITIMATE | same — null pair excluded, declared at 196. |
| cross-asset.ts:153 | `const oilReturns = oil ? computeDailyReturns(oil.observations, false) : [];` | LEGITIMATE | same — null pair excluded, declared at 197. |
| cross-asset.ts:160-162 | `if (aVals.length < window) { // Use whatever we have if at least 20 observations` `return pearsonCorrelation(aVals, bVals);` | GRAY | when aligned history is shorter than the labeled window, a shorter-window correlation is silently used AS the "60d"/"252d" value (down to 20 obs) and the output does not disclose the actual window; it enters cluster classification → regime score adjustment. Question for Alex: is a sub-window correlation acceptable as the labeled 60d/252d figure, and must the effective window length be reported in the output note? |
| cross-asset.ts:188 | `const maxDiff = diffs.length > 0 ? Math.max(...diffs) : 0;` | LEGITIMATE | no computable pairs → magnitude 0 → regime_shift_detected=false → NO amplification (467-469 never fires); absence of signal produces absence of effect, though magnitude is reported as 0 rather than null (cosmetic). |
| cross-asset.ts:201-206 | `bond_equity: bondEquity60 !== null ? round(bondEquity60) : null,` (and 5 siblings) | LEGITIMATE | `: null` normalization for output — nulls stay null, nothing imputed. |
| cross-asset.ts:211 | `note: notes.length > 0 ? notes.join('; ') : \`cluster=${cluster}, confidence=${confidence}\`` | LEGITIMATE | display-only note string. |

### Catch blocks

| file:line | what the catch does | mode | note |
|---|---|---|---|
| (none) | grep E returned 0 hits in cross-asset.ts | — | no catch blocks in this file. |

### Self-check
- grep A: 0 lines, B: 0, C: 0, D: 0, E: 0; unique lines rowed: 12 (all STEP-F finds; rows 160-162 and 201-206 cover contiguous lines of a single construct each). No hit excluded.

## src/lib/convergence/sentiment.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| sentiment.ts:21 | `neutralCount: number;     // posts classified as neutral` | LEGITIMATE | type declaration + comment; no behavior. |
| sentiment.ts:25 | `sentiment: 'bullish' \| 'bearish' \| 'neutral';` | LEGITIMATE | type union; no behavior. |
| sentiment.ts:54 | `sentiment: 'bullish' \| 'bearish' \| 'neutral';` | LEGITIMATE | type union; no behavior. |
| sentiment.ts:75 | `neutralCount: 0,` (in emptyResult) | LEGITIMATE | part of the declared-failure empty result — emptyResult always carries an `error` field (67-80), so zeros are labeled as failure, not fabricated data. |
| sentiment.ts:84 | `for (const output of data.output \|\| []) {` | LEGITIMATE | absent array → no text → caller returns null and console.warns (173-175); normalization whose failure path is declared. |
| sentiment.ts:104 | `const candidate = objMatch?.[0] \|\| arrMatch?.[0];` (STEP-F) | LEGITIMATE | parse candidate selection; no match → return null (105), handled loudly by callers (180, 239). |
| sentiment.ts:135 | `- The key sentiment (bullish, bearish, or neutral)` | LEGITIMATE | prompt text sent to Grok; not a code default. |
| sentiment.ts:144 | `"overall_sentiment": "bullish\|bearish\|neutral\|mixed",` | LEGITIMATE | prompt text; not a code default. |
| sentiment.ts:204 | `- Score: -1.0 (extremely bearish) to +1.0 (extremely bullish), 0 = neutral` | LEGITIMATE | prompt text; not a code default. |
| sentiment.ts:235 | `const content = data.choices?.[0]?.message?.content \|\| '';` | LEGITIMATE | absent content → '' → parseJSON null → console.warn + return null (238-241); failure declared to caller. |
| sentiment.ts:278 | `const neutralCount = posts.filter(p => p.sentiment === 'neutral').length;` | LEGITIMATE | computed count from PRESENT classified posts. |
| sentiment.ts:284 | `console.log(\`[Sentiment] ${symbol}: ${posts.length} posts, score=${scoreResult?.score ?? 'N/A'} ...\`)` | LEGITIMATE | log/display only — and it correctly shows 'N/A' on failure. |
| sentiment.ts:288 | `score: scoreResult?.score ?? 0,` | VIOLATION | when Stage-2 scoring FAILS (scoreResult null) after posts were found, score is imputed as neutral 0 on a result that carries NO `error` field — the persisted pipeline output (pipeline.ts:1940 `social_sentiment`) and the convergence-synthesis prompt (route.ts:376) cannot distinguish "scored 0" from "scoring failed"; only a console.warn fires. |
| sentiment.ts:289 | `magnitude: scoreResult?.magnitude ?? 0,` | VIOLATION | same silent Stage-2-failure imputation as 288 — magnitude 0 is also a legal genuine output, so the failure is fully masked in persisted data. |
| sentiment.ts:293 | `neutralCount,` | LEGITIMATE | passthrough of the computed count (278). |
| sentiment.ts:294 | `themes: (stage1.key_themes \|\| []).slice(0, 5),` | LEGITIMATE | absent themes → empty list (absence stays visible as empty), display/synthesis context only. |
| sentiment.ts:296 | `text: (p.text \|\| p.summary \|\| '').substring(0, 100),` | LEGITIMATE | display-only sample-post text fallback chain; no score impact. |
| sentiment.ts:297 | `sentiment: p.sentiment \|\| 'neutral',` | LEGITIMATE | display-only label on a sample post; the bullish/bearish/neutral COUNTS are computed from raw `p.sentiment` (276-278) and unaffected. |
| sentiment.ts:298 | `author: p.author \|\| '@unknown',` (STEP-F) | LEGITIMATE | display-only placeholder handle on a sample post; clearly marked unknown, no score impact. |

### Catch blocks

| file:line | what the catch does | mode | note |
|---|---|---|---|
| sentiment.ts:109 | `} catch { return null; }` (parseJSON) | (c) SWALLOW silently | the JSON.parse error itself is discarded, but the null is handled loudly by both callers (console.warn at 180 and 239) and propagates to a declared failure; parse-error detail is lost. |
| sentiment.ts:165 | `const errorText = await response.text().catch(() => '');` | (c) SWALLOW silently | swallows only the error-BODY read failure; the HTTP failure itself is still console.error'd with status at 166 and returns null. |
| sentiment.ts:302 | `} catch (err) { ... console.error(...); return emptyResult(symbol, msg); }` | (b) declare loudly | logs the error and returns emptyResult with the message in the `error` field — failure visible in persisted output. |

### Self-check
- grep A: 3 lines, B: 4, C: 0, D: 10, E: 3; unique grep A/B/D lines rowed: 17 (no overlaps). STEP-F additions rowed: 2 (104, 298). Total pattern rows: 19; catch rows: 3. No hit excluded.

## src/lib/convergence/composite.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| composite.ts:46-48 | `if (!regime) { return { gate_weights: { ...STATIC_WEIGHTS },` (STEP-F) | LEGITIMATE | equal-weight fallback for a null regime result is DECLARED in the trace (`weight_mode: 'static_fallback'`, surfaced in the composite note at 185) — and unreachable from scoreAll, which always passes scoreRegime's unconditional return (119, 123). |
| composite.ts:49 | `weight_mode: 'static_fallback',` | LEGITIMATE | the loud declaration label of the branch above — classified with composite.ts:46-48. |
| composite.ts:76 | `const dynamicWeights = REGIME_WEIGHT_TABLE[dominantRegime] ?? STATIC_WEIGHTS;` (STEP-F) | GRAY | dominant_regime is provably one of GOLDILOCKS/REFLATION/STAGFLATION/DEFLATION/CRISIS today (regime.ts:267, composite.ts:62), so the `??` is dead — but if a new label ever appeared, STATIC_WEIGHTS would be blended silently while weight_mode still reports 'dynamic' (97). Question for Alex: should an unrecognized regime label throw (fail-loud) instead of silently defaulting the gate weights? |
| composite.ts:97 | `weight_mode: blendFactor > 0 ? 'dynamic' : 'static_fallback',` | LEGITIMATE | honest labeling: blendFactor 0 (equal regime probabilities, computed from PRESENT data) mathematically yields exactly STATIC_WEIGHTS via the blend at 80-84; the label describes real math. |
| composite.ts:161 | `else direction = 'NEUTRAL';` | LEGITIMATE | genuine neutral band (35-65) over a PRESENT info_edge score; computed classification, not a missing-data default. |
| composite.ts:164 | `const allImputed = [` | LEGITIMATE | aggregation bookkeeping of tracked imputations; metadata only. |
| composite.ts:165 | `...volEdge.data_confidence.imputed_fields.map(f => \`vol_edge.${f}\`),` | LEGITIMATE | tracking passthrough. |
| composite.ts:166 | `...quality.data_confidence.imputed_fields.map(f => \`quality.${f}\`),` | LEGITIMATE | tracking passthrough. |
| composite.ts:167 | `...regime.data_confidence.imputed_fields.map(f => \`regime.${f}\`),` | LEGITIMATE | tracking passthrough. |
| composite.ts:168 | `...infoEdge.data_confidence.imputed_fields.map(f => \`info_edge.${f}\`),` | LEGITIMATE | tracking passthrough. |
| composite.ts:177 | `imputed_sub_scores: allImputed.length,` | LEGITIMATE | confidence metadata from tracked counts. |
| composite.ts:178 | `confidence: round(1 - allImputed.length / totalSub, 4),` | LEGITIMATE | confidence math over real counts; metadata only. |
| composite.ts:179 | `imputed_fields: allImputed,` | LEGITIMATE | metadata passthrough. |
| composite.ts:229 | `if (ivp !== null && ivp <= 1.0) ivp = Math.round(ivp * 1000) / 10;` (STEP-F) | LEGITIMATE | heuristic decimal→percent unit guard on PRESENT data feeding only the `vol_edge_confirms` display string (244-250) — suggested strategy/DTE use volScore/regimeScore, not ivp; a genuine IVP of ≤1% would be mislabeled in text only, no score/size impact. |
| composite.ts:237 | `regimePreferred = \`Neutral strategies favored (regime_score=${round(regimeScore)})\`;` | LEGITIMATE | display string derived from a PRESENT regime score band. |
| composite.ts:247 | `volEdgeConfirms = \`IVP=${ivp}% → neutral premium levels\`;` | LEGITIMATE | display string from PRESENT ivp band. |
| composite.ts:249 | `volEdgeConfirms = \`IVP=${ivp ?? 'N/A'}% → premiums compressed, long vol or pass\`;` | LEGITIMATE | display-only `?? 'N/A'` — missing IVP is shown as N/A, not fabricated. |
| composite.ts:254 | `let suggestedDte = 45; // Default` | LEGITIMATE | initializer is dead — every direction branch (256-284) assigns suggestedDte before use; and DTE is a strategy-suggestion parameter (model constant), not a missing-data imputation. |
| composite.ts:256 | `if (direction === 'NEUTRAL') {` | LEGITIMATE | branch on a classification computed from present data (161); keyword-only grep hit. |
| composite.ts:265 | `suggestedDte = 30;` | LEGITIMATE | model parameter chosen from PRESENT volScore/regimeScore bands; suggestion output, not a missing-data default. |
| composite.ts:273 | `suggestedDte = 30;` | LEGITIMATE | same — model parameter from present data. |
| composite.ts:282 | `suggestedDte = 30;` | LEGITIMATE | same — model parameter from present data. |

### Catch blocks

| file:line | what the catch does | mode | note |
|---|---|---|---|
| (none) | grep E returned 0 hits in composite.ts | — | no catch blocks in this file. |

### Self-check
- grep A: 1 line, B: 0, C: 3, D: 15, E: 0; unique grep lines rowed: 19 (no overlaps). STEP-F additions rowed: 3 (46-48, 76, 229). Total rows: 22. No hit excluded.


# Fallback Census — strategy group (strategy-builder, probability, chain-fetcher, trade-cards)

READ-ONLY census on branch main @ c12e48f7. One row per file:line for every grep A–D/F hit; catch-block table per grep E. All line numbers from `grep -nE` / Read on the actual files.

---

## src/lib/strategy-builder.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| strategy-builder.ts:28 | `if (!CREDIT_STRATEGIES.includes(card.name)) return card.pop ?? 0; // debit: keep delta PoP` | LEGITIMATE | Returns the already-computed delta PoP; the `?? 0` arm is unreachable-defensive because the only caller (line 854) skips cards with `pop == null`. |
| strategy-builder.ts:29 | `if (!hv30 \|\| hv30 <= 0) return card.pop ?? 0; // no HV data: keep delta PoP` | LEGITIMATE | Declared no-HV path keeps the existing delta PoP rather than inventing one; null pop guarded at caller (854). |
| strategy-builder.ts:32 | `if (vol <= 0) return card.pop ?? 0;` | LEGITIMATE | Same shape: degenerate vol keeps existing delta PoP; `?? 0` guarded by caller (854). |
| strategy-builder.ts:36 | `const credit = card.netCredit \|\| 0;` | LEGITIMATE | Every CREDIT_STRATEGIES card reaching here passed a scanner gate requiring `netCredit > 0` (614/655/691); if ever reached with null, credit=0 moves breakevens to the short strikes, which lowers (conservative) PoP. |
| strategy-builder.ts:56 | `return card.pop ?? 0;` | LEGITIMATE | Structural fallthrough (no short legs on a credit-named card) returns existing delta PoP; null pop guarded at caller (854). |
| strategy-builder.ts:230 | `// HV10>IV gate declares itself not-evaluated (never imputed, never silent).` | LEGITIMATE | Comment declaring the no-imputation contract for hv10; keyword hit only. |
| strategy-builder.ts:232 | `// Risk-free rate from FRED FEDFUNDS series, converted to decimal. Required — no default.` | LEGITIMATE | Comment; the field (233) is indeed a required non-optional param with no default in this file. |
| strategy-builder.ts:262 | `* @param pop - Estimated probability of profit (0-1, from delta approximation)` | LEGITIMATE | Doc-comment wording ("Estimated"); no code effect. |
| strategy-builder.ts:279 | `if (shortDelta == null \|\| longDelta == null \|\| shortDelta <= longDelta) {` (comment 278: "fall back to binary model") | LEGITIMATE | Model branch on strategy structure — deltas are null only when a side has no legs; both branches compute EV from present pop/maxProfit/maxLoss, nothing imputed. |
| strategy-builder.ts:282 | `const evPerRisk = absMaxLoss > 0 ? ev / absMaxLoss : 0;` | LEGITIMATE | Division-by-zero guard; zero-maxLoss cards cannot pass the mp/ml>0 gates, and 0 evPerRisk is the conservative direction for ranking. |
| strategy-builder.ts:298 | `const evPerRisk = absMaxLoss > 0 ? ev / absMaxLoss : 0;` | LEGITIMATE | Same guard in the three-outcome branch. |
| strategy-builder.ts:310 | `type: 'credit' \| 'debit' \| 'neutral';` | LEGITIMATE | 'neutral' is a strategy-type label in a union type, not a neutral score imputation. |
| strategy-builder.ts:328 | `{ name: 'Iron Condor', type: 'neutral' },` | LEGITIMATE | Strategy-type label only. |
| strategy-builder.ts:333 | `{ name: 'Calendar Spread', type: 'neutral' },` | LEGITIMATE | Strategy-type label only. |
| strategy-builder.ts:334 | `{ name: 'Diagonal Spread', type: 'neutral' },` | LEGITIMATE | Strategy-type label only. |
| strategy-builder.ts:345-349 | `function mid(...) { if (bid != null && ask != null) return (bid+ask)/2; if (bid != null) return bid; if (ask != null) return ask; return null; }` | LEGITIMATE | One-sided mid proxy BUT dead code — `mid(` has no call site in the file (grep: definition only) and is not exported; cannot bias anything today; flag for deletion. |
| strategy-builder.ts:373 | `return below[0] \|\| null;` | LEGITIMATE | Null normalization — no strike below honestly returns null (caller skips). |
| strategy-builder.ts:378 | `return above[0] \|\| null;` | LEGITIMATE | Same null normalization. |
| strategy-builder.ts:411 | `if (spacings.size === 0) return [1];` | LEGITIMATE | Width-candidate seed only (unreachable-defensive: caller has ≥3 valid strikes); a width candidate cannot fabricate a price — every leg still requires a real strike with a live two-sided quote. |
| strategy-builder.ts:426 | `const delta = (type === 'call' ? strike.callDelta : strike.putDelta) ?? 0;` | VIOLATION | Missing chain delta silently imputed as 0 on a buildable leg — flows into delta-approx PoP (539-546, where a 0 short delta reads as zero assignment risk and inflates PoP), three-outcome EV deltas (872-873), and persisted netDelta; reachable because the `valid` filter (718-721) only requires ONE side's delta per strike. |
| strategy-builder.ts:427 | `const gamma = (type === 'call' ? strike.callGamma : strike.putGamma) ?? 0;` | VIOLATION | Missing gamma imputed as 0 and persisted as netGamma on the card/TradeCard with no declaration — imputed value presented as real exposure. |
| strategy-builder.ts:428 | `const theta = (type === 'call' ? strike.callTheta : strike.putTheta) ?? 0;` | VIOLATION | Missing theta imputed as 0 enters thetaPerDay → the thetaEff term of compositeScore (1037-1038) used for ranking, plus persisted netTheta. |
| strategy-builder.ts:429 | `const vega = (type === 'call' ? strike.callVega : strike.putVega) ?? 0;` | VIOLATION | Missing vega imputed as 0 and persisted as netVega — silent default entering persistence. |
| strategy-builder.ts:441 | `iv: (type === 'call' ? strike.callIv : strike.putIv) ?? null,` | LEGITIMATE | Null normalization; the HV10>IV gate declares itself not-evaluated on null (943-946) rather than inventing a value. |
| strategy-builder.ts:550 | `const riskReward = maxLoss != null && maxLoss > 0 ? Math.round(...) : null;` | LEGITIMATE | Honest null when maxLoss is absent/zero; display+gate field stays declared-null. |
| strategy-builder.ts:555 | `maxProfit: maxProfit > 0 ? maxProfit : null,` | LEGITIMATE | Non-positive computed max profit normalized to null; downstream gates reject null/0 (616-617, 866). |
| strategy-builder.ts:558 | `pop: pop != null ? Math.round(pop * 100) / 100 : null,` | LEGITIMATE | Null stays null; no imputation. |
| strategy-builder.ts:583 | `... currentPrice: number, sym = '??'` | LEGITIMATE | Log-label default for console output only. |
| strategy-builder.ts:594 | `(shortPut=${sp?.strike ?? 'null'}, shortCall=${sc?.strike ?? 'null'})` | LEGITIMATE | Log-string display of a failed lookup. |
| strategy-builder.ts:616 | `const mp = card.maxProfit ?? 0;` | LEGITIMATE | Rejection path — the very next line `if (mp <= 0) continue;` discards the candidate; 0 can only reject, never price. |
| strategy-builder.ts:630 | `... currentPrice: number, sym = '??'` | LEGITIMATE | Log-label default. |
| strategy-builder.ts:657 | `const mp = card.maxProfit ?? 0;` | LEGITIMATE | Same rejection shape (`if (mp <= 0) continue;` at 658). |
| strategy-builder.ts:671 | `... currentPrice: number, sym = '??'` | LEGITIMATE | Log-label default. |
| strategy-builder.ts:679 | `(put=${sp?.strike ?? 'null'}, call=${sc?.strike ?? 'null'})` | LEGITIMATE | Log-string display. |
| strategy-builder.ts:711 | `const sym = symbol \|\| '??';` | LEGITIMATE | Log-label default. |
| strategy-builder.ts:833 | `const iv = params.iv30 ?? 0.30;` | VIOLATION | Absent IV30 silently defaulted to 30% and fed as sigma into the N(d2) breakeven PoP upgrade (838 → probability.ts d2), into the HV chain (848-851), and into edgeRatio (1028, where defaulted iv/hv silently produce a neutral 0 edge component) — a fabricated volatility inside Black-Scholes-style math. |
| strategy-builder.ts:848 | `const hv = params.hv30 ?? iv;` | VIOLATION | Absent HV30 imputed as IV (itself possibly the 0.30 default from 833); drives hvPop (859) and the hvProxyML risk proxy (851) used in EV gating and composite sizing — imputation, not exclusion/declaration. |
| strategy-builder.ts:850 | `const cappedHv = iv > 0 && hv > 0 && iv / hv > 4 ? iv / 4 : hv;` | LEGITIMATE | Cap computed from present iv/hv, declared in comment (849), and strictly conservative (larger vol → lower credit PoP, larger proxy ML → lower EV). |
| strategy-builder.ts:851 | `const hvProxyML = currentPrice * cappedHv * Math.sqrt(dte / 365) * 2.5 * 100;` | GRAY | Hardcoded 2.5-sigma HV proxy silently substitutes for maxLoss of unlimited-risk strategies in EV (882) and compositeScore (1036); QUESTION FOR ALEX: is 2.5×HV×√t the approved risk proxy for unlimited-risk sizing, and should cards carry a declared proxy flag instead of the substitution being invisible on the output? |
| strategy-builder.ts:855 | `const mp = card.maxProfit ?? 0;` | LEGITIMATE | mp=0 leaves ev at its initial 0 (guard 866), so the card is rejected at the EV gate (964) — rejection shape, no fabricated value survives. |
| strategy-builder.ts:860 | `card.hvPop = isCredit ? Math.round(hvPop * 1000) / 1000 : null;` | LEGITIMATE | Debit strategies honestly carry hvPop=null. |
| strategy-builder.ts:862 | `// Use HV-based proxy for unlimited risk (actual expected movement, not inflated IV)` | LEGITIMATE | Comment documenting the proxy (see GRAY row 851 for the substance). |
| strategy-builder.ts:863 | `const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);` | LEGITIMATE | For defined-risk cards maxLoss is always computed in buildCard (500-515); if ever null, effectiveML=0 fails the `> 0` guard (866) → ev stays 0 → EV gate rejects; the proxy branch itself is censused at 851 (GRAY). |
| strategy-builder.ts:872 | `const shortDelta = shortLegs.length > 0 ? Math.max(...) : null;` | LEGITIMATE | Structural null (no short legs), handled explicitly by the binary branch at 279. |
| strategy-builder.ts:873 | `const longDelta = longLegs.length > 0 ? Math.max(...) : null;` | LEGITIMATE | Same structural null. |
| strategy-builder.ts:965 | `const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);` | LEGITIMATE | Recomputed only to render the EV-gate rejection log message; the card is being rejected on this path. |
| strategy-builder.ts:966 | `(hvPoP=${card.hvPop?.toFixed(3) ?? 'n/a'}, ...)` | LEGITIMATE | Log-string display inside a rejection. |
| strategy-builder.ts:968 | `const sw = strikes.length >= 2 ? strikes[1] - strikes[0] : 0;` | LEGITIMATE | spreadWidth metadata attached to a rejection record; diagnostic only. |
| strategy-builder.ts:979 | `const threshold = POP_FLOORS[card.name] ?? 0.40;` | LEGITIMATE | Default PoP floor for names missing from POP_FLOORS — defensive (every name this generator produces is in the map) and a floor can only reject a card, never fabricate data. |
| strategy-builder.ts:986 | `details: { value: card.pop ?? 0, threshold },` | LEGITIMATE | Rejection-record display value on the reject path. |
| strategy-builder.ts:1028 | `const edgeRatio = iv > 0 ? Math.max(0, (iv - hv)) / iv : 0;` | LEGITIMATE | Guard itself is fine (iv is always > 0 here); NOTE the neutral-0 edge score when iv30/hv30 are absent is caused by the defaults at 833/848 (censused as VIOLATIONs there). |
| strategy-builder.ts:1036 | `const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);` | LEGITIMATE | In compositeScore: effectiveML=0 → thetaEff=0 (guard 1037), the conservative direction; proxy branch censused at 851. |
| strategy-builder.ts:1037 | `const thetaEff = effectiveML > 0 ? Math.abs(card.thetaPerDay) / effectiveML * 100 : 0;` | LEGITIMATE | Division guard; 0 removes the theta boost rather than inventing one. |
| strategy-builder.ts:1058 | `const cg = greeksData[s.callStreamerSymbol] \|\| {};` | LEGITIMATE | Missing symbol yields an empty object whose fields normalize to null below, and EDGE-1 (1071-1074) then nulls the leg — honest absence, rejection shape. |
| strategy-builder.ts:1059 | `const pg = greeksData[s.putStreamerSymbol] \|\| {};` | LEGITIMATE | Same. |
| strategy-builder.ts:1061 | `let callBid: number \| null = cg.bid ?? null;` | LEGITIMATE | Null normalization feeding the EDGE-1 liveness gate (bid>0 AND ask>0) at 1071-1074. |
| strategy-builder.ts:1062 | `let callAsk: number \| null = cg.ask ?? null;` | LEGITIMATE | Same. |
| strategy-builder.ts:1063 | `let putBid: number \| null = pg.bid ?? null;` | LEGITIMATE | Same. |
| strategy-builder.ts:1064 | `let putAsk: number \| null = pg.ask ?? null;` | LEGITIMATE | Same. |
| strategy-builder.ts:1067 | `// No estimation from one side (removed the old 0.4/2.5 blocks), no exchange-theo` | LEGITIMATE | Comment documenting the REMOVAL of the old pricing fallbacks; keyword hit only. |
| strategy-builder.ts:1078 | `const callTheo = cg.theoPrice > 0 ? cg.theoPrice : null;` | LEGITIMATE | Theo retained as informational context only and never substituted into bid/ask (comment 1076-1077); 0-sentinel normalized to null. |
| strategy-builder.ts:1079 | `const putTheo = pg.theoPrice > 0 ? pg.theoPrice : null;` | LEGITIMATE | Same. |
| strategy-builder.ts:1094 | `const callMid = callBid != null && callAsk != null ? (callAsk + callBid) / 2 : 0;` | LEGITIMATE | 0 sentinel immediately guarded at 1095; when a leg is live (EDGE-1) both sides exist, so the 0 arm only applies to already-nulled legs. |
| strategy-builder.ts:1095 | `const callWideSpread = callMid > 0 ? (callAsk! - callBid!) / callMid > 0.50 : false;` | LEGITIMATE | The `false` arm only fires for dead legs that EDGE-1 already excluded from building. |
| strategy-builder.ts:1096 | `const putMid = putBid != null && putAsk != null ? (putAsk + putBid) / 2 : 0;` | LEGITIMATE | Same as 1094. |
| strategy-builder.ts:1097 | `const putWideSpread = putMid > 0 ? (putAsk! - putBid!) / putMid > 0.50 : false;` | LEGITIMATE | Same as 1095. |
| strategy-builder.ts:1102 | `callDelta: cg.delta ?? null,` | LEGITIMATE | Null normalization; absence stays declared as null (but see chain-fetcher.ts:274 — the upstream `\|\| 0` coercion means a missing field on a received Greeks event arrives here as 0, not undefined). |
| strategy-builder.ts:1103 | `putDelta: pg.delta ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1104 | `callTheta: cg.theta ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1105 | `putTheta: pg.theta ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1106 | `callGamma: cg.gamma ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1107 | `putGamma: pg.gamma ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1108 | `callVega: cg.vega ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1109 | `putVega: pg.vega ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1110 | `callIv: cg.iv ?? null,` | LEGITIMATE | Same; downstream IV consumers additionally require > 0. |
| strategy-builder.ts:1111 | `putIv: pg.iv ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1112 | `callVolume: cg.volume ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1113 | `putVolume: pg.volume ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1114 | `callOI: cg.openInterest ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1115 | `putOI: pg.openInterest ?? null,` | LEGITIMATE | Same. |
| strategy-builder.ts:1202 | `const g = greeksData[cl.streamerSymbol] \|\| {};` | LEGITIMATE | Missing symbol → bid/ask null → the leg is dropped at 1206 (the drop itself is censused as a VIOLATION below). |
| strategy-builder.ts:1203 | `const bid: number \| null = g.bid ?? null;` | LEGITIMATE | Null normalization. |
| strategy-builder.ts:1204 | `const ask: number \| null = g.ask ?? null;` | LEGITIMATE | Null normalization. |
| strategy-builder.ts:1205 | `const price = cl.side === 'sell' ? bid : ask;` | GRAY | buildCustomCard prices a sell leg from bid alone (never requires a live ask), bypassing the EDGE-1 two-sided rule that buildStrikeData enforces; QUESTION FOR ALEX: must custom cards enforce the same real-bid-AND-real-ask liveness gate before pricing a leg? |
| strategy-builder.ts:1206 | `if (price == null \|\| price <= 0) continue;` | VIOLATION | Silently drops unpriceable legs and still builds/prices the card from the survivors (only `legs.length === 0` aborts, 1221) while detectStrategyName (1226) names the card from the FULL requested leg list — e.g. a 4-leg Iron Condor with one dead quote is returned as an "Iron Condor" priced on 3 legs with no declaration. |
| strategy-builder.ts:1207 | `const midVal = bid != null && ask != null ? (ask + bid) / 2 : 0;` | LEGITIMATE | 0 sentinel guarded at 1208; the substantive one-sided exposure is censused at 1205/1208. |
| strategy-builder.ts:1208 | `const wide = midVal > 0 ? (ask! - bid!) / midVal > 0.50 : false;` | GRAY | A custom sell leg with a missing ask gets wideSpread=false, silently suppressing the "WIDE BID-ASK SPREAD" risk flag on incomplete quote data; QUESTION FOR ALEX: should a one-sided/unknown spread flag as wide (or unknown) rather than not-wide? |
| strategy-builder.ts:1214 | `delta: cl.side === 'sell' ? -(g.delta ?? 0) : (g.delta ?? 0),` | VIOLATION | Missing delta imputed as 0 on a custom leg → delta-approx PoP and EV for the custom card, plus persisted netDelta (same defect as 426, custom path). |
| strategy-builder.ts:1215 | `gamma: cl.side === 'sell' ? -(g.gamma ?? 0) : (g.gamma ?? 0),` | VIOLATION | Imputed 0 persisted as netGamma (same as 427). |
| strategy-builder.ts:1216 | `theta: cl.side === 'sell' ? -(g.theta ?? 0) : (g.theta ?? 0),` | VIOLATION | Imputed 0 enters thetaPerDay and persisted netTheta (same as 428). |
| strategy-builder.ts:1217 | `vega: cl.side === 'sell' ? -(g.vega ?? 0) : (g.vega ?? 0),` | VIOLATION | Imputed 0 persisted as netVega (same as 429). |
| strategy-builder.ts:1251 | `const pnlRange = maxPnl - minPnl \|\| 1;` | LEGITIMATE | SVG y-axis scale guard in renderPnlSvg; display-only, cannot touch any priced or stored value. |

### Catch blocks

| file:line | what the catch does | category | note |
|---|---|---|---|
| — | no `catch` in this file (grep E: 0 hits) | — | — |

### Self-check
- grep A: 45 lines, B: 2, C: 0, D: 13, E: 0; unique A–D lines rowed: 57/57 (overlaps: 863, 965, 1036 hit by both A and D — one row each). F rows added: 35 (279, 282, 298, 345-349, 373, 378, 411, 550, 555, 558, 583, 630, 671, 711, 848, 850, 860, 872, 873, 968, 1028, 1037, 1058, 1059, 1078, 1079, 1094, 1095, 1096, 1097, 1202, 1205, 1206, 1207, 1208). Excluded from F by scope: display-only ternaries inside renderPnlSvg (1236-1237 SVG size defaults, 1239 empty-string return, 1303-1305/1310-1311 label ternaries) and the log-tier ternary at 750 — pure chart/log rendering, not pricing/POP/strategy functions; getStrategyLabels literal arrays (316-340) are IV-rank menu selection, not fallbacks.

---

## src/lib/convergence/probability.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| probability.ts:14 | `if (x > 10) return 1;` | LEGITIMATE | Numerical saturation of the normal CDF (true value within 7.5e-8 per the A&S approximation error bound); not a data default. |
| probability.ts:15 | `if (x < -10) return 0;` | LEGITIMATE | Same saturation on the left tail. |
| probability.ts:40 | `*   r = risk-free rate (from FRED FEDFUNDS series, converted to decimal). Required — no default.` | LEGITIMATE | Comment; the code honors it — riskFreeRate is a required parameter (51) with no default anywhere in this file. |
| probability.ts:53 | `if (spotPrice <= 0 \|\| targetPrice <= 0 \|\| iv <= 0 \|\| dteYears <= 0) return null;` | LEGITIMATE | Invalid inputs return null (declared in the JSDoc `@returns`), and every caller propagates the null — rejection shape, no imputation. |
| probability.ts:56 | `const d2 = (Math.log(spotPrice / targetPrice) + (riskFreeRate - iv * iv / 2) * dteYears) / (iv * sqrtT);` | VIOLATION | The d2 drift is `(r − σ²/2)` with NO dividend-yield term — q is implicitly defaulted to 0 inside Black-Scholes-style math for every underlying, overstating upward drift for dividend payers and biasing probAbove/probBelow/probBetween (and therefore every breakeven_d2 PoP, the PoP gate, and EV) even though dividendYield exists in the pipeline (trade-cards.ts:404 `tt?.dividendYield`). |

### Catch blocks

| file:line | what the catch does | category | note |
|---|---|---|---|
| — | no `catch` in this file (grep E: 0 hits) | — | — |

### Self-check
- grep A: 0 lines, B: 0, C: 0, D: 1, E: 0; unique lines rowed: 1/1, plus 4 F rows (14, 15, 53, 56). No exclusions (the `sign = x < 0 ? -1 : 1` ternary at 24 is arithmetic, not a default).

---

## src/lib/convergence/chain-fetcher.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| chain-fetcher.ts:21 | `// Risk-free rate from FRED FEDFUNDS series, converted to decimal. Required — no default.` | LEGITIMATE | Comment; riskFreeRate (22) is a required non-nullable field with no default in this file. |
| chain-fetcher.ts:166-169 | `if (res.status !== 'fulfilled') { ... console.error('[ChainFetcher] Chain fetch failed:', reason); continue; }` | GRAY | A ticker whose chain fetch fails is declared only in server logs and then shows up in the result as "0 cards" with no rejection or perTickerStats entry — indistinguishable from a genuinely empty chain; QUESTION FOR ALEX: should per-ticker fetch failures be surfaced on the result maps (rejections/perTickerStats) rather than logs only? |
| chain-fetcher.ts:185 | `const expDateStr = (expObj['expiration-date'] as string) \|\| '';` | LEGITIMATE | '' is immediately rejected (`if (!expDateStr ...) continue;` at 186) — rejection shape. |
| chain-fetcher.ts:197 | `strikes: (expObj['strikes'] as unknown[]) \|\| [],` | LEGITIMATE | Empty honestly means no strikes; such expirations produce no entries (strikes.length check at 235). |
| chain-fetcher.ts:215 | `const strikePrice = Number(sObj['strike-price'] \|\| 0);` | LEGITIMATE | Coerced 0 is rejected on the next line (`if (strikePrice <= 0) continue;`). |
| chain-fetcher.ts:218 | `const callOcc = (sObj['call'] as string) \|\| '';` | LEGITIMATE | '' feeds the symbol-derivation chain; a strike with neither streamer symbol is skipped (223). |
| chain-fetcher.ts:219 | `const putOcc = (sObj['put'] as string) \|\| '';` | LEGITIMATE | Same. |
| chain-fetcher.ts:220 | `const callStreamer = (sObj['call-streamer-symbol'] as string) \|\| occToDxFeed(callOcc) \|\| '';` | LEGITIMATE | Fallback DERIVES the streamer symbol from the present OCC symbol (deterministic format conversion, occToDxFeed 91-100); '' → skip at 223 — no fabrication. |
| chain-fetcher.ts:221 | `const putStreamer = (sObj['put-streamer-symbol'] as string) \|\| occToDxFeed(putOcc) \|\| '';` | LEGITIMATE | Same derivation from present data. |
| chain-fetcher.ts:264 | `const sym = (evtObj['eventSymbol'] as string) \|\| '';` | LEGITIMATE | '' → `continue` at 266; event without a symbol is dropped, not invented. |
| chain-fetcher.ts:265 | `const type = (evtObj['eventType'] as string) \|\| '';` | LEGITIMATE | Unknown/empty type matches no branch, so the event is ignored rather than misfiled. |
| chain-fetcher.ts:273 | `iv: Number(evtObj['volatility'] \|\| 0),` | LEGITIMATE | The coerced 0 acts as a missing-sentinel that every downstream consumer explicitly filters with `> 0` (chain-fetcher 473-474; strategy-builder 941 short-leg IV filter, 1078-1079 theo) — absence stays excluded, though the missing-vs-true-zero distinction is erased. |
| chain-fetcher.ts:274 | `delta: Number(evtObj['delta'] \|\| 0),` | VIOLATION | A Greeks event with a missing/null/NaN delta field is silently imputed as delta=0, which then passes every downstream `!= null` check (strategy-builder valid filter 718-721, findByDelta, makeLeg) and enters delta-approx PoP, EV, and persisted net greeks as if a real 0 had been observed. |
| chain-fetcher.ts:275 | `gamma: Number(evtObj['gamma'] \|\| 0),` | VIOLATION | Same silent 0-imputation at ingestion; flows to persisted netGamma. |
| chain-fetcher.ts:276 | `theta: Number(evtObj['theta'] \|\| 0),` | VIOLATION | Same; flows to thetaPerDay → compositeScore ranking and persisted netTheta. |
| chain-fetcher.ts:277 | `vega: Number(evtObj['vega'] \|\| 0),` | VIOLATION | Same; flows to persisted netVega. |
| chain-fetcher.ts:278 | `rho: Number(evtObj['rho'] \|\| 0),` | LEGITIMATE | rho is stored in greeksData but never consumed downstream (StrikeData/StrategyCard carry no rho) — cannot bias anything today; latent hazard if ever consumed. |
| chain-fetcher.ts:279 | `theoPrice: Number(evtObj['price'] \|\| 0),` | LEGITIMATE | Downstream keeps theo only when `> 0` (strategy-builder 1078-1079) and it is informational-only, never substituted into bid/ask. |
| chain-fetcher.ts:283 | `bid: Number(evtObj['bidPrice'] \|\| 0),` | LEGITIMATE | On the generator path EDGE-1 requires bid>0 AND ask>0, so a coerced 0 marks the leg dead (honest rejection); the custom-card exposure to these zeros is censused at strategy-builder 1205/1206. |
| chain-fetcher.ts:284 | `ask: Number(evtObj['askPrice'] \|\| 0),` | LEGITIMATE | Same. |
| chain-fetcher.ts:285 | `bidSize: Number(evtObj['bidSize'] \|\| 0),` | LEGITIMATE | bidSize is never consumed downstream. |
| chain-fetcher.ts:286 | `askSize: Number(evtObj['askSize'] \|\| 0),` | LEGITIMATE | Same. |
| chain-fetcher.ts:289 | `greeksData[sym].volume = Number(evtObj['dayVolume'] \|\| evtObj['volume'] \|\| 0);` | GRAY | dayVolume→volume is a present-data preference chain, but the final `\|\| 0` counts a missing Trade payload as 0 volume inside OptionsFlowData aggregates (509-521: put_call_ratio, volume_bias, unusual_activity_ratio); QUESTION FOR ALEX (one ruling also covers 291 and 475-478): should strikes with no Trade/Summary event be excluded from flow aggregates rather than counted as zero? |
| chain-fetcher.ts:291 | `greeksData[sym].openInterest = Number(evtObj['openInterest'] \|\| 0);` | GRAY | Same ruling: missing OI imputed as 0 enters unusual_activity_ratio and high-activity detection (497). |
| chain-fetcher.ts:344 | `let winningExp = expirations[0];` | LEGITIMATE | Initialization that is either overwritten by a real winner (386) or handled by the declared stats fallback (399-418); affects diagnostic stats only, never a card. |
| chain-fetcher.ts:372 | `const topScore = result.strategies[0]?.compositeScore ?? null;` | LEGITIMATE | Null normalization — no passing strategy honestly yields null bestScore. |
| chain-fetcher.ts:392 | `sourceCounts[s.priceSource] = (sourceCounts[s.priceSource] \|\| 0) + 1;` | LEGITIMATE | Counter-initialization idiom over present data. |
| chain-fetcher.ts:395 | `.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none') as StrikeData['priceSource'];` | LEGITIMATE | Empty tally honestly reported as 'none' in the audit-trail field. |
| chain-fetcher.ts:399-418 | `// Fallback: if no strategies passed any gate, populate winner fields from first real expiration` (block 400-418) | LEGITIMATE | Declared (commented) fallback that fills perTickerStats diagnostic fields (winningExp/strikeCount/priceSource) when nothing passed; it fabricates no card, price, or score — `cards` stays empty for the ticker. |
| chain-fetcher.ts:403 | `winningExp = expirations.find(e => e.expiration === firstReal.expiration) ?? expirations[0];` | LEGITIMATE | Within the stats fallback; reporting default only. |
| chain-fetcher.ts:412 | `counts[s.priceSource] = (counts[s.priceSource] \|\| 0) + 1;` | LEGITIMATE | Counter idiom. |
| chain-fetcher.ts:415 | `.sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none') as StrikeData['priceSource'];` | LEGITIMATE | Same 'none' reporting. |
| chain-fetcher.ts:437 | `winner: bestStrategies[0]?.name ?? null,` | LEGITIMATE | Null normalization for stats. |
| chain-fetcher.ts:438 | `winnerScore: bestStrategies[0]?.compositeScore ?? null,` | LEGITIMATE | Same. |
| chain-fetcher.ts:470 | `const callData = greeksData[s.callStreamerSymbol] \|\| {};` | LEGITIMATE | Honest empty container for missing symbols; IV is `> 0`-guarded at 473, volume/OI zeros are censused at 475-478 (GRAY). |
| chain-fetcher.ts:471 | `const putData = greeksData[s.putStreamerSymbol] \|\| {};` | LEGITIMATE | Same. |
| chain-fetcher.ts:473 | `const callIV = callData.iv != null && Number(callData.iv) > 0 ? Number(callData.iv) : null;` | LEGITIMATE | Sentinel zeros normalized to null — declared absence. |
| chain-fetcher.ts:474 | `const putIV = putData.iv != null && Number(putData.iv) > 0 ? Number(putData.iv) : null;` | LEGITIMATE | Same. |
| chain-fetcher.ts:475 | `const callVolume = Number(callData.volume \|\| 0);` | GRAY | Missing volume counted as 0 in flow totals/ratios — same ruling as 289. |
| chain-fetcher.ts:476 | `const putVolume = Number(putData.volume \|\| 0);` | GRAY | Same ruling. |
| chain-fetcher.ts:477 | `const callOI = Number(callData.openInterest \|\| 0);` | GRAY | Same ruling. |
| chain-fetcher.ts:478 | `const putOI = Number(putData.openInterest \|\| 0);` | GRAY | Same ruling. |
| chain-fetcher.ts:513 | `put_call_ratio: totalCallVolume > 0 ? totalPutVolume / totalCallVolume : null,` | LEGITIMATE | Zero denominator honestly yields null. |
| chain-fetcher.ts:514 | `volume_bias: totalVolume > 0 ? (totalCallVolume - totalPutVolume) / totalVolume : null,` | LEGITIMATE | Same. |
| chain-fetcher.ts:515 | `unusual_activity_ratio: totalOI > 0 ? totalVolume / totalOI : null,` | LEGITIMATE | Same. |

### Catch blocks

| file:line | what the catch does (verbatim key line) | category | note |
|---|---|---|---|
| chain-fetcher.ts:446 | `console.error(`[ChainFetcher] ${ticker.symbol}: Strategy generation failed:`, msg); cards.set(ticker.symbol, []);` | (c) SWALLOW (with console.error logging) | Loud in server logs, but the returned surface carries no failure marker — the ticker gets an empty cards array and NO rejections/perTickerStats entry, indistinguishable from "no strategies passed"; loop continues to next ticker. |
| chain-fetcher.ts:531 | `console.error('[ChainFetcher] Fatal error:', msg);` then `return { cards, rejections, stats, ... }` (comment 534: "Return empty map — pipeline continues without trade cards") | (c) SWALLOW (with console.error logging) | Fatal errors (auth failure, streamer failure, etc.) are converted into a success-shaped empty result; the caller cannot distinguish a broken fetch from a genuinely empty day except via logs — by-design per the comment, but it is a result-surface swallow. |

### Self-check
- grep A: 5 lines, B: 28, C: 0, D: 2, E: 2; unique A–D lines rowed: 35/35 (no overlaps; D line 399 rowed as the 399-418 fallback block). F rows added: 10 (166-169, 344, 403, 470, 471, 473, 474, 513, 514, 515). Both E hits rowed in the catch table. Excluded: nothing.

---

## src/lib/convergence/trade-cards.ts

### Pattern hits

| file:line | verbatim code | class | justification |
|---|---|---|---|
| trade-cards.ts:38 | `const ivp = input.ttScanner?.ivPercentile ?? null;` | LEGITIMATE | Null normalization; null skips the display signal (41). |
| trade-cards.ts:39 | `const ivRank = input.ttScanner?.ivRank ?? null;` | LEGITIMATE | Same (variable unused beyond declaration). |
| trade-cards.ts:42 | `const pct = ivp <= 1 ? Math.round(ivp * 100) : Math.round(ivp);` | LEGITIMATE | Unit-normalization heuristic (fraction vs percent) for a plain-English display string only; ambiguous only at ivp exactly 1, and it cannot touch any score, price, or stored numeric. |
| trade-cards.ts:52 | `const ivHvSpread = input.ttScanner?.ivHvSpread ?? null;` | LEGITIMATE | Null normalization (unused beyond declaration). |
| trade-cards.ts:53 | `const iv30 = input.ttScanner?.iv30 ?? null;` | LEGITIMATE | Null skips the ratio signal (55). |
| trade-cards.ts:54 | `const hv30 = input.ttScanner?.hv30 ?? null;` | LEGITIMATE | Same. |
| trade-cards.ts:60 | `signals.push(`Unusual: the market underestimates this stock's actual movement. ...`);` | LEGITIMATE | Keyword hit ("underestimates") inside display copy computed from present iv30/hv30. |
| trade-cards.ts:81 | `const dte_to_earnings = input.ttScanner?.daysTillEarnings ?? null;` | LEGITIMATE | Null skips the earnings signal (82). |
| trade-cards.ts:112 | `const beats = emTrace?.momentum_detail.consecutive_beats ?? 0;` | LEGITIMATE | Display-only signal gate (`beats >= 3`); missing trace emits no signal and stores nothing. |
| trade-cards.ts:135 | `const sentMom = newsTrace.news_detail.sentiment_momentum ?? 0;` | LEGITIMATE | 0 falls between the ±30 display thresholds, so absence emits neither signal; display-only. |
| trade-cards.ts:175 | `const dte_to_earnings = input.ttScanner?.daysTillEarnings ?? null;` | LEGITIMATE | Null skips the risk flag (176). |
| trade-cards.ts:180 | `const liq = input.ttScanner?.liquidityRating ?? null;` | LEGITIMATE | Null skips the flag (181). |
| trade-cards.ts:200 | `const borrowRate = input.ttScanner?.borrowRate ?? null;` | LEGITIMATE | Null skips the flag (201). |
| trade-cards.ts:207 | `const avgMspr3m = insiderTrace?.insider_detail.avg_mspr_3m ?? null;` | LEGITIMATE | Null skips the flag (208); excluded-signal contract documented at 205. |
| trade-cards.ts:220 | `const prob = r.regime_scores[dom as keyof typeof r.regime_scores] ?? 0;` | LEGITIMATE | Feeds a regime-context display string only ("(0% score)"), defensive against an unknown dominant-regime key. |
| trade-cards.ts:317 | `hv90: ttHv90 ?? null,` | LEGITIMATE | Insufficient-candles branch declares itself via `note: 'Insufficient candle data'` (321) and keeps nulls. |
| trade-cards.ts:319 | `candles_used: candles?.length ?? 0,` | LEGITIMATE | Honest count of candles actually present. |
| trade-cards.ts:330 | `hv60: ttHv60 ?? computeHV(60),` | LEGITIMATE | Fallback between two REAL sources — TastyTrade metric else HV computed from present candles via the declared shared formula (computeCloseToCloseHV), else null; nothing invented. |
| trade-cards.ts:331 | `hv90: ttHv90 ?? computeHV(90),` | LEGITIMATE | Same. |
| trade-cards.ts:332 | `current_iv: currentIv != null ? Math.round(currentIv * 10) / 10 : null,` | LEGITIMATE | Null stays null. |
| trade-cards.ts:353 | `const totalQuarters = eq?.earnings_detail?.total_quarters ?? 0;` | LEGITIMATE | 0 triggers `if (totalQuarters < 2) return null;` (355) — rejection shape. |
| trade-cards.ts:363 | `avg_surprise_pct: eq?.earnings_detail?.avg_surprise_pct ?? null,` | LEGITIMATE | Null normalization. |
| trade-cards.ts:365 | `consecutive_beats: em?.momentum_detail?.consecutive_beats ?? 0,` | GRAY | When the earnings-momentum trace is absent (quality trace alone satisfies the 351 gate) the persisted EarningsPattern asserts "0 consecutive beats" as fact instead of unknown; QUESTION FOR ALEX: should consecutive_beats/misses be null (unknown) when the em trace is excluded? |
| trade-cards.ts:366 | `consecutive_misses: em?.momentum_detail?.consecutive_misses ?? 0,` | GRAY | Same ruling. |
| trade-cards.ts:367 | `streak: eq?.earnings_detail?.streak ?? '',` | LEGITIMATE | Empty string renders as no streak text; display field. |
| trade-cards.ts:368 | `sue_score: eq?.earnings_quality_ensemble?.sue_score ?? null,` | LEGITIMATE | Null normalization. |
| trade-cards.ts:369 | `direction: em?.momentum_detail?.direction ?? null,` | LEGITIMATE | Null normalization. |
| trade-cards.ts:385-388 | `current_price: input.optionsFlow?.underlyingPrice ?? (input.candles?.length > 0 ? input.candles[...].close : null),` | LEGITIMATE | Preference chain between two real present-data sources (streamer underlying price, else last candle close), else null — note the candle close can be staler than a live quote, but no value is fabricated. |
| trade-cards.ts:389 | `iv_rank: tt?.ivRank ?? null,` | LEGITIMATE | Null normalization in key_stats. |
| trade-cards.ts:390 | `iv_percentile: tt?.ivPercentile ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:391 | `iv30: tt?.iv30 ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:392 | `hv30: tt?.hv30 ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:393 | `iv_hv_spread: tt?.ivHvSpread ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:394 | `vol_cone: computeVolCone(input.candles, tt?.iv30 ?? null, tt?.hv60 ?? null, tt?.hv90 ?? null),` | LEGITIMATE | Passes declared nulls into computeVolCone, which keeps them null or computes from present candles. |
| trade-cards.ts:395 | `forward_vol: computeForwardVol(input.ttScanner?.termStructure ?? []),` | LEGITIMATE | Empty array → computeForwardVol returns null via its `length < 2` guard (255) — honest none. |
| trade-cards.ts:396 | `earnings_date: tt?.earningsDate ?? null,` | LEGITIMATE | Null normalization. |
| trade-cards.ts:397 | `days_to_earnings: tt?.daysTillEarnings ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:399 | `market_cap: tt?.marketCap ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:400 | `sector: tt?.sector ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:401 | `beta: tt?.beta ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:402 | `spy_correlation: tt?.corrSpy ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:403 | `pe_ratio: tt?.peRatio ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:404 | `dividend_yield: tt?.dividendYield ?? null,` | LEGITIMATE | Same — note dividendYield exists here but never reaches the d2 math (see probability.ts:56 VIOLATION). |
| trade-cards.ts:405 | `liquidity_rating: tt?.liquidityRating ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:406 | `lendability: tt?.lendability ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:407 | `borrow_rate: tt?.borrowRate ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:408 | `buzz_ratio: news?.buzz_ratio ?? null,` | LEGITIMATE | Same. |
| trade-cards.ts:409 | `sentiment_momentum: news?.sentiment_momentum ?? null,` | LEGITIMATE | Same. |

### Catch blocks

| file:line | what the catch does | category | note |
|---|---|---|---|
| — | no `catch` in this file (grep E: 0 hits) | — | — |

### Self-check
- grep A: 42 lines, B: 0, C: 0, D: 1, E: 0; unique A–D lines rowed: 43/43 (line 60 D-only; line 394 has two A-pattern matches on one line — one row). F rows added: 5 (42, 330, 331, 332, 385-388). Excluded: letterGrade thresholds (20-28) and signal thresholds — score-to-text mappings on present data, not defaults.

---

## Totals

- VIOLATION: 16 — strategy-builder.ts: 426, 427, 428, 429, 833, 848, 1206, 1214, 1215, 1216, 1217; chain-fetcher.ts: 274, 275, 276, 277; probability.ts: 56.
- GRAY: 12 — strategy-builder.ts: 851, 1205, 1208; chain-fetcher.ts: 166-169, 289, 291, 475, 476, 477, 478; trade-cards.ts: 365, 366.
- Catch blocks: 2 (both chain-fetcher.ts: 446, 531) — both log via console.error but swallow on the returned result surface.

# Fallback census — small convergence files (branch main @ c12e48f7)

Read-only inventory. One row per unique file:line hit from greps A–E plus manual pass F.
Cross-file guard traces cited inline (vol-edge.ts / info-edge.ts / pipeline.ts read for consumer verification only — not assigned files).

Note on the task pointer: `percentileRank` does NOT live in sector-stats.ts — it lives in `src/lib/convergence/vol-edge.ts:127-128` (`if (sortedValues.length === 0) return 50;`), outside this census's assigned set. Its in-scope inputs (`sortedValues` produced by sector-stats.ts) are traced below; the vol-edge call sites all guard with `?.length` / `length >= 5` before calling it (vol-edge.ts:324, 331, 334, 526), so sector-stats' empty `sortedValues: []` cannot trigger the 50. The 50-on-empty literal itself must be rowed by whoever owns vol-edge.ts.

---

## src/lib/convergence/sector-stats.ts

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| sector-stats.ts:46 | `function round(v: number, decimals = 2): number {` | LEGITIMATE | Default parameter for rounding precision only; operates on present data, no value fabricated. |
| sector-stats.ts:52 | `if (arr.length === 0) return 0;` (in `mean()`) | LEGITIMATE | 0-on-empty flows only into PeerMetricStats.mean paired with std=0; every score consumer guards std first — sector-stats.ts:556 `if (std < 0.001) return null`, vol-edge.ts:140 same guard, vol-edge.ts:530 `std > 0.001` — so mean never reaches a z-score/score when computed from an empty array; the only mean-without-std consumer (info-edge.ts:240) reads key `price_target_implied_return` which sector-stats never emits (no producer anywhere in src). |
| sector-stats.ts:57 | `if (arr.length < 2) return 0;` (in `stddev()`) | LEGITIMATE | std=0 is a poison-pill, not an imputation: every downstream z-score divides by std behind a `< 0.001 → null` guard (sector-stats.ts:556, vol-edge.ts:140, vol-edge.ts:530), so n<2 yields null z (excluded), never a fabricated score. |
| sector-stats.ts:87 | `const empty: PeerMetricStats = { mean: 0, std: 0, sortedValues: [] };` | LEGITIMATE | Empty-peer stats are declared (`insufficient_peers: true` at :107) and inert: std=0 nulls all z-scores (guards cited at rows :52/:57); `sortedValues: []` never reaches percentileRank because all call sites guard length (vol-edge.ts:324 `rawIvpSorted?.length`, :331 `ivHvSorted?.length`, :334 `hv30Sorted?.length`, :526 `slopeSorted.length >= 5 && tsPeerCount >= 5`); flag is surfaced to UI (ConvergenceIntelligence.tsx:2396) and synthesis (convergence-synthesis/route.ts:248). |
| sector-stats.ts:155 | `freq.set(w, (freq.get(w) ?? 0) + 1);` | LEGITIMATE | Standard frequency-counter initialization computed from present tokens; not a data default. |
| sector-stats.ts:158 | `const len = words.length \|\| 1;` | LEGITIMATE | Divide-by-zero guard; unreachable in practice (sole caller at :265 requires `words.length >= 20` via :263), and with len forced to 1 the freq map is empty anyway — nothing to bias. |
| sector-stats.ts:168 | `if (docCount === 0) return new Map();` | LEGITIMATE | Empty IDF map when there are zero documents honestly means "no corpus"; callers then produce no peer groups (guard at :269 `symbols.length < 2 return {}`). |
| sector-stats.ts:174 | `docFreq.set(word, (docFreq.get(word) ?? 0) + 1);` | LEGITIMATE | Counter initialization from present document words; not a fallback. |
| sector-stats.ts:190 | `const idfVal = idf.get(word) ?? 0;` | LEGITIMATE | Unreachable default (every TF word appears in docFreq since IDF is computed over the same documents); even if hit, tfidf=0 is dropped by the `if (tfidf > 0)` filter at :192 — excluded, not imputed. |
| sector-stats.ts:217 | `if (denominator === 0) return 0;` | LEGITIMATE | Cosine similarity of a zero vector is honestly 0 (no shared terms → no similarity); a 0 can only fail the `>= 0.40` threshold at :305, i.e. exclusion. |
| sector-stats.ts:254 | `if (profiles.length < 2) return {};` | LEGITIMATE | Empty map honestly means "no text peer groups"; downstream tiers fall through to declared industry/sector grouping. |
| sector-stats.ts:269 | `if (symbols.length < 2) return {};` | LEGITIMATE | Same as :254 — empty result when fewer than 2 usable documents; declared none. |
| sector-stats.ts:320 | `let textPeerGroupName = 'text_peers';` | LEGITIMATE | Display label default, overwritten when shared keywords exist (:336-338); group NAME only, never enters scoring. |
| sector-stats.ts:329 | `allShared.set(kw, (allShared.get(kw) ?? 0) + 1);` | LEGITIMATE | Counter initialization for keyword-label generation; label/display only. |
| sector-stats.ts:13 | `peer_group_type: 'industry' \| 'sector_fallback' \| 'unknown' \| 'text_nlp' \| 'finnhub_peers' \| 'mixed';` | LEGITIMATE | Type union declaring the fallback tier as an explicit, traceable label — the opposite of a silent fallback. |
| sector-stats.ts:367 | `*   3. GICS industry (min 5 peers) — standard fallback` | LEGITIMATE | Pure doc comment declaring the 4-tier peer-group degradation; documentation of design. |
| sector-stats.ts:368 | `*   4. GICS sector — broadest fallback` | LEGITIMATE | Pure doc comment; same 4-tier declaration. |
| sector-stats.ts:384 | `// Step 2: Group by sector (for fallback)` | LEGITIMATE | Pure comment labeling the sector grouping step. |
| sector-stats.ts:393 | `const industry = item.industry \|\| null;` | LEGITIMATE | `\|\| null` normalization of empty-string/undefined industry to declared null; missing industry routes to a LOWER tier (sector), never fabricates one. |
| sector-stats.ts:394 | `const sector = item.sector \|\| null;` | LEGITIMATE | Same null normalization; missing sector routes to the declared `sector:UNKNOWN` group (:532), logged as fallback. |
| sector-stats.ts:399 | `// Always add to sector group (used for fallback)` | LEGITIMATE | Pure comment. |
| sector-stats.ts:400 | `const sectorKey = sector \|\| 'UNKNOWN';` | LEGITIMATE | Missing sector grouped under the explicit 'UNKNOWN' key — a declared bucket carried into `peer_group_name`, visible in trace/UI; not a hidden substitute group. |
| sector-stats.ts:414 | `const industryFallbacks: string[] = [];` | LEGITIMATE | Bookkeeping array whose whole purpose is to DECLARE which tickers used the sector fallback (logged at :547-548). |
| sector-stats.ts:436 | `const avgSim = simScores.length > 0 ? round(...) / simScores.length, 4) : 0;` | LEGITIMATE | Ternary literal 0 on the false branch feeds only `text_peer_trace.avg_similarity` (trace/display, :443-448), never a score; branch is also effectively unreachable since :420 requires `textPeers.length >= MIN_TEXT_PEERS` and similarityScores is built from the same peer list (:314-317). |
| sector-stats.ts:459 | `const universe = fullUniverse ?? scannerBySymbol;` | LEGITIMATE | Fallback between two REAL datasets (full scanner universe vs survivor set) for peer resolution; documented in the function docblock (:373-374); no absent data is fabricated. |
| sector-stats.ts:466 | `const selfData = universe.get(symbol) ?? scannerBySymbol.get(symbol);` | LEGITIMATE | Two-source lookup of present data; if both miss, the symbol is simply not added (exclusion), and groups under 3 members are skipped at :474. |
| sector-stats.ts:470 | `const peerData = universe.get(peerSym) ?? scannerBySymbol.get(peerSym);` | LEGITIMATE | Same two-real-source lookup; unresolvable peers are excluded, not invented. |
| sector-stats.ts:492 | `// Step 6: Build sector-level stats (used as broadest fallback)` | LEGITIMATE | Pure comment. |
| sector-stats.ts:495 | `result[key] = buildPeerStats(tickers, 'sector_fallback', sector);` | LEGITIMATE | Builds the tier-4 group with an explicit `'sector_fallback'` type label; sectors with <3 tickers get the declared `insufficient_peers` empty stats (see :87 row for the downstream guard trace). |
| sector-stats.ts:530 | `industryFallbacks.push(symbol);` | LEGITIMATE | Records (for loud logging at :548) that the ticker fell to tier 4; declaration mechanism itself. |
| sector-stats.ts:532 | `assignment[symbol] = \`sector:UNKNOWN\`;` | LEGITIMATE | No-industry/no-sector tickers assigned to the explicit UNKNOWN group; note tier-3/4 assignment (:524-534) does NOT check `insufficient_peers` (unlike tiers 1-2 at :508/:517), so a ticker CAN be assigned to an empty-stat group — but the empty stats are inert downstream (std<0.001→null z at vol-edge.ts:140, `?.length` guards before percentileRank at vol-edge.ts:324/331/334/526) and the flag is surfaced (pipeline.ts:589, ConvergenceIntelligence.tsx:2396). |
| sector-stats.ts:533 | `industryFallbacks.push(symbol);` | LEGITIMATE | Same declaration bookkeeping as :530. |
| sector-stats.ts:547 | `if (industryFallbacks.length > 0) {` | LEGITIMATE | Guard around the loud console declaration of fallback usage. |
| sector-stats.ts:548 | `console.log(\`[PeerStats] ${industryFallbacks.length} tickers using sector-level fallback: ...\`)` | LEGITIMATE | Log-only line that DECLARES the fallback population — the required loud behavior. |
| sector-stats.ts:556 | `if (std < 0.001) return null;` (in `computeZScore`) | LEGITIMATE | The guard itself: degenerate/empty peer std yields null (excluded, re-normalized upstream), never a fabricated z-score. |

### Catch blocks

None (grep E: 0 hits).

### Self-check
- grep A: 4 lines, B: 1, C: 0, D: 12, E: 0; F additions: 18; unique lines rowed: 35. No grep hit excluded.

---

## src/lib/convergence/pre-filter.ts

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| pre-filter.ts:33 | `const ivRank = t.ivRank > 0 ? t.ivRank : null;` | LEGITIMATE | Ternary null (not a literal value) on the false branch: 0/negative ivRank is treated as missing and DECLARED null, which forces preScore=0 per the documented rule (:26 "If any required input ... is null → preScore = 0") — conservative exclusion, not imputation (a true ivRank of exactly 0 is discarded, biasing DOWN, never up). |
| pre-filter.ts:34 | `const ivPercentile = t.ivPercentile > 0 ? t.ivPercentile : null;` | LEGITIMATE | Same declared 0-means-missing normalization; ivPercentile is pass-through metadata here and not a preScore input (:39 uses ivRank/ivHvSpread/liquidityRating only). |
| pre-filter.ts:38 | `let preScore = 0;` | LEGITIMATE | The 0 floor for missing inputs is explicitly declared in the docblock (:26) and inline comment (:37 "All three components required — null inputs score 0"); missing data ranks the ticker LAST (worst, not neutral), matching the exclude-don't-impute mandate. Note: :27 says "Step B ranks only — it does not eliminate," but pipeline.ts:516-525 slices top-N by preScore, so the floor does affect which tickers get expensive fetches — that effect is the declared design (deprioritize unmeasurable tickers), direction is conservative. |
| pre-filter.ts:53 | `liquidityValue: liquidityRating, // TT returns rating directly as the value` | LEGITIMATE | Documented field aliasing of present data (TastyTrade supplies the rating as the value); no absent data substituted. |
| pre-filter.ts:58 | `ivHvSpread: t.ivHvSpread ?? null,` | LEGITIMATE | `?? null` normalization for the result record; missing spread stays declared-null and independently forces preScore=0 via :39. |

### Catch blocks

None (grep E: 0 hits).

### Self-check
- grep A: 1 line, B: 0, C: 0, D: 0, E: 0; F additions: 4; unique lines rowed: 5. No grep hit excluded.

---

## src/lib/convergence/filter-engine.ts

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| filter-engine.ts:7 | `*   We use has_wide_spread as a proxy for bad liquidity at the strike level.` | LEGITIMATE | Pure header comment declaring the proxy (see :147 row for the behavior). |
| filter-engine.ts:9 | `* - Bid-ask spread: has_wide_spread boolean is the closest proxy on the client.` | LEGITIMATE | Pure header comment. |
| filter-engine.ts:16 | `import { isCreditStrategy, DEFAULT_FILTERS } from './filter-types';` | LEGITIMATE | Import line; keyword-only hit. |
| filter-engine.ts:85 | `const cards = result.trade_cards ?? [];` | LEGITIMATE | `?? []` where empty honestly means "no strategy cards"; the very next line branches on it explicitly with a declaring comment (:87 "No strategies — pass through as-is"). No score or value fabricated. |
| filter-engine.ts:86 | `if (cards.length === 0) { ... passed.push(result); continue; }` | LEGITIMATE | Declared pass-through for cardless tickers; display-side only (nothing tradeable exists to filter). Note the `continue` also bypasses the ticker-level sentiment filter (:93-105) for cardless tickers — cosmetic, since there are no cards to act on. |
| filter-engine.ts:95 | `if (s && !s.error && s.postCount > 0) {` | GRAY | Missing/errored/zero-post sentiment data silently SKIPS the user-set minSentiment filter (pass-open) with no reason recorded — needs a product ruling from Alex: when sentiment data is absent for a ticker, should a user-set sentiment filter fail-closed (reject), pass-open (current), or pass with a declared "sentiment unavailable" annotation in the UI? |
| filter-engine.ts:145 | `// OI: not available per-strike on client. Use has_wide_spread as proxy.` | GRAY | Comment declaring that `minOpenInterest` (and per :151-152 `minUnderlyingVolume`) are NEVER enforced by filterCard, yet describeActiveFilters (:263-270) still renders "Min OI ≥ N" / "Min Vol ≥ N" as active filters when the user changes them — UI shows a filter that does not fire. Needs Alex's ruling: disable/hide those two controls, or annotate them as proxy-/server-enforced-only? |
| filter-engine.ts:147 | `if (s.has_wide_spread && filters.liquidity.maxBidAskSpreadPct < 10) {` | LEGITIMATE | The declared proxy in action: a boolean computed from present card data gates rejection, with the header comment (:5-9) and inline comment (:145-146) declaring the substitution; it can only REJECT cards (conservative), never fabricate a passing value. |
| filter-engine.ts:155 | `if (ks.liquidity_rating != null && ks.liquidity_rating < filters.liquidity.minLiquidityRating) {` | GRAY | Null liquidity_rating silently passes the min-liquidity filter (pass-open, undeclared) — same product ruling as :95: fail-closed vs pass-open vs pass-with-declaration for missing metrics under a user-set filter. |
| filter-engine.ts:216 | `if (s.probability_of_profit != null) {` | GRAY | Card with null PoP silently survives a user-set minPop filter (pass-open, no reason recorded) — same ruling needed as :95/:155. |
| filter-engine.ts:235 | `if (filters.edge.volEdge !== 'ANY' && ks.iv30 != null && ks.hv30 != null && ks.hv30 > 0) {` | GRAY | Missing iv30/hv30 silently skips the user-set IV-vs-HV directional filter (pass-open) — same ruling needed as :95. |
| filter-engine.ts:246 | `if (filters.edge.minIvRank > 0 && ks.iv_rank != null) {` | GRAY | Null iv_rank silently passes a user-set min-IV-rank filter (pass-open) — same ruling needed as :95. |
| filter-engine.ts:248 | `const ivRankPct = ks.iv_rank <= 1 ? ks.iv_rank * 100 : ks.iv_rank;` | LEGITIMATE | Scale-normalization ternary over PRESENT data (0-1 vs 0-100 source scales), declared by the comment at :247; ambiguity only at exactly 1.0, and misreading 1% as 100% can only make the filter more lenient on that single edge value of a display-side filter, not a score. |
| filter-engine.ts:260 | `const d = DEFAULT_FILTERS as ScannerFilters;` | LEGITIMATE | Reads declared defaults purely as the comparison baseline for the human-readable active-filter summary (display-only). |

### Catch blocks

None (grep E: 0 hits).

### Self-check
- grep A: 1 line, B: 0, C: 0, D: 5, E: 0; F additions: 8; unique lines rowed: 14. No grep hit excluded.

---

## src/lib/convergence/filter-types.ts

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| filter-types.ts:9 | `minOpenInterest: number;      // per strike, default 100` | LEGITIMATE | Pure comment documenting a user-facing filter default (declared in DEFAULT_FILTERS). |
| filter-types.ts:10 | `maxBidAskSpreadPct: number;   // % of mid price, default 10` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:11 | `minUnderlyingVolume: number;  // daily shares, default 500000` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:12 | `minLiquidityRating: number;   // TastyTrade 1-5 stars, default 2` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:17 | `export type Direction = 'ALL' \| 'BULLISH' \| 'BEARISH' \| 'NEUTRAL';` | LEGITIMATE | Type union; 'NEUTRAL' is a market-direction enum value, not a neutral-score imputation. |
| filter-types.ts:25 | `strategies: string[];         // empty = all strategies allowed` | LEGITIMATE | Empty-means-all semantic is DECLARED in the comment and enforced consistently (filter-engine.ts:186 guards `strategies.length > 0`); empty honestly means "no strategy restriction". |
| filter-types.ts:26 | `minDte: number;               // default 30` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:27 | `maxDte: number;               // default 60` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:28 | `minSpreadWidth: number;       // dollars, default 1` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:29 | `maxSpreadWidth: number;       // dollars, default 10` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:37 | `minPop: number;               // 0-100, default 50` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:38 | `minEv: number;                // dollars, default 0` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:39 | `minEvPerRisk: number;         // ratio, default 0` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:41 | `minIvRank: number;            // 0-100, default 0` | LEGITIMATE | Pure comment documenting a declared UI default. |
| filter-types.ts:42 | `minSentiment: number;         // -100 to 100 (display as -1.0 to 1.0), default -100` | LEGITIMATE | Pure comment; default -100 means the sentiment filter is OFF by default (filter-engine.ts:93 only activates when > -100). |
| filter-types.ts:53 | `export const DEFAULT_FILTERS: ScannerFilters = {` (values :54-78) | LEGITIMATE | Named, exported, user-visible default filter configuration — starting UI state, not imputation of missing data; also the baseline describeActiveFilters diffs against. |

### Catch blocks

None (grep E: 0 hits).

### Self-check
- grep A: 0 lines, B: 0, C: 0, D: 15, E: 0; F additions: 1 (:25); unique lines rowed: 16. DEFAULT_FILTERS body lines :54-78 are covered by the :53 row (single declaration). No grep hit excluded.

---

## src/lib/convergence/snapshot-logger.ts

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| snapshot-logger.ts:33 | `spotPrice: input.spotPrice ?? null,` | LEGITIMATE | `?? null` persistence normalization: absent input stored as declared null in scan_snapshots, never a substituted price. |
| snapshot-logger.ts:34 | `iv30: input.iv30 ?? null,` | LEGITIMATE | Same declared-null persistence; downstream VRP history (:100-101) explicitly filters `not: null`, so nulls are excluded, not counted as zeros. |
| snapshot-logger.ts:35 | `hv30: input.hv30 ?? null,` | LEGITIMATE | Same declared-null persistence with `not: null` exclusion downstream (:101). |
| snapshot-logger.ts:36 | `ivPercentile: input.ivPercentile ?? null,` | LEGITIMATE | Same declared-null persistence. |
| snapshot-logger.ts:52 | `imputedCount: composite.data_confidence.imputed_sub_scores,` | LEGITIMATE | Stores the COUNT of imputed sub-scores as declared metadata — the transparency mechanism itself, not an imputation. |
| snapshot-logger.ts:55 | `regimeLabel: regime.breakdown.dominant_regime ?? null,` | LEGITIMATE | Declared-null persistence of an optional label. |
| snapshot-logger.ts:56 | `vixLevel: input.vixLevel ?? regime.breakdown.vix_overlay.vix ?? null,` | LEGITIMATE | Chained fallback between two REAL observations of the same quantity (caller-supplied VIX, else the VIX already embedded in the regime result), terminating in declared null — no fabricated level. |
| snapshot-logger.ts:59 | `suggestedStrategy: strategy.suggested_strategy ?? null,` | LEGITIMATE | Declared-null persistence of an optional suggestion. |
| snapshot-logger.ts:60 | `suggestedDTE: strategy.suggested_dte ?? null,` | LEGITIMATE | Declared-null persistence; a null here makes the row permanently unclosable in outcome-tracker, which DECLARES it every run (outcome-tracker.ts:129-131), never invents a horizon. |
| snapshot-logger.ts:75 | `// renormalized). No proxy distribution, no default std, ever.` | LEGITIMATE | Pure comment declaring the EDGE-4 no-fallback contract for VRP history. |
| snapshot-logger.ts:110 | `if (row.iv30 == null \|\| row.hv30 == null) continue;` | LEGITIMATE | Defensive exclusion of null observations (already excluded by the query at :100-101); missing observations are skipped, never imputed. |
| snapshot-logger.ts:122 | `if (byDay.size < VRP_HISTORY_MIN_DISTINCT_DAYS) continue;` | LEGITIMATE | Tickers under the declared 20-distinct-day minimum are OMITTED from the map entirely (documented :73-75, :81-82) — exclusion-and-renormalize, the mandated honest shape. |

### Catch blocks

| file:line | what the catch does (verbatim key line) | category | note |
|---|---|---|---|
| snapshot-logger.ts:66 | `console.error(\`[ScanSnapshot] Failed to log snapshot for ${input.ticker}:\`, error);` | (b) declare loudly | Does not rethrow, by documented design: ":18 Fire-and-forget — errors are logged but never propagate" and ":67 Snapshot logging is observational — never fail the scan". Failure affects only the observational snapshot table, never a score/price/size returned to the user; the error is printed with ticker context. Matches the census context ruling (documented as observational). Contrast: fetchVrpHistoryBatch deliberately has NO catch (:84-85 "DB errors propagate"), preserving fail-loud where data feeds scoring. |

### Self-check
- grep A: 8 lines, B: 0, C: 0, D: 2, E: 1; F additions: 2 (:110, :122); unique lines rowed: 12 pattern + 1 catch. No grep hit excluded.

---

## src/lib/convergence/outcome-tracker.ts

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| outcome-tracker.ts:32 | `outcomePnl: outcome.pnl ?? null,` | LEGITIMATE | Declared-null persistence — outcomePnl is an EDGE-5 DECLARED_NULL_FIELD (:78-79, "no integrated historical option-price source"), stored null with the reason recorded in outcome_meta (:242); the honest shape per census context. |
| outcome-tracker.ts:33 | `outcomeSpotPrice: outcome.spotPrice ?? null,` | LEGITIMATE | Declared-null persistence; when set, the value is an actual TT daily close (:228) with source labeled (:235). |
| outcome-tracker.ts:34 | `outcomeIV: outcome.iv ?? null,` | LEGITIMATE | Declared-null persistence; null carries a per-row `iv_null_reason` (:212-218, :241) — never backfilled or estimated (:72). |
| outcome-tracker.ts:35 | `ivCompressed: outcome.ivCompressed ?? null,` | LEGITIMATE | Declared-null persistence; only computed when BOTH real observations exist (:222-223). |
| outcome-tracker.ts:36 | `stayedInRange: outcome.stayedInRange ?? null,` | LEGITIMATE | Declared-null persistence — a DECLARED_NULL_FIELD (:80, "deriving one post-hoc would be improvised math"). |
| outcome-tracker.ts:47 | `? (row.fullTrace as Record<string, unknown>) : {};` | GRAY | If a row's stored fullTrace is ever a non-object JSON value (array/scalar), the merge at :48 silently REPLACES it with `{ outcome_meta }`, discarding the prior content with no declaration; unreachable via this codebase (snapshot-logger.ts:63 always writes an object, and a missing row makes :51 update throw loudly), but it is a silent rewrite of persisted trace data on malformed shape — Alex must rule: refuse-and-declare (add to unclosable) vs replace (current) when fullTrace is malformed. |
| outcome-tracker.ts:72 | `// null and the reason is declared. Never backfilled, never estimated.` | LEGITIMATE | Pure comment declaring the IV-window contract. |
| outcome-tracker.ts:79 | `'outcomePnl: no integrated historical option-price source — cannot compute realized P&L without estimating',` | LEGITIMATE | Declaration string itself (DECLARED_NULL_FIELDS) — recorded on every closed row (:242) and in the run summary (:257). |
| outcome-tracker.ts:100 | `* run) and are DECLARED in the summary with a reason — no estimated prices,` | LEGITIMATE | Pure docblock comment declaring the no-estimation contract. |
| outcome-tracker.ts:122 | `unclosableCounts.set(reason, (unclosableCounts.get(reason) ?? 0) + 1);` | LEGITIMATE | Counter initialization inside the declaration mechanism (unclosable reasons surfaced in the summary :255 and console :261-263). |
| outcome-tracker.ts:129 | `if (row.suggestedDTE == null) { addUnclosable('no horizon (suggestedDTE null)'); continue; }` | LEGITIMATE | Missing horizon → row skipped AND declared with a reason every run; no horizon invented. |
| outcome-tracker.ts:168 | `const sym = (m['symbol'] as string) \|\| '';` | LEGITIMATE | `\|\| ''` normalization immediately guarded by `if (sym && ...)` at :173, so a symbol-less metrics item is excluded, never stored. |
| outcome-tracker.ts:184 | `const candles = candleResult.data.get(row.ticker) ?? [];` | LEGITIMATE | `?? []` where empty means "no candle data", checked on the NEXT line (:185-187) which declares the row unclosable with a reason — exclusion, not substitution. |
| outcome-tracker.ts:191 | `// This is the actual market close as of the horizon — not an estimate.` | LEGITIMATE | Pure comment; the stale-candle tripwire at :204-206 REFUSES to close beyond the 5-day lag rather than accept a stale price. |
| outcome-tracker.ts:211 | `const liveIv = withinIvWindow ? liveIvByTicker.get(row.ticker) ?? null : null;` | LEGITIMATE | Both branches resolve to declared null when IV is unobservable, and :212-218 records exactly WHY (window expired / fetch failed / not returned); no substituted IV (:177). |
| outcome-tracker.ts:212 | `const ivNullReason = liveIv != null ? null : !withinIvWindow ? \`horizon passed > ...\` : ...` | LEGITIMATE | The nested ternary assigns REASON STRINGS — the declaration mechanism itself, persisted per-row in outcome_meta (:241). |
| outcome-tracker.ts:223 | `liveIv != null && row.iv30 != null ? liveIv < row.iv30 : undefined;` | LEGITIMATE | ivCompressed computed only when both real observations exist; otherwise undefined → stored as declared null via :35. |
| outcome-tracker.ts:229 | `iv: liveIv ?? undefined,` | LEGITIMATE | undefined → `outcome.iv ?? null` at :34 stores declared null with iv_null_reason alongside (:241); no value invented. |
| outcome-tracker.ts:232 | `// (see DECLARED_NULL_FIELDS). No estimation.` | LEGITIMATE | Pure comment declaring intentional absence of pnl/stayedInRange. |
| outcome-tracker.ts:236 | `source_iv: liveIv != null ? IV_SOURCE : null,` | LEGITIMATE | Provenance metadata: source label only when an IV was actually observed; null otherwise — declaration, not data. |
| outcome-tracker.ts:240 | `iv_observed_at: liveIv != null ? now.toISOString() : null,` | LEGITIMATE | Same provenance-metadata pattern; timestamp only for a real observation. |

### Catch blocks

| file:line | what the catch does (verbatim key line) | category | note |
|---|---|---|---|
| outcome-tracker.ts:175 | `ivFetchError = e instanceof Error ? e.message : String(e); console.error('[OutcomeCloser] market-metrics IV fetch failed:', ivFetchError);` | (b) declare loudly | Logs the error, captures it into `ivFetchError`, and every affected row then closes with outcomeIV null plus the persisted reason "market-metrics fetch failed: <msg>" (:216-217, :241); the comment at :176-177 states "Fail loud in the summary ... Never a substituted IV." Failure is scoped to the optional IV observation; the spot close (separate source) still proceeds honestly. |

### Self-check
- grep A: 9 lines, B: 1, C: 0, D: 5, E: 1; F additions: 6 (:47, :129, :212, :223, :236, :240); unique lines rowed: 21 pattern + 1 catch. No grep hit excluded.

---

## src/lib/convergence/news-classifier.ts

**Scope note:** this module is DEAD CODE — repo-wide grep finds zero callers, and data-fetchers.ts:44 states "news-classifier.ts no longer used — Claude API classification removed". Rows below classify the code as written; none of it currently executes.

### Pattern hits

| file:line | verbatim code | classification | justification |
|---|---|---|---|
| news-classifier.ts:4 | `sentiment: 'bullish' \| 'bearish' \| 'neutral';` | LEGITIMATE | Type union; 'neutral' is a real classification label, not an imputed score. |
| news-classifier.ts:14 | `if (headlines.length === 0) return [];` | LEGITIMATE | Empty in → empty out; honestly means "nothing to classify". |
| news-classifier.ts:17 | `if (!apiKey) return null;` | LEGITIMATE | Missing API key returns declared null ("classification unavailable") rather than fabricating sentiments; also correctly avoids attempting a paid call. Module has no callers anyway. |
| news-classifier.ts:29 | `\`For each headline about ${ticker}, classify the sentiment as 'bullish', 'bearish', or 'neutral' ...\`` | LEGITIMATE | Prompt string content; keyword-only hit. |
| news-classifier.ts:34 | `\`'Neutral' means no clear directional implication.\`` | LEGITIMATE | Prompt string content. |
| news-classifier.ts:37 | `\`Example: [{"idx":0,"s":"bullish","c":0.85},{"idx":1,"s":"neutral","c":0.6}]\`` | LEGITIMATE | Prompt string content. |
| news-classifier.ts:42 | `const text = response.content[0]?.type === 'text' ? response.content[0].text : '';` | LEGITIMATE | `: ''` on the false branch cannot silently persist: `JSON.parse('')` at :44 throws, landing in the catch which warns and returns declared null — no fabricated classification survives. |
| news-classifier.ts:45 | `if (!Array.isArray(parsed)) return null;` | LEGITIMATE | Malformed model output → declared null, not a guessed result. |
| news-classifier.ts:47 | `const results: (ClassifiedHeadline \| null)[] = new Array(headlines.length).fill(null);` | LEGITIMATE | Nulls are the declared type for headlines the model did not classify (return type :13 makes per-item null explicit); unclassified means unclassified. |
| news-classifier.ts:51 | `const validSentiments = ['bullish', 'bearish', 'neutral'] as const;` | LEGITIMATE | Whitelist validation of model output; invalid labels are SKIPPED (:52 continue), leaving declared null, never coerced. |
| news-classifier.ts:55 | `sentiment: item.s as 'bullish' \| 'bearish' \| 'neutral',` | LEGITIMATE | Cast is safe: reached only after the :51-52 whitelist check. |
| news-classifier.ts:56 | `confidence: Math.max(0, Math.min(1, item.c)),` | LEGITIMATE | Clamps a PRESENT model-supplied confidence to its documented 0-1 range; no absent value invented (null/non-number c already skipped at :53). |
| news-classifier.ts:67 | `return null; // Caller falls back to keyword method` | LEGITIMATE | Returns declared null after a loud console.warn; the keyword-method substitution named in the comment would live in a CALLER, and no caller exists (dead code per data-fetchers.ts:44) — if this module is ever re-wired, the caller-side fallback must be re-censused there. |

### Catch blocks

| file:line | what the catch does (verbatim key line) | category | note |
|---|---|---|---|
| news-classifier.ts:62 | `console.warn(\`[NewsClassifier] Claude API failed for ${ticker}:\`, e instanceof Error ? e.message : String(e)); ... return null;` | (b) declare loudly | Warns with ticker + message and returns declared null (typed as a possible return :13) instead of fabricated classifications. Borderline (c): console.warn is weaker than error/propagation and the comment presumes a caller-side keyword fallback — moot today because the module has no callers (dead code, data-fetchers.ts:44). |

### Self-check
- grep A: 0 lines, B: 0, C: 0, D: 6, E: 1; F additions: 7 (:14, :17, :42, :45, :47, :56, :67); unique lines rowed: 13 pattern + 1 catch. No grep hit excluded.

# Fallback census — trading / tastytrade / AI routes

Repo: /home/user/temple-stuart-accounting @ main c12e48f7 (read-only). 22 files. Line numbers from `grep -nE` / Read on the actual files. One row per unique file:line; F = ternary/literal fallbacks found by reading that greps A–D missed.

Schema facts used in classification (prisma/schema.prisma): `trading_positions.realized_pl Float?` (:345), `trading_positions.close_date DateTime?` (:343), `investment_transactions.amount Float?` (:401).

---

## src/app/api/ai/convergence-synthesis/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| convergence-synthesis/route.ts:19 | `parseInt(e.headers?.get?.('retry-after') \|\| '10')` | LEGITIMATE | Retry backoff wait only; cannot bias a score, price, or stored value. |
| convergence-synthesis/route.ts:112 | `// - Are the strategies all the same direction, or is there a mix of bullish/bearish/neutral?` | LEGITIMATE | Keyword "neutral" is prompt text asking a question of real data; no default. |
| convergence-synthesis/route.ts:201 | `top_trade_card: strat?.trade_cards?.[0] ? { ... } : null` | LEGITIMATE | Honest null when no trade card exists; the prompt sees the absence. |
| convergence-synthesis/route.ts:212 | `trade_card_count: strat?.trade_cards?.length ?? 0,` | LEGITIMATE | The count of an absent array is truthfully 0. |
| convergence-synthesis/route.ts:248 | `insufficient_peers: stats.insufficient_peers \|\| false` | LEGITIMATE | Normalizes an optional boolean flag; unset means the pipeline never flagged it — false is the semantic state. |
| convergence-synthesis/route.ts:299 | `const cacheKey = pipeline.rankings.scored_count ?? 0;` | GRAY | The comment says "keyed on pipeline run timestamp" but the key is scored_count (missing → 0): two different runs with equal counts share a cache slot and one run's AI analysis is served for another's data — is scored_count an acceptable key, Alex, or must it be the run timestamp? |
| convergence-synthesis/route.ts:315 | `` `...${pipeline.rankings.top_9?.length ?? 0} tickers...` `` | LEGITIMATE | Log-line count only. |
| convergence-synthesis/route.ts:323 | `// Rough token estimate: ~4 chars per token` | LEGITIMATE | Comment on prompt-size estimation, not a data default. |
| convergence-synthesis/route.ts:325 | `let estimatedTokens = Math.ceil(payloadStr.length / 4);` | LEGITIMATE | Token-budget heuristic; affects prompt size only, never a data value. |
| convergence-synthesis/route.ts:327 | `if (estimatedTokens > MAX_PROMPT_TOKENS) {` | LEGITIMATE | Guard on the estimate; trims tickers loudly (console.warn). |
| convergence-synthesis/route.ts:328 | `console.warn(...Prompt estimated at ${estimatedTokens} tokens..., trimming to 5 tickers...)` | LEGITIMATE | Declares the trim; reduced coverage is logged, not faked. |
| convergence-synthesis/route.ts:332 | `estimatedTokens = Math.ceil(payloadStr.length / 4);` | LEGITIMATE | Re-estimate after trim; prompt sizing only. |
| convergence-synthesis/route.ts:335 | `if (estimatedTokens > MAX_PROMPT_TOKENS) {` | LEGITIMATE | Second-stage guard; see :336 for the truncation it gates. |
| convergence-synthesis/route.ts:336 | `console.warn(...Still at ${estimatedTokens} tokens after ticker trim, truncating payload...)` | GRAY | The gated action (:337 `payloadStr.slice(0, MAX_PROMPT_TOKENS * 4)`) cuts JSON mid-string, so the model receives silently malformed/truncated data and may synthesize from a partial picture — Alex: is mid-JSON truncation acceptable, or must an over-budget payload return 4xx? |
| convergence-synthesis/route.ts:340 | `console.log(...Payload size: ... ~${estimatedTokens} tokens...)` | LEGITIMATE | Logging only. |
| convergence-synthesis/route.ts:357 | `const text = msg.content[0].type === 'text' ? msg.content[0].text : '';` | LEGITIMATE | Non-text content becomes '' which fails JSON.parse and surfaces as `parse_error: true` in the response — declared, not hidden. |
| convergence-synthesis/route.ts:379 | `pipeline_ms: pipeline.pipeline_summary?.pipeline_runtime_ms ?? 0,` | LEGITIMATE | Timing display shaping; not a score/price/stored value. |
| convergence-synthesis/route.ts:382 | `total_ms: (pipeline.pipeline_summary?.pipeline_runtime_ms ?? 0) + aiMs + synthesisMs,` | LEGITIMATE | Same timing display. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| convergence-synthesis/route.ts:17 | `catch (e: any) { if (e.status === 429 && i < maxRetries - 1) {...} throw e; }` | (a) rethrow | Retries only 429 with logged waits; everything else propagates. |
| convergence-synthesis/route.ts:363 | `catch { console.error('...Failed to parse AI response as JSON...'); synthesis = { raw: text, parse_error: true }; }` | (b) declare loudly | console.error + `parse_error: true` in the body — but the HTTP status is 200, so a naive client may treat it as success. |
| convergence-synthesis/route.ts:395 | `catch (error: unknown) { ... return NextResponse.json({ error: message }, { status: 500 }); }` | (b) declare loudly | console.error + 500 with the real message. |

### Self-check
- grep A: 5, B: 0, C: 0, D: 9, E: 3; unique lines rowed: 18 (A5 + D9 + F4: 19, 201, 248, 357). No line excluded.

---

## src/app/api/ai/strategy-analysis/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| strategy-analysis/route.ts:14 | `parseInt(e.headers?.get?.('retry-after') \|\| '10')` | LEGITIMATE | Retry backoff wait only. |
| strategy-analysis/route.ts:40 | `// - Delta: directional exposure (near zero = market neutral)` | LEGITIMATE | Keyword "neutral" in prompt text explaining a real greek; no default. Prompt line 69 also explicitly instructs "If no Finnhub data at all, skip this sentence entirely. Do NOT mention the absence" — honest omission, no invention. |
| strategy-analysis/route.ts:135 | `const text = msg.content[0].type === 'text' ? msg.content[0].text : '';` | LEGITIMATE | '' makes `JSON.parse('')` at :136 throw → caught → 500; fails loud rather than fabricating a result. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| strategy-analysis/route.ts:12 | `catch (e: any) { if (e.status === 429 ...) {...} throw e; }` | (a) rethrow | Retries only 429; rest propagates. |
| strategy-analysis/route.ts:138 | `catch (error: any) { console.error(...); return NextResponse.json({ error: 'Analysis failed' }, { status: 500 }); }` | (b) declare loudly | 500 with generic body; real error goes to console.error only. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 1, E: 2; unique lines rowed: 3 (D1 + F2: 14, 135). No line excluded. Note (not a fallback): the raw POST body is forwarded to the model unvalidated (:132).

---

## src/app/api/tastytrade/backtest/available/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| _(none)_ | — | — | No A/B/C/D hits and no F finds; non-OK upstream returns its status loudly (:24-28). |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| backtest/available/route.ts:43 | `catch (e: any) { console.error('[Backtest] Error:', e.message); return NextResponse.json({ error: e.message }, { status: 500 }); }` | (b) declare loudly | 500 with the real message. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 0, E: 1; unique lines rowed: 0. No line excluded.

---

## src/app/api/tastytrade/backtest/run/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| backtest/run/route.ts:56 | `const backtestId = createData['id'] \|\| createData['backtest-id'];` | LEGITIMATE | Alternative response key, not a fabricated value; absence is handled loudly at :58-65 (sync-result path or 500 "No backtest ID returned"). |
| backtest/run/route.ts:89 | `const status = pollData['status'] \|\| '';` | LEGITIMATE | Unknown/missing status just keeps polling; loop ends in an explicit 408 timeout (:109-113) — nothing is invented. |
| backtest/run/route.ts:101 | `details: pollData['error'] \|\| pollData['message'] \|\| 'Unknown error',` | LEGITIMATE | Error-message shaping inside a 500 response; cannot bias data. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| backtest/run/route.ts:115 | `catch (error: any) { console.error('[Backtest Run] Error:', error); return NextResponse.json({ error: 'Failed to run backtest' }, { status: 500 }); }` | (b) declare loudly | Generic 500 body; detail in console.error. Note: poll failure at :83-86 is a `continue` with console.error (not a catch) — bounded by MAX_POLL_ATTEMPTS then 408. |

### Self-check
- grep A: 0, B: 1, C: 0, D: 0, E: 1; unique lines rowed: 3 (B1 + F2: 56, 101). No line excluded.

---

## src/app/api/tastytrade/backtest/simulate/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| backtest/simulate/route.ts:27 | `const mgmt = (management as BacktestManagement) \|\| { profitTargetPercent: 50, stopLossPercent: 200, exitDte: 21 };` | GRAY | Missing management silently substitutes 50% PT / 200% SL / 21-DTE rules that materially change the simulated outcome — Alex: is this the product's documented default, or must absent management be a 400? |
| backtest/simulate/route.ts:35 | `'strategy-type': strategyType \|\| 'custom',` | LEGITIMATE | Upstream API label; legs/deltas define the actual strategy math. |
| backtest/simulate/route.ts:41 | `'target-dte': dte \|\| 45,` | GRAY | Missing dte silently backtests a 45-DTE structure (materially different trade); falsy-zero also converts an explicit dte=0 to 45 — Alex: 400 on missing dte, or accepted default? |
| backtest/simulate/route.ts:77 | `entryDate: data['entry-date'] \|\| entryDate,` | LEGITIMATE | Echoes the caller-supplied entry date the simulation was anchored to when the response omits it; not an invented value. |
| backtest/simulate/route.ts:78 | `exitDate: data['exit-date'] \|\| '',` | LEGITIMATE | Missing exit date surfaces as empty string, visibly absent rather than fabricated. |
| backtest/simulate/route.ts:79 | `entryPrice: parseFloat(data['entry-price'] \|\| 0),` | VIOLATION | Missing backtester field becomes a $0.00 entry price presented as a simulated trade result. |
| backtest/simulate/route.ts:80 | `exitPrice: parseFloat(data['exit-price'] \|\| 0),` | VIOLATION | Same: absent exit price fabricated as $0 in backtest output. |
| backtest/simulate/route.ts:81 | `pnl: parseFloat(data['pnl'] \|\| data['profit-loss'] \|\| 0),` | VIOLATION | If both keys are absent the trade's P&L is invented as 0 — a fake breakeven result, indistinguishable from a real one. |
| backtest/simulate/route.ts:82 | `pnlPercent: parseFloat(data['pnl-percent'] \|\| data['return-percent'] \|\| 0),` | VIOLATION | Same fabrication for return %. |
| backtest/simulate/route.ts:83 | `holdingDays: parseInt(data['holding-days'] \|\| data['days-held'] \|\| 0, 10),` | VIOLATION | Missing holding period fabricated as 0 days in the result. |
| backtest/simulate/route.ts:84 | `exitReason: data['exit-reason'] \|\| data['close-reason'] \|\| 'expiration',` | GRAY | Invents "expiration" as the categorical exit reason when the backtester gave none — Alex: is expiration the backtester's documented implicit default, or must missing reason surface as unknown? |
| backtest/simulate/route.ts:85 | `dailyPnl: (data['daily-pnl'] \|\| []).map((d: any) => ({` | LEGITIMATE | Absent series → empty array; honest no-data. |
| backtest/simulate/route.ts:87 | `pnl: parseFloat(d['pnl'] \|\| 0),` | VIOLATION | Daily P&L points fabricated as 0 when the field is missing. |
| backtest/simulate/route.ts:88 | `underlyingPrice: parseFloat(d['underlying-price'] \|\| 0),` | VIOLATION | A $0 underlying price is fabricated into the daily curve. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| backtest/simulate/route.ts:93 | `catch (error: any) { console.error('[Backtest Simulate] Error:', error); return NextResponse.json({ error: 'Failed to simulate trade' }, { status: 500 }); }` | (b) declare loudly | Generic 500 body; detail in console.error. Non-OK upstream is returned loudly with details at :66-70. |

### Self-check
- grep A: 0, B: 10, C: 0, D: 0, E: 1; unique lines rowed: 14 (B10 + F4: 27, 35, 77, 84). No line excluded.

---

## src/app/api/tastytrade/balances/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| balances/route.ts:32 | `const accountNumbers = connection?.accountNumbers \|\| [];` | LEGITIMATE | No connection → empty account list → empty balances; honest absence. |
| balances/route.ts:41 | `cashBalance: Number(bal?.['cash-balance'] \|\| 0),` | GRAY | A missing brokerage field renders as $0.00 cash, indistinguishable from a true zero balance — Alex: must a missing balance field be null (or an error) instead of $0? |
| balances/route.ts:42 | `buyingPower: Number(bal?.['derivative-buying-power'] \|\| 0),` | GRAY | Same: absent field displayed as $0 buying power. |
| balances/route.ts:43 | `netLiq: Number(bal?.['net-liquidating-value'] \|\| 0),` | GRAY | Same: a fabricated $0 net-liq is a materially misleading financial display. |
| balances/route.ts:44 | `maintenanceRequirement: Number(bal?.['maintenance-requirement'] \|\| 0),` | GRAY | Same; true $0 maintenance is also plausible (falsy-zero indistinguishable from absent). |
| balances/route.ts:45 | `equityBuyingPower: Number(bal?.['equity-buying-power'] \|\| 0),` | GRAY | Same pattern. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| balances/route.ts:47 | `catch (err: any) { console.error(\`[Tastytrade] Failed to fetch balances for ${acct}:\`, err?.message); }` | (c) SWALLOW | Logged server-side only; the failed account is silently omitted from the `balances` array and the 200 response carries no error signal. |
| balances/route.ts:53 | `catch (error: any) { console.error(...); return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500. |

### Self-check
- grep A: 0, B: 6, C: 0, D: 0, E: 2; unique lines rowed: 6. No line excluded.

---

## src/app/api/tastytrade/callback/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| _(none)_ | — | — | No A/B/C/D hits and no F finds. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| callback/route.ts:40 | `catch { await prisma.tastytrade_connections.update({... status: 'expired' }); return NextResponse.json({ error: 'OAuth session invalid. Please reconnect.' }, { status: 401 }); }` | (b) declare loudly | Persists `expired` state and returns 401; underlying error detail is discarded (bare catch) but the failure is declared. |
| callback/route.ts:61 | `catch (error: any) { console.error(...); return NextResponse.json({ error: 'Failed to refresh session' }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 0, E: 2; unique lines rowed: 0. No line excluded.

---

## src/app/api/tastytrade/chains/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| chains/route.ts:45 | `const dteMin = Number(body.dte_min ?? 0);` | LEGITIMATE | Query-param default with a sane bound (0 = today); filters which expirations return, invents nothing. |
| chains/route.ts:46 | `const dteMax = Number(body.dte_max ?? 45);` | LEGITIMATE | Same: default 45-DTE display window, a filter bound not a data value. |
| chains/route.ts:64 | `const nestedExpirations = chain['expirations'] \|\| [];` | LEGITIMATE | Absent list → empty; honest. |
| chains/route.ts:67 | `const expDateStr: string = exp['expiration-date'] \|\| '';` | LEGITIMATE | '' is immediately excluded at :68 (`if (!expDateStr) continue`) — exclusion, not imputation. |
| chains/route.ts:79 | `const strikeList = exp['strikes'] \|\| [];` | LEGITIMATE | Absent list → empty; honest. |
| chains/route.ts:83 | `const callOcc: string = s['call'] \|\| '';` | LEGITIMATE | Normalized to honest null at :87. |
| chains/route.ts:84 | `const putOcc: string = s['put'] \|\| '';` | LEGITIMATE | Normalized to honest null at :88. |
| chains/route.ts:86 | `strike: Number(s['strike-price'] \|\| 0),` | VIOLATION | A missing strike-price fabricates a $0 strike row into the chain used for strike selection/pricing, instead of excluding the entry. |
| chains/route.ts:87 | `call: callOcc \|\| null,` | LEGITIMATE | Honest null when no call contract. |
| chains/route.ts:88 | `put: putOcc \|\| null,` | LEGITIMATE | Honest null when no put contract. |
| chains/route.ts:89 | `callStreamerSymbol: s['call-streamer-symbol'] \|\| occToDxFeed(callOcc),` | LEGITIMATE | Derives the DXFeed symbol deterministically from the real OCC symbol when the field is absent; returns null if underivable — computation, not fabrication. |
| chains/route.ts:90 | `putStreamerSymbol: s['put-streamer-symbol'] \|\| occToDxFeed(putOcc),` | LEGITIMATE | Same derivation. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| chains/route.ts:106 | `catch (error: any) { console.error('[Tastytrade] Chains error:', error); return NextResponse.json({ error: 'Failed to fetch option chain' }, { status: 500 }); }` | (b) declare loudly | Generic 500; detail logged. |

### Self-check
- grep A: 2, B: 6, C: 0, D: 0, E: 1; unique lines rowed: 12 (A2 + B6 + F4: 87, 88, 89, 90). No line excluded. Side note (not a default): :16 `strike % 1 === 0 ? String(strike) : String(strike)` — both ternary branches identical; dead ternary, flagged for completeness.

---

## src/app/api/tastytrade/connect/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| connect/route.ts:40 | `.map((a: any) => a.account?.['account-number'] \|\| a['account-number'])` | LEGITIMATE | Alternative response shape (nested vs flat); falsy results are dropped by `.filter(Boolean)` at :41, never invented. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| connect/route.ts:42 | `catch (err: any) { console.error('[Tastytrade] OAuth validation failed:', err?.message); return NextResponse.json({ error: 'Failed to authenticate...' }, { status: 401 }); }` | (b) declare loudly | 401 before any connection row is written. |
| connect/route.ts:78 | `catch (error: any) { console.error(...); return NextResponse.json({ error: 'Failed to connect Tastytrade account' }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 0, E: 2; unique lines rowed: 1 (F: 40). No line excluded.

---

## src/app/api/tastytrade/disconnect/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| _(none)_ | — | — | No A/B/C/D hits and no F finds. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| disconnect/route.ts:43 | `catch (error: any) { console.error(...); return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 }); }` | (b) declare loudly | 500 with generic body; detail logged. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 0, E: 1; unique lines rowed: 0. No line excluded.

---

## src/app/api/tastytrade/greeks/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| greeks/route.ts:48 | `const sym = (evt['eventSymbol'] as string) \|\| '';` | LEGITIMATE | '' fails `expected.has(sym)` at :50 and the event is excluded, not imputed. |
| greeks/route.ts:49 | `const type = (evt['eventType'] as string) \|\| '';` | LEGITIMATE | '' matches no branch; event ignored. |
| greeks/route.ts:57 | `iv: Number(evt['volatility'] \|\| 0),` | VIOLATION | A missing/NaN volatility field is fabricated as IV = 0 in the greeks payload consumed downstream for strategy pricing. |
| greeks/route.ts:58 | `delta: Number(evt['delta'] \|\| 0),` | VIOLATION | Missing delta fabricated as 0 (fake market-neutral); also indistinguishable from a plausible true near-zero delta. |
| greeks/route.ts:59 | `gamma: Number(evt['gamma'] \|\| 0),` | VIOLATION | Missing gamma fabricated as 0. |
| greeks/route.ts:60 | `theta: Number(evt['theta'] \|\| 0),` | VIOLATION | Missing theta fabricated as 0 — theta/day is quoted verbatim in AI strategy analysis. |
| greeks/route.ts:61 | `vega: Number(evt['vega'] \|\| 0),` | VIOLATION | Missing vega fabricated as 0. |
| greeks/route.ts:62 | `rho: Number(evt['rho'] \|\| 0),` | VIOLATION | Missing rho fabricated as 0. |
| greeks/route.ts:63 | `theoPrice: Number(evt['price'] \|\| 0),` | VIOLATION | Missing theoretical price fabricated as $0 — a price entering strategy math. |
| greeks/route.ts:67 | `bid: Number(evt['bidPrice'] \|\| 0),` | VIOLATION | Missing bid fabricated as $0 quote (pricing input). |
| greeks/route.ts:68 | `ask: Number(evt['askPrice'] \|\| 0),` | VIOLATION | Missing ask fabricated as $0 quote. |
| greeks/route.ts:69 | `bidSize: Number(evt['bidSize'] \|\| 0),` | GRAY | Size 0 is a common true market state; absent-vs-zero indistinguishable — Alex: is 0 acceptable for a missing size, or must it be null? |
| greeks/route.ts:70 | `askSize: Number(evt['askSize'] \|\| 0),` | GRAY | Same as bidSize. |
| greeks/route.ts:73 | `data[sym].volume = Number(evt['dayVolume'] \|\| evt['volume'] \|\| 0);` | GRAY | 0 volume is plausible-true; missing → 0 also silently zeroes a liquidity signal — needs a ruling on 0 vs null. |
| greeks/route.ts:75 | `data[sym].openInterest = Number(evt['openInterest'] \|\| 0);` | GRAY | 0 OI is plausible-true, but a fabricated 0 OI would flunk any liquidity screen silently — 0 vs null ruling needed. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| greeks/route.ts:107 | `catch (error: any) { console.error('[Tastytrade] Greeks error:', error); return NextResponse.json({ error: 'Failed to fetch greeks' }, { status: 500 }); }` | (b) declare loudly | Generic 500; detail logged. Note (not a catch): the 5s deadline loop (:90-94) can return a partial `greeks` map with no signal of which symbols never arrived. |

### Self-check
- grep A: 0, B: 15, C: 0, D: 0, E: 1; unique lines rowed: 15. No line excluded.

---

## src/app/api/tastytrade/positions/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| positions/route.ts:32 | `const accountNumbers = connection?.accountNumbers \|\| [];` | LEGITIMATE | No connection → empty list; honest. |
| positions/route.ts:39 | `const mapped = (positions \|\| []).map((p: any) => ({` | LEGITIMATE | Absent list → empty; honest. |
| positions/route.ts:40 | `symbol: p['symbol'] \|\| p['underlying-symbol'] \|\| '',` | LEGITIMATE | Alt key then visible empty label; display shaping. |
| positions/route.ts:41 | `instrumentType: p['instrument-type'] \|\| '',` | LEGITIMATE | Display label. |
| positions/route.ts:42 | `quantity: Number(p['quantity'] \|\| 0),` | GRAY | A missing quantity displays as a 0-size position (sizing field); true 0 also plausible — Alex: null or exclusion instead of 0 for missing brokerage fields? |
| positions/route.ts:43 | `direction: p['quantity-direction'] \|\| '',` | LEGITIMATE | Display label. |
| positions/route.ts:44 | `averageOpenPrice: Number(p['average-open-price'] \|\| 0),` | GRAY | Missing cost basis displays as $0.00, indistinguishable from real data — same ruling needed. |
| positions/route.ts:45 | `closePrice: Number(p['close-price'] \|\| 0),` | GRAY | Missing mark displays as $0 price. |
| positions/route.ts:46 | `marketValue: Number(p['market-value'] \|\| 0),` | GRAY | Missing market value displays as $0. |
| positions/route.ts:47 | `unrealizedPL: Number(p['realized-day-gain'] \|\| 0),` | GRAY | Missing field → $0 P&L; ALSO note the field mismatch independent of the default: TT's `realized-day-gain` is surfaced as `unrealizedPL` — mislabeled financial figure. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| positions/route.ts:51 | `catch (err: any) { console.error(\`[Tastytrade] Failed to fetch positions for ${acct}:\`, err?.message); }` | (c) SWALLOW | Logged only; the failed account's positions silently vanish from a 200 response that still lists the account in `accounts`. |
| positions/route.ts:57 | `catch (error: any) { console.error(...); return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500. |

### Self-check
- grep A: 0, B: 10, C: 0, D: 0, E: 2; unique lines rowed: 10. No line excluded.

---

## src/app/api/tastytrade/quotes/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| quotes/route.ts:46 | `const sym = (evt['eventSymbol'] as string) \|\| '';` | LEGITIMATE | '' fails the `expected.has` check; event excluded, not imputed. |
| quotes/route.ts:47 | `const type = (evt['eventType'] as string) \|\| '';` | LEGITIMATE | '' matches no branch. |
| quotes/route.ts:50 | `bid: Number(evt['bidPrice'] \|\| 0),` | VIOLATION | Missing bid fabricated as a $0 quote consumed for pricing. |
| quotes/route.ts:51 | `ask: Number(evt['askPrice'] \|\| 0),` | VIOLATION | Missing ask fabricated as $0. |
| quotes/route.ts:52 | `mid: (Number(evt['bidPrice'] \|\| 0) + Number(evt['askPrice'] \|\| 0)) / 2,` | VIOLATION | One missing side silently halves the mid (mid = ask/2 or bid/2) — a fabricated price with no absence signal. |
| quotes/route.ts:53 | `bidSize: Number(evt['bidSize'] \|\| 0),` | GRAY | Size 0 is a common true value; absent-vs-zero indistinguishable — 0 vs null ruling needed. |
| quotes/route.ts:54 | `askSize: Number(evt['askSize'] \|\| 0),` | GRAY | Same. |
| quotes/route.ts:60 | `quotes[sym].last = Number(evt['price'] \|\| 0);` | VIOLATION | Missing trade price fabricated as last = $0. |
| quotes/route.ts:61 | `quotes[sym].volume = Number(evt['dayVolume'] \|\| evt['volume'] \|\| 0);` | GRAY | 0 volume plausible-true; missing → 0 zeroes a liquidity signal silently. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| quotes/route.ts:86 | `catch (error: any) { console.error('[Tastytrade] Quotes error:', error); return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 }); }` | (b) declare loudly | Generic 500; detail logged. Note: the 5s deadline (:74-79) can return a partial `quotes` map with no per-symbol absence signal. |

### Self-check
- grep A: 0, B: 9, C: 0, D: 0, E: 1; unique lines rowed: 9. No line excluded.

---

## src/app/api/tastytrade/scanner/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| scanner/route.ts:148 | `: POPULAR_SYMBOLS;` (custom universe with empty customSymbols) | GRAY | `universe=custom` with no symbols silently scans the 50 "popular" tickers while the response echoes `universe: custom` — Alex: should empty custom be a 400 instead? |
| scanner/route.ts:149 | `default: return POPULAR_SYMBOLS;` | GRAY | Any unrecognized universe string (query param is cast, not validated) silently scans the popular list while echoing the requested name — 400 vs silent substitution needs a ruling. |
| scanner/route.ts:153 | `const BATCH_SIZE = 50;` | LEGITIMATE | Named batching constant; affects request chunking only. |
| scanner/route.ts:180 | `const universe = (searchParams.get('universe') \|\| 'popular') as Universe;` | LEGITIMATE | Absent param → documented default universe; a sane query default. |
| scanner/route.ts:181 | `const customSymbols = searchParams.get('customSymbols') \|\| undefined;` | LEGITIMATE | `?? undefined`-style normalization. |
| scanner/route.ts:209 | `const earningsDate = m['earnings']?.['expected-report-date'] \|\| m['next-earnings-date'] \|\| null;` | LEGITIMATE | Alternative vendor keys then honest null. |
| scanner/route.ts:220 | `symbol: m['symbol'] \|\| '',` | LEGITIMATE | '' rows are excluded at :262 (`.filter((m: any) => m.symbol)`). |
| scanner/route.ts:221 | `ivRank: Number(m['implied-volatility-index-rank'] \|\| m['tos-...'] \|\| m['tw-...'] \|\| 0),` | VIOLATION | A ticker missing IV rank across all three vendor keys is fabricated as rank 0, then `metrics.sort((a,b) => b.ivRank - a.ivRank)` (:265) sorts the whole universe on it — a silent default that orders/filters the universe; also a true rank 0 is plausible and indistinguishable. |
| scanner/route.ts:222 | `ivPercentile: Number(m['implied-volatility-percentile'] \|\| 0),` | VIOLATION | Missing percentile fabricated as 0 metric (true 0 plausible), presented as real scanner data. |
| scanner/route.ts:223 | `impliedVolatility: Number(m['implied-volatility-index'] \|\| 0),` | VIOLATION | Missing IV index fabricated as 0 — a market metric invented on absence. |
| scanner/route.ts:224 | `liquidityRating: m['liquidity-rating'] != null ? Number(m['liquidity-rating']) : null,` | LEGITIMATE | The correct pattern (explicit null check → honest null); contrast with :221-223. |
| scanner/route.ts:229 | `hv30: parseFloat(m['historical-volatility-30-day']) \|\| null,` | LEGITIMATE | Missing → honest null; a true HV of exactly 0 is implausible, so the falsy-zero footgun is theoretical here. |
| scanner/route.ts:230 | `hv60: parseFloat(m['historical-volatility-60-day']) \|\| null,` | LEGITIMATE | Same. |
| scanner/route.ts:231 | `hv90: parseFloat(m['historical-volatility-90-day']) \|\| null,` | LEGITIMATE | Same. |
| scanner/route.ts:232 | `iv30: parseFloat(m['implied-volatility-30-day']) \|\| null,` | LEGITIMATE | Same (true 0 IV implausible). |
| scanner/route.ts:233 | `ivHvSpread: parseFloat(m['iv-hv-30-day-difference']) \|\| null,` | GRAY | Falsy-zero footgun: a true spread of exactly 0 (IV == HV) is plausible and would be nulled — "no data" and "zero edge" collapse into one state. |
| scanner/route.ts:236 | `beta: parseFloat(m['beta']) \|\| null,` | GRAY | A true beta of 0 is plausible and would be nulled (falsy-zero footgun). |
| scanner/route.ts:237 | `corrSpy: parseFloat(m['corr-spy-3month']) \|\| null,` | GRAY | True 0 correlation is plausible and would be nulled. |
| scanner/route.ts:238 | `marketCap: m['market-cap'] \|\| null,` | LEGITIMATE | Honest null on absence (a true 0 market cap does not exist). |
| scanner/route.ts:239 | `sector: m['sector'] \|\| null,` | LEGITIMATE | Honest null. |
| scanner/route.ts:240 | `industry: m['industry'] \|\| null,` | LEGITIMATE | Honest null. |
| scanner/route.ts:243 | `peRatio: parseFloat(m['price-earnings-ratio']) \|\| null,` | LEGITIMATE | A true PE of exactly 0 is implausible; missing → honest null. |
| scanner/route.ts:244 | `eps: parseFloat(m['earnings-per-share']) \|\| null,` | GRAY | EPS of exactly $0.00 is plausible and would be nulled (falsy-zero footgun). |
| scanner/route.ts:245 | `dividendYield: parseFloat(m['dividend-yield']) \|\| null,` | GRAY | 0% yield is the TRUE value for every non-payer; if the API reports 0 it is nulled, misrepresenting "pays no dividend" as "unknown" — clearest falsy-zero footgun in the file. |
| scanner/route.ts:246 | `lendability: m['lendability'] \|\| null,` | LEGITIMATE | String field, honest null. |
| scanner/route.ts:247 | `borrowRate: parseFloat(m['borrow-rate']) \|\| null,` | GRAY | A true 0 borrow rate is plausible and would be nulled. |
| scanner/route.ts:250 | `earningsActualEps: m['earnings']?.['actual-eps'] ? parseFloat(m['earnings']['actual-eps']) : null,` | GRAY | Truthiness gate: a numeric 0 actual-EPS is falsy and would be nulled (string "0" would survive — depends on vendor type); falsy-zero footgun. |
| scanner/route.ts:251 | `earningsEstimate: m['earnings']?.['consensus-estimate'] ? parseFloat(m['earnings']['consensus-estimate']) : null,` | GRAY | Same truthiness footgun for a 0 consensus estimate. |
| scanner/route.ts:252 | `earningsTimeOfDay: m['earnings']?.['time-of-day'] \|\| null,` | LEGITIMATE | Honest null. |
| scanner/route.ts:255 | `termStructure: (m['option-expiration-implied-volatilities'] \|\| [])` | LEGITIMATE | Absent structure → empty array; entries without IV are excluded by the `.filter` at :256, not imputed. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| scanner/route.ts:199 | `catch (err) { console.error('[Scanner] Batch error:', err); return []; }` | (c) SWALLOW | A failed batch of up to 50 symbols silently vanishes: console.error only, the 200 response still reports `totalScanned` = the full requested count with no error/gap field — the shrunken universe is invisible to the caller. |
| scanner/route.ts:273 | `catch (error: any) { console.error('[Tastytrade] Scanner error:', error); return NextResponse.json({ error: 'Failed to fetch scanner data' }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500. |

### Self-check
- grep A: 0, B: 5, C: 1, D: 2, E: 2; unique lines rowed: 30 (B5 + C1 + D2 + F22). No line excluded.

---

## src/app/api/tastytrade/status/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| status/route.ts:45 | `accountNumbers: connection?.accountNumbers \|\| [],` | LEGITIMATE | Display shaping of an absent list as empty; connected=true was already established, nothing invented. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| status/route.ts:49 | `catch (error: any) { console.error('[Tastytrade] Status error:', error); return NextResponse.json({ error: 'Failed to check status' }, { status: 500 }); }` | (b) declare loudly | 500 with generic body; detail logged. |

### Self-check
- grep A: 0, B: 1, C: 0, D: 0, E: 1; unique lines rowed: 1. No line excluded.

---

## src/app/api/trading/commit-to-ledger/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| commit-to-ledger/route.ts:104 | `const netPL = positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0);` | GRAY | `realized_pl` is nullable (schema:345) even on CLOSED rows; a null leg is summed as $0 and the resulting partial netPL is PERSISTED as journal/ledger entries — Alex: must a CLOSED leg with null realized_pl abort the commit for that trade instead of contributing $0? |
| commit-to-ledger/route.ts:117 | `}, null) \|\| new Date();` (closeDate reduce fallback) | VIOLATION | When no leg has a close_date, the journal entry date is fabricated as "now" and persisted to the ledger (and the period-close guard at :134 is evaluated against the invented date) — a fake date entering financial records with no signal. |
| commit-to-ledger/route.ts:121 | `const strategy = positions[0].strategy \|\| 'unknown';` | LEGITIMATE | Feeds only the JE description label; amounts and accounts are unaffected. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| commit-to-ledger/route.ts:193 | `catch (err) { if (err instanceof PeriodClosedError) { errors.push(...); continue; } ... if (message.includes('Unique constraint')...) { skipped++; continue; } console.error(...); errors.push(\`Trade #${tradeNum}: ${message}\`); }` | (b) declare loudly | Per-trade failures land in the response `errors` array (or `skipped` for idempotent duplicates); nothing disappears. |
| commit-to-ledger/route.ts:210 | `catch (error) { console.error(...); return NextResponse.json({ error: message }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500 with real message. |

### Self-check
- grep A: 1, B: 0, C: 0, D: 0, E: 2; unique lines rowed: 3 (A1 + F2: 117, 121). No line excluded.

---

## src/app/api/trading/convergence/close-outcomes/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| _(none)_ | — | — | No A/B/C/D hits and no F finds. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| close-outcomes/route.ts:36 | `catch (error: unknown) { const msg = ...; console.error('[OutcomeCloser] run failed:', msg); return NextResponse.json({ error: msg }, { status: 500 }); }` | (b) declare loudly | 500 with real message. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 0, E: 1; unique lines rowed: 0. No line excluded.

---

## src/app/api/trading/convergence/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| convergence/route.ts:21 | `` return `convergence_${limit}_${universe ?? 'all'}`; `` | LEGITIMATE | Cache-key label for "no universe filter"; matches actual pipeline behavior. |
| convergence/route.ts:49 | `// fires for unauthorized users. Hard gate, no fallback. (Same pattern as the` | LEGITIMATE | Comment declaring the no-fallback auth gate; not a default. |
| convergence/route.ts:58 | `let limit = parseInt(searchParams.get('limit') \|\| '20', 10);` | LEGITIMATE | Query default clamped to sane bounds at :59-60 (4..150); cannot bias scoring. |
| convergence/route.ts:63 | `const universe = searchParams.get('universe') ?? undefined;` | LEGITIMATE | Null→undefined normalization. |
| convergence/route.ts:122 | `` console.log(`...universe=${universe ?? 'all'})`); `` | LEGITIMATE | Logging only. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| convergence/route.ts:73 | `} catch { // Non-critical }` (userId lookup for SSE path) | (c) SWALLOW | A DB failure looking up the user silently drops snapshot logging for the run — pipeline proceeds, response carries no signal. Deliberate per comment, but silent to the caller. |
| convergence/route.ts:88 | `catch (err) { send({ step: 'error', label: err instanceof Error ? err.message : String(err), data: {} }); }` | (b) declare loudly | Pipeline failure is emitted as an SSE `error` event with the real message. |
| convergence/route.ts:129 | `} catch { // Non-critical — snapshot logging will be skipped }` | (c) SWALLOW | Same as :73 for the non-stream path: snapshot audit trail silently skipped. |
| convergence/route.ts:147 | `catch (error: unknown) { ... return NextResponse.json({ error: message }, { status: 500 }); }` | (b) declare loudly | Outer handler, 500 with real message. |

### Self-check
- grep A: 3, B: 0, C: 0, D: 1, E: 4; unique lines rowed: 5 (A3 + D1 + F1: 58). No line excluded.

---

## src/app/api/trading/coverage/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| coverage/route.ts:9 | `* the DB and traceable to a query — NO external APIs, NO estimates. If the user has` | LEGITIMATE | Doc comment declaring the no-estimate policy; the code below matches it (nulls for absent dates at :69-70). |
| coverage/route.ts:10 | `* zero data, returns zeros with null dates (the true state, not a fallback).` | LEGITIMATE | Same — comment; zero counts for zero rows are the true state. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| coverage/route.ts:78 | `catch (error) { console.error('[trading/coverage]', error); return NextResponse.json({ error: 'Failed to compute coverage' }, { status: 500 }); }` | (b) declare loudly | 500; detail logged. |

### Self-check
- grep A: 0, B: 0, C: 0, D: 2, E: 1; unique lines rowed: 2. No line excluded.

---

## src/app/api/trading/realized-pnl/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| realized-pnl/route.ts:17 | `* NOT DERIVABLE → declared, never fabricated (NO FALLBACK):` | LEGITIMATE | Doc comment; the code honors it (`capital`/`drawdown` returned as `tracked: false` at :78-79 rather than invented). |
| realized-pnl/route.ts:65 | `const gains = Number(rows[0]?.gains_cents ?? 0) / 100;` | LEGITIMATE | The SQL already `COALESCE(SUM(...), 0)` and an aggregate always returns one row; `?? 0` is a dead defensive guard that cannot change the ledger-derived figure (no rows in the ledger truly means $0 realized). |
| realized-pnl/route.ts:66 | `const losses = Number(rows[0]?.losses_cents ?? 0) / 100;` | LEGITIMATE | Same. |
| realized-pnl/route.ts:68 | `const tradeCount = Number(rows[0]?.trade_count ?? 0);` | LEGITIMATE | Same; COUNT of nothing is truthfully 0. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| realized-pnl/route.ts:81 | `catch (error) { console.error('Trading realized-pnl API error:', error); return NextResponse.json({ error: 'Failed to compute trading realized P&L' }, { status: 500 }); }` | (b) declare loudly | 500; detail logged. |

### Self-check
- grep A: 3, B: 0, C: 0, D: 1, E: 1; unique lines rowed: 4. No line excluded.

---

## src/app/api/trading/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| trading/route.ts:94 | `const optionRealizedPL = closedPositions.reduce((sum, p) => sum + (p.realized_pl \|\| 0), 0);` | GRAY | `realized_pl` is nullable (schema:345) even for CLOSED rows; a null leg silently contributes $0 to the displayed total P&L — Alex: should a CLOSED position with null realized_pl surface as a data gap instead of $0? |
| trading/route.ts:102 | `byStrategy[strategy].total += p.realized_pl \|\| 0;` | GRAY | Same nullable-P&L-as-$0 in the per-strategy breakdown. |
| trading/route.ts:100 | `const strategy = p.strategy \|\| 'Unknown';` | LEGITIMATE | Honest grouping label; P&L amounts unchanged. |
| trading/route.ts:138 | `symbol: t.security?.ticker_symbol \|\| 'N/A',` | LEGITIMATE | Display shaping; 'N/A' honestly marks the absent symbol. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| trading/route.ts:152 | `catch (error) { console.error('Trading API error:', error); return NextResponse.json({ error: 'Failed to fetch trading data' }, { status: 500 }); }` | (b) declare loudly | 500; detail logged. |

### Self-check
- grep A: 0, B: 2, C: 0, D: 0, E: 1; unique lines rowed: 4 (B2 + F2: 100, 138). No line excluded.

---

## src/app/api/trading/trades/route.ts

### Pattern hits
| file:line | code | class | justification |
|---|---|---|---|
| trades/route.ts:66 | `entry.realizedPL += pos.realized_pl \|\| 0;` | GRAY | `realized_pl` nullable (schema:345); a CLOSED leg with null P&L is silently summed as $0 into the trade's displayed realizedPL — same ruling as trading/route.ts:94 needed. |
| trades/route.ts:92 | `strategy: firstTxn.strategy \|\| 'unknown',` | LEGITIMATE | Honest grouping label. |
| trades/route.ts:108 | `// Fallback: legacy trades without trading_position records — use name-matching` | LEGITIMATE | Comment marking the documented legacy path; the path derives P&L from real transaction amounts (name-matching heuristic), not invented values — its risk lives in the `\|\| 0` rows below. |
| trades/route.ts:117 | `const amount = t.amount \|\| 0;` | GRAY | `investment_transactions.amount` is `Float?` (schema:401); a null amount silently contributes $0 to openAmount → realizedPL — BUT expiration legs plausibly carry a true $0/null amount, so absent-vs-zero is entangled: Alex must rule whether a null amount excludes the trade from legacy P&L or is a legitimate $0 (e.g. expiration). |
| trades/route.ts:129 | `const amount = t.amount \|\| 0;` | GRAY | Same null-amount-as-$0 in the exercise/assignment close branch. |
| trades/route.ts:133 | `const amount = t.amount \|\| 0;` | GRAY | Same in the option-close branch. |
| trades/route.ts:139 | `const realizedPL = isClosed ? -(openAmount + closeAmount) : 0;` | LEGITIMATE | An open trade truthfully has $0 realized P&L; not an imputation. |
| trades/route.ts:145 | `strategy: firstTxn.strategy \|\| 'unknown',` | LEGITIMATE | Honest label. |
| trades/route.ts:242 | `const totalRealizedPL = allTrades.reduce((sum, t) => sum + (t.realizedPL \|\| 0), 0);` | LEGITIMATE | `t.realizedPL` is always assigned a number in every constructor path (:97, :150, :211); dead defensive guard. |
| trades/route.ts:249 | `const key = t.strategy \|\| 'unknown';` | LEGITIMATE | Honest grouping label. |
| trades/route.ts:254 | `byStrategyMap[key].pl += t.realizedPL \|\| 0;` | LEGITIMATE | Dead guard (realizedPL always numeric). |
| trades/route.ts:255 | `if ((t.realizedPL \|\| 0) >= 0) byStrategyMap[key].wins++;` | LEGITIMATE | Dead guard; note the product semantics (independent of the default): a $0 trade counts as a win. |
| trades/route.ts:263 | `const key = t.underlying \|\| 'UNKNOWN';` | LEGITIMATE | Honest grouping label. |
| trades/route.ts:268 | `byTickerMap[key].pl += t.realizedPL \|\| 0;` | LEGITIMATE | Dead guard. |
| trades/route.ts:269 | `if ((t.realizedPL \|\| 0) >= 0) byTickerMap[key].wins++;` | LEGITIMATE | Dead guard; $0-counts-as-win semantics as :255. |
| trades/route.ts:283 | `winRate: closedCount > 0 ? Math.round((allTrades.filter(... (t.realizedPL \|\| 0) >= 0).length / closedCount) * 100) : 0,` | LEGITIMATE | Dead guard; 0% win rate with zero closed trades is the true state. |
| trades/route.ts:285 | `const wins = allTrades.filter(t => t.status === 'CLOSED' && (t.realizedPL \|\| 0) > 0);` | LEGITIMATE | Dead guard. |
| trades/route.ts:286 | `return wins.length > 0 ? wins.reduce((sum, t) => sum + (t.realizedPL \|\| 0), 0) / wins.length : 0;` | LEGITIMATE | avgWin 0 with no wins is honest; dead guard otherwise. |
| trades/route.ts:289 | `const losses = allTrades.filter(t => t.status === 'CLOSED' && (t.realizedPL \|\| 0) < 0);` | LEGITIMATE | Dead guard. |
| trades/route.ts:290 | `return losses.length > 0 ? losses.reduce((sum, t) => sum + (t.realizedPL \|\| 0), 0) / losses.length : 0;` | LEGITIMATE | avgLoss 0 with no losses is honest. |
| trades/route.ts:293 | `const totalWins = allTrades.filter(... (t.realizedPL \|\| 0) > 0).reduce((sum, t) => sum + (t.realizedPL \|\| 0), 0);` | LEGITIMATE | Dead guard. |
| trades/route.ts:294 | `const totalLosses = Math.abs(allTrades.filter(... (t.realizedPL \|\| 0) < 0).reduce(... (t.realizedPL \|\| 0), 0));` | LEGITIMATE | Dead guard. |
| trades/route.ts:295 | `return totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;` | GRAY | With zero losses, profitFactor is reported as the invented sentinel 999 — a fabricated statistic indistinguishable from a real ratio; Alex: should it be null/"∞" instead? |
| trades/route.ts:310 | `return 'UNKNOWN';` (extractTicker default) | LEGITIMATE | Honest label when no ticker is parseable from the transaction name; display only. |

### Catch blocks
| file:line | what it does | class | note |
|---|---|---|---|
| trades/route.ts:299 | `catch (error) { console.error('Trades endpoint error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }` | (b) declare loudly | 500; detail logged. |

### Self-check
- grep A: 0, B: 16, C: 0, D: 1, E: 1; unique lines rowed: 24 (B16 + D1 + F7: 92, 139, 145, 249, 263, 295, 310). No line excluded.

---

# Totals

- Pattern rows: 164 (grep A: 14, B: 81, C: 1, D: 17, dupes 0, F additions: 51). Catch rows: 34 (all grep-E hits rowed).
- VIOLATION: 25 · GRAY: 40 · LEGITIMATE: 99.
- Catch classification: (a) rethrow: 2 · (b) declare loudly: 27 · (c) SWALLOW: 5 (scanner:199, balances:47, positions:51, convergence:73, convergence:129).

---

# SECTION 2 — THE KNOWN OPEN LIST, VERIFIED (code pasted from main @ c12e48f7)

## 2.1 `pipeline.ts:1578-1579` — iv30 ?? 30 / hv30 ?? 25 — **CONFIRMED OPEN**

```ts
        iv30: (tt.iv30 ?? 30) / 100,
        hv30: (tt.hv30 ?? 25) / 100,
```

These feed `chainInputs` → `fetchChainAndBuildCards` → `generateStrategies` — a **pricing path**. Downstream they compound with `strategy-builder.ts:833` `const iv = params.iv30 ?? 0.30;` and `:848` `const hv = params.hv30 ?? iv;` — the σ in every breakeven_d2 PoP, EV, and the hv-based risk proxy. **What each biases:** a ticker missing iv30 would be priced as a flat 30-vol name; missing hv30 as 25 (or as its own IV at :848), silently shifting PoP, EV, PoP-gate pass/fail, and card ranking. **Reachability nuance:** the iv30 branch is almost certainly dead — hard Filter 3 (`pipeline.ts:2046-2051` "iv30 is not null/zero") removes iv30-null tickers before scoring; hv30 has **no** such filter, so `?? 25` is live. **Honest fix shape: EXCLUSION, not literals** — type chainInputs' iv30 as required-real (dead default deleted), hv30 as `number | null`, and have the strategy builder declare hv-based outputs not-evaluated when hv30 is null (the EDGE-3 hv10-null pattern at pipeline.ts:1569-1573 is the in-repo precedent). Kill strategy-builder :833/:848 in the same sweep.

## 2.2 `pipeline.ts:2249` — variance-form VRP — **CONFIRMED OPEN (display-only)**

```ts
    if (tt.iv30 != null && tt.hv30 != null) {
      const vrp = round(tt.iv30 ** 2 - tt.hv30 ** 2, 0);
      signals.push(`VRP=${vrp}`);
```

This is inside `buildRankedRows`' `key_signal` display string. **What it biases:** no score — but the UI shows a *variance-form* VRP (iv30²−hv30², e.g. 45²−30² = 1125) while everything scored uses the simple difference iv30−hv30 = 15 (vol-edge.ts VRP, Goyal & Saretto 2009 per its own comment). A no-drift violation: what the UI shows ≠ what fires. **Honest fix shape: DISPLAY FORMULA FIX** — make the key_signal use the same iv30−hv30 the scorer uses (or label it "VRP(var)" explicitly). No exclusion logic needed; both inputs are guarded non-null.

## 2.3 `info-edge.ts:74 / :88 / :102 / :123` — analyst_consensus internals — **CONFIRMED OPEN (the documented EDGE-2b deferral)**

```ts
  let estimateLevelScore = 40; // penalty default            // :74  — fires when forwardEps/trailingActualEps missing
  let estimateDispersionScore = 40; // penalty default        // :88  — fires when nextQEps missing/≈0
  let revenueEpsAlignmentScore = 50; // neutral default       // :102 — fires when revenue estimates missing
  let consensusBreadthScore = 40; // penalty default          // :123 — fires when recommendations empty
```

**What each biases:** all four are blended 25/25/15/35 into analyst_consensus, which is ALWAYS in the info-edge combiner (`info-edge.ts:1319`, the `activeWeight >= 0.15` floor assumption at :1317) — so missing estimate/recommendation data enters the info-edge score as literal 40/40/50/40 instead of being excluded. The imputed_fields declaration (`:1347-1348`) **under-declares**: it only flags the recs-empty-AND-no-estimates and no-estimates cases, missing (i) recs empty with estimates present, (ii) estimates present but no future-period rows, (iii) earnings history empty — verified during this census. **Honest fix shape: EDGE-2b component-level conversion** — each of the four components → null when its data is absent, excluded, remaining component weights renormalized inside analyst_consensus; if ALL four are null, analyst_consensus itself returns null, which requires revisiting the combiner's "analyst always present" assumption (`:1316-1319`). Declaration derived from the actual null traces so it can't drift.

## 2.4 `probability.ts:56` — d2 missing dividend yield q — **CONFIRMED (whole file read, 112 lines)**

```ts
  const d2 = (Math.log(spotPrice / targetPrice) + (riskFreeRate - iv * iv / 2) * dteYears) / (iv * sqrtT);
```

There is **no q anywhere in the file** (and no d1 — only expiration-probability N(d2) is used). The risk-neutral drift is `r − σ²/2`; correct with continuous dividend yield is `r − q − σ²/2`. **What it biases:** for dividend payers, drift is overstated by q·T → `probAbove` overstated / `probBelow` understated → every `calculateBreakevenPoP` (strategy-builder.ts:79-142) → `card.pop` (`popMethod: 'breakeven_d2'`, :841-842) → PoP gate B (:980), EV, ranking, and the trade card's `probability_of_profit` (trade-cards.ts:442). For a 2% yielder at 45 DTE the drift error is ~0.25% of spot — small per trade, systematic across every dividend-paying underlying, always in the same direction (flattering short-put-side PoP). **Risk-free rate is honest:** required param with no default (probability.ts:40, 51; consumers keep it required — strategy-builder.ts:233, chain-fetcher.ts:22) and the pipeline **throws** when FEDFUNDS is null (pipeline.ts:1555-1560). **Honest fix shape: FORMULA FIX** — add a required `dividendYield` parameter (`r − q − σ²/2`), fed from the already-fetched `tt.dividendYield` (TT market-metrics; already consumed at trade-cards.ts:404). One GRAY ruling rides along: TT `dividend-yield` null vs 0 semantics (`parseFloat(x) || null` currently nulls a true 0%) — a null-q payer must be **declared** (PoP labeled "q not available") rather than silently priced at q=0.

---

## SECTION 3 — FRED scored-vs-display

FredMacroData (src/lib/convergence/types.ts:118-148) has 24 fields: 22 numeric series/derived values + 2 observation-date strings. "Scored in regime" = the value enters scoreRegime's score math (growth/inflation composites, regime classification modifiers, or the VIX strategy overlay that produces the base regime score).

| FRED field (series) | scored in regime? | scoring line(s) in regime.ts | other uses (file:line) |
|---|---|---|---|
| gdp (GDPC1) | YES | 150 (normalizeGdp → growth 0.25 at 160) | breakdown raw_values regime.ts:674; pipeline step_h trace |
| unemployment (UNRATE) | YES | 151 (→ growth 0.20 at 160) | breakdown regime.ts:675 |
| nonfarmPayrolls (PAYEMS) | YES | 152 (→ growth 0.20 at 160) | breakdown regime.ts:676 |
| consumerConfidence (UMCSENT) | YES | 153 (→ growth 0.15 at 161) | breakdown regime.ts:677 |
| initialClaims (ICSA) | YES | 154 (→ growth 0.10 at 161) | staleness flag regime.ts:656; breakdown 678 |
| nfci (NFCI) | YES | 155 (→ growth 0.10 at 161) | staleness flag regime.ts:657; breakdown 679 |
| cpi (CPIAUCSL YoY) | YES | 180 (→ inflation 0.30 at 189) | breakdown regime.ts:693; composite.ts data gap n/a |
| cpiMom (CPIAUCSL MoM) | YES | 181 (→ inflation 0.20 at 189) | breakdown regime.ts:694 |
| fedFunds (FEDFUNDS) | YES | 182 (→ inflation 0.15 at 189) | breakdown regime.ts:695; gap note composite.ts:354 |
| treasury10y (DGS10) | YES | 183 (→ inflation 0.15 at 190) | breakdown regime.ts:696; gap note composite.ts:353; DGS10 daily history also feeds cross-asset.ts:140 |
| breakeven5y (T5YIE) | YES | 184 (→ inflation 0.20 at 190) | breakdown regime.ts:697 |
| yieldCurveSpread (T10Y2Y) | YES | passed at 562-566 → inversion modifier 234-240 on regime raw scores | inverted flag regime.ts:570, breakdown 703-704; imputed-tracking 643 |
| hySpread (BAMLH0A0HYM2) | YES | passed at 562-566 → stress modifier 245-253 | hy_stress_level regime.ts:571-575 → CRISIS gate-weight override composite.ts:61-63 (changes composite weights); breakdown 705-706; tracking 644 |
| vix (VIXCLS) | YES | 599 → scoreStrategies overlay 346-357, ±10/±5 into final_score 378 (base regime score = best final_score, 602-603) | vix_overlay breakdown regime.ts:708-711; trade-cards.ts:190 (VIX>25 warning); pipeline.ts:673 (term slope), 1961; snapshot-logger.ts:56; gap note composite.ts:352. NOT counted in regime data_confidence (646) |
| initialClaimsDate | NO (display-only) | — | staleness flag string only, regime.ts:656 (isStale 42-47) |
| nfciDate | NO (display-only) | — | staleness flag string only, regime.ts:657 |
| vxvShortTerm (VXVCLS) | NO (display-only) | — | pipeline.ts:670-673 vix_term_structure_slope (trace/display, 739-750), step_h series list 683-684 |
| vvix (VVIXCLS) | NO (display-only) | — | pipeline.ts:685-686 step_h series list only |
| fedBalanceSheet (WALCL) | NO (audit-only ancillary) | — | fed net liquidity ancillary regime.ts:524-535 → breakdown 735 (comment 477: "not yet wired into composite"); pipeline.ts:659-666, 727-737; UI ConvergenceIntelligence.tsx:2626-2653 |
| treasuryGeneralAccount (WTREGEN) | NO (audit-only ancillary) | — | same fed-net-liquidity path (regime.ts:526/529; pipeline.ts:660-665; UI 2649) |
| overnightReverseRepo (RRPONTSYD) | NO (audit-only ancillary) | — | same fed-net-liquidity path (regime.ts:527/529; pipeline.ts:661-665; UI 2650) |
| bbbSpread (BAMLC0A4CBBB) | NO (audit-only ancillary) | — | ancillary band regime.ts:492-499 → breakdown 732; pipeline.ts:715-716, 1389-1390; UI ConvergenceIntelligence.tsx:3244 |
| t10y3m (T10Y3M) | NO (audit-only ancillary) | — | ancillary band regime.ts:502-509 → breakdown 733; pipeline.ts:693-694, 1391 |
| dollarIndex (DTWEXBGS) | NO (audit-only ancillary) | — | ancillary band regime.ts:512-519 → breakdown 734; pipeline.ts:723-724 |

Totals: 14 of 22 numeric series ENTER scoreRegime's math (11 via the growth/inflation weighted composites, 2 as classification modifiers, 1 via the VIX strategy overlay); 8 numeric series + 2 date fields are display/audit-only. Note the asymmetry: the 11 composite-entering series impute 50 when null (VIOLATIONS above), while the audit-only ancillary signals correctly stay `null` when data is missing (regime.ts:492-535).

---

# SECTION 4 — CATCH-BLOCK AUDIT (aggregate; per-catch rows with verbatim code are in each file's "Catch blocks" table in Section 1)

**110 catch blocks in scope** (independently reconciled against a whole-scope grep): **2 (a) rethrow/propagate · 66 (b) declare loudly · 42 (c) SWALLOW silently — fail-loud violations.**

The 42 silent-swallow locations:

- **data-fetchers.ts (21):** :95, :96, :97, :98, :105, :116, :129, :140, :199, :214, :231, :246, :253, :401, :402, :403, :1257, :1730, :1731, :1742, :1749 — per-symbol Finnhub fetch failures console.error at most and return empty/null with **no error channel on FinnhubData/FinnhubEstimateData**, so scoring and the N/M declarations cannot distinguish "fetched, empty" from "fetch failed"; :1730-:1749 are unlogged `.catch(() => null)` on parallel ownership/statement fetches.
- **pipeline.ts (12):** :555, :769, :807, :822, :837, :852, :867, :882, :897, :912, :929, :1872 — per-step/per-symbol enrichment failures logged to console only; not pushed to `errors[]`/`data_gaps[]`, so the run result reports clean.
- **api routes (5):** scanner/route.ts:199 (a failed batch becomes `[]` while `totalScanned` still reports the full universe count), balances/route.ts:47 and positions/route.ts:51 (per-account failures silently dropped from the response), trading/convergence/route.ts:73 and :129 (snapshot-log failures invisible to the caller).
- **chain-fetcher.ts (2):** :446 (per-ticker chain failure → zero cards with no rejection entry) and :531 (fatal error returns a success-shaped empty result).
- **sentiment.ts (2):** :109, :165 (underlying error detail discarded; the null/'' results are handled loudly upstream, but the cause is unrecoverable from logs).

The 2 (a) propagating catches and 66 (b) declaring catches (errors[] / data_gaps[] / rejection maps / HTTP error bodies / `{data:null, error}` fetcher shape) are itemized per file in Section 1.

---

# CLOSING COUNT

**1,529 total hits · 1,283 legitimate (1,215 pattern + 68 honest catches) · 145 violations (103 pattern + 42 silent catches) · 101 gray** — every gray row states the exact question; the recurring gray themes are listed at the top of this document.
