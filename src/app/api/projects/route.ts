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
    const mission_id = searchParams.get('mission_id');
    const status = searchParams.get('status');

    if (!mission_id) {
      return NextResponse.json({ error: 'mission_id is required' }, { status: 400 });
    }

    // Verify mission ownership
    const mission = await prisma.missions.findUnique({ where: { id: mission_id } });
    if (!mission || mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const where: Record<string, unknown> = { mission_id, is_active: true };
    if (status) where.status = status;

    const projects = await prisma.projects.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({ count: projects.length, projects });
  } catch (error) {
    console.error('[Projects GET]', error);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { mission_id, title, description, domain_label, target_completion, display_order } = body;

    if (!mission_id || !title || !domain_label) {
      return NextResponse.json({ error: 'mission_id, title, and domain_label are required' }, { status: 400 });
    }

    // Verify mission ownership
    const mission = await prisma.missions.findUnique({ where: { id: mission_id } });
    if (!mission || mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    const project = await prisma.projects.create({
      data: {
        mission_id,
        title,
        description: description ?? null,
        domain_label,
        target_completion: target_completion ? new Date(target_completion) : null,
        display_order: display_order ?? 0,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'project_created', description: `Created project "${title}"` },
      target: { table: 'projects', id: project.id },
      payload: { after: project },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('[Projects POST]', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
