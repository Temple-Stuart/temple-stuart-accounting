-- PR-Ops-5.18: fix project/task delete by changing the daily-plan→task FK
-- from ON DELETE SET NULL to ON DELETE CASCADE.
--
-- ROOT CAUSE (PR-Ops-5.18 Phase 1 audit): operations_daily_plan_items has
--   CHECK ("task_id" IS NOT NULL OR "ad_hoc_title" IS NOT NULL)
-- but its task_id FK was ON DELETE SET NULL. Deleting a task that's on the
-- Daily Plan (task-linked item: task_id set, ad_hoc_title NULL) — directly
-- or via the project→tasks CASCADE — fired SET NULL, leaving task_id NULL
-- AND ad_hoc_title NULL, violating the CHECK and aborting the whole delete.
--
-- CASCADE makes the schema self-consistent: a task-linked daily-plan item
-- is deleted with its task (its calendar_blocks already cascade from the
-- item via operations_calendar_blocks_plan_item_fkey ON DELETE CASCADE).
-- The CHECK is never re-evaluated because the row is removed, not null-set.
--
-- ON UPDATE CASCADE matches what Prisma expects for this relation once
-- schema.prisma declares onDelete: Cascade (Prisma defaults onUpdate to
-- Cascade); the original hand-written FK omitted ON UPDATE (implicit
-- NO ACTION) — this aligns the DB with the Prisma client.

BEGIN;

ALTER TABLE "operations_daily_plan_items"
  DROP CONSTRAINT "operations_daily_plan_items_task_id_fkey";

ALTER TABLE "operations_daily_plan_items"
  ADD CONSTRAINT "operations_daily_plan_items_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "operations_project_tasks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
