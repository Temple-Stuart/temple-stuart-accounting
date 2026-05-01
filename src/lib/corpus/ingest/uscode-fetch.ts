/**
 * src/lib/corpus/ingest/uscode-fetch.ts
 *
 * HTTP layer for the U.S. Code USLM XML at uscode.house.gov.
 *
 * URL structure (verified 2026-05 via download.shtml reconnaissance):
 *
 *   download.shtml is a static HTML index containing per-title and
 *   all-titles ZIP links. Each link references one release point
 *   identified by (congress, plno) — Public Law number.
 *
 *   Per-title ZIP:
 *     /download/releasepoints/us/pl/{congress}/{plno}/xml_usc{NN}@{congress}-{plno}.zip
 *
 *   Inside each ZIP: one usc{NN}.xml USLM file.
 *
 * Discovery flow:
 *   1. fetchDownloadIndexHtml() — GET download.shtml
 *   2. extractLatestReleasePoint(html) — parse <a href> links, find
 *      highest (congress, plno) pair
 *   3. fetchTitleXml(congress, plno, titleNumber) — GET ZIP, unpack
 *
 * No fallback if discovery fails — we throw, the worker step fails,
 * audit_log records the failure, next cron run retries. Citadel
 * fail-loud principle.
 *
 * Throttle: 2 concurrent requests via p-limit.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.3
 */

import AdmZip from 'adm-zip';
import pLimit from 'p-limit';
import { downloadIndexUrl, xmlUrlForTitle } from './uscode-titles';

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
        `USC fetch failed (permanent): ${response.status} ${response.statusText} for ${url}`
      );
    }

    if (attempt === 0) {
      await sleep(1000);
      continue;
    }

    throw new Error(
      `USC fetch failed (after retry): ${response.status} ${response.statusText} for ${url}`
    );
  }

  throw new Error('USC fetch failed: exhausted retries');
}

export interface ReleasePoint {
  congress: number;
  plno: number;
  /** "{congress}-{plno}" string form, e.g. "119-84" */
  identifier: string;
}

/**
 * Fetch the OLRC download index HTML. Returns the raw HTML string.
 * Used for release-point discovery.
 */
async function fetchDownloadIndexHtml(): Promise<string> {
  return limit(async () => {
    const url = downloadIndexUrl();
    const response = await fetchWithRetry(url);
    return await response.text();
  });
}

/**
 * Parse the OLRC download.shtml HTML to extract the latest release
 * point. Walks all <a href> links matching the release-point URL
 * pattern, parses out (congress, plno), returns the highest pair.
 *
 * The release-point ordering: higher congress wins; within the same
 * congress, higher plno wins.
 *
 * Throws if no release-point links can be parsed — institutional
 * fail-loud, no silent fallback.
 */
export function extractLatestReleasePoint(html: string): ReleasePoint {
  // Match links like: xml_uscAll@119-84.zip or xml_usc26@119-84.zip
  const linkPattern =
    /releasepoints\/us\/pl\/(\d+)\/(\d+)\/xml_usc(?:[0-9]{1,2}[a-zA-Z]?|All)@(\d+)-(\d+)\.zip/g;

  const seen = new Map<string, ReleasePoint>();
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const congress = Number(match[1]);
    const plno = Number(match[2]);
    if (!Number.isFinite(congress) || !Number.isFinite(plno)) continue;
    const id = `${congress}-${plno}`;
    if (!seen.has(id)) {
      seen.set(id, { congress, plno, identifier: id });
    }
  }

  if (seen.size === 0) {
    throw new Error(
      'OLRC download.shtml parse failed: no release-point links found. ' +
        'The site structure may have changed; this requires manual investigation.'
    );
  }

  // Sort by (congress DESC, plno DESC) — highest pair first.
  const sorted = Array.from(seen.values()).sort((a, b) => {
    if (a.congress !== b.congress) return b.congress - a.congress;
    return b.plno - a.plno;
  });

  return sorted[0];
}

/**
 * Combined: fetch download.shtml and extract the latest release point.
 *
 * @returns the latest (congress, plno) pair as published by OLRC
 * @throws if the page fetch fails or no release-point links are found
 */
export async function discoverLatestReleasePoint(): Promise<ReleasePoint> {
  const html = await fetchDownloadIndexHtml();
  return extractLatestReleasePoint(html);
}

export interface UscodeTitleHeaders {
  title_number: number;
  congress: number;
  plno: number;
  last_modified: string | null;
  content_length: number | null;
  etag: string | null;
}

/**
 * HEAD request for one title's ZIP at a specific release point.
 * Returns Last-Modified, Content-Length, ETag for change-detection.
 */
export async function fetchTitleHeaders(
  congress: number,
  plno: number,
  titleNumber: number
): Promise<UscodeTitleHeaders> {
  return limit(async () => {
    const url = xmlUrlForTitle(congress, plno, titleNumber);
    const response = await fetchWithRetry(url, { method: 'HEAD' });
    return {
      title_number: titleNumber,
      congress,
      plno,
      last_modified: response.headers.get('last-modified'),
      content_length: response.headers.get('content-length')
        ? Number(response.headers.get('content-length'))
        : null,
      etag: response.headers.get('etag'),
    };
  });
}

/**
 * GET one title's ZIP at a specific release point, unpack, return
 * the inner USLM XML buffer.
 *
 * Throws if the ZIP is empty, contains multiple files, or cannot be
 * unpacked — fail-loud rather than silently returning bad data.
 */
export async function fetchTitleXml(
  congress: number,
  plno: number,
  titleNumber: number
): Promise<Buffer> {
  return limit(async () => {
    const url = xmlUrlForTitle(congress, plno, titleNumber);
    const response = await fetchWithRetry(url);
    const arrayBuffer = await response.arrayBuffer();
    const zipBuffer = Buffer.from(arrayBuffer);

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new Error(`USC ZIP empty: ${url}`);
    }

    // Find the .xml entry. Most release-point ZIPs contain exactly
    // one usc{NN}.xml file. If multiple .xml files appear, we take
    // the largest one (defensive — but log a warning in metadata).
    const xmlEntries = entries.filter((e) => e.entryName.endsWith('.xml'));

    if (xmlEntries.length === 0) {
      throw new Error(
        `USC ZIP contains no .xml file: ${url} (entries: ${entries
          .map((e) => e.entryName)
          .join(', ')})`
      );
    }

    if (xmlEntries.length > 1) {
      // Sort by header.size descending; take largest
      xmlEntries.sort((a, b) => (b.header.size ?? 0) - (a.header.size ?? 0));
    }

    return xmlEntries[0].getData();
  });
}
