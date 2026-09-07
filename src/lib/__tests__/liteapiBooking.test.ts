import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintOf, sha256, type JsonObject } from '../arrivals/land';
import {
  BOOKING, CANCELLATION, LITEAPI, bookingGuestRef, cancellationTheirId, landLiteApiBooking, landLiteApiCancellation,
  type BookingPorts, type LiteApiAnswer,
} from '../arrivals/liteapiBooking';
import { bookingObjectOf, cancellationObjectOf, parseBookResult, parseCancelResult, type BookResult, type CancelBookingResult } from '../liteapiClient';
import { flightBookingObjectOf, parseFlightBookResult, type FlightBookResult } from '../liteapiFlightsClient';
import { LiteApiError } from '../travelErrors';
import { kindOf } from '../providers';
import { FakeLanding, snapshotClient } from './fakeLanding';

// REBUILD-01 PR-5 — LiteAPI bookings land raw-first. Hermetic: fixtures shaped like the
// documented answers (rates/book, flights/bookings, PUT bookings/{id}), the shared fake
// store, and a fake of the route's two domain writes. The real parsers run over the
// ARRIVAL payload, exactly as the routes wire them.

const ASKED = new Date('2026-09-08T10:00:00Z');
const ARRIVED = new Date('2026-09-08T10:00:06Z');
const NOW = new Date('2026-09-08T10:00:07Z');

/** The book answer as documented (a subset of its 38 fields) — no secretKey, no token: the audit's finding. */
const HOTEL_ANSWER = {
  data: {
    bookingId: 'hSq2gVDrf', clientReference: 'ts-1', supplierBookingId: 'SB-77', supplierBookingName: 'Hotelbeds', supplier: 'hotelbeds', supplierId: 2,
    status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', checkin: '2026-10-01', checkout: '2026-10-04',
    hotel: { hotelId: 'lp1a2b3', name: 'Hotel Temple' },
    bookedRooms: [{ roomType: 'Double', boardType: 'RO', adults: 2, children: 0, rate: { retailRate: { total: [{ amount: 150, currency: 'USD' }] } }, firstName: 'Ada', lastName: 'Lovelace' }],
    holder: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+15550100' },
    createdAt: '2026-09-08T10:00:05Z',
    cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-09-28T00:00:00Z', amount: 0 }] },
    price: 150, commission: 12.5, currency: 'USD', guestId: 'g_1', trackingId: 'trk_1', prebookId: 'pb_1', sellingPrice: 150,
  },
};

/** The flights book answer as documented: data[] of one { booking, message }; passengers carry passport and date of birth. */
const FLIGHT_ANSWER = {
  data: [{
    booking: {
      bookingId: 'fb_9Q', bookingRef: 'FH-269-ABCDEFGH', status: 'PENDING_CONFIRMATION', paymentStatus: 'completed',
      pricing: { subtotal: 400, servicesAmount: 0, totalAmount: 432.1, currency: 'USD' },
      payment: { amount: 432.1, currency: 'USD' },
      order: { reference: { orderId: 'ord_1', provider: { pnr: 'PNR123' } } },
      passengers: [{ type: 'adult', firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1990-01-02', documentType: 'passport', documentNumber: 'X1234567', documentExpiry: '2030-01-01' }],
    },
    message: 'a booking already exists for this prebookId; returning the existing booking',
  }],
};

/** The cancel answer as documented — no id of its own. */
const CANCEL_ANSWER = { data: { bookingId: 'hSq2gVDrf', status: 'CANCELLED', cancellation_fee: 25, refund_amount: 125, currency: 'USD' }, sandbox: true };

/** An answer as the clients build it — pretty-printed bytes, so a re-serialization would differ from the wire. */
const answerOf = (json: unknown, text = JSON.stringify(json, null, 1)): LiteApiAnswer =>
  ({ httpStatus: 200, body: Buffer.from(text, 'utf8'), asked: ASKED, arrived: ARRIVED, json: JSON.parse(text) });

type Row = { id: string; providerBookingId: string; arrival_id: string | null; status: string };

/** The route's two domain writes, faked: reservations keyed by providerBookingId. */
class FakeDomain<P extends { bookingId: string }> {
  created: Array<{ parsed: P; arrivalId: string }> = [];
  finds: string[] = [];
  rows = new Map<string, Row>();
  parsedFrom: JsonObject[] = [];
  constructor(private throwOnCreate = false) {}
  ports(landing: FakeLanding, log?: (line: string) => void): BookingPorts<P, Row> {
    return {
      landing,
      log,
      now: () => NOW,
      findReservation: async (bookingId) => { this.finds.push(bookingId); return this.rows.get(bookingId) ?? null; },
      createReservation: async (parsed, arrivalId) => {
        if (this.throwOnCreate) throw new Error('Invalid `tx.reservations.create()` invocation: column "arrival_id" of relation "reservations" does not exist');
        const row: Row = { id: `res_${this.rows.size + 1}`, providerBookingId: parsed.bookingId, arrival_id: arrivalId, status: 'confirmed' };
        this.rows.set(parsed.bookingId, row);
        this.created.push({ parsed, arrivalId });
        return row;
      },
    };
  }
  /** The lane's parser, recording what it was handed. */
  parser(parse: (payload: JsonObject) => P) {
    return (payload: JsonObject) => { this.parsedFrom.push(payload); return parse(payload); };
  }
}

const hotelInput = (dom: FakeDomain<BookResult>, answer: LiteApiAnswer, userId: string | null = 'u_alex') => {
  const object = bookingObjectOf(answer.json);
  return { answer, object: { theirId: object.bookingId as string, payload: object }, parse: dom.parser(parseBookResult), userId, lane: 'hotel' as const };
};

test('the rule book names both feeds: liteapi · booking → event, liteapi · cancellation → event', () => {
  assert.equal(kindOf(LITEAPI, BOOKING), 'event');
  assert.equal(kindOf(LITEAPI, CANCELLATION), 'event');
});

test('a hotel book answer lands one response (the exact bytes, sha256 over them, no redaction — no secret rides the book answer) and one arrival (their_id = bookingId, kind event); the reservation is created from the ARRIVAL payload, pointed at it; read once', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain<BookResult>();
  const lines: string[] = [];
  const answer = answerOf(HOTEL_ANSWER);
  const input = hotelInput(dom, answer);
  const out = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom.ports(landing, (l) => lines.push(l)), input));
  assert.equal(out.bookingId, 'hSq2gVDrf');
  assert.equal(out.outcome, 'landed');
  assert.equal(out.reservationOutcome, 'created');
  assert.equal(out.read, true);
  assert.equal(out.userId, 'u_alex');
  assert.equal(out.guestRef, null);
  // the wire row: the exact bytes as received (pretty-printed here — a re-serialization would differ), hashed as stored, nothing redacted
  assert.equal(landing.responses.length, 1);
  const r = landing.responses[0];
  assert.equal(r.provider, LITEAPI);
  assert.equal(r.resource, BOOKING);
  assert.equal(r.http_status, 200);
  assert.equal(r.body.toString('utf8'), JSON.stringify(HOTEL_ANSWER, null, 1), 'the exact wire bytes');
  assert.equal(Buffer.compare(r.body, answer.body), 0);
  assert.deepEqual(r.body_sha256, sha256(answer.body));
  assert.deepEqual(r.redactions, []);
  assert.equal(r.user_id, 'u_alex');
  assert.equal(r.guest_ref, null);
  assert.deepEqual(r.asked, ASKED);
  assert.deepEqual(r.arrived, ARRIVED);
  const text = r.body.toString('utf8');
  assert.ok(!text.includes('secretKey') && !text.includes('transactionId'), 'the audit: the prebook secret never rides the book answer');
  // the arrival: the booking object (not the envelope), the provider id, the book's kind
  assert.equal(landing.arrivals.size, 1);
  const a = [...landing.arrivals.values()][0];
  assert.equal(a.row.their_id, 'hSq2gVDrf');
  assert.equal(a.row.their_id_kind, 'provider');
  assert.equal(a.row.kind, 'event');
  assert.equal(a.row.resource, BOOKING);
  assert.equal(a.row.connection, null);
  assert.deepEqual(a.row.payload, HOTEL_ANSWER.data);
  assert.deepEqual(a.row.redactions, []);
  assert.equal(Buffer.compare(Buffer.from(a.row.fingerprint), fingerprintOf(HOTEL_ANSWER.data)), 0);
  assert.equal(a.row.response_id, r.id);
  assert.equal(a.row.user_id, 'u_alex');
  assert.equal(a.status, 'done');
  assert.deepEqual(a.read, NOW);
  assert.equal(out.arrivalId, a.row.id);
  assert.equal(out.responseId, r.id);
  // the parser ran over the arrival payload read back from the table — equal in content, not the HTTP object
  assert.equal(dom.parsedFrom.length, 1);
  assert.notEqual(dom.parsedFrom[0], input.object.payload, 'not the HTTP object');
  assert.deepEqual(dom.parsedFrom[0], input.object.payload);
  assert.deepEqual(out.parsed, parseBookResult(HOTEL_ANSWER.data));
  assert.equal(out.parsed.hotelName, 'Hotel Temple');
  assert.equal(out.parsed.commission, 12.5);
  // the reservation: one, from the parsed arrival, pointed at it
  assert.equal(dom.created.length, 1);
  assert.equal(dom.created[0].arrivalId, a.row.id);
  assert.deepEqual(dom.created[0].parsed, out.parsed);
  assert.equal(out.reservation.arrival_id, a.row.id);
  assert.equal(out.reservation.providerBookingId, 'hSq2gVDrf');
  assert.deepEqual(dom.finds, [], 'a first landing never looks for an earlier reservation');
  // one line, no body
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[liteapi\] landed hotel booking hSq2gVDrf — landed, reservation created, response resp_[0-9a-f-]+$/);
});

test('the same answer again is already_landed: a second wire row, no second arrival, the reservation it recorded handed back — no second reservation, read untouched', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain<BookResult>();
  const first = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom.ports(landing), hotelInput(dom, answerOf(HOTEL_ANSWER))));
  // the retry: the same content, different wire formatting (a re-sent answer is its own HTTP answer)
  const again = answerOf(HOTEL_ANSWER, JSON.stringify(HOTEL_ANSWER));
  const second = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom.ports(landing), hotelInput(dom, again)));
  assert.equal(second.outcome, 'already_landed');
  assert.equal(second.reservationOutcome, 'existing');
  assert.equal(second.read, false);
  assert.equal(second.arrivalId, first.arrivalId);
  assert.equal(second.reservation.id, first.reservation.id);
  assert.equal(landing.responses.length, 2, 'every HTTP answer is its own wire row');
  assert.notEqual(second.responseId, first.responseId);
  assert.equal(landing.arrivals.size, 1, 'the same thing is the same provider, id and content');
  assert.equal(dom.created.length, 1, 'no second reservation');
  assert.deepEqual(dom.finds, ['hSq2gVDrf']);
  assert.deepEqual([...landing.arrivals.values()][0].read, NOW);
});

test('a landing throw (the reservation write fails) leaves nothing: no wire row, no arrival, no reservation — the transaction rolled back and the error is declared', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain<BookResult>(true);
  let rolledBack = 0;
  await assert.rejects(
    snapshotClient(landing, () => { rolledBack += 1; }).$transaction(() => landLiteApiBooking(dom.ports(landing), hotelInput(dom, answerOf(HOTEL_ANSWER)))),
    /column "arrival_id" of relation "reservations"/,
  );
  assert.equal(rolledBack, 1);
  assert.equal(landing.responses.length, 0);
  assert.equal(landing.arrivals.size, 0);
  assert.equal(dom.created.length, 0);
});

test('a flights book answer lands data[0].booking as the arrival (the envelope message stays in the wire row); a guest booking lands with guest_ref = the booking\'s own reference; passport and date of birth stay — they are the booking record', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain<FlightBookResult>();
  const answer = answerOf(FLIGHT_ANSWER);
  const object = flightBookingObjectOf(answer.json);
  const out = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom.ports(landing), {
    answer, object: { theirId: object.bookingId as string, payload: object }, parse: dom.parser(parseFlightBookResult), userId: null, lane: 'flight',
  }));
  assert.equal(out.bookingId, 'fb_9Q');
  assert.equal(out.outcome, 'landed');
  assert.equal(out.userId, null);
  assert.equal(out.guestRef, bookingGuestRef('fb_9Q'));
  assert.equal(out.guestRef, 'booking:fb_9Q');
  const r = landing.responses[0];
  assert.equal(r.user_id, null);
  assert.equal(r.guest_ref, 'booking:fb_9Q');
  const text = r.body.toString('utf8');
  assert.ok(text.includes('returning the existing booking'), 'the wire row holds the whole answer, message included');
  assert.ok(text.includes('X1234567') && text.includes('1990-01-02'), 'passport and date of birth stay in the booking record');
  const a = [...landing.arrivals.values()][0];
  assert.equal(a.row.their_id, 'fb_9Q');
  assert.equal(a.row.guest_ref, 'booking:fb_9Q');
  assert.equal(a.row.user_id, null);
  assert.deepEqual(a.row.payload, FLIGHT_ANSWER.data[0].booking, 'the booking object, not the entry');
  assert.equal((a.row.payload as { message?: unknown }).message, undefined);
  assert.equal(Buffer.compare(Buffer.from(a.row.fingerprint), fingerprintOf(FLIGHT_ANSWER.data[0].booking)), 0);
  // parsed from the arrival, field for field what bookFlight always returned
  assert.deepEqual(out.parsed, { bookingId: 'fb_9Q', bookingRef: 'FH-269-ABCDEFGH', status: 'PENDING_CONFIRMATION', paymentStatus: 'completed', pnr: 'PNR123', price: 432.1, currency: 'USD' });
  assert.equal(dom.created[0].arrivalId, a.row.id);
  // the contract deviation bookFlight always threw, now at the object
  assert.throws(() => flightBookingObjectOf({ data: [] }), /\/flights\/bookings returned 200/);
  assert.throws(() => flightBookingObjectOf({ data: [{ booking: { status: 'CONFIRMED' } }] }), /\/flights\/bookings returned 200/);
});

test('a cancel answer lands one response and one arrival with a COMPOSED their_id (the answer carries no id of its own), labeled composed; the status write runs once, from the parsed arrival; read once', async () => {
  const landing = new FakeLanding();
  const lines: string[] = [];
  const writes: Array<{ parsed: CancelBookingResult; arrivalId: string }> = [];
  const answer = answerOf(CANCEL_ANSWER);
  const out = await snapshotClient(landing).$transaction(() => landLiteApiCancellation({
    landing,
    log: (l) => lines.push(l),
    now: () => NOW,
    writeStatus: async (parsed, arrivalId) => { writes.push({ parsed, arrivalId }); return { id: 'res_1', status: 'cancelled' }; },
  }, { answer, bookingId: 'hSq2gVDrf', payload: cancellationObjectOf(answer.json), parse: parseCancelResult, userId: 'u_alex' }));
  assert.equal(out.bookingId, 'hSq2gVDrf');
  assert.equal(out.theirId, cancellationTheirId('hSq2gVDrf'));
  assert.equal(out.theirId, 'cancellation:hSq2gVDrf');
  assert.equal(out.outcome, 'landed');
  assert.equal(out.read, true);
  assert.deepEqual(out.reservation, { id: 'res_1', status: 'cancelled' });
  const r = landing.responses[0];
  assert.equal(r.resource, CANCELLATION);
  assert.equal(r.body.toString('utf8'), JSON.stringify(CANCEL_ANSWER, null, 1), 'the exact wire bytes, sandbox flag included');
  assert.deepEqual(r.body_sha256, sha256(answer.body));
  assert.deepEqual(r.redactions, []);
  assert.equal(r.user_id, 'u_alex');
  const a = [...landing.arrivals.values()][0];
  assert.equal(a.row.their_id, 'cancellation:hSq2gVDrf');
  assert.equal(a.row.their_id_kind, 'composed');
  assert.equal(a.row.kind, 'event');
  assert.equal(a.row.resource, CANCELLATION);
  assert.deepEqual(a.row.payload, CANCEL_ANSWER.data, 'the object, not the envelope');
  assert.equal(Buffer.compare(Buffer.from(a.row.fingerprint), fingerprintOf(CANCEL_ANSWER.data)), 0);
  assert.equal(a.status, 'done');
  assert.deepEqual(a.read, NOW);
  assert.equal(out.arrivalId, a.row.id);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].arrivalId, a.row.id);
  assert.deepEqual(writes[0].parsed, { bookingId: 'hSq2gVDrf', status: 'CANCELLED', cancellationFee: 25, refundAmount: 125, currency: 'USD' });
  assert.deepEqual(out.parsed, writes[0].parsed);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[liteapi\] landed cancellation of hSq2gVDrf — landed, response resp_[0-9a-f-]+$/);
});

test('a cancel whose status write fails leaves nothing — no wire row, no arrival, the flip rolled back with them', async () => {
  const landing = new FakeLanding();
  const answer = answerOf(CANCEL_ANSWER);
  await assert.rejects(
    snapshotClient(landing).$transaction(() => landLiteApiCancellation({
      landing,
      writeStatus: async () => { throw new Error('Invalid `tx.reservations.update()` invocation'); },
    }, { answer, bookingId: 'hSq2gVDrf', payload: cancellationObjectOf(answer.json), parse: parseCancelResult, userId: 'u_alex' })),
    /reservations\.update/,
  );
  assert.equal(landing.responses.length, 0);
  assert.equal(landing.arrivals.size, 0);
});

test('a correction (same bookingId, new content) lands a new arrival; the reservation already recorded is kept and the correction stays pending — declared, not applied; with no reservation to keep, it is created from the correction and read', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain<BookResult>();
  const pending = { data: { ...HOTEL_ANSWER.data, status: 'PENDING', hotelConfirmationCode: undefined } };
  const first = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom.ports(landing), hotelInput(dom, answerOf(pending))));
  assert.equal(first.outcome, 'landed');
  assert.equal(first.parsed.status, 'PENDING');
  const second = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom.ports(landing), hotelInput(dom, answerOf(HOTEL_ANSWER))));
  assert.equal(second.outcome, 'corrected');
  assert.equal(second.reservationOutcome, 'existing');
  assert.equal(second.read, false);
  assert.equal(second.reservation.id, first.reservation.id);
  assert.equal(second.parsed.status, 'CONFIRMED', 'parsed from the correction — reported, not written');
  assert.equal(landing.arrivals.size, 2);
  assert.equal(landing.rowsFor('hSq2gVDrf').length, 2);
  const correction = landing.rowsFor('hSq2gVDrf').find((x) => x.row.id === second.arrivalId)!;
  assert.equal(correction.status, 'pending');
  assert.equal(correction.read, null);
  assert.equal(dom.created.length, 1);
  // the same correction against a store with the rows but no reservation recorded (a fresh domain): created from the correction, read
  const dom2 = new FakeDomain<BookResult>();
  const third = await snapshotClient(landing).$transaction(() => landLiteApiBooking(dom2.ports(landing), hotelInput(dom2, answerOf({ data: { ...HOTEL_ANSWER.data, status: 'TICKETED' } }))));
  assert.equal(third.outcome, 'corrected');
  assert.equal(third.reservationOutcome, 'created');
  assert.equal(third.read, true);
  assert.equal(dom2.created[0].arrivalId, third.arrivalId);
});

test('no bookingId, nothing lands: the landing throws before any row; the clients\' object pickers throw the contract deviation on an answer with no object and accept the flat shape', async () => {
  const landing = new FakeLanding();
  const dom = new FakeDomain<BookResult>();
  const answer = answerOf({ data: { status: 'CONFIRMED' } });
  await assert.rejects(
    landLiteApiBooking(dom.ports(landing), { answer, object: { theirId: '', payload: bookingObjectOf(answer.json) }, parse: parseBookResult, userId: 'u_alex', lane: 'hotel' }),
    /carries no bookingId — nothing to land/,
  );
  assert.equal(landing.responses.length, 0);
  assert.equal(landing.arrivals.size, 0);
  assert.throws(() => bookingObjectOf({ data: [] }), (e: unknown) => e instanceof LiteApiError && /contract deviation/.test(e.message));
  assert.throws(() => bookingObjectOf('nope'), LiteApiError);
  assert.throws(() => cancellationObjectOf({ data: 42 }), LiteApiError);
  assert.deepEqual(bookingObjectOf({ bookingId: 'flat', status: 'CONFIRMED' }), { bookingId: 'flat', status: 'CONFIRMED' }, 'flat at the root is accepted, as bookRate always did');
  assert.deepEqual(bookingObjectOf({ data: null, bookingId: 'y' }), { data: null, bookingId: 'y' }, 'a null data falls back to the root, as `json.data ?? json` always did');
  assert.deepEqual(bookingObjectOf({ data: { bookingId: 'x' } }), { bookingId: 'x' });
});

test('the parsers are field for field what the clients always returned — absent fields stay absent (hotel) or null (cancel), never invented', () => {
  assert.deepEqual(parseBookResult({}), { bookingId: undefined, status: 'CONFIRMED', hotelConfirmationCode: undefined, supplierConfirmationNum: undefined, checkin: undefined, checkout: undefined, hotelName: undefined, price: undefined, commission: undefined, currency: undefined, cancellationPolicies: undefined });
  assert.deepEqual(parseBookResult(HOTEL_ANSWER.data), {
    bookingId: 'hSq2gVDrf', status: 'CONFIRMED', hotelConfirmationCode: 'HCC-4421', supplierConfirmationNum: undefined, checkin: '2026-10-01', checkout: '2026-10-04',
    hotelName: 'Hotel Temple', price: 150, commission: 12.5, currency: 'USD', cancellationPolicies: HOTEL_ANSWER.data.cancellationPolicies,
  });
  assert.deepEqual(parseCancelResult({ bookingId: 'b', cancellation_fee: '25', refund_amount: null }), { bookingId: 'b', status: null, cancellationFee: null, refundAmount: null, currency: null });
  assert.deepEqual(parseFlightBookResult({ bookingId: 'f', payment: { amount: 10, currency: 'EUR' } }), { bookingId: 'f', bookingRef: null, status: null, paymentStatus: null, pnr: null, price: 10, currency: 'EUR' });
});
