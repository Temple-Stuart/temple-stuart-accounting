import { requireTier } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeWithLiveSearch } from '@/lib/grokAgent';
import { searchPlacesMultiQuery, CATEGORY_SEARCHES, formatPriceLevel } from '@/lib/placesSearch';
import { getCachedPlaces, cachePlaces, isCacheFresh } from '@/lib/placesCache';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ACTIVITY_SEARCH_EXPANSIONS, ACTIVITY_LABELS } from '@/lib/activities';

// Trip-type focused profile
interface TravelerProfile {
  tripType: string;
  budget: string;
  priorities: string[];
  dealbreakers: string[];
  groupSize: number;
  vibe?: string[];
  pace?: string;
  activities?: string[];
  travelerDescriptions?: string[];
}

const BUDGET_LABELS: Record<string, string> = {
  'under50': 'Under $50/night',
  'backpacker': '$0-50/night',
  '50to100': '$50-100/night',
  'budget': '$50-100/night',
  '100to200': '$100-200/night',
  'midrange': '$100-200/night',
  '200to400': '$200-400/night',
  'comfort': '$200-350/night',
  'over400': '$400+/night',
  'premium': '$350-500/night',
  'luxury': '$500+/night',
};

// Budget tier ordering for range calculation
const BUDGET_ORDER = ['backpacker', 'under50', 'budget', '50to100', 'midrange', '100to200', 'comfort', '200to400', 'premium', 'over400', 'luxury'];

function mergeBudgets(budgets: string[]): string {
  if (budgets.length === 0) return 'midrange';
  if (budgets.length === 1) return budgets[0];
  const indices = budgets.map(b => BUDGET_ORDER.indexOf(b)).filter(i => i >= 0);
  if (indices.length === 0) return budgets[0];
  const minBudget = BUDGET_ORDER[Math.min(...indices)];
  const maxBudget = BUDGET_ORDER[Math.max(...indices)];
  return `${BUDGET_LABELS[minBudget] || minBudget} to ${BUDGET_LABELS[maxBudget] || maxBudget}`;
}

// ─── Budget & Vibe Mappings ──────────────────────────────────────────────────

const BUDGET_MAX_PRICE_LEVEL: Record<string, number> = {
  backpacker: 1, under50: 1,
  budget: 2, '50to100': 2,
  midrange: 3, '100to200': 3,
  comfort: 3, '200to400': 3,
  premium: 4, over400: 4, luxury: 4,
};

const BUDGET_LODGING_KEYWORDS: Record<string, string> = {
  backpacker: 'hostel budget cheap backpacker',
  budget: 'budget guesthouse affordable hotel',
  midrange: 'hotel mid-range three-star',
  comfort: 'boutique hotel comfortable upscale',
  premium: 'premium hotel resort four-star',
  luxury: 'luxury resort five-star',
};

const VIBE_QUERY_MODIFIERS: Record<string, string[]> = {
  chill: ['peaceful', 'quiet', 'serene', 'laid-back'],
  spontaneous: ['unique', 'quirky', 'unexpected'],
  offbeat: ['hidden gem', 'local favorite', 'off beaten path'],
  touristy: ['popular', 'must-see', 'famous'],
  local: ['authentic', 'traditional', 'local'],
  splurge: ['luxury', 'premium', 'high-end'],
};

// ─── Composite Score ─────────────────────────────────────────────────────────
// Mandate Fit (40%) + Quality (35%) + Budget Fit (25%)

function computeCompositeScore(
  fitScore: number,
  rating: number,
  reviewCount: number,
  priceLevel: number | null,
  budgetKey: string,
): number {
  // Mandate Fit (40%): from AI fitScore (1-10 → 0-100)
  const mandateFit = Math.min(100, (fitScore || 5) * 10);

  // Quality (35%): rating × log10(reviewCount), normalized to 0-100
  const rawQuality = (rating || 0) * Math.log10(Math.max(reviewCount || 1, 1));
  const quality = Math.min(100, (rawQuality / 15) * 100);

  // Budget Fit (25%): price level vs budget expectation
  let budgetFit = 75; // default when no price data
  if (priceLevel != null && priceLevel > 0) {
    const maxPL = BUDGET_MAX_PRICE_LEVEL[budgetKey] ?? 3;
    const diff = Math.abs(priceLevel - maxPL);
    budgetFit = diff === 0 ? 100 : diff === 1 ? 50 : 0;
  }

  return Math.round(mandateFit * 0.4 + quality * 0.35 + budgetFit * 0.25);
}

// Enrich places with website from Place Details API
async function enrichPlaceDetails(places: any[]): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return places;

  const enriched = await Promise.all(
    places.slice(0, 60).map(async (p) => {
      if (p.website) return p;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.placeId}&fields=website&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        return { ...p, website: data.result?.website || '' };
      } catch {
        return p;
      }
    })
  );
  return enriched;
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
      month,
      year,
      daysTravel,
      minRating = 4.0,
      minReviews = 50,
      maxPriceLevel,
      category,
      profile,
      maxResults: rawMaxResults,
    } = body;

    if (!city || !country) {
      return NextResponse.json({ error: 'City and country required' }, { status: 400 });
    }

    // Accept legacy CATEGORY_SEARCHES keys OR interest slugs from ACTIVITY_SEARCH_EXPANSIONS
    const isLegacyCategory = !!CATEGORY_SEARCHES[category];
    const isInterestCategory = !!ACTIVITY_SEARCH_EXPANSIONS[category];
    if (!category || (!isLegacyCategory && !isInterestCategory)) {
      return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
    }

    const maxResults = rawMaxResults || (category === 'lodging' ? 10 : 5);
    const { id: tripId } = await params;

    // Load ALL participants to build combined profile
    const allParticipants = await prisma.trip_participants.findMany({
      where: { tripId },
      select: {
        firstName: true,
        profileTripType: true,
        profileBudget: true,
        profilePriorities: true,
        profileVibe: true,
        profilePace: true,
        profileActivities: true,
      },
    });

    // Merge all participant profiles
    const allActivities = [...new Set(
      allParticipants.flatMap(p => p.profileActivities || [])
    )];
    const allPriorities = [...new Set(
      allParticipants.flatMap(p => p.profilePriorities || [])
    )];
    const allVibes = [...new Set(
      allParticipants.flatMap(p => p.profileVibe || [])
    )];
    const paces = allParticipants.map(p => p.profilePace).filter(Boolean) as string[];
    const combinedPace = paces.length === 0 ? 'balanced' :
      paces.length === 1 ? paces[0] :
      paces.every(p => p === paces[0]) ? paces[0] : 'balanced';
    const budgets = allParticipants.map(p => p.profileBudget).filter(Boolean) as string[];

    // Build per-traveler descriptions for the Grok prompt
    const travelerDescriptions = allParticipants
      .filter(p => p.profileTripType)
      .map(p => {
        const acts = (p.profileActivities || []).map(a => ACTIVITY_LABELS[a] || a).join(', ');
        const vibes = (p.profileVibe || []).join(', ');
        return `${p.firstName}: ${p.profileTripType}, interests: ${acts || 'none specified'}. Budget: ${BUDGET_LABELS[p.profileBudget || ''] || p.profileBudget || 'unset'}. Vibe: ${vibes || 'unset'}`;
      });

    const tripActivities = [
      ...(activities.length > 0 ? activities : (activity ? [activity] : [])),
      ...allActivities,
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // Use combined profile (merged from all participants), falling back to request body profile
    const travelerProfile: TravelerProfile = {
      tripType: profile?.tripType || allParticipants.find(p => p.profileTripType)?.profileTripType || 'relaxation',
      budget: profile?.budget || (budgets.length > 0 ? budgets[0] : '100to200'),
      priorities: allPriorities.length > 0 ? allPriorities : (profile?.priorities || ['best_value']),
      dealbreakers: profile?.dealbreakers || [],
      groupSize: profile?.groupSize || allParticipants.length || 1,
      vibe: allVibes.length > 0 ? allVibes : profile?.vibe,
      pace: combinedPace,
      activities: allActivities,
      travelerDescriptions,
    };

    // Skip nightlife for family trips (check if ANY participant is family)
    const anyFamily = allParticipants.some(p => p.profileTripType === 'family');
    if ((travelerProfile.tripType === 'family' || anyFamily) && category === 'nightlife') {
      return NextResponse.json({ category, recommendations: [] });
    }

    console.log(`[Grok AI] ${category}: Starting analysis for ${city}, ${country}`);

    // ─── Build search queries ────────────────────────────────────────────────
    let queries: string[] = [];

    if (isLegacyCategory) {
      // Legacy category: lodging, brunchCoffee, dinner, activities, etc.
      queries = [...CATEGORY_SEARCHES[category].queries];

      if (category === 'lodging') {
        // Customize lodging queries based on trip type
        if (travelerProfile.tripType === 'family' || anyFamily) {
          queries = ['family hotel resort apartment'];
        } else if (travelerProfile.tripType === 'romantic') {
          queries = ['boutique hotel romantic resort'];
        } else if (travelerProfile.tripType === 'solo') {
          queries = ['hostel guesthouse budget hotel'];
        } else if (travelerProfile.tripType === 'friends') {
          queries = ['villa apartment hostel group accommodation'];
        } else if (travelerProfile.tripType === 'remote_work') {
          queries = ['hotel coworking coliving digital nomad'];
        }

        // Add budget-specific lodging keywords
        const budgetKw = BUDGET_LODGING_KEYWORDS[travelerProfile.budget];
        if (budgetKw && !queries.some(q => q.includes(budgetKw.split(' ')[0]))) {
          queries.push(budgetKw);
        }
      }

      // Expand queries based on combined participant interests (legacy behavior)
      for (const act of allActivities) {
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
      // Interest-based category — use ACTIVITY_SEARCH_EXPANSIONS queries
      const expansions = ACTIVITY_SEARCH_EXPANSIONS[category] || [];
      for (const exp of expansions) {
        queries.push(...exp.queries);
      }
      // Fallback: use the interest label as a search term
      if (queries.length === 0) {
        queries.push(ACTIVITY_LABELS[category] || category);
      }
    }

    // Add vibe modifiers to queries
    for (const vibe of (travelerProfile.vibe || [])) {
      const mods = VIBE_QUERY_MODIFIERS[vibe];
      if (mods && mods.length > 0) {
        queries.push(mods.join(' '));
      }
    }

    // ─── Fetch & filter places ───────────────────────────────────────────────
    let enriched: any[] = [];
    const cacheIsFresh = await isCacheFresh(city, country, category);

    if (cacheIsFresh) {
      enriched = await getCachedPlaces(city, country, category);
      console.log(`[Grok AI] ${category}: ${enriched.length} cached places`);
    } else {
      console.log(`[Grok AI] ${category}: Cache miss — running ${queries.length} queries`);
      const places = await searchPlacesMultiQuery(queries, city, country, 60);
      enriched = await enrichPlaceDetails(places);
      await cachePlaces(enriched, city, country, category);
      console.log(`[Grok AI] ${category}: Cached ${enriched.length} places`);
    }

    let filtered = enriched.filter(p => p.rating >= minRating && p.reviewCount >= minReviews);

    // Apply price level filter from request (manual override)
    if (maxPriceLevel) {
      filtered = filtered.filter(p => !p.priceLevel || p.priceLevel <= maxPriceLevel);
    }

    // Budget-based price filter for lodging (auto-applied unless manual override set)
    if (category === 'lodging' && !maxPriceLevel) {
      const budgetMaxPL = BUDGET_MAX_PRICE_LEVEL[travelerProfile.budget];
      if (budgetMaxPL) {
        filtered = filtered.filter(p => !p.priceLevel || p.priceLevel <= budgetMaxPL);
      }
    }

    // Send more places to Grok than maxResults so it has room to rank
    const grokLimit = Math.min(maxResults * 2, 20);
    const placesToAnalyze = filtered.slice(0, grokLimit).map(p => ({
      name: p.name,
      address: p.address,
      rating: p.rating,
      reviewCount: p.reviewCount,
      website: p.website || undefined,
      photoUrl: p.photos?.[0] || undefined,
      priceLevel: p.priceLevel ?? null,
      priceLevelDisplay: p.priceLevelDisplay || formatPriceLevel(p.priceLevel) || null,
      category
    }));

    console.log(`[Grok AI] ${category}: ${placesToAnalyze.length} places after filter`);

    if (placesToAnalyze.length === 0) {
      return NextResponse.json({ category, recommendations: [] });
    }

    // Single Grok call for this one category
    const monthName = month ? new Date(year || 2025, month - 1).toLocaleString('en-US', { month: 'long' }) : undefined;

    // Build budget label — show range if multiple budgets
    const budgetLabel = budgets.length > 1
      ? mergeBudgets(budgets)
      : BUDGET_LABELS[travelerProfile.budget] || "$100-200/night";

    // Build traveler context for Grok prompt
    const travelerContext = travelerDescriptions.length > 0
      ? `\nTravelers in this group:\n${travelerDescriptions.map(d => `- ${d}`).join('\n')}\nRank recommendations considering ALL travelers' interests. A good recommendation appeals to at least one traveler. Ideal recommendations appeal to multiple.`
      : undefined;

    // For interest categories, tell Grok what specific interest we're searching for
    const interestLabel = isInterestCategory ? (ACTIVITY_LABELS[category] || category) : undefined;
    const categoryForPrompt = isInterestCategory
      ? `${interestLabel} (${ACTIVITY_SEARCH_EXPANSIONS[category]?.[0]?.category || 'activities'})`
      : category;

    const recommendations = await analyzeWithLiveSearch({
      places: placesToAnalyze,
      destination: `${city}, ${country}`,
      activities: isInterestCategory ? [category, ...tripActivities] : tripActivities,
      profile: {
        tripType: travelerProfile.tripType,
        budget: budgetLabel,
        priorities: travelerProfile.priorities,
        dealbreakers: travelerProfile.dealbreakers,
        groupSize: travelerProfile.groupSize,
        vibe: (travelerProfile.vibe || []).join(', ') || undefined,
        pace: travelerProfile.pace || undefined,
        travelerContext,
      },
      category: categoryForPrompt,
      month: monthName,
      year: year,
    });

    console.log(`[Grok AI] ${category}: ${recommendations.length} results from AI`);

    // ─── Score, sort, and limit results ──────────────────────────────────────
    const scored = recommendations.map((rec: any) => ({
      ...rec,
      compositeScore: computeCompositeScore(
        rec.fitScore,
        rec.googleRating,
        rec.reviewCount,
        rec.priceLevel,
        travelerProfile.budget,
      ),
    }));

    const finalResults = scored
      .sort((a: any, b: any) => b.compositeScore - a.compositeScore)
      .slice(0, maxResults);

    console.log(`[Grok AI] ${category}: ${finalResults.length} final results`);

    // Persist scanner results for sharing with trip participants
    try {
      await prisma.trip_scanner_results.upsert({
        where: {
          tripId_destination_category: { tripId, destination: `${city}, ${country}`, category },
        },
        update: {
          recommendations: finalResults as any,
          scannedBy: userEmail,
          minRating,
          minReviews,
          profileSnapshot: travelerProfile as any,
          updatedAt: new Date(),
        },
        create: {
          tripId,
          destination: `${city}, ${country}`,
          category,
          recommendations: finalResults as any,
          scannedBy: userEmail,
          minRating,
          minReviews,
          profileSnapshot: travelerProfile as any,
        },
      });
    } catch (saveErr) {
      console.error(`[Grok AI] Failed to save scanner results for ${category}:`, saveErr);
      // Non-fatal — still return results even if save fails
    }

    return NextResponse.json({ category, recommendations: finalResults });

  } catch (err) {
    console.error('Grok AI Assistant error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
