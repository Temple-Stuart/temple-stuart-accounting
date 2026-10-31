// ─── ENV-01 — the site-URL boot check (the secret-guard pattern) ─────────────
// next-auth 4.24.15 builds every OAuth callback and redirect from NEXTAUTH_URL
// (utils/detect-origin.js:9 — it wins over the request host on Vercel since
// that version). GitHub and Google accept only the redirect_uri registered
// with them — the www origin — so a NEXTAUTH_URL whose host is not the app's
// host breaks sign-in with no error on our side. This guard runs once at boot
// (src/instrumentation.ts, Node runtime) and refuses to serve in production
// unless NEXTAUTH_URL is an https origin whose host equals NEXT_PUBLIC_APP_URL's.
//
// Pure over an env record so node:test drives it without touching process.env.
// "Production" is VERCEL_ENV === 'production', or NODE_ENV === 'production'
// off Vercel (a self-host `next start`). A Vercel Preview (VERCEL_ENV
// 'preview') has a per-deploy host and is skipped — its NEXTAUTH_URL cannot be
// pinned; development is skipped.

export class SiteUrlConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SiteUrlConfigError';
  }
}

export type SiteUrlCheck = { checked: false; reason: string } | { checked: true; host: string };

export function isProductionEnv(env: Record<string, string | undefined>): boolean {
  if (env.VERCEL_ENV !== undefined) return env.VERCEL_ENV === 'production';
  return env.NODE_ENV === 'production';
}

const strip = (s: string) => s.replace(/\/+$/, '');

function parseOrigin(name: string, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SiteUrlConfigError(`${name} is not a URL — got '${value}'; set the deployment's https origin (https://www.templestuart.com)`);
  }
  return url;
}

/** Pure: in production, NEXTAUTH_URL must be an https origin (no path, query or hash) whose host equals NEXT_PUBLIC_APP_URL's host; otherwise a SiteUrlConfigError naming the fix. Outside production the check is skipped, declared. */
export function siteUrlGuard(env: Record<string, string | undefined>): SiteUrlCheck {
  if (!isProductionEnv(env)) {
    return { checked: false, reason: `not production (VERCEL_ENV=${env.VERCEL_ENV ?? 'unset'}, NODE_ENV=${env.NODE_ENV ?? 'unset'})` };
  }
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new SiteUrlConfigError('NEXT_PUBLIC_APP_URL is not set — production needs the public origin (https://www.templestuart.com) to check NEXTAUTH_URL against');
  }
  const appHost = parseOrigin('NEXT_PUBLIC_APP_URL', appUrl).host;
  const raw = env.NEXTAUTH_URL;
  if (!raw) {
    throw new SiteUrlConfigError(`NEXTAUTH_URL is not set — next-auth builds every OAuth callback from it; set NEXTAUTH_URL=https://${appHost}`);
  }
  const url = parseOrigin('NEXTAUTH_URL', raw);
  if (url.protocol !== 'https:') {
    throw new SiteUrlConfigError(`NEXTAUTH_URL must be an https origin — got '${raw}'; set NEXTAUTH_URL=https://${appHost}`);
  }
  if (url.origin !== strip(raw)) {
    throw new SiteUrlConfigError(`NEXTAUTH_URL must be a bare origin with no path, query or hash — got '${raw}'; set NEXTAUTH_URL=https://${appHost}`);
  }
  if (url.host !== appHost) {
    throw new SiteUrlConfigError(
      `NEXTAUTH_URL host '${url.host}' does not match NEXT_PUBLIC_APP_URL host '${appHost}' — GitHub and Google receive redirect_uri built from NEXTAUTH_URL and reject a host they were not registered with; set NEXTAUTH_URL=https://${appHost}`,
    );
  }
  return { checked: true, host: url.host };
}
