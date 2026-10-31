import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { rateLimit } from '@/lib/rateLimit';
import { searchPlacesMultiQuery } from '@/lib/placesSearch';
import { isCacheFresh, getCachedPlaces, cachePlaces } from '@/lib/placesCache';
import { reserveTravelSearch } from '@/lib/travelSearchQuota';
import { getCOAScanQueries } from '@/lib/travelCOA';
import { CATEGORY_SEARCH_PROVIDER, MAX_RESULTS, categorySearch } from '@/lib/places/categorySearch';

// ─── CACHED category search (Google Places, trip-scan engine) — SELL-05 ──────
// Fires N proven category queries via searchPlacesMultiQuery (the SAME engine + mappings the
// trip-page scan uses, from TRAVEL_COA / getCOAScanQueries). No invented queries. Minimal
// fields mapped for the card only. The decision lives in src/lib/places/categorySearch.ts.
//
// Gate: a SIGNED-IN USER. No tier (the 'placesSearch' tier gated on a plan nothing sells —
// every customer was 403 forever) and no per-category key (nothing sells those either).
//
// Cost control by construction (bounds the N calls):
//   - RATE-LIMIT: per-IP burst defense (429 on exceed) — unchanged.
//   - CACHE-FIRST: a fresh (city, country, category) bucket in places_cache returns with
//     ZERO Google calls and reserves nothing (PLACES_CACHE_TTL_DAYS).
//   - DAILY CAP: one reservation per uncached search against the travel-search daily cap
//     (TRAVEL_SEARCH_DAILY_CAP, provider 'googleplaces' — TRAVEL_SEARCH_DAILY_CAP_GOOGLEPLACES
//     overrides), declared as a 429 when hit.
//   - MONTHLY BILL-CAP: every Google call under searchPlacesMultiQuery routes through
//     googleFetch → GOOGLE_PLACES_MONTHLY_CAP, declared as a 429 when hit (it was a 500).
//   - NO Place Details / Photos fan-out here — those are details-on-tap.
//   - NO fallback: any other Google/cache error is the fixed fail-closed line (logged).

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  try {
    const out = await categorySearch(
      {
        findUser: (email) => prisma.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
        burst: (key) =>
          rateLimit(`places-category:${key}`, {
            limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
            windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
          }),
        cacheFresh: isCacheFresh,
        cached: getCachedPlaces,
        reserveDaily: () => reserveTravelSearch(CATEGORY_SEARCH_PROVIDER),
        queriesFor: (category) => getCOAScanQueries(category, []),
        search: (queries, city, country) => searchPlacesMultiQuery(queries, city, country, MAX_RESULTS, undefined),
        store: cachePlaces,
      },
      { viewer: await getVerifiedEmail(), ip, body: await request.json().catch(() => ({})) },
    );
    return NextResponse.json(out.body, { status: out.status, headers: out.headers });
  } catch (error) {
    // FAIL LOUD — the real Google/cache error is logged server-side; the client gets the fixed line, never placeholder data.
    return failClosedResponse('Category search', 'Category search failed', error);
  }
}
