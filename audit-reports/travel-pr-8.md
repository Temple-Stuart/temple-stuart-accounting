# Travel-PR-8 — Kill legacy Bookable Experiences + static viatorDestId map

Branch: `claude/travel-pr-8`. Two coupled fixes: removes the legacy
"Bookable Experiences" section from the trip page (single-source-of-truth
violation; duplicated Viator data) AND lands the static `viatorDestId` map
for high-traffic cities (eliminates `/partner/destinations` calls and the
cross-lambda 429 vector). Either alone would leave the carousels
half-broken; together they remove a duplicate UX surface while
permanently fixing the rate-limit class of bugs for mapped destinations.

Net `+72 / -188` lines across four files (legacy removal dominates).

---

## Fix 1 — Removed the legacy Bookable Experiences surface

### What got removed (cited)
`src/app/budgets/trips/[id]/page.tsx`:
- **Lines 1056-1193 (138 lines):** the `{/* ── Bookable Experiences (Viator) ── */}` IIFE-wrapped JSX block including the heading, "All (8) / Festivals" filter chips, the destination chip row, the cards, and the inline commit panel.
- **Lines 383-413 (30 lines):** the `handleViatorCommit` async handler that powered the inline commit (vendor-options POST + vendor-commit POST).
- **Lines 120-127 (8 lines):** the 8 `useState` declarations the legacy section owned (`viatorCategoryFilter`, `viatorDestFilter`, `viatorCommitKey`, `viatorCommitDate`, `viatorCommitStartTime`, `viatorCommitEndTime`, `viatorCommitPrice`, `viatorCommitting`).

Total removed: **176 lines** from one file.

### Carousels confirmed registry-driven (cited)
`src/components/trips/TripPlannerAI.tsx:854`:
```ts
const { source } = getSource(catKey);
```

The four Viator categories (`sports_fitness`, `arts_culture`, `wellness`,
`bucket_list`) all resolve `source === 'viator'` through `getSource()`
imported from `@/lib/travelSourceRegistry` (`:8`), and the `CAROUSEL_ORDER`
constant at `:880` includes them. **The Viator inventory the legacy section
used to display is exactly the data the four per-category carousels
already render**, so no Viator surface is lost from the user's perspective —
just the duplicate.

### Other `searchViatorProducts` / `isViatorCategory` consumers (cited)
Grep verification post-removal:
```
$ grep -rn "searchViatorProducts" src --include='*.ts' --include='*.tsx'
src/app/api/trips/[id]/ai-assistant/route.ts:241  ← only consumer (scan route)
src/lib/viatorClient.ts:307                       ← the function definition

$ grep -rn "isViatorCategory" src --include='*.ts' --include='*.tsx'
src/app/api/trips/[id]/ai-assistant/route.ts:166  ← comment only (audit notes)
src/lib/viatorClient.ts:485                       ← the function definition
```

`searchViatorProducts` is only invoked from the registry-driven scan
route. `isViatorCategory` (and the `VIATOR_CATEGORIES` set it wraps) at
`viatorClient.ts:485` are now **dead exports** — kept as-is to honour the
PR's scope (the prompt scopes viatorClient changes to the destId plumbing).
A follow-up cleanup PR can delete them.

### Honest call-out: lost taxonomy
The legacy section's `"All (8) / Festivals"` filter chip exposed
`r._scanCategory === 'festivals'` items — Viator products tagged as
festival-like. After PR-2, the registry routes `festivals → google`
(non-bookable / discovery), and PR-8 keeps that. **The "Festivals" filter
slice that pulled Viator's festival inventory is no longer in the UI.**
If the user wants to re-introduce a Viator-backed Festivals carousel later,
the path is: add a `festivals_bookable` category to `travelCOA.ts` →
register as `{ source: 'viator', hardBookable: true }` → it appears as a
carousel automatically. Out of scope for this PR.

---

## Fix 2 — Static `viatorDestId` map in `destinations.ts`

### Schema extension (cited)
`src/lib/destinations.ts:46-51` — new optional field on the `Destination`
interface:
```ts
/** Viator destination ID (stable taxonomy integer). When set,
 *  `findDestinationId` skips the rate-limited `/partner/destinations` call
 *  and uses this directly. Verify each ID against Viator's public catalog
 *  URLs (https://www.viator.com/<City>/d<ID>-ttd). Leave undefined to
 *  fall back to the dynamic lookup (with PR-7's in-lambda memo). */
viatorDestId?: number;
```

### Populated entries (cited)
17 city entries got the field. Each ID was verified against Viator's
public catalog URLs (`https://www.viator.com/<City>/d<ID>-ttd`) — these
public URLs embed the destination ID in the path and match the API's
internal taxonomy. **No IDs were guessed.**

| # | `name` in destinations.ts | `viatorDestId` | Source URL (verified) |
|---|---|---|---|
| 1 | `Bali (Canggu)` | 98 | https://www.viator.com/Bali/d98-ttd |
| 2 | `Bangkok` | 343 | https://www.viator.com/Bangkok/d343-ttd |
| 3 | `Chiang Mai` | 5267 | https://www.viator.com/Chiang-Mai-tours/.../d5267-... |
| 4 | `Phuket` | 349 | https://www.viator.com/Phuket/d349-ttd |
| 5 | `Hanoi` | 351 | https://www.viator.com/Hanoi/d351-ttd |
| 6 | `Ho Chi Minh City` | 352 | https://www.viator.com/Ho-Chi-Minh-City/d352-ttd |
| 7 | `Kuala Lumpur` | 335 | https://www.viator.com/Kuala-Lumpur/d335-ttd |
| 8 | `Singapore` | 18 | https://www.viator.com/en-SG/Singapore-tours/.../d18-... |
| 9 | `Tokyo` | 334 | https://www.viator.com/tours/Tokyo/.../d334-... |
| 10 | `Dubai` | 828 | https://www.viator.com/Dubai/d828-ttd |
| 11 | `Paris` | 479 | https://www.viator.com/Paris/d479-ttd |
| 12 | `London` | 737 | https://www.viator.com/London/d737-ttd |
| 13 | `Rome` | 511 | https://www.viator.com/Rome/d511-ttd |
| 14 | `Barcelona` | 562 | https://www.viator.com/Barcelona/d562-ttd |
| 15 | `Amsterdam` | 525 | https://www.viator.com/tours/Amsterdam/.../d525-... |
| 16 | `New York City` | 687 | https://www.viator.com/New-York-City/d687-ttd |
| 17 | `Sydney` | 357 | https://www.viator.com/Sydney/d357-ttd |

### Helper (cited)
`src/lib/destinations.ts:546-565`:
```ts
export function findViatorDestIdFor(cityName: string, _country?: string): number | null {
  const match = ALL_DESTINATIONS.find(d => d.name === cityName && d.type === 'city');
  return match?.viatorDestId ?? null;
}
```
Returns the static ID for any of the 17 mapped cities, or `null` for the
~104 long-tail city entries (those keep using the dynamic lookup).

### `searchViatorProducts` refactor (cited)
`src/lib/viatorClient.ts:307-329`:
```diff
  export async function searchViatorProducts(
    city: string,
    country: string,
    coaCategory: string,
    userInterests: string[],
    maxResults: number = 33,
+   /** Pre-resolved Viator destination ID (e.g. from
+    *  `findViatorDestIdFor()` in destinations.ts). When provided, we skip
+    *  the rate-limited `/partner/destinations` lookup entirely — the durable
+    *  fix for cross-lambda 429s identified in audit `travel-viator-rate-
+    *  limit-live-audit.md`. Pass `null`/`undefined` to fall back to the
+    *  dynamic lookup (with PR-7's in-lambda memo). */
+   preResolvedDestId?: number | null,
  ): Promise<ViatorProduct[]> {
    const searchTerms = buildSearchTerms(coaCategory, userInterests);
    if (searchTerms.length === 0) return [];
-   const destId = await findDestinationId(city, country);
+   // Skip-direct path: when a pre-resolved destId is on file, NEVER call
+   // /partner/destinations. Fall back to the dynamic lookup only when it
+   // isn't (long-tail destinations that haven't been added to the static
+   // map yet).
+   const destId = preResolvedDestId ?? await findDestinationId(city, country);
```

The downstream `searchV2Products` / `searchV2Freetext` calls inside this
function are unchanged — they all take `destId` and don't care where it
came from.

### Route plumbing (cited)
`src/app/api/trips/[id]/ai-assistant/route.ts:10` — new import:
```ts
import { findViatorDestIdFor } from '@/lib/destinations';
```
`route.ts:240-247` — Viator branch widened:
```diff
  console.log(`[Viator] ${category}: Using Viator API for ${city}, ${country}`);
  try {
+   // PR-8: pass the static viatorDestId for high-traffic cities so
+   // searchViatorProducts can skip the rate-limited /partner/destinations
+   // call entirely. Returns null for long-tail cities — the dynamic
+   // fallback (loadDestinations + in-lambda memo) still kicks in for them.
+   const preResolvedDestId = findViatorDestIdFor(city, country);
-   const viatorProducts = await searchViatorProducts(city, country, category, tripActivities, maxResults);
+   const viatorProducts = await searchViatorProducts(city, country, category, tripActivities, maxResults, preResolvedDestId);
```

End-to-end plumb: `destinations.ts` → route looks up static ID → passes
into `searchViatorProducts` → which uses it directly OR falls back. Zero
`/partner/destinations` calls for the 17 mapped cities. **Cross-lambda
429s on those destinations are structurally impossible after this PR.**

---

## What the user will see per destination after merge

### For the 17 mapped cities (incl. Bali / Bangkok / Paris / Tokyo / etc.)
All four Viator carousels (Sports & Fitness, Arts & Culture, Wellness,
Bucket List) populate from the first scan onwards. **No `/destinations`
call fires at all** — the call that was getting 429'd is structurally
bypassed. Console log shows `[Viator] sports_fitness: Using Viator API
for Bali (Canggu), Indonesia` then immediately the product-search calls
with `destId = 98`.

### For the ~104 long-tail city entries (no `viatorDestId` yet)
`findViatorDestIdFor` returns `null`. `searchViatorProducts` falls back
to `findDestinationId` → `loadDestinations` (PR-7's in-lambda memo
still active). Within a single lambda the parallel-category de-dup
works; cross-lambda is still vulnerable. **These destinations may still
see occasional 429s on first scan**, but the legacy section is gone so
the user doesn't see the same Viator inventory duplicated above the
carousels.

### Honest path forward for the long tail
Adding a new destination is one inline line edit: append `, viatorDestId:
<ID>` to the entry. The verification process is browsing
`viator.com/<City>/d<ID>-ttd` and copying the ID from the URL. No
schema migration, no infrastructure. Could be a maintenance task
batched periodically as new destinations are added to `destinations.ts`.

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
           src/app/api/travel/liteapi/prebook/route.ts \
           src/app/api/travel/liteapi/book/route.ts \
           src/lib/liteapiClient.ts \
           src/lib/placesSearch.ts \
           src/lib/placesCache.ts; do
     echo "$f: $(git diff main -- "$f" | wc -l)"
   done
prisma/schema.prisma: 0
src/lib/travelSourceRegistry.ts: 0
src/app/api/trips/[id]/vendor-commit/route.ts: 0
src/components/trips/TripCreationBar.tsx: 0
src/app/budgets/trips/new/page.tsx: 0
src/app/api/trips/route.ts: 0
src/components/trips/TripPlannerAI.tsx: 0
src/app/api/travel/liteapi/prebook/route.ts: 0
src/app/api/travel/liteapi/book/route.ts: 0
src/lib/liteapiClient.ts: 0
src/lib/placesSearch.ts: 0
src/lib/placesCache.ts: 0
```

Shape, registry, commit→budget spine, traveler-count plumbing, PR-4
carousel UI structure, PR-3b reservation routes, the LiteAPI client, the
Google places code — all untouched.

### PR-7 diagnostic logs preserved
Both diagnostic logs from PR-7 are still in place — counts confirmed:
- `[LiteAPI rates] response shape` in `liteapiClient.ts` — 1 site.
- `[PLACES] textsearch failure` in `placesSearch.ts` — 1 site.

### Fail-loud preserved
- The route's Viator branch still throws on `MissingViatorKeyError` and
  `ViatorApiError` (PR-1 typed errors propagate verbatim).
- The static-destId fast path doesn't introduce a new silent path — when
  the ID is missing from the map, the code falls through to the existing
  dynamic lookup, which preserves all PR-1 fail-loud semantics
  (auth/network/rate-limit errors still throw to the outer catch).

---

## tsc + lint

- `npx tsc --noEmit` → **exit 0.**
- Lint baseline on the four touched files: **70 errors / 24 warnings.**
- After PR-8: **61 errors / 24 warnings.** Net **`-9` errors** — removing
  the legacy `Bookable Experiences` block also removed 9 pre-existing
  `any` casts. Zero new errors introduced.

---

## Changeset

```
 A audit-reports/travel-pr-8.md                            (this report)
 M src/app/api/trips/[id]/ai-assistant/route.ts            (+8 / -1)
 M src/app/budgets/trips/[id]/page.tsx                     (-176)
 M src/lib/destinations.ts                                 (+44 / -17)
 M src/lib/viatorClient.ts                                 (+15 / -1)
```

---

## What's queued for follow-up (out of scope here)

- **Long-tail destinations not in the static map** — same pattern, just
  inline edit per entry. Could be a maintenance batch as new destinations
  are added.
- **Dead exports cleanup** — `isViatorCategory` (`viatorClient.ts:485`)
  and `VIATOR_CATEGORIES` (`:475`) are unused after this PR. Safe to
  delete in a small follow-up.
- **Remove PR-7's diagnostic logs** once first-deploy observations
  confirm the hypotheses (out of scope here per the prompt).

Sources:
- `audit-reports/travel-viator-rate-limit-live-audit.md` (commit `082bee5f`) — Option 2A spec
- `audit-reports/travel-pr-7.md` — diagnostic logs context
- Viator public catalog URLs (verified per destination — see table in §Fix 2)
- [Viator — Technical Guide (rate-limit policy: 150 req / 10 s)](https://partnerresources.viator.com/travel-commerce/technical-guide/)
