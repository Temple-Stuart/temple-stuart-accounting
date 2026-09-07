import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYNC_COMPLETE_PATH, syncThroughOneWriter } from '../plaid/oneWriter';

// REBUILD-01 PR-3 — ONE PLAID WRITER. Hermetic: a fake fetch stands in for the browser; the
// outcome line is the HYG-01 / HYG-03 reader's, byte for byte.

const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('the Sync button posts ONCE to sync-complete — no per-item loop, no other route', async () => {
  const calls: Array<{ url: string; method: string | undefined }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method });
    return answer(200, { ok: true, message: 'Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions', lines: ['Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions'], items: [] });
  }) as unknown as typeof fetch;
  const outcome = await syncThroughOneWriter(fetchImpl);
  assert.equal(SYNC_COMPLETE_PATH, '/api/transactions/sync-complete');
  assert.deepEqual(calls, [{ url: SYNC_COMPLETE_PATH, method: 'POST' }]);
  assert.deepEqual(outcome, { tone: 'ok', text: 'Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions', lines: ['Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions'] });
});

test('the outcome line is the HYG-03 reader\'s: 207 → partial with one line per failed bank then the success line; a refusal → error with the route\'s message; a non-JSON body never throws', async () => {
  const partial = await syncThroughOneWriter((async () => answer(207, {
    ok: false,
    message: 'TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED) · Wells Fargo synced: 3 landed',
    lines: ['TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)', 'Wells Fargo synced: 3 landed'],
  })) as unknown as typeof fetch);
  assert.equal(partial.tone, 'partial');
  assert.deepEqual(partial.lines, ['TastyTrade — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)', 'Wells Fargo synced: 3 landed']);

  const refused = await syncThroughOneWriter((async () => answer(429, { ok: false, message: 'transactions (page 1): Plaid: RATE_LIMIT_EXCEEDED (TRANSACTIONS_LIMIT) — try again in a few minutes' })) as unknown as typeof fetch);
  assert.equal(refused.tone, 'error');
  assert.match(refused.text, /RATE_LIMIT_EXCEEDED/);
  assert.deepEqual(refused.lines, [refused.text]);

  const unauthorized = await syncThroughOneWriter((async () => answer(401, { error: 'Unauthorized' })) as unknown as typeof fetch);
  assert.deepEqual(unauthorized, { tone: 'error', text: 'Unauthorized', lines: ['Unauthorized'] });

  const gateway = await syncThroughOneWriter((async () => new Response('<html>502</html>', { status: 502 })) as unknown as typeof fetch);
  assert.deepEqual(gateway, { tone: 'error', text: 'Sync failed: HTTP 502', lines: ['Sync failed: HTTP 502'] });
});

test('ImportDataSection posts through syncThroughOneWriter and renders the outcome line; nothing in src names the three retired routes or plaid-sync-fix', () => {
  const root = resolve(__dirname, '../../..');
  const src = readFileSync(resolve(root, 'src/components/dashboard/ImportDataSection.tsx'), 'utf8');
  assert.ok(src.includes("from '@/lib/plaid/oneWriter'"), 'imports the one-writer helper');
  assert.ok(src.includes('await syncThroughOneWriter()'), 'the Sync button posts through it');
  assert.ok(src.includes('{syncOutcome.text}') && src.includes('syncOutcome.lines.map('), 'renders the outcome text and its lines');
  assert.ok(!src.includes('/api/plaid/sync') && !src.includes('/api/plaid/items'), 'the per-item loop over the retired route is gone');
  for (const gone of ['src/app/api/plaid/sync/route.ts', 'src/app/api/transactions/sync/route.ts', 'src/app/api/transactions/sync-full/route.ts', 'src/lib/plaid-sync-fix.ts']) {
    assert.throws(() => readFileSync(resolve(root, gone)), `${gone} is deleted`);
  }
});
