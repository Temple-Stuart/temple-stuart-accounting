/**
 * src/lib/corpus/retrieve/bm25.ts
 *
 * Postgres full-text search against the bm25_tsv generated column
 * on regulatory_document_chunks. Uses ts_rank_cd (cover-density
 * variant) for phrase-locality-aware scoring.
 *
 * Index: GIN on bm25_tsv (created in PR-F migration).
 * Query construction: plainto_tsquery for natural-language input.
 */

import { PrismaClient } from '@prisma/client';
import type { CandidateChunk } from './types';

const prisma = new PrismaClient();

interface BM25Row {
  chunk_id: string;
  document_id: string;
  text: string;
  score: number;
}

/**
 * Run BM25 search against the corpus.
 *
 * @param query natural-language query string
 * @param limit max results (default 50)
 * @param sourceDomains optional filter (e.g. ['ecfr.gov'])
 * @param docTypes optional filter (e.g. ['regulation'])
 */
export async function searchBM25(
  query: string,
  limit: number = 50,
  sourceDomains?: string[],
  docTypes?: string[]
): Promise<CandidateChunk[]> {
  if (!query.trim()) {
    return [];
  }

  // Build optional WHERE clauses for filters.
  // We use Prisma.sql tagged templates rather than string concatenation
  // to prevent injection.
  const sourceFilter =
    sourceDomains && sourceDomains.length > 0
      ? `AND s.domain = ANY($2::text[])`
      : '';
  const docTypeFilter =
    docTypes && docTypes.length > 0
      ? `AND d.doc_type = ANY($${sourceDomains && sourceDomains.length > 0 ? 3 : 2}::text[])`
      : '';

  // Postgres ts_rank_cd: returns relevance score given the indexed
  // tsvector and a tsquery. plainto_tsquery handles natural language
  // (stop words, stemming) without requiring boolean operators.
  const sql = `
    SELECT
      c.id::text AS chunk_id,
      c.document_id::text AS document_id,
      c.text,
      ts_rank_cd(c.bm25_tsv, plainto_tsquery('english', $1))::float8 AS score
    FROM regulatory_document_chunks c
    JOIN regulatory_documents d ON c.document_id = d.id
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE c.bm25_tsv @@ plainto_tsquery('english', $1)
      AND d.superseded_by IS NULL
      ${sourceFilter}
      ${docTypeFilter}
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  const params: unknown[] = [query];
  if (sourceDomains && sourceDomains.length > 0) params.push(sourceDomains);
  if (docTypes && docTypes.length > 0) params.push(docTypes);

  const rows = await prisma.$queryRawUnsafe<BM25Row[]>(sql, ...params);

  return rows.map((r, i) => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    text: r.text,
    score: r.score,
    rank: i + 1,
  }));
}
