import { NextRequest, NextResponse } from 'next/server';
import { createAuthToken, setAuthCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Development only route
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available' }, { status: 404 });
    }

    // Find or create a dev user
    let user = await prisma.users.findFirst({
      where: { email: 'dev@temple-stuart.com' }
    });

    if (!user) {
      const hashedPassword = crypto
        .createHash('sha256')
        .update('dev123')
        .digest('hex');

      user = await prisma.users.create({
        data: {
          id: crypto.randomUUID(),
          email: 'dev@temple-stuart.com',
          password: hashedPassword,
          name: 'Dev User',
          updatedAt: new Date(),
        }
      });
    }

    // Create JWT token
    const token = createAuthToken(user.id, user.email);

    // Set cookie and redirect to accounts
    return NextResponse.redirect(new URL('/accounts', request.url), {
      headers: setAuthCookie(token)
    });

  } catch (error: any) {
    console.error('Dev login error:', error);
    return NextResponse.json(
      { error: 'Dev login failed', details: error.message },
      { status: 500 }
    );
  }
}
