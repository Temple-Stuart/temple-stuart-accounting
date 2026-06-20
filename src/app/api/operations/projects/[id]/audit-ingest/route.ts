/**
 * POST /api/operations/projects/[id]/audit-ingest  (PHASE3-3)
 *
 * The token-guarded callback the Claude Code audit Routine hits with its findings.
 * The Routine (fired by PHASE3-2's fireAuditRoutine) runs the read-only codebase
 * audit, then POSTs its findings here → this writes them to the project's
 * claude_code_audit_input (the same column the manual paste-PATCH writes) and emits
 * `operations/audit.ingested` so PHASE3-5's waitForEvent can resume the pipe.
 *
 * SECURITY — this is a NEW INBOUND auth surface (an external service writes through
 * it). The Routine has NO user cookie, so this route is NOT cookie-authed. The
 * SHARED-SECRET BEARER (AUDIT_INGEST_SECRET) is the ENTIRE auth boundary — validated
 * FIRST, before any DB work (the proven CRON_SECRET pattern). It is NOT an open
 * write: a missing/wrong token → 401 immediately. Defensive checks: the body's
 * project_id must match the [id] param, and a correlationId must be present (the
 * right project, the right run). The findings are stored, never executed (treated as
 * untrusted text per CLAUDE.md). Fail loud — 401/400/404/500, never a silent write.
 *
 * Middleware lets this path through WITHOUT a cookie (it's token-gated here, not
 * cookie-gated) — see the explicit /audit-ingest exception in middleware.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/inngest/client';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

interface IngestBody {
  correlationId?: unknown;
  project_id?: unknown;
  findings?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── 1 · TOKEN GATE FIRST — the entire auth boundary, before any DB work ──
    const secret = process.env.AUDIT_INGEST_SECRET;
    if (!secret) {
      console.error('AUDIT_INGEST_SECRET not configured');
      return NextResponse.json({ error: 'Audit ingest not configured' }, { status: 500 });
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
    const findings = typeof body?.findings === 'string' ? body.findings.trim() : '';

    if (!correlationId) {
      return NextResponse.json({ error: 'Validation', message: 'correlationId is required' }, { status: 400 });
    }
    if (bodyProjectId !== projectId) {
      // Defensive: the findings must be for THIS project (right project, right run).
      return NextResponse.json({ error: 'Validation', message: 'project_id does not match the route id' }, { status: 400 });
    }
    if (!findings) {
      return NextResponse.json({ error: 'Validation', message: 'findings is required (non-empty)' }, { status: 400 });
    }

    // ── 3 · Load the project by id. NOT user-scoped (no cookie) — the token is the
    //         authority; the project_id match above is the defensive check. ──
    const project = await prisma.operations_projects.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // ── 4 · Write the audit findings to the same column the manual PATCH writes ──
    await prisma.operations_projects.update({
      where: { id: projectId },
      data: { claude_code_audit_input: findings },
    });

    await writeAuditLog({
      actor: { user_id: project.user_id, email: null, type: 'external_integration' },
      action: {
        type: 'operations_project_updated',
        description: `Claude Code audit Routine ingested findings into claude_code_audit_input (correlation ${correlationId})`,
      },
      target: { table: 'operations_projects', id: projectId },
      payload: {
        before: null,
        after: { claude_code_audit_input_chars: findings.length },
        metadata: { correlation_id: correlationId, source: 'audit_routine_callback' },
      },
    });

    // ── 5 · Emit the resume event so PHASE3-5's waitForEvent can continue the pipe ──
    await inngest.send({
      name: 'operations/audit.ingested',
      data: { projectId, correlationId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Audit Ingest POST]', error);
    return NextResponse.json(
      { error: 'Failed to ingest audit', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
