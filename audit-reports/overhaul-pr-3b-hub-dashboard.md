# Overhaul-PR-3b — Hub dashboard: 4-zone command center (real data + honest flags)

Adds the 4-zone command center to `/hub` on REAL data, with the two net-new items
honestly flagged. **Scope decision (per Alex): "keep details below zones"** — the
command-center zones go up top; the existing detailed budget tables + drill-down +
trip map are **kept below, untouched**. Nothing real removed; lowest risk.

## Zones → data sources (all reused, cited)

| Zone | What | Source (reused) |
|---|---|---|
| 1 · Compressed full-day calendar | existing `CalendarGrid`, now `defaultView="day"` | `/api/operations/daily-plan/items` + routines, via existing `gridEvents` memo (`hub/page.tsx:378-393`) — **render-only change** (`:442` week→day) |
| 2 · Unscheduled queue + time | existing `UnscheduledTaskTable` | `/api/operations/tasks/unscheduled` (`hub/page.tsx:464-468`) |
| 3 · Travel expenses by itinerary time | **new** `TripExpensesCard` | `/api/hub/trips` (already-loaded `committedTrips`) + existing **auth'd** `/api/trips/[id]/itinerary` |
| 4 · Budget summary + flag | **new** summary card | real totals already computed from `/api/hub/{year-calendar,nomad-budget,business-budget}` |

### Zone 1 — compressed full-day calendar
Reuses the existing calendar data + `CalendarGrid` verbatim; only `defaultView`
changed `"week"→"day"` (`hub/page.tsx:442`) so the hero is the compressed full-day
view. No query/logic forked.

### Zone 2 — unscheduled queue + REAL time (not faked)
- The queue is the existing `UnscheduledTaskTable` (already scrollable,
  `max-h-[640px] overflow-y-auto`, `hub/page.tsx:464`).
- **Real `actual_minutes`**: added `actual_minutes: true` to the existing (already
  user-scoped + auth'd) unscheduled select
  (`src/app/api/operations/tasks/unscheduled/route.ts:44`); added `actual_minutes`
  to the `UnscheduledTask` type and a new **"Time"** column that renders the real
  value via `fmtMinutes` → **"—" when null** (never 0/fake)
  (`UnscheduledTaskTable.tsx`).
- **Honest flag**: a sub-line under the queue — *"Time column shows tracked minutes
  (operations actual_minutes). Detailed start/stop time logging is coming soon."*
  (`hub/page.tsx`, after the queue). Per-session start/stop/date logging is **not
  built** (net-new schema, separate PR).

### Zone 3 — travel expenses ordered by itinerary time
- New `src/components/hub/TripExpensesCard.tsx`. Picks the active/upcoming committed
  trip (earliest whose `endDate`/`startDate` ≥ today) from the already-loaded
  `committedTrips`, then fetches `/api/trips/[id]/itinerary` (the **existing**
  endpoint — auth'd via `getVerifiedEmail`, verifies the trip belongs to the user,
  returns `entries` ordered by `day, createdAt`). Client re-sorts by `(day,
  homeTime)` for time precision and lists vendor/category + `cost` + a total.
- **Uses `trip_itinerary` directly** (it carries `day/homeTime/cost`) — **does NOT
  use the dead `budget_line_items.itineraryId`**. No net-new endpoint added.
- Calendar-linked note in the header tooltip (`calendar_events source='trip'`).
- **Honest empty states**: "No active trip" (none upcoming), "No itinerary items"
  (trip has none), "Loading itinerary…". No fabricated rows.

### Zone 4 — budget summary + honest not-wired flag
- New summary card: per-entity **Budgeted vs Actual** (Homebase / Travel /
  Business) from the real totals already loaded
  (`yearlyHomebaseBudget/Actual`, `yearlyTravelBudget/Actual`,
  `yearlyBusinessBudget/Actual` — sourced from `budget_line_items` vs
  `ledger_entries` via the existing `/api/hub/*` endpoints). **Does NOT touch the
  legacy wide `budgets` table.** Variance color via existing `getWsVarianceText`.
- **Honest flag**: *"⚠ Operations costs aren't connected to budgets yet"* — the real
  not-wired state (`coa_code` on tasks is informational; no FK/join). No fabricated
  connection.
- The existing detailed budget comparison + Homebase/Travel/Business tables +
  `BudgetDrillDown` remain **below, unchanged**.

## No fabricated / silent-empty data (every empty/null state listed)
- Zone 2 time: `actual_minutes` null → **"—"** (not 0).
- Zone 3: no upcoming trip → **"No active trip"**; trip with no items → **"No
  itinerary items"**; `cost` null → **"—"**.
- Zone 4: `fmt()` renders 0/empty totals as **"—"**; ops↔budget shown as an explicit
  **"not wired" flag**, not a faked number.

## Constraints
- REAL DATA ONLY — confirmed above; no invented numbers.
- Reused loaders/endpoints (cited); the one data change is adding an existing real
  column (`actual_minutes`) to an already-auth'd select — no new endpoint, no
  schema change. Net-new read for Zone 3 was **avoided** (the auth'd itinerary
  endpoint already exists).
- Layout + display only: **no** time-logging schema, **no** budget↔ops wiring built
  — both honestly flagged.
- Tokens only (no hex): `bg-brand-purple-wash`, `bg-brand-amber/5`,
  `text-brand-amber`, `border-border`, status text via existing helper — all
  verified emitting in the built CSS.
- No fallback logic.
- `npx tsc --noEmit` → exit 0. ESLint touched files → **0 errors** (16 pre-existing
  warnings in `hub/page.tsx`, unrelated).

## For Alex's eyeball
On `/hub`: Zone 1 now opens on the compressed full-day calendar (toolbar still
switches week/month). Below it: the queue with a new real **Time** column (— where
unlogged) + the "coming soon" note; then a 2-up row — **Trip Expenses** (active
trip's itinerary by time, or "No active trip") and **Budget** summary (per-entity
budgeted/actual) with the amber **"not connected to budgets yet"** flag. All the
prior detailed budget tables + drill-down + trip map remain below, unchanged.

## Not verified
Headless — built the CSS (class emission) + tsc/lint pass, but did not load `/hub`
in a browser. The active-trip selection, itinerary ordering, and real numbers need
a visual pass against live data after deploy.
