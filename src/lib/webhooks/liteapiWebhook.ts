/**
 * STATUS-01 (2026-09-26) — THE LITEAPI WEBHOOK, READ AS A HINT.
 *
 * The pure half of POST /api/webhooks/liteapi: what the vendor documents about a
 * delivery, and the three decisions the receiver makes from it BEFORE it touches
 * the vendor or a row. Nothing here applies a payload field to a reservation —
 * the receiver only ever learns WHICH booking to re-read.
 *
 * THE DOCUMENTED DELIVERY (docs.liteapi.travel/docs/webhooks, "Webhook Events"):
 *   { event_id, event_name, request, response, sandbox } — request and response
 *   are the vendor's own call and answer as STRINGIFIED JSON. The endpoint is
 *   registered in the dashboard (Developer tools → Webhooks → Register Endpoint)
 *   with an "Authentication Token" the vendor sends "as the value for
 *   `authorization` in the header" of every delivery. Delivery is at-least-once,
 *   so the same event_id may arrive more than once. No signature (HMAC) is
 *   documented; the token is the whole authentication, compared in constant time.
 *
 * THE EVENT NAMES the vendor documents, by lane. An event outside this list is
 * landed and recorded 'unknown_event' — never guessed at.
 */
import { timingSafeEqual } from 'node:crypto';

export const LITEAPI_HOTEL_EVENTS = [
  'booking.prebook',
  'booking.book',
  'booking.cancel',
  'booking.book.hotelConfirmationNumber',
  'booking.checkinInstruction',
  'booking.prebook_error',
  'booking.book_error',
  'booking.cancel_error',
  'booking.rebook.rfn',
  'booking.rebook.nrfn',
  'booking.amendment',
  'booking.amendment.relocation',
  'booking.refund',
  'booking.compensation',
] as const;

export const LITEAPI_FLIGHT_EVENTS = [
  'flight.prebook',
  'flight.attachServices',
  'flight.book.created',
  'flight.book.pending.confirmation',
  'flight.book.confirmed',
  'flight.book.cancelled',
  'flight.book.failed',
  'flight.book.expired',
] as const;

export type LiteApiWebhookEvent = (typeof LITEAPI_HOTEL_EVENTS)[number] | (typeof LITEAPI_FLIGHT_EVENTS)[number];

/** The lane a documented event belongs to; null for a name the vendor does not document. */
export function laneOfWebhookEvent(eventName: string): 'hotel' | 'flight' | null {
  if ((LITEAPI_HOTEL_EVENTS as readonly string[]).includes(eventName)) return 'hotel';
  if ((LITEAPI_FLIGHT_EVENTS as readonly string[]).includes(eventName)) return 'flight';
  return null;
}

/** The delivery's own token against ours — the same length and every byte equal, in constant time. Never a prefix match, never case-folded. */
export function constantTimeEqual(given: string, expected: string): boolean {
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type ParsedDelivery =
  | { ok: true; eventId: string; eventName: string; response: unknown; sandbox: boolean | null; payload: Record<string, unknown> }
  | { ok: false; error: 'not_json' | 'not_an_object' | 'event_id_missing' };

const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);

/** The delivery bytes → the documented envelope. `response` is the vendor's answer, parsed when it is the documented string, taken as is when it is already an object; null when neither. */
export function parseLiteApiWebhookDelivery(bytes: Buffer): ParsedDelivery {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { ok: false, error: 'not_json' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'not_an_object' };
  const payload = parsed as Record<string, unknown>;
  const eventId = nonEmpty(payload.event_id);
  if (eventId === null) return { ok: false, error: 'event_id_missing' };
  const eventName = nonEmpty(payload.event_name) ?? '';
  let response: unknown = null;
  if (typeof payload.response === 'string') {
    try { response = JSON.parse(payload.response); } catch { response = null; }
  } else if (payload.response && typeof payload.response === 'object') {
    response = payload.response;
  }
  return { ok: true, eventId, eventName, response, sandbox: typeof payload.sandbox === 'boolean' ? payload.sandbox : null, payload };
}

/**
 * The booking the event is ABOUT — the only thing read from the vendor's answer
 * inside the delivery, and only to find OUR row. A hotel answer carries the
 * booking object at data (or flat at the root, as the book route's
 * bookingObjectOf admits); a flight answer carries data[0].booking. Anything
 * else is null: the receiver records 'unknown_booking' and calls no vendor.
 */
export function resolveWebhookBookingId(eventName: string, response: unknown): string | null {
  const lane = laneOfWebhookEvent(eventName);
  if (lane === null || !response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;
  const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
  if (lane === 'hotel') {
    return nonEmpty(obj(r.data)?.bookingId) ?? nonEmpty(r.bookingId);
  }
  const first = Array.isArray(r.data) ? obj(r.data[0]) : null;
  return nonEmpty(obj(first?.booking)?.bookingId) ?? nonEmpty(obj(r.data)?.bookingId) ?? nonEmpty(r.bookingId);
}
