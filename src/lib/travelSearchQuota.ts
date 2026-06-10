import { prisma } from '@/lib/prisma';

// ─── Travel SEARCH daily spend-cap kill-switch ───────────────────────────────
// Cloned from the production-proven googlePlacesQuota.ts (the $1k-bleed guard).
// Every real (uncached) provider SEARCH call must go through reserveTravelSearch()
// BEFORE the provider fetch. It increments a durable per-(UTC date + provider)
// counter and fails LOUD — TravelSearchQuotaError — when the daily cap is crossed.
// No silent fallback: over cap = throw. Built before any search route goes public
// (PR-3 wires it into flights/search); a bot cannot run up a bill past the cap.
//
// Caps come from env: TRAVEL_SEARCH_DAILY_CAP_<PROVIDER> (e.g. _DUFFEL) wins, else
// TRAVEL_SEARCH_DAILY_CAP, else DEFAULT_DAILY_CAP. Set conservatively from each
// provider's real pricing (see audit-reports/PUBLIC-TRAVEL-SEARCH-AUDIT.md).

const DEFAULT_DAILY_CAP = 1000;
const WARN_RATIO = 0.8;

/** Providers whose SEARCH calls are metered. String is accepted too (forward-compat). */
export type TravelProvider = 'duffel' | 'liteapi' | 'viator' | 'mozio';

export class TravelSearchQuotaError extends Error {
  constructor(
    public provider: string,
    public callCount: number,
    public cap: number,
  ) {
    super(`Travel search daily quota exceeded for ${provider} — bill protection active`);
    this.name = 'TravelSearchQuotaError';
  }
}

function currentDate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Per-provider daily cap. TRAVEL_SEARCH_DAILY_CAP_<PROVIDER> overrides the
 *  global TRAVEL_SEARCH_DAILY_CAP, which overrides DEFAULT_DAILY_CAP. */
export function dailyCap(provider: string): number {
  const perProvider = parseInt(process.env[`TRAVEL_SEARCH_DAILY_CAP_${provider.toUpperCase()}`] || '', 10);
  if (Number.isFinite(perProvider) && perProvider > 0) return perProvider;
  const global = parseInt(process.env.TRAVEL_SEARCH_DAILY_CAP || '', 10);
  return Number.isFinite(global) && global > 0 ? global : DEFAULT_DAILY_CAP;
}

/** Today's usage for a provider — for an admin/usage view. */
export async function getTravelSearchUsage(provider: string): Promise<{
  searchDate: string; provider: string; callCount: number; cap: number; pct: number;
}> {
  const searchDate = currentDate();
  const row = await prisma.travel_search_usage.findUnique({
    where: { searchDate_provider: { searchDate, provider } },
  });
  const callCount = row?.callCount ?? 0;
  const cap = dailyCap(provider);
  return { searchDate, provider, callCount, cap, pct: cap > 0 ? Math.round((callCount / cap) * 100) : 0 };
}

/** Atomically reserve one provider search call against today's cap. Throws
 *  TravelSearchQuotaError when the cap is reached. Warns once at the 80% mark.
 *  PR-3 calls this immediately before each real (uncached) provider search. */
export async function reserveTravelSearch(provider: TravelProvider | string): Promise<void> {
  const searchDate = currentDate();
  const cap = dailyCap(provider);
  const row = await prisma.travel_search_usage.upsert({
    where: { searchDate_provider: { searchDate, provider } },
    update: { callCount: { increment: 1 } },
    create: { searchDate, provider, callCount: 1 },
  });
  if (row.callCount > cap) {
    throw new TravelSearchQuotaError(provider, row.callCount, cap);
  }
  if (row.callCount === Math.floor(cap * WARN_RATIO)) {
    console.warn(`[TravelSearch] ${provider} usage at ${Math.round(WARN_RATIO * 100)}% of daily cap (${row.callCount}/${cap})`);
  }
}
