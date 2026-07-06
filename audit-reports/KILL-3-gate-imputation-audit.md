# KILL-3 Audit — gate-level imputation kill (pre-implementation classification)

**Date:** 2026-07-06 · **Branch:** `claude/kill-3-gate-imputation-kill` · **Base:** main @ `5fc6becc` (KILL-2 `13bbba34` verified present)

All 34 census violation rows verified on base; pre-change citations below. Classification per the EDGE-2b distinction: assigned-because-missing DIES; computed-from-present-data STAYS.

## DIES (34 sites — all verified verbatim on base)

**regime.ts (11):** `if (v === null) return 50;` in all 11 normalize functions (`:63, :70, :77, :84, :92, :100, :107, :114, :121, :128, :136`) — imputed neutral 50s entered the growth composite (fixed weights `:159-162`) and inflation composite (`:188-191`), tracked as imputed (`:631-641`) but never excluded.

**quality-gate.ts (22):** `let x = 40/50/60;` assigned before the null-guard in every component — safety `:42` liq / `:50` mktcap / `:74` **lendability 60 (favorable AND untracked)** / `:84` beta / `:96` D/E; profitability `:509` margin / `:520` ROE / `:532` ROA / `:567` ROIC(50) / `:579` PE / `:595` PS(50) / `:611` EV-EBITDA(50) / `:638` FCF / `:649` surpriseConsistency / `:650` dteScore / `:651` **beatRate = 0 (worst-case fabrication, untracked)**; growth `:841/:852/:863` (div-growth systematically penalized non-payers 40); fundamentalRisk `:908/:984/:1003`. All entered fixed-weight composites (`:374-390, :768-772, :871-874, :1012-1015`).

**info-edge.ts (1):** `:1304` `totalHits ?? 0` — unparseable EDGAR hit count imputed as "0 material events" → score 65, the most bullish tier, undeclared.

## STAYS (legitimate, each verified)

- regime `baselineScore` sigmoid (50 at the series median) — computed from a PRESENT value.
- regime ancillary signals (`:492-535`) — already null-honest, audit-only.
- regime VIX overlay / corrSpy modifier null handling — census GRAYs, awaiting Alex's ruling, untouched.
- quality volume `= 40` old default — dead code (the exclusion branch `:380-390` always renormalized volume out; generalized by this PR).
- lendability `= 55` for a present-but-unrecognized string (`:79`) — real data, middle band.
- dteScore/beat-rate/tier bands assigned inside `if (value !== null)` — real-data tiers.
- Piotroski null-signal handling (computable-only ratio, modifier 0 = not-applied) and EQ ensemble `unavailable` no-op — modifiers that self-disable, declared in their traces.
- Altman-Z metric proxies — census GRAY, untouched pending ruling.
- borrow-rate penalty `(borrowRate ?? 0)*0.8` — penalty-not-applied on missing (modifier no-op), unchanged (censused GRAY-adjacent, not in the kill list).

## Combiner conversion

- **Precedent:** info-edge's EDGE-2 array combiner (`info-edge.ts:1313-1334`) and vol-edge's EDGE-4 component array. Extracted as shared `src/lib/convergence/weighted-combiner.ts` (`combineWeighted`).
- **regime:** normalize fns → `number | null`; growth/inflation are combiner composites (excluded series renormalize); ALL-series-missing on either side → **fail-loud throw** (declared via the pipeline's per-ticker catch into `errors[]`) because `scan_snapshots.regimeScore` is a non-nullable Float — gate-level exclusion is a migration, flagged for Alex.
- **quality:** every component nullable; each section is a combiner composite; a zero-component section is EXCLUDED with weight 0 + EXCLUDED formula (vol-edge precedent) and the gate renormalizes 0.40/0.30/0.15/0.15 over active sections; all four empty → fail-loud throw (same `qualityScore` migration note). Modifiers (Altman cap, borrow penalty, HHI, F-Score, EQ ensemble) apply only to computed scores.
- **N/M declarations:** both gates' DataConfidence now carry `excluded_fields` (derived from the combiners — no drift) + `active_signal_count` (regime 14 total; quality 23 total — was 21 with lendability and beat_rate untracked); pipeline `quality_detail`/`regime_detail` expose them; the UI drill Conf lines render "computed from N/M signals" (same surface as info-edge/vol-edge).

## Consumers (blast radius)

Trace sub_scores → `number | null` in types; consumers verified: UI beat_rate displays all null-guard (`?? '—'`, `!= null`); trade-cards computes beat_rate from `beats/total_quarters` behind a `totalQuarters < 2 → null` guard; pipeline detail rows read section `score`/`weight` (numbers — excluded sections show 0 / weight 0 with EXCLUDED formula); snapshots store the trace JSON with nulls preserved; `borrow_rate_adjustment.score_before_penalty` → nullable. No consumer coerces null back into a number (tripwire grep on the diff: the only `?? 0` added is a presence check that can only exclude, never impute).

## Verification

Executed traces: many-missing ticker → quality gate scored 75 from safety-only (weight renormalized to 1.0, sections 0-weight EXCLUDED, N/M 2/23, lendability null not 60, beat_rate null not 0); regime scored from 4/14 present series (excluded list exact); all-macro-missing → throws the KILL-3 message; `totalHits: null` → material_event_flag null + auto-declared in excluded_fields. Remaining `= 50/= 60/...` literals in both files are all inside `if (value !== null)` real-data tiers. `tsc` exit 0; `next build` compiled successfully (standing sandbox Plaid-env page-data failure unrelated).
