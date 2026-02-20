import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Verify HMAC-signed cookie in Edge runtime using Web Crypto API.
 * Returns the email if valid, null if tampered or malformed.
 */
async function verifyCookieEdge(cookieValue: string): Promise<string | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const lastDot = cookieValue.lastIndexOf('.');
  if (lastDot === -1) return null;

  const email = cookieValue.substring(0, lastDot);
  const signature = cookieValue.substring(lastDot + 1);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(email));
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (signature.length !== expected.length) return null;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (result !== 0) return null;

  return email;
}

/**
 * Middleware: Protect app routes.
 * Public: /, /api/auth/*, static assets
 * Protected: /hub, /dashboard, /trading, /business, etc.
 */

const PUBLIC_PATHS = [
  '/',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/pricing',
  '/api/stripe/webhook',
  '/opengraph-image',
  '/terms',
  '/privacy',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public paths through
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check cookie auth — verify HMAC signature (rejects forged cookies)
  const rawCookie = request.cookies.get('userEmail')?.value;
  const verifiedEmail = rawCookie ? await verifyCookieEdge(rawCookie) : null;

  // Check NextAuth session
  const token = await getToken({ req: request, secret: process.env.JWT_SECRET });

  if (!verifiedEmail && !token) {
    // Not authenticated — redirect to landing
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
