# TRAVEL — PR-35 Implementation: manual-price one-time commit for Google places

**Branch:** `claude/travel-pr-35`
**Date:** 2026-05-31
**Scope:** Google place results are **unpriced** — add a manual-price **one-time**
commit form (amount + start/end date + start/end times) that commits any of the 9
Google sections to Committed Budget on the category's correct COA (PR-35a-synced),
with the **personal-only/Business-trip rule enforced server-side**. Recurring is a
separate later PR. Per `audit-reports/travel-pr-35-audit.md`. 3 files + this
report. **0 schema, 0 deps.**

---

## STEP 1 — Commit surface verified

- **Detail page `source==='google'`** previously had **no commit** — only the
  "Google Maps ↗" external link + a "discovery-only" note
  (`…/[rank]/page.tsx:460`). `AddToTripButton` rendered unconditionally but was
  permanently disabled for Google (null price/dates).
- **vendor-commit synthetic paths:** flight (`route.ts:109-110`) + synthetic
  lodging (PR-32, `:95`) build details from the payload (no DB row). **Prefix
  logic** `:121` `const prefix = trip.tripType === 'business' ? 'B' : 'P'`;
  trip type is loaded with the trip (`:84`, full row → `trip.tripType`).
- **`coaBusiness: null`** confirmed in `travelCOA.ts` for the personal-only set:
  **nightlife** (`:131`), **gyms** (`:239`), **sports** (`:254`), **festivals**
  (`:146`). Business-capable: brunch_coffee/dinner/coworking/groceries/shopping.

## STEP 2 — `PlaceCommitForm` (Google only)

New `…/[rank]/PlaceCommitForm.tsx` client island (the detail page is a server
component). Fields: **amount** (required, positive), **start/end date** (required),
**start/end time** (optional). **No recurring toggle** (one-time only). Rendered
in `page.tsx` **only for `source==='google'`** (`:469-476`); **hotels keep
`AddToTripButton`, now gated to `source==='liteapi'`** (`:447-457`) — untouched
otherwise. Mozio/external branches unchanged.

## Dependency — PR-35a (COA sync)

This PR's per-category COA correctness **depends on PR-35a** (`getCOACode` sync for
coworking/gyms/sports/groceries). This branch is cut from `main`, which does not
yet contain 35a, so on this branch in isolation `getCOACode` returns `9950` for
those 4 categories. Once **both 35a and 35 are merged to `main`**, `getCOACode`
returns the canonical codes and place commits file correctly. The
**accounting BLOCK rule is independent of 35a** — it reads
`TRAVEL_COA[category].coaBusiness` directly (canonical, always present), so the
personal-only/Business guard is correct regardless of merge order. (Merge 35a
before/with 35.)

## STEP 3 — Synthetic activity commit

`PlaceCommitForm` POSTs to `/api/trips/{tripId}/vendor-commit`
(`PlaceCommitForm.tsx:46-62`):
```ts
{ optionType:'activity', synthetic:true, category, optionId:`place-${category}-${Date.now()}`,
  amount, startDate, endDate, startTime?, endTime?, notes: placeName, location }
```
vendor-commit adds `isSyntheticActivity = optionType==='activity' && synthetic===true`
(`route.ts:96`). The synthetic branch builds `details` from the payload
(`:109-110`, no `trip_activity_expenses` row), skips `setOptionStatus`
(`:116-118`), and takes the COA from the **passed category** via
`getCOACode(category)` (`:127-131`, PR-35a-synced) — not a DB lookup.

## STEP 4 — Accounting rule enforced SERVER-SIDE

`route.ts:105-138` (before the transaction, the real guard — not just UI):
```ts
let placePrefix: 'P' | 'B' = trip.tripType === 'business' ? 'B' : 'P';
if (isSyntheticActivity) {
  // …validate category + amount + dates (STEP 5)…
  const businessCapable = TRAVEL_COA[category].coaBusiness != null;
  if (!businessCapable && trip.tripType === 'business') {
    return 422 `${label} is a personal-only category and can't be committed to a Business trip.`;
  }
  placePrefix = businessCapable && (trip.tripType==='business' || trip.tripType==='mixed') ? 'B' : 'P';
}
…
const coaCode = `${isSyntheticActivity ? placePrefix : prefix}-${coaNumber}`;   // :152
```
Verified across all 9 categories × 3 trip types (simulation matching the locked
spec):
- **Personal trip** → all `P-`.
- **Business trip** → business-capable `B-`; **personal-only (nightlife/gyms/
  sports/festivals) → BLOCK (422)**.
- **Mixed trip** → business-capable `B-`; **personal-only → `P-`**.

This reads `TRAVEL_COA[category].coaBusiness != null` at runtime (not a hardcoded
list) and is the COA's null-business constraint **enforced**, never substituted —
a personal-only category is never silently filed as business. Non-synthetic
commits (hotels/flights/etc.) keep the original `prefix` (`:152`) — unchanged.

## STEP 5 — Dates + times + validation (PR-33 discipline, NO fallback)

Server-side (`route.ts:108-127`), the real enforcement:
- **Amount** — `Number.isFinite(amt) && amt > 0` else **400** ("A positive amount
  is required — Google places have no price…"). Sole cost source; never defaulted.
- **Dates** — `endDate` required (400) and `new Date(endDate) >= new
  Date(startDate)` (400). **No fallback to trip dates.**
- **Times** — optional; passed through to `homeTime`/`destTime`.
- The form mirrors these client-side (`PlaceCommitForm.tsx:31-38`, button disabled
  until valid) but the **server is authoritative**.
- **Committed span = entered window:** synthetic activity flows through the
  multi-day itinerary branch (`route.ts:234-252`) spanning `start`→`end` (the
  entered dates), with `homeTime: startTime`, `destTime: endTime`,
  `location: activityLocation`, `vendor: details.title` (place name). The
  `calendar_events` row spans the same entered window.

## STEP 6 — Country + budget landing

- `location = destinationLabel` → `trip_itinerary.location` (`:247`) → the trip
  page's `loadBudgetItems` keys `itineraryLocationMap[vendor]=location` and
  resolves the **Committed Budget Country** column (the budget description and
  itinerary vendor are both `details.title`, so the key matches — same mechanism
  as PR-32).
- `budget_line_items` row (`:155-166`): `coaCode = ${placePrefix}-${coaNumber}`
  (correct per-category COA + enforced prefix), `amount = details.amount` (the
  manual cost), `description = placeName`, `source:'trip'`. Lands in Committed
  Budget on the right line. `coaCodeToLabel` already knows the PR-28f codes
  (P-9520/P-9530/P-9830 etc.) so the category label renders.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| ONE-TIME only; no recurring/cadence | ✅ no recurring toggle/field; no cadence write |
| Google places only; hotels' AddToTripButton untouched | ✅ form gated `source==='google'`; button gated `source==='liteapi'` |
| Accounting rule enforced SERVER-SIDE (Business+personal-only = block) | ✅ `route.ts:105-138`, 422 block; verified 9×3 |
| NO fallback: bad amount/dates fail loud; null-business blocks, never substitutes | ✅ 400 on amount/date; 422 block; reads coaBusiness at runtime |
| Don't touch hotel commit / pricing / section split / 35a map | ✅ AddToTripButton/PR-33 dates/PR-34/travelCategories untouched |
| 0 schema, 0 deps | ✅ trip_itinerary times + budget cols already exist |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (branch vs base) | ✅ route 0e/1w (==base; the 1 `activityCategory` unused-var warning pre-exists on main), page 0/0, new island 0/0 |
| diff scope | ✅ vendor-commit route + detail page + new PlaceCommitForm (+ report) |

---

## Result
Google places can now be committed: for `source==='google'` the detail page shows
`<PlaceCommitForm>` (manual amount + start/end date + start/end times, one-time),
which POSTs the synthetic `activity` path. The commit lands in Committed Budget on
the category's correct COA (PR-35a) with the **personal-only/Business rule
enforced server-side** — personal-only categories (nightlife/gyms/sports/festivals)
are **blocked** on Business trips (422), filed `P-` on Mixed, and `P-` on Personal;
business-capable categories file `B-` on Business/Mixed. Amounts and dates are
validated with no fallback (PR-33 discipline); the committed itinerary spans the
entered window; Country resolves from the scan destination. Hotels' commit is
untouched. Recurring is a separate later PR. tsc + lint clean, 0 schema, 0 deps.
