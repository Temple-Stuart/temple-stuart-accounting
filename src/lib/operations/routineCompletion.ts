/**
 * routineCompletion — THE ONE WRITER OF A ROUTINE'S COMPLETION (TASKS-ONE-02,
 * 2026-10-14).
 *
 * The completion mirrors the day card's stop records (routineDone.ts): it exists
 * exactly when the occurrence is done. The stops routes call syncCompletion in
 * the SAME transaction as the record they write or clear, after lockRoutine, and
 * audit what it changed once the transaction commits (auditCompletionChange) —
 * writeAuditLog runs its own transaction, so the audit row follows the write, as
 * every operations route does.
 *
 * What each move does to the routine (Alex's rulings, 2026-10-14):
 *   · create — exactly what the completions POST did (its code, extracted here
 *     when the route was deleted): the row with delta_minutes; last_completed_at
 *     = completed_at; next_due_at = the next occurrence at or after completed_at
 *     (expandForward is inclusive — the POST's own call, unchanged);
 *     consecutive_completion_streak + 1; consecutive_miss_streak → 0. Audited
 *     operations_routine_completed.
 *   · delete (un-complete) — last_completed_at = the latest remaining
 *     completion's completed_at, or null when none remains; next_due_at = the
 *     next occurrence at or after now, as the nightly evaluator computes it;
 *     consecutive_completion_streak − 1, never below 0; consecutive_miss_streak
 *     unchanged. Audited operations_routine_uncompleted.
 *   · update — the occurrence stays done but its done_at moved: completed_at,
 *     delta_minutes and the routine's last_completed_at (the latest completion
 *     again). Audited operations_routine_completion_updated.
 *
 * No fallback (Alex, 2026-10-14): when the next occurrence cannot be computed,
 * expandForward throws, and the record, the completion and the routine update
 * roll back together — the route answers its fixed 500. (The deleted completions
 * POST caught that and wrote next_due_at = null; nothing here does.)
 *
 * Ownership: the route proves the routine is the caller's before it calls in;
 * every read and write here is scoped to that user as well.
 */
import type { Prisma } from '@prisma/client';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { expandForward, scheduleAnchor } from './rruleHelpers';
import { completionMove, deltaMinutes, occurrenceDone } from './routineDone';
import { stopRecordRowOf } from './stopRecord';
import { isStopRole } from './stopRole';

type Tx = Prisma.TransactionClient;

/** The routine's own schedule — what the next occurrence is read from. */
interface Schedule {
  readonly schedule_rrule: string;
  readonly timezone: string;
  readonly start_date: Date | null;
}

/** The routine's next occurrence at or after `after` (expandForward is inclusive), anchored on its start_date (ONEOFF-01); null when the schedule has none left. Throws what expandForward throws. */
export function nextDueAfter(routine: Schedule, after: Date): Date | null {
  const upcoming = expandForward(routine.schedule_rrule, routine.timezone, after, 1, scheduleAnchor(routine.start_date));
  return upcoming.length === 0 ? null : upcoming[0];
}

/**
 * Hold the routine's row for the rest of the transaction, so two writes to the
 * same routine's occurrence (two of its lines, say) take turns — each reads the
 * records the other committed, and the mirror holds. Scoped to the caller; a
 * routine that is not theirs is an error here, because the route proved it.
 */
export async function lockRoutine(tx: Tx, routineId: string, userId: string): Promise<void> {
  const held = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM operations_routines WHERE id = ${routineId}::uuid AND user_id = ${userId} FOR NO KEY UPDATE`;
  if (held.length !== 1) throw new Error(`routineCompletion: routine ${routineId} is not the caller's — the route proves it before the transaction`);
}

/** The completion as the audit log keeps it. */
interface CompletionRow {
  readonly id: string;
  readonly routine_id: string;
  readonly user_id: string;
  readonly expected_at: Date;
  readonly completed_at: Date;
  readonly delta_minutes: number;
  readonly notes: string | null;
  readonly created_at: Date;
}

export type CompletionChange = {
  readonly kind: 'created' | 'updated' | 'deleted';
  readonly routine: { readonly id: string; readonly name: string };
  readonly expectedAt: Date;
  readonly before: CompletionRow | null;
  readonly after: CompletionRow | null;
};

/**
 * Keep the routine's completion at `expectedAt` the mirror of its stop records
 * there — called inside the stops routes' transaction, after lockRoutine and the
 * record's own write. Returns what changed (null when nothing did), for the audit.
 */
export async function syncCompletion(tx: Tx, input: { readonly userId: string; readonly routineId: string; readonly expectedAt: Date; readonly now: Date }): Promise<CompletionChange | null> {
  const { userId, expectedAt, now } = input;
  const routine = await tx.operations_routines.findFirst({
    where: { id: input.routineId, user_id: userId },
    select: { id: true, name: true, role: true, schedule_rrule: true, timezone: true, start_date: true, consecutive_completion_streak: true },
  });
  if (routine === null) throw new Error(`routineCompletion: routine ${input.routineId} is not the caller's — the route proves it and holds its lock`);
  if (!isStopRole(routine.role)) throw new Error(`routineCompletion: routine ${routine.id} carries role ${JSON.stringify(routine.role)} — not one of the six`);
  const role = routine.role;

  const lines = await tx.operations_routine_steps.findMany({ where: { routine_id: routine.id, user_id: userId, is_active: true }, select: { id: true } });
  const rows = await tx.operations_stop_records.findMany({
    where: { user_id: userId, occurrence_at: expectedAt, OR: [{ routine_id: routine.id }, { step_id: { in: lines.map((l) => l.id) } }] },
  });
  const done = occurrenceDone({ routineId: routine.id, lines: lines.map((l) => ({ id: l.id, role })), records: rows.map(stopRecordRowOf) });

  const existing = await tx.operations_routine_completions.findFirst({ where: { routine_id: routine.id, user_id: userId, expected_at: expectedAt } });
  const move = completionMove(done, existing === null ? null : { completedAt: existing.completed_at });
  const named = { id: routine.id, name: routine.name };

  if (move.kind === 'create') {
    const completion = await tx.operations_routine_completions.create({
      data: { routine_id: routine.id, user_id: userId, expected_at: expectedAt, completed_at: move.completedAt, delta_minutes: deltaMinutes(move.completedAt, expectedAt), notes: null },
    });
    await tx.operations_routines.update({
      where: { id: routine.id, user_id: userId },
      data: {
        last_completed_at: move.completedAt,
        next_due_at: nextDueAfter(routine, move.completedAt),
        consecutive_completion_streak: routine.consecutive_completion_streak + 1,
        consecutive_miss_streak: 0,
      },
    });
    return { kind: 'created', routine: named, expectedAt, before: null, after: completion };
  }

  if (move.kind === 'update' && existing !== null) {
    const completion = await tx.operations_routine_completions.update({
      where: { id: existing.id, user_id: userId },
      data: { completed_at: move.completedAt, delta_minutes: deltaMinutes(move.completedAt, expectedAt) },
    });
    await tx.operations_routines.update({ where: { id: routine.id, user_id: userId }, data: { last_completed_at: await latestCompletedAt(tx, routine.id, userId) } });
    return { kind: 'updated', routine: named, expectedAt, before: existing, after: completion };
  }

  if (move.kind === 'delete' && existing !== null) {
    await tx.operations_routine_completions.delete({ where: { id: existing.id, user_id: userId } });
    await tx.operations_routines.update({
      where: { id: routine.id, user_id: userId },
      data: {
        last_completed_at: await latestCompletedAt(tx, routine.id, userId),
        next_due_at: nextDueAfter(routine, now),
        consecutive_completion_streak: Math.max(0, routine.consecutive_completion_streak - 1),
        // consecutive_miss_streak is left as it is: creating this completion zeroed it, and the value it held
        // before is stored nowhere, so it cannot be restored — no number is invented for it.
      },
    });
    return { kind: 'deleted', routine: named, expectedAt, before: existing, after: null };
  }

  if (move.kind !== 'none') throw new Error(`routineCompletion: move ${move.kind} with no completion to move — completionMove answers update and delete only for an existing one`);
  return null;
}

/** The latest completed_at among the routine's completions, or null when it has none. */
async function latestCompletedAt(tx: Tx, routineId: string, userId: string): Promise<Date | null> {
  const latest = await tx.operations_routine_completions.findFirst({ where: { routine_id: routineId, user_id: userId }, orderBy: { completed_at: 'desc' }, select: { completed_at: true } });
  return latest === null ? null : latest.completed_at;
}

/** The audit row for what syncCompletion changed — written after the transaction commits. */
export async function auditCompletionChange(change: CompletionChange, actor: { readonly user_id: string; readonly email: string }): Promise<void> {
  const completion = change.after ?? change.before;
  if (completion === null) throw new Error('routineCompletion: a change with no completion before or after');
  const delta = completion.delta_minutes;
  const words = change.kind === 'created'
    ? `Completed "${change.routine.name}" (Δ ${delta} min) — its stop records say done`
    : change.kind === 'updated'
      ? `Moved the completion of "${change.routine.name}" to ${completion.completed_at.toISOString()} — its stop records' done time changed`
      : `Un-completed "${change.routine.name}" — its stop records no longer say done`;
  await writeAuditLog({
    actor: { user_id: actor.user_id, email: actor.email, type: 'human_user' },
    action: {
      type: change.kind === 'created' ? 'operations_routine_completed' : change.kind === 'updated' ? 'operations_routine_completion_updated' : 'operations_routine_uncompleted',
      description: words,
    },
    target: { table: 'operations_routine_completions', id: completion.id },
    payload: {
      before: change.before,
      after: change.after,
      metadata: {
        routine_id: change.routine.id,
        routine_name: change.routine.name,
        expected_at: change.expectedAt.toISOString(),
        completed_at: completion.completed_at.toISOString(),
        delta_minutes: delta,
      },
    },
  });
}
