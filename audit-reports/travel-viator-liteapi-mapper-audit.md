# Travel — Viator toLowerCase + LiteAPI photo/rating mapper audit

Branch: `claude/travel-viator-liteapi-mapper-audit`. Read-only.

Two distinct mapper bugs, both pre-existing but exposed by recent PRs
(PR-5's Viator URL fix unblocked the destinations call; PR-3's LiteAPI
hookup wired the mapper to the wrong response slot).

---

## Bug 1 — Viator `toLowerCase` crash (Sports & Fitness)

### The four `.toLowerCase()` call sites in the Viator path (cited)

Repo-wide grep (`grep -rn "\.toLowerCase()" src/`) returns only **four** sites
in anything reachable from a Viator scan, and they're all inside one function:

```ts
src/lib/viatorClient.ts:91  export async function findDestinationId(cityName: string, ...) {
src/lib/viatorClient.ts:92    const destinations = await loadDestinations();
src/lib/viatorClient.ts:94    const cityLower = cityName.toLowerCase();        ← (1) the input
src/lib/viatorClient.ts:97    let match = destinations.find(d =>
src/lib/viatorClient.ts:98      d.destinationName.toLowerCase() === cityLower  ← (2) the iteration
src/lib/viatorClient.ts:99      && d.destinationType === 'CITY'
src/lib/viatorClient.ts:103   match = destinations.find(d =>
src/lib/viatorClient.ts:104     d.destinationName.toLowerCase().includes(cityLower) ← (3)
src/lib/viatorClient.ts:105     && d.destinationType === 'CITY'
src/lib/viatorClient.ts:110   match = destinations.find(d =>
src/lib/viatorClient.ts:111     d.destinationName.toLowerCase().includes(cityLower) ← (4)
```

Nowhere in the Viator product mapper (`viatorProductToRecommendation` at
`:359-445`) or normaliser (`normalizeV2Product` at `:142-178`) does
`.toLowerCase()` appear — those would crash too if the bug were there.
The crash is unambiguously in `findDestinationId`. Lines `:98 / :104 / :111`
call `.toLowerCase()` on `d.destinationName` for **every destination in
the list** until `find()` matches; if any row has `destinationName ===
undefined`, the callback throws and `find()` propagates the throw.

### Why this surfaced now

- PR-5 fixed the URL (`/v1/taxonomy/destinations` → `/destinations`) so
  `loadDestinations()` now actually returns a 2xx instead of 404. Before
  PR-5, `cachedDestinations` was always `[]` after the 404 fallback
  failed, so `find()` had nothing to iterate and `.toLowerCase()` was
  never reached. Post-PR-5, real destination rows flow through.
- The new V2 `/destinations` response shape: the field names on each
  destination ARE `destinationName` / `destinationType` / `destinationId`
  (per Viator's docs — confirmed via Viator-Partner-API-v2 schema
  references). That part is right. **What isn't guaranteed is that
  every row has a non-null `destinationName`.** Viator's catalog
  includes "areas", "regions", and other taxonomic nodes that may have
  `destinationName: null` (or omitted) on some rows. The code assumes
  every row has the field defined.

### Why Sports & Fitness specifically vs. 429s on the others

The user reported one category crashes with `toLowerCase` and three
hit 429 (rate-limit). With four categories scanning in parallel
(`Promise.allSettled` in `ai-assistant/route.ts`), each independently
calls `loadDestinations` because there's no in-flight-request dedup —
the cache check at `:65-67` only short-circuits AFTER the first
successful return populates `cachedDestinations`. So 4 categories fire
4 destination GETs simultaneously, then each calls `findDestinationId`.

Most plausible interleaving for the observed pattern:
1. Four parallel GETs go out. Viator returns 200 for the fastest
   one and 429s for the others (the "150 req/10s" limit can hit when
   the user has other recent activity in their account).
2. The 3 categories whose GETs got 429 throw `ViatorApiError(...429)`
   → the route maps it → carousel banner shows `Viator API: V2
   /destinations returned 429 …`.
3. The 1 category whose GET succeeded (Sports & Fitness this run)
   populates `cachedDestinations` and proceeds to `findDestinationId`
   → hits a row where `destinationName` is undefined → TypeError →
   route's outer catch returns 500 with `err.message` → banner shows
   `Couldn't load Sports & Fitness — Cannot read properties of
   undefined (reading 'toLowerCase')`.

The "which category gets the 200" is timing-dependent — that's why this
shows up as Sports today and might be a different category on a re-run.
On a fresh scan where Viator's rate limit isn't pressed, **all four
categories will crash on `toLowerCase`** because they'll all proceed
past the destinations GET.

### Proposed one-line fixes (do NOT implement yet — awaiting approval)

`src/lib/viatorClient.ts` — defensive optional-chaining on all four sites,
or (cleaner) filter the bad rows once at load time. Either of these
works:

**Option A — guard each call site:**
```diff
- d.destinationName.toLowerCase() === cityLower &&
+ (d.destinationName ?? '').toLowerCase() === cityLower &&
```
(repeated on `:98, :104, :111` — also makes sense to guard `cityName`
on `:94` even though our code path never passes undefined there).

**Option B — filter once at load:**
```diff
  const data = await res.json();
- cachedDestinations = data.destinations || data.data || [];
+ const raw = data.destinations || data.data || [];
+ cachedDestinations = raw.filter((d: any) => typeof d?.destinationName === 'string');
```
(B is cleaner — single point of defence, surfaces no behavioural surprises
in `findDestinationId`. Recommend B.)

### Latent equivalent bug on other categories

The same path runs identically for **all four Viator categories** —
Arts/Wellness/Bucket-list are not differently exposed; they're just
luckier in today's race. Today's observation is a race-condition slice.
Fix once via option B above and all four are safe.

---

## Bug 2 — LiteAPI photo + rating not populating

### What the mapper reads (cited)

`src/lib/liteapiClient.ts:270-323` (`liteApiHotelToRecommendation`):

```ts
const h = hotel.hotel || {};                              // ← expects `data[].hotel.X`
...
const rawRating = h.rating ?? h.starRating ?? h.stars ?? 0;
const reviewCount = h.reviewCount ?? 0;
...
photoUrl: h.main_photo || h.thumbnail || null,
name:    h.name || 'Hotel',
address: h.address || h.city || '',
summary: (h.hotelDescription || '').replace(/<[^>]*>/g, '').substring(0, 300),
```

And the search parse at `:188`:
```ts
const data = await res.json();
const hotels: LiteApiHotelRate[] = data.data || data.hotels || [];
```

The mapper expects each rate item to carry a nested `hotel` object
(`data[].hotel.name`, `data[].hotel.main_photo`, etc.).

### What LiteAPI actually returns

Per [LiteAPI's rates docs](https://docs.liteapi.travel/reference/post_hotels-rates)
and the [hotel data structure guide](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)
(and confirmed via the npm SDK's surface):

- The `/v3.0/hotels/rates` rate items in `response.data[]` contain
  ONLY rate information — `hotelId`, `roomTypes[]` (with rates,
  cancellation policies, board name, etc.). **There is no `hotel`
  sub-object on each rate item.**
- Hotel metadata (name, main_photo, address, rating, tags, …) lives in
  a **parallel top-level `response.hotels[]` array** when
  `includeHotelData: true` is passed — **and is automatically included
  when searching by `cityName` filter**. The hotels array is keyed by
  `id` (matches `data[].hotelId`).

So the real response shape (when searching by cityName, as we do) is:
```jsonc
{
  "data": [
    { "hotelId": "abc", "roomTypes": [...], "...": "no hotel sub-object here" }
  ],
  "hotels": [
    { "id": "abc", "name": "...", "main_photo": "...", "address": "...",
      "rating": 4.6, "tags": [...], "persona": "...", "style": "..." }
  ]
}
```

### The diff — what we read vs. what's there

| Field | Mapper reads | LiteAPI actually returns | Result today |
|---|---|---|---|
| Name | `data[].hotel.name` | `hotels[i].name` | `'Hotel'` fallback for every card |
| Photo | `data[].hotel.main_photo` / `data[].hotel.thumbnail` | `hotels[i].main_photo` | `null` → placeholder |
| Rating | `data[].hotel.rating` / `.starRating` / `.stars` | `hotels[i].rating` | `0` → `★ —` |
| Reviews | `data[].hotel.reviewCount` | not in rates response | `0` |
| Address | `data[].hotel.address` / `.city` | `hotels[i].address` | empty string |
| Description | `data[].hotel.hotelDescription` | (not on rates response — see hotel-content endpoint) | empty |

This is a wholesale shape mismatch on the hotel metadata, not a per-field
typo. The price IS rendering correctly because that comes from
`data[].roomTypes[].rates[].retailRate.*` — which the rate-extraction
helper (`extractNightlyRate`, `:231-243`) reads correctly.

### Proposed fixes (do NOT implement yet)

Three coupled changes in `src/lib/liteapiClient.ts`:

**1. Send `includeHotelData: true` explicitly** (`:166-174`):
```diff
   const body = {
     cityName: extractCityName(params.city),
     countryCode,
     checkin: params.checkin,
     checkout: params.checkout,
     occupancies: params.occupancies,
     currency: params.currency || 'USD',
     guestNationality: params.guestNationality || 'US',
+    includeHotelData: true,
   };
```
(The docs say it's auto-included for cityName filter — but being
explicit costs nothing and ensures the behaviour if LiteAPI ever
changes the default.)

**2. Merge hotels metadata into each rate before mapping** (`:188-190`):
```diff
   const data = await res.json();
-  const hotels: LiteApiHotelRate[] = data.data || data.hotels || [];
+  const rateItems: LiteApiHotelRate[] = data.data || [];
+  const hotelMeta: Record<string, any> = {};
+  for (const h of data.hotels || []) {
+    if (h?.id) hotelMeta[h.id] = h;
+  }
+  // Attach the parallel-array hotel metadata onto each rate item so the
+  // mapper can keep reading from `hotel.<field>` uniformly.
+  const hotels = rateItems.map(r => ({ ...r, hotel: hotelMeta[r.hotelId] || r.hotel }));
   const max = params.maxResults || 33;
   return hotels.slice(0, max);
```

**3. (Optional)** Update the `LiteApiHotelRate.hotel` interface comment
at `:133-147` to document where the data actually came from (so the
next reader doesn't think it's the original rate-response shape).

That's it — the mapper at `:270+` keeps reading `h.name`,
`h.main_photo`, `h.rating` unchanged.

### Other LiteAPI fields the mapper silently drops (note for a future
data-richness PR — not now)

When `includeHotelData: true` is wired and the merge above lands, LiteAPI
also surfaces (per their docs):
- `tags` — descriptive labels like "beachfront", "boutique"
- `persona` — "business traveler", "family", etc.
- `style` — design / experience descriptor
- `latitude` / `longitude` — coordinates (already in our interface but
  unused in the mapper)
- `chain` / `brand`
- `reviewCount` is actually NOT on the rates+hotels response — for that
  we'd need `/data/reviews/{hotelId}` (separate endpoint, separate call).

These are out of scope for the immediate fix. Flagging for a follow-up
"hotel cards richer" PR.

---

## What's NOT a bug

- `searchableCity()` in `placesSearch.ts` — orthogonal to both bugs
  here; keep it.
- The registry, commit→budget spine, fail-loud machinery — untouched
  by these two issues.
- LiteAPI `extractCityName()` from PR-5 — also keep; orthogonal.

---

## Summary

| | Viator Sports & Fitness | LiteAPI cards |
|---|---|---|
| **Symptom** | `Cannot read properties of undefined (reading 'toLowerCase')` | Cards show name + price, no photo, `★ —` |
| **Root cause file:line** | `viatorClient.ts:98 / :104 / :111` | `liteapiClient.ts:275, 281, 302-309` + parse at `:188` |
| **What's wrong** | `d.destinationName` can be `undefined` on some V2 destination rows; mapper assumes it's always a string | Mapper reads `data[].hotel.X` but LiteAPI returns hotel metadata in a parallel top-level `data.hotels[]` array keyed by `id` |
| **One-line fix** | Filter `cachedDestinations` to rows with `typeof destinationName === 'string'` at load time (option B above) | Add `includeHotelData: true` to body + build `hotelId → meta` map from `data.hotels` and attach as `rate.hotel` before mapping |
| **Why now** | PR-5 fixed the URL; `find()` now actually iterates real rows | PR-3 wired the mapper using a shape that never matched the rates response — undefined hotel metadata silently defaulted to `'Hotel'` / `0` / `null` |
| **Equivalent latent bug elsewhere?** | Same code path runs for all 4 Viator categories — option B fix covers all of them | Single mapper used for every LiteAPI hotel — single fix covers everything |

Sources:
- [Viator Partner API technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/)
- [Viator destinations endpoint references](https://github.com/viator-docs/Viator-Partner-API-v2)
- [LiteAPI — POST /hotels/rates](https://docs.liteapi.travel/reference/post_hotels-rates)
- [LiteAPI — Rate and Hotel Query Guide (includeHotelData)](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI — Hotel Rates API JSON Data Structure](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)
- [LiteAPI — Displaying Essential Hotel Details (parallel `hotels` array)](https://docs.liteapi.travel/docs/displaying-hotel-details)
