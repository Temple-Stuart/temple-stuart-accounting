/**
 * HOME-02 (Alex, 2026-10-25) — A SIGNED-IN `/` LANDS ON /runway.
 *
 *   A. src/app/page.tsx: after the ?tab= map and before HomeClient, a verified arrival → redirect('/runway' + the query
 *      string), 307, the page-level redirect() idiom; a guest gets the landing as before. The page is a server component
 *      (cookies(), async) — the check runs where the cockpit's own server-side check ran (isVerifiedAuthed: getVerifiedEmail,
 *      or the NextAuth JWT).
 *   B. /runway is already a door (answers.ts); the law's QUERY_REDIRECTS lists next.config.ts query rules only, so the front
 *      door's entry carries a dated note instead. DAY_CARD_PATH stays '/runway'; the four HOME-01 redirects stay.
 *   C. No registry row, no route, no schema.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { DAY_CARD_PATH } from '@/components/workbench/operations/day/dayCard';
import { TOOL_REGISTRY } from '../toolRegistry';

const FRONT_DOOR = 'src/app/page.tsx';
const TAB_PAGE = 'src/app/[tab]/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const CONFIG = 'next.config.ts';

test('A the front door: a server component; the ?tab= map first, then the verified arrival is sent to /runway with its query; a guest still gets the landing', () => {
  const page = code(FRONT_DOOR);
  assert.doesNotMatch(page, /^'use client';/, 'a server component — cookies() and redirect() run on the server');
  assert.match(page, /export const dynamic = 'force-dynamic';/);
  assert.match(page, /import \{ cookies \} from 'next\/headers';\nimport \{ redirect \} from 'next\/navigation';/);
  assert.match(page, /import \{ getVerifiedEmail \} from '@\/lib\/cookie-auth';/);
  // One place names the destination, and it is the day card's page.
  assert.match(page, /const SIGNED_IN_HOME = '\/runway';/);
  assert.equal(DAY_CARD_PATH, '/runway');
  assert.equal(/const SIGNED_IN_HOME = '([^']+)';/.exec(page)![1], DAY_CARD_PATH, 'the front door lands where the day card is (one value, held equal here)');
  // The order: the ?tab= map (its compliance carve-out and its redirect) before the verified check, the landing last.
  const tabMapAt = page.indexOf('if (params.tab !== undefined) {');
  const carveOutAt = page.indexOf("if (params.tab === 'compliance') return <HomeClient offerAvailability={offerAvailability} />;");
  const tabRedirectAt = page.indexOf("redirect(typeof params.tab === 'string' ? (TAB_TO_PATH[params.tab] ?? '/') : '/');");
  const authedAt = page.indexOf('if (await isVerifiedAuthed()) {');
  const landingAt = page.indexOf('return <GuestLanding offerAvailability={offerAvailability} logoAvailability={logoAvailability} />;');
  assert.ok(tabMapAt > -1 && carveOutAt > tabMapAt && tabRedirectAt > carveOutAt && authedAt > tabRedirectAt && landingAt > authedAt, 'the ?tab= map, then the signed-in redirect, then the guest landing');
  // The redirect: the query string as given — every value of every key, in order — then the one redirect().
  assert.match(page, /if \(await isVerifiedAuthed\(\)\) \{\n\s*const query = new URLSearchParams\(\);\n\s*for \(const \[key, value\] of Object\.entries\(params\)\) \{\n\s*for \(const v of value === undefined \? \[\] : typeof value === 'string' \? \[value\] : value\) query\.append\(key, v\);\n\s*\}\n\s*const qs = query\.toString\(\);\n\s*redirect\(qs === '' \? SIGNED_IN_HOME : `\$\{SIGNED_IN_HOME\}\?\$\{qs\}`\);\n\s*\}/);
  assert.equal((page.match(/<HomeClient /g) ?? []).length, 1, 'HomeClient renders at / only for the compliance carve-out now');
  assert.ok(page.indexOf('<HomeClient ') < authedAt, 'the one HomeClient render is the carve-out above the redirect');
  // The two verification signals are unchanged.
  assert.match(page, /async function isVerifiedAuthed\(\): Promise<boolean> \{\n\s*if \(await getVerifiedEmail\(\)\) return true;/);
  assert.match(page, /decode\(\{ token: rawToken, secret: process\.env\.JWT_SECRET \}\)/);
  assert.match(comments(FRONT_DOOR), /HOME-02 \(Alex, 2026-10-25\) — A SIGNED-IN `\/` LANDS ON \/runway/);
  // The destination is served: /runway is a cockpit path, and the card is first on it (HOME-01).
  assert.match(code(TAB_PAGE), /const TAB_PATHS = new Set\(\[\n\s*'runway',/);
  assert.match(code('src/components/home/ModuleLauncher.tsx'), /<div className="px-4 lg:px-8 pt-6 sm:pt-8" data-runway-day-card>\n\s*<Suspense>\n\s*<DayCard \/>/);
});

test('B the law: /runway is the answers door; the front door stays a listed page with a dated note; QUERY_REDIRECTS is the two config rules, no more; the four HOME-01 redirects stand', () => {
  const law = code(LAW);
  assert.match(law, /\{ route: '\/', why: 'the front door — src\/middleware\.ts PUBLIC_PATHS; a signed-in visitor goes on to \/runway \(HOME-02, 2026-10-25\)' \},/);
  assert.match(comments(LAW), /HOME-02 \(Alex, 2026-10-25\): a signed-in visitor is sent on from `\/` to \/runway by the page itself/);
  // The fixpoint reads only a literal redirect('...'); the front door's redirects are computed — `/` stays listed.
  assert.match(law, /const m = src\.match\(\/redirect\\\(\\s\*\['"`\]\(\[\^'"`\]\+\)\['"`\]\\s\*\\\)\/\);/);
  assert.doesNotMatch(code(FRONT_DOOR), /redirect\(\s*['"`]/, 'no literal redirect on the front door — the law would read the page as a redirect');
  const entries = [...law.matchAll(/\{ source: '([^']+)', keys: \['date', 'step'\], destination: '\/runway'/g)].map((m) => m[1]);
  assert.deepEqual(entries, ['/tasks', '/time'], 'QUERY_REDIRECTS: the two next.config.ts rules (HOME-01), nothing for /');
  assert.match(code('src/lib/answers.ts'), /'How long can I last\?': \{\n\s*computed: true,[\s\S]*?home: '\/runway',/);
  const cfg = code(CONFIG);
  for (const src of ['/tasks', '/time']) for (const key of ['date', 'step']) assert.ok(cfg.includes(`{ source: '${src}', has: [{ type: 'query', key: '${key}' }], destination: '/runway', permanent: false },`), `${src}?${key}= → /runway stands`);
  assert.doesNotMatch(cfg, /source: '\/',/, 'no config rule for / — the page decides, because only the page sees the cookie');
});

test('C nothing else: no registry row moved, no route under src/app/api touched by name here, DAY_CARD_PATH unchanged', () => {
  assert.equal(TOOL_REGISTRY.filter((t) => t.home === '/runway').length, 0);
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Time')!.home, '/time');
  assert.equal(DAY_CARD_PATH, '/runway');
  assert.match(code('src/components/workbench/operations/day/dayCard.ts'), /export const DAY_CARD_PATH = '\/runway';/);
});
