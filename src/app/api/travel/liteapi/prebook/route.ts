import { NextRequest, NextResponse } from 'next/server';
import { prebookRate } from '@/lib/liteapiClient';
import { MissingLiteApiKeyError, LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';

// POST /api/travel/liteapi/prebook  — PUBLIC (PR-G2: guest booking).
// Body: { offerId, usePaymentSdk? }   (tripId no longer required — prebook is a
// stateless offer quote; it persists nothing.) Open to logged-out guests AND
// account users alike. Since auth no longer protects it, the public-paid guards
// are MANDATORY and run BEFORE the LiteAPI call:
//   1. rateLimit('hotel-prebook:'+ip) — tighter than search (429 + Retry-After).
//   2. reserveTravelSearch('hotelprebook') — durable daily cap (503 when hit).
// Booking ITSELF (the spend + persistence) is the /book route; this only quotes.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // GUARD 1 — per-IP rate limit (tight; before anything else).
    await rateLimit(`hotel-prebook:${ip}`, { limit: 5, windowSeconds: 60 });

    let body: { offerId?: string; usePaymentSdk?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { offerId, usePaymentSdk } = body;
    if (!offerId) {
      return NextResponse.json({ error: 'offerId is required' }, { status: 400 });
    }

    // GUARD 2 — durable daily cap, immediately before the LiteAPI call.
    await reserveTravelSearch('hotelprebook');

    const prebook = await prebookRate({ offerId, usePaymentSdk });
    // Return the prebook payload as-is — client uses transactionId + secretKey
    // to drive the LiteAPI Payment SDK in the browser (PR-B2/G3). Sensitive bits
    // (secretKey) are scoped to this single prebook session, time-limited by LiteAPI.
    return NextResponse.json({ prebook });
  } catch (err) {
    // Guard rejections map to their own statuses BEFORE the provider errors — the
    // prebookRate call was never reached on these paths.
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } }
      );
    }
    if (err instanceof TravelSearchQuotaError) {
      return NextResponse.json(
        { error: 'Booking is temporarily paused. Please try again later.' },
        { status: 503 }
      );
    }
    if (err instanceof MissingLiteApiKeyError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'missing_key', mode: err.mode },
        { status: 500 }
      );
    }
    if (err instanceof LiteApiError) {
      return NextResponse.json(
        { error: err.message, source: 'liteapi', kind: 'api_error', status: err.status },
        { status: 502 }
      );
    }
    console.error('[LiteAPI prebook] unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prebook failed' },
      { status: 500 }
    );
  }
}
