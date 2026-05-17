-- PR-Ops-4.0 Daily Plan Schema Foundation
-- New tables: operations_daily_plan_items, operations_calendar_blocks, operations_task_status_history
-- New enum: CalendarBlockStatus
-- Modifications to operations_project_tasks: coa_code, actual_cost_usd, actual_minutes

BEGIN;

-- 1. New enum for calendar block status
CREATE TYPE "CalendarBlockStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'missed', 'cancelled');

-- 2. operations_daily_plan_items
CREATE TABLE "operations_daily_plan_items" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"             TEXT NOT NULL,
  "entity_id"           TEXT NOT NULL,
  "plan_date"           DATE NOT NULL,
  "task_id"             UUID,
  "ad_hoc_title"        VARCHAR(500),
  "ad_hoc_description"  TEXT,
  "display_order"       INT NOT NULL DEFAULT 0,
  "notes"               TEXT,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by"          TEXT,
  CONSTRAINT "operations_daily_plan_items_task_or_adhoc_check"
    CHECK ("task_id" IS NOT NULL OR "ad_hoc_title" IS NOT NULL),
  CONSTRAINT "operations_daily_plan_items_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "operations_project_tasks"("id") ON DELETE SET NULL
);
CREATE INDEX "operations_daily_plan_items_user_date_idx" ON "operations_daily_plan_items"("user_id", "plan_date");
CREATE INDEX "operations_daily_plan_items_task_idx" ON "operations_daily_plan_items"("task_id");
CREATE INDEX "operations_daily_plan_items_entity_idx" ON "operations_daily_plan_items"("entity_id");

-- 3. operations_calendar_blocks
CREATE TABLE "operations_calendar_blocks" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"              TEXT NOT NULL,
  "entity_id"            TEXT NOT NULL,
  "daily_plan_item_id"   UUID NOT NULL,
  "scheduled_start"      TIMESTAMPTZ NOT NULL,
  "scheduled_end"        TIMESTAMPTZ NOT NULL,
  "actual_start"         TIMESTAMPTZ,
  "actual_end"           TIMESTAMPTZ,
  "status"               "CalendarBlockStatus" NOT NULL DEFAULT 'scheduled',
  "notes"                TEXT,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by"           TEXT,
  CONSTRAINT "operations_calendar_blocks_plan_item_fkey"
    FOREIGN KEY ("daily_plan_item_id") REFERENCES "operations_daily_plan_items"("id") ON DELETE CASCADE,
  CONSTRAINT "operations_calendar_blocks_time_check"
    CHECK ("scheduled_end" > "scheduled_start")
);
CREATE INDEX "operations_calendar_blocks_user_time_idx" ON "operations_calendar_blocks"("user_id", "scheduled_start", "scheduled_end");
CREATE INDEX "operations_calendar_blocks_plan_item_idx" ON "operations_calendar_blocks"("daily_plan_item_id");

-- 4. operations_task_status_history
CREATE TABLE "operations_task_status_history" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id"          UUID NOT NULL,
  "user_id"          TEXT NOT NULL,
  "previous_status"  "OperationsTaskStatus",
  "new_status"       "OperationsTaskStatus" NOT NULL,
  "changed_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "changed_by"       TEXT,
  "reason"           TEXT,
  CONSTRAINT "operations_task_status_history_task_fkey"
    FOREIGN KEY ("task_id") REFERENCES "operations_project_tasks"("id") ON DELETE CASCADE
);
CREATE INDEX "operations_task_status_history_task_idx" ON "operations_task_status_history"("task_id", "changed_at" DESC);
CREATE INDEX "operations_task_status_history_user_idx" ON "operations_task_status_history"("user_id", "changed_at" DESC);

-- 5. operations_project_tasks additions
ALTER TABLE "operations_project_tasks"
  ADD COLUMN "coa_code"         VARCHAR(50),
  ADD COLUMN "actual_cost_usd"  DECIMAL(15, 2),
  ADD COLUMN "actual_minutes"   INT;

CREATE INDEX "operations_project_tasks_coa_code_idx" ON "operations_project_tasks"("coa_code");

COMMIT;
