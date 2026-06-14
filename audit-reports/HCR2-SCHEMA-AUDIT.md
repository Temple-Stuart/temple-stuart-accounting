# HCR2 SCHEMA AUDIT — confirmed types for `hub_scheduled_items`

**Type:** Audit — READ ONLY. No source modified.
**Goal:** Confirm the EXACT FK-target types + project patterns the HCR2
`hub_scheduled_items` master-calendar table needs, so the migration uses correct
types (no guessing). `hub_scheduled_items` does **not** exist yet (grep:
`schema.prisma` — clean to create).

All citations are `prisma/schema.prisma` line numbers unless noted.

---

## 0. THE HEADLINE BLOCKERS (read first)

1. **Two different ID column types in this DB — get the FK types right or the
   migration fails.** Operations tables use **`@db.Uuid`** (Postgres `uuid`).
   `entities` and `users` use **plain `String`** (Postgres `text`), NOT `uuid`.
   A FK column's type must match its target's column type:
   - → operations_projects/tasks/routines/steps: `String @db.Uuid`
   - → entities / users: `String` (text, **no** `@db.Uuid`)
   Mixing these is the #1 way this migration breaks.
2. **Money has 4 conventions in the repo — pick the operations one (`Decimal(15,2)`
   USD), not Int cents.** The prompt's "budgetCents/actualCents" does **not** match
   the operations domain. Details in §5.
3. **COA is a soft *code* reference (`VarChar(50)`), not a uuid FK.** Operations
   links COA by `coa_code` string, never by `chart_of_accounts.id`. §1.6.
4. **There are no fixed "3 entity IDs."** Entities are created **per user** with
   `randomUUID()` (idempotent by `[userId, name]`), so `entityId` is a per-user FK
   resolved by name, not a global constant. §1.1.
5. **operations_* tables use *soft* (bare-String, no-FK-constraint) refs for
   user_id / entity_id**, but **real `@relation` FKs** for project/task/routine/
   step. HCR2 should mirror this split. §1.

---

## 1. FK TARGETS — exact table + PK type

### 1.1 `entities` (entity_id target)
- PK: `id String @id @default(uuid())` (**:67**) → **text** column (NO `@db.Uuid`).
- `userId String` (:68), `name String @db.VarChar(100)` (:69),
  `entity_type String @db.VarChar(20)` (:70), `is_default Boolean` (:71).
- `@@unique([userId, name])` (:91) — entities are per-user.
- **entity_type CHECK values:** `personal`, `business` originally
  (`migrations/20250930_double_entry_foundation/migration.sql:12`), extended to add
  `trading` (`prisma/add-trading-entity.sql:6` →
  `CHECK (entity_type IN ('personal','business','trading'))`). It's a **raw SQL
  CHECK on a VARCHAR**, not a Prisma enum.
- **The "3 entities" are seeded per user by NAME, with random UUIDs**
  (`src/lib/seed-entities.ts:11-14`): `Personal Finances` (type `personal`,
  default), `Trading` (type `personal`), `Business` (type `sole_prop`). ⚠ Note the
  seed uses `personal`/`sole_prop`, which only partly matches the CHECK
  (`personal/business/trading`) — pre-existing inconsistency, not HCR2's problem,
  but it means **entityId must be a real per-user FK, never a hardcoded constant.**
- **FK column for HCR2:** `entity_id String` (text). Mirror operations: a **bare
  String soft-ref** (operations_projects has `entity_id String` with **no**
  `@relation` to entities — :2691, relations block :2714-2718). A real FK is
  possible but would diverge from the operations pattern.

### 1.2 `operations_projects` (project_id target)
- PK: `id String @id @default(uuid()) @db.Uuid` (**:2689**) → **uuid**.
- `title String @db.VarChar(500)` (:2692).
- **FK column:** `project_id String? @db.Uuid` + `@relation` (nullable — see §6).

### 1.3 `operations_routines` (routine_id target)
- PK: `id String @id @default(uuid()) @db.Uuid` (**:2853**) → **uuid**.
- `name String @db.VarChar(200)` (:2856) — this is the routine "title".
- `schedule_rrule String @db.Text` (:2858) — required RRULE.
- **FK column:** `routine_id String? @db.Uuid` + `@relation` (nullable).

### 1.4 `operations_project_tasks` (task_id target)
- PK: `id String @id @default(uuid()) @db.Uuid` (**:2729**) → **uuid**.
- FK-to-project: `project_id String @db.Uuid` (:2730) + `@relation … onDelete: Cascade` (:2756).
- `title String @db.VarChar(500)` (:2733). Also carries `coa_code String? @db.VarChar(50)`
  (:2746) and `estimated_cost_usd` / `actual_cost_usd Decimal? @db.Decimal(15,2)`
  (:2737, :2747) — the cost precedent for §5.
- **FK column:** `task_id String? @db.Uuid` + `@relation` (nullable).

### 1.5 `operations_routine_steps` (routine_step_id target)
- PK: `id String @id @default(uuid()) @db.Uuid` (**:2888**) → **uuid**.
- FK-to-routine: `routine_id String @db.Uuid` (:2889) + `@relation … onDelete: Cascade` (:2908).
- **Title/label field is `activity String @db.VarChar(200)`** (:2894) — there is
  no "title" column; `activity` is the label. (`sub_activity`, `location` also exist.)
- **FK column:** `routine_step_id String? @db.Uuid` + `@relation` (nullable).

### 1.6 `chart_of_accounts` (Category / COA target)
- PK: `id String @id @db.Uuid` (**:148**) → **uuid**, **no `@default`** (app supplies id).
- `code String @db.VarChar(50)` (:151), `name String @db.VarChar(255)` (:152).
- `@@unique([userId, entity_id, code])` (:171).
- **⚠ The operations domain references COA by `code`, NOT by the uuid PK.**
  `operations_project_tasks.coa_code String? @db.VarChar(50)` (:2746) is a bare
  string with only `@@index([coa_code])` (:2765) — **no `@relation`/FK**.
  `calendar_events.coa_code String? @db.VarChar(50)` (:1341) does the same.
- **HCR2 column:** `coa_code String? @db.VarChar(50)` (soft code ref, no FK) —
  matches operations. Do **not** add a uuid FK to `chart_of_accounts.id`.

### 1.7 `users` (userId ownership target)
- PK: `id String @id` (**:439**) → **text** (no `@default`, no `@db.Uuid`).
- **FK column:** `user_id String` (text). Operations uses a **bare String soft-ref**
  (operations_projects `user_id String`, no `@relation` — :2690). Required (§6).

---

## 2. TIME STORAGE — match `operations_calendar_blocks`

- `operations_calendar_blocks` (**:2794-2807**) stores time as **two required +
  two nullable `timestamptz`**:
  - `scheduled_start DateTime @db.Timestamptz(6)` (**:2799**) — required
  - `scheduled_end   DateTime @db.Timestamptz(6)` (**:2800**) — required
  - `actual_start / actual_end DateTime? @db.Timestamptz(6)` (:2801-2802) — nullable
- The live mapper splits one timestamptz into the calendar's Date **and** Time at
  render time (`src/lib/hub/mapOperationsBlocks.ts:31-37` `toLocalDateAndTime`), so
  the 4 display columns (Start/End Date + Time) **derive from 2 timestamptz** — no
  need for 4 separate stored columns.
- (Contrast: `calendar_events` is **date-only** — `start_date/end_date DateTime
  @db.Date`, **no time columns** (:1333-1334). That's the trip layer; it's the
  weaker model. Match calendar_blocks, not calendar_events.)
- **RECOMMENDATION:** `starts_at DateTime @db.Timestamptz(6)` (required) +
  `ends_at DateTime? @db.Timestamptz(6)` (nullable). Optionally
  `actual_starts_at / actual_ends_at Timestamptz(6)?` if actual-time tracking is
  wanted later (mirrors `actual_start/actual_end`).

### ID generation convention
- Operations precedent (use this): `id String @id @default(uuid()) @db.Uuid`
  (e.g. **:2689, :2729, :2853, :2888**) → uuid type, Prisma-generated.
- Other conventions in the DB (do **not** use for an operations-domain table):
  `@default(cuid())` (`budget_line_items` :1036), `@default(dbgenerated(
  "gen_random_uuid()")) @db.Uuid` (`calendar_events` :1325), plain text uuid
  (`entities` :67).
- **RECOMMENDATION:** `id String @id @default(uuid()) @db.Uuid`.

### Column naming convention
- **Operations tables = `snake_case`** (`user_id`, `entity_id`, `scheduled_start`,
  `coa_code`, `display_order` — :2690-2749). FKs/quoted columns are snake_case.
- Newer trip/budget tables = **camelCase quoted identifiers** (`budget_line_items`:
  `userId`, `tripId`, `coaCode`, `itineraryId` — :1037-1040; also `trips`,
  `places_cache`).
- **RECOMMENDATION:** Use **`snake_case`** for `hub_scheduled_items` (it lives among
  and FKs the operations_* tables). The prompt's `startsAt`/`budgetCents` are the
  *trips/budget* convention; snake_case matches the actual neighbors and the live
  mapper's expectations.

---

## 3. CADENCE — enum vs CHECK

- The **operations domain uses Prisma native enums** for constrained fields:
  `ProjectStatus` (:2270), `OperationsTaskStatus` (:2648), `CalendarBlockStatus`
  (:2658), `ProjectDependencyType` (:2666) — declared as `enum X { … }` and used as
  `status ProjectStatus @default(...)`.
- A cadence enum precedent **already exists**: `RefreshCadence` (**:1939-1947**):
  `daily / weekly / monthly / quarterly / annual / event_driven`.
- A looser precedent exists too: `home_expenses.cadence String? @default("monthly")
  @db.VarChar(20)` (:~1361) and `entity_type` (VARCHAR + raw CHECK, §1.1).
- **RECOMMENDATION:** a **Prisma enum** (matches the operations domain, the table's
  home), e.g.
  `enum ScheduleCadence { one_time daily weekly monthly quarterly annual }`,
  column `cadence ScheduleCadence` (required, §6).
  Plus an **optional nullable RRULE** for advanced recurrence:
  `rrule String? @db.Text` — mirrors `operations_routines.schedule_rrule
  String @db.Text` (:2858) / `calendar_events.recurrence_rule String? @db.VarChar(50)`
  (:1338). Use `@db.Text` (routines' choice) since RRULEs can exceed 50 chars.

---

## 4. BILLABLE — confirmed new

- **`billable` exists NOWHERE in the schema** (grep `schema.prisma` for `billable`
  → **NONE**; also absent from `src/lib/hub`, `src/lib/operations`). Nothing to reuse.
- **RECOMMENDATION:** new `is_billable Boolean @default(false)` (required-with-default,
  §6). Naming `is_billable` mirrors the operations `is_active`/`is_default` idiom
  (:2871, :71).

---

## 5. BUDGET / ACTUAL — money type (AMBIGUITY — flagged)

Four money conventions exist:

| Convention | Type | Example |
|---|---|---|
| **Operations cost (USD)** | `Decimal? @db.Decimal(15,2)` | `operations_project_tasks.estimated_cost_usd` (:2737), `actual_cost_usd` (:2747); `operations_projects.estimated_total_cost_usd` (:2705) |
| Budget line item | `Decimal @db.Decimal(12,2)` | `budget_line_items.amount` (:1043) |
| Calendar/home (whole) | `Int` | `calendar_events.budget_amount Int? @default(0)` (:1340); `home_expenses.amount Int` (:~1363) |
| Ledger (cents) | `BigInt` | `chart_of_accounts.settled_balance/pending_balance` (:157-158) |

- **RECOMMENDATION:** `budget_usd Decimal? @db.Decimal(15,2)` +
  `actual_usd Decimal? @db.Decimal(15,2)`. This **matches the operations domain
  exactly** and is the *direct analog* — HCR2's budget/actual are the same concept
  as a task's `estimated_cost_usd` → `actual_cost_usd`. It also preserves cents,
  which the `Int` calendar_events path loses.
- **⚠ Do NOT use `budgetCents/actualCents Int`** as the prompt suggested — no
  operations table stores cents as Int; only the ledger uses BigInt cents, and that
  is a different (double-entry) domain. Int-dollars (calendar_events) is the
  weakest precedent (no cents). Decimal(15,2) is the right match.

---

## 6. THE NULLABLE-LINK TRUTH PRINCIPLE

Required where reality always has a value; nullable where it sometimes doesn't.

**REQUIRED (NOT NULL):**
- `id` (PK), `user_id` (ownership always known), `entity_id` (every row belongs to
  an entity), `cadence` (every row is one_time or recurring), `starts_at` (every
  scheduled row has a start), `is_billable` (Boolean default false),
  `description`/title text (recommend required; the row must say what it is).

**NULLABLE:**
- `project_id` **and** `routine_id` — a row links to EITHER a project OR a routine
  (or neither, e.g. an ad-hoc block). Both nullable.
- `task_id` **and** `routine_step_id` — EITHER a task OR a routine-step (or neither).
  Both nullable.
- `coa_code`, `budget_usd`, `actual_usd`, `ends_at`, `rrule` — sometimes absent.

**"At most one of" constraints:** the project↔routine pair and the task↔step pair
are mutually exclusive. Precedent for enforcing it in DB is the CHECK pattern the
daily-plan uses (`operations_daily_plan_items` enforces "exactly one of
task_id / ad_hoc_title" — `@@unique`/CHECK + route guard; see the route's mirror
comment at `src/app/api/operations/daily-plan/items/route.ts:151`). **Recommendation:**
add a raw SQL CHECK (`num_nonnull(project_id, routine_id) <= 1` and same for
task/step) **and** keep an app-level guard — consistent with how the daily-plan
"exactly one" rule is done. Leaving it app-level only is acceptable but weaker.

---

## 7. THE CONFIRMED 12-COLUMN MAP

| # | Calendar column | `hub_scheduled_items` column | Type / FK target | Req? |
|---|---|---|---|---|
| 1 | Start Date | `starts_at` (date half) | `DateTime @db.Timestamptz(6)` (date+time in one) | **Req** |
| 2 | Start Time | `starts_at` (time half) | derived from `starts_at` (split at render, `mapOperationsBlocks.ts:31`) | **Req** |
| 3 | End Date | `ends_at` (date half) | `DateTime? @db.Timestamptz(6)` | null |
| 4 | End Time | `ends_at` (time half) | derived from `ends_at` | null |
| 5 | Cadence | `cadence` (+ `rrule`) | enum `ScheduleCadence`; `rrule String? @db.Text` | **Req** (rrule null) |
| 6 | Category (COA) | `coa_code` | `String? @db.VarChar(50)` (soft code ref → `chart_of_accounts.code`, **no FK**) | null |
| 7 | Project-or-Routine | `project_id` / `routine_id` | `String? @db.Uuid` → operations_projects.id / operations_routines.id (real FKs) | null / null (≤1) |
| 8 | Description (task/step) | `task_id` / `routine_step_id` (+ `description`) | `String? @db.Uuid` → operations_project_tasks.id / operations_routine_steps.id; `description String?` | null (≤1) |
| 9 | Entity | `entity_id` | `String` (**text**, soft-ref → entities.id) | **Req** |
| 10 | Billable | `is_billable` | `Boolean @default(false)` | **Req** |
| 11 | Budget $ | `budget_usd` | `Decimal? @db.Decimal(15,2)` | null |
| 12 | Actual $ | `actual_usd` | `Decimal? @db.Decimal(15,2)` | null |

Plus housekeeping (mirror operations_*): `id String @id @default(uuid()) @db.Uuid`,
`user_id String` (**text**, req), `created_at/updated_at DateTime @db.Timestamptz(6)`,
`created_by String?`, and indexes `@@index([user_id, starts_at])`,
`@@index([entity_id])`, `@@index([coa_code])`, `@@index([project_id])`,
`@@index([routine_id])`.

---

## 8. BLOCKERS TO A CLEAN MIGRATION (resolve before writing)

1. **FK column type split (CRITICAL):** `@db.Uuid` for project/task/routine/step
   (operations PKs are uuid); plain text `String` for `user_id`/`entity_id`
   (users.id / entities.id are text). Getting this backwards = FK type-mismatch
   error at migrate time. (§0.1, §1.)
2. **Money type:** use `Decimal(15,2)` USD (operations convention), not Int cents.
   Confirm with Alex if cents are ever wanted, but the analog is `*_cost_usd`. (§5.)
3. **COA is not a uuid FK** — store `coa_code VarChar(50)`, soft ref, no relation. (§1.6.)
4. **entityId/userId are per-user soft refs, not constants** — resolve entity by
   `[userId, name]`; don't hardcode "3 IDs". (§1.1.)
5. **"At most one of" project/routine + task/step** — decide CHECK-in-DB (recommended,
   mirrors daily-plan) vs app-level only. (§6.)
6. **Naming convention** — snake_case (operations) vs the prompt's camelCase. Pick
   snake_case to match neighbors + the live mapper. (§2.)
7. Operations tables use **soft (no-constraint) refs for user/entity** but **real
   FKs for project/task/routine/step** — mirror that split so the migration matches
   the existing relational graph. (§1.)

---

## Citations index
- entities: `prisma/schema.prisma:66-93` (id :67 text, entity_type :70); CHECK
  `prisma/add-trading-entity.sql:6`; 3 entities `src/lib/seed-entities.ts:11-14`.
- chart_of_accounts: `:147-174` (id :148 uuid, code :151, name :152).
- users: `:438-439` (id text).
- operations_projects `:2688-2725`; project_tasks `:2728-2767`; daily_plan_items
  `:2770-2792`; calendar_blocks `:2794-2814` (time :2799-2802); routines
  `:2852-2885` (rrule :2858); routine_steps `:2887-2916` (activity :2894).
- Money: tasks Decimal(15,2) `:2737,:2747`; budget_line_items Decimal(12,2) `:1043`;
  calendar_events Int `:1340`; chart_of_accounts BigInt `:157-158`.
- Cadence enum precedent RefreshCadence `:1939-1947`; status enums `:2648,:2658`.
- billable: grep `schema.prisma` → none.
- Time split at render: `src/lib/hub/mapOperationsBlocks.ts:31-37`.
- "exactly one of" precedent: `src/app/api/operations/daily-plan/items/route.ts:151`.
