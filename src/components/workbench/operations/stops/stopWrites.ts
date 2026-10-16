/**
 * stopWrites — the ONE writer of a stop's record from the screen (STOP-01, 2026-10-12).
 *
 *   · set:   POST /api/operations/stops            { kind, id, instant, outcome, done_at, actual_cents, rating, note, actual_minutes }
 *   · clear: DELETE /api/operations/stops/[id]
 *   · move:  PATCH /api/operations/stops/[id]       { instant } — RETRO-01 (2026-10-16): a record that matches no stop re-attaches to its stop
 *
 * Each answer is read the one way the week's writer reads its own
 * (routines/completeRoutine.ts): ok, or the route's own words — message, else
 * error, else this writer's words. A request that never reaches the route, or
 * an answer that is not JSON, throws; the caller shows it where the form is.
 * TASKS-ONE-02 (2026-10-14): completeRoutine.ts is deleted with the week grid
 * and the Today strip; this reading of an answer is unchanged and stands alone.
 * This file is the only screen file that names a stops route with a method.
 */
import type { StopOutcome, StopRecordKind } from '@/lib/operations/stopRecord';

export type StopAnswer = { readonly ok: true } | { readonly ok: false; readonly message: string };

export interface StopBody {
  readonly kind: StopRecordKind;
  readonly id: string;
  readonly instant: string;
  readonly outcome: StopOutcome;
  readonly done_at: string | null;
  readonly actual_cents: number | null;
  readonly rating: number | null;
  readonly note: string | null;
  readonly actual_minutes: number | null;
}

async function answerOf(res: Response, ownWords: string): Promise<StopAnswer> {
  const body = await res.json();
  if (!res.ok) return { ok: false, message: body?.message ?? body?.error ?? ownWords };
  return { ok: true };
}

export async function setStopRecord(values: StopBody): Promise<StopAnswer> {
  const res = await fetch('/api/operations/stops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  return answerOf(res, 'failed to save the stop record');
}

export async function clearStopRecord(id: string): Promise<StopAnswer> {
  const res = await fetch(`/api/operations/stops/${id}`, { method: 'DELETE' });
  return answerOf(res, 'failed to clear the stop record');
}

/** RETRO-01: the record moved to its stop's instant — the route proves the instant is that plan's stop on the day. */
export async function moveStopRecord(id: string, instant: string): Promise<StopAnswer> {
  const res = await fetch(`/api/operations/stops/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instant }),
  });
  return answerOf(res, 'failed to move the stop record');
}
