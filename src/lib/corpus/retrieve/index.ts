/**
 * src/lib/corpus/retrieve/index.ts
 *
 * Barrel for the hybrid retrieval pipeline.
 */

export { searchCorpus } from './searchCorpus';
export { searchBM25 } from './bm25';
export { searchDense } from './dense';
export { fuseRRF } from './rrf';
export { rerankCandidates } from './rerank';
export {
  rerankDocuments,
  VoyageRerankError,
} from './voyage-rerank-client';

export type {
  RetrievalMode,
  RetrievalOptions,
  RetrievalResult,
  CandidateChunk,
} from './types';
export type { FusedCandidate } from './rrf';
export type { RerankedCandidate } from './rerank';
export type {
  VoyageRerankRequest,
  VoyageRerankItem,
  VoyageRerankResponse,
} from './voyage-rerank-client';
