/**
 * TIME-01 (Alex, 2026-10-19) — the day card (deck, journal card, reel buttons,
 * stay bar, move control) and the expense ledger move to /time, above the
 * content pipeline; /tasks keeps Projects and Routines; every link and law
 * follows.
 *
 * T1 the pages: /time is the card (in its Suspense boundary), the ledger, then
 *    the pipeline as it is, inside the provider; /tasks is Projects and
 *    Routines only; one opener each; nothing cross-mounted; no merged grid.
 * T2 the path: DAY_CARD_PATH is '/time'; every derived URL follows (hrefFor,
 *    the hop); the move control reloads through the constant; no /tasks?
 *    literal is left in the product's code.
 * T3 the dated redirect: next.config.ts sends /tasks?date= and ?step= to /time
 *    with the same query; the law names it as a redirect door and verifies the
 *    rules and the constant; a plain /tasks is the Tasks page.
 * T4 the laws: the two-lists law holds /tasks to the two lists and /time to the
 *    three mounts; PHASES_RENDERED_AT and THE SORT are untouched (the pipeline
 *    still renders); the gate table is untouched.
 * T5 the registry: the Time row says the day card and the ledger (its citation
 *    the card's and the ledger's own routes, the pipeline in the note); the
 *    Tasks row says projects and routines, unchanged; the showcase map and the
 *    content redirects stand.
 *
 * HOME-03 (Alex, 2026-10-27): the card moved on to the home page, /home (answers/AnswersClient.tsx; DAY_CARD_PATH '/home';
 * home03.test.ts). Every pin below that said /runway was the card's page moved with it, dated; the rules are unchanged.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { code, comments } from '../sourceText';
import { PHASES_RENDERED_AT, THE_SORT } from '../nav';
import { TOOL_GATE } from '../offer';
import { COCKPIT_PATH, COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY } from '../toolRegistry';
import { DAY_CARD_PARAMS, DAY_CARD_PATH, dayCardRedirectHref } from '@/components/workbench/operations/day/dayCard';

const TIME_PAGE = 'src/app/time/page.tsx';
const TASKS_PAGE = 'src/app/tasks/page.tsx';
const DAY_PAGE = 'src/app/tasks/day/page.tsx';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const MOVE = 'src/components/workbench/operations/stops/MoveControl.tsx';
const CONFIG = 'next.config.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';

test('T1 the pages: /time is the three tables (HOME-01: the card is on the dashboard); /tasks is THE WORK and PROJECTS; one opener each; nothing cross-mounted', () => {
  const time = code(TIME_PAGE);
  const tasks = code(TASKS_PAGE);
  // /time — a client page (the card reads the URL), the provider, the two in order; the card in its boundary.
  // TIME-02 (2026-10-19): the third mount, the content pipeline, is retired — time02.test.ts pins the absences.
  assert.match(time, /^'use client';/);
  // HOME-01 (Alex, 2026-10-24): the card and its boundary left for the dashboard — no Suspense, no DayCard on /time.
  assert.doesNotMatch(time, /import \{ Suspense \} from 'react';|DayCard/);
  for (const imp of ["import LedgerSection from '@/components/workbench/operations/ledger/LedgerSection';"]) assert.ok(time.includes(imp), imp);
  // JOURNAL-07 (Alex, 2026-10-24): the two journal tables mount under the ledger — the /time container is four (TIME_MOUNTS), the ledger still the section after the card.
  assert.match(time, /<ToolOpener tools=\{\[navToolByName\('Time', TOOL_GATE\)\]\} \/>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/); // HOME-01 (2026-10-24): the three tables
  const timeBox = time.slice(time.indexOf('data-tool-page="Time"'), time.indexOf('</OperationsEntityProvider>'));
  // JOURNAL-07 (Alex, 2026-10-24): the container is four — the two journal tables under the ledger, in the shared idiom, read-only.
  assert.deepEqual([...timeBox.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['LedgerSection', 'MorningJournalTable', 'EveningJournalTable']); // HOME-01 (2026-10-24): the card is the dashboard's
  assert.equal((time.match(/<ToolOpener/g) ?? []).length, 1);
  // /tasks — the two lists, nothing else; no card, no ledger.
  // BACKLOG-02 (Alex, 2026-10-20): a boundary is back on /tasks — around the projects list ALONE, which reads ?project= and ?new=project (useSearchParams); the day card stays /time's: the page itself still reads no URL (the list does, in its boundary).
  assert.match(tasks, /^'use client';/);
  // WORK-01d (Alex, 2026-10-25): three tables on /tasks — THE WORK, PROJECTS in its boundary, ROUTINE EXPENSES.
  // EXPENSES-01 (Alex, 2026-10-25): ROUTINE EXPENSES moved to /expenses (src/app/expenses/page.tsx) — Tasks is THE WORK and PROJECTS. Two mounts, in order.
  assert.match(tasks, /<ToolOpener tools=\{\[navToolByName\('Tasks', TOOL_GATE\)\]\} \/>\n\s*<WorkChangesProvider>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  const tasksBox = tasks.slice(tasks.indexOf('data-tool-page="Tasks"'), tasks.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...tasksBox.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['SectionE_Work', 'Suspense', 'SectionD_ProjectBacklog']); // WORK-01 (2026-10-24): THE WORK first; WORK-01d: ROUTINE EXPENSES last; EXPENSES-01: it left for /expenses
  assert.doesNotMatch(tasks, /DayCard|LedgerSection|ContentPipeline|useSearchParams/, 'nothing of Time on Tasks');
  assert.doesNotMatch(time, /SectionD_ProjectBacklog|SectionE_Routines|SectionE_Work|SectionF_RoutineExpenses/, 'nothing of Tasks on Time');
  assert.equal((tasks.match(/<ToolOpener/g) ?? []).length, 1);
  // The merged grid is Calendar's — neither page pulls it in (tool law 5); the card imports none.
  for (const f of [TIME_PAGE, TASKS_PAGE, CARD]) assert.doesNotMatch(code(f), /HubCalendar/, `${f} mounts no merged grid`);
  for (const f of [TIME_PAGE, TASKS_PAGE]) assert.match(comments(f), /TIME-01 \(Alex, 2026-10-19\)/);
});

test('T2 the path: DAY_CARD_PATH is /home (HOME-03; /runway from HOME-01), every derived URL follows, the move control reloads through the constant, no /tasks? or /time? literal left', () => {
  assert.equal(DAY_CARD_PATH, '/home'); // HOME-01 (Alex, 2026-10-24): the card moved to the dashboard; HOME-03 (Alex, 2026-10-27): to the home page
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  assert.match(code(RULES), /export const DAY_CARD_PATH = '\/home';/);
  assert.match(comments(RULES), /TIME-01 \(Alex, 2026-10-19\): THE FIRST SECTION OF \/time/);
  assert.match(comments(RULES), /HOME-01 \(Alex, 2026-10-24\): THE CARD IS ON THE DASHBOARD/);
  assert.match(comments(RULES), /HOME-03 \(Alex, 2026-10-27\): THE CARD IS ON THE HOME PAGE/);
  // The card's own URLs — hrefFor on the constant; the controls push it; the deck replaces it (unchanged rules).
  const c = code(CARD);
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.equal((c.match(/go\(hrefFor\(/g) ?? []).length, 3);
  assert.match(c, /router\.replace\(hrefFor\(day, step\), \{ scroll: false \}\)/);
  assert.doesNotMatch(c, /['"`]\/tasks|['"`]\/time\?|['"`]\/runway\?|['"`]\/home\?/, 'no URL of the card is typed outside DAY_CARD_PATH');
  // The hop keeps date and step exactly as given, on the constant. HOME-03 (2026-10-27): /home.
  assert.equal(dayCardRedirectHref({ date: '2026-10-15', step: '2' }), '/home?date=2026-10-15&step=2');
  assert.equal(dayCardRedirectHref({}), '/home');
  const hop = code(DAY_PAGE);
  assert.match(hop, /redirect\(dayCardRedirectHref\(await searchParams\)\);/);
  assert.doesNotMatch(hop, /['"`]\/tasks|['"`]\/time|['"`]\/runway|['"`]\/home/, 'the hop types no path — the constant is the path');
  assert.match(comments(DAY_PAGE), /TIME-01 \(Alex, 2026-10-19\): the card\s*\n\s*\* is the first section of \/time now/);
  // The move control: the reload through the constant; the literal is gone.
  const m = code(MOVE);
  assert.match(m, /import \{ DAY_CARD_PATH \} from '\.\.\/day\/dayCard';/);
  assert.match(m, /window\.location\.assign\(`\$\{DAY_CARD_PATH\}\?date=\$\{plan\.date\}`\);/);
  assert.doesNotMatch(m, /\/tasks/, 'no literal');
  assert.match(comments(MOVE), /TIME-01, 2026-10-19: \/time; HOME-01, 2026-10-24: \/runway; HOME-03, 2026-10-27: \/home; no literal/); // HOME-03: the note gained its line
  // Nothing under the product's components types a /tasks? URL — the constant is the one place.
  for (const f of [CARD, RULES, MOVE, 'src/components/workbench/operations/stops/JournalForm.tsx', 'src/components/workbench/operations/ledger/LedgerSection.tsx', 'src/components/workbench/operations/stays/StayBar.tsx', 'src/components/workbench/operations/stops/DayDeck.tsx']) {
    assert.doesNotMatch(code(f), /\/tasks\?|\/time\?|\/runway\?|\/home\?/, `${f} types no card URL`);
  }
});

test('T3 the dated redirects: next.config.ts sends /tasks?date=|step=, /time?date=|step= and /runway?date=|step= to /home with the same query (HOME-03; /runway from HOME-01); the law names the three as doors and verifies them; a plain /tasks, /time and /runway are their pages', () => {
  const cfg = code(CONFIG);
  // HOME-01 (Alex, 2026-10-24): the two /tasks rules land on /runway; two dated /time rules follow the same way (307).
  // HOME-03 (Alex, 2026-10-27): the four land on /home; two dated /runway rules follow the same way (307).
  assert.match(cfg, /\{ source: '\/tasks', has: \[\{ type: 'query', key: 'date' \}\], destination: '\/home', permanent: false \},\n\s*\{ source: '\/tasks', has: \[\{ type: 'query', key: 'step' \}\], destination: '\/home', permanent: false \},\n\s*\{ source: '\/time', has: \[\{ type: 'query', key: 'date' \}\], destination: '\/home', permanent: false \},\n\s*\{ source: '\/time', has: \[\{ type: 'query', key: 'step' \}\], destination: '\/home', permanent: false \},\n\s*\{ source: '\/runway', has: \[\{ type: 'query', key: 'date' \}\], destination: '\/home', permanent: false \},\n\s*\{ source: '\/runway', has: \[\{ type: 'query', key: 'step' \}\], destination: '\/home', permanent: false \},/);
  assert.equal((cfg.match(/source: '\/runway'/g) ?? []).length, 2, 'the two keys, and no rule for a bare /runway');
  assert.equal((cfg.match(/source: '\/tasks'/g) ?? []).length, 2, 'the two keys, and no rule for a plain /tasks');
  assert.equal((cfg.match(/source: '\/time'/g) ?? []).length, 2, 'the two keys, and no rule for a plain /time');
  assert.doesNotMatch(cfg, /destination: '\/time'|destination: '\/runway'/, 'nothing is sent to /time or /runway now — the card left both (HOME-01; HOME-03)');
  assert.doesNotMatch(cfg, /source: '\/tasks\/:path\*'|source: '\/tasks\/day'|source: '\/time\/:path\*'/, '/tasks/day keeps its own hop (the page); nothing else under /tasks or /time is redirected');
  assert.match(comments(CONFIG), /TIME-01 \(Alex, 2026-10-19\): the day card moved from \/tasks to \/time/);
  assert.match(comments(CONFIG), /HOME-01 \(Alex, 2026-10-24\): the card moved again — to the dashboard/);
  assert.match(comments(CONFIG), /HOME-03 \(Alex, 2026-10-27\): the card moved once more — to the home page, \/home/);
  // Named in the registry's redirect doors like /content's, verified against the config and the constant.
  const law = code(LAW);
  // HOME-01 (Alex, 2026-10-24): two entries, both to /runway, both verified against the constant — the /tasks entry re-dated, the /time entry new.
  // HOME-03 (Alex, 2026-10-27): three entries, all to /home — the two re-dated, the /runway entry new (home01.test.ts pins the full text).
  const entries = [...law.matchAll(/\{ source: '([^']+)', keys: \['date', 'step'\], destination: '([^']+)', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: '([^\n]*?)' \},/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(entries.map(([s, d]) => `${s} → ${d}`), ['/tasks → /home', '/time → /home', '/runway → /home']);
  assert.match(entries[0][2], /^TIME-01 \(2026-10-19\): the day card moved from \/tasks to \/time; HOME-01 \(2026-10-24\): to the dashboard, \/runway; HOME-03 \(2026-10-27\): to the home page, \/home$/);
  assert.match(entries[1][2], /^HOME-01 \(2026-10-24\): the day card moved from \/time to the dashboard, \/runway; HOME-03 \(2026-10-27\): to the home page, \/home$/);
  assert.match(entries[2][2], /^HOME-03 \(2026-10-27\): the day card moved from the cockpit/);
  assert.match(comments(LAW), /HOME-01 \(Alex, 2026-10-24\): the card moved to the dashboard — the cockpit's Runway panel, \/runway/);
  assert.match(law, /const rule = `\{ source: '\$\{q\.source\}', has: \[\{ type: 'query', key: '\$\{key\}' \}\], destination: '\$\{q\.destination\}', permanent: false \}`;\n\s*if \(!nextConfigText\.includes\(rule\)\) violations\.push\(/, 'the rule verified against the config text');
  assert.match(law, /if \(!codeOf\(q\.constant\.file\)\.includes\(`export const \$\{q\.constant\.name\} = '\$\{q\.destination\}';`\)\) violations\.push\(/, 'the destination verified against the constant');
  assert.match(law, /const targetDoor = findDoor\(q\.destination\);\n\s*if \(!targetDoor\) violations\.push\(/, 'the target must have a door');
  assert.match(law, /console\.log\(`\$\{`\$\{q\.source\}\?\$\{q\.keys\.join\('=\|'\)\}=`\.padEnd\(48\)\} \$\{'redirect'\.padEnd\(15\)\} → \$\{q\.destination\}/, 'listed with the doors');
  assert.match(comments(LAW), /TIME-01 \(Alex, 2026-10-19\): A DATED QUERY REDIRECT/);
  // The content redirects stand: /content and /operations/content hop to /time (TOOL-LAW-01).
  for (const f of ['src/app/content/page.tsx', 'src/app/operations/content/page.tsx']) assert.match(code(f), /redirect\('\/time'\)/);
});

test('T4 the laws: the two-lists law holds /tasks to the two lists and /time to the three tables (HOME-01); the card\'s boundary check is /home\'s (HOME-03); PHASES_RENDERED_AT and THE SORT say /time draws nothing; the gate table untouched', () => {
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_PAGE = 'src\/app\/tasks\/page\.tsx';\n\s*const TIME_PAGE = 'src\/app\/time\/page\.tsx';/);
  // WORK-01d (Alex, 2026-10-25): three mounts on /tasks.
  // EXPENSES-01 (Alex, 2026-10-25): two — ROUTINE EXPENSES moved to /expenses (src/app/expenses/page.tsx), held by the same block.
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>'\];/);
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionE_Work SectionD_ProjectBacklog'/);
  assert.match(law, /const EXPENSES_PAGE = 'src\/app\/expenses\/page\.tsx';/);
  assert.match(law, /if \(\/DayCard\|LedgerSection\/\.test\(page\)\) twoListsFail\(/, 'the two that went may not come back unnoticed');
  // HOME-01 (Alex, 2026-10-24): three mounts on /time; the card's boundary check reads the cockpit component.
  assert.match(law, /const TIME_MOUNTS = \['<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  assert.match(law, /timeMounts\.join\(' '\) !== 'LedgerSection MorningJournalTable EveningJournalTable'/);
  assert.match(law, /if \(\/DayCard\|<Suspense\/\.test\(timePage\)\) twoListsFail\(/, 'the card may not come back to /time unnoticed');
  assert.match(law, /if \(!\/<Suspense>\\s\*<DayCard \\\/>\\s\*<\\\/Suspense>\/\.test\(host\)\) twoListsFail\(/, 'the card in its boundary — on /home (HOME-03, 2026-10-27; the Runway panel until then)');
  assert.match(comments(LAW), /TIME-01 — the ruling \(Alex, 2026-10-19\): the day card and the city ledger moved to \/time/);
  // TIME-02 (2026-10-19): the third mount is retired — the law says so, dated.
  assert.match(comments(LAW), /TIME-02 \(2026-10-19\): the third mount, the content pipeline, is retired/);
  // The controls list is unchanged — the stop form's "✓ done now" is still the one way a routine is marked done.
  assert.match(law, /\['src\/components\/workbench\/operations\/stops\/StopForm\.tsx', \/data-stop-done-now\[\\s\\S\]\*✓ done now\/, 'the stop form on the day card lost "✓ done now" — the one way a routine is marked done'\],/);
  // TIME-02 (2026-10-19): the pipeline is retired — /time draws nothing; the content pipe stays Time's, declared undrawn until PIPES-01.
  assert.deepEqual(PHASES_RENDERED_AT['/time'], []);
  assert.deepEqual(PHASES_RENDERED_AT['/tasks'], []);
  assert.deepEqual(THE_SORT.filter((a) => a.pipe === 'content').map((a) => [a.owner, a.rendersSurface]), [['Time', false], ['Time', false], ['Time', false], ['Time', false]]);
  // The gate table: both free, as before.
  assert.equal(TOOL_GATE.Time, null);
  assert.equal(TOOL_GATE.Tasks, null);
});

test('T5 the registry: the Time row says the tables (HOME-01, ruling C); the Tasks row says projects and routines; the maps and redirects stand', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.equal(time.home, '/time'); assert.equal(time.status, 'LIVE'); // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13.
  // LEDGER-02 (Alex, 2026-10-19): "the task ledger" where the why and the customer line said "the ledger of every stop" — the rest unchanged.
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): "the task ledger of every stop … by city, account and book" — "every stop" kept, the book added.
  // HOME-01 (Alex, 2026-10-24, ruling C): the row's words are the tables'.
  assert.equal(time.why, undefined); // TIME-03 (Alex, 2026-10-26): a LIVE row carries no why — the tables' line left with the status (time03.test.ts pins the row)
  // HOME-01 (Alex, 2026-10-24): discover is the two tables' reads; the card's routes stay the decide and commit beats (the card is Time's, on the dashboard).
  assert.match(time.citation, /discover: src\/components\/workbench\/operations\/ledger\/ledgerReads\.ts:27 \(GET \/api\/operations\/ledger\?from=&to=/);
  assert.match(time.citation, /src\/components\/workbench\/operations\/journal\/journalReads\.ts:26 \(GET \/api\/operations\/journal\/range\?from=&to=/);
  assert.match(time.citation, /decide: src\/app\/api\/operations\/journal\/route\.ts:51 \(PUT/);
  assert.match(time.citation, /commit: src\/app\/api\/operations\/stops\/route\.ts \(POST/);
  assert.match(time.citation, /record: src\/components\/workbench\/operations\/ledger\/LedgerSection\.tsx/);
  // HOME-03 (Alex, 2026-10-27): the note says the card is on the home page, /home.
  assert.equal(time.note, 'HOME-03 (2026-10-27): the day itself is entered on the day card — Time\'s component, shown on the home page, /home, between the answers and the sheet (HOME-01, 2026-10-24, had it on the cockpit\'s Runway panel, /runway); /time is the tables. TIME-02 (2026-10-19): the content pipeline retired — its components and routes deleted; its five tables kept, untouched, until TABLES-01.'); // TIME-03: the "not done" sentence left — the ledger adds up the hours now
  assert.equal(time.customer, 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.'); // TIME-03
  assert.doesNotMatch(time.customer ?? '', /\b(discover|decide|commit|record)\b/, 'no beat word on a public line (the plan law)');
  assert.equal(tasks.home, '/tasks');
  assert.equal(tasks.why, undefined); // TASKS-03 (Alex, 2026-10-26): Tasks is LIVE — THE WORK prints ACTUAL as logged and MATCH from Books (the ledger's pair); 3 · 9 · 13 → 4 · 8 · 13.
  // TASKS-02 (2026-10-20): the two links are gone — the North Star's page deleted, the audit trail Compliance's.
  assert.deepEqual(tasks.links, []);
  assert.match(comments(REGISTRY), /TIME-01 \(Alex, 2026-10-19\): the day card and the city ledger moved to\s*\n\s*\/\/ \/time/);
  assert.match(comments(REGISTRY), /TIME-01 \(Alex, 2026-10-19\): THE DAY CARD IS TIME'S/);
  assert.equal(COCKPIT_PRIMARY_TOOL.content, 'Time');
  assert.equal(COCKPIT_PATH.content, '/content');
});
