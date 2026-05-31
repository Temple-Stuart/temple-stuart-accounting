# TRAVEL — PR-28e1 Audit: lift per-API sections into peer top-level sections

**Branch:** `claude/travel-pr-28e1-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Goal:** Lift each API (Hotels/Ground Transport/Activities/Places) out of the
one "Trip Planner & Budget" panel into its own peer top-level section (like
Flights), each carrying its own 28b filters. Structural only (aesthetic fusion =
PR-28e2).

---

## 1. Current Trip-Planner composition (shared vs per-API)

The planner spans **two files**:

- **`page.tsx` "Trip Planner & Budget" panel** (`:1016-1083`, `id="trip-planner-section"`):
  panel header (`:1018`), the **"Scan:" destination chips + `DestinationSelector`**
  (`:1023-1053`, drive the active `trip.destination` via `selectDestination`
  `:325`), then `<TripPlannerAI city={activeDest} … />` (`:1067`).
- **`TripPlannerAI`** (1387 lines) holds:
  - its **header** (`:753-810`): city label + **per-location date inputs (PR-19,
    bound to internal `perLocationDates`)** + **Refresh** (`rescanAll` `:376`);
  - the **section loop** (`:911-934`): one `<TravelCarousel>` per `CAROUSEL_ORDER`
    category, each with its own **28b `SectionFilterBar`** (local `filter` state,
    `:1197`) + **28d load-more** (`shown`, local);
  - the **scan engine + state** (~25 `useState`): `byCategory` (`:192`),
    `loadingCategories` (`:230`), `categoryErrors` (`:231`), `perLocationDates`
    (`:236`), `scannerMeta`, + `autoScanCategoriesFor`/`scanSingleCategory`/
    `rescanAll` (one Promise.allSettled batch populates **all** categories);
  - the **commit flow + state**: `committedCards`, `cardPrices`/`cardDates`/
    `cardFrequency`/`cardTimes`, `handleCommitCard` (`:518`),
    `handleUncommitCard`, the edit + custom-add modals.

| | Lives in | Lift target |
|---|---|---|
| **SHARED** — Scan chips | page.tsx `:1023-1053` | → control bar |
| **SHARED** — per-location dates + Refresh | TripPlannerAI header `:753-810` | → control bar |
| **SHARED** — scan engine + `byCategory`/`perLocationDates`/`loadingCategories`/`categoryErrors` | TripPlannerAI state `:192-236` | → **lifted up (context/hook)** |
| **SHARED** — commit state + `handleCommitCard`/modals | TripPlannerAI `:211-218,:518` | → lifted up (context/hook) |
| **PER-API** — `<TravelCarousel>` + 28b `SectionFilterBar` + 28d load-more | TripPlannerAI loop `:911`, component `:1194` | → **each becomes a peer section** (consumes shared state) |

The per-API pieces are **already per-instance components** (one TravelCarousel +
local filter/shown per category) — the lift is about *where they render* (peer
top-level vs inside the panel) and *how they read the scan data*.

## 2. Flights peer-section template (the model to match)

Flights is already a peer top-level section — `page.tsx:997-1014`:
```tsx
{tripDates && trip.destination && (
  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
    <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Flights</div>
    <div className="bg-white p-4"><FlightPicker … /></div>
  </div>
)}
```
**Template:** a `rounded-lg border shadow-sm` card + a brand-purple header band +
a `bg-white p-4` body. Each lifted API section should match this (own header,
source badge, count, 28b filters, results).

## 3. The shared scaffolding's new home

The chips + per-location dates + Refresh drive **every** API search, so they
can't live inside one API section. **Proposal: a "Destinations & Dates" control
peer section** (above the API sections) holding: the destination chips (moved out
of `page.tsx:1023-1053`), the per-location date inputs + the dates-valid guard,
and the **Refresh** button (`rescanAll`). The API sections below consume the
shared scan state it triggers.

## 4. State lift — THE CRUX

Today the API sections read `byCategory[catKey]` / `loadingCategories` /
`categoryErrors` — **all internal to TripPlannerAI**. Lifting sections to peer
level means lifting that state (and the engine) **up** so each peer can read it.

**Recommended: a `TripScanContext` provider (or a `useTripScan(tripId, city,
tripDates)` hook)** that owns:
- scan state: `byCategory`, `perLocationDates`, `loadingCategories`,
  `categoryErrors`, `scannerMeta`;
- the engine: `autoScanCategoriesFor` / `scanSingleCategory` / `rescanAll`
  (one batch still populates all categories — unchanged behavior);
- the commit flow: `committedCards`, the `card*` maps, `handleCommitCard` /
  `handleUncommitCard`, the edit/custom modals.

Then the trip content wraps in the provider, and:
- **`<TripScanControls>`** (chips + dates + Refresh) consumes it;
- each **`<TripApiSection source category>`** consumes `byCategory[category]` etc.
  and renders the existing TravelCarousel + 28b filter + 28d load-more.

A context avoids threading ~25 values + the engine through `page.tsx` as props.
**This lift is the riskiest part** — it touches the scan engine, the commit
flow, and the card-commit modals.

## 5. Budget — already a peer; nothing moves

"& Budget" in the panel title is just a label. The actual **Committed Budget is
already an independent peer section** (`page.tsx:741-780`, reads
`committedBudgetItems` via the page's `loadBudgetItems`) — **not** inside
TripPlannerAI. When the planner dissolves, the "& Budget" title disappears and
the Committed Budget section stays put. The commit flow (vendor-commit → `/budget`
→ `loadBudgetItems`) is preserved, owned by the lifted engine.

## 6. Proposed page-level section tree (target)

Current order (`page.tsx`): TripHeader (`:659`) → Map/Itinerary (`:674-687`) →
**Committed Budget** (`:741`) → **Crew** (`:892`) → **Flights** (`:997`) →
**Trip Planner & Budget** (chips + all APIs, `:1016`) → Commit to Ledger (`:1084`).

**Target:**
```
TripHeader
Map
Itinerary
[Destinations & Dates control]   ← new (chips + dates + Refresh)
Flights            (Duffel — existing peer)
Hotels             (LiteAPI — lifted; carousel + load-more + 28b)
Ground Transport   (Mozio — lifted; 501 "coming soon")
Activities         (Viator — lifted; 28b + load-more)
Places             (Google — lifted; 28b)
Committed Budget   (existing peer)
Crew               (existing peer)
Commit to Ledger   (existing)
```
Each API section: own header + source badge + count + 28b filters + results
(matching the Flights card chrome, §2). So the lift **also reorders** sections
(Flights moves up; API sections become peers above Committed Budget).

## 7. Scope + risk

**Large.** `page.tsx` + a TripPlannerAI teardown:
- **New** `TripScanContext`/provider **or** `useTripScan` hook (the lifted engine
  + state + commit) — the bulk of the work.
- **New** `TripScanControls` (chips + dates + Refresh).
- **New** `TripApiSection` (per-API section chrome wrapping the existing
  TravelCarousel/filter/load-more).
- `page.tsx`: wrap content in the provider; render the control bar + 5 API peer
  sections in the target order; remove the "Trip Planner & Budget" panel + the
  chips block.
- `TripPlannerAI` is largely **dissolved** (its state/engine → context; its
  sections → TripApiSection).

**Estimate:** ~400-600 lines moved/refactored across ~4-5 files. **0 schema, 0
deps.** **Riskiest part: the state lift** (byCategory/perLocationDates/scan
engine/commit flow + the card-commit + custom-add modals) — a regression here
breaks scanning or committing for every source.

**Recommend sub-sequencing** (lower risk):
- **28e1a** — extract the scan engine + state + commit into `useTripScan` /
  `TripScanContext` with **no visual change** (TripPlannerAI still renders the
  same UI off the context); verify scan/commit parity.
- **28e1b** — render the control bar + per-API peer sections from the context and
  reorder; retire the planner panel.

## What needs Alex sign-off
1. **Lift mechanism** — `TripScanContext` (recommended) vs a `useTripScan` hook
   vs prop-drilling through page.tsx.
2. **Sub-sequence 28e1a/28e1b** (recommended) vs one big PR.
3. **Control-bar placement + chip relocation** — confirm chips move out of
   page.tsx into the "Destinations & Dates" control section.
4. **Section order** (§6) — confirm Flights moves up and APIs sit above Committed
   Budget.
5. Whether TripPlannerAI is fully dissolved or kept as a thin wrapper.

---

**READ-ONLY audit. No implementation performed.**
