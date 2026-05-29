# Accommodation thin / total-price / no-photo audit

Branch: `claude/travel-accommodation-thin-audit`. Read-only.

## Caveats upfront

- **`LITEAPI_SANDBOX_KEY` not in audit env** — same as the last several
  audits. Can't run the live curl the prompt asked for.
- **No Vercel CLI / `.vercel/` dir** — can't read production logs. The
  PR-7 diagnostic log `[LiteAPI rates] response shape` should have fired
  on the live Bali scan; the user has access to it and I don't. **If
  you can paste the log line, two of the three open hypotheses collapse
  to confirmed/denied immediately.**

What I *did* establish: the **price-display bug** is **definitively
proven** from LiteAPI's own docs + our source code, with the exact root
cause and a one-token-class fix. The other two sub-issues (1 hotel,
no photo) need the diagnostic log paste to confirm — strong-confidence
hypotheses below.

---

## (b) Why displayed price looks like trip-total — **DEFINITIVE**

### The bug, cited

`src/lib/liteapiClient.ts:231-243`:
```ts
function extractNightlyRate(hotel: LiteApiHotelRate): number | null {
  for (const room of hotel.roomTypes || []) {
    for (const rate of room.rates || []) {
      const total = rate.retailRate?.total?.[0]?.amount;        // ← reads "total"
      if (typeof total === 'number' && total > 0) return total;  //    returns it as "nightly"
      const suggested = rate.retailRate?.suggestedSellingPrice?.[0]?.amount;
      if (typeof suggested === 'number' && suggested > 0) return suggested;
      const offer = rate.offerRetailRate?.amount;
      if (typeof offer === 'number' && offer > 0) return offer;
    }
  }
  return null;
}
```

The function is **named** `extractNightlyRate` but **reads** `retailRate.total[0].amount`.

### Per LiteAPI's own docs

From [Hotel Rates API JSON Data Structure](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)
and [Step 2: Requesting room rates](https://docs.liteapi.travel/docs/step-2-requesting-room-rates):

> *"`retailRate` has an object labeled `total`, which will always have
> one item in its array containing an amount and a currency. This 197.53
> USD (in the example) is the price you will find this room sold for
> publicly and **when selling publicly, it is the price you need to display
> for the room**."*

And explicitly when asked whether the rates response has a per-night
field:

> *"**There is no dedicated per-night price field** in the Hotel Rates
> API response. The API returns only total pricing. To calculate
> per-night pricing, you must divide the total by the number of nights
> in your stay request."*

`retailRate.total[0].amount`, `suggestedSellingPrice[0].amount`, and
`offerRetailRate.amount` are **all total-stay prices**. None are
per-night.

### The math checks out

User reports `Secana Beachtown Resort & Villas — $29,659.96` for a 185-night
Bali stay (2026-07-01 → 2027-01-01). $29,659.96 ÷ 185 nights = **$160.32
per night** — a normal mid-range Bali rate. The user is seeing the total
stay price, displayed as nightly. The numerator is right; the labeling
isn't.

### How the bug propagates through the UI

- Mapper at `:298`: `price: nightlyUsd` — but `nightlyUsd` is actually the
  total stay value from `extractNightlyRate`.
- Carousel card at `TripPlannerAI.tsx:979`:
  `<span>${rec.price}</span>` — displays the bad number as a bare dollar
  figure with no context. User sees `$29659.96` and (reasonably) reads it
  as confusing total.
- Detail page at `discover/[category]/[rank]/page.tsx:107-178`:
  ```ts
  const nightly = rec.price ?? null;                  // ← actually total
  const totalForTrip = nightly != null ? nightly * nights : null;  // ← double-multiplies
  ```
  Renders `${nightly} / night × ${nights} nights = ${totalForTrip}`. For
  this scan: `$29659.96 / night × 185 nights = $5,487,092.60 total` —
  a 5.4-million-dollar Bali stay. Worse than the carousel.
- `nightlyToPriceLevel(usd)` at `:259-265`: bucketed `$/$$/$$$/$$$$`
  based on `< 80 / < 200 / < 400 / else`. $29,659.96 falls into `$$$$`
  for every property → every hotel card shows `$$$$` regardless of
  actual price tier. **The `priceLevelDisplay` field is also wrong for
  every hotel today, not just this one.**

### Proposed fix (do NOT implement — proposal only)

Rename + restructure so we pass the night count and do the division
once:

```diff
- function extractNightlyRate(hotel: LiteApiHotelRate): number | null {
+ /** Extract the total stay price LiteAPI quoted for this hotel. Per their
+  *  docs the rates endpoint never returns per-night; total is what
+  *  retailRate.total / suggestedSellingPrice / offerRetailRate carry. */
+ function extractStayTotal(hotel: LiteApiHotelRate): number | null {
    for (const room of hotel.roomTypes || []) {
      for (const rate of room.rates || []) {
        const total = rate.retailRate?.total?.[0]?.amount;
        if (typeof total === 'number' && total > 0) return total;
        const suggested = rate.retailRate?.suggestedSellingPrice?.[0]?.amount;
        if (typeof suggested === 'number' && suggested > 0) return suggested;
        const offer = rate.offerRetailRate?.amount;
        if (typeof offer === 'number' && offer > 0) return offer;
      }
    }
    return null;
  }

  export function liteApiHotelToRecommendation(
    hotel: LiteApiHotelRate,
    idx: number,
    category: string,
+   nights: number,
  ): HotelRecommendation {
    const h = hotel.hotel || {};
-   const nightlyUsd = extractNightlyRate(hotel);
+   const totalUsd = extractStayTotal(hotel);
+   // No per-night field exists in LiteAPI's response — derive it.
+   const nightlyUsd = totalUsd != null && nights > 0
+     ? Math.round((totalUsd / nights) * 100) / 100
+     : null;
```

And the call site in `ai-assistant/route.ts` already has `checkin` /
`checkout` to compute nights:
```diff
+ const nights = Math.max(1, Math.round(
+   (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24)
+ ));
  const finalResults = hotels
-   .map((h, idx) => liteApiHotelToRecommendation(h, idx, category))
+   .map((h, idx) => liteApiHotelToRecommendation(h, idx, category, nights))
```

After the fix:
- Carousel card: `$160` instead of `$29659.96`.
- Detail page: `$160 / night × 185 nights = $29,659.96 total` (correct).
- `nightlyToPriceLevel` buckets correctly (`$$` for Bali mid-range
  instead of `$$$$` for every property in the world).

---

## (a) Why only 1 hotel — **needs PR-7 log paste**

### Two candidate causes I can't separate without the log

**Cause A — sandbox thin for 185-night stays.** LiteAPI sandbox is
documented as stock-limited; many rate plans cap at ~30 nights. A
185-night search may hit "no rate plan satisfies this duration" → most
hotels return zero rates → after `extractStayTotal` returns null, we'd
expect them to still appear in the carousel as metadata-only entries
(per the `extractNightlyRate` comment: "some sandbox properties return
metadata-only — surface as 'see pricing' rather than dropping"). But
they're not appearing.

**Cause B — post-PR-7 merge still partly broken.** PR-7 widened the
filter to accept `hotelId ?? id`. If LiteAPI's `data.hotels[]` items use
a third name (e.g. `code`, `hotelCode`), the filter still rejects them
and the merge map is empty. Only one rate item happens to also have a
`r.hotel` sub-object (LiteAPI sometimes inlines metadata on the rate
side too for the top-ranked result), so only that one renders with
data; the rest get fallbacks. Explains: 1 hotel with a name.

### What the PR-7 diagnostic log tells us

It fires once per rates call:
```
[LiteAPI rates] response shape: {
  topKeys: [...],
  dataLen: N,
  hotelsLen: M,
  hotelsKeys: [...],      ← reveals the field name on data.hotels[0]
  firstRateKeys: [...],   ← reveals the field name on data.data[0]
}
```

The single most decisive signal is `hotelsKeys`. If it includes `hotelId`
or `id`, Cause B is ruled out (the merge would have worked). If it
includes something else (`code` / `hotelCode` / `propertyId`), the merge
is still broken and the filter needs to widen further.

If `dataLen === 1` AND `hotelsLen === 1` — sandbox truly returned only
one rate item, and the symptom is Cause A (sandbox thinness). If
`dataLen >> 1` AND most rate items rendered with fallback defaults —
Cause B (merge dropping all but one).

### Test to verify in one step

Without changing the audit's "read-only" stance, the user can run
**the same scan with a shorter date range** (e.g. checkin 2026-07-01,
checkout 2026-07-08, **7 nights**). If hotel count jumps from 1 to many,
it's sandbox-thin for long stays (Cause A) — not a code bug. If still 1,
Cause B is real and the merge needs more work.

### Proposed fix (only if Cause B is real)

`src/lib/liteapiClient.ts:200-205`:
```diff
- for (const h of (data.hotels || []) as Array<{ id?: string; hotelId?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
-   const id = h?.hotelId ?? h?.id;
+ for (const h of (data.hotels || []) as Array<{ id?: string; hotelId?: string; code?: string; hotelCode?: string } & NonNullable<LiteApiHotelRate['hotel']>>) {
+   const id = h?.hotelId ?? h?.id ?? h?.code ?? h?.hotelCode;
    if (id && typeof id === 'string') hotelMetaById[id] = h;
  }
```
Widen the candidate field names. Same defensive pattern PR-7 used.

---

## (c) Why no photo — **needs PR-7 log paste**

PR-7's mapper fallback chain at `:344`:
```ts
photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || null,
```

Three candidates:
1. **Merge isn't populating `h` at all** — covered by issue (a)'s Cause B.
2. **Merge is working but LiteAPI's sandbox response for this property
   has nulls for all three fields.** Sandbox metadata-only properties are
   documented to do this. If the user sees photos appear for *other*
   properties on different scans, this is property-specific.
3. **The photo URL field is named something else** — e.g.
   `imageUrl` / `pictureUrl` / `hero_image`. The `[LiteAPI rates]
   response shape` log line's `hotelsKeys` reveals this.

If `hotelsKeys` shows a photo-shaped field we're not reading, the fix is
one line appended to the chain. If `hotelsKeys` shows no photo-shaped
field at all, sandbox didn't ship one for this property and the
placeholder is honest — not a bug.

### Proposed fix (only if a renamed photo field exists)

Pure additive — append whatever the log reveals to the chain:
```diff
- photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || null,
+ photoUrl: h.main_photo || h.thumbnail || h.hotelImages?.[0]?.url || h.<actual_field_name> || null,
```

---

## Verdict per issue

| # | Issue | Root cause | Fix confidence |
|---|---|---|---|
| **b** | Price displayed as trip-total | `extractNightlyRate` reads `retailRate.total[0].amount` (total stay) but mapper labels as nightly. LiteAPI's docs explicitly state no per-night field exists. | **High** — definitive. Rename + pass `nights` + divide. |
| **a** | Only 1 hotel returned | Cause A (sandbox thin for 185-night stays) OR Cause B (merge field-name still wrong post-PR-7). Test with 7-night range to disambiguate. | **Medium** — need PR-7 log paste OR shorter-range test. |
| **c** | No photo on the 1 returned hotel | Either Cause B for issue (a) cascading (merge still empty) OR LiteAPI sandbox shipped no photo for this property OR LiteAPI uses a photo field name we don't read. | **Medium** — need PR-7 log paste. |

### One thing that will close two of three sub-issues at once

**Paste the `[LiteAPI rates] response shape:` log line** from Vercel for
the Bali 185-night scan. That single log line:
- Confirms or denies Cause B by showing `hotelsKeys`.
- Tells us if there's a photo-shaped field we're missing.
- Tells us the actual `dataLen` (sandbox thin or not).

I can't reach Vercel from this audit env, but you can. Even a paraphrase
("hotelsLen was 12, hotelsKeys was `[id, name, main_photo, ...]`") would
collapse the diagnoses.

Sources:
- [LiteAPI — Hotel Rates API JSON Data Structure](https://docs.liteapi.travel/docs/hotel-rates-api-json-data-structure)
- [LiteAPI — Step 2: Requesting room rates](https://docs.liteapi.travel/docs/step-2-requesting-room-rates)
- [LiteAPI — Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
- `src/lib/liteapiClient.ts:231-265` (mapper + extractNightlyRate)
- `src/components/trips/TripPlannerAI.tsx:978-981` (carousel price display)
- `src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx:107-178` (detail page price block)
