import type { PrismaClient } from '@prisma/client';
import type { PlanBook, PlanChartRow } from './planMoney';

/**
 * INTAKE-01 (2026-09-28) — THE BOOK A PLAN'S MONEY IS CHECKED AGAINST.
 *
 * The entity and its WHOLE chart, archived rows included (an archived account
 * is refused by name, so it must be seen), scoped exactly as the budget report
 * scopes them (src/app/api/budget/report/route.ts: the entity is the user's;
 * a chart row is the book's AND its entity is the user's). An entity that is
 * not the user's → null, and the writer answers 404 and writes nothing.
 *
 * A writer calls this once per request, and only when the request carries an
 * amount or an account (planMoney.ts carriesPlanMoney) — a save with no money
 * never reads the chart. The client is handed in, so the where can be tested.
 */

/** The chart columns the rule reads. */
export const PLAN_CHART_SELECT = { code: true, name: true, account_type: true, is_archived: true } as const;

export async function loadPlanBook(
  db: Pick<PrismaClient, 'entities' | 'chart_of_accounts'>,
  userId: string,
  entityId: string,
): Promise<PlanBook | null> {
  const [entity, chart] = await Promise.all([
    db.entities.findFirst({
      where: { id: entityId, userId },
      select: { id: true, name: true, entity_type: true },
    }),
    db.chart_of_accounts.findMany({
      where: { entity_id: entityId, entity: { userId } },
      select: PLAN_CHART_SELECT,
    }),
  ]);
  if (!entity) return null;
  const rows: PlanChartRow[] = chart;
  return { id: entity.id, name: entity.name, entityType: entity.entity_type, chart: rows };
}
