/**
 * TRAVEL-01b (Alex, 2026-10-31, rulings A–J) — THE FOURTH SOURCE ON THE DAY CARD: travel stops in the clock they state;
 * the TRAVEL line beside the TOTAL; the deck's travel card; the reel's flight scene.
 *
 * The rules (dayCard.ts) are driven over the travel leaf's own fixtures (travelDayOf over 01a's rows, so the card reads
 * exactly what the route hands it); the ninth read (dayReads.ts) over a stubbed fetch; the leaf's bank figure and the one
 * stated-price function over fixtures; the route, the card and the matcher through code() / comments() (the reader law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { statedMoneyWords } from '../books/functionalCurrency';
import {
  BOOKING_NO_CLOCK_WORDS, CANCELLED_WORDS, CANCEL_PENDING_WORDS, COST_NO_CURRENCY_WORDS, NO_END_WORDS, NO_ZONE_WORDS, PRICE_NOT_STATED_WORDS,
  TravelDayError, VENDOR_NAME_NOT_STATED_WORDS, bookingRowsOf, dayRangeOf, segmentRowOf, travelDayOf, type BookingIn, type PlannedIn, type SegmentIn, type TravelDay,
} from '../operations/travelDay';
import { readTravelDay, travelFailedWords } from '@/components/workbench/operations/day/dayReads';
import {
  AS_AIRLINE_STATES_WORDS, CAPTION_TRAVEL_HEAD_WORDS, NOT_JOINED_WORDS, NO_CLOCK_WORDS, PLANNED_NOT_BOOKING_WORDS, PLANNED_STAY_WORDS, REEL_READ_NAMES,
  TRAVEL_KIND_WORDS, TRAVEL_NOT_READ_WORDS, TRAVEL_RECORD_WORDS, TRAVEL_SOURCE_WORDS, TRAVEL_WORD,
  captionText, completenessWords, dayStops, dayTotals, dayVerdict, matchedWords, plannedKindOf, plannedMinutesOf, reelReadsWords, scriptText, statusWords, stepHeaderWords,
  stopSceneLines, travelArrivalWords, travelClockWords, travelLineWords, travelMatchWords, travelOf, travelPriceWords, travelRecordWords, travelSaidWords, travelSmallWords,
  travelStatusLineWords, travelTotals, type ReelReads, type Stop,
} from '@/components/workbench/operations/day/dayCard';
import { FULL, STAY, build, input, reelDay } from './fixtureReelDay';

const DAY_DIR = 'src/components/workbench/operations/day';
const RULES = `${DAY_DIR}/dayCard.ts`;
const CARD = `${DAY_DIR}/DayCard.tsx`;
const READS = `${DAY_DIR}/dayReads.ts`;
const LEAF = 'src/lib/operations/travelDay.ts';
const ROUTE = 'src/app/api/operations/travel-day/route.ts';
const HOME = 'src/lib/books/functionalCurrency.ts';
const MATCHER = 'src/lib/runway/reservationMatcher.ts';

// ── FIXTURES — 01a's rows, through the leaf, so the card reads exactly the route's answer ──

const DAY = '2026-10-15';
const range = (() => { const r = dayRangeOf(DAY); if (!r.ok) throw new Error('fixture'); return r.range; })();
const dec = (text: string) => ({ toFixed: (dp: number) => { const [w, f = ''] = text.split('.'); return `${w}.${f.padEnd(dp, '0').slice(0, dp)}`; } });
const midnight = new Date(`${DAY}T00:00:00.000Z`);

const flight: PlannedIn = {
  id: 'ti-flight', tripId: 'trip-1', category: 'flight', vendor: 'CNX → DPS', vendor_name: 'AirAsia', cost: dec('189.50'), coa_code: 'P-9100',
  recurrence: 'once', homeDate: midnight, homeTime: '14:10', destDate: midnight, destTime: '17:05',
  duration_minutes: 115, start_zone: 'Asia/Bangkok', end_zone: 'Asia/Makassar',
  start_at: new Date(`${DAY}T07:10:00.000Z`), end_at: new Date(`${DAY}T09:05:00.000Z`), block_start_time: null, block_end_time: null,
  vendorOptionId: 'opt-f', vendorOptionType: 'flight', note: null,
};
const hotel: PlannedIn = {
  ...flight, id: 'ti-hotel', category: 'lodging', vendor: 'Hotel Proof', vendor_name: null, cost: dec('1234.5'), coa_code: 'P-9200', recurrence: 'daily',
  homeDate: new Date('2026-10-13T00:00:00.000Z'), homeTime: '16:00', destDate: new Date('2026-10-17T00:00:00.000Z'), destTime: '11:00',
  duration_minutes: null, start_zone: null, end_zone: null, start_at: null, end_at: null,
  block_start_time: new Date('1970-01-01T16:00:00.000Z'), block_end_time: new Date('1970-01-01T11:00:00.000Z'), vendorOptionId: 'opt-h', vendorOptionType: 'lodging',
};
const transfer: PlannedIn = {
  ...flight, id: 'ti-transfer', category: 'transfer', vendor: 'Airport transfer', vendor_name: 'Bali Transfers', cost: dec('25'), coa_code: null,
  homeTime: '15:00', destTime: '15:00', duration_minutes: null, start_zone: null, end_zone: null, start_at: null, end_at: null, vendorOptionId: 'opt-t', vendorOptionType: 'transfer',
};
const reservation = (over: Partial<BookingIn['reservation']>): BookingIn['reservation'] => ({
  id: 'res-hotel', lane: 'hotel', displayName: 'Hotel PHP Proof', provider: 'liteapi', providerConfirmationCode: 'ABC123', providerBookingId: 'b-1',
  status: 'confirmed', tripId: 'trip-1', checkinDate: midnight, checkoutDate: new Date('2026-10-17T00:00:00.000Z'),
  ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, lastVendorReadAt: null, finalPriceCents: 1234500, currency: 'PHP', createdAt: new Date('2026-10-01T00:00:00.000Z'),
  ...over,
});
const booking = (over: Partial<BookingIn['reservation']>, links: Partial<Omit<BookingIn, 'reservation'>> = {}): BookingIn => ({
  reservation: reservation(over), calendarDay: null, chargeMatched: false, chargePosted: false, chargeBank: null, budgetLine: null, ...links,
});
const BANK = { amount: 189.5, currency: 'USD', date: DAY };
const hotelBooking = booking({});
const flightBooking = booking(
  { id: 'res-flight', lane: 'flight', displayName: 'AirAsia CNX → DPS', checkinDate: null, checkoutDate: null, finalPriceCents: 18950, currency: 'USD' },
  { chargeMatched: true, chargePosted: false, chargeBank: BANK },
);
const seg0: SegmentIn = {
  source_id: 'res-flight:seg:0', title: 'AirAsia CNX → DPS (flight)', status: 'committed', start_date: midnight, end_date: midnight,
  start_time: new Date('1970-01-01T14:10:00.000Z'), end_time: new Date('1970-01-01T17:05:00.000Z'), start_at: new Date(`${DAY}T07:10:00.000Z`), end_at: new Date(`${DAY}T09:05:00.000Z`),
  start_zone: null, end_zone: null,
};
const seg1: SegmentIn = { ...seg0, source_id: 'res-flight:seg:1', title: 'AirAsia DPS → CNX (flight)', end_date: null, start_time: new Date('1970-01-01T21:30:00.000Z'), end_time: null, start_at: null, end_at: null };

const TRAVEL: TravelDay = travelDayOf({ range, planned: [transfer, flight, hotel], bookings: [hotelBooking, flightBooking], segments: [seg1, seg0] });
const travelDay = (over: Partial<TravelDay> = {}): TravelDay => ({ ...TRAVEL, ...over });
const stopAt = (stops: readonly Stop[], key: string): Stop => {
  const s = stops.find((x) => x.key === key);
  if (s === undefined) throw new Error(`no stop ${key} among ${stops.map((x) => x.key).join(', ')}`);
  return s;
};

// ── D · THE STOPS ────────────────────────────────────────────────────────────

test('D a planned once flight: a timed stop at its stated clock in its own zone, role none, no plan line, open from the booking; stated null and the cost’s currency said; the kind by category; planned — not a booking', () => {
  const r = dayStops(input({ travel: travelDay() }));
  const s = stopAt(r.stops, 'travel:planned:ti-flight');
  assert.deepEqual(
    [s.kind, s.time, s.zone, s.label, s.line, s.vendor, s.location, s.cents, s.status, s.statusSource, s.role, s.planLine, s.planLineState, s.address, s.record, s.actualCents, s.minutes],
    ['travel', '14:10', 'Asia/Bangkok', 'AirAsia', null, null, null, null, 'open', 'booking', 'none', null, 'none', null, null, null, 115],
  );
  const t = travelOf(s);
  assert.deepEqual([t.source, t.kind, t.name, t.stated, t.said, t.startZone, t.endZone, t.startAt, t.endAt, t.endTime, t.bookingStatus, t.charge, t.row],
    ['planned', 'flight', 'AirAsia', null, [COST_NO_CURRENCY_WORDS], 'Asia/Bangkok', 'Asia/Makassar', `${DAY}T07:10:00.000Z`, `${DAY}T09:05:00.000Z`, '17:05', null, null, null]);
  assert.equal(travelSmallWords(s), `Flight · ${TRAVEL_SOURCE_WORDS.planned}`);
  assert.equal(travelClockWords(s), '14:10 Asia/Bangkok', 'the stated clock in the stated zone — nothing converted');
  assert.equal(travelArrivalWords(s), 'arrives 17:05');
  assert.equal(travelPriceWords(s), PRICE_NOT_STATED_WORDS, 'the cost states no currency: no figure printed, the said line names it');
  assert.equal(travelStatusLineWords(s), null);
  assert.equal(travelMatchWords(s), null);
  assert.equal(travelSaidWords(s), COST_NO_CURRENCY_WORDS);
  assert.equal(travelRecordWords(s), PLANNED_NOT_BOOKING_WORDS);
  assert.equal(statusWords(s, DAY), 'open');
  // The kind by category: the four named, anything else 'other'.
  assert.deepEqual(['flight', 'transfer', 'activity', 'lodging', 'vehicle', 'constructor', ''].map(plannedKindOf), ['flight', 'transfer', 'activity', 'lodging', 'other', 'other', 'other']);
  assert.deepEqual(TRAVEL_KIND_WORDS, { flight: 'Flight', transfer: 'Transfer', activity: 'Activity', lodging: 'Stay', other: 'Travel', 'check-in': 'Check-in', 'check-out': 'Check-out' });
  // Every travel stop is among the stops, by its key; the band holds the daily row alone.
  assert.deepEqual(r.stops.filter((x) => x.kind === 'travel').map((x) => x.key), ['travel:planned:ti-flight', 'travel:segment:res-flight:seg:0', 'travel:planned:ti-transfer', 'travel:segment:res-flight:seg:1', 'travel:booking:res-hotel:check-in']);
  assert.deepEqual(r.allDay.map((x) => x.key), ['travel:planned:ti-hotel']);
});

test('D/E a segment: a timed stop at the clock the airline states, no zone — "as the airline states it" and no zone said; minutes from startTime→endTime when the end is stated on the day, null when not; the bank figure on its match line', () => {
  const r = dayStops(input({ travel: travelDay() }));
  const s0 = stopAt(r.stops, 'travel:segment:res-flight:seg:0');
  // TRAVEL-01c (Alex, 2026-10-31) item 0: a segment stop is named by its own stated title; the booking's name is its BOOKING line. Moved, not loosened.
  assert.deepEqual([s0.time, s0.zone, s0.minutes, s0.label, s0.status, s0.statusSource, s0.role], ['14:10', null, 175, 'AirAsia CNX → DPS (flight)', 'open', 'booking', 'none']);
  assert.equal(travelOf(s0).bookingName, 'AirAsia CNX → DPS');
  assert.equal(travelClockWords(s0), `14:10 ${AS_AIRLINE_STATES_WORDS}`);
  assert.equal(travelSaidWords(s0), NO_ZONE_WORDS);
  assert.equal(travelArrivalWords(s0), 'arrives 17:05');
  assert.equal(travelPriceWords(s0), '$189.50', 'USD through the one formatter');
  assert.equal(travelStatusLineWords(s0), 'confirmed');
  assert.equal(travelMatchWords(s0), `matched: $189.50 on ${DAY}`);
  assert.equal(matchedWords(BANK), `matched: $189.50 on ${DAY}`);
  assert.equal(matchedWords({ amount: 2520, currency: 'THB', date: '2026-10-14' }), 'matched: 2520.00 THB on 2026-10-14');
  assert.equal(matchedWords({ amount: 7, currency: null, date: '2026-10-14' }), 'matched: 7.00 (currency not stated) on 2026-10-14', 'a NULL account currency is carried and named');
  assert.equal(travelRecordWords(s0), TRAVEL_RECORD_WORDS);
  assert.equal(travelSmallWords(s0), 'Flight · segment');
  const s1 = stopAt(r.stops, 'travel:segment:res-flight:seg:1');
  assert.deepEqual([s1.time, s1.minutes, travelArrivalWords(s1)], ['21:30', null, null], 'no end stated: no length, no arrival');
  // TRAVEL-01c (Alex, 2026-10-31), ruling A: a segment with no instant cannot supersede, and the said line says so. Moved, not loosened.
  assert.equal(travelSaidWords(s1), `${NO_END_WORDS} · no instant — the vendor stated a local clock · ${NO_ZONE_WORDS} · cannot supersede — no instant`);
  // A segment on a flight with no match: the leaf's own bank words.
  const unmatched = travelDayOf({ range, planned: [], bookings: [booking({ id: 'res-flight', lane: 'flight', displayName: 'AirAsia CNX → DPS', checkinDate: null, checkoutDate: null, finalPriceCents: 18950, currency: 'USD' })], segments: [seg0] });
  assert.equal(travelMatchWords(stopAt(dayStops(input({ travel: unmatched })).stops, 'travel:segment:res-flight:seg:0')), 'not matched');
  // The clock order: travel stops sort among the timed stops by the clock they state; a booking is untimed.
  const full = dayStops(input({ travel: travelDay(), entries: build({}).stops.length === 0 ? [] : [] }));
  assert.deepEqual(full.stops.map((x) => x.time), ['14:10', '14:10', '15:00', '21:30', null]);
});

test('D a check-in booking: an untimed stop (a booking states no time) with its stated PHP price; a check-out the same; a cancelled booking is skipped with the leaf’s reason, a cancel-pending one too', () => {
  const r = dayStops(input({ travel: travelDay() }));
  const s = stopAt(r.stops, 'travel:booking:res-hotel:check-in');
  assert.deepEqual([s.time, s.zone, s.minutes, s.label, s.status, s.statusSource, s.role, s.cents, s.address], [null, null, null, 'Hotel PHP Proof', 'open', 'booking', 'none', null, null]);
  const t = travelOf(s);
  assert.deepEqual([t.source, t.kind, t.stated, t.bookingStatus, t.charge, t.endTime], ['booking', 'check-in', { minor: 1234500, currency: 'PHP' }, 'confirmed', { matched: false, posted: false, bank: null }, null]);
  assert.equal(travelClockWords(s), BOOKING_NO_CLOCK_WORDS);
  assert.equal(travelPriceWords(s), '12345.00 PHP', 'never a $ on a PHP figure');
  assert.equal(travelSmallWords(s), 'Check-in · booking');
  assert.equal(travelMatchWords(s), 'not matched');
  assert.equal(travelSaidWords(s), `${BOOKING_NO_CLOCK_WORDS} · cannot supersede — no instant`); // TRAVEL-01c (Alex, 2026-10-31), ruling A: a booking is never a block — said
  assert.equal(statusWords(s, DAY), 'open');
  const out = travelDayOf({ range, planned: [], bookings: [booking({ id: 'res-out', displayName: 'Leaving', checkinDate: new Date('2026-10-13T00:00:00.000Z'), checkoutDate: midnight })], segments: [] });
  const co = stopAt(dayStops(input({ travel: out })).stops, 'travel:booking:res-out:check-out');
  assert.deepEqual([travelOf(co).kind, co.time, travelSmallWords(co)], ['check-out', null, 'Check-out · booking']);
  // Cancelled: skipped, its reason the leaf's words; cancel pending the same; an unpriced booking says so.
  const gone = travelDayOf({ range, planned: [], bookings: [booking({ id: 'res-gone', displayName: 'Gone', status: 'cancelled', finalPriceCents: null }), booking({ id: 'res-pend', displayName: 'Pending', status: 'cancel_pending' })], segments: [] });
  const g = dayStops(input({ travel: gone }));
  const cancelled = stopAt(g.stops, 'travel:booking:res-gone:check-in');
  assert.deepEqual([cancelled.status, statusWords(cancelled, DAY), travelPriceWords(cancelled), travelStatusLineWords(cancelled)], ['skipped', `skipped — ${CANCELLED_WORDS}`, PRICE_NOT_STATED_WORDS, 'cancelled']);
  assert.equal(travelSaidWords(cancelled), `${BOOKING_NO_CLOCK_WORDS} · ${PRICE_NOT_STATED_WORDS} · ${CANCELLED_WORDS} · cannot supersede — no instant`); // TRAVEL-01c (Alex, 2026-10-31): said
  const pending = stopAt(g.stops, 'travel:booking:res-pend:check-in');
  assert.deepEqual([pending.status, statusWords(pending, DAY)], ['skipped', `skipped — ${CANCEL_PENDING_WORDS}`]);
  assert.equal(g.skipped, 2, 'the completeness line counts them as skipped');
  assert.deepEqual([g.notPriced, g.withoutActual, g.notRecorded, g.done], [0, 0, 0, 0], 'a travel stop takes no plan line and no record: counted in none of those');
});

test('D a daily planned row is NOT a stop: the band, with the planned-stay words, its window and the legacy title named; a transfer with destTime equal to homeTime has no length', () => {
  const r = dayStops(input({ travel: travelDay() }));
  const band = stopAt(r.allDay, 'travel:planned:ti-hotel');
  assert.deepEqual([band.kind, band.role, band.time, band.cents, band.label], ['travel', 'all_day', '16:00', null, `${PLANNED_STAY_WORDS} · Hotel Proof (${VENDOR_NAME_NOT_STATED_WORDS}) · 16:00 → 11:00`]);
  assert.equal(r.allDayCents, 0, 'no money on the band from a planned stay');
  assert.ok(!r.stops.some((s) => s.key === 'travel:planned:ti-hotel'), 'not a stop');
  const named = travelDayOf({ range, planned: [{ ...hotel, vendor_name: 'Proof Hotel', block_end_time: null }], bookings: [], segments: [] });
  assert.equal(stopAt(dayStops(input({ travel: named })).allDay, 'travel:planned:ti-hotel').label, `${PLANNED_STAY_WORDS} · Proof Hotel · 16:00 → —`);
  const tr = stopAt(r.stops, 'travel:planned:ti-transfer');
  assert.deepEqual([tr.time, tr.minutes, travelClockWords(tr), travelArrivalWords(tr)], ['15:00', null, `15:00 · ${NO_ZONE_WORDS}`, 'arrives 15:00'], 'zero length is no length');
  assert.equal(travelSmallWords(tr), 'Transfer · planned');
  assert.equal(travelSaidWords(tr), `${COST_NO_CURRENCY_WORDS} · ${NO_ZONE_WORDS} · cannot supersede — no instant`); // TRAVEL-01c (Alex, 2026-10-31), ruling A: a planned row with no instant is no block — said
});

test('D plannedMinutesOf kind travel: the stated duration first; else the stated clock difference when the end is stated on the same day and after the start; else null — a clock that is no clock throws by name', () => {
  const t = (o: { d?: number | null; s?: string | null; e?: string | null; same?: boolean }) => plannedMinutesOf({ kind: 'travel', duration_minutes: o.d === undefined ? null : o.d, start: o.s === undefined ? null : o.s, end: o.e === undefined ? null : o.e, endSameDay: o.same === undefined ? true : o.same });
  assert.equal(t({ d: 115, s: '14:10', e: '17:05' }), 115, 'the duration wins');
  assert.equal(t({ s: '14:10', e: '17:05' }), 175);
  assert.equal(t({ s: '21:30', e: null }), null, 'no end');
  assert.equal(t({ s: null, e: '17:05' }), null, 'no start');
  assert.equal(t({ s: '15:00', e: '15:00' }), null, 'equal is no length');
  assert.equal(t({ s: '23:00', e: '01:00', same: false }), null, 'an end on another day is no clock difference');
  assert.equal(t({ s: '15:00', e: '14:00' }), null, 'an end before the start on the same day is no length');
  assert.equal(t({ d: 0, s: '14:10', e: '17:05' }), 0, 'a stated 0 is stated');
  assert.throws(() => t({ s: '25:00', e: '17:05' }), /a travel start "25:00" is not a clock/);
  assert.throws(() => t({ s: '14:10', e: 'soon' }), /a travel end "soon" is not a clock/);
});

test('D not joined: a planned once flight and a segment on one day are both stops, each labelled by its source, and the day says so once; a daily row or no segment says nothing', () => {
  const both = dayStops(input({ travel: travelDay() }));
  assert.equal(both.travelNotJoined, true);
  assert.equal(NOT_JOINED_WORDS, 'a planned flight and a booked flight — not joined');
  assert.equal(dayStops(input({ travel: travelDay({ segments: [] }) })).travelNotJoined, false, 'no booked flight');
  assert.equal(dayStops(input({ travel: travelDay({ planned: TRAVEL.planned.filter((p) => p.id !== 'ti-flight') }) })).travelNotJoined, false, 'no planned flight');
  assert.equal(dayStops(input({ travel: null })).travelNotJoined, false, 'not read: unknown, nothing said');
  assert.match(code(CARD), /\{focus === null && result\.travelNotJoined && <p data-day-travel-not-joined>\{NOT_JOINED_WORDS\}<\/p>\}/);
});

// ── F · THE TRAVEL LINE, THE VERDICT ────────────────────────────────────────

test('F travelTotals and the TRAVEL line: per currency present, the stated minor units summed by code through statedMoneyWords — PHP + USD + one unpriced; never into the TOTAL, never converted; no travel stop, no line', () => {
  const r = dayStops(input({ travel: travelDay() }));
  const t = travelTotals(r.stops);
  assert.deepEqual(t, { stated: 3, byCurrency: [{ currency: 'PHP', minor: 1234500, count: 1 }, { currency: 'USD', minor: 37900, count: 2 }], notStated: 2 }, 'the two segments share the flight’s stated USD price; the planned flight and transfer state no currency');
  assert.deepEqual(travelLineWords(t), [`${TRAVEL_WORD} · 1 stated · 12345.00 PHP`, `${TRAVEL_WORD} · 2 stated · $379.00 · 2 ${PRICE_NOT_STATED_WORDS}`]);
  assert.deepEqual(travelLineWords({ stated: 2, byCurrency: [{ currency: 'PHP', minor: 1234500, count: 2 }], notStated: 1 }), ['TRAVEL · 2 stated · 12345.00 PHP · 1 price not stated'], 'the ruling’s line, verbatim');
  assert.deepEqual(travelLineWords({ stated: 0, byCurrency: [], notStated: 1 }), ['TRAVEL · 0 stated · 1 price not stated']);
  assert.deepEqual(travelLineWords(travelTotals(build({}).stops)), [], 'no travel stop: no line');
  // The TOTAL row stays the routines' and tasks': dayTotals sees cents null on every travel stop.
  const day = dayStops(input({ travel: travelDay(), entries: [], lines: [] }));
  assert.deepEqual(dayTotals(day, day.plannedCents), { budgetCents: null, actualCents: null, over: null, recordedBudgetCents: null, beyondCents: null });
  const withStops = build(FULL);
  const mixed = dayStops({ ...input({ travel: travelDay() }), entries: [], lines: [] });
  assert.equal(dayTotals(withStops, withStops.plannedCents).budgetCents, dayTotals({ ...withStops, stops: [...withStops.stops, ...mixed.stops] }, withStops.plannedCents).budgetCents, 'travel adds nothing to the BUDGET total');
  assert.equal(statedMoneyWords(1234500, 'PHP'), '12345.00 PHP');
  assert.equal(statedMoneyWords(18950, 'USD'), '$189.50');
  assert.equal(statedMoneyWords(18950, 'usd'), '$189.50', 'case is not a difference');
  assert.equal(statedMoneyWords(0, 'THB'), '0.00 THB');
  // The card: one row per line under the TOTAL row, inside the foot.
  const c = code(CARD);
  assert.match(c, /const travelLines = travelLineWords\(travelTotals\(result\.stops\)\);/);
  const foot = /<tfoot>([\s\S]*?)<\/tfoot>/.exec(c);
  assert.ok(foot !== null);
  assert.match(foot![1], /data-day-total>[\s\S]*\{travelLines\.map\(\(line\) => \(\n\s*<tr key=\{line\} className="border-t border-border align-top" data-day-travel-line>\n\s*<td colSpan=\{5\}[^>]*>\{line\}<\/td>\n\s*<\/tr>\n\s*\)\)\}/, 'the TRAVEL lines after the TOTAL row');
});

test('F the verdict excludes travel by KIND: a day fully recorded with a travel stop and no actual still computes; asksAmount’s text is unchanged', () => {
  const r = build(FULL, { taskActual: '10.00' });
  const withTravel = dayStops({ ...input({ travel: travelDay(), records: [] }), entries: [], lines: [] });
  const merged = { ...r, stops: [...r.stops, ...withTravel.stops] };
  const totals = dayTotals(merged, r.plannedCents);
  assert.ok(dayVerdict(r, totals.budgetCents) !== null, 'the fixture’s day shows a verdict');
  assert.deepEqual(dayVerdict(merged, totals.budgetCents), dayVerdict(r, totals.budgetCents), 'a travel stop (role none, actual null) holds the verdict back no more');
  const rules = code(RULES);
  assert.match(rules, /export const asksAmount = \(role: StopRole\): boolean => role === 'place' \|\| role === 'none';/, 'unchanged');
  assert.match(rules, /if \(result\.stops\.some\(\(s\) => s\.kind !== 'travel' && s\.superseded === null && asksAmount\(s\.role\) && s\.actualCents === null\)\) return null;/); // TRAVEL-01c (Alex, 2026-10-31): and a superseded stop — moved, not loosened
});

// ── G · THE DECK, H · THE REEL ──────────────────────────────────────────────

test('G the deck header counts the travel stop; the travel plate prints the card’s words only — no amount input, no ✓ done, no rating, no skip; the record form and the vendor box never mount for it', () => {
  const r = dayStops(input({ travel: travelDay() }));
  const deck = r.stops.filter((s) => s.role !== 'journal');
  assert.equal(deck.length, 5, 'five travel stops in the deck');
  assert.equal(stepHeaderWords(2, deck.length, deck[1].time), '2 OF 5 · 14:10');
  assert.equal(stepHeaderWords(5, deck.length, deck[4].time), '5 OF 5 · —', 'the check-in, untimed');
  const c = code(CARD);
  const plate = c.slice(c.indexOf('const travelPlate = (stop: Stop) => ('), c.indexOf('const fullPlate = ('));
  for (const word of ['data-day-travel>', 'data-day-bold>{boldOf(stop)}', 'data-day-small>{travelSmallWords(stop)}', 'data-day-travel-clock>{travelClockWords(stop)}', 'data-day-travel-arrival>{travelArrivalWords(stop)}',
    'data-day-travel-price>{travelPriceWords(stop)}', 'data-day-travel-status>{travelStatusLineWords(stop)}', 'data-day-travel-match>{travelMatchWords(stop)}', 'data-day-travel-said>{travelSaidWords(stop)}', 'data-day-travel-record>{travelRecordWords(stop)}']) {
    assert.ok(plate.includes(word), `the travel plate prints ${word}`);
  }
  assert.doesNotMatch(plate, /planDollars|formatCents|rowActualWords|deltaWords|starsWords|StopForm|<input|data-day-amount|data-day-actual|data-day-rating|data-day-plan-bar|data-day-spent-bar|\$/, 'no plan figure, no actual, no stars, no bars, no $');
  assert.doesNotMatch(plate, /\|\||\?\? /, 'no || and no ?? default in the travel plate');
  assert.match(c, /\{stop\.kind === 'travel' \? travelPlate\(stop\) : stopPlate\(focusOf\(at\)\)\}/, 'the deck hands a travel stop its own plate');
  assert.match(c, /if \(s\.kind === 'travel'\) return travelSmallWords\(s\);/, 'the row’s small text');
  // The record form mounts only on a stop with an address — a travel stop has none; the vendor box renders nothing for a stop with no plan line and role none.
  assert.match(c, /\{loaded && recordsOk && focus !== null && focus\.stop\.address !== null && \(\n\s*<StopForm/);
  for (const s of r.stops) assert.equal(s.address, null);
  assert.equal(TRAVEL_RECORD_WORDS, 'the booking is the record — nothing to tick');
  assert.equal(PLANNED_NOT_BOOKING_WORDS, 'planned — not a booking');
  assert.equal(AS_AIRLINE_STATES_WORDS, 'as the airline states it');
  assert.equal(NO_CLOCK_WORDS, 'no clock stated');
});

test('H the reel: one scene per travel stop — "Flight AirAsia CNX → DPS · 14:10 as the airline states it · $189.50 stated"; the script holds every travel scene in the table’s order; the caption’s block names them; the other stops’ scenes are unchanged', () => {
  const r = build(FULL);
  const t = dayStops({ ...input({ travel: travelDay(), records: [] }), entries: [], lines: [] });
  const seg = stopAt(t.stops, 'travel:segment:res-flight:seg:0');
  assert.deepEqual(stopSceneLines(seg), [`Flight AirAsia CNX → DPS (flight) · 14:10 ${AS_AIRLINE_STATES_WORDS} · $189.50 stated`]); // TRAVEL-01c (Alex, 2026-10-31) item 0: the segment's own title
  assert.deepEqual(stopSceneLines(stopAt(t.stops, 'travel:booking:res-hotel:check-in')), [`Check-in Hotel PHP Proof · ${BOOKING_NO_CLOCK_WORDS} · 12345.00 PHP stated`]);
  assert.deepEqual(stopSceneLines(stopAt(t.stops, 'travel:planned:ti-flight')), [`Flight AirAsia · 14:10 Asia/Bangkok · ${PRICE_NOT_STATED_WORDS}`]);
  const merged = { ...r, stops: [...r.stops, ...t.stops] };
  const day = reelDay(merged);
  const script = scriptText(day);
  assert.ok(script.ok);
  const lines = script.ok ? script.text.split('\n') : [];
  const scenes = t.stops.map((s) => stopSceneLines(s)[0]);
  assert.deepEqual(lines.filter((l) => scenes.includes(l)), scenes, 'every travel scene, once, in the table’s order');
  assert.ok(lines.includes(`Flight AirAsia CNX → DPS (flight) · 14:10 ${AS_AIRLINE_STATES_WORDS} · $189.50 stated`));
  const base = scriptText(reelDay(r));
  assert.ok(base.ok && script.ok);
  for (const l of (base.ok ? base.text.split('\n') : []).filter((l) => !l.startsWith('Happy '))) assert.ok(lines.includes(l), `the other scenes stay: ${l}`);
  const caption = captionText(day);
  assert.ok(caption.ok);
  const block = caption.ok ? caption.text.split('\n\n').find((b) => b.startsWith(CAPTION_TRAVEL_HEAD_WORDS)) : undefined;
  assert.equal(block, [CAPTION_TRAVEL_HEAD_WORDS, ...scenes].join('\n'), 'one block names them, before the totals');
  const blocks = caption.ok ? caption.text.split('\n\n') : [];
  assert.ok(blocks.indexOf(block as string) === blocks.findIndex((b) => b.startsWith('Total budget: ')) - 1, 'directly before the totals');
  assert.equal(captionText(reelDay(r)).ok && !(captionText(reelDay(r)) as { text: string }).text.includes(CAPTION_TRAVEL_HEAD_WORDS), true, 'no travel: no block');
  // The stop's own script on the deck: its scene alone; reelDoneOf is never asked for a travel stop.
  assert.match(code(RULES), /if \(s\.kind === 'travel'\) \{\n\s*blocks\.push\(stopSceneLines\(s\)\);\n\s*continue;\n\s*\}/);
  assert.match(code(RULES), /const travel = d\.stops\.filter\(\(s\) => s\.kind === 'travel'\);\n\s*if \(travel\.length > 0\) sections\.push\(\[CAPTION_TRAVEL_HEAD_WORDS, \.\.\.travel\.map\(travelSceneWords\)\]\);/);
});

// ── A · THE NINTH READ ─────────────────────────────────────────────────────

test('A readTravelDay: GET /api/operations/travel-day?day= through the one reader; the leaf’s own shape; another day, a missing list or missing counts is a failure in words; a failed read is named — never an empty day', async () => {
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  let answer: () => Response = () => new Response(JSON.stringify(TRAVEL), { status: 200, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string) => { sent.push(url); return answer(); }) as typeof fetch;
  try {
    const ok = await readTravelDay(DAY);
    assert.ok(ok.ok);
    assert.deepEqual(ok.ok ? ok.value.counts : null, { planned: 3, bookings: 1, segments: 2 });
    assert.deepEqual(ok.ok ? ok.value.segments[0].charge : null, { matched: true, posted: false, bank: BANK }, 'the bank figure rides the read');
    answer = () => new Response(JSON.stringify({ ...TRAVEL, day: '2026-10-16' }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readTravelDay(DAY), { ok: false, words: travelFailedWords(`the travel came back for "2026-10-16", not ${DAY}`) });
    answer = () => new Response(JSON.stringify({ day: DAY, planned: [], bookings: [], counts: { planned: 0, bookings: 0, segments: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readTravelDay(DAY), { ok: false, words: travelFailedWords('the travel came back without its three lists') });
    answer = () => new Response(JSON.stringify({ day: DAY, planned: [], bookings: [], segments: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readTravelDay(DAY), { ok: false, words: travelFailedWords('the travel came back without its counts') });
    answer = () => new Response(JSON.stringify({ error: 'Validation', field: 'day', message: 'day "x" is not a day' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const failed = await readTravelDay(DAY);
    assert.ok(!failed.ok && failed.words.startsWith("The day's travel could not be read — "));
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual([...new Set(sent)], [`/api/operations/travel-day?day=${DAY}`]);
  const reads = code(READS);
  assert.match(reads, /import type \{ TravelDay \} from '@\/lib\/operations\/travelDay';/, 'the one shape, imported');
  assert.match(reads, /export async function readTravelDay\(day: string\): Promise<Read<TravelDay>> \{/);
  assert.doesNotMatch(reads.slice(reads.indexOf('export const travelFailedWords'), reads.indexOf('export interface JournalAnswer')), /\|\||\?\? /, 'no || and no ?? default in the read');
  // The eight reads' shapes are unchanged.
  for (const sig of [
    'export async function readDayReport(day: string, asOf: string): Promise<Read<BudgetReportResponse>>', 'export async function readStays(day: string): Promise<Read<StaysAnswer>>',
    'export async function readStopRecords(day: string): Promise<Read<StopRecordsAnswer>>', 'export async function readJournal(day: string): Promise<Read<JournalAnswer>>',
    'export async function readBacklog(done: BlockWindow | null = null): Promise<Read<readonly LogProject[]>>', 'export async function readMovedToday(after: Date, before: Date): Promise<Read<readonly ReflectionMovedRow[]>>',
  ]) assert.ok(reads.includes(sig), sig);
  // The card: the read beside the records, kept with its day; the plate waits for it; the reel waits for it; the completeness line names it; a failure named.
  const c = code(CARD);
  assert.match(c, /const \[travel, setTravel\] = useState<\{ readonly day: string; readonly read: Read<TravelDay> \} \| null>\(null\);/);
  assert.match(c, /useEffect\(\(\) => \{\n\s*if \(day === null\) return;\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const t = await readTravelDay\(day\);\n\s*if \(live\) setTravel\(\{ day, read: t \}\);\n\s*\}\)\(\);\n\s*return \(\) => \{ live = false; \};\n\s*\}, \[day, dayWrites\]\);/);
  assert.match(c, /const travelRead = travel !== null && travel\.day === day \? travel\.read : null;\n\s*const travelRows = travelRead !== null && travelRead\.ok \? travelRead\.value : null;\n\s*const travelOk = travelRead !== null && travelRead\.ok;/);
  assert.match(c, /travel: travelRead === null \? 'waiting' : travelRead\.ok \? 'ok' : 'failed',/);
  assert.match(c, /\{travelRead !== null && !travelRead\.ok && <p className="text-brand-red" data-day-travel-failed>\{travelRead\.words\}<\/p>\}/);
  assert.doesNotMatch(c, /setTravel\(null\)/, 'a re-read never blanks the plate first');
  const ok: ReelReads = { day: 'ok', tasks: 'ok', report: 'ok', records: 'ok', stay: 'ok', journal: null, backlog: null, travel: 'ok' };
  assert.equal(reelReadsWords(ok), null);
  assert.equal(reelReadsWords({ ...ok, travel: 'waiting' }), 'not ready — waiting for the day’s travel');
  assert.equal(reelReadsWords({ ...ok, travel: 'failed', stay: 'failed' }), 'not made — the stay, the day’s travel could not be read');
  assert.equal(REEL_READ_NAMES.travel, 'the day’s travel');
  assert.equal(TRAVEL_NOT_READ_WORDS, 'travel not read');
  const empty = dayStops(input({ travel: null }));
  assert.equal(completenessWords(empty, { day: true, report: true, records: true, travel: false }), TRAVEL_NOT_READ_WORDS);
  assert.equal(completenessWords(empty, { day: true, report: true, records: false, travel: false }), `records not read · ${TRAVEL_NOT_READ_WORDS}`);
});

// ── B · THE BANK FIGURE, C · ONE WORDS FUNCTION ─────────────────────────────

test('B the leaf: charge gains bank — the link’s amount as stored, the account’s currency (null carried), the day; null when not matched; a figure without a match or a match without a figure is refused by name; the route reads it through the link’s own relations and refuses two accepted charges', () => {
  assert.equal(bookingRowsOf(flightBooking, DAY).length, 0, 'a flight has no stay dates');
  assert.deepEqual(segmentRowOf(seg0, flightBooking).charge, { matched: true, posted: false, bank: BANK });
  assert.deepEqual(segmentRowOf(seg0, booking({ id: 'res-flight', checkinDate: null, checkoutDate: null }, { chargeMatched: true, chargeBank: { amount: 7, currency: null, date: DAY } })).charge, { matched: true, posted: false, bank: { amount: 7, currency: null, date: DAY } }, 'a NULL account currency is carried as null');
  assert.throws(() => bookingRowsOf(booking({}, { chargeMatched: true, chargeBank: null }), DAY), (e: unknown) => e instanceof TravelDayError && /matched with no bank figure/.test((e as Error).message));
  assert.throws(() => bookingRowsOf(booking({}, { chargeMatched: false, chargeBank: BANK }), DAY), (e: unknown) => e instanceof TravelDayError && /not matched but carries a bank figure/.test((e as Error).message));
  const leaf = code(LEAF);
  assert.match(leaf, /export interface BankFigure \{\n\s*readonly amount: number;\n\s*readonly currency: string \| null;\n\s*readonly date: string;\n\}/);
  assert.match(leaf, /readonly charge: \{ readonly matched: boolean; readonly posted: boolean; readonly bank: BankFigure \| null \};/);
  assert.doesNotMatch(leaf, /Number\(|\|\||\?\? |toLocaleString|Intl\.NumberFormat/, 'the leaf still converts nothing');
  const route = code(ROUTE);
  assert.match(route, /select: \{ reservationId: true, transaction: \{ select: \{ amount: true, date: true, accounts: \{ select: \{ isoCurrencyCode: true \} \} \} \} \},/, 'the same join the reservations GET uses — the link’s transaction and its account');
  assert.match(route, /if \(bankOf\.has\(l\.reservationId\)\) throw new Error\(`reservation \$\{l\.reservationId\} carries two accepted charge links — one bank figure cannot be named`\);/);
  assert.match(route, /bankOf\.set\(l\.reservationId, \{ amount: l\.transaction\.amount, currency: l\.transaction\.accounts\.isoCurrencyCode, date: dayOf\(l\.transaction\.date\) \}\);/);
  assert.match(route, /chargeMatched: bankOf\.has\(r\.id\),\n\s*chargePosted: posted\.has\(r\.id\),\n\s*chargeBank: bankOf\.has\(r\.id\) \? bankOf\.get\(r\.id\)! : null,/);
  assert.doesNotMatch(route, /Number\(|\|\||\?\? |parseFloat|\* 100\b|\/ 100\b/, 'the route converts nothing');
  assert.equal((route.match(/prisma\.\w+\.findMany\(/g) ?? []).length, 9, 'still nine reads');
  assert.ok(comments(ROUTE).includes('READ BY THE DAY CARD (TRAVEL-01b'));
});

test('C statedMoneyWords is declared once, in the currency home; the matcher imports it and declares no money words of its own; its rationale words are unchanged; the card prints every stated price through it', () => {
  const home = code(HOME);
  assert.match(home, /export function statedMoneyWords\(minor: bigint \| number, currency: string\): string \{\n\s*const upper = currency\.toUpperCase\(\);\n\s*return upper === FUNCTIONAL_CURRENCY \? functionalMoneyWords\(minor\) : `\$\{decimalStringOfCents\(minor\)\} \$\{upper\}`;\n\}/);
  const matcher = code(MATCHER);
  assert.match(matcher, /import \{ bankMoneyWords, statedMoneyWords \} from '\.\.\/books\/functionalCurrency';/);
  assert.match(matcher, /vs booked \$\{statedMoneyWords\(r\.finalPriceCents!, r\.currency\)\}/);
  assert.doesNotMatch(matcher, /bookedMoneyWords|function \w*MoneyWords|const \w*MoneyWords/, 'no second declaration');
  for (const f of ['src', 'scripts']) assert.ok(f.length > 0);
  const rules = code(RULES);
  assert.match(rules, /import \{ bankMoneyWords, statedMoneyWords \} from '@\/lib\/books\/functionalCurrency';/);
  assert.equal((rules.match(/statedMoneyWords\(/g) ?? []).length, 3, 'the price line, the scene, the TRAVEL line');
  assert.equal((rules.match(/bankMoneyWords\(/g) ?? []).length, 1, 'the match line');
});

// ── I/J · THE WORDS, THE DOES-NOTS ───────────────────────────────────────────

test('I/J the travel section of the rules holds every sentence as a constant or a function, the leaf’s words imported never retyped; no formatCents or planDollars on a travel figure; no || and no ?? default in the new code; stopRecord.ts, asksAmount and day-blocks untouched', () => {
  const rules = code(RULES);
  // TRAVEL-01c (Alex, 2026-10-31): the 01b section ends where the supersession section begins (its declared line prints the PLAN's cents through formatCents — ruling D; travel01c.test.ts pins it). Moved, not loosened.
  const section = rules.slice(rules.indexOf("export const TRAVEL_WORD = 'TRAVEL';"), rules.indexOf("export const SUPERSEDED_BY_WORDS = 'superseded by';"));
  assert.ok(section.length > 2000, 'the section is where the travel rules live');
  assert.doesNotMatch(section, /formatCents|planDollars/, 'no plan formatter on a travel figure');
  assert.doesNotMatch(section, /\|\||\?\? /, 'no || and no ?? default');
  assert.doesNotMatch(section, /'cost states no currency'|'no zone'|'price not stated'|'cancel pending'|'a booking states no time'|'vendor name not stated/, 'the leaf’s words are imported, never retyped');
  assert.match(section, /return skippedWords\(CANCELLED_WORDS\);\n\s*if \(t\.bookingStatus === 'cancel_pending'\) return skippedWords\(CANCEL_PENDING_WORDS\);/, 'the skip reasons are the leaf’s constants');
  assert.match(rules, /import \{\n\s*BOOKING_NO_CLOCK_WORDS, CANCELLED_WORDS, CANCEL_PENDING_WORDS, NO_ZONE_WORDS, PRICE_NOT_STATED_WORDS, VENDOR_NAME_NOT_STATED_WORDS,\n\s*type BankFigure, type BookingLinks, type PlannedRow, type TravelBookingRow, type TravelDay, type TravelSegmentRow,\n\} from '@\/lib\/operations\/travelDay';/);
  for (const word of ["export const TRAVEL_NOT_READ_WORDS = 'travel not read';", "export const AS_AIRLINE_STATES_WORDS = 'as the airline states it';", "export const PLANNED_NOT_BOOKING_WORDS = 'planned — not a booking';",
    "export const TRAVEL_RECORD_WORDS = 'the booking is the record — nothing to tick';", "export const NOT_JOINED_WORDS = 'a planned flight and a booked flight — not joined';", "export const PLANNED_STAY_WORDS = 'planned stay';", "export const CAPTION_TRAVEL_HEAD_WORDS = 'Travel:';"]) {
    assert.ok(rules.includes(word), word);
  }
  const c = code(CARD);
  assert.doesNotMatch(c, /'as the airline states it'|'planned — not a booking'|'nothing to tick'|'not joined'|'travel not read'|'matched: '|'planned stay'/, 'the card types none of the words');
  // dayStops' own counts: a travel stop takes no plan line and no record.
  assert.match(rules, /const recordable = stops\.filter\(\(s\) => s\.kind !== 'travel'\);/);
  assert.match(rules, /notPriced: recordable\.filter\(\(s\) => s\.cents === null\)\.length,/);
  assert.match(rules, /notRecorded: read \? recordable\.filter\(\(s\) => s\.kind !== 'task' && s\.record === null\)\.length : 0,/);
  // The does-nots.
  assert.match(rules, /export type StopKind = 'line' \| 'routine' \| 'task' \| 'travel';/);
  assert.match(rules, /export type StatusSource = 'record' \| 'routine' \| 'task' \| 'booking' \| 'travel';/); // TRAVEL-01c (Alex, 2026-10-31): 'travel' — a block supersedes
  assert.match(rules, /readonly travel: TravelDay \| null;\n\}/, 'the input');
  assert.match(rules, /readonly travel: TravelStop \| null;\n\}/, 'the stop');
  assert.doesNotMatch(code('src/lib/operations/stopRecord.ts'), /travel/i, 'no stop record for travel');
  assert.doesNotMatch(code('src/lib/operations/stopRole.ts'), /travel/i, 'the six roles stand');
  assert.match(code('src/app/api/trips/day-blocks/route.ts'), /vendorName: r\.vendor_name \|\| r\.vendor,/, 'day-blocks stays as it is');
  assert.doesNotMatch(code(READS), /day-blocks/);
  assert.doesNotMatch(section, /new Date\(\)|Date\.now\(|fetch\(|from 'react'/);
  // Every travel stop's record form is never offered: address null (G pins the mount's gate); the stay fixture still composes the reel.
  assert.equal(STAY.place, 'Chiang Mai, Thailand 🇹🇭');
});
