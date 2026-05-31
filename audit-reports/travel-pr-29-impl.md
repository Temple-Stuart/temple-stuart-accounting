# TRAVEL — PR-29 Implementation: editable committed-trip header + fix silent name-PATCH drop

**Branch:** `claude/travel-pr-29`
**Date:** 2026-05-30
**Scope:** New `TripHeader` for committed trips (detail mode); widen the PATCH to
persist name/tripType (silent-drop bug fixed); suppress the search bar on detail.
Landing/new create flow byte-unchanged. 0 schema, 0 deps.

---

## STEP 1 — Widen the PATCH (fix the silent bug)

`src/app/api/trips/[id]/route.ts` — **before** destructured only
`{ destination, startDate, endDate }`, so the bar's `name`/`tripType` were
**silently dropped** (editing the trip name saved nothing). **After**:
```ts
const { destination, startDate, endDate, name, tripType } = body;
…
if (name !== undefined) updateData.name = name;
if (tripType !== undefined && ['personal','business','mixed'].includes(tripType)) updateData.tripType = tripType;
```
`trips.name` (`schema:518`) + `trips.tripType` (`schema:541`) columns already
exist → **no schema change**. The existing `destination`/`startDate`/`endDate`
(+ `daysTravel`/`month`/`year` recompute) logic is **byte-unchanged** (diff is
purely the added lines). **Name now persists.**

## STEP 2 — New `TripHeader` component (detail mode)

`src/components/trips/TripHeader.tsx` — committed-fact styling (white card, brand
palette), editable in place:
- **Name** — inline-editable title input (styled as a heading, not a search
  placeholder); **Update** button PATCHes `{ name, startDate, endDate, tripType }`
  via the widened route (`TripHeader.tsx:64-82`); shows "Updating…/Saved".
- **Destination chips** — from `trip_destinations`; **add** (autocomplete via
  `searchDestinations`) → `POST /api/trips/[id]/destinations { name, country }`,
  **remove** (×) → `DELETE { resortId | destinationId }` (mirrors
  `DestinationSelector`); both **persist immediately** then call `onChanged`
  (`:96-130`).
- **Date range** — two date inputs → PATCH (recomputes `daysTravel` server-side).
- **Travelers** — **READ-ONLY** count + a "Manage" link (`:206-210`); the full
  add/edit editor is **PR-31**.
- **Trip type** — compact personal/business/mixed toggle (now persisted via the
  widened PATCH).

## STEP 3 — Search bar suppressed on detail

- **AppLayout** (`AppLayout.tsx:145-150`): `showTravelSearch` now excludes the
  trip-detail route:
  ```ts
  const isTripDetail = /^\/(budgets\/)?trips\/[^/]+\/?$/.test(pathname || '') && !(pathname||'').endsWith('/new');
  const showTravelSearch = TRAVEL_PREFIXES.some(...) && !isTripDetail;
  ```
  So the global `TripCreationBar` no longer renders its search chrome on a
  committed trip. **Landing (`/budgets/trips`, no id) and `/new` keep the bar**
  (the regex requires a segment after `trips`, and `/new` is excluded).
- **Detail page** (`page.tsx`): renders `<TripHeader …>` as the first child of
  the content (`:610-625`), fed `trip` fields, `destinations` (mapped to
  `{id,resortId,name}`), `participants.length`, and
  `onChanged={() => { loadTrip(); loadDestinations(); loadParticipants(); }}`.
  Added `tripType?: string` to the page's `Trip` interface (`:61`).

**`TripCreationBar.tsx` is untouched** → the new-trip create flow is byte-unchanged.

## STEP 4 — Destination sync (header ⇄ scan chips)

Both the header chips and the scan-row "Scan:" chips read/write the **same
`trip_destinations` source** via the **same** `/api/trips/[id]/destinations`
GET/POST/DELETE endpoints. The header's add/remove call those endpoints then
`onChanged()` reloads the page's `destinations` state (`loadDestinations`) — the
exact state the scan chips render from. So a change in one reflects in the other.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| New-trip CREATE flow (landing/new) byte-unchanged | ✅ `TripCreationBar.tsx` not in diff; AppLayout keeps the bar for landing/`new` |
| PATCH widening adds name/tripType only; destination/date untouched | ✅ diff is purely additive (shown above) |
| Travelers read-only (editor = PR-31) | ✅ count + "Manage" link, no editing |
| Scan sections (28a) / filtering (28b) / enrichment (28c) / aesthetics (28e) untouched | ✅ not in diff |
| 0 schema, 0 deps | ✅ name/tripType columns exist; lucide + destinations.ts already present |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ `TripHeader` 0/0; route/AppLayout/page error counts identical to main (no new errors) |
| git diff = TripHeader + page + PATCH route + AppLayout (+ report) | ✅ confirmed |

---

## Result
A committed trip now opens with a purpose-built header presenting its name,
destinations, date range, traveler count, and type as **editable committed
facts** — name and dates save (the silent name-drop is fixed), destinations
add/remove against the same source as the scan chips, travelers show read-only
with a Manage link (editor in PR-31). The search/create form is unchanged for
new trips.
