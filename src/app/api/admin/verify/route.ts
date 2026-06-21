import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signCookie } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

export async function POST(request: Request) {
  const adminPasswordHash = process.env.ADMIN_PASSWORD;
  if (!adminPasswordHash) {
    return NextResponse.json({ error: 'Admin access is not configured' }, { status: 403 });
  }

  // Brute-force defense — per-IP rate limit BEFORE bcrypt. Tight, since admin login is a
  // single user that should rarely fail. Reuses the durable limiter the travel routes use
  // (flights/search:27). Fail-closed: a non-rate-limit error denies (re-thrown → 500).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  try {
    await rateLimit(`admin-verify:${ip}`, { limit: 5, windowSeconds: 900 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many attempts — please try again later.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  const { password } = await request.json();

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const isValid = await bcrypt.compare(password, adminPasswordHash);

  if (isValid) {
    const response = NextResponse.json({ success: true });
    response.cookies.set('adminSession', signCookie('admin-session'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 hours
    });
    return response;
  } else {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('adminSession', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
