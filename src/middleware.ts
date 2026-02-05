import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

  // Check cookie auth (custom login)
  const userEmail = request.cookies.get('userEmail')?.value;

  // Check NextAuth session
  const token = await getToken({ req: request, secret: process.env.JWT_SECRET });

  if (!userEmail && !token) {
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
