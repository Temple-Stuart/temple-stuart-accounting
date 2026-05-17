import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Detects calendar-block overlaps for a given user + time range.
 *
 * Uses the Postgres OVERLAPS operator. Half-open interval semantics:
 * a block ending at exactly T does NOT conflict with a block starting at T.
 *
 * Filters out cancelled and missed blocks (those slots are free).
 *
 * @param userId          The user whose calendar is being checked.
 * @param scheduledStart  Proposed start.
 * @param scheduledEnd    Proposed end (must be > scheduledStart, validated by caller).
 * @param excludeBlockId  Optional block id to exclude (used by PATCH so a block doesn't conflict with itself).
 * @returns Array of conflicting block ids (empty if no conflicts).
 *
 * Race note: detection is not transactional with the subsequent write.
 * Consistent with the project's α-1 single-user race-acceptance posture.
 */
export async function detectBlockConflicts(
  userId: string,
  scheduledStart: Date,
  scheduledEnd: Date,
  excludeBlockId?: string
): Promise<string[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`user_id = ${userId}`,
    Prisma.sql`status NOT IN ('cancelled', 'missed')`,
    Prisma.sql`(scheduled_start, scheduled_end) OVERLAPS (${scheduledStart}::timestamptz, ${scheduledEnd}::timestamptz)`,
  ];
  if (excludeBlockId) {
    conditions.push(Prisma.sql`id != ${excludeBlockId}::uuid`);
  }

  const whereClause = Prisma.join(conditions, ' AND ');
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM operations_calendar_blocks WHERE ${whereClause}`
  );
  return rows.map((r) => r.id);
}
