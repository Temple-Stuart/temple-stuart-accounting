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

test('A the Runway panel mounts the day card first — in its Suspense boundary, once, inside the signed-in branch, above the metrics; a guest sees nothing new', () => {
  const l = code(LAUNCHER);
  assert.match(l, /import \{ Suspense, useState, useEffect, useRef, useCallback \} from 'react';/);
  assert.match(l, /import DayCard from '@\/components\/workbench\/operations\/day\/DayCard';/);
  assert.equal((l.match(/<DayCard \/>/g) ?? []).length, 1, 'mounted once');
  assert.match(l, /<div className="px-4 lg:px-8 pt-6 sm:pt-8" data-runway-day-card>\n\s*<Suspense>\n\s*<DayCard \/>\n\s*<\/Suspense>\n\s*<\/div>/, 'the boundary, in a frame of the layout\'s page gutter');
  const runwayAt = l.indexOf("activeModule === 'calendar' ? 'block' : 'hidden'");
  const cardAt = l.indexOf('<DayCard />');
  const stripAt = l.indexOf('<StageStrip', runwayAt);
  const shellAt = l.indexOf('<div className={MODULE_SHELL_CARD}>', runwayAt);
  assert.ok(runwayAt > -1 && cardAt > runwayAt && cardAt < shellAt && shellAt < stripAt, 'first on the Runway panel — before the shell card that holds the strip and the metrics');
  // Inside the signed-in branch: the nearest branch above the card is `authed === true`, and the guest branch comes after.
  assert.ok(l.lastIndexOf('{authed === true && (', cardAt) > -1);
  assert.ok(l.lastIndexOf('{authed === false && (', cardAt) < l.lastIndexOf('{authed === true && (', cardAt), 'not in a guest branch');
  assert.ok(l.indexOf('{authed === false && (') > cardAt, 'the guest landing below is unchanged');
  // No entity provider is added — the card reads none.
  assert.doesNotMatch(l, /OperationsEntityProvider|useOperationsEntity/);
  // The frame is the layout's page gutter — the frame the card had on /time — so the deck's lg bleed has its room (WIDTH-01).
  assert.match(code(APP_LAYOUT), /page \? 'max-w-7xl mx-auto w-full min-w-0 px-4 lg:px-8 py-6 sm:py-8'/);
  assert.match(code(DECK), /export const DECK_BLEED_QUERY = '\(min-width: 1024px\)';/);
  assert.match(code(DECK), /marginLeft: bleed \? -DECK_PEEK : 0, marginRight: bleed \? -DECK_PEEK : 0/);
  // The ruling-D note: Time's component on the dashboard by Alex's ruling; the cockpit is the grandfathered surface.
  assert.match(comments(LAUNCHER), /HOME-01 \(Alex, 2026-10-24\): THE DAY CARD ON THE DASHBOARD/);
  assert.match(comments(LAUNCHER), /The card is TIME'S component[\s\S]*shown here by Alex's ruling of 2026-10-24 — not a Home registry row: the cockpit is the tool law's\s*\n\s*grandfathered surface/);
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

test('B DAY_CARD_PATH is /runway — one constant; hrefFor, the hop and the move control follow; no literal anywhere', () => {
  assert.equal(DAY_CARD_PATH, '/runway');
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  assert.match(code(RULES), /export const DAY_CARD_PATH = '\/runway';/);
  assert.match(comments(RULES), /HOME-01 \(Alex, 2026-10-24\): THE CARD IS ON THE DASHBOARD — the cockpit's Runway panel, \/runway/);
  assert.match(code(CARD), /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.equal(dayCardRedirectHref({ date: '2026-10-20', step: '2' }), '/runway?date=2026-10-20&step=2');
  assert.equal(dayCardRedirectHref({}), '/runway');
  assert.match(code(DAY_PAGE), /redirect\(dayCardRedirectHref\(await searchParams\)\);/);
  assert.match(code(MOVE), /window\.location\.assign\(`\$\{DAY_CARD_PATH\}\?date=\$\{plan\.date\}`\);/);
  for (const f of [CARD, RULES, MOVE, LAUNCHER, DAY_PAGE]) assert.doesNotMatch(code(f), /['"`]\/runway\?|['"`]\/time\?|['"`]\/tasks\?/, `${f} types no card URL`);
});

test('B next.config.ts: /tasks?date|step and /time?date|step → /runway, 307; QUERY_REDIRECTS carries both, verified against the constant as before', () => {
  const cfg = code(CONFIG);
  const rules = [
    "{ source: '/tasks', has: [{ type: 'query', key: 'date' }], destination: '/runway', permanent: false },",
    "{ source: '/tasks', has: [{ type: 'query', key: 'step' }], destination: '/runway', permanent: false },",
    "{ source: '/time', has: [{ type: 'query', key: 'date' }], destination: '/runway', permanent: false },",
    "{ source: '/time', has: [{ type: 'query', key: 'step' }], destination: '/runway', permanent: false },",
  ];
  let at = -1;
  for (const rule of rules) { const next = cfg.indexOf(rule, at + 1); assert.ok(next > at, `the rule, in order: ${rule}`); at = next; }
  assert.doesNotMatch(cfg, /destination: '\/time'/);
  assert.equal((cfg.match(/permanent: false/g) ?? []).length, 4, 'the four 307s');
  assert.match(comments(CONFIG), /HOME-01 \(Alex, 2026-10-24\): the card moved again — to the dashboard/);
  const law = code(LAW);
  assert.match(law, /\{ source: '\/tasks', keys: \['date', 'step'\], destination: '\/runway', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: 'TIME-01 \(2026-10-19\): the day card moved from \/tasks to \/time; HOME-01 \(2026-10-24\): to the dashboard, \/runway' \},\n\s*\{ source: '\/time', keys: \['date', 'step'\], destination: '\/runway', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: 'HOME-01 \(2026-10-24\): the day card moved from \/time to the dashboard, \/runway' \},\n\];/);
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
  assert.match(law, /const CARD_HOST = 'src\/components\/home\/ModuleLauncher\.tsx';[^\n]*\n\s*const launcher = codeOf\(CARD_HOST\);\n\s*const cardMounts = \(launcher\.match\(\/<DayCard \\\/>\/g\) \?\? \[\]\)\.length;\n\s*if \(cardMounts !== 1\) twoListsFail\(/);
  assert.match(law, /if \(!\/<Suspense>\\s\*<DayCard \\\/>\\s\*<\\\/Suspense>\/\.test\(launcher\)\) twoListsFail\(/);
  assert.match(law, /const runwayAt = launcher\.indexOf\("activeModule === 'calendar' \? 'block' : 'hidden'"\);\n\s*const cardAt = launcher\.indexOf\('<DayCard \/>'\);\n\s*const metricsAt = launcher\.indexOf\('<StageStrip', runwayAt\);/);
  assert.match(comments(LAW), /HOME-01 \(Alex, 2026-10-24\): THE DAY CARD MOVED TO THE DASHBOARD/);
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
  assert.match(time.note ?? '', /^HOME-01 \(2026-10-24\): the day itself is entered on the day card/);
  // The cited lines are what they say.
  assert.match(code('src/components/workbench/operations/ledger/ledgerReads.ts').split('\n')[26] ?? '', /\/api\/operations\/ledger\?/);
  assert.match(code('src/components/workbench/operations/journal/journalReads.ts').split('\n')[25] ?? '', /\/api\/operations\/journal\/range\?/);
  // Tasks and the rest: unchanged words.
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.equal(tasks.home, '/tasks');
  assert.match(tasks.customer ?? '', /^You can capture a project as a brief, rank it, plan its tasks with what each should cost/); // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair).
  assert.equal(TOOL_REGISTRY.filter((t) => t.home === '/runway').length, 0, 'no Home registry row (ruling D)');
});
