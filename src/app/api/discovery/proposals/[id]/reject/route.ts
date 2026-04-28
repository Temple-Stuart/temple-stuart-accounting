import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

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

    const proposal = await prisma.discovery_proposals.findUnique({
      where: { id },
      include: { discovery_run: true },
    });

    if (!proposal || proposal.discovery_run.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (proposal.status !== 'proposed') {
      return NextResponse.json(
        { error: `Proposal cannot be rejected — current status is "${proposal.status}"` },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { reason } = body as { reason: string };

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }

    const updated = await prisma.discovery_proposals.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewed_at: new Date(),
        reviewed_by: userEmail,
        review_notes: reason,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: 'Rejected discovery proposal',
      },
      target: { table: 'discovery_proposals', id: updated.id },
      payload: { before: proposal, after: updated },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Discovery Proposal Reject POST]', error);
    return NextResponse.json({ error: 'Failed to reject proposal' }, { status: 500 });
  }
}
