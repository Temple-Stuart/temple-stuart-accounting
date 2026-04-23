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

    const { entries } = await request.json();
    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries array required' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.brain_dump_entries.deleteMany({ where: { missionId: id } }),
      prisma.brain_dump_entries.createMany({
        data: entries.map(
          (
            e: {
              content: string;
              source?: string;
              triggerQuestion?: string;
              bucket?: string;
              category?: string;
            },
            i: number,
          ) => ({
            missionId: id,
            content: e.content,
            source: e.source === 'voice' ? 'voice' as const : 'typed' as const,
            triggerQuestion: e.triggerQuestion || null,
            bucket: 'open' as const,
            category: e.category || null,
            rawOrder: i,
          }),
        ),
      }),
    ]);

    return NextResponse.json({ count: entries.length });
  } catch (error) {
    console.error('[Brain Dump Save]', error);
    return NextResponse.json({ error: 'Failed to save brain dump' }, { status: 500 });
  }
}
