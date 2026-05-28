# Travel Triple-Empty Diagnostic (read-only)

Branch: `claude/travel-triple-empty-audit`. Investigation only — no code changes.
Every claim cited file:line.

Today's date is 2026-05-28. Per [Google Maps Platform deprecations](https://developers.google.com/maps/deprecations)
and [MapAtlas](https://mapatlas.eu/blog/google-places-api-legacy-deprecation-eu),
the legacy Places API was **frozen in March 2025** (no hard shutdown date set,
existing projects keep working). The user mentioned a "May 15 2026 deprecation"
but Google's published page shows no such hard date — legacy text search is
frozen, not shut down.

---

## Headline finding

Two pipes (Google, Viator) are configuration-fragile and **silently turn every
failure into empty results** — the no-silent-fallback mandate is violated in
both. Duffel is the only honest one: it tells you the token is missing. The
"triple-empty" symptom is **not one shared cause** — it's three independent
configuration issues, all currently invisible because two of them swallow errors.

---

## Pipe 1 — Google scan ("Search Bali" → 0)

### Call path
- UI → `src/components/trips/TripPlannerAI.tsx:241` `searchDestination()` →
  POST `/api/trips/{id}/ai-assistant` per COA category.
- Route → `src/app/api/trips/[id]/ai-assistant/route.ts`:
  - Viator branch first for Viator categories (`:135-167`).
  - Else cache check `isCacheFresh()` (`:201`) → on miss
    `searchPlacesMultiQuery(...)` (`:205`) → `enrichPlaceDetails(...)` (`:206`).
- `searchPlacesMultiQuery` (`src/lib/placesSearch.ts:289-319`) → fans out
  parallel `searchPlaces(...)` calls.
- `searchPlaces` (`placesSearch.ts:53-131`) hits:
  - **Geocoding API**: `https://maps.googleapis.com/maps/api/geocode/json` (`:67`)
  - **Places API (Legacy) — Text Search**:
    `https://maps.googleapis.com/maps/api/place/textsearch/json` (`:86, :87`)
  - Pagination 3 × 20 = up to 60 per query, with `next_page_token` + 2s delay
    between pages (`:91`).
- Enrichment for top 33: **Places API (Legacy) — Place Details**:
  `https://maps.googleapis.com/maps/api/place/details/json` (`ai-assistant/route.ts:71`).

**The codebase exclusively uses LEGACY V3 (`maps.googleapis.com/maps/api/place/...`).**
No call site hits the new `places.googleapis.com/v1/places:searchText`.

### Env var
Single key: `GOOGLE_PLACES_API_KEY` — read at `placesSearch.ts:60, 135`,
`ai-assistant/route.ts:64`, `commit/route.ts:138`, `places/photo/route.ts:20`,
`verification.ts:22, 55`. The GCP project behind this key must have
**"Places API"** enabled (the legacy product) — *not* just "Places API (New)".

### Filters — are they over-filtering?
`ai-assistant/route.ts:213`:
```
let filtered = enriched.filter(p => p.rating >= minRating && p.reviewCount >= minReviews);
if (maxPriceLevel) filtered = filtered.filter(p => !p.priceLevel || p.priceLevel <= maxPriceLevel);
```
With **Min Rating 4.5+ / Min Reviews 10+ / Max Price Any** (the live values
in the screenshot), the filter is selective on rating but lenient on reviews
and price. For a major destination like Bali, **thousands** of places clear
4.5+ / 10+ — the filter can absolutely not reduce to 0 if Google is returning
real data. **Filters are not the cause.**

### Silent swallow (the actual cause of "0")
`placesSearch.ts`:
1. **Line 62-64** — no API key → `return []` with `console.error` only. No
   `googleFetch` call, so quota counter does **not** increment.
2. **Line 73-76** — geocode returns empty results → `return []` silently.
3. **Line 97** — `if (!searchData.results) break;` — Google's error responses
   (`status: 'REQUEST_DENIED'`, `'OVER_QUERY_LIMIT'`, `'INVALID_REQUEST'`)
   typically come without a `.results` array. The loop silently breaks and the
   function returns whatever (often `[]`). The code **never inspects
   `searchData.status` or `searchData.error_message`** — Google's own error
   text is logged nowhere.
4. **Line 127-130** — `catch (err) { console.error; return []; }` swallows
   **every thrown error including `GooglePlacesQuotaError`** (the 429 the
   route's outer catch is supposed to surface).
5. **Line 147-149** — `getPlaceDetails` catch returns `null` silently.
6. **`ai-assistant/route.ts:74-82`** — `enrichPlaceDetails` per-place
   try/catch swallows errors too.

### Quota guard — not the cause
`googlePlacesQuota.ts`:
- `reserveCall()` upserts the month row with `callCount` incremented by 1,
  then `if (row.callCount > cap) throw`. Cap defaults to **5000**; first call
  goes `0 → 1`, well under the cap.
- `monthlyCap()` cannot return 0 (rejects 0/invalid env values).
- No "trip at 0" bug.

### `/api/places/usage` — the diagnostic key
`/api/places/usage/route.ts` returns `{ yearMonth, callCount, cap, pct }`.
The counter increments **inside `reserveCall` BEFORE the fetch is made**, so:

- **`callCount == 0`** → `GOOGLE_PLACES_API_KEY` is unset (or unreadable)
  in this environment — `placesSearch.ts:62-64` exits before `googleFetch`
  runs. The counter never increments. This is the **2nd most likely** Google
  cause.
- **`callCount > 0`** → calls **are** being made, Google is rejecting them
  with REQUEST_DENIED (most likely "Places API not enabled on this project"
  per the March 2025 freeze, since the user just turned billing back on —
  enabling billing on a GCP project does not auto-enable the legacy Places
  API). The error gets eaten at line 97 / 127. This is the **most likely**
  Google cause.

### Verdict — Google
The call path is sound and the filters are not aggressive enough to zero out
Bali. The "0 results" is **almost certainly a swallowed Google error**:
either the GCP project's Places API (Legacy) is not enabled (most likely
post-billing-reactivation), or the env var is unset (less likely — the rest
of the code path runs without console errors in the screenshot, suggesting
something IS happening). The `/api/places/usage.callCount` will tell which.

---

## Pipe 2 — Viator ("All (0)")

### What "All (0)" actually means
"Bookable Experiences" is **not** a separate live API call. It's a
**client-side filter** over `scannerResults` for the Viator COA categories
(`src/app/budgets/trips/[id]/page.tsx:1057-1065`):
```
const VIATOR_CATS = new Set(['sports_fitness', 'arts_culture', 'nightlife',
  'festivals', 'wellness', 'bucket_list', 'ground_transport']);
const viatorResults = scannerResults.filter(r => VIATOR_CATS.has(r.category));
const allRecs = viatorResults.flatMap(...);  // ← "All (0)" = this length
```
So "All (0)" reflects what's saved in `trip_scanner_results` for those
categories — which means **the scan saved zero rows for every Viator
category**.

### How Viator is supposed to fire (cited)
`ai-assistant/route.ts:135-167`:
```ts
if (isViatorCategory(category) && process.env.VIATOR_API_KEY) {
  try {
    const viatorProducts = await searchViatorProducts(...);
    if (viatorProducts.length === 0) {
      console.log("falling through to Google Places");
    } else { ... upsert, return; }
  } catch (viatorErr) { console.error("falling back to Google"); }
}
// Google path
```
So for each Viator category scan:
1. If `VIATOR_API_KEY` is unset → the entire Viator branch is **skipped**;
   it goes directly to Google. The Viator API never even fires.
2. If `VIATOR_API_KEY` is set and Viator returns >0 → saved.
3. If `VIATOR_API_KEY` is set and Viator returns 0 (errored-and-swallowed,
   or genuine empty) → falls through to Google.

In cases 1 and 3, the row saved to `trip_scanner_results` comes from Google.
And right now Google is also returning 0 (see Pipe 1). So
`trip_scanner_results.recommendations = []` for every Viator category →
"Bookable Experiences: All (0)".

### Viator silent-swallow points (cited)
`src/lib/viatorClient.ts`:
1. **`getApiKey()` :12-16** — throws `'VIATOR_API_KEY environment variable not set'`.
   This throw is itself fine — but every caller wraps it in a try/catch that
   logs and continues silently:
2. **`loadDestinations` V2 :70-83** — `try { fetch(...) } catch { console.error }`
   swallows the throw. Falls through to V1.
3. **`loadDestinations` V1 :86-99** — same pattern.
4. **`findDestinationId` :133** — returns `null` silently on no match.
5. **`searchV2Products` :280-284** — `if (!res.ok) { console.error(status,
   text); return []; }` — Viator API errors (401 auth, 403 forbidden, 429
   rate-limited) become silent `[]`.
6. **`searchV2Freetext` :308-312** — same.
7. **`searchV1Products` :338-342** — same.
8. **`searchViatorProducts` :382, :395, :406** — per-step `try/catch`
   swallows any error and continues.
9. **The outer `ai-assistant/route.ts:163-165` catch** — swallows any Viator
   error and silently falls through to Google with a `console.error`.

### Auth scheme + partner
`viatorClient.ts:18-26` — V2 uses header `'exp-api-key': <key>` plus
`'Accept': 'application/json;version=2.0'`. V1 (fallback) uses the same
header. Partner ID `'P00294427'` and MCID `'42383'` are baked in
(`:251-252`) for affiliate URL construction — they don't authenticate the
API; only `exp-api-key` does.

### Is the credential set?
We can't read Vercel from here, but we can infer:
- If `VIATOR_API_KEY` is **unset**, the route guard at `ai-assistant/route.ts:135`
  short-circuits the Viator branch entirely — no Viator API call is ever
  fired. Saved Viator-category results come purely from Google. This is the
  **most likely** Viator state given the rest of the system feels green
  ("no Viator errors in logs because Viator isn't being called").
- If it **is set** but invalid/expired, every Viator response is non-OK and
  swallowed at `:280, :308, :338`. The route falls through to Google.

### Verdict — Viator
"All (0)" is **almost certainly Google's empty result feeding through**:
either Viator is not being called (`VIATOR_API_KEY` unset → route skips the
branch → falls to Google → Google empty → save empty), or Viator is being
called but failing silently (key invalid/expired). The user can distinguish
by checking whether `VIATOR_API_KEY` is set in Vercel; if it is, the next
step is to look at server logs for `[Viator V2] /products/search failed`
(`viatorClient.ts:282, 310, 340`) or surface those errors to the UI.

---

## Pipe 3 — Duffel ("DUFFEL_API_TOKEN must be set")

### Where this message comes from
**It is not a runtime error from a real Duffel call.** It's a hardcoded
**static UI banner** in `src/components/trips/FlightPicker.tsx:591-595`:
```jsx
{!process.env.NEXT_PUBLIC_DUFFEL_ENABLED && (
  <div className="text-[10px] text-text-faint text-center">
    Note: DUFFEL_API_TOKEN must be set for live flight search. Manual entry always works.
  </div>
)}
```
The banner only appears when the **client-side flag**
`NEXT_PUBLIC_DUFFEL_ENABLED` is falsy.

### The actual API
`src/lib/duffel.ts:1-12`:
- Server reads `process.env.DUFFEL_API_TOKEN` (note: NOT `NEXT_PUBLIC_*`).
- `getHeaders()` throws `'DUFFEL_API_TOKEN not configured'` if unset.
- Route `src/app/api/flights/search/route.ts` calls `searchFlights(...)`;
  the throw would surface as a 500.

### Verdict — Duffel
This pipe is **honest about its failure** — the banner is exactly the
expected "missing config" message. **Two separate env vars** are involved:
- `DUFFEL_API_TOKEN` (server-side, real auth header value).
- `NEXT_PUBLIC_DUFFEL_ENABLED` (client-side, UI hint to hide the banner and
  enable the live-search button).
Both must be set for live flight search to work and for the banner to hide.
The user is right: this is just unset production config. **No code issue.**
(It's also the model of correct fail-loud behaviour for the other two pipes
to imitate.)

---

## Silent-swallow inventory across all three pipes (mandate violations)

| # | File:line | What gets swallowed | Becomes |
|---|---|---|---|
| 1 | `src/lib/placesSearch.ts:62-64` | Missing `GOOGLE_PLACES_API_KEY` | `[]` |
| 2 | `src/lib/placesSearch.ts:73-76` | Geocoding failure / REQUEST_DENIED | `[]` |
| 3 | `src/lib/placesSearch.ts:97` | Google `status: 'REQUEST_DENIED'` / `'OVER_QUERY_LIMIT'` / `'INVALID_REQUEST'` / billing-off | break + `[]` |
| 4 | `src/lib/placesSearch.ts:127-130` | **`GooglePlacesQuotaError`** + any thrown error | `[]` |
| 5 | `src/lib/placesSearch.ts:147-149` | Place Details errors | `null` |
| 6 | `src/app/api/trips/[id]/ai-assistant/route.ts:74-82` | Per-place enrichment quota/network errors | passthrough |
| 7 | `src/lib/viatorClient.ts:70-83` | V2 destination load errors (incl. missing key) | empty cache |
| 8 | `src/lib/viatorClient.ts:86-99` | V1 destination load errors | empty cache |
| 9 | `src/lib/viatorClient.ts:280-284` | V2 `/products/search` !ok (401/403/429/5xx) | `[]` |
| 10 | `src/lib/viatorClient.ts:308-312` | V2 `/search/freetext` !ok | `[]` |
| 11 | `src/lib/viatorClient.ts:338-342` | V1 `/search/products` !ok | `[]` |
| 12 | `src/lib/viatorClient.ts:382, 395, 406` | searchViatorProducts per-step errors | continue with what's collected |
| 13 | `src/app/api/trips/[id]/ai-assistant/route.ts:163-165` | Viator branch errors | fall through to Google silently |

Net effect: every infrastructure failure looks identical to the user — "0
results". Per the mandate, each should surface as a typed error with the
upstream provider's message.

---

## Per-pipe verdicts

### Google
- **Before-call vs after-call:** `/api/places/usage.callCount` decides.
  `> 0` → calls happening, Google rejecting (most likely "Places API not
  enabled" on the GCP project — billing being on isn't sufficient, the legacy
  API has to be explicitly enabled and it can't be enabled on projects that
  didn't have it on by March 2025). `== 0` → no calls being made (env var
  missing/unread).
- **Filters not the cause:** 4.5+ / 10+ / Any clears thousands of Bali
  places.
- **Most likely:** legacy Places API not enabled on the GCP project behind
  `GOOGLE_PLACES_API_KEY`, with the REQUEST_DENIED being eaten silently at
  `placesSearch.ts:97`.

### Viator
- **Most likely:** `VIATOR_API_KEY` is unset in Vercel → the route guard at
  `ai-assistant/route.ts:135` skips Viator entirely → Viator-category rows
  in `trip_scanner_results` come from Google, which is empty → "All (0)".
  Server logs would show no `[Viator]` lines at all in this case.
- **Second:** key is set but invalid/expired → 401/403 swallowed at
  `viatorClient.ts:280, 308, 338`. Server logs would show
  `[Viator V2] /products/search failed: 401 ...`.

### Duffel
- **Confirmed:** no code issue. The banner is hardcoded UI; it shows when
  `NEXT_PUBLIC_DUFFEL_ENABLED` is unset. Two env vars are needed
  (`DUFFEL_API_TOKEN` server + `NEXT_PUBLIC_DUFFEL_ENABLED` client). This
  is expected unset-prod-config behaviour. Manual flight entry still works.

---

## Proposed fixes — DO NOT IMPLEMENT YET, AWAIT APPROVAL

### A. Make failures surface — kill silent swallow (mandatory, both pipes)
Replace each `[]`-return on error path with a thrown typed error:

- New `src/lib/errors.ts` (or alongside each client) exporting:
  - `class GooglePlacesApiError extends Error { status; message; }`
  - `class MissingGoogleKeyError extends Error {}`
  - `class ViatorApiError extends Error { endpoint; status; body; }`
  - `class MissingViatorKeyError extends Error {}`
- `placesSearch.ts`:
  - No-key branch → throw `MissingGoogleKeyError`.
  - After each `searchRes.json()`, if `searchData.status !== 'OK' &&
    searchData.status !== 'ZERO_RESULTS'` → throw
    `GooglePlacesApiError(status, error_message)`.
  - Outer `catch` should re-throw `GooglePlacesQuotaError`,
    `MissingGoogleKeyError`, `GooglePlacesApiError` (do not eat them).
- `viatorClient.ts`:
  - `getApiKey()` already throws — let it propagate; remove the swallowing
    `try/catch` around it in `loadDestinations`, `searchV2*`, `searchV1*`.
  - On non-OK responses, throw `ViatorApiError(endpoint, status,
    text.substring(0,200))` instead of returning `[]`.
- `ai-assistant/route.ts` outer catch:
  - `GooglePlacesQuotaError` → 429 (already does this).
  - `MissingGoogleKeyError` → 500 `{ error: 'GOOGLE_PLACES_API_KEY not configured' }`.
  - `GooglePlacesApiError` → 502 `{ error: 'Google API: <status>: <message>' }`.
  - `MissingViatorKeyError` / `ViatorApiError` → log + fall through to
    Google (keep the existing fallback), but include the Viator error in
    the response payload so the UI can show a "Viator unavailable: …"
    secondary banner without losing the Google result.
- `TripPlannerAI.tsx` — already has an `error` state slot; display the
  message verbatim when the route returns non-OK with `error`.

### B. Verify env vars (config, no code)
- `GOOGLE_PLACES_API_KEY` — set in Vercel for the production env.
- In the **GCP project linked to that key**, enable **"Places API"**
  (legacy product) in addition to whatever is on now. If the project was
  created after March 2025 and "Places API" is not enableable, the only
  path forward is migrating the codebase to "Places API (New)" — bigger
  change (~6 endpoints, different JSON shape, header-based auth, required
  `X-Goog-FieldMask`). Out of scope of an env fix.
- `VIATOR_API_KEY` — confirm set and confirm partner P00294427 is active
  with Viator (the partner ID is baked in at `viatorClient.ts:251`).
- `DUFFEL_API_TOKEN` (server) + `NEXT_PUBLIC_DUFFEL_ENABLED=1` (client) —
  set both when you're ready for live flight search.

### C. One-command verification (zero code)
After (or before) approving (A), the user can:
1. Hit `GET /api/places/usage` — `callCount` distinguishes "no key" from
   "key works, API not enabled".
2. `curl "https://maps.googleapis.com/maps/api/place/textsearch/json?query=cafe+in+Bali&key=$GOOGLE_PLACES_API_KEY"` —
   the response `status` + `error_message` is the ground truth.

Sources:
- [Places API (Legacy) overview](https://developers.google.com/maps/documentation/places/web-service/legacy/overview-legacy)
- [Google Maps Platform deprecations](https://developers.google.com/maps/deprecations)
- [Google Places API (Legacy) Is Frozen — MapAtlas](https://mapatlas.eu/blog/google-places-api-legacy-deprecation-eu)
- [Text Search (New) — migration target](https://developers.google.com/maps/documentation/places/web-service/text-search)
