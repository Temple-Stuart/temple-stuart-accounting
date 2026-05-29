# Travel PR-9 — Five-Fix Bundle

**Branch:** `claude/travel-pr-9`
**Scope:** Viator orchestration reversal · `sports_fitness → adventure` rename ·
intent-specific search terms · 250-result/category cap with pagination ·
LiteAPI coordinate-based search.
**Spirit:** "no gatekeeping, by god for the people" — open the floodgates so
each carousel surfaces distinct, intent-matched inventory instead of the same
generic city-tour pool.

## Files Touched

| File | Lines | Purpose |
|---|---|---|
| `src/lib/viatorClient.ts` | +71 / −30 | Fix 1 (orchestration), 2 (rename in set), 3 (terms), 4 (pagination) |
| `src/lib/liteapiClient.ts` | +46 / −12 | Fix 5 (coordinate-radius search) |
| `src/lib/destinations.ts` | +14 / 0 | `findDestinationCoords` helper |
| `src/lib/travelCOA.ts` | +3 / −3 | Fix 2 (rename in COA + alias) |
| `src/lib/travelCategories.ts` | +6 / −5 | Fix 2 (rename in legend + category map) |
| `src/lib/travelSourceRegistry.ts` | +1 / −1 | Fix 2 (rename in registry) |
| `src/components/trips/TripPlannerAI.tsx` | +1 / −1 | Fix 2 (rename in carousel order) |
| `src/app/api/trips/[id]/ai-assistant/route.ts` | +13 / −6 | Fix 4 (viatorMax=250) + Fix 5 (plumb coords) |

## Fix 1 — Viator orchestration reversal

### Diagnosis (per `audit-reports/travel-viator-category-filter-audit.md`)

`searchViatorProducts` previously executed `/products/search` *first*, which
returns Viator's destination-wide product pool unfiltered. Because every
category started with the *same* pool, the per-category freetext step (gated
by `allProducts.length < maxResults` and capped at `slice(0, 3)` terms) rarely
ran for popular destinations — so every carousel rendered the same top 33.

### Change (`viatorClient.ts:351-410`)

- **PRIMARY** is now `/search/freetext` per intent-specific term, paginated.
- **FALLBACK** is `/products/search` (broadcast, paginated) — only fires when
  freetext returned **zero** results (e.g. a niche category with no inventory
  for this destination).
- No-`destId` branch unchanged in spirit (city-suffixed freetext) — kept so
  long-tail user-typed cities still work.

### Why the failure mode flips

Each carousel now starts with **its own** keyword search; only carousels that
literally find nothing fall back to the destination-wide cast. The four Viator
categories will surface inventory that actually matches their intent.

## Fix 2 — `sports_fitness → adventure` rename

Six files updated; ten code-level references replaced. The COA key change is
the source of truth; the alias map keeps any pre-existing `sports_fitness`
keys in `trip_events.source` resolving to the new `adventure` legend group.

### Migration of legacy rows

Existing `trip_scanner_results` / `places_cache` rows keyed by
`'sports_fitness'`: **leave them**. Rationale:

1. `trip_scanner_results` is per-trip-per-destination-per-category — new
   scans simply write to the new `adventure` row; old rows just go unread
   (next scan upserts on a new composite key).
2. `places_cache` has its own TTL (24h-7d depending on entry) and ages out
   naturally.
3. No user-visible data lives in those rows; nothing breaks if they linger.

No data migration script ships with this PR.

### Aliases preserved

`travelCategories.ts:31-32` keeps both `sportsFitness: 'adventure'` and
`sports_fitness: 'adventure'` so any persisted event source or legacy URL
parameter still resolves to the new category. Same applies to
`travelCOA.ts:332` (calendar source config aliases `activities` /
`activity` → `'adventure'`).

## Fix 3 — Intent-specific, non-overlapping search terms

`viatorClient.ts:204-212` replaces the old broad-term map. Three terms per
category, chosen so different carousels return different inventory:

```ts
adventure:    ['surfing lesson', 'diving snorkeling', 'hiking trek']
arts_culture: ['temple tour', 'cultural show', 'traditional dance']
wellness:     ['yoga class', 'spa massage', 'meditation retreat']
bucket_list:  ['private day tour', 'luxury experience', 'multi day tour']
```

The dropped categories (`nightlife`, `festivals`, `ground_transport`) are no
longer routed to Viator in `SOURCE_BY_CATEGORY` — they were dead entries.
`VIATOR_CATEGORIES` set updated to match.

## Fix 4 — 250-result cap per category, paginated

### Search-side (viatorClient.ts)

- `searchV2Products` and `searchV2Freetext` now both accept a `start` param
  (default 1). Each Viator V2 endpoint caps `count` at 50 per page; the
  orchestrator drives pagination at 50/page.
- Per-term loop in the orchestrator paginates until: `allProducts.length >=
  maxResults`, an empty page, or a short page (< PAGE_SIZE).
- Across-term loop short-circuits as soon as cap is reached.

### Route-side (`ai-assistant/route.ts:248`)

Bumped the Viator branch to `viatorMax = Math.max(maxResults, 250)` —
client-passed values below 250 are floored up; >250 is honoured. The final
`.slice(0, viatorMax)` matches so the UI receives the full pool.

### Call budget

Worst case: ~5 pages × 3 terms × 4 categories ≈ **60 calls per scan**.
Viator's documented limit is 150 req / 10s, so a single scan fits inside one
rolling window even sequentially. (Per-category isolation is already enforced
by the registry-dispatch + per-category `Promise.allSettled` upstream.)

## Fix 5 — LiteAPI coordinate-radius search

### Diagnosis (per `audit-reports/travel-accommodation-thin-audit.md`)

LiteAPI's `cityName` filter is brittle for parenthesised labels (e.g.
`"Bali (Canggu)"`) and city/neighborhood ambiguity. `extractCityName`
strips the parens, but the resulting `"Canggu"` doesn't always match
LiteAPI's catalog spelling, returning zero hotels.

### Change

- `SearchHotelsParams` gains optional `latitude`, `longitude`, and
  `radiusMeters` (default `25_000`).
- When lat/lng are passed, the request body uses `(latitude, longitude,
  radius, countryCode)` instead of `cityName` — LiteAPI's documented
  geosearch path.
- `findDestinationCoords(city, country)` helper added to `destinations.ts`,
  reading the existing `lat` / `lng` fields on `ALL_DESTINATIONS` entries.
- Route plumbs coords into `searchHotelRates` when found; falls through to
  `cityName` for long-tail user-typed cities not in the static catalog.
- One-line `[LiteAPI rates] mode=...` log so production traffic shows
  which path each request took.

### Behaviour for catalog cities

Of the destinations populated in `destinations.ts`, the vast majority carry
`lat`/`lng`. PR-9 expects coordinate-radius hits to replace zero-result
`cityName` misses for "Bali (Canggu)", "Bangkok", "Tokyo", "Paris", etc.

## Verification

- `npx tsc --noEmit` — **exit 0** (clean).
- `npm run lint` — no **new** errors introduced; pre-existing baseline
  unchanged. (`next.config.ts: eslint.ignoreDuringBuilds: true` per repo
  convention.)
- `grep -rn "sports_fitness" src/` returns only the two intentional alias
  rows in `travelCategories.ts:31-32` (legacy event-source → new legend
  group); all primary references renamed.

## Protected Invariants (unchanged by this PR)

- Commit → budget spine: untouched (recommendation shape stable).
- Registry `hardBookable` semantics: untouched (`adventure` inherits the
  prior `sports_fitness` row's `viator + hardBookable: true`).
- PR-3b reservation tables: untouched (this PR only changes search-time
  routing).
- PR-4 carousel UI: only one constant key swapped (`sports_fitness →
  adventure`); component code unchanged.
- PR-7 diagnostic logs: kept, plus one new `[LiteAPI rates] mode=...` log
  for Fix 5 path observability.
- Fail-loud errors: typed errors (`ViatorApiError`, `LiteApiError`,
  `MissingViatorKeyError`) still re-thrown on 4xx + missing-key paths.

## Scope Discipline

Fix 4 (pagination) and Fix 5 (coords) both fit within their expected
surface area:

- Fix 4: two function signatures (added optional `start`), one orchestrator
  block rewritten, one route-side max-bump. No new modules.
- Fix 5: one interface widened, one body builder branched, one route-side
  plumb call, one helper. No new modules.

No scope expansion — proceeding to commit.
