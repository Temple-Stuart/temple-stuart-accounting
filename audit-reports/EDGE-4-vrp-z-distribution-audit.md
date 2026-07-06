# EDGE-4 Audit — VRP z-score against a fabricated zero-mean distribution

**Date:** 2026-07-06 · **Branch:** `claude/edge-4-vrp-z-distribution-v6e6da` · **Base:** main @ `21be16bb` (EDGE-2b `0a31a93f` and EDGE-3 `7d73ae1a` verified present)

Read-only audit performed BEFORE implementation. All citations are pre-change `file:line`.

## Defect

| Item | Evidence |
|---|---|
| Fabricated mean | `src/lib/convergence/vol-edge.ts:185` — `zScore(vrp, 0, ivHvStats.std * 100)`: z-score of VRP against mean **0** instead of any real distribution |
| Proxy distribution | `src/lib/convergence/vol-edge.ts:184` — comment admits it: "use iv_hv_spread stats as proxy for VRP distribution" (peer stats, not the ticker's own history) |
| Peer-proxy percentile | `src/lib/convergence/vol-edge.ts:300-302` — VRP percentile-ranked against **peer** `iv_hv_spread` sorted values, not its own history |
| Consumed by | `vol-edge.ts:319-320` (z-fallback → score), `:348` (0.30 weight in mispricing), `:374` (formula string), UI `ConvergenceIntelligence.tsx:521,534-537` and `:1218,1241-1244` |
| UI/code drift | `ConvergenceIntelligence.tsx:1242` tooltip already **claimed** "standard deviations … above its 12-month average" — the code never did that. Violation of the no-drift mandate (UI shows ≠ what fires) |

## The ×100 unit claim — VERIFIED (internal consistency)

- `vrp = iv30 − hv30` (`vol-edge.ts:224`); `iv30`/`hv30`/`ivHvSpread` come from TastyTrade `implied-volatility-30-day` / `historical-volatility-30-day` / `iv-hv-30-day-difference` with **no unit transform** (`pipeline.ts:282-286`, `scanner/route.ts:229-233`).
- Peer `iv_hv_spread` stats are built from the same untransformed `t.ivHvSpread` (`sector-stats.ts:118`).
- The codebase treats all three as **percentage points**: `(tt.iv30 ?? 30) / 100` converts to decimal (`pipeline.ts:1547`); "20-point diff → score 100" (`vol-edge.ts:239-244`); spread printed as e.g. "5.5" (`pipeline.ts:482`); `(|ivHvSpread|/20)×100` (`pipeline.ts:2158`).
- Therefore `vrp` and the peer std are the **same units**, and `std * 100` inflated the divisor ~100×, compressing every vrp_z toward 0 (a true z of 2.0 reported as ~0.02).
- Caveat (truth-first): the absolute unit of the raw TastyTrade response is **not verified** from this repo (no raw sample captured). The ×100 is wrong under either unit hypothesis (if `vrp` were decimal and the spread points, the *value* would need scaling, not the std). The line is removed entirely either way.

## Distribution-source ruling

Preference order per mandate:

1. **TastyTrade native VRP / IV-HV percentile — RULED OUT.** Every field the app receives from market-metrics is enumerated in the two parsers (`scanner/route.ts:218-261`, `pipeline.ts:269-315`): `implied-volatility-percentile` is the IV *level* percentile, `iv-hv-30-day-difference` is the current spread *level*. No VRP/IV-HV **distribution** or percentile field exists anywhere in the codebase, and existence cannot be verified against the live API from this environment → **not verified ⇒ not usable**.
2. **Self-computed own-history series — RULED IN.** `scan_snapshots` stores `iv30`/`hv30` per ticker per scan (`prisma/schema.prisma:1771-1774`), written for **all** scored tickers on every pipeline run (`pipeline.ts:1919-1931` → `snapshot-logger.ts:33-34`). Series: one VRP obs (iv30 − hv30) per **distinct scan day**, **365-day** window, **minimum 20 distinct days**. **Label:** `calculated: percentile of VRP vs own N-obs history, 365d, source: scan_snapshots`.
3. **Neither → null**, excluded from the mispricing composite, remaining weights renormalized (EDGE-2 combiner pattern). NO proxy mean, NO default std, NO reversion to mean=0.

## Blast radius of the change

- `vol-edge.ts` — computeZScores (vrp_z now own-history), scoreMispricing (VRP percentile from own history only; raw linear map and 40-penalty for VRP removed; exclusion+renormalization combiner), scoreVolEdge DataConfidence (`excluded_fields` + `active_signal_count`).
- `types.ts` — `VrpHistoryData`, `ConvergenceInput.vrpHistory`, `MispricingTrace.vrp_score` + `z_scores.vrp_z_source`.
- `snapshot-logger.ts` — `fetchVrpHistoryBatch()` (user-scoped `WHERE userId = ?`, ticker IN, 365d, iv30/hv30 non-null; errors PROPAGATE, never swallowed).
- `pipeline.ts` — Step E12 fetch (failure → loud `errors[]` + `data_gaps[]`, outcome = exclusion, never substitution), `vrpHistory` in all 4 ConvergenceInput assembly sites, `vol_edge_detail.active_signal_count/total_signal_count`.
- `ConvergenceIntelligence.tsx` — vrp_z tooltip now describes what actually fires; vol-edge Conf line gains "computed from N/M signals".
- Untouched (separate concepts): `pipeline.ts:2216` variance-form VRP display string; hv_accel/IVP/IV-HV peer transforms; term-structure/technicals penalty defaults (EDGE-2b scope note).

## Security / gates

No route changes, nothing in PUBLIC_PATHS, no new external fetches. The only new query is Prisma against `scan_snapshots`, user-scoped by `userId`. No migration (schema untouched — columns already exist).
