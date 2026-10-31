import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { MissingViatorKeyError, ViatorApiError } from '@/lib/travelErrors';
import { cachedExchangeRate, fetchExchangeRatesRaw, getProductRaw, getScheduleRaw, rememberExchangeRate } from '@/lib/viatorClient';
import { ACTIVITY_SEARCH_CURRENCY } from '@/lib/activities/searchContract';
import { productFactsOf, type RawProduct } from '@/lib/activities/product';
import { extraChargesFor, isDateText, startTimesOn, type RawSchedule } from '@/lib/activities/schedule';
import { isExpired, rateOf, type RateRecord, type RawExchangeRates } from '@/lib/activities/fx';
import { quotesForOption } from '@/lib/activities/quote';
import { sealOf } from '@/lib/activities/quoteSeal';

// ─── AUTHED activity OPTIONS (ACTIVITY-01 STEP 4, 2026-09-22 — the Basic-access path) ──
// Shape A: the reads that price a tour fire ONLY at Save, for a signed-in user, and
// nothing new becomes public — this route is NOT in middleware's PUBLIC_PATHS. The
// key is a Basic-access Affiliate (POST /availability/check answered 403 FORBIDDEN
// "Endpoint access denied"), so the Save reads what that tier reaches:
//   1. GET /products/{code}            — the party form's bands and rules, the zone,
//                                         the option titles, the cancellation policy;
//   2. GET /availability/schedules/{code} — the published start times, the sold-out
//                                         dates, the per-band prices in the SUPPLIER's
//                                         currency, the extra charges;
//   3. POST /exchange-rates            — the vendor's own rate to the plan's currency
//                                         (ACTIVITY_SEARCH_CURRENCY), cached per pair
//                                         until ITS expiry as the docs instruct; skipped
//                                         when the schedule already answers in it.
// Each is ONE call site under src, guarded in this order on every path:
//   getVerifiedEmail → the user (the cart-plan pattern) → the query by name → the
//   per-user rate limit → reserveTravelSearch('viatorsave') immediately before EACH
//   call (three reservations per attempt; the safe cap 300/day, travelSearchQuota.ts).
// A failure is an explicit 502 / 503 / 429 with a fixed reason — never the vendor's
// body (HYG-02). An expired rate the vendor hands back, or a rate it does not
// state, REFUSES by name: nothing is coded around the rate. CHECK-01 replaces this
// path with /availability/check when Full-access is granted.
//
// STEP 4b (2026-09-22): what this route READ, it SEALS. Every bookable pick leaves
// here as a { quote, seal } pair (src/lib/activities/quote.ts, quoteSeal.ts): the
// band unit price that applies on the date and which one it is, the operator's
// limits, the stated zone, duration and cancellation, the supplier's currency, the
// in-destination charge and the vendor's rate with its own expiry — sealed under a
// key derived from JWT_SECRET for THIS user. The browser prices parties against the
// quote and posts it back with its seal and the party; vendor-commit takes NO figure
// from the caller and recomputes the line from the sealed quote alone. Nothing the
// browser can edit reaches the ledger.

const PRODUCT_CODE = /^[A-Za-z0-9]{2,32}$/;

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const params = request.nextUrl.searchParams;
    for (const n of params.keys()) {
      if (n !== 'productCode' && n !== 'date') return NextResponse.json({ error: `${n} is not a supported parameter (supported: productCode, date)` }, { status: 400 });
    }
    const productCode = params.get('productCode') ?? '';
    const date = params.get('date') ?? '';
    if (!PRODUCT_CODE.test(productCode)) return NextResponse.json({ error: 'productCode must be the vendor\'s product code (letters and digits)' }, { status: 400 });
    if (!isDateText(date)) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });

    // The per-user burst guard, before any reservation or vendor call.
    await rateLimit(`activity-options:${user.id}`, { limit: 10, windowSeconds: 60 });

    const now = new Date();
    const asOf = now.toISOString();

    // 1. the product — reserved, then read once.
    await reserveTravelSearch('viatorsave');
    const product = productFactsOf((await getProductRaw(productCode)) as RawProduct);
    if (product.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Viator states product ${productCode} as ${product.status ?? 'status not stated'} — only an ACTIVE product can be saved.`, source: 'viator' }, { status: 502 });
    }

    // 2. the schedule — reserved, then read once.
    await reserveTravelSearch('viatorsave');
    const schedule = (await getScheduleRaw(productCode)) as RawSchedule;
    const currency = typeof schedule.currency === 'string' && schedule.currency.trim() !== '' ? schedule.currency : null;
    if (currency === null) return NextResponse.json({ error: `Viator's schedule for ${productCode} states no currency — nothing can be priced.`, source: 'viator' }, { status: 502 });
    const options = startTimesOn(schedule, date, asOf);
    const extraPerTraveller = extraChargesFor(schedule, 1);

    // 3. the rate — only across currencies; the cache first (until its own expiry), else reserved and read once.
    let rate: RateRecord | null = null;
    let rateFrom: 'cache' | 'vendor' | 'not needed' = 'not needed';
    if (currency !== ACTIVITY_SEARCH_CURRENCY) {
      const cached = cachedExchangeRate(currency, ACTIVITY_SEARCH_CURRENCY, now);
      if (cached) { rate = cached; rateFrom = 'cache'; }
      else {
        await reserveTravelSearch('viatorsave');
        const read = rateOf((await fetchExchangeRatesRaw(currency, ACTIVITY_SEARCH_CURRENCY)) as RawExchangeRates, currency, ACTIVITY_SEARCH_CURRENCY);
        if ('refused' in read) return NextResponse.json({ error: `${read.refused} — nothing can be converted.`, source: 'viator' }, { status: 502 });
        if (isExpired(read, now)) return NextResponse.json({ error: `Viator's ${currency}→${ACTIVITY_SEARCH_CURRENCY} rate had already expired at ${read.expiry} when it was read — no current rate, nothing can be converted; try again later.`, source: 'viator' }, { status: 502 });
        rememberExchangeRate(read);
        rate = read; rateFrom = 'vendor';
      }
    }

    // Every pick the operator publishes, sealed for this user — the pricingDetails
    // stay on the server: the browser gets the unit price that applies, nothing raw.
    const quoted = options.map((option) => ({
      productOptionCode: option.productOptionCode,
      refused: option.refused,
      dayUnavailable: option.dayUnavailable,
      startTimes: quotesForOption(user.id, product, option, date, currency, extraPerTraveller?.perTraveller ?? null, rate, asOf)
        .map((row) => ({ startTime: row.startTime, unavailable: row.unavailable, refused: row.refused, quote: row.quote, seal: row.quote === null ? null : sealOf(row.quote) })),
    }));

    return NextResponse.json({
      product,
      date,
      currency,
      options: quoted,
      extraChargesPerTraveller: extraPerTraveller?.perTraveller ?? null,
      summary: { fromPrice: typeof schedule.summary?.fromPrice === 'number' ? schedule.summary.fromPrice : null },
      rate,
      rateFrom,
      targetCurrency: ACTIVITY_SEARCH_CURRENCY,
      asOf,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: 'Too many availability reads — please slow down and try again shortly.' }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    }
    if (error instanceof TravelSearchQuotaError) {
      return NextResponse.json({ error: 'Tour availability is temporarily paused (the daily cap is reached) — nothing was saved. Please try again later.', source: 'viator' }, { status: 503 });
    }
    if (error instanceof ViatorApiError) {
      return NextResponse.json({ error: `Viator answered ${error.status} on ${error.endpoint} — nothing was saved.`, source: 'viator', status: error.status }, { status: 502 });
    }
    if (error instanceof MissingViatorKeyError) {
      return NextResponse.json({ error: 'No Viator key is configured — nothing was saved.', source: 'viator', kind: 'missing_key' }, { status: 502 });
    }
    return failClosedResponse('Activity options', 'Activity options failed', error);
  }
}
