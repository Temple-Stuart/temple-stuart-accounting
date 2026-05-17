/**
 * GET /api/operations/projects/[id]/tasks/[taskId]/history
 *
 * Returns the operations_task_status_history timeline for one task,
 * newest first (capped at 100 rows). Powers the inline history panel
 * on TaskRow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

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

    const task = await prisma.operations_project_tasks.findFirst({
      where: { id: taskId, project_id: projectId },
    });
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (task.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const history = await prisma.operations_task_status_history.findMany({
      where: { task_id: taskId },
      orderBy: { changed_at: 'desc' },
      take: 100,
      select: {
        id: true,
        previous_status: true,
        new_status: true,
        changed_at: true,
        changed_by: true,
        reason: true,
      },
    });

    return NextResponse.json({ history });
  } catch (error) {
    console.error('[Task History GET]', error);
    return NextResponse.json(
      { error: 'Failed to load task history', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
