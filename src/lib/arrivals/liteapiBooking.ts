/**
 * REBUILD-01 PR-5 — LITEAPI BOOKINGS LAND RAW-FIRST.
 *
 * The deck's step 2 puts stays and flights on LiteAPI; the two book routes
 * called the client, took the parsed result and wrote a reservations row — the
 * answer's bytes were gone at `res.json()`. Now, per book, inside the route's
 * ONE transaction:
 *
 *   landLiteApiBooking      — landResponse (the exact bytes of the book answer;
 *                             the PR-5 audit found no secret in it — the
 *                             prebook's secretKey is a different answer and
 *                             never rides the book answer (liteapiClient.ts
 *                             BookResult; the docs' field list); a passenger's
 *                             passport and date of birth STAY — they are the
 *                             booking record) → landObjects one arrival
 *                             (liteapi · booking, their_id = the provider's
 *                             bookingId, kind event by the rule book) → the
 *                             lane's parser runs over the ARRIVAL payload read
 *                             back from the table, never over the HTTP object
 *                             → reservations.create + the commission row
 *                             through the route's port, pointed at the arrival
 *                             (reservations.arrival_id) → markRead. The same
 *                             answer again is already_landed: the reservation
 *                             it recorded is found and handed back, none is
 *                             created. A correction (same bookingId, new
 *                             content) lands as a new arrival; when a
 *                             reservation exists it is kept and the correction
 *                             stays pending — declared, not applied (no parser
 *                             rewrites a booking yet).
 *   landLiteApiCancellation — the cancel answer lands the same way (liteapi ·
 *                             cancellation). LiteAPI's cancel answer carries no
 *                             id of its own (bookingId, status,
 *                             cancellation_fee, refund_amount, currency —
 *                             liteapiClient.ts CancelBookingResult), so
 *                             their_id is composed — `cancellation:<bookingId>`
 *                             — and labeled composed; then the status write
 *                             exactly as today, through the route's port →
 *                             markRead.
 *
 * A throw anywhere rolls the route's transaction back: never a booking recorded
 * without its evidence, never evidence of a booking the route did not record.
 *
 * WHO OWNS A BOOKING: the route's user when signed in; a guest booking lands
 * with guest_ref = the booking's own reference (`booking:<bookingId>`) —
 * declared, never dropped, never the guest's email. A cancellation always has
 * a user (the cancel route is owner-only).
 *
 * Pure over ports (LandingDb + the route's domain writes) so node:test drives
 * it with fixtures shaped like the documented answers and the fake store.
 */
import type { ArrivalOutcome, JsonObject, LandingDb } from './land';
import { landObjects, landResponse, markRead } from './land';

export const LITEAPI = 'liteapi';
export const BOOKING = 'booking';
export const CANCELLATION = 'cancellation';

/** A 2xx answer as it came over the wire — the clients build it (liteapiClient.ts fetchAnswer, liteapiFlightsClient.ts postFlightsAnswer). */
export interface LiteApiAnswer {
  httpStatus: number;
  /** The exact bytes of the body (arrayBuffer — never re-encoded). */
  body: Buffer;
  asked: Date;
  arrived: Date;
  /** JSON.parse of `body` — for picking the object out; the parser that fills a domain row reads the ARRIVAL payload, never this. */
  json: unknown;
}

/** guest_ref for a booking nobody is signed in for: the booking's own reference. */
export const bookingGuestRef = (bookingId: string): string => `booking:${bookingId}`;

/** their_id for a cancellation: composed from the booking cancelled (the answer carries no id of its own) and labeled composed. */
export const cancellationTheirId = (bookingId: string): string => `cancellation:${bookingId}`;

export interface BookingObject {
  /** The provider's bookingId. */
  theirId: string;
  /** The booking object inside the answer — the arrival's payload. */
  payload: JsonObject;
}

export interface BookingPorts<P, R> {
  landing: LandingDb;
  /** The reservation an earlier landing recorded for this booking (provider liteapi, providerBookingId), or null — consulted when the arrival was already there. */
  findReservation(bookingId: string): Promise<R | null>;
  /** reservations.create + the commission row, from the parsed arrival, pointed at it. */
  createReservation(parsed: P, arrivalId: string): Promise<R>;
  /** One line per landing (booking id, outcome, what became of the reservation, the response id — never a body); default silent. */
  log?: (line: string) => void;
  now?: () => Date;
}

export interface BookingLandingInput<P> {
  answer: LiteApiAnswer;
  object: BookingObject;
  /** The lane's parser — runs over the arrival payload, never over `object`. */
  parse: (payload: JsonObject) => P;
  userId: string | null;
  lane: 'hotel' | 'flight';
}

export interface BookingLandingResult<P, R> {
  bookingId: string;
  outcome: ArrivalOutcome;
  responseId: string;
  arrivalId: string;
  /** Parsed from the arrival. */
  parsed: P;
  reservation: R;
  /** 'created' — this landing recorded it; 'existing' — an earlier landing had, and the same booking is no second row. */
  reservationOutcome: 'created' | 'existing';
  /** Whether this landing marked the arrival read (a kept correction stays pending — declared). */
  read: boolean;
  userId: string | null;
  guestRef: string | null;
}

/** Inside the caller's transaction: land the bytes, land the booking, parse from the table, record the reservation, mark read. Throws to roll the booking back. */
export async function landLiteApiBooking<P, R>(ports: BookingPorts<P, R>, input: BookingLandingInput<P>): Promise<BookingLandingResult<P, R>> {
  const { answer, object } = input;
  if (typeof object.theirId !== 'string' || object.theirId.length === 0) {
    throw new Error(`liteapi ${input.lane} booking: the answer carries no bookingId — nothing to land`);
  }
  const guestRef = input.userId === null ? bookingGuestRef(object.theirId) : null;
  const response = await landResponse(ports.landing, {
    provider: LITEAPI,
    resource: BOOKING,
    userId: input.userId,
    guestRef,
    httpStatus: answer.httpStatus,
    body: answer.body,
    asked: answer.asked,
    arrived: answer.arrived,
  });
  const landed = await landObjects(ports.landing, {
    provider: LITEAPI,
    resource: BOOKING,
    connection: null,
    userId: input.userId,
    guestRef,
    responseId: response.id,
    asked: answer.asked,
    arrived: answer.arrived,
    objects: [{ theirId: object.theirId, payload: object.payload }],
  });
  const row = landed.rows[0];
  if (!row) throw new Error(`liteapi ${input.lane} booking: ${object.theirId} landed no row — the table is not answering`);
  // The parser reads the arrival, never the HTTP object.
  const parsed = input.parse(row.payload as JsonObject);
  const existing = row.outcome === 'landed' ? null : await ports.findReservation(object.theirId);
  let reservation: R;
  let reservationOutcome: 'created' | 'existing';
  let read = false;
  if (existing !== null) {
    reservation = existing;
    reservationOutcome = 'existing';
  } else {
    reservation = await ports.createReservation(parsed, row.id);
    reservationOutcome = 'created';
    // An arrival already there was read by the landing that recorded it (promise 1: read moves once).
    if (row.outcome !== 'already_landed') {
      await markRead(ports.landing, [row.id], (ports.now ?? (() => new Date()))());
      read = true;
    }
  }
  ports.log?.(`[liteapi] landed ${input.lane} booking ${object.theirId} — ${row.outcome}, reservation ${reservationOutcome}, response ${response.id}`);
  return { bookingId: object.theirId, outcome: row.outcome, responseId: response.id, arrivalId: row.id, parsed, reservation, reservationOutcome, read, userId: input.userId, guestRef };
}

export interface CancellationPorts<P, R> {
  landing: LandingDb;
  /** The status write exactly as today (reservations.update → 'cancelled'), handed the parsed arrival and its id. */
  writeStatus(parsed: P, arrivalId: string): Promise<R>;
  log?: (line: string) => void;
  now?: () => Date;
}

export interface CancellationLandingInput<P> {
  answer: LiteApiAnswer;
  /** The booking cancelled — the id the route asked LiteAPI about. */
  bookingId: string;
  /** The cancel answer's object — the arrival's payload. */
  payload: JsonObject;
  /** The parser — runs over the arrival payload. */
  parse: (payload: JsonObject) => P;
  userId: string;
}

export interface CancellationLandingResult<P, R> {
  bookingId: string;
  theirId: string;
  outcome: ArrivalOutcome;
  responseId: string;
  arrivalId: string;
  parsed: P;
  reservation: R;
  read: boolean;
}

/** Inside the caller's transaction: land the cancel answer's bytes, land the cancellation (composed id), parse from the table, write the status, mark read. Throws to roll it back. */
export async function landLiteApiCancellation<P, R>(ports: CancellationPorts<P, R>, input: CancellationLandingInput<P>): Promise<CancellationLandingResult<P, R>> {
  const { answer } = input;
  const theirId = cancellationTheirId(input.bookingId);
  const response = await landResponse(ports.landing, {
    provider: LITEAPI,
    resource: CANCELLATION,
    userId: input.userId,
    guestRef: null,
    httpStatus: answer.httpStatus,
    body: answer.body,
    asked: answer.asked,
    arrived: answer.arrived,
  });
  const landed = await landObjects(ports.landing, {
    provider: LITEAPI,
    resource: CANCELLATION,
    connection: null,
    userId: input.userId,
    guestRef: null,
    responseId: response.id,
    asked: answer.asked,
    arrived: answer.arrived,
    objects: [{ theirId, theirIdKind: 'composed', payload: input.payload }],
  });
  const row = landed.rows[0];
  if (!row) throw new Error(`liteapi cancellation: ${theirId} landed no row — the table is not answering`);
  const parsed = input.parse(row.payload as JsonObject);
  const reservation = await ports.writeStatus(parsed, row.id);
  let read = false;
  if (row.outcome !== 'already_landed') {
    await markRead(ports.landing, [row.id], (ports.now ?? (() => new Date()))());
    read = true;
  }
  ports.log?.(`[liteapi] landed cancellation of ${input.bookingId} — ${row.outcome}, response ${response.id}`);
  return { bookingId: input.bookingId, theirId, outcome: row.outcome, responseId: response.id, arrivalId: row.id, parsed, reservation, read };
}
