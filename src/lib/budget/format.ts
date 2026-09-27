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
 *
 * Exact by construction: integer division and a remainder, no floating point,
 * no locale. A figure that is not a safe integer is refused by name — it never
 * reaches the screen as something it is not. A build law holds this file pure
 * (scripts/assert-tool-registry.ts, the budget report purity law).
 */

export const BLANK = '—';
const MINUS = '−';

/** A figure that is not a whole, safe number of cents — the caller's bug, refused. */
export class BudgetFormatError extends Error {
  readonly code = 'not-cents' as const;
  constructor(value: unknown) {
    super(`BUDGET FORMAT: ${JSON.stringify(value)} is not a safe integer number of cents`);
    this.name = 'BudgetFormatError';
  }
}

function checkCents(cents: number): number {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) throw new BudgetFormatError(cents);
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
