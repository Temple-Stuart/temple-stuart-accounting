/**
 * SELL-05 — the AI daily cap as a route gate. Time's two AI actions
 * (enrich-routine, generate-script) used to gate on a tier nothing sells
 * (requireTier('ai') → pro_plus only); they now gate on the per-user daily
 * cap already in use — AI_ROUTINE_DAILY_CAP, reserved through
 * requireRoutineBudget (src/lib/routineFireBudget.ts) — and the cap is
 * DECLARED when hit: a 429 carrying the budget's own line, used and cap.
 *
 * Pure: the reservation is injected, so the gate runs in node:test with a
 * fake meter. Any error that is not the budget's is rethrown (a fault, not a
 * refusal). Call it AFTER input validation and ownership (a refused input
 * must not spend the day's budget) and BEFORE the paid call.
 */
export interface DailyCapRefusal {
  status: 429;
  body: { error: string; kind: 'daily_cap'; used: number; cap: number };
}

export async function withDailyCap(reserve: (userId: string) => Promise<void>, userId: string): Promise<DailyCapRefusal | null> {
  try {
    await reserve(userId);
    return null;
  } catch (err) {
    if (err instanceof Error && err.name === 'RoutineBudgetError') {
      const e = err as Error & { callCount?: number; cap?: number };
      return { status: 429, body: { error: err.message, kind: 'daily_cap', used: e.callCount ?? 0, cap: e.cap ?? 0 } };
    }
    throw err;
  }
}
