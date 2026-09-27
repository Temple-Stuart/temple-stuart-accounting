import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBudgetReport, BudgetReportError,
  type BudgetLine, type BudgetReport, type BudgetReportErrorCode, type BudgetReportInput, type Posting, type ReportAccount, type ReportEntity,
} from '../budget/report';
import { code } from '../sourceText';

// TAB13-01 — the budget report as a pure model. One test per rule, named for it.
// Every expected figure is integer cents, worked by hand in the comment beside it.
// This file imports nothing from @prisma/client: the model does not need it.

const MODEL = 'src/lib/budget/report.ts';
const AS_OF = '2026-09-26'; // a Saturday

const PERSONAL: ReportEntity = { id: 'ent-p', name: 'Personal', entityType: 'personal' };
const BUSINESS: ReportEntity = { id: 'ent-b', name: 'Business', entityType: 'sole_prop' };
const TRADING: ReportEntity = { id: 'ent-t', name: 'Trading', entityType: 'trading' };

const expense = (entityId: string, code: string, name: string): ReportAccount => ({ entityId, code, name, accountType: 'expense', balanceType: 'D' });
const revenue = (entityId: string, code: string, name: string): ReportAccount => ({ entityId, code, name, accountType: 'revenue', balanceType: 'C' });
const line = (entityId: string, code: string, day: string, cents: number, sourceId = 'r-1'): BudgetLine => ({ entityId, code, day, cents, source: 'routine', sourceId });
const post = (entityId: string, code: string, day: string, entryType: 'D' | 'C', cents: number, journalEntryId: string): Posting => ({ entityId, code, day, entryType, cents, journalEntryId });

const input = (over: Partial<BudgetReportInput>): BudgetReportInput => ({
  asOf: AS_OF, view: { kind: 'day', day: AS_OF }, entities: [PERSONAL], accounts: [], budgetLines: [], postings: [], ...over,
});
const rowOf = (r: BudgetReport, entityId: string, code: string) => {
  const row = r.books.flatMap((b) => b.rows).find((x) => x.entityId === entityId && x.code === code);
  assert.ok(row, `a row for ${entityId}/${code}`);
  return row;
};
const col = (r: BudgetReport, key: string) => {
  const i = r.columns.findIndex((c) => c.key === key);
  assert.ok(i >= 0, `a column ${key}`);
  return i;
};
const throwsCode = (fn: () => unknown, code: BudgetReportErrorCode) =>
  assert.throws(fn, (e: unknown) => e instanceof BudgetReportError && e.code === code, `throws BudgetReportError ${code}`);

test('R5 COLUMNS — DAY 2026-09-26: MTD [09-01 … 09-26], then the day', () => {
  const r = buildBudgetReport(input({ view: { kind: 'day', day: '2026-09-26' } }));
  assert.deepEqual(r.columns, [
    // MTD: to 09-26 ≤ asOf 09-26 → closed.
    { key: 'mtd', kind: 'mtd', label: 'MTD', from: '2026-09-01', to: '2026-09-26', state: 'closed' },
    { key: '2026-09-26', kind: 'day', label: 'Sat', from: '2026-09-26', to: '2026-09-26', state: 'closed' },
  ]);
});

test('R5 COLUMNS — WEEK of 2026-09-24 (a Thursday): WEEK [Mon 21 … Sun 27], then the seven days', () => {
  const r = buildBudgetReport(input({ view: { kind: 'week', weekOf: '2026-09-24' } }));
  // WEEK: from 21 ≤ asOf 26 < to 27 → inProgress. 21–26 ≤ asOf → closed. 27 > asOf → future.
  assert.deepEqual(r.columns.map((c) => [c.key, c.label, c.from, c.to, c.state]), [
    ['week', 'WEEK', '2026-09-21', '2026-09-27', 'inProgress'],
    ['2026-09-21', 'Mon', '2026-09-21', '2026-09-21', 'closed'],
    ['2026-09-22', 'Tue', '2026-09-22', '2026-09-22', 'closed'],
    ['2026-09-23', 'Wed', '2026-09-23', '2026-09-23', 'closed'],
    ['2026-09-24', 'Thu', '2026-09-24', '2026-09-24', 'closed'],
    ['2026-09-25', 'Fri', '2026-09-25', '2026-09-25', 'closed'],
    ['2026-09-26', 'Sat', '2026-09-26', '2026-09-26', 'closed'],
    ['2026-09-27', 'Sun', '2026-09-27', '2026-09-27', 'future'],
  ]);
  // A week that crosses a year: Thu 2026-12-31 → Mon 12-28 … Sun 2027-01-03.
  const x = buildBudgetReport(input({ asOf: '2027-01-05', view: { kind: 'week', weekOf: '2026-12-31' } }));
  assert.deepEqual([x.columns[0].from, x.columns[0].to], ['2026-12-28', '2027-01-03']);
});

test('R5 COLUMNS — YEAR 2026 with asOf 2026-09-26: YTD ends 09-26; Jan–Aug closed, Sep in progress, Oct–Dec future', () => {
  const r = buildBudgetReport(input({ view: { kind: 'year', year: 2026 } }));
  assert.deepEqual(r.columns[0], { key: 'ytd', kind: 'ytd', label: 'YTD', from: '2026-01-01', to: '2026-09-26', state: 'closed' });
  assert.deepEqual(r.columns.slice(1).map((c) => c.label), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  assert.deepEqual(r.columns.slice(1).map((c) => c.state), [
    'closed', 'closed', 'closed', 'closed', 'closed', 'closed', 'closed', 'closed', 'inProgress', 'future', 'future', 'future',
  ]);
  assert.deepEqual([r.columns[2].from, r.columns[2].to], ['2026-02-01', '2026-02-28'], 'February 2026 has 28 days');
  assert.deepEqual([r.columns[9].from, r.columns[9].to], ['2026-09-01', '2026-09-30']);
  // A leap year: February 2028 has 29 days.
  const leap = buildBudgetReport(input({ view: { kind: 'year', year: 2028 } }));
  assert.equal(leap.columns[2].to, '2028-02-29');
  // A year that begins after asOf: YTD would end at asOf, before Jan 1 — future, empty, blank.
  const next = buildBudgetReport(input({
    view: { kind: 'year', year: 2027 }, accounts: [expense('ent-p', '6200', 'Rent')], budgetLines: [line('ent-p', '6200', '2027-01-01', 200000)],
  }));
  assert.deepEqual([next.columns[0].from, next.columns[0].to, next.columns[0].state], ['2027-01-01', '2026-09-26', 'future']);
  assert.deepEqual(rowOf(next, 'ent-p', '6200').cells[0], { budgetFull: null, budgetToDate: null, actual: null, variance: null });
  // Jan 2027 is future: its full budget is known, nothing of it is to date.
  assert.deepEqual(rowOf(next, 'ent-p', '6200').cells[1], { budgetFull: 200000, budgetToDate: null, actual: null, variance: null });
});

test('R6 AS OF — 6150 Coffee, WEEK of 2026-09-21: budgetFull 2800, budgetToDate 2400, actual 2600, variance −200', () => {
  const days = ['21', '22', '23', '24', '25', '26', '27'].map((d) => `2026-09-${d}`);
  const r = buildBudgetReport(input({
    view: { kind: 'week', weekOf: '2026-09-21' },
    accounts: [expense('ent-p', '6150', 'Coffee')],
    // 400¢ budgeted every day, Mon–Sun.
    budgetLines: days.map((d) => line('ent-p', '6150', d, 400)),
    // Mon 400, Tue 450, Wed 400, Thu 400, Fri 500, Sat 450 — nothing yet on Sunday.
    postings: [400, 450, 400, 400, 500, 450].map((cents, i) => post('ent-p', '6150', days[i], 'D', cents, `je-${i}`)),
  }));
  const coffee = rowOf(r, 'ent-p', '6150');
  // WEEK: full = 7 × 400 = 2800 · to date (Mon–Sat) = 6 × 400 = 2400
  //       actual = 400+450+400+400+500+450 = 2600 · variance (expense) = 2400 − 2600 = −200
  assert.deepEqual(coffee.cells[col(r, 'week')], { budgetFull: 2800, budgetToDate: 2400, actual: 2600, variance: -200 });
  // Tue: 400 budgeted, 450 spent → 400 − 450 = −50.
  assert.deepEqual(coffee.cells[col(r, '2026-09-22')], { budgetFull: 400, budgetToDate: 400, actual: 450, variance: -50 });
  // Sun is after asOf: its budget is in budgetFull only; no actual, no variance.
  assert.deepEqual(coffee.cells[col(r, '2026-09-27')], { budgetFull: 400, budgetToDate: null, actual: null, variance: null });
  // A posting dated after asOf is a caller error, not a figure.
  throwsCode(() => buildBudgetReport(input({ view: { kind: 'week', weekOf: '2026-09-21' }, accounts: [expense('ent-p', '6150', 'Coffee')], postings: [post('ent-p', '6150', '2026-09-27', 'D', 400, 'je-sun')] })), 'posting-after-as-of');
});

test('R2 ACTUAL IS NET — a refund credited to an expense account reduces its actual: D 12000, C 3000 → 9000', () => {
  const r = buildBudgetReport(input({
    accounts: [expense('ent-p', '6400', 'Clothing'), revenue('ent-p', '4000', 'Salary')],
    postings: [
      post('ent-p', '6400', '2026-09-10', 'D', 12000, 'je-buy'),
      post('ent-p', '6400', '2026-09-12', 'C', 3000, 'je-refund'),
      // A 'C' account is credits − debits: C 500000, D 20000 (a correction) → 480000.
      post('ent-p', '4000', '2026-09-15', 'C', 500000, 'je-pay'),
      post('ent-p', '4000', '2026-09-16', 'D', 20000, 'je-fix'),
    ],
  }));
  assert.equal(rowOf(r, 'ent-p', '6400').cells[col(r, 'mtd')].actual, 9000); // 12000 − 3000
  assert.equal(rowOf(r, 'ent-p', '4000').cells[col(r, 'mtd')].actual, 480000); // 500000 − 20000
});

test('R4 VARIANCE — revenue is actual − budget (+50000); expense is budget − actual (−20000); positive is favorable', () => {
  const r = buildBudgetReport(input({
    accounts: [revenue('ent-p', '4000', 'Salary'), expense('ent-p', '6200', 'Rent')],
    budgetLines: [line('ent-p', '4000', '2026-09-15', 300000), line('ent-p', '6200', '2026-09-01', 150000)],
    postings: [post('ent-p', '4000', '2026-09-15', 'C', 350000, 'je-pay'), post('ent-p', '6200', '2026-09-01', 'D', 170000, 'je-rent')],
  }));
  const mtd = col(r, 'mtd');
  // Revenue: 350000 − 300000 = +50000 (earned more than planned — favorable).
  assert.equal(rowOf(r, 'ent-p', '4000').cells[mtd].variance, 50000);
  // Expense: 150000 − 170000 = −20000 (spent more than planned — unfavorable).
  assert.equal(rowOf(r, 'ent-p', '6200').cells[mtd].variance, -20000);
  // The model restates no null rule of its own: it calls links.ts variance().
  const src = code(MODEL);
  assert.match(src, /import \{ variance \} from '@\/lib\/calendar\/links';/);
  assert.match(src, /variance\(actual, budgetToDate\) : variance\(budgetToDate, actual\)/);
});

test('R3 BLANK IS NOT ZERO — no lines → budget null; no postings → actual null; lines or postings that sum to zero → 0', () => {
  const r = buildBudgetReport(input({
    accounts: [expense('ent-p', '6200', 'Rent'), expense('ent-p', '6300', 'Dining'), expense('ent-p', '6500', 'Gifts'), expense('ent-p', '6600', 'Parking')],
    budgetLines: [line('ent-p', '6200', '2026-09-01', 200000), line('ent-p', '6500', '2026-09-05', 0)],
    postings: [
      post('ent-p', '6300', '2026-09-20', 'D', 8000, 'je-dine'),
      // Parking: paid 500 and refunded 500 → 500 − 500 = 0, a real zero.
      post('ent-p', '6600', '2026-09-03', 'D', 500, 'je-park'),
      post('ent-p', '6600', '2026-09-04', 'C', 500, 'je-park-refund'),
    ],
  }));
  const mtd = col(r, 'mtd');
  // A budget with no postings: actual null, variance null.
  assert.deepEqual(rowOf(r, 'ent-p', '6200').cells[mtd], { budgetFull: 200000, budgetToDate: 200000, actual: null, variance: null });
  // Postings with no budget: budget null, variance null — and counted in unbudgetedActual (R10).
  assert.deepEqual(rowOf(r, 'ent-p', '6300').cells[mtd], { budgetFull: null, budgetToDate: null, actual: 8000, variance: null });
  assert.equal(r.totals[mtd].expense.unbudgetedActual, 8000 + 0, 'Dining 8000 + Parking 0 — both have actual and no budget');
  // A 0¢ line is a budget of 0, not a blank one.
  assert.equal(rowOf(r, 'ent-p', '6500').cells[mtd].budgetFull, 0);
  assert.equal(rowOf(r, 'ent-p', '6600').cells[mtd].actual, 0);
  assert.equal(Object.is(rowOf(r, 'ent-p', '6600').cells[mtd].actual, 0), true, 'a positive zero, never −0');
});

test('R7 ROWS — 6100 in the personal entity and 6100 in the sole_prop entity are two rows in two books; order P, B, revenue before expense, code ascending', () => {
  const r = buildBudgetReport(input({
    entities: [BUSINESS, PERSONAL],
    accounts: [
      expense('ent-b', '6100', 'Software'), expense('ent-p', '6100', 'Groceries'),
      revenue('ent-p', '4000', 'Salary'), expense('ent-p', '6050', 'Phone'), expense('ent-p', '6900', 'Unused'),
    ],
    budgetLines: [line('ent-b', '6100', '2026-09-02', 5000), line('ent-p', '6100', '2026-09-02', 30000), line('ent-p', '6050', '2026-09-02', 4000)],
    postings: [
      post('ent-p', '4000', '2026-09-15', 'C', 1000, 'je-1'),
      // Outside the DAY view's range [09-01 … 09-26]: no row for 6900.
      post('ent-p', '6900', '2026-08-31', 'D', 700, 'je-aug'),
    ],
  }));
  assert.deepEqual(r.books.map((b) => [b.label, b.entityId]), [['PERSONAL', 'ent-p'], ['BUSINESS', 'ent-b']]);
  assert.deepEqual(r.books[0].rows.map((x) => x.code), ['4000', '6050', '6100'], 'revenue first, then expense by code; 6900 has nothing in range');
  assert.deepEqual(r.books[1].rows.map((x) => [x.code, x.name]), [['6100', 'Software']]);
  assert.equal(rowOf(r, 'ent-p', '6100').cells[col(r, 'mtd')].budgetFull, 30000);
  assert.equal(rowOf(r, 'ent-b', '6100').cells[col(r, 'mtd')].budgetFull, 5000, 'never merged with the personal 6100');
  assert.equal(r.unplaced.length, 0, 'the out-of-range posting is outside the view, not unplaced');
});

test('R8 BOOKS — letters P, B, T from letterFor; an entity of type business is its own book with no letter, labelled with its name and type', () => {
  const truck: ReportEntity = { id: 'ent-x', name: "Maria's Food Truck", entityType: 'business' };
  const ira: ReportEntity = { id: 'ent-y', name: 'Alex IRA', entityType: 'retirement' };
  const r = buildBudgetReport(input({ entities: [truck, TRADING, ira, BUSINESS, PERSONAL] }));
  assert.deepEqual(r.books.map((b) => [b.letter, b.label]), [
    ['P', 'PERSONAL'], ['B', 'BUSINESS'], ['T', 'TRADE'],
    // No letter: each its own book, after the lettered ones, by name.
    [null, 'Alex IRA (retirement)'], [null, "Maria's Food Truck (business)"],
  ]);
  assert.equal(r.books[4].entityType, 'business');
  assert.deepEqual(r.books[4].rows, [], 'a book with no activity in the view is still a book');
});

test('R9 NOTHING IS DROPPED — a line on 9999 (not in the chart) and a line on an asset account are unplaced with their reasons, in no total', () => {
  const r = buildBudgetReport(input({
    accounts: [expense('ent-p', '6200', 'Rent'), { entityId: 'ent-p', code: '1010', name: 'Checking', accountType: 'asset', balanceType: 'D' }],
    budgetLines: [
      line('ent-p', '6200', '2026-09-01', 200000),
      line('ent-p', '9999', '2026-09-10', 1000, 'trip-9'),
      line('ent-p', '1010', '2026-09-11', 5000, 'plan-4'),
    ],
    postings: [post('ent-p', '9999', '2026-09-12', 'D', 750, 'je-nowhere')],
  }));
  assert.deepEqual(r.unplaced, [
    { kind: 'budgetLine', reason: 'not in chart', line: line('ent-p', '9999', '2026-09-10', 1000, 'trip-9') },
    { kind: 'budgetLine', reason: 'not an income or expense account', line: line('ent-p', '1010', '2026-09-11', 5000, 'plan-4') },
    { kind: 'posting', reason: 'not in chart', posting: post('ent-p', '9999', '2026-09-12', 'D', 750, 'je-nowhere') },
  ]);
  // In no total: the expense budget is Rent alone, 200000 — not 200000 + 1000 + 5000.
  const mtd = col(r, 'mtd');
  assert.equal(r.totals[mtd].expense.budgetFull, 200000);
  assert.equal(r.totals[mtd].expense.actual, null, 'the 750 posting on 9999 is in no actual');
  assert.equal(r.books[0].rows.length, 1, 'no row for 9999 or 1010');
});

test('R10 TOTALS — income, expenses and NET per column, each with its coverage and unbudgetedActual', () => {
  const r = buildBudgetReport(input({
    accounts: [revenue('ent-p', '4000', 'Salary'), expense('ent-p', '6150', 'Coffee'), expense('ent-p', '6200', 'Rent'), expense('ent-p', '6300', 'Dining')],
    budgetLines: [line('ent-p', '4000', '2026-09-15', 500000), line('ent-p', '6150', '2026-09-26', 400), line('ent-p', '6200', '2026-09-01', 200000)],
    postings: [post('ent-p', '4000', '2026-09-15', 'C', 520000, 'je-pay'), post('ent-p', '6150', '2026-09-26', 'D', 450, 'je-coffee'), post('ent-p', '6300', '2026-09-20', 'D', 8000, 'je-dine')],
  }));
  const [mtd, day] = [col(r, 'mtd'), col(r, '2026-09-26')];
  // MTD rows: Salary 500000/500000/520000/+20000 · Coffee 400/400/450/−50 · Rent 200000/200000/—/— · Dining —/—/8000/—
  assert.deepEqual(r.totals[mtd].income, {
    budgetFull: 500000, budgetToDate: 500000, actual: 520000, variance: 20000, unbudgetedActual: null,
    coverage: { rows: 1, withBudget: 1, withBudgetToDate: 1, withActual: 1, withVariance: 1 },
  });
  assert.deepEqual(r.totals[mtd].expense, {
    budgetFull: 200400,          // 400 + 200000
    budgetToDate: 200400,
    actual: 8450,                // 450 + 8000
    variance: -50,               // Coffee only — Rent and Dining have none
    unbudgetedActual: 8000,      // Dining: actual with no budget
    coverage: { rows: 3, withBudget: 2, withBudgetToDate: 2, withActual: 2, withVariance: 1 },
  });
  assert.deepEqual(r.totals[mtd].net, {
    budgetFull: 299600,          // 500000 − 200400
    budgetToDate: 299600,
    actual: 511550,              // 520000 − 8450
    variance: 19950,             // +20000 + (−50)
    unbudgetedActual: null,      // income side null → NET null (strict: no side is imputed as 0)
    coverage: { rows: 4, withBudget: 3, withBudgetToDate: 3, withActual: 3, withVariance: 2 },
  });
  // The day column: Salary has nothing on 09-26; only Coffee has figures.
  assert.deepEqual(r.totals[day].income, {
    budgetFull: null, budgetToDate: null, actual: null, variance: null, unbudgetedActual: null,
    coverage: { rows: 1, withBudget: 0, withBudgetToDate: 0, withActual: 0, withVariance: 0 },
  });
  assert.deepEqual(r.totals[day].expense.variance, -50);
  // NET needs both sides: the income side is blank, so every NET figure is blank.
  assert.deepEqual([r.totals[day].net.budgetFull, r.totals[day].net.actual, r.totals[day].net.variance], [null, null, null]);
});

test('R11 DETERMINISTIC — the same input in any order gives a deep-equal report', () => {
  const base = input({
    view: { kind: 'week', weekOf: '2026-09-21' },
    entities: [PERSONAL, BUSINESS, TRADING, { id: 'ent-z', name: 'Zeta', entityType: 'llc' }],
    accounts: [expense('ent-p', '6150', 'Coffee'), revenue('ent-p', '4000', 'Salary'), expense('ent-b', '6150', 'Team coffee'), expense('ent-t', '6000', 'Data'), expense('ent-z', '6010', 'Fees')],
    budgetLines: [
      line('ent-p', '6150', '2026-09-21', 400), line('ent-p', '6150', '2026-09-22', 400), line('ent-b', '6150', '2026-09-23', 900, 'r-2'),
      line('ent-p', '9999', '2026-09-24', 100, 'r-3'), line('ent-p', '4000', '2026-09-25', 300000, 'r-4'),
    ],
    postings: [
      post('ent-p', '6150', '2026-09-21', 'D', 400, 'je-1'), post('ent-p', '6150', '2026-09-22', 'D', 450, 'je-2'),
      post('ent-t', '6000', '2026-09-23', 'D', 1200, 'je-3'), post('ent-p', '9999', '2026-09-24', 'D', 50, 'je-4'),
      post('ent-z', '6010', '2026-09-25', 'D', 75, 'je-5'), post('ent-p', '4000', '2026-09-25', 'C', 310000, 'je-6'),
    ],
  });
  const shuffle = <T>(xs: readonly T[]): T[] => [...xs.slice(2), ...xs.slice(0, 2)].reverse();
  const shuffled: BudgetReportInput = {
    ...base,
    entities: shuffle(base.entities), accounts: shuffle(base.accounts), budgetLines: shuffle(base.budgetLines), postings: shuffle(base.postings),
  };
  assert.notDeepEqual(shuffled.postings, base.postings, 'the input really is in another order');
  assert.deepEqual(buildBudgetReport(shuffled), buildBudgetReport(base));
});

test('R12 FAIL LOUD — every bad input is refused by a named error, never coerced', () => {
  const acct = [expense('ent-p', '6150', 'Coffee')];
  // Malformed day: not 'YYYY-MM-DD', and a date that is not on the calendar.
  throwsCode(() => buildBudgetReport(input({ asOf: '2026-9-26' })), 'malformed-day');
  throwsCode(() => buildBudgetReport(input({ accounts: acct, budgetLines: [line('ent-p', '6150', '2026-02-30', 400)] })), 'malformed-day');
  // Code not four digits: a lettered code must be stripped by the caller.
  throwsCode(() => buildBudgetReport(input({ accounts: [expense('ent-p', 'P-6150', 'Coffee')] })), 'code-not-four-digits');
  throwsCode(() => buildBudgetReport(input({ accounts: acct, budgetLines: [line('ent-p', '615', '2026-09-01', 400)] })), 'code-not-four-digits');
  // Non-integer or unsafe cents.
  throwsCode(() => buildBudgetReport(input({ accounts: acct, budgetLines: [line('ent-p', '6150', '2026-09-01', 12.5)] })), 'bad-cents');
  throwsCode(() => buildBudgetReport(input({ accounts: acct, postings: [post('ent-p', '6150', '2026-09-01', 'D', 2 ** 53, 'je-big')] })), 'bad-cents');
  // Negative posting cents: direction is the entryType.
  throwsCode(() => buildBudgetReport(input({ accounts: acct, postings: [post('ent-p', '6150', '2026-09-01', 'D', -100, 'je-neg')] })), 'negative-posting-cents');
  // entryType not D/C.
  throwsCode(() => buildBudgetReport(input({ accounts: acct, postings: [{ ...post('ent-p', '6150', '2026-09-01', 'D', 100, 'je-x'), entryType: 'X' as 'D' }] })), 'bad-entry-type');
  // A posting after asOf.
  throwsCode(() => buildBudgetReport(input({ accounts: acct, postings: [post('ent-p', '6150', '2026-09-27', 'D', 100, 'je-late')] })), 'posting-after-as-of');
  // A duplicate (entityId, code) in accounts.
  throwsCode(() => buildBudgetReport(input({ accounts: [...acct, expense('ent-p', '6150', 'Coffee again')] })), 'duplicate-account');
  // An account for an entity not in entities.
  throwsCode(() => buildBudgetReport(input({ accounts: [expense('ent-ghost', '6150', 'Coffee')] })), 'account-for-unknown-entity');
});

test('R1 MONEY IS INTEGER CENTS — every figure is a safe integer; nothing is rounded; a sum that leaves the safe range fails loud', () => {
  const r = buildBudgetReport(input({
    view: { kind: 'year', year: 2026 },
    accounts: [expense('ent-p', '6150', 'Coffee')],
    // Ten 1¢ lines and three 333¢ postings: exact integers, no rounding anywhere.
    budgetLines: Array.from({ length: 10 }, (_, i) => line('ent-p', '6150', `2026-09-${String(i + 1).padStart(2, '0')}`, 1)),
    postings: [333, 333, 333].map((c, i) => post('ent-p', '6150', `2026-09-0${i + 1}`, 'D', c, `je-${i}`)),
  }));
  const sep = rowOf(r, 'ent-p', '6150').cells[col(r, '2026-09')];
  assert.deepEqual(sep, { budgetFull: 10, budgetToDate: 10, actual: 999, variance: -989 }); // 10 − 999 = −989
  const numbers: number[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'number') numbers.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(r.books);
  walk(r.totals);
  assert.ok(numbers.length > 0);
  assert.ok(numbers.every((n) => Number.isSafeInteger(n)), 'every figure is a safe integer');
  // Two safe lines whose sum is not safe: refused, never rounded.
  throwsCode(() => buildBudgetReport(input({
    accounts: [expense('ent-p', '6150', 'Coffee')],
    budgetLines: [line('ent-p', '6150', '2026-09-01', Number.MAX_SAFE_INTEGER), line('ent-p', '6150', '2026-09-02', 1)],
  })), 'unsafe-sum');
});

test('PURITY — the model imports no database client, framework or network, and reads no clock and no environment', () => {
  const src = code(MODEL);
  assert.doesNotMatch(src, /['"]@prisma\/client/);
  assert.doesNotMatch(src, /from\s+['"]next(\/|['"])/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
  assert.doesNotMatch(src, /\bDate\.now\s*\(/);
  assert.doesNotMatch(src, /\bnew\s+Date\s*\(\s*\)/);
  assert.doesNotMatch(src, /\bprocess\.env\b/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetReport.test.ts'), /['"]@prisma\/client/);
});
