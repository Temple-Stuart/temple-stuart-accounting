/**
 * src/lib/corpus/index.ts
 *
 * Barrel export for the corpus access layer. Other code imports from
 * '@/lib/corpus' rather than reaching into individual files.
 */

export {
  insertDocument,
  insertChunk,
  searchSimilarChunks,
  deleteDocument,
} from './db';

export type {
  InsertDocumentInput,
  InsertChunkInput,
  SimilarChunkResult,
  SearchFilters,
} from './db';
