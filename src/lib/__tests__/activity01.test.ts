/**
 * ACTIVITY-01 (2026-09-22) — ONE ACTIVITY, WHAT THE OPERATOR STATES.
 *
 * The contract and the leaf are probed on the CAPTURED Phuket answer
 * (fixtureViatorSearch.phuket-thailand.json — Alex's probe, 50 of 1,915, read
 * WHOLE through the leaf, never a trimmed copy); what the route, the view and
 * the container DO is asserted from source through the two readers
 * (TEST-TRUTH-01). The two cases the capture does not exercise (a 0 price, a
 * second currency) are DERIVED from a captured product in the test and said so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { ACTIVITY_FILTER_PARAMS, ACTIVITY_FLAGS, ACTIVITY_SEARCH_CURRENCY, ACTIVITY_SORTS, activitySearchBodyOf, parseActivityFilters } from '../activities/searchContract';
import {
  DEFAULT_ACTIVITY_FILTERS, FROM_PRICE_BASIS, NOT_STATED,
  activityCardOf, activityCardsOf, activityFiltersStatement, activitySearchParamsOf, cancellationText, countLine, durationText, extraChargesText, lowestPrice, lowestPriceLine, moreStated, pageSizeOf, priceDifference, priceText, rankPrice, ratingText,
  type ActivityCardResolvers, type RawProductSearch, type RawProductSummary,
} from '../activities/products';
import { validatedAffiliateUrl } from '../../config/affiliates';
import { cityForViatorDestId } from '../destinations';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES } from '../travelBookingFlow';
import PHUKET from './fixtureViatorSearch.phuket-thailand.json';

const ROUTE = 'src/app/api/travel/activities/search/route.ts';
const CONTRACT = 'src/lib/activities/searchContract.ts';
const LEAF = 'src/lib/activities/products.ts';
const VIEW = 'src/components/trips/ActivityPickerView.tsx';
const CONTAINER = 'src/components/trips/PublicActivitySearch.tsx';
const OLD_VIEW = 'src/components/trips/ActivityResultsView.tsx';
const STRIP = 'src/components/trips/travelStripModes.tsx';
const CLIENT = 'src/lib/viatorClient.ts';
const TRANSFERS_ROUTE = 'src/app/api/travel/transfers/search/route.ts';

/** The same resolvers the route injects: the affiliate gate and the app's destination map. */
const RESOLVERS: ActivityCardResolvers = { validateUrl: (u) => validatedAffiliateUrl(u, 'viator'), destinationNameOf: cityForViatorDestId };
const answer = () => activityCardsOf(PHUKET as RawProductSearch, RESOLVERS);
const get = (q: Record<string, string>) => parseActivityFilters(Object.keys(q), (n) => (n in q ? q[n] : null));

// ───────────────────────────────────────────────────────────────────────────
test('the contract: the documented names by name, unknown and bad values refused by name, absent not sent, the currency the one constant', () => {
  assert.deepEqual([...ACTIVITY_FILTER_PARAMS], ['lowestPrice', 'highestPrice', 'ratingFrom', 'ratingTo', 'durationFrom', 'durationTo', 'flags', 'sort', 'order', 'count', 'start']);
  assert.deepEqual([...ACTIVITY_SORTS], ['DEFAULT', 'PRICE', 'TRAVELER_RATING', 'ITINERARY_DURATION', 'DATE_ADDED']);
  assert.deepEqual([...ACTIVITY_FLAGS], ['NEW_ON_VIATOR', 'FREE_CANCELLATION', 'SKIP_THE_LINE', 'PRIVATE_TOUR', 'SPECIAL_OFFER', 'LIKELY_TO_SELL_OUT']);
  assert.equal(ACTIVITY_SEARCH_CURRENCY, 'USD');
  const ok = get({ city: 'Phuket', country: 'Thailand', lowestPrice: '20', highestPrice: '100', ratingFrom: '4', durationTo: '360', flags: 'FREE_CANCELLATION,PRIVATE_TOUR', sort: 'PRICE', order: 'ASCENDING', count: '25' });
  assert.ok('filters' in ok);
  assert.deepEqual(ok.filters, { lowestPrice: 20, highestPrice: 100, rating: { from: 4 }, durationInMinutes: { to: 360 }, flags: ['FREE_CANCELLATION', 'PRIVATE_TOUR'], sort: 'PRICE', order: 'ASCENDING', count: 25 });
  const body = activitySearchBodyOf('349', ok.filters);
  assert.deepEqual(body, { filtering: { destination: '349', lowestPrice: 20, highestPrice: 100, rating: { from: 4 }, durationInMinutes: { to: 360 }, flags: ['FREE_CANCELLATION', 'PRIVATE_TOUR'] }, sorting: { sort: 'PRICE', order: 'ASCENDING' }, pagination: { count: 25 }, currency: 'USD' });
  // SHOW THEM ALL: the vendor's own cursor, by name, an integer ≥ 1; sent alone it rides alone (the vendor's count default applies).
  const paged = get({ city: 'Phuket', country: 'Thailand', start: '51' });
  assert.ok('filters' in paged); assert.deepEqual(paged.filters, { start: 51 });
  assert.deepEqual(activitySearchBodyOf('349', paged.filters), { filtering: { destination: '349' }, pagination: { start: 51 }, currency: 'USD' });
  const paged50 = get({ city: 'Phuket', country: 'Thailand', start: '51', count: '50' });
  assert.ok('filters' in paged50); assert.deepEqual(activitySearchBodyOf('349', paged50.filters).pagination, { start: 51, count: 50 });
  // Absent → not sent: no sorting object, no pagination object; the currency is the constant, never a caller's.
  const bare = get({ city: 'Phuket', country: 'Thailand' });
  assert.ok('filters' in bare); assert.deepEqual(bare.filters, {});
  assert.deepEqual(activitySearchBodyOf('349', bare.filters), { filtering: { destination: '349' }, currency: 'USD' });
  // Unknown → refused BY NAME.
  for (const [q, name] of [[{ city: 'x', country: 'y', currency: 'THB' }, 'currency'], [{ city: 'x', country: 'y', tags: '1' }, 'tags'], [{ city: 'x', country: 'y', startDate: '2026-09-23' }, 'startDate'], [{ city: 'x', country: 'y', minRating: '4' }, 'minRating']] as const) {
    const r = get(q as Record<string, string>);
    assert.ok('error' in r && r.error.startsWith(`${name} is not a supported search parameter`), `${name}: ${JSON.stringify(r)}`);
  }
  // Bad values → refused by name, to the vendor's documented bounds.
  const bad: Array<[Record<string, string>, RegExp]> = [
    [{ lowestPrice: '-1' }, /^lowestPrice must be/], [{ highestPrice: '0' }, /^highestPrice must be/], [{ ratingFrom: '2.5' }, /^ratingFrom must be an integer/], [{ ratingTo: '0' }, /^ratingTo must be/],
    [{ durationFrom: '-5' }, /^durationFrom must be/], [{ durationTo: '0' }, /^durationTo must be/], [{ flags: 'REFUNDABLE' }, /^flags must be a comma list of/], [{ sort: 'RATING' }, /^sort must be one of/],
    [{ sort: 'PRICE', order: 'UP' }, /^order must be one of/], [{ sort: 'DEFAULT', order: 'ASCENDING' }, /order may not be sent with sort DEFAULT/], [{ sort: 'TRAVELER_RATING', order: 'ASCENDING' }, /takes only order DESCENDING/],
    [{ order: 'ASCENDING' }, /^order needs a sort/], [{ count: '0' }, /^count must be a whole number from 1 to 50/], [{ count: '51' }, /^count must be/], [{ count: 'ten' }, /^count must be/],
    [{ start: '0' }, /^start must be a whole number of 1 or more/], [{ start: '1.5' }, /^start must be/], [{ start: 'two' }, /^start must be/],
  ];
  for (const [q, re] of bad) {
    const r = get({ city: 'x', country: 'y', ...q });
    assert.ok('error' in r && re.test(r.error), `${JSON.stringify(q)} → ${JSON.stringify(r)}`);
  }
  assert.doesNotMatch(code(CONTRACT), /\bfetch\(|process\.env|from '@\/lib\/viatorClient'/);
  assert.match(comments(CONTRACT), /THE CURRENCY INVARIANT/);
});

test('the leaf on the captured answer: one product per row in the vendor\'s order, every attribute stated or not, nothing dropped', () => {
  const { cards, totalCount } = answer();
  assert.equal(cards.length, 50); assert.equal(totalCount, 1915);
  assert.equal(countLine(cards, totalCount), '1–50 of 1,915 stated by the vendor');
  assert.equal(countLine([...cards, ...cards.map((c) => ({ ...c, productCode: `${c.productCode}-p2` }))], totalCount), '1–100 of 1,915 stated by the vendor', 'a second page accumulates (a derived case: the capture holds page one)');
  assert.equal(countLine([], totalCount), '0 of 1,915 stated by the vendor');
  assert.equal(pageSizeOf(DEFAULT_ACTIVITY_FILTERS), 10, "the vendor's documented default count"); assert.equal(pageSizeOf({ ...DEFAULT_ACTIVITY_FILTERS, count: '50' }), 50);
  assert.equal(moreStated(50, 1915), true); assert.equal(moreStated(1915, 1915), false); assert.equal(moreStated(50, null), null);
  assert.deepEqual(cards.slice(0, 5).map((c) => c.productCode), ['27424P2', '208505P1', '44720P2', '160694P9', '133093P1'], 'the vendor\'s order, no re-sort');
  const c = cards[0];
  assert.equal(c.name, 'Phi Phi Islands Adventure Day Trip w/ Seaview Lunch by V. Marine');
  assert.equal(c.price, 77.66); assert.equal(c.priceBeforeDiscount, 86.29); assert.equal(c.currency, 'USD'); assert.equal(c.priceBasis, FROM_PRICE_BASIS);
  assert.equal(c.extraCharges, 12.03); assert.equal(c.allInPrice, 89.69); assert.equal(c.allInPriceBeforeDiscount, 98.32);
  assert.equal(priceText(c), 'from $77.66');
  assert.equal(extraChargesText(c), '+ $12.03 extra charges stated by the operator · $89.69 all-in');
  assert.deepEqual(c.duration, { kind: 'fixed', minutes: 540 }); assert.equal(durationText(c.duration), '9h');
  assert.deepEqual(c.flags, ['FREE_CANCELLATION', 'SPECIAL_OFFER']);
  assert.equal(c.freeCancellation, true); assert.equal(c.specialOffer, true); assert.equal(c.privateTour, null); assert.equal(c.skipTheLine, null);
  assert.equal(cancellationText(c), 'free cancellation stated by the operator');
  assert.equal(c.rating, 4.775236); assert.equal(c.reviewCount, 3497);
  assert.deepEqual(c.reviewSources, [{ provider: 'VIATOR', totalCount: 1732, averageRating: 4.8 }, { provider: 'TRIPADVISOR', totalCount: 1765, averageRating: 4.7 }]);
  assert.equal(ratingText(c), '4.8/5 · 3,497 reviews (Viator 1,732 · Tripadvisor 1,765)');
  assert.equal(c.confirmationType, 'INSTANT'); assert.equal(c.itineraryType, 'STANDARD');
  assert.equal(c.destinationRef, '349'); assert.equal(c.destinationName, 'Phuket');
  assert.ok(c.productUrl?.startsWith('https://www.viator.com/tours/Phuket/') && c.productUrl.includes('pid=P00294427'), 'the validated outbound link');
  assert.equal(c.machineTranslated, false);
  // Every row: the answer's own currency, a validated link, no googleRating anywhere.
  for (const k of cards) {
    assert.equal(k.currency, 'USD', k.productCode); assert.ok(k.productUrl !== null, `${k.productCode} link`); assert.ok(!('googleRating' in k)); assert.ok(!('coordinates' in k));
  }
  // The durations: 34 fixed, 16 variable, none absent; a variable one states its range.
  assert.equal(cards.filter((k) => k.duration?.kind === 'fixed').length, 34);
  assert.equal(cards.filter((k) => k.duration?.kind === 'variable').length, 16);
  assert.equal(cards.filter((k) => k.duration === null).length, 0);
  const v = cards.find((k) => k.productCode === '44720P2')!;
  assert.deepEqual(v.duration, { kind: 'variable', fromMinutes: 420, toMinutes: 480 }); assert.equal(durationText(v.duration), '7h–8h (variable, stated by the operator)');
  // The flags: 47 state free cancellation; 3 do not — their silence is named, never "non-refundable", never false.
  assert.equal(cards.filter((k) => k.freeCancellation === true).length, 47);
  assert.equal(cards.filter((k) => k.freeCancellation === null).length, 3);
  assert.equal(cards.filter((k) => k.freeCancellation === false).length, 0);
  for (const code_ of ['429679P12', '380880P1']) {
    const k = cards.find((x) => x.productCode === code_)!;
    assert.deepEqual(k.flags, []); assert.equal(cancellationText(k), `cancellation policy ${NOT_STATED}`);
  }
  // The extra charges: 6 products state them; the others say nothing (null, no line).
  assert.deepEqual(cards.filter((k) => k.extraCharges !== null).map((k) => k.productCode), ['27424P2', '212080P12', '44720P1', '10074P2', '194613P22', '133093P2']);
  assert.equal(cards.filter((k) => extraChargesText(k) === null).length, 44);
  // The two unrated products are PRESENT and say so — not hidden, not dropped, not 0.
  for (const code_ of ['110534P1165', '103612P66']) {
    const k = cards.find((x) => x.productCode === code_);
    assert.ok(k, `${code_} is on the list`);
    assert.equal(k!.rating, null); assert.equal(k!.reviewCount, null); assert.deepEqual(k!.reviewSources, []);
    assert.equal(ratingText(k!), `rating ${NOT_STATED}`);
  }
  // 11 state a before-discount price.
  assert.equal(cards.filter((k) => k.priceBeforeDiscount !== null).length, 11);
});

test('derived from a captured product: a stated 0 is a price; a missing field is the operator\'s silence; a repeat code appears once', () => {
  const base = (PHUKET as RawProductSearch).products![0]!;
  const zero: RawProductSummary = { ...base, pricing: { summary: { fromPrice: 0 }, currency: 'USD' } };
  const z = activityCardOf(zero, 0, RESOLVERS);
  assert.equal(z.price, 0); assert.equal(z.priceBasis, FROM_PRICE_BASIS); assert.equal(priceText(z), 'from $0.00'); assert.equal(z.extraCharges, null);
  const silent: RawProductSummary = { productCode: 'X1', title: 'Silent tour' };
  const s = activityCardOf(silent, 3, RESOLVERS);
  assert.equal(s.price, null); assert.equal(s.priceBasis, null); assert.equal(s.currency, null); assert.equal(priceText(s), `price ${NOT_STATED}`);
  assert.equal(s.duration, null); assert.equal(durationText(s.duration), `duration ${NOT_STATED}`);
  assert.equal(s.rating, null); assert.equal(s.freeCancellation, null); assert.equal(s.productUrl, null); assert.equal(s.destinationRef, null); assert.equal(s.destinationName, null);
  assert.equal(s.confirmationType, null); assert.equal(s.machineTranslated, null); assert.equal(s.photoUrl, null);
  // A URL that fails the affiliate gate is null — "no booking link stated by the operator" — never constructed.
  const badUrl = activityCardOf({ ...base, productUrl: 'https://example.com/tour?pid=P00294427' }, 0, RESOLVERS);
  assert.equal(badUrl.productUrl, null);
  // A repeated productCode keeps its first appearance.
  const twice = activityCardsOf({ products: [base, { ...base, title: 'again' }], totalCount: 2 }, RESOLVERS);
  assert.equal(twice.cards.length, 1); assert.equal(twice.cards[0].name, base.title);
  assert.equal(countLine(twice.cards, null), '1–1 · total not stated by the vendor');
  assert.doesNotMatch(code(LEAF), /\bfetch\(|process\.env|googleRating|\|\| 0\b|\|\| null\b/);
  assert.match(code(LEAF), /import \{ type Stated, stated, statedBoolean, statedNumber, statedString \} from '@\/lib\/travel\/stated';/);
});

test('the benchmark: the lowest from-price ranked on the all-in figure where stated; a selection explained from stated attributes; no conversion across currencies', () => {
  const { cards } = answer();
  const low = lowestPrice(cards)!;
  assert.equal(low.card.productCode, '198310P2'); assert.equal(low.figure, 21.57);
  assert.equal(lowestPriceLine(low), 'Lowest from-price meeting your filters: $21.57 — Private PHUKET Arrival Transfer - Phuket Airport to Phuket Hotels. Ranked on the all-in figure where the operator states extra charges.');
  // A product that states extra charges ranks on its all-in figure, not its headline.
  const phi = cards[0]; assert.equal(rankPrice(phi), 89.69);
  const same = priceDifference(low.card, low.card);
  assert.equal(same.delta, null); assert.equal(same.line, 'This is the lowest from-price meeting your filters.');
  const d = priceDifference(phi, low.card);
  assert.equal(d.delta, 68.12); assert.equal(d.currency, 'USD');
  assert.deepEqual(d.reasons, ['duration 9h vs 1h']);
  assert.deepEqual(d.unstated, ['private tour', 'skip the line']);
  assert.equal(d.line, `+$68.12 over the lowest for: duration 9h vs 1h; private tour, skip the line — reason ${NOT_STATED}.`);
  // Two currencies: named, never converted, never compared (a derived case — the capture is USD throughout).
  const thb = { ...phi, currency: 'THB' as const };
  const x = priceDifference(thb, low.card);
  assert.equal(x.delta, null); assert.equal(x.line, 'Priced in THB; the lowest in USD — no conversion, no comparison.');
  // A price the operator did not state cannot be compared.
  const silent = { ...phi, price: null, allInPrice: null, extraCharges: null };
  assert.equal(priceDifference(silent, low.card).line, `The difference cannot be computed — a price is ${NOT_STATED}.`);
  assert.equal(lowestPrice([silent]), null); assert.equal(lowestPriceLine(null), null);
});

test('the on-screen filter contract: a control at "any" sends nothing; each control sends the vendor\'s own name; the statement says so', () => {
  assert.deepEqual(activitySearchParamsOf(DEFAULT_ACTIVITY_FILTERS), {});
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, priceMin: '20', priceMax: '100' }), { lowestPrice: '20', highestPrice: '100' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, rating: '4' }), { ratingFrom: '4' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, duration: '2to6h' }), { durationFrom: '120', durationTo: '360' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, duration: 'under2h' }), { durationTo: '120' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, freeCancellation: true, privateTour: true }), { flags: 'FREE_CANCELLATION,PRIVATE_TOUR' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, sort: 'PRICE' }), { sort: 'PRICE', order: 'ASCENDING' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, sort: 'TRAVELER_RATING' }), { sort: 'TRAVELER_RATING', order: 'DESCENDING' });
  assert.deepEqual(activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, sort: 'ITINERARY_DURATION', count: '50' }), { sort: 'ITINERARY_DURATION', count: '50' });
  // Everything the screen sends passes the route's contract.
  for (const ui of [{ ...DEFAULT_ACTIVITY_FILTERS, priceMin: '20', priceMax: '100', rating: '4' as const, duration: 'over6h' as const, freeCancellation: true, sort: 'PRICE' as const, count: '25' as const }]) {
    const q = { city: 'Phuket', country: 'Thailand', ...activitySearchParamsOf(ui) };
    assert.ok('filters' in get(q));
  }
  assert.equal(activityFiltersStatement(DEFAULT_ACTIVITY_FILTERS, 'USD'), "from-price: any · rating: any (the vendor's default) · duration: any · free cancellation: not required · private tour: not required · sort: the vendor's order · results: the vendor's default (10) · currency sent: USD");
  assert.match(activityFiltersStatement({ ...DEFAULT_ACTIVITY_FILTERS, priceMin: '20', rating: '3', sort: 'PRICE', count: '50' }, 'USD'), /from-price from 20 USD · rating above 3 \(the vendor's floor\) · .* · sort: price, low to high · results: 50 · currency sent: USD/);
});

test('the route forwards the contract between its guards, makes ONE raw call, answers through the leaf, and never re-sorts, drops or echoes the vendor', () => {
  const route = code(ROUTE);
  const at = (s: string) => { const i = route.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return i; };
  const order = [at('await rateLimit('), at("if (!city || !country)"), at('parseActivityFilters([...params.keys()], (n) => params.get(n))'), at("await reserveTravelSearch('viator')"), at('findViatorDestIdFor(city) ?? await findDestinationId(city, country)'), at('searchProductsRaw(activitySearchBodyOf(String(destId), filters))'), at('activityCardsOf(raw as RawProductSearch, {')];
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'rate limit → presence → contract → reserve → destination → the one call → the leaf');
  assert.equal((route.match(/searchProductsRaw\(/g) ?? []).length, 1);
  assert.equal((route.match(/reserveTravelSearch\('viator'\)/g) ?? []).length, 1);
  assert.match(route, /currency: ACTIVITY_SEARCH_CURRENCY,/, 'the currency sent is named in the answer');
  assert.match(route, /validateUrl: \(u\) => validatedAffiliateUrl\(u, 'viator'\),/); assert.match(route, /destinationNameOf: cityForViatorDestId,/);
  assert.doesNotMatch(route, /searchViatorProducts\(|viatorProductToRecommendation|googleRating|ACTIVITY_MAX_RESULTS|\.sort\(|\.slice\(/);
  assert.match(route, /start: filters\.start \?\? 1,/, 'the answer names the page it is');
  assert.match(route, /error instanceof ViatorApiError/); assert.match(route, /error instanceof MissingViatorKeyError/); assert.ok((route.match(/\{ status: 502 \}/g) ?? []).length >= 2);
  assert.doesNotMatch(route, /error\.message|error\.body|err\.body/, 'the vendor\'s body never reaches the browser (HYG-02)');
  assert.match(route, /\{ status: 404 \}/, 'a city Viator does not know is refused by name, not an empty list');
});

test('the container fires a search only on the SEARCH press, counted, with the screen\'s filters; the view states every attribute and has no sign-up Book', () => {
  const container = code(CONTAINER);
  assert.equal((container.match(/fetch\(/g) ?? []).length, 1);
  assert.doesNotMatch(container, /useEffect|searchNonce|sharedCity|onRequireAuth|onBook|ActivityResultsView|\.slice\(/);
  // SHOW THEM ALL: Next repeats the filters the pages were asked with, at the vendor's cursor; a filter change waits for a fresh SEARCH from page one; nothing is capped.
  assert.match(container, /const page = await fetchPage\(sentFilters, cards\.length \+ 1\);/);
  assert.match(container, /\.\.\.\(start > 1 \? \{ start: String\(start\) \} : \{\}\),/);
  assert.match(container, /const filtersChanged = sentFilters !== null && JSON\.stringify\(filters\) !== JSON\.stringify\(sentFilters\);/);
  assert.match(container, /if \(fresh\.length === 0\) setExhausted\(true\);/);
  assert.match(container, /\.\.\.activitySearchParamsOf\(asked\),/); assert.match(container, /await fetchPage\(filters, 1\);/); assert.match(container, /setSearchCount\(\(n\) => n \+ 1\);/);
  assert.match(container, /sentCurrency=\{ACTIVITY_SEARCH_CURRENCY\}/);
  assert.match(container, /<ActivityPickerView/);
  const view = code(VIEW);
  assert.doesNotMatch(view, /Price on request|googleRating|onRequireAuth|onBook|fetch\(|useEffect|non-refundable|Intl\.NumberFormat/);
  assert.doesNotMatch(view, /\.slice\(/, 'no client cap on the rows');
  assert.match(view, /disabled=\{!hasMore \|\| filtersChanged \|\| loadingMore\}/);
  for (const must of ['Plan here; book on Viator.', 'no booking link stated by the operator', 'data-activity-llf', 'data-activity-count', 'data-price-difference', 'data-search-count', 'cancellationText(card)', 'ratingText(card)', 'durationText(card.duration)', 'priceText(card)', 'extraChargesText(card)', 'card.priceBasis ?? `basis ${NOT_STATED}`', 'data-activity-next={pageSize}', 'filters changed — Search starts from page one', 'countLine(cards, totalCount)']) {
    assert.ok(view.includes(must) || code('src/components/trips/SearchCount.tsx').includes(must), must);
  }
  assert.match(view, /rel="noopener noreferrer sponsored"/);
  // The old shared view serves the transfers rail only, and its sign-up Book is gone.
  const old = code(OLD_VIEW);
  assert.doesNotMatch(old, /onBook/);
  assert.match(code(TRANSFERS_ROUTE), /searchViatorProductsByTags\(/, 'the transfers route keeps its path');
  assert.match(code(STRIP), /panel: <PublicActivitySearch \/> \}/);
  assert.match(code(STRIP), /<PublicTransferSearch\n\s+onRequireAuth=\{onRequireAuth\}\n\s+sharedCity=\{sharedCity\}/, 'the transfers mount is untouched');
  // The client: one raw call for this route; the old paths (and their re-sort) stay for the transfers route and the planner, untouched.
  const client = code(CLIENT);
  assert.match(client, /export async function searchProductsRaw\(body: ProductSearchBody\): Promise<unknown> \{/);
  assert.match(client, /\.filter\(p => p\.rating > 0\)/, 'the old re-sort still serves the planner');
});

test('the pin holds, dated: five files re-dated by ACTIVITY-01 with the hash they had on main dfc02881; the transfers route and the commit are not among them', () => {
  const notes = comments('src/lib/travelBookingFlow.ts');
  const pins = code('src/lib/travelBookingFlow.ts');
  const redated = [ROUTE, STRIP, CONTAINER, OLD_VIEW, CLIENT];
  assert.equal((notes.match(/ACTIVITY-01 \(2026-09-22\): re-dated/g) ?? []).length, redated.length);
  for (const f of redated) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    assert.ok(pinAt >= 0, `${f} is pinned`);
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    const above = notes.split('\n').slice(Math.max(0, pinLine - 3), pinLine - 1).join('\n');
    assert.match(above, /ACTIVITY-01 \(2026-09-22\): re-dated — [^\n]+\. A tour takes its time on the day; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main dfc02881\./, `${f}'s note`);
  }
  assert.match(BOOKING_FLOW_BASE, /re-dated by ACTIVITY-01 \(2026-09-22\), a tour takes its time on the day/);
  assert.ok(!BOOKING_FLOW_FILES.some((p) => p.file === 'src/app/api/trips/[id]/vendor-commit/route.ts'));
  assert.equal(BOOKING_FLOW_FILES.length, 49, 'the census did not shrink');
});
