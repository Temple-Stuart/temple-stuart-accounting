import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

async function getAuthUser() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
}

interface DecisionEntry {
  questionId: string;
  questionText: string;
  status: string;
  statusReason: string;
  regulatoryExposure: {
    statute: string;
    penaltyRange: string;
    enforcementLikelihood: string;
    notes: string;
  };
  requiredAction: {
    action: string | null;
    deadline: string | null;
    effort: string;
    blockedBy: string[];
  };
}

function mapPriority(status: string, enforcement: string): string {
  if (status === 'at_risk' && enforcement === 'high') return 'critical';
  if (status === 'at_risk') return 'high';
  if (status === 'undecided' && enforcement === 'high') return 'high';
  if (status === 'undecided') return 'medium';
  if (status === 'blocked') return 'medium';
  return 'low';
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { missionId, moduleId, workstreamId, mode } = body;

    if (!missionId || !moduleId || !workstreamId) {
      return NextResponse.json({ error: 'missionId, moduleId, workstreamId required' }, { status: 400 });
    }

    const mission = await prisma.missions.findFirst({ where: { id: missionId, userId: user.id } });
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    if (mode === 'from_analysis') {
      const analysis = await prisma.ops_workstream_analysis.findFirst({
        where: { missionId, moduleId, workstreamId, userId: user.id },
      });
      if (!analysis) return NextResponse.json({ error: 'No analysis found for this workstream' }, { status: 404 });

      let parsed: { decisions?: DecisionEntry[] };
      try {
        parsed = JSON.parse(analysis.analysisOutput);
      } catch {
        return NextResponse.json({ error: 'Failed to parse analysis output' }, { status: 500 });
      }

      const actionableDecisions = (parsed.decisions || []).filter(
        (d) => d.status === 'undecided' || d.status === 'at_risk' || d.status === 'blocked',
      );

      const tasks = [];
      for (const d of actionableDecisions) {
        const title = d.requiredAction.action || `Resolve: ${d.questionText?.substring(0, 80)}`;
        const description = [d.statusReason, d.regulatoryExposure.notes].filter(Boolean).join('\n\n');
        const steps = d.requiredAction.action
          ? JSON.stringify([{ order: 1, step: d.requiredAction.action, detail: '' }])
          : '[]';
        const priority = mapPriority(d.status, d.regulatoryExposure.enforcementLikelihood);

        const task = await prisma.compliance_tasks.upsert({
          where: { missionId_moduleId_questionId: { missionId, moduleId, questionId: d.questionId } },
          create: {
            missionId, moduleId, workstreamId, questionId: d.questionId, userId: user.id,
            title, description, actionSteps: steps,
            estimatedEffort: d.requiredAction.effort || null,
            deadlineLabel: d.requiredAction.deadline || null,
            statute: d.regulatoryExposure.statute !== 'N/A' ? d.regulatoryExposure.statute : null,
            penaltyRange: d.regulatoryExposure.penaltyRange !== 'N/A' ? d.regulatoryExposure.penaltyRange : null,
            priority, status: 'suggested',
            sourceAnalysisId: analysis.id,
            blockedByTasks: d.requiredAction.blockedBy.length > 0 ? JSON.stringify(d.requiredAction.blockedBy) : null,
          },
          update: {
            title, description, actionSteps: steps,
            estimatedEffort: d.requiredAction.effort || null,
            statute: d.regulatoryExposure.statute !== 'N/A' ? d.regulatoryExposure.statute : null,
            penaltyRange: d.regulatoryExposure.penaltyRange !== 'N/A' ? d.regulatoryExposure.penaltyRange : null,
            priority, sourceAnalysisId: analysis.id,
          },
        });
        tasks.push(task);
      }

      return NextResponse.json({ tasks, count: tasks.length });
    }

    if (mode === 'manual') {
      const { questionId, title, description, actionSteps, estimatedCostMin, estimatedCostMax, estimatedEffort, effortQuantity, deadline, deadlineLabel, statute, penaltyRange, priority } = body;
      if (!questionId || !title) return NextResponse.json({ error: 'questionId and title required' }, { status: 400 });

      const task = await prisma.compliance_tasks.create({
        data: {
          missionId, moduleId, workstreamId, questionId, userId: user.id,
          title, description: description || '', actionSteps: actionSteps || '[]',
          estimatedCostMin, estimatedCostMax, estimatedEffort, effortQuantity,
          deadline: deadline ? new Date(deadline) : null, deadlineLabel,
          statute, penaltyRange, priority: priority || 'medium', status: 'not_started',
        },
      });
      return NextResponse.json({ task });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('[Tasks POST]', error);
    return NextResponse.json({ error: 'Failed to create tasks' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const moduleId = searchParams.get('moduleId');
    const workstreamId = searchParams.get('workstreamId');
    const status = searchParams.get('status');

    if (!missionId) return NextResponse.json({ error: 'missionId required' }, { status: 400 });

    const where: Record<string, unknown> = { missionId, userId: user.id };
    if (moduleId) where.moduleId = moduleId;
    if (workstreamId) where.workstreamId = workstreamId;
    if (status) where.status = status;

    const tasks = await prisma.compliance_tasks.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { deadline: 'asc' },
      ],
    });

    const counts = { total: tasks.length, suggested: 0, not_started: 0, in_progress: 0, blocked: 0, complete: 0, verified: 0, expired: 0 };
    for (const t of tasks) {
      const key = t.status.replace('-', '_') as keyof typeof counts;
      if (key in counts && key !== 'total') (counts[key] as number)++;
    }

    return NextResponse.json({ tasks, counts });
  } catch (error) {
    console.error('[Tasks GET]', error);
    return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { taskId, ...updates } = body;
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

    const task = await prisma.compliance_tasks.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const data: Record<string, unknown> = {};
    const allowed = ['status', 'deadline', 'calendarStart', 'calendarEnd', 'calendarEventId', 'priority', 'title', 'description', 'actionSteps', 'deadlineLabel', 'estimatedCostMin', 'estimatedCostMax'];
    for (const key of allowed) {
      if (key in updates) {
        if ((key === 'deadline' || key === 'calendarStart' || key === 'calendarEnd') && updates[key]) {
          data[key] = new Date(updates[key] as string);
        } else {
          data[key] = updates[key];
        }
      }
    }

    if (updates.status === 'verified') {
      data.verifiedAt = new Date();
      data.verifiedBy = user.id;
    }

    const updated = await prisma.compliance_tasks.update({ where: { id: taskId }, data });
    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error('[Tasks PATCH]', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

    const task = await prisma.compliance_tasks.findFirst({ where: { id: taskId, userId: user.id } });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    await prisma.compliance_tasks.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Tasks DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
