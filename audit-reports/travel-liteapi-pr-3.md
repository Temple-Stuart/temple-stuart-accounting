# Travel-LiteAPI-PR-3 — Accommodation via LiteAPI (bookable inventory)

Builds on PR-1 (typed errors — now on `main` as `692b5a69`) and PR-2
(`SOURCE_BY_CATEGORY` registry — on its branch, rebased into this PR's
history). PR-3 turns hotels into bookable inventory. Branch:
`claude/travel-liteapi-pr-3`. Stack: `origin/main` → PR-2 registry → PR-3
LiteAPI changes.

> **Scope held:** SEARCH-only. Prebook → book → payment SDK + commission
> tracking is the next PR. After this PR, the scan returns real LiteAPI
> hotels into `trip_scanner_results.recommendations`; the UI's existing
> commit→budget spine handles them.

---

## 1. New client — `src/lib/liteapiClient.ts` (286 lines)

### Endpoint + auth
- **Endpoint:** `POST https://api.liteapi.travel/v3.0/hotels/rates` (one call
  per scan — city + dates → hotels with rates in one round-trip).
- **Auth header:** `X-API-Key: <key>`.
- **Mode-by-env (mirrors `src/lib/duffel.ts:1-12`):**
  - `LITEAPI_MODE` env (`'sandbox' | 'production'`, defaults to `sandbox`).
  - `LITEAPI_SANDBOX_KEY` used in sandbox mode.
  - `LITEAPI_PRODUCTION_KEY` used when `LITEAPI_MODE=production`.
  - Both env vars added to `.env.example:67-77`.

### Typed errors (PR-1 fail-loud pattern)
Added to `src/lib/travelErrors.ts:63-90`:
- **`MissingLiteApiKeyError(mode)`** — thrown when the active mode's key is
  unset. Carries the mode so the banner can name the exact env var
  (`LITEAPI_SANDBOX_KEY` vs `LITEAPI_PRODUCTION_KEY`) the operator must set.
- **`LiteApiError(endpoint, status, body)`** — thrown on any non-2xx response
  (401/403 auth, 422 invalid params, 429 rate-limit, 5xx server). Carries
  truncated body so the user sees LiteAPI's actual error message.
- Both added to the `isTravelProviderError` type guard
  (`travelErrors.ts:102-122`).

### Request body sent to `/v3.0/hotels/rates`
```json
{
  "cityName":         "Bali (Canggu)",
  "countryCode":      "ID",
  "checkin":          "2026-06-15",
  "checkout":         "2026-06-22",
  "occupancies":      [{ "adults": 2 }],
  "currency":         "USD",
  "guestNationality": "US"
}
```
- `cityName` + `countryCode` come from the request body (the trip's
  destination). City name is passed through verbatim; the country name
  is converted via `countryNameToIso2()` (`liteapiClient.ts:60-92`) — a
  ~100-entry lookup covering every country currently in
  `src/lib/destinations.ts` plus common travel destinations. Unknown
  country names throw `LiteApiError('countryNameToIso2', 400, ...)`
  rather than defaulting to the wrong country.
- `checkin` / `checkout` come from the trip's `startDate` / `endDate`
  (looked up via `tripId` in the route — see §2).
- `occupancies` derived from `trip_participants.count` (one adult per
  participant; clamped to ≥ 1).
- `currency` defaults `USD`; `guestNationality` defaults `'US'`.
  Configurable later when the booking flow plumbs user nationality.

### Response → recommendation shape (mirrors Viator's mapper)
`liteApiHotelToRecommendation(hotel, idx, category)` at
`liteapiClient.ts:194-273` produces the **exact same keys** that
`viatorProductToRecommendation` (`src/lib/viatorClient.ts:426-512`)
produces — the contract the UI + commit spine consume:

| Recommendation field | Source (LiteAPI → ours) |
|---|---|
| `name` | `hotel.name` |
| `address` | `hotel.address` or `hotel.city` |
| `photoUrl` | `hotel.main_photo` or `hotel.thumbnail` |
| `price` | lowest nightly USD from `roomTypes[].rates[].retailRate.total[0].amount` (helper `extractNightlyRate`, `liteapiClient.ts:178-191`) |
| `priceLevel` / `priceLevelDisplay` | bucketed: <$80 = `$`, <$200 = `$$`, <$400 = `$$$`, else `$$$$` (helper `nightlyToPriceLevel`, `:193-200`) |
| `googleRating` | `hotel.rating` (normalised: if >5, treat as 0-10 and divide by 2) else `hotel.starRating` else `hotel.stars` |
| `reviewCount` | `hotel.reviewCount` |
| `summary` | `hotel.hotelDescription` (HTML-stripped, 300 chars) |
| `sentiment` / `sentimentScore` / `fitScore` / `compositeScore` | identical formula to Viator's — rating-derived, no AI |
| `liteapiHotelId` | `hotel.hotelId` (replaces `viatorProductCode` as the bookable-signal field — the booking PR uses this to call `/v3.0/prebook`) |
| `bookingUrl` | `null` in PR-3 (added when the booking flow PR ships `/prebook → /book`) |
| `category`, `valueRank`, `warnings`, `trending`, `website`, `durationMinutes` | per the contract — same defaults Viator/Google use |

### Sources
- [LiteAPI — POST /hotels/rates reference](https://docs.liteapi.travel/reference/post_hotels-rates)
- [LiteAPI — Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI — Hotel Rates JSON Data Structure](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)

---

## 2. Route integration — `ai-assistant/route.ts`

### Dispatch widened (cited)
`route.ts:172` — the registry's "unimplemented source" guard widens from
`source !== 'google' && source !== 'viator'` to
`source !== 'google' && source !== 'viator' && source !== 'liteapi'`. Same
pattern PR-2 established; one extra term per provider.

### LiteAPI branch (`route.ts:181-235`)
Sits between the registry unimplemented-source check and the Viator branch.
Mirrors the Viator branch structure exactly:

```ts
if (source === 'liteapi') {
  // Look up dates + participant count from the trip (the scan body doesn't
  // carry them; LiteAPI's /hotels/rates requires both).
  const trip = await prisma.trips.findFirst({
    where: { id: tripId },
    select: { startDate: true, endDate: true },
  });
  if (!trip?.startDate || !trip?.endDate) {
    throw new Error('Trip dates required for hotel search — set Start/End on the trip first');
  }
  const participantCount = await prisma.trip_participants.count({ where: { tripId } });
  const adults = Math.max(1, participantCount);
  const checkin  = trip.startDate.toISOString().slice(0, 10);
  const checkout = trip.endDate.toISOString().slice(0, 10);

  const hotels = await searchHotelRates({
    city, country, checkin, checkout,
    occupancies: [{ adults }],
    maxResults,
  });

  const finalResults = hotels
    .map((h, idx) => liteApiHotelToRecommendation(h, idx, category))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, maxResults)
    .map((rec, idx) => ({ ...rec, valueRank: idx + 1 }));

  await prisma.trip_scanner_results.upsert({ ... });   // same call Viator/Google use
  return NextResponse.json({ category, recommendations: finalResults });
} catch (liteApiErr) {
  // hardBookable Accommodation — NEVER fall through to Google.
  throw liteApiErr;
}
```

### Outer catch — typed-error → structured HTTP (cited)
`route.ts:308-322` adds two branches alongside PR-1's existing Google/Viator
ones:
```ts
if (err instanceof MissingLiteApiKeyError) {
  return NextResponse.json(
    { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode, category },
    { status: 500 }
  );
}
if (err instanceof LiteApiError) {
  return NextResponse.json(
    { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status, category },
    { status: 502 }
  );
}
```
Same shape PR-1 used for Google/Viator — UI's existing
`"Couldn't load <Category> — <upstream message>"` banner renders them as-is.

### Google + Viator paths untouched (cited)
- Google path (`route.ts:267-301`): unchanged — same `searchPlacesMultiQuery`
  → `enrichPlaceDetails` → filter → map → upsert.
- Viator path (`route.ts:237-265`): unchanged. PR-2's rebase merged PR-1's
  fail-loud handling cleanly into this PR's tree — Viator's catch
  re-throws missing-key + 4xx (PR-1) and rethrows everything when
  `hardBookable` (PR-2).
- `git diff origin/main -- src/lib/placesSearch.ts` = 0 lines (this PR
  doesn't touch Google's client).
- `git diff origin/main -- src/lib/viatorClient.ts` = 0 lines (this PR
  doesn't touch Viator's client).

---

## 3. Registry flip — `src/lib/travelSourceRegistry.ts`

### Before (PR-2)
```ts
// TEMPORARY: accommodation stays on Google so live hotel discovery does
// NOT regress before the LiteAPI client lands. Flip to
// { source: 'liteapi', hardBookable: true } in the LiteAPI PR.
accommodation:    { source: 'google', hardBookable: false }, // TODO(LiteAPI PR)
```

### After (this PR)
```ts
// Accommodation: BOOKABLE inventory via LiteAPI (merchant-of-record).
// hardBookable means empty/error stays loud — no Google masking. The
// LiteAPI client lives at src/lib/liteapiClient.ts; the booking flow
// (prebook → book → payment) is a later PR.
accommodation:    { source: 'liteapi', hardBookable: true },
```

TODO comment removed. `isSourceImplemented(source)` (`travelSourceRegistry.ts:107`)
also updated — now returns `true` for `google | viator | liteapi`.

---

## 4. Shape + commit spine unchanged

- **`trip_scanner_results` shape:** unchanged.
  `git diff origin/main -- prisma/schema.prisma` = 0.
  LiteAPI results land in the same `recommendations: Json` column with the
  same keys the UI reads.
- **Commit spine (`/api/trips/[id]/vendor-commit`):** unchanged.
  `git diff origin/main -- src/app/api/trips/[id]/vendor-commit/route.ts` = 0.
  Confirmed source-agnostic in earlier audits — accepts
  `{optionType: 'lodging', optionId, startDate, endDate, ...}`. A LiteAPI
  hotel commits exactly like a Google place or a manually-entered hotel: the
  client first POSTs to `/api/trips/{id}/lodging` (creates the
  `trip_lodging_options` row from the recommendation), then POSTs to
  `/vendor-commit` to flip it to committed.
- **No new option tables**, no migration. The `liteapiHotelId` field on the
  recommendation is metadata; the booking flow PR will surface it during
  prebook/book.
- **Traveler-count flow:** unchanged. The route reads
  `trip_participants.count` for occupancy but doesn't write/mutate it. The
  upstream `barTravelers → /new` data loss (per the earlier audit) is the
  separate PR-B's territory.

---

## 5. End-to-end example: a Bali search

1. User opens trip ("Bali (Canggu)" → "Indonesia", check-in 2026-06-15,
   check-out 2026-06-22, 2 participants).
2. UI fires `POST /api/trips/{tripId}/ai-assistant` with
   `{ category: 'accommodation', city: 'Bali (Canggu)', country: 'Indonesia', ... }`.
3. Route looks up `accommodation` in the registry →
   `{ source: 'liteapi', hardBookable: true }`.
4. Dispatch enters the LiteAPI branch. Fetches trip dates + participant
   count from Prisma.
5. Calls `searchHotelRates({ city: 'Bali (Canggu)', country: 'Indonesia',
   checkin: '2026-06-15', checkout: '2026-06-22', occupancies: [{adults: 2}] })`.
6. Client converts `'Indonesia'` → `'ID'` via `countryNameToIso2`, POSTs to
   `https://api.liteapi.travel/v3.0/hotels/rates` with the
   `X-API-Key: $LITEAPI_SANDBOX_KEY` header.
7. LiteAPI returns hotels. Mapper turns each into the canonical
   recommendation shape (name / address / photoUrl / nightly rate USD /
   googleRating / etc.).
8. Sorted by `compositeScore`, sliced to `maxResults` (33), `valueRank`
   re-assigned 1..N.
9. Upserted into `trip_scanner_results` keyed by `(tripId, "Bali (Canggu), Indonesia", "accommodation")`.
10. Response: `{ category: 'accommodation', recommendations: [...] }`.
11. UI renders the Accommodation card grid using the same component that
    renders Viator/Google results today. Each card shows the photo, name,
    rating, `$$` price tier, address, and a Commit button. **The price
    shown is a real nightly LiteAPI rate** — not a Google-derived guess.

### What happens when LiteAPI is misconfigured

| Scenario | New banner |
|---|---|
| `LITEAPI_SANDBOX_KEY` unset (default mode) | `Couldn't load Accommodation — LITEAPI_SANDBOX_KEY is not configured` |
| `LITEAPI_MODE=production` + `LITEAPI_PRODUCTION_KEY` unset | `Couldn't load Accommodation — LITEAPI_PRODUCTION_KEY is not configured` |
| Key invalid/expired | `Couldn't load Accommodation — LiteAPI: /v3.0/hotels/rates returned 401 — <LiteAPI body>` |
| Invalid country code | `Couldn't load Accommodation — LiteAPI: countryNameToIso2 returned 400 — Unsupported country "X"` (caught at the client; never reaches LiteAPI) |
| Trip missing startDate/endDate | `Couldn't load Accommodation — Trip dates required for hotel search — set Start/End on the trip first` |
| Network/timeout | bubbles as `500` with `err.message` |

Per the locked architecture, **no scenario silently falls back to Google
for Accommodation.** Empty LiteAPI returns persist as empty
`trip_scanner_results` row and the UI shows zero hotels (honest).

---

## Constraints verified

- **Scope:** SEARCH only — `/hotels/rates` is the single LiteAPI endpoint
  called. No prebook/book/payment/SDK touched.
- **Sandbox-vs-production:** `LITEAPI_MODE` env flips it; default is sandbox.
  Production deploy is a one-env-var change (`LITEAPI_MODE=production`)
  once `LITEAPI_PRODUCTION_KEY` is set.
- **Fail-loud:** all upstream failures map to typed errors; route maps each
  to a structured HTTP response; UI renders banners.
- **No Google fallback for Accommodation:** the LiteAPI branch's catch
  always re-throws (Accommodation is `hardBookable: true`).
- **Viator/Google paths untouched:** zero diff against `origin/main` on
  `placesSearch.ts`, `viatorClient.ts`.
- **Shape / commit / count untouched:** zero diff on
  `prisma/schema.prisma`, `vendor-commit/route.ts`, `TripCreationBar.tsx`,
  `app/budgets/trips/new/page.tsx`, `app/api/trips/route.ts`.
- **`npx tsc --noEmit` → exit 0.**
- **Lint:** baseline on the four edited files = 9 errors; after this PR =
  11 (+2). The +2 are `recommendations: finalResults as any` on the upsert
  call in the new LiteAPI branch — **identical to the `as any` pattern the
  Viator and Google branches in this same file already use** (PR-1 +
  PR-2's baseline). Repo has `eslint.ignoreDuringBuilds: true` in
  `next.config.ts`; both new files (`liteapiClient.ts`, registry edit) are
  lint-clean on their own. `liteapiClient.ts` is fully `any`-free except
  for the loose `LiteApiHotelRate` interface which is typed not `any`.

---

## Changeset

```
 A  audit-reports/travel-liteapi-pr-3.md          (this report)
 M  .env.example                                   (LITEAPI_* env vars)
 M  src/app/api/trips/[id]/ai-assistant/route.ts   (LiteAPI branch + outer catch)
 A  src/lib/liteapiClient.ts                       (new: search + mapping, 286 lines)
 M  src/lib/travelErrors.ts                        (LiteAPI typed errors)
 M  src/lib/travelSourceRegistry.ts                (accommodation → liteapi)
 A  src/lib/travelSourceRegistry.ts                (from rebased PR-2)
 A  audit-reports/travel-registry-pr-2.md          (from rebased PR-2)
```

## What ships next (out of scope here)

The booking flow PR. It will:
1. Add `/prebook` and `/book` endpoints to `liteapiClient.ts`.
2. Wire LiteAPI's payment SDK into the Commit button for `accommodation`
   cards (currently the Commit button writes to `trip_lodging_options` +
   `vendor-commit`; the booking PR adds a real-money prebook → book step
   in between, then writes the resulting `confirmationNumber` and
   `clientReference` onto the lodging option).
3. Track LiteAPI's commission on each booking (margin we set), write a
   `commission_earned` field, surface in an admin payouts view.
4. Populate `bookingUrl` on the recommendation (currently `null`) so cards
   show a "Book Now" deep-link as a backup to the in-app flow.

Sources:
- [LiteAPI — POST /hotels/rates](https://docs.liteapi.travel/reference/post_hotels-rates)
- [LiteAPI — Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI — Hotel Rates JSON Data Structure](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)
- [LiteAPI — Endpoints overview](https://docs.liteapi.travel/reference/api-endpoints-overview)
- [LiteAPI — Complete a booking (next PR)](https://docs.liteapi.travel/reference/post_rates-book)
