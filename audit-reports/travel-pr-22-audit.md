# TRAVEL — PR-22 Audit: Institutional-Grade Hotel Detail / Reserve Page

**Branch:** `claude/travel-pr-22-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Real data only — never fabricate a review/amenity/photo.
**Goal:** Map what's already available (PR-13) vs what needs a new LiteAPI call
(individual reviews), and propose a Booking.com/Airbnb-class detail page.

> **Docs caveat:** `docs.liteapi.travel` is behind a Cloudflare human-check from
> this environment — I could not load the reviews reference live. The reviews
> endpoint below is documented from LiteAPI v3 knowledge and **flagged for Alex
> to confirm** against the dashboard/docs before any new call is built. All
> codebase facts are verified from source.

---

## 1. Current detail-page anatomy

`src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx` (216 lines, an
async **server** component). Data load:
- `rec` from `trip_scanner_results.recommendations` JSON (`:72-81`); `source`
  derived `:83-85`; `destinationLabel = scan.destination` (`:92`); nights/
  perNight/stayTotal (`:93-96`); checkin/checkout from trip dates (`:97-98`).

Render (`:106-216`) — what it shows today and the fields it reads:
| Section | Lines | Reads |
|---|---|---|
| Single hero photo | `:115-125` | `rec.photoUrl` only (one image) |
| Name + category + source badge | `:127-136` | `rec.name`, `categoryLabel`, `destinationLabel` |
| Quick facts | `:138-147` | `rec.googleRating`, `rec.reviewCount`, `rec.priceLevelDisplay` |
| Address (one line) | `:149-152` | `rec.address` |
| Description | `:154-157` | `rec.summary` (the 300-char-truncated desc) |
| Pricing block | `:159-174` | `perNight`, `nights`, `stayTotal` (PR-21, reconciled) |
| Reserve / actions | `:176-209` | `ReserveHotelButton` (offerId, dates, `nightly={stayTotal}`) |
| Google note | `:211-216` | — |

**It ignores almost all of PR-13's richness** — no `images[]` gallery, no
`facilities[]`, no `reviewScore`, no `chain`, no `city`, no `latitude/longitude`.

## 2. Data already available on `rec` (PR-13/15) — present, just unrendered

The mapper (`liteapiClient.ts:471-end`) outputs, and the detail page's own
`Recommendation` interface (`page.tsx:16-51`) already types:
| Field | Mapper line | Detail page uses it? |
|---|---|---|
| `images: string[]` (FULL gallery) | `:437` (`h.hotelImages.map(url)`) | ❌ no |
| `facilities: string[]` (**filtered to 6**) | `:438` (`filterStandardFacilities`) | ❌ no |
| `reviewScore` (0-10) | `:498` (`h.reviewScore`) | ❌ no |
| `reviewCount` | mapper | ✅ (in quick facts) |
| `chain` | `:499` (`h.chain`) | ❌ no |
| `city` / `addressLine` | `:494-495` | ❌ (uses `rec.address`) |
| `latitude` / `longitude` | `:496-497` | ❌ no |
| `summary` (desc, **truncated 300**) | `:482` | ✅ (truncated) |
| `priceTotal`/`nights`/`pricePerNight`/`currency` | `:440,463-465` | ✅ (pricing) |

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
- **Individual written reviews:** require a **separate LiteAPI endpoint**.
  Per LiteAPI v3, that is **`GET /v3.0/data/reviews?hotelId={id}&limit={n}`**
  (docs: https://docs.liteapi.travel/reference/get_data-reviews — *Cloudflare-
  blocked from this env; Alex to confirm path/params*). Each review object
  typically carries `averageScore`, `country`, `type`, `name`, `date`,
  `headline`, `language`, `pros`, `cons`.
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

`latitude`/`longitude` are on `rec` (mapper `:496-497`). **Leaflet is already in
the project** — `leaflet ^1.9.4` + `react-leaflet ^1.9.4` (package.json), used by
`src/components/trips/DestinationMap.tsx` and `TripMap.tsx` with
`leaflet/dist/leaflet.css`. **Proposal:** reuse Leaflet — a small **client** map
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
