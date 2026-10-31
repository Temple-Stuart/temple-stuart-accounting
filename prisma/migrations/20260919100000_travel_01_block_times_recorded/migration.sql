-- TRAVEL-01 (2026-09-19) — THE ITINERARY'S TIME-BLOCK COLUMNS, RECORDED.
--
-- trip_itinerary.recurrence / block_start_time / block_end_time / coa_code /
-- vendor_name, and entity_id on trips and budget_line_items, were created by
-- prisma/migrations-manual/itinerary_time_blocks.sql (run by hand) and never
-- recorded here, while schema.prisma has declared them since. vendor-commit
-- writes the window on every lodging/activity commit, so production has them;
-- this migration RECORDS them and is a no-op where they exist. Every statement
-- is IF NOT EXISTS. Nothing is defaulted onto an existing row: recurrence's
-- 'once' default is the manual SQL's own; the window columns stay NULL.
--
-- Alex, before merging, confirm on Azure:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'trip_itinerary'
--      AND column_name IN ('recurrence', 'block_start_time', 'block_end_time', 'coa_code', 'vendor_name');
-- Five rows expected. Fewer → this migration creates the missing ones at deploy.

ALTER TABLE "trip_itinerary"
  ADD COLUMN IF NOT EXISTS "recurrence"       VARCHAR(10) NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS "block_start_time" TIME(6),
  ADD COLUMN IF NOT EXISTS "block_end_time"   TIME(6),
  ADD COLUMN IF NOT EXISTS "coa_code"         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "vendor_name"      VARCHAR(255);

ALTER TABLE "trips"
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT;

ALTER TABLE "budget_line_items"
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT;

CREATE INDEX IF NOT EXISTS "trip_itinerary_recurrence_idx"
  ON "trip_itinerary" ("tripId", "recurrence");
