import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { mintToken, signupOutcome } from '@/lib/auth/verification';
import { prismaVerifyDb, verificationSecret } from '@/lib/auth/prismaVerifyDb';
import { sendAuthMail } from '@/lib/auth/welcomeEmail';

/**
 * POST /api/auth/signup — THE register route (SELL-03), NON-ENUMERATING
 * (SELL-03b): a new and a taken email get the SAME bytes back — 200
 * { message: "Check your email to finish signing in." }, no cookie, no
 * header that differs — and the same work: one bcrypt hash (a dummy on the
 * taken path), one mail. The difference is in the mail only: a verification
 * link (signed, single-use, 24h, stored hashed) for a new address; "someone
 * tried to sign up with your address" for a taken one. Nothing is signed in
 * until the link is used (GET /api/auth/verify).
 *
 * Order: per-IP rate limit (SEC-5, unchanged: 5/hour) → the input rules
 * (src/lib/auth/registration.ts — about the INPUT, so a refusal says nothing
 * about any account) → signupOutcome. A mail failure is logged, never in the
 * body. A fault is the fixed failClosed line.
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
    const secret = verificationSecret();
    const store = prismaVerifyDb(prisma);

    const { response } = await signupOutcome(
      {
        findUserByEmail: (email) =>
          prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true, name: true, email_verified_at: true } }),
        hashPassword: (password) => bcrypt.hash(password, 12),
        newId: () => randomUUID(),
        createUser: (u) =>
          prisma.users.create({
            data: { id: u.id, email: u.email, password: u.password, name: u.name, updatedAt: new Date() },
            select: { id: true, email: true, name: true },
          }),
        mintToken: () => mintToken(secret),
        storeToken: (row) => store.storeToken(row),
        verifyUrl: (token) => `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`,
        sendMail: (mail) => sendAuthMail(mail, baseUrl),
      },
      body,
    );

    return NextResponse.json(response.body, { status: response.status, headers: response.headers });
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
