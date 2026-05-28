# Travel Search 0-Results Diagnostic (read-only)

Branch: `claude/travel-search-0results-audit`. No code changes — investigation only.
Every claim cited, with a single most-likely cause + a concrete check the user can run.

---

## 1. The Google call path, end to end (cited)

UI search → API → Google:

1. **UI** — `src/components/trips/TripPlannerAI.tsx` (post-PR-1):
   - `searchDestination()` iterates COA categories and POSTs each to
     `/api/trips/{id}/ai-assistant` (`TripPlannerAI.tsx:241`).
2. **API route** — `src/app/api/trips/[id]/ai-assistant/route.ts`:
   - Auth + tier + body parse + category validation (`:90-128`).
   - Cache check (`isCacheFresh`, `:201`); on miss →
     `searchPlacesMultiQuery(queries, city, country, 60)` (`:205`).
   - `enrichPlaceDetails` (`:206` → `:65`).
   - Filter (`:213-217`) → map (`:220`) → sort → return.
3. **`searchPlacesMultiQuery`** — `src/lib/placesSearch.ts:289-319`: runs
   `searchPlaces(query, city, country, 60, type)` for each query in parallel,
   merges by `placeId`.
4. **`searchPlaces`** — `src/lib/placesSearch.ts:53-131`:
   - **Geocode**: `https://maps.googleapis.com/maps/api/geocode/json?address=…&key=…`
     (`:67`).
   - **Text Search** (paginated, 3 pages × 20 = up to 60):
     `https://maps.googleapis.com/maps/api/place/textsearch/json?query=…&location=…&radius=20000&key=…`
     (`:87`).
5. **Enrichment** (`ai-assistant/route.ts:65-83`): for top N (=33),
   `https://maps.googleapis.com/maps/api/place/details/json?place_id=…&fields=website&key=…`.

**Every Google URL is the LEGACY V3 host** (`maps.googleapis.com/maps/api/place/...`).
All call sites (cited): `placesSearch.ts:67, 86, 87, 138`,
`ai-assistant/route.ts:71`, `commit/route.ts:141`, `places/photo/route.ts:36, 46`,
plus `verification.ts:26, 59, 73`. **None** of the code uses the new
`places.googleapis.com/v1/places:searchText` endpoint.

### Which Google API must be enabled
- `place/textsearch/json` + `place/details/json` + `place/photo` + `place/findplacefromtext/json`
  → require **"Places API" (Legacy)** enabled in the GCP project.
- `geocode/json` → requires **Geocoding API** (separate; was already working).
- The new endpoint is `places.googleapis.com/v1/places:searchText` (POST,
  `X-Goog-Api-Key` header, `X-Goog-FieldMask` required) — **the code does not use
  this**, so enabling only "Places API (New)" in GCP will not help.

Per [Google's deprecation notes](https://developers.google.com/maps/deprecations)
and [community write-ups](https://mapatlas.eu/blog/google-places-api-legacy-deprecation-eu),
the **legacy Places API was frozen in March 2025**: existing GCP projects that
already had it enabled can keep using it; **new projects (post-March 2025) can no
longer enable it.** No hard shutdown date is published yet (Google's policy
requires 12 months notice). So legacy endpoints still resolve, but only on
projects that had the legacy product enabled before the freeze.

---

## 2. The API key (cited)

Single env var used everywhere: **`GOOGLE_PLACES_API_KEY`**
(`placesSearch.ts:60, 135`; `ai-assistant/route.ts:64`; `commit/route.ts:138`;
`places/photo/route.ts:20`; `verification.ts:22, 55`;
`googlePlacesQuota.ts` uses only `GOOGLE_PLACES_MONTHLY_CAP`).

No separate key for "Places API (New)" — the codebase assumes one key valid for
the legacy product.

**To verify in Vercel/GCP**, the user must check:
1. `GOOGLE_PLACES_API_KEY` exists in Vercel env for the production deployment.
2. The key's GCP project has **"Places API"** (legacy) enabled — not just
   "Places API (New)".
3. The key has no HTTP-referrer restriction (server-side calls have no Referer);
   if restricted, restrict by IP allow-list (Vercel egress IPs) instead, or
   disable restrictions.

---

## 3. The quota guard (cited)

`src/lib/googlePlacesQuota.ts`:
- `reserveCall()` (`:47-60` per the file's structure): atomic
  `prisma.google_places_usage.upsert` increments `callCount` by 1, then checks
  `if (row.callCount > cap) throw new GooglePlacesQuotaError(...)`.
- `cap` defaults to **5000** unless `GOOGLE_PLACES_MONTHLY_CAP` overrides
  (`monthlyCap()` rejects 0/invalid, falls back to default).
- `googleFetch` (`:65-69`) awaits `reserveCall()` then issues `fetch`.

**Pass/block trace for the first call of a new month:**
- Upsert `create` row sets `callCount: 1`. `1 > 5000` → false. Pass. ✓
- The "trip at 0" scenario is not possible: `monthlyCap()` won't return 0
  (`Number.isFinite(0) && 0 > 0` is false → default 5000 used).
- Warn fires at 80% (=4000) of cap, not at 0.

**Verdict: the guard is not the cause.** It can only block at call #5001 of the
month. (Side effect: the counter increments even if Google returns an error,
because `reserveCall` runs BEFORE the fetch — which is actually the diagnostic
gold; see §6.)

---

## 4. The results mapping (cited) — could it produce empty?

Path: `searchPlacesMultiQuery` → `searchPlaces` → enrich → filter → map.

`searchPlaces` (`placesSearch.ts:99-112`) maps Google's V3 response keys
(`name`, `formatted_address`, `place_id`, `rating`, `user_ratings_total`,
`price_level`, `business_status`, `types`, `photos[].photo_reference`).
**These are correct field names for the LEGACY V3 response.** If Google does
return V3-shaped data, the mapping works.

Filter (`ai-assistant/route.ts:213`):
`enriched.filter(p => p.rating >= minRating && p.reviewCount >= minReviews)`.
With `minRating=4.0` (default) and `minReviews=50` (default), this **will
filter out** any place with `rating=0` / `reviewCount=0` — but that's fine for
real Bali results (plenty of 4.0+/50+ places).

**Subtle hazard:** if Google returns a 200 with `status: 'OK'` and an actual
results array but PR-1's mapping happened to expect a new-API field, the array
would still pass through with zeros for missing fields. Confirmed: PR-1 keeps
the V3 field names (`p.rating`, `p.user_ratings_total`, `p.price_level`,
`p.photos[].photo_reference`). So **if Google returns real V3 data, the mapping
will produce valid results** — the mapping isn't the bug.

**Conclusion: mapping is not the cause.** The empty array comes from upstream
in `searchPlaces`, not from mapping.

---

## 5. Error surfacing — SILENT SWALLOW VIOLATIONS (mandate violation)

The system mandate is "fail loud, no silent fallback." The code violates this in
multiple places — Google errors silently become `[]` → "0 results":

| # | File:line | Behavior | What gets swallowed |
|---|---|---|---|
| 1 | `placesSearch.ts:62-64` | `if (!apiKey) { console.error; return []; }` | Missing env var → silent empty |
| 2 | `placesSearch.ts:73-76` | `if (!geoData.results?.[0]?.geometry?.location) return [];` | Geocoding failure / REQUEST_DENIED |
| 3 | `placesSearch.ts:97` | `if (!searchData.results) break;` | **Google error responses** (`status: 'REQUEST_DENIED'`, `'OVER_QUERY_LIMIT'`, `'INVALID_REQUEST'`) have no `results` key → silent break, returns `[]` |
| 4 | `placesSearch.ts:127-130` | `catch (err) { console.error; return []; }` | **All thrown errors including `GooglePlacesQuotaError`** — the 429 the route is supposed to surface gets eaten here |
| 5 | `placesSearch.ts:147-149` | `catch { return null; }` (getPlaceDetails) | Same |
| 6 | `ai-assistant/route.ts:74-82` | `try { … } catch { return p; }` per place in `enrichPlaceDetails` | Quota errors during enrichment swallowed |

**The code never inspects `searchData.status` or `searchData.error_message`**
from Google. Google's text-search responses for problems look like:
```json
{ "status": "REQUEST_DENIED",
  "error_message": "This API project is not authorized to use this API.",
  "results": [] }
```
…and the user just sees "0 results."

This is the mechanism by which **any** upstream failure becomes a silent zero.

---

## 6. What `/api/places/usage` tells you — the diagnostic key

`src/app/api/places/usage/route.ts` returns
`{ yearMonth, callCount, cap, pct }`. **Hit this endpoint after a failed Bali
search** — the count distinguishes the two failure classes:

- **`callCount == 0`** → calls are not being made. Cause is **before**
  `googleFetch`: either `GOOGLE_PLACES_API_KEY` is unset in Vercel
  (`placesSearch.ts:62-64` returns `[]` without calling `googleFetch`, so no
  counter increment), or the key reader returns `undefined`.
- **`callCount > 0`** → calls **are** being made and Google is rejecting them
  (REQUEST_DENIED / API not enabled / key restriction). The counter increments
  in `reserveCall` BEFORE the fetch, so it goes up whether Google says yes or
  no. The empty results come from `searchData.results` being absent on
  REQUEST_DENIED → silent break at `placesSearch.ts:97`.

This single check pinpoints the failure class. (You can also run, locally:
`curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=cafe+in+Bali&key=$GOOGLE_PLACES_API_KEY"`
— the `status` field of the JSON response is the ground truth.)

---

## Verdict

**Most likely cause (with evidence):**
**The GCP project for `GOOGLE_PLACES_API_KEY` does not have the legacy "Places
API" enabled** (or the key is restricted in a way that blocks server-side
calls). Per Google's March 2025 freeze, legacy "Places API" cannot be enabled
on projects that didn't already have it on. Symptoms match perfectly:
- Google returns `{status: 'REQUEST_DENIED', error_message: '…', results: <absent>}`.
- Code at `placesSearch.ts:97` sees no `.results` → silently breaks → returns `[]`.
- Code at `placesSearch.ts:127-130` would also silently swallow any thrown
  error from the rejected fetch.
- UI shows "0 results."
- `/api/places/usage.callCount > 0` (because the quota guard increments before
  the fetch is attempted).

**Second most likely:**
**`GOOGLE_PLACES_API_KEY` is not set in Vercel** for the production deployment
(or is set in the wrong environment / typo'd). Symptom: `placesSearch.ts:62-64`
returns `[]` BEFORE incrementing the counter → `/api/places/usage.callCount == 0`.

**Not the cause:**
- Quota guard (`googlePlacesQuota.ts`) — only blocks at >5000/month; doesn't
  block the first call.
- Results mapping — uses correct V3 field names; would produce real records if
  Google returned them.
- New-vs-legacy URL mismatch — the code is consistently legacy V3, and legacy
  is still operational (frozen, not shut down).

**Silent-swallow violations to fix (mandate):**
`placesSearch.ts` lines 62-64, 73-76, 97, 127-130, 147-149; plus the
per-place catch in `ai-assistant/route.ts:74-82`. Google's error responses
must surface, not be eaten.

---

## Proposed fix (no code changes yet — await approval)

### Step 1 — Investigation (zero code, user-side)
1. **Hit `/api/places/usage`** after attempting a Bali search. Report
   `callCount`. This decides between Cause #1 and Cause #2.
2. If `callCount > 0`, run a direct probe with the production key:
   ```
   curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=cafe%20in%20Bali&key=YOUR_KEY"
   ```
   The `status` + `error_message` in the JSON is the ground truth. Likely:
   `REQUEST_DENIED` + "This API project is not authorized to use this API"
   (or similar), pointing at GCP enablement / key restriction.
3. If `callCount == 0`, verify `GOOGLE_PLACES_API_KEY` is set in Vercel for
   the deployed environment.

### Step 2 — Fix the silent-swallow violations (code change, post-approval)
A small, safe refactor of `src/lib/placesSearch.ts`:
- Throw typed errors instead of returning `[]`:
  - `MissingGoogleKeyError` at the no-key branch.
  - `GooglePlacesApiError(status, message)` whenever Google returns a non-OK,
    non-ZERO_RESULTS `status` (or when no `results` key is present).
- The outer `try/catch` should **re-throw** `GooglePlacesQuotaError` (don't eat
  the 429); only the bare-network catch returns a fallback (and even then,
  fail loud).

Then update `ai-assistant/route.ts`'s outer `catch` (it already handles
`GooglePlacesQuotaError → 429`) to map `GooglePlacesApiError → 502 { error:
"Google API: <status>: <message>" }` and `MissingGoogleKeyError → 500 { error:
"GOOGLE_PLACES_API_KEY is not configured" }`. Surface those in the UI banner
(currently there's already an `error` slot in `TripPlannerAI`).

That single refactor turns "0 results" silence into a banner that says
exactly which configuration knob is wrong — and prevents this whole class of
"the system is silently broken" failure going forward.

### Step 3 — Address the root cause (config, not code)
- If GCP enablement is the issue: enable legacy "Places API" on the project
  (if the project predates March 2025 it should still be possible); or
  migrate the code to "Places API (New)" — that's a bigger change but is the
  only path on a post-freeze project. The migration target is
  `places.googleapis.com/v1/places:searchText` (POST, JSON body
  `{ textQuery, locationBias, … }`, headers `X-Goog-Api-Key` +
  `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.photos`).
- If key restriction: switch to IP allow-list with Vercel's egress IPs (or
  remove restriction temporarily to confirm).

Awaiting approval before changing any code.

Sources:
- [Places API (Legacy) overview](https://developers.google.com/maps/documentation/places/web-service/legacy/overview-legacy)
- [Google Maps Platform deprecations](https://developers.google.com/maps/deprecations)
- [Migrate to Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/legacy/migrate-text)
- [Google Places API (Legacy) Is Frozen — MapAtlas blog](https://mapatlas.eu/blog/google-places-api-legacy-deprecation-eu)
- [Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search)
