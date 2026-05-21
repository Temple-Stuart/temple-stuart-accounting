-- PR-Ops-5.13: routine cost capture (estimated_cost_usd + coa_code)
-- Additive only. Both columns nullable. No backfill. Mirrors the field
-- shape on operations_project_tasks exactly (estimated_cost_usd
-- @db.Decimal(15,2), coa_code @db.VarChar(50), index on coa_code).
-- Clean-slate context: Alex cleared all routines, so this runs against
-- zero rows. Reversible via two DROP COLUMNs.

BEGIN;

ALTER TABLE "operations_routines"
  ADD COLUMN "estimated_cost_usd" NUMERIC(15, 2),
  ADD COLUMN "coa_code"           VARCHAR(50);

CREATE INDEX "operations_routines_coa_code_idx"
  ON "operations_routines" ("coa_code");

COMMIT;
