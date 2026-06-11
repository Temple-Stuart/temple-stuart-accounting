# PUBLIC GROUND TRANSIT SEARCH AUDIT (Mozio)

**Scope:** scope a PUBLIC live **ground-transit** search (airport transfers /
rides) — the 4th travel surface — with gated booking. **Decisive question:** is
there a provider client already in the repo (→ clone-chain like activities), or is
this a net-new provider integration (bigger)? **Audit only. No source modified.**
`Missing = MISSING`.

Branch: `claude/audit-public-ground-search` · main @ `be2f14af`.

## VERDICT (up front, honest)

**(b) NET-NEW PROVIDER INTEGRATION — not a clone-chain.** The provider is
identified (**Mozio**) and the *plumbing around* it exists (cap key, registry
slot, a UI stub, an authed manual-save route), but the **actual provider client —
search function, API key, auth headers, endpoint, error classes — is entirely
MISSING**. Flights/hotels/activities each had a working, exported lib client
(`duffel.ts` / `liteapiClient.ts` / `viatorClient.ts`) to wrap; ground has **none**.
This is a real integration build, materially bigger than PR-A1→A3.

---

## 0. ORIENT — the proven template (only reusable IF a client existed)

The activity chain (the closest mirror):
- **Public route** — `src/app/api/travel/activities/search/route.ts`: IP →
  `rateLimit('activity-search:'+ip)` (`:43`) → validate 400 (`:50-56`) →
  `reserveTravelSearch('viator')` (`:61`) → `searchViatorProducts()` + mapper
  (`:67`,`:74`) → `{results,count}` (`:81`). No auth gate.
- **Pure view** — `src/components/trips/ActivityResultsView.tsx` (props-only,
  placeholder image, `onBook` callback).
- **Container** — `src/components/trips/PublicActivitySearch.tsx` (form → fetch →
  view; `book = () => onRequireAuth()`).
- **Mount** — `ModuleLauncher.tsx:188`, full-width below hotels.
- **Guards** — `rateLimit` (`src/lib/rateLimit.ts`) + `reserveTravelSearch`
  (`src/lib/travelSearchQuota.ts`); both durable, fail-loud. **This template only
  applies to the route/view/container LAYER — it presupposes a provider client
  that does not exist for ground.**

---

## 1. WHAT EXISTS FOR GROUND TODAY (the decisive section)

### TransferPicker — confirmed STUB
- `src/components/trips/TransferPicker.tsx`. Its "search" (`fetchTransfers`,
  `:84-99`) calls **nothing**: it clears both option arrays (`:88-89`) and sets
  `error = 'Transfer search is not available. Use manual entry below.'` (`:92`).
  No fetch, no provider call. The only real inputs are **manual price entry**
  (`:117-139`) + outbound **Uber/Lyft price-estimate links** (`:294-295`). A
  stale "Test data from Amadeus API" footer (`:351`) is dead copy — no Amadeus
  client is wired (none found in `src/lib`).
- Sibling UI: `RidesharePicker.tsx`, `TransferOptions.tsx` — same family, no
  provider call.

### Provider client — MISSING
- `find src -iname "*mozio*" / *transfer* / *ground* / *ride* / *shuttle*` →
  **only UI components + the authed transfers route**. **No `mozioClient.ts`, no
  ground/transfer provider lib of any kind.** (Contrast: `duffel.ts`,
  `liteapiClient.ts`, `viatorClient.ts` all exist and are exported.)
- `src/lib/travelErrors.ts` has `Missing{Google,Viator,LiteApi}KeyError` (`:11`,
  `:41`,`:67`) — **no Mozio error class**; the header comment lists Mozio only as
  a *"future"* provider (`:2`).

### Provider enum / registry — declared, NOT connected
- **`'mozio'` IS already in the cap enum:** `export type TravelProvider =
  'duffel' | 'liteapi' | 'viator' | 'mozio'` (`travelSearchQuota.ts:19`). →
  **`reserveTravelSearch('mozio')` already works — NO schema/enum add needed.**
- **`src/lib/travelSourceRegistry.ts`:** `'mozio' // declared, NOT connected —
  bookable airport transfers` (`:22`); `ground_transport: { source: 'mozio',
  hardBookable: true }` (`:86`). The registry comment is explicit (`:80-85`):
  *"Declared bookable, providers NOT connected yet → fail loud (501) until their
  PRs land."* — ground is a known-pending integration, by design.

### Booking / save path — authed + MANUAL (no provider order)
- `src/app/api/trips/[id]/transfers/route.ts`: `GET` reads saved
  `trip_transfer_options` and `POST` **creates** one from **manually supplied**
  fields (`url, transfer_type, direction, title, vendor, price, …`, `:35`). Both
  are `getVerifiedEmail`-gated (401, `:10`/`:29`), trip-scoped, capped at 10/trip
  (`:41`). **There is NO provider-search booking path — only a manual
  save-what-you-found record.** A real Mozio "book this quote" order does not
  exist anywhere.

---

## 2. IF A PROVIDER CLIENT EXISTED — N/A

None exists. (Section retained for structure; nothing to cite.)

---

## 3. NO PROVIDER CLIENT EXISTS — what wiring Mozio takes (the real work)

**Realistic provider: Mozio** (named throughout: registry `:22`/`:86`, showroom
`demoTransfer.provider = { code: 'MOZIO', … }` `demoTravel.ts:161`). Alternatives
(Amadeus Transfers, direct rideshare) are not referenced in code and would be a
fresh choice; Mozio is the stack's declared intent.

**What Mozio's API needs (net-new, all MISSING in-repo):**
- **API key:** `grep process.env.*MOZIO*` → **none**. No `MOZIO_API_KEY` (or any
  transfer/ground env) referenced anywhere. → a new env var + a real Mozio partner
  key must be provisioned (name only — e.g. `MOZIO_API_KEY` — nothing exists yet).
- **Search shape:** Mozio's search is a **two-step async poll** (POST
  `/v2/search` → returns a `search_id`; GET `/v2/search/{id}/poll` until
  `more_coming=false`), keyed on **pickup + dropoff + datetime + passengers** —
  NOT a single synchronous call like Viator/LiteAPI. This is the integration's
  hard part and the reason it is not a clone. *(External API knowledge; not
  in-repo — flag for build-time confirmation against Mozio's current docs.)*
- **Result shape (what the view would show):** vehicle **class/type**, seats,
  bags, price, est. duration, provider/operator name. **Ground has NO real
  photos** — the existing `TransferOption.vehicle` carries an *optional*
  `imageURL` (`TransferPicker.tsx:15`) but the UI vocabulary is **vehicle-class
  icons** (`TRANSFER_TYPES`: 🚗 Private / 🚐 Shared / 🚕 Taxi, `:47-51`). → the
  results view is **icon-based, not photo cards** (unlike hotels/activities).

**MINIMUM to ship (each its own PR; the first is the integration, not a clone):**
1. **Provider client lib** `src/lib/mozioClient.ts` — `searchTransfers({pickup,
   dropoff, datetime, passengers})` handling the POST-then-poll flow, an
   exported normalizer `mozioOfferToRecommendation`, a `MissingMozioKeyError` +
   `MozioApiError` (mirroring `travelErrors.ts`). **This is the bulk of the work.**
2. Public guarded route (then the activity template applies):
   `api/travel/ground/search` — `rateLimit('ground-search:'+ip)` →
   `reserveTravelSearch('mozio')` → `searchTransfers()` + normalizer.
3. Pure **icon-based** `GroundResultsView` (vehicle class + price + duration +
   seats/bags + `onBook`; no photo cards, no affiliate href).
4. `PublicGroundSearch` container (pickup/dropoff/datetime/passengers form) + mount.

---

## 4. COST / BILLING MODEL

- **No in-code hint** — there is no Mozio client, so no pricing logic to cite.
- Mozio is a transfer **marketplace**: industry-standard model is **commission on
  booking** (search itself typically free / rate-limited), but the **partner
  agreement governs** and is **UNKNOWN from code**. → **DASHBOARD-CONFIRM** before
  any live key. The daily cap (`TRAVEL_SEARCH_DAILY_CAP_MOZIO` →
  `TRAVEL_SEARCH_DAILY_CAP` → default, via `dailyCap()`, `travelSearchQuota.ts:39`)
  bounds worst-case regardless — and the `'mozio'` key already exists.
- **Fan-out flag:** the POST-then-poll search issues **multiple HTTP calls per
  logical search** (one POST + N polls). Like the Viator fan-out, `reserveTravelSearch`
  counts one logical search; the client should bound poll count/time so one
  reservation ≈ one bounded search.

---

## 5. BOOKING GATING

- **However Mozio booking lands** (its booking is an **API order** —
  POST a reservation with the chosen `result_id` + traveler details, more like
  hotels' API-order than activities' affiliate URL), the public surface keeps
  **SEARCH only**: `Book → onRequireAuth`, no booking fetch in the public
  container.
- **Lock shape:** primarily **hotels-style (API-order, server-gated)** — a guest
  has no auth/trip context to place an order, and the order route must be
  `getVerifiedEmail`-gated like the existing transfers route
  (`transfers/route.ts:10`). **IF** Mozio also returns a deep-link/redirect, apply
  the **activities-style affiliate-drop** (strip any outbound URL from the public
  payload) as a belt-and-suspenders measure.
- The existing authed manual-save route (`transfers/route.ts`) stays as-is
  (untouched) — it's a separate, already-gated record path.

---

## REPORT — EXISTS | MISSING | REUSABLE | RISKS | RECOMMENDATION

### EXISTS
- Cap key `'mozio'` in `TravelProvider` (`travelSearchQuota.ts:19`) — no enum add.
- Registry slot `ground_transport → mozio` (`travelSourceRegistry.ts:86`), marked
  NOT connected (`:22`).
- A UI stub (`TransferPicker.tsx`) with a vehicle/option **shape** + manual entry.
- An authed, trip-scoped **manual** transfers save route (`transfers/route.ts`).
- The route/view/container/mount **template** (activity chain) — reusable for the
  LAYER above the client, once a client exists.

### MISSING
- **The Mozio provider client** (search fn, normalizer, errors) — the core work.
- A Mozio **API key** / env var (none referenced).
- A provider **search route** (`api/travel/ground/search`).
- A **GroundResultsView** (icon-based) + **PublicGroundSearch** container + mount.
- A real Mozio **booking/order** path (only manual-save exists).

### REUSABLE
- Both guards (`rateLimit`, `reserveTravelSearch('mozio')` — key already valid).
- The public-route guard-ordering pattern + the container's `onBook→onRequireAuth`
  booking lock + the view's placeholder/skeleton/empty/error scaffolding.
- `travelErrors.ts` as the pattern for `MissingMozioKeyError`/`MozioApiError`.

### RISKS
1. **It's an integration, not a clone** — the POST-then-poll async search is real
   work (the prior three were single synchronous calls). Estimating it as "another
   activity PR" would be wrong.
2. **No API key / unknown contract** — needs provisioning + a DASHBOARD-CONFIRM on
   pricing before any live call.
3. **Poll fan-out** — multiple HTTP calls per search; bound poll count so one
   `reserveTravelSearch('mozio')` ≈ one bounded search (cap still protects).
4. **No images** — results are icon/class-based; do NOT force the photo-card
   pattern. A broken expectation of "image-rich like hotels" would mislead.
5. **Stub dead copy** — `TransferPicker`'s "Amadeus API" footer (`:351`) is
   misleading; ensure the new surface doesn't inherit it.
6. **Booking order is heavier than affiliate** — a Mozio order needs traveler
   details + payment context; that is firmly authed and out of the public scope.

### RECOMMENDATION

**Ground is option (b): a net-new Mozio integration.** Do NOT treat it as an
activity-style clone. Smallest atomic-PR chain, provider-client FIRST:

1. **PR-G0 (spike / decision, optional, 1 file audit follow-up):** confirm Mozio
   partner access + key provisioning + current API contract (POST-then-poll, auth
   header) against the live dashboard. Gate the rest on a real key. *(Pricing =
   dashboard-confirm.)*
2. **PR-G1 — Mozio provider client** `src/lib/mozioClient.ts`: `searchTransfers()`
   (POST-then-poll, bounded), exported `mozioOfferToRecommendation` normalizer,
   `MissingMozioKeyError` + `MozioApiError`. **No route wiring in this PR** (mirror
   how PR-1/PR-2 added utils before PR-3 wired them). This is the integration.
3. **PR-G2 — public guarded route** `api/travel/ground/search`:
   `rateLimit('ground-search:'+ip)` → validate (pickup/dropoff/datetime/pax) →
   `reserveTravelSearch('mozio')` → `searchTransfers()` + normalizer → results.
   No auth gate. Bound the poll so one reservation ≈ one search.
4. **PR-G3 — pure `GroundResultsView`** (icon/vehicle-class cards: type, seats/bags,
   price, duration, provider; `onBook` callback; **no photo, no affiliate href**).
5. **PR-G4 — `PublicGroundSearch` container + mount** (pickup/dropoff/datetime/pax
   form → route → view; `onBook→onRequireAuth`) full-width below activities, with a
   matched section header (PR-T-Headers style).
6. **PR-G-Booking (later, authed)** — a real Mozio order route, `getVerifiedEmail`-
   gated, separate from the public surface.

**Bottom line:** flights/hotels/activities were three clones because their clients
already existed. Ground is the one surface that needs its provider **built** first
(PR-G1) — budget it as an integration, not a copy. Flag Mozio pricing as
**dashboard-confirm**; the `'mozio'` daily cap bounds the worst case.
