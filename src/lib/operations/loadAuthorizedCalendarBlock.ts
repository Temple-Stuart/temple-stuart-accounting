import { prisma } from '@/lib/prisma';

export async function loadAuthorizedCalendarBlock(blockId: string, userId: string) {
  return prisma.operations_calendar_blocks.findFirst({
    where: { id: blockId, user_id: userId },
  });
}
