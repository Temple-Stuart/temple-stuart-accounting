# PUBLIC ACTIVITY SEARCH AUDIT (Viator)

**Scope:** map what it takes to ship a PUBLIC, guarded, image-rich **activity
search** (Viator) — same shape as the live flight + hotel search — with booking
(an external **affiliate URL**, not an API order) locked behind sign-in.
**Audit only. No source modified.** `Missing = MISSING`.

Branch: `claude/audit-public-activity-search` · main @ `90111f58`.

---

## 0. ORIENT — the proven pattern to reuse (the hotel chain, on main)

The hotel chain shipped exactly the template activities should copy:

- **Public route** — `src/app/api/travel/hotels/search/route.ts`: public `GET`, IP
  extract → `rateLimit('hotel-search:'+ip)` (`:32`) → param validation 400 (`:55`)
  → `reserveTravelSearch('liteapi')` (`:61`) → `searchHotelRates()` + mapper
  (`:66`,`:81`) → `{ results, count }` (`:83-85`). No auth gate.
- **Pure view** — `src/components/trips/HotelResultsView.tsx`: props-only grid
  (`results / loading / error / onBook`, `:47-52`), photo cards with placeholder
  fallback (`:80-92`), `onBook(hotel)` callback (`:204`). Zero fetch/context.
- **Container** — `src/components/trips/PublicHotelSearch.tsx`: a search form →
  `fetch('/api/travel/hotels/search?…')` (`:71`) → feeds the view; `book =
  () => onRequireAuth()` (`:87`) → `onBook={book}` (`:157`). Booking gated.
- **Mount** — `ModuleLauncher.tsx:185` renders `<PublicHotelSearch onRequireAuth>`
  full-width in the travel stack.

**Guards confirmed reusable for Viator:**
- `src/lib/rateLimit.ts` — `rateLimit(key, {limit,windowSeconds})`, durable per-IP
  fixed-window, throws `RateLimitError` → 429 + `Retry-After`. Key is arbitrary →
  `rateLimit('activity-search:'+ip)` works unchanged.
- `src/lib/travelSearchQuota.ts` — `reserveTravelSearch(provider)`, durable daily
  per-(date+provider) cap. **`'viator'` is already a valid provider:**
  `export type TravelProvider = 'duffel' | 'liteapi' | 'viator' | 'mozio'`
  (`travelSearchQuota.ts:19`). Cap env: `TRAVEL_SEARCH_DAILY_CAP_VIATOR` →
  `TRAVEL_SEARCH_DAILY_CAP` → default (`dailyCap()`, `:39-44`). **No schema/enum
  change needed.**

---

## 1. WHERE ACTIVITY SEARCH LIVES TODAY

### Provider lib — `src/lib/viatorClient.ts` (EXISTS, EXPORTED)

- **Search fn:** `export async function searchViatorProducts(city, country,
  coaCategory, userInterests, maxResults = 33, preResolvedDestId?)` (`:313-326`).
  Returns `Promise<ViatorProduct[]>`. **Destination-based, NOT date-based** — no
  check-in/out (unlike hotels/flights). Resolves a Viator `destId` from city
  (`findDestinationId`, `:334`/`:132`) then queries V2 `/products/search` or
  `/search/freetext`.
- **Return type `ViatorProduct`** (`:33-49`) — **IMAGES + all card fields present:**
  - `thumbnailUrl: string` (`:44`) — the photo URL ✅
  - `title: string` (`:34`), `description` (`:35`)
  - `price: number | null` + `priceFormatted` (`:38-39`), `onSale`/`originalPrice`
    (`:40-41`)
  - `rating: number` + `reviewCount: number` (`:42-43`)
  - `duration: string` ("3 hours") + `durationMinutes: number | null` (`:45-46`)
  - `productCode: string` (`:34`) + `productUrl` (affiliate, `:37`)
  - Image source proven in `normalizeV2Product` (`:172-176`): cover image →
    width-filtered variant → `thumbnailUrl` (`:194`).

### Entry points — buried in the tier-gated AI scan (like hotels were)

- **Only caller:** `src/app/api/trips/[id]/ai-assistant/route.ts:333` —
  `searchViatorProducts(city, country, category, tripActivities, viatorMax,
  preResolvedDestId)`, mapped via `viatorProductToRecommendation` (`:336`).
- That route is **gated twice + trip-scoped:** `getVerifiedEmail()` → 401
  (`:128-131`), `requireTier(user.tier, 'tripAI', …)` → tier wall (`:135-136`),
  under `/api/trips/[id]/…`. **So standalone activity search = MISSING** — same
  situation hotels were in before PR-H1.
- **No public/standalone Viator search route exists.** (`grep` of
  `searchViatorProducts` callers → only the ai-assistant route + the lib itself.)

### The mapper — EXPORTED & REUSABLE (not trapped)

- `export function viatorProductToRecommendation(product, category, budgetKey)`
  (`viatorClient.ts:467`) — **exported**, same as `liteApiHotelToRecommendation`
  was. Imported by `ai-assistant/route.ts:9`; **not** trapped in TripPlannerAI.
  Produces: `photoUrl` (`:534` ← `thumbnailUrl`), `name` (`:531`), `googleRating`
  (`:537`), `reviewCount` (`:538`), `price`/`priceLevelDisplay` (`:551`/`:536`),
  `durationMinutes` (`:550`), `bookingUrl` (affiliate, `:549`), `viatorProductCode`
  (`:548`), `summary`/`warnings` (`:541-542`).
- **Reuse verdict: REUSABLE as-is**, no extraction needed (HARD-STOP-equivalent
  cleared). A public route can call `searchViatorProducts` + the mapper directly,
  exactly like PR-H1 did with LiteAPI.

---

## 2. VIATOR BOOKING = AFFILIATE URL (the lock)

- **URL construction:** `buildAffiliateUrl(productCode)` (`viatorClient.ts:242-244`)
  → `https://www.viator.com/tours/${productCode}?pid=P00294427&mcid=42383&medium=api`
  (partner id `VIATOR_PARTNER_ID='P00294427'` `:239`, `VIATOR_MCID='42383'` `:240`).
  The mapper stamps it onto `bookingUrl` (`:549`) and `website` (`:533`).
- **NOT an API order** — there is no Viator "create booking" fetch anywhere; the
  "booking" is just an outbound `<a href>` to viator.com (affiliate model: Viator
  pays commission on completed bookings on their site).
- **Where it's rendered today (authed only):** the trip-scoped discover detail
  page `src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx` —
  `external.url` built from the affiliate URL (`:46`), rendered as
  `<a href={external.url} target="_blank" rel="noopener noreferrer">` (`:463-465`).
  That page is a server component gated by `getVerifiedEmail()` (`:112`) + trip
  ownership (`:187`,`:246`).
- **THE LOCK (the one thing to guard):** the public activity surface must
  **NEVER render the live affiliate `href`**. "Book" → `onRequireAuth` (open the
  login popup), identical to how `PublicHotelSearch.book` and
  `PublicFlightSearch.book` route to sign-up. The pure results view must therefore
  receive an `onBook` **callback** and must NOT emit an `<a href={bookingUrl}>`
  (a real anchor would let a logged-out guest click straight through to the
  partner URL and earn an unattributed/ungated affiliate click). Drop/ignore
  `bookingUrl` in the public view; keep only `productCode`/display fields.

### Per-call pricing — free, but fan-out is the real cost flag

- **No per-call billing in code.** Viator Partner API is affiliate (you earn on
  bookings; search is free). Documented limit is a **rate** cap: "150 requests
  per 10-second rolling window" (`viatorClient.ts:3`). → **Pricing = no
  dashboard $ surprise** for search.
- **FLAG — fan-out, not dollars:** one `searchViatorProducts(...)` call can issue
  **many** underlying Viator HTTP requests (paginated, per-term): the code notes
  "~60 calls per scan" for the multi-term path (`:362`) and a paginated loop for
  the `'activities'` bucket (`:373-389`). `reserveTravelSearch('viator')` counts
  **one logical search**, not the underlying N calls. → The public route should
  request a **single small page** (small `maxResults`, the `'activities'` unified
  bucket which hits `/products/search` directly, `:366-373`) so one reservation ≈
  ~1 Viator call and stays well inside the 150/10s window. The daily cap still
  bounds worst-case regardless.

---

## 3. WHAT A PUBLIC ACTIVITY SEARCH ROUTE NEEDS

**Net-new route — MISSING.** Mirror `api/travel/hotels/search` exactly:

- New file `src/app/api/travel/activities/search/route.ts` (dir is net-new;
  closest existing route to adapt = `api/travel/hotels/search/route.ts`).
- Public `GET`, no auth gate. On every path, BEFORE the Viator call:
  1. IP extract (same `x-forwarded-for → x-real-ip → 'unknown'` fallback).
  2. `rateLimit('activity-search:'+ip)` → `RateLimitError` → 429 + `Retry-After`.
  3. param validation → 400. **Params: `city`, `country` only** (no dates — Viator
     search is destination-based, `searchViatorProducts(city, country, …)`).
  4. `reserveTravelSearch('viator')` → `TravelSearchQuotaError` → 503.
  5. THEN `searchViatorProducts(city, country, 'activities', [], <small max>)`
     + `.map(p => viatorProductToRecommendation(p, 'activities', 'midrange'))`
     → return `{ results, count }`.
- **Integration nuance to handle in the route PR (not a blocker):**
  `searchViatorProducts` returns `[]` early when `buildSearchTerms` yields no
  terms (`:327-328`). For the `'activities'` bucket the terms come from
  `TRAVEL_COA['activities']?.label` fallback (`:230-233`); the route PR must
  confirm `'activities'` is a COA key that produces ≥1 term (else pass a category
  that does, or a seed term). Verify against `travelCOA.ts` during the route PR.

---

## 4. BOOKING / TIER STILL GATED (unchanged by this work)

- **Tier-gated AI scan stays gated:** `ai-assistant/route.ts` keeps
  `getVerifiedEmail` (`:128`) + `requireTier('tripAI')` (`:135`). The public route
  is additive; it does not touch this path.
- **Affiliate booking stays gated for guests:** the only place the live affiliate
  `href` renders is the authed discover page (`page.tsx:463`, behind
  `getVerifiedEmail` `:112`). The public surface routes "Book" → `onRequireAuth`
  and never emits the href → a guest cannot reach the partner URL from the public
  page. **SEARCH is the only public part.**

---

## 5. THE UI

- **Pure activity results view — MISSING.** No activity-specific results component
  exists (only `HotelResultsView` + the flight `FlightPickerView`). Build
  `ActivityResultsView` modeled on `HotelResultsView.tsx`:
  - Props: `results / loading / error / onBook(activity)` (same shape, `:47-52`).
  - Card: photo (`photoUrl`, with the same neutral placeholder + `onError`
    fallback `HotelResultsView.tsx:80-92` — **never a broken `<img>`**), title,
    rating pill, price ("From $X"), **duration** (the activity-specific field),
    and a **`Book` button → `onBook` callback** (NOT an `<a href={bookingUrl}>`).
  - Reuse the token vocabulary from `HotelResultsView` verbatim.
- **Container `PublicActivitySearch` — MISSING.** Mirror `PublicHotelSearch.tsx`:
  - Reuses: the form/fetch/error pattern, `book = () => onRequireAuth()` + `onBook`
    wiring (`:87`,`:157`), the full-width mount idiom.
  - Differs: **destination-only form** (city + country; no check-in/out, no
    guests) → `fetch('/api/travel/activities/search?city=…&country=…')`.
  - Mount full-width in `ModuleLauncher` travel stack **below** the hotel search
    (after `:185`), `{m.key === 'travel' && <PublicActivitySearch onRequireAuth/>}`.

---

## REPORT — EXISTS | MISSING | REUSABLE | RISKS | RECOMMENDATION

### EXISTS
- `searchViatorProducts` (exported, image-rich `ViatorProduct`) — `viatorClient.ts:313`.
- `viatorProductToRecommendation` (exported, reusable mapper → `photoUrl`,
  `bookingUrl`, rating, price, duration) — `viatorClient.ts:467`.
- Affiliate URL builder `buildAffiliateUrl` — `viatorClient.ts:242`.
- Guards `rateLimit` + `reserveTravelSearch('viator')` (`'viator'` already in the
  provider enum, `travelSearchQuota.ts:19`).
- The full hotel chain as a copy-paste template (route + pure view + container +
  mount).

### MISSING
- Public route `api/travel/activities/search` (net-new).
- Pure `ActivityResultsView` (image cards + duration + `onBook`).
- Container `PublicActivitySearch` (destination-only form).
- Mount in `ModuleLauncher`.

### REUSABLE (as-is, no extraction)
- The mapper + search fn (not trapped in TripPlannerAI — clean import, like PR-H1).
- Both guards. The hotel view's image-placeholder + onError fallback. The hotel
  container's `onBook → onRequireAuth` booking-lock idiom.

### RISKS
1. **Affiliate-href leak (the headline lock):** if the view renders
   `<a href={bookingUrl}>`, a logged-out guest clicks straight to viator.com,
   bypassing the sign-in gate. **Mitigation:** view takes `onBook` callback only;
   never emit the href; drop `bookingUrl` from the public payload (or ignore it).
2. **Fan-out under one reservation:** `searchViatorProducts` can issue many Viator
   HTTP calls per logical search (`:362`,`:373-389`); `reserveTravelSearch` counts
   one. **Mitigation:** public route uses the `'activities'` unified bucket +
   small `maxResults` (≈1 page) so one reservation ≈ one Viator call; the daily
   cap bounds worst-case either way.
3. **Empty-terms early return:** `searchViatorProducts` returns `[]` if
   `buildSearchTerms` is empty (`:327-328`). **Mitigation:** route PR verifies the
   `'activities'` COA key yields ≥1 term (check `travelCOA.ts`), else seed a term.
4. **`destId` miss for long-tail cities:** `findDestinationId` returns `null` and
   the search yields nothing (`:160-161`) — a graceful empty state, not an error;
   the view's empty state covers it.
5. **Pricing:** Viator search is free (affiliate; 150 req/10s rate limit only,
   `:3`). No per-call $ in code. **DASHBOARD-CONFIRM** the partner agreement has no
   metered search fee before raising the cap; the cap covers worst-case regardless.

### RECOMMENDATION — smallest atomic-PR chain (mirror the hotel chain)

1. **PR-A1 — public guarded activity search route.** Net-new
   `api/travel/activities/search/route.ts`: IP → `rateLimit('activity-search:'+ip)`
   → validate `city`/`country` (400) → `reserveTravelSearch('viator')` →
   `searchViatorProducts(city, country, 'activities', [], <small max>)` + mapper →
   `{ results, count }`. No auth gate. Booking/tier paths untouched. Single small
   page to keep one reservation ≈ one Viator call. *(Mirror of PR-H1.)*
2. **PR-A2 — pure `ActivityResultsView`.** Image cards: photo (placeholder +
   onError, no broken `<img>`), title, rating, "From $X", **duration**, `Book`
   button → `onBook` callback. **No `<a href={bookingUrl}>`.** Props-only, zero
   fetch. *(Mirror of PR-H2.)*
3. **PR-A3 — `PublicActivitySearch` container + mount.** Destination-only form →
   public route → feeds the view; `onBook → onRequireAuth` (booking locked).
   Mount full-width below the hotel search in `ModuleLauncher`. *(Mirror of PR-H3.)*
4. **PR-A-Layout (optional) — explainer + ordering** parity with the
   flight/hotel sections, once the three above merge.

**Sequencing note:** same as the hotel chain — PR-A2 must merge before PR-A3
imports it (PR-A3 depends on `ActivityResultsView`). Flag Viator search pricing as
**dashboard-confirm**; the daily cap (`TRAVEL_SEARCH_DAILY_CAP_VIATOR`) bounds the
worst case before any cap is raised.
