/**
 * ROUTINES-01 (2026-09-30) — A SAVED CODE IS DRAWN AS ITS ACCOUNT STRING.
 *
 * The routines table draws every code it shows — a routine's and a line's —
 * through this one helper. A code is saved as the chart row saves it
 * (planMoney.ts: bare "6110" or lettered "B-6240"), so drawing it verbatim shows
 * a bare 6110 on a P- book and would double a letter if one were prefixed. The
 * chart's own rule (scheme.ts parseCode, the book's entity type) reads the four
 * digits, and accountString.ts draws them with the book's letter: P-6110 — never
 * 6110, never B-B-5130.
 *
 * Four states, each with its words:
 *   blank                       → nothing is drawn
 *   the book is not in the list → "book not loaded"
 *   the rule cannot read it     → "not recognised: <the code as saved>"
 *   otherwise                   → the account string
 *
 * It takes the entity list, a book id and a saved code — never a routine — so a
 * line and its routine are drawn by the same rule. Pure: no fetch, no React.
 */
import { ValidationError } from '@/lib/errors/ValidationError';
import { parseCode } from '@/lib/coa/scheme';
import { deriveAccountString } from '@/lib/accountString';
import { isBlankPlanValue } from '@/lib/operations/planMoney';

/** One book of the entity list, as the operations tab loads it (EntitySelector.tsx). */
export interface AccountCellBook {
  readonly id: string;
  readonly entity_type: string;
}

export const ACCOUNT_CELL_WORDS = {
  bookNotLoaded: 'book not loaded',
  notRecognised: 'not recognised',
} as const;

export type AccountCell =
  | { readonly state: 'blank' }
  | { readonly state: 'book-not-loaded'; readonly text: string }
  | { readonly state: 'not-recognised'; readonly text: string }
  | { readonly state: 'account'; readonly text: string };

export function accountCell(books: readonly AccountCellBook[], bookId: string, saved: string | null | undefined): AccountCell {
  if (isBlankPlanValue(saved)) return { state: 'blank' };
  const book = books.find((b) => b.id === bookId);
  if (!book) return { state: 'book-not-loaded', text: ACCOUNT_CELL_WORDS.bookNotLoaded };
  let digits: string;
  try {
    digits = parseCode(saved, book.entity_type);
  } catch (error) {
    if (error instanceof ValidationError) return { state: 'not-recognised', text: `${ACCOUNT_CELL_WORDS.notRecognised}: ${saved}` };
    throw error;
  }
  return { state: 'account', text: deriveAccountString({ entityType: book.entity_type, code: digits }) };
}
