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
 *
 * ONEOFF-01: start_date is the ANCHOR every expansion is built on, so patching
 * it recomputes next_due_at; a one-off (COUNT=1) must keep a date and ends on
 * it; the routine's place (location + coordinate pair) is patchable, the pair
 * all-or-nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { compileFormToRRule, expandForward, isOnceRRule, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { parsePlaceInput } from '@/lib/operations/routineInput';
import type { RoutineForm } from '@/components/workbench/operations/routines/types';
import { parseTimeOrNull } from '@/lib/operations/parseTime';

/**
 * Parse an optional YYYY-MM-DD date-bound value. Empty/null/undefined → null
 * (unset). Returns a 400 NextResponse in `error` on malformed input.
 */
function parseDateOrNull(
  v: unknown,
  field: string
): { value: Date | null; error: NextResponse | null } {
  if (v === null || v === undefined || v === '') return { value: null, error: null };
  if (typeof v !== 'string') {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'must be string YYYY-MM-DD or null' },
        { status: 400 }
      ),
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'must match YYYY-MM-DD' },
        { status: 400 }
      ),
    };
  }
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return {
      value: null,
      error: NextResponse.json(
        { error: 'Validation', field, message: 'invalid date' },
        { status: 400 }
      ),
    };
  }
  return { value: d, error: null };
}

async function loadAuthorizedRoutine(routineId: string, userId: string) {
  return prisma.operations_routines.findFirst({
    where: { id: routineId, user_id: userId },
    include: {
      steps: {
        // OPS-CE-1: only active steps; archived (soft-deleted) steps are hidden
        // from the routine view while their scene-row + takes stay in the DB.
        where: { is_active: true },
        orderBy: { step_order: 'asc' },
        include: { content_scene: true },
      },
      content_scene_group: true,
    },
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
    return failClosedResponse('Routine GET', 'Failed to load routine', error);
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

    // HB-4a: per-occurrence budget. Absent key → untouched; empty/null → clear to null (no budget,
    // never 0); present-but-invalid → fail loud (400), never coerced.
    if (body.budget_amount !== undefined) {
      if (body.budget_amount === null || String(body.budget_amount).trim() === '') {
        data.budget_amount = null;
      } else {
        const n = Number(body.budget_amount);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json(
            { error: 'Validation', field: 'budget_amount', message: 'must be a non-negative number' },
            { status: 400 }
          );
        }
        data.budget_amount = n;
      }
    }

    // HB-4a: COA code (soft string ref). Empty → null (no default COA, no coercion).
    if (body.coa_code !== undefined) {
      data.coa_code = typeof body.coa_code === 'string' && body.coa_code.trim().length > 0
        ? body.coa_code.trim()
        : null;
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

    let activationToggle: 'deactivated' | 'reactivated' | null = null;
    if (body.is_active !== undefined) {
      const incoming = Boolean(body.is_active);
      if (incoming !== existing.is_active) {
        activationToggle = incoming ? 'reactivated' : 'deactivated';
      }
      data.is_active = incoming;
    }

    // Date bounds: validate against the effective (post-patch) values so a
    // single-sided patch is checked against the stored counterpart.
    // ONEOFF-01: read BEFORE the cadence compile, because start_date is the
    // anchor every expansion is built on and the date a one-off is counted from.
    let effectiveStart = existing.start_date;
    let effectiveEnd = existing.end_date;
    if ('start_date' in body) {
      const r = parseDateOrNull(body.start_date, 'start_date');
      if (r.error) return r.error;
      effectiveStart = r.value;
      data.start_date = r.value;
      // The anchor moved, so every occurrence may have — recompute next_due_at.
      scheduleChanged = true;
    }
    if ('end_date' in body) {
      const r = parseDateOrNull(body.end_date, 'end_date');
      if (r.error) return r.error;
      effectiveEnd = r.value;
      data.end_date = r.value;
    }
    if (effectiveStart && effectiveEnd && effectiveStart > effectiveEnd) {
      return NextResponse.json(
        { error: 'Validation', field: 'end_date', message: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }
    const effectiveStartStr = effectiveStart ? effectiveStart.toISOString().slice(0, 10) : '';

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
        // ONEOFF-01: the compile sees the EFFECTIVE start_date, so a one-off
        // patched without re-sending its date still has one.
        const compiled = compileFormToRRule({ ...body, start_date: effectiveStartStr } as RoutineForm);
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

    // ONEOFF-01: a one-off (COUNT=1) — whether it just became one or already was —
    // needs its date and ends on it. The window IS the day.
    const nextRrule = (data.schedule_rrule as string | undefined) ?? existing.schedule_rrule;
    if (isOnceRRule(nextRrule)) {
      if (!effectiveStart) {
        return NextResponse.json(
          { error: 'Validation', field: 'start_date', message: 'a one-off needs its date — it cannot be cleared while the cadence is once' },
          { status: 400 }
        );
      }
      if (effectiveEnd && effectiveEnd.getTime() !== effectiveStart.getTime()) {
        return NextResponse.json(
          { error: 'Validation', field: 'end_date', message: 'a one-off ends on the day it happens — leave end_date empty or equal to start_date' },
          { status: 400 }
        );
      }
      data.end_date = effectiveStart;
    }

    // ONEOFF-01: the place. Any of the three sent → the effective triple is
    // validated whole (the pair is all-or-nothing) and all three are written.
    if ('location' in body || 'latitude' in body || 'longitude' in body) {
      const place = parsePlaceInput({
        location: 'location' in body ? body.location : existing.location,
        latitude: 'latitude' in body ? body.latitude : existing.latitude != null ? Number(existing.latitude) : null,
        longitude: 'longitude' in body ? body.longitude : existing.longitude != null ? Number(existing.longitude) : null,
      });
      if ('error' in place) return NextResponse.json({ error: 'Validation', ...place.error }, { status: 400 });
      data.location = place.value.location;
      data.latitude = place.value.latitude;
      data.longitude = place.value.longitude;
    }

    // Time window: validate against effective (post-patch) values.
    let effectiveStartTime = existing.start_time;
    let effectiveEndTime = existing.end_time;
    if ('start_time' in body) {
      const r = parseTimeOrNull(body.start_time, 'start_time');
      if (r.error) return r.error;
      effectiveStartTime = r.value;
      data.start_time = r.value;
    }
    if ('end_time' in body) {
      const r = parseTimeOrNull(body.end_time, 'end_time');
      if (r.error) return r.error;
      effectiveEndTime = r.value;
      data.end_time = r.value;
    }
    if (effectiveStartTime && effectiveEndTime && effectiveStartTime >= effectiveEndTime) {
      return NextResponse.json(
        { error: 'Validation', field: 'end_time', message: 'end_time must be after start_time' },
        { status: 400 }
      );
    }

    // If cadence/timezone/anchor changed, recompute next_due_at — anchored on
    // the effective start_date (ONEOFF-01: the one mechanism).
    if (scheduleChanged) {
      const nextTz = (data.timezone as string | undefined) ?? existing.timezone;
      try {
        const upcoming = expandForward(nextRrule, nextTz, new Date(), 1, scheduleAnchor(effectiveStart));
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
    return failClosedResponse('Routine PATCH', 'Failed to update routine', error);
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
    return failClosedResponse('Routine DELETE', 'Failed to delete routine', error);
  }
}
