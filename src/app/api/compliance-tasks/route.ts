import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const { searchParams } = new URL(request.url);
    const workstream_id = searchParams.get('workstream_id');
    const status = searchParams.get('status');
    const priority_tier = searchParams.get('priority_tier');
    const accountable_user_id = searchParams.get('accountable_user_id');
    const due_before = searchParams.get('due_before');
    const due_after = searchParams.get('due_after');

    if (!workstream_id) {
      return NextResponse.json({ error: 'workstream_id is required' }, { status: 400 });
    }

    // Verify ownership via workstream -> project -> mission chain
    const workstream = await prisma.workstreams.findUnique({
      where: { id: workstream_id },
      include: { project: { include: { mission: true } } },
    });
    if (!workstream || workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const where: Record<string, unknown> = { workstream_id, is_active: true };
    if (status) where.status = status;
    if (priority_tier) where.priority_tier = priority_tier;
    if (accountable_user_id) where.accountable_user_id = accountable_user_id;

    if (due_before || due_after) {
      const dueDateFilter: Record<string, Date> = {};
      if (due_before) dueDateFilter.lte = new Date(due_before);
      if (due_after) dueDateFilter.gte = new Date(due_after);
      where.due_date = dueDateFilter;
    }

    const tasks = await prisma.compliance_tasks.findMany({
      where,
      orderBy: [{ display_order: 'asc' }, { created_at: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ count: tasks.length, tasks });
  } catch (error) {
    console.error('[ComplianceTasks GET]', error);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const body = await request.json();
    const {
      workstream_id,
      title,
      description,
      priority_tier,
      inherent_likelihood,
      inherent_impact,
      citation_ids,
      ...optionalFields
    } = body;

    if (!workstream_id || !title || !description || !priority_tier || !inherent_likelihood || !inherent_impact) {
      return NextResponse.json(
        { error: 'workstream_id, title, description, priority_tier, inherent_likelihood, and inherent_impact are required' },
        { status: 400 },
      );
    }

    // Verify ownership via workstream -> project -> mission chain
    const workstream = await prisma.workstreams.findUnique({
      where: { id: workstream_id },
      include: { project: { include: { mission: true } } },
    });
    if (!workstream || workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Workstream not found' }, { status: 404 });
    }

    // Build data object with allowed optional fields
    const allowedOptional = [
      'priority_rationale',
      'residual_likelihood',
      'residual_impact',
      'penalty_min_amount',
      'penalty_max_amount',
      'penalty_currency',
      'penalty_description',
      'penalty_weight',
      'estimated_effort_hours_min',
      'estimated_effort_hours_max',
      'estimated_cost_min',
      'estimated_cost_max',
      'due_date',
      'due_date_basis',
      'due_date_rationale',
      'monitoring_frequency',
      'attestation_frequency',
      'evidence_freshness_days',
      'next_regulatory_review_at',
      'accountable_user_id',
      'responsible_user_ids',
      'consulted_user_ids',
      'informed_user_ids',
      'attestation_status',
      'action_steps',
      'display_order',
      'module_relevance',
      'framework_mappings',
      'calendar_event_id',
      'scheduled_start',
      'scheduled_end',
    ];

    const data: Record<string, unknown> = {
      workstream_id,
      title,
      description,
      priority_tier,
      inherent_likelihood,
      inherent_impact,
    };

    const dateFields = [
      'due_date', 'next_regulatory_review_at', 'scheduled_start', 'scheduled_end',
    ];

    for (const field of allowedOptional) {
      if (optionalFields[field] !== undefined) {
        if (dateFields.includes(field)) {
          data[field] = optionalFields[field] ? new Date(optionalFields[field]) : null;
        } else {
          data[field] = optionalFields[field];
        }
      }
    }

    // If citation_ids provided, create task_citations in the same operation
    if (Array.isArray(citation_ids) && citation_ids.length > 0) {
      data.citations = {
        create: citation_ids.map((cid: string) => ({
          citation_id: cid,
        })),
      };
    }

    const task = await prisma.compliance_tasks.create({
      data: data as any,
      include: {
        citations: {
          include: { citation: true },
        },
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'task_created', description: `Created compliance task "${title}"` },
      target: { table: 'compliance_tasks', id: task.id },
      payload: { after: task },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[ComplianceTasks POST]', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
