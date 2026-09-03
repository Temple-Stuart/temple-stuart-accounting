import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LATEST_KEY,
  OUTCOME_KEY,
  PlaidRedirectUriMissingError,
  completeOauthReturn,
  forgetLinkFlow,
  keepLinkFlow,
  keepReturnOutcome,
  linkReopenConfig,
  newItemLinkRequest,
  planOauthReturn,
  plaidRedirectUri,
  takeReturnOutcome,
  type KeyValueStore,
} from '../plaid/oauth';
import { updateModeLinkRequest } from '../plaid/reconnect';
import { syncLine } from '../plaid/failLoud';

// BANK-01c — Plaid OAuth: the redirect URI on every link token, and the return page's round trip.

const REDIRECT = 'https://www.templestuart.com/plaid/oauth-return';
const RETURN_HREF = `${REDIRECT}?oauth_state_id=9d5feadd-a873-43eb-97ba-422f35ce849b`;
const LINK_TOKEN = 'link-production-11111111-2222-3333-4444-555555555555';
const ACCESS_TOKEN = 'access-production-secret';
const NOW = new Date('2026-09-03T15:00:00Z');
const EXPIRES = '2026-09-03T19:00:00Z';

function memoryStore(): KeyValueStore & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}

/** A fake fetch: records every POST and answers per path. */
function fakePost(answers: Record<string, { status: number; body: unknown }>) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const post = async (path: string, body: Record<string, unknown>) => {
    calls.push({ path, body });
    const a = answers[path];
    if (!a) throw new Error(`unexpected POST ${path}`);
    return { status: a.status, json: async () => a.body };
  };
  return { calls, post };
}

test('both link tokens carry redirect_uri; the new-item token keeps Transactions + Investments', () => {
  const fresh = newItemLinkRequest({ userId: 'user-a', clientName: 'Temple Stuart, LLC', redirectUri: REDIRECT });
  assert.equal(fresh.redirect_uri, REDIRECT);
  assert.deepEqual(fresh.products, ['transactions', 'investments'], 'tastytrade supports both — the new-item path keeps requesting both');
  assert.equal(fresh.transactions.days_requested, 730);
  assert.equal(fresh.client_name, 'Temple Stuart, LLC');
  assert.equal(fresh.user.client_user_id, 'user-a');
  assert.equal('access_token' in fresh, false);

  const update = updateModeLinkRequest({ userId: 'user-a', clientName: 'Temple Stuart, LLC', accessToken: ACCESS_TOKEN, redirectUri: REDIRECT });
  assert.equal(update.redirect_uri, REDIRECT, 'Plaid: update mode needs the redirect URI too');
  assert.equal(update.access_token, ACCESS_TOKEN);
  assert.equal('products' in update, false);
});

test('an unset, non-HTTPS, or query-carrying PLAID_REDIRECT_URI fails loud with a named error — no no-OAuth path', () => {
  assert.equal(plaidRedirectUri({ PLAID_REDIRECT_URI: REDIRECT }), REDIRECT);
  assert.equal(plaidRedirectUri({ PLAID_REDIRECT_URI: `  ${REDIRECT}  ` }), REDIRECT, 'trimmed');
  const named = (env: { PLAID_REDIRECT_URI?: string }, includes: string) => {
    assert.throws(() => plaidRedirectUri(env), (e: unknown) => {
      assert.ok(e instanceof PlaidRedirectUriMissingError);
      assert.equal(e.name, 'PlaidRedirectUriMissingError');
      assert.ok(e.message.includes(includes), e.message);
      return true;
    });
  };
  named({}, 'PLAID_REDIRECT_URI is not set');
  named({ PLAID_REDIRECT_URI: '' }, 'PLAID_REDIRECT_URI is not set');
  named({ PLAID_REDIRECT_URI: '   ' }, 'PLAID_REDIRECT_URI is not set');
  named({ PLAID_REDIRECT_URI: 'http://www.templestuart.com/plaid/oauth-return' }, 'must be an https URI');
  named({ PLAID_REDIRECT_URI: `${REDIRECT}?x=1` }, 'no query string');
  named({ PLAID_REDIRECT_URI: `${REDIRECT}#/return` }, 'no query string');
});

test('the return page re-opens Link with the kept token and the received URI', () => {
  const store = memoryStore();
  const kept = keepLinkFlow(store, { linkToken: LINK_TOKEN, flow: { kind: 'reconnect', itemId: 'ckitemrow0001', institution: 'tastytrade' }, expiresAt: EXPIRES, now: NOW });
  assert.equal(kept.keptAt, NOW.toISOString());
  assert.equal(store.getItem(LATEST_KEY), LINK_TOKEN, 'keyed by the link token, with a pointer to the latest');
  assert.ok(store.getItem(`plaid-link:${LINK_TOKEN}`));

  const plan = planOauthReturn(RETURN_HREF, store, NOW);
  assert.equal(plan.kind, 'reopen');
  if (plan.kind !== 'reopen') return;
  assert.equal(plan.oauthStateId, '9d5feadd-a873-43eb-97ba-422f35ce849b');
  assert.equal(plan.linkToken, LINK_TOKEN, 'the SAME link_token');
  assert.equal(plan.receivedRedirectUri, RETURN_HREF, 'the FULL received URL, query string included');
  assert.deepEqual(plan.flow, { kind: 'reconnect', itemId: 'ckitemrow0001', institution: 'tastytrade' });
  assert.deepEqual(linkReopenConfig(plan), { token: LINK_TOKEN, receivedRedirectUri: RETURN_HREF });

  // Finished → forgotten; the pointer goes with it.
  forgetLinkFlow(store, LINK_TOKEN);
  assert.deepEqual(store.dump(), {});

  // A newer keep replaces the pointer; forgetting an older token leaves the newer pointer alone.
  keepLinkFlow(store, { linkToken: 'link-1', flow: { kind: 'new' }, expiresAt: EXPIRES, now: NOW });
  keepLinkFlow(store, { linkToken: 'link-2', flow: { kind: 'new' }, expiresAt: EXPIRES, now: NOW });
  forgetLinkFlow(store, 'link-1');
  assert.equal(store.getItem(LATEST_KEY), 'link-2');
});

test("the 'reconnect' flow calls reconnect-complete, never exchange-token; 'new' exchanges as the cockpit does", async () => {
  const reconnect = fakePost({
    '/api/plaid/reconnect-complete': { status: 200, body: { ok: true, stage: 'reconnect', message: 'tastytrade reconnected' } },
    '/api/plaid/exchange-token': { status: 500, body: { ok: false, error: 'must never be called' } },
  });
  const r = await completeOauthReturn({ kind: 'reconnect', itemId: 'ckitemrow0001', institution: 'tastytrade' }, 'public-production-x', { institution: { name: 'tastytrade', institution_id: 'ins_116995' } }, reconnect.post);
  assert.equal(r.endpoint, '/api/plaid/reconnect-complete');
  assert.deepEqual(reconnect.calls, [{ path: '/api/plaid/reconnect-complete', body: { itemId: 'ckitemrow0001' } }], 'one call, no public token, no exchange');
  assert.deepEqual(r.outcome, { tone: 'ok', text: 'tastytrade reconnected', lines: ['tastytrade reconnected'] });
  assert.ok(!JSON.stringify(reconnect.calls).includes('public-production-x'), 'the public token never leaves the browser in update mode');

  const still = fakePost({ '/api/plaid/reconnect-complete': { status: 409, body: { ok: false, stage: 'reconnect', message: 'tastytrade still needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)' } } });
  const s = await completeOauthReturn({ kind: 'reconnect', itemId: 'ckitemrow0001', institution: 'tastytrade' }, 'public-production-x', null, still.post);
  assert.deepEqual(s.outcome, { tone: 'error', text: 'tastytrade still needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)', lines: ['tastytrade still needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)'] });

  const fresh = fakePost({ '/api/plaid/exchange-token': { status: 200, body: { success: true } } });
  const n = await completeOauthReturn({ kind: 'new' }, 'public-production-y', { institution: { name: 'tastytrade', institution_id: 'ins_116995' } }, fresh.post);
  assert.equal(n.endpoint, '/api/plaid/exchange-token');
  assert.deepEqual(fresh.calls, [{ path: '/api/plaid/exchange-token', body: { publicToken: 'public-production-y', institutionId: 'ins_116995', institutionName: 'tastytrade', entityId: 'personal' } }], 'the exact body the cockpit sends today');
  assert.deepEqual(n.outcome, { tone: 'ok', text: 'tastytrade linked', lines: ['tastytrade linked'] }, 'HYG-03: the renamed line moves its `lines` with it');

  const failed = fakePost({ '/api/plaid/exchange-token': { status: 500, body: { ok: false, stage: 'api/plaid/exchange-token POST', error: 'Failed to link account', message: 'Failed to link account' } } });
  const f = await completeOauthReturn({ kind: 'new' }, 'public-production-y', null, failed.post);
  assert.deepEqual(f.outcome, { tone: 'error', text: 'Failed to link account', lines: ['Failed to link account'] });
});

test('a return with no kept state renders the declared error — and so do a missing state id, a corrupt entry, and an expired token', () => {
  const empty = memoryStore();
  const none = planOauthReturn(RETURN_HREF, empty, NOW);
  assert.equal(none.kind, 'error');
  if (none.kind === 'error') assert.match(none.message, /No Plaid Link session was kept in this browser .*9d5feadd/);

  const noState = planOauthReturn(REDIRECT, memoryStore(), NOW);
  assert.equal(noState.kind, 'error');
  if (noState.kind === 'error') assert.match(noState.message, /carries no oauth_state_id/);

  const corrupt = memoryStore();
  corrupt.setItem(LATEST_KEY, LINK_TOKEN);
  corrupt.setItem(`plaid-link:${LINK_TOKEN}`, '{not json');
  const c = planOauthReturn(RETURN_HREF, corrupt, NOW);
  assert.equal(c.kind, 'error');
  if (c.kind === 'error') assert.match(c.message, /missing or unreadable/);

  const dangling = memoryStore();
  dangling.setItem(LATEST_KEY, LINK_TOKEN);
  assert.equal(planOauthReturn(RETURN_HREF, dangling, NOW).kind, 'error');

  const expired = memoryStore();
  keepLinkFlow(expired, { linkToken: LINK_TOKEN, flow: { kind: 'new' }, expiresAt: '2026-09-03T14:00:00Z', now: new Date('2026-09-03T10:00:00Z') });
  const e = planOauthReturn(RETURN_HREF, expired, NOW);
  assert.equal(e.kind, 'error');
  if (e.kind === 'error') assert.match(e.message, /expired at 2026-09-03T14:00:00Z/);

  assert.equal(planOauthReturn('not a url', memoryStore(), NOW).kind, 'error');
});

test('the outcome line rides back to Books and is consumed by the reader of its flow kind', () => {
  const store = memoryStore();
  keepReturnOutcome(store, { flow: { kind: 'reconnect', itemId: 'ckitemrow0001', institution: 'tastytrade' }, outcome: syncLine('ok', 'tastytrade reconnected'), now: NOW });
  assert.equal(takeReturnOutcome(store, 'new'), null, "the cockpit banner reads 'new' outcomes only — the row's outcome stays for the row");
  assert.ok(store.getItem(OUTCOME_KEY), 'still kept');
  const taken = takeReturnOutcome(store, 'reconnect');
  assert.deepEqual(taken, { flow: { kind: 'reconnect', itemId: 'ckitemrow0001', institution: 'tastytrade' }, outcome: { tone: 'ok', text: 'tastytrade reconnected', lines: ['tastytrade reconnected'] }, at: NOW.toISOString() });
  assert.equal(store.getItem(OUTCOME_KEY), null, 'consumed');
  assert.equal(takeReturnOutcome(store, 'reconnect'), null);

  store.setItem(OUTCOME_KEY, '{"flow":{"kind":"new"},"outcome":{"tone":"ok"}}');
  assert.equal(takeReturnOutcome(store, 'new'), null, 'a malformed outcome is dropped, not rendered');
  assert.equal(store.getItem(OUTCOME_KEY), null);
});
