-- PR-Ops-4.8.6a: routine sub-steps foundation
--
-- Adds operations_routine_steps with denormalized user_id + entity_id
-- (matches operations_project_tasks precedent for defensive-404 ownership).
--
-- time_of_day is @db.Time, NULLABLE — operator can leave blank.
-- Frontend (4.8.6c) auto-fills empty steps from parent routine.start_time
-- with a 15-minute interval per step_order.
--
-- ISO serialization gotcha: Prisma maps @db.Time to JS Date; JSON arrives as
-- '1970-01-01THH:MM:SS.000Z'. Frontend must .slice(11, 16) to extract HH:MM.

BEGIN;

CREATE TABLE "operations_routine_steps" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "routine_id"        UUID NOT NULL,
  "user_id"           TEXT NOT NULL,
  "entity_id"         TEXT NOT NULL,
  "step_order"        INT NOT NULL DEFAULT 0,
  "time_of_day"       TIME,
  "activity"          VARCHAR(200) NOT NULL,
  "sub_activity"      VARCHAR(200),
  "location"          VARCHAR(200),
  "duration_minutes"  INT,
  "notes"             TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_by"        TEXT,
  CONSTRAINT "operations_routine_steps_routine_fkey"
    FOREIGN KEY ("routine_id") REFERENCES "operations_routines"("id") ON DELETE CASCADE
);

CREATE INDEX "operations_routine_steps_routine_order_idx" ON "operations_routine_steps"("routine_id", "step_order");
CREATE INDEX "operations_routine_steps_routine_idx" ON "operations_routine_steps"("routine_id");
CREATE INDEX "operations_routine_steps_user_idx" ON "operations_routine_steps"("user_id");

COMMIT;
