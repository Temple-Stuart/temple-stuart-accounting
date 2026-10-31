import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SETUP_DOOR, SETUP_ENTITY_LINE } from '@/lib/entities/kinds';

/**
 * SELL-04 — where this used to CREATE (a `Personal` entity and the default
 * chart, silently, the first time any Books route ran), it now DECLARES:
 * a user with no entity gets a 412 with the setup line and the door to the
 * step (Books › Chart of accounts — POST /api/entities is the one creator,
 * chosen and named by the user). Nothing is created here any more.
 *
 * Existing users are untouched: `bookkeeping_initialized` short-circuits as
 * before; a user whose flag is unset but who has an entity is marked
 * initialized (the same flag write the old path made) and passes.
 *
 * Usage (the requireTabAccess idiom — FIRST thing after the tab gate):
 *   const setup = await requireEntitySetup(user);
 *   if (setup) return setup;
 * Call this from bookkeeping routes ONLY — never from scanner, AI, or trading routes.
 */
export const ENTITY_SETUP_STATUS = 412;

export function entitySetupResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, stage: 'Entity setup', error: SETUP_ENTITY_LINE, message: SETUP_ENTITY_LINE, setup: SETUP_DOOR },
    { status: ENTITY_SETUP_STATUS },
  );
}

export async function requireEntitySetup(user: {
  id: string;
  bookkeeping_initialized: boolean;
}): Promise<NextResponse | null> {
  if (user.bookkeeping_initialized) return null;

  const entity = await prisma.entities.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!entity) return entitySetupResponse();

  // An entity exists (set up in the product, or seeded before the flag existed): mark it, as before.
  await prisma.users.update({
    where: { id: user.id },
    data: { bookkeeping_initialized: true },
  });
  return null;
}
