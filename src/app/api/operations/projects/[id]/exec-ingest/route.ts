/**
 * POST /api/operations/projects/[id]/exec-ingest  (EXEC-1)
 *
 * The token-guarded callback the Claude Code "Execute Task" Routine hits with its
 * result. The Routine (fired by EXEC-1's fireExecutionRoutine) builds the task on a
 * claude/ branch and opens a PR, then POSTs the PR url + status back here → this
 * writes pr_url + exec_status onto the task (bound by the stored exec_correlation_id)
 * and emits `operations/exec.ingested` (for a future EXEC-3 serial queue to resume on).
 *
 * Mirrors audit-ingest. SECURITY — a NEW INBOUND auth surface (an external service
 * writes through it). The Routine has NO user cookie, so this route is NOT
 * cookie-authed. The SHARED-SECRET BEARER (EXEC_INGEST_SECRET) is the ENTIRE auth
 * boundary — validated FIRST, before any DB work (the proven CRON_SECRET pattern).
 * Not an open write: a missing/wrong token → 401 immediately. Defensive: the body's
 * project_id must match the [id] param, and the posted correlationId must match a
 * task's stored exec_correlation_id (binds the result to the real fire → 403 else).
 * The PR url + status are stored, never executed. Fail loud — 401/400/403/404/500.
 *
 * Middleware lets this path through WITHOUT a cookie — see the explicit /exec-ingest
 * exception in middleware.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/inngest/client';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

interface IngestBody {
  correlationId?: unknown;
  project_id?: unknown;
  pr_url?: unknown;
  status?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1 · TOKEN GATE FIRST — the entire auth boundary, before any DB work ──
    const secret = process.env.EXEC_INGEST_SECRET;
    if (!secret) {
      console.error('EXEC_INGEST_SECRET not configured');
      return NextResponse.json({ error: 'Exec ingest not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2 · Validate the body + the defensive project_id / correlationId checks ──
    const { id: projectId } = await params;
    const body = (await request.json().catch(() => null)) as IngestBody | null;
    const correlationId = typeof body?.correlationId === 'string' ? body.correlationId.trim() : '';
    const bodyProjectId = typeof body?.project_id === 'string' ? body.project_id.trim() : '';
    const status = typeof body?.status === 'string' ? body.status.trim() : '';
    // pr_url is written-if-present: a successful exec reports a PR; a failed exec may
    // report status='failed' with no PR. We never fabricate one — store what's given.
    const prUrl = typeof body?.pr_url === 'string' && body.pr_url.trim().length > 0 ? body.pr_url.trim() : null;

    if (!correlationId) {
      return NextResponse.json({ error: 'Validation', message: 'correlationId is required' }, { status: 400 });
    }
    if (bodyProjectId !== projectId) {
      return NextResponse.json({ error: 'Validation', message: 'project_id does not match the route id' }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: 'Validation', message: 'status is required' }, { status: 400 });
    }

    // ── 3 · Stored-match: find the task BY the posted correlationId within this
    //         project. The token is the authority; the correlationId binds the result
    //         to the exact fire (EXEC-2 persists exec_correlation_id when it fires).
    //         No matching task → no recorded fire → 403. ──
    const task = await prisma.operations_project_tasks.findFirst({
      where: { exec_correlation_id: correlationId, project_id: projectId },
    });
    if (!task) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'correlationId does not match any recorded execution fire for this project' },
        { status: 403 }
      );
    }

    // ── 4 · Write the PR url + status onto the task ──
    await prisma.operations_project_tasks.update({
      where: { id: task.id },
      data: { pr_url: prUrl, exec_status: status },
    });

    await writeAuditLog({
      actor: { user_id: task.user_id, email: null, type: 'external_integration' },
      action: {
        type: 'operations_project_task_updated',
        description: `Execute-Task Routine reported exec result (status="${status}") for task "${task.title}" (correlation ${correlationId})`,
      },
      target: { table: 'operations_project_tasks', id: task.id },
      payload: {
        before: null,
        after: { pr_url: prUrl, exec_status: status },
        metadata: { correlation_id: correlationId, project_id: projectId, source: 'exec_routine_callback' },
      },
    });

    // ── 5 · Emit the resume event (for a future EXEC-3 serial queue to wait on) ──
    await inngest.send({
      name: 'operations/exec.ingested',
      data: { projectId, taskId: task.id, correlationId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Exec Ingest POST]', error);
    return NextResponse.json(
      { error: 'Failed to ingest exec result', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
