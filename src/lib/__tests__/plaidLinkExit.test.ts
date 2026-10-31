import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LINK_CANCELLED,
  LINK_EXIT_MAX,
  RECONNECT_CANCELLED,
  linkExitNote,
  linkExitOutcome,
  linkExitReport,
  notLoggedSuffix,
  summarizeLinkExit,
  type LinkExitError,
  type LinkExitMetadata,
} from '../plaid/linkExit';
import { failClosed } from '../http/failClosed';
import { ValidationError } from '../errors/ValidationError';

// BANK-01b — Plaid Link's exit reaches the row and the log; the POST body carries no token.

const ACCESS_TOKEN = 'access-production-1234-secret';
const PUBLIC_TOKEN = 'public-production-5678-secret';
const LINK_TOKEN = 'link-production-9012-secret';
const TOKENS = [ACCESS_TOKEN, PUBLIC_TOKEN, LINK_TOKEN, 'PLAID-SECRET'];

/** What Link hands onExit for "Something went wrong — Internal error occurred", with junk a test plants beside it. */
function internalError(): LinkExitError & Record<string, unknown> {
  return {
    error_type: 'API_ERROR',
    error_code: 'INTERNAL_SERVER_ERROR',
    error_message: 'an unexpected error occurred',
    display_message: 'Something went wrong — Internal error occurred',
    // planted: never part of a Link error, and must never leave the browser
    access_token: ACCESS_TOKEN,
    link_token: LINK_TOKEN,
  };
}

function exitMetadata(): LinkExitMetadata & Record<string, unknown> {
  return {
    institution: { name: 'Wells Fargo', institution_id: 'ins_127991' },
    status: 'requires_oauth',
    link_session_id: 'ls-abc-123',
    request_id: 'req-link-9',
    public_token: PUBLIC_TOKEN, // planted
  };
}

test('an onExit error produces the row note and a report that carries no token', () => {
  const error = internalError();
  const metadata = exitMetadata();

  assert.equal(linkExitNote(error), 'Plaid Link: INTERNAL_SERVER_ERROR — Something went wrong — Internal error occurred');
  assert.equal(linkExitNote({ ...error, display_message: null }), 'Plaid Link: INTERNAL_SERVER_ERROR — an unexpected error occurred', 'display_message null → error_message');
  assert.equal(linkExitNote({ ...error, display_message: '  ' }), 'Plaid Link: INTERNAL_SERVER_ERROR — an unexpected error occurred', 'blank display_message → error_message');

  const out = linkExitOutcome(error, metadata, RECONNECT_CANCELLED, 'ckitemrow0001');
  assert.equal(out.kind, 'error');
  if (out.kind !== 'error') return;
  assert.equal(out.note, 'Plaid Link: INTERNAL_SERVER_ERROR — Something went wrong — Internal error occurred');

  // The body the browser POSTs: these keys and no others.
  assert.deepEqual(out.report, {
    itemId: 'ckitemrow0001',
    error_code: 'INTERNAL_SERVER_ERROR',
    error_type: 'API_ERROR',
    error_message: 'an unexpected error occurred',
    link_session_id: 'ls-abc-123',
    request_id: 'req-link-9',
    status: 'requires_oauth',
  });
  const wire = JSON.stringify(out.report);
  for (const t of TOKENS) assert.ok(!wire.includes(t), `the report leaks ${t}`);
  assert.ok(!wire.includes('institution'), 'the institution comes from the owned row on the server, not from the body');

  // The new-item flow: no itemId key at all (not an undefined value that JSON would drop anyway).
  const fresh = linkExitReport(error, metadata);
  assert.equal('itemId' in fresh, false);
  assert.equal(linkExitReport(error, {}).link_session_id, null, 'missing metadata fields are null, never fabricated');
});

test('a cancel produces the cancel note; a connected exit says nothing', () => {
  const cancel = linkExitOutcome(null, { status: 'requires_credentials', link_session_id: 'ls-1', request_id: 'r-1' }, RECONNECT_CANCELLED, 'ckitemrow0001');
  assert.deepEqual(cancel, { kind: 'cancelled', note: 'Reconnect cancelled' });
  assert.deepEqual(linkExitOutcome(null, { status: null }, RECONNECT_CANCELLED), { kind: 'cancelled', note: 'Reconnect cancelled' }, 'status null is still an exit before connecting');
  assert.deepEqual(linkExitOutcome(null, {}, LINK_CANCELLED), { kind: 'cancelled', note: 'Account link cancelled' }, 'the new-item flow has its own words');
  assert.deepEqual(linkExitOutcome(null, { status: 'connected' }, RECONNECT_CANCELLED), { kind: 'connected' });
  assert.equal(notLoggedSuffix(500), ' — not logged (HTTP 500)');
  assert.equal(notLoggedSuffix(0), ' — not logged (network)');
});

test('the server admits the named fields only, length-capped; a missing field is a 400', () => {
  const posted = {
    itemId: 'ckitemrow0001',
    error_code: 'INTERNAL_SERVER_ERROR',
    error_type: 'API_ERROR',
    error_message: 'x'.repeat(LINK_EXIT_MAX.message + 200),
    link_session_id: 'ls-abc-123',
    request_id: '',
    status: 'requires_oauth',
    // planted: a body can say anything — nothing outside the named keys is read
    access_token: ACCESS_TOKEN,
    public_token: PUBLIC_TOKEN,
    institution: 'Not Wells Fargo',
  };
  const summary = summarizeLinkExit(posted);
  assert.deepEqual(Object.keys(summary).sort(), ['error_code', 'error_message', 'error_type', 'itemId', 'link_session_id', 'request_id', 'status']);
  assert.equal(summary.error_message.length, LINK_EXIT_MAX.message);
  assert.equal(summary.request_id, null, 'an empty string is null');
  const logged = JSON.stringify(summary);
  for (const t of TOKENS) assert.ok(!logged.includes(t), `the summary leaks ${t}`);
  assert.ok(!logged.includes('Not Wells Fargo'));

  // The new-item flow posts no itemId.
  assert.equal(summarizeLinkExit({ error_code: 'c', error_type: 't', error_message: 'm' }).itemId, null);

  // Missing or mistyped → ValidationError 400 that the route's catch-all returns verbatim.
  const reject = (body: unknown, message: string) => {
    let caught: unknown;
    try {
      summarizeLinkExit(body);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof ValidationError, `expected a ValidationError for ${JSON.stringify(body)}`);
    assert.equal(caught.status, 400);
    const out = failClosed('api/plaid/link-exit POST', 'Failed to log the Plaid Link exit', caught);
    assert.equal(out.status, 400);
    assert.equal(out.body.message, message);
  };
  reject(null, 'a JSON body is required');
  reject({ error_type: 'API_ERROR', error_message: 'm' }, 'error_code is required');
  reject({ error_code: 'c', error_type: 't', error_message: 'm', itemId: 42 }, 'itemId must be a string');
  reject({ error_code: 'c', error_type: 't', error_message: '   ' }, 'error_message is required');
});
