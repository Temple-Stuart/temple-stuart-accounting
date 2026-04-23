import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMissionUser, getMissionWithOwnerCheck } from '@/lib/mission/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getMissionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const mission = await getMissionWithOwnerCheck(id, user.id);
    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 });

    const { constraints } = await request.json();
    if (!Array.isArray(constraints)) {
      return NextResponse.json({ error: 'constraints array required' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.reality_constraints.deleteMany({ where: { missionId: id } }),
      prisma.reality_constraints.createMany({
        data: constraints.map(
          (c: { constraintType: string; category: string; description: string; value?: string }) => ({
            missionId: id,
            constraintType: c.constraintType as 'product' | 'operational',
            category: c.category,
            description: c.description,
            value: c.value || null,
            source: 'manual',
          }),
        ),
      }),
    ]);

    return NextResponse.json({ count: constraints.length });
  } catch (error) {
    console.error('[Reality Constraints]', error);
    return NextResponse.json({ error: 'Failed to save constraints' }, { status: 500 });
  }
}
