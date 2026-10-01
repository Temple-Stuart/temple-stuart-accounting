/**
 * completeRoutine — the ONE writer of a routine's completion from the screen
 * (WEEK-01, 2026-09-30; WEEK-02 adds the edit).
 *
 * Record a done: POST /api/operations/routines/[id]/completions — moved out of
 * TodaysStrip's mark-done so Today and the week send the same request.
 * With no note the body
 * is exactly what Today always sent, { expected_at }; with one, the note rides
 * along ({ expected_at, notes } — the route trims it and keeps it on the
 * completion, the day's journal line).
 *
 * Edit a done's note (WEEK-02) — PATCH /api/operations/routines/[id]/completions/
 * [completionId] with { notes }. The route reads it by the same note rule
 * (src/lib/operations/completionNote.ts): trimmed, and an empty note removes it.
 *
 * Each answer is read the one way TodaysStrip read it: ok, or the route's own
 * words (message, else error, else the writer's own words — "failed to mark
 * complete" / "failed to save the note"). A request that never reaches the
 * route, or an answer that is not JSON, throws — the caller shows it where the
 * row is, as Today does. This file is the only screen file that names a
 * completions route.
 */
export type CompletionAnswer = { readonly ok: true } | { readonly ok: false; readonly message: string };

export async function completeRoutine(routineId: string, expectedAt: string, notes?: string): Promise<CompletionAnswer> {
  const res = await fetch(`/api/operations/routines/${routineId}/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notes === undefined ? { expected_at: expectedAt } : { expected_at: expectedAt, notes }),
  });
  const body = await res.json();
  if (!res.ok) return { ok: false, message: body?.message ?? body?.error ?? 'failed to mark complete' };
  return { ok: true };
}

export async function editCompletionNote(routineId: string, completionId: string, notes: string): Promise<CompletionAnswer> {
  const res = await fetch(`/api/operations/routines/${routineId}/completions/${completionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  const body = await res.json();
  if (!res.ok) return { ok: false, message: body?.message ?? body?.error ?? 'failed to save the note' };
  return { ok: true };
}
