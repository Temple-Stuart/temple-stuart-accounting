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
    const project_id = searchParams.get('project_id');
    const status = searchParams.get('status');

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Verify ownership via project -> mission chain
    const project = await prisma.projects.findUnique({
      where: { id: project_id },
      include: { mission: true },
    });
    if (!project || project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const where: Record<string, unknown> = { project_id, is_active: true };
    if (status) where.status = status;

    const workstreams = await prisma.workstreams.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ count: workstreams.length, workstreams });
  } catch (error) {
    console.error('[Workstreams GET]', error);
    return NextResponse.json({ error: 'Failed to load workstreams' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { project_id, title, description, display_order } = body;

    if (!project_id || !title) {
      return NextResponse.json({ error: 'project_id and title are required' }, { status: 400 });
    }

    // Verify ownership via project -> mission chain
    const project = await prisma.projects.findUnique({
      where: { id: project_id },
      include: { mission: true },
    });
    if (!project || project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const workstream = await prisma.workstreams.create({
      data: {
        project_id,
        title,
        description: description ?? null,
        display_order: display_order ?? 0,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'workstream_created', description: `Created workstream "${title}"` },
      target: { table: 'workstreams', id: workstream.id },
      payload: { after: workstream },
    });

    return NextResponse.json(workstream, { status: 201 });
  } catch (error) {
    console.error('[Workstreams POST]', error);
    return NextResponse.json({ error: 'Failed to create workstream' }, { status: 500 });
  }
}
