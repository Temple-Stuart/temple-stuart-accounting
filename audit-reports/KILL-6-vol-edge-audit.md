# KILL-6 Audit — vol-edge imputation kill (the last live-scoring-path cluster)

**Date:** 2026-07-06 · **Branch:** `claude/kill-6-vol-edge-kill` · **Base:** main @ `9902d94f` (KILL-5 `7e71ce42` verified present)

## Classification of the 12 rows (verified verbatim on base; census line refs)

| Site (base line) | Code | Verdict | Evidence |
|---|---|---|---|
| :270 `ivp !== null ? clamp(ivp,0,100) : 40` | penalty on missing IVP | **DIES** | assigned because missing; entered mispricing at 0.30 (via IVComposite) |
| :276 `ivHvSpreadScoreRaw = 40` | penalty on missing spread | **DIES** | entered at 0.25 |
| :282 `hvAccelScoreRaw = 40` | penalty on missing HV60/90 | **DIES** | entered at 0.15 |
| :452 term `<2 exps → score 40` | penalty on missing term structure | **DIES** → section EXCLUDED + gate renormalizes | the 40 entered at 0.25 gate weight |
| :610/:615 technicals `<20 sanitized → 40` | penalty; REACHABLE (raw ≥20 but sanitized <20 — the caller checked raw length) | **DIES** → section EXCLUDED; scoreVolEdge now always delegates to scoreTechnicals' own exclusion | closed the raw-vs-sanitized gap the census flagged as untracked |
| :703 `high52wScore = 40` | penalty on missing Finnhub 52-wk | **DIES** → component excluded, technicals renormalizes ÷0.85 |
| :768 skew no-chain `50` | trace value (already weight-excluded by caller) | **DIES as display** — trace now reads EXCLUDED/0, never a fabricated neutral 50 |
| :784 skew no-7DTE-exp `50` | **imputed-on-missing** — the ruling the mandate asked for: the code computes NOTHING here (`vol_skew_25d: null, pc_iv_ratio_atm: null`); the 50 exists only because the inputs are absent. Not a thin-data neutral. | **DIES** → EXCLUDED at live weight |
| :875 skew neither-metric `50` | same — no per-strike IV delivered for either metric | **DIES** → EXCLUDED. **STAYS, cited:** the single-metric paths (one of volSkew/PCR present → score from that metric, labeled in the formula) — computed from present data |
| :930 gex no-chain `50` | trace value (weight-excluded by caller) | **DIES as display** — EXCLUDED trace |
| :940 `(treasury10y ?? 4.5)/100` | hardcoded rate over a fetched series | **DIES** — see rate finding |
| :1024 gex flip-null `50` | `distanceToFlipPct` null only when NO strike had usable OI+IV — inputs missing | **DIES** → EXCLUDED |

**The rate finding:** we DO fetch a real risk-free series — `treasury10y` = FRED **DGS10** (`data-fetchers.ts:598`), already consumed by the regime gate. The `?? 4.5` silently priced BS gamma off a hardcoded rate whenever the fetch failed. Now: real DGS10 consumed (recorded in the trace inputs); DGS10 null → GEX EXCLUDED with a formula stating exactly why — never 4.5.

**Other STAYS (cited):** hvAccel FLAT=50 (:301, real HV tier), term fixed-tier 50 (:558, real slope), trend/bollinger/volume 50 initializers (:678/:698/:710 — dead behind the ≥20-sanitized-candle guarantee; volume's zero-volume case remains the census GRAY pending Alex), skew metric initializers (:893/:900 — now unreachable as defaults), RSI 55 neutral band (real RSI), display thresholds (:939), hv_accel peer-mean-0 z (census GRAY, untouched), `percentileRank` empty→50 (guarded-unreachable).

## Combiner state + conversion

Pre-KILL-6, `scoreVolEdge` was a hand-written branch tree over (hasCandles × hasChainData) with manual renormalization — correct for whole-section chain/candle absence but blind to every other exclusion combination. Converted to the shared `combineWeighted` over the five sections (0.40/0.25/0.15/0.10/0.10), each section declaring its own computability via `active_signal_count` (KILL-3 pattern); mispricing/technicals additionally combine their own components. All five sections excluded → fail-loud throw (`scan_snapshots.volEdgeScore` is non-nullable — gate exclusion is a migration, flagged). DataConfidence is now fully trace-derived: `imputed_fields: []` (nothing is imputed anywhere in vol-edge), `excluded_fields` from the traces, `active_signal_count` N/M unchanged in shape (EDGE-4 already exposed it to the pipeline detail + UI Conf line).

## Blast radius

Consumers verified: pipeline `vol_edge_detail` reads score/weight/formula (numbers; excluded sections show 0-weight + EXCLUDED formula — the established vol-edge display); `chainInputs`/snapshot `spotPrice` read `technicals.indicators.latest_close` (null on excluded trace — both already guarded); `TechnicalsTrace.sub_scores` and `iv_composite_score` made nullable in types; trade-cards/UI render from formula strings and null-guarded fields. No consumer coerces null to a number.

## Verification

Executed traces: many-feeds-missing ticker → vol-edge = 75 from the one present component (IV_HV), mispricing weight renormalized to 1.0, all seven exclusions declared, **N/M 1/8**, `imputed_fields` empty; **true-0 IVP scores as a real lowest-percentile value** (not excluded); GEX with a live chain + DGS10 null → EXCLUDED with the DGS10 formula, with DGS10=4.2 → score 85 and `risk_free_rate: 4.2` recorded; all-five-missing → throws the KILL-6 message. Remaining `= 40/50` literals in the file are all real-data tiers or dead initializers (each cited above). Tripwire on added lines: the only `??` is `(active_signal_count ?? 1)` — a type-level presence check (every vol-edge trace now sets the field explicitly); no value defaults. `tsc` exit 0; `next build` compiled successfully (standing sandbox Plaid-env limit unrelated).

## Updated reconciliation

**145 census violations → 123 closed by KILL-1..6 → 22 remained, ALL CLOSED by KILL-7** (see audit-reports/KILL-7-peripheral-census-audit.md). **Final: 145/145 closed, 0 remain.**
