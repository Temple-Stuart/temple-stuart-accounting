/**
 * POST /api/operations/content/generate-script  { piece_id }
 *
 * Stage 3 (OPS-CE-5): generate the reel VOICEOVER for a day from the answers Alex
 * logged + the day's real task record. Loads the piece's day CROSS-ENTITY (CE-8):
 *   - answered scenes  = operations_content_takes for the piece (script = the answer)
 *                        joined to their scene-row (narrative/b-roll/question) +
 *                        routine_step (activity/time/order), ordered by the shared
 *                        dayOrder comparator (midnight wraps to day-end).
 *   - the day's tasks  = operations_daily_plan_items for piece_date (+ calendar_blocks,
 *                        task) — planned + committed + DONE (planned vs actual).
 *
 * Truth-first / FAIL-LOUD: a day with ZERO answers returns 400 listing exactly what's
 * missing — never generate from nothing. Does NOT save (human gate): returns the
 * script + usage_id; the immutable reasoning is the operations_ai_usage row recordUsage
 * wrote.
 *
 * PAID API — auth + tier mirror the enrich route: getVerifiedEmail → users lookup →
 * requireTier(user.tier, 'ai', user.id).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTier } from '@/lib/auth-helpers';
import { isValidUuid } from '@/lib/operations/parseUuid';
import {
  compareDayOrder,
  minuteOfDayFromInstant,
  minuteOfDayFromTime,
} from '@/lib/content/dayOrder';
import {
  generateReelScript,
  type ScriptSceneInput,
  type ScriptTaskInput,
} from '@/lib/ai/generateReelScript';

const hhmm = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const tierGate = requireTier(user.tier, 'ai', user.id);
    if (tierGate) return tierGate;

    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.piece_id !== 'string' || !isValidUuid(body.piece_id)) {
      return NextResponse.json(
        { error: 'Validation', field: 'piece_id', message: 'piece_id is required and must be a valid UUID' },
        { status: 400 }
      );
    }

    // Ownership (defensive 404).
    const piece = await prisma.operations_content_pieces.findFirst({
      where: { id: body.piece_id, user_id: user.id },
    });
    if (!piece) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const dayKey = piece.piece_date.toISOString().slice(0, 10);

    // Answered scenes: the piece's take-cells with a non-empty script, joined to the
    // scene-row + its step. (Cross-entity: a take may join a scene of any entity.)
    const takes = await prisma.operations_content_takes.findMany({
      where: { piece_id: piece.id, user_id: user.id },
      include: {
        scene: {
          include: {
            routine_step: { select: { activity: true, time_of_day: true, step_order: true } },
          },
        },
      },
    });

    const answered = takes
      .filter((t) => (t.script ?? '').trim().length > 0 && t.scene)
      .map((t) => {
        const s = t.scene;
        const step = s.routine_step;
        return {
          minute: minuteOfDayFromTime(step?.time_of_day ? step.time_of_day.toISOString() : null),
          order: step?.step_order ?? 0,
          activity: step?.activity ?? 'scene',
          time: step?.time_of_day ? step.time_of_day.toISOString().slice(11, 16) : null,
          narrative: s.narrative_purpose,
          b_roll: s.b_roll,
          question: s.assigned_question_text,
          answer: (t.script ?? '').trim(),
        };
      })
      .sort((a, b) =>
        compareDayOrder({ minute: a.minute, order: a.order, kind: 'scene' }, { minute: b.minute, order: b.order, kind: 'scene' })
      );

    // FAIL-LOUD: never generate from nothing.
    if (answered.length === 0) {
      return NextResponse.json(
        {
          error: 'InsufficientInput',
          field: 'answers',
          message:
            'This day has no answers yet. Answer the scenes for this day (the Question → Answer cells) before generating the script — the reel is built only from what you actually logged.',
        },
        { status: 400 }
      );
    }

    const scenes: ScriptSceneInput[] = answered.map((a, i) => ({
      scene_number: i + 1,
      activity: a.activity,
      time: a.time,
      narrative: a.narrative,
      b_roll: a.b_roll,
      question: a.question,
      answer: a.answer,
    }));

    // The day's task record (cross-entity), ordered by the same comparator.
    const items = await prisma.operations_daily_plan_items.findMany({
      where: { user_id: user.id, plan_date: piece.piece_date },
      include: {
        calendar_blocks: { orderBy: { scheduled_start: 'asc' } },
        task: { select: { title: true, project_id: true } },
      },
    });
    const projectIds = Array.from(
      new Set(items.map((it) => it.task?.project_id).filter((x): x is string => !!x))
    );
    const projects = projectIds.length
      ? await prisma.operations_projects.findMany({
          where: { id: { in: projectIds }, user_id: user.id },
          select: { id: true, title: true },
        })
      : [];
    const projectName = new Map(projects.map((p) => [p.id, p.title]));

    const taskRows: { minute: number; row: ScriptTaskInput }[] = [];
    let plannedSeq = 100000;
    for (const it of items) {
      const title = it.task?.title ?? it.ad_hoc_title ?? 'Untitled';
      const project = it.task?.project_id ? projectName.get(it.task.project_id) ?? null : null;
      if (it.calendar_blocks.length === 0) {
        taskRows.push({
          minute: plannedSeq++,
          row: { title, project, status: 'planned', planned: true, scheduled: null, actual: null },
        });
        continue;
      }
      for (const b of it.calendar_blocks) {
        const scheduled = `${hhmm(b.scheduled_start.toISOString())}–${hhmm(b.scheduled_end.toISOString())}`;
        const actual =
          b.actual_start && b.actual_end
            ? `${hhmm(b.actual_start.toISOString())}–${hhmm(b.actual_end.toISOString())}`
            : null;
        taskRows.push({
          minute: minuteOfDayFromInstant((b.actual_start ?? b.scheduled_start).toISOString()),
          row: { title, project, status: b.status, planned: false, scheduled, actual },
        });
      }
    }
    taskRows.sort((a, b) => a.minute - b.minute);
    const tasks = taskRows.map((t) => t.row);

    const result = await generateReelScript({
      userId: user.id,
      userEmail,
      pieceId: piece.id,
      dateLabel: dayKey,
      scenes,
      tasks,
    });

    return NextResponse.json({
      script: result.script,
      usage_id: result.usageId,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      scenes_used: scenes.length,
      tasks_used: tasks.length,
    });
  } catch (error) {
    console.error('[Generate Script POST]', error);
    return NextResponse.json(
      {
        error: 'Failed to generate script',
        message: error instanceof Error ? `AI voiceover generation failed: ${error.message}` : 'unknown',
      },
      { status: 500 }
    );
  }
}
