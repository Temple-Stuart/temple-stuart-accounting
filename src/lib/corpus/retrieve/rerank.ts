/**
 * src/lib/corpus/retrieve/rerank.ts
 *
 * Rerank fused candidates via Voyage rerank-2.
 *
 * Architecture doc § 1.6: rerank-2 cross-encoder produces final
 * top-K from RRF-fused candidates. ~90% retrieval quality vs ~70%
 * without reranker.
 */

import { rerankDocuments } from './voyage-rerank-client';
import type { FusedCandidate } from './rrf';

export interface RerankedCandidate extends FusedCandidate {
  rerank_score: number;
}

/**
 * Rerank a list of fused candidates and return top-K.
 *
 * @param query original natural-language query
 * @param candidates RRF-fused candidates (already deduped)
 * @param topK final result count
 * @param model Voyage rerank model name (default 'rerank-2')
 */
export async function rerankCandidates(
  query: string,
  candidates: FusedCandidate[],
  topK: number = 8,
  model: string = 'rerank-2'
): Promise<RerankedCandidate[]> {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [{ ...candidates[0], rerank_score: 1.0 }];
  }

  const response = await rerankDocuments({
    query,
    documents: candidates.map((c) => c.text),
    model,
    top_k: Math.min(topK, candidates.length),
  });

  // Voyage returns indices into the documents array; map back to candidates.
  return response.data.map((item) => ({
    ...candidates[item.index],
    rerank_score: item.relevance_score,
  }));
}
