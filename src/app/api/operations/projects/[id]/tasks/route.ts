/**
 * /api/operations/projects/[id]/tasks
 *
 * GET  — list this project's tasks. Sorted by status priority (open/
 *        in_progress first, then blocked, then completed/cancelled),
 *        then display_order ASC, then deadline ASC NULLS LAST.
 *        No audit (read-only).
 *
 * POST — create a task. Server inherits entity_id from parent project
 *        (β-1: tasks denormalize entity_id for index speed; never
 *        independently chosen). Computes display_order = max+1 from
 *        existing siblings (α-1: documented race-acceptance — two
 *        simultaneous POSTs can collide on display_order; acceptable
 *        for single-user system, resolvable via PATCH).
 *        Audits operations_project_task_created with metadata.project_id
 *        and project_title for replay context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma, OperationsTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { carriesPlanMoney, planMoney, type PlanBook } from '@/lib/operations/planMoney';
import { loadPlanBook } from '@/lib/operations/loadPlanBook';

const STATUS_ORDER: Record<OperationsTaskStatus, number> = {
  // PHASE2-1: auto-fired tasks awaiting the user's accept sort FIRST (need attention).
  pending_review: -1,
  open: 0,
  in_progress: 1,
  blocked: 2,
  completed: 3,
  cancelled: 4,
  superseded: 5,
  archived: 6,
};

async function loadAuthorizedProject(projectId: string, userId: string) {
  return prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId } = await params;
    const project = await loadAuthorizedProject(projectId, user.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Archived tasks are out of scope: hidden unless explicitly requested (the
    // "show archived" toggle). Read filter only; history is preserved.
    const includeArchived = request.nextUrl.searchParams.get('include_archived') === 'true';
    const where: Prisma.operations_project_tasksWhereInput = { project_id: projectId };
    if (!includeArchived) {
      where.status = { not: 'archived' };
    }

    const tasks = await prisma.operations_project_tasks.findMany({
      where,
      orderBy: [
        { display_order: 'asc' },
        { deadline: { sort: 'asc', nulls: 'last' } },
        { updated_at: 'desc' },
      ],
    });

    // Status-priority sort layered on top of display_order.
    const sorted = tasks.slice().sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      return 0;
    });

    return NextResponse.json({ tasks: sorted });
  } catch (error) {
    return failClosedResponse('Tasks GET', 'Failed to load tasks', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId } = await params;
    const project = await loadAuthorizedProject(projectId, user.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();

    const requireString = (v: unknown, field: string, max?: number): string | NextResponse => {
      if (typeof v !== 'string' || v.trim().length === 0) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} is required` },
          { status: 400 }
        );
      }
      const trimmed = v.trim();
      if (max && trimmed.length > max) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} exceeds ${max} characters` },
          { status: 400 }
        );
      }
      return trimmed;
    };

    const title = requireString(body.title, 'title', 500);
    if (title instanceof NextResponse) return title;

    const trimNullable = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };

    const description = trimNullable(body.description);
    const unblocks_label = trimNullable(body.unblocks_label);

    const deadline =
      typeof body.deadline === 'string' && body.deadline.length > 0
        ? new Date(body.deadline)
        : null;

    let estimated_minutes: number | null = null;
    if (body.estimated_minutes !== undefined && body.estimated_minutes !== null && body.estimated_minutes !== '') {
      const n = Number(body.estimated_minutes);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'estimated_minutes', message: 'must be a non-negative number' },
          { status: 400 }
        );
      }
      estimated_minutes = n;
    }

    // INTAKE-01: the task's cost and its account, by the one rule (planMoney.ts),
    // against the task's book — the project's entity, which the task inherits
    // (β-1 below). The book is read only when the task carries money; a refusal
    // is a 400 naming the field, and the account stored is the chart row's code
    // exactly as the chart saves it.
    const sent = { amount: body.estimated_cost_usd, account: body.coa_code };
    let book: PlanBook | null = null;
    if (carriesPlanMoney(sent)) {
      book = await loadPlanBook(prisma, user.id, project.entity_id);
      if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const money = planMoney(sent, book, 'task', { amount: 'estimated_cost_usd', account: 'coa_code' });
    if ('error' in money) return NextResponse.json({ error: 'Validation', ...money.error }, { status: 400 });
    const estimated_cost_usd = money.value.amount;
    const coa_code = money.value.coaCode;

    // α-1: server-computed display_order = max(existing) + 1.
    // Race-acceptance asterisk: two simultaneous POSTs against the same
    // project can read the same max and collide. Acceptable for single-
    // user system; resolvable via PATCH on display_order. Future reorder
    // UI is the canonical fix path.
    const last = await prisma.operations_project_tasks.findFirst({
      where: { project_id: projectId },
      orderBy: { display_order: 'desc' },
      select: { display_order: true },
    });
    const display_order = last ? last.display_order + 1 : 0;

    // β-1: entity_id inherited from parent project.
    const task = await prisma.operations_project_tasks.create({
      data: {
        project_id: projectId,
        user_id: user.id,
        entity_id: project.entity_id,
        title,
        description,
        unblocks_label,
        deadline,
        estimated_minutes,
        estimated_cost_usd,
        coa_code,
        display_order,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_task_created',
        description: `Created task "${title}" in project "${project.title}"`,
      },
      target: {
        table: 'operations_project_tasks',
        id: task.id,
      },
      payload: {
        after: task,
        metadata: {
          project_id: projectId,
          project_title: project.title,
          entity_id: project.entity_id,
        },
      },
    });

    return NextResponse.json({ task, isCreate: true }, { status: 201 });
  } catch (error) {
    return failClosedResponse('Tasks POST', 'Failed to create task', error);
  }
}
