import { NextRequest, NextResponse } from 'next/server';
import { getHotelContent } from '@/lib/liteapiClient';
import { LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// ─── PUBLIC hotel CONTENT (PR-RC1) ───────────────────────────────────────────
// Rich hotel content (photo gallery, description, important info / T&C, amenities,
// address, stars) for the guest checkout panel. Open to all visitors — NO auth.
// This is a PAID LiteAPI call (B-5100 COGS), so unlike the free location lists it
// is guarded by BOTH a per-IP rate-limit AND a durable daily cap that run BEFORE
// the LiteAPI call, on every path:
//   1. rateLimit('hotel-content:'+ip) — per-IP burst defense (429 + Retry-After).
//   2. reserveTravelSearch('hotelcontent') — durable daily COGS cap (503 when hit).
// If either guard throws, getHotelContent() below is never reached. Fail-loud:
// LiteApiError → 502; no faked/partial content on error.
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (before anything else).
    await rateLimit(`hotel-content:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const hotelId = request.nextUrl.searchParams.get('hotelId')?.trim();
    if (!hotelId) {
      return NextResponse.json({ error: 'hotelId is required' }, { status: 400 });
    }

    // GUARD 2 — durable daily COGS cap, immediately before the paid call.
    await reserveTravelSearch('hotelcontent');

    const content = await getHotelContent(hotelId);
    return NextResponse.json({ content });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Hotel details are temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: 'Could not load hotel details right now. Please try again later.' },
        { status: 502 }
      );
    }
    console.error('Hotel content error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load hotel details' },
      { status: 500 }
    );
  }
}
