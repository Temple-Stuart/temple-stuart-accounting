import { NextRequest, NextResponse } from 'next/server';
import { getCities } from '@/lib/liteapiClient';
import { LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// ─── PUBLIC location list — cities by country (PR-loc-1) ─────────────────────
// Feeds the hotel picker's city dropdown after a country is chosen. Public (no
// auth) but rate-limited per IP. Cheap LIST call (not a paid hotel search) → no
// reserveTravelSearch; only the per-IP burst guard. countryCode is REQUIRED —
// LiteAPI 400s without it. Fail-loud on a provider error — never a faked list.
//
// (Caching note: per-country city lists are static-ish; cache as a future option.)
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    await rateLimit(`locations-cities:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const countryCode = request.nextUrl.searchParams.get('countryCode')?.trim().toUpperCase();
    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      return NextResponse.json(
        { error: 'Missing or invalid param: countryCode (ISO-2 country code, e.g. PT)' },
        { status: 400 }
      );
    }

    const cities = await getCities(countryCode);
    return NextResponse.json({ cities });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: 'Could not load the city list right now. Please try again later.' },
        { status: 502 }
      );
    }
    console.error('Cities list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load cities' },
      { status: 500 }
    );
  }
}
