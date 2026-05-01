/**
 * src/lib/corpus/ingest/ecfr-parse.ts
 *
 * Walks eCFR XML payloads and produces ParsedDocument objects.
 *
 * eCFR XML structure (relevant elements):
 *   <DIV1 TYPE="TITLE" N="26">  — entire title
 *     <DIV3 TYPE="CHAPTER" N="I">
 *       <DIV4 TYPE="SUBCHAPTER" N="A">
 *         <DIV5 TYPE="SECTION" N="1.162-1">  ← we chunk at this level
 *           <HEAD>§ 1.162-1   Trade or business expenses.</HEAD>
 *           <DIV8 TYPE="PARAGRAPH" N="(a)">  ← paragraph-level (currently flat)
 *             <P>...text...</P>
 *
 * For PR-G v1, we create one ParsedDocument per DIV5 and one ParsedChunk
 * per DIV5 (whole-section). Future PRs may sub-chunk at DIV8 if relevance
 * scoring shows it improves retrieval.
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
 * Recursively collect all DIV5 elements from a parsed XML tree.
 * Returns array of DIV5 nodes with their attributes and content.
 */
function collectDiv5Nodes(node: unknown, acc: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return acc;
  const obj = node as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'DIV5') {
      if (Array.isArray(value)) {
        acc.push(...value);
      } else {
        acc.push(value);
      }
    } else if (typeof value === 'object' && value !== null) {
      collectDiv5Nodes(value, acc);
    }
  }

  return acc;
}

/**
 * Strip XML/HTML tags from a node and return the concatenated text content.
 * Walks the parsed tree; concatenates all #text values.
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
 * Approximate token count: ~4 characters per token for English prose.
 * A more precise tokenizer (tiktoken) would be used in PR-J for embedding
 * cost calculation; here we just need an order-of-magnitude estimate.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Parse one title's XML payload into ParsedDocument[] (one per DIV5).
 *
 * @param xmlBuffer raw XML bytes from fetchTitleXml
 * @param titleNumber CFR title number (1-50) — for citation_key construction
 * @param effectiveDate the up_to_date_as_of date this XML represents
 * @returns array of ParsedDocument; empty array if title is reserved/empty
 */
export function parseTitleToDocuments(
  xmlBuffer: Buffer,
  titleNumber: number,
  effectiveDate: string
): ParsedDocument[] {
  const xmlString = xmlBuffer.toString('utf-8');
  const parsed = parser.parse(xmlString);

  const div5Nodes = collectDiv5Nodes(parsed);

  const documents: ParsedDocument[] = [];

  for (const div5 of div5Nodes) {
    if (!div5 || typeof div5 !== 'object') continue;
    const node = div5 as Record<string, unknown>;

    const sectionNumber = (node['@_N'] as string | undefined) ?? '';
    const sectionType = (node['@_TYPE'] as string | undefined) ?? '';

    if (!sectionNumber) continue;

    const head = extractText(node['HEAD']);
    const bodyText = extractText(node);

    if (!bodyText) continue;

    const citationKey = `${titleNumber}-CFR-${sectionNumber}`;
    const structuralPath = `CFR/${titleNumber}/${sectionNumber}`;
    const pinpoint = `§ ${sectionNumber}`;

    const chunk: ParsedChunk = {
      ordinal: 0,
      structural_path: structuralPath,
      pinpoint,
      text: bodyText,
      token_count: estimateTokens(bodyText),
    };

    documents.push({
      citation_key: citationKey,
      title: head || `CFR Title ${titleNumber} § ${sectionNumber}`,
      effective_date: effectiveDate,
      structural_path: structuralPath,
      chunks: [chunk],
      metadata: {
        section_type: sectionType,
        section_number: sectionNumber,
        title_number: titleNumber,
      },
    });
  }

  return documents;
}
