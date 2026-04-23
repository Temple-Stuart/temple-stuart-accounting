import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser } from '@/lib/mission/auth';

export async function POST(request: Request) {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, durationDays } = await request.json();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

    const mission = await prisma.missions.create({
      data: {
        userId: user.id,
        name: title,
        goalDescription: '',
        doneDefinition: '',
        startDate: new Date(),
        endDate: new Date(Date.now() + (durationDays || 75) * 86400000),
        totalDays: durationDays || 75,
        missionStatus: 'draft',
        durationDays: durationDays || null,
        status: 'active',
      },
      select: { id: true, name: true, missionStatus: true, durationDays: true },
    });

    return NextResponse.json({ mission });
  } catch (error) {
    console.error('[Mission Create]', error);
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }
}
