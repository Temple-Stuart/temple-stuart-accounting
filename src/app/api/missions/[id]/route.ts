import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const mission = await prisma.missions.findUnique({
      where: { id },
      include: {
        projects: {
          where: { is_active: true },
          include: {
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
        },
      },
    });

    if (!mission || mission.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error('[Mission GET]', error);
    return NextResponse.json({ error: 'Failed to load mission' }, { status: 500 });
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

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const existing = await prisma.missions.findUnique({ where: { id } });
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'status', 'target_completion',
      'actual_completion', 'framework_mappings', 'is_active',
    ];

    const data: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'target_completion' || field === 'actual_completion') {
          data[field] = body[field] ? new Date(body[field]) : null;
        } else {
          data[field] = body[field];
        }
      }
    }

    const mission = await prisma.missions.update({
      where: { id },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'mission_updated', description: `Updated mission "${mission.title}"` },
      target: { table: 'missions', id: mission.id },
      payload: { before: existing, after: mission },
    });

    if (body.status !== undefined && body.status !== existing.status) {
      await writeAuditLog({
        actor: { user_id: user.id, email: userEmail, type: 'human_user' },
        action: {
          type: 'mission_status_changed',
          description: `Mission status changed from ${existing.status} to ${body.status}`,
        },
        target: { table: 'missions', id: mission.id },
        payload: {
          before: { status: existing.status },
          after: { status: mission.status },
        },
      });
    }

    return NextResponse.json(mission);
  } catch (error) {
    console.error('[Mission PATCH]', error);
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 });
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

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const existing = await prisma.missions.findUnique({ where: { id } });
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const mission = await prisma.missions.update({
      where: { id },
      data: { is_active: false },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'mission_deleted', description: `Soft-deleted mission "${mission.title}"` },
      target: { table: 'missions', id: mission.id },
      payload: { before: existing, after: mission },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Mission DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 });
  }
}
