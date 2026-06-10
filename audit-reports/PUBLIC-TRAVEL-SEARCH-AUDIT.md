# PUBLIC-TRAVEL-SEARCH-AUDIT

**Goal:** smallest safe path to a LIVE public travel search (free to all) that a bot
can't turn into a bill. Read-only audit. Every claim cites `file:line` against `main`
@ `9325459f`. Status: EXISTS · MISSING · REUSABLE · RISKS · RECOMMENDATION.

---

## 0. TL;DR — two premise corrections up front

1. **The brief says "reuse the existing rate-limiter." There is NO rate-limiter.**
   An exhaustive search of `src/lib`, `src/app/api/auth`, `src/middleware.ts` found
   **none** — even login/register are un-rate-limited. So the rate-limiter is **net-new,
   MANDATORY work**, not a reuse.
2. **There IS a durable cap-guard precedent to copy:** `src/lib/googlePlacesQuota.ts`
   (`googleFetch` + `GooglePlacesQuotaError`) — a DB-backed monthly cap that fails loud
   when crossed (`GOOGLE_PLACES_MONTHLY_CAP`, default 5000). The travel daily cap should
   be a near-clone of this. And a cache precedent exists too (`src/lib/placesCache.ts`,
   DB-backed). So the cap + cache are net-new code but **proven patterns**, not from-scratch.

Also: **only flight search is a standalone, public-able route.** Hotel (LiteAPI) and
activity (Viator) search are embedded inside the **tier-gated AI scan** (`ai-assistant`,
`requireTier('tripAI')`), not separate routes — so "public hotel/activity search" is a
much bigger extraction. The smallest safe public live search = **flights (Duffel) only.**

---

## 0b. WHAT'S ON MAIN RIGHT NOW

- **T4b mounted:** `TravelPipelineShowroom` (the LOCKED, fetch-free travel showroom) is
  imported + rendered in the travel card — `ModuleLauncher.tsx:6,114`.
- **T5 NOT done:** the PR10 guardrail (`scripts/assert-showroom-fetch-free.mjs`) asserts
  **12 Operations files only** (`SUBTREE_FILES` `:30-46`) — **zero travel files**. So the
  travel showroom is live but NOT guardrail-asserted. (This makes the §6 collision
  *avoidable* — see below.)

---

## 1. THE SEARCH ROUTES + COST REALITY

| Provider | Search route | Method | Auth gate | Tier | Provider call | Cost model in code |
|---|---|---|---|---|---|---|
| **Flight (Duffel)** | `api/flights/search/route.ts` | GET | `getVerifiedEmail()` `:8` → 401 | none | `searchFlights` (`:37`) → `duffel.ts:40` `POST /air/offer_requests` | **MISSING** |
| **Hotel (LiteAPI)** | NONE standalone — inside `api/trips/[id]/ai-assistant/route.ts` | POST | `getVerifiedEmail()` `:128` → 401 | **`requireTier('tripAI')` `:135` → 403** | `searchHotelRates` → `liteapiClient.ts:244` `POST /v3.0/hotels/rates` | **MISSING** (search); detail calls `/v3.0/data/*` are PAID `liteapiClient.ts:731,791` |
| **Activity (Viator)** | NONE standalone — inside `ai-assistant` (`:333`) | POST | `getVerifiedEmail()` `:128` → 401 | **`requireTier('tripAI')` `:135`** | `searchViatorProducts` → `viatorClient.ts:296` `POST /partner/search/freetext` | **MISSING** |
| **Ground (transfer)** | `api/trips/[id]/transfers/route.ts` | GET/POST | `getVerifiedEmail()` `:9/29` → 401 | none | **STUB** — only `prisma.trip_transfer_options`, no Mozio | N/A |
| **(AI scan)** | `api/trips/[id]/ai-assistant/route.ts` | POST | `getVerifiedEmail()` `:128` | `requireTier('tripAI')` `:135` | dispatches LiteAPI/Viator/Google | Google via `googleFetch` cap; LiteAPI/Viator MISSING |
| **(Destinations)** | `api/destinations/route.ts` | GET | **NONE (already public)** `:118` | none | local DB only | N/A — no provider cost |

**Which gate comes off to go public:** for **flights**, remove `getVerifiedEmail()`
(`flights/search/route.ts:8-10`). It has **no `requireTier`**, so that single gate is the
only thing making it private. **The moment that gate is removed, the rate-limit + daily
cap become the ONLY cost protection — so they are mandatory before the gate comes off.**

**Cost-model reality — UNDOCUMENTED (a real blocker):** the code states **nothing** about
whether Duffel `offer_requests`, LiteAPI `hotels/rates`, or Viator `freetext` SEARCH are
free-allowance vs per-call billed. Only LiteAPI **detail** calls (`/v3.0/data/reviews`,
`/v3.0/data/hotel`) are marked PAID (`liteapiClient.ts:731,791`). Viator notes a **rate
limit** (150 req/10s, `viatorClient.ts:3`) but no price. **You cannot confirm the
free-allowance reality from the codebase — it must be confirmed against each provider's
dashboard/contract before going public.** The daily cap protects regardless of the
answer; the cap *size* depends on it.

---

## 2. EXISTING RATE-LIMITER — **MISSING** (must build)

- **No rate-limiting anywhere.** `src/app/api/auth/login|register|signup/route.ts`,
  `src/middleware.ts`, `src/lib/cookie-auth.ts` — none implement per-IP/per-session
  attempt limits. The middleware (`:70-91`) does HMAC cookie verification only.
- **REUSABLE:** nothing to reuse — it is net-new. The closest durable-counter pattern to
  model on is `googlePlacesQuota.ts` (§3). For a v1, a per-IP token bucket can be:
  - **in-memory** (a `Map<ip, {count, windowStart}>`, keyed by `x-forwarded-for`) — simple,
    but **resets on every deploy and is per-lambda** (a bot hitting many cold lambdas
    isn't fully bounded), or
  - **durable** (a small DB table keyed by `ip+window`, like `google_places_usage`) — survives
    deploys, bounds across lambdas. **Given the cap table already proves the DB pattern,
    durable is only marginally more work and much safer.**
- **Keying:** there is no existing key; use `request.headers.get('x-forwarded-for')`
  (Vercel-provided client IP). Per-IP is the only option for anonymous visitors.

---

## 3. DAILY CAP (the hard backstop) — **REUSABLE pattern exists**

- **EXISTS / REUSABLE:** `src/lib/googlePlacesQuota.ts` is exactly the shape needed:
  - `googleFetch(url)` increments a **DB counter** (`prisma.google_places_usage.upsert`,
    `:48`) keyed by `yearMonth` (`:36`), and **throws `GooglePlacesQuotaError`** (`:15`)
    when `callCount > cap` — fail-loud, no silent fallback (`:4-6`). Cap from
    `GOOGLE_PLACES_MONTHLY_CAP` (`:27-28`, default 5000), warns at 80% (`:13`).
  - `getGoogleUsage()` (`:33`) exposes current usage for an admin view.
- **Smallest travel version (near-clone, net-new but trivial):** a `travelSearchQuota.ts`
  with a counter keyed by **`date + provider`** (e.g. `2026-06-10:duffel`), a
  `travel_search_usage` table (mirror `google_places_usage`), `incrementOrThrow()` that
  upserts + throws a `TravelSearchCapError` past the cap, env caps per provider
  (`DUFFEL_DAILY_CAP`, etc.). The search route wraps the provider call: on the error,
  return **503 "search paused for today"**. **Increment only on a real (uncached) provider
  call** so cached hits don't count (ties into §4).
- **Where it lives:** `src/lib/travelSearchQuota.ts` (sibling of `googlePlacesQuota.ts`),
  called from inside `searchFlights` or the route handler just before the provider fetch.

---

## 4. CACHING (fast-follow — note, don't build now)

- **REUSABLE precedent:** `src/lib/placesCache.ts` — a **DB-backed cache**
  (`prisma.places_cache`, `getCachedPlaces` `:23` / `cachePlaces` `:86`), keyed by
  city/country/category. Also an in-lambda memo in `viatorClient.ts:62-76` (24h
  destinations TTL `:72`) — but that's per-cold-start, not cross-lambda.
- **Smallest future cache (document for later):** a `travel_search_cache` table keyed by
  `provider + normalized(origin,destination,dates,pax)`, TTL ~1h. On a search: check
  cache → serve (no provider call, no cap increment); miss → provider call (cap++),
  then store. This is what makes "free public search" sustainable (a viral repeat search
  doesn't bill). **Mandatory for scale, optional for the first ship** (the cap protects
  the wallet meanwhile; cache protects the UX + bill at volume).

---

## 5. BOOKING + TIER STILL GATED

- **Booking — ALL four gated (no ungated route found):**
  - LiteAPI **book** — `getVerifiedEmail()` → 401, `travel/liteapi/book/route.ts:39-41`
  - LiteAPI **prebook** — `travel/liteapi/prebook/route.ts:15-17`
  - Duffel **flight book** — `flights/book/route.ts:8-10`
  - **vendor-commit** (POST + DELETE) — `trips/[id]/vendor-commit/route.ts:82-87, 363-368`
  → **No booking/mutation route is missing auth.** Search going public does NOT touch these.
- **Tier mechanism:** `requireTier(tier, feature, userId)` (`auth-helpers.ts:41-49`) →
  `canAccess` (`tiers.ts:66-71`); tiers `free|pro|pro_plus` (`tiers.ts:28-59`); feature
  keys in use: `plaid`, `ai`, `tripAI` (only `ai-assistant:135` uses `tripAI`).
- **Per-category tier: MISSING.** `travelCategories.ts:5-40` and `travelCOA.ts`
  (`COACategory`) have **no `isPremium`/tier field** — categories are not individually
  gated. So "paid-tier budget categories" do not exist as a per-category mechanism today;
  the only travel tier gate is the whole `ai-assistant` scan (`tripAI`). If budget/lifestyle
  categories must be Pro-only later, that's a **net-new per-category flag** + a gate — out
  of scope for public *search* (search has no per-category tiering to preserve).

---

## 6. GUARDRAIL COLLISION — avoidable (travel isn't guarded yet)

- **The collision:** the guardrail asserts its subtree is **fetch-free**
  (`assert-showroom-fetch-free.mjs`, forbidden `fetch(` etc.). A live-search travel surface
  **fetches**. So a live travel surface can NEVER be in the guardrail's asserted list.
- **But there is no collision today:** the guardrail's `SUBTREE_FILES` (`:30-46`) lists
  **only Operations files** — **no travel file is asserted**. T4b's locked travel showroom
  is mounted but unguarded.
- **Options:**
  - **(a) Retire the locked `TravelPipelineShowroom`, replace it with the live-search
    travel surface; keep the guardrail scoped to Operations only (unchanged).** The locked
    showroom existed *because* search was auth-gated; once search is public + bot-proof,
    the real live search is strictly better, and travel simply never enters the fetch-free
    subtree. **← RECOMMEND.**
  - (b) Keep both (locked showroom + a separate live surface) — confusing, duplicative; no
    reason to.
- **RECOMMEND (a).** It needs **no guardrail edit** (travel was never in it). Operations
  stays fully guarded; travel is a live, rate-limited, capped public surface — a different
  safety model (limits, not fetch-freeness), appropriate because its money path (booking)
  stays auth-gated (§5).

---

## EXISTS | MISSING | REUSABLE | RISKS

- **EXISTS:** standalone Duffel flight-search route (auth-gated, no tier); a public
  no-auth `destinations` route (DB-only); durable cap guard (`googlePlacesQuota.ts`);
  DB cache (`placesCache.ts`); all booking routes auth-gated; `requireTier`.
- **MISSING:** any rate-limiter (even on auth); a standalone public hotel/activity search
  route (they're inside the tier-gated AI scan); documented provider cost models; a
  per-category tier flag; a travel search-cache + daily-cap (patterns exist, code doesn't).
- **REUSABLE:** `googlePlacesQuota` (clone → `travelSearchQuota`), `placesCache` (clone →
  travel search cache), `getVerifiedEmail`/`requireTier` (leave booking gated), the
  `google_places_usage` table shape (durable counter).
- **RISKS:**
  - **Cost model unknown (highest).** Can't confirm from code whether Duffel/LiteAPI/Viator
    bill per search. Going public without confirming = blind exposure; the daily cap
    bounds worst-case spend but you must set the cap from real prices.
  - **Rate-limiter is net-new** and must land *before* the auth gate comes off — otherwise
    the route is unbounded.
  - **In-memory limiter is per-lambda + deploy-volatile** — a determined bot across cold
    lambdas isn't fully bounded; prefer the durable (DB) counter.
  - Hotel/activity public search would require **un-nesting them from the tier-gated AI
    scan** — large; keep them auth-gated/Pro for now.

---

## RECOMMENDATION — smallest atomic-PR chain (flights-only public live search)

**Pre-req (no code):** Confirm Duffel `offer_requests`, LiteAPI `hotels/rates`, Viator
`freetext` pricing on each provider dashboard. Set per-provider daily caps from that. If
any **bills per search call**, the cap + cache become non-negotiable and the cap must be
conservative.

1. **PR-1 · `travelSearchQuota.ts` (the kill-switch).** Clone `googlePlacesQuota.ts`:
   durable counter keyed by `date+provider` (`travel_search_usage` table), `incrementOrThrow`,
   `TravelSearchCapError`, env caps. Fail-loud → 503. *No route changes yet.* (Mandatory backstop.)
2. **PR-2 · rate-limiter util (`rateLimit.ts`).** Net-new, durable per-IP/window (model on
   the `google_places_usage` DB pattern), keyed by `x-forwarded-for`. Reusable function;
   not wired yet. (Mandatory — MISSING today.)
3. **PR-3 · make flight search public + bounded.** In `flights/search/route.ts`: remove
   the `getVerifiedEmail` 401 gate, and wrap the provider call with **rate-limit (PR-2) +
   daily cap (PR-1)** — 429 when rate-limited, 503 when capped. Booking stays gated (§5).
4. **PR-4 · swap the surface.** Retire the locked `TravelPipelineShowroom` from the travel
   card; mount the **live flight-search** surface (reuse `FlightPickerView` wired to the now-public
   `/api/flights/search`, booking/commit still → auth). Guardrail untouched (travel never in it, §6).
5. **PR-5 · (fast-follow) search cache.** Clone `placesCache.ts` → `travel_search_cache`
   (key = provider+route+dates, TTL ~1h); increment the cap only on cache miss. Protects
   bill + UX at volume.

**Net:** a public, free, live **flight** search that is bot-bounded by a durable per-IP
rate-limit + a hard per-day provider cap (fail-loud 503), with booking + paid-tier still
auth-gated, and the fetch-free guardrail left scoped to Operations. Hotel/activity stay
Pro-gated inside the AI scan until a later un-nesting effort.
