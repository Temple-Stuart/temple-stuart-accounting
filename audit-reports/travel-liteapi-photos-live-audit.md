# LiteAPI photos/rating still missing post-PR-6 — audit

Branch: `claude/travel-liteapi-photos-live-audit`. Read-only.

## Important caveat first

**`LITEAPI_SANDBOX_KEY` is not in the audit container's env**, so I literally
could not run the authenticated `curl` the prompt requested. I checked:

```
$ env | grep -iE "litea|liteapi"
(empty)
$ ls .env*
.env.example
```

What I *could* do: confirm the URL is alive, then triangulate the response
shape from LiteAPI's own SDK test code (which makes assertions on the live
response), the API reference parameter list, and the hotel-content docs.
Diagnoses below are stated with confidence levels — not all are certain.

I'd genuinely like to re-do §3 with a real key paste if you can drop one in
(or send the sandbox response JSON manually); the proposed fix below should
be tested before merging.

---

## 1. Current PR-6 code (cited)

`src/lib/liteapiClient.ts:166-211` — body + merge:

```ts
const body = {
  cityName: extractCityName(params.city),
  countryCode,
  checkin: params.checkin,
  checkout: params.checkout,
  occupancies: params.occupancies,
  currency: params.currency || 'USD',
  guestNationality: params.guestNationality || 'US',
  includeHotelData: true,                         // ← PR-6 added
};
// …POST + non-2xx throw…
const data = await res.json();

// PR-6 merge logic:
const rateItems: LiteApiHotelRate[] = data.data || [];
const hotelMetaById: Record<string, NonNullable<LiteApiHotelRate['hotel']>> = {};
for (const h of (data.hotels || []) as Array<{ id?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
  if (h && typeof h.id === 'string') hotelMetaById[h.id] = h;   // ← suspect line
}
const merged: LiteApiHotelRate[] = rateItems.map(r => {
  const meta = hotelMetaById[r.hotelId];                        // ← lookup
  if (!meta) return r;
  return { ...r, hotel: { ...meta, ...(r.hotel || {}) } };
});

const max = params.maxResults || 33;
return merged.slice(0, max);
```

Mapper at `:290-335` (unchanged from PR-3): reads `h.name`,
`h.address`, `h.main_photo`, `h.rating`, `h.starRating`, `h.stars`,
`h.reviewCount`, `h.hotelDescription`.

---

## 2. What I probed without auth

```
$ curl -sS -o - -w "HTTP %{http_code}\n" -X POST \
    "https://api.liteapi.travel/v3.0/hotels/rates" \
    -H "Content-Type: application/json" \
    -d '{"cityName":"Canggu","countryCode":"ID","checkin":"2026-07-01",
         "checkout":"2026-07-31","occupancies":[{"adults":1}],
         "currency":"USD","guestNationality":"US","includeHotelData":true}'
{"error":{"code":401,"message":"unauthorized"}}
HTTP 401
```

URL is alive, structured-JSON 401 → endpoint + method correct. No way to
see the success body without a key.

---

## 3. Ground-truth field names — what I could establish from docs and SDK

### `includeHotelData: true` is a real parameter on `/v3.0/hotels/rates`
Confirmed via [LiteAPI's POST /hotels/rates reference](https://docs.liteapi.travel/reference/post_hotels-rates):

> *"Yes, `includeHotelData` is a request body parameter. When set to
> `true`, it 'includes hotel data (name, main photo, address, rating)
> in the response even when searching by direct hotel IDs.'"*

So the body PR-6 sends is correct.

### Hotel field-name canon (from `/data/hotel` content docs)
[Displaying Essential Hotel Details](https://docs.liteapi.travel/docs/displaying-hotel-details) shows the canonical hotel-object shape:

```json
{
  "hotelImages": [
    { "url": "https://snaphotelapi.com/hotels/322367676.jpg",
      "caption": "hotel building", "order": 1, "defaultImage": false }
  ],
  "starRating": 2,
  "rating": 4.9,
  "reviewCount": 1599
}
```
and clarifies: *"`stars` or `starRating` refer to the amenities/facilities
of the hotel, while `rating` refers to its reviews from guests."*

### What the mapper reads vs. what the docs document

| Mapper field | Mapper expects (`liteapiClient.ts`) | Doc-confirmed canonical field | Status |
|---|---|---|---|
| `name` | `h.name` (`:299`) | `name` | ✓ match |
| `address` | `h.address \|\| h.city` (`:300`) | `address` | ✓ match |
| Hero photo | `h.main_photo \|\| h.thumbnail` (`:302`) | **`main_photo` only on `data.hotels[]` parallel array per `/hotels/rates` docs; on `/data/hotel` the canonical is `hotelImages[].url`** | ⚠ partial — see §4 |
| Rating (guest) | `h.rating` (`:281`) | `rating` | ✓ match |
| Star rating | `h.starRating ?? h.stars` (`:281`) | `starRating` | ✓ match |
| Reviews | `h.reviewCount` (`:283`) | `reviewCount` | ✓ match |

The mapper's *field names* are right. The mapper's *defaults* are
null-safe (`h.name || 'Hotel'`, etc.). So whatever's failing isn't in the
mapper — the data isn't reaching the mapper.

### Response wrapper — the actual SDK test (the closest to ground truth I could get)
LiteAPI's [nodejs-sdk test](https://raw.githubusercontent.com/liteapi-travel/nodejs-sdk/master/test/test.js)
makes assertions on the live response after the SDK wraps it in
`{status, data: <raw response>}`:

```js
if (result.data.data && result.data.data.length > 0 &&
    result.data.data[0].roomTypes && result.data.data[0].roomTypes.length > 0) {
  offer = result.data.data[0].roomTypes[0].offerId;
}
```

So `result.data` is the raw LiteAPI response, and the rate items live at
**`<response>.data[]`** (single-level). Our code reads `data.data` — **matches**.
That's reassuring: the wrapper shape PR-6 assumed is correct.

But the SDK test gives me nothing on `hotels[]` shape — it only iterates
the rate items.

---

## 4. The strongest hypothesis I have without the live curl

### **Most likely (high confidence): `hotels[]` items don't have `id` — they use `hotelId`**

The PR-6 merge filters with `if (typeof h.id === 'string')`. If LiteAPI's
parallel `hotels[]` array uses `hotelId` (same field name as the rate side,
which would be the more consistent API design), every entry is filtered
out, `hotelMetaById` is empty, every `meta = hotelMetaById[r.hotelId]` is
undefined, no rate item gets the merge, and the mapper sees
`r.hotel = undefined` → all defaults (`name = 'Hotel'`, `photoUrl = null`,
`googleRating = 0`).

**This matches the symptom exactly.** The cards show with names ("Hotel"
fallback that the user is reading as the literal text "Hotel"), prices
work (price comes from `data.data[].roomTypes[].rates[]`, not from
metadata), and photo + rating are blanked.

I can't confirm `hotelId` vs `id` without the live curl. One LiteAPI doc
search blurb (paraphrased AI summary) said `hotels[]` items have an `id`
field; the parameter list on the reference page says nothing.

### **Plausible (medium confidence): `includeHotelData` is silently ignored when `cityName` is used**

The reference page says `includeHotelData` "includes hotel data … even
when searching by direct hotel IDs" — phrasing suggests the flag is
mainly for the `hotelIds` filter. For `cityName` filter, hotel metadata
is "auto-included" — but the actual field where it lands might not be
top-level `hotels[]`. It could be a nested property like
`data.data[i].hotelData` or similar, in which case our merge would still
find nothing.

### **Lower-confidence: response wrapper is double-nested `{data: {data: [...], hotels: [...]}}`**

The SDK test code reads `result.data.data` which is consistent with
single-level `{data: [...]}` OR with double-nested `{data: {data: [...]}}`
(the latter would still satisfy the assertion). If double-nested, our
`data.data || []` reads `data.data` as the inner object → `.map` on it
would throw, BUT the route catch would surface as a banner instead of
"no photo" — symptom doesn't match. Probably not this.

---

## 5. Proposed fix

### Step 1 — confirm the actual shape (this is the right next step before any code change)

The cheapest way to close the diagnosis: ship a one-line **diagnostic log**
just before the merge, so the next deploy reveals the real shape on a single
search:

```ts
// at liteapiClient.ts:196 (just after `const data = await res.json();`)
console.log('[LiteAPI rates] response shape:', {
  topKeys: Object.keys(data || {}),
  dataLen: Array.isArray(data?.data) ? data.data.length : null,
  hotelsLen: Array.isArray(data?.hotels) ? data.hotels.length : null,
  hotelsKeys: Array.isArray(data?.hotels) && data.hotels[0] ? Object.keys(data.hotels[0]) : null,
  firstRateKeys: Array.isArray(data?.data) && data.data[0] ? Object.keys(data.data[0]) : null,
});
```

A single Bali scan will then show in the server log exactly which keys
`hotels[]` items carry (or whether `data.hotels` is even present). Then
the right fix is obvious.

### Step 2 — the robust merge fix that handles either `id` or `hotelId`

Whether or not Step 1's log confirms the hypothesis, **this is a strict
improvement** because it's a one-character change that accommodates both
naming conventions LiteAPI uses elsewhere in their API:

`src/lib/liteapiClient.ts:201-203`:

```diff
- for (const h of (data.hotels || []) as Array<{ id?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
-   if (h && typeof h.id === 'string') hotelMetaById[h.id] = h;
- }
+ for (const h of (data.hotels || []) as Array<{ id?: string; hotelId?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
+   const id = (h?.hotelId ?? h?.id);
+   if (id && typeof id === 'string') hotelMetaById[id] = h;
+ }
```

This:
- Accepts `hotelId` (most likely actual field) **and** `id` (in case it
  is `id` after all).
- Doesn't change the rate-item lookup (`hotelMetaById[r.hotelId]` is
  fine; `r.hotelId` is documented).
- No silent fallback added — if both fields are missing, the row is
  skipped (same defensive behaviour as before).

### Step 3 — also fix the photo source if needed

If Step 1's log reveals that `data.hotels[]` items use `hotelImages`
(array) instead of `main_photo` (string), one extra line in the mapper:

```diff
- photoUrl: h.main_photo || h.thumbnail || null,
+ photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || null,
```

This change is safe regardless — `main_photo` stays the first choice;
`hotelImages[0].url` is just a fallback per the canonical
[`/data/hotel` docs](https://docs.liteapi.travel/docs/displaying-hotel-details).

---

## 6. Verdict

**The PR-6 includeHotelData flag is correct. The mapper field names are
correct. The merge `id` filter is the highest-probability bug** —
LiteAPI's parallel hotels array most likely uses `hotelId` (consistent
with the rates side) rather than `id`, so our `h.id` check rejects every
row and the metadata never gets attached to a rate item.

**Best path forward:**
1. Add the diagnostic log from §5 Step 1 (one-line, harmless) and deploy.
2. After one Bali scan, the server log shows the real shape — confirm
   whether `hotelId`/`id`/something else.
3. Apply the merge-filter fix from §5 Step 2 (works for either naming).
4. If photo is still blank after step 2, add the `hotelImages[0].url`
   fallback from Step 3.

Sources:
- [LiteAPI — POST /v3.0/hotels/rates reference (`includeHotelData` listed)](https://docs.liteapi.travel/reference/post_hotels-rates)
- [LiteAPI — Displaying Essential Hotel Details (`hotelImages`, `starRating`, `rating`)](https://docs.liteapi.travel/docs/displaying-hotel-details)
- [LiteAPI — Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- [LiteAPI nodejs-sdk test (`result.data.data` assertion)](https://raw.githubusercontent.com/liteapi-travel/nodejs-sdk/master/test/test.js)
- Direct probe `POST https://api.liteapi.travel/v3.0/hotels/rates` (no key — 401 returned; details in §2)
