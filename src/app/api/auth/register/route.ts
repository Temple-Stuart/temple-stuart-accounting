import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { signCookie } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Abuse defense — per-IP rate limit BEFORE the DB lookup / bcrypt hash, to stop mass
    // account creation from one source. Reuses the durable limiter the travel routes use
    // (flights/search:27). The generic 429 keeps the anti-enumeration posture intact.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    await rateLimit(`auth-register:${ip}`, { limit: 5, windowSeconds: 3600 });

    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const genericMessage = 'If this email is valid, you will receive a confirmation.';

    // Check if user already exists — return same response to prevent enumeration
    const existing = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (existing) {
      return NextResponse.json({ message: genericMessage });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.users.create({
      data: {
        id: uuidv4(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        updatedAt: new Date(),
        tier: 'free',
      }
    });

    // Set auth cookie
    const response = NextResponse.json({ message: genericMessage });

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
    console.error('[REGISTER] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
