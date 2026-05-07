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

    for (const field of ['goal', 'problem', 'diagnosis', 'design'] as const) {
      if (body[field] !== undefined) {
        const t = trimNonEmpty(body[field]);
        if (t === null) {
          return NextResponse.json(
            { error: 'Validation', field, message: `${field} cannot be empty` },
            { status: 400 }
          );
        }
        data[field] = t;
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

    const project = await prisma.operations_projects.update({
      where: { id },
      data,
    });

    // Status changes audit as a distinct evidentiary event.
    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: statusChange ? 'operations_project_status_changed' : 'operations_project_updated',
        description: statusChange
          ? `Project "${existing.title}" status: ${statusChange.from} → ${statusChange.to}`
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
          ? { status_from: statusChange.from, status_to: statusChange.to }
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
    return NextResponse.json(
      { error: 'Failed to delete project', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
