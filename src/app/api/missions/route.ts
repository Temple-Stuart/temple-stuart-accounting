import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const entity_id = searchParams.get('entity_id');
    const is_active = searchParams.get('is_active');

    const where: Record<string, unknown> = { user_id: user.id };
    if (status) where.status = status;
    if (entity_id) where.entity_id = entity_id;
    if (is_active !== null && is_active !== undefined && is_active !== '') {
      where.is_active = is_active === 'true';
    } else {
      where.is_active = true;
    }

    const missions = await prisma.missions.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return NextResponse.json({ count: missions.length, missions });
  } catch (error) {
    console.error('[Missions GET]', error);
    return NextResponse.json({ error: 'Failed to load missions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { title, description, entity_id, target_completion, framework_mappings } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const mission = await prisma.missions.create({
      data: {
        user_id: user.id,
        title,
        description: description ?? null,
        entity_id: entity_id ?? null,
        target_completion: target_completion ? new Date(target_completion) : null,
        framework_mappings: framework_mappings ?? [],
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'mission_created', description: `Created mission "${title}"` },
      target: { table: 'missions', id: mission.id },
      payload: { after: mission },
    });

    return NextResponse.json(mission, { status: 201 });
  } catch (error) {
    console.error('[Missions POST]', error);
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }
}
