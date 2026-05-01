/**
 * src/lib/corpus/ingest/ecfr-fetch.ts
 *
 * HTTP layer for the eCFR public API.
 *
 *   GET /api/versioner/v1/titles.json
 *     → JSON list of all 50 titles with their up_to_date_as_of dates
 *
 *   GET /api/versioner/v1/full/{date}/title-{n}.xml
 *     → XML payload for one title at the specified date
 *
 * eCFR has no published rate limit. We throttle conservatively at 2
 * concurrent requests via p-limit, with a 1-second retry on transient
 * (5xx) failures.
 *
 * User-Agent identifies our system per RFC 7231 best practice for
 * automated public-API consumers.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.3
 */

import pLimit from 'p-limit';
import type { EcfrTitleListEntry } from './types';

const ECFR_BASE_URL = 'https://www.ecfr.gov/api/versioner/v1';
const USER_AGENT =
  'TempleStuart-Compliance/1.0 (+https://templestuart.com; institutional-grade-corpus)';

// Two concurrent eCFR requests at most. Higher would be uncivil; lower would
// stretch the daily ingest beyond its window unnecessarily.
const limit = pLimit(2);

/**
 * Sleep helper for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with one retry on 5xx. Throws on 4xx (treated as permanent).
 */
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
      // Permanent error — don't retry.
      throw new Error(
        `eCFR fetch failed (permanent): ${response.status} ${response.statusText} for ${url}`
      );
    }

    if (attempt === 0) {
      // 5xx — retry once after backoff.
      await sleep(1000);
      continue;
    }

    throw new Error(
      `eCFR fetch failed (after retry): ${response.status} ${response.statusText} for ${url}`
    );
  }

  // Unreachable due to throw, but TypeScript needs it.
  throw new Error('eCFR fetch failed: exhausted retries');
}

/**
 * GET https://www.ecfr.gov/api/versioner/v1/titles.json
 *
 * Returns an array of all 50 CFR titles with their version anchors.
 * The `up_to_date_as_of` field is the canonical version-lock anchor.
 */
export async function fetchTitleList(): Promise<EcfrTitleListEntry[]> {
  return limit(async () => {
    const url = `${ECFR_BASE_URL}/titles.json`;
    const response = await fetchWithRetry(url);
    const json = (await response.json()) as { titles: EcfrTitleListEntry[] };
    if (!json.titles || !Array.isArray(json.titles)) {
      throw new Error('eCFR titles.json response shape unexpected');
    }
    return json.titles;
  });
}

/**
 * GET https://www.ecfr.gov/api/versioner/v1/full/{date}/title-{n}.xml
 *
 * Returns the raw XML bytes for one title at the specified version date.
 * Use the `up_to_date_as_of` value from fetchTitleList() as the date.
 */
export async function fetchTitleXml(
  titleNumber: number,
  date: string
): Promise<Buffer> {
  return limit(async () => {
    const url = `${ECFR_BASE_URL}/full/${date}/title-${titleNumber}.xml`;
    const response = await fetchWithRetry(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  });
}
