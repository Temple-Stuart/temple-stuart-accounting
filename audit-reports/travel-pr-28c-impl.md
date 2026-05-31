# TRAVEL — PR-28c Implementation: `/data/hotel` enrichment on detail-view

**Branch:** `claude/travel-pr-28c`
**Date:** 2026-05-30
**Scope:** Enrich the ONE viewed hotel from the rich `/data/hotel` content
endpoint (full gallery, amenities, coords, guest-review aggregate, full
description). Detail-view only, never on scan. 2 files + report. 0 deps,
0 schema.

---

## STEP 1 — Live `/data/hotel` shape (confirmed from docs)

```json
{ "data": {
  "id": "lp3803c", "name": "…",
  "hotelDescription": "…HTML…", "hotelImportantInformation": "…",
  "hotelImages": [{ "url": "…", "urlHd": "…", "caption": "…", "order": 0, "defaultImage": true }],
  "hotelFacilities": ["WiFi available", "Free Parking"],
  "facilities": [{ "facilityId": 47, "name": "WiFi available" }],
  "address": "703 South Ocean Boulevard", "city": "Myrtle Beach", "country": "us",
  "location": { "latitude": 33.67902, "longitude": -78.89426 },
  "starRating": 2, "rating": 4.9, "reviewCount": 1599
} }
```
Top-level wrapper is `{ data: {object} }`. Notable vs `/hotels/rates`: coords are
**nested under `location`** (rates used flat `latitude`/`longitude`), and
`rating` is a **0-5** guest score (4.9) whereas the rec's `reviewScore` is 0-10.
The `HotelContent` interface (`liteapiClient.ts:766-782`) mirrors these exactly.

## STEP 2 — Client function (reuses auth/mode path)

`getHotelContent(hotelId)` — `liteapiClient.ts:786-810`:
- `GET ${LITEAPI_BASE}/data/hotel?hotelId=…` (`:797`), **same `headers()` →
  `getApiKey()` → X-API-Key** path as `searchHotelRates`/`getHotelReviews`.
- PR-20-style logging (`:792`, `:799`, `:806`): `[LiteAPI] hotel-content: mode=…
  keyPrefix=…` (4-char prefix only), `… http: status=… ok=…`, `… imagesLen=…
  (B-5100 COGS — paid call, per detail-view)`.
- **Fail-loud:** non-2xx → `throw new LiteApiError('/v3.0/data/hotel', …)`
  (`:803`); returns `json.data` (or `null`).

## STEP 3 — Enrich on detail-view (server-side, auth-gated)

`discover/[category]/[rank]/page.tsx:146-184` — runs inside the server component
already gated by `getVerifiedEmail()` (`:101-102`) + trip-ownership
(`trip … where userId`), so the paid call is **never public** and needs **no new
route**. Gated `source === 'liteapi' && rec.liteapiHotelId`.

**Merge (content ENRICHES; content wins for rich fields):** `rec = { ...rec,
images, facilitiesAll, latitude, longitude, reviewScore, reviewCount,
descriptionFull, … }` (`:159-173`):
- `images` ← `hotelImages.map(urlHd || url)` (full gallery; else keep rec's).
- `facilitiesAll` ← `hotelFacilities` (full list; else keep rec's).
- `latitude`/`longitude` ← `location.latitude/longitude` (else keep rec's).
- `reviewScore` ← `rating` normalised to 0-10 (`rating <= 5 ? rating*2 : rating`,
  `:163-165`) so the 0-10 aggregate badge reads correctly; `reviewCount` ←
  `content.reviewCount`.
- `descriptionFull` ← stripped `hotelDescription`.

**Content-call-fails → render existing rec** (`:180-182`): the `catch` logs and
leaves `rec` exactly as it came from `/hotels/rates` (already-real data).
**This is graceful degradation to real existing fields — not a fabricated
fallback** (nothing synthesized; we just render what rates already gave us, the
pre-PR-28c behavior).

## STEP 4 — Sections now populate

After enrichment, the existing detail-page sections receive data they previously
lacked for thin hotels:
- **Gallery** — `<HotelGallery images={rec.images …}>` now gets the full
  `hotelImages` set (hero + thumbnails).
- **Map** — gated `rec.latitude != null && rec.longitude != null`, now fed
  `location.latitude/longitude`.
- **Amenities** — `rec.facilitiesAll` (full `hotelFacilities`) → the amenities
  grid renders.
- **Aggregate reviews** — `rec.reviewScore` (0-10) + `rec.reviewCount` → the
  score badge + count render (PR-26 un-nested the section, so it shows whenever
  these are present).
- **About** — `rec.descriptionFull` (full untruncated description).

## STEP 5 — Cost (B-5100)

One `/data/hotel` call **per detail-view** — logged with the B-5100 marker
(`liteapiClient.ts:806`). **Never on scan:** confirmed the scan path
(`TripPlannerAI.tsx` + `ai-assistant/route.ts`) has **zero** `getHotelContent` /
`/data/hotel` references (grep). Per-call cost is logged, not yet ledgered
(matches the rates/reviews pattern; a unified LiteAPI COGS PR should ledger all
paid calls).

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Enrichment on detail-view ONLY; 0 `/data/hotel` on scan | ✅ grep: scan path has no `getHotelContent`/`data/hotel`; call only at detail `page.tsx:156` |
| Auth-first; rides inside existing gate, no new route | ✅ server component gated by `getVerifiedEmail`+ownership |
| Content-fail → existing rec (real), never fabricate | ✅ `catch` keeps rates-only `rec` (`:180-182`) |
| Pricing (PR-21) / charge (PR-15) / 28b filtering / card untouched | ✅ `ReserveHotelButton.tsx` + `TripPlannerAI.tsx` not in diff; pricing consts read rec (pricing fields not enriched) |
| 0 deps, 0 schema | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed files | ✅ `liteapiClient.ts` 0, detail page 0 (identical to main) |
| git diff = liteapiClient.ts + detail page (+ report) | ✅ |

---

## Result
Opening a hotel now enriches it via `/data/hotel` (one cheap, auth-gated, paid
call), so the gallery, map, amenities, aggregate-review badge, and description
populate even for hotels whose `/hotels/rates` metadata was thin — fixing the
empty detail-page sections. If the content call fails, the page renders the
rates-only data exactly as before. The scan page makes zero content calls.
