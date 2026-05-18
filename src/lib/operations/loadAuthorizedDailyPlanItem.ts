import { prisma } from '@/lib/prisma';

export async function loadAuthorizedDailyPlanItem(itemId: string, userId: string) {
  return prisma.operations_daily_plan_items.findFirst({
    where: { id: itemId, user_id: userId },
    include: {
      calendar_blocks: { orderBy: { scheduled_start: 'asc' } },
      task: { select: { id: true, title: true, status: true } },
    },
  });
}
