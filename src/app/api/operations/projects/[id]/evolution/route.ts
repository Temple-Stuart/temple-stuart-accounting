/**
 * GET /api/operations/projects/[id]/evolution
 *
 * Read-only project-evolution trajectory. The project task list is
 * append-only: every AI re-run writes an immutable operations_ai_usage
 * row (the "version"), and each task carries source_ai_usage_id (PR-1)
 * linking it to the re-run that created it.
 *
 * This endpoint groups a project's tasks by that link and returns:
 *   - versions[]: one per re-run that produced tasks for this project,
 *     ordered by the ai_usage created_at ASC (v1 = oldest), each with
 *     the tasks it added.
 *   - unversioned[]: tasks with NULL source_ai_usage_id (created before
 *     PR-1, or via the manual single-task path). Surfaced honestly as
 *     an "original / pre-versioning" bucket — never folded into a re-run.
 *
 * No audit (read-only). No writes. Auth + user-scoping + defensive 404
 * mirror the sibling GET /api/operations/projects/[id]/tasks route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { OperationsTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// Same status-priority ordering used by the tasks GET route, so a
// version's task list reads in the same order the user sees elsewhere.
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

export async function GET(
  _request: NextRequest,
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

    // Defensive cross-user 404: only the owner can read the trajectory.
    const project = await prisma.operations_projects.findFirst({
      where: { id: projectId, user_id: user.id },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // All tasks for the project, with just the fields the timeline needs.
    const tasks = await prisma.operations_project_tasks.findMany({
      where: { project_id: projectId },
      orderBy: [{ display_order: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        display_order: true,
        created_at: true,
        source_ai_usage_id: true,
      },
    });

    // The re-run rows (versions). Scope to this user defensively even
    // though the FK guarantees ownership at write time.
    const usageIds = Array.from(
      new Set(
        tasks
          .map((t) => t.source_ai_usage_id)
          .filter((x): x is string => typeof x === 'string')
      )
    );

    const usageRows = usageIds.length
      ? await prisma.operations_ai_usage.findMany({
          where: { id: { in: usageIds }, user_id: user.id },
          orderBy: { created_at: 'asc' },
          select: {
            id: true,
            created_at: true,
            model: true,
            purpose: true,
            input_tokens: true,
            output_tokens: true,
            cost_usd: true,
          },
        })
      : [];

    const sortTasks = <T extends { status: OperationsTaskStatus; display_order: number }>(rows: T[]) =>
      rows.slice().sort((a, b) => {
        const sa = STATUS_ORDER[a.status];
        const sb = STATUS_ORDER[b.status];
        if (sa !== sb) return sa - sb;
        return a.display_order - b.display_order;
      });

    const tasksByUsage = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (!t.source_ai_usage_id) continue;
      const list = tasksByUsage.get(t.source_ai_usage_id) ?? [];
      list.push(t);
      tasksByUsage.set(t.source_ai_usage_id, list);
    }

    // versions ordered oldest-first (v1 = first re-run); version_number is
    // assigned in that chronological order.
    const versions = usageRows.map((u, i) => {
      const versionTasks = sortTasks(tasksByUsage.get(u.id) ?? []);
      return {
        version_number: i + 1,
        usage_id: u.id,
        created_at: u.created_at,
        model: u.model,
        purpose: u.purpose,
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cost_usd: u.cost_usd,
        task_count: versionTasks.length,
        tasks: versionTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
        })),
      };
    });

    // Honest bucket: tasks whose batch is unknown (NULL link). Never faked
    // into a version, never hidden.
    const unversionedTasks = sortTasks(tasks.filter((t) => !t.source_ai_usage_id));
    const unversioned = unversionedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    }));

    return NextResponse.json({
      project_id: projectId,
      versions,
      unversioned,
      unversioned_count: unversioned.length,
    });
  } catch (error) {
    console.error('[Project Evolution GET]', error);
    return NextResponse.json(
      { error: 'Failed to load project evolution', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
