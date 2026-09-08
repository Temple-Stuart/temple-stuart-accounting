import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signCookie } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { loginDecision, LOGIN_FAILED } from '@/lib/auth/verification';
import { SIGNUP_LANDING } from '@/lib/auth/registration';

/**
 * POST /api/auth/login — SELL-03b: an account that never verified its email
 * fails with the SAME line as a wrong password or no account at all
 * (loginDecision — one frozen refusal), and bcrypt runs whether or not the
 * account exists or is verified, so the timing does not tell either. A
 * success names the one front door (landing: /answers).
 */

// A real bcrypt hash (cost 12) of a dummy password: compared against when no
// account exists — or when the account carries no bcrypt hash (an OAuth
// account stores password '', and bcryptjs answers a non-60-char hash
// instantly) — so every refused path costs what the wrong-password path costs.
const DUMMY_HASH = '$2a$12$uZy16vsU.8dLcGuGbFdbZedJ5NhjA/7VwAT2QYdXPogo6FTfczA82';
const BCRYPT_HASH_LENGTH = 60;

export async function POST(request: Request) {
  try {
    // Brute-force defense — per-IP rate limit BEFORE the DB lookup / bcrypt compare, so an
    // attacker can't probe credentials at speed. Reuses the durable limiter the travel routes
    // use (flights/search:27). The generic 429 below leaks no user-existence info.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await rateLimit(`auth-login:${ip}`, { limit: 10, windowSeconds: 300 });

    let { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: LOGIN_FAILED },
        { status: 401 }
      );
    }

    email = email.toLowerCase().trim();

    const user = await prisma.users.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' }
      }
    });

    // The same cost on every path: compare against the account's bcrypt hash, or the dummy when
    // there is no account or no hash (an OAuth account can never sign in with a password).
    const storedHash = user && user.password.length === BCRYPT_HASH_LENGTH ? user.password : DUMMY_HASH;
    const passwordOk = (await bcrypt.compare(password, storedHash)) && storedHash !== DUMMY_HASH;
    const decision = loginDecision({ user, passwordOk });

    if (!decision.ok || !user) {
      return NextResponse.json(
        { error: LOGIN_FAILED },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      landing: SIGNUP_LANDING,
      user: { email: user.email, name: user.name }
    });

    response.cookies.set('userEmail', signCookie(user.email), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
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
    console.error('[LOGIN] Error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
