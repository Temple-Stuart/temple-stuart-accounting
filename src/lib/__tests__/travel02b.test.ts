/**
 * TRAVEL-02b (Alex, 2026-11-03, rulings 0 and A–G) — travel_expenses: a visa, an eSIM or a one-off travel purchase as its
 * own typed row — stated in the currency paid, frozen and voided never deleted, matched to its bank posting by hand
 * through the one link rule (a sixth planned_item_links kind); the TRAVEL LEDGER shows it beside the bookings; STATED and
 * SETTLED sort by code then magnitude.
 *
 * The rules (src/lib/travel/travelExpense.ts) and the ledger leaf (src/lib/reservations/travelLedger.ts) are pure and
 * driven over fixtureTravelExpenses.ts (and 02a's fixtureTravelLedger.ts for the merge); the migration, the schema, the
 * routes, the links route, the trip DELETE and the screens are read through code() / comments() (the reader law) — a
 * route cannot run outside a Next request scope, so its rules are pinned by text and proven on the wire in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { code, comments } from '../sourceText';
import { LINKABLE_KINDS, isLinkableKind, requiresInstant, targetOwnerQuery } from '../calendar/linkKeys';
import { reversedLinkedWords } from '../calendar/postingAmount';
import {
  KIND_WORDS, NO_ACCOUNT_WORDS, NO_BANK_ROW_WORDS, TRAVEL_LEDGER_COLUMNS, TRAVEL_LEDGER_TABLE, TYPED_WORDS, TravelLedgerError, VOIDED_WORDS,
  cellWordsOf, codedSortText, ledgerRowsOf, settledSumLineWords, settledSums, statedSumLineWords, statedSums, travelLedgerColumnOf, travelLedgerCsv,
  typedExpenseRowOf, type TravelLedgerColumn, type TravelLedgerRow,
} from '../reservations/travelLedger';
import { sortRows } from '../table/sort';
import {
  AMOUNT_REQUIRED_WORDS, COA_BLANK_WORDS, CURRENCY_REQUIRED_WORDS, KIND_REQUIRED_WORDS, NOTE_BLANK_WORDS, NOT_AN_OBJECT_WORDS, PAID_ON_REQUIRED_WORDS,
  REASON_REQUIRED_WORDS, TRAVEL_EXPENSE_FIELDS, TRAVEL_EXPENSE_KINDS, TRIP_BLANK_WORDS, VENDOR_BLANK_WORDS, VENDOR_REQUIRED_WORDS,
  alreadyVoidedWords, chartAccountRule, chartChoicesOf, tripHoldsTravelExpensesWords, travelExpenseBodyRule, voidBodyRule, voidStateRule,
  voidedExpenseLinkWords, type ChartRowIn,
} from '../travel/travelExpense';
import { LEDGER_FIXTURE, VIEWER_ZONE } from './fixtureTravelLedger';
import { ESIM_USD, OTHER_REVERSED, OTHER_VOIDED, TYPED_FIXTURE, VISA_PHP, VISA_SPLIT } from './fixtureTravelExpenses';

const MIGRATION = 'prisma/migrations/20261103120000_travel_02b_travel_expenses/migration.sql';
const SCHEMA = 'prisma/schema.prisma';
const RULES = 'src/lib/travel/travelExpense.ts';
const LEAF = 'src/lib/reservations/travelLedger.ts';
const ROUTE = 'src/app/api/travel-expenses/route.ts';
// READS-01a (Alex, 2026-11-07, ruling C): the GET's body is this function, the caller's id as its parameter; the POST stays in the route.
const ANSWER = 'src/lib/travel/travelExpensesAnswer.ts';
const VOID_ROUTE = 'src/app/api/travel-expenses/[id]/void/route.ts';
const LINKS = 'src/app/api/calendar/links/route.ts';
const LINK_KEYS = 'src/lib/calendar/linkKeys.ts';
const PICKER = 'src/components/workbench/operations/ledger/LinkPicker.tsx';
const TRIP_ROUTE = 'src/app/api/trips/[id]/route.ts';
const VIEW = 'src/components/trips/AllBookings.tsx';
const CONTROLS = 'src/components/trips/TravelExpenseControls.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

const typedRows = TYPED_FIXTURE.map(typedExpenseRowOf);
const rowOf = (rows: readonly TravelLedgerRow[], id: string) => {
  const row = rows.find((r) => r.id === id);
  if (row === undefined) throw new Error(`no row ${id}`);
  return row;
};
const cells = (row: TravelLedgerRow): Record<TravelLedgerColumn, string> => {
  const out = {} as Record<TravelLedgerColumn, string>;
  for (const c of TRAVEL_LEDGER_COLUMNS) out[c] = cellWordsOf(row, c);
  return out;
};
const VISA_BODY = { kind: 'visa', paid_on: '2026-10-20', amount_minor: 350000, currency: 'PHP', vendor: 'Bureau of Immigration' };

// ── A · THE TABLE ────────────────────────────────────────────────────────────

test('A the migration: travel_expenses column for column — UUID id, user_id, the three kinds, a DAY, a positive amount, a three-letter currency with NO default, a vendor of 1–120, note, trip_id, coa_code, the void pair, created_at/by; RESTRICT both ways; the two indexes', () => {
  const sql = code(MIGRATION);
  for (const col of [
    /"id"\s+UUID\s+NOT NULL DEFAULT gen_random_uuid\(\),/, /"user_id"\s+TEXT\s+NOT NULL,/, /"kind"\s+VARCHAR\(8\)\s+NOT NULL,/, /"paid_on"\s+DATE\s+NOT NULL,/,
    /"amount_minor"\s+INTEGER\s+NOT NULL,/, /"currency"\s+VARCHAR\(3\)\s+NOT NULL,/, /"vendor"\s+VARCHAR\(120\)\s+NOT NULL,/, /"note"\s+TEXT,/, /"trip_id"\s+TEXT,/,
    /"coa_code"\s+VARCHAR\(50\),/, /"voided_at"\s+TIMESTAMPTZ\(6\),/, /"void_reason"\s+TEXT,/, /"created_at"\s+TIMESTAMPTZ\(6\) NOT NULL DEFAULT now\(\),/, /"created_by"\s+TEXT\s+NOT NULL,/,
  ]) assert.match(sql, col);
  assert.doesNotMatch(sql, /"currency"[^\n]*DEFAULT/, 'no currency is assumed (FX-01)');
  assert.match(sql, /CHECK \("kind" IN \('visa', 'esim', 'other'\)\)/);
  assert.match(sql, /CHECK \("amount_minor" > 0\)/);
  assert.match(sql, /CHECK \(char_length\("currency"\) = 3\)/);
  assert.match(sql, /CHECK \(char_length\(btrim\("vendor"\)\) BETWEEN 1 AND 120\)/);
  assert.match(sql, /CHECK \(\("voided_at" IS NULL AND "void_reason" IS NULL\)\n\s*OR \("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL AND char_length\(btrim\("void_reason"\)\) > 0\)\)/, 'both or neither, the reason never blank');
  assert.match(sql, /FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.match(sql, /FOREIGN KEY \("trip_id"\) REFERENCES "trips"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.match(sql, /CREATE INDEX "travel_expenses_user_id_paid_on_idx" ON "travel_expenses" \("user_id", "paid_on"\);/);
  assert.match(sql, /CREATE INDEX "travel_expenses_user_id_trip_id_idx" ON "travel_expenses" \("user_id", "trip_id"\);/);
  assert.doesNotMatch(sql, /\bINSERT\b|\bUPDATE "|\bDELETE FROM\b/, 'no row written');
  assert.match(comments(MIGRATION), /AUTHORED, NOT APPLIED\. Claude Code cannot reach Azure Postgres/);
});

test('A the triggers (the source_documents precedent): FREEZE — every column but the void pair named, a void once from NULL, nothing else; NO DELETE — and no TRUNCATE', () => {
  const sql = code(MIGRATION);
  const freeze = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION prevent_travel_expense_mutation()'), sql.indexOf('CREATE TRIGGER protect_travel_expense_fields'));
  for (const col of ['id', 'user_id', 'kind', 'paid_on', 'amount_minor', 'currency', 'vendor', 'note', 'trip_id', 'coa_code', 'created_at', 'created_by']) {
    assert.match(freeze, new RegExp(`NEW\\.${col} IS DISTINCT FROM OLD\\.${col}`), col);
  }
  assert.doesNotMatch(freeze, /NEW\.voided_at IS DISTINCT FROM|NEW\.void_reason IS DISTINCT FROM/, 'the void pair is the one change');
  assert.match(freeze, /IF OLD\.voided_at IS NOT NULL OR OLD\.void_reason IS NOT NULL THEN\n\s*RAISE EXCEPTION 'A travel expense is voided once/);
  assert.match(freeze, /IF NEW\.voided_at IS NULL OR NEW\.void_reason IS NULL THEN\n\s*RAISE EXCEPTION 'The one change a travel expense takes is its void/);
  assert.match(sql, /CREATE TRIGGER protect_travel_expense_fields\nBEFORE UPDATE ON "travel_expenses"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_travel_expense_mutation\(\);/);
  assert.match(sql, /RAISE EXCEPTION 'Travel expenses cannot be deleted\. Void one instead/);
  assert.match(sql, /CREATE TRIGGER no_travel_expense_deletes\nBEFORE DELETE ON "travel_expenses"\nFOR EACH ROW\nEXECUTE FUNCTION prevent_travel_expense_delete\(\);/);
  assert.match(sql, /CREATE TRIGGER no_travel_expense_truncate\nBEFORE TRUNCATE ON "travel_expenses"\nFOR EACH STATEMENT\nEXECUTE FUNCTION prevent_travel_expense_delete\(\);/);
});

test('A the schema carries the model last, its relations RESTRICT, and the two back-relations; Prisma cannot hold the CHECKs or the triggers, and says where they live', () => {
  const schema = code(SCHEMA);
  const model = schema.slice(schema.indexOf('model travel_expenses {'), schema.indexOf('@@map("travel_expenses")'));
  for (const field of [/^\s+id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid$/m, /^\s+kind\s+String\s+@db\.VarChar\(8\)$/m, /^\s+paid_on\s+DateTime\s+@db\.Date$/m,
    /^\s+amount_minor\s+Int$/m, /^\s+currency\s+String\s+@db\.VarChar\(3\)$/m, /^\s+vendor\s+String\s+@db\.VarChar\(120\)$/m, /^\s+coa_code\s+String\?\s+@db\.VarChar\(50\)$/m,
    /^\s+voided_at\s+DateTime\?\s+@db\.Timestamptz\(6\)$/m, /^\s+created_by\s+String$/m]) assert.match(model, field);
  assert.match(model, /user users\s+@relation\(fields: \[user_id\], references: \[id\], onDelete: Restrict\)/);
  assert.match(model, /trip trips\?\s+@relation\(fields: \[trip_id\], references: \[id\], onDelete: Restrict\)/);
  assert.match(model, /@@index\(\[user_id, paid_on\]\)/);
  assert.match(model, /@@index\(\[user_id, trip_id\]\)/);
  // TRAVEL-02c (2026-11-03): living_baselines followed it and is the schema's last model now; travel_expenses is the one before it.
  // CRM-01a (2026-11-07): crm_contacts followed living_baselines and is the schema's last now; living_baselines is the one
  // before it. Moved, not loosened.
  assert.ok(schema.trimEnd().endsWith('@@map("crm_contacts")\n}'), 'crm_contacts, last');
  const afterBaselines = schema.slice(schema.indexOf('@@map("living_baselines")'), schema.indexOf('model crm_contacts {'));
  assert.ok(afterBaselines.length > 0 && !/^model /m.test(afterBaselines), 'living_baselines is the model just before it');
  const between = schema.slice(schema.indexOf('@@map("travel_expenses")'), schema.indexOf('model living_baselines {'));
  assert.ok(between.length > 0 && !/^model /m.test(between), 'travel_expenses is the model just before it');
  assert.match(comments(SCHEMA), /TRAVEL-02b \(Alex, 2026-11-03, ruling A\) — A TYPED TRAVEL EXPENSE/);
  assert.match(comments(SCHEMA), /HELD BY THE DATABASE \(prisma\/migrations\/20261103120000_travel_02b_travel_expenses/);
});

// ── B · THE LINK ─────────────────────────────────────────────────────────────

test('B the sixth kind: the migration rewrites the kind CHECK with travel_expense and leaves the instant rule alone; linkKeys names it, keyed on the UUID with no instant, owned by user_id', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "planned_item_links" DROP CONSTRAINT IF EXISTS "planned_item_links_kind";\nALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"\n\s*CHECK \("target_kind" IN \('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item', 'travel_expense'\)\);/);
  assert.doesNotMatch(sql, /instant_iff_routine/, "LINES-01's instant CHECK stands — it already forbids an instant for every kind but the two routine kinds");
  // TRAVEL-02c (2026-11-03): 'stay' followed, last, in its own migration (travel02c.test.ts) — moved, not loosened.
  assert.deepEqual([...LINKABLE_KINDS], ['calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item', 'travel_expense', 'stay']);
  assert.equal(isLinkableKind('travel_expense'), true);
  assert.equal(requiresInstant('travel_expense'), false, 'no instant, like calendar_event, project_task and trip_item');
  const uuid = '00000000-0000-4000-8000-000000000010';
  assert.deepEqual(targetOwnerQuery('travel_expense', uuid, 'u1'), { table: 'travel_expenses', where: { id: uuid, user_id: 'u1' } });
  assert.equal(targetOwnerQuery('travel_expense', 'not-a-uuid', 'u1'), null, 'an id no UUID column holds names no row — the defensive 404');
  assert.match(comments(LINK_KEYS), /TRAVEL-02b \(Alex, 2026-11-03, ruling B\) adds 'travel_expense'/);
});

test('B the one writer: the links POST reads the expense user-scoped after the ownership read and refuses a VOIDED one by name (409) before the posting is read and before the link is written; a reversed posting is refused for every kind', () => {
  const r = code(LINKS);
  const post = r.slice(r.indexOf('export async function POST('), r.indexOf('export async function DELETE('));
  const owns = post.indexOf('if (!(await ownsTarget(targetOwnerQuery(t.kind, t.id, user.id)))) {');
  const block = post.indexOf("if (t.kind === 'travel_expense') {");
  const read = post.indexOf("const expense = await prisma.travel_expenses.findFirst({ where: { id: t.id, user_id: user.id }, select: { vendor: true, voided_at: true, void_reason: true } });");
  const refused = post.indexOf('if (expense.voided_at !== null) return NextResponse.json({ error: voidedExpenseLinkWords(expense.vendor, expense.voided_at, expense.void_reason as string) }, { status: 409 });');
  const posting = post.indexOf('const entry = await prisma.journal_entries.findFirst({');
  const reversed = post.indexOf('if (isReversedPosting(entry)) return NextResponse.json({ error: reversedRefusalWords(entry) }, { status: 409 });');
  const write = post.indexOf('const link = await prisma.planned_item_links.create({');
  assert.ok(owns > 0 && owns < block && block < read && read < refused && refused < posting && posting < reversed && reversed < write, 'ownership → the voided refusal → the posting → its reversal → the write');
  assert.match(r, /case 'travel_expenses': return \(await prisma\.travel_expenses\.findFirst\(\{ where: q\.where, select \}\)\) !== null;/);
  assert.equal(voidedExpenseLinkWords('Grab', new Date('2026-10-24T09:00:00.000Z'), 'typed twice'), 'the travel expense "Grab" was voided on 2026-10-24 ("typed twice") — a voided expense takes no payment');
  // The void never unlinks: no link is touched by the void route.
  assert.doesNotMatch(code(VOID_ROUTE), /planned_item_links/);
});

test('B no second writer: planned_item_links is created and deleted only by the links route and moved only by the routine rekey (the law\'s scan, here over src/); travel_expenses is created only by its POST and changed only by its void — never deleted', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  const files = walk('src').filter((p) => !p.includes('__tests__'));
  const linkWrites: string[] = [];
  const expenseWrites: string[] = [];
  for (const f of files) {
    const src = code(f);
    for (const m of src.matchAll(/planned_item_links\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\s*\(/g)) linkWrites.push(`${f}:${m[1]}`);
    for (const m of src.matchAll(/travel_expenses\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\s*\(/g)) expenseWrites.push(`${f}:${m[1]}`);
    assert.doesNotMatch(src, /(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(\s+TABLE)?)\s+"?travel_expenses/i, `${f} writes travel_expenses in raw SQL`);
  }
  assert.deepEqual(linkWrites.sort(), [`${LINKS}:create`, `${LINKS}:deleteMany`, 'src/app/api/operations/routines/[id]/route.ts:update'].sort());
  assert.deepEqual(expenseWrites.sort(), [`${ROUTE}:create`, `${VOID_ROUTE}:updateMany`].sort());
  // The law carries the sixth kind's own migration beside LINES-01's and TRAVEL-01's — moved, not loosened.
  // TRAVEL-02c (2026-11-03): the seventh kind's own migration beside them — moved, not loosened.
  assert.match(code(LAW), /LINKABLE_KINDS\.filter\(\(k\) => k !== 'routine_line' && k !== 'trip_item' && k !== 'travel_expense' && k !== 'stay'\)/);
});

test('B the picker\'s door: LinkPicker takes no instant for a kind that carries none; the TRAVEL LEDGER mounts it under a typed row — kind travel_expense, its id, null, near its day — behind "link payment" (Bill Pay\'s word)', () => {
  assert.match(code(PICKER), /readonly instant: string \| null;/);
  assert.match(code(PICKER), /data-link-picker=\{`\$\{kind\}:\$\{id\}:\$\{instant === null \? '' : instant\}`\}/);
  const view = code(VIEW);
  assert.match(view, /<LinkPicker kind="travel_expense" id=\{b\.id\} instant=\{null\} near=\{b\.day\} onChanged=\{readAgain\} onClose=\{closePicker\} \/>/);
  assert.match(view, /import \{ LINK_PAYMENT_WORDS \} from '@\/lib\/operations\/billPay';/);
  assert.match(view, /data-travel-expense-link=\{b\.id\}>\{LINK_PAYMENT_WORDS\}<\/button>/);
});

// ── C · THE ROUTES AND THE RULES ─────────────────────────────────────────────

test('C the body rule: a visa in PHP 3,500.00 is 350000 minor units and reads back as sent; every field is refused by name — the kind, the day, the amount, the currency (usd is not USD), a blank vendor, an unknown field, a blank note, trip or code', () => {
  const ok = travelExpenseBodyRule(VISA_BODY);
  assert.deepEqual(ok, { ok: true, value: { kind: 'visa', paid_on: '2026-10-20', amount_minor: 350000, currency: 'PHP', vendor: 'Bureau of Immigration', note: null, trip_id: null, coa_code: null } });
  const refused = (body: unknown, field: string, words: string) => assert.deepEqual(travelExpenseBodyRule(body), { ok: false, field, words });
  refused(null, 'body', NOT_AN_OBJECT_WORDS);
  refused([VISA_BODY], 'body', NOT_AN_OBJECT_WORDS);
  refused({ ...VISA_BODY, amount: 1 }, 'amount', `the expense carries "amount", which is not one of its fields (${TRAVEL_EXPENSE_FIELDS.join(', ')})`);
  refused({ ...VISA_BODY, kind: undefined }, 'kind', KIND_REQUIRED_WORDS);
  assert.equal(KIND_REQUIRED_WORDS, 'kind is required — one of visa, esim, other');
  refused({ ...VISA_BODY, kind: 'flight' }, 'kind', 'kind "flight" is not one of visa, esim, other');
  const { paid_on: _p, ...noDay } = VISA_BODY;
  void _p;
  refused(noDay, 'paid_on', PAID_ON_REQUIRED_WORDS);
  refused({ ...VISA_BODY, paid_on: '2026-02-30' }, 'paid_on', `paid_on "2026-02-30" is not a day — 'YYYY-MM-DD', a day the calendar has`);
  refused({ ...VISA_BODY, paid_on: '2026/10/20' }, 'paid_on', `paid_on "2026/10/20" is not a day — 'YYYY-MM-DD', a day the calendar has`);
  const { amount_minor: _a, ...noAmount } = VISA_BODY;
  void _a;
  refused(noAmount, 'amount_minor', AMOUNT_REQUIRED_WORDS);
  refused({ ...VISA_BODY, amount_minor: 0 }, 'amount_minor', 'amount_minor 0 is not above 0 — an expense is money paid');
  refused({ ...VISA_BODY, amount_minor: -500 }, 'amount_minor', 'amount_minor -500 is not above 0 — an expense is money paid');
  // TRAVEL-02c (2026-11-03, item 0 — 02b-fix call 7): one word for the unit — hundredths, as AMOUNT_REQUIRED_WORDS declares.
  refused({ ...VISA_BODY, amount_minor: 3500.5 }, 'amount_minor', 'amount_minor 3500.5 is not a whole number of hundredths');
  refused({ ...VISA_BODY, amount_minor: '350000' }, 'amount_minor', 'amount_minor "350000" is not a whole number of hundredths');
  refused({ ...VISA_BODY, amount_minor: 2147483648 }, 'amount_minor', 'amount_minor 2147483648 is more than 2147483647 — the most the column holds');
  const { currency: _c, ...noCurrency } = VISA_BODY;
  void _c;
  refused(noCurrency, 'currency', CURRENCY_REQUIRED_WORDS);
  refused({ ...VISA_BODY, currency: 'php' }, 'currency', 'currency "php" is not a three-letter ISO 4217 code in capitals (USD, PHP, …)');
  refused({ ...VISA_BODY, currency: 'usd' }, 'currency', 'currency "usd" is not a three-letter ISO 4217 code in capitals (USD, PHP, …)');
  assert.equal(travelExpenseBodyRule({ ...VISA_BODY, currency: 'USD' }).ok, true, 'USD is a code; usd is not — never upper-cased for the customer');
  refused({ ...VISA_BODY, vendor: '  ' }, 'vendor', VENDOR_BLANK_WORDS);
  refused({ ...VISA_BODY, vendor: 7 }, 'vendor', VENDOR_REQUIRED_WORDS);
  refused({ ...VISA_BODY, vendor: 'x'.repeat(121) }, 'vendor', 'vendor is 121 characters — at most 120');
  refused({ ...VISA_BODY, note: '' }, 'note', NOTE_BLANK_WORDS);
  refused({ ...VISA_BODY, trip_id: ' ' }, 'trip_id', TRIP_BLANK_WORDS);
  refused({ ...VISA_BODY, coa_code: '' }, 'coa_code', COA_BLANK_WORDS);
  refused({ ...VISA_BODY, coa_code: 'P'.repeat(51) }, 'coa_code', 'coa_code is 51 characters — at most 50');
  // Left out and null are the same absence; a stated value reads back as typed — the note TRIMMED since TRAVEL-02b-fix
  // (2026-11-03, ruling B: the vendor and the note are stored trimmed; travel02bfix.test.ts pins both) — moved, not loosened.
  assert.deepEqual(travelExpenseBodyRule({ ...VISA_BODY, note: null, trip_id: null, coa_code: null }), ok);
  const full = travelExpenseBodyRule({ ...VISA_BODY, note: ' 30-day e-visa ', trip_id: 'trip-1', coa_code: 'P-9200' });
  assert.ok(full.ok && full.value.note === '30-day e-visa' && full.value.trip_id === 'trip-1' && full.value.coa_code === 'P-9200');
  assert.deepEqual([...TRAVEL_EXPENSE_KINDS], ['visa', 'esim', 'other']);
});

test('C the chart rule: a coa_code is ONE row of the caller\'s chart read through the one scheme (coa/scheme.ts parseCode) — stored as its account string; a code not in the chart, or two rows, refused by name; the form\'s choices are exactly what the rule accepts', () => {
  const chart: ChartRowIn[] = [
    { code: '9200', name: 'Travel — Visas', entityType: 'personal', bookName: 'Personal' },
    { code: '6100', name: 'Travel', entityType: 'sole_prop', bookName: 'Business' },
    { code: '1010', name: 'Cash', entityType: 'personal', bookName: 'Personal' },
    { code: '1010', name: 'Checking', entityType: 'personal', bookName: 'Trading' },
  ];
  assert.deepEqual(chartAccountRule('P-9200', chart), { ok: true, account: 'P-9200' });
  assert.deepEqual(chartAccountRule('9200', chart), { ok: true, account: 'P-9200' }, 'the bare digits name the one row — stored with its book’s letter');
  assert.deepEqual(chartAccountRule('B-6100', chart), { ok: true, account: 'B-6100' });
  assert.deepEqual(chartAccountRule('B-9200', chart), { ok: false, words: '"B-9200" is not an account in your chart of accounts' }, 'the letter is the book’s — a sole_prop chart has no 9200');
  assert.deepEqual(chartAccountRule('7777', chart), { ok: false, words: '"7777" is not an account in your chart of accounts' });
  assert.deepEqual(chartAccountRule('Travel', chart), { ok: false, words: '"Travel" is not an account in your chart of accounts' });
  const two = chartAccountRule('P-1010', chart);
  assert.deepEqual(two, { ok: false, words: '"P-1010" is 2 accounts in your chart of accounts — "P-1010" "Cash" (Personal) and "P-1010" "Checking" (Trading) — choose it by its book\'s letter (P-, B-, T-), or fix the chart in Books first' });
  assert.deepEqual(chartChoicesOf(chart).map((c) => `${c.account} ${c.name} (${c.book})`), ['B-6100 Travel (Business)', 'P-1010 Cash (Personal)', 'P-1010 Checking (Trading)', 'P-9200 Travel — Visas (Personal)']);
  assert.match(code(RULES), /import \{ parseCode \} from '@\/lib\/coa\/scheme';/);
});

test('C the routes: the /api/reservations gate; every query names the caller; a trip not the caller\'s → 404 by name; a code not in the chart → 409 by name; the row written with the caller and the DAY at UTC midnight; no PUT, no DELETE; no paid call', () => {
  const route = code(ROUTE);
  // READS-01a (Alex, 2026-11-07, ruling C): the GET's body moved verbatim to travelExpensesAnswer.ts (prisma → db,
  // user.id → userId); the route is the gate + `NextResponse.json(await travelExpensesAnswerOf(prisma, user.id))`, the POST
  // unchanged. The gate pin stays on the two routes; no-edit / no-vendor hold the answer file too; the GET's read pins moved.
  const answer = code(ANSWER);
  for (const src of [route, code(VOID_ROUTE)]) {
    assert.match(src, /if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);|if \(!user\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  }
  for (const src of [route, code(VOID_ROUTE), answer]) {
    assert.doesNotMatch(src, /export async function (PUT|PATCH|DELETE)\(/, 'no edit, no delete');
    assert.doesNotMatch(src, /liteapiClient|viatorClient|anthropic|\bopenai\b|stripe/i, 'no paid call, no vendor');
  }
  assert.match(route, /return NextResponse\.json\(await travelExpensesAnswerOf\(prisma, user\.id\)\);/);
  assert.match(answer, /export async function travelExpensesAnswerOf\(db: Db, userId: string\) \{/);
  const reads = [...route.matchAll(/prisma\.(\w+)\.(findMany|findFirst)\(\{\s*where: \{([^\n]*)\}/g)];
  assert.ok(reads.length >= 2, 'the POST\'s trip and chart reads stay on the route');
  for (const m of reads) if (m[1] !== 'users') assert.match(m[3], /\b(userId|user_id): user\.id\b/, `${m[1]} names the caller`);
  const answerReads = [...answer.matchAll(/db\.(\w+)\.(findMany|findFirst)\(\{\s*where: \{([^\n]*)\}/g)];
  assert.ok(answerReads.length >= 6, 'the GET\'s six reads live in the answer function');
  for (const m of answerReads) assert.match(m[3], /\b(userId|user_id): userId\b/, `${m[1]} names the caller`);
  assert.match(route, /if \(v\.trip_id !== null\) \{\n\s*const trip = await prisma\.trips\.findFirst\(\{ where: \{ id: v\.trip_id, userId: user\.id \}, select: \{ id: true \} \}\);\n\s*if \(!trip\) return NextResponse\.json\(\{ error: tripNotYoursWords\(v\.trip_id\), field: 'trip_id' \}, \{ status: 404 \}\);/);
  assert.match(route, /const named = chartAccountRule\(v\.coa_code, chartRowsOf\(chart\)\);\n\s*if \(!named\.ok\) return NextResponse\.json\(\{ error: named\.words, field: 'coa_code' \}, \{ status: 409 \}\);/);
  assert.match(route, /const read = travelExpenseBodyRule\(body\);\n\s*if \(!read\.ok\) return NextResponse\.json\(\{ error: read\.words, field: read\.field \}, \{ status: 400 \}\);/);
  assert.match(route, /user_id: user\.id,\n\s*kind: v\.kind,\n\s*paid_on: new Date\(`\$\{v\.paid_on\}T00:00:00\.000Z`\),\n\s*amount_minor: v\.amount_minor,\n\s*currency: v\.currency,/);
  assert.match(route, /coa_code: account,\n\s*created_by: user\.email,/);
  // The GET: the links by kind and caller, each posting with its state (a reversed one pays nothing), its bank row through the
  // caller's accounts, its current receipts — and the form's two lists from the same chart the POST reads.
  assert.match(answer, /where: \{ user_id: userId, target_kind: 'travel_expense', target_id: \{ in: ids \}, journal_entry: \{ userId: userId \} \},/);
  assert.match(answer, /journal_entry: \{ select: \{ id: true, date: true, source_type: true, source_id: true, \.\.\.LINKED_POSTING_SELECT \} \}/);
  assert.match(answer, /reversed: isReversedPosting\(e\),/);
  assert.match(answer, /where: \{ transactionId: \{ in: sourceIds \}, accounts: \{ userId: userId \} \},/);
  assert.match(answer, /where: \{ user_id: userId, kind: 'receipt', superseded_by: null, journal_entry_id: \{ in: entryIds \} \},/);
  assert.match(answer, /accounts: chartChoicesOf\(chartRowsOf\(chart\)\),/);
  assert.equal(tripHoldsTravelExpensesWords(1), 'A travel expense names this trip — a typed expense is kept for good (a voided one too), so the trip cannot be deleted');
});

test('C the void: { reason } required and never blank, an unknown field refused; the caller\'s row or the defensive 404; voided once — a second void refused by name; one updateMany scoped to a row not yet voided', () => {
  assert.deepEqual(voidBodyRule({}), { ok: false, field: 'reason', words: REASON_REQUIRED_WORDS });
  assert.deepEqual(voidBodyRule({ reason: '   ' }), { ok: false, field: 'reason', words: REASON_REQUIRED_WORDS });
  assert.deepEqual(voidBodyRule({ reason: 5 }), { ok: false, field: 'reason', words: REASON_REQUIRED_WORDS });
  assert.deepEqual(voidBodyRule(null), { ok: false, field: 'reason', words: REASON_REQUIRED_WORDS });
  assert.deepEqual(voidBodyRule({ reason: 'typed twice', why: 'x' }), { ok: false, field: 'why', words: 'the void carries "why", which is not one of its fields (reason)' });
  assert.deepEqual(voidBodyRule({ reason: 'typed twice' }), { ok: true, reason: 'typed twice' });
  assert.equal(REASON_REQUIRED_WORDS, 'a void needs its reason — say why this expense is void');
  assert.deepEqual(voidStateRule({ voided_at: null, void_reason: null }), { ok: true });
  const voidedAt = new Date('2026-10-24T09:00:00.000Z');
  assert.deepEqual(voidStateRule({ voided_at: voidedAt, void_reason: 'typed twice' }), { ok: false, words: 'this expense was voided on 2026-10-24 — "typed twice"; an expense is voided once' });
  assert.equal(alreadyVoidedWords(voidedAt, 'typed twice'), 'this expense was voided on 2026-10-24 — "typed twice"; an expense is voided once');
  assert.throws(() => voidStateRule({ voided_at: voidedAt, void_reason: null }), /half a void/);
  const v = code(VOID_ROUTE);
  assert.match(v, /if \(!isValidUuid\(id\)\) return NextResponse\.json\(\{ error: NO_SUCH_EXPENSE_WORDS \}, \{ status: 404 \}\);/);
  assert.match(v, /const row = await prisma\.travel_expenses\.findFirst\(\{ where: \{ id, user_id: user\.id \}, select: VOID_ANSWER_SELECT \}\);\n\s*if \(!row\) return NextResponse\.json\(\{ error: NO_SUCH_EXPENSE_WORDS \}, \{ status: 404 \}\);/);
  assert.match(v, /const state = voidStateRule\(row\);\n\s*if \(!state\.ok\) return NextResponse\.json\(\{ error: state\.words \}, \{ status: 409 \}\);/);
  assert.match(v, /prisma\.travel_expenses\.updateMany\(\{\n\s*where: \{ id, user_id: user\.id, voided_at: null \},\n\s*data: \{ voided_at: new Date\(\), void_reason: read\.reason \},/);
  assert.doesNotMatch(v, /\.delete\(|deleteMany/);
});

test('C the trip DELETE: a trip a typed expense names (RESTRICT, never deleted) is refused by name BEFORE the first delete — the deletes share no transaction', () => {
  const t = code(TRIP_ROUTE);
  const del = t.slice(t.indexOf('export async function DELETE('), t.indexOf('export async function PATCH('));
  const count = del.indexOf('const typedExpenses = await prisma.travel_expenses.count({ where: { user_id: user.id, trip_id: id } });');
  const refuse = del.indexOf('if (typedExpenses > 0) return NextResponse.json({ error: tripHoldsTravelExpensesWords(typedExpenses) }, { status: 409 });');
  const firstDelete = del.indexOf('deleteMany(');
  assert.ok(count > 0 && count < refuse && refuse < firstDelete, 'count → refuse → the first delete');
  assert.ok(del.indexOf('const linked = await tripLinesLinkedRefusal(user.id, id);') < count, 'LINK-02’s refusal stays first');
  assert.equal(tripHoldsTravelExpensesWords(2), '2 travel expenses name this trip — a typed expense is kept for good (a voided one too), so the trip cannot be deleted');
});

// ── D · THE LEDGER ───────────────────────────────────────────────────────────

test('D a typed row in the same columns: DATE its day, KIND, LANE —, TRIP, BOOK/ACCOUNT through the one scheme (else — / no account), VENDOR as typed, CONFIRMATION and DATES —, STATED in its code, SETTLED, POSTED, DOCUMENT typed, STATUS stated', () => {
  assert.deepEqual(cells(rowOf(typedRows, 'te-visa')), {
    date: '2026-10-20', kind: 'visa', lane: '—', trip: 'unattached', book: '—', account: NO_ACCOUNT_WORDS, vendor: 'Bureau of Immigration', confirmation: '—', dates: '—',
    stated: '3500.00 PHP', settled: 'not matched', posted: 'not posted', document: TYPED_WORDS, status: 'stated', id: 'te-visa',
  });
  assert.equal(NO_ACCOUNT_WORDS, 'no account');
  assert.equal(TYPED_WORDS, 'typed');
  assert.deepEqual(cells(rowOf(typedRows, 'te-esim')), {
    date: '2026-10-21', kind: 'eSIM', lane: '—', trip: 'Bali 2026', book: 'Personal', account: 'P-9200', vendor: 'Airalo', confirmation: '—', dates: '—',
    stated: '$18.00', settled: '$18.00 · 2026-10-21', posted: '2026-10-22', document: 'typed + 1 receipt', status: 'stated', id: 'te-esim',
  });
  assert.equal(rowOf(typedRows, 'te-esim').source, 'typed');
  assert.deepEqual(KIND_WORDS.visa, 'visa');
  assert.deepEqual(KIND_WORDS.esim, 'eSIM');
  assert.deepEqual(KIND_WORDS.other, 'other');
});

test('D a voided row stays — STATUS voided — <reason>, its link still read; a reversed posting pays nothing (not matched, counted); two postings are joined, one with no bank row said so', () => {
  const voided = rowOf(typedRows, 'te-other');
  assert.equal(voided.voided, true);
  assert.equal(cellWordsOf(voided, 'status'), `${VOIDED_WORDS}typed twice`);
  assert.equal(cellWordsOf(voided, 'status'), 'voided — typed twice');
  assert.equal(cellWordsOf(voided, 'settled'), '50.00 THB · 2026-10-23', 'the voided row’s link is still readable');
  assert.equal(cellWordsOf(voided, 'book'), 'Business');
  const reversed = rowOf(typedRows, 'te-reversed');
  assert.equal(cellWordsOf(reversed, 'settled'), 'not matched');
  assert.equal(cellWordsOf(reversed, 'posted'), 'not posted');
  assert.equal(reversed.reversedLinks, 1);
  const split = rowOf(typedRows, 'te-split');
  assert.equal(cellWordsOf(split, 'settled'), `$30.00 · 2026-10-26 + ${NO_BANK_ROW_WORDS}`);
  assert.equal(cellWordsOf(split, 'settled'), '$30.00 · 2026-10-26 + matched — no bank row');
  assert.equal(cellWordsOf(split, 'posted'), '2026-10-26 + 2026-10-27');
  assert.equal(cellWordsOf(split, 'document'), 'typed + 2 receipts');
  // A contradiction is named, never smoothed.
  assert.throws(() => typedExpenseRowOf({ ...VISA_PHP, kind: 'hotel' }), (e: unknown) => e instanceof TravelLedgerError && /kind "hotel" is not one of visa \| esim \| other/.test((e as Error).message));
  assert.throws(() => typedExpenseRowOf({ ...VISA_PHP, voided_at: '2026-10-24T09:00:00.000Z' }), (e: unknown) => e instanceof TravelLedgerError && /half a void/.test((e as Error).message));
  assert.throws(() => typedExpenseRowOf({ ...VISA_PHP, paid_on: '2026-10-32' }), (e: unknown) => e instanceof TravelLedgerError && /is not a day/.test((e as Error).message));
});

test('D the sums: typed rows per currency beside the bookings\'; a voided row leaves both lines and is counted; a reversed posting is counted in the link rule\'s own words; a posting with no bank row is counted, never summed', () => {
  const stated = statedSums(typedRows);
  assert.deepEqual([...stated.byCode.entries()].sort(), [['PHP', 350000], ['USD', 9800]]);
  assert.equal(stated.voided, 1);
  assert.equal(statedSumLineWords(typedRows), 'STATED: 3500.00 PHP · $98.00 · 1 voided');
  const settled = settledSums(typedRows);
  assert.deepEqual([...settled.byCode.entries()], [['USD', BigInt(4800)]]);
  assert.equal(settled.notMatched, 2);
  assert.equal(settled.noBankRow, 1);
  assert.equal(settled.reversed, 1);
  assert.equal(settled.voided, 1);
  assert.equal(settledSumLineWords(typedRows), `SETTLED: $48.00 · 2 not matched · 1 matched with no bank row · ${reversedLinkedWords(1)} · 1 voided`);
  assert.equal(settledSumLineWords(typedRows), 'SETTLED: $48.00 · 2 not matched · 1 matched with no bank row · 1 linked posting was reversed — MATCH leaves it out · 1 voided');
  // Beside the bookings: 02a's lines gain the typed rows, per currency, never one figure across them.
  const all = ledgerRowsOf(LEDGER_FIXTURE, TYPED_FIXTURE, VIEWER_ZONE);
  assert.equal(statedSumLineWords(all), 'STATED: 15845.00 PHP · $262.50 · 1 price not stated · 1 amount not stated · 1 voided');
});

test('0 THE SORT (item 0): STATED and SETTLED by currency code first (A→Z), then minor units within the code; blanks last both ways — never a PHP figure ranked against a USD one', () => {
  assert.equal(codedSortText('USD', -30000), 'USD 0999999999970000');
  assert.equal(codedSortText('usd', 2500), 'USD 1000000000002500');
  assert.equal(codedSortText('PHP', BigInt(1234500)), 'PHP 1000000001234500');
  assert.throws(() => codedSortText('USD', 1.5), /not a whole number/);
  assert.throws(() => codedSortText('USD', BigInt('2000000000000000')), /beyond ±10\^15/);
  const asc = sortRows(typedRows, { column: 'stated', direction: 'asc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(asc.map((r) => r.id), ['te-visa', 'te-other', 'te-esim', 'te-reversed', 'te-split'], 'PHP, THB, then USD 18.00 · 20.00 · 60.00');
  const desc = sortRows(typedRows, { column: 'stated', direction: 'desc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(desc.map((r) => r.id), ['te-split', 'te-reversed', 'te-esim', 'te-other', 'te-visa'], 'the idiom’s reverse');
  const settledAsc = sortRows(typedRows, { column: 'settled', direction: 'asc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(settledAsc.map((r) => r.id), ['te-other', 'te-esim', 'te-split', 'te-reversed', 'te-visa'], 'THB, USD; a part with no bank row, and no match, with the blanks — last');
  const settledDesc = sortRows(typedRows, { column: 'settled', direction: 'desc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(settledDesc.slice(-3).map((r) => r.id), ['te-split', 'te-reversed', 'te-visa'], 'blanks last both ways');
  assert.equal(travelLedgerColumnOf('stated').sortKey(rowOf(typedRows, 'te-visa'))?.kind, 'text');
});

test('D the DAY rule: a typed row\'s DATE is its paid_on — the same day in every viewer\'s zone, on screen and in the CSV; the bookings keep the instant rule; the order is newest first by the booking\'s instant and the typed row\'s day', () => {
  for (const zone of ['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC', VIEWER_ZONE]) {
    const visa = rowOf(ledgerRowsOf([], [VISA_PHP], zone), 'te-visa');
    assert.equal(visa.day, '2026-10-20', zone);
    assert.equal(visa.instant, null);
    assert.equal(travelLedgerColumnOf('date').words(visa), '2026-10-20', zone);
    assert.equal(travelLedgerColumnOf('date').csv(visa), '2026-10-20', zone);
  }
  assert.deepEqual(travelLedgerColumnOf('date').sortKey(rowOf(typedRows, 'te-visa')), { kind: 'text', t: '2026-10-20T00:00:00.000Z' });
  const all = ledgerRowsOf(LEDGER_FIXTURE, TYPED_FIXTURE, VIEWER_ZONE);
  assert.deepEqual(all.map((r) => r.rowKey), [
    'typed:te-split', 'typed:te-reversed', 'booking:res-activity', 'booking:res-hotel-cancelled', 'event:me-refund', 'event:me-fee', 'event:me-voucher-null',
    'typed:te-other', 'booking:res-flight-usd', 'event:me-voucher-flight', 'typed:te-esim', 'booking:res-hotel-php', 'typed:te-visa',
  ]);
});

test('D the CSV: a typed row\'s line — its day, its kind word, the figures bare with their code, SETTLED with its day, the document and status words', () => {
  const lines = travelLedgerCsv([rowOf(typedRows, 'te-visa'), rowOf(typedRows, 'te-esim'), rowOf(typedRows, 'te-other')]).split('\r\n');
  assert.equal(lines[1], '2026-10-20,visa,,unattached,,,Bureau of Immigration,,,3500.00 PHP,,,typed,stated,te-visa');
  assert.equal(lines[2], '2026-10-21,eSIM,,Bali 2026,Personal,P-9200,Airalo,,,18.00 USD,18.00 USD · 2026-10-21,2026-10-22,typed + 1 receipt,stated,te-esim');
  assert.equal(lines[3], '2026-10-23,other,,unattached,Business,B-6100,Grab,,,50.00 THB,50.00 THB · 2026-10-23,2026-10-23,typed,voided — typed twice,te-other');
  assert.doesNotMatch(lines.join('\n'), /\$/, 'no symbol in the CSV');
  // ESIM_USD and the split visa keep their own figures; nothing is converted.
  assert.equal(ESIM_USD.amount_minor + OTHER_REVERSED.amount_minor + VISA_SPLIT.amount_minor, 9800);
  void OTHER_VOIDED;
});

// ── E · THE FORM ─────────────────────────────────────────────────────────────

test('E the form: nothing preselected — the kind, the day, the currency (the runtime\'s list, FX-01b\'s shape), the trip (a trip or unattached, chosen); the account optional; the amount by centsOfTypedDollars; POST, the server\'s words in place, the ledger reads again; "void" with a reason', () => {
  const c = code(CONTROLS);
  for (const state of ["const [kind, setKind] = useState('');", "const [paidOn, setPaidOn] = useState('');", "const [currency, setCurrency] = useState('');", "const [trip, setTrip] = useState('');", "const [account, setAccount] = useState('');"]) assert.ok(c.includes(state), state);
  assert.match(c, /<option value="" disabled>\{CHOOSE_KIND_WORDS\}<\/option>/);
  assert.match(c, /<option value="" disabled>\{CHOOSE_CURRENCY_WORDS\}<\/option>/);
  assert.match(c, /<option value="" disabled>\{CHOOSE_TRIP_WORDS\}<\/option>/);
  assert.match(c, /<option value=\{UNATTACHED_VALUE\}>\{UNATTACHED_WORDS\}<\/option>/);
  assert.match(c, /<option value="">\{NO_ACCOUNT_WORDS\}<\/option>/, 'the account is optional — its empty choice says so');
  assert.match(c, /const currencies = useMemo\(\(\) => runtimeCurrencyCodes\(\), \[\]\);/);
  assert.match(c, /if \(trip === ''\) \{ setRefusal\(TRIP_NOT_CHOSEN_WORDS\); return; \}/, 'the trip is a choice, never defaulted to unattached');
  assert.match(c, /try \{ minor = centsOfTypedDollars\(amount\); \}/);
  assert.match(c, /await fetch\('\/api\/travel-expenses', \{ method: 'POST'/);
  assert.match(c, /await fetch\(`\/api\/travel-expenses\/\$\{encodeURIComponent\(id\)\}\/void`, \{ method: 'POST'/);
  assert.match(c, /if \(!res\.ok\) \{ setRefusal\(await refusalOf\(res\)\); return; \}/);
  const view = code(VIEW);
  assert.match(view, /fetch\('\/api\/travel-expenses'\)/);
  assert.match(view, /\{loaded\.state === 'done' && <TravelExpenseForm trips=\{loaded\.trips\} accounts=\{loaded\.accounts\} onSaved=\{readAgain\} \/>\}/);
  assert.match(view, /\{!b\.voided && <button type="button" className=\{chipClass\}[\s\S]*?data-travel-expense-void=\{b\.id\}>\{VOID_WORDS\}<\/button>\}/);
  assert.match(view, /className=\{`border-t border-border \$\{b\.voided \? 'line-through text-text-muted' : ''\}`\}/, 'a voided row is struck through');
  // The ledger itself still writes nothing and types no word (the bookings law).
  assert.ok(!/\.(post|put|patch|delete)\(|method:\s*'(POST|PUT|PATCH|DELETE)'/i.test(view));
  assert.ok(!/>\s*[A-Za-z][^<{]*</.test(view), 'no typed word');
});

// ── G · THE DOES-NOTS ────────────────────────────────────────────────────────

test('G no || and no ?? default, no $ outside the three formatters, in every file this PR writes; trip_expenses untouched; no edit route', () => {
  for (const f of [RULES, LEAF, ROUTE, VOID_ROUTE, VIEW, CONTROLS]) {
    const src = code(f);
    assert.doesNotMatch(src, /\|\||\?\? /, `${f} has no || and no ?? default`);
    assert.doesNotMatch(src, /\$(?!\{)/, `${f} writes no $ of its own`);
    assert.doesNotMatch(src, /Intl\.NumberFormat|toLocaleString|formatCents|planDollars/, `${f} formats no figure of its own`);
    assert.doesNotMatch(src, /trip_expenses/, `${f} does not touch trip_expenses`);
  }
  const rules = code(RULES);
  assert.doesNotMatch(rules, /prisma|PrismaClient|\bfetch\s*\(|Date\.now|process\.env|from 'react'/, 'the rules are pure');
  // The links route's added lines carry no default either.
  const r = code(LINKS);
  const added = r.slice(r.indexOf("if (t.kind === 'travel_expense') {"), r.indexOf('const entry = await prisma.journal_entries.findFirst({'));
  assert.doesNotMatch(added, /\|\||\?\? /);
});
