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
 *     POST — deleted TASKS-ONE-02, below): consecutive_completion_streak += 1;
 *     consecutive_miss_streak = 0
 *
 * Cron does NOT increment completion streaks — only miss streaks. The
 * completion endpoint owns its side of the symmetry.
 *
 * TASKS-ONE-02 (2026-10-14): the completions POST is deleted; the completion's
 * one writer is src/lib/operations/routineCompletion.ts, called by the stops
 * routes — a routine's occurrence is complete when its stop records say done.
 * An all-day routine (role all_day — a subscription, a membership) is a CHARGE,
 * not a commitment to do (Alex's ruling): no miss check, so no miss row and no
 * streak change; its last_evaluated_at and next_due_at still update.
 *
 * ROUTINE-02a (Alex, 2026-10-18): END DATES HONOURED. The row's end_date is read
 * and every expansion is bounded by it (rruleHelpers.ts throughEnd), so a
 * routine whose end has passed expects nothing in the window — never a miss —
 * and its next_due_at is null. One routine's window is evaluateWindow, pure
 * and exported, so a test and a local run can drive it without Inngest; the
 * loop below only writes what it answers.
 */

import { inngest } from '../client';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { expandBetween, expandForward, scheduleAnchor } from '@/lib/operations/rruleHelpers';
import { isStop, isStopRole } from '@/lib/operations/stopRole';

/** What one routine's window is read from (the rows cross step.run as JSON, so a date may arrive as an ISO string). */
export interface EvaluatedRoutine {
  readonly schedule_rrule: string;
  readonly timezone: string;
  readonly start_date: Date | string | null;
  readonly end_date: Date | string | null;
  readonly fail_threshold_minutes: number;
  readonly role: string;
}

/**
 * ROUTINE-02a: one routine's window, pure — what was expected in (windowStart, now],
 * which of those are misses by the fail threshold, and the next occurrence at or
 * after now — every expansion anchored on start_date (ONEOFF-01) and bounded by
 * end_date, so a routine whose end has passed expects nothing, misses nothing and
 * has no next. Throws what the expansion throws (a rule that does not parse, a
 * zone Intl cannot read); a role outside the six is thrown by name. An all-day
 * routine is a charge, not a commitment (TASKS-ONE-02): no miss.
 */
export function evaluateWindow(r: EvaluatedRoutine, windowStart: Date, now: Date): { readonly expected: Date[]; readonly misses: Date[]; readonly nextDueAt: Date | null } {
  if (!isStopRole(r.role)) throw new Error(`routine carries role ${JSON.stringify(r.role)} — not one of the six`);
  const expected = expandBetween(r.schedule_rrule, r.timezone, windowStart, now, scheduleAnchor(r.start_date), r.end_date);
  const failThresholdMs = r.fail_threshold_minutes * 60 * 1000;
  const misses = !isStop(r.role) ? [] : expected.filter((e) => now.getTime() > e.getTime() + failThresholdMs);
  const nextDueAt = expandForward(r.schedule_rrule, r.timezone, now, 1, scheduleAnchor(r.start_date), r.end_date)[0] ?? null;
  return { expected, misses, nextDueAt };
}

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
          // ONEOFF-01: the anchor every expansion is built on.
          start_date: true,
          // ROUTINE-02a: the last day an occurrence may fall on — nothing after it is expected or a miss.
          end_date: true,
          fail_threshold_minutes: true,
          last_evaluated_at: true,
          created_at: true,
          consecutive_completion_streak: true,
          consecutive_miss_streak: true,
          // TASKS-ONE-02: the role decides whether the routine is a commitment to do at all.
          role: true,
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

        // ROUTINE-02a: the window — expected in (windowStart, now], the misses by the threshold, the next due —
        // anchored on start_date and bounded by end_date; a rule or zone that cannot be read is this routine's error.
        let window: ReturnType<typeof evaluateWindow>;
        try {
          window = evaluateWindow(r, windowStart, now);
        } catch (err) {
          console.error(`[routine-evaluator] expansion failed for routine ${r.id}: ${err}`);
          totalErrors += 1;
          continue;
        }

        let routineMissCount = 0;

        for (const expectedAt of window.misses) {
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

        // Update streak counters and cursors. ROUTINE-02a: next_due_at is the window's — null once nothing remains before the end.
        await prisma.operations_routines.update({
          where: { id: r.id },
          data: {
            last_evaluated_at: now,
            next_due_at: window.nextDueAt,
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
