import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors/ValidationError';
import {
  EXPENSE_BLOCKS,
  FAMILY_RULES,
  assertCodeInFamily,
  familyOfCode,
  letterFor,
  parseCode,
  renderCode,
  schemeHint,
} from '../coa/scheme';
import { SEED_SETS, assertSeedSetsLaw, planSeed, seedSet, seedSetsFor } from '../coa/seedSets';
import { addAccount, applySeed, renameAccount, retireAccount } from '../coa/accounts';
import { planReclassification, postReclassification } from '../coa/reclassify';
import { FakeChart } from './fakeChart';

// COA-01 — the chart of accounts is extendable in the product. Hermetic: the
// scheme and the reclass plan are pure; add / rename / retire / seed run over
// the fake chart (fakeChart.ts) with the table's own UNIQUE rule.

const ENTITY_B = { id: 'ent-b', entity_type: 'sole_prop' };
const ENTITY_P = { id: 'ent-p', entity_type: 'personal' };

async function rejects(fn: () => Promise<unknown>, status: number, re: RegExp) {
  await assert.rejects(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `expected a ValidationError, got ${String(err)}`);
    assert.equal(err.status, status);
    assert.match(err.message, re);
    return true;
  });
}

function throws(fn: () => unknown, re: RegExp) {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `expected a ValidationError, got ${String(err)}`);
    assert.match(err.message, re);
    return true;
  });
}

// ── the scheme ──────────────────────────────────────────────────────────────

test('the scheme: the entity letter is the entity type\'s, the code is four digits, the first digit is the family', () => {
  assert.equal(letterFor('personal'), 'P');
  assert.equal(letterFor('sole_prop'), 'B');
  assert.equal(letterFor('trading'), 'T');
  assert.equal(letterFor('business'), null);
  assert.equal(parseCode('6250', 'sole_prop'), '6250');
  assert.equal(parseCode(' b-6250 ', 'sole_prop'), '6250');
  assert.equal(parseCode('8210', 'personal'), '8210');
  assert.equal(familyOfCode('1010'), 'asset');
  assert.equal(familyOfCode('2020'), 'liability');
  assert.equal(familyOfCode('3110'), 'equity');
  assert.equal(familyOfCode('4010'), 'revenue');
  for (const c of ['5130', '6250', '7100', '8210', '9840']) assert.equal(familyOfCode(c), 'expense');
  assert.equal(renderCode('6250', 'sole_prop'), 'B-6250');
  assert.equal(renderCode('9840', 'personal', 'travel'), 'P-9840-travel');
  assert.equal(FAMILY_RULES.expense.from, 5000);
  assert.equal(FAMILY_RULES.expense.to, 9999);
  assert.ok(EXPENSE_BLOCKS.B.some((b) => b.from === 6200 && b.to === 6299));
  assert.match(schemeHint('sole_prop', 'expense'), /B-5000–B-9999/);
  assert.match(schemeHint('sole_prop', 'expense'), /6200–6299 Fixed costs/);
  assert.match(schemeHint('personal', 'asset'), /P-1000–P-1999 · Balance sheet/);
});

test('add rejects a bad code: the wrong letter, not four digits, outside every family, outside its family\'s range', () => {
  throws(() => parseCode('P-6250', 'sole_prop'), /carries the P- letter; this is a B- chart/);
  throws(() => parseCode('B-6250', 'personal'), /carries the B- letter; this is a P- chart/);
  throws(() => parseCode('B-6250', 'business'), /has no code letter/);
  throws(() => parseCode('62500', 'sole_prop'), /not in the scheme/);
  throws(() => parseCode('ABC', 'sole_prop'), /not in the scheme/);
  throws(() => parseCode('', 'sole_prop'), /code is required/);
  throws(() => parseCode(undefined, 'sole_prop'), /code is required/);
  throws(() => parseCode('0999', 'sole_prop'), /outside every family/);
  throws(() => assertCodeInFamily('4010', 'expense'), /outside the expense range 5000–9999 — it reads as revenue/);
  throws(() => assertCodeInFamily('6250', 'asset'), /outside the asset range 1000–1999 — it reads as expense/);
  assertCodeInFamily('6250', 'expense');
  assertCodeInFamily('1010', 'asset');
});

test('add rejects a bad code and a duplicate through the policy; a good add stores the digits with the family\'s normal balance', async () => {
  const db = new FakeChart();
  db.seed([{ code: '6210', name: 'Software & Subscriptions', account_type: 'expense' }]);
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: 'P-6250', name: 'Finnhub', family: 'expense' }), 400, /P- letter/);
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: '4010', name: 'Finnhub', family: 'expense' }), 400, /outside the expense range/);
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: '6250', name: 'Finnhub', family: 'costs' }), 400, /family "costs" is not one of/);
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: '6250', name: 'Finnhub' , family: undefined }), 400, /family is required/);
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: '6250', name: '   ', family: 'expense' }), 400, /name is required/);
  // the duplicate — the code already holds Software & Subscriptions
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: 'B-6210', name: 'Vercel', family: 'expense' }), 409, /B-6210 is already "Software & Subscriptions"/);
  assert.equal(db.accounts.length, 1, 'nothing was written by the refusals');

  const added = await addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: 'B-6250', name: '  Finnhub Premium   (quarterly plan) ', family: 'expense', subType: 'fixed' });
  assert.equal(added.code, '6250');
  assert.equal(added.name, 'Finnhub Premium (quarterly plan)');
  assert.equal(added.account_type, 'expense');
  assert.equal(added.balance_type, 'D');
  assert.equal(added.sub_type, 'fixed');
  assert.equal(added.entity_type, 'sole_prop');
  assert.equal(added.settled_balance, BigInt(0));
  // the same code in ANOTHER entity is a different account — the unique is per entity
  const personal = await addAccount(db, { userId: 'user-a', entity: ENTITY_P, code: '6250', name: 'Something personal', family: 'expense' });
  assert.equal(personal.entity_id, 'ent-p');
  // a liability gets the credit normal balance
  const ap = await addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: '2030', name: 'Card payable', family: 'liability' });
  assert.equal(ap.balance_type, 'C');
});

test('add rejects a duplicate of a RETIRED account with the restore hint — never re-added', async () => {
  const db = new FakeChart();
  db.seed([{ code: '5130', name: 'Finnhub API calls', account_type: 'expense', is_archived: true }]);
  await rejects(() => addAccount(db, { userId: 'user-a', entity: ENTITY_B, code: '5130', name: 'Finnhub API calls', family: 'expense' }), 409, /B-5130 is retired as "Finnhub API calls" — restore it/);
  assert.equal(db.accounts.length, 1);
});

test('rename: a new code obeys the scheme, the range and uniqueness; a family change needs a code that fits', async () => {
  const db = new FakeChart();
  const [a, b] = db.seed([
    { code: '6210', name: 'Software & Subscriptions', account_type: 'expense' },
    { code: '6220', name: 'Azure Postgres', account_type: 'expense' },
  ]);
  await rejects(() => renameAccount(db, { userId: 'user-a', entity: ENTITY_B, account: a, code: '6220' }), 409, /B-6220 is already "Azure Postgres"/);
  await rejects(() => renameAccount(db, { userId: 'user-a', entity: ENTITY_B, account: a, code: '4010' }), 400, /outside the expense range/);
  await rejects(() => renameAccount(db, { userId: 'user-a', entity: ENTITY_B, account: a, family: 'asset' }), 400, /outside the asset range/);
  await rejects(() => renameAccount(db, { userId: 'user-a', entity: ENTITY_B, account: a }), 400, /nothing to change/);
  const renamed = await renameAccount(db, { userId: 'user-a', entity: ENTITY_B, account: a, name: 'Vercel', code: 'B-6215', subType: 'fixed' });
  assert.equal(renamed.code, '6215');
  assert.equal(renamed.name, 'Vercel');
  assert.equal(renamed.sub_type, 'fixed');
  assert.equal(b.code, '6220', 'the other account is untouched');
  // a family change WITH a fitting code
  const moved = await renameAccount(db, { userId: 'user-a', entity: ENTITY_B, account: b, code: '1300', family: 'asset' });
  assert.equal(moved.account_type, 'asset');
  assert.equal(moved.balance_type, 'D');
  // a legacy caller may still say accountType (the route maps it to family)
});

// ── retire ──────────────────────────────────────────────────────────────────

test('retire keeps history: the flag flips and nothing else — balance, ledger lines and the row stay; restore flips it back', async () => {
  const db = new FakeChart();
  const [finnhub, cash] = db.seed([
    { code: '5130', name: 'Finnhub API calls', account_type: 'expense', settled_balance: BigInt(12000) },
    { code: '1010', name: 'Business Checking', account_type: 'asset', settled_balance: BigInt(500000) },
  ]);
  db.postLine({ journal_entry_id: 'je-old', account_id: finnhub.id, entry_type: 'D', amount: BigInt(12000), created_by: null });
  db.postLine({ journal_entry_id: 'je-old', account_id: cash.id, entry_type: 'C', amount: BigInt(12000), created_by: null });
  const before = db.snapshotLedger();

  const retired = await retireAccount(db, finnhub, true);
  assert.equal(retired.is_archived, true);
  assert.equal(retired.settled_balance, BigInt(12000), 'the balance is untouched');
  assert.deepEqual(db.updates, [{ id: finnhub.id, patch: { is_archived: true } }], 'the ONLY write is the flag');
  assert.equal(db.snapshotLedger(), before, 'no ledger line moved');
  assert.equal(db.accounts.length, 2, 'nothing was deleted');
  assert.equal(db.increments.length, 0);

  // idempotent: retiring a retired account writes nothing
  await retireAccount(db, finnhub, true);
  assert.equal(db.updates.length, 1);

  const restored = await retireAccount(db, finnhub, false);
  assert.equal(restored.is_archived, false);
  assert.equal(restored.settled_balance, BigInt(12000));
});

// ── reclassify ──────────────────────────────────────────────────────────────

const FROM = { id: 'acct-5130', userId: 'user-a', entity_id: 'ent-b', entity_type: 'sole_prop', code: '5130', name: 'Finnhub API calls', account_type: 'expense', balance_type: 'D', sub_type: null, module: null, settled_balance: BigInt(12000), is_archived: true };
const TO = { ...FROM, id: 'acct-6250', code: '6250', name: 'Finnhub Premium (quarterly plan)', sub_type: 'fixed', settled_balance: BigInt(0), is_archived: false };
const DATE = new Date('2026-09-08T00:00:00Z');

test('reclassify plans a balanced entry: one credit off the source, one debit onto the target, the whole balance by default', () => {
  const plan = planReclassification({ from: FROM, to: TO, memo: '  Finnhub is a quarterly plan,  not per-call ', date: DATE });
  assert.equal(plan.amount, BigInt(12000));
  assert.equal(plan.memo, 'Finnhub is a quarterly plan, not per-call');
  assert.equal(plan.description, 'Reclassify B-5130 → B-6250-fixed: Finnhub is a quarterly plan, not per-call');
  assert.deepEqual(plan.lines, [
    { account_id: 'acct-5130', entry_type: 'C', amount: BigInt(12000), balanceDelta: BigInt(-12000) },
    { account_id: 'acct-6250', entry_type: 'D', amount: BigInt(12000), balanceDelta: BigInt(12000) },
  ]);
  const debits = plan.lines.filter((l) => l.entry_type === 'D').reduce((s, l) => s + l.amount, BigInt(0));
  const credits = plan.lines.filter((l) => l.entry_type === 'C').reduce((s, l) => s + l.amount, BigInt(0));
  assert.equal(debits, credits, 'balanced');
  assert.equal(plan.lines[0].balanceDelta + plan.lines[1].balanceDelta, BigInt(0), 'the family total does not change');
  assert.deepEqual(plan.metadata, { reclass: { from_id: 'acct-5130', from_code: '5130', to_id: 'acct-6250', to_code: '6250', amount_cents: '12000', memo: 'Finnhub is a quarterly plan, not per-call' } });
  // a partial amount, given as cents in any of the accepted shapes
  assert.equal(planReclassification({ from: FROM, to: TO, memo: 'part', date: DATE, amountCents: 5_000 }).amount, BigInt(5000));
  assert.equal(planReclassification({ from: FROM, to: TO, memo: 'part', date: DATE, amountCents: '5000' }).amount, BigInt(5000));
  // a NEGATIVE balance on a debit account moves with the mirror-image lines
  const negative = planReclassification({ from: { ...FROM, settled_balance: BigInt(-3000) }, to: TO, memo: 'contra', date: DATE });
  assert.deepEqual(negative.lines.map((l) => [l.entry_type, l.balanceDelta]), [['D', BigInt(3000)], ['C', BigInt(-3000)]]);
  // a credit-normal family (revenue) moves the other way round
  const rev = { ...FROM, id: 'r1', code: '4010', account_type: 'revenue', balance_type: 'C', settled_balance: BigInt(9000), is_archived: false };
  const rev2 = { ...rev, id: 'r2', code: '4020' };
  const r = planReclassification({ from: rev, to: rev2, memo: 'consulting, not service', date: DATE });
  assert.deepEqual(r.lines.map((l) => [l.entry_type, l.balanceDelta]), [['D', BigInt(-9000)], ['C', BigInt(9000)]]);
});

test('reclassify fails loud: across families, into a retired account, into itself, across entities, no memo, zero balance, more than the balance, bad amount', () => {
  throws(() => planReclassification({ from: FROM, to: { ...TO, account_type: 'revenue', balance_type: 'C', code: '4010' }, memo: 'x', date: DATE }), /within one family — B-5130 is expense, B-4010-fixed is revenue/);
  throws(() => planReclassification({ from: FROM, to: { ...TO, is_archived: true }, memo: 'x', date: DATE }), /B-6250-fixed is retired — restore it/);
  throws(() => planReclassification({ from: FROM, to: FROM, memo: 'x', date: DATE }), /into itself/);
  throws(() => planReclassification({ from: FROM, to: { ...TO, entity_id: 'ent-p' }, memo: 'x', date: DATE }), /different entities/);
  throws(() => planReclassification({ from: FROM, to: TO, memo: '   ', date: DATE }), /a memo is required/);
  throws(() => planReclassification({ from: { ...FROM, settled_balance: BigInt(0) }, to: TO, memo: 'x', date: DATE }), /zero balance — nothing to move/);
  throws(() => planReclassification({ from: FROM, to: TO, memo: 'x', date: DATE, amountCents: 12_001 }), /more than B-5130's balance of 12000 cents/);
  throws(() => planReclassification({ from: FROM, to: TO, memo: 'x', date: DATE, amountCents: 0 }), /more than zero/);
  throws(() => planReclassification({ from: FROM, to: TO, memo: 'x', date: DATE, amountCents: 'twelve' }), /not a whole number of cents/);
  throws(() => planReclassification({ from: FROM, to: TO, memo: 'x', date: new Date('nope') }), /date is not a date/);
});

test('reclassify posts a balanced entry and never updates old rows: one journal entry, two new lines, two balance increments, the prior lines byte-identical', async () => {
  const db = new FakeChart();
  const [from, to, cash] = db.seed([
    { id: 'acct-5130', code: '5130', name: 'Finnhub API calls', account_type: 'expense', settled_balance: BigInt(12000), is_archived: true },
    { id: 'acct-6250', code: '6250', name: 'Finnhub Premium (quarterly plan)', account_type: 'expense', sub_type: 'fixed' },
    { id: 'acct-1010', code: '1010', name: 'Business Checking', account_type: 'asset', settled_balance: BigInt(988000) },
  ]);
  // the history: the original per-call postings
  db.postLine({ journal_entry_id: 'je-1', account_id: from.id, entry_type: 'D', amount: BigInt(7000), created_by: null });
  db.postLine({ journal_entry_id: 'je-1', account_id: cash.id, entry_type: 'C', amount: BigInt(7000), created_by: null });
  db.postLine({ journal_entry_id: 'je-2', account_id: from.id, entry_type: 'D', amount: BigInt(5000), created_by: null });
  db.postLine({ journal_entry_id: 'je-2', account_id: cash.id, entry_type: 'C', amount: BigInt(5000), created_by: null });
  const before = db.snapshotLedger();
  const oldCount = db.ledger.length;

  const plan = planReclassification({ from, to, memo: 'Finnhub is a quarterly plan', date: DATE });
  const result = await postReclassification(db, { userId: 'user-a', entityId: 'ent-b', requestId: 'req-1', createdBy: 'alex@example.com' }, plan);

  assert.equal(db.journal.length, 1);
  const je = db.journal[0];
  assert.equal(je.id, result.journalEntryId);
  assert.equal(je.source_type, 'reclass');
  assert.equal(je.status, 'posted');
  assert.equal(je.entity_id, 'ent-b');
  assert.equal(je.request_id, 'req-1');
  assert.equal(je.description, 'Reclassify B-5130 → B-6250-fixed: Finnhub is a quarterly plan');
  assert.deepEqual(je.metadata, plan.metadata);

  assert.equal(db.ledger.length, oldCount + 2, 'two NEW lines');
  assert.equal(JSON.stringify(db.ledger.slice(0, oldCount).map((l) => ({ ...l, amount: l.amount.toString() }))), before, 'the old lines are byte-identical');
  const fresh = db.ledger.slice(oldCount);
  assert.deepEqual(fresh.map((l) => [l.journal_entry_id, l.account_id, l.entry_type, l.amount]), [
    [je.id, 'acct-5130', 'C', BigInt(12000)],
    [je.id, 'acct-6250', 'D', BigInt(12000)],
  ]);
  assert.deepEqual(db.increments, [{ accountId: 'acct-5130', delta: BigInt(-12000) }, { accountId: 'acct-6250', delta: BigInt(12000) }]);
  assert.equal(from.settled_balance, BigInt(0));
  assert.equal(to.settled_balance, BigInt(12000));
  assert.equal(cash.settled_balance, BigInt(988000), 'cash is untouched — a reclass never crosses the balance sheet');
  assert.equal(db.updates.length, 0, 'no account row was edited — balances move only through increments');
  assert.equal(Object.isFrozen(db.ledger[0]), true);
});

// ── the seed ────────────────────────────────────────────────────────────────

test('the seed sets obey the law: every code in its family, unique per set, Finnhub at 6250 in the B-6200 family, the ruled names verbatim', () => {
  assertSeedSetsLaw();
  const platform = seedSet('platform-fixed-costs')!;
  assert.deepEqual(platform.entityLetters, ['B']);
  assert.deepEqual(platform.accounts.map((a) => `${a.code} ${a.name}`), [
    '6210 Vercel', '6220 Azure Postgres', '6230 GitHub', '6240 Claude seat',
    '6250 Finnhub Premium (quarterly plan)', '6260 tastytrade data', '6270 Resend', '6280 Voyage',
  ]);
  assert.ok(platform.accounts.every((a) => a.family === 'expense' && a.subType === 'fixed' && a.module === null));
  assert.ok(platform.accounts.every((a) => Number(a.code) >= 6200 && Number(a.code) <= 6299), 'inside the fixed-cost block');
  const travel = seedSet('travel-intl-fees')!;
  assert.deepEqual(travel.entityLetters, ['P', 'B']);
  assert.deepEqual(travel.accounts.map((a) => [a.code, a.name, a.subType, a.module]), [['9840', 'International transaction fees', 'travel', 'trips']]);
  const personal = seedSet('personal-additions')!;
  assert.deepEqual(personal.accounts.map((a) => `${a.code} ${a.name}`), ['8210 Gym membership', '8220 Pet supplies & food']);
  assert.deepEqual(seedSetsFor('sole_prop').map((s) => s.key), ['platform-fixed-costs', 'travel-intl-fees']);
  assert.deepEqual(seedSetsFor('personal').map((s) => s.key), ['travel-intl-fees', 'personal-additions']);
  assert.deepEqual(seedSetsFor('trading'), []);
  assert.equal(SEED_SETS.length, 3);
  // the law refuses a set that puts Finnhub elsewhere, a code outside its family, or a repeated code
  assert.throws(() => assertSeedSetsLaw([{ ...platform, accounts: platform.accounts.map((a) => (a.code === '6250' ? { ...a, code: '6290' } : a)) }]), /Finnhub Premium must sit at 6250/);
  assert.throws(() => assertSeedSetsLaw([{ ...platform, accounts: [...platform.accounts, { code: '4010', name: 'Wrong', family: 'expense', subType: null, module: null }] }]), /outside the expense range/);
  assert.throws(() => assertSeedSetsLaw([{ ...platform, accounts: [...platform.accounts, { code: '6210', name: 'Again', family: 'expense', subType: null, module: null }] }]), /repeats code 6210/);
});

test('seed is idempotent: the plan names every fate, apply inserts only the absent rows, a second apply inserts nothing, a collision is never overwritten', async () => {
  const db = new FakeChart();
  db.seed([
    { code: '6210', name: 'Software & Subscriptions', account_type: 'expense' },          // collision — another name at 6210
    { code: '6220', name: 'azure  postgres', account_type: 'expense' },                   // exists — same name, spacing/case aside
    { code: '6230', name: 'GitHub', account_type: 'expense', is_archived: true },         // retired — restore, never re-add
  ]);
  const set = seedSet('platform-fixed-costs')!;
  throws(() => planSeed(set, ENTITY_P, []), /applies to B- charts; this entity is P-/);

  const plan = planSeed(set, ENTITY_B, db.accounts);
  assert.deepEqual(plan.map((r) => `${r.code} ${r.action}${r.existingName ? ` (${r.existingName})` : ''}`), [
    '6210 collision (Software & Subscriptions)',
    '6220 exists (azure  postgres)',
    '6230 retired (GitHub)',
    '6240 create', '6250 create', '6260 create', '6270 create', '6280 create',
  ]);

  const created = await applySeed(db, { userId: 'user-a', entity: ENTITY_B }, plan);
  assert.deepEqual(created.map((r) => `${r.code} ${r.name}`), ['6240 Claude seat', '6250 Finnhub Premium (quarterly plan)', '6260 tastytrade data', '6270 Resend', '6280 Voyage']);
  assert.ok(created.every((r) => r.sub_type === 'fixed' && r.account_type === 'expense' && r.balance_type === 'D' && r.entity_type === 'sole_prop'));
  assert.equal(db.accounts.find((a) => a.code === '6210')!.name, 'Software & Subscriptions', 'the collision is untouched');
  assert.equal(db.accounts.find((a) => a.code === '6230')!.is_archived, true, 'the retired row is untouched');
  assert.equal(db.updates.length, 0, 'apply never updates');
  assert.equal(db.accounts.length, 8);

  // the second pass
  const again = planSeed(set, ENTITY_B, db.accounts);
  assert.deepEqual(again.filter((r) => r.action === 'create'), []);
  assert.equal(again.filter((r) => r.action === 'exists').length, 6);
  const createdAgain = await applySeed(db, { userId: 'user-a', entity: ENTITY_B }, again);
  assert.deepEqual(createdAgain, []);
  assert.equal(db.accounts.length, 8, 'idempotent');

  // the travel set on both letters; the personal set's rows land with no sub
  const p = new FakeChart();
  await applySeed(p, { userId: 'user-a', entity: ENTITY_P }, planSeed(seedSet('travel-intl-fees')!, ENTITY_P, []));
  await applySeed(p, { userId: 'user-a', entity: ENTITY_P }, planSeed(seedSet('personal-additions')!, ENTITY_P, []));
  assert.deepEqual(p.accounts.map((a) => [a.code, a.name, a.sub_type, a.module, a.entity_type]), [
    ['9840', 'International transaction fees', 'travel', 'trips', 'personal'],
    ['8210', 'Gym membership', null, null, 'personal'],
    ['8220', 'Pet supplies & food', null, null, 'personal'],
  ]);
});
