# HOTELS PRODUCTION DIAGNOSTIC — why production didn't fix "only Canggu"

**Symptom:** Alex set `LITEAPI_MODE=production` in Vercel + deployed, but the
PUBLIC hotel search STILL returns results only for Canggu — Lisbon, Tokyo, etc.
come back empty. Read-only diagnosis of the three suspects. **No source modified.**

Branch: `claude/audit-hotels-still-canggu` · main @ `f404842a`.

---

## TL;DR — ROOT CAUSE

**Suspect 2 + 3 (city resolution missing / wrong flow) — NOT suspect 1.**
Production mode IS honored by the code; flipping it fixed *inventory availability*
(sandbox only had a tiny test set). But the public search **still sends LiteAPI a
raw, free-text `cityName` string with no place-ID, no coordinates, and no catalog
lookup** — and LiteAPI's `cityName` matching on `/hotels/rates` is brittle, so
cities whose names don't exactly match LiteAPI's catalog return **`200 OK` with an
empty array**. Canggu happens to match; Lisbon/Tokyo don't. **The earlier audit's
#1 (sandbox) was a red herring once production was on — the real #1 is the missing
city→location resolution.**

---

## SUSPECT 1 — Is production actually on? → YES, the code honors it

- **Mode read is correct + uncached:** `getMode()` returns `'production'` iff
  `process.env.LITEAPI_MODE === 'production'`, else `'sandbox'`
  (`liteapiClient.ts:35-37`). It reads `process.env` on **every call** — no
  module-level memo, no cached sandbox value. So a deployed `LITEAPI_MODE=production`
  is honored.
- **Key selection is correct:** in production mode `getApiKey()` uses
  `LITEAPI_PRODUCTION_KEY`, in sandbox `LITEAPI_SANDBOX_KEY`
  (`liteapiClient.ts:39-46`). If the production key were unset it would **throw
  `MissingLiteApiKeyError('production')`** (`:44`) → the route returns a 500, NOT an
  empty list — so "empty" rules out a missing-key throw (a 500 would look different).
- **Base URL is correctly single-host:** `LITEAPI_BASE =
  'https://api.liteapi.travel/v3.0'` is hardcoded for BOTH modes (`:22`). This is
  **not a bug** — LiteAPI v3 uses the *same* host for sandbox and production; the
  environment is selected by the **key** (`sand_…` vs `prod_…`), not the URL. So
  "mode flipped but URL stayed sandbox" does not apply here.
- **Definitive runtime check (logs already in code):** `[LiteAPI] mode=<mode>
  keyPrefix=<first4>` (`:240-241`) prints the live mode + key prefix on every
  search. If it shows `mode=production keyPrefix=prod` then production is genuinely
  active and the empties are NOT a mode/key problem. If it shows `keyPrefix=none`
  or `mode=sandbox`, the env didn't take effect (config, not code).

**Verdict:** no code reason production wouldn't take effect. The remaining
config-only caveats (confirm via logs): the production key is actually set, and the
LiteAPI **production account is fully activated/approved** — an un-activated prod
account can return empty/401 even with the flag on (see "Commission/activation").

---

## SUSPECT 2 — How is the city resolved? → It ISN'T (raw cityName only)

### What the public flow actually sends to LiteAPI
For "Lisbon" (and every public search), `searchHotelRates` takes the **non-coords
branch** and POSTs to `/v3.0/hotels/rates` a body of:
```
{ cityName: extractCityName(params.city),   // e.g. "Lisbon"
  countryCode,                              // e.g. "PT" (from countryNameToIso2)
  checkin, checkout, occupancies,
  currency, guestNationality, includeHotelData: true }
```
(`liteapiClient.ts:223-236`; `url = ${LITEAPI_BASE}/hotels/rates` `:244`.)

- The coords branch (`useCoords`) only runs when `params.latitude`/`longitude` are
  numbers (`:208`). **The public path never provides them** — `PublicHotelSearch`
  sends only city/country/dates/adults, and the public route does no server-side
  coord lookup. So **every public search is the brittle `cityName` branch.**
- `SearchHotelsParams` supports **only** `city`/`country`/dates/`occupancies` +
  optional `latitude`/`longitude`/`radiusMeters` (`:121-144`). **There is NO
  `placeId` and NO `hotelIds` field** — the two precise identifiers LiteAPI prefers
  are not even expressible through this client on the search path.

### Why a raw cityName is the problem
- The code's OWN comments admit it: cityName is *"brittle for parenthesised labels
  … and city/neighborhood ambiguity"* (`:204-205`), and coords are *"more tolerant
  of city-name spelling variants"* (`:137-138`). LiteAPI resolves `cityName`
  against its internal catalog; if the spelling/casing/canonical name doesn't match
  (common for major cities catalogued under a metro/region name), it returns a
  **200 with `data: []`** — not an error.
- **"Canggu works" is essentially a coincidence of catalog match:** the filter IS
  being applied (else Lisbon would return *some* PT hotels and it doesn't) — Canggu's
  cityName happens to match LiteAPI's catalog, Lisbon/Tokyo's don't. Production
  didn't change this because the resolution path is identical in both modes.

**Verdict:** the public search has **no city→location resolution** — it hands
LiteAPI a string and hopes. This is the dominant cause.

---

## SUSPECT 3 — Is there a destination catalog we should use first? → YES, and we skip it

### We call the rates endpoint with no catalog step
Every LiteAPI endpoint the client touches:
- `POST /v3.0/hotels/rates` — search (`:244`)
- `POST /v3.0/rates/prebook` (`:625`), `POST /v3.0/rates/book` (`:705`) — booking
- `GET /v3.0/data/reviews?hotelId=…` (`:770`), `GET /v3.0/data/hotel?hotelId=…`
  (`:828`) — per-hotel content, **looked up BY hotelId**

There is **NO `/v3.0/data/hotels` (city hotel-list) and NO `/data/cities` /
`/data/places` lookup anywhere** (grep for `/data/hotels`, `hotelIds`, `placeId`,
`/data/cities`, `/data/places` → zero hits). So the client never turns a city into
LiteAPI hotel IDs before pricing.

### The correct LiteAPI flow vs ours
LiteAPI's robust hotel-search pattern is a **two-step**: (a) resolve the area to
hotels — `GET /v3.0/data/hotels?cityName=…&countryCode=…` (or a place/coords
lookup) → a list of `hotelId`s — then (b) `POST /v3.0/hotels/rates` with
`hotelIds[]` (or with coordinates). **We do only step (b), and only with a raw
`cityName`** — skipping the catalog/ID resolution entirely. (The note at `:160`
references "/data/hotel" content but that is the singular, by-hotelId content
endpoint, not the city catalog.)

**Verdict:** yes — there is a destination/hotel catalog step (`/data/hotels` and/or
coords) that the correct flow uses first; we skip it. This is the structural form
of the same bug as Suspect 2.

---

## SUSPECT 4 — Confirm with logs (200-empty vs error)

The route + client already log everything needed to split the two failure modes —
read these for a failing city (e.g. Lisbon) in the production deploy:
- `[LiteAPI] mode=production keyPrefix=prod…` (`:240-241`) → proves production +
  prod key are live (rules out Suspect 1).
- `[LiteAPI] rates http: status=200 ok=true` (`:254`) → the call **succeeded**
  (rules out auth/key/URL errors).
- `[LiteAPI] rates raw: dataLen=0 hotelsLen=0 status=200` (`:264`) → a **200-empty**
  upstream response → confirms **resolution/coverage**, not an error.

Expected reading for Lisbon: `mode=production`, `status=200`, `dataLen=0` ⇒ the
provider accepted the request and returned **no hotels for that cityName** — i.e.
resolution, exactly Suspects 2/3. (If instead you see `status=401/403` or a
`MissingLiteApiKeyError`, that flips it to a key/activation problem under Suspect 1.)

---

## REPORT — ROOT CAUSE + SMALLEST FIX

### Root cause (plainly)
**Suspect 2 + 3: city→location resolution is missing.** The public hotel search
sends LiteAPI a raw `cityName` string (`liteapiClient.ts:223-236`) with no
coordinates, no `placeId`, and no `/data/hotels` catalog lookup — and LiteAPI's
`cityName` match on `/hotels/rates` is brittle, so non-matching cities return
**200-empty**. **Suspect 1 (production) is honored in code** — turning it on fixed
sandbox's missing inventory but could not fix the resolution path, which is
identical in both modes. (The prior audit over-weighted sandbox; production being
on and still failing is the proof that resolution is the real #1.)

### Smallest fix (reuse what already exists)
**Pass coordinates on the public path so the robust geo branch runs.** The client
already supports `latitude`/`longitude`/`radiusMeters` and prefers them over
cityName (`:208-222`, `:135-143`), and `destinations.ts` already has
`findDestinationCoords(city, country)`. The public hotel route currently never
calls it. Smallest change: in the public route, resolve the typed city to coords
(with a **tolerant** catalog match so user "Lisbon"/"Canggu" maps to the catalog
entry — note `findDestinationCoords` uses exact `d.name === cityName`,
`destinations.ts:582`, so it needs a contains/normalized match to help free-text
input) and pass `latitude`/`longitude`; LiteAPI's coord-radius search is far more
tolerant of city naming. This mirrors what the AUTHED flow already does
(`ai-assistant/route.ts:268,275`).

**More complete (correct LiteAPI flow), larger:** add a `/v3.0/data/hotels?
cityName=&countryCode=` catalog client fn → collect `hotelId`s → call
`/hotels/rates` with `hotelIds[]`. This is the provider's intended two-step and
removes the cityName-matching gamble entirely, but it's a new endpoint + a
`hotelIds` path on `SearchHotelsParams` (currently absent, `:121-144`).

**Recommendation:** ship the coords fix first (small, reuses existing geo path +
catalog), confirm Lisbon now returns hotels, and keep the `/data/hotels` two-step
as a follow-up for long-tail cities not in our static catalog.

### Commission / activation note
Production returning data is **not** gated on affiliate/commission wiring in our
code, but LiteAPI **production accounts must be activated/approved** before the
prod key returns live inventory; an un-activated account can return empty/401 even
with `LITEAPI_MODE=production`. The `keyPrefix=`/`status=` logs (`:241`,`:254`)
distinguish this from the resolution bug — **read them first** before coding, so
the fix targets the real failure (truth-first). If logs show `200/dataLen=0` for
Lisbon, it's resolution (fix above); if `401/403`, it's account/key activation.

**No code modified — fixes are separate PRs.**
