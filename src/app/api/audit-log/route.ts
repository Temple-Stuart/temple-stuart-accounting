import { NextRequest, NextResponse } from 'next/server';
import { Prisma, AuditActionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

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
    // PR-Ops-3.5
    'operations_ai_inference',
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
  // AUDIT-01 (2026-09-26): the booking audit trail's families. AUDIT-01b (2026-09-27):
  // 'commission_' is gone — commission_locked is never returned by this route (below),
  // so no prefix names it.
  reservation_: [
    'reservation_booked',
    'reservation_status_changed',
    'reservation_confirmation_code_arrived',
    'reservation_ticketed',
    'reservation_ticket_limit_stated',
    'reservation_cancel_quoted',
    'reservation_cancel_requested',
    'reservation_cancel_pending',
    'reservation_cancelled',
    'reservation_cancel_refused',
    'reservation_email_sent',
    'reservation_email_failed',
    'reservation_posted',
    // LINK-02 (2026-09-27): the owner's budget-line link and unlink. The family is an
    // explicit list (enum columns take no startsWith), so a new value is named here.
    'reservation_budget_linked',
    'reservation_budget_unlinked',
  ],
  money_event_: [
    'money_event_stated',
    'money_event_settled',
  ],
};

/**
 * AUDIT-01b (2026-09-27): action types this route NEVER returns, to any viewer.
 * commission_locked carries Temple Stuart's margin (RECEIPT-01: commission never
 * appears to the customer). It is written with no user id (src/lib/reservations/
 * auditTrail.ts COMMISSION_ACTOR), so the actor scope below already excludes it;
 * this is defense in depth — excluded by name, whatever the filters ask for.
 */
const NEVER_RETURNED: AuditActionType[] = ['commission_locked'];

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
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
    // SEC-1: hard user-scope. The audit trail is per-user — a caller may only
    // ever see rows where THEY are the actor. The previously-accepted
    // ?actor_user_id= param is removed: it let any authed user read another
    // user's audit rows (incl. payload before/after snapshots). No caller
    // param may widen beyond the authenticated user's own rows.
    // AUDIT-01b: and never a row NEVER_RETURNED names — an action_type or prefix filter narrows within this, never past it.
    const where: Prisma.audit_logWhereInput = { actor_user_id: user.id, NOT: { action_type: { in: NEVER_RETURNED } } };

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
