/**
 * stayWrites — the ONE writer of a stay from the screen (STAY-01, 2026-10-12).
 *
 *   · create: POST /api/operations/stays            { place, starts_on, ends_on }
 *   · change: PATCH /api/operations/stays/[id]      { place, starts_on, ends_on }
 *   · remove: DELETE /api/operations/stays/[id]
 *
 * Each answer is read the one way the week's writer reads its own
 * (routines/completeRoutine.ts): ok, or the route's own words — message, else
 * error, else this writer's words. A request that never reaches the route, or
 * an answer that is not JSON, throws; the caller shows it where the form is.
 * TASKS-ONE-02 (2026-10-14): completeRoutine.ts is deleted with the week grid
 * and the Today strip; this reading of an answer is unchanged and stands alone.
 * This file is the only screen file that names a stays route with a method.
 */
export type StayAnswer = { readonly ok: true } | { readonly ok: false; readonly message: string };

export interface StayBody {
  readonly place: string;
  readonly starts_on: string;
  readonly ends_on: string;
}

async function answerOf(res: Response, fallbackWords: string): Promise<StayAnswer> {
  const body = await res.json();
  if (!res.ok) return { ok: false, message: body?.message ?? body?.error ?? fallbackWords };
  return { ok: true };
}

export async function createStay(values: StayBody): Promise<StayAnswer> {
  const res = await fetch('/api/operations/stays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  return answerOf(res, 'failed to save the stay');
}

export async function changeStay(id: string, values: StayBody): Promise<StayAnswer> {
  const res = await fetch(`/api/operations/stays/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  return answerOf(res, 'failed to save the stay');
}

export async function removeStay(id: string): Promise<StayAnswer> {
  const res = await fetch(`/api/operations/stays/${id}`, { method: 'DELETE' });
  return answerOf(res, 'failed to delete the stay');
}
