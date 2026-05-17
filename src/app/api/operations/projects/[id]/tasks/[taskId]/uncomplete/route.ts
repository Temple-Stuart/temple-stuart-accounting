/**
 * POST /api/operations/projects/[id]/tasks/[taskId]/uncomplete
 *
 * Reverses a completed task: status → 'open', completed_at → null. Writes a
 * row to operations_task_status_history (via recordTaskStatusChange, inside
 * the same transaction as the task update) and an audit_log row with
 * action_type 'operations_project_task_uncompleted' after the tx commits.
 *
 * Body: { reason?: string } — optional free-text context, never required,
 * sliced to 1500 chars if provided.
 *
 * 400 if the task is not currently 'completed' — uncomplete only reverses a
 * completion, it is not a general status setter (use PATCH for that).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { recordTaskStatusChange } from '@/lib/operations/recordTaskStatusChange';
import { isValidUuid } from '@/lib/operations/parseUuid';

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

export async function POST(
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
    if (!isValidUuid(projectId)) {
      return NextResponse.json({ error: 'Validation', field: 'id', message: 'Invalid UUID format' }, { status: 400 });
    }
    if (!isValidUuid(taskId)) {
      return NextResponse.json({ error: 'Validation', field: 'taskId', message: 'Invalid UUID format' }, { status: 400 });
    }
    const existing = await loadAuthorizedTask(taskId, projectId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const project = await loadAuthorizedProject(projectId, user.id);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (existing.status !== 'completed') {
      return NextResponse.json(
        { error: 'Validation', field: 'status', message: 'task is not completed — nothing to uncomplete' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body.reason === 'string' && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 1500)
        : null;

    // Task update + status-history insert commit atomically.
    const task = await prisma.$transaction(async (tx) => {
      const current = await tx.operations_project_tasks.findUnique({
        where: { id: taskId },
      });
      if (!current) {
        throw new Error('Task disappeared mid-transaction');
      }

      await recordTaskStatusChange(
        tx,
        taskId,
        user.id,
        'completed',
        'open',
        userEmail,
        reason
      );

      return tx.operations_project_tasks.update({
        where: { id: taskId },
        data: { status: 'open', completed_at: null },
      });
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_task_uncompleted',
        description: `Uncompleted task "${existing.title}" in project "${project.title}"`,
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
          status_from: 'completed',
          status_to: 'open',
          ...(reason && { reason }),
        },
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[Task Uncomplete POST]', error);
    return NextResponse.json(
      { error: 'Failed to uncomplete task', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
