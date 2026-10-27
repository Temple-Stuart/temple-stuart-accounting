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
 *
 * HOME-03 (Alex, 2026-10-27): the same arrival lands on /home now — SIGNED_IN_HOME = ANSWERS_HOME, the rail's HOME, where the
 * day card is (DAY_CARD_PATH '/home'); home03.test.ts holds the three equal. Every pin below that said /runway moved, dated;
 * the shape of the redirect (the ?tab= map first, the query carried, a guest's landing) is unchanged and still pinned here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { DAY_CARD_PATH } from '@/components/workbench/operations/day/dayCard';
import { ANSWERS_HOME } from '../answers';
import { TOOL_REGISTRY } from '../toolRegistry';

const FRONT_DOOR = 'src/app/page.tsx';
const TAB_PAGE = 'src/app/[tab]/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const CONFIG = 'next.config.ts';

test('A the front door: a server component; the ?tab= map first, then the verified arrival is sent to /home (HOME-03; /runway until then) with its query; a guest still gets the landing', () => {
  const page = code(FRONT_DOOR);
  assert.doesNotMatch(page, /^'use client';/, 'a server component — cookies() and redirect() run on the server');
  assert.match(page, /export const dynamic = 'force-dynamic';/);
  assert.match(page, /import \{ cookies \} from 'next\/headers';\nimport \{ redirect \} from 'next\/navigation';/);
  assert.match(page, /import \{ getVerifiedEmail \} from '@\/lib\/cookie-auth';/);
  // One place names the destination, and it is the day card's page. HOME-03 (Alex, 2026-10-27): the rail's HOME, by its constant.
  assert.match(page, /import \{ ANSWERS_HOME \} from '@\/lib\/answers';/);
  assert.match(page, /const SIGNED_IN_HOME = ANSWERS_HOME;/);
  assert.equal(ANSWERS_HOME, '/home');
  assert.equal(DAY_CARD_PATH, '/home');
  assert.equal(ANSWERS_HOME, DAY_CARD_PATH, 'the front door lands where the day card is (one value, held equal here)');
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
  // The destination is served: /home is the answers page, and the card is on it between Net worth and the sheet (HOME-03).
  assert.match(code('src/app/home/page.tsx'), /export default async function HomePage\(\) \{/);
  assert.match(code('src/components/answers/AnswersClient.tsx'), /<div className="mt-5 sm:mt-6" data-home-day-card>\n\s*<Suspense>\n\s*<DayCard \/>/);
  // /runway is still a cockpit path (the calendar tab), without the card.
  assert.match(code(TAB_PAGE), /const TAB_PATHS = new Set\(\[\n\s*'runway',/);
  assert.doesNotMatch(code('src/components/home/ModuleLauncher.tsx'), /DayCard/);
});

test('B the law: /runway is the answers door; the front door stays a listed page with a dated note (HOME-03: to /home); QUERY_REDIRECTS is the three config sources, no more; the six redirects stand', () => {
  const law = code(LAW);
  // HOME-03 (Alex, 2026-10-27): the entry's note names /home, with HOME-02's /runway kept as history.
  assert.match(law, /\{ route: '\/', why: 'the front door — src\/middleware\.ts PUBLIC_PATHS; a signed-in visitor goes on to \/home \(HOME-03, 2026-10-27; \/runway from HOME-02, 2026-10-25\)' \},/);
  assert.match(comments(LAW), /HOME-02 \(Alex, 2026-10-25\): a signed-in visitor is sent on from `\/` to \/runway by the page itself/);
  // The fixpoint reads only a literal redirect('...'); the front door's redirects are computed — `/` stays listed.
  assert.match(law, /const m = src\.match\(\/redirect\\\(\\s\*\['"`\]\(\[\^'"`\]\+\)\['"`\]\\s\*\\\)\/\);/);
  assert.doesNotMatch(code(FRONT_DOOR), /redirect\(\s*['"`]/, 'no literal redirect on the front door — the law would read the page as a redirect');
  // HOME-03 (Alex, 2026-10-27): three sources, all to /home — /runway's own dated rule joined; still nothing for /.
  const entries = [...law.matchAll(/\{ source: '([^']+)', keys: \['date', 'step'\], destination: '\/home'/g)].map((m) => m[1]);
  assert.deepEqual(entries, ['/tasks', '/time', '/runway'], 'QUERY_REDIRECTS: the three next.config.ts sources (HOME-01; HOME-03), nothing for /');
  assert.doesNotMatch(law, /destination: '\/runway'/);
  assert.match(code('src/lib/answers.ts'), /'How long can I last\?': \{\n\s*computed: true,[\s\S]*?home: '\/runway',/);
  const cfg = code(CONFIG);
  for (const src of ['/tasks', '/time', '/runway']) for (const key of ['date', 'step']) assert.ok(cfg.includes(`{ source: '${src}', has: [{ type: 'query', key: '${key}' }], destination: '/home', permanent: false },`), `${src}?${key}= → /home stands`); // HOME-03
  assert.doesNotMatch(cfg, /source: '\/',/, 'no config rule for / — the page decides, because only the page sees the cookie');
});

test('C nothing else: no registry row moved, no route under src/app/api touched by name here, DAY_CARD_PATH is the front door\'s destination (HOME-03: /home)', () => {
  assert.equal(TOOL_REGISTRY.filter((t) => t.home === '/runway' || t.home === '/home').length, 0);
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Time')!.home, '/time');
  assert.equal(DAY_CARD_PATH, '/home'); // HOME-03 (Alex, 2026-10-27): the card moved on to the home page
  assert.match(code('src/components/workbench/operations/day/dayCard.ts'), /export const DAY_CARD_PATH = '\/home';/);
});
