# Travel-Data-PR-1 — Keep Google + cost discipline, remove Grok + profile

Builds on `audit-reports/travel-scan-pipe-audit.md`. Direction: **keep Google Places**
(richer data, already wired), **harden it** with cost discipline, **remove the Grok/AI
layer** from the travel scan, and **remove the traveler profile**. Branch:
`claude/travel-data-pr-1-google-discipline`.

Re-verified the live pipe before editing — the 6 Google call sites, the cache, the
hero photo, Grok ranking, and the source-agnostic commit spine all matched the prior
audit.

---

## WHAT STAYS (retained, cited)
- **All 6 Google call sites** — now quota-guarded (see below), not removed:
  1. Geocode `placesSearch.ts:60` 2. Text Search `placesSearch.ts:81` (paged)
  3. Place Details enrich `ai-assistant/route.ts:77` 4. cache read `placesCache.ts`
  5. hero/POI photo `places/photo/route.ts` 6. commit hero `commit/route.ts:140`.
- **`places_cache` table + caching logic** (`placesCache.ts`) — kept, made more
  aggressive.
- **Hero photo logic** (`places/photo/route.ts`, `commit/route.ts`) — kept, routed
  through the cache/proxy + quota.
- **`trip_scanner_results` shape** (`schema.prisma:1721`) — unchanged. The
  `recommendations` JSON keeps every key; source-branded `googleRating` retained.
- **Commit→budget spine** (`vendor-commit/route.ts:87`) — untouched, still
  source-agnostic.
- **Viator path** (`ai-assistant/route.ts:135-167`) — untouched; still bypasses
  Google+Grok and writes the same results shape.

---

## (1) COST DISCIPLINE — the real fix for the $1k bleed

### a) Aggressive caching (cited)
- `isCacheFresh(city,country,category)` (`placesCache.ts`) now gates **every** scan:
  on a hit the entire category is served from `places_cache` with **zero Google
  calls** (`ai-assistant/route.ts:201-204`). On miss → one fresh multi-query fetch →
  `cachePlaces` writes results (upsert by `placeId`, so a place re-seen inside the
  window is never re-fetched).
- **TTL = 7 days**, configurable via **`PLACES_CACHE_TTL_DAYS`** (`placesCache.ts`
  `cacheTtlDays()`, default 7). Proposed 7d as the balance between freshness and
  spend.
- **Removed the photos-empty force-refetch** (old `isCacheFresh` treated empty
  photos as stale → re-billed every scan for photoless places). Cache is now purely
  age-based.

### b) Lazy / cached-forever photos (before → after, cited)
- **Before:** `searchPlaces` returned raw `maps.googleapis.com/.../photo?...&key=KEY`
  URLs to the client — the **API key leaked to the browser** and every `<img>` render
  billed a Place Photo call (33 results × 2 photos per category = the bleed).
- **After:**
  - `placesSearch.photoProxyUrl(ref)` returns **`/api/places/photo?ref=<ref>`** — a
    server proxy. The key never reaches the client (`placesSearch.ts`).
  - Photo **references are stored once** in `places_cache` and reused forever
    (`placesCache.extractPhotoRefs` accepts proxy/legacy/raw refs;
    `getCachedPlaces` rebuilds proxy URLs, no key).
  - The proxy (`places/photo/route.ts`) fetches server-side, quota-guarded, and
    responds with `Cache-Control: public, max-age=604800` (7d) so a photo is not
    re-billed on repeat renders.
  - **Lazy in the UI:** POI cards render a placeholder with a **"Show photo"** button;
    the `<img>` (and thus the billed fetch) only loads when the user clicks it or
    opens the commit panel (`TripPlannerAI.tsx`, `photoShown` /`loadedPhotos`).
  - Hero photo: `commit/route.ts` now stores the **proxy URL** (`photoProxyUrl`) on the
    trip instead of a key-bearing URL.

### c) Hard monthly quota guard (net-new, cited)
- New `src/lib/googlePlacesQuota.ts`:
  - `googleFetch(url)` wraps **every** outbound Google call — used in
    `placesSearch.ts` (geocode, text search, details), `places/photo/route.ts`
    (text search + photo), `commit/route.ts` (hero search).
  - Counter: new model **`google_places_usage`** (`schema.prisma`, migration
    `20260527000000_travel_google_places_usage`), one row per UTC month, atomic
    `increment`.
  - **Cap = `GOOGLE_PLACES_MONTHLY_CAP`** (default **5000**/month). At **80%** →
    `console.warn`. **At the cap → throws `GooglePlacesQuotaError`**, surfaced as
    **HTTP 429 "Google Places monthly quota exceeded — bill protection active"** by
    `ai-assistant`, `places/photo` (and shown in the UI). **No silent fallback.**
  - **Usage view:** `GET /api/places/usage` returns `{ yearMonth, callCount, cap, pct }`.

---

## (2) Grok/AI removed from the travel scan (cited)
- `ai-assistant/route.ts`: removed `import { analyzeWithLiveSearch } from
  '@/lib/grokAgent'` and the Grok call + AI scoring (old lines 452-483). Results are
  now mapped straight from Google by `placeToRecommendation()` (deterministic,
  rating-based) and sorted by a quality score — **no AI step**.
- Compliance comments added at the Google integrations
  (`googlePlacesQuota.ts`, `placesSearch.ts`, `places/photo/route.ts`,
  `ai-assistant/route.ts`): *"per Google Places API terms, do not pipe Google Places
  data to any AI/LLM."*
- **Blast radius confirmed TRAVEL-ONLY:** `grep` for `grokAgent`/`analyzeWithLiveSearch`
  under `src/app/api/trips` → **NONE**. Other Grok users are **untouched**:
  `src/lib/grok.ts`, `src/lib/grokAgent.ts` (now unreferenced dead code, left in
  place to avoid blast radius), `src/lib/convergence/sentiment.ts` (trading
  sentiment), `src/app/api/data-observatory/check/route.ts` (health check). No
  operations/evolve module imports the travel Grok path.

---

## (3) Traveler profile removed (what was cut, cited)
`TripPlannerAI.tsx`:
- **Deleted constants:** `TRIP_TYPES`, `BUDGET_OPTIONS`, `PRIORITY_GROUPS`,
  `VIBE_OPTIONS`, `PACE_OPTIONS`, `DEFAULT_PROFILE`, interfaces `TravelerProfile` /
  `ParticipantProfile`.
- **Deleted props:** `initialProfile`, `participantProfiles`, `participantId` (+ the
  caller `budgets/trips/[id]/page.tsx` no longer passes them).
- **Deleted state/handlers:** `profile`, `selectedInterests`, `showProfileEditor`,
  `savingProfile`, `scannerProfile`, `toggleInterest`, `saveProfileToParticipant`,
  `combinedInterests`, `profilesComplete`, `getProfileSummary`, `formatScanProfile`.
- **Deleted UI:** the entire inline profile editor (interest chips + interest groups
  + Budget/Vibe/Pace selects) and the "profile used" result banners.
- **Backend:** `ai-assistant/route.ts` no longer reads participant profiles, vibe
  modifiers, tripType lodging keywords, or profile-budget filters; queries are
  category-only (`getCOAScanQueries(category, activities)`), `profileSnapshot` is no
  longer written.
- **Kept** what a normal search needs: destination (`city`/`country`), dates
  (`month`/`year`/`daysTravel`/`tripDates`), travelers (`activities`).

---

## (4) Results UI — Expedia-style (cited)
`TripPlannerAI.tsx`:
- Button **"Search {city}"** (was "Analyze … with AI"); loading copy **"Searching
  {city}…"** (was "Grok is analyzing…"); header **"Results"** (was "AI Analysis
  Results"); empty state **"Search a destination"**. No AI copy remains.
- **Filters**: Min Rating / Min Reviews / Max Price (kept) + new **Sort by**
  (Rating / Price / Reviews / Name) via `sortBy` state + `sortItems()` applied per
  category. (Distance omitted — results don't carry per-item coordinates; noted.)
- **Cards**: removed the AI badges/sentiment/fit/summary/warnings/trend. Each card =
  lazy photo, name, **rating + price level**, **address**, category, and the existing
  **Commit** action that hits the unchanged vendor-option → `vendor-commit` spine.

---

## Confirmations
- **Commit→budget spine unchanged** (`vendor-commit/route.ts:87`) — still
  `{optionType,optionId,dates,amount,location}`.
- **`trip_scanner_results` shape unchanged** — `recommendations` JSON keeps all keys
  (`googleRating`, `priceLevel`, `compositeScore`, `valueRank`, etc.); only
  `profileSnapshot` is no longer populated (column kept, nullable).
- **Viator path untouched.**
- **No fallback logic** — quota breach fails loud (429); cache miss does a real
  fetch; no silent degradation.
- **Secrets:** Google key is now strictly server-side (proxy); no key in client URLs.
- **`npx tsc --noEmit` → exit 0.** `prisma generate`/`validate` OK. ESLint is
  `ignoreDuringBuilds: true` in `next.config.ts`; the repo carries a pre-existing
  `no-explicit-any`/`<img>` baseline (6 such errors on these files at HEAD before my
  change). I introduced no new error class; remaining warnings (`selections` unused)
  are vestigial state consistent with the baseline.

## Cost posture (summary)
- Cache-first (7d TTL) → repeat scans of the same destination cost **0** Google calls.
- Photos: key off-client, fetched **only on user action**, cached 7d, references
  stored forever → the per-render photo bleed is structurally gone.
- Hard monthly cap (5000 default, env-tunable) fails loud at the ceiling.

## Not verified
Headless — `tsc`/`prisma generate`/`validate` pass and the bleed paths are closed by
construction, but I could not load `/budgets/trips/[id]` in a browser or exercise a
live Google key. The search→sort→lazy-photo→commit flow and the 429 behavior need a
visual pass against live data after deploy. The new migration applies on
`prisma migrate deploy` (additive table, no backfill).
