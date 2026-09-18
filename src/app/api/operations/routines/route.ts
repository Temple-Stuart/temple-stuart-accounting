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
 *
 *        ONEOFF-01 — a one-off is a routine that happens once, authored here
 *        like everything else. Cadence 'once' compiles to FREQ=DAILY;COUNT=1,
 *        anchored on the routine's start_date (rruleHelpers.ts scheduleAnchor),
 *        so it expands to exactly one occurrence through the same expansion as
 *        every other cadence. Its window is that day (end_date = start_date).
 *        The routine may be created WITH its lines (LINES-01 steps — activity,
 *        amount, account each) and WITH its place (location + a coordinate
 *        pair, found through GEO-01's one-press lookup, now on Tasks), all in
 *        one transaction. Nothing is defaulted: a blank amount is null, half a
 *        coordinate pair is refused, and a one-off with no date is refused.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { compileFormToRRule, expandForward, isOnceRRule, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { parseLinesInput, parsePlaceInput } from '@/lib/operations/routineInput';
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
    return failClosedResponse('Routines GET', 'Failed to load routines', error);
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

    // ONEOFF-01: a one-off is one occurrence on its date, and its active window
    // IS that day. The compile already refused a once without a start_date; the
    // end date, if sent, must be the same day — and is stored as that day.
    const once = isOnceRRule(schedule_rrule);
    let endDate = endResult.value;
    if (once) {
      if (!startResult.value) {
        return NextResponse.json(
          { error: 'Validation', field: 'start_date', message: 'a one-off needs its date' },
          { status: 400 }
        );
      }
      if (endResult.value && endResult.value.getTime() !== startResult.value.getTime()) {
        return NextResponse.json(
          { error: 'Validation', field: 'end_date', message: 'a one-off ends on the day it happens — leave end_date empty or equal to start_date' },
          { status: 400 }
        );
      }
      endDate = startResult.value;
    }

    // ONEOFF-01: the routine's place. Location text saves on its own; the
    // coordinate pair is all-or-nothing and in range (routineInput.ts).
    const place = parsePlaceInput({ location: body.location, latitude: body.latitude, longitude: body.longitude });
    if ('error' in place) {
      return NextResponse.json({ error: 'Validation', ...place.error }, { status: 400 });
    }

    // ONEOFF-01: the lines the routine is created with — each an activity with
    // its own amount and account, validated by the one leaf the step writers use.
    const lines = parseLinesInput(body.lines);
    if ('error' in lines) {
      return NextResponse.json({ error: 'Validation', ...lines.error }, { status: 400 });
    }
    if (once && lines.value.length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'lines', message: 'a one-off is made of lines — give it at least one, the thing itself, with or without an amount' },
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

    // HB-4a: per-occurrence budget + COA (both optional). NO FALLBACK — absent/empty → null (a
    // routine genuinely has no budget, never 0); a present-but-invalid amount fails loud (400),
    // never coerced. budget_amount is a Decimal(12,2) money column; coa_code is a soft string ref.
    let budgetAmount: number | null = null;
    if (body.budget_amount != null && String(body.budget_amount).trim() !== '') {
      const n = Number(body.budget_amount);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'budget_amount', message: 'must be a non-negative number' },
          { status: 400 }
        );
      }
      budgetAmount = n;
    }
    const coaCode = typeof body.coa_code === 'string' && body.coa_code.trim().length > 0
      ? body.coa_code.trim()
      : null;

    // Compute initial next_due_at. ONEOFF-01: anchored on the routine's
    // start_date, the one mechanism every expansion of it shares.
    let nextDueAt: Date | null = null;
    try {
      const upcoming = expandForward(schedule_rrule, body.timezone, new Date(), 1, scheduleAnchor(startResult.value));
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

    // ONEOFF-01: the routine and its lines land together or not at all.
    const routine = await prisma.$transaction(async (tx) => {
      const created = await tx.operations_routines.create({
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
          end_date: endDate,
          start_time: startTimeResult.value,
          end_time: endTimeResult.value,
          is_active: body.is_active !== false,
          next_due_at: nextDueAt,
          // HB-4a: nullable money fields — null when unset (no fake 0 / no default COA).
          budget_amount: budgetAmount,
          coa_code: coaCode,
          // ONEOFF-01: the place, or nulls. Never 0,0.
          location: place.value.location,
          latitude: place.value.latitude,
          longitude: place.value.longitude,
          created_by: userEmail,
        },
      });
      if (lines.value.length > 0) {
        await tx.operations_routine_steps.createMany({
          data: lines.value.map((l, i) => ({
            routine_id: created.id,
            user_id: user.id,
            entity_id: entityId,
            step_order: i,
            activity: l.activity,
            budget_amount: l.budget_amount,
            coa_code: l.coa_code,
            created_by: userEmail,
          })),
        });
      }
      return created;
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
          // ONEOFF-01: what was authored with it.
          once,
          lines: lines.value.length,
        },
      },
    });

    return NextResponse.json({ routine, lines: lines.value.length, isCreate: true }, { status: 201 });
  } catch (error) {
    return failClosedResponse('Routines POST', 'Failed to create routine', error);
  }
}
