# LITEAPI CATALOG (TWO-STEP) HOTEL SEARCH — SCOPE AUDIT

**Goal:** scope LiteAPI's correct **two-step** hotel search — (1) resolve a city →
real LiteAPI `hotelId`s via the `/data/hotels` catalog, then (2) price those IDs via
`/hotels/rates` — to permanently fix "only Canggu," replacing the brittle raw
`cityName` single-step. Also: exactly what Alex must read in prod logs to confirm
the account is activated. **Read-only. No source modified.** `Missing = MISSING`.

Branch: `claude/audit-liteapi-catalog-flow` · main @ `f404842a`.

---

## 0. THE GATE — confirm the production account is ACTIVATED first

**Before any build, Alex reads these three log lines for a FAILING city (Lisbon)
on the prod deploy** (all already emitted by `searchHotelRates`):

1. **Mode + key:** `[LiteAPI] mode=<mode> keyPrefix=<first4>` — `liteapiClient.ts:240-241`.
2. **HTTP status:** `[LiteAPI] rates http: status=<n> ok=<bool>` — `:254`.
3. **Raw counts:** `[LiteAPI] rates raw: dataLen=<n> hotelsLen=<n> status=<n>` — `:264`.

**Decision (explicit gate):**
- `mode=production keyPrefix=prod…` **AND** `status=200` **AND** `dataLen=0`
  → **RESOLUTION bug.** The two-step catalog flow in this audit applies. **Build.**
- `status=401` or `403` (or a thrown `MissingLiteApiKeyError`, `:44`)
  → **LiteAPI production account is NOT activated** (or the prod key is wrong/unset).
  **No code fix helps** — Alex must activate/approve the production account with
  LiteAPI (and confirm `LITEAPI_PRODUCTION_KEY`) FIRST. Stop here until `status=200`.
- `mode=sandbox` or `keyPrefix=none` → the env didn't take effect on the running
  deployment (config), not code.

**This gate is non-negotiable:** if Lisbon is `401/403`, neither the two-step nor
the coords quick-fix returns data — the account is the blocker.

---

## 1. THE CATALOG ENDPOINT (step 1) — MISSING, but the pattern is known

### No city-list fn exists today
- grep for `/data/hotels` (plural) / `getCityHotels` / `listHotels` / `hotelList`
  in `liteapiClient.ts` → **zero hits. MISSING.** The client only ever lists hotels
  implicitly through `/hotels/rates`; it never calls a city catalog.

### The exact template to copy — `getHotelContent` (`/data/hotel`, singular)
`getHotelContent(hotelId)` (`liteapiClient.ts:821-844`) is the precise blueprint for
a new `getCityHotels(cityName, countryCode)`:
- `new URLSearchParams({ … })` (`:822`)
- `mode`/`keyPrefix` log (`:824-826`)
- `fetch(\`${LITEAPI_BASE}/data/<endpoint>?${params}\`, { method:'GET',
  headers: headers() })` (`:828-831`) — `headers()` already sends `X-API-Key`
  (`:48-53`), and `LITEAPI_BASE` is the same host for both modes (`:22`).
- `status` log (`:832`) → `if (!res.ok) throw new LiteApiError(...)` (`:833-834`)
  → `return json?.data` (`:836-837`).
- `getHotelReviews` (`/data/reviews`, `:752-776`) is a second example of the same
  `GET /v3.0/data/*` auth+base+error pattern.

So **base URL, auth header, error discipline, and logging are all already proven
for `/v3.0/data/*`** — a `/data/hotels` fn reuses them verbatim.

### Return shape — scope from `/data/hotel`, CONFIRM live
LiteAPI's `GET /v3.0/data/hotels?cityName=&countryCode=` returns a **list** of
hotels for the city. Each item is expected to resemble the singular `HotelContent`
(`:800-817`: `{ id, name, address, city, country, location:{latitude,longitude},
starRating, rating, hotelImages, … }`) but the LIST endpoint typically returns a
**leaner** record (id + name + coords + a thumbnail). **TRUTH-FIRST: the exact list
item shape — especially the ID field name (`id` vs `hotelId`) and whether coords/
images are included — MUST be confirmed against the live API with the prod key
before the normalizer/ID-extractor is written. No guessed shape ships.** (The rates
parser already hedges `id ?? hotelId`, `:286-288` — the same hedge applies here.)

---

## 2. THE RATES-BY-IDS PATH (step 2) — needs a `hotelIds` param + body branch

### What `/hotels/rates` accepts
- Today the client sends the **cityName branch**: `{ cityName, countryCode, checkin,
  checkout, occupancies, … }` (`liteapiClient.ts:223-236`), or the **coords branch**
  `{ latitude, longitude, radius, countryCode, … }` (`:210-222`).
- `SearchHotelsParams` has **no `hotelIds` field** (`:121-144`) — only city/country/
  dates/occupancies + optional lat/lng/radius. So **ID-based pricing is not
  expressible through the client today.**
- LiteAPI's `/hotels/rates` accepts a **`hotelIds: string[]`** body field (price a
  specific set of hotels) as an alternative to `cityName`/coords. **CONFIRM the
  exact field name (`hotelIds`) + that it coexists with `checkin/checkout/
  occupancies` against the live API** before wiring.

### Additions needed (note, not code)
- Add `hotelIds?: string[]` to `SearchHotelsParams` (`:121-144`).
- Add a body branch in `searchHotelRates`: when `hotelIds` present, send
  `{ hotelIds, checkin, checkout, occupancies, currency, guestNationality,
  includeHotelData:true }` — mirroring the existing two branches (`:210-236`).
- The **response parsing is unchanged**: the rates response still returns
  `data.data[]` (rate items keyed by `hotelId`) + parallel `data.hotels[]` metadata
  (`:284-288`), and `liteApiHotelToRecommendation` (`:472`) still maps it. So **step
  2 reuses the entire existing parse + mapper** — only the request body gains an
  IDs branch.

---

## 3. THE WIRING (smallest two-step)

```
public route (api/travel/hotels/search/route.ts)
  1. rateLimit('hotel-search:'+ip)          # unchanged (route.ts existing)
  2. validate city/country/dates → 400      # unchanged
  3. reserveTravelSearch('liteapi')         # ONE reservation per user search (:61)
  4. ids = await getCityHotels(city, country)        # STEP 1 (new client fn)
     → cap to first ~30–50 ids
  5. hotels = await searchHotelRates({ hotelIds: ids, checkin, checkout, … })  # STEP 2
  6. results = hotels.map(liteApiHotelToRecommendation)   # unchanged (:81)
```
- Slots in: the route already does one `reserveTravelSearch('liteapi')` (`route.ts:61`)
  then one `searchHotelRates(...)` (`:66`) → mapper (`:81`). The change inserts
  **step 1 before step 2** and swaps `searchHotelRates`'s args from `{city,country}`
  to `{hotelIds}`.

### Cap accounting (1 user-search = 2 upstream calls now)
- **Recommendation: keep ONE `reserveTravelSearch('liteapi')` per user search**
  (the cap is per *user search*, not per HTTP call) — placed once before step 1, as
  today (`route.ts:61`). Do NOT reserve twice.
- **BUT flag the cost:** the two-step makes **2 LiteAPI HTTP calls per search**
  (catalog + rates) instead of 1. `/data/hotel` and `/data/reviews` are annotated as
  **PAID (B-5100 COGS)** calls (`:791-792`, `:731`); `/data/hotels` is likely paid
  too. So worst-case upstream spend per search ~doubles even though the cap counts
  it once. Set `TRAVEL_SEARCH_DAILY_CAP_LITEAPI` with that 2× in mind.

### Pagination / fan-out
- `/data/hotels` can return **hundreds** of hotels for a big city. Pricing all of
  them in `/hotels/rates` would be a huge body + slow. **Cap the IDs priced to the
  first ~30–50** (matches the UI's needs; the scroller shows a handful). Cite this
  as a required bound in step 1→2.

### THE CRUX — is `/data/hotels` cityName matching more reliable than `/hotels/rates`?
- This is **the make-or-break question.** The two-step only fixes "only Canggu" **if
  `/data/hotels?cityName=Lisbon&countryCode=PT` actually returns hotels** where
  `/hotels/rates?cityName=Lisbon` returns empty.
- **Likely yes:** `/data/hotels` is LiteAPI's *catalog/search* endpoint (purpose-built
  for "find hotels in a city"), generally more tolerant than the rates *filter*. But
  **CONFIRM live with the prod key** — call `/data/hotels?cityName=Lisbon&
  countryCode=PT` and check it returns a non-empty list. **If `/data/hotels` ALSO
  returns empty for Lisbon, the catalog flow does NOT fix it** and the real lever is
  **coordinates** (see the quick-fix comparison) — i.e. resolve Lisbon→coords and use
  the geo branch. So the FIRST build step is a live probe of `/data/hotels`, not code.

---

## REPORT — EXISTS | MISSING | RECOMMENDATION

### EXISTS
- `/v3.0/data/*` GET pattern (base + `X-API-Key` + error + logging): `getHotelContent`
  (`:821-844`), `getHotelReviews` (`:752-776`) — the template for `getCityHotels`.
- The rates response parser + `liteApiHotelToRecommendation` mapper (`:284-288`,
  `:472`) — **reused unchanged** by step 2.
- One `reserveTravelSearch('liteapi')` per search (`route.ts:61`) — keep as-is.

### MISSING
- A `getCityHotels(cityName, countryCode)` client fn (`/data/hotels`) — net-new.
- `hotelIds?: string[]` on `SearchHotelsParams` (`:121-144`) + the IDs body branch in
  `searchHotelRates` (`:210-236`).
- The two-step wiring in the public route.
- **Live-confirmed** `/data/hotels` list shape (ID field, coords) + confirmation
  `/hotels/rates` takes `hotelIds[]` — both **prod-key probes**, no guessed shapes.

### RECOMMENDATION

**Step 0 (gate, no code):** Alex reads the Lisbon logs (§0). If `401/403` → activate
the LiteAPI production account first; STOP. If `200/dataLen=0` → proceed. Then run a
one-off **live probe** of `/data/hotels?cityName=Lisbon&countryCode=PT` with the prod
key to confirm it returns hotels (the crux, §3) and to capture the real list shape.

**Smallest atomic-PR chain (the two-step), gated on the probe:**
1. **PR-1 — `getCityHotels` client fn** (`/data/hotels`, modeled on `getHotelContent`)
   + `hotelIds?: string[]` on `SearchHotelsParams` + the IDs body branch in
   `searchHotelRates`. Normalizer/ID-extractor written ONLY against the probed live
   shape. (No route change yet.)
2. **PR-2 — wire the public route** two-step: `getCityHotels` → cap ~30–50 IDs →
   `searchHotelRates({hotelIds})` → existing mapper. Keep one `reserveTravelSearch`;
   document the 2× upstream-call cost.

**Honest size — small chain (2 PRs), and a real tradeoff vs the coords quick-fix:**

| | Coords quick-fix | Two-step catalog flow |
|---|---|---|
| Size | **1 small PR** — pass `findDestinationCoords` lat/lng (tolerant match) on the public route; reuse the EXISTING geo branch (`:210-222`). No new endpoint. | **2 PRs** — new `/data/hotels` fn + `hotelIds` param + wiring. |
| Coverage | Only cities **in our static catalog** (`destinations.ts`); long-tail user-typed cities with no stored coords still miss. | **Any city LiteAPI knows** — no dependence on our static catalog. |
| Upstream calls | 1 per search. | **2 per search** (catalog + rates) — ~2× paid COGS. |
| Confidence | High (geo branch already proven robust per the code's own comments, `:135-138`). | High **only after** the live `/data/hotels` probe confirms it's more tolerant than the rates filter. |
| Risk | Misses cities not in our catalog. | Bigger surface; needs live-shape confirmation; 2× cost. |

**Suggested path:** ship the **coords quick-fix first** (1 PR, immediate relief for
catalog cities, reuses proven code), then the **two-step catalog flow** as the
durable fix for arbitrary long-tail cities — but only after the `/data/hotels` live
probe proves it returns where the rates filter doesn't. **Every shape/field marked
above is prod-key-confirm; no guessed response ships.** No code modified in this
audit.
