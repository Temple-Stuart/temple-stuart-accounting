# UNCOMMIT + IMAGES AUDIT — TripBudgetActual card enhancements

**Type:** Audit — READ ONLY. Nothing modified.
**Asks:** (1) show an IMAGE on each Budgeted/Actual card when one's available;
(2) an UNCOMMIT action to remove an item from the queue.

Citations are `file:line` / `prisma/schema.prisma` lines.

---

## TL;DR

- **Images — Budgeted:** `budget_line_items.photoUrl` EXISTS (`schema:1046`) **and
  `/budget` already returns it** (raw `findMany`) — render it now; no route change.
  But it's usually **null** (only the trip-planner `commit` sets it, `commit:122`;
  the per-vendor `vendor-commit` path — hotels/flights — never does). So: real photo
  when present, **icon fallback by type** otherwise.
- **Images — Actual:** `reservations` has **no image column** (confirmed) and
  `/reservations` returns none → **icon fallback only**; a real hotel photo needs a
  separate LiteAPI-content fetch (heavier, later).
- **Uncommit — already built for travel commits:** `DELETE /api/trips/[id]/vendor-commit`
  (`vendor-commit:357-446`) atomically removes `budget_line_items` + `trip_itinerary`
  + `calendar_events` (no orphans), ownership-scoped. It's keyed by
  `{ optionType, optionId }` — which the **Budgeted card doesn't carry today** (those
  live on the linked `trip_itinerary`, not on `budget_line_items`, and `/budget`
  doesn't return them). So the gap is **surfacing the vendor-option ids**, not writing
  new delete logic.
- **Uncommit — Actual = cancellation, NOT delete.** `reservations` are PAID bookings;
  removing one is a provider cancellation (refund per `cancellationPolicyJson`), not a
  row delete. **Flag: uncommit applies to BUDGETED only.**

---

## 1. IMAGES — is there a photo per line?

### Budgeted (`budget_line_items`)
- **`photoUrl String?` EXISTS** (`schema:1046`).
- **`/budget` returns it already:** the route does `budget_line_items.findMany({ where:
  { tripId, userId } })` and returns the raw rows (`budget/route.ts:25-29`) — so
  `photoUrl` is in the payload. The card just doesn't render it (the `BudgetItem`
  interface in `TripBudgetActual.tsx:23-30` omits `photoUrl`; the card is text-only —
  grep for img/icon in `TripBudgetActual.tsx` → **none**).
- **Who populates it:** the trip-planner `commit` route sets `photoUrl: item.photoUrl
  || null` (`commit/route.ts:122`). The **`vendor-commit`** route (the per-vendor flow
  used by hotels via AddToTripButton + flights via FlightPicker) **never sets photoUrl**
  (grep of `vendor-commit/route.ts` → none) — so those budget lines have `photoUrl =
  null`. ⚠ So most committed travel lines have **no** photo today.
- Note: the vendor option tables DO carry images — `trip_lodging_options.image_url`
  (`schema:1760`), `trip_activity_expenses.image_url` (`schema:1832`) — so a future
  `vendor-commit` could copy `image_url → photoUrl` to enrich budgeted cards (enhancement).

### Actual (`reservations`)
- **No image/photo/url field** on `reservations` (`schema:1154-1181`, grep → none). The
  `/reservations` route returns `name`/`provider`/`amountUsd`/dates/`status` only
  (`reservations/route.ts:51-64`) — **no image.**
- The hotel photo lives only in **LiteAPI content** fetched live at search time
  (`HotelResultsView.tsx:72` `HotelCardImage` renders `photoUrl` from the search
  payload), not stored on the reservation. Getting a real photo for a booked stay
  would need a new fetch to `/api/travel/hotels/content` (exists, PR-RC1) keyed by the
  hotel — heavier, separate.

### Current card render (fallback today)
- `TripBudgetActual.tsx` cards are **text-only** — name/amount/dates/`type · status`
  (`:118-150`). There is **no image and no icon** today. So both rows need at least an
  **icon fallback by type** (hotel/flight/activity → bed/plane/map-pin), and Budgeted
  additionally renders `photoUrl` when present.

### VERDICT (images)
| Card | Real image now? | What it needs |
|---|---|---|
| Budgeted (has `photoUrl`) | **YES** — already in `/budget` payload | render `<img src={photoUrl}>` + add `photoUrl` to the interface |
| Budgeted (vendor-commit, `photoUrl` null) | no | icon fallback now; (later) `vendor-commit` copies `image_url`→`photoUrl` |
| Actual (`reservations`) | no (no stored image) | icon fallback now; (later) LiteAPI-content fetch for a real photo |

**Smallest change:** add `photoUrl` to the Budgeted card (route already returns it) +
a type-based icon fallback on both rows. No route change required for images.

---

## 2. UNCOMMIT — how to remove a line

### The cross-table cleanup ALREADY EXISTS (for travel commits)
`DELETE /api/trips/[id]/vendor-commit` (`vendor-commit/route.ts:357-446`):
- **Ownership-scoped:** `getVerifiedEmail()` → 401 (`:364`); user lookup → 404
  (`:366`); `trips.findFirst({ id, userId: user.id })` → 404 if not owner (`:367-368`)
  — mirrors the trip DELETE gate exactly.
- **Body:** `{ optionType, optionId }` (required, `:370-374`).
- **Atomic transaction** (`:387`) removes the matching rows across all three tables:
  - `budget_line_items.deleteMany` (`:402`, `:415`, `:422`)
  - `trip_itinerary.deleteMany` (`:429`)
  - `calendar_events` raw DELETE `WHERE source_id = trip:${id}:vendor:${optionId}` (`:437`)
  - and resets the vendor option status to `proposed` (`:391`).
- **Handles synthetic commits** — LiteAPI hotels (`hotel-…`) + Google places (`place-…`)
  carry a non-UUID placeholder `optionId` and are matched by itinerary title, not an
  option-row lookup (`:376-385`, `:405-411`). So a committed **hotel** can already be
  uncommitted through this route.

**So the cross-table "no orphan" cleanup the ask describes is already built** (it's the
exact opposite of the trip-ghosts problem — it deletes `calendar_events` by the
`trip:…:vendor:…` source_id). No new delete logic needed for travel commits.

### The gap: the Budgeted card lacks the keys to call it
- The card is a `budget_line_items` row. The DELETE needs `(optionType, optionId)`,
  which live on the **linked `trip_itinerary`** (`vendorOptionId` `schema:664`,
  `vendorOptionType` `:665`), NOT on `budget_line_items`. `budget_line_items` links to
  the itinerary via `itineraryId` (`schema:1040`; populated at commit, `vendor-commit:318`).
- `/budget` returns `budget_line_items` only — **no `vendorOptionId`/`vendorOptionType`**.
- **So to uncommit from the home Budgeted card, surface those two ids** — either:
  - (a) have `/budget` also return the linked itinerary's `vendorOptionId` +
    `vendorOptionType` (join via `itineraryId`), then the card calls the EXISTING
    `DELETE /vendor-commit` with them — **reuses the tested atomic cleanup**; or
  - (b) a new delete-by-`budget_line_item.id` route that resolves the itinerary +
    calendar rows itself — more code, duplicates the cleanup.
  → **(a) is smaller and safer.**
- ⚠ **Manual budget lines** (`source = 'manual'`/`'recurring'`, no vendor option) have
  **no `itineraryId`/`vendorOptionId`** — the vendor-commit DELETE doesn't apply. So
  the uncommit button should show **only on lines with a `vendorOptionId`** (committed
  travel items); a manual line needs a separate plain `budget_line_items` delete (or no
  button). Flag.
- ⚠ Fragility note: the existing DELETE matches flight/synthetic budget rows by
  `description` (title), not id (`:403`, `:411`) — title-based, slightly brittle if two
  lines share a title. A budget-line-id delete (b) would be precise but needs to
  re-implement the itinerary+calendar cleanup. The id-on-/budget + reuse-(a) path
  avoids new logic at the cost of the existing title match.

### Actual (`reservations`) = cancellation, NOT a delete — FLAG
- A `reservations` row is a PAID booking (`finalPriceCents` `:1168`, `status`
  pending/confirmed/cancelled `:1163`, `cancellationPolicyJson` `:1170`). "Removing"
  one is a **vendor cancellation** (call the provider's cancel API + refund per the
  policy + set `status='cancelled'`), **not** a row delete. This is real money and
  out of scope for a queue "uncommit."
- **Decision:** the uncommit button applies to **BUDGETED (planned)** items only.
  Actual/paid items get a separate, careful **cancellation** flow later (or a
  read-only "cancel" link to the provider). Don't wire a delete on `reservations`.

### Ownership
Any uncommit/delete must be user+trip scoped. The existing `DELETE /vendor-commit`
already does `trips.findFirst({ id, userId: user.id })` (`:367`) — reuse it; don't
build an unscoped delete.

---

## REPORT: EXISTS | MISSING | THE PLAN

### Images
- **EXISTS:** `budget_line_items.photoUrl` (+ returned by `/budget`); the
  `HotelCardImage` fallback pattern (`HotelResultsView.tsx:72`) to mirror.
- **MISSING:** the card rendering of `photoUrl`; an icon fallback; (and `photoUrl` is
  null for vendor-commit lines + absent on reservations).
- **Smallest change:** render `photoUrl` on Budgeted cards (add to the interface; show
  `<img>` with an on-error fallback like `HotelCardImage`) + a type→icon fallback on
  both rows. No route change.

### Uncommit
- **EXISTS:** the atomic, ownership-scoped `DELETE /api/trips/[id]/vendor-commit`
  (budget + itinerary + calendar, no orphans), incl. the synthetic `hotel-…` path.
- **MISSING:** the Budgeted card doesn't have `(optionType, optionId)` to call it
  (`/budget` doesn't return the linked itinerary's vendor-option ids).
- **Smallest safe path:** surface `vendorOptionId`/`vendorOptionType` on `/budget` items
  (join the linked `trip_itinerary` via `itineraryId`) → the card shows an "uncommit"
  button (with confirm) only on lines that have a `vendorOptionId` → calls the EXISTING
  DELETE. Manual lines (no vendor option) → no button (or a separate plain delete).
- **FLAG:** Actual/paid items are NOT uncommittable as a delete — they need a vendor
  cancellation flow (separate, careful).

### Staged plan (dependency-ordered)
1. **Images where available** [small] — render `photoUrl` on Budgeted cards (route
   already returns it) + type→icon fallback on both rows. Pure display. No route/data
   change.
2. **Uncommit a budgeted item** [medium] —
   - (2a) small route change: add `vendorOptionId` + `vendorOptionType` to the `/budget`
     items (join `trip_itinerary` via `itineraryId`).
   - (2b) the card's uncommit button (confirm) → `DELETE /vendor-commit` with
     `{ optionType, optionId }` → on success, refresh the rows. Show only when
     `vendorOptionId` is present.
3. **(Later / flagged)** vendor-commit copies vendor `image_url`→`photoUrl` (richer
   budgeted photos); LiteAPI-content fetch for actual hotel photos; the **cancellation**
   flow for Actual/paid items.

### Risks to flag
- Uncommit needs ids `/budget` doesn't return yet (route join needed) — or a new
  delete-by-id route (more code).
- Manual budget lines have no vendor option → the vendor-commit DELETE doesn't apply.
- The existing DELETE matches flight/synthetic budget rows by **title** (`:403,411`) —
  brittle if titles collide.
- Actual = real paid bookings → never wire a naive delete (cancellation, not delete).
- Auth: reuse the existing ownership-scoped DELETE; never an unscoped one.

---

## Citations index
- Budget image: `schema.prisma:1046` (photoUrl); `budget/route.ts:25-29` (returns raw);
  setter `commit/route.ts:122`; vendor-commit sets none (`vendor-commit/route.ts`).
- Reservations no image: `schema.prisma:1154-1181`; `reservations/route.ts:51-64`.
- Fallback pattern: `HotelResultsView.tsx:72` (`HotelCardImage`).
- Current cards (text-only): `TripBudgetActual.tsx:23-30,118-150`.
- Uncommit route: `vendor-commit/route.ts:357-446` (ownership `:364-368`, params
  `:370-374`, deletes `:402,415,422,429,437`, synthetic `:376-385`).
- Vendor-option ids on itinerary: `schema.prisma:664-665`; budget→itinerary link
  `schema.prisma:1040`, populated `vendor-commit/route.ts:318`.
- Vendor option images: `schema.prisma:1760,1832`.
