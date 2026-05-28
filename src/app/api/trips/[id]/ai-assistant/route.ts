import { requireTier } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchPlacesMultiQuery, CATEGORY_SEARCHES, formatPriceLevel } from '@/lib/placesSearch';
import { getCachedPlaces, cachePlaces, isCacheFresh } from '@/lib/placesCache';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ACTIVITY_SEARCH_EXPANSIONS, ACTIVITY_LABELS } from '@/lib/activities';
import { TRAVEL_COA, getCOAScanQueries } from '@/lib/travelCOA';
import { isViatorCategory, searchViatorProducts, viatorProductToRecommendation } from '@/lib/viatorClient';
import { googleFetch, GooglePlacesQuotaError } from '@/lib/googlePlacesQuota';

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
  if (!apiKey) return places;

  return Promise.all(
    places.slice(0, limit).map(async (p) => {
      if (p.website) return p;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.placeId}&fields=website&key=${apiKey}`;
        const res = await googleFetch(url);
        const data = await res.json();
        return { ...p, website: data.result?.website || '' };
      } catch {
        return p;
      }
    })
  );
}

// Accepts a single category per request — either a CATEGORY_SEARCHES key
// (lodging, brunchCoffee, etc.) or an interest slug (surf, temples, etc.).
// Client iterates categories and calls this endpoint once per category.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      category,
      maxResults: rawMaxResults,
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    // Accept COA keys, legacy CATEGORY_SEARCHES keys, or interest slugs
    const isCOACategory = !!TRAVEL_COA[category];
    const isLegacyCategory = !!CATEGORY_SEARCHES[category];
    const isInterestCategory = !!ACTIVITY_SEARCH_EXPANSIONS[category];
    if (!category || (!isCOACategory && !isLegacyCategory && !isInterestCategory)) {
      return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
    }

    const maxResults = rawMaxResults || 33;
    const { id: tripId } = await params;

    // Activities passed explicitly with the request (used only to expand the
    // search queries — there is no traveler profile).
    const tripActivities: string[] = [
      ...(activities.length > 0 ? activities : (activity ? [activity] : [])),
    ].filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i);

    console.log(`[Scanner] ${category}: Starting search for ${city}, ${country}`);

    // ─── Viator path: bookable activities/experiences (skip Google entirely) ──
    if (isViatorCategory(category) && process.env.VIATOR_API_KEY) {
      console.log(`[Viator] ${category}: Using Viator API for ${city}, ${country}`);
      try {
        const viatorProducts = await searchViatorProducts(city, country, category, tripActivities, maxResults);

        if (viatorProducts.length === 0) {
          console.log(`[Viator] ${category}: 0 products, falling through to Google Places`);
        } else {
          const viatorResults = viatorProducts.map((p, idx) => {
            const rec = viatorProductToRecommendation(p, category, 'midrange');
            return { ...rec, valueRank: idx + 1 };
          });

          const finalResults = viatorResults
            .sort((a, b) => b.compositeScore - a.compositeScore)
            .slice(0, maxResults);

          console.log(`[Viator] ${category}: ${finalResults.length} results`);

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
        }
      } catch (viatorErr) {
        console.error(`[Viator] ${category} error, falling back to Google Places:`, viatorErr);
      }
    }

    // ─── Google Places path (no AI, no profile) ──────────────────────────────
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
    if (err instanceof GooglePlacesQuotaError) {
      return NextResponse.json(
        { error: 'Google Places monthly quota exceeded — bill protection active' },
        { status: 429 }
      );
    }
    console.error('Travel scan error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 }
    );
  }
}
