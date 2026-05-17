/**
 * /api/operations/daily-plan/blocks/[blockId]
 *
 * PATCH  — update a calendar block. Mutable: scheduled_start/end, status,
 *          notes, actual_start/end. Immutable: id, user_id, entity_id,
 *          daily_plan_item_id, created_by, created_at. When a scheduled
 *          time changes, overlap is re-checked (excluding this block);
 *          a conflict returns 409 unless body.allow_conflicts is true.
 * DELETE — hard delete.
 *
 * Both handlers scope by user_id with defensive 404 non-disclosure.
 * Audits operations_calendar_block_updated / _deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, CalendarBlockStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { loadAuthorizedCalendarBlock } from '@/lib/operations/loadAuthorizedCalendarBlock';
import { detectBlockConflicts } from '@/lib/operations/detectBlockConflicts';

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { blockId } = await params;
    const existing = await loadAuthorizedCalendarBlock(blockId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Prisma.operations_calendar_blocksUpdateInput = {};

    // Scheduled times: compute effective values, validate ordering,
    // re-check overlap (excluding this block) when either side changes.
    let effectiveStart = existing.scheduled_start;
    let effectiveEnd = existing.scheduled_end;
    let timeChanged = false;

    if (body.scheduled_start !== undefined) {
      const s = parseDate(body.scheduled_start);
      if (!s) {
        return NextResponse.json(
          { error: 'Validation', field: 'scheduled_start', message: 'scheduled_start must be a valid ISO datetime' },
          { status: 400 }
        );
      }
      effectiveStart = s;
      timeChanged = true;
    }

    if (body.scheduled_end !== undefined) {
      const e = parseDate(body.scheduled_end);
      if (!e) {
        return NextResponse.json(
          { error: 'Validation', field: 'scheduled_end', message: 'scheduled_end must be a valid ISO datetime' },
          { status: 400 }
        );
      }
      effectiveEnd = e;
      timeChanged = true;
    }

    let conflicts: string[] = [];
    if (timeChanged) {
      if (effectiveEnd.getTime() <= effectiveStart.getTime()) {
        return NextResponse.json(
          { error: 'Validation', field: 'scheduled_end', message: 'scheduled_end must be after scheduled_start' },
          { status: 400 }
        );
      }
      const allowConflicts = body.allow_conflicts === true;
      conflicts = await detectBlockConflicts(user.id, effectiveStart, effectiveEnd, blockId);
      if (conflicts.length > 0 && !allowConflicts) {
        return NextResponse.json(
          { error: 'Conflict', conflicting_block_ids: conflicts },
          { status: 409 }
        );
      }
      data.scheduled_start = effectiveStart;
      data.scheduled_end = effectiveEnd;
    }

    if (body.actual_start !== undefined) {
      if (body.actual_start === null || body.actual_start === '') {
        data.actual_start = null;
      } else {
        const a = parseDate(body.actual_start);
        if (!a) {
          return NextResponse.json(
            { error: 'Validation', field: 'actual_start', message: 'actual_start must be a valid ISO datetime' },
            { status: 400 }
          );
        }
        data.actual_start = a;
      }
    }

    if (body.actual_end !== undefined) {
      if (body.actual_end === null || body.actual_end === '') {
        data.actual_end = null;
      } else {
        const a = parseDate(body.actual_end);
        if (!a) {
          return NextResponse.json(
            { error: 'Validation', field: 'actual_end', message: 'actual_end must be a valid ISO datetime' },
            { status: 400 }
          );
        }
        data.actual_end = a;
      }
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: 'Validation', field: 'status', message: 'invalid status value' },
          { status: 400 }
        );
      }
      data.status = body.status as CalendarBlockStatus;
    }

    if (body.notes !== undefined) {
      data.notes =
        typeof body.notes === 'string' && body.notes.trim().length > 0
          ? body.notes.trim()
          : null;
    }

    const block = await prisma.operations_calendar_blocks.update({
      where: { id: blockId },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_calendar_block_updated',
        description: `Updated calendar block ${blockId}`,
      },
      target: { table: 'operations_calendar_blocks', id: block.id },
      payload: {
        before: existing,
        after: block,
        metadata: {
          daily_plan_item_id: existing.daily_plan_item_id,
          time_changed: timeChanged,
          conflicts_overridden: conflicts.length > 0 ? conflicts : undefined,
        },
      },
    });

    return NextResponse.json({ block, conflicts });
  } catch (error) {
    console.error('[Calendar Block PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update calendar block', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { blockId } = await params;
    const existing = await loadAuthorizedCalendarBlock(blockId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.operations_calendar_blocks.delete({ where: { id: blockId } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_calendar_block_deleted',
        description: `Deleted calendar block ${blockId}`,
      },
      target: { table: 'operations_calendar_blocks', id: blockId },
      payload: {
        before: existing,
        metadata: {
          daily_plan_item_id: existing.daily_plan_item_id,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Calendar Block DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete calendar block', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
