# TRAVEL — PR-21 Implementation: detail-page nights (185→real) + remove stale scan-header label

**Branch:** `claude/travel-pr-21`
**Date:** 2026-05-30
**Scope:** Fix the nights LABEL on the hotel detail page so it matches the card +
the total. Remove the stale 185 label on the scan header. Card, total, and the
charge path untouched.

---

## STEP 0 — The card's correct nights source (reference of truth)

The Accommodation card renders nights from **`rec.nights`** —
`TripPlannerAI.tsx:1104-1108`:
```tsx
{rec.pricePerNight != null && rec.nights != null ? (
  …{rec.currency || '$'}{rec.pricePerNight}/night · {rec.nights} nights …
```
`rec.nights` is the PR-13/PR-15 field = the **real search-window nights** (30),
stamped on each recommendation by `searchHotelRates` (`liteapiClient.ts:289`).
This is the value the detail page must also use.

## STEP 1 — The detail-page fix

**Where it got 185:** `discover/[category]/[rank]/page.tsx:122` —
```ts
const nights = trip.daysTravel || 1;   // ← trip.daysTravel = whole-trip span (185)
```
`trip.daysTravel` is the **whole-trip** span (selected at `:84`), not the per-stay
window. The per-night (`rec.pricePerNight`, `:123`) and total (`rec.price`,
`:124`) were already correct 30-night numbers — only the **nights label** (used
at `:188`) was wrong.

**Before → after** (`page.tsx:122`):
```ts
- const nights = trip.daysTravel || 1;     // 185 (whole trip)
+ const nights = rec.nights ?? null;        // 30  (real window, same field the card uses)
```
And the pricing block is now gated on the real nights too — `page.tsx:184`
(matches the card's truth-first gate):
```ts
- {source === 'liteapi' && perNight != null && (
+ {source === 'liteapi' && perNight != null && nights != null && (
```
The label at `:188` (`× {nights} {nights === 1 ? 'night' : 'nights'}`) is
unchanged — it now reads the corrected `nights` (= `rec.nights` = 30).

`trip.daysTravel` is still selected at `:84` (left untouched, harmless) and is no
longer read for the label.

## STEP 2 — Reconciliation (truth-first: displayed nights × per-night == total)

Using the reported card numbers (`USD1044/night · 30 nights · USD31333.99`):

| | per-night | × nights | = | vs Total $31,333.99 |
|---|---|---|---|---|
| **Before (bug)** | $1044 | × **185** | $193,140 | ✗ off by ~6× |
| **After (fix)** | $1044 | × **30** | $31,320 | ✓ ≈ $31,333.99 (within `pricePerNight = round(31333.99/30)=1044` rounding) |

Label and total now agree — both are the 30-night reality. The ~$14 gap is the
expected rounding of `pricePerNight` (PR-15 rounds per-night); the **Total shown
is the exact `rec.price` ($31,333.99)**, unchanged.

## STEP 3 — Stale scan-header label removed

`TripPlannerAI.tsx:768-774` — removed the trip-span label, kept the
no-trip-dates warning (the date inputs need a trip start to prefill):
```tsx
- {tripDates?.departure && tripDates?.return ? (
-   <span>{tripDates.departure} → {tripDates.return} · {daysTravel} nights</span>   // stale 185
- ) : (
-   <span className="text-orange-600 …">⚠ Set trip dates above …</span>
- )}
+ {!(tripDates?.departure && tripDates?.return) && (
+   <span className="text-orange-600 …">⚠ Set trip dates above to enable Stays & Reserve</span>
+ )}
```
Destination name, the per-location date inputs, and Refresh all remain. The
per-location check-in/check-out (PR-19) is now the source of truth for each
destination's window. (`daysTravel` is still used at `:291` and `:308`, so the
prop stays.)

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Card unchanged (it's the reference) | ✅ `TripPlannerAI.tsx:1104-1108` not in diff |
| Total computation unchanged | ✅ `stayTotal = rec.price` (`page.tsx:124`) untouched; only the nights label fixed |
| ReserveHotelButton / charge path untouched | ✅ `nightly={stayTotal}` and the whole Reserve block not in diff; PR-15 charge path intact |
| daysTravel/tripDates vars left if used elsewhere | ✅ `daysTravel` still feeds `tripDays` (`:291`) + scan body (`:308`); detail page `:84` select left |
| 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed files | ✅ identical to main (detail 0/0; TPA 2 pre-existing — 0 added) |
| git diff = detail page + TripPlannerAI.tsx + report | ✅ `git diff --name-only main` confirms |

**Net effect:** click a hotel card → the detail/Reserve page now shows
`$1044 / night × 30 nights · Total $31,333.99` — the label, the per-night, and
the total all reconcile, matching the card. The scan header no longer shows the
misleading 185-night trip span.
