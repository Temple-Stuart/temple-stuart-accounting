/**
 * fireAuditRoutine (PHASE3-2) — the app's FIRST outbound automation-API call.
 *
 * Fires the Claude Code "audit" Routine for a project: it POSTs the project's
 * goals + research (assembled by buildAuditPrompt — the same institutional audit
 * text the manual flow copies into Claude Code) to the Routines /fire endpoint.
 * The Routine runs the read-only audit on the repo and (in PHASE3-3) POSTs its
 * findings back to a token-guarded callback that writes claude_code_audit_input.
 *
 * This returns only a SESSION POINTER ({ sessionId, sessionUrl, correlationId }) —
 * NOT the findings (those arrive async). The correlationId travels in the payload
 * so PHASE3-3's callback can match the returned findings to THIS project + run.
 *
 * SECURITY / COST (per CLAUDE.md):
 *   - requireRoutineBudget(userId) gates FIRST — over the daily Routine cap throws
 *     RoutineBudgetError and NO fire happens (the cost gate before the paid call;
 *     Routine runs are a SEPARATE Anthropic meter from the pipe's API calls).
 *   - The project is loaded ownership-scoped ({ id, user_id }); not found → throw.
 *   - The token is read from env (ROUTINE_AUDIT_TOKEN), never hardcoded, never
 *     logged (the Authorization header is never echoed into errors).
 *   - FAIL LOUD — missing env, non-2xx, or an unparseable response all throw with a
 *     clear message. No silent fallback, no fake session, no fabricated findings.
 *
 * NOT yet wired into the pipe — PHASE3-4 calls this from operations-pipe-run.
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRoutineBudget } from '@/lib/routineFireBudget';
import { buildAuditPrompt } from '@/lib/ai/buildAuditPrompt';

/** Resolve a field's items: prefer the JSONB array, fall back to the legacy
 *  paragraph. Returns [] if neither has content. (Mirrors research/route.ts.) */
function resolveItems(itemsJson: unknown, legacyText: string | null): string[] {
  if (Array.isArray(itemsJson)) {
    const arr = itemsJson.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (arr.length > 0) return arr;
  }
  const legacy = (legacyText ?? '').trim();
  return legacy.length > 0 ? [legacy] : [];
}

export interface FireAuditRoutineInput {
  projectId: string;
  userId: string;
  userEmail: string;
}

export interface FireAuditRoutineResult {
  claudeCodeSessionId: string;
  claudeCodeSessionUrl: string;
  /** Echoed in the payload so PHASE3-3's callback can match findings → this run. */
  correlationId: string;
}

export async function fireAuditRoutine(input: FireAuditRoutineInput): Promise<FireAuditRoutineResult> {
  const { projectId, userId, userEmail } = input;

  // 1 · COST GATE FIRST — over the daily Routine cap → RoutineBudgetError, no fire.
  await requireRoutineBudget(userId);

  // 2 · Config — fail loud if the Routine endpoint/token aren't set (server-only env).
  const fireUrl = process.env.ROUTINE_AUDIT_FIRE_URL;
  const token = process.env.ROUTINE_AUDIT_TOKEN;
  if (!fireUrl || !token) {
    throw new Error('ROUTINE_AUDIT_FIRE_URL / ROUTINE_AUDIT_TOKEN not set — cannot fire the audit Routine');
  }

  // 3 · Load the project ownership-scoped (defensive — never another user's project).
  const project = await prisma.operations_projects.findFirst({
    where: { id: projectId, user_id: userId },
  });
  if (!project) {
    throw new Error(`project ${projectId} not found for user ${userId} — cannot fire audit Routine`);
  }

  // 4 · Build the audit payload text — REUSE buildAuditPrompt (project goals +
  //     research = the standard to audit against). A correlation trailer carries the
  //     project + run id so PHASE3-3's findings callback can match this fire.
  const goalItems = resolveItems(project.goal_items, project.goal);
  const correlationId = randomUUID();
  const auditText = buildAuditPrompt({
    projectTitle: project.title,
    goalItems,
    deepResearchInput: project.deep_research_input,
  });
  const text =
    `${auditText}\n\n` +
    `---\nWhen reporting findings back, include this exact correlation block so they can be matched:\n` +
    `correlation_id: ${correlationId}\nproject_id: ${projectId}`;

  // 5 · POST to the Routines /fire endpoint (the verified shape).
  const res = await fetch(fireUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  // 6 · FAIL LOUD on non-2xx — surface status + body, NEVER the token/headers.
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable body>');
    throw new Error(`audit Routine fire failed (${res.status}): ${body.slice(0, 500)}`);
  }

  // 7 · Parse the session pointer — fail loud if the expected fields are absent.
  const json = (await res.json().catch(() => null)) as
    | { type?: string; claude_code_session_id?: string; claude_code_session_url?: string }
    | null;
  const sessionId = json?.claude_code_session_id;
  const sessionUrl = json?.claude_code_session_url;
  if (!sessionId || !sessionUrl) {
    throw new Error('audit Routine fire returned no session pointer (claude_code_session_id/url missing)');
  }

  // userEmail is accepted for caller symmetry + future audit-log attribution (PHASE3-4).
  void userEmail;

  return {
    claudeCodeSessionId: sessionId,
    claudeCodeSessionUrl: sessionUrl,
    correlationId,
  };
}
