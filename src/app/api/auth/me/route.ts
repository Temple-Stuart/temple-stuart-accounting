import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { isAdminUser } from '@/lib/tiers';
import { getEntitledCategories } from '@/lib/entitlements';

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
    // Per-category entitlements (PR-A): the Google category keys this user may unlock.
    // Read-only here — no gate is applied; PR-B/PR-C consume this set. Fail-loud: a DB
    // error in the helper propagates to the catch below (real 500), never a silent set.
    const entitledCategories = await getEntitledCategories(user.id);

    return NextResponse.json({ user: { ...user, isAdmin: isAdminUser(user.id), entitledCategories } });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Failed to verify authentication' },
      { status: 500 }
    );
  }
}
