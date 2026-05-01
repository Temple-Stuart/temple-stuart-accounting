/**
 * src/lib/corpus/ingest/irb-fetch.ts
 *
 * HTTP layer for the Internal Revenue Bulletin at irs.gov/irb.
 *
 * Unlike PR-I (Federal Register has a JSON API), the IRS publishes
 * IRBs as static HTML rendered from internal DocBook XML by their
 * Drupal CMS. We discover issues by scraping the /irb landing page,
 * then fetch each issue's per-issue HTML for parsing.
 *
 * Three endpoints:
 *
 *   GET /irb
 *     IRB landing page. Lists all available issues by year+number.
 *     We parse this with cheerio to find issue links and metadata.
 *
 *   GET /irb/{YYYY}-{NN}_IRB
 *     Per-issue HTML page. Drupal-rendered DocBook content with
 *     div.article children for each guidance item.
 *
 *   HEAD /irb/{YYYY}-{NN}_IRB
 *     For Last-Modified change detection on already-stored issues.
 *
 * No published rate limit. Throttle conservatively at 2 concurrent.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.3
 */

import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

const IRS_BASE = 'https://www.irs.gov';
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
        `IRB fetch failed (permanent): ${response.status} ${response.statusText} for ${url}`
      );
    }
    if (attempt === 0) {
      await sleep(1000);
      continue;
    }
    throw new Error(
      `IRB fetch failed (after retry): ${response.status} ${response.statusText} for ${url}`
    );
  }
  throw new Error('IRB fetch failed: exhausted retries');
}

/**
 * One IRB issue as discovered from the /irb landing page.
 */
export interface IrbIndexEntry {
  /** "2026-19" form, where 19 is the week number within the year */
  issue_id: string;
  year: number;
  /** Issue number within the year (1-52) */
  number: number;
  /** ISO date if discoverable from the landing page */
  publication_date: string | null;
  /** Full URL to the per-issue HTML page */
  html_url: string;
  /** Full URL to the per-issue PDF (for change-detection fallback) */
  pdf_url: string;
}

export interface IrbIssueHeaders {
  issue_id: string;
  last_modified: string | null;
  content_length: number | null;
  etag: string | null;
}

/**
 * Parse the /irb landing page HTML to extract a list of available
 * IRB issues. The landing page lists per-year sections containing
 * links to per-issue HTML pages.
 *
 * Pattern observed: per-year tables with links like
 *   <a href="/irb/2026-19_IRB">2026-19</a>
 * accompanied by per-row publication dates.
 *
 * Throws if the page parses to zero issues — fail-loud rather than
 * silently producing an empty index.
 */
export function extractIrbIndex(html: string): IrbIndexEntry[] {
  const $ = cheerio.load(html);
  const entries: IrbIndexEntry[] = [];
  const seen = new Set<string>();

  // Walk all anchors that look like issue links.
  $('a[href*="/irb/"]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/irb\/(\d{4})-(\d{1,2})_IRB$/);
    if (!match) return;

    const year = Number(match[1]);
    const number = Number(match[2]);
    const issueId = `${year}-${number}`;

    if (seen.has(issueId)) return;
    seen.add(issueId);

    // Try to extract a date from the surrounding row context. The
    // /irb landing page often has a sibling cell with the publication
    // date. Best-effort: walk the closest <tr> for a YYYY-MM-DD or
    // textual date.
    let publicationDate: string | null = null;
    const rowText = $(el).closest('tr').text();
    const dateMatch = rowText.match(
      /(\d{4})-(\d{2})-(\d{2})|(\w+\s+\d{1,2},?\s+\d{4})/
    );
    if (dateMatch) {
      const isoForm = dateMatch[1]
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
        : new Date(dateMatch[4]).toISOString().slice(0, 10);
      if (!isNaN(new Date(isoForm).getTime())) {
        publicationDate = isoForm;
      }
    }

    const fullHtmlUrl = href.startsWith('http') ? href : `${IRS_BASE}${href}`;
    const padded = String(number).padStart(2, '0');
    const yearShort = String(year).slice(2);
    const pdfUrl = `${IRS_BASE}/pub/irs-irbs/irb${yearShort}-${padded}.pdf`;

    entries.push({
      issue_id: issueId,
      year,
      number,
      publication_date: publicationDate,
      html_url: fullHtmlUrl,
      pdf_url: pdfUrl,
    });
  });

  if (entries.length === 0) {
    throw new Error(
      'IRB landing page parse failed: no issue links found. ' +
        'The page structure may have changed; manual investigation required.'
    );
  }

  return entries;
}

/**
 * GET /irb and extract the issue index.
 */
export async function fetchIrbIndex(): Promise<IrbIndexEntry[]> {
  return limit(async () => {
    const url = `${IRS_BASE}/irb`;
    const response = await fetchWithRetry(url);
    const html = await response.text();
    return extractIrbIndex(html);
  });
}

/**
 * GET one IRB issue's HTML page. Returns raw HTML string for
 * parsing by irb-parse.
 */
export async function fetchIssueHtml(htmlUrl: string): Promise<string> {
  return limit(async () => {
    const response = await fetchWithRetry(htmlUrl);
    return await response.text();
  });
}

/**
 * HEAD request for change-detection on an already-stored issue.
 */
export async function fetchIssueHeaders(
  issueId: string,
  htmlUrl: string
): Promise<IrbIssueHeaders> {
  return limit(async () => {
    const response = await fetchWithRetry(htmlUrl, { method: 'HEAD' });
    return {
      issue_id: issueId,
      last_modified: response.headers.get('last-modified'),
      content_length: response.headers.get('content-length')
        ? Number(response.headers.get('content-length'))
        : null,
      etag: response.headers.get('etag'),
    };
  });
}
