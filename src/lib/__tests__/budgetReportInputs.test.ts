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
import { formatAccountCode } from '../budget/format';
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
  // TAB13-02c: the code is read with the row's own book — saved "6300" or "B-6300", it is account 6300 of the B book.
  assert.deepEqual(toReportAccount(chart, toReportEntity(B)), { entityId: 'ent-b', code: '6300', name: 'Software', accountType: 'expense', balanceType: 'D' });
  assert.equal(toReportAccount({ ...chart, code: 'B-6300' }, toReportEntity(B)).code, '6300', 'saved before COA-01 with its letter — the same account');
  inputThrows(() => toReportAccount({ ...chart, code: 'P-6300' }, toReportEntity(B)), 'chart-code-unreadable', '"P-6300"');
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
  // Ruling 5 (the chat's mutant R6): the type is the ENTITY's — a sole_prop routine carries sole_prop.
  assert.deepEqual(
    (({ entityId, entityType }) => ({ entityId, entityType }))(toRoutinePlanInput(coffee, toReportEntity(B))),
    { entityId: 'ent-b', entityType: 'sole_prop' },
  );
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
  // Ruling 5: the other way round — a task of a personal entity carries personal.
  assert.deepEqual(
    (({ entityId, entityType }) => ({ entityId, entityType }))(toTaskPlanInput({ ...license, entity_id: 'ent-p' }, toReportEntity(P))),
    { entityId: 'ent-p', entityType: 'personal' },
  );
});

const line = (over: Partial<LedgerRow> & { journal_entry_id: string }): LedgerRow => ({
  entry_type: 'D', amount: BigInt(450), account: { entity_id: 'ent-p', code: '6150' }, journal_entry: { date: at('2026-09-21') }, ...over,
});

test('MAPPING — a ledger line: BigInt cents to a safe integer, on its ACCOUNT\'s entity, dated by its journal entry', () => {
  const personal = toReportEntity(P);
  assert.deepEqual(toPosting(line({ journal_entry_id: 'je-1' }), personal), { entityId: 'ent-p', code: '6150', day: '2026-09-21', entryType: 'D', cents: 450, journalEntryId: 'je-1' });
  assert.equal(toPosting(line({ journal_entry_id: 'je-max', amount: BigInt(Number.MAX_SAFE_INTEGER) }), personal).cents, Number.MAX_SAFE_INTEGER, 'the largest safe integer passes');
  inputThrows(() => toPosting(line({ journal_entry_id: 'je-huge', amount: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1) }), personal), 'unsafe-cents', 'je-huge');
  inputThrows(() => toPosting(line({ journal_entry_id: 'je-deep', amount: -(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)) }), personal), 'unsafe-cents', 'je-deep');
  // TAB13-02c: the account's code is read by the same rule, with the account's own book.
  assert.equal(toPosting(line({ journal_entry_id: 'je-lettered', account: { entity_id: 'ent-p', code: 'P-6150' } }), personal).code, '6150');
  inputThrows(() => toPosting(line({ journal_entry_id: 'je-other', account: { entity_id: 'ent-p', code: 'B-6150' } }), personal), 'chart-code-unreadable', 'je-other');
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
  assert.deepEqual(r.notInBooks.columns.map((c) => [c.label, c.through, c.transactions, c.bankCents, c.notTotalled]), [
    ['WEEK', '2026-09-23', 2, -3766, 0],
    ['Mon', '2026-09-21', 1, 1234, 0],
    ['Tue', '2026-09-22', 0, null, 0],
    ['Wed', '2026-09-23', 1, -5000, 0],
    ['Thu', null, null, null, null],
    ['Fri', null, null, null, null],
    ['Sat', null, null, null, null],
    ['Sun', null, null, null, null],
  ]);
  assert.deepEqual(r.notInBooks.notTotalled, [], 'every bank row is whole cents — none left out');
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

// Ruled 2026-09-27 (ruling 10's principle): what cannot be totalled is listed, never hidden, never fatal.
test('NOT TOTALLED — a bank row whose amount is not whole cents is listed with its raw amount, left out of every total, and counted per column', () => {
  const r = budgetReportResponse(WEEK, rows({
    bank: [
      { id: 'tx-1', date: at('2026-09-21'), amount: 12.34 },
      { id: 'tx-odd', date: at('2026-09-21'), amount: 12.344 },
      { id: 'tx-aaa', date: at('2026-09-21'), amount: 0.001 },
      { id: 'tx-nan', date: at('2026-09-22'), amount: Number.NaN },
      { id: 'tx-2', date: at('2026-09-23'), amount: -50 },
      { id: 'tx-huge', date: at('2026-09-23'), amount: 1e17 },
    ],
  }));
  // The totals are the whole-cent rows only: 1234 − 5000 = −3766, exactly as with no odd rows at all.
  assert.deepEqual(r.notInBooks.columns.map((c) => [c.label, c.transactions, c.bankCents, c.notTotalled]), [
    ['WEEK', 2, -3766, 4],
    ['Mon', 1, 1234, 2],
    ['Tue', 0, null, 1],
    ['Wed', 1, -5000, 1],
    ['Thu', null, null, null],
    ['Fri', null, null, null],
    ['Sat', null, null, null],
    ['Sun', null, null, null],
  ]);
  // Listed by day then id, the amount exactly as stored — never rounded.
  assert.deepEqual(r.notInBooks.notTotalled, [
    { id: 'tx-aaa', day: '2026-09-21', amount: '0.001', detail: '0.001 is not a whole number of cents' },
    { id: 'tx-odd', day: '2026-09-21', amount: '12.344', detail: '12.344 is not a whole number of cents' },
    { id: 'tx-nan', day: '2026-09-22', amount: 'NaN', detail: 'NaN is not a finite amount' },
    { id: 'tx-huge', day: '2026-09-23', amount: '100000000000000000', detail: '100000000000000000 is past the safe integer range of cents' },
  ]);
  assert.equal(r.records.bankRows, 6, 'every row read is counted as read');
  // A row outside the range is still the route's bug — a 500 by name, even when its amount is odd too.
  inputThrows(() => budgetReportResponse(WEEK, rows({ bank: [{ id: 'tx-late-odd', date: at('2026-09-24'), amount: 12.344 }] })), 'bank-row-outside-range', 'tx-late-odd');
});

// Ruling 5 (the chat's mutant R6): the entity's type decides which letter a code may carry — pinned on both plans.
test('BOOK — each plan carries its OWN entity\'s type: a B- code places on a sole_prop book and is refused on a personal one, in the chart\'s words, for routines and tasks', () => {
  const saas: RoutineRow = { ...coffee, id: 'r-saas', name: 'SaaS seat', budget_amount: 2, coa_code: 'B-6300' };
  const wrongBook: RoutineRow = { ...coffee, id: 'r-wrong', name: 'Wrong book', coa_code: 'B-6150' };
  const r = budgetReportResponse(WEEK, rows({
    routines: [{ entityId: 'ent-b', rows: [saas] }, { entityId: 'ent-p', rows: [wrongBook] }],
    tasks: [{ ...license, coa_code: 'B-6300' }, { ...license, id: 't-p', title: 'Personal on B', entity_id: 'ent-p', coa_code: 'B-6150' }],
  }));
  // SaaS seat: $2.00 Mon + Tue (ends the 22nd) = 400, to date; the license $120.50 on Thursday joins the full week.
  const business = r.report.books.find((b) => b.entityId === 'ent-b');
  assert.ok(business);
  assert.deepEqual(business.rows.map((x) => [x.code, x.cells[0].budgetFull, x.cells[0].budgetToDate]), [['6300', 400 + 12050, 400]]);
  // The same letter on a personal entity is another book's — listed, never placed. TAB13-02d: the reason was
  // 'code names another book' (the deleted copy's); it is now the chart's refusal, in the chart's words.
  const otherBook = '"B-6150" — code B-6150 carries the B- letter; this is a P- chart (personal) — enter P-6150 or 6150';
  assert.deepEqual(
    r.notPlaced.filter((n) => n.reason === 'account code not recognised').map((n) => `${n.source}:${n.label}:${n.day}:${n.cents}:${n.detail}`),
    [
      `routine:Wrong book:2026-09-21:500:${otherBook}`,
      `routine:Wrong book:2026-09-22:500:${otherBook}`,
      `task:Personal on B:2026-09-24:12050:${otherBook}`,
    ],
  );
});

test('FAIL LOUD — a row that cannot become an input is refused by name; the model and the day rules refuse through', () => {
  inputThrows(() => budgetReportResponse(WEEK, rows({ tasks: [{ ...license, entity_id: 'ent-x' }] })), 'unknown-entity', 'task t-license');
  inputThrows(() => budgetReportResponse(WEEK, rows({ routines: [{ entityId: 'ent-x', rows: [coffee] }] })), 'unknown-entity', 'ent-x');
  inputThrows(() => budgetReportResponse(WEEK, rows({ bank: [{ id: 'tx-late', date: at('2026-09-24'), amount: 1 }] })), 'bank-row-outside-range', 'tx-late');
  inputThrows(() => budgetReportResponse(WEEK, rows({ bank: [{ id: 'tx-early', date: at('2026-09-20'), amount: 1 }] })), 'bank-row-outside-range', 'tx-early');
  inputThrows(() => budgetReportResponse(WEEK, rows({ ledger: [line({ journal_entry_id: 'je-huge', amount: BigInt(2) ** BigInt(60) })] })), 'unsafe-cents', 'je-huge');
  const reportThrows = (over: Partial<ReportRows>, c: BudgetReportErrorCode) =>
    assert.throws(() => budgetReportResponse(WEEK, rows(over)), (e: unknown) => e instanceof BudgetReportError && e.code === c, `BudgetReportError ${c}`);
  reportThrows({ ledger: [line({ journal_entry_id: 'je-neg', amount: BigInt(-5) })] }, 'negative-posting-cents');
  reportThrows({ ledger: [line({ journal_entry_id: 'je-x', entry_type: 'X' })] }, 'bad-entry-type');
  reportThrows({ chart: [{ entity_id: 'ent-p', code: '6150', name: 'Coffee', account_type: 'expense', balance_type: 'X' }] }, 'bad-balance-type');
  // TAB13-02c (T6): "P-6150" on the personal book was refused 'code-not-four-digits'. Under R2 it is
  // account P-6150, saved before COA-01 with its letter — it builds, as one row, 6150 of the P book.
  const lettered = budgetReportResponse(WEEK, rows({ chart: [{ entity_id: 'ent-p', code: 'P-6150', name: 'Coffee', account_type: 'expense', balance_type: 'D' }] }));
  assert.deepEqual(lettered.report.books.find((b) => b.entityId === 'ent-p')?.rows.map((r) => r.code), ['6150']);
  assert.throws(() => budgetReportResponse(WEEK, rows({ tasks: [{ ...license, status: 'done' }] })), (e: unknown) => e instanceof BudgetDaysError && e.code === 'bad-task-status');
});

// ── THE CHART AS SAVED (TAB13-02c, ruled 2026-09-27) ────────────────────────

const chartRow = (entity_id: string, code: string, name: string): ChartRow => ({ entity_id, code, name, account_type: 'expense', balance_type: 'D' });

test('READ — a sole_prop chart row saved "B-5100", a ledger line on it, and routines coded "B-5100" and "5100" land on ONE row of the B book', () => {
  const api = (id: string, amount: number, coa: string): RoutineRow => ({ ...coffee, id, name: `API ${id}`, budget_amount: amount, coa_code: coa });
  const r = budgetReportResponse(WEEK, rows({
    chart: [chartRow('ent-b', 'B-5100', 'API & Data (COGS)')],
    routines: [{ entityId: 'ent-b', rows: [api('r-lettered', 3, 'B-5100'), api('r-bare', 1, '5100')] }, { entityId: 'ent-p', rows: [] }],
    tasks: [],
    ledger: [line({ journal_entry_id: 'je-api', amount: BigInt(1000), account: { entity_id: 'ent-b', code: 'B-5100' }, journal_entry: { date: at('2026-09-21') } })],
  }));
  const business = r.report.books.find((b) => b.entityId === 'ent-b');
  assert.ok(business);
  assert.deepEqual(business.rows.map((x) => [x.code, x.name]), [['5100', 'API & Data (COGS)']], 'one account, however it was saved');
  // Both routines end the 22nd: $3.00 + $1.00 on Mon and on Tue = 400 a day. $10.00 posted Monday.
  const [week, mon, tue, wed] = business.rows[0].cells;
  assert.deepEqual(week, { budgetFull: 800, budgetToDate: 800, actual: 1000, variance: -200 });
  assert.deepEqual(mon, { budgetFull: 400, budgetToDate: 400, actual: 1000, variance: -600 });
  assert.deepEqual(tue, { budgetFull: 400, budgetToDate: 400, actual: null, variance: null });
  assert.deepEqual(wed, { budgetFull: null, budgetToDate: null, actual: null, variance: null });
  assert.deepEqual(r.notPlaced, [], 'nothing left unplaced');
  assert.deepEqual(r.report.unplaced, [], 'the posting found its account');
  // And it is SHOWN as its account string, once — never "5100", never "B-B-5100".
  assert.equal(formatAccountCode(r.report.books, business.rows[0].entityId, business.rows[0].code), 'B-5100');
});

test('ALL AT ONCE — every chart code the rule cannot read is named in ONE refusal: book, code as saved, account name, reason', () => {
  let message = '';
  inputThrows(() => {
    try {
      budgetReportResponse(WEEK, rows({ chart: [
        chartRow('ent-b', 'P-5100', 'Wrong letter'),
        chartRow('ent-p', '5100-10', 'A sub-account typed in'),
        chartRow('ent-p', '6150', 'Coffee'),
        chartRow('ent-p', '', 'Blank'),
      ] }));
    } catch (e) {
      message = e instanceof Error ? e.message : '';
      throw e;
    }
  }, 'chart-code-unreadable');
  assert.match(message, /3 chart codes cannot be read/);
  // TAB13-02d: each line carries the chart's own words (was the copy's reason alone).
  assert.ok(message.includes('Temple Stuart (sole_prop): code "P-5100", "Wrong letter" — account code not recognised: "P-5100" — code P-5100 carries the P- letter; this is a B- chart (sole_prop) — enter B-5100 or 5100'), message);
  assert.ok(message.includes('Alex (personal): code "5100-10", "A sub-account typed in" — account code not recognised: "5100-10" — code "5100-10" is not in the scheme — four digits (6250) or the entity letter and four digits (B-6250)'), message);
  assert.ok(message.includes('Alex (personal): code "", "Blank" — no account: ""'), message);
  assert.ok(!message.includes('Coffee'), 'a row that reads is not named');
});

test('NO LETTER — a book whose entity type has no letter cannot carry one: "B-5100" there is refused; "5100" builds and shows bare', () => {
  const L: EntityRow = { id: 'ent-l', name: 'Holdings', entity_type: 'llc' };
  // TAB13-02d: the chart's words (was 'code names another book').
  inputThrows(() => budgetReportResponse(WEEK, rows({ entities: [B, P, L], chart: [chartRow('ent-l', 'B-5100', 'API')] })), 'chart-code-unreadable', 'Holdings (llc): code "B-5100", "API" — account code not recognised: "B-5100" — this entity (llc) has no code letter — enter the four digits only');
  const r = budgetReportResponse(WEEK, rows({
    entities: [B, P, L],
    chart: [chartRow('ent-l', '5100', 'API')],
    ledger: [line({ journal_entry_id: 'je-l', account: { entity_id: 'ent-l', code: '5100' } })],
  }));
  const holdings = r.report.books.find((b) => b.entityId === 'ent-l');
  assert.ok(holdings);
  assert.equal(formatAccountCode(r.report.books, 'ent-l', holdings.rows[0].code), '5100', 'no letter drawn — the renderer\'s own rule, never a guessed one');
});

test('COLLIDE — two rows of one book that are one account are never merged: every pair named, codes as saved; the same digits in two books are two accounts', () => {
  let message = '';
  inputThrows(() => {
    try {
      budgetReportResponse(WEEK, rows({ chart: [chartRow('ent-b', '5100', 'API'), chartRow('ent-b', 'B-5100', 'API & Data (COGS)')] }));
    } catch (e) {
      message = e instanceof Error ? e.message : '';
      throw e;
    }
  }, 'chart-codes-collide');
  assert.ok(message.includes('1 pair of chart rows are one account in one book'), message);
  assert.ok(message.includes('Temple Stuart (sole_prop): code "5100", "API" and code "B-5100", "API & Data (COGS)"'), message);
  // Three saved forms of one account: every pair, named.
  inputThrows(() => budgetReportResponse(WEEK, rows({ chart: [chartRow('ent-b', '5100', 'a'), chartRow('ent-b', 'B-5100', 'b'), chartRow('ent-b', ' 5100 ', 'c')] })), 'chart-codes-collide', '3 pairs');
  // B-5100 and P-5100 are two accounts in two books — they build, each shown with its own letter.
  const r = budgetReportResponse(WEEK, rows({
    chart: [chartRow('ent-b', 'B-5100', 'API & Data (COGS)'), chartRow('ent-p', '5100', 'Subscriptions')],
    ledger: [
      line({ journal_entry_id: 'je-b', account: { entity_id: 'ent-b', code: 'B-5100' } }),
      line({ journal_entry_id: 'je-p', account: { entity_id: 'ent-p', code: '5100' } }),
    ],
  }));
  const shown = r.report.books.flatMap((b) => b.rows.map((x) => formatAccountCode(r.report.books, x.entityId, x.code)));
  assert.deepEqual(shown, ['P-5100', 'B-5100'], 'books P then B, each account with its own letter');
});

// T4 — THE PAGE (TAB13-02d, ruled 2026-09-27): the chart's rows are read by the chart's rule, like every code.
test('ONE RULE ON THE PAGE — a chart row saved "b-5100" is account B-5100; one saved "0100" is refused in the chart\'s words', () => {
  const r = budgetReportResponse(WEEK, rows({
    chart: [chartRow('ent-b', 'b-5100', 'API & Data (COGS)')],
    ledger: [line({ journal_entry_id: 'je-lower', account: { entity_id: 'ent-b', code: 'b-5100' } })],
  }));
  const business = r.report.books.find((b) => b.entityId === 'ent-b');
  assert.ok(business);
  assert.deepEqual(business.rows.map((x) => [x.code, x.name]), [['5100', 'API & Data (COGS)']], 'one row, read as the chart reads it');
  assert.equal(business.rows[0].cells[1].actual, 450, 'the ledger line on it lands on it');
  assert.equal(formatAccountCode(r.report.books, business.rows[0].entityId, business.rows[0].code), 'B-5100');
  // And the two saved forms are one account: "b-5100" beside "5100" collides, as "B-5100" beside "5100" does.
  inputThrows(() => budgetReportResponse(WEEK, rows({ chart: [chartRow('ent-b', 'b-5100', 'a'), chartRow('ent-b', '5100', 'b')] })), 'chart-codes-collide', 'code "b-5100", "a" and code "5100", "b"');
  // A leading 0 is outside every family — the chart refuses it, so the page names it in the chart's words.
  inputThrows(
    () => budgetReportResponse(WEEK, rows({ chart: [chartRow('ent-p', '0100', 'Cash on hand')] })),
    'chart-code-unreadable',
    'Alex (personal): code "0100", "Cash on hand" — account code not recognised: "0100" — code 0100 is outside every family — codes run 1000–9999',
  );
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

// ── M4 (owed since the TAB13-02c audit; ruled 2026-09-29) ───────────────────

test('M4 — a ledger line whose code is saved lettered, in an entity that is NOT rows.entities[0], is read with ITS book and placed on its account', () => {
  // The TAB13-02c mutant read every posting with the input's FIRST entity. Trading is
  // the THIRD input entity (B, P, T): read with B's book, "T-6100" would be refused.
  const T: EntityRow = { id: 'ent-t', name: 'Trading', entity_type: 'trading' };
  const r = budgetReportResponse(WEEK, rows({
    entities: [B, P, T],
    chart: [...rows().chart, { entity_id: 'ent-t', code: 'T-6100', name: 'Data feed', account_type: 'expense', balance_type: 'D' }],
    ledger: [line({ journal_entry_id: 'je-trade', amount: BigInt(2500), account: { entity_id: 'ent-t', code: 'T-6100' }, journal_entry: { date: at('2026-09-21') } })],
  }));
  assert.equal(r.report.books.findIndex((b) => b.entityId === 'ent-t'), 2, 'TRADE is the third book');
  const trade = r.report.books.find((b) => b.entityId === 'ent-t');
  assert.ok(trade);
  assert.deepEqual(trade.rows.map((x) => [x.code, x.name]), [['6100', 'Data feed']], 'read with its own book — one account, T-6100');
  assert.equal(trade.rows[0].cells[0].actual, 2500, 'placed: $25.00 posted Monday, in the WEEK column');
  assert.deepEqual(r.report.unplaced, [], 'the posting found its account');
  assert.equal(formatAccountCode(r.report.books, 'ent-t', trade.rows[0].code), 'T-6100');
  assert.equal(trade.totals[0].expense.actual, 2500, 'and its book\'s own total holds it');
});
