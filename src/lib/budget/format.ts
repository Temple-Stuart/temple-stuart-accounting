/**
 * TAB13-02b — HOW THE BUDGET REPORT WRITES A FIGURE, PURE.
 *
 * The report model (src/lib/budget/report.ts) hands every figure as integer
 * cents, or null for a blank. This file is the one place those become text on
 * /budget:
 *
 *   · cents          → '$1,234.56'
 *   · negative cents → '−$12.00'  (U+2212, the typographic minus)
 *   · null           → '—'        (blank is not zero — never '$0.00')
 *   · a variance     → positive is favourable ('$12.00'); a NEGATIVE variance is
 *                      unfavourable and is written in parentheses, '($12.00)',
 *                      and flagged so the screen paints it brand red.
 *   · a budget line  → by its column's state (ruled 2026-09-27): a CLOSED column
 *                      shows the budget to date; an IN-PROGRESS one the budget
 *                      to date, "of <full>" when the full budget differs; a
 *                      FUTURE one the FULL budget, marked planned — nothing in
 *                      it is to date yet, and its actual and variance stay '—'.
 *   · an account     → its account string, by the app's ONE renderer
 *                      (src/lib/accountString.ts deriveAccountString) with its
 *                      book's entity type: B-5100, P-1500, T-1500 — never bare
 *                      digits, never a doubled letter; a book whose type has no
 *                      letter shows none, the renderer's own rule (TAB13-02c).
 *
 * Exact by construction: integer division and a remainder, no floating point,
 * no locale. A figure that is not a safe integer is refused by name — it never
 * reaches the screen as something it is not. A build law holds this file pure
 * (scripts/assert-tool-registry.ts, the budget report purity law).
 */

import { deriveAccountString } from '@/lib/accountString';
import type { ColumnState, ReportBook } from '@/lib/budget/report';

export const BLANK = '—';
const MINUS = '−';

export type BudgetFormatErrorCode = 'not-cents' | 'bad-state' | 'unknown-book';

/** A figure that is not a whole, safe number of cents, a column state that is not one, or an account of no book — the caller's bug, refused. */
export class BudgetFormatError extends Error {
  readonly code: BudgetFormatErrorCode;
  constructor(code: BudgetFormatErrorCode, message: string) {
    super(`BUDGET FORMAT: ${message}`);
    this.name = 'BudgetFormatError';
    this.code = code;
  }
}

function checkCents(cents: number): number {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) {
    throw new BudgetFormatError('not-cents', `${JSON.stringify(cents)} is not a safe integer number of cents`);
  }
  return cents;
}

/** '$1,234.56' for a magnitude of cents, by integer arithmetic. */
function dollars(magnitude: number): string {
  const whole = Math.floor(magnitude / 100);
  const rest = magnitude % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${grouped}.${String(rest).padStart(2, '0')}`;
}

/** Cents → '$1,234.56' · '−$12.00' · null → '—'. */
export function formatCents(cents: number | null): string {
  if (cents === null) return BLANK;
  const c = checkCents(cents);
  return c < 0 ? `${MINUS}${dollars(-c)}` : dollars(c);
}

export interface VarianceText {
  readonly text: string;
  /** True only for a negative variance — the screen paints it brand red. */
  readonly unfavourable: boolean;
}

/** A variance (positive is favourable): '$12.00' · '($12.00)' flagged unfavourable · null → '—'. */
export function formatVariance(cents: number | null): VarianceText {
  if (cents === null) return { text: BLANK, unfavourable: false };
  const c = checkCents(cents);
  return c < 0 ? { text: `(${dollars(-c)})`, unfavourable: true } : { text: dollars(c), unfavourable: false };
}

export interface BudgetText {
  /** The figure itself. */
  readonly text: string;
  /** What qualifies it: "of <full>" while in progress, "planned" in a future column; null when nothing does. */
  readonly note: string | null;
}

/** A cell's budget line, by its column's state. */
export function formatBudget(state: ColumnState, toDate: number | null, full: number | null): BudgetText {
  if (state === 'closed') return { text: formatCents(toDate), note: null };
  if (state === 'inProgress') return { text: formatCents(toDate), note: full !== toDate ? `of ${formatCents(full)}` : null };
  if (state === 'future') return { text: formatCents(full), note: full === null ? null : 'planned' };
  throw new BudgetFormatError('bad-state', `${JSON.stringify(state)} is not a column state (closed, inProgress, future)`);
}

/**
 * An account as /budget shows it (TAB13-02c): the report's book with that
 * entityId gives the entity type, and the app's one renderer draws the string.
 * The model builds one book per entity (report.ts), so an entityId with no book
 * is a bug — refused by name, never drawn without its letter.
 */
export function formatAccountCode(books: readonly Pick<ReportBook, 'entityId' | 'entityType'>[], entityId: string, code: string): string {
  const book = books.find((b) => b.entityId === entityId);
  if (!book) throw new BudgetFormatError('unknown-book', `no book of the report is entity ${JSON.stringify(entityId)} — account ${JSON.stringify(code)} cannot be drawn`);
  return deriveAccountString({ entityType: book.entityType, code });
}
