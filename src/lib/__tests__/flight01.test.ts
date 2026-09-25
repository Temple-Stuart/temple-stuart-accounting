import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CABIN_OPTIONS, DEFAULT_UI_FILTERS, DEPARTURE_WINDOWS, NOT_STATED,
  carrierLineOf, countLine, fareDifference, filtersStatement, flightIdentityOf, groupFlights, lowestFare, lowestFareLine, searchRequestOf, segmentIdentity, statedText,
} from '../flights/fares';
import { FILTER_KEYS, parseFilters, parseSort } from '../flights/searchContract';
import { fareAttributesOf, liteApiResultsToFlightOffers, segmentViewOf } from '../liteapiFlightAdapter';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import { BKK_HKT_EXPECTED, BKK_HKT_RATES } from './fixtureFlightRatesBkkHkt';
import { code, comments, rejoin } from '../sourceText';

/**
 * FLIGHT-01 — A FLIGHT APPEARS ONCE, AND A FARE SAYS WHAT IT BUYS.
 * The leaf and the adapter are probed on the BKK→HKT payload (the vendor's
 * documented shape — no captured live payload exists in the repository); what
 * the route, the view and the containers DO is asserted from source, comments
 * stripped (TEST-TRUTH-01), and shown in the walk.
 */

const ROUTE = 'src/app/api/travel/liteapi/flights/search/route.ts';
const CONTRACT = 'src/lib/flights/searchContract.ts';
const VIEW = 'src/components/trips/FlightPickerView.tsx';
const ADAPTER = 'src/lib/liteapiFlightAdapter.ts';
const CONTAINERS = ['src/components/trips/FlightPicker.tsx', 'src/components/trips/PublicFlightSearch.tsx'];

const offers = () => liteApiResultsToFlightOffers(BKK_HKT_RATES);
const groups = () => groupFlights(offers());

// ───────────────────────────────────────────────────────────────────────────
test('six fare rows of one flight group to one row with six options — the count reads flights · fares', () => {
  const all = offers();
  assert.equal(all.length, BKK_HKT_EXPECTED.fares, 'every priced offer arrives, none invented, none dropped');
  const g = groups();
  assert.equal(g.length, BKK_HKT_EXPECTED.flights);
  assert.equal(countLine(g), '6 flights · 13 fares');
  const vz = g.find((x) => x.representative.outboundSegments?.[0]?.marketingCode === 'VZ')!;
  assert.equal(vz.fares.length, BKK_HKT_EXPECTED.vietjetFares, 'the Vietjet 06:50 appears once, with six fares — across two journeys');
  assert.equal(vz.cheapest.price, 41.95, 'the cheapest fare is the headline');
  assert.deepEqual(vz.fares.map((f) => f.price), [41.95, 65.34, 68.21, 68.21, 116.09, 179.30], 'fares by price');
  // The identity: marketing carrier + flight number + departure instant, per segment.
  const key = flightIdentityOf(vz.representative.outboundSegments);
  assert.equal(key, 'VZ300@2026-10-25T06:50:00');
  assert.equal(vz.key, key);
  for (const f of vz.fares) assert.equal(f.flightKey, key, `${f.id} shares the identity`);
  // The Hahn Air row is ITS OWN flight: a different marketing carrier and number, the same aircraft.
  const hahn = g.find((x) => x.representative.outboundSegments?.[0]?.marketingCode === 'H1')!;
  assert.equal(hahn.key, 'H15300@2026-10-25T06:50:00');
  assert.equal(hahn.fares.length, 1);
  // The one-stop row keys on both segments, in order.
  const nok = g.find((x) => x.representative.outboundSegments?.[0]?.marketingCode === 'DD')!;
  assert.equal(nok.key, 'DD401@2026-10-25T12:10:00|DD7310@2026-10-25T14:10:00');
  // An offer whose segments cannot be identified is its own flight, never merged by guess.
  assert.equal(segmentIdentity({ ...segmentViewOf({ segmentKey: 'x' }), marketingCode: 'VZ', marketingNumber: '300', departureTime: null }), null);
  assert.equal(flightIdentityOf([segmentViewOf({ segmentKey: 'x' })]), null);
  const lone = groupFlights([{ id: 'o-1', price: 10, currency: 'USD', outbound: null, return: null, flightKey: null }, { id: 'o-2', price: 12, currency: 'USD', outbound: null, return: null, flightKey: null }]);
  assert.deepEqual(lone.map((x) => x.key), ['offer:o-1', 'offer:o-2']);
  // The vendor's order of first appearance is kept.
  assert.deepEqual(g.map((x) => x.representative.outboundSegments?.[0]?.marketingCode), ['VZ', 'H1', 'FD', 'TG', 'PG', 'DD']);
});

test('a marketing/operating mismatch renders "operated by"; the airline that flies is named', () => {
  const hahn = offers().find((o) => o.id === 'h15300-y')!;
  const seg = hahn.outboundSegments![0];
  assert.equal(seg.marketingName, 'Hahn Air Systems');
  assert.equal(seg.operatingName, 'Thai Vietjet Air');
  assert.deepEqual(carrierLineOf(seg), { name: 'Hahn Air Systems', operatedBy: 'Thai Vietjet Air' });
  const vz = offers().find((o) => o.id === 'vz300-eco')!;
  assert.deepEqual(carrierLineOf(vz.outboundSegments![0]), { name: 'Thai Vietjet Air', operatedBy: null }, 'no line when marketing and operating agree');
  assert.deepEqual(carrierLineOf(undefined), { name: 'Flight', operatedBy: null });
  const view = code(VIEW);
  assert.match(view, /\{carrier\.operatedBy && \(\s*<div className="[^"]*" data-flight-operated-by>operated by \{carrier\.operatedBy\}<\/div>/);
  assert.match(view, /data-flight-carrier>\{carrier\.name\}<\/div>/);
  // Airports come from the payload's own names — DMK is Don Mueang, not Suvarnabhumi.
  assert.equal(seg.originCode, 'DMK');
  assert.equal(seg.originName, 'Don Mueang International Airport');
  assert.match(view, /data-flight-origin>\{first\?\.originCode \?\? rep\.outbound\?\.departure\.airport\}\{first\?\.originName \? ` · \$\{first\.originName\}` : ''\}/);
});

test('a null baggage field renders "not stated by the carrier" — never a coerced false, never inferred from the price', () => {
  const nobag = offers().find((o) => o.id === 'vz300-deluxe-nobag')!;
  assert.equal(nobag.fare!.checkedBag, null);
  assert.equal(nobag.fare!.carryOnBag, null);
  assert.equal(nobag.fare!.checkedBagDetail, null);
  assert.equal(nobag.fare!.changeable, true, 'what the payload states is stated');
  assert.equal(statedText(nobag.fare!.checkedBag, 'included', 'not included'), NOT_STATED);
  const noterms = offers().find((o) => o.id === 'vz300-deluxe-noterms')!;
  assert.equal(noterms.fare!.changeable, null);
  assert.equal(noterms.fare!.refundable, null);
  assert.equal(noterms.fare!.checkedBag, true);
  assert.equal(noterms.fare!.checkedBagDetail, '1 checked bag up to 20 kg');
  // The stated ones read as stated.
  const sky = offers().find((o) => o.id === 'vz300-skyboss')!;
  assert.deepEqual(sky.fare, {
    cabin: 'Economy', fareFamily: 'SkyBoss', fareBasisCode: 'VZSKY',
    checkedBag: true, checkedBagDetail: '1 checked bag up to 30 kg', carryOnBag: true, carryOnDetail: '1 carry-on bag up to 10 kg',
    changeable: true, refundable: true, changeFee: '0 USD (Change fee (before departure))', refundFee: '30 USD (Refund fee (before departure))',
  });
  const business = offers().find((o) => o.id === 'tg203-c')!;
  assert.equal(business.fare!.cabin, 'Business');
  // An empty payload states nothing at all.
  assert.deepEqual(fareAttributesOf({ offerId: 'x' }), { cabin: null, fareFamily: null, fareBasisCode: null, checkedBag: null, checkedBagDetail: null, carryOnBag: null, carryOnDetail: null, changeable: null, refundable: null, changeFee: null, refundFee: null });
  // Mixed cabins across segments say so.
  assert.equal(fareAttributesOf({ offerId: 'x', segmentFares: [{ cabin: 'Economy' }, { cabin: 'Business' }] }).cabin, 'mixed');
  // The adapter no longer coerces the carrier's silence into "not refundable".
  const adapter = code(ADAPTER);
  assert.doesNotMatch(adapter, /!!o\.terms|conditions:/);
  // HOTEL-01 (2026-09-22): the readers come from the ONE tri-state helper — no local copy in the adapter.
  assert.match(adapter, /import \{ statedBoolean, statedString \} from '@\/lib\/travel\/stated';/);
  assert.doesNotMatch(adapter, /const statedBoolean =|const statedString =/);
  assert.match(code('src/lib/travel/stated.ts'), /export function statedBoolean\(v: unknown\): Stated<boolean> \{\n  return typeof v === 'boolean' \? v : null;\n\}/);
  const attrs = adapter.slice(adapter.indexOf('export function fareAttributesOf('), adapter.indexOf('export function segmentViewOf('));
  assert.doesNotMatch(attrs, /price|total/, 'no attribute is read from a price');
  // The view renders every attribute through the tri-state text, "not stated" for null.
  const view = code(VIEW);
  for (const f of ['checkedBag', 'carryOnBag', 'changeable', 'refundable']) assert.match(view, new RegExp(`data-fare-field="${f}">\\{statedText\\(f\\?\\.${f},`));
  assert.match(view, /data-fare-field="cabin">\{f\?\.cabin \?\? NOT_STATED\}/);
  assert.equal(NOT_STATED, 'not stated by the carrier');
});

test('cabin BUSINESS is forwarded and a bad value is refused by name; unknown keys are refused; absent keys send nothing', () => {
  assert.deepEqual(parseFilters({ cabinClass: 'BUSINESS' }), { filters: { cabinClass: 'BUSINESS' } });
  assert.deepEqual(parseFilters({ cabinClass: 'business', cabinClassMatch: 'exactly', maxStops: 0, refundableOnly: true, includesCheckedBag: true, departureTimeAfter: '05:00', departureTimeBefore: '11:59' }),
    { filters: { cabinClass: 'BUSINESS', cabinClassMatch: 'exactly', maxStops: 0, refundableOnly: true, includesCheckedBag: true, departureTimeAfter: '05:00', departureTimeBefore: '11:59' } });
  assert.deepEqual(parseFilters({ cabinClass: 'LUXURY' }), { error: 'filters.cabinClass must be one of ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST' });
  assert.deepEqual(parseFilters({ maxStops: 3 }), { error: 'filters.maxStops must be -1, 0, 1 or 2' });
  assert.deepEqual(parseFilters({ refundableOnly: 'yes' }), { error: 'filters.refundableOnly must be true or false' });
  assert.deepEqual(parseFilters({ departureTimeAfter: '5am' }), { error: 'filters.departureTimeAfter must be HH:MM (24-hour)' });
  assert.deepEqual(parseFilters({ cabinClassMatch: 'roughly' }), { error: "filters.cabinClassMatch must be 'exactly' or 'at_least'" });
  assert.deepEqual(parseFilters({ showCheapestOfferOnly: true }), { error: `filters.showCheapestOfferOnly is not a supported filter (supported: ${FILTER_KEYS.join(', ')})` }, 'a vendor field the screen does not expose is refused by name, not forwarded');
  assert.deepEqual(parseFilters([]), { error: 'filters must be an object' });
  assert.deepEqual(parseFilters({}), { filters: {} }, 'nothing asked, nothing sent — the vendor\'s defaults');
  assert.deepEqual(parseSort({ sortBy: 'price' }), { sort: { sortBy: 'price' } });
  assert.deepEqual(parseSort({ sortBy: 'price', sortOrder: 'desc' }), { sort: { sortBy: 'price', sortOrder: 'desc' } });
  assert.deepEqual(parseSort({ sortBy: 'cheapness' }), { error: 'sort.sortBy must be one of price, duration, departure, arrival, stops' });
  assert.deepEqual(parseSort({ sortBy: 'price', direction: 'asc' }), { error: 'sort.direction is not a supported sort field (supported: sortBy, sortOrder)' });
  // The screen's contract: a control at "any" sends nothing; a cabin is exact.
  assert.deepEqual(searchRequestOf(DEFAULT_UI_FILTERS), {});
  assert.deepEqual(searchRequestOf({ ...DEFAULT_UI_FILTERS, cabin: 'BUSINESS' }), { filters: { cabinClass: 'BUSINESS', cabinClassMatch: 'exactly' } });
  assert.deepEqual(searchRequestOf({ ...DEFAULT_UI_FILTERS, stops: 'nonstop', refundableOnly: true, checkedBag: true, departure: 'morning', sort: 'duration' }),
    { filters: { maxStops: 0, refundableOnly: true, includesCheckedBag: true, departureTimeAfter: '05:00', departureTimeBefore: '11:59' }, sort: { sortBy: 'duration', sortOrder: 'asc' } });
  assert.deepEqual(searchRequestOf({ ...DEFAULT_UI_FILTERS, stops: 'one' }), { filters: { maxStops: 1 } });
  // Every request the contract can emit passes the route's own validation.
  for (const cabin of CABIN_OPTIONS) for (const departure of ['any', 'morning', 'afternoon', 'evening'] as const) {
    const req = searchRequestOf({ ...DEFAULT_UI_FILTERS, cabin, departure, sort: 'price' });
    if (req.filters) assert.ok('filters' in parseFilters(req.filters), `${cabin}/${departure} validates`);
    assert.ok('sort' in parseSort(req.sort!));
  }
  assert.deepEqual(DEPARTURE_WINDOWS, { morning: { after: '05:00', before: '11:59' }, afternoon: { after: '12:00', before: '17:59' }, evening: { after: '18:00', before: '23:59' } });
  // The statement says what is asked and where the vendor's default stands.
  assert.equal(filtersStatement(DEFAULT_UI_FILTERS), "cabin: any (the vendor's default) · stops: any (the vendor's default) · refundable: not required · checked bag: not required · departure: any time · sort: the vendor's default order");
  assert.match(filtersStatement({ ...DEFAULT_UI_FILTERS, cabin: 'BUSINESS', departure: 'evening' }), /cabin: business, exact match · .* · departure evening \(18:00–23:59\)/);
  // The route: the parsers sit between the guards and only their output is forwarded.
  const route = code(ROUTE);
  const guard1 = route.indexOf("await rateLimit(`liteapi-flight-search:${ip}`, { limit: 5, windowSeconds: 60 });");
  const parse = route.indexOf('parseFilters(body.filters)');
  const guard2 = route.indexOf("await reserveTravelSearch('liteapi');");
  const call = route.indexOf('const results = await searchFlightRates({');
  assert.ok(guard1 > 0 && parse > guard1 && guard2 > parse && call > guard2, 'rateLimit → validate (filters, sort) → reserve → call');
  assert.match(route, /\.\.\.\(filters \? \{ filters \} : \{\}\),\s*\.\.\.\(sort \? \{ sort \} : \{\}\),/);
  assert.doesNotMatch(route, /\.\.\.body/, 'nothing from the body is spread into the call');
  assert.match(code(CONTRACT), /is not a supported filter/);
});

test('the LLF line names the cheapest fare meeting the filters, and the difference line names stated attributes only', () => {
  const g = groups();
  const low = lowestFare(g)!;
  assert.equal(low.fare.id, BKK_HKT_EXPECTED.lowest.offerId);
  assert.equal(low.fare.price, 41.46, 'Thai AirAsia at $41.46 beats Vietjet at $41.95');
  assert.equal(lowestFareLine(low), BKK_HKT_EXPECTED.lowest.line);
  assert.equal(lowestFareLine(null), null);
  const by = (id: string) => offers().find((o) => o.id === id)!;
  // "+$74.63 over the lowest fare for: refundable, checked bag."
  const sky = fareDifference(by('vz300-skyboss'), low.fare);
  assert.equal(sky.delta, 74.63);
  assert.deepEqual(sky.reasons, ['refundable', 'checked bag']);
  assert.deepEqual(sky.unstated, []);
  assert.equal(sky.line, BKK_HKT_EXPECTED.skyboss.difference);
  // Changeable on both, so it is not a reason; a cabin difference is named as the cabin.
  const biz = fareDifference(by('tg203-c'), low.fare);
  assert.deepEqual(biz.reasons, ['refundable', 'checked bag', 'cabin Business']);
  assert.equal(biz.line, '+$168.54 over the lowest fare for: refundable, checked bag, cabin Business.');
  // Unstated on the selected fare → named as unstated, never inferred from the $26.75 gap.
  const noterms = fareDifference(by('vz300-deluxe-noterms'), low.fare);
  assert.deepEqual(noterms.reasons, ['checked bag']);
  assert.deepEqual(noterms.unstated, ['refundable', 'changeable']);
  assert.equal(noterms.line, '+$26.75 over the lowest fare for: checked bag; refundable, changeable — reason not stated by the carrier.');
  const nobag = fareDifference(by('vz300-deluxe-nobag'), low.fare);
  assert.deepEqual(nobag.reasons, []);
  assert.deepEqual(nobag.unstated, ['checked bag', 'carry-on bag']);
  assert.equal(nobag.line, '+$26.75 over the lowest fare — reason not stated by the carrier (checked bag, carry-on bag unstated).');
  // The same stated attributes at a higher price: the carrier states no difference — said, not guessed.
  const eco = fareDifference(by('vz300-eco'), low.fare);
  assert.deepEqual(eco.reasons, []);
  assert.equal(eco.line, '+$0.49 over the lowest fare — the carrier states no difference in refundable, changeable, checked bag, carry-on bag, cabin.');
  assert.equal(fareDifference(low.fare, low.fare).line, 'This is the lowest fare meeting your filters.');
  // The view prints both lines from the leaf.
  const view = code(VIEW);
  assert.match(view, /data-flight-llf>\s*\{llf\}/);
  // TRAVEL-ROW-01 (2026-09-23): the difference line moved from the leg's bar into the
  // strip under the selected fare row, so it is now computed per fare against that leg's
  // lowest — the leaf that computes it is unchanged; only where the view reads it moved.
  assert.match(view, /const fareDiff = selected && lowFare \? fareDifference\(fare, lowFare\.fare\) : null;/);
  assert.match(view, /data-fare-difference=\{fareDiff\.delta\}>\{fareDiff\.line\}/);
});

test('no search fires on a filter change — the SEARCH press is the only trigger, and the request carries the filters', () => {
  const view = code(VIEW);
  assert.equal((view.match(/onSearchLeg\(/g) ?? []).length, 1, 'the view calls onSearchLeg once — from the SEARCH button');
  assert.match(view, /<button onClick=\{\(\) => onSearchLeg\(leg\.id\)\} disabled=\{leg\.loading\}/);
  assert.doesNotMatch(view, /useEffect/, 'the view runs no effect');
  const bar = view.slice(view.indexOf('data-flight-filters>'), view.indexOf('data-flight-filters-stated'));
  assert.doesNotMatch(bar, /onSearchLeg|fetch\(/, 'the filter controls change the leg only');
  assert.equal((bar.match(/setFilters\(leg, \{/g) ?? []).length, 6, 'six controls: cabin, stops, refundable, checked bag, departure, sort');
  // HOTEL-01 (2026-09-22): the count is the shared SearchCount control.
  assert.match(view, /<SearchCount count=\{searchCount\} \/>/);
  assert.match(code('src/components/trips/SearchCount.tsx'), /data-search-count=\{count\}/);
  for (const f of CONTAINERS) {
    const c = code(f);
    assert.match(c, /body: JSON\.stringify\(\{ legs: searchLegs, adults: [^,]+, currency: 'USD', \.\.\.searchRequestOf\(leg\.filters\) \}\)/, `${f} sends the screen's filters`);
    assert.match(c, /setSearchCount\(\(n\) => n \+ 1\);/, `${f} counts the search`);
    assert.match(c, /filters: DEFAULT_UI_FILTERS,/, `${f} starts every control at "any"`);
    // No effect calls the search — the only effects are the existing mount/lane/itinerary reads.
    for (const m of c.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)) assert.doesNotMatch(m[1], /searchLeg\(/, `${f}: an effect runs a search`);
  }
});

test('the booking-flow pin still holds for every file it names — five search files re-pinned, dated; no booking file changed', () => {
  for (const pin of BOOKING_FLOW_FILES) {
    assert.equal(bookingFlowSha256(rejoin(code(pin.file), comments(pin.file))), pin.sha256, `${pin.file} hashes to its pin`);
  }
  assert.match(BOOKING_FLOW_BASE, /FLIGHT-01 \(2026-09-22\), search is not booking/);
  const notes = comments('src/lib/travelBookingFlow.ts');
  assert.equal((notes.match(/FLIGHT-01 \(2026-09-22\): re-pinned/g) ?? []).length, 5, 'five dated re-pin notes, one per search-path file');
  for (const f of ['flights/search/route.ts', 'PublicFlightSearch.tsx', 'FlightPicker.tsx', 'FlightPickerView.tsx', 'liteapiFlightAdapter.ts']) {
    // comments() blanks the code lines, so the note and the pin line are read
    // from the two channels separately: the dated note with its old hash from
    // comments(), the pin entry it precedes from code().
    assert.match(notes, /FLIGHT-01 \(2026-09-22\): re-pinned[^\n]*Search is not booking; no prebook\/verify\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main b9eac34a\./, `${f} carries a dated re-pin note with the old hash`);
    assert.match(code('src/lib/travelBookingFlow.ts'), new RegExp(`\\{ file: '[^']*${f.replace('.', '\\.')}', sha256: '[0-9a-f]{64}' \\}`), `${f} is pinned`);
  }
  // The booking files keep the hashes TRAVEL-01 pinned. CheckoutPanel is the one
  // exception and it is named: CHECKOUT-01 (2026-09-23) re-pinned it by its own
  // ruling — the panel now states why it cannot take a card instead of leaving a
  // blank pane. No prebook/book/pay/cancel CALL changed; what changed is what the
  // customer is told. Every other booking file below is still at its TRAVEL-01 hash.
  const booking = ['src/app/api/travel/liteapi/prebook/route.ts', 'src/app/api/travel/liteapi/book/route.ts', 'src/app/api/travel/liteapi/flights/prebook/route.ts', 'src/app/api/travel/liteapi/flights/verify/route.ts', 'src/app/api/travel/liteapi/flights/book/route.ts', 'src/components/trips/LiteApiFlightCheckoutPanel.tsx', 'src/components/trips/CheckoutPanel.tsx', 'src/lib/liteapiFlightsClient.ts'];
  const original: Record<string, string> = {
    'src/app/api/travel/liteapi/prebook/route.ts': 'dd6e8c9a0f1437a0661283bb91dc00aeb6dcaf6c227cefc180a3e01f1a60f351',
    // CAL-01 (2026-09-23): a stay now lands one calendar row; the booking itself is unchanged.
    // LANE-01 (2026-09-25): a reservation knows what it is. Was 792da953ba83fe8a8bc95d79045a0fabd00bfc807fab3b726a69dd85ef136eb1.
    // SEC-03 (2026-09-25): re-pinned — was 41f5eebfba6dacf4d613790dc0fa173e4c8cad012c42915d68d8a2cba8cf314a at main a5e66262.
    'src/app/api/travel/liteapi/book/route.ts': '667efb921cdd690b6e5c26fc40c6b9deacd520367cf346956592b150d117c597',
    // FL-4c (2026-09-23): the envelope gains paymentEnv, the server-derived key env.
    // SEC-03 (2026-09-25): re-pinned — was afad4046f2084b53ff5dfd48ca6c280b475967d61dfd4cf98f4b5da3e672964e at main a5e66262.
    'src/app/api/travel/liteapi/flights/prebook/route.ts': '4dd7994bc43cbc305e3c23717d881774289b47145d70f43d3ef12796f53e0b7a',
    'src/app/api/travel/liteapi/flights/verify/route.ts': '5143ffafee8ed954d5edc7c639857622375c6b177b9ac067f79553794674d589',
    // CAL-01 (2026-09-23): a flight has no date of travel in its landed payload, so it writes NO row and logs why.
    // FL-5b (2026-09-23): the confirmation email restored — a required contact, sent after the transaction.
    // LANE-01 (2026-09-25): a reservation knows what it is. Was 7a92d920d3bd45ac1a10997c3eb6b2ee1b1495dd3eec73a45ec3d9185ec5cc92.
    // SEC-03 (2026-09-25): re-pinned — was 653c25f1b43caf2104d152f543cf04dcb960b0c6bfc7ceac2a4ce5dddb2480f7 at main a5e66262.
    'src/app/api/travel/liteapi/flights/book/route.ts': '8f24d2dd90f36d55c2dbbe4cafb711387ea34faf4d9eb25a27c906b72b977367',
    // FL-5b (2026-09-23): the panel sends the contact it already holds; no payment path changed.
    // FL-4c (2026-09-23): the publishable key now comes from the vendor's /config, not the prebook's null.
    // FL-4c v2 (2026-09-23): the panel uses the vendor's DOCUMENTED wrapper — publicKey is the
    // environment label, the wrapper resolves the key, and the rail's redirect means the booking
    // completes on /booking/flight-confirm. Was 21b681fca23325df4e0925ce53515bb483a9ea75f0129ab0ab5720b44057c806.
    // LANE-01 (2026-09-25): a reservation knows what it is. Was 559fa688d4c88dfc7fc83bf1ff91fba13dff4e9cace83e83b82198a505dba98c.
    // SEC-03 (2026-09-25): re-pinned — was 6fc3a51fcf5e2a552ca7d6cd7ccf88ed0997b4b4ed77f12706cd76944d6be92c at main a5e66262.
    'src/components/trips/LiteApiFlightCheckoutPanel.tsx': '85abd313700af8443d1f76c325c6b9bc15db3ee785011b445e3c4fe1ea16a864',
    // Was 77564ce7471de9c4cb8dee188e596f3fe0b82f3526ba8fb39858e9831f992ff5 before CHECKOUT-01.
    // CHECKOUT-03 (2026-09-23): the panel waits on Stripe.js before handing off.
    'src/components/trips/CheckoutPanel.tsx': 'b3fd49cbd8acf9ab3d5afb11fdc42f61089722d2951dd6cbfa6a8dc2bdf19b46',
    // LANE-01 (2026-09-25): a reservation knows what it is. Was f5ecffcfa0b71b8cbe4ba8868a2f8aabd4e326129bacbf9a675e79b17e63fd2f.
    // CANCEL-01 (2026-09-26): re-pinned — was 8130c9e36431d886f48648f2b2ae2ad4a86413d7a9037a8959a79c620b242bf7 at main dccb3380.
    'src/lib/liteapiFlightsClient.ts': '0bae21fb9bf0bd9664dc7418502a35e507f713d370e542b878e35e2188b3121d',
  };
  for (const f of booking) assert.equal(BOOKING_FLOW_FILES.find((p) => p.file === f)!.sha256, original[f], `${f} is pinned at its TRAVEL-01 hash`);
});
