import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bankName,
  clearItemError,
  isItemError,
  itemFailure,
  ownedItemOr404,
  rateLimitedEnvelope,
  recordItemError,
  reconcileItemHealth,
  reconnectEnvelope,
  updateModeLinkRequest,
  type ItemDb,
  type OwnedItem,
} from '../plaid/reconnect';
import { stageOk, syncEnvelope } from '../plaid/failLoud';
import { failClosed } from '../http/failClosed';
import { ValidationError } from '../errors/ValidationError';
import type { RateLimitError } from '../rateLimit';

// BANK-01 — reconnect a bank (Plaid Link update mode), and name the bank in the failure.

// Secrets and identifiers that must never reach a response body.
const ITEM_ROW_ID = 'ckitemrow0001';
const PLAID_ITEM_ID = 'plaid-item-9Xy';
const CIPHERTEXT = 'v1:ciphertext-of-the-access-token';
const ACCESS_TOKEN = 'access-sandbox-1234-secret';
const PLAID_SECRET = 'plaid-secret-abcdef';
const LEAKS = [ITEM_ROW_ID, PLAID_ITEM_ID, CIPHERTEXT, ACCESS_TOKEN, PLAID_SECRET, 'PLAID-SECRET'];

function assertLeaksNothing(body: unknown, label: string) {
  const text = JSON.stringify(body);
  for (const secret of LEAKS) assert.ok(!text.includes(secret), `${label} leaks ${secret}`);
}

/** An axios 0.21 error the way plaid 11 throws it: the whole request rides on `config`. */
function plaidItemLoginRequired(): Error {
  return Object.assign(new Error('Request failed with status code 400'), {
    config: {
      headers: { 'PLAID-CLIENT-ID': 'client', 'PLAID-SECRET': PLAID_SECRET },
      data: JSON.stringify({ access_token: ACCESS_TOKEN, item_id: PLAID_ITEM_ID }),
    },
    response: {
      status: 400,
      data: {
        error_type: 'ITEM_ERROR',
        error_code: 'ITEM_LOGIN_REQUIRED',
        error_message: "the login details of this item have changed (credentials, MFA, or required user action) and a user login is required to update this information. use Link's update mode to restore the item to a good state",
        request_id: 'req-item-1',
        item_id: PLAID_ITEM_ID,
      },
    },
  });
}

const OWNER = 'user-a';
const STRANGER = 'user-b';

function ownedItem(overrides: Partial<OwnedItem> = {}): OwnedItem {
  return {
    id: ITEM_ROW_ID,
    userId: OWNER,
    itemId: PLAID_ITEM_ID,
    accessToken: CIPHERTEXT,
    institutionName: 'Wells Fargo',
    last_error_code: 'ITEM_LOGIN_REQUIRED',
    last_error_at: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  };
}

type UpdateCall = { where: { id: string; userId: string }; data: { last_error_code: string | null; last_error_at: Date | null } };

/** A fake plaid_items table holding ONE row owned by user-a; every lookup must carry (id, userId). */
function fakeDb(row: OwnedItem | null = ownedItem()) {
  const finds: { id: string; userId: string }[] = [];
  const updates: UpdateCall[] = [];
  const db: ItemDb = {
    plaid_items: {
      async findFirst({ where }) {
        finds.push(where);
        return row && row.id === where.id && row.userId === where.userId ? row : null;
      },
      async updateMany(args) {
        updates.push(args);
        return { count: row && row.id === args.where.id && row.userId === args.where.userId ? 1 : 0 };
      },
    },
  };
  return { db, finds, updates };
}

test('(a) the envelope names the institution and carries no item id and no token', () => {
  const err = plaidItemLoginRequired();
  assert.equal(isItemError({ error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED' }), true);
  assert.equal(isItemError({ error_type: 'RATE_LIMIT_EXCEEDED', error_code: 'TRANSACTIONS_LIMIT' }), false);

  const failure = itemFailure('transactions', 'Wells Fargo', err);
  assert.equal(failure.ok, false);
  assert.equal(failure.stage, 'transactions');
  assert.equal(failure.message, 'Wells Fargo needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  assert.equal(failure.error.error_type, 'ITEM_ERROR');
  assert.equal(failure.error.error_code, 'ITEM_LOGIN_REQUIRED');
  assert.equal(failure.error.status, 400);
  assert.equal('page' in failure, false);
  assertLeaksNothing(failure, 'the stage failure');

  // Through the HYG-01 sync envelope — the shape sync-complete actually returns.
  const partial = syncEnvelope([failure, stageOk('investments', { securities: 3 })], { synced: 0 });
  assert.equal(partial.status, 207);
  assert.equal(partial.body.message, 'Partial sync — transactions: Wells Fargo needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED) · investments: ok (3 securities)');
  assertLeaksNothing(partial.body, 'the 207 envelope');

  const whole = syncEnvelope([failure]);
  assert.equal(whole.status, 502, 'a 400 from Plaid is an upstream failure, declared as 502');
  assert.equal(whole.body.message, 'Sync failed — transactions: Wells Fargo needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  assertLeaksNothing(whole.body, 'the 502 envelope');

  // The bank the user knows, never an id; an item stored without a name reads as a bank, not as 'Unknown'.
  assert.equal(bankName(null), 'A linked bank');
  assert.equal(bankName(undefined), 'A linked bank');
  assert.equal(bankName('Unknown'), 'A linked bank');
  assert.equal(bankName('  Chase '), 'Chase');
  assert.equal(itemFailure('investments', 'Unknown', err, 2).message, 'A linked bank needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  assert.equal(itemFailure('investments', 'Unknown', err, 2).page, 2);
});

test("(b) link-token with another user's itemId is a 404 envelope that confirms nothing", async () => {
  const { db, finds } = fakeDb();

  // The owner gets the row; the query carried both the id and the caller.
  const mine = await ownedItemOr404(db, OWNER, ITEM_ROW_ID);
  assert.equal(mine.accessToken, CIPHERTEXT, 'the ciphertext, to be decrypted at the point of use only');
  assert.deepEqual(finds.at(-1), { id: ITEM_ROW_ID, userId: OWNER });

  // A stranger naming the same row: the same query, user-scoped, finds nothing → ValidationError 404.
  await assert.rejects(ownedItemOr404(db, STRANGER, ITEM_ROW_ID), (e: unknown) => {
    assert.ok(e instanceof ValidationError);
    assert.equal(e.status, 404);
    assert.equal(e.message, 'Bank connection not found');
    assert.equal(e.field, 'itemId');
    return true;
  });
  assert.deepEqual(finds.at(-1), { id: ITEM_ROW_ID, userId: STRANGER }, 'the lookup is WHERE id AND userId — never id alone');

  // What the route's catch-all turns that into: the guidance verbatim at 404, nothing about the row.
  let caught: unknown;
  try {
    await ownedItemOr404(db, STRANGER, ITEM_ROW_ID);
  } catch (e) {
    caught = e;
  }
  const out = failClosed('api/plaid/link-token POST', 'Failed to create link token', caught);
  assert.equal(out.status, 404);
  assert.deepEqual(out.body, { ok: false, stage: 'api/plaid/link-token POST', error: 'Bank connection not found', message: 'Bank connection not found', field: 'itemId' });
  assertLeaksNothing(out.body, 'the 404 envelope');

  // An unknown id for the owner is the SAME answer as a foreign id — a 404 confirms nothing.
  await assert.rejects(ownedItemOr404(db, OWNER, 'ckdoesnotexist'), (e: unknown) => e instanceof ValidationError && e.status === 404 && e.message === 'Bank connection not found');

  // No itemId at all is a 400, not a lookup.
  const before = finds.length;
  await assert.rejects(ownedItemOr404(db, OWNER, undefined), (e: unknown) => e instanceof ValidationError && e.status === 400 && e.message === 'itemId is required');
  await assert.rejects(ownedItemOr404(db, OWNER, '   '), (e: unknown) => e instanceof ValidationError && e.status === 400);
  await assert.rejects(ownedItemOr404(db, OWNER, 42), (e: unknown) => e instanceof ValidationError && e.status === 400);
  assert.equal(finds.length, before, 'a missing id never reaches the table');

  // Update mode: the existing item's access token, no products, no history request.
  const req = updateModeLinkRequest({ userId: OWNER, clientName: 'Temple Stuart, LLC', accessToken: ACCESS_TOKEN, redirectUri: 'https://www.templestuart.com/plaid/oauth-return' });
  assert.equal(req.access_token, ACCESS_TOKEN);
  assert.equal(req.redirect_uri, 'https://www.templestuart.com/plaid/oauth-return', 'BANK-01c: update mode carries the OAuth return URL');
  assert.equal(req.user.client_user_id, OWNER);
  assert.equal(req.client_name, 'Temple Stuart, LLC');
  assert.equal('products' in req, false);
  assert.equal('transactions' in req, false);
});

test('(c) reconnect-complete leaves last_error_* null only when /item/get reports no error', async () => {
  const now = new Date('2026-09-03T15:00:00Z');

  // Healthy: the item answered with error null → the recorded error is cleared, user-scoped.
  {
    const { db, updates } = fakeDb();
    const health = await reconcileItemHealth(db, ownedItem(), { error: null }, now);
    assert.deepEqual(health, { healthy: true });
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { where: { id: ITEM_ROW_ID, userId: OWNER }, data: { last_error_code: null, last_error_at: null } });
    const env = reconnectEnvelope('Wells Fargo', health);
    assert.equal(env.status, 200);
    assert.deepEqual(env.body, { ok: true, stage: 'reconnect', message: 'Wells Fargo reconnected' });
  }

  // Still erroring: /item/get carries the error → recorded again (code + when), nothing cleared, 409.
  {
    const { db, updates } = fakeDb();
    const health = await reconcileItemHealth(
      db,
      ownedItem(),
      { error: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'still needs a login', request_id: 'req-item-2' } },
      now,
    );
    assert.equal(health.healthy, false);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], { where: { id: ITEM_ROW_ID, userId: OWNER }, data: { last_error_code: 'ITEM_LOGIN_REQUIRED', last_error_at: now } });
    const env = reconnectEnvelope('Wells Fargo', health);
    assert.equal(env.status, 409);
    assert.equal(env.body.ok, false);
    assert.equal(env.body.stage, 'reconnect');
    assert.equal(env.body.message, 'Wells Fargo still needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
    assert.deepEqual(env.body.error, { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'still needs a login', request_id: 'req-item-2' });
    assertLeaksNothing(env.body, 'the 409 envelope');
  }

  // A different item error (ITEM_LOCKED) is recorded as itself — the code is Plaid's, not a constant.
  {
    const { db, updates } = fakeDb();
    const health = await reconcileItemHealth(db, ownedItem(), { error: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOCKED', error_message: 'locked' } }, now);
    assert.equal(health.healthy, false);
    assert.equal(updates[0].data.last_error_code, 'ITEM_LOCKED');
    assert.equal(reconnectEnvelope(null, health).body.message, 'A linked bank still needs to be reconnected (Plaid: ITEM_LOCKED)');
  }

  // The two writers sync-complete uses: both address the row by (id, userId).
  {
    const { db, updates } = fakeDb();
    await recordItemError(db, { itemRowId: ITEM_ROW_ID, userId: OWNER, code: 'ITEM_LOGIN_REQUIRED', at: now });
    await clearItemError(db, { itemRowId: ITEM_ROW_ID, userId: OWNER });
    assert.deepEqual(updates.map(u => u.where), [{ id: ITEM_ROW_ID, userId: OWNER }, { id: ITEM_ROW_ID, userId: OWNER }]);
    assert.deepEqual(updates.map(u => u.data.last_error_code), ['ITEM_LOGIN_REQUIRED', null]);
  }
});

test('a rate-limited Plaid route answers 429 with the envelope and a Retry-After', () => {
  const limited = Object.assign(new Error('Rate limit exceeded for plaid-link-token:user-a — 11/10 in window'), {
    name: 'RateLimitError', key: 'plaid-link-token:user-a', count: 11, limit: 10, retryAfterSeconds: 42,
  }) as RateLimitError;
  const out = rateLimitedEnvelope('link-token', limited);
  assert.equal(out.status, 429);
  assert.equal(out.retryAfterSeconds, 42);
  assert.deepEqual(out.body, { ok: false, stage: 'link-token', error: 'Too many link-token requests — try again in 42s', message: 'Too many link-token requests — try again in 42s' });
});
