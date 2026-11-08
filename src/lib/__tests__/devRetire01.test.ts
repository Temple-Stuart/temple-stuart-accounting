/**
 * DEV-RETIRE-01 (Alex, 2026-11-07) — THE DEVELOPER CONSOLE RETIRES. Its page carried a password in the public repo
 * (src/app/developer/page.tsx:22 — its routes, not the password, were ever the gate); its leads become CRM contacts by one
 * psql step (the PR body's INSERT, never code). Ruling A: three files go, nothing replaces them; the `prospects` model and
 * table stay (dropping a table is CLEAN's ruling) and nothing in src reads or writes it. Ruling B: the doors and the laws —
 * the menu entry, the SHELL_PAGES door, the OWNER_CONSOLE entry, the pin 5 → 4, the sec02-m seed re-anchored. Ruling D:
 * no migration, no change to /crm, /owner, the CRM routes, PUBLIC_PATHS, the registry; the README names no developer console
 * (it never did — the absence is pinned). The FACT 2 answer: the unmounted Footer's dead link went; the component itself
 * waits on a CLEAN ruling.
 *
 *   T1 the three files do not exist, and their directories are gone;
 *   T2 the doors: shellMenu has no /developer entry; the law script's SHELL_PAGES and OWNER_CONSOLE name no developer route;
 *      SEC02_PINNED.ownerConsole === 4; the Footer's link is gone;
 *   T3 `prisma.prospects` (any client's) appears in no file under src; the model stays in the schema;
 *   T4 the README names no developer console or /developer; the one "developer" left in src is a software developer's;
 *   T5 the seed's anchor is found exactly once in the law script (prove.ts's harness rule), its expect the census;
 *   T6 held still: /developer is not public, the registry's CRM row and counts did not move.
 *
 * Source is read through code() and comments() only (the reader law). No clock.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { OWNER_UTILITIES } from '../shellMenu';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';

const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS = 'scripts/proofs/sec02.seeds.ts';
const SHELL_MENU = 'src/lib/shellMenu.ts';
const FOOTER = 'src/components/Footer.tsx';
const SCHEMA = 'prisma/schema.prisma';
const MIDDLEWARE = 'src/middleware.ts';
const README = 'README.md';
const GONE = ['src/app/developer/page.tsx', 'src/app/api/developer/prospects/route.ts', 'src/app/api/developer/prospects/[id]/route.ts'] as const;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full.slice(process.cwd().length + 1)] : [];
  });
}

test('T1 the three files do not exist, and their directories are gone', () => {
  for (const f of GONE) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is gone`);
  for (const d of ['src/app/developer', 'src/app/api/developer']) assert.ok(!existsSync(resolve(process.cwd(), d)), `${d} is gone`);
});

test('T2 the doors: no /developer in the utilities menu, in SHELL_PAGES or in OWNER_CONSOLE; the pin is 4; the Footer\'s dead link went', () => {
  assert.ok(!OWNER_UTILITIES.some((u) => u.href === '/developer' || /developer/i.test(u.label)), 'no Developer console entry');
  assert.deepEqual(OWNER_UTILITIES.map((u) => u.href), ['/data-observatory', '/owner'], 'the two utilities left, in order');
  assert.ok(comments(SHELL_MENU).includes('// DEV-RETIRE-01 (2026-11-07): the developer console retired — its page carried a password in the public repo; leads live in the CRM (/crm).'));
  const law = code(LAW);
  assert.doesNotMatch(law, /'\/developer'|api\/developer|Developer console/, 'the law script names no developer route or door');
  assert.match(law, /const SEC02_PINNED = \{ publicWriters: 13, ownerConsole: 4,/); // CRM-02 (2026-11-07): publicWriters 12 → 13, the intake form's POST; ownerConsole stays 4
  assert.match(comments(LAW), /DEV-RETIRE-01 \(2026-11-07\): 5 → 4 — the developer console's prospects PATCH retired/);
  const console = /const OWNER_CONSOLE: ReadonlyArray<\{ file: string; why: string \}> = \[([\s\S]*?)\n\];/.exec(law);
  assert.ok(console, 'OWNER_CONSOLE is found');
  const entries = [...console[1].matchAll(/\{ file: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(entries.length, 4, 'four owner-console routes');
  assert.ok(entries.every((f) => f.startsWith('src/app/api/admin/')), 'every one an admin route');
  assert.equal(entries[0], 'src/app/api/admin/backfill-transaction-fields/route.ts', 'the first remaining entry — the seed\'s new anchor');
  // the unmounted Footer: its /developer link went; the component stays for a CLEAN ruling (the FACT 2 answer)
  const footer = code(FOOTER);
  assert.doesNotMatch(footer, /\/developer|Developer Dashboard|from 'next\/link'/);
  assert.ok(comments(FOOTER).includes('DEV-RETIRE-01 (2026-11-07): the "Developer Dashboard →" link went with /developer; leads live in the CRM (/crm).'));
  assert.ok(existsSync(resolve(process.cwd(), FOOTER)), 'Footer.tsx itself stays — dead code is CLEAN\'s ruling');
});

test('T3 `prisma.prospects` appears in no file under src — the model and table stay, read and written by nothing', () => {
  const files = sourceFiles(resolve(process.cwd(), 'src'));
  for (const f of files) assert.doesNotMatch(code(f), /\b(?:prisma|tx|db)\.prospects\b/, `${f} reads or writes prospects`);
  assert.match(code(SCHEMA), /^model prospects \{$/m, 'the model stays (dropping a table is CLEAN\'s ruling, with a count first)');
});

test('T4 the README names no developer console or /developer; the "developer" left in src is a software developer\'s', () => {
  const readme = code(README) + comments(README);
  assert.doesNotMatch(readme, /developer console|\/developer\b|Developer Dashboard/i);
  const files = sourceFiles(resolve(process.cwd(), 'src'));
  const named = files.filter((f) => /\/developer\b|Developer console|Developer Dashboard|app\/developer|api\/developer/.test(code(f)));
  assert.deepEqual(named, [], 'no source file names the console or its routes');
  assert.match(code('src/lib/constants/productCategories.ts'), /'API \/ developer platform'/, 'a software developer — stays');
  assert.match(comments('src/lib/auth/registration.ts'), /\(LoginBox — the developer page too, until DEV-RETIRE-01 retired it, 2026-11-07\) reads PASSWORD_MIN_LENGTH/);
});

test('T5 the seed\'s anchor is found exactly once in the law script (the harness rule), and its expect is the census', () => {
  const seeds = code(SEEDS);
  assert.doesNotMatch(seeds, /developer|prospects/);
  const find = /name: 'sec02-m a closed table grows — an owner-console entry added without a ruling',\n\s*file: LAW,\n\s*find: "([^"\\]*(?:\\.[^"\\]*)*)",/.exec(seeds);
  assert.ok(find, 'the seed\'s find');
  const anchor = JSON.parse(`"${find[1]}"`) as string;
  assert.ok(anchor.startsWith("  { file: 'src/app/api/admin/backfill-transaction-fields/route.ts', why:"), anchor);
  assert.equal(code(LAW).split(anchor).length - 1, 1, 'found exactly once in the law script (scripts/prove.ts: a seed must name exactly one place)');
  assert.match(seeds, /expect: 'ownerConsole holds 5 entries, pinned at 4',/);
  assert.match(comments(SEEDS), /DEV-RETIRE-01 \(2026-11-07\): that entry retired too \(the developer console\)/);
});

test('T6 held still: /developer was never public; the registry\'s CRM row and the census did not move; no migration', () => {
  assert.doesNotMatch(code(MIDDLEWARE), /developer/);
  const crm = TOOL_REGISTRY.find((t) => t.name === 'CRM');
  assert.ok(crm);
  assert.equal(crm.status, 'PARTIAL');
  // CRM-02 (2026-11-07): the why and the customer sentence rewritten (BUILD 14) — the row itself held still through DEV-RETIRE-01, as this test said.
  assert.equal(crm.why, "the people you sell to: every proposal from the platform's form and every signup for the owner; anyone added by hand and every submission of their own intake form, at its own link or embedded, for every account; a stage and a next step on the row; nothing is sent from here; per-account stages and fields are not built (CRM-03)");
  assert.equal(crm.customer, "The people you sell to, in flat tables. Your own intake form — at your own link, or embedded on your site — fills it; set each one's stage and next step; add someone by hand.");
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 });
  assert.deepEqual(statusCounts(), EXPECTED_STATUS_COUNTS);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  // SERVICES-01 (2026-11-08): proposals_need_chk gains 'bookkeeping' — the newest now; every pin below moved by one more.
  assert.equal(dirs[dirs.length - 1], '20261108111500_services_01_bookkeeping_need', 'the newest migration');
  // CRM-02 (2026-11-07) authored the newest since; DEV-RETIRE-01 itself authored none — CRM-01a's sits right before it.
  assert.equal(dirs[dirs.length - 2], '20261107212000_crm_02_intake_forms', 'right before SERVICES-01\'s');
  assert.equal(dirs[dirs.length - 3], '20261106150000_crm_01a_crm_contacts', 'no migration of DEV-RETIRE-01\'s own — CRM-01a\'s is right before CRM-02\'s');
});
