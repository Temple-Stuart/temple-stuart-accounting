-- Trip itinerary audit action types.
-- Alex runs this via psql BEFORE the schema PR merges (migration-before-merge).
--
-- LOCKED RULE: `ALTER TYPE ... ADD VALUE` cannot run inside a BEGIN/COMMIT
-- transaction block (Postgres restriction). These are therefore BARE statements
-- — do NOT wrap them in BEGIN/COMMIT. Each is IF NOT EXISTS, so a re-run is a
-- no-op (and ADD VALUE IF NOT EXISTS is itself non-transactional-safe).

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'trip_itinerary_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'trip_itinerary_committed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'trip_itinerary_uncommitted';
