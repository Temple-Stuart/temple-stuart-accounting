# TRADING — PR-1 Audit: reshape the filter strip into a scan-filter FORM (Travel pattern)

**Branch:** `claude/trading-pr-1-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Goal:** Map the Trading dashboard's top filter strip + the scan pipeline it
feeds, then recommend reshaping the strip into a proper filter **form** (the
Travel search-bar → create-trip-form pattern, applied to stock-data scanning).
Recommend; do not implement.

---

## 1. The filter strip — control table

The strip is **inline in `src/app/trading/page.tsx`** (`:767-891`), a horizontal
bar (`border-2 border-brand-gold/60 rounded-xl` — the Travel-search-bar chrome) in
3 zones: status (`:755-765`), filters (`:767-885`), Scan (`:887-891`). State lives
in the page: `scannerUniverse` (`:117`) + `scannerFilters: ScannerFilters`
(`:110`, persisted to `localStorage 'scanner-filters'` via `handleFiltersChange`
`:123-125`).

| Control | Lines | Sets | Options / range | Default |
|---|---|---|---|---|
| **Universe** | `:771-776` | `scannerUniverse` | S&P 500 (`sp500`) / Nasdaq 100 (`nasdaq100`) | `sp500` (`:117`) |
| **Direction** | `:777-784` | `risk.direction` | ALL / BULLISH / BEARISH / NEUTRAL | `ALL` |
| **Premium stance** | `:785-792` | `risk.premiumStance` | SELL / BUY / BOTH | `BOTH` |
| **Risk type** | `:793-800` | `risk.riskType` | DEFINED_ONLY / INCLUDE_UNLIMITED | `DEFINED_ONLY` |
| **Liquidity** popover | `:804-821` | `liquidity.*` | Min OI 0-5000 · Max Spread 1-50% · Min Vol 0-10M · Min Rating 1-5★ | 100 / 10 / 500K / 2 |
| **Edge** popover | `:822-841` | `edge.*` | Min PoP 0-100 · Min EV −500..1000 · Min EV/Risk −2..2 · Vol Edge IV>HV/IV<HV/Any · Min IV Rank 0-100 · Sentiment −100..100 | 50 / 0 / 0 / ANY / 0 / −100 |
| **DTE** | `:843-848` | `risk.minDte`/`maxDte` | 0-365 each | 30 / 60 |
| **Spread width (W$)** | `:850-855` | `risk.minSpreadWidth`/`maxSpreadWidth` | 0-100 each | 1 / 10 |
| **Strategies** popover | `:856-883` | `risk.strategies[]` | 16 strategies (`AVAILABLE_STRATEGIES`); empty = all → "16 strats" | `[]` (all) |
| **Scan** | `:887-891` | calls `scanTriggerRef.current()` | — | — |

(Defaults from `DEFAULT_FILTERS`, `filter-types.ts:54-83`.) So the strip already
exposes **all 18 `ScannerFilters` fields** + universe — it is **not** a thin strip;
it's a dense bar with two popovers.

## 2. What the scan consumes — filters are applied CLIENT-SIDE

**The Scan button** (`page.tsx:888`) calls `scanTriggerRef.current()` — a ref the
page passes to `<ConvergenceIntelligence scanTriggerRef={…} filters={scannerFilters}
universe={scannerUniverse} …/>` (`:998-1004`). The trigger fetches
**`GET /api/trading/convergence?limit=9&universe={universe}`**
(`ConvergenceIntelligence.tsx:4611`).

**The scan endpoint takes ONLY `limit` + `universe`** (+ `refresh`/`stream`)
(`convergence/route.ts:52-58`); `runPipeline(limit, userId, universe)` (`:128`)
does **not** receive `ScannerFilters`. The rich filters are applied
**client-side** after the pipeline returns: `applyFilters(enriched, filters,
sentimentMap)` (`ConvergenceIntelligence.tsx:4325`, engine in
`src/lib/convergence/filter-engine.ts:74`).

| Strip control | Where consumed |
|---|---|
| Universe | **server** param (`?universe=`) — selects the scan set |
| Direction / Premium / Risk type / DTE / Width / Strategies / Liquidity / Edge | **client** (`applyFilters`, filter-engine: liquidity `:147-156`, risk `:162-175`, edge `:93-96+`) |

**No control is decorative** — all are wired (universe server-side; the other 18
client-side). The **scan endpoint is filter-agnostic by design** — it ranks the
universe; the form narrows the results in the browser. *(Implication: the form
reshape needs **zero scan-endpoint change** — it's all client filter state.)*

## 3. Full supported scanner filter set vs what's exposed

`ScannerFilters` (`filter-types.ts:46-50`) = **3 tiers, 18 fields**, **all already
exposed** in the strip:
- **Tier 1 Liquidity** (`:9-14`): minOpenInterest, maxBidAskSpreadPct,
  minUnderlyingVolume, minLiquidityRating.
- **Tier 2 Risk** (`:24-33`): riskType, direction, premiumStance, strategies[],
  minDte, maxDte, minSpreadWidth, maxSpreadWidth.
- **Tier 3 Edge** (`:39-46`): minPop, minEv, minEvPerRisk, volEdge, minIvRank,
  minSentiment.

**The 4 convergence GATES** (Vol Edge / Quality / Regime / Info Edge,
`filter-engine.ts:41` `category_scores`) are **scored + displayed** (the
ConvergenceIntelligence score panel, gate tooltips `:852-855`) but are **NOT
filter inputs** — `applyFilters` does not threshold on gate scores. **So there's a
supported-but-UNEXPOSED capability**: gate-score thresholds (e.g. "Vol Edge ≥ 60",
"≥ 3/4 gates") are computed and shown but can't be set as scan filters. The form
reshape *could* surface gate-score min sliders (a real new filter dimension) — but
that's a **filter-engine change**, beyond a presentational reshape (flag, §6/§7).

## 4. Auth — scan endpoint gating (ties to the security item)

`/api/trading/convergence` GET is gated by **`getVerifiedEmail()` → 401 if absent**
(`route.ts:44-47`) — **login required**, but **NO tier/admin gate**: any
authenticated user triggers `runPipeline`, which calls the paid data feeds
(TastyTrade / Finnhub / FRED / xAI). **This is the pending security gap** — the
spec is "only Alex should run paid scans," but the endpoint admits **any
logged-in user**. There is no `tier`/`ADMIN_USER_ID` check here (cf. the trips
page's `currentUserId !== ADMIN_USER_ID` gate). **Flag for a security PR**
(separate from this presentational reshape): add a tier/admin gate (and ideally a
rate-limit) on `convergence` before the paid pipeline runs.

## 5. The Travel → form template

`CreateTripForm` (`src/components/trips/CreateTripForm.tsx`, HOME-PR-1/1c) is the
template: the SectionCard chrome (`rounded-lg overflow-hidden border
border-gray-200/50 shadow-sm` + optional `bg-brand-purple/80` band + `bg-white p-4`
body), labeled field groups in a responsive row, a `brand-gold` action CTA, and
local form state → action (POST/redirect). The trips index + home launcher both
mount it; an optional `showHeader` prop toggles the band.

**Equivalent "scan filter form":** a `<ScanFilterForm>` SectionCard (band e.g.
"Scan filters") whose body groups the 18 filters into labeled sections —
**Universe**, **Direction & Strategy** (direction / stance / risk type /
strategies), **Numeric** (DTE / width), **Liquidity gates**, **Edge metrics** —
with the **Scan** button as the `brand-gold` CTA. Same chrome, same state
(`scannerFilters`), same `scanTriggerRef` action.

## 6. RECOMMENDED reshape + filter set (at the bar)

**(a) Reshape = presentational lift of the existing strip into SectionCard form
chrome — NOT a redesign of the scan.** The strip already wires all 18 filters
correctly client-side; the work is **layout/chrome only**: move the inline bar +
its two popovers into a `<ScanFilterForm>` SectionCard with logically grouped,
labeled field rows (so it reads like the create-trip form rather than a dense
gold bar), keeping `scannerFilters`/`scannerUniverse`/`scanTriggerRef` exactly as
they are. **Reasoning:** the institutional pipeline + client filter-engine are
sound and must not be touched (Alex's "do not break it"); the complaint is the
*strip's* terse, popover-hidden UX. A chrome reshape fixes UX at **zero scan-logic
risk**.

**(b) Filter set = surface the full 18 (already supported), grouped — do NOT add
new dimensions in this PR.** All 18 are already exposed (just cramped/popover'd);
the form should make them **legible** (labeled groups, the Edge/Liquidity popovers
become inline form sections), not add filters. **Defer the gate-score thresholds
(§3) to a later PR** — they're a genuine new capability requiring a filter-engine
change, out of scope for a presentational reshape.

**Proposed groups** (all existing fields): **Universe** (S&P/Nasdaq) ·
**Direction & strategy** (direction / stance / risk type / strategies) ·
**Window** (DTE min-max / width min-max) · **Liquidity gates** (OI / spread / vol /
rating) · **Edge metrics** (PoP / EV / EV-risk / Vol Edge / IV rank / sentiment) ·
**Scan** CTA.

## 7. Scope + sequencing

- **TRADING-PR-1 (recommended — presentational reshape):** extract the inline
  strip (`page.tsx:767-891`) into a `<ScanFilterForm>` component in SectionCard
  chrome, grouped/labeled, reading the **same** `scannerFilters`/`scannerUniverse`
  state + `scanTriggerRef`. **0 scan-logic change, 0 endpoint change, 0 schema, 0
  deps.** Files: `src/app/trading/page.tsx` (mount), new
  `src/components/trading/ScanFilterForm.tsx`. Risk: low (UI-only; the pipeline +
  `applyFilters` untouched). Parity-prove the filter state behaves identically
  (like the CreateTripForm extraction).
- **TRADING-PR-2 (security — separate, higher priority):** add a tier/admin gate
  (+ rate-limit) on `/api/trading/convergence` so only authorized users trigger
  the paid pipeline (§4). **This is the real risk item**, independent of the
  reshape.
- **TRADING-PR-3 (optional, later):** surface gate-score thresholds as new scan
  filters (filter-engine + type change) — only if Alex wants the new dimension.

## Sign-off items
1. **Reshape scope** — presentational form-chrome lift of the existing strip
   (recommended) vs a larger redesign.
2. **Filter set** — surface the existing 18 grouped (recommended) vs also add
   gate-score thresholds now (filter-engine change).
3. **Security gate (§4)** — confirm TRADING-PR-2 adds a tier/admin gate on the
   convergence endpoint (only Alex runs paid scans). **The decision that actually
   matters for cost/safety.**
4. **Band or band-less** — `ScanFilterForm` with a "Scan filters" SectionCard band
   vs band-less (the strip currently has no purple band, just the gold-bordered
   bar). Confirm the chrome.
5. **Keep popovers vs inline** — fold the Liquidity/Edge popovers into inline form
   sections (recommended for legibility) vs keep them as popovers in the form.

---

**READ-ONLY audit. No implementation performed.**
