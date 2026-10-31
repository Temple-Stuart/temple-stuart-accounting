import 'server-only';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prisma } from '@/lib/prisma';
import { hasTabAccess } from '@/lib/entitlements';

/**
 * LOCK-01 — THE ONE PAGE GATE. Every page that renders a paid module's UI asks
 * this before rendering it, and it asks the SAME question the tab asks: the
 * server twin `hasTabAccess` (src/lib/entitlements.ts:53) over the same
 * `keysGranting` the client's `isTabLocked` reads.
 *
 * It does not redirect and it does not 403. A refused viewer gets the ROOM,
 * locked (RoomLock) — that is LOCK-01's ruling. What it guarantees is that the
 * page KNOWS, so no page can render a paid component to a viewer without the key
 * by simply forgetting to ask.
 *
 * Fail-loud: hasTabAccess propagates a DB error rather than returning a silent
 * false, and a signed-out viewer is locked, never granted.
 */
export interface RoomGate {
  /** The viewer's user id, or '' when signed out. */
  viewerId: string;
  /** True when the viewer does NOT hold a key granting this tab. */
  locked: boolean;
}

export async function roomGate(tabKey: string): Promise<RoomGate> {
  const email = await getVerifiedEmail();
  if (!email) return { viewerId: '', locked: true };
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return { viewerId: '', locked: true };
  return { viewerId: user.id, locked: !(await hasTabAccess(user.id, tabKey)) };
}
