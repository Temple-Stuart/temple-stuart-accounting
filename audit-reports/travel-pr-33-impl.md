# TRAVEL — PR-33 Implementation: commit hotels against the real search window

**Branch:** `claude/travel-pr-33`
**Date:** 2026-05-31
**Scope:** Fix the CRITICAL date-integrity bug — thread the exact search-window
`checkin`/`checkout` onto the hotel rec and commit **those** (not
`trip.startDate`/`trip.endDate`). Fixes the 184-night itinerary and the
cost-split-across-184-days bug. Assert `checkout − checkin === nights`, fail loud
on mismatch. **No fallback dates.** Per `audit-reports/travel-pr-33-audit.md`
(Option 2). 3 files + this report. **0 schema, 0 deps.**

---

## STEP 1 — Thread checkin/checkout onto the rec

`src/lib/liteapiClient.ts`:
- **`LiteApiHotelRate` type** (`:179-185`): added `checkinDate?: string` +
  `checkoutDate?: string` next to `nights`.
- **`searchHotelRates` mapper** (`:294-306`): alongside the existing `nights`
  computation (which already derives from `params.checkin/checkout`, `:289-292`),
  now also stamps `checkinDate = params.checkin` / `checkoutDate = params.checkout`
  onto every merged rate (both the meta-merged and no-meta branches). So each rate
  carries the **exact** window it was quoted for — not just the count.
- **`HotelRecommendation` type** (`:361-366`): added `checkinDate?` /
  `checkoutDate?`.
- **`liteApiHotelToRecommendation` return** (`:557-558`): sets
  `checkinDate: hotel.checkinDate, checkoutDate: hotel.checkoutDate`.

The route already passes the user's search-window dates into the mapper:
`ai-assistant/route.ts:248-249` (`checkin = bodyCheckin`, `checkout = bodyCheckout`)
→ `searchHotelRates({ …, checkin, checkout })` (`:268-269`). So the persisted
scan rec (`trip_scanner_results` JSON) now carries the real window.

## STEP 2 — Detail page uses the rec's dates (no trip-span, no fallback)

`…/discover/[category]/[rank]/page.tsx`:
- **Interface** (`:90-94`): added `checkinDate?` / `checkoutDate?` to the
  page's `Recommendation`.
- **Date derivation** (was `:199-200`, now `:199-208`):
  ```ts
  const checkin  = rec.checkinDate ?? null;   // the search window
  const checkout = rec.checkoutDate ?? null;
  ```
  **Replaced** `trip.startDate` / `trip.endDate` (the whole-trip 184-day span).
  **NO fallback to trip dates** — if the rec lacks the window (an older cached
  scan), `checkin/checkout` stay `null` and commit/Reserve are **disabled with an
  honest message** (§ below), never a silent wrong-date default.
- **Reserve gate** (`:402,:412-419`): already gates on `checkin && checkout`; the
  "no dates" branch message updated from "Set trip Start/End dates" to
  **"Re-scan this hotel to refresh its dates, then Reserve."** (the dates now come
  from the rec, not trip settings).
- These `checkin/checkout` feed **both** `ReserveHotelButton` (`:407-408`) and
  `AddToTripButton` (`:449-450`) — so Reserve and "Add to trip" share the search
  window.

## STEP 3 — Assert checkout − checkin === nights at commit (fail loud)

`AddToTripButton.tsx` `handleAdd` (`:36-74`):
- **No fallback** — removed the old `checkinDate || today` / `checkoutDate ||
  startDate` defaults. If either date is missing →
  `throw new Error('Missing stay dates for this hotel — re-scan to refresh…')`
  (commit does NOT fire).
- **Night-count assertion:**
  ```ts
  const spanNights = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000);
  if (nights != null && spanNights !== nights) throw new Error('Date mismatch: … not committing inconsistent dates.');
  if (spanNights < 1) throw new Error('Invalid stay window … not committing.');
  ```
  An inconsistent span (or a zero/negative window) **fails loud and never
  commits**. With the screenshot scenario (07/02→07/31, `nights=29`):
  `spanNights = 29 === nights` → passes.
- **Button gate** (`:88-105`): `datesMissing = !checkinDate || !checkoutDate`
  disables the button + shows "Re-scan to refresh stay dates." (defense-in-depth
  so the user sees why before clicking) — again, **no trip-date fallback**.

## STEP 4 — Commit loop now spans the stay, not the trip

`vendor-commit/route.ts` is **unchanged** (correctly): once fed the real window it
faithfully spans it. With `startDate=07/02, endDate=07/31`:
- The multi-day loop (`:203-221`) writes entries across **the 29-night stay**
  (Jul 2 … Jul 31 inclusive = 30 calendar-day rows), not Jul 1 → Jan 1 (184).
- `dailyCost = details.amount / totalDays` (`:206-207`) is now `amount / 30`
  (the stay's calendar days) instead of `amount / 184` — the per-day costs sum to
  the unchanged total `amount` (the budget line item itself stays the full
  `amount`, `:152`). **The cost-split-across-184-days bug is fixed.**
- The `calendar_events` row (`:234-239`) now spans `checkin → checkout` (29
  nights), so `ItineraryAgenda` computes `nights = round((endDate−startDate)/day)
  = 29` (`ItineraryAgenda.tsx:117-120`) — matching the label.

> **Honest nuance:** the route's multi-day loop is **inclusive**
> (`totalDays = round((end−start)/day)+1`, `:206`), so a 29-night stay produces
> 30 day-rows and `dailyCost = amount/30` (not exactly `/29`). This is
> pre-existing route behavior shared by all multi-day lodging/vehicle commits and
> is **out of scope** here (the PR feeds it correct dates; it doesn't change the
> loop). The decisive fix — span 184 → the stay window, and the divisor 184 → the
> stay's day count — is achieved, and the **nights label the user sees** (agenda
> span = `checkout − checkin` = 29) is exactly correct.

## STEP 5 — The three+ sources now agree (all = search window)

| Surface | Reads | Value |
|---|---|---|
| Hotel card nights | `rec.nights` (`TripPlannerAI.tsx:1434`) | 29 |
| Detail nights label | `rec.nights` (`page.tsx:194`) | 29 |
| Committed itinerary span | `calendar_events` `checkin→checkout` = `rec.checkinDate→rec.checkoutDate` → agenda `:119` | 29 |
| Commit assertion | `round((checkout−checkin)/day) === rec.nights` | 29 === 29 ✓ |

`rec.nights`, `rec.checkinDate`, and `rec.checkoutDate` are **all derived from the
same search window in one place** (`liteapiClient.ts:289-306`, where
`nights = round((checkout − checkin)/day)` and the dates are `params.checkin/
checkout`). So they're consistent by construction — the assertion (§3) guards the
invariant at commit. The 184-night divergence is gone.

## Control-bar non-persistence — separate follow-up (noted, NOT fixed)

The 🟡 control-bar reset (audit §2: `perLocationDates` is non-persisted
`useState({})`, `TripPlannerAI.tsx:241,746-751`, so it re-prefills to
trip-start+7 on remount) is a **display/UX** issue, **out of scope** for this
commit-integrity PR. It does **not** affect committed dates now, because the
commit reads `rec.checkinDate/checkoutDate` (persisted on the scan rec), not the
live control-bar state. Flagged for a separate follow-up.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| NO fallback to trip dates / any default | ✅ removed `|| today`; missing dates → disable + fail-loud throw |
| amount unchanged (rec.price); only span + divisor corrected | ✅ `amount` passed verbatim; only dates changed |
| Don't touch pricing display (PR-21) / charge-Reserve (PR-15) beyond correct dates | ✅ Reserve now gets rec dates; pricing block untouched |
| Assert checkout − checkin === nights, fail loud | ✅ `AddToTripButton.tsx` throws on mismatch |
| Control-bar persistence = separate follow-up | ✅ noted, not touched |
| 0 schema (rec fields are in-memory JSON) | ✅ no prisma change |
| 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs base) | ✅ liteapiClient 0e/0w, page 0e/0w, AddToTripButton 0e/0w |
| diff scope | ✅ liteapiClient + detail page + AddToTripButton (+ report); vendor-commit UNCHANGED |

---

## Result
The hotel rec now carries the exact search-window `checkinDate`/`checkoutDate`
(threaded from the LiteAPI mapper alongside `nights`). The detail page commits
**those** dates — never `trip.startDate`/`trip.endDate` — and fails loud (no
fallback) if they're absent. A commit-time assertion enforces `checkout − checkin
=== rec.nights`, so inconsistent dates can never persist. The committed itinerary
now spans the 29-night stay (not 184), the cost is distributed across the stay's
days (not 184), and the agenda renders 29 nights — so card, detail, committed
span, and label all read the same search window. The control-bar non-persistence
is noted as a separate follow-up. tsc + lint clean, 0 schema, 0 deps.
