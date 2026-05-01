-- =============================================================================
-- PR-G: Extend AuditActionType enum with regulatory_document_* actions
-- =============================================================================
-- Adds three new values to the AuditActionType enum to support typed audit
-- log entries from the corpus ingestion workers (PR-G eCFR, future PR-H
-- U.S. Code, PR-I Federal Register, PR-J IRS publications, etc.).
--
-- Naming convention: matches the existing 'regulatory_source_*' prefix
-- pattern so downstream queries can filter by `action_type LIKE 'regulatory_%'`
-- to surface all corpus-related events.
--
-- New values:
--   regulatory_document_ingested        — emitted on every successful
--                                         insert into regulatory_documents
--   regulatory_document_superseded      — emitted when a prior version is
--                                         marked superseded by a new version
--   regulatory_ingest_run_completed     — emitted at the end of each
--                                         ingestion worker run (per-source)
--
-- Note on transaction wrapping: this migration intentionally omits explicit
-- BEGIN/COMMIT. Prisma's migrate deploy wraps each migration in its own
-- transaction. Some Postgres drivers historically have edge cases around
-- ALTER TYPE ADD VALUE inside an explicit nested transaction; the safest
-- and Postgres-documented preferred form is bare DDL with IF NOT EXISTS
-- for idempotency (PG 12+).
-- =============================================================================

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'regulatory_document_ingested';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'regulatory_document_superseded';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'regulatory_ingest_run_completed';
