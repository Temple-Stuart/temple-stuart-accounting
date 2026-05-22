/**
 * GET /api/operations/tasks/unscheduled
 *
 * The Hub's unscheduled-task pool: every actionable task across all the
 * user's projects that has NOT been placed on the calendar as a timed
 * block. "Unscheduled" is a DERIVED state — a task is scheduled iff it
 * owns a daily_plan_item that owns at least one calendar_block. There is
 * no flag column; the predicate is the Prisma relation filter below
 * (PR-Ops-Hub-1 Phase 1 audit: operations_daily_plan_items has no
 * @@unique on (task_id, plan_date) and no schedule column on the task).
 *
 * Status filter: open / in_progress / blocked (excludes completed +
 * cancelled). blocked tasks ARE returned so the Hub can flag them
 * visibly — never silently hidden.
 *
 * Auth: getVerifiedEmail → user lookup → user-scoped query. Read-only.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tasks = await prisma.operations_project_tasks.findMany({
    where: {
      user_id: user.id,
      status: { in: ['open', 'in_progress', 'blocked'] },
      // Unscheduled = no daily_plan_item that owns any calendar_block.
      daily_plan_items: { none: { calendar_blocks: { some: {} } } },
    },
    select: {
      id: true,
      title: true,
      status: true,
      estimated_minutes: true,
      estimated_cost_usd: true,
      coa_code: true,
      deadline: true,
      project: { select: { id: true, title: true, entity_id: true } },
    },
    orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { display_order: 'asc' }],
  });

  return NextResponse.json({ tasks });
}
