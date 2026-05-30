# TRAVEL — PR-26 Implementation: un-nest individual reviews from the aggregate gate

**Branch:** `claude/travel-pr-26`
**Date:** 2026-05-30
**Scope:** Render-only restructure of the "Guest reviews" section on
`discover/[category]/[rank]/page.tsx`. Stops the fetch-and-discard. 1 file +
report. 0 deps, 0 schema.

---

## STEP 1 — The bug (before)

The fetch fires whenever the hotel is bookable — `page.tsx:170`:
```ts
if (source === 'liteapi' && rec.liteapiHotelId) {   // PAID /v3.0/data/reviews call
  reviews = await getHotelReviews(rec.liteapiHotelId, { limit: 8 });
}
```
But the render of those reviews (+ the "No written guest reviews yet" empty
state) was **nested inside the aggregate gate** — before, `page.tsx:258-309`:
```tsx
{(rec.reviewScore != null || rec.reviewCount > 0) && (   // ← AGGREGATE gate
  <div className="mb-6">
    <h2>Guest reviews</h2>
    …aggregate badge…
    {source === 'liteapi' && rec.liteapiHotelId && (      // individual reviews TRAPPED inside
      …list / "No written guest reviews yet" / error…
    )}
  </div>
)}
```
So for a thin-metadata hotel (`reviewScore == null && reviewCount === 0`) the
paid call still ran, then the whole section — including the fetched reviews and
the empty state — was hidden. **Fetched, paid for, discarded.**

## STEP 2 — Separated the two blocks (after)

`page.tsx:263-323` — one shared header, two **independent** gates:
```tsx
{((rec.reviewScore != null || rec.reviewCount > 0) || (source === 'liteapi' && rec.liteapiHotelId)) && (
  <div className="mb-6">
    <h2>Guest reviews</h2>

    {/* AGGREGATE badge — condition UNCHANGED from PR-22 */}
    {(rec.reviewScore != null || rec.reviewCount > 0) && ( …score badge + count… )}

    {/* INDIVIDUAL reviews — gated on liteapiHotelId (== the fetch gate) */}
    {source === 'liteapi' && rec.liteapiHotelId && (
      …error → "couldn't be loaded" / empty → "No written guest reviews yet" / list…
    )}
  </div>
)}
```
- A hotel **with reviews but no aggregate score** now shows its written reviews.
- A hotel **with neither** shows the quiet "No written guest reviews yet".
- A hotel **with an aggregate** still shows the badge — its condition is byte-
  unchanged.
- The shared header renders when **either** sub-block has something, so there's
  never a stray empty "Guest reviews" heading and never a duplicate header.

The aggregate badge JSX and the individual-reviews list/empty/error JSX are
**verbatim** from PR-22/23 — only the gating/nesting changed.

## STEP 3 — No wasted call (gates now match)

| | line | condition |
|---|---|---|
| Fetch | `page.tsx:170` | `source === 'liteapi' && rec.liteapiHotelId` |
| Individual-reviews render | `page.tsx:291` | `source === 'liteapi' && rec.liteapiHotelId` |

**Identical.** Whenever we pay for `/v3.0/data/reviews`, we render the result
(list, or the honest empty/error state). When `liteapiHotelId` is absent, the
fetch doesn't fire **and** the block doesn't render — consistent, no
fetch-and-discard.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Render-only restructure | ✅ only the reviews-section JSX gating changed |
| Fetch logic (`:168-176`) unchanged | ✅ not in diff (grep for `getHotelReviews`/`let reviews`/`reviewsError = true` → no changed lines) |
| Pricing (PR-21) / charge path (PR-15) / card / gallery / map / amenities untouched | ✅ those lines not in diff; `ReserveHotelButton.tsx`, `TripPlannerAI.tsx`, `liteapiClient.ts` not in diff |
| Empty/error stay honest (quiet empty ≠ error), no fabrication/fallback | ✅ three distinct states preserved verbatim |
| 0 deps, 0 schema | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed file | ✅ 0 errors (identical to main) |
| git diff = detail page + report | ✅ `git diff --name-only main` = detail page only |

---

## Result
The paid `/v3.0/data/reviews` call is no longer wasted: written guest reviews now
render whenever the hotel is bookable (`liteapiHotelId`), independent of whether
LiteAPI returned an aggregate score — and a hotel with no reviews shows the
honest "No written guest reviews yet" instead of nothing. The aggregate badge,
pricing, charge path, card, gallery, map, and amenities are unchanged.
