import test from 'node:test';
import assert from 'node:assert/strict';
import {
  failedLine,
  itemStatus,
  readSyncResponse,
  stageFailed,
  stageOk,
  successLine,
  sumStageCounts,
  syncEachItem,
  syncItemsEnvelope,
  syncLines,
  type ItemOutcome,
  type StageOutcome,
  type StageRunner,
} from '../plaid/failLoud';
import { itemFailure } from '../plaid/reconnect';

// HYG-03 — one bank's failure never blocks another: every item runs every stage; the
// response lists each bank with its per-stage outcome; the banner reads one line per
// failed bank above one line for what succeeded.

interface Item { id: string; institutionName: string }
const TASTY: Item = { id: 'item-tt', institutionName: 'TastyTrade' };
const WELLS: Item = { id: 'item-wf', institutionName: 'Wells Fargo' };
const ROBIN: Item = { id: 'item-rh', institutionName: 'Robinhood' };

function loginRequired() {
  return Object.assign(new Error('Request failed with status code 400'), {
    isAxiosError: true,
    config: { headers: { 'PLAID-SECRET': 'PLAID-SECRET-VALUE' }, data: JSON.stringify({ access_token: 'access-production-TOKEN' }) },
    response: { status: 400, data: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'the login details of this item have changed', request_id: 'req_tt' } },
  });
}

function rateLimited() {
  return Object.assign(new Error('Request failed with status code 429'), {
    isAxiosError: true,
    response: { status: 429, data: { error_type: 'RATE_LIMIT_EXCEEDED', error_code: 'TRANSACTIONS_LIMIT', error_message: 'rate limit exceeded', request_id: 'req_rl' } },
  });
}

/** A fake pair of stage runners: per item, what each stage answers; every call is recorded. */
function runners(plan: Record<string, { transactions: () => Promise<StageOutcome>; investments: () => Promise<StageOutcome> }>) {
  const calls: string[] = [];
  const stage = (name: 'transactions' | 'investments'): StageRunner<Item> => [name, async (item) => {
    calls.push(`${item.institutionName}:${name}`);
    return plan[item.id][name]();
  }];
  return { calls, runners: [stage('transactions'), stage('investments')] };
}

const okTx = (landed: number, extra: Partial<Record<'already_landed' | 'corrected' | 'synced' | 'skipped', number>> = {}) => async () =>
  stageOk('transactions', { synced: landed, skipped: 0, landed, already_landed: 0, corrected: 0, ...extra });
const okInv = (synced: number, securities = 0) => async () => stageOk('investments', { synced, skipped: 0, securities });
const deadItem = (stage: string) => async () => itemFailure(stage, 'TastyTrade', loginRequired());

test('(a) item A fails, item B succeeds → 207; B\'s counts present; A named', async () => {
  const { calls, runners: r } = runners({
    'item-tt': { transactions: deadItem('transactions'), investments: deadItem('investments') },
    'item-wf': { transactions: okTx(14, { already_landed: 3, corrected: 1 }), investments: okInv(0) },
  });
  const items = await syncEachItem([TASTY, WELLS], (i) => i.institutionName, r);

  // Every item ran every stage — A's failure decided nothing about B.
  assert.deepEqual(calls, ['TastyTrade:transactions', 'TastyTrade:investments', 'Wells Fargo:transactions', 'Wells Fargo:investments']);
  assert.deepEqual(items.map(itemStatus), ['failed', 'ok']);

  const { status, body } = syncItemsEnvelope(items, { synced: { transactions: 14 } });
  assert.equal(status, 207);
  assert.equal(body.ok, false);
  assert.equal(body.partial, true);
  assert.deepEqual(body.synced, { transactions: 14 }, 'okBody rides the 207');
  const listed = body.items as ItemOutcome[];
  assert.equal(listed[0].institution, 'TastyTrade');
  assert.equal(listed[0].stages[0].ok, false);
  assert.equal(listed[1].institution, 'Wells Fargo');
  assert.deepEqual(listed[1].stages[0], { stage: 'transactions', ok: true, counts: { synced: 14, skipped: 0, landed: 14, already_landed: 3, corrected: 1 } });
  assert.deepEqual(body.lines, [
    'TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)',
    'Wells Fargo synced: 14 landed, 3 already landed, 1 corrected',
  ], 'one line per failed bank (both dead stages collapse to one) above one for what succeeded');
  assert.equal(body.message, 'Partial sync — TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED) · Wells Fargo synced: 14 landed, 3 already landed, 1 corrected');
  const wire = JSON.stringify(body);
  assert.ok(!wire.includes('access-production-TOKEN') && !wire.includes('PLAID-SECRET-VALUE'), 'no secret in the body');

  // The banner reads the 207 body: the same lines, partial tone.
  const out = readSyncResponse(207, body);
  assert.equal(out.tone, 'partial');
  assert.deepEqual(out.lines, body.lines);
  assert.equal(out.text, body.message);
});

test('(b) every item failed → non-2xx with the first failure\'s status', async () => {
  const { runners: r } = runners({
    'item-tt': { transactions: deadItem('transactions'), investments: deadItem('investments') },
    'item-wf': { transactions: async () => stageFailed('transactions', rateLimited()), investments: async () => stageFailed('investments', rateLimited()) },
  });
  const items = await syncEachItem([TASTY, WELLS], (i) => i.institutionName, r);
  assert.deepEqual(items.map(itemStatus), ['failed', 'failed']);
  const { status, body } = syncItemsEnvelope(items, { synced: { transactions: 0 } });
  assert.equal(status, 502, 'the first failure (TastyTrade, HTTP 400 upstream) decides: 502');
  assert.equal(body.ok, false);
  assert.equal(body.stage, 'transactions');
  assert.equal(body.institution, 'TastyTrade');
  assert.equal('synced' in body, false, 'no progress keys on a run where nothing synced');
  assert.deepEqual(body.lines, [
    'TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)',
    'Wells Fargo — transactions: Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes',
    'Wells Fargo — investments: Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes',
  ]);
  assert.equal(readSyncResponse(status, body).tone, 'error');

  // Rate-limit first → 429 stays 429.
  const swapped = syncItemsEnvelope([items[1], items[0]]);
  assert.equal(swapped.status, 429);

  // A runner that THROWS (not a declared outcome) is itself declared, and the run continues.
  const thrower = runners({
    'item-tt': { transactions: async () => { throw new Error('boom'); }, investments: async () => { throw new Error('boom'); } },
    'item-wf': { transactions: async () => { throw new Error('boom'); }, investments: async () => { throw new Error('boom'); } },
  });
  const thrown = await syncEachItem([TASTY, WELLS], (i) => i.institutionName, thrower.runners);
  assert.equal(thrower.calls.length, 4);
  assert.equal(syncItemsEnvelope(thrown).status, 500, 'a local throw is a 500');
});

test('(c) every item succeeded → 200 with the totals and one success line', async () => {
  const { calls, runners: r } = runners({
    'item-wf': { transactions: okTx(9), investments: okInv(0) },
    'item-rh': { transactions: okTx(5), investments: okInv(7, 2) },
  });
  const items = await syncEachItem([ROBIN, WELLS], (i) => i.institutionName, r);
  assert.equal(calls.length, 4);
  assert.deepEqual(sumStageCounts(items, 'transactions'), { synced: 14, skipped: 0, landed: 14, already_landed: 0, corrected: 0 });
  assert.deepEqual(sumStageCounts(items, 'investments'), { synced: 7, skipped: 0, securities: 2 });
  const { status, body } = syncItemsEnvelope(items, { synced: { transactions: 14, investmentTransactions: 7, securities: 2 } });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.lines, ['Robinhood, Wells Fargo synced: 14 landed, 7 investment transactions, 2 securities']);
  assert.equal(body.message, 'Synced — Robinhood, Wells Fargo synced: 14 landed, 7 investment transactions, 2 securities');
  assert.equal(readSyncResponse(200, body).tone, 'ok');

  // No linked banks at all is still a 200, and says so.
  const none = syncItemsEnvelope([], { synced: { transactions: 0 } });
  assert.equal(none.status, 200);
  assert.equal(none.body.message, 'Synced — no linked banks');
});

test('(d) a page failure inside B stops only B\'s transactions stage — B\'s investments and every other item still run', async () => {
  // What the route returns when runTransactionsPage answers !ok on page 2: the page's
  // failure, as PR-2 declared it (the page rolled back; earlier pages landed).
  const pageTwo = async () => stageFailed('transactions', new Error('parser: amount is not a number'), 2);
  const { calls, runners: r } = runners({
    'item-wf': { transactions: okTx(9), investments: okInv(0) },
    'item-rh': { transactions: pageTwo, investments: okInv(4) },
    'item-tt': { transactions: okTx(2), investments: okInv(1) },
  });
  const items = await syncEachItem([ROBIN, TASTY, WELLS], (i) => i.institutionName, r);
  assert.deepEqual(calls, [
    'Robinhood:transactions', 'Robinhood:investments',
    'TastyTrade:transactions', 'TastyTrade:investments',
    'Wells Fargo:transactions', 'Wells Fargo:investments',
  ], 'B\'s page failure ended B\'s transactions stage only — its investments ran, and so did every other item');
  assert.deepEqual(items.map(itemStatus), ['partial', 'ok', 'ok']);
  const robin = items[0];
  assert.equal(robin.stages[0].ok, false);
  assert.equal((robin.stages[0] as { page?: number }).page, 2);
  assert.equal(robin.stages[1].ok, true);

  const { status, body } = syncItemsEnvelope(items);
  assert.equal(status, 207);
  assert.deepEqual(body.lines, [
    'Robinhood — transactions page 2: Error: parser: amount is not a number',
    'TastyTrade, Wells Fargo synced: 11 landed, 5 investment transactions',
  ], 'the partial item is named for its failed stage; only fully-synced banks are named as synced; counts sum every stage that succeeded');
});

test('lines: an item failure is not double-named; a stage failure names its stage; nothing succeeded → no success line', () => {
  const dead = itemFailure('transactions', 'TastyTrade', loginRequired());
  assert.equal(failedLine('TastyTrade', dead), 'TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  assert.equal(failedLine('A linked bank', itemFailure('investments', null, loginRequired())), 'A linked bank — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  assert.equal(failedLine('Wells Fargo', stageFailed('investments', rateLimited())), 'Wells Fargo — investments: Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes');
  assert.equal(successLine([{ institution: 'TastyTrade', stages: [dead] }]), null);
  assert.deepEqual(syncLines([{ institution: 'TastyTrade', stages: [dead, dead] }]), ['TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)']);
  // A partial item's successful stage counts, but the bank is not called synced.
  assert.equal(successLine([{ institution: 'Robinhood', stages: [dead, stageOk('investments', { synced: 3, skipped: 0, securities: 0 })] }]), 'Partial progress: 0 landed, 3 investment transactions');
  // A body without lines (link-token, reconnect-complete) still reads as one line.
  assert.deepEqual(readSyncResponse(409, { ok: false, stage: 'reconnect', message: 'Wells Fargo still needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)' }).lines, ['Wells Fargo still needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)']);
  assert.deepEqual(readSyncResponse(500, null).lines, ['Sync failed: HTTP 500']);
});
