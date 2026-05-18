-- PR-Ops-4.8.5: add intent-window timing to operations_routines
-- start_time / end_time are timezone-naive TIME columns interpreted in
-- the routine's timezone. They are INTENT METADATA, not scheduling anchors —
-- the RRULE (schedule_rrule) remains the source of truth for when occurrences fire.
--
-- NULL/NULL preserves current "no window specified" behavior.
-- Overnight windows (e.g., 23:00-01:00) are NOT supported; CHECK enforces non-overnight.

BEGIN;

ALTER TABLE "operations_routines"
  ADD COLUMN "start_time" TIME,
  ADD COLUMN "end_time"   TIME;

ALTER TABLE "operations_routines"
  ADD CONSTRAINT "operations_routines_time_window_check"
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time);

COMMIT;
