import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { isAdminUser } from '@/lib/tiers';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Case-insensitive lookup to match login behavior
    const user = await prisma.users.findFirst({
      where: { 
        email: { equals: userEmail, mode: 'insensitive' }
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        tier: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // TRADING-PR-2: expose a server-computed admin flag (the existing
    // isAdminUser/ADMIN_USER_ID check) so the home launcher can show the
    // admin-only Trading scan form without leaking ADMIN_USER_ID into the client
    // bundle or inventing client-side admin logic.
    return NextResponse.json({ user: { ...user, isAdmin: isAdminUser(user.id) } });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}
