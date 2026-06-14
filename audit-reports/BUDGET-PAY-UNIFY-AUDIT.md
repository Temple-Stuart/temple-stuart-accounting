# BUDGET-PAY-UNIFY AUDIT — travel items as master calendar/budget lines

**Type:** Audit — READ ONLY. Nothing modified.
**Architecture target:** the home page IS the app; `hub_scheduled_items` (the 12-col
table from PR-HCR2) is the **master link table** for every item's
date/time/COA/project-or-routine/entity/budget/actual. A travel item (flight/hotel/
activity) should be able to **BUDGET** (create a master line: date, time, vendor,
budget_usd, coa_code, entity, actual=null) and separately **PAY** (fill actual_usd +
book via the vendor) — two acts on one item.

Citations are `file:line` / `prisma/schema.prisma` lines.

---

## TL;DR — the asymmetry, and the bigger gap

- **Hotels = PAY-only.** "Book" opens `CheckoutPanel` → Stripe → `/api/travel/liteapi/book`,
  which writes **`reservations` + `commission_ledger`** and **nothing else** — no
  budget line, no calendar line. (`book/route.ts:167,191`.)
- **Flights/Activities = BUDGET-only.** "Commit to budget" (authed) →
  `/api/trips/[id]/vendor-commit`, which writes **`budget_line_items` + `trip_itinerary`
  + `calendar_events`** — and there is **no working pay/book path** (the Duffel
  `createOrder` exists but is unreachable from the UI). (`vendor-commit/route.ts:228,264,336`.)
- **NONE of them write `hub_scheduled_items`** (grep: zero refs in `src/app/api/trips/`),
  and **the calendar feed doesn't read it either** — `HubCalendar` reads
  `/api/calendar` → `calendar_events` (`HubCalendar.tsx:96`; `calendar/route.ts:30,41`).
  So the master table we built is currently **written by nothing and read by nothing.**
- So the real gap isn't just hotel-vs-flight UX — it's that **two acts on one item
  don't exist for any type** (hotels pay without budgeting; flights budget without
  paying), and the unifier (`hub_scheduled_items`) is unused.

---

## 1. THE TWO FLOWS TODAY

### HOTEL — jumps straight to PAY (Stripe), no budget path
- UI: `PublicHotelSearch` "Book" opens `<CheckoutPanel>` directly (guest-capable)
  (`PublicHotelSearch.tsx:18`, comment `:90-92`). There is **no "budget this hotel
  without paying"** button anywhere.
- `CheckoutPanel` runs prebook → LiteAPI hosted Payment SDK (Stripe redirect) →
  `/booking/confirm` → `POST /api/travel/liteapi/book`.
- **What book writes** (`book/route.ts`): in one transaction (`:166`),
  `tx.reservations.create({…})` (`:167`) + `tx.commission_ledger.create({…})` (`:191`).
  The `reservations` row carries the PAY/actual: `checkinDate`, `checkoutDate`,
  `hotelName`, `finalPriceCents`, `bookingType` (guest|account), optional `tripId`
  (resolved at `:116` when present). **No `budget_line_items`, no `calendar_events`,
  no `trip_itinerary`, no `hub_scheduled_items`.**
- Net: a hotel booking is an **actual with no budget line and no calendar tile**.

### FLIGHT — commit-to-budget only, login-gated, no pay
- Public UI: `PublicFlightSearch` "Commit to Budget" → `book = () => onRequireAuth()`
  (`PublicFlightSearch.tsx:149`) — login prompt, fires no commit (guests can't budget).
- Authed UI: `FlightPicker.commitLeg()` → `POST /api/trips/${tripId}/vendor-commit`
  with `optionType:'flight'` (`FlightPicker.tsx:250-263`).
- **What vendor-commit writes for a flight** (§3): `budget_line_items` (`:228`) +
  `trip_itinerary` (flight form, `:264`) + `calendar_events` (raw INSERT, `:336`).
- **Pay path?** `lib/duffel.ts:120-151` defines `createOrder` (`/air/orders`) and
  `src/app/api/flights/book/route.ts` exists, but **the UI never calls it**
  (FlightPicker only calls vendor-commit). So flights **budget but never pay/book**.

### ACTIVITY — same shape as flight
- Public UI: `PublicActivitySearch` "Book" → `book = () => onRequireAuth()`
  (`PublicActivitySearch.tsx:72`); search is public (`:56`), commit fires no fetch.
- Authed: commits via the same `vendor-commit` (`optionType:'activity'`) → same three
  writes. **No activity pay/book path exists.**

### The asymmetry table
| Item | Can BUDGET? | BUDGET writes | Can PAY? | PAY writes | Gap |
|---|---|---|---|---|---|
| **Hotel** | ✗ (no budget UI) | — | ✓ Stripe | `reservations` + `commission_ledger` (`book:167,191`) | pay-only; no budget/calendar line |
| **Flight** | ✓ authed | `budget_line_items` + `trip_itinerary` + `calendar_events` (`vendor-commit:228,264,336`) | ✗ (Duffel book unreachable) | — | budget-only; no pay |
| **Activity** | ✓ authed | same as flight (`:228,294,336`) | ✗ | — | budget-only; no pay |
| **(all)** | — | — | — | — | **none write `hub_scheduled_items`** |

---

## 2. THE MASTER CALENDAR AS THE LINK TABLE

### `hub_scheduled_items` columns (PR-HCR2) — what's there vs needed
`prisma/schema.prisma:2949-2980`: `id`, `user_id`, `entity_id`, `starts_at`,
`ends_at`, `cadence`, `rrule`, `coa_code`, `project_id`, `routine_id`, `task_id`,
`routine_step_id`, `is_billable`, `budget_usd`, `actual_usd`, `description`,
timestamps.

- **Already there (the budget/pay split is modeled):** `budget_usd` + `actual_usd`
  (the two acts on one row), `coa_code` (Category), `entity_id` (Entity), `starts_at`/
  `ends_at` (date+time in/out). So **BUDGET fills `budget_usd`, PAY fills `actual_usd`**
  on the same row — the core idea is already representable.
- **MISSING for travel items:**
  - **No `vendor` column** (a flight/hotel/activity needs the booking/vendor name).
  - **No item type/source** — the only "what is this" links are `project_id`/
    `routine_id`; there is no `flight`/`hotel`/`activity` discriminator.
  - **No `trip_id`** link (travel items belong to a trip, not a project/routine).
  - (Optional) **No provider booking ref** (Duffel order id / LiteAPI booking id /
    `reservations.id`) to tie the master line to the actual booking after PAY.

### Do travel commits write `hub_scheduled_items`? — NO
Grep of `src/app/api/trips/` and `vendor-commit`/`book`: **zero** `hub_scheduled_items`
references. Travel still writes the OLD trio (`calendar_events` / `trip_itinerary` /
`budget_line_items`) for flights/activities, and `reservations` for hotels.

### Which table does the calendar READ? — `calendar_events`, NOT the master
`HubCalendar` trip layer fetches `/api/calendar` (`HubCalendar.tsx:96`), whose route
runs `SELECT * FROM calendar_events …` (`calendar/route.ts:30,41`). So:
- **READ today:** `calendar_events` (source='trip').
- **SHOULD be master:** `hub_scheduled_items`.
- **Gap:** `hub_scheduled_items` is **built but orphaned** — no writer, no reader. The
  unifier exists only as a table.

---

## 3. BUDGET vs PAY AS TWO ACTS — what exists vs missing

Target: a travel item → **BUDGET** creates a `hub_scheduled_items` row
(`starts_at`/`ends_at`, vendor, `budget_usd`, `coa_code`, `entity_id`, `trip_id`,
`actual_usd = null`); **PAY** later fills `actual_usd` (+ books via the vendor and
stores the provider ref).

| Capability | Exists today | Missing |
|---|---|---|
| A row that holds both budget + actual | `hub_scheduled_items.budget_usd` + `actual_usd` (`schema:2963-2964`) | nothing — the columns exist |
| Date/time/COA/entity on that row | `starts_at`/`ends_at`/`coa_code`/`entity_id` (`schema:2953-2957`) | nothing — exist |
| Vendor + item type + trip link | — | **vendor, type/source, trip_id columns** |
| A writer (budget) for travel | flights/activities → `vendor-commit` (wrong tables); hotels → none | **unified route writing `hub_scheduled_items`** |
| A pay step that fills actual | hotels → `reservations.finalPriceCents` (separate table); flights → none | **pay route that updates `actual_usd`** + provider book |
| Calendar shows the master line | calendar reads `calendar_events` | **feed/mapper reading `hub_scheduled_items`** |

### Daily-burn (amount ÷ days) — where it attaches
The truth math already exists: `TripTimelineView.tsx:117-147` —
`coveredDays(homeIso,destIso)` (`:117-120`) and `share = total / days` (`:144-147`).
Today it reads `trip_itinerary` (`homeDate`/`destDate` + `cost`). If
`hub_scheduled_items` becomes master, the same math attaches to it directly:
`daily = budget_usd ÷ coveredDays(starts_at, ends_at)` (lodging → "night", else
"day") — the inputs (`starts_at`/`ends_at` + `budget_usd`) already exist on the master
row. So daily-burn re-points cleanly once the feed reads the master.

---

## 4. THE TRIP CONTEXT — the prerequisite gate

Budgeting an item needs a **target** (a trip + entity) to attach to.
- On the home page, `AllTripsList` (PR-HCR-Trips1) has only a **local** `selectedId`
  (`AllTripsList.tsx:43`, set on row click `:91`) — it is **not lifted to a parent, has
  no `onSelect` callback, and resolves no "current trip"** for any other component.
- So today there is **no selected-trip context** a flight/hotel/activity commit could
  read to know WHICH trip/budget to attach to. The authed flight flow only works
  because it runs **inside** a trip page (`/api/trips/${tripId}/vendor-commit` —
  `tripId` from the route), not on the home page.
- **This gates the whole unified flow:** you cannot budget a home-page travel item to a
  master line without first selecting a trip (and resolving its `entity_id`). That's
  the "Trips2" step.

---

## REPORT: THE GAP + THE UNIFIED PLAN

### The honest target
Every travel item → a `hub_scheduled_items` **master line**: BUDGET writes the line
(date/time/vendor/`budget_usd`/`coa_code`/`entity_id`/`trip_id`, `actual_usd` null);
PAY fills `actual_usd` and books via the vendor (Duffel/LiteAPI/Viator), storing the
provider ref. The calendar reads `hub_scheduled_items`; daily-burn derives from it.

### What's MISSING to get there
1. **Trip-selection context** (home page) — lift `AllTripsList` selection to a shared
   "current trip" (+ its `entity_id`). Prereq for any budget action.
2. **Columns on `hub_scheduled_items`** — add `vendor` (VarChar), an item
   `type`/`source` (flight/hotel/activity — VarChar or a small enum), `trip_id`
   (link), and optionally `provider_booking_ref`. (budget_usd/actual_usd/coa_code/
   entity_id/starts_at/ends_at already exist.) Schema + psql SQL (additive).
3. **A unified commit-to-budget route** that writes one `hub_scheduled_items` row for
   flight/hotel/activity (replacing the divergent `vendor-commit` trio-write and giving
   hotels a budget path they lack). Account-only.
4. **The calendar feed must read `hub_scheduled_items`** (a new feed/mapper) so master
   lines actually appear — today it reads `calendar_events`.
5. **Pay fills actual** — a per-vendor pay step that sets `actual_usd` (+ books):
   hotels already book (`reservations`) so it would also stamp the master line's
   `actual_usd`/ref; flights would wire the unreachable Duffel `book`; activities need
   a provider.
6. **Daily-burn re-attach** — point `coveredDays`/`share` at `hub_scheduled_items`.

### Staged plan (dependency-ordered)
1. **Trips2 — trip selection** (lift `selectedId` → current trip + entity). Unblocks all.
2. **HCR2-cols migration** — add vendor/type/trip_id (+ provider ref) to
   `hub_scheduled_items` (schema + SQL; additive). Parallel to #1.
3. **Unified budget route** — `POST` that writes a `hub_scheduled_items` master line
   from a flight/hotel/activity offer + the selected trip. Account-only.
4. **Master calendar feed** — read `hub_scheduled_items` into the calendar (alongside
   or replacing the `calendar_events` trip layer; coordinate with the stale-trips
   cleanup so the old `calendar_events` trip rows don't double up).
5. **Pay → actual** — fill `actual_usd` + book per vendor (hotels first — the book
   route already exists; flights next via Duffel; activities later).
6. **Daily-burn** — re-attach the existing math to the master.

### Security / auth model (confirmed)
- **Search = guest** (public, rate-limited + capped): flights/hotels/activities search
  routes are in PUBLIC_PATHS, no auth gate.
- **BUDGET = logged-in (personal)** — creating a master/budget line needs a trip +
  entity, which are account-scoped; the existing flight commit is authed+trip-scoped
  (`vendor-commit`). The unified budget route must stay account-only.
- **PAY** — nuanced: hotels already allow **guest** pay (the acquisition booking —
  `reservations.bookingType='guest'`, `book/route.ts`), so PAY is guest-capable for
  hotels but BUDGETING (attaching to a trip) remains account-only. Flights/activities
  have no pay path yet; when built, keep search guest / budget account / pay per the
  hotel precedent (guest pay allowed, trip-link account-only).

---

## Citations index
- Hotel pay: `api/travel/liteapi/book/route.ts:116,166-167,191`; UI
  `PublicHotelSearch.tsx:18,90-92`.
- Flight commit: `PublicFlightSearch.tsx:149`; `FlightPicker.tsx:250-263`;
  `vendor-commit/route.ts:228,251,264,294,336` (no `hub_scheduled_items`); Duffel pay
  `lib/duffel.ts:120-151`, `api/flights/book/route.ts` (unreachable).
- Activity: `PublicActivitySearch.tsx:56,72`.
- Master table: `prisma/schema.prisma:2949-2980` (budget_usd/actual_usd `:2963-2964`;
  no vendor/type/trip_id).
- Calendar reads `calendar_events`: `HubCalendar.tsx:96`; `api/calendar/route.ts:30,41`.
- Daily-burn math: `TripTimelineView.tsx:117-120,144-147`.
- Trip selection (local only): `AllTripsList.tsx:43,91`.
