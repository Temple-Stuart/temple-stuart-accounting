import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_GROUPS, RETIREMENT_SUBTYPES, UNKNOWN_WORD, day, describeWord, groupAccounts, groupOf, heldByAccount,
  isReported, money, rowCount, rowsOf, when, type ApiItem, type HeldGroup,
} from '../accountsView';
import { code } from '../sourceText';

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

// ─── SYNC-01 (Alex, 2026-11-11 12:54: "lets get the sync fixed. so everything pulls") part 3 ───────────────────────
// BANKING SHOWS WHAT IT HOLDS: every account row carries how many rows the app holds for it and the newest one's date.

test('SYNC-01 the two fields are carried onto the row as the read sent them — and a row the read sent neither for prints "—", never 0', () => {
  const sent: ApiItem[] = [{
    id: 'item-rh', institutionName: 'Robinhood', lastErrorCode: null,
    accounts: [
      { id: 'a1', name: 'Brokerage', type: 'investment', subtype: 'brokerage', mask: '4417', balance: 10, entityType: null, held: 5524, latest: '2026-11-07' },
      { id: 'a2', name: 'Cash', type: 'depository', subtype: 'checking', mask: '0001', balance: 0, entityType: null, held: 0, latest: null },
      { id: 'a3', name: 'An answer without them', type: 'depository', subtype: 'savings', mask: null, balance: null, entityType: null },
    ],
  }];
  const rows = rowsOf(sent);
  assert.deepEqual(rows.map((r) => [r.id, r.held, r.latest]), [['a1', 5524, '2026-11-07'], ['a2', 0, null], ['a3', undefined, undefined]]);
  // What the screen prints in Rows and Latest.
  assert.deepEqual(rows.map((r) => [rowCount(r.held), day(r.latest)]), [['5,524', 'Nov 7, 2026'], ['0', '—'], ['—', '—']]);
  // The groups hand the same rows on.
  const brokerage = groupAccounts(rows).find((g) => g.key === 'brokerage');
  assert.deepEqual(brokerage?.rows.map((r) => [r.held, r.latest]), [[5524, '2026-11-07']]);
});

test('SYNC-01 day(): a good date prints as that calendar day; null and garbage print "—" — and no time zone can move it', () => {
  assert.equal(day('2026-11-09'), 'Nov 9, 2026');
  assert.equal(day('2026-08-30'), 'Aug 30, 2026');
  assert.equal(day('2024-02-29'), 'Feb 29, 2024');
  assert.equal(day(null), '—');
  assert.equal(day(undefined), '—');
  for (const garbage of ['', 'not a date', '2026-02-30', '2026-13-01', '11/09/2026', '2026-11-09T00:00:00.000Z']) assert.equal(day(garbage), '—', JSON.stringify(garbage));
  // Why not when(): an instant formatted in a viewer's zone west of Greenwich is the day BEFORE.
  const asInstant = new Date('2026-11-09T00:00:00.000Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
  assert.equal(asInstant, 'Nov 8, 2026', 'what a transaction dated Nov 9 reads as in Los Angeles when it is treated as an instant');
  assert.equal(day('2026-11-09'), 'Nov 9, 2026', 'the day formatter reads the text — the same day for every viewer');
  // By content: day() is the one formatter of failLoud.ts, and builds no Date.
  const view = code('src/lib/accountsView.ts');
  const body = view.slice(view.indexOf('export function day('), view.indexOf('export function rowCount('));
  assert.match(body, /const words = calendarDay\(value\);\s*return words === null \? '—' : words;/);
  assert.doesNotMatch(body, /new Date|toLocale/);
  assert.ok(view.includes("import { calendarDay, thousands } from './plaid/failLoud';"));
});

test('SYNC-01 rowCount(): a count as a person reads it; a held 0 is a count; no figure prints "—"', () => {
  assert.deepEqual([0, 41, 999, 4812, 1234567].map(rowCount), ['0', '41', '999', '4,812', '1,234,567']);
  for (const none of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) assert.equal(rowCount(none), '—', String(none));
});

test('SYNC-01 heldByAccount: the rows of both reads summed per account, the newest date of the two as its day; an account neither lists holds 0 and no date', () => {
  const bank: HeldGroup[] = [
    { accountId: 'a1', _count: { _all: 4812 }, _max: { date: new Date('2026-08-30T00:00:00.000Z') } },
    { accountId: 'a2', _count: { _all: 3412 }, _max: { date: new Date('2026-11-09T00:00:00.000Z') } },
    { accountId: 'a4', _count: { _all: 9 }, _max: { date: new Date('2026-11-10T00:00:00.000Z') } },
  ];
  const investments: HeldGroup[] = [
    { accountId: 'a1', _count: { _all: 712 }, _max: { date: new Date('2026-11-07T00:00:00.000Z') } },
    { accountId: 'a4', _count: { _all: 2 }, _max: { date: new Date('2026-03-01T00:00:00.000Z') } },
  ];
  const heldOf = heldByAccount(['a1', 'a2', 'a3', 'a4'], bank, investments);
  assert.deepEqual(heldOf('a1'), { held: 5524, latest: '2026-11-07' }, 'bank + investment rows; the investments\' date is the newer');
  assert.deepEqual(heldOf('a2'), { held: 3412, latest: '2026-11-09' }, 'bank rows only');
  assert.deepEqual(heldOf('a3'), { held: 0, latest: null }, 'the reads looked and found none — 0 is the count, and there is no date');
  assert.deepEqual(heldOf('a4'), { held: 11, latest: '2026-11-10' }, 'the bank\'s date is the newer');
  // The day is the stored date's UTC day — the day the parsers stored, whatever hour the machine thinks it is.
  assert.deepEqual(heldByAccount(['a1'], [{ accountId: 'a1', _count: { _all: 1 }, _max: { date: new Date('2026-11-09T23:59:59.000Z') } }])('a1'), { held: 1, latest: '2026-11-09' });
  // Refused, never guessed: an account outside the reads, and a read that answers for an account nobody asked for.
  assert.throws(() => heldOf('a9'), /an account outside the grouped reads was asked what it holds/);
  assert.throws(() => heldByAccount(['a1'], [{ accountId: 'zz', _count: { _all: 1 }, _max: { date: null } }]), /answered for an account that was not asked for/);
  // No accounts, no reads: nothing to answer.
  assert.throws(() => heldByAccount([])('a1'));
});

test('SYNC-01 by content: /api/accounts makes TWO grouped reads over the caller\'s own account ids — after the gates, never one read per account', () => {
  const route = code('src/app/api/accounts/route.ts');
  const at = (needle: string) => { const i = route.indexOf(needle); assert.ok(i >= 0, `the route holds ${needle}`); return i; };
  // The gates and the caller's own links come first, unchanged.
  const gates = [at('const userEmail = await getVerifiedEmail();'), at("const tabGate = await requireTabAccess(user.id, 'tab:books');"), at('where: { userId: user.id, retired_at: null },')];
  const ids = at('const accountIds = items.flatMap((item) => item.accounts.map((account) => account.id));');
  const bank = at("prisma.transactions.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _count: { _all: true }, _max: { date: true } })");
  const inv = at("prisma.investment_transactions.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _count: { _all: true }, _max: { date: true } })");
  assert.deepEqual([...gates, ids, bank, inv], [...gates, ids, bank, inv].slice().sort((a, b) => a - b), 'gates → the caller\'s links → their account ids → the two reads');
  assert.equal((route.match(/\.groupBy\(/g) ?? []).length, 2, 'two grouped reads');
  assert.equal((route.match(/prisma\.(transactions|investment_transactions)\./g) ?? []).length, 2, 'and no other read of either table');
  assert.match(route, /const heldOf = heldByAccount\(accountIds, bankHeld, investmentHeld\);/);
  // Each account takes its two fields from the fold; the map awaits nothing — there is no read per account.
  const map = route.slice(at('const transformedItems = items.map(item => ({'), at('return NextResponse.json({ items: transformedItems });'));
  assert.match(map, /\.\.\.heldOf\(account\.id\),/);
  assert.doesNotMatch(map, /await |prisma\./);
  // The route still defaults no figure.
  assert.equal(route.match(/\?\?\s*0(?![.\d])|\|\|\s*0(?![.\d])/g), null);
});

test('SYNC-01 by content: the Banking table shows Rows and Latest after Balance and before Last updated, and the footnote says what they are', () => {
  const screen = code('src/components/accounts/AccountsClient.tsx');
  assert.match(screen, /<th className=\{`\$\{TH\} text-right`\}>Balance<\/th>\s*<th className=\{`\$\{TH\} text-right`\}>Rows<\/th>\s*<th className=\{`\$\{TH\} text-right`\}>Latest<\/th>\s*<th className=\{`\$\{TH\} text-right`\}>Last updated<\/th>/);
  assert.match(screen, /data-balance>\{money\(row\.balance\)\}<\/td>\s*(?:\{\s*\}\s*)?<td className="px-3 py-2 text-right font-mono text-text-secondary" data-held>\{rowCount\(row\.held\)\}<\/td>\s*<td className="px-3 py-2 text-right font-mono text-text-secondary" data-latest>\{day\(row\.latest\)\}<\/td>\s*<td className="px-3 py-2 text-right font-mono text-text-muted">\{when\(row\.updatedAt\)\}<\/td>/);
  const words = screen.replace(/\s+/g, ' ');
  assert.ok(words.includes('Rows is every bank and investment transaction the app holds for the account; Latest is the newest one’s date.'), 'the footnote\'s new sentence');
  // What the footnote already said, it still says.
  assert.ok(words.includes('Balance is what the institution last reported; “—” means it reported none.'));
  assert.ok(words.includes('“Last updated” is when the row last changed — a sync, or an entity assignment. The product records no per-account sync time, so none is shown.'));
  assert.ok(words.includes('Groups come from the account’s own type and subtype ('));
});
