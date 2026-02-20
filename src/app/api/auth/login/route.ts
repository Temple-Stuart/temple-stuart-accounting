import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signSession } from '@/lib/session';
import { logAuth } from '@/lib/audit-log';

export async function POST(request: Request) {
  const ip = (request as any).headers?.get?.('x-forwarded-for') ?? undefined;
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      );
    }

    const user = await prisma.users.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' }
      }
    });

    if (!user) {
      logAuth('login_failed_no_user', email, ip);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      logAuth('login_failed_bad_password', email, ip);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    logAuth('login_success', user.email, ip);

    const signedCookie = signSession(user.email);

    const response = NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name }
    });

    response.cookies.set('userEmail', signedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Non-httpOnly cookie: client components read email for display/owner checks only.
    // XSS risk accepted: value is the user's own email (not a secret token), and all
    // mutations require the signed httpOnly userEmail cookie verified server-side.
    response.cookies.set('userEmailPublic', user.email, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
