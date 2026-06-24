/**
 * fireExecutionRoutine (EXEC-1) — fires the Claude Code "Execute Task" Routine.
 *
 * Mirrors fireAuditRoutine, pointed at BUILD + PR: it POSTs a single task's
 * what / how / why-and-correctness-test to the Execute-Task Routine's /fire
 * endpoint. The Routine builds the change on a claude/ branch and opens a PR, then
 * (in EXEC-1's exec-ingest callback) POSTs the PR url back. The task's fields ARE
 * the what/why/test: title = the WHAT (the single change), description = how to do
 * it, notes = the WHY + the CORRECTNESS test (per the fusion output contract) —
 * operations_project_tasks has no separate columns.
 *
 * Returns only a SESSION POINTER ({ sessionId, sessionUrl, correlationId }) — NOT the
 * PR (that arrives async). The correlationId travels in the payload so the
 * exec-ingest callback can match the PR → this task + run (EXEC-2 persists it to
 * exec_correlation_id for the stored-match).
 *
 * SECURITY / COST (per CLAUDE.md):
 *   - requireExecBudget(userId) gates FIRST — over the daily exec cap throws
 *     ExecBudgetError and NO fire happens (a SEPARATE Anthropic meter from the pipe
 *     and the audit Routine).
 *   - The task is loaded ownership-scoped ({ id, project_id, user_id }); not found → throw.
 *   - The token is read from env (EXEC_ROUTINE_TOKEN), never hardcoded, never logged.
 *   - FAIL LOUD — missing env, non-2xx, or an unparseable response all throw. No
 *     silent fallback, no fake session, no fabricated PR.
 *
 * NOT yet wired to accept → EXEC-2 calls this when a pending task is accepted.
 */

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireExecBudget } from '@/lib/execFireBudget';

export interface FireExecutionRoutineInput {
  taskId: string;
  projectId: string;
  userId: string;
  userEmail: string;
}

export interface FireExecutionRoutineResult {
  claudeCodeSessionId: string;
  claudeCodeSessionUrl: string;
  /** Echoed in the payload so the exec-ingest callback can match the PR → this run. */
  correlationId: string;
}

export async function fireExecutionRoutine(input: FireExecutionRoutineInput): Promise<FireExecutionRoutineResult> {
  const { taskId, projectId, userId, userEmail } = input;

  // 1 · Config — fail loud if the Routine endpoint/token aren't set (server-only env).
  const fireUrl = process.env.EXEC_ROUTINE_FIRE_URL;
  const token = process.env.EXEC_ROUTINE_TOKEN;
  if (!fireUrl || !token) {
    throw new Error('EXEC_ROUTINE_FIRE_URL / EXEC_ROUTINE_TOKEN not set — cannot fire the execution Routine');
  }

  // 2 · Load the task ownership-scoped (defensive — never another user's task).
  const task = await prisma.operations_project_tasks.findFirst({
    where: { id: taskId, project_id: projectId, user_id: userId },
  });
  if (!task) {
    throw new Error(`task ${taskId} not found for project ${projectId} / user ${userId} — cannot fire execution Routine`);
  }

  // 3 · PAYLOAD-INTEGRITY GUARD — refuse to fire a malformed/empty payload.
  //       A blank task (no title, or no actionable instruction in description/notes)
  //       produces a template-looking fire the exec-ingest callback can never match,
  //       burning a Routine run. This runs BEFORE the budget gate so a malformed task
  //       never consumes a daily exec slot. Fail loud rather than POST garbage (per the
  //       file's no-silent-fallback contract). The error carries the task id but
  //       NEVER the token or any header.
  const hasTitle = typeof task.title === 'string' && task.title.trim().length > 0;
  if (!hasTitle) {
    throw new Error(`cannot fire execution Routine: task ${taskId} has no title — refusing to send a malformed payload`);
  }
  const hasInstruction =
    (typeof task.description === 'string' && task.description.trim().length > 0) ||
    (typeof task.notes === 'string' && task.notes.trim().length > 0);
  if (!hasInstruction) {
    throw new Error(`cannot fire execution Routine: task ${taskId} has no description/notes (no actionable instruction) — refusing to send a malformed payload`);
  }
  if (!projectId.trim()) {
    throw new Error(`cannot fire execution Routine: task ${taskId} has a blank project_id — the exec-ingest callback could never be matched`);
  }

  // 4 · COST GATE — over the daily exec cap → ExecBudgetError, no fire. Runs after the
  //     integrity guard so a malformed task is rejected without reserving a paid slot.
  await requireExecBudget(userId);

  // 5 · Build the exec payload from the task's what / how / why-and-test. A
  //     correlation trailer carries the task + run id so the exec-ingest callback
  //     can match the returned PR to this fire.
  const correlationId = randomUUID();
  const text =
    `Task: ${task.title}\n\n` +
    `What to do:\n${task.description?.trim() || '(no description provided)'}\n\n` +
    `Why + correctness (the test that proves it works):\n${task.notes?.trim() || '(no notes provided)'}\n\n` +
    `---\nWhen reporting the result back, include this exact correlation block so it can be matched:\n` +
    `correlation_id: ${correlationId}\nproject_id: ${projectId}`;

  // 6 · POST to the Routines /fire endpoint (the verified shape).
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

  // 7 · FAIL LOUD on non-2xx — surface status + body, NEVER the token/headers.
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable body>');
    throw new Error(`execution Routine fire failed (${res.status}): ${body.slice(0, 500)}`);
  }

  // 8 · Parse the session pointer — fail loud if the expected fields are absent.
  const json = (await res.json().catch(() => null)) as
    | { type?: string; claude_code_session_id?: string; claude_code_session_url?: string }
    | null;
  const sessionId = json?.claude_code_session_id;
  const sessionUrl = json?.claude_code_session_url;
  if (!sessionId || !sessionUrl) {
    throw new Error('execution Routine fire returned no session pointer (claude_code_session_id/url missing)');
  }

  // userEmail accepted for caller symmetry + future audit-log attribution (EXEC-2).
  void userEmail;

  return {
    claudeCodeSessionId: sessionId,
    claudeCodeSessionUrl: sessionUrl,
    correlationId,
  };
}
