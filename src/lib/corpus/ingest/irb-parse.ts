/**
 * src/lib/corpus/ingest/irb-parse.ts
 *
 * Cheerio-based parser for IRB issue HTML. Splits one issue into
 * multiple ParsedDocument objects, one per guidance item.
 *
 * IRB issue HTML structure (Drupal-rendered DocBook):
 *
 *   div.field--name-body
 *     div.book
 *       div.titlepage h1 "Internal Revenue Bulletin: 2026-19"
 *       div.part
 *         div.titlepage h1 "HIGHLIGHTS OF THIS ISSUE"
 *         div.article  ← non-authoritative summary, SKIP
 *           ...
 *       div.part
 *         div.titlepage h1 "Part I"
 *         div.article  ← authoritative content, INGEST
 *           div.titlepage h2 a[name="REV-RUL-2026-9"]
 *           div.sect1 ...
 *           p ...
 *
 * Each authoritative article becomes one ParsedDocument with one
 * ParsedChunk holding the full text. Metadata records the IRB issue
 * identifier, the citation form, and the inferred doc_type.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.2
 */

import * as cheerio from 'cheerio';
import type { ParsedDocument } from './types';
import { chunkText } from './chunker';

/**
 * Map a citation-key prefix to our free-text doc_type values.
 * Matches the Renaissance source-granularity principle: distinct
 * legal forms get distinct doc_types.
 */
export function mapCitationToDocType(citationKey: string): string {
  const upper = citationKey.toUpperCase();
  if (upper.startsWith('REV-RUL-')) return 'revenue_ruling';
  if (upper.startsWith('REV-PROC-')) return 'revenue_procedure';
  if (upper.startsWith('NOTICE-') || upper.startsWith('NOT-'))
    return 'irs_notice';
  if (upper.startsWith('ANN-') || upper.startsWith('ANNOUNCEMENT-'))
    return 'irs_announcement';
  if (upper.startsWith('REG-')) return 'proposed_regulation';
  if (upper.startsWith('TD-') || upper.startsWith('TREASURY-DECISION-'))
    return 'treasury_decision';
  return 'irs_guidance';
}

/**
 * Normalize an anchor name to the canonical citation_key form.
 * Anchors may appear as REV-RUL-2026-9, REV.RUL.2026-9, REV_RUL_2026_9,
 * or rev-rul-2026-9. We canonicalize to UPPERCASE-HYPHEN form.
 */
function normalizeCitation(anchor: string): string {
  return anchor.replace(/[._]/g, '-').toUpperCase();
}

/**
 * Parse one IRB issue's HTML into an array of ParsedDocument objects.
 *
 * @param html raw HTML from fetchIssueHtml
 * @param issueId "2026-19" form
 * @param publicationDate ISO date string for the issue's publication
 * @returns array of ParsedDocument; HIGHLIGHTS articles excluded
 */
export function parseIrbIssue(
  html: string,
  issueId: string,
  publicationDate: string
): ParsedDocument[] {
  const $ = cheerio.load(html);
  const documents: ParsedDocument[] = [];
  const seenCitations = new Set<string>();

  // Find the body container. Drupal renders IRB content inside this
  // specific div class.
  const body = $('div.field--name-body').first();
  if (body.length === 0) {
    // Fail-loud: unexpected page structure.
    throw new Error(
      `IRB parse failed for issue ${issueId}: no div.field--name-body found. ` +
        'Drupal page structure may have changed.'
    );
  }

  // Walk all div.article descendants.
  body.find('div.article').each((_i, articleEl) => {
    const $article = $(articleEl);

    // Exclude HIGHLIGHTS articles. They live inside a div.part whose
    // titlepage h1 contains the word "HIGHLIGHTS". HIGHLIGHTS items
    // are explicitly non-authoritative per IRB convention.
    const $parentPart = $article.closest('div.part');
    if ($parentPart.length > 0) {
      const partHeading = $parentPart
        .find('> div.titlepage h1')
        .first()
        .text()
        .toUpperCase();
      if (partHeading.includes('HIGHLIGHTS')) return;
    }

    // Find the first <a name="..."> anchor inside this article.
    // The anchor encodes the citation directly.
    const $anchor = $article.find('a[name]').first();
    const rawAnchor = $anchor.attr('name') ?? '';
    if (!rawAnchor) return;

    const citationKey = normalizeCitation(rawAnchor);

    // Filter: only ingest anchors that look like citations (have a
    // four-digit year segment). Skip generic anchors like "id2".
    if (!/[A-Z]+-\d{4}-\d+/.test(citationKey)) return;

    // Dedupe — DocBook can have multiple <a name="..."> per article
    // for cross-references; we want only the first.
    if (seenCitations.has(citationKey)) return;
    seenCitations.add(citationKey);

    // Extract the title from the first heading after the anchor.
    // The heading is typically inside div.titlepage h2 or h3.
    const headingText = $article
      .find('div.titlepage h1, div.titlepage h2, div.titlepage h3')
      .first()
      .text()
      .trim()
      .replace(/\s+/g, ' ');

    // Extract the body text. Concatenate all <p> text under this
    // article. Skip <p> elements inside titlepage divs (those are
    // headings already captured above).
    const paragraphs: string[] = [];
    $article.find('p').each((_j, pEl) => {
      const $p = $(pEl);
      // Skip paragraphs inside titlepage divs.
      if ($p.parents('div.titlepage').length > 0) return;
      const text = $p.text().trim().replace(/\s+/g, ' ');
      if (text.length > 0) paragraphs.push(text);
    });

    const bodyText = paragraphs.join('\n\n');
    if (bodyText.length === 0) return;

    const docType = mapCitationToDocType(citationKey);
    const structuralPath = `IRB/${issueId}/${citationKey}`;

    const title = headingText || `${citationKey} (IRB ${issueId})`;

    documents.push({
      citation_key: citationKey,
      title,
      effective_date: publicationDate,
      structural_path: structuralPath,
      chunks: chunkText(bodyText, {
        structuralPath,
        pinpoint: citationKey,
      }),
      metadata: {
        irb_issue_id: issueId,
        irb_publication_date: publicationDate,
        citation_form: citationKey,
        doc_type_inferred: docType,
        anchor_raw: rawAnchor,
      },
    });
  });

  return documents;
}
