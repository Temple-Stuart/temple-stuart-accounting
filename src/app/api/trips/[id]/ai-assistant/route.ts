import { requireTier } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchPlacesMultiQuery, CATEGORY_SEARCHES, formatPriceLevel } from '@/lib/placesSearch';
import { getCachedPlaces, cachePlaces, isCacheFresh } from '@/lib/placesCache';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ACTIVITY_SEARCH_EXPANSIONS, ACTIVITY_LABELS } from '@/lib/activities';
import { TRAVEL_COA, getCOAScanQueries } from '@/lib/travelCOA';
import { searchViatorProducts, viatorProductToRecommendation } from '@/lib/viatorClient';
import { findViatorDestIdFor, findDestinationCoords } from '@/lib/destinations';
import { searchHotelRates, liteApiHotelToRecommendation } from '@/lib/liteapiClient';
import { googleFetch, GooglePlacesQuotaError } from '@/lib/googlePlacesQuota';
import {
  MissingGoogleKeyError,
  GooglePlacesApiError,
  MissingViatorKeyError,
  ViatorApiError,
  MissingLiteApiKeyError,
  LiteApiError,
} from '@/lib/travelErrors';
import { getSource, UnimplementedSourceError } from '@/lib/travelSourceRegistry';
import { getCategoryByKey } from '@/lib/travelCategories';

// ─── Travel destination scan ─────────────────────────────────────────────────
// COMPLIANCE: per Google Places API terms, Google Places data is NOT sent to any
// AI/LLM. There is no AI step in this pipe — results come straight from Google,
// ranked by a deterministic quality score, and are displayed Expedia-style with
// user-controlled sorts. (The Viator path is a separate no-AI bookable source.)
//
// COST: every Google call goes through `googleFetch` (monthly cap guard); a fresh
// scan is only run on a cache miss, and the result is cached for the TTL window.

// Map price_level (1-4) to a 0-100 budget-fit-neutral baseline. With no profile
// there is no budget preference, so budget fit is neutral.
function computeQualityScore(rating: number, reviewCount: number): number {
  const rawQuality = (rating || 0) * Math.log10(Math.max(reviewCount || 1, 1));
  return Math.min(100, (rawQuality / 15) * 100);
}

// Deterministic Google-place → result mapping. Mirrors the Viator mapper so the
// trip_scanner_results.recommendations shape is identical regardless of source.
// NOTE: sentiment/fitScore are simple rating-derived values (NOT AI) kept only
// for shape stability; the Expedia-style UI does not surface them.
function placeToRecommendation(p: any, category: string, idx: number) {
  const rating = p.rating || 0;
  const reviewCount = p.reviewCount || 0;
  const priceLevel = p.priceLevel ?? null;
  const quality = computeQualityScore(rating, reviewCount);
  const ratingScore = Math.min(10, Math.round(rating * 2));
  const compositeScore = Math.round(Math.min(100, ratingScore * 10) * 0.5 + quality * 0.5);

  return {
    name: p.name,
    address: p.address,
    website: p.website || null,
    photoUrl: p.photos?.[0] || null,
    priceLevel,
    priceLevelDisplay: p.priceLevelDisplay || formatPriceLevel(priceLevel) || null,
    googleRating: rating,
    reviewCount,
    sentimentScore: ratingScore,
    sentiment: rating >= 4.5 ? 'positive' : rating >= 3.5 ? 'neutral' : 'negative',
    summary: '',
    warnings: [] as string[],
    trending: false,
    fitScore: ratingScore,
    valueRank: idx + 1,
    category,
    compositeScore,
  };
}

// Enrich places with website from Place Details API (quota-guarded). Only the
// results we will actually show get enriched, to bound the call count.
async function enrichPlaceDetails(places: any[], limit: number): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new MissingGoogleKeyError();

  return Promise.all(
    places.slice(0, limit).map(async (p) => {
      if (p.website) return p;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.placeId}&fields=website&key=${apiKey}`;
        const res = await googleFetch(url);
        const data = await res.json();
        // OK, ZERO_RESULTS, NOT_FOUND are non-errors per-place. Anything else
        // (REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST) is a real error
        // we must surface — likely all 33 details calls would fail the same way.
        if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS' && data.status !== 'NOT_FOUND') {
          throw new GooglePlacesApiError(data.status, data.error_message);
        }
        return { ...p, website: data.result?.website || '' };
      } catch (err) {
        // Re-throw typed errors so the whole scan fails loud.
        if (
          err instanceof GooglePlacesQuotaError ||
          err instanceof MissingGoogleKeyError ||
          err instanceof GooglePlacesApiError
        ) {
          throw err;
        }
        // Per-place network blip — soft fail (other places may still enrich).
        return p;
      }
    })
  );
}

// PR-24: a category is "valid" if it exists in any taxonomy this route
// dispatches on — the COA registry, the legacy Google search map, or the
// interest-expansion map (the same three :163-165 validates against). Used to
// decide whether an alias-resolved key is real before adopting it.
function isValidCategory(key: string | undefined): key is string {
  return !!key && (!!TRAVEL_COA[key] || !!CATEGORY_SEARCHES[key] || !!ACTIVITY_SEARCH_EXPANSIONS[key]);
}

// Accepts a single category per request — either a CATEGORY_SEARCHES key
// (lodging, brunchCoffee, etc.) or an interest slug (surf, temples, etc.).
// Client iterates categories and calls this endpoint once per category.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Capture category early so the outer catch can include it in error
  // responses (the request body stream is consumed once and can't be re-read).
  let categoryForError: string | undefined;
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const tierGate = requireTier(user.tier, 'tripAI', user.id);
    if (tierGate) return tierGate;

    const body = await request.json();
    const {
      city,
      country,
      activities = [],
      activity,
      minRating = 4.0,
      minReviews = 50,
      maxPriceLevel,
      category: rawCategory,
      maxResults: rawMaxResults,
      // PR-19: per-location check-in/check-out from the scan row (optional —
      // only the LiteAPI/accommodation path consumes them).
      checkin: bodyCheckin,
      checkout: bodyCheckout,
      // Optional caller override for the LiteAPI coordinate-radius (meters). When
      // absent the client keeps its 25km default — behaviour is identical to before.
      radiusMeters: bodyRadiusMeters,
    } = body;
    // PR-10 Fix 2: alias-resolve legacy category keys before validation so
    // stale client bundles (still sending 'sports_fitness') survive PR-9's
    // rename to 'adventure'. getCategoryByKey() consults travelCategories.ts's
    // ALIASES map (sports_fitness → adventure, sportsFitness → adventure, etc).
    // Downstream code uses `category` (the resolved key) so registry dispatch,
    // scanner_results upserts, and Viator/LiteAPI calls all see the canonical
    // value regardless of what the client sent.
    // PR-24: adopt the alias-resolved key ONLY when it points to a real
    // category. The alias map can resolve a VALID COA key to a dead one — e.g.
    // `ground_transport` → `transport`, which exists in no taxonomy, producing a
    // 400 "Valid category required" on every scan. Preference order:
    //   1. resolved-if-valid  → preserves sports_fitness→adventure,
    //      business_meals→dinner, toiletries→shopping, … (resolved IS valid)
    //   2. raw-if-valid       → keeps ground_transport as ground_transport so it
    //      dispatches to its mozio source → the intended 501 "coming soon"
    //   3. fall through       → truly-unknown keys still hit the 400 below
    // This selects the valid one of two known keys; it is not a data fallback.
    const resolvedCategory = rawCategory ? getCategoryByKey(rawCategory)?.key : undefined;
    const category: string | undefined =
      isValidCategory(resolvedCategory) ? resolvedCategory
      : isValidCategory(rawCategory) ? rawCategory
      : (resolvedCategory || rawCategory);
    categoryForError = category;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    // Accept COA keys, legacy CATEGORY_SEARCHES keys, or interest slugs
    const isCOACategory = !!category && !!TRAVEL_COA[category];
    const isLegacyCategory = !!category && !!CATEGORY_SEARCHES[category];
    const isInterestCategory = !!category && !!ACTIVITY_SEARCH_EXPANSIONS[category];
    if (!category || (!isCOACategory && !isLegacyCategory && !isInterestCategory)) {
      return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
    }

    const maxResults = rawMaxResults || 33;
    const { id: tripId } = await params;

    // SECURITY (PR-5): verify the authed user OWNS this trip BEFORE any paid provider call.
    // The LiteAPI/Viator/Google branches below each fire a paid search AND upsert
    // trip_scanner_results keyed on tripId — none re-checks ownership (the LiteAPI branch even
    // loads the trip by id alone). Without this gate a tier-holder could pass ANOTHER user's
    // tripId and trigger paid work against, and write results onto, a trip they don't own.
    // Defensive 404 (don't confirm existence). Same pattern as the merged IDOR fix
    // (trips/[id]/destinations: trips.findFirst({ id, userId })). trips.userId: schema.prisma.
    const ownedTrip = await prisma.trips.findFirst({
      where: { id: tripId, userId: user.id },
      select: { id: true },
    });
    if (!ownedTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Activities passed explicitly with the request (used only to expand the
    // search queries — there is no traveler profile).
    const tripActivities: string[] = [
      ...(activities.length > 0 ? activities : (activity ? [activity] : [])),
    ].filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i);

    console.log(`[Scanner] ${category}: Starting search for ${city}, ${country}`);

    // ─── Registry dispatch: per-category source routing ──────────────────────
    // Replaces the old hardcoded `if (isViatorCategory && VIATOR_API_KEY)` two-
    // way. See src/lib/travelSourceRegistry.ts. Sources declared in the
    // registry but not yet implemented (liteapi/mozio/covergenius/airalo) fail
    // loud with UnimplementedSourceError — never silently fall back to Google.
    const { source, hardBookable } = getSource(category);

    if (source !== 'google' && source !== 'viator' && source !== 'liteapi') {
      // Declared bookable, provider client not yet wired — fail loud so the
      // user sees "Category X routes to <provider> (not yet connected)"
      // instead of getting unbookable Google POIs masked as bookable inventory.
      throw new UnimplementedSourceError(source, category);
    }

    // ─── LiteAPI path: bookable hotels (accommodation) ───────────────────────
    if (source === 'liteapi') {
      // LiteAPI's /hotels/rates needs check-in/check-out + occupancy, none of
      // which the scan request body carries. Pull them from the trip + its
      // participants — same source of truth the rest of the trip flow uses.
      const trip = await prisma.trips.findFirst({
        where: { id: tripId },
        select: { startDate: true, endDate: true },
      });
      if (!trip?.startDate || !trip?.endDate) {
        throw new Error('Trip dates required for hotel search — set Start/End on the trip first');
      }
      const participantCount = await prisma.trip_participants.count({ where: { tripId } });
      const adults = Math.max(1, participantCount);
      // PR-10 Fix 5 — STOPGAP pending PR-11 per-leg dates.
      // Multi-destination trips currently store ONE startDate/endDate on
      // `trips`; we don't yet have a `trip_destinations.startDate/endDate`
      // schema. For a 185-night trip (Bali → Singapore → Phuket → …) we'd
      // be asking LiteAPI for a property continuously available the full
      // span — almost nothing qualifies, search returns 0–1 hotel, totals
      // come back as e.g. $58k. As an explicit interim, cap the LiteAPI
      // window to the first 7 nights from trip.startDate so the user sees
      // realistic per-stay totals and a populated carousel. PR-11 lands
      // the proper fix: per-destination startDate/endDate on
      // trip_destinations + a per-chip date picker + destinationId
      // plumbing into this route.
      // PR-19: per-location dates supplied by the scan row take precedence.
      // The else-branch stopgap is a CONSCIOUS UX DEFAULT for the untouched case
      // (no per-location dates set) — NOT a silent fallback masking a date the
      // user actually chose. Explicit if/else so that intent is visible.
      let checkin: string;
      let checkout: string;
      if (bodyCheckin && bodyCheckout) {
        checkin = bodyCheckin;
        checkout = bodyCheckout;
      } else {
        // Default: the 7-night stopgap from trip.startDate (PR-10 Fix 5) —
        // realistic per-stay window when the user hasn't set per-location dates.
        const STOPGAP_NIGHTS = 7;
        const stopgapCheckin = new Date(trip.startDate);
        const stopgapCheckout = new Date(stopgapCheckin);
        stopgapCheckout.setDate(stopgapCheckout.getDate() + STOPGAP_NIGHTS);
        checkin = stopgapCheckin.toISOString().slice(0, 10);
        checkout = stopgapCheckout.toISOString().slice(0, 10);
      }

      // PR-9 Fix 5: prefer the catalog's lat/lng over cityName when available.
      // Brittle for parenthesised labels like "Bali (Canggu)" — coord-radius
      // search avoids that whole class of zero-result misses. Falls through
      // to cityName when the destination isn't in the static catalog.
      const coords = findDestinationCoords(city, country);
      console.log(`[LiteAPI] ${category}: ${city}, ${country} (${checkin} → ${checkout}, ${adults} adults)${coords ? ` coords=${coords.lat},${coords.lng}` : ''}`);
      try {
        const hotels = await searchHotelRates({
          city, country, checkin, checkout,
          occupancies: [{ adults }],
          maxResults,
          ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
          ...(bodyRadiusMeters ? { radiusMeters: bodyRadiusMeters } : {}),
        });

        // Rank the FULL mapped set FIRST, then truncate to the best `maxResults`.
        // (The client no longer pre-slices in native order — so a high-scoring
        // hotel at native position 90 now survives to the top of the ranking.)
        const rankedAll = hotels
          .map((h, idx) => liteApiHotelToRecommendation(h, idx, category))
          .sort((a, b) => b.compositeScore - a.compositeScore);
        const finalResults = rankedAll
          .slice(0, maxResults)
          .map((rec, idx) => ({ ...rec, valueRank: idx + 1 }));

        // Completeness instrument: total ranked (X) vs returned (N) per search,
        // so truncation pressure is observable alongside the client's dataLen log.
        console.log(`[LiteAPI] ${category}: ranked=${rankedAll.length} returned=${finalResults.length} (cap=${maxResults})`);
        console.log(`[LiteAPI] ${category}: ${finalResults.length} hotels (hardBookable=${hardBookable})`);

        try {
          await prisma.trip_scanner_results.upsert({
            where: { tripId_destination_category: { tripId, destination: `${city}, ${country}`, category } },
            update: { recommendations: finalResults as any, scannedBy: userEmail, minRating, minReviews, profileSnapshot: undefined, updatedAt: new Date() },
            create: { tripId, destination: `${city}, ${country}`, category, recommendations: finalResults as any, scannedBy: userEmail, minRating, minReviews },
          });
        } catch (saveErr) {
          console.error(`[LiteAPI] Failed to save results for ${category}:`, saveErr);
        }

        return NextResponse.json({ category, recommendations: finalResults });
      } catch (liteApiErr) {
        // hardBookable Accommodation must NOT silently fall back to Google —
        // a Google "hotel POI" isn't bookable through LiteAPI's payment flow.
        // Always rethrow; outer catch maps typed errors to structured HTTP.
        console.error(`[LiteAPI] ${category} error — failing loud:`, liteApiErr);
        throw liteApiErr;
      }
    }

    // ─── Viator path: bookable tours / experiences ───────────────────────────
    if (source === 'viator') {
      if (!process.env.VIATOR_API_KEY) {
        // Fail loud — Viator categories must come from Viator. A missing key
        // is a config issue the user needs to see, not silently routed to Google.
        throw new Error('VIATOR_API_KEY is not configured');
      }
      console.log(`[Viator] ${category}: Using Viator API for ${city}, ${country}`);
      try {
        // PR-8: pass the static viatorDestId for high-traffic cities so
        // searchViatorProducts can skip the rate-limited /partner/destinations
        // call entirely. Returns null for long-tail cities — the dynamic
        // fallback (loadDestinations + in-lambda memo) still kicks in for them.
        const preResolvedDestId = findViatorDestIdFor(city, country);
        // PR-9 Fix 4: lift per-category cap to 250 ("show all") so each Viator
        // carousel has enough distinct inventory to dedupe + sort. Stays
        // inside Viator's 150-req/10s window: ~5 pages × 3 terms × 4
        // categories ≈ 60 calls per scan. See PR-9 audit notes.
        const viatorMax = Math.max(maxResults, 250);
        const viatorProducts = await searchViatorProducts(city, country, category, tripActivities, viatorMax, preResolvedDestId);

        const viatorResults = viatorProducts.map((p, idx) => {
          const rec = viatorProductToRecommendation(p, category, 'midrange');
          return { ...rec, valueRank: idx + 1 };
        });

        const finalResults = viatorResults
          .sort((a, b) => b.compositeScore - a.compositeScore)
          .slice(0, viatorMax);

        console.log(`[Viator] ${category}: ${finalResults.length} results (hardBookable=${hardBookable})`);

        // Persist even when empty — UI needs to know the scan ran for this
        // destination/category and legitimately found nothing (vs "never scanned").
        try {
          await prisma.trip_scanner_results.upsert({
            where: { tripId_destination_category: { tripId, destination: `${city}, ${country}`, category } },
            update: { recommendations: finalResults as any, scannedBy: userEmail, minRating, minReviews, profileSnapshot: undefined, updatedAt: new Date() },
            create: { tripId, destination: `${city}, ${country}`, category, recommendations: finalResults as any, scannedBy: userEmail, minRating, minReviews },
          });
        } catch (saveErr) {
          console.error(`[Viator] Failed to save results for ${category}:`, saveErr);
        }

        return NextResponse.json({ category, recommendations: finalResults });
      } catch (viatorErr) {
        // Combined PR-1 (fail-loud typed errors) + PR-2 (hardBookable) semantics:
        // - hardBookable categories: re-throw EVERYTHING — no Google masking,
        //   because a Google POI in a bookable slot would be unbookable junk.
        // - soft-bookable (none today, kept for the door): re-throw
        //   missing-key/4xx so the user sees the real Viator error; only
        //   swallow transient 5xx/network and fall through to Google.
        if (hardBookable) {
          console.error(`[Viator] ${category} hardBookable error — failing loud:`, viatorErr);
          throw viatorErr;
        }
        if (
          viatorErr instanceof MissingViatorKeyError ||
          (viatorErr instanceof ViatorApiError && viatorErr.status >= 400 && viatorErr.status < 500)
        ) {
          throw viatorErr;
        }
        console.error(`[Viator] ${category} transient error, falling back to Google Places:`, viatorErr);
      }
    }

    // ─── Google Places path (non-bookable / discovery — no AI, no profile) ───
    // Queries are category-driven only. Interests passed with the request expand
    // the query set, but there is no tripType/vibe/budget profile.
    let queries: string[] = [];

    if (isCOACategory) {
      queries = getCOAScanQueries(category, tripActivities);
    } else if (isLegacyCategory) {
      queries = [...CATEGORY_SEARCHES[category].queries];
      for (const act of tripActivities) {
        const expansions = ACTIVITY_SEARCH_EXPANSIONS[act];
        if (!expansions) continue;
        for (const exp of expansions) {
          if (exp.category === category) {
            for (const q of exp.queries) {
              if (!queries.includes(q)) queries.push(q);
            }
          }
        }
      }
    } else {
      const expansions = ACTIVITY_SEARCH_EXPANSIONS[category] || [];
      for (const exp of expansions) queries.push(...exp.queries);
      if (queries.length === 0) queries.push(ACTIVITY_LABELS[category] || category);
    }

    // ─── Fetch & filter places (cache-first) ─────────────────────────────────
    let enriched: any[] = [];
    const cacheIsFresh = await isCacheFresh(city, country, category);

    if (cacheIsFresh) {
      enriched = await getCachedPlaces(city, country, category);
      console.log(`[Scanner] ${category}: ${enriched.length} cached places (0 Google calls)`);
    } else {
      console.log(`[Scanner] ${category}: Cache miss — running ${queries.length} queries`);
      const places = await searchPlacesMultiQuery(queries, city, country, 60, undefined);
      enriched = await enrichPlaceDetails(places, maxResults);
      await cachePlaces(enriched, city, country, category);
      console.log(`[Scanner] ${category}: Cached ${enriched.length} places`);
    }

    let filtered = enriched.filter(p => p.rating >= minRating && p.reviewCount >= minReviews);

    // Manual price-level filter (the only price control now that profile is gone)
    if (maxPriceLevel) {
      filtered = filtered.filter(p => !p.priceLevel || p.priceLevel <= maxPriceLevel);
    }

    // Rank by deterministic quality (rating × review volume) — no AI.
    const finalResults = filtered
      .map((p, idx) => placeToRecommendation(p, category, idx))
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, maxResults)
      .map((rec, idx) => ({ ...rec, valueRank: idx + 1 }));

    console.log(`[Scanner] ${category}: ${finalResults.length} results`);

    // Persist for sharing with trip participants (shape unchanged; no profile).
    try {
      await prisma.trip_scanner_results.upsert({
        where: { tripId_destination_category: { tripId, destination: `${city}, ${country}`, category } },
        update: { recommendations: finalResults as any, scannedBy: userEmail, minRating, minReviews, profileSnapshot: undefined, updatedAt: new Date() },
        create: { tripId, destination: `${city}, ${country}`, category, recommendations: finalResults as any, scannedBy: userEmail, minRating, minReviews },
      });
    } catch (saveErr) {
      console.error(`[Scanner] Failed to save scanner results for ${category}:`, saveErr);
    }

    return NextResponse.json({ category, recommendations: finalResults });

  } catch (err) {
    // Fail-loud error mapping. Every typed provider error gets a structured
    // body so the UI can render a precise banner ("Couldn't load Dinner —
    // Google Places API: REQUEST_DENIED — This API project is not authorized
    // to use this API") instead of a silent 0-results.
    const category = categoryForError;

    if (err instanceof GooglePlacesQuotaError) {
      console.error(`[Scanner] ${category}: Google quota exceeded`);
      return NextResponse.json(
        { error: err.message, source: 'google', kind: 'quota_exceeded', category },
        { status: 429 }
      );
    }
    if (err instanceof MissingGoogleKeyError) {
      console.error(`[Scanner] ${category}: missing Google key`);
      return NextResponse.json(
        { error: err.message, source: 'google', kind: 'missing_key', category },
        { status: 500 }
      );
    }
    if (err instanceof GooglePlacesApiError) {
      console.error(`[Scanner] ${category}: Google API error ${err.status}: ${err.errorMessage}`);
      return NextResponse.json(
        { error: err.message, source: 'google', kind: 'api_error', status: err.status, category },
        { status: 502 }
      );
    }
    if (err instanceof MissingViatorKeyError) {
      console.error(`[Scanner] ${category}: missing Viator key`);
      return NextResponse.json(
        { error: err.message, source: 'viator', kind: 'missing_key', category },
        { status: 500 }
      );
    }
    if (err instanceof ViatorApiError) {
      console.error(`[Scanner] ${category}: Viator API error ${err.status} on ${err.endpoint}`);
      return NextResponse.json(
        { error: err.message, source: 'viator', kind: 'api_error', status: err.status, category },
        { status: 502 }
      );
    }
    if (err instanceof MissingLiteApiKeyError) {
      console.error(`[Scanner] ${category}: missing LiteAPI key (${err.mode})`);
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode, category },
        { status: 500 }
      );
    }
    if (err instanceof LiteApiError) {
      console.error(`[Scanner] ${category}: LiteAPI error ${err.status} on ${err.endpoint}`);
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status, category },
        { status: 502 }
      );
    }
    if (err instanceof UnimplementedSourceError) {
      // Registry declares this category routes to a provider that isn't wired
      // yet. 501 Not Implemented so the UI can render a precise "coming
      // soon" banner per category instead of pretending Google data is bookable.
      console.warn(`[Scanner] ${err.category}: ${err.message}`);
      return NextResponse.json(
        { error: err.message, source: err.source, kind: err.kind, category: err.category },
        { status: 501 }
      );
    }
    console.error('Travel scan error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed', category },
      { status: 500 }
    );
  }
}
