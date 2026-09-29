/**
 * TAB13-03 (2026-09-29) — one section at a time on /budget.
 *
 * T2 drives the URL-state helper (src/lib/budget/reportView.ts — the budget
 * report purity law's fifth root) over books the real model builds: the section
 * and the account read from the URL, every link keeping both, a book choice
 * clearing the account, and each choice the report cannot honour refused by name;
 * and the strip's counts. T3 reads the screen (a client component) from source,
 * comments stripped — the repo's TEST-TRUTH-01 way. This file imports nothing
 * from @prisma/client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { buildBudgetReport, type BudgetReport, type ReportEntity } from '../budget/report';
import { EXCLUDED_TASK_STATUSES, type NotPlaced } from '../budget/days';
import type { BudgetReportResponse } from '../budget/reportInputs';
import {
  SECTION_REFUSAL, accountHref, anchorOf, bookChipLabels, choiceOf, excludedTasksTotal, hrefFor, leftOutLines,
  notPlacedIn, sectionFor, sectionHref, stepHref, unplacedEntityId, viewParams,
} from '../budget/reportView';

const HELPER = 'src/lib/budget/reportView.ts';
const SCREEN = 'src/components/budget/BudgetReport.tsx';
const AS_OF = '2026-09-29';

const P: ReportEntity = { id: 'ent-p', name: 'Alex', entityType: 'personal' };
const B: ReportEntity = { id: 'ent-b', name: 'Temple Stuart', entityType: 'sole_prop' };
const B2: ReportEntity = { id: 'ent-b2', name: 'Side Shop', entityType: 'sole_prop' };
const T: ReportEntity = { id: 'ent-t', name: 'Trading', entityType: 'trading' };

/** A DAY report with a row in P and B, an unplaced line in B and an unplaced posting in P. */
function report(entities: ReportEntity[] = [P, B, T]): BudgetReport {
  return buildBudgetReport({
    asOf: AS_OF,
    view: { kind: 'day', day: AS_OF },
    entities,
    accounts: [
      { entityId: 'ent-p', code: '6100', name: 'Coffee', accountType: 'expense', balanceType: 'D' },
      { entityId: 'ent-b', code: '6200', name: 'Software', accountType: 'expense', balanceType: 'D' },
      { entityId: 'ent-b', code: '1010', name: 'Checking', accountType: 'asset', balanceType: 'D' },
    ],
    budgetLines: [
      { entityId: 'ent-p', code: '6100', day: AS_OF, cents: 500, source: 'routine', sourceId: 'r-coffee' },
      { entityId: 'ent-b', code: '6200', day: AS_OF, cents: 22000, source: 'routine', sourceId: 'r-software' },
      { entityId: 'ent-b', code: '1010', day: AS_OF, cents: 900, source: 'task', sourceId: 'task:t-asset' }, // an asset: unplaced
    ],
    postings: [
      { entityId: 'ent-p', code: '6100', day: AS_OF, entryType: 'D', cents: 450, journalEntryId: 'je-coffee' },
      { entityId: 'ent-p', code: '9999', day: AS_OF, entryType: 'D', cents: 300, journalEntryId: 'je-lost' }, // not in chart: unplaced
    ],
  });
}
const search = (q: string) => new URLSearchParams(q);

// ── T2 · THE URL STATE ───────────────────────────────────────────────────────

test('T2 the view is read as before; today is handed in, never read here', () => {
  assert.equal(viewParams(search(''), AS_OF).toString(), 'view=day&day=2026-09-29', 'no view → DAY of today');
  assert.equal(viewParams(search('view=week&weekOf=2026-09-22&book=ent-b&account=6200'), AS_OF).toString(), 'view=week&weekOf=2026-09-22', 'the fetch takes the view keys only — book and account never reach the route');
  assert.equal(anchorOf(search('view=year&year=2026'), AS_OF), AS_OF);
  assert.equal(anchorOf(search('view=year&year=2025'), AS_OF), '2025-01-01');
  assert.equal(anchorOf(search('view=day&day=bad'), AS_OF), null);
});

test('T2 the choice is read, and EVERY view link and step keeps the book and the account', () => {
  const choice = choiceOf(search('view=day&day=2026-09-29&book=ent-b&account=6200'));
  assert.deepEqual(choice, { book: 'ent-b', account: '6200' });
  assert.deepEqual(choiceOf(search('view=day')), { book: null, account: null });
  const keep = '&book=ent-b&account=6200';
  assert.equal(hrefFor('day', '2026-09-29', choice), `/budget?view=day&day=2026-09-29${keep}`);
  assert.equal(hrefFor('week', '2026-09-29', choice), `/budget?view=week&weekOf=2026-09-29${keep}`);
  assert.equal(hrefFor('year', '2026-09-29', choice), `/budget?view=year&year=2026${keep}`);
  assert.equal(stepHref(search('view=day&day=2026-09-29'), -1, choice), `/budget?view=day&day=2026-09-28${keep}`);
  assert.equal(stepHref(search('view=day&day=2026-09-29'), 1, choice), `/budget?view=day&day=2026-09-30${keep}`);
  assert.equal(stepHref(search('view=week&weekOf=2026-09-22'), 1, choice), `/budget?view=week&weekOf=2026-09-29${keep}`);
  assert.equal(stepHref(search('view=year&year=2026'), -1, choice), `/budget?view=year&year=2025${keep}`);
  assert.equal(stepHref(search('view=bad'), 1, choice), null);
  // With no choice, the links are the view's alone — as before.
  assert.equal(hrefFor('day', '2026-09-29', { book: null, account: null }), '/budget?view=day&day=2026-09-29');
});

test('T2 choosing a section keeps the view and CLEARS the account; choosing an account keeps the view and the book', () => {
  const s = search('view=week&weekOf=2026-09-22&book=ent-b&account=6200');
  assert.equal(sectionHref(s, 'ent-p'), '/budget?view=week&weekOf=2026-09-22&book=ent-p', 'another book — no account');
  assert.equal(sectionHref(s, null), '/budget?view=week&weekOf=2026-09-22', 'OVERVIEW — no book, no account');
  assert.equal(sectionHref(search(''), 'ent-b'), '/budget?book=ent-b', 'a URL with no view stays DAY of today');
  assert.equal(accountHref(s, 'ent-b', '6300'), '/budget?view=week&weekOf=2026-09-22&book=ent-b&account=6300');
  assert.equal(accountHref(s, 'ent-b', null), '/budget?view=week&weekOf=2026-09-22&book=ent-b', 'All accounts');
});

test('T2 the section: OVERVIEW, a book, a book filtered to one account — and each choice the report cannot honour, refused by name', () => {
  const r = report();
  assert.deepEqual(sectionFor({ book: null, account: null }, r.books), { kind: 'overview' });
  const book = sectionFor({ book: 'ent-b', account: null }, r.books);
  assert.ok(book.kind === 'book' && book.book.entityId === 'ent-b' && book.account.kind === 'all');
  const one = sectionFor({ book: 'ent-b', account: '6200' }, r.books);
  assert.ok(one.kind === 'book' && one.account.kind === 'one' && one.account.code === '6200' && one.account.row?.name === 'Software');
  // An account of four digits with no row in this view is KEPT — the screen says so; never a switch to All.
  const none = sectionFor({ book: 'ent-b', account: '6999' }, r.books);
  assert.ok(none.kind === 'book' && none.account.kind === 'one' && none.account.code === '6999' && none.account.row === null);
  // Refused by name.
  assert.deepEqual(sectionFor({ book: 'ent-gone', account: null }, r.books), { kind: 'refused', message: 'This link names a book that is not in your report' });
  assert.equal(SECTION_REFUSAL.unknownBook, 'This link names a book that is not in your report');
  for (const bad of ['62', '62000', 'B-6200', '6200a', '']) {
    assert.deepEqual(sectionFor({ book: 'ent-b', account: bad }, r.books), { kind: 'refused', message: SECTION_REFUSAL.badAccount(bad) }, JSON.stringify(bad));
  }
  assert.match(SECTION_REFUSAL.badAccount('B-6200'), /"B-6200", which is not four digits/);
  assert.deepEqual(sectionFor({ book: null, account: '6200' }, r.books), { kind: 'refused', message: SECTION_REFUSAL.accountWithoutBook('6200') });
  assert.match(SECTION_REFUSAL.accountWithoutBook('6200'), /names an account \(6200\) but no book/);
});

test('T2 the chips: each book by its label, with its entity name only when another book shares the label', () => {
  const r = report([P, B, B2, T]);
  const labels = bookChipLabels(r.books);
  assert.deepEqual(r.books.map((b) => labels.get(b.entityId)), ['PERSONAL', 'BUSINESS · Side Shop', 'BUSINESS · Temple Stuart', 'TRADE']);
  assert.deepEqual([...bookChipLabels(report().books).values()], ['PERSONAL', 'BUSINESS', 'TRADE']);
});

// ── T2 · THE STRIP'S COUNTS ──────────────────────────────────────────────────

const np = (entityId: string, sourceId: string, cents: number | null): NotPlaced => ({ source: 'routine', sourceId, entityId, label: sourceId, cents, day: AS_OF, reason: 'no account', detail: null });

test('T2 Not placed: a book\'s own items on a book, every item on OVERVIEW and on a refused section; plans summed, postings and unknown amounts counted, never summed', () => {
  const r = report();
  assert.deepEqual(r.unplaced.map((u) => [u.kind, unplacedEntityId(u)]), [['budgetLine', 'ent-b'], ['posting', 'ent-p']], 'the asset line is B\'s, the lost posting P\'s');
  const data = { report: r, notPlaced: [np('ent-b', 'routine:gym', 1500), np('ent-b', 'routine:zone', null), np('ent-p', 'routine:tea', 200)] };
  const onB = notPlacedIn(data, sectionFor({ book: 'ent-b', account: null }, r.books));
  assert.equal(onB.scope, 'book');
  assert.deepEqual(onB.notPlaced.map((n) => n.sourceId), ['routine:gym', 'routine:zone']);
  assert.deepEqual(onB.unplaced.map((u) => u.kind), ['budgetLine'], 'the asset line is B\'s; the lost posting is P\'s');
  assert.deepEqual([onB.count, onB.plannedCents, onB.withoutAmount, onB.postings], [3, 1500 + 900, 1, 0]);
  const onP = notPlacedIn(data, sectionFor({ book: 'ent-p', account: null }, r.books));
  assert.deepEqual([onP.count, onP.plannedCents, onP.withoutAmount, onP.postings], [2, 200, 0, 1]);
  const onT = notPlacedIn(data, sectionFor({ book: 'ent-t', account: null }, r.books));
  assert.deepEqual([onT.count, onT.plannedCents], [0, null], 'nothing: blank, never 0');
  for (const s of [sectionFor({ book: null, account: null }, r.books), sectionFor({ book: 'ent-gone', account: null }, r.books)]) {
    const all = notPlacedIn(data, s);
    assert.deepEqual([all.scope, all.count, all.plannedCents, all.withoutAmount, all.postings], ['all books', 5, 1500 + 200 + 900, 1, 1]);
  }
});

test('T2 Not counted as plans and Left out by name: their counts, from the response alone', () => {
  const excludedTasks: BudgetReportResponse['excludedTasks'] = { scope: 'ALL TIME', byStatus: EXCLUDED_TASK_STATUSES.map((status, i) => ({ status, tasks: i, cents: i === 0 ? null : i * 1000 })) };
  assert.deepEqual(excludedTasksTotal({ excludedTasks }), { tasks: 0 + 1 + 2 + 3, cents: 1000 + 2000 + 3000 });
  assert.deepEqual(excludedTasksTotal({ excludedTasks: { scope: 'ALL TIME', byStatus: EXCLUDED_TASK_STATUSES.map((status) => ({ status, tasks: 0, cents: null })) } }), { tasks: 0, cents: null });
  assert.equal(leftOutLines({ excludedLines: { reversalPairLines: 2, closingEntryLines: 1, linesAfterAsOf: 3 } }), 6);
});

test('T2 PURITY — the helper imports types only, and reads no clock, network or environment; this test imports no @prisma/client', () => {
  const src = code(HELPER);
  const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.deepEqual(imports, [
    "import type { ReportBook, ReportRow, UnplacedItem } from './report';",
    "import type { NotPlaced } from './days';",
    "import type { BudgetReportResponse } from './reportInputs';",
  ]);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)|\bprocess\.env\b|localStorage|sessionStorage/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetReportView.test.ts'), /['"]@prisma\/client/);
  // The purity law's fifth root, with this file as its test.
  assert.match(code('scripts/assert-tool-registry.ts'), /\{ root: 'src\/lib\/budget\/reportView\.ts', name: 'the view helper', noun: 'view helper', test: 'src\/lib\/__tests__\/budgetReportView\.test\.ts' \},/);
});

// ── T3 · THE SCREEN ──────────────────────────────────────────────────────────

test('T3 one section at a time: the Overview, one book, or a refusal — then the strip', () => {
  const s = code(SCREEN);
  assert.match(s, /const section = sectionFor\(choice, report\.books\);/);
  assert.match(s, /\{section\.kind === 'overview' && \(/);
  assert.match(s, /\{section\.kind === 'book' && <BookSection section=\{section\} report=\{report\} go=\{go\} search=\{search\} \/>\}/);
  assert.match(s, /\{section\.kind === 'refused' && <p className="text-sm text-brand-red" data-section-refused>\{section\.message\}<\/p>\}/);
  assert.match(s, /<Strip data=\{data\} section=\{section\} \/>/);
  assert.equal((s.match(/data-budget-section="overview"/g) ?? []).length, 1);
  assert.equal((s.match(/data-budget-section="book"/g) ?? []).length, 1);
  assert.doesNotMatch(s, /report\.books\.map\(\(book\) => \(\s*<section/, 'books are no longer stacked');
  assert.doesNotMatch(s, /Costed tasks nobody accepted|nobody accepted/);
});

test('T3 the chips come from report.books, as the view chips are drawn (toggleChip, aria-pressed)', () => {
  const s = code(SCREEN);
  assert.match(s, /<SectionChips books=\{report\.books\} choice=\{choice\} go=\{go\} search=\{search\} \/>/);
  assert.match(s, /className=\{toggleChip\(choice\.book === null\)\} aria-pressed=\{choice\.book === null\} onClick=\{\(\) => go\(sectionHref\(search, null\)\)\}>\s*OVERVIEW/);
  assert.match(s, /\{books\.map\(\(b\) => \(\s*<button\s*key=\{b\.entityId\}\s*type="button"\s*className=\{toggleChip\(choice\.book === b\.entityId\)\}\s*aria-pressed=\{choice\.book === b\.entityId\}\s*onClick=\{\(\) => go\(sectionHref\(search, b\.entityId\)\)\}\s*>\s*\{labels\.get\(b\.entityId\)\}/);
  assert.match(s, /const labels = bookChipLabels\(books\);/);
});

test('T3 a book\'s totals come from book.totals — the Overview\'s own table and NET-blank lines — never summed on the screen', () => {
  const s = code(SCREEN);
  assert.match(s, /<TotalsTable columns=\{columns\} totals=\{book\.totals\} \/>/, 'a book: its own totals');
  assert.match(s, /<TotalsTable columns=\{columns\} totals=\{report\.totals\} \/>/, 'the Overview: the report\'s');
  assert.equal((s.match(/<TotalsTable /g) ?? []).length, 2, 'one table, two scopes');
  assert.match(s, /const blanks = totals\.length > 0 \? netBlanks\(totals\[0\]\) : \[\];/, 'the NET-blank lines of whichever totals are shown');
  assert.doesNotMatch(s, /\.reduce\(|\+=/, 'no arithmetic on the screen — the model and the helper do it');
});

test('T3 the Account column\'s header is the filter: All accounts, then the book\'s rows as account strings; a missing account is kept and said', () => {
  const s = code(SCREEN);
  assert.match(s, /<TableHead columns=\{columns\} first=\{filter\} \/>/);
  assert.match(s, /aria-label="Filter by account"/);
  assert.match(s, /<option value="">All accounts<\/option>/);
  assert.match(s, /\{book\.rows\.map\(\(row\) => \(\s*<option key=\{row\.code\} value=\{row\.code\}>\{formatAccountCode\(report\.books, row\.entityId, row\.code\)\} · \{row\.name\}<\/option>/);
  assert.match(s, /onChange=\{\(e\) => go\(accountHref\(search, book\.entityId, e\.target\.value === '' \? null : e\.target\.value\)\)\}/);
  assert.match(s, /const shown = account\.kind === 'all' \? book\.rows : account\.row === null \? \[\] : \[account\.row\];/, 'one account → only its three lines');
  assert.match(s, /\{missing\} has no planned or posted money in this view/);
  assert.match(s, /\{missing !== null && account\.kind === 'one' && <option value=\{account\.code\}>\{missing\}<\/option>\}/, 'the select keeps it selected');
});

test('T3 the strip: six lines under whichever section is shown, native <details>, Not placed open when it has items', () => {
  const s = code(SCREEN);
  for (const kind of ['not-placed', 'excluded-tasks', 'not-in-books', 'left-out']) assert.match(s, new RegExp(`kind="${kind}"`), kind);
  assert.match(s, /data-strip="travel">Travel budgets connect after the Travel tab ships\./);
  assert.match(s, /data-strip="records">/);
  assert.match(s, /<details open=\{open\}/);
  assert.match(s, /open=\{placed\.count > 0\}/);
  assert.match(s, /const placed = notPlacedIn\(data, section\);/);
  for (const allBooks of ['ALL TIME · all books', 'not-in-books', 'left-out']) assert.ok(s.includes(allBooks), allBooks);
  // Nothing listed today became unreachable: the per-column bank table and the not-totalled rows stay, inside their line.
  assert.match(s, /\{data\.notInBooks\.columns\.map\(\(c\) => \(/);
  assert.match(s, /\{data\.notInBooks\.notTotalled\.map\(\(row\) => \(/);
  assert.match(s, /\{placed\.unplaced\.map\(\(u, i\) => <li key=\{`unplaced:\$\{i\}`\}>\{unplacedLine\(u, report\.books\)\}<\/li>\)\}/);
});

test('T3 the excluded-tasks line names its statuses from EXCLUDED_TASK_STATUSES — never typed', () => {
  const s = code(SCREEN);
  assert.match(s, /import \{ EXCLUDED_TASK_STATUSES \} from '@\/lib\/budget\/days';/);
  assert.match(s, /const EXCLUDED_STATUS_WORDS = EXCLUDED_TASK_STATUSES\.length > 1/);
  assert.match(s, /status \{EXCLUDED_STATUS_WORDS\} · ALL TIME · all books/);
  for (const status of EXCLUDED_TASK_STATUSES) assert.doesNotMatch(s, new RegExp(`['"\`]${status}['"\`]`), `${status} is not typed on the screen`);
});

test('T3 every link goes through the helper, and the screen stays storage-free', () => {
  const s = code(SCREEN);
  assert.match(s, /router\.push\(hrefFor\(k\.kind, anchor, choice\)\)/);
  assert.match(s, /const back = params === null \? null : stepHref\(params, -1, choice\);/);
  assert.match(s, /const forward = params === null \? null : stepHref\(params, 1, choice\);/);
  assert.doesNotMatch(s, /['"`]\/budget\?/, 'no /budget link is built on the screen');
  assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie|indexedDB/);
  assert.match(s, /const params = asOf === null \? null : viewParams\(current, asOf\);/, 'the fetch takes the view keys only');
});
