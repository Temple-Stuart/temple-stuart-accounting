import crypto from 'crypto';
import { cookies } from 'next/headers';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required for cookie signing');
  }
  return secret;
}

/**
 * Sign an email string with HMAC-SHA256.
 * Format: email.hmacHexDigest
 */
export function signCookie(email: string): string {
  const secret = getSecret();
  const hmac = crypto.createHmac('sha256', secret).update(email).digest('hex');
  return `${email}.${hmac}`;
}

/**
 * GUEST-01 (2026-09-29): the key for guest access ONLY — a guest's manage code and
 * its one-booking session (src/lib/guest/guestAccess.ts). Derived from the one secret
 * this file reads, under its own label, so no userEmail signature (signCookie above
 * signs the raw email under JWT_SECRET itself) can ever be a guest value, or the
 * reverse. Said, not hidden: rotating JWT_SECRET changes every manage code, as it
 * ends every sign-in.
 */
export function guestKey(): Buffer {
  return crypto.createHmac('sha256', getSecret()).update('ts-guest:v1').digest();
}

/**
 * Verify an HMAC-signed cookie value.
 * Returns the email if valid, null if tampered or malformed.
 */
export function verifyCookie(cookieValue: string): string | null {
  try {
    const secret = getSecret();
    const lastDot = cookieValue.lastIndexOf('.');
    if (lastDot === -1) return null;

    const email = cookieValue.substring(0, lastDot);
    const signature = cookieValue.substring(lastDot + 1);

    const expected = crypto.createHmac('sha256', secret).update(email).digest('hex');

    // Timing-safe comparison to prevent timing attacks
    if (signature.length !== expected.length) return null;
    const sigBuffer = Buffer.from(signature, 'utf8');
    const expBuffer = Buffer.from(expected, 'utf8');
    if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return null;

    return email;
  } catch {
    return null;
  }
}

/**
 * Read and verify the userEmail cookie from the request.
 * Returns the verified email, or null if missing/tampered.
 * Use in API routes (Node.js runtime).
 */
export async function getVerifiedEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('userEmail')?.value;
  if (!raw) return null;
  const email = verifyCookie(raw);
  // Normalize to lowercase — prevents case-variant email collisions
  return email ? email.toLowerCase() : null;
}
