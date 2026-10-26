/**
 * EXPENSES-01 (Alex, 2026-10-25) — EXPENSES IS A LIVE TAB: ROUTINE EXPENSES MOVES THERE.
 *
 * /expenses is Expenses' one page — the same shell as /tasks — mounting exactly
 * ROUTINE EXPENSES (SectionF_RoutineExpenses, unchanged in place); /tasks is THE
 * WORK then PROJECTS, two sections, nothing else (rulings A, B). The registry row
 * is PARTIAL at /expenses with the beats the page earns — discover · commit ·
 * record — its `why` and `customer` lines true after this PR, its gate null
 * (ruling C). Calendar, Time, Budget and the day card read routines as before —
 * no route, no schema, no redirect (ruling D). The rail shows Expenses in its
 * registry position, MONEY OUT after Payroll, by derivation (ruling E). The
 * screens and the law are pinned to their source with comments stripped
 * (TEST-TRUTH-01); the model is driven through nav.ts and the registry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { TOOL_REGISTRY, registryLaw } from '../toolRegistry';
import { PHASES_RENDERED_AT, navFamilies, navRows, navToolByName, phasesRenderedOn } from '../nav';
import { TOOL_GATE } from '../offer';
import { PROBLEM_SHEET } from '../problemSheet';

const OPS = 'src/components/workbench/operations';
const EXPENSES_PAGE = 'src/app/expenses/page.tsx';
const TASKS_PAGE = 'src/app/tasks/page.tsx';
const SECTION_F = `${OPS}/SectionF_RoutineExpenses.tsx`;
const LAW = 'scripts/assert-tool-registry.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const NAV = 'src/lib/nav.ts';

const expenses = () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'Expenses');
  if (!t) throw new Error('Expenses is not in the registry');
  return t;
};
const mountsIn = (page: string, tool: string): string[] => {
  const box = page.slice(page.indexOf(`data-tool-page="${tool}"`), page.indexOf('</OperationsEntityProvider>'));
  return [...box.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]);
};

// ── RULING A · THE PAGE ───────────────────────────────────────────────────────

test('A /expenses is the same shell as /tasks and mounts exactly ROUTINE EXPENSES — opener, entity provider, one mount; no boundary, no task-change signal', () => {
  assert.ok(existsSync(resolve(process.cwd(), EXPENSES_PAGE)), 'the page exists');
  const page = code(EXPENSES_PAGE);
  assert.match(page, /^'use client';/);
  assert.match(page, /<AppLayout page>\n\s*<ToolOpener tools=\{\[navToolByName\('Expenses', TOOL_GATE\)\]\} \/>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Expenses">\n\s*<SectionF_RoutineExpenses \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>\n\s*<\/AppLayout>/);
  assert.deepEqual(mountsIn(page, 'Expenses'), ['SectionF_RoutineExpenses']);
  assert.equal((page.match(/<ToolOpener/g) ?? []).length, 1);
  assert.equal((page.match(/<SectionF_RoutineExpenses \/>/g) ?? []).length, 1, 'mounted once');
  // The shell /tasks has, minus what nothing here reads: no WorkChangesProvider (SectionF's tree never reads or bumps the
  // task-change signal), no Suspense (it reads no URL), nothing of Tasks, Time or Calendar.
  assert.doesNotMatch(page, /WorkChangesProvider|useWorkChanges|<Suspense|useSearchParams/);
  assert.doesNotMatch(page, /SectionE_Work|SectionD_ProjectBacklog|DayCard|LedgerSection|HubCalendar|MorningJournalTable|EveningJournalTable/);
  assert.doesNotMatch(page, /data-pipe-section|data-pipe-label|PIPE_LABEL|PIPE_PHASES|<StageStrip|<ProofStrip/);
  assert.match(comments(EXPENSES_PAGE), /EXPENSES-01 \(Alex, 2026-10-25, ruling A\) — EXPENSES IS A LIVE TAB/);
  // The section stays in place, dated on its mount; nothing in its tree reads the task-change signal.
  const f = code(SECTION_F);
  assert.doesNotMatch(f, /useWorkChanges|WorkChangesProvider/);
  assert.match(f, /useOperationsEntity\(\)/);
  assert.match(comments(SECTION_F), /EXPENSES-01 \(Alex, 2026-10-25, ruling A\): THE MOUNT MOVED — this section is\s*\n\s*\* Expenses' page, \/expenses/);
  // What /tasks showed is what /expenses shows: the two reads beside each other, the shared table, the chip, "+ routine", the CSV.
  assert.match(f, /readJson\('\/api\/operations\/routines', 'routines'\),\n\s*readJson\(`\/api\/operations\/routines\/month\?as_of=\$\{localToday\(\)\}`/);
  assert.match(f, /<DataTable/);
  assert.match(f, /ADD_ROUTINE_WORDS/);
  assert.match(f, /statusChipWords\(/);
  assert.match(f, /routineExpensesCsvFileName/);
  // SectionF is mounted on Expenses' page and nowhere else among the pages.
  for (const other of ['src/app/tasks/page.tsx', 'src/app/time/page.tsx', 'src/app/calendar/page.tsx', 'src/app/budget/page.tsx', 'src/components/home/ModuleLauncher.tsx']) {
    assert.doesNotMatch(code(other), /SectionF_RoutineExpenses/, `${other} does not mount ROUTINE EXPENSES`);
  }
});

// ── RULING B · TASKS IS THE WORK AND PROJECTS ─────────────────────────────────

test('B /tasks mounts THE WORK then PROJECTS (in its boundary), in that order, and nothing else; the law holds both containers', () => {
  const page = code(TASKS_PAGE);
  assert.deepEqual(mountsIn(page, 'Tasks'), ['SectionE_Work', 'Suspense', 'SectionD_ProjectBacklog']);
  assert.match(page, /<WorkChangesProvider>\n\s*<OperationsEntityProvider>\n\s*<div className="space-y-3" data-tool-page="Tasks">\n\s*<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>\n\s*<\/WorkChangesProvider>/);
  assert.doesNotMatch(page, /SectionF_RoutineExpenses/, 'the import left with the mount');
  assert.match(comments(TASKS_PAGE), /EXPENSES-01 \(Alex, 2026-10-25, ruling B\) — TASKS IS THE WORK AND PROJECTS/);
  const law = code(LAW);
  assert.match(law, /const EXPENSES_PAGE = 'src\/app\/expenses\/page\.tsx';/);
  assert.match(law, /const TWO_LISTS_MOUNTS = \['<SectionE_Work \/>', '<SectionD_ProjectBacklog \/>'\];/);
  assert.match(law, /pageMounts\.join\(' '\) !== 'SectionE_Work SectionD_ProjectBacklog'/);
  assert.match(law, /if \(\/SectionF_RoutineExpenses\/\.test\(page\)\) twoListsFail\(/, 'the table that left may not come back unnoticed');
  assert.match(law, /const EXPENSES_MOUNTS = \['<SectionF_RoutineExpenses \/>'\];/);
  assert.match(law, /expensesMounts\.join\(' '\) !== 'SectionF_RoutineExpenses'/);
  assert.match(law, /navToolByName\\\('Expenses', TOOL_GATE\\\)/, 'the law holds the opener to Expenses\' own row');
  assert.match(law, /if \(\/WorkChangesProvider\|<Suspense\|SectionE_Work\|SectionD_ProjectBacklog\|DayCard\|LedgerSection\|HubCalendar\/\.test\(expensesPage\)\)/);
  assert.match(law, /PHASES_RENDERED_AT\['\/expenses'\] \?\? \['\?'\]\)\.length !== 0/);
  // The strip walk covers both trees.
  assert.match(law, /for \(const \[root, room\] of \[\[TWO_LISTS_PAGE, '\/tasks'\], \[EXPENSES_PAGE, '\/expenses'\]\] as const\)/);
  assert.match(comments(LAW), /EXPENSES-01 — the ruling \(Alex, 2026-10-25\): Expenses is a LIVE TAB/);
  // The controls list still holds ROUTINE EXPENSES' controls — moved, not loosened.
  for (const re of [/SectionF_RoutineExpenses\.tsx', \/ADD_ROUTINE_WORDS\//, /SectionF_RoutineExpenses\.tsx', \/statusChipWords\\\(\//, /SectionF_RoutineExpenses\.tsx', \/<DataTable\//]) {
    assert.match(law, re);
  }
});

// ── RULING C · THE REGISTRY ROW ──────────────────────────────────────────────

// EXPENSES-02 (Alex, 2026-10-26): the row moved on — LIVE, four beats, no why, the customer line without "not yet", the census 3 · 9 · 13,
// Expenses in the free set — pinned in expenses02.test.ts. What EXPENSES-01 settled and EXPENSES-02 kept is pinned here.
test('C Expenses is at /expenses with gate null, its home and links as EXPENSES-01 set them, its citation naming EXPENSES-01 first; the EXPENSES-01 census line stays in the record', () => {
  const t = expenses();
  assert.equal(t.home, '/expenses');
  assert.equal(t.cockpitKey, undefined);
  assert.deepEqual(t.links, []);
  assert.equal(TOOL_GATE.Expenses, null, 'the gate stays null');
  // Customer copy: no source path.
  assert.doesNotMatch(t.customer ?? '', /\.tsx?:|src\//);
  // The citation names this PR first and the lines each beat is read from.
  assert.match(t.citation, /^EXPENSES-01 \(2026-10-25\): src\/app\/expenses\/page\.tsx mounts ROUTINE EXPENSES alone · /);
  assert.match(t.citation, /discover: src\/components\/workbench\/operations\/SectionF_RoutineExpenses\.tsx:\d+ \(GET \/api\/operations\/routines\) · :\d+ \(GET \/api\/operations\/routines\/month\?as_of=\) · commit: routines\/RoutineCreateForm\.tsx:\d+ → src\/app\/api\/operations\/routines\/route\.ts:\d+ \(POST\)/);
  assert.match(t.citation, /record: src\/app\/api\/operations\/routines\/month\/route\.ts:\d+-\d+ → src\/lib\/operations\/routineMonth\.ts \(actual_cents, match_cents\)/);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.match(comments(REGISTRY), /EXPENSES-01 census \(Alex, 2026-10-25\): Expenses is PARTIAL/);
  // The declaration: /expenses draws no strip.
  assert.deepEqual(PHASES_RENDERED_AT['/expenses'], []);
  assert.deepEqual(phasesRenderedOn('/expenses', navToolByName('Expenses', TOOL_GATE)), []);
  assert.match(comments(NAV), /EXPENSES-01 \(Alex, 2026-10-25\): \/expenses draws NO strip/);
  // No PUBLIC_PATHS change: a guest on /expenses is refused as on /tasks.
  assert.doesNotMatch(code('src/middleware.ts'), /'\/expenses'/);
});

// ── RULING D · NOTHING ELSE MOVED ────────────────────────────────────────────

test('D Calendar, Time, Budget and the day card read routines as before — none names the new page or the section; no redirect, no route, no schema', () => {
  const untouched: Array<[string, RegExp]> = [
    ['src/app/calendar/page.tsx', /<HubCalendar \/>/],
    ['src/components/hub/HubCalendar.tsx', /fetch\(`\/api\/hub\/operations-routines\?from=\$\{from\}&to=\$\{to\}`\)/],
    ['src/app/time/page.tsx', /<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>/],
    ['src/app/budget/page.tsx', /BudgetReport/],
    ['src/components/budget/BudgetReport.tsx', /`\/api\/budget\/report\?\$\{query\}`/],
    ['src/components/workbench/operations/day/DayCard.tsx', /./],
    ['src/components/workbench/operations/day/dayReads.ts', /`\/api\/budget\/report\?\$\{query\.toString\(\)\}`/],
    ['src/lib/hub/mapOperationsRoutines.ts', /'\/calendar'/],
  ];
  for (const [f, read] of untouched) {
    const body = code(f);
    assert.match(body, read, `${f} still reads what it read`);
    assert.doesNotMatch(body, /\/expenses|SectionF_RoutineExpenses|EXPENSES-01/, `${f} is untouched by the move`);
  }
  assert.doesNotMatch(code('next.config.ts'), /expenses/i, 'no redirect added');
  assert.ok(!existsSync(resolve(process.cwd(), 'src/app/api/expenses')), 'no route added');
  assert.doesNotMatch(code('prisma/schema.prisma'), /EXPENSES-01/, 'no migration');
});

// ── RULING E · THE RAIL, BY DERIVATION ───────────────────────────────────────

test('E the rail lists Expenses in MONEY OUT after Payroll, with its home /expenses, by derivation — no rail code', () => {
  const sheet = PROBLEM_SHEET.find((f) => f.header === 'MONEY OUT');
  assert.deepEqual(sheet?.tools, ['Bill Pay', 'Payroll', 'Expenses', 'Travel', 'Mileage', 'Budget']);
  const family = navFamilies(TOOL_GATE).find((f) => f.name === 'MONEY OUT');
  assert.ok(family);
  assert.deepEqual(family.tools.map((t) => t.name), ['Bill Pay', 'Payroll', 'Expenses', 'Travel', 'Mileage', 'Budget']);
  const row = family.tools[2];
  assert.equal(row.name, 'Expenses');
  assert.equal(row.href, '/expenses');
  assert.deepEqual(row.door, { kind: 'route', href: '/expenses' });
  assert.equal(row.status, 'LIVE'); // EXPENSES-02 (2026-10-26): LIVE
  assert.equal(row.gate, null);
  assert.equal(row.line, null, 'EXPENSES-02: a LIVE row carries no why, so the opener prints no line — as Travel and Bookkeeping');
  assert.deepEqual(row.subRows, []);
  assert.equal(row.n, expenses().order);
  assert.equal(navRows(TOOL_GATE).filter((t) => t.href === '/expenses').length, 1, 'one door');
  assert.equal(navToolByName('Expenses', TOOL_GATE).href, '/expenses');
  // Payroll before it is still a row with no link; nothing in the rail is typed.
  assert.equal(family.tools[1].name, 'Payroll');
  assert.equal(family.tools[1].href, null);
  for (const f of ['src/components/shell/Rail.tsx', 'src/components/shell/TheSheet.tsx']) {
    assert.doesNotMatch(code(f), /Expenses|\/expenses/, `${f} types nothing of it`);
  }
});
