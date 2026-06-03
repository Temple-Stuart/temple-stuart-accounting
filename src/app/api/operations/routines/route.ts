/**
 * /api/operations/routines
 *
 * GET — list user's routines, optionally filtered by ?entity_id and ?is_active.
 *       No audit (read-only). Sorted by next_due_at ASC NULLS LAST then name.
 *
 * POST — create a routine. Validates structured form fields, compiles to RRULE
 *        via compileFormToRRule, stores. Computes initial next_due_at via
 *        expandForward. Audits operations_routine_created.
 *
 *        Server-side note: schedule_rrule is computed from the form, never
 *        accepted as a string from the client. This guarantees every routine
 *        in the DB has a parseable, validated RRULE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { compileFormToRRule, expandForward } from '@/lib/operations/rruleHelpers';
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

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const sp = request.nextUrl.searchParams;
    const entityId = sp.get('entity_id');
    const isActiveParam = sp.get('is_active');

    const where: Prisma.operations_routinesWhereInput = { user_id: user.id };
    if (entityId) where.entity_id = entityId;
    if (isActiveParam === 'true') where.is_active = true;
    if (isActiveParam === 'false') where.is_active = false;

    const routines = await prisma.operations_routines.findMany({
      where,
      orderBy: [
        { next_due_at: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
      include: {
        steps: {
          // OPS-CE-1: only active steps; archived (soft-deleted) steps stay in
          // the DB (with their scene-row + takes) but are hidden from the list.
          where: { is_active: true },
          orderBy: { step_order: 'asc' },
          include: { content_scene: true },
        },
        content_scene_group: true,
      },
    });

    return NextResponse.json({ routines });
  } catch (error) {
    console.error('[Routines GET]', error);
    return NextResponse.json(
      { error: 'Failed to load routines', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = (await request.json()) as Partial<RoutineForm>;

    const requireString = (v: unknown, field: string, max?: number): string | NextResponse => {
      if (typeof v !== 'string' || v.trim().length === 0) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} is required` },
          { status: 400 }
        );
      }
      const trimmed = v.trim();
      if (max && trimmed.length > max) {
        return NextResponse.json(
          { error: 'Validation', field, message: `${field} exceeds ${max} characters` },
          { status: 400 }
        );
      }
      return trimmed;
    };

    const name = requireString(body.name, 'name', 200);
    if (name instanceof NextResponse) return name;

    if (typeof body.entity_id !== 'string' || body.entity_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'entity_id', message: 'required' },
        { status: 400 }
      );
    }
    const entityId = body.entity_id.trim();

    // Verify entity belongs to user. Note: entities table uses camelCase
    // userId column (not user_id) — codebase convention precedent set by
    // src/app/api/operations/projects/route.ts.
    const entity = await prisma.entities.findFirst({
      where: { id: entityId, userId: user.id },
    });
    if (!entity) {
      return NextResponse.json(
        { error: 'Validation', field: 'entity_id', message: 'entity not found or not owned by user' },
        { status: 404 }
      );
    }

    if (typeof body.timezone !== 'string' || body.timezone.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'timezone', message: 'required' },
        { status: 400 }
      );
    }

    const startResult = parseDateOrNull(body.start_date, 'start_date');
    if (startResult.error) return startResult.error;
    const endResult = parseDateOrNull(body.end_date, 'end_date');
    if (endResult.error) return endResult.error;

    if (startResult.value && endResult.value && startResult.value > endResult.value) {
      return NextResponse.json(
        { error: 'Validation', field: 'end_date', message: 'end_date must be on or after start_date' },
        { status: 400 }
      );
    }

    const startTimeResult = parseTimeOrNull(body.start_time, 'start_time');
    if (startTimeResult.error) return startTimeResult.error;
    const endTimeResult = parseTimeOrNull(body.end_time, 'end_time');
    if (endTimeResult.error) return endTimeResult.error;

    if (
      startTimeResult.value &&
      endTimeResult.value &&
      startTimeResult.value >= endTimeResult.value
    ) {
      return NextResponse.json(
        { error: 'Validation', field: 'end_time', message: 'end_time must be after start_time' },
        { status: 400 }
      );
    }

    let schedule_rrule: string;
    try {
      schedule_rrule = compileFormToRRule(body as RoutineForm);
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

    const failThreshold = parseInt(body.fail_threshold_minutes ?? '0', 10);
    if (!Number.isInteger(failThreshold) || failThreshold < 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'fail_threshold_minutes', message: 'must be a non-negative integer' },
        { status: 400 }
      );
    }

    const description = typeof body.description === 'string' && body.description.trim().length > 0
      ? body.description.trim()
      : null;
    const idealTimeLabel = typeof body.ideal_time_label === 'string' && body.ideal_time_label.trim().length > 0
      ? body.ideal_time_label.trim()
      : null;

    // Compute initial next_due_at.
    let nextDueAt: Date | null = null;
    try {
      const upcoming = expandForward(schedule_rrule, body.timezone, new Date(), 1);
      nextDueAt = upcoming[0] ?? null;
    } catch (e) {
      console.error('[Routines POST] next_due_at compute failed', e);
    }

    // Pre-emptive uniqueness check on (user_id, name).
    const existing = await prisma.operations_routines.findFirst({
      where: { user_id: user.id, name },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Duplicate', field: 'name', message: 'a routine with this name already exists' },
        { status: 409 }
      );
    }

    const routine = await prisma.operations_routines.create({
      data: {
        user_id: user.id,
        entity_id: entityId,
        name,
        description,
        schedule_rrule,
        timezone: body.timezone,
        ideal_time_label: idealTimeLabel,
        fail_threshold_minutes: failThreshold,
        start_date: startResult.value,
        end_date: endResult.value,
        start_time: startTimeResult.value,
        end_time: endTimeResult.value,
        is_active: body.is_active !== false,
        next_due_at: nextDueAt,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_routine_created',
        description: `Created routine "${name}"`,
      },
      target: {
        table: 'operations_routines',
        id: routine.id,
      },
      payload: {
        after: routine,
        metadata: {
          entity_id: entityId,
          schedule_rrule,
          timezone: body.timezone,
        },
      },
    });

    return NextResponse.json({ routine, isCreate: true }, { status: 201 });
  } catch (error) {
    console.error('[Routines POST]', error);
    return NextResponse.json(
      { error: 'Failed to create routine', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
