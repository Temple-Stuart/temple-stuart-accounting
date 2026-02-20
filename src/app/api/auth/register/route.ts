import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { signSession } from '@/lib/session';
import { logAuth } from '@/lib/audit-log';

export async function POST(request: Request) {
  const ip = (request as any).headers?.get?.('x-forwarded-for') ?? undefined;
  try {
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

    // Check if user already exists — return generic error to prevent enumeration
    const existing = await prisma.users.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (existing) {
      logAuth('register_duplicate', email, ip);
      return NextResponse.json(
        { error: 'Registration failed' },
        { status: 400 }
      );
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

    logAuth('register_success', user.email, ip);

    const signedCookie = signSession(user.email);

    const response = NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name }
    });

    response.cookies.set('userEmail', signedCookie, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
