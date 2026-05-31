# TRAVEL — PR-32 Implementation: hotel "Add to trip" commit + detail-route search bar fix

**Branch:** `claude/travel-pr-32`
**Date:** 2026-05-31
**Scope:** Wire the discover-detail "Add to trip" button to commit hotels into
Committed Budget via a **synthetic lodging** path (mirroring the synthetic flight
commit), and fix the search bar (TripCreationBar) showing on the
`…/discover/{category}/{rank}` detail route. Per
`audit-reports/travel-pr-32-audit.md`. 3 files edited + 1 new island + this
report. **0 schema, 0 deps.**

---

## STEP 1 — Synthetic lodging branch in vendor-commit

`src/app/api/trips/[id]/vendor-commit/route.ts`:

- **Parse the flag** (`:87`): destructured `synthetic` from the body and derived
  `const isSyntheticLodging = optionType === 'lodging' && synthetic === true;`
  (`:89-96`).
- **Build details from payload** (`:100-103`, was `:100-101`): the `details`
  ternary now triggers for `optionType === 'flight' || isSyntheticLodging` →
  `{ title: notes || 'Lodging', amount: Number(requestAmount || 0), tripId: id }`
  — **no `getOptionDetails` / `trip_lodging_options` row required**, exactly like
  the flight synthetic path.
- **Skip status update** (`:106-108`): `setOptionStatus` runs only when
  `optionType !== 'flight' && !isSyntheticLodging` (synthetic lodging has no row
  to flip to "committed").
- **Skip the row lookup** (`:134-137`): the `trip_lodging_options.findFirst`
  location lookup now guards `!isSyntheticLodging` — synthetic lodging carries its
  location in the payload (`requestLocation`).

**Existing row-based lodging path UNTOUCHED:** when `synthetic` is absent/false,
`isSyntheticLodging` is `false`, so `getOptionDetails` (`:102`), `setOptionStatus`
(`:107`), and the `trip_lodging_options` location lookup (`:135`) all run exactly
as before. Planner vendor-option lodging commits are unchanged.

- **COA:** lodging → `VENDOR_TYPE_TO_COA.lodging = '9200'` (`:11`) →
  `coaCode = `${prefix}-9200`` (P-9200/B-9200, `:111,:142`) — Accommodation.
- **Itinerary:** synthetic lodging (a non-flight type) flows through the existing
  **multi-day branch** (`:203-221`), creating one `trip_itinerary` row per night
  with `vendor: details.title`, `location: activityLocation`, `cost: dailyCost`.

## STEP 2 — Client island for "Add to trip"

New `src/app/budgets/trips/[id]/discover/[category]/[rank]/AddToTripButton.tsx`
(client component). The detail page (`page.tsx`) is an async **server component**,
so the commit action lives in this island (same pattern as `ReserveHotelButton`).

`page.tsx` — `<Link>` (former `:429-434`) replaced with:
```tsx
<AddToTripButton
  tripId={tripId}
  hotelName={rec.name}
  amount={stayTotal}              // rec.price — reconciled PR-21 whole-stay total
  location={destinationLabel}     // scan destination → Country
  checkinDate={checkin}
  checkoutDate={checkout}
  liteapiHotelId={rec.liteapiHotelId ?? null}
  perNight={perNight}
  nights={nights}
/>
```
(import added at `page.tsx:9`.) The island **POSTs to
`/api/trips/{tripId}/vendor-commit`** (`AddToTripButton.tsx:50-66`):
```ts
{
  optionType: 'lodging',
  synthetic: true,                                   // no DB row — build from payload
  optionId: `hotel-${liteapiHotelId||'manual'}-${Date.now()}`,
  startDate: checkinDate,  endDate: checkoutDate,
  amount: amount ?? 0,                               // = rec.price, NOT recomputed
  notes: `${hotelName} | ${perNight}/night · N nights · hotel:…`,
  location,                                          // = destinationLabel
}
```
On success it renders **"✓ Added to trip — view budget"** linking to
`/budgets/trips/{tripId}` (`:82-89`); on failure it shows the real error inline
(`:99-101`, fail-loud, no masking).

> **amount basis:** `amount = stayTotal = rec.price` (`page.tsx:195`) — the
> reconciled PR-21 whole-stay total, the exact figure the detail-page Total
> shows. **Not recomputed.** Mirrors how flights commit their total
> (`FlightPicker.tsx:290`). The budget item stores it verbatim
> (`route.ts:152` `amount: details.amount`).

## STEP 3 — Country = destinationLabel

`destinationLabel` (`page.tsx:127,133` — the scan result's `destination`, e.g.
"Bali (Canggu), Indonesia") is passed as `location`. The route writes it to
`trip_itinerary.location` on each night's row (`route.ts:216`). On the trip page,
`loadBudgetItems` builds `itineraryLocationMap[entry.vendor] = entry.location`
(`page.tsx:288-289`) and resolves each budget item's Country via
`itineraryLocationMap[desc]` (`:309`). **Key alignment confirmed:** the budget
item's `description` is `details.title` (`route.ts:153`) and the itinerary
`vendor` is the **same** `details.title` (`:215`) — so the lookup key matches and
the **Committed Budget "Country" column populates with the hotel's scan
destination** (`page.tsx:919`). No `budget_line_items` country column is needed
(there isn't one) — the established itinerary-location mechanism does it.

## STEP 4 — BUG 2: regex fix

`src/components/ui/AppLayout.tsx:149` (now with PR-32 comment + line):

- **Before:** `/^\/(budgets\/)?trips\/[^/]+\/?$/` — anchored at `$` after one
  segment, so `…/discover/{category}/{rank}` (4 extra segments) never matched →
  `isTripDetail=false` → search bar shown.
- **After:** `/^\/(budgets\/)?trips\/[^/]+(\/discover\/.*)?\/?$/` — the optional
  `(\/discover\/.*)?` group lets the match extend through the discover detail
  route while still requiring `/discover/` (not arbitrary sub-paths).

**Verified across 7 route cases** (node harness): landing `/budgets/trips` → bar
**shows**; `/new` → **shows**; `/budgets/trips/{id}` → **hidden**;
`/budgets/trips/{id}/discover/accommodation/1` → **hidden (the fix)**; `/trips/{id}`
and `/trips/{id}/discover/…` → **hidden**. All pass. Landing/new behavior intact.

## STEP 5 — Auth

The synthetic lodging path rides inside the **same** gate as every other commit
(`route.ts:80-85`): `getVerifiedEmail()` → 401; user lookup → 404; **`trips.findFirst({
where: { id, userId: user.id } })`** → 404 if not the caller's trip. No new code
path bypasses it — `isSyntheticLodging` is evaluated only **after** the gate, inside
the transaction. ✅ The detail page is itself auth+ownership gated
(`page.tsx:101-116`).

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Synthetic lodging branch ADDED; row-based lodging UNTOUCHED | ✅ guarded by `isSyntheticLodging`; row path runs when flag absent |
| amount = rec.price (reconciled), not recomputed; pricing/Reserve untouched | ✅ `amount=stayTotal=rec.price`; `ReserveHotelButton`/PR-15 charge path not in diff |
| Country via destinationLabel → itinerary.location | ✅ payload `location` → `trip_itinerary.location` → Country column |
| BUG 2 = regex only; landing/new bar still works | ✅ 7/7 route cases pass |
| 0 schema (cols exist) | ✅ `trip_itinerary.location` + `budget_line_items` present; no prisma change in diff |
| 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs base) | ✅ route 0e/1w, page 0e/0w, AppLayout 0e/1w — **+0/+0 each** (pre-existing warns); new island **0 problems** |
| diff scope | ✅ vendor-commit route + detail page + new island + AppLayout (+ report) |

---

## Result
"Add to trip" now commits the viewed hotel into Committed Budget through a
synthetic lodging path (no `trip_lodging_options` row required, mirroring the
flight synthetic commit): COA P-9200/B-9200, amount = `rec.price` (verbatim), and
`location = destinationLabel` so the Committed Budget **Country** column resolves
to the hotel's scan destination. The existing row-based lodging commit is
untouched; auth+ownership are enforced in the same gate. The search bar is now
suppressed on the discover detail route (regex broadened), while landing/new keep
it. tsc + lint clean, 0 schema, 0 deps.
