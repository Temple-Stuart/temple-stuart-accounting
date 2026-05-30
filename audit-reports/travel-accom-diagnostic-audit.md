# TRAVEL — Accommodation Diagnostic Audit: Why "No accommodation found" for Bali

**Branch:** `claude/travel-accom-diagnostic-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Verify, don't assume.
**Question:** Is the empty Accommodation carousel (a) expected sandbox-empty,
(b) a 185-night-window search bug, (c) a swallowed error, or (d) a mix?

---

## 1. The empty-state render + its condition

`src/components/trips/TripPlannerAI.tsx:991-994`:
```tsx
) : items.length === 0 ? (
  <div className="text-xs text-text-muted py-4 px-3 border border-dashed border-border rounded">
    No {label.toLowerCase()} found for this destination.
  </div>
) : ( …cards… )
```
Render priority in `TravelCarousel` (`:973-995`):
1. `error` → **red** banner (`bg-red-50 … text-brand-red`, `:973-976`)
2. `isLoading` → skeleton (`:977-990`)
3. **`items.length === 0`** → the **dashed** "No … found" message (`:991-994`)
4. else → cards

**Trigger:** an **empty array** (`items.length === 0`) **with no error set**. The
screenshot's dashed "No accommodation found" is case 3 — which, by this very
priority order, can only render when `categoryErrors['accommodation']` is unset.
An error would pre-empt it with the red banner. **The render itself proves
empty-not-error.**

---

## 2. The full LiteAPI call path + params

| Step | File:line |
|---|---|
| Client fetch per category | `TripPlannerAI.tsx:296-300` → `POST /api/trips/[id]/ai-assistant` with `{city, country, category:'accommodation', …}` |
| Route dispatch to LiteAPI | `ai-assistant/route.ts:192` (`if (source === 'liteapi')`) |
| Dates pulled from trip | `route.ts:196-202` (trip.startDate/endDate; throws if unset) |
| Occupancy | `route.ts:203-204` (`adults = max(1, participantCount)`) |
| **Window sent** | `route.ts:217-222` — **`STOPGAP_NIGHTS = 7`**: `checkin = trip.startDate`, `checkout = +7 days` |
| Coord resolution (Bali) | `route.ts:228` `findDestinationCoords(city, country)` → Bali (Canggu) is in the catalog at `destinations.ts:69` (`lat -8.6478, lng 115.1385`), so coord-radius search is used (`route.ts:235`) |
| The call | `route.ts:231-236` `searchHotelRates({ city, country, checkin, checkout, occupancies:[{adults}], latitude, longitude })` |

For Bali, the params are: **coords (-8.6478, 115.1385)**, **checkin 2026-07-01 →
checkout 2026-07-08 (7 nights)**, 1+ adults — a perfectly normal hotel search.

---

## 3. CRITICAL — does the empty state swallow an error? **NO.**

Fail-loud is honored end-to-end:
- **Route:** on any LiteAPI failure it **rethrows** — `route.ts:257-262`
  (`console.error(... 'failing loud') ; throw liteApiErr`). The comment is
  explicit: "Always rethrow; outer catch maps typed errors to structured HTTP."
  No mapping to an empty array.
- **Client `scanSingleCategory`:** non-JSON → throw (`TripPlannerAI.tsx:302-304`);
  `!res.ok` → throw with the upstream message (`:305-309`); success → return
  `data.recommendations || []` (`:311`).
- **Client `autoScanCategoriesFor`:** success → `setByCategory[cat]=items` +
  clears the error (`:336-343`); catch → **`setCategoryErrors[cat]=msg`**
  (`:344-347`).

So a LiteAPI **error** → non-200 → thrown → **red error banner**; a LiteAPI
**success with `[]`** → **dashed empty state**. The two are cleanly separated.
**VERDICT: no error-swallowing — no fail-loud violation.** The dashed message
the user sees is a genuine HTTP-200 empty result.

---

## 4. Sandbox vs production + what each returns for Bali

Mode/key read at `liteapiClient.ts:35-44`:
```ts
function getMode() { return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox'; }
// key = mode==='production' ? LITEAPI_PRODUCTION_KEY : LITEAPI_SANDBOX_KEY
```
Default is **sandbox** unless `LITEAPI_MODE` is explicitly `'production'`. The app
is in **sandbox**.

**How an empty result is produced** — `searchHotelRates` at
`liteapiClient.ts:265`:
```ts
const rateItems: LiteApiHotelRate[] = data.data || [];   // priced rate items
…
const merged = rateItems.map(r => …);                    // :280
return merged.slice(0, max);                             // :289
```
The recommendation list is built **only from `data.data` (priced rate items)** —
`data.hotels` (catalog metadata) alone produces nothing. So when LiteAPI's
`/hotels/rates` returns an **empty `data.data`** (catalog exists, zero bookable
rates), `merged = []` → `recommendations = []` → the dashed empty state.

- **Sandbox (current):** metadata-only for many markets — returns catalog hotels
  with **zero priced rate items** for Bali (consistent with the prior
  `audit-reports/travel-accommodation-thin-audit.md` "1-hotel / thin" finding;
  now zero for this 7-night July-2026 coord search). → `data.data = []` → empty.
- **Production:** would return live priced offers (`data.data` populated) for the
  same coords/dates → a populated carousel.

**Runtime confirmation point (not reachable from here):** the PR-7 diagnostic log
at `liteapiClient.ts:252-258` logs `dataLen` / `hotelsLen`. In Vercel logs, the
signature of this case is **`dataLen: 0`** (often with `hotelsLen > 0`). I cannot
read Vercel logs from this sandbox, but the client render (dashed, not red)
already establishes empty-not-error without them.

---

## 5. The 185-nights display (Thing 2)

Source: **`TripPlannerAI.tsx:746`**:
```tsx
<span className="text-text-muted">{tripDates.departure} → {tripDates.return} · {daysTravel} nights</span>
```
`daysTravel` is a component prop (`:184`) = the **whole-trip span** (2026-07-01 →
2027-01-01). So "185 nights" is the **scan-window / whole-destination span
display label** — **NOT a per-stay value**, and **NOT** what's sent to LiteAPI.
(For Track B: a stay is not the 185-night window — confirmed. No change made.)

---

## 6. Check-in/checkout actually sent — is 185 nights the bug? **NO.**

The route does **not** send the 185-night window. `route.ts:217-222` caps it at
a **7-night stopgap** (`checkin = trip.startDate`, `checkout = +7`), explicitly to
avoid the "no hotel offers a 185-night rate → 0 results / $58k totals" failure
(documented in the comment at `route.ts:205-216`). So for Bali the search sends
**2026-07-01 → 2026-07-08**, a realistic window. **The 185-night window is NOT a
contributing cause** — that bug is already mitigated by the stopgap. (The proper
per-destination dates are deferred to PR-11/16 per the comment.)

---

## CLEAR VERDICT

**(a) Expected sandbox-empty.** "No accommodation found" is a genuine HTTP-200
empty result: LiteAPI **sandbox** returns **zero priced rate items** (`data.data
= []`) for the Bali coord search, and `searchHotelRates` builds recommendations
only from `data.data` (`liteapiClient.ts:265`), so the list is legitimately empty
→ the dashed empty-state (`TripPlannerAI.tsx:991-994`).

**Explicitly ruled out:**
- **(c) Swallowed error — NO.** Route rethrows (`route.ts:262`); client routes
  errors to a distinct red banner (`:344-347` → `:973-976`). The dashed message
  *by construction* only renders for a non-error empty. Fail-loud intact.
- **(b) 185-night-window bug — NO.** The route caps the search at 7 nights
  (`route.ts:217-222`); the 185 is only a display label (`TripPlannerAI.tsx:746`)
  and is never sent to LiteAPI.

**Not a mix.** Single cause: sandbox metadata-only → empty. **The fix is PR-16
(production key / `LITEAPI_MODE=production`), not a code bug.**

**One honest caveat:** this verdict rests on the screenshot showing the *dashed*
empty-state text (not the red error banner) — which the render logic proves is a
200-empty. To 100% close it at the data layer, read the PR-7 diagnostic log
(`liteapiClient.ts:252-258`) in Vercel and confirm `dataLen: 0` for the Bali
request — but no code change is warranted regardless.

---

**READ-ONLY audit. No implementation performed.**
