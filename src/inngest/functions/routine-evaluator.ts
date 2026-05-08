/**
 * Routine Evaluator — daily cron that detects missed routine occurrences,
 * updates streak counters, and recomputes next_due_at.
 *
 * φ-2 idempotency: evaluates the window (last_evaluated_at, now()] only.
 * After updating last_evaluated_at = now(), re-runs in the same minute see
 * an empty window. Safe against Inngest retries and duplicate registrations.
 *
 * Miss representation: misses live exclusively in audit_log
 * (action_type='operations_routine_missed'). The completions table is
 * success-only by design (completed_at NOT NULL). Querying misses for a
 * routine = filter audit_log by action_type and target_id.
 *
 * Streak counter contract:
 *   - On miss detection: consecutive_miss_streak += 1;
 *     consecutive_completion_streak = 0
 *   - On completion (handled by /api/operations/routines/[id]/completions
 *     POST): consecutive_completion_streak += 1;
 *     consecutive_miss_streak = 0
 *
 * Cron does NOT increment completion streaks — only miss streaks. The
 * completion endpoint owns its side of the symmetry.
 */

import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { expandBetween, expandForward } from '@/lib/operations/rruleHelpers';

export const routineEvaluator = inngest.createFunction(
  {
    id: 'routine-evaluator',
    name: 'Operations Routine Evaluator',
    triggers: [{ cron: '15 0 * * *' }],
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const now = new Date();

    const routines = await step.run('load-active-routines', async () => {
      return prisma.operations_routines.findMany({
        where: { is_active: true },
        select: {
          id: true,
          user_id: true,
          name: true,
          schedule_rrule: true,
          timezone: true,
          fail_threshold_minutes: true,
          last_evaluated_at: true,
          created_at: true,
          consecutive_completion_streak: true,
          consecutive_miss_streak: true,
        },
      });
    });

    let totalMissesEmitted = 0;
    let totalRoutinesEvaluated = 0;
    let totalErrors = 0;

    for (const r of routines) {
      try {
        // Prisma's DateTime fields cross step.run as ISO strings (Inngest
        // serializes step return values for durability). Convert back to Date.
        const windowStart = new Date(r.last_evaluated_at ?? r.created_at);
        if (windowStart.getTime() >= now.getTime()) {
          // Defensive: clock skew or admin-set future timestamp; skip.
          continue;
        }

        // Expand RRULE within the (windowStart, now] interval.
        let expectedOccurrences: Date[] = [];
        try {
          expectedOccurrences = expandBetween(r.schedule_rrule, r.timezone, windowStart, now);
        } catch (err) {
          console.error(`[routine-evaluator] RRULE parse failed for routine ${r.id}: ${err}`);
          totalErrors += 1;
          continue;
        }

        // Filter to occurrences past their fail threshold.
        const failThresholdMs = r.fail_threshold_minutes * 60 * 1000;
        const eligibleMisses = expectedOccurrences.filter(
          (e) => now.getTime() > e.getTime() + failThresholdMs
        );

        let routineMissCount = 0;

        for (const expectedAt of eligibleMisses) {
          // Skip if a completion exists for this exact expected_at.
          const existingCompletion = await prisma.operations_routine_completions.findUnique({
            where: {
              routine_id_expected_at: {
                routine_id: r.id,
                expected_at: expectedAt,
              },
            },
          });
          if (existingCompletion) continue;

          // Emit miss audit row. (No completion row — schema is success-only.)
          await writeAuditLog({
            actor: {
              user_id: r.user_id,
              email: 'system@templestuart.com',
              type: 'system_automation',
            },
            action: {
              type: 'operations_routine_missed',
              description: `Missed routine "${r.name}" expected at ${expectedAt.toISOString()}`,
            },
            target: {
              table: 'operations_routines',
              id: r.id,
            },
            payload: {
              metadata: {
                routine_id: r.id,
                routine_name: r.name,
                expected_at: expectedAt.toISOString(),
                fail_threshold_minutes: r.fail_threshold_minutes,
                emitted_by: 'routine-evaluator-cron',
              },
            },
          });
          routineMissCount += 1;
          totalMissesEmitted += 1;
        }

        // Recompute next_due_at: next occurrence at or after now().
        let nextDueAt: Date | null = null;
        try {
          const upcoming = expandForward(r.schedule_rrule, r.timezone, now, 1);
          nextDueAt = upcoming[0] ?? null;
        } catch (err) {
          console.error(`[routine-evaluator] next_due_at recompute failed for ${r.id}: ${err}`);
        }

        // Update streak counters and cursors.
        await prisma.operations_routines.update({
          where: { id: r.id },
          data: {
            last_evaluated_at: now,
            next_due_at: nextDueAt,
            ...(routineMissCount > 0
              ? {
                  consecutive_miss_streak: r.consecutive_miss_streak + routineMissCount,
                  consecutive_completion_streak: 0,
                }
              : {}),
          },
        });

        totalRoutinesEvaluated += 1;
      } catch (err) {
        console.error(`[routine-evaluator] failed to evaluate routine ${r.id}: ${err}`);
        totalErrors += 1;
      }
    }

    return {
      evaluated_at: now.toISOString(),
      total_routines_evaluated: totalRoutinesEvaluated,
      total_misses_emitted: totalMissesEmitted,
      total_errors: totalErrors,
    };
  }
);
