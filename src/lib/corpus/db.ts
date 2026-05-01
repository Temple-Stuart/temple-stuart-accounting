/**
 * src/lib/corpus/db.ts
 *
 * Sole TypeScript access layer for the regulatory document corpus.
 *
 * The corpus tables (regulatory_documents, regulatory_document_chunks) are
 * intentionally NOT modeled in prisma/schema.prisma. Prisma 5.22 cannot
 * express the vector(1024) column type or HNSW index method, so the corpus
 * lives outside Prisma's typed client and is accessed through this module.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md
 * Sections 1.2 (technology stack), 1.5 (schema sketch).
 *
 * Design rules:
 *   - Pure data accessors. No business logic.
 *   - All inserts use $executeRaw with parameterized placeholders.
 *   - Vector embeddings are passed as Postgres array literals.
 *   - Similarity search uses the <=> cosine-distance operator.
 *   - All callers must provide their own SHA-256 content_hash, raw_hash,
 *     and text_hash. This module never computes them.
 */

import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface InsertDocumentInput {
  source_id: string;
  doc_type: string;
  jurisdiction: string;
  citation_key: string;
  title: string;
  version: number;
  effective_date: Date | null;
  published_date: Date;
  retrieved_at: Date;
  canonical_url: string;
  stable_uri: string;
  content_hash: Buffer;
  raw_hash: Buffer;
  raw_storage_uri: string;
  metadata?: Record<string, unknown>;
}

export interface InsertChunkInput {
  document_id: string;
  parent_chunk_id?: string | null;
  ordinal: number;
  structural_path: string;
  pinpoint?: string | null;
  text: string;
  text_hash: Buffer;
  token_count: number;
  embedding: number[];
  embedding_model: string;
}

export interface SimilarChunkResult {
  id: string;
  document_id: string;
  structural_path: string;
  pinpoint: string | null;
  text: string;
  cosine_distance: number;
}

export interface SearchFilters {
  jurisdiction?: string;
  doc_type?: string;
  superseded_only_currrent?: boolean;
}

/* -------------------------------------------------------------------------- */
/* insertDocument                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Inserts a row into regulatory_documents and returns the new id.
 * Caller must pre-compute content_hash and raw_hash as SHA-256 Buffers.
 */
export async function insertDocument(
  input: InsertDocumentInput
): Promise<{ id: string }> {
  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO regulatory_documents (
      source_id, doc_type, jurisdiction, citation_key, title, version,
      effective_date, published_date, retrieved_at, canonical_url,
      stable_uri, content_hash, raw_hash, raw_storage_uri, metadata
    ) VALUES (
      ${input.source_id}::uuid,
      ${input.doc_type},
      ${input.jurisdiction},
      ${input.citation_key},
      ${input.title},
      ${input.version},
      ${input.effective_date},
      ${input.published_date},
      ${input.retrieved_at},
      ${input.canonical_url},
      ${input.stable_uri},
      ${input.content_hash},
      ${input.raw_hash},
      ${input.raw_storage_uri},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    RETURNING id
  `;
  return result[0];
}

/* -------------------------------------------------------------------------- */
/* insertChunk                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Inserts a row into regulatory_document_chunks. The embedding is converted
 * to the Postgres vector literal format (e.g., '[0.1,0.2,...]'::vector).
 *
 * Embedding length is NOT validated here — caller must pass a 1024-dim array
 * matching the column definition. Mismatch will throw at the Postgres level.
 */
export async function insertChunk(
  input: InsertChunkInput
): Promise<{ id: string }> {
  const embeddingLiteral = `[${input.embedding.join(',')}]`;

  const result = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO regulatory_document_chunks (
      document_id, parent_chunk_id, ordinal, structural_path, pinpoint,
      text, text_hash, token_count, embedding, embedding_model
    ) VALUES (
      ${input.document_id}::uuid,
      ${input.parent_chunk_id ?? null}::uuid,
      ${input.ordinal},
      ${input.structural_path},
      ${input.pinpoint ?? null},
      ${input.text},
      ${input.text_hash},
      ${input.token_count},
      ${embeddingLiteral}::vector,
      ${input.embedding_model}
    )
    RETURNING id
  `;
  return result[0];
}

/* -------------------------------------------------------------------------- */
/* searchSimilarChunks                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Performs HNSW approximate nearest-neighbor search by cosine distance.
 * Returns the top-k chunks with their distance scores.
 *
 * Filters are applied via JOIN to regulatory_documents. The
 * superseded_only_current filter excludes chunks whose parent document
 * has been superseded.
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  k: number,
  filters: SearchFilters = {}
): Promise<SimilarChunkResult[]> {
  const embeddingLiteral = `[${queryEmbedding.join(',')}]`;

  const jurisdictionClause = filters.jurisdiction
    ? Prisma.sql`AND d.jurisdiction = ${filters.jurisdiction}`
    : Prisma.empty;
  const docTypeClause = filters.doc_type
    ? Prisma.sql`AND d.doc_type = ${filters.doc_type}`
    : Prisma.empty;
  const supersededClause = filters.superseded_only_currrent
    ? Prisma.sql`AND d.superseded_by IS NULL`
    : Prisma.empty;

  return prisma.$queryRaw<SimilarChunkResult[]>`
    SELECT
      c.id,
      c.document_id,
      c.structural_path,
      c.pinpoint,
      c.text,
      (c.embedding <=> ${embeddingLiteral}::vector)::float8 AS cosine_distance
    FROM regulatory_document_chunks c
    JOIN regulatory_documents d ON c.document_id = d.id
    WHERE 1=1
      ${jurisdictionClause}
      ${docTypeClause}
      ${supersededClause}
    ORDER BY c.embedding <=> ${embeddingLiteral}::vector
    LIMIT ${k}
  `;
}

/* -------------------------------------------------------------------------- */
/* deleteDocument (for tests and rollback only)                                */
/* -------------------------------------------------------------------------- */

/**
 * Deletes a document and all its chunks (CASCADE).
 * Intended for test cleanup and emergency rollback. NOT for production use —
 * production should set superseded_by instead of deleting.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM regulatory_documents WHERE id = ${documentId}::uuid
  `;
}
