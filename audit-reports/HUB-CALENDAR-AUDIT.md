# HUB CALENDAR AUDIT — unified scheduler on the home page

**Scope:** a unified scheduler between "Create a trip" and "Search real flights" on
the home page: (a) an all-trips queue like `/budgets/trips`, and (b) a calendar like
the per-trip view, capturing rows with: **Start Date | Start Time | End Date | End
Time | Cadence | Category (COA) | Project-or-Routine (Operations) | Description
(tasks/routine-steps) | Entity | Billable**. Map EXISTS vs MISSING. **Read-only. No
source modified.** Cite `file:line`.

Branch: `claude/audit-hub-calendar` · main @ `c2d21ac4`.

---

## TL;DR — most of this already exists; the gap is a unifying row model + the gated home embed

There is **already a full Hub** (`src/app/hub/page.tsx`) with a reusable month grid
(`CalendarGrid`), authed `/api/hub/*` routes, and operations models that carry almost
every column. The genuinely **MISSING** pieces are: a single **unifying
scheduled-row model** covering all 10 columns, a **`billable` boolean** (none
exists), a **cadence enum** (today it's an RRULE string), and the **home-page widget
itself** (gated, since it shows personal data among public travel widgets).

---

## 1. THE TRIPS QUEUE (`/budgets/trips`)

- **Page:** `src/app/budgets/trips/page.tsx` (client). It's an HTML `<table>` (header
  `:133-144`, rows `:146-198`). Each row: name (`:149-151`), destination (`:152`),
  activity pill (`:153-160`), dates (`:161-165`), days (`:166`), crew avatars
  (`:167-183`), status `Committed/Planning` from `committedAt` (`:184-190`), delete
  (`:191-196`). **No entity or $ column** is rendered (`_count.budget_line_items` is
  fetched but unused).
- **Fetch:** client `fetch('/api/trips')` (`page.tsx:68`, in `loadTrips` `:66-83`) →
  `GET /api/trips` (`api/trips/route.ts:7-53`), `getVerifiedEmail()` authed (`:9`),
  `prisma.trips.findMany({ where:{userId}, include:{participants,_count} })`
  (`:24-46`).
- **Reusability:** **inlined + coupled to `/budgets`** — the table markup, sort, and
  delete live in `TripsPage` (`:121-203`); no extracted queue component; nav is
  hardcoded to `/budgets/trips/${id}` (`:147`). → would need extraction (or a fresh
  rows table) for the home page.

## 2. THE TRIP "CALENDAR" (`/budgets/trips/[id]`) — actually a day-timeline; the real month grid is `CalendarGrid`

- The per-trip detail page renders a **day TIMELINE, not a month grid**:
  `<TripTimeline>` → `TripTimelineView` (`[id]/page.tsx:645-652`). A prior month grid
  was explicitly removed (`[id]/page.tsx:399`: "CalendarGrid event transform
  removed").
- **`TripTimelineView`** (`src/components/trips/TripTimelineView.tsx`) is a **pure,
  props-only, network-free** vertical day list (`:4-11`, render `:247-302`), consuming
  `TripItineraryRow` (`:17-34`: day/homeDate/destDate/category/vendor/cost/
  recurrence/block_start_time/block_end_time/coa_code/note). **Reusable** for a
  list/agenda view; the `TripTimeline` container is trip-coupled (PATCH URL `:38`).
- **The reusable MONTH GRID is `src/components/shared/CalendarGrid.tsx`** — the
  macOS-style 7-col grid already used by **`/hub`** (`hub/page.tsx:440-449` with
  `HUB_GRID_CONFIG`) and `/trading` (`trading/page.tsx:837`). **This is the visual
  format the Hub Calendar should reuse** (not the trip timeline). (`TripMonthCalendar.tsx`
  is a second month grid but is **dead code** — no call site.)

## 3. THE ROW DATA — what backs each column (schema.prisma)

| Column | Backing | Verdict |
|---|---|---|
| **Start/End Date + Time** | `operations_routines.start_date/end_date @db.Date` (`:2867-2868`) + `start_time/end_time @db.Time` (`:2869-2870`); `operations_calendar_blocks.scheduled_start/end @db.Timestamptz` (`:2799-2800`) | **EXISTS** |
| **Cadence** (daily/weekly/monthly/one-time) | `operations_routines.schedule_rrule String` (`:2858`) — cadence as an **RRULE string**, NOT an enum. Closest enum `RefreshCadence` (`:1939`) is regulatory-only. `home_expenses.cadence`/`module_expenses.cadence` are free-text strings (`:1358`,`:1377`). | **enum MISSING** (RRULE exists) |
| **Category (COA)** | `chart_of_accounts` (`:147`); referenced either by **UUID FK** (`ledger_entries.account_id :215` → relation `:222`) or **loose `coa_code` string** (operations: `:2746`; `calendar_events.coa_code :1341`) | **EXISTS** |
| **Project-or-Routine (Operations)** | `operations_projects` (`:2688`); `operations_routines` (`:2852`); task→project FK `operations_project_tasks.project_id` (`:2756`) | **EXISTS** |
| **Description (tasks/routine-steps)** | `operations_project_tasks` (`:2728`: `title :2733`, `description :2734`); `operations_routine_steps` (`:2887`: `activity :2894`, FK `routine_id :2908`) | **EXISTS** |
| **Entity** (business/personal/trading) | `entities` (`:66`, `entity_type String` `:70`); the 3 values enforced by CHECK `('personal','business','trading')` in `prisma/add-trading-entity.sql:6`. Carried as **FK** (`transactions.entity_id :392`→`:394`) or **plain string** (operations: `operations_routines.entity_id :2855`, no FK) | **EXISTS** (string-typed, not a Prisma enum) |
| **Billable** | grep `billable` across schema → **zero matches** | **MISSING** |

## 4. IS THERE A UNIFYING HUB/CALENDAR/EVENT MODEL? — PARTIAL

- **`calendar_events`** (`:1324`) is the closest single row: `start_date/end_date`
  (date-only, `:1334-1335`), `is_recurring`+`recurrence_rule` (`:1336-1337`),
  `category` (`:1331`), `coa_code` (`:1341`), `description` (`:1330`), `status`/
  `budget_amount`. **Missing for this spec:** start/end **time-of-day**, `entity_id`,
  project/routine link, `billable`.
- **`operations_calendar_blocks`** (`:2794`) has full start/end **timestamps** +
  `entity_id` + a task link (via `daily_plan_item_id`), but lacks `cadence`,
  `category`/`coa_code`, and `billable`.
- **Verdict:** **no drop-in model for all 10 columns.** Either a **new unifying
  model** (referencing routine/project/task/COA/entity) or an **extension** of
  `operations_routines` (richest: it already has date+time+rrule+entity) + new
  columns (`billable`, `coa_code`/`category`, a project/task link, a cadence enum if
  wanted).

### Existing Hub surface to REUSE (substantial)
- Page: `src/app/hub/page.tsx` (`HubPage`, **account-gated** via `useSession` `:105`;
  `/hub` is a *protected* path, not in `PUBLIC_PATHS`).
- Grid: `src/components/shared/CalendarGrid.tsx` (the month grid, `hub/page.tsx:440`).
- Components: `src/components/hub/*` (`HubEventCard`, `TripExpensesCard`,
  `UnscheduledTaskTable`, `BudgetDrillDown`).
- Mappers: `src/lib/hub/mapOperationsBlocks.ts`, `mapOperationsRoutines.ts`.
- Authed routes: `src/app/api/hub/{trips,operations-routines,year-calendar,
  nomad-budget,business-budget}` — all `getVerifiedEmail()`-gated (e.g.
  `api/hub/trips/route.ts:7-11`), and NOT in `PUBLIC_PATHS` (double-gated).

## 5. HOME PAGE PLACEMENT + AUTH BOUNDARY

- **Home page** `src/app/page.tsx` (client, `:1`) is **public** (`/` is `PUBLIC_PATHS[0]`,
  `middleware.ts:51`) — a marketing shell + login modal; it does NOT compute auth.
- **`ModuleLauncher`** does the auth detection: `authed` state from `fetch('/api/auth/me')`
  (`:52`, `:58-71`); `gateGuestCreate` opens the register modal when `authed===false`
  (`:99-106`).
- **Mount point:** between the Create-a-trip card body (`<div className="bg-white p-4">
  {renderBody(m)}</div>`, `:180-182`/close `:183`) and `PublicFlightSearch`
  (`:189`) — a new `{m.key==='travel' && <HubCalendar />}` slots at **~`:188`**.
- **AUTH BOUNDARY (flag):** `/` is public, but the Hub Calendar shows **personal
  data** → it must (a) **gate on `authed`** (render the calendar only when logged in;
  show a "log in to see your schedule" prompt otherwise), and (b) fetch **only from
  authed `/api/hub/*` routes** (already 401-gated + outside `PUBLIC_PATHS`). Care:
  it sits among public travel widgets — a guest must NOT see personal rows, and the
  authed fetch must tolerate 401 gracefully (no redirect loop on the public page).

---

## REPORT — EXISTS | MISSING | THE PLAN

### EXISTS (reuse)
- **Month grid:** `CalendarGrid` (`shared/CalendarGrid.tsx`, already on `/hub`).
- **List/agenda:** `TripTimelineView` (pure) for a per-day list, or the `/budgets/trips`
  table pattern for the queue.
- **Hub data layer:** `/api/hub/*` authed routes + `src/lib/hub/*` mappers + `src/components/hub/*`.
- **Models:** `operations_routines` (date+time+rrule+entity), `operations_calendar_blocks`,
  `operations_projects`/`_project_tasks`/`_routine_steps`, `chart_of_accounts`,
  `entities`, `trips`/`/api/trips`.
- **Auth gate pattern:** `ModuleLauncher`'s `authed` + `gateGuestCreate`.

### MISSING
- A **unifying scheduled-row model** spanning all 10 columns (new model OR an
  `operations_routines` extension).
- **`billable` boolean** (nowhere in schema).
- A **cadence enum** (`daily|weekly|monthly|one_time`) if an enum is wanted — today
  it's an RRULE string.
- A **COA/category column** + a **project/routine/task FK** on whatever row model is
  chosen (operations rows use a loose `coa_code` string, no project↔routine unifier).
- A **home-page Hub Calendar widget** (gated) + an extracted/queue component.
- Possibly a **feed route** if the existing `/api/hub/*` don't already return all 10
  columns for the grid + queue.

### THE PLAN — honest, staged (multi-PR; schema first)

1. **PR-HC1 — schema migration (psql-before-merge).** Either (a) add columns to
   `operations_routines` (`billable Boolean`, a `cadence` enum or keep `schedule_rrule`,
   a `coa_code`/`category`, an optional `project_id`/`task_id` link), OR (b) a new
   `hub_scheduled_items` model referencing routine/project/task/COA/entity. Add the
   **`billable`** boolean + the **cadence enum** here. Deliver schema.prisma + raw SQL
   for Alex. **Every change is a migration (psql before merge).**
2. **PR-HC2 — authed feed route.** `GET /api/hub/calendar` (authed, NOT public)
   returning the rows (joined COA code, entity name, project/routine/task labels) for
   both the grid and the queue. Reuse `src/lib/hub/*` mappers. 401 for guests.
3. **PR-HC3 — the Hub Calendar widget (gated), reusing `CalendarGrid`.** A client
   component mounted at `ModuleLauncher:~188` that: reads `authed`; if logged out →
   a "log in to see your schedule" card (→ `onRequireAuth`); if logged in → the
   `CalendarGrid` month view + the all-trips/queue list, fed by PR-HC2. No personal
   data for guests.
4. **PR-HC4 — the row columns / editor.** The 10-column row create/edit (COA picker
   by code/UUID, ops project/routine + task/routine-step pickers, entity select from
   `entities`, billable toggle, cadence). Writes via an authed route.
5. **PR-HC5 — polish:** recurrence expansion (RRULE → calendar instances), the queue
   extraction from `/budgets/trips`, cross-links (calendar row ↔ COA/ops/entity).

### Flags
- **Auth boundary** (repeat): personal data on a public page → gate on `authed` +
  authed `/api/hub/*` fetches only; a guest must see a prompt, never rows.
- **Schema migrations** (PR-HC1, possibly HC4): `billable`, cadence enum, the
  unifying model/columns — **psql before merge** (Alex's rule).
- **Decision needed:** new unifying model vs extend `operations_routines`; and cadence
  **enum vs RRULE string** (the codebase currently uses RRULE — an enum is simpler for
  the 4 fixed options but diverges from the existing routine model).
- **Honest size:** this is a **multi-PR feature** (a migration + a feed route + a gated
  widget + the column editor), not a single drop-in — but it reuses a lot (`CalendarGrid`,
  the hub routes/mappers, the operations + COA + entity models). No code modified in
  this audit.
