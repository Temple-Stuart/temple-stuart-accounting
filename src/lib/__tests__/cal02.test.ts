/**
 * CAL-02 (2026-09-27) — every leg of a booking is on the calendar, and a booking
 * can be taken to any calendar app.
 *
 * The writer and the refresh are driven over a KEYED store that keeps the
 * database's rules (a find by key, an insert, a re-key that moves the same row, a
 * cancel that marks by the bare key and the segment prefix and never deletes);
 * the ICS builder is checked against golden text; the exports' decisions are
 * driven over fake ports; the routes, the readers and the retro are read from
 * source (a route handler's auth reads next/headers and cannot run here).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  BOOKING_CALENDAR_SOURCE,
  CANCELLED_TITLE_PREFIX,
  bookingCalendarRowsWhere,
  flightSegmentsCalendarDecision,
  markBookingCalendarCancelled,
  reservationIdOfCalendarSourceId,
  writeFlightSegmentRows,
  type BookingCalendarCancelPort,
  type BookingCalendarRow,
  type BookingCalendarSegmentPort,
  type StatedFlightSegment,
} from '../calendar/bookingEvent';
import { buildIcs, escapeIcsText, foldIcsLine, type IcsRow } from '../calendar/ics';
import { reservationIcs, tripIcs, type IcsExportPorts } from '../calendar/icsExport';
import { refreshFlightReservation, type FlightBookingStated, type FlightRefreshPorts, type FlightReservationRow } from '../reservations/refreshFlightReservation';

/** calendar_events as the writer sees it: rows by (source, source_id), each with an identity that survives a re-key. */
function keyedStore(seed: Array<{ sourceId: string; title?: string; status?: string }> = []) {
  let next = 1;
  const rows = new Map<string, { id: number; title: string; status: string; row: BookingCalendarRow | null }>();
  for (const s of seed) rows.set(s.sourceId, { id: next++, title: s.title ?? 'Thai Vietjet Air BKK → HKT (flight)', status: s.status ?? 'committed', row: null });
  const port: BookingCalendarSegmentPort & BookingCalendarCancelPort = {
    async find(source, sourceId) { return source === BOOKING_CALENDAR_SOURCE && rows.has(sourceId); },
    async insert(row) { rows.set(row.sourceId, { id: next++, title: row.title, status: 'committed', row }); },
    async rekey(source, from, row) {
      const held = rows.get(from);
      if (source !== BOOKING_CALENDAR_SOURCE || !held) return 0;
      rows.delete(from);
      rows.set(row.sourceId, { id: held.id, title: held.status === 'cancelled' ? `${CANCELLED_TITLE_PREFIX}${row.title}` : row.title, status: held.status, row });
      return 1;
    },
    async markCancelled(source, key) {
      if (source !== BOOKING_CALENDAR_SOURCE) return 0;
      let n = 0;
      for (const [k, r] of rows) {
        if ((k === key || k.startsWith(`${key}:seg:`)) && !r.title.startsWith(CANCELLED_TITLE_PREFIX)) { r.title = `${CANCELLED_TITLE_PREFIX}${r.title}`; r.status = 'cancelled'; n += 1; }
      }
      return n;
    },
  };
  return { rows, port };
}

/** A 2-segment OUTBOUND (a connection) and a 1-segment INBOUND, as the vendor lists them. */
const SEGMENTS: Array<StatedFlightSegment & { direction: string }> = [
  { direction: 'OUTBOUND', departureTime: '2026-10-25T08:00:00', arrivalTime: '2026-10-25T11:10:00', originCode: 'BKK', destinationCode: 'KUL', carrierName: 'AirAsia', flightNumber: 'FD 351' },
  { direction: 'OUTBOUND', departureTime: '2026-10-25T13:00:00', arrivalTime: '2026-10-25T14:05:00', originCode: 'KUL', destinationCode: 'HKT', carrierName: 'AirAsia', flightNumber: 'AK 820' },
  { direction: 'INBOUND', departureTime: '2026-10-30T13:00:00', arrivalTime: null, originCode: 'HKT', destinationCode: 'BKK', carrierName: null, flightNumber: '229' },
];

const ROW: FlightReservationRow = {
  id: 'res_c2', userId: 'u_1', lane: 'flight', providerBookingId: 'fb_c2', providerConfirmationCode: 'FH-1', status: 'confirmed',
  displayName: 'AirAsia BKK → HKT', ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, ticketedEmailSentAt: null, confirmationEmailSentAt: null, checkoutDate: null,
};
const READ_AT = new Date('2026-09-27T09:00:00.000Z');
const STATED: FlightBookingStated = { bookingId: 'fb_c2', status: 'CONFIRMED', pnr: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, readAt: READ_AT, segments: SEGMENTS };

function refreshPorts(calendar: BookingCalendarSegmentPort & BookingCalendarCancelPort, stated: FlightBookingStated = STATED): FlightRefreshPorts {
  return { fetchBooking: async () => stated, calendar, writeReservation: async () => {}, cancelCommission: async () => 0 };
}

test('a 2-segment outbound + 1-segment inbound → 3 rows, keyed seg:0..2 in the vendor\'s order, titled from stated fields only', async () => {
  const { rows, port } = keyedStore();
  const out = await refreshFlightReservation(refreshPorts(port), ROW);
  assert.ok(out.fetched);
  if (!out.fetched) return;
  assert.deepEqual([...rows.keys()], ['res_c2:seg:0', 'res_c2:seg:1', 'res_c2:seg:2'], 'one row per stated segment, in the vendor\'s order, never re-sorted');
  assert.deepEqual([...rows.values()].map((r) => r.title), ['AirAsia FD 351 BKK → KUL', 'AirAsia AK 820 KUL → HKT', '229 HKT → BKK'], 'a missing carrier is left out, never guessed');
  const [first, second, inbound] = [...rows.values()].map((r) => r.row as BookingCalendarRow);
  assert.equal(first.startDate.toISOString(), '2026-10-25T12:00:00.000Z');
  assert.equal(first.startTime, '08:00');
  assert.equal(first.endTime, '11:10', 'the stated arrival is the end');
  assert.equal(second.startTime, '13:00', 'the connection lands on the calendar');
  assert.equal(inbound.startDate.toISOString(), '2026-10-30T12:00:00.000Z', 'the INBOUND journey lands too');
  assert.equal(inbound.endTime, null, 'no arrival stated → no end (the grid draws the flagged marker, extent.ts)');
  assert.equal(inbound.endDate, null);
  for (const r of [first, second, inbound]) {
    assert.equal(r.startAt, null, 'a local clock with no offset names no instant — none is invented');
    assert.equal(r.userId, 'u_1');
  }
  assert.equal(out.day, '2026-10-25', 'the journey starts on its earliest row');
  assert.deepEqual(out.segments.map((s) => s.landed), ['inserted', 'inserted', 'inserted']);
  assert.match(out.calendarReason ?? '', /segment 2: the vendor states no arrivalTime — the row has no end/);
});

test('a segment with no departureTime has NO row, and is named', async () => {
  const { rows, port } = keyedStore();
  const stated = { ...STATED, segments: [SEGMENTS[0], { ...SEGMENTS[1], departureTime: null }, SEGMENTS[2]] };
  const out = await refreshFlightReservation(refreshPorts(port, stated), ROW);
  assert.ok(out.fetched);
  if (!out.fetched) return;
  assert.deepEqual([...rows.keys()], ['res_c2:seg:0', 'res_c2:seg:2'], 'segment 1 has no row, and the others keep their stated index');
  assert.equal(out.segments[1].landed, 'no_row');
  assert.match(out.segments[1].reason ?? '', /segment 1: the vendor states no departureTime — no row, and a time is never invented/);
  const bad = flightSegmentsCalendarDecision({ reservationId: 'r', userId: null, segments: [{ ...SEGMENTS[0], departureTime: '25 Oct' }] });
  assert.ok(!bad[0].decision.write && /does not open with a date — no row, and a date is never invented/.test(bad[0].decision.reason));
});

test('re-running the refresh writes no duplicate row — idempotent', async () => {
  const { rows, port } = keyedStore();
  await refreshFlightReservation(refreshPorts(port), ROW);
  const again = await refreshFlightReservation(refreshPorts(port), ROW);
  const third = await refreshFlightReservation(refreshPorts(port), ROW);
  assert.equal(rows.size, 3, 'still three rows after three runs');
  assert.ok(again.fetched && again.calendar === 'already_there' && again.segments.every((s) => s.landed === 'already_there'));
  assert.ok(third.fetched && third.legacyRow === 'none');
});

test('cancel → EVERY row of the reservation is marked, none deleted; a second cancel marks nothing; another booking\'s rows untouched', async () => {
  const { rows, port } = keyedStore([{ sourceId: 'res_other' }, { sourceId: 'res_other:seg:0' }]);
  await refreshFlightReservation(refreshPorts(port), ROW);
  const size = rows.size;
  const first = await markBookingCalendarCancelled(port, 'res_c2');
  const second = await markBookingCalendarCancelled(port, 'res_c2');
  assert.equal(first.marked, 3, 'all three legs');
  assert.equal(second.marked, 0, 'idempotent');
  assert.equal(rows.size, size, 'none deleted');
  for (const k of ['res_c2:seg:0', 'res_c2:seg:1', 'res_c2:seg:2']) {
    assert.equal(rows.get(k)?.status, 'cancelled');
    assert.ok(rows.get(k)?.title.startsWith(CANCELLED_TITLE_PREFIX));
  }
  assert.equal(rows.get('res_other')?.status, 'committed', 'a prefix is <id>:seg: — another id is not matched');
  // A vendor-cancelled flight marks every leg through the apply leaf, in the same refresh.
  const fresh = keyedStore();
  const out = await refreshFlightReservation(refreshPorts(fresh.port, { ...STATED, status: 'CANCELLED' }), ROW);
  assert.ok(out.fetched && out.statusValue === 'cancelled');
  assert.ok([...fresh.rows.values()].every((r) => r.status === 'cancelled'), 'every leg of a vendor-cancelled flight reads cancelled');
  // A leg first written for a reservation ALREADY cancelled is marked as it lands.
  const late = keyedStore();
  const lateOut = await writeFlightSegmentRows(late.port, { reservationId: 'res_c2', reservationCancelled: true, decisions: flightSegmentsCalendarDecision({ reservationId: 'res_c2', userId: 'u_1', segments: SEGMENTS }) });
  assert.equal(lateOut.marked, 3);
  assert.ok([...late.rows.values()].every((r) => r.status === 'cancelled'));
});

test('the old single-row key → re-keyed to seg:0 IN PLACE (the retro\'s writer), the count stays 1; a cancelled one keeps its mark', async () => {
  const { rows, port } = keyedStore([{ sourceId: 'res_c2' }]);
  const legacyId = rows.get('res_c2')?.id;
  const decisions = flightSegmentsCalendarDecision({ reservationId: 'res_c2', userId: 'u_1', segments: [SEGMENTS[0]] });
  const out = await writeFlightSegmentRows(port, { reservationId: 'res_c2', reservationCancelled: false, decisions });
  assert.equal(out.legacy, 'rekeyed');
  assert.equal(rows.size, 1, 'the count stays 1 — never duplicated');
  assert.equal(rows.get('res_c2:seg:0')?.id, legacyId, 'the SAME row, moved to seg:0');
  assert.equal(rows.get('res_c2:seg:0')?.title, 'AirAsia FD 351 BKK → KUL', 'and updated to the segment');
  assert.equal(rows.has('res_c2'), false);
  const again = await writeFlightSegmentRows(port, { reservationId: 'res_c2', reservationCancelled: false, decisions });
  assert.equal(again.legacy, 'none');
  assert.equal(rows.size, 1, 'a second run changes nothing');
  // Three segments over a legacy row: seg:0 is the moved row, the others inserted — three rows, not four.
  const three = keyedStore([{ sourceId: 'res_c2' }]);
  await writeFlightSegmentRows(three.port, { reservationId: 'res_c2', reservationCancelled: false, decisions: flightSegmentsCalendarDecision({ reservationId: 'res_c2', userId: 'u_1', segments: SEGMENTS }) });
  assert.deepEqual([...three.rows.keys()].sort(), ['res_c2:seg:0', 'res_c2:seg:1', 'res_c2:seg:2']);
  // A legacy row already marked cancelled keeps its mark through the re-key.
  const marked = keyedStore([{ sourceId: 'res_c2', title: `${CANCELLED_TITLE_PREFIX}X (flight)`, status: 'cancelled' }]);
  await writeFlightSegmentRows(marked.port, { reservationId: 'res_c2', reservationCancelled: true, decisions });
  assert.equal(marked.rows.get('res_c2:seg:0')?.title, `${CANCELLED_TITLE_PREFIX}AirAsia FD 351 BKK → KUL`);
  // The retro runs exactly this writer over the LATEST LANDED read — no vendor call.
  const retro = code('scripts/cal-02-retro-segments.ts');
  assert.match(retro, /writeFlightSegmentRows\(port, \{/);
  assert.match(retro, /flightSegmentsCalendarDecision\(\{ reservationId: row\.id, userId: row\.userId, segments \}\)/);
  assert.match(retro, /where: \{ provider: LITEAPI, resource: BOOKING_READ, their_id: bookingReadTheirId\(row\.providerBookingId\), user_id: row\.userId \},\s*orderBy: \{ arrived: 'desc' \},/, 'the LATEST landed read of the row\'s own owner');
  assert.doesNotMatch(retro, /getFlightBooking\(|reserveTravelSearch|refreshFlightReservation\(|\bfetch\(/, 'no vendor call');
  assert.match(retro, /LEFT AS IS — no booking read has landed/, 'a reservation with no landed read is named and left as is');
  assert.match(retro, /--dry-run/);
});

// ── the ICS builder ─────────────────────────────────────────────────────────

const STAY: IcsRow = {
  id: 'cal-1', title: 'Ibis, Phuket; Kata\nBeach (stay)', status: 'committed',
  start_date: new Date('2026-10-23T00:00:00Z'), end_date: new Date('2026-10-26T00:00:00Z'),
  start_time: null, end_time: null, start_at: null, end_at: null, updated_at: new Date('2026-09-20T08:30:00Z'),
};

test('ICS golden: escaping, folding at 75 octets, DTSTAMP = updated_at, all-day as VALUE=DATE (non-inclusive end), CANCELLED, an excluded row named', () => {
  const leg: IcsRow = {
    id: 'cal-2', title: `${CANCELLED_TITLE_PREFIX}Thai Vietjet Air 228 BKK → HKT`, status: 'cancelled',
    start_date: new Date('2026-10-25T00:00:00Z'), end_date: new Date('2026-10-25T00:00:00Z'),
    start_time: new Date('1970-01-01T14:15:00Z'), end_time: new Date('1970-01-01T15:40:00Z'), start_at: null, end_at: null,
    updated_at: new Date('2026-09-26T11:02:03Z'),
  };
  const built = buildIcs([STAY, leg, { ...STAY, id: 'cal-3', updated_at: null }]);
  assert.equal(built.text, [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Temple Stuart//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    // 75 octets exactly (the two dashes are 3 octets each), then the continuation's one space.
    'X-TEMPLESTUART-EXCLUDED:cal-3 — no updated_at on the row — no DTSTAMP c',
    ' an be stated for it\\, and none is invented',
    'BEGIN:VEVENT',
    'UID:cal-1@templestuart.com',
    'DTSTAMP:20260920T083000Z',
    'DTSTART;VALUE=DATE:20261023',
    'DTEND;VALUE=DATE:20261027',
    'SUMMARY:Ibis\\, Phuket\\; Kata\\nBeach (stay)',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:cal-2@templestuart.com',
    'DTSTAMP:20260926T110203Z',
    'DTSTART;VALUE=DATE:20261025',
    'DTEND;VALUE=DATE:20261026',
    'DESCRIPTION:Departs 2026-10-25 14:15 · arrives 2026-10-25 15:40 — local ',
    ' times as stated\\; no time zone is stated\\, so this event carries its days ',
    ' only',
    'SUMMARY:Cancelled: Thai Vietjet Air 228 BKK → HKT',
    'STATUS:CANCELLED',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n'));
  assert.deepEqual(built.excluded, [{ id: 'cal-3', reason: 'no updated_at on the row — no DTSTAMP can be stated for it, and none is invented' }]);
  for (const line of built.text.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `a line over 75 octets: ${line}`);
});

test('ICS: a stated instant is UTC Z form; an end not after the start writes no DTEND; a live row asserts no STATUS; folding never splits a character', () => {
  const instant = buildIcs([{ ...STAY, start_at: new Date('2026-10-25T01:15:00Z'), end_at: new Date('2026-10-25T02:40:00Z') }]).text;
  assert.match(instant, /\r\nDTSTART:20261025T011500Z\r\nDTEND:20261025T024000Z\r\n/);
  assert.doesNotMatch(instant, /STATUS:/, 'no status is asserted for a live row');
  assert.doesNotMatch(instant, /VALUE=DATE/);
  const backwards = buildIcs([{ ...STAY, start_at: new Date('2026-10-25T09:00:00Z'), end_at: new Date('2026-10-25T08:00:00Z') }]).text;
  assert.doesNotMatch(backwards, /DTEND/, 'an end before its start is not written — never swapped, never invented');
  const oneDay = buildIcs([{ ...STAY, end_date: null }]).text;
  assert.doesNotMatch(oneDay, /DTEND/, 'a single day writes no DTEND (RFC 5545: one day)');
  const dateLine = buildIcs([{ ...STAY, end_date: new Date('2026-10-22T00:00:00Z') }]).text;
  assert.doesNotMatch(dateLine, /DTEND/, 'an end_date before start_date writes no DTEND (the grid shows the start day only)');
  const arrows = `SUMMARY:${'→'.repeat(40)}`;
  const folded = foldIcsLine(arrows);
  assert.equal(folded.split('\r\n ').join(''), arrows, 'unfolding restores the line exactly');
  folded.split('\r\n ').forEach((part, i) => assert.ok(Buffer.byteLength(part, 'utf8') <= (i === 0 ? 75 : 74)));
  assert.equal(escapeIcsText('a\\b;c,d\ne\r\nf'), 'a\\\\b\\;c\\,d\\ne\\nf');
});

test('ICS: the builder is pure — no import, no clock, no env, no database, no network', () => {
  const src = code('src/lib/calendar/ics.ts');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /new Date\(\)|Date\.now\(|now\(\)|process\.env|prisma|fetch\(/);
  assert.match(comments('src/lib/calendar/ics.ts'), /NEVER now\(\)/, 'the rule is written where the next reader meets it');
});

// ── the exports ─────────────────────────────────────────────────────────────

function exportPorts(rows: IcsRow[] = [STAY]) {
  const asked: Array<{ ids: string[]; userId: string }> = [];
  const ports: IcsExportPorts = {
    async findUser(email) { return email === 'me@example.com' ? { id: 'u_me' } : email === 'them@example.com' ? { id: 'u_them' } : null; },
    // The owner's bookings: r_mine is theirs; r_theirs belongs to u_them; r_guest is a guest row (userId null — matches nobody).
    async findReservation(id, userId) { return (id === 'r_mine' && userId === 'u_me') || (id === 'r_theirs' && userId === 'u_them') ? { id } : null; },
    async findTrip(id, userId) { return id === 't_mine' && userId === 'u_me' ? { id } : null; },
    async tripReservationIds(tripId, userId) { return tripId === 't_mine' && userId === 'u_me' ? ['r_mine'] : []; },
    async calendarRows(ids, userId) { asked.push({ ids, userId }); return rows; },
  };
  return { ports, asked };
}

test('the exports: 401 without a session; another user\'s booking or trip → 404; a guest booking → 404; the owner\'s → 200 with its own rows', async () => {
  const { ports, asked } = exportPorts();
  assert.equal((await reservationIcs(ports, { userEmail: null, reservationId: 'r_mine' })).status, 401);
  assert.equal((await reservationIcs(ports, { userEmail: 'nobody@example.com', reservationId: 'r_mine' })).status, 404);
  assert.equal((await reservationIcs(ports, { userEmail: 'me@example.com', reservationId: 'r_theirs' })).status, 404, 'another user\'s booking — a defensive 404');
  assert.equal((await reservationIcs(ports, { userEmail: 'me@example.com', reservationId: 'r_guest' })).status, 404, 'a guest booking — a defensive 404');
  assert.equal((await tripIcs(ports, { userEmail: 'them@example.com', tripId: 't_mine' })).status, 404, 'another user\'s trip — a defensive 404');
  assert.equal((await tripIcs(ports, { userEmail: null, tripId: 't_mine' })).status, 401);
  assert.equal(asked.length, 0, 'no refused caller reached a calendar row');
  const mine = await reservationIcs(ports, { userEmail: 'me@example.com', reservationId: 'r_mine' });
  assert.ok(mine.status === 200 && mine.filename === 'booking-r_mine.ics' && mine.ics.startsWith('BEGIN:VCALENDAR\r\n'));
  const trip = await tripIcs(ports, { userEmail: 'me@example.com', tripId: 't_mine' });
  assert.ok(trip.status === 200 && trip.filename === 'trip-t_mine.ics');
  assert.deepEqual(asked, [{ ids: ['r_mine'], userId: 'u_me' }, { ids: ['r_mine'], userId: 'u_me' }], 'only the caller\'s own booking ids, under the caller\'s id');
  // No row to export (no stated day yet; or only a row with no updated_at) is a 404 BY NAME — never an empty VCALENDAR.
  const empty = exportPorts([]);
  const none = await reservationIcs(empty.ports, { userEmail: 'me@example.com', reservationId: 'r_mine' });
  assert.ok(none.status === 404 && /no day is stated for this booking/.test(none.error));
  const tripNone = await tripIcs(empty.ports, { userEmail: 'me@example.com', tripId: 't_mine' });
  assert.ok(tripNone.status === 404 && /no booking on this trip has a stated day/.test(tripNone.error));
  const unstamped = await reservationIcs(exportPorts([{ ...STAY, updated_at: null }]).ports, { userEmail: 'me@example.com', reservationId: 'r_mine' });
  assert.equal(unstamped.status, 404, 'a file holding no VEVENT is not a calendar');
});

test('the export routes and their ports: no vendor client imported, zero writes, text/calendar as an attachment, every read caller-scoped', () => {
  for (const f of ['src/app/api/reservations/[id]/ics/route.ts', 'src/app/api/trips/[id]/ics/route.ts', 'src/lib/calendar/icsExport.ts', 'src/lib/calendar/prismaIcsPorts.ts', 'src/lib/calendar/ics.ts']) {
    // LAW-02 (2026-09-27): the ports' ONE read-only $queryRaw — DTSTAMP read as an instant — is lifted out before the no-write scan.
    const s = f.endsWith('prismaIcsPorts.ts') ? code(f).replace(/await prisma\.\$queryRaw<[\s\S]*?>`\s*SELECT[^`]*`/, '') : code(f);
    assert.doesNotMatch(s, /liteapiClient|liteapiFlightsClient|viatorClient|duffel|\bfetch\s*\(|reserveTravelSearch/, `${f}: no vendor client`);
    assert.doesNotMatch(s, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, `${f}: zero writes`);
  }
  for (const f of ['src/app/api/reservations/[id]/ics/route.ts', 'src/app/api/trips/[id]/ics/route.ts']) {
    const s = code(f);
    assert.match(s, /'Content-Type': 'text\/calendar; charset=utf-8'/);
    assert.match(s, /'Content-Disposition': `attachment; filename="\$\{answer\.filename\}"`/);
    assert.match(s, /await getVerifiedEmail\(\)/);
  }
  const ports = code('src/lib/calendar/prismaIcsPorts.ts');
  assert.match(ports, /prisma\.reservations\.findFirst\(\{ where: \{ id, userId \}, select: \{ id: true \} \}\)/, 'the booking by { id, userId } — a guest row never matches');
  assert.match(ports, /prisma\.trips\.findFirst\(\{ where: \{ id, userId \}, select: \{ id: true \} \}\)/);
  assert.match(ports, /prisma\.reservations\.findMany\(\{ where: \{ tripId, userId \}, select: \{ id: true \} \}\)/);
  assert.match(ports, /where: \{ user_id: userId, \.\.\.bookingCalendarRowsWhere\(reservationIds\) \},/);
});

// ── the readers ─────────────────────────────────────────────────────────────

test('no reader double-counts a reservation with several rows', () => {
  // THE LIST: one row per RESERVATION (it maps reservations, not calendar rows), and a
  // flight's legs fold back to ONE day — the earliest — through the one key reader.
  const list = code('src/app/api/reservations/route.ts');
  assert.match(list, /const bookings = reservations\.map\(\(r\) =>/, 'the list is built from reservations');
  assert.match(list, /where: \{ user_id: user\.id, \.\.\.bookingCalendarRowsWhere\(ids\) \},\s*orderBy: \{ start_date: 'asc' \},/);
  assert.match(list, /const rid = reservationIdOfCalendarSourceId\(c\.source_id\);\s*if \(!dayOf\.has\(rid\)\) dayOf\.set\(rid, c\.start_date\);/);
  // The fold itself, over three legs of one booking and one stay: two bookings, two days.
  const rows = [
    { source_id: 'r1:seg:0', start_date: '2026-10-25' }, { source_id: 'r1:seg:1', start_date: '2026-10-25' },
    { source_id: 'h1', start_date: '2026-10-26' }, { source_id: 'r1:seg:2', start_date: '2026-10-30' },
  ];
  const dayOf = new Map<string, string>();
  for (const c of rows) { const rid = reservationIdOfCalendarSourceId(c.source_id); if (!dayOf.has(rid)) dayOf.set(rid, c.start_date); }
  assert.deepEqual([...dayOf.entries()], [['r1', '2026-10-25'], ['h1', '2026-10-26']]);
  // THE TIMELINE lists records — one line per calendar row, each naming its row — and reads them all.
  assert.match(code('src/app/api/reservations/[id]/timeline/route.ts'), /where: \{ user_id: user\.id, \.\.\.bookingCalendarRowsWhere\(\[reservation\.id\]\) \},/);
  // THE CALENDAR FEED counts no bookings: its per-source counts name no 'reservation'.
  assert.doesNotMatch(code('src/app/api/calendar/route.ts'), /calcCount\('reservation'\)|calcTotal\('reservation'\)/);
  // No reader anywhere matches a booking's rows by one key.
  for (const f of ['src/app/api/reservations/route.ts', 'src/app/api/reservations/[id]/timeline/route.ts', 'src/lib/calendar/prismaIcsPorts.ts']) {
    assert.doesNotMatch(code(f), /source: 'reservation', source_id:/, `${f} reads through the one where`);
  }
  // The one where: every bare key and each segment prefix.
  assert.deepEqual(bookingCalendarRowsWhere(['a']), { source: 'reservation', OR: [{ source_id: { in: ['a'] } }, { source_id: { startsWith: 'a:seg:' } }] });
});

test('the doors: an "Add to calendar" link on the receipt page and on every row of the one bookings list', () => {
  assert.match(code('src/components/trips/AllBookings.tsx'), /<a href=\{b\.icsHref\}[^>]*data-booking-ics=\{b\.id\}>\s*\{BOOKING_WORDS\.addToCalendar\}/);
  assert.match(code('src/app/booking/[id]/receipt/page.tsx'), /<a href=\{bookingIcsHref\(id\)\}[^>]*data-receipt-ics>\s*\{BOOKING_WORDS\.addToCalendar\}/);
});
