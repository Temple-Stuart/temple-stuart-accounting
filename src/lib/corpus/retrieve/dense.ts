/**
 * src/lib/corpus/retrieve/dense.ts
 *
 * Dense vector retrieval. Uses Voyage to embed the query (with
 * input_type: 'query' for asymmetric retrieval), then runs pgvector
 * cosine search against regulatory_document_chunks.
 *
 * The HNSW index (m=16, ef_construction=200) handles fast top-K
 * lookup. ef_search defaults to 40 — adequate for top-50 with
 * good recall.
 */

import { PrismaClient } from '@prisma/client';
import { embedBatch } from '../embed/voyage-client';
import type { CandidateChunk } from './types';

const prisma = new PrismaClient();

interface DenseRow {
  chunk_id: string;
  document_id: string;
  text: string;
  cosine_distance: number;
}

/**
 * Run dense vector search.
 *
 * @param query natural-language query
 * @param limit max results (default 50)
 * @param sourceDomains optional source filter
 * @param docTypes optional doc_type filter
 */
export async function searchDense(
  query: string,
  limit: number = 50,
  sourceDomains?: string[],
  docTypes?: string[]
): Promise<CandidateChunk[]> {
  if (!query.trim()) {
    return [];
  }

  // Embed the query as a 'query' (asymmetric to 'document' embeddings).
  const embedResponse = await embedBatch({
    input: [query],
    model: 'voyage-3.5',
    input_type: 'query',
    output_dimension: 1024,
  });

  const queryVector = embedResponse.data[0].embedding;
  const vectorLiteral = `[${queryVector.join(',')}]`;

  const sourceFilter =
    sourceDomains && sourceDomains.length > 0
      ? `AND s.domain = ANY($2::text[])`
      : '';
  const docTypeFilter =
    docTypes && docTypes.length > 0
      ? `AND d.doc_type = ANY($${sourceDomains && sourceDomains.length > 0 ? 3 : 2}::text[])`
      : '';

  // pgvector <=> operator is cosine distance (lower = more similar).
  // Cast to float8 for cleaner JS handling.
  const sql = `
    SELECT
      c.id::text AS chunk_id,
      c.document_id::text AS document_id,
      c.text,
      (c.embedding <=> $1::vector)::float8 AS cosine_distance
    FROM regulatory_document_chunks c
    JOIN regulatory_documents d ON c.document_id = d.id
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE c.embedding IS NOT NULL
      AND d.superseded_by IS NULL
      ${sourceFilter}
      ${docTypeFilter}
    ORDER BY c.embedding <=> $1::vector
    LIMIT ${limit}
  `;

  const params: unknown[] = [vectorLiteral];
  if (sourceDomains && sourceDomains.length > 0) params.push(sourceDomains);
  if (docTypes && docTypes.length > 0) params.push(docTypes);

  const rows = await prisma.$queryRawUnsafe<DenseRow[]>(sql, ...params);

  // Convert cosine distance (0..2, lower=better) to similarity score
  // (0..1, higher=better) for downstream uniformity.
  return rows.map((r, i) => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    text: r.text,
    score: 1 - r.cosine_distance / 2,
    rank: i + 1,
  }));
}
