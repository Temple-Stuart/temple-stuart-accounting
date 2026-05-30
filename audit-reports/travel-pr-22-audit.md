# TRAVEL — PR-22 Audit: Institutional-Grade Hotel Detail / Reserve Page

**Branch:** `claude/travel-pr-22-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Real data only — never fabricate a review/amenity/photo.
**Goal:** Map what's already available (PR-13) vs what needs a new LiteAPI call
(individual reviews), and propose a Booking.com/Airbnb-class detail page.

> **Docs:** the reviews reference loaded and is **confirmed** (see §3). All
> codebase facts are verified from source.

---

## 1. Current detail-page anatomy

`src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx` (263 lines, an
async **server** component). Data load:
- `rec` from `trip_scanner_results.recommendations` JSON (`:93-108`);
  `destinationLabel = row.destination` (`:98-104`); `source` derived `:110`;
  nights/perNight/stayTotal (`:126-128`); checkin/checkout from trip dates
  (`:131-132`).

Render (`:134-263`) — what it shows today and the fields it reads:
| Section | Lines | Reads |
|---|---|---|
| Single hero photo | `:143-153` | `rec.photoUrl` only (one image) |
| Name + category + source badge | `:155-164` | `rec.name`, `categoryLabel`, `destinationLabel` |
| Quick facts | `:166-175` | `rec.googleRating`, `rec.reviewCount`, `rec.priceLevelDisplay` |
| Address (one line) | `:177-180` | `rec.address` |
| Description | `:182-185` | `rec.summary` (the 300-char-truncated desc) |
| Pricing block | `:187-202` | `perNight`, `nights`, `stayTotal` (PR-21, reconciled) |
| Reserve / actions | `:204-216+` | `ReserveHotelButton` (offerId, dates, `nightly={stayTotal}`) |

**It ignores almost all of PR-13's richness** — no `images[]` gallery, no
`facilities[]`, no `reviewScore`, no `chain`, no `city`, no `latitude/longitude`.

## 2. Data already available on `rec` (PR-13/15) — present, just unrendered

The mapper (`liteapiClient.ts:500-end`) outputs, and the detail page's own
`Recommendation` interface (`page.tsx:16-62`, fields at `:53-62`) already types:
| Field | Mapper line | Detail page uses it? |
|---|---|---|
| `images: string[]` (FULL gallery) | `:478` (`h.hotelImages.map(url)`) | ❌ no |
| `facilities: string[]` (**filtered to 6**) | `:479` (`filterStandardFacilities`) | ❌ no |
| `reviewScore` (0-10) | mapper (`h.reviewScore`) | ❌ no |
| `reviewCount` | `:485` | ✅ (in quick facts) |
| `chain` | mapper (`h.chain`) | ❌ no |
| `city` / `addressLine` | mapper | ❌ (uses `rec.address`) |
| `latitude` / `longitude` | mapper | ❌ no |
| `summary` (desc, **truncated 300**) | `:516` | ✅ (truncated) |
| `priceTotal`/`nights`/`pricePerNight`/`currency` | `:467,440…` | ✅ (pricing) |

**Populated on real hotels?** Yes — the live card (PR-14/19/21) already renders
`images[0]`, the 6 facility icons, `pricePerNight·nights·priceTotal`, and the
`reviewScore` badge on real prod Bali hotels, so these fields are populated, not
just typed. `latitude/longitude` come from `includeHotelData` metadata. The
detail page simply doesn't read them.

**Two gaps in the mapper for a full page (precursor work):**
- `facilities` is **filtered to 6** (`:438`) — the **full `hotelFacilities[]`**
  (present in the LiteAPI response) is dropped. A full amenities grid needs a new
  passthrough field (e.g. `allFacilities?: string[]`).
- `summary` is **truncated to 300 chars** (`:482`) — a full description needs an
  untruncated passthrough (e.g. `description?: string`).

## 3. REVIEWS — the key question

- **Aggregate (have it now, no call):** `reviewScore` (0-10) + `reviewCount` are
  already on `rec` from the hotel-data/rates response. The detail page can render
  a Booking.com-style score badge + count **today, zero new calls**.
- **Individual written reviews:** require a **separate LiteAPI endpoint —
  CONFIRMED** via docs: **`GET https://api.liteapi.travel/v3.0/data/reviews`**
  (https://docs.liteapi.travel/reference/get_data-reviews). Params: `hotelId`
  (required), `limit` (default 200, max 5000), `offset` (default 0), `timeout`,
  `getSentiment` (AI sentiment of last 1000 reviews), `language` (ISO-639-1, AI
  translation). Returns individual review text + ratings + dates + detailed
  guest comments. (The docs page confirms the endpoint + params; exact per-review
  field names — author/headline/pros/cons — should be read off a live response
  when building PR-23.)
- **Do we call it today? NO** — grep for `reviews` across `src/lib`/`src/app`
  finds **no reviews endpoint, route, or client**. It would be net-new: a new
  client fn in `liteapiClient.ts` (`getHotelReviews(hotelId)`), a new API route
  (`/api/travel/liteapi/reviews`), and a client fetch/render on the detail page
  (it's a server component, so reviews would load via a client child or a server
  fetch keyed on `rec.liteapiHotelId`).

**Recommendation (flag for Alex):** ship **aggregate reviews now** (real,
already-present `reviewScore`/`reviewCount`) in PR-22, and treat **individual
written reviews as a fast-follow (PR-23)** behind the verified `/data/reviews`
call. Rationale: the real-data mandate is satisfied by the aggregate immediately;
individual reviews shouldn't block the gallery/amenities/map page on an unbuilt,
docs-unverified endpoint. **Alex decides:** aggregate-only PR-22, or fold the new
reviews call into PR-22.

## 4. Photo gallery

Today: a single hero (`rec.photoUrl`, `page.tsx:117-119`). `images[]` is the full
array (mapper `:437`). The detail page has the width the card lacked.
**Proposal:** an Airbnb-style **hero + thumbnail strip** (click a thumb to swap
the hero), with an optional lightbox. Since the page is a server component and a
gallery needs interactivity, add a small **client** `HotelGallery` component
(`'use client'`) taking `images: string[]`. (A pure CSS grid hero+4 is the
no-JS fallback.) **Taste call:** hero+thumbs vs full grid.

## 5. Amenities

`facilities` on `rec` is filtered to the 6 standard (mapper `:438`). For the
detail page we want the **full list** — which **is** available in the response
(`h.hotelFacilities[]`) but currently dropped. **Proposal:** add an optional
`allFacilities?: string[]` to the mapper output (pass `h.hotelFacilities`
verbatim) + the two `Recommendation`/`HotelRecommendation` interfaces, and render
an **amenities grid** with `lucide-react` icons for known ones + plain text for
the rest. This is a **small mapper precursor** that belongs in PR-22.

## 6. Address / Map

`latitude`/`longitude` are on `rec` (from PR-13 mapper). **Leaflet is already in
the project** — `leaflet ^1.9.4` + `react-leaflet ^5.0.0` + `@types/leaflet`
(package.json), used by `src/components/trips/DestinationMap.tsx` and
`TripMap.tsx` via **dynamic `import('react-leaflet')`/`import('leaflet')`** (SSR-
safe) with CARTO/OSM tiles. **Proposal:** reuse Leaflet — a small **client** map
component centered on `[latitude, longitude]` with a single marker (CARTO/OSM
tiles, matching the itinerary map). **No new dep.** Render `addressLine` + `city`
above it. (Static-image alternative exists, but interactive Leaflet is the house
style.) **Taste call:** interactive vs static.

## 7. Description

`summary` is the description truncated to 300 (mapper `:482`); the full
`h.hotelDescription` is in the response. **Proposal:** add `description?: string`
(full, HTML-stripped, untruncated) to the mapper + interfaces and render it in a
"About this property" section on the detail page (keep `summary` for the card).
Small mapper change, same precursor as full facilities (§5).

## 8. Proposed layout (institutional)

```
[ Back ]
┌─ Gallery (hero + thumbnails) ──────────────┐   ← images[] (client HotelGallery)
├─ Name  ·  chain pill                        │   ← rec.name, rec.chain
│  ★ stars · reviewScore badge (N reviews)    │   ← googleRating, reviewScore, reviewCount
│  addressLine, city                          │   ← rec.addressLine/city
├─ Map (Leaflet marker at lat/lng)            │   ← lat/lng (client map, reuse Leaflet)
├─ Amenities grid (full, lucide icons)        │   ← allFacilities[] (new passthrough)
├─ Reviews — aggregate score + count          │   ← reviewScore/reviewCount (now)
│            [individual reviews — PR-23]      │   ← /data/reviews (deferred)
├─ About this property (full description)      │   ← description (new passthrough)
└─ Sticky price card + Reserve (unchanged)     │   ← perNight·nights·total, ReserveHotelButton
```
Palette: `brand-purple`/`brand-gold`/`ts-aqua` (tailwind.config); icons
`lucide-react`. The Reserve block + `nightly={stayTotal}` charge path stays
**byte-identical** (PR-15 protection).

## 9. Scope

| Item | Detail |
|---|---|
| Files | `discover/[category]/[rank]/page.tsx` (big render expansion); **new** `HotelGallery.tsx` (client); **new** map component (client, reuse Leaflet) or adapt `DestinationMap`; `liteapiClient.ts` (+`allFacilities`, +`description` passthrough); the two rec interfaces (detail page + `HotelRecommendation`). |
| New LiteAPI call | **PR-22: NO** (aggregate reviews only). **PR-23 (optional): YES** — `GET /data/reviews` for individual reviews. |
| New deps | **NONE** — Leaflet + lucide already present. |
| Schema / migration | **NONE** — display only; `rec` is stored JSON. |
| Line estimate | ~**250-350** (detail page ~150-250 + gallery ~60 + map ~50 + mapper +~8 + interfaces +~4). |
| Quality | `tsc` + `eslint` clean. |

### Taste vs mechanical
- **Mechanical (safe):** render existing `images[]`/`reviewScore`/`chain`/`city`/
  `lat-lng`; mapper passthrough of full `hotelFacilities` + full `description`;
  reuse Leaflet + lucide; aggregate reviews; keep Reserve untouched.
- **Taste calls (Alex sign-off):**
  1. **Individual reviews endpoint y/n** — the one real new-call decision
     (recommend defer to PR-23, verify docs first).
  2. **Map** interactive (Leaflet) vs static image.
  3. **Gallery** hero+thumbnails vs grid (+ lightbox y/n).
  4. Layout ordering / sticky-vs-inline price.

---

## VERDICT
Most of an institutional detail page can ship **now with zero new API calls** —
the gallery, full amenities, map, aggregate reviews, chain, and full description
are all derivable from data already in (or trivially passed through) the existing
LiteAPI response. The **only** genuine new-call decision is **individual written
reviews** (`/data/reviews`) — recommend PR-22 ships everything-but-individual-
reviews (aggregate now), and Alex decides whether individual reviews join PR-22
or land as PR-23 after confirming the endpoint. No new deps, no schema.

---

**READ-ONLY audit. No implementation performed.**
