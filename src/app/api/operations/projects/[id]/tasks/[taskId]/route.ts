/**
 * /api/operations/projects/[id]/tasks/[taskId]
 *
 * GET    — return one task. 404 if not found, not owned, OR taskId not
 *          under projectId (defensive: taskIds are UUIDs but verifying
 *          parentage prevents cross-project leakage).
 * PATCH  — update writable fields. Status transitions discriminate audits:
 *            * Transition to 'completed' → operations_project_task_completed
 *              (regardless of from-state); also writes completed_at = NOW()
 *              if it isn't being explicitly set in the same patch.
 *            * Other status changes → operations_project_task_status_changed
 *            * Non-status content changes → operations_project_task_updated
 *          (Bridgewater convention: completion is its own evidentiary class.)
 * DELETE — hard delete with full payload_before. Audits
 *          operations_project_task_deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, OperationsTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { recordTaskStatusChange } from '@/lib/operations/recordTaskStatusChange';

const VALID_STATUSES: OperationsTaskStatus[] = [
  'open',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
];

async function loadAuthorizedTask(taskId: string, projectId: string, userId: string) {
  return prisma.operations_project_tasks.findFirst({
    where: { id: taskId, project_id: projectId, user_id: userId },
  });
}

async function loadAuthorizedProject(projectId: string, userId: string) {
  return prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId, taskId } = await params;
    const task = await loadAuthorizedTask(taskId, projectId, user.id);
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[Task GET]', error);
    return NextResponse.json(
      { error: 'Failed to load task', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId, taskId } = await params;
    const existing = await loadAuthorizedTask(taskId, projectId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const project = await loadAuthorizedProject(projectId, user.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await request.json();

    const data: Prisma.operations_project_tasksUpdateInput = {};

    const trimNonEmpty = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };

    if (body.title !== undefined) {
      const t = trimNonEmpty(body.title);
      if (t === null || t.length > 500) {
        return NextResponse.json(
          { error: 'Validation', field: 'title', message: 'required, max 500 chars' },
          { status: 400 }
        );
      }
      data.title = t;
    }

    if (body.description !== undefined) {
      data.description = trimNonEmpty(body.description);
    }

    if (body.unblocks_label !== undefined) {
      data.unblocks_label = trimNonEmpty(body.unblocks_label);
    }

    if (body.link_url !== undefined) {
      const u = trimNonEmpty(body.link_url);
      if (u !== null && u.length > 500) {
        return NextResponse.json(
          { error: 'Validation', field: 'link_url', message: 'max 500 chars' },
          { status: 400 }
        );
      }
      data.link_url = u;
    }

    if (body.notes !== undefined) {
      const n = trimNonEmpty(body.notes);
      if (n !== null && n.length > 1500) {
        return NextResponse.json(
          { error: 'Validation', field: 'notes', message: 'max 1500 chars' },
          { status: 400 }
        );
      }
      data.notes = n;
    }

    if (body.deadline !== undefined) {
      data.deadline =
        typeof body.deadline === 'string' && body.deadline.length > 0
          ? new Date(body.deadline)
          : null;
    }

    if (body.estimated_minutes !== undefined) {
      const v = body.estimated_minutes;
      if (v === null || v === '') {
        data.estimated_minutes = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: 'Validation', field: 'estimated_minutes', message: 'must be a non-negative number' },
            { status: 400 }
          );
        }
        data.estimated_minutes = n;
      }
    }

    if (body.estimated_cost_usd !== undefined) {
      const v = body.estimated_cost_usd;
      if (v === null || v === '') {
        data.estimated_cost_usd = null;
      } else if (typeof v === 'string' && v.trim().length > 0) {
        data.estimated_cost_usd = new Prisma.Decimal(v.trim());
      } else if (typeof v === 'number') {
        data.estimated_cost_usd = new Prisma.Decimal(v);
      }
    }

    if (body.display_order !== undefined) {
      const n = Number(body.display_order);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { error: 'Validation', field: 'display_order', message: 'must be a number' },
          { status: 400 }
        );
      }
      data.display_order = Math.trunc(n);
    }

    // Status transitions: completion vs. status change vs. content edit.
    let statusTransition: { from: OperationsTaskStatus; to: OperationsTaskStatus } | null = null;
    let isCompletion = false;
    if (body.status !== undefined) {
      const incoming = body.status as OperationsTaskStatus;
      if (!VALID_STATUSES.includes(incoming)) {
        return NextResponse.json(
          { error: 'Validation', field: 'status', message: 'invalid status value' },
          { status: 400 }
        );
      }
      if (incoming !== existing.status) {
        statusTransition = { from: existing.status, to: incoming };
        if (incoming === 'completed') {
          isCompletion = true;
          // Auto-set completed_at if not explicitly being patched in the same call.
          if (body.completed_at === undefined) {
            data.completed_at = new Date();
          }
        }
        if (existing.status === 'completed' && incoming !== 'completed') {
          // Reverting from completed — clear completed_at unless explicitly patched.
          if (body.completed_at === undefined) {
            data.completed_at = null;
          }
        }
      }
      data.status = incoming;
    }

    if (body.completed_at !== undefined) {
      data.completed_at =
        typeof body.completed_at === 'string' && body.completed_at.length > 0
          ? new Date(body.completed_at)
          : null;
    }

    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 1500)
        : null;

    // Task update + status-history insert commit atomically: a status
    // change can never land without its operations_task_status_history row.
    const task = await prisma.$transaction(async (tx) => {
      const current = await tx.operations_project_tasks.findUnique({
        where: { id: taskId },
      });
      if (!current) {
        throw new Error('Task disappeared mid-transaction');
      }

      if (statusTransition) {
        await recordTaskStatusChange(
          tx,
          taskId,
          user.id,
          current.status,
          statusTransition.to,
          userEmail,
          reason
        );
      }

      return tx.operations_project_tasks.update({
        where: { id: taskId },
        data,
      });
    });

    let actionType: 'operations_project_task_completed' | 'operations_project_task_status_changed' | 'operations_project_task_updated';
    let description: string;

    if (isCompletion) {
      actionType = 'operations_project_task_completed';
      description = `Completed task "${existing.title}" in project "${project.title}"`;
    } else if (statusTransition) {
      actionType = 'operations_project_task_status_changed';
      description = `Task "${existing.title}" status: ${statusTransition.from} → ${statusTransition.to}`;
    } else {
      actionType = 'operations_project_task_updated';
      description = `Updated task "${existing.title}" in project "${project.title}"`;
    }

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: actionType,
        description,
      },
      target: {
        table: 'operations_project_tasks',
        id: task.id,
      },
      payload: {
        before: existing,
        after: task,
        metadata: {
          project_id: projectId,
          project_title: project.title,
          ...(statusTransition && { status_from: statusTransition.from, status_to: statusTransition.to }),
        },
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[Task PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update task', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId, taskId } = await params;
    const existing = await loadAuthorizedTask(taskId, projectId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const project = await loadAuthorizedProject(projectId, user.id);

    await prisma.operations_project_tasks.delete({ where: { id: taskId } });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_task_deleted',
        description: `Deleted task "${existing.title}" from project "${project?.title ?? projectId}"`,
      },
      target: {
        table: 'operations_project_tasks',
        id: existing.id,
      },
      payload: {
        before: existing,
        metadata: {
          project_id: projectId,
          project_title: project?.title ?? null,
        },
      },
    });

    return NextResponse.json({ deleted: true, id: existing.id });
  } catch (error) {
    console.error('[Task DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete task', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
