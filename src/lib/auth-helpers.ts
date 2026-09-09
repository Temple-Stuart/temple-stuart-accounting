import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { hasTabAccess } from '@/lib/entitlements';

/**
 * Get current authenticated user from HMAC-verified cookie.
 * Returns null if not authenticated or cookie signature is invalid.
 */
export async function getCurrentUser() {
  const userEmail = await getVerifiedEmail();

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

// SELL-05b: requireTier (the tier gate) is gone with the tier system — one entitlement
// model: the offer decides what is sold (requireTabAccess below); paid-per-use AI gates on
// a signed-in user and the AI daily cap (src/lib/ai/caps.ts).

/**
 * TAB-SERVER-GATE: gate a route by per-tab entitlement — the server-side twin
 * of the homepage's isTabLocked. Allowed when the user holds an ACTIVE,
 * non-expired entitlement for the specific tab key OR bundle:all (resolved by
 * hasTabAccess, which also carries the admin bypass). Returns null if allowed,
 * or a 403 NextResponse. FALLBACK TRIPWIRE: no entitlement row → 403, always —
 * there is no default-allow path, and a DB error propagates (fail-loud) rather
 * than granting.
 *
 * Usage (FIRST lines after user resolution, BEFORE any paid external call):
 *   const tabGate = await requireTabAccess(user.id, 'tab:books');
 *   if (tabGate) return tabGate;
 */
export async function requireTabAccess(userId: string, tabKey: string): Promise<NextResponse | null> {
  if (await hasTabAccess(userId, tabKey)) return null;
  return NextResponse.json(
    {
      error: 'Tab not unlocked',
      tab: tabKey,
      message: `This requires the ${tabKey.replace('tab:', '')} module — subscribe to unlock it.`,
    },
    { status: 403 }
  );
}
