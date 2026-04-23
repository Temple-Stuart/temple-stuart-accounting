import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser, getMissionWithOwnerCheck } from '@/lib/mission/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, stageId } = await params;
    const mission = await getMissionWithOwnerCheck(id, user.id);
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const stage = await prisma.mission_stages.findFirst({
      where: { id: stageId, missionId: id },
    });
    if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    if (stage.status !== 'completed') {
      return NextResponse.json({ error: 'Can only reject completed stages' }, { status: 400 });
    }

    const { reason } = await request.json().catch(() => ({ reason: null }));

    await prisma.mission_stages.update({
      where: { id: stageId },
      data: { status: 'rejected', rejectedAt: new Date(), rejectionReason: reason || null },
    });

    return NextResponse.json({ status: 'rejected' });
  } catch (error) {
    console.error('[Stage Reject]', error);
    return NextResponse.json({ error: 'Failed to reject stage' }, { status: 500 });
  }
}
