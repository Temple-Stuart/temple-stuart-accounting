/**
 * lib/money.ts — the SINGLE money formatter + color convention (PR-Money-Convention).
 *
 * Convention (institutional bar — direction comes from the caller, NEVER guessed):
 *   - EXPENSE (money out: trips, costs)   → red,   NEGATIVE-signed:  "-$500"
 *   - P&L PROFIT (signed value ≥ 0)       → green, POSITIVE-signed:  "+$500"
 *   - P&L LOSS   (signed value < 0)       → red,   NEGATIVE-signed:  "-$500"
 *
 * An unsigned positive expense is STILL money out — so the formatter never infers
 * expense-vs-pnl from the sign. The caller passes `kind` explicitly. Colors use the
 * existing brand tokens (no hardcoded hex), matching Trading's green/red.
 */

export type MoneyKind = 'expense' | 'pnl';

const COLOR_GREEN = 'text-brand-green';
const COLOR_RED = 'text-brand-red';

/** Absolute dollars, no sign, with the given precision (default 2dp). */
function absDollars(value: number, fractionDigits = 2): string {
  return `$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/**
 * Format a money value with the convention's SIGN.
 *  - kind 'expense': money OUT → always "-$X" (value is the magnitude; sign forced negative).
 *  - kind 'pnl':     signed P&L → "+$X" when ≥ 0, "-$X" when < 0.
 */
export function formatMoney(
  value: number,
  opts: { kind: MoneyKind; fractionDigits?: number },
): string {
  const abs = absDollars(value, opts.fractionDigits ?? 2);
  if (opts.kind === 'expense') return `-${abs}`;        // money out is always negative
  return value >= 0 ? `+${abs}` : `-${abs}`;            // pnl: signed by value
}

/**
 * The convention's COLOR class.
 *  - expense → always red (money out).
 *  - pnl     → green when ≥ 0, red when < 0.
 */
export function moneyColorClass(value: number, kind: MoneyKind): string {
  if (kind === 'expense') return COLOR_RED;
  return value >= 0 ? COLOR_GREEN : COLOR_RED;
}

/**
 * Map a calendar event `source` to its money kind. The Trading P&L calendar tags events
 * 'win'/'loss' (trading/page.tsx:581) with a SIGNED amount; everything else (trip /
 * project / routine) is an unsigned cost. Direction stays explicit — not sign-derived.
 */
export function kindForSource(source: string): MoneyKind {
  return source === 'win' || source === 'loss' ? 'pnl' : 'expense';
}
