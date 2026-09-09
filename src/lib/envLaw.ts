// ─── THE ENV LAW — variables a DEPENDENCY reads (ENV-01) ─────────────────────
// The README's env table derives from a grep of `process.env.<NAME>` literals in
// src/ (scripts/assert-tool-registry.ts, the env law at build; readme-gen).
// A variable a dependency reads for us is invisible to that grep — and it was
// exactly such a variable that broke sign-in: next-auth 4.24.15 added one line
// to utils/detect-origin.js (return NEXTAUTH_URL first, before the forwarded
// host), so the OAuth callback origin stopped following the request host on
// Vercel and started following NEXTAUTH_URL, whose
// nine-month-old value was the bare domain. GitHub rejected the redirect_uri
// and no test caught it.
//
// This const is the declared list of every such variable: who reads it, where
// (the file in node_modules, so the claim is checkable), whether the app needs
// it, and the shape it must have. The build's env law requires every entry to
// be documented in README.md's Self-hosting section, and refuses a name that is
// BOTH declared here and read as a literal in src (it would not be library-read).
// src/lib/siteUrlGuard.ts enforces NEXTAUTH_URL's shape at boot in production.

export type EnvNeed = 'required' | 'optional' | 'platform';

export interface LibraryReadEnv {
  name: string;
  /** The package (or file) that reads it. */
  readBy: string;
  /** Where in that package — a path under node_modules or the repo, so the claim is checkable. */
  where: string;
  /** required: the app does not work without it; optional: changes behavior when set; platform: the host sets it, never by hand. */
  need: EnvNeed;
  /** The value's expected shape — and, for a required one, the production value's rule. */
  shape: string;
}

export const LIBRARY_READ_ENV: readonly LibraryReadEnv[] = [
  {
    name: 'DATABASE_URL',
    readBy: 'prisma',
    where: 'prisma/schema.prisma:12 `url = env("DATABASE_URL")` — the client and every migration',
    need: 'required',
    shape: 'postgresql://user:password@host:5432/db?sslmode=require (Azure Postgres requires SSL)',
  },
  {
    name: 'NEXTAUTH_URL',
    readBy: 'next-auth',
    where: 'utils/detect-origin.js:9 (the origin of every OAuth callback and redirect — since 4.24.15 it wins over the request host on Vercel), jwt/index.js:65 (secure-cookie decision), react/index.js:53-54 (client base URL)',
    need: 'required',
    shape: 'the deployment\'s https origin with no path — its host must equal NEXT_PUBLIC_APP_URL\'s (https://www.templestuart.com in production; a bare templestuart.com is refused at boot by src/lib/siteUrlGuard.ts)',
  },
  {
    name: 'NEXTAUTH_URL_INTERNAL',
    readBy: 'next-auth',
    where: 'react/index.js:55-56 (server-side fetch base when the public origin is not reachable from the server)',
    need: 'optional',
    shape: 'an http(s) origin; unset here',
  },
  {
    name: 'AUTH_TRUST_HOST',
    readBy: 'next-auth',
    where: 'utils/detect-origin.js:10 (trust x-forwarded-host when NEXTAUTH_URL is unset)',
    need: 'optional',
    shape: 'unset — NEXTAUTH_URL rules the origin; never set this to paper over a wrong NEXTAUTH_URL',
  },
  {
    name: 'AUTH_SECRET',
    readBy: 'next-auth',
    where: 'next/index.js:17,49,128 (the fallback when options.secret is unset — ours is JWT_SECRET, so this is never consulted)',
    need: 'optional',
    shape: 'unset — SECRET-01: JWT_SECRET is the one session secret',
  },
  {
    name: 'VERCEL',
    readBy: 'next-auth',
    where: 'utils/detect-origin.js:10 (trust the forwarded host when NEXTAUTH_URL is unset), jwt/index.js:65 (secure cookies)',
    need: 'platform',
    shape: '"1" on Vercel; set by the host',
  },
  {
    name: 'VERCEL_URL',
    readBy: 'next-auth',
    where: 'react/index.js:53 (client base URL fallback when NEXTAUTH_URL is unset)',
    need: 'platform',
    shape: '<deployment>.vercel.app, set by the host — never the production origin',
  },
  {
    name: 'VERCEL_ENV',
    readBy: 'the boot check',
    where: 'src/lib/siteUrlGuard.ts (through the env record: production / preview / development — the NEXTAUTH_URL check runs for production only, a Preview has a per-deploy host)',
    need: 'platform',
    shape: 'production / preview / development; set by the host',
  },
  {
    name: 'PORT',
    readBy: 'next',
    where: 'dist/server/lib/start-server.js (`next start` — self-hosting only; Vercel runs its own runtime)',
    need: 'platform',
    shape: 'a port number; set by the host',
  },
  {
    name: 'HOSTNAME',
    readBy: 'next',
    where: 'dist/build/utils.js (`next start` bind host — self-hosting only)',
    need: 'platform',
    shape: 'a hostname; set by the host',
  },
];

/** Names read through a computed key, not a literal — the grep cannot see them either. */
export const DYNAMIC_READ_ENV: ReadonlyArray<{ name: string; where: string }> = [
  { name: 'STRIPE_BUNDLE_ALL_PRICE_ID', where: 'process.env[entitlementPriceEnvName(key)], src/lib/stripe.ts' },
];

export class EnvLawError extends Error {
  constructor(message: string) {
    super(`ENV LAW: ${message}`);
    this.name = 'EnvLawError';
  }
}

/** The const's own law — run at module scope so a malformed entry fails the import, the tests and the build alike. */
export function envLaw(entries: readonly LibraryReadEnv[] = LIBRARY_READ_ENV): void {
  const seen = new Set<string>();
  for (const e of entries) {
    if (!/^[A-Z][A-Z0-9_]+$/.test(e.name)) throw new EnvLawError(`'${e.name}' is not an env name`);
    if (seen.has(e.name)) throw new EnvLawError(`${e.name} is declared twice`);
    seen.add(e.name);
    for (const field of ['readBy', 'where', 'shape'] as const) {
      if (!e[field].trim()) throw new EnvLawError(`${e.name}: ${field} is empty`);
    }
    if (!['required', 'optional', 'platform'].includes(e.need)) throw new EnvLawError(`${e.name}: need '${e.need}' is not required | optional | platform`);
  }
}
envLaw();
