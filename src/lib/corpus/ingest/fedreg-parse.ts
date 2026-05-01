/**
 * src/lib/corpus/ingest/fedreg-parse.ts
 *
 * Transformer from Federal Register JSON detail + plain-text body
 * into the canonical ParsedDocument shape consumed by persist.
 *
 * Unlike PR-G (eCFR XML) and PR-H (USC USLM XML), Federal Register
 * is API-native: the text body is published as plain text via the
 * detail endpoint's raw_text_url. No XML walking, no DIV5 traversal.
 *
 * Each FR document becomes ONE ParsedDocument with ONE ParsedChunk
 * holding the full raw text. Metadata captures the rich detail
 * fields (agencies, cfr_references, docket_ids, topics, citation,
 * effective_on) for later filtering and citation-graph traversal.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.2
 */

import type { ParsedDocument, ParsedChunk } from './types';
import type { FedregDocumentDetail } from './fedreg-fetch';

/**
 * Map FR API's `type` field to our doc_type free-text values.
 * Distinct values preserve filtering granularity downstream
 * (Renaissance source-granularity principle).
 */
export function mapFedregTypeToDocType(frType: string): string {
  switch (frType) {
    case 'Rule':
      return 'regulation';
    case 'Proposed Rule':
      return 'proposed_regulation';
    case 'Notice':
      return 'agency_notice';
    case 'Presidential Document':
      return 'presidential_document';
    default:
      // Unknown types are recorded as-is in metadata but coerced to
      // 'agency_notice' for the doc_type column. If FR ever adds a
      // new type, this branch logs it via the actual string in metadata.
      return 'agency_notice';
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Transform an FR document (detail + raw text) into a ParsedDocument.
 *
 * @param detail the FR detail JSON response
 * @param rawText the plain-text body fetched from detail.raw_text_url
 * @returns ParsedDocument ready for persist, or null if the detail
 *          response is missing critical fields
 */
export function parseFedregDocument(
  detail: FedregDocumentDetail,
  rawText: string
): ParsedDocument | null {
  if (!detail.document_number || !detail.publication_date) return null;
  if (!rawText || rawText.trim().length === 0) return null;

  const documentNumber = detail.document_number;
  const publicationDate = detail.publication_date;
  const publicationYear = publicationDate.slice(0, 4);

  const citationKey = `FR-${documentNumber}`;
  const structuralPath = `FR/${publicationYear}/${documentNumber}`;
  const pinpoint = detail.citation ?? null;

  // The "effective_date" we record is effective_on if present
  // (final rules with delayed effective dates), otherwise the
  // publication_date (notices and immediately-effective documents).
  const effectiveDate = detail.effective_on ?? publicationDate;

  const chunk: ParsedChunk = {
    ordinal: 0,
    structural_path: structuralPath,
    pinpoint,
    text: rawText.trim(),
    token_count: estimateTokens(rawText),
  };

  return {
    citation_key: citationKey,
    title: detail.title,
    effective_date: effectiveDate,
    structural_path: structuralPath,
    chunks: [chunk],
    metadata: {
      fr_type: detail.type,
      fr_document_number: documentNumber,
      publication_date: publicationDate,
      effective_on: detail.effective_on,
      citation: detail.citation,
      html_url: detail.html_url,
      pdf_url: detail.pdf_url,
      agencies: detail.agencies.map((a) => ({
        id: a.id,
        name: a.name,
      })),
      cfr_references: detail.cfr_references,
      docket_ids: detail.docket_ids,
      topics: detail.topics,
      volume: detail.volume,
      start_page: detail.start_page,
      end_page: detail.end_page,
      comment_url: detail.comment_url,
      comments_close_on: detail.comments_close_on,
      president: detail.president ?? null,
    },
  };
}
