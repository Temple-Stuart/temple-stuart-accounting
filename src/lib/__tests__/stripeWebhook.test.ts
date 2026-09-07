import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { fingerprintOf, sha256 } from '../arrivals/land';
import { STRIPE, STRIPE_EVENT, StripeSignatureError, customerIdOf, guestRefFor, landStripeEvent, redactClientSecrets, runStripeDelivery, verifyStripeDelivery, type StripeEventLike } from '../arrivals/stripeWebhook';
import { kindOf } from '../providers';
import { FakeLanding, snapshotClient } from './fakeLanding';

// REBUILD-01 PR-4 — Stripe webhook events land raw-first. Hermetic: the real Stripe SDK signs
// and verifies the fixture offline (generateTestHeaderString / constructEvent); the store is
// the shared fake; the handler is a recorder.

const SECRET = 'whsec_test_rebuild01_pr4';
const stripe = new Stripe('sk_test_placeholder', { apiVersion: '2026-01-28.clover' });
const NOW = new Date('2026-09-07T15:00:00Z');

/** A payment_intent.succeeded delivery — the one event family that carries client_secret. */
const fixture = (over: Record<string, unknown> = {}) => ({
  id: 'evt_1PR4test0001',
  object: 'event',
  api_version: '2026-01-28.clover',
  created: 1757257200,
  livemode: false,
  pending_webhooks: 1,
  request: { id: 'req_abc', idempotency_key: null },
  type: 'payment_intent.succeeded',
  data: {
    object: {
      id: 'pi_3PR4test', object: 'payment_intent', amount: 12000, currency: 'usd', status: 'succeeded',
      customer: 'cus_PR4customer', client_secret: 'pi_3PR4test_secret_DONOTSTORE',
      metadata: { userId: 'u_alex' },
      ...over,
    },
  },
});
const sign = (body: string) => stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
const verify = (rawBody: Buffer, signature: string, secret: string) => stripe.webhooks.constructEvent(rawBody, signature, secret) as unknown as StripeEventLike;
const delivery = (body: string, signature = sign(body)) => ({ rawBody: Buffer.from(body, 'utf8'), signature, secret: SECRET, receivedAt: NOW });

class Recorder {
  calls: Array<{ event: StripeEventLike; outcome: string }> = [];
  constructor(public userId: string | null = 'u_alex', private throwOn: string | null = null) {}
  ports(landing: FakeLanding) {
    return {
      landing,
      userFor: async () => this.userId,
      handle: async (event: StripeEventLike, outcome: string) => {
        if (this.throwOn === event.id) throw new Error('handler: Invalid `db.users.update()` invocation');
        this.calls.push({ event, outcome });
      },
      now: () => NOW,
    };
  }
}

test('the rule book names the feed: stripe · event → event', () => {
  assert.equal(kindOf(STRIPE, STRIPE_EVENT), 'event');
});

test('a signed fixture lands one response (the exact bytes, sha256) and one arrival (their_id = event.id, kind event, client_secret redacted and declared); the handler runs once, from the table, and never sees the secret', async () => {
  const landing = new FakeLanding();
  const rec = new Recorder();
  const body = JSON.stringify(fixture());
  const out = await runStripeDelivery(snapshotClient(landing), delivery(body), verify, () => rec.ports(landing));
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.deepEqual(out.result, { eventId: 'evt_1PR4test0001', type: 'payment_intent.succeeded', outcome: 'landed', redactions: ['data.object.client_secret'], handled: true, userId: 'u_alex', guestRef: null });
  // the wire: exact bytes as signed (the secret is inside them — the ruling keeps the wire exact), sha256, 200 as received
  assert.equal(landing.responses.length, 1);
  const r = landing.responses[0];
  assert.equal(r.provider, STRIPE);
  assert.equal(r.resource, STRIPE_EVENT);
  assert.equal(r.http_status, 200);
  assert.equal(r.body.toString('utf8'), body);
  assert.deepEqual(r.body_sha256, sha256(Buffer.from(body)));
  assert.equal(r.user_id, 'u_alex');
  assert.deepEqual(r.asked, NOW);
  // the arrival: redacted payload, the path declared, the book's kind
  assert.equal(landing.arrivals.size, 1);
  const a = [...landing.arrivals.values()][0];
  assert.equal(a.row.their_id, 'evt_1PR4test0001');
  assert.equal(a.row.their_id_kind, 'provider');
  assert.equal(a.row.kind, 'event');
  assert.equal(a.row.resource, STRIPE_EVENT);
  assert.deepEqual(a.row.redactions, ['data.object.client_secret']);
  assert.equal((a.row.payload as { data: { object: { client_secret: unknown } } }).data.object.client_secret, null);
  assert.equal((a.row.payload as { data: { object: { amount: number } } }).data.object.amount, 12000);
  assert.equal(a.status, 'done');
  assert.deepEqual(a.read, NOW);
  assert.equal(a.row.response_id, r.id);
  assert.equal(Buffer.compare(Buffer.from(a.row.fingerprint), fingerprintOf(redactClientSecrets(fixture() as never).payload)), 0, 'the fingerprint is over the redacted payload');
  // the handler: once, from the arrival (no secret), outcome landed
  assert.equal(rec.calls.length, 1);
  assert.equal(rec.calls[0].outcome, 'landed');
  assert.equal((rec.calls[0].event.data.object as { client_secret: unknown }).client_secret, null);
  assert.equal(rec.calls[0].event.id, 'evt_1PR4test0001');
});

test('the same delivery again → already_landed, one response more, no new arrival, and the handler is not called twice; a changed redelivery (same id, new content) → corrected and the handler runs', async () => {
  const landing = new FakeLanding();
  const rec = new Recorder();
  const client = snapshotClient(landing);
  const body = JSON.stringify(fixture());
  await runStripeDelivery(client, delivery(body), verify, () => rec.ports(landing));
  const again = await runStripeDelivery(client, delivery(body), verify, () => rec.ports(landing));
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.result.outcome, 'already_landed');
  assert.equal(again.result.handled, false);
  assert.equal(landing.responses.length, 2, 'every delivery is evidence of the delivery');
  assert.equal(landing.arrivals.size, 1, 'the store\'s UNIQUE is the dedup');
  assert.equal(rec.calls.length, 1, 'the handler did not re-run');
  // a client_secret rotates but nothing else changes → same redacted content → still the same thing
  const rotated = JSON.stringify(fixture({ client_secret: 'pi_3PR4test_secret_ROTATED' }));
  const r3 = await runStripeDelivery(client, delivery(rotated), verify, () => rec.ports(landing));
  assert.equal(r3.ok && r3.result.outcome, 'already_landed', 'the fingerprint is over the redacted payload, so a rotated secret is not a correction');
  assert.equal(rec.calls.length, 1);
  // Stripe corrects the amount → a new row, the handler runs
  const changed = JSON.stringify(fixture({ amount: 12500 }));
  const r4 = await runStripeDelivery(client, delivery(changed), verify, () => rec.ports(landing));
  assert.equal(r4.ok && r4.result.outcome, 'corrected');
  assert.equal(r4.ok && r4.result.handled, true);
  assert.equal(landing.rowsFor('evt_1PR4test0001').length, 2);
  assert.equal(rec.calls.length, 2);
  assert.equal(rec.calls[1].outcome, 'corrected');
  assert.equal((rec.calls[1].event.data.object as { amount: number }).amount, 12500);
});

test('a tampered signature, a missing header, or a missing secret lands nothing and is declared as a signature failure (the route answers 400)', async () => {
  const landing = new FakeLanding();
  const rec = new Recorder();
  const client = snapshotClient(landing);
  const body = JSON.stringify(fixture());
  // the body is altered after signing: the header signs the original, the bytes delivered are not it
  const tampered = await runStripeDelivery(client, delivery(body + ' ', sign(body)), verify, () => rec.ports(landing));
  assert.equal(tampered.ok, false);
  if (tampered.ok) return;
  assert.equal(tampered.failure, 'signature');
  assert.ok(tampered.error instanceof StripeSignatureError);
  assert.match(tampered.error.message, /signature verification failed/);
  const wrongSecret = await runStripeDelivery(client, { ...delivery(body), secret: 'whsec_other' }, verify, () => rec.ports(landing));
  assert.equal(!wrongSecret.ok && wrongSecret.failure, 'signature');
  const missing = await runStripeDelivery(client, delivery(body, null as unknown as string), verify, () => rec.ports(landing));
  assert.equal(!missing.ok && missing.failure, 'signature');
  assert.throws(() => verifyStripeDelivery({ ...delivery(body), secret: undefined }, verify), /STRIPE_WEBHOOK_SECRET is not set/);
  assert.equal(landing.responses.length, 0, 'nothing landed');
  assert.equal(landing.arrivals.size, 0);
  assert.equal(rec.calls.length, 0);
});

test('no user matches → the arrival lands as a guest with guest_ref = the customer id; no customer on the object → event:<id>; never dropped', async () => {
  const landing = new FakeLanding();
  const rec = new Recorder(null);
  const body = JSON.stringify(fixture());
  const out = await runStripeDelivery(snapshotClient(landing), delivery(body), verify, () => rec.ports(landing));
  assert.equal(out.ok && out.result.guestRef, 'cus_PR4customer');
  assert.equal(landing.responses[0].user_id, null);
  assert.equal(landing.responses[0].guest_ref, 'cus_PR4customer');
  assert.equal([...landing.arrivals.values()][0].row.guest_ref, 'cus_PR4customer');
  const noCustomer = fixture({ customer: null });
  noCustomer.id = 'evt_1PR4nocustomer';
  const out2 = await runStripeDelivery(snapshotClient(landing), delivery(JSON.stringify(noCustomer)), verify, () => rec.ports(landing));
  assert.equal(out2.ok && out2.result.guestRef, 'event:evt_1PR4nocustomer');
  assert.equal(customerIdOf({ id: 'e', type: 't', data: { object: { customer: { id: 'cus_expanded' } } } }), 'cus_expanded');
  assert.equal(guestRefFor({ id: 'e9', type: 't', data: { object: {} } }), 'event:e9');
});

test('redactClientSecrets blanks every client_secret at any depth and lists each path; a payload without one is returned equal with no redactions', () => {
  const nested = {
    id: 'evt_x', type: 'invoice.paid',
    data: {
      object: { id: 'in_1', client_secret: 'top', confirmation_secret: { client_secret: 'cs_inner', type: 'payment_intent' }, lines: [{ id: 'il_1' }, { id: 'il_2', client_secret: 'in_array' }] },
      previous_attributes: { client_secret: 'prev' },
    },
  };
  const { payload, redactions } = redactClientSecrets(nested);
  assert.deepEqual(redactions, ['data.object.client_secret', 'data.object.confirmation_secret.client_secret', 'data.object.lines[1].client_secret', 'data.previous_attributes.client_secret']);
  const p = payload as typeof nested;
  assert.equal(p.data.object.client_secret, null);
  assert.equal(p.data.object.confirmation_secret.client_secret, null);
  assert.equal(p.data.object.lines[1].client_secret, null);
  assert.equal(p.data.previous_attributes.client_secret, null);
  assert.equal(p.data.object.confirmation_secret.type, 'payment_intent', 'everything else untouched');
  assert.equal(nested.data.object.client_secret, 'top', 'the input is not mutated');
  const clean = { id: 'evt_c', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', client_secret: null } } };
  const c = redactClientSecrets(clean);
  assert.deepEqual(c.redactions, [], 'a null client_secret is not a secret');
  assert.deepEqual(c.payload, clean);
});

test('a handler throw rolls the whole delivery back — no response row, no arrival — and is declared as a landing failure', async () => {
  const landing = new FakeLanding();
  const rec = new Recorder('u_alex', 'evt_1PR4test0001');
  const client = snapshotClient(landing);
  const out = await runStripeDelivery(client, delivery(JSON.stringify(fixture())), verify, () => rec.ports(landing));
  assert.equal(out.ok, false);
  if (out.ok) return;
  assert.equal(out.failure, 'landing');
  assert.match(String((out.error as Error).message), /handler: Invalid/);
  assert.equal(landing.responses.length, 0);
  assert.equal(landing.arrivals.size, 0);
  // landStripeEvent itself, driven directly: the row lands before the handler, so the throw is the rollback's job
  const landing2 = new FakeLanding();
  await assert.rejects(landStripeEvent(rec.ports(landing2), { rawBody: Buffer.from('{}'), event: fixture() as unknown as StripeEventLike, receivedAt: NOW }), /handler: Invalid/);
  assert.equal(landing2.arrivals.size, 1, 'without a transaction the row would stay — the transaction is what makes it whole');
});
