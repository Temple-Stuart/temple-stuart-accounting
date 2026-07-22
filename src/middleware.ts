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
  '/admin',
  '/api/admin/verify',
  '/api/admin/users',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/pricing',
  // FD-0: the cost-transparency page the landing header links (page.tsx:109) —
  // a static server component: zero authed calls, zero paid external calls
  // (its only imports are next/link + the pure constants in
  // src/config/pricing-costs.ts; audited in full). Without this entry the
  // landing's own Pricing link 307-bounced guests back to '/'.
  '/how-pricing-works',
  '/api/stripe/webhook',
  '/api/inngest',
  '/opengraph-image',
  '/terms',
  '/privacy',
  // Public travel surface (PR-G-public-paths) — a LOGGED-OUT guest must call these
  // with NO account. Each is guarded: the search/booking routes have per-IP
  // rateLimit + a durable daily cap (PR-3/H1/A1/V2/G2); the location lists are
  // rate-limited cheap reads (PR-loc-1). Without these, middleware redirects a
  // guest's fetch to '/', which returned no data (the "Countries unavailable" bug
  // + would break guest search/booking next). Additive — exact paths only.
  '/api/flights/search',
  '/api/travel/hotels/search',
  '/api/travel/hotels/content',
  '/api/travel/hotels/reviews',
  '/api/travel/activities/search',
  '/api/travel/transfers/search',
  '/api/travel/visa/check',
  '/api/travel/locations/countries',
  '/api/travel/locations/cities',
  '/api/travel/liteapi/prebook',
  '/api/travel/liteapi/book',
  // Payment-SDK return page — renders the guest checkout UI only; NO paid API
  // calls on load. Its only money call is the user-submitted POST to
  // /api/travel/liteapi/book, which is public + rate-limited + daily-capped
  // (guest checkout posture, D2). Without this entry, a logged-out guest
  // returning from the hosted payment was 307-bounced to '/' and never
  // finalized the booking.
  '/booking/confirm',
  // PR-Duffel-Pay-1: flight BOOKING is public too — booking is never locked (mirrors
  // the hotel book routes above). Guarded by a per-IP rate limit + a tight durable
  // daily cap, and pinned to Duffel TEST mode this PR.
  '/api/flights/book',
  // PR-Duffel-Pay-2: the payment-intent step (returns the Card component's client_token)
  // is part of the same guest-ok checkout — public, rate-limited, TEST mode.
  '/api/flights/payment-intent',
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

  // PHASE3-3: the audit-ingest callback is a dynamic path
  // (/api/operations/projects/<id>/audit-ingest) the Claude Code Routine POSTs to
  // with NO user cookie. It is NOT open — the route validates a shared-secret bearer
  // (AUDIT_INGEST_SECRET) FIRST as its entire auth boundary. Let only this exact
  // suffix bypass cookie-auth so the token-gated write is reachable.
  if (pathname.startsWith('/api/operations/projects/') && pathname.endsWith('/audit-ingest')) {
    return NextResponse.next();
  }

  // EXEC-1: the exec-ingest callback is a dynamic path
  // (/api/operations/projects/<id>/exec-ingest) the Execute-Task Routine POSTs to with
  // NO user cookie. Same trust model as audit-ingest — the route validates a
  // shared-secret bearer (EXEC_INGEST_SECRET) FIRST as its entire auth boundary. Let
  // only this exact suffix bypass cookie-auth so the token-gated write is reachable.
  if (pathname.startsWith('/api/operations/projects/') && pathname.endsWith('/exec-ingest')) {
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
