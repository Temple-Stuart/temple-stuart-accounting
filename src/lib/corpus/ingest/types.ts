/**
 * src/lib/corpus/ingest/types.ts
 *
 * Shared types for the eCFR ingestion pipeline. The pipeline has three
 * stages, each operating on a typed handoff:
 *
 *   eCFR API ─[fetch]→ EcfrTitleListEntry[]
 *                  ─[fetch]→ raw XML bytes (Buffer)
 *                  ─[parse]→ ParsedDocument
 *                  ─[persist]→ written rows in regulatory_documents/_chunks
 *
 * All types are pure data — no methods, no Prisma, no fetch.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.2
 * (chunking strategy: DIV5 with parent-section context, "small-to-big" pattern)
 */

/**
 * Entry in the eCFR title list response.
 * GET https://www.ecfr.gov/api/versioner/v1/titles.json
 */
export interface EcfrTitleListEntry {
  number: number;          // 1..50 (CFR title number)
  name: string;            // e.g. "General Provisions"
  latest_amended_on: string;  // ISO date string
  latest_issue_date: string;  // ISO date string
  up_to_date_as_of: string;   // ISO date string — the version anchor
  reserved: boolean;
}

/**
 * Result of parsing an eCFR title XML payload into structured documents.
 * One ParsedDocument represents one DIV5 (section) and its child chunks.
 *
 * The parent document holds metadata; chunks hold the actual text plus
 * structural path. The chunk hierarchy is stored as parent_chunk_id
 * relationships during persist, supporting the small-to-big pattern.
 */
export interface ParsedDocument {
  /** CFR citation key, e.g. "26-CFR-1.162-1" */
  citation_key: string;

  /** Display title, e.g. "Trade or business expenses; in general" */
  title: string;

  /** ISO date string from the XML's @amdpar or version anchor */
  effective_date: string | null;

  /** Hierarchical path: "CFR/26/1.162-1" */
  structural_path: string;

  /** Full chunks under this document */
  chunks: ParsedChunk[];

  /** Section-level metadata captured for jsonb metadata column */
  metadata: Record<string, unknown>;
}

/**
 * One chunk = one DIV5 section text plus optional DIV8 sub-paragraphs.
 * For PR-G v1, we chunk at the DIV5 level only. Hierarchical
 * sub-chunking (DIV8 nesting) is deferred to a future PR if needed.
 */
export interface ParsedChunk {
  /** 0-based ordinal within the document */
  ordinal: number;

  /** Hierarchical path, e.g. "CFR/26/1.162-1/(a)" */
  structural_path: string;

  /** Display pinpoint, e.g. "§ 1.162-1(a)" */
  pinpoint: string | null;

  /** The chunk text (cleaned, no XML tags) */
  text: string;

  /** Approximate token count — caller computes via tokenizer */
  token_count: number;
}

/**
 * Summary returned from a single title's ingestion run.
 * Used for the audit log payload and for the Inngest function's return value.
 */
export interface TitleIngestSummary {
  title_number: number;
  title_name: string;
  outcome: 'unchanged' | 'ingested' | 'failed';
  documents_inserted: number;
  chunks_inserted: number;
  documents_superseded: number;
  error_message?: string;
  ecfr_up_to_date_as_of?: string;
  raw_xml_sha256?: string;
  duration_ms: number;
}

/**
 * Aggregate summary across all titles processed in one cron run.
 * Returned by the Inngest function and written to audit_log on completion.
 */
export interface RunSummary {
  started_at: string;
  completed_at: string;
  titles_total: number;
  titles_unchanged: number;
  titles_ingested: number;
  titles_failed: number;
  documents_inserted_total: number;
  chunks_inserted_total: number;
  per_title: TitleIngestSummary[];
}
