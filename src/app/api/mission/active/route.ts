import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser } from '@/lib/mission/auth';

export async function GET() {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const mission = await prisma.missions.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        brainDumpEntries: { orderBy: { rawOrder: 'asc' } },
        stages: { orderBy: [{ stageOrder: 'asc' }, { attemptNumber: 'desc' }] },
        realityConstraints: true,
      },
    });

    return NextResponse.json({ mission: mission || null });
  } catch (error) {
    console.error('[Mission Active]', error);
    return NextResponse.json({ error: 'Failed to load mission' }, { status: 500 });
  }
}
