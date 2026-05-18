-- PR-Ops-4.8.3: add optional date bounds to operations_routines
-- NULL/NULL preserves current "perpetually active" behavior for all existing rows

BEGIN;

ALTER TABLE "operations_routines"
  ADD COLUMN "start_date" DATE,
  ADD COLUMN "end_date"   DATE;

ALTER TABLE "operations_routines"
  ADD CONSTRAINT "operations_routines_bounds_check"
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);

COMMIT;
