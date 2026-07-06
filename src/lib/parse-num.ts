/**
 * KILL-2: ingestion-boundary numeric parsing.
 *
 * Standing rulings (constitution): a true 0 from the source IS data — only
 * absent/unparseable is missing; missing is null + declared, never 0.
 * These helpers replace the `Number(x || 0)` pattern, which imputed 0 for
 * absent fields (and let DXFeed "NaN" strings leak NaN into math).
 */

/** Absent (null/undefined/'') or unparseable/non-finite → null. A real 0 stays 0. */
export function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** First parseable candidate wins (source field preference order, e.g. the three
 *  TastyTrade IV-rank field spellings). All absent/unparseable → null. */
export function firstNumOrNull(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = numOrNull(v);
    if (n != null) return n;
  }
  return null;
}
