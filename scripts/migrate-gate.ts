/**
 * PREVIEW-DB-01 (Alex, 2026-11-03, ruling B) — THE BUILD'S MIGRATION STEP.
 *
 * package.json's build runs this where it ran `prisma migrate deploy` (typecheck:scripts → the two asserts → prisma
 * generate → THIS → next build). It hands the process environment to the pure gate (src/lib/build/migrationGate.ts),
 * prints the verdict's words FIRST, and then:
 *   · MIGRATE — runs this project's own prisma binary (node_modules/.bin/prisma) with `migrate deploy`, stdio
 *     inherited, and exits with prisma's exit code — a production build migrates exactly as it did before;
 *   · SKIP    — exits 0, and next build follows with no database touched;
 *   · REFUSE  — exits 1, and the build stops before next build.
 * A prisma that does not start, or a signal that stops it, is named and exits 1 — never a pass.
 * It never prints DATABASE_URL or any part of it: the only lines it writes are the gate's words.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { migrationGate, prismaDidNotStartWords, prismaStoppedWords } from '../src/lib/build/migrationGate';

const ROOT = resolve(__dirname, '..');
const PRISMA = resolve(ROOT, 'node_modules', '.bin', 'prisma');

const verdict = migrationGate(process.env);

if (verdict.kind === 'REFUSE') {
  console.error(verdict.words);
  process.exit(1);
}
console.log(verdict.words);
if (verdict.kind === 'SKIP') process.exit(0);

// MIGRATE — the same command the build line ran, in the same place.
const run = spawnSync(PRISMA, ['migrate', 'deploy'], { cwd: ROOT, stdio: 'inherit' });
if (run.error !== undefined) {
  console.error(prismaDidNotStartWords(run.error.message));
  process.exit(1);
}
if (run.status === null) {
  console.error(prismaStoppedWords(String(run.signal)));
  process.exit(1);
}
process.exit(run.status);
