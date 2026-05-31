# TRAVEL — PR-28b Implementation: Excel-style per-section filtering + sort (client-side)

**Branch:** `claude/travel-pr-28b`
**Date:** 2026-05-30
**Scope:** Client-side faceted filtering + sort per section, on already-fetched
recs. **Zero new API calls.** 1 file + report. 0 deps, 0 schema.

---

## STEP 1 — Reactivated `sortItems`

The dormant `sortItems` closure (never called in render) is removed and
reactivated as the module-level pure **`sortRecs(items, source, sortBy)`**
(`TripPlannerAI.tsx:1060-1071`), now **wired into render**:
`TravelCarousel:1196` computes `const visible = sortRecs(filterRecs(items, source,
filter), source, filter.sort)`. The obsolete parent `sortBy` state was removed
(per-section sort now lives in each carousel) — net **−2 eslint warnings** (dead
state + closure gone). `sortRecs` extends the old logic: price is now
source-aware (hotels = `pricePerNight`, others = `price`, `priceLevel`
fallback) and adds a `duration` sort for Viator.

## STEP 2 — Per-section filterable fields (only fields PRESENT on recs)

Facets are derived from the fetched recs in `SectionFilterBar`
(`:1087-1180`) — never offered for absent data:

| Source | Filters (cited rec field) |
|---|---|
| **Hotels** (`liteapi`) | price/night (`pricePerNight`), review score (`reviewScore`), chain (`chain`, multi), facilities (`facilities[]`, multi) |
| **Activities** (`viator`) | price (`price`), min rating (`googleRating`), duration buckets (`durationMinutes` → `<2h/2–4h/Half day/Full day`) |
| **Google** | min rating (`googleRating`), price level (`priceLevel`, multi `$`) |

**Deliberately NOT built** (data absent on the rec, per §3 of the audit):
- Viator **category** — `categoryIds` is not on `GrokRecommendation` → no filter.
- Google **type** — `types[]` is not on the rec → no filter.
- **Flights** — out of scope: they're a separate `FlightPicker` component, not in
  `byCategory`; flagged for a later PR if their data is lifted.

## STEP 3 — Filter UI + combine logic + live count

- **`SectionFilterBar`** (`:1087`): a compact row — a Sort `<select>`, source-
  specific range/min `<select>`s, and multi-select chip `<button>`s for
  chains/facilities/durations/price-levels, derived from `items`.
- **Combine rule** — `filterRecs` (`:1043-1059`): **AND across different fields**
  (a rec must pass every active filter), **OR within one multi-select**
  (`toggleIn` builds the set; `chains`/`facilities`/`priceLevels`/`durations`
  pass if the rec matches **any** selected value). Price filter excludes
  unknown-price recs while active (standard faceted behavior).
- **Client-side** — applied to `byCategory[catKey]` recs already in state; **no
  re-fetch**.
- **Live count** — the header count now shows `visible.length`
  (`TravelCarousel:1200`), narrowing as filters apply ("12 hotels" → "4 hotels").
- **Clear** — `SectionFilterBar` and the empty state both reset via
  `onChange({ sort: filter.sort })` (keeps sort, drops all filters).

## STEP 4 — Empty-after-filter state (distinct from no-data)

`TravelCarousel:1242-1250` adds a branch **between** no-data and the cards:
```tsx
) : items.length === 0 ? ( …No {label} found for this destination… )   // no DATA
: visible.length === 0 ? (                                              // FILTERED to zero
    <…>No {label} match your filters. <button>Clear filters</button></…>
) : ( …visible.slice(0,12) cards… )
```
Three honest, distinct states: **no data** ("found for this destination"),
**filtered-empty** ("match your filters" + clear), and **results**. Never
fabricated.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Client-side only — ZERO new API calls | ✅ diff grep for `fetch(`/`/api/`/`searchHotelRates`/`getHotelReviews` → none added |
| Filters only for fields present on recs | ✅ facets derived from `items`; Viator-category/Google-type/Flights deliberately excluded |
| No fetch-limit (28d) / enrichment (28c) / card-styling (28e) change | ✅ card JSX, fetch logic, limits untouched |
| Pricing / charge path / fetch logic untouched | ✅ not in diff |
| 0 deps, 0 schema | ✅ native `<select>`/`<button>` |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ 0 new errors (1 pre-existing); **−2 warnings** (dead code removed) |
| git diff = TripPlannerAI.tsx (+ report) | ✅ confirmed |

---

## Result
Every section (Hotels/Activities/Google) now has a compact Excel-style filter +
sort bar that filters the already-fetched results instantly and stackably (AND
across fields, OR within a multi-select), with a live count and an honest
"no match" state — at **zero extra API cost**. Foundation for 28c (enrichment),
28d (population), 28e (polish).
