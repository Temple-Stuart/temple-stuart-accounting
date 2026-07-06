# KILL-2 Audit — ingestion-boundary imputation kill (pre-implementation findings)

**Date:** 2026-07-06 · **Branch:** `claude/kill-2-ingestion-imputation-kill` · **Base:** main @ `bb3655bf` (KILL-1 `788efb0c` verified present)

Pre-change citations (main @ bb3655bf).

## Site 1 — scanner/pipeline parse boundary

- `src/app/api/tastytrade/scanner/route.ts:222-224` — `ivRank: Number(m['implied-volatility-index-rank'] || … || 0)`, `ivPercentile: Number(m['implied-volatility-percentile'] || 0)`, `impliedVolatility: Number(m['implied-volatility-index'] || 0)`; the route then **sorts the universe by ivRank** (`:265`) — a missing rank ranked the ticker at 0.
- `src/lib/convergence/pipeline.ts:272-279` — identical imputation in `parseMarketMetrics`, whose output reaches vol-edge scoring (IVR component scored the imputed 0 as a real worst-rank via `clamp(0,0,100)`), peer stats (`sector-stats.ts:117`), the chain-input guard (an imputed 0 IVP slipped past the `== null` check at `:1567` as "rank 0"), and **scan_snapshots** (`:1960` → `snapshot-logger.ts:36`) — EDGE-5 would have measured imputations.
- Falsy-zero footgun both places: a source numeric 0 fell through `||` (missing and true-0 indistinguishable); `pre-filter.ts:33-34` carried a `> 0` workaround that discarded true zeros.

## Site 2 — greeks route ingestion

- `src/app/api/tastytrade/greeks/route.ts:57-75` — every Greeks/Quote/Trade/Summary field `Number(x || 0)`. DXFeed "NaN" strings additionally leaked `NaN` (`Number('NaN' || 0) === NaN`). Consumer: `src/app/trading/page.tsx:191/384` stores `ttGreeksData` — not currently rendered anywhere (display-dead), so nulls are trivially safe.

## Site 3 — chain-fetcher ingestion + strategy builder

- `src/lib/convergence/chain-fetcher.ts:273-291` — same `Number(x || 0)` block. Blast radius: `buildStrikeData` (`strategy-builder.ts:1061-1115`) maps `cg.delta ?? null` — dead code against imputed 0s (absent arrived as 0, not undefined).
- **EDGE-1 neutralized quote-zeros** (`strategy-builder.ts:1071-1074`: `bid > 0 && ask > 0` nulls both sides) — but greeks/volume/OI zeros leaked:
  - `makeLeg` `?? 0` (`:426-429`) → an imputed 0 delta inflated credit PoP toward 1 (`:539-541`), zeroed debit PoP (`:546`), skewed three-outcome EV deltas (`:872-873`), zeroed `thetaEff` in composite ranking (`:1037`), and a 0-delta strike could even WIN low-delta strike selection (`findByDelta:352-369` picks nearest |delta| to targets as low as 0.10).
  - Flow totals (`chain-fetcher.ts:475-478`) summed missing volume/OI as real 0s into put/call ratio, volume bias, and unusual-activity ratio (census GRAY-3, settled by standing ruling: missing ≠ 0).

## Standing-ruling application (true 0 vs absent)

`Number(x || 0)` cannot distinguish them. Fix: shared `numOrNull`/`firstNumOrNull` (`src/lib/parse-num.ts`) — absent/unparseable/non-finite → null; a real 0 (number or "0.0") stays 0. Verified by executed trace.

## Fix summary (per site)

1. Parse boundary → null; scanner ranking excludes null-rank tickers with `excluded_missing_iv_rank {count, symbols}` declared; `TTScannerData` iv fields nullable; pre-filter `> 0` workaround removed (true 0 scores as data); snapshots log null.
2. Greeks route → null per field (incl. NaN kill).
3. Chain-fetcher → null per field; `makeLeg`/`buildCustomCard` refuse legs without complete greeks, declared via the EDGE-1 rejection surface (`missing_greeks`); flow totals exclude nulls with `volume_fields_missing`/`oi_fields_missing` coverage on `OptionsFlowData`; vol-edge GEX skips null-OI strikes; pipeline chain build declares IVP-null skips in `data_gaps`.

Out of scope (unchanged, tracked in FALLBACK-CENSUS): `iv30 ?? 30`/`hv30 ?? 25` (pipeline:1581-2, Section-2 open item), scanner's other `parseFloat(x) || null` fields (GRAY-1), filter-engine pass-open behavior (GRAY-2).

## Verification

Tripwire grep on all added lines: no `|| <n>`, `?? <n>`, or literal score assignments introduced. Executed traces: missing → null → excluded → declared (strategy declaration renders verbatim; greeks-less strike used in no leg); true 0 → survives as 0 (pre-filter scores a real 0-rank; `numOrNull(0) === 0`). `tsc` exit 0; `next build` compiled successfully (sandbox Plaid-env page-data failure unrelated).
