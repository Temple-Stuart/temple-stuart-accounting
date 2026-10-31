import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { validatedAffiliateUrl } from '@/config/affiliates';
import { findDestinationId, searchProductsRaw } from '@/lib/viatorClient';
import { cityForViatorDestId, findViatorDestIdFor } from '@/lib/destinations';
import { ACTIVITY_SEARCH_CURRENCY, activitySearchBodyOf, parseActivityFilters } from '@/lib/activities/searchContract';
import { activityCardsOf, type RawProductSearch } from '@/lib/activities/products';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { MissingViatorKeyError, ViatorApiError } from '@/lib/travelErrors';

// ─── PUBLIC activity SEARCH (PR-A1; ACTIVITY-01, 2026-09-22) ─────────────────
// Net-new public route, guarded EXACTLY like the public hotel search
// (src/app/api/travel/hotels/search/route.ts). Open to all visitors — there is
// NO auth gate. Cost is bounded by TWO guards that run BEFORE the Viator call,
// on every path:
//   1. rateLimit(ip) — per-IP burst defense (429 + Retry-After when exceeded).
//   2. reserveTravelSearch('viator') — durable daily spend cap (503 when hit).
// If EITHER guard throws, control jumps straight to catch and returns 429/503 —
// the vendor call below is never reached. Param validation sits between the two
// guards so a malformed (400) request can't consume a daily-cap slot; both
// guards still precede the provider call, rate-limit first.
//
// ACTIVITY-01 — THE ROUTE FORWARDS THE VENDOR'S CONTRACT. The query carries
// Viator's own /products/search filters, sort, count and start (price range,
// rating, duration, flags; sort + order; count; the start cursor — SHOW THEM ALL,
// the founder's ruling: the pages reveal the vendor's whole totalCount, no client
// cap), validated BY NAME between the guards
// (src/lib/activities/searchContract.ts): an unknown name is a 400 naming it, a
// bad value a 400 naming it, an absent one is not sent so the vendor's default
// applies. The currency is sent from the contract's ONE constant (no plan
// column carries a currency); the answer's own currency rides every card. ONE
// vendor call (searchProductsRaw) returns the answer as sent, and the pure leaf
// (src/lib/activities/products.ts) reads it tri-state — nothing here re-sorts,
// drops an unrated product, or collapses a 0 price. The old path (the client's
// rating×log re-sort and rating≤0 drop) is off this route; the transfers route
// and the planner keep theirs.
//
// The destination: the static verified map first (findViatorDestIdFor — skips
// the rate-limited /destinations call for the known cities); a city the map
// does not hold resolves through the client's dynamic lookup INSIDE the one
// reservation (as before); a city Viator does not know is a 404 naming it,
// never an empty list dressed as an answer.
//
// AFFILIATE LOCK — REVERSED FOR ACTIVITIES ONLY (PR-CHIP-1, Alex's ruling,
// 2026-08-03): the card's productUrl ships ONLY after validatedAffiliateUrl
// (https + viator.com + our partner id — src/config/affiliates.ts); a URL that
// fails is null on the card and the screen says "no booking link stated by the
// operator". The transfers route's stripping is UNTOUCHED.

export async function GET(request: NextRequest) {
  // Client IP for the rate-limit key. A missing/absent header still gets limited
  // against a shared 'unknown' key — the guard is NEVER skipped.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`activity-search:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const params = request.nextUrl.searchParams;

    const city = params.get('city');
    const country = params.get('country');

    if (!city || !country) {
      return NextResponse.json(
        { error: 'Missing required params: city, country' },
        { status: 400 }
      );
    }

    // ACTIVITY-01: the vendor's own contract, validated by name between the guards.
    const parsed = parseActivityFilters([...params.keys()], (n) => params.get(n));
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const filters = parsed.filters;

    // GUARD 2 — daily provider spend cap, immediately before the provider call.
    await reserveTravelSearch('viator');

    // PROVIDER CALL — only reachable after BOTH guards passed.
    console.log(`[Viator] Searching activities: ${city}, ${country}`);

    // The destination id: the static VERIFIED map first (skips the rate-limited
    // /destinations call for the known cities), else the client's dynamic lookup.
    const destId = findViatorDestIdFor(city) ?? await findDestinationId(city, country);
    if (destId === null) {
      return NextResponse.json({ error: `Viator lists no destination for "${city}" — the search was not sent.` }, { status: 404 });
    }

    const asOf = new Date().toISOString();
    const raw = await searchProductsRaw(activitySearchBodyOf(String(destId), filters));
    const { cards, totalCount } = activityCardsOf(raw as RawProductSearch, {
      validateUrl: (u) => validatedAffiliateUrl(u, 'viator'),
      destinationNameOf: cityForViatorDestId,
    });

    return NextResponse.json({
      cards,
      count: cards.length,
      totalCount,
      // SHOW THEM ALL: the page this answer is — the vendor's start (1-based) as sent, else its default 1.
      start: filters.start ?? 1,
      currency: ACTIVITY_SEARCH_CURRENCY,
      asOf,
    });

  } catch (error) {
    // Guard rejections map to their own statuses BEFORE the generic 500 — the
    // provider call was never made on these paths.
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many searches — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Activity search is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    // The vendor's failure, in a fixed line: the endpoint and the status — never
    // the vendor's response body (HYG-02).
    if (error instanceof ViatorApiError) {
      return NextResponse.json({ error: `Viator answered ${error.status} on ${error.endpoint} — no results.`, source: 'viator', status: error.status }, { status: 502 });
    }
    if (error instanceof MissingViatorKeyError) {
      return NextResponse.json({ error: 'No Viator key is configured — no results.', source: 'viator', kind: 'missing_key' }, { status: 502 });
    }
    return failClosedResponse('Activity search', 'Activity search failed', error);
  }
}
