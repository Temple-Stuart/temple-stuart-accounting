/**
 * src/lib/corpus/ingest/fedreg-fetch.ts
 *
 * HTTP layer for the Federal Register API at federalregister.gov.
 *
 * The FR API is JSON-only with three endpoints we use:
 *
 *   GET /api/v1/documents.json
 *     Paginated list. Filter by publication_date range, sort by
 *     newest. Returns 100-1000 results per page.
 *
 *   GET /api/v1/documents/{document_number}.json
 *     Single document detail. Returns 47 fields including
 *     raw_text_url, body_html_url, full_text_xml_url, agencies,
 *     cfr_references, effective_on, citation, etc.
 *
 *   GET {rawTextUrl}
 *     Plain-text body. Returns text/plain. URL comes from the
 *     detail response's raw_text_url field.
 *
 * No published rate limit. Throttle conservatively at 2 concurrent.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.3
 */

import pLimit from 'p-limit';

const FR_API_BASE = 'https://www.federalregister.gov/api/v1';
const USER_AGENT =
  'TempleStuart-Compliance/1.0 (+https://templestuart.com; institutional-grade-corpus)';

const limit = pLimit(2);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = {
    ...(init?.headers ?? {}),
    'User-Agent': USER_AGENT,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { ...init, headers });
    if (response.ok) return response;
    if (response.status >= 400 && response.status < 500) {
      throw new Error(
        `FR fetch failed (permanent): ${response.status} ${response.statusText} for ${url}`
      );
    }
    if (attempt === 0) {
      await sleep(1000);
      continue;
    }
    throw new Error(
      `FR fetch failed (after retry): ${response.status} ${response.statusText} for ${url}`
    );
  }
  throw new Error('FR fetch failed: exhausted retries');
}

/**
 * Brief summary of one FR document, as returned in the list endpoint.
 * The list endpoint returns only ~10 fields per document; the detail
 * endpoint has ~47 fields. We use the list endpoint to discover
 * document_numbers and then fetch detail per-doc.
 */
export interface FedregListEntry {
  document_number: string;
  title: string;
  type: string; // "Rule" | "Proposed Rule" | "Notice" | "Presidential Document"
  abstract: string | null;
  publication_date: string; // ISO date
  html_url: string;
  pdf_url: string | null;
}

export interface FedregListResponse {
  count: number;
  total_pages: number;
  next_page_url: string | null;
  results: FedregListEntry[];
}

/**
 * Full detail for one FR document. Subset of the ~47 fields returned
 * by the detail endpoint; we capture the ones used in persist.
 */
export interface FedregDocumentDetail {
  document_number: string;
  title: string;
  type: string;
  abstract: string | null;
  publication_date: string;
  effective_on: string | null;
  citation: string | null;
  html_url: string;
  pdf_url: string | null;
  raw_text_url: string | null;
  body_html_url: string | null;
  full_text_xml_url: string | null;
  agencies: Array<{ id: number; name: string; raw_name?: string }>;
  cfr_references: Array<{ title: number; part?: number | null }>;
  docket_ids: string[];
  topics: string[];
  volume: number | null;
  start_page: number | null;
  end_page: number | null;
  comment_url: string | null;
  comments_close_on: string | null;
  president?: { name: string; identifier: string };
}

/**
 * GET /api/v1/documents.json — paginated list.
 *
 * @param sinceDate ISO date string (e.g. "2026-04-01"). Returns
 *                  documents with publication_date >= sinceDate.
 * @param page 1-indexed page number.
 * @param perPage 1-1000. We default to 100 for memory predictability.
 */
export async function fetchDocumentList(
  sinceDate: string,
  page: number = 1,
  perPage: number = 100
): Promise<FedregListResponse> {
  return limit(async () => {
    const params = new URLSearchParams({
      'conditions[publication_date][gte]': sinceDate,
      order: 'oldest',
      per_page: String(perPage),
      page: String(page),
    });
    const url = `${FR_API_BASE}/documents.json?${params.toString()}`;
    const response = await fetchWithRetry(url);
    return (await response.json()) as FedregListResponse;
  });
}

/**
 * GET /api/v1/documents/{document_number}.json — full document detail.
 */
export async function fetchDocumentDetail(
  documentNumber: string
): Promise<FedregDocumentDetail> {
  return limit(async () => {
    const url = `${FR_API_BASE}/documents/${documentNumber}.json`;
    const response = await fetchWithRetry(url);
    return (await response.json()) as FedregDocumentDetail;
  });
}

/**
 * GET the raw text body. URL comes from detail.raw_text_url.
 * Returns a UTF-8 string. Some older FR documents have null
 * raw_text_url; the caller should handle that case.
 */
export async function fetchDocumentRawText(
  rawTextUrl: string
): Promise<string> {
  return limit(async () => {
    const response = await fetchWithRetry(rawTextUrl);
    return await response.text();
  });
}
