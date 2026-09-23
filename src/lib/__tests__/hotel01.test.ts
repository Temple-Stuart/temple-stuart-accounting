/**
 * HOTEL-01 (2026-09-22) — A HOTEL APPEARS ONCE, A RATE SAYS WHAT IT BUYS, AND
 * NOTHING ON THE SCREEN IS FROM A DEAD PROVIDER.
 *
 * Probed on the Phuket payload (fixtureHotelRatesPhuket.ts — the vendor's
 * documented /hotels/rates shape joined with the catalog row; no captured live
 * payload exists in the repository) and read from the source through the two
 * readers (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, rejoin } from '../sourceText';
import {
  DEFAULT_HOTEL_FILTERS, DIFFERENCE_ATTRIBUTES, NOT_STATED,
  applyRange, breakfastOf, countLine, hotelCardsOf, hotelFiltersOf, hotelFiltersStatement, hotelSearchParamsOf,
  lowestRate, lowestRateLine, rateDifference, refundableOf, starsText, statedText,
} from '../hotels/rates';
// HOTEL-02 (2026-09-22): the vendor's 12-hour clock reader lives with the stay's times now.
import { hhmmOf } from '../hotels/stayTimes';
import { HOTEL_FILTER_PARAMS, parseHotelFilters } from '../hotels/searchContract';
import { stated, statedBoolean, statedString } from '../travel/stated';
import { NOT_STATED as FLIGHT_NOT_STATED, statedText as flightStatedText } from '../flights/fares';
import { DATE_ONLY_TRIP_TYPES, TIMED_BY_THEMSELVES, overlayTripItems, type TripItemRow, type TripOverlayEvent } from '../calendar/tripItem';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import { PHUKET_EXPECTED as E, PHUKET_RATES } from './fixtureHotelRatesPhuket';

const ROUTE = 'src/app/api/travel/hotels/search/route.ts';
const CLIENT = 'src/lib/liteapiClient.ts';
const LEAF = 'src/lib/hotels/rates.ts';
const VIEW = 'src/components/trips/HotelResultsView.tsx';
const CONTAINER = 'src/components/trips/PublicHotelSearch.tsx';
const COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const GRID = 'src/components/shared/CalendarGrid.tsx';
const STATED = 'src/lib/travel/stated.ts';
const HOTEL_SURFACES = [VIEW, CONTAINER, 'src/components/trips/HotelPicker.tsx', 'src/components/trips/CheckoutPanel.tsx', 'src/components/trips/HotelGallery.tsx', 'src/components/trips/HotelMap.tsx', 'src/components/trips/LodgingOptions.tsx', 'src/components/trips/TransferPicker.tsx'];

const cards = () => hotelCardsOf(PHUKET_RATES);
const rateOf = (id: string) => cards().flatMap((c) => c.rates).find((r) => r.rateId === id)!;

test('many rates of one hotel group to one card — a hotel appears once, its rates beneath it, cheapest first', () => {
  const cs = cards();
  assert.equal(cs.length, E.hotels, 'five items, four hotels: the repeated Ibis item merged into its card');
  assert.equal(cs.reduce((n, c) => n + c.rates.length, 0), E.rates);
  assert.equal(countLine(cs), `${E.hotels} hotels · ${E.rates} rates`);
  const ibis = cs.find((c) => c.hotelId === 'lp-ibis')!;
  assert.equal(ibis.rates.length, E.ibisRates, 'room × board × cancellation under one roof; the repeated rate counted once');
  assert.deepEqual(ibis.rates.map((r) => r.rateId), ['r-ibis-ro', 'r-ibis-flex', 'r-ibis-bi', 'r-ibis-sea'], 'cheapest first');
  assert.equal(ibis.rates[0].perNight, 38, 'per night = total ÷ nights, to the cent');
  assert.equal(ibis.nights, 3);
  assert.deepEqual(cs.map((c) => c.hotelId), ['lp-ibis', 'lp-kata-rocks', 'lp-guesthouse', 'lp-marriott'], 'first-appearance order');
  // The identity is the vendor's hotelId — read from the leaf, never a name match.
  const leaf = code(LEAF);
  assert.match(leaf, /const byId = new Map<string, HotelCardView>\(\);/);
  assert.match(leaf, /byId\.get\(card\.hotelId\)/);
});

test('a null rating renders "not stated" — never a blank star row; every attribute is tri-state from the payload', () => {
  const gh = cards().find((c) => c.hotelId === 'lp-guesthouse')!;
  assert.equal(gh.stars, null);
  assert.equal(gh.guestRating, null);
  assert.equal(starsText(gh.stars), `stars ${NOT_STATED}`);
  assert.equal(starsText(3), '3★');
  const r = gh.rates[0];
  assert.deepEqual({ room: r.roomName, board: r.boardType, breakfast: r.breakfast, refundable: r.refundable, deadline: r.cancelDeadline, taxes: r.taxesIncluded, guests: r.maxOccupancy }, { room: null, board: null, breakfast: null, refundable: null, deadline: null, taxes: null, guests: null });
  assert.equal(statedText(r.refundable, 'refundable', 'non-refundable'), NOT_STATED);
  assert.equal(NOT_STATED, 'not stated by the property');
  // Stated values are the vendor's words, never the price's.
  assert.equal(refundableOf('RFN'), true); assert.equal(refundableOf('NRFN'), false); assert.equal(refundableOf('maybe'), null); assert.equal(refundableOf(undefined), null);
  assert.equal(breakfastOf('BI'), true); assert.equal(breakfastOf('RO'), false); assert.equal(breakfastOf('XX'), null); assert.equal(breakfastOf(null), null);
  const villa = rateOf('r-kr-villa');
  assert.equal(villa.taxesIncluded, false, 'one listed fee not included → not all included');
  assert.equal(rateOf('r-ibis-ro').taxesIncluded, true);
  assert.equal(rateOf('r-ibis-bi').cancelDeadline, '2026-11-08 00:00:00');
  // The view renders the cells through the tri-state text or NOT_STATED — read from the source.
  const view = code(VIEW);
  assert.match(view, /data-hotel-stars>\{starsText\(card\.stars\)\}/);
  assert.match(view, /data-hotel-guest-rating>[\s\S]{0,80}card\.guestRating === null \? `rating \$\{NOT_STATED\}`/);
  for (const f of ['refundable', 'taxesIncluded']) assert.match(view, new RegExp(`data-rate-field="${f}">\\{statedText\\(rate\\.${f},`));
  for (const f of ['room', 'board']) assert.match(view, new RegExp(`data-rate-field="${f}">\\{rate\\.[a-zA-Z]+ \\?\\? (rate\\.[a-zA-Z]+ \\?\\? )?NOT_STATED\\}`));
  assert.doesNotMatch(code(LEAF), /!!/, 'the leaf never coerces silence into false');
  // ONE tri-state helper: both leaves bind the one implementation.
  assert.equal(stated(null, 'y', 'n', 'absent'), 'absent');
  assert.equal(flightStatedText(null, 'y', 'n'), FLIGHT_NOT_STATED);
  assert.equal(statedBoolean(undefined), null); assert.equal(statedString('  '), null);
  assert.match(code(LEAF), /import \{ type Stated, stated, statedBoolean, statedNumber, statedString \} from '@\/lib\/travel\/stated';/);
  assert.match(code('src/lib/flights/fares.ts'), /import \{ type Stated, stated \} from '@\/lib\/travel\/stated';/);
  assert.match(code('src/lib/liteapiFlightAdapter.ts'), /import \{ statedBoolean, statedString \} from '@\/lib\/travel\/stated';/);
  for (const f of [LEAF, 'src/lib/flights/fares.ts', 'src/lib/liteapiFlightAdapter.ts']) assert.doesNotMatch(code(f), /(function|const) stated(Boolean|String|Number) ?[=(]/, `${f} defines no second tri-state reader`);
  assert.match(code(STATED), /export function stated\(v: Stated<boolean> \| undefined, yes: string, no: string, absent: string\): string/);
});

test('the benchmark and the difference lines come from stated attributes only', () => {
  const cs = cards();
  const low = lowestRate(cs)!;
  assert.equal(low.rate.rateId, E.lowest.rateId);
  assert.equal(low.rate.perNight, E.lowest.perNight);
  assert.equal(lowestRateLine(low), E.lowest.line);
  assert.equal(rateDifference(rateOf(E.breakfast.rateId), low.rate).line, E.breakfast.difference);
  assert.equal(rateDifference(rateOf(E.villa.rateId), low.rate).line, E.villa.difference);
  assert.equal(rateDifference(rateOf(E.guesthouse.rateId), low.rate).line, E.guesthouse.difference);
  assert.equal(rateDifference(low.rate, low.rate).line, 'This is the lowest rate meeting your filters.');
  assert.deepEqual(DIFFERENCE_ATTRIBUTES.map((a) => a.key), ['refundable', 'breakfast', 'taxesIncluded']);
  // The loop reads no price; an unstated attribute is set aside and named.
  const leaf = code(LEAF);
  const fn = leaf.slice(leaf.indexOf('export function rateDifference('), leaf.indexOf('// ─── The on-screen filter contract'));
  const loop = fn.slice(fn.indexOf('for (const { key, label } of DIFFERENCE_ATTRIBUTES)'), fn.indexOf('if (selected.roomName'));
  assert.doesNotMatch(loop, /total|perNight|price|delta/);
  assert.match(loop, /unstated\.push\(label\); continue;/);
  // The 4+ stars answer (the vendor filtered) moves the benchmark honestly.
  const fourPlus = cs.filter((c) => c.stars !== null && c.stars >= 4);
  assert.equal(lowestRateLine(lowestRate(fourPlus)), E.fourStarsLowest.line);
  // The per-night range narrows on this page and says so.
  const ranged = applyRange(cs, { ...DEFAULT_HOTEL_FILTERS, priceMax: '60' });
  assert.deepEqual(ranged.map((c) => `${c.hotelId}:${c.rates.length}`), ['lp-ibis:3', 'lp-guesthouse:1']);
  assert.match(hotelFiltersStatement({ ...DEFAULT_HOTEL_FILTERS, priceMax: '60' }), /price per night: to 60 \(applied on this page — the vendor takes no price range\)/);
  assert.match(code(VIEW), /data-hotel-llf>\{llf\}/);
  assert.match(code(VIEW), /data-rate-difference=\{diff\.delta\}>\{diff\.line\}/);
});

test('the route forwards the vendor\'s contract by name — unknown refused by name, absent → the vendor\'s default', () => {
  const get = (o: Record<string, string>) => (n: string) => (n in o ? o[n] : null);
  const ok = parseHotelFilters(['city', 'starRating', 'refundableRatesOnly', 'sort', 'sortDirection'], get({ city: 'Phuket', starRating: '4,4.5,5', refundableRatesOnly: 'true', sort: 'price', sortDirection: 'ascending' }));
  assert.deepEqual(ok, { filters: { starRating: [4, 4.5, 5], refundableRatesOnly: true, sort: [{ field: 'price', direction: 'ascending' }] } });
  assert.deepEqual(parseHotelFilters(['city'], get({ city: 'x' })), { filters: {} }, 'nothing set → nothing forwarded');
  assert.match((parseHotelFilters(['city', 'maxPrice'], get({ city: 'x', maxPrice: '5' })) as { error: string }).error, /^maxPrice is not a supported search parameter \(supported: /);
  assert.match((parseHotelFilters(['starRating'], get({ starRating: '4.2' })) as { error: string }).error, /^starRating must be a comma list of 1, 1\.5, 2/);
  assert.match((parseHotelFilters(['sort'], get({ sort: 'rating' })) as { error: string }).error, /^sort must be one of top_picks, price, revenue$/);
  assert.match((parseHotelFilters(['minRating'], get({ minRating: '8.6' })) as { error: string }).error, /^minRating is not a supported search parameter/, 'minRating is on two scales in the vendor\'s docs — not accepted');
  assert.match((parseHotelFilters(['refundableRatesOnly'], get({ refundableRatesOnly: 'yes' })) as { error: string }).error, /^refundableRatesOnly must be true or false$/);
  assert.match((parseHotelFilters(['boardType'], get({ boardType: 'BI,XX' })) as { error: string }).error, /^boardType must be a comma list of RO, BI, HB, FB, AI$/);
  assert.deepEqual([...HOTEL_FILTER_PARAMS], ['starRating', 'refundableRatesOnly', 'boardType', 'sort', 'sortDirection']);
  // The screen's controls → the vendor's names; "any" sends nothing.
  assert.deepEqual(hotelSearchParamsOf(DEFAULT_HOTEL_FILTERS), {});
  assert.deepEqual(hotelSearchParamsOf({ ...DEFAULT_HOTEL_FILTERS, stars: '4', refundableOnly: true, sort: 'price' }), { starRating: '4,4.5,5', refundableRatesOnly: 'true', sort: 'price', sortDirection: 'ascending' });
  assert.deepEqual(hotelFiltersOf({ ...DEFAULT_HOTEL_FILTERS, stars: '5' }), { starRating: [5] });
  assert.match(hotelFiltersStatement(DEFAULT_HOTEL_FILTERS), /^stars: any \(the vendor's default\) · refundable: not required · price per night: any · sort: the vendor's default order$/);
  // The route: parsed between the 400 validation and GUARD 2, forwarded unchanged; the env named from the env.
  const route = code(ROUTE);
  const at = (s: string) => route.indexOf(s);
  assert.ok(at("rateLimit(`hotel-search:") < at('parseHotelFilters([...params.keys()]') && at('parseHotelFilters([...params.keys()]') < at("reserveTravelSearch('liteapi')") && at("reserveTravelSearch('liteapi')") < at('searchHotelRates({'), 'rateLimit → validate → reserve → call');
  assert.match(route, /const parsed = parseHotelFilters\(\[\.\.\.params\.keys\(\)\], \(n\) => params\.get\(n\)\);\n\s+if \('error' in parsed\) return NextResponse\.json\(\{ error: parsed\.error \}, \{ status: 400 \}\);/);
  assert.match(route, /\.\.\.\(Number\.isFinite\(radiusMeters\) \? \{ radiusMeters \} : \{\}\),\n\s+\.\.\.filters,\n\s+\}\);/);
  assert.match(route, /const cards = hotelCardsOf\(hotels\);/);
  assert.match(route, /env: liteApiPaymentEnv\(\),/);
  // The client's search half carries the fields verbatim, only when set; the booking half is untouched (the pin test below).
  const client = code(CLIENT);
  assert.match(client, /\.\.\.\(params\.starRating\?\.length \? \{ starRating: params\.starRating \} : \{\}\),/);
  assert.match(client, /\.\.\.\(params\.refundableRatesOnly \? \{ refundableRatesOnly: true \} : \{\}\),/);
  assert.match(client, /\.\.\.\(params\.sort\?\.length \? \{ sort: params\.sort \} : \{\}\),/);
  assert.match(client, /qs\.set\('starRating', params\.starRating\.map\(\(n\) => n\.toFixed\(1\)\)\.join\(','\)\);/);
});

test('a stated check-in time draws the block from it; an unstated one is flagged and no clock is invented', () => {
  assert.equal(hhmmOf('04:00 PM'), '16:00'); assert.equal(hhmmOf('11:00 AM'), '11:00'); assert.equal(hhmmOf('12:00 AM'), '00:00'); assert.equal(hhmmOf('12:30 PM'), '12:30');
  assert.equal(hhmmOf('16:00'), '16:00'); assert.equal(hhmmOf('noon'), null); assert.equal(hhmmOf(null), null); assert.equal(hhmmOf('13:00 PM'), null);
  // HOTEL-02 (2026-09-22): the rates answer carries no clock — no card holds one; the
  // property's clock is read from its content at commit (hotel02.test.ts).
  for (const c of cards()) assert.ok(!('checkinTime' in c) && !('checkoutTime' in c), `${c.hotelId} carries no clock from the rates answer`);
  // The overlay: a stay's stated window is copied onto its row; an unstated one leaves the row all-day.
  const clockAt = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
  const items: TripItemRow[] = [
    { id: 'ti-kr', tripId: 't', vendorOptionId: 'hotel-kr', vendorOptionType: 'lodging', category: 'accommodation', vendor: 'Kata Rocks', vendor_name: 'LiteAPI', location: 'Phuket', block_start_time: clockAt('16:00'), block_end_time: clockAt('11:00') },
    { id: 'ti-gh', tripId: 't', vendorOptionId: 'hotel-gh', vendorOptionType: 'lodging', category: 'accommodation', vendor: 'Kata Guesthouse', vendor_name: 'LiteAPI', location: 'Phuket', block_start_time: null, block_end_time: null },
  ];
  const rows: Array<TripOverlayEvent & { id: string }> = [
    { id: 'e-kr', source: 'trip', source_id: 'trip:t:vendor:hotel-kr', start_time: null, end_time: null, location: null },
    { id: 'e-gh', source: 'trip', source_id: 'trip:t:vendor:hotel-gh', start_time: null, end_time: null, location: null },
  ];
  const out = overlayTripItems(rows, items);
  assert.equal(out[0].start_time, '16:00'); assert.equal(out[0].end_time, '11:00');
  assert.equal(out[1].start_time, null); assert.equal(out[1].end_time, null);
  assert.deepEqual([...DATE_ONLY_TRIP_TYPES], ['activity', 'transfer', 'vehicle', 'lodging']);
  assert.deepEqual([...TIMED_BY_THEMSELVES], ['flight']);
  // vendor-commit invents no time.
  const commit = code(COMMIT);
  assert.doesNotMatch(commit, /'15:00'|'11:00'/, 'the hotel-standard default is gone');
  assert.match(commit, /const blockStartParse = parseTimeOrNull\(startTime, 'block_start_time'\);\n\s+if \(blockStartParse\.error\) return blockStartParse\.error;/, 'a malformed time is refused by name');
  // HOTEL-02 (2026-09-22): the stay's clock is resolved once before the transaction — the
  // property's (read at commit) or the caller's stated one — and written to both columns.
  assert.match(commit, /const blockStart = stayStart\.value;\n\s+const blockEnd = stayEnd\.value;/);
  assert.match(commit, /homeTime: ledgerStart,\n\s+destDate: end, destTime: ledgerEnd,/);
  // HOTEL-02: the container names the hotel and sends NO clock — the commit reads the property's.
  const container = code(CONTAINER);
  assert.match(container, /liteapiHotelId: card\.hotelId,/);
  assert.doesNotMatch(container, /hhmmOf|startTime|endTime/, 'no clock leaves the search');
  // The panel and the grid say so.
  assert.match(code(PANEL), /row\.kind === 'trip_item' && row\.itemType === 'lodging'\n\s+\? 'check-in time not stated by the property'/);
  assert.match(code(GRID), /event\.itemType === 'lodging' \? `⚠ \$\{event\.title\} · check-in time not stated` : event\.title/);
});

test('no hotel surface names a provider other than the one the env selects; the sandbox footer comes from the env', () => {
  for (const f of HOTEL_SURFACES) {
    assert.doesNotMatch(code(f), /amadeus|duffel/i, `${f} names no retired provider`);
    assert.doesNotMatch(code(f), /(from|via|powered by|data from)\s+(?!liteapi)[A-Za-z.]+\s+API/i, `${f} attributes the screen to no other provider`);
  }
  const view = code(VIEW);
  assert.match(view, /TRAVEL \/ HOTEL SEARCH — LIVE PRICES VIA LITEAPI/);
  assert.match(view, /env === 'sandbox' \? 'Sandbox prices — not bookable' : 'Powered by LiteAPI/);
  assert.match(code(CONTAINER), /setEnv\(data\.env === 'live' \? 'live' : data\.env === 'sandbox' \? 'sandbox' : null\);/);
  assert.match(code(CLIENT), /export function liteApiPaymentEnv\(\): 'live' \| 'sandbox' \{\n\s+return getMode\(\) === 'production' \? 'live' : 'sandbox';/);
  assert.match(code(CLIENT), /return process\.env\.LITEAPI_MODE === 'production' \? 'production' : 'sandbox';/);
  assert.doesNotMatch(code('src/components/trips/HotelPicker.tsx'), /Test data from|test data/i);
});

test('no search fires on a filter change — five controls write the filters; one SEARCH press, counted', () => {
  const view = code(VIEW);
  assert.doesNotMatch(view, /useEffect|\bfetch\(/, 'the view is pure');
  const barFrom = view.indexOf('data-hotel-filters>');
  const barTo = view.indexOf('data-hotel-filters-stated');
  const bar = view.slice(barFrom, barTo);
  assert.equal((bar.match(/onChange=\{/g) ?? []).length, 5);
  assert.equal((bar.match(/onFiltersChange\(\{/g) ?? []).length, 5);
  assert.doesNotMatch(bar, /onBook|onSave|onSelect|onSubmit|\bfetch\(/);
  assert.match(view, /<SearchCount count=\{searchCount\} \/>/);
  const container = code(CONTAINER);
  assert.doesNotMatch(container, /useEffect/, 'the container runs no effect');
  assert.equal((container.match(/fetch\(`\/api\/travel\/hotels\/search/g) ?? []).length, 1);
  assert.equal((container.match(/setSearchCount\(\(n\) => n \+ 1\)/g) ?? []).length, 1);
  const searchAt = container.indexOf('const search = async');
  assert.ok(searchAt < container.indexOf('setSearchCount((n) => n + 1)') && container.indexOf('setSearchCount((n) => n + 1)') < container.indexOf('fetch(`/api/travel/hotels/search'), 'counted inside search, before the fetch');
  assert.match(container, /\.\.\.hotelSearchParamsOf\(filters\),/);
  assert.match(container, /onFiltersChange=\{\(patch\) => setFilters\(\(f\) => \(\{ \.\.\.f, \.\.\.patch \}\)\)\}/);
});

test('the booking-flow pin holds for every file still on it, with dated HOTEL-01 notes on the re-pinned files', () => {
  for (const pin of BOOKING_FLOW_FILES) {
    assert.equal(bookingFlowSha256(rejoin(code(pin.file), comments(pin.file))), pin.sha256, `${pin.file} hashes to its pin`);
  }
  assert.match(BOOKING_FLOW_BASE, /HOTEL-01 \(2026-09-22\), search and display are not booking/);
  const notes = comments('src/lib/travelBookingFlow.ts');
  const repinned = ['hotels/search/route.ts', 'HotelResultsView.tsx', 'PublicHotelSearch.tsx', 'HotelPicker.tsx', 'liteapiClient.ts', 'liteapiFlightAdapter.ts', 'FlightPickerView.tsx'];
  assert.equal((notes.match(/HOTEL-01 \(2026-09-22\): re-pinned/g) ?? []).length, repinned.length);
  for (const f of repinned) assert.match(code('src/lib/travelBookingFlow.ts'), new RegExp(`\\{ file: '[^']*${f.replace(/[.\[\]]/g, '\\$&')}', sha256: '[0-9a-f]{64}' \\}`));
  // The booking files keep their TRAVEL-01 hashes. CheckoutPanel is the one
  // exception and it is named: CHECKOUT-01 (2026-09-23) re-pinned it by its own
  // ruling — the panel states why it cannot take a card instead of leaving a blank
  // pane. No prebook/book/pay/cancel CALL changed.
  const booking: Record<string, string> = {
    'src/app/api/travel/liteapi/prebook/route.ts': 'dd6e8c9a0f1437a0661283bb91dc00aeb6dcaf6c227cefc180a3e01f1a60f351',
    // CAL-01 (2026-09-23): a stay now lands one calendar row; the booking itself is unchanged.
    'src/app/api/travel/liteapi/book/route.ts': '792da953ba83fe8a8bc95d79045a0fabd00bfc807fab3b726a69dd85ef136eb1',
    // Was 77564ce7471de9c4cb8dee188e596f3fe0b82f3526ba8fb39858e9831f992ff5 before CHECKOUT-01.
    'src/components/trips/CheckoutPanel.tsx': '3b6ae4fe18c1fb5e3701c592d6685e95bf336abb089d5d0aa947f3718dc7ef22',
    'src/app/api/travel/hotels/content/route.ts': '7923035f88437325994e957e73943cd4817ee72b2a9bf2908b0afba0803503e7',
    'src/app/api/travel/hotels/reviews/route.ts': 'c548e5cc1f16808c119711395144ddbc0f4307d22bd67890185b59479000d39d',
  };
  for (const [f, h] of Object.entries(booking)) assert.equal(BOOKING_FLOW_FILES.find((p) => p.file === f)!.sha256, h, `${f} is pinned at its TRAVEL-01 hash`);
});
