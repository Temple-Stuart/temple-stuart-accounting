/**
 * /api/operations/routines/[id]/completions
 *
 * POST — record a completion. Body: { expected_at, completed_at?, notes? }.
 *        If completed_at is omitted, defaults to NOW.
 *        Computes delta_minutes = (completed_at - expected_at) / 60000.
 *        Inserts completion row. Updates parent routine: last_completed_at,
 *        increments consecutive_completion_streak, zeros consecutive_miss_streak,
 *        recomputes next_due_at.
 *        Audits operations_routine_completed.
 *
 *        @@unique([routine_id, expected_at]) prevents duplicate completions
 *        for the same expected occurrence; returns 409 on retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { expandForward } from '@/lib/operations/rruleHelpers';

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

    const { id: routineId } = await params;
    const routine = await prisma.operations_routines.findFirst({
      where: { id: routineId, user_id: user.id },
    });
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();

    if (typeof body.expected_at !== 'string' || body.expected_at.length === 0) {
      return NextResponse.json(
        { error: 'Validation', field: 'expected_at', message: 'required (ISO timestamp)' },
        { status: 400 }
      );
    }
    const expectedAt = new Date(body.expected_at);
    if (Number.isNaN(expectedAt.getTime())) {
      return NextResponse.json(
        { error: 'Validation', field: 'expected_at', message: 'invalid ISO timestamp' },
        { status: 400 }
      );
    }

    const completedAt = typeof body.completed_at === 'string' && body.completed_at.length > 0
      ? new Date(body.completed_at)
      : new Date();
    if (Number.isNaN(completedAt.getTime())) {
      return NextResponse.json(
        { error: 'Validation', field: 'completed_at', message: 'invalid ISO timestamp' },
        { status: 400 }
      );
    }

    const deltaMinutes = Math.round((completedAt.getTime() - expectedAt.getTime()) / 60000);

    const notes = typeof body.notes === 'string' && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;

    // Pre-emptive uniqueness check on (routine_id, expected_at).
    const existing = await prisma.operations_routine_completions.findUnique({
      where: {
        routine_id_expected_at: {
          routine_id: routineId,
          expected_at: expectedAt,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Duplicate', message: 'a completion already exists for this expected occurrence' },
        { status: 409 }
      );
    }

    const completion = await prisma.operations_routine_completions.create({
      data: {
        routine_id: routineId,
        user_id: user.id,
        expected_at: expectedAt,
        completed_at: completedAt,
        delta_minutes: deltaMinutes,
        notes,
      },
    });

    // Recompute next_due_at: next occurrence after completedAt.
    let nextDueAt: Date | null = null;
    try {
      const upcoming = expandForward(routine.schedule_rrule, routine.timezone, completedAt, 1);
      nextDueAt = upcoming[0] ?? null;
    } catch (e) {
      console.error('[Completion POST] next_due_at recompute failed', e);
    }

    // Update parent routine: completion streak +1, miss streak → 0,
    // last_completed_at, next_due_at.
    await prisma.operations_routines.update({
      where: { id: routineId },
      data: {
        last_completed_at: completedAt,
        next_due_at: nextDueAt,
        consecutive_completion_streak: routine.consecutive_completion_streak + 1,
        consecutive_miss_streak: 0,
      },
    });

    await writeAuditLog({
      actor: {
        user_id: user.id,
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: 'operations_routine_completed',
        description: `Completed "${routine.name}" (Δ ${deltaMinutes} min)`,
      },
      target: {
        table: 'operations_routine_completions',
        id: completion.id,
      },
      payload: {
        after: completion,
        metadata: {
          routine_id: routineId,
          routine_name: routine.name,
          expected_at: expectedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          delta_minutes: deltaMinutes,
        },
      },
    });

    return NextResponse.json({ completion, isCreate: true }, { status: 201 });
  } catch (error) {
    console.error('[Completion POST]', error);
    return NextResponse.json(
      { error: 'Failed to record completion', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
