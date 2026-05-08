/**
 * /api/operations/routines/[id]
 *
 * GET    — return one routine.
 * PATCH  — update fields. Audit discriminates:
 *            * is_active true→false → operations_routine_deactivated
 *            * is_active false→true → operations_routine_updated
 *              (no _reactivated enum exists in v0; document and reuse _updated)
 *            * any change to schedule_rrule, timezone, fail_threshold_minutes →
 *              recompute next_due_at via expandForward.
 *            * everything else → operations_routine_updated
 * DELETE — hard delete. Cascades to operations_routine_completions via FK.
 *          Audits operations_routine_deleted with full payload_before.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { compileFormToRRule, expandForward } from '@/lib/operations/rruleHelpers';
import type { RoutineForm } from '@/components/workbench/operations/routines/types';

async function loadAuthorizedRoutine(routineId: string, userId: string) {
  return prisma.operations_routines.findFirst({
    where: { id: routineId, user_id: userId },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const routine = await loadAuthorizedRoutine(id, user.id);
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ routine });
  } catch (error) {
    console.error('[Routine GET]', error);
    return NextResponse.json(
      { error: 'Failed to load routine', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await loadAuthorizedRoutine(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = (await request.json()) as Partial<RoutineForm>;

    const data: Prisma.operations_routinesUpdateInput = {};
    let scheduleChanged = false;

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.trim().length > 200) {
        return NextResponse.json(
          { error: 'Validation', field: 'name', message: 'required, max 200 chars' },
          { status: 400 }
        );
      }
      const trimmed = body.name.trim();
      if (trimmed !== existing.name) {
        // Pre-emptive uniqueness check.
        const dup = await prisma.operations_routines.findFirst({
          where: { user_id: user.id, name: trimmed, NOT: { id } },
        });
        if (dup) {
          return NextResponse.json(
            { error: 'Duplicate', field: 'name', message: 'a routine with this name already exists' },
            { status: 409 }
          );
        }
      }
      data.name = trimmed;
    }

    if (body.description !== undefined) {
      data.description = typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : null;
    }

    if (body.ideal_time_label !== undefined) {
      data.ideal_time_label = typeof body.ideal_time_label === 'string' && body.ideal_time_label.trim().length > 0
        ? body.ideal_time_label.trim()
        : null;
    }

    if (body.fail_threshold_minutes !== undefined) {
      const n = parseInt(String(body.fail_threshold_minutes), 10);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'fail_threshold_minutes', message: 'must be a non-negative integer' },
          { status: 400 }
        );
      }
      data.fail_threshold_minutes = n;
    }

    if (body.timezone !== undefined) {
      if (typeof body.timezone !== 'string' || body.timezone.trim().length === 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'timezone', message: 'required' },
          { status: 400 }
        );
      }
      data.timezone = body.timezone;
      scheduleChanged = true;
    }

    // Recompile RRULE if any cadence-related field is supplied.
    const cadenceFieldsPresent =
      body.cadence_mode !== undefined ||
      body.weekly_byday !== undefined ||
      body.monthly_day_of_month !== undefined ||
      body.monthly_nth !== undefined ||
      body.monthly_weekday !== undefined ||
      body.custom_rrule !== undefined ||
      body.byhour !== undefined ||
      body.byminute !== undefined;

    if (cadenceFieldsPresent) {
      try {
        const compiled = compileFormToRRule(body as RoutineForm);
        data.schedule_rrule = compiled;
        scheduleChanged = true;
      } catch (e) {
        return NextResponse.json(
          {
            error: 'Validation',
            field: 'schedule_rrule',
            message: e instanceof Error ? e.message : 'invalid cadence configuration',
          },
          { status: 400 }
        );
      }
    }

    let activationToggle: 'deactivated' | 'reactivated' | null = null;
    if (body.is_active !== undefined) {
      const incoming = Boolean(body.is_active);
      if (incoming !== existing.is_active) {
        activationToggle = incoming ? 'reactivated' : 'deactivated';
      }
      data.is_active = incoming;
    }

    // If cadence/timezone changed, recompute next_due_at.
    if (scheduleChanged) {
      const nextRrule = (data.schedule_rrule as string | undefined) ?? existing.schedule_rrule;
      const nextTz = (data.timezone as string | undefined) ?? existing.timezone;
      try {
        const upcoming = expandForward(nextRrule, nextTz, new Date(), 1);
        data.next_due_at = upcoming[0] ?? null;
      } catch (e) {
        console.error('[Routine PATCH] next_due_at recompute failed', e);
      }
    }

    const routine = await prisma.operations_routines.update({
      where: { id },
      data,
    });

    let actionType: 'operations_routine_deactivated' | 'operations_routine_updated';
    let description: string;
    if (activationToggle === 'deactivated') {
      actionType = 'operations_routine_deactivated';
      description = `Deactivated routine "${existing.name}"`;
    } else {
      // activationToggle === 'reactivated' OR no toggle: both audit as _updated
      // in v0 (no _reactivated enum exists; future PR can add one for the
      // priority engine to discriminate).
      actionType = 'operations_routine_updated';
      description = activationToggle === 'reactivated'
        ? `Reactivated routine "${existing.name}"`
        : `Updated routine "${existing.name}"`;
    }

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: { type: actionType, description },
      target: {
        table: 'operations_routines',
        id: routine.id,
      },
      payload: {
        before: existing,
        after: routine,
        metadata: {
          schedule_changed: scheduleChanged,
          activation_toggle: activationToggle,
        },
      },
    });

    return NextResponse.json({ routine });
  } catch (error) {
    console.error('[Routine PATCH]', error);
    return NextResponse.json(
      { error: 'Failed to update routine', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const existing = await loadAuthorizedRoutine(id, user.id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.operations_routines.delete({ where: { id } });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_routine_deleted',
        description: `Deleted routine "${existing.name}"`,
      },
      target: {
        table: 'operations_routines',
        id: existing.id,
      },
      payload: {
        before: existing,
        metadata: {
          cascade_note: 'operations_routine_completions cascade-deleted via FK',
        },
      },
    });

    return NextResponse.json({ deleted: true, id: existing.id });
  } catch (error) {
    console.error('[Routine DELETE]', error);
    return NextResponse.json(
      { error: 'Failed to delete routine', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
