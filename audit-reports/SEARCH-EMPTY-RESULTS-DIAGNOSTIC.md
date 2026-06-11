# SEARCH EMPTY-RESULTS DIAGNOSTIC (Hotels "only Canggu" + Activities "empty")

**Two related "search returns empty for most inputs" bugs on the PUBLIC travel
surfaces.** Read-only diagnosis. **No source modified.** Cite `file:line`.

Branch: `claude/audit-search-empty-results` · main @ `800a7e8e`.

---

## TL;DR

| Bug | Primary root cause | Same as the other? |
|---|---|---|
| **A. Hotels — only Canggu** | **LiteAPI is in SANDBOX mode** (`liteapiClient.ts:36`) — sandbox has test inventory for only a few locations; Bali/Canggu is one, Lisbon/Tokyo aren't → `200 OK` with an EMPTY array. | Partly — see Part C |
| **B. Activities — empty even Canggu** | **"Canggu" doesn't resolve to a Viator destination ID** — the public route passes NO `preResolvedDestId`, so it relies on the dynamic `findDestinationId('Canggu')` name lookup, which returns `null` for the small town (Viator catalogs it under "Bali", destId 98) → falls to a weak city-suffixed freetext → empty. | Partly — see Part C |

**Shared architectural cause:** both PUBLIC routes call the **bare provider
functions WITHOUT the destination-resolution robustness layer** (static destId +
static coords + a production key) that the **authed** trip flow
(`ai-assistant/route.ts`) uses. The public surfaces are the un-helped path.

---

## PART A — HOTELS: why only Canggu

### The public path (what actually runs)
1. `PublicHotelSearch` sends ONLY `city`, `country`, `checkin`, `checkout`,
   `adults` — **no lat/lng** (`PublicHotelSearch.tsx:63-65`).
2. The route reads optional `latitude`/`longitude` but they're absent, so it calls
   `searchHotelRates({ city, country, … })` with no coords
   (`api/travel/hotels/search/route.ts:66-76`).
3. In `searchHotelRates`, `useCoords = typeof params.latitude === 'number' …` is
   **false** → it takes the **`cityName` branch**: `cityName:
   extractCityName(params.city)` (`liteapiClient.ts:223-224`). So the public flow
   sends LiteAPI a raw city NAME, no geo resolution.

### Why "only Canggu"
- **LITEAPI_MODE defaults to `sandbox`:** `getMode()` returns `'production'` only
  when `process.env.LITEAPI_MODE === 'production'`, else `'sandbox'`
  (`liteapiClient.ts:35-37`); the active key is `LITEAPI_SANDBOX_KEY` (`:41-43`).
- **LiteAPI's sandbox returns a small fixed TEST inventory** keyed to a handful of
  locations. A request for a city with sandbox coverage (Bali/Canggu) returns
  hotels; a city with none (Lisbon, Tokyo) returns a **`200 OK` with an empty
  `data[]`** — not an error, which is exactly the "comes back empty" symptom.
- The route's own logs prove which case fires:
  `[LiteAPI] mode=… keyPrefix=…` (`:241`) shows sandbox vs production, and
  `[LiteAPI] rates raw: dataLen=0 …` (`:264`) shows a 2xx-but-empty upstream
  response. A `dataLen=0` on a `status=200` for Lisbon ⇒ sandbox-empty, NOT a
  bug in our code.
- **Country resolution is NOT the cause:** `countryNameToIso2` covers Portugal
  (`PT`, `:80`), Japan (`JP`, `:65`), etc., and *throws* on an unknown country
  (`:96-101`) — which would surface as a 500, not an empty list. So a failing city
  is reaching LiteAPI with a valid `countryCode` and coming back legitimately empty.

### Ranked root cause (Hotels)
1. **(Dominant) Sandbox mode + limited test inventory** (`liteapiClient.ts:36`).
   Evidence: only a Bali location works; `200/dataLen=0` for others; mode default
   is sandbox. **Even a perfect city→geo resolution can't conjure inventory the
   sandbox doesn't host.**
2. **(Secondary, accuracy) The public path skips coord resolution.** The authed
   flow passes `findDestinationCoords(city)` → the more robust coord-radius search
   (`ai-assistant/route.ts:268,275`); the public flow never does, so even in
   PRODUCTION it leans on LiteAPI's brittle `cityName` match (the very brittleness
   the coord path was added to fix — `liteapiClient.ts:203-207`).

---

## PART B — ACTIVITIES: why empty (even Canggu)

### The public path
- `api/travel/activities/search/route.ts:67` calls
  `searchViatorProducts(city, country, 'activities', [], ACTIVITY_MAX_RESULTS)` —
  **five args, NO 6th `preResolvedDestId`.**
- In `searchViatorProducts`, `const destId = preResolvedDestId ?? await
  findDestinationId(city, country)` (`viatorClient.ts:334`). With no
  pre-resolved id, everything hinges on the **dynamic name lookup**.

### Why "Canggu" resolves to nothing
- `findDestinationId('Canggu')` loads Viator's `/partner/destinations` catalog and
  matches by name: exact CITY → partial CITY → any-type partial → else **`return
  null` + `console.warn`** (`viatorClient.ts:132-161`). Viator catalogs Bali
  activities under a **Bali-level node** (our static map records `Bali (Canggu) …
  viatorDestId: 98`, `destinations.ts:69`); a standalone "Canggu" node is unlikely,
  so the lookup returns **null**.
- With `destId === null`, the proper bucket path `if (destId && coaCategory ===
  'activities')` (`viatorClient.ts:373`) is **skipped**. Control falls to the
  **no-destId legacy branch**: `searchV2Freetext(\`${term} ${city}\`, null, …)`
  (`:411-416`) — i.e. a freetext search for **"Activities Canggu"** with no
  destination filter, a weak query that returns little or nothing.
- Final `.filter(p => p.rating > 0)` (`:456`) then drops anything unrated, so a
  thin freetext result becomes **empty** → the route returns `{results: []}` →
  the UI shows **"No activities yet."**

### Not the cause (ruled out)
- **Empty-terms early return** (`viatorClient.ts:327-328`) is **NOT firing**:
  `buildSearchTerms('activities', [])` has no base terms and no interest terms, so
  it falls back to `TRAVEL_COA['activities'].label` = `'Activities'`
  (`viatorClient.ts:230-233`; `travelCOA.ts:92-93`) → `searchTerms = ['Activities']`
  (non-empty). The function proceeds; it just proceeds down the weak path.
- **Viator has no sandbox/production toggle** — `getApiKey()` reads a single
  `VIATOR_API_KEY` (`viatorClient.ts:14-15`), one base URL (`:12`). So this is NOT
  a sandbox-inventory issue (unlike hotels); it's destination resolution.
- **A `/destinations` failure (429/auth) is also ruled out for the empty symptom:**
  that would throw `ViatorApiError`/`MissingViatorKeyError` and the route would
  return **500**, not an empty `200`. "No activities yet" ⇒ a successful empty
  result ⇒ the freetext path genuinely returned nothing.

### Ranked root cause (Activities)
1. **(Dominant) Destination-ID resolution miss for sub-town inputs.** The public
   route passes no `preResolvedDestId` (`route.ts:67`), and dynamic
   `findDestinationId('Canggu')` returns null (`viatorClient.ts:161`) → the weak
   no-destId freetext fallback (`:411-416`) → filtered to empty (`:456`).
2. **(Contributing) The static destId map needs an exact label match anyway.**
   Even if the route DID call `findViatorDestIdFor`, it matches `d.name ===
   cityName` exactly (`destinations.ts:569`); user-typed "Canggu" ≠ catalog
   "Bali (Canggu)" → still null. So a fix must tolerate the town→parent-label gap.

---

## PART C — SHARED CAUSE?

**Same theme, different mechanisms — state both plainly.**

- **Shared (architecture):** both PUBLIC search routes invoke the **bare provider
  functions without the resolution/robustness layer the AUTHED flow injects.** In
  `ai-assistant/route.ts` the trip's destination is a canonical catalog label, and
  the route hands the providers help: `findDestinationCoords(city)` → LiteAPI coord
  search (`:268,275`) and `findViatorDestIdFor(city)` → Viator
  `preResolvedDestId` (`:327,333`). The public routes pass **neither** — they trust
  raw user text + each provider's brittle native matching.
- **Different (the actual empties):**
  - **Hotels** fail mainly because of **SANDBOX inventory** — a *data/config*
    problem (`LITEAPI_MODE`), independent of resolution. Fixing resolution alone
    won't help while sandbox is active.
  - **Activities** fail because of **destination-ID RESOLUTION** — a *code-path*
    problem in Viator name matching; there is no sandbox dimension.

So: **not one bug — two, with a common "public path is un-helped" backdrop.**

---

## REPORT — FINDINGS + SMALLEST FIX (per bug)

### Bug A — Hotels "only Canggu"
- **Root cause:** LiteAPI sandbox limited inventory (`liteapiClient.ts:36`), reached
  via the public cityName path that also skips coord resolution.
- **Smallest fix:** set `LITEAPI_MODE=production` with a populated
  `LITEAPI_PRODUCTION_KEY` (config, not code) — confirm via the `[LiteAPI] mode=`
  log (`:241`). **Recommended companion (small code):** in the public hotel route
  (or container), resolve catalog cities through `findDestinationCoords` with a
  *tolerant* match and pass `latitude/longitude` so production searches use the
  robust coord path instead of brittle `cityName`. Keep the daily cap in mind
  before flipping to production (real billing).
- **Confirm-first (truth):** read the production logs for a failing city — `mode=`
  + `rates raw: dataLen=` (`:241`,`:264`) — to prove sandbox-empty vs a 4xx before
  changing anything.

### Bug B — Activities "empty"
- **Root cause:** public route passes no `preResolvedDestId` (`route.ts:67`) and
  `findDestinationId('Canggu')` returns null (`viatorClient.ts:161`) → weak
  no-destId freetext (`:411-416`) → filtered empty (`:456`).
- **Smallest fix:** have the public activities route resolve a Viator destId for
  the typed city and pass it as `preResolvedDestId` (the 6th arg) — mirroring the
  authed flow (`ai-assistant/route.ts:327,333`). Because user "Canggu" ≠ catalog
  "Bali (Canggu)", the resolver must use a **tolerant/contains match** (e.g. match
  "Canggu" inside "Bali (Canggu)") rather than `findViatorDestIdFor`'s exact
  `d.name === cityName` (`destinations.ts:569`). That routes Canggu → destId 98 →
  the proper `/products/search` path (`viatorClient.ts:373`) which returns Bali's
  large activity inventory.
- **Secondary hardening (optional):** when `destId` is null, the current freetext
  fallback + `rating > 0` filter (`:456`) silently empties results; consider
  surfacing "couldn't pin a destination" instead of a bare empty, so the failure
  is legible (fail-loud, consistent with the project's no-silent-empty mandate).

### Cross-cutting recommendation
Add the **same destination-resolution helper to both public routes** that the
authed flow already uses (tolerant catalog lookup → coords for LiteAPI, destId for
Viator). That single shared step fixes activities outright and makes hotels robust
the moment production mode is on — closing the "public path is un-helped" gap
that underlies both bugs. **No code changed in this audit; fixes are separate PRs.**
