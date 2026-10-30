/**
 * DOCUMENTS-02 (Alex, 2026-10-30) — the bank statement on its month, and a reconciliation that reconciles the books.
 *
 * The rules are pure (src/lib/books/period.ts, bankSide.ts, reconciliation.ts, reconciliationStatus.ts,
 * sourceDocuments.ts) and driven here over fixtures. The migration, the schema, the routes, the screen and the
 * pipeline are read from source the way this repo proves what it cannot execute without a database
 * (documents01.test.ts's header); the wire — the book side, the refusals, the freeze, the re-open, the
 * statement on its month — is proven against the LOCAL database and reported with the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { BAD_PERIOD_WORDS, daysInMonth, periodOf, periodOfDay, periodRule, previousMonthOf, utcDayOf } from '../books/period';
import { bankSideOf, noAccountCodeWords, noEntityWords } from '../books/bankSide';
import {
  BOOK_BALANCE_FIELD_WORDS, ITEMS_ARRAY_WORDS, NO_DIFFERENCE_YET_WORDS, REOPEN_FLAG_WORDS, STATEMENT_BALANCE_WORDS, STATUS_WORDS,
  attachStatementWords, bodyFieldsRule, bookBalanceOf, isBalanced, itemAmountWords, itemClearedWords, itemDescriptionWords, itemTypeWords, itemsRule,
  moneyWords, notReconciledWords, nothingToReopenWords, reconcile, reconciledGate, reconciliationListOf, reconciliationRowOf, reopenRule,
  statementBalanceRule, statusRule, supersededWords, triggerRefusalOf, unknownReconciliationFieldWords, type StoredReconciliation,
} from '../books/reconciliation';
import { NO_MAPPED_ACCOUNT_WORDS, reconciliationStatusOf } from '../books/reconciliationStatus';
import {
  HAS_STATEMENT_WORDS, LIST_ONE_OF_WORDS, MAX_ENTRIES_PER_READ, NOTHING_TO_REPLACE_STATEMENT_WORDS, NOT_DEPOSITORY_WORDS, NOT_YOUR_ACCOUNT_WORDS,
  NO_ACCOUNT_WORDS, NO_STATEMENT_WORDS, ONE_ADDRESS_WORDS, STATEMENT_WORDS, UPLOAD_FIELDS,
  documentMetaOf, documentsListInput, statementAccountRule, statementCurrentRule, statementLineWords, uploadAddressRule, type ReceiptMeta,
} from '../books/sourceDocuments';

const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261030120000_documents_02_reconciliation_supersession';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const SCHEMA = 'prisma/schema.prisma';
const COMMIT_ROUTE = 'src/app/api/transactions/commit-to-ledger/route.ts';
const RECON_ROUTE = 'src/app/api/bank-reconciliations/route.ts';
const BOOK_SIDE_ROUTE = 'src/app/api/bank-reconciliations/book-side/route.ts';
const READ_BOOK_SIDE = 'src/lib/books/readBookSide.ts';
const DOCS_ROUTE = 'src/app/api/books/documents/route.ts';
const COMPONENT = 'src/components/dashboard/BankReconciliation.tsx';
const PANEL = 'src/components/books/DocumentPanel.tsx';
const PERIOD_CLOSE = 'src/components/dashboard/PeriodClose.tsx';
const PIPELINE = 'src/components/home/BooksPipeline.tsx';
const SHOWCASE = 'src/components/home/BooksShowcaseSections.tsx';

const OCT = periodOf(2026, 10);
const stmt = (over: Partial<ReceiptMeta> = {}): ReceiptMeta => ({
  id: 's1', journal_entry_id: null, account_id: 'acc-1', period_month: '2026-10-01', file_name: 'oct.pdf', content_type: 'application/pdf', byte_size: 14_489, uploaded_at: '2026-10-30T10:00:00.000Z', ...over,
});

test('D the migration: superseded_by with its deferred self reference, the partial unique over the five columns WHERE superseded_by IS NULL, the status CHECK, the freeze that allows one change, the no-delete — the newest, after DOCUMENTS-01’s', () => {
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261028120000_documents_01_source_documents', 'right after DOCUMENTS-01’s');
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "bank_reconciliations" ADD COLUMN "superseded_by" TEXT;/);
  assert.match(sql, /FOREIGN KEY \("superseded_by"\) REFERENCES "bank_reconciliations"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE\n\s+DEFERRABLE INITIALLY DEFERRED;/);
  assert.match(sql, /CHECK \("superseded_by" IS NULL OR "superseded_by" <> "id"\)/);
  assert.match(sql, /ADD CONSTRAINT "bank_reconciliations_status"\n\s+CHECK \("status" IN \('draft', 'reconciled'\)\);/);
  assert.match(sql, /DROP INDEX "bank_reconciliations_userId_entity_id_account_id_year_month_key";/);
  assert.ok(sql.includes('CREATE UNIQUE INDEX "bank_reconciliations_one_current_month"\n  ON "bank_reconciliations" ("userId", "entity_id", "account_id", "year", "month")\n  WHERE "superseded_by" IS NULL;'), 'the partial unique, its WHERE exact');
  // The freeze: a superseded row refuses every update; a reconciled row allows exactly superseded_by NULL → NOT NULL with every other column unchanged.
  const freeze = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION prevent_bank_reconciliation_mutation()'), sql.indexOf('CREATE TRIGGER protect_bank_reconciliation_fields'));
  assert.match(freeze, /IF OLD\.superseded_by IS NOT NULL THEN\n\s+RAISE EXCEPTION 'Bank reconciliation % is superseded — final; nothing on it changes\.', OLD\.id;/);
  assert.match(freeze, /IF OLD\.status = 'reconciled' THEN\n\s+IF NEW\.superseded_by IS NULL/);
  for (const col of ['id', '"userId"', 'entity_id', 'account_id', 'year', 'month', 'statement_balance', 'book_balance', 'adjusted_bank', 'adjusted_book', 'difference', 'status', 'reconciled_at', 'reconciled_by', 'items', 'notes', 'created_at']) {
    assert.ok(freeze.includes(`OR NEW.${col} IS DISTINCT FROM OLD.${col}`), col);
  }
  assert.doesNotMatch(freeze, /updated_at/, 'updated_at is excepted — Prisma’s @updatedAt writes it');
  assert.match(freeze, /RAISE EXCEPTION 'Bank reconciliation % is reconciled — frozen; it is re-opened only by supersession \(a new row that replaces it\), and nothing else on it changes\.', OLD\.id;/);
  assert.match(sql, /CREATE TRIGGER protect_bank_reconciliation_fields\nBEFORE UPDATE ON "bank_reconciliations"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_bank_reconciliation_mutation\(\);/);
  assert.match(sql, /RAISE EXCEPTION 'Bank reconciliations cannot be deleted\./);
  assert.match(sql, /CREATE TRIGGER no_bank_reconciliation_deletes\nBEFORE DELETE ON "bank_reconciliations"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_bank_reconciliation_delete\(\);/);
  assert.doesNotMatch(sql, /\bINSERT\b|\bUPDATE "|\bDELETE FROM\b|DROP TABLE|DROP COLUMN/, 'no row rewritten, nothing dropped but the index');
  assert.match(comments(MIGRATION), /AUTHORED, NOT APPLIED\. Claude Code cannot reach Azure Postgres/);
  // The schema: the five-column @@unique is gone (the partial index lives in SQL); superseded_by and its self relation are there.
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model bank_reconciliations {'), schema.indexOf('}', schema.indexOf('model bank_reconciliations {')));
  assert.doesNotMatch(model, /@@unique/);
  assert.match(model, /^\s+superseded_by\s+String\?$/m);
  assert.match(model, /@relation\("bank_reconciliation_supersede", fields: \[superseded_by\], references: \[id\], onDelete: Restrict\)/);
  assert.match(model, /@@index\(\[superseded_by\]\)/);
  assert.match(comments(SCHEMA), /DOCUMENTS-02 \(Alex, 2026-10-30, ruling D\): a reconciled month is FROZEN/);
});

test('B the bank-side resolver: mapped and typed → the code and the entity; no code → the commit route’s words; no entityType, or no such entity → the entity words; the two resolutions pinned together', () => {
  const entities = [{ id: 'ent-personal', entity_type: 'personal' }, { id: 'ent-business', entity_type: 'business' }];
  assert.deepEqual(bankSideOf({ name: 'Checking', accountCode: '1010', entityType: 'personal' }, entities), { ok: true, entityId: 'ent-personal', accountCode: '1010' });
  assert.deepEqual(bankSideOf({ name: 'Checking', accountCode: null, entityType: 'personal' }, entities), { ok: false, status: 409, error: 'Linked account "Checking" has no accountCode mapped. Set accountCode on the accounts table first.' });
  assert.deepEqual(bankSideOf({ name: 'Checking', accountCode: '1010', entityType: null }, entities), { ok: false, status: 409, error: 'account "Checking" has no entity — choose one on the Banking tab first' });
  assert.deepEqual(bankSideOf({ name: 'Checking', accountCode: '1010', entityType: 'trading' }, entities), { ok: false, status: 409, error: noEntityWords('Checking') });
  assert.equal(bankSideOf({ name: 'x', accountCode: '  ', entityType: 'personal' }, entities).ok, false, 'a blank code is no code');
  // The postings resolve the same way: the code from accounts.accountCode, the entity by entity_type = accounts.entityType — pinned so neither drifts alone.
  const commit = code(COMMIT_ROUTE);
  assert.match(commit, /const bankAccountCode = linkedAccount\.accountCode;/);
  assert.ok(commit.includes(`error: \`Linked account "\${linkedAccount.name}" has no accountCode mapped. Set accountCode on the accounts table first.\`,`), 'the commit route’s words');
  assert.equal(noAccountCodeWords('Acme'), 'Linked account "Acme" has no accountCode mapped. Set accountCode on the accounts table first.');
  assert.match(commit, /where: \{ userId: user\.id, entity_type: linkedAccount\.entityType \},/);
  // The resolver reads nothing else: not entity_id, not a default entity, never a balance.
  const resolver = code('src/lib/books/bankSide.ts');
  assert.doesNotMatch(resolver, /entity_id|is_default|currentBalance|balance/);
});

test('F a period is a month: periodRule, the calendar’s last day (Feb 2028 = 29), Dec → Jan, the words; refused by name; never a Date in a zone', () => {
  assert.deepEqual(periodRule('2026-10'), { ok: true, value: { period: '2026-10', year: 2026, month: 10, period_month: '2026-10-01', period_end: '2026-10-31', words: 'October 2026' } });
  assert.deepEqual(periodRule(' 2028-02 ').ok ? periodRule(' 2028-02 ') : null, { ok: true, value: { period: '2028-02', year: 2028, month: 2, period_month: '2028-02-01', period_end: '2028-02-29', words: 'February 2028' } });
  assert.equal(periodOf(2027, 2).period_end, '2027-02-28');
  assert.equal(periodOf(2100, 2).period_end, '2100-02-28', 'a century year is not a leap year');
  assert.equal(periodOf(2000, 2).period_end, '2000-02-29');
  assert.deepEqual([daysInMonth(2026, 4), daysInMonth(2026, 12), daysInMonth(2026, 9)], [30, 31, 30]);
  assert.deepEqual(previousMonthOf('2027-01-15'), periodOf(2026, 12), 'January’s previous month is the December before');
  assert.deepEqual(previousMonthOf('2026-10-30'), periodOf(2026, 9));
  assert.equal(periodOf(2026, 12).period_end, '2026-12-31');
  assert.deepEqual(periodOfDay('2026-10-01'), OCT);
  for (const bad of ['2026-13', '2026-1', '2026-10-01', 'October 2026', '', null, 202610, undefined]) assert.deepEqual(periodRule(bad), { ok: false, status: 400, error: BAD_PERIOD_WORDS }, String(bad));
  assert.equal(utcDayOf(new Date('2026-10-31T23:59:59.000Z')), '2026-10-31');
  assert.doesNotMatch(code('src/lib/books/period.ts'), /new Date\(|getMonth|getFullYear|toLocaleDateString|getTimezoneOffset/);
});

test('C the numbers are the server’s: the one arithmetic; G ≠ P — statement 9,400.00, book −45.00 → difference 9,445.00, not 0; zero and overdrawn are numbers; the inputs refused by name', () => {
  assert.deepEqual(reconcile(9400, -45, []), { depositsInTransit: 0, outstandingChecks: 0, bankFees: 0, interest: 0, adjustedBank: 9400, adjustedBook: -45, difference: 9445 });
  assert.equal(notReconciledWords(9445), 'difference is $9,445.00 — not reconciled');
  assert.deepEqual(reconcile(-45, -45, []).difference, 0);
  assert.equal(isBalanced(0.004), true);
  assert.equal(isBalanced(0.005), false);
  const items = [
    { type: 'deposit_in_transit' as const, description: 'late deposit', amount: 412, cleared: false },
    { type: 'deposit_in_transit' as const, description: 'cleared deposit', amount: 99, cleared: true },
    { type: 'outstanding_check' as const, description: '#1041', amount: 84.12, cleared: false },
    { type: 'bank_fee' as const, description: 'monthly', amount: 10, cleared: false },
    { type: 'interest' as const, description: 'October', amount: 1.25, cleared: true },
  ];
  assert.deepEqual(reconcile(1000, 1336.63, items), { depositsInTransit: 412, outstandingChecks: 84.12, bankFees: 10, interest: 1.25, adjustedBank: 1327.88, adjustedBook: 1327.88, difference: 0 });
  assert.equal(bookBalanceOf('0', '4500', 'D'), -45, 'the local fixture: one credit of 4,500 cents on a debit-normal account');
  assert.equal(bookBalanceOf('4500', '0', 'C'), -45);
  assert.throws(() => bookBalanceOf('abc', '0', 'D'), /the GL sums are not numbers/);
  // The statement balance: any finite number — zero and overdrawn included — as a number or a plain string.
  assert.deepEqual(statementBalanceRule(0), { ok: true, value: 0 });
  assert.deepEqual(statementBalanceRule('-45.00'), { ok: true, value: -45 });
  for (const bad of ['abc', '', '1,000', null, undefined, NaN, Infinity, true, {}]) assert.deepEqual(statementBalanceRule(bad), { ok: false, status: 400, error: STATEMENT_BALANCE_WORDS }, String(bad));
  // items: an array (absent refused), each item whole — the fault named by its number.
  assert.deepEqual(itemsRule(undefined), { ok: false, status: 400, error: ITEMS_ARRAY_WORDS });
  assert.deepEqual(itemsRule([]), { ok: true, value: [] });
  assert.deepEqual(itemsRule([items[0], { type: 'outstanding_check', description: '#1', cleared: false }]), { ok: false, status: 400, error: 'item 2 has no amount' });
  assert.equal(itemAmountWords(2), 'item 2 has no amount');
  assert.deepEqual(itemsRule([{ type: 'refund', description: 'x', amount: 1, cleared: false }]), { ok: false, status: 400, error: itemTypeWords(1) });
  assert.deepEqual(itemsRule([{ type: 'bank_fee', description: '  ', amount: 1, cleared: false }]), { ok: false, status: 400, error: itemDescriptionWords(1) });
  assert.deepEqual(itemsRule([{ type: 'bank_fee', description: 'fee', amount: 1 }]), { ok: false, status: 400, error: itemClearedWords(1) });
  assert.deepEqual(itemsRule([{ type: 'bank_fee', description: ' fee ', amount: '2.50', cleared: true }]), { ok: true, value: [{ type: 'bank_fee', description: 'fee', amount: 2.5, cleared: true }] });
  // status and reopen: the two words, nothing defaulted.
  assert.deepEqual(statusRule('final'), { ok: false, status: 400, error: STATUS_WORDS });
  assert.deepEqual(statusRule(undefined), { ok: false, status: 400, error: STATUS_WORDS });
  assert.deepEqual(statusRule('reconciled'), { ok: true, value: 'reconciled' });
  assert.deepEqual(reopenRule(undefined), { ok: true, value: false });
  assert.deepEqual(reopenRule(true), { ok: true, value: true });
  assert.deepEqual(reopenRule('true'), { ok: false, status: 400, error: REOPEN_FLAG_WORDS });
  // The body: bookBalance refused in its own words; an unknown field by its name.
  assert.deepEqual(bodyFieldsRule({ accountId: 'a', period: '2026-10', bookBalance: 1 }), { ok: false, status: 400, error: BOOK_BALANCE_FIELD_WORDS });
  assert.equal(BOOK_BALANCE_FIELD_WORDS, 'bookBalance is not a field — the books compute it');
  assert.deepEqual(bodyFieldsRule({ periodEnd: '2026-10-31' }), { ok: false, status: 400, error: unknownReconciliationFieldWords('periodEnd') });
  assert.deepEqual(bodyFieldsRule({ accountId: 'a', period: '2026-10', statementBalance: 1, items: [], status: 'draft', reopen: true }), { ok: true });
  assert.equal(moneyWords(-45), '-$45.00');
  assert.equal(moneyWords(1234567.891), '$1,234,567.89');
});

test('E no reconciled without its statement: the gate — the books first, then the difference, then the statement; its words', () => {
  const bookSide = { ok: true as const };
  assert.deepEqual(reconciledGate({ bookSide, difference: 0, statement: stmt(), period: OCT }), { ok: true });
  assert.deepEqual(reconciledGate({ bookSide, difference: 0, statement: null, period: OCT }), { ok: false, status: 409, error: 'attach the bank statement for October 2026 first' });
  assert.deepEqual(reconciledGate({ bookSide, difference: 9445, statement: stmt(), period: OCT }), { ok: false, status: 409, error: 'difference is $9,445.00 — not reconciled' });
  assert.deepEqual(reconciledGate({ bookSide: { ok: false, status: 409, error: noAccountCodeWords('Checking') }, difference: 0, statement: stmt(), period: OCT }), { ok: false, status: 409, error: noAccountCodeWords('Checking') });
  assert.deepEqual(reconciledGate({ bookSide, difference: null, statement: stmt(), period: OCT }), { ok: false, status: 409, error: NO_DIFFERENCE_YET_WORDS }, 'no statement balance typed yet — said, never $NaN');
  assert.equal(attachStatementWords(periodOf(2028, 2)), 'attach the bank statement for February 2028 first');
  assert.equal(nothingToReopenWords(OCT), 'nothing to re-open — October 2026 is not reconciled');
  assert.equal(supersededWords('2026-10-30'), 'superseded 2026-10-30 — final');
  // The database's own words, surfaced from a Prisma error's text — or null for anything else.
  assert.equal(triggerRefusalOf('Invalid `prisma.bank_reconciliations.update()` invocation:\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "P0001", message: "Bank reconciliation 9c2b is reconciled — frozen; it is re-opened only by supersession (a new row that replaces it), and nothing else on it changes.", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })'),
    'Bank reconciliation 9c2b is reconciled — frozen; it is re-opened only by supersession (a new row that replaces it), and nothing else on it changes.');
  assert.equal(triggerRefusalOf('message: "Bank reconciliations cannot be deleted. Re-open a reconciled month by supersession; a draft is saved over."'), 'Bank reconciliations cannot be deleted. Re-open a reconciled month by supersession; a draft is saved over.');
  assert.equal(triggerRefusalOf('connect ECONNREFUSED'), null);
});

test('F the wire’s row: period and period_end as strings, the month in words, the account block without a balance or Unknown, the statement, the superseded chain under its current row', () => {
  const row = (over: Partial<StoredReconciliation>): StoredReconciliation => ({
    id: 'r1', account_id: 'acc-1', entity_id: 'ent-personal', year: 2026, month: 10,
    statement_balance: -45, book_balance: -45, adjusted_bank: -45, adjusted_book: -45, difference: 0,
    status: 'reconciled', reconciled_at: new Date('2026-10-30T11:00:00.000Z'), reconciled_by: 'alex@local.test',
    items: [], superseded_by: null, created_at: new Date('2026-10-30T10:00:00.000Z'), updated_at: new Date('2026-10-30T11:00:00.000Z'), ...over,
  });
  const account = { id: 'acc-1', name: 'LINK-LAW check cash', mask: null, institution: null };
  const r = reconciliationRowOf(row({}), account, stmt(), []);
  assert.deepEqual(Object.keys(r), ['id', 'accountId', 'entityId', 'period', 'period_end', 'words', 'statementBalance', 'bookBalance', 'adjustedBankBalance', 'adjustedBookBalance', 'difference', 'status', 'items', 'reconciledAt', 'reconciledBy', 'supersededBy', 'supersededOn', 'createdAt', 'account', 'statement', 'history']);
  assert.equal(r.period, '2026-10');
  assert.equal(r.period_end, '2026-10-31');
  assert.equal(r.words, 'October 2026');
  assert.equal(r.reconciledAt, '2026-10-30T11:00:00.000Z');
  assert.deepEqual(r.account, account);
  assert.ok(!('balance' in r.account) && !('periodEnd' in r) && !('currentBalance' in r), 'no balance, no instant for a period');
  // The chain: the current row (newest month first), its superseded rows under it, newest first; a superseded row says its day.
  const old = row({ id: 'r0', superseded_by: 'r1', updated_at: new Date('2026-10-30T12:00:00.000Z') });
  const sept = row({ id: 'r9', month: 9, status: 'draft', reconciled_at: null, reconciled_by: null });
  const list = reconciliationListOf([old, sept, row({ id: 'r1', created_at: new Date('2026-10-30T12:00:00.000Z') })], () => account, (id, p) => (id === 'acc-1' && p === '2026-10' ? stmt() : null));
  assert.deepEqual(list.map((x) => [x.id, x.period, x.statement?.id ?? null, x.history.map((h) => [h.id, h.supersededOn])]), [['r1', '2026-10', 's1', [['r0', '2026-10-30']]], ['r9', '2026-09', null, []]]);
  assert.equal(list[0].history[0].statement, null, 'a superseded row carries no statement — the month’s is on its current row');
  // Malformed stored items are said, never read as none.
  assert.throws(() => reconciliationRowOf(row({ items: [{ type: 'bank_fee' }] }), account, null, []), /holds items the rule cannot read — item 1 has no description/);
});

test('G the pipeline’s word: M = 0 → pending and "no mapped depository account"; N < M → pending with the count; N = M → complete; the previous calendar month, UTC', () => {
  const entities = [{ id: 'ent-personal', entity_type: 'personal' }];
  const mapped = { id: 'a1', name: 'Checking', type: 'depository', accountCode: '1010', entityType: 'personal' };
  const unmapped = { id: 'a2', name: 'Savings', type: 'depository', accountCode: null, entityType: 'personal' };
  const credit = { id: 'a3', name: 'Card', type: 'credit', accountCode: '2010', entityType: 'personal' };
  const none = reconciliationStatusOf({ today: '2026-10-30', accounts: [unmapped, credit], entities, current: [] });
  assert.deepEqual(none, { state: 'pending', period: '2026-09', words: 'September 2026', resolvable: 0, reconciled: 0, subtitle: NO_MAPPED_ACCOUNT_WORDS });
  const some = reconciliationStatusOf({ today: '2026-10-30', accounts: [mapped, { ...mapped, id: 'a4' }, unmapped], entities, current: [{ accountId: 'a1', period: '2026-09', status: 'reconciled' }, { accountId: 'a4', period: '2026-09', status: 'draft' }, { accountId: 'a4', period: '2026-08', status: 'reconciled' }] });
  assert.deepEqual(some, { state: 'pending', period: '2026-09', words: 'September 2026', resolvable: 2, reconciled: 1, subtitle: '1 of 2 accounts reconciled for September 2026' });
  const all = reconciliationStatusOf({ today: '2027-01-03', accounts: [mapped], entities, current: [{ accountId: 'a1', period: '2026-12', status: 'reconciled' }] });
  assert.deepEqual(all, { state: 'complete', period: '2026-12', words: 'December 2026', resolvable: 1, reconciled: 1, subtitle: '1 of 1 accounts reconciled for December 2026' });
  // The pipeline reads it — not a count of rows ever reconciled.
  const p = code(PIPELINE);
  assert.doesNotMatch(p, /reconciledCount/);
  assert.match(p, /subtitle=\{reconStatus === null \? '' : reconStatus\.subtitle\}/);
  assert.match(p, /status=\{reconciled \? 'complete' : 'pending'\}/);
  assert.match(p, /state: phase === 'reconcile' \? 'active' : reconciled \? 'done' : 'pending' \}/);
  assert.match(p, /const reconciled = reconStatus !== null && reconStatus\.state === 'complete';/);
  const rec = p.slice(p.indexOf('<BankReconciliation'), p.indexOf('</BookkeepingSection>', p.indexOf('<BankReconciliation')));
  assert.doesNotMatch(rec, /alert\(/, 'a failed save shows the server’s words in place');
  assert.match(rec, /return \{ ok: false, status: res\.status, error: typeof err\.error === 'string' \? err\.error : `the save answered \$\{res\.status\}` \};/);
  assert.doesNotMatch(rec, /transactions=\{/, 'unclearedTxns is gone — the screen takes no transactions');
  assert.match(comments(PIPELINE), /reconcile ⇐ every resolvable bank account reconciled for the previous\n\s+month \(DOCUMENTS-02, reconciliationStatus\.ts — the server's word\)/);
});

test('A the statement’s address: the form names one of two; account the caller’s and a bank account; one current statement; the list’s three readers; the words', () => {
  const E = 'f2d0a4c2-9a5e-4a0c-9c2f-0d6e4b3c1a11';
  const F = (...v: string[]): FormDataEntryValue[] => v;
  assert.deepEqual(uploadAddressRule({ entry: F(E), account: F(), period: F() }), { ok: true, address: { kind: 'receipt', entryId: E } });
  assert.deepEqual(uploadAddressRule({ entry: F(), account: F('acc-1'), period: F('2026-10') }), { ok: true, address: { kind: 'statement', accountId: 'acc-1', period: OCT } });
  assert.deepEqual(uploadAddressRule({ entry: F(), account: F(), period: F() }), { ok: false, status: 400, error: ONE_ADDRESS_WORDS });
  assert.deepEqual(uploadAddressRule({ entry: F(E), account: F('acc-1'), period: F('2026-10') }), { ok: false, status: 400, error: ONE_ADDRESS_WORDS });
  assert.deepEqual(uploadAddressRule({ entry: F(), account: F(), period: F('2026-10') }), { ok: false, status: 400, error: NO_ACCOUNT_WORDS });
  assert.deepEqual(uploadAddressRule({ entry: F(), account: F('acc-1'), period: F('2026-10-31') }), { ok: false, status: 400, error: BAD_PERIOD_WORDS });
  assert.deepEqual(uploadAddressRule({ entry: F(), account: F('acc-1'), period: F() }), { ok: false, status: 400, error: BAD_PERIOD_WORDS });
  assert.equal(uploadAddressRule({ entry: F('nope'), account: F(), period: F() }).ok, false);
  assert.deepEqual(statementAccountRule(null), { ok: false, status: 404, error: NOT_YOUR_ACCOUNT_WORDS });
  assert.deepEqual(statementAccountRule({ type: 'credit' }), { ok: false, status: 409, error: NOT_DEPOSITORY_WORDS });
  assert.deepEqual(statementAccountRule({ type: 'depository', id: 'a' }), { ok: true, account: { type: 'depository', id: 'a' } });
  assert.deepEqual(statementCurrentRule(true, false), { ok: false, status: 409, error: HAS_STATEMENT_WORDS });
  assert.equal(HAS_STATEMENT_WORDS, 'this month has a statement — replace it');
  assert.deepEqual(statementCurrentRule(false, true), { ok: false, status: 409, error: NOTHING_TO_REPLACE_STATEMENT_WORDS });
  assert.deepEqual(statementCurrentRule(true, true), { ok: true });
  assert.deepEqual(UPLOAD_FIELDS, { file: 'file', entry: 'journal_entry_id', account: 'account_id', period: 'period', replace: 'replace' });
  // The list: entry / entries, OR account + periods — one of the three; months each once, at most 200, each 'YYYY-MM'.
  assert.deepEqual(documentsListInput({ entry: null, entries: null, account: null, periods: null }), { ok: false, status: 400, error: LIST_ONE_OF_WORDS });
  assert.deepEqual(documentsListInput({ entry: E, entries: null, account: 'acc-1', periods: '2026-10' }), { ok: false, status: 400, error: LIST_ONE_OF_WORDS });
  assert.deepEqual(documentsListInput({ entry: null, entries: null, account: 'acc-1', periods: null }), { ok: false, status: 400, error: LIST_ONE_OF_WORDS });
  assert.deepEqual(documentsListInput({ entry: E, entries: null, account: null, periods: null }), { ok: true, kind: 'receipt', ids: [E] });
  assert.deepEqual(documentsListInput({ entry: null, entries: null, account: 'acc-1', periods: '2026-10,2026-09,2026-10' }), { ok: true, kind: 'statement', accountId: 'acc-1', months: [OCT, periodOf(2026, 9)] });
  assert.deepEqual(documentsListInput({ entry: null, entries: null, account: 'acc-1', periods: '2026-10,nope' }), { ok: false, status: 400, error: BAD_PERIOD_WORDS });
  const many = Array.from({ length: MAX_ENTRIES_PER_READ + 1 }, (_, i) => periodOf(2000 + Math.floor(i / 12), (i % 12) + 1).period).join(',');
  assert.deepEqual(documentsListInput({ entry: null, entries: null, account: 'acc-1', periods: many }), { ok: false, status: 400, error: `${MAX_ENTRIES_PER_READ + 1} months named — at most ${MAX_ENTRIES_PER_READ} in one read` });
  // The words and the meta.
  assert.equal(STATEMENT_WORDS, 'Statement');
  assert.equal(NO_STATEMENT_WORDS, 'No statement');
  assert.equal(statementLineWords(stmt()), 'Statement: oct.pdf · 14.1 KiB · PDF');
  assert.deepEqual(documentMetaOf({ id: 's1', journal_entry_id: null, account_id: 'acc-1', period_month: new Date('2026-10-01T00:00:00.000Z'), file_name: 'oct.pdf', content_type: 'application/pdf', byte_size: 14_489, uploaded_at: new Date('2026-10-30T10:00:00.000Z') }), stmt());
  // The upload route handles both addresses with ONE create and ONE mark; the list GET the three readers.
  const d = code(DOCS_ROUTE);
  const post = d.slice(d.indexOf('export async function POST('), d.indexOf('export async function GET('));
  assert.match(post, /const named = uploadAddressRule\(\{ entry: form\.getAll\(UPLOAD_FIELDS\.entry\), account: form\.getAll\(UPLOAD_FIELDS\.account\), period: form\.getAll\(UPLOAD_FIELDS\.period\) \}\);/);
  assert.match(post, /const owned = statementAccountRule\(account\);/);
  assert.match(post, /where: \{ user_id: user\.id, kind: 'statement', account_id: address\.accountId, period_month: periodMonth, superseded_by: null \},/);
  assert.match(post, /address\.kind === 'receipt' \? currentRule\(current !== null, replace\.replace\) : statementCurrentRule\(current !== null, replace\.replace\)/);
  assert.equal((post.match(/tx\.source_documents\.create\(/g) ?? []).length, 1);
  assert.equal((post.match(/tx\.source_documents\.updateMany\(/g) ?? []).length, 1);
  assert.match(post, /kind: address\.kind, \.\.\.where,/);
  const get = d.slice(d.indexOf('export async function GET('));
  assert.match(get, /documentsListInput\(\{ entry: q\.get\('entry'\), entries: q\.get\('entries'\), account: q\.get\('account'\), periods: q\.get\('periods'\) \}\)/);
  assert.match(get, /where: \{ user_id: user\.id, kind: 'statement', superseded_by: null, account_id: input\.accountId, period_month: \{ in: input\.months\.map\(\(m\) => dateColumnOf\(m\.period_month\)\) \} \},/);
  // The panel sends the address it was given — the posting, or the account and its month.
  const panel = code(PANEL);
  assert.match(panel, /form\.append\(UPLOAD_FIELDS\.account, address\.account_id\);\n\s+form\.append\(UPLOAD_FIELDS\.period, address\.period\);/);
});

test('B C D the routes: the book side read once (readBookSide) by both; no upsert — findFirst then create or update in one transaction; the re-open marks then creates; the trigger’s words surfaced; the gate order; no silent number', () => {
  const r = code(RECON_ROUTE);
  const get = r.slice(r.indexOf('export async function GET('), r.indexOf('export async function POST('));
  const post = r.slice(r.indexOf('export async function POST('));
  for (const body of [get, post]) {
    const g = body.indexOf('getVerifiedEmail()'), t = body.indexOf("requireTabAccess(user.id, 'tab:books')"), p = body.indexOf('prisma.');
    assert.ok(g >= 0 && t > g && body.indexOf('prisma.users.findFirst(') > g && t > body.indexOf('prisma.users.findFirst(') && p >= 0, 'cookie → user → Books’ entitlement before any other read');
  }
  assert.doesNotMatch(r, /upsert|\|\| 0\b|\|\| \[\]|\|\| 'Unknown'|\|\| 'draft'|parseFloat|toISOString\(\), \/\/|new Date\(r\.year|new Date\(year|new Date\(periodEnd|getMonth|currentBalance|\bbalance:/);
  assert.match(post, /const side = await readBookSide\(prisma, user, accountId, period\.value\);/);
  assert.match(post, /const figures = reconcile\(statement\.value, side\.book_balance, items\.value\);/);
  assert.match(post, /if \(!isBalanced\(figures\.difference\)\) return NextResponse\.json\(\{ error: notReconciledWords\(figures\.difference\) \}, \{ status: 409 \}\);/);
  assert.match(post, /if \(side\.statement === null\) return NextResponse\.json\(\{ error: attachStatementWords\(period\.value\) \}, \{ status: 409 \}\);/);
  assert.match(post, /const fields = bodyFieldsRule\(body\);/);
  assert.match(post, /const saved = await prisma\.\$transaction\(async \(tx\) => \{\n\s+const current = await tx\.bank_reconciliations\.findFirst\(\{\n\s+where: \{ userId: user\.id, account_id: accountId, year, month, superseded_by: null \},/);
  const marks = post.indexOf("tx.bank_reconciliations.updateMany({ where: { id: current.id, userId: user.id, superseded_by: null }, data: { superseded_by: id } })");
  const creates = post.indexOf('tx.bank_reconciliations.create({ data: { id, userId: user.id, account_id: accountId, year, month, ...data }');
  assert.ok(marks > 0 && creates > marks, 'the re-open marks the old row, then inserts the new one');
  assert.match(post, /if \(current === null \|\| current\.status !== 'reconciled'\) return \{ ok: false as const, status: 409 as const, error: nothingToReopenWords\(period\.value\) \};/);
  assert.match(post, /tx\.bank_reconciliations\.update\(\{ where: \{ id: current\.id \}, data, include: ROW_INCLUDE \}\)/);
  assert.match(post, /const words = triggerRefusalOf\(error\.message\);\n\s+if \(words !== null\) return NextResponse\.json\(\{ error: words \}, \{ status: 409 \}\);/);
  assert.match(post, /reconciled_at: status\.value === 'reconciled' \? new Date\(\) : null,\n\s+reconciled_by: status\.value === 'reconciled' \? userEmail : null,/);
  // The GET: the statements joined by the caller's own rows; the account block without a balance; the pipeline's word from the same rows.
  assert.match(get, /user_id: user\.id, kind: 'statement', superseded_by: null,/);
  assert.match(r, /institution: r\.account\.plaid_items\?\.institutionName \?\? null/);
  assert.match(get, /const status = reconciliationStatusOf\(\{\n\s+today: utcDayOf\(new Date\(\)\),/);
  assert.match(get, /return NextResponse\.json\(\{ reconciliations: list, status \}\);/);
  // The book-side route and the reader: the same reader, the GL sum as of period_end::date, nothing from accounts.currentBalance.
  const b = code(BOOK_SIDE_ROUTE);
  assert.match(b, /const side = await readBookSide\(prisma, user, accountId, period\.value\);/);
  assert.doesNotMatch(b, /currentBalance|\bbalance:/);
  const rb = code(READ_BOOK_SIDE);
  assert.match(rb, /AND je\.date <= \$\{period\.period_end\}::date/);
  assert.match(rb, /je\.is_reversal = false\n\s+AND je\.reversed_by_entry_id IS NULL/);
  assert.match(rb, /const side = bankSideOf\(account, entities\);/);
  assert.match(rb, /where: \{ user_id: user\.id, kind: 'statement', account_id: account\.id, period_month: dateColumnOf\(period\.period_month\), superseded_by: null \},/);
  assert.doesNotMatch(rb, /currentBalance|entity_id: account|is_default|new Date\(/);
});

test('H the screen: no `|| 0`, no toLocaleDateString, no alert, no Plaid balance; the month chosen; the statement line and panel at the account-month; the gate’s words on the control; PeriodClose reads the period by string; the showroom citations re-pointed', () => {
  const c = code(COMPONENT);
  assert.doesNotMatch(c, /\|\| 0\b|\|\| \[\]|\|\| ''/);
  assert.doesNotMatch(c, /toLocaleDateString|alert\(|new Date\(|getMonth|periodEnd|unclearedTxns|\.balance\b|currentBalance|parseFloat/);
  assert.match(c, /useState<string>\(previousMonthOf\(today\)\.period\)/);
  assert.match(c, /<input type="month" value=\{period\}/);
  assert.match(c, /fetch\(`\/api\/bank-reconciliations\/book-side\?accountId=\$\{encodeURIComponent\(accountId\)\}&period=\$\{month\.period\}`\)/);
  assert.match(c, /address=\{\{ account_id: accountId, period: month\.period \}\}\n\s+kind=\{STATEMENT_KIND_WORDS\}/);
  assert.match(c, /reconcile\(stmt\.value, bookSide\.side\.book_balance, read\.value\)/, 'the figures over the SERVER’s book balance');
  assert.match(c, /const gate = month === null \? null : reconciledGate\(\{/);
  assert.match(c, /disabled=\{saving \|\| gate === null \|\| !gate\.ok\}/);
  assert.match(c, /onClick=\{\(\) => save\('draft', true\)\} disabled=\{saving\} className="px-4 py-2 border rounded text-sm" data-reconciliation-reopen>/);
  assert.match(c, /\{figures !== null && \(isBalanced\(figures\.difference\) \? ' ✓ RECONCILED' : ' ≠ NOT BALANCED'\)\}/);
  assert.match(c, /supersededWords\(old\.supersededOn \?\? ''\)/);
  assert.match(c, /\{saveWords !== null && <p className="text-brand-red text-sm mb-2" role="alert" data-save-refusal>\{saveWords\}<\/p>\}/);
  // The interface the screen takes carries no balance.
  const option = c.slice(c.indexOf('export interface ReconciliationAccountOption {'), c.indexOf('}', c.indexOf('export interface ReconciliationAccountOption {')));
  assert.doesNotMatch(option, /balance/);
  // PeriodClose: the month by string.
  const pc = code(PERIOD_CLOSE);
  assert.match(pc, /r\.status === 'reconciled' && Number\(r\.period\.slice\(0, 4\)\) === selectedYear/);
  assert.match(pc, /months\.add\(Number\(r\.period\.slice\(5, 7\)\) - 1\);/);
  assert.doesNotMatch(pc, /periodEnd/);
  // The showroom cites the component's line — the one that renders "✓ RECONCILED".
  const line = c.split('\n').findIndex((l) => l.includes("' ✓ RECONCILED'")) + 1;
  assert.ok(line > 0);
  const cites = [...comments(SHOWCASE).matchAll(/BankReconciliation\.tsx:(\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual(cites, [line, line], `the two citations name :${line}`);
  assert.match(code(SHOWCASE), /✓ RECONCILED/);
});
