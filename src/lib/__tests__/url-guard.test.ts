import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { assertPublicHttpUrl, safeFetch, SsrfBlockedError } from '../url-guard';

// SEC-5 SSRF regression suite. Proves the guard blocks the disclosed
// IPv4-mapped-IPv6 (hex) bypass and its whole obfuscation family, that
// legitimate public URLs still pass, and that redirects are re-validated so a
// public URL cannot 302 into an internal target. Hermetic: every ALLOW case is
// an IP literal (no DNS) and the redirect tests use local servers only.

const MUST_BLOCK: string[] = [
  // Disclosed bug: IPv4-mapped IPv6 in hex form (Node normalizes the dotted
  // spelling to this) — loopback and cloud-metadata via ::ffff:
  'http://[::ffff:127.0.0.1]:8080/',
  'http://[::ffff:7f00:1]/',
  'http://[::ffff:169.254.169.254]/',
  'http://[::ffff:a9fe:a9fe]/',
  // Direct private / loopback / link-local / CGNAT (v4 + v6)
  'http://127.0.0.1/',
  'http://169.254.169.254/',
  'http://[::1]/',
  'http://[fd00::1]/',
  'http://[febf::1]/',
  'http://10.0.0.5/',
  'http://192.168.1.1/',
  'http://100.64.0.1/',
  // IPv4-embedded-in-IPv6 transition ranges (NAT64, 6to4)
  'http://[64:ff9b::7f00:1]/',
  'http://[2002:7f00:1::]/',
  // Alternate IPv4 encodings (URL normalizes these to 127.0.0.1)
  'http://2130706433/',
  'http://0x7f000001/',
  'http://0177.0.0.1/',
  // Non-http(s) schemes
  'file:///etc/passwd',
  'gopher://127.0.0.1/',
];

const MUST_ALLOW: string[] = [
  'http://8.8.8.8/',
  'https://1.1.1.1/',
  'http://[2606:4700:4700::1111]/',
];

for (const url of MUST_BLOCK) {
  test(`assertPublicHttpUrl BLOCKS ${url}`, async () => {
    const reason = await assertPublicHttpUrl(url);
    assert.notEqual(reason, null, `expected ${url} to be blocked, but it was allowed`);
  });
}

for (const url of MUST_ALLOW) {
  test(`assertPublicHttpUrl ALLOWS ${url}`, async () => {
    const reason = await assertPublicHttpUrl(url);
    assert.equal(reason, null, `expected ${url} to be allowed, but it was blocked: ${reason}`);
  });
}

// --- Redirect re-validation ------------------------------------------------
function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

test('safeFetch refuses an internal initial URL before any request', async () => {
  // The disclosed hole #2 baseline: a loopback target is rejected by the initial
  // guard and never fetched.
  let internalHits = 0;
  const internal = http.createServer((_req, res) => {
    internalHits++;
    res.end('INTERNAL-SECRET-BODY');
  });
  const internalPort = await listen(internal);
  try {
    await assert.rejects(
      () => safeFetch(`http://127.0.0.1:${internalPort}/`),
      (err: unknown) => err instanceof SsrfBlockedError,
    );
    assert.equal(internalHits, 0, 'a blocked initial URL must never be fetched');
  } finally {
    internal.close();
  }
});

test('safeFetch re-validates redirects and refuses an internal 302 target', async () => {
  // Hole #2: a public entry that 302s to a loopback URL must be blocked ON THE
  // REDIRECT HOP and never read the internal body. Both servers are on loopback,
  // so we inject a validator that permits ONLY the entry origin and delegates
  // every other URL to the REAL guard — the redirect target (a different loopback
  // port) is then blocked by the real assertPublicHttpUrl on the redirect hop.
  // This drives the real safeFetch loop through its per-hop re-validation.
  let internalHits = 0;
  const internal = http.createServer((_req, res) => {
    internalHits++;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('INTERNAL-SECRET-BODY');
  });
  const internalPort = await listen(internal);

  const entry = http.createServer((req, res) => {
    if (req.url === '/redir') {
      res.writeHead(302, { Location: `http://127.0.0.1:${internalPort}/internal` });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const entryPort = await listen(entry);
  const entryOrigin = `http://127.0.0.1:${entryPort}`;

  const validate = async (u: string): Promise<string | null> =>
    u === entryOrigin || u.startsWith(entryOrigin + '/') ? null : assertPublicHttpUrl(u);

  try {
    await assert.rejects(
      () => safeFetch(`${entryOrigin}/redir`, undefined, { validate }),
      (err: unknown) => {
        assert.ok(err instanceof SsrfBlockedError, `expected SsrfBlockedError, got ${err}`);
        return /private or reserved/.test((err as SsrfBlockedError).reason);
      },
    );
    assert.equal(internalHits, 0, 'internal endpoint must never be requested');
  } finally {
    entry.close();
    internal.close();
  }
});

test('safeFetch follows a public redirect chain to the final response', async () => {
  // Legitimate redirects still work: a 302 to another allowed host is followed
  // and the final 200 body is returned. Both hops are on loopback, so both are
  // permitted via the validator seam to exercise the FOLLOW path of the real
  // safeFetch (production callers use the default public-only guard).
  let finalHits = 0;
  const finalServer = http.createServer((_req, res) => {
    finalHits++;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('FINAL-OK');
  });
  const finalPort = await listen(finalServer);

  const entry = http.createServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { Location: `http://127.0.0.1:${finalPort}/final` });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const entryPort = await listen(entry);
  const entryOrigin = `http://127.0.0.1:${entryPort}`;
  const finalOrigin = `http://127.0.0.1:${finalPort}`;

  const validate = async (u: string): Promise<string | null> =>
    u.startsWith(entryOrigin) || u.startsWith(finalOrigin) ? null : 'blocked';

  try {
    const res = await safeFetch(`${entryOrigin}/start`, undefined, { validate });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'FINAL-OK');
    assert.equal(finalHits, 1, 'final endpoint should be reached exactly once');
  } finally {
    entry.close();
    finalServer.close();
  }
});
