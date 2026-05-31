# TRAVEL — PR-32 Audit: hotel "Add to trip" commit + search bar on detail page

**Branch:** `claude/travel-pr-32-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Two bugs on the hotel detail page**
(`src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx`):
1. **"Add to trip" doesn't commit** the hotel to Committed Budget (it's just a
   navigation link).
2. **The search bar (TripCreationBar) still renders** on the detail route (PR-29
   suppressed it on `/trips/{id}` but not on `…/discover/…`).

---

## BUG 1 — "Add to trip" doesn't commit

### 1. Current handler — it's a `<Link>`, not a commit

`page.tsx:429-434`:
```tsx
{/* "Add to trip" — links back to the planner where the existing
    commit-to-budget flow lives. */}
<Link href={`/budgets/trips/${tripId}`}
  className="px-4 py-2 border border-border text-sm font-medium rounded hover:bg-bg-row">
  Add to trip
</Link>
```
It calls **no endpoint and sets no state** — it just **navigates back** to the
trip page (`:430`). The hotel is never committed. **That is the bug.** (The detail
page is an `async` **server component** — `page.tsx:94` — so the commit action
must live in a small client island, like `ReserveHotelButton`.)

### 2. Flight-commit template (the pattern to mirror)

`FlightPicker.commitLeg` (`src/components/trips/FlightPicker.tsx:262-310`) POSTs
to **`/api/trips/{tripId}/vendor-commit`** (`:282`):
```ts
body: {
  optionType: 'flight',
  optionId: flightId,            // synthetic: `flight-${leg.id}-${Date.now()}`
  startDate, endDate,
  amount: offer.price,
  notes: title,                  // "LAX → HND"
  startTime, endTime, arriveDate,
}
```
The endpoint creates the `budget_line_items` row + `trip_itinerary` entries +
`calendar_events` **atomically** (`vendor-commit/route.ts:98-230`).

**Key insight — flights commit "synthetically":** for `optionType: 'flight'` the
endpoint does **not** require a pre-existing DB option row — it builds `details`
directly from `notes`/`amount` (`route.ts:100-101`) and skips
`setOptionStatus` (`:106`). All other types (`lodging`/`transfer`/`vehicle`/
`activity`) require an existing `trip_*_options` row via `getOptionDetails`
(`:99-103, :18-48`).

### 3. Committed Budget model + hotel expense type/COA

- **Storage:** `budget_line_items` (`route.ts:145-156`) — fields:
  `userId, tripId, coaCode, year, month, amount, description, source:'trip'`.
  Read back by `GET /api/trips/{id}/budget` (`budget/route.ts:25-27`).
- **COA for hotels:** `VENDOR_TYPE_TO_COA.lodging = '9200'` (`route.ts:11`) →
  `coaCode = `${prefix}-9200`` (P-9200 personal / B-9200 business, `:111,:142`).
  Matches the `accommodation` COA (`travelCOA.ts:41` `P-9200/B-9200`,
  label "Accommodation"). **So hotels map to optionType `lodging` → P-9200/B-9200.**
- **Committed Budget table** reads `committedBudgetItems`
  (`page.tsx:136`): `{ category, amount, description, location?, vote? }`, built in
  `loadBudgetItems` (`:277-323`) from the budget GET, with `category =
  coaCodeToLabel(item.coaCode)` (`:313`).

### 4. Country mapping — the subtle part

**`budget_line_items` has NO country/location column.** The "Country" column in
Committed Budget (`page.tsx:919` `{item.location || '—'}`) is **resolved
client-side** in `loadBudgetItems` (`:306-317`) by matching the item's
`description` against:
- **Level 1** — `trip_itinerary.location` keyed by vendor name (`:284-291`), then
- **Level 2** — the scanner-results destination map (`:294-304`).

So a committed item's Country comes from the **`trip_itinerary.location`** written
at commit time (the vendor-commit POST accepts `location: requestLocation` and
stores it on the itinerary rows — `route.ts:87,116,173,186,203`).

**Hotel country field on rec:** the `Recommendation` interface (`page.tsx:54-92`)
has **`city`** (`:78`) and **`addressLine`** (`:79`) but **no `country`** field.
The hotel's country is **not** directly on the rec. The available country signal
is **`destinationLabel`** (`page.tsx:127,133`) — the scan result's `destination`
string (e.g. "Tokyo, Japan"), the same value flights/scanner items already use as
their location. **Proposal:** the hotel commit should pass `location =
destinationLabel` (the scan destination, which carries the country) so the
itinerary row gets it and the Committed-Budget Country column populates — exactly
how scanner-committed lodging already resolves (`route.ts:134-137` pulls
`trip_lodging_options.location`). If a true ISO country is wanted instead, it must
be derived from `destinationLabel` (rec has none); **flag for Alex** (§ sign-off).

### 5. Does vendor-commit already support hotels? → "wire", but with a gap

`optionType: 'lodging'` **is** a valid type (`route.ts:16,93`) and the endpoint
fully handles it (COA, multi-day itinerary, calendar). **BUT** the `lodging` path
requires an existing **`trip_lodging_options`** row (`route.ts:25-29` via
`getOptionDetails`) — a hotel viewed on the detail page has **no such row**
(scanner results live in `trip_scanner_results`, not `trip_lodging_options`). So:
- **Not a pure "wire the button"** — POSTing `optionType:'lodging'` with the scan
  rec's id would 404 "Vendor option not found" (`:103`).
- **Two implementation options:**
  - **(A) Synthetic lodging path (mirror flights, recommended):** add a
    `lodging`-synthetic branch in vendor-commit that, like flights, builds
    `details` from request `amount`/`notes` without requiring a
    `trip_lodging_options` row (and skips `setOptionStatus`). Then the detail-page
    island POSTs `{ optionType:'lodging', optionId:'hotel-…', amount: stayTotal,
    notes: rec.name, startDate: checkin, endDate: checkout, location:
    destinationLabel }`. Smallest, mirrors the proven flight pattern.
  - **(B) Create a `trip_lodging_options` row first**, then commit it — heavier,
    introduces a persisted option for an ad-hoc hotel.

**Recommend (A)** — it mirrors the existing synthetic-flight commit and needs no
new table writes beyond budget+itinerary+calendar.

### 6. Auth / ownership on commit

`vendor-commit` POST is gated (`route.ts:80-85`): `getVerifiedEmail()` → 401 if
absent; user lookup → 404; **`prisma.trips.findFirst({ where: { id, userId:
user.id } })`** → 404 if the trip isn't the caller's. **Auth + ownership are
enforced.** (The detail page itself is also auth+ownership gated —
`page.tsx:101-116`.) The LiteAPI prebook/book endpoints behind "Reserve" are
likewise gated. ✅

---

## BUG 2 — search bar on the detail page

### 7. PR-29 suppression + why it misses the detail route

`src/components/ui/AppLayout.tsx:149-150`:
```ts
const isTripDetail = /^\/(budgets\/)?trips\/[^/]+\/?$/.test(pathname || '') && !(pathname||'').endsWith('/new');
const showTravelSearch = TRAVEL_PREFIXES.some(r => pathname?.startsWith(r)) && !isTripDetail;
```
The regex **`/^\/(budgets\/)?trips\/[^/]+\/?$/`** matches a path with **exactly
one** segment after `trips/` and is **anchored at `$`** (optionally a trailing
slash). The discover detail route is
`/budgets/trips/{id}/discover/{category}/{rank}` — **four** extra segments after
`{id}` — so it **does not match** `isTripDetail`, `isTripDetail` is `false`,
`showTravelSearch` stays `true`, and `TripCreationBar` renders (`:164-167`). The
detail page already shows a "← Back to trip" link + the hotel header, so the
search/create bar is redundant clutter there.

**Proposed one-line fix:** broaden `isTripDetail` to also match deeper trip
sub-routes (the discover/detail pages), e.g.:
```ts
const isTripDetail =
  /^\/(budgets\/)?trips\/[^/]+(\/discover\/.*)?\/?$/.test(pathname || '')
  && !(pathname || '').endsWith('/new');
```
or, more simply, a second test OR'd in:
`|| /^\/budgets\/trips\/[^/]+\/discover\//.test(pathname||'')`. Either suppresses
the bar on the discover detail route while leaving the landing
(`/budgets/trips`) and `/new` bar intact. **Confirm the exact pattern with Alex**
(whether ALL deeper trip sub-routes should suppress, or only `/discover/`).

---

## Scope per bug

**BUG 1 (larger):**
- **New client island** on the detail page (e.g. `AddToTripButton.tsx`) replacing
  the `<Link>` (`page.tsx:429-434`) — POSTs to `vendor-commit` with the
  hotel payload + `location: destinationLabel`.
- **`vendor-commit/route.ts`** — add the **synthetic `lodging`** branch (mirror
  the flight branch at `:100-101,:106,:139-141`) so a detail-page hotel commits
  without a `trip_lodging_options` row. ~15-25 lines.
- Files: `…/[rank]/page.tsx`, a new island, `vendor-commit/route.ts`. **0 schema**
  (budget_line_items/trip_itinerary already exist), **0 deps**.

**BUG 2 (tiny):**
- **`AppLayout.tsx:149`** — one-line regex broadening. **0 schema, 0 deps.**

## What needs Alex sign-off
1. **Hotel commit mechanism** — synthetic `lodging` branch in vendor-commit
   (recommended, mirrors flights) vs creating a `trip_lodging_options` row first.
2. **Country value** — use `destinationLabel` (scan destination string, carries
   country, matches how scanner/flight items resolve location) vs deriving a true
   ISO/country-name (rec has **no** `country` field; would need parsing
   `destinationLabel` or a new enrichment).
3. **Itinerary side-effects** — flights/lodging commits also write
   `trip_itinerary` + `calendar_events`; confirm a detail-page hotel commit
   should create the same multi-day itinerary entries (it will, via the lodging
   path) — or budget-only.
4. **BUG 2 regex scope** — suppress the bar on ALL deeper `/trips/{id}/…`
   sub-routes, or only `/discover/`?
5. **Amount basis** — commit `stayTotal` (`rec.price`, whole-stay, `page.tsx:195`)
   as the hotel expense amount (consistent with the displayed Total). Confirm.

---

**READ-ONLY audit. No implementation performed.**
