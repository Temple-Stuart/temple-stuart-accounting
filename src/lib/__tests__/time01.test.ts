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

test('T1 the pages: /time is the card then the ledger (TIME-02: nothing beneath); /tasks is Projects and Routines only; one opener each; nothing cross-mounted', () => {
  const time = code(TIME_PAGE);
  const tasks = code(TASKS_PAGE);
  // /time — a client page (the card reads the URL), the provider, the two in order; the card in its boundary.
  // TIME-02 (2026-10-19): the third mount, the content pipeline, is retired — time02.test.ts pins the absences.
  assert.match(time, /^'use client';/);
  assert.match(time, /import \{ Suspense \} from 'react';/);
  for (const imp of ["import DayCard from '@/components/workbench/operations/day/DayCard';", "import LedgerSection from '@/components/workbench/operations/ledger/LedgerSection';"]) assert.ok(time.includes(imp), imp);
  assert.match(time, /<ToolOpener tools=\{\[navToolByName\('Time', TOOL_GATE\)\]\} \/>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Time">\n\s*<Suspense>\n\s*<DayCard \/>\n\s*<\/Suspense>\n\s*<LedgerSection \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  const timeBox = time.slice(time.indexOf('data-tool-page="Time"'), time.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...timeBox.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['Suspense', 'DayCard', 'LedgerSection']);
  assert.equal((time.match(/<ToolOpener/g) ?? []).length, 1);
  // /tasks — the two lists, nothing else; no boundary (nothing reads the URL), no card, no ledger.
  assert.match(tasks, /^'use client';/);
  assert.match(tasks, /<ToolOpener tools=\{\[navToolByName\('Tasks', TOOL_GATE\)\]\} \/>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionD_ProjectBacklog \/>\n\s*<SectionE_Routines \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  const tasksBox = tasks.slice(tasks.indexOf('data-tool-page="Tasks"'), tasks.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...tasksBox.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['SectionD_ProjectBacklog', 'SectionE_Routines']);
  assert.doesNotMatch(tasks, /DayCard|LedgerSection|ContentPipeline|Suspense|useSearchParams/, 'nothing of Time on Tasks');
  assert.doesNotMatch(time, /SectionD_ProjectBacklog|SectionE_Routines/, 'nothing of Tasks on Time');
  assert.equal((tasks.match(/<ToolOpener/g) ?? []).length, 1);
  // The merged grid is Calendar's — neither page pulls it in (tool law 5); the card imports none.
  for (const f of [TIME_PAGE, TASKS_PAGE, CARD]) assert.doesNotMatch(code(f), /HubCalendar/, `${f} mounts no merged grid`);
  for (const f of [TIME_PAGE, TASKS_PAGE]) assert.match(comments(f), /TIME-01 \(Alex, 2026-10-19\)/);
});

test('T2 the path: DAY_CARD_PATH is /time, every derived URL follows, the move control reloads through the constant, no /tasks? literal left', () => {
  assert.equal(DAY_CARD_PATH, '/time');
  assert.deepEqual([...DAY_CARD_PARAMS], ['date', 'step']);
  assert.match(code(RULES), /export const DAY_CARD_PATH = '\/time';/);
  assert.match(comments(RULES), /TIME-01 \(Alex, 2026-10-19\): THE FIRST SECTION OF \/time/);
  // The card's own URLs — hrefFor on the constant; the controls push it; the deck replaces it (unchanged rules).
  const c = code(CARD);
  assert.match(c, /const hrefFor = \(day: string, step: number \| null\): string => `\$\{DAY_CARD_PATH\}\?date=\$\{day\}\$\{step === null \? '' : `&step=\$\{step\}`\}`;/);
  assert.equal((c.match(/go\(hrefFor\(/g) ?? []).length, 3);
  assert.match(c, /router\.replace\(hrefFor\(day, step\), \{ scroll: false \}\)/);
  assert.doesNotMatch(c, /['"`]\/tasks|['"`]\/time\?/, 'no URL of the card is typed outside DAY_CARD_PATH');
  // The hop keeps date and step exactly as given, on the constant.
  assert.equal(dayCardRedirectHref({ date: '2026-10-15', step: '2' }), '/time?date=2026-10-15&step=2');
  assert.equal(dayCardRedirectHref({}), '/time');
  const hop = code(DAY_PAGE);
  assert.match(hop, /redirect\(dayCardRedirectHref\(await searchParams\)\);/);
  assert.doesNotMatch(hop, /['"`]\/tasks|['"`]\/time/, 'the hop types no path — the constant is the path');
  assert.match(comments(DAY_PAGE), /TIME-01 \(Alex, 2026-10-19\): the card\s*\n\s*\* is the first section of \/time now/);
  // The move control: the reload through the constant; the literal is gone.
  const m = code(MOVE);
  assert.match(m, /import \{ DAY_CARD_PATH \} from '\.\.\/day\/dayCard';/);
  assert.match(m, /window\.location\.assign\(`\$\{DAY_CARD_PATH\}\?date=\$\{plan\.date\}`\);/);
  assert.doesNotMatch(m, /\/tasks/, 'no literal');
  assert.match(comments(MOVE), /TIME-01, 2026-10-19: \/time; no literal/);
  // Nothing under the product's components types a /tasks? URL — the constant is the one place.
  for (const f of [CARD, RULES, MOVE, 'src/components/workbench/operations/stops/JournalForm.tsx', 'src/components/workbench/operations/ledger/LedgerSection.tsx', 'src/components/workbench/operations/stays/StayBar.tsx', 'src/components/workbench/operations/stops/DayDeck.tsx']) {
    assert.doesNotMatch(code(f), /\/tasks\?|\/time\?/, `${f} types no card URL`);
  }
});

test('T3 the dated redirect: next.config.ts sends /tasks?date= and ?step= to /time with the same query; the law names it as a door and verifies it; a plain /tasks is the Tasks page', () => {
  const cfg = code(CONFIG);
  assert.match(cfg, /\{ source: '\/tasks', has: \[\{ type: 'query', key: 'date' \}\], destination: '\/time', permanent: false \},\n\s*\{ source: '\/tasks', has: \[\{ type: 'query', key: 'step' \}\], destination: '\/time', permanent: false \},/);
  assert.equal((cfg.match(/source: '\/tasks'/g) ?? []).length, 2, 'the two keys, and no rule for a plain /tasks');
  assert.doesNotMatch(cfg, /source: '\/tasks\/:path\*'|source: '\/tasks\/day'/, '/tasks/day keeps its own hop (the page); nothing else under /tasks is redirected');
  assert.match(comments(CONFIG), /TIME-01 \(Alex, 2026-10-19\): the day card moved from \/tasks to \/time/);
  // Named in the registry's redirect doors like /content's, verified against the config and the constant.
  const law = code(LAW);
  assert.match(law, /const QUERY_REDIRECTS: ReadonlyArray<\{ source: string; keys: readonly string\[\]; destination: string; constant: \{ file: string; name: string \}; since: string \}> = \[\n\s*\{ source: '\/tasks', keys: \['date', 'step'\], destination: '\/time', constant: \{ file: 'src\/components\/workbench\/operations\/day\/dayCard\.ts', name: 'DAY_CARD_PATH' \}, since: 'TIME-01 \(2026-10-19\): the day card moved from \/tasks to \/time' \},\n\];/);
  assert.match(law, /const rule = `\{ source: '\$\{q\.source\}', has: \[\{ type: 'query', key: '\$\{key\}' \}\], destination: '\$\{q\.destination\}', permanent: false \}`;\n\s*if \(!nextConfigText\.includes\(rule\)\) violations\.push\(/, 'the rule verified against the config text');
  assert.match(law, /if \(!codeOf\(q\.constant\.file\)\.includes\(`export const \$\{q\.constant\.name\} = '\$\{q\.destination\}';`\)\) violations\.push\(/, 'the destination verified against the constant');
  assert.match(law, /const targetDoor = findDoor\(q\.destination\);\n\s*if \(!targetDoor\) violations\.push\(/, 'the target must have a door');
  assert.match(law, /console\.log\(`\$\{`\$\{q\.source\}\?\$\{q\.keys\.join\('=\|'\)\}=`\.padEnd\(48\)\} \$\{'redirect'\.padEnd\(15\)\} → \$\{q\.destination\}/, 'listed with the doors');
  assert.match(comments(LAW), /TIME-01 \(Alex, 2026-10-19\): A DATED QUERY REDIRECT/);
  // The content redirects stand: /content and /operations/content hop to /time (TOOL-LAW-01).
  for (const f of ['src/app/content/page.tsx', 'src/app/operations/content/page.tsx']) assert.match(code(f), /redirect\('\/time'\)/);
});

test('T4 the laws: the two-lists law holds /tasks to the two lists and /time to the two mounts (TIME-02); PHASES_RENDERED_AT and THE SORT say /time draws nothing; the gate table untouched', () => {
  const law = code(LAW);
  assert.match(law, /const TWO_LISTS_PAGE = 'src\/app\/tasks\/page\.tsx';\n\s*const TIME_PAGE = 'src\/app\/time\/page\.tsx';/);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionD_ProjectBacklog \/>', '<SectionE_Routines \/>'\];/);
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionD_ProjectBacklog SectionE_Routines'/);
  assert.match(law, /if \(\/DayCard\|LedgerSection\/\.test\(page\)\) twoListsFail\(/, 'the two that went may not come back unnoticed');
  assert.match(law, /const TIME_MOUNTS = \['<DayCard \/>', '<LedgerSection \/>'\];/);
  assert.match(law, /timeMounts\.join\(' '\) !== 'DayCard LedgerSection'/);
  assert.match(law, /if \(!\/<Suspense>\\s\*<DayCard \\\/>\\s\*<\\\/Suspense>\/\.test\(timePage\)\) twoListsFail\(/, 'the card in its boundary');
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

test('T5 the registry: the Time row says the day card and the ledger (TIME-02: no pipeline in it); the Tasks row says projects and routines; the maps and redirects stand', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  const tasks = TOOL_REGISTRY.find((t) => t.name === 'Tasks')!;
  assert.equal(time.home, '/time'); assert.equal(time.status, 'PARTIAL');
  // LEDGER-02 (Alex, 2026-10-19): "the task ledger" where the why and the customer line said "the ledger of every stop" — the rest unchanged.
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): "the task ledger of every stop … by city, account and book" — "every stop" kept, the book added.
  assert.equal(time.why, 'the day, narrated: every stop in clock order with its budget, its vendor, what it cost and the verdict, the journal, the caption and script for the reel, and the task ledger of every stop by city, account and book; nothing yet adds up where the hours went');
  assert.match(time.citation, /discover: src\/components\/workbench\/operations\/day\/dayReads\.ts:8-13/);
  assert.match(time.citation, /decide: src\/app\/api\/operations\/journal\/route\.ts:51 \(PUT/);
  assert.match(time.citation, /commit: src\/app\/api\/operations\/stops\/route\.ts \(POST/);
  assert.match(time.citation, /record: src\/components\/workbench\/operations\/ledger\/LedgerSection\.tsx/);
  assert.equal(time.note, 'TIME-02 (2026-10-19): the content pipeline retired — its components and routes deleted; its five tables kept, untouched, until TABLES-01.');
  assert.equal(time.customer, 'You can see one day as a card — every stop with what it should cost and what it did, the journal, the caption and script for the day\'s reel — and the task ledger of every stop you logged by city, account and book; nothing yet adds up where your hours went.');
  assert.doesNotMatch(time.customer ?? '', /\b(discover|decide|commit|record)\b/, 'no beat word on a public line (the plan law)');
  assert.equal(tasks.home, '/tasks');
  assert.match(tasks.why ?? '', /^the work, planned: projects with costed tasks and routines with costed lines/);
  // TASKS-02 (2026-10-20): the two links are gone — the North Star's page deleted, the audit trail Compliance's.
  assert.deepEqual(tasks.links, []);
  assert.match(comments(REGISTRY), /TIME-01 \(Alex, 2026-10-19\): the day card and the city ledger moved to\s*\n\s*\/\/ \/time/);
  assert.match(comments(REGISTRY), /TIME-01 \(Alex, 2026-10-19\): THE DAY CARD IS TIME'S/);
  assert.equal(COCKPIT_PRIMARY_TOOL.content, 'Time');
  assert.equal(COCKPIT_PATH.content, '/content');
});
