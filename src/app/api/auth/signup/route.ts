import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signCookie } from '@/lib/cookie-auth';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const genericMessage = 'If this email is valid, you will receive a confirmation.';

    // Check if user exists — return same response to prevent enumeration
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ message: genericMessage });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user = await prisma.users.create({
      data: {
        id: userId,
        email,
        password: hashedPassword,
        name,
        updatedAt: new Date()
      }
    });

    // Set secure cookie
    const cookieStore = await cookies();
    cookieStore.set('userEmail', signCookie(user.email), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return NextResponse.json({ message: genericMessage });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
