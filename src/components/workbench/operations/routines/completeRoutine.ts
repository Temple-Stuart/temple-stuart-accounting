/**
 * completeRoutine — the ONE writer of a routine's completion from the screen
 * (WEEK-01, 2026-09-30).
 *
 * POST /api/operations/routines/[id]/completions — moved out of TodaysStrip's
 * mark-done so Today and the week send the same request. With no note the body
 * is exactly what Today always sent, { expected_at }; with one, the note rides
 * along ({ expected_at, notes } — the route trims it and keeps it on the
 * completion, the day's journal line).
 *
 * The answer is read the one way TodaysStrip read it: ok, or the route's own
 * words (message, else error, else "failed to mark complete"). A request that
 * never reaches the route, or an answer that is not JSON, throws — the caller
 * shows it where the row is, as Today does.
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
