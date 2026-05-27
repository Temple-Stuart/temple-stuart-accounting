# Hub Command-Center Data Audit (read-only) — real data per zone

What REAL queryable data exists for the planned 4-zone Hub command center. No-fake-
data mandate: each zone is REAL / PARTIAL / NET-NEW (schema add) / NOT-WIRED, with
exact source. No edits.

## Summary table

| Zone | Availability | Exact source |
|---|---|---|
| 1 · Compressed full-day calendar | **REAL** (reuse existing) | `operations_daily_plan_items` + `operations_calendar_blocks` + routines, via the Hub's existing loaders |
| 2 · Unscheduled task queue + assign/complete | **REAL** | `/api/operations/tasks/unscheduled` + daily-plan block APIs |
| 2 · Manual per-task time tracking (start/stop/date) | **NET-NEW (schema add)** | nothing stores this; only aggregate `actual_minutes` exists |
| 3 · Travel expenses ordered by itinerary time | **REAL** | `trip_itinerary` (day/homeDate/homeTime) + `budget_line_items` (tripId/coaCode/amount) |
| 3 · Trip expenses ↔ calendar | **REAL** | `calendar_events` rows written `source='trip'` on commit |
| 4 · Budgets (budgeted vs actual) | **REAL** | `budget_line_items` (budget) vs `ledger_entries` (actual), per `/api/hub/*-budget` |
| 4 · Budget ↔ operations wiring | **NOT WIRED** | `coa_code` on tasks is informational; no FK/join, no `source='operations'` |

---

## ZONE 1 — Compressed full-day calendar → **REAL, reuse**

Tables (`prisma/schema.prisma`):
- `operations_daily_plan_items` (`:2638-2660`): `plan_date` (Date), `task_id?`,
  `ad_hoc_title?`, `display_order`.
- `operations_calendar_blocks` (`:2662-2682`): `scheduled_start/end`,
  `actual_start/end`, `status` (enum `scheduled|in_progress|completed|missed|cancelled`).
- `operations_routines` (`:2720-2753`): RRULE + `start_time/end_time` intent window.

Today's-blocks query already exists — Hub loads via
`GET /api/operations/daily-plan/items?from=&to=`
(`src/app/api/operations/daily-plan/items/route.ts:90-108`: `findMany` on
`plan_date` range, includes `calendar_blocks` ordered by `scheduled_start` + the
linked task summary). Routines via `GET /api/hub/operations-routines`
(`mapOperationsRoutines.ts`). Hub orchestrates these in `src/app/hub/page.tsx`
(`loadOperationsBlocks` ~`:218`, `loadOperationsRoutines` ~`:270`).

**Block type/color is derivable**: `SOURCE_CONFIG` in `hub/page.tsx:52-82` maps
`trip` (cyan), `operations` (indigo), `routines` (teal); the source is assigned in
`mapOperationsBlocks.ts:68` (`operations`) / `mapOperationsRoutines.ts:96`
(`routines`) / legacy `calendar_events.source='trip'`. ✅ Reuse the existing data;
"compressed" is a render concern, not a data one.

## ZONE 2 — Unscheduled queue + time tracking

**Queue + assign/complete → REAL.**
- `GET /api/operations/tasks/unscheduled`
  (`src/app/api/operations/tasks/unscheduled/route.ts:32-51`): tasks with
  `status in (open,in_progress,blocked)` and **no** calendar block
  (`daily_plan_items: { none: { calendar_blocks: { some: {} } } }`).
- Assign = create daily-plan item (`POST /api/operations/daily-plan/items`) + block
  (`POST /api/operations/daily-plan/items/[itemId]/blocks`). Complete = `PATCH
  /api/operations/daily-plan/blocks/[blockId]` setting `status='completed'`
  (and/or task `completed_at`). All audited.

**Manual per-task time tracking → NET-NEW (schema add). This is a build, not a display.**
What exists (verified `schema.prisma:2599-2636`): on `operations_project_tasks` —
`estimated_minutes`, **`actual_minutes` (aggregate total, set manually)**,
`estimated_cost_usd`, `actual_cost_usd`, `completed_at`. On
`operations_calendar_blocks` — `actual_start`/`actual_end` (system/PATCH-set
timestamps for a scheduled block).
What does **not** exist (verified — grep for any `time_log`/`time_entr`/`timesheet`
model returns **nothing**): no table or columns to record "user enters start/stop
time + date per task" as discrete log entries. `actual_minutes` is a single
aggregate number, not dated start/stop sessions; `actual_start/end` live on a
*scheduled block*, not on free-form per-task manual logging.
➡️ To support the spec'd manual time tracking, a **new table is required**, e.g.
`operations_task_time_logs(task_id, log_date, started_at, ended_at?,
duration_minutes?)` (+ optional rollup column on the task). Flag this zone's
time-tracking as a schema PR, distinct from the (real) queue display.

## ZONE 3 — Travel expenses by itinerary time → **REAL**

- `trip_itinerary` (`:638-664`): `day` (Int), `homeDate` (DateTime), `homeTime`
  (HH:MM string), `destDate/destTime`, `category`, `vendor`, `cost`,
  `vendorOptionId/Type` → **orderable by `day, homeDate, homeTime`**.
- `budget_line_items` (`:1019-1040`): `tripId`, `coaCode`, `year/month`, `amount`,
  `description`, `source` (`'trip'|'manual'|'recurring'` — note **no
  `'operations'`**). Has an `itineraryId?` column that is **defined but never
  populated/queried** (schema debt — flag).
- Write path: `vendor-commit/route.ts:74-243` atomically creates the
  `budget_line_item` (`:145-156`) + `trip_itinerary` rows (`:158-209`), then a
  `calendar_events` row `source='trip'` (raw SQL `:214-230`). `commit/route.ts`
  does the trip-level equivalent (`:185-196` calendar event, `:220-241` legacy
  `budgets` upsert).
- **Calendar-wired: REAL** — trip rows exist in `calendar_events` with
  `source='trip'`, `coa_code`, `budget_amount`.

Caveats to flag: (a) `budget_line_items`↔`trip_itinerary` has **no FK** — joining
expense→itinerary-time today is by `tripId` + (fragile) description/vendor match,
or via the unused `itineraryId`; a clean "expenses ordered by itinerary time" view
should either populate `itineraryId` or query `trip_itinerary` directly (which has
both the time fields and `cost`). (b) No public `GET /api/trips/[id]/itinerary`
sorted endpoint exists yet — the data is queryable, the endpoint is net-new.

## ZONE 4 — Budgets → **REAL**; Budget↔Operations → **NOT WIRED**

**Budgeted vs actual = REAL.** `/api/hub/nomad-budget/route.ts:34-173` and
`/api/hub/business-budget/route.ts:6-147`: budget side = `budget_line_items` filtered
by `source` ('trip'/'business') aggregated by `coaCode`×month; **actual side =
`ledger_entries` joined to `journal_entries` + `chart_of_accounts`** (the real
double-entry ledger is the source of truth for actuals). Hub renders the comparison
panels from these. The wide `budgets` table (`:483-507`, jan–dec columns) is still
**written** by trip commit but **not read** anywhere — effectively write-only legacy
(flag).

**Budget ↔ operations = NOT WIRED (the known gap, precise state):**
- `operations_project_tasks.coa_code` exists (`:2617`, indexed) and is validated
  against `chart_of_accounts` on write — but it is **informational only**: no FK to
  `budget_line_items`/`budgets`, and **no join anywhere** (verified: grep for any
  `operations_project*`↔`budget_line*` reference returns nothing).
- `budget_line_items.source` has **no `'operations'` value** (verified: nothing
  writes `source:'operations'`), so operations costs never enter the budget panels.
- Operations task cost (`estimated_cost_usd`/`actual_cost_usd`) is tracked on the
  task but **never compared to budget or rolled into** `/api/hub/*-budget`.
- ➡️ Honest "not wired" flag for the Hub: *"Operations project/task costs are not
  connected to budgets — `coa_code` is recorded but there is no budget↔operations
  rollup."* Wiring it (a budget `source='operations'` + a rollup query, or an
  operations-budget endpoint) is net-new.

---

## Build verdict per zone

- **Zone 1 (calendar):** build now on REAL data (reuse the daily-plan/blocks/routines
  loaders; "compressed" = render only).
- **Zone 2 (queue):** queue + assign/complete build now on REAL data. **Time tracking
  needs a schema PR** (new `operations_task_time_logs` table) before it can show real
  data — until then, flag time-tracking as "not wired" or ship it as its own PR.
- **Zone 3 (travel expenses):** build now on REAL data; query `trip_itinerary`
  (has time + cost) ordered by `day/homeDate/homeTime`. Minor: add a sorted endpoint;
  consider populating `itineraryId` to formalize the expense↔itinerary link.
- **Zone 4 (budgets):** budgeted-vs-actual builds now on REAL data
  (`budget_line_items` vs `ledger_entries`). **Budget↔operations is NOT wired** —
  show the honest flag; don't fabricate an operations budget line.

### Net-new flags (the two that drive schema/build decisions)
1. **Per-task manual time tracking = NET-NEW schema.** No `time_log` table; only
   aggregate `actual_minutes` + block `actual_start/end`. Must be built.
2. **Budget↔operations = NOT WIRED.** `coa_code` on tasks is informational; no
   FK/join, no `source='operations'`. Display an honest "not wired" flag or build the
   rollup as a separate PR.

NO edits made.
