# TRADING — PR-1 Implementation: reshape filter strip into shared ScanFilterForm

**Branch:** `claude/trading-pr-1`
**Date:** 2026-05-31
**Scope:** Reshape the cramped gold-bordered scanner strip into a shared
`<ScanFilterForm>` SectionCard form (the Travel `CreateTripForm` pattern).
**Presentational only** — same `scannerFilters`/`scannerUniverse` state, same
`handleFiltersChange` (localStorage), same `scanTriggerRef`, same client-side
`applyFilters`. **0 scan-logic / endpoint / schema change.** Per
`audit-reports/trading-pr-1-audit.md`. 2 files (1 new) + report. **0 deps.**

---

## STEP 1 — The current strip (cited)

`src/app/trading/page.tsx:750-892` — the "ROW 1 Scanner Bar"
(`bg-white border-2 border-brand-gold/60 rounded-xl`): **Zone 1** identity +
TT-connected dot (`:753-765`), **Zone 2** filters (`:767-885`), **Zone 3** Scan
button (`:887-891`). All **18 `ScannerFilters` fields + universe** were exposed:
universe pills (`:771`), direction/stance/risk toggles (`:777-799`), Liquidity +
Edge slider popovers (`:804-841`), DTE/width inputs (`:842-855`), the 16-strategy
popover (`:856-883`). State (page-level): `scannerUniverse` (`:117`),
`scannerFilters` (`:110`, localStorage-persisted via `handleFiltersChange`
`:123-125`), `openPopover` (`:118`, used **only** by the strip), `scanTriggerRef`
(`:119`).

**Confirmed (no endpoint change needed):** Scan → `scanTriggerRef.current()`
(`:888`) → `ConvergenceIntelligence` fetches `GET /api/trading/convergence?limit=
&universe=` — the endpoint takes **only `limit`/`universe`**; all 18 filters are
applied **client-side** via `applyFilters` in `ConvergenceIntelligence` (the lifted
`scannerFilters` is passed to it). So a reshape touches **zero** scan logic.

## STEP 2 — `<ScanFilterForm>` extracted (0 logic change)

New **`src/components/trading/ScanFilterForm.tsx`** — the Zone-2 filter controls +
the Scan button, in **SectionCard chrome matching `CreateTripForm`**:
`rounded-lg overflow-hidden border border-gray-200/50 shadow-sm` + a
**`bg-brand-purple/80 … px-4 py-2.5 … font-semibold` band reading "Scan filters"**
(with the TT-connected dot moved into the band, right-aligned) + a `bg-white p-4`
body. The 18 filters are **grouped into labeled form rows**: Universe / Direction /
Premium / Risk (row 1) and DTE / Width / Liquidity gates / Edge metrics /
Strategies + the Scan CTA (row 2) — each with a `text-[10px] uppercase` label, so
it reads as a form, not a terse bar. The Liquidity/Edge/Strategies popovers are
preserved (the audit recommended keeping them; folding to fully-inline is deferred).

**Every control writes the identical `ScannerFilters` path** via the
`onFiltersChange` prop (= the page's `handleFiltersChange`) — verified all 18
fields present (`direction, premiumStance, riskType, strategies, min/maxDte,
min/maxSpreadWidth, minOpenInterest, maxBidAskSpreadPct, minUnderlyingVolume,
minLiquidityRating, minPop, minEv, minEvPerRisk, volEdge, minIvRank, minSentiment`).
`openPopover` is now the component's **internal** state (it was page-level but used
only here). Props: `scannerUniverse`/`setScannerUniverse`, `scannerFilters`/
`onFiltersChange`, `scanTriggerRef`, `ttConnected`.

**`page.tsx`** — the inline ROW 1 strip (`:750-892`) replaced with
`<ScanFilterForm … />` (passing the same state/handler/ref); the `openPopover`
state decl removed; the now-unused `AVAILABLE_STRATEGIES` import dropped (moved into
the component). The page **keeps** `scannerFilters`/`scannerUniverse`/
`handleFiltersChange`/`scanTriggerRef` (all still passed to `ConvergenceIntelligence`)
and the ROW 2 metrics bar — untouched.

## STEP 3 — Parity verified

- **Identical scan behavior:** every filter still writes the same `scannerFilters`
  field via `onFiltersChange` → `handleFiltersChange` (which `localStorage.setItem
  ('scanner-filters', …)` + `setScannerFilters` — **localStorage persistence
  intact**, 1 ref in page); the Scan button still calls `scanTriggerRef.current()`;
  `ConvergenceIntelligence` still receives the lifted `scannerFilters`/`universe`
  and runs `applyFilters` client-side. The page's state/handler/ref each show 4
  refs (decl + passed to both the form and ConvergenceIntelligence).
- **Endpoint NOT in diff:** `convergence/route.ts` is untouched (grep-confirmed) —
  0 endpoint change.
- **SectionCard chrome matches `CreateTripForm`/the app language:** one
  brand-purple band + white body + the gold Scan CTA; no second purple.
- **No leftovers:** `openPopover` 0 refs in page, "Zone 2: Filters" 0, the strip
  fully replaced.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Presentational reshape + extraction ONLY; 0 scan-logic/endpoint/schema | ✅ endpoint not in diff; only UI relocated |
| All 18 filters preserved + still client-side via `applyFilters` | ✅ all 18 field writes present; `applyFilters` in ConvergenceIntelligence untouched |
| `scanTriggerRef` + `scannerFilters`/`scannerUniverse` state preserved; localStorage intact | ✅ page keeps the lifted state + `handleFiltersChange` (localStorage) |
| Shared component (PR-2 mounts on home) | ✅ `src/components/trading/ScanFilterForm.tsx`, prop-driven |
| Match the app's SectionCard design language | ✅ CreateTripForm chrome tokens |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ScanFilterForm **0 problems**; page **14e/31w == main → +0/+0** (all pre-existing) |
| git diff scoped | ✅ new `ScanFilterForm.tsx` + `page.tsx` (swap) (+ report) |

---

## Result
The cramped gold scanner strip is now a shared `<ScanFilterForm>` SectionCard form
(band "Scan filters" + white body + grouped, labeled filter rows + gold Scan CTA),
matching the `CreateTripForm`/app design language. All 18 `ScannerFilters` fields +
universe are preserved and still applied **client-side** via `applyFilters`; the
Scan button still fires `scanTriggerRef`, the `scannerFilters`/`scannerUniverse`
state + localStorage persistence are intact, and the convergence endpoint is
untouched (0 endpoint/schema change). The component is prop-driven so HOME-PR-2 can
mount it on the home Trading pill. tsc + lint clean; diff scoped to 2 files.
