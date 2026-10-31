import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signCookie } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { verifyToken } from '@/lib/auth/verification';
import { prismaVerifyDb, verificationSecret } from '@/lib/auth/prismaVerifyDb';
import { SIGNUP_LANDING } from '@/lib/auth/registration';

/**
 * GET /api/auth/verify?token=… — SELL-03b: the verification link.
 *
 * A good link (our signature, a stored hash, unused, unexpired) is consumed
 * ONCE — used_at and users.email_verified_at set in one transaction — then
 * the HMAC userEmail cookie is set (login's flags) and the viewer lands on
 * the one front door, /answers. An expired, used or foreign link lands on
 * '/' with ?verify=<state>, where the deck renders the declared error and a
 * resend form (VerifyResultBanner). Per-IP rate-limited (a 256-bit random
 * half makes guessing hopeless; the limit keeps it cheap to refuse).
 */
export async function GET(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await rateLimit(`auth-verify:${ip}`, { limit: 20, windowSeconds: 300 });

    const raw = new URL(request.url).searchParams.get('token');
    const outcome = await verifyToken(prismaVerifyDb(prisma), verificationSecret(), raw);

    if (!outcome.ok) {
      return NextResponse.redirect(new URL(`/?verify=${outcome.state}`, request.url), 303);
    }

    const response = NextResponse.redirect(new URL(SIGNUP_LANDING, request.url), 303);
    response.cookies.set('userEmail', signCookie(outcome.email), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many attempts — please try again later.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    return failClosedResponse('Verify', 'Failed to verify the link', error);
  }
}
