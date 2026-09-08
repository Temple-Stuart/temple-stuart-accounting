/**
 * SELL-05b — ONE ENTITLEMENT MODEL. Paid-per-use AI (the meal/cart planners,
 * the trip scan, Time's actions) is gated by a SIGNED-IN USER and the AI
 * DAILY CAP — never a tier. Two pure helpers the routes share, over injected
 * ports so the ruled cases run in node:test:
 *
 *   aiViewer(findUser, viewer)  → 401 for a guest, 404 for a cookie naming no
 *                                 user, else the user;
 *   aiCaps(deps, userId)        → the per-user hourly volume cap (AI_RATE_LIMIT,
 *                                 requireAiRateLimit — unchanged) then the
 *                                 daily cap (AI_ROUTINE_DAILY_CAP through
 *                                 requireRoutineBudget, withDailyCap) — each a
 *                                 DECLARED 429; null when the request may spend.
 *
 * Order in a route: aiViewer → the input rules → ownership → aiCaps → the paid
 * call. A refused input spends nothing.
 */
import { withDailyCap } from './dailyCap';

/** A cap's declared refusal — the hourly cap (with Retry-After) or the daily cap (DailyCapRefusal is one of these). */
export interface AiCapRefusal {
  status: 429;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export type AiViewerOutcome<U> = { ok: true; user: U } | { ok: false; refusal: { status: 401 | 404; body: { error: string } } };

export async function aiViewer<U>(findUser: (email: string) => Promise<U | null>, viewer: string | null): Promise<AiViewerOutcome<U>> {
  if (!viewer) return { ok: false, refusal: { status: 401, body: { error: 'Unauthorized' } } };
  const user = await findUser(viewer);
  if (!user) return { ok: false, refusal: { status: 404, body: { error: 'User not found' } } };
  return { ok: true, user };
}

export interface AiCapDeps {
  /** The hourly volume cap (ai-rate-limit.ts requireAiRateLimit): a refusal, or null. */
  hourly(userId: string): Promise<{ status: 429; body: Record<string, unknown>; headers?: Record<string, string> } | null>;
  /** The daily cap reservation (routineFireBudget.ts requireRoutineBudget): throws RoutineBudgetError at the cap. */
  reserveDaily(userId: string): Promise<void>;
}

export async function aiCaps(deps: AiCapDeps, userId: string): Promise<AiCapRefusal | null> {
  const hourly = await deps.hourly(userId);
  if (hourly) return hourly;
  return withDailyCap(deps.reserveDaily, userId);
}

/** The honest line the pages print where a tier wall stood: what the model is. */
export const AI_ACCESS_LINE = 'AI planning is free with an account — paid per use under the AI daily cap, which declares itself when hit.';
