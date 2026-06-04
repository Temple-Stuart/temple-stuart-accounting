/**
 * POST /api/operations/content/enrich-routine
 *
 * Stage-1 AI enrich (OPS-CE-3). Given { routine_id }, loads the routine's
 * ACTIVE steps (CE-1 is_active filter) + the user's ACTIVE question library,
 * and asks the model to propose, PER STEP: a camera angle, shot type, b-roll
 * idea, and the best-fit question (assigned from the library by id, or proposed
 * new only when none fits).
 *
 * Truth-first: does NOT save anything. Returns the structured per-step array +
 * usage_id + cost + inspection for human review. The acceptance gate is the
 * ScenifyModal (Alex edits the suggestions, then commits via /content/scene-rows).
 *
 * Fail-loud: a routine with no active steps returns a clear 400 listing what's
 * needed — the AI is NEVER asked to fabricate steps or activities.
 *
 * PAID API — auth+tier mirror the src/app/api/ai/* reference routes
 * (e.g. market-brief / spending-insights): getVerifiedEmail → users lookup →
 * requireTier(user.tier, 'ai', user.id). (The sibling operations/ai/* routes
 * predate requireTier and omit it; this paid route adds the gate per the
 * src/app/api/ai/* pattern + the CE-3 "no shortcuts" mandate.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTier } from '@/lib/auth-helpers';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { enrichRoutineScenes } from '@/lib/ai/enrichRoutineScenes';

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Tier gate (paid AI feature) — mirrors src/app/api/ai/* routes.
    const tierGate = requireTier(user.tier, 'ai', user.id);
    if (tierGate) return tierGate;

    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.routine_id !== 'string' || !isValidUuid(body.routine_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'routine_id', message: 'routine_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    const routineId = body.routine_id;

    // Ownership (defensive 404) + ACTIVE steps only (CE-1 filter).
    const routine = await prisma.operations_routines.findFirst({
      where: { id: routineId, user_id: user.id },
      include: {
        steps: {
          where: { is_active: true },
          orderBy: { step_order: 'asc' },
        },
      },
    });
    if (!routine) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Fail-loud: never fabricate steps. Tell the caller exactly what's missing.
    if (routine.steps.length === 0) {
      return NextResponse.json(
        {
          error: 'InsufficientInput',
          field: 'steps',
          message:
            'This routine has no active steps to enrich. Add steps (each with an activity) on the Routines tab first — the AI suggests how to film and which question to ask, but it never invents the steps you do.',
        },
        { status: 400 }
      );
    }

    // Alex's ACTIVE question library (user-scoped). May be empty — the AI then
    // proposes new wording for every step, flagged proposed_new for the gate.
    const questions = await prisma.operations_content_questions.findMany({
      where: { user_id: user.id, is_active: true },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    const result = await enrichRoutineScenes({
      userId: user.id,
      userEmail,
      routineId: routine.id,
      routineName: routine.name,
      steps: routine.steps.map((s) => ({
        routine_step_id: s.id,
        step_order: s.step_order,
        activity: s.activity,
        sub_activity: s.sub_activity,
        time_of_day: s.time_of_day ? s.time_of_day.toISOString() : null,
      })),
      questions: questions.map((q) => ({
        id: q.id,
        label: q.label,
        question_text: q.question_text,
      })),
      // OPS-CE-8: Alex's available gear (free text, default iPhone). Per-call only —
      // no persistence; the gear library is the schema follow-up.
      cameras: typeof body.cameras === 'string' ? body.cameras : undefined,
    });

    return NextResponse.json({
      steps: result.steps,
      usage_id: result.usageId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      library_size: questions.length,
    });
  } catch (error) {
    console.error('[Enrich Routine POST]', error);
    return NextResponse.json(
      {
        error: 'Failed to enrich routine',
        message: error instanceof Error ? `AI scene enrichment failed: ${error.message}` : 'unknown',
      },
      { status: 500 }
    );
  }
}
