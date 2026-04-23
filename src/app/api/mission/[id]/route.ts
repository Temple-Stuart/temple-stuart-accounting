import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser } from '@/lib/mission/auth';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const mission = await prisma.missions.findFirst({
      where: { id, userId: user.id },
      include: {
        brainDumpEntries: { orderBy: { rawOrder: 'asc' } },
        stages: { orderBy: [{ stageOrder: 'asc' }, { attemptNumber: 'desc' }] },
        realityConstraints: true,
        roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
        missionTasks: { orderBy: { scheduledDate: 'asc' } },
      },
    });

    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    return NextResponse.json({ mission });
  } catch (error) {
    console.error('[Mission Get]', error);
    return NextResponse.json({ error: 'Failed to load mission' }, { status: 500 });
  }
}
