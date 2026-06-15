# HOTEL-COMMIT-AUDIT — give hotels the save-to-budget path flights have

**Branch:** `claude/audit-hotel-commit` · **Base:** main @ `8a18b24b` · **Date:** 2026-06-15
**Scope:** READ ONLY. No code changes. Mirrors PR-Flight-Commit for hotels.
**Reference:** `docs/FREEMIUM-MODEL.md` (free to use · account to save · pay to unlock).

---

## TL;DR

The hotel commit route **already exists** — `vendor-commit` handles `optionType: 'lodging'`
including a **synthetic** path for search results with no DB row (`vendor-commit/route.ts:108`,
caller `AddToTripButton.tsx:83-101`). What's missing is purely on the home widget:
`PublicHotelSearch` has **no save-to-budget action at all** — its only button is **"Book"**
(a real guest checkout via `CheckoutPanel`), and it's mounted with only `onRequireAuth`
(`ModuleLauncher.tsx:430`), no `authed`/`currentTrip`/`onCommitted`.

**Key difference from flights:** the flight view already had a "Commit to Budget" button
(only the handler was a stub). The hotel view (`HotelResultsView`) has **only "Book"** — so
hotels need a **new "Save to trip" action added to the card** (a new optional prop), then the
same 3-state branch + the synthetic-lodging `vendor-commit` body. Slightly more than flights
(a new button), but the commit path itself is reusable verbatim.

---

## 1. The current home hotel widget

`src/components/trips/PublicHotelSearch.tsx`:
- **Search (free, always open):** `search()` (`:46-87`) hits the **public**
  `/api/travel/hotels/search` (`:75`) — no auth gate. Results render via `HotelResultsView`
  (`:160`). ✅ free search, leave as-is.
- **Only action = "Book":** `onBook` → `book(hotel)` (`:95-102`) opens a **`CheckoutPanel`**
  (`:168-179`) — a **real guest booking** flow (prebook → guest form → book → confirm), no
  login, no trip. This is the free "vendor booking feed" hook, not a budget save.
- **No save-to-budget exists.** `onRequireAuth` is currently a **no-op**: `void onRequireAuth`
  (`:103`, comment: "reserved for the PR-G4 save-to-trip upsell"). So there is **no** path to
  commit a hotel to a trip as a budgeted line from home.
- **Mounted bare:** `ModuleLauncher.tsx:430` → `<PublicHotelSearch onRequireAuth={onRequireAuth} />`
  — does **not** receive `authed`, `currentTrip`, or `onCommitted` (flights now do, `:425-429`).

`HotelResultsView` (the pure view) exposes a **single** action prop: `onBook: (hotel) => void`
(`HotelResultsView.tsx:55`, button `:236-239`). There is **no** `onSave`/`onCommit` prop — that
must be added (optional/additive). Consumers: only `PublicHotelSearch` renders it
(`ActivityResultsView`/`ResultsFilterBar` reference the module, not a second render), so an
optional new prop is safe.

---

## 2. The working hotel-commit path (already in trip pages)

### The route already handles `lodging` — incl. synthetic
`src/app/api/trips/[id]/vendor-commit/route.ts`:
- `optionType: 'lodging'` is a valid type (`:18`, `:122`) with COA `9200` (`:12`).
- **Synthetic lodging** (`isSyntheticLodging = optionType === 'lodging' && synthetic === true`,
  `:108`) is the path for a hotel **with no `trip_lodging_options` row** — exactly a home search
  result. It builds the budget item straight from the payload (`details = { title: notes,
  amount: requestAmount, tripId }`, `:163-164`) and skips the option-status update (`:170`).
- Unlike synthetic **activity** (which requires `category` + `amount`, `:131-140`), synthetic
  **lodging has no extra validation block** — it just needs the standard `optionType, optionId,
  startDate` (`:118`) + `endDate`/`amount`/`notes`. Simpler than activity.
- Writes the same three things flights do, in one `$transaction`: **`budget_line_items`**
  (`:228`, the budgeted expense, lodging COA), **`trip_itinerary`** via the **date-range
  branch** (`:273-305`, see §below), and **`calendar_events`** (`:325`). Auth+ownership gated
  (`:82-86`). DELETE/uncommit handles lodging too (`:364`, `:434`).

### The reusable commit body (port this)
The working caller is `AddToTripButton.tsx` (the discover detail "Add to trip"), `:83-101`:
```
POST /api/trips/${tripId}/vendor-commit
{ optionType: 'lodging', synthetic: true,
  optionId: `hotel-${liteapiHotelId||'manual'}-${Date.now()}`,
  startDate, endDate, amount,            // amount = whole-stay total (not recomputed)
  notes: `${hotelName} | ${detail}`,
  recurrence: 'daily',                   // a hotel stay = a nightly recurring block
  startTime, endTime,                    // optional daily window
  coa_code, vendor_name, location }      // all optional; route derives COA 9200 if absent
```
This is the **exact shape** to port into the home hotel widget. (There is also `HotelPicker.tsx`
inside trip pages, but it renders via its own manual/option flow and does **not** itself POST
vendor-commit — `AddToTripButton`'s synthetic body is the cleaner, directly-reusable path for
home search results.)

### Hotel date model — check-in / check-out (nights) — handled
Hotels carry **`checkin`/`checkout`** (`PublicHotelSearch.tsx:36-37`), not a single
depart/arrive instant. The route's **date-range branch** (`:273-305`) is built for exactly this:
`startDate→endDate`, `recurrence: 'daily'` for a real range (`isRange`, `:281`), with an
overnight **22:00–07:00** window fallback for lodging (`:289`, `:292`). So `startDate=checkin`,
`endDate=checkout` commits a multi-night stay correctly (one honest budget row, nightly
itinerary block). ✅ the range is handled — no per-night math needed client-side.

---

## 3. The freemium 3-state (mirror flights)

Same branch as PR-Flight-Commit, with the new "Save to trip" action:

| State | Should do | Where the check lives |
|---|---|---|
| **Guest (`authed !== true`)** | Search + **Book** stay free (CheckoutPanel). **Save to trip** → sign-up nudge. | activate `onRequireAuth` (currently no-op, `:103`). |
| **Logged IN + selected trip** | **Save to trip** → `vendor-commit` synthetic lodging with `currentTrip.id` → budgeted + calendar. | needs `authed===true` + `currentTrip` passed in. |
| **Logged IN + NO trip** | "Pick or create a trip first" (NOT a login prompt). | `authed===true && !currentTrip` → inline message. |
| **Free hotel SEARCH (LiteAPI)** | Always open, never gated. | `/api/travel/hotels/search` (`:75`) — public, unchanged. |

`authed` (`ModuleLauncher.tsx:171`) and `currentTrip` (`:181`) already exist and just need
forwarding (as they were for flights, `:425-429`).

---

## 4. The plan

### What to wire into `PublicHotelSearch` (mirror PR-Flight-Commit)
1. **Mount props** (`ModuleLauncher.tsx:430`): add `authed={authed}`, `currentTrip={currentTrip}`,
   `onCommitted={() => setTripsRefresh((n) => n + 1)}` — identical to the flight mount (`:425-429`).
2. **New "Save to trip" action** on the hotel card: add an optional `onSave?: (hotel) => void`
   prop to `HotelResultsView` (additive; "Book" stays) + a "Save to trip" button next to "Book".
3. **The `saveHotel(hotel)` handler** in `PublicHotelSearch`, the 3-state branch:
   - `authed !== true` → `onRequireAuth()` (sign-up nudge).
   - `authed && !currentTrip` → set an inline "pick or create a trip" message.
   - `authed && currentTrip` → POST the **synthetic-lodging body** (port `AddToTripButton.tsx:83-101`)
     to `/api/trips/${currentTrip.id}/vendor-commit` with `startDate=checkin`, `endDate=checkout`,
     `amount = hotel.priceTotal ?? hotel.price` (whole-stay total, `HotelResultsView.tsx:39-40`),
     `notes = hotel.name (+ per-night/nights detail)`, `recurrence:'daily'`, `location = city/country`.
     On success → `onCommitted?.()` (budget re-fetches).
4. **Keep the free search + the guest "Book"/CheckoutPanel** path untouched.

### Reusable vs new
- **Reusable verbatim:** the `vendor-commit` lodging/synthetic route (no change); the
  `AddToTripButton` synthetic-lodging body shape; `HotelResult` already carries
  `price/priceTotal/pricePerNight`, `liteapiHotelId`, `name`, `city` (`HotelResultsView.tsx:30-46`);
  the `tripsRefresh`-keyed `TripBudgetActual` refresh from PR-Flight-Commit (already in place).
- **New (small):** the optional `onSave` prop + "Save to trip" button on `HotelResultsView`; the
  `saveHotel` handler + 3-state branch in `PublicHotelSearch`; the 3 mount props.

### Product flag — two actions on a hotel card
Flights have one action (commit-to-budget). Hotels will have **two**: **"Book"** (existing free
guest checkout — the free vendor feed) **and** the new **"Save to trip"** (budget commit). Per
`docs/FREEMIUM-MODEL.md` both are legitimate (free booking feed never locked; saving needs an
account + trip). **Recommend keeping both** — but flag it: if you'd rather hotels behave exactly
like flights (save-to-budget only, drop the guest "Book"/CheckoutPanel), say so and the PR is
even smaller. Default assumption: keep "Book", add "Save to trip".

### Recommended atomic PR
- **PR-Hotel-Commit** (one concept): add "Save to trip" to the home hotel widget mirroring
  PR-Flight-Commit — forward `authed`+`currentTrip`+`onCommitted`; add the optional `onSave`
  prop + button to `HotelResultsView`; branch the 3 states; commit via the synthetic-lodging
  `vendor-commit` body. Touches `PublicHotelSearch.tsx`, `HotelResultsView.tsx`, and the
  `ModuleLauncher` mount line. Reuses the route + `AddToTripButton` body verbatim; does not touch
  the route, `CheckoutPanel`, or the search path.

---

## REPORT (summary)

- **Current hotel flow:** search is live + free (`/api/travel/hotels/search`, public); the only
  action is **"Book"** (guest `CheckoutPanel`, `PublicHotelSearch.tsx:95-102,:168`); **no
  save-to-budget exists** (`onRequireAuth` is a no-op, `:103`); mounted without
  `authed`/`currentTrip`/`onCommitted` (`ModuleLauncher.tsx:430`).
- **Reusable commit path:** `vendor-commit` already does `optionType:'lodging'` + **synthetic**
  (`route.ts:108`), writing budget + itinerary (date-range branch, `:273-305`) + calendar
  (`:325`); the body to port is `AddToTripButton.tsx:83-101`.
- **Date model:** check-in/check-out → `startDate`/`endDate` + `recurrence:'daily'`; the route's
  range branch handles multi-night stays (`:273-305`). ✅
- **3-state branch:** guest → sign-up; logged-in+trip → synthetic-lodging vendor-commit; logged-in
  +no-trip → "pick a trip"; search always free.
- **PR plan:** one atomic **PR-Hotel-Commit** (forward props + add "Save to trip" action + branch
  + synthetic-lodging commit). Flag: hotels keep **"Book"** AND gain **"Save to trip"** (two
  actions) unless you want save-only.

**No code modified. Audit only.**
