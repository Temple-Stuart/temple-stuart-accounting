import { prisma } from '@/lib/prisma';
import { seedDefaultCOA } from '@/lib/seedDefaultCOA';

/**
 * Ensure bookkeeping is initialized for a user.
 * Creates default entity + COA if bookkeeping_initialized is false.
 * If already initialized, returns immediately (zero additional queries).
 *
 * Call this from bookkeeping routes ONLY — never from scanner, AI, or trading routes.
 */
export async function ensureBookkeepingInitialized(user: {
  id: string;
  bookkeeping_initialized: boolean;
}): Promise<void> {
  if (user.bookkeeping_initialized) return;

  // Check if entity already exists (idempotent)
  let entity = await prisma.entities.findFirst({
    where: { userId: user.id, is_default: true },
  });

  if (!entity) {
    entity = await prisma.entities.create({
      data: {
        userId: user.id,
        name: 'Personal',
        entity_type: 'personal',
        is_default: true,
        fiscal_year_start: 1,
      },
    });
  }

  // Seed default COA for the entity (idempotent — checks existing count)
  await seedDefaultCOA(user.id, entity.id);

  // Set the flag so future requests skip this entirely
  await prisma.users.update({
    where: { id: user.id },
    data: { bookkeeping_initialized: true },
  });
}
