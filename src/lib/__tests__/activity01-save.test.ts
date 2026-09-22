/**
 * ACTIVITY-01 STEP 4 (2026-09-22) — A TOUR TAKES ITS TIME ON THE DAY, on the
 * Basic-access path: the Save reads the product, the schedule and the vendor's
 * stated rate (POST /availability/check answered 403 FORBIDDEN "Endpoint access
 * denied" — fixtureViatorForbidden.json). The three leaves are probed on the
 * CAPTURED payloads (fixtureViatorProduct.27424p2.json, 2.6 MB, read whole;
 * fixtureViatorSchedule.27424p2.json; fixtureViatorExchangeRates.thb-usd.json;
 * the two search pages); what the options route, the commit and the container DO
 * is asserted from source through the two readers (TEST-TRUTH-01). Derived cases
 * (a record-level unavailable date, a record with no timed entry, a UNIT band, an
 * unknown package type) are built from a captured record and said so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { cancellationStatement, optionTitleOf, partyMeetsProduct, partySize, partyText, productFactsOf, type RawProduct } from '../activities/product';
import { extraChargesFor, partyCost, plusDays, seasonHolds, startTimesOn, weekdayOf, type RawPricingRecord, type RawSchedule } from '../activities/schedule';
import { CALCULATED, RATE_SOURCE, conversionLine, convert, isExpired, rateOf, roundHalfUpCents, type RawExchangeRates } from '../activities/fx';
import { activitySaveNoteOf, endTimeOf, readViatorSave, totalOf, verifyViatorSave, type ViatorSave } from '../activities/save';
import { ACTIVITY_SEARCH_CURRENCY } from '../activities/searchContract';
import { activityCardsOf, countLine, type RawProductSearch } from '../activities/products';
import { validatedAffiliateUrl } from '../../config/affiliates';
import { cityForViatorDestId } from '../destinations';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES } from '../travelBookingFlow';
import { cachedExchangeRate, rememberExchangeRate } from '../viatorClient';
import PRODUCT from './fixtureViatorProduct.27424p2.json';
import SCHEDULE from './fixtureViatorSchedule.27424p2.json';
import RATES from './fixtureViatorExchangeRates.thb-usd.json';
import FORBIDDEN from './fixtureViatorForbidden.json';
import PAGE1 from './fixtureViatorSearch.phuket-thailand.json';
import PAGE2 from './fixtureViatorSearch.phuket-thailand.p51.json';

const OPTIONS_ROUTE = 'src/app/api/travel/activities/options/route.ts';
const SEARCH_ROUTE = 'src/app/api/travel/activities/search/route.ts';
const COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const CLIENT = 'src/lib/viatorClient.ts';
const CONTAINER = 'src/components/trips/PublicActivitySearch.tsx';
const VIEW = 'src/components/trips/ActivityPickerView.tsx';
const PLANNER = 'src/components/trips/TripPlannerAI.tsx';
const STRIP = 'src/components/trips/travelStripModes.tsx';
const QUOTA = 'src/lib/travelSearchQuota.ts';

const product = () => productFactsOf(PRODUCT as unknown as RawProduct);
const schedule = SCHEDULE as unknown as RawSchedule;
const rates = RATES as unknown as RawExchangeRates;
const NOW = new Date('2026-09-22T12:00:00Z');
const AS_OF = NOW.toISOString();
const DATE = '2026-09-23';
const rate = () => { const r = rateOf(rates, 'THB', 'USD'); if ('refused' in r) throw new Error(r.refused); return r; };
const record = (code_: string): RawPricingRecord => schedule.bookableItems!.find((b) => b.productOptionCode === code_)!.seasons![0].pricingRecords![0];

test('the product states the party form, the zone, the option titles, the cancellation and the duration — read from the 2.6 MB capture', () => {
  const p = product();
  assert.equal(p.status, 'ACTIVE'); assert.equal(p.productCode, '27424P2'); assert.equal(p.timeZone, 'Asia/Bangkok'); assert.equal(p.pricingType, 'PER_PERSON');
  assert.deepEqual(p.bands, [
    { ageBand: 'CHILD', startAge: 3, endAge: 12, minTravelersPerBooking: 0, maxTravelersPerBooking: 28 },
    { ageBand: 'ADULT', startAge: 13, endAge: 70, minTravelersPerBooking: 1, maxTravelersPerBooking: 28 },
  ]);
  assert.equal(p.minTravelersPerBooking, 1); assert.equal(p.maxTravelersPerBooking, 28); assert.equal(p.requiresAdultForBooking, true);
  assert.equal(p.options.length, 7); assert.equal(optionTitleOf(p, 'TG14'), 'Small Group Only 20 People'); assert.equal(optionTitleOf(p, 'TG29'), 'Early Bird Small Group Tour'); assert.equal(optionTitleOf(p, 'TGX'), null);
  assert.deepEqual(p.duration, { kind: 'fixed', minutes: 540 });
  assert.equal(cancellationStatement(p), 'STANDARD — For a full refund, cancel at least 24 hours before the scheduled departure time.');
  assert.ok(p.exclusions.includes('National Park Fees 400THB/adult and 200THB/child'), 'the operator itemizes the in-destination charge in its own words');
  assert.deepEqual(partyMeetsProduct(p, { ADULT: 2 }), { ok: true });
  assert.deepEqual(partyMeetsProduct(p, { CHILD: 1 }), { refused: 'ADULT: the operator requires at least 1' });
  assert.deepEqual(partyMeetsProduct(p, { ADULT: 29 }), { refused: 'ADULT: the operator allows at most 28' });
  assert.deepEqual(partyMeetsProduct(p, { ADULT: 1, SENIOR: 1 }), { refused: 'SENIOR: the operator states no such age band' });
  assert.equal(partySize({ ADULT: 2, CHILD: 1 }), 3); assert.equal(partyText({ ADULT: 2, CHILD: 1 }), '2 adults · 1 child');
  // A product that states nothing reads as the operator's silence, and no rule is applied.
  const silent = productFactsOf({ productCode: 'X' });
  assert.equal(silent.timeZone, null); assert.equal(silent.requiresAdultForBooking, null); assert.deepEqual(silent.bands, []); assert.equal(cancellationStatement(silent), 'cancellation policy not stated by the operator');
  assert.doesNotMatch(code('src/lib/activities/product.ts'), /\bfetch\(|process\.env|Asia\/Bangkok/);
});

test('the schedule: start times on a date, a sold-out date refused with the vendor\'s reason verbatim, the open-ended season per the docs\' 384 days', () => {
  assert.equal(weekdayOf(DATE), 'WEDNESDAY'); assert.equal(plusDays('2026-09-22', 384), '2027-10-11');
  const on = startTimesOn(schedule, DATE, AS_OF);
  assert.deepEqual(on.map((o) => o.productOptionCode), ['TG14', 'TG15', 'TG17', 'TG23', 'TG24', 'TG29', 'TG30']);
  const tg14 = on.find((o) => o.productOptionCode === 'TG14')!;
  assert.equal(tg14.refused, null); assert.deepEqual(tg14.startTimes, [{ startTime: '07:30', unavailable: null }]);
  const tg29 = on.find((o) => o.productOptionCode === 'TG29')!;
  assert.deepEqual(tg29.startTimes, [{ startTime: '04:30', unavailable: 'SOLD_OUT' }], 'the entry names the date: the reason verbatim, never mapped');
  const tg30 = on.find((o) => o.productOptionCode === 'TG30')!;
  assert.deepEqual(tg30.startTimes, [{ startTime: '07:30', unavailable: 'SOLD_OUT' }]);
  assert.equal(startTimesOn(schedule, '2026-09-25', AS_OF).find((o) => o.productOptionCode === 'TG29')!.startTimes[0].unavailable, null, 'the 25th is not named');
  // Every captured season states no endDate: it holds 384 days from the read and not a day more.
  assert.equal(seasonHolds(schedule.bookableItems![0].seasons![0], '2027-10-11', '2026-09-22'), true);
  assert.equal(seasonHolds(schedule.bookableItems![0].seasons![0], '2027-10-12', '2026-09-22'), false);
  assert.equal(startTimesOn(schedule, '2027-10-12', AS_OF)[0].refused, 'no season stated by the operator holds 2027-10-12');
  assert.equal(startTimesOn(schedule, '2026-07-01', AS_OF).find((o) => o.productOptionCode === 'TG30')!.refused, 'no season stated by the operator holds 2026-07-01', 'TG30\'s season starts 2026-07-31');
  // Derived from the captured TG14 record: a RECORD-level unavailable date refuses the whole day; a record with no timed entry states no start time.
  const dayOff: RawSchedule = { ...schedule, bookableItems: [{ productOptionCode: 'TG14', seasons: [{ startDate: '2022-02-20', pricingRecords: [{ ...record('TG14'), unavailableDates: [{ date: DATE, reason: 'NOT_OPERATING' }] }] }] }] };
  const off = startTimesOn(dayOff, DATE, AS_OF)[0];
  assert.equal(off.dayUnavailable, 'NOT_OPERATING'); assert.equal(off.refused, 'NOT_OPERATING');
  const untimed: RawSchedule = { ...schedule, bookableItems: [{ productOptionCode: 'TG14', seasons: [{ startDate: '2022-02-20', pricingRecords: [{ ...record('TG14'), timedEntries: undefined }] }] }] };
  assert.equal(startTimesOn(untimed, DATE, AS_OF)[0].refused, `no start time stated by the operator for ${DATE}`);
  assert.doesNotMatch(code('src/lib/activities/schedule.ts'), /\bfetch\(|process\.env|'0[0-9]:[0-9]{2}'|'1[0-9]:[0-9]{2}'|toLocaleTimeString|getTimezoneOffset/);
});

test('the party\'s cost: per band × count, the special price only inside both windows, the extra charges as stated, refusals by name', () => {
  const two = partyCost(record('TG14').pricingDetails!, { ADULT: 2 }, DATE, AS_OF, 'THB');
  assert.ok(!('refused' in two));
  assert.deepEqual(two.lines, [{ ageBand: 'ADULT', count: 2, pricingPackageType: 'PER_PERSON', unitPrice: 3510, basis: 'special', subtotal: 7020 }]);
  assert.equal(two.total, 7020); assert.equal(two.currency, 'THB');
  // Read after the offer window (asOf 2026-10-05) → the original price; a travel date after the travel window → the original.
  const later = partyCost(record('TG14').pricingDetails!, { ADULT: 2 }, DATE, '2026-10-05T00:00:00Z', 'THB');
  assert.ok(!('refused' in later) && later.lines[0].basis === 'original' && later.total === 7800);
  const travelLater = partyCost(record('TG14').pricingDetails!, { ADULT: 1 }, '2026-10-20', AS_OF, 'THB');
  assert.ok(!('refused' in travelLater) && travelLater.lines[0].basis === 'original' && travelLater.total === 3900);
  const family = partyCost(record('TG14').pricingDetails!, { ADULT: 2, CHILD: 1 }, DATE, AS_OF, 'THB');
  assert.ok(!('refused' in family)); assert.equal(family.total, 7020 + 2700, 'the child band states no special price');
  assert.deepEqual(partyCost(record('TG14').pricingDetails!, { SENIOR: 1 }, DATE, AS_OF, 'THB'), { refused: `SENIOR: the operator states no price for this band on ${DATE}` });
  assert.deepEqual(partyCost(record('TG14').pricingDetails!, { ADULT: 0 }, DATE, AS_OF, 'THB'), { refused: 'the party holds no travellers' });
  // Derived: a UNIT band prices per unit; a package type the docs do not name refuses.
  const unit = [{ ...record('TG14').pricingDetails![0], pricingPackageType: 'UNIT' }];
  const u = partyCost(unit, { ADULT: 3 }, DATE, AS_OF, 'THB'); assert.ok(!('refused' in u) && u.total === 3510 * 3 && u.lines[0].pricingPackageType === 'UNIT');
  const odd = [{ ...record('TG14').pricingDetails![0], pricingPackageType: 'PER_GROUP' }];
  assert.deepEqual(partyCost(odd, { ADULT: 1 }, DATE, AS_OF, 'THB'), { refused: 'ADULT: the operator\'s pricing package type "PER_GROUP" is not one this reader prices (PER_PERSON, UNIT)' });
  const capped = [{ ...record('TG14').pricingDetails![0], maxTravelers: 2 }];
  assert.deepEqual(partyCost(capped, { ADULT: 3 }, DATE, AS_OF, 'THB'), { refused: 'ADULT: the operator allows at most 2 for this price' });
  assert.deepEqual(extraChargesFor(schedule, 2), { perTraveller: 400, travellers: 2, total: 800 });
  assert.equal(extraChargesFor({ ...schedule, extraChargesSummary: undefined }, 2), null);
});

test('the rate: the vendor\'s own, with its expiry; a converted figure is labelled calculated; the reconciliation on the captures', () => {
  const r = rate();
  assert.deepEqual(r, { sourceCurrency: 'THB', targetCurrency: 'USD', rate: 0.0308188425, lastUpdated: '2026-09-21T23:59:59Z', expiry: '2026-09-23T01:09:59Z', source: RATE_SOURCE });
  assert.deepEqual(rateOf(rates, 'USD', 'THB'), { refused: 'the vendor stated no USD→THB rate' });
  assert.equal(isExpired(r, NOW), false); assert.equal(isExpired(r, new Date('2026-09-23T01:09:59Z')), true);
  // The schedule's from-price at the vendor's rate is the search's own from-price, to the cent.
  const fromPrice = convert({ amount: schedule.summary!.fromPrice!, currency: 'THB' }, r, NOW);
  assert.ok(!('refused' in fromPrice)); assert.equal(fromPrice.amount, 77.66); assert.equal(fromPrice.label, CALCULATED);
  const searchCard = activityCardsOf(PAGE1 as RawProductSearch, { validateUrl: (u) => validatedAffiliateUrl(u, 'viator'), destinationNameOf: cityForViatorDestId }).cards.find((c) => c.productCode === '27424P2')!;
  assert.equal(searchCard.price, 77.66); assert.equal(fromPrice.amount, searchCard.price, '2,520 THB × 0.0308188425 = 77.66 = the search from-price');
  // The schedule's extra charges at the same rate are NOT the search's figure — both facts, no explanation.
  const extra = convert({ amount: schedule.extraChargesSummary!.extraCharges!, currency: 'THB' }, r, NOW);
  assert.ok(!('refused' in extra)); assert.equal(extra.amount, 12.33); assert.equal(searchCard.extraCharges, 12.03); assert.notEqual(extra.amount, searchCard.extraCharges);
  assert.equal(conversionLine(fromPrice), 'THB 2,520.00 × 0.0308188425 (Viator rate as of 2026-09-21T23:59:59Z, expires 2026-09-23T01:09:59Z) = USD 77.66 · calculated');
  assert.equal(roundHalfUpCents(12.325), 12.33); assert.equal(roundHalfUpCents(2.675), 2.68); assert.equal(roundHalfUpCents(77.6634831), 77.66);
  assert.deepEqual(convert({ amount: 100, currency: 'USD' }, r, NOW), { refused: 'the rate converts THB, the amount is USD' });
  assert.deepEqual(convert({ amount: 100, currency: 'THB' }, r, new Date('2026-09-24T00:00:00Z')), { refused: 'the Viator THB→USD rate expired at 2026-09-23T01:09:59Z — check availability again for a current rate' });
  assert.doesNotMatch(code('src/lib/activities/fx.ts'), /\bfetch\(|process\.env|new Date\(\)|0\.03|Intl\./, 'no rate typed, no clock of its own');
});

test('the Save: the draft the screen prices is the one the commit re-reads and recomputes; the note names every figure; an expired rate or a wrong total is refused', () => {
  const p = product();
  const cost = partyCost(record('TG14').pricingDetails!, { ADULT: 2 }, DATE, AS_OF, 'THB'); assert.ok(!('refused' in cost));
  const extra = extraChargesFor(schedule, 2)!;
  const total = totalOf({ native: { amount: cost.total, currency: 'THB' }, extra, rate: rate() }, ACTIVITY_SEARCH_CURRENCY, NOW);
  assert.deepEqual(total, { amount: 241.00, currency: 'USD', label: CALCULATED }, '7,020 + 800 = 7,820 THB × 0.0308188425 = 241.00');
  const draft: ViatorSave = {
    productCode: '27424P2', productOptionCode: 'TG14', optionTitle: optionTitleOf(p, 'TG14'), title: p.title!, date: DATE, startTime: '07:30', endTime: endTimeOf('07:30', p.duration), timeZone: p.timeZone, durationMinutes: 540,
    party: { ADULT: 2 }, native: { amount: cost.total, currency: 'THB' }, extra, rate: rate(), total, cancellation: cancellationStatement(p), asOf: AS_OF,
  };
  assert.equal(draft.endTime, '16:30'); assert.equal(endTimeOf('04:30', p.duration), '13:30'); assert.equal(endTimeOf('20:00', p.duration), null, 'past midnight — no end derived'); assert.equal(endTimeOf('07:30', { kind: 'variable', fromMinutes: 60, toMinutes: 120 }), null); assert.equal(endTimeOf(null, p.duration), null);
  const note = activitySaveNoteOf(draft);
  assert.equal(note, `Phi Phi Islands Adventure Day Trip w/ Seaview Lunch by V. Marine · option TG14 Small Group Only 20 People · 07:30 Asia/Bangkok · 2 adults · THB 7,820.00 (7020.00 + 800.00 in-destination charges stated by the operator, 400.00 × 2) × 0.0308188425 (Viator rate as of 2026-09-21T23:59:59Z, expires 2026-09-23T01:09:59Z) = USD 241.00 · calculated · cancellation: STANDARD — For a full refund, cancel at least 24 hours before the scheduled departure time. · schedule as published by the operator ${AS_OF} · book on Viator`);
  const back = readViatorSave(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(back, draft, 'the commit reads back exactly what the screen priced');
  assert.deepEqual(verifyViatorSave(draft, 241, note, 'USD', NOW), { ok: true });
  assert.match((verifyViatorSave(draft, 241, note, 'USD', new Date('2026-09-24T00:00:00Z')) as { refused: string }).refused, /^the Viator THB→USD rate expired at 2026-09-23T01:09:59Z/);
  assert.match((verifyViatorSave({ ...draft, total: { ...total, amount: 250 } }, 250, note, 'USD', NOW) as { refused: string }).refused, /^the total 250 USD \(calculated\) does not follow/);
  assert.match((verifyViatorSave(draft, 240, note, 'USD', NOW) as { refused: string }).refused, /^the line's amount 240 is not the calculated total 241/);
  assert.match((verifyViatorSave(draft, 241, `${note} — edited`, 'USD', NOW) as { refused: string }).refused, /^the note is not the one/);
  assert.match((verifyViatorSave({ ...draft, endTime: '17:00' }, 241, activitySaveNoteOf({ ...draft, endTime: '17:00' }), 'USD', NOW) as { refused: string }).refused, /^the end time does not follow/);
  // No conversion when the schedule already answers in the plan's currency; a rate to another currency refuses.
  assert.deepEqual(totalOf({ native: { amount: 50, currency: 'USD' }, extra: null, rate: null }, 'USD', NOW), { amount: 50, currency: 'USD', label: 'as stated' });
  assert.deepEqual(totalOf({ native: { amount: 50, currency: 'THB' }, extra: null, rate: null }, 'USD', NOW), { refused: 'the schedule answers in THB, the plan is USD, and no rate was read' });
  // The reader refuses by name.
  assert.deepEqual(readViatorSave({ ...JSON.parse(JSON.stringify(draft)), rate: { ...draft.rate, source: 'typed' } }), { refused: `viatorSave.rate must be the vendor's own rate (${RATE_SOURCE}) with its lastUpdated and expiry` });
  assert.deepEqual(readViatorSave({ ...JSON.parse(JSON.stringify(draft)), party: { ADULT: 0 } }), { refused: 'viatorSave.party holds no travellers' });
  assert.deepEqual(readViatorSave({ ...JSON.parse(JSON.stringify(draft)), total: { amount: 241, currency: 'USD', label: 'estimated' } }), { refused: `viatorSave.total must carry an amount, its currency and the label '${CALCULATED}' or 'as stated'` });
  // A stated 0 is a price: a 0-cost option reads and verifies.
  const free: ViatorSave = { ...draft, native: { amount: 0, currency: 'THB' }, extra: null, total: { amount: 0, currency: 'USD', label: CALCULATED } };
  assert.deepEqual(verifyViatorSave(free, 0, activitySaveNoteOf(free), 'USD', NOW), { ok: true });
  assert.doesNotMatch(code('src/lib/activities/save.ts'), /\bfetch\(|process\.env|new Date\(\)/);
});

test('the rate cache holds a pair until the vendor\'s own expiry and not a moment past it — in-process, as the docs instruct', () => {
  const r = rate();
  // Nothing cached yet for a pair nobody read.
  assert.equal(cachedExchangeRate('THB', 'USD', NOW), null);
  rememberExchangeRate(r);
  assert.deepEqual(cachedExchangeRate('THB', 'USD', NOW), r, 'inside its expiry the cache answers, so no second call is made');
  assert.equal(cachedExchangeRate('THB', 'EUR', NOW), null, 'another pair is another rate');
  // At the vendor's expiry the entry is dropped — and stays dropped.
  assert.equal(cachedExchangeRate('THB', 'USD', new Date(r.expiry)), null);
  assert.equal(cachedExchangeRate('THB', 'USD', NOW), null, 'an expired entry is not resurrected by an earlier clock');
});

test('SHOW THEM ALL on the two captured pages: 89 unique rows of 1,917, the moved total named; the 403 is the captured body', () => {
  const resolvers = { validateUrl: (u: string) => validatedAffiliateUrl(u, 'viator'), destinationNameOf: cityForViatorDestId };
  const one = activityCardsOf(PAGE1 as RawProductSearch, resolvers); const two = activityCardsOf(PAGE2 as RawProductSearch, resolvers);
  assert.equal(one.totalCount, 1915); assert.equal(two.totalCount, 1917); assert.equal(two.cards.length, 50);
  const known = new Set(one.cards.map((c) => c.productCode)); const fresh = two.cards.filter((c) => !known.has(c.productCode));
  assert.equal(fresh.length, 39, '11 of page two were already shown — the vendor\'s DEFAULT order moved them');
  assert.equal(countLine([...one.cards, ...fresh], two.totalCount, one.totalCount), '1–89 of 1,917 stated by the vendor (1,915 a page ago)');
  assert.equal(countLine(one.cards, one.totalCount, one.totalCount), '1–50 of 1,915 stated by the vendor', 'an unmoved total is not named twice');
  assert.deepEqual(FORBIDDEN.body, { code: 'FORBIDDEN', message: 'Endpoint access denied' }); assert.equal(FORBIDDEN.status, 403);
});

test('the options route: the user first, the query by name, the per-user limit, then each read reserved under viatorsave in order; the rate from the cache inside its expiry or read once; refusals by name', () => {
  const route = code(OPTIONS_ROUTE);
  const at = (s: string) => { const i = route.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return i; };
  const order = [at('await getVerifiedEmail()'), at('prisma.users.findFirst'), at("is not a supported parameter (supported: productCode, date)"), at('await rateLimit(`activity-options:${user.id}`'), at("await reserveTravelSearch('viatorsave');"), at('await getProductRaw(productCode)'), at('await getScheduleRaw(productCode)'), at('cachedExchangeRate(currency, ACTIVITY_SEARCH_CURRENCY, now)'), at('await fetchExchangeRatesRaw(currency, ACTIVITY_SEARCH_CURRENCY)'), at('rememberExchangeRate(read)')];
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'user → query → limit → reserve → product → schedule → cache → rate → remember');
  assert.equal((route.match(/reserveTravelSearch\('viatorsave'\)/g) ?? []).length, 3, 'three reservations per attempt');
  for (const call of ['getProductRaw(', 'getScheduleRaw(', 'fetchExchangeRatesRaw(']) assert.equal((route.match(new RegExp(call.replace('(', '\\('), 'g')) ?? []).length, 1, `${call} once`);
  assert.ok(route.indexOf("await reserveTravelSearch('viatorsave');\n    const product") < route.indexOf('getProductRaw('), 'reserved before the product read');
  assert.match(route, /if \(isExpired\(read, now\)\) return NextResponse\.json\(\{ error: `Viator's \$\{currency\}→\$\{ACTIVITY_SEARCH_CURRENCY\} rate had already expired at/);
  assert.match(route, /if \(currency !== ACTIVITY_SEARCH_CURRENCY\) \{/, 'a same-currency schedule skips the rate');
  assert.match(route, /error instanceof ViatorApiError/); assert.match(route, /error instanceof TravelSearchQuotaError/); assert.match(route, /\{ status: 503 \}/); assert.ok((route.match(/\{ status: 502 \}/g) ?? []).length >= 4);
  assert.doesNotMatch(route, /error\.message|error\.body|err\.body|\.slice\(0, 12\)/);
  assert.ok(!code('src/middleware.ts').includes("'/api/travel/activities/options'"), 'not a public path');
  // The three reads have no other caller under the search route, the picker, the planner or the client's old paths.
  for (const f of [SEARCH_ROUTE, VIEW, PLANNER, CONTAINER, 'src/app/api/travel/transfers/search/route.ts']) {
    assert.doesNotMatch(code(f), /getProductRaw\(|getScheduleRaw\(|fetchExchangeRatesRaw\(|availability\/schedules|exchange-rates/, `${f} makes none of the Save's reads`);
  }
  const client = code(CLIENT);
  assert.match(client, /const exchangeRateCache = new Map<string, RateRecord>\(\);/);
  assert.match(client, /if \(isExpired\(hit, now\)\) \{ exchangeRateCache\.delete/, 'the cache honours the vendor\'s expiry');
  assert.doesNotMatch(client, /rate:\s*[0-9]/, 'no rate typed in the client');
  assert.match(code(QUOTA), /viatorsave: 300,/); assert.match(comments(QUOTA), /three calls|three reads|3 calls/i);
});

test('the commit: the marker admits a stated 0, the Save is re-read and recomputed, the stated zone fixes the instant, the tour prefix uncommits', () => {
  const commit = code(COMMIT);
  assert.match(commit, /const operatorStated = priceStatedByInput === 'operator' && viatorSave !== null;/);
  assert.match(commit, /if \(!Number\.isFinite\(amt\) \|\| amt < 0 \|\| \(amt === 0 && !operatorStated\)\) \{/);
  assert.match(commit, /a 0 is accepted only as a price the operator stated/);
  assert.match(commit, /with its product option code/);
  assert.match(commit, /const read = readViatorSave\(viatorSaveInput\);/);
  assert.match(commit, /const verdict = verifyViatorSave\(viatorSave, amt, notes, ACTIVITY_SEARCH_CURRENCY, now\);/);
  assert.match(commit, /const activityZone = viatorSave\?\.timeZone \?\? null;/);
  assert.match(commit, /start_zone: activityZone,\n\s+end_zone: activityZone,\n\s+start_at: activityZone \? startAt : null,\n\s+end_at: activityZone \? endAt : null,\n\s+duration_minutes: viatorSave\?\.durationMinutes \?\? null,/);
  assert.match(commit, /zonedToInstant\(String\(startDate\)\.slice\(0, 10\), String\(startTime\)\.slice\(0, 5\), startZone\)/, 'the flight pattern: naive clock + the stated IANA zone');
  assert.match(commit, /optionId\.startsWith\('viator-'\)/);
  // The line is titled by the operator's product title (the note is far longer than the VarChar(255) column); a longer title is refused, never truncated.
  assert.match(commit, /title: viatorSave \? viatorSave\.title : \(notes \|\|/);
  assert.match(commit, /the line's title column holds 255; nothing was saved/);
  assert.doesNotMatch(commit, /\.slice\(0, 255\)|substring\(0, 255\)/);
  assert.doesNotMatch(commit, /'Asia\/|'America\/|'Europe\//, 'no zone typed');
  const container = code(CONTAINER);
  const countOf = (needle: string) => container.split(needle).length - 1;
  assert.equal(countOf('fetch(' + '`' + '/api/travel/activities/options?'), 1, 'the one authed read, from the Save panel');
  assert.equal(countOf('fetch(' + '`' + '/api/travel/activities/search?'), 1);
  assert.equal(countOf('/vendor-commit'), 1);
  assert.match(container, /priceStatedBy: 'operator',/); assert.match(container, /viatorSave: draft,/); assert.match(container, /category: 'activities',/); assert.match(container, /const note = activitySaveNoteOf\(draft\);/);
  assert.match(container, /if \(authed !== true\) \{ onRequireAuth\(\); return; \}/); assert.match(container, /initial\[b\.ageBand\] = b\.minTravelersPerBooking \?\? 0;/, 'the party form from the stated bands, the operator\'s minimum');
  assert.match(container, /endTime: endTimeOf\(startTime, answer\.product\.duration\),/); assert.match(container, /timeZone: answer\.product\.timeZone,/);
  assert.doesNotMatch(container, /'09:00'|'17:00'|value=\{['"]20/, 'no preselected date or clock');
  assert.match(code(STRIP), /<PublicActivitySearch\n\s+onRequireAuth=\{onRequireAuth\}\n\s+authed=\{authed\}\n\s+currentTrip=\{currentTrip\}\n\s+onCommitted=\{onCommitted\}/);
});

test('the pin holds, dated: six files re-dated and one pinned by ACTIVITY-01; the census grew to 50', () => {
  const notes = comments('src/lib/travelBookingFlow.ts');
  const pins = code('src/lib/travelBookingFlow.ts');
  const redated = [SEARCH_ROUTE, STRIP, CONTAINER, 'src/components/trips/ActivityResultsView.tsx', CLIENT, QUOTA];
  assert.equal((notes.match(/ACTIVITY-01 \(2026-09-22\): re-dated/g) ?? []).length, redated.length);
  for (const f of redated) assert.ok(pins.includes(`{ file: '${f}', sha256: '`), `${f} is pinned`);
  assert.equal((notes.match(/ACTIVITY-01 \(2026-09-22\): pinned — /g) ?? []).length, 1);
  assert.ok(pins.includes(`{ file: '${OPTIONS_ROUTE}', sha256: '`), 'the options route joins the census');
  assert.match(BOOKING_FLOW_BASE, /the options route pinned by ACTIVITY-01/);
  assert.equal(BOOKING_FLOW_FILES.length, 50, 'the census grew by the options route');
});
