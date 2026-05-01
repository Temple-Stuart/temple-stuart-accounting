-- =============================================================================
-- PR-F: Corpus Foundation
-- =============================================================================
-- Creates the document corpus storage layer for the Discovery Engine.
-- Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.5
--
-- Two tables:
--   regulatory_documents       — versioned, hash-anchored authoritative texts
--   regulatory_document_chunks — embedded sub-document units for retrieval
--
-- Indexes:
--   B-tree on (citation_key, effective_date DESC) WHERE superseded_by IS NULL
--   B-tree on (source_id, retrieved_at)
--   HNSW on embedding (vector_cosine_ops) for nearest-neighbor search
--   GIN on bm25_tsv for keyword search
--   B-tree on (document_id, structural_path)
--
-- Prerequisite: pgvector extension allow-listed in Azure server parameters
-- and installed in this database. See architecture doc § 1.2.
--
-- This migration is idempotent (IF NOT EXISTS everywhere) and atomic
-- (wrapped in BEGIN/COMMIT). Down script: down.sql in this directory.
-- =============================================================================

BEGIN;

-- STEP 1: Ensure pgvector is installed in the database.
-- Safe no-op if already installed. Fails fast if extension is not allow-listed
-- at the server level (Azure azure.extensions parameter).
CREATE EXTENSION IF NOT EXISTS vector;

-- STEP 2: regulatory_documents — top-level authoritative document registry.
-- Each row represents one version of one canonical document (e.g. IRC § 162
-- effective 2026-01-01). New versions are inserted; prior versions are kept
-- and linked via superseded_by. Content_hash and raw_hash provide cryptographic
-- integrity. Stable_uri is the institutional contract for citation.
CREATE TABLE IF NOT EXISTS regulatory_documents (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       uuid NOT NULL REFERENCES regulatory_sources(id),
    doc_type        text NOT NULL,
    jurisdiction    text NOT NULL,
    citation_key    text NOT NULL,
    title           text NOT NULL,
    version         int  NOT NULL,
    effective_date  date,
    published_date  date NOT NULL,
    retrieved_at    timestamptz NOT NULL,
    canonical_url   text NOT NULL,
    stable_uri      text NOT NULL,
    content_hash    bytea NOT NULL,
    raw_hash        bytea NOT NULL,
    raw_storage_uri text NOT NULL,
    superseded_by   uuid REFERENCES regulatory_documents(id),
    superseded_at   timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT regulatory_documents_citation_key_version_key
        UNIQUE (citation_key, version)
);

-- STEP 3: Indexes on regulatory_documents.
-- Partial index on (citation_key, effective_date DESC) WHERE superseded_by IS NULL
-- supports the common "give me the current version of citation X" query path.
-- Index on (source_id, retrieved_at) supports per-source ingestion audits.
CREATE INDEX IF NOT EXISTS regulatory_documents_citation_key_effective_date_idx
    ON regulatory_documents (citation_key, effective_date DESC)
    WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS regulatory_documents_source_id_retrieved_at_idx
    ON regulatory_documents (source_id, retrieved_at);

-- STEP 4: regulatory_document_chunks — embedded sub-document units.
-- Each chunk is a structural unit (statute section, CFR paragraph) of a
-- parent document. parent_chunk_id supports the "small-to-big" retrieval
-- pattern from architecture doc § 1.2. The embedding column stores the
-- voyage-3.5-large output (1024-dim cosine). bm25_tsv is a generated
-- tsvector for hybrid retrieval.
CREATE TABLE IF NOT EXISTS regulatory_document_chunks (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id      uuid NOT NULL REFERENCES regulatory_documents(id) ON DELETE CASCADE,
    parent_chunk_id  uuid REFERENCES regulatory_document_chunks(id),
    ordinal          int  NOT NULL,
    structural_path  text NOT NULL,
    pinpoint         text,
    text             text NOT NULL,
    text_hash        bytea NOT NULL,
    token_count      int  NOT NULL,
    embedding        vector(1024),
    embedding_model  text NOT NULL,
    bm25_tsv         tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT regulatory_document_chunks_document_id_ordinal_key
        UNIQUE (document_id, ordinal)
);

-- STEP 5: Indexes on regulatory_document_chunks.
-- HNSW index for approximate nearest-neighbor search on embeddings using
-- cosine distance. Parameters m=16 and ef_construction=200 are the
-- production-recommended values per architecture doc § 1.2 (>95% recall up
-- to ~10M vectors).
-- GIN index on the generated bm25_tsv column for keyword search.
-- B-tree on (document_id, structural_path) for hierarchical lookup.
CREATE INDEX IF NOT EXISTS regulatory_document_chunks_embedding_hnsw_idx
    ON regulatory_document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

CREATE INDEX IF NOT EXISTS regulatory_document_chunks_bm25_tsv_idx
    ON regulatory_document_chunks
    USING gin (bm25_tsv);

CREATE INDEX IF NOT EXISTS regulatory_document_chunks_document_id_structural_path_idx
    ON regulatory_document_chunks (document_id, structural_path);

COMMIT;
