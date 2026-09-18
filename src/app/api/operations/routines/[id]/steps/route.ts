/**
 * POST /api/operations/routines/[id]/steps
 *
 * Creates an ordered sub-step on a routine. LINES-01: the step may carry its
 * own budget_amount and coa_code — the line's cost and category. user_id and entity_id are
 * inherited from the parent routine (server-derived, client values ignored).
 * step_order is server-computed as max+1 within the routine (α-1 race-
 * acceptance: concurrent creates can collide, resolvable via PATCH).
 *
 * Audits operations_routine_step_created.
 */

import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { parseTimeOrNull } from '@/lib/operations/parseTime';

function trimNullable(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * LINES-01: the line's own amount and account. Blank → null, never 0. The amount
 * is validated like the routine's (HB-4a: a non-negative decimal); the code is
 * trimmed and length-checked here and validated against the entity's chart by
 * the SAME picker the routine uses (CoaSelect), so a code never arrives typed.
 */
function parseBudgetAmountOrNull(v: unknown): { value: string | null } | { error: NextResponse } {
  if (v === undefined || v === null || v === '') return { value: null };
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { error: NextResponse.json({ error: 'Validation', field: 'budget_amount', message: 'must be a non-negative amount with at most 2 decimals' }, { status: 400 }) };
  }
  return { value: s };
}

export async function POST(
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
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'id', message: 'Invalid UUID format' },
        { status: 400 }
      );
    }

    const routine = await prisma.operations_routines.findFirst({
      where: { id, user_id: user.id },
    });
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();

    const activity = trimNullable(body.activity);
    if (!activity) {
      return NextResponse.json(
        { error: 'Validation', field: 'activity', message: 'activity is required' },
        { status: 400 }
      );
    }
    if (activity.length > 200) {
      return NextResponse.json(
        { error: 'Validation', field: 'activity', message: 'activity exceeds 200 characters' },
        { status: 400 }
      );
    }

    const subActivity = trimNullable(body.sub_activity);
    if (subActivity && subActivity.length > 200) {
      return NextResponse.json(
        { error: 'Validation', field: 'sub_activity', message: 'sub_activity exceeds 200 characters' },
        { status: 400 }
      );
    }

    const location = trimNullable(body.location);
    if (location && location.length > 200) {
      return NextResponse.json(
        { error: 'Validation', field: 'location', message: 'location exceeds 200 characters' },
        { status: 400 }
      );
    }

    const notes = trimNullable(body.notes);

    let durationMinutes: number | null = null;
    if (body.duration_minutes !== undefined && body.duration_minutes !== null && body.duration_minutes !== '') {
      const n = Number(body.duration_minutes);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json(
          { error: 'Validation', field: 'duration_minutes', message: 'must be a non-negative integer' },
          { status: 400 }
        );
      }
      durationMinutes = n;
    }

    const timeResult = parseTimeOrNull(body.time_of_day, 'time_of_day');
    if (timeResult.error) return timeResult.error;

    const amount = parseBudgetAmountOrNull(body.budget_amount);
    if ('error' in amount) return amount.error;
    const coaCode = trimNullable(body.coa_code);
    if (coaCode && coaCode.length > 50) {
      return NextResponse.json({ error: 'Validation', field: 'coa_code', message: 'coa_code exceeds 50 characters' }, { status: 400 });
    }

    // step_order = max+1 within the routine (α-1 documented race-acceptance).
    const maxOrder = await prisma.operations_routine_steps.findFirst({
      where: { routine_id: routine.id },
      orderBy: { step_order: 'desc' },
      select: { step_order: true },
    });
    const stepOrder = maxOrder ? maxOrder.step_order + 1 : 0;

    const step = await prisma.operations_routine_steps.create({
      data: {
        routine_id: routine.id,
        user_id: routine.user_id,
        entity_id: routine.entity_id,
        step_order: stepOrder,
        time_of_day: timeResult.value,
        activity,
        sub_activity: subActivity,
        location,
        duration_minutes: durationMinutes,
        notes,
        budget_amount: amount.value,
        coa_code: coaCode,
        created_by: userEmail,
      },
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'operations_routine_step_created',
        description: `Created step "${activity}" on routine "${routine.name}"`,
      },
      target: { table: 'operations_routine_steps', id: step.id },
      payload: {
        after: step,
        metadata: { routine_id: routine.id, routine_name: routine.name },
      },
    });

    return NextResponse.json({ step, isCreate: true }, { status: 201 });
  } catch (error) {
    return failClosedResponse('Routine Step POST', 'Failed to create routine step', error);
  }
}
