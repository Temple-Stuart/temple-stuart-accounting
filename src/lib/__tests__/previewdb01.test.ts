/**
 * PREVIEW-DB-01 (Alex, 2026-11-03, rulings A–E) — a preview build never touches a database. `prisma migrate deploy`
 * runs only when a build says where it is (Vercel production, or BUILD_TARGET=local); a preview handed DATABASE_URL
 * refuses by name; every build prints which it was. The gate is driven over env records (no process environment
 * touched); the script's refusals and its skip run as a real process with a controlled environment — never the migrate
 * path, which would reach a database. Source is read through code() / comments() (the reader law).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import {
  BOTH_SET_WORDS, LOCAL_BUILD_WORDS, NO_TARGET_WORDS, PREVIEW_BUILD_WORDS, PREVIEW_HANDED_DATABASE_WORDS, PRODUCTION_BUILD_WORDS,
  migrationGate, unknownBuildTargetWords, unknownVercelEnvWords,
} from '../build/migrationGate';
import { LIBRARY_READ_ENV } from '../envLaw';

const LEAF = 'src/lib/build/migrationGate.ts';
const SCRIPT = 'scripts/migrate-gate.ts';
const ROOT = resolve(__dirname, '..', '..', '..');
const LOCAL_URL = 'postgresql://postgres@127.0.0.1:54329/ts_journal';

// ── A · THE GATE — every row, its exact words ───────────────────────────────

test('A every row of the gate, with its exact words — Vercel decides on Vercel, BUILD_TARGET off it, nothing migrates unless the build says where it is', () => {
  // VERCEL_ENV production, BUILD_TARGET not set → MIGRATE (whatever DATABASE_URL is: production reads its own).
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'production' }), { kind: 'MIGRATE', words: 'PREVIEW-DB-01 · production build (VERCEL_ENV=production) — applying migrations' });
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'production', DATABASE_URL: LOCAL_URL }), { kind: 'MIGRATE', words: PRODUCTION_BUILD_WORDS });
  // VERCEL_ENV preview, DATABASE_URL absent or '' → SKIP.
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'preview' }), { kind: 'SKIP', words: 'PREVIEW-DB-01 · preview build (VERCEL_ENV=preview) — no database, no migration; production applies migrations after the merge' });
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'preview', DATABASE_URL: '' }), { kind: 'SKIP', words: PREVIEW_BUILD_WORDS });
  // VERCEL_ENV preview, DATABASE_URL non-empty → REFUSE.
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'preview', DATABASE_URL: LOCAL_URL }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · a preview build was handed DATABASE_URL — a preview must never reach a database; untick Preview on DATABASE_URL in Vercel' });
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'preview', DATABASE_URL: ' ' }), { kind: 'REFUSE', words: PREVIEW_HANDED_DATABASE_WORDS });
  // VERCEL_ENV any other value — 'development', a custom name, '' — → REFUSE, naming it.
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'development' }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · VERCEL_ENV="development" is neither production nor preview — refusing to guess' });
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'staging' }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · VERCEL_ENV="staging" is neither production nor preview — refusing to guess' });
  assert.deepEqual(migrationGate({ VERCEL_ENV: '' }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · VERCEL_ENV="" is neither production nor preview — refusing to guess' });
  assert.deepEqual(migrationGate({ VERCEL_ENV: 'Production' }), { kind: 'REFUSE', words: unknownVercelEnvWords('Production') }, 'no case folding: a guess is a guess');
  // VERCEL_ENV not set, BUILD_TARGET local → MIGRATE (the local database).
  assert.deepEqual(migrationGate({ BUILD_TARGET: 'local' }), { kind: 'MIGRATE', words: 'PREVIEW-DB-01 · local build (BUILD_TARGET=local) — applying migrations to the database Prisma reads from DATABASE_URL' });
  assert.deepEqual(migrationGate({ BUILD_TARGET: 'local', DATABASE_URL: LOCAL_URL }), { kind: 'MIGRATE', words: LOCAL_BUILD_WORDS });
  // VERCEL_ENV not set, BUILD_TARGET not set → REFUSE.
  assert.deepEqual(migrationGate({}), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · VERCEL_ENV is not set — a build off Vercel must say BUILD_TARGET=local; refusing to guess' });
  assert.deepEqual(migrationGate({ DATABASE_URL: LOCAL_URL, NODE_ENV: 'production' }), { kind: 'REFUSE', words: NO_TARGET_WORDS }, 'NODE_ENV decides nothing here (not isProductionEnv)');
  // VERCEL_ENV not set, BUILD_TARGET any other value (incl. '') → REFUSE, naming it.
  assert.deepEqual(migrationGate({ BUILD_TARGET: 'production' }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · BUILD_TARGET="production" — its only value is local' });
  assert.deepEqual(migrationGate({ BUILD_TARGET: '' }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · BUILD_TARGET="" — its only value is local' });
  assert.deepEqual(migrationGate({ BUILD_TARGET: 'Local' }), { kind: 'REFUSE', words: unknownBuildTargetWords('Local') });
  // Both set → REFUSE, whatever the values.
  for (const [vercelEnv, buildTarget] of [['production', 'local'], ['preview', 'local'], ['', 'local'], ['production', '']]) {
    assert.deepEqual(migrationGate({ VERCEL_ENV: vercelEnv, BUILD_TARGET: buildTarget }), { kind: 'REFUSE', words: 'PREVIEW-DB-01 · VERCEL_ENV and BUILD_TARGET are both set — Vercel decides on Vercel, BUILD_TARGET off it; refusing' }, `${vercelEnv}/${buildTarget}`);
  }
  assert.equal(BOTH_SET_WORDS, migrationGate({ VERCEL_ENV: 'production', BUILD_TARGET: 'local' }).words);
  // No verdict's words carry the database's address.
  for (const env of [{ VERCEL_ENV: 'preview', DATABASE_URL: LOCAL_URL }, { BUILD_TARGET: 'local', DATABASE_URL: LOCAL_URL }, { VERCEL_ENV: 'production', DATABASE_URL: LOCAL_URL }]) {
    assert.ok(!migrationGate(env).words.includes('127.0.0.1') && !migrationGate(env).words.includes('postgresql://'), JSON.stringify(Object.keys(env)));
  }
});

test('A the leaf is pure over an env record — no process environment, no isProductionEnv, no || default', () => {
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /process\.env/);
  assert.doesNotMatch(comments(LEAF), /process\.env/);
  assert.doesNotMatch(leaf, /\|\|/);
  assert.doesNotMatch(leaf, /\?\? /);
  assert.doesNotMatch(leaf, /from ['"]|require\(/, 'it imports nothing');
  assert.doesNotMatch(leaf, /isProductionEnv/, 'its off-Vercel NODE_ENV rule is not this gate\'s');
  assert.match(comments(LEAF), /isProductionEnv is not reused: its off-Vercel NODE_ENV rule is not this gate's/);
  assert.match(leaf, /export function migrationGate\(env: Readonly<Record<string, string \| undefined>>\): MigrationVerdict \{/);
});

// ── B · THE SCRIPT ──────────────────────────────────────────────────────────

test('B the script hands the process environment to the gate, prints the words first, runs the project\'s own prisma on MIGRATE alone, and prints no part of DATABASE_URL', () => {
  const script = code(SCRIPT);
  assert.match(script, /const verdict = migrationGate\(process\.env\);/);
  assert.match(script, /const PRISMA = resolve\(ROOT, 'node_modules', '\.bin', 'prisma'\);/);
  assert.match(script, /if \(verdict\.kind === 'REFUSE'\) \{\s*console\.error\(verdict\.words\);\s*process\.exit\(1\);\s*\}\s*console\.log\(verdict\.words\);\s*if \(verdict\.kind === 'SKIP'\) process\.exit\(0\);/, 'the words first; a refusal exits 1, a skip 0');
  assert.match(script, /spawnSync\(PRISMA, \['migrate', 'deploy'\], \{ cwd: ROOT, stdio: 'inherit' \}\)/);
  assert.match(script, /process\.exit\(run\.status\);/, 'MIGRATE exits with prisma\'s own code');
  // It never names DATABASE_URL, reads no single variable, and every line it prints is the gate's.
  assert.doesNotMatch(script, /DATABASE_URL/);
  assert.doesNotMatch(script, /process\.env\.|process\.env\[/);
  for (const m of script.matchAll(/console\.(log|error)\(([^;]*)\);/g)) {
    assert.match(m[2], /^(verdict\.words|prismaDidNotStartWords\(run\.error\.message\)|prismaStoppedWords\(String\(run\.signal\)\))$/, `prints only the gate's words: ${m[2]}`);
  }
  assert.doesNotMatch(script, /\|\||\?\? |catch\s*[({]/, 'no default, no catch that turns a refusal into a pass');
});

/** The script as the build runs it, with a controlled environment — the three gate variables taken out, then the case's own. */
function runGate(vars: Record<string, string>): { status: number | null; stdout: string; stderr: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, ...vars };
  for (const name of ['VERCEL_ENV', 'BUILD_TARGET', 'DATABASE_URL']) if (!(name in vars)) delete env[name];
  const run = spawnSync(resolve(ROOT, 'node_modules', '.bin', 'tsx'), [SCRIPT], { cwd: ROOT, env, encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

test('B the script\'s refusals exit 1 and its skip exits 0, each printing its one line first — and none prints the address it was handed', () => {
  const none = runGate({});
  assert.equal(none.status, 1);
  assert.equal(none.stderr.trim(), NO_TARGET_WORDS);
  const handed = runGate({ VERCEL_ENV: 'preview', DATABASE_URL: LOCAL_URL });
  assert.equal(handed.status, 1);
  assert.equal(handed.stderr.trim(), PREVIEW_HANDED_DATABASE_WORDS);
  assert.ok(!`${handed.stdout}${handed.stderr}`.includes('127.0.0.1'), 'no part of the address is printed');
  const development = runGate({ VERCEL_ENV: 'development' });
  assert.equal(development.status, 1);
  assert.equal(development.stderr.trim(), unknownVercelEnvWords('development'));
  const both = runGate({ VERCEL_ENV: 'production', BUILD_TARGET: 'local' });
  assert.equal(both.status, 1);
  assert.equal(both.stderr.trim(), BOTH_SET_WORDS);
  const skip = runGate({ VERCEL_ENV: 'preview' });
  assert.equal(skip.status, 0);
  assert.equal(skip.stdout.trim(), PREVIEW_BUILD_WORDS, 'the skip prints its words and runs nothing after them');
});

// ── C · THE BUILD LINE ──────────────────────────────────────────────────────

test('C the build line: the gate where `prisma migrate deploy` stood — between prisma generate and next build — and no `migrate deploy` anywhere in package.json', () => {
  const pkg = JSON.parse(code('package.json')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts.build, 'npm run typecheck:scripts && tsx scripts/assert-showroom-fetch-free.ts && tsx scripts/assert-tool-registry.ts && prisma generate && tsx scripts/migrate-gate.ts && next build');
  const steps = pkg.scripts.build.split(' && ');
  assert.equal(steps.indexOf('tsx scripts/migrate-gate.ts'), steps.indexOf('prisma generate') + 1);
  assert.equal(steps.indexOf('next build'), steps.indexOf('tsx scripts/migrate-gate.ts') + 1);
  assert.doesNotMatch(code('package.json'), /migrate deploy/);
  assert.equal(pkg.scripts.postinstall, 'prisma generate');
  assert.equal(pkg.scripts['vercel-build'], undefined, 'no second build command for Vercel to prefer');
});

// ── D · THE ENV LAW ─────────────────────────────────────────────────────────

test('D the env law names the gate as a reader of DATABASE_URL and VERCEL_ENV, and declares BUILD_TARGET with its README row', () => {
  const entry = (name: string) => {
    const e = LIBRARY_READ_ENV.find((x) => x.name === name);
    assert.ok(e, name);
    return e;
  };
  assert.equal(entry('DATABASE_URL').readBy, 'prisma · the migration gate');
  assert.equal(entry('VERCEL_ENV').readBy, 'the boot check · the migration gate');
  assert.equal(entry('BUILD_TARGET').readBy, 'the migration gate');
  assert.equal(entry('BUILD_TARGET').need, 'optional');
  for (const name of ['DATABASE_URL', 'VERCEL_ENV', 'BUILD_TARGET']) assert.match(entry(name).where, /src\/lib\/build\/migrationGate\.ts through scripts\/migrate-gate\.ts at build/, name);
  const readme = code('README.md');
  for (const name of ['DATABASE_URL', 'VERCEL_ENV', 'BUILD_TARGET']) {
    const row = readme.split('\n').find((l) => l.startsWith(`| \`${name}\` |`));
    assert.ok(row, `${name} has its README row`);
    assert.ok(row.includes(entry(name).readBy), `${name}'s row names ${entry(name).readBy}`);
  }
});
