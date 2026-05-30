# TRAVEL — PR-15 Implementation: Per-Night Price + `extractNightlyRate` Fix

**Branch:** `claude/travel-pr-15`
**Date:** 2026-05-30
**Scope:** Add optional `pricePerNight`, fix the per-night bucketing, rename
`extractNightlyRate → extractStayTotal`, and kill the detail-page double-count.
The `price` field meaning and the booking charge path are **unchanged**.

---

## Step 1 — `pricePerNight` computed in the mapper

`src/lib/liteapiClient.ts:445-457`:
```ts
let pricePerNight: number | undefined;
if (priceTotal != null) {
  if (typeof nights === 'number' && nights >= 1) {
    pricePerNight = Math.round(priceTotal / nights);
  } else {
    console.error(`[LiteAPI] pricePerNight: invalid nights=${nights} for hotelId=${hotel.hotelId} (priceTotal=${priceTotal}) — rendering no per-night`);
  }
}
```
- **Fail-loud assertion** at `:455` — `nights` is date-derived (`nights >= 1` by
  construction), so the `else` is a "must-never-fire" date-bug alarm, **not a
  fallback**: it logs and leaves `pricePerNight` undefined (→ no price rendered),
  never a synthesized/defaulted value.
- A null `priceTotal` (metadata-only hotel, no rate) skips the block silently —
  that's "no rate", not a nights bug, so no false alarm.

## Step 2 — Rename `extractNightlyRate → extractStayTotal`

`src/lib/liteapiClient.ts:356`. Return value **unchanged** (still
`retailRate.total[0].amount`, the whole-stay total).

**Before** (`:347-356`): doc said *"lowest nightly rate"* + the PR-13
`TODO(PR-15)`.
**After** (`:347-356`): doc says *"the WHOLE-STAY total … is the total for the
booked window, NOT a per-night rate"*, TODO removed (resolved). Call site renamed
at `:440` (`const stayTotal = extractStayTotal(hotel)`); `price: stayTotal` at
`:496`. `extractRateMeta`'s doc references updated (`:371-372`). Pure rename — no
behavior change to the total.

## Step 3 — Bucketing fix

`src/lib/liteapiClient.ts:459-461`:
```ts
// Before:  nightlyToPriceLevel(nightlyUsd)   ← buckets the STAY TOTAL ✗
const { level: priceLevel, display: priceLevelDisplay } =
  nightlyToPriceLevel(pricePerNight ?? null);   // ← buckets PER-NIGHT ✓
```
`nightlyToPriceLevel` (`:415-423`, thresholds `<80/<200/<400`) is unchanged but
now fed the per-night value.

**Worked example — $700 total / 7 nights:**
- Before: `nightlyToPriceLevel(700)` → `700 ≥ 400` → **`$$$$`** (luxury). ✗
- After: `pricePerNight = 700/7 = 100`; `nightlyToPriceLevel(100)` → `100 < 200`
  → **`$$`**. ✓

When `pricePerNight` is undefined (the assert-fail edge) → `nightlyToPriceLevel(null)`
→ `{ level: null, display: null }` → **no price level** (mirrors PR-14
render-nothing), not a synthesized band.

## Step 4 — `pricePerNight?` added to all 3 interfaces (optional)

| Interface | File:line |
|---|---|
| `HotelRecommendation` (mapper output) | `src/lib/liteapiClient.ts:344-347` |
| `GrokRecommendation` (card) | `src/components/trips/TripPlannerAI.tsx:52` |
| `Recommendation` (detail page) | `…/discover/[category]/[rank]/page.tsx:62` |

All optional — Viator/Google leave them `undefined` (same PR-13/14 pattern).
Returned from the mapper at `liteapiClient.ts:505` (`pricePerNight`).

## Step 5 — Detail-page double-count fixed

`…/discover/[category]/[rank]/page.tsx:118-124`:
```ts
// Before:  const nightly = rec.price ?? null;                         // = TOTAL
//          const totalForTrip = nightly != null ? nightly * nights : null;  // TOTAL × nights ✗ ($9,800)
const perNight  = rec.pricePerNight ?? null;   // per-night, read directly
const stayTotal = rec.price ?? null;           // the total — NOT recomputed
```
- `/night` label now uses `perNight` (`:185`).
- Total now shows `stayTotal` (`= rec.price`, the honest total) (`:191`) — the
  `× nights` double-count is gone.
- Pricing block gated on `perNight != null` (`:182`).
- **`ReserveHotelButton` charge path preserved:** `nightly={stayTotal}` (`:206`)
  resolves to `rec.price` — **value-identical** to the prior `nightly={nightly}`
  (which was also `rec.price`). `ReserveHotelButton.tsx` itself is untouched.

## Step 6 — Card display upgrade (liteapi branch only)

`src/components/trips/TripPlannerAI.tsx:1056-1064`:
```tsx
{rec.pricePerNight != null && rec.nights != null ? (
  <span className="font-semibold text-brand-gold-bright">
    {rec.currency || '$'}{rec.pricePerNight}/night · {rec.nights} nights
    {rec.priceTotal != null ? ` · ${rec.currency || '$'}${rec.priceTotal}` : ''}
  </span>
) : ( /* render nothing — PR-14 behavior for the assert-fail edge */ null )}
```
Renders **"$200/night · 7 nights · $1,400"**. Gated on `pricePerNight` so the
nights<1 edge keeps PR-14's render-nothing. Non-liteapi (Viator/Google) branch
(`:1075+`) is byte-unchanged.

## Step 7 — Sort / filter consistency

No code change required — both key off `priceLevel`, which now derives from the
corrected per-night bucketing:
- **Filter** `ai-assistant/route.ts:377` (`p.priceLevel <= maxPriceLevel`) — now
  filters on the correct band, so a $100/night hotel (was wrongly `$$$$`) is no
  longer excluded at `maxPriceLevel=2`. Route file **not** in the diff.
- **Sort** `TripPlannerAI.tsx:380` (`sortBy==='price'` → `priceLevel`) — orders
  by the corrected per-night band.

Both improve correctness; neither reorders in a way that breaks a test (no
price-rank fixtures exist; ranking by quality/compositeScore is unaffected).

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| `price` meaning unchanged everywhere | ✅ `price: stayTotal` (= the total, via renamed extractor) |
| `ReserveHotelButton.tsx` untouched | ✅ **not in diff**; charge value still `rec.price` |
| No fallback logic (nights<1 = fail-loud assert) | ✅ `console.error` + undefined, no default |
| New field optional; Viator/Google byte-unchanged | ✅ 3 optional fields; non-liteapi card branch unchanged |
| No schema / route / migration | ✅ none in diff (filter reads corrected priceLevel, no edit) |
| `duffel.ts:180` 00:00 flag untouched | ✅ not in diff |
| 0 new deps; tsc + eslint clean | ✅ tsc exit 0; changed files add 0 errors / 0 warnings |

**git diff vs main** — exactly 3 files:
```
src/lib/liteapiClient.ts                                  (+46 / −19)
src/components/trips/TripPlannerAI.tsx                     (+13 / −11)
src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx (+12 / −8)
```
ReserveHotelButton, duffel, schema, and all routes = **0**.

---

## The one root bug, all three manifestations — fixed
1. **Bucketing inflation** → now buckets per-night (`liteapiClient.ts:461`).
2. **Detail-page double-count** ($1,400 → was $9,800) → `totalForTrip` is now
   `rec.price`, not `perNight × nights` (`page.tsx:124`).
3. **False "/night" label** → now shows the real `pricePerNight` (`page.tsx:185`).

The money path (`price` total + `ReserveHotelButton` charge) is byte-identical.
