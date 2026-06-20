import { prisma } from '@/lib/prisma';

// ─── Claude Code Routine daily-fire cap kill-switch (PHASE3-1) ────────────────
// Mirrors the production-proven pipeBudget.ts (itself a clone of travelSearchQuota).
// A SEPARATE meter from requirePipeBudget: the pipe cap guards the app's
// ANTHROPIC_API_KEY calls (research / fusion), whereas a Claude Code Routine run
// hits Alex's Claude ACCOUNT (~15/day shared Routine quota) — a different bill. So
// every Routine /fire (the auto CC-audit, PHASE3-2) must go through
// requireRoutineBudget(userId) BEFORE the fire. It increments a durable per-(UTC
// date + user) counter and fails LOUD — RoutineBudgetError — when the daily cap is
// crossed. No silent fallback: over cap = throw → no Routine is fired. This is the
// prerequisite that stops an auto-loop exhausting the Routine quota.
//
// Cap: AI_ROUTINE_DAILY_CAP env (a positive integer) wins, else
// DEFAULT_ROUTINE_DAILY_CAP. Kept below the ~15/day shared quota by default; tune
// AI_ROUTINE_DAILY_CAP before enabling any unwatched/auto-firing loop.

const DEFAULT_ROUTINE_DAILY_CAP = 10;
const WARN_RATIO = 0.8;

export class RoutineBudgetError extends Error {
  constructor(
    public userId: string,
    public callCount: number,
    public cap: number,
  ) {
    super(`Routine daily limit reached — ${callCount}/${cap} runs used today`);
    this.name = 'RoutineBudgetError';
  }
}

function currentDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** The per-user daily cap. AI_ROUTINE_DAILY_CAP env (positive int) → DEFAULT_ROUTINE_DAILY_CAP. */
export function dailyCap(): number {
  const env = parseInt(process.env.AI_ROUTINE_DAILY_CAP || '', 10);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_ROUTINE_DAILY_CAP;
}

/** Today's Routine usage for a user — for an admin/usage view. */
export async function getRoutineUsage(userId: string): Promise<{
  usageDate: string; userId: string; callCount: number; cap: number; pct: number;
}> {
  const usageDate = currentDate();
  const row = await prisma.operations_routine_usage.findUnique({
    where: { usageDate_userId: { usageDate, userId } },
  });
  const callCount = row?.callCount ?? 0;
  const cap = dailyCap();
  return { usageDate, userId, callCount, cap, pct: cap > 0 ? Math.round((callCount / cap) * 100) : 0 };
}

/** Atomically reserve one Routine fire against today's per-user cap. Throws
 *  RoutineBudgetError when the cap is crossed. Warns once at the 80% mark. Call this
 *  BEFORE firing a Claude Code Routine (the auto CC-audit). */
export async function requireRoutineBudget(userId: string): Promise<void> {
  const usageDate = currentDate();
  const cap = dailyCap();
  const row = await prisma.operations_routine_usage.upsert({
    where: { usageDate_userId: { usageDate, userId } },
    update: { callCount: { increment: 1 } },
    create: { usageDate, userId, callCount: 1 },
  });
  if (row.callCount > cap) {
    throw new RoutineBudgetError(userId, row.callCount, cap);
  }
  if (row.callCount === Math.floor(cap * WARN_RATIO)) {
    console.warn(`[RoutineBudget] user ${userId} at ${Math.round(WARN_RATIO * 100)}% of daily cap (${row.callCount}/${cap})`);
  }
}
