-- PR-HCR2-cols — travel-item columns on the master calendar table
-- Adds vendor / item_type / trip_id / provider_ref to hub_scheduled_items so a
-- flight/hotel/activity can live here as a master budget/calendar line.
--
-- ADDITIVE ONLY: ADD COLUMN x4 (all NULLABLE — existing rows are unaffected) + one
-- CHECK + one FK + one index. No ALTER of existing columns, no DROP, no NOT NULL.
-- Run this BEFORE merging the schema.prisma change (migration-before-merge).
--
-- Type decisions per audit-reports/BUDGET-PAY-UNIFY-AUDIT.md + the schema:
--   • trip_id = TEXT (trips.id is `String @default(cuid())` → text, NOT uuid). Real
--     FK to trips(id) ON DELETE SET NULL — mirrors budget_line_items.tripId (the
--     closest analog: a budget line optionally linked to a trip; the row survives a
--     trip delete, the link just clears).
--   • item_type = VARCHAR(20) with a nullable CHECK (the travel types, or NULL for
--     non-travel rows) — mirrors the entity_type VARCHAR+CHECK pattern.
--   • vendor / provider_ref = plain nullable VARCHAR(255).

BEGIN;

-- 1. The four new columns (all nullable).
ALTER TABLE "hub_scheduled_items"
  ADD COLUMN "vendor"       VARCHAR(255),
  ADD COLUMN "item_type"    VARCHAR(20),
  ADD COLUMN "trip_id"      TEXT,
  ADD COLUMN "provider_ref" VARCHAR(255);

-- 2. item_type soft enum — NULL (non-travel) or one of the known travel types.
--    Adding a new type later (e.g. 'insurance') is a one-line ALTER of this CHECK.
ALTER TABLE "hub_scheduled_items"
  ADD CONSTRAINT "hub_scheduled_items_item_type_check"
  CHECK ("item_type" IS NULL OR "item_type" IN ('flight', 'hotel', 'lodging', 'activity', 'transfer', 'vehicle'));

-- 3. trip_id → trips(id). trips.id is a cuid TEXT, so trip_id is TEXT. SetNull keeps
--    the master row when its trip is deleted (mirrors budget_line_items.tripId).
ALTER TABLE "hub_scheduled_items"
  ADD CONSTRAINT "hub_scheduled_items_trip_id_fkey"
  FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL;

-- 4. Index — the budget feed will query master lines by trip.
CREATE INDEX "hub_scheduled_items_trip_idx" ON "hub_scheduled_items"("trip_id");

COMMIT;

-- VERIFY (run after COMMIT):
--   \d hub_scheduled_items
-- Expect: 4 new columns (vendor VARCHAR(255), item_type VARCHAR(20), trip_id TEXT,
--   provider_ref VARCHAR(255)), a new CHECK (item_type), a new FK
--   (hub_scheduled_items_trip_id_fkey → trips), and a new index
--   (hub_scheduled_items_trip_idx). Existing columns/constraints unchanged.
