# Event detail box → canonical editable event editor + cost-by-name (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Headline (the one decisive finding):** the 12-column canonical store the editor wants
**already exists** — `hub_scheduled_items` (`prisma/schema.prisma:2979-3023`) has `entity_id`,
`cadence` (enum), `coa_code`, **`project_id` + `routine_id` + `trip_id` real FK kind-links**,
`is_billable`, `budget_usd`, `actual_usd`, `description`, `vendor` — but it is **wired to
NOTHING** (no route reads or writes it; the only `src` reference is a *comment*,
`EventDetailPanel.tsx:8`). Meanwhile the live calendar + detail box render a **different**
store: `calendar_events` (trips) + the operations tables (project/routine), which has **no**
entity / cadence / billable / vendor columns and only a **polymorphic `source_id` string**, not
typed kind-links. So the editor is two problems: (1) a render/PATCH shell over the right store,
and (2) deciding whether to **wire the already-built `hub_scheduled_items`** as the canonical
row or to **add the missing columns to `calendar_events`**. Cost-by-name works TODAY only for
Trip; Project is partial; **Routine + Content have no cost column at all**.

---

## 1. The DETAIL BOX component — `EventDetailPanel.tsx`

`src/components/hub/EventDetailPanel.tsx` — the master-calendar click→detail modal (opened from
`HubCalendar.tsx` `handleEventClick`→`setDetailEvent`, rendered at the bottom of HubCalendar).

- **Read-only, ZERO-FETCH.** "It renders the passed `event` object only. Nothing here calls a
  route" (`:16-17`). No PATCH, no PUT, no form — it maps a fixed `rows` array to a `<Row>`
  label/value list (`:107-123, 156-158`). — EXISTS (read-only stub).
- **The placeholder.** `const NOT_SET = 'not set yet'` (`:41`); a "not set yet" value renders
  muted-italic (`:60-66`). Footer caption: *"The blank fields fill in once this is wired to your
  account."* (`:173-177`). — EXISTS.
- **What's actually shown** (`scheduledRows`, `:107-121`): Start/End Date+Time (from
  `event.startDate/startTime/endDate/endTime`), Budget $ (from `event.budgetAmount`), the
  source-named row (`{ label: cfg.label, value: val(event.title) }`, `:115`) — and **hardcoded
  `NOT_SET`** for Entity (`:112`), Category (COA) (`:114`), Task/Step (`:117`), Billable
  (`:118`), Actual $ (`:120`). Cadence shows `'Repeats'`/`NOT_SET` from `event.isRecurring`
  (`:113`) — a boolean, not the real cadence. — EXISTS-BUT-UNUSED placeholders.
- **No PATCH path from it** — confirmed: the file imports only `useEffect`/`useRef` + the
  GridEvent type (`:24-25`); no `fetch`. — MISSING (editing).

**The input is a `GridEvent`** (`CalendarGrid.tsx:14-44`). That type carries `id, source, title,
startDate, endDate, startTime, endTime, durationMinutes, startAt/endAt/zones, isRecurring,
location, budgetAmount, details, href` — and **NOT** `source_id`, `coa_code`, `entity_id`,
`vendor`, `description`, `cadence`, `billable`, `actual`, or any parent record id/name. So even
the data the panel needs to *display* a full editor is **dropped before it reaches the panel**
(same gap pattern as the pre-tz-3a instant). — MISSING / RISK, `CalendarGrid.tsx:14-44`.

## 2. ENTITY — `entity_id` on the event?

- **`calendar_events` has NO `entity_id`** — full column list `schema.prisma:1339-1380`; grep for
  `entity_id` in that range returns nothing. — MISSING.
- **`trip_itinerary` has NO `entity_id`** (`:646-695`). — MISSING.
- The 3 entities (Personal/Business/Trading) ARE rows in **`entities`** (`:66-93`): `id`
  (uuid), `name` (`:69`), `entity_type` (`:70`), `is_default` (`:71`). So the named entity
  records exist. — EXISTS (the records).
- **`trips.entity_id` EXISTS but is dead** — `"nothing reads/writes this yet"` (`:543-545`). —
  EXISTS-BUT-UNUSED.
- **`hub_scheduled_items.entity_id` EXISTS + required** (`:2982`), as do
  `operations_*` (`operations_projects.entity_id :2721`, `operations_routines.entity_id :2887`,
  `operations_content_pieces.entity_id :3109`). — EXISTS (on the operations side).

→ For an event to carry Entity, `calendar_events` needs an `entity_id` column **(MIGRATION)** —
or the editor writes `hub_scheduled_items` (already has it).

## 3. CADENCE — recurrence on the event?

- `calendar_events`: `is_recurring Boolean?` (`:1353`) + `recurrence_rule String? @db.VarChar(50)`
  (`:1354`) — a boolean + a free rrule string, **not** the 1x/daily/weekly/monthly enum the task
  wants. — EXISTS (partial / wrong shape).
- **`hub_scheduled_items.cadence`** is the real field: enum **`ScheduleCadence { daily weekly
  monthly one_time }`** (`:2959-2964`) + `rrule` (`:2986`). — EXISTS (canonical, unwired).
- Reference cadence pattern also on `home_expenses.cadence VarChar(20)` (`:1388`) and
  `trip_itinerary.recurrence 'once'|'daily'` (`:670`).

→ A 1x/daily/weekly/monthly cadence on `calendar_events` is **MISSING** (migration) unless the
editor targets `hub_scheduled_items`.

## 4. COA — code + TEXT TITLE ("B-9100 — Travel")

- The event stores **`calendar_events.coa_code String? @db.VarChar(50)`** (`:1358`) — the CODE
  only, a **soft ref** (no FK). — EXISTS (code).
- The **title** lives on **`chart_of_accounts`**: `code @db.VarChar(50)` (`:151`) + **`name
  @db.VarChar(255)`** (`:152`). So "B-9100 — Travel" = `code` + `name`. — EXISTS (title).
- **Join RISK:** `chart_of_accounts` is unique on **`@@unique([userId, entity_id, code])`**
  (`:171`) — the same `code` can exist under different entities. With **no `entity_id` on
  `calendar_events`**, `coa_code → name` is **ambiguous** without the entity. The join needs
  `entity_id` (see §2). — RISK, `schema.prisma:171` + `calendar_events:1358`.
- Not joined at the render site today — the panel shows `NOT_SET` for Category/COA
  (`EventDetailPanel.tsx:114`); no route resolves the title.

## 5. KIND-LINK — THE BIG ONE

**`calendar_events` has NO typed kind-link columns.** It links polymorphically via
**`source String @db.VarChar(20)` + `source_id String?`** (`:1342-1343`, indexed `:1378`).

- **Trip:** `source='trip'`, `source_id` = the trip — CONFIRMED by `trips/[id]/route.ts:137`
  (`DELETE … WHERE source='trip' AND source_id::text = ${id}`). **RISK — two incompatible
  `source_id` formats:** `commit/route.ts` writes the **bare trip id** (`source_id::text =
  ${id}`, `:182,283`), while `vendor-commit/route.ts` writes a **composite**
  `` `trip:${id}:vendor:${optionId}` `` (`:370,387`). Grouping cost by trip must parse BOTH. —
  EXISTS-but-RISK.
- **Project:** project events are **not in `calendar_events` at all** — they come from the
  operations tables via `/api/operations/daily-plan/items` → `mapOperationsBlocks` (the
  GridEvent `id` = `block.id`, `mapOperationsBlocks.ts:67`; **no `project_id` carried**). The
  link chain that EXISTS in schema is `operations_calendar_blocks → daily_plan_items → task
  (operations_project_tasks.project_id) → operations_projects` — but it never reaches the
  GridEvent. — MISSING (on the event/GridEvent).
- **Routine:** routine events also bypass `calendar_events` (`/api/hub/operations-routines` →
  `mapOperationsRoutines`); the routine id is only **string-embedded** in the GridEvent id:
  `` `routine:${routine.routine_id}:${occISO}` `` (`mapOperationsRoutines.ts:95,113`). — MISSING
  (no typed link; recoverable by parsing).
- **Content:** **not loaded onto the calendar at all** — HubCalendar has exactly three loaders
  (calendar / ops-blocks / ops-routines, `HubCalendar.tsx`); there is no content source. —
  MISSING entirely.

**The typed kind-links that DO exist — on `hub_scheduled_items` (unwired):** `project_id` FK→
`operations_projects` (`:2988,3010`), `routine_id` FK→`operations_routines` (`:2989,3011`),
`task_id` (`:2990,3012`), `routine_step_id` (`:2991,3013`), `trip_id` FK→`trips`
(`:3005,3014`). **No `content_piece_id`.** — EXISTS-BUT-UNUSED (the core migration target).

## 6. NAMED RECORDS — does each kind have a NAME column?

| Kind | Table | Name column | Cite | Note |
|---|---|---|---|---|
| Trip | `trips` | `name VarChar(255)` | `:518` | ✅ clean name |
| Project | `operations_projects` | **`title` VarChar(500)** | `:2722` | ✅ (called *title*, not *name*) |
| Routine | `operations_routines` | `name VarChar(200)` | `:2888` | ✅ |
| Content | `operations_content_pieces` | **`title` VarChar(200) — NULLABLE** | `:3111` | ⚠ name can be NULL (often a date-keyed piece) |

So a name to roll cost up against exists for all four — but **content's name is nullable**
(RISK: "Bali Vlog Ep.3" must be set, else the rollup label is empty). The compliance-domain
`projects.title` (`:2409`) is a DIFFERENT table (mission-scoped) — the hub's project is
`operations_projects`.

## 7. COST ROLL-UP — existing per-parent sums

- **Trip total in the ledger** = a **client-side reduce**, not a DB rollup:
  `TripBudgetActual.tsx:266` `const total = items.reduce((s,it)=>s+Number(it.amount||0),0)` over
  `/api/trips/[id]/budget` rows. Per-trip, computed in the browser. — EXISTS (per trip).
- **Per-SOURCE totals** exist server-side: `/api/calendar` `calcTotal('trip')` etc.
  (`calendar/route.ts:64-93`) — but that's by **source type**, not by **named record**. — EXISTS
  (by type, not by name).
- **Cost columns by kind:**
  - Trip: `calendar_events.budget_amount Int` (`:1359`); `trip_itinerary.cost Decimal(12,2)`
    (`:656`). ✅
  - Project: `operations_project_tasks.estimated_cost_usd/actual_cost_usd` (`:2768,2778`) +
    `operations_projects.estimated_total_cost_usd` (`:2735`). ✅ (rolls up task→project)
  - **Routine: NONE** — `operations_routines` (`:2884-2918`) and `operations_routine_steps`
    have **no cost/budget/usd column** (grep empty). — MISSING.
  - **Content: NONE** — `operations_content_pieces` (`:3106-3137`) has **no cost column**
    (grep empty). — MISSING.
  - Canonical: `hub_scheduled_items.budget_usd/actual_usd Decimal(15,2)` (`:2993-2994`) — one
    money pair for ALL kinds, groupable by `trip_id`/`project_id`/`routine_id`. — EXISTS-UNUSED.

→ Pattern to extend: **group `hub_scheduled_items.budget_usd` by the parent FK** (one `GROUP BY`
gives trip/project/routine name-totals). Today it can't because the table is empty/unwired and
content has no link.

## 8. DESCRIPTION (replaces Task/Step)

- **`calendar_events.description String?`** EXISTS (`:1345`) — written by the trip **commit**
  path (`commit/route.ts:188` column list, value `details.title`) but **NOT** by vendor-commit
  (its INSERT omits description, `vendor-commit/route.ts:386-387`). So description is
  inconsistently populated. — EXISTS-BUT-PARTIAL.
- The detail box's **"Task / Step" row is bound to nothing** — hardcoded `NOT_SET`
  (`EventDetailPanel.tsx:117`); `description` is not even on the GridEvent (§1). — MISSING (wiring).
- `hub_scheduled_items.description Text` (`:2995`) and `operations_project_tasks.description`
  (`:2765`) exist too.

## 9. BILLABLE

- **`calendar_events` has NO `billable` column** (`:1339-1380`, grep empty). — MISSING (migration).
- **`hub_scheduled_items.is_billable Boolean @default(false)`** EXISTS (`:2992`). — EXISTS-UNUSED.
- Panel shows hardcoded `NOT_SET` (`EventDetailPanel.tsx:118`).

## 10. BUDGET, VENDOR

- **Budget:** `calendar_events.budget_amount Int? @default(0)` EXISTS (`:1359`), written by both
  commit paths (`:387`, `commit:188`); surfaced read-only in the panel (`budgetAmount`,
  `EventDetailPanel.tsx:119`). Editable today? **No** (read-only). — EXISTS (storage), MISSING (edit).
- **Vendor:** **`calendar_events` has NO `vendor` column** (grep empty). Vendor lives on
  `trip_itinerary.vendor VarChar(255)` (`:655`) + `trip_itinerary.vendor_name` (`:674`), and on
  `hub_scheduled_items.vendor VarChar(255)` (`:3003`) — but **not** on the event the calendar/box
  renders. — MISSING (on `calendar_events`).

## 11. NAIVE-ISO BOX BUG — START DATE shows `2026-07-01T00:00:00.000Z`

**Root:** `EventDetailPanel.formatDate` (`:46-51`) does
`new Date(\`${ymd}T00:00:00\`)` — it assumes `ymd` is a bare `YYYY-MM-DD`. But **trip** events
carry a **full ISO** `startDate`: HubCalendar maps `startDate: e.start_date`
(`HubCalendar.tsx:183`) straight from `/api/calendar`'s `SELECT *`, where `start_date @db.Date`
serializes as `"2026-07-01T00:00:00.000Z"`. Appending `T00:00:00` yields
`"2026-07-01T00:00:00.000ZT00:00:00"` → `Number.isNaN` → the guard **returns the raw string**
(`:49`). So the box prints the unconverted ISO. — RISK, `EventDetailPanel.tsx:46-51` +
`HubCalendar.tsx:183`.

**Why operations rows look fine:** `mapOperationsBlocks` emits a clean `YYYY-MM-DD`
(`mapOperationsBlocks.ts:33-37,67`), so only **trip/calendar-sourced** rows hit the bug. The
ledger differs because `TripBudgetActual` formats its own `/budget` payload, not this panel.

**Fix location (fold in):** `EventDetailPanel.formatDate` — split on `'T'` first
(`ymd.split('T')[0]`), exactly like `CalendarGrid.parseDate` (`CalendarGrid.tsx:~109`). The
institutional fix is to render from the **instant** (`event.startAt` via `instantToZoned`, the
tz-4 path) so the box agrees with the calendar — but the minimal correctness fix is the `'T'`
split. SMALL.

## 12. PATCH route — what exists vs what a full editor needs

- **The only field-edit PATCH** is `trips/[id]/itinerary/[itineraryId]/route.ts` — it writes
  **`trip_itinerary` date/time ONLY**: `block_start_time/block_end_time`, `homeDate/destDate`,
  `homeTime/destTime`, `date` (`:88-147`). It does **NOT** edit budget, vendor, coa, entity,
  cadence, billable, description. — EXISTS (dates/times only).
- **RISK — split-brain + stale instant:** that PATCH targets `trip_itinerary`, but the calendar
  renders `calendar_events`; the PATCH **does not update `calendar_events` nor recompute
  `start_at/end_at`** (`:153` updates only `trip_itinerary`). So a ledger time-edit does not move
  the calendar block, and the tz instant goes stale. A real editor must write **one** canonical
  row (or keep `trip_itinerary` + `calendar_events` + `start_at/end_at` in sync). — RISK.
- A **full-field PATCH** would need: a target table that HAS the fields (→ `hub_scheduled_items`,
  or migrated `calendar_events`), validation per field (reuse `parseTimeOrNull`,
  `parseDayUtc`, `parseLedgerTime` from this route — REUSABLE), `start_at/end_at` recompute via
  `lib/time.ts` (REUSABLE, tz-2), and auth/ownership (the sibling pattern here, REUSABLE).

---

## (a) PER-FIELD TABLE — field | stored? | editable today? | migration?

| Field | Stored (column · type) | file:line | Editable today? | Migration? |
|---|---|---|---|---|
| Start Date | `calendar_events.start_date Date` | `:1349` | No (read-only box) | No |
| Start Time | `calendar_events.start_time Time` | `:1351` | Via itinerary PATCH (trip_itinerary, not this row) | No |
| End Date | `calendar_events.end_date Date?` | `:1350` | No | No |
| End Time | `calendar_events.end_time Time?` | `:1352` | itinerary PATCH only | No |
| **Entity** | **MISSING on event** (records in `entities`) | `:1339-1380` / `:66-93` | No | **YES** (add `entity_id`) |
| Budget $ | `calendar_events.budget_amount Int?` | `:1359` | No | No |
| **Cadence** | partial: `is_recurring`+`recurrence_rule` (not enum) | `:1353-1354` | No | **YES** (enum cadence) |
| **Vendor** | **MISSING on event** (on `trip_itinerary`/`hub_*`) | `:655` / `:3003` | No | **YES** |
| COA code | `calendar_events.coa_code VarChar(50)` (soft) | `:1358` | No | No |
| COA title | `chart_of_accounts.name` (ambiguous w/o entity) | `:152,171` | No | depends on Entity |
| Description | `calendar_events.description?` (partial write) | `:1345` | No | No (wire-only) |
| **Kind-link** | polymorphic `source/source_id` only | `:1342-1343` | No | **YES** (typed links) |
| **Billable** | **MISSING on event** | `:1339-1380` | No | **YES** |
| Actual $ | **MISSING on `calendar_events`** (`hub_*.actual_usd`) | `:2994` | No | **YES** (or use hub_*) |

## (b) KIND-LINK MATRIX — the core finding

| Kind | Event→record link TODAY | Where | Typed link in schema (unwired) | Verdict |
|---|---|---|---|---|
| **Trip** | `calendar_events.source_id` (string, **2 formats**) | `:1343`; `trips/[id]:137`, `vendor-commit:370` | `hub_scheduled_items.trip_id` FK `:3005,3014` | EXISTS (string) / RISK (format) |
| **Project** | none on event (lives in operations tables) | `mapOperationsBlocks.ts:67` | `hub_scheduled_items.project_id` FK `:2988,3010` | MISSING (typed) |
| **Routine** | only string-embedded in GridEvent id | `mapOperationsRoutines.ts:95` | `hub_scheduled_items.routine_id` FK `:2989,3011` | MISSING (typed) |
| **Content** | not on the calendar at all | (no loader) | **NO `content_piece_id`** anywhere | MISSING (entirely) |

**Core migration:** add typed kind-links. The cheapest path is to **wire the already-built
`hub_scheduled_items`** (it has trip/project/routine FKs) and **add one `content_piece_id`
column** to it (→ `operations_content_pieces`). Doing it on `calendar_events` instead means four
new nullable FK columns there.

## (c) NAMED-RECORD CONFIRM — name column to attribute cost to?

- Trip → `trips.name` ✅ (`:518`)
- Project → `operations_projects.title` ✅ (`:2722`)
- Routine → `operations_routines.name` ✅ (`:2888`)
- Content → `operations_content_pieces.title` ✅ but **NULLABLE** (`:3111`) — RISK (empty label).

## (d) COST-BY-NAME FEASIBILITY

- **Trip — YES today** (with a caveat): group `calendar_events.budget_amount` (or
  `trip_itinerary.cost`) by the trip embedded in `source_id`, join `trips.name`. Caveat: parse
  **both** `source_id` formats (§5). Per-trip totals already exist client-side
  (`TripBudgetActual.tsx:266`).
- **Project — PARTIAL:** cost exists (`operations_project_tasks.*_cost_usd → operations_projects`)
  but is **not** on calendar events; a project-name rollup is a separate query over the ops
  tables, not the calendar.
- **Routine — NO:** **no cost column** on routines/steps (§7). A rollup needs a new money field
  (or `hub_scheduled_items.budget_usd`). MIGRATION.
- **Content — NO:** no cost column **and** no event link. MIGRATION (link + money).

**What unlocks uniform cost-by-name:** route every scheduled thing through
`hub_scheduled_items` (it already has `budget_usd`/`actual_usd` + trip/project/routine FKs); add
`content_piece_id`; then **one** `GROUP BY <kind FK>` joined to each name column yields
"Digital Nomad Tour 2026", "Morning Routine", "Bali Vlog Ep.3" totals. Until the calendar
WRITES + READS `hub_scheduled_items`, cost-by-name is trip-only.

## (e) NAIVE-ISO BOX BUG — root + fix

Root: `EventDetailPanel.formatDate` assumes `YYYY-MM-DD` but trip rows carry full ISO from
`/api/calendar` (`HubCalendar.tsx:183` ← `SELECT *`); the `T00:00:00` append → NaN → raw string
returned (`EventDetailPanel.tsx:46-51`). Fix in `formatDate`: `ymd.split('T')[0]` (mirror
`CalendarGrid.parseDate`), or render from `event.startAt` via `instantToZoned` (tz-4 path) so the
box matches the calendar. SMALL.

## (f) RECOMMENDED ATOMIC PR SEQUENCE (honest sizing, every migration flagged)

1. **PR-EE-1 — editor shell + naive-ISO fix (SMALL, NO migration).** Convert
   `EventDetailPanel` from `<Row>` text to inputs over the fields that **already exist**
   (dates/times, budget, description, coa_code), reusing the `trips/[id]/itinerary/[itineraryId]`
   PATCH for trip date/time. Fix `formatDate` (§e). Plumb the missing display fields
   (`coa_code`, `description`, `source_id`) onto `GridEvent` + the HubCalendar map (the §1 gap).
   No new columns. Ships value immediately.
2. **PR-EE-2 — COA title join (SMALL-MED, NO migration, depends on Entity for correctness).**
   Resolve `coa_code → "code — name"` from `chart_of_accounts`. Honest caveat: ambiguous until
   the event carries `entity_id` (§4) — until then resolve within the user's default entity and
   flag.
3. **PR-EE-3 — KIND-LINK migration (MED-LARGE, **MIGRATION**, the core).** Decision gate:
   **(A)** wire `hub_scheduled_items` as the canonical row (no new link columns — it already has
   trip/project/routine FKs; add `content_piece_id`) and make the calendar write+read it; or
   **(B)** add `entity_id`, `cadence` (enum), `is_billable`, `vendor`, `actual_amount`,
   `project_id`/`routine_id`/`content_piece_id` to `calendar_events`. **Recommend A** — the
   table is built and matches the field set; (B) duplicates it. Either way: Alex-run psql +
   `schema.prisma` + `npx prisma generate`. Flag: `content_piece_id` is net-new in BOTH options.
4. **PR-EE-4 — full-field PATCH + start_at/end_at sync (MED, depends on EE-3).** One PATCH over
   the canonical row for ALL fields, recomputing `start_at/end_at` via `lib/time.ts`; reuse the
   itinerary route's validators. Closes the split-brain/stale-instant RISK (§12).
5. **PR-EE-5 — cost-by-name rollup (SMALL-MED once EE-3 lands).** `GROUP BY` the kind FK joined
   to each name column → per-named-record totals. Add routine/content money only if not already
   via `hub_scheduled_items.budget_usd` (it is). **MIGRATION only if** staying on `calendar_events`
   (no money/link there for routine/content).

### Migration ledger (explicit)
- **MISSING columns on `calendar_events`:** `entity_id`, enum `cadence`, `is_billable`,
  `vendor`, `actual_amount`, typed `project_id`/`routine_id`/`content_piece_id` — all migrations
  **iff** option (B).
- **`hub_scheduled_items`:** has everything EXCEPT **`content_piece_id`** (one migration) — and
  must be **wired** (write path + read path), today it is EXISTS-BUT-UNUSED.
- **Routine/Content cost:** no column today — covered by `hub_scheduled_items.budget_usd` under
  option (A); a migration under (B).
- **`content_piece_id`** is net-new under **every** option.

### Citation index
- Detail box: `src/components/hub/EventDetailPanel.tsx:16-17,41,46-51,107-123,156-158,173-177`.
- GridEvent type (dropped fields): `src/components/shared/CalendarGrid.tsx:14-44`.
- `calendar_events`: `prisma/schema.prisma:1339-1380` (`source/source_id :1342-1343`,
  `description :1345`, `coa_code :1358`, `budget_amount :1359`, `is_recurring/rule :1353-1354`).
- Canonical store `hub_scheduled_items`: `:2959-2964` (cadence enum), `:2979-3023`
  (entity/coa/project_id/routine_id/trip_id/is_billable/budget_usd/actual_usd/vendor/description).
- Named records: `trips.name :518`, `operations_projects.title :2722`,
  `operations_routines.name :2888`, `operations_content_pieces.title :3111`.
- Entities: `:66-93`; `chart_of_accounts.code/name/unique :151-152,171`.
- Trip kind-link + source_id formats: `trips/[id]/route.ts:137,182,283`;
  `vendor-commit/route.ts:370,386-387`; `commit/route.ts:182,188,283`.
- Operations mappers: `mapOperationsBlocks.ts:67`; `mapOperationsRoutines.ts:95,113`.
- Inline PATCH (dates/times only): `trips/[id]/itinerary/[itineraryId]/route.ts:88-147,153`.
- Trip total (client reduce): `TripBudgetActual.tsx:266`. Per-source totals:
  `calendar/route.ts:64-93`. Naive-ISO source: `HubCalendar.tsx:183`.

*Do not implement — audit only.*
