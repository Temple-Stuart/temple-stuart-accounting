import { NextRequest, NextResponse } from 'next/server';
import { getCountries } from '@/lib/liteapiClient';
import { LiteApiError } from '@/lib/travelErrors';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';

// ─── PUBLIC location list — countries (PR-loc-1) ─────────────────────────────
// Feeds the hotel picker's country dropdown. Public (no auth) but rate-limited
// per IP. This is a cheap LIST call (not a paid hotel search) → no
// reserveTravelSearch; only the per-IP burst guard. Fail-loud on a provider
// error — never a faked/partial list.
//
// (Caching note: the country list is static-ish; an in-memory/edge cache is a
//  future option — not over-built here. A simple per-request fetch is fine.)
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    await rateLimit(`locations-countries:${ip}`, {
      limit: Number(process.env.SEARCH_RATE_LIMIT) || 10,
      windowSeconds: Number(process.env.SEARCH_RATE_WINDOW) || 60,
    });

    const countries = await getCountries();
    return NextResponse.json({ countries });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests — please slow down and try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }
      );
    }
    if (error instanceof LiteApiError) {
      return NextResponse.json(
        { error: 'Could not load the country list right now. Please try again later.' },
        { status: 502 }
      );
    }
    console.error('Countries list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load countries' },
      { status: 500 }
    );
  }
}
