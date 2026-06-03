/**
 * /api/operations/routines/steps/[stepId]
 *
 * PATCH  — update a routine step. Mutable: step_order, time_of_day, activity,
 *          sub_activity, location, duration_minutes, notes. Immutable:
 *          id, routine_id, user_id, entity_id, created_by, created_at.
 *          Reordering is a step_order PATCH (audits as _updated).
 * DELETE — OPS-CE-1: NON-DESTRUCTIVE. Soft-deletes (is_active=false) instead
 *          of hard-deleting, so the step's content_scene row and every logged
 *          take (answer) survive. Active routine/grid views filter is_active.
 *          The full row is still captured in the audit payload_before.
 *
 * Both scope by user_id (denormalized on the step row) with defensive 404.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { parseTimeOrNull } from '@/lib/operations/parseTime';
import { loadAuthorizedRoutineStep } from '@/lib/operations/loadAuthorizedRoutineStep';

function trimNullable(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { stepId } = await params;
    if (!isValidUuid(stepId)) {
      return NextResponse.json(
        { error: 'Validation', field: 'stepId', message: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    const existing = await loadAuthorizedRoutineStep(stepId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Prisma.operations_routine_stepsUpdateInput = {};

    if (body.activity !== undefined) {
      const a = trimNullable(body.activity);
      if (!a) {
        return NextResponse.json(
          { error: 'Validation', field: 'activity', message: 'activity cannot be empty' },
          { status: 400 }
        );
      }
      if (a.length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'activity', message: 'activity exceeds 200 characters' },
          { status: 400 }
        );
      }
      data.activity = a;
    }

    if (body.sub_activity !== undefined) {
      const s = trimNullable(body.sub_activity);
      if (s && s.length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'sub_activity', message: 'sub_activity exceeds 200 characters' },
          { status: 400 }
        );
      }
      data.sub_activity = s;
    }

    if (body.location !== undefined) {
      const l = trimNullable(body.location);
      if (l && l.length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'location', message: 'location exceeds 200 characters' },
          { status: 400 }
        );
      }
      data.location = l;
    }

    if (body.notes !== undefined) {
      data.notes = trimNullable(body.notes);
    }

    if (body.duration_minutes !== undefined) {
      if (body.duration_minutes === null || body.duration_minutes === '') {
        data.duration_minutes = null;
      } else {
        const n = Number(body.duration_minutes);
        if (!Number.isInteger(n) || n < 0) {
          return NextResponse.json(
            { error: 'Validation', field: 'duration_minutes', message: 'must be a non-negative integer' },
            { status: 400 }
          );
        }
        data.duration_minutes = n;
      }
    }

    if (body.step_order !== undefined) {
      const n = Number(body.step_order);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'step_order', message: 'must be a non-negative integer' },
          { status: 400 }
        );
      }
      data.step_order = n;
    }

    if (body.time_of_day !== undefined) {
      const timeResult = parseTimeOrNull(body.time_of_day, 'time_of_day');
      if (timeResult.error) return timeResult.error;
      data.time_of_day = timeResult.value;
    }

    const step = await prisma.operations_routine_steps.update({
      where: { id: stepId },
      data,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_routine_step_updated',
        description: `Updated routine step "${step.activity}"`,
      },
      target: { table: 'operations_routine_steps', id: step.id },
      payload: {
        before: existing,
        after: step,
        metadata: { routine_id: existing.routine_id },
      },
    });

    return NextResponse.json({ step });
  } catch (error) {
    console.error('[Routine Step PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update routine step', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { stepId } = await params;
    if (!isValidUuid(stepId)) {
      return NextResponse.json(
        { error: 'Validation', field: 'stepId', message: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    const existing = await loadAuthorizedRoutineStep(stepId, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // OPS-CE-1: ARCHIVE, do NOT hard-delete. A hard delete would CASCADE through
    // operations_content_scenes (routine_step_id, onDelete: Cascade) into
    // operations_content_takes (scene_id, onDelete: Cascade) — wiping every
    // logged answer. Soft-deleting preserves the scene-row + all takes; active
    // views filter is_active=true so the step disappears from the routine while
    // its history stays queryable (the evolution loop's append/preserve rule).
    const archived = await prisma.operations_routine_steps.update({
      where: { id: stepId },
      data: { is_active: false },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_routine_step_deleted',
        description: `Archived (soft-deleted) routine step "${existing.activity}" — scene-row and logged takes preserved`,
      },
      target: { table: 'operations_routine_steps', id: existing.id },
      payload: {
        before: existing,
        after: archived,
        metadata: { routine_id: existing.routine_id, soft_delete: true },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Routine Step DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete routine step', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
