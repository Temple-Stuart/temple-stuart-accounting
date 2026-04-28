import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

async function getAuthUser(userEmail: string) {
  return prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
}

async function getWorkstreamWithOwnership(id: string) {
  return prisma.workstreams.findUnique({
    where: { id },
    include: { project: { include: { mission: true } } },
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

    const workstream = await prisma.workstreams.findUnique({
      where: { id },
      include: {
        project: { include: { mission: true } },
        tasks: {
          where: { is_active: true },
          include: {
            citations: {
              include: { citation: true },
            },
          },
        },
      },
    });

    if (!workstream || workstream.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(workstream);
  } catch (error) {
    console.error('[Workstream GET]', error);
    return NextResponse.json({ error: 'Failed to load workstream' }, { status: 500 });
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

    const existing = await getWorkstreamWithOwnership(id);
    if (!existing || existing.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ['title', 'description', 'status', 'display_order', 'is_active'];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    const workstream = await prisma.workstreams.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'workstream_updated', description: `Updated workstream "${workstream.title}"` },
      target: { table: 'workstreams', id: workstream.id },
      payload: { before: existing, after: workstream },
    });

    return NextResponse.json(workstream);
  } catch (error) {
    console.error('[Workstream PATCH]', error);
    return NextResponse.json({ error: 'Failed to update workstream' }, { status: 500 });
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

    const existing = await getWorkstreamWithOwnership(id);
    if (!existing || existing.project.mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const workstream = await prisma.workstreams.update({
      where: { id },
      data: { is_active: false },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'workstream_deleted', description: `Soft-deleted workstream "${workstream.title}"` },
      target: { table: 'workstreams', id: workstream.id },
      payload: { before: existing, after: workstream },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Workstream DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete workstream' }, { status: 500 });
  }
}
