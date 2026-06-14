# HUB CALENDAR — RELOCATE + AGGREGATION AUDIT

**Two goals:** (A) scope **relocating** the `/hub` calendar onto the home page (top
of the stack, above "Search real flights", account-gated) while `/hub` stays
untouched; (B) map **how the `/hub` calendar aggregates Trip + Operations + Routines**
today, to decide whether the 12-column master extends that aggregation or needs a
unified table. **Read-only. No source modified.** Cite `file:line`.

Branch: `claude/audit-hub-calendar-relocate` · main @ `c2d21ac4`.

---

## TL;DR

The calendar is **`CalendarGrid`** (self-contained, reusable) fed by a **read-time
merge of THREE sources** built **in the 917-line `/hub` page** (8 fetches), **not** a
self-contained calendar component and **not** one feed route. Trip events are stored
in `calendar_events`; Operations + Routines are merged from their **own module
tables** at render time. The merged event shape is **display-oriented** (dates/times/
budget/title/source) and **lacks Entity, Billable, Actual $, and structured Cadence/
COA**. → **Relocate = extract a small `<HubCalendar>` (the 3-source merge + grid),
gated.** → **12-column master = a NEW unified table** for authored rows, because the
columns it needs (billable, actual-$, structured cadence/entity/COA) **exist nowhere**
to "extend."

---

## 1. THE `/hub` CALENDAR — what to relocate

- **Page:** `src/app/hub/page.tsx` (917 lines, client). It renders the calendar via
  the **reusable** `CalendarGrid` component (`shared/CalendarGrid.tsx`, imported
  `hub/page.tsx:11`) at `:438-449`, with `HUB_GRID_CONFIG` (`:73-103`),
  `defaultView="day"`, `enableHubChrome`, `showBudgetTotals`, `onEventClick`.
- **`CalendarGrid` is self-contained + already shared** — also used by `/trading`
  (`trading/page.tsx`) and both trips views. So **the grid itself drops onto any
  page**; the work is feeding it `events`.
- **The aggregation is COUPLED TO THE PAGE, not the component.** The page owns ~8
  loaders — `loadCalendar` (`:192`), `loadOperationsBlocks` (`:219`),
  `loadUnscheduledTasks` (`:246`), `loadOperationsRoutines` (`:271`),
  `loadCommittedTrips` (`:296`), `loadYearCalendar` (`:303`), `loadNomadBudget`
  (`:319`), `loadBusinessBudget` (`:335`) — and builds the grid's events in the
  `gridEvents` memo (`:379-394`). The surrounding chrome (budget drill-downs,
  `UnscheduledTaskTable`, `TripExpensesCard`, year/nomad/business budgets) also lives
  in the page.
- **Auth:** the page is wrapped in `<AppLayout>` (`:397`,`:915`) and reads
  `useSession()` (`:105`); `/hub` is a **protected** route (not in `PUBLIC_PATHS`).
- **What it needs to render the calendar:** just `gridEvents` (the merged event list)
  + `sourceConfig`. The events come from **three** of the loaders
  (`loadCalendar`/`loadOperationsBlocks`/`loadOperationsRoutines`); the other five
  feed the budget chrome, **not** the calendar grid. → a home embed needs only those
  three fetches + `CalendarGrid`.

## 2. HOW IT AGGREGATES Trip + Operations + Routines (the key finding)

The `gridEvents` memo (`hub/page.tsx:379-394`) concatenates three independently-fetched
sources — a **read-time merge**, no single feed route:

```
gridEvents = [
  ...events.map(...)             // §A calendar_events (trip + budget layers)
  ...mapOperationsBlocks(items)  // §B operations_calendar_blocks
  ...mapOperationsRoutines(win)  // §C operations_routines (pre-expanded)
]
```

- **§A Trip layer — STORED in `calendar_events`.** `loadCalendar` →
  `GET /api/calendar?year=&month=` (`hub/page.tsx:194`), which `getVerifiedEmail`-auth
  reads `calendar_events` and tags totals by `source` incl. `'trip'`
  (`api/calendar/route.ts:7,50-79`). Mapped to a grid event at `hub/page.tsx:380-390`:
  `{ id, source, title, icon, startDate:start_date, endDate:end_date, isRecurring,
  location, budgetAmount:budget_amount }`.
- **§B Operations layer — READ-MERGED from `operations_calendar_blocks`.**
  `loadOperationsBlocks` → `GET /api/operations/daily-plan/items` (`:228`); mapped by
  `mapOperationsBlocks` (`lib/hub/mapOperationsBlocks.ts:67-74`): `{ id:block.id,
  source:OPERATIONS, startDate/endDate/startTime/endTime from the block,
  budgetAmount:cost, details:[coa_code] }` (COA goes into a **details string**, `:55-58`).
- **§C Routines layer — READ-MERGED from `operations_routines`.**
  `loadOperationsRoutines` → `GET /api/hub/operations-routines?from=&to=` (`:278`,
  occurrences **pre-expanded server-side**); mapped by `mapOperationsRoutines`
  (`lib/hub/mapOperationsRoutines.ts:95-101`): `{ id:'routine:…', source:ROUTINES,
  title:routine.name, startDate, startTime:routine.start_time, endTime, isRecurring:true }`.
  The source `routine` carries `routine_id` + `entity_id` (`:44-46`) but these are
  **NOT mapped onto the event**.

**Verdict:** **HYBRID — partly stored, mostly read-merge.** `calendar_events` is a
stored table for trip + home/auto/etc. budget layers; Operations + Routines are merged
at render time from their own module tables. **No single unified table holds all
calendar events.**

## 3. THE 12 COLUMNS vs TODAY'S EVENT SHAPE

Today's grid event (`CalendarGrid.tsx:11-32`): `id, source, title, icon, startDate,
endDate, startTime, endTime, isRecurring, location, budgetAmount, details[], href`.

| Target column | In today's event? | Where / gap |
|---|---|---|
| Start Date | ✅ | `startDate` |
| Start Time | ✅ | `startTime` |
| End Date | ✅ | `endDate` |
| End Time | ✅ | `endTime` |
| Cadence | ⚠️ partial | only `isRecurring` boolean; the actual daily/weekly/monthly value lives in `operations_routines.schedule_rrule` (RRULE), **not on the event** |
| Category (COA) | ⚠️ partial | a **display string** in `details[]` ("B-6210 · $250", `mapOperationsBlocks.ts:55-58`); `source` carries the layer — no structured COA field/FK on the event |
| Project-or-Routine | ⚠️ partial | implied by `source` (operations block → task→project; routine), but **no explicit project/routine link field** on the event |
| Description (task/step) | ⚠️ partial | `title` only; no task/step link |
| Entity | ❌ | routines have `entity_id` at source (`mapOperationsRoutines.ts:46`) but it's **not mapped**; trip/ops layers don't surface it |
| Billable | ❌ | exists **nowhere** (no schema field, no event field) |
| Budget $ | ✅ | `budgetAmount` (planned) |
| Actual $ | ❌ | not on the event; planned `budget_amount`/cost only. Real committed spend lives in **trip `budget_line_items`** (the queue fetches `_count.budget_line_items`) — never reaches the calendar event |

- **Budget vs Actual:** the event carries **planned** `budgetAmount` only. Operations
  blocks have `actual_start/end` **times** but not an actual **cost**; trip actuals
  live in `budget_line_items`. So the event **cannot carry Actual $** today without
  new plumbing.

## 4. HOME PAGE PLACEMENT + AUTH

- **Home page** `src/app/page.tsx` (client, public `/`). The travel stack is in
  `ModuleLauncher`; events render in the `m.key==='travel'` block: card body
  (`renderBody` `:181`) → `PublicFlightSearch` (`:189`) → hotels/ground/activities/
  visa (`:190-209`). **"Top of the stack, above Search real flights"** = mount the
  calendar at **~`:188`** (right after the Create-a-trip card body, before
  `PublicFlightSearch`).
- **Auth:** `/hub` is account-gated (`useSession` + `AppLayout`); the home page is
  **public**. The calendar's data routes — `/api/calendar`, `/api/operations/*`,
  `/api/hub/*` — are **NOT in `PUBLIC_PATHS`** (grep → none), so they're
  `getVerifiedEmail`-gated AND middleware-redirected for guests. → the home calendar
  **must gate on `authed`** (ModuleLauncher already computes it from
  `fetch('/api/auth/me')`, `:52,58-71`): logged-in → fetch + render the grid;
  logged-out → a "log in to see your schedule" card (→ `onRequireAuth`), **never** a
  personal-route fetch (which would redirect on the public page).

---

## REPORT — EXISTS | MISSING | THE PLAN

### (A) RELOCATE — can it mount on home as-is?
- **`CalendarGrid` mounts anywhere as-is** (already shared). What's missing for home
  is the **aggregation**, which lives in the `/hub` page (the 3 fetches + `gridEvents`
  memo), not in a component.
- **Smallest PR:** extract a self-contained **`<HubCalendar>`** that does the three
  source fetches (`/api/calendar`, `/api/operations/daily-plan/items`,
  `/api/hub/operations-routines`), builds `gridEvents` (reusing `mapOperationsBlocks`
  + `mapOperationsRoutines`), and renders `CalendarGrid` with `HUB_GRID_CONFIG`. Mount
  it **twice**: keep `/hub` working (refactor the page to use `<HubCalendar>`, or leave
  `/hub` as-is and have `<HubCalendar>` be a new shared component) and add it to the
  home stack at `ModuleLauncher:~188`, **gated on `authed`**. /hub's budget chrome
  (drill-downs, unscheduled tasks) stays on `/hub` only.
- **Tradeoff:** a clean extraction touches the 917-line page (risk) → safest is a NEW
  `<HubCalendar>` shared component used by home now, and `/hub` adopts it in a
  follow-up (so `/hub` is untouched this PR). Auth gating is mandatory (personal data
  on a public page).

### (B) AGGREGATION VERDICT — for the 12-column master
- **Today = hybrid read-time merge** (calendar_events stored; operations + routines
  merged from module tables). This is GOOD for *displaying* existing module events
  without duplication.
- **The 12-column MASTER needs columns that exist NOWHERE to "extend":** **Billable**
  (no schema field), **Actual $** (not on routines/ops; only trip `budget_line_items`),
  **structured Cadence/Entity/COA on the row** (today they're an RRULE string / a
  details string / unmapped). You cannot surface a column the source doesn't store.
- **Recommendation — a NEW unified `hub_scheduled_items` table for AUTHORED master
  rows** (additive), with first-class columns for all 12 + **FK links** to the modules:
  `coa account_id` (or `coa_code`), `entity_id`, `project_id`/`routine_id`/`task_id`,
  native `billable`, `budget_cents`, `actual_cents`, `cadence` enum, start/end
  date+time. The calendar then merges **two** things: existing module events
  (read-time, unchanged) **+** these authored master rows. This is the only path that
  gives **"robust clean data that tells a story"** — every column first-class and
  linked, billable/actual native, one queryable row that ties Routines + COA +
  Operations + Entities together.
- **Why not extend-only:** cheapest (no migration) but **structurally can't** carry
  billable/actual/structured-cadence → fails the goal. Extend the *mappers* only for
  columns that already exist (entity_id from routines, COA from tasks) as a display
  bonus — but the master rows need the new table.

### THE STAGED PLAN
1. **PR-HCR1 — `<HubCalendar>` shared component** (the 3-source merge + `CalendarGrid`),
   gated, mounted on home at `ModuleLauncher:~188`. **No `/hub` change** (it keeps its
   own page); reuses `mapOperationsBlocks`/`mapOperationsRoutines`. Auth: render only
   when `authed`, else a login card.
2. **PR-HCR2 — migration: `hub_scheduled_items`** (12 columns + FKs to COA/entity/
   project/routine/task, `billable`, `budget_cents`, `actual_cents`, cadence enum).
   schema.prisma + raw SQL (psql-before-merge).
3. **PR-HCR3 — authed feed + merge:** `GET /api/hub/calendar` returns the authored
   master rows (joined labels) merged into the grid alongside the module events; the
   master rows also surface in a 12-column queue/table.
4. **PR-HCR4 — the row editor** (COA/ops/routine/task/entity pickers, billable,
   budget/actual, cadence) writing to `hub_scheduled_items`.
5. **PR-HCR5 — actuals/cross-links:** roll trip `budget_line_items` / committed spend
   into Actual $; cross-link calendar rows ↔ COA/ops/entity.

### Flags
- **Auth boundary** (repeat): personal data on a public page → gate on `authed`; the
  `/api/calendar` + `/api/operations/*` + `/api/hub/*` routes stay authed (NOT in
  `PUBLIC_PATHS`); a guest sees a prompt, never rows, and the component must not fetch
  them while logged out (avoids the public-page redirect).
- **Schema migrations** (PR-HCR2, maybe HCR5): the unified table + billable + cadence
  enum + actual-$ plumbing — **psql before merge** (Alex's rule).
- **Decision needed:** confirm the **new unified table** vs extend-only (this audit
  recommends the new table for the master, keeping the read-time merge for display).
- **Honest size:** relocate is a **small PR** (one shared component, gated); the
  12-column master is a **multi-PR feature** (migration + feed + editor + actuals).
  No code modified in this audit.
