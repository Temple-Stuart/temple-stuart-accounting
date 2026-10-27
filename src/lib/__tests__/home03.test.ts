/**
 * HOME-03 (Alex, 2026-10-27) — /home IS THE HOME PAGE: where you land, the metrics, the day card.
 *
 *   A. A signed-in `/` lands on /home (src/app/page.tsx: SIGNED_IN_HOME = ANSWERS_HOME — HOME-02's redirect retargeted from
 *      /runway; isVerifiedAuthed unchanged; the guest landing on `/` unchanged). The rail's HOME stays /home.
 *   B. /home renders THE ANSWERS (the four cards, Net worth) → THE DAY CARD (day/DayCard.tsx, the same component, in its
 *      Suspense boundary, unchanged inside) → THE SHEET. DAY_CARD_PATH is '/home': every URL the card writes is /home's.
 *   C. next.config.ts: six rules — /tasks, /time and /runway with ?date or ?step → /home, 307. A bare /runway stays the
 *      cockpit's calendar tab, its panel the runway pipe's: the strip, the budget panel, the match review, the merged grid,
 *      the receipts rail — without the card.
 *   D. Every line that named /runway as the card's home moved: dayCard.ts, the Time row's note, the tasks page header, the
 *      law's doors. answers.ts :92 (home: '/runway') is the "How long can I last?" answer's door — the runway lens, not the
 *      card's — and COCKPIT_PATH.calendar is the cockpit tab's path: both unchanged. /runway stays in PUBLIC_PATHS (the
 *      guest cockpit view, ROUTE-1); /home is not listed, so the middleware's gate protects it.
 *   E. Pins moved with dated notes: home01, home02, time01, time02, time03, tasksOne01, backlog02, daycard01; the law's
 *      two-lists block reads the card's host on /home; nav.ts re-cites the Runway panel's lines.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { DAY_CARD_PARAMS, DAY_CARD_PATH, dayCardRedirectHref } from '@/components/workbench/operations/day/dayCard';
import { ANSWERS_HOME, ANSWER_READS } from '../answers';
import { COCKPIT_PATH, TOOL_REGISTRY } from '../toolRegistry';
import { THE_SORT } from '../nav';

const FRONT_DOOR = 'src/app/page.tsx';
const HOME_PAGE = 'src/app/home/page.tsx';
const HOST = 'src/components/answers/AnswersClient.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const TAB_PAGE = 'src/app/[tab]/page.tsx';
const OPS = 'src/components/workbench/operations';
const RULES = `${OPS}/day/dayCard.ts`;
const CARD = `${OPS}/day/DayCard.tsx`;
const MOVE = `${OPS}/stops/MoveControl.tsx`;
const DAY_PAGE = 'src/app/tasks/day/page.tsx';
const CONFIG = 'next.config.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const MIDDLEWARE = 'src/middleware.ts';
const NAV = 'src/lib/nav.ts';

// ── A · WHERE YOU LAND ────────────────────────────────────────────────────────

test('A a signed-in / lands on /home — the rail\'s HOME, the day card\'s page: one value held three ways; the guest landing and the ?tab= map unchanged', () => {
  const page = code(FRONT_DOOR);
  assert.equal(ANSWERS_HOME, '/home');
  assert.equal(DAY_CARD_PATH, '/home');
  assert.match(page, /import \{ ANSWERS_HOME \} from '@\/lib\/answers';/);
  assert.match(page, /const SIGNED_IN_HOME = ANSWERS_HOME;/, 'the front door lands on the rail\'s HOME — not a second literal');
  assert.doesNotMatch(page, /SIGNED_IN_HOME = '/, 'no literal destination');
  assert.doesNotMatch(page, /redirect\(\s*['"`]/, 'no literal redirect — the law would read the page as a redirect');
  // The redirect is HOME-02's, unchanged in shape: the query string as given, then the one redirect().
  assert.match(page, /if \(await isVerifiedAuthed\(\)\) \{\n\s*const query = new URLSearchParams\(\);\n\s*for \(const \[key, value\] of Object\.entries\(params\)\) \{\n\s*for \(const v of value === undefined \? \[\] : typeof value === 'string' \? \[value\] : value\) query\.append\(key, v\);\n\s*\}\n\s*const qs = query\.toString\(\);\n\s*redirect\(qs === '' \? SIGNED_IN_HOME : `\$\{SIGNED_IN_HOME\}\?\$\{qs\}`\);\n\s*\}/);
  assert.match(page, /async function isVerifiedAuthed\(\): Promise<boolean> \{\n\s*if \(await getVerifiedEmail\(\)\) return true;/);
  assert.match(page, /decode\(\{ token: rawToken, secret: process\.env\.JWT_SECRET \}\)/);
  // The order stands: the ?tab= map (its compliance carve-out, its redirect — calendar still → /runway), the verified check, the landing.
  const tabMapAt = page.indexOf('if (params.tab !== undefined) {');
  const tabRedirectAt = page.indexOf("redirect(typeof params.tab === 'string' ? (TAB_TO_PATH[params.tab] ?? '/') : '/');");
  const authedAt = page.indexOf('if (await isVerifiedAuthed()) {');
  const landingAt = page.indexOf('return <GuestLanding offerAvailability={offerAvailability} logoAvailability={logoAvailability} />;');
  assert.ok(tabMapAt > -1 && tabRedirectAt > tabMapAt && authedAt > tabRedirectAt && landingAt > authedAt);
  assert.match(page, /calendar: '\/runway', travel: '\/travel', routines: '\/routines',/, 'the legacy ?tab=calendar still opens the cockpit\'s calendar tab');
  assert.equal((page.match(/<HomeClient /g) ?? []).length, 1, 'HomeClient renders at / only for the compliance carve-out');
  assert.match(comments(FRONT_DOOR), /HOME-03 \(Alex, 2026-10-27\) — \/home IS THE HOME/);
  assert.match(comments(FRONT_DOOR), /HOME-02 \(Alex, 2026-10-25\) — A SIGNED-IN `\/` LANDS ON \/runway/, 'the history stays');
  // The rail highlights HOME on /home.
  const rail = code('src/components/shell/Rail.tsx');
  assert.match(rail, /import \{ ANSWERS_HOME \} from '@\/lib\/answers';/);
  assert.match(rail, /const onHome = pathname === ANSWERS_HOME;/);
  // /home is served, and protected: not a public path, so the middleware's gate sends a guest to '/'.
  assert.match(code(HOME_PAGE), /export const dynamic = 'force-dynamic';/);
  assert.match(code(HOME_PAGE), /<AnswersClient viewer=\{viewer \?\? ''\} offerAvailability=\{offerAvailabilityFromEnv\(process\.env\)\} \/>/);
  const mw = code(MIDDLEWARE);
  const publicPaths = mw.slice(mw.indexOf('const PUBLIC_PATHS = ['), mw.indexOf('function isPublic('));
  assert.doesNotMatch(publicPaths, /'\/home'/, '/home is not public');
  assert.match(publicPaths, /'\/runway',/, '/runway stays public — the guest cockpit view (ROUTE-1)');
  assert.match(mw, /if \(!verifiedEmail && !token\) \{\n[^\n]*\n\s*const loginUrl = new URL\('\/', request\.url\);\n\s*return NextResponse\.redirect\(loginUrl\);/);
});

// ── B · THE PAGE: THE ANSWERS, THE DAY CARD, THE SHEET ────────────────────────

test('B /home mounts the four cards, Net worth, then the day card in its Suspense boundary, then the sheet — the card once, unchanged inside', () => {
  const host = code(HOST);
  assert.match(host, /^'use client';/);
  assert.match(host, /import \{ Suspense, useEffect, useState \} from 'react';/);
  assert.match(host, /import DayCard from '@\/components\/workbench\/operations\/day\/DayCard';/);
  assert.equal((host.match(/<DayCard \/>/g) ?? []).length, 1, 'mounted once');
  assert.match(host, /<div className="mt-5 sm:mt-6" data-home-day-card>\n\s*<Suspense>\n\s*<DayCard \/>\n\s*<\/Suspense>\n\s*<\/div>/, 'the boundary, in the main\'s page gutter');
  const answersAt = host.indexOf('<section aria-label="The four answers"');
  const netWorthAt = host.indexOf('<section aria-label="Net worth" className="mt-5 sm:mt-6" data-net-worth>');
  const cardAt = host.indexOf('<DayCard />');
  const sheetAt = host.indexOf('<TheSheet />');
  assert.ok(answersAt > -1 && netWorthAt > answersAt && cardAt > netWorthAt && sheetAt > cardAt, 'the four, Net worth, the card, the sheet');
  // The frame: the main's gutter is the page gutter the card had on /time and on the panel (WIDTH-01's 32 px for the deck's bleed).
  assert.match(host, /<main className="max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8">/);
  assert.match(code('src/components/ui/AppLayout.tsx'), /page \? 'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8'/);
  assert.match(code(`${OPS}/stops/DayDeck.tsx`), /export const DECK_BLEED_QUERY = '\(min-width: 1024px\)';/);
  // No entity provider is added — the card reads none.
  assert.doesNotMatch(host, /OperationsEntityProvider|useOperationsEntity/);
  assert.match(comments(HOST), /HOME-03 \(Alex, 2026-10-27\): THE DAY CARD ON THE HOME PAGE/);
  // Unchanged inside: the card still carries the deck, the work block, the journal cards and the reel kit, and reads only date and step.
  const c = code(CARD);
  for (const name of ['DOWNLOAD_IMAGE_WORDS', 'DOWNLOAD_TAG_WORDS', 'COPY_CAPTION_WORDS', 'COPY_SCRIPT_WORDS']) assert.ok(c.includes(`{${name}}`), `the card still draws ${name}`);
  assert.match(c, /import DayDeck, \{[^}]*\} from '\.\.\/stops\/DayDeck';/);
  assert.match(c, /<WorkBlock /);
  assert.match(c, /useSearchParams\(\)/);
  assert.deepEqual([...c.matchAll(/search\.get\('(\w+)'\)/g)].map((m) => m[1]), ['date', 'step']);
  // The cockpit names the card no more.
  const l = code(LAUNCHER);
  assert.doesNotMatch(l, /DayCard|data-runway-day-card/);
  assert.match(l, /import \{ useState, useEffect, useRef, useCallback \} from 'react';/, 'Suspense left with the card');
  assert.match(comments(LAUNCHER), /HOME-03 \(Alex, 2026-10-27\): the day card left this panel for the home page, \/home/);
});

test('B DAY_CARD_PATH is /home — one constant; hrefFor, the hop and the move control follow; no literal anywhere', () => {
  assert.equal(DAY_CARD_PATH, '/home');
  assert.equal(DAY_CARD_PATH, ANSWERS_HOME);
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  assert.match(code(RULES), /export const DAY_CARD_PATH = '\/home';/);
  assert.match(comments(RULES), /HOME-03 \(Alex, 2026-10-27\): THE CARD IS ON THE HOME PAGE — \/home, the rail's HOME/);
  assert.match(comments(RULES), /HOME-01 \(Alex, 2026-10-24\): THE CARD IS ON THE DASHBOARD/, 'the history stays');
  const c = code(CARD);
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.equal((c.match(/go\(hrefFor\(/g) ?? []).length, 3);
  assert.match(c, /router\.replace\(hrefFor\(day, step\), \{ scroll: false \}\)/);
  assert.match(comments(CARD), /on \/home, the home page, between the answers and the sheet \(HOME-03, Alex, 2026-10-27: DAY_CARD_PATH is \/home; HOME-01, 2026-10-24: \/runway/);
  assert.equal(dayCardRedirectHref({ date: '2026-10-27', step: '2' }), '/home?date=2026-10-27&step=2');
  assert.equal(dayCardRedirectHref({ date: '2026-10-27' }), '/home?date=2026-10-27');
  assert.equal(dayCardRedirectHref({}), '/home');
  assert.match(code(DAY_PAGE), /redirect\(dayCardRedirectHref\(await searchParams\)\);/);
  assert.match(comments(DAY_PAGE), /HOME-03 \(Alex, 2026-10-27\): the card is on the home page \(\/home\)/);
  assert.match(code(MOVE), /window\.location\.assign\(`\$\{DAY_CARD_PATH\}\?date=\$\{plan\.date\}`\);/);
  assert.match(comments(MOVE), /HOME-01, 2026-10-24: \/runway; HOME-03, 2026-10-27: \/home; no literal/);
  for (const f of [CARD, RULES, MOVE, HOST, LAUNCHER, DAY_PAGE]) assert.doesNotMatch(code(f), /['"`]\/home\?|['"`]\/runway\?|['"`]\/time\?|['"`]\/tasks\?/, `${f} types no card URL`);
});

// ── C · THE REDIRECTS, AND WHAT /runway STILL IS ──────────────────────────────

test('C next.config.ts: six rules — /tasks, /time and /runway with ?date or ?step → /home, 307, in this order; the law names three doors and verifies each against the config, the constant and the rail door', () => {
  const cfg = code(CONFIG);
  const rules = [
    "{ source: '/tasks', has: [{ type: 'query', key: 'date' }], destination: '/home', permanent: false },",
    "{ source: '/tasks', has: [{ type: 'query', key: 'step' }], destination: '/home', permanent: false },",
    "{ source: '/time', has: [{ type: 'query', key: 'date' }], destination: '/home', permanent: false },",
    "{ source: '/time', has: [{ type: 'query', key: 'step' }], destination: '/home', permanent: false },",
    "{ source: '/runway', has: [{ type: 'query', key: 'date' }], destination: '/home', permanent: false },",
    "{ source: '/runway', has: [{ type: 'query', key: 'step' }], destination: '/home', permanent: false },",
  ];
  let at = -1;
  for (const rule of rules) { const next = cfg.indexOf(rule, at + 1); assert.ok(next > at, `the rule, in order: ${rule}`); at = next; }
  assert.equal((cfg.match(/permanent: false/g) ?? []).length, 6, 'the six 307s');
  assert.doesNotMatch(cfg, /destination: '\/runway'|destination: '\/time'/, 'nothing is sent to /runway or /time now');
  assert.equal((cfg.match(/source: '\/runway'/g) ?? []).length, 2, 'the two keys, and no rule for a bare /runway');
  assert.doesNotMatch(cfg, /source: '\/',|source: '\/home'/);
  assert.match(comments(CONFIG), /HOME-03 \(Alex, 2026-10-27\): the card moved once more — to the home page, \/home/);
  assert.match(comments(CONFIG), /HOME-01 \(Alex, 2026-10-24\): the card moved again — to the dashboard/, 'the history stays');
  const law = code(LAW);
  const entries = [...law.matchAll(/\{ source: '([^']+)', keys: \['date', 'step'\], destination: '([^']+)', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: '([^']*(?:\\'[^']*)*)' \},/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(entries.map(([s, d]) => `${s} → ${d}`), ['/tasks → /home', '/time → /home', '/runway → /home'], 'QUERY_REDIRECTS: the three sources, one destination');
  for (const [, , since] of entries) assert.match(since, /HOME-03 \(2026-10-27\)/, 'each entry dated');
  assert.match(law, /if \(!nextConfigText\.includes\(rule\)\) violations\.push\(/);
  assert.match(law, /if \(!codeOf\(q\.constant\.file\)\.includes\(`export const \$\{q\.constant\.name\} = '\$\{q\.destination\}';`\)\) violations\.push\(/);
  assert.match(law, /const targetDoor = findDoor\(q\.destination\);\n\s*if \(!targetDoor\) violations\.push\(/);
  assert.match(law, /doors\.push\(\{ route: ANSWERS_HOME, kind: 'rail', via: 'Home · the rail\\'s first entry' \}\);/, '/home\'s door is the rail');
  assert.match(law, /\{ route: '\/', why: 'the front door — src\/middleware\.ts PUBLIC_PATHS; a signed-in visitor goes on to \/home \(HOME-03, 2026-10-27; \/runway from HOME-02, 2026-10-25\)' \},/);
});

test('C a bare /runway is the cockpit\'s calendar tab, and its panel is the runway pipe\'s without the card: the strip, the budget panel, the match review, the merged grid, the receipts rail, in order', () => {
  assert.equal(COCKPIT_PATH.calendar, '/runway', 'the cockpit path map is unchanged (toolRegistry.ts)');
  assert.match(code(TAB_PAGE), /const TAB_PATHS = new Set\(\[\n\s*'runway',/);
  const l = code(LAUNCHER);
  assert.match(l, /calendar: '\/runway', travel: '\/travel', trade: '\/trade',/);
  assert.match(l, /const fromPath = seg === 'runway' \? 'calendar' : TABS\.some\(\(t\) => t\.key === seg\) \? seg : null;/);
  const runwayAt = l.indexOf("activeModule === 'calendar' ? 'block' : 'hidden'");
  const guestAt = l.indexOf('{authed === false && (');
  const panel = l.slice(runwayAt, guestAt);
  assert.ok(runwayAt > -1 && guestAt > runwayAt);
  const mounts = ['<StageStrip', '<RunwayDataProvider>', '<RunwayBudgetPanel', '<MatchReviewSection onTotals={setMatchTotals} />', '<HubCalendar />', '<ProofStrip'];
  let at = -1;
  for (const m of mounts) { const next = panel.indexOf(m, at + 1); assert.ok(next > at, `the panel still holds ${m}, in order`); at = next; }
  assert.doesNotMatch(panel, /DayCard|Suspense/, 'the card is gone from the panel');
  assert.match(panel, /<div className=\{MODULE_SHELL_CARD\}>/, 'the shell card that held the strip and the metrics is still first');
  // nav.ts re-cites the two state-only cells where the panel's note now stands (nav.test.ts holds the marker inside the range).
  const launcherComments = comments(LAUNCHER);
  const markerLine = launcherComments.split('\n').findIndex((x) => x.includes('STATE-ONLY cells')) + 1;
  for (const num of ['01', '02'] as const) {
    const a = THE_SORT.find((x) => x.pipe === 'runway' && x.num === num)!;
    const [from, to] = /ModuleLauncher\.tsx:(\d+)-(\d+)/.exec(a.surfaceNote ?? '')!.slice(1).map(Number);
    assert.ok(markerLine >= from && markerLine <= to, `runway ${num}: the note is at :${markerLine}, cited as :${from}-${to}`);
    const [hFrom, hTo] = /the handler excludes its key at :(\d+)-(\d+)/.exec(a.surfaceNote ?? '')!.slice(1).map(Number);
    const lines = code(LAUNCHER).split('\n');
    assert.match(lines[hFrom - 1] ?? '', /onSelect=\{\(k\) => \{/, `runway ${num}: the handler opens at :${hFrom}`);
    assert.ok(lines.slice(hFrom - 1, hTo).some((x) => x.includes("if (k === 'burn' || k === 'match' || k === 'project') setRunwayPhase(k);")), `runway ${num}: the handler's exclusion is inside :${hFrom}-${hTo}`);
  }
  assert.match(comments(NAV), /HOME-03 \(2026-10-27\): sixteen lines back up — the day card's mount left the panel for \/home/);
});

// ── D · EVERY LINE THAT NAMED /runway AS THE CARD'S HOME ──────────────────────

test('D the Time row: the note says /home (HOME-03), the customer line\'s "home dashboard" stands as it was — now literally true; home /time, LIVE; no Home registry row', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  assert.equal(time.home, '/time');
  assert.equal(time.status, 'LIVE');
  assert.equal(time.why, undefined);
  assert.equal(time.note, 'HOME-03 (2026-10-27): the day itself is entered on the day card — Time\'s component, shown on the home page, /home, between the answers and the sheet (HOME-01, 2026-10-24, had it on the cockpit\'s Runway panel, /runway); /time is the tables. TIME-02 (2026-10-19): the content pipeline retired — its components and routes deleted; its five tables kept, untouched, until TABLES-01.');
  assert.equal(time.customer, 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.');
  assert.ok(time.citation.includes('written by the day card: Time\'s component, shown on the home page, /home — HOME-03; the dashboard until then, HOME-01)'));
  assert.doesNotMatch(time.customer ?? '', /\b(discover|decide|commit|record)\b|\/runway|\/home/, 'no beat word, no path on the customer line');
  assert.equal(TOOL_REGISTRY.filter((t) => t.home === '/runway' || t.home === '/home').length, 0, 'no registry row lives on /runway or /home');
  assert.match(comments('src/lib/toolRegistry.ts'), /HOME-03 \(Alex, 2026-10-27\): THE DAY CARD IS ON THE HOME PAGE — \/home/);
  // answers.ts :92 is the "How long can I last?" answer's door — the runway lens on the cockpit's Runway tab, not the card's — unchanged.
  const runway = ANSWER_READS['How long can I last?'];
  assert.ok(runway.computed && runway.home === '/runway' && runway.endpoint === '/api/runway');
  assert.match(code('src/lib/answers.ts'), /'How long can I last\?': \{\n\s*computed: true,[\s\S]*?home: '\/runway',/);
  // The tasks page header and the /time header say so, with the history kept.
  assert.match(comments('src/app/tasks/page.tsx'), /HOME-03 \(Alex, 2026-10-27\): the card is on the home page — DAY_CARD_PATH is\s*\n\s*\* '\/home', and the dated redirect lands there\./);
  assert.match(comments('src/app/time/page.tsx'), /HOME-03 \(Alex, 2026-10-27\) — THE CARD IS ON THE HOME PAGE, \/home/);
  assert.match(comments('src/app/time/page.tsx'), /HOME-01 \(Alex, 2026-10-24\) — THE CARD MOVED TO THE DASHBOARD; \/time IS THE\s*\n\s*\* TABLES/);
});

test('D the two-lists law reads the card\'s host on /home — once, in its boundary, between Net worth and the sheet; the cockpit may not name the card; /time and /tasks are held as before', () => {
  const law = code(LAW);
  assert.match(law, /const CARD_HOST = 'src\/components\/answers\/AnswersClient\.tsx';[^\n]*\n\s*const host = codeOf\(CARD_HOST\);\n\s*const cardMounts = \(host\.match\(\/<DayCard \\\/>\/g\) \?\? \[\]\)\.length;\n\s*if \(cardMounts !== 1\) twoListsFail\(/);
  assert.match(law, /if \(!\/<Suspense>\\s\*<DayCard \\\/>\\s\*<\\\/Suspense>\/\.test\(host\)\) twoListsFail\(/);
  assert.match(law, /const netWorthAt = host\.indexOf\('data-net-worth'\);\n\s*const cardAt = host\.indexOf\('<DayCard \/>'\);\n\s*const sheetAt = host\.indexOf\('<TheSheet \/>'\);\n\s*if \(netWorthAt < 0 \|\| sheetAt < 0 \|\| cardAt < netWorthAt \|\| cardAt > sheetAt\) twoListsFail\(/);
  assert.match(law, /if \(\/DayCard\/\.test\(codeOf\(CARD_HOST_UNTIL_HOME_03\)\)\) twoListsFail\(/);
  assert.match(law, /const TIME_MOUNTS = \['<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  assert.match(law, /if \(\/DayCard\|<Suspense\/\.test\(timePage\)\) twoListsFail\(/);
  assert.match(comments(LAW), /HOME-03 \(Alex, 2026-10-27\): THE DAY CARD MOVED TO THE HOME PAGE — \/home/);
  // The tool law's rule 5 skips /home — no tool's page (SHELL_PAGES lists it as the shell's) — so Time's component on it is no violation.
  assert.match(law, /const tools = screenTools\.get\(p\.route\);\n\s*if \(!tools\) continue;/);
  assert.match(comments(LAW), /not a tool's page — the cockpit and legacy pages are checked by their own laws/);
  assert.match(law, /\{ route: '\/home', door: 'rail — Home, the rail\\'s first entry' \},/);
  // The card mounts no Tasks component (work02.test.ts holds it) — true wherever the card is.
  assert.doesNotMatch(code(CARD), /TaskRow|TaskList|SectionE_Work|SectionD_ProjectBacklog/);
});
