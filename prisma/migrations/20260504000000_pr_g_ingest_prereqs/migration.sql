-- =============================================================================
-- PR-G: Ingest Prerequisites
-- =============================================================================
-- Adds raw_xml column to regulatory_documents to store the raw fetched
-- XML/HTML/PDF bytes inline. PR-F's schema spec (§ 1.5) called for
-- raw_storage_uri to reference S3/MinIO. For v1 we store the bytes in
-- Postgres bytea and let raw_storage_uri reference the row itself.
--
-- This is an institutional [SOLO LIMIT] compromise per architecture doc § 7.2.
-- When archive volume warrants, a future PR will migrate raw_xml content to
-- WORM S3 storage and update raw_storage_uri to the S3 path.
--
-- Idempotent and atomic.
-- =============================================================================

BEGIN;

-- STEP 1: Add raw_xml column to regulatory_documents.
-- Nullable initially so existing rows (none yet on production) are unaffected.
-- Worker code will populate this on every insert going forward.
ALTER TABLE regulatory_documents
    ADD COLUMN IF NOT EXISTS raw_xml bytea;

-- STEP 2: Document the column purpose for future operators.
COMMENT ON COLUMN regulatory_documents.raw_xml IS
    'Raw fetched bytes (XML/HTML/PDF). raw_hash is sha256 of this content. '
    'For v1, archive lives inline in Postgres. Future PR will migrate to S3 '
    'and clear this column once raw_storage_uri points to the S3 object.';

COMMIT;
