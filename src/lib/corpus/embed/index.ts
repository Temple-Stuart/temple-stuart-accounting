/**
 * src/lib/corpus/embed/index.ts
 *
 * Barrel export for the embedding pipeline.
 */

export { runEmbeddingPass } from './embed-service';
export type { EmbedRunOptions, EmbedRunResult } from './embed-service';

export {
  embedBatch,
  estimateCostUsd,
  estimateTokensFromText,
  VoyageApiError,
} from './voyage-client';
export type {
  VoyageEmbeddingRequest,
  VoyageEmbeddingData,
  VoyageEmbeddingResponse,
} from './voyage-client';
