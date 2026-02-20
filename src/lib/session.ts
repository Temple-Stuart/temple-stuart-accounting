import crypto from 'crypto';

function base64urlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function computeHmac(email: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(email).digest('base64url');
}

/**
 * Sign an email address into a tamper-proof session token.
 * Format: base64url(email).base64url(hmac_sha256(email, JWT_SECRET))
 */
export function signSession(email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const encoded = base64urlEncode(email);
  const sig = computeHmac(email, secret);
  return `${encoded}.${sig}`;
}

/**
 * Verify a signed session token. Returns the email if valid, null otherwise.
 */
export function verifySession(raw: string): string | null {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const dot = raw.lastIndexOf('.');
    if (dot === -1) return null;
    const encoded = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const email = base64urlDecode(encoded);
    const expected = computeHmac(email, secret);
    // Both are base64url-encoded SHA-256 HMAC — always same length (43 chars)
    const sigBuf = Buffer.from(sig, 'base64url');
    const expectedBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    return email;
  } catch {
    return null;
  }
}
