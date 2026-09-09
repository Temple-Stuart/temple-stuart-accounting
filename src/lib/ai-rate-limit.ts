import { NextResponse } from 'next/server';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// SEC-5: per-user VOLUME cap for the paid-LLM (/api/ai/*) routes — the hourly
// burst meter. SELL-05b: those routes gate on a signed-in user and the AI DAILY
// cap (src/lib/ai/caps.ts aiCaps runs this hourly cap first, then the daily
// reservation); no tier stands in front of it any more. A single shared
// per-user bucket across all /api/ai/* routes caps total LLM calls per window —
// the concern is total spend, not per-endpoint.
//
// Env-tunable, mirroring rateLimit.ts's searchRateLimitDefaults (SEARCH_RATE_LIMIT
// / SEARCH_RATE_WINDOW) pattern — the same env-default resolution already used in
// this codebase, so Alex can retune without a deploy.
//
// ⚠️ PROPOSED DEFAULTS — pending Alex's ruling. No LLM-rate precedent existed to
// mirror; 30 requests / hour / user is generous for interactive UI use (a human
// generating meal plans + spending insights + market briefs stays well under it)
// while capping a runaway loop at 30/hr instead of thousands. Adjust via
// AI_RATE_LIMIT / AI_RATE_WINDOW, or change the constants below.
const AI_RATE_LIMIT_DEFAULT = 30;
const AI_RATE_WINDOW_DEFAULT = 3600; // seconds (1 hour)

function aiRateDefaults(): { limit: number; windowSeconds: number } {
  const limit = parseInt(process.env.AI_RATE_LIMIT || '', 10);
  const windowSeconds = parseInt(process.env.AI_RATE_WINDOW || '', 10);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : AI_RATE_LIMIT_DEFAULT,
    windowSeconds: Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : AI_RATE_WINDOW_DEFAULT,
  };
}

export const AI_HOURLY_LINE = 'AI request limit reached — please wait before trying again.';

/** The hourly cap as an outcome (src/lib/ai/caps.ts reads this): a declared 429, or null when the user may proceed. */
export async function aiHourlyCap(userId: string): Promise<{ status: 429; body: { error: string; kind: 'hourly_cap' }; headers: { 'Retry-After': string } } | null> {
  const { limit, windowSeconds } = aiRateDefaults();
  try {
    await rateLimit(`ai:${userId}`, { limit, windowSeconds });
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { status: 429, body: { error: AI_HOURLY_LINE, kind: 'hourly_cap' }, headers: { 'Retry-After': String(error.retryAfterSeconds) } };
    }
    throw error;
  }
}

/**
 * Per-user volume cap for paid-LLM routes, as a NextResponse. Returns a 429
 * when the user has exceeded the window, else null (caller proceeds). Call
 * BEFORE the paid LLM call — no paid token is spent on a rate-limited request.
 */
export async function requireAiRateLimit(userId: string): Promise<NextResponse | null> {
  const refused = await aiHourlyCap(userId);
  return refused ? NextResponse.json(refused.body, { status: refused.status, headers: refused.headers }) : null;
}
