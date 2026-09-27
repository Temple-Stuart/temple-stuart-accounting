import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAccountCode, formatBudget, formatCents, formatVariance, BudgetFormatError, BLANK } from '../budget/format';
import type { ColumnState } from '../budget/report';
import { code } from '../sourceText';

// TAB13-02b — how the budget report writes a figure. Every expected string is
// written by hand beside its cents. This file imports nothing from @prisma/client.

const FORMAT = 'src/lib/budget/format.ts';
const MINUS = '−';

test('CENTS — dollars and cents, thousands grouped, exact at every size', () => {
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(5), '$0.05');
  assert.equal(formatCents(50), '$0.50');
  assert.equal(formatCents(100), '$1.00');
  assert.equal(formatCents(123456), '$1,234.56');
  assert.equal(formatCents(99999), '$999.99');
  assert.equal(formatCents(100000), '$1,000.00');
  assert.equal(formatCents(123456789), '$1,234,567.89');
  // The largest safe integer, written by integer arithmetic — no float rounding at the edge.
  assert.equal(formatCents(Number.MAX_SAFE_INTEGER), '$90,071,992,547,409.91');
});

test('NEGATIVE — the typographic minus (U+2212) before the dollar sign; minus zero is zero', () => {
  assert.equal(formatCents(-1200), `${MINUS}$12.00`);
  assert.equal(formatCents(-1200), '−$12.00');
  assert.notEqual(formatCents(-1200), '-$12.00', 'not a hyphen');
  assert.equal(formatCents(-5), `${MINUS}$0.05`);
  assert.equal(formatCents(-123456), `${MINUS}$1,234.56`);
  assert.equal(formatCents(-0), '$0.00');
});

test('BLANK — null is the dash, never $0.00', () => {
  assert.equal(BLANK, '—');
  assert.equal(formatCents(null), '—');
  assert.deepEqual(formatVariance(null), { text: '—', unfavourable: false });
});

test('VARIANCE — positive is favourable and plain; negative is unfavourable, in parentheses, flagged for red; zero is not flagged', () => {
  assert.deepEqual(formatVariance(1200), { text: '$12.00', unfavourable: false });
  assert.deepEqual(formatVariance(0), { text: '$0.00', unfavourable: false });
  assert.deepEqual(formatVariance(-1200), { text: '($12.00)', unfavourable: true });
  assert.deepEqual(formatVariance(-123456), { text: '($1,234.56)', unfavourable: true });
  assert.deepEqual(formatVariance(-1), { text: '($0.01)', unfavourable: true });
  assert.deepEqual(formatVariance(-0), { text: '$0.00', unfavourable: false });
});

// Ruled 2026-09-27: a future column shows the plan.
test('BUDGET LINE — closed: to date; in progress: to date, "of <full>" when it differs; future: the FULL budget, marked planned', () => {
  // Closed: the budget to date, nothing beside it — the full budget is the same days.
  assert.deepEqual(formatBudget('closed', 1000, 1000), { text: '$10.00', note: null });
  assert.deepEqual(formatBudget('closed', null, null), { text: '—', note: null });
  // In progress: to date, and the full budget when more is planned later in the column.
  assert.deepEqual(formatBudget('inProgress', 1000, 13050), { text: '$10.00', note: 'of $130.50' });
  assert.deepEqual(formatBudget('inProgress', 1000, 1000), { text: '$10.00', note: null }, 'nothing more planned — no "of"');
  assert.deepEqual(formatBudget('inProgress', null, 12050), { text: '—', note: 'of $120.50' }, 'nothing planned yet to date, the rest is still said');
  // Future: nothing is to date — the FULL budget shows, marked planned; a blank plan stays blank and unmarked.
  assert.deepEqual(formatBudget('future', null, 12050), { text: '$120.50', note: 'planned' });
  assert.deepEqual(formatBudget('future', null, -500), { text: '−$5.00', note: 'planned' }, 'a negative plan is kept, not hidden');
  assert.deepEqual(formatBudget('future', null, null), { text: '—', note: null });
  // The state decides — the same figures read three ways.
  assert.notDeepEqual(formatBudget('future', 0, 12050), formatBudget('inProgress', 0, 12050));
  assert.throws(() => formatBudget('later' as ColumnState, 0, 0), (e: unknown) => e instanceof BudgetFormatError && e.code === 'bad-state');
  assert.throws(() => formatBudget('future', null, 1.5), (e: unknown) => e instanceof BudgetFormatError && e.code === 'not-cents');
});

// TAB13-02c (ruled 2026-09-27): "I WANT THE CODES TO SHOW AS THEY SHOULD" — the same four digits exist in every book.
test('ACCOUNT — shown as its account string by the app\'s one renderer, with its book\'s entity type; no book is refused', () => {
  const books = [
    { entityId: 'b', entityType: 'sole_prop' },
    { entityId: 'p', entityType: 'personal' },
    { entityId: 't', entityType: 'trading' },
    { entityId: 'x', entityType: 'llc' },
  ];
  assert.equal(formatAccountCode(books, 'b', '5100'), 'B-5100');
  assert.equal(formatAccountCode(books, 'p', '1500'), 'P-1500');
  assert.equal(formatAccountCode(books, 't', '1500'), 'T-1500');
  assert.equal(formatAccountCode(books, 'x', '1500'), '1500', 'a type with no letter shows the bare digits — never a guessed letter');
  assert.notEqual(formatAccountCode(books, 'b', '1500'), formatAccountCode(books, 'p', '1500'), 'B-1500 and P-1500 are told apart');
  assert.throws(() => formatAccountCode(books, 'nope', '5100'), (e: unknown) => e instanceof BudgetFormatError && e.code === 'unknown-book' && e.message.includes('"nope"'));
  assert.throws(() => formatAccountCode([], 'b', '5100'), (e: unknown) => e instanceof BudgetFormatError && e.code === 'unknown-book');
});

test('ON /budget — every account the screen prints goes through formatAccountCode: the row label and both Not-placed lines, never bare digits', () => {
  const screen = code('src/components/budget/BudgetReport.tsx');
  assert.match(screen, /label=\{`\$\{formatAccountCode\(report\.books, row\.entityId, row\.code\)\} · \$\{row\.name\}`\}/, 'the row label is "<account string> · <name>"');
  assert.match(screen, /budget line on \$\{formatAccountCode\(books, l\.entityId, l\.code\)\}/, 'an unplaced budget line names its account string');
  assert.match(screen, /ledger line on \$\{formatAccountCode\(books, p\.entityId, p\.code\)\}/, 'an unplaced posting names its account string');
  assert.doesNotMatch(screen, /\$\{(row|l|p)\.code\}/, 'no account code is printed bare');
});

test('FAIL LOUD — a figure that is not a safe integer number of cents is refused by name, never written', () => {
  for (const bad of [12.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '1200' as unknown as number]) {
    assert.throws(() => formatCents(bad), (e: unknown) => e instanceof BudgetFormatError && e.code === 'not-cents', `formatCents(${String(bad)})`);
    assert.throws(() => formatVariance(bad), (e: unknown) => e instanceof BudgetFormatError && e.code === 'not-cents', `formatVariance(${String(bad)})`);
  }
});

test('PURITY — the formatter imports only the one account renderer at run time (and types from the model), and reads no clock, network or environment', () => {
  const src = code(FORMAT);
  const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l));
  // TAB13-02c: the account renderer joins — the one place an account string is drawn (accountString.ts:47-57).
  assert.deepEqual(imports, [
    "import { deriveAccountString } from '@/lib/accountString';",
    "import type { ColumnState, ReportBook } from '@/lib/budget/report';",
  ], 'the renderer at run time, types from the model, nothing else');
  assert.doesNotMatch(src, /\bfetch\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bprocess\.env\b|toLocaleString/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetFormat.test.ts'), /['"]@prisma\/client/);
});
