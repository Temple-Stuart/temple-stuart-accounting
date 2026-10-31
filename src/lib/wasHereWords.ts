/**
 * WASHERE-01 (Alex, 2026-10-31) — THE WORDS a trip-log row is shown in. PURE: no
 * clock, no locale call, no fetch, no React. It imports the leaf's types and the
 * ONE dateWords / dayWords from experienceWords.ts — never a second.
 *
 *   wasHereLabel(row)   end null → "I'M HERE" · end set → "I WAS HERE"
 *   stayWords(row)      end null → "Since Oct 22, 2026" · end set → dateWords(start, end)
 *   newestFirst(rows)   the rows by start, descending — derived, a copy
 */

import type { WasHereRow } from './wasHere';
import { dateWords, dayWords } from './experienceWords';

export function wasHereLabel(row: WasHereRow): string {
  return row.end === null ? 'I\'M HERE' : 'I WAS HERE';
}

export function stayWords(row: WasHereRow): string {
  return row.end === null ? `Since ${dayWords(row.start)}` : dateWords(row.start, row.end);
}

export function newestFirst(rows: readonly WasHereRow[]): WasHereRow[] {
  return [...rows].sort((a, b) => b.start.localeCompare(a.start));
}
