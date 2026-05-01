/**
 * src/lib/corpus/ingest/index.ts
 *
 * Barrel export for the ingest pipeline. The Inngest function imports
 * from '@/lib/corpus/ingest' and never reaches into individual files.
 */

export { fetchTitleList, fetchTitleXml } from './ecfr-fetch';
export { parseTitleToDocuments } from './ecfr-parse';
export { persistTitleDocuments } from './ecfr-persist';

export {
  fetchTitleHeaders,
  fetchTitleXml as fetchUscTitleXml,
  discoverLatestReleasePoint,
  extractLatestReleasePoint,
} from './uscode-fetch';
export { parseUscTitleToDocuments } from './uscode-parse';
export { persistUscTitleDocuments } from './uscode-persist';
export { USCODE_TITLES, xmlUrlForTitle, downloadIndexUrl } from './uscode-titles';
export type { UscodeTitle } from './uscode-titles';
export type { UscodeTitleHeaders, ReleasePoint } from './uscode-fetch';

export {
  fetchDocumentList,
  fetchDocumentDetail,
  fetchDocumentRawText,
} from './fedreg-fetch';
export { parseFedregDocument, mapFedregTypeToDocType } from './fedreg-parse';
export { persistFedregDocument } from './fedreg-persist';
export type {
  FedregListEntry,
  FedregListResponse,
  FedregDocumentDetail,
} from './fedreg-fetch';
export type { FedregPersistResult } from './fedreg-persist';

export {
  fetchIrbIndex,
  fetchIssueHtml,
  fetchIssueHeaders,
  extractIrbIndex,
} from './irb-fetch';
export { parseIrbIssue, mapCitationToDocType } from './irb-parse';
export { persistIrbDocuments } from './irb-persist';
export type { IrbIndexEntry, IrbIssueHeaders } from './irb-fetch';
export type { IrbPersistResult } from './irb-persist';

export type {
  EcfrTitleListEntry,
  ParsedDocument,
  ParsedChunk,
  TitleIngestSummary,
  RunSummary,
} from './types';
