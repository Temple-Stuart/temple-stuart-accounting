/**
 * TRAVEL-01a (Alex, 2026-10-31, rulings A–F) — THE TRAVEL-DAY READ: one user-scoped GET hands the day's travel
 * facts as stated from three sources, each labelled, nothing merged, guessed or converted; read by nothing yet.
 *
 * The leaf is driven with fixtures (the range, the selection rules, the Decimal text, every said word, the three
 * orders, the answer); the route is read through code() / comments() (the reader law) for its gate order, its
 * user scope on every query, the segments' where, and what it must not hold.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  BOOKING_NO_CLOCK_WORDS, CANCELLED_WORDS, CANCEL_PENDING_WORDS, COST_NO_CURRENCY_WORDS, DAY_REQUIRED_WORDS, NO_END_WORDS, NO_INSTANT_WORDS,
  NO_ZONE_WORDS, PRICE_NOT_STATED_WORDS, TravelDayError, VENDOR_NAME_NOT_STATED_WORDS,
  bookingOrder, bookingRowsOf, bookingsSelectionOf, dayNotADayWords, dayRangeOf, decimalStringOf, plannedOrder, plannedRowOf, plannedSelectionOf,
  reservationIdOfSegment, segmentOrder, segmentRowOf, segmentsSelectionOf, travelDayOf,
  type BookingIn, type PlannedIn, type SegmentIn,
} from '../operations/travelDay';
import { reservationIdOfCalendarSourceId } from '../calendar/bookingEvent';

const LEAF = 'src/lib/operations/travelDay.ts';
const ROUTE = 'src/app/api/operations/travel-day/route.ts';

const DAY = '2026-10-31';
const range = (() => { const r = dayRangeOf(DAY); if (!r.ok) throw new Error('fixture'); return r.range; })();

/** A Decimal column's value as Prisma hands it (decimal.js toFixed is exact) — a stub with the same contract. */
const dec = (text: string) => ({ toFixed: (dp: number) => { const [w, f = ''] = text.split('.'); return `${w}.${f.padEnd(dp, '0').slice(0, dp)}`; } });

const flight: PlannedIn = {
  id: 'ti-flight', tripId: 'trip-1', category: 'flight', vendor: 'CNX → DPS', vendor_name: 'AirAsia', cost: dec('189.50'), coa_code: 'P-9100',
  recurrence: 'once', homeDate: new Date('2026-10-31T00:00:00.000Z'), homeTime: '14:10', destDate: new Date('2026-10-31T00:00:00.000Z'), destTime: '17:05',
  duration_minutes: 115, start_zone: 'Asia/Bangkok', end_zone: 'Asia/Makassar',
  start_at: new Date('2026-10-31T07:10:00.000Z'), end_at: new Date('2026-10-31T09:05:00.000Z'), block_start_time: null, block_end_time: null,
  vendorOptionId: 'opt-f', vendorOptionType: 'flight', note: null,
};
const hotel: PlannedIn = {
  ...flight, id: 'ti-hotel', category: 'lodging', vendor: 'Hotel Proof', vendor_name: null, cost: dec('1234.5'), coa_code: 'P-9200', recurrence: 'daily',
  homeDate: new Date('2026-10-29T00:00:00.000Z'), homeTime: '16:00', destDate: new Date('2026-11-02T00:00:00.000Z'), destTime: '11:00',
  duration_minutes: null, start_zone: null, end_zone: null, start_at: null, end_at: null,
  block_start_time: new Date('1970-01-01T16:00:00.000Z'), block_end_time: new Date('1970-01-01T11:00:00.000Z'), vendorOptionId: 'opt-h', vendorOptionType: 'lodging',
};
const transfer: PlannedIn = {
  ...flight, id: 'ti-transfer', category: 'transfer', vendor: 'Airport transfer', vendor_name: 'Bali Transfers', cost: dec('25'), coa_code: null,
  homeTime: '15:00', destTime: null, duration_minutes: null, start_zone: null, end_zone: null, start_at: null, end_at: null, vendorOptionId: 'opt-t', vendorOptionType: 'transfer',
};

const reservation = (over: Partial<BookingIn['reservation']>): BookingIn['reservation'] => ({
  id: 'res-hotel', lane: 'hotel', displayName: 'Hotel PHP Proof', provider: 'liteapi', providerConfirmationCode: 'ABC123', providerBookingId: 'b-1',
  status: 'confirmed', tripId: 'trip-1', checkinDate: new Date('2026-10-31T00:00:00.000Z'), checkoutDate: new Date('2026-11-02T00:00:00.000Z'),
  ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, lastVendorReadAt: null, finalPriceCents: 1234500, currency: 'PHP', createdAt: new Date('2026-10-20T00:00:00.000Z'),
  ...over,
});
const booking = (over: Partial<BookingIn['reservation']>, links: Partial<Omit<BookingIn, 'reservation'>> = {}): BookingIn => ({
  reservation: reservation(over), calendarDay: null, chargeMatched: false, chargePosted: false, chargeBank: null, budgetLine: null, ...links, // TRAVEL-01b (Alex, 2026-10-31), ruling B: the matched charge's bank row
});
const hotelBooking = booking({});
const flightBooking = booking({ id: 'res-flight', lane: 'flight', displayName: 'AirAsia CNX → DPS', checkinDate: null, checkoutDate: null, finalPriceCents: 18950, currency: 'USD' });

const seg0: SegmentIn = {
  source_id: 'res-flight:seg:0', title: 'AirAsia CNX → DPS (flight)', status: 'committed', start_date: new Date('2026-10-31T00:00:00.000Z'), end_date: new Date('2026-10-31T00:00:00.000Z'),
  start_time: new Date('1970-01-01T14:10:00.000Z'), end_time: new Date('1970-01-01T17:05:00.000Z'), start_at: new Date('2026-10-31T07:10:00.000Z'), end_at: new Date('2026-10-31T09:05:00.000Z'),
  start_zone: null, end_zone: null,
};
const seg1: SegmentIn = { ...seg0, source_id: 'res-flight:seg:1', title: 'AirAsia DPS → CNX (flight)', end_date: null, start_time: new Date('1970-01-01T21:30:00.000Z'), end_time: null, start_at: null, end_at: null };

// ─── A. the day and its range; the selection rules ───────────────────────────

test('A dayRangeOf: a day → [D 00:00Z, D+1 00:00Z); absent, blank, a month 13 and a day written the wrong way round are refused by name', () => {
  assert.deepEqual([range.day, range.from, range.to], [DAY, '2026-10-31T00:00:00.000Z', '2026-11-01T00:00:00.000Z']);
  const yearEnd = dayRangeOf('2026-12-31');
  assert.ok(yearEnd.ok && yearEnd.range.to === '2027-01-01T00:00:00.000Z');
  for (const bad of ['2026-13-01', '31/10/2026', '2026-02-30', 'bad', 20261031, {}]) {
    const r = dayRangeOf(bad);
    assert.ok(!r.ok && r.field === 'day' && r.message === dayNotADayWords(bad), JSON.stringify(bad));
  }
  for (const absent of [null, undefined, '']) {
    const r = dayRangeOf(absent);
    assert.ok(!r.ok && r.field === 'day' && r.message === DAY_REQUIRED_WORDS);
  }
});

test('A the selection rules restate day-blocks :52-61 as where data: a once row by homeDate in the range, a daily row spanning the day; bookings by either date; segments by start_date', () => {
  const from = new Date(range.from), to = new Date(range.to);
  assert.deepEqual(plannedSelectionOf(range), { OR: [{ recurrence: 'once', homeDate: { gte: from, lt: to } }, { recurrence: 'daily', homeDate: { lt: to }, destDate: { gte: from } }] });
  assert.deepEqual(bookingsSelectionOf(range), { OR: [{ checkinDate: { gte: from, lt: to } }, { checkoutDate: { gte: from, lt: to } }] });
  assert.deepEqual(segmentsSelectionOf(range), { start_date: { gte: from, lt: to } });
  // The rule, applied by hand to fixtures: a once row on the day / off the day; a daily row spanning the day / ending the day before.
  const once = (homeDate: string) => homeDate >= range.from.slice(0, 10) && homeDate < range.to.slice(0, 10);
  const daily = (homeDate: string, destDate: string) => homeDate < range.to.slice(0, 10) && destDate >= range.day;
  assert.equal(once('2026-10-31'), true);
  assert.equal(once('2026-11-01'), false);
  assert.equal(daily('2026-10-29', '2026-11-02'), true);
  assert.equal(daily('2026-10-28', '2026-10-30'), false);
  assert.equal(daily('2026-10-29', '2026-10-31'), true, 'a daily row whose last day is the day is on it');
});

// ─── B/C. the rows, as stored, each absence said ─────────────────────────────

test('C decimalStringOf: the Decimal’s own two-decimal text — 1234.5 → "1234.50", 25 → "25.00", never a float; a text that is not two decimals is refused by name', () => {
  assert.equal(decimalStringOf(dec('1234.50')), '1234.50');
  assert.equal(decimalStringOf(dec('1234.5')), '1234.50');
  assert.equal(decimalStringOf(dec('25')), '25.00');
  assert.equal(decimalStringOf(dec('0.1')), '0.10');
  assert.throws(() => decimalStringOf({ toFixed: () => '12.345' }), (e: unknown) => e instanceof TravelDayError && /"12\.345" is not a two-decimal figure/.test((e as Error).message));
  assert.throws(() => decimalStringOf({ toFixed: () => 'NaN' }), TravelDayError);
});

test('B1 a planned row carries every column as stored: the flight with its zones and instants says only the cost’s currency; the daily row says its legacy title and no zone; the transfer says no end and no zone', () => {
  const f = plannedRowOf(flight);
  assert.deepEqual(f, {
    source: 'planned', id: 'ti-flight', tripId: 'trip-1', category: 'flight', vendorName: 'AirAsia', vendor: 'CNX → DPS', cost: '189.50', currency: null, coaCode: 'P-9100',
    recurrence: 'once', homeDate: '2026-10-31', homeTime: '14:10', destDate: '2026-10-31', destTime: '17:05', durationMinutes: 115,
    startZone: 'Asia/Bangkok', endZone: 'Asia/Makassar', startAt: '2026-10-31T07:10:00.000Z', endAt: '2026-10-31T09:05:00.000Z',
    blockStartTime: null, blockEndTime: null, vendorOptionId: 'opt-f', vendorOptionType: 'flight', note: null,
    said: [COST_NO_CURRENCY_WORDS],
  });
  const h = plannedRowOf(hotel);
  assert.equal(h.cost, '1234.50');
  assert.equal(h.vendorName, null);
  assert.equal(h.vendor, 'Hotel Proof', 'the legacy title is its own field — never substituted for the name');
  assert.deepEqual([h.blockStartTime, h.blockEndTime, h.homeTime, h.destTime, h.recurrence], ['16:00', '11:00', '16:00', '11:00', 'daily']);
  assert.deepEqual(h.said, [COST_NO_CURRENCY_WORDS, VENDOR_NAME_NOT_STATED_WORDS, NO_ZONE_WORDS]);
  const t = plannedRowOf(transfer);
  assert.deepEqual([t.cost, t.homeTime, t.destTime, t.startAt, t.startZone], ['25.00', '15:00', null, null, null]);
  assert.deepEqual(t.said, [COST_NO_CURRENCY_WORDS, NO_END_WORDS, NO_ZONE_WORDS]);
  // A daily row with no window states no end.
  assert.ok(plannedRowOf({ ...hotel, block_end_time: null }).said.includes(NO_END_WORDS));
});

test('B2 a booking’s rows on the day: a check-in on its check-in day, a check-out on its check-out day, both when both; clock null and said; the one leaf’s row beside the stated facts; price and status said', () => {
  const [checkIn] = bookingRowsOf(hotelBooking, '2026-10-31');
  assert.equal(checkIn.source, 'booking');
  assert.equal(checkIn.kind, 'check-in');
  assert.equal(checkIn.clock, null);
  assert.deepEqual(checkIn.reservation, {
    id: 'res-hotel', lane: 'hotel', displayName: 'Hotel PHP Proof', provider: 'liteapi', status: 'confirmed', tripId: 'trip-1',
    finalPriceCents: 1234500, currency: 'PHP', checkinDate: '2026-10-31', checkoutDate: '2026-11-02',
  });
  assert.deepEqual(checkIn.charge, { matched: false, posted: false, bank: null }); // TRAVEL-01b (Alex, 2026-10-31): the bank figure, null when not matched
  assert.equal(checkIn.budgetLine, null);
  assert.equal(checkIn.row.price, '12345.00 PHP', 'the one leaf’s words — the point placed by string');
  assert.equal(checkIn.row.dates, '2026-10-31 → 2026-11-02');
  assert.deepEqual(checkIn.said, [BOOKING_NO_CLOCK_WORDS]);
  const [checkOut] = bookingRowsOf(hotelBooking, '2026-11-02');
  assert.equal(checkOut.kind, 'check-out');
  assert.equal(bookingRowsOf(hotelBooking, '2026-10-30').length, 0);
  assert.equal(bookingRowsOf(flightBooking, '2026-10-31').length, 0, 'a flight has no stay dates');
  const both = bookingRowsOf(booking({ checkoutDate: new Date('2026-10-31T00:00:00.000Z') }), '2026-10-31');
  assert.deepEqual(both.map((r) => r.kind), ['check-in', 'check-out']);
  const [unpriced] = bookingRowsOf(booking({ finalPriceCents: null, status: 'cancelled' }), '2026-10-31');
  assert.deepEqual(unpriced.said, [BOOKING_NO_CLOCK_WORDS, PRICE_NOT_STATED_WORDS, CANCELLED_WORDS]);
  assert.equal(unpriced.reservation.finalPriceCents, null, 'null stays null');
  const [pending] = bookingRowsOf(booking({ status: 'cancel_pending' }), '2026-10-31');
  assert.ok(pending.said.includes(CANCEL_PENDING_WORDS));
  // TRAVEL-01b (Alex, 2026-10-31), ruling B: a matched charge carries its bank row (travel01b.test.ts drives the figure and its words). Moved, not loosened.
  const bank = { amount: 189.5, currency: 'USD', date: '2026-10-31' };
  const [linked] = bookingRowsOf(booking({}, { chargeMatched: true, chargePosted: true, chargeBank: bank, budgetLine: { description: 'Nights in Siargao' } }), '2026-10-31');
  assert.deepEqual([linked.charge, linked.budgetLine, linked.row.bank, linked.row.ledger, linked.row.budgetLine], [{ matched: true, posted: true, bank }, { description: 'Nights in Siargao' }, 'matched', 'posted', 'Nights in Siargao']);
});

test('B3 a segment row: the stated day and clock, an end only when stated, an instant only when stored, no zone — each absence said; its reservation’s facts beside it; the reservation id by the one key rule', () => {
  const s0 = segmentRowOf(seg0, flightBooking);
  assert.deepEqual(
    [s0.source, s0.sourceId, s0.reservationId, s0.title, s0.status, s0.startDate, s0.startTime, s0.endDate, s0.endTime, s0.startAt, s0.endAt, s0.startZone, s0.endZone],
    ['segment', 'res-flight:seg:0', 'res-flight', 'AirAsia CNX → DPS (flight)', 'committed', '2026-10-31', '14:10', '2026-10-31', '17:05', '2026-10-31T07:10:00.000Z', '2026-10-31T09:05:00.000Z', null, null],
  );
  assert.deepEqual(s0.said, [NO_ZONE_WORDS]);
  assert.equal(s0.reservation.currency, 'USD');
  assert.equal(s0.row.laneWord, 'Flight');
  const s1 = segmentRowOf(seg1, flightBooking);
  assert.deepEqual([s1.startTime, s1.endDate, s1.endTime, s1.startAt], ['21:30', null, null, null]);
  assert.deepEqual(s1.said, [NO_END_WORDS, NO_INSTANT_WORDS, NO_ZONE_WORDS]);
  for (const id of ['res-flight', 'res-flight:seg:0', 'res-flight:seg:12']) assert.equal(reservationIdOfSegment(id), reservationIdOfCalendarSourceId(id), 'the same rule as bookingEvent.ts');
  assert.throws(() => segmentRowOf({ ...seg0, source_id: null }, flightBooking), TravelDayError);
  assert.throws(() => segmentRowOf(seg0, hotelBooking), (e: unknown) => e instanceof TravelDayError && /was handed booking res-hotel/.test((e as Error).message));
});

// ─── B. the orders and the answer ────────────────────────────────────────────

test('B the three orders: planned by block_start_time, then homeTime, then id (nulls last); segments by start_time then source_id; bookings check-out before check-in, then displayName', () => {
  const planned = [transfer, flight, hotel].map(plannedRowOf).sort(plannedOrder);
  assert.deepEqual(planned.map((r) => r.id), ['ti-hotel', 'ti-flight', 'ti-transfer']);
  const noClock = plannedRowOf({ ...transfer, id: 'ti-a', homeTime: null });
  assert.deepEqual([plannedRowOf(transfer), noClock].sort(plannedOrder).map((r) => r.id), ['ti-transfer', 'ti-a']);
  assert.deepEqual([seg1, seg0].map((s) => segmentRowOf(s, flightBooking)).sort(segmentOrder).map((s) => s.sourceId), ['res-flight:seg:0', 'res-flight:seg:1']);
  const out = bookingRowsOf(booking({ id: 'res-b', displayName: 'B stay', checkinDate: new Date('2026-10-29T00:00:00.000Z'), checkoutDate: new Date('2026-10-31T00:00:00.000Z') }), DAY);
  const inA = bookingRowsOf(booking({ id: 'res-a', displayName: 'A stay' }), DAY);
  const inNull = bookingRowsOf(booking({ id: 'res-n', displayName: null }), DAY);
  assert.deepEqual([...inNull, ...inA, ...out].sort(bookingOrder).map((r) => `${r.kind} ${r.reservation.id}`), ['check-out res-b', 'check-in res-a', 'check-in res-n']);
});

test('B travelDayOf: three labelled lists in their orders with their counts; a segment names its reservation’s facts; a reservation handed twice or a segment with no facts is refused by name — no cross-source merge, no stop', () => {
  const answer = travelDayOf({ range, planned: [transfer, flight, hotel], bookings: [hotelBooking, flightBooking], segments: [seg1, seg0] });
  assert.equal(answer.day, DAY);
  assert.deepEqual(answer.counts, { planned: 3, bookings: 1, segments: 2 });
  assert.deepEqual(answer.planned.map((r) => r.id), ['ti-hotel', 'ti-flight', 'ti-transfer']);
  assert.deepEqual(answer.bookings.map((r) => [r.kind, r.reservation.id]), [['check-in', 'res-hotel']]);
  assert.deepEqual(answer.segments.map((s) => [s.sourceId, s.reservationId, s.reservation.displayName]), [['res-flight:seg:0', 'res-flight', 'AirAsia CNX → DPS'], ['res-flight:seg:1', 'res-flight', 'AirAsia CNX → DPS']]);
  assert.ok(!('stops' in answer));
  for (const row of [...answer.planned, ...answer.bookings, ...answer.segments]) assert.ok(Array.isArray(row.said));
  assert.throws(() => travelDayOf({ range, planned: [], bookings: [hotelBooking, hotelBooking], segments: [] }), (e: unknown) => e instanceof TravelDayError && /handed over twice/.test((e as Error).message));
  assert.throws(() => travelDayOf({ range, planned: [], bookings: [hotelBooking], segments: [seg0] }), (e: unknown) => e instanceof TravelDayError && /facts were not handed over/.test((e as Error).message));
  // Every cost is a two-decimal string, never a number.
  for (const r of answer.planned) assert.match(r.cost, /^-?\d+\.\d{2}$/);
  assert.equal(JSON.stringify(answer).includes('"cost":1'), false);
});

// ─── A/E/F. the route, read ──────────────────────────────────────────────────

test('E the route: the siblings’ gate order (getVerifiedEmail → 401 → the users row → 404 → day → 400); every query names user.id; the segments are read through bookingCalendarRowsWhere over the caller’s own reservation ids only', () => {
  const src = code(ROUTE);
  const at = (s: string) => { const i = src.indexOf(s); assert.ok(i >= 0, `the route holds ${JSON.stringify(s)}`); return i; };
  const gate = [at('const userEmail = await getVerifiedEmail();'), at("{ status: 401 }"), at('prisma.users.findFirst({ where: { email: { equals: userEmail, mode: \'insensitive\' } }'), at('{ status: 404 }'), at("dayRangeOf(request.nextUrl.searchParams.get('day'))"), at('{ status: 400 }')];
  assert.deepEqual([...gate].sort((a, b) => a - b), gate, 'the gate in order');
  // The same gate the stays sibling runs (operations/stays/route.ts :28-31).
  const sibling = code('src/app/api/operations/stays/route.ts');
  assert.ok(sibling.includes('const userEmail = await getVerifiedEmail();') && sibling.includes("return NextResponse.json({ error: 'User not found' }, { status: 404 });"));
  // Every query is the caller's.
  at("where: { trip: { userId: user.id }, ...plannedSelectionOf(range) }");
  at("where: { userId: user.id, ...bookingsSelectionOf(range) }");
  at("where: { userId: user.id }, select: { id: true }");
  at("where: { user_id: user.id, ...bookingCalendarRowsWhere(ownIds), ...segmentsSelectionOf(range) }");
  at("where: { userId: user.id, id: { in: missing } }");
  at("where: { userId: user.id, status: 'accepted', moneyEventId: null, reservationId: { in: ids } }");
  at("where: { userId: user.id, document_money_event_id: null, status: 'posted', document_reservation_id: { in: ids } }");
  at("where: { userId: user.id, reservationId: { in: ids } }");
  at("where: { user_id: user.id, ...bookingCalendarRowsWhere(ids) }");
  const queries = (src.match(/prisma\.\w+\.findMany\(/g) ?? []).length;
  const scoped = (src.match(/where: \{ (userId|user_id): user\.id|where: \{ trip: \{ userId: user\.id \}/g) ?? []).length;
  assert.equal(queries, 9, 'nine reads');
  assert.equal(scoped, 9, 'every one of them names user.id');
  assert.doesNotMatch(src, /source: 'reservation'/, 'segments are never read by source alone — the where comes from the caller’s keys');
  assert.doesNotMatch(src, /tripId: \{ in/, 'never by trip');
  at("return failClosedResponse('Travel day GET'");
});

test('F the leaf and the route hold no Number(, no `||`, no `?? <default>`, no `$` before a figure, no Prisma in the leaf; bookingRowOf is imported, not re-declared; the header says the reader is 01b and day-blocks stays', () => {
  for (const f of [LEAF, ROUTE]) {
    const src = code(f);
    assert.doesNotMatch(src, /Number\(/, `${f} converts nothing`);
    assert.doesNotMatch(src, /\|\|/, `${f} holds no ||`);
    assert.doesNotMatch(src, /\?\? /, `${f} holds no ?? default`);
    assert.doesNotMatch(src, /\$\$\{|>\$<|['"]\$['"]\s*\+/, `${f} prints no $`);
    assert.doesNotMatch(src, /parseFloat|toLocaleString|Intl\.NumberFormat|\* 100\b|\/ 100\b/, `${f} converts no figure`);
  }
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /prisma|fetch\(|Date\.now|from 'react'/i);
  assert.match(leaf, /import \{ bookingRowOf, type BookingRow, type BookingRowFacts, type BookingRowReservation \} from '@\/lib\/reservations\/bookingRow';/);
  assert.doesNotMatch(leaf, /function bookingRowOf|const bookingRowOf/);
  assert.match(leaf, /import \{ isIsoDay \} from '@\/lib\/budget\/days';/, 'the one day rule');
  assert.match(leaf, /value\.toFixed\(2\)/, 'the Decimal’s own text');
  const words = comments(ROUTE);
  // TRAVEL-01b (Alex, 2026-10-31): the day card reads the route now (dayReads.ts readTravelDay) — the header says so; 'READ BY NOTHING YET' left with 01a. Moved, not loosened.
  assert.ok(words.includes('READ BY THE DAY CARD') && words.includes('TRAVEL-01b'));
  assert.ok(words.includes('does NOT read /api/trips/day-blocks'));
  assert.ok(comments(LEAF).includes('THIS FILE IS PURE'));
  // day-blocks is untouched by 01a and 01b alike.
  assert.match(code('src/components/workbench/operations/day/dayReads.ts'), /travel-day/, 'TRAVEL-01b: the ninth read');
  assert.match(code('src/app/api/trips/day-blocks/route.ts'), /vendorName: r\.vendor_name \|\| r\.vendor,/, 'day-blocks stays as it is until CLEAN-SHOP');
});
