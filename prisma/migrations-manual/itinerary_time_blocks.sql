-- Itinerary-as-time-blocks foundation (schema only; NO behavior change).
-- Alex runs this via psql BEFORE the schema PR merges (migration-before-merge).
-- Idempotent: every statement is IF NOT EXISTS so a re-run is a no-op.
--
-- Adds to trip_itinerary: recurrence class (once/daily), a daily time-of-day
-- window (TIME, distinct from the date range), a per-item COA code, and a vendor
-- name distinct from the activity/item name. Adds entity_id to trips and
-- budget_line_items for the future Travel entity. Nothing reads/writes these yet.

ALTER TABLE trip_itinerary
  ADD COLUMN IF NOT EXISTS recurrence VARCHAR(10) NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS block_start_time TIME(6),
  ADD COLUMN IF NOT EXISTS block_end_time TIME(6),
  ADD COLUMN IF NOT EXISTS coa_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS entity_id TEXT;

ALTER TABLE budget_line_items
  ADD COLUMN IF NOT EXISTS entity_id TEXT;

CREATE INDEX IF NOT EXISTS trip_itinerary_recurrence_idx
  ON trip_itinerary ("tripId", recurrence);
