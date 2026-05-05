/**
 * src/lib/corpus/retrieve/rrf.ts
 *
 * Reciprocal Rank Fusion (Cormack, Clarke, Buettcher 2009).
 *
 * Combines two or more ranked lists into a single fused ranking.
 * The k constant (default 60) is the published institutional
 * standard — provides good fusion across heterogeneous rankers
 * without needing per-method score calibration.
 *
 *   RRF_score(d) = Σ_i (1 / (k + rank_i(d)))
 *
 * Documents not in a given list contribute 0 from that list.
 */

import type { CandidateChunk } from './types';

interface FusedCandidate {
  chunk_id: string;
  document_id: string;
  text: string;
  fusion_score: number;
  bm25_score: number | null;
  dense_score: number | null;
  bm25_rank: number | null;
  dense_rank: number | null;
}

const RRF_K = 60;

/**
 * Fuse BM25 and dense candidate lists via RRF.
 *
 * Returns a deduplicated list sorted by fusion_score descending.
 * Per-method scores and ranks are preserved on each candidate for
 * downstream observability (UI display, debugging, eval harness).
 */
export function fuseRRF(
  bm25: CandidateChunk[],
  dense: CandidateChunk[]
): FusedCandidate[] {
  const merged = new Map<string, FusedCandidate>();

  for (const c of bm25) {
    const rrf = 1 / (RRF_K + c.rank);
    merged.set(c.chunk_id, {
      chunk_id: c.chunk_id,
      document_id: c.document_id,
      text: c.text,
      fusion_score: rrf,
      bm25_score: c.score,
      dense_score: null,
      bm25_rank: c.rank,
      dense_rank: null,
    });
  }

  for (const c of dense) {
    const rrf = 1 / (RRF_K + c.rank);
    const existing = merged.get(c.chunk_id);
    if (existing) {
      existing.fusion_score += rrf;
      existing.dense_score = c.score;
      existing.dense_rank = c.rank;
    } else {
      merged.set(c.chunk_id, {
        chunk_id: c.chunk_id,
        document_id: c.document_id,
        text: c.text,
        fusion_score: rrf,
        bm25_score: null,
        dense_score: c.score,
        bm25_rank: null,
        dense_rank: c.rank,
      });
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.fusion_score - a.fusion_score
  );
}

export type { FusedCandidate };
