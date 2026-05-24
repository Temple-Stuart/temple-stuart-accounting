# Travel-Tab Reality Audit (read-only)

What's actually built in `/budgets/trips` + `/budgets/trips/[id]`, measured against
the new locked model (planning + budgeting + accounting on cheap live data;
affiliate only where good = Duffel flights; booking external; Google Places billing
disabled). No edits. File:line cited; unverifiable items flagged.

> ⚠️ **Top correction:** the brief assumes "realtyapi is data-only." In the actual
> codebase **realtyapi does not exist at all** — zero references in `src/` or
> `prisma/` (grep for `realtyapi` → nothing). Lodging today is **Google Places**,
> not realtyapi. Booking.com appears only as a static external link
> (`HotelPicker.tsx:202`) + a regulatory seed row — **no Booking.com API**. And the
> proposed migration targets **Foursquare / TomTom don't exist** in the repo yet.

---

## 1. Trip model + creation

- **Standalone model `trips`** — `prisma/schema.prisma:513-556` (NOT a routine).
  Fields incl. `destination`, `activities[]`, `month/year/daysTravel`,
  `startDate/endDate/committedAt`, `latitude/longitude`, `tripType`. Relations to
  `trip_participants`, `trip_destinations`, `trip_itinerary`, `budget_line_items`,
  `trip_*_options` (lodging/transfer/vehicle/activity), `trip_scanner_results`.
- **Multi-city storage:** `trip_destinations` (`schema.prisma:695-711`) — `name`,
  `country`, `latitude/longitude`, `isSelected`, **no order/sequence column.**
  GET returns insertion order (`api/trips/[id]/destinations/route.ts` ~:231, no
  explicit `orderBy` on a sequence). **The map route order = insertion order**;
  there is no UI input for it and no field to reorder. Reordering = a schema add.
- **Traveler count — the "1 → 2" bug is real and is a UI default, not the DB:**
  - DB: each `trip_participants.profileGroupSize Int? @default(1)`
    (`schema.prisma:584`); trip creation adds the owner as the sole participant
    (`api/trips/route.ts:136-142`, `isOwner: true`). So reality = **1**.
  - UI: `TripCreationBar.tsx:38` `useState(2)` — the creation bar **defaults
    travelers to 2**, and every fallback reinforces it: `:62`
    `setBarTravelers(trip.participants.length || 2)`, `:93`
    `parseInt(travelers) || 2`. A solo trip (1 participant) therefore shows/seeds
    **2 people** unless manually changed. That's the discrepancy — a hard-coded
    default of 2 in the bar vs. the single-owner DB reality. (Note `||` also means
    a legitimately-loaded `participants.length` of 0 falls back to 2.)

## 2. "Scan destination" / data layer — **Google Places-backed**

- Entry point: `POST /api/trips/[id]/ai-assistant/route.ts` (per-category scan).
  Flow: merge participant profiles → query build → **Google Places** (or Viator for
  bookable-activity categories) → `enrichPlaceDetails` → **Grok** ranking
  (`src/lib/grokAgent.ts` `analyzeWithLiveSearch`) → composite score → **upsert
  `trip_scanner_results`** (JSON recommendations).
- Google client: `src/lib/placesSearch.ts` — Geocoding (`:52`), Text Search
  (`:71-72`, paginated 3×20), Place Photos (`:95`), Place Details (`:124`).
- **Scan output is display-only.** Recommendations are stored in
  `trip_scanner_results` but are **NOT** auto-converted to budget line items. Budget
  items are created later, manually, via commit (§4). So "scan → budget" is **not
  automatic end-to-end** — it's scan → display → user picks → commit.
- "AI Trip Analyzer" = `analyzeWithLiveSearch` (Grok/Anthropic) ranking the Places
  results; output → `trip_scanner_results.recommendations`. (Grok client internals
  not deeply read — flagged as not line-verified beyond the call site.)

## 3. Flights / Duffel — **REAL (search + book), the keep-and-build path**

- `src/lib/duffel.ts` — real HTTP to `https://api.duffel.com` (v2). Token guard
  `:5-6` (`DUFFEL_API_TOKEN not configured` throw). `searchFlights()` (real offer
  requests), and **`createOrder()` (`:120-151`) places a real `type: 'instant'`
  order with passengers + optional `payment`** → this is genuine booking, not a stub.
- Routes: `GET /api/flights/search/route.ts`, `POST /api/flights/book/route.ts`.
- **Manual flight entry:** `components/trips/FlightPicker.tsx` (manual airline/price/
  times) → committed like any vendor option via **vendor-commit** (§4), which writes
  a `budget_line_item` (COA 9100). So both Duffel and manual flights land in the
  budget through the same commit path.

## 4. Itinerary + calendar + budget wiring — **this part genuinely works**

- **Vendor commit** `POST /api/trips/[id]/vendor-commit/route.ts:77-243` (atomic txn):
  for an option (lodging/transfer/vehicle/activity/flight) it (a) creates a
  `budget_line_item` mapped to a COA code (`:145-156`, e.g. lodging→9200,
  flight→9100, activity→9400), (b) creates `trip_itinerary` rows (one per day for
  multi-day), (c) inserts a `calendar_events` row (`source='trip'`). DELETE
  (`:249-312`) reverses all three. **So committing DOES create budgeted expenses +
  calendar blocks.**
- **Trip-level commit** `POST /api/trips/[id]/commit/route.ts:5-250`: takes
  `budgetItems`, writes `budget_line_items` per COA, flips trip to `committed`,
  upserts the monthly `budgets` row, creates the trip calendar event, **and** calls
  Google Places for the destination photo/coords (`:139-163`).
- **Calendar render:** `budgets/trips/[id]/page.tsx:471-594` maps `trip.itinerary`
  into CalendarGrid events (dedupes multi-day lodging by `vendorOptionId`).
- **Trip-level ACCOUNTING STATEMENT: ABSENT.** No statement/summary/report
  generator on the trip pages — accounting is delegated to generic
  `budget_line_items`/budgets on the Hub side. This is the differentiator and it is
  **unbuilt.**

## 5. Travel profile — **real, but only a soft query/ranking nudge**

- Stored on `trip_participants` (`schema.prisma:578-586`): `profileTripType`,
  `profileBudget`, `profilePriorities[]`, `profileVibe[]`, `profilePace`,
  `profileActivities[]`, `profileGroupSize`.
- It **does** reach the scan: `ai-assistant/route.ts:179-234` merges all
  participants' profiles into a `travelerProfile`, which (a) modifies lodging
  queries by trip type (`:309-327`), (b) adds budget/vibe keywords (`:324-327`,
  `:374-379`), (c) applies a budget price-level filter for lodging (`:405-406`), and
  (d) is passed to Grok for fit scoring; a `profileSnapshot` is saved (`:277`).
- **But it does not gate categories or hard-filter results** — it nudges queries and
  the AI score; results still come back whole (the family/no-nightlife rule at
  ~`:237-239` is hardcoded, not profile-driven). So: **keep a light filter; the
  multi-field "ceremony" is mostly decoration beyond budget + a few keywords.**

## 6. Google Places blast radius (billing now OFF)

Every Travel call site hitting Google (file:line → API):
- `src/lib/placesSearch.ts:52` Geocoding · `:71-72` Text Search · `:95` Place Photos
  · `:124` Place Details
- `src/lib/placesCache.ts:37` Place Photos (cache rebuild)
- `src/app/api/places/photo/route.ts:22` Text Search · `:32` Place Photos
- `src/app/api/trips/[id]/ai-assistant/route.ts:117` Place Details (website enrich)
- `src/app/api/trips/[id]/commit/route.ts:139` Text Search · `:155` Place Photos
- `src/lib/verification.ts:26` Find Place · `:59` Place Details · `:73` Place Photos

**With billing off:** all guard on `if (!apiKey)` and **return empty/null, not
errors** — so **scan returns 0 recommendations**, destination photos vanish, website
enrichment drops. **The whole "scan a destination" core silently returns nothing**,
and the UI does not distinguish "API disabled" from "no results for this city"
(flagged UX gap). Viator-category activities still work **if** `VIATOR_API_KEY` is
set (Viator is independent of Google).

## Cross-cutting

- **Viator** (`src/lib/viatorClient.ts`) — **active**, real search (V2 + V1
  fallback), affiliate URLs with partner ID, gated by `isViatorCategory()`; called
  from `ai-assistant:245`. Search only, no booking (external affiliate links).
- **travelCOA** (`src/lib/travelCOA.ts`) — **active** registry mapping categories →
  COA codes/colors/scan-queries/vendorApi; used by vendor-commit.
- **Travel ENTITY: does NOT exist.** `trips` is **user-scoped, not entity-scoped**
  (`schema.prisma:513` — `userId`, no `entity_id`); `budget_line_items` link by
  `tripId`+`userId` (~`:1021-1022`), not to a Travel entity. Multi-entity trip
  accounting would need `entity_id` added to `trips`/`trip_expenses`.

---

## Bottom line + KEEP / REWIRE / CUT

| Feature | Reality | Recommendation |
|---|---|---|
| **Duffel flights (search+book)** | REAL, including real orders/payment | **KEEP & build on** — the one true affiliate/commission path |
| **Vendor-commit → budget + itinerary + calendar** | REAL, atomic, reversible | **KEEP** — this is the working spine of the new model |
| **Trip / destinations / itinerary schema** | REAL (no route-order field) | **KEEP**, REWIRE: add a `sort_order` to `trip_destinations`; add `entity_id` to `trips` for accounting |
| **Scan destination (Google Places)** | REAL but **now dead with billing off**; display-only, not auto-budgeted | **REWIRE** the data source off Google (lodging/photos + POIs) and wire scan→budget; **biggest work item** |
| **Travel profile** | REAL but soft nudge / mostly ceremony | **CUT to a light filter** (budget tier + a few interest keywords); drop the rest |
| **Viator activities** | REAL (search + affiliate links) | **KEEP** as a secondary affiliate (independent of Google) |
| **Trip accounting statement** | **ABSENT** | **BUILD** — the stated differentiator doesn't exist yet |
| **realtyapi / Booking.com / Foursquare / TomTom** | **ABSENT entirely** (Booking.com = one static link) | **BUILD from scratch** if chosen — nothing to keep/rewire |
| **Traveler-count default = 2** (`TripCreationBar.tsx:38`) | BUG vs single-owner reality | **FIX** — default to 1 (or to `participants.length`), drop the `|| 2` fallbacks |

**Direct answers:** Duffel is **real** (search + book + payment), not stubbed.
Scan→budget→ledger is **partial** — commit→budget/calendar works end-to-end, but
scan→budget is manual and scan itself is currently dead (Google billing off). The
trip-level **accounting statement does not exist**. The profile **filters only
softly** (queries + AI score), not as a hard gate. Google Places call sites that
break with billing off are the 13 listed in §6 — that's the data-layer migration
surface.

### Not verified
Grok internals (`grokAgent.ts`) read only at call sites; exact Google cost figures
not independently confirmed; nothing run (auth-gated, headless) — UI behavior
inferred from code.
