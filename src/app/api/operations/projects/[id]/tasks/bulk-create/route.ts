/**
 * POST /api/operations/projects/[id]/tasks/bulk-create
 *
 * Accepts an array of AI-generated tasks (from generateProjectTasks)
 * and inserts them atomically into operations_project_tasks. The
 * source_ai_usage_id from the body links each task's audit row back
 * to the operations_ai_usage row that produced the synthesis — this
 * is the institutional thread from "AI generated" → "user accepted"
 * → "live tasks in the operational tracker."
 *
 * Truth-first: this endpoint is the explicit acceptance gate. The
 * AI synthesis already happened (recordUsage wrote operations_ai_usage
 * + an audit row when generateProjectTasks ran). This endpoint adds
 * N more audit rows (one per task created) with source_ai_usage_id
 * in metadata, forming the auditable lineage:
 *
 *   operations_ai_usage (synthesis event)
 *     ↓ source_ai_usage_id in metadata
 *   operations_project_tasks (N rows, one per accepted task)
 *     ↑ operations_project_task_created audit row per task
 *
 * Atomic transaction: either all tasks insert or none. Partial
 * acceptance is not a supported state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

interface IncomingTask {
  title?: unknown;
  description?: unknown;
  link_url?: unknown;
  notes?: unknown;
  suggested_order?: unknown;
}

interface RequestBody {
  tasks?: unknown;
  source_ai_usage_id?: unknown;
}

const MAX_TITLE = 500;
const MAX_DESCRIPTION = 2000;
const MAX_LINK_URL = 500;
const MAX_NOTES = 1500;
const MAX_TASKS_PER_REQUEST = 30;

function validateTask(
  raw: IncomingTask,
  index: number
): { ok: true; task: { title: string; description: string | null; link_url: string | null; notes: string | null; suggested_order: number } } | { ok: false; message: string } {
  if (typeof raw.title !== 'string') {
    return { ok: false, message: `tasks[${index}].title must be a string` };
  }
  const title = raw.title.trim();
  if (title.length === 0) {
    return { ok: false, message: `tasks[${index}].title cannot be empty` };
  }
  if (title.length > MAX_TITLE) {
    return { ok: false, message: `tasks[${index}].title exceeds ${MAX_TITLE} characters` };
  }

  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      return { ok: false, message: `tasks[${index}].description must be a string or null` };
    }
    const d = raw.description.trim();
    if (d.length > MAX_DESCRIPTION) {
      return { ok: false, message: `tasks[${index}].description exceeds ${MAX_DESCRIPTION} characters` };
    }
    description = d.length > 0 ? d : null;
  }

  let link_url: string | null = null;
  if (raw.link_url !== undefined && raw.link_url !== null) {
    if (typeof raw.link_url !== 'string') {
      return { ok: false, message: `tasks[${index}].link_url must be a string or null` };
    }
    const u = raw.link_url.trim();
    if (u.length > MAX_LINK_URL) {
      return { ok: false, message: `tasks[${index}].link_url exceeds ${MAX_LINK_URL} characters` };
    }
    link_url = u.length > 0 ? u : null;
  }

  let notes: string | null = null;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      return { ok: false, message: `tasks[${index}].notes must be a string or null` };
    }
    const n = raw.notes.trim();
    if (n.length > MAX_NOTES) {
      return { ok: false, message: `tasks[${index}].notes exceeds ${MAX_NOTES} characters` };
    }
    notes = n.length > 0 ? n : null;
  }

  if (typeof raw.suggested_order !== 'number' || !Number.isInteger(raw.suggested_order) || raw.suggested_order < 0) {
    return { ok: false, message: `tasks[${index}].suggested_order must be a non-negative integer` };
  }

  return {
    ok: true,
    task: {
      title,
      description,
      link_url,
      notes,
      suggested_order: raw.suggested_order,
    },
  };
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
    const project = await prisma.operations_projects.findFirst({
      where: { id: projectId, user_id: user.id },
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = (await request.json()) as RequestBody;

    if (!Array.isArray(body.tasks) || body.tasks.length === 0) {
      return NextResponse.json(
        { error: 'Validation', message: 'tasks must be a non-empty array' },
        { status: 400 }
      );
    }

    if (body.tasks.length > MAX_TASKS_PER_REQUEST) {
      return NextResponse.json(
        { error: 'Validation', message: `tasks array cannot exceed ${MAX_TASKS_PER_REQUEST} items` },
        { status: 400 }
      );
    }

    if (typeof body.source_ai_usage_id !== 'string' || body.source_ai_usage_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation', message: 'source_ai_usage_id is required (must be the operations_ai_usage row id from generateProjectTasks)' },
        { status: 400 }
      );
    }

    const sourceAiUsageId = body.source_ai_usage_id.trim();

    // Defensive: verify the source AI usage row exists and belongs to this user.
    // This prevents accepting another user's AI output via a forged source id.
    const aiUsage = await prisma.operations_ai_usage.findFirst({
      where: { id: sourceAiUsageId, user_id: user.id },
    });
    if (!aiUsage) {
      return NextResponse.json(
        { error: 'Validation', message: 'source_ai_usage_id does not reference a valid AI usage row for this user' },
        { status: 400 }
      );
    }

    // Validate all tasks before any DB writes.
    const validated: ReturnType<typeof validateTask>[] = body.tasks.map((t, i) =>
      validateTask(t as IncomingTask, i)
    );
    const firstFailure = validated.find((v) => !v.ok);
    if (firstFailure && !firstFailure.ok) {
      return NextResponse.json(
        { error: 'Validation', message: firstFailure.message },
        { status: 400 }
      );
    }
    const validTasks = validated
      .filter((v): v is { ok: true; task: { title: string; description: string | null; link_url: string | null; notes: string | null; suggested_order: number } } => v.ok)
      .map((v) => v.task);

    // Compute base display_order: max(existing) + 1
    const maxOrderRow = await prisma.operations_project_tasks.findFirst({
      where: { project_id: projectId, user_id: user.id },
      orderBy: { display_order: 'desc' },
      select: { display_order: true },
    });
    const baseOrder = (maxOrderRow?.display_order ?? -1) + 1;

    // Atomic insert all tasks. Audit rows written sequentially after the
    // transaction commits (matches PR-Ops-3b single-task pattern).
    const created = await prisma.$transaction(
      validTasks.map((task) =>
        prisma.operations_project_tasks.create({
          data: {
            user_id: user.id,
            project_id: projectId,
            entity_id: project.entity_id,
            title: task.title,
            description: task.description,
            link_url: task.link_url,
            notes: task.notes,
            display_order: baseOrder + task.suggested_order,
            // status defaults to 'open' per Prisma schema default
          },
        })
      )
    );

    // Sequential audit log writes (codebase convention — not transactional
    // with the task creates, but ordered).
    for (const task of created) {
      await writeAuditLog({
        actor: { user_id: user.id, email: userEmail, type: 'human_user' },
        action: {
          type: 'operations_project_task_created',
          description: `Created task "${task.title}" via AI bulk-create for project ${projectId}`,
        },
        target: { table: 'operations_project_tasks', id: task.id },
        payload: {
          before: null,
          after: task,
          metadata: {
            source_ai_usage_id: sourceAiUsageId,
            project_id: projectId,
            entity_id: project.entity_id,
          },
        },
      });
    }

    return NextResponse.json({
      tasks: created,
      created_count: created.length,
      source_ai_usage_id: sourceAiUsageId,
    });
  } catch (error) {
    console.error('[Bulk Create Tasks POST]', error);
    return NextResponse.json(
      { error: 'Failed to bulk-create tasks', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
