/**
 * /api/operations/projects/[id]/run-pipe  (PHASE2-2)
 *
 * POST — the user-initiated TRIGGER for the auto-fire pipe. Fires the
 *        `operations/pipe.run` Inngest event for this project; the
 *        `operations-pipe-run` function (PHASE2-3) consumes it and runs
 *        research → fusion → land-pending asynchronously.
 *
 * This route does NOT run the pipe inline and makes NO paid call. It only
 * auths, ownership-scopes, and sends the event. The cost guard
 * (requirePipeBudget) applies INSIDE the Inngest job, before each paid step —
 * not here.
 *
 * SECURITY:
 *   - Auth is FIRST — getVerifiedEmail + project ownership scoping — before the
 *     event is sent (mirrors research/route.ts). Cross-user → defensive 404.
 *   - /api/inngest is signature-validated (INNGEST_SIGNING_KEY); the event the
 *     job trusts is emitted only here, after the user is authed + scoped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { inngest } from '@/inngest/client';

/** Resolve a field's items: prefer the JSONB array, fall back to the legacy
 *  paragraph. Returns null if neither has content. (Mirrors research/route.ts.) */
function resolveItems(itemsJson: unknown, legacyText: string | null): string[] | null {
  if (Array.isArray(itemsJson)) {
    const arr = itemsJson.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (arr.length > 0) return arr;
  }
  const legacy = (legacyText ?? '').trim();
  if (legacy.length > 0) return [legacy];
  return null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── AUTH FIRST — before the event is sent ─────────────────────────────────
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id: projectId } = await params;
    const project = await prisma.operations_projects.findFirst({
      where: { id: projectId, user_id: user.id }, // ownership scope
    });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 }); // defensive 404

    // Runnable check: the pipe's research stage requires ≥1 goal item
    // (mirrors research/route.ts). Fail loud here rather than queue a doomed job.
    const goalItems = resolveItems(project.goal_items, project.goal);
    if (!goalItems) {
      return NextResponse.json(
        { error: 'Validation', message: 'project must have at least one goal item before running the pipe' },
        { status: 400 }
      );
    }

    // Fire the orchestration event. NO paid call here — the cost guard runs in the
    // job (PHASE2-3). Sending an event with no consumer yet is harmless (the
    // operations-pipe-run function is added in PHASE2-3).
    await inngest.send({
      name: 'operations/pipe.run',
      data: { projectId, userId: user.id },
    });

    return NextResponse.json(
      { ok: true, message: 'pipe run queued' },
      { status: 202 }
    );
  } catch (error) {
    console.error('[Project Run-Pipe POST]', error);
    return NextResponse.json(
      {
        error: 'Failed to queue pipe run',
        message: error instanceof Error ? error.message : 'unknown',
      },
      { status: 500 }
    );
  }
}
