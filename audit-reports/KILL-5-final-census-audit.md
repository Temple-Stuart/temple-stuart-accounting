# KILL-5 Audit — final census kill + full reconciliation

**Date:** 2026-07-06 · **Branch:** `claude/kill-5-final-census-kill` · **Base:** main @ `27e0272a` (KILL-4 `38abe820` verified present)

## Phase 1 rulings (verified on base)

**1. `pipeline.ts:1630-31` `iv30 ?? 30 / hv30 ?? 25`** (+ `strategy-builder.ts:855` `?? 0.30`, `:870` `?? iv`, test route `:301-2`) — consumers post-KILL-2/3/4: iv → σ in every breakeven_d2 PoP + edgeRatio; hv → HV-adjusted credit PoP (`computeHvAdjustedPoP`), the unlimited-risk sizing proxy `hvProxyML`, edgeRatio. EDGE-3's HV10>IV gate confirmed independent (uses leg IVs + hv10). **Ruling: iv30 becomes REQUIRED-REAL** (`GenerateParams.iv30: number`; callers skip + declare — near-dead for the pipeline thanks to hard Filter 3, but the fabricated 30-vol path is gone); **hv30 becomes nullable**: hv-adjusted PoP → `hvPop = null` (declared field + run-level declaration), EV uses the card's own computed PoP (a real labeled statistic, not a substitute), unlimited-risk candidates are REJECTED with the true reason (never proxied), edgeRatio excluded → composite renormalizes 50/30 of 80.

**2. `probability.ts:56` missing q** — real source: TT market-metrics `dividend-yield` → `tt.dividendYield` (already fetched; **percentage points** — UI renders `toFixed(2) + '%'` at `ConvergenceIntelligence.tsx:579` — so q = value/100). **Ruling (from consumption):** PoP is a SCORED input (Gate B pass/fail, EV, composite ranking) — a silent q=0 assumption is a default on a scored path, so per Standing Ruling 2 it is not permitted. But full exclusion isn't needed either: the flow already contains an honest fallback statistic — the delta-approximation PoP every card starts with. **q present (incl. true 0 = real non-payer) → d2 drift is `r − q − σ²/2`; q absent → the breakeven_d2 UPGRADE IS SKIPPED**, PoP stays `delta_approx` (truthfully labeled by the existing `popMethod` field) and the run declares `dividend yield unavailable — … never assumed 0` on the rejections surface. `calcD2/probAbove/probBelow/probBetween` take a required `dividendYield` param — no default exists in the file.

**3. `info-edge.ts:74/:88/:102/:123` analyst_consensus internals** — all four imputed-on-missing defaults die (40/40/50/40 → null → excluded → renormalized via the shared EDGE-2 combiner). **Stays, cited:** the 50 at (old) `:117` for a KNOWN mixed direction — computed from two present growth directions, a genuine neutral band. `analyst_consensus` itself becomes nullable like the other nine sub-scores (all-components-missing → excluded from info-edge); the EDGE-2b under-declared `imputed_fields` block (`:1347-8` old) is replaced by trace-derived exclusions (`analyst_consensus.estimate_level` etc. — cannot drift); all-ten-signals-missing now fails loud (scan_snapshots.infoEdgeScore is non-nullable — gate exclusion is a migration, flagged). Consumers: pipeline `info_edge_detail` `?.score ?? null` (EDGE-2b UI renders '—'); trade-cards null-guards.

**4. `pipeline.ts:2315` display VRP `iv30² − hv30²`** — no rationale comment exists. **Ruling (3/5): one definition everywhere** — aligned to the simple difference `iv30 − hv30` the scorer uses (Goyal & Saretto 2009; vol-edge).

## FINAL CENSUS RECONCILIATION — the violations column

**145 total census violations → 123 closed by KILL-1..6 (81 pattern + all 42 silent catches) → 22 REMAIN** (updated by KILL-6), each below (none silently dropped):

| Remaining cluster | Sites | What it is |
|---|---|---|
| ~~vol-edge.ts (12)~~ **CLOSED by KILL-6** | :270, :276, :282, :452, :610, :703, :768, :784, :875, :930, :940, :1024 | all 12 converted to null → excluded → renormalized (see audit-reports/KILL-6-vol-edge-audit.md); the GEX rate now consumes the real fetched DGS10 or excludes |
| backtest/simulate route (7) | :79-:83, :87, :88 | missing backtester fields become $0 prices/P&L presented as results — backtest surface rework, own PR |
| data-fetchers.ts (7) | :1011, :1382, :2060, :2181, :2190, :2191, :2193 | insider `transactionDate ?? 'unknown'` corrupting date-max; missing headline imputed neutral into sentiment; candle `time \|\| 0` (1970 candle), high/low imputed as open, volume imputed 0 |
| quotes route (4) | :50, :51, :52, :60 | `\|\| 0` quote parse; one-sided quotes silently halve the mid |
| sentiment.ts (2) | :288, :289 | stage-2 scoring failure imputes score=0/magnitude=0 with no error field on the persisted result |
| chains route (1) | :86 | parse-boundary imputation |
| strategy-builder (1) | :1206 | buildCustomCard still silently drops missing-PRICE legs while naming the full strategy (the greeks half was fixed in KILL-2; also entangled with a census GRAY on custom-path EDGE-1 gating) |

KILL-6 candidates in priority order: vol-edge (scored path), data-fetchers candle/insider imputation (persisted/scored), quotes/chains/simulate (display+backtest surfaces), sentiment error channel, custom-card leg handling.

## Verification

Greps: no `?? 30 / ?? 25 / ?? 0.30 / ?? iv` remain outside kill-documentation comments; analyst penalty defaults gone. Tripwire on added lines: no value defaults (the flagged `?? 0` are a null-guarded display count and the pre-existing `maxLoss ?? 0` behind the `effectiveML > 0` compute guard). Executed trace: hv30+q present (q = **true 0**, non-payer) → breakeven_d2 PoP + hvPop computed; both ABSENT → PoP stays delta_approx (declared), unlimited-risk candidate rejected with the true reason (declared), zero fabricated values; `calcD2` with q=3% < q=0 confirms drift correction. `tsc` exit 0; `next build` compiled successfully (standing sandbox Plaid-env limit unrelated). No route/auth changes, nothing in PUBLIC_PATHS.
