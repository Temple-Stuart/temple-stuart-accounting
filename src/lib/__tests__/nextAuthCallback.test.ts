import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { buildAuthOptions } from '../auth/nextAuthOptions';

// ENV-01 — the OAuth callback test. next-auth 4.24.15 builds every authorize
// URL's redirect_uri from NEXTAUTH_URL (utils/detect-origin.js:9 — it wins over
// the request host on Vercel since that version). GitHub and Google accept only
// the redirect_uri registered with them — the app's own origin — so this test
// drives next-auth's core handler with THE configured options
// (src/lib/auth/nextAuthOptions.ts) and asserts, for both providers, that the
// redirect_uri host equals NEXTAUTH_URL's host AND the app's host
// (NEXT_PUBLIC_APP_URL). Run with NEXTAUTH_URL=https://templestuart.com (the
// bare-domain value that broke sign-in) and it fails.
//
// Hermetic: the only network call next-auth would make — Google's OpenID
// discovery — is stubbed at openid-client's Issuer.discover; everything else
// (csrf, state, pkce, the URL) is next-auth's own code.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.templestuart.com';
process.env.NEXTAUTH_URL ??= APP_URL;
process.env.JWT_SECRET ??= 'env01-callback-test-secret';
process.env.GOOGLE_CLIENT_ID ??= 'google-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET ??= 'google-client-secret';
process.env.GITHUB_CLIENT_ID ??= 'Iv1.githubclientid';
process.env.GITHUB_CLIENT_SECRET ??= 'github-client-secret';

const appHost = new URL(APP_URL).host;
const nextauthHost = new URL(process.env.NEXTAUTH_URL!).host;

// next-auth's core is not in its exports map — the route wrapper requires it by
// path, and so does this test (an absolute require bypasses the exports map).
const req = createRequire(resolve(process.cwd(), 'package.json'));
const { AuthHandler } = req(resolve(process.cwd(), 'node_modules/next-auth/core/index.js')) as {
  AuthHandler: (params: { req: Record<string, unknown>; options: unknown }) => Promise<{ status?: number; body?: unknown; redirect?: string; cookies?: Array<{ name: string; value: string }> }>;
};
const { Issuer } = req('openid-client') as { Issuer: { discover: (uri: string) => Promise<unknown>; new (meta: Record<string, string>): unknown } };

const discovered: string[] = [];
mock.method(Issuer, 'discover', async (uri: string) => {
  discovered.push(uri);
  return new Issuer({
    issuer: 'https://accounts.google.com',
    authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    token_endpoint: 'https://oauth2.googleapis.com/token',
    userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
  });
});

const options = buildAuthOptions({
  prisma: {} as PrismaClient, // never touched by the authorize step
  setSessionCookie: async () => { throw new Error('the authorize step must not set a session cookie'); },
});

// The request as the route wrapper hands it to the core: the app's host, https.
const headers = { host: appHost, 'x-forwarded-host': appHost, 'x-forwarded-proto': 'https' };

async function authorizeUrl(providerId: 'github' | 'google'): Promise<URL> {
  const csrf = await AuthHandler({ req: { method: 'GET', action: 'csrf', headers, cookies: {}, query: {} }, options });
  const csrfToken = (csrf.body as { csrfToken: string }).csrfToken;
  const cookie = csrf.cookies?.[0];
  assert.ok(csrfToken && cookie, 'the csrf step returns a token and its cookie');
  const res = await AuthHandler({
    req: { method: 'POST', action: 'signin', providerId, headers, cookies: { [cookie.name]: cookie.value }, body: { csrfToken, callbackUrl: `${APP_URL}/` }, query: {} },
    options,
  });
  assert.ok(res.redirect, `signin/${providerId} redirects to the provider (got status ${res.status ?? 'none'}: ${JSON.stringify(res.body ?? null).slice(0, 200)})`);
  return new URL(res.redirect);
}

for (const [providerId, authorize] of [
  ['github', 'https://github.com/login/oauth/authorize'],
  ['google', 'https://accounts.google.com/o/oauth2/v2/auth'],
] as const) {
  test(`${providerId}: the authorize URL's redirect_uri is https://<NEXTAUTH_URL host>/api/auth/callback/${providerId}, and that host is the app's`, async () => {
    const url = await authorizeUrl(providerId);
    assert.equal(`${url.origin}${url.pathname}`, authorize, 'the provider endpoint');
    const redirectUri = url.searchParams.get('redirect_uri');
    assert.ok(redirectUri, 'redirect_uri is present');
    const cb = new URL(redirectUri);
    assert.equal(cb.protocol, 'https:');
    assert.equal(cb.pathname, `/api/auth/callback/${providerId}`);
    assert.equal(cb.host, nextauthHost, 'redirect_uri host === NEXTAUTH_URL host (next-auth builds it from NEXTAUTH_URL)');
    assert.equal(cb.host, appHost, `redirect_uri host === the app's host (NEXT_PUBLIC_APP_URL) — NEXTAUTH_URL=${process.env.NEXTAUTH_URL} would send ${providerId} a callback host the provider was not registered with`);
    assert.ok(url.searchParams.get('state'), 'the state check is armed');
    assert.equal(url.searchParams.get('client_id'), providerId === 'github' ? process.env.GITHUB_CLIENT_ID : process.env.GOOGLE_CLIENT_ID);
  });
}

test('the only network call — Google discovery — was stubbed, once, at its documented URL', () => {
  assert.deepEqual(discovered, ['https://accounts.google.com/.well-known/openid-configuration']);
});
