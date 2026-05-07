import { NextRequest, NextResponse } from 'next/server';
import { Prisma, AuditActionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * Subsystem prefix → enum value list. Maintained explicitly because Prisma's
 * `startsWith` filter does not work on enum columns (Postgres enums are not
 * text-pattern-comparable). When new operations_* AuditActionType values are
 * added in future PRs, append them here.
 *
 * The map is keyed by the prefix string the caller passes (?prefix=operations_).
 * To extend to other subsystems, add entries — e.g., regulatory_, embedding_.
 */
const SUBSYSTEM_ACTION_TYPES: Record<string, AuditActionType[]> = {
  operations_: [
    // PR-Ops-1
    'operations_project_created',
    'operations_project_updated',
    'operations_project_status_changed',
    'operations_project_deleted',
    'operations_project_task_created',
    'operations_project_task_updated',
    'operations_project_task_status_changed',
    'operations_project_task_completed',
    'operations_project_task_deleted',
    'operations_project_dependency_added',
    'operations_project_dependency_removed',
    'operations_routine_created',
    'operations_routine_updated',
    'operations_routine_deactivated',
    'operations_routine_deleted',
    'operations_routine_completed',
    'operations_routine_missed',
    'operations_issue_logged',
    'operations_issue_updated',
    'operations_issue_status_changed',
    'operations_issue_resolved',
    'operations_issue_deleted',
    'operations_vendor_added',
    'operations_vendor_updated',
    'operations_vendor_deactivated',
    'operations_vendor_deleted',
    'operations_priority_recomputed',
    // PR-Ops-1.5
    'operations_north_star_created',
    'operations_north_star_updated',
    'operations_north_star_reviewed',
  ],
};

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const actorUserId = searchParams.get('actor_user_id');
    const actionType = searchParams.get('action_type');
    const prefix = searchParams.get('prefix');
    const targetTable = searchParams.get('target_table');
    const targetId = searchParams.get('target_id');
    const after = searchParams.get('after');
    const before = searchParams.get('before');
    const limitParam = searchParams.get('limit');

    const limit = Math.min(Math.max(parseInt(limitParam || '100', 10) || 100, 1), 500);

    // Strongly typed where clause prevents the class of bug PR-Ops-2a-fix2 fixes:
    // the previous Record<string, unknown> typing accepted a startsWith filter on
    // an enum column at compile time, which Prisma rejected at runtime once
    // operations_* rows existed and the filter was actually evaluated.
    const where: Prisma.audit_logWhereInput = {};

    if (actorUserId) where.actor_user_id = actorUserId;

    // action_type exact match wins over prefix; only one filter applies.
    // Prefix lookups resolve to a static `in` list of enum values — see
    // SUBSYSTEM_ACTION_TYPES above. Prefix values not in the map return
    // an empty result set (rather than 400) for forward-compat.
    if (actionType) {
      where.action_type = actionType as AuditActionType;
    } else if (prefix) {
      const list = SUBSYSTEM_ACTION_TYPES[prefix];
      if (!list || list.length === 0) {
        return NextResponse.json({ count: 0, rows: [] });
      }
      where.action_type = { in: list };
    }

    if (targetTable) where.target_table = targetTable;
    if (targetId) where.target_id = targetId;
    if (after || before) {
      where.created_at = {};
      if (after) where.created_at.gte = new Date(after);
      if (before) where.created_at.lte = new Date(before);
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
