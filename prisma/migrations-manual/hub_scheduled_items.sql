-- PR-HCR2 — Hub master calendar foundation
-- New enum: ScheduleCadence
-- New table: hub_scheduled_items (the unifying 12-column master-calendar row)
--
-- ADDITIVE ONLY (CREATE TYPE + CREATE TABLE + indexes). No ALTER/DROP of existing
-- objects. Run this BEFORE merging the schema.prisma change (migration-before-merge).
-- CREATE TYPE must run before CREATE TABLE (the table references the enum).
--
-- Type/ref decisions per audit-reports/HCR2-SCHEMA-AUDIT.md:
--   • id = UUID (operations PK convention: Prisma @default(uuid()) ↔ SQL gen_random_uuid()).
--   • user_id / entity_id = TEXT soft refs (entities.id + users.id are TEXT, not uuid;
--     and operations_* keep these as bare columns with NO FK constraint — mirrored here).
--   • project_id / routine_id / task_id / routine_step_id = UUID real FKs
--     (operations_* PKs are uuid), ON DELETE SET NULL (the schedule row survives).
--   • coa_code = VARCHAR(50) soft ref to chart_of_accounts.code — NO FK (mirrors
--     operations_project_tasks.coa_code).
--   • budget_usd / actual_usd = DECIMAL(15,2) USD (matches operations_project_tasks
--     estimated_cost_usd / actual_cost_usd) — NOT cents.
--   • starts_at TIMESTAMPTZ NOT NULL + ends_at TIMESTAMPTZ NULL (matches
--     operations_calendar_blocks.scheduled_start / scheduled_end).
--   • Required: user_id, entity_id, cadence, starts_at, is_billable. Everything else
--     nullable (truth principle — never fake a link).

BEGIN;

-- 1. New cadence enum (modeled like RefreshCadence). Order matches schema.prisma.
CREATE TYPE "ScheduleCadence" AS ENUM ('daily', 'weekly', 'monthly', 'one_time');

-- 2. hub_scheduled_items
CREATE TABLE "hub_scheduled_items" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          TEXT NOT NULL,
  "entity_id"        TEXT NOT NULL,
  "starts_at"        TIMESTAMPTZ NOT NULL,
  "ends_at"          TIMESTAMPTZ,
  "cadence"          "ScheduleCadence" NOT NULL,
  "rrule"            TEXT,
  "coa_code"         VARCHAR(50),
  "project_id"       UUID,
  "routine_id"       UUID,
  "task_id"          UUID,
  "routine_step_id"  UUID,
  "is_billable"      BOOLEAN NOT NULL DEFAULT FALSE,
  "budget_usd"       DECIMAL(15, 2),
  "actual_usd"       DECIMAL(15, 2),
  "description"      TEXT,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- At most one of project_id / routine_id (a row is for a project OR a routine).
  CONSTRAINT "hub_scheduled_items_project_xor_routine_check"
    CHECK ( (("project_id" IS NOT NULL)::int + ("routine_id" IS NOT NULL)::int) <= 1 ),
  -- At most one of task_id / routine_step_id (the specific thing is a task OR a step).
  CONSTRAINT "hub_scheduled_items_task_xor_step_check"
    CHECK ( (("task_id" IS NOT NULL)::int + ("routine_step_id" IS NOT NULL)::int) <= 1 ),
  -- ends_at, when present, must be after starts_at (nullable-aware; mirrors
  -- operations_calendar_blocks_time_check).
  CONSTRAINT "hub_scheduled_items_time_check"
    CHECK ( "ends_at" IS NULL OR "ends_at" > "starts_at" ),
  -- Real FKs to the operations tables (uuid PKs); SetNull keeps the schedule row.
  CONSTRAINT "hub_scheduled_items_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "operations_projects"("id") ON DELETE SET NULL,
  CONSTRAINT "hub_scheduled_items_routine_id_fkey"
    FOREIGN KEY ("routine_id") REFERENCES "operations_routines"("id") ON DELETE SET NULL,
  CONSTRAINT "hub_scheduled_items_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "operations_project_tasks"("id") ON DELETE SET NULL,
  CONSTRAINT "hub_scheduled_items_routine_step_id_fkey"
    FOREIGN KEY ("routine_step_id") REFERENCES "operations_routine_steps"("id") ON DELETE SET NULL
);

-- 3. Indexes (the calendar feed queries by user + date range; plus the link cols).
CREATE INDEX "hub_scheduled_items_user_starts_idx" ON "hub_scheduled_items"("user_id", "starts_at");
CREATE INDEX "hub_scheduled_items_entity_idx"      ON "hub_scheduled_items"("entity_id");
CREATE INDEX "hub_scheduled_items_coa_code_idx"    ON "hub_scheduled_items"("coa_code");
CREATE INDEX "hub_scheduled_items_project_idx"     ON "hub_scheduled_items"("project_id");
CREATE INDEX "hub_scheduled_items_routine_idx"     ON "hub_scheduled_items"("routine_id");

COMMIT;

-- VERIFY (run after COMMIT):
--   \d hub_scheduled_items
-- Expect: 19 columns, PK on id, cadence of type ScheduleCadence, 4 FKs
--   (project/routine/task/routine_step), 3 CHECK constraints
--   (project_xor_routine, task_xor_step, time), and 5 indexes.
