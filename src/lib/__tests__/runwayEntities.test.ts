import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNWAY_SETUP_LINE, attributeBurn, entityFigure, resolveOperatingEntities } from '../runway/entities';

// SELL-04 — the runway's operating entities are the VIEWER'S OWN; a viewer with none gets the
// declared setup line, never an `unattributed` bucket. Hermetic: entity rows and burn maps injected.

const A = [
  { id: 'a-personal', entity_type: 'personal', is_default: true },
  { id: 'a-business', entity_type: 'sole_prop', is_default: false },
  { id: 'a-trading', entity_type: 'trading', is_default: false },
];
const B = [
  { id: 'b-personal-old', entity_type: 'personal', is_default: false },
  { id: 'b-personal', entity_type: 'personal', is_default: true },
];

test('resolve: the default personal entity, the sole-prop, the trading one — each the viewer\'s own, or null', () => {
  assert.deepEqual(resolveOperatingEntities(A), { personalId: 'a-personal', businessId: 'a-business', tradingId: 'a-trading' });
  assert.deepEqual(resolveOperatingEntities(B), { personalId: 'b-personal', businessId: null, tradingId: null });
  assert.deepEqual(resolveOperatingEntities([{ id: 'p', entity_type: 'personal', is_default: false }]), { personalId: 'p', businessId: null, tradingId: null }, 'no default → the first personal');
  assert.deepEqual(resolveOperatingEntities([]), { personalId: null, businessId: null, tradingId: null });
  assert.deepEqual(resolveOperatingEntities([{ id: 't', entity_type: 'trading', is_default: true }]), { personalId: null, businessId: null, tradingId: 't' }, 'a trading-only viewer has no operating entity');
});

test('two users never mix: each attribution reads only its own ids; the other user\'s ids can only ever be `unattributed`, never Personal or Business', () => {
  const entsA = resolveOperatingEntities(A);
  const entsB = resolveOperatingEntities(B);
  const burnA = { 'a-personal': { exp: 300, rev: 100 }, 'a-business': { exp: 50, rev: 500 } };
  const burnB = { 'b-personal': { exp: 90, rev: 0 } };
  const a = attributeBurn(burnA, entsA, 3);
  const b = attributeBurn(burnB, entsB, 3);
  assert.deepEqual(a.personal, entityFigure({ exp: 300, rev: 100 }, 3));
  assert.deepEqual(a.business, entityFigure({ exp: 50, rev: 500 }, 3));
  assert.equal(a.unattributed, null);
  assert.equal(a.setup, null);
  assert.deepEqual(b.personal, entityFigure({ exp: 90, rev: 0 }, 3));
  assert.equal(b.business, null, 'user B has no business entity — declared null, never a zero');
  assert.equal(b.unattributed, null);
  // if user A's rows ever reached user B's attribution, they could only land as `unattributed` — never as B's own
  const leaked = attributeBurn({ ...burnB, ...burnA }, entsB, 3);
  assert.deepEqual(leaked.personal, b.personal);
  assert.equal(leaked.business, null);
  assert.deepEqual(leaked.unattributed, entityFigure({ exp: 350, rev: 600 }, 3));
  // the invariant: personal + business + unattributed === the combined total
  const total = (x: ReturnType<typeof attributeBurn>) => (x.personal?.netBurnTotal ?? 0) + (x.business?.netBurnTotal ?? 0) + (x.unattributed?.netBurnTotal ?? 0);
  assert.equal(total(a), 300 - 100 + 50 - 500);
  assert.equal(total(leaked), 90 + 300 - 100 + 50 - 500);
});

test('a viewer with no operating entity gets the declared setup line — and no unattributed bucket, whatever rows exist', () => {
  const none = attributeBurn({}, resolveOperatingEntities([]), 3);
  assert.deepEqual(none, { personal: null, business: null, unattributed: null, setup: RUNWAY_SETUP_LINE });
  const tradingOnly = attributeBurn({ stray: { exp: 10, rev: 0 } }, resolveOperatingEntities([{ id: 't', entity_type: 'trading', is_default: true }]), 3);
  assert.deepEqual(tradingOnly, { personal: null, business: null, unattributed: null, setup: RUNWAY_SETUP_LINE });
  assert.match(RUNWAY_SETUP_LINE, /Set up your entity/);
  // with an entity present, a stray entity's rows are surfaced, never dropped
  const stray = attributeBurn({ 'a-personal': { exp: 1, rev: 0 }, legacy: { exp: 5, rev: 2 } }, resolveOperatingEntities(A), 6);
  assert.deepEqual(stray.unattributed, entityFigure({ exp: 5, rev: 2 }, 6));
  assert.equal(stray.setup, null);
  // zero rows on the other entity → no bucket
  assert.equal(attributeBurn({ 'a-personal': { exp: 1, rev: 0 } }, resolveOperatingEntities(A), 6).unattributed, null);
});
