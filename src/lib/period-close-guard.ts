/**
 * Period Close Enforcement Guard
 *
 * GAAP Compliance: Prevents posting journal entries to closed periods.
 * Complements DB-level immutability triggers (SOC2 IMMUT control).
 *
 * Must be called before EVERY journal entry creation pathway.
 * See audit: 7 pathways identified (5 commits + 2 reversals).
 */

// Accept any Prisma-like client (PrismaClient or transaction context)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = any;

export class PeriodClosedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodClosedError';
  }
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function assertPeriodOpen(
  prisma: PrismaLike,
  userId: string,
  entityId: string,
  date: Date
): Promise<void> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // JS months are 0-indexed

  const closedPeriod = await prisma.closing_periods.findFirst({
    where: {
      userId,
      entity_id: entityId,
      year,
      month,
      status: 'closed',
    },
  });

  if (closedPeriod) {
    // Look up entity name for a clear error message
    const entity = await prisma.entities.findFirst({
      where: { id: entityId },
      select: { name: true },
    });
    const entityName = entity?.name || entityId;

    throw new PeriodClosedError(
      `Cannot post to closed period: ${MONTH_NAMES[month]} ${year} for ${entityName}. Reopen the period first.`
    );
  }
}
