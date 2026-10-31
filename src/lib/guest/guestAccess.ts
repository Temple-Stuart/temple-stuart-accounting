/**
 * GUEST-01 (2026-09-29) — A GUEST'S WAY BACK TO ONE BOOKING, WITH NOTHING STORED.
 *
 * A guest booking has no owner (userId null, bookingType 'guest'), so every owner
 * read fences it out (the receipt's { id, userId: user.id }). This leaf is the whole
 * of what lets a guest back in, and it holds no state:
 *
 *   · the MANAGE CODE — 8 characters derived from the reservation id under the guest
 *     key (src/lib/cookie-auth.ts guestKey): HMAC-SHA256(key, 'code:' + id), its first
 *     40 bits in the alphabet below, shown XXXX-XXXX. The code travels only in the
 *     emails the booking already sends. No column, no table: rotating JWT_SECRET
 *     changes every code, as it ends every sign-in.
 *   · the SESSION — 'v1.<id>.<expiresAt seconds>.<base64url HMAC-SHA256(key,
 *     "session:v1:<id>:<expiresAt>")>': one reservation, until it expires, verified in
 *     constant time. A wrong version, a malformed id, an expired or a tampered value is
 *     no session.
 *
 * The alphabet has no I, L, O or U, and no letter is read as another: a typed O is
 * not a zero, it is not a code.
 *
 * PURE: no env, no fetch, no prisma, no React, no clock — the key and "now" are
 * arguments.
 */
import { createHmac, timingSafeEqual } from 'crypto';

/** The manage code's alphabet: 32 characters, no I, L, O or U. */
export const MANAGE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** How long an opened booking stays open: one hour. */
export const GUEST_SESSION_SECONDS = 3600;
/** The session cookie's name; it is sent only to /api/guest. */
export const GUEST_COOKIE = 'guestBooking';
export const GUEST_COOKIE_PATH = '/api/guest';
/** A reference as the column holds it: providerBookingId, VarChar(120). */
export const REFERENCE_SHAPE = /^[A-Za-z0-9_-]{1,120}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;

/** The manage code for one reservation: 8 characters of the alphabet. */
export function manageCode(key: Buffer, reservationId: string): string {
  const digest = createHmac('sha256', key).update(`code:${reservationId}`).digest();
  // The first 40 bits (5 bytes), 5 bits at a time, most significant first.
  let acc = 0;
  let held = 0;
  let out = '';
  for (const byte of digest.subarray(0, 5)) {
    acc = (acc << 8) | byte;
    held += 8;
    while (held >= 5) {
      held -= 5;
      out += MANAGE_CODE_ALPHABET[(acc >> held) & 31];
    }
    acc &= (1 << held) - 1;
  }
  return out;
}

/** The code as a guest reads it: XXXX-XXXX. */
export function displayManageCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** What a guest typed, as a code: uppercased, spaces and hyphens removed, exactly 8 characters of the alphabet — anything else is not a code. */
export function parseManageCode(typed: unknown): string | null {
  if (typeof typed !== 'string') return null;
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== 8) return null;
  for (const ch of code) if (!MANAGE_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Two codes compared in constant time. */
export function codesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

function sessionSignature(key: Buffer, reservationId: string, expiresAt: number): string {
  return createHmac('sha256', key).update(`session:v1:${reservationId}:${expiresAt}`).digest('base64url');
}

/** One reservation's session, until expiresAt (whole seconds). */
export function signGuestSession(key: Buffer, reservationId: string, expiresAt: number): string {
  return `v1.${reservationId}.${expiresAt}.${sessionSignature(key, reservationId, expiresAt)}`;
}

/** The session's reservation id — or null for a wrong version, a malformed id, an expired or a tampered value. */
export function verifyGuestSession(key: Buffer, value: unknown, now: number): string | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [version, reservationId, expires, signature] = parts;
  if (version !== 'v1' || !UUID.test(reservationId) || !/^\d{1,12}$/.test(expires) || !SIGNATURE.test(signature)) return null;
  const expiresAt = Number(expires);
  if (!codesMatch(signature, sessionSignature(key, reservationId, expiresAt))) return null;
  if (expiresAt <= now) return null;
  return reservationId;
}
