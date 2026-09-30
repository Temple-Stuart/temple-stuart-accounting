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
import { code, comments } from '../sourceText';
import { buildBudgetReport, type BudgetReport, type ReportEntity } from '../budget/report';
import { EXCLUDED_TASK_STATUSES, type NotPlaced } from '../budget/days';
import type { BudgetReportResponse, NotInBooksColumn } from '../budget/reportInputs';
import { YEAR_WORDS, planDays, type DayPlan, type StrandedVendor } from '../budget/planLines';
import {
  SECTION_REFUSAL, accountHref, anchorOf, bookChipLabels, choiceOf, hrefFor, missingMoney, vendorChoices,
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
/** TAB13-04: the view's day plan holding nothing — a YEAR's words, or a DAY's or WEEK's days with no line and nothing stranded. */
const quiet = (r: BudgetReport): DayPlan => {
  const days = planDays(r.view);
  return days === null ? { listed: false, words: YEAR_WORDS } : { listed: true, days, lines: [], stranded: [] };
};
const sectionsOf = (r: BudgetReport) => [
  sectionFor({ book: null, account: null }, r.books),
  ...r.books.map((b) => sectionFor({ book: b.entityId, account: null }, r.books)),
  sectionFor({ book: 'ent-gone', account: null }, r.books),
];

test('TAB13-03b T1 nothing missing → NO line, on every section — and set-aside tasks, left-out ledger lines, travel and record counts never make one', () => {
  const r = bare();
  assert.deepEqual(r.columns.map((c) => c.label), ['MTD', 'Tue'], 'DAY: columns[0] is MTD');
  const data = { report: r, notPlaced: [], notInBooks: bank(r, [NONE, NONE]), plans: quiet(r) };
  for (const s of sectionsOf(r)) assert.deepEqual(missingMoney(data, s), [], s.kind);
  // The response's other counts, all non-zero, are not missing money: still no line.
  const full: Pick<BudgetReportResponse, 'notPlaced' | 'report' | 'notInBooks' | 'plans' | 'excludedTasks' | 'excludedLines' | 'records' | 'travelBudgets'> = {
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
  const data = { report: r, notPlaced: [np('ent-b', 'routine:gym', 1500), np('ent-b', 'routine:zone', null), np('ent-p', 'routine:tea', 200)], notInBooks: bank(r, [NONE, NONE]), plans: quiet(r) };
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
  const short = { report: r, notPlaced: [], notInBooks: bank(r, [[3, 12345, 0], [1, 400, 0]]), plans: quiet(r) };
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
    const lines = missingMoney({ report: w, notPlaced: [], notInBooks: bank(w, w.columns.map((c, i) => (i === 0 ? [5, 700, 0] : c.state === 'future' ? [null, null, null] : NONE))), plans: quiet(w) }, { kind: 'overview' });
    assert.deepEqual(lines, [{ kind: 'actualShort', label, transactions: 5, bankCents: 700, notTotalled: 0 }], label);
  }
  // A view wholly in the future: nothing can have happened yet — no ACTUAL SHORT.
  const future = bare({ kind: 'week', weekOf: '2026-10-05' });
  assert.ok(future.columns.every((c) => c.state === 'future'));
  assert.deepEqual(missingMoney({ report: future, notPlaced: [], notInBooks: bank(future, future.columns.map((): Figures => [null, null, null])), plans: quiet(future) }, { kind: 'overview' }), []);
  assert.match(code(HELPER), /const widest = data\.notInBooks\.columns\[0\];/);
});

test('TAB13-03b T1 both gaps → two lines, BUDGET SHORT first; the notice has no third kind', () => {
  const r = report();
  const data = { report: r, notPlaced: [np('ent-p', 'routine:tea', 200)], notInBooks: bank(r, [[4, 9900, 1], [0, null, 0]]), plans: quiet(r) };
  const lines = missingMoney(data, sectionFor({ book: 'ent-p', account: null }, r.books));
  assert.deepEqual(lines.map((l) => l.kind), ['budgetShort', 'actualShort']);
  assert.deepEqual(lines[1], { kind: 'actualShort', label: 'MTD', transactions: 4, bankCents: 9900, notTotalled: 1 });
  const type = /export type MissingLine =([\s\S]*?)\};/.exec(code(HELPER));
  assert.ok(type !== null, 'MissingLine is declared');
  // TAB13-04: a third kind — VENDORS STRANDED — and no fourth.
  assert.deepEqual([...type[1].matchAll(/readonly kind: '(\w+)'/g)].map((m) => m[1]), ['budgetShort', 'actualShort', 'vendorsStranded']);
});

test('T2 PURITY — the helper imports types, and (TAB13-04) the ONE vendor name rule; it reads no clock, network or environment; this test imports no @prisma/client', () => {
  const src = code(HELPER);
  const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  assert.deepEqual(imports, [
    "import type { ReportBook, ReportRow, UnplacedItem } from './report';",
    "import type { NotPlaced } from './days';",
    "import type { BudgetReportResponse } from './reportInputs';",
    "import type { StrandedVendor } from './planLines';",
    "import { readVendorName, takenBy, vendorNameKey } from '@/lib/operations/planVendor';",
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
  assert.match(s, /\{section\.kind === 'book' && <BookSection section=\{section\} report=\{report\} plans=\{data\.plans\} go=\{go\} search=\{search\} reload=\{reload\} \/>\}/);
  assert.match(s, /\{section\.kind === 'refused' && <p className="text-sm text-brand-red" data-section-refused>\{section\.message\}<\/p>\}/);
  assert.equal((s.match(/<MissingNotice data=\{data\} section=\{section\} reload=\{reload\} \/>/g) ?? []).length, 1, 'mounted once, under whichever section is shown');
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
  assert.equal((notice.match(/<details /g) ?? []).length, 3, 'three kinds of line (TAB13-04: VENDORS STRANDED), no fourth');
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

// ── TAB13-04 T4 · THE VENDOR BOX'S CHOICES, AND VENDORS STRANDED ─────────────

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

const stranded = (vendorName: string, entityId: string): StrandedVendor => ({
  vendor: { id: `v-${vendorName}`, name: vendorName, entityId }, label: 'Meals', line: 'Lunch', day: AS_OF, time: '12:01',
  address: { kind: 'routine_line', id: `s-${vendorName}`, instant: '2026-09-29T19:01:00.000Z' }, reason: 'why',
});

test('TAB13-04 T4 VENDORS STRANDED is the notice\'s last line — the vendor\'s own book on a book, all books elsewhere, none on a YEAR or when there are none', () => {
  const r = report();
  const plans: DayPlan = { listed: true, days: [AS_OF], lines: [], stranded: [stranded('Pho 24', 'ent-p'), stranded('Kopi', 'ent-b')] };
  const data = { report: r, notPlaced: [], notInBooks: bank(r, [NONE, NONE]), plans };
  const names = (s: ReturnType<typeof sectionFor>) => missingMoney(data, s).filter((l) => l.kind === 'vendorsStranded').flatMap((l) => (l.kind === 'vendorsStranded' ? l.stranded.map((v) => v.vendor.name) : []));
  assert.deepEqual(names({ kind: 'overview' }), ['Pho 24', 'Kopi']);
  assert.deepEqual(names(sectionFor({ book: 'ent-p', account: null }, r.books)), ['Pho 24']);
  assert.deepEqual(names(sectionFor({ book: 'ent-t', account: null }, r.books)), []);
  assert.deepEqual(names(sectionFor({ book: 'ent-gone', account: null }, r.books)), ['Pho 24', 'Kopi']);
  const kinds = (d: Pick<BudgetReportResponse, 'notPlaced' | 'report' | 'notInBooks' | 'plans'>) => missingMoney(d, { kind: 'overview' }).map((l) => l.kind);
  assert.deepEqual(kinds(data), ['budgetShort', 'vendorsStranded'], 'last — this report also has plans not placed');
  assert.ok(!kinds({ ...data, plans: { listed: false, words: YEAR_WORDS } }).includes('vendorsStranded'), 'a YEAR lists none');
  assert.ok(!kinds({ ...data, plans: { ...plans, stranded: [] } }).includes('vendorsStranded'), 'nothing when there are none');
});

// ── TAB13-04 T5 · THE SCREEN ─────────────────────────────────────────────────

const DRILL = 'src/components/budget/DayPlanDrill.tsx';

test('TAB13-04 T5 the drill only under a filtered account with a row, on a DAY or a WEEK; a YEAR shows its sentence', () => {
  const s = code(SCREEN);
  const bookSection = s.slice(s.indexOf('function BookSection('), s.indexOf('function MissingNotice('));
  assert.match(bookSection, /\{account\.kind === 'one' && account\.row !== null && \(plans\.listed \? \(\s*<DayPlanDrill/);
  assert.match(bookSection, /lines=\{plans\.lines\.filter\(\(l\) => l\.entityId === book\.entityId && l\.code === account\.code\)\}/);
  assert.match(bookSection, /dayColumns=\{columns\.filter\(\(c\) => c\.kind === 'day'\)\}/);
  assert.match(bookSection, /week=\{report\.view\.kind === 'week'\}/);
  assert.match(bookSection, /\) : <p className="text-sm text-text-muted" data-plans-year>\{plans\.words\}<\/p>\)\}/);
  assert.equal((s.match(/<DayPlanDrill\b/g) ?? []).length, 1, 'in the book section, and nowhere else');
  const d = code(DRILL);
  assert.match(d, /\{lines\.length > 0 && !week && <PlanRows /, 'a DAY: one table');
  assert.match(d, /\{lines\.length > 0 && week && dayColumns\.map\(\(column\) => \{\s*const ofDay = lines\.filter\(\(l\) => l\.day === column\.key\);/, 'a WEEK: grouped by day');
  for (const h of ['When', 'Plan', 'Amount', 'Vendor']) assert.match(d, new RegExp(`>${h}</th>`), h);
  assert.match(d, /\{line\.time === null \? '—' : line\.time\}/);
  assert.match(d, /<td className=\{num\}>\{formatCents\(line\.cents\)\}<\/td>/, 'the amount through the one formatter — read-only');
});

test('TAB13-04 T5 the three writes — POST and DELETE to plan-vendors, POST to the directory — and no other', () => {
  const d = code(DRILL);
  const s = code(SCREEN);
  assert.match(d, /await fetch\('\/api\/operations\/plan-vendors', \{\s*method: 'POST',/);
  assert.match(d, /await fetch\(`\/api\/operations\/plan-vendors\?\$\{query\.toString\(\)\}`, \{ method: 'DELETE', redirect: 'manual' \}\)/);
  assert.match(d, /await fetch\('\/api\/operations\/vendor-directory', \{\s*method: 'POST',/);
  assert.match(d, /await fetch\('\/api\/operations\/vendor-directory', \{ cache: 'no-store', redirect: 'manual' \}\)/, 'the directory read is a GET');
  assert.equal((d.match(/\bmethod: '/g) ?? []).length, 3, 'three writes, no fourth');
  assert.equal((d.match(/\bfetch\(/g) ?? []).length, 4, 'the three writes and the directory read');
  assert.equal((s.match(/\bfetch\(/g) ?? []).length, 1, 'the report screen reads once; its writes are the drill\'s');
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

test('TAB13-04 T5 refusals verbatim, a 401 as signed out, and the report read again after a write — never an optimistic copy', () => {
  const d = code(DRILL);
  const s = code(SCREEN);
  assert.match(d, /if \(res\.type === 'opaqueredirect' \|\| res\.status === 401\) return \{ ok: false, status: res\.status, words: SIGNED_OUT, body: null \};/);
  assert.match(d, /const words = typeof body\.message === 'string' \? body\.message : typeof body\.error === 'string' \? body\.error : `the route answered \$\{res\.status\}`;/, 'the route\'s own words');
  assert.equal((d.match(/data-vendor-refused>\{words\}<\/span>/g) ?? []).length, 2, 'shown where the line is, and beside a Clear');
  assert.match(d, /if \(answer\.ok\) \{ reset\(\); reload\(\); \} else setWords\(answer\.words\);/);
  assert.match(d, /if \(answer\.ok\) reload\(\);\s*else setWords\(answer\.words\);/);
  assert.match(s, /\}, \[query, reads\]\);/);
  assert.match(s, /reload=\{\(\) => setReads\(\(n\) => n \+ 1\)\}/);
  assert.doesNotMatch(d, /setLoad|plans\.lines|\.vendor = /, 'the drill never edits the report it was handed');
});

test('TAB13-04 T5 the stranded line in the notice, each with Clear — and the header says what is true', () => {
  const s = code(SCREEN);
  const notice = s.slice(s.indexOf('function MissingNotice('), s.indexOf('function Report('));
  assert.match(notice, /<details key="vendors-stranded" open className="[^"]*" data-missing="vendors-stranded">/);
  assert.match(notice, /VENDORS STRANDED<\/span> — \{line\.stranded\.length\} planned vendor\{line\.stranded\.length === 1 \? '' : 's'\} match\{line\.stranded\.length === 1 \? 'es' : ''\} no plan line in this view/);
  assert.match(notice, /\{v\.day === null \? 'undated' : v\.day\}/);
  assert.match(notice, /<ClearVendor address=\{v\.address\} reload=\{reload\} \/>/);
  const header = comments(SCREEN);
  assert.match(header, /EVERY FIGURE IS READ-ONLY\. TAB13-04: the\s+\*\s+one input on this screen writes a plan line's vendor \(and a new vendor\), through\s+\*\s+the two vendor routes/);
  assert.doesNotMatch(header, /nothing on this screen writes/);
  assert.match(comments(DRILL), /THE ONE INPUT on \/budget: a plan line's vendor \(and a new vendor\), through the\s+\*\s+two vendor routes — never a figure/);
});
