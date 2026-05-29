# Travel-PR-7 — LiteAPI hotelId merge + Google pagination preserve + Viator sort + in-lambda memo

Branch: `claude/travel-pr-7`. Bundles three audit-cited fixes + a defensive
in-lambda memo for Viator + two diagnostic logs. **Each behavioural change
is structurally inert when the hypothesis is wrong** — they only kick in
under the predicted failure mode, so this PR is a strict improvement no
matter which audit hypothesis turns out to be the real culprit on first
deploy.

Net `+88 / −9` lines across three files.

---

## Fix 1 — LiteAPI hotelId merge robustness + diagnostic log + photo fallback

### Re-verified anchors on `main` (cited)
`src/lib/liteapiClient.ts:202-203` (merge filter), `:326` (photo read).

### Change A — accept either `hotelId` or `id` on the merge filter

```diff
- for (const h of (data.hotels || []) as Array<{ id?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
-   if (h && typeof h.id === 'string') hotelMetaById[h.id] = h;
- }
+ for (const h of (data.hotels || []) as Array<{ id?: string; hotelId?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
+   const id = h?.hotelId ?? h?.id;
+   if (id && typeof id === 'string') hotelMetaById[id] = h;
+ }
```

If LiteAPI's parallel `data.hotels[]` items are keyed by `hotelId` (the
audit's high-confidence hypothesis — consistent with the rate side), every
metadata row now matches and the mapper finds real photo + rating values.
If by chance they're keyed by `id` after all, the `?? h?.id` keeps the
existing path working.

### Change B — diagnostic log right after `const data = await res.json();`

```ts
console.log('[LiteAPI rates] response shape:', {
  topKeys: Object.keys(data || {}),
  dataLen: Array.isArray(data?.data) ? data.data.length : null,
  hotelsLen: Array.isArray(data?.hotels) ? data.hotels.length : null,
  hotelsKeys: Array.isArray(data?.hotels) && data.hotels[0] ? Object.keys(data.hotels[0]) : null,
  firstRateKeys: Array.isArray(data?.data) && data.data[0] ? Object.keys(data.data[0]) : null,
});
```

One log line per rates call. Reveals the actual top-level + per-hotel
field names so the next Bali scan confirms the hotelId-vs-id question.
**Pure observation, no behaviour change** — to be removed in a follow-up
PR once the shape is confirmed.

### Change C — photo fallback to `hotelImages[0].url`

```diff
- photoUrl: h.main_photo || h.thumbnail || null,
+ photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || null,
```

LiteAPI's `/data/hotel` docs document `hotelImages[]` as the canonical
gallery. Used as fallback when the hero fields aren't populated.

The `LiteApiHotelRate.hotel` interface (`:141-145`) gained the
corresponding optional field:
```ts
/** Canonical image gallery from /data/hotel; used as fallback when
 *  `main_photo`/`thumbnail` aren't populated. */
hotelImages?: Array<{ url: string; caption?: string; order?: number; defaultImage?: boolean }>;
```

---

## Fix 2 — Google pagination: preserve page-0 results on page-1+ failures

### Re-verified anchors on `main` (cited)
`src/lib/placesSearch.ts:122-123` — the throw on non-OK/non-ZERO_RESULTS status.

### Change

```diff
  if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
+   // ─── PR-7 diagnostic log ──────────────────────────────────────────
+   // One observation per failure: tells us whether the request fails
+   // at page 0 (real content/auth/billing issue — must surface) or
+   // page 1+ (pagetoken-not-yet-active timing race — page-0 results
+   // we already collected are real). Remove in a follow-up once
+   // confirmed.
+   console.error('[PLACES] textsearch failure', {
+     page,
+     query: query.substring(0, 60),
+     status: searchData.status,
+     error_message: searchData.error_message ?? null,
+     had_pagetoken: !!nextPageToken,
+     results_accumulated_so_far: allPlaces.length,
+   });
+
+   // Page 0 = real request-content failure (auth, key, malformed
+   // query, billing) — surface loud and throw per PR-1 fail-loud.
+   // Page 1+ failures are typically pagetoken-not-yet-active timing
+   // races (Google's documented behaviour); the page-0 results we
+   // already accumulated are real successful data and must NOT be
+   // discarded by a timing race. This is NOT a silent swallow:
+   // page-0 still throws verbatim, and the partial-success path
+   // emits a console.warn naming the query.
+   if (page === 0 || allPlaces.length === 0) {
      throw new GooglePlacesApiError(searchData.status, searchData.error_message);
+   }
+   console.warn(
+     `[PLACES] pagination failed at page ${page} for "${query}" — preserving ${allPlaces.length} results from earlier pages`,
+     { status: searchData.status, error_message: searchData.error_message }
+   );
+   break;
  }
```

### Why this is NOT a silent fallback
- **Page-0 failures still throw verbatim** — PR-1 fail-loud preserved.
  The throw at the top-level branch (`page === 0 || allPlaces.length === 0`)
  is unchanged.
- **Page-1+ failures emit a `console.warn`** with query + status +
  error_message + page number + accumulated-count. Nothing silent.
- **Partial results returned are real successful Google data** — the items
  Google returned on page 0 with `status: 'OK'`. We're not inventing,
  estimating, or hallucinating data. We're returning what Google already
  acknowledged as a valid result set.

### Why this matters
Per the audit's Hypothesis P: Google's `next_page_token` activation is
delayed by "a short time" (Google's words; community reports often
>2 seconds). Our 2-second sleep at `:103-105` isn't always enough →
page-1 returns `INVALID_REQUEST` → throw → page-0's 20 successful results
get discarded. Coworking's queries return <20 results = no token = no
page-1 attempt = no race = works. The other 3 categories' queries
return 20+ = token = page-1 attempt = race = discarded results.

After this fix, even if the race fires every time, the 20 page-0 results
per query still surface. The carousel populates instead of erroring.

---

## Fix 3 — Viator sort enum (one token)

### Re-verified anchor on `main` (cited)
`src/lib/viatorClient.ts:257` — `productSorting` in `searchV2Freetext`.

### Change

```diff
- productSorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
+ // /search/freetext accepts REVIEW_AVG_RATING (per Viator's documented
+ // enum); TRAVELER_RATING is only valid on /products/search. Using the
+ // wrong value returns "Invalid sort: TRAVELER_RATING".
+ productSorting: { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' },
```

Per Viator's docs ([Managing product and availability data](https://partnerresources.viator.com/travel-commerce/managing-product-availability-data/)):

| Endpoint | Valid sort enum values |
|---|---|
| `/products/search` | `DEFAULT`, `PRICE`, `TRAVELER_RATING`, `ITINERARY_DURATION`, `NEW_ON_VIATOR` |
| `/search/freetext` | `RELEVANCE`, **`REVIEW_AVG_RATING`**, `DATE_ADDED`, `PRICE` |

`/products/search` at `viatorClient.ts:229` already uses the correct
`'DEFAULT'` — only the freetext path was wrong. Sports & Fitness will
stop erroring at the freetext stage immediately on deploy.

---

## Fix 4 — Viator in-lambda single-flight memo (stopgap)

### Re-verified anchors on `main` (cited)
`src/lib/viatorClient.ts:62-105` — the cache state + `loadDestinations`.

### Change

Add an in-flight promise alongside the existing cache, share it across
concurrent callers in the same lambda:

```diff
  let cachedDestinations: ViatorDestination[] | null = null;
  let destinationCacheTime = 0;
+ // In-flight promise: when N parallel callers in the SAME lambda all see
+ // the cache empty at the same moment, they share one in-flight fetch
+ // instead of firing N concurrent /destinations requests. Module-level
+ // dedup — NOT cross-lambda (Vercel can spawn multiple instances; each has
+ // its own module state). Cross-lambda dedup needs a persistent cache or
+ // a static destId map (see audit `travel-viator-rate-limit-live-audit.md`
+ // option 2A) — queued as a follow-up PR.
+ let destinationLoadPromise: Promise<ViatorDestination[]> | null = null;
  const DEST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async function loadDestinations(): Promise<ViatorDestination[]> {
    if (cachedDestinations && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
      return cachedDestinations;
    }
+   // In-flight de-dup: if another caller in this lambda already kicked off
+   // the load, await its promise instead of firing our own /destinations.
+   if (destinationLoadPromise) return destinationLoadPromise;

+   destinationLoadPromise = (async (): Promise<ViatorDestination[]> => {
      // … existing fetch + filter + cache-set logic, unchanged …
+   })();

+   try {
+     return await destinationLoadPromise;
+   } finally {
+     // Clear the in-flight slot. On success, the populated `cachedDestinations`
+     // serves the next caller. On failure, the next caller will retry the
+     // fetch (fail-loud is preserved — the rejection above bubbled up to the
+     // first caller; we just don't pin a rejected promise on the module
+     // forever).
+     destinationLoadPromise = null;
+   }
  }
```

### Fail-loud preserved
- The inner IIFE keeps the existing `try/catch` that re-throws
  `MissingViatorKeyError` and any other error verbatim.
- The outer `try/finally` ensures `destinationLoadPromise = null` runs
  whether the inner promise resolves or rejects — so a failed load
  doesn't pin a rejected promise forever; the next caller retries.
- A `ViatorApiError(429)` still throws verbatim to the route's outer
  catch, which maps it to a banner.

### Limitation
**Within-lambda dedup only.** When Vercel spawns 4 lambdas in parallel
for the user's "Search Bali" burst, each has its own module state
and each fires its own `/destinations` request. This fix doesn't help
that case. The architectural fix (Option 2A — static `viatorDestId`
map in `destinations.ts`) is queued as a follow-up PR. **The code
comment on the new `destinationLoadPromise` line documents this
explicitly so the next reader doesn't think it's a complete fix.**

---

## Constraints verified

```
$ for f in prisma/schema.prisma \
           src/lib/travelSourceRegistry.ts \
           src/app/api/trips/[id]/vendor-commit/route.ts \
           src/components/trips/TripCreationBar.tsx \
           src/app/budgets/trips/new/page.tsx \
           src/app/api/trips/route.ts \
           src/components/trips/TripPlannerAI.tsx \
           src/app/api/trips/[id]/ai-assistant/route.ts \
           src/app/api/travel/liteapi/prebook/route.ts \
           src/app/api/travel/liteapi/book/route.ts; do
     echo "$f: $(git diff main -- "$f" | wc -l)"
   done
prisma/schema.prisma: 0
src/lib/travelSourceRegistry.ts: 0
src/app/api/trips/[id]/vendor-commit/route.ts: 0
src/components/trips/TripCreationBar.tsx: 0
src/app/budgets/trips/new/page.tsx: 0
src/app/api/trips/route.ts: 0
src/components/trips/TripPlannerAI.tsx: 0
src/app/api/trips/[id]/ai-assistant/route.ts: 0
src/app/api/travel/liteapi/prebook/route.ts: 0
src/app/api/travel/liteapi/book/route.ts: 0
```

Shape, registry, commit→budget spine, traveler-count, route dispatch,
PR-4 carousel UI, PR-3b reservation routes — all untouched. PR-1
fail-loud handling preserved (no new silent paths; Fix 2's page-0
branch still throws verbatim and partial-success emits `console.warn`).

---

## tsc + lint

- `npx tsc --noEmit` → **exit 0.**
- Lint baseline on the three touched files: **9 errors / 2 warnings.**
  After PR-7: **9 errors / 2 warnings.** Zero new errors, zero new
  warnings. All pre-existing `@typescript-eslint/no-explicit-any` on
  `normalizeV2Product`, `searchV2Products`, `searchV2Freetext`,
  `placesSearch.searchPlaces` (V2 response parsers; same baseline as
  every prior PR touching these files). Repo's `next.config.ts` has
  `eslint.ignoreDuringBuilds: true`.

---

## What to expect on first deploy

The two diagnostic logs make the next Bali scan in production self-
confirming or self-denying for each remaining audit hypothesis:

| Audit hypothesis | Confirmation signal on next Vercel log |
|---|---|
| **LiteAPI hotelId-vs-id** | `[LiteAPI rates] response shape` log line. `hotelsKeys` shows the actual field names on the metadata array. If it includes `hotelId`, PR-7 Fix 1A is the right fix and the cards will populate immediately. |
| **Google pagination-token race** | `[PLACES] textsearch failure` log lines with `page` + `had_pagetoken` + `results_accumulated_so_far`. If `page > 0 && had_pagetoken && results_accumulated_so_far > 0`, the race is real and Fix 2 now preserves the results. If page=0 failures show up too, the audit's secondary hypothesis (per-category content) becomes relevant for follow-up. |
| **Viator sort enum** | Sports & Fitness should populate immediately. No diagnostic log needed — the fix is definitive per Viator's docs. |
| **Viator destinations 429** | The in-lambda memo should reduce the rate at which 429s appear (only when Vercel runs 4 separate lambdas concurrently — not within one lambda). Cross-lambda 429s will still occur until the static-destId follow-up PR lands. |

### Honest call on what's still queued

- **The cross-lambda Viator 429 case** is intentionally **NOT** addressed
  in this PR. Fix 4 only handles within-lambda dedup. The architectural
  fix (Option 2A from the audit — populate `viatorDestId` for each
  destination in `destinations.ts`, then `findDestinationId` reads from
  the local map and never calls Viator's `/destinations` at all) is
  queued as a follow-up. It's the cleanest fix but requires a one-time
  build-time job to populate ~30 destination IDs, which is its own
  small PR.
- **The two diagnostic logs** are **temporary** — they're how we
  confirm root causes in production rather than continue guessing.
  Remove in a follow-up PR once the next Bali scan provides the
  observations.

---

## Changeset

```
 A audit-reports/travel-pr-7.md       (this report)
 M src/lib/liteapiClient.ts           (+22 / -3)
 M src/lib/placesSearch.ts            (+32 / -1)
 M src/lib/viatorClient.ts            (+34 / -5)
```

Sources:
- `audit-reports/travel-liteapi-photos-live-audit.md` (commit `0423a873`)
- `audit-reports/travel-google-3cat-live-audit.md` (commit `58ab6f10`)
- `audit-reports/travel-viator-rate-limit-live-audit.md` (commit `082bee5f`)
- [Viator — Managing product and availability data (sort enum per endpoint)](https://partnerresources.viator.com/travel-commerce/managing-product-availability-data/)
- [Viator — Technical Guide (rate limit policy)](https://partnerresources.viator.com/travel-commerce/technical-guide/)
- [LiteAPI — Rate and Hotel Query Guide (`includeHotelData`)](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI — Displaying Essential Hotel Details (`hotelImages`)](https://docs.liteapi.travel/docs/displaying-hotel-details)
- [Google Places — Text Search statuses + pagetoken behaviour](https://developers.google.com/maps/documentation/places/web-service/legacy/search-text)
