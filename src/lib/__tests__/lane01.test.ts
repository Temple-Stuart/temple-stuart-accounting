/**
 * LANE-01 (2026-09-25) — a reservation knows what it is.
 *
 * One test per proof the ruling names. The refresh is driven through fake ports,
 * so every branch is decided by the real code and nothing touches a database or a
 * provider; the routes' contracts are read from source the way this repo proves a
 * route it cannot execute without a provider.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { LANE_WORD, RESERVATION_LANES, flightDisplayName, isReservationLane, reservationIdentity } from '../reservations/lane';
import { flightProviderStatusToReservation } from '../reservations/flightStatus';
import {
  refreshFlightReservation,
  type FlightBookingStated,
  type FlightRefreshPorts,
  type FlightReservationPatch,
  type FlightReservationRow,
} from '../reservations/refreshFlightReservation';
import { BOOKING_CALENDAR_SOURCE, type BookingCalendarPort } from '../calendar/bookingEvent';
import { parseFlightBookingDetails } from '../liteapiFlightsClient';
import { dailyCap } from '../travelSearchQuota';

const FLIGHT_ROUTE = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HOTEL_ROUTE = 'src/app/api/travel/liteapi/book/route.ts';
const READERS = [
  'src/app/api/reservations/[id]/route.ts',
  'src/app/api/reservations/unattached/route.ts',
  'src/app/api/trips/[id]/reservations/route.ts',
  'src/app/api/trips/[id]/actuals/route.ts',
  'src/components/hub/MatchReviewSection.tsx',
];
const MIGRATION = 'prisma/migrations/20260925100000_lane_01_reservation_lane/migration.sql';

// ── the one reader ──────────────────────────────────────────────────────────

test('a flight reservation renders type "flight" — never "hotel", never "liteapi"', () => {
  const flight = reservationIdentity({ lane: 'flight', displayName: null, providerConfirmationCode: 'FH-269-920QSVHH', providerBookingId: 'fb_9Q' });
  assert.equal(flight.type, 'flight');
  assert.equal(flight.name, 'Flight booking FH-269-920QSVHH', 'no stated route → the lane word and its booking reference');
  assert.ok(!/liteapi/i.test(flight.name));
  // With the vendor's stated route, that is the name.
  const named = reservationIdentity({ lane: 'flight', displayName: 'Thai Vietjet Air BKK → HKT', providerConfirmationCode: 'FH-269-920QSVHH', providerBookingId: 'fb_9Q' });
  assert.equal(named.name, 'Thai Vietjet Air BKK → HKT');
  // No confirmation code → the provider's booking id, still never the provider's name.
  const bare = reservationIdentity({ lane: 'flight', displayName: '  ', providerConfirmationCode: null, providerBookingId: 'fb_9Q' });
  assert.equal(bare.name, 'Flight booking fb_9Q');
});

test('a hotel reservation is unchanged — its type is hotel and its name its stated hotel name', () => {
  const hotel = reservationIdentity({ lane: 'hotel', displayName: 'Ibis Phuket Kata', providerConfirmationCode: 'HCC-4421', providerBookingId: 'hSq2gVDrf' });
  assert.deepEqual(hotel, { type: 'hotel', name: 'Ibis Phuket Kata' });
  // A stay whose vendor stated no name: the lane and the confirmation, not "liteapi".
  assert.equal(reservationIdentity({ lane: 'hotel', displayName: null, providerConfirmationCode: 'HCC-4421', providerBookingId: 'hSq2gVDrf' }).name, 'Hotel booking HCC-4421');
  assert.equal(reservationIdentity({ lane: 'activity', displayName: null, providerConfirmationCode: null, providerBookingId: 'v_1' }).type, 'activity');
});

test('type comes from lane ONLY: the leaf reads no provider, and a lane the column does not admit throws', () => {
  const leaf = code('src/lib/reservations/lane.ts');
  assert.ok(!/\.provider\b/.test(leaf), 'the leaf never reads .provider');
  assert.ok(!/liteapi|viator|duffel/.test(leaf), 'the leaf knows no provider name');
  assert.deepEqual([...RESERVATION_LANES], ['hotel', 'flight', 'activity']);
  assert.equal(isReservationLane('liteapi'), false);
  assert.throws(() => reservationIdentity({ lane: 'liteapi', displayName: null, providerConfirmationCode: null, providerBookingId: 'x' }), /not one of hotel \| flight \| activity/);
  for (const lane of RESERVATION_LANES) assert.ok(LANE_WORD[lane].length > 0);
});

test('the three PROVIDER_TYPE maps and every `hotelName ?? provider` are gone; every reader uses the one leaf', () => {
  for (const f of READERS) {
    const src = code(f);
    assert.ok(!src.includes('PROVIDER_TYPE'), `${f} carries no PROVIDER_TYPE map`);
    assert.ok(!/hotelName \?\? /.test(src), `${f} never falls through from hotelName`);
    assert.ok(!/provider\} booking/.test(src), `${f} never names a row after its provider`);
    assert.match(src, /reservationIdentity\(/, `${f} reads through the one leaf`);
  }
});

// ── the status mapping, one leaf for both callers ───────────────────────────

test('the status mapping is EXACTLY the book route\'s, in one leaf both callers import', () => {
  assert.equal(flightProviderStatusToReservation('CONFIRMED'), 'confirmed');
  assert.equal(flightProviderStatusToReservation('TICKETED'), 'confirmed');
  assert.equal(flightProviderStatusToReservation('confirmed'), 'confirmed', 'case-insensitive, as the route always was');
  assert.equal(flightProviderStatusToReservation('CANCELLED'), 'cancelled');
  // SEC-03 (2026-09-25): the one-line ruling this header said it would take.
  assert.equal(flightProviderStatusToReservation('CANCELLED_WITH_CHARGES'), 'cancelled');
  // STATUS-01 (2026-09-26): the airline's three pre-confirmation words are listed, by name, as pending.
  for (const early of ['PENDING_CONFIRMATION', 'PENDING', 'CREATED']) {
    assert.equal(flightProviderStatusToReservation(early), 'pending', `${early} is pending`);
  }
  for (const other of ['', null, undefined, 'REBOOKED']) {
    assert.equal(flightProviderStatusToReservation(other), null, `${String(other)} is not mapped`);
  }
  const route = code(FLIGHT_ROUTE);
  assert.match(route, /flightProviderStatusToReservation\(parsed\.status\)/, 'the book route maps through the leaf');
  assert.match(route, /mapped === null \? 'pending' : mapped/, 'and writes pending for an unmapped status at creation');
  assert.ok(!route.includes("'TICKETED'"), 'the inline mapping is gone from the route');
  // STATUS-01: the refresh hands the status to the one apply leaf, which maps through the same leaf; the refresh carries no mapping of its own.
  const refresh = code('src/lib/reservations/refreshFlightReservation.ts');
  assert.match(refresh, /applyVendorState\(/, 'the refresh applies through the one leaf');
  assert.doesNotMatch(refresh, /flightProviderStatusToReservation/, 'and carries no mapping of its own');
  assert.match(code('src/lib/reservations/applyVendorState.ts'), /flightProviderStatusToReservation\(vendor\.status\)/, 'the apply leaf maps through the same leaf');
});

// ── the refresh, over fake ports ────────────────────────────────────────────

const ROW: FlightReservationRow = {
  id: 'res_f1', userId: 'u_1', lane: 'flight', providerBookingId: 'fb_9Q',
  providerConfirmationCode: 'FH-269-920QSVHH', status: 'pending', displayName: null,
  // STATUS-01: the apply leaf's columns, NULL until the vendor states them.
  ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, ticketedEmailSentAt: null, confirmationEmailSentAt: null,
};

/** STATUS-01: when the answer arrived — what lastVendorReadAt is stamped with on every read. */
const READ_AT = new Date('2026-09-26T10:00:00.000Z');

/** The vendor's answer, shaped as the GET reference documents (segments with direction). */
const STATED: FlightBookingStated = {
  bookingId: 'fb_9Q',
  status: 'CONFIRMED',
  pnr: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, readAt: READ_AT,
  segments: [
    { departureTime: '2026-10-30T09:00:00', direction: 'INBOUND', originCode: 'HKT', destinationCode: 'BKK', carrierName: 'Thai Vietjet Air', flightNumber: '229' },
    { departureTime: '2026-10-25T14:15:00', direction: 'OUTBOUND', originCode: 'BKK', destinationCode: 'HKT', carrierName: 'Thai Vietjet Air', flightNumber: '228' },
  ],
};

function fakePorts(opts: {
  answer?: FlightBookingStated | (() => Promise<FlightBookingStated>);
  existingCalendar?: boolean;
} = {}) {
  const calendarRows: Array<Parameters<BookingCalendarPort['insert']>[0]> = [];
  const writes: Array<{ id: string; patch: FlightReservationPatch }> = [];
  let present = !!opts.existingCalendar;
  let calls = 0;
  let marked = 0;
  let commission = 0;
  const ports: FlightRefreshPorts = {
    fetchBooking: async () => {
      calls += 1;
      if (typeof opts.answer === 'function') return opts.answer();
      return opts.answer ?? STATED;
    },
    calendar: {
      async find(source, sourceId) { return present && source === BOOKING_CALENDAR_SOURCE && sourceId === ROW.id; },
      async insert(row) { calendarRows.push(row); present = true; },
      // STATUS-01: a vendor-cancelled flight marks its day through the apply leaf.
      async markCancelled(source, sourceId) { if (present && source === BOOKING_CALENDAR_SOURCE && sourceId === ROW.id) { marked += 1; return 1; } return 0; },
    },
    writeReservation: async (id, patch) => { writes.push({ id, patch }); },
    cancelCommission: async () => { commission += 1; return 1; },
  };
  return { ports, calendarRows, writes, calls: () => calls, marked: () => marked, commission: () => commission };
}

test('GET booking succeeds → one calendar row on the OUTBOUND day, the stated name, the status refreshed', async () => {
  const { ports, calendarRows, writes, calls } = fakePorts();
  const out = await refreshFlightReservation(ports, ROW);
  assert.equal(calls(), 1, 'exactly one vendor call');
  assert.ok(out.fetched);
  if (!out.fetched) return;
  assert.equal(out.calendar, 'inserted');
  assert.equal(out.day, '2026-10-25', 'the OUTBOUND leg, not the inbound listed first');
  assert.equal(calendarRows.length, 1);
  assert.equal(calendarRows[0].source, BOOKING_CALENDAR_SOURCE);
  assert.equal(calendarRows[0].sourceId, 'res_f1', 'keyed exactly as CAL-01');
  assert.equal(calendarRows[0].startDate.toISOString(), '2026-10-25T12:00:00.000Z');
  assert.equal(calendarRows[0].title, 'Thai Vietjet Air BKK → HKT (flight)');
  assert.equal(out.name, 'set');
  assert.equal(out.nameValue, 'Thai Vietjet Air BKK → HKT');
  assert.equal(out.status, 'set');
  assert.equal(out.statusValue, 'confirmed');
  // STATUS-01: the one write also carries the read stamp — the answer's own arrival instant.
  assert.deepEqual(writes, [{ id: 'res_f1', patch: { displayName: 'Thai Vietjet Air BKK → HKT', status: 'confirmed', lastVendorReadAt: READ_AT } }], 'ONE write of exactly what changed, plus the read stamp');
  assert.deepEqual(out.changes, ['displayName null → "Thai Vietjet Air BKK → HKT"', 'status pending → confirmed (vendor CONFIRMED)']);
  assert.deepEqual(out.emails, [], 'no email owed — nothing ticketed, no code arrived');
});

test('GET booking fails → no row, no rename, no status change, a named reason; the booking is not failed', async () => {
  const { ports, calendarRows, writes } = fakePorts({ answer: async () => { throw new Error('HTTP 502 from /flights/bookings/fb_9Q'); } });
  const out = await refreshFlightReservation(ports, ROW);
  assert.equal(out.fetched, false);
  assert.ok(!out.fetched && /GET \/flights\/bookings\/fb_9Q failed/.test(out.reason) && /no row, no rename, no status change/.test(out.reason));
  assert.equal(calendarRows.length, 0);
  assert.equal(writes.length, 0);
  // The route's side: the refresh sits in its own try/catch AFTER the transaction and only logs.
  const src = code(FLIGHT_ROUTE);
  const at = src.indexOf('refreshFlightReservation(');
  assert.ok(at > src.indexOf('prisma.$transaction'), 'after the reservation transaction');
  const after = src.slice(at, at + 1900);
  assert.match(after, /catch \(calErr\)/);
  assert.match(after, /console\.error\('\[LiteAPI flights book\] LANE-01 refresh did not apply/, 'a named log when it does not apply');
  assert.doesNotMatch(after.slice(after.indexOf('catch (calErr)'), after.indexOf('catch (calErr)') + 400), /return NextResponse|throw /, 'the catch never fails the paid booking');
});

test('GET booking answers with no segments → no row, no rename, each by name; the status still goes through the apply leaf (STATUS-01b)', async () => {
  const { ports, calendarRows, writes } = fakePorts({ answer: { ...STATED, segments: [] } });
  const out = await refreshFlightReservation(ports, ROW);
  assert.ok(out.fetched);
  if (!out.fetched) return;
  assert.equal(out.calendar, 'no_row');
  assert.match(out.calendarReason ?? '', /answered with no segments — no row, no rename/);
  assert.equal(out.name, 'not_stated');
  assert.equal(calendarRows.length, 0, 'no calendar row');
  assert.equal(out.status, 'set');
  assert.equal(out.statusValue, 'confirmed', 'the vendor said CONFIRMED on a pending row — applied, segments or not');
  assert.deepEqual(writes, [{ id: 'res_f1', patch: { status: 'confirmed', lastVendorReadAt: READ_AT } }], 'the status and the stamp; no name');
  // Segments present but none marked OUTBOUND with a date: the same posture, named.
  const { ports: p2, writes: w2, calendarRows: c2 } = fakePorts({ answer: { ...STATED, segments: [{ ...STATED.segments[1], direction: 'INBOUND' }] } });
  const o2 = await refreshFlightReservation(p2, ROW);
  assert.ok(o2.fetched && o2.calendar === 'no_row' && /none marked OUTBOUND with a departureTime — no row, no rename/.test(o2.calendarReason ?? '') && o2.name === 'not_stated');
  assert.equal(c2.length, 0);
  assert.deepEqual(w2.map((w) => w.patch), [{ status: 'confirmed', lastVendorReadAt: READ_AT }]);
});

test('vendor status CANCELLED_WITH_CHARGES → the reservation is cancelled (SEC-03); STATUS-01: its day is marked and its margin moved', async () => {
  const { ports, writes, marked, commission } = fakePorts({ answer: { ...STATED, status: 'CANCELLED_WITH_CHARGES' }, existingCalendar: true });
  const out = await refreshFlightReservation(ports, { ...ROW, displayName: 'Thai Vietjet Air BKK → HKT' });
  assert.ok(out.fetched);
  if (!out.fetched) return;
  assert.equal(out.status, 'set');
  assert.equal(out.statusValue, 'cancelled');
  assert.deepEqual(writes, [{ id: 'res_f1', patch: { status: 'cancelled', lastVendorReadAt: READ_AT } }], 'one write of exactly the status, plus the read stamp');
  assert.equal(marked(), 1, 'the CAL-01 row is marked cancelled, through the apply leaf');
  assert.equal(commission(), 1, 'the estimated commission is moved');
});

test('vendor status unlisted → the reservation status is UNCHANGED and reported by name; only the read stamp is written', async () => {
  for (const unlisted of ['REBOOKED', 'ON_HOLD']) {
    const { ports, writes } = fakePorts({ answer: { ...STATED, status: unlisted } });
    const out = await refreshFlightReservation(ports, { ...ROW, displayName: 'Thai Vietjet Air BKK → HKT' });
    assert.ok(out.fetched);
    if (!out.fetched) continue;
    assert.equal(out.status, 'unmapped', unlisted);
    assert.equal(out.statusValue, 'pending', 'left exactly as it was');
    assert.equal(out.providerStatus, unlisted, 'and the vendor\'s word is carried for the log');
    assert.deepEqual(writes, [{ id: 'res_f1', patch: { lastVendorReadAt: READ_AT } }], `${unlisted}: only the read stamp — the name was already right too`);
    assert.deepEqual(out.changes, []);
  }
  // STATUS-01: CREATED and PENDING_CONFIRMATION are LISTED words (pending); on a pending row they are unchanged.
  for (const early of ['CREATED', 'PENDING_CONFIRMATION']) {
    const { ports } = fakePorts({ answer: { ...STATED, status: early } });
    const out = await refreshFlightReservation(ports, { ...ROW, displayName: 'Thai Vietjet Air BKK → HKT' });
    assert.ok(out.fetched && out.status === 'unchanged' && out.statusValue === 'pending', early);
  }
});

test('the retro on an already-correct row changes NOTHING — and a second run changes nothing', async () => {
  const correct: FlightReservationRow = { ...ROW, displayName: 'Thai Vietjet Air BKK → HKT', status: 'confirmed' };
  const { ports, calendarRows, writes } = fakePorts({ existingCalendar: true });
  const first = await refreshFlightReservation(ports, correct);
  assert.ok(first.fetched);
  if (!first.fetched) return;
  assert.equal(first.calendar, 'already_there');
  assert.equal(first.name, 'unchanged');
  assert.equal(first.status, 'unchanged');
  assert.equal(calendarRows.length, 0);
  // STATUS-01: an unchanged booking still stamps WHEN it was read — the read's own bookkeeping, not a fact about the booking.
  assert.deepEqual(writes, [{ id: 'res_f1', patch: { lastVendorReadAt: READ_AT } }], 'only the read stamp');
  assert.deepEqual(first.changes, []);
  assert.deepEqual(first.emails, []);
  // Two runs from a fresh row converge: the second one changes nothing.
  const fresh = fakePorts();
  const one = await refreshFlightReservation(fresh.ports, ROW);
  assert.ok(one.fetched && one.calendar === 'inserted' && one.name === 'set' && one.status === 'set');
  const afterOne: FlightReservationRow = { ...ROW, displayName: fresh.writes[0].patch.displayName as string, status: fresh.writes[0].patch.status as string };
  const two = await refreshFlightReservation(fresh.ports, afterOne);
  assert.ok(two.fetched && two.calendar === 'already_there' && two.name === 'unchanged' && two.status === 'unchanged');
  assert.deepEqual(fresh.writes[1].patch, { lastVendorReadAt: READ_AT }, 'the second run wrote the read stamp and nothing else');
  assert.ok(two.fetched && two.changes.length === 0, 'and changed nothing');
  assert.equal(fresh.calendarRows.length, 1, 'still one calendar row');
});

test('the refresh reads flights only, derives no date from createdAt, and defaults nothing', () => {
  const leaf = code('src/lib/reservations/refreshFlightReservation.ts');
  assert.ok(!leaf.includes('createdAt'), 'no createdAt');
  assert.ok(!/new Date\(\)/.test(leaf), 'no today');
  assert.ok(!/\?\? '(pending|confirmed|cancelled)'/.test(leaf), 'no default status');
  assert.match(leaf, /s\.direction === 'OUTBOUND'/, 'the outbound is the segment the vendor MARKED outbound');
  assert.match(leaf, /row\.lane !== 'flight'/, 'a non-flight throws');
  assert.rejects(() => refreshFlightReservation(fakePorts().ports, { ...ROW, lane: 'hotel' }), /reads flights only/);
});

test('the flight name is carrier + origin → destination from stated fields only', () => {
  assert.equal(flightDisplayName({ carrierName: 'Thai Vietjet Air', originCode: 'BKK', destinationCode: 'HKT' }), 'Thai Vietjet Air BKK → HKT');
  assert.equal(flightDisplayName({ carrierName: null, originCode: 'BKK', destinationCode: 'HKT' }), null);
  assert.equal(flightDisplayName({ carrierName: 'X', originCode: '', destinationCode: 'HKT' }), null);
  assert.equal(flightDisplayName({ carrierName: 'X', originCode: 'BKK', destinationCode: undefined }), null);
});

// ── the client ──────────────────────────────────────────────────────────────

test('parseFlightBookingDetails maps the documented GET shape and invents nothing for what is absent', () => {
  const details = parseFlightBookingDetails({
    bookingId: '1297abe4', bookingRef: 'FH-269-920QSVHH', status: 'CONFIRMED',
    journey: { journeyKey: 'a3bb', segments: [
      { departureTime: '2026-04-10T15:30:00', arrivalTime: '2026-04-10T18:40:00', direction: 'OUTBOUND', originCode: 'JFK', destinationCode: 'LAX', carrier: { marketingName: 'Delta' }, flight: { marketingNumber: '123' } },
      { departureTime: '2026-04-20T08:00:00', originCode: 'LAX' },
    ] },
  });
  assert.equal(details.status, 'CONFIRMED');
  assert.equal(details.bookingRef, 'FH-269-920QSVHH');
  assert.equal(details.segments.length, 2);
  assert.deepEqual(details.segments[0], { departureTime: '2026-04-10T15:30:00', direction: 'OUTBOUND', originCode: 'JFK', destinationCode: 'LAX', carrierName: 'Delta', flightNumber: '123' });
  assert.deepEqual(details.segments[1], { departureTime: '2026-04-20T08:00:00', direction: null, originCode: 'LAX', destinationCode: null, carrierName: null, flightNumber: null });
  assert.deepEqual(parseFlightBookingDetails({ bookingId: 'x' }).segments, [], 'no journey → no segments, not a throw');
  const client = code('src/lib/liteapiFlightsClient.ts');
  assert.match(client, /export async function getFlightBooking\(bookingId: string\)/);
  assert.match(client, /\/flights\/bookings\/\$\{encodeURIComponent\(bookingId\)\}/);
  assert.match(client, /method: 'GET', headers: headers\(\)/, 'the same auth headers as every flights call');
  assert.match(client, /if \(!res\.ok\) throwFlightsNon2xx\(path, res\.status, bytes\);/, 'the same non-2xx contract as the POSTs');
});

test('the GET is metered like the money calls: its own daily bucket, reserved before it, in the route and the retro', () => {
  assert.equal(dailyCap('liteapiflightbookingread'), 50);
  const route = code(FLIGHT_ROUTE);
  const at = route.indexOf("reserveTravelSearch('liteapiflightbookingread')");
  assert.ok(at > 0 && at < route.indexOf('refreshFlightReservation('), 'reserved immediately before the refresh');
  const retro = code('scripts/lane-01-retro-flights.ts');
  assert.match(retro, /reserveTravelSearch\('liteapiflightbookingread'\)/);
  assert.match(retro, /refreshFlightReservation\(/, 'the retro runs THE shared function');
  assert.match(retro, /where: \{ lane: 'flight' \}/, 'over every flight row');
  assert.match(retro, /--dry-run/, 'and can be rehearsed without writing');
});

// ── the trip ────────────────────────────────────────────────────────────────

test('flight book accepts tripId under the hotel route\'s own gate: owner → attached, non-owner → 401 by name', () => {
  const route = code(FLIGHT_ROUTE);
  assert.match(route, /const tripId = typeof body\.tripId === 'string' \? body\.tripId\.trim\(\) : '';/);
  assert.match(route, /if \(!isAccount\) \{\s*return NextResponse\.json\(\s*\{ error: 'Sign in to save a booking to a trip\.' \},\s*\{ status: 401 \}/, 'a guest with a tripId is refused by name');
  assert.match(route, /prisma\.trips\.findFirst\(\{\s*where: \{ id: tripId, userId: user!\.id \}/, 'the trip must be THIS user\'s');
  assert.match(route, /\{ error: 'Trip not found' \}, \{ status: 404 \}/, 'defensive 404, never confirming a foreign trip');
  assert.match(route, /tripId: resolvedTripId,/, 'the owner-verified trip is what is written');
  assert.ok(!/tripId: null,/.test(route), 'the hardcoded null is gone');
  // Word for word the hotel route's gate.
  const hotel = code(HOTEL_ROUTE);
  for (const line of ["{ error: 'Sign in to save a booking to a trip.' }", "where: { id: tripId, userId: user!.id }", "{ error: 'Trip not found' }, { status: 404 }"]) {
    assert.ok(hotel.includes(line) && route.includes(line), `both routes: ${line}`);
  }
});

test('the trip rides from the surface through the panel and the returnUrl to the confirm page — and only when there is one', () => {
  assert.match(code('src/components/trips/PublicFlightSearch.tsx'), /tripId=\{authed === true && currentTrip \? currentTrip\.id : undefined\}/, 'the hotel lane\'s own rule (PublicHotelSearch.tsx:301)');
  const panel = code('src/components/trips/LiteApiFlightCheckoutPanel.tsx');
  assert.match(panel, /\.\.\.\(tripId \? \{ tripId \} : \{\}\),/, 'in the returnUrl only when present');
  const confirm = code('src/app/booking/flight-confirm/page.tsx');
  assert.match(confirm, /params\.get\('tripId'\)/);
  // SEC-03 (2026-09-25): the address the link carried is stored at prebook now.
  assert.match(confirm, /body: JSON\.stringify\(\{ prebookId, transactionId, \.\.\.\(tripId \? \{ tripId \} : \{\}\) \}\)/);
  // The in-trip planner mounts no flight checkout — there is no second launch site to carry it from.
  assert.ok(!code('src/components/trips/TripPlannerAI.tsx').includes('LiteApiFlightCheckoutPanel'), 'TripPlannerAI mounts only the hotel CheckoutPanel');
});

// ── the column and its one-time backfill ────────────────────────────────────

test('both book routes write lane from the value they already hold; the column has no default', () => {
  assert.match(code(HOTEL_ROUTE), /lane: 'hotel',\s*displayName: resolvedHotelName,/);
  assert.match(code(FLIGHT_ROUTE), /lane: 'flight',\s*displayName: null,/);
  const schema = code('prisma/schema.prisma');
  assert.match(schema, /\n  lane\s+String\s+@db\.VarChar\(20\)\n/, 'NOT NULL, no @default');
  assert.match(schema, /\n  displayName\s+String\?\s+@db\.VarChar\(255\)\n/);
});

test('the migration backfills ONCE, then SET NOT NULL + CHECK — and its CASE exists nowhere in runtime code', () => {
  const sql = code(MIGRATION) + comments(MIGRATION);
  assert.match(sql, /ADD COLUMN "lane" VARCHAR\(20\);/);
  assert.match(sql, /WHEN "provider" = 'viator'\s+THEN 'activity'/);
  assert.match(sql, /WHEN "checkinDate" IS NULL\s+THEN 'flight'/);
  assert.match(sql, /ELSE 'hotel'/);
  assert.match(sql, /ALTER COLUMN "lane" SET NOT NULL;/);
  assert.match(sql, /CHECK \("lane" IN \('hotel', 'flight', 'activity'\)\)/);
  assert.match(sql, /ONE-TIME BACKFILL/i);
  assert.match(sql, /NO RUNTIME CODE MAY EVER DERIVE lane THIS WAY/);
  // The runtime never derives a lane from a stay date or a provider.
  for (const f of [...READERS, FLIGHT_ROUTE, HOTEL_ROUTE, 'src/lib/reservations/lane.ts', 'src/lib/reservations/refreshFlightReservation.ts', 'scripts/lane-01-retro-flights.ts']) {
    const src = code(f);
    assert.ok(!/checkinDate IS NULL|checkinDate === null \? 'flight'|provider === 'viator' \? 'activity'/.test(src), `${f} derives no lane`);
  }
});
