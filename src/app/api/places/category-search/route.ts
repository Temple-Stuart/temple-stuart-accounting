import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTier } from '@/lib/auth-helpers';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { searchPlacesMultiQuery } from '@/lib/placesSearch';
import { isCacheFresh, getCachedPlaces, cachePlaces, type CachedPlace } from '@/lib/placesCache';
import { getEntitledCategories } from '@/lib/entitlements';
import { GOOGLE_CATEGORY_KEYS } from '@/lib/categoryKeys';
import { getCOAScanQueries } from '@/lib/travelCOA';

// ─── PAID + CACHED category search (Google Places, trip-scan engine) ─────────
// Fires N proven category queries via searchPlacesMultiQuery (the SAME engine + mappings the
// trip-page scan uses, from TRAVEL_COA / getCOAScanQueries). No invented queries — mappings
// come from TRAVEL_COA. Minimal fields mapped for card only.
//
// Cost control by construction (bounds the N calls):
//   - PAID WALL: requireTier(user.tier, 'placesSearch') — free tier → 403, no bypass.
//   - PER-CATEGORY ENTITLEMENT GATE: a paying user only reaches Google for categories they've
//     unlocked (admin → all 9). Sits BEFORE any Google/cache call.
//   - CACHE-FIRST: a fresh (city, country, category) bucket in places_cache returns with
//     ZERO Google calls (reuses the existing scan's cache table + helpers, no schema change).
//   - MONTHLY BILL-CAP: every searchPlaces under searchPlacesMultiQuery routes through
//     googleFetch → durable monthly cap (googlePlacesQuota.ts:45-66).
//   - RATE-LIMIT: per-IP burst defense (429 on exceed).
//   - NO Place Details / Photos fan-out here — those are details-on-tap (a later PR). This
//     route never calls getPlaceDetails/enrichPlaceDetails.
//   - NO fallback: on any Google/cache error we surface the REAL error (fail-loud), never
//     placeholder/empty data.

// The 9 canonical category keys — SINGLE SOURCE OF TRUTH (categoryKeys.ts). No parallel list.
const ALLOWED_CATEGORIES: readonly string[] = GOOGLE_CATEGORY_KEYS;

// Top-N after dedup/sort — same arg the trip scan passes to searchPlacesMultiQuery (ai-assistant:446).
const MAX_RESULTS = 60;

// Minimal card — name / place_id / location / rating / price_level / business_status only.
// website/photos/hours are intentionally dropped (details-on-tap, a later PR).
interface CategoryCard {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  // 'OPERATIONAL' from a fresh result (PlaceResult.isOpen); null from the cache, which does not
  // persist business_status (including it would need a schema change — out of scope).
  businessStatus: string | null;
  // PlaceResult does not expose geometry (placesSearch.ts:158-171 omits lat/lng), and the cache
  // only has lat/lng when present. Null where unavailable; never fabricated. (Threading geometry
  // through would require a placesSearch.ts change — out of scope for this PR.)
  location: { lat: number; lng: number } | null;
}

function cachedToCard(p: CachedPlace): CategoryCard {
  return {
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    rating: p.rating,
    reviewCount: p.reviewCount,
    priceLevel: p.priceLevel,
    priceLevelDisplay: p.priceLevelDisplay,
    businessStatus: null,
    location: p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : null,
  };
}

// PlaceResult (searchPlaces output) → minimal card. No website/photos.
function freshToCard(p: {
  placeId: string; name: string; address: string; rating: number; reviewCount: number;
  priceLevel?: number; priceLevelDisplay: string | null; isOpen: boolean;
}): CategoryCard {
  return {
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount ?? null,
    priceLevel: p.priceLevel ?? null,
    priceLevelDisplay: p.priceLevelDisplay ?? null,
    businessStatus: p.isOpen ? 'OPERATIONAL' : null,
    location: null,
  };
}

export async function POST(request: NextRequest) {
  // ── 1 · AUTH — verified cookie or 401 ──
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ── 2 · USER LOOKUP — pattern from ai-assistant/route.ts:128,133 ──
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // ── 3 · PAID WALL — requireTier('placesSearch') → clean 403 (auth-helpers.ts:41-49). No bypass. ──
  const gate = requireTier(user.tier, 'placesSearch', user.id);
  if (gate) return gate;

  // Client IP for the rate-limit key (mirror activities/search/route.ts:37-40).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // ── 4 · RATE LIMIT — per-IP burst defense (429 on exceed) ──
    await rateLimit(`places-category:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    // ── 5 · VALIDATE INPUT ──
    const body = await request.json().catch(() => ({}));
    const category = body?.category;
    const city = typeof body?.city === 'string' ? body.city.trim() : '';
    const country = typeof body?.country === 'string' ? body.country.trim() : '';
    // radius is RESERVED: searchPlaces() uses a fixed 20km radius (placesSearch.ts:107) and takes
    // no radius param; threading it would require editing placesSearch.ts (out of scope). Validated
    // for the forward contract but not yet applied to the Google call. NOT part of the cache key.
    const radius = body?.radius;

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!city || !country) {
      return NextResponse.json({ error: 'Missing required params: city, country' }, { status: 400 });
    }
    if (radius !== undefined && (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0)) {
      return NextResponse.json({ error: 'radius must be a positive number' }, { status: 400 });
    }

    // ── 5b · PER-CATEGORY ENTITLEMENT GATE — the real per-category lock, AFTER category is
    //        validated and BEFORE any paid Google / cache call. Mirrors the proven scan gate
    //        (ai-assistant/route.ts). Admin passes (getEntitledCategories returns all 9 keys for
    //        ADMIN_USER_ID). FAIL-CLOSED: if getEntitledCategories throws, it propagates to the
    //        outer catch → 500, never an open scan. The requireTier('placesSearch') paid wall
    //        above stays (defense in depth). ──
    if ((GOOGLE_CATEGORY_KEYS as readonly string[]).includes(category)) {
      const entitled = await getEntitledCategories(user.id);
      if (!entitled.includes(category)) {
        return NextResponse.json({ error: 'Category not unlocked', category }, { status: 403 });
      }
    }

    // ── 6 · CACHE-FIRST — fresh (city, country, category) bucket → ZERO Google calls ──
    if (await isCacheFresh(city, country, category)) {
      const cached = await getCachedPlaces(city, country, category);
      return NextResponse.json({ results: cached.map(cachedToCard), count: cached.length, cached: true });
    }

    // ── 7 · MISS → fire the proven category queries via searchPlacesMultiQuery — the exact
    //        engine + mappings the trip-page scan uses (getCOAScanQueries / TRAVEL_COA). No
    //        interests on a public destination search → []. Same args as the trip scan
    //        (ai-assistant:446): 60 results, no type filter. Each underlying searchPlaces routes
    //        through googleFetch → monthly cap. NO Place Details. Cache, then minimal cards. ──
    const queries = getCOAScanQueries(category, []);
    const results = await searchPlacesMultiQuery(queries, city, country, MAX_RESULTS, undefined);
    await cachePlaces(results, city, country, category);
    return NextResponse.json({ results: results.map(freshToCard), count: results.length, cached: false });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many searches — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    // FAIL LOUD — surface the real Google/cache/quota error; never substitute placeholder/empty data.
    console.error('Category search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Category search failed' },
      { status: 500 }
    );
  }
}
