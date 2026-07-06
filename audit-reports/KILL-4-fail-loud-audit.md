# KILL-4 Audit — fail-loud restoration: the 42 silent-swallow catches

**Date:** 2026-07-06 · **Branch:** `claude/kill-4-fail-loud-catches` · **Base:** main @ `5be860a5` (KILL-3 `267de2c0` verified present)

All 42 census (c)-rows verified on base and classified. **(a) rethrow: 0** — every swallow guards a per-item/per-feed step inside a larger run where aborting the whole scan on one symbol's feed failure would be worse than declaring; the honest fix everywhere is **(b) declare** with an explicit failure marker. **(b): 40 · (c) justified: 2.**

## (b) DECLARED — 40 sites

| Cluster | Sites (census refs) | Fix |
|---|---|---|
| pipeline enrichment loops (9) | :769-:912 (`<map>.set(symbol, null)` on throw) | Each catch now mirrors its loop's `result.error` declaration: null still flows to the KILL-2/3 exclusion machinery, and `errors[]` gets `Step EN (<feed> SYM) FAILED: <msg>` |
| pipeline peers (1) | :555 | Still degrades to GICS tier, but `errors[]` declares the degradation per symbol |
| pipeline 10-K text (1) | :929 | Declared in `errors[]` (enhancement, but no longer silent) |
| pipeline trade-cards (1) | :1872 | `errors[]` + `data_gaps` — an exception-emptied card list is now distinguishable from "no strategies passed" |
| Finnhub estimates (8) | :95-:98 fetch, :105/:116/:129/:140 parse (+ HTTP-not-ok branches) | New failure channel: `FinnhubEstimateData.feedErrors` |
| Finnhub ticker (5) | :199/:214/:231/:246/:253 (+ HTTP branches) | **`FinnhubData.feedErrors: string[]`** — the missing error channel the census called out; no-key case declares "all Finnhub feeds unavailable" |
| Finnhub batch | (bonus: the per-symbol batch catch) | `FinnhubBatchStats.error_messages` aggregates `SYM feed: msg`; the empty fallback shape carries `feedErrors` |
| quarterly statements (3) | :401-:403 `.catch(() => null)` | Named per-statement failures; all-empty returns `statement fetch FAILED — bs/ic/cf: …`; **partial data returns data + `PARTIAL:` error together** (pipeline E8 already pushes `result.error`) |
| institutional ownership (4) | :1730/:1731 fetch, :1742/:1749 parse | Same partial-declaration pattern (pipeline E6 pushes it) |
| SEC Form 4 (1) | :1257 per-filing skip | Skips counted; result carries `PARTIAL: N/M filing(s) failed — aggregates undercount` (zero in-repo callers, fixed for the export) |
| chain-fetcher per-ticker (1) | :446 | Empty cards now accompanied by a `strategy generation FAILED` rejection entry on the existing rejections surface |
| chain-fetcher fatal (1) | :531 | **`ChainFetchResult.fatal_error: string \| null`** — the typed failure; pipeline declares into `errors[]` + `data_gaps`; test route declares onto its rejections surface |
| balances / positions routes (2) | :47 / :51 | Responses gain `failed_accounts: [{account, error}]` — a failed account no longer vanishes from a 200 |
| scanner route (1) | :199 | Response gains `batch_errors` + `symbols_failed_count` — `totalScanned` no longer masquerades as coverage |
| convergence route (2) | :73 / :129 | User-lookup failure captured; `result.data_gaps` gains `snapshot_logging: SKIPPED — … no scan_snapshots audit trail` on both SSE and non-stream paths |

## (c) JUSTIFIED — 2 sites (inline comments added)

- `sentiment.ts:109` parseJSON catch — the null IS handled loudly by both callers (console.warn + declared failure); the lost parse detail is now console.warn'd in the catch.
- `sentiment.ts:165` `.catch(() => '')` — swallows only the failure to READ an error-response body for a log line; the HTTP failure itself is already declared with status.

Not in the 42 and unchanged: `data-fetchers.ts:904` (CIK helper null → callers' declared `{data:null, error}` results — census class (b) already).

## Failure-channel design (Phase 1 item 3)

`{data, error}` is the file's established fetcher convention — extended, not replaced: per-feed failures ride `feedErrors` (FinnhubData / FinnhubEstimateData), batch failures ride `stats.error_messages`, chain failures ride `fatal_error`, route failures ride response fields. Surfacing: pipeline pushes every feed failure into **`errors[]`** (capped at 50 + truncation notice) and a summary **`data_gaps`** entry (`finnhub: N feed failure(s) — affected signals excluded per gate (feed unavailable)…`); both are existing returned/rendered surfaces. Exclusion itself needs no new work — a failed feed produces null/[] which the KILL-2/KILL-3 combiners already exclude and count in the N/M declarations; KILL-4 adds the CAUSE.

## Forced-failure trace (executed)

Killed the Finnhub feed (no API key): `fetchFinnhubTicker('AAPL')` → `feedErrors: ['FINNHUB_API_KEY not configured — all Finnhub feeds unavailable']` with null/empty data; `fetchFinnhubBatch(['AAPL','MSFT'])` → `stats.error_messages` lists both symbols. From there the cited path: pipeline post-fetch block → `data_gaps` 'feed unavailable' declaration + `errors[]`; the null fundamentals/empty arrays flow into the KILL-3 combiners → components excluded → gate N/M drops → declared. Nothing imputed anywhere on the path.

## Tripwire + build

Grep of added lines for value defaults: clean — no `|| <n>` / `?? <n>` / literal score assignments (the only string coalesces are `?? 'unknown error'` on error MESSAGES, not data). `tsc` exit 0; `next build` → `✓ Compiled successfully` + types validated (standing sandbox limit: `PLAID_CLIENT_ID` unset on the unrelated admin Plaid route). No retries added, no route/auth changes, nothing in PUBLIC_PATHS.
