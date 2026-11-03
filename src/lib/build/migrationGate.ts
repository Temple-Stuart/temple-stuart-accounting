/**
 * PREVIEW-DB-01 (Alex, 2026-11-03, ruling A) — THE MIGRATION GATE, PURE.
 *
 * Two migrations reached production about seventy seconds into their branches' PREVIEW builds, before their PRs
 * existed: the build ran `prisma migrate deploy` on every Vercel build, and the Preview scope carried production's
 * DATABASE_URL. This leaf decides, once per build, whether the build may migrate. Nothing migrates unless the build
 * says where it is: Vercel decides on Vercel (VERCEL_ENV), BUILD_TARGET decides off it.
 *
 *   VERCEL_ENV        BUILD_TARGET    DATABASE_URL      verdict
 *   production        not set         —                 MIGRATE
 *   preview           not set         absent or ''      SKIP
 *   preview           not set         non-empty         REFUSE — a preview must never reach a database
 *   any other value   not set         —                 REFUSE — refusing to guess
 *   not set           local           —                 MIGRATE
 *   not set           not set         —                 REFUSE — a build off Vercel must say BUILD_TARGET=local
 *   not set           any other       —                 REFUSE — its only value is local
 *   set               set             —                 REFUSE — both set
 *
 * "Not set" is undefined; an empty string is a value, and refuses like any other. Pure over an env record (the
 * siteUrlGuard.ts shape): node:test drives it without touching the process environment, and scripts/migrate-gate.ts
 * hands it the real one, prints the verdict's words first and runs `prisma migrate deploy` on MIGRATE alone. It reads
 * whether DATABASE_URL is there, never what it says, and no words here carry it.
 * siteUrlGuard.ts isProductionEnv is not reused: its off-Vercel NODE_ENV rule is not this gate's — off Vercel, only BUILD_TARGET=local migrates.
 */

export type MigrationVerdictKind = 'MIGRATE' | 'SKIP' | 'REFUSE';

export interface MigrationVerdict {
  readonly kind: MigrationVerdictKind;
  /** The one line every build prints first, naming which build it was. */
  readonly words: string;
}

// ── THE WORDS — one per verdict, every one printed first by scripts/migrate-gate.ts ──

export const PRODUCTION_BUILD_WORDS = 'PREVIEW-DB-01 · production build (VERCEL_ENV=production) — applying migrations';
export const PREVIEW_BUILD_WORDS = 'PREVIEW-DB-01 · preview build (VERCEL_ENV=preview) — no database, no migration; production applies migrations after the merge';
export const PREVIEW_HANDED_DATABASE_WORDS = 'PREVIEW-DB-01 · a preview build was handed DATABASE_URL — a preview must never reach a database; untick Preview on DATABASE_URL in Vercel';
export const unknownVercelEnvWords = (value: string): string => `PREVIEW-DB-01 · VERCEL_ENV=${JSON.stringify(value)} is neither production nor preview — refusing to guess`;
export const LOCAL_BUILD_WORDS = 'PREVIEW-DB-01 · local build (BUILD_TARGET=local) — applying migrations to the database Prisma reads from DATABASE_URL';
export const NO_TARGET_WORDS = 'PREVIEW-DB-01 · VERCEL_ENV is not set — a build off Vercel must say BUILD_TARGET=local; refusing to guess';
export const unknownBuildTargetWords = (value: string): string => `PREVIEW-DB-01 · BUILD_TARGET=${JSON.stringify(value)} — its only value is local`;
export const BOTH_SET_WORDS = 'PREVIEW-DB-01 · VERCEL_ENV and BUILD_TARGET are both set — Vercel decides on Vercel, BUILD_TARGET off it; refusing';
/** The script's own two failures after a MIGRATE verdict: prisma did not start, or a signal stopped it. Neither is a pass. */
export const prismaDidNotStartWords = (reason: string): string => `PREVIEW-DB-01 · prisma migrate deploy did not start — ${reason}`;
export const prismaStoppedWords = (signal: string): string => `PREVIEW-DB-01 · prisma migrate deploy was stopped by ${signal} — nothing is known to have applied`;

/** BUILD_TARGET's one value — the build off Vercel that applies migrations. */
export const LOCAL_BUILD_TARGET = 'local';

const verdict = (kind: MigrationVerdictKind, words: string): MigrationVerdict => ({ kind, words });

/** Ruling A: the build's verdict, from where it says it is. Vercel decides on Vercel; BUILD_TARGET decides off it. */
export function migrationGate(env: Readonly<Record<string, string | undefined>>): MigrationVerdict {
  const vercelEnv = env.VERCEL_ENV;
  const buildTarget = env.BUILD_TARGET;
  if (vercelEnv !== undefined && buildTarget !== undefined) return verdict('REFUSE', BOTH_SET_WORDS);

  if (vercelEnv !== undefined) {
    if (vercelEnv === 'production') return verdict('MIGRATE', PRODUCTION_BUILD_WORDS);
    if (vercelEnv === 'preview') {
      const databaseUrl = env.DATABASE_URL;
      const handedDatabase = databaseUrl !== undefined && databaseUrl !== '';
      return handedDatabase ? verdict('REFUSE', PREVIEW_HANDED_DATABASE_WORDS) : verdict('SKIP', PREVIEW_BUILD_WORDS);
    }
    return verdict('REFUSE', unknownVercelEnvWords(vercelEnv));
  }

  if (buildTarget === undefined) return verdict('REFUSE', NO_TARGET_WORDS);
  if (buildTarget === LOCAL_BUILD_TARGET) return verdict('MIGRATE', LOCAL_BUILD_WORDS);
  return verdict('REFUSE', unknownBuildTargetWords(buildTarget));
}
