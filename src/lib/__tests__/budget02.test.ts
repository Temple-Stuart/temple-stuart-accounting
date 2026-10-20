/**
 * BUDGET-02 (Alex, 2026-10-20) — BUDGET IS ONE PAGE: the three tables with the drill-down.
 *
 *   T1 ONE PAGE — no DAY or WEEK, no section chips, no notice, no vendor box on
 *      /budget; ‹ year › the only control and ?year= the only key (ruling A);
 *      the opener's line is ruling I's.
 *   T2 THE THREE TABLES — Business · Personal · Trading by the stored entity
 *      type, then any other book by its own name; two books of one type each a
 *      table, "<type> · <book name>"; a book with no plan line prints
 *      "no budget" (rulings B, D).
 *   T3 THE ROWS — every active revenue and expense account, with or without a
 *      figure; an archived one only with a figure; no balance-sheet row;
 *      Jan … Dec then YTD (ruling C).
 *   T4 THE CELL ROUTE — its auth order, its scope, its refusals by name, and its
 *      sums equal to the report's cells on a fixture year, the actuals read by
 *      the one query that leaves a reversal pair and a year-end close out
 *      (rulings E, G).
 *   T5 /ledger READS ITS PARAMS — the four keys carried to /books, read once,
 *      the general ledger's phase opened, its filters filled through the
 *      report's code reader, the keys cleared; an unknown book or account said
 *      in words (ruling F).
 *   T6 NO SUB-ROWS — Budget's registry row links nothing (ruling H).
 *   T7 THE REDIRECTS — /agenda, /agenda/new, /agenda/[id], /shopping and
 *      /hub/itinerary are dated /trading-idiom redirects to /budget (ruling H).
 *
 * The model, the pure half and the helpers are DRIVEN over fixtures; the routes,
 * the screens and the pages are read from source with comments stripped
 * (TEST-TRUTH-01). This file imports nothing from @prisma/client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { buildBudgetCell, buildBudgetReport, BudgetReportError, shownBudget, type BudgetReportErrorCode, type ChartAccount, type ReportEntity } from '../budget/report';
import {
  budgetCellResponse, budgetReportResponse, cellBookOf, parseCellQuery, UNKNOWN_BOOK_WORDS,
  type BudgetChartRow, type CellRefusalCode, type EntityRow, type LedgerDetailRow, type ReportRows, type RoutineRow, type TaskRow,
} from '../budget/reportInputs';
import { planLinesOn, type PlanVendorRow } from '../budget/planLines';
import { readActuals } from '../budget/reportReads';
import { tableLabels } from '../budget/reportView';
import { TOOL_REGISTRY } from '../toolRegistry';
import { navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { LEDGER_LINK_KEYS, ledgerLinkOf } from '@/components/dashboard/GeneralLedger';

const SCREEN = 'src/components/budget/BudgetReport.tsx';
const PAGE = 'src/app/budget/page.tsx';
const VIEW = 'src/lib/budget/reportView.ts';
const CELL_ROUTE = 'src/app/api/budget/report/cell/route.ts';
const REPORT_ROUTE = 'src/app/api/budget/report/route.ts';
const READS = 'src/lib/budget/reportReads.ts';
const LEDGER_PAGE = 'src/app/ledger/page.tsx';
const BOOKS = 'src/components/home/BooksPipeline.tsx';
const GL = 'src/components/dashboard/GeneralLedger.tsx';

const at = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dec = (s: string) => ({ toString: () => s });

// ── T1 · ONE PAGE ────────────────────────────────────────────────────────────

test('T1 one page — no DAY or WEEK, no chips, no account filter, no notice, no vendor box; ‹ year › the only control', () => {
  const s = code(SCREEN);
  for (const gone of [/>DAY</, />WEEK</, /'day'|'week'/, /data-budget-sections|SectionChips|OVERVIEW/, /data-account-filter|Filter by account/, /MissingNotice|missingMoney|BUDGET SHORT|ACTUAL SHORT|VENDORS STRANDED/, /DayPlanDrill|VendorBox|ClearVendor|data-day-plan/]) {
    assert.doesNotMatch(s, gone, `${gone} is not on /budget`);
  }
  // The only controls: ‹ and › on the year — every other button is a figure, a panel's Close, or nothing.
  assert.match(s, /aria-label="Back one year" disabled=\{back === null\} onClick=\{\(\) => \{ if \(back !== null\) router\.push\(yearHref\(back\)\); \}\}>‹<\/button>/);
  assert.match(s, /aria-label="Forward one year" disabled=\{forward === null\} onClick=\{\(\) => \{ if \(forward !== null\) router\.push\(yearHref\(forward\)\); \}\}>›<\/button>/);
  assert.equal((s.match(/router\.push\(/g) ?? []).length, 2, 'the year, back and forward — no other navigation');
  assert.equal((s.match(/<select\b|<input\b|<textarea\b/g) ?? []).length, 0, 'no input of any kind');
  assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie|indexedDB/, 'no browser storage — the open drill is React state');
  const p = code(PAGE);
  assert.match(p, /line="Budget vs actual by account, month by month — click a figure for the lines behind it\."/, 'ruling I');
  assert.match(p, /<BudgetReport \/>/);
});

test('T1 ?year= is the only key — the screen reads the URL through yearOf alone, and yearOf reads only year', () => {
  const s = code(SCREEN);
  assert.match(s, /const year = asOf === null \? null : yearOf\(new URLSearchParams\(search\.toString\(\)\), asOf\);/);
  assert.equal((s.match(/\bsearch\./g) ?? []).length, 1, 'the search params are read once, handed to yearOf');
  const v = code(VIEW);
  const yearFn = v.slice(v.indexOf('export function yearOf('), v.indexOf('export function yearHref('));
  assert.deepEqual([...yearFn.matchAll(/search\.get\('(\w+)'\)/g)].map((m) => m[1]), ['year']);
  assert.match(v, /return `\/budget\?year=\$\{encodeURIComponent\(year\)\}`;/, 'the one link the page builds: ?year=');
});

// ── T2 · THE THREE TABLES ────────────────────────────────────────────────────

const ent = (id: string, name: string, entityType: string): ReportEntity => ({ id, name, entityType });
const exp = (entityId: string, code: string, name: string, archived = false): ChartAccount => ({ entityId, code, name, accountType: 'expense', balanceType: 'D', archived });

test('T2 the order and the mapping — sole_prop → Business, personal → Personal, trading → Trading, then any other book by name; never re-typed', () => {
  const r = buildBudgetReport({
    asOf: '2026-10-20', view: { kind: 'year', year: 2026 },
    entities: [ent('t', 'Trading', 'trading'), ent('x', 'Holdings', 'llc'), ent('p', 'Personal', 'personal'), ent('b', 'Temple Stuart', 'sole_prop')],
    accounts: [], budgetLines: [], postings: [],
  });
  assert.deepEqual(r.books.map((b) => [b.entityId, b.entityType, b.label]), [
    ['b', 'sole_prop', 'Business'], ['p', 'personal', 'Personal'], ['t', 'trading', 'Trading'], ['x', 'llc', 'Holdings'],
  ]);
  // A book named "Trading" typed personal (src/lib/seed-entities.ts:13) is a Personal book — the stored type decides.
  const seeded = buildBudgetReport({ asOf: '2026-10-20', view: { kind: 'year', year: 2026 }, entities: [ent('s', 'Trading', 'personal')], accounts: [], budgetLines: [], postings: [] });
  assert.equal(seeded.books[0].label, 'Personal');
});

test('T2 two books of one type each get their own table, "<type> · <book name>"; one book of a type is its type alone', () => {
  const r = buildBudgetReport({
    asOf: '2026-10-20', view: { kind: 'year', year: 2026 },
    entities: [ent('b2', 'Side Shop', 'sole_prop'), ent('b1', 'Temple Stuart', 'sole_prop'), ent('p', 'Alex', 'personal')],
    accounts: [], budgetLines: [], postings: [],
  });
  assert.deepEqual(tableLabels(r.books), ['Business · Side Shop', 'Business · Temple Stuart', 'Personal']);
  const s = code(SCREEN);
  assert.match(s, /const labels = tableLabels\(report\.books\);/);
  assert.match(s, /report\.books\.map\(\(book, i\) => \(\s*<BookTable key=\{book\.entityId\} book=\{book\} label=\{labels\[i\]\}/, 'a table per book, in the model\'s order');
});

test('T2 a book with no plan line prints "no budget" in its Budget rows — never a 0, never a blank that hides it', () => {
  const r = buildBudgetReport({
    asOf: '2026-10-20', view: { kind: 'year', year: 2026 },
    entities: [ent('p', 'Alex', 'personal'), ent('t', 'Trading', 'trading')],
    accounts: [exp('p', '6150', 'Coffee'), exp('t', '6400', 'Data')],
    budgetLines: [{ entityId: 'p', code: '6150', day: '2026-03-02', cents: 500, source: 'routine', sourceId: 'routine:r-coffee:routine:2026-03-02T08:00:00.000Z' }],
    postings: [{ entityId: 't', code: '6400', day: '2026-03-03', entryType: 'D', cents: 700, journalEntryId: 'je-data' }],
  });
  assert.deepEqual(r.books.map((b) => [b.label, b.hasPlanLines]), [['Personal', true], ['Trading', false]]);
  // A plan line on an account outside the chart still makes the book planned — the plan exists, unplaced.
  const unplaced = buildBudgetReport({ asOf: '2026-10-20', view: { kind: 'year', year: 2026 }, entities: [ent('t', 'Trading', 'trading')], accounts: [], budgetLines: [{ entityId: 't', code: '6999', day: '2026-03-02', cents: 1, source: 'task', sourceId: 'task:t1' }], postings: [] });
  assert.equal(unplaced.books[0].hasPlanLines, true);
  const s = code(SCREEN);
  assert.match(s, /\{book\.hasPlanLines \? columns\.map\(/);
  assert.match(s, /: <td className=\{`\$\{td\} text-text-faint italic`\} colSpan=\{columns\.length\} data-no-budget>no budget<\/td>\}/);
});

// ── T3 · THE ROWS ────────────────────────────────────────────────────────────

test('T3 rows: every active revenue and expense account with or without a figure; an archived one only with a figure; no balance-sheet row', () => {
  const r = buildBudgetReport({
    asOf: '2026-10-20', view: { kind: 'year', year: 2026 },
    entities: [ent('b', 'Temple Stuart', 'sole_prop')],
    accounts: [
      exp('b', '6300', 'Software'),
      exp('b', '6100', 'Unused, active'),
      exp('b', '6900', 'Old, archived, posted', true),
      exp('b', '6950', 'Old, archived, empty', true),
      { entityId: 'b', code: '4000', name: 'Sales', accountType: 'revenue', balanceType: 'C', archived: false },
      { entityId: 'b', code: '1010', name: 'Checking', accountType: 'asset', balanceType: 'D', archived: false },
      { entityId: 'b', code: '2000', name: 'Card', accountType: 'liability', balanceType: 'C', archived: false },
      { entityId: 'b', code: '3000', name: 'Equity', accountType: 'equity', balanceType: 'C', archived: false },
    ],
    budgetLines: [{ entityId: 'b', code: '6300', day: '2026-02-10', cents: 1200, source: 'task', sourceId: 'task:t1' }],
    postings: [{ entityId: 'b', code: '6900', day: '2026-01-05', entryType: 'D', cents: 900, journalEntryId: 'je-old' }],
  });
  assert.deepEqual(r.books[0].rows.map((x) => x.code), ['4000', '6100', '6300', '6900'], 'revenue first, then expense by code; 6950 (archived, no figure) and every balance-sheet account make no row');
  assert.ok(r.books[0].rows.find((x) => x.code === '6100')?.cells.every((c) => c.budgetFull === null && c.actual === null), 'a zero-figure row is blank, never 0');
  assert.deepEqual(r.columns.map((c) => c.label), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'YTD']);
  // The archived flag is checked like every input — refused by name, never read as false.
  assert.throws(
    () => buildBudgetReport({ asOf: '2026-10-20', view: { kind: 'year', year: 2026 }, entities: [ent('b', 'B', 'sole_prop')], accounts: [{ ...exp('b', '6300', 'S'), archived: undefined as unknown as boolean }], budgetLines: [], postings: [] }),
    (e: unknown) => e instanceof BudgetReportError && e.code === 'bad-archived',
  );
});

// ── T4 · THE CELL ROUTE ──────────────────────────────────────────────────────

test('T4 the cell route\'s auth order: the gate first, then the query, then the book among the viewer\'s own — before any read of a book', () => {
  const r = code(CELL_ROUTE).replace(/\s+/g, ' ');
  const order = [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });",
    "if (!user) { return NextResponse.json({ error: 'User not found' }, { status: 404 }); }",
    'const query = parseCellQuery(request.nextUrl.searchParams, utcDay(new Date()));',
    'if (!query.ok) return NextResponse.json(query.refusal, { status: 400 });',
    'const entities = await prisma.entities.findMany({ where: { userId: user.id }, select: { id: true, name: true, entity_type: true }, });',
    'const book = cellBookOf(entities, query.book);',
    "if (book === null) return NextResponse.json({ error: 'unknown-book', message: UNKNOWN_BOOK_WORDS }, { status: 404 });",
    'readBudgetChart(prisma, user.id, [book.id])',
  ];
  let from = 0;
  for (const step of order) {
    const i = r.indexOf(step, from);
    assert.ok(i >= 0, `in order: ${step}`);
    from = i + step.length;
  }
  // Every read after the gate is the viewer's and the one book's.
  for (const read of ['readBudgetChart(prisma, user.id, [book.id])', 'loadRoutineBudgetInputs(prisma, user.id, book.id)', 'readCostedTasks(prisma, user.id, [book.id])', 'readActuals(prisma, user.id, [book.id], yearFrom, through)', 'readPlanVendors(prisma, user.id, vendorsFrom)']) {
    assert.ok(r.includes(read), read);
  }
  assert.doesNotMatch(r, /export async function (POST|PUT|PATCH|DELETE)/, 'GET only');
  assert.doesNotMatch(code('src/middleware.ts'), /'\/api\/budget/, 'not a public path');
});

test('T4 scope: another person\'s book and a book that does not exist are the same defensive 404, in the same words', () => {
  const mine: EntityRow[] = [{ id: 'ent-b', name: 'Temple Stuart', entity_type: 'sole_prop' }];
  assert.deepEqual(cellBookOf(mine, 'ent-b'), mine[0]);
  assert.equal(cellBookOf(mine, 'ent-bob'), null, 'Bob\'s book is not one of mine');
  assert.equal(cellBookOf(mine, 'no-such-book'), null);
  assert.equal(UNKNOWN_BOOK_WORDS, 'this book is not one of your books', 'the words confirm nothing about the book');
});

test('T4 refusals by name: a bad parameter or a range outside one year (400); an account not in the book\'s chart, or no row (404)', () => {
  const today = '2026-10-20';
  const refused = (q: string, c: CellRefusalCode) => {
    const p = parseCellQuery(new URLSearchParams(q), today);
    assert.equal(p.ok, false, q);
    if (!p.ok) assert.equal(p.refusal.error, c, q);
  };
  const ok = 'book=ent-b&account=6300&from=2026-10-01&to=2026-10-31&asOf=2026-10-20';
  assert.deepEqual(parseCellQuery(new URLSearchParams(ok), today), { ok: true, book: 'ent-b', account: '6300', from: '2026-10-01', to: '2026-10-31', asOf: '2026-10-20', view: { kind: 'year', year: 2026 } });
  refused('account=6300&from=2026-10-01&to=2026-10-31&asOf=2026-10-20', 'bad-book');
  refused('book=ent-b&account=B-6300&from=2026-10-01&to=2026-10-31&asOf=2026-10-20', 'bad-account');
  refused('book=ent-b&account=6300&from=2026-10-1&to=2026-10-31&asOf=2026-10-20', 'bad-from');
  refused('book=ent-b&account=6300&from=2026-10-01&to=2026-13-01&asOf=2026-10-20', 'bad-to');
  refused('book=ent-b&account=6300&from=2025-12-01&to=2026-01-31&asOf=2026-10-20', 'range-outside-one-year');
  refused('book=ent-b&account=6300&from=2026-10-31&to=2026-10-01&asOf=2026-10-20', 'range-outside-one-year');
  refused('book=ent-b&account=6300&from=2026-10-01&to=2026-10-31&asOf=2026-10-25', 'asOf-outside-window');
  // The model refuses an account that is not in THIS book's chart (one of another book), and one that is no row.
  const input = {
    asOf: '2026-10-20', view: { kind: 'year' as const, year: 2026 },
    entities: [ent('b', 'Temple Stuart', 'sole_prop')],
    accounts: [exp('b', '6300', 'Software'), { entityId: 'b', code: '1010', name: 'Checking', accountType: 'asset', balanceType: 'D' as const, archived: false }],
    budgetLines: [], postings: [],
  };
  const throwsCode = (fn: () => unknown, c: BudgetReportErrorCode) => assert.throws(fn, (e: unknown) => e instanceof BudgetReportError && e.code === c, c);
  throwsCode(() => buildBudgetCell(input, { entityId: 'b', code: '6150', from: '2026-10-01', to: '2026-10-31' }), 'cell-account-not-in-chart');
  throwsCode(() => buildBudgetCell(input, { entityId: 'b', code: '1010', from: '2026-10-01', to: '2026-10-31' }), 'cell-account-not-a-row');
  throwsCode(() => buildBudgetCell(input, { entityId: 'b', code: '6300', from: '2025-12-01', to: '2026-01-31' }), 'bad-cell-range');
  const route = code(CELL_ROUTE);
  assert.match(route, /if \(error\.code === 'cell-account-not-in-chart' \|\| error\.code === 'cell-account-not-a-row'\) \{\s*return NextResponse\.json\(\{ error: error\.code, message: error\.message \}, \{ status: 404 \}\);/);
});

// The fixture year: 2026, seen on 2026-09-23. Two books; a routine, a task, postings, an archived account with a posting.
const B: EntityRow = { id: 'ent-b', name: 'Temple Stuart', entity_type: 'sole_prop' };
const P: EntityRow = { id: 'ent-p', name: 'Alex', entity_type: 'personal' };
const chartRow = (entity_id: string, code: string, name: string, account_type = 'expense', is_archived = false): BudgetChartRow =>
  ({ entity_id, code, name, account_type, balance_type: account_type === 'revenue' ? 'C' : 'D', is_archived });
const CHART: BudgetChartRow[] = [
  chartRow('ent-p', '6150', 'Coffee'),
  chartRow('ent-p', '4000', 'Salary', 'revenue'),
  chartRow('ent-p', '6900', 'Old gym', 'expense', true),
  chartRow('ent-b', 'B-6300', 'Software'),
  chartRow('ent-b', '6100', 'Unused'),
];
const COFFEE: RoutineRow = {
  id: 'r-coffee', name: 'Coffee', budget_amount: 5, coa_code: '6150', schedule_rrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0',
  timezone: 'UTC', start_date: at('2026-08-28'), end_date: at('2026-09-26'), steps: [],
};
const LICENSE: TaskRow = {
  id: 't-license', title: 'Buy license', project_id: 'proj-license', entity_id: 'ent-b', status: 'open', estimated_cost_usd: dec('120.50'), coa_code: '6300',
  daily_plan_items: [{ plan_date: at('2026-09-24'), calendar_blocks: [{ status: 'scheduled' }] }],
};
const LIC_JULY: TaskRow = { ...LICENSE, id: 't-july', title: 'Renew domain', project_id: 'proj-domain', estimated_cost_usd: dec('15.00'), daily_plan_items: [{ plan_date: at('2026-07-02'), calendar_blocks: [{ status: 'completed' }] }] };
const ledgerLine = (id: string, entity_id: string, code: string, day: string, entry_type: 'D' | 'C', cents: number, source_type = 'manual'): LedgerDetailRow => ({
  id, journal_entry_id: `je-${id}`, entry_type, amount: BigInt(cents), account: { entity_id, code }, journal_entry: { date: at(day), description: `line ${id}`, source_type },
});
// What the ONE actuals query returns — the reversal pair and the year-end close are not in it (T4 below reads the where).
const LEDGER: LedgerDetailRow[] = [
  ledgerLine('l1', 'ent-p', '6150', '2026-08-29', 'D', 450),
  ledgerLine('l2', 'ent-p', '6150', '2026-09-02', 'D', 525),
  ledgerLine('l3', 'ent-p', '6150', '2026-09-05', 'C', 100, 'plaid_txn'),
  ledgerLine('l4', 'ent-p', '4000', '2026-09-15', 'C', 300000),
  ledgerLine('l5', 'ent-p', '6900', '2026-02-11', 'D', 4000),
  ledgerLine('l6', 'ent-b', 'B-6300', '2026-07-02', 'D', 1500),
];
const HIGHLANDS: PlanVendorRow = {
  id: 'pv-1', routine_id: 'r-coffee', step_id: null, task_id: null, occurrence_at: null,
  vendor: { id: 'v-hl', vendor_name: 'Highlands', entity_id: 'ent-p' }, routine: { name: 'Coffee', timezone: 'UTC' }, step: null, task: null,
};
const ROWS: ReportRows = {
  entities: [B, P], chart: CHART,
  routines: [{ entityId: 'ent-p', rows: [COFFEE] }, { entityId: 'ent-b', rows: [] }],
  tasks: [LICENSE, LIC_JULY], ledger: LEDGER,
  excludedLines: { reversalPairLines: 2, closingEntryLines: 1, linesAfterAsOf: 0 }, bank: [], planVendors: null,
};
const YEAR = { view: { kind: 'year' as const, year: 2026 }, asOf: '2026-09-23' };

test('T4 the drill\'s sums equal the report\'s cells — every row of every book, every month and the YTD of the fixture year', () => {
  const report = budgetReportResponse(YEAR, ROWS).report;
  let checked = 0;
  for (const book of report.books) {
    const entity = book.entityId === 'ent-b' ? B : P;
    for (const row of book.rows) {
      report.columns.forEach((column, i) => {
        if (column.to < column.from) return;
        const q = parseCellQuery(new URLSearchParams({ book: entity.id, account: row.code, from: column.from, to: column.to, asOf: YEAR.asOf }), '2026-09-23');
        assert.ok(q.ok, `${row.code} ${column.key}`);
        if (!q.ok) return;
        const cell = budgetCellResponse(q, {
          book: entity,
          chart: CHART.filter((c) => c.entity_id === entity.id),
          routines: ROWS.routines.find((g) => g.entityId === entity.id)?.rows ?? [],
          tasks: ROWS.tasks.filter((t) => t.entity_id === entity.id),
          ledger: LEDGER.filter((l) => l.account.entity_id === entity.id),
          planVendors: [HIGHLANDS],
        });
        const printed = row.cells[i];
        const shown = shownBudget(column.state) === 'full' ? printed.budgetFull : printed.budgetToDate;
        assert.equal(cell.budget.cell, shown, `${book.label} ${row.code} ${column.key}: the drill's cell is the printed Budget`);
        assert.equal(cell.budget.sum, shown, `${book.label} ${row.code} ${column.key}: the plan lines sum to it`);
        assert.equal(cell.budget.shown, shownBudget(column.state), 'and says which');
        assert.equal(cell.actual.cell, printed.actual, `${book.label} ${row.code} ${column.key}: the Actual`);
        assert.equal(cell.actual.sum, printed.actual, `${book.label} ${row.code} ${column.key}: the ledger lines sum to it`);
        checked += 1;
      });
    }
  }
  assert.equal(checked, (3 + 2) * 13, 'Personal 4000 6150 6900 (archived, posted) · Business 6100 6300 — 13 columns each');
});

test('T4 the drill\'s lines: which Budget it lists, each plan line\'s door and vendor, each ledger line\'s description, source and entry', () => {
  const sept = parseCellQuery(new URLSearchParams({ book: 'ent-p', account: '6150', from: '2026-09-01', to: '2026-09-30', asOf: '2026-09-23' }), '2026-09-23');
  assert.ok(sept.ok);
  if (!sept.ok) return;
  const coffee = budgetCellResponse(sept, { book: P, chart: CHART.filter((c) => c.entity_id === 'ent-p'), routines: [COFFEE], tasks: [], ledger: LEDGER.filter((l) => l.account.entity_id === 'ent-p'), planVendors: [HIGHLANDS] });
  // September is in progress: the drill lists the budget TO DATE, Sep 1 … 23 — 23 days of $5.00.
  assert.deepEqual([coffee.budget.shown, coffee.budget.from, coffee.budget.through, coffee.budget.lines.length, coffee.budget.sum], ['toDate', '2026-09-01', '2026-09-23', 23, 11500]);
  assert.deepEqual(coffee.budget.lines[0], { day: '2026-09-01', source: 'routine', label: 'Coffee', line: null, cents: 500, vendor: 'Highlands', href: '/tasks' });
  // The Actual: 525 D − 100 C (a refund) = 425, each line signed in the account's direction, by day.
  assert.deepEqual(coffee.actual.lines.map((l) => [l.day, l.description, l.entryType, l.signedCents, l.sourceType, l.journalEntryId, l.lineId]), [
    ['2026-09-02', 'line l2', 'D', 525, 'manual', 'je-l2', 'l2'],
    ['2026-09-05', 'line l3', 'C', -100, 'plaid_txn', 'je-l3', 'l3'],
  ]);
  assert.equal(coffee.actual.sum, 425);
  // A future month lists the FULL budget, and nothing has posted.
  const oct = parseCellQuery(new URLSearchParams({ book: 'ent-b', account: '6300', from: '2026-09-01', to: '2026-09-30', asOf: '2026-09-23' }), '2026-09-23');
  assert.ok(oct.ok);
  if (!oct.ok) return;
  const lic = budgetCellResponse(oct, { book: B, chart: CHART.filter((c) => c.entity_id === 'ent-b'), routines: [], tasks: [LICENSE, LIC_JULY], ledger: [], planVendors: [] });
  assert.deepEqual([lic.budget.shown, lic.budget.lines.length], ['toDate', 0], 'September to date holds nothing of the license — it is planned for the 24th');
  const later = parseCellQuery(new URLSearchParams({ book: 'ent-b', account: '6300', from: '2026-09-24', to: '2026-09-30', asOf: '2026-09-23' }), '2026-09-23');
  assert.ok(later.ok);
  if (!later.ok) return;
  const future = budgetCellResponse(later, { book: B, chart: CHART.filter((c) => c.entity_id === 'ent-b'), routines: [], tasks: [LICENSE, LIC_JULY], ledger: [], planVendors: [] });
  assert.deepEqual([future.range.state, future.budget.shown, future.budget.sum, future.actual.through, future.actual.lines], ['future', 'full', 12050, null, []]);
  assert.deepEqual(future.budget.lines.map((l) => [l.label, l.source, l.vendor, l.href]), [['Buy license', 'task', null, '/tasks?project=proj-license']], 'a task links to its project');
  // The saved "B-6300" row is account 6300 — read by the report's one code reader.
  assert.equal(future.account.code, '6300');
});

test('T4 buildBudgetCell selects by the model\'s own rule — to date in a closed or in-progress range, the full plan in a future one — and hands back the very lines and postings it was given', () => {
  const l = (day: string, cents: number) => ({ entityId: 'p', code: '6150', day, cents, source: 'routine' as const, sourceId: `routine:r-coffee:routine:${day}T08:00:00.000Z` });
  const lines = [l('2026-09-20', 500), l('2026-09-23', 500), l('2026-09-25', 700)];
  const postings = [{ entityId: 'p', code: '6150', day: '2026-09-21', entryType: 'D' as const, cents: 450, journalEntryId: 'je-1' }, { entityId: 'p', code: '6150', day: '2026-08-31', entryType: 'D' as const, cents: 99, journalEntryId: 'je-aug' }];
  const input = { asOf: '2026-09-23', view: { kind: 'year' as const, year: 2026 }, entities: [ent('p', 'Alex', 'personal')], accounts: [exp('p', '6150', 'Coffee')], budgetLines: lines, postings };
  const sept = buildBudgetCell(input, { entityId: 'p', code: '6150', from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual([sept.range.state, sept.shown], ['inProgress', 'toDate']);
  assert.equal(sept.budgetLines.length, 2);
  assert.ok(sept.budgetLines[0] === lines[0] && sept.budgetLines[1] === lines[1], 'the to-date lines, the very objects — not the 25th\'s');
  assert.ok(sept.postings.length === 1 && sept.postings[0] === postings[0], 'the posting in range, the very object');
  assert.deepEqual(sept.cell, { budgetFull: 1700, budgetToDate: 1000, actual: 450, variance: 550 });
  // The same range as a column of the report prints the same cell — one function.
  const report = buildBudgetReport(input);
  assert.deepEqual(report.books[0].rows[0].cells[8], sept.cell, 'September in the report');
  const future = buildBudgetCell(input, { entityId: 'p', code: '6150', from: '2026-09-24', to: '2026-09-30' });
  assert.deepEqual([future.range.state, future.shown, future.budgetLines.length, future.postings.length], ['future', 'full', 1, 0]);
  assert.ok(future.budgetLines[0] === lines[2]);
  const closed = buildBudgetCell(input, { entityId: 'p', code: '6150', from: '2026-08-01', to: '2026-08-31' });
  assert.deepEqual([closed.range.state, closed.shown, closed.budgetLines.length, closed.postings.length, closed.cell.actual], ['closed', 'toDate', 0, 1, 99]);
});

test('T4 the actuals are the ONE query both routes call — a reversal pair and a year-end close are left out of it by name', async () => {
  const seen: unknown[] = [];
  const db = { ledger_entries: { findMany: async (args: unknown) => { seen.push(args); return []; } } } as unknown as Parameters<typeof readActuals>[0];
  await readActuals(db, 'u1', ['ent-p'], '2026-01-01', '2026-09-23');
  const where = (seen[0] as { where: { account: unknown; journal_entry: Record<string, unknown> } }).where;
  assert.deepEqual(where.account, { entity_id: { in: ['ent-p'] }, entity: { userId: 'u1' }, account_type: { in: ['revenue', 'expense'] } });
  // Evaluated over journal entries the way the where reads them: the pair and the close are out, the rest in.
  const je = where.journal_entry as { userId: string; is_reversal: boolean; reversed_by_entry_id: null; source_type: { not: string } };
  assert.deepEqual([je.userId, je.is_reversal, je.reversed_by_entry_id, je.source_type], ['u1', false, null, { not: 'year_end_close' }]);
  const entries = [
    { id: 'je-buy', is_reversal: false, reversed_by_entry_id: null as string | null, source_type: 'manual' },
    { id: 'je-buy-reversed', is_reversal: false, reversed_by_entry_id: 'je-rev', source_type: 'manual' },
    { id: 'je-rev', is_reversal: true, reversed_by_entry_id: null, source_type: 'manual' },
    { id: 'je-close', is_reversal: false, reversed_by_entry_id: null, source_type: 'year_end_close' },
  ];
  const kept = entries.filter((e) => e.is_reversal === je.is_reversal && e.reversed_by_entry_id === je.reversed_by_entry_id && e.source_type !== je.source_type.not);
  assert.deepEqual(kept.map((e) => e.id), ['je-buy']);
  // Both routes read the actuals through it, and neither reads the ledger itself.
  for (const f of [REPORT_ROUTE, CELL_ROUTE]) {
    assert.match(code(f), /\breadActuals\(prisma, user\.id, /, `${f} calls the one actuals query`);
    assert.doesNotMatch(code(f), /ledger_entries/, `${f} reads no ledger line itself`);
  }
  assert.equal((code(READS).match(/ledger_entries\.findMany\(/g) ?? []).length, 1, 'one actuals query');
  // The route law's one-query clause points at the loader, with its dated note.
  const law = code('scripts/assert-tool-registry.ts');
  assert.match(law, /const BR_CELL = 'src\/app\/api\/budget\/report\/cell\/route\.ts';/);
  assert.match(law, /const BR_READS = 'src\/lib\/budget\/reportReads\.ts';/);
  assert.match(law, /const actuals = \[\.\.\.reads\.matchAll\(\/ledger_entries\\\.findMany\\\(\\\{\(\[\\s\\S\]\*\?\)select:\/g\)\];/);
  assert.match(comments('scripts/assert-tool-registry.ts'), /BUDGET-02 \(ruled by Alex 2026-10-20, ruling G\): TWO ROUTES, ONE LOADER\./);
});

test('T4 the plan lines are matched by ONE rule: dayPlanOf hands its days to planLinesOn, and the drill hands it the figure\'s days', () => {
  const src = code('src/lib/budget/planLines.ts');
  assert.match(src, /const matched = planLinesOn\(\{ days, lines: input\.lines, routines: input\.routines, tasks: input\.tasks, vendors: input\.vendors \}\);/);
  assert.match(code('src/lib/budget/reportInputs.ts'), /const matched = planLinesOn\(\{\s*days: daysOf\(cell\.range\.from, budgetThrough\),/);
  assert.equal((src.match(/readOccurrenceKey\(/g) ?? []).length, 1, 'the key is read in one place');
  // Over explicit days: a line off them is not listed; a plan holding both grains is refused by name.
  const line = { entityId: 'ent-p', code: '6150', day: '2026-09-02', cents: 500, source: 'routine' as const, sourceId: 'routine:r-coffee:routine:2026-09-02T08:00:00.000Z' };
  const words = new Map([['r-coffee', { name: 'Coffee', timezone: 'UTC', steps: new Map() }]]);
  const on = planLinesOn({ days: ['2026-09-02'], lines: [line], routines: words, tasks: new Map(), vendors: [HIGHLANDS] });
  assert.ok(on.ok && on.lines.length === 1 && on.lines[0].vendor?.name === 'Highlands');
  const off = planLinesOn({ days: ['2026-09-03'], lines: [line], routines: words, tasks: new Map(), vendors: [] });
  assert.ok(off.ok && off.lines.length === 0);
  const both = planLinesOn({ days: ['2026-09-02'], lines: [line], routines: words, tasks: new Map(), vendors: [HIGHLANDS, { ...HIGHLANDS, id: 'pv-2', occurrence_at: new Date('2026-09-02T08:00:00.000Z') }] });
  assert.ok(!both.ok && both.code === 'plan-vendor-both-grains');
});

test('T4 the panel: one open at a time, a second click closes it, a figure is a keyboard-reachable button, and it says whether it matches the cell', () => {
  const s = code(SCREEN);
  assert.match(s, /const \[opened, setOpened\] = useState<Opened \| null>\(null\);/);
  assert.match(s, /const toggle = \(o: Opened\) => setOpened\(\(current\) => \(sameOpen\(current, o\) \? null : o\)\);/, 'the same figure again closes; another opens in its place');
  assert.match(s, /<button type="button" className=\{figureButton\} aria-expanded=\{expanded\} aria-label=\{label\} onClick=\{toggle\}>/, 'a native button: focusable, Enter and Space');
  assert.match(s, /if \(cents === null\) return <>\{text\}<\/>;/, 'a blank is not a figure — nothing to open');
  assert.match(s, /focus-visible:ring-2/);
  assert.match(s, /const verdict = agreement\(b\.sum, clicked\);/);
  assert.match(s, /const verdict = agreement\(a\.sum, clicked\);/);
  assert.match(s, /Lists \{budgetDrillWords\(b\)\}\./, 'says which Budget figure it lists');
  assert.match(s, /<Link href=\{l\.href\} className="underline" data-drill-plan-link=\{l\.source\}>\{l\.label\}<\/Link>/);
  assert.match(s, /<Link href=\{ledgerHref\(opened\.code, opened\.book, a\.from, a\.through\)\} className="text-sm underline" data-drill-open-books>/);
  assert.match(s, /clicked=\{open\.figure === 'actual' \? openCell\.actual : shownBudget\(openColumn\.state\) === 'full' \? openCell\.budgetFull : openCell\.budgetToDate\}/, 'compared with the figure the viewer clicked');
  assert.equal((s.match(/\bfetch\(/g) ?? []).length, 1, 'one reader for the report and the drill; no write');
});

// ── T5 · /ledger READS ITS PARAMS ────────────────────────────────────────────

test('T5 /ledger carries account, book, from and to — and nothing else — to /books; with none, the hop it always was', () => {
  const p = code(LEDGER_PAGE);
  assert.match(p, /const LEDGER_KEYS = \['account', 'book', 'from', 'to'\] as const;/);
  assert.match(p, /for \(const key of LEDGER_KEYS\) \{/);
  assert.match(p, /if \(forward\.toString\(\) === ''\) redirect\('\/books'\);\s*redirect\(`\/books\?\$\{forward\.toString\(\)\}`\);/);
  assert.deepEqual([...LEDGER_LINK_KEYS], ['account', 'book', 'from', 'to'], 'Books reads the same four');
});

test('T5 Books reads the link once: the ledger\'s phase opens, the keys leave the URL by replaceState, and the ledger takes the filters', () => {
  const b = code(BOOKS);
  assert.match(b, /const search = new URLSearchParams\(window\.location\.search\);\s*const link = ledgerLinkOf\(search\);\s*if \(link === null\) return;\s*setLedgerLink\(link\);\s*setPhase\('code'\);/);
  assert.match(b, /for \(const key of LEDGER_LINK_KEYS\) search\.delete\(key\);/);
  // Read in the room that stays: RoomLock renders the room locked until its read lands, then remounts it unlocked.
  assert.match(b, /const roomLocked = useRoomLock\(\);/);
  assert.match(b, /useEffect\(\(\) => \{\s*if \(roomLocked\) return;\s*const search = new URLSearchParams\(window\.location\.search\);/);
  assert.match(b, /\}, \[roomLocked\]\);/);
  assert.match(b, /window\.history\.replaceState\(null, '', `\$\{window\.location\.pathname\}\$\{rest === '' \? '' : `\?\$\{rest\}`\}\$\{window\.location\.hash\}`\);/);
  assert.match(b, /<GeneralLedger coaOptions=\{coaOptions\} onReload=\{reloadAll\} link=\{ledgerLink\} onLinkUsed=\{ledgerLinkUsed\} \/>/);
  // GeneralLedger: dates, the book, then the account through the report's ONE code reader.
  const g = code(GL);
  assert.match(g, /import \{ readChartCode \} from '@\/lib\/budget\/reportInputs';/);
  assert.match(g, /if \(link\.from !== null\) setDateFrom\(link\.from\);\s*if \(link\.to !== null\) setDateTo\(link\.to\);/);
  assert.match(g, /else \{ book = found; setSelectedEntityId\(found\.id\); \}/);
  assert.match(g, /const want = readChartCode\(account, entity\);/);
  assert.match(g, /const reads = \(saved: string\): boolean => \{ const r = readChartCode\(saved, entity\); return r\.ok && r\.code === want\.code; \};/);
  assert.match(g, /if \(hits\.length === 1\) \{ setSelectedCode\(hits\[0\]\.accountCode\); return; \}/, 'the account as the ledger saved it — "B-5100" matches 5100');
  assert.match(g, /onLinkUsed\(\);/);
});

test('T5 an unknown book or account is said in words, never a silent no-op; a key named twice or a non-day is not used, and said', () => {
  const g = code(GL);
  for (const words of [
    'This link names a book that is not one of your books — the ledger shows every book.',
    "Your books could not be read — this link\\'s book cannot be found.",
    'without a book of yours — an account is read within its book.',
    'has no ledger lines in ${book.name}.',
    "is not an active account of ${book.name}'s chart, and has no ledger lines.",
  ]) assert.ok(g.includes(words), words);
  assert.match(g, /\{linkWords\.map\(\(w\) => <p key=\{w\} className="px-2 py-1 text-terminal-base text-brand-red" data-ledger-link-words>\{w\}<\/p>\)\}/);
  assert.equal(ledgerLinkOf(new URLSearchParams('tab=books')), null, 'no link key → no link');
  assert.deepEqual(ledgerLinkOf(new URLSearchParams('account=5100&book=ent-b&from=2026-09-01&to=2026-09-23')), { account: '5100', book: 'ent-b', from: '2026-09-01', to: '2026-09-23', words: [] });
  assert.deepEqual(ledgerLinkOf(new URLSearchParams('account=5100&account=6100&from=Sept')), {
    account: null, book: null, from: null, to: null,
    words: ['This link names account 2 times — it is not used.', 'This link\'s from "Sept" is not a day (YYYY-MM-DD) — it is not used.'],
  });
});

// ── T6 · NO SUB-ROWS ─────────────────────────────────────────────────────────

test('T6 Budget\'s registry row links nothing — no sub-row on the rail — with a dated note', () => {
  const budget = TOOL_REGISTRY.find((t) => t.name === 'Budget');
  assert.ok(budget);
  assert.deepEqual(budget.links, []);
  assert.deepEqual(navToolByName('Budget', TOOL_GATE).subRows, []);
  assert.match(comments('src/lib/toolRegistry.ts'), /BUDGET-02 \(Alex, ruling H, 2026-10-20\): Budget is ONE page — no sub-rows\./);
  assert.equal(budget.home, '/budget');
  assert.equal(budget.status, 'PARTIAL', 'the census does not move');
});

// ── T7 · THE REDIRECTS ───────────────────────────────────────────────────────

test('T7 the five pages are dated /trading-idiom redirects to /budget — no UI, no state, no next.config rule', () => {
  const idiom = /^import \{ redirect \} from 'next\/navigation';\s*export default function \w+\(\) \{\s*redirect\('\/budget'\);\s*\}\s*$/;
  for (const page of ['src/app/agenda/page.tsx', 'src/app/agenda/new/page.tsx', 'src/app/agenda/[id]/page.tsx', 'src/app/shopping/page.tsx', 'src/app/hub/itinerary/page.tsx']) {
    assert.match(code(page), idiom, `${page}: the redirect and nothing else`);
    assert.match(comments(page), /BUDGET-02 \(Alex, ruling H, 2026-10-20\)/, `${page}: dated`);
  }
  assert.match(code('src/app/trading/page.tsx'), /^import \{ redirect \} from 'next\/navigation';\s*export default function TradingRedirect\(\) \{\s*redirect\('\/brokerage'\);\s*\}\s*$/, 'the idiom they follow');
  assert.doesNotMatch(code('next.config.ts'), /'\/agenda|'\/shopping|'\/hub\/itinerary/, 'no next.config rule');
});
