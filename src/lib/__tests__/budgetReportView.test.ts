/**
 * TAB13-03 (2026-09-29) — one section at a time on /budget.
 *
 * T2 drives the URL-state helper (src/lib/budget/reportView.ts — the budget
 * report purity law's fifth root) over books the real model builds: the section
 * and the account read from the URL, every link keeping both, a book choice
 * clearing the account, and each choice the report cannot honour refused by name.
 * T3 reads the screen (a client component) from source, comments stripped — the
 * repo's TEST-TRUTH-01 way. This file imports nothing from @prisma/client.
 *
 * TAB13-03b (2026-09-29) — a book is its itemized table, and the strip is gone.
 * TAB13-03b T1 drives missingMoney, the ONE function the notice's lines come
 * from, over fixtures; TAB13-03b T2 pins the screen: no totals on a book, the
 * Account select's value, the notice drawn from missingMoney alone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { buildBudgetReport, type BudgetReport, type ReportEntity } from '../budget/report';
import { EXCLUDED_TASK_STATUSES, type NotPlaced } from '../budget/days';
import type { BudgetReportResponse, NotInBooksColumn } from '../budget/reportInputs';
import {
  SECTION_REFUSAL, accountHref, anchorOf, bookChipLabels, choiceOf, hrefFor, missingMoney,
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

// ── T2 · NOT PLACED IN THE SECTION ───────────────────────────────────────────

const np =(entityId: string, sourceId: string, cents: number | null): NotPlaced => ({ source: 'routine', sourceId, entityId, label: sourceId, cents, day: AS_OF, reason: 'no account', detail: null });

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

// ── TAB13-03b T1 · WHAT THIS VIEW IS MISSING ─────────────────────────────────

type Bank = BudgetReportResponse['notInBooks'];
type Figures = readonly [transactions: number | null, bankCents: number | null, notTotalled: number | null];

/** The response's bank block over the report's own columns — every figure handed in by the test, in column order. */
function bank(r: BudgetReport, figures: readonly Figures[], notTotalled: Bank['notTotalled'] = []): Bank {
  assert.equal(figures.length, r.columns.length, 'one figure per column');
  return {
    basis: 'bank',
    sign: 'Plaid signs outflows positive',
    columns: r.columns.map((c, i): NotInBooksColumn => ({
      key: c.key, label: c.label, from: c.from, through: c.state === 'future' ? null : c.to < r.asOf ? c.to : r.asOf, state: c.state,
      transactions: figures[i][0], bankCents: figures[i][1], notTotalled: figures[i][2],
    })),
    notTotalled,
  };
}
/** A report with nothing unplaced: every book, no lines. */
const bare = (view: BudgetReport['view'] = { kind: 'day', day: AS_OF }): BudgetReport => buildBudgetReport({ asOf: AS_OF, view, entities: [P, B, T], accounts: [], budgetLines: [], postings: [] });
const NONE: Figures = [0, null, 0];
const sectionsOf = (r: BudgetReport) => [
  sectionFor({ book: null, account: null }, r.books),
  ...r.books.map((b) => sectionFor({ book: b.entityId, account: null }, r.books)),
  sectionFor({ book: 'ent-gone', account: null }, r.books),
];

test('TAB13-03b T1 nothing missing → NO line, on every section — and set-aside tasks, left-out ledger lines, travel and record counts never make one', () => {
  const r = bare();
  assert.deepEqual(r.columns.map((c) => c.label), ['MTD', 'Tue'], 'DAY: columns[0] is MTD');
  const data = { report: r, notPlaced: [], notInBooks: bank(r, [NONE, NONE]) };
  for (const s of sectionsOf(r)) assert.deepEqual(missingMoney(data, s), [], s.kind);
  // The response's other counts, all non-zero, are not missing money: still no line.
  const full: Pick<BudgetReportResponse, 'notPlaced' | 'report' | 'notInBooks' | 'excludedTasks' | 'excludedLines' | 'records' | 'travelBudgets'> = {
    ...data,
    excludedTasks: { scope: 'ALL TIME', byStatus: [{ status: 'cancelled', tasks: 4, cents: 90000 }] },
    excludedLines: { reversalPairLines: 2, closingEntryLines: 1, linesAfterAsOf: 3 },
    records: { entities: 3, accounts: 9, routines: 5, costedTasks: 7, ledgerLines: 40, bankRows: 12, budgetLines: { routine: 5, task: 2 } },
    travelBudgets: 'not connected',
  };
  for (const s of sectionsOf(r)) assert.deepEqual(missingMoney(full, s), [], s.kind);
  assert.doesNotMatch(code(HELPER), /excludedTasks|excludedLines|travelBudgets|\brecords\b/, 'the helper reads none of them');
});

test('TAB13-03b T1 BUDGET SHORT is notPlacedIn\'s scope and sums — the book\'s own on a book, all books on OVERVIEW and on a refused section', () => {
  const r = report();
  const data = { report: r, notPlaced: [np('ent-b', 'routine:gym', 1500), np('ent-b', 'routine:zone', null), np('ent-p', 'routine:tea', 200)], notInBooks: bank(r, [NONE, NONE]) };
  for (const s of sectionsOf(r)) {
    const placed = notPlacedIn(data, s);
    assert.deepEqual(missingMoney(data, s), placed.count === 0 ? [] : [{ kind: 'budgetShort', placed }], s.kind === 'book' ? s.book.entityId : s.kind);
  }
  const onB = missingMoney(data, sectionFor({ book: 'ent-b', account: null }, r.books));
  assert.ok(onB.length === 1 && onB[0].kind === 'budgetShort');
  assert.deepEqual([onB[0].placed.scope, onB[0].placed.count, onB[0].placed.plannedCents, onB[0].placed.withoutAmount], ['book', 3, 1500 + 900, 1]);
  assert.deepEqual(missingMoney(data, sectionFor({ book: 'ent-t', account: null }, r.books)), [], 'TRADE has none of its own — no line, though other books are short');
  // An account filter does not narrow it: the line is the book's.
  assert.deepEqual(missingMoney(data, sectionFor({ book: 'ent-b', account: '6200' }, r.books)), onB);
  const all = missingMoney(data, sectionFor({ book: null, account: null }, r.books));
  assert.ok(all.length === 1 && all[0].kind === 'budgetShort');
  assert.deepEqual([all[0].placed.scope, all[0].placed.count, all[0].placed.plannedCents], ['all books', 5, 1500 + 200 + 900]);
});

test('TAB13-03b T1 ACTUAL SHORT reads columns[0] — the view\'s widest — on every section, and nothing else', () => {
  const r = bare();
  const short = { report: r, notPlaced: [], notInBooks: bank(r, [[3, 12345, 0], [1, 400, 0]]) };
  for (const s of sectionsOf(r)) {
    assert.deepEqual(missingMoney(short, s), [{ kind: 'actualShort', label: 'MTD', transactions: 3, bankCents: 12345, notTotalled: 0 }], 'bank rows are in no book: every section');
  }
  // A fixture no route builds, on purpose: only the day column has rows. The line reads columns[0], so there is none.
  assert.deepEqual(missingMoney({ ...short, notInBooks: bank(r, [NONE, [2, 500, 1]]) }, { kind: 'overview' }), []);
  // Rows left out of the total alone still make the line — counted, never summed.
  assert.deepEqual(missingMoney({ ...short, notInBooks: bank(r, [[0, null, 2], NONE]) }, { kind: 'overview' }), [{ kind: 'actualShort', label: 'MTD', transactions: 0, bankCents: null, notTotalled: 2 }]);
  // WEEK and YEAR: the widest column is WEEK / YTD.
  for (const [view, label] of [[{ kind: 'week', weekOf: '2026-09-28' }, 'WEEK'], [{ kind: 'year', year: 2026 }, 'YTD']] as const) {
    const w = bare(view);
    const lines = missingMoney({ report: w, notPlaced: [], notInBooks: bank(w, w.columns.map((c, i) => (i === 0 ? [5, 700, 0] : c.state === 'future' ? [null, null, null] : NONE))) }, { kind: 'overview' });
    assert.deepEqual(lines, [{ kind: 'actualShort', label, transactions: 5, bankCents: 700, notTotalled: 0 }], label);
  }
  // A view wholly in the future: nothing can have happened yet — no ACTUAL SHORT.
  const future = bare({ kind: 'week', weekOf: '2026-10-05' });
  assert.ok(future.columns.every((c) => c.state === 'future'));
  assert.deepEqual(missingMoney({ report: future, notPlaced: [], notInBooks: bank(future, future.columns.map((): Figures => [null, null, null])) }, { kind: 'overview' }), []);
  assert.match(code(HELPER), /const widest = data\.notInBooks\.columns\[0\];/);
});

test('TAB13-03b T1 both gaps → two lines, BUDGET SHORT first; the notice has no third kind', () => {
  const r = report();
  const data = { report: r, notPlaced: [np('ent-p', 'routine:tea', 200)], notInBooks: bank(r, [[4, 9900, 1], [0, null, 0]]) };
  const lines = missingMoney(data, sectionFor({ book: 'ent-p', account: null }, r.books));
  assert.deepEqual(lines.map((l) => l.kind), ['budgetShort', 'actualShort']);
  assert.deepEqual(lines[1], { kind: 'actualShort', label: 'MTD', transactions: 4, bankCents: 9900, notTotalled: 1 });
  const type = /export type MissingLine =([\s\S]*?)\};/.exec(code(HELPER));
  assert.ok(type !== null, 'MissingLine is declared');
  assert.deepEqual([...type[1].matchAll(/readonly kind: '(\w+)'/g)].map((m) => m[1]), ['budgetShort', 'actualShort']);
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

test('T3 one section at a time: the Overview, one book, or a refusal — then what this view is missing (TAB13-03b: the notice replaces the strip)', () => {
  const s = code(SCREEN);
  assert.match(s, /const section = sectionFor\(choice, report\.books\);/);
  assert.match(s, /\{section\.kind === 'overview' && \(/);
  assert.match(s, /\{section\.kind === 'book' && <BookSection section=\{section\} report=\{report\} go=\{go\} search=\{search\} \/>\}/);
  assert.match(s, /\{section\.kind === 'refused' && <p className="text-sm text-brand-red" data-section-refused>\{section\.message\}<\/p>\}/);
  assert.equal((s.match(/<MissingNotice data=\{data\} section=\{section\} \/>/g) ?? []).length, 1, 'mounted once, under whichever section is shown');
  assert.doesNotMatch(s, /<Strip\b|function Strip\b|function StripLine\b|data-strip/, 'the strip is gone');
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

test('TAB13-03b T2 a book is its itemized table — no totals table on a book; the Overview keeps the report\'s, never summed on the screen', () => {
  const s = code(SCREEN);
  const bookSection = s.slice(s.indexOf('function BookSection('), s.indexOf('function MissingNotice('));
  assert.ok(bookSection.length > 0 && bookSection.includes('data-budget-section="book"'), 'BookSection is read whole');
  assert.doesNotMatch(bookSection, /<TotalsTable\b|book\.totals/, 'a book draws its heading and its account table — nothing above it');
  assert.match(bookSection, /<Heading>\{book\.label\} · \{book\.entityName\}<\/Heading>\s*<div className="overflow-x-auto rounded-lg border border-border bg-white">\s*<table className="w-full text-sm">\s*<TableHead columns=\{columns\} first=\{filter\} \/>/, 'the heading, then the table');
  assert.equal((s.match(/<TotalsTable /g) ?? []).length, 1, 'one totals table: the Overview\'s');
  assert.match(s, /<Heading>Overview<\/Heading>\s*<TotalsTable columns=\{columns\} totals=\{report\.totals\} \/>/, 'the Overview: the report\'s totals');
  assert.match(s, /const blanks = totals\.length > 0 \? netBlanks\(totals\[0\]\) : \[\];/, 'and its NET-blank lines');
  assert.doesNotMatch(s, /book\.totals/, 'book.totals stays in the model and the response; the screen does not draw it');
  assert.doesNotMatch(s, /\.reduce\(|\+=/, 'no arithmetic on the screen — the model and the helper do it');
});

test('T3 the Account column\'s header is the filter: All accounts, then the book\'s rows as account strings; a missing account is kept and said', () => {
  const s = code(SCREEN);
  assert.match(s, /<TableHead columns=\{columns\} first=\{filter\} \/>/);
  assert.match(s, /aria-label="Filter by account"/);
  assert.match(s, /<option value="">All accounts<\/option>/);
  assert.match(s, /value=\{account\.kind === 'all' \? '' : account\.code\}/, 'the select\'s value: the code when one is chosen, "" for All');
  assert.match(s, /\{book\.rows\.map\(\(row\) => \(\s*<option key=\{row\.code\} value=\{row\.code\}>\{formatAccountCode\(report\.books, row\.entityId, row\.code\)\} · \{row\.name\}<\/option>/);
  assert.match(s, /onChange=\{\(e\) => go\(accountHref\(search, book\.entityId, e\.target\.value === '' \? null : e\.target\.value\)\)\}/);
  assert.match(s, /const shown = account\.kind === 'all' \? book\.rows : account\.row === null \? \[\] : \[account\.row\];/, 'one account → only its three lines');
  assert.match(s, /\{missing\} has no planned or posted money in this view/);
  assert.match(s, /\{missing !== null && account\.kind === 'one' && <option value=\{account\.code\}>\{missing\}<\/option>\}/, 'the select keeps it selected');
});

test('TAB13-03b T2 the notice: its lines from missingMoney alone, nothing drawn when there are none, each gap in a native <details>', () => {
  const s = code(SCREEN);
  const notice = s.slice(s.indexOf('function MissingNotice('), s.indexOf('function Report('));
  assert.ok(notice.length > 0, 'MissingNotice is read whole');
  assert.match(notice, /const lines = missingMoney\(data, section\);\s*if \(lines\.length === 0\) return null;/, 'no gap → no notice');
  assert.doesNotMatch(s, /notPlacedIn\(|notInBooks\.columns\[0\]/, 'the screen decides no line itself — the helper does');
  // BUDGET SHORT: the count, the planned sum, the scope; items as the Not placed list drew them.
  assert.match(notice, /<details key="budget-short" open className="[^"]*" data-missing="budget-short">/);
  assert.match(notice, /BUDGET SHORT<\/span> — \{line\.placed\.count\} not placed · \{formatCents\(line\.placed\.plannedCents\)\} planned/);
  assert.match(notice, /\{line\.placed\.scope === 'book' \? 'this book' : 'all books'\}/);
  assert.match(notice, /\{line\.placed\.notPlaced\.map\(\(n\) => \(/);
  assert.match(notice, /\{line\.placed\.unplaced\.map\(\(u, i\) => <li key=\{`unplaced:\$\{i\}`\}>\{unplacedLine\(u, report\.books\)\}<\/li>\)\}/);
  // ACTUAL SHORT: the widest column's figures, from the line; the per-column table and the not-totalled rows stay inside it.
  assert.match(notice, /<details key="actual-short" className="[^"]*" data-missing="actual-short">/);
  assert.match(notice, /ACTUAL SHORT<\/span> — \{line\.label\}: \{line\.transactions\} bank transaction\{line\.transactions === 1 \? '' : 's'\} \(\{formatCents\(line\.bankCents\)\}\) \{line\.transactions === 1 \? "isn't" : "aren't"\} in the books yet — no Actual includes \{line\.transactions === 1 \? 'it' : 'them'\}/);
  assert.match(notice, /· all books<\/span>\s*<\/summary>/);
  assert.match(notice, /\{data\.notInBooks\.columns\.map\(\(c\) => \(/);
  assert.match(notice, /\{data\.notInBooks\.notTotalled\.map\(\(row\) => \(/);
  assert.equal((notice.match(/<details /g) ?? []).length, 2, 'two kinds of line, no third');
});

test('TAB13-03b T2 no line for set-aside tasks, left-out ledger lines, travel or record counts — the screen does not read them', () => {
  const s = code(SCREEN);
  assert.doesNotMatch(s, /excludedTasks|excludedLines|travelBudgets|data\.records|EXCLUDED_TASK_STATUSES|EXCLUDED_STATUS_WORDS/);
  assert.doesNotMatch(s, /from '@\/lib\/budget\/days'/, 'the screen imports nothing from days.ts now');
  assert.doesNotMatch(s, /Travel budgets connect|Not counted as plans|Left out by name/);
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
