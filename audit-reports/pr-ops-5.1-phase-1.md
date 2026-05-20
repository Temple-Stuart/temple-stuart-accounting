PR-OPS-5.1 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- current branch: claude/pr-ops-5.1-task-time-block-audit
- branch created: yes (new, from origin/main tip `9d31a83`)
- main is clean: yes (pulled cleanly; only operations 4.9.3 PRs above 5.x)

A. PRISMA SCHEMA — operations_project_tasks
- Model name: `operations_project_tasks` (snake_case Prisma model; @@map matches table name)
- Schema path + line: prisma/schema.prisma:2596
- Existing fields (prisma/schema.prisma:2597–2621):
  * id                   String               @id @default(uuid()) @db.Uuid                       — line 2597
  * project_id           String               @db.Uuid                                            — line 2598
  * user_id              String                                                                   — line 2599
  * entity_id            String                                                                   — line 2600
  * title                String               @db.VarChar(500)                                    — line 2601
  * description          String?              @db.Text                                            — line 2602
  * status               OperationsTaskStatus @default(open)                                      — line 2603
  * estimated_minutes    Int?                                                                     — line 2604
  * estimated_cost_usd   Decimal?             @db.Decimal(15, 2)                                  — line 2605
  * deadline             DateTime?            @db.Timestamptz(6)                                  — line 2606
  * priority_score       Decimal?             @db.Decimal(10, 4)                                  — line 2607
  * priority_inputs_hash String?              @db.VarChar(64)                                     — line 2608
  * priority_computed_at DateTime?            @db.Timestamptz(6)                                  — line 2609
  * priority_rationale   String?              @db.Text                                            — line 2610
  * unblocks_label       String?              @db.Text                                            — line 2611
  * link_url             String?              @db.Text                                            — line 2612
  * notes                String?              @db.Text                                            — line 2613
  * coa_code             String?              @db.VarChar(50)                                     — line 2614  ← EXPENSE CATEGORY ALREADY EXISTS
  * actual_cost_usd      Decimal?             @db.Decimal(15, 2)                                  — line 2615
  * actual_minutes       Int?                                                                     — line 2616
  * display_order        Int                  @default(0)                                         — line 2617
  * completed_at         DateTime?            @db.Timestamptz(6)                                  — line 2618
  * created_at           DateTime             @default(now()) @db.Timestamptz(6)                  — line 2619
  * updated_at           DateTime             @updatedAt @db.Timestamptz(6)                       — line 2620
  * created_by           String?                                                                  — line 2621

- Time-block-related fields already present:
  * `deadline DateTime? @db.Timestamptz(6)` (line 2606) — a *deadline*, NOT a calendar commitment.
  * **NONE of**: `time_block_start`, `timeBlockStart`, `startsAt`, `scheduledFor`, `dueDate` exist on this model.
  * **CRITICAL FINDING:** the time-block concept is already modeled via a *separate* table chain:
      operations_project_tasks (one) → operations_daily_plan_items (many; line 2635) → operations_calendar_blocks (many; line 2658)
    `operations_calendar_blocks` carries `scheduled_start`, `scheduled_end`, `actual_start`, `actual_end`, `status`, `notes` (lines 2663–2668). This is the existing normalized path for putting a task on the calendar.
  * No `duration_min` / `durationMin` / `durationMinutes`. `estimated_minutes` (line 2604) and `actual_minutes` (line 2616) already encode duration.

- Category-related fields already present:
  * `coa_code String? @db.VarChar(50)` (line 2614). **The expense-category column ALREADY EXISTS.** Indexed at line 2631.
  * No `category`, `categoryId`, `accountCode` on this model. (Other models in the schema use those names in different contexts — see Section B.)

- Existing indexes (prisma/schema.prisma:2627–2631):
  * @@index([project_id, status, display_order]) — line 2627
  * @@index([user_id, status, priority_score])   — line 2628
  * @@index([deadline])                           — line 2629
  * @@index([entity_id])                          — line 2630
  * @@index([coa_code])                           — line 2631  ← already covers category-lookup
  * No @@unique constraints.

- Existing relations (prisma/schema.prisma:2623–2625):
  * project          operations_projects              @relation(fields: [project_id], references: [id], onDelete: Cascade) — line 2623
  * daily_plan_items operations_daily_plan_items[]                                                                          — line 2624
  * status_history   operations_task_status_history[]                                                                       — line 2625

B. CATEGORY CONVENTION ELSEWHERE
- Transactions (Plaid actuals) model uses: `predicted_coa_code String? @db.VarChar(20)` at prisma/schema.prisma:386 (column 20-char, not 50)
- Plaid merchant-COA mapping uses: `coa_code String @db.VarChar(50)` at prisma/schema.prisma:239 (merchant_coa_mappings)
- Home expenses: `coa_code String @db.VarChar(50)` at prisma/schema.prisma:1229
- Module expenses: `coa_code String @db.VarChar(20)` at prisma/schema.prisma:1248
- Calendar events: `coa_code String? @db.VarChar(50)` at prisma/schema.prisma:1214
- Budget line items: `coaCode String @db.VarChar(20)` at prisma/schema.prisma:1024 (camelCase, older style)
- Routines model (`operations_routines`, prisma/schema.prisma:2716–2738): **NO coa_code / category field at all.** Routines are scheduling-of-intent; they do not carry a category.
- COA model exists: yes — `coa_templates` (prisma/schema.prisma:99) and `coa_template_accounts` (prisma/schema.prisma:110). The COA *code* column is `code String @db.VarChar(10)` (line 113).
- Recommended naming for new column to match convention: **N/A — the column already exists as `coa_code String? @db.VarChar(50)` on operations_project_tasks (line 2614) and matches the operations-surface convention (snake_case, VarChar(50), indexed).** No new column needed.

C. EXISTING USAGE
- API routes that touch operations_project_tasks (6 files):
  * src/app/api/operations/projects/[id]/tasks/route.ts:56,160,168 — GET list, find-max display_order, POST create
  * src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts:35,107,345 — GET single, PATCH (reads/writes deadline, estimated_minutes, display_order, status, completed_at), DELETE
  * src/app/api/operations/projects/[id]/tasks/[taskId]/history/route.ts:35 — fetch task for history
  * src/app/api/operations/projects/[id]/tasks/[taskId]/uncomplete/route.ts:24 — load for uncomplete
  * src/app/api/operations/projects/[id]/tasks/bulk-create/route.ts:189,200 — bulk create + max display_order
  * src/app/api/operations/daily-plan/items/route.ts:166 — load task when scheduling it onto a daily plan
- Components that render task date/time/category (5 files surfaced):
  * src/components/workbench/operations/projects/TaskList.tsx — uses deadline/estimated_minutes (cited via grep, type Task imports)
  * src/components/workbench/operations/projects/TaskRow.tsx — renders deadline + estimated_minutes; carries scheduling UI (lines 79–83, 202–227, 325–360)
  * src/components/workbench/operations/projects/types.ts — Task type (includes deadline, estimated_minutes, display_order)
  * src/components/workbench/operations/dailyplan/DailyPlanItemRow.tsx — renders daily-plan side of the relation
  * src/components/workbench/operations/dailyplan/types.ts — daily-plan types
- `coa_code` rendered in operations UI: **NONE** — `grep -rn coa_code src/components/workbench/operations/` returns no matches. The column exists in the DB and Prisma schema but is not surfaced in any task UI yet.
- "Commit to calendar" UI already exists: **YES — a `↗ schedule` button is on TaskRow (src/components/workbench/operations/projects/TaskRow.tsx:325–360)** that POSTs `{ plan_date, task_id }` to `/api/operations/daily-plan/items` (handleSchedule, lines 202–227). This creates an `operations_daily_plan_items` row linked to the task. A subsequent step (creating an `operations_calendar_blocks` row with scheduled_start/scheduled_end on that daily_plan_item) does NOT yet have a UI surface — confirmed by no matches for `scheduled_start` / `scheduled_end` in src/components/workbench/operations/.

D. MIGRATION HISTORY
- Migrations that touched operations_project_tasks:
  * 20260507000000_pr_ops_1_schema_foundation — CREATE TABLE with 19 columns + FKs to operations_projects, users, entities + 4 indexes (project/status/order; user/status/priority; deadline; entity_id).
  * 20260514130000_pr_ops_3_8_task_link_notes — ADD COLUMN link_url TEXT, notes TEXT.
  * 20260516000000_pr_ops_4_0_daily_plan_schema — ADD COLUMN coa_code VARCHAR(50), actual_cost_usd DECIMAL(15,2), actual_minutes INT; CREATE INDEX on coa_code.
  * Other migrations referencing the model name only in comments (no ALTER): content_scenes (20260518500000), routine_steps (20260518300000).
- Migration provider: postgresql (confirmed at prisma/migrations/migration_lock.toml).

E. SQL FOR ALEX TO RUN LOCALLY

```sql
-- PR-Ops-5.1 Phase 1: Live-table audit for operations_project_tasks.
-- Run against the Azure Postgres instance to verify the live schema
-- matches the Prisma schema before Phase 2 considers a migration.

-- 1. Columns (name, type, nullability, default).
SELECT
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'operations_project_tasks'
ORDER BY ordinal_position;

-- 2. Indexes.
SELECT
  i.relname AS index_name,
  am.amname AS index_type,
  ix.indisunique AS is_unique,
  ix.indisprimary AS is_primary,
  pg_get_indexdef(ix.indexrelid) AS definition
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_am am ON i.relam = am.oid
WHERE t.relname = 'operations_project_tasks'
ORDER BY i.relname;

-- 3. Foreign keys (outgoing — i.e., FKs *on* operations_project_tasks).
SELECT
  tc.constraint_name,
  kcu.column_name AS local_column,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema   = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema    = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
 AND rc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name   = 'operations_project_tasks'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- 4. Row count (so we know the backfill blast-radius — if Phase 2 adds
--    a column, this is how many rows would land NULL or need backfill).
SELECT COUNT(*) AS total_rows FROM operations_project_tasks;

-- 5. Distribution of the relevant nullable columns, for context on
--    whether existing data already populates them.
SELECT
  COUNT(*)                                  AS total_rows,
  COUNT(deadline)                           AS rows_with_deadline,
  COUNT(estimated_minutes)                  AS rows_with_estimated_minutes,
  COUNT(actual_minutes)                     AS rows_with_actual_minutes,
  COUNT(coa_code)                           AS rows_with_coa_code,
  COUNT(DISTINCT coa_code)                  AS distinct_coa_codes_in_use
FROM operations_project_tasks;
```

F. RECOMMENDATIONS FOR PHASE 2

**Headline:** the migration the PR plan implies (add `expense_category` + `time_block_start/duration`) may be partially or fully UNNECESSARY. Alex should review before any DDL is drafted.

- **Expense-category column: already exists.** `operations_project_tasks.coa_code VARCHAR(50)` was added by migration `20260516000000_pr_ops_4_0_daily_plan_schema` and is indexed. It is NOT yet surfaced in any UI (no `coa_code` references in `src/components/workbench/operations/`). The Phase 2 work for category is therefore **UI-only**, not schema. Likely sub-items:
  * Render the column on TaskRow (read-only display + a `<select>` populated from the user's COA template — convention precedent: SectionC/D/RoutineList/RRULEBuilder all use `<select>` from operations).
  * Add `coa_code` to the PATCH allow-list in `src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts` (current PATCH only handles deadline, estimated_minutes, display_order, status, completed_at per :156–231 — `coa_code` is not in the allow-list).

- **Time-block columns: a design decision is owed before any migration.** Two architecturally different paths:
  * **Path A — denormalize onto the task row:** add `time_block_start TIMESTAMPTZ` + `time_block_duration_min INT` (or equivalent) directly to `operations_project_tasks`. Simple to query/render alongside other task fields. Creates a parallel data path to the existing chain.
  * **Path B — use the existing chain:** task → `operations_daily_plan_items` (already wired up via TaskRow's `↗ schedule` button) → `operations_calendar_blocks` (already has `scheduled_start`, `scheduled_end`, `actual_start`, `actual_end`, `status` — line 2658). No schema change needed; Phase 2 would be a *UI* addition: extend the existing `↗ schedule` flow to also set start/end times on a new calendar_block row, and render that block's window on the task.
  
  Path B preserves normalization (one task can have multiple scheduled occurrences across days) and reuses already-shipped tables. Path A is faster to ship but introduces redundant truth (which window wins if a task has both `time_block_start` AND a calendar_block?) and would require careful migration of any data added between Phase 2 and a future normalization.

- **Existing rows backfill:** If Path A is chosen, all existing task rows would be NULL on the new columns. The Phase 2 SQL audit (Section E, query 4) will give the exact count Alex needs. If Path B is chosen, no backfill is needed.

- **Concerns / ambiguities for Alex to resolve before Phase 2:**
  1. **Path A vs Path B for time-blocks.** This is the central design decision. The North-Star spec referenced ("Task Time-Block + Expense Category Columns") implies Path A. The existing schema (calendar_blocks + daily_plan_items + the live `↗ schedule` button on TaskRow) implies Path B. Choose explicitly.
  2. **`coa_code` surface choice.** Free-text VarChar(50) vs dropdown bound to `coa_template_accounts.code`. The existing column is free-text VarChar(50) — looser than `coa_template_accounts.code VarChar(10)`. If the UI uses a dropdown, values are guaranteed to be valid codes; if free-text, validation is the UI's job. No schema change either way.
  3. **PATCH allow-list expansion.** `coa_code` is not currently in the PATCH allow-list for tasks. Phase 2 must add it (one-line addition; safe).
  4. **If Path A wins:** the new column names should follow the operations snake_case convention (`time_block_start`, `time_block_duration_min` — both nullable). The `time_block_start` should be `Timestamptz(6)` to match `deadline`. An index on `(user_id, time_block_start)` would help calendar-window queries.

NO FILES WERE MODIFIED IN THIS PHASE.
