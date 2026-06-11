# VISA REQUIREMENTS SURFACE AUDIT (Travel Buddy API)

**Scope:** scope building a **visa-requirements** surface — "does a US passport
need a visa for Indonesia, how long can they stay, official portal link" — using
the **Travel Buddy Visa Requirements API**. This is **DATA + an affiliate handoff**
(iVisa commission), NOT bookable inventory. It replaces the "Visas & entry"
`ComingSoonSection`. Travel Buddy is a **NET-NEW provider (no client today)**.
**Audit only. No source modified.** `Missing = MISSING`.

Branch: `claude/audit-visa-requirements-surface` · main @ `a622d954`.

> **Contract status:** the live docs at `https://travel-buddy.ai/api/` did not
> return a machine-readable contract on fetch (JS-rendered/blocked). Per the
> brief, **Alex (key-holder) confirms the exact request/response shape from the
> live API before the normalizer is written.** Every field shape below is marked
> **PENDING-CONFIRM** — no guessed response shape is to be shipped (truth-first).

---

## VERDICT (up front, honest)

**Net-new integration, but SMALL and clean** — closer to "one more activity-style
clone" than the Mozio build, because:
- It's a **single synchronous GET** (passport + destination → one JSON answer), not
  Mozio's POST-then-poll async search. The provider-client is thin.
- **No DB/enum migration is actually required** (see §0): `reserveTravelSearch`
  already accepts any string and the `provider` column is a plain `String` — the
  "enum add" is a one-line TS type widening for documentation, not a Prisma
  migration.
- The UI is a simple **data card**, not photo cards or a scroller.

Size: **4 small PRs** (V1 client → V2 route → V3 view → V4 container+mount), with
the client (V1) gated on Alex confirming the live contract + key.

---

## 0. ORIENT — the patterns to reuse

### Provider-client template — `src/lib/liteapiClient.ts` (the closest fit)
A thin client lib is: **key from env → base URL const → typed fetch fn →
normalizer → typed errors**. Cites:
- Env key + base URL: `LITEAPI_BASE = 'https://api.liteapi.travel/v3.0'`
  (`liteapiClient.ts:22`); key read from `process.env.LITEAPI_*` with a
  `MissingLiteApiKeyError` throw when absent (`:42-44`).
- Typed fetch fn: `searchHotelRates(...)` (`:201`) — "Throws
  `MissingLiteApiKeyError` if no key set, `LiteApiError` on non-2xx" (`:200`).
- Normalizer to a clean shape: `liteApiHotelToRecommendation(...)` (`:472`).
- Typed errors: `MissingLiteApiKeyError` / `LiteApiError` in
  `src/lib/travelErrors.ts` (`:67`,`:80`), alongside the Google/Viator pairs
  (`:11`,`:24`,`:41`,`:53`). The header comment already anticipates new providers
  ("future LiteAPI/Mozio/Airalo/Cover Genius", `:2`) — Travel Buddy joins this
  family with a `MissingTravelBuddyKeyError` + `TravelBuddyApiError`.
- `viatorClient.ts` is the alternative template (same structure: `getApiKey()`
  from `process.env.VIATOR_API_KEY`, base const, search fn, exported normalizer).

### Public-guarded-route template — `api/travel/activities/search/route.ts`
The exact guard order to mirror:
- `rateLimit('activity-search:'+ip)` (`:43`) → param validation → 400 (`:56`) →
  `reserveTravelSearch('viator')` (`:61`) → provider call (`:67`); both guards run
  BEFORE the provider call, `RateLimitError`→429 / `TravelSearchQuotaError`→503 in
  `catch`. **Visa lookups are paid-allowance calls too → identical guarding.**

### The placeholder this replaces — `ComingSoonSection` "Visas & entry"
- `src/components/home/ModuleLauncher.tsx:202-203`: `<ComingSoonSection
  title="Visas & entry" explainer="Check what you need to enter, and handle visas
  without the guesswork." />`, in the Post-Activities placeholders block (`:199`).
  PR-V4 swaps this single element for `<PublicVisaCheck />`.

### Provider-key enum — **NO schema migration needed** (premise correction)
- `reserveTravelSearch(provider: TravelProvider | string)` already accepts a raw
  string (`travelSearchQuota.ts:62`); the upsert key is `(searchDate, provider)`
  (`:65-68`).
- `travel_search_usage.provider` is a **plain `String` column** (`schema.prisma:1122`,
  comment lists `"duffel" | "liteapi" | "viator" | "mozio"` only as a hint) — **no
  Postgres enum / check constraint.** So `reserveTravelSearch('travelbuddy')` works
  at compile-time AND DB-time **with zero migration.**
- The only change is **cosmetic/type-safety**: widen the TS union
  `TravelProvider = 'duffel' | 'liteapi' | 'viator' | 'mozio'`
  (`travelSearchQuota.ts:19`) to add `'travelbuddy'`. One-line edit, no DB work.
- Cap env already generic: `dailyCap('travelbuddy')` reads
  `TRAVEL_SEARCH_DAILY_CAP_TRAVELBUDDY` → `TRAVEL_SEARCH_DAILY_CAP` → default
  (`:39-44`). **Ready as-is.**

---

## 1. THE TRAVEL BUDDY API (what we integrate) — PENDING-CONFIRM

**Likely shape** (industry-standard for visa-requirements APIs; **confirm against
the live API + key before coding the normalizer**):
- **Request:** `GET` (single sync call) with a **passport/nationality country** +
  **destination country**, most likely as **ISO-2 codes** (e.g. `US` → `ID`). Some
  visa APIs accept ISO-3 or country names — **CONFIRM the exact param names +
  format**.
- **Auth:** an API key, most likely an `X-Api-Key` / `Authorization` header or a
  query param — **CONFIRM header name**. **MISSING today:** no `TRAVELBUDDY_API_KEY`
  (or any visa env) is referenced anywhere in the repo (grep of `travelbuddy` /
  `ivisa` / `visa` found only an unrelated `visaEase` trip-interest tag at
  `ActivityDestinationSelector.tsx:162`). → a new env var + a real key (Alex).
- **Response (likely fields, CONFIRM each):**
  - `visaStatus`: visa-free / visa-on-arrival / e-visa / visa-required / banned.
  - `allowedStayDays` (or a "max stay" string).
  - `fee` / `currency` (may be absent for many pairs).
  - `officialPortalUrl` (government application link).
  - possibly notes (validity window, passport-validity rule, onward-ticket reqs).

**Country-code helper that already exists:** `countryNameToIso2(name)`
(`liteapiClient.ts:92`) — reusable to turn a dropdown's country name into the
ISO-2 the API likely wants. **MISSING:** a full **country LIST** for the two
dropdowns (passport + destination) is not exported anywhere
(`destinations.ts` lists cities, not a flat country picker) → PR-V4 needs a small
static ISO-3166 country list (build, or extend `countryNameToIso2`'s internal map
to also export its keys).

---

## 2. THE INTEGRATION (net-new, like Mozio but thinner)

### PR-V1 — `src/lib/travelBuddyClient.ts` (the integration; gate on live key)
- `process.env.TRAVELBUDDY_API_KEY` → `MissingTravelBuddyKeyError` when absent
  (mirror `liteapiClient.ts:42-44` + `travelErrors.ts:67`).
- `const TRAVELBUDDY_BASE = '…'` (CONFIRM base URL).
- `export async function getVisaRequirements(passport, destination):
  Promise<VisaRequirement>` — single GET, throws `TravelBuddyApiError` on non-2xx
  (mirror `searchHotelRates`'s error discipline, `:200-201`).
- Exported normalizer → a clean **`VisaRequirement`** shape (PENDING-CONFIRM):
  `{ passport, destination, status, allowedStayDays?, fee?, currency?,
  officialUrl?, notes? }`.
- Typed errors in `travelErrors.ts`: `MissingTravelBuddyKeyError` +
  `TravelBuddyApiError` (same pattern as the existing six).
- **No route wiring in V1** (mirrors how PR-1/PR-2 added utils before PR-3 wired
  them). **TRUTH-FIRST: the normalizer's field mapping is written ONLY after Alex
  confirms the live response — do not ship a guessed mapping.**

### PR-V2 — public guarded route `api/travel/visa/check`
- Mirror activities exactly: extract IP →
  `rateLimit('visa-check:'+ip, { limit: SEARCH_RATE_LIMIT||10, window: 60 })` →
  validate `passport` + `destination` (400) → `reserveTravelSearch('travelbuddy')`
  → `getVisaRequirements(...)` → return the normalized object. No auth gate (visa
  data is public value). `RateLimitError`→429+Retry-After, `TravelSearchQuotaError`
  →503, else 500. **Add `'travelbuddy'` to the `TravelProvider` union (one line,
  no migration) in this PR** so the call is type-clean.

### PR-V3 — `VisaResultView` (NOT photo cards)
- A single **data card**: a status banner (color-coded by `status` — e.g.
  `brand-green` visa-free, `brand-amber` e-visa/on-arrival, `brand-red`
  visa-required), the allowed-stay duration, fee if present, any notes, and an
  **"Apply / Official portal"** action. Props-only, no fetch. Loading/empty/error
  states like the other views.

### PR-V4 — `PublicVisaCheck` container + mount
- Two dropdowns (passport country + destination country) → `fetch('/api/travel/
  visa/check?passport=…&destination=…')` → `VisaResultView`. Replaces the
  `ComingSoonSection` at `ModuleLauncher.tsx:202-203`. Reuses the live-search
  container idiom (form → fetch public route → view) from `PublicActivitySearch`.

---

## 3. THE AFFILIATE HANDOFF (the commission, done right)

- **Two possible "Apply" targets:** (a) the **official government portal** from the
  API response (`officialUrl`), and/or (b) an **iVisa affiliate link** with our
  affiliate code (commission). Viator's affiliate URL builder
  (`viatorClient.ts:242` `buildAffiliateUrl`) is the pattern for stamping an
  affiliate code onto an outbound link.
- **Honest design recommendation — value-first, PUBLIC link (NOT gated):** the
  visa **data is free public value**, and the affiliate "Apply" is a **handoff**
  (an outbound `<a href>` to iVisa/official portal), **not a paid in-app action**.
  Unlike hotel/activity **booking** (which we gate because it places a real
  order / burns a paid action), an affiliate click costs us nothing and earns
  commission. → **Render "Apply" as a real `<a href target="_blank" rel="noopener
  noreferrer">` for guests** — do NOT route it to `onRequireAuth`. Gating it would
  suppress the very commission the surface exists to earn and add friction to free
  value.
- **CONTRAST with the activity affiliate-DROP (PR-A1):** there we *stripped* the
  affiliate URL from the public **search** payload because the booking was meant to
  be gated behind sign-up. Here the opposite is correct: the affiliate link **is
  the product's call-to-action** and is meant to be public. This is a deliberate,
  different choice — flagged so it's not seen as inconsistent.
- **CONFIRM (Alex):** that the iVisa affiliate agreement has **no per-click cost to
  us** (standard affiliate = we earn on conversion, click is free). If — unusually —
  there were a per-click fee, revisit gating. Default assumption: free click,
  public link.

---

## 4. COST / GUARDING

- **Travel Buddy = paid-allowance API** (free tier + paid tiers per their site;
  **exact limits/pricing = KEY-HOLDER-CONFIRM**, Alex). The `visa/check` route is a
  real per-call allowance hit → guard with `rateLimit('visa-check:'+ip)` +
  `reserveTravelSearch('travelbuddy')`, identical to activities. The daily cap
  (`TRAVEL_SEARCH_DAILY_CAP_TRAVELBUDDY`) bounds worst-case spend; set it
  conservatively from the confirmed plan.
- **One call per check** (single GET, no fan-out — unlike Viator/Mozio) → one
  `reserveTravelSearch` reservation ≈ exactly one provider call. Clean accounting.
- **Cache fast-follow (optional):** visa rules for a (passport, destination) pair
  change rarely → a short-TTL cache (even in-DB, mirroring `google_places_usage`
  style) would cut allowance use dramatically. Not required for V1; note as a
  follow-up.

---

## REPORT — EXISTS | MISSING | REUSABLE | RECOMMENDATION

### EXISTS
- Provider-client template (`liteapiClient.ts` / `viatorClient.ts`): env-key →
  base → fetch fn → normalizer → typed errors.
- Public-guarded-route template (`activities/search/route.ts`): `rateLimit` +
  `reserveTravelSearch` + 429/503/500.
- Guards: `rateLimit` (`rateLimit.ts`) + `reserveTravelSearch` accepting **any
  string** (`travelSearchQuota.ts:62`); `dailyCap` already generic (`:39`).
- `provider` is a plain `String` DB column (`schema.prisma:1122`) → **no migration**
  for a `'travelbuddy'` key.
- `countryNameToIso2` (`liteapiClient.ts:92`) for the dropdown → ISO-2 conversion.
- Affiliate-URL pattern (`viatorClient.ts:242`).
- The `ComingSoonSection` slot to replace (`ModuleLauncher.tsx:202`).

### MISSING
- `travelBuddyClient.ts` (the client) + `MissingTravelBuddyKeyError` /
  `TravelBuddyApiError`.
- `TRAVELBUDDY_API_KEY` env + the real key (Alex) + the **confirmed live contract**.
- The route `api/travel/visa/check`, `VisaResultView`, `PublicVisaCheck`.
- A flat **country list** for the two dropdowns (build small static ISO-3166 list).
- `'travelbuddy'` in the `TravelProvider` union (one-line TS, no DB migration).

### REUSABLE
- Both guards + the route guard-order; the client structure + error pattern; the
  container idiom (`PublicActivitySearch`); the affiliate-link pattern; the
  ComingSoonSection swap.

### RECOMMENDATION — smallest atomic-PR chain

1. **PR-V0 (confirm, blocking):** Alex provides `TRAVELBUDDY_API_KEY` + the live
   request/response contract (params, ISO format, auth header, response fields) +
   the plan's allowance/pricing. **Nothing below codes the normalizer until this
   is pinned** (truth-first — no guessed shapes).
2. **PR-V1 — `travelBuddyClient.ts`:** env key, base URL, `getVisaRequirements()`,
   the `VisaRequirement` normalizer (mapped to the CONFIRMED response),
   `MissingTravelBuddyKeyError` + `TravelBuddyApiError`. No route wiring.
3. **PR-V2 — public route `api/travel/visa/check`:** `rateLimit('visa-check:'+ip)`
   → validate passport/destination → `reserveTravelSearch('travelbuddy')` →
   `getVisaRequirements()`. Add `'travelbuddy'` to the `TravelProvider` union (one
   line). No auth gate.
4. **PR-V3 — `VisaResultView`:** a color-coded status data card (visa-free /
   e-visa / required) + stay duration + fee + an **"Apply" `<a href>`** (public,
   affiliate/official link). No photo cards. Loading/empty/error states.
5. **PR-V4 — `PublicVisaCheck` + mount:** passport + destination dropdowns → route
   → view; replace the "Visas & entry" `ComingSoonSection`
   (`ModuleLauncher.tsx:202`). Match the live sections' header style (PR-T-Headers).
6. **PR-V5 (optional fast-follow):** short-TTL cache on (passport, destination) to
   cut allowance use; a section header/explainer parity pass.

**Flags (must-confirm before coding):** the **live contract + key** (Alex) — params,
ISO format, auth header, response fields; **pricing/allowance** (key-holder-confirm,
cap bounds it); the **iVisa affiliate = no per-click cost** assumption (default:
free click → public "Apply" link, NOT gated). **No DB migration** is needed for the
provider key — only a one-line TS union widening.
