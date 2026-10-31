/**
 * TAB13-03 (2026-09-29) — one section at a time on /budget.
 *
 * BUDGET-02 (Alex, 2026-10-20) — BUDGET IS ONE PAGE. Ruling A took the DAY and
 * WEEK views, the section chips, the account filter, the "what this view is
 * missing" notice and the day's plan with its vendor box off /budget. The
 * helpers those were drawn by (viewParams, anchorOf, choiceOf, hrefFor, stepHref,
 * sectionHref, accountHref, sectionFor, bookChipLabels, notPlacedIn,
 * missingMoney, unplacedEntityId, SECTION_REFUSAL) left src/lib/budget/
 * reportView.ts, and the 18 tests that pinned them and the screen that drew them
 * left this file with them — nothing they pinned exists to be pinned. MOVED, not
 * loosened: the vendor box's choices and its writes stay pinned word for word,
 * pointed at the file the box now lives in (VendorBox.tsx — DayPlanDrill.tsx less
 * the drill; the Tasks stop and expense forms mount it). NEW: the year, the
 * tables' labels and the drill's words, which the page is drawn by.
 *
 * This file is the budget report purity law's fifth root's test
 * (scripts/assert-tool-registry.ts). It imports nothing from @prisma/client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  actualDrillWords, agreement, budgetDrillWords, cellQuery, ledgerHref, reportQuery, shiftDay, stepYear, tableLabels,
  vendorChoices, yearHref, yearOf,
} from '../budget/reportView';

const HELPER = 'src/lib/budget/reportView.ts';
const SCREEN = 'src/components/budget/BudgetReport.tsx';
// BUDGET-02: the vendor box's file (was src/components/budget/DayPlanDrill.tsx).
const DRILL = 'src/components/budget/VendorBox.tsx';

// ── THE YEAR (ruling A) ──────────────────────────────────────────────────────

test('BUDGET-02 the year: ?year= as written, else the viewer\'s current year; ‹ › one year; the report\'s query is a YEAR view as of today', () => {
  assert.equal(yearOf(new URLSearchParams(''), '2026-10-20'), '2026', 'no year in the URL → the viewer\'s current year');
  assert.equal(yearOf(new URLSearchParams('year=2025'), '2026-10-20'), '2025');
  assert.equal(yearOf(new URLSearchParams('year=nope'), '2026-10-20'), 'nope', 'anything else passes to the route, which refuses it by name');
  assert.equal(yearHref('2025'), '/budget?year=2025', 'the page\'s one key');
  assert.equal(stepYear('2026', -1), '2025');
  assert.equal(stepYear('2026', 1), '2027');
  assert.equal(stepYear('0001', -1), null, 'no year 0');
  assert.equal(stepYear('9999', 1), null);
  assert.equal(stepYear('nope', 1), null, 'a year that is not four digits cannot be stepped');
  assert.equal(reportQuery('2026', '2026-10-20'), 'view=year&year=2026&asOf=2026-10-20');
  // shiftDay stays: Tasks imports it.
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
});

// ── THE TABLES (ruling B) ────────────────────────────────────────────────────

test('BUDGET-02 the tables\' labels: the book\'s label, and "<type> · <book name>" only when two books share a type — in the books\' order', () => {
  const one = [{ entityName: 'Temple Stuart', label: 'Business' }, { entityName: 'Alex', label: 'Personal' }, { entityName: 'Trading', label: 'Trading' }];
  assert.deepEqual(tableLabels(one), ['Business', 'Personal', 'Trading']);
  const two = [{ entityName: 'Side Shop', label: 'Business' }, { entityName: 'Temple Stuart', label: 'Business' }, { entityName: 'Alex', label: 'Personal' }, { entityName: 'Holdings', label: 'Holdings' }];
  assert.deepEqual(tableLabels(two), ['Business · Side Shop', 'Business · Temple Stuart', 'Personal', 'Holdings']);
});

// ── THE DRILL (rulings E, F, G) ──────────────────────────────────────────────

test('BUDGET-02 the drill\'s words: its query, which Budget figure it lists, and "open in Books"', () => {
  assert.equal(cellQuery('ent-b', '6300', { from: '2026-10-01', to: '2026-10-31' }, '2026-10-20'), 'book=ent-b&account=6300&from=2026-10-01&to=2026-10-31&asOf=2026-10-20');
  assert.equal(budgetDrillWords({ shown: 'toDate', from: '2026-10-01', through: '2026-10-20' }), 'the budget to date — plan lines dated 2026-10-01 to 2026-10-20');
  assert.equal(budgetDrillWords({ shown: 'full', from: '2026-11-01', through: '2026-11-30' }), 'the full planned budget — plan lines dated 2026-11-01 to 2026-11-30');
  assert.equal(actualDrillWords({ from: '2026-10-01', through: '2026-10-20' }), 'ledger lines dated 2026-10-01 to 2026-10-20, reversal pairs and year-end closing entries left out');
  assert.equal(actualDrillWords({ from: '2026-11-01', through: null }), 'nothing has posted yet — the range is in the future');
  assert.equal(ledgerHref('6300', 'ent-b', '2026-10-01', '2026-10-20'), '/ledger?account=6300&book=ent-b&from=2026-10-01&to=2026-10-20');
});

test('BUDGET-02 the panel\'s sum against the cell: "matches the cell", or the cell and the difference — blank is never subtracted as 0', () => {
  assert.deepEqual(agreement(12050, 12050), { matches: true, words: 'matches the cell' });
  assert.deepEqual(agreement(null, null), { matches: true, words: 'matches the cell' });
  assert.deepEqual(agreement(12050, 12000), { matches: false, words: 'the cell prints $120.00 — these lines differ from it by $0.50' });
  assert.deepEqual(agreement(-500, 500), { matches: false, words: 'the cell prints $5.00 — these lines differ from it by −$10.00' });
  assert.deepEqual(agreement(null, 500), { matches: false, words: 'no lines were found — the cell prints $5.00' });
  assert.deepEqual(agreement(500, null), { matches: false, words: 'the cell is blank — these lines sum to $5.00' });
});

test('BUDGET-02 PURITY — the helper imports types from the model, the one formatter and the ONE vendor name rule; it reads no clock, network or environment; this test imports no @prisma/client', () => {
  const src = code(HELPER);
  const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.deepEqual(imports, [
    "import type { ReportBook, ReportColumn, ShownBudget } from './report';",
    "import { formatCents } from './format';",
    "import { readVendorName, takenBy, vendorNameKey } from '@/lib/operations/planVendor';",
  ]);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bprocess\.env\b|localStorage|sessionStorage/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetReportView.test.ts'), /['"]@prisma\/client/);
  // The purity law's fifth root, with this file as its test.
  assert.match(code('scripts/assert-tool-registry.ts'), /\{ root: 'src\/lib\/budget\/reportView\.ts', name: 'the view helper', noun: 'view helper', test: 'src\/lib\/__tests__\/budgetReportView\.test\.ts' \},/);
  // The helpers of the screens that left are gone, not kept unused.
  for (const gone of ['viewParams', 'anchorOf', 'choiceOf', 'hrefFor', 'stepHref', 'sectionHref', 'accountHref', 'sectionFor', 'bookChipLabels', 'notPlacedIn', 'missingMoney', 'unplacedEntityId', 'SECTION_REFUSAL']) {
    assert.doesNotMatch(src, new RegExp(`\\b${gone}\\b`), `${gone} left with its screen`);
  }
});

// ── TAB13-04 T4 · THE VENDOR BOX'S CHOICES ───────────────────────────────────

const DIR = [
  { id: 'v-pho', vendor_name: 'Pho 24', entity_id: 'ent-p' },
  { id: 'v-pho-b', vendor_name: 'Pho 24', entity_id: 'ent-b' },
  { id: 'v-banh', vendor_name: 'Banh Mi 25', entity_id: 'ent-p' },
  { id: 'v-phoenix', vendor_name: 'Phoenix Diner', entity_id: 'ent-p' },
];

test('TAB13-04 T4 the vendor choices: the line\'s book only, by the ONE name rule — an exact match offers no add, no match offers it, a blank offers nothing', () => {
  const exact = vendorChoices(' pho  24 ', DIR, 'ent-p');
  assert.deepEqual([exact.offered.map((v) => v.id), exact.exact?.id, exact.add, exact.refusal], [['v-pho'], 'v-pho', null, null], '" pho  24 " IS "Pho 24" — nothing to add');
  const partial = vendorChoices('pho', DIR, 'ent-p');
  assert.deepEqual([partial.offered.map((v) => v.id), partial.exact, partial.add], [['v-pho', 'v-phoenix'], null, 'pho'], 'the book\'s names that hold it, and the add');
  assert.deepEqual(vendorChoices('Pho 24', DIR, 'ent-b').offered.map((v) => v.id), ['v-pho-b'], 'another book\'s vendor is never offered');
  assert.deepEqual(vendorChoices('  Com   Tam ', DIR, 'ent-p'), { offered: [], exact: null, add: 'Com Tam', refusal: null }, 'the add names the name as the directory would keep it');
  for (const blank of ['', '   ', '\t']) assert.deepEqual(vendorChoices(blank, DIR, 'ent-p'), { offered: [], exact: null, add: null, refusal: null });
  const long = vendorChoices('x'.repeat(201), DIR, 'ent-p');
  assert.deepEqual([long.add, long.refusal], [null, 'a vendor name is at most 200 characters — this one is 201']);
  // Active only: the list the box is fed is the directory GET's, which reads active vendors only.
  assert.match(code('src/app/api/operations/vendor-directory/route.ts'), /where: \{ user_id: user\.id, is_active: true \},\s*orderBy: \{ vendor_name: 'asc' \},/);
  const helper = code(HELPER);
  assert.match(helper, /const key = vendorNameKey\(typed\);/);
  assert.match(helper, /const exact = takenBy\(typed, book\);/);
  assert.match(helper, /const name = readVendorName\(typed\);/);
});

// ── TAB13-04 T5 · THE VENDOR BOX'S WRITES ────────────────────────────────────

test('TAB13-04 T5 the three writes — POST and DELETE to plan-vendors, POST to the directory — and no other', () => {
  const d = code(DRILL);
  const s = code(SCREEN);
  assert.match(d, /await fetch\('\/api\/operations\/plan-vendors', \{\s*method: 'POST',/);
  assert.match(d, /await fetch\(`\/api\/operations\/plan-vendors\?\$\{query\.toString\(\)\}`, \{ method: 'DELETE', redirect: 'manual' \}\)/);
  assert.match(d, /await fetch\('\/api\/operations\/vendor-directory', \{\s*method: 'POST',/);
  assert.match(d, /await fetch\('\/api\/operations\/vendor-directory', \{ cache: 'no-store', redirect: 'manual' \}\)/, 'the directory read is a GET');
  assert.equal((d.match(/\bmethod: '/g) ?? []).length, 3, 'three writes, no fourth');
  assert.equal((d.match(/\bfetch\(/g) ?? []).length, 4, 'the three writes and the directory read');
  assert.equal((s.match(/\bfetch\(/g) ?? []).length, 1, 'the report screen fetches in one place (readBudget, two GET reads) and writes nothing');
  assert.match(d, /body: JSON\.stringify\(\{ kind: address\.kind, id: address\.id, instant, vendorId \}\)/);
  assert.match(d, /const query = new URLSearchParams\(\{ kind: address\.kind, id: address\.id \}\);\s*if \(address\.instant !== null\) query\.set\('instant', address\.instant\);/);
  assert.match(d, /body: JSON\.stringify\(\{ entityId, name \}\)/);
});

test('TAB13-04 T5 the vendor box: every time, this occurrence, none — the grain chosen by two buttons with nothing pre-selected, one for a task', () => {
  const d = code(DRILL);
  assert.match(d, /data-vendor="every">\{line\.vendor\.name\} · every time<\/span>\s*<ClearVendor address=\{everyAddress\} reload=\{reload\} \/>/);
  assert.match(d, /const everyAddress: PlanAddressText = \{ \.\.\.line\.address, instant: null \};/, 'Clear of an every-time vendor clears exactly that address');
  assert.match(d, /data-vendor="occurrence">\{line\.vendor\.name\}<\/span>\s*<button type="button" className=\{toggleChip\(false\)\} onClick=\{\(\) => setPicking\(true\)\}>Change<\/button>\s*<ClearVendor address=\{line\.address\} reload=\{reload\} \/>/);
  assert.match(d, /\{line\.vendor === null && <button type="button" className=\{toggleChip\(false\)\} onClick=\{\(\) => setPicking\(true\)\}>\+ vendor<\/button>\}/);
  assert.match(d, /\{task \? \(\s*<button type="button" className=\{toggleChip\(false\)\} disabled=\{busy\} onClick=\{\(\) => write\(null\)\}>Set<\/button>\s*\) : \(\s*<>\s*<button type="button" className=\{toggleChip\(false\)\} disabled=\{busy\} onClick=\{\(\) => write\(line\.address\.instant\)\}>This day<\/button>\s*<button type="button" className=\{toggleChip\(false\)\} disabled=\{busy\} onClick=\{\(\) => write\(null\)\}>Every time<\/button>/);
  assert.doesNotMatch(d, /\[grain, setGrain\]|useState<'day' \| 'every'/, 'no grain is held — nothing is pre-selected');
  assert.match(d, /const choices = directory\.vendors === null \? null : vendorChoices\(typed, directory\.vendors, line\.entityId\);/, 'the line\'s book, by the one rule');
  assert.match(d, /\+ add \{choices\.add\} to \{bookName\}/);
  // The directory's 409 carries the vendor it matched: used, and said.
  assert.match(d, /!answer\.ok && answer\.status === 409 && answer\.body !== null && typeof answer\.body\.vendor === 'object'/);
  assert.match(d, /setChosen\(\{ id: matched\.id, vendor_name: matched\.vendor_name, entity_id: line\.entityId \}\);/);
  assert.match(d, /is already a vendor of \$\{bookName\}\$\{matched\.is_active \? '' : ' \(archived\)'\} — using it\./);
});

test('TAB13-04 T5 refusals verbatim, a 401 as signed out, and the caller reads again after a write — never an optimistic copy', () => {
  // BUDGET-02 (2026-10-20): the box's caller reloads (was the /budget report); the box's own lines are unchanged.
  const d = code(DRILL);
  assert.match(d, /if \(res\.type === 'opaqueredirect' \|\| res\.status === 401\) return \{ ok: false, status: res\.status, words: SIGNED_OUT, body: null \};/);
  assert.match(d, /const words = typeof body\.message === 'string' \? body\.message : typeof body\.error === 'string' \? body\.error : `the route answered \$\{res\.status\}`;/, 'the route\'s own words');
  assert.equal((d.match(/data-vendor-refused>\{words\}<\/span>/g) ?? []).length, 2, 'shown where the line is, and beside a Clear');
  assert.match(d, /if \(answer\.ok\) \{ reset\(\); reload\(\); \} else setWords\(answer\.words\);/);
  assert.match(d, /if \(answer\.ok\) reload\(\);\s*else setWords\(answer\.words\);/);
  assert.doesNotMatch(d, /setLoad|plans\.lines|\.vendor = /, 'the box never edits the data it was handed');
});

test('BUDGET-02 the vendor box is the box alone — the drill (DayPlanDrill, PlanRows) is deleted; its header says why it stays', () => {
  const d = code(DRILL);
  assert.doesNotMatch(d, /function PlanRows|export default function DayPlanDrill|data-day-plan\b/);
  assert.match(d, /\nexport function VendorBox\(\{ line, bookName, directory, reload \}: \{/);
  assert.match(d, /\nexport function useDirectory\(\): /);
  assert.match(comments(DRILL), /BUDGET-02 \(2026-10-20\): this file was DayPlanDrill\.tsx/);
  assert.match(comments(DRILL), /A plan line's vendor \(and a new vendor\), through the two vendor routes —\s+\*\s+never a figure/);
  assert.doesNotMatch(code(SCREEN), /VendorBox|DayPlanDrill|ClearVendor|plan-vendors|vendor-directory/, '/budget mounts no vendor box');
});
