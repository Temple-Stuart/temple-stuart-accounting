import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { mintToken, resendOutcome } from '@/lib/auth/verification';
import { prismaVerifyDb, verificationSecret } from '@/lib/auth/prismaVerifyDb';
import { sendAuthMail } from '@/lib/auth/welcomeEmail';

/**
 * POST /api/auth/verify/resend { email } — SELL-03b: a fresh verification
 * link for an account that never verified. NON-ENUMERATING: an unknown
 * address, a verified account and an unverified one all get the same bytes
 * back (200 { message: "If an account is waiting to be verified, a new link
 * is on its way." }) and the same bcrypt-cost work; only the unverified path
 * mints, stores and sends. Tighter per-IP limit than sign-up (3/hour) — the
 * one thing this route can do is send mail.
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await rateLimit(`auth-resend:${ip}`, { limit: 3, windowSeconds: 3600 });

    const body = await request.json().catch(() => ({}));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const secret = verificationSecret();
    const store = prismaVerifyDb(prisma);

    const { response } = await resendOutcome(
      {
        findUserByEmail: (email) =>
          prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, email: true, name: true, email_verified_at: true } }),
        hashPassword: (password) => bcrypt.hash(password, 12),
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
    return failClosedResponse('Resend verification', 'Failed to resend the link', error);
  }
}
