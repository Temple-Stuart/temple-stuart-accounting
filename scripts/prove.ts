/**
 * prove — THE PROOF HARNESS (ACTIVITY-01 STEP 4c, 2026-09-22).
 *
 * A law is only a law if a regression it forbids actually fails it. The proof of
 * that is a SEEDED REGRESSION: change one exact string in one file, run the law
 * suite, and read back the violation the law is supposed to raise. Until now that
 * ran as a bash loop over the working tree — one law run per seed, serially, each
 * seed mutating the repo and restoring it afterwards. 16 seeds cost 16 law runs
 * back to back while three of the machine's four cores sat idle.
 *
 *   npx tsx scripts/prove.ts --law=activity [--workers=8]
 *
 * Each seed runs in its OWN GIT WORKTREE under .proofs/ (gitignored), with
 * node_modules symlinked back to the repo's. The working tree is never touched:
 * the harness snapshots the sha256 of every file a seed names before it starts and
 * refuses to report a pass if any of them moved, and it refuses to finish while a
 * worktree it made is still registered.
 *
 * THE RULE THIS HARNESS EXISTS TO MAKE CHEAP, AND THE RULE THAT BOUNDS IT:
 *
 *   A PR PROVES THE CLAUSES IT ADDS OR CHANGES. A law's existing seeds are
 *   re-run only when that law's SOURCE changes. Earlier proofs stand on the PRs
 *   that ran them — they were run there, reported there, and merged there; they
 *   are not re-litigated by every later PR that happens to touch a neighbouring
 *   file. A seed is written once, lives beside its law in
 *   scripts/proofs/<law>.seeds.ts, and is re-run when that law is edited.
 *
 * A seed is { name, file, find, replace, expect }: `find` is an EXACT string that
 * must occur EXACTLY ONCE in `file` — not once-or-more, and never zero times. A
 * seed whose find does not occur exactly once is a HARNESS FAILURE, not a skipped
 * seed: a proof that silently stops applying is worse than no proof, because it
 * still prints a line. `expect` is the substring of the violation the law must
 * raise; a seed is CAUGHT when the suite exits non-zero AND its output holds that
 * substring, so a seed that fails some OTHER law is not counted as caught.
 *
 * MEASURED, on 4 cores (ACTIVITY-01 STEP 4c): one law run is ~38.6s wall, and two
 * run concurrently in ~38.5s wall for BOTH — the suite is single-threaded and the
 * machine is idle while a serial loop waits on it. That is the whole reason this
 * exists.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');
const PROOF_DIR = resolve(ROOT, '.proofs');
const LAW_SUITE = 'scripts/assert-tool-registry.ts';

export interface Seed {
  /** What the regression IS, in the words the report prints. */
  name: string;
  /** The file it changes, relative to the repo root. */
  file: string;
  /** An exact string that must occur EXACTLY ONCE in that file. */
  find: string;
  /** What it becomes. */
  replace: string;
  /** A substring of the violation the law must raise. */
  expect: string;
}

const arg = (name: string): string | null => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const readAt = (dir: string, file: string): string => readFileSync(resolve(dir, file), 'utf8');

function git(args: string[], cwd = ROOT): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Every worktree this harness has registered, so it can prove it left none behind. */
function proofWorktrees(): string[] {
  return git(['worktree', 'list', '--porcelain'])
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length))
    .filter((p) => p.startsWith(PROOF_DIR));
}

/**
 * A worktree that matches the WORKING TREE, not just HEAD: the seeds prove the law
 * as it stands in this PR, including everything not yet committed. Tracked changes
 * arrive as a patch; files git does not track are copied in by name.
 */
function makeWorktree(index: number, extraFiles: string[]): string {
  const dir = resolve(PROOF_DIR, `wt-${index}`);
  rmSync(dir, { recursive: true, force: true });
  git(['worktree', 'add', '--detach', '--quiet', dir, 'HEAD']);
  symlinkSync(resolve(ROOT, 'node_modules'), resolve(dir, 'node_modules'));
  const patch = git(['diff', 'HEAD', '--binary']);
  if (patch.trim() !== '') {
    const patchFile = resolve(PROOF_DIR, `wt-${index}.patch`);
    writeFileSync(patchFile, patch);
    git(['apply', '--whitespace=nowarn', patchFile], dir);
    rmSync(patchFile, { force: true });
  }
  for (const f of extraFiles) {
    const from = resolve(ROOT, f);
    if (!existsSync(from)) continue;
    mkdirSync(resolve(dir, f, '..'), { recursive: true });
    cpSync(from, resolve(dir, f));
  }
  return dir;
}

interface Result { seed: Seed; caught: boolean; why: string; ms: number }

/** The law suite, run as a CHILD so the lanes actually overlap — spawnSync would serialize them. */
function runSuite(dir: string): Promise<{ status: number | null; output: string }> {
  return new Promise((done) => {
    const child = spawn('npx', ['tsx', LAW_SUITE], { cwd: dir });
    let output = '';
    child.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { output += d.toString(); });
    child.on('close', (status) => done({ status, output }));
  });
}

async function runSeed(dir: string, seed: Seed): Promise<Result> {
  const before = readAt(dir, seed.file);
  const hits = before.split(seed.find).length - 1;
  if (hits !== 1) throw new Error(`HARNESS FAILURE — seed "${seed.name}": its find occurs ${hits} time(s) in ${seed.file}, and a seed must name exactly one place`);
  writeFileSync(resolve(dir, seed.file), before.replace(seed.find, seed.replace));
  const started = Date.now();
  const run = await runSuite(dir);
  const ms = Date.now() - started;
  const output = run.output;
  writeFileSync(resolve(dir, seed.file), before);
  if (sha(readAt(dir, seed.file)) !== sha(before)) throw new Error(`HARNESS FAILURE — seed "${seed.name}" did not restore ${seed.file} byte-for-byte`);
  const failed = run.status !== 0;
  const named = output.includes(seed.expect);
  const why = !failed ? 'the suite passed — the law does not forbid this'
    : !named ? `the suite failed, but on something else — no violation held "${seed.expect}"`
    : '';
  return { seed, caught: failed && named, why, ms };
}

async function main(): Promise<void> {
  const law = arg('law');
  if (!law) { console.error('usage: npx tsx scripts/prove.ts --law=<name> [--workers=8]'); process.exit(2); }
  const seedsPath = resolve(ROOT, 'scripts/proofs', `${law}.seeds.ts`);
  if (!existsSync(seedsPath)) { console.error(`no seeds for "${law}" — expected scripts/proofs/${law}.seeds.ts`); process.exit(2); }
  // tsx compiles to CommonJS, so a dynamic import can hand back the module under
  // `default`; unwrap one layer before looking for the seeds.
  type SeedModule = { SEEDS?: Seed[]; default?: Seed[] | SeedModule };
  const loaded = (await import(seedsPath)) as SeedModule;
  const inner = (loaded.SEEDS ? loaded : (loaded.default && !Array.isArray(loaded.default) ? loaded.default : loaded)) as SeedModule;
  const seeds = inner.SEEDS ?? (Array.isArray(inner.default) ? inner.default : []);
  if (seeds.length === 0) { console.error(`scripts/proofs/${law}.seeds.ts exports no seeds`); process.exit(2); }

  // The working tree is the thing being proved AND the thing that must not move.
  const touched = [...new Set(seeds.map((s) => s.file))].sort();
  const beforeHashes = new Map(touched.map((f) => [f, sha(readAt(ROOT, f))] as const));
  for (const seed of seeds) {
    const hits = readAt(ROOT, seed.file).split(seed.find).length - 1;
    if (hits !== 1) { console.error(`✖ HARNESS FAILURE — seed "${seed.name}": its find occurs ${hits} time(s) in ${seed.file}, and a seed must name exactly one place`); process.exit(2); }
  }

  const workers = Math.max(1, Math.min(Number(arg('workers') ?? 8), seeds.length));
  console.log(`prove — ${seeds.length} seed(s) for the ${law} law across ${workers} worktree(s)\n`);
  const started = Date.now();
  // A previous run that was KILLED (not merely failed) leaves its worktrees both on
  // disk and registered with git, and `git worktree add` refuses a registered path.
  // Clear them first so the harness recovers by itself; the leftover check at the
  // end still holds this run to leaving none of its own.
  rmSync(PROOF_DIR, { recursive: true, force: true });
  git(['worktree', 'prune']);
  mkdirSync(PROOF_DIR, { recursive: true });
  // scripts/ is gitignored (PR-SCRIPTS-GITIGNORE), so the seeds and this harness
  // are carried into each worktree by name rather than by the patch.
  const extras = ['scripts/prove.ts', `scripts/proofs/${law}.seeds.ts`];
  const dirs: string[] = [];
  const results: Result[] = [];
  let harnessError: Error | null = null;
  try {
    for (let i = 0; i < workers; i += 1) dirs.push(makeWorktree(i, extras));
    const lanes = dirs.map((dir, i) => (async () => {
      for (let j = i; j < seeds.length; j += workers) results.push(await runSeed(dir, seeds[j]));
    })());
    await Promise.all(lanes);
  } catch (error) {
    harnessError = error instanceof Error ? error : new Error(String(error));
  } finally {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
      try { git(['worktree', 'prune']); } catch { /* reported by the leftover check below */ }
    }
  }
  const wall = ((Date.now() - started) / 1000).toFixed(1);

  const order = new Map(seeds.map((s, i) => [s.name, i] as const));
  results.sort((a, b) => (order.get(a.seed.name) ?? 0) - (order.get(b.seed.name) ?? 0));
  for (const r of results) {
    console.log(r.caught
      ? `  ✔ caught      ${r.seed.name}  (${(r.ms / 1000).toFixed(1)}s) — "${r.seed.expect}"`
      : `  ✖ NOT CAUGHT  ${r.seed.name}  (${(r.ms / 1000).toFixed(1)}s) — expected a violation holding "${r.seed.expect}"; ${r.why}`);
  }
  const caught = results.filter((r) => r.caught).length;
  console.log(`\n${caught}/${seeds.length} caught · ${wall}s wall · ${workers} worktree(s)`);

  const leftover = proofWorktrees();
  const moved = touched.filter((f) => sha(readAt(ROOT, f)) !== beforeHashes.get(f));
  if (harnessError) { console.error(`\n✖ ${harnessError.message}`); process.exit(2); }
  if (leftover.length > 0) { console.error(`\n✖ HARNESS FAILURE — ${leftover.length} worktree(s) left behind: ${leftover.join(', ')}`); process.exit(2); }
  if (moved.length > 0) { console.error(`\n✖ HARNESS FAILURE — the working tree moved: ${moved.join(', ')}`); process.exit(2); }
  if (results.length !== seeds.length) { console.error(`\n✖ HARNESS FAILURE — ${results.length} of ${seeds.length} seeds ran`); process.exit(2); }
  if (caught !== seeds.length) { console.error(`\n✖ ${seeds.length - caught} seed(s) NOT CAUGHT — a clause that forbids nothing is not a clause`); process.exit(1); }
  console.log('✔ every seeded regression was caught, every file restored byte-for-byte, no worktree left behind.');
}

void main();
