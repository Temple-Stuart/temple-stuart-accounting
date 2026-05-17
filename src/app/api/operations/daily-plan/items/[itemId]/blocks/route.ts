/**
 * POST /api/operations/daily-plan/items/[itemId]/blocks
 *
 * Creates a calendar block under a daily plan item. user_id and entity_id
 * are derived from the parent item (never trusted from the client). Overlap
 * with existing non-cancelled/non-missed blocks is rejected with 409 unless
 * the body sets allow_conflicts: true. Conflicts are always reported in the
 * response so the frontend can render a visual indicator either way.
 *
 * Audits operations_calendar_block_created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CalendarBlockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { loadAuthorizedDailyPlanItem } from '@/lib/operations/loadAuthorizedDailyPlanItem';
import { detectBlockConflicts } from '@/lib/operations/detectBlockConflicts';
import { isValidUuid } from '@/lib/operations/parseUuid';

const VALID_STATUSES: CalendarBlockStatus[] = [
  'scheduled',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
];

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { itemId } = await params;
    if (!isValidUuid(itemId)) {
      return NextResponse.json({ error: 'Validation', field: 'itemId', message: 'Invalid UUID format' }, { status: 400 });
    }
    const item = await loadAuthorizedDailyPlanItem(itemId, user.id);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();

    const start = parseDate(body.scheduled_start);
    if (!start) {
      return NextResponse.json(
        { error: 'Validation', field: 'scheduled_start', message: 'scheduled_start is required (ISO datetime)' },
        { status: 400 }
      );
    }
    const end = parseDate(body.scheduled_end);
    if (!end) {
      return NextResponse.json(
        { error: 'Validation', field: 'scheduled_end', message: 'scheduled_end is required (ISO datetime)' },
        { status: 400 }
      );
    }
    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: 'Validation', field: 'scheduled_end', message: 'scheduled_end must be after scheduled_start' },
        { status: 400 }
      );
    }

    let status: CalendarBlockStatus = 'scheduled';
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: 'Validation', field: 'status', message: 'invalid status value' },
          { status: 400 }
        );
      }
      status = body.status as CalendarBlockStatus;
    }

    const notes =
      typeof body.notes === 'string' && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;

    const allowConflicts = body.allow_conflicts === true;

    const conflicts = await detectBlockConflicts(user.id, start, end);
    if (conflicts.length > 0 && !allowConflicts) {
      return NextResponse.json(
        { error: 'Conflict', conflicting_block_ids: conflicts },
        { status: 409 }
      );
    }

    const block = await prisma.operations_calendar_blocks.create({
      data: {
        user_id: item.user_id,
        entity_id: item.entity_id,
        daily_plan_item_id: item.id,
        scheduled_start: start,
        scheduled_end: end,
        status,
        notes,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_calendar_block_created',
        description: `Created calendar block under daily plan item ${itemId}`,
      },
      target: { table: 'operations_calendar_blocks', id: block.id },
      payload: {
        after: block,
        metadata: {
          daily_plan_item_id: itemId,
          allow_conflicts_used: allowConflicts,
          conflicts_overridden: conflicts.length > 0 ? conflicts : undefined,
        },
      },
    });

    return NextResponse.json({ block, conflicts }, { status: 201 });
  } catch (error) {
    console.error('[Calendar Block POST]', error);
    return NextResponse.json(
      { error: 'Failed to create calendar block', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
