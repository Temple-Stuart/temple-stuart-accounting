import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signCookie } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { registerAccount } from '@/lib/auth/registration';
import { sendWelcomeEmail } from '@/lib/auth/welcomeEmail';

/**
 * POST /api/auth/signup — THE register route (SELL-03). The former
 * /api/auth/register (no caller since the LoginBox and the developer page
 * post here) is gone; its rules live in src/lib/auth/registration.ts and
 * apply here: a valid email shape, a password of PASSWORD_MIN_LENGTH — the
 * same number the client hints — and a name.
 *
 * Order: per-IP rate limit (SEC-5, before the DB lookup / bcrypt hash) →
 * registerAccount (parse → 409 for a taken email → hash → create → ONE
 * welcome-email attempt, its failure declared in the body, never blocking)
 * → the HMAC userEmail cookie (the same flags login sets: Secure, Lax,
 * path '/') → { message: "You're signed in", landing: '/answers', user,
 * welcomeEmail }. A refusal is a ValidationError answered verbatim at its
 * status (400 / 409); a fault is the fixed failClosed line.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await rateLimit(`auth-signup:${ip}`, { limit: 5, windowSeconds: 3600 });

    const body = await request.json().catch(() => ({}));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const outcome = await registerAccount(
      {
        findUserByEmail: (email) =>
          prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
        hashPassword: (password) => bcrypt.hash(password, 12),
        newId: () => randomUUID(),
        createUser: (u) =>
          prisma.users.create({
            data: { id: u.id, email: u.email, password: u.password, name: u.name, tier: 'free', updatedAt: new Date() },
            select: { id: true, email: true, name: true },
          }),
        sendWelcome: ({ to, name }) => sendWelcomeEmail({ to, name, baseUrl }),
      },
      body,
    );

    const response = NextResponse.json(outcome.body);
    response.cookies.set('userEmail', signCookie(outcome.cookieEmail), {
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
    return failClosedResponse('Signup', 'Failed to create account', error);
  }
}
