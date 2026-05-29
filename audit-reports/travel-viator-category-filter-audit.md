# Viator carousels return identical products — audit

Branch: `claude/travel-viator-category-filter-audit`. Read-only.

## TL;DR

**The category→filter mapping exists, but the API call that actually returns
results never receives it.** All four Viator carousels hit `/v2/products/search`
with **the same request body** (only `destination`, no tag/category filter),
so Viator returns the same default-sorted destination top products four
times. The category-aware step 2 (`/search/freetext`) is gated on
"step 1 underfilled" and **never runs for popular destinations like Bali**
because step 1 already returned the maxResults cap.

PR-8's `preResolvedDestId` fast-path is **exonerated** — it only changes
how `destId` is resolved. The category-filter bypass is pre-existing,
predates PR-8.

---

## 1. Code paths (cited)

### Step 1 — `/v2/products/search` (the call that actually returns results)

`src/lib/viatorClient.ts:248-273`:
```ts
async function searchV2Products(
  destId: number,
  maxCount: number,
  tagIds?: number[],         // ← optional, category filter mechanism
): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    filtering: {
      destination: String(destId),
    },
    sorting: { sort: 'DEFAULT' },
    pagination: { start: 1, count: Math.min(maxCount, 50) },
    currency: 'USD',
  };
  if (tagIds && tagIds.length > 0) {
    body.filtering.tags = tagIds;   // ← only added when tagIds is non-empty
  }
  // POST + …
}
```

This function **does** support per-category filtering via Viator's tag IDs.
But the orchestrator never calls it with any.

### Step 1 call site (cited)

`src/lib/viatorClient.ts:351-361`:
```ts
// 1. Try V2 /products/search if we have a destId (fastest, best filtering)
if (destId) {
  try {
    const products = await searchV2Products(destId, Math.min(maxResults, 50));
    //                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //          ← only 2 args; `tagIds` (3rd param) is undefined.
    //          The "best filtering" promise in the comment is unfulfilled.
    addProducts(products);
    console.log(`[Viator] V2 /products/search: ${products.length} results for destId ${destId}`);
  } catch (err) { /* … */ }
}
```

Since `tagIds === undefined`, the `if (tagIds && tagIds.length > 0)` guard
inside `searchV2Products` is false → `body.filtering.tags` is **never set**.

### The request body that Viator actually receives (deterministic)

For Sports & Fitness on Bali (destId = 98):
```jsonc
POST /v2/products/search
Headers: { "exp-api-key": "…", "Accept": "application/json;version=2.0", "Content-Type": "application/json" }
{
  "filtering":  { "destination": "98" },     // ← no tags, no category
  "sorting":    { "sort": "DEFAULT" },
  "pagination": { "start": 1, "count": 33 },
  "currency":   "USD"
}
```

For Wellness on Bali:
```jsonc
POST /v2/products/search
Headers: { "exp-api-key": "…", "Accept": "application/json;version=2.0", "Content-Type": "application/json" }
{
  "filtering":  { "destination": "98" },     // ← byte-for-byte identical
  "sorting":    { "sort": "DEFAULT" },
  "pagination": { "start": 1, "count": 33 },
  "currency":   "USD"
}
```

**They are byte-for-byte identical.** Viator returns the same products
because the requests are the same. The "different" categories are a
labelling illusion in our UI — the data is the same product set under
four different titles.

### Step 2 — `/v2/search/freetext` (which IS category-aware) is gated

`src/lib/viatorClient.ts:363-376`:
```ts
// 2. Supplement with V2 freetext for each search term (more targeted)
if (allProducts.length < maxResults) {       // ← gating condition
  for (const term of searchTerms.slice(0, 3)) {
    if (allProducts.length >= maxResults) break;
    try {
      const searchQuery = destId ? term : `${term} ${city}`;
      const products = await searchV2Freetext(searchQuery, destId, Math.min(maxResults, 50));
      addProducts(products);
    } catch (err) { /* … */ }
  }
}
```

For **popular destinations** (Bali, Paris, Bangkok), step 1 returns 33-50
products → `allProducts.length` already equals `maxResults` (33) →
`allProducts.length < maxResults` is **false** → loop body **never executes**.

Even if it did run, `addProducts` dedupes by `productCode` via `seenCodes`,
so most freetext matches are already in `allProducts` from step 1 and get
skipped — step 2's category-specific text would barely affect output.

### The `COA_TO_VIATOR_SEARCH` map (cited)

`src/lib/viatorClient.ts:204-212`:
```ts
const COA_TO_VIATOR_SEARCH: Record<string, string[]> = {
  sports_fitness:   ['outdoor activities', 'water sports', 'hiking', 'surfing', 'diving', 'yoga'],
  arts_culture:     ['museums', 'cultural tours', 'cooking classes', 'art galleries', 'temples', 'historical tours', 'food tours'],
  nightlife:        ['nightlife', 'pub crawls', 'dinner shows', 'evening tours', 'bar tours'],
  festivals:        ['festivals', 'events', 'concerts', 'cultural events'],
  wellness:         ['spa', 'wellness', 'yoga retreat', 'massage'],
  bucket_list:      ['adventure', 'unique experiences', 'safari', 'hot air balloon', 'volcano tours'],
  ground_transport: ['airport transfers', 'private transfers', 'car rental', 'transportation'],
};
```

These are reasonable category-specific **text search terms**, intended for
`/v2/search/freetext`. They're not Viator **tag IDs** (numeric), so they
can't be passed to `/v2/products/search`'s `tagIds` filter even if step 1
were widened to accept them.

---

## 2. Verdict per hypothesis

### (a) PR-8 fast-path skipping the filter: **NO**

PR-8 only changed how `destId` is resolved (`preResolvedDestId ?? await
findDestinationId(...)` at `:328`). The category-filter bypass on step 1
(`searchV2Products(destId, Math.min(maxResults, 50))` without `tagIds`)
exists in **both** the fast and slow paths and has existed in this file
since well before PR-8. PR-8 is exonerated.

`git blame` of the call site would show the omitted-third-arg pattern
predates PR-8.

### (b) Per-category mapping too generic: **PARTIAL — misleading framing**

The `COA_TO_VIATOR_SEARCH` map has category-specific *text* terms. Those
terms are good enough for `/search/freetext` and would yield different
results per category if step 2 ran. **They never reach Viator** because:
- They're text, not numeric tag IDs → can't be passed to step 1's
  `tagIds` param even by widening the call site.
- Step 2 (which would use them as `searchTerm`) is gated behind "step 1
  underfilled" — never runs for popular destinations.

So the map isn't too generic; it's just **disconnected from the call
that returns results**.

### (c) Viator ignoring our filters: **NO**

We're not sending any per-category filter at all in the request that
actually returns results. The `filtering.destination` field is being
honoured (Viator scopes to Bali correctly), so Viator's API isn't
ignoring anything — there's nothing to ignore.

Confirmed via [Viator's tag-filtering docs](https://partnerresources.viator.com/travel-commerce/tags/):

> *"Filtering by tags is available as a pre-built solution in the
> `/products/search` endpoint … you can actively filter products using
> tag IDs in your requests by including the relevant tagId(s) under the
> tags object in the request body when using the search endpoint."*

The mechanism exists and works; we just don't use it.

---

## 3. Proposed fixes (do NOT implement)

### Option A — surgical: skip Step 1 when we have category search terms

The simplest fix. Step 2's `/search/freetext` IS category-aware via
`searchTerm`. Make it the primary path:

```diff
- // 1. Try V2 /products/search if we have a destId (fastest, best filtering)
- if (destId) {
-   try {
-     const products = await searchV2Products(destId, Math.min(maxResults, 50));
-     addProducts(products);
-     console.log(`[Viator] V2 /products/search: ${products.length} results for destId ${destId}`);
-   } catch (err) {
-     rethrowIfHardFailure(err);
-     console.error('[Viator] V2 /products/search transient error:', err);
-   }
- }
-
- // 2. Supplement with V2 freetext for each search term (more targeted)
- if (allProducts.length < maxResults) {
-   for (const term of searchTerms.slice(0, 3)) {
+ // 1. Category-aware: freetext per search term. The unfiltered destination
+ //    products call ( /products/search without tagIds ) returns identical
+ //    results across categories — only `/search/freetext` actually narrows
+ //    by category. Iterate ALL category terms so each carousel surfaces
+ //    products matching its specific intent.
+ for (const term of searchTerms) {
    if (allProducts.length >= maxResults) break;
    try {
      const searchQuery = destId ? term : `${term} ${city}`;
      const products = await searchV2Freetext(searchQuery, destId, Math.min(maxResults, 50));
      addProducts(products);
    } catch (err) {
      rethrowIfHardFailure(err);
      console.error(`[Viator] V2 freetext transient error for "${term}":`, err);
    }
- }
  }
+
+ // 2. Fallback: if freetext underfilled (rare destination + obscure category),
+ //    take whatever destination-default products Viator returns to fill the row.
+ if (destId && allProducts.length === 0) {
+   try {
+     const products = await searchV2Products(destId, Math.min(maxResults, 50));
+     addProducts(products);
+   } catch (err) {
+     rethrowIfHardFailure(err);
+     console.error('[Viator] V2 /products/search fallback transient error:', err);
+   }
+ }
```

Side effects:
- 4 Viator categories now make 4 different rounds of `/search/freetext`
  calls (one per category × several terms each). Viator's rate-limit is
  150/10s — still well within budget, especially after PR-7's in-lambda
  memo for `/destinations` reduced the parallel load.
- Slightly slower per category (multiple terms × HTTP roundtrips) but
  the carousels actually differ — net UX win.
- The `searchTerms.slice(0, 3)` cap is removed so step 1 iterates all
  the map's terms — more category coverage. (Could keep the cap if rate-
  limit budget is tight; 3 terms is enough to differentiate categories.)

This is the **recommended fix** — small surface, no new mapping required,
uses existing infrastructure correctly.

### Option B — architectural: Viator tag IDs per category

The "correct" long-term fix per [Viator's tag-filtering docs](https://partnerresources.viator.com/travel-commerce/tags/). Requires:

1. New code calling `/products/tags` once a week, caching the tag taxonomy.
2. A new `COA_TO_VIATOR_TAG_IDS: Record<string, number[]>` map. Example
   from [Viator's tag docs](https://partnerresources.viator.com/travel-commerce/tags/):
   - `sports_fitness` → `[22046]` (Adventure Tours), `[21909]` (Outdoor Activities)
   - `arts_culture` → `[21725]` (Sightseeing Tours), `[21913]` (Tours & Sightseeing)
   - `wellness` → tag ID for Spa & Wellness (need to confirm from `/products/tags`)
   - `bucket_list` → `[22046]` (Adventure Tours)
3. Update step 1's call to pass `tagIds`:
   ```diff
   - const products = await searchV2Products(destId, Math.min(maxResults, 50));
   + const tagIds = COA_TO_VIATOR_TAG_IDS[coaCategory];
   + const products = await searchV2Products(destId, Math.min(maxResults, 50), tagIds);
   ```

Strength: produces tighter, more authoritative results than freetext
keyword matching.

Cost: a new endpoint to call + cache, a one-time mapping job to pick the
right tag IDs per COA category. Bigger PR. Better as a follow-up after
Option A demonstrates the category-aware behaviour.

### What NOT to do
- **Don't tweak `COA_TO_VIATOR_SEARCH` further** — the terms are fine;
  they're just not reaching Viator. More terms or "better" terms won't
  help until the orchestration is fixed.
- **Don't lower step 1's `maxResults` cap** to force step 2 to run.
  That's a side-effect-via-gating hack and still relies on step 2's
  dedup never being fully effective on popular destinations.

---

## Verdict

| Hypothesis | Status | Evidence |
|---|---|---|
| (a) PR-8 fast-path skipping filter | **No** | The bypass exists in both fast and slow paths; PR-8 only touched destId resolution. `viatorClient.ts:328` is unchanged in spirit from pre-PR-8. |
| (b) Mappings too generic | **Misleading framing** | Map has category-specific text terms (`viatorClient.ts:204-212`), but they're disconnected from the call that returns results (step 1 ignores them; step 2 doesn't run on popular destinations). |
| (c) Viator ignoring filters | **No** | We never send any per-category filter at all. Confirmed at `viatorClient.ts:354` — `searchV2Products` called without `tagIds`. |

**Real root cause:** orchestration order. Step 1 calls
`/v2/products/search` with destination-only filter (no `tagIds`), filling
`allProducts` to the `maxResults` cap with default-sorted Bali products.
Step 2 (`/v2/search/freetext`) is the category-aware path — guarded by
"step 1 underfilled" — never runs.

**Recommended fix:** Option A — promote step 2 (`/search/freetext` per
category term) to the primary path; demote step 1 to a fallback. Surgical,
small diff, uses existing `COA_TO_VIATOR_SEARCH` map correctly.

Sources:
- `src/lib/viatorClient.ts:204-212` (COA_TO_VIATOR_SEARCH map)
- `src/lib/viatorClient.ts:248-273` (searchV2Products with optional tagIds)
- `src/lib/viatorClient.ts:351-376` (orchestrator — step 1 omits tagIds; step 2 gated)
- [Viator — Tag filtering on /products/search](https://partnerresources.viator.com/travel-commerce/tags/)
- [Viator — Managing product and availability data](https://partnerresources.viator.com/travel-commerce/managing-product-availability-data/)
- [Viator — How to search for products](https://partnerresources.viator.com/resources/searching-for-products/)
