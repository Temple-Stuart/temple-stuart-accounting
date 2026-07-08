# EDGE-7a — forward estimate revisions → quality gate: **STOPPED at Phase 1** (signal not computable from fetched data)

**Date:** 2026-07-08 · **Branch:** `claude/edge-7a-forward-revisions-quality` · **Base:** main @ `9eca0ebf` (includes EDGE-6 `2cbf2ed4`) · **AUDIT ONLY — no code changed, no signal wired**

**Verdict up front:** the mandate's own tripwire fired. STRATEGY-EVIDENCE rules that the
valuable form of this signal is the **REVISION** — the rate-of-change of the analyst
consensus for the *same* fiscal period across calendar time — not the estimate level. The
codebase fetches only **current-consensus snapshots per future period**, with no prior value
to diff against and no stored history. That is the mandate's **case (c): NOT computable —
STOP and report** rather than fabricate a baseline. Nothing was built.

---

## 1. What is actually fetched (read, cited)

### Forward EBITDA / EBIT estimates — fetched, diagnostics-only (confirmed)
- Fetchers: `fetchFinnhubEbitdaEstimates` (`src/lib/convergence/data-fetchers.ts:2396-2423`)
  hits `https://finnhub.io/api/v1/stock/ebitda-estimate?symbol=…&freq=quarterly` and parses
  each entry to `{ period, ebitdaAvg, ebitdaHigh, ebitdaLow, numberAnalysts }`
  (`data-fetchers.ts:2411-2417`); `fetchFinnhubEbitEstimates` (`data-fetchers.ts:2427+`) is
  the EBIT twin. Types: `FinnhubEbitdaEstimateEntry` (`types.ts:1332-1338`),
  `FinnhubEbitEstimateEntry` (`types.ts:1345-1351`).
- Landing site — the Step I diagnostics object, exactly as DATA-UTILIZATION-AUDIT said:

  ```
  pipeline.ts:1094  ebitda_estimates: ebitdaEstimateMap.get(symbol)?.estimates?.slice(0, 4) ?? null,
  pipeline.ts:1095  ebitda_estimate_count: ebitdaEstimateMap.get(symbol)?.estimates?.length ?? null,
  pipeline.ts:1096  ebit_estimates: ebitEstimateMap.get(symbol)?.estimates?.slice(0, 4) ?? null,
  pipeline.ts:1097  ebit_estimate_count: ebitEstimateMap.get(symbol)?.estimates?.length ?? null,
  ```

  Diagnostics payload only — never enters `ConvergenceInput`, never scored. So the "already
  fetched, $0" premise **holds**; no new fetch would be needed *if* the signal were computable.

### The other estimate objects (checked so nothing was missed)
- `ConvergenceInput.finnhubEstimates: FinnhubEstimateData` (`types.ts:113-121`) carries
  `epsEstimates: FinnhubEpsEstimate[]` and `revenueEstimates: FinnhubRevenueEstimate[]` —
  each entry is `{ epsAvg/revenueAvg, High, Low, numberAnalysts, period, quarter, year }`
  (`types.ts:75-93`). Same shape: the **current** consensus for several **future** periods.
- `upgradeDowngrade` (`types.ts:117`) is a revision-of-*ratings* stream — already wired into
  info-edge's `upgrade_downgrade_signal`; it is not an estimate revision and not this signal.

## 2. Why the revision is NOT computable (the three cases, ruled)

A revision is `consensus(period P, observed at t) − consensus(period P, observed at t−Δ)`.
Checking the mandate's three cases against what §1 proves is available:

| case | requirement | present? |
|---|---|---|
| (a) revision/delta directly reported | a change field in the feed | **No** — the fetchers parse `{period, avg, high, low, numberAnalysts}` only; the endpoint reports current consensus per period, no delta field is parsed or persisted |
| (b) a prior estimate to diff | any stored history of the same period's consensus | **No** — estimates are not in `ConvergenceInput`, not in `scan_snapshots` (they die in the Step I diagnostics payload, `pipeline.ts:1094-1097`); the system stores no estimate observations across runs |
| (c) single current observation, no baseline | — | **Yes — this is the situation.** Multiple *periods*, but only ONE observation in *time* per period |

Two tempting substitutes were considered and rejected as fabrication/double-counting:
- **Cross-period slope** (Q+1 avg vs Q+2 avg): that is the market's *expected growth
  trajectory*, not a revision. Labeling it "revision" would fabricate the signal the
  evidence actually endorses. Rejected (tripwire).
- **Forward estimate vs trailing actual**: an estimate-*level* signal — already partially
  represented in info-edge's analyst consensus (`estimate_level_score`,
  `revenue_eps_alignment_score`, `types.ts:855-878`). Not a revision; re-wiring it into
  quality would double-count an existing signal. Rejected (reuse-over-rebuild).

## 3. What the signal WOULD have joined (Phase 1 item 2, for the record)

The quality gate composite (`quality-gate.ts:1114-1119`) combines four sections through the
KILL-3 renormalizing `combineWeighted` (`weighted-combiner.ts:24-32`):
**safety 0.40** (`:440, :1115`) · **profitability 0.30** (`:809, :1116`) · **growth 0.15**
(`:905-908, :917, :1117`) · **fundamentalRisk 0.15** (`:1053-1056, :1065, :1118`), each
section itself a renormalizing sub-composite. A forward-revision sub-signal would most
naturally have joined the growth section (or a small standalone component per the EDGE-6
"modest weight until EDGE-5 grades it" pattern). Direction ruling (had it been computable):
rising estimates → higher quality score; missing → null → excluded → renormalized, N/M
declaration incremented. **None of this was built.**

## 4. Citation note (truth-first)

The task prompt cites "STRATEGY-EVIDENCE §7 — forward estimate revisions carry real
signal." In the committed `audit-reports/STRATEGY-EVIDENCE.md`, §7 is **Sizing**; forward
estimate revisions appear in **§4** (WIRE table: "analyst-revision momentum is an
established quality/forward-risk input" → quality) and **§9 Stage 2**. The quoted phrase is
not verbatim in the doc. The substance — revisions → quality gate — is unchanged; the
section pointer is corrected here so the trail stays accurate.

## 5. Options for Alex (proposal — nothing scheduled)

- **7a-α — make revisions computable honestly (persistence path):** start persisting the
  per-run consensus (symbol, period, avg, numberAnalysts, observed_at) — a small table or an
  extension of the scan-run persistence. **Migration = Alex's gate (psql), per the
  constitution.** Revisions become computable once ≥2 observations exist for the same
  symbol+period, suitably spaced; until then the sub-signal is **null + declared** (fail-loud,
  no baseline invented). EDGE-7a then builds exactly per this mandate.
- **7a-β — skip the revision signal** and proceed with the other Stage-2 items from
  STRATEGY-EVIDENCE §9 (filing-NLP sentiment, earnings-call tone, FDA/earnings event-avoid
  flag), which need no historical baseline.
- Entitlement is not at issue: the EBITDA/EBIT estimate endpoints already return data in
  production fetches (they are parsed and displayed today), so they are in-plan.

## One-paragraph summary

The premise "already fetched" is TRUE — forward EBITDA/EBIT consensus is pulled every run
and dies in a diagnostics payload (`pipeline.ts:1094-1097`). But the evidence-endorsed signal
is the **revision**, and computing a revision requires a prior observation of the same
period's consensus, which no fetched feed and no stored table provides — only current
snapshots of future periods exist. Deriving a "revision" from cross-period slopes or
level-vs-actual comparisons would be fabricating a different signal under the endorsed
signal's name, exactly what the fallback tripwire forbids. So EDGE-7a stops at Phase 1 with
this audit as the paper trail; the honest unlock is 7a-α (persist consensus observations,
then diff — with the sub-signal declared null until real history accumulates), and the
alternative is 7a-β (skip to the Stage-2 signals that need no history).
