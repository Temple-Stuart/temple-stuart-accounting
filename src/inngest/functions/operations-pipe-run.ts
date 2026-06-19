/**
 * operations-pipe-run (PHASE2-3) — the auto-fire pipe orchestrator.
 *
 * Consumes the `operations/pipe.run` event (emitted by the auth'd trigger route
 * POST /api/operations/projects/[id]/run-pipe, PHASE2-2) and runs the pipe
 * automatically, end to end, as durable Inngest steps:
 *
 *   1. research      — generateDeepResearch (PAID) → write deep_research_input
 *   2. fusion        — generateProjectTasks (PAID, reads the fresh research +
 *                      an EMPTY audit → "(none provided)") → returns tasks
 *   3. land-pending  — insert the tasks as status=pending_review (the human
 *                      checkpoint — NEVER silently 'open'); user accepts later
 *                      by flipping to 'open' via the existing task PATCH route.
 *
 * SECURITY / COST (per CLAUDE.md):
 *   - Both paid calls gate on requirePipeBudget(userId) BEFORE the lib call —
 *     the same per-user daily cap (=20) the manual routes use (2 increments/run).
 *   - THE RETRY TRAP: a thrown error retries by default in Inngest, which would
 *     re-increment the budget. So PipeBudgetError is rethrown as a
 *     NonRetriableError — over-cap fails loud ONCE, no retry-spin.
 *   - The engine libs are called DIRECTLY with explicit userId/userEmail (a job
 *     has no cookie). The event payload carries only { projectId, userId }; the
 *     user's email is resolved from the users table, and the project is
 *     re-loaded ownership-scoped by { id, user_id } (defensive).
 *   - The CC-audit stage is SKIPPED in Phase 2 (claude_code_audit_input stays
 *     empty → fusion degrades to "(none provided)"); Phase 3 automates it.
 */

import { NonRetriableError } from 'inngest';
import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { generateDeepResearch } from '@/lib/ai/generateDeepResearch';
import { generateProjectTasks, TaskSynthesisError } from '@/lib/ai/generateProjectTasks';
import { toNorthStarContext } from '@/lib/ai/northStarContext';
import { requirePipeBudget, PipeBudgetError } from '@/lib/pipeBudget';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

/** Resolve a field's items: prefer the JSONB array, fall back to the legacy
 *  paragraph. Returns [] if neither has content. (Mirrors the pipe routes;
 *  problem/diagnosis are optional → [].) */
function resolveItems(itemsJson: unknown, legacyText: string | null): string[] {
  if (Array.isArray(itemsJson)) {
    const arr = itemsJson.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (arr.length > 0) return arr;
  }
  const legacy = (legacyText ?? '').trim();
  return legacy.length > 0 ? [legacy] : [];
}

/** Charge one pipe paid-call against the per-user daily cap. Over cap →
 *  NonRetriableError so Inngest does NOT retry (which would re-increment). */
async function chargeBudget(userId: string): Promise<void> {
  try {
    await requirePipeBudget(userId);
  } catch (err) {
    if (err instanceof PipeBudgetError) {
      throw new NonRetriableError(err.message);
    }
    throw err;
  }
}

export const operationsPipeRun = inngest.createFunction(
  {
    id: 'operations-pipe-run',
    name: 'Operations Pipe Run (auto research → fusion → pending tasks)',
    triggers: [{ event: 'operations/pipe.run' }],
    // One run per project at a time — a project can't double-fire its own pipe.
    concurrency: { limit: 1, key: 'event.data.projectId' },
  },
  async ({ event, step }) => {
    const projectId = String(event.data?.projectId ?? '');
    const userId = String(event.data?.userId ?? '');
    if (!projectId || !userId) {
      throw new NonRetriableError('operations/pipe.run requires projectId + userId');
    }

    // ── Load user (for email) + project (ownership-scoped, defensive) ─────────
    const ctx = await step.run('load-context', async () => {
      const user = await prisma.users.findUnique({ where: { id: userId }, select: { id: true, email: true } });
      if (!user) throw new NonRetriableError(`user ${userId} not found`);
      const project = await prisma.operations_projects.findFirst({
        where: { id: projectId, user_id: userId }, // ownership scope
      });
      if (!project) throw new NonRetriableError(`project ${projectId} not found for user ${userId}`);
      const goalItems = resolveItems(project.goal_items, project.goal);
      if (goalItems.length === 0) {
        throw new NonRetriableError('project must have at least one goal item before running the pipe');
      }
      const nsRow = await prisma.operations_north_star.findUnique({ where: { user_id: userId } });
      return {
        email: user.email,
        title: project.title,
        entityId: project.entity_id,
        goalItems,
        problemItems: resolveItems(project.problem_items, project.problem),
        diagnosisItems: resolveItems(project.diagnosis_items, project.diagnosis),
        northStar: toNorthStarContext(nsRow),
      };
    });

    // ── 1 · RESEARCH (PAID) → write deep_research_input ───────────────────────
    await step.run('research', async () => {
      await chargeBudget(userId);
      const result = await generateDeepResearch({
        userId,
        userEmail: ctx.email,
        projectId,
        projectTitle: ctx.title,
        goalItems: ctx.goalItems,
        problemItems: ctx.problemItems,
        diagnosisItems: ctx.diagnosisItems,
        northStar: ctx.northStar,
      });
      await prisma.operations_projects.update({
        where: { id: projectId },
        data: { deep_research_input: result.research },
      });
      return { usageId: result.usageId };
    });

    // ── 2 · FUSION (PAID) — reads fresh research + empty audit "(none provided)" ─
    const fusion = await step.run('fusion', async () => {
      await chargeBudget(userId);
      // Re-read the just-written research so fusion grounds on it.
      const fresh = await prisma.operations_projects.findUnique({
        where: { id: projectId },
        select: { deep_research_input: true, claude_code_audit_input: true },
      });
      let result;
      try {
        result = await generateProjectTasks({
          userId,
          userEmail: ctx.email,
          projectId,
          projectTitle: ctx.title,
          goalItems: ctx.goalItems,
          problemItems: ctx.problemItems,
          diagnosisItems: ctx.diagnosisItems,
          northStar: ctx.northStar,
          deepResearchInput: fresh?.deep_research_input ?? null,
          // CC-audit SKIPPED in Phase 2 → empty → "(none provided)" (graceful).
          claudeCodeAuditInput: fresh?.claude_code_audit_input ?? null,
        });
      } catch (err) {
        // FUSION-FIX-1: a synthesis/parse failure is DETERMINISTIC — re-running the
        // same inputs fails identically. Mark it terminal so Inngest does NOT retry
        // ~4× (the 12-min, 4× paid-call waste). Transient errors (network/API) stay a
        // plain Error → retryable. Fail LOUD either way — no fake tasks.
        if (err instanceof TaskSynthesisError) {
          throw new NonRetriableError(err.message);
        }
        throw err;
      }
      return { tasks: result.tasks, usageId: result.usageId };
    });

    // ── 3 · LAND-PENDING — insert tasks as pending_review (the checkpoint) ────
    const landed = await step.run('land-pending', async () => {
      // Base display_order = max(existing) + 1 (mirrors bulk-create).
      const maxOrderRow = await prisma.operations_project_tasks.findFirst({
        where: { project_id: projectId, user_id: userId },
        orderBy: { display_order: 'desc' },
        select: { display_order: true },
      });
      const baseOrder = (maxOrderRow?.display_order ?? -1) + 1;

      const created = await prisma.$transaction(
        fusion.tasks.map((task) =>
          prisma.operations_project_tasks.create({
            data: {
              user_id: userId,
              project_id: projectId,
              entity_id: ctx.entityId,
              title: task.title,
              description: task.description,
              link_url: task.link_url,
              notes: task.notes,
              display_order: baseOrder + task.suggested_order,
              source_ai_usage_id: fusion.usageId,
              status: 'pending_review', // the auto-fire checkpoint — NOT 'open'
            },
          })
        )
      );

      // Audit row per task (mirrors bulk-create; the auto-path actor is the user).
      for (const task of created) {
        await writeAuditLog({
          actor: { user_id: userId, email: ctx.email, type: 'human_user' },
          action: {
            type: 'operations_project_task_created',
            description: `Auto-fire pipe created pending task "${task.title}" for project ${projectId}`,
          },
          target: { table: 'operations_project_tasks', id: task.id },
          payload: {
            before: null,
            after: task,
            metadata: {
              source_ai_usage_id: fusion.usageId,
              project_id: projectId,
              entity_id: ctx.entityId,
              auto_fire: true,
              status: 'pending_review',
            },
          },
        });
      }
      return { count: created.length };
    });

    return {
      ok: true,
      project_id: projectId,
      tasks_landed: landed.count,
      status: 'pending_review',
    };
  }
);
