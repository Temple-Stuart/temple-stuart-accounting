# TRAVEL — "No Outgoing Requests" Audit: accommodation returns 0 without calling LiteAPI

**Branch:** `claude/travel-no-outgoing-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Ground truth:** Vercel shows the accommodation request makes **"No outgoing
requests"** — `searchHotelRates` never reaches `fetch()`. The prior audit's
assumption ("the LiteAPI block always calls searchHotelRates → the 3 lines fire")
is **disproven**: `searchHotelRates` is invoked but **throws before the network
send**. Find the short-circuit.

---

## The correction: "0 hotels" (`route.ts:244`) CANNOT coexist with "no outgoing request"

`searchHotelRates` has **no early `return []`** — it does
`countryNameToIso2 → build body → fetch()`, so it either **fetches or throws**
(`liteapiClient.ts:196-240`). The summary `[LiteAPI] accommodation: 0 hotels`
(`route.ts:244`) is in the **success branch, after** `await searchHotelRates(...)`
returns. So "0 hotels" **requires a successful fetch**. Since Vercel reports **no
outgoing request**, `route.ts:244` is **not** what's producing the "0" — the
accommodation request is **throwing pre-fetch**, and the "0 hotels" the user sees
is **stale cached `scanner_results`** in the UI (a prior sandbox scan that
genuinely returned 0), not a fresh server result.

## 1. Every pre-fetch exit between request entry and the LiteAPI `fetch()`

In order along the accommodation path:

| # | Exit | File:line | Reaches fetch? | Surfaces as |
|---|---|---|---|---|
| 400a | `if (!city || !country)` → 400 | `route.ts:154-155` | no | 400 — but affects **all** categories (shared city/country); Viator works ⇒ not this |
| 400b | invalid category → 400 | `route.ts:162-163` | no | 400 — `accommodation` is a valid `TRAVEL_COA` key (`travelCOA.ts:37`) ⇒ not this; this is the **concurrent** stale-category 400 |
| **A** | `if (!trip?.startDate \|\| !trip?.endDate) throw` | `route.ts:200-202` | no (pre-call) | generic **500** (outer catch final branch) |
| — | `findDestinationCoords` | `route.ts:228` | n/a | pure, returns null — never throws |
| **B** | `countryNameToIso2(params.country)` throws `LiteApiError` | `liteapiClient.ts:197` | **no (1st line of searchHotelRates)** | **502** api_error |
| **C** | `headers()` → `getApiKey()` throws `MissingLiteApiKeyError` | `liteapiClient.ts:44` (called at the fetch, `:240`) | **no (thrown while building fetch args)** | **500** missing_key |

A is **outside** the inner try (`:230`) → straight to the outer catch. B and C are
**inside** searchHotelRates (inside the inner try) → caught at `route.ts:257`
(`console.error '… error — failing loud'`) → **rethrown** → outer catch.

## 2. None of these log "0 hotels"; all return an ERROR (not a 200)

The inner catch (`route.ts:257-262`) rethrows; the **outer catch** maps each:
- `MissingLiteApiKeyError` → `console.error('[Scanner] accommodation: missing LiteAPI key (<mode>)')` + **500** `{ kind:'missing_key', mode }` (`route.ts:445-450`).
- `LiteApiError` (from `countryNameToIso2` or a non-2xx) → **502** `{ kind:'api_error' }` (`route.ts:452-457`).
- generic `Error` (the `:201` trip-dates throw) → **500** `{ error: message }` (final branch).

So a fresh pre-fetch bail returns **non-200**, and the client
(`TripPlannerAI.tsx:305` `if (!res.ok) throw`) routes it to **`categoryErrors`** →
a **red banner**, never the dashed "0 hotels". Confirms the "0 hotels" is stale UI.

## 3. The 400 is a different category (not accommodation)

`accommodation` is a valid COA category (`travelCOA.ts:37`) and shares the body's
`city`/`country` with every category (Viator categories load, so both are
present). So neither 400 path (`route.ts:155/:163`) fires for accommodation; the
concurrent 400 is a **different parallel category** with a stale/unmapped key
hitting `:163`.

## 4. The exact path that yields "0" with no outgoing request

The accommodation request **enters `searchHotelRates` and throws before `fetch()`
executes** (B or C), OR never calls it (A). The terminal `:244` "0 hotels" is
**not** on any of these paths — the "0" is cached UI. The single most likely
throwing line is **C**.

## 5. PRIME SUSPECT confirmed — missing/throwing key (`getApiKey`, liteapiClient.ts:44)

```ts
// liteapiClient.ts
:39 function getApiKey(): string {
:40   const mode = getMode();
:41   const key = mode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY;
:44   if (!key) throw new MissingLiteApiKeyError(mode);   // ← thrown BEFORE fetch
:46 }
:48 function headers() { return { 'X-API-Key': getApiKey(), … }; }
…
:240   const res = await fetch(url, { method:'POST', headers: headers(), body: … });  // headers() evaluated → getApiKey() → throw, before the network send
```
`headers()` is evaluated **while constructing the `fetch` arguments**, so
`getApiKey()` throws **before** `fetch()` opens a connection → **"No outgoing
requests"**, exactly the Vercel signal. `MissingLiteApiKeyError` even names the
missing var (`travelErrors.ts:71`): `LITEAPI_PRODUCTION_KEY is not configured`
(or `LITEAPI_SANDBOX_KEY`). This fits perfectly: the active mode's key env var is
**not set/readable** in the deployed runtime — e.g. `LITEAPI_MODE=production` but
`LITEAPI_PRODUCTION_KEY` unset (or never flipped to production and
`LITEAPI_SANDBOX_KEY` unset).

---

## VERDICT

**The accommodation request bails before the LiteAPI fetch — it does not reach
the network. The single most likely line is `getApiKey()` throwing
`MissingLiteApiKeyError` at `src/lib/liteapiClient.ts:44`**, invoked by
`headers()` inside the `fetch(...)` call at `liteapiClient.ts:240` — the throw
happens while building the fetch arguments, before any outgoing request. Cause:
the active mode's key (`LITEAPI_PRODUCTION_KEY` when `LITEAPI_MODE=production`,
else `LITEAPI_SANDBOX_KEY`) is **not configured in the deployed environment**.

It surfaces as a **500 `missing_key`** (`route.ts:445-450`) → red banner; the
"0 hotels" the user sees is **stale cached `scanner_results`**, not a live result.

### Disambiguate definitively in Vercel (read-only, already deployed)
Grep these — they pinpoint A vs B vs C:
1. **`[Scanner] accommodation: missing LiteAPI key`** (`route.ts:447`) → **C
   confirmed**; the `(<mode>)` says which key var to set.
2. **`[LiteAPI] mode=`** (PR-20, `liteapiClient.ts:236`, runs *before* the throw)
   → **`keyPrefix=none`** confirms the key is unread; `mode=production|sandbox`
   says which var.
3. If instead you see **`[Scanner] accommodation: LiteAPI error`** with
   "Unsupported country" → **B** (`countryNameToIso2`, `liteapiClient.ts:197`).
4. If **`[LiteAPI] accommodation: … (checkin → checkout …)`** (`route.ts:229`) is
   **absent** → **A** (trip-dates throw at `route.ts:201`, before the search log).

Ranked likelihood given "No outgoing requests" + the prod-key flip context:
**C (missing key) ≫ B (country) > A (trip dates)**.

> Note: this also explains why the prior audit's 3 PR-20 lines seemed absent —
> on path **C**, `fetch` never runs, so `[LiteAPI] rates http:` (`:249`) and
> `[LiteAPI] rates raw:` (`:259`) **never execute**; only `[LiteAPI] mode=`
> (`:236`, pre-fetch) does — and it would read `keyPrefix=none`.

---

**READ-ONLY audit. No implementation performed.**
