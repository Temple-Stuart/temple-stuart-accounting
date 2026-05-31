# TRAVEL — PR-33 Audit: CRITICAL date-integrity — search vs control-bar vs committed-itinerary dates disagree

**Branch:** `claude/travel-pr-33-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY. **Booking-integrity bug — DO NOT IMPLEMENT.**

**The contradiction (from screenshots):**
| Surface | Shows | Correct? |
|---|---|---|
| Searched (control bar at search time) | 07/02/2026 → 07/31/2026 (29 nt) | ✓ user intent |
| Control bar after the action | 07/01 → 07/08 (7 nt) | ✗ reset to trip-start+7 |
| Hotel card / detail "nights" label | 29 nights | ✓ (`rec.nights`) |
| Committed itinerary | "Jul 1 → Jan 1 · 184 nights" | ✗ whole-trip span |

Three date values disagree. Below: every source traced, and the exact lines that
write the wrong window.

---

## 1. SEARCH DATES — where the user's 07/02→07/31 live

Per-location dates are client state in `useTripScanState`:
- **`perLocationDates`** — `useState<Record<string,{checkin;checkout}>>({})`
  (`TripPlannerAI.tsx:241`). Keyed by city. **Not persisted** (no DB, no URL, no
  localStorage).
- The control-bar inputs read/write it (`:823-835`): `value={checkinVal}` and
  `onChange → setPerLocationDates(prev => ({...prev,[activeCity]:{checkin:…}}))`.
- **Search window** sent to LiteAPI: `scanSingleCategory` reads
  `const loc = perLocationDates[city || '']` (`:308`) and passes
  `{ checkin: loc.checkin, checkout: loc.checkout }` as `dateParams` into the
  scan POST (`:309-313`). So the user's **07/02→07/31** went into
  `perLocationDates["<city>"]` and drove the LiteAPI search → the rec's
  `nights = 29` (see §4). **This value is correct and is the intended source of
  truth.**

## 2. CONTROL-BAR RESET — why it shows 07/01→07/08 afterward

The inputs fall back to a **trip-start prefill** whenever `perLocationDates` has
no entry for the active city (`TripPlannerAI.tsx:746-751`):
```ts
const defaultCheckin  = tripDates?.departure || '';                 // 07/01
const defaultCheckout = tripDates?.departure
  ? (+7 days from departure)                                        // 07/08
  : '';
const checkinVal  = perLocationDates[activeCity]?.checkin  ?? defaultCheckin;
const checkoutVal = perLocationDates[activeCity]?.checkout ?? defaultCheckout;
```
**Why it "reset":** `perLocationDates` is **component state that does not
survive a remount**. The hotel detail page is a **different route**
(`/budgets/trips/{id}/discover/{category}/{rank}`). When the user clicks a card →
detail → "Back to trip" (or refreshes), the trip page (and `TripScanProvider` →
`useTripScanState`) **remounts fresh**, `perLocationDates` re-initialises to `{}`,
and the inputs fall back to `defaultCheckin/defaultCheckout` =
**trip.departure (07/01) and +7 (07/08)**. The user's 07/02→07/31 was never
persisted, so it's gone. **This is the control-bar reset** — not an overwrite of
the entered value, but a **non-persisted state loss + trip-start+7 re-prefill**.

> Note: there is no code that *actively* writes 07/01→07/08 over the user's
> input; the reset is the prefill default surfacing after the state is dropped on
> remount. Severity is lower than the commit bug (§3-5) because it's display, not
> a written booking — but it is the visible symptom that the search window is not
> durable.

## 3. COMMITTED ITINERARY DATES — the 184-night write

The PR-32 hotel commit's dates come from the **detail page**, and they are the
**whole-trip dates, not the search window**:

**`…/discover/[category]/[rank]/page.tsx:198-200`:**
```ts
// Dates for the Reserve flow (LiteAPI needs ISO YYYY-MM-DD).
const checkin  = trip.startDate ? trip.startDate.toISOString().slice(0,10) : null;  // 07/01
const checkout = trip.endDate   ? trip.endDate.toISOString().slice(0,10)   : null;  // 01/01 (whole trip)
```
`trip.startDate`/`trip.endDate` are the **whole-trip span** (the trip runs
Jul 1 → Jan 1). These feed **both** `ReserveHotelButton` (`:394-395`) **and**
`AddToTripButton` (`:checkinDate={checkin} checkoutDate={checkout}`).

`AddToTripButton.tsx:42-43,57-58` sends them straight through:
```ts
const startDate = checkinDate || today;     // 07/01
const endDate   = checkoutDate || startDate; // 01/01
… body: { optionType:'lodging', synthetic:true, startDate, endDate, … }
```
`vendor-commit/route.ts` then writes a `trip_itinerary` row **per day across that
whole range** (`:203-221`):
```ts
const current = new Date(start);                          // 07/01
const totalDays = …(end - start)…;                        // 184
const dailyCost = details.amount / totalDays;             // 29-nt price / 184 (!)
while (current <= end) { … create itinerary entry …; current.setDate(+1); }  // 184 entries
```
and a `calendar_events` row `start_date=07/01, end_date=01/01` (`:234-239`).

**So the committed itinerary spans the whole trip (184 nights), because the
detail page handed it `trip.startDate`/`trip.endDate` instead of the search
window.** ✅ **This is the 184-night bug** (§5 confirms it's the itinerary write).

## 4. THE "29 vs 184" SPLIT — two different fields

- **"29 nights" label** = **`rec.nights`** — the search-window nights, computed in
  the LiteAPI mapper as `Math.round((checkout − checkin)/msPerDay)` from the
  **search** dates (`liteapiClient.ts:289-291`), threaded onto the rec. Rendered
  on the card (`TripPlannerAI.tsx:1434` `{rec.nights} nights`) and the detail
  pricing block (`page.tsx:194` `const nights = rec.nights`, shown :373+).
  **Correct = search window (29).**
- **"Jul 1 → Jan 1 · 184 nights" span** = computed by **`ItineraryAgenda`** from
  the committed event's own start/end:
  `nights = Math.round((endDate − startDate)/86_400_000)`
  (`ItineraryAgenda.tsx:117-120`). Those `startDate`/`endDate` are the
  `calendar_events`/`trip_itinerary` dates written from
  **`trip.startDate`/`trip.endDate`** (§3). **Wrong = whole-trip span (184).**

**The split:** the label reads `rec.nights` (search), the agenda span reads the
committed itinerary dates (whole trip). They were sourced from **different date
origins**, so they disagree. One field (`rec.nights`) is right; the committed
dates are wrong.

## 5. PR-32 COMMIT PAYLOAD — did it write the whole trip? YES

- **Payload dates** (`AddToTripButton.tsx:57-58`): `startDate`, `endDate` =
  `checkinDate`/`checkoutDate` props = the detail page's `checkin`/`checkout` =
  **`trip.startDate`/`trip.endDate`** (`page.tsx:199-200`). **Not** the search
  window; **not** `rec.nights`-derived.
- **Itinerary write loop** (`route.ts:203-221`): `while (current <= end)` from
  `start`(07/01) to `end`(01/01) → **184 daily `trip_itinerary` entries**, each
  with `cost = details.amount / 184`.

**Confirmed: the synthetic lodging commit wrote itinerary entries across the
WHOLE TRIP (Jul 1 → Jan 1), not the 29-night stay window.** Two consequences:
1. the agenda renders a 184-night span (§4);
2. the 29-night hotel price is **divided across 184 days** (`dailyCost`,
   `:207`) — a secondary cost-distribution error.

> The bug is **not** in the route's loop (it correctly spans whatever
> start/end it's given) — it's that the detail page **handed it the wrong dates**
> (`trip.startDate`/`endDate` instead of the search window). The route is faithful
> to bad input.

## 6. SINGLE SOURCE OF TRUTH — every divergence to unify

**The hotel's committed dates MUST be the search window** (the checkin/checkout
the user set in the control bar, the same window that produced `rec.nights`).
Divergences today:

| # | Location | Uses now | Should use |
|---|---|---|---|
| **A** | `page.tsx:199-200` (`checkin`/`checkout`) | `trip.startDate` / `trip.endDate` (whole trip) | **search window** (checkin / checkin+`rec.nights`) |
| **B** | `AddToTripButton` payload (`:57-58`) | the above (whole trip) | the search window passed down from A |
| **C** | `vendor-commit` itinerary loop (`route.ts:203-221`) + calendar (`:234-239`) | spans whatever start/end → 184 days | the 29-night window (fixed once A/B feed it correctly) |
| **D** | control bar (`TripPlannerAI.tsx:746-751`) | non-persisted `perLocationDates`; remount → trip-start+7 | the search window must **persist** (or be re-derived) so it survives navigation |

**Where does the search window come from on the detail page?** This is the crux:
the rec carries **`rec.nights` (29)** but **NOT the checkin/checkout dates**
themselves (`Recommendation` interface, `page.tsx:54-92` — has `nights`, no
`checkin`/`checkout`). So the detail page currently has **no access to the actual
search dates** — it only knows the *count* (29). To set correct committed dates it
needs the real checkin (and checkout = checkin + nights). Options (for the impl
PR, needs Alex sign-off):
- **persist the search window** (`perLocationDates`) on the scan result /
  `trip_scanner_results` so the detail page can read the real checkin/checkout; or
- **thread checkin onto the rec** in the mapper (alongside `nights`) so
  `checkout = checkin + nights` is reconstructable; or
- minimally, **derive `checkout = checkin + rec.nights`** where `checkin` is the
  persisted search check-in — guaranteeing the committed span = `rec.nights` (29)
  regardless of trip dates.

---

## VERDICT — exact wrong-date lines, ranked by booking-integrity severity

1. **🔴 CRITICAL — `…/discover/[category]/[rank]/page.tsx:199-200`.** The detail
   page sets `checkin = trip.startDate` and `checkout = trip.endDate` (whole-trip
   Jul 1 → Jan 1) instead of the search window. **This single divergence is the
   root cause** of the committed 184-night itinerary: it feeds both Reserve and
   "Add to trip." Everything downstream (payload B, itinerary write C, calendar,
   agenda span) faithfully propagates these wrong dates.
2. **🔴 CRITICAL (consequence) — `vendor-commit/route.ts:203-221` + `:234-239`.**
   Writes 184 daily `trip_itinerary` rows and a 184-day `calendar_events` span,
   and divides the 29-night price by 184 (`dailyCost`, `:207`). Correct once #1
   feeds the real window; no change needed if the input is fixed, but the
   cost-split amplifies the error.
3. **🟠 HIGH — the rec lacks checkin/checkout** (`Recommendation`, `page.tsx:54-92`;
   mapper threads only `nights`, `liteapiClient.ts:289-291`). The detail page
   *cannot* currently commit the right dates because it doesn't have them — only
   `rec.nights`. The fix for #1 depends on making the search window reachable
   here (persist it or thread checkin onto the rec).
4. **🟡 MEDIUM — control-bar reset (`TripPlannerAI.tsx:746-751` + non-persisted
   `perLocationDates` `:241`).** The user's 07/02→07/31 is lost on remount and
   re-prefills to trip-start+7 (07/01→07/08). Display/UX integrity (and the same
   non-persistence that starves the detail page in #3), not a written booking —
   but it must persist for #1 to have a window to read.

**Booking-integrity bottom line:** the hotel was committed against the **whole
185-day trip**, not the **29-night stay** the user searched and the card shows.
The wrong write originates at **`page.tsx:199-200`** (whole-trip dates), enabled
by the rec not carrying the search checkin/checkout (#3) and the search window not
persisting (#4).

---

**READ-ONLY audit. No implementation performed.**
