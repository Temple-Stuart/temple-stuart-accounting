import { NextRequest, NextResponse } from 'next/server';
import { getHotelReviews } from '@/lib/liteapiClient';
import { LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC hotel REVIEWS (PR-RC1) ───────────────────────────────────────────
// Real written guest reviews for the checkout panel. Open to all visitors — NO
// auth. PAID LiteAPI call (B-5100 COGS) → guarded by BOTH a per-IP rate-limit AND
// a durable daily cap, BEFORE the LiteAPI call, on every path:
//   1. rateLimit('hotel-reviews:'+ip) — per-IP burst defense (429 + Retry-After).
//   2. reserveTravelSearch('hotelreviews') — durable daily COGS cap (503 when hit).
// `limit` is bounded (1..20, default 8). Fail-loud: LiteApiError → 502; an API
// error is NEVER returned as an empty list (the client fn throws, we surface it).
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`hotel-reviews:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const params = request.nextUrl.searchParams;
    const hotelId = params.get('hotelId')?.trim();
    if (!hotelId) {
      return NextResponse.json({ error: 'hotelId is required' }, { status: 400 });
    }
    const parsed = parseInt(params.get('limit') || '', 10);
    const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT, 1), MAX_LIMIT);

    // GUARD 2 — durable daily COGS cap, immediately before the paid call.
    await reserveTravelSearch('hotelreviews');

    const reviews = await getHotelReviews(hotelId, { limit });
    return NextResponse.json({ reviews, count: reviews.length });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Reviews are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: 'Could not load reviews right now. Please try again later.' },
        { status: 502 }
      );
    }
    console.error('Hotel reviews error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load reviews' },
      { status: 500 }
    );
  }
}
