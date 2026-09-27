import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCents, formatVariance, BudgetFormatError, BLANK } from '../budget/format';
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

test('FAIL LOUD — a figure that is not a safe integer number of cents is refused by name, never written', () => {
  for (const bad of [12.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '1200' as unknown as number]) {
    assert.throws(() => formatCents(bad), (e: unknown) => e instanceof BudgetFormatError && e.code === 'not-cents', `formatCents(${String(bad)})`);
    assert.throws(() => formatVariance(bad), (e: unknown) => e instanceof BudgetFormatError && e.code === 'not-cents', `formatVariance(${String(bad)})`);
  }
});

test('PURITY — the formatter imports nothing and reads no clock, network or environment', () => {
  const src = code(FORMAT);
  assert.doesNotMatch(src, /^\s*import\b/m, 'no imports at all');
  assert.doesNotMatch(src, /\bfetch\s*\(|\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bprocess\.env\b|toLocaleString/);
  assert.doesNotMatch(code('src/lib/__tests__/budgetFormat.test.ts'), /['"]@prisma\/client/);
});
