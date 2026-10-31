import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { summarizePlaidError } from '../plaid/summarizeError';
import { summarizeTastytradeError } from '../tastytrade/summarizeError';

// SEC-02b — the summarizers must never surface the request side of an axios
// error. The fabricated errors below mirror axios 0.21's enhanced Error shape
// (plaid 11 and @tastytrade/api both resolve to the root axios 0.21.4): the
// request headers and body ride on `config`, and `response.config` repeats them.

const PLAID_SECRET = 'PLAID-SECRET-VALUE-9f3c1e';
const ACCESS_TOKEN = 'access-production-6b2d7a4e-token';
const JWT = 'eyJhbGciOi.tastytrade-jwt.sig';

function fabricatePlaidError() {
  const config = {
    url: 'https://production.plaid.com/transactions/get',
    method: 'post',
    headers: { 'PLAID-CLIENT-ID': 'client-id', 'PLAID-SECRET': PLAID_SECRET },
    data: JSON.stringify({ access_token: ACCESS_TOKEN, start_date: '2024-01-01' }),
  };
  return Object.assign(new Error('Request failed with status code 429'), {
    isAxiosError: true,
    config,
    request: { _header: `PLAID-SECRET: ${PLAID_SECRET}` },
    response: {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'content-type': 'application/json' },
      config,
      data: {
        error_type: 'RATE_LIMIT_EXCEEDED',
        error_code: 'TRANSACTIONS_LIMIT',
        error_message: 'rate limit exceeded for this item',
        display_message: null,
        request_id: 'req_7Hq2',
      },
    },
  });
}

function fabricateTastytradeError() {
  const config = {
    url: 'https://api.tastyworks.com/sessions',
    headers: { Authorization: `Bearer ${JWT}` },
    data: JSON.stringify({ login: 'user@example.com', password: 'hunter2-password', 'remember-me': true }),
  };
  return Object.assign(new Error('Request failed with status code 401'), {
    isAxiosError: true,
    config,
    response: {
      status: 401,
      headers: {},
      config,
      data: { error: { code: 'invalid_credentials', message: 'Invalid login' } },
    },
  });
}

test('the raw axios error really does leak the secrets when inspected (the bug)', () => {
  const raw = inspect(fabricatePlaidError());
  assert.ok(raw.includes(PLAID_SECRET));
  assert.ok(raw.includes(ACCESS_TOKEN));
});

test('summarizePlaidError keeps status and the five Plaid fields', () => {
  const s = summarizePlaidError(fabricatePlaidError());
  assert.equal(s.status, 429);
  assert.equal(s.error_type, 'RATE_LIMIT_EXCEEDED');
  assert.equal(s.error_code, 'TRANSACTIONS_LIMIT');
  assert.equal(s.error_message, 'rate limit exceeded for this item');
  assert.equal(s.request_id, 'req_7Hq2');
  assert.equal(s.name, 'Error');
  assert.equal(s.message, 'Request failed with status code 429');
});

test('summarizePlaidError output carries neither PLAID-SECRET nor access_token, in JSON or inspect', () => {
  const s = summarizePlaidError(fabricatePlaidError());
  for (const rendered of [JSON.stringify(s), inspect(s, { depth: null })]) {
    assert.ok(!rendered.includes('PLAID-SECRET'));
    assert.ok(!rendered.includes(PLAID_SECRET));
    assert.ok(!rendered.includes('access_token'));
    assert.ok(!rendered.includes(ACCESS_TOKEN));
    assert.ok(!rendered.includes('config'));
    assert.ok(!rendered.includes('headers'));
  }
  assert.deepEqual(Object.keys(s).sort(), ['error_code', 'error_message', 'error_type', 'message', 'name', 'request_id', 'status']);
});

test('summarizePlaidError on a non-Plaid error keeps name and message only', () => {
  const s = summarizePlaidError(new TypeError('Cannot read properties of undefined'));
  assert.deepEqual(s, { name: 'TypeError', message: 'Cannot read properties of undefined' });
  assert.deepEqual(summarizePlaidError('plain string'), { message: 'plain string' });
  assert.deepEqual(summarizePlaidError(null), {});
  assert.deepEqual(summarizePlaidError({ response: { status: 'x', data: 'not-an-object' } }), {});
});

test('summarizeTastytradeError keeps status and the error code, never the Authorization header or login body', () => {
  const s = summarizeTastytradeError(fabricateTastytradeError());
  assert.equal(s.status, 401);
  assert.equal(s.code, 'invalid_credentials');
  assert.equal(s.error_message, 'Invalid login');
  for (const rendered of [JSON.stringify(s), inspect(s, { depth: null })]) {
    assert.ok(!rendered.includes('Bearer'));
    assert.ok(!rendered.includes(JWT));
    assert.ok(!rendered.includes('password'));
    assert.ok(!rendered.includes('hunter2'));
    assert.ok(!rendered.includes('Authorization'));
  }
});
