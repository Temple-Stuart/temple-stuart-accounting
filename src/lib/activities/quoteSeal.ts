/**
 * quoteSeal — THE SERVER SEALS THE FIGURES IT READ (ACTIVITY-01 STEP 4b, 2026-09-22).
 *
 * STEP 4 let the browser post the figures a tour's line was built from — the party's
 * native cost, the vendor's rate, the operator's zone, title, start time and duration
 * — and the commit could only check them against each other (total = native × rate,
 * note = the facts, rate unexpired). The band unit prices were never posted, so the
 * commit could not recompute the native figure at all. Trip ownership is checked
 * first (vendor-commit reads the trip WHERE userId = the authed user), so the blast
 * radius was one founder's own ledger — but the line says "Viator rate as of
 * 2026-09-21T23:59:59Z … calculated", and a sentence like that has to be provable by
 * the server that wrote it.
 *
 * So the options route now SEALS the quote it read from Viator, and the commit takes
 * no figure from the client at all: it verifies the seal, then recomputes everything
 * from the sealed quote and the party.
 *
 *   key  = HMAC-SHA256(JWT_SECRET, 'temple-stuart/viator-quote/v1')
 *   seal = HMAC-SHA256(key, canonicalJson(quote))   → 64 lowercase hex characters
 *
 * The key is DERIVED, not JWT_SECRET itself: src/lib/cookie-auth.ts signs the session
 * cookie with HMAC-SHA256(JWT_SECRET, email), so an undomained quote seal would share
 * a key with the session cookie and a value valid in one context could be presented in
 * the other. The one-way derivation over a version string keeps the two apart and
 * leaves room for v2 without a new environment variable — this file reads only
 * JWT_SECRET, which envLaw already requires, and THROWS when it is absent (fail
 * closed: no secret, no seal, no Save — never an unsealed quote).
 *
 * canonicalJson is the sealed form: object keys sorted by code unit, no whitespace,
 * arrays in their own order, `undefined` members dropped. Two structurally equal
 * quotes therefore seal identically however JSON.parse happened to order the keys,
 * and a quote carrying anything JSON cannot round-trip (a non-finite number, a
 * function, a symbol, a bigint) is refused rather than silently coerced.
 *
 * Verification is crypto.timingSafeEqual over equal-length buffers — the length is
 * checked first (timingSafeEqual throws on a mismatch), and a seal that is not 64 hex
 * characters never reaches it.
 */

import crypto from 'crypto';

/** The domain the quote key is derived under — bumped, never reused, if the quote's shape changes meaning. */
export const QUOTE_SEAL_DOMAIN = 'temple-stuart/viator-quote/v1';

/** The quote key: HMAC-SHA256(JWT_SECRET, the domain). Throws when JWT_SECRET is absent — fail closed. */
function quoteSealKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required to seal a Viator quote');
  return crypto.createHmac('sha256', secret).update(QUOTE_SEAL_DOMAIN).digest();
}

/**
 * The sealed form: sorted keys, no whitespace. Throws on anything JSON cannot carry
 * back unchanged — a quote is sealed exactly as it will be read.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('a quote may not carry a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  throw new Error(`a quote may not carry a ${typeof value}`);
}

/** The seal for a quote: 64 lowercase hex characters. */
export function sealOf(quote: unknown): string {
  return crypto.createHmac('sha256', quoteSealKey()).update(canonicalJson(quote)).digest('hex');
}

/**
 * Does this seal belong to this quote? A constant-time comparison over equal-length
 * buffers; a seal that is not 64 hex characters is false before any comparison.
 */
export function sealHolds(quote: unknown, seal: unknown): boolean {
  if (typeof seal !== 'string' || !/^[0-9a-f]{64}$/.test(seal)) return false;
  const expected = Buffer.from(sealOf(quote), 'hex');
  const given = Buffer.from(seal, 'hex');
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}
