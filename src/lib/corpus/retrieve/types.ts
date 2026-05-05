/**
 * src/lib/corpus/retrieve/types.ts
 *
 * Type definitions for the hybrid retrieval pipeline.
 *
 * Pipeline shape:
 *   query string
 *     → BM25 (ts_rank_cd) + Dense (Voyage embed + pgvector cosine)
 *     → RRF fusion (top 50 candidates)
 *     → Voyage rerank-2 (top K results, default 8)
 *     → RetrievalResult[]
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.6
 */

export type RetrievalMode = 'keyword' | 'semantic' | 'hybrid';

/**
 * Internal candidate after BM25 or dense search, before fusion.
 */
export interface CandidateChunk {
  chunk_id: string;
  document_id: string;
  text: string;
  score: number;
  rank: number;
}

/**
 * Final retrieval result returned to API and UI consumers.
 * Includes denormalized document metadata for display.
 */
export interface RetrievalResult {
  chunk_id: string;
  document_id: string;
  text: string;
  /** Final reranker score (post-Voyage rerank-2). Null if reranker disabled. */
  rerank_score: number | null;
  /** RRF fused score from BM25 + dense. */
  fusion_score: number;
  /** Per-method scores for debugging / transparency. */
  bm25_score: number | null;
  dense_score: number | null;
  /** Document-level metadata for citation. */
  citation_key: string;
  doc_type: string;
  jurisdiction: string;
  source_domain: string;
  title: string;
  effective_date: string | null;
  canonical_url: string;
  structural_path: string;
  pinpoint: string | null;
}

export interface RetrievalOptions {
  /** "keyword" = BM25 only; "semantic" = dense only; "hybrid" = both + RRF */
  mode?: RetrievalMode;
  /** Number of candidates per method before RRF (default 50) */
  candidatesPerMethod?: number;
  /** Final result count after rerank (default 8) */
  topK?: number;
  /** If true, skip Voyage rerank step (saves cost/latency) */
  skipRerank?: boolean;
  /** Filter to specific source domains, e.g. ['ecfr.gov', 'irs.gov'] */
  sourceDomains?: string[];
  /** Filter to specific doc_types, e.g. ['regulation', 'revenue_ruling'] */
  docTypes?: string[];
}
