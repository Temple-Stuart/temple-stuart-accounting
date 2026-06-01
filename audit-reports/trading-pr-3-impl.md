# TRADING — PR-3 Implementation: expand filters inline, free from sticky zone, kill home double-purple

**Branch:** `claude/trading-pr-3`
**Date:** 2026-05-31
**Scope:** Fix the three `<ScanFilterForm>` problems — (1) **expand all 18 filters
inline** (remove the `openPopover` collapsed pills), (2) **free the form from the
sticky/blur Purple Zone** into full-height stacked SectionCards (form + a new
"Performance" card), (3) **kill the home double-purple** via a `showHeader` prop
(the HOME-PR-1c pattern). Per `audit-reports/trading-pr-3-audit.md`. **0
filter-logic / endpoint / schema change.** 3 files + report. **0 deps.**

**Design-skill grounding** (`SKILL.md`): "cohesive design language via consistent
tokens; dominant color with sharp accents, not timid evenly-distributed palettes."
Two stacked purples + collapsed-popover filters violated that; this PR applies the
Travel **one-purple + secondary-white** rule (one band per card; inner group labels
light) and shows everything at once.

---

## STEP 1 — All 18 filters expanded inline

`src/components/trading/ScanFilterForm.tsx` was rewritten: **`openPopover` state +
the three collapsed-pill triggers/`absolute` popovers are removed** (`grep
openPopover` → only comment text remains). The 18 fields now render as **visible
labeled field groups** in the form body, with **light secondary group labels**
(`GroupLabel` = `text-[10px] uppercase … text-text-muted` — the Travel
secondary-white inner structure):

- **Row 1 (inline, unchanged):** Universe (S&P/Nasdaq), Direction (ALL/Bull/Bear/
  Ntrl), Premium (SELL/BUY/BOTH), Risk (Defined/Unlimited), DTE min–max, Width$
  min–max.
- **Liquidity gates (4) — now inline** (`GroupLabel "Liquidity gates"`): `minOpenInterest`,
  `maxBidAskSpreadPct`, `minUnderlyingVolume`, `minLiquidityRating`.
- **Edge metrics (6) — now inline** (`GroupLabel "Edge metrics"`): `minPop`, `minEv`,
  `minEvPerRisk`, `volEdge`, `minIvRank`, `minSentiment`. (Liquidity + Edge sit in a
  `lg:grid-cols-2` row.)
- **Strategies (16) — now inline** (`GroupLabel "Strategies (N/16 | all)"` + "Reset
  all"): the full `AVAILABLE_STRATEGIES` chip grid.
- **Scan CTA** (gold, right-aligned).

**All 18 field-writes preserved** — every control calls
`onFiltersChange({ …, <tier>: { …, <field>: … } })` with the **identical
`ScannerFilters` paths** (verified all 18 present). 0 filter-logic change; the
filters are still applied client-side via `applyFilters` in ConvergenceIntelligence
(untouched).

## STEP 2 — Freed from the sticky/blur zone (Travel-style stack)

`src/app/trading/page.tsx`: the **`sticky top-0 z-40 backdrop-blur-sm bg-brand-purple/95`
"Purple Background Zone"** (former `:747-789`) is **dissolved** (`grep "sticky top-0
z-40"` → 0). Now in **normal page flow**:
- **`<ScanFilterForm>`** — a full-height SectionCard ("Scan filters" band), nothing
  pinned, nothing clipped (no sticky ancestor + no `absolute` popovers).
- **"Performance" SectionCard** (new, `:761-782`) — the former ROW 2 metrics row
  (Period date range + P&L/WR/PF/Max W/Max L/Avg W/Avg L) reborn as its **own**
  card: one `bg-brand-purple/80` band ("Performance" + the Period inputs) + a
  **light white body** grid (`bg-white … text-text-muted` labels, emerald/red
  values) — the one-purple + secondary-white rule (was purple-on-purple white text
  in the sticky bar).
- **Chart of Accounts / Commit to Ledger / P&L Calendar** stack below as before
  (`:784+`, unchanged).

Stack order confirmed: ScanFilterForm (`:750`) → Performance (`:763`) → Page
Content / Chart of Accounts (`:784,789`).

## STEP 3 — `showHeader` prop (kills home double-purple)

`ScanFilterForm` gained **`showHeader?: boolean` (default true)** — the
`CreateTripForm` HOME-PR-1c pattern. With `showHeader` it wraps the form in the
"Scan filters" SectionCard band; with `showHeader={false}` it returns the bare
`formBody`.
- **Dashboard** (`trading/page.tsx:750`): no `showHeader` prop → **default true** →
  keeps the single "Scan filters" purple band (it's the only band there — correct).
- **Home launcher** (`ModuleLauncher.tsx:132`): the Trading branch now passes
  **`showHeader={false}`** → the form renders **bandless under the single "Launch a
  module" band** → no double-purple. The light group sub-labels provide the inner
  legibility.

## STEP 4 — Verified (all surfaces)

- **Dashboard:** scan form = full-height "Scan filters" SectionCard, **all 18
  filters visible inline**, nothing clipped, not sticky; Performance card below;
  Chart of Accounts etc. below (unchanged). ✅
- **Home Trading pill (admin):** form **bandless** under "Launch a module" (one
  purple), all 18 filters visible, no double-purple. ✅
- **Scan still fires:** the Scan button calls `scanTriggerRef.current()`
  (dashboard → ConvergenceIntelligence scan; home → routes to `/trading`); filters
  still `applyFilters` client-side; **localStorage `scanner-filters` intact** (page
  `handleFiltersChange` unchanged, 1 ref). ✅
- **Travel + other pills + dashboard data sections unchanged** — `CreateTripForm`,
  the paid stubs, COA/Commit/Calendar not touched; the convergence endpoint not in
  diff. ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| 0 filter-logic / endpoint / schema; same paths via onFiltersChange | ✅ all 18 writes identical; `applyFilters` + endpoint untouched |
| `scanTriggerRef` + `scannerFilters`/`scannerUniverse` state preserved; localStorage intact | ✅ page state/handler/ref intact (3 refs each) |
| Un-stick — no sticky/backdrop-blur ancestor, no absolute popovers | ✅ Purple Zone dissolved; popovers removed; only the unrelated trade-modal keeps its own sticky |
| One purple band per card (Travel rule); home bandless (showHeader=false) | ✅ dashboard 1 band; Performance 1 band; home bandless |
| Shared component preserved | ✅ same `ScanFilterForm`, dashboard + home |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ScanFilterForm **0 problems**; page 14e/31w == main, launcher 0/0 == main → **+0/+0** |
| git diff scoped | ✅ ScanFilterForm + trading/page.tsx + ModuleLauncher (+ report) |

---

## Result
The scan form now shows **all 18 filters expanded inline** (Liquidity/Edge/
Strategies are visible labeled groups, no click-to-expand), sits in **normal page
flow** as a full-height SectionCard (the sticky/backdrop-blur zone is gone — nothing
clipped), and the metrics row is its **own "Performance" SectionCard** below it
(Travel-style stack). The home Trading pill renders the form **bandless** under the
single "Launch a module" band (`showHeader={false}`) — no double-purple — while the
standalone dashboard keeps its "Scan filters" band. Same 18 filter writes, same
client-side `applyFilters`, same `scanTriggerRef`/localStorage; endpoint + schema
untouched. tsc + lint clean; diff scoped to 3 files.
