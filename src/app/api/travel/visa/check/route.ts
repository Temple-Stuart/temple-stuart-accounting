import { NextRequest, NextResponse } from 'next/server';
import { getVisaRequirement } from '@/lib/travelBuddyClient';
import { MissingVisaKeyError, TravelBuddyApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC visa CHECK (PR-V2) ───────────────────────────────────────────────
// Net-new public route, guarded EXACTLY like the public activity/hotel searches.
// Open to all visitors — visa requirements are FREE PUBLIC VALUE, so there is NO
// auth gate. Cost is bounded by TWO guards that run BEFORE the Travel Buddy call,
// on every path:
//   1. rateLimit(ip) — per-IP burst defense (429 + Retry-After when exceeded).
//   2. reserveTravelSearch('travelbuddy') — durable daily spend cap (503 when hit).
// If EITHER guard throws, control jumps straight to catch and returns 429/503 —
// getVisaRequirement() below is never reached. Param validation sits between the
// two guards so a malformed (400) request can't consume a daily-cap slot; both
// guards still precede the provider call, rate-limit first.
//
// CAP IS THE CRITICAL GUARD HERE: the Travel Buddy free tier is TINY (~120–200
// requests per MONTH). dailyCap('travelbuddy') defaults to a safe ~5/day
// (travelSearchQuota.ts) and is the real bill/allowance protection — set
// TRAVEL_SEARCH_DAILY_CAP_TRAVELBUDDY only when on a paid plan.
export async function GET(request: NextRequest) {
  // Client IP for the rate-limit key. A missing/absent header still gets limited
  // against a shared 'unknown' key — the guard is NEVER skipped.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`visa-check:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const params = request.nextUrl.searchParams;
    const passport = params.get('passport')?.trim().toUpperCase();
    const destination = params.get('destination')?.trim().toUpperCase();
    const ISO2 = /^[A-Z]{2}$/;

    if (!passport || !destination || !ISO2.test(passport) || !ISO2.test(destination)) {
      return NextResponse.json(
        { error: 'Missing or invalid params: passport, destination (both ISO-2 country codes, e.g. US, ID)' },
        { status: 400 }
      );
    }
    // The provider 422s on identical passport/destination — reject up front so a
    // junk request can't burn a (tiny) daily-cap slot.
    if (passport === destination) {
      return NextResponse.json(
        { error: 'passport and destination must be different countries' },
        { status: 400 }
      );
    }

    // GUARD 2 — daily provider spend cap, immediately before the provider call.
    await reserveTravelSearch('travelbuddy');

    // PROVIDER CALL — only reachable after BOTH guards passed.
    console.log(`[TravelBuddy] Visa check: ${passport} → ${destination}`);

    const visa = await getVisaRequirement(passport, destination);
    return NextResponse.json(visa);

  } catch (error) {
    // Guard rejections map to their own statuses BEFORE the provider errors.
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many checks — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Visa lookups are temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    // Provider key not configured → the feature is unavailable (not the user's
    // fault). Surface as 503, never a fake "no requirement" default.
    if (error instanceof MissingVisaKeyError) {
      return NextResponse.json(
        { error: 'Visa lookup is unavailable right now. Please try again later.' },
        { status: 503 }
      );
    }
    // Map the provider's own HTTP status: 422 invalid input → 400, 404 no data →
    // 404, anything else (auth/quota/5xx/unexpected body) → 502 bad-gateway.
    if (error instanceof TravelBuddyApiError) {
      if (error.status === 422) {
        return NextResponse.json(
          { error: 'Invalid passport/destination for a visa lookup.' },
          { status: 400 }
        );
      }
      if (error.status === 404) {
        return NextResponse.json(
          { error: 'No visa data is available for this passport/destination pair.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'The visa data provider returned an error. Please try again later.' },
        { status: 502 }
      );
    }
    console.error('Visa check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Visa check failed' },
      { status: 500 }
    );
  }
}
