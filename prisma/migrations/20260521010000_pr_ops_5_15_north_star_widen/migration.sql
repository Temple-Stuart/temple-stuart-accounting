-- PR-Ops-5.15: widen overflowing North Star prose columns from VARCHAR → TEXT.
-- Fixes "value too long for the column's type" on operations_north_star.upsert()
-- when the user writes phrase-level life_stage descriptors that exceed VARCHAR(50).
--
-- Postgres 12+ widening from VARCHAR(n) → TEXT is METADATA-ONLY: no row rewrite,
-- no backfill, no table lock beyond the brief catalog update. Existing values
-- fit unchanged in the wider type.
--
-- current_timezone (VARCHAR(64)) is INTENTIONALLY left capped — IANA timezone
-- strings have a real upper bound near 30 chars; the cap is a soft-validation
-- hint, not an overflow risk.

BEGIN;

ALTER TABLE "operations_north_star"
  ALTER COLUMN "life_stage" TYPE text,
  ALTER COLUMN "current_location_label" TYPE text;

COMMIT;
