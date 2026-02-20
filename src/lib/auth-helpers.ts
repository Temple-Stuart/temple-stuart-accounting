import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canAccess, TierConfig } from '@/lib/tiers';
import { verifySession } from '@/lib/session';

/**
 * Get current authenticated user from signed cookie.
 * Returns null if not authenticated or if cookie signature is invalid.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('userEmail')?.value;

  if (!raw) return null;

  const userEmail = verifySession(raw);
  if (!userEmail) return null;

  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } }
  });

  return user;
}

/**
 * Require authenticated user — returns user or throws 401-style object.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw { status: 401, message: 'Unauthorized' };
  }
  return user;
}

/**
 * Gate a route by tier + feature.
 * Returns null if allowed, or a NextResponse 403 if blocked.
 *
 * Usage in any API route:
 *   const gate = requireTier(user.tier, 'plaid');
 *   if (gate) return gate;
 */
export function requireTier(tier: string | null | undefined, feature: keyof TierConfig): NextResponse | null {
  if (!canAccess(tier, feature)) {
    return NextResponse.json(
      { error: 'Upgrade required', feature, message: `This feature requires a plan with ${feature} access.` },
      { status: 403 }
    );
  }
  return null;
}
