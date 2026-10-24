/**
 * time02.test.ts — TIME-02 (Alex, 2026-10-19): THE CONTENT PIPELINE IS RETIRED.
 *
 * "The day card replaced the pipeline: copy script replaced the script
 * generator, the card's clock order replaced the day calendar, stop records
 * replaced takes." Its components (src/components/workbench/operations/content/,
 * 25 files), its thirteen routes (src/app/api/operations/content/ — two of them
 * paid, with no tier gate and no caller left in the UI), the three showroom
 * files nothing imported, the one AI helper only enrich-routine called, and the
 * cockpit's hidden Content tab are deleted. /time is the day card then the city
 * ledger, nothing beneath. What stays, by name: the five tables, the daily-plan
 * and tasks/unscheduled routes, the cap helpers, the public decks (SHOW-01), the
 * /content redirects and the front door's map.
 *
 * These pin the absences and what stays. The pins TIME-01 left on the three
 * mounts moved to the two in their own files (time01, tasksOne01, ledger01,
 * toolLaw, toolRegistry, offer, routines01, tasks01, booksPipe), each dated.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code, comments } from '../sourceText';
import { PHASES_RENDERED_AT, THE_SORT, navToolByName, phasesRenderedOn } from '../nav';
import { PIPE_PHASES } from '../pipePhases';
import { TOOL_GATE, claimForCockpit } from '../offer';
import { COCKPIT_PATH, COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY } from '../toolRegistry';

const TIME_PAGE = 'src/app/time/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SHOWROOM_LAW = 'scripts/assert-showroom-fetch-free.ts';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const NAV = 'src/lib/nav.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const CONTENT_DIR = 'src/components/workbench/operations/content';
const ROUTE_DIR = 'src/app/api/operations/content';
const GONE = [
  'src/components/workbench/operations/showroom/OperationsPipelineShowroom.tsx',
  'src/components/home/ContentPreview.tsx',
  'src/components/home/OperationsShowroom.tsx',
  'src/lib/ai/enrichRoutineScenes.ts',
];
// LEDGER-02 (Alex, 2026-10-19): "the task ledger" where both lines said "the ledger of every stop" — the rest unchanged.
// LEDGER-02 AMENDMENT (Alex, 2026-10-19): "the task ledger of every stop … by city, account and book" — "every stop" kept, the book added.
// HOME-01 (Alex, 2026-10-24, ruling C): the Time row's words are the tables' — the card is shown on the dashboard.
const WHY = 'the task ledger and the two journals, day over day — every stop and every answer the day card records, as tables';
const CUSTOMER = 'You can see every stop you logged and every journal answer, day by day, filter and export them; the day itself is entered on the home dashboard.';
const NOTE = 'HOME-01 (2026-10-24): the day itself is entered on the day card — Time\'s component, shown on the home dashboard (the cockpit\'s Runway panel, /runway); /time is the tables. TIME-02 (2026-10-19): the content pipeline retired — its components and routes deleted; its five tables kept, untouched, until TABLES-01. Not done for a customer: nothing yet adds up where the hours went.';
const SURFACE_NOTE = 'TIME-02 (2026-10-19): drawn nowhere — /time renders no StageStrip (src/app/time/page.tsx); the day card is not a pipe; PIPES-01 retires the pipe';

const at = (f: string): string => join(process.cwd(), f);

/** Every .ts/.tsx file under a directory, as repo-relative paths. */
function tsFiles(dir: string): string[] {
  return readdirSync(at(dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(at(rel)).isDirectory()) return tsFiles(rel);
    return /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}

test('T1 the page: /time is the three tables (HOME-01: the card is on the dashboard), nothing else; the doc says why', () => {
  const page = code(TIME_PAGE);
  const box = page.slice(page.indexOf('data-tool-page="Time"'), page.indexOf('</OperationsEntityProvider>'));
  // JOURNAL-07 (Alex, 2026-10-24): the container is four — the two journal tables under the ledger (TIME-02's "nothing beneath" the ledger held until then).
  // HOME-01 (Alex, 2026-10-24): the card and its boundary moved to the dashboard — the container is the three tables.
  assert.deepEqual([...box.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['LedgerSection', 'MorningJournalTable', 'EveningJournalTable']);
  assert.match(page, /data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  assert.doesNotMatch(page, /DayCard|Suspense/);
  assert.match(comments(TIME_PAGE), /HOME-01 \(Alex, 2026-10-24\) — THE CARD MOVED TO THE DASHBOARD; \/time IS THE\s*\n\s*\* TABLES/);
  assert.doesNotMatch(page, /ContentPipeline|operations\/content\/|PIPE_PHASES|<StageStrip/);
  assert.equal((page.match(/<ToolOpener/g) ?? []).length, 1);
  assert.match(comments(TIME_PAGE), /TIME-02 \(Alex, 2026-10-19\) — THE CONTENT PIPELINE IS RETIRED/);
  assert.match(comments(TIME_PAGE), /five tables stay, untouched, until TABLES-01/);
});

test('T2 the absences: the directory, the routes, the showroom files and the AI helper are gone; nothing imports them, nothing calls the routes, nothing draws the pipe', () => {
  assert.ok(!existsSync(at(CONTENT_DIR)), `${CONTENT_DIR} is deleted`);
  assert.ok(!existsSync(at(ROUTE_DIR)), `${ROUTE_DIR} is deleted`);
  for (const f of GONE) assert.ok(!existsSync(at(f)), `${f} is deleted`);
  // No import of the directory anywhere under src or scripts (the tests pin absences by name; they import nothing of it either).
  const files = [...tsFiles('src'), ...tsFiles('scripts')];
  for (const f of files) assert.doesNotMatch(code(f), /from\s+['"][^'"]*workbench\/operations\/content\//, `${f} imports the content pipeline`);
  // No code outside the tests names a route of the pipeline or draws its pipe.
  const outsideTests = files.filter((f) => !f.startsWith('src/lib/__tests__/'));
  for (const f of outsideTests) {
    assert.doesNotMatch(code(f), /['"`]\/api\/operations\/content/, `${f} calls a content route`);
    assert.doesNotMatch(code(f), /PIPE_PHASES\.content\b/, `${f} draws the content pipe`);
  }
  // No component of the pipeline is named in code outside the tests and the law that refuses it on /time.
  const NAMES = /ContentPipeline|ScenifyDraft|ScenifyButton|ScenifyModal|ScriptGeneratorView|ScriptGenerator\b|ScriptDrawer|DayCalendarView|DailyLog|PieceGrid|useDayFeed|TaskBand|TaskTimeCommit|TakeifyButton|TakeRow|AvailableRoutinesList|QuestionLibrary|SceneHeaderRow|SectionG_Content|ContentTableSkeleton|ContentTable|ContentPreview|OperationsPipelineShowroom|OperationsShowroom|enrichRoutineScenes/;
  for (const f of outsideTests.filter((p) => p.startsWith('src/'))) assert.doesNotMatch(code(f), NAMES, `${f} names a component of the pipeline`);
});

test('T3 the laws: /time draws nothing; the content pipe stays defined, declared undrawn; the two-lists law holds the two; the showroom law lists none of it', () => {
  assert.deepEqual(PHASES_RENDERED_AT['/time'], []);
  assert.deepEqual(phasesRenderedOn('/time', navToolByName('Time', TOOL_GATE)), []);
  const content = THE_SORT.filter((a) => a.pipe === 'content');
  assert.deepEqual(content.map((a) => [a.num, a.owner, a.rendersSurface]), [['01', 'Time', false], ['02', 'Time', false], ['03', 'Time', false], ['04', 'Time', false]]);
  for (const a of content) assert.equal(a.surfaceNote, SURFACE_NOTE);
  assert.deepEqual(PIPE_PHASES.content.map((p) => p.num), ['01', '02', '03', '04'], 'the pipe stays DEFINED until PIPES-01');
  assert.match(comments(NAV), /TIME-02 \(2026-10-19\): the content pipeline is retired/);
  const law = code(LAW);
  // HOME-01 (Alex, 2026-10-24): three mounts; the card's boundary check reads the cockpit component.
  assert.match(law, /const TIME_MOUNTS = \['<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/);
  assert.match(law, /timeMounts\.join\(' '\) !== 'LedgerSection MorningJournalTable EveningJournalTable'/);
  assert.match(law, /if \(\/ContentPipeline\|operations\\\/content\\\/\/\.test\(timePage\)\) twoListsFail\(/, 'the pipeline may not come back unnoticed');
  assert.match(law, /if \(!\/<Suspense>\\s\*<DayCard \\\/>\\s\*<\\\/Suspense>\/\.test\(launcher\)\) twoListsFail\(/, 'the card in its boundary — on the Runway panel');
  assert.match(comments(LAW), /TIME-02 \(2026-10-19\): the third mount, the content pipeline, is retired/);
  assert.match(comments(LAW), /HISTORY: DayCalendarView/);
  assert.doesNotMatch(comments(LAW), /EXPLICIT NON-VIOLATION: DayCalendarView/);
  assert.doesNotMatch(code(SHOWROOM_LAW), /\/content\//, 'the fetch-free law lists no file of the pipeline');
  assert.match(comments(SHOWROOM_LAW), /deleted by TIME-02 \(2026-10-19\) with the content pipeline/);
});

test('T4 the registry: the Time row is a customer\'s line with no build note; the citation is the tables\' (HOME-01); the cockpit maps stand', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  assert.equal(time.slug, 'time'); assert.equal(time.status, 'PARTIAL'); assert.equal(time.home, '/time');
  assert.equal(time.why, WHY);
  assert.equal(time.customer, CUSTOMER);
  assert.equal(time.note, NOTE);
  for (const line of [time.why ?? '', time.customer ?? '']) {
    assert.doesNotMatch(line, /TIME-0\d|TABLES-01|PIPES-01|\.tsx?\b|src\/|pipeline/, 'no build note on a line that prints');
    assert.doesNotMatch(line, /\b(discover|decide|commit|record)\b/, 'no beat word on a public line (the plan law)');
  }
  // HOME-01 (Alex, 2026-10-24, ruling C): discover is the tables' reads; decide, commit and record keep the card's routes and the ledger.
  for (const beat of ['discover: src/components/workbench/operations/ledger/ledgerReads.ts:27', 'decide: src/app/api/operations/journal/route.ts:51 (PUT', 'commit: src/app/api/operations/stops/route.ts (POST', 'record: src/components/workbench/operations/ledger/LedgerSection.tsx']) {
    assert.ok(time.citation.includes(beat), `the citation keeps ${beat.split(':')[0]}`);
  }
  assert.doesNotMatch(time.citation, /operations\/content|daily-plan|unscheduled/, 'no pipeline route in the citation');
  assert.equal(claimForCockpit('content'), `partial — ${WHY}`);
  assert.equal(COCKPIT_PRIMARY_TOOL.content, 'Time');
  assert.equal(COCKPIT_PATH.content, '/content');
});

test('T5 the cockpit: the hidden Content tab is gone, and the facts that made it unreachable still hold', () => {
  const launcher = code(LAUNCHER);
  assert.doesNotMatch(launcher, /key: 'content'|content: 'content'|content: '\/content'|=== 'content'|ContentPipeline|Clapperboard|contentModule|pillarId="content"/);
  assert.match(comments(LAUNCHER), /RETIRED by TIME-02 \(Alex, 2026-10-19\)/);
  // The rail opens a cockpit section only through a tool's cockpitKey, and no tool carries 'content'.
  assert.ok(TOOL_REGISTRY.every((t) => t.cockpitKey !== 'content' && (t.links ?? []).every((l) => l.cockpitKey !== 'content')));
  // Old links keep landing on /time: the front door's map, the two redirect pages, the public path.
  assert.match(code('src/app/page.tsx'), /content: '\/content'/, 'the front door still sends /?tab=content to /content');
  for (const f of ['src/app/content/page.tsx', 'src/app/operations/content/page.tsx']) assert.match(code(f), /redirect\('\/time'\)/);
  assert.match(code('src/middleware.ts'), /'\/content',/, 'middleware untouched');
});

test('T6 what stays, by name: the five tables, the cap helpers, the daily-plan and unscheduled routes, the deletion count, the dead includes', () => {
  const schema = code('prisma/schema.prisma');
  for (const model of ['operations_content_scene_groups', 'operations_content_scenes', 'operations_content_pieces', 'operations_content_takes', 'operations_content_questions']) {
    assert.match(schema, new RegExp(`model ${model} \\{`), `${model} stays`);
  }
  assert.match(schema, /project\s+operations_projects\?\s+@relation\("ProjectContentPieces", fields: \[project_id\], references: \[id\], onDelete: SetNull\)/);
  for (const f of ['src/lib/ai/dailyCap.ts', 'src/lib/ai/caps.ts', 'src/lib/routineFireBudget.ts', 'src/app/api/operations/daily-plan/items/route.ts', 'src/app/api/operations/tasks/unscheduled/route.ts', 'src/lib/operations/projectDeletion.ts']) {
    assert.ok(existsSync(at(f)), `${f} stays`);
  }
  assert.match(comments('src/lib/ai/dailyCap.ts'), /TIME-02 \(2026-10-19\): those two routes are deleted with the content pipeline/);
  assert.match(code('src/lib/operations/projectDeletion.ts'), /operations_content_pieces\.count\(/, 'a project delete still counts and names its severed pieces');
  // The routines routes still include the scene rows nothing reads — listed for TABLES-01, not touched here.
  for (const f of ['src/app/api/operations/routines/route.ts', 'src/app/api/operations/routines/[id]/route.ts']) assert.match(code(f), /content_scene_group: true/);
});

test('T7 the one doc line: the card says its page is /runway, the dashboard (HOME-01)', () => {
  assert.match(comments(CARD), /on \/runway, the dashboard's Runway panel, where the card is first \(HOME-01, Alex, 2026-10-24: DAY_CARD_PATH is \/runway; TASKS-ONE-01 put it first on \/tasks; TIME-01, 2026-10-19: \/time\)/);
  assert.doesNotMatch(comments(CARD), /on \/tasks, where the card is the first section/);
});
