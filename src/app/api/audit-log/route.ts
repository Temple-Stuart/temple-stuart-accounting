import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const actorUserId = searchParams.get('actor_user_id');
    const actionType = searchParams.get('action_type');
    const targetTable = searchParams.get('target_table');
    const targetId = searchParams.get('target_id');
    const after = searchParams.get('after');
    const before = searchParams.get('before');
    const limitParam = searchParams.get('limit');

    const limit = Math.min(Math.max(parseInt(limitParam || '100', 10) || 100, 1), 500);

    const where: Record<string, unknown> = {};
    if (actorUserId) where.actor_user_id = actorUserId;
    if (actionType) where.action_type = actionType;
    if (targetTable) where.target_table = targetTable;
    if (targetId) where.target_id = targetId;
    if (after || before) {
      where.created_at = {};
      if (after) (where.created_at as Record<string, unknown>).gte = new Date(after);
      if (before) (where.created_at as Record<string, unknown>).lte = new Date(before);
    }

    const rows = await prisma.audit_log.findMany({
      where,
      orderBy: [{ sequence_number: 'desc' }],
      take: limit,
    });

    const serialized = rows.map((r) => ({
      ...r,
      sequence_number: r.sequence_number.toString(),
    }));

    return NextResponse.json({ count: serialized.length, rows: serialized });
  } catch (error) {
    console.error('[Audit Log]', error);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
