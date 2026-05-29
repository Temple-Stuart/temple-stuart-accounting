# Travel PR-10 Audit

**Status:** Read-only. 8-item diagnosis. No code changes.
**Branch:** `claude/travel-pr-10-audit`
**Scope:** PR-9 regressions + LiteAPI per-night price + per-leg dates + hotel
card richness + dinner cross-destination leak + Conferences removal.

## Summary table

| # | Issue | Severity | Fix size | Belongs in PR-10? |
|---|---|---|---|---|
| 1 | Viator `/search/freetext` BAD_REQUEST on Arts/Wellness/Bucket-list | Blocker, 3 carousels | 1 line | ✅ Yes |
| 2 | Adventure scan → 400 "Valid category required" | Blocker, 1 carousel | 3 lines | ✅ Yes |
| 3 | Carousel label still reads "Sports & Fitness" | Cosmetic | 1 defensive line | ✅ Yes |
| 4 | Per-destination leg dates (185-night LiteAPI query) | Blocker for multi-leg | **Feature-sized (iii)** | ❌ **Split to PR-11** |
| 5 | Hotel price shows trip-total, not per-night | Blocker for credibility | 5 lines | ✅ Yes |
| 6 | Hotel card sparse — address/amenities/review count dropped | Quality | 10-30 lines mapper + 30-60 lines UI | ⚠️ Mapper yes; richer UI = PR-11 |
| 7 | Dinner shows Phuket restaurants on Bali tab | Blocker | 1 line client filter | ✅ Yes |
| 8 | Remove Conferences from the trip planner | Trivial | 2 lines | ✅ Yes |

---

## Issue 1 — Viator `/search/freetext` "Invalid value format for field: destination"

### Cite

`src/lib/viatorClient.ts:277-289`

```ts
async function searchV2Freetext(searchTerm: string, destId: number | null, maxCount: number, start: number = 1): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    searchTerm,
    searchTypes: [{ searchType: 'PRODUCTS', pagination: { start, count: Math.min(maxCount, 50) } }],
    currency: 'USD',
    productSorting: { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' },
  };
  if (destId) {
    body.productFiltering = { destination: { type: 'DESTINATION', destId } };   // ← line 288
  }
```

### Why PR-9 exposed it

PR-9's Fix 1 promoted freetext to PRIMARY. Pre-PR-9 the gate at the old line 364 (`if (allProducts.length < maxResults)`) short-circuited and `/search/freetext` rarely ran for popular cities (it was a supplement to `/products/search`). The latent malformed body never caught a real call.

### Why the shape is wrong

Per Viator's V2 Partner API (`https://docs.viator.com/partner-api/affiliate/technical/#operation/freetextSearch`), `productFiltering.destination` is **a single value referencing the destination ID** — not a nested `{ type, destId }` object. The accepted form per the OpenAPI reference is either a plain number or an object keyed by `id` (depending on schema revision). Our `{ type: 'DESTINATION', destId }` mixes two different shapes (the field name `destId` is non-standard; standard is `id` / `destinationId`).

`/products/search` (line 251: `filtering.destination: String(destId)`) is unaffected — that endpoint takes a different request shape (`Filtering` object) and works.

### Proposed fix (1 line)

`viatorClient.ts:288` →

```ts
body.productFiltering = { destination: destId };
```

If Viator still rejects with the same error, fall back to:

```ts
body.productFiltering = { destination: { id: destId } };
```

---

## Issue 2 — "Adventure" → 400 "Valid category required"

### Cite

`src/app/api/trips/[id]/ai-assistant/route.ts:147-153`

```ts
const isCOACategory = !!TRAVEL_COA[category];
const isLegacyCategory = !!CATEGORY_SEARCHES[category];
const isInterestCategory = !!ACTIVITY_SEARCH_EXPANSIONS[category];
if (!category || (!isCOACategory && !isLegacyCategory && !isInterestCategory)) {
  return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
}
```

### Root cause

When the client bundle is stale (pre-PR-9), the carousel POSTs `category: 'sports_fitness'`. Post-PR-9:

- `TRAVEL_COA['sports_fitness']` → `undefined` (renamed to `adventure`).
- `CATEGORY_SEARCHES['sports_fitness']` → undefined.
- `ACTIVITY_SEARCH_EXPANSIONS['sports_fitness']` → undefined.

→ 400.

The alias rows PR-9 added at `travelCategories.ts:31-32` (`sports_fitness: 'adventure'`) **don't fire here**. Their only consumer is `resolve()` in `travelCategories.ts:55`, called from `getCategoryByKey` / `getCOACode` / `getSection` / `getCalendarColor` / `getCalendarLabel` / `legendGroupFor` — none of which the route validator imports.

### Proposed fix (3 lines)

`ai-assistant/route.ts:148` — alias-resolve before validation:

```ts
import { getCategoryByKey } from '@/lib/travelCategories';
// ...
const resolvedCategory = getCategoryByKey(category)?.key || category;
const isCOACategory = !!TRAVEL_COA[resolvedCategory];
// ... pass `resolvedCategory` downstream instead of `category`
```

This makes the legacy alias accepted server-side regardless of which bundle the client is running.

---

## Issue 3 — "Sports & Fitness" UI label not renamed

### Cite

`src/components/trips/TripPlannerAI.tsx:851-853`

```ts
const coa = TRAVEL_COA[catKey];
const info = CATEGORY_INFO[catKey];
const label = info?.label || coa?.label || catKey;
```

Sources in order: `CATEGORY_INFO[catKey]?.label` → `TRAVEL_COA[catKey]?.label` → `catKey`.

Post-PR-9:
- `CATEGORY_INFO` (TripPlannerAI.tsx:66-77) has no `adventure` entry — falls through.
- `TRAVEL_COA.adventure.label` (travelCOA.ts:85) = `'Adventure'` ✓.

### Diagnosis

A repo-wide grep `grep -rn "Sports & Fitness" src/` returns **zero matches** — no code path can render that string after PR-9. The user's "Sports & Fitness" sighting is **the stale client bundle**: their tab still runs the pre-PR-9 JS where `CAROUSEL_ORDER` had `'sports_fitness'`, which mapped to the old `TRAVEL_COA.sports_fitness.label = 'Sports & Fitness'`. Hard reload (or a fresh Vercel deploy of PR-9) makes it go away.

### Proposed fix (1 defensive line)

Add `'adventure': { label: 'Adventure', icon: '' }` to `CATEGORY_INFO` at `TripPlannerAI.tsx:77`. Belt-and-suspenders — protects the label from any future TRAVEL_COA reshape, and resolves Issue 3 even if a stray cache lingers.

---

## Issue 4 — Per-destination leg dates (185-night LiteAPI query)

### Cite

`src/app/api/trips/[id]/ai-assistant/route.ts:185-203`

```ts
const trip = await prisma.trips.findFirst({
  where: { id: tripId },
  select: { startDate: true, endDate: true },
});
...
const checkin = trip.startDate.toISOString().slice(0, 10);    // whole-trip
const checkout = trip.endDate.toISOString().slice(0, 10);     // whole-trip
```

For a trip Jul 1 → Jan 1 (185 nights), LiteAPI receives a 185-night availability filter; almost no property holds inventory that long → 0 / 1 hotels return.

### Schema check

`prisma/schema.prisma:698-714`

```prisma
model trip_destinations {
  id             String   @id @default(cuid())
  tripId         String
  resortId       String?
  name           String?  @db.VarChar(255)
  country        String?  @db.VarChar(100)
  latitude       Decimal? @db.Decimal(10, 7)
  longitude      Decimal? @db.Decimal(10, 7)
  isSelected     Boolean  @default(true)
  estimatedTotal Decimal? @db.Decimal(12, 2)
  createdAt      DateTime @default(now())
  ...
}
```

**No `startDate` / `endDate` columns.** Destinations POST handler (`src/app/api/trips/[id]/destinations/route.ts:311-335`) writes only `tripId, resortId, isSelected` or `tripId, name, country, latitude, longitude, isSelected` — no date capture anywhere in the destinations CRUD path.

Tab UI exists (`src/app/budgets/trips/[id]/page.tsx:1022-1044`) — clicking a destination chip calls `selectDestination()` which sets `trip.destination` — but only updates the city/country flow into TripPlannerAI, not any date scope.

### Classification: (iii) FEATURE-SIZED

Per-leg dates require a new model. Recommended scope for **PR-11** (its own PR):

1. **Schema migration:**
   ```prisma
   model trip_destinations {
     ...
     startDate  DateTime?
     endDate    DateTime?
     orderIndex Int       @default(0)
   }
   ```
2. Destinations CRUD route — accept & persist `startDate`, `endDate`, `orderIndex` on POST/PATCH.
3. `TripCreationBar.tsx` + the chip row in `page.tsx:1022` — per-chip date picker (or a single "Dates" modal that lists every destination in order and lets the user split the trip window).
4. `ai-assistant/route.ts` — accept optional `destinationId` in the POST body; when present, load that `trip_destinations` row's `startDate`/`endDate` and use those for LiteAPI; fall through to `trip.startDate/endDate` when missing.
5. `TripPlannerAI.tsx` — pass the active destination's id to every scan call so the route looks up the right leg.

### Interim stopgap for PR-10 (5 lines, no schema change)

In `ai-assistant/route.ts:194-195`, cap the LiteAPI search window to the first 7 nights from `trip.startDate`:

```ts
const checkinDate = new Date(trip.startDate);
const checkoutDate = new Date(checkinDate);
checkoutDate.setDate(checkoutDate.getDate() + 7);
const checkin = checkinDate.toISOString().slice(0, 10);
const checkout = checkoutDate.toISOString().slice(0, 10);
```

Trades multi-destination granularity for cardinality realism — LiteAPI surfaces actual inventory the user can re-filter when they book. Clearly labeled as a stopgap until PR-11's per-leg dates land.

**Recommendation:** ship the stopgap in PR-10; do the full feature in PR-11.

---

## Issue 5 — Hotel price displayed as trip-total, not per-night

### Cite

`src/lib/liteapiClient.ts:298-314`

```ts
/** Extract the lowest nightly rate the hotel returned, in the requested
 *  currency. LiteAPI V3 nests rates under roomTypes[].rates[].retailRate. ...
function extractNightlyRate(hotel: LiteApiHotelRate): number | null {
  for (const room of hotel.roomTypes || []) {
    for (const rate of room.rates || []) {
      const total = rate.retailRate?.total?.[0]?.amount;    // ← line 305 — TOTAL, not nightly
      if (typeof total === 'number' && total > 0) return total;
      ...
```

### Why $58k / $80k / $7k

Per LiteAPI docs (`https://docs.liteapi.travel/docs/displaying-hotel-details`, `https://docs.liteapi.travel/reference/get_rates`), the rate response has:

- `retailRate.total[]` — **total for the entire stay** (sum across all nights × rooms × guests, in the requested currency).
- `retailRate.suggestedSellingPrice[]` — total selling price (margin-added, also stay-total).

LiteAPI's V3 `/hotels/rates` response **does not include a per-night field**. The per-night must be computed: `nightly = total / nights / numberOfRooms`.

For a 185-night Bali query: a $317/night property → `total = $58,645` → that's exactly the "$58k" the user saw. Math confirms.

### Proposed fix (5 lines)

Two-part fix:

(a) **Plumb nights into the mapper.** `liteApiHotelToRecommendation` needs to know the search's nights count:

```ts
export function liteApiHotelToRecommendation(
  hotel: LiteApiHotelRate,
  idx: number,
  category: string,
  nights: number = 1,          // NEW
): HotelRecommendation { ... }
```

(b) **Compute nightly.** Rename `extractNightlyRate` → `extractStayTotal`, and in the mapper:

```ts
const stayTotalUsd = extractStayTotal(hotel);
const nightlyUsd = stayTotalUsd != null && nights > 0
  ? Math.round(stayTotalUsd / nights * 100) / 100
  : null;
```

(c) **Caller plumbs `nights`** — at `ai-assistant/route.ts:206`:

```ts
const nights = Math.max(1, Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86_400_000));
// ...
.map((h, idx) => liteApiHotelToRecommendation(h, idx, category, nights))
```

Combined with Issue 4's stopgap (7-night cap), the nightly figure will be both correct and a typical Booking.com-style "per night from $X".

---

## Issue 6 — Hotel card sparse: address / amenities / review count dropped

### Cite — current mapper output

`src/lib/liteapiClient.ts:341-380` returns:

```ts
{
  name: h.name || 'Hotel',
  address: h.address || h.city || '',
  website: null,
  photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || null,
  priceLevel, priceLevelDisplay,
  googleRating, reviewCount,
  sentimentScore, sentiment,
  summary: (h.hotelDescription || '').replace(/<[^>]*>/g, '').substring(0, 300),
  warnings: [], trending: false, fitScore, valueRank, category, compositeScore,
  liteapiHotelId, liteapiOfferId,
  bookingUrl: null,
  price, durationMinutes: null,
}
```

Per LiteAPI docs (`/docs/displaying-hotel-details`, `GET /hotels/data`), the hotel metadata object carries — and we're either reading or could read:

| Field | Currently mapped? |
|---|---|
| `name` | ✅ |
| `address` | ✅ (string only — but LiteAPI returns object: `{ city, country, postalCode, lineOne, lineTwo }`) |
| `main_photo`, `thumbnail`, `hotelImages[]` | ✅ photoUrl only |
| `rating`, `starRating`, `stars` | ✅ via `googleRating` |
| `reviewCount` | ✅ |
| `hotelDescription` | ✅ truncated to 300 chars |
| `latitude`, `longitude` | ❌ dropped (interface has them) |
| `chain`, `brand` | ❌ dropped (not in interface) |
| `hotelFacilities[]` (amenities: pool, breakfast, wifi, parking …) | ❌ dropped |
| `hotelImportantInformation` | ❌ dropped |
| `reviewScore` (vs `rating`) | ❌ unclear which is shown |
| `neighborhood` / `area` (when present) | ❌ dropped |

### Proposed minimal mapper additions (PR-10, ~10 lines)

Add three fields without changing the recommendation shape consumers depend on:

```ts
+ neighborhood: string | null;        // address.city or first segment of `address`
+ amenities: string[];                // top 6 facility names
+ chain: string | null;               // h.chain ?? null
```

Sourcing: `h.address.city ?? h.city ?? null` for neighborhood; `(h.hotelFacilities || []).slice(0, 6).map(f => f.name)` for amenities. Both are no-ops when LiteAPI doesn't include them.

### UI surfacing (PR-11)

The carousel card layout would need updating to show neighborhood under the name + a row of amenity icons. That's a UI design + component change — ~30-60 lines in `TripPlannerAI.tsx` (or the shared card component). Recommend **scoping the UI change to PR-11** so PR-10 stays focused on regressions + price/leak fixes. The mapper additions can land in PR-10 since they're additive (consumers ignore unknown fields).

---

## Issue 7 — Dinner shows Phuket restaurants on Bali tab

### Cite — server: DB has per-destination rows

`prisma/schema.prisma:1793-1811`

```prisma
model trip_scanner_results {
  ...
  tripId          String
  destination     String   @db.VarChar(200)
  category        String   @db.VarChar(50)
  recommendations Json
  ...
  @@unique([tripId, destination, category])
}
```

Unique on `(tripId, destination, category)` — Bali Dinner and Phuket Dinner are **separate rows** in the DB. The server-side write at `ai-assistant/route.ts:220-223` keys by `${city}, ${country}` so the rows do diverge correctly.

### Cite — client: drops the destination key

`src/app/api/trips/[id]/scanner-results/route.ts:28-31`

```ts
const results = await prisma.trip_scanner_results.findMany({
  where: { tripId: id },
  orderBy: { category: 'asc' },
});
```

Returns **all** rows for the trip — every destination's data — with no filter.

`src/components/trips/TripPlannerAI.tsx:223-232`

```ts
for (const r of results) {
  const recs = r.recommendations as GrokRecommendation[];
  if (recs && recs.length > 0) {
    loaded[r.category] = recs;           // ← line 226 — keys by category ONLY
    allRecs = [...allRecs, ...recs];
  }
  ...
}
```

`loaded` is keyed solely by `r.category`. For Dinner: if both Bali and Phuket rows exist, the second iteration wins. Bali tab renders whichever-was-last (Phuket here).

### Proposed fix (1 line, client-side filter)

`TripPlannerAI.tsx:223` — add destination filter inside the loop:

```ts
const destinationKey = `${city}, ${country}`;
for (const r of results) {
  if (r.destination !== destinationKey) continue;   // ← NEW
  ...
}
```

### Optional defensive complement (server-side, also 1 line)

`scanner-results/route.ts:28` — accept optional `?destination=` query param and filter at the DB level. Saves transferring rows the client will discard.

```ts
const { searchParams } = new URL(request.url);
const destination = searchParams.get('destination') || undefined;
const results = await prisma.trip_scanner_results.findMany({
  where: { tripId: id, ...(destination ? { destination } : {}) },
  orderBy: { category: 'asc' },
});
```

Client side passes `?destination=${encodeURIComponent(`${city}, ${country}`)}` at TripPlannerAI.tsx:216. Recommend doing both — client filter for back-compat with the bare endpoint, server filter for efficiency.

---

## Issue 8 — Remove Conferences from the trip planner

### Cite — three sources

| File:line | Entry |
|---|---|
| `src/lib/travelSourceRegistry.ts:89` | `conferences:      { source: 'google', hardBookable: false },` |
| `src/lib/travelCOA.ts:135-146` | Full COA entry with `coaBusiness: 'B-9500'` |
| `src/components/trips/TripPlannerAI.tsx:891` | `'conferences',       // Conferences (Google — business/mixed trips only)` |

Active-scan loop: `getActiveScanCategories` (`travelCOA.ts:278-293`) iterates `TRAVEL_COA` keys and skips by name (flights / communication / insurance_fees / business_meals-on-non-business). Conferences is NOT in the skip list → it's active.

### Proposed fix (2 lines, minimum invasive)

Option A — hide from UI but keep COA / registry intact (so B-9500 budget mapping still works for hand-entered conference expenses).

1. **TripPlannerAI.tsx:891** — delete the line:
   ```diff
   -  'conferences',       // Conferences (Google — business/mixed trips only)
   ```

2. **travelCOA.ts:283-289** — extend the skip list in `getActiveScanCategories`:
   ```diff
   +    if (key === 'conferences') continue;
   ```

That hides the carousel and stops auto-scanning. The COA entry stays so any historic `B-9500` budget rows still resolve to "Conferences & Summits" labels.

A future PR (queued, out of scope per the user) wires a real conference API (eg. Eventbrite / Meetup / Bizzabo) and re-adds the carousel.

---

## Recommended PR-10 scope

**In PR-10 (small / regression bundle):**
- Issue 1 — Viator freetext destination format (1 line)
- Issue 2 — route alias resolution (3 lines)
- Issue 3 — defensive `CATEGORY_INFO['adventure']` (1 line)
- Issue 4 — **interim 7-night LiteAPI window** (5 lines, clearly marked stopgap)
- Issue 5 — per-night price = total / nights (5 lines)
- Issue 6 — **mapper additions only** (neighborhood, amenities, chain — ~10 lines)
- Issue 7 — client + server destination filter on scanner-results (2 lines)
- Issue 8 — remove Conferences from CAROUSEL_ORDER + skip in active scan (2 lines)

Total: ~30 lines across 5 files. All regression / quality-of-life fixes; no schema migration.

**Split to PR-11 (feature work):**
- Issue 4 (proper) — `trip_destinations.startDate / endDate / orderIndex` schema migration + destinations CRUD route updates + per-chip date picker UI + `destinationId` plumbing into `ai-assistant`. Single coherent feature: "per-destination leg dates".
- Issue 6 (UI) — redesigned hotel card with neighborhood, amenity icons, review count display. Coupled to the trip-card design system; ~30-60 lines in the carousel + a small design review.

This split keeps PR-10 unblockable (small, clearly diagnosed, low-risk fixes) and PR-11 focused (one coherent feature with schema + UI + plumbing).
