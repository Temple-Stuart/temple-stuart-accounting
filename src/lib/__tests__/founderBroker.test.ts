import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOUNDER_BROKER_LINE, FOUNDER_BROKER_REASON, runScanForViewer, scanGate } from '../tastytrade/founderBroker';

// TT-01 — the scanner runs on the founder's broker, and says so. Hermetic, the
// discoveryGate.test.ts idiom (src/lib/__tests__/discoveryGate.test.ts:17-19):
// "the call is a spy that must stay un-invoked when a gate refuses".

const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

test('a non-admin is refused BEFORE the pipeline — the paid call is never invoked', async () => {
  let calls = 0;
  const run = async () => { calls += 1; return { ran: true }; };
  const out = await runScanForViewer(false, run);
  assert.equal(out.refused, true);
  if (out.refused) {
    assert.equal(out.reason, FOUNDER_BROKER_REASON);
    assert.equal(out.line, FOUNDER_BROKER_LINE);
  }
  assert.equal(calls, 0, 'zero upstream calls for a refused viewer');
});

test('the admin runs, and the pipeline is invoked exactly once', async () => {
  let calls = 0;
  const run = async () => { calls += 1; return { ran: true }; };
  const out = await runScanForViewer(true, run);
  assert.equal(out.refused, false);
  if (!out.refused) assert.deepEqual(out.result, { ran: true });
  assert.equal(calls, 1);
  assert.deepEqual(scanGate(true), { refused: false });
});

test('the stated line is customer copy — no path, no env name, no fallback wording', () => {
  assert.doesNotMatch(FOUNDER_BROKER_LINE, /\.tsx?:|src\/|TASTYTRADE_|process\.env/);
  assert.doesNotMatch(FOUNDER_BROKER_LINE, /fallback|partial/i);
  assert.match(FOUNDER_BROKER_LINE, /founder's broker/);
});

test('the route refuses at both fire points with the ONE line, before the cache and the quota', () => {
  const route = code('src/app/api/trading/convergence/route.ts');
  const gateAt = route.indexOf('requireAdmin()');
  assert.ok(gateAt > 0, 'the scan route asks requireAdmin');
  // The CALL sites, not the helper definitions at the top of the file.
  for (const later of ['getFromCache(gateUser', 'requireScanRateLimit(', 'runPipeline(']) {
    assert.ok(route.indexOf(later) > gateAt, `${later} comes after the admin gate`);
  }
  // SSE path: the line is the stream's one error event (EventSource cannot show a 403).
  assert.match(route, /step: 'error', label: gate\.line/);
  // JSON path: a 403 carrying the same const.
  assert.match(route, /NextResponse\.json\(\{ error: FOUNDER_BROKER_LINE, reason: FOUNDER_BROKER_REASON \}, \{ status: 403/);
  // No second copy of the sentence anywhere — one const, no drift.
  for (const f of ['src/app/api/trading/convergence/route.ts', 'src/components/trading/ScanFilterForm.tsx']) {
    assert.ok(!src(f).includes("founder's broker until"), `${f} reads the const, it does not retype the line`);
  }
});

test('the scan cache is keyed by the user — one viewer\'s rows never serve another', () => {
  const route = code('src/app/api/trading/convergence/route.ts');
  assert.match(route, /function getCacheKey\(userId: string, limit: number/);
  assert.match(route, /`convergence_\$\{userId\}_\$\{limit\}/);
  assert.equal((route.match(/gateUser\.id, limit/g) ?? []).length, 3, 'every get and set passes the user');
});

test('the form says the line to a non-admin on both mounts, from the same const', () => {
  const form = code('src/components/trading/ScanFilterForm.tsx');
  assert.match(form, /data-founder-broker/);
  assert.match(form, /\{FOUNDER_BROKER_LINE\}/);
  // The cockpit mount hides the header, so the line lives in the form body, by the Scan button.
  assert.ok(form.indexOf('data-founder-broker') < form.indexOf('onClick={runScan}'), 'the line sits above the Scan button, inside formBody');
  assert.match(code('src/components/home/ModuleLauncher.tsx'), /founderBroker=\{authed === true && !isAdmin\}/);
  assert.match(code('src/app/trading/page.tsx'), /founderBroker=\{!isOwner\}/);
});

test('connect already refuses a non-admin server-side (SEC4) — no placeholder row can be created by one', () => {
  const connect = code('src/app/api/tastytrade/connect/route.ts');
  assert.ok(connect.indexOf('requireAdmin()') < connect.indexOf('tastytrade_connections.upsert'), 'the gate precedes the write');
  // And what the row holds when it IS written: the literal marker, not a credential.
  assert.match(src('src/app/api/tastytrade/connect/route.ts'), /sessionToken: encryptToken\('oauth'\)/);
});
