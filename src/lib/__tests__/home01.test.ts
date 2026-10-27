/**
 * HOME-01 (Alex, 2026-10-24) — THE DAY CARD TO THE COCKPIT'S RUNWAY PANEL; /time BECOMES THE TABLES.
 *
 *   A. The Runway panel (ModuleLauncher, activeModule 'calendar', /runway) mounts <Suspense><DayCard /></Suspense> FIRST,
 *      above its metrics, inside its signed-in branch; nothing new for a guest. The card moves untouched; no entity provider.
 *   B. DAY_CARD_PATH = '/runway' (one constant; hrefFor, dayCardRedirectHref and the move control follow). next.config.ts:
 *      /tasks?date|step → /runway (replacing → /time) and a new dated /time?date|step → /runway; QUERY_REDIRECTS carries both.
 *      The cockpit's tab-switch rewrite keeps ?date and ?step.
 *   C. /time mounts LedgerSection, MorningJournalTable, EveningJournalTable only — no boundary (no table reads the URL);
 *      TIME_MOUNTS is the three; the law's Suspense check moved to the cockpit's mount. The Time row keeps home '/time' and
 *      PARTIAL; its why, citation and customer line are the tables'.
 *   D. No Home registry row: the cockpit stays the grandfathered surface; the mount's note says the card is Time's.
 *   E. Every pin moved with a dated note (tasksOne01, time01, time02, ledger01, ledger02, backlog02, journal07, daycard01).
 *
 * HOME-03 (Alex, 2026-10-27): the card moved on — to the home page, /home (answers/AnswersClient.tsx; home03.test.ts holds
 * the mount, the constant and the redirects). Every pin below that named the panel or /runway as the card's home moved with
 * it, dated; the panel's own pins (the tab-switch rewrite, the frame, the guest branch) stand.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { code, comments } from '../sourceText';
import { DAY_CARD_PARAMS, DAY_CARD_PATH, dayCardRedirectHref } from '@/components/workbench/operations/day/dayCard';
import { TOOL_REGISTRY } from '../toolRegistry';
import { PHASES_RENDERED_AT, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';

const OPS = 'src/components/workbench/operations';
const RULES = `${OPS}/day/dayCard.ts`;
const CARD = `${OPS}/day/DayCard.tsx`;
const MOVE = `${OPS}/stops/MoveControl.tsx`;
const CARD_IMAGE = `${OPS}/cardImage.ts`;
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const HOME_CLIENT = 'src/components/home/HomeClient.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';
const FRONT_DOOR = 'src/app/page.tsx';
const TAB_PAGE = 'src/app/[tab]/page.tsx';
const DAY_PAGE = 'src/app/tasks/day/page.tsx';
const CONFIG = 'next.config.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const APP_LAYOUT = 'src/components/ui/AppLayout.tsx';
const DECK = `${OPS}/stops/DayDeck.tsx`;

// ── A · THE CARD ON THE COCKPIT ───────────────────────────────────────────────

test('A the Runway panel mounted the day card first (HOME-01) — HOME-03 (Alex, 2026-10-27): it mounts it no more; the card is /home\'s (home03.test.ts) and the panel keeps the runway pipe\'s surfaces, the guest branch unchanged', () => {
  const l = code(LAUNCHER);
  // HOME-03 (Alex, 2026-10-27): the import, the boundary and the mount left for answers/AnswersClient.tsx — a dated note stands where the mount was.
  assert.match(l, /import \{ useState, useEffect, useRef, useCallback \} from 'react';/, 'Suspense left with the card');
  assert.doesNotMatch(l, /DayCard|Suspense|data-runway-day-card/);
  assert.match(comments(LAUNCHER), /HOME-03 \(Alex, 2026-10-27\): the day card left this panel for the home page, \/home[\s\S]*HOME-01 \(2026-10-24\) had put it FIRST here/);
  const runwayAt = l.indexOf("activeModule === 'calendar' ? 'block' : 'hidden'");
  const stripAt = l.indexOf('<StageStrip', runwayAt);
  const shellAt = l.indexOf('<div className={MODULE_SHELL_CARD}>', runwayAt);
  assert.ok(runwayAt > -1 && shellAt > runwayAt && stripAt > shellAt, 'the shell card that holds the strip and the metrics is first on the panel now');
  assert.ok(l.indexOf('{authed === true && (') < shellAt && l.indexOf('{authed === false && (') > shellAt, 'the signed-in branch, then the guest landing below, unchanged');
  // No entity provider — the card never read one, here or on /home.
  assert.doesNotMatch(l, /OperationsEntityProvider|useOperationsEntity/);
  // The frame is the layout's page gutter — the frame the card had on /time — so the deck's lg bleed has its room (WIDTH-01).
  assert.match(code(APP_LAYOUT), /page \? 'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8'/);
  assert.match(code(DECK), /export const DECK_BLEED_QUERY = '\(min-width: 1024px\)';/);
  assert.match(code(DECK), /marginLeft: bleed \? -DECK_PEEK : 0, marginRight: bleed \? -DECK_PEEK : 0/);
  // The ruling-D note moved with the card (HOME-03): Time's component, now on /home — answers/AnswersClient.tsx says so; no Home registry row still.
  assert.match(comments('src/components/answers/AnswersClient.tsx'), /The card is TIME'S component \(toolRegistry\.ts, the Time row; TIME-01, 2026-10-19\), moved here\s*\n\s*from the cockpit's Runway panel \(HOME-01, 2026-10-24\)/);
  // The boundary is belt and braces: both routes that render the cockpit are force-dynamic, and the launcher already reads the URL.
  assert.match(code(FRONT_DOOR), /export const dynamic = 'force-dynamic';/);
  assert.match(code(TAB_PAGE), /export const dynamic = 'force-dynamic';/);
  assert.match(l, /import \{ usePathname, useSearchParams \} from 'next\/navigation';/);
  assert.match(code(HOME_CLIENT), /fetch\('\/api\/auth\/me'\)/, 'the launcher mounts after the auth check — client side');
});

test('A the card moved untouched: the reel buttons are still inside DayCard, and the reel helper is byte for byte what it was', () => {
  const c = code(CARD);
  // The four reel buttons, by the constants that hold their words (cardImage.ts the two downloads, dayCard.ts the two copies).
  for (const name of ['DOWNLOAD_IMAGE_WORDS', 'DOWNLOAD_TAG_WORDS', 'COPY_CAPTION_WORDS', 'COPY_SCRIPT_WORDS']) assert.ok(c.includes(`{${name}}`), `the card still draws ${name}`);
  assert.match(c, /import \{ DOWNLOAD_IMAGE_WORDS, DOWNLOAD_TAG_WORDS, cardImageFailedWords, cardImageName, cardTagName, downloadCardImage \} from '\.\.\/cardImage';/);
  assert.match(code(CARD_IMAGE), /export const DOWNLOAD_IMAGE_WORDS = 'download image';/);
  assert.match(code(CARD_IMAGE), /export const DOWNLOAD_TAG_WORDS = 'download tag';/);
  assert.match(code(RULES), /export const COPY_CAPTION_WORDS = 'copy caption';\nexport const COPY_SCRIPT_WORDS = 'copy script';/);
  assert.match(c, /data-day-download-image>\{DOWNLOAD_IMAGE_WORDS\}<\/button>/);
  assert.match(c, /useSearchParams\(\)/);
  assert.deepEqual([...c.matchAll(/search\.get\('(\w+)'\)/g)].map((m) => m[1]), ['date', 'step']);
  assert.equal(createHash('sha256').update(code(CARD_IMAGE)).digest('hex'), 'a762a39b3a2a7482a020a67219fde91012adb89c838b64a0ba65abaa7f20761b', 'cardImage.ts unchanged (sha256 of its code)');
});

// ── B · THE URL ───────────────────────────────────────────────────────────────

test('B DAY_CARD_PATH is /home (HOME-03; /runway from HOME-01) — one constant; hrefFor, the hop and the move control follow; no literal anywhere', () => {
  assert.equal(DAY_CARD_PATH, '/home'); // HOME-03 (Alex, 2026-10-27): the card moved on to the home page
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  assert.match(code(RULES), /export const DAY_CARD_PATH = '\/home';/);
  assert.match(comments(RULES), /HOME-01 \(Alex, 2026-10-24\): THE CARD IS ON THE DASHBOARD — the cockpit's Runway panel, \/runway/, 'the history stays');
  assert.match(comments(RULES), /HOME-03 \(Alex, 2026-10-27\): THE CARD IS ON THE HOME PAGE — \/home/);
  assert.match(code(CARD), /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.equal(dayCardRedirectHref({ date: '2026-10-20', step: '2' }), '/home?date=2026-10-20&step=2'); // HOME-03: /home
  assert.equal(dayCardRedirectHref({}), '/home');
  assert.match(code(DAY_PAGE), /redirect\(dayCardRedirectHref\(await searchParams\)\);/);
  assert.match(code(MOVE), /window\.location\.assign\(`\$\{DAY_CARD_PATH\}\?date=\$\{plan\.date\}`\);/);
  for (const f of [CARD, RULES, MOVE, LAUNCHER, DAY_PAGE, 'src/components/answers/AnswersClient.tsx']) assert.doesNotMatch(code(f), /['"`]\/home\?|['"`]\/runway\?|['"`]\/time\?|['"`]\/tasks\?/, `${f} types no card URL`); // HOME-03: the host joins the list
});

test('B next.config.ts: /tasks?date|step and /time?date|step → /home, 307 (HOME-03; /runway from HOME-01), and /runway?date|step the same way; QUERY_REDIRECTS carries the three, verified against the constant as before', () => {
  const cfg = code(CONFIG);
  // HOME-03 (Alex, 2026-10-27): the four rules land on /home; two dated /runway rules follow — home03.test.ts C holds the six.
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
  assert.doesNotMatch(cfg, /destination: '\/time'|destination: '\/runway'/);
  assert.equal((cfg.match(/permanent: false/g) ?? []).length, 6, 'the six 307s');
  assert.match(comments(CONFIG), /HOME-01 \(Alex, 2026-10-24\): the card moved again — to the dashboard/, 'the history stays');
  assert.match(comments(CONFIG), /HOME-03 \(Alex, 2026-10-27\): the card moved once more — to the home page, \/home/);
  const law = code(LAW);
  assert.match(law, /\{ source: '\/tasks', keys: \['date', 'step'\], destination: '\/home', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: 'TIME-01 \(2026-10-19\): the day card moved from \/tasks to \/time; HOME-01 \(2026-10-24\): to the dashboard, \/runway; HOME-03 \(2026-10-27\): to the home page, \/home' \},\n\s*\{ source: '\/time', keys: \['date', 'step'\], destination: '\/home', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: 'HOME-01 \(2026-10-24\): the day card moved from \/time to the dashboard, \/runway; HOME-03 \(2026-10-27\): to the home page, \/home' \},\n\s*\{ source: '\/runway', keys: \['date', 'step'\], destination: '\/home', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: 'HOME-03 \(2026-10-27\): the day card moved from the cockpit\\'s Runway panel, \/runway, to the home page, \/home; a bare \/runway stays the cockpit\\'s calendar tab' \},\n\];/);
  // Verified as before: the rule's text in the config, the destination against the constant, the target's door.
  assert.match(law, /if \(!nextConfigText\.includes\(rule\)\) violations\.push\(/);
  assert.match(law, /if \(!codeOf\(q\.constant\.file\)\.includes\(`export const \$\{q\.constant\.name\} = '\$\{q\.destination\}';`\)\) violations\.push\(/);
  assert.match(law, /const targetDoor = findDoor\(q\.destination\);\n\s*if \(!targetDoor\) violations\.push\(/);
  // /runway's door is the "How long can I last?" answer (answers.ts), a computed read with home '/runway'.
  assert.match(code('src/lib/answers.ts'), /'How long can I last\?': \{\n\s*computed: true,[\s\S]*?home: '\/runway',/);
});

test('B the cockpit\'s tab-switch rewrite keeps every other parameter — ?date and ?step survive a switch to Travel and back', () => {
  const l = code(LAUNCHER);
  assert.match(l, /const writeTabParam = \(key: string\) => \{\n\s*const params = new URLSearchParams\(window\.location\.search\);\n\s*params\.delete\('tab'\);/, 'built from the live query; only tab is dropped');
  assert.match(l, /window\.history\.replaceState\(null, '', `\$\{path\}\$\{qs \? `\?\$\{qs\}` : ''\}\$\{window\.location\.hash\}`\);/);
  assert.match(l, /const selectTab = \(key: string\) => \{ setActiveModule\(key\); onTabChange\?\.\(key\); writeTabParam\(key\); \};/);
  // The restore effect reads the PATH first and strips only an invalid ?tab= — never date or step.
  assert.match(l, /const seg = window\.location\.pathname\.split\('\/'\)\[1\] \?\? '';\n\s*const fromPath = seg === 'runway' \? 'calendar' : TABS\.some\(\(t\) => t\.key === seg\) \? seg : null;/);
  assert.match(l, /calendar: '\/runway', travel: '\/travel', trade: '\/trade',/);
  // The panels are CSS-hidden, never unmounted — the card keeps its state across a switch.
  assert.match(l, /\$\{activeModule === 'calendar' \? 'block' : 'hidden'\}/);
});

// ── C · TIME = TABLES ─────────────────────────────────────────────────────────

test('C /time mounts exactly the three tables, in order, in the one provider — no card, no boundary; the header says so', () => {
  const page = code(TIME_PAGE);
  assert.match(page, /<ToolOpener tools=\{\[navToolByName\('Time', TOOL_GATE\)\]\} \/>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  assert.doesNotMatch(page, /DayCard|Suspense|useSearchParams/);
  for (const f of [`${OPS}/ledger/LedgerSection.tsx`, `${OPS}/journal/MorningJournalTable.tsx`, `${OPS}/journal/EveningJournalTable.tsx`, `${OPS}/journal/JournalDayTable.tsx`]) assert.doesNotMatch(code(f), /useSearchParams/, `${f} reads no URL — no boundary needed`);
  assert.match(comments(TIME_PAGE), /HOME-01 \(Alex, 2026-10-24\) — THE CARD MOVED TO THE DASHBOARD; \/time IS THE\s*\n\s*\* TABLES/);
  assert.match(comments(TIME_PAGE), /TIME-01 \(Alex, 2026-10-19\)/, 'the history stays');
  // The law: TIME_MOUNTS is the three; the card may not come back; the boundary check reads the cockpit component.
  const law = code(LAW);
  assert.match(law, /const TIME_MOUNTS = \['<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  assert.match(law, /timeMounts\.join\(' '\) !== 'LedgerSection MorningJournalTable EveningJournalTable'/);
  assert.match(law, /if \(\/DayCard\|<Suspense\/\.test\(timePage\)\) twoListsFail\(/);
  // HOME-03 (Alex, 2026-10-27): the boundary check follows the card to /home — the host is answers/AnswersClient.tsx; the cockpit may not name the card.
  assert.match(law, /const CARD_HOST = 'src\/components\/answers\/AnswersClient\.tsx';[^\n]*\n\s*const host = codeOf\(CARD_HOST\);\n\s*const cardMounts = \(host\.match\(\/<DayCard \\\/>\/g\) \?\? \[\]\)\.length;\n\s*if \(cardMounts !== 1\) twoListsFail\(/);
  assert.match(law, /if \(!\/<Suspense>\\s\*<DayCard \\\/>\\s\*<\\\/Suspense>\/\.test\(host\)\) twoListsFail\(/);
  assert.match(law, /const netWorthAt = host\.indexOf\('data-net-worth'\);\n\s*const cardAt = host\.indexOf\('<DayCard \/>'\);\n\s*const sheetAt = host\.indexOf\('<TheSheet \/>'\);/);
  assert.match(law, /if \(\/DayCard\/\.test\(codeOf\(CARD_HOST_UNTIL_HOME_03\)\)\) twoListsFail\(/);
  assert.match(comments(LAW), /HOME-01 \(Alex, 2026-10-24\): THE DAY CARD MOVED TO THE DASHBOARD/, 'the history stays');
  assert.match(comments(LAW), /HOME-03 \(Alex, 2026-10-27\): THE DAY CARD MOVED TO THE HOME PAGE/);
  assert.deepEqual(PHASES_RENDERED_AT['/time'], []);
  assert.equal(navToolByName('Time', TOOL_GATE).href, '/time');
});

test('C the Time row: home /time, LIVE since TIME-03 (no why); the citation and the customer line are the tables\' (ruling C); every other row unchanged', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  assert.equal(time.home, '/time');
  // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. The why left with the status (a LIVE row carries none); the customer line gained the cost, the time against its plan and the hours.
  assert.equal(time.status, 'LIVE');
  assert.equal(time.why, undefined);
  assert.equal(time.customer, 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.');
  for (const f of ['src/components/workbench/operations/ledger/ledgerReads.ts:27', 'src/components/workbench/operations/journal/journalReads.ts:26', 'src/components/workbench/operations/ledger/LedgerSection.tsx', 'src/components/workbench/operations/journal/MorningJournalTable.tsx', 'src/components/workbench/operations/journal/EveningJournalTable.tsx']) {
    assert.ok(time.citation.includes(f), `the citation names ${f}`);
  }
  assert.doesNotMatch(time.citation, /dayReads\.ts/, 'the card\'s six GETs are not the tables\' evidence');
  assert.match(time.note ?? '', /^HOME-03 \(2026-10-27\): the day itself is entered on the day card — Time's component, shown on the home page, \/home/); // HOME-03 (Alex, 2026-10-27): the note says where the card is now
  // The cited lines are what they say.
  assert.match(code('src/components/workbench/operations/ledger/ledgerReads.ts').split('\n')[26] ?? '', /\/api\/operations\/ledger\?/);
  assert.match(code('src/components/workbench/operations/journal/journalReads.ts').split('\n')[25] ?? '', /\/api\/operations\/journal\/range\?/);
  // Tasks and the rest: unchanged words.
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.equal(tasks.home, '/tasks');
  assert.match(tasks.customer ?? '', /^You can capture a project as a brief, rank it, plan its tasks with what each should cost/); // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair).
  assert.equal(TOOL_REGISTRY.filter((t) => t.home === '/runway').length, 0, 'no Home registry row (ruling D)');
});
