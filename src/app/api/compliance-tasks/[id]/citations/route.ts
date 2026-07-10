import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    // Verify task ownership via chain
    const task = await prisma.compliance_tasks.findUnique({
      where: { id },
      include: { workstream: { include: { project: { include: { mission: true } } } } },
    });
    if (!task || task.workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { citation_id, relevance_note } = body;

    if (!citation_id) {
      return NextResponse.json({ error: 'citation_id is required' }, { status: 400 });
    }

    const taskCitation = await prisma.task_citations.create({
      data: {
        task_id: id,
        citation_id,
        relevance_note: relevance_note ?? null,
      },
      include: { citation: true },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'task_evidence_attached', description: `Attached citation to task "${task.title}"` },
      target: { table: 'task_citations', id: taskCitation.id },
      payload: {
        after: taskCitation,
        metadata: { task_id: id, citation_id, action: 'attached' },
      },
    });

    return NextResponse.json(taskCitation, { status: 201 });
  } catch (error) {
    console.error('[TaskCitations POST]', error);
    return NextResponse.json({ error: 'Failed to attach citation' }, { status: 500 });
  }
}
