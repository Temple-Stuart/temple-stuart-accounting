/**
 * routineDone — ONE DONE: WHEN A ROUTINE'S OCCURRENCE IS DONE, AND WHAT ITS
 * COMPLETION MUST DO (TASKS-ONE-02, 2026-10-14). Pure: no Prisma, no fetch, no
 * clock — the tests drive every case.
 *
 * Alex's ruling: the day card's done is the routine's done. The week grid's and
 * the Today strip's "✓ mark done" went; the stop record (stopRecord.ts) is the
 * one way a person says a stop was done, and the routine's completion MIRRORS it:
 *
 *   · A routine with NO lines is done at an occurrence when its `routine` record
 *     there says done. A skipped record is not done; no record is not done.
 *   · A routine WITH lines is done when EVERY line of the occurrence that is a
 *     stop (stopRole.ts isStop — a line takes its routine's role, ROLE-01) has a
 *     done record. A line with no record, or a skipped one, leaves it not done.
 *     A routine none of whose lines is a stop is never done by records — it
 *     takes none (the stops route refuses an all-day routine by name).
 *   · completed_at is the record's done_at (no lines), or the LATEST done_at
 *     among the lines — the moment the occurrence became done.
 *
 * The completion exists exactly when the occurrence is done: completionMove
 * names the one write that keeps it so — create, update (done_at moved while it
 * stays done), delete, or nothing. routineCompletion.ts carries it out, in the
 * stops routes' transaction.
 */
import type { StopRecordRow } from './stopRecord';
import { isStop, type StopRole } from './stopRole';

/** An active line of the routine, with the role it takes (its routine's). */
export interface DoneLine {
  readonly id: string;
  readonly role: StopRole;
}

/** A record at THIS occurrence, as stopRecordRowOf answers it. */
export type DoneRecord = Pick<StopRecordRow, 'kind' | 'target_id' | 'outcome' | 'done_at'>;

export type OccurrenceDone = { readonly done: true; readonly completedAt: Date } | { readonly done: false };

const NOT_DONE: OccurrenceDone = { done: false };

/** A done record's instant. done ⇒ done_at set is the migration's CHECK — a done record without one is the database's error. */
function doneAtOf(r: DoneRecord): Date {
  if (r.done_at === null) throw new Error(`routineDone: the done record for ${r.kind} ${r.target_id} has no done_at — the migration's CHECK sets it exactly when done`);
  return new Date(r.done_at);
}

/** Is the routine's occurrence done, by its stop records — and when did it become so. */
export function occurrenceDone(input: { readonly routineId: string; readonly lines: readonly DoneLine[]; readonly records: readonly DoneRecord[] }): OccurrenceDone {
  if (input.lines.length === 0) {
    const r = input.records.find((x) => x.kind === 'routine' && x.target_id === input.routineId);
    return r !== undefined && r.outcome === 'done' ? { done: true, completedAt: doneAtOf(r) } : NOT_DONE;
  }
  const stops = input.lines.filter((l) => isStop(l.role));
  if (stops.length === 0) return NOT_DONE;
  let latest: Date | null = null;
  for (const line of stops) {
    const r = input.records.find((x) => x.kind === 'routine_line' && x.target_id === line.id);
    if (r === undefined || r.outcome !== 'done') return NOT_DONE;
    const at = doneAtOf(r);
    if (latest === null || at.getTime() > latest.getTime()) latest = at;
  }
  return { done: true, completedAt: latest as Date };
}

export type CompletionMove =
  | { readonly kind: 'create'; readonly completedAt: Date }
  | { readonly kind: 'update'; readonly completedAt: Date }
  | { readonly kind: 'delete' }
  | { readonly kind: 'none' };

/** The one write that keeps the completion the occurrence's mirror. */
export function completionMove(done: OccurrenceDone, existing: { readonly completedAt: Date } | null): CompletionMove {
  if (done.done) {
    if (existing === null) return { kind: 'create', completedAt: done.completedAt };
    return existing.completedAt.getTime() === done.completedAt.getTime() ? { kind: 'none' } : { kind: 'update', completedAt: done.completedAt };
  }
  return existing === null ? { kind: 'none' } : { kind: 'delete' };
}

/** Minutes from the expected instant to the completion — the completions POST's own rule, rounded. */
export const deltaMinutes = (completedAt: Date, expectedAt: Date): number => Math.round((completedAt.getTime() - expectedAt.getTime()) / 60000);
