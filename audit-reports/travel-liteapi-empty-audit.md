# LiteAPI Accommodation empty — audit

Branch: `claude/travel-liteapi-empty-audit`. Read-only. The exact request our
code sends + LiteAPI's documented behaviour for unmatched cities is enough to
diagnose this without needing to spend an API key.

---

## TL;DR

**Not a bug — it's a destination-name mismatch.** Our code is sending
`cityName: "Bali (Canggu)"` to LiteAPI's catalog, which does an "exact
match" lookup. LiteAPI's catalog stocks cities like "Canggu" /
"Seminyak" / "Ubud" / "Denpasar" — not "Bali" (Bali is the island, not
a city) and definitely not "Bali (Canggu)". LiteAPI's documented behaviour
for an unmatched city is **HTTP 200 with `data: []`** — silent empty,
not a typed error. Per the fail-loud mandate this is a UX gap (we can't
distinguish "no inventory" from "city name doesn't match the catalog").

**Fix:** strip the parenthetical wrapper and use the bracketed name as the
city (`"Bali (Canggu)"` → `"Canggu"`). One-line robust improvement. Even
better, durable fix below: pass lat/lng to LiteAPI instead of city names
— our `destinations.ts` already has coordinates for every entry, and
LiteAPI explicitly recommends coordinate-based search over city names.

---

## 1. The exact request being sent (cited)

`src/lib/liteapiClient.ts:156-167`:
```ts
export async function searchHotelRates(params: SearchHotelsParams) {
  const countryCode = countryNameToIso2(params.country);
  const body = {
    cityName: params.city,            // ← passed through verbatim
    countryCode,
    checkin: params.checkin,
    checkout: params.checkout,
    occupancies: params.occupancies,
    currency: params.currency || 'USD',
    guestNationality: params.guestNationality || 'US',
  };
  const url = `${LITEAPI_BASE}/hotels/rates`;
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  …
}
```

For the live Bali trip, `searchHotelRates` is called with:
- `params.city` = `"Bali (Canggu)"` (from the trip's destinations.ts entry —
  `src/lib/destinations.ts:63`: `{ name: 'Bali (Canggu)', country: 'Indonesia', ... }`)
- `params.country` = `"Indonesia"`
- Dates from the trip (2026-07-01 → 2026-07-31)
- Occupancy from `trip_participants.count` (1)

So the body sent to LiteAPI is:
```json
{
  "cityName": "Bali (Canggu)",
  "countryCode": "ID",
  "checkin":  "2026-07-01",
  "checkout": "2026-07-31",
  "occupancies": [{"adults": 1}],
  "currency":  "USD",
  "guestNationality": "US"
}
```

URL: `POST https://api.liteapi.travel/v3.0/hotels/rates`
Headers: `X-API-Key: <LITEAPI_SANDBOX_KEY>` + `Content-Type: application/json`.

---

## 2. `countryNameToIso2` → "Indonesia" (cited)

`src/lib/liteapiClient.ts:57`:
```ts
'thailand': 'TH', 'indonesia': 'ID', 'japan': 'JP', …
```
So `countryNameToIso2("Indonesia")` → `"ID"`. Country code is correct. **Not the issue.**
The `throw new LiteApiError("countryNameToIso2", 400, …)` on `:90-92` does
NOT fire for Indonesia — it'd fire only for unknown country names.

---

## 3. The `cityName` problem — LiteAPI does exact-string matching

Per [LiteAPI's Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide):

> *"This is a fairly rudimentary option since countries may have multiple
> cities with the same name, and the size of some cities means returning
> very large result sets. **Smaller cities may not be listed.** Use the
> city list endpoint to get valid cities."*

And per the same docs, **LiteAPI returns HTTP 200 with an empty `data`
array when the city doesn't match its catalog** — there is no typed error
to catch.

`"Bali (Canggu)"` won't match anything in LiteAPI's catalog because:
- LiteAPI catalogs cities under their *city* names (e.g. `"Canggu"`,
  `"Seminyak"`, `"Ubud"`, `"Denpasar"` for Bali destinations).
- `"Bali"` is the *island/province* name, not a city — usually not in
  city-keyed catalogs.
- `"Bali (Canggu)"` is our internal naming convention from
  `src/lib/destinations.ts`, designed to communicate "the Canggu area
  of Bali" to *users*. LiteAPI's exact-match lookup has no chance.

Even if PR-4's Brunch fix (strip parens in Google's text-search query)
were applied here, the result `"Bali Canggu"` would still not match
LiteAPI's catalog (it'd need to be just `"Canggu"`).

---

## 4. Direct probe — couldn't reach a payload-bearing response without a key

```
$ curl -sS -X POST "https://api.liteapi.travel/v3.0/hotels/rates" \
    -H "Content-Type: application/json" \
    -d '{"cityName":"Bali (Canggu)","countryCode":"ID","checkin":"2026-07-01",
         "checkout":"2026-07-31","occupancies":[{"adults":1}],"currency":"USD",
         "guestNationality":"US"}'
HTTP 401  {"error":{"code":401,"message":"unauthorized"}}
```

Same for `cityName: "Canggu"` and `cityName: "Bali"`. LiteAPI requires the
`X-API-Key` header on every request — there is no anonymous probe that
returns a payload. I didn't extract the sandbox key from the dev env.

What we KNOW from LiteAPI's docs (no key needed):
- Unmatched city → 200 + empty `data` (silent empty, no error).
- The recommended robust strategies are coordinate-based search
  (lat/lng + radius), `hotelIds`, IATA code, or Google Place ID.

What we CANNOT confirm without the key:
- Whether `cityName: "Canggu"` actually matches a sandbox entry (probably
  yes for sandbox in major tourist areas, but Bali destinations are
  smaller markets — sandbox stock varies).
- Whether sandbox has any Bali-region inventory at all.

---

## 5. Distinguishing "sandbox unstocked" vs "city doesn't match"

The two failure modes are indistinguishable to us today (both return 200
+ empty `data`). A test matrix tells which:

| Test | Expected if... |
|---|---|
| `cityName: "Canggu"` + `countryCode: "ID"` | Real city name. If empty: sandbox doesn't stock this region (try a major city). If non-empty: confirms the bug is purely our `"Bali (Canggu)"` cityName. |
| `cityName: "New York"` + `countryCode: "US"` | LiteAPI sandbox documentation lists NY as a tested destination. If non-empty: integration is fine, the Bali issue is purely city-name matching. If empty: sandbox is unstocked / our request is malformed for some other reason. |
| `cityName: "London"` + `countryCode: "GB"` | Same idea. Multiple "should work" cities give us confidence. |
| Same with `cityName: "Paris"` + `"FR"` | Triangulate. |

If New York/London/Paris all come back non-empty, our integration is
correct end-to-end — only the destination naming is wrong. Confirms the
proposed fix below.

---

## 6. Proposed fix (one-line, do NOT implement yet — awaiting approval)

### Quick fix — extract parenthetical wrapper

`src/lib/liteapiClient.ts:158`:
```diff
-    cityName: params.city,
+    cityName: extractCityName(params.city),
```
…with a tiny helper next to `countryNameToIso2`:
```ts
/** Our destinations.ts uses "Region (City)" naming for UX clarity
 *  (e.g. "Bali (Canggu)"). LiteAPI's catalog keys on the actual city
 *  ("Canggu"). If parens are present, prefer their content; otherwise
 *  pass through. */
function extractCityName(name: string): string {
  const m = name.match(/\(([^)]+)\)/);
  return (m ? m[1] : name).trim();
}
```

This handles every `"X (Y)"` destination in our DB the same way without
hand-mapping each one. Spot check of `src/lib/destinations.ts`:
- `"Bali (Canggu)"` → `"Canggu"`  ✓
- Most other entries are plain city names → pass-through  ✓

### Durable fix — coordinate-based search

`src/lib/destinations.ts` already has `lat`/`lng` on every entry. LiteAPI's
[rate request guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
explicitly recommends coordinates over city names. Two changes:

1. Plumb `lat`/`lng` through to the route (the scan request body would
   carry coordinates when available).
2. `searchHotelRates` accepts a `coordinates?: { latitude, longitude, radius }`
   alternative to `cityName`/`countryCode`, and sends:
   ```json
   {
     "latitude": -8.6478, "longitude": 115.1385,
     "radius": 10000,
     "checkin": "...", "checkout": "...",
     "occupancies": [...], "currency": "USD",
     "guestNationality": "US"
   }
   ```

This eliminates the city-name-matching brittleness entirely (works for
every destination, not just ones in `extractCityName`'s pattern).
Slightly bigger change — better as a follow-up PR once the quick fix
proves the integration.

### UX improvement — distinguish "unmatched city" from "no inventory"

To get the diagnostic surface back, validate against
LiteAPI's city list endpoint (`/v3.0/data/cities`) before calling rates,
and surface a typed `LiteApiUnmatchedCityError` when the resolved city
isn't in their catalog. Banner text: *"No accommodation in LiteAPI's
catalog for "Bali (Canggu)" — try a nearby major city."*

Alternative if we don't want the extra round-trip: change the
"No accommodation found for this destination" empty-state copy on the
carousel to include diagnostic context when source = liteapi:
> *No hotels matched this destination in LiteAPI's sandbox. Try a
> nearby major city while we provision production access.*

---

## Verdict

| Hypothesis from the prompt | Status |
|---|---|
| LiteAPI being called correctly | **Yes** — URL, headers, body shape are all right. |
| `countryNameToIso2` failing for "Indonesia" | **No** — maps to `"ID"` correctly. |
| `"Bali (Canggu)"` passes through unchanged | **Yes** — and that's the problem. |
| LiteAPI sandbox returns malformed for parens | Unverifiable without key, but **LiteAPI's docs say unmatched cities return 200 + empty silently**, regardless of cause. Parens probably don't trip a parser the way they did in Google — the string just doesn't match anything in the catalog. |
| Sandbox unstocked for Bali | Possible but secondary — the cityName mismatch comes first. The test matrix in §5 disambiguates. |
| Bug (malformed request) | **Yes**, in the sense that `"Bali (Canggu)"` is never going to match. **No**, in the sense that the request shape itself is valid; the value of `cityName` is the issue. |

**Fix priority:** quick fix (`extractCityName`) ships the win. Durable fix (lat/lng) ships the architecturally correct version. UX surface for "unmatched city" closes the diagnostic gap that this audit had to fill manually.

Sources:
- [LiteAPI — Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI — POST /v3.0/hotels/rates reference](https://docs.liteapi.travel/reference/post_hotels-rates)
- [LiteAPI — Hotel Rates API JSON Data Structure](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)
- Direct HTTP probes against `api.liteapi.travel/v3.0/hotels/rates` (no key — only the 401 was observed; details in §4).
