# TRAVEL — PR-22/23 Verify Audit: detail page missing reviews / amenities / map

**Branch:** `claude/travel-pr-22-23-verify-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Symptom:** The hotel detail page (Grandmas Plus Hotel Airport) shows
photo + address + pricing, but **no** amenities grid, **no** map, and **no**
reviews section — not even the "No written guest reviews yet" empty state.

---

## 1. PR-22/23 blocks ARE on main (not a stale/missing merge)

`discover/[category]/[rank]/page.tsx` on current main HEAD
(`2357536a`, merge of PR-23):
- `HotelGallery` import `:9`, render `:191`.
- `HotelMap` import `:10`, render `:228-231`.
- Amenities grid `:234-253`.
- Aggregate reviews `:256-275`; PR-23 individual reviews `:277-307`.
- `getHotelReviews` import `:11`, fetch `:168-176`.

The merges landed. **Not a deploy-missing-code finding** (Alex should still
confirm the live Vercel deploy hash == main HEAD `2357536a` — §5 — but the code
is on main).

## 2. The reviews section renders NOTHING because it's gated on the AGGREGATE

The PR-23 individual-reviews block — **and its empty-state text** — is **nested
inside** the aggregate conditional:
```tsx
:258  {(rec.reviewScore != null || rec.reviewCount > 0) && (        // ← AGGREGATE GATE
:259    <div className="mb-6">
:260      <h2>Guest reviews</h2>
          …aggregate badge…
:280      {source === 'liteapi' && rec.liteapiHotelId && (           // PR-23 sub-block
:282        {reviewsError ? (…couldn't be loaded…)
:285         : reviews.length === 0 ? (…No written guest reviews yet…)
:286         : (…review list…)}
:307      )}
:308    </div>
:309  )}
```
So when `rec.reviewScore == null` **and** `rec.reviewCount === 0`, the **entire
"Guest reviews" section is hidden — including the "No written guest reviews yet"
line.** That is exactly why no empty state shows.

**Worse — a real structural bug:** `getHotelReviews(rec.liteapiHotelId)` is fired
at `:168-176`, gated only on `source==='liteapi' && rec.liteapiHotelId` — so the
**paid `/v3.0/data/reviews` call runs and may return real written reviews**, but
its render is trapped inside the aggregate gate (`:258`). If the rec has no
aggregate score/count, those fetched reviews are **discarded** and never shown.
The individual-reviews block should be gated on the reviews fetch (its own
state), **not** on `rec.reviewScore`.

## 3. Amenities + map gates — and whether this hotel has the data

- **Map** (`:228`): `rec.latitude != null && rec.longitude != null`.
- **Amenities** (`:236-237`): `amenities = (rec.facilitiesAll?.length ? rec.facilitiesAll : rec.facilities) ?? []`; renders only if `amenities.length > 0`.

These render nothing when those fields are **absent on the rec**. For this hotel:
pricing shows (so `rec.price`/`pricePerNight`/`nights` are present — a recent
PR-15-era scan), but amenities/map/aggregate-reviews don't — which means the rec
**has pricing but lacks `facilities`/`facilitiesAll`/`latitude`/`longitude`/
`reviewScore`/`reviewCount`**.

## 4. The `rec` object — read from STORED scan JSON; thin rates metadata

`rec` is read from `trip_scanner_results.recommendations` (the stored scan), not
rebuilt live — `page.tsx:121-131`:
```ts
const rows = await prisma.trip_scanner_results.findMany({ where: { tripId, category }, … });
const recs = (row.recommendations || []) as unknown as Recommendation[];
const match = recs.find(r => r.valueRank === wantedRank); rec = match;
```
The card (`TripPlannerAI`) reads the **same** stored recommendations, so both see
identical fields. The mapper (`liteapiClient.ts`) populates `reviewScore`,
`hotelFacilities→facilities/facilitiesAll`, `latitude/longitude` **only from what
`/hotels/rates` (`includeHotelData`) returns in `data.hotels[]`** — and that
rates-side metadata is **minimal** (name, address, photo, price). The rich
fields (full facilities, lat/lng, guest review score) live in the dedicated
`/data/hotel` **content** endpoint, which we do **not** call. So for a thin-
metadata property like an airport budget hotel, `rec` legitimately carries
pricing + photo + address but **not** facilities/lat-lng/reviewScore →
the gated sections correctly render nothing.

**This is empty DATA, not a render crash.** The reviews `try/catch` (`:171-176`)
only sets `reviewsError`; it never hides the page, and there is no catch that
swallows amenities/map.

## 5. Deploy check (for Alex)

Code is on main (`2357536a`). Alex should confirm the **live Vercel deploy hash
== `2357536a`** (or later). If the live deploy predates the PR-22 merge, that
would independently explain the absence — but the more likely cause is §3-4
(empty data) + §2 (gating).

---

## VERDICT — combination, dominated by empty data + a gating bug (NOT stale deploy, NOT a crash)

1. **Empty data (primary):** the stored `rec` (built from `/hotels/rates`
   `includeHotelData`, which returns thin metadata) lacks
   `facilities`/`facilitiesAll`, `latitude`/`longitude`, and
   `reviewScore`/`reviewCount` for this hotel — so the map (`:228`), amenities
   (`:236`), and aggregate-reviews (`:258`) sections are all correctly gated off.
   Pricing shows because rates always returns pricing.
2. **Gating bug (secondary, real):** the PR-23 individual-reviews block + its
   empty-state are nested inside the aggregate gate (`:258`), so the paid
   `/data/reviews` results (and the "No reviews yet" text) are suppressed
   whenever the rec has no aggregate score/count — exactly this hotel. The paid
   call fires (`:172`) but its output can't render.
3. **Not stale deploy** (blocks on main `2357536a`; Alex confirms the deploy
   hash). **Not a render crash** (no whole-section/​page swallow).

### What a fix PR should do (not implemented here)
- **Un-nest** the PR-23 individual-reviews block from the aggregate gate so it
  renders (list / empty / error) on `source==='liteapi' && rec.liteapiHotelId`
  independent of `rec.reviewScore` — surfacing reviews (or the honest empty
  state) even for thin-metadata hotels, and not wasting the paid call.
- To populate amenities/map/aggregate for thin-rates hotels, call the
  `/data/hotel` **content** endpoint for the viewed `hotelId` (richer metadata:
  full facilities, coords, review aggregates) — larger scope; or accept these
  stay empty when rates metadata is thin.

### How Alex can confirm in 60 seconds
- Does the **card** for Grandmas Plus show facility icons / a reviewScore badge?
  If no → confirms the rec lacks those fields (empty data, §3-4).
- Vercel logs: grep `[LiteAPI] reviews: dataLen=` for this hotelId — if it logs
  `dataLen > 0` while the page shows no reviews → confirms the §2 gating bug
  (fetched but suppressed).

---

**READ-ONLY audit. No implementation performed.**
