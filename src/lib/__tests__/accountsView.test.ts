import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_GROUPS, RETIREMENT_SUBTYPES, UNKNOWN_WORD, describeWord, groupAccounts, groupOf,
  isReported, money, rowsOf, when, type ApiItem,
} from '../accountsView';

// ACCOUNTS-01 — step 1's screen never invents a number and never invents a word.
// The page it replaced did both: it called balance.toFixed(2) straight, and stamped
// lastSync with `new Date()` — a value the database never held.

test('money: null, undefined, NaN and Infinity all render "—"; a real number renders as money, including zero', () => {
  assert.equal(money(null), '—');
  assert.equal(money(undefined), '—');
  assert.equal(money(Number.NaN), '—');
  assert.equal(money(Number.POSITIVE_INFINITY), '—');
  assert.equal(money(0), '$0.00', 'a reported zero IS a number — it is not the same as no answer');
  assert.equal(money(1234.5), '$1,234.50');
  assert.equal(money(-42), '-$42.00');
});

test('when: a missing or unparseable timestamp renders "—" — never today\'s date as a stand-in', () => {
  assert.equal(when(null), '—');
  assert.equal(when(undefined), '—');
  assert.equal(when(''), '—');
  assert.equal(when('not a date'), '—');
  assert.equal(when('2026-09-09T12:00:00.000Z'), 'Sep 9, 2026');
});

test('a missing type or subtype says so; a reported one is passed through, trimmed', () => {
  assert.equal(describeWord(null), UNKNOWN_WORD);
  assert.equal(describeWord(undefined), UNKNOWN_WORD);
  assert.equal(describeWord('   '), UNKNOWN_WORD);
  assert.equal(describeWord(' checking '), 'checking');
  assert.equal(isReported('checking'), true);
  assert.equal(isReported(null), false);
  assert.equal(isReported('  '), false);
});

test('grouping is by the account\'s own type: depository and credit are Banking, loan is Debt, an unknown type is Unrecognized — never re-filed on a guess', () => {
  assert.equal(groupOf({ type: 'depository', subtype: 'checking' }), 'banking');
  assert.equal(groupOf({ type: 'credit', subtype: 'credit card' }), 'banking');
  assert.equal(groupOf({ type: 'loan', subtype: 'student' }), 'debt');
  assert.equal(groupOf({ type: 'payroll', subtype: null }), 'unrecognized');
  assert.equal(groupOf({ type: null, subtype: null }), 'unrecognized');
});

test('a known retirement subtype goes to Retirement; an unknown investment subtype stays in its type\'s group (Brokerage) and is labelled unknown', () => {
  for (const subtype of ['401k', '403b', 'ira', 'roth', 'hsa', '529']) {
    assert.equal(groupOf({ type: 'investment', subtype }), 'retirement', subtype);
  }
  // as the institution actually writes them — case and punctuation vary
  assert.equal(groupOf({ type: 'investment', subtype: '403B' }), 'retirement');
  assert.equal(groupOf({ type: 'investment', subtype: 'Roth' }), 'retirement');
  assert.equal(groupOf({ type: 'investment', subtype: 'sep_ira' }), 'retirement');
  assert.equal(groupOf({ type: 'investment', subtype: 'ROTH 401K' }), 'retirement');
  // brokerage and cash management are taxable
  assert.equal(groupOf({ type: 'investment', subtype: 'brokerage' }), 'brokerage');
  assert.equal(groupOf({ type: 'investment', subtype: 'cash management' }), 'brokerage');
  // an investment subtype nobody recognises: its TYPE's group, and the word says it is unknown to us
  assert.equal(groupOf({ type: 'investment', subtype: 'mystery wrapper' }), 'brokerage');
  assert.equal(groupOf({ type: 'investment', subtype: null }), 'brokerage');
  assert.equal(describeWord(null), UNKNOWN_WORD);
  assert.ok(RETIREMENT_SUBTYPES.includes('401k'));
});

const items: ApiItem[] = [
  {
    id: 'item-1', institutionName: 'First Bank', lastErrorCode: null,
    accounts: [
      { id: 'a1', name: 'Checking', type: 'depository', subtype: 'checking', mask: '1111', balance: 100.5, entityType: 'business', updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'a2', name: 'Card', type: 'credit', subtype: 'credit card', mask: '2222', balance: null, entityType: null, updatedAt: null },
    ],
  },
  {
    id: 'item-2', institutionName: null, lastErrorCode: 'ITEM_LOGIN_REQUIRED',
    accounts: [
      { id: 'a3', name: 'Roth', type: 'investment', subtype: 'roth', mask: '3333', balance: 900, entityType: null, updatedAt: null },
      { id: 'a4', name: 'Something', type: 'crypto', subtype: null, mask: null, balance: 7, entityType: null, updatedAt: null },
    ],
  },
];

test('rows carry their institution and their item\'s error; groups keep ACCOUNT_GROUPS order, and a group total is null when NO row carries a number', () => {
  const rows = rowsOf(items);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.institutionName), ['First Bank', 'First Bank', null, null]);
  assert.deepEqual(rows.map((r) => r.lastErrorCode), [null, null, 'ITEM_LOGIN_REQUIRED', 'ITEM_LOGIN_REQUIRED']);
  assert.deepEqual(rows.map((r) => r.itemId), ['item-1', 'item-1', 'item-2', 'item-2']);

  const groups = groupAccounts(rows);
  assert.deepEqual(groups.map((g) => g.key), ACCOUNT_GROUPS.map((g) => g.key));
  const by = Object.fromEntries(groups.map((g) => [g.key, g]));
  assert.deepEqual(by.banking.rows.map((r) => r.id), ['a1', 'a2']);
  assert.equal(by.banking.total, 100.5, 'the one reported balance — the null is not counted as zero');
  assert.deepEqual(by.retirement.rows.map((r) => r.id), ['a3']);
  assert.deepEqual(by.unrecognized.rows.map((r) => r.id), ['a4']);
  assert.equal(by.debt.rows.length, 0);
  assert.equal(by.debt.total, null, 'no rows → no total, and "—" on the screen; never $0.00');
  assert.equal(money(by.debt.total), '—');
  // Fixed Assets has no feed at all and never gains one from the data
  assert.equal(by['fixed-assets'].rows.length, 0);
  assert.match(by['fixed-assets'].noFeed ?? '', /entered by hand, and that is not built/);
  // every group names what would appear there, so an empty one is never blank
  for (const g of groups) assert.ok(g.empty.trim().length > 10, `${g.key} says what belongs there`);
});

test('an item with no accounts contributes no rows, and an absent accounts list does not throw', () => {
  assert.deepEqual(rowsOf([{ id: 'x', institutionName: 'Bank', lastErrorCode: null, accounts: [] }]), []);
  assert.deepEqual(rowsOf([{ id: 'x', institutionName: 'Bank', lastErrorCode: null } as ApiItem]), []);
  assert.deepEqual(rowsOf([]), []);
});
