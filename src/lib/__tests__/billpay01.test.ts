/**
 * BILLPAY-01 (Alex, 2026-10-28) — BILL PAY: EVERY BILL, EVERY DUE DAY, PAID OR NOT.
 *
 * Ruling A: a bill is an all-day routine's costed line (or stepless routine) that names an every-occurrence vendor; the
 * others are named in one line. Ruling B: one row per bill per due day in a bounded window, the house's columns. Ruling C:
 * one read route over the reused rules. Ruling D: no new writes — the existing link picker. Ruling E: the registry, the
 * census, the plan row. Ruling F: no schema, no migration.
 *
 * The rule is driven over fixtures; the route, the page and the registry are pinned to their source with comments
 * stripped (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  BILL_COLUMNS, BILL_HEAD_WORDS, KIND_WORDS, NO_CREDIT_LINE_WORDS, SEVERAL_ACCOUNTS_WORDS, UNPAID_STATUSES, billPayOf, billPayTable, monthWindowOf, noVendorWords, shiftMonth,
  type BillLinkRow, type BillPayInput, type BillPosting, type BillRoutine, type BillRow,
} from '../operations/billPay';
import { BILL_POSTING_SELECT, POSTING_STATE_SELECT } from '../calendar/postingAmount';
import { occurrenceKey, type RoutinePlanInput } from '../budget/days';
import type { PlanVendorRow } from '../budget/planLines';
import { columnOf } from '../table/columns';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';
import { TOOL_GATE } from '../offer';
import { PHASES_RENDERED_AT, navFamilies, navToolByName } from '../nav';
import { CAPABILITY_GROUPS, CELL_MARK, PLANS, cellState } from '../offer/plans';

const ROUTE = 'src/app/api/bill-pay/route.ts';
const RULE = 'src/lib/operations/billPay.ts';
const SECTION = 'src/components/workbench/operations/billpay/BillPaySection.tsx';
const PAGE = 'src/app/bill-pay/page.tsx';
const REGISTRY = 'src/lib/toolRegistry.ts';
const MIDDLEWARE = 'src/middleware.ts';
const LA = 'America/Los_Angeles';
const BKK = 'Asia/Bangkok';

// ── FIXTURES ────────────────────────────────────────────────────────────────

const BOOKS = [{ id: 'P', name: 'Personal', entity_type: 'personal' }];
const chartRow = (code: string, name: string, account_type = 'expense') => ({ code, name, account_type, entity_id: 'P' });
const CHARTS = { P: [chartRow('6300', 'Phone'), chartRow('6100', 'Rent'), chartRow('6080', 'Hosting'), chartRow('6200', 'Fitness'), chartRow('6400', 'Insurance'), chartRow('1010', 'Checking', 'asset'), chartRow('2100', 'Card', 'liability')] };

const plan = (o: Partial<RoutinePlanInput> & { id: string; name: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: LA, scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=7;BYHOUR=0;BYMINUTE=0;BYSECOND=0', startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], ...o,
});
const bill = (o: Partial<RoutinePlanInput> & { id: string; name: string }, role = 'all_day', lineNames: Record<string, string> = {}): BillRoutine => ({ plan: plan(o), role, lineNames });
const everyVendor = (id: string, on: { routine_id?: string; step_id?: string }, vendor_name: string): PlanVendorRow => ({
  id, routine_id: on.routine_id ?? null, step_id: on.step_id ?? null, task_id: null, occurrence_at: null, vendor: { id: `v-${id}`, vendor_name, entity_id: 'P' }, routine: null, step: null, task: null,
});
const posting = (cents: number, credit: { code: string; name: string } | null, state: Partial<BillPosting> = {}): BillPosting => ({
  status: 'posted', is_reversal: false, reversed_by_entry_id: null,
  ledger_entries: [
    { entry_type: 'D', amount: BigInt(cents), account: { code: '6300', name: 'Phone', entity_id: 'P' } },
    ...(credit === null ? [] : [{ entry_type: 'C', amount: BigInt(cents), account: { ...credit, entity_id: 'P' } }]),
  ],
  ...state,
});
const link = (journal_entry_id: string, target_kind: 'routine' | 'routine_line', target_id: string, instant: string, journal_entry: BillPosting): BillLinkRow => ({ target_kind, target_id, target_instant: new Date(instant), journal_entry_id, journal_entry });

/** 01:00Z on Oct 8 — Oct 7, 18:00 in Los Angeles (west of the viewer) and Oct 8, 08:00 in Bangkok (east). */
const NOW = new Date('2026-10-08T01:00:00.000Z');
const CHECKING = { code: '1010', name: 'Checking' };
const CARD = { code: '2100', name: 'Card' };

const PHONE = bill({ id: 'phone', name: 'Phone bill', budgetAmount: '45', coaCode: '6300' });
const RENT = bill({ id: 'rent', name: 'Rent', timezone: BKK, budgetAmount: '500', coaCode: '6100' });
const HOSTING = bill({ id: 'hosting', name: 'Hosting', timezone: BKK, scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=0;BYMINUTE=0;BYSECOND=0', steps: [{ id: 'server', stepOrder: 1, budgetAmount: '20', coaCode: '6080' }, { id: 'domain', stepOrder: 2, budgetAmount: '2', coaCode: '6080' }] }, 'all_day', { server: 'Server', domain: 'Domain' });
const GYM = bill({ id: 'gym', name: 'Gym', scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=0;BYMINUTE=0;BYSECOND=0', budgetAmount: '30', coaCode: '6200' });
const INSURANCE = bill({ id: 'insurance', name: 'Insurance', scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=3;BYHOUR=0;BYMINUTE=0;BYSECOND=0', budgetAmount: '120', coaCode: '6400' });
const APPLE = bill({ id: 'apple', name: 'Apple storage', budgetAmount: '3', coaCode: '6300' });
const NOT_ALL_DAY = bill({ id: 'coffee', name: 'Coffee', budgetAmount: '5', coaCode: '6300' }, 'place');
const UNCOSTED = bill({ id: 'uncosted', name: 'Uncosted' });

const VENDORS = [
  everyVendor('pv-phone', { routine_id: 'phone' }, 'Tel Co'),
  everyVendor('pv-rent', { routine_id: 'rent' }, 'Landlord'),
  everyVendor('pv-server', { step_id: 'server' }, 'Host Co'),
  everyVendor('pv-gym', { routine_id: 'gym' }, 'Gym Co'),
  everyVendor('pv-insurance', { routine_id: 'insurance' }, 'Insure Co'),
  everyVendor('pv-coffee', { routine_id: 'coffee' }, 'Luka Café'),
  everyVendor('pv-uncosted', { routine_id: 'uncosted' }, 'Nobody'),
];
const PHONE_OCT = '2026-10-07T07:00:00.000Z'; // 00:00 PDT
const PHONE_NOV = '2026-11-07T08:00:00.000Z'; // 00:00 PST
const RENT_OCT = '2026-10-06T17:00:00.000Z';  // 00:00 Bangkok on Oct 7
const SERVER_OCT = '2026-09-30T17:00:00.000Z'; // 00:00 Bangkok on Oct 1
const GYM_OCT = '2026-10-15T07:00:00.000Z';
const INSURANCE_OCT = '2026-10-03T07:00:00.000Z';
const LINKS = [
  link('je-server', 'routine_line', 'server', SERVER_OCT, posting(2000, CHECKING)),
  link('je-gym-rev', 'routine', 'gym', GYM_OCT, posting(3000, CHECKING, { status: 'reversed', reversed_by_entry_id: 'je-gym-rev-r' })),
  link('je-ins-a', 'routine', 'insurance', INSURANCE_OCT, posting(7000, CHECKING)),
  link('je-ins-b', 'routine', 'insurance', INSURANCE_OCT, posting(5000, CARD)),
  // Off the rule: Phone bill has no occurrence at 00:00 on Oct 8 in Los Angeles.
  link('je-phone-off', 'routine', 'phone', '2026-10-08T07:00:00.000Z', posting(4500, CHECKING)),
];
const INPUT: BillPayInput = { from: '2026-10-01', to: '2026-11-30', now: NOW, books: BOOKS, charts: CHARTS, routines: [PHONE, RENT, HOSTING, GYM, INSURANCE, APPLE, NOT_ALL_DAY, UNCOSTED], vendors: VENDORS, links: LINKS };
const RESULT = billPayOf(INPUT);
const rowsOf = (): readonly BillRow[] => { assert.ok(RESULT.ok, 'the rule read'); return RESULT.rows; };
const rowAt = (bill: string, due: string): BillRow => {
  const r = rowsOf().filter((x) => x.bill === bill && x.due === due);
  assert.equal(r.length, 1, `${bill} on ${due} is one row`);
  return r[0];
};

// ── RULING A · WHAT A BILL IS ──────────────────────────────────────────────

test('A a bill: an all-day routine’s costed line or stepless routine with an every-occurrence vendor; the rest named in one line', () => {
  const bills = new Set(rowsOf().map((r) => r.sub_account));
  assert.deepEqual([...bills].sort(), ['Gym', 'Insurance', 'Phone bill', 'Rent', 'Server']);
  assert.ok(!rowsOf().some((r) => r.bill === 'Coffee'), 'a routine that is not all-day is not a bill, vendor or not');
  assert.ok(!rowsOf().some((r) => r.bill === 'Uncosted'), 'an all-day routine with no amount is not a bill');
  assert.ok(!rowsOf().some((r) => r.sub_account === 'Domain'), 'a costed line with no vendor is not a row');
  assert.ok(RESULT.ok);
  assert.equal(RESULT.said[0], '2 all-day expenses name no vendor — not bills until they do: Apple storage, Domain');
  assert.equal(noVendorWords(['Apple storage', 'Hosting', 'Phone bill']), '3 all-day expenses name no vendor — not bills until they do: Apple storage, Hosting, Phone bill', 'the ruling’s words');
  assert.equal(noVendorWords(['Phone bill']), '1 all-day expense names no vendor — not a bill until it does: Phone bill');
  // An occurrence-grain vendor alone is not an every-occurrence vendor.
  const occOnly = billPayOf({ ...INPUT, routines: [APPLE], vendors: [{ ...everyVendor('pv-a', { routine_id: 'apple' }, 'Apple'), occurrence_at: new Date(PHONE_OCT) }] });
  assert.ok(occOnly.ok);
  assert.deepEqual(occOnly.rows, []);
  assert.deepEqual(occOnly.said, ['1 all-day expense names no vendor — not a bill until it does: Apple storage']);
});

// ── RULING B · ONE ROW PER BILL PER DUE DAY ─────────────────────────────────

test('B a monthly bill on the 7th → one row per month in the window, keyed by its occurrence, in the routine’s own zone', () => {
  const phone = rowsOf().filter((r) => r.bill === 'Phone bill' && r.status !== 'link off the rule');
  assert.deepEqual(phone.map((r) => [r.due, r.instant]), [['2026-10-07', PHONE_OCT], ['2026-11-07', PHONE_NOV]]);
  const oct = rowAt('Phone bill', '2026-10-07');
  assert.deepEqual(oct, {
    id: occurrenceKey({ routineId: 'phone', lineId: null, instant: new Date(PHONE_OCT) }), due: '2026-10-07', kind: 'routine', target_id: 'phone', instant: PHONE_OCT, routine_id: 'phone',
    book: 'Personal', account: 'P-6300', account_name: 'Phone', sub_account: 'Phone bill', vendor: 'Tel Co', bill: 'Phone bill',
    amount_cents: 4500, paid_cents: null, paid_postings: 0, paid_unreadable: 0, paid_reversed: 0, paid_from: null, status: 'due today',
  });
});

test('B a line bill: KIND routine line, SUB ACCOUNT NAME the line’s, BILL the routine’s, its own account', () => {
  const server = rowAt('Hosting', '2026-10-01');
  assert.equal(server.kind, 'routine_line');
  assert.equal(server.target_id, 'server');
  assert.equal(server.sub_account, 'Server');
  assert.equal(server.account, 'P-6080');
  assert.equal(server.account_name, 'Hosting');
  assert.equal(server.vendor, 'Host Co');
  assert.equal(server.id, occurrenceKey({ routineId: 'hosting', lineId: 'server', instant: new Date(SERVER_OCT) }));
  assert.equal(KIND_WORDS.routine_line, 'routine line');
});

test('B status: overdue the day after in the routine’s zone, due today while it is still the due day there — east and west of the viewer — and upcoming', () => {
  assert.equal(rowAt('Rent', '2026-10-07').status, 'overdue', 'Bangkok (east): Oct 8 already — Oct 7 is past, nothing pays it');
  assert.equal(rowAt('Rent', '2026-10-07').instant, RENT_OCT, 'its due day is Bangkok’s Oct 7 — 17:00Z on Oct 6');
  assert.equal(rowAt('Phone bill', '2026-10-07').status, 'due today', 'Los Angeles (west): still Oct 7 — never overdue on its own day');
  assert.equal(rowAt('Phone bill', '2026-11-07').status, 'upcoming');
  const later = billPayOf({ ...INPUT, now: new Date('2026-10-08T07:00:00.000Z') });
  assert.ok(later.ok);
  assert.equal(later.rows.find((r) => r.bill === 'Phone bill' && r.due === '2026-10-07')?.status, 'overdue', 'Oct 8 in Los Angeles: now it is overdue');
  assert.deepEqual(UNPAID_STATUSES, ['due today', 'upcoming', 'overdue']);
});

test('B paid: a posting linked to that occurrence exactly; PAID its amount; PAID FROM the credit line’s account', () => {
  const server = rowAt('Hosting', '2026-10-01');
  assert.equal(server.status, 'paid');
  assert.equal(server.paid_cents, 2000);
  assert.equal(server.paid_postings, 1);
  assert.equal(server.paid_from, 'P-1010 · Checking');
  assert.equal(rowAt('Hosting', '2026-11-01').status, 'upcoming', 'the next month’s occurrence is its own row — the join is exact');
});

test('B PAID FROM: two paying postings credited from two accounts → "several accounts"; PAID their sum', () => {
  const ins = rowAt('Insurance', '2026-10-03');
  assert.equal(ins.status, 'paid');
  assert.equal(ins.paid_cents, 12000);
  assert.equal(ins.paid_from, SEVERAL_ACCOUNTS_WORDS);
  const noCredit = billPayOf({ ...INPUT, links: [link('je-x', 'routine', 'insurance', INSURANCE_OCT, posting(100, null))] });
  assert.ok(noCredit.ok);
  assert.equal(noCredit.rows.find((r) => r.bill === 'Insurance' && r.due === '2026-10-03')?.paid_from, NO_CREDIT_LINE_WORDS, 'no credit line — said, never blank');
});

test('B a reversed linked posting pays nothing: the row is unpaid and the table says how many were reversed', () => {
  const gym = rowAt('Gym', '2026-10-15');
  assert.equal(gym.status, 'upcoming');
  assert.equal(gym.paid_cents, null);
  assert.equal(gym.paid_postings, 0);
  assert.equal(gym.paid_reversed, 1);
  assert.equal(gym.paid_from, null);
  assert.ok(RESULT.ok);
  assert.ok(RESULT.said.includes('1 linked posting was reversed — MATCH leaves it out'), 'reversedLinkedWords, LINK-LAW-01’s');
});

test('B a link off the rule is its own row, "link off the rule" — never counted as paid or unpaid', () => {
  const off = rowsOf().filter((r) => r.status === 'link off the rule');
  assert.equal(off.length, 1);
  assert.equal(off[0].bill, 'Phone bill');
  assert.equal(off[0].due, '2026-10-08');
  assert.equal(off[0].amount_cents, null);
  assert.equal(off[0].paid_cents, null);
  assert.equal(rowAt('Phone bill', '2026-10-07').status, 'due today', 'the occurrence beside it stays unpaid');
});

test('B the window clips a 1971-anchored rule: a daily stepless bill with no start date yields only the window’s days', () => {
  const daily = bill({ id: 'fee', name: 'Daily fee', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=0;BYSECOND=0', budgetAmount: '1', coaCode: '6300' });
  const r = billPayOf({ ...INPUT, from: '2026-10-01', to: '2026-10-03', routines: [daily], vendors: [everyVendor('pv-fee', { routine_id: 'fee' }, 'Bank')], links: [] });
  assert.ok(r.ok);
  assert.deepEqual(r.rows.map((x) => x.due), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.throws(() => billPayOf({ ...INPUT, from: '2026-10-05', to: '2026-10-01' }), /is not a span of days/);
});

test('B the table: the house’s order, the shared factories; DUE a day, AMOUNT and PAID money (blank never 0); the month window', () => {
  assert.deepEqual(BILL_COLUMNS.map((k) => BILL_HEAD_WORDS[k]), ['DUE', 'KIND', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'BILL', 'AMOUNT', 'PAID', 'PAID FROM', 'STATUS', 'ID']);
  const cols = billPayTable();
  assert.deepEqual(cols.map((c) => c.key), [...BILL_COLUMNS]);
  const phone = rowAt('Phone bill', '2026-10-07');
  assert.equal(columnOf(cols, 'amount').words(phone), '$45.00');
  assert.equal(columnOf(cols, 'paid').words(phone), '—', 'nothing pays it: blank, never $0');
  assert.equal(columnOf(cols, 'due').csv(phone), '2026-10-07');
  assert.equal(columnOf(cols, 'kind').words(phone), 'routine');
  assert.deepEqual(monthWindowOf('2026-10-28'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(shiftMonth('2026-10-01', -1), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(shiftMonth('2026-12-01', 1), { from: '2027-01-01', to: '2027-01-31' });
  assert.deepEqual(monthWindowOf('2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
});

test('B every rule is imported, none restated', () => {
  const rule = code(RULE);
  for (const piece of [
    "import { buildRoutineBudgetLines, isIsoDay, occurrenceKey, readOccurrenceKey, type NotPlaced, type NotPlacedReason, type RoutinePlanInput } from '@/lib/budget/days';",
    "import { planHoldsOf, type PlanVendorRow } from '@/lib/budget/planLines';",
    "import { routinePlanned } from '@/lib/operations/routineLines';",
    "import { linkKeyOf, matchOf, readableMatchCents, type LedgerMatch } from '@/lib/operations/ledger';",
    "import { occurrenceCheck } from '@/lib/operations/linkOccurrence';",
    "import { amountCentsOf, isReversedPosting, reversedLinkedWords, type PostingState } from '@/lib/calendar/postingAmount';",
    "import { stopName } from '@/components/workbench/operations/day/dayCard';",
  ]) assert.ok(rule.includes(piece), piece);
  assert.doesNotMatch(rule, /expandBetween|expandForward|function matchOf|function isReversedPosting|@prisma\/client|\bfetch\(|new Date\(\)|Date\.now/, 'no second copy; pure — no clock but the caller’s');
});

// ── RULING C · THE ROUTE ────────────────────────────────────────────────────

test('C the route: the caller first (401 / 404), the window by spanInput (400 by name), every query user-scoped, ONE links read, not public', () => {
  const r = code(ROUTE);
  const at = (s: string) => { const i = r.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const order = [
    'const userEmail = await getVerifiedEmail();',
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    'const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: \'insensitive\' } } });',
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const span = spanInput(request.nextUrl.searchParams.get('from'), request.nextUrl.searchParams.get('to'));",
    "if (!span.ok) return NextResponse.json({ error: 'Validation', field: span.field, message: span.message }, { status: 400 });",
    'const entities = await prisma.entities.findMany({ where: { userId: user.id },',
  ].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'auth, then the window, then the reads');
  assert.equal((r.match(/planned_item_links\.findMany\(/g) ?? []).length, 1, 'one links read');
  assert.match(r, /where: \{ user_id: user\.id, target_kind: \{ in: \['routine', 'routine_line'\] \}, target_instant: window, journal_entry: \{ userId: user\.id \} \},\n\s*select: \{ target_kind: true, target_id: true, target_instant: true, journal_entry_id: true, journal_entry: \{ select: BILL_POSTING_SELECT \} \},/, 'scoped to the caller twice; the posting with its state and accounts');
  assert.match(r, /where: \{ entity_id: \{ in: entityIds \}, entity: \{ userId: user\.id \} \},/, 'the charts of the caller’s books');
  assert.match(r, /loadRoutineBudgetInputs\(prisma, user\.id, e\.id\)/);
  assert.match(r, /readPlanVendors\(prisma, user\.id, /);
  assert.doesNotMatch(r, /\.(create|update|upsert|delete|deleteMany|createMany|updateMany)\(|export async function (POST|PATCH|PUT|DELETE)/, 'it writes nothing');
  assert.doesNotMatch(r.slice(r.indexOf('Promise.all([')), /for \(const .* of .*\)\s*\{[^}]*prisma\./, 'no query inside a loop');
  assert.deepEqual(BILL_POSTING_SELECT.ledger_entries.select, { entry_type: true, amount: true, account: { select: { code: true, name: true, entity_id: true } } });
  for (const k of Object.keys(POSTING_STATE_SELECT)) assert.ok(k in BILL_POSTING_SELECT, `the reversal state: ${k}`);
  assert.doesNotMatch(code(MIDDLEWARE), /'\/api\/bill-pay'|'\/bill-pay'/, 'not in PUBLIC_PATHS');
});

test('C the loader grew by role, additively', () => {
  const loader = code('src/lib/operations/routineBudgetInputs.ts');
  assert.match(loader, /is_active: true,\n\s*role: true,\n\s*steps: \{ where: \{ is_active: true \}/);
  assert.match(loader, /role: r\.role,/);
});

// ── RULING D · THE PAGE, THE CONTROL, NO WRITE ──────────────────────────────

test('D the page: its own, the opener and the one mount; the control opens the existing link picker on the occurrence; the table re-reads', () => {
  const page = code(PAGE);
  assert.match(page, /<ToolOpener tools=\{\[navToolByName\('Bill Pay', TOOL_GATE\)\]\} \/>/);
  assert.match(page, /<div className="space-y-3" data-tool-page="Bill Pay">\n\s*<BillPaySection \/>\n\s*<\/div>/);
  assert.doesNotMatch(code('src/app/expenses/page.tsx'), /BillPay/, 'not mounted on Expenses');
  const s = code(SECTION);
  assert.match(s, /import LinkPicker from '\.\.\/ledger\/LinkPicker';/, 'the EXISTING picker');
  assert.match(s, /<LinkPicker kind=\{row\.kind\} id=\{row\.target_id\} instant=\{row\.instant\} near=\{row\.due\} onChanged=\{\(\) => setWrites\(\(n\) => n \+ 1\)\} onClose=\{\(\) => setPicking\(null\)\} \/>/);
  assert.match(s, /\{UNPAID_STATUSES\.includes\(row\.status\) \? LINK_PAYMENT_WORDS : PAYMENT_WORDS\}/);
  assert.match(s, /readJson\(`\/api\/bill-pay\?from=\$\{span\.from\}&to=\$\{span\.to\}`, 'Bill Pay'\)/);
  assert.match(s, /\}, \[span, writes\]\);/, 'a link or an unlink re-reads');
  assert.doesNotMatch(s, /method: '(POST|PATCH|DELETE)'|localStorage|sessionStorage|StageStrip/, 'no write of its own; nothing stored; no strip');
  assert.match(s, /onClick=\{\(\) => move\(-1\)\}/);
  assert.match(s, /onClick=\{\(\) => move\(1\)\}/);
  assert.deepEqual(PHASES_RENDERED_AT['/bill-pay'], []);
});

// ── RULING E · THE REGISTRY, THE CENSUS, THE PLAN ROW ───────────────────────

test('E Bill Pay is PARTIAL at /bill-pay with discover and record, its why verbatim; the census 5 · 8 · 12; the rail shows it under MONEY OUT; the gate stays null', () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'Bill Pay');
  assert.ok(t);
  assert.equal(t.status, 'PARTIAL');
  assert.equal(t.home, '/bill-pay');
  assert.deepEqual(t.beats, { discover: true, decide: false, commit: false, record: true });
  assert.equal(t.why, 'every bill and its due days, paid or overdue, from the postings you linked; nothing is paid from here, and the paying account is known only after payment');
  assert.doesNotMatch(t.customer ?? '', /not yet|\.tsx?:|src\/|\b(discover|decide|commit|record)\b|founder|module|registry/i, 'the plan law’s words');
  assert.match(t.citation, /^discover: src\/app\/api\/bill-pay\/route\.ts:\d+ \(GET \/api\/bill-pay/);
  assert.match(t.citation, /record: BillPaySection\.tsx:\d+ \("link payment" on an unpaid row\) → :\d+ the existing ledger\/LinkPicker\.tsx → POST \/api\/calendar\/links/);
  // DOCUMENTS-01 (2026-10-28): source_documents' three back-relations moved the vendor directory :4229 → :4232.
  assert.match(t.citation, /operations_vendor_directory \(schema:4232\)/, 'the stale :3973 re-cited, then moved by DOCUMENTS-01');
  assert.doesNotMatch(t.citation, /schema:3973/);
  // The cited lines say what the citation says.
  const lineOf = (file: string, n: number): string => code(file).split('\n')[n - 1] ?? '';
  const n = (re: RegExp): number => { const m = t.citation.match(re); assert.ok(m, String(re)); return Number(m[1]); };
  assert.match(lineOf(ROUTE, n(/route\.ts:(\d+) \(GET/)), /^export async function GET\(/);
  assert.match(lineOf(RULE, n(/billPay\.ts:(\d+) billPayOf/)), /^export function billPayOf\(/);
  assert.match(lineOf(SECTION, n(/BillPaySection\.tsx:(\d+) \("link payment"/)), /LINK_PAYMENT_WORDS/);
  assert.match(lineOf(SECTION, n(/→ :(\d+) the existing/)), /<LinkPicker /);
  assert.match(lineOf('prisma/schema.prisma', 4232), /^model operations_vendor_directory \{/);
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 8, NOT_BUILT: 12 });
  assert.deepEqual(statusCounts(), { LIVE: 5, PARTIAL: 8, NOT_BUILT: 12 });
  assert.match(comments(REGISTRY), /BILLPAY-01 census \(Alex, 2026-10-28\): Bill Pay PARTIAL — the due list and the manual link; it pays nothing\./);
  assert.match(comments(REGISTRY), /5 · 7 · 13 → 5 · 8 · 12/);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.equal(TOOL_GATE['Bill Pay'], null);
  const money = navFamilies(TOOL_GATE).find((f) => f.name === 'MONEY OUT');
  assert.ok(money);
  const row = money.tools.find((x) => x.name === 'Bill Pay');
  assert.ok(row);
  assert.equal(row.href, '/bill-pay', 'the rail opens it, by derivation');
  assert.equal(row.status, 'PARTIAL');
  assert.equal(navToolByName('Bill Pay', TOOL_GATE).line, t.why, 'the opener prints the registry line');
});

test('E the plan row says what Bill Pay does — relabelled, tool and module unchanged, its cell derived ◐', () => {
  const plans = code('src/lib/offer/plans.ts');
  assert.match(plans, /\{ label: 'Every bill\\'s due days, paid or overdue', tools: \['Bill Pay'\], module: 'business' \},/);
  assert.doesNotMatch(plans, /Bills scheduled and paid on time/);
  const row = CAPABILITY_GROUPS.flatMap((g) => g.rows).find((r) => r.label === 'Every bill\'s due days, paid or overdue');
  assert.ok(row, 'the row');
  assert.deepEqual(row.tools, ['Bill Pay']);
  assert.equal(row.module, 'business');
  const business = PLANS.find((p) => p.modules.includes('business'));
  assert.ok(business);
  assert.equal(CELL_MARK[cellState(business, row)], '◐', 'derived from the registry — PARTIAL');
});
