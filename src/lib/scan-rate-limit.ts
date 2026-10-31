import { NextResponse } from 'next/server';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// SCAN-SPEND-QUOTA: per-user RUN quota for the Trade scan/convergence pipeline.
// The scan route gates tab ACCESS (requireTabAccess('tab:trade')) but not volume;
// one entitled user could loop scans and each run fires the full paid surface
// (Finnhub batch + TastyTrade chains + xAI sentiment on the top-9). The 15-min
// in-memory cache is NOT a per-user brake: it is keyed (limit, universe) only,
// refresh=true bypasses it, and the SSE stream path never reads it — every
// stream request runs the full pipeline.
//
// This is a SEPARATE bucket from ai:${userId} (ai-rate-limit.ts) on purpose:
// one scan run is far heavier than one LLM call (a whole pipeline of paid
// fetches), so sharing the 30/hr AI bucket would either starve interactive AI
// use or under-cap scans. Same durable rateLimit() helper, scan-specific key —
// no new limiter shape invented.
//
// Env-tunable, mirroring ai-rate-limit.ts (AI_RATE_LIMIT / AI_RATE_WINDOW) and
// rateLimit.ts's searchRateLimitDefaults pattern, so Alex can retune without a
// deploy.
//
// ⚠️ PROPOSED DEFAULTS — pending Alex's ruling. No scan-rate precedent existed
// to mirror; 4 runs / hour / user aligns with the 15-minute cache cadence (data
// refreshes at most every 15 min, so >4 fresh runs/hr buys no new information)
// while capping a runaway loop at 4 full pipeline runs instead of unbounded
// paid-API spend. Adjust via SCAN_RATE_LIMIT / SCAN_RATE_WINDOW, or change the
// constants below.
const SCAN_RATE_LIMIT_DEFAULT = 4;
const SCAN_RATE_WINDOW_DEFAULT = 3600; // seconds (1 hour)

function scanRateDefaults(): { limit: number; windowSeconds: number } {
  const limit = parseInt(process.env.SCAN_RATE_LIMIT || '', 10);
  const windowSeconds = parseInt(process.env.SCAN_RATE_WINDOW || '', 10);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : SCAN_RATE_LIMIT_DEFAULT,
    windowSeconds: Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : SCAN_RATE_WINDOW_DEFAULT,
  };
}

/**
 * Per-user run quota for the scan/convergence pipeline. Returns a 429
 * NextResponse (with Retry-After) when the user has exceeded the window, else
 * null (caller proceeds). Call AFTER requireTabAccess('tab:trade') and BEFORE
 * runPipeline fires — cache hits stay free (don't consume quota) and no paid
 * call fires on an over-quota request. Fail-loud: a non-RateLimitError from
 * the durable counter rethrows — never a default-allow past the quota.
 */
export async function requireScanRateLimit(userId: string): Promise<NextResponse | null> {
  const { limit, windowSeconds } = scanRateDefaults();
  try {
    await rateLimit(`scan:${userId}`, { limit, windowSeconds });
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Scan run limit reached — please wait before running another scan.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }
}
