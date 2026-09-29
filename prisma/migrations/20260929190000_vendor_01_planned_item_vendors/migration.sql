-- VENDOR-01 (2026-09-29) — THE VENDOR IS PLANNED: who a plan's money is paid to.
--
-- A plan — a routine, a routine's line (operations_routine_steps) or a project
-- task — carries an amount and an account and, until this table, nothing that
-- named who is paid. The vendor is a row of the ONE vendor list,
-- operations_vendor_directory (DIM-1), of the plan's own book.
--
-- TWO GRAINS, NEVER BOTH. occurrence_at NULL is the vendor for EVERY occurrence
-- of the plan (a subscription: always the same company). occurrence_at SET is the
-- vendor for ONE occurrence (a meal: today's lunch at one place, tomorrow's at
-- another), keyed on its INSTANT exactly as a posting's link is
-- (planned_item_links.target_instant, LINK-01 STEP 1; a line's occurrence on
-- (line id, instant), LINES-01 STEP 3). A plan holding one grain refuses the
-- other, so no reader ever chooses between two vendors. A task happens once: its
-- row never carries an instant.
--
-- HELD HERE, NOT BY CONVENTION: exactly one plan column (STEP 2); no instant on a
-- task row (STEP 2); one every-occurrence row per plan and one row per (plan,
-- occurrence) — partial unique indexes Prisma cannot express (STEP 3, the
-- journal_entries precedent, schema :209); the grain, by a trigger that locks the
-- plan's own row FOR NO KEY UPDATE before it reads, so two concurrent writes to
-- one plan cannot both pass (STEP 4). FOR NO KEY UPDATE, not FOR UPDATE: it
-- serialises two vendor writes on one plan and does not block the FOR KEY SHARE a
-- foreign-key check takes on that row. Its message starts with the fixed tag
-- PLAN_VENDOR_GRAIN, which the one writing route recognises
-- (src/lib/operations/planVendor.ts GRAIN_TAG).
--
-- onDelete: a plan's vendor goes with the plan (CASCADE — every set and clear is
-- in the audit log); a vendor a plan names cannot vanish (RESTRICT); a deleted
-- user's rows go with them (CASCADE).
--
-- The two AuditActionType values name a set and a clear (STEP 6), added the
-- LINK-02 way. A new enum value cannot be USED in the transaction that added it;
-- nothing here uses them.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; this applies at
-- deploy after merge (package.json:11 runs prisma migrate deploy), or Alex runs it
-- via psql as plain statements. NO BACKFILL: no plan named a vendor before this
-- table.

-- STEP 1: the table.
CREATE TABLE "planned_item_vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "routine_id" UUID,
    "step_id" UUID,
    "task_id" UUID,
    "occurrence_at" TIMESTAMPTZ(6),
    "vendor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planned_item_vendors_pkey" PRIMARY KEY ("id")
);

-- STEP 2: the plan is exactly one of the three, and a task has no occurrence.
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_one_plan"
  CHECK (num_nonnulls("routine_id", "step_id", "task_id") = 1);
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_task_every_occurrence"
  CHECK ("task_id" IS NULL OR "occurrence_at" IS NULL);

-- STEP 3: ONE VENDOR PER ADDRESS. Per plan column: one every-occurrence row, and
-- one row per (plan, occurrence). The second index's predicate names the plan
-- column only, so it also serves a plan's reads and its cascade.
CREATE UNIQUE INDEX "planned_item_vendors_routine_every_key" ON "planned_item_vendors"("routine_id") WHERE "routine_id" IS NOT NULL AND "occurrence_at" IS NULL;
CREATE UNIQUE INDEX "planned_item_vendors_step_every_key" ON "planned_item_vendors"("step_id") WHERE "step_id" IS NOT NULL AND "occurrence_at" IS NULL;
CREATE UNIQUE INDEX "planned_item_vendors_task_every_key" ON "planned_item_vendors"("task_id") WHERE "task_id" IS NOT NULL AND "occurrence_at" IS NULL;
CREATE UNIQUE INDEX "planned_item_vendors_routine_occurrence_key" ON "planned_item_vendors"("routine_id", "occurrence_at") WHERE "routine_id" IS NOT NULL;
CREATE UNIQUE INDEX "planned_item_vendors_step_occurrence_key" ON "planned_item_vendors"("step_id", "occurrence_at") WHERE "step_id" IS NOT NULL;
CREATE UNIQUE INDEX "planned_item_vendors_task_occurrence_key" ON "planned_item_vendors"("task_id", "occurrence_at") WHERE "task_id" IS NOT NULL;

-- STEP 4: THE GRAIN. A row whose plan already holds rows of the other grain is
-- refused — after the plan's own row is locked, so a concurrent write to the same
-- plan waits here and then reads what the first one committed.
CREATE FUNCTION "planned_item_vendors_one_grain"() RETURNS TRIGGER AS $$
DECLARE
  other_grain integer;
BEGIN
  IF NEW."routine_id" IS NOT NULL THEN
    PERFORM 1 FROM "operations_routines" WHERE "id" = NEW."routine_id" FOR NO KEY UPDATE;
  END IF;
  IF NEW."step_id" IS NOT NULL THEN
    PERFORM 1 FROM "operations_routine_steps" WHERE "id" = NEW."step_id" FOR NO KEY UPDATE;
  END IF;
  IF NEW."task_id" IS NOT NULL THEN
    PERFORM 1 FROM "operations_project_tasks" WHERE "id" = NEW."task_id" FOR NO KEY UPDATE;
  END IF;

  SELECT count(*) INTO other_grain
    FROM "planned_item_vendors" v
   WHERE v."id" <> NEW."id"
     AND ((NEW."routine_id" IS NOT NULL AND v."routine_id" = NEW."routine_id")
       OR (NEW."step_id" IS NOT NULL AND v."step_id" = NEW."step_id")
       OR (NEW."task_id" IS NOT NULL AND v."task_id" = NEW."task_id"))
     AND ((v."occurrence_at" IS NULL) <> (NEW."occurrence_at" IS NULL));

  IF other_grain > 0 THEN
    IF NEW."occurrence_at" IS NULL THEN
      RAISE EXCEPTION 'PLAN_VENDOR_GRAIN: this plan holds a vendor for % single occurrence(s) — clear them before setting one vendor for every occurrence', other_grain
        USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION 'PLAN_VENDOR_GRAIN: this plan holds a vendor for every occurrence — clear it before choosing one for a single occurrence'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "planned_item_vendors_one_grain"
  BEFORE INSERT OR UPDATE ON "planned_item_vendors"
  FOR EACH ROW EXECUTE FUNCTION "planned_item_vendors_one_grain"();

-- STEP 5: the reads — a user's day of occurrences, and a vendor's plans.
CREATE INDEX "planned_item_vendors_user_id_occurrence_at_idx" ON "planned_item_vendors"("user_id", "occurrence_at");
CREATE INDEX "planned_item_vendors_vendor_id_idx" ON "planned_item_vendors"("vendor_id");

-- STEP 6: the foreign keys — the plan's vendor goes with the plan; a named vendor
-- cannot vanish.
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "operations_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "operations_routine_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "operations_project_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "operations_vendor_directory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STEP 7: a set and a clear are audited.
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_plan_vendor_set';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_plan_vendor_cleared';
