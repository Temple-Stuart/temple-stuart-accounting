import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

async function getAuthUser(userEmail: string) {
  return prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
}

async function getTaskWithOwnership(id: string) {
  return prisma.compliance_tasks.findUnique({
    where: { id },
    include: { workstream: { include: { project: { include: { mission: true } } } } },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getAuthUser(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const task = await prisma.compliance_tasks.findUnique({
      where: { id },
      include: {
        workstream: { include: { project: { include: { mission: true } } } },
        citations: {
          include: { citation: true },
        },
      },
    });

    if (!task || task.workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('[ComplianceTask GET]', error);
    return NextResponse.json({ error: 'Failed to load task' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getAuthUser(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existing = await getTaskWithOwnership(id);
    if (!existing || existing.workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'status', 'priority_tier',
      'priority_rationale', 'inherent_likelihood', 'inherent_impact',
      'residual_likelihood', 'residual_impact',
      'penalty_min_amount', 'penalty_max_amount', 'penalty_currency',
      'penalty_description', 'penalty_weight',
      'estimated_effort_hours_min', 'estimated_effort_hours_max',
      'estimated_cost_min', 'estimated_cost_max',
      'due_date', 'due_date_basis', 'due_date_rationale',
      'monitoring_frequency', 'attestation_frequency',
      'evidence_freshness_days', 'next_regulatory_review_at',
      'accountable_user_id', 'responsible_user_ids',
      'consulted_user_ids', 'informed_user_ids',
      'attestation_status', 'last_attested_at', 'last_attested_by',
      'attestation_expires_at',
      'action_steps', 'display_order', 'module_relevance',
      'framework_mappings', 'calendar_event_id',
      'scheduled_start', 'scheduled_end', 'is_active',
    ];

    const dateFields = [
      'due_date', 'next_regulatory_review_at', 'scheduled_start',
      'scheduled_end', 'last_attested_at', 'attestation_expires_at',
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (dateFields.includes(field)) {
          data[field] = body[field] ? new Date(body[field]) : null;
        } else {
          data[field] = body[field];
        }
      }
    }

    const task = await prisma.compliance_tasks.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'task_updated', description: `Updated compliance task "${task.title}"` },
      target: { table: 'compliance_tasks', id: task.id },
      payload: { before: existing, after: task },
    });

    if (body.status !== undefined && body.status !== existing.status) {
      await writeAuditLog({
        actor: { user_id: user.id, email: userEmail, type: 'human_user' },
        action: {
          type: 'task_status_changed',
          description: `Task status changed from ${existing.status} to ${body.status}`,
        },
        target: { table: 'compliance_tasks', id: task.id },
        payload: {
          before: { status: existing.status },
          after: { status: task.status },
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('[ComplianceTask PATCH]', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getAuthUser(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existing = await getTaskWithOwnership(id);
    if (!existing || existing.workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const task = await prisma.compliance_tasks.update({
      where: { id },
      data: { is_active: false },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'task_deleted', description: `Soft-deleted compliance task "${task.title}"` },
      target: { table: 'compliance_tasks', id: task.id },
      payload: { before: existing, after: task },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ComplianceTask DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
