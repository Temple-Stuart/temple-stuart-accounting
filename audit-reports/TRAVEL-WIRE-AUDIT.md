# TRAVEL-WIRE AUDIT — building the Travel section as the confirmed 1-2-3-4 layout

**Type:** Audit — READ ONLY. Nothing modified.
**Target layout (top→bottom):** (1) Create-a-trip bar (name, multi-destination,
start/end dates, travelers, Personal/Business/Mixed); (2) Your trips list (click to
select/highlight + DELETE); (3) the SELECTED trip's **Budgeted** + **Actual** items as
two horizontal-scroll rows; (4) the API search stack (flights/hotels/activities/visa)
vertically stacked below — committing from (4) saves an item UP into (3) for the
selected trip.

Citations are `file:line` / `prisma/schema.prisma` lines.

---

## TL;DR readiness

| Piece | Status | Note |
|---|---|---|
| (1) Create bar fields | **mostly EXISTS** | multi-dest is entered but **only the first is saved**; entity not set from the tag |
| (2) Trips list + select | **EXISTS** (Trips1/Trips2) | — |
| (2) DELETE trip | route EXISTS, **UI button MISSING** | DELETE `/api/trips/[id]` cleans 8 tables; no home button |
| (3) Budgeted read | **EXISTS** | `GET /api/trips/[id]/budget` → `budget_line_items` |
| (3) Actual read | **MISSING** | no route returns a trip's `reservations`; actual lives in a different table |
| (3) Horizontal queue UI | **MISSING** | the two scroll rows don't exist |
| (4) API stack (UI) | **EXISTS** | flights/hotels/activities/visa already stacked |
| (4) Commit → selected trip (home) | **MISSING** | widgets don't receive `currentTrip`; commit only works inside a trip page |
| (4) Hotel BUDGET path | **MISSING** | hotels PAY only (reservations); can't be "saved as budget" |
| Daily-burn per line | **EXISTS (reusable)** | `coveredDays`/`share` in `TripTimelineView` |

**The hard part is (4): a home-page commit-to-the-selected-trip path, and giving
hotels a budget path.** Everything above it is small/read-only.

---

## 1. CREATE-A-TRIP BAR

`CreateTripForm` (`src/components/trips/CreateTripForm.tsx`) has every field the layout
needs:
- **name** (`:33`), **multi-destination** — `selectedDestinations: string[]` with
  autocomplete + chips (`:39`, render `:159`), **start/end dates**, **travelers**,
  **trip type** Personal/Business/Mixed (`tripType` state `:43`, toggle `:247`).
- **⚠ But the POST saves only the FIRST destination:** the body sends
  `destination: selectedDestinations[0] || null` (`:112`). The `trips` table column is
  a single `destination VARCHAR(255)` (`schema:519`); multiple destinations belong in
  the `trip_destinations` table (`schema:711`), which the create form does **not**
  write. → **Multi-destination is captured in the UI but lost on save** (gap to flag).
- **POST payload** (`:110-115`): `{ name, destination (single), startDate, endDate,
  tripType }`. The route `POST /api/trips` stores `tripType` → `trips.tripType`
  (`route.ts:64,72`) and derives month/year/days from the dates.
- **Entity:** `trips.entity_id` is **NOT set** from the Personal/Business/Mixed tag —
  the create `data` block (`route.ts:66-75`) never writes `entity_id`; the tag is only
  stored as `trips.tripType`. So `trips.entity_id` stays null/unused (confirms the
  earlier unify audit). A budget action needing an entity must resolve it elsewhere
  (default entity / map tripType→entity).

---

## 2. YOUR TRIPS LIST + DELETE

- **List + selection** (Trips1/Trips2): `AllTripsList` fetches `GET /api/trips`,
  renders rows, and selection is **lifted** — row click → `onSelect?.(trip)`
  (`AllTripsList.tsx:95`), highlight via `selectedTripId` (`:96-97`); ModuleLauncher
  holds `currentTrip` (`ModuleLauncher.tsx:108`, `onSelect={setCurrentTrip}` `:188`).
  The selected trip is readable. **EXISTS.**
- **DELETE route EXISTS** — `DELETE /api/trips/[id]` (`route.ts:90-143`) deletes, in
  order: `expense_splits` (`:121`), `trip_expenses` (`:124`), `trip_itinerary`
  (`:127`), `trip_destinations` (`:130`), `budget_line_items` (`:134`),
  `calendar_events` (raw, `source='trip' AND source_id=id`, `:137`),
  `trip_participants` (`:138`), then `trips` (`:141`). `reservations` aren't deleted
  explicitly but **cascade** via FK (`reservations.tripId … onDelete: Cascade`,
  `schema:1175`).
- **DELETE button MISSING** — `AllTripsList` has only the selection click; no row
  delete button calls `DELETE /api/trips/[id]` anywhere on the home list (the only
  trip-level delete UI lives on the trip detail pages for sub-resources, not the trip).
  → **Add a delete button to the home list** (small).

---

## 3. THE SELECTED TRIP'S BUDGETED + ACTUAL ROWS

**Budgeted vs Actual are in DIFFERENT tables** (not two columns on one row):
- **BUDGETED** = `budget_line_items` — one `amount Decimal(12,2)` column (`schema:1044`),
  no separate actual column. Linked by `tripId` (`:1038`) and 1:1 to an itinerary line
  via `itineraryId` (`:1040`). The planned cost also lives on `trip_itinerary.cost`
  (`schema:656`).
  - **Read route EXISTS:** `GET /api/trips/[id]/budget` → `budget_line_items.findMany({
    where: { tripId, userId } })` returns `{ items }` (`budget/route.ts:25-27`).
- **ACTUAL** = `reservations.finalPriceCents` (`schema:1168`) for paid hotel bookings
  (`tripId` `:1157`, `checkinDate`/`checkoutDate` `:1166-1167`, `status` `:1163`).
  - **Read route MISSING:** no endpoint returns a trip's `reservations` (grep of
    `src/app/api` for reservations-by-tripId → none). The only writer is the hotel
    book route. → **Add `GET /api/trips/[id]/reservations`** for the Actual row.
  - Note: flights/activities have **no actual at all** today (no pay path — see §4),
    so the Actual row is hotel-reservations-only until pay paths exist.
- **GET /api/trips/[id]** returns `participants + expenses + itinerary` but **not**
  budget_line_items or reservations (`route.ts:29-51`) — so the two rows need the
  `/budget` route + a new `/reservations` route (not the single-trip GET).
- **Daily-burn** (per-line per-day figure): `coveredDays(homeIso,destIso)` +
  `share = total / days` already exist (`TripTimelineView.tsx:117-120,144-147`),
  reading `trip_itinerary` dates + `cost`. Reusable for each row's per-day number.
- **The horizontal-scroll display component MISSING** — nothing renders "this trip's
  budgeted items" / "actual items" as two rows; it's a new read-only component fed by
  the two routes, filtered by `currentTrip.id`.

---

## 4. THE API STACK COMMIT → SAVES UP (the loop) — the gap

- **Home search widgets do NOT receive the selected trip.** `PublicFlightSearch`,
  `PublicHotelSearch`, `PublicActivitySearch` are rendered with only `onRequireAuth`
  (`ModuleLauncher.tsx:309,310,319`) — `currentTrip` (`:108`) is **not threaded in**.
  So no widget knows which trip to attach a commit to.
- **Per item type — can it commit to the selected trip on the home page?**
  - **Flight:** commit = `FlightPicker → POST /api/trips/${tripId}/vendor-commit`
    (writes `budget_line_items` + `trip_itinerary` + `calendar_events`) — but that runs
    **inside a trip page** with `tripId` from the route. Home `PublicFlightSearch`
    "Commit to Budget" → `onRequireAuth()` (`PublicFlightSearch.tsx:149`), no commit.
    → **home flight-budget MISSING.**
  - **Hotel:** "Book" → `CheckoutPanel` → Stripe → `liteapi/book` writes
    **`reservations`** only (PAY). There is **no budget path** — a hotel can't be
    "saved as a plan." → **hotel BUDGET MISSING** (the layout's Budgeted row needs it).
  - **Activity:** like flight — `vendor-commit` inside a trip page; home → `onRequireAuth`.
    → **home activity-budget MISSING.**
- So the whole "commit from (4) saves up into (3)" loop is MISSING on the home page:
  (a) no widget receives `currentTrip`; (b) no home commit route that writes a budget
  line for the selected trip; (c) hotels have no budget path at all.
- **This is where the unify work lands:** the `hub_scheduled_items` master (now with
  `vendor`/`item_type`/`trip_id`/`provider_ref` from PR-HCR2-cols) is the natural target
  for a **unified commit-to-budget route** all three types use — but nothing writes it
  yet, and the calendar doesn't read it yet (per BUDGET-PAY-UNIFY-AUDIT).

---

## 5. THE LAYOUT REWORK

**Travel today** = two places:
- `renderBody('travel')` (`ModuleLauncher.tsx` travel branch): the PR-MODULE-INTROS
  intro + an explainer + `CreateTripForm` + `AllTripsList` + the "Selected: <name>"
  indicator (`:184-198` region).
- The travel stack inside `MODULES.map` (`:308-…`): `PublicFlightSearch` (`:309`),
  `PublicHotelSearch` (`:310`), `ComingSoonSection` "Getting around", `PublicActivitySearch`
  (`:319`), `PublicVisaCheck`, then ComingSoon insurance/eSIM/events.

**Rework to 1-2-3-4:**
1. **Create bar** — already first (the `CreateTripForm`). Presentational keep; fix
   multi-dest save (data).
2. **Trips list + select + DELETE** — `AllTripsList` already here; **add a delete
   button** (small). Selection already lifted.
3. **Selected-trip Budgeted + Actual horizontal rows** — NEW component, inserted
   between the trips list and the search stack, shown when `currentTrip` is set; reads
   `/budget` (+ a new `/reservations`). Read-only display.
4. **API stack** — the existing flights/hotels/activities/visa widgets move directly
   under (3); presentational reorder, EXCEPT they must be **wired** to commit to
   `currentTrip` (the hard part, §4).

So (1)(2-list)(4-UI) are largely **presentational moves**; the **commit-wiring** in
(4) and the **Actual read + horizontal display** in (3) are the real builds; the
**delete button** in (2) is a small build.

---

## REPORT: EXISTS | MISSING | THE STAGED PLAN

### Readiness (piece × status)
| Piece | EXISTS | MISSING |
|---|---|---|
| Create fields (name/multi-dest/dates/travelers/type) | all in UI | multi-dest **save** ([0] only, `CreateTripForm:112`); entity from tag |
| Trips list + select | `AllTripsList` + `currentTrip` | — |
| Delete trip | `DELETE /api/trips/[id]` (8-table clean) | **home delete button** |
| Budgeted read | `GET /api/trips/[id]/budget` | — |
| Actual read | `reservations` table | **read route** for reservations |
| Budgeted+Actual horizontal UI | daily-burn math | **the 2-row component** |
| Commit→selected trip (home) | `vendor-commit` (trip-page only) | **currentTrip not threaded; no home commit path** |
| Hotel budget path | hotel PAY (reservations) | **hotel→budget write** |
| Daily-burn per line | `coveredDays`/`share` | re-attach per line |

### Staged sequence (dependency-ordered)
1. **Delete-trip button** (home `AllTripsList` → `DELETE /api/trips/[id]` + refresh).
   Self-contained, small. The route already cleans everything.
2. **Actual read route** — `GET /api/trips/[id]/reservations` (the missing Actual
   source). Small, read-only.
3. **Budgeted + Actual horizontal rows** — new read-only component fed by `/budget`
   (budgeted) + `/reservations` (actual), filtered by `currentTrip`; reuse daily-burn.
   Depends on #2 + `currentTrip` (Trips2 ✓).
4. **Layout rework to 1-2-3-4** — reorder the existing widgets (create → trips →
   selected-trip rows → API stack). Mostly presentational.
5. **Commit-to-selected-trip wiring** (the hard part) — thread `currentTrip` into the
   search widgets; a home commit route that writes a budget line for the selected
   trip; **give hotels a budget path**. Best done against the `hub_scheduled_items`
   master (cols added in PR-HCR2-cols) via one unified commit route, then point the
   calendar feed + the (3) rows at the master.
6. **Daily-burn per line** — wire `coveredDays`/`share` into each row's per-day figure.

### Gaps to flag
- **Multi-destination** is entered but not persisted (only `destination[0]`); needs
  `trip_destinations` writes if the layout must keep multiple.
- **`trips.entity_id`** null/unused; the Personal/Business/Mixed tag is stored as
  `trips.tripType`, not an entity link — budgeting needs an entity resolved another way.
- **Hotel budget path** absent (pay-only) — the Budgeted row can't include hotels until
  a hotel→budget write exists.
- **Home-page commit target** — `currentTrip` exists but isn't passed to the search
  widgets, and no home commit route writes to the selected trip.
- **Actual read route** for `reservations` is missing.

### Auth
All of (1)(2)(3) and the (4) **commit** are **logged-in / personal**
(`/api/trips*`, `/budget`, `vendor-commit`, `book` require a session; the home list is
`authed === true`-gated). **Search stays guest** (flights/hotels/activities/visa search
routes are public + rate-limited). So: search = guest; select/budget/pay/delete =
account.

---

## Citations index
- Create form: `CreateTripForm.tsx:39,43,112,159,247`; POST `api/trips/route.ts:64,66-75`.
- Trips list/select: `AllTripsList.tsx:95-97`; `ModuleLauncher.tsx:108,188,189`.
- Delete: `api/trips/[id]/route.ts:90-143` (calendar_events `:137`); cascade
  `schema.prisma:1175`; no home button (`AllTripsList.tsx`).
- Budget/actual read: `api/trips/[id]/budget/route.ts:25-27`; `api/trips/[id]/itinerary/route.ts:17-20`;
  single GET `api/trips/[id]/route.ts:29-51`; reservations read MISSING.
- Schema: `budget_line_items:1036-1061` (amount `:1044`); `reservations:1154-1181`
  (finalPriceCents `:1168`, tripId `:1157`); `trip_itinerary:646-681` (cost `:656`);
  `trips.destination:519`, `trip_destinations:711`, `trips.entity_id` null/unused.
- Home widgets (no currentTrip): `ModuleLauncher.tsx:309,310,319`; flight home commit →
  auth `PublicFlightSearch.tsx:149`.
- Daily-burn: `TripTimelineView.tsx:117-120,144-147`.
