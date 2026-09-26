/**
 * STATUS-01 (2026-09-26) — the vendor's current truth reaches every reservation.
 *
 * A WEBHOOK IS A HINT. THE GET IS THE TRUTH. One test per proof the ruling names.
 * The apply leaf and the webhook leaf are driven through fixtures shaped by the
 * two GET references and the webhook guide; the routes' contracts are read from
 * source the way this repo proves a route it cannot execute without a provider
 * or a database. No live vendor call, no live send.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code, comments } from '../sourceText';
import { hotelProviderStatusToReservation } from '../reservations/hotelStatus';
import { flightProviderStatusToReservation } from '../reservations/flightStatus';
import { applyVendorState, type ApplyPorts, type ApplyRow, type ReservationPatch } from '../reservations/applyVendorState';
import { parseBookResult, parseHotelBookingState, hotelBookingReadObjectOf } from '../liteapiClient';
import { parseFlightBookingDetails } from '../liteapiFlightsClient';
import { constantTimeEqual, laneOfWebhookEvent, parseLiteApiWebhookDelivery, resolveWebhookBookingId, LITEAPI_HOTEL_EVENTS, LITEAPI_FLIGHT_EVENTS } from '../webhooks/liteapiWebhook';
import { landLiteApiBookingRead, landLiteApiWebhookBytes, landLiteApiWebhookEvent, bookingReadTheirId, webhookGuestRef, BOOKING_READ, WEBHOOK } from '../arrivals/liteapiBooking';
import { kindOf } from '../providers';
import { FakeLanding } from './fakeLanding';
import { BOOKING_CALENDAR_SOURCE } from '../calendar/bookingEvent';

const APPLY = 'src/lib/reservations/applyVendorState.ts';
const HOTEL_LEAF = 'src/lib/reservations/hotelStatus.ts';
const FLIGHT_LEAF = 'src/lib/reservations/flightStatus.ts';
const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
const SENDER = 'src/lib/reservations/lifecycleSend.ts';
const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
const WEBHOOK_ROUTE = 'src/app/api/webhooks/liteapi/route.ts';
const WEBHOOK_LEAF = 'src/lib/webhooks/liteapiWebhook.ts';
const CRON_ROUTE = 'src/app/api/cron/reservations-refresh/route.ts';
const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';
const RETRO = 'scripts/status-01-retro-reservations.ts';
const MIGRATION = 'prisma/migrations/20260926120000_status_01_vendor_truth/migration.sql';

const READ_AT = new Date('2026-09-26T10:00:00.000Z');
const ASKED = new Date('2026-09-26T09:59:59.500Z');

// ── the words ───────────────────────────────────────────────────────────────

test('the hotel leaf lists every documented word by name; an absent or unlisted word is null, never a default', () => {
  assert.equal(hotelProviderStatusToReservation('CONFIRMED'), 'confirmed');
  assert.equal(hotelProviderStatusToReservation('confirmed'), 'confirmed', 'case-insensitive');
  assert.equal(hotelProviderStatusToReservation('CANCELED'), 'cancelled', 'the book/read pages spell it with one L');
  assert.equal(hotelProviderStatusToReservation('CANCELLED'), 'cancelled', 'the cancel page spells it with two');
  assert.equal(hotelProviderStatusToReservation('CANCELLED_WITH_CHARGES'), 'cancelled');
  assert.equal(hotelProviderStatusToReservation('FAILED'), 'failed', 'a FAILED book answer is failed — never pending, never confirmed');
  for (const other of [null, undefined, '', 'PENDING', 'ON_HOLD', 'REBOOKED']) assert.equal(hotelProviderStatusToReservation(other), null, `${String(other)} is unlisted`);
  const c = comments(HOTEL_LEAF);
  for (const page of ['post_rates-book', 'get_bookings-bookingid', 'put_bookings-bookingid']) assert.match(c, new RegExp(page), `the header cites ${page}`);
});

test('the flight leaf gained the pre-confirmation words and the two failure words, by name', () => {
  for (const early of ['CREATED', 'PENDING_CONFIRMATION', 'PENDING']) assert.equal(flightProviderStatusToReservation(early), 'pending', early);
  for (const live of ['CONFIRMED', 'TICKETED']) assert.equal(flightProviderStatusToReservation(live), 'confirmed', live);
  for (const gone of ['CANCELLED', 'CANCELLED_WITH_CHARGES']) assert.equal(flightProviderStatusToReservation(gone), 'cancelled', gone);
  for (const dead of ['FAILED', 'EXPIRED']) assert.equal(flightProviderStatusToReservation(dead), 'failed', dead);
  for (const other of [null, undefined, '', 'REBOOKED']) assert.equal(flightProviderStatusToReservation(other), null, `${String(other)} is unlisted`);
});

test('a hotel book answer with no status states NO status — never CONFIRMED; the route records pending by name and never collapses a word', () => {
  assert.equal(parseBookResult({}).status, null, 'parseBookResult invents no word');
  assert.equal(parseBookResult({ status: 'FAILED' }).status, 'FAILED', 'and passes the vendor word verbatim');
  assert.equal(hotelProviderStatusToReservation(parseBookResult({ status: 'FAILED' }).status), 'failed', 'FAILED lands as failed');
  assert.equal(hotelProviderStatusToReservation(parseBookResult({}).status), null, 'no status is unlisted — the route says so and records pending');
  const route = code(HOTEL_BOOK);
  assert.match(route, /const mappedStatus = hotelProviderStatusToReservation\(parsed\.status\);/, 'through the hotel leaf');
  assert.match(route, /const status = mappedStatus === null \? 'pending' : mappedStatus;/, 'pending only for an unlisted or absent word, never a default of the vendor word');
  assert.match(route, /STATUS-01 the vendor stated \$\{parsed\.status === null \? 'NO status' : `status "\$\{parsed\.status\}", a word the hotel leaf does not list`\} — recorded pending/, 'and says which, by name');
  assert.ok(!route.includes("'CONFIRMED'") && !route.includes("|| 'CONFIRMED'"), 'the inline mapping and its default are gone');
  const client = code(HOTEL_CLIENT);
  assert.ok(!/\?\? 'CONFIRMED'/.test(client) && !/\|\| 'CONFIRMED'/.test(client), 'the client no longer defaults a status');
  assert.match(client, /status: typeof d\.status === 'string' \? d\.status : null,/, 'parseBookResult states null for an absent status');
});

// ── the one apply leaf, over fake ports ─────────────────────────────────────

const HOTEL_ROW: ApplyRow = { id: 'res_h1', lane: 'hotel', status: 'confirmed', providerConfirmationCode: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, ticketedEmailSentAt: null, confirmationEmailSentAt: null };
const FLIGHT_ROW: ApplyRow = { id: 'res_f1', lane: 'flight', status: 'confirmed', providerConfirmationCode: 'FH-269-920QSVHH', ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, ticketedEmailSentAt: null, confirmationEmailSentAt: null };

function fakeApplyPorts() {
  const writes: Array<{ id: string; patch: ReservationPatch }> = [];
  const marked: string[] = [];
  const commission: string[] = [];
  const log: string[] = [];
  const ports: ApplyPorts = {
    writeReservation: async (id, patch) => { writes.push({ id, patch }); },
    calendar: { async markCancelled(source, sourceId) { marked.push(`${source}:${sourceId}`); return 1; } },
    cancelCommission: async (id) => { commission.push(id); return 2; },
    log: (line) => log.push(line),
  };
  return { ports, writes, marked, commission, log };
}

/** The row as the write left it — what the next read sees. */
const after = (row: ApplyRow, patch: ReservationPatch): ApplyRow => ({ ...row, ...patch, providerConfirmationCode: patch.providerConfirmationCode ?? row.providerConfirmationCode });

test('hotel: the confirmation code arrives (null → stated) — ONE hotel_confirmation_arrived email, its marker in the same write; the next read sends nothing', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, HOTEL_ROW, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', readAt: READ_AT });
  assert.equal(out.status, 'unchanged');
  assert.deepEqual(out.changes, ['providerConfirmationCode null → "HCC-4421"']);
  assert.deepEqual(out.emails, [{ kind: 'hotel_confirmation_arrived', confirmationCode: 'HCC-4421' }]);
  assert.deepEqual(f.writes, [{ id: 'res_h1', patch: { lastVendorReadAt: READ_AT, providerConfirmationCode: 'HCC-4421', confirmationEmailSentAt: READ_AT } }], 'the marker rides the SAME write as the code');
  assert.equal(f.marked.length + f.commission.length, 0);
  // The second read of an unchanged booking changes nothing and sends nothing.
  const g = fakeApplyPorts();
  const again = await applyVendorState(g.ports, after(HOTEL_ROW, f.writes[0].patch), { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', readAt: READ_AT });
  assert.deepEqual(again.changes, []);
  assert.deepEqual(again.emails, []);
  assert.deepEqual(g.writes, [{ id: 'res_h1', patch: { lastVendorReadAt: READ_AT } }], 'only the read stamp');
  // A stated code never overwrites a stated code.
  const h = fakeApplyPorts();
  const other = await applyVendorState(h.ports, { ...HOTEL_ROW, providerConfirmationCode: 'HCC-0001' }, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', readAt: READ_AT });
  assert.deepEqual(other.changes, []);
  assert.deepEqual(h.writes[0].patch, { lastVendorReadAt: READ_AT });
});

test('hotel: the code arrives but the one email attempt was already made — no second send, named', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, { ...HOTEL_ROW, confirmationEmailSentAt: new Date('2026-09-25T00:00:00Z') }, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', readAt: READ_AT });
  assert.deepEqual(out.emails, []);
  assert.deepEqual(f.writes[0].patch, { lastVendorReadAt: READ_AT, providerConfirmationCode: 'HCC-4421' }, 'the code is still applied; the marker is not re-stamped');
  assert.ok(f.log.some((l) => /already attempted at 2026-09-25T00:00:00.000Z — no second send/.test(l)));
});

test('flight: ticketedAt arrives (null → stated) — ONE ticketed email, its marker in the same write; ticketLimitTime rides along; the next read sends nothing', async () => {
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, FLIGHT_ROW, { lane: 'flight', bookingId: 'fb_9Q', status: 'CONFIRMED', pnr: 'ABC123', ticketedAt: '2026-09-26T08:30:00Z', ticketLimitTime: '2026-09-27T23:59:00Z', cancelIntentAt: null, readAt: READ_AT });
  assert.deepEqual(out.emails, [{ kind: 'ticketed' }]);
  assert.deepEqual(out.changes, ['ticketedAt null → 2026-09-26T08:30:00Z', 'ticketLimitTime null → 2026-09-27T23:59:00Z']);
  const written: ReservationPatch = f.writes[0].patch;
  assert.equal(written.providerConfirmationCode, undefined, 'a stated code (the booking reference) is never overwritten by the PNR');
  assert.deepEqual(f.writes, [{ id: 'res_f1', patch: { lastVendorReadAt: READ_AT, ticketedAt: new Date('2026-09-26T08:30:00Z'), ticketedEmailSentAt: READ_AT, ticketLimitTime: new Date('2026-09-27T23:59:00Z') } }]);
  const g = fakeApplyPorts();
  const again = await applyVendorState(g.ports, after(FLIGHT_ROW, f.writes[0].patch), { lane: 'flight', bookingId: 'fb_9Q', status: 'CONFIRMED', pnr: 'ABC123', ticketedAt: '2026-09-26T08:30:00Z', ticketLimitTime: '2026-09-27T23:59:00Z', cancelIntentAt: null, readAt: READ_AT });
  assert.deepEqual(again.changes, []);
  assert.deepEqual(again.emails, []);
  assert.deepEqual(g.writes[0].patch, { lastVendorReadAt: READ_AT });
  // The PNR lands as the confirmation code only when ours is null.
  const h = fakeApplyPorts();
  await applyVendorState(h.ports, { ...FLIGHT_ROW, providerConfirmationCode: null }, { lane: 'flight', bookingId: 'fb_9Q', status: 'CONFIRMED', pnr: 'ABC123', ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, readAt: READ_AT });
  assert.equal(h.writes[0].patch.providerConfirmationCode, 'ABC123');
  // An unparseable timestamp is left NULL and named.
  const i = fakeApplyPorts();
  const bad = await applyVendorState(i.ports, FLIGHT_ROW, { lane: 'flight', bookingId: 'fb_9Q', status: 'CONFIRMED', pnr: null, ticketedAt: 'yesterday', ticketLimitTime: null, cancelIntentAt: null, readAt: READ_AT });
  assert.deepEqual(bad.emails, []);
  assert.deepEqual(i.writes[0].patch, { lastVendorReadAt: READ_AT });
  assert.ok(i.log.some((l) => /ticketData\.ticketedAt "yesterday" is not a timestamp — left NULL/.test(l)));
});

test('cancel_pending + the GET says CANCELLED → cancelled, cancelIntentAt cleared, the day marked, the estimated commission moved, and NO money_events — named', async () => {
  const row: ApplyRow = { ...FLIGHT_ROW, status: 'cancel_pending', cancelIntentAt: new Date('2026-09-26T09:05:00Z') };
  const f = fakeApplyPorts();
  const out = await applyVendorState(f.ports, row, { lane: 'flight', bookingId: 'fb_9Q', status: 'CANCELLED_WITH_CHARGES', pnr: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: '2026-09-26T09:05:00Z', readAt: READ_AT });
  assert.equal(out.status, 'set');
  assert.equal(out.statusValue, 'cancelled');
  assert.deepEqual(f.writes, [{ id: 'res_f1', patch: { lastVendorReadAt: READ_AT, status: 'cancelled', cancelIntentAt: null } }]);
  assert.deepEqual(f.marked, [`${BOOKING_CALENDAR_SOURCE}:res_f1`], 'the CAL-01 row is marked through markBookingCalendarCancelled');
  assert.deepEqual(f.commission, ['res_f1']);
  assert.equal(out.calendarMarked, 1);
  assert.equal(out.commissionMoved, 2);
  assert.equal(out.moneyEvents, 'not_available_from_read', 'the GET documents no refund or fee figures — nothing is invented');
  assert.ok(f.log.some((l) => /refund and fee figures are NOT available from the booking read .* no money_events row is written/.test(l)));
  assert.deepEqual(out.emails, []);
  assert.ok(!/money_events\.create/.test(code(APPLY)), 'the apply leaf writes no money row');
});

test('cancel_pending + the GET still says CONFIRMED (or a pending word) → unchanged; only the read stamp is written', async () => {
  const row: ApplyRow = { ...FLIGHT_ROW, status: 'cancel_pending', cancelIntentAt: new Date('2026-09-26T09:05:00Z') };
  for (const word of ['CONFIRMED', 'PENDING_CONFIRMATION', 'CREATED']) {
    const f = fakeApplyPorts();
    const out = await applyVendorState(f.ports, row, { lane: 'flight', bookingId: 'fb_9Q', status: word, pnr: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: '2026-09-26T09:05:00Z', readAt: READ_AT });
    assert.equal(out.status, 'unchanged', word);
    assert.equal(out.statusValue, 'cancel_pending');
    assert.deepEqual(f.writes[0].patch, { lastVendorReadAt: READ_AT }, word);
    assert.equal(f.marked.length + f.commission.length, 0);
  }
  assert.match(code(APPLY), /else if \(row\.status === 'cancel_pending' && mapped === 'confirmed'\) status = 'unchanged';/, 'CANCEL-01 guard, moved here');
  assert.match(code(APPLY), /else if \(row\.status === 'cancel_pending' && mapped === 'pending'\) status = 'unchanged';/, 'and stricter: a pending word does not undo the request either');
  assert.ok(!/cancel_pending/.test(code(REFRESH)), 'the refresh no longer carries the guard — it lives in the one leaf');
});

test('a GET with no status, or an unlisted word → unlisted, the row unchanged, the reason named; a hotel CANCELED read → cancelled', async () => {
  const f = fakeApplyPorts();
  const none = await applyVendorState(f.ports, HOTEL_ROW, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: null, hotelConfirmationCode: null, readAt: READ_AT });
  assert.equal(none.status, 'unlisted');
  assert.equal(none.statusValue, 'confirmed');
  assert.ok(f.log.some((l) => /the vendor stated NO status, a word the hotel leaf does not list — status left as "confirmed"/.test(l)));
  const g = fakeApplyPorts();
  const odd = await applyVendorState(g.ports, HOTEL_ROW, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'ON_HOLD', hotelConfirmationCode: null, readAt: READ_AT });
  assert.equal(odd.status, 'unlisted');
  assert.ok(g.log.some((l) => /status "ON_HOLD", a word the hotel leaf does not list/.test(l)));
  assert.deepEqual(g.writes[0].patch, { lastVendorReadAt: READ_AT });
  const h = fakeApplyPorts();
  const gone = await applyVendorState(h.ports, HOTEL_ROW, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'CANCELED', hotelConfirmationCode: null, readAt: READ_AT });
  assert.equal(gone.statusValue, 'cancelled');
  assert.deepEqual(h.marked, [`${BOOKING_CALENDAR_SOURCE}:res_h1`]);
  await assert.rejects(() => applyVendorState(fakeApplyPorts().ports, HOTEL_ROW, { lane: 'flight', bookingId: 'x', status: 'CONFIRMED', pnr: null, ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, readAt: READ_AT }), /the wrong GET was applied/);
});

test('the apply leaf reads no clock and defaults nothing; lastVendorReadAt is the landed answer instant', () => {
  const leaf = code(APPLY);
  assert.ok(!/new Date\(\)/.test(leaf), 'never new Date()');
  assert.ok(!/\?\? '(pending|confirmed|cancelled|failed)'/.test(leaf), 'no default status');
  assert.match(leaf, /const patch: ReservationPatch = \{ lastVendorReadAt: vendor\.readAt \};/);
  assert.match(leaf, /const mapped = vendor\.lane === 'hotel' \? hotelProviderStatusToReservation\(vendor\.status\) : flightProviderStatusToReservation\(vendor\.status\);/, 'through the two lane leaves, nothing else');
});

// ── the parsers over the two GET references ─────────────────────────────────

test('the hotel read parses the documented shape; a 2xx without a bookingId is a contract deviation', () => {
  const state = parseHotelBookingState({ bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: null, paymentStatus: 'PAID', amountRefunded: 0, refundType: null });
  assert.deepEqual(state, { bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: null, paymentStatus: 'PAID', amountRefunded: 0, refundType: null, refundedAt: null, updatedAt: null });
  assert.deepEqual(hotelBookingReadObjectOf({ data: { bookingId: 'h1', status: 'CANCELED' } }), { bookingId: 'h1', status: 'CANCELED' });
  assert.throws(() => hotelBookingReadObjectOf({ data: { status: 'CONFIRMED' } }), /2xx carries no bookingId — contract deviation/);
  const client = code(HOTEL_CLIENT);
  assert.match(client, /if \(res\.status === 204\) \{\s*throw new LiteApiError\('\/v3\.0\/bookings\/\{id\} \(read\)', 204, 'Booking Id not found/, 'the documented 204 is named, never parsed as success');
});

test('the flight read carries ticketedAt, ticketLimitTime, the PNR and cancelIntentAt as stated — null when absent', () => {
  const d = parseFlightBookingDetails({ bookingId: 'fb_9Q', status: 'CONFIRMED', ticketLimitTime: '2026-09-27T23:59:00Z', ticketData: { confirmationId: 'T1', ticketedAt: '2026-09-26T08:30:00Z' }, order: { reference: { provider: { pnr: 'ABC123' }, airlineBookings: [{ pnr: 'ZZZ999' }] } } });
  assert.equal(d.ticketedAt, '2026-09-26T08:30:00Z');
  assert.equal(d.ticketLimitTime, '2026-09-27T23:59:00Z');
  assert.equal(d.pnr, 'ABC123', 'the provider PNR first');
  assert.equal(d.cancelIntentAt, null);
  const e = parseFlightBookingDetails({ bookingId: 'fb_9Q', order: { reference: { airlineBookings: [{ pnr: 'ZZZ999' }] } } });
  assert.equal(e.pnr, 'ZZZ999', 'else the first airline booking PNR');
  const none = parseFlightBookingDetails({ bookingId: 'fb_9Q' });
  assert.deepEqual([none.ticketedAt, none.ticketLimitTime, none.pnr, none.status], [null, null, null, null]);
});

// ── the landings ────────────────────────────────────────────────────────────

test('a booking read lands its bytes and ONE snapshot (liteapi · booking_read, their_id read:<id>); the same state again is already_landed', async () => {
  assert.equal(kindOf('liteapi', BOOKING_READ), 'snapshot');
  assert.equal(kindOf('liteapi', WEBHOOK), 'event');
  const landing = new FakeLanding();
  const object = { bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421' };
  const text = JSON.stringify({ data: object });
  const answer = { httpStatus: 200, body: Buffer.from(text, 'utf8'), asked: ASKED, arrived: READ_AT, json: JSON.parse(text) };
  const first = await landLiteApiBookingRead({ landing, now: () => READ_AT }, { answer, bookingId: 'hSq2gVDrf', payload: object, parse: parseHotelBookingState, userId: 'u_alex', guestRef: null });
  assert.equal(first.outcome, 'landed');
  assert.equal(first.theirId, bookingReadTheirId('hSq2gVDrf'));
  assert.equal(first.parsed.hotelConfirmationCode, 'HCC-4421', 'parsed FROM the arrival');
  assert.equal(landing.responses.length, 1);
  assert.equal(landing.responses[0].resource, BOOKING_READ);
  assert.ok(landing.responses[0].body.equals(answer.body), 'the bytes as received');
  assert.equal(landing.rowsOf(BOOKING_READ).length, 1);
  assert.equal(landing.rowsOf(BOOKING_READ)[0].read?.toISOString(), READ_AT.toISOString());
  const second = await landLiteApiBookingRead({ landing, now: () => READ_AT }, { answer, bookingId: 'hSq2gVDrf', payload: object, parse: parseHotelBookingState, userId: 'u_alex', guestRef: null });
  assert.equal(second.outcome, 'already_landed');
  assert.equal(second.read, false, 'not marked read twice');
  assert.equal(landing.responses.length, 2, 'every answer is on record');
  assert.equal(landing.rowsOf(BOOKING_READ).length, 1, 'one snapshot of the same state');
  const changed = await landLiteApiBookingRead({ landing, now: () => READ_AT }, { answer, bookingId: 'hSq2gVDrf', payload: { ...object, status: 'CANCELED' }, parse: parseHotelBookingState, userId: 'u_alex', guestRef: null });
  assert.equal(changed.outcome, 'corrected', 'a changed state is a new snapshot');
});

test('a webhook delivery lands its bytes BEFORE any parse, then one event arrival (their_id = event_id); the same delivery again is already_landed', async () => {
  const landing = new FakeLanding();
  const body = Buffer.from('{"event_id":"evt_1","event_name":"booking.book","request":"{}","response":"{\\"data\\":{\\"bookingId\\":\\"hSq2gVDrf\\",\\"status\\":\\"CANCELLED\\"}}","sandbox":false}', 'utf8');
  const { responseId } = await landLiteApiWebhookBytes({ landing }, { body, receivedAt: READ_AT });
  assert.equal(landing.responses.length, 1);
  assert.equal(landing.responses[0].resource, WEBHOOK);
  assert.equal(landing.responses[0].guest_ref, webhookGuestRef(null));
  assert.ok(landing.responses[0].body.equals(body));
  assert.equal(landing.arrivals.size, 0, 'no arrival yet — the bytes land first');
  const delivery = parseLiteApiWebhookDelivery(body);
  assert.ok(delivery.ok);
  if (!delivery.ok) return;
  const ev = await landLiteApiWebhookEvent({ landing, now: () => READ_AT }, { responseId, receivedAt: READ_AT, eventId: delivery.eventId, payload: delivery.payload });
  assert.equal(ev.outcome, 'landed');
  const rows = landing.rowsOf(WEBHOOK);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].row.their_id, 'evt_1');
  assert.equal(rows[0].row.guest_ref, webhookGuestRef('evt_1'));
  const again = await landLiteApiWebhookEvent({ landing, now: () => READ_AT }, { responseId, receivedAt: READ_AT, eventId: delivery.eventId, payload: delivery.payload });
  assert.equal(again.outcome, 'already_landed');
});

// ── the webhook, read as a hint ─────────────────────────────────────────────

test('the delivery parser and the booking-id resolver read the id and nothing else; the token compares in constant time', () => {
  assert.deepEqual(parseLiteApiWebhookDelivery(Buffer.from('not json')), { ok: false, error: 'not_json' });
  assert.deepEqual(parseLiteApiWebhookDelivery(Buffer.from('[1]')), { ok: false, error: 'not_an_object' });
  assert.deepEqual(parseLiteApiWebhookDelivery(Buffer.from('{"event_name":"booking.book"}')), { ok: false, error: 'event_id_missing' });
  const d = parseLiteApiWebhookDelivery(Buffer.from(JSON.stringify({ event_id: 'evt_1', event_name: 'booking.cancel', response: JSON.stringify({ data: { bookingId: 'hSq2gVDrf', status: 'CANCELLED' } }) })));
  assert.ok(d.ok && d.eventId === 'evt_1' && d.eventName === 'booking.cancel');
  if (!d.ok) return;
  assert.equal(resolveWebhookBookingId(d.eventName, d.response), 'hSq2gVDrf', 'a hotel event: data.bookingId');
  assert.equal(resolveWebhookBookingId('booking.book', { bookingId: 'flat' }), 'flat', 'or flat at the root');
  assert.equal(resolveWebhookBookingId('flight.book.confirmed', { data: [{ booking: { bookingId: 'fb_9Q', status: 'CANCELLED' } }] }), 'fb_9Q', 'a flight event: data[0].booking.bookingId');
  assert.equal(resolveWebhookBookingId('flight.book.confirmed', { data: [{ booking: { bookingId: 'fb_9Q' } }] }), 'fb_9Q');
  assert.equal(resolveWebhookBookingId('booking.book', null), null);
  assert.equal(resolveWebhookBookingId('something.else', { data: { bookingId: 'x' } }), null, 'an undocumented event resolves nothing');
  assert.equal(resolveWebhookBookingId('booking.prebook', { data: { prebookId: 'p1' } }), null, 'a prebook event names no booking');
  const objectResponse = parseLiteApiWebhookDelivery(Buffer.from(JSON.stringify({ event_id: 'evt_2', event_name: 'booking.book', response: { data: { bookingId: 'h2' } } })));
  assert.ok(objectResponse.ok && resolveWebhookBookingId(objectResponse.eventName, objectResponse.response) === 'h2', 'an object response is taken as is');
  assert.equal(laneOfWebhookEvent('booking.book.hotelConfirmationNumber'), 'hotel');
  assert.equal(laneOfWebhookEvent('flight.book.expired'), 'flight');
  assert.equal(laneOfWebhookEvent('payment.captured'), null);
  assert.equal(LITEAPI_HOTEL_EVENTS.length, 14);
  assert.equal(LITEAPI_FLIGHT_EVENTS.length, 8);
  assert.equal(constantTimeEqual('tok', 'tok'), true);
  assert.equal(constantTimeEqual('tok', 'tokk'), false, 'a different length is not equal');
  assert.equal(constantTimeEqual('Bearer tok', 'tok'), false, 'no prefix match');
  assert.equal(constantTimeEqual('TOK', 'tok'), false, 'no case folding');
  assert.equal(constantTimeEqual('', ''), true);
  const leaf = code(WEBHOOK_LEAF);
  assert.match(leaf, /timingSafeEqual\(a, b\)/);
  assert.ok(!/startsWith|includes\(given|toLowerCase/.test(leaf.slice(leaf.indexOf('export function constantTimeEqual'), leaf.indexOf('export type ParsedDelivery'))), 'no loose compare');
});

test('the receiver: rate limit → token (500 unconfigured, 401 wrong, nothing landed) → bytes → envelope → duplicate → unknown → the GET; a payload field is never applied', () => {
  const r = code(WEBHOOK_ROUTE);
  const at = (needle: string) => { const i = r.indexOf(needle); assert.ok(i >= 0, `route lacks ${needle}`); return i; };
  const order = [
    "rateLimit(`liteapi-webhook:${ip}`",
    'process.env.LITEAPI_WEBHOOK_TOKEN',
    "{ error: 'Webhook not configured' }, { status: 500 }",
    'constantTimeEqual(given, expected)',
    "{ error: 'Unauthorized' }, { status: 401 }",
    'request.arrayBuffer()',
    'landLiteApiWebhookBytes(',
    'parseLiteApiWebhookDelivery(body)',
    'status: 400',
    'landLiteApiWebhookEvent(',
    "outcome: { not: 'duplicate' }",
    "record('duplicate', null)",
    "laneOfWebhookEvent(eventName) === null",
    "record('unknown_event', null)",
    "prisma.reservations.findFirst({ where: { provider: 'liteapi', providerBookingId: bookingId }, select: VENDOR_READ_SELECT })",
    "record('unknown_booking', null)",
    "readAndApplyReservation(row, { source: 'webhook' })",
    "record('read_failed', null)",
    'record(read.outcome, new Date())',
  ];
  let last = -1;
  for (const needle of order) { const i = at(needle); assert.ok(i > last, `${needle} must come after the step before it`); last = i; }
  // Nothing lands before the token passes: no landing call, no arrayBuffer, before the 401.
  const before401 = r.slice(at('export async function POST('), at("{ error: 'Unauthorized' }, { status: 401 }"));
  assert.ok(!/arrayBuffer|landLiteApi|prisma\./.test(before401), 'the 500 and the 401 land nothing and touch no table');
  // The 401 log names the header's shape, never its value.
  assert.match(r, /authorization: given === null \? 'absent' : `present, \$\{given\.length\} chars/);
  assert.ok(!/console\.(error|log)\([^)]*\bgiven\b[^)]*\)/.test(r.replace(/given === null \? 'absent' : `present, \$\{given\.length\} chars\$\{\/\^Bearer \/i\.test\(given\) \? ', Bearer-prefixed' : ''\}`/g, '')), 'the token value is never logged');
  // A WEBHOOK IS A HINT: the delivery's response is read ONLY to resolve the booking id; nothing else of it is read; the route calls no vendor and writes no reservation.
  const responseUses = r.match(/delivery\.response/g) ?? [];
  assert.equal(responseUses.length, 1);
  assert.match(r, /resolveWebhookBookingId\(eventName, delivery\.response\)/);
  const payloadUses = r.match(/delivery\.payload/g) ?? [];
  assert.equal(payloadUses.length, 1, 'the payload is landed, not read');
  assert.ok(!/getHotelBooking|getFlightBooking|reservations\.update|status: '(pending|confirmed|cancelled|failed)'|'CANCELLED'|'CONFIRMED'/.test(r), 'no vendor call and no status write in the receiver — the read leaf owns both');
  assert.ok(!/delivery\.(response|payload)\.[a-zA-Z]*[sS]tatus|\.status\b(?!\s*:)/.test(r.replace(/read\.outcome|out\.outcome|acted\.outcome|data\.outcome/g, '')), 'no status is read off the delivery');
  // Every outcome after the bytes is one row pointing at the arrival; the partial unique is honoured by name.
  assert.match(r, /err instanceof Prisma\.PrismaClientKnownRequestError && err\.code === 'P2002'/);
  assert.match(r, /outcome: 'duplicate' \}/);
  assert.match(code('src/middleware.ts'), /'\/api\/webhooks\/liteapi',/, 'public: the vendor holds no session');
  assert.match(r, /export const dynamic = 'force-dynamic';/);
});

test('a forged status in a delivery changes nothing: the apply sees only what the GET stated', async () => {
  // The delivery says CANCELLED; the vendor's GET (the truth) says CONFIRMED with the code — the row stays confirmed.
  const forged = parseLiteApiWebhookDelivery(Buffer.from(JSON.stringify({ event_id: 'evt_forged', event_name: 'booking.cancel', response: JSON.stringify({ data: { bookingId: 'hSq2gVDrf', status: 'CANCELLED' } }) })));
  assert.ok(forged.ok);
  if (!forged.ok) return;
  const id = resolveWebhookBookingId(forged.eventName, forged.response);
  assert.equal(id, 'hSq2gVDrf', 'the id, and only the id, leaves the delivery');
  const f = fakeApplyPorts();
  const truth = parseHotelBookingState({ bookingId: id as string, status: 'CONFIRMED', hotelConfirmationCode: null });
  const out = await applyVendorState(f.ports, HOTEL_ROW, { lane: 'hotel', bookingId: truth.bookingId, status: truth.status, hotelConfirmationCode: truth.hotelConfirmationCode, readAt: READ_AT });
  assert.equal(out.status, 'unchanged');
  assert.equal(out.statusValue, 'confirmed');
  assert.deepEqual(f.writes[0].patch, { lastVendorReadAt: READ_AT });
  assert.equal(f.marked.length, 0);
  // And when the GET says so, it lands.
  const g = fakeApplyPorts();
  const gone = await applyVendorState(g.ports, HOTEL_ROW, { lane: 'hotel', bookingId: 'hSq2gVDrf', status: 'CANCELED', hotelConfirmationCode: null, readAt: READ_AT });
  assert.equal(gone.statusValue, 'cancelled');
});

// ── the read leaf, the cron, the retro ──────────────────────────────────────

test('the read leaf: the cap, then the GET by lane, then ONE transaction landing and applying, then the emails after the commit; a GET that throws is read_failed with the row untouched', () => {
  const r = code(READ_LEAF);
  const at = (needle: string) => { const i = r.indexOf(needle); assert.ok(i >= 0, `read leaf lacks ${needle}`); return i; };
  assert.ok(at("reserveTravelSearch('liteapi')") < at("lane === 'hotel' ? await getHotelBooking(row.providerBookingId) : await getFlightBooking(row.providerBookingId)"), 'metered before the vendor');
  const getCatch = r.slice(at('await getFlightBooking(row.providerBookingId);'), at('const readAt = read.answer.arrived;'));
  assert.match(getCatch, /return \{ outcome: 'read_failed', kind: 'vendor', reason: `\$\{tag\}: GET of \$\{lane\} booking \$\{row\.providerBookingId\} failed/, 'a GET that throws: read_failed, named');
  assert.ok(!/writeReservation|reservations\.update|applyVendorState/.test(r.slice(at('export async function readAndApplyReservation('), at('const readAt = read.answer.arrived;'))), 'nothing is written before the answer is in hand');
  assert.ok(at('prisma.$transaction(async (tx) => {') < at('landLiteApiBookingRead(landing, { answer: read.answer, bookingId: row.providerBookingId, payload: read.object, parse: parseHotelBookingState'), 'the landing is inside the transaction');
  assert.match(r, /calendar: prismaBookingCalendar\(tx\),/);
  assert.match(r, /cancelCommission: async \(reservationId\) => \(await tx\.commission_ledger\.updateMany\(\{ where: \{ reservationId, status: 'estimated' \}, data: \{ status: 'cancelled' \} \}\)\)\.count,/, 'the commission moves exactly as the cancel route moves it');
  assert.ok(at('for (const request of applied.emails) emails.push(await sendLifecycleEmail(emailRow, request));') > at('prisma.$transaction(async (tx) => {'), 'emails after the commit');
  assert.match(r, /if \(!opts\.dryRun\) \{\s*const emailRow/, 'never on a dry run');
  assert.match(r, /const readAt = read\.answer\.arrived;/, 'lastVendorReadAt is the answer instant');
  assert.match(r, /parse: parseFlightBookingDetails/);
  assert.match(r, /refreshFlightReservation\(\{ \.\.\.ports, fetchBooking: async \(\) => \(\{ \.\.\.parsed, readAt \}\) \}, row\)/, 'a flight goes through LANE-01 refresh, which hands the status to the apply leaf');
  assert.ok(!/new Date\(\)/.test(r), 'the read leaf reads no clock');
  assert.ok(!/\?\? '(pending|confirmed|cancelled|failed)'/.test(r));
});

test('the cron: Bearer CRON_SECRET (500 unconfigured, 401 wrong), the non-final selection, oldest read first, a named batch bound, per-row outcomes; registered hourly', () => {
  const r = code(CRON_ROUTE);
  assert.match(r, /if \(!cronSecret\) \{\s*console\.error\('CRON_SECRET not configured'\);\s*return NextResponse\.json\(\s*\{ error: 'Cron not configured' \},\s*\{ status: 500 \}/, 'the auto-categorize pattern, exactly');
  assert.match(r, /if \(authHeader !== `Bearer \$\{cronSecret\}`\) \{\s*console\.error\('Unauthorized cron attempt'\);\s*return NextResponse\.json\(\s*\{ error: 'Unauthorized' \},\s*\{ status: 401 \}/);
  assert.ok(r.indexOf("{ status: 401 }") < r.indexOf('prisma.reservations.findMany'), 'refused before any query');
  assert.match(r, /\nconst BATCH = 20;/, 'the bound is named (a route file may export only its handlers)');
  assert.match(comments(CRON_ROUTE), /20 × 24 hourly runs\s*\n?\s*\*?\s*= 480 reads\/day/, 'and why');
  assert.match(r, /take: BATCH,/);
  assert.match(r, /provider: 'liteapi',/);
  assert.match(r, /\{ status: \{ in: \['pending', 'cancel_pending'\] \} \},/);
  assert.match(r, /\{ lane: 'flight', status: 'confirmed', ticketedAt: null \},/);
  assert.match(r, /\{ lane: 'hotel', status: 'confirmed', providerConfirmationCode: null \},/);
  assert.match(r, /orderBy: \[\{ lastVendorReadAt: \{ sort: 'asc', nulls: 'first' \} \}, \{ createdAt: 'asc' \}\],/);
  assert.match(r, /readAndApplyReservation\(row, \{ source: 'cron' \}\)/);
  assert.match(r, /if \(out\.kind === 'quota'\) \{ stopped = out\.reason; break; \}/, 'a cap refusal stops the batch by name');
  assert.match(r, /return NextResponse\.json\(\{ \.\.\.summary, rows: perRow \}\);/, 'per-row outcomes in the body');
  assert.match(r, /console\.log\(`\[CRON reservations-refresh\] \$\{rows\.length\} selected/, 'one log line');
  assert.match(r, /export async function GET\(request: NextRequest\) \{ return run\(request\); \}/, 'Vercel invokes a cron by GET');
  const vercel = JSON.parse(code('vercel.json')) as { crons: Array<{ path: string; schedule: string }> };
  assert.deepEqual(vercel.crons.find((c) => c.path === '/api/cron/reservations-refresh'), { path: '/api/cron/reservations-refresh', schedule: '0 * * * *' }, 'hourly');
});

test('the retro runs the one read leaf over every reservation, rehearses with --dry-run, and grows no implementation of its own', () => {
  const r = code(RETRO);
  assert.match(r, /readAndApplyReservation\(row, \{ source: 'retro', dryRun/);
  assert.match(r, /select: VENDOR_READ_SELECT,/);
  assert.ok(!/where:/.test(r.slice(r.indexOf('prisma.reservations.findMany'), r.indexOf('select: VENDOR_READ_SELECT'))), 'EVERY reservation');
  assert.match(r, /--dry-run/);
  assert.match(r, /if \(out\.kind === 'quota'\)/);
  assert.ok(!/getHotelBooking|getFlightBooking|applyVendorState|reservations\.update/.test(r), 'no implementation of its own');
  assert.match(r, /process\.exit\(2\)/, 'refuses to run without DATABASE_URL');
});

test('the sender: the one attempt, a failed send to audit_log by name, no retry; the flights book route attempts the emails the refresh owes after its own block', () => {
  const s = code(SENDER);
  assert.match(s, /description: `lifecycle_email_failed — \$\{request\.kind\} for reservation \$\{row\.id\}: \$\{errorClass\}`/);
  assert.match(s, /type: 'system_automation'/);
  assert.match(s, /cancelRecipient\(row, await accountEmailOf\(row\)\)/, 'the CANCEL-02 recipient rule');
  assert.ok(!/setTimeout|for \(let attempt|retries|while \(/.test(s), 'no automatic retry');
  assert.ok(!/accountEmail \?\? |guestEmail \?\? |\?\? accountEmail|\?\? row\.guestEmail/.test(s), 'no fallback address');
  const fb = code(FLIGHT_BOOK);
  assert.ok(fb.indexOf('for (const request of refreshed.emails)') > fb.indexOf('catch (calErr)'), 'after the refresh block');
  assert.match(fb, /cancelCommission: async \(reservationId\) => \(await prisma\.commission_ledger\.updateMany/);
  assert.match(fb, /return \{ \.\.\.read\.details, readAt: read\.answer\.arrived \};/);
  const retro = code('scripts/lane-01-retro-flights.ts');
  assert.match(retro, /for \(const request of outcome\.emails\)/, 'the LANE-01 retro also makes the one attempt its writes owe');
  assert.match(retro, /if \(dryRun\) \{ console\.log\(`    would email: \$\{request\.kind\}`\); continue; \}/);
});

// ── the columns, the table, the pins ────────────────────────────────────────

test('the migration adds the five nullable columns with no default and the webhook_events table with its CHECK, its partial unique dedupe and its RESTRICT foreign key; nothing is backfilled', () => {
  const sql = code(MIGRATION);
  for (const col of ['ticketedAt', 'ticketLimitTime', 'lastVendorReadAt', 'ticketedEmailSentAt', 'confirmationEmailSentAt']) {
    assert.ok(sql.includes(`ALTER TABLE "reservations" ADD COLUMN "${col}" TIMESTAMPTZ(6);`), col);
    assert.match(code('prisma/schema.prisma'), new RegExp(`\\n  ${col}\\s+DateTime\\? @db\\.Timestamptz\\(6\\)\\n`), `${col} in the schema, nullable, no default`);
  }
  assert.match(sql, /CREATE TABLE "webhook_events"/);
  assert.ok(sql.includes(`CHECK ("outcome" IN ('applied', 'unchanged', 'unknown_booking', 'unknown_event', 'duplicate', 'read_failed'))`));
  assert.ok(sql.includes(`CREATE UNIQUE INDEX "webhook_events_eventId_acted_key" ON "webhook_events"("eventId") WHERE "outcome" <> 'duplicate';`));
  assert.ok(sql.includes('"arrivalId"  TEXT           NOT NULL,'));
  assert.ok(sql.includes('FOREIGN KEY ("arrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT'));
  assert.ok(!/^\s*UPDATE\b/im.test(sql), 'no backfill');
  assert.ok(!/DEFAULT/.test(sql.replace('DEFAULT gen_random_uuid()', '')), 'no default on a stated field');
  const model = code('prisma/schema.prisma');
  const at = model.indexOf('\nmodel webhook_events {');
  const block = model.slice(at, model.indexOf('\n}', at));
  assert.match(block, /arrival arrivals @relation\(fields: \[arrivalId\], references: \[id\], onDelete: Restrict/);
  assert.match(block, /bookingId\s+String\?/);
  assert.match(block, /actedAt\s+DateTime\?/);
});

test('no default status word anywhere in src; the two lane leaves are the only files that turn a vendor status word into ours', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '__tests__') walk(p); }
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk('src');
  assert.ok(files.length > 100);
  const defaulted = files.filter((f) => /\?\? 'CONFIRMED'|\|\| 'CONFIRMED'|\?\? 'pending'|\?\? 'confirmed'/.test(code(f)));
  assert.deepEqual(defaulted, [], 'no `?? CONFIRMED`, `|| CONFIRMED`, `?? pending` in src');
  // A vendor word compared and turned into one of our four words — only the two leaves.
  const OUR = /return '(pending|confirmed|cancelled|failed)'/;
  const VENDOR = /=== '(CONFIRMED|CANCELED|CANCELLED|CANCELLED_WITH_CHARGES|TICKETED|CREATED|PENDING_CONFIRMATION|PENDING|FAILED|EXPIRED)'/;
  const mappers = files.filter((f) => { const c = code(f); return VENDOR.test(c) && OUR.test(c); }).sort();
  assert.deepEqual(mappers, [HOTEL_LEAF, FLIGHT_LEAF].sort());
  for (const f of [HOTEL_BOOK, FLIGHT_BOOK, REFRESH, APPLY, READ_LEAF, WEBHOOK_ROUTE, CRON_ROUTE, 'src/app/api/reservations/[id]/cancel/route.ts']) {
    assert.ok(!VENDOR.test(code(f)), `${f} compares no vendor status word`);
  }
});

test('applyVendorState is the only writer of the five columns', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '__tests__') walk(p); }
      else if (/\.tsx?$/.test(name)) files.push(p);
    }
  };
  walk('src');
  walk('scripts');
  // The seeds put a second writer back on purpose (status01-i); they are not callers.
  const writers = files.filter((f) => f !== APPLY && !f.startsWith('scripts/proofs/') && /patch\.(ticketedAt|ticketLimitTime|lastVendorReadAt|ticketedEmailSentAt|confirmationEmailSentAt) =|(ticketedAt|ticketLimitTime|lastVendorReadAt|ticketedEmailSentAt|confirmationEmailSentAt): (new Date|vendor\.|readAt|at\b)/.test(code(f)));
  assert.deepEqual(writers, [], 'nothing but the apply leaf assigns them');
});
