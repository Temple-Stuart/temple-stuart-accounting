-- =============================================================================
-- PR-Ops-1.5: Operations North Star
-- =============================================================================
-- Adds the per-user mission anchor table for the Operations tab. One row per
-- user, edited frequently, hash-chained into audit_log on every mutation.
--
-- Single new table: operations_north_star
-- Three new AuditActionType values: operations_north_star_{created,updated,reviewed}
--
-- Naming and conventions follow PR-Ops-1 / PR-K precedent:
--   - Identifiers unquoted snake_case lowercase
--   - Enum types double-quoted PascalCase
--   - TIMESTAMPTZ for all timestamps
--   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--   - Cross-domain FKs (user_id) declared without Prisma @relation back-edges
--     in the schema layer (matches the missions / operations_* convention)
--
-- ALTER TYPE ADD VALUE intentionally NOT wrapped in BEGIN/COMMIT per the
-- PR-G/PR-K convention (Postgres driver edge cases on enum-extension inside
-- explicit transactions).
-- =============================================================================

-- PART 1: Table
BEGIN;

CREATE TABLE operations_north_star (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT NOT NULL,
  mission_statement         TEXT,
  life_stage                VARCHAR(50),
  core_values               TEXT[] NOT NULL DEFAULT '{}',
  guiding_principles        TEXT,
  one_year_target           TEXT,
  three_year_target         TEXT,
  current_location_label    VARCHAR(200),
  current_timezone          VARCHAR(64) NOT NULL DEFAULT 'America/Los_Angeles',
  review_cadence_days       INTEGER NOT NULL DEFAULT 90,
  last_reviewed_at          TIMESTAMPTZ,
  next_review_at            TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                TEXT,
  CONSTRAINT operations_north_star_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT operations_north_star_user_id_key
    UNIQUE (user_id),
  CONSTRAINT operations_north_star_review_cadence_positive
    CHECK (review_cadence_days > 0)
);

-- The user_id UNIQUE constraint already creates a btree index on user_id;
-- only the next-review staleness index is added here.
CREATE INDEX operations_north_star_next_review_idx
  ON operations_north_star (next_review_at);

COMMENT ON TABLE operations_north_star IS
  'Per-user mission anchor. One row per user; mutations hash-chain into '
  'audit_log via operations_north_star_updated/created/reviewed action types. '
  'Row is never deleted; "clearing" the north star means editing fields to empty.';
COMMENT ON COLUMN operations_north_star.life_stage IS
  'Free-text life-stage label chosen by the user (e.g. "building", "scaling", '
  '"transitioning"). Deliberately not enum-typed: subjective field, no fixed taxonomy.';
COMMENT ON COLUMN operations_north_star.core_values IS
  'Ordered list of self-selected core values. Mirrors framework_mappings precedent.';
COMMENT ON COLUMN operations_north_star.review_cadence_days IS
  'Days between scheduled reviews. Default 90 = Bridgewater quarterly principle '
  'review cycle. Citadel-style monthly = 30. CHECK > 0 prevents disabling reviews.';
COMMENT ON COLUMN operations_north_star.last_reviewed_at IS
  'When the user last attested "I read this and it still holds." Distinct from '
  'updated_at, which captures any field change. NULL until first review.';
COMMENT ON COLUMN operations_north_star.next_review_at IS
  'Materialized in app code as last_reviewed_at + review_cadence_days. '
  'Index-backed staleness detection.';
COMMENT ON COLUMN operations_north_star.current_timezone IS
  'IANA timezone, drives "Today" computation in the Daily Plan section. '
  'Default America/Los_Angeles matches operations_routines convention.';

COMMIT;

-- =============================================================================
-- PART 2: AuditActionType enum extensions (must run outside transaction)
-- IF NOT EXISTS guards make this idempotent.
-- =============================================================================

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_north_star_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_north_star_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_north_star_reviewed';
