# TRAVEL — PR-37a Implementation: trips index structural pass

**Branch:** `claude/travel-pr-37a`
**Date:** 2026-05-31
**Scope:** Trips index (`budgets/trips/page.tsx`) **structural** pass — remove the
"Trip Calendar" + "Trip Locations" sections and the dead `selectedTrip` sidebar,
and replace the search bar with an in-page **create-trip form** that POSTs
`/api/trips` directly (no `/budgets/trips/new` hop). Aesthetic adoption is PR-37b.
Per `audit-reports/travel-pr-37-audit.md`. 3 files + this report. **0 schema, no
endpoint change.**

---

## STEP 1 — Trip Calendar removed (usage only; CalendarGrid preserved)

The `<CalendarGrid>` usage (former `:309-321`) is gone from the index. **`CalendarGrid`
itself is NOT deleted** — grep confirms it's shared by `[id]/page.tsx`, `hub/page.tsx`,
`trading/page.tsx`, `ItineraryAgenda.tsx`, and two hub mappers. Removed the now-dead
**index-local** feeders after confirming each had only the 2 in-file refs
(declaration + single use), now **0 refs** in the rewritten page:
`calendarEvents` state, `loadItineraryEvents` (the per-trip `/api/trips/{id}/itinerary`
fetch storm — also a load-time perf win), `mapCategory`, `TRIP_SOURCE_CONFIG`, the
`ItineraryItem` interface, and the `CalendarGrid` import. Verified 0 remaining refs
for each.

## STEP 2 — Trip Locations removed + TripMap.tsx deleted

The `<TripMap>` usage (former `:323-343`) is gone. **`TripMap` had no other
importer** (grep: only the index + itself) → **`src/components/trips/TripMap.tsx`
deleted** (178 lines). Removed the now-dead `committedTrips` derivation, the
`TripMap` import, and the `leaflet/dist/leaflet.css` import (the index no longer
renders a map; `leaflet` CSS is still imported by `hub` + the detail page, so the
package stays). Grep: **zero `TripMap` references** remain (PR-30 clean-removal
standard). The detail page's map is `DestinationMap` — untouched.

## STEP 3 — Dead `selectedTrip` sidebar removed

The `selectedTrip` sidebar (former `:345-357`) + its `selectedTrip`/`setSelectedTrip`
state are removed. `setSelectedTrip` was never called (the panel could never open) —
dead code. Now **0 refs**.

## STEP 4 — Create-trip form (POSTs `/api/trips` directly)

A new in-page form at the top of the index (`page.tsx`, "Plan a new trip" card)
collects: **name** (required), **destination(s)** (autocomplete via
`searchDestinations`, chips), **date range** (start/end), **travelers** (1-8
select), **trip type** (Personal/Business/Mixed toggle). On submit, `handleCreate`
**POSTs `/api/trips` directly** then `router.push('/budgets/trips/{id}')` — **no
`/budgets/trips/new` hop** (the old landing bar's extra redirect).

**Required fields (cited, `api/trips/route.ts:106`):** `name` AND a resolvable
`month`+`year`+`daysTravel`. The endpoint **derives** month/year/daysTravel from
`startDate`+`endDate` (`:33-48`) and persists the dates (`:132-133`), so the form
sends `{ name, destination, startDate, endDate, tripType }` — **no endpoint
change.** PR-33 date discipline: `canCreate = name && startDate && endDate &&
endDate >= startDate` (no fallback); an invalid range shows an inline error and
blocks submit; a failed POST surfaces the real error (fail-loud), no silent
redirect. Travelers is collected but **not persisted** (the POST seeds only the
owner participant; additional crew are added on the detail page — per the audit,
no bulk-traveler-create exists at trip-create) — it's a cosmetic field for now,
documented.

## STEP 5 — AppLayout bar suppressed on the index

`AppLayout.tsx:154-156` — added `isTripIndex = /^\/(budgets\/)?trips\/?$/.test(pathname)`
and `showTravelSearch = … && !isTripDetail && !isTripIndex`. So the global
`TripCreationBar` no longer renders on `/budgets/trips` or `/trips` (the in-page
form replaces it — no double bar). **Verified across 5 routes** (node harness):
index `/budgets/trips` → **hidden**; `/budgets/trips/new` → **shows** (create
page, unaffected); detail + discover → hidden (PR-29/32, unchanged); `/trips`
index → hidden. Landing/`new`/detail behavior otherwise intact.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| CalendarGrid NOT deleted (shared); only index usage removed | ✅ component intact (6 other importers); index ref = 0 |
| TripMap deleted only after grep-confirmed no other importer | ✅ no other importer; file deleted; zero orphan refs |
| Dead feeders removed only after zero-other-use confirmed | ✅ all index-local; 0 refs after |
| POST /api/trips unchanged (no endpoint/schema change) | ✅ not in diff; form uses existing fields |
| Detail (Itinerary/DestinationMap), hub, trading untouched | ✅ not in diff |
| Structural only (aesthetic = 37b) | ✅ basic styling; no template adoption |
| 0 schema, 0 deps removed-without-check | ✅ leaflet pkg retained (hub/detail use it) |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ index page **0 problems**; AppLayout 1 warning (`'e'` :98 — **pre-existing on main**, untouched) |
| git diff scoped | ✅ `page.tsx` (M), `TripMap.tsx` (D), `AppLayout.tsx` (M) (+ report) |

---

## Result
The trips index is now: an in-page **create-trip form** (name + destination(s) +
date range + travelers + trip-type → POST `/api/trips` directly → redirect to the
new trip's detail page) above the **All Trips** table. The Trip Calendar and Trip
Locations sections and the dead `selectedTrip` sidebar are gone, along with their
index-local feeders (incl. the per-trip itinerary fetch storm); `TripMap.tsx` is
deleted with zero orphans, while the shared `CalendarGrid` is preserved. The global
search bar is suppressed on the index (no double create surface), with `/new`,
detail, hub, and trading untouched. No endpoint or schema change. tsc clean; index
lints clean. The full detail-page-template aesthetic adoption is PR-37b.
