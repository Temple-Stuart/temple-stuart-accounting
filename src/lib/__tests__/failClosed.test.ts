import test from 'node:test';
import assert from 'node:assert/strict';
import { failClosed, summarizeError } from '../http/failClosed';

// HYG-02 — no raw database or runtime error text to the client. Hermetic: a
// Prisma-shaped error is thrown by hand; console.error is captured.

class PrismaClientInitializationError extends Error {
  errorCode = 'P1001';
  clientVersion = '5.22.0';
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientInitializationError';
  }
}

const PRISMA_TEXT = "Invalid `prisma.users.findFirst()` invocation:\n\nCan't reach database server at `db.internal.example:5432`\n\nPlease make sure your database server is running at `db.internal.example:5432`.";

function capture(fn: () => void): unknown[][] {
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => { calls.push(args); };
  try { fn(); } finally { console.error = orig; }
  return calls;
}

test('a thrown Prisma-shaped error produces an envelope body containing none of the thrown text', () => {
  const err = new PrismaClientInitializationError(PRISMA_TEXT);
  let envelope: ReturnType<typeof failClosed> | undefined;
  const logs = capture(() => { envelope = failClosed('Statements API', 'Statements read failed', err); });
  assert.ok(envelope);
  assert.equal(envelope.status, 500);
  assert.deepEqual(envelope.body, { ok: false, stage: 'Statements API', error: 'Statements read failed', message: 'Statements read failed' });
  const body = JSON.stringify(envelope.body);
  for (const fragment of ['prisma', 'findFirst', 'database server', 'db.internal.example', '5432', 'invocation']) {
    assert.ok(!body.includes(fragment), `body leaks "${fragment}": ${body}`);
  }
  // the summary is logged server-side, once, under the stage
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[Statements API] Statements read failed');
  assert.deepEqual(logs[0][1], { name: 'PrismaClientInitializationError', message: PRISMA_TEXT });
});

test('summarizeError reads only name, message, a string code and a numeric status — never config or headers', () => {
  const axiosLike = Object.assign(new Error('Request failed with status code 401'), {
    code: 'ERR_BAD_REQUEST',
    status: 401,
    config: { headers: { Authorization: 'Bearer SECRET-TOKEN' }, data: '{"password":"hunter2"}' },
    response: { headers: { 'set-cookie': 'session=SECRET' } },
  });
  const s = summarizeError(axiosLike);
  assert.deepEqual(s, { name: 'Error', message: 'Request failed with status code 401', code: 'ERR_BAD_REQUEST', status: 401 });
  assert.ok(!JSON.stringify(s).includes('SECRET'));
  assert.deepEqual(summarizeError('plain string'), { message: 'plain string' });
  assert.deepEqual(summarizeError({ statusCode: 503 }), { status: 503 });
  assert.deepEqual(summarizeError(null), {});
});

test('status and extra keys pass through; extra can never override the fixed keys', () => {
  const logs = capture(() => {
    const e = failClosed('Travel scan', 'Search failed', new Error('boom'), 500, { category: 'dinner', error: 'boom' });
    assert.equal(e.body.category, 'dinner');
    assert.equal(e.body.error, 'Search failed');
    assert.equal(e.body.message, 'Search failed');
    const bad = failClosed('Upstream', 'Provider unavailable', new Error('x'), 502);
    assert.equal(bad.status, 502);
  });
  assert.equal(logs.length, 2);
});
