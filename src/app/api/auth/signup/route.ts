import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signSession } from '@/lib/session';
import { logAuth } from '@/lib/audit-log';

export async function POST(request: Request) {
  const ip = (request as any).headers?.get?.('x-forwarded-for') ?? undefined;
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { error: password.length < 8 ? 'Password must be at least 8 characters' : 'Password must be no more than 128 characters' },
        { status: 400 }
      );
    }

    // Check if user exists (case-insensitive) — return generic error to prevent enumeration
    const existingUser = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (existingUser) {
      logAuth('signup_duplicate', email, ip);
      return NextResponse.json(
        { error: 'Registration failed' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userId = crypto.randomUUID();

    const user = await prisma.users.create({
      data: {
        id: userId,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name.trim(),
        updatedAt: new Date()
      }
    });

    logAuth('signup_success', user.email, ip);

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
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
