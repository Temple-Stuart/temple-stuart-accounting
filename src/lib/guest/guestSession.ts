/**
 * GUEST-01 (2026-09-29) — THE GUEST ROUTES' DECISIONS, OVER PORTS.
 *
 * POST /api/guest/session and GET /api/guest/booking are thin adapters (the house
 * pattern of src/lib/calendar/icsExport.ts): what they answer is decided here, so
 * node:test drives every branch without a database.
 *
 * THE LOOKUP (openGuestSession), in this order:
 *   1. the caller's IP — none is the one failure answer (there is no 'unknown' bucket);
 *   2. the shapes — a reference as the column holds it, a code through parseManageCode;
 *      either wrong is 400 by one line;
 *   3. the limits — per IP, then per reference — BOTH before any read; over is 429;
 *   4. the guest rows under that reference (the port reads bookingType 'guest' and
 *      userId null, ids only), every row's code compared in constant time, and one
 *      dummy compare when no row came back, so the work is the same;
 *   5. exactly one match opens that reservation; every other outcome — unknown
 *      reference, wrong code, an account's booking, no row — is the same 404 and the
 *      same line.
 * It writes nothing (the limiter's counter is the lib's), sends nothing, calls no
 * vendor, and never logs, returns or redirects with the code.
 *
 * THE BOOKING (guestBooking): the session first — none or invalid is 401; then that ONE
 * reservation, still a guest's, or the lookup's 404; its landed answers and the refunds
 * the vendor stated; the answer is guestReceiptOf's — the vendor's side only.
 * GUEST-02 (2026-09-30): beside the receipt, unchanged, the answer carries the cancel offer
 * (guestCancelOffer) — Cancel is offered exactly when the flow would take the booking.
 *
 * THE CANCEL (guestCancelGate, GUEST-02, 2026-09-30), in this order:
 *   1. the session — none or invalid is 401, before anything is counted or read;
 *   2. the caller's IP — none is the one 404 (there is no 'unknown' bucket);
 *   3. the limits — per IP, then per reservation, the cancel's OWN buckets (a cancel never
 *      spends the lookup's attempts) — BOTH before any read; over is 429;
 *   4. the session's reservation, still a guest's, on a cancel lane — the port reads
 *      { id, bookingType 'guest', userId null, provider liteapi | duffel } — or the one 404;
 *   5. the row, handed to the one cancel flow by the guest's route.
 * It writes nothing (the limiter's counter is the lib's), calls no vendor and logs nothing;
 * the row's type is the caller's — this file does not know the flow.
 *
 * No clock and no env here: the key and "now" are arguments.
 */
import { REFERENCE_SHAPE, codesMatch, manageCode, parseManageCode, verifyGuestSession } from './guestAccess';
import { guestReceiptOf, type GuestMoneyEvent, type GuestReceipt, type ReceiptArrival, type ReceiptReservation } from '../receipts/bookingReceipt';
import { reservationIdentity } from '../reservations/lane';

/** The words the guest routes answer — one line per outcome, the same every time. */
export const GUEST_WORDS = {
  badShape: 'Enter the reference and code from your email.',
  notOpened: "We couldn't open a booking with that reference and code.",
  tooMany: 'Too many attempts — wait a few minutes, then try again.',
  sessionEnded: 'Your booking session has ended. Enter your reference and code again.',
} as const;

/** The per-IP and per-reference limits: 10 and 5 attempts per 15 minutes. */
export const GUEST_LIMITS = {
  ip: { limit: 10, windowSeconds: 900 },
  reference: { limit: 5, windowSeconds: 900 },
} as const;

/** A fixed id the code is compared against when no row came back — the same work, always. */
export const DUMMY_RESERVATION_ID = '00000000-0000-4000-8000-000000000000';

export type LimitOutcome = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface GuestLookupPorts {
  /** One attempt counted against `key`; over the limit answers ok false with the wait. */
  limit(key: string, limit: number, windowSeconds: number): Promise<LimitOutcome>;
  /** The GUEST rows under this reference — { providerBookingId, bookingType 'guest', userId null } — ids only. */
  guestRowsByReference(reference: string): Promise<Array<{ id: string }>>;
}

export type GuestLookupAnswer =
  | { status: 200; reservationId: string }
  | { status: 400 | 404; error: string }
  | { status: 429; error: string; retryAfterSeconds: number };

const notOpened = (): GuestLookupAnswer => ({ status: 404, error: GUEST_WORDS.notOpened });

export async function openGuestSession(ports: GuestLookupPorts, input: { ip: string | null; body: unknown; key: Buffer }): Promise<GuestLookupAnswer> {
  // 1. No IP → the one failure answer: nothing to count the attempt against.
  if (input.ip === null || input.ip.length === 0) return notOpened();

  // 2. The shapes.
  const body = input.body !== null && typeof input.body === 'object' ? (input.body as Record<string, unknown>) : {};
  const reference = typeof body.reference === 'string' ? body.reference : null;
  const code = parseManageCode(body.code);
  if (reference === null || !REFERENCE_SHAPE.test(reference) || code === null) return { status: 400, error: GUEST_WORDS.badShape };

  // 3. Both limits, before any read.
  const byIp = await ports.limit(`guest-ip:${input.ip}`, GUEST_LIMITS.ip.limit, GUEST_LIMITS.ip.windowSeconds);
  if (!byIp.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byIp.retryAfterSeconds };
  const byReference = await ports.limit(`guest-ref:${reference}`, GUEST_LIMITS.reference.limit, GUEST_LIMITS.reference.windowSeconds);
  if (!byReference.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byReference.retryAfterSeconds };

  // 4. Every row compared, in constant time; one dummy compare when there is none.
  const rows = await ports.guestRowsByReference(reference);
  const matched: string[] = [];
  for (const row of rows) {
    if (codesMatch(manageCode(input.key, row.id), code)) matched.push(row.id);
  }
  if (rows.length === 0) codesMatch(manageCode(input.key, DUMMY_RESERVATION_ID), code);

  // 5. Exactly one → open it; anything else → the one 404.
  return matched.length === 1 ? { status: 200, reservationId: matched[0] } : notOpened();
}

/** A guest reservation as the booking read selects it. */
export interface GuestReservationRow extends ReceiptReservation {
  arrival_id: string | null;
  /** GUEST-02: the offer reads the provider and the stored terms. */
  provider: string;
  cancellationPolicyJson: unknown;
}

/** GUEST-02: what the page needs to open the one cancel dialog. */
export interface GuestCancelOffer {
  lane: 'hotel' | 'flight';
  /** The row's stored cancellationPolicyJson, verbatim (a hotel's terms at booking). */
  policy: unknown;
  /** YYYY-MM-DD, or null. */
  checkIn: string | null;
  checkOut: string | null;
}

/** YYYY-MM-DD of a DATE-column value (a Date or its string), or null. */
const ymd = (d: Date | string | null): string | null => (d === null ? null : typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/**
 * GUEST-02 (2026-09-30): Cancel is offered exactly when the flow would take the booking —
 * provider liteapi, status confirmed, and a hotel or a flight through the one reader — never
 * a control the flow must refuse (a retired provider's history row, an activity, a booking
 * already cancelled or awaiting the airline). Pure.
 */
export function guestCancelOffer(row: GuestReservationRow): GuestCancelOffer | null {
  if (row.provider !== 'liteapi' || row.status !== 'confirmed') return null;
  const { type } = reservationIdentity(row);
  if (type !== 'hotel' && type !== 'flight') return null;
  return { lane: type, policy: row.cancellationPolicyJson, checkIn: ymd(row.checkinDate), checkOut: ymd(row.checkoutDate) };
}

export interface GuestBookingPorts {
  /** The session's reservation, still a guest's — { id, bookingType 'guest', userId null } — or null. */
  reservation(id: string): Promise<GuestReservationRow | null>;
  /** Its landed book answer — { id: arrival_id, user_id null, guest_ref booking:<reference> } — or null. */
  bookArrival(arrivalId: string, providerBookingId: string): Promise<ReceiptArrival | null>;
  /** Its latest landed booking read — liteapi, booking_read, read:<reference>, user_id null, guest_ref booking:<reference>, arrived DESC — or null. */
  latestRead(providerBookingId: string): Promise<ReceiptArrival | null>;
  /** The refunds and fees the vendor stated for it — no settlement column. */
  moneyEvents(reservationId: string): Promise<GuestMoneyEvent[]>;
}

export type GuestBookingAnswer =
  | { status: 200; receipt: GuestReceipt; cancel: GuestCancelOffer | null }
  | { status: 401 | 404; error: string };

export async function guestBooking(ports: GuestBookingPorts, input: { cookie: string | null; key: Buffer; now: number }): Promise<GuestBookingAnswer> {
  const reservationId = verifyGuestSession(input.key, input.cookie, input.now);
  if (reservationId === null) return { status: 401, error: GUEST_WORDS.sessionEnded };
  const reservation = await ports.reservation(reservationId);
  if (reservation === null) return { status: 404, error: GUEST_WORDS.notOpened };
  const bookArrival = reservation.arrival_id === null ? null : await ports.bookArrival(reservation.arrival_id, reservation.providerBookingId);
  const latestReadArrival = await ports.latestRead(reservation.providerBookingId);
  const moneyEvents = await ports.moneyEvents(reservation.id);
  return { status: 200, receipt: guestReceiptOf({ reservation, bookArrival, latestReadArrival, moneyEvents }), cancel: guestCancelOffer(reservation) };
}

/** GUEST-02: the cancel's own limits — 10 per IP, then 5 per reservation, per 15 minutes. */
export const GUEST_CANCEL_LIMITS = {
  ip: { limit: 10, windowSeconds: 900 },
  reservation: { limit: 5, windowSeconds: 900 },
} as const;

export interface GuestCancelPorts<Row> {
  /** One attempt counted against `key`; over the limit answers ok false with the wait. */
  limit(key: string, limit: number, windowSeconds: number): Promise<LimitOutcome>;
  /** The session's reservation, still a guest's, on a cancel lane — { id, bookingType 'guest', userId null, provider in liteapi | duffel } — or null. */
  reservation(id: string): Promise<Row | null>;
}

export type GuestCancelGateAnswer<Row> =
  | { status: 200; ip: string; row: Row }
  | { status: 401 | 404; error: string }
  | { status: 429; error: string; retryAfterSeconds: number };

export async function guestCancelGate<Row>(ports: GuestCancelPorts<Row>, input: { cookie: string | null; ip: string | null; key: Buffer; now: number }): Promise<GuestCancelGateAnswer<Row>> {
  // 1. The session first — none or invalid is 401, before anything is counted or read.
  const reservationId = verifyGuestSession(input.key, input.cookie, input.now);
  if (reservationId === null) return { status: 401, error: GUEST_WORDS.sessionEnded };

  // 2. No IP → the one 404: nothing to count the attempt against.
  if (input.ip === null || input.ip.length === 0) return { status: 404, error: GUEST_WORDS.notOpened };

  // 3. Both limits, the cancel's own buckets, before any read.
  const byIp = await ports.limit(`guest-cancel-ip:${input.ip}`, GUEST_CANCEL_LIMITS.ip.limit, GUEST_CANCEL_LIMITS.ip.windowSeconds);
  if (!byIp.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byIp.retryAfterSeconds };
  const byReservation = await ports.limit(`guest-cancel:${reservationId}`, GUEST_CANCEL_LIMITS.reservation.limit, GUEST_CANCEL_LIMITS.reservation.windowSeconds);
  if (!byReservation.ok) return { status: 429, error: GUEST_WORDS.tooMany, retryAfterSeconds: byReservation.retryAfterSeconds };

  // 4. The session's reservation, still a guest's — or the one 404.
  const row = await ports.reservation(reservationId);
  if (row === null) return { status: 404, error: GUEST_WORDS.notOpened };

  // 5. The row, for the one cancel flow.
  return { status: 200, ip: input.ip, row };
}
