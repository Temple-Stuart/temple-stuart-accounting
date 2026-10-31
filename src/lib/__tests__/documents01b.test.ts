/**
 * DOCUMENTS-01b (Alex, 2026-10-30) — the receipt download's sandbox header, made real; sizes in one unit.
 *
 * A. THE HEADER. The file route answers `Content-Security-Policy: sandbox` (fileResponseHeaders), but
 *    next.config.ts's site-wide rule set the same key on every path and replaced it on the wire (#1873's
 *    finding). One per-path rule, AFTER the site-wide one, sets `sandbox` on '/api/books/documents/:id/file'
 *    — Next's documented rule: the last matching rule wins. The site-wide value is pinned verbatim here, as
 *    it stands on main: a drift of any directive fails by name.
 * B. ONE UNIT. The cap is 4 MiB (4,194,304 bytes) and every screen word says MiB; sizeWords said decimal
 *    MB. It is binary now, and each refusal names both exact byte counts beside the size in words.
 * The wire itself (one header, `sandbox`, on the file path; the site-wide policy unchanged elsewhere) is
 * proven against a production build and reported with the PR, as this repo proves what a test cannot run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import nextConfig from '../../../next.config';
import { MAX_RECEIPT_BYTES, MAX_UPLOAD_BODY_BYTES, bodyTooLargeWords, sizeWords, tooLargeWords } from '../books/sourceDocuments';

const CONFIG = 'next.config.ts';
const LEAF = 'src/lib/books/sourceDocuments.ts';
const CONTROLS = 'src/components/books/ReceiptControls.tsx';

const FILE_PATH = '/api/books/documents/:id/file';
const CSP = 'Content-Security-Policy';

/** The site-wide policy, directive for directive, as it stands on main (next.config.ts :22-29). */
const SITE_WIDE_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com https://payment-wrapper.liteapi.travel https://js.stripe.com",
  "connect-src 'self' https://production.plaid.com https://cdn.plaid.com https://payment-wrapper.liteapi.travel https://api.stripe.com",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "frame-src https://cdn.plaid.com https://payment-wrapper.liteapi.travel https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
] as const;
const SITE_WIDE_CSP = SITE_WIDE_DIRECTIVES.join('; ');

test('A next.config.ts headers(): exactly two rules — the site-wide policy first, verbatim; then the file path with one header, Content-Security-Policy: sandbox', async () => {
  // The text: the two rules, in order, inside headers() and nowhere else.
  const cfg = code(CONFIG);
  const block = cfg.slice(cfg.indexOf('async headers() {'), cfg.indexOf('async redirects() {'));
  assert.ok(block.length > 0, 'headers() stands before redirects()');
  assert.deepEqual([...block.matchAll(/source: '([^']*)'/g)].map((m) => m[1]), ['/:path*', FILE_PATH], 'two rules, the site-wide one first');
  const siteWide = block.slice(block.indexOf("source: '/:path*'"), block.indexOf(`source: '${FILE_PATH}'`));
  const perPath = block.slice(block.indexOf(`source: '${FILE_PATH}'`));
  assert.equal((siteWide.match(/key: '/g) ?? []).length, 1, 'the site-wide rule sets one header');
  assert.match(siteWide, /key: 'Content-Security-Policy',\n\s+value: \[\n/);
  let at = -1;
  for (const directive of SITE_WIDE_DIRECTIVES) {
    const next = siteWide.indexOf(`"${directive}",`, at + 1);
    assert.ok(next > at, `the site-wide directive stands as on main, in order: ${directive}`);
    at = next;
  }
  assert.match(siteWide, /\]\.join\('; '\),/);
  assert.equal((siteWide.match(/"[a-z-]+-src /g) ?? []).length, SITE_WIDE_DIRECTIVES.length, 'eight directives — none added, none removed');
  assert.equal((perPath.match(/key: '/g) ?? []).length, 1, 'the per-path rule sets one header');
  assert.match(perPath, /source: '\/api\/books\/documents\/:id\/file',\n\s+headers: \[\n\s+\{\n\s+key: 'Content-Security-Policy',\n\s+value: 'sandbox',\n\s+\},\n\s+\],\n\s+\},\n\s+\];/);
  assert.doesNotMatch(cfg, /middleware|matcher/, 'no middleware change');

  // The config as Next reads it: the same two rules, the site-wide value byte for byte.
  assert.ok(nextConfig.headers, 'headers() exists');
  const rules = await nextConfig.headers();
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0], { source: '/:path*', headers: [{ key: CSP, value: SITE_WIDE_CSP }] });
  assert.deepEqual(rules[1], { source: FILE_PATH, headers: [{ key: CSP, value: 'sandbox' }] });
  assert.doesNotMatch(SITE_WIDE_CSP, /sandbox/, 'the site-wide policy carries no sandbox — the file path alone does');

  // The route's own word stands: fileResponseHeaders still sets the same header (documents01.test.ts pins its value).
  assert.match(code(LEAF), /'Content-Security-Policy': 'sandbox',/);
  assert.match(comments(CONFIG), /DOCUMENTS-01b \(Alex, 2026-10-30, ruling A\)/);
  assert.match(comments(CONFIG), /the LAST one wins/);
});

test('B sizeWords is binary — B under 1,024, KiB under 1,048,576, MiB above, one decimal — and the refusals name both exact byte counts', () => {
  assert.equal(sizeWords(1_234_567), '1.2 MiB');
  assert.equal(sizeWords(48_100), '47.0 KiB');
  assert.equal(sizeWords(999), '999 B');
  assert.equal(sizeWords(1_023), '1023 B');
  assert.equal(sizeWords(1_024), '1.0 KiB');
  assert.equal(sizeWords(1_048_576), '1.0 MiB');
  assert.equal(sizeWords(4_194_304), '4.0 MiB');
  assert.equal(sizeWords(MAX_RECEIPT_BYTES), '4.0 MiB', 'the cap in words');
  const tooLarge = tooLargeWords(4_194_305);
  assert.equal(tooLarge, 'the file is 4,194,305 bytes (4.0 MiB) — the most kept is 4 MiB (4,194,304 bytes)');
  for (const piece of ['4,194,305 bytes', '(4.0 MiB)', 'the most kept is 4 MiB (4,194,304 bytes)']) assert.ok(tooLarge.includes(piece), piece);
  const bodyTooLarge = bodyTooLargeWords(MAX_UPLOAD_BODY_BYTES + 1);
  assert.equal(bodyTooLarge, `the upload is ${(MAX_UPLOAD_BODY_BYTES + 1).toLocaleString('en-US')} bytes (${sizeWords(MAX_UPLOAD_BODY_BYTES + 1)}) — a receipt of at most 4 MiB, with its form, is at most ${MAX_UPLOAD_BODY_BYTES.toLocaleString('en-US')} bytes; refused before it was read`);
  assert.ok(bodyTooLarge.includes('4,210,689 bytes') && bodyTooLarge.includes('4,210,688 bytes') && bodyTooLarge.includes('refused before it was read'));
  assert.equal(MAX_UPLOAD_BODY_BYTES, 4_210_688, 'the cap and the overhead are unchanged');
});

test('B one unit on the screen: no " MB" or " KB" token in the rules or the controls (Vercel’s "4.5 MB" lives in comments alone)', () => {
  for (const f of [LEAF, CONTROLS]) {
    assert.doesNotMatch(code(f), / MB\b/, `${f} says no MB`);
    assert.doesNotMatch(code(f), / KB\b/, `${f} says no KB`);
  }
  assert.match(code(LEAF), /toFixed\(1\)\} KiB`/);
  assert.match(code(LEAF), /toFixed\(1\)\} MiB`/);
  assert.match(comments(LEAF), /Vercel carries a\n \*\s+function body of at most 4\.5 MB/, 'the Vercel words stay, as prose');
  assert.match(comments(LEAF), /"Receipt: <name> · 1\.2 MiB · PDF"/);
  assert.match(comments(CONTROLS), /"Receipt: <name> · 1\.2 MiB · PDF — open · replace"/);
});
