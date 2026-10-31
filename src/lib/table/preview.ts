/**
 * THE TABLE IDIOM'S LONG-TEXT PREVIEW (COLUMNS-01b, Alex, 2026-10-25, ruling 3).
 *
 * Lifted verbatim from the journal tables' rule (src/lib/operations/journalTables.ts,
 * JOURNAL-07 ruling E) now that two tables draw it — the journal tables and
 * PROJECTS, both through components/table/TextCell.tsx: a TEXT cell shows its text
 * in full when it fits, else its first 160 code points, how many there are
 * ("… (n chars)") and a control, "all of it" / "less". The spec keeps the FULL text
 * (the filter, the sort and the CSV read it); only the screen previews. Pure.
 */

export const PREVIEW_CHARS = 160;
/** "… (420 chars)" — after the first 160 code points. */
export const previewMoreWords = (chars: number): string => `… (${chars} chars)`;
/** A text in full when it fits, else its first 160 code points and how many there are — a character is never cut in half. */
export function previewOf(text: string): { readonly shown: string; readonly more: string | null } {
  const chars = [...text];
  if (chars.length <= PREVIEW_CHARS) return { shown: text, more: null };
  return { shown: chars.slice(0, PREVIEW_CHARS).join(''), more: previewMoreWords(chars.length) };
}
/** The control under a cut cell, and its twin once open. */
export const EXPAND_WORDS = 'all of it';
export const COLLAPSE_WORDS = 'less';
