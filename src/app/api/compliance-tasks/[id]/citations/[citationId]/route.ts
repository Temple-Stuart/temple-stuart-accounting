import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; citationId: string }> }
) {
  try {
    const { id, citationId } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Verify task ownership via chain
    const task = await prisma.compliance_tasks.findUnique({
      where: { id },
      include: { workstream: { include: { project: { include: { mission: true } } } } },
    });
    if (!task || task.workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Find the task_citation row by composite unique (task_id + citation_id)
    const taskCitation = await prisma.task_citations.findUnique({
      where: { task_id_citation_id: { task_id: id, citation_id: citationId } },
    });
    if (!taskCitation) {
      return NextResponse.json({ error: 'Citation link not found' }, { status: 404 });
    }

    await prisma.task_citations.delete({
      where: { id: taskCitation.id },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'task_evidence_attached', description: `Detached citation from task "${task.title}"` },
      target: { table: 'task_citations', id: taskCitation.id },
      payload: {
        before: taskCitation,
        metadata: { task_id: id, citation_id: citationId, action: 'detached' },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TaskCitations DELETE]', error);
    return NextResponse.json({ error: 'Failed to detach citation' }, { status: 500 });
  }
}
