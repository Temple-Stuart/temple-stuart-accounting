/**
 * src/lib/corpus/ingest/chunker.ts
 *
 * Recursive structure-aware text splitter for the regulatory corpus.
 *
 * Algorithm (per architecture doc § 1.2):
 *   1. If input <= target tokens, return as single chunk
 *   2. Split on paragraph boundaries (\n\n), pack paragraphs until
 *      target reached
 *   3. If a single paragraph exceeds target, split on sentence
 *      boundaries (matching . ! ? followed by whitespace)
 *   4. If a single sentence exceeds target, fall back to character-
 *      count splitting at target boundary
 *   5. Apply overlap by prepending last N chars of previous chunk
 *      to next (preserves context across chunk boundaries for
 *      retrieval quality)
 *
 * Defaults match architecture doc institutional defaults:
 *   target = 1500 tokens (well within doc's 500-2000 window)
 *   overlap = 200 tokens
 *
 * Token estimation uses the canonical char-length / 4 approximation
 * (consistent with parser-side estimates and conservative vs. real
 * BPE tokenization, leaving headroom under Voyage's 32K per-input cap).
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.2
 */

import type { ParsedChunk } from './types';

const DEFAULT_TARGET_TOKENS = 1500;
const DEFAULT_OVERLAP_TOKENS = 200;
const TOKENS_PER_CHAR = 0.25; // i.e. 4 chars per token

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR);
}

function tokensToChars(tokens: number): number {
  return Math.ceil(tokens / TOKENS_PER_CHAR);
}

/**
 * Split text on paragraph boundaries. Empty paragraphs are dropped.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split a single paragraph on sentence boundaries. Conservative regex:
 * matches . ! ? followed by whitespace and a capital letter (avoids
 * false splits on abbreviations like "U.S.C.").
 *
 * If no sentence boundaries found, returns the whole paragraph as
 * one element.
 */
function splitSentences(paragraph: string): string[] {
  const sentences: string[] = [];
  const matches = paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/);
  for (const m of matches) {
    const trimmed = m.trim();
    if (trimmed.length > 0) sentences.push(trimmed);
  }
  return sentences.length > 0 ? sentences : [paragraph];
}

/**
 * Hard character-count split. Final fallback when a single sentence
 * exceeds target. Splits at exact character boundaries with no
 * semantic awareness — only invoked for pathological inputs.
 */
function splitByChars(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    out.push(text.slice(i, i + maxChars));
  }
  return out;
}

/**
 * Pack a list of segments into chunks of <= target tokens each.
 * Each segment must already fit within target on its own.
 */
function packSegments(segments: string[], targetTokens: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const seg of segments) {
    const segTokens = estimateTokens(seg);
    if (currentTokens + segTokens <= targetTokens) {
      current.push(seg);
      currentTokens += segTokens;
    } else {
      if (current.length > 0) {
        chunks.push(current.join('\n\n'));
      }
      current = [seg];
      currentTokens = segTokens;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'));
  }

  return chunks;
}

/**
 * Apply overlap by prepending last N chars of previous chunk to next.
 * First chunk has no prefix.
 */
function applyOverlap(chunks: string[], overlapChars: number): string[] {
  if (chunks.length <= 1 || overlapChars <= 0) return chunks;

  const out: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1];
    const overlap = prev.slice(Math.max(0, prev.length - overlapChars));
    out.push(`${overlap}\n\n${chunks[i]}`);
  }
  return out;
}

/**
 * Recursively split text into chunks of <= target tokens.
 *
 * Pipeline:
 *   - If text fits, return single chunk
 *   - Split on paragraphs, recurse on any paragraph > target
 *   - Split oversized paragraphs on sentences, recurse on any
 *     sentence > target
 *   - Split oversized sentences by character count
 *   - Pack resulting segments into target-sized chunks
 *   - Apply overlap
 */
function recursiveSplit(text: string, targetTokens: number): string[] {
  if (estimateTokens(text) <= targetTokens) {
    return [text];
  }

  const targetChars = tokensToChars(targetTokens);
  const segments: string[] = [];

  for (const para of splitParagraphs(text)) {
    if (estimateTokens(para) <= targetTokens) {
      segments.push(para);
      continue;
    }
    // Paragraph too big — try sentence split
    for (const sent of splitSentences(para)) {
      if (estimateTokens(sent) <= targetTokens) {
        segments.push(sent);
      } else {
        // Sentence too big — character fallback
        for (const piece of splitByChars(sent, targetChars)) {
          segments.push(piece);
        }
      }
    }
  }

  return packSegments(segments, targetTokens);
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
  /** Base structural path (chunks get suffixed with #chunk-N/Total) */
  structuralPath: string;
  /** Base pinpoint (chunks get suffixed similarly if needed) */
  pinpoint?: string | null;
}

/**
 * Chunk a body of text into properly-sized ParsedChunk[].
 *
 * Always emits at least one chunk (empty input returns one empty chunk —
 * caller should guard against empty bodies upstream if that matters).
 *
 * For inputs that fit in one chunk: returns one ParsedChunk with the
 * caller's structural_path/pinpoint unchanged.
 *
 * For inputs requiring splitting: emits N chunks with
 *   ordinal: 0..N-1
 *   structural_path: `${base}#chunk-${i+1}/${N}`
 *   pinpoint: `${base}#chunk-${i+1}/${N}` (only suffixed when split occurs)
 */
export function chunkText(
  text: string,
  opts: ChunkOptions
): ParsedChunk[] {
  const targetTokens = opts.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const overlapChars = tokensToChars(overlapTokens);

  const rawChunks = recursiveSplit(text, targetTokens);
  const withOverlap = applyOverlap(rawChunks, overlapChars);
  const total = withOverlap.length;

  return withOverlap.map((chunkBody, i) => {
    const isSplit = total > 1;
    const suffix = isSplit ? `#chunk-${i + 1}/${total}` : '';
    return {
      ordinal: i,
      structural_path: `${opts.structuralPath}${suffix}`,
      pinpoint: opts.pinpoint
        ? `${opts.pinpoint}${suffix}`
        : (suffix || null),
      text: chunkBody,
      token_count: estimateTokens(chunkBody),
    };
  });
}

/**
 * Re-export for callers that want to estimate without invoking the
 * full splitter.
 */
export { estimateTokens };
