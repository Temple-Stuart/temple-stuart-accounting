import test from 'node:test';
import assert from 'node:assert/strict';
import { WireBytesMissingError, onWireError, onWireRequest, onWireResponse, wireOf, type WireResponseLike, type WireStamp } from '../plaid/wire';

// REBUILD-01 PR-2 (d) — the interceptor hands the SDK parsed JSON while the
// captured bytes equal the raw body byte for byte.

// Odd whitespace, a CRLF, a float with a trailing zero and non-ASCII text: a
// re-serialization would change every one of them; the wire stamp changes none.
const RAW = '{\n  "transactions": [ {"transaction_id":"t1","amount":12.50,"name":"Café — tip"} ],\r\n "total_transactions": 1, "request_id": "req_1", "z": 1.0 }';

test('(d) parsed for the SDK, exact bytes on the wire stamp', () => {
  const body = Buffer.from(RAW, 'utf8');
  const copy = Buffer.from(body);
  const config = onWireRequest({ url: '/transactions/get' } as { url: string; wireAsked?: Date });
  assert.ok(config.wireAsked instanceof Date);
  const t = new Date('2026-09-03T10:00:05Z');
  const input: WireResponseLike = { data: body, status: 200, config };
  const res = onWireResponse(input, () => t);
  assert.deepEqual(res.data, JSON.parse(RAW));
  assert.equal((res.data as { z: number }).z, 1);
  assert.ok(res.wire);
  assert.equal(Buffer.compare(res.wire.body, copy), 0, 'byte for byte');
  assert.equal(res.wire.body, body, 'the very Buffer axios produced, not a re-serialization');
  assert.equal(res.wire.arrived, t);
  assert.equal(res.wire.asked, config.wireAsked);
  assert.notEqual(JSON.stringify(res.data), RAW, 'a re-serialization is NOT word for word — which is why the bytes are kept');
  assert.deepEqual(wireOf(res), res.wire);
});

test('an empty body and an ArrayBuffer body', () => {
  const empty = onWireResponse({ data: Buffer.alloc(0), status: 204 } as WireResponseLike);
  assert.equal(empty.data, null);
  assert.equal(empty.wire?.body.length, 0);
  const bytes = Buffer.from('{"a":1}');
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const res = onWireResponse({ data: ab, status: 200 } as WireResponseLike);
  assert.deepEqual(res.data, { a: 1 });
});

test('a rejected answer keeps its bytes and hands the summarizer parsed JSON; a non-Buffer body is a fault', async () => {
  const errBody = Buffer.from('{"error_type":"RATE_LIMIT_EXCEEDED","error_code":"TRANSACTIONS_LIMIT","error_message":"slow down","request_id":"r2"}');
  const err = Object.assign(new Error('Request failed with status code 429'), { response: { data: errBody as unknown, status: 429, wire: undefined as WireStamp | undefined } });
  await assert.rejects(onWireError(err), (e: unknown) => e === err);
  assert.equal((err.response.data as { error_type: string }).error_type, 'RATE_LIMIT_EXCEEDED');
  assert.equal(Buffer.compare((err.response.wire as { body: Buffer }).body, errBody), 0);
  const gateway = Object.assign(new Error('502'), { response: { data: Buffer.from('<html>bad gateway</html>') as unknown, status: 502, wire: undefined as WireStamp | undefined } });
  await assert.rejects(onWireError(gateway));
  assert.equal(gateway.response.data, null);
  assert.throws(() => onWireResponse({ data: { already: 'parsed' }, status: 200 }), WireBytesMissingError);
  assert.throws(() => wireOf({ data: {}, status: 200 }), WireBytesMissingError);
});
