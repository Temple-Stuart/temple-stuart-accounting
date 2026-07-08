# EDGE-7-AUDIT — licensed-endpoint utilization vs Appendix A: is earnings-quality-score consumed, and what in-contract signal is left on the table?

**Date:** 2026-07-08 · **Branch:** `claude/edge-7-audit` · **Base:** main @ `de076f7a` · **READ-ONLY — no code changed.** Scope is bounded by Alex's actual Finnhub Appendix A contract (40 endpoints); nothing outside it is proposed.

---

## 1. HEADLINE — `/stock/earnings-quality-score` is ALREADY fetched AND scored (the task's premise was stale)

- **Fetched:** `fetchFinnhubEarningsQuality` (`data-fetchers.ts:2060-2106`), URL at `:2074`
  (`freq=quarterly`), 1-hour cache (`:2057-2058`), fail-loud parse (no data → declared error
  `:2084`; missing score → declared error `:2093`). Pipeline Step E5 (`pipeline.ts:860-865`),
  entering `ConvergenceInput.finnhubEarningsQuality` at all four scoring call sites
  (`pipeline.ts:1188, 1250, 1786, 1950`).
- **Scored:** `quality-gate.ts:733-773` — a **SUE + Finnhub-ML ensemble**: the internal
  SUE-based EQ composite (consistency 0.50 / days-to-earnings 0.30 / beat-rate 0.20,
  `:726-730`) is cross-validated against Finnhub's score; agreement (both > 60 or both < 40)
  → +15% distance-from-neutral boost, strong disagreement → −20% compression (`:754-772`).
  The result enters profitability as `earnings_quality` at **weight 0.23** (`:787`), inside
  the 0.30-weight profitability section. The ensemble state is declared in the formula string
  (`:800-804`). UI dictionary agrees (`ConvergenceIntelligence.tsx:2785`) — no drift here.
- **Consumption caveat (by design):** Finnhub's score acts only as a *modifier* — if the
  internal SUE composite is null, the Finnhub score alone contributes nothing
  (`quality-gate.ts:742` requires both). It is never a standalone component.

### ⚠️ Two data-integrity flags on this endpoint
1. **No recency guard.** The fetcher sorts entries by period and takes the newest —
   *whatever its date* (`data-fetchers.ts:2088-2090`). Unlike the regime gate's staleness
   flags (ICSA/NFCI, `regime.ts` `isStale`), a years-old quarterly score would silently pass
   into the ensemble.
2. **The observatory records it as BROKEN.** Static rows in
   `DataObservatory.tsx:45` and `:66` mark the endpoint `BROKEN — "Returning 1983 data",
   0 curr records`. These are hardcoded display rows (a recorded claim, not a live check),
   and it is **not verified** here (no API key in this environment). If true, flag 1 means a
   1983-period score is currently modifying quality scores. **Recommended EDGE-7b:** add a
   fail-loud recency guard (entry older than N quarters → null + declared, excluded from the
   ensemble), and have Alex verify the live response.

## 2. Licensed-endpoint utilization table (all 40 of Appendix A)

Statuses: **(a)** fetched + scored · **(b)** fetched + display/diagnostics-only · **(c)** not fetched.
Secondary display-route re-fetches (data-observatory check, ticker-context panel) don't change status.

### (a) Fetched + SCORED — 19 endpoints

| endpoint | fetch (file:line) | what it moves |
|---|---|---|
| `/stock/profile2` | `data-fetchers.ts:894` | CIK lookup only → SEC filing-recency modifier on **info-edge** (`info-edge.ts:1068, 1369-1371`); business fields unscored |
| `/stock/peers` | `data-fetchers.ts:1210` | peer stats (`pipeline.ts:575`) → **vol-edge** peer z-scores (`vol-edge.ts:39-43, 204, 407`) + **info-edge** ΔTPER neutralization (`info-edge.ts:241-264`) |
| `/company-news` | `data-fetchers.ts:2143-2146` | **info-edge** news_sentiment (keyword-classifier leg, `info-edge.ts:904`; weight 0.15) |
| `/news-sentiment` | `data-fetchers.ts:2024` | FinBERT ensemble leg on the same news_sentiment (`info-edge.ts:956-999`) |
| `/stock/ownership` | `data-fetchers.ts:1823` | **info-edge** institutional_ownership (`info-edge.ts:1187`; weight 0.05) |
| `/stock/fund-ownership` | `data-fetchers.ts:1824, 2546` | institutional merge + **info-edge** fund_ownership_flow (`info-edge.ts:1295-1309`; weight 0.05) |
| `/stock/insider-transactions` | `data-fetchers.ts:1038` | Form-4 legs of **info-edge** insider_activity (`info-edge.ts:530-619`; weight 0.15) |
| `/stock/insider-sentiment` | `data-fetchers.ts:247` | **dual consumer:** MSPR legs of info-edge insider_activity (`info-edge.ts:469-528`) AND **quality** `mspr_adjustment` ±5 (`quality-gate.ts:1136-1149`) |
| `/stock/metric` | `data-fetchers.ts:214` | **quality** safety/profitability inputs (`quality-gate.ts:39, 505`) + dividend growth (`:867, 892`) + **vol-edge** 52-wk technicals (`vol-edge.ts:729-730`) |
| `/stock/financials` | `data-fetchers.ts:445-447` | quarterly Piotroski/Altman-Z (**quality**, `quality-gate.ts:112, 943`) |
| `/stock/financials-reported` | `data-fetchers.ts:389` | annual Piotroski YoY (**quality**, `quality-gate.ts:113, 545, 942`) |
| `/stock/revenue-breakdown2` | `data-fetchers.ts:1920` | HHI concentration modifier on **quality** safety (`quality-gate.ts:409-431`) |
| `/stock/recommendation` | `data-fetchers.ts:230-234` | **info-edge** analyst_consensus — **latest month only** (`info-edge.ts:50-54`); full monthly history is fetched and kept but unscored (see §3) |
| `/stock/price-target` | `data-fetchers.ts:112` | **info-edge** price_target_signal (`info-edge.ts:224-319`) |
| `/stock/upgrade-downgrade` | `data-fetchers.ts:113` | **info-edge** upgrade_downgrade_signal (`info-edge.ts:367`) |
| `/stock/revenue-estimate` | `data-fetchers.ts:111` | **info-edge** analyst consensus + SUE revenue surprise (`info-edge.ts:68, 111, 1103`) |
| `/stock/eps-estimate` | `data-fetchers.ts:110` | **info-edge** analyst consensus + SUE EPS (`info-edge.ts:58, 1094`) |
| `/stock/earnings` | `data-fetchers.ts:262` | **quality** EQ composite (`quality-gate.ts:654-731`) + **info-edge** SUE/momentum (`info-edge.ts:624, 1094-1104`) |
| `/stock/earnings-quality-score` | `data-fetchers.ts:2074` | **quality** ensemble modifier (§1) |

### (b) Fetched + diagnostics-only / unused — 5 endpoints (the fetched-but-unused inventory)

| endpoint | fetch | where it dies | note |
|---|---|---|---|
| `/stock/ebitda-estimate` | `data-fetchers.ts:2405` | Step I diagnostics only (`pipeline.ts:1094-1095`); never in `ConvergenceInput` | ⚠️ UI drift: `ConvergenceIntelligence.tsx:2788` claims it feeds the Quality gate — it does not |
| `/stock/ebit-estimate` | `data-fetchers.ts:2436` | diagnostics only (`pipeline.ts:1096-1097`) | same |
| `/calendar/earnings` | `data-fetchers.ts:2632-2650` | diagnostics only (`pipeline.ts:1106-1107`) | scoring/trade-card earnings timing uses `ttScanner.daysTillEarnings` (TastyTrade), not this |
| `/stock/dividend` | `data-fetchers.ts:2470` | diagnostics only (`pipeline.ts:1098-1099`) | ⚠️ UI drift: `ConvergenceIntelligence.tsx:2789` claims "Quality gate, trade card" — it feeds neither; quality's dividend growth comes from `/stock/metric` (`quality-gate.ts:892`) |
| `/stock/price-metric` | `data-fetchers.ts:2506` | **DEAD WRITE** — `priceMetricsMap` set at `pipeline.ts:1013` and never read anywhere; output visible only in fetcher console logs | 💰 a paid per-symbol call whose result is fully discarded — remove the call or wire it (Alex's ruling) |

### (c) Not fetched — 16 endpoints

`/search`, `/stock/symbol`, `/stock/market-status`, `/stock/market-holiday`, `/stock/profile` (v1),
`/stock/executive`, `/sector/metrics`, `/calendar/ipo`, `/news` (general), `/press-releases2`,
`/institutional/profile`, `/institutional/portfolio`, `/institutional/ownership`,
`/stock/filings` (all "filings" code is SEC EDGAR direct — `data-fetchers.ts:1259, 1597, 2582` hit
`sec.gov`, not Finnhub), `/stock/historical-market-cap`, `/stock/historical-employee-count`.

Count check: 19 + 5 + 16 = 40 = Appendix A. ✓

## 3. Rulings — what's worth wiring (in-contract ONLY), ranked

**Contract reality re-scopes STRATEGY-EVIDENCE §9 Stage 2.** The evidence doc's Stage-2 feeds
— filing-NLP sentiment, earnings-call transcript tone, FDA calendar — are **NOT in Appendix A**
and are hereby withdrawn from the build plan (out-of-license; not proposed). The in-contract
Stage 2 is:

1. **Recommendation-trend REVISION → info-edge** (top pick, $0). `/stock/recommendation`
   returns a *monthly time series* and the fetcher keeps ALL of it
   (`data-fetchers.ts:230-234`, no slicing), but scoring reads **only the latest month**
   (`info-edge.ts:50-54`). The month-over-month change in the buy-mix is therefore the **one
   honest revision signal available in-contract** — real repeated observations of the same
   quantity, unlike EDGE-7a's estimates (single snapshot, STOPPED). It is exactly the
   "analyst-revision momentum" the evidence endorses (STRATEGY-EVIDENCE §4 WIRE table; the
   code already cites Chan, Jegadeesh & Lakonishok 1996 at `info-edge.ts:41-42`). Missing
   prior month → null → excluded → renormalized, per the standing tripwire.
2. **Earnings-quality recency guard → quality** ($0, data-integrity fix, §1 flags): fail-loud
   staleness on the EQ period + Alex verifies the observatory's "1983 data" claim live.
3. **Earnings event-avoid flag from `/calendar/earnings`** ($0, defensive filter): licensed,
   fetched, diagnostics-only. STRATEGY-EVIDENCE §4 treats earnings dates as a "do NOT sell
   into this event" filter, and today's only earnings-timing input
   (`ttScanner.daysTillEarnings`) is single-source and nullable — the Finnhub calendar is the
   natural redundant confirmation. (FDA calendar is out-of-contract; earnings dates only.)
4. **Forward EBITDA/EBIT levels → quality** ($0, optional, weakest): fetched,
   diagnostics-only. This is a *level*, not the revision the evidence prefers (the revision is
   not computable — EDGE-7a audit) — wire only if Alex wants the roadmap's forward-valuation
   prior, at modest weight, EDGE-5-gated. Also fixes the `:2788` UI drift either way (wire it
   or correct the label).
5. **Leave / cost cleanup:** `/stock/price-metric` — dead paid call; **remove or wire**
   (removal is a cost saving; ruling is Alex's). `/stock/dividend` — leave unwired (redundant
   with `/stock/metric`'s `dividendGrowthRate5Y`) but fix the `:2789` UI drift row.
   Unfetched (c) endpoints — no fetch proposed; none carries a signal prior that clears the
   measure-before-weight bar (reference/meta data, or redundant with wired sources).

**Mandate-premise corrections (truth-first):**
- The task says "insider-sentiment/MSPR = noise per evidence; leave it." The committed
  STRATEGY-EVIDENCE doc makes **no noise ruling on MSPR** (its LEAVE list is congressional,
  social, lobbying, govt contracts, supply-chain, ESG — §4). MSPR is currently wired twice
  (§2 table). Ruling here: **leave as-is** — no new MSPR wiring proposed, and like every
  incumbent signal it keeps weight only if EDGE-5 grades it (t > 3 bar, §5).
- The task's framing implied earnings-quality-score might be unused — it has been wired
  (ensemble) since before this audit; the real gaps on that endpoint are the recency guard
  and the unverified BROKEN claim (§1).

## One-paragraph summary

The licensed surface is already well-used: **19 of 40** Appendix-A endpoints are fetched and
scored — including the headline `/stock/earnings-quality-score`, which cross-validates the
internal SUE composite as a ±15/−20% confidence ensemble inside quality (so the task's
"fetched-but-unused?" premise was stale) — **5** are fetched but die before scoring, and
**16** are not fetched at all. The real in-contract opportunities, in order: the
**recommendation-trend revision** (the only true revision signal the contract offers — the
monthly history is already fetched and only the latest month is read), a **fail-loud recency
guard** on the earnings-quality score (the observatory records the endpoint as returning
1983-era data and the fetcher would happily consume it), and the **earnings event-avoid
flag** from the already-fetched earnings calendar. One paid call (`/stock/price-metric`) is
pure waste — fetched and never read — and two UI dictionary rows claim wirings that don't
exist (ebitda-estimate → quality; dividend → quality/trade-card), a no-drift violation to fix
in whichever PR touches them. Filing-NLP, transcripts, and the FDA calendar are out of
contract and are withdrawn from STRATEGY-EVIDENCE §9's Stage 2, which is re-scoped to the
three in-contract items above — every one of them $0 in new API cost, and every one still
subject to the measure-before-weight bar.
