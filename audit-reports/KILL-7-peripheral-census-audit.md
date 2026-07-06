# KILL-7 Audit — peripheral census kill (closes the FALLBACK-CENSUS violations column)

**Date:** 2026-07-06 · **Branch:** `claude/kill-7-peripheral-census-close` · **Base:** main @ `ee8f8df9` (KILL-6 `09496816` verified present)

## Classification of the final 22 (all verified on base; all DIE)

| Cluster | Sites | Was | Now |
|---|---|---|---|
| backtest/simulate (7) | `:79-:83, :87, :88` | `parseFloat(x \|\| 0)` — missing backtester fields presented as $0 prices/P&L/holding-days; daily rows with no pnl as $0 rows | nulls + a `missing_fields` declaration on the response; daily rows without a pnl EXCLUDED with `daily_rows_excluded_missing_pnl` count — a fake $0 result can no longer be read as a real one |
| data-fetchers insider dates (2) | old `:1011` (live, now `fetchInsiderTransactions`) + `:1382` (deprecated Form4 XML) | `transactionDate ?? 'unknown'` — the string 'unknown' sorts ABOVE every ISO date, corrupting `latestTransactionDate` max | a transaction with neither transaction nor filing date is EXCLUDED; live path declares `insider-transactions PARTIAL: N excluded` on the `{data,error}` channel (pipeline E10 already surfaces it) |
| data-fetchers headline (1) | old `:2060` | an article with NO headline classified as 'neutral' confidence 1.0, diluting sentiment | skipped + `articles_skipped_no_headline` count on NewsSentimentData |
| data-fetchers candles (4) | old `:2181, :2190, :2191, :2193` | `time \|\| 0` → a 1970-dated candle; missing high/low imputed as the open; missing volume imputed 0 | a bar missing time/high/low/volume is MALFORMED → skipped + counted in `CandleBatchStats.malformed_candles` (declared, never patched) |
| quotes route (4) | `:50, :51, :52, :60-61` | `\|\| 0` on bid/ask/sizes/last/volume; a one-sided quote silently halved the mid | `numOrNull` everywhere; `mid` exists only when BOTH sides are live; true 0s preserved |
| sentiment (2) | `:295-296` (census `:288-289`) | stage-2 scoring failure persisted `score: 0, magnitude: 0` — indistinguishable from a real neutral | returns the existing DECLARED failure shape (`emptyResult` with an explicit error) |
| chains route (1) | `:86` | `strike: Number(x \|\| 0)` — a fabricated $0 strike | unparseable strike rows skipped + `strikes_skipped_no_price` declared on the response |
| custom-card (1) | strategy-builder `buildCustomCard` | a leg with no live price was silently DROPPED while the card kept the full strategy's name/pricing | any unpriceable leg fails the WHOLE card (null) — consistent with the KILL-2 greeks rule; zero in-repo callers |

## The two gray rulings (from what the code distinguishes)

**(a) zero-volume → 50:** the flow metric is `volumeRatio = vol5d / vol20d`, guarded by `vol20d > 0`. A REAL 20-day zero-volume reading makes the ratio **n/0 — mathematically undefined**, so the component is EXCLUDED (renormalized by the KILL-6 technicals combiner), never a neutral 50. The genuine-zero datum that IS computable — `vol5d = 0` over a positive `vol20d` → ratio 0 → low-volume tier — stays. Trace: 25 zero-volume candles → `volume_score: null`, formula `0.15×Vol(EXCLUDED) … [volume+high52w excluded, weights renormalized ÷0.7]`, declared in excluded_fields.

**(b) hv-accel z vs assumed mean 0:** sector-stats held NO hv_accel distribution (only hv30/hv60 levels) but holds the raw peer data — so per the EDGE-4 precedent the REAL distribution is now computed (`hv_accel: computeMetricStats(t.hv30 − t.hv60)` in `sector-stats.ts`), and vol-edge's z uses its real mean/std (the old code used mean **0** against the peers' hv30-LEVEL std — two fabrications at once). The percentile branch had the same disease (ranked the accel VALUE against hv30 LEVELS) — also moved to the real `hv_accel` sortedValues. No distribution → no transform; the component keeps its raw own-data tier score (real HVs). Trace: peers with accel spreads [-2,1,2,5,5] → mean 2.2, std 2.95 → `hv_accel_z = 0.95` = (5−2.2)/2.95, hand-verified.

## The backtest ruling

A backtest reporting $0 where data was missing is a fake result: the honest shape is null + declaration at the trade level (`missing_fields`) and EXCLUSION at the row level (`daily_rows_excluded_missing_pnl`) — never a $0 row. Implemented exactly so; the response shape is additive (no consumer breaks; no in-repo consumer reads the simulate response fields numerically today).

## Legitimate survivors near the edits (cited, unchanged)

`chains/route.ts:45` `dte_min ?? 0` — request-parameter default (0 = no lower DTE bound), not market data. `data-fetchers:983` `form ?? 'unknown'` — a filing-TYPE display label in a trace, never aggregated (the censused violations were the DATE sites, fixed).

## FINAL RECONCILIATION

**145 census violations → 145 closed by KILL-1..7 → 0 REMAIN.** Every one of the 103 pattern rows and 42 silent-catch rows in audit-reports/FALLBACK-CENSUS.md is accounted for across KILL-1 (1), KILL-2 (24), KILL-3 (34), KILL-4 (42), KILL-5 (8), KILL-6 (12), KILL-7 (22 + the two gray rulings), verified site-by-site against the census extraction — no row claimed closed without a cited fix. The census GRAY column (101 rows) remains open for Alex's product rulings except the two ruled here and those already settled by standing rulings (true-0, missing≠0).

## Verification

Tripwire on added lines: clean (no `\|\| n` / `?? n` value defaults; the only nearby matches are the two cited legitimate survivors, both pre-existing). Executed traces per cluster above; route clusters verified by code-path (they require live TT/backtester sessions). `tsc` exit 0; `next build` compiled successfully (standing sandbox Plaid-env limit unrelated). No route/auth changes, nothing in PUBLIC_PATHS.
