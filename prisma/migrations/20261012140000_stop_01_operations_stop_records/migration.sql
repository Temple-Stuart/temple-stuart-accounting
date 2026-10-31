-- STOP-01 (2026-10-12) — THE RECORD AT A STOP: what happened at one stop of one day.
--
-- The day card (/tasks/day) lists a day's STOPS — one per line of each routine
-- that occurs that day, one for a routine with no lines — each with the amount
-- the Budget plans for it. Until now nothing recorded what happened AT a stop:
-- the routine's completion marks every line of it at once, the Books post days
-- after the day and never for cash. This table is the record of one stop: when
-- it was done (or that it was skipped, and why), what was actually paid, a
-- rating, a note, the minutes. The founder types it on the step he films.
--
-- THE ADDRESS is the Budget's own (src/lib/budget/days.ts OccurrenceAddress,
-- the planned_item_vendors pattern): exactly one of step_id (a routine's line,
-- kind 'routine_line') or routine_id (a routine with no lines, kind 'routine'),
-- and the occurrence INSTANT — never a calendar day, which would miss a 07:00
-- occurrence in another zone. A task's record is the task's own row
-- (operations_project_tasks.actual_cost_usd, actual_minutes, completed_at) —
-- one fact, one home — so no task column exists here.
--
-- HELD HERE, NOT BY CONVENTION (STEP 1 CHECKs): exactly one plan column; an
-- outcome of done or skipped; done_at set exactly when done; a skipped stop
-- carries its reason; a note that is not blank; cents 0 or more (0 is a price —
-- a free thing — NULL is not typed); a rating 1–5; minutes within a day. One
-- record per (plan, occurrence): two PARTIAL unique indexes (STEP 2), one per
-- plan column — Prisma cannot express them, so this file holds them (the
-- VENDOR-01 precedent). The route refuses a second record by name before any
-- write; the index is the backstop for a race.
--
-- onDelete: a plan's records go with the plan (CASCADE — every set and clear is
-- in the audit log, which keeps them); a deleted user's rows go with them.
--
-- The two AuditActionType values name a set (created or changed) and a clear
-- (STEP 3), added the STAY-01 way. A new enum value cannot be USED in the
-- transaction that added it; nothing here uses them.
--
-- AUTHORED here, applied at deploy (package.json:11 runs prisma migrate deploy
-- before next build). NO BACKFILL: no record existed before this table.

-- STEP 1 — the table.
CREATE TABLE "operations_stop_records" (
  "id"             UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        TEXT           NOT NULL,
  "routine_id"     UUID,
  "step_id"        UUID,
  "occurrence_at"  TIMESTAMPTZ(6) NOT NULL,
  "outcome"        VARCHAR(10)    NOT NULL,
  "done_at"        TIMESTAMPTZ(6),
  "actual_cents"   INTEGER,
  "rating"         SMALLINT,
  "note"           VARCHAR(280),
  "actual_minutes" INTEGER,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operations_stop_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operations_stop_records_one_plan" CHECK (num_nonnulls("routine_id", "step_id") = 1),
  CONSTRAINT "operations_stop_records_outcome" CHECK ("outcome" IN ('done', 'skipped')),
  CONSTRAINT "operations_stop_records_done_at_iff_done" CHECK (("done_at" IS NOT NULL) = ("outcome" = 'done')),
  CONSTRAINT "operations_stop_records_skip_has_reason" CHECK ("outcome" <> 'skipped' OR "note" IS NOT NULL),
  CONSTRAINT "operations_stop_records_note_not_blank" CHECK ("note" IS NULL OR length(btrim("note")) > 0),
  CONSTRAINT "operations_stop_records_cents_not_negative" CHECK ("actual_cents" IS NULL OR "actual_cents" >= 0),
  CONSTRAINT "operations_stop_records_rating_1_to_5" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5)),
  CONSTRAINT "operations_stop_records_minutes_in_a_day" CHECK ("actual_minutes" IS NULL OR ("actual_minutes" BETWEEN 0 AND 1440))
);

ALTER TABLE "operations_stop_records"
  ADD CONSTRAINT "operations_stop_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operations_stop_records"
  ADD CONSTRAINT "operations_stop_records_routine_id_fkey"
  FOREIGN KEY ("routine_id") REFERENCES "operations_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "operations_stop_records"
  ADD CONSTRAINT "operations_stop_records_step_id_fkey"
  FOREIGN KEY ("step_id") REFERENCES "operations_routine_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "operations_stop_records_user_id_occurrence_at_idx" ON "operations_stop_records"("user_id", "occurrence_at");

-- STEP 2 — one record per (plan, occurrence).
CREATE UNIQUE INDEX "operations_stop_records_routine_occurrence_key" ON "operations_stop_records"("routine_id", "occurrence_at") WHERE "routine_id" IS NOT NULL;
CREATE UNIQUE INDEX "operations_stop_records_step_occurrence_key" ON "operations_stop_records"("step_id", "occurrence_at") WHERE "step_id" IS NOT NULL;

-- STEP 3 — the audit vocabulary.
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stop_set';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stop_cleared';
