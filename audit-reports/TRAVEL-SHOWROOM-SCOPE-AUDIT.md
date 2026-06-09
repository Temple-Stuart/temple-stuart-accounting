# TRAVEL-SHOWROOM-SCOPE-AUDIT

**Scope:** What it takes to add a locked, demo-data Travel showroom under the home
travel banner — a horizontal-scroll row of category cards (Flight / Hotel / Ground
Transportation / Activities = BOOK+BUDGET; all other categories = BUDGET-ONLY) +
a travel itinerary calendar below. Read-only audit. Every claim cites `file:line`
against `main` @ `45d124ac` (PR F1 merged).

**Status legend:** EXISTS · EXISTS BUT UNUSED · MISSING · REUSABLE · RISKS

---

## 0. TL;DR

- The travel banner today is the **live, guest-gated `CreateTripForm`** (a real
  self-fetcher that POSTs `/api/trips`), NOT a locked preview. Keep it; the
  showroom is **additive below it**.
- **Four booking categories exist with very different shapes:** Flight
  (self-fetcher, **PAID Duffel**), Hotel (**already a pure view**; LiteAPI book
  lives in lib), Ground (**pure view, no provider at all — stub**), Activities
  (self-fetchers, Viator **affiliate-link** booking).
- **Real-money paths** are `Duffel /air/orders` (`src/lib/duffel.ts:137`, via
  `/api/flights/book`) and `LiteAPI bookRate` (`book.liteapi.travel`,
  `src/lib/liteapiClient.ts:705`). Both live in **lib/routes, not the view
  components** — so a showroom built on pure views + locked callbacks cannot fire
  them. Viator booking is an **external affiliate URL** that must also be locked.
- **No explicit "bookable vs budget-only" flag exists** — it's inferred from
  `vendorApi` in `travelCOA.ts`. The demo needs a **static category map** (MISSING).
- The itinerary calendar is **`TripTimeline`** — props-fed, but **not strictly
  pure** (one inline-edit `PATCH` at `TripTimeline.tsx:341`), so it needs the
  same small pure-view + slot extraction the Operations views got.
- The PR10 guardrail asserts **12** files; any new Travel view + seed must be added.
  `/` stays client-only.

---

## 1. THE TRAVEL BANNER (home page) — EXISTS (live, guest-gated)

- **Module entry:** `MODULES` lists `{ key:'travel', label:'Travel', live:true … }`
  — `ModuleLauncher.tsx:30`.
- **Render:** in `renderBody`, `if (m.key === 'travel') return <CreateTripForm
  onUnauthenticated={gateGuestCreate} showHeader={false} />` — `ModuleLauncher.tsx:107-108`.
- **`CreateTripForm` is a LIVE self-fetcher**, not a locked placeholder:
  - `useEffect` on mount — `CreateTripForm.tsx:78`
  - submit → `fetch('/api/trips', { POST … })` — `CreateTripForm.tsx:102`
  - guest gate: `onUnauthenticated` (`:18`, `:95-96`) → `gateGuestCreate`
    (`ModuleLauncher.tsx:94-99`) opens the register modal for guests; authed users
    POST through.
- **So the banner = the real trip-create form, register-gated.** The showroom adds
  the category scroll + calendar BELOW it; the banner itself is unchanged.

---

## 2. BOOKING SURFACES (the BOOK categories)

### 2a. Flight — EXISTS · SELF-FETCHER · **PAID (Duffel)**
- **Component:** `FlightPicker.tsx:73`.
- **Data access (self-fetcher):**
  - load committed legs — `useEffect FlightPicker.tsx:127` → `fetch('/api/trips/${tripId}/itinerary')` `:130`
  - search — `searchLeg()` → `fetch('/api/flights/search?…')` `:220`
  - commit — `commitLeg()` → `fetch('/api/trips/${tripId}/vendor-commit', POST)` `:282`
  - uncommit — `fetch(... vendor-commit, DELETE)` `:318`
- **Paid provider:** search route `/api/flights/search` → `searchFlights()` →
  Duffel `POST https://api.duffel.com/air/offer_requests` (`src/lib/duffel.ts:40`).
  **Real booking** route `/api/flights/book` → `createOrder()` → Duffel
  `POST .../air/orders` (`src/lib/duffel.ts:137`) — **CREATES A REAL ORDER**.
- **Buttons:** "Search" (`:440-443`) fires the paid Duffel search; "Commit to
  Budget" (`:570-573`) writes budget+itinerary via `vendor-commit` (NOT the
  airline order). The real `/air/orders` booking is a **separate route** not wired
  to FlightPicker's commit button today, but it exists and is paid.
- **FLAG:** every search press hits a paid external API; `/air/orders` books real
  flights. Both MUST be locked no-ops in any public demo.

### 2b. Hotel — EXISTS · **PURE VIEW** · provider in lib (LiteAPI)
- **Component:** `HotelPicker.tsx:32` — **no `useEffect`/`fetch`**; `useState` only
  (`:43-51`); selection via `onSelectHotel` callback (`:29`). It is already props-only.
- **Paid provider (in lib, not the component):** `src/lib/liteapiClient.ts` —
  `searchHotelRates()` `POST api.liteapi.travel/v3.0/hotels/rates` `:244` (search),
  `prebookRate()` `:625`, **`bookRate()` `POST book.liteapi.travel/v3.0/rates/book`
  `:705` — REAL BOOKING**.
- **FLAG:** the LiteAPI book call is real money but lives in the lib/route, never
  in `HotelPicker`. Showroom feeds `HotelPicker` demo hotels + locks `onSelectHotel`.

### 2c. Ground Transportation — EXISTS · **PURE VIEW** · **provider MISSING**
- **Component:** `TransferPicker.tsx:47` — **no `useEffect`/`fetch`**; `useState`
  only (`:59-66`). `fetchTransfers()` `:72` is a **stub** that sets
  "Transfer search is not available. Use manual entry below." — **no Mozio (or any)
  provider is integrated.**
- Manual entries persist to `trip_transfer_options` via `/api/trips/[id]/transfers`;
  commit via `vendor-commit` (`route.ts:247-259`).
- **Lowest risk** of the four: no paid API even exists to leak.

### 2d. Activities — EXISTS · SELF-FETCHERS · Viator (affiliate booking)
- **Components:**
  - `ActivityDestinationSelector.tsx:167` — `useEffect :175` →
    `fetch('/api/destinations?activity=…')` `:182`.
  - `ActivityExpenses.tsx:76` — `useEffect :93` → `fetch('/api/trips/${tripId}/activities')`
    `:105`; POST `:122`; PATCH `:140`; DELETE `:150`.
- **Provider:** `src/lib/viatorClient.ts` — `searchV2Freetext()`
  `POST api.viator.com/partner/search/freetext` `:296`, `searchV2Products()` `:262`,
  `loadDestinations()` `:84` (all **search-only**).
- **Booking = external Viator AFFILIATE URL** (`buildAffiliateUrl(productCode)`,
  `viatorClient.ts`), opened in the activity card — real purchase happens on
  viator.com, not in-app. Commit (budget/itinerary) via `vendor-commit`
  (`route.ts:187-202`).
- **FLAG:** the affiliate link must be locked (don't navigate to viator.com from
  the public demo); the activity mutations (POST/PATCH/DELETE) must be locked.

---

## 3. BUDGETING SURFACES (the BUDGET categories)

- **Trip budget UI:** `src/app/budgets/trips/[id]/page.tsx:98` (`TripDetailPage`,
  SELF-FETCHER). `useEffect :158` fans out 6 loads incl. `loadBudgetItems()` `:246`
  → `fetch('/api/trips/${id}/budget')` `:248`. Committed-budget table `:663-763`.
- **Per-category expense UI:** `ActivityExpenses.tsx:76` (SELF-FETCHER, §2d).
- **Backing models (`prisma/schema.prisma`):**
  - `budget_line_items` `:1035-1060` — PLANNED allocation keyed by `coaCode`,
    `amount`, `source` ('trip'|'manual'|'recurring'), `tripId`, `itineraryId`
    (schema-only, no relation `:1050-1051`). **No separate planned-vs-actual field.**
  - `trip_expenses` `:602-628` — ACTUAL shared spend (category, amount, splits).
  - `trip_activity_expenses` `:1786-1808` — vendor options (proposed/selected/
    committed) with price/per_person/votes.
- **Every category the system budgets** (the "all other categories" set) — defined
  in two registries:
  - `src/lib/travelCategories.ts:13-40` (`TRAVEL_CATEGORIES`, ~16 display cats:
    accommodation, brunch_coffee, dinner, arts_culture, adventure, activities,
    nightlife, festivals, bucket_list, wellness, shopping, coworking, gyms, sports,
    groceries, transport).
  - `src/lib/travelCOA.ts:25-316` (`TRAVEL_COA`, ~21 accounting cats with
    `vendorApi`/`optionType`: flights, accommodation, brunch_coffee, dinner,
    business_meals, activities, adventure, arts_culture, nightlife, festivals,
    conferences, coworking, ground_transport, wellness, shopping, groceries, gyms,
    sports, bucket_list, communication, insurance_fees).

---

## 4. THE TRAVEL CALENDAR / ITINERARY

- **Component:** `TripTimeline.tsx:155` — `export default function TripTimeline({
  tripId, itinerary, startDate, endDate, onUncommit, onChanged })`; data arrives via
  prop `itinerary: TripItineraryRow[]` (`:49`; type `:28`). Parent loads it via
  `/api/trips/[id]/itinerary` (`budgets/trips/[id]/page.tsx:176`, rendered `:645-651`).
- **NOT strictly pure:** the `BlockRow` inline time editor fires one mutation —
  `fetch('/api/trips/${tripId}/itinerary/${row.id}', { method:'PATCH' })`
  `TripTimeline.tsx:341` (user-initiated save). So it self-fetches on edit.
- **`ItineraryAgenda` — MISSING** (only a dangling comment reference in
  `DayCalendarView.tsx`; the file does not exist).
- **Backing models:** `trip_itinerary` `prisma/schema.prisma:645-680` (`day`,
  `homeDate`, `destDate`, `category`, `vendor`, `cost`, `coa_code`, `recurrence`,
  `block_start_time`, `block_end_time`, `vendorOptionId/Type`).
  `budget_line_items.itineraryId` exists but **schema-only, no relation**.
- **Not on the public home page** (grep of `page.tsx` — none). Authed-only.

---

## 5. THE CATEGORY MODEL (bookable vs budget-only)

- **Definitions:** `travelCategories.ts:13-40` (display) + `travelCOA.ts:25-316`
  (accounting, each entry carries `vendorApi` + `optionType`).
- **Explicit bookable flag: MISSING.** There is **no `isBookable` / `bookableOnly`
  field**. The distinction is **inferred from `vendorApi`**:
  - **BOOK+BUDGET (have a vendor API):** `flights` (`vendorApi:'flights'`, Duffel),
    `accommodation` (`'lodging'`, LiteAPI), `ground_transport` (`'vehicles'`),
    `activities` (`'activities'`, Viator).
  - **BUDGET-ONLY (no real booking path):** `communication`, `insurance_fees`
    (no usable vendorApi); `shopping`, `groceries`, `gyms`, `sports` (Google-Places
    scan only, no booking); `conferences` (explicitly excluded —
    `travelCOA.ts:378` "skip conferences — no bookable integration yet";
    `getActiveScanCategories()` `:363-391`).
- **Implication for the demo:** the showroom's "Flight/Hotel/Ground/Activities =
  BOOK+BUDGET, all others = BUDGET-ONLY" split has **no single source of truth in
  code** — the demo must ship a **static category list** that names the four
  bookable cards + the budget-only set (a small seed constant, MISSING today).

---

## 6. SAFETY POSTURE TO PRESERVE / EXTEND

- **Guardrail (`scripts/assert-showroom-fetch-free.mjs`) asserts 12 files**
  (`SUBTREE_FILES` `:30-45`): `OperationsPipelineShowroom`, the 5 projects views +
  `ProjectsPipelineShowroom`/`demoData`/`narrativeCopy`, and
  `content/{DayCalendarView,ScriptGeneratorView,showroom/demoData}`. Any new Travel
  showroom view (e.g. `FlightPickerView`/`HotelPicker`/`TransferPicker`/an activity
  view/a `TripTimelineView`) + its seed **must be appended** to this list, and the
  forbidden-container-import regex (`:49-53`) extended with the Travel container
  names (FlightPicker/ActivityExpenses/ActivityDestinationSelector/TripTimeline).
- **`/` is client-only, no SSR data:** `page.tsx:1` `'use client'`; grep for
  `getCurrentUser|prisma|cookies(|generateMetadata|fetch(` → none. Must stay so.

---

## RISKS — per bookable surface: pure or self-fetching, paid API, smallest safe path

**Flight (`FlightPicker.tsx:73`)**
- **Self-fetching + PAID Duffel.** Search hits `api.duffel.com/air/offer_requests`
  (`duffel.ts:40`); the real order is `…/air/orders` (`duffel.ts:137`).
- **Smallest safe path:** extract a pure `FlightPickerView` (search results +
  "Search"/"Commit" as callback props); container keeps the `/api/flights/search`
  + `vendor-commit` fetches. Showroom feeds demo offers; **Search/Commit →
  `onRequireAuth`** (never reach Duffel). The `/api/flights/book` order route is
  not imported by the view, so it stays unreachable.

**Hotel (`HotelPicker.tsx:32`)**
- **Already a pure view** (no fetch). The LiteAPI book (`bookRate`,
  `book.liteapi.travel`, `liteapiClient.ts:705`) is in lib, not the component.
- **Smallest safe path (lowest effort):** feed `HotelPicker` demo hotels and lock
  `onSelectHotel` → `onRequireAuth`. No extraction needed beyond ensuring the
  showroom never imports the parent/route that calls LiteAPI.

**Ground Transportation (`TransferPicker.tsx:47`)**
- **Pure view, no provider at all** (search is a stub `:72`). Lowest risk — no paid
  API exists to leak.
- **Smallest safe path:** feed demo transfer options, lock `onSelect…` → `onRequireAuth`.

**Activities (`ActivityExpenses.tsx:76` + `ActivityDestinationSelector.tsx:167`)**
- **Self-fetchers** (destinations + activities load; POST/PATCH/DELETE mutations).
  Viator search is in lib; booking is an **external affiliate URL**.
- **Smallest safe path:** extract pure views (data + mutations as callbacks);
  container owns the fetches. Showroom feeds demo activities; **all mutations AND
  the affiliate link → `onRequireAuth`** (do not navigate to viator.com).

**Cross-cutting**
- The two real-money calls (Duffel `/air/orders`, LiteAPI `bookRate`) live in
  `src/lib`, reachable only through their routes — a showroom of **pure views +
  locked callbacks** that imports neither the containers nor the routes cannot fire
  them. The Layer-2 `guardShowroomRender` wrapper + the extended Layer-1 guardrail
  give build-time and runtime backstops.
- The itinerary calendar needs the same treatment as the Operations `DayCalendar`:
  a pure `TripTimelineView` (the `PATCH` at `:341` lifted to a callback), fed demo
  `trip_itinerary` rows.

---

## REUSABLE assets (already built, directly applicable)

- **Pure-view + slot/render-prop pattern** (PR5–PR7b) and the **`makeLockedHandlers`
  one-`lock`-covers-all** approach (`ProjectsPipelineShowroom`) — the exact template
  for `FlightPickerView` / activity views / `TripTimelineView`.
- **`onRequireAuth`** — already threaded `page.tsx:74 → ModuleLauncher → showroom`;
  the Travel card reuses it verbatim.
- **`HotelPicker` / `TransferPicker` are already pure views** — usable as-is with
  demo props + locked callbacks (no extraction).
- **`TripTimeline` is nearly pure** — one `PATCH` to lift; otherwise props-fed.
- **Category metadata** (`travelCategories.ts` / `travelCOA.ts` — labels, COA codes,
  calendar colors, `vendorApi`) — source for the demo's static book-vs-budget map.
- **Guardrail + `renderGuard`** (PR10) — extend the file list + container regex; no
  new mechanism needed.
- **Demo-seed + narrative-copy module pattern** (`showroom/demoData.ts`,
  `narrativeCopy.ts`) — same structure for a Travel seed (demo flights/hotels/
  transfers/activities + a demo `trip_itinerary`).

---

## STATUS SUMMARY

| Surface | State | Pure? | Paid/booking | Home today |
|---|---|---|---|---|
| Travel banner (`CreateTripForm`) | EXISTS (live, gated) | self-fetcher | POST /api/trips (own data) | **mounted** `ModuleLauncher:108` |
| Flight (`FlightPicker`) | EXISTS | self-fetcher | **Duffel search + /air/orders** | no |
| Hotel (`HotelPicker`) | EXISTS | **pure view** | LiteAPI book (in lib) | no |
| Ground (`TransferPicker`) | EXISTS | **pure view** | **none (stub)** | no |
| Activities (`ActivityExpenses`/`…Selector`) | EXISTS | self-fetchers | Viator (affiliate link) | no |
| Budget (`TripDetailPage`, `ActivityExpenses`) | EXISTS | self-fetchers | — (`budget_line_items`) | no |
| Itinerary (`TripTimeline`) | EXISTS | **near-pure** (1 PATCH) | — (`trip_itinerary`) | no |
| `ItineraryAgenda` | MISSING | — | — | — |
| Bookable-vs-budget-only flag | MISSING | — | — | — |
| Travel showroom view + seed | MISSING | — | — | — |
