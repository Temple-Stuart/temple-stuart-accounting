/**
 * REBUILD-01 PR-4 — STRIPE WEBHOOK EVENTS LAND RAW-FIRST.
 *
 * The deck's step 2 puts card money on Stripe; the webhook route verified the
 * signature, acted on the event, and dropped the raw body. Now, per delivery:
 *
 *   verifyStripeDelivery — the SDK's constructEvent over the exact bytes; a
 *                          missing or bad signature throws
 *                          StripeSignatureError BEFORE anything lands (the
 *                          route answers Stripe's expected 400).
 *   landStripeEvent      — inside the caller's transaction: landResponse (the
 *                          verified raw body bytes, http_status 200 as
 *                          received; asked = arrived = when the delivery hit
 *                          us) → redactClientSecrets on a copy of the event
 *                          (every `client_secret` key at any depth blanked,
 *                          each path declared) → landObjects one arrival
 *                          (stripe · event, their_id = event.id, kind event by
 *                          the rule book) → the handler runs FROM THE ARRIVAL
 *                          PAYLOAD read back from the table, never from the
 *                          request → markRead. A redelivered event (same id,
 *                          same fingerprint) is already_landed and the handler
 *                          does NOT re-run — the store's UNIQUE is the dedup; a
 *                          changed redelivery (same id, new fingerprint) is
 *                          corrected and the handler runs.
 *   runStripeDelivery    — verify, then the transaction; a throw inside rolls
 *                          the delivery back and comes out declared.
 *
 * WHO OWNS AN EVENT: the caller's userFor port (the route: the session's
 * metadata.userId, else users.stripeCustomerId = the object's customer). No
 * user → the arrival lands with guest_ref = the customer id (guestRefFor), or
 * `event:<id>` when the object carries no customer — declared, never dropped.
 *
 * THE ONE SECRET: Stripe's own docs on `client_secret` (PaymentIntent,
 * SetupIntent — "It should not be stored, logged, or exposed to anyone other
 * than the customer"; the SDK carries the same words on Source and on an
 * Invoice's confirmation_secret). The redaction is by key name at any depth,
 * so every carrier is covered; the paths blanked ride `redactions`.
 *
 * Pure over ports (LandingDb, verify, userFor, handle) so node:test drives it
 * with the real SDK's signing helper and a fake store.
 */
import type { ArrivalOutcome, JsonObject, LandingDb } from './land';
import { landObjects, landResponse, markRead } from './land';

export const STRIPE = 'stripe';
export const STRIPE_EVENT = 'event';

/** The Stripe event fields the landing reads; the SDK's Stripe.Event satisfies it (its data.object is a typed union, so only `customer` is named here). */
export interface StripeEventLike {
  id: string;
  type: string;
  account?: string | null;
  data: { object: object };
}

export class StripeSignatureError extends Error {
  constructor(reason: string) {
    super(`stripe webhook: ${reason} — nothing landed`);
    this.name = 'StripeSignatureError';
  }
}

export interface StripeDelivery {
  rawBody: Buffer;
  signature: string | null;
  secret: string | null | undefined;
  receivedAt: Date;
}

/** constructEvent, or throw StripeSignatureError. Runs before any transaction: a bad delivery costs no row. */
export function verifyStripeDelivery<E extends StripeEventLike>(
  delivery: StripeDelivery,
  verify: (rawBody: Buffer, signature: string, secret: string) => E,
): E {
  if (!delivery.signature) throw new StripeSignatureError('missing stripe-signature header');
  if (!delivery.secret) throw new StripeSignatureError('STRIPE_WEBHOOK_SECRET is not set');
  try {
    return verify(delivery.rawBody, delivery.signature, delivery.secret);
  } catch (e) {
    throw new StripeSignatureError(`signature verification failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A deep copy with every `client_secret` (any depth, non-null) set to null; the paths blanked, in document order. */
export function redactClientSecrets(payload: JsonObject): { payload: JsonObject; redactions: string[] } {
  const redactions: string[] = [];
  const walk = (v: unknown, path: string): unknown => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`));
    if (!isPlainObject(v)) return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const here = path ? `${path}.${k}` : k;
      if (k === 'client_secret' && x !== null && x !== undefined) { out[k] = null; redactions.push(here); continue; }
      out[k] = walk(x, here);
    }
    return out;
  };
  return { payload: walk(payload, '') as JsonObject, redactions };
}

/** The customer id the event's object carries (a string or an expanded object), or null. */
export function customerIdOf(event: StripeEventLike): string | null {
  const c = (event.data.object as { customer?: unknown }).customer;
  if (typeof c === 'string' && c) return c;
  if (isPlainObject(c) && typeof c.id === 'string') return c.id;
  return null;
}

/** With no user matched: the customer id, or the event's own id when the object names no customer — declared, never dropped. */
export function guestRefFor(event: StripeEventLike): string {
  return customerIdOf(event) ?? `event:${event.id}`;
}

export interface StripeLandingPorts<E extends StripeEventLike> {
  landing: LandingDb;
  /** Who the event belongs to; null → the arrival lands as a guest (guestRefFor). */
  userFor(event: E): Promise<string | null>;
  /** The existing handler — runs from the arrival payload, once per new arrival (landed or corrected), never on already_landed. */
  handle(event: E, outcome: ArrivalOutcome): Promise<void>;
  now?: () => Date;
}

export interface StripeLandingResult {
  eventId: string;
  type: string;
  outcome: ArrivalOutcome;
  /** The paths blanked before landing. */
  redactions: string[];
  /** Whether the handler ran for this delivery. */
  handled: boolean;
  userId: string | null;
  guestRef: string | null;
}

/** Inside the caller's transaction: land the bytes, land the (redacted) event, run the handler from the table, mark read. Throws to roll the delivery back. */
export async function landStripeEvent<E extends StripeEventLike>(
  ports: StripeLandingPorts<E>,
  input: { rawBody: Buffer; event: E; receivedAt: Date },
): Promise<StripeLandingResult> {
  const { event } = input;
  const userId = await ports.userFor(event);
  const guestRef = userId === null ? guestRefFor(event) : null;
  const response = await landResponse(ports.landing, {
    provider: STRIPE,
    resource: STRIPE_EVENT,
    userId,
    guestRef,
    httpStatus: 200,
    body: input.rawBody,
    asked: input.receivedAt,
    arrived: input.receivedAt,
  });
  const redacted = redactClientSecrets(event as unknown as JsonObject);
  const landed = await landObjects(ports.landing, {
    provider: STRIPE,
    resource: STRIPE_EVENT,
    connection: event.account ?? null,
    userId,
    guestRef,
    responseId: response.id,
    asked: input.receivedAt,
    arrived: input.receivedAt,
    objects: [{ theirId: event.id, payload: redacted.payload, redactions: redacted.redactions }],
  });
  const row = landed.rows[0];
  if (!row) throw new Error(`stripe webhook: ${event.id} landed no row — the table is not answering`);
  let handled = false;
  if (row.outcome !== 'already_landed') {
    // The handler reads the arrival, never the request.
    await ports.handle(row.payload as E, row.outcome);
    handled = true;
    await markRead(ports.landing, [row.id], (ports.now ?? (() => new Date()))());
  }
  return { eventId: event.id, type: event.type, outcome: row.outcome, redactions: redacted.redactions, handled, userId, guestRef };
}

export interface DeliveryClient {
  $transaction<T>(fn: (tx: unknown) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T>;
}

export type StripeDeliveryResult =
  | { ok: true; result: StripeLandingResult }
  | { ok: false; failure: 'signature'; error: StripeSignatureError }
  | { ok: false; failure: 'landing'; error: unknown };

/** Verify (no row), then one transaction: land + handle + mark read. A throw inside rolls the delivery back and is declared. */
export async function runStripeDelivery<E extends StripeEventLike>(
  client: DeliveryClient,
  delivery: StripeDelivery,
  verify: (rawBody: Buffer, signature: string, secret: string) => E,
  ports: (tx: unknown) => StripeLandingPorts<E>,
): Promise<StripeDeliveryResult> {
  let event: E;
  try {
    event = verifyStripeDelivery(delivery, verify);
  } catch (e) {
    return { ok: false, failure: 'signature', error: e as StripeSignatureError };
  }
  try {
    const result = await client.$transaction(
      (tx) => landStripeEvent(ports(tx), { rawBody: delivery.rawBody, event, receivedAt: delivery.receivedAt }),
      { maxWait: 10_000, timeout: 120_000 },
    );
    return { ok: true, result };
  } catch (error) {
    return { ok: false, failure: 'landing', error };
  }
}
