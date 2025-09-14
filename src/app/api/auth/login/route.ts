import { NextRequest, NextResponse } from 'next/server';
import { createAuthToken, setAuthCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // For development, create a user if it doesn't exist
    let user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      // In development, auto-create user on first login
      if (process.env.NODE_ENV === 'development') {
        const hashedPassword = crypto
          .createHash('sha256')
          .update(password)
          .digest('hex');

        user = await prisma.users.create({
          data: {
            email,
            password: hashedPassword,
            name: email.split('@')[0],
          }
        });
      } else {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    } else {
      // Verify password
      const hashedPassword = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');

      if (user.password !== hashedPassword) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }
    }

    // Create JWT token
    const token = createAuthToken(user.id, user.email);

    // Set cookie and return success
    return NextResponse.json(
      { success: true, user: { id: user.id, email: user.email, name: user.name } },
      { headers: setAuthCookie(token) }
    );

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error.message },
      { status: 500 }
    );
  }
}
