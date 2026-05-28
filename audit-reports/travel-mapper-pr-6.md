# Travel-Mapper-PR-6 — Viator toLowerCase guard + LiteAPI hotel metadata merge + Google query diversification

Branch: `claude/travel-mapper-pr-6`. Three surgical fixes, one PR. Bundles
the three audits-diagnosed bugs visible on the post-PR-5 Bali scan into
one commit. Net `+30 / −5` lines across three files.

---

## Fix 1 — Viator `toLowerCase` crash (Sports & Fitness)

### Re-verified on `main`
`src/lib/viatorClient.ts:94 / :98 / :104 / :111` — four `.toLowerCase()`
sites, all inside `findDestinationId`. Lines `:98 / :104 / :111` call
`.toLowerCase()` on `d.destinationName` for every row during
`Array.find()` iteration; Viator's V2 `/destinations` catalog includes
taxonomic nodes where `destinationName` is null or missing, so any
unguarded iteration crashes the entire scan with:
> `Cannot read properties of undefined (reading 'toLowerCase')`

### Fix
Option B from the audit — filter once at load (single point of defence,
no per-call-site changes downstream). `src/lib/viatorClient.ts:78-89`:

```diff
   const data = await res.json();
-  cachedDestinations = data.destinations || data.data || [];
-  destinationCacheTime = Date.now();
-  console.log(`[Viator] Loaded ${cachedDestinations!.length} destinations (V2 /destinations)`);
+  // Filter at load time: Viator's V2 destinations catalog includes a few
+  // taxonomic nodes (regions, "areas") where `destinationName` is null or
+  // missing. The downstream `findDestinationId` calls `.toLowerCase()` on
+  // every row during `Array.find()` iteration — one bad row crashes the
+  // whole search with "Cannot read properties of undefined (reading
+  // 'toLowerCase')". Drop the unusable rows here, log the count for
+  // visibility, and never assume `destinationName` is a string downstream.
+  const raw: unknown[] = data.destinations || data.data || [];
+  const usable = raw.filter((d): d is ViatorDestination =>
+    typeof d === 'object' && d !== null &&
+    typeof (d as { destinationName?: unknown }).destinationName === 'string'
+  );
+  const skipped = raw.length - usable.length;
+  cachedDestinations = usable;
+  destinationCacheTime = Date.now();
+  console.log(
+    `[Viator] Loaded ${usable.length} destinations (V2 /destinations)` +
+    (skipped > 0 ? ` — skipped ${skipped} rows with missing destinationName` : '')
+  );
```

### No-silent-fallback compliance
The filter is **not** a silent swallow — rows are visibly counted +
logged with `skipped`. A row without `destinationName` is genuinely
unusable for `findDestinationId` (we match by name); dropping it is the
right semantic. Real auth/network errors still throw (the outer `try/
catch` is unchanged).

### Other toLowerCase exposures in the Viator path
Repo-wide grep confirms `.toLowerCase()` calls in the Viator chain are
ONLY at `viatorClient.ts:94 / :98 / :104 / :111` (all in
`findDestinationId`) and `travelCOA.ts:257` (`cat.label.toLowerCase()`
for the Google-path fallback — not on Viator's path, `cat` is always
defined when `getCOAScanQueries` is called via the route). The product
normalizers (`normalizeV2Product`) and mapper
(`viatorProductToRecommendation`) contain zero `.toLowerCase()` calls,
verified post-fix:
```
$ grep -n "\.toLowerCase()" src/lib/viatorClient.ts
104:  const cityLower = cityName.toLowerCase();
108:    d.destinationName.toLowerCase() === cityLower &&
114:      d.destinationName.toLowerCase().includes(cityLower) &&
121:      d.destinationName.toLowerCase().includes(cityLower)
```
(`cityName.toLowerCase()` at the new line 104 — was 94; the route always
passes a non-empty string per its body-validation, so guard would be
defence-in-depth, not necessary today.) **All three `d.destinationName`
sites are now guaranteed safe because the load-time filter excludes any
row where `destinationName` isn't a string.**

---

## Fix 2 — LiteAPI hotel photo + rating mapping

### Re-verified on `main`
`src/lib/liteapiClient.ts:188` — parse picks `data.data || data.hotels ||
[]`. The mapper at `:270+` reads `hotel.hotel?.name`, `hotel.hotel?.main_photo`,
`hotel.hotel?.rating` (nested under each rate item). **But LiteAPI's
`/v3.0/hotels/rates` response** ([docs](https://docs.liteapi.travel/docs/rate-request-parameters-guide)):

- `data.data[]` rate items carry **only** `hotelId` + `roomTypes[]` —
  no `hotel` sub-object.
- `data.hotels[]` is a **parallel top-level array** keyed by `id` with
  `name`, `main_photo`, `address`, `rating`, `tags`, etc. — included
  automatically when searching by `cityName` filter (or when
  `includeHotelData: true` is set).

Today the mapper reads from a sub-object that doesn't exist → every card
defaults to `name = 'Hotel'`, `photoUrl = null`, `googleRating = 0` →
the user sees "Hotel · ★ —" with the placeholder image.

### Fix — two coupled changes in `src/lib/liteapiClient.ts`

**(a) Be explicit about `includeHotelData` (`:166-178`):**
```diff
   const body = {
     cityName: extractCityName(params.city),
     countryCode,
     checkin: params.checkin,
     checkout: params.checkout,
     occupancies: params.occupancies,
     currency: params.currency || 'USD',
     guestNationality: params.guestNationality || 'US',
+    // Per LiteAPI's docs (Rate-and-Hotel-Query guide), hotel metadata (name,
+    // photo, address, rating, tags) is included when this flag is true. Auto-
+    // enabled for cityName filter, but we pass it explicitly so the behaviour
+    // never silently changes if LiteAPI flips the default.
+    includeHotelData: true,
   };
```

**(b) Merge the parallel `hotels[]` array into each rate item by `hotelId`
before returning** (`:192-211`):
```diff
   const data = await res.json();
-  const hotels: LiteApiHotelRate[] = data.data || data.hotels || [];
+
+  // LiteAPI returns rate items in `data.data[]` (each carries `hotelId` +
+  // `roomTypes[]` only) and hotel metadata in a PARALLEL `data.hotels[]`
+  // array, keyed by `id`. The mapper at `liteApiHotelToRecommendation`
+  // reads from `rate.hotel.<field>`, so we merge the parallel array onto
+  // each rate item here. Without this merge, every card defaults to
+  // name = "Hotel", photo = placeholder, rating = "★ —".
+  const rateItems: LiteApiHotelRate[] = data.data || [];
+  const hotelMetaById: Record<string, NonNullable<LiteApiHotelRate['hotel']>> = {};
+  for (const h of (data.hotels || []) as Array<{ id?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
+    if (h && typeof h.id === 'string') hotelMetaById[h.id] = h;
+  }
+  const merged: LiteApiHotelRate[] = rateItems.map(r => {
+    const meta = hotelMetaById[r.hotelId];
+    if (!meta) return r;
+    // Merge: keep any sub-fields already present on `r.hotel`, but fill in
+    // the metadata we just looked up.
+    return { ...r, hotel: { ...meta, ...(r.hotel || {}) } };
+  });
+
   const max = params.maxResults || 33;
-  return hotels.slice(0, max);
+  return merged.slice(0, max);
```

The mapper at `liteapiClient.ts:270+` (which reads `h.name`,
`h.main_photo`, `h.rating`, etc.) is **unchanged** — it now finds the
data where it expects to.

### Pure mismatch vs sandbox thinness?
**Pure field-name mismatch.** LiteAPI's docs explicitly document the
parallel `hotels[]` array layout. The mapper's defaults are already
null-safe (`h.name || 'Hotel'`, `h.main_photo || h.thumbnail || null`,
`h.rating ?? h.starRating ?? h.stars ?? 0`), so even if a specific
hotel in sandbox returns null for `main_photo` (and many do), the card
still renders without crashing — the user just sees the placeholder
for that one hotel, while others populate normally.

### Latent issues elsewhere
Single mapper used for every LiteAPI hotel. One fix covers everything.
Other LiteAPI fields surfaced but currently dropped by the mapper —
`tags`, `persona`, `style`, `latitude`/`longitude`, `chain`/`brand` —
flagged as out-of-scope for a future "richer hotel cards" PR.

---

## Fix 3 — Google `INVALID_REQUEST` on 4 categories

### Re-verified on `main`
`src/lib/travelCOA.ts:55, 88, 100, 124` — four `scanQueries` fields
with bare Place-Type slugs (`brunch`, `bakery`, `market`, `pharmacy`)
or empty arrays that fall back to single-word labels (`coworking`).
Per [Google's Place Type list](https://developers.google.com/maps/documentation/places/web-service/supported_types),
those bare strings are valid Place-Type names — and Google's
text-search NL parser appears to reject the request when a query is a
bare Place-Type combined with `location`+`radius` (confirmed by the
working/failing split: Dinner's multi-word qualifiers like `dinner
restaurant` work; bare `bakery` does not).

### Fix — diversify the four failing categories' `scanQueries`

```diff
   brunch_coffee:
-    scanQueries: ['brunch', 'breakfast cafe', 'coffee shop', 'bakery', 'specialty coffee'],
+    // Multi-word queries only — Google's text-search NL parser rejects bare
+    // Place-Type slugs ("brunch", "bakery") when combined with location+radius.
+    // Per audit-reports/travel-invalid-request-audit-v2.md.
+    scanQueries: ['brunch restaurant', 'breakfast cafe', 'coffee shop', 'bakery cafe', 'specialty coffee'],
```

```diff
   nightlife:
     googlePlacesType: 'bar',
-    scanQueries: [],
+    // Empty scanQueries used to fall back to the label "nightlife & entertainment";
+    // explicit multi-word queries avoid the Place-Type-slug parser quirk
+    // (per audit-reports/travel-invalid-request-audit-v2.md).
+    scanQueries: ['nightlife venue', 'bar cocktail', 'live music club'],
     interestSlugs: ['clubs', 'rooftop_bars', 'live_music', 'jazz', 'comedy', 'dinner_shows'],
```

```diff
   coworking:
     googlePlacesType: null,
-    scanQueries: [],
+    // Empty scanQueries used to fall back to the bare label "coworking" —
+    // a single content word Google's NL parser sometimes rejects with
+    // INVALID_REQUEST (per audit-reports/travel-invalid-request-audit-v2.md).
+    scanQueries: ['coworking space', 'coworking office', 'shared workspace'],
     interestSlugs: ['day_pass', 'weekly_desk', 'nomad_community'],
```

```diff
   shopping:
-    scanQueries: ['shopping mall', 'market', 'convenience store', 'pharmacy'],
+    // `market` and `pharmacy` are bare Google Place-Type slugs — substituting
+    // multi-word qualifiers per audit-reports/travel-invalid-request-audit-v2.md.
+    scanQueries: ['shopping mall', 'local market', 'convenience store', 'pharmacy drugstore'],
```

Every new query is multi-word and none is a bare Place-Type slug —
mirrors Dinner's working pattern. PR-4's `Promise.allSettled` per-query
isolation already in place: even if one query slips through, the
others still populate the carousel.

---

## Constraints verified

```
$ for f in prisma/schema.prisma src/lib/travelSourceRegistry.ts \
           src/app/api/trips/[id]/vendor-commit/route.ts \
           src/components/trips/TripCreationBar.tsx \
           src/app/budgets/trips/new/page.tsx \
           src/app/api/trips/route.ts \
           src/components/trips/TripPlannerAI.tsx \
           src/app/api/trips/[id]/ai-assistant/route.ts; do
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
```

- Shape, registry, commit→budget spine, traveler-count plumbing, route
  dispatch, and the PR-4 carousel UI all untouched.
- PR-1 fail-loud handling preserved — both Viator and LiteAPI still throw
  the same typed errors; the Viator filter is a per-row data hygiene
  step, not an error-swallow.
- `searchableCity()` (PR-4 / Brunch parens fix) and `extractCityName()`
  (PR-5 / LiteAPI cityName fix) — both untouched.
- No new provider clients added.

---

## tsc + lint

- `npx tsc --noEmit` → **exit 0.**
- Lint baseline on the three touched files: 8 errors → after PR-6: 8
  errors. **Zero new errors introduced.** The remaining 8 are
  pre-existing `@typescript-eslint/no-explicit-any` on
  `normalizeV2Product` / `searchV2Products` / `searchV2Freetext`
  (V2 response parsing — same baseline shape as PR-5). Repo's
  `next.config.ts` has `eslint.ignoreDuringBuilds: true`.

---

## Expected behaviour after merge

**Viator (Sports & Fitness):** the load-time filter drops the bad
destination rows once, logs `skipped N rows with missing destinationName`,
and `findDestinationId` walks the clean list without crashing. Other
Viator categories (Arts / Wellness / Bucket-list / Ground Transport via
Mozio's "coming soon" path) keep their existing behaviour. If Viator
rate-limits a parallel categories scan (the audit's concurrent-call
hypothesis), individual 429s remain visible per category via PR-1's
fail-loud — they're a separate concern.

**LiteAPI (Accommodation):** hotel cards render with real names,
`main_photo` images (where LiteAPI provided one — some sandbox properties
genuinely don't ship a photo), real `rating` (0-5 scale, normalised by
the existing mapper), and real addresses. `liteapiOfferId` continues to
gate the Reserve button as before.

**Google (Brunch / Nightlife / Coworking / Shopping):** all four
carousels populate with real Google Places data. The "Couldn't load X
— Google Places API: INVALID_REQUEST" banner disappears for these
categories. Dinner + Conferences continue to work unchanged.

---

## Changeset

```
 A audit-reports/travel-mapper-pr-6.md       (this report)
 M src/lib/liteapiClient.ts                  (+22 / -2)
 M src/lib/travelCOA.ts                      (+16 / -4)
 M src/lib/viatorClient.ts                   (+15 / -3)
```

Sources:
- `audit-reports/travel-invalid-request-audit-v2.md` (commit `9efe7fab` on `main`)
- `audit-reports/travel-viator-liteapi-mapper-audit.md` (audit branch)
- [LiteAPI — Rate and Hotel Query Guide (`includeHotelData`)](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI — Displaying Essential Hotel Details (parallel `hotels` array)](https://docs.liteapi.travel/docs/displaying-hotel-details)
- [Viator Partner API technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/)
- [Google Places — Supported place types (the slug list)](https://developers.google.com/maps/documentation/places/web-service/supported_types)
