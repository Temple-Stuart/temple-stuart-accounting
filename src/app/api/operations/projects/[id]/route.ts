/**
 * /api/operations/projects/[id]
 *
 * GET    — return one project (404 if not found or not owned). No audit.
 * PATCH  — update writable fields. Status changes audit-discriminate via
 *          operations_project_status_changed; other content changes audit
 *          as operations_project_updated. SOC 2 evidence-of-state-change
 *          control: status transitions are evidentiarily distinct from
 *          content edits.
 * DELETE — hard delete. CASCADE removes tasks and dependencies. Full
 *          payload_before captured in audit_log for replay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { recordTaskStatusChange } from '@/lib/operations/recordTaskStatusChange';

// Active task statuses that an archive cascade retires to 'archived'. Terminal
// states (completed, cancelled, superseded) are LEFT UNTOUCHED — they are the
// audit trail. Mirrors the unscheduled-queue active set.
const ARCHIVABLE_TASK_STATUSES = ['open', 'in_progress', 'blocked'] as const;

// "Today" at UTC midnight, matching how daily-plan plan_date is stored/compared
// (daily-plan/items/route.ts parsePlanDate → `${date}T00:00:00.000Z`). Items with
// plan_date < today are PAST (untouched); >= today are future (removable).
function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const VALID_STATUSES: ProjectStatus[] = [
  'not_started',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'archived',
];

async function loadAuthorizedProject(projectId: string, userId: string) {
  return prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
}

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

    const { id } = await params;
    const project = await loadAuthorizedProject(id, user.id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Project GET]', error);
    return NextResponse.json(
      { error: 'Failed to load project', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const { id } = await params;
    const existing = await loadAuthorizedProject(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();

    // Build the patch object explicitly — never trust body keys to flow through.
    const data: Prisma.operations_projectsUpdateInput = {};

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
      // Uniqueness check on title change.
      if (t !== existing.title) {
        const dup = await prisma.operations_projects.findFirst({
          where: { user_id: user.id, title: t, NOT: { id } },
        });
        if (dup) {
          return NextResponse.json(
            { error: 'Duplicate', field: 'title', message: 'a project with this title already exists' },
            { status: 409 }
          );
        }
      }
      data.title = t;
    }

    // Legacy paragraph fields (goal/problem/diagnosis/design) are now nullable
    // post-PR-Ops-3.7. Source of truth for goal/problem/diagnosis is the
    // *_items JSONB arrays; legacy paragraphs persist for backwards-compat
    // until a future cleanup PR drops them. Design field continues to be
    // populated by the AI generate-design endpoint via "use this" acceptance.
    // PR-Ops-Evolve-1: deep_research_input / claude_code_audit_input are manual
    // paste targets (reality inputs) saved on the same path as the Text sections.
    for (const field of ['goal', 'problem', 'diagnosis', 'design', 'deep_research_input', 'claude_code_audit_input'] as const) {
      if (body[field] !== undefined) {
        const t = trimNonEmpty(body[field]);
        data[field] = t;
      }
    }

    // PR-Ops-3.7: structured-list fields. Each is an array of strings,
    // each item ≤ 500 chars, ≤ 20 items per array.
    const validateItems = (
      value: unknown,
      fieldName: string
    ): { ok: true; items: string[] } | { ok: false; message: string } => {
      if (!Array.isArray(value)) {
        return { ok: false, message: `${fieldName} must be an array` };
      }
      if (value.length > 20) {
        return { ok: false, message: `${fieldName} cannot have more than 20 items` };
      }
      const items: string[] = [];
      for (let i = 0; i < value.length; i++) {
        const raw = value[i];
        if (typeof raw !== 'string') {
          return { ok: false, message: `${fieldName}[${i}] must be a string` };
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) continue; // silently drop empty items
        if (trimmed.length > 500) {
          return { ok: false, message: `${fieldName}[${i}] exceeds 500 characters` };
        }
        items.push(trimmed);
      }
      return { ok: true, items };
    };

    const itemFieldMap = [
      { body: 'goalItems', column: 'goal_items' as const },
      { body: 'problemItems', column: 'problem_items' as const },
      { body: 'diagnosisItems', column: 'diagnosis_items' as const },
    ];
    for (const { body: bodyKey, column } of itemFieldMap) {
      if (body[bodyKey] !== undefined) {
        const result = validateItems(body[bodyKey], bodyKey);
        if (!result.ok) {
          return NextResponse.json(
            { error: 'Validation', field: bodyKey, message: result.message },
            { status: 400 }
          );
        }
        data[column] = result.items;
      }
    }

    let statusChange: { from: ProjectStatus; to: ProjectStatus } | null = null;
    if (body.status !== undefined) {
      const incoming = body.status as ProjectStatus;
      if (!VALID_STATUSES.includes(incoming)) {
        return NextResponse.json(
          { error: 'Validation', field: 'status', message: 'invalid status value' },
          { status: 400 }
        );
      }
      if (incoming !== existing.status) {
        statusChange = { from: existing.status, to: incoming };
      }
      data.status = incoming;
    }

    if (body.target_completion_date !== undefined) {
      data.target_completion_date =
        typeof body.target_completion_date === 'string' && body.target_completion_date.length > 0
          ? new Date(body.target_completion_date)
          : null;
    }

    if (body.estimated_total_minutes !== undefined) {
      const v = body.estimated_total_minutes;
      if (v === null || v === '') {
        data.estimated_total_minutes = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: 'Validation', field: 'estimated_total_minutes', message: 'must be a non-negative number' },
            { status: 400 }
          );
        }
        data.estimated_total_minutes = n;
      }
    }

    if (body.estimated_total_cost_usd !== undefined) {
      const v = body.estimated_total_cost_usd;
      if (v === null || v === '') {
        data.estimated_total_cost_usd = null;
      } else if (typeof v === 'string' && v.trim().length > 0) {
        data.estimated_total_cost_usd = new Prisma.Decimal(v.trim());
      } else if (typeof v === 'number') {
        data.estimated_total_cost_usd = new Prisma.Decimal(v);
      }
    }

    // Archiving a project cascades (in ONE transaction): its ACTIVE tasks retire
    // to 'archived' (terminal-status tasks keep their status — audit trail), and
    // their FUTURE, not-yet-DONE daily-plan items are removed (cascading any
    // scheduled block via FK). Past-dated and DONE items are never touched.
    const isArchiving = statusChange?.to === 'archived';
    let archivedTaskIds: string[] = [];
    let removedItemCount = 0;

    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.operations_projects.update({ where: { id }, data });

      if (isArchiving) {
        const activeTasks = await tx.operations_project_tasks.findMany({
          where: { project_id: id, status: { in: [...ARCHIVABLE_TASK_STATUSES] } },
          select: { id: true, status: true },
        });
        archivedTaskIds = activeTasks.map((t) => t.id);

        for (const t of activeTasks) {
          // Status-history row per task — preserves the single-funnel invariant
          // (a task status change never lands without its history row).
          await recordTaskStatusChange(tx, t.id, user.id, t.status, 'archived', userEmail, 'project archived');
          await tx.operations_project_tasks.update({
            where: { id: t.id },
            data: { status: 'archived' },
          });
        }

        if (archivedTaskIds.length > 0) {
          // Future (plan_date >= today), not-DONE items for the now-archived
          // tasks. `none: { status: completed }` spares DONE items; FK cascade
          // removes any scheduled (non-completed) block.
          const removed = await tx.operations_daily_plan_items.deleteMany({
            where: {
              task_id: { in: archivedTaskIds },
              plan_date: { gte: todayUtcMidnight() },
              calendar_blocks: { none: { status: 'completed' } },
            },
          });
          removedItemCount = removed.count;
        }
      }

      return updated;
    });

    // Status changes audit as a distinct evidentiary event. For an archive
    // cascade, the project-level audit records the cascade counts (matching the
    // project-DELETE sibling, which documents its cascade at the project level).
    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: statusChange ? 'operations_project_status_changed' : 'operations_project_updated',
        description: statusChange
          ? `Project "${existing.title}" status: ${statusChange.from} → ${statusChange.to}` +
            (isArchiving
              ? ` (archived ${archivedTaskIds.length} active task(s); removed ${removedItemCount} future plan item(s))`
              : '')
          : `Updated project "${existing.title}" for ${userEmail}`,
      },
      target: {
        table: 'operations_projects',
        id: project.id,
      },
      payload: {
        before: existing,
        after: project,
        metadata: statusChange
          ? {
              status_from: statusChange.from,
              status_to: statusChange.to,
              ...(isArchiving
                ? {
                    cascade_archived_task_ids: archivedTaskIds,
                    cascade_removed_future_item_count: removedItemCount,
                  }
                : {}),
            }
          : undefined,
      },
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Project PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update project', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { id } = await params;
    const existing = await loadAuthorizedProject(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.operations_projects.delete({ where: { id } });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_project_deleted',
        description: `Deleted project "${existing.title}" for ${userEmail}`,
      },
      target: {
        table: 'operations_projects',
        id: existing.id,
      },
      payload: {
        before: existing,
      },
    });

    return NextResponse.json({ deleted: true, id: existing.id });
  } catch (error) {
    console.error('[Project DELETE]', error);
    // Translate DB constraint violations into a clear, non-leaky message
    // instead of forwarding the raw Postgres string (no-silent-failure:
    // surface WHY legibly). Covers FK (P2003) + other constraint (P2004)
    // violations and raw check-constraint errors.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2004')
    ) {
      return NextResponse.json(
        {
          error: 'ConstraintViolation',
          message:
            'Couldn’t delete this project: a linked record blocked it. Remove the linked records first, then try again.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to delete project', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
