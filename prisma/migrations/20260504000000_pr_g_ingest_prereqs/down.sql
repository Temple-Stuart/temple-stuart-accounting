-- =============================================================================
-- PR-G: Ingest Prerequisites — DOWN MIGRATION
-- =============================================================================
-- Removes the raw_xml column. WARNING: dropping this column destroys all
-- archived raw bytes for already-ingested documents. Apply only if
-- explicitly intentional and documented in audit log.
-- =============================================================================

BEGIN;

ALTER TABLE regulatory_documents
    DROP COLUMN IF EXISTS raw_xml;

COMMIT;
