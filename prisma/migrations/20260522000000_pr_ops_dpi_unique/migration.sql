-- PR-Ops-DPI-Unique: one daily-plan item per (task, day).
--
-- Forbids duplicate task-linked items for the same task on the same day,
-- which the Hub assign find-or-create + the UI in-flight-disable can only
-- guard softly (a two-request race can pass find-or-create and double-insert).
-- This is the hard guarantee behind that race.
--
-- Ad-hoc items (task_id NULL) stay UNCONSTRAINED: Postgres treats NULLs as
-- distinct in a composite unique index, so multiple ad-hoc items per day
-- remain legitimate. No user_id in the key — task_id implies exactly one user
-- (operations_project_tasks.user_id is non-null, no share model).
--
-- Index name matches Prisma's @@unique([task_id, plan_date]) default
-- (<table>_<col1>_<col2>_key) so schema.prisma and the DB agree with zero drift.
-- Plain CREATE UNIQUE INDEX (not CONCURRENTLY) — migrate deploy runs in a txn.
-- Prod dupe-check returned 0 rows (Alex), so this will not abort.

BEGIN;

CREATE UNIQUE INDEX "operations_daily_plan_items_task_id_plan_date_key"
  ON "operations_daily_plan_items" ("task_id", "plan_date");

COMMIT;
