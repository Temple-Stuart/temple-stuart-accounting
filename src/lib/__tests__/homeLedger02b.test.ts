/**
 * HOME-LEDGER-02b (Alex, 2026-11-07) — the cockpit's second month table retires: HubBudgetSection, BudgetComparison,
 * RunwayDataProvider, BudgetDrillDown, the panel's Month/Year toggle and the five hub budget routes go (rulings B, C);
 * runway 05 "Project" stays in THE SORT and in the cockpit's strip as a LINK cell to /budget (rulings A, E); the lines
 * law is re-aimed at the two Budget routes (ruling D). One month table, one budget model. Every pin here finds its line
 * by content — no test pins a line number in a file this PR does not own (ruling F).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments, functionBody } from '../sourceText';
import { PIPE_PHASES } from '../pipePhases';
import { THE_SORT } from '../nav';

const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const PANEL = 'src/components/hub/RunwayBudgetPanel.tsx';
const PHASES = 'src/lib/pipePhases.ts';
const NAV = 'src/lib/nav.ts';
const LAWS = 'scripts/assert-tool-registry.ts';
const SEEDS = 'scripts/proofs/lines.seeds.ts';
const BUDGET = 'src/lib/operations/routineBudget.ts';
const REPORT = 'src/app/api/budget/report/route.ts';
const CELL = 'src/app/api/budget/report/cell/route.ts';
const THIS = 'src/lib/__tests__/homeLedger02b.test.ts';

const RETIRED = [
  'src/components/hub/HubBudgetSection.tsx',
  'src/components/hub/BudgetComparison.tsx',
  'src/components/hub/RunwayDataProvider.tsx',
  'src/components/hub/BudgetDrillDown.tsx',
  'src/app/api/hub/year-calendar/route.ts',
  'src/app/api/hub/nomad-budget/route.ts',
  'src/app/api/hub/business-budget/route.ts',
  'src/app/api/hub/drill-down/route.ts',
  'src/app/api/hub/trips/route.ts',
];

const at = (rel: string) => resolve(process.cwd(), rel);
const tsFilesUnder = (dir: string): string[] =>
  readdirSync(at(dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? tsFilesUnder(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));

/** The runway panel's slice of the launcher — from its data attribute to the guest branch. */
const runwayPanelOf = (launcher: string): string => {
  const from = launcher.indexOf('data-cockpit-panel="calendar"');
  const to = launcher.indexOf('{authed === false && (');
  assert.ok(from > -1 && to > from, 'the runway panel and the guest branch are where HOME-03 left them');
  return launcher.slice(from, to);
};

// ── A · THE 05 CELL IS A LINK ────────────────────────────────────────────────

test('A runway 05 keeps its place and gains a link: { target: budget, label: IN BUDGET → }, subLabel BUDGET VS ACTUAL re-derived from /budget\'s opener line', () => {
  const runway = PIPE_PHASES.runway;
  assert.equal(runway.length, 5, 'five phases, as before');
  assert.deepEqual(runway.map((p) => p.num), ['01', '02', '03', '04', '05']);
  const project = runway[4];
  assert.equal(project.name, 'Project');
  assert.equal(project.subLabel, 'BUDGET VS ACTUAL');
  assert.deepEqual(project.link, { target: 'budget', label: 'IN BUDGET →' });
  for (const p of runway.slice(0, 4)) assert.equal((p as { link?: unknown }).link, undefined, `${p.num} ${p.name} carries no link`);
  // The trade 06 idiom, byte for byte in shape.
  assert.deepEqual(PIPE_PHASES.trade[5].link, { target: 'books', label: 'IN BOOKS →' });
  assert.match(code(PHASES), /\{ num: '05', name: 'Project', subLabel: 'BUDGET VS ACTUAL', link: \{ target: 'budget', label: 'IN BUDGET →' \} \},/);
  // The subLabel is derived from /budget's own opener line, which still reads so.
  assert.match(code('src/app/budget/page.tsx'), /line="Budget vs actual by account, month by month — click a figure for the lines behind it\."/);
  assert.match(comments(PHASES), /Project ⇐ \/budget's own opener line "Budget vs actual by account, month by\s*\/\/\s*month — click a figure for the lines behind it\." \(src\/app\/budget\/page\.tsx:32\)/);
  assert.match(comments(PHASES), /HOME-LEDGER-02b \(Alex, 2026-11-07, ruling A\): 05 Project is a LINK cell to/);
  assert.equal(code('src/app/budget/page.tsx').split('\n')[31]?.includes('line="Budget vs actual by account, month by month'), true, 'page.tsx:32 is the opener line the comment cites');
});

test('A the cockpit draws 05 through StageStrip\'s link prop — num and label from PIPE_RW_PROJECT, the chip from its link.label, the click Next\'s router to /budget; no 05 phase, no project in the union, no cast', () => {
  const l = code(LAUNCHER);
  assert.match(l, /import \{ usePathname, useRouter, useSearchParams \} from 'next\/navigation';/, 'useRouter from next/navigation (the BudgetReport.tsx idiom)');
  assert.match(l, /const router = useRouter\(\);/);
  assert.match(l, /const \[PIPE_RW_SOURCE, PIPE_RW_HISTORY, PIPE_RW_BURN, PIPE_RW_MATCH, PIPE_RW_PROJECT\] = PIPE_PHASES\.runway;/, 'the destructure reads the tuple — 05\'s link is typed present');
  assert.doesNotMatch(l, /as readonly PipePhase\[\]/, 'the cast is gone');
  assert.doesNotMatch(l, /type PipePhase/, 'and the type import with it');
  assert.match(l, /const \[runwayPhase, setRunwayPhase\] = useState<'burn' \| 'match'>\('burn'\);/, 'the union holds the two phases with a surface here');
  const panel = runwayPanelOf(l);
  assert.match(panel, /link=\{\{ num: PIPE_RW_PROJECT\.num, label: PIPE_RW_PROJECT\.name, chip: PIPE_RW_PROJECT\.link\.label, onClick: \(\) => router\.push\('\/budget'\) \}\}/, 'the strip\'s link cell');
  assert.doesNotMatch(panel, /key: 'project'/, 'no 05 phase in the phases array');
  assert.doesNotMatch(panel, /'project'/, 'no project anywhere in the panel');
  assert.match(panel, /if \(k === 'burn' \|\| k === 'match'\) setRunwayPhase\(k\);/, 'the handler\'s union');
  assert.doesNotMatch(panel, /PIPE_RW_PROJECT\.num\} \/ \$\{PIPE_RW_PROJECT\.name\}/, 'no 05 SectionHeader');
  assert.doesNotMatch(panel, /\?\?\s*'|\|\|\s*'/, 'no default chip, no fallback');
  assert.doesNotMatch(panel, /window\.location/, 'the panel navigates through the router alone');
  // The four strip cells that remain, in order, then the link.
  const keys = [...panel.matchAll(/\{ key: '(\w+)', num: PIPE_RW_(\w+)\.num/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(keys, ['source:SOURCE', 'history:HISTORY', 'burn:BURN', 'match:MATCH']);
  assert.ok(panel.indexOf('link={{ num: PIPE_RW_PROJECT.num') > panel.indexOf("{ key: 'match'"), 'the link cell is the strip\'s terminal cell');
  // 01/02/03 keep reading runwayTotals — no figure invented for the strip's states.
  assert.match(panel, /state: \(runwayTotals\?\.accountsLinked \?\? 0\) > 0 \? 'done' : 'pending' \}/);
  assert.match(panel, /state: runwayTotals\?\.sufficientHistory \? 'done' : 'pending' \}/);
  assert.match(panel, /state: runwayPhase === 'burn' \? 'active' : runwayTotals\?\.burnComputed \? 'done' : 'pending' \}/);
  // StageStrip's link prop is the trade idiom's — unchanged.
  assert.match(code('src/components/ui/StageStrip.tsx'), /link\?: \{ num: string; label: string; chip: string; onClick: \(\) => void \};/);
  assert.match(l, /link=\{\{ num: PIPE_COMMIT\.num, label: PIPE_COMMIT\.name, chip: PIPE_COMMIT\.link\.label, onClick: \(\) => selectTab\('books'\) \}\}/, 'the trade 06 idiom stands beside it');
});

// ── B · THE PANEL KEEPS THE BURN, LOSES THE PROJECT ─────────────────────────

test('B the launcher mounts the panel alone — no RunwayDataProvider, no show prop; the burn wrapper is the burn\'s; the match review, the merged grid and the receipts rail as before', () => {
  const panel = runwayPanelOf(code(LAUNCHER));
  assert.match(panel, /<RunwayBudgetPanel onTotals=\{setRunwayTotals\} \/>/);
  assert.doesNotMatch(panel, /RunwayDataProvider|show=\{/, 'no provider, no show');
  assert.doesNotMatch(code(LAUNCHER), /from '@\/components\/hub\/RunwayDataProvider'/, 'the import is gone');
  // (code() strips the RUNWAY-UX-1 note between the two and leaves its braces.)
  assert.match(panel, /<div className=\{runwayPhase === 'burn' \? 'block' : 'hidden'\}>[\s{}]*<RunwayBudgetPanel onTotals=\{setRunwayTotals\} \/>[\s{}]*<\/div>/, 'the wrapper that held burn and project is the burn\'s');
  assert.doesNotMatch(panel, /runwayPhase === 'burn' \|\| runwayPhase === 'project'/);
  const order = ['<StageStrip', "<SectionHeader kicker={`${PIPE_RW_BURN.num} / ${PIPE_RW_BURN.name}`}", '<RunwayBudgetPanel onTotals={setRunwayTotals} />', "<SectionHeader kicker={`${PIPE_RW_MATCH.num} / ${PIPE_RW_MATCH.name}`}", '<MatchReviewSection onTotals={setMatchTotals} />', '<HubCalendar />', '<ProofStrip'];
  let last = -1;
  for (const m of order) { const next = panel.indexOf(m, last + 1); assert.ok(next > last, `${m} in order`); last = next; }
  assert.equal((panel.match(/<SectionHeader /g) ?? []).length, 2, 'two headers: 03 Burn and 04 Match');
});

test('B the panel has no view state, no toggle, no HubBudgetSection or BudgetComparison import, no show prop; preview and onTotals stay; deriveRunwayReceipts is byte-unchanged', () => {
  const p = code(PANEL);
  assert.doesNotMatch(p, /useState<'month' \| 'year'>|setView|view === 'month'/, 'no view state');
  assert.doesNotMatch(p, /SEGMENT|Runway Budget|Month-by-month budget vs actual|Full-year travel-vs-home comparison/, 'no toggle, no project header');
  assert.doesNotMatch(p, /HubBudgetSection|BudgetComparison|RunwayDataProvider|BudgetDrillDown/, 'no retired component');
  assert.doesNotMatch(p, /\bshow\b/, 'no show prop');
  assert.match(p, /export default function RunwayBudgetPanel\(\{\n  preview = false,\n  onTotals,\n\}: \{\n  preview\?: boolean;\n  onTotals\?: \(t: RunwayReceipts\) => void;\n\} = \{\}\) \{/, 'the signature: preview and onTotals');
  assert.match(p, /if \(preview\) \{ setRunway\(previewRunway\(\)\); return; \}/, 'the guest\'s shell, no authed call');
  assert.match(p, /onTotals\?\.\(deriveRunwayReceipts\(d\)\);/, 'the report-up at the one fetch');
  assert.match(p, /<RunwayHeroStrip runway=\{runway\} runwayError=\{runwayError\} \/>/, 'the hero leads, unguarded');
  assert.doesNotMatch(p, /'block' : 'hidden'/, 'nothing in the panel is hidden by a phase');
  assert.match(p, /import \{ useEffect, useState \} from 'react';/);
  assert.equal(
    functionBody(p, 'deriveRunwayReceipts'),
    [
      'export function deriveRunwayReceipts(d: RunwayData): RunwayReceipts {',
      '  const w = d.windows[0];',
      '  const { burnLine, runwayLine } = windowStrings(w);',
      "  const isData = w.state === 'ok' || w.state === 'cashflow_positive';",
      '  return {',
      '    cash: d.cash.available ? usd(d.cash.dollars) : null,',
      "    burnLine: burnLine === '—' ? null : burnLine,",
      '    runwayValue: isData ? runwayLine : null,',
      '    runwayEmpty: runwayLine,',
      '    accountsLinked: d.cash.accountsLinked,',
      '    sufficientHistory: w.sufficientHistory,',
      "    burnComputed: w.state !== 'insufficient_history',",
      '  };',
      '}',
    ].join('\n'),
    'deriveRunwayReceipts, byte for byte',
  );
  assert.match(p, /export interface RunwayReceipts \{\n\s*cash: string \| null;\n\s*burnLine: string \| null;\n\s*runwayValue: string \| null;\n\s*runwayEmpty: string;\n\s*accountsLinked: number;\n\s*sufficientHistory: boolean;\n\s*burnComputed: boolean;\n\}/, 'RunwayReceipts, unchanged');
  assert.match(comments(PANEL), /HOME-LEDGER-02b \(Alex, 2026-11-07, ruling B\)/);
});

// ── C · THE DELETIONS ────────────────────────────────────────────────────────

test('C the nine files are gone, nothing under src or scripts imports or fetches them, and api/hub holds operations-routines alone', () => {
  for (const f of RETIRED) assert.ok(!existsSync(at(f)), `${f} is deleted`);
  assert.deepEqual(readdirSync(at('src/app/api/hub')), ['operations-routines']);
  const files = [...tsFilesUnder('src'), ...tsFilesUnder('scripts')].filter((f) => f !== THIS);
  for (const f of files) {
    const body = code(f);
    assert.doesNotMatch(body, /from '(@\/components\/hub\/|\.\/)(HubBudgetSection|BudgetComparison|RunwayDataProvider|BudgetDrillDown)'/, `${f} imports a retired component`);
    assert.doesNotMatch(body, /\/api\/hub\/(year-calendar|nomad-budget|business-budget|drill-down|trips)\b/, `${f} fetches a retired route`);
    assert.doesNotMatch(body, /\broutinesMonthlyByCoa\(|\broutineMonthlyByCoa\(/, `${f} calls a retired month table`);
  }
});

test('C routineBudget.ts keeps RoutineBudgetInput alone — no function, no expansion, no leaf read; the loader still extends it', () => {
  const b = code(BUDGET);
  assert.match(b, /^import type \{ RoutineLineInput \} from '\.\/routineLines';\n/, 'one type import');
  assert.match(b, /export interface RoutineBudgetInput \{/);
  assert.doesNotMatch(b, /export function|function monthBounds|expandBetween|scheduleAnchor|routinePlanned\(/, 'no code beyond the interface');
  for (const field of ['budget_amount: number | string | null;', 'coa_code: string | null;', 'schedule_rrule: string;', 'timezone: string;', 'start_date?: Date | string | null;', 'steps?: readonly RoutineLineInput[] | null;', 'end_date?: Date | string | null;']) {
    assert.ok(b.includes(field), `the interface keeps ${field}`);
  }
  assert.match(comments(BUDGET), /HOME-LEDGER-02b \(Alex, 2026-11-07, ruling C\): the two month tables this file computed — routineMonthlyByCoa and\s*\*\s*routinesMonthlyByCoa/);
  const loader = code('src/lib/operations/routineBudgetInputs.ts');
  assert.match(loader, /import type \{ RoutineBudgetInput \} from '\.\/routineBudget';/);
  assert.match(loader, /export interface LoadedRoutineBudgetInput extends RoutineBudgetInput \{/);
});

test('C no 9950 default in the budget\'s routes — nomad-budget\'s || \'9950\' died with its file', () => {
  // The hub and the budget routes: no 9950 at all. (trips/[id]/vendor-commit/route.ts carries a pre-existing `|| '9950'` of the
  // travel lane — reported with this PR, not this PR's to change.)
  for (const f of [...tsFilesUnder('src/app/api/hub'), ...tsFilesUnder('src/app/api/budget'), ...tsFilesUnder('src/app/api/home-ledger'), ...tsFilesUnder('src/app/api/home-travel-plan')]) {
    assert.doesNotMatch(code(f), /9950/, `${f} carries a 9950`);
  }
  const defaults = tsFilesUnder('src/app/api').filter((f) => /(\|\||\?\?)\s*'9950'/.test(code(f)));
  assert.deepEqual(defaults, ['src/app/api/trips/[id]/vendor-commit/route.ts'], 'the one 9950 default left under src/app/api is the travel lane\'s, reported');
});

// ── D · THE LINES LAW RE-AIMED ───────────────────────────────────────────────

test('D the lines law names the two Budget routes as the bridges, holds each to the loader with no query and no filter of its own, and scans nothing by loader call', () => {
  const law = code(LAWS);
  assert.match(law, /const LINES_BRIDGES = \['src\/app\/api\/budget\/report\/route\.ts', 'src\/app\/api\/budget\/report\/cell\/route\.ts'\];/);
  const clause = law.slice(law.indexOf('for (const rel of LINES_BRIDGES) {'), law.indexOf('// 2. No reader adds routine-level and line-level amounts'));
  assert.match(clause, /if \(!\/\\bloadRoutineBudgetInputs\\\(\/\.test\(body\)\) linesFail\(`\$\{rel\} does not read routines through loadRoutineBudgetInputs\(\)/);
  assert.match(clause, /if \(\/operations_routines\\\.findMany\\\(\/\.test\(body\)\) linesFail\(`\$\{rel\} reads routines with a query of its own beside the loader/);
  assert.match(clause, /if \(\/budget_amount:\\s\*\\\{\\s\*not:\\s\*null\\s\*\\\}\/\.test\(body\)\) linesFail\(`\$\{rel\} filters routines on the routine-level budget_amount/);
  assert.doesNotMatch(law, /linesApiBridges|routinesMonthlyByCoa\\\(/, 'the scan by routinesMonthlyByCoa( is retired');
  assert.match(law, /\$\{LINES_BRIDGES\.length\} budget routes read routines through the one loader;/, 'the pass line counts the named bridges');
  assert.match(comments(LAWS), /HOME-LEDGER-02b \(Alex, 2026-11-07, ruling D\): the bridges are the two Budget routes/);
  // READS-01b (Alex, 2026-11-07): the prose names the ledger's answer function now — the route's body moved there; the reason the bridges are named is unchanged.
  assert.match(comments(LAWS), /The bridges are NAMED here, never found by scanning src\/app\/api for a loader\s*\/\/\s*call: the task ledger's answer function, src\/lib\/operations\/ledgerAnswer\.ts \(READS-01b,\s*\/\/\s*2026-11-07 — operations\/ledger\/route\.ts until then\), calls the loader AND keeps a routine\s*\/\/\s*query of its own/);
  // Clauses 0 and 1 stand; routineBudget.ts left LINES_READERS with its code and days.ts took its place.
  assert.match(law, /if \(!\/export function routinePlanned\\\(\/\.test\(linesLeaf\)\) linesFail/);
  assert.match(law, /for \(const f of LINES_READERS\) \{\n\s*const body = codeOf\(f\);\n\s*if \(!\/routinePlanned\\\(\/\.test\(body\)\) linesFail/);
  const readers = law.slice(law.indexOf('const LINES_READERS = ['), law.indexOf('];', law.indexOf('const LINES_READERS = [')));
  assert.match(readers, /'src\/lib\/budget\/days\.ts',/);
  assert.doesNotMatch(readers, /routineBudget\.ts/);
  assert.match(comments(LAWS), /HOME-LEDGER-02b \(Alex, 2026-11-07, ruling C\): routineBudget\.ts left this list with its code/);
  // And the one-off law's caller list.
  const callers = law.slice(law.indexOf('const ONEOFF_CALLERS = ['), law.indexOf('];', law.indexOf('const ONEOFF_CALLERS = [')));
  assert.doesNotMatch(callers, /routineBudget\.ts/);
  assert.match(callers, /'src\/lib\/budget\/days\.ts',/);
  // The two routes hold to the three clauses today — the law's own reading.
  for (const f of [REPORT, CELL]) {
    const body = code(f);
    assert.match(body, /\bloadRoutineBudgetInputs\(/, `${f} reads through the loader`);
    assert.doesNotMatch(body, /operations_routines\.findMany\(/, `${f} keeps no query of its own`);
    assert.doesNotMatch(body, /budget_amount:\s*\{\s*not:\s*null\s*\}/, `${f} hides no lined routine`);
  }
  // The ledger route is the reason the bridges are named: it calls the loader AND keeps a routine query of its own.
  // READS-01b (Alex, 2026-11-07): the route's body — the loader call and its own routine query — is src/lib/operations/ledgerAnswer.ts taskLedgerAnswerOf.
  const ledger = code('src/lib/operations/ledgerAnswer.ts');
  assert.match(ledger, /loadRoutineBudgetInputs\(/);
  assert.match(ledger, /db\.operations_routines\.findMany\(\{ where: \{ user_id: userId \}, select: \{ id: true, role: true \} \}\)/);
});

test('D the seeds: lines-a against the report route\'s loader call, lines-e against the cell route\'s; b, c, d on the loader as before; every anchor occurs exactly once', () => {
  const s = code(SEEDS);
  assert.match(s, /const REPORT = 'src\/app\/api\/budget\/report\/route\.ts';/);
  assert.match(s, /const CELL = 'src\/app\/api\/budget\/report\/cell\/route\.ts';/);
  assert.doesNotMatch(s, /hub\/year-calendar|hub\/business-budget|routinesMonthlyByCoa/);
  const names = [...s.matchAll(/name: '(lines-[a-e]) /g)].map((m) => m[1]);
  assert.deepEqual(names, ['lines-a', 'lines-b', 'lines-c', 'lines-d', 'lines-e']);
  const anchors: Array<[string, string]> = [
    [REPORT, '      Promise.all(entities.map(async (e) => ({ entityId: e.id, rows: await loadRoutineBudgetInputs(prisma, user.id, e.id) }))),'],
    [CELL, '      loadRoutineBudgetInputs(prisma, user.id, book.id),'],
    ['src/lib/operations/routineBudgetInputs.ts', '  start_date: true,'],
    ['src/lib/operations/routineBudgetInputs.ts', '    where: { user_id: userId, entity_id: entityId, ...(options.includeInactive === true ? {} : { is_active: true }) },'],
  ];
  for (const [f, find] of anchors) {
    assert.ok(s.includes(find.replace(/\\/g, '\\\\').replace(/'/g, "\\'")) || s.includes(find), `${f}: the seed names its anchor`);
    assert.equal(code(f).split(find).length - 1, 1, `${f}: the anchor occurs exactly once`);
  }
  assert.match(s, /expect: 'src\/app\/api\/budget\/report\/route\.ts does not read routines through loadRoutineBudgetInputs\(\)'/);
  assert.match(s, /expect: 'src\/app\/api\/budget\/report\/cell\/route\.ts reads routines with a query of its own beside the loader'/);
});

// ── E · NAV AND THE SORT ─────────────────────────────────────────────────────

test('E THE SORT: runway 05 stays Budget\'s, rendersSurface true, with the dated line above it; /budget draws no strip; the two state-only notes re-cite the launcher where the words stand', () => {
  const runway = THE_SORT.filter((a) => a.pipe === 'runway');
  assert.deepEqual(runway.map((a) => [a.num, a.owner, a.rendersSurface]), [['01', 'Banking', false], ['02', 'HOME', false], ['03', 'HOME', true], ['04', 'Bookkeeping', true], ['05', 'Budget', true]]);
  const navLines = code(NAV).split('\n');
  const navComments = comments(NAV).split('\n');
  const line05 = navLines.findIndex((l) => l.includes("{ pipe: 'runway', num: '05', owner: 'Budget', rendersSurface: true },"));
  assert.ok(line05 > -1);
  assert.match(navComments[line05 - 2] ?? '', /HOME-LEDGER-02b \(Alex, 2026-11-07, decision 8\): runway 05 keeps its place and its owner, and it renders a surface — the report/);
  assert.match(navComments[line05 - 1] ?? '', /the cockpit's runway strip draws 05 as a LINK cell to it \("IN BUDGET →", pipePhases\.ts\), not as a second month table\./);
  assert.match(code(NAV), /'\/budget': \[\],/);
  assert.match(comments(NAV), /Budget owns runway 05: \/budget draws no strip — the report is the surface; the cockpit's runway strip links to it \(HOME-LEDGER-02b\)/);
  assert.match(comments(NAV), /HOME-LEDGER-02b \(2026-11-07\): the note's marker eight lines further down and the handler six/);
  // The notes cite the launcher where the marker and the handler stand (nav.test.ts holds the marker; this holds the handler's union).
  const launcherLines = code(LAUNCHER).split('\n');
  for (const num of ['01', '02'] as const) {
    const a = runway.find((x) => x.num === num)!;
    const [from, to] = /ModuleLauncher\.tsx:(\d+)-(\d+)/.exec(a.surfaceNote ?? '')!.slice(1).map(Number);
    const marker = comments(LAUNCHER).split('\n').findIndex((x) => x.includes('STATE-ONLY cells')) + 1;
    assert.ok(marker >= from && marker <= to, `runway ${num}: the marker at :${marker} is cited as :${from}-${to}`);
    const [hFrom, hTo] = /the handler excludes its key at :(\d+)-(\d+)/.exec(a.surfaceNote ?? '')!.slice(1).map(Number);
    assert.match(launcherLines[hFrom - 1] ?? '', /onSelect=\{\(k\) => \{/);
    assert.ok(launcherLines.slice(hFrom - 1, hTo).some((x) => x.includes("if (k === 'burn' || k === 'match') setRunwayPhase(k);")));
  }
});

// ── G · THE OTHER LANE ───────────────────────────────────────────────────────

test('G the other lane is untouched: Landing, the walkthrough, the day card, the registry, the CRM test name nothing of this PR; the showcase comments re-cite', () => {
  for (const f of ['src/components/landing/Landing.tsx', 'src/lib/walkthroughLedger.ts', 'src/components/workbench/operations/day/dayCard.ts', 'src/lib/toolRegistry.ts', 'src/lib/__tests__/crm01.test.ts']) {
    assert.doesNotMatch(code(f) + comments(f), /HOME-LEDGER-02b/, `${f} is the other lane`);
  }
  // The walkthrough's runway step 5 still says the budget view in its own words — the hand-off is reported, not rewritten here.
  assert.match(code('src/lib/walkthroughLedger.ts'), /glimpse: "month-by-month budget vs actual",/);
  assert.match(comments('src/components/home/RunwayShowcaseSections.tsx'), /HOME-LEDGER-02b \(2026-11-07\): RunwayDataProvider — the cockpit's retired\s*\*\s*budget-tables context — is deleted/);
  assert.match(comments('src/components/home/RunwayShowcaseSections.tsx'), /src\/app\/api\/budget\/report\/route\.ts and\s*\*\s*src\/app\/api\/budget\/report\/cell\/route\.ts/);
  // SUPERSEDE-01b (Alex, 2026-11-08, ruling K): 01a's fold undone and the one expansion lifted out — the builder moved :302 → :374, re-cited in place.
  // SUPERSEDE-01c (Alex, 2026-11-08, ruling F): the header note, the role import and RoutinePlanInput.role moved it :374 → :391 — re-cited in place (pins moved).
  assert.match(comments('src/components/home/RoutinesShowcaseSections.tsx'), /buildRoutineBudgetLines \(src\/lib\/budget\/days\.ts:391 — SUPERSEDE-01c, 2026-11-08: was :374\), each\s*\*\s*occurrence costed by routinePlanned \(src\/lib\/operations\/routineLines\.ts\)/);
  assert.equal(code('src/lib/budget/days.ts').split('\n')[390]?.startsWith('export function buildRoutineBudgetLines('), true, 'days.ts:391 is the builder the comment cites');
});

// ── H · THIS TEST ────────────────────────────────────────────────────────────

test('H this test pins no line number of any file this PR does not own', () => {
  const self = code(THIS);
  // The two line pins it carries are the two it verifies by content above (page.tsx:32, days.ts:391 — SUPERSEDE-01c, 2026-11-08: was :374; SUPERSEDE-01b, 2026-11-08: was :302) — both re-cited comments.
  const pins = [...self.matchAll(/\[(\d+)\]\?\./g)].map((m) => Number(m[1]));
  assert.deepEqual(pins, [31, 390]);
});
