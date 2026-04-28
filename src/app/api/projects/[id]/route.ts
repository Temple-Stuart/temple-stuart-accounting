import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

async function getAuthUser(userEmail: string) {
  return prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
}

async function getProjectWithOwnership(id: string) {
  return prisma.projects.findUnique({
    where: { id },
    include: { mission: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getAuthUser(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const project = await prisma.projects.findUnique({
      where: { id },
      include: {
        mission: true,
        workstreams: {
          where: { is_active: true },
          include: {
            tasks: {
              where: { is_active: true },
              include: {
                citations: {
                  include: { citation: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project || project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('[Project GET]', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getAuthUser(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existing = await getProjectWithOwnership(id);
    if (!existing || existing.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'domain_label', 'status',
      'target_completion', 'display_order', 'is_active',
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'target_completion') {
          data[field] = body[field] ? new Date(body[field]) : null;
        } else {
          data[field] = body[field];
        }
      }
    }

    const project = await prisma.projects.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'project_updated', description: `Updated project "${project.title}"` },
      target: { table: 'projects', id: project.id },
      payload: { before: existing, after: project },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error('[Project PATCH]', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getAuthUser(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const existing = await getProjectWithOwnership(id);
    if (!existing || existing.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await prisma.projects.update({
      where: { id },
      data: { is_active: false },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'project_deleted', description: `Soft-deleted project "${project.title}"` },
      target: { table: 'projects', id: project.id },
      payload: { before: existing, after: project },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Project DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
