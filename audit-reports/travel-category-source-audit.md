# Travel Category → Source Wiring Audit (read-only)

Branch: `claude/travel-category-source-audit`. No code changes — investigation
and scope only. Every claim cited file:line.

---

## 1. Category definitions — the single source of truth

**`src/lib/travelCOA.ts:25-220`** — the `TRAVEL_COA: Record<string, COACategory>`
map. Every category the scan/UI/budget knows about is keyed here. The 17
categories:

| Key | Label | Today's data source | `vendorApi` | `optionType` |
|---|---|---|---|---|
| `flights` | Flights | **Duffel** (separate flow, not via scan) | `flights` | `flight` |
| `accommodation` | Accommodation | **Google** | `lodging` | `lodging` |
| `brunch_coffee` | Brunch & Coffee | **Google** | `activities` | `activity` |
| `dinner` | Dinner | **Google** | `activities` | `activity` |
| `business_meals` | Business Meals | **Google** | `activities` | `activity` |
| `sports_fitness` | Sports & Fitness | **Viator → Google fallback** | `activities` | `activity` |
| `arts_culture` | Arts & Culture | **Viator → Google fallback** | `activities` | `activity` |
| `nightlife` | Nightlife & Entertainment | **Viator → Google fallback** | `activities` | `activity` |
| `festivals` | Festivals & Events | **Viator → Google fallback** | `activities` | `activity` |
| `conferences` | Conferences & Summits | **Google** | `activities` | `activity` |
| `coworking` | Coworking | **Google** | `activities` | `activity` |
| `ground_transport` | Ground Transport | **Viator → Google fallback** | `vehicles` | `vehicle` |
| `wellness` | Wellness & Spa | **Viator → Google fallback** | `activities` | `activity` |
| `shopping` | Shopping & Supplies | **Google** | `activities` | `activity` |
| `bucket_list` | Bucket List | **Viator → Google fallback** | `activities` | `activity` |
| `communication` | Communication | **— excluded from scan** (`travelCOA.ts:274`) | `activities` | `activity` |
| `insurance_fees` | Insurance & Fees | **— excluded from scan** (`travelCOA.ts:274`) | `activities` | `activity` |

`getActiveScanCategories()` (`travelCOA.ts:267-282`) explicitly skips
`flights`, `communication`, `insurance_fees`, and `business_meals` (unless
tripType is business/mixed).

---

## 2. The current routing point — and the Viator template (cited)

**`src/app/api/trips/[id]/ai-assistant/route.ts:137-171`** is the *single
point* where per-category source routing happens today:

```ts
if (isViatorCategory(category) && process.env.VIATOR_API_KEY) {
  // Viator path — call searchViatorProducts, upsert, return
} else {
  // Google path — searchPlacesMultiQuery → enrichPlaceDetails → upsert
}
```

`isViatorCategory(category)` (`src/lib/viatorClient.ts:526-528`) checks
membership in `VIATOR_CATEGORIES` (`viatorClient.ts:516-524`):
```
['sports_fitness', 'arts_culture', 'nightlife', 'festivals', 'wellness',
 'bucket_list', 'ground_transport']
```

**Routing today is hardcoded to a two-way branch (Viator vs Google).** There
is no extensible router/registry; the rest of the pipe assumes Google. To
add LiteAPI/Mozio/Airalo/CoverGenius we either chain more `if` branches
here or refactor to a `SOURCE_BY_CATEGORY` map (recommended — see §4).

### How the Viator branch works end-to-end (the template)
1. Guard on category + env (`route.ts:137`).
2. `searchViatorProducts(city, country, category, tripActivities, maxResults)`
   (`viatorClient.ts:351-422`) — resolves Viator `destId` via
   `findDestinationId` (`:105-135`), runs V2 `/products/search` + V2
   `/search/freetext` + V1 `/search/products` fallback, dedupes by
   `productCode`, sorts by rating × log(reviewCount), slices to `maxResults`.
3. **Map each product → the canonical recommendation shape** via
   `viatorProductToRecommendation(product, category, 'midrange')`
   (`viatorClient.ts:426-512`). This is the **contract**: every provider's
   results must be mapped into this same shape.
4. Upsert into `trip_scanner_results` (`route.ts:157-161`) — exactly the
   same upsert call the Google path uses.
5. Return `{ category, recommendations: finalResults }`.
6. **Fall-through behaviour:** if Viator throws OR returns 0 items, the
   code continues past the `if`-block and runs the Google path (`:142-143`,
   `:168-170`). This is the silent-fallback the prior audit flagged — fine
   as a *deliberate* fallback per-category policy, but currently it means
   "0 Viator results → mask with Google data" which conflicts with the
   new locked architecture ("bookable categories show ONLY bookable
   inventory"). **The new architecture requires removing this fallback**
   for true-bookable categories — empty Viator should be empty, not
   masked.

---

## 3. The shape contract (cited) — what every provider must emit

### Persisted shape: `prisma/schema.prisma:1732-1748`
```
model trip_scanner_results {
  id              String @id ...
  tripId          String
  destination     String          // "City, Country"
  category        String          // TRAVEL_COA key
  recommendations Json             // ← the array of recommendation objects
  scannedBy       String
  minRating       Float @default(4.0)
  minReviews      Int @default(50)
  profileSnapshot Json?            // (kept nullable — currently unused)
  createdAt/updatedAt
  @@unique([tripId, destination, category])
}
```
The `recommendations` JSON is freeform — the contract lives in the mappers.

### Recommendation object shape — cited at `viatorClient.ts:426-512` (`viatorProductToRecommendation`)
Required (every source must produce):
```ts
{
  name: string;
  address: string;
  website: string | null;            // direct site OR booking link
  photoUrl: string | null;            // server-proxied (Google) or remote (Viator/LiteAPI)
  priceLevel: 1 | 2 | 3 | 4 | null;   // mapped from $ tiers (see Viator $25/$75/$200 thresholds)
  priceLevelDisplay: string | null;    // "$", "$$", "$$$", "$$$$" or raw "$45"
  googleRating: number;                // 0-5
  reviewCount: number;
  sentimentScore: number;              // 0-10, derived from rating (NOT AI)
  sentiment: 'positive' | 'neutral' | 'negative';  // derived from rating
  summary: string;                     // provider-supplied description (no AI)
  warnings: string[];
  trending: boolean;
  fitScore: number;                    // 0-10, derived from rating
  valueRank: number;                   // index-in-results
  category: string;                    // the COA key
  compositeScore: number;              // 0-100 quality score
}
```
Optional (booking-specific, signals "this is bookable"):
```ts
viatorProductCode?: string;       // generalize: bookingProvider + providerProductId
bookingUrl?: string | null;
durationMinutes?: number | null;
price?: number | null;            // absolute USD (vs $-level only)
```
The UI ("Bookable Experiences" client filter at
`src/app/budgets/trips/[id]/page.tsx:1057-1065`) already routes off
`VIATOR_CATS` membership of `r.category`, not off any per-record flag.
**Recommendation: replace the per-record source signal with explicit fields**
`source: 'google' | 'viator' | 'liteapi' | 'mozio' | 'airalo' | 'cover_genius'`
and a generic `providerProductId` so the UI can route on real metadata
instead of "is this category in VIATOR_CATS."

### Commit→budget spine — source-agnostic (cited)
**`src/app/api/trips/[id]/vendor-commit/route.ts:87`** reads body:
```
{ optionType, optionId, startDate, endDate, startTime, endTime, arriveDate, notes, amount, location }
```
`optionType` is constrained to **five** values (`route.ts:33`):
`'lodging' | 'transfer' | 'vehicle' | 'activity' | 'flight'`. Each maps to
its own option table (`trip_lodging_options`, `trip_transfer_options`,
`trip_vehicle_options`, `trip_activity_expenses`, flights via a separate
flow). `VENDOR_TYPE_TO_COA` (`route.ts:9-15`) maps optionType → COA 9xxx
code (lodging→9200, vehicle→9300, activity→9400, transfer→9600, flight→9100).

The commit spine **does not care** which provider sourced the option — by
the time vendor-commit fires, the option already exists in its table
(written via the per-vendor `POST /api/trips/{id}/{vendorApi}` endpoints
from `TripPlannerAI.handleCommitCard`). **A LiteAPI hotel commits exactly
like a manually-added hotel** — both land in `trip_lodging_options` first,
then `vendor-commit` walks them through `proposed → committed`. Confirmed
source-agnostic.

---

## 4. The single best place to add a category → source router

The cleanest, narrowest plug-in point is **the head of the POST handler in
`src/app/api/trips/[id]/ai-assistant/route.ts` (~line 134)**, replacing the
hardcoded `if (isViatorCategory(category) && VIATOR_API_KEY)` two-way
branch with a registry lookup.

### Proposed shape (no code, just structure)
A new file `src/lib/sourceRegistry.ts` exporting:
```
type Source = 'google' | 'viator' | 'liteapi' | 'mozio' | 'airalo' | 'cover_genius';

interface SourceHandler {
  source: Source;
  /** Whether this provider has an active credential in this environment. */
  isEnabled(): boolean;
  /** Whether empty results should fall through to Google ('soft' bookable)
   *  or fail loud ('hard' bookable — new architecture wants this). */
  fallbackToGoogle: boolean;
  /** Run a search and return the canonical recommendation shape. */
  search(params: SearchParams): Promise<Recommendation[]>;
}

const SOURCE_BY_CATEGORY: Record<string, Source> = {
  // Bookable — must show only bookable inventory:
  accommodation:    'liteapi',
  flights:          'duffel',      // already
  sports_fitness:   'viator',
  arts_culture:     'viator',
  wellness:         'viator',
  bucket_list:      'viator',
  ground_transport: 'mozio',       // (or 'viator' for tours+activities flavor)
  insurance_fees:   'cover_genius',
  communication:    'airalo',

  // Non-bookable / discovery — Google Places (top N):
  brunch_coffee: 'google',
  dinner:        'google',
  business_meals:'google',
  nightlife:     'google',         // new architecture moves nightlife OFF Viator
  festivals:     'google',         // moves OFF Viator (festivals aren't booking-friendly)
  conferences:   'google',
  coworking:     'google',
  shopping:      'google',
};
```
The route then becomes:
```
const source = SOURCE_BY_CATEGORY[category] ?? 'google';
const handler = sourceHandlers[source];
if (!handler.isEnabled()) throw new MissingProviderKeyError(source);
const results = await handler.search({ city, country, category, ... });
if (results.length === 0 && handler.fallbackToGoogle) { /* google */ }
upsert(trip_scanner_results, results);
```

This isolates "what provider" from "how the route works." Adding a new
provider is then: one new file `src/lib/providers/<name>Client.ts`
exporting a `SourceHandler`, plus one entry in `SOURCE_BY_CATEGORY`.

---

## 5. Per-provider scope estimates (no build)

For each: what a `<name>Client.ts` + a `<name>Mapper` would need. Sizing
from "smallest lift" to "biggest lift."

### Airalo (eSIM) — **smallest lift**
- **Today's wiring:** `communication` is excluded from scan
  (`travelCOA.ts:274`). Nothing exists.
- **API shape:** catalog browse (no real-time availability). List eSIM
  packages by country/region.
  - Likely endpoints: `GET /v2/packages?country=ID` or similar.
  - Auth: bearer token (partner key).
- **Inputs needed:** just `country` (already on every scan). No dates,
  no passenger count.
- **Mapping:** plan → `{ name: "5GB / 7 days", price: 9.50,
  priceLevelDisplay: "$9.50", durationMinutes: 7*24*60, summary:
  "<coverage details>", bookingUrl: <referral_link with partner ID> }`.
- **Cart/booking flow:** Airalo's affiliate model — deep-link to their
  checkout. No in-app booking. **Same model as Viator today.**
- **New env vars:** `AIRALO_API_TOKEN`, optional `AIRALO_PARTNER_ID`.
- **Lift:** ~150 lines of client + 30 lines of mapper. **1 small PR.**

### Cover Genius (insurance) — **small-medium lift**
- **Today's wiring:** `insurance_fees` is excluded from scan.
- **API shape:** quote-based. Submit traveler count + destination + dates
  + (optional) trip value → returns quote(s).
  - Likely: `POST /v1/quotes` with body `{ travelers, destinations,
    departure_date, return_date, trip_value? }`.
  - Auth: API key in header.
- **Inputs needed:** trip dates, destinations (already on the trip),
  traveler count (currently broken — see prior audit; `barTravelers`
  never reaches the trip; PR-B is the fix). **Blocks fully on the
  traveler-count PR-B**.
- **Mapping:** quote tier → `{ name: "Cover Genius - Comprehensive",
  price: <quote.total_usd>, priceLevelDisplay: "$X total",
  summary: "Coverage: medical $X, baggage $X, ...",
  bookingUrl: <quote.checkout_url> }`.
- **Lift:** ~200 lines of client + 40 lines of mapper. **1 PR, needs
  PR-B (traveler count) shipped first.**

### Mozio (transfers) — **medium lift**
- **Today's wiring:** `ground_transport` currently routes Viator-first,
  Google fallback. Move to Mozio.
- **API shape:** search/poll model — submit pickup/dropoff/datetime,
  poll for quotes from multiple ground providers (Uber, Welcome, local
  taxis).
  - `POST /v2/search` → `search_id`; `GET /v2/search/{id}/poll` until
    `more_coming: false`. Two-step async.
  - Auth: API key.
- **Inputs needed:** pickup location (airport code or lat/lng),
  dropoff location (hotel lat/lng or address), date+time, passengers.
  **The scan body has city/country but not airport, time, or pax.**
  Need to plumb arrival flight info OR default to airport-IATA-from-city
  + arrival date.
- **Mapping:** each result → `{ name: vendor_name (Welcome/Mozio Black),
  price: total_usd, priceLevelDisplay: "$X", durationMinutes: eta,
  bookingUrl: <quote_url>, summary: "Door-to-door, ${vehicle_type}, free
  cancellation 24h" }`.
- **Lift:** ~250 lines (polling logic) + 50 mapper + plumbing arrival
  data into scan. **1 medium PR; depends on having airport-of-arrival on
  the trip (today only `destination: 'Bali'` exists)**.

### LiteAPI (hotels) — **biggest lift**
- **Today's wiring:** `accommodation` is the biggest scanner category by
  user attention and the highest-revenue line (~10-20% commission).
  Currently Google Places returns hotels-as-POIs (no rates, no
  availability).
- **API shape:** rate-based. Two calls minimum:
  1. `GET /v3.0/data/hotels?cityCode=...` or
     `GET /v3.0/data/iata-codes` — destination resolution.
  2. `POST /v3.0/hotels/rates` with `{ hotelIds[], checkin, checkout,
     guestNationality, occupancies: [{adults, children}] }` →
     room/rate combinations per hotel.
  3. `POST /v3.0/rates/prebook` to lock a rate → `POST /v3.0/rates/book`
     to confirm (if doing in-app booking; for affiliate-link model the
     first two suffice).
  - Auth: `X-API-Key` header. Sandbox vs live keys.
- **Inputs needed:** check-in/check-out dates, occupancy, nationality.
  **All today missing from the scan body** — only `city/country/category`
  flow through. Need to plumb `tripDates.departure → checkin`,
  `tripDates.return → checkout`, `travelers → occupancies`.
- **Mapping:** each rate → `{ name: hotel_name, address: hotel_address,
  photoUrl: hotel.main_photo, priceLevel: derive from nightly rate,
  priceLevelDisplay: "$X/night", googleRating: hotel.stars or
  guest_rating, summary: "Free cancel · ${board_type}", bookingUrl:
  affiliate_or_prebook_link, price: nightly_rate * nights, durationMinutes:
  null }`.
- **Cart flow:** for the no-AI / no-mandate architecture, easiest is
  affiliate-link deep-link to LiteAPI's hosted checkout (like Viator
  does today). In-app booking via `prebook → book` is a bigger
  commitment with credit-card handling, PCI, refunds.
- **Special: dedupe with existing `trip_lodging_options` flow.** Today
  `commit/route.ts:140` already fetches a Google hotel photo + lat/lng
  on commit. With LiteAPI, the scan returns full hotel data — no
  Google call needed for accommodation at all.
- **Lift:** ~400 lines (rates query + dedupe + occupancy/nationality
  plumbing) + 80 mapper + scan-body plumbing for dates/occupancy +
  removing Google's accommodation path from `placesSearch.CATEGORY_SEARCHES.lodging`.
  **1 large PR or split into PR-X1 (rates/search) + PR-X2 (occupancy
  + nightly math + UI date plumbing).**

### Viator — **already done, just verify credential**
- **Code lives at `src/lib/viatorClient.ts`** (528 lines, V1 + V2,
  partner `P00294427`, MCID `42383`). No code work needed.
- **What's needed:** confirm `VIATOR_API_KEY` is set in Vercel and the
  partner is active. The previous audit flagged that "All (0)" likely
  meant either the key isn't set (route guard short-circuits at
  `route.ts:137`) or the key is set but invalid and being silently
  swallowed. Both are config issues.
- **Lift:** zero code; one env var + one credential verification step.

---

## 6. Recommended PR sequence

Goal: ship "sellable" inventory fastest, prove the routing pattern, then
scale to the big-revenue providers.

| # | PR | Effort | What ships | Why this order |
|---|---|---|---|---|
| 0 | **Verify Viator credential** | 0 (config) | Sports/Arts/Wellness/Bucket-list/Ground-transport start showing real Viator inventory | Code exists; this is the fastest "sellable" demonstration. Confirms the per-category routing template works in prod. Validates the recommendation shape contract. |
| 1 | **Fail-loud refactor** (the prior audit's Step A) | Small | All three pipes surface real error messages instead of "0 results" | Without this, every subsequent provider's mis-config will look like "0 results" again. Foundation, no new vendor. |
| 2 | **Source registry refactor** (no new provider) | Small-medium | Routing moves from hardcoded `if (isViatorCategory)` to `SOURCE_BY_CATEGORY` map; non-bookable categories explicitly stay on Google | One narrow refactor lands the plug-in point so PRs 3–6 each add one file + one map entry. |
| 3 | **Airalo (eSIM)** | Small | `communication` category gets real plans + affiliate booking | Smallest new lift; immediate revenue (eSIM purchases on every trip); validates the registry on a brand-new category. |
| 4 | **LiteAPI (hotels)** | **Large** | `accommodation` ships real rates + booking links; Google drops out of lodging entirely | Biggest revenue lever (~10-20% per booked room). Worth the lift. Needs dates/occupancy plumbing into the scan request. |
| 5 | **PR-B traveler-count fix** (from prior audit) | Small | Traveler count actually persists | Prerequisite for #6 (Cover Genius needs accurate pax) and improves LiteAPI occupancy plumbing. |
| 6 | **Cover Genius (insurance)** | Small-medium | `insurance_fees` ships real quotes | Decent take-rate; deepens "real money" feel. |
| 7 | **Mozio (transfers)** | Medium | `ground_transport` ships real airport-transfer quotes | Needs arrival-airport plumbing on the trip; nice-to-have, smaller revenue than hotels. |

### Why the order

- **PR 0** is free, immediate, and validates the entire mental model
  (the Viator code + recommendation shape + UI both work). If "All (0)"
  in Bookable Experiences turns into real products after just setting an
  env var, the architecture is proven.
- **PRs 1–2** are infrastructure that pay off forever. Without
  fail-loud + the registry, PRs 3+ each duplicate the same scaffolding
  in their own way.
- **Airalo before LiteAPI** because Airalo is small + adds a brand-new
  bookable category (currently empty), so it can't regress anything.
  LiteAPI replaces Google's lodging path — bigger blast radius —
  better to land it after the registry has been exercised once.
- **PR-B (traveler count) is a prerequisite for Cover Genius** — pax
  count drives the quote — so slot it just before #6.
- **Mozio last** because it has the worst "scan inputs don't match
  provider needs" mismatch (needs airport + time, not just city) and
  it's the lowest revenue lever of the bookables.

### What the new architecture explicitly requires removing
- The current Viator-→-Google silent fallback (`ai-assistant/route.ts:142-143`,
  `:168-170`). For "bookable categories show ONLY bookable inventory,"
  empty Viator must surface as empty (with a banner explaining "no
  bookable inventory for this destination") — not be masked with Google
  POIs.

### What the new architecture explicitly preserves
- Google Places for **discovery categories only** (Brunch/Dinner/
  Nightlife/Coworking/Sights/Beaches/Shopping). No booking link, no
  affiliate revenue, just for "what should I budget?"
- The five-optionType commit spine (`vendor-commit/route.ts:33`). No
  schema migrations needed — every new provider's results commit through
  the existing `lodging`/`transfer`/`vehicle`/`activity`/`flight` tables.

---

## Confirmations

- **All 17 categories defined in one place:** `src/lib/travelCOA.ts:25-220`.
- **Today's routing:** hardcoded two-way (Viator-set or Google) at
  `ai-assistant/route.ts:137`. No registry.
- **Viator already proves the per-category pattern** (search → map to
  canonical shape → upsert same table → fall through on empty).
- **Results shape contract** lives in `viatorProductToRecommendation`
  (`viatorClient.ts:426-512`) and the Google mapper at
  `ai-assistant/route.ts:30-58` — they emit the same shape. Any new
  provider must match.
- **Commit spine is source-agnostic** (`vendor-commit/route.ts:33,
  87, 100-114`). Confirmed via the prior audit; verified again here.
- **No new schema migrations are needed** for any of the proposed
  providers — they all write into existing tables.
