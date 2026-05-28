# Travel-FailLoud-PR-1 — Surface real API errors

Builds on `audit-reports/travel-triple-empty-audit.md`. Every cited swallow point
re-verified before fixing. Per the fail-loud / no-silent-fallback mandate.
Branch: `claude/travel-faillout-pr-1`.

---

## Typed errors module — `src/lib/travelErrors.ts` (new, 81 lines)

Centralised provider errors so route handlers have one import site:
- `MissingGoogleKeyError` — env var unset.
- `GooglePlacesApiError(status, errorMessage?)` — Google returned
  `REQUEST_DENIED` / `OVER_QUERY_LIMIT` / `INVALID_REQUEST` / `UNKNOWN_ERROR`,
  or `NETWORK_ERROR` for thrown fetches. Includes Google's own `error_message`.
- `GooglePlacesQuotaError` — re-exported from existing `googlePlacesQuota.ts`.
- `MissingViatorKeyError` — env var unset.
- `ViatorApiError(endpoint, status, body?)` — Viator returned non-2xx; carries
  endpoint + HTTP status + truncated body.
- `isTravelProviderError(err)` — type-guard helper.

Every error carries a `source: 'google' | 'viator'` + `kind: '...'` so the
route can branch cleanly and the UI can render per-source banners.

---

## Re-verified swallow points + fixes (before → after, cited)

### 1. `placesSearch.ts:62-64` — missing Google key returned `[]`
**Before:** `console.error('[PLACES] No API key'); return [];`
**After:** `throw new MissingGoogleKeyError();`
Route catches → 500 + `{ error: "GOOGLE_PLACES_API_KEY is not configured", source: 'google', kind: 'missing_key' }`.

### 2. `placesSearch.ts:73-76` — geocode failures swallowed
**Before:** `if (!geoData.results?.[0]?.geometry?.location) return [];`
**After:** Distinguish ZERO_RESULTS (legit empty — return `[]`) from real
errors:
```ts
if (geoData.status && geoData.status !== 'OK' && geoData.status !== 'ZERO_RESULTS') {
  throw new GooglePlacesApiError(geoData.status, geoData.error_message);
}
if (!geoData.results?.[0]?.geometry?.location) {
  console.log(`[PLACES] Geocode ZERO_RESULTS for "${city}, ${country}"`);
  return [];
}
```

### 3. `placesSearch.ts:97` — text-search status ignored (THE big one)
**Before:** `if (!searchData.results) break;` — Google's REQUEST_DENIED /
OVER_QUERY_LIMIT responses come without `.results`, so the loop silently broke
and the user saw "0 results."
**After:** Inspect `searchData.status` first:
```ts
if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
  throw new GooglePlacesApiError(searchData.status, searchData.error_message);
}
if (!searchData.results) break; // ZERO_RESULTS = legit empty, loop ends
```

### 4. `placesSearch.ts:127-130` — outer catch ate everything (incl. quota error)
**Before:** `catch (err) { console.error(...); return []; }`
**After:** Re-throw typed errors so the route surfaces them; wrap unexpected
errors as `GooglePlacesApiError('NETWORK_ERROR', ...)` so they still fail loud:
```ts
catch (err) {
  if (
    err instanceof GooglePlacesQuotaError ||
    err instanceof MissingGoogleKeyError ||
    err instanceof GooglePlacesApiError
  ) throw err;
  throw new GooglePlacesApiError('NETWORK_ERROR', err instanceof Error ? err.message : String(err));
}
```
The 429 we wired up in PR-1 finally reaches the route.

### 5. `ai-assistant/route.ts:65` — `enrichPlaceDetails` had `if (!apiKey) return places;`
**After:** `throw new MissingGoogleKeyError();` (per-place enrich shouldn't
silently no-op when the whole config is missing).

### 6. `ai-assistant/route.ts:74-77` — per-place enrich catch was bare `catch { return p; }`
**After:** Per-place check `data.status` — re-throws auth/quota errors;
soft-fails only on per-place network blips:
```ts
if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS' && data.status !== 'NOT_FOUND') {
  throw new GooglePlacesApiError(data.status, data.error_message);
}
...
catch (err) {
  if (err instanceof GooglePlacesQuotaError || err instanceof MissingGoogleKeyError || err instanceof GooglePlacesApiError) throw err;
  return p; // per-place network blip — soft fail
}
```

### 7. `viatorClient.ts:14` — missing key threw generic `Error`
**Before:** `throw new Error('VIATOR_API_KEY environment variable not set');`
**After:** `throw new MissingViatorKeyError();` (typed so the route can branch).

### 8. `viatorClient.ts:70-83` — V2 destinations swallowed; V1 fallback silently masked errors
**After:** V2 throw → captured as `v2Error`; V1 fallback tried only after.
If both fail, throw the V2 error (more diagnostic value — has auth context).
Missing-key short-circuits immediately (no point trying V1 with broken config).

### 9–11. `viatorClient.ts:280-284, 308-312, 338-342` — three `if (!res.ok) return []`
**After (all three):** `throw new ViatorApiError(endpoint, res.status, await res.text())`.

### 12–14. `viatorClient.ts:382, 395, 406` — per-step `try/catch` in `searchViatorProducts`
**After:** Added `rethrowIfHardFailure(err)` helper — re-throws
`MissingViatorKeyError` and `ViatorApiError` with status 400-499 (auth/forbidden/
rate-limit — same key, same problem on next step); swallows 5xx/network only
(transient — next step might succeed).

### 15. `ai-assistant/route.ts:189-191` — Viator branch's "fall back to Google" caught ALL Viator errors
**After:** Re-throws missing-key + 4xx so the user sees the Viator config
problem instead of getting Google data masking it. Network/5xx still falls
through to Google (transient Viator outage — graceful degradation is fine
for those).

### 16. `ai-assistant/route.ts:243-255` — outer catch only handled `GooglePlacesQuotaError`
**After:** Branches on every typed error with structured HTTP responses
(`category`, `source`, `kind`, `status` in the body):
- `GooglePlacesQuotaError` → 429
- `MissingGoogleKeyError` → 500 (config issue)
- `GooglePlacesApiError` → 502 (upstream failure)
- `MissingViatorKeyError` → 500
- `ViatorApiError` → 502
- anything else → 500 with the raw message

### 17. `TripPlannerAI.tsx:273-301` — UI silently `continue`d on non-200 + non-JSON
**Before:** non-JSON → `console.error + continue`; non-429 errors →
`console.error + continue`; loop catch → `console.error` only.
**After:** Every non-200, non-JSON, or thrown error sets the existing `error`
banner state with `"Couldn't load <CategoryLabel> — <upstream message>"` and
**breaks the loop**.

---

## Per-category isolation policy

The task allowed either per-category error display OR loud-whole-scan-fail-fast
("propose which and implement the clearer one"). **Chose loud-fail-fast.**

Reasoning:
- If Google's billing is off, all 13 categories will fail with the same
  REQUEST_DENIED. Continuing the loop wastes the user's Google quota (each
  attempt still increments the counter via `reserveCall`) for zero benefit.
- Showing one banner per category produces 13 identical banners — noise.
- Categories that already loaded successfully **before** the failure stay
  visible (their results are already in `byCategory` / `recommendations`),
  so partial progress is preserved.
- The banner names the specific category that failed first, which is enough
  diagnostic context to act on (it pinpoints the source — Google vs Viator).

Net behaviour: scan attempts categories in order, stops at the first hard
failure, shows a banner naming the failed category + the upstream message,
keeps any earlier successful categories visible.

---

## ZERO_RESULTS vs real-error distinction (cited)

| Outcome | Code path | UI behaviour |
|---|---|---|
| Google returns `status: 'OK'` with `results: [...]` (≥1) | `placesSearch.ts:104+` map normally | Shows the items |
| Google returns `status: 'OK'` with `results: []` | `searchData.results` exists & is empty → falls through; final filter yields `[]` | Shows the category with **no items**, no banner |
| Google returns `status: 'ZERO_RESULTS'` | `searchData.results` typically present + empty → handled same as above | Same — no banner |
| Geocode returns `status: 'ZERO_RESULTS'` (city not found) | `placesSearch.ts:81` → `return []` with `console.log` | Same — no banner |
| Google returns `status: 'REQUEST_DENIED' / 'OVER_QUERY_LIMIT' / 'INVALID_REQUEST' / 'UNKNOWN_ERROR'` | `placesSearch.ts:94-96` / `:78-80` → `throw new GooglePlacesApiError(status, error_message)` | **Banner**: `"Couldn't load <Category> — Google Places API: REQUEST_DENIED — <message>"` |
| Google network error / timeout | outer catch wraps as `GooglePlacesApiError('NETWORK_ERROR', ...)` | **Banner** with network message |
| Quota cap reached | `googleFetch` throws `GooglePlacesQuotaError` | **Banner**: `"Couldn't load <Category> — Google Places monthly quota exceeded — bill protection active"` |
| Viator 401/403/429 | `searchV2Products` / `searchV2Freetext` / `searchV1Products` throw `ViatorApiError(status)` → re-thrown from the route's Viator branch | **Banner**: `"Couldn't load <Category> — Viator API: <endpoint> returned <status> — <body>"` |
| Viator 5xx / network | swallowed inside `rethrowIfHardFailure` → falls through to Google | Google result shown (legacy fallback preserved for transient Viator outages) |
| Missing Viator key (`VIATOR_API_KEY` unset) | route guard at line 137 short-circuits the Viator branch entirely | Google path runs as normal — **no error** (this is correct: Viator is opt-in; no key = "Viator not enabled," not an error) |

---

## What the user will SEE now (verification scenarios)

After deploying, with the live broken state from `travel-triple-empty-audit.md`:

| Scenario | New banner |
|---|---|
| Google billing off / API not enabled | `Couldn't load Accommodation — Google Places API: REQUEST_DENIED — This API project is not authorized to use this API.` |
| `GOOGLE_PLACES_API_KEY` unset in Vercel | `Couldn't load Accommodation — GOOGLE_PLACES_API_KEY is not configured` |
| Google quota cap crossed | `Couldn't load Accommodation — Google Places monthly quota exceeded — bill protection active` |
| Google key restricted (HTTP referrer / IP block) | `Couldn't load Accommodation — Google Places API: REQUEST_DENIED — IP, site or mobile application blocked by API key restriction.` |
| Viator key invalid/expired | `Couldn't load Sports & Fitness — Viator API: V2 /products/search returned 401 — <Viator's auth-error JSON>` |
| Network timeout to Google | `Couldn't load Accommodation — Google Places API: NETWORK_ERROR — <fetch error message>` |
| Genuine "no places for this rare destination" | (no banner — category just shows zero items) |

Test-once-deployed: turn off billing for 30s → search → confirm the banner
quotes Google's actual `error_message`. Turn billing back on → search again →
results return.

---

## Constraints verified

- **No new providers.** Untouched: `commit/route.ts`, `places/photo/route.ts`,
  `vendor-commit/route.ts`, all option routes (`trip_lodging_options` etc.),
  the trip-creation flow. No new categories in `TRAVEL_COA`.
- **No `SOURCE_BY_CATEGORY` registry.** Routing in `ai-assistant/route.ts:137`
  is still the same two-way `if (isViatorCategory(category) && VIATOR_API_KEY)`
  → Viator else Google. That refactor is the next PR.
- **No traveler-count changes.** `git diff main` on `TripCreationBar.tsx`,
  `new/page.tsx`, `api/trips/route.ts` = 0 lines.
- **`trip_scanner_results` shape unchanged.** `git diff main` on
  `prisma/schema.prisma` = 0.
- **Commit spine unchanged.** `git diff main` on `vendor-commit/route.ts` = 0.
- **Google is still the source.** Only its errors now surface.
- **No new silent fallbacks introduced.** The only swallow path that
  intentionally remains is Viator-5xx/network → fall through to Google
  (preserving the existing graceful-degradation policy for transient Viator
  outages; the next PR's source-registry refactor will replace this with a
  per-category `hardBookable` flag).

---

## tsc + lint

- **`npx tsc --noEmit` → exit 0.**
- **Lint:** zero NEW errors introduced. Comparison via `git stash`:
  - Baseline lint errors on the four edited files: **20**.
  - After my edits (incl. new `travelErrors.ts`): **20**.
  - All 20 are pre-existing `@typescript-eslint/no-explicit-any` / `<img>`
    baseline. `next.config.ts` has `eslint.ignoreDuringBuilds: true`.
- New file `src/lib/travelErrors.ts` is fully lint-clean.

---

## Changeset

```
 M src/app/api/trips/[id]/ai-assistant/route.ts   (typed-error catch + enrichPlaceDetails)
 M src/components/trips/TripPlannerAI.tsx          (UI fail-loud + break loop)
 M src/lib/placesSearch.ts                         (4 swallow points → typed throws)
 M src/lib/viatorClient.ts                         (8 swallow points → typed throws)
 A src/lib/travelErrors.ts                         (new: typed errors module)
```

Foundation laid. Next PR can build the `SOURCE_BY_CATEGORY` registry on top
of this — every new provider's failures will now surface from day one.
