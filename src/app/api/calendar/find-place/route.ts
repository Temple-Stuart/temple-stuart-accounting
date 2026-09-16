import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { googleFetch, getGoogleUsage, GooglePlacesQuotaError } from '@/lib/googlePlacesQuota';
import { MissingGoogleKeyError, GooglePlacesApiError } from '@/lib/travelErrors';
import {
  textSearchUrl, readMatches, capResetsOn, remainingCalls, MAX_PLACE_MATCHES,
  type FindPlaceResult,
} from '@/lib/calendar/findPlace';

/**
 * GEO-01 — "Find this place." ONE Google Places Text Search per request, and
 * this route is the ONLY place a calendar event's coordinates are ever looked
 * up. It runs when the person presses the button — never on a keystroke, never
 * on blur, never on submit, never on an edit.
 *
 * THE BILL. The call goes through `googleFetch` (googlePlacesQuota.ts:63),
 * which atomically increments a monthly counter and THROWS past
 * GOOGLE_PLACES_MONTHLY_CAP (default 5000). That guard exists because, as its
 * own header records, "the $1k bleed was un-guarded Google spend." This route
 * adds exactly one call site to it and reports the remaining headroom on every
 * answer so the person can see what they are spending.
 *
 * GET /api/calendar/find-place?q=<text>
 *   200 { query, matches[], status, usage }   — up to 5 matches, NONE selected
 *   400 a query is required
 *   401 unauthorized
 *   429 the monthly cap is reached — with the reset date; the typed name still saves
 *   502 Google refused (REQUEST_DENIED, INVALID_REQUEST, …) — named, never "0 results"
 *   503 no API key is configured
 *
 * COMPLIANCE (googlePlacesQuota.ts:9-10): Google Places data is returned
 * straight to the user. No AI step, here or downstream.
 */

export async function GET(request: NextRequest) {
  const email = await getVerifiedEmail();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const query = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (!query) return NextResponse.json({ error: 'Type a place name first, then press Find this place.' }, { status: 400 });
  if (query.length > 200) return NextResponse.json({ error: 'A place name is at most 200 characters.' }, { status: 400 });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    const e = new MissingGoogleKeyError();
    return NextResponse.json({ error: `Place search is unavailable: ${e.message}.`, kind: e.kind }, { status: 503 });
  }

  // The bias, from what the app ALREADY holds: the North Star's current-location
  // LABEL (schema:3663). There is no current-location coordinate anywhere in the
  // schema, and turning the label into one would need a second metered call —
  // so the label rides in the query text, which costs nothing.
  const northStar = await prisma.operations_north_star.findUnique({
    where: { user_id: user.id },
    select: { current_location_label: true },
  });
  const near = northStar?.current_location_label ?? null;

  // Read the cap BEFORE spending, so a 429 can name the headroom it refused at.
  const before = await getGoogleUsage();
  if (before.callCount >= before.cap) {
    return NextResponse.json({
      error: 'Place search is at its monthly cap.',
      usage: { callCount: before.callCount, cap: before.cap, remaining: 0, resetsOn: capResetsOn() },
    }, { status: 429 });
  }

  let data: Record<string, unknown>;
  try {
    // THE ONE CALL. Quota-guarded, counted before it is issued.
    const res = await googleFetch(textSearchUrl(query, apiKey, near));
    data = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof GooglePlacesQuotaError) {
      return NextResponse.json({
        error: 'Place search is at its monthly cap.',
        usage: { callCount: err.callCount, cap: err.cap, remaining: 0, resetsOn: capResetsOn() },
      }, { status: 429 });
    }
    // A network failure is NAMED, never returned as an empty result list.
    const e = new GooglePlacesApiError('NETWORK_ERROR', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: e.message, kind: e.kind }, { status: 502 });
  }

  const status = typeof data.status === 'string' ? data.status : 'UNKNOWN_ERROR';
  // ZERO_RESULTS is a real answer — nothing matched. Everything else non-OK is
  // a refusal (billing off, key restricted, malformed query) and says so.
  if (status !== 'OK' && status !== 'ZERO_RESULTS') {
    const e = new GooglePlacesApiError(status, typeof data.error_message === 'string' ? data.error_message : undefined);
    return NextResponse.json({ error: e.message, status, kind: e.kind }, { status: 502 });
  }

  // The call is spent either way, so the headroom is read back after it.
  const after = await getGoogleUsage();
  const body: FindPlaceResult = {
    query,
    matches: readMatches(data.results, MAX_PLACE_MATCHES),
    status,
    usage: {
      callCount: after.callCount,
      cap: after.cap,
      remaining: remainingCalls(after.callCount, after.cap),
      resetsOn: capResetsOn(),
    },
  };
  return NextResponse.json(body);
}
