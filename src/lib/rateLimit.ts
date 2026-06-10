import { prisma } from '@/lib/prisma';

// ─── Durable per-key request rate-limiter (fixed-window) ─────────────────────
// NET-NEW: the app had no rate-limiter. This throttles how many calls one key
// (the client IP, in PR-3) can make in a short window — burst/bot abuse defense,
// SEPARATE from the daily spend cap (travelSearchQuota.ts, the ceiling).
//
// DURABLE BY DESIGN: backed by the rate_limit_hits table, NOT an in-memory Map.
// On Vercel each request can hit a different (and freshly cold) serverless
// instance, and instances reset on every deploy — an in-memory counter would
// reset per lambda/deploy and let a bot fan out across instances without ever
// crossing a limit. A DB-backed (key, window-bucket) counter holds across all
// instances and deploys, mirroring google_places_usage / travel_search_usage.
//
// Fixed-window: count per (key + windowStart bucket). Simple + durable; the
// classic edge-burst is acceptable for bot defense. Old buckets are never read
// again once their window passes (lazy "cleanup" = ignore them); a periodic
// DELETE is a fast-follow, not needed for correctness.
//
// Defaults via env: SEARCH_RATE_LIMIT (default 5) / SEARCH_RATE_WINDOW seconds
// (default 60) → 5 requests / 60s / key. Fail-loud: over limit = throw.

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_SECONDS = 60;

export class RateLimitError extends Error {
  constructor(
    public key: string,
    public count: number,
    public limit: number,
    public retryAfterSeconds: number,
  ) {
    super(`Rate limit exceeded for ${key} — ${count}/${limit} in window`);
    this.name = 'RateLimitError';
  }
}

export interface RateLimitOptions {
  limit?: number;
  windowSeconds?: number;
}

/** Env-tunable defaults (SEARCH_RATE_LIMIT / SEARCH_RATE_WINDOW). */
export function searchRateLimitDefaults(): { limit: number; windowSeconds: number } {
  const limit = parseInt(process.env.SEARCH_RATE_LIMIT || '', 10);
  const windowSeconds = parseInt(process.env.SEARCH_RATE_WINDOW || '', 10);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT,
    windowSeconds: Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds : DEFAULT_WINDOW_SECONDS,
  };
}

/** Atomically count one request for `key` in the current fixed window. Throws
 *  RateLimitError when the key exceeds `limit` within the window. DB-backed, so
 *  it holds across serverless instances + deploys. PR-3 passes the client IP as
 *  `key`. Fail-loud: over limit = throw (caller maps to HTTP 429 + Retry-After). */
export async function rateLimit(key: string, options: RateLimitOptions = {}): Promise<void> {
  const defaults = searchRateLimitDefaults();
  const limit = options.limit ?? defaults.limit;
  const windowSeconds = options.windowSeconds ?? defaults.windowSeconds;

  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % windowSeconds); // bucket start (epoch s)

  const row = await prisma.rate_limit_hits.upsert({
    where: { rlKey_windowStart: { rlKey: key, windowStart } },
    update: { count: { increment: 1 } },
    create: { rlKey: key, windowStart, count: 1 },
  });

  if (row.count > limit) {
    const retryAfterSeconds = Math.max(1, windowStart + windowSeconds - nowSec);
    throw new RateLimitError(key, row.count, limit, retryAfterSeconds);
  }
}

/** Read-only current state for a key (admin/debug). Does NOT increment. */
export async function getRateLimitState(key: string, windowSeconds?: number): Promise<{
  key: string; count: number; limit: number; windowStart: number; windowSeconds: number;
}> {
  const defaults = searchRateLimitDefaults();
  const win = windowSeconds ?? defaults.windowSeconds;
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - (nowSec % win);
  const row = await prisma.rate_limit_hits.findUnique({
    where: { rlKey_windowStart: { rlKey: key, windowStart } },
  });
  return { key, count: row?.count ?? 0, limit: defaults.limit, windowStart, windowSeconds: win };
}
