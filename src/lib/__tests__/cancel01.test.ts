/**
 * CANCEL-01 (2026-09-26) — a cancel goes to the right endpoint, shows the quote
 * first, and keeps the money facts.
 *
 * COMMIT 1 — THE GUARD. The cancel route reads the lane and refuses anything but
 * a hotel BY NAME before any vendor call; both lists offer Cancel on the hotel
 * lane only. The route cannot be executed here (a database and a vendor), so its
 * contract is read from source through the reader, the way this repo proves a
 * route it cannot run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';

const ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
const LISTS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx'];

test('COMMIT 1, as it stands after COMMIT 3: the lane is READ, and a lane with no cancel is refused by name before any vendor call', () => {
  const src = code(ROUTE);
  // The lane is READ off the row the auth chain scoped.
  assert.match(src, /select: \{ id: true, status: true, provider: true, providerBookingId: true, lane: true \}/, 'the lane is selected');
  // COMMIT 1 refused every non-hotel lane here; COMMIT 3 gave the flight lane its own
  // endpoint. What stands: an activity (any lane without a cancel) is refused BY NAME
  // in the dispatch, before either lane function — and so before any vendor call.
  const post = src.slice(src.indexOf('export async function POST('), src.indexOf('async function markCalendar('));
  const named = post.indexOf("code: 'cancel_lane_unsupported'");
  const statusGate = post.indexOf('const refused = statusRefusal(owned);');
  assert.ok(named > 0 && statusGate > 0 && statusGate < named, 'named, after the ownership and status gates');
  assert.match(post.slice(named - 400, named + 120), /\{ status: 409 \}/, 'a 409, not a 404 that would deny the row');
  assert.ok(!post.includes('cancelBooking('), 'the dispatch itself calls no vendor');
  assert.ok(!post.includes('cancelFlightBooking('), 'the dispatch itself calls no vendor');
  // A flight is no longer refused: it is sent to its OWN endpoint (COMMIT 3), never the hotel one.
  assert.match(post, /if \(owned\.lane === 'flight'\) return cancelFlight\(owned, userId\);/);
  // The hotel client is imported for the hotel lane only; the header tells the truth.
  assert.match(src, /import \{ cancelBooking, parseCancelResult, type CancelBookingResult \} from '@\/lib\/liteapiClient';/, 'the hotel client');
  const head = comments(ROUTE);
  assert.match(head, /hotel  → PUT \/v3\.0\/bookings\/\{id\}/, 'the header names the hotel endpoint for the hotel lane');
  assert.match(head, /flight → POST \/flights\/bookings\/\{id\}\/cancellations/, 'and the flight endpoint for the flight lane');
  assert.ok(!/provider 'liteapi' \(hotels and flights\)/.test(head), 'and no longer claims one endpoint serves both');
});

test('COMMIT 1, as it stands after COMMIT 3: both lists gate Cancel on the lane through the one reader — never on the provider', () => {
  for (const f of LISTS) {
    const src = code(f);
    assert.ok(!src.includes("r.provider === 'liteapi' && r.status === 'confirmed'"), `${f}: the provider gate is gone — LiteAPI is both rails`);
    assert.match(src, /r\.type === 'hotel' \|\| r\.type === 'flight'/, `${f}: the lane word decides`);
    // `type` is the lane word from reservationIdentity — the lists never read .lane raw.
    assert.ok(!/\.lane\b/.test(src), `${f}: no raw lane read`);
  }
});

// ── COMMIT 2 — THE MONEY-EVENTS TABLE (the migration, read; it applies at deploy) ──

const MIGRATION = 'prisma/migrations/20260926090000_cancel_01_money_events/migration.sql';

test('COMMIT 2: money_events — a money fact cannot exist without its arrival (NOT NULL + FK), no default on any stated field, RESTRICT on the reservation', () => {
  const sql = code(MIGRATION);
  const table = sql.slice(sql.indexOf('CREATE TABLE "money_events"'), sql.indexOf('CREATE TABLE "vouchers"'));
  assert.match(table, /"arrivalId"\s+TEXT\s+NOT NULL,/, 'arrivalId NOT NULL');
  assert.match(table, /FOREIGN KEY \("arrivalId"\) REFERENCES "arrivals"\("id"\) ON DELETE RESTRICT/, 'and a foreign key to arrivals');
  assert.match(table, /FOREIGN KEY \("reservationId"\) REFERENCES "reservations"\("id"\) ON DELETE RESTRICT/, 'the reservation is RESTRICT');
  assert.match(table, /"amountCents"\s+INTEGER,/, 'amountCents nullable, no default');
  for (const stated of ['reservationId', 'lane', 'kind', 'amountCents', 'currency', 'refundDestination', 'status', 'vendorReference', 'arrivalId', 'statedAt']) {
    const line = table.split('\n').find((l) => l.includes(`"${stated}"`) && !l.includes('CONSTRAINT') && !l.includes('INDEX') && !l.includes('FOREIGN'))!;
    assert.ok(line && !/DEFAULT/i.test(line), `${stated}: no default`);
  }
  assert.match(table, /CHECK \("kind" IN \('charge', 'refund', 'cancellation_fee', 'change_fee', 'servicing_fee', 'ticketing_fee', 'voucher_issued'\)\)/);
  assert.match(table, /CHECK \("status" IN \('stated', 'settled'\)\)/);
  assert.match(table, /CHECK \("refundDestination" IS NULL OR "refundDestination" IN \('original_payment', 'agency_deposit', 'voucher', 'bsp_settlement', 'manual', 'unknown'\)\)/, 'the vendor enum, verbatim');
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im, 'nothing backfilled');
  // The schema moves with it.
  const schema = code('prisma/schema.prisma');
  assert.match(schema, /\nmodel money_events \{/);
  assert.match(schema, /\n  arrivalId\s+String\n/, 'arrivalId is required in the model');
  assert.match(schema, /\n  amountCents\s+Int\?\n/, 'amountCents nullable in the model');
  assert.match(schema, /\n  cancelIntentAt\s+DateTime\? @db\.Timestamptz\(6\)/, 'reservations.cancelIntentAt');
});

test('COMMIT 2: vouchers — a table, queryable by expiry; passengerNames NULL when not stated', () => {
  const sql = code(MIGRATION);
  const table = sql.slice(sql.indexOf('CREATE TABLE "vouchers"'));
  assert.match(table, /"expiresAt"\s+DATE,/);
  assert.match(table, /CREATE INDEX "vouchers_expiresAt_idx" ON "vouchers"\("expiresAt"\)/, 'expiry is indexed — the reason it is a table');
  assert.match(table, /"passengerNames"\s+JSONB,/, 'NULL when not stated, never a fabricated []');
  assert.match(table, /"arrivalId"\s+TEXT\s+NOT NULL,/);
  assert.match(table, /FOREIGN KEY \("arrivalId"\) REFERENCES "arrivals"\("id"\) ON DELETE RESTRICT/);
  assert.match(sql, /ALTER TABLE "reservations" ADD COLUMN "cancelIntentAt" TIMESTAMPTZ\(6\);/);
  // The status vocabularies were VERIFIED unconstrained, and the migration says so.
  assert.match(comments(MIGRATION), /reservations\.status has NO CHECK constraint/);
  // The reader keeps the SQL comment markers, so a line break inside the sentence reads `\n--    `.
  assert.match(comments(MIGRATION), /commission_ledger\.status has NO[\s-]+CHECK/);
});

// ── COMMIT 3 — FLIGHT CANCEL PROPER ─────────────────────────────────────────
// Every vendor answer below is a fixture shaped EXACTLY by the two doc pages
// (get_ / post_flights-bookings-bookingid-cancellations) and the hotel PUT page.
// No live call: the pure leaves are driven directly; the landing runs over the
// shared fake store; the route and the dialog are read from source.

import {
  flightCancellationObjectOf, flightCancellationQuoteObjectOf, parseFlightCancellationQuote, parseFlightCancellationResult,
  parseFlightBookingDetails, LiteApiFlightsApiError,
} from '../liteapiFlightsClient';
import { parseCancelResult } from '../liteapiClient';
import { centsOf, flightCancelDecision, hotelCancelMoneyEvents } from '../reservations/cancellation';
import { confidenceWords, destinationWords, moneyWords } from '../reservations/cancellationWords';
import { landLiteApiCancellation, type LiteApiAnswer } from '../arrivals/liteapiBooking';
import { FakeLanding } from './fakeLanding';
import { CANCELLED_TITLE_PREFIX, markBookingCalendarCancelled, type BookingCalendarCancelPort } from '../calendar/bookingEvent';
import { refreshFlightReservation, type FlightBookingStated, type FlightRefreshPorts } from '../reservations/refreshFlightReservation';
import { BOOKING_CALENDAR_SOURCE } from '../calendar/bookingEvent';

const DIALOG = 'src/components/trips/CancelBookingDialog.tsx';
const FCLIENT = 'src/lib/liteapiFlightsClient.ts';
const LEAF = 'src/lib/reservations/cancellation.ts';

/** GET .../cancellations — the quote, as documented: data[] of one. */
const QUOTE_ANSWER = {
  data: [{
    confidence: 'estimated', timestamp: '2026-09-26T09:00:00Z', isRefundable: true, isVoidable: false,
    refund: { display: { amount: 380.5, currency: 'USD' } },
    penalty: { display: { amount: 51.6, currency: 'USD' } },
    penalties: [
      { type: 'cancellation_fee', description: 'Airline cancellation fee', pricing: { display: { amount: 50, currency: 'USD' } } },
      { type: 'transaction_fee', description: null, pricing: { display: { amount: 1.6, currency: 'USD' } } },
    ],
    currency: 'USD', destination: 'original_payment', vouchers: null, pnr: 'PNR123', expiresAt: '2026-09-26T10:00:00Z',
  }],
};

/** POST .../cancellations — 200, final, with charges. */
const FINAL_ANSWER = { data: { bookingId: 'fb_9Q', status: 'CANCELLED_WITH_CHARGES', cancellation_fee: 51.6, refund_amount: 380.5, currency: 'USD', destination: 'original_payment', vouchers: null } };
/** POST .../cancellations — 200, final, refund as a voucher. */
const VOUCHER_ANSWER = {
  data: {
    bookingId: 'fb_9Q', status: 'CANCELLED', cancellation_fee: 0, refund_amount: 380.5, currency: 'USD', destination: 'voucher',
    vouchers: [{ voucherId: 'v_1', code: 'VJ-CREDIT-1', airline: 'VZ', pricing: { display: { amount: 380.5, currency: 'THB' } }, validFrom: '2026-09-26', expiresAt: '2027-09-25', passengerNames: ['Ada Lovelace'], notes: 'non-transferable' }],
  },
};
/** POST .../cancellations — 202, accepted, awaiting the airline: status stays CONFIRMED. */
const PENDING_ANSWER = { data: { bookingId: 'fb_9Q', status: 'CONFIRMED', cancellation_fee: 51.6, refund_amount: 380.5, currency: 'USD', destination: null, vouchers: null } };
/** POST .../cancellations — 200 with NO amounts stated. */
const SILENT_ANSWER = { data: { bookingId: 'fb_9Q', status: 'CANCELLED', currency: 'USD' } };
/** PUT /bookings/{id} — the hotel cancel as documented. */
const HOTEL_ANSWER = { data: { bookingId: 'hSq2gVDrf', status: 'CANCELLED_WITH_CHARGES', currency: 'USD', cancellation_fee: 25, refund_amount: 125, sandbox: true } };

const ARRIVED = new Date('2026-09-26T09:05:00Z');
const EV = { reservationId: 'res_f1', arrivalId: 'arr_1', statedAt: ARRIVED };
const answerOf = (json: unknown, httpStatus = 200): LiteApiAnswer => {
  const text = JSON.stringify(json, null, 1);
  return { httpStatus, body: Buffer.from(text, 'utf8'), asked: new Date('2026-09-26T09:04:58Z'), arrived: ARRIVED, json: JSON.parse(text) };
};

test('the QUOTE parses field-for-field from the documented shape, and a 2xx without data[0].confidence is a contract deviation', () => {
  const q = parseFlightCancellationQuote(flightCancellationQuoteObjectOf(QUOTE_ANSWER));
  assert.equal(q.confidence, 'estimated');
  assert.deepEqual(q.refund, { amount: 380.5, currency: 'USD' });
  assert.deepEqual(q.penalty, { amount: 51.6, currency: 'USD' });
  assert.equal(q.penalties.length, 2);
  assert.deepEqual(q.penalties[1], { type: 'transaction_fee', description: null, amount: { amount: 1.6, currency: 'USD' } });
  assert.equal(q.destination, 'original_payment');
  assert.deepEqual(q.vouchers, []);
  assert.equal(q.isRefundable, true);
  assert.equal(q.isVoidable, false);
  assert.equal(q.pnr, 'PNR123');
  // Absence is null, never a number.
  const bare = parseFlightCancellationQuote({ confidence: 'unknown' });
  assert.equal(bare.refund, null);
  assert.equal(bare.penalty, null);
  assert.equal(bare.destination, null);
  assert.equal(bare.currency, null);
  // The flights client carries the deviation in providerMessage (its own idiom, liteapiFlightsClient.ts flightBookingObjectOf).
  const deviation = (e: unknown) => e instanceof LiteApiFlightsApiError && /contract deviation/.test(e.providerMessage ?? '');
  assert.throws(() => flightCancellationQuoteObjectOf({ data: [] }), deviation);
  assert.throws(() => flightCancellationQuoteObjectOf({ data: { confidence: 'confirmed' } }), deviation, 'the quote is data[], not a data object');
});

test('the vendor words are rendered as what they MEAN — estimated is not confirmed, an agency deposit is not a card', () => {
  assert.match(confidenceWords('estimated'), /not confirmed/);
  assert.match(confidenceWords('confirmed'), /Confirmed by the airline/);
  assert.match(confidenceWords('heuristic'), /not confirmed/);
  assert.match(confidenceWords('unknown'), /did not state/);
  assert.match(confidenceWords('something_new'), /does not translate/, 'an unknown word is shown, never mapped to a friendlier one');
  assert.match(destinationWords('original_payment'), /card you paid with/);
  assert.match(destinationWords('agency_deposit'), /not to your card/);
  assert.match(destinationWords('voucher'), /not cash/);
  assert.match(destinationWords('bsp_settlement'), /not directly to your card/);
  assert.equal(destinationWords(null), 'not stated');
  assert.equal(moneyWords(null, 'USD'), 'not stated by the airline');
  assert.equal(moneyWords(380.5, 'USD'), 'USD 380.50');
});

test('action 200 CANCELLED_WITH_CHARGES → status cancelled; money_events rows match the answer field-for-field, each with the arrivalId; commission moves', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(FINAL_ANSWER));
  const d = flightCancelDecision(parsed, 200, EV);
  assert.equal(d.status, 'cancelled');
  assert.equal(d.final, true);
  assert.equal(d.commission, 'cancel');
  assert.deepEqual(d.moneyEvents, [
    { reservationId: 'res_f1', lane: 'flight', kind: 'refund', amountCents: 38050, currency: 'USD', refundDestination: 'original_payment', status: 'stated', vendorReference: 'fb_9Q', arrivalId: 'arr_1', statedAt: ARRIVED },
    { reservationId: 'res_f1', lane: 'flight', kind: 'cancellation_fee', amountCents: 5160, currency: 'USD', refundDestination: null, status: 'stated', vendorReference: 'fb_9Q', arrivalId: 'arr_1', statedAt: ARRIVED },
  ]);
  assert.deepEqual(d.vouchers, []);
  for (const row of d.moneyEvents) assert.equal(row.arrivalId, 'arr_1', 'no money fact without its evidence');
});

test('action 200 with a voucher → a voucher_issued money fact AND a vouchers row, both from the answer; a real 0 fee is 0, not NULL', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(VOUCHER_ANSWER));
  const d = flightCancelDecision(parsed, 200, EV);
  assert.equal(d.moneyEvents.length, 3);
  assert.equal(d.moneyEvents[1].kind, 'cancellation_fee');
  assert.equal(d.moneyEvents[1].amountCents, 0, 'the vendor stated 0 — a real 0');
  assert.deepEqual(d.moneyEvents[2], { reservationId: 'res_f1', lane: 'flight', kind: 'voucher_issued', amountCents: 38050, currency: 'THB', refundDestination: 'voucher', status: 'stated', vendorReference: 'VJ-CREDIT-1', arrivalId: 'arr_1', statedAt: ARRIVED });
  assert.equal(d.vouchers.length, 1);
  const v = d.vouchers[0];
  assert.equal(v.code, 'VJ-CREDIT-1');
  assert.equal(v.airline, 'VZ');
  assert.equal(v.vendorVoucherId, 'v_1');
  assert.equal(v.amountCents, 38050);
  assert.equal(v.currency, 'THB');
  assert.equal(v.validFrom?.toISOString(), '2026-09-26T12:00:00.000Z');
  assert.equal(v.expiresAt?.toISOString(), '2027-09-25T12:00:00.000Z');
  assert.deepEqual(v.passengerNames, ['Ada Lovelace']);
  assert.equal(v.notes, 'non-transferable');
  assert.equal(v.arrivalId, 'arr_1');
  // A voucher stated without a code: its money fact is kept, no voucher row, and it is named.
  const noCode = parseFlightCancellationResult({ ...VOUCHER_ANSWER.data, vouchers: [{ ...VOUCHER_ANSWER.data.vouchers[0], code: undefined }] });
  const d2 = flightCancelDecision(noCode, 200, EV);
  assert.equal(d2.moneyEvents.length, 3);
  assert.equal(d2.vouchers.length, 0);
  assert.equal(d2.vouchersWithoutCode.length, 1);
});

test('action 202 → cancel_pending, ZERO money_events rows, commission left; the money is item 3', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(PENDING_ANSWER));
  assert.equal(parsed.status, 'CONFIRMED', 'the vendor word on a 202');
  const d = flightCancelDecision(parsed, 202, EV);
  assert.equal(d.status, 'cancel_pending');
  assert.equal(d.final, false);
  assert.deepEqual(d.moneyEvents, []);
  assert.deepEqual(d.vouchers, []);
  assert.equal(d.commission, 'leave');
  // A 200 that does not state a final cancellation word is thrown, never written as cancelled.
  assert.throws(() => flightCancelDecision(parsed, 200, EV), /not a final cancellation/);
  assert.throws(() => flightCancelDecision(parsed, 204, EV), /documents 200 \(final\) and 202/);
  assert.match(comments(LEAF), /item 3, NOT this PR/);
});

test('refund absent in an answer → amountCents NULL, never 0', () => {
  const parsed = parseFlightCancellationResult(flightCancellationObjectOf(SILENT_ANSWER));
  assert.equal(parsed.refundAmount, null);
  assert.equal(parsed.cancellationFee, null);
  const d = flightCancelDecision(parsed, 200, EV);
  assert.equal(d.moneyEvents[0].amountCents, null);
  assert.equal(d.moneyEvents[1].amountCents, null);
  assert.equal(centsOf(null), null);
  assert.equal(centsOf(0), 0);
  assert.equal(centsOf(380.5), 38050);
  assert.throws(() => centsOf(Number.NaN), /finite/);
  assert.ok(!code(LEAF).includes('?? 0'), 'no ?? 0 in the leaf');
  assert.ok(!code(ROUTE).includes('?? 0'), 'no ?? 0 in the route');
});

test('the HOTEL cancel now KEEPS its refund and fee as money_events from the answer it always parsed; status behavior unchanged', () => {
  const parsed = parseCancelResult(HOTEL_ANSWER.data);
  const rows = hotelCancelMoneyEvents(parsed, { reservationId: 'res_h1', arrivalId: 'arr_h', statedAt: ARRIVED });
  assert.deepEqual(rows, [
    { reservationId: 'res_h1', lane: 'hotel', kind: 'refund', amountCents: 12500, currency: 'USD', refundDestination: null, status: 'stated', vendorReference: 'hSq2gVDrf', arrivalId: 'arr_h', statedAt: ARRIVED },
    { reservationId: 'res_h1', lane: 'hotel', kind: 'cancellation_fee', amountCents: 2500, currency: 'USD', refundDestination: null, status: 'stated', vendorReference: 'hSq2gVDrf', arrivalId: 'arr_h', statedAt: ARRIVED },
  ]);
  const silent = hotelCancelMoneyEvents(parseCancelResult({ bookingId: 'h', status: 'CANCELLED' }), { reservationId: 'r', arrivalId: 'a', statedAt: ARRIVED });
  assert.equal(silent[0].amountCents, null);
  assert.equal(silent[1].amountCents, null);
  const src = code(ROUTE);
  const hotel = src.slice(src.indexOf('async function cancelHotel('), src.indexOf('async function cancelFlight('));
  assert.match(hotel, /data: \{ status: 'cancelled' \}/, 'the status write, exactly as before');
  assert.match(hotel, /hotelCancelMoneyEvents\(parsed, \{ reservationId: owned\.id, arrivalId, statedAt: answer\.arrived \}\)/, 'pointed at the arrival it lands');
  assert.match(hotel, /tx\.money_events\.createMany\(\{ data: moneyEvents \}\)/, 'written in the same transaction');
  assert.match(hotel, /await cancelBooking\(owned\.providerBookingId\)/, 'still the hotel client');
});

test('the landing hands the arrival id the rows point at — over the shared fake store, with the flight parser', async () => {
  const landing = new FakeLanding();
  const answer = answerOf(FINAL_ANSWER);
  const object = flightCancellationObjectOf(answer.json);
  const handed: { value: { arrivalId: string; rows: number } | null } = { value: null };
  const out = await landLiteApiCancellation({
    landing,
    now: () => new Date('2026-09-26T09:05:01Z'),
    writeStatus: async (parsed, arrivalId) => {
      const d = flightCancelDecision(parsed, answer.httpStatus, { reservationId: 'res_f1', arrivalId, statedAt: answer.arrived });
      handed.value = { arrivalId, rows: d.moneyEvents.length };
      return { status: d.status };
    },
  }, { answer, bookingId: 'fb_9Q', payload: object, parse: parseFlightCancellationResult, userId: 'u_alex' });
  assert.ok(handed.value);
  assert.equal(handed.value.arrivalId, out.arrivalId, 'the rows point at the arrival the landing recorded');
  assert.equal(handed.value.rows, 2);
  assert.equal(out.theirId, 'cancellation:fb_9Q');
  assert.equal(landing.rowsOf('cancellation').length, 1, 'one arrival, liteapi · cancellation');
  assert.equal(out.parsed.status, 'CANCELLED_WITH_CHARGES');
});

test('a cancelled reservation\'s calendar row is MARKED, never removed', async () => {
  const marks: Array<[string, string]> = [];
  const port: BookingCalendarCancelPort = { async markCancelled(source, sourceId) { marks.push([source, sourceId]); return 1; } };
  const out = await markBookingCalendarCancelled(port, 'res_f1');
  assert.deepEqual(marks, [[BOOKING_CALENDAR_SOURCE, 'res_f1']], 'keyed exactly as CAL-01 wrote it');
  assert.equal(out.marked, 1);
  const impl = code('src/lib/calendar/prismaBookingCalendar.ts');
  assert.match(impl, /UPDATE calendar_events/);
  assert.match(impl, /SET title = \$\{CANCELLED_TITLE_PREFIX\} \|\| title, status = 'cancelled'/);
  assert.ok(!/DELETE FROM calendar_events/.test(impl), 'nothing is removed');
  assert.equal(CANCELLED_TITLE_PREFIX, 'Cancelled: ');
  // The route marks AFTER the transaction, in its own try/catch, on a FINAL cancel only.
  const src = code(ROUTE);
  assert.match(src, /const calendar = decision\.final \? await markCalendar\(owned\.id, owned\.providerBookingId\) : 'pending';/);
  assert.match(src.slice(src.indexOf('async function markCalendar('), src.indexOf('async function cancelHotel(')), /catch \(calErr\)/);
});

test('the refresh does not flip a cancel_pending row back to confirmed while the airline still says CONFIRMED; a final word still lands', async () => {
  const STATED: FlightBookingStated = { bookingId: 'fb_9Q', status: 'CONFIRMED', segments: [{ departureTime: '2026-10-25T14:15:00', direction: 'OUTBOUND', originCode: 'BKK', destinationCode: 'HKT', carrierName: 'Thai Vietjet Air', flightNumber: '228' }] };
  const writes: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const ports = (status: string): FlightRefreshPorts => ({
    fetchBooking: async () => ({ ...STATED, status }),
    calendar: { async find() { return true; }, async insert() { throw new Error('not expected'); } },
    writeReservation: async (id, patch) => { writes.push({ id, patch }); },
  });
  const row = { id: 'res_f1', userId: 'u', lane: 'flight', providerBookingId: 'fb_9Q', providerConfirmationCode: null, status: 'cancel_pending', displayName: 'Thai Vietjet Air BKK → HKT' };
  const pending = await refreshFlightReservation(ports('CONFIRMED'), row);
  assert.ok(pending.fetched);
  if (pending.fetched) { assert.equal(pending.status, 'unchanged'); assert.equal(pending.statusValue, 'cancel_pending'); }
  assert.equal(writes.length, 0, 'no write — the request is not undone');
  const finalized = await refreshFlightReservation(ports('CANCELLED_WITH_CHARGES'), row);
  assert.ok(finalized.fetched);
  if (finalized.fetched) { assert.equal(finalized.status, 'set'); assert.equal(finalized.statusValue, 'cancelled'); }
  assert.deepEqual(writes, [{ id: 'res_f1', patch: { status: 'cancelled' } }]);
  // The post-202 read parses the vendor's own cancelIntentAt; absence is null.
  assert.equal(parseFlightBookingDetails({ bookingId: 'fb_9Q', status: 'CONFIRMED', cancelIntentAt: '2026-09-26T09:05:00Z' }).cancelIntentAt, '2026-09-26T09:05:00Z');
  assert.equal(parseFlightBookingDetails({ bookingId: 'fb_9Q', status: 'CONFIRMED' }).cancelIntentAt, null);
});

test('the route: GET is the quote, reserved before the vendor; POST dispatches on the lane; 202 reads cancelIntentAt from the vendor, never our clock; 409 is named', () => {
  const src = code(ROUTE);
  const get = src.slice(src.indexOf('export async function GET('), src.indexOf('export async function POST('));
  const reserve = get.indexOf("reserveTravelSearch('liteapiflightcancelquote')");
  const vendor = get.indexOf('getFlightCancellationQuote(owned.providerBookingId)');
  assert.ok(reserve > 0 && vendor > reserve, 'metered immediately before the vendor read');
  assert.match(get, /code: 'quote_lane_unsupported'/);
  assert.match(get, /code: 'quote_refused'/);
  assert.match(get, /err instanceof LiteApiFlightsApiError && err\.status === 409/);
  const post = src.slice(src.indexOf('export async function POST('), src.indexOf('async function markCalendar('));
  assert.match(post, /if \(owned\.lane === 'hotel'\) return cancelHotel\(owned, userId\);/);
  assert.match(post, /if \(owned\.lane === 'flight'\) return cancelFlight\(owned, userId\);/);
  assert.match(post, /code: 'cancel_lane_unsupported'/, 'an activity is still refused by name');
  assert.match(src, /code: 'cancel_already_pending'/, 'a second request on a pending cancel is named');
  const flight = src.slice(src.indexOf('async function cancelFlight('));
  assert.match(flight, /await cancelFlightBooking\(owned\.providerBookingId\)/, 'the flight endpoint');
  assert.ok(!flight.includes('cancelBooking(owned'), 'never the hotel endpoint');
  assert.match(flight, /code: 'cancel_refused'/, 'the 409 refusal is named and nothing is written');
  assert.ok(flight.indexOf("code: 'cancel_refused'") < flight.indexOf('prisma.$transaction'), 'refused before any write');
  assert.match(flight, /flightCancelDecision\(parsed, answer\.httpStatus, \{ reservationId: owned\.id, arrivalId, statedAt: answer\.arrived \}\)/);
  const read = flight.indexOf("reserveTravelSearch('liteapiflightbookingread')");
  const getBooking = flight.indexOf('getFlightBooking(owned.providerBookingId)');
  assert.ok(read > 0 && getBooking > read, 'the cancelIntentAt read is metered');
  assert.match(flight, /cancelIntentAt: new Date\(details\.cancelIntentAt\)/, 'the vendor word');
  assert.ok(!/cancelIntentAt: new Date\(\)/.test(src), 'never our clock');
  assert.match(flight, /passengerNames: v\.passengerNames === null \? Prisma\.DbNull : v\.passengerNames/, 'SQL NULL when the vendor stated no names');
  // The named absences, at their attach points (comments, read as comments).
  const head = comments(ROUTE);
  assert.match(head, /CANCEL-02: the cancellation EMAIL attaches here — NOT this PR/);
  assert.match(head, /item 3: the webhook receiver and scheduled refresh/);
  assert.match(head, /item 7: journal posting of these money facts attaches here — NOT this PR/);
  assert.match(comments('prisma/migrations/20260926090000_cancel_01_money_events/migration.sql'), /item 8, refund matching, NOT this PR/);
});

test('the dialog: for a flight the quote renders BEFORE any Cancel control; a quote that cannot be fetched is named and leaves no Cancel control', () => {
  const src = code(DIALOG);
  assert.match(src, /const canConfirm = !isFlight \|\| quote\.state === 'quoted';/);
  const button = src.indexOf("{busy ? 'Cancelling…' : 'Cancel booking'}");
  const gate = src.indexOf('{canConfirm && (');
  assert.ok(gate > 0 && button > gate && src.slice(gate, button).includes('<button'), 'the Cancel control sits inside the quoted gate');
  assert.equal((src.match(/'Cancel booking'/g) ?? []).length, 1, 'one Cancel control, and it is the gated one');
  assert.match(src, /fetch\(`\/api\/reservations\/\$\{reservationId\}\/cancel`\)/, 'GET the quote on open');
  for (const shown of ['data-quote-refund', 'data-quote-penalty', 'data-quote-confidence', 'data-quote-destination', 'data-quote-vouchers']) assert.ok(src.includes(shown), `${shown} is rendered`);
  assert.match(src, /confidenceWords\(quote\.quote\.confidence\)/, 'the confidence in its word AND its meaning');
  assert.match(src, /destinationWords\(quote\.quote\.destination\)/, 'the destination in plain words');
  assert.match(src, /state: 'quote_failed'/);
  assert.match(src, /The cancellation quote could not be fetched\./);
  assert.match(src, /Nothing was cancelled\. Without the airline&apos;s quote you are not asked to confirm/);
  assert.match(src, /data-cancel-quote=\{isFlight \? quote\.state : 'stored_policy'\}/, 'the state is nameable from the DOM');
  assert.ok(!src.includes('?? 0'), 'no number is invented');
});

test('the lists: Cancel on hotel AND flight (never activity); a pending row says so; the dialog is given the lane', () => {
  for (const f of LISTS) {
    const src = code(f);
    assert.match(src, /\(r\.type === 'hotel' \|\| r\.type === 'flight'\) && r\.status === 'confirmed' && \(/, f);
    assert.match(src, /r\.status === 'cancel_pending' \? 'cancellation requested — awaiting the airline' : r\.status/, f);
    assert.match(src, /lane=\{cancelTarget\.type\}/, `${f}: the lane through the one reader`);
    assert.match(src, /reservationId=\{cancelTarget\.id\}/);
    assert.match(src, /data-cancel-outcome=\{outcome\.pending \? 'pending' : 'final'\}/);
    assert.match(src, /Cancellation requested — awaiting the airline/);
    assert.ok(!/\.lane\b/.test(src), `${f}: no raw lane read`);
  }
});

test('the flights client: the two documented paths, the observability line, the error contract', () => {
  const src = code(FCLIENT);
  assert.match(src, /getFlightsAnswer\(base, `\/flights\/bookings\/\$\{encodeURIComponent\(bookingId\)\}\/cancellations`\)/, 'GET the quote');
  assert.match(src, /postFlightsAnswer\(base, `\/flights\/bookings\/\$\{encodeURIComponent\(bookingId\)\}\/cancellations`, undefined\)/, 'POST the action, no body');
  assert.match(src, /\[LiteAPI flights\] cancellation quote: mode=\$\{mode\} keyPrefix=\$\{keyPrefix\} host=\$\{base\}/);
  assert.match(src, /\[LiteAPI flights\] cancellation: mode=\$\{mode\} keyPrefix=\$\{keyPrefix\} host=\$\{base\}/);
  assert.match(src, /export async function getFlightCancellationQuote\(bookingId: string\): Promise<FlightCancellationQuoteAnswer>/);
  assert.match(src, /export async function cancelFlightBooking\(bookingId: string\): Promise<FlightCancellationAnswer>/);
  // The action object is `data` (an object), and a 2xx without bookingId/status is a contract deviation.
  const deviation = (e: unknown) => e instanceof LiteApiFlightsApiError && /contract deviation/.test(e.providerMessage ?? '');
  assert.throws(() => flightCancellationObjectOf({ data: [{ bookingId: 'x', status: 'CANCELLED' }] }), deviation);
  assert.throws(() => flightCancellationObjectOf({ data: { bookingId: 'x' } }), deviation);
  const quote = comments(FCLIENT);
  assert.match(quote, /get_flights-bookings-bookingid-cancellations/);
  assert.match(quote, /post_flights-bookings-bookingid-cancellations/);
});
