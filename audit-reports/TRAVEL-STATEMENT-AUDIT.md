# TRAVEL-STATEMENT AUDIT — data landscape for the big Travel build

**Type:** Audit — READ ONLY. Nothing modified.
**Scope:** (A) retire `/hub`, make home the hub; (B) an "All Trips" list under Travel;
(C) a "Committed Budget" section; (D) the combined statement+itinerary table
(Date in/Time in/Date out/Time out/Category(COA)/Vendor/Description/Budget/Actual/
Cadence/Daily, where Daily = amount ÷ days-used).

Citations are `file:line` / `prisma/schema.prisma` lines. **Headline: most of (D)
already exists in the trip itinerary data, and the "Daily" amortization math is
already written.** The big lift is (A) the `/hub` cutover.

---

## TL;DR readiness

- **Combined table (D): ~9 of 11 columns are READY** from `trip_itinerary` (+
  `budget_line_items`, `reservations`). **Daily is DERIVED and already coded**
  (`TripTimelineView.tsx:117-147`). **Cadence** is PARTIAL (only `once`/`daily`).
  **Actual** is PARTIAL (real bookings only).
- **All Trips list (B): READY** — `GET /api/trips` lists trips; the home Create-trip
  form already gates logged-out → login and POSTs when authed. One seam to change
  (it navigates away on create instead of refreshing a list).
- **/hub retirement (A): the big one** — home today has ONLY the calendar;
  `/hub` also has 5 budget loaders + ~6 budget UI sections + trip-expenses + the
  unscheduled-task table, and is the **default post-login redirect**. Cutover =
  migrate that chrome (or drop it) + repoint ~10 links.

---

## 1. /hub RETIREMENT — what cutover means

**What `/hub` does that home does NOT** (`src/app/hub/page.tsx`, 917 lines):
- **Calendar (home HAS this):** `loadCalendar` (`:192`), `loadOperationsBlocks`
  (`:219`), `loadOperationsRoutines` (`:271`) → `CalendarGrid` (`:440`). Home's
  `HubCalendar.tsx` is a verbatim extract of these.
- **Budget chrome (home does NOT have):**
  - `loadCommittedTrips` → `/api/hub/trips` (`:296`)
  - `loadYearCalendar` → `/api/hub/year-calendar` (homebase budget) (`:303`)
  - `loadNomadBudget` → `/api/hub/nomad-budget` (travel budget) (`:319`)
  - `loadBusinessBudget` → `/api/hub/business-budget` (`:335`)
  - `loadUnscheduledTasks` → `/api/operations/tasks/unscheduled` (`:246`)
  - UI: `TripExpensesCard` (`:483`), budget summary card (`:486-513`), the Wall-St
    budget comparison table (`:590-663`), Homebase/Travel/Business operating-expense
    tables (`:676-739`, `:752-815`, `:829-898`), `BudgetDrillDown` modal (`:908`),
    `UnscheduledTaskTable` (`:465`).
- **Auth:** `/hub` is gated by **middleware** (not in `PUBLIC_PATHS`,
  `middleware.ts:50-104` → unauthenticated redirect to `/`); the page reads
  `useSession()` only for the banner name (no in-page guard).

**Links/redirects pointing at `/hub` (cutover must repoint these):**
- Sidebar logo + Hub nav item — `src/components/ui/Sidebar.tsx:96`, `:71`.
- **Default post-login redirect** — `src/app/page.tsx:11` (`loginRedirect='/hub'`);
  `src/components/LoginBox.tsx:14` (`redirectTo='/hub'`, used `:44`, `:59`);
  `src/app/login/page.tsx:28` (`window.location.href='/hub'`).
- Pricing "Get Started Free" (logged-in) — `src/app/pricing/page.tsx:118`.
- `/hub/itinerary` back-links + CTAs — `src/app/hub/itinerary/page.tsx:89,112,143`.
- Middleware comment lists `/hub` as protected — `middleware.ts:47`.

**Cutover verdict:** home does **not** yet cover the budget tables, trip-expenses,
or unscheduled-tasks. Full `/hub` retirement requires **migrating that chrome to home
(or consciously dropping it)** AND repointing the ~10 links + the post-login redirect.
This is the largest, most dependency-heavy step — do it carefully (or keep `/hub`
reachable until home reaches parity).

---

## 2. ALL TRIPS LIST (under Travel)

- **List source:** `GET /api/trips` (`src/app/api/trips/route.ts:24-46`) returns each
  trip with `id, name, destination, activity, activities, month, year, daysTravel,
  daysRiding, status, startDate, endDate, committedAt, latitude, longitude,
  destinationPhoto, tripType, participants[], _count{expenses, budget_line_items,
  itinerary}`. Model `trips` (`schema.prisma:515-563`): note `status`
  (`"planning"`→`"committed"`, `:530`), `startDate/endDate/committedAt` (`:535-537`),
  `entity_id` (`:545`, schema-only/unused), `tripType` (`:541`).
- **Create-trip gating (already built):** the home Travel section renders
  `CreateTripForm` with `onUnauthenticated={gateGuestCreate}`
  (`ModuleLauncher.tsx` renderBody travel). `CreateTripForm`
  (`src/components/trips/CreateTripForm.tsx`): if `onUnauthenticated` is set it runs
  first and **returns `true` ("handled — don't POST")** for guests, opening the
  register modal (`:93-97`); authed → `POST /api/trips` (`:102-103`) then
  `router.push('/budgets/trips/${newId}')` (`:117`). `gateGuestCreate`
  (`ModuleLauncher.tsx:101-108`) calls `onRequireAuth()` when `authed === false`.
  → **logged-out = login prompt; logged-in = real create. CONFIRMED.**
- **Seam for "adds an All Trips row":** today the form **navigates away** to
  `/budgets/trips/[id]` on success (`CreateTripForm.tsx:117`). To add a row in place,
  add an optional `onCreated(trip)` callback the list can subscribe to (and skip the
  push when it's provided) — a small prop addition, no logic rewrite.
- **Where it mounts:** under the Travel section in `ModuleLauncher.tsx` (same place
  the Create-trip card + live searches render), as a new `<AllTripsList>` client
  component that fetches `/api/trips` and re-fetches on `onCreated`.

---

## 3. CLICK A TRIP → POPULATE THE FIELDS BELOW

- **Single trip:** `GET /api/trips/[id]` (`src/app/api/trips/[id]/route.ts:27-52`)
  returns the trip + `participants` (with splits) + `expenses` + **`itinerary`**
  (ordered by day).
- **Itinerary timeline:** `GET /api/trips/[id]/itinerary`
  (`src/app/api/trips/[id]/itinerary/route.ts:17-20`) returns `trip_itinerary` rows
  ordered `[day asc, createdAt asc]`. Rendered by `TripTimeline.tsx` /
  `TripTimelineView.tsx` (row interface `TripTimelineView.tsx:17-34`).
- **The tables that feed the detail, and their trip link:**
  - `trip_itinerary` (`schema.prisma:645-680`) — `tripId` FK; the itinerary lines.
  - `budget_line_items` (`:1035-1060`) — `tripId` FK (+ `itineraryId` 1:1 link); the
    committed budget lines.
  - `reservations` (`:1153-1180`) — `tripId` FK; real confirmed bookings.
  - `trip_expenses` (`:602-628`) — `tripId` FK; logged actual spend.
  - `trip_destinations` (`:711-727`) — `tripId` FK; destinations + `estimatedTotal`.
  - `calendar_events` (`:1324-1350`) — `source='trip'`, `source_id=tripId` (no FK;
    the calendar mirror). 

So selecting a trip = fetch `/api/trips/[id]` (+ `/itinerary`) and populate the
table/budget below from `trip_itinerary` joined to `budget_line_items`/`reservations`.

---

## 4. THE COMBINED STATEMENT+ITINERARY TABLE (column sources)

Primary source = **`trip_itinerary`** (`schema.prisma:645-680`), which already carries
times, costs, vendor, COA, and a recurrence flag.

| Column | Source (cite) | Status |
|---|---|---|
| **Date in** | `trip_itinerary.homeDate` (`:649`) | READY |
| **Time in** | `trip_itinerary.homeTime` (`:650`) or `block_start_time` (`:677`) | READY |
| **Date out** | `trip_itinerary.destDate` (`:651`) | READY |
| **Time out** | `trip_itinerary.destTime` (`:652`) or `block_end_time` (`:678`) | READY |
| **Category (COA)** | `trip_itinerary.coa_code` (`:679`) + `budget_line_items.coaCode` (`:1040`) | READY |
| **Vendor** | `trip_itinerary.vendor_name ?? vendor` (`:680`,`:654`); cleanly stored — not just the `source_id` "vendor:" tag | READY |
| **Description** | `trip_itinerary.vendor`/`note` (`:654`,`:656`) | READY |
| **Budget** (planned) | `trip_itinerary.cost` (`:655`) or `budget_line_items.amount` (`:1043`) | READY |
| **Actual** (committed/real) | `reservations.finalPriceCents` (`:1170`) / `trip_expenses.amount` (`:611`) | PARTIAL — only booked stays / logged expenses have a real actual; a manual itinerary line has no separate actual column |
| **Cadence** | `trip_itinerary.recurrence` (`once`/`daily`, `:674`) | PARTIAL — only once/daily; no weekly/monthly. Richer cadence would reuse the `ScheduleCadence` enum (`schema.prisma:2929`) or a new field |
| **Daily** | **DERIVED** = `cost ÷ coveredDays(homeDate, destDate)` | READY — logic already written (§6) |

**Readiness split:** 9 READY · `Actual` PARTIAL · `Cadence` PARTIAL · `Daily` DERIVED.

---

## 5. COMMITTED BUDGET SECTION

- **What "committed" means:** `trips.status = 'committed'` + `committedAt` set
  (`schema.prisma:530,537`); the commit routes write the budget at that point:
  - `POST /api/trips/[id]/commit` writes `budget_line_items` with `source:'trip'`
    (`commit/route.ts:112-123`) + `calendar_events source='trip'` (`:187-188`).
  - `POST /api/trips/[id]/vendor-commit` writes one `budget_line_items` per committed
    vendor option, linked 1:1 via `itineraryId` (`vendor-commit/route.ts:228-239`).
- **The committed-trips feed already exists:** `GET /api/hub/trips` returns trips
  `where status='committed'` with a summed budget (`hub/trips/route.ts:21-40`) — the
  same source `/hub`'s `TripExpensesCard` uses.
- **So the Committed Budget section = sum of `budget_line_items` (source='trip') for
  the trip** (planned-committed), with **real actuals from `reservations.finalPriceCents`**
  where a booking exists. Both are present; the only gap is a per-line "actual" for
  non-booked itinerary lines (§4 Actual).

---

## 6. DAILY AMORTIZATION INPUTS (the truth math) — ALREADY BUILT

The exact "amount ÷ days-used" the brief describes is **already implemented** in
`src/components/trips/TripTimelineView.tsx`:
- `coveredDays(homeIso, destIso)` = `max(1, round((dest − home)/86_400_000) + 1)`
  (`:117-120`) — the nights/days span from the line's own start/end dates.
- For a `recurrence==='daily'` line: `share = total / days` (`:144-145`), unit =
  `'night'` for lodging else `'day'` (`:146`), label `"$<share>/<unit> · part of
  <total> total"` (`:147`). → hotel $1500 over 30 nights = $50/night; a `once` line =
  full amount on its day (`:150`, `daySpendShare: total`). **This is the brief's Daily
  column, verbatim.**

**Inputs per line type, confirmed present:**
- **Lodging:** total = `trip_itinerary.cost` (`:655`); nights = `coveredDays(homeDate,
  destDate)` from `homeDate`/`destDate` (`:649,:651`). For *real bookings*,
  `reservations.checkinDate`/`checkoutDate` (`:1166-1167`) give nights directly.
  → daily = total ÷ nights. ✅
- **Per-day expense (meal):** one date + `cost` (a `recurrence='once'` line) → daily =
  amount. ✅
- **Missing:** nothing for the math — nights/days are derived, not stored (fine). The
  only stored gaps are richer **cadence** and a per-line **actual** (§4).

---

## REPORT: EXISTS | MISSING | STAGED PLAN

### Column readiness (the combined statement)
Ready: Date in, Time in, Date out, Time out, Category(COA), Vendor, Description,
Budget, **Daily (derived, code exists)**. Needs-work: **Actual** (only booked/logged
lines have a real actual), **Cadence** (only once/daily today).

### New fields / migrations to flag
- **Cadence** beyond once/daily → either a new `trip_itinerary.cadence` column or
  reuse `ScheduleCadence` (`schema.prisma:2929`). MISSING for weekly/monthly.
- **Per-line Actual** → no actual column on `trip_itinerary`; actuals live in
  `reservations`/`trip_expenses`. Decide: join those, or add an `actual` field. PARTIAL.
- `trips.entity_id` / `budget_line_items.entity_id` exist but are **unused**
  (`:545`,`:1052`) — available if Travel wants entity binding later.
- nights/days: **derived**, no migration needed.

### Staged sequence (by dependency)
1. **All Trips list + create-gating (B)** — lowest risk, mostly built: mount
   `<AllTripsList>` (GET `/api/trips`) under Travel; add `onCreated` to
   `CreateTripForm` so create refreshes the list instead of navigating. Gating is
   already correct.
2. **Click → populate (C)** — wire selection to `GET /api/trips/[id]` (+ `/itinerary`)
   and render the detail below. Depends on (1).
3. **Combined table (D)** — build from `trip_itinerary` (+ `budget_line_items` /
   `reservations`); 9 columns ready. Depends on (2).
4. **Daily-burn (D)** — reuse `coveredDays`/`share` from `TripTimelineView.tsx:117-147`.
   Trivial once (3) exists.
5. **Committed Budget section (C)** — sum `budget_line_items` (source='trip') +
   `reservations` actuals. Depends on (2); can land with (3).
6. **/hub retirement (A)** — LAST. It's the heaviest: migrate the budget chrome (5
   loaders + ~6 sections + drill-down + trip-expenses + unscheduled tasks) to home or
   drop it, then repoint ~10 links + the post-login redirect. Don't block (1)–(5) on it.
   Cadence/Actual migrations (above) can slot in alongside (3)/(5).

### Auth boundary
All Trips = personal, **account-gated**: `/api/trips` requires a verified session;
the home Create-trip form already prompts login for guests (`gateGuestCreate` →
`onRequireAuth`, `ModuleLauncher.tsx:101-108`) and only POSTs when authed
(`CreateTripForm.tsx:93-103`). The list + detail + committed budget are all personal
data — keep them behind the same `authed === true` gate the calendar uses; logged-out
shows the login prompt, never personal trip rows.

---

## Citations index
- `/hub`: loaders `src/app/hub/page.tsx:192,219,246,271,296,303,319,335`; UI
  `:440,452,465,483,486-513,590-663,676-739,752-815,829-898,908`; auth
  `middleware.ts:47,50-104`. Links: `Sidebar.tsx:71,96`; `page.tsx:11`;
  `LoginBox.tsx:14,44,59`; `login/page.tsx:28`; `pricing/page.tsx:118`;
  `hub/itinerary/page.tsx:89,112,143`.
- Trips: `api/trips/route.ts:24-46`; `api/trips/[id]/route.ts:27-52`;
  `api/trips/[id]/itinerary/route.ts:17-20`; `api/hub/trips/route.ts:21-40`.
- Create form: `CreateTripForm.tsx:18,93-97,102-103,117`; `ModuleLauncher.tsx:101-108`.
- Schema: `trips:515-563`; `trip_itinerary:645-680`; `budget_line_items:1035-1060`;
  `reservations:1153-1180`; `trip_expenses:602-628`; `trip_destinations:711-727`;
  `calendar_events:1324-1350`; `ScheduleCadence enum:2929`.
- Commit writes: `commit/route.ts:112-123,187-188`; `vendor-commit/route.ts:228-239`.
- Daily math: `TripTimelineView.tsx:117-120,144-147,150`.
