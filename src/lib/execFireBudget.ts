import { prisma } from '@/lib/prisma';

// ─── Execute-Task Routine daily-fire cap kill-switch (EXEC-1) ─────────────────
// Mirrors the production-proven routineFireBudget.ts (the audit Routine cap). A
// SEPARATE meter: each Execute-Task Routine /fire (build a change + open a PR) hits
// Alex's Claude ACCOUNT, distinct from BOTH the pipe's ANTHROPIC_API_KEY calls AND
// the audit Routine meter. So every exec /fire (EXEC-2) must go through
// requireExecBudget(userId) BEFORE the fire. It increments a durable per-(UTC date +
// user) counter and fails LOUD — ExecBudgetError — when the daily cap is crossed. No
// silent fallback: over cap = throw → no Routine is fired.
//
// Cap: AI_EXEC_DAILY_CAP env (a positive integer) wins, else DEFAULT_EXEC_DAILY_CAP.
// Default kept low (build+PR is the heaviest, most consequential fire); tune
// AI_EXEC_DAILY_CAP before enabling any unwatched/auto-firing loop.

const DEFAULT_EXEC_DAILY_CAP = 5;
const WARN_RATIO = 0.8;

export class ExecBudgetError extends Error {
  constructor(
    public userId: string,
    public callCount: number,
    public cap: number,
  ) {
    super(`Execution daily limit reached — ${callCount}/${cap} runs used today`);
    this.name = 'ExecBudgetError';
  }
}

function currentDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** The per-user daily cap. AI_EXEC_DAILY_CAP env (positive int) → DEFAULT_EXEC_DAILY_CAP. */
export function dailyCap(): number {
  const env = parseInt(process.env.AI_EXEC_DAILY_CAP || '', 10);
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_EXEC_DAILY_CAP;
}

/** Today's execution usage for a user — for an admin/usage view. */
export async function getExecUsage(userId: string): Promise<{
  usageDate: string; userId: string; callCount: number; cap: number; pct: number;
}> {
  const usageDate = currentDate();
  const row = await prisma.operations_exec_usage.findUnique({
    where: { usageDate_userId: { usageDate, userId } },
  });
  const callCount = row?.callCount ?? 0;
  const cap = dailyCap();
  return { usageDate, userId, callCount, cap, pct: cap > 0 ? Math.round((callCount / cap) * 100) : 0 };
}

/** Atomically reserve one Execute-Task Routine fire against today's per-user cap.
 *  Throws ExecBudgetError when the cap is crossed. Warns once at the 80% mark. Call
 *  this BEFORE firing the Execute-Task Routine. */
export async function requireExecBudget(userId: string): Promise<void> {
  const usageDate = currentDate();
  const cap = dailyCap();
  const row = await prisma.operations_exec_usage.upsert({
    where: { usageDate_userId: { usageDate, userId } },
    update: { callCount: { increment: 1 } },
    create: { usageDate, userId, callCount: 1 },
  });
  if (row.callCount > cap) {
    throw new ExecBudgetError(userId, row.callCount, cap);
  }
  if (row.callCount === Math.floor(cap * WARN_RATIO)) {
    console.warn(`[ExecBudget] user ${userId} at ${Math.round(WARN_RATIO * 100)}% of daily cap (${row.callCount}/${cap})`);
  }
}
