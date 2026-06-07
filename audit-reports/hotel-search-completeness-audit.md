# Hotel Search Completeness + Location Precision — Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-hotel-search-completeness`
**Scope:** Read-only. No application code modified. Only this report was created. No external LiteAPI calls made.
**Method:** Every claim cites `file:line`. Anything not read / not knowable from the codebase is marked **NOT VERIFIED**.

> **Bottom line:** For "Bali (Canggu), Indonesia" the code issues a **coordinate-radius** search
> centered on Canggu with a **25 km radius** and **no `limit`/`offset`/pagination**. Kuta (~13 km from
> Canggu) sits **inside** that radius, so Kuta hotels are legitimately requested. Two compounding
> losses then favor Kuta: (1) the client truncates to **50 hotels in LiteAPI's native response order
> BEFORE any ranking** (`liteapiClient.ts:312-313`), and (2) the route ranks the survivors by
> `rating × log(reviews)` (`liteapiClient.ts:525`), which favors high-review established Kuta
> properties over newer Canggu boutiques. The **mapper drops zero hotels** and **retains per-hotel
> lat/lng**, so the loss is the request breadth + the native-order truncation + the review-weighted
> sort — not a mapping filter.

---

## A. REQUEST FACTS — method, params, destination parsing

**Endpoint:** `POST /v3.0/hotels/rates` (`liteapiClient.ts:244-249`), base `https://api.liteapi.travel/v3.0` (`:22`).

**Method selection** (`liteapiClient.ts:208-236`): coordinate-radius **when** `latitude`+`longitude` are numbers (`:208`); otherwise `cityName` fallback (`:223-236`). **placeId search is not used anywhere** (grep `placeid` → only `getHotelReviews` limit/offset, no placeId).

**For "Bali (Canggu), Indonesia":**
- `city`/`country` are passed **separately**, not as one string: `city = selectedDest?.resort?.name || trip.destination` (= `"Bali (Canggu)"`), `country = selectedDest?.resort?.country` (= `"Indonesia"`) — `budgets/trips/[id]/page.tsx:1041-1042` → `TripScanProvider input`.
- The route resolves coords first: `const coords = findDestinationCoords(city, country)` (`ai-assistant/route.ts:265`). The static catalog has **`{ name: 'Bali (Canggu)', country: 'Indonesia', lat: -8.6478, lng: 115.1385 }`** (`src/lib/destinations.ts:69`), so `coords` is found → **coordinate-radius search is used** (cityName path is NOT taken for Canggu).
- Coords are passed as `latitude: coords.lat, longitude: coords.lng` (`ai-assistant/route.ts:272`); `searchHotelRates` sets `useCoords = true` (`liteapiClient.ts:208`).
- **City-name parsing (used only if coords were absent):** `extractCityName("Bali (Canggu)")` returns the parenthesised value → **`"Canggu"`** via regex `/\(([^)]+)\)/` (`liteapiClient.ts:109-112`).

**Exact request body sent (coord-radius branch, `liteapiClient.ts:210-222`):**
```
latitude:         coords.lat   (-8.6478)
longitude:        coords.lng   (115.1385)
radius:           params.radiusMeters ?? 25_000        // 25 km — default, never overridden (see below)
countryCode:      "ID"         (countryNameToIso2, :202)
checkin/checkout: search-window ISO dates
occupancies:      [{ adults }]                          // route :270, adults = participant count
currency:         "USD"        (default, :219)
guestNationality: "US"         (default, :220)
includeHotelData: true         (:221)
```
- **`radiusMeters` is never set by any caller** → always the **25 000 m default** (`SearchHotelsParams.radiusMeters?`, `:143`; default applied `:209`). The route call passes only `{ city, country, checkin, checkout, occupancies, maxResults, latitude, longitude }` (`ai-assistant/route.ts:268-273`) — **no radius**.
- **No `limit`, `offset`, `page`, price filter, rating filter, or star filter is sent to LiteAPI** (full body is the 10 fields above; grep `limit|offset|page` in `liteapiClient.ts` matches only `getHotelReviews` `:751-754`, a different endpoint).

---

## B. COMPLETENESS CHAIN — X → Y → Z → N (every loss point cited)

**X — what LiteAPI returns:** the single `/hotels/rates` response: rate items in `data.data[]`, metadata in `data.hotels[]` (`liteapiClient.ts:279-289`). **The code requests no pagination**, so X = whatever LiteAPI returns for one coord-radius(25 km) call. **The exact count is NOT VERIFIED** (LiteAPI server behavior; not in the codebase). It is observable at runtime — `console.log('[LiteAPI] rates raw: dataLen=… hotelsLen=…')` (`:264`).

**Pagination exhaustion:** **NONE.** There is no loop over `offset`/pages for `/hotels/rates`; a single `fetch` (`:245`) and a single response are processed. The only pagination in the file is on `getHotelReviews` (`:751-754`), unrelated to search. → **The client never fetches beyond LiteAPI's first/default response.**

**Y — what `searchHotelRates` keeps:** after merging rate+metadata (`:304-310`), it returns **`merged.slice(0, max)` where `max = params.maxResults || 33`** (`:312-313`).
- **LOSS POINT 1 (the ceiling, and it precedes ranking):** this slice keeps the **first `max` items in LiteAPI's native response order** — *before* any composite ranking. `max = 50` for accommodation (see Z). So if X > 50, hotels at native positions 51…X are discarded **before** the route ever scores them. If LiteAPI's native order front-loads Kuta, Canggu hotels past position 50 never reach ranking. → **Y = min(X, 50), in native order.**

**Mapper — what it drops:** `liteApiHotelToRecommendation` (`:466-576`) **unconditionally `return`s a recommendation object** (`:527-575`) for every hotel. There is **no early `return null`, no `filter`, no rating/price/image floor**. Hotels with no price (`price: stayTotal` may be null, `:556`), no rating (`googleRating` 0, `:510-511`), or no offer (`liteapiOfferId: null`, `:553`) are **still mapped, not dropped**. → **Mapper drops 0 hotels; mapped count = Y.**

**Z — what the route returns:** `hotels.map(...).sort((a,b) => b.compositeScore - a.compositeScore).slice(0, maxResults).map(valueRank)` (`ai-assistant/route.ts:275-279`).
- The **sort runs on the already-truncated Y (≤50)**, and `slice(0, maxResults=50)` is a no-op on ≤50 items. → **Z = Y.**
- **LOSS POINT 2 (ranking bias, not a drop):** `compositeScore = round(mandateFit×0.4 + quality×0.35 + 75×0.25)` where `quality = rating × log10(max(reviews,1))` (`liteapiClient.ts:520-525`). Review volume drives the score, so established high-review **Kuta** properties outrank newer low-review **Canggu** ones within the kept set — they occupy the top of the carousel even when both are present.
- Persisted to `trip_scanner_results` (`ai-assistant/route.ts:284-288`); response `{ category, recommendations: Z }` (`:293`).

**`maxResults` value:** the carousel sends `maxResults: key === 'accommodation' ? 50 : 33` (`TripPlannerAI.tsx:341`); the route default is `rawMaxResults || 33` (`ai-assistant/route.ts:190`). → **accommodation cap = 50.**

**N — what the UI renders:** the carousel renders Z and client-paginates ("load more", 12 at a time per the prior travel audit). → **N = Z, surfaced progressively; no further server filter.**

**End-to-end math:** `X (LiteAPI, unpaginated, unknown count) → slice→ Y = min(X,50) in NATIVE order → map (0 dropped) → sort by review-weighted composite → Z = Y → UI renders N = Z`. The two completeness levers are **radius breadth (25 km pulls in Kuta)** and **native-order truncation at 50 before ranking**; the visibility lever is the **review-weighted sort**.

---

## C. COORDINATES — availability at destination + hotel level

**(a) Destination-level — AVAILABLE.**
- Static catalog: `Bali (Canggu)` carries `lat: -8.6478, lng: 115.1385` (`destinations.ts:69`); `findDestinationCoords(cityName, country)` returns it (`destinations.ts:581`, called `ai-assistant/route.ts:265`). **This is why coord-radius search is already active for Canggu.**
- The trip map's pins come from the **resort join**: `DestinationMap` reads `d.resort?.latitude / d.resort?.longitude` (`DestinationMap.tsx:58,62-63`), fed `destinations={destinations}` on the trip page (`budgets/trips/[id]/page.tsx:784-785`).
- The `trip_destinations` table also has its own `latitude Decimal? @db.Decimal(10,7)` / `longitude` columns (`schema.prisma:704-705`), though the map reads the joined `resort` coords, not these.

**(b) Hotel-level — RETAINED (not dropped in mapping).**
- The mapper sets **`latitude: h.latitude, longitude: h.longitude`** on every recommendation (`liteapiClient.ts:561-562`), from LiteAPI's per-hotel metadata (`hotel.latitude/longitude`, typed at `:166-167`). The detail-page `Recommendation` type carries `latitude/longitude` and feeds them to `HotelMap` (`discover/[category]/[rank]/page.tsx:295`).
- → Both a coordinate-radius search **and** a per-hotel results map are **data-feasible today**; the coordinates exist at both levels. (Whether LiteAPI populates `latitude/longitude` on every hotel object is **NOT VERIFIED** — it's read defensively as optional.)

---

## D. MAP REUSE — existing component facts

- **`HotelMap.tsx`** — **single-marker** map. Props `{ latitude: number, longitude: number, label: string, height? }` (`:15-18,22`); renders one `<Marker position={[latitude, longitude]}>` (`:61,71`). Used on the discover detail page for **one** hotel (`discover/.../page.tsx:295`). Reuses the itinerary's Leaflet + CARTO setup (`HotelMap.tsx:4,8`). → Plots a single point; **not** a result set.
- **`DestinationMap.tsx`** — **multi-marker** map. Props `{ destinations, selectedName, onDestinationClick, height? }` (`:16-23`). It expects each item to carry **nested `resort` coords** (`d.resort?.latitude/longitude`, `:58,62-63`) and **filters out** any without coords (`:58`). It plots **trip destinations (resorts)**, not hotels, and its click handler is destination-selection (`onDestinationClick(resortId, name)`, trip page `:787`).
- **Reuse facts:** mapped hotels DO carry `latitude/longitude` (C-b), so plotting a hotel result set is data-feasible, but **neither existing component takes a "hotels[]" prop**. `HotelMap` is single-point; `DestinationMap` is shaped around `{ resort: { latitude, longitude, name }, resortId }` and destination-selection semantics — it is **itinerary/destination-specific**, not hotel-specific. Plotting hotels would require either a new multi-marker caller or adapting each hotel into the `DestinationMap` destination shape. **FACTS only — no recommendation here.**

---

## E. ALEX-SIDE CHECKS

- **`LITEAPI_MODE` (inventory breadth):** `getMode()` returns `'production'` **only** if `process.env.LITEAPI_MODE === 'production'`, else **`'sandbox'`** (`liteapiClient.ts:35-36`). **Sandbox uses a limited test inventory** that may not reflect production Canggu coverage. **Alex must verify the Vercel value of `LITEAPI_MODE`** and which key is set (`LITEAPI_PRODUCTION_KEY` vs `LITEAPI_SANDBOX_KEY`, read at `:42-43`). Every search logs `[LiteAPI] mode=… keyPrefix=…` (`:241`) — readable in Vercel logs.
- **Observe X (how many LiteAPI actually returned):** the per-search log `[LiteAPI] rates raw: dataLen=… hotelsLen=…` (`:264`) shows the upstream count **before** the `slice(0,50)`. If `dataLen` is consistently > 50 for Canggu, the native-order truncation (Loss Point 1) is actively cutting hotels; if `dataLen` ≤ 50, the issue is purely radius breadth + ranking. **Alex can read this from production logs** for the affected search.
- **No DB query needed** for this audit; the completeness chain is entirely in code + the LiteAPI response.

---

## F. SUGGESTIONS (not verified needs)

Auditor opinion only:

1. **Radius is the first lever:** 25 km from Canggu (`liteapiClient.ts:209`) reaches Kuta (~13 km). LiteAPI's documented minimum is 1 000 m; a tighter Canggu radius would exclude Kuta at the request level. The plumbing already supports a per-call `radiusMeters` (`SearchHotelsParams.radiusMeters`, `:143`) — no caller sets it today (`ai-assistant/route.ts:268-273`).
2. **Truncate AFTER ranking, not before:** the `merged.slice(0, max)` in `searchHotelRates` (`:312-313`) caps to 50 in LiteAPI's native order *before* the route's composite sort (`ai-assistant/route.ts:277`). Ranking the full response and slicing last would stop dropping lower-native-position Canggu hotels before they're scored.
3. **No pagination today:** if LiteAPI returns more than one page for a broad search, the single unpaginated `fetch` (`:245`) never sees page 2+. Whether that matters depends on X (see E).
4. **Ranking weights review volume:** `quality = rating × log10(reviews)` (`:523-525`) structurally favors established areas (Kuta) over newer ones (Canggu). A distance-aware or neighborhood-aware tiebreak would surface in-neighborhood results; the per-hotel lat/lng to compute distance is already retained (`:561-562`).
5. **A results map is data-feasible:** mapped hotels carry lat/lng (C-b); a multi-marker view would need a new caller (neither `HotelMap` nor `DestinationMap` takes a hotels array — D).
6. **Confirm `LITEAPI_MODE=production`** before attributing sparse Canggu results to code — sandbox inventory alone could explain much of it (E).

---

*End of audit. No application code was modified; only this report was created.*
