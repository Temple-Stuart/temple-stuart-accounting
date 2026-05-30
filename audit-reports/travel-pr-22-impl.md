# TRAVEL — PR-22 Implementation: Institutional Hotel Detail Page

**Branch:** `claude/travel-pr-22`
**Date:** 2026-05-30
**Scope:** Render PR-13 richness + 2 mapper passthroughs. Gallery, full
amenities, interactive map, full description, rich aggregate reviews. **No new
API call** (individual reviews = PR-23). Pricing (PR-21) + charge path (PR-15)
byte-unchanged. 0 new deps, 0 schema.

---

## STEP 1 — Mapper passthrough (full facilities + full description)

`src/lib/liteapiClient.ts`:
- Computed (`:488-491`): `facilitiesAll = h.hotelFacilities?.length ? h.hotelFacilities : undefined`
  and `descriptionFull = h.hotelDescription ? stripHtml || undefined : undefined`.
- Returned (`:556-557`): `facilitiesAll`, `descriptionFull`.
- Typed optional on `HotelRecommendation` (`:365`, `:368`) and on the detail
  page's `Recommendation` interface (`page.tsx:88-89`).

The card's fields are **untouched**: `facilities` (filtered 6, `:483`) and
`summary` (300-char, `:520`) are unchanged — the card keeps using them.

## STEP 2 — Photo gallery (client component)

**New `src/components/trips/HotelGallery.tsx`** — hero + clickable thumbnail
strip from `rec.images[]`; click a thumb → it becomes the hero. Mounted at
`page.tsx:173` (`<HotelGallery images={rec.images ?? []} fallback={rec.photoUrl} alt={rec.name} />`).
Per-image `alt`. **Images-empty case** (`HotelGallery.tsx:25-33`): renders the
hero from `fallback` (`rec.photoUrl`), and if that's also null, the existing
"No photo" placeholder — the **pre-PR-22 single-hero behavior**, not a
synthesized fallback. Real URLs only.

## STEP 3 — Amenities grid

`page.tsx:216-237` — renders `rec.facilitiesAll` as a lucide-icon grid;
`iconForFacility` (`page.tsx:24-46`, the `FACILITY_ICON_MAP`) reuses PR-14's six
icons + common LiteAPI facilities, with a generic `Star` for unmapped names.
**Falls to the filtered 6 `rec.facilities`** when `facilitiesAll` is absent
(`:219`, a render case) and renders nothing when both are empty.

## STEP 4 — Interactive map

**New `src/components/trips/HotelMap.tsx`** — reuses the itinerary's Leaflet
setup (`DestinationMap.tsx`): dynamic `import('react-leaflet')` / `import('leaflet')`
for SSR safety, CARTO light tiles, one marker at `[latitude, longitude]`. Mounted
at `page.tsx:210-213` **only when `rec.latitude != null && rec.longitude != null`**
— no broken embed when coords are absent. No new dep (Leaflet present).

## STEP 5 — Description

`page.tsx:265-271` — "About this property" renders `rec.descriptionFull`, falling
to `rec.summary` when the full text is absent.

## STEP 6 — Reviews (aggregate)

`page.tsx:238-263` — a Booking.com-style score badge (`rec.reviewScore`, 0-10,
brand-purple) + a qualitative label derived from the real score + `reviewCount`
("N reviews"). **No new API call** — real aggregate only. The **PR-23 seam** is
an explicit comment at `page.tsx:259-261` marking where individual written
reviews (LiteAPI `GET /v3.0/data/reviews?hotelId={rec.liteapiHotelId}`) will be
injected — deferred.

## STEP 7 — Layout + Reserve

Order (`page.tsx`): gallery (`:173`) → name + chain badge (`:182`) → quick facts
(rating) → address + map (`:204-214`) → amenities (`:216`) → aggregate reviews
(`:238`) → description (`:265`) → **pricing + Reserve (unchanged)**. Temple Stuart
palette (`brand-purple`/`brand-gold`/`brand-purple-wash`), lucide icons.

**Pricing + Reserve BYTE-UNCHANGED:** the PR-21 pricing block
(`page.tsx:276` `perNight != null && nights != null`) and `ReserveHotelButton`
(`:294`, `nightly={stayTotal}`) are not in the diff for those lines — proven
below.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| No new API call | ✅ aggregate reviews only; PR-23 seam is a comment (`page.tsx:259`) |
| Pricing (PR-21) + charge path (PR-15) byte-unchanged | ✅ diff grep for `ReserveHotelButton`/`nightly=`/`perNight != null`/`Total`/`stayTotal` returns **no `+`/`-` lines** |
| `ReserveHotelButton.tsx` = 0 diff | ✅ not in `git diff --name-only main` |
| Card (TripPlannerAI) unchanged — keeps 6 facilities + 300 summary | ✅ not in diff; mapper `facilities`/`summary` untouched |
| Real data only (empty → render-nothing / existing hero) | ✅ gallery→hero, map gated on lat/lng, amenities/reviews/desc gated on presence; nothing fabricated |
| 0 new deps | ✅ Leaflet + lucide already present |
| 0 schema | ✅ display + 2 optional rec fields (JSON column) |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed/new files | ✅ HotelGallery + HotelMap 0/0 (HotelMap has a justified file-level `no-explicit-any` disable mirroring DestinationMap's react-leaflet pattern); detail page 0 errors (same as main) |

**git diff scope:** `liteapiClient.ts` (mapper passthrough) + the detail page +
new `HotelGallery.tsx` + `HotelMap.tsx` + this report. Nothing else.

---

## Result
Clicking a hotel card opens a Booking.com/Airbnb-class page: swipeable photo
gallery, chain badge, address + interactive Leaflet map, full amenities grid,
a guest-review score badge, the full description, and the unchanged reconciled
price + Reserve. Individual written reviews are wired as a PR-23 seam (no new
call here).
