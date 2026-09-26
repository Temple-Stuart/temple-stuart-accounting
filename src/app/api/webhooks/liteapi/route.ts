/**
 * STATUS-01 (2026-09-26) — POST /api/webhooks/liteapi: A WEBHOOK IS A HINT. THE GET IS THE TRUTH.
 *
 * The vendor POSTs a delivery here for every booking event it documents. NO
 * FIELD OF THE PAYLOAD IS EVER APPLIED TO A RESERVATION. The receiver:
 *
 *   1. rate-limits per IP in its own bucket (liteapi-webhook:<ip>) — a refusal
 *      is a 429 with nothing landed; delivery is at-least-once, the vendor retries;
 *   2. authenticates: LITEAPI_WEBHOOK_TOKEN must be set (absent → 500 by name,
 *      nothing landed) and the `authorization` header must EQUAL it, compared in
 *      constant time (absent or wrong → 401, nothing landed, the header's SHAPE
 *      logged, never its value). There is no unauthenticated mode;
 *   3. LANDS THE BYTES exactly as received (provider_responses, liteapi · webhook)
 *      BEFORE anything is parsed. From here on the answer is 200: the delivery is
 *      on record and can be replayed from the table;
 *   4. parses the documented envelope — no event_id → 400 (the bytes are landed);
 *      one arrival per delivery (liteapi · webhook, their_id = event_id); an
 *      event_id already acted on → a 'duplicate' row, 200, no vendor call;
 *   5. resolves WHICH booking the event is about, finds OUR row by
 *      providerBookingId — none → 'unknown_booking', 200, no vendor call; an
 *      event name the vendor does not document → 'unknown_event', 200;
 *   6. re-reads the vendor with the lane's GET (metered under 'liteapi'), lands
 *      that answer, and applies FROM THAT ANSWER through the one apply leaf
 *      (src/lib/reservations/vendorRead.ts) — 'applied' | 'unchanged' |
 *      'read_failed', 200.
 *
 * Every outcome after step 3 is one webhook_events row pointing at the landed
 * bytes (arrivalId NOT NULL). The dedupe is the table's partial UNIQUE index
 * over the rows that were not themselves duplicates: two deliveries of one
 * event racing can both read the vendor (idempotently) but only one can record
 * that it acted; the other lands as 'duplicate'.
 *
 * PUBLIC (middleware PUBLIC_PATHS): the vendor holds no session. The token IS
 * the gate, and it is checked before a byte is stored.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { rateLimit, RateLimitError } from '@/lib/rateLimit';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { landLiteApiWebhookBytes, landLiteApiWebhookEvent } from '@/lib/arrivals/liteapiBooking';
import { constantTimeEqual, laneOfWebhookEvent, parseLiteApiWebhookDelivery, resolveWebhookBookingId } from '@/lib/webhooks/liteapiWebhook';
import { readAndApplyReservation, VENDOR_READ_SELECT } from '@/lib/reservations/vendorRead';

export const dynamic = 'force-dynamic';

type Outcome = 'applied' | 'unchanged' | 'unknown_booking' | 'unknown_event' | 'duplicate' | 'read_failed';

/** One row per delivery. A second ACTED row for the same event_id is refused by the partial unique index (P2002) and recorded as 'duplicate' instead. */
async function recordEvent(data: { eventId: string; eventType: string; bookingId: string | null; arrivalId: string; receivedAt: Date; actedAt: Date | null; outcome: Outcome }): Promise<Outcome> {
  try {
    await prisma.webhook_events.create({ data: { provider: 'liteapi', ...data } });
    return data.outcome;
  } catch (err) {
    if (data.outcome !== 'duplicate' && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await prisma.webhook_events.create({ data: { provider: 'liteapi', ...data, actedAt: null, outcome: 'duplicate' } });
      return 'duplicate';
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const receivedAt = new Date();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // ── 1. THE RATE LIMIT — its own bucket, nothing landed on refusal ──────────
  try {
    await rateLimit(`liteapi-webhook:${ip}`, { limit: 120, windowSeconds: 60 });
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.error('[LiteAPI webhook] rate limited — nothing landed:', { ip, retryAfterSeconds: err.retryAfterSeconds });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } });
    }
    return failClosedResponse('LiteAPI webhook rate limit', 'Webhook refused', err, 503);
  }

  // ── 2. THE TOKEN — required, equal, constant time; nothing landed otherwise ─
  const expected = process.env.LITEAPI_WEBHOOK_TOKEN;
  if (typeof expected !== 'string' || expected.length === 0) {
    console.error('[LiteAPI webhook] LITEAPI_WEBHOOK_TOKEN is not set — the endpoint cannot authenticate a delivery; nothing landed');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }
  const given = request.headers.get('authorization');
  if (given === null || !constantTimeEqual(given, expected)) {
    console.error('[LiteAPI webhook] unauthorized — nothing landed:', {
      ip,
      authorization: given === null ? 'absent' : `present, ${given.length} chars${/^Bearer /i.test(given) ? ', Bearer-prefixed' : ''}`,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 3. THE BYTES — landed before any parse; from here the answer is 200 ────
  const body = Buffer.from(await request.arrayBuffer());
  let responseId: string;
  try {
    ({ responseId } = await prisma.$transaction((tx) => landLiteApiWebhookBytes({ landing: prismaLanding(tx) }, { body, receivedAt })));
  } catch (err) {
    // Nothing is on record: a non-2xx makes the vendor redeliver.
    return failClosedResponse('LiteAPI webhook landing', 'Webhook not recorded', err, 500);
  }

  // ── 4. THE ENVELOPE ─────────────────────────────────────────────────────────
  const delivery = parseLiteApiWebhookDelivery(body);
  if (!delivery.ok) {
    console.error('[LiteAPI webhook] delivery is not the documented envelope — bytes landed, not acted on:', { responseId, error: delivery.error, bytes: body.length });
    return NextResponse.json({ error: delivery.error, landed: responseId }, { status: 400 });
  }
  const { eventId, eventName } = delivery;
  const bookingId = resolveWebhookBookingId(eventName, delivery.response);

  try {
    const { arrivalId } = await prisma.$transaction((tx) =>
      landLiteApiWebhookEvent({ landing: prismaLanding(tx), log: (line) => console.log(line) }, { responseId, receivedAt, eventId, payload: delivery.payload }),
    );
    const record = (outcome: Outcome, actedAt: Date | null) => recordEvent({ eventId, eventType: eventName, bookingId, arrivalId, receivedAt, actedAt, outcome });

    const acted = await prisma.webhook_events.findFirst({ where: { provider: 'liteapi', eventId, outcome: { not: 'duplicate' } }, select: { id: true, outcome: true } });
    if (acted !== null) {
      await record('duplicate', null);
      console.log(`[LiteAPI webhook] ${eventName} ${eventId}: duplicate of ${acted.id} (${acted.outcome}) — no vendor call`);
      return NextResponse.json({ outcome: 'duplicate', eventId }, { status: 200 });
    }

    // ── 5. WHICH BOOKING — ours, by providerBookingId, or nothing ─────────────
    if (laneOfWebhookEvent(eventName) === null) {
      await record('unknown_event', null);
      console.log(`[LiteAPI webhook] ${eventName || '(no event_name)'} ${eventId}: an event the vendor does not document — landed, 'unknown_event', no vendor call`);
      return NextResponse.json({ outcome: 'unknown_event', eventId }, { status: 200 });
    }
    const row = bookingId === null
      ? null
      : await prisma.reservations.findFirst({ where: { provider: 'liteapi', providerBookingId: bookingId }, select: VENDOR_READ_SELECT });
    if (row === null) {
      await record('unknown_booking', null);
      console.log(`[LiteAPI webhook] ${eventName} ${eventId}: ${bookingId === null ? 'no booking id in the delivery' : `booking ${bookingId} is not ours`} — landed, 'unknown_booking', no vendor call`);
      return NextResponse.json({ outcome: 'unknown_booking', eventId }, { status: 200 });
    }

    // ── 6. THE TRUTH — the GET, landed and applied; never the payload ─────────
    const read = await readAndApplyReservation(row, { source: 'webhook' });
    if (read.outcome === 'read_failed') {
      console.error(`[LiteAPI webhook] ${eventName} ${eventId}: ${read.reason}`);
      const outcome = await record('read_failed', null);
      return NextResponse.json({ outcome, eventId, reservationId: row.id }, { status: 200 });
    }
    const outcome = await record(read.outcome, new Date());
    return NextResponse.json({ outcome, eventId, reservationId: row.id, changes: read.changes, emails: read.emails.map((e) => ({ kind: e.kind, sent: e.sent })) }, { status: 200 });
  } catch (err) {
    // The bytes are on record (responseId); the rest failed. 200 — a redelivery would land the same bytes again; the replay is from the table.
    console.error('[LiteAPI webhook] FAILED after the bytes landed — replay from provider_responses:', { responseId, eventId, eventName, error: err instanceof Error ? `${err.name}: ${err.message}` : err });
    return NextResponse.json({ outcome: 'read_failed', eventId, landed: responseId }, { status: 200 });
  }
}
