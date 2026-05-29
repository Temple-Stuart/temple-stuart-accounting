# Travel `places_cache` Audit — Is the Cache Actually Hit on Refresh?

**Status:** Read-only. No code changes.
**Branch:** `claude/travel-places-cache-audit`
**Question:** When the user hits **Refresh** on a trip destination tab, are
Google Places calls served from `places_cache` (free) or fired fresh against
Google (paid)?
**TL;DR verdict:** Refresh is **cache-first as designed** — it does not
re-bill Google when the cache is fresh. PR-6 / PR-9's `scanQueries` diversification
did **NOT** invalidate cache (the cache key is `(city, country, category)`, not the
query string). Tonight's burn is most likely **cold-cache new destinations**
amplified by an `enrichPlaceDetails` step that fires up to **33 `/place/details`
calls per category miss**, plus **per-query redundant geocodes**. Both are
fixable in a small follow-up PR.

---

## 1. `places_cache` table shape

`prisma/schema.prisma:1062-1082`

```prisma
model places_cache {
  id          String   @id @default(cuid())
  placeId     String   @unique
  name        String
  address     String
  rating      Float?
  reviewCount Int?
  priceLevel  Int?
  website     String?
  types       String? // JSON array as string
  photos      String?  @db.Text // JSON array of photo references
  city        String
  country     String
  category    String // coworking, lodging, etc.
  latitude    Float?
  longitude   Float?
  cachedAt    DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([city, country, category])
}
```

**Cache key (logical):** `(city, country, category)` — see the index at line 1081.
**Row uniqueness:** `placeId` (line 1064) — a single place is upserted once and shared across
re-fetches.
**Freshness anchor:** `cachedAt` — checked by `isCacheFresh` (placesCache.ts:149-169).
**TTL:** 7 days default (`PLACES_CACHE_TTL_DAYS` env override at placesCache.ts:140-143).

The **query string is NOT part of the cache key.** This is the critical
fact for the PR-6 / PR-9 invalidation question (see §6).

---

## 2. Lookup order: cache **before** Google

`src/app/api/trips/[id]/ai-assistant/route.ts:358-371`

```ts
// ─── Fetch & filter places (cache-first) ─────────────────────────────────
let enriched: any[] = [];
const cacheIsFresh = await isCacheFresh(city, country, category);

if (cacheIsFresh) {
  enriched = await getCachedPlaces(city, country, category);
  console.log(`[Scanner] ${category}: ${enriched.length} cached places (0 Google calls)`);
} else {
  console.log(`[Scanner] ${category}: Cache miss — running ${queries.length} queries`);
  const places = await searchPlacesMultiQuery(queries, city, country, 60, undefined);
  enriched = await enrichPlaceDetails(places, maxResults);
  await cachePlaces(enriched, city, country, category);
  console.log(`[Scanner] ${category}: Cached ${enriched.length} places`);
}
```

**Order:** `isCacheFresh` → if true: `getCachedPlaces` returns; **no Google call**.
If false: `searchPlacesMultiQuery` (multiple queries) → `enrichPlaceDetails` (per-place details) → `cachePlaces`.

This is **structurally correct cache-first**.

The cache-read at `placesCache.ts:29-31`:

```ts
const cached = await prisma.places_cache.findMany({
  where: { city, country, category }
});
```

The Google call site for textsearch at `placesSearch.ts:114`:
`const searchRes = await googleFetch(searchUrl);` — inside `searchPlaces`, wrapped by
`searchPlacesMultiQuery` which itself is only invoked in the cache-miss branch.

---

## 3. Cache key analysis

### What goes in

`placesCache.ts:29-31` and `:156-158`: `where: { city, country, category }`. **No query string. No coordinates. No interest slugs.**

### Did PR-6 / PR-9 `scanQueries` changes invalidate cache?

**No.** PR-6 diversified `scanQueries` for the four Google categories; PR-9
diversified Viator search terms (which don't touch this cache at all). Because
the cache key omits the query string, neither PR invalidated any cached rows.
What both PRs did was change **what gets cached on the NEXT MISS** — i.e. the
new queries surface a different (usually larger) set of places when the TTL
naturally expires.

So the "7 days of cache misses after each PR" theory is **wrong**. Every cache
row stayed valid until its own `cachedAt + 7d` TTL.

### Does Refresh send a cache-busting flag?

`src/components/trips/TripPlannerAI.tsx:347-358`

```ts
const rescanAll = async () => {
  setByCategory({});
  setRecommendations([]);
  setSelections([]);
  setScannerMeta(null);
  setCategoryErrors({});
  setCompletedCount(0);
  const activeCoaKeys = getActiveScanCategories([], '');
  await autoScanCategoriesFor(activeCoaKeys);
};
```

**No cache-busting parameter.** Refresh clears client-side React state and
re-calls `/api/trips/[id]/ai-assistant` for every active category. The server
still does the `isCacheFresh` check (route.ts:360). If the cache is fresh:
**zero Google calls**, the API just returns cached rows.

There is **no `?force=1`, no `no-cache` header, no DELETE-then-refetch.**
Refresh is a "soft" rescan.

---

## 4. Observability

| Event | Log | File:line |
|---|---|---|
| Cache hit | `[Scanner] ${category}: ${N} cached places (0 Google calls)` | route.ts:364 |
| Cache miss | `[Scanner] ${category}: Cache miss — running ${N} queries` | route.ts:366 |
| Per-query result | `[PLACES] "${query}" in ${city}: ${N} results` | placesSearch.ts:179 |
| Multi-query summary | `[PLACES] Multi-query: ${N} queries (${ok} OK, ${fail} failed), ${M} unique places` | placesSearch.ts:405 |
| Cache write | `[Cache] Saved ${N} places to cache for ${city}/${category}` | placesCache.ts:131 |
| Quota 80% warning | `[GooglePlaces] Usage at 80% of monthly cap (${n}/${cap})` | googlePlacesQuota.ts:57 |

Observability is **already excellent.** Production logs from tonight's scans
should clearly say `cached places (0 Google calls)` vs `Cache miss — running
N queries`. Inspect the deploy logs to settle the burn-cause hypothesis.

---

## 5. Quota consumption

`src/lib/googlePlacesQuota.ts:43-65`

```ts
async function reserveCall(): Promise<void> {
  const yearMonth = currentYearMonth();
  const cap = monthlyCap();
  const row = await prisma.google_places_usage.upsert({
    where: { yearMonth },
    update: { callCount: { increment: 1 } },
    create: { yearMonth, callCount: 1 },
  });
  if (row.callCount > cap) {
    throw new GooglePlacesQuotaError(row.callCount, cap);
  }
  if (row.callCount === Math.floor(cap * WARN_RATIO)) {
    console.warn(`[GooglePlaces] Usage at ${Math.round(WARN_RATIO * 100)}% of monthly cap (${row.callCount}/${cap})`);
  }
}

export async function googleFetch(url: string, init?: RequestInit): Promise<Response> {
  await reserveCall();
  return fetch(url, init);
}
```

- **Counter:** `google_places_usage.callCount`, persistent, atomic increment
  on every outbound call.
- **Order:** reserve **before** the fetch. So a network failure / 5xx
  response still counts against quota (Google billed us for the attempt).
- **Granularity:** the wrapper does **not distinguish call type** (geocode vs
  textsearch vs details vs photo) — every wrapped call increments by 1. Photo
  proxy fetches (`/api/places/photo`) also flow through `googleFetch` if they
  ever hit upstream, which is rare but possible on cold proxy entries.
- **Cap:** `GOOGLE_PLACES_MONTHLY_CAP` env var, default 5000.

### Double-count risk?

Per route.ts:368, `enrichPlaceDetails` runs `Promise.all(places.slice(0,
limit).map(...))`. Each map iteration calls `googleFetch` once → one
`reserveCall` upsert per place. The upsert is atomic, so no inflation. **Safe.**

### Cost per category MISS (per the current code)

Per call to `searchPlaces(query, city, country)` at placesSearch.ts:64:
- 1 geocode call (line 82) — fires every time, **not cached** across queries.
- 1–3 textsearch pages (line 114, paginated up to `maxResults`).

So one query ≈ **2–4** Google calls.

`searchPlacesMultiQuery` (line 365) issues all queries in parallel via
`Promise.allSettled`. For a category with N queries:
- N geocode calls + N×(1–3) textsearch calls = **2N–4N**.

Then `enrichPlaceDetails` (route.ts:75-107) runs **`/place/details` once per
place, up to `maxResults` (default 33)** — 33 more calls per category miss.

**Per-category cold-cache cost:**

| Category | N queries | Cold-miss calls (geocode + textsearch + details) |
|---|---|---|
| brunch_coffee | 5 | 5 + 5–15 + 33 = **43–53** |
| dinner | 5 | 43–53 |
| business_meals (business/mixed trips only) | 3 | 3 + 3–9 + 33 = **39–45** |
| nightlife | 3 | 39–45 |
| coworking | 3 | 39–45 |
| shopping | 4 | 4 + 4–12 + 33 = **41–49** |

For one destination over **6 Google categories** cold: **240–290 calls**.
For a **5-destination multi-leg trip**, cold: **1200–1450 calls**. Against a
5000/month cap, **3–4 fresh trips can saturate the month**.

---

## 6. PR-6 / PR-9 invalidation timing

Already answered in §3. The cache key omits the query string, so neither PR
invalidated cached rows. Behaviour at TTL expiry:

- Pre-PR-6 a cache MISS on `dinner` ran a single query like `"dinner"` → ~2–4
  calls.
- Post-PR-6 the same MISS runs `['dinner restaurant', 'fine dining', 'local
  restaurant', 'street food', 'seafood restaurant']` → ~43–53 calls.

So the diversification **didn't trigger** invalidation, but it **amplified
the cost** of any miss that naturally occurred (new destination, expired TTL,
new category routing).

---

## 7. Verdict on tonight's burn

Most likely cause set (in descending probability):

1. **Cold cache on a new destination.** A first-ever scan of Bali + Singapore
   + Phuket × 6 Google categories ≈ 720–870 fresh Google calls.
2. **Cold cache on previously-scanned destinations that crossed the 7-day
   TTL.** Same per-destination math.
3. **Iterative testing during PR-9 → PR-12 development**, where each
   re-deploy / new test trip exercised cold-cache paths.
4. **`enrichPlaceDetails` overhead.** Even on the first miss the details
   sub-step dominates: 33 calls per category, ~200 calls per destination
   independent of how many queries you run.
5. **Redundant per-query geocodes.** `searchPlaces` geocodes the same
   `(city, country)` once per query inside the same scan — 5 queries = 5
   redundant geocode calls.

**Refresh button is NOT the culprit.** With a fresh cache, Refresh fires
`isCacheFresh` → returns true → `getCachedPlaces` reads N DB rows → returns →
**0 Google calls**, just the React state churn and an HTTP round-trip per
category. The "Refresh" log line you'll see is the `[Scanner] ${category}: N
cached places (0 Google calls)` at route.ts:364.

The cache **is not silently broken.** It's working as designed; the burn is
the natural cost of cold-cache fills with the post-PR-6 enriched query set
plus `enrichPlaceDetails`.

---

## 8. Proposed one-PR fix

Three low-risk wins, all in one PR, queued as **PR-13** or similar:

### Fix A — Geocode result cache (5–10× saving on misses)

`searchPlaces` (placesSearch.ts:79-82) geocodes once per query. A category
with 5 queries geocodes the same `(city, country)` 5 times. Wrap the
geocode in a small `(city, country) → {lat, lng}` memo:

- In-memory module-level Map for the duration of a single scan (5 queries
  share one geocode result) — saves 4 calls per 5-query category.
- Bigger win: persist geocode result rows (or just `latitude`/`longitude` on
  the trip / destination row — we already do this on `trip_destinations`
  per the PR-10 audit). Look up before hitting Google.

Estimated impact: cold-miss cost per category drops from ~43–53 → ~39–45 (×6
categories saves ~24 calls per destination). For a 5-destination trip:
~120 calls saved per cold pass.

### Fix B — Optional `?nodetails=1` or batch the details

`enrichPlaceDetails` (route.ts:75-107) fetches **`website` only** (line 83
`fields=website`). For the UI cards, do we actually need website on every
result, or could we lazy-fetch when the user clicks "Open booking link"?
- If lazy is acceptable: drop `enrichPlaceDetails` from the cold path
  entirely → **saves ~33 calls per category miss = ~200 calls per
  destination = ~1000 calls per 5-destination trip**.
- If website is needed up front: cache the details lookup on `placeId`
  separately so cross-category overlap (same restaurant matched by
  `brunch_coffee` and `dinner`) doesn't double-fetch.

### Fix C — Cache-hit visibility on the client

Surface the `[Scanner] {category}: N cached places (0 Google calls)` signal
back to the UI as a small badge ("cached · refreshed Xh ago"). Doesn't reduce
spend, but tells the user when Refresh is free vs about to burn quota.

---

## Recommended next steps

- **Look at the production logs from tonight** — count `cached places (0
  Google calls)` lines vs `Cache miss — running N queries` lines. That
  tells us empirically what fraction of category-fetches went to Google.
- **Track `google_places_usage.callCount` over time** — confirm the rate is
  consistent with cold-cache misses, not with refresh-induced over-calling.
- **Ship Fix B** if possible — the `enrichPlaceDetails` step is the single
  largest per-miss cost and almost certainly the biggest lever.
