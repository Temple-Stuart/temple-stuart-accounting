# TRAVEL — PR-30 Implementation: remove the redundant "Committed Items" panel

**Branch:** `claude/travel-pr-30`
**Date:** 2026-05-30
**Scope:** Delete the "Committed Items" panel + its exclusively-used prep
pipeline; lift Map + Itinerary out of the shared IIFE. 1 file + report.
0 schema, 0 deps, 0 endpoint changes.

---

## STEP 1 — Dead-code boundary

The IIFE at `page.tsx:625-833` rendered **three** things: the **Map**
(`:716-723`, needs `destinations`/`trip.destination`/`selectDestination`), the
**Itinerary calendar** (`:726-777`, needs `calendarEvents`/`tripDates`/
`itinView`/`agendaGran`/`handleEventClick`/`TRIP_SOURCE_CONFIG`), and the
**Committed Items panel** (`:779-830`). The prep pipeline (`:626-711`) — `itinerary`,
`DINING_CATEGORIES`, `scannerNameToDest`, `resolveDestination`,
`resolveCategoryLabel`, `CATEGORY_SORT_ORDER`, `CATEGORY_BADGE_COLORS`,
`resolvedItems`, `deduped`, `allItems`, `byDestination`, `destEntries` — fed
**only** the panel. The Map + Itinerary use **none** of it.

## STEP 2 — Verified zero other consumer (whole-file grep)

Each deleted symbol was used only within the IIFE/panel:

| Symbol | Consumers (before) | Other consumer? |
|---|---|---|
| `destEntries` | def `:707`, panel `:780` | none → dead |
| `byDestination` | `:696-707` | none → dead |
| `allItems` | `:687,:697` | none → dead |
| `deduped` | `:676-687` | none → dead |
| `resolvedItems` | `:657-677` | none → dead |
| `resolveDestination` | `:638,:665` | none → dead |
| `resolveCategoryLabel` | `:641,:672` | none → dead |
| `CATEGORY_SORT_ORDER` | `:649,:704` | none → dead |
| `CATEGORY_BADGE_COLORS` | `:650,:795` (panel) | none → dead |
| `DINING_CATEGORIES` | `:627,:644` | none → dead |
| `getDiningCategoryKeys` (import `:15`) | only `:627` | none → import removed |
| IIFE-local `scannerNameToDest` (`:630`) | only `:639` | distinct from the budget-loader `:296` + calendarEvents `:436` copies → dead |

`scannerResults`, `vendorOptions`, `trip.itinerary` are **kept** (the
`calendarEvents` transform at `:431+` still uses them).

## STEP 3 — Removed panel + dead prep; lifted Map/Itinerary

- Deleted the **Committed Items panel JSX** (`:779-830`).
- Deleted the **orphaned prep** (`:626-711`).
- **Lifted Map + Itinerary out of the IIFE** — they now render directly as
  siblings of the trip content (`page.tsx:625-660`, dedented), no IIFE wrapper.
- Removed the now-unused `getDiningCategoryKeys` import (`:15`).

Before: `{(() => { …prep… return (<> Map; Itinerary; CommittedItems </>) })()}`.
After: `{/* … */} <div>…Map…</div> <div>…Itinerary…</div>` (two plain siblings).

## STEP 4 — Preserved what matters

- **`handleUncommitItem`** still defined (`:381`) and used by the **Itinerary
  event popover's Uncommit button** (`:1109`) — the panel's button (the only `-`
  line touching it) is gone, but the popover affordance remains.
- **Committed Budget block byte-unchanged** (diff shows no `-`/`+` on
  `committedBudgetItems` / the Committed Budget JSX).
- **Map + Itinerary render identically** (same JSX, just unwrapped + dedented).
- `trip.itinerary` / `vendorOptions` still feed `calendarEvents`.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Removed Committed Items + ONLY its exclusively-used prep | ✅ Step 2 grep proves zero other consumer |
| Map / Itinerary / Committed Budget / Crew / Flights / scan sections unchanged | ✅ only the panel + its prep removed; Map/Itinerary JSX preserved |
| `handleUncommitItem` + popover uncommit preserved | ✅ `:381` def + `:1109` popover call intact |
| 0 schema, 0 deps, 0 endpoint changes | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| lint clean, no orphaned vars | ✅ page errors **44 → 34** (−10, the deleted `any`-typed prep), warnings 21 → 20; **0 new** |
| git diff = page.tsx (+ report) | ✅ `git diff --name-only main` = page.tsx only |

`git diff --numstat`: **+63 / −207** (net ~−144; the +63 is the dedented
Map/Itinerary lines re-indented, not new logic).

---

## Result
The redundant "Committed Items" panel (which showed "No items committed yet" and
duplicated Committed Budget — and excluded flights) is gone, along with its
~85-line prep pipeline. Map and Itinerary render unchanged as direct siblings.
Uncommit still works via the Itinerary popover; Committed Budget is untouched and
still receives every committed expense. The removal also cleared 10 pre-existing
lint errors that lived in the deleted dead code.
