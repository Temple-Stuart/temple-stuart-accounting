# Travel Scan-Pipe + Booking Audit (READ-ONLY)

Mapping the current Travel data/scan pipe before swapping sources. Read-only; every
claim cited file:line. **Branch:** `claude/travel-scan-pipe-audit`.

> **Premise correction up front:** the task brief says the scan is "Google Places +
> **ChatGPT** chained." It is actually **Google Places + Grok (xAI)** — provider is
> xAI, model `grok-4-1-fast`, endpoint `https://api.x.ai/v1/responses`, key
> `XAI_API_KEY` (`src/lib/grokAgent.ts:130,208,215`). **No OpenAI/Anthropic anywhere
> in the scan path.** Everything below treats the AI as Grok.

---

## 1. THE SCAN / "ANALYZE DESTINATION" PIPE (the thing to replace)

### Trigger → endpoint
- Button **"Analyze {city} with AI"** — `src/components/trips/TripPlannerAI.tsx:979-980`,
  handler `analyzeDestination()` (`:395-472`).
- It loops over each active COA category and POSTs **per category** to
  `/api/trips/[id]/ai-assistant` with `{ city, country, activities, activity, month,
  year, daysTravel, minRating, minReviews, maxPriceLevel, category, profile,
  maxResults }` (`TripPlannerAI.tsx` fetch in `analyzeDestination`).
- Route entry: `src/app/api/trips/[id]/ai-assistant/route.ts:132` (POST).

### Branch logic inside the route (important — two paths)
`ai-assistant/route.ts`:
1. **Viator path** (`:244-299`): if `isViatorCategory(category) && VIATOR_API_KEY`,
   it **skips Google Places AND Grok entirely** — calls `searchViatorProducts(...)`,
   maps via `viatorProductToRecommendation(...)`, and `upsert`s into
   `trip_scanner_results` (`:268`). Falls through to Google on 0 results/error
   (`:251,298`).
2. **Google Places + Grok path** (`:302+`, the default for accommodation/dining and
   Viator fallback): `searchPlacesMultiQuery(...)` (`:392`) → website enrichment →
   `analyzeWithLiveSearch(...)` (Grok) → composite score → `upsert` into
   `trip_scanner_results` (`:493`).

### GOOGLE PLACES — every call site (6 total)
| # | Type | Where | Request / fields | Consumed by |
|---|------|-------|------------------|-------------|
| 1 | Geocode + **Text Search** (paged, ≤60) | `src/lib/placesSearch.ts:52-72` | `geocode/json` then `place/textsearch/json` (query, location, radius=20000, type); extracts `name, formatted_address, place_id, rating, user_ratings_total, price_level, business_status, photos[].photo_reference` | `searchPlacesMultiQuery()` (`:275-305`) ← route `:392` |
| 2 | **Place Details** (website enrich) | `placesSearch.ts:120-136` | `place/details/json?fields=website,price_level` | `enrichPlaceDetails()` (`:109-127`) |
| 3 | **Place Details** (batch in route) | `ai-assistant/route.ts:117` | `place/details/json?fields=website` (top 60) | feeds Grok input (`:452-469`) |
| 4 | **Cache read** (Prisma, stores Google data) | `src/lib/placesCache.ts:22-62` | cached `placeId,name,address,rating,reviewCount,priceLevel,website,types,photos,lat,lng`; photo URLs rebuilt via `place/photo?photo_reference=`; 30-day TTL `isCacheFresh()` (`:136-162`) | route `:386` (cache-before-Google) |
| 5 | **Photo** (destination hero) | `src/app/api/places/photo/route.ts:22-32` | `textsearch/json` → `place/photo?maxwidth=800` | frontend `/api/places/photo?destination=` |
| 6 | **Place Details** (commit verify) | `src/app/api/trips/[id]/commit/route.ts:136` | photo/details reconstruction on finalize | trip commit flow |

**Google's role is SHALLOW** — it only populates the raw place list (name, address,
rating, reviewCount, priceLevel, photo, website). That is exactly the field set
Foursquare must supply.

### GROK — role + prompt + output (it is NOT removed when Google goes)
- File `src/lib/grokAgent.ts`; `analyzeWithLiveSearch()` (`:117-327`); model
  `grok-4-1-fast` (`:215`) via `api.x.ai/v1/responses` (`:208`), Agent Tools
  (`web_search`, `x_search`).
- **Role:** takes Google's place list as INPUT, then (a) interprets the traveler
  profile, (b) runs live X/web searches for sentiment, (c) ranks/describes/warns.
  Prompt at `grokAgent.ts:152-201`; returns JSON per place: `index, sentimentScore,
  sentiment, summary, warnings, trending, fitScore, valueRank, xEvidence` and merges
  with the place data + `citations` (`:292-316`).
- Composite score computed server-side: **40% mandate fit + 35% quality (rating ×
  log reviews) + 25% budget fit** (`ai-assistant/route.ts:476-482`).
- **CRITICAL ANSWER:** Grok is **independent of Google** — it only needs a list of
  `{name, address, rating, reviewCount, priceLevel, website, photoUrl}`. When Google
  → Foursquare, **Grok's role STAYS unchanged**; only the list provider swaps. (The
  Viator path already proves this: it feeds non-Google data into the same results
  shape.)

### OUTPUT SHAPE + consumers (what the replacement must match)
- Model `trip_scanner_results` — `prisma/schema.prisma:1721-1738`:
  `tripId, destination, category, recommendations Json, scannedBy, minRating,
  minReviews, profileSnapshot Json?`, unique `[tripId, destination, category]`.
- `recommendations` JSON per item (`grokAgent.ts:296-316`): `name, address, website,
  photoUrl, priceLevel, priceLevelDisplay, googleRating, reviewCount, sentimentScore,
  sentiment, summary, warnings[], trending, fitScore, valueRank, category, xEvidence,
  citations[], compositeScore`.
- **Consumers:** (1) display in `TripPlannerAI.tsx:298-337,807-876`; (2) selecting a
  rec creates a vendor option (`confirmSelection()/handleCommitCard()`
  `TripPlannerAI.tsx:485-691`), AI scores stashed in `notes`; (3) GET/DELETE
  `src/app/api/trips/[id]/scanner-results/route.ts:7-76`.
- **Replacement contract:** any new source must yield rows that fill this
  `recommendations` shape. The Google-named field `googleRating` is the only
  source-branded key — Foursquare maps to it directly (it's just "rating").

---

## 2. DUFFEL (flights — flip to production)
- `src/lib/duffel.ts:1` — URL **hardcoded** `https://api.duffel.com` (already the
  prod/live host; sandbox uses the *same* host, mode is token-driven).
- `duffel.ts:2` — `DUFFEL_TOKEN = process.env.DUFFEL_API_TOKEN`. **No `DUFFEL_MODE`
  / sandbox flag, no conditional** — Duffel decides test vs live purely by the
  **token prefix** (`duffel_test_…` vs `duffel_live_…`). The token is passed as-is in
  the `Bearer` header (`duffel.ts:9`).
- **Exact change to go production:** set `DUFFEL_API_TOKEN` to a `duffel_live_…`
  token. **Zero code changes.** `.env.example:54` already shows the `"duffel_live_…"`
  placeholder; real value lives in `.env.local` (not in repo) — that's where a stray
  `duffel_test_…` token would be. (Confirms the research note: the 2–3× "Duffel
  Airways" fares were sandbox fakes.)
- **Wiring:** Duffel is used for SEARCH and is **budget-wired** (not display-only):
  `flights/search/route.ts:37-60` → `flights/book/route.ts` → committed via
  `vendor-commit` `optionType:'flight'` → `budget_line_items` (COA **9100**) +
  `trip_itinerary` + `calendar_events` (`vendor-commit/route.ts:100-227`). Manual
  flights use the same commit (`FlightPicker.tsx:233-260`).

---

## 3. HOTELS (the Hotellook gap)
- **No live hotel API exists.** `HotelPicker.tsx:65-71` hard-returns *"Hotel search is
  not available. Use manual entry below."* Amadeus/Hotellook were **removed** —
  remaining references are dead UI strings/comments only
  (`HotelPicker.tsx:210,257`, `ItineraryComparison.tsx:33` "Flight data not available
  after Amadeus removal", `TransferPicker.tsx:80`).
- Lodging today is **manual-entry** into `trip_lodging_options`
  (`prisma/schema.prisma:1627-1649`: `url, title, image_url, location,
  price_per_night, total_price, taxes_estimate, per_person, notes`).
- **Therefore Makcorps/Amadeus = FROM-SCRATCH add**, not a swap. It should populate
  `trip_lodging_options` (and/or the scanner `recommendations` shape) so the existing
  commit spine consumes it unchanged.

---

## 4. THE COMMIT→BUDGET SPINE (must be preserved — and it's safe)
- `src/app/api/trips/[id]/vendor-commit/route.ts:87` reads `{ optionType, optionId,
  startDate, endDate, startTime, endTime, arriveDate, notes, amount, location }`.
- **Source-agnostic — confirmed.** No `place_id`/`placeId`/google fields. It loads the
  option from DB by `optionId` (`:102`) and reads generic `title`/`amount`. Flights
  are the one special case (no option table → accepts direct `amount`, `:100-102`).
- Writes: `budget_line_items` (`:145-156`: `userId, tripId, coaCode, year, month,
  amount, description, source:'trip'`), `trip_itinerary` (`:158-209`: `day, homeDate,
  homeTime, destDate, destTime, category, vendor, cost, note, location,
  vendorOptionId, vendorOptionType`), `calendar_events` (`:224-227`, raw SQL,
  `source:'trip'`).
- **Conclusion:** Foursquare/Makcorps data commits cleanly **as long as it lands in
  the vendor-option tables first** (the spine keys off `optionId`, not the source).

---

## 5. VIATOR / EXISTING AFFILIATE CODE
- `src/lib/viatorClient.ts` (529 lines): live Viator V1/V2 search, normalizes to
  `ViatorProduct` (`productCode, title, price, rating, reviewCount, productUrl`),
  builds affiliate URLs with partner **`P00294427`** (`:251-256`), maps COA →
  search terms (`:217-225`), converts to recommendation shape (`:426-512`).
- **Wired but scanner-only:** used in `ai-assistant/route.ts:244-299` for Viator
  categories; writes `trip_scanner_results`. **Not connected to vendor-commit** — a
  user picking a Viator rec goes through the same generic vendor-option flow as any
  other rec; the affiliate `productUrl` is not itself a commit path.
- `src/lib/travelCOA.ts`: per-category config carrying `vendorApi` + `optionType`
  (`:20-21`) that tells the scanner which API to use and what `optionType` to commit.
- **Other affiliates: NONE.** `travelpayouts`, `stay22`, `airalo`, `safetywing`,
  `discovercars` — zero matches in the repo. All net-new.

---

## KEEP / SWAP / ADD MAP

### KEEP (unchanged — the socket the new sources plug into)
- **Grok analysis layer** (`grokAgent.ts`) — source-independent; ranks any place list.
- **`trip_scanner_results` shape** + GET/DELETE routes + `TripPlannerAI` display.
- **Commit→budget spine** (`vendor-commit`) — source-agnostic (`optionId`-keyed) →
  `budget_line_items`/`trip_itinerary`/`calendar_events`.
- **Vendor-option tables** (`trip_lodging_options`, transfer/vehicle/activity).
- **Duffel search→commit** path and COA 9100 flight wiring.
- **travelCOA** category config (just point `vendorApi` at new providers).

### SWAP (Google Places → Foursquare — POI list provider only)
- Replace the **6 Google call sites** (§1): the list provider in
  `placesSearch.ts:52-136`, the website-enrich details (`ai-assistant:117`), the
  cache layer `placesCache.ts` (rebuild around Foursquare IDs/photos), and the hero
  photo `places/photo/route.ts`. Foursquare must emit `{name, address, rating,
  reviewCount, priceLevel, website, photoUrl}`; map `rating`→`googleRating` (or rename
  the key). **Grok, scanner shape, and commit untouched.** Net cost win (Foursquare
  ≪ Google Places SKUs).
- Flip **Duffel** test→live token (config-only, §2).

### ADD (net-new — nothing to swap)
- **Hotels: Makcorps/Amadeus** — from-scratch; build a client (Viator pattern), wire
  into the scanner/`trip_lodging_options` so the existing commit spine consumes it.
- **Booking/referral hub: Travelpayouts** + **Viator (expand)** + **Airalo /
  SafetyWing / DiscoverCars / Stay22** — all net-new; only Viator exists today
  (scanner-only, not commit). These are referral-URL layers, orthogonal to the
  budget spine.

### One-line risk notes
- `googleRating` is the only source-branded key in the output shape — rename or map.
- `placesCache` freshness/photo logic is Google-photo-reference-shaped; Foursquare
  photos are direct URLs → simpler, but cache code needs adjusting, not just the
  fetch.
- Viator path already bypasses Google+Grok and writes the same results shape — it's
  the working template for plugging any new POI/activity source in.
