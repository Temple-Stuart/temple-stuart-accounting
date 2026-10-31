/**
 * stated — THE ONE TRI-STATE HELPER (HOTEL-01, 2026-09-22).
 *
 * FLIGHT-01 made a fare's attributes tri-state: true / false / null, where null
 * is the vendor's silence and never a default. A hotel rate says what it buys
 * the same way, so the helper lives here once and both leaves read it — the
 * flight leaf binds it to "not stated by the carrier", the hotel leaf to "not
 * stated by the property". There is no second implementation.
 *
 * PURE: no imports, no env, no fetch.
 */

/** True / false / null — null is the vendor's silence, never a default. */
export type Stated<T> = T | null;

/** A non-empty string the payload carried, else null. */
export function statedString(v: unknown): Stated<string> {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** A boolean the payload carried, else null — never `!!` (silence is not false). */
export function statedBoolean(v: unknown): Stated<boolean> {
  return typeof v === 'boolean' ? v : null;
}

/** A finite number the payload carried, else null. */
export function statedNumber(v: unknown): Stated<number> {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** The words a tri-state attribute renders as: the yes text, the no text, or the vendor's silence named. */
export function stated(v: Stated<boolean> | undefined, yes: string, no: string, absent: string): string {
  if (v === true) return yes;
  if (v === false) return no;
  return absent;
}
