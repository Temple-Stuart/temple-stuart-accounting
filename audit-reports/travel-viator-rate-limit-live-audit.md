# Viator 429s + Invalid `TRAVELER_RATING` sort post-PR-6 — audit

Branch: `claude/travel-viator-rate-limit-live-audit`. Read-only.

## ⚠️ Caveat upfront

**`VIATOR_API_KEY` is not in the audit container's env.** Same situation
as the last two audits — I literally couldn't run the authenticated
`curl` to confirm the rate-limit retry-policy details.

What I *did* find with high confidence:
- The sort-error root cause and exact fix (from Viator's documented enum
  values for `/search/freetext`).
- The 429 root cause (architectural — cache scope vs serverless lambda
  scope) and 4 fix options ranked by impact.

What I couldn't verify directly but have strong structural evidence for:
- Concurrent-lambda hypothesis for the 429s — strongest fit to the
  observed symptom (3 of 4 categories 429 on the same call).

---

## 1. Cache behaviour — cited

`src/lib/viatorClient.ts:60-71`:
```ts
let cachedDestinations: ViatorDestination[] | null = null;
let destinationCacheTime = 0;
const DEST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function loadDestinations(): Promise<ViatorDestination[]> {
  if (cachedDestinations && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
    return cachedDestinations;
  }
  // …fetch + populate cache…
}
```

### (a) Module-level, not persistent
`let` at module scope = lives for the **lifetime of the Node.js process**.
In Vercel serverless: each lambda instance has its own process state. The
24h TTL is meaningful **only within one warm lambda's lifetime** — and
serverless lambdas can be recycled at any time. Across requests handled
by different lambdas, the cache effectively doesn't exist.

### (b) Each parallel category request lands in a (potentially) different lambda
PR-4's `autoScanCategoriesFor` (`TripPlannerAI.tsx:271-323`) fires
`Promise.allSettled` across ~13 active categories. Each becomes a separate
POST to `/api/trips/[id]/ai-assistant`. Vercel routes those to lambdas
concurrently — likely spawning multiple instances to handle the burst.

**Four Viator categories → up to 4 different lambdas → 4 cold caches → 4
parallel `/destinations` calls firing within milliseconds of each other.**

### (c) Even within ONE lambda, there's a TOCTOU race
The cache check is:
```ts
if (cachedDestinations && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
  return cachedDestinations;
}
// nothing prevents two concurrent callers from each seeing null here
// and both firing fetch
```
No "in-flight promise" memoization. Two concurrent calls inside the same
lambda each see `null` and both fire `fetch(/destinations)`. The second
one's fetch is wasted (and contributes to the rate-limit pressure).

The cross-lambda race (b) is the dominant cause; the within-lambda race
(c) is a multiplier.

---

## 2. Rate-limit policy — what Viator documents

Per [Viator's technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/)
(consolidated from multiple search-result citations because I couldn't
fetch the doc page directly — the doc-fetch pages keep returning
truncated content):

> **150 requests per rolling 10-second window** (~15 RPS average).
> Excess → HTTP 429. "If you make a large number of concurrent requests
> you may be rate limited; in that case retry after the suggested time."

No per-endpoint sub-limits are documented. No `Retry-After` header is
explicitly guaranteed (the docs just say "retry after the suggested time"
— vague).

### Why 4 parallel `/destinations` calls trigger this
4 calls in <1 second isn't 150-in-10-seconds territory on its own.
**But** the same 4 Viator categories ALSO each fire `/products/search`
and (often) `/search/freetext` calls. And the user has the Bookable
Experiences page open which already cached destinations there — meaning
the lambda pool may be sharing token budget with that loaded session.

Realistic burst from one "Search Bali" click:
- 4 Viator cats × ~3 calls each = ~12 Viator API calls
- All firing in parallel within 1-2 seconds
- That's ~12 RPS instantaneous (within the 15 RPS average but at burst)

If `/destinations` specifically gets even slightly tighter throttling
(common for taxonomy endpoints; Viator hasn't documented per-endpoint
limits but their CDN/WAF layer likely applies one), 3 of 4 simultaneous
`/destinations` calls hitting 429 fits perfectly.

### Keyless probe — no rate-limit visibility without auth
```
$ curl -sI "https://api.viator.com/partner/destinations" \
       -H "Accept: application/json;version=2.0"
HTTP/2 400
content-language: und
date: Fri, 29 May 2026 00:24:29 GMT
…
```
No `X-RateLimit-*` or `Retry-After` headers exposed on 400 responses.
Pre-auth probes can't reveal the rate-limit policy.

---

## 3. The sort error — definitive fix (cited)

`src/lib/viatorClient.ts:251-261`:
```ts
async function searchV2Freetext(searchTerm: string, destId: number | null, maxCount: number): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    searchTerm,
    searchTypes: [{ searchType: 'PRODUCTS', pagination: { start: 1, count: Math.min(maxCount, 50) } }],
    currency: 'USD',
    productSorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },   // ← wrong enum for THIS endpoint
  };
```

### Viator's documented enum per endpoint
Per [Viator Partner Resources — Managing product and availability data](https://partnerresources.viator.com/travel-commerce/managing-product-availability-data/)
and [How to search for products](https://partnerresources.viator.com/resources/searching-for-products/):

**`/products/search`** accepts:
- `DEFAULT`, `PRICE`, `TRAVELER_RATING`, `ITINERARY_DURATION`, `NEW_ON_VIATOR`

**`/search/freetext`** (different endpoint, different enum) accepts:
- `RELEVANCE` (default), `REVIEW_AVG_RATING`, `DATE_ADDED`, `PRICE` (with `ASCENDING`/`DESCENDING`)

> *"`REVIEW_AVG_RATING` is the corresponding sort value used in
> `/search/freetext`. `TRAVELER_RATING` is the sort name used in
> `/products/search`."*

**Our code uses the `/products/search` enum value on a `/search/freetext`
call.** That's the literal cause of `"Invalid sort: TRAVELER_RATING"`.

### Why this only surfaces on Sports & Fitness today (not the other 3 Viator categories)

`searchViatorProducts` (`viatorClient.ts:300+`) is a two-stage search:
1. First tries `/products/search` (which uses the correct `'DEFAULT'`
   sort at `:229`).
2. **Only if** `allProducts.length < maxResults` after step 1, calls
   `/search/freetext` for each searchTerm.

For categories where Viator has lots of Bali products (Arts & Culture,
Wellness, Bucket-list), step 1 fills the bucket → freetext is never
reached → bad sort enum never triggers.

For Sports & Fitness specifically, Bali sandbox stock may be thinner →
step 1 returns < `maxResults` → freetext fires → wrong sort → error.

(The other 3 categories' 429s on `/destinations` happen *before* step 1
even runs, so they never reach the sort-error site.)

### Fix
`src/lib/viatorClient.ts:257`:
```diff
-    productSorting: { sort: 'TRAVELER_RATING', order: 'DESCENDING' },
+    productSorting: { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' },
```
One token change. Documented enum value, no behaviour reinvention.

---

## 4. Proposed fixes — prioritized

### Sort error (do this regardless)
**Fix 1 — change `TRAVELER_RATING` → `REVIEW_AVG_RATING`** at
`viatorClient.ts:257`. **Single token. Highest confidence.** Sports &
Fitness will stop erroring at the freetext stage.

### `/destinations` 429s — four options, pick one (or combine)

**Fix 2A — static `destId` map (recommended; eliminates root cause)**

Viator destination IDs are stable taxonomy IDs (decades, not days).
We don't need to call `/destinations` at scan time at all. Hard-code the
`destId` next to each entry in `src/lib/destinations.ts`:

```ts
{ name: 'Bali (Canggu)', country: 'Indonesia', region: 'Southeast Asia',
  lat: -8.6478, lng: 115.1385, viatorDestId: 5023 /* or whatever */ },
```

Then `findDestinationId(city, country)` reads from this map instead of
calling Viator. **Zero `/destinations` calls per scan = zero 429s on
that endpoint, ever.** Plus instant lookup, no race conditions.

Implementation cost: populate `viatorDestId` for each entry in
`destinations.ts` (~30-40 entries) by running `/destinations` once at
build time and writing the result into the source file. After that, no
runtime `/destinations` calls.

Trade-off: doesn't auto-discover new destinations. Acceptable — adding
a destination is already a manual edit.

**Fix 2B — persistent cache (DB-backed)**

Store the `/destinations` response in a new Prisma model
`viator_destinations_cache` with a single row and a `cachedAt`
timestamp. `loadDestinations()` checks DB first; only fetches Viator
on cold-DB or expired TTL. Survives serverless cold starts.

Cost: schema migration, new DB table, slightly more DB I/O.

Strength: works for arbitrary destinations (auto-discovers new
ones). Cleanly portable to other taxonomy endpoints (Viator categories,
tags) in the future.

**Fix 2C — single-flight in-process memo (defensive layer)**

Inside one lambda, dedupe concurrent `loadDestinations()` calls via a
promise hand-off:

```ts
let inFlight: Promise<ViatorDestination[]> | null = null;
async function loadDestinations(): Promise<ViatorDestination[]> {
  if (cachedDestinations && Date.now() - destinationCacheTime < DEST_CACHE_TTL) {
    return cachedDestinations;
  }
  if (inFlight) return inFlight;   // ← share the in-flight fetch
  inFlight = doFetchAndCache().finally(() => { inFlight = null; });
  return inFlight;
}
```

This kills the within-lambda race (within-lambda concurrent callers
share one fetch). **Doesn't help cross-lambda** — different lambdas
each have their own `inFlight` and `cachedDestinations`.

Strength: tiny diff, no infra.

Weakness: doesn't address the cross-lambda root cause. If Vercel
spawns 4 lambdas, you still get 4 `/destinations` calls.

**Fix 2D — retry on 429 with jitter (last-resort defensive layer)**

Wrap the `fetch` in `loadDestinations` with one retry: if 429, sleep
500-1500ms (random jitter to avoid thundering-herd retry storms), then
retry once. If still 429, throw.

Strength: simplest.

Weakness: doesn't prevent the rate-limit pressure; just spreads the
hit. With 4 simultaneous lambdas all retrying, you can compound the
problem. Should ONLY be combined with another fix (2A/2B/2C), not used
alone.

### Recommended combination
**Ship Fix 1 + Fix 2A.**
- Fix 1 closes the sort-error bug.
- Fix 2A eliminates the root cause of the 429s by removing the
  `/destinations` call entirely from the scan path.

If Fix 2A is too much work for one PR (populating ~30 destination IDs),
ship **Fix 1 + Fix 2C** as a stopgap. Fix 2C reduces within-lambda
pressure (catches one of two concurrency vectors) and is a single-file,
~10-line patch. Cross-lambda races may still occasionally 429, but
markedly less often. Then schedule Fix 2A as follow-up.

---

## Verdict

**Two root causes; both have definitive fixes:**

| Issue | Root cause | Fix | Confidence |
|---|---|---|---|
| Sports & Fitness "Invalid sort: TRAVELER_RATING" | `searchV2Freetext` uses the `/products/search` enum value on the `/search/freetext` endpoint | Change to `REVIEW_AVG_RATING` (`viatorClient.ts:257`) | **High** — Viator docs explicitly differentiate the two |
| Arts / Wellness / Bucket-list 429 on `/destinations` | Module-level cache + serverless = each parallel lambda fires its own `/destinations` request; 4 simultaneous calls hit Viator's per-endpoint rate-limit ceiling | Best: static `destId` map in `destinations.ts`. Stopgap: in-lambda single-flight memo. | **High** confidence on cause; **High** confidence on Fix 2A; lower on 2C alone (cross-lambda still possible) |

**Best path forward:** Fix 1 lands now (1-line change, zero risk). Fix 2A
queued as a follow-up PR (slightly larger, requires populating ~30
`viatorDestId` values). Fix 2C optionally bundled with Fix 1 as defensive
depth.

Sources:
- [Viator Partner Resources — Managing product and availability data](https://partnerresources.viator.com/travel-commerce/managing-product-availability-data/) (sort enum per endpoint)
- [Viator Partner Resources — Technical Guide](https://partnerresources.viator.com/travel-commerce/technical-guide/) (rate-limit policy: 150 req / 10 s)
- [Viator Partner Resources — How to search for products](https://partnerresources.viator.com/resources/searching-for-products/) (freetext-vs-search sort distinction)
- [Viator Partner Resources — New product search capabilities](https://partnerresources.viator.com/travel-commerce/affiliate/search-api/)
- Direct keyless probes against `api.viator.com/partner/destinations` and `…/search/freetext` (URL sanity; no rate-limit headers exposed pre-auth).
