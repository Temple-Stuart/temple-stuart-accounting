/**
 * CASH-02a (Alex, 2026-11-08; CASH-00's D1 and D7) — A TYPED EXPENSE SAYS HOW IT WAS PAID: travel_expenses.paid_with
 * ('cash' | 'account'; NULL = not stated — every row typed before, never backfilled), required on every new expense and
 * frozen with the row; a cash-paid expense is never matched to a bank row — the one link writer refuses it and the
 * screen offers no match. Nothing posts: posting a cash expense from cash on hand is CASH-03.
 *
 * The rule (src/lib/travel/travelExpense.ts) and the ledger leaf (src/lib/reservations/travelLedger.ts) are pure and
 * driven here over fixtures typed below; the migration, the schema, the routes, the link writer and the screens are read
 * through code() / comments() (the reader law) — every pin finds its line by content, never by number. The database's
 * own refusals (the CHECK, the freeze) are proven on the local database in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { code, comments, rejoin } from '../sourceText';
import { homeLedgerOf } from '../home/homeLedger';
import {
  CASH_NOT_POSTED_WORDS, TRAVEL_LEDGER_TABLE, TravelLedgerError, cellWordsOf, ledgerRowsOf, offersMatch, settledSumLineWords, settledSums,
  travelLedgerCsv, travelLedgerRows, typedExpenseRowOf, type TravelExpenseIn, type TravelLedgerRow,
} from '../reservations/travelLedger';
import { sortRows } from '../table/sort';
import {
  PAID_WITH_NOT_STATED_WORDS, PAID_WITH_REQUIRED_WORDS, PAID_WITH_WORDS, TRAVEL_EXPENSE_FIELDS, TRAVEL_EXPENSE_KINDS, TRAVEL_EXPENSE_PAID_WITH,
  COA_BLANK_WORDS, cashExpenseLinkWords, isPaidInCash, isTravelExpensePaidWith, paidWithNotAChoiceWords, paidWithWords, travelExpenseBodyRule,
  unknownExpenseFieldWords,
} from '../travel/travelExpense';
import { EXPENSE_SELECT, wireOf } from '../travel/travelExpensesAnswer';
import { LEDGER_FIXTURE, VIEWER_ZONE } from './fixtureTravelLedger';
import { VISA_PHP } from './fixtureTravelExpenses';

const MIGRATION_DIR = '20261108120000_cash_02a_paid_with';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;
const TRAVEL_02B_MIGRATION = 'prisma/migrations/20261103120000_travel_02b_travel_expenses/migration.sql';
const SCHEMA = 'prisma/schema.prisma';
const RULES = 'src/lib/travel/travelExpense.ts';
const ROUTE = 'src/app/api/travel-expenses/route.ts';
const ANSWER = 'src/lib/travel/travelExpensesAnswer.ts';
const LINKS = 'src/app/api/calendar/links/route.ts';
const LEAF = 'src/lib/reservations/travelLedger.ts';
const VIEW = 'src/components/trips/AllBookings.tsx';
const CONTROLS = 'src/components/trips/TravelExpenseControls.tsx';
const HOME_LEAF = 'src/lib/home/homeLedger.ts';
const THIS = 'src/lib/__tests__/cash02a.test.ts';

/** The migration as one artefact — the two halves rejoined, for the whole-file equality alone (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));

/** A new expense as the form sends it — paid in cash, a meal in baht. */
const CASH_BODY = { kind: 'other', paid_on: '2026-11-07', amount_minor: 45000, currency: 'THB', vendor: 'Khao soi stall', coa_code: 'P-6150', paid_with: 'cash' };

const CREATED = '2026-11-08T08:00:00.000Z';
/** A cash-paid meal — never matched, so no postings. */
const CASH_MEAL: TravelExpenseIn = {
  id: 'te-cash', kind: 'other', paid_on: '2026-11-07', amount_minor: 45000, currency: 'THB', vendor: 'Khao soi stall', note: null, trip: null,
  coa_code: 'P-6150', paid_with: 'cash', voided_at: null, void_reason: null, created_at: CREATED, postings: [],
};
/** An eSIM paid from an account — matched by hand to its card posting, as today. */
const CARD_ESIM: TravelExpenseIn = {
  id: 'te-card', kind: 'esim', paid_on: '2026-11-07', amount_minor: 1200, currency: 'USD', vendor: 'Airalo', note: null, trip: null,
  coa_code: null, paid_with: 'account', voided_at: null, void_reason: null, created_at: CREATED,
  postings: [{ journal_entry_id: 'je-card', posted_on: '2026-11-07', reversed: false, bank: { amount: 12, currency: 'USD', date: '2026-11-07' }, receipts: 0 }],
};
/** A row typed before CASH-02a — paid_with NULL, not stated (the TRAVEL-02b fixture's visa). */
const NOT_STATED = VISA_PHP;

const rowOf = (rows: readonly TravelLedgerRow[], id: string): TravelLedgerRow => {
  const row = rows.find((r) => r.id === id);
  if (row === undefined) throw new Error(`no row ${id}`);
  return row;
};

// ── B · THE RULE ─────────────────────────────────────────────────────────────

test('B the body rule: paid_with is REQUIRED — absent or null refused by name; cash and account read back as sent; any other value refused naming it; an unknown field still refused', () => {
  const refused = (body: unknown, field: string, words: string) => assert.deepEqual(travelExpenseBodyRule(body), { ok: false, field, words });
  const { paid_with: _p, ...noWay } = CASH_BODY;
  void _p;
  refused(noWay, 'paid_with', PAID_WITH_REQUIRED_WORDS);
  refused({ ...CASH_BODY, paid_with: null }, 'paid_with', PAID_WITH_REQUIRED_WORDS);
  assert.equal(PAID_WITH_REQUIRED_WORDS, 'paid_with is required — cash, or account (a card or a bank transfer: paid from an account whose posting settles it)');
  const cash = travelExpenseBodyRule(CASH_BODY);
  assert.deepEqual(cash, { ok: true, value: { kind: 'other', paid_on: '2026-11-07', amount_minor: 45000, currency: 'THB', vendor: 'Khao soi stall', note: null, trip_id: null, coa_code: 'P-6150', paid_with: 'cash' } });
  const account = travelExpenseBodyRule({ ...CASH_BODY, paid_with: 'account' });
  assert.ok(account.ok && account.value.paid_with === 'account');
  // Any other value is refused naming it — nothing folded, trimmed or guessed.
  for (const sent of ['card', 'Cash', ' cash', 'CASH', '', 'bank', 1, true, ['cash'], { cash: true }]) {
    refused({ ...CASH_BODY, paid_with: sent }, 'paid_with', paidWithNotAChoiceWords(sent));
  }
  assert.equal(paidWithNotAChoiceWords('card'), 'paid_with "card" is not one of cash, account');
  // An unknown field is still refused by name — and the list it names now carries paid_with, last.
  refused({ ...CASH_BODY, paid_by: 'cash' }, 'paid_by', unknownExpenseFieldWords('paid_by'));
  assert.equal(unknownExpenseFieldWords('paid_by'), 'the expense carries "paid_by", which is not one of its fields (kind, paid_on, amount_minor, currency, vendor, note, trip_id, coa_code, paid_with)');
  assert.deepEqual([...TRAVEL_EXPENSE_FIELDS], ['kind', 'paid_on', 'amount_minor', 'currency', 'vendor', 'note', 'trip_id', 'coa_code', 'paid_with']);
  assert.deepEqual([...TRAVEL_EXPENSE_PAID_WITH], ['cash', 'account']);
  // paid_with is the rule's last field: an earlier refusal still comes first.
  refused({ ...noWay, coa_code: '' }, 'coa_code', COA_BLANK_WORDS);
  // The kinds stay visa | esim | other — a cash meal is kind 'other' with its account.
  assert.deepEqual([...TRAVEL_EXPENSE_KINDS], ['visa', 'esim', 'other']);
  assert.equal(isTravelExpensePaidWith('cash'), true);
  assert.equal(isTravelExpensePaidWith('account'), true);
  assert.equal(isTravelExpensePaidWith(null), false);
  assert.equal(isTravelExpensePaidWith('card'), false);
});

test('B nothing is defaulted: the rule names no default way, and its words live in one place', () => {
  const rules = code(RULES);
  assert.match(rules, /if \(absent\(body, 'paid_with'\)\) return refuse\('paid_with', PAID_WITH_REQUIRED_WORDS\);\n\s*if \(!isTravelExpensePaidWith\(body\.paid_with\)\) return refuse\('paid_with', paidWithNotAChoiceWords\(body\.paid_with\)\);/);
  assert.doesNotMatch(rules, /paid_with\s*(\?\?|\|\|)/, 'no ?? and no || on paid_with');
  assert.doesNotMatch(rules, /paid_with:\s*'(cash|account)'/, 'no way is written for the customer');
  assert.match(comments(RULES), /CASH-02a \(Alex, 2026-11-08; CASH-00's D1 and D7\) — HOW IT WAS PAID/);
});

// ── A · THE MIGRATION AND THE SCHEMA ────────────────────────────────────────

test('A the migration: the newest; exactly the column, the CHECK and TRAVEL-02b\'s freeze body verbatim with paid_with frozen after coa_code — no DEFAULT, no UPDATE, no DROP, the triggers untouched', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.equal(dirs[dirs.length - 2], '20261108111500_services_01_bookkeeping_need', 'right after SERVICES-01\'s');
  // The freeze, as TRAVEL-02b wrote it — the one line added after coa_code, nothing else changed.
  const old = code(TRAVEL_02B_MIGRATION);
  const start = old.indexOf('CREATE OR REPLACE FUNCTION prevent_travel_expense_mutation()');
  const end = old.indexOf('$$ LANGUAGE plpgsql;', start) + '$$ LANGUAGE plpgsql;'.length;
  const freeze = old.slice(start, end);
  const coaLine = '     OR NEW.coa_code IS DISTINCT FROM OLD.coa_code\n';
  assert.equal(freeze.split(coaLine).length, 2, 'TRAVEL-02b names coa_code once');
  const expected = [
    '-- CASH-02a (Alex, 2026-11-08): a typed expense states how it was paid. NULL = not stated — every row typed before this migration; never backfilled.',
    'ALTER TABLE "travel_expenses" ADD COLUMN "paid_with" VARCHAR(8);',
    'ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_paid_with" CHECK ("paid_with" IS NULL OR "paid_with" IN (\'cash\', \'account\'));',
    freeze.replace(coaLine, `${coaLine}     OR NEW.paid_with IS DISTINCT FROM OLD.paid_with\n`),
    '',
  ].join('\n');
  assert.equal(whole(MIGRATION), expected, 'exactly this and nothing else');
  const sql = code(MIGRATION);
  assert.doesNotMatch(sql, /\bDEFAULT\b/, 'no default');
  assert.doesNotMatch(sql, /\bUPDATE\s+"?travel_expenses|\bINSERT\b|\bDELETE\b/i, 'no row written — nothing backfilled');
  assert.doesNotMatch(sql, /\bDROP\b/i, 'nothing dropped');
  assert.doesNotMatch(sql, /CREATE TRIGGER|ALTER TRIGGER|DROP TRIGGER/i, 'the trigger bindings are not touched');
  assert.doesNotMatch(sql, /ADD COLUMN "paid_with"[^;]*NOT NULL/, 'NULL is a row typed before — never refused by the column');
  // The three RAISE words stay TRAVEL-02b's.
  for (const words of ['A travel expense cannot be changed once kept. Only voided_at and void_reason may be set, once, when it is voided.',
    'A travel expense is voided once: voided_at and void_reason cannot change or go back to NULL.',
    'The one change a travel expense takes is its void: voided_at and void_reason, set together.']) assert.ok(sql.includes(`RAISE EXCEPTION '${words}';`), words);
});

test('A the schema: paid_with String? @db.VarChar(8) right after coa_code, with its /// doc — the CHECK, NULL not stated, frozen', () => {
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model travel_expenses {'), schema.indexOf('@@map("travel_expenses")'));
  // The field right after coa_code — the two lines between them are its /// doc (comments(), below).
  assert.match(model, /\n {2}coa_code {5}String\? {3}@db\.VarChar\(50\)\n[ \t]*\n[ \t]*\n {2}paid_with {4}String\? {3}@db\.VarChar\(8\)\n/);
  assert.doesNotMatch(model, /paid_with[^\n]*@default/, 'no default');
  assert.match(comments(SCHEMA), /\/\/\/ CASH-02a \(Alex, 2026-11-08\): how it was paid — 'cash' \| 'account', a CHECK \(travel_expenses_paid_with\); NULL = not\n\s*\/\/\/ stated \(every row typed before CASH-02a — never backfilled\); frozen with the row \(the FREEZE trigger names it\)\./);
});

// ── C · THE ROUTE AND THE ANSWER ────────────────────────────────────────────

test('C the POST writes paid_with as sent; the select reads it; every type between the read and the screen carries it REQUIRED, nullable', () => {
  const route = code(ROUTE);
  assert.match(route, /coa_code: account,\n\s*paid_with: v\.paid_with,\n\s*created_by: user\.email,/);
  assert.match(comments(ROUTE), /POST \{ kind, paid_on, amount_minor, currency, vendor, note\?, trip_id\?, coa_code\?, paid_with \}/);
  assert.match(comments(ROUTE), /CASH-02a \(Alex, 2026-11-08\): paid_with — 'cash' or 'account' — is REQUIRED on every new expense/);
  assert.equal((EXPENSE_SELECT as Record<string, unknown>).paid_with, true);
  const answer = code(ANSWER);
  assert.match(answer, /coa_code: string \| null;\n\s*paid_with: string \| null; voided_at: Date \| null;/);
  assert.match(answer, /coa_code: row\.coa_code,\n\s*paid_with: row\.paid_with,/);
  assert.doesNotMatch(`${answer}\n${code(LEAF)}`, /paid_with\?|paidWith\?/, 'never an optional field');
  assert.match(code(LEAF), /readonly paid_with: string \| null;/);
  assert.match(code(LEAF), /readonly paidWith: TravelExpensePaidWith \| null;/);
  // The wire: the field is there for every row — 'cash', 'account', or NULL as NULL.
  const row = { id: 'e1', kind: 'other', paid_on: new Date('2026-11-07T00:00:00.000Z'), amount_minor: 45000, currency: 'THB', vendor: 'Khao soi stall', note: null, coa_code: null, voided_at: null, void_reason: null, created_at: new Date(CREATED), trip: null };
  for (const way of ['cash', 'account', null]) {
    const wire = wireOf({ ...row, paid_with: way }, []);
    assert.ok(Object.prototype.hasOwnProperty.call(wire, 'paid_with'), 'the key is always there');
    assert.equal(wire.paid_with, way);
    assert.equal(JSON.parse(JSON.stringify(wire)).paid_with, way, 'and survives the JSON wire');
  }
});

// ── D · THE LINK WRITER ─────────────────────────────────────────────────────

test('D the one link writer: the travel_expense branch selects paid_with and refuses a CASH-paid expense by name (409) AFTER the voided refusal — before the posting is read, the link written or the audit row', () => {
  const r = code(LINKS);
  const post = r.slice(r.indexOf('export async function POST('), r.indexOf('export async function DELETE('));
  const block = post.indexOf("if (t.kind === 'travel_expense') {");
  const read = post.indexOf("const expense = await prisma.travel_expenses.findFirst({ where: { id: t.id, user_id: user.id }, select: { vendor: true, voided_at: true, void_reason: true, paid_with: true } });");
  const voided = post.indexOf('if (expense.voided_at !== null) return NextResponse.json({ error: voidedExpenseLinkWords(expense.vendor, expense.voided_at, expense.void_reason as string) }, { status: 409 });');
  const cash = post.indexOf('if (isPaidInCash(expense.paid_with)) return NextResponse.json({ error: cashExpenseLinkWords(expense.vendor) }, { status: 409 });');
  const posting = post.indexOf('const entry = await prisma.journal_entries.findFirst({');
  const write = post.indexOf('const link = await prisma.planned_item_links.create({');
  const audit = post.indexOf('await writeAuditLog({');
  assert.ok(block > 0 && block < read && read < voided && voided < cash && cash < posting && posting < write && write < audit, 'the read → voided → cash → the posting → the write → the audit');
  assert.equal(post.split('cashExpenseLinkWords(').length, 2, 'one refusal');
  assert.match(r, /import \{ cashExpenseLinkWords, isPaidInCash, voidedExpenseLinkWords \} from '@\/lib\/travel\/travelExpense';/);
  assert.match(comments(LINKS), /CASH-02a \(Alex, 2026-11-08\): a cash-paid travel expense is refused by name after the voided one \(409, cashExpenseLinkWords\)\./);
  // 'account' and NULL (not stated) link as today; only 'cash' is refused.
  assert.equal(isPaidInCash('cash'), true);
  assert.equal(isPaidInCash('account'), false);
  assert.equal(isPaidInCash(null), false);
  assert.equal(cashExpenseLinkWords('Khao soi stall'), 'Khao soi stall was paid in cash — cash is posted from cash on hand (CASH-03), never matched to a bank row');
});

// ── THE WORDS ───────────────────────────────────────────────────────────────

test('the words, in one place: cash, from an account, not stated — NULL becomes words only in paidWithWords; a cash row\'s SETTLED is "cash — not posted"', () => {
  assert.deepEqual(PAID_WITH_WORDS, { cash: 'cash', account: 'from an account' });
  assert.equal(PAID_WITH_NOT_STATED_WORDS, 'not stated');
  assert.equal(paidWithWords(null), 'not stated');
  assert.equal(paidWithWords('cash'), 'cash');
  assert.equal(paidWithWords('account'), 'from an account');
  assert.equal(CASH_NOT_POSTED_WORDS, 'cash — not posted');
  // The not-stated words are read nowhere but the words function.
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  const users = walk('src').filter((p) => !p.includes('__tests__') && code(p).includes('PAID_WITH_NOT_STATED_WORDS'));
  assert.deepEqual(users, [RULES]);
  assert.equal(code(RULES).split('PAID_WITH_NOT_STATED_WORDS').length, 3, 'its definition and paidWithWords');
});

// ── E · THE LEDGER ──────────────────────────────────────────────────────────

test('E the typed rows print PAID WITH; a cash row says "cash — not posted" where its bank row would be and offers no match; an account row and a not-stated row keep the match', () => {
  const rows = [CASH_MEAL, CARD_ESIM, NOT_STATED].map(typedExpenseRowOf);
  const cash = rowOf(rows, 'te-cash');
  assert.equal(cellWordsOf(cash, 'paidWith'), 'cash');
  assert.equal(cellWordsOf(cash, 'settled'), 'cash — not posted');
  assert.equal(cellWordsOf(cash, 'posted'), 'not posted');
  assert.equal(cellWordsOf(cash, 'document'), 'typed');
  assert.equal(cellWordsOf(cash, 'status'), 'stated');
  assert.equal(offersMatch(cash), false);
  const card = rowOf(rows, 'te-card');
  assert.equal(cellWordsOf(card, 'paidWith'), 'from an account');
  assert.equal(cellWordsOf(card, 'settled'), '$12.00 · 2026-11-07');
  assert.equal(offersMatch(card), true);
  const notStated = rowOf(rows, 'te-visa');
  assert.equal(cellWordsOf(notStated, 'paidWith'), 'not stated');
  assert.equal(cellWordsOf(notStated, 'settled'), 'not matched');
  assert.equal(offersMatch(notStated), true);
  // A booking's cell is '—' and it offers no typed row's door.
  const booking = travelLedgerRows(LEDGER_FIXTURE, VIEWER_ZONE)[0];
  assert.equal(cellWordsOf(booking, 'paidWith'), '—');
  assert.equal(booking.paidWith, null);
  assert.equal(offersMatch(booking), false);
  // The CSV: the way's words; '' for a row that states none (every absence in the CSV is ''); SETTLED '' for a cash row.
  const lines = travelLedgerCsv([cash, card, notStated]).split('\r\n');
  assert.equal(lines[0], 'DATE,KIND,LANE,TRIP,BOOK,ACCOUNT,VENDOR,CONFIRMATION,DATES,STATED,PAID WITH,SETTLED,POSTED,DOCUMENT,STATUS,ID');
  assert.equal(lines[1], '2026-11-07,other,,unattached,Personal,P-6150,Khao soi stall,,,450.00 THB,cash,,,typed,stated,te-cash');
  assert.equal(lines[2], '2026-11-07,eSIM,,unattached,,,Airalo,,,12.00 USD,from an account,12.00 USD · 2026-11-07,2026-11-07,typed,stated,te-card');
  assert.equal(lines[3], '2026-10-20,visa,,unattached,,,Bureau of Immigration,,,3500.00 PHP,,,,typed,stated,te-visa');
});

test('E the SETTLED sum line counts a cash row by its own words — never "not matched"; a voided cash row is counted voided', () => {
  const rows = [CASH_MEAL, CARD_ESIM, NOT_STATED].map(typedExpenseRowOf);
  const sums = settledSums(rows);
  assert.equal(sums.cashNotPosted, 1);
  assert.equal(sums.notMatched, 1, 'the not-stated visa');
  assert.deepEqual([...sums.byCode.entries()], [['USD', BigInt(1200)]]);
  assert.equal(settledSumLineWords(rows), 'SETTLED: $12.00 · 1 not matched · 1 cash — not posted');
  const voided = typedExpenseRowOf({ ...CASH_MEAL, voided_at: '2026-11-08T09:00:00.000Z', void_reason: 'typed twice' });
  assert.deepEqual([settledSums([voided]).cashNotPosted, settledSums([voided]).voided], [0, 1]);
  assert.equal(settledSumLineWords([voided]), 'SETTLED: 1 voided');
});

test('E PAID WITH sorts by its words, the bookings\' blank cells last both ways; it filters as a VALUE column', () => {
  const rows = ledgerRowsOf([LEDGER_FIXTURE[0]], [CASH_MEAL, CARD_ESIM, NOT_STATED], VIEWER_ZONE);
  const asc = sortRows(rows, { column: 'paidWith', direction: 'asc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(asc.map((r) => r.id), ['te-cash', 'te-card', 'te-visa', LEDGER_FIXTURE[0].id]);
  const desc = sortRows(rows, { column: 'paidWith', direction: 'desc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(desc.map((r) => r.id), ['te-visa', 'te-card', 'te-cash', LEDGER_FIXTURE[0].id], 'the blank last both ways');
  const column = TRAVEL_LEDGER_TABLE.find((c) => c.key === 'paidWith');
  assert.equal(column?.kind, 'value');
  assert.equal(column?.label, 'PAID WITH');
});

test('E a contradiction is named, never smoothed: a way the table does not admit, or a cash row carrying a linked posting, throws by name', () => {
  assert.throws(() => typedExpenseRowOf({ ...CASH_MEAL, paid_with: 'card' }), (e: unknown) => e instanceof TravelLedgerError && /paid_with "card" is not one of cash \| account/.test((e as Error).message));
  assert.throws(() => typedExpenseRowOf({ ...CASH_MEAL, postings: CARD_ESIM.postings }), (e: unknown) => e instanceof TravelLedgerError && /was paid in cash and carries 1 linked posting\(s\) — a cash expense is never matched to a bank row/.test((e as Error).message));
});

// ── E · THE SCREENS ─────────────────────────────────────────────────────────

test('E the TRAVEL LEDGER view: the PAID WITH cell between STATED and SETTLED; "link payment" and its picker only where the leaf\'s offersMatch says — never on a cash row', () => {
  const view = code(VIEW);
  const stated = view.indexOf("{cell(b, 'stated',");
  const paid = view.indexOf("{cell(b, 'paidWith', b.paidWith === null, `${cellClass} whitespace-nowrap`)}");
  const settled = view.indexOf("{cell(b, 'settled',");
  assert.ok(stated > 0 && stated < paid && paid < settled, 'STATED, PAID WITH, SETTLED');
  assert.match(view, /\{offersMatch\(b\) && <button type="button" className=\{chipClass\} onClick=\{\(\) => setPicking\(picking === b\.id \? null : b\.id\)\} aria-expanded=\{picking === b\.id\} data-travel-expense-link=\{b\.id\}>\{LINK_PAYMENT_WORDS\}<\/button>\}/);
  assert.match(view, /\{offersMatch\(b\) && picking === b\.id && \(/);
  assert.equal(view.split('data-travel-expense-link=').length, 2, 'one match door');
  assert.doesNotMatch(view, /'cash'|"cash"/, 'the view names no way — the leaf decides');
});

test('E the form asks PAID WITH — two choices, NOTHING preselected; it refuses to send until one is made, in the server\'s own words', () => {
  const form = code(CONTROLS);
  assert.match(form, /const \[paidWith, setPaidWith\] = useState\(''\);/);
  assert.doesNotMatch(form, /useState\(\s*'(cash|account)'\s*\)|setPaidWith\(\s*'(cash|account)'\s*\)/, 'no initial way, none chosen for the customer');
  assert.match(form, /<select className=\{input\} value=\{paidWith\} onChange=\{\(e\) => setPaidWith\(e\.target\.value\)\} data-travel-expense-field="paid_with">\n\s*<option value="" disabled>\{CHOOSE_PAID_WITH_WORDS\}<\/option>\n\s*\{TRAVEL_EXPENSE_PAID_WITH\.map\(\(p\) => <option key=\{p\} value=\{p\}>\{PAID_WITH_WORDS\[p\]\}<\/option>\)\}/);
  const save = form.slice(form.indexOf('const save = async () => {'), form.indexOf('if (!open) {'));
  const refuse = save.indexOf("if (paidWith === '') { setRefusal(PAID_WITH_REQUIRED_WORDS); return; }");
  const send = save.indexOf("await fetch('/api/travel-expenses'");
  assert.ok(refuse > 0 && refuse < send, 'refused before anything is sent');
  assert.match(save, /const body: Record<string, unknown> = \{ amount_minor: Number\(minor\), vendor, paid_with: paidWith \};/);
  assert.match(form, /setAccount\(''\); setPaidWith\(''\); setRefusal\(null\);/, 'reset clears it');
  // Any other refusal the server gives is shown verbatim (refusalOf, unchanged).
  assert.match(form, /if \(!res\.ok\) \{ setRefusal\(await refusalOf\(res\)\); return; \}/);
});

// ── NOT TOUCHED ─────────────────────────────────────────────────────────────

test('not touched: the home ledger\'s leaf names no way — its MATCH is the travel ledger\'s SETTLED, so a cash row reads "cash — not posted" there and a not-stated row reads as before', () => {
  assert.doesNotMatch(code(HOME_LEAF), /paid_with|paidWith|isPaidInCash/);
  const answer = homeLedgerOf({
    date: '2026-11-07', zone: VIEWER_ZONE, books: [{ id: 'ent-p', name: 'Personal', entityType: 'personal' }], chart: [],
    lines: [], reversedEntryIds: [], taskRows: [], bookings: [], expenses: [CASH_MEAL, { ...NOT_STATED, paid_on: '2026-11-07' }], bank: [],
  });
  const travel = answer.rows.filter((r) => r.source === 'travel');
  assert.deepEqual(travel.map((r) => [r.id, r.matchWords]), [['te-cash', 'cash — not posted'], ['te-visa', 'not matched']]);
});

test('not touched: nothing posts — no cash_voucher source, no journal write in this PR\'s files; this test pins no line number', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  for (const f of walk('src').filter((p) => !p.includes('__tests__'))) assert.doesNotMatch(code(f), /cash_voucher/, `${f} names no cash voucher source — CASH-03's`);
  for (const f of [RULES, ROUTE, ANSWER, LEAF, VIEW, CONTROLS]) assert.doesNotMatch(code(f), /journal_entries\.(create|update)|commitPlaidTransaction|source_type:\s*'/, `${f} posts nothing`);
  assert.doesNotMatch(code(THIS), /\.tsx?:\d+|\.prisma:\d+|\.split\('\\n'\)\.length,/, 'no line number, no line count');
});
