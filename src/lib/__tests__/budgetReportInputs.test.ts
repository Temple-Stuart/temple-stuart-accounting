import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asOfWindow, budgetReportResponse, parseReportQuery, toPosting, toReportAccount, toReportEntity, toRoutinePlanInput,
  toTaskPlanInput, utcDay, BudgetInputError,
  type BudgetInputErrorCode, type ChartRow, type EntityRow, type LedgerRow, type QueryRefusalCode, type ReportRows,
  type RoutineRow, type TaskRow,
} from '../budget/reportInputs';
import { BudgetReportError, type BudgetReportErrorCode } from '../budget/report';
import { BudgetDaysError, EXCLUDED_TASK_STATUSES } from '../budget/days';
import { code } from '../sourceText';

// TAB13-02b — the budget report route's pure half: the query, every row →
// input mapping, and the response. Expected figures are integer cents, worked
// by hand beside them. This file imports nothing from @prisma/client: a
// Decimal is anything with a toString(), a @db.Date is a Date at UTC midnight.

const INPUTS = 'src/lib/budget/reportInputs.ts';
const at = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dec = (s: string) => ({ toString: () => s });
const q = (params: Record<string, string>) => new URLSearchParams(params);
const inputThrows = (fn: () => unknown, c: BudgetInputErrorCode, mentions?: string) =>
  assert.throws(fn, (e: unknown) => e instanceof BudgetInputError && e.code === c && (mentions === undefined || e.message.includes(mentions)), `throws BudgetInputError ${c}`);
const refusal = (params: Record<string, string>, today: string, c: QueryRefusalCode) => {
  const parsed = parseReportQuery(q(params), today);
  assert.equal(parsed.ok, false, `${JSON.stringify(params)} is refused`);
  if (parsed.ok) return '';
  assert.equal(parsed.refusal.error, c);
  return parsed.refusal.message;
};

// ── THE QUERY ───────────────────────────────────────────────────────────────

test('QUERY — a day, a week and a year view each parse, with the viewer\'s asOf', () => {
  assert.deepEqual(parseReportQuery(q({ view: 'day', day: '2026-09-23', asOf: '2026-09-23' }), '2026-09-23'), { ok: true, view: { kind: 'day', day: '2026-09-23' }, asOf: '2026-09-23' });
  assert.deepEqual(parseReportQuery(q({ view: 'week', weekOf: '2026-09-21', asOf: '2026-09-22' }), '2026-09-23'), { ok: true, view: { kind: 'week', weekOf: '2026-09-21' }, asOf: '2026-09-22' });
  assert.deepEqual(parseReportQuery(q({ view: 'year', year: '2025', asOf: '2026-09-24' }), '2026-09-23'), { ok: true, view: { kind: 'year', year: 2025 }, asOf: '2026-09-24' });
});

test('QUERY — each bad parameter is refused by its own name', () => {
  const today = '2026-09-23';
  assert.match(refusal({ day: '2026-09-23', asOf: today }, today, 'bad-view'), /view null is not day, week or year/);
  assert.match(refusal({ view: 'month', asOf: today }, today, 'bad-view'), /"month"/);
  assert.match(refusal({ view: 'day', asOf: today }, today, 'bad-day'), /view=day needs day=YYYY-MM-DD/);
  assert.match(refusal({ view: 'day', day: '2026-02-30', asOf: today }, today, 'bad-day'), /"2026-02-30"/);
  assert.match(refusal({ view: 'day', day: '2026-13-01', asOf: today }, today, 'bad-day'), /"2026-13-01"/);
  assert.match(refusal({ view: 'week', day: '2026-09-21', asOf: today }, today, 'bad-weekOf'), /view=week needs weekOf=YYYY-MM-DD/);
  assert.match(refusal({ view: 'year', year: '26', asOf: today }, today, 'bad-year'), /"26"/);
  assert.match(refusal({ view: 'year', year: '0000', asOf: today }, today, 'bad-year'), /"0000"/);
  assert.match(refusal({ view: 'year', year: '2026.5', asOf: today }, today, 'bad-year'), /"2026.5"/);
  assert.match(refusal({ view: 'year', year: '2026' }, today, 'bad-asOf'), /asOf null/);
  assert.match(refusal({ view: 'year', year: '2026', asOf: '23/09/2026' }, today, 'bad-asOf'), /viewer's local date/);
});

test('QUERY — asOf is the server\'s UTC date or a day either side; two days off is refused, naming the three', () => {
  const today = '2026-09-23';
  for (const asOf of ['2026-09-22', '2026-09-23', '2026-09-24']) {
    assert.equal(parseReportQuery(q({ view: 'day', day: '2026-09-01', asOf }), today).ok, true, `${asOf} is accepted`);
  }
  for (const asOf of ['2026-09-21', '2026-09-25', '2025-09-23']) {
    const message = refusal({ view: 'day', day: '2026-09-01', asOf }, today, 'asOf-outside-window');
    assert.match(message, /2026-09-22, 2026-09-23 or 2026-09-24/);
  }
  // The window crosses month and year ends, and a leap day, by calendar arithmetic.
  assert.deepEqual(asOfWindow('2026-12-31'), ['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.deepEqual(asOfWindow('2026-01-01'), ['2025-12-31', '2026-01-01', '2026-01-02']);
  assert.deepEqual(asOfWindow('2028-03-01'), ['2028-02-29', '2028-03-01', '2028-03-02']);
  inputThrows(() => asOfWindow('2026-9-23'), 'bad-server-day');
  inputThrows(() => parseReportQuery(q({ view: 'day', day: '2026-09-01', asOf: '2026-09-23' }), 'today'), 'bad-server-day');
});

// ── ROW → INPUT ─────────────────────────────────────────────────────────────

test('DATES — a @db.Date (UTC midnight) is its UTC day; an instant is its UTC day, not a local one', () => {
  assert.equal(utcDay(at('2026-09-23')), '2026-09-23');
  assert.equal(utcDay(new Date('2026-09-23T23:59:59.999Z')), '2026-09-23');
  assert.equal(utcDay(new Date('2026-09-23T23:30:00.000-05:00')), '2026-09-24');
});

const P: EntityRow = { id: 'ent-p', name: 'Alex', entity_type: 'personal' };
const B: EntityRow = { id: 'ent-b', name: 'Temple Stuart', entity_type: 'sole_prop' };

test('MAPPING — an entity, an account: every field carried, nothing renamed into something else', () => {
  assert.deepEqual(toReportEntity(B), { id: 'ent-b', name: 'Temple Stuart', entityType: 'sole_prop' });
  const chart: ChartRow = { entity_id: 'ent-b', code: '6300', name: 'Software', account_type: 'expense', balance_type: 'D' };
  assert.deepEqual(toReportAccount(chart), { entityId: 'ent-b', code: '6300', name: 'Software', accountType: 'expense', balanceType: 'D' });
});

const coffee: RoutineRow = {
  id: 'r-coffee', name: 'Coffee', budget_amount: 5, coa_code: '6150', schedule_rrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0',
  timezone: 'UTC', start_date: at('2026-09-01'), end_date: at('2026-09-22'), steps: [],
};

test('MAPPING — a routine from the loader: dates as UTC days, the entity\'s type, every line', () => {
  const lined: RoutineRow = { ...coffee, start_date: null, end_date: null, steps: [{ id: 's1', is_active: true, budget_amount: 4.25, coa_code: 'P-6150', step_order: 2 }] };
  assert.deepEqual(toRoutinePlanInput(coffee, toReportEntity(P)), {
    id: 'r-coffee', name: 'Coffee', entityId: 'ent-p', entityType: 'personal', timezone: 'UTC', scheduleRrule: coffee.schedule_rrule,
    startDate: '2026-09-01', endDate: '2026-09-22', budgetAmount: 5, coaCode: '6150', steps: [],
  });
  const mapped = toRoutinePlanInput(lined, toReportEntity(P));
  assert.equal(mapped.startDate, null, 'no start date stays null');
  assert.equal(mapped.endDate, null, 'no end date stays null');
  assert.deepEqual(mapped.steps, [{ id: 's1', isActive: true, stepOrder: 2, budgetAmount: 4.25, coaCode: 'P-6150' }]);
});

const license: TaskRow = {
  id: 't-license', title: 'Buy license', entity_id: 'ent-b', status: 'open', estimated_cost_usd: dec('120.5'), coa_code: '6300',
  daily_plan_items: [{ plan_date: at('2026-09-24'), calendar_blocks: [{ status: 'scheduled' }] }],
};

test('MAPPING — a task: the estimate as its Decimal string, EVERY plan item as a UTC day with its block statuses', () => {
  const many: TaskRow = { ...license, daily_plan_items: [
    { plan_date: at('2026-10-02'), calendar_blocks: [{ status: 'cancelled' }, { status: 'missed' }] },
    { plan_date: at('2025-01-15'), calendar_blocks: [] },
  ] };
  assert.deepEqual(toTaskPlanInput(many, toReportEntity(B)), {
    id: 't-license', title: 'Buy license', entityId: 'ent-b', entityType: 'sole_prop', status: 'open', estimatedCostUsd: '120.5', coaCode: '6300',
    planItems: [{ planDate: '2026-10-02', blocks: [{ status: 'cancelled' }, { status: 'missed' }] }, { planDate: '2025-01-15', blocks: [] }],
  });
  assert.equal(toTaskPlanInput({ ...license, estimated_cost_usd: null }, toReportEntity(B)).estimatedCostUsd, null, 'no estimate stays null, never "0"');
});

const line = (over: Partial<LedgerRow> & { journal_entry_id: string }): LedgerRow => ({
  entry_type: 'D', amount: BigInt(450), account: { entity_id: 'ent-p', code: '6150' }, journal_entry: { date: at('2026-09-21') }, ...over,
});

test('MAPPING — a ledger line: BigInt cents to a safe integer, on its ACCOUNT\'s entity, dated by its journal entry', () => {
  assert.deepEqual(toPosting(line({ journal_entry_id: 'je-1' })), { entityId: 'ent-p', code: '6150', day: '2026-09-21', entryType: 'D', cents: 450, journalEntryId: 'je-1' });
  assert.equal(toPosting(line({ journal_entry_id: 'je-max', amount: BigInt(Number.MAX_SAFE_INTEGER) })).cents, Number.MAX_SAFE_INTEGER, 'the largest safe integer passes');
  inputThrows(() => toPosting(line({ journal_entry_id: 'je-huge', amount: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1) })), 'unsafe-cents', 'je-huge');
  inputThrows(() => toPosting(line({ journal_entry_id: 'je-deep', amount: -(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)) })), 'unsafe-cents', 'je-deep');
});

// ── THE RESPONSE ────────────────────────────────────────────────────────────

// A week, Mon 2026-09-21 … Sun 2026-09-27, seen on Wednesday the 23rd.
const WEEK = { view: { kind: 'week' as const, weekOf: '2026-09-23' }, asOf: '2026-09-23' };

const rows = (over: Partial<ReportRows> = {}): ReportRows => ({
  entities: [B, P],
  chart: [
    { entity_id: 'ent-p', code: '6150', name: 'Coffee', account_type: 'expense', balance_type: 'D' },
    { entity_id: 'ent-p', code: '4000', name: 'Salary', account_type: 'revenue', balance_type: 'C' },
    { entity_id: 'ent-p', code: '1010', name: 'Checking', account_type: 'asset', balance_type: 'D' },
    { entity_id: 'ent-b', code: '6300', name: 'Software', account_type: 'expense', balance_type: 'D' },
  ],
  routines: [
    { entityId: 'ent-p', rows: [coffee, { ...coffee, id: 'r-bad-zone', name: 'Bad zone', timezone: 'Mars/Olympus' }] },
    { entityId: 'ent-b', rows: [] },
  ],
  tasks: [
    license,
    { ...license, id: 't-cancelled', title: 'Cancelled', status: 'cancelled', estimated_cost_usd: dec('30.00') },
    { ...license, id: 't-undated', title: 'Undated', estimated_cost_usd: dec('7.00'), daily_plan_items: [] },
  ],
  ledger: [
    line({ journal_entry_id: 'je-1' }),
    line({ journal_entry_id: 'je-2', entry_type: 'C', amount: BigInt(100000), account: { entity_id: 'ent-p', code: '4000' }, journal_entry: { date: at('2026-09-22') } }),
  ],
  excludedLines: { reversalPairLines: 2, closingEntryLines: 1, linesAfterAsOf: 3 },
  bank: [
    { id: 'tx-1', date: at('2026-09-21'), amount: 12.34 },
    { id: 'tx-2', date: at('2026-09-23'), amount: -50 },
  ],
  ...over,
});

test('RESPONSE — the report from the rows: books P then B, revenue before expense, each cell by hand', () => {
  const r = budgetReportResponse(WEEK, rows());
  assert.equal(r.asOf, '2026-09-23');
  assert.deepEqual(r.view, { kind: 'week', weekOf: '2026-09-23' });
  assert.deepEqual(r.report.columns.map((c) => `${c.label}:${c.state}`), [
    'WEEK:inProgress', 'Mon:closed', 'Tue:closed', 'Wed:closed', 'Thu:future', 'Fri:future', 'Sat:future', 'Sun:future',
  ]);
  assert.deepEqual(r.report.books.map((b) => `${b.label} · ${b.entityName}`), ['PERSONAL · Alex', 'BUSINESS · Temple Stuart']);
  const [personal, business] = r.report.books;
  assert.deepEqual(personal.rows.map((x) => x.code), ['4000', '6150'], 'revenue before expense; the asset account makes no row');
  // Coffee: $5.00 a day from the 1st, ending the 22nd → Mon 500 + Tue 500 = 1000. Posted $4.50 on Monday.
  const coffeeWeek = personal.rows[1].cells[0];
  assert.deepEqual(coffeeWeek, { budgetFull: 1000, budgetToDate: 1000, actual: 450, variance: 550 });
  assert.deepEqual(personal.rows[1].cells[1], { budgetFull: 500, budgetToDate: 500, actual: 450, variance: 50 });
  // Salary: no budget, $1,000.00 posted Tuesday → no variance.
  assert.deepEqual(personal.rows[0].cells[0], { budgetFull: null, budgetToDate: null, actual: 100000, variance: null });
  // The license: $120.50 planned for Thursday — in the week's full budget, not yet to date.
  assert.deepEqual(business.rows[0].cells[0], { budgetFull: 12050, budgetToDate: null, actual: null, variance: null });
  assert.deepEqual(business.rows[0].cells[4], { budgetFull: 12050, budgetToDate: null, actual: null, variance: null }, 'Thursday is future: its budget, no actual');
  // NET is strict: income has no budget, so the net budget is blank.
  assert.equal(r.report.totals[0].net.budgetToDate, null);
  assert.equal(r.report.totals[0].net.actual, 100000 - 450);
});

test('RESPONSE — completeness: not placed, excluded ALL TIME, not in the books per column, left out by name, record counts, travel', () => {
  const r = budgetReportResponse(WEEK, rows());
  assert.deepEqual(r.notPlaced.map((n) => `${n.source}:${n.label}:${n.day === null ? 'undated' : n.day}:${n.reason}:${n.cents === null ? '—' : n.cents}`), [
    'routine:Bad zone:undated:timezone not recognised:—',
    'task:Undated:undated:not on the calendar:700',
  ]);
  assert.equal(r.excludedTasks.scope, 'ALL TIME');
  assert.deepEqual(r.excludedTasks.byStatus.map((s) => s.status), [...EXCLUDED_TASK_STATUSES], 'all four statuses, always');
  assert.deepEqual(r.excludedTasks.byStatus.find((s) => s.status === 'cancelled'), { status: 'cancelled', tasks: 1, cents: 3000 });
  // Bank: $12.34 out Monday, $50.00 in Wednesday (Plaid: outflows positive) → week 1234 − 5000 = −3766.
  assert.equal(r.notInBooks.basis, 'bank');
  assert.equal(r.notInBooks.sign, 'Plaid signs outflows positive');
  assert.deepEqual(r.notInBooks.columns.map((c) => [c.label, c.through, c.transactions, c.bankCents]), [
    ['WEEK', '2026-09-23', 2, -3766],
    ['Mon', '2026-09-21', 1, 1234],
    ['Tue', '2026-09-22', 0, null],
    ['Wed', '2026-09-23', 1, -5000],
    ['Thu', null, null, null],
    ['Fri', null, null, null],
    ['Sat', null, null, null],
    ['Sun', null, null, null],
  ]);
  assert.deepEqual(r.excludedLines, { reversalPairLines: 2, closingEntryLines: 1, linesAfterAsOf: 3 }, 'the route\'s counts, carried as read');
  assert.deepEqual(r.records, { entities: 2, accounts: 4, routines: 2, costedTasks: 3, ledgerLines: 2, bankRows: 2, budgetLines: { routine: 2, task: 1 } });
  assert.equal(r.travelBudgets, 'not connected');
});

test('RESPONSE — a DAY view: MTD then the day; bank rows before the day count in MTD only', () => {
  const r = budgetReportResponse({ view: { kind: 'day', day: '2026-09-22' }, asOf: '2026-09-23' }, rows({
    bank: [{ id: 'tx-1', date: at('2026-09-01'), amount: 10 }, { id: 'tx-2', date: at('2026-09-22'), amount: 2.5 }],
  }));
  assert.deepEqual(r.notInBooks.columns.map((c) => [c.label, c.from, c.through, c.transactions, c.bankCents]), [
    ['MTD', '2026-09-01', '2026-09-22', 2, 1250],
    ['Tue', '2026-09-22', '2026-09-22', 1, 250],
  ]);
});

test('FAIL LOUD — a row that cannot become an input is refused by name; the model and the day rules refuse through', () => {
  inputThrows(() => budgetReportResponse(WEEK, rows({ tasks: [{ ...license, entity_id: 'ent-x' }] })), 'unknown-entity', 'task t-license');
  inputThrows(() => budgetReportResponse(WEEK, rows({ routines: [{ entityId: 'ent-x', rows: [coffee] }] })), 'unknown-entity', 'ent-x');
  inputThrows(() => budgetReportResponse(WEEK, rows({ bank: [{ id: 'tx-odd', date: at('2026-09-21'), amount: 12.344 }] })), 'bank-amount-not-cents', 'tx-odd');
  inputThrows(() => budgetReportResponse(WEEK, rows({ bank: [{ id: 'tx-late', date: at('2026-09-24'), amount: 1 }] })), 'bank-row-outside-range', 'tx-late');
  inputThrows(() => budgetReportResponse(WEEK, rows({ bank: [{ id: 'tx-early', date: at('2026-09-20'), amount: 1 }] })), 'bank-row-outside-range', 'tx-early');
  inputThrows(() => budgetReportResponse(WEEK, rows({ ledger: [line({ journal_entry_id: 'je-huge', amount: BigInt(2) ** BigInt(60) })] })), 'unsafe-cents', 'je-huge');
  const reportThrows = (over: Partial<ReportRows>, c: BudgetReportErrorCode) =>
    assert.throws(() => budgetReportResponse(WEEK, rows(over)), (e: unknown) => e instanceof BudgetReportError && e.code === c, `BudgetReportError ${c}`);
  reportThrows({ ledger: [line({ journal_entry_id: 'je-neg', amount: BigInt(-5) })] }, 'negative-posting-cents');
  reportThrows({ ledger: [line({ journal_entry_id: 'je-x', entry_type: 'X' })] }, 'bad-entry-type');
  reportThrows({ chart: [{ entity_id: 'ent-p', code: '6150', name: 'Coffee', account_type: 'expense', balance_type: 'X' }] }, 'bad-balance-type');
  reportThrows({ chart: [{ entity_id: 'ent-p', code: 'P-6150', name: 'Coffee', account_type: 'expense', balance_type: 'D' }] }, 'code-not-four-digits');
  assert.throws(() => budgetReportResponse(WEEK, rows({ tasks: [{ ...license, status: 'done' }] })), (e: unknown) => e instanceof BudgetDaysError && e.code === 'bad-task-status');
});

// ── PURITY ──────────────────────────────────────────────────────────────────

test('PURITY — the route\'s pure half imports no database client, framework or network, and reads no clock and no environment', () => {
  const src = code(INPUTS);
  assert.doesNotMatch(src, /['"]@prisma\/client/);
  assert.doesNotMatch(src, /from\s+['"]next(\/|['"])/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /\bDate\.now\s*\(/);
  assert.doesNotMatch(src, /\bnew\s+Date\s*\(\s*\)/);
  assert.doesNotMatch(src, /\bprocess\.env\b/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetReportInputs.test.ts'), /['"]@prisma\/client/);
});
