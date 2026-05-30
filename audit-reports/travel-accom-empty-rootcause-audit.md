# TRAVEL — Accommodation Empty Root-Cause: hardBookable vs 400 vs date distance

**Branch:** `claude/travel-accom-empty-rootcause-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Determine which variable controls the empty result BEFORE
building the date picker (PR-19).
**Symptoms:** `[LiteAPI] accommodation: 0 hotels (hardBookable=true)` + a POST 400
on `/ai-assistant`.

---

## 1. hardBookable — NOT a filter, NOT a LiteAPI param

`hardBookable` for accommodation is `true` (`travelSourceRegistry.ts:63`),
destructured at `route.ts:182` (`const { source, hardBookable } = getSource(category)`).
**Everywhere it is used:**
- `route.ts:244` — interpolated into the **log string** only.
- `route.ts:258, :318` — **error-handling** (fail-loud; don't mask with Google).

**It is never passed to `searchHotelRates`** (`route.ts:231-236` omits it) and is
**never applied as a post-filter**. The result list is built by a pure `.map()`,
no `.filter()`:
```ts
const finalResults = hotels
  .map((h, idx) => liteApiHotelToRecommendation(h, idx, category))   // route.ts:239  maps EVERY hotel
  .sort((a, b) => b.compositeScore - a.compositeScore)
  .slice(0, maxResults)                                              // :241  maxResults = rawMaxResults || 33 (:166) — never 0
  .map((rec, idx) => ({ ...rec, valueRank: idx + 1 }));
console.log(`[LiteAPI] ${category}: ${finalResults.length} hotels (hardBookable=${hardBookable})`);  // :244
```
`liteApiHotelToRecommendation` never returns null and is not filtered, so
**`finalResults.length === hotels.length`** (capped at 33). The "0 hotels" count
is **post-map but there is nothing for the map to drop** — it equals the input.

**Verdict (Q1):** hardBookable does **not** zero results. It is purely a log
label + error-semantics flag. Turning it off would change nothing about the
count.

## 2. The 400 — a DIFFERENT category, independent of accommodation

Only two 400 paths exist in the route:
- `route.ts:155` — `'City and country required'` (missing `city`/`country`).
- `route.ts:163` — `'Valid category required'` (the category key is not in
  `TRAVEL_COA`, `CATEGORY_SEARCHES`, or `ACTIVITY_SEARCH_EXPANSIONS`, after alias
  resolution at `:148-151`).

Categories scan **in parallel** (`TripPlannerAI.tsx:271-274` →
`autoScanCategoriesFor` → `Promise.allSettled`), all sharing the **same
`city`/`country`** from one body (`TripPlannerAI.tsx:299`). Because the
**accommodation** request reached the LiteAPI block and logged "0 hotels"
(`route.ts:244`) and returned **200** (`route.ts:256`), accommodation **passed**
both 400 gates — it had valid city/country and a valid category.

→ **The 400 belongs to a different parallel category**, not accommodation. Since
all categories share city/country, the `:155` path is unlikely; the most probable
is **`:163` "Valid category required"** — a stale client bundle sending a
removed/renamed key not covered by the alias map (e.g. post-PR-9/PR-10 churn:
`sports_fitness`→`adventure` rename, `conferences` removed). It is a **real but
separate** error to fix on its own; it does **not** cause the accommodation
empty. (Exact category needs the request body from Vercel logs — not the
accommodation one.)

## 3. THE CRUX — raw `dataLen` vs the "0 hotels" count

The chain is loss-free:
```
data.data (raw rate items)                         liteapiClient.ts:265  rateItems = data.data || []
  → merged = rateItems.map(...)                    liteapiClient.ts:280  (attaches nights; no filter)
  → return merged.slice(0, 33)                     liteapiClient.ts:288  = `hotels` in the route
  → finalResults = hotels.map(...).slice(0,33)     route.ts:238-242      (no filter)
  → "0 hotels" = finalResults.length               route.ts:244
```
Therefore **`finalResults.length === min(data.data.length, 33)`**. There is no
filtering step anywhere — hotels cannot "vanish" in our code.

**So "0 hotels" ⟺ `dataLen: 0` (raw).** The `[LiteAPI rates] response shape:`
log (`liteapiClient.ts:252-258`) is the ground truth:
- `dataLen: 0` → LiteAPI itself returned no priced rate items → the empty is
  **upstream** (dates/availability/mode), **not** our filtering.
- `dataLen > 0` with "0 hotels" → **impossible** given the code (no filter); if
  ever observed it would indicate a mapper exception, but none exists.

This single comparison settles it: **hotels are not lost in our filtering — there
is no filtering. The empty originates in LiteAPI returning `data.data = []`.**

## 4. hardBookable provenance + the real "show non-bookable" decision

**Provenance:** hardcoded in the registry — `accommodation: { source: 'liteapi',
hardBookable: true }` (`travelSourceRegistry.ts:63`). The comment (`:60-61`) is
explicit: *"hardBookable means empty/error stays loud — no Google masking."* So
its meaning is **error semantics** (fail loud on error; never substitute Google
POIs), **not** an instant-bookable-only filter. Blaming it for the empty is a
misattribution.

**The real product decision (flagged for Alex):** the "only priced hotels are
shown" behavior comes from `rateItems = data.data || []`
(`liteapiClient.ts:265`) — we surface **only hotels that have a priced rate item
in `data.data`**. Pure-metadata properties that appear in `data.hotels` but have
**no rate** are never shown. So if Alex wants to display non-bookable /
metadata-only hotels (e.g. "see availability" / refer-out), that requires
surfacing `data.hotels` entries lacking rates — a deliberate change, **not a
hardBookable toggle**. ⚠️ **Alex decision, not changed here.** (Note: for the Bali
far-out search this still wouldn't populate the carousel unless `data.hotels` is
itself non-empty — check `hotelsLen` in the diagnostic log.)

## 5. Date isolation test

hardBookable is a registry constant and doesn't filter, so "hardBookable off"
isn't a meaningful variable to toggle. The clean isolation is the **near-date
test** (no code change):
1. Active destination = a high-inventory city (London/Bangkok/NYC); set the
   trip's `startDate` to **~2 weeks out** (drives `checkin`, `route.ts:218`).
2. Run the Accommodation scan; grep Vercel for `[LiteAPI rates] response shape:`.
3. **`dataLen > 0`** → the far-future Jul-2026 date was the cause → **PR-19 (date
   picker) fixes it.** **`dataLen: 0`** even near-term → it's mode/key/host or
   real no-availability → **PR-19 will NOT help**; resolve that first.

---

## VERDICT — which variable controls the empty

| Candidate | Controls the empty? | Evidence |
|---|---|---|
| **hardBookable filter** | **NO** | It's not a filter or LiteAPI param — only a log label + error-semantics flag (`route.ts:182,244,258,318`). `finalResults` is a pure map (`route.ts:238-242`); count == input count. |
| **The 400** | **NO** (separate bug) | Two 400 paths (`route.ts:155,163`); accommodation passed both (it logged "0 hotels" + returned 200). The 400 is a *different* parallel category — most likely an invalid/stale category key (`:163`). Fix independently. |
| **Date distance / upstream emptiness** | **YES (the cause)** | "0 hotels" ⟺ `data.data = []` (`liteapiClient.ts:265` → `route.ts:244`), loss-free. The empty is LiteAPI returning no rate items for the 13-month-out Bali window. |

**Order to rule out (already done for 1–2; 3 needs the log):**
1. ~~hardBookable~~ — **ruled out by code reading.** Not a filter.
2. ~~The 400~~ — **ruled out as the cause.** Separate category error; fix on its own.
3. **Dates/availability/mode — THE controlling variable.** Run the §5 near-date
   test and read `dataLen`.

**Does PR-19 address the problem?** **Only if the §5 test shows `dataLen > 0`
near-term.** If near-dates return rates, the empty is purely the far-future
window and the per-location date picker is exactly the fix. If near-dates also
return `dataLen: 0`, PR-19 would ship a picker over a dead search — resolve the
mode/key/availability issue first. **Run the near-date test before building
PR-19.**

---

**READ-ONLY audit. No implementation performed.**
