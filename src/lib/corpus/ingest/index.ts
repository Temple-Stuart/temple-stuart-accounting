/**
 * src/lib/corpus/ingest/index.ts
 *
 * Barrel export for the ingest pipeline. The Inngest function imports
 * from '@/lib/corpus/ingest' and never reaches into individual files.
 */

export { fetchTitleList, fetchTitleXml } from './ecfr-fetch';
export { parseTitleToDocuments } from './ecfr-parse';
export { persistTitleDocuments } from './ecfr-persist';

export type {
  EcfrTitleListEntry,
  ParsedDocument,
  ParsedChunk,
  TitleIngestSummary,
  RunSummary,
} from './types';
