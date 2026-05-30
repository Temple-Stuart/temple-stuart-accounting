# TRAVEL — LiteAPI Mapper Richness Audit

**Branch:** `claude/travel-liteapi-mapper-richness-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Audit before action. No code changed.
**Scope:** What LiteAPI returns in the rates response vs. what our mapper
surfaces to the recommendation object, and the proposed richness-shipping
scope for **PR-13 (mapper only — UI is PR-14)**.

Ground truth from tonight's dashboard screenshot:
- Booking `yWOakMcGP` completed via the guided flow.
- Search body confirmed: `hotelIds` + `occupancies` + `checkin`/`checkout`.
- Response carries `offerId`, `retailRate`, `commission`, `hotelMappings`.

---

## 1. Current mapper — every field read & output (CITED)

Post-PR-10/11 mapper lives at `src/lib/liteapiClient.ts`. The mapper entry
point is `liteApiHotelToRecommendation()` at **`src/lib/liteapiClient.ts:341`**,
which outputs the local `HotelRecommendation` interface defined at
**`src/lib/liteapiClient.ts:270-296`**.

### 1a. What it READS off the raw hotel + rate item

The raw shape it parses is `LiteApiHotelRate` at
**`src/lib/liteapiClient.ts:140-173`**. The mapper does `const h = hotel.hotel || {}`
at **`:346`** and reads:

| Source field read | Code site | Used for |
|---|---|---|
| `hotel.hotelId` | `:392` | `liteapiHotelId` |
| `h.name` | `:370` | `name` |
| `h.address` ?? `h.city` | `:371` | `address` (string only) |
| `h.main_photo` → `h.thumbnail` → `h.hotelImages?.[0]?.url` | `:378` | `photoUrl` (single) |
| `h.rating` ?? `h.starRating` ?? `h.stars` | `:352` | `googleRating` (0-10→0-5 normalised) |
| `h.reviewCount` | `:354` | `reviewCount` |
| `h.hotelDescription` | `:385` | `summary` (HTML-stripped, sliced to 300) |
| `roomTypes[].rates[].retailRate.total[0].amount` | `:306` (`extractNightlyRate`) | `price` |
| ↳ fallback `retailRate.suggestedSellingPrice[0].amount` | `:308` | `price` |
| ↳ fallback `offerRetailRate.amount` | `:310` | `price` |
| `roomTypes[].offerId` / `roomTypes[].rates[].offerId` | `:319-326` (`extractOfferId`) | `liteapiOfferId` |

### 1b. What it OUTPUTS to the recommendation object

Returned object literal at **`:369-400`**. Fields that carry real LiteAPI
content vs. fields that are hardcoded/derived:

| Output field | Value | Source |
|---|---|---|
| `name` | `h.name \|\| 'Hotel'` | LiteAPI |
| `address` | `h.address \|\| h.city \|\| ''` | LiteAPI (flattened to string) |
| `photoUrl` | first image only | LiteAPI (1 of N) |
| `googleRating` | normalised rating | LiteAPI |
| `reviewCount` | `h.reviewCount ?? 0` | LiteAPI |
| `summary` | description sliced 300 | LiteAPI |
| `price` | lowest rate found | LiteAPI (**see §3 note: this is the stay TOTAL, not nightly**) |
| `priceLevel` / `priceLevelDisplay` | `nightlyToPriceLevel()` `:331` | derived |
| `liteapiHotelId` | `hotel.hotelId` | LiteAPI |
| `liteapiOfferId` | `extractOfferId()` | LiteAPI |
| `website` | `null` (`:372`) | hardcoded |
| `bookingUrl` | `null` (`:397`) | hardcoded |
| `warnings` | `[]` (`:386`) | hardcoded |
| `trending` | `false` (`:387`) | hardcoded |
| `durationMinutes` | `null` (`:399`) | hardcoded |
| `sentiment` / `sentimentScore` / `fitScore` / `compositeScore` / `valueRank` | derived from rating | computed `:356-367` |

**Consumer contract:** `finalResults` is persisted as JSON into
`trip_scanner_results.recommendations` at
**`src/app/api/trips/[id]/ai-assistant/route.ts:238-251`** and read back by the
detail page's `Recommendation` interface at
**`src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx:27-50`**.
Because the column is JSON, the storage shape is loose — adding optional fields
is non-breaking (see §5).

---

## 2. LiteAPI documented response shape (CITED w/ doc URLs)

Sources read for this audit:
- `POST /hotels/rates` reference — https://docs.liteapi.travel/reference/post_hotels-rates
- Displaying hotel details — https://docs.liteapi.travel/docs/displaying-hotel-details
- Rates API JSON data structure — https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure

### 2a. `includeHotelData=true` behaviour
Per the rates reference: hotel data is included by default only for filter
searches (`cityName`, `aiSearch`); `includeHotelData=true` "enables hotel data
inclusion for all search types." It adds "hotel data (name, main photo,
address, rating)" and the broader metadata set below. Our client already sets
this flag for both the coords path and the cityName path —
`src/lib/liteapiClient.ts:197` and `:211`.

### 2b. Rates side — `data[]` (per hotel-rates-api-json-data-structure)
```
data[]                          // one entry per hotel
  ├─ hotelId
  └─ roomTypes[]                // offers for this hotel
       ├─ roomTypeId            // legacy, unused
       ├─ offerId               // ← value needed for prebook
       ├─ supplier / supplierId
       ├─ offerRetailRate       // combined total to book the whole offer
       ├─ suggestedSellingPrice // public listing price
       ├─ offerInitialPrice
       ├─ priceType             // "commission"
       ├─ rateType              // "standard" | "package"
       └─ rates[]               // per-occupancy pricing
            ├─ rateId
            ├─ occupancyNumber
            ├─ name             // room designation
            ├─ maxOccupancy / adultCount / childCount
            ├─ boardType        // RO/BB/HB/FB/AI
            ├─ boardName
            ├─ retailRate        // individual rate total
            ├─ commission        // applied commission
            ├─ taxesAndFees[]
            └─ cancellationPolicies
                 ├─ cancelPolicyInfos[]   // time-bound
                 ├─ hotelRemarks
                 └─ refundableTag          // "NRFN" | "RFN"
```

### 2c. Hotel-metadata side — `hotels[]` / content endpoint (per displaying-hotel-details + rates reference)
```
hotels[] (or content endpoint)
  ├─ id  /  hotelId             // keyed either way (our merge accepts both, §3)
  ├─ name
  ├─ hotelDescription
  ├─ hotelImportantInformation
  ├─ address                    // string in rates+includeHotelData
  ├─ city
  ├─ country
  ├─ zip / postalCode           // present per rates reference field list
  ├─ latitude  /  longitude     // (location.latitude/longitude on content endpoint)
  ├─ main_photo  /  thumbnail
  ├─ hotelImages[] { url, caption, order, defaultImage }
  ├─ stars  /  starRating  /  rating  /  reviewCount
  ├─ hotelFacilities[]          // string array ("Pool", "Wifi", ...)
  ├─ facilities[] { facilityId, name }
  ├─ chain  /  chainId
  └─ checkinCheckoutTimes { checkin, checkout }
```

> **Doc caveat surfaced:** the displaying-hotel-details page does NOT explicitly
> document `zip/postalCode`, `main_photo`, `thumbnail`, `chain`, `chainId`, or
> `brand` with examples — those come from the rates reference field list and the
> JSON-structure page. `address` in the rates+includeHotelData payload is a flat
> **string + separate `city`/`country`**, NOT the nested
> `{city, country, postalCode, lineOne, lineTwo}` object the task description
> assumes — that nested object is the **/data/hotels content** shape. PR-13
> should treat `address` as string and read `city`/`country` siblings.

### 2d. PR-7 production diagnostic log — NOT accessible from this container
The one-time shape probe is emitted at
**`src/lib/liteapiClient.ts:233-239`** (`'[LiteAPI rates] response shape:'`
logging `topKeys`, `hotelsKeys`, `firstRateKeys`). It writes to Vercel runtime
logs, which are **not reachable from this sandbox** (no Vercel auth/network).
The merge logic at **`:246-258`** already hedges the `id` vs `hotelId` keying
ambiguity that probe was meant to settle — see §3.

---

## 3. PER-FIELD DIFF — read vs. dropped

| LiteAPI field | In our raw type? | Surfaced to rec? | Status |
|---|---|---|---|
| `name` | yes `:143` | yes `:370` | ✅ shipped |
| `hotelId` / `id` | yes `:141`/merge `:249` | yes `:392` | ✅ shipped (merge accepts both keys, `:248-250`) |
| `address` (string) | yes `:144` | yes `:371` | ✅ shipped (string) |
| `city` | yes `:145` | only as address fallback `:371` | ⚠️ not a distinct field |
| `country` | yes `:146` | **no** | ❌ dropped |
| `zip` / `postalCode` | no | **no** | ❌ dropped |
| `latitude` | yes `:158` | **no** | ❌ dropped (read into type, never output) |
| `longitude` | yes `:159` | **no** | ❌ dropped (read into type, never output) |
| `rating` | yes `:148` | yes (→`googleRating`) `:352` | ✅ shipped |
| `starRating` | yes `:157` | only as rating fallback `:352` | ⚠️ collapsed into one number |
| `stars` | yes `:147` | only as rating fallback `:352` | ⚠️ collapsed |
| `reviewCount` | yes `:149` | yes `:354` | ✅ shipped |
| `reviewScore` | no | **no** | ❌ dropped (we only have count, no score) |
| `chain` / `chainId` | no | **no** | ❌ dropped |
| `brand` | no | **no** | ❌ dropped |
| `hotelImages[]` | yes `:155` | **only [0]** as photoUrl fallback `:378` | ❌ array dropped (N−1 images lost) |
| `hotelFacilities[]` | **no** (not in type) | **no** | ❌ dropped (not even parsed) |
| `facilities[]{id,name}` | no | **no** | ❌ dropped |
| `hotelDescription` | yes `:156` | yes (→`summary`, 300 char) `:385` | ✅ shipped (truncated) |
| `main_photo` | yes `:151` | yes (photoUrl) `:378` | ✅ shipped |
| `thumbnail` | yes `:152` | yes (photoUrl fallback) `:378` | ✅ shipped |
| `retailRate.total[]` | yes `:166` | yes (→`price`) `:306` | ⚠️ **mislabeled — see note** |
| `retailRate` per-night | n/a | **no** | ❌ not computed |
| `currency` | yes (on rate) `:166` | **no** (assumed USD) | ❌ dropped |
| `commission` | no (search) | **no** | ❌ dropped (only read in prebook `:463`) |
| `suggestedSellingPrice` | yes `:166` | only as price fallback `:308` | ⚠️ not surfaced distinctly |
| `cancellationPolicies` | partial `:169` | **no** | ❌ dropped in search (prebook only `:466`) |
| `offerId` | yes `:163/165` | yes (→`liteapiOfferId`) `:319` | ✅ shipped |
| `boardName` | yes `:170` | **no** | ❌ dropped |

> ### ⚠️ Latent bug to flag (not fix in PR-13 unless scoped)
> `extractNightlyRate()` (`:302-314`) reads `retailRate.total[0].amount` and the
> `price` field is documented as "nightly rate in USD" (`:294`, `:398`). But
> `retailRate.total` is the **total for the whole stay window**, not per-night.
> `nightlyToPriceLevel()` (`:331`) then buckets a multi-night total against
> per-night thresholds ($80/$200/$400), inflating price level for any stay >1
> night. PR-13's richness work (passing `currency` + total + window size, §4)
> is the natural place to **make per-night derivable** without guessing.

---

## 4. Proposed richness-shipping scope — PR-13 (mapper only)

Add pass-through of the following, all **enabling PR-14's richer card UI**:

| New rec field | Source | Why (enables PR-14) |
|---|---|---|
| `city` | `h.city` | City line on card, separate from full address |
| `addressLine` | `h.address` (string) | Street line distinct from city |
| `latitude`, `longitude` | `h.latitude`/`h.longitude` (already on type `:158-159`) | Map pin / "show on map" on card — currently silently dropped |
| `reviewCount` | already shipped | (keep) |
| `reviewScore` | `h.rating` (0-10 raw, pre-normalise) | Show "8.6/10" badge alongside stars |
| `chain` | `h.chain` (add to type) | Brand/chain chip on card |
| `images[]` | full `h.hotelImages` mapped to `{url, caption}` sorted by `order`, `defaultImage` first | Card carousel instead of single hero photo |
| `facilities[]` | `h.hotelFacilities` **filtered to standard set** `["Pool","Wifi","Breakfast","Gym","Spa","Parking"]` | Amenity icons row on card |
| `currency` | rate currency (default 'USD') | Price label correctness for non-USD |
| `priceTotal` | rate `retailRate.total` | The honest "total for stay" number |
| `nights` | `checkout − checkin` (pass window size into mapper) | Lets PR-14 compute per-night = `priceTotal / nights` |

Implementation notes for PR-13:
- Add `hotelFacilities?: string[]` and `chain?: string` to the `LiteApiHotelRate.hotel`
  type (`:142-160`) so they're parsed.
- Standard-facility filter: intersect `hotelFacilities` (case-insensitive) with
  the 6-item allow-list; cap output, drop the rest.
- `images[]`: sort by `order`, put `defaultImage` first, map to `{url, caption}`.
- Thread `nights` (or `checkin`/`checkout`) into `liteApiHotelToRecommendation()`
  so per-night is derivable downstream — addresses the §3 mislabel without a UI change.

### Explicitly NOT in PR-13 (documented exclusions)
- **Full description text** — `summary` stays capped at 300 chars; full body is
  too long for cards.
- **All facilities** — only the standardized 6 ship; the raw list needs
  normalization (LiteAPI strings aren't a controlled vocabulary) — defer.
- **`cancellationPolicies`** — booking-flow concern (already handled in prebook
  `:466`), not card display.
- **`commission` / `suggestedSellingPrice`** — margin/pricing-strategy data, not
  user-facing card content.
- **`brand`, `boardName`, `facilities[]{id,name}`** — nice-to-have, not required
  for PR-14's card redesign; keep PR-13 tight.
- **The per-night price-level bug fix** — PR-13 makes per-night *derivable*
  (ships `priceTotal` + `nights`); the actual `nightlyToPriceLevel` recompute is
  a behavior change best owned by PR-14 when it renders price.

---

## 5. Recommendation shape impact

### Current interfaces
- Mapper output type: `HotelRecommendation` —
  **`src/lib/liteapiClient.ts:270-296`**.
- Consumer/render type: `Recommendation` —
  **`src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx:27-50`**.
- Storage: JSON column `trip_scanner_results.recommendations`
  (**`route.ts:249-250`**) — loose, so additive optional fields are safe.

### Proposed additions (ALL optional — backward compatible)
Add to **both** `HotelRecommendation` and the consumer `Recommendation`
interface:

```ts
// LiteAPI richness (PR-13) — all optional, ignored by Viator/Google sources
city?: string;
addressLine?: string;
latitude?: number;
longitude?: number;
reviewScore?: number;          // 0-10 raw guest score (distinct from stars)
chain?: string;
images?: Array<{ url: string; caption?: string }>;
facilities?: string[];         // standardized subset only
currency?: string;
priceTotal?: number;           // total for the stay window
nights?: number;               // window size, for per-night derivation
```

**Backward compatibility confirmed:**
- Every new field is `?` optional — no required-field additions.
- Viator (`viatorProductToRecommendation`, `viatorClient.ts:467-553`) and Google
  sources simply don't set them; they remain `undefined` and existing render
  code is untouched.
- JSON storage means no migration; old rows lacking these fields still
  deserialize.
- No existing field is renamed, retyped, or removed → no breaking change.

---

## 6. Proposed PR-13 scope

| Item | Estimate |
|---|---|
| Files touched | **2** — `src/lib/liteapiClient.ts` + the consumer `Recommendation` interface in `…/discover/[category]/[rank]/page.tsx` |
| New API calls | **0** — reads more from the existing `/hotels/rates` response |
| UI changes | **0** — those are PR-14 |
| Line estimate | **~30-50 lines** — ~10 type fields ×2 interfaces, +1 facility-filter helper, +image-array map, +thread `nights` through the mapper signature/caller |
| Quality gate | `tsc` + lint clean |

Optional 3rd touch (only if `nights` is threaded from the caller): a 1-line change
at **`route.ts:239`** to pass the window size into
`liteApiHotelToRecommendation()`. Within the ~50-line budget.

---

## Verdict
The mapper ships ~8 fields and **drops the richest content LiteAPI already
returns in the same response**: the full image gallery (keeps 1 of N),
lat/lng (parsed but never output), facilities (never parsed), chain, currency,
and a per-night-derivable price. PR-13 is a pure read-more-from-existing-payload
change — 2 files, ~30-50 lines, all-optional fields, zero new calls, zero UI —
that hands PR-14 everything it needs for the richer card redesign.

**READ-ONLY audit. No implementation performed.**
