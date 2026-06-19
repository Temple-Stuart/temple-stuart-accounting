import { prisma } from '@/lib/prisma';

// ─── AI pipe daily spend-cap kill-switch (COST-GUARD-1) ──────────────────────
// Mirrors the production-proven travelSearchQuota.ts (the durable daily-cap guard).
// Every PAID pipe call (research / fusion / evolve / design / stateless create-form)
// must go through requirePipeBudget(userId) AFTER auth, BEFORE the paid call. It
// increments a durable per-(UTC date + user) counter and fails LOUD — PipeBudgetError
// — when the daily cap is crossed. No silent fallback: over cap = throw → the route
// returns 429 and NO paid token is spent. This is the prerequisite that stops an
// auto-firing loop running up the Anthropic bill past the cap.
//
// Cap: AI_PIPE_DAILY_CAP env (a positive integer) wins, else DEFAULT_PIPE_DAILY_CAP.
// Tune AI_PIPE_DAILY_CAP before enabling any unwatched/auto-firing loop.

const DEFAULT_PIPE_DAILY_CAP = 20;
const WARN_RATIO = 0.8;

export class PipeBudgetError extends Error {
  constructor(
    public userId: string,
    public callCount: number,
    public cap: number,
  ) {
    super(`AI pipe daily limit reached — ${callCount}/${cap} calls used today`);
    this.name = 'PipeBudgetError';
  }
}

function currentDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** The per-user daily cap. AI_PIPE_DAILY_CAP env (positive int) → DEFAULT_PIPE_DAILY_CAP. */
export function dailyCap(): number {
  const env = parseInt(process.env.AI_PIPE_DAILY_CAP || '', 10);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_PIPE_DAILY_CAP;
}

/** Today's pipe usage for a user — for an admin/usage view. */
export async function getPipeUsage(userId: string): Promise<{
  usageDate: string; userId: string; callCount: number; cap: number; pct: number;
}> {
  const usageDate = currentDate();
  const row = await prisma.operations_ai_pipe_usage.findUnique({
    where: { usageDate_userId: { usageDate, userId } },
  });
  const callCount = row?.callCount ?? 0;
  const cap = dailyCap();
  return { usageDate, userId, callCount, cap, pct: cap > 0 ? Math.round((callCount / cap) * 100) : 0 };
}

/** Atomically reserve one pipe paid-call against today's per-user cap. Throws
 *  PipeBudgetError when the cap is crossed. Warns once at the 80% mark. Call this
 *  immediately AFTER auth and BEFORE each real paid pipe call. */
export async function requirePipeBudget(userId: string): Promise<void> {
  const usageDate = currentDate();
  const cap = dailyCap();
  const row = await prisma.operations_ai_pipe_usage.upsert({
    where: { usageDate_userId: { usageDate, userId } },
    update: { callCount: { increment: 1 } },
    create: { usageDate, userId, callCount: 1 },
  });
  if (row.callCount > cap) {
    throw new PipeBudgetError(userId, row.callCount, cap);
  }
  if (row.callCount === Math.floor(cap * WARN_RATIO)) {
    console.warn(`[PipeBudget] user ${userId} at ${Math.round(WARN_RATIO * 100)}% of daily cap (${row.callCount}/${cap})`);
  }
}
