# PUBLIC-HOTEL-SEARCH-AUDIT

**Goal:** scope a PUBLIC live HOTEL search (LiteAPI) with real images + auth-gated
booking — same shape as the now-live flight search. Read-only audit. Every claim
cites `file:line` against `main` @ `7df78c19`. Status: EXISTS · MISSING · REUSABLE ·
RISKS · RECOMMENDATION.

---

## 0. ORIENT — what's on main now

- **Live flight search mounted, full-width:** `ModuleLauncher.tsx:6` imports
  `PublicFlightSearch`; `:163` renders it `{m.key === 'travel' && <PublicFlightSearch
  onRequireAuth={onRequireAuth} />}` inside the full-width `max-w-7xl … space-y-6`
  row (`:159`), ABOVE the card (PR-5L). Banner stays in the card.
- **Guard pattern to reuse** (`flights/search/route.ts`): imports `rateLimit` +
  `reserveTravelSearch` (`:3-4`); `rateLimit('flight-search:'+ip, …)` (`:27`) →
  `reserveTravelSearch('duffel')` (`:49`) → provider call; **no `getVerifiedEmail`
  gate** (grep → none). 429 on rate-limit, 503 on cap, booking stays gated.

---

## 1. WHERE HOTEL SEARCH LIVES TODAY

- **NO standalone hotel-search route.** `src/app/api/travel/liteapi/` contains only
  `book/route.ts` and `prebook/route.ts` (booking) — no search route. (`api/trips/[id]/
  lodging` is manual lodging options, not a LiteAPI search.)
- **The search lives in the lib** and is reached only through tier-gated surfaces:
  `searchHotelRates` (`liteapiClient.ts:201`) is called from
  `api/trips/[id]/ai-assistant/route.ts` (the AI scan, `requireTier('tripAI')`) and
  `budgets/trips/[id]/discover/[category]/[rank]/page.tsx`. So a public search route
  is **net-new** — there's no authed standalone route to merely un-gate.
- **The search function:**
  - `searchHotelRates(params: SearchHotelsParams): Promise<LiteApiHotelRate[]>`
    (`liteapiClient.ts:201`).
  - `SearchHotelsParams` (`:121-144`): `city`, `country`, `checkin`, `checkout`
    (ISO `YYYY-MM-DD`), `occupancies[]` (`adults` + `children` ages, `:116-119`),
    optional `currency`, `guestNationality`, `maxResults`, and `latitude`/`longitude`/
    `radiusMeters` (coordinate search — preferred over fuzzy city-name matching,
    `:135-143`).
  - **Returns IMAGES + name + price + rating.** Raw `LiteApiHotelRate` carries
    `main_photo` (`:158`), `thumbnail` (`:159`), `hotelImages[]` (`:163`, `{url,
    caption, order, defaultImage}`). A mapper (`:478-534`) produces the rich UI type
    **`HotelRecommendation`** (`:328`): `name` (`:329`), `photoUrl` (`:332`),
    `images?: string[]` (`:366`, full gallery from `h.hotelImages.map(url)` `:505`),
    `googleRating`/`reviewScore` (`:335/362`), `price`/`priceTotal`/`pricePerNight`
    (`:352/372/383`), `facilities` (`:368`), plus the booking handles `liteapiHotelId`
    (`:347`) + `liteapiOfferId` (`:350`, for `/rates/prebook`).

---

## 2. WHAT A PUBLIC HOTEL SEARCH ROUTE NEEDS

- **Net-new route** (no authed one to adapt; search is embedded in the AI scan).
  Mirror `flights/search`: a standalone `GET`/`POST` `api/travel/hotels/search` that
  calls `searchHotelRates(...)` + the mapper, guarded by
  `rateLimit('hotel-search:'+ip)` then `reserveTravelSearch('liteapi')`, with **no
  auth gate**; map `RateLimitError`→429, `TravelSearchQuotaError`→503.
- **Params it takes** (from `SearchHotelsParams` `:121-144`): `city` + `country`,
  `checkin`/`checkout` (ISO dates), `occupancies` (adults/children). Optional but
  recommended: `latitude`/`longitude`/`radiusMeters` for accuracy (the code prefers
  coordinate search over fuzzy city-name matching, `:135-143`). A guest form would
  collect destination + dates + guests; mapping a typed destination → city/country
  (and ideally coords) is the one new input concern (flights used unambiguous airport
  codes; city names are fuzzy — see RISKS).
- **Returns** the image-rich `HotelRecommendation[]` (name, `photoUrl`, `images[]`,
  price/per-night, rating, `liteapiHotelId`, `liteapiOfferId`).

---

## 3. COST MODEL

- **Undocumented in code** (same as Duffel — dashboard-confirm needed). `liteapiClient`
  runs **sandbox by default** (`LITEAPI_MODE`, `:13/36`; `LITEAPI_SANDBOX_KEY` `:43`),
  production via `LITEAPI_PRODUCTION_KEY`. No per-call price on `/hotels/rates`. The
  prior travel audit found the **detail** calls (`/v3.0/data/reviews`, `/v3.0/data/
  hotel`) marked PAID — but SEARCH (`rates`/`hotels`) cost is unstated.
- **The cap covers us regardless.** Use provider key **`'liteapi'`** for
  `reserveTravelSearch('liteapi')` and an env cap `TRAVEL_SEARCH_DAILY_CAP_LITEAPI`
  (the PR-1 util already supports per-provider caps). Sandbox is free, so shipping
  on sandbox is zero-cost; flipping to production needs the dashboard price check.

---

## 4. BOOKING STAYS GATED (re-confirmed)

- LiteAPI **prebook** — `getVerifiedEmail()` → 401, `travel/liteapi/prebook/route.ts:15-17`.
- LiteAPI **book** — `getVerifiedEmail()` → 401, `travel/liteapi/book/route.ts:39-41`.
- The public part is **SEARCH only**; these booking routes are untouched and stay gated.

---

## 5. THE UI — the one real gap (images)

- **`HotelPicker` does NOT render images.** Its `HotelOption` (`HotelPicker.tsx:5-18`)
  has `hotelId, name, rating, cityName, totalPrice, currency, perNight,
  perPersonPerNight, nights, roomDescription, bedType, beds` — **no photo field**, and
  the component never renders an `<img>`. So unlike flights (where `PublicFlightSearch`
  reused `FlightPickerView` wholesale), HotelPicker can't show "real images" as-is.
- **The image-rich shape already exists** — `HotelRecommendation` (`liteapiClient.ts:328`,
  `photoUrl`/`images[]`) — but it's consumed by **TripPlannerAI**'s PR-14 hotel cards,
  and TripPlannerAI is the **caged context subsystem** (see
  TRIPPLANNERAI-DECOMP-PLAN.md) — not cleanly reusable.
- **So the public hotel UI needs a small new image-capable view**, two options:
  - **(A)** a NEW pure `HotelResultsView` (props-only) that renders the rich shape
    (photo + name + price/per-night + rating + a "Book" callback). Cleanest for "real
    images" since the data already carries them. **← recommended.**
  - **(B)** extend `HotelPicker`'s `HotelOption` with an image field + render a
    thumbnail. Smaller, but `HotelPicker`'s card is text-only today and would need
    image markup anyway.
- **Container reuse**: `PublicHotelSearch` mirrors `PublicFlightSearch.tsx` — owns the
  destination/dates/guests form + the live fetch to the public hotel route, renders the
  results view, routes "Book"/"Add to trip" → `onRequireAuth`. Mounts full-width on the
  travel card, **stacked below `PublicFlightSearch`** (same `space-y-6` row in
  `ModuleLauncher.tsx:159-163`).

---

## 6. CACHE INTERACTION (sequencing)

- Hotel searches should increment the cap **only on cache-miss** once the PR-5 cache
  lands. **Hotels can ship before the cache** — the daily cap already bounds spend; the
  cache is a fast-follow that protects the bill + UX at volume.
- Caveat for the cache key: hotel rates are **date + occupancy + destination** specific
  (and coordinate-based), so the hotel cache key is richer than a simple location key —
  worth noting when PR-5 generalizes the cache. Either order works; I'd ship hotels
  first (cap-protected) and fold hotels into the cache when it lands.

---

## EXISTS | MISSING | REUSABLE | RISKS

- **EXISTS:** `searchHotelRates` + its mapper returning image-rich `HotelRecommendation`
  (name/photoUrl/images/price/rating/offerId); the guard utils (`rateLimit`,
  `reserveTravelSearch` with per-provider caps); booking routes (gated); the
  PublicFlightSearch + full-width mount pattern to copy; sandbox mode (free).
- **MISSING:** any standalone hotel-search route (net-new); an image-capable hotel
  results view (HotelPicker has no photo field); a `PublicHotelSearch` container; a
  destination→city/country(/coords) resolver for guest input; LiteAPI production search
  pricing confirmation.
- **REUSABLE:** `PublicFlightSearch.tsx` (container shape), `flights/search/route.ts`
  (guard wiring — swap `'duffel'`→`'liteapi'`, swap the provider call), the
  `HotelRecommendation` mapper (already produces images), the full-width
  `ModuleLauncher` row.
- **RISKS:**
  - **LiteAPI production search pricing unknown** — same gate as Duffel. Ship on
    **sandbox (free)** and/or behind a low `TRAVEL_SEARCH_DAILY_CAP_LITEAPI`; confirm
    on the dashboard before `LITEAPI_MODE=production`.
  - **City-name fuzziness** — `searchHotelRates` prefers coordinate search
    (`:135-143`); free-text city/country from a guest can mis-resolve. A
    destination resolver (coords) improves accuracy; v1 can use city+country text and
    accept some fuzziness.
  - **Images come from a different (richer) shape than HotelPicker** — don't try to
    bolt photos onto the slim `HotelOption`; build the small results view that consumes
    the rich shape.
  - Sandbox returns metadata-only properties with `liteapiOfferId: null` (`:348-350`) —
    the demo search will show hotels but some won't have a bookable rate; the "Book"
    button still routes to sign-up regardless, so it's safe.

---

## RECOMMENDATION — smallest atomic-PR chain (public hotel search + images, gated booking)

**Gate (no code):** confirm LiteAPI **production** `/hotels/rates` pricing on the
dashboard. Until then ship on **sandbox** (free) and/or `TRAVEL_SEARCH_DAILY_CAP_LITEAPI`
set low. The cap makes it safe to ship behind a low placeholder regardless.

1. **PR-H1 · net-new public hotel-search route.** `api/travel/hotels/search` (GET or
   POST), NO auth gate, guarded by `rateLimit('hotel-search:'+ip)` → 
   `reserveTravelSearch('liteapi')` → `searchHotelRates(...)` + the mapper. Returns the
   image-rich `HotelRecommendation[]`. Mirrors `flights/search` exactly (429/503).
   Booking routes untouched (stay gated).
2. **PR-H2 · pure `HotelResultsView`.** Props-only view rendering photo (`photoUrl`/
   `images[]`) + name + per-night/total price + rating + a `onBook` callback. (The data
   already carries images — this just renders them.)
3. **PR-H3 · `PublicHotelSearch` + mount.** Container (mirror `PublicFlightSearch`):
   destination + dates + guests form → live fetch to PR-H1 → `HotelResultsView`; "Book"/
   "Add to trip" → `onRequireAuth` (gated). Mount full-width, stacked **below** the
   flight search on the travel card.
4. **PR-5 (parallel/after) · search cache.** Fold hotels in (key = destination+dates+
   occupancy); increment the `'liteapi'` cap only on cache-miss.

**Net:** a public, free, image-rich **hotel** search reusing the flight-search guard
pattern (per-IP rate-limit + daily `'liteapi'` cap, fail-loud 429/503), booking +
paid-tier still auth-gated, and the only genuinely new UI is the small image-capable
results view (HotelPicker can't show photos today). Pricing confirmation is a
dashboard gate, not a code blocker — the cap bounds worst-case spend, and sandbox is
free.
