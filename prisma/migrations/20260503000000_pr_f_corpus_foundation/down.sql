-- =============================================================================
-- PR-F: Corpus Foundation — DOWN MIGRATION
-- =============================================================================
-- Reverses the schema changes from migration.sql.
--
-- Reverses in inverse order: indexes first, then chunks table (which has
-- foreign key to documents), then documents table.
--
-- The vector extension is intentionally NOT dropped. Other future migrations
-- may use vector columns elsewhere. Removing the extension would orphan them.
--
-- This down script is for emergency rollback only. Standard practice is to
-- ship a forward-fix migration rather than apply this. Documented for SOC 2
-- change-management completeness.
-- =============================================================================

BEGIN;

-- STEP 1: Drop indexes on chunks first (depend on the chunks table).
DROP INDEX IF EXISTS regulatory_document_chunks_document_id_structural_path_idx;
DROP INDEX IF EXISTS regulatory_document_chunks_bm25_tsv_idx;
DROP INDEX IF EXISTS regulatory_document_chunks_embedding_hnsw_idx;

-- STEP 2: Drop the chunks table. CASCADE removes the FK constraint cleanly.
DROP TABLE IF EXISTS regulatory_document_chunks CASCADE;

-- STEP 3: Drop indexes on documents.
DROP INDEX IF EXISTS regulatory_documents_source_id_retrieved_at_idx;
DROP INDEX IF EXISTS regulatory_documents_citation_key_effective_date_idx;

-- STEP 4: Drop the documents table.
DROP TABLE IF EXISTS regulatory_documents CASCADE;

-- Note: pgvector extension is left in place by design.

COMMIT;
