import test from 'node:test';
import assert from 'node:assert/strict';
import { SiteUrlConfigError, isProductionEnv, siteUrlGuard } from '../siteUrlGuard';

// ENV-01 — the site-URL boot check, pure over an env record.

const PROD = { VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://www.templestuart.com' };

test('production is VERCEL_ENV production, or NODE_ENV production off Vercel; a Preview and development are not', () => {
  assert.equal(isProductionEnv({ VERCEL_ENV: 'production' }), true);
  assert.equal(isProductionEnv({ NODE_ENV: 'production' }), true);
  assert.equal(isProductionEnv({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }), false);
  assert.equal(isProductionEnv({ VERCEL_ENV: 'development' }), false);
  assert.equal(isProductionEnv({ NODE_ENV: 'development' }), false);
  assert.equal(isProductionEnv({}), false);
});

test('outside production the check is skipped and says so', () => {
  assert.deepEqual(siteUrlGuard({ NODE_ENV: 'development', NEXTAUTH_URL: 'http://localhost:3000' }), { checked: false, reason: 'not production (VERCEL_ENV=unset, NODE_ENV=development)' });
  assert.deepEqual(siteUrlGuard({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }), { checked: false, reason: 'not production (VERCEL_ENV=preview, NODE_ENV=production)' });
});

test('the good production value passes and names the host; a trailing slash is tolerated', () => {
  assert.deepEqual(siteUrlGuard({ ...PROD, NEXTAUTH_URL: 'https://www.templestuart.com' }), { checked: true, host: 'www.templestuart.com' });
  assert.deepEqual(siteUrlGuard({ ...PROD, NEXTAUTH_URL: 'https://www.templestuart.com/' }), { checked: true, host: 'www.templestuart.com' });
});

const refuses = (env: Record<string, string | undefined>, re: RegExp) =>
  assert.throws(() => siteUrlGuard(env), (e: unknown) => {
    assert.ok(e instanceof SiteUrlConfigError, `SiteUrlConfigError, got ${String(e)}`);
    assert.equal(e.name, 'SiteUrlConfigError');
    assert.match(e.message, re);
    return true;
  });

test('the bare domain that broke sign-in is refused with the fix named', () => {
  refuses({ ...PROD, NEXTAUTH_URL: 'https://templestuart.com' }, /host 'templestuart\.com' does not match NEXT_PUBLIC_APP_URL host 'www\.templestuart\.com'.*set NEXTAUTH_URL=https:\/\/www\.templestuart\.com/);
  refuses({ ...PROD, NEXTAUTH_URL: 'templestuart.com' }, /NEXTAUTH_URL is not a URL — got 'templestuart\.com'/);
});

test('absence, http, a path, and any other host are refused, each with a named message', () => {
  refuses({ ...PROD }, /NEXTAUTH_URL is not set — next-auth builds every OAuth callback from it; set NEXTAUTH_URL=https:\/\/www\.templestuart\.com/);
  refuses({ ...PROD, NEXTAUTH_URL: '' }, /NEXTAUTH_URL is not set/);
  refuses({ ...PROD, NEXTAUTH_URL: 'http://www.templestuart.com' }, /must be an https origin — got 'http:\/\/www\.templestuart\.com'/);
  refuses({ ...PROD, NEXTAUTH_URL: 'https://www.templestuart.com/api/auth' }, /bare origin with no path, query or hash — got 'https:\/\/www\.templestuart\.com\/api\/auth'/);
  refuses({ ...PROD, NEXTAUTH_URL: 'https://www.templestuart.com?x=1' }, /bare origin/);
  refuses({ ...PROD, NEXTAUTH_URL: 'https://staging.templestuart.com' }, /host 'staging\.templestuart\.com' does not match/);
  refuses({ VERCEL_ENV: 'production', NEXTAUTH_URL: 'https://www.templestuart.com' }, /NEXT_PUBLIC_APP_URL is not set — production needs the public origin/);
  refuses({ VERCEL_ENV: 'production', NEXT_PUBLIC_APP_URL: 'not a url', NEXTAUTH_URL: 'https://www.templestuart.com' }, /NEXT_PUBLIC_APP_URL is not a URL/);
});
