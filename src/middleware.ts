import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Middleware: Protect app routes.
 * Public: /, /api/auth/*, static assets
 * Protected: /hub, /dashboard, /trading, /business, etc.
 *
 * NOTE: Middleware runs in Edge Runtime — only checks cookie presence.
 * Actual signature verification happens in getCurrentUser() (Node.js).
 */

const PUBLIC_PATHS = [
  '/',
  '/login',
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

  // Check cookie auth (presence only — signature verified in API routes)
  const hasSessionCookie = !!request.cookies.get('userEmail')?.value;

  // Check NextAuth session
  const token = await getToken({ req: request, secret: process.env.JWT_SECRET });

  if (!hasSessionCookie && !token) {
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
