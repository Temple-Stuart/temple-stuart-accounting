# STRATEGY-ROADMAP — where the convergence engine stands and the highest-value next move

**Date:** 2026-07-07 · **Branch:** `claude/strategy-roadmap` · **Base:** main @ `940185dd` · **DOCUMENTATION ONLY** (no code changed)

A synthesis, not new findings. Every claim traces to code on `main` or to a committed audit.
Source audits:
- `audit-reports/FALLBACK-CENSUS.md` — the 1,529-hit inventory and the 145-violation ledger.
- `audit-reports/DATA-UTILIZATION-AUDIT.md` — the paid-vs-scored map. **(Committed on branch
  `claude/data-utilization-audit`, pending merge — its underlying claims are re-cited here
  against the live source on `main` so every reference resolves.)**
- `audit-reports/EDGE-5-outcome-closer-audit.md` — the measurement instrument.
- The EDGE / KILL / MIG / SEC commit series on `main`.

---

## 1. Current state (verified, cited)

### Pipeline honesty — closed and hardened
The scoring path no longer imputes missing data. The `FALLBACK-CENSUS` inventoried **1,529
hits → 1,283 legitimate · 145 violations (103 pattern + 42 silent catches) · 101 gray**
(`FALLBACK-CENSUS.md:2446`), and the KILL series closed all 145 to zero, verified site-by-site:

| commit (on main) | what it closed |
|---|---|
| `788efb0c` KILL-1 | never fabricate a ledger close date — skip + declare |
| `13bbba34` KILL-2 | ingestion boundary: missing IV/greeks/quotes → null + declared, never 0 |
| `267de2c0` KILL-3 | gate-level imputation kill — regime + quality missing signals **excluded + renormalized** |
| `38abe820` KILL-4 | fail-loud: a failed fetch declares, never masquerades as empty |
| `7e71ce42` KILL-5 | no defaults in iv30/hv30, PoP dividend handling ruled, one VRP definition |
| `09496816` KILL-6 | vol-edge imputation kill — the last live-scoring-path violations |
| `0b0effd1` KILL-7 | peripheral census close — final 22 + the two gray rulings |
| `24374b04` MIG-1 | nullable gate scores — a fully-excluded gate records an **honest null**, not a number |

The security pass (`SEC-CHECK` `70e77c7b` → `SEC-1..5` `655573b1`/`6f75000c`/`b671c107`/`c7bce89e`/`b3b65435`)
then closed every CRITICAL/HIGH cross-user and shared-account finding. Net: the numbers the
engine produces are now honest (no fabricated inputs) and the surface is locked.

### The 4-gate architecture
`scoreAll` (`composite.ts`) combines four gates — **vol-edge, quality, regime, info-edge** —
via a renormalizing combiner (`src/lib/convergence/weighted-combiner.ts`): any component whose
feed is absent is dropped and the surviving weights renormalize, so a null never enters as a
neutral score. Each gate carries an **N/M "computed from N of M signals" declaration**
(DataConfidence: `imputed_fields`, `excluded_fields`, `active_signal_count`), and MIG-1 made
the gate-score snapshot columns nullable so a fully-excluded gate is recorded as null and the
composite renormalizes over the present gates (`MIG-1-nullable-gate-scores-audit.md`). What the
UI shows == what fires — the no-drift rule the census enforced.

### EDGE-5 — the measurement instrument, and its one gap
`closeSnapshotOutcomes` (`src/lib/convergence/outcome-tracker.ts`) is the outcome-closer: for a
scan snapshot past its horizon (`scanDate + suggestedDTE` days), it writes the realized outcome.
- **Measures now:** realized **spot** (TastyTrade daily candles, `data-fetchers.ts` — the close
  on the last trading day ≤ horizon, refused if staler than 5 days) and realized **IV**
  (TastyTrade market-metrics `implied-volatility-30-day`, valid only in a ≤5-day window after the
  horizon, else null + declared) → `ivCompressed = outcomeIV < iv30`, two unit-consistent real
  observations (`EDGE-5-outcome-closer-audit.md:18-19`).
- **Cannot measure yet:** `outcomePnl` is left **null and declared** — there is no integrated
  source of *historical option prices*, so realized option P&L cannot be computed honestly
  without improvising (`EDGE-5-outcome-closer-audit.md:20`). `stayedInRange` is likewise null (no
  expected-range field stored). This is the honest boundary of the measurement loop today.

**Bottom line for §1:** the engine is a fail-loud, exclusion-aware, self-declaring scorer with a
working spot/IV measurement instrument — and a known gap (realized option P&L) that gates how far
outcome-measurement can go until a historical-options-data source is ruled in.

---

## 2. Edge levers, ranked by cost (from DATA-UTILIZATION-AUDIT, re-cited to live source)

### TIER 1 — already fetched, computed, then dropped before scoring ($0, zero new API calls)

These are pulled every run and even computed, but die before the composite. Wiring them in is a
pure additive combiner change — no new API cost, no new fetch.

| lever | where it dies today (file:line) | gate it'd feed | why the prior is strong |
|---|---|---|---|
| **Fed net liquidity** (WALCL − WTREGEN − RRPONTSYD) | computed as an ancillary score then never put in the composite — `regime.ts:529-543` (`fedNetLiquidityScore`); surfaced in the breakdown only | **regime** | Net-liquidity is a first-order driver of risk-asset regimes; already fetched (WALCL/WTREGEN/RRPONTSYD) and already reduced to a single score — it's one wire away. |
| **VIX term structure (VIX ÷ VXV) + VVIX** | VIX/VXV ratio computed for display at `pipeline.ts:679`; VVIX (VXVCLS/VVIXCLS) fetched but referenced by no gate | **vol-edge** | Front-back vol slope (backwardation) and vol-of-vol are textbook vol-edge signals — directly on-theme for a gate that already scores term structure and skew. |
| **BBB credit spread / T10Y3M / dollar index** | ancillary "audit-only, not wired into composite" — `regime.ts:501-527` (breakdown only) | **regime** | Credit, curve and USD are established regime inputs; partly redundant with the already-scored HY spread (BAMLH0A0HYM2) and T10Y2Y, so weight modestly. |
| **Forward EBITDA / EBIT estimates** | fetched, land only in the pipeline diagnostics object — `pipeline.ts:1092-1095` (never in `ConvergenceInput`) | **quality** (forward EV/EBITDA) | Forward multiples complement the trailing valuation already in quality; already paid-for and fetched. |

Lower-value Tier-1 (fetched, diagnostics-only, largely redundant): dividend history and
price-metric (`pipeline.ts:1096-1097`, `:1011`) — quality already has `dividendGrowthRate5Y` and
vol-edge already has the 52-week ratio from `/stock/metric`, so incremental value is small.

### TIER 2 — unfetched Finnhub premium alt-data (new integration)

Never called anywhere in the codebase (verified by `git grep` in DATA-UTILIZATION-AUDIT §2).
Each maps cleanly onto a gate:

| endpoint | gate | rationale |
|---|---|---|
| `/stock/social-sentiment` (Reddit/X) | info-edge | retail-sentiment leg for the existing news_sentiment block |
| `/stock/congressional-trading` | info-edge | informed-flow signal alongside insider activity |
| `/stock/financials/sentiment` (filing NLP) | quality | management/MD&A tone as a forward-risk overlay |
| `/stock/earnings-call-transcripts` | info-edge | guidance & call tone (needs NLP to score) |
| `/stock/supply-chain` | quality | concentration/disruption risk; complements revenue-HHI |
| `/stock/usa-spending`, `/stock/lobbying` | info-edge | revenue-catalyst / regulatory positioning (sector-specific) |
| `/calendar/fda` | info-edge (material-event) | biotech catalyst dates, like the 8-K material-event leg |
| `/stock/visa-application`, `/stock/esg` | quality | hiring proxy / risk screen — noisy, lowest priority |

> ⚠️ **ENTITLEMENT UNVERIFIED — HARD FLAG.** DATA-UTILIZATION-AUDIT confirmed these are *not
> called* in the code; it did **not** verify they are included in the current Finnhub package
> tier. **Each must be confirmed in-plan before any wiring** — a paid call to an out-of-tier
> endpoint is a cost/entitlement surprise. Treat Tier-2 as "candidate," not "available," until
> the plan is checked.

---

## 3. The measurement discipline (the core principle)

**Utilization ≠ measured alpha.** DATA-UTILIZATION-AUDIT is a map of what we *use*, not proof of
what *works*. No signal earns a gate weight on its prior alone — the ranking in §2 is by
signal-type priors, explicitly "not measured/backtested alpha" (its own closing caveat).

The institutional method the codebase already implies:
1. **Wire the free Tier-1 signals** into their gates using the established fail-loud, exclusion-
   aware combiner (`weighted-combiner.ts`) — no imputation, N/M declared, exactly as KILL-3/6 and
   MIG-1 established.
2. **Let EDGE-5 measure.** Every scan writes a snapshot; the outcome-closer records realized spot
   and IV against the horizon. A signal proves itself against realized outcomes over a window, or
   it doesn't.
3. **Keep or kill by data,** not by narrative. A signal that doesn't move realized-outcome
   accuracy gets zero weight regardless of how good its prior sounded.
4. **Only then** evaluate Tier-2 — one endpoint at a time, same loop, so each new alt-data feed's
   marginal contribution is isolable rather than buried in a batch.

**Why this is the whole game (literature framing).** More signals is not more edge. Alt-data is
mostly noise; stacking feeds without measurement inflates variance and overfits — the classic
failure of a "wishlist" data strategy. What separates a real edge machine from a dashboard of
feeds is the measurement loop: honest inputs (the KILL series bought this), an honest scorer
(exclusion + renormalization, MIG-1), and an outcome instrument that grades predictions against
reality (EDGE-5). Signals earn weight by measured contribution, one at a time. The engine now has
all three pieces except the realized-P&L leg of the instrument — which is precisely why the P&L
data question (below) matters more than any new feed.

---

## 4. Proposed sequence (proposal — NOT committed work)

Labeled as a proposal for Alex to rule on; nothing here is scheduled.

- **EDGE-6 (proposed):** wire the Tier-1 *free* signals into their gates — fed net liquidity →
  regime; VIX/VXV + VVIX → vol-edge; BBB/T10Y3M/dollar → regime; forward EBITDA/EBIT → quality.
  Each is a fallback-free, exclusion-aware addition per the combiner pattern (a missing series
  drops its component and renormalizes — never a neutral default), one gate per PR to stay atomic
  and revertible per the constitution.
- **Measurement window (proposed):** after EDGE-6, run the scan + outcome-closer over a window so
  EDGE-5 accumulates realized spot/IV outcomes to grade the new signals. Keep/kill by the data.
- **Tier-2, one-at-a-time (proposed):** only after the free signals are measured, and only after
  the Finnhub entitlement check, evaluate premium alt-data endpoints individually through the same
  loop.

**Open carry-forwards (from the audit trail, not yet done):**
- **Historical-options-data question:** `outcomePnl` stays null until a source of historical
  option prices is ruled in (`EDGE-5-outcome-closer-audit.md:20`). Resolving this is the highest-
  leverage measurement upgrade — it turns the instrument from "did spot/IV move as predicted" into
  "did the *trade* make money."
- **SEC-6 cleanup (proposed, from SEC-CHECK's MEDIUM/nice-to-have tail):** the defensive-404
  cluster (routes returning 403 instead of 404 on foreign ids), an admin gate on
  `/api/audit-log/verify-chain`, the public-paid-travel decision (#14 — a ruling, not code), and
  reconciling stale docs that still reference the deleted `robinhood-parser.ts` (SEC-4).

---

## One-paragraph summary

**What's done:** the convergence engine is honest and locked — 145/145 imputation violations
closed (KILL-1..7), a fully-excluded gate now records an honest null with the composite
renormalizing over what's present (MIG-1), every CRITICAL/HIGH security finding closed (SEC-1..5),
and EDGE-5 gives a working instrument that grades scan snapshots against realized spot and IV.
**The highest-value next move** is not a new data feed — it's wiring the **Tier-1 signals we
already fetch, compute, and throw away** (fed net liquidity, VIX/VXV term structure, VVIX, credit/
curve/USD, forward EBITDA/EBIT) into their gates at **zero new API cost**, then letting EDGE-5
measure whether they actually improve realized-outcome accuracy. **Why the discipline is the whole
game:** signals earn weight by measured contribution, not by how compelling the prior sounds —
more feeds without measurement is variance, not edge; the engine already has honest inputs, an
honest scorer, and an outcome instrument, so the disciplined loop (wire free → measure → keep/kill
→ then evaluate premium one-at-a-time) is what converts a data pipeline into a real edge machine,
and closing the realized-P&L gap is what will let that loop grade trades, not just moves.
