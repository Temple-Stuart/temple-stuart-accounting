/**
 * src/lib/corpus/ingest/uscode-parse.ts
 *
 * Walks USLM XML payloads (U.S. Code) and produces ParsedDocument
 * objects. One ParsedDocument per <section>; one ParsedChunk per
 * section (whole-section, small-to-big pattern matching PR-G).
 *
 * USLM structure (relevant elements, USLM 1.0 — verified 2026-05 via
 * reconnaissance against actual OLRC release-point XML):
 *   <uscDoc xmlns="http://xml.house.gov/schemas/uslm/1.0">
 *     <meta>...</meta>
 *     <main>
 *       <title>
 *         <subtitle>
 *           <chapter>
 *             <subchapter>
 *               <part>
 *                 <section identifier="/us/usc/t26/s162">
 *                   <num value="162">§ 162.</num>
 *                   <heading>Trade or business expenses</heading>
 *                   <content>
 *                     <p>...</p>
 *                   </content>
 *
 * Citation key: 26-USC-162 (parallels PR-G's 26-CFR-1.162-1).
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.2
 */

import { XMLParser } from 'fast-xml-parser';
import type { ParsedDocument, ParsedChunk } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  trimValues: true,
});

/**
 * Recursively collect all <section> elements from a parsed XML tree.
 * Returns array of section nodes with attributes and content.
 */
function collectSectionNodes(node: unknown, acc: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return acc;
  const obj = node as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'section') {
      if (Array.isArray(value)) {
        acc.push(...value);
      } else {
        acc.push(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      collectSectionNodes(value, acc);
    }
  }

  return acc;
}

/**
 * Strip XML/HTML tags and concatenate all text content under a node.
 */
function extractText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';

  const obj = node as Record<string, unknown>;

  if ('#text' in obj && typeof obj['#text'] === 'string') {
    return obj['#text'];
  }

  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_')) continue;
    if (key === '#text') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        parts.push(extractText(item));
      }
    } else {
      parts.push(extractText(value));
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Approximate token count for chunk size estimation.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract the section number from a USLM identifier attribute.
 *
 * Identifier format: "/us/usc/t26/s162" or "/us/usc/t26/s162a"
 * (some sections have letter suffixes like "162A" or numbered
 * subsections like "162.5").
 *
 * Returns just the section identifier portion (everything after
 * the final 's'). Returns null if the identifier doesn't match the
 * expected format.
 */
function extractSectionId(identifier: string): string | null {
  const match = identifier.match(/\/s([^/]+)$/);
  return match ? match[1] : null;
}

/**
 * Parse one USC title's USLM XML payload into ParsedDocument[].
 * One ParsedDocument per <section> element.
 *
 * @param xmlBuffer raw USLM XML bytes from fetchTitleXml
 * @param titleNumber USC title number (1-54)
 * @param effectiveDate the Last-Modified date this XML represents
 * @returns array of ParsedDocument; empty if title has no parseable sections
 */
export function parseUscTitleToDocuments(
  xmlBuffer: Buffer,
  titleNumber: number,
  effectiveDate: string
): ParsedDocument[] {
  const xmlString = xmlBuffer.toString('utf-8');
  const parsed = parser.parse(xmlString);

  const sectionNodes = collectSectionNodes(parsed);

  const documents: ParsedDocument[] = [];

  for (const section of sectionNodes) {
    if (!section || typeof section !== 'object') continue;
    const node = section as Record<string, unknown>;

    const identifier = (node['@_identifier'] as string | undefined) ?? '';
    if (!identifier) continue;

    const sectionId = extractSectionId(identifier);
    if (!sectionId) continue;

    // Skip <section> elements that are repealed/reserved/transferred —
    // they have a status attribute. We still ingest them as placeholders
    // for citation graph completeness, but mark in metadata.
    const status = (node['@_status'] as string | undefined) ?? null;

    const num = extractText(node['num']);
    const heading = extractText(node['heading']);
    const bodyText = extractText(node);

    if (!bodyText) continue;

    const citationKey = `${titleNumber}-USC-${sectionId}`;
    const structuralPath = `USC/${titleNumber}/${sectionId}`;
    const pinpoint = num || `§ ${sectionId}`;

    const chunk: ParsedChunk = {
      ordinal: 0,
      structural_path: structuralPath,
      pinpoint,
      text: bodyText,
      token_count: estimateTokens(bodyText),
    };

    const title = heading
      ? `${pinpoint} ${heading}`
      : `USC Title ${titleNumber} ${pinpoint}`;

    documents.push({
      citation_key: citationKey,
      title,
      effective_date: effectiveDate,
      structural_path: structuralPath,
      chunks: [chunk],
      metadata: {
        section_id: sectionId,
        title_number: titleNumber,
        uslm_identifier: identifier,
        status: status ?? 'active',
      },
    });
  }

  return documents;
}
