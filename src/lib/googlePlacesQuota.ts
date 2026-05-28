import { prisma } from '@/lib/prisma';

// ─── Google Places hard bill-protection guard ───────────────────────────────
// The $1k bleed was un-guarded Google spend. EVERY outbound Google Places/Maps
// call must go through `googleFetch` here. It increments a monthly counter and
// fails LOUD when the cap is crossed — no silent fallback. The cap is set by
// GOOGLE_PLACES_MONTHLY_CAP (default 5000 calls/month).
//
// COMPLIANCE: per Google Places API terms, do NOT pipe Google Places data to
// any AI/LLM. This pipe returns Google data straight to the user — no AI step.

const DEFAULT_CAP = 5000;
const WARN_RATIO = 0.8;

export class GooglePlacesQuotaError extends Error {
  constructor(public callCount: number, public cap: number) {
    super('Google Places monthly quota exceeded — bill protection active');
    this.name = 'GooglePlacesQuotaError';
  }
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthlyCap(): number {
  const raw = parseInt(process.env.GOOGLE_PLACES_MONTHLY_CAP || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CAP;
}

/** Current month's usage — for the admin/usage view. */
export async function getGoogleUsage(): Promise<{
  yearMonth: string; callCount: number; cap: number; pct: number;
}> {
  const yearMonth = currentYearMonth();
  const row = await prisma.google_places_usage.findUnique({ where: { yearMonth } });
  const callCount = row?.callCount ?? 0;
  const cap = monthlyCap();
  return { yearMonth, callCount, cap, pct: Math.round((callCount / cap) * 100) };
}

/** Atomically reserve one Google call. Throws GooglePlacesQuotaError when the
 *  cap is reached. Warns once at the 80% threshold. */
async function reserveCall(): Promise<void> {
  const yearMonth = currentYearMonth();
  const cap = monthlyCap();
  const row = await prisma.google_places_usage.upsert({
    where: { yearMonth },
    update: { callCount: { increment: 1 } },
    create: { yearMonth, callCount: 1 },
  });
  if (row.callCount > cap) {
    throw new GooglePlacesQuotaError(row.callCount, cap);
  }
  if (row.callCount === Math.floor(cap * WARN_RATIO)) {
    console.warn(`[GooglePlaces] Usage at ${Math.round(WARN_RATIO * 100)}% of monthly cap (${row.callCount}/${cap})`);
  }
}

/** Quota-guarded fetch for every Google Places/Maps API call. Counts against
 *  the monthly cap before issuing the request; fails loud at the cap. */
export async function googleFetch(url: string, init?: RequestInit): Promise<Response> {
  await reserveCall();
  return fetch(url, init);
}
