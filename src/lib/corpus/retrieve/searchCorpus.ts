/**
 * src/lib/corpus/retrieve/searchCorpus.ts
 *
 * Top-level hybrid retrieval orchestrator.
 *
 * Flow:
 *   1. Run BM25 + dense in parallel (Promise.all)
 *   2. RRF fuse the two ranked lists
 *   3. Voyage rerank-2 the fused top-50
 *   4. Hydrate document metadata for the final top-K
 *
 * Modes:
 *   'keyword'  — BM25 only, no rerank
 *   'semantic' — dense only, no rerank
 *   'hybrid'   — BM25 + dense + RRF + rerank (default, institutional)
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.6
 */

import { PrismaClient } from '@prisma/client';
import { searchBM25 } from './bm25';
import { searchDense } from './dense';
import { fuseRRF } from './rrf';
import { rerankCandidates } from './rerank';
import type { RetrievalOptions, RetrievalResult } from './types';

const prisma = new PrismaClient();

interface DocumentMetadata {
  document_id: string;
  citation_key: string;
  doc_type: string;
  jurisdiction: string;
  source_domain: string;
  title: string;
  effective_date: Date | null;
  canonical_url: string;
}

interface ChunkMetadata {
  chunk_id: string;
  structural_path: string;
  pinpoint: string | null;
}

async function hydrateMetadata(
  documentIds: string[],
  chunkIds: string[]
): Promise<{
  docs: Map<string, DocumentMetadata>;
  chunks: Map<string, ChunkMetadata>;
}> {
  if (documentIds.length === 0) {
    return { docs: new Map(), chunks: new Map() };
  }

  const docRows = await prisma.$queryRaw<DocumentMetadata[]>`
    SELECT
      d.id::text AS document_id,
      d.citation_key,
      d.doc_type,
      d.jurisdiction,
      s.domain AS source_domain,
      d.title,
      d.effective_date,
      d.canonical_url
    FROM regulatory_documents d
    JOIN regulatory_sources s ON d.source_id = s.id
    WHERE d.id::text = ANY(${documentIds}::text[])
  `;

  const chunkRows = await prisma.$queryRaw<ChunkMetadata[]>`
    SELECT
      id::text AS chunk_id,
      structural_path,
      pinpoint
    FROM regulatory_document_chunks
    WHERE id::text = ANY(${chunkIds}::text[])
  `;

  const docs = new Map(docRows.map((r) => [r.document_id, r]));
  const chunks = new Map(chunkRows.map((r) => [r.chunk_id, r]));

  return { docs, chunks };
}

/**
 * Hybrid retrieval entry point.
 */
export async function searchCorpus(
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult[]> {
  const mode = options.mode ?? 'hybrid';
  const candidatesPerMethod = options.candidatesPerMethod ?? 50;
  const topK = options.topK ?? 8;
  const skipRerank = options.skipRerank ?? mode === 'keyword';

  if (!query.trim()) return [];

  // STEP 1: parallel retrieval
  const [bm25, dense] = await Promise.all([
    mode === 'semantic'
      ? Promise.resolve([])
      : searchBM25(query, candidatesPerMethod, options.sourceDomains, options.docTypes),
    mode === 'keyword'
      ? Promise.resolve([])
      : searchDense(query, candidatesPerMethod, options.sourceDomains, options.docTypes),
  ]);

  // STEP 2: RRF fusion
  const fused = fuseRRF(bm25, dense);
  if (fused.length === 0) return [];

  // STEP 3: rerank (skip for keyword-only or if explicitly disabled)
  const candidatesForRerank = fused.slice(0, candidatesPerMethod);
  const finalCandidates = skipRerank
    ? candidatesForRerank.slice(0, topK).map((c) => ({ ...c, rerank_score: null as number | null }))
    : await rerankCandidates(query, candidatesForRerank, topK);

  // STEP 4: hydrate metadata
  const { docs, chunks } = await hydrateMetadata(
    finalCandidates.map((c) => c.document_id),
    finalCandidates.map((c) => c.chunk_id)
  );

  return finalCandidates.flatMap((c) => {
    const doc = docs.get(c.document_id);
    const chunk = chunks.get(c.chunk_id);
    if (!doc || !chunk) return [];
    return [
      {
        chunk_id: c.chunk_id,
        document_id: c.document_id,
        text: c.text,
        rerank_score: 'rerank_score' in c ? (c.rerank_score as number | null) : null,
        fusion_score: c.fusion_score,
        bm25_score: c.bm25_score,
        dense_score: c.dense_score,
        citation_key: doc.citation_key,
        doc_type: doc.doc_type,
        jurisdiction: doc.jurisdiction,
        source_domain: doc.source_domain,
        title: doc.title,
        effective_date: doc.effective_date
          ? doc.effective_date.toISOString().slice(0, 10)
          : null,
        canonical_url: doc.canonical_url,
        structural_path: chunk.structural_path,
        pinpoint: chunk.pinpoint,
      } satisfies RetrievalResult,
    ];
  });
}
