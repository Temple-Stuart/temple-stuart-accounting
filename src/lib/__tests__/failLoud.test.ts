import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeFailure,
  failureEnvelope,
  readSyncResponse,
  stageFailed,
  stageOk,
  statusForFailure,
  syncEnvelope,
} from '../plaid/failLoud';
import { TokenCipherKeyError } from '../secrets/tokenCipher';

// HYG-01 — (a) a thrown Plaid error maps to the non-2xx envelope; (b) the
// partial-run 207 shape carries both stages; and the client-side reader turns
// each into the inline line the sync button renders.

function plaid429() {
  const config = {
    headers: { 'PLAID-SECRET': 'PLAID-SECRET-VALUE' },
    data: JSON.stringify({ access_token: 'access-production-TOKEN' }),
  };
  return Object.assign(new Error('Request failed with status code 429'), {
    isAxiosError: true,
    config,
    response: {
      status: 429,
      config,
      data: { error_type: 'RATE_LIMIT_EXCEEDED', error_code: 'TRANSACTIONS_LIMIT', error_message: 'rate limit exceeded', request_id: 'req_1' },
    },
  });
}

function plaid400() {
  return Object.assign(new Error('Request failed with status code 400'), {
    isAxiosError: true,
    response: { status: 400, data: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'the login details of this item have changed', request_id: 'req_2' } },
  });
}

test('(a) a Plaid 429 maps to a 429 envelope with the summarized, user-safe body', () => {
  const { status, body } = failureEnvelope('transactions', plaid429(), { synced: { transactions: 40 } });
  assert.equal(status, 429);
  assert.equal(body.ok, false);
  assert.equal(body.stage, 'transactions');
  assert.equal(body.message, 'Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes');
  assert.deepEqual(body.synced, { transactions: 40 });
  const rendered = JSON.stringify(body);
  assert.ok(!rendered.includes('PLAID-SECRET'));
  assert.ok(!rendered.includes('access_token'));
  assert.ok(!rendered.includes('access-production-TOKEN'));
  assert.equal((body.error as { request_id?: string }).request_id, 'req_1');
});

test('(a) other upstream statuses become 502; a local throw (missing cipher key) becomes 500', () => {
  const upstream = failureEnvelope('investments', plaid400());
  assert.equal(upstream.status, 502);
  assert.equal(upstream.body.message, 'Plaid: ITEM_ERROR (ITEM_LOGIN_REQUIRED) — the login details of this item have changed');

  const local = failureEnvelope('transactions', new TokenCipherKeyError('TOKEN_ENCRYPTION_KEY is not set'));
  assert.equal(local.status, 500);
  assert.equal(local.body.message, 'TokenCipherKeyError: TOKEN_ENCRYPTION_KEY is not set');
  assert.equal(statusForFailure(stageFailed('x', new Error('boom')).error), 500);
  assert.equal(describeFailure({ status: 503 }), 'Plaid: HTTP 503');
});

test('(b) a partial run — transactions failed, investments succeeded — is a 207 carrying both stages', () => {
  const stages = [stageFailed('transactions', plaid429()), stageOk('investments', { synced: 12, skipped: 3 })];
  const { status, body } = syncEnvelope(stages, { synced: { transactions: 0, investmentTransactions: 12 } });
  assert.equal(status, 207);
  assert.equal(body.ok, false);
  assert.equal(body.partial, true);
  assert.deepEqual(body.synced, { synced: undefined, transactions: 0, investmentTransactions: 12 }.synced === undefined ? { transactions: 0, investmentTransactions: 12 } : null);
  const declared = body.stages as Array<{ stage: string; ok: boolean }>;
  assert.deepEqual(declared.map((s) => [s.stage, s.ok]), [['transactions', false], ['investments', true]]);
  assert.equal(body.message, 'Partial sync — transactions: Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes · investments: ok (12 synced, 3 skipped)');
});

test('(b) every stage failed → the first failure\'s status; zero failures → 200 with ok:true', () => {
  const allFailed = syncEnvelope([stageFailed('transactions', plaid429()), stageFailed('investments', plaid400())]);
  assert.equal(allFailed.status, 429);
  assert.equal(allFailed.body.ok, false);
  assert.equal(allFailed.body.stage, 'transactions');

  const allOk = syncEnvelope([stageOk('transactions', { synced: 5, skipped: 0 }), stageOk('investments', { synced: 0, skipped: 0 })], { success: true });
  assert.equal(allOk.status, 200);
  assert.equal(allOk.body.ok, true);
  assert.equal(allOk.body.success, true);
  assert.equal(allOk.body.message, 'Synced — transactions: ok (5 synced, 0 skipped) · investments: ok (0 synced, 0 skipped)');
  assert.throws(() => syncEnvelope([]), /no stages/);
});

// HYG-03: the reader also carries `lines` — [text] when the body sent none.
test('client reader: 200 → ok line, 207 → partial line, 429 → error line, non-JSON body → HTTP fallback', () => {
  assert.deepEqual(readSyncResponse(200, { ok: true, message: 'Synced — transactions: ok (5 synced, 0 skipped)' }), { tone: 'ok', text: 'Synced — transactions: ok (5 synced, 0 skipped)', lines: ['Synced — transactions: ok (5 synced, 0 skipped)'] });
  assert.deepEqual(readSyncResponse(207, { ok: false, partial: true, message: 'Partial sync — …' }), { tone: 'partial', text: 'Partial sync — …', lines: ['Partial sync — …'] });
  assert.deepEqual(readSyncResponse(429, { ok: false, message: 'Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes' }).tone, 'error');
  assert.deepEqual(readSyncResponse(502, null), { tone: 'error', text: 'Sync failed: HTTP 502', lines: ['Sync failed: HTTP 502'] });
  assert.deepEqual(readSyncResponse(401, { error: 'Unauthorized' }), { tone: 'error', text: 'Unauthorized', lines: ['Unauthorized'] });
  assert.equal(readSyncResponse(200, { ok: false, message: 'x' }).tone, 'error');
});
