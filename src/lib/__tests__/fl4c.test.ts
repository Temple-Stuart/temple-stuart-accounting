/**
 * FL-4c (2026-09-23) — the flights panel gets its publishable key from /config.
 *
 * The panel cannot be executed here (it needs Stripe and a provider), so its
 * contract is read from source the way this repo proves a surface it cannot run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';

const PANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
const ROUTE = 'src/app/api/travel/liteapi/flights/prebook/route.ts';

test('/config is the SINGLE source — the prebook\'s publishableKey is never read', () => {
  const src = code(PANEL);
  assert.match(src, /payment-wrapper\.liteapi\.travel\/config/, 'the panel asks the vendor for the key');
  assert.match(src, /publicKey: paymentEnv/, 'keyed on the server-derived env label');
  // The corrected source is the ONLY source: no chain, no "else".
  assert.ok(!/prebook\?\.publishableKey/.test(src), 'the prebook field is not read');
  assert.ok(!/data\.publishableKey\s*\|\|/.test(src), 'and it is not the first half of a chain');
  assert.ok(!/publishableKey\s*\?\?/.test(src), 'no ?? fallback to another key');
  assert.match(src, /loadStripe\(publishableKey\)/, 'Elements mounts with the fetched key');
});

test('no env key, no our-Stripe key, no retry, no poll — the invariant that did not change', () => {
  const src = code(PANEL);
  for (const banned of ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'process.env', 'setTimeout', 'setInterval', 'retry(', 'pk_live_', 'pk_test_']) {
    assert.ok(!src.includes(banned), `the panel contains no ${banned}`);
  }
});

test('a /config that cannot answer is a NAMED dead end, and asks for no card', () => {
  const src = code(PANEL);
  // Both failure shapes are named, and both say nothing was charged.
  assert.match(src, /did not return a key for this environment \(HTTP \$\{res\.status\}\)/);
  assert.match(src, /returned no key for this environment/);
  // Scoped to the function's OWN closing brace at column 0, not a character
  // count — a fixed window runs past the end and reads the next thing's catch.
  const at = src.indexOf('async function fetchPublishableKey');
  const fn = src.slice(at, src.indexOf('\n}', at) + 2);
  assert.equal((fn.match(/throw new Error/g) ?? []).length, 2, 'two throws, one per failure');
  // It swallows no FAILURE: there is no try block, so nothing is caught and
  // dropped. The one `.catch` is on res.json() — an unparsable body becomes null,
  // which the `!key` check below turns into a named throw rather than a silence.
  assert.ok(!/try\s*\{/.test(fn), 'no try block — fetchPublishableKey swallows nothing');
  assert.match(fn, /res\.json\(\)\.catch\(\(\) => null\)/, 'the only catch is the JSON guard');
  assert.match(fn, /if \(!key\) \{[\s\S]*throw new Error/, 'and an empty key throws by name');
  // It throws INTO the panel's existing error path, which returns to the form.
  const call = src.slice(src.indexOf('await fetchPublishableKey('), src.indexOf('await fetchPublishableKey(') + 600);
  assert.ok(!/catch/.test(call.slice(0, 120)), 'the call is not wrapped in a swallow');
  assert.match(src, /setError\(err instanceof Error \? err\.message/, 'the reason reaches the screen');
});

test('the production message never says "Sandbox"', () => {
  const src = code(PANEL);
  const strings = [...src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
  for (const s of strings) {
    assert.ok(!/sandbox/i.test(s), `no customer string says "${s.slice(0, 60)}"`);
  }
  // The specific line FL-4c replaced is gone by its own words.
  assert.ok(!src.includes('Sandbox prebook returned no publishable key'), 'the hardcoded Sandbox throw is gone');
});

test('the env label is the SERVER\'s, never the browser\'s guess', () => {
  const route = code(ROUTE);
  assert.match(route, /paymentEnv: liteApiPaymentEnv\(\)/, 'the route derives it');
  const src = code(PANEL);
  assert.match(src, /data\?\.paymentEnv === 'string'/, 'the panel reads it from the response');
  // It never invents one.
  assert.ok(!/paymentEnv = '(live|sandbox)'/.test(src), 'the panel hardcodes no env');
  assert.match(src, /could not determine its payment environment/, 'a missing env is named, not defaulted');
});

test('the secretKey path is untouched — FL-4c did not go near it', () => {
  const src = code(PANEL);
  assert.match(src, /typeof data\?\.secretKey !== 'string' \|\| !data\.secretKey/, 'the same secretKey gate');
  assert.match(src, /missing its payment secret/, 'with the same words');
});

test('the header no longer claims the key comes from the prebook', () => {
  const head = comments(PANEL);
  assert.match(head, /FL-4c/, 'the correction is dated in the header');
  assert.match(head, /answers null/, 'and says what the prebook actually returns');
  assert.ok(!/Elements mounts with the `publishableKey` FROM THE\n \* PREBOOK RESPONSE/.test(head), 'the old invariant text is gone');
});
