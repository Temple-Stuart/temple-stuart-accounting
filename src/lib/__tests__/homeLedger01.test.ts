/**
 * HOME-LEDGER-01 (Alex, 2026-11-06, rulings A–I) — the home's DAY table: every account with activity on the day card's
 * day, by book, from REAL rows only — the books, the task ledger's records, the travel ledger's stated rows, the bank rows
 * not yet in the books — each row naming its source, every sum per currency, nothing calculated, nothing double counted.
 *
 * The leaf (src/lib/home/homeLedger.ts) is pure and driven over the fixtures below — every expected figure is written out
 * by hand. The route, the screen, the host and the laws are read through code() / comments() (the reader law). H: no pin
 * here names a line number of any file; every pin finds its line by content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  BANK_GROUP_WORDS, BANK_SIGN_WORDS, DATE_REQUIRED_WORDS, DATE_RULE_WORDS, HOME_LEDGER_COLUMNS, HOME_LEDGER_DAY_HEADING, HOME_LEDGER_HEAD_WORDS,
  HOME_LEDGER_ROUTE, HOME_LEDGER_TABLE, IN_THE_BOOKS_WORDS, JOIN_WORDS, NO_ACCOUNT_GROUP_WORDS, SOURCE_WORDS, SUMMARY_HEAD_WORDS,
  TRADING_NOT_CONNECTED_WORDS, ZONE_REQUIRED_WORDS, actualSumWords, dateNotADayWords, homeLedgerCellWords, homeLedgerCsv, homeLedgerGroupsOf,
  homeLedgerOf, homeLedgerQuery, homeLedgerReadOf, homeLedgerRowsOf, isIanaZone, noAccountCountWords, reversedByStatusWords, saidLines,
  signedCentsOf, sumsWords, zoneNotIanaWords, type HomeLedgerInput, type HomeLedgerRow,
} from '../home/homeLedger';
import type { LedgerRow } from '../operations/ledger';
import type { LedgerBookingIn, TravelExpenseIn } from '../reservations/travelLedger';
import { missingListWords } from '../reservations/travelLedger';

const LEAF = 'src/lib/home/homeLedger.ts';
const ROUTE = 'src/app/api/home-ledger/route.ts';
const SCREEN = 'src/components/home/HomeLedger.tsx';
const HOST = 'src/components/answers/AnswersClient.tsx';
const LAWS = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/homeLedger01.test.ts';

// ── THE FIXTURES (DO 1) ─────────────────────────────────────────────────────

const DAY = '2026-11-20';
const MANILA = 'Asia/Manila';
const LOS_ANGELES = 'America/Los_Angeles';

const record = (over: Partial<LedgerRow> & Pick<LedgerRow, 'id' | 'description'>): LedgerRow => ({
  key: `routine_line:${over.id}:2026-11-19T22:00:00.000Z`,
  address: { kind: 'routine_line', id: `step-${over.id}`, instant: '2026-11-19T22:00:00.000Z' },
  match: null,
  day: DAY,
  time: '06:00',
  place: null,
  book: null,
  coa: null,
  vendor: null,
  rating: null,
  note: null,
  cents: null,
  budgetState: 'none',
  outcome: 'done',
  actualCents: null,
  varianceCents: null,
  plannedMinutes: null,
  loggedMinutes: null,
  ...over,
});

const BOOKING: LedgerBookingIn = {
  id: 'res-php',
  // 01:00Z — the day in Manila (09:00), the day before in Los Angeles (17:00 on the 19th).
  createdAt: '2026-11-20T01:00:00.000Z',
  lane: 'hotel',
  provider: 'liteapi',
  displayName: 'Manila hotel',
  providerBookingId: 'HL-PHP',
  confirmation: null,
  status: 'confirmed',
  finalPriceCents: 150000,
  currency: 'PHP',
  checkinDate: DAY,
  checkoutDate: '2026-11-22',
  calendarDay: null,
  trip: null,
  budgetLine: { coaCode: 'P-9100' },
  charge: { matched: false, posted: false, bank: null, postedDay: null, postedEntryId: null },
  receipts: 0,
  moneyEvents: [],
};

const VISA: TravelExpenseIn = {
  id: 'te-visa',
  kind: 'visa',
  paid_on: DAY,
  amount_minor: 35000,
  currency: 'PHP',
  vendor: 'BI Manila',
  note: null,
  trip: null,
  coa_code: null,
  // CASH-02a (2026-11-08): the answer carries paid_with on every row — this one typed before CASH-02a, not stated.
  paid_with: null,
  voided_at: null,
  void_reason: null,
  created_at: '2026-11-20T02:00:00.000Z',
  postings: [],
};

const input = (zone: string, over: Partial<HomeLedgerInput> = {}): HomeLedgerInput => ({
  date: DAY,
  zone,
  books: [
    { id: 'ent-p', name: 'Personal', entityType: 'personal' },
    { id: 'ent-b', name: 'Biz', entityType: 'sole_prop' },
  ],
  chart: [
    { entityId: 'ent-p', code: '6150', name: 'Food & drink', accountType: 'expense', balanceType: 'D' },
    { entityId: 'ent-p', code: '9100', name: 'Flights', accountType: 'expense', balanceType: 'D' },
    { entityId: 'ent-b', code: '6000', name: 'Advertising', accountType: 'expense', balanceType: 'D' },
  ],
  lines: [
    { id: 'l-coffee', journalEntryId: 'je-a', entityId: 'ent-p', code: '6150', entryType: 'D', cents: 1250, day: DAY, description: 'coffee' },
    { id: 'l-ads', journalEntryId: 'je-b', entityId: 'ent-b', code: '6000', entryType: 'D', cents: 2000, day: DAY, description: 'ads' },
    { id: 'l-reversed', journalEntryId: 'je-r', entityId: 'ent-p', code: '6150', entryType: 'D', cents: 999, day: DAY, description: 'reversed one' },
  ],
  reversedEntryIds: ['je-r'],
  taskRows: [
    // Matched to the coffee line (its MATCH is that posting's $12.50); typed $13.00 — ACTUAL stays $12.50, once, on the books row.
    record({ id: 'rec-coffee', description: 'Coffee', book: 'Personal', coa: { account: 'P-6150', name: 'Food & drink' }, cents: 300, budgetState: 'matched', actualCents: 1300, varianceCents: 1000, match: { cents: 1250, postings: 1, unreadable: 0, reversed: 0 } }),
    // Matched to nothing — 'no account', counted (decision 12).
    record({ id: 'rec-gym', description: 'Gym', actualCents: 500 }),
  ],
  bookings: [BOOKING],
  expenses: [VISA],
  bank: [
    { id: 't-usd', day: DAY, amount: 42.1, currency: 'USD', name: 'grocery', merchantName: 'Market', reviewStatus: 'pending_review' },
    { id: 't-null', day: DAY, amount: 7, currency: null, name: 'unstated', merchantName: null, reviewStatus: 'pending_review' },
  ],
  ...over,
});

const rowOf = (rows: readonly HomeLedgerRow[], key: string): HomeLedgerRow => {
  const row = rows.find((r) => r.rowKey === key);
  if (row === undefined) throw new Error(`no row ${key} among ${rows.map((r) => r.rowKey).join(' ')}`);
  return row;
};
const words = (row: HomeLedgerRow): Record<string, string> => Object.fromEntries(HOME_LEDGER_COLUMNS.map((c) => [c, homeLedgerCellWords(row, c)]));

// ── A. THE QUERY — the 400s by name ────────────────────────────────────────

test('A the day and the zone: each required and valid, or the first bad one by name — nothing defaulted', () => {
  assert.deepEqual(homeLedgerQuery(null, MANILA), { ok: false, field: 'date', message: DATE_REQUIRED_WORDS });
  assert.deepEqual(homeLedgerQuery('', MANILA), { ok: false, field: 'date', message: DATE_REQUIRED_WORDS });
  assert.deepEqual(homeLedgerQuery('2026-13-40', MANILA), { ok: false, field: 'date', message: dateNotADayWords('2026-13-40') });
  assert.equal(dateNotADayWords('nope'), 'date "nope" is not a day (YYYY-MM-DD)');
  assert.deepEqual(homeLedgerQuery(DAY, null), { ok: false, field: 'zone', message: ZONE_REQUIRED_WORDS });
  assert.deepEqual(homeLedgerQuery(DAY, ''), { ok: false, field: 'zone', message: ZONE_REQUIRED_WORDS });
  assert.deepEqual(homeLedgerQuery(DAY, 'Mars/Base'), { ok: false, field: 'zone', message: zoneNotIanaWords('Mars/Base') });
  assert.equal(zoneNotIanaWords('Mars/Base'), 'zone "Mars/Base" is not an IANA time zone');
  assert.deepEqual(homeLedgerQuery(DAY, MANILA), { ok: true, date: DAY, zone: MANILA });
  assert.equal(isIanaZone(' '), false, 'a blank is refused — Intl would take the system zone in silence');
  assert.equal(isIanaZone(LOS_ANGELES), true);
});

// ── B, C. THE ROWS — REAL only, one per fact, each naming its source and its day's rule ──

test('B the books: a line per P&L ledger line on the day, ACTUAL net in the account\'s direction, the reversed entry left out and counted', () => {
  const { rows, reversedByStatus } = homeLedgerRowsOf(input(MANILA));
  assert.equal(reversedByStatus, 1);
  assert.equal(rows.filter((r) => r.source === 'books').length, 2, 'the reversed line is not a row');
  const coffee = words(rowOf(rows, 'books:l-coffee'));
  assert.deepEqual(coffee, {
    date: `${DAY}${JOIN_WORDS}journal date`, source: 'books', book: 'Personal', account: 'P-6150', accountName: 'Food & drink', description: 'coffee', vendor: '—',
    stated: '—', actual: '$12.50', typedActual: '—', match: '—', state: IN_THE_BOOKS_WORDS, id: 'l-coffee',
  });
  const ads = words(rowOf(rows, 'books:l-ads'));
  assert.equal(ads.book, 'Business');
  assert.equal(ads.account, 'B-6000');
  assert.equal(ads.actual, '$20.00');
  // The model's netting (report.ts figuresOf): a credit on a debit-normal account subtracts; a debit on a credit-normal account too.
  assert.equal(signedCentsOf({ entryType: 'C', cents: 500, journalEntryId: 'je-x' }, 'D'), -500);
  assert.equal(signedCentsOf({ entryType: 'C', cents: 500, journalEntryId: 'je-x' }, 'C'), 500);
  assert.throws(() => signedCentsOf({ entryType: 'X', cents: 1, journalEntryId: 'je-x' }, 'D'), /entry type "X"/);
  assert.throws(() => signedCentsOf({ entryType: 'D', cents: 12.5, journalEntryId: 'je-x' }, 'D'), /not a whole, non-negative number of cents/);
});

test('B the task ledger: TYPED ACTUAL the record\'s own cents, MATCH as the task ledger prints it, BOOK and ACCOUNT the matched line\'s; no line → "no account", counted', () => {
  const answer = homeLedgerOf(input(MANILA));
  const coffee = words(rowOf(answer.rows, 'task:rec-coffee'));
  assert.deepEqual(coffee, {
    date: `${DAY}${JOIN_WORDS}routine's day`, source: 'task ledger', book: 'Personal', account: 'P-6150', accountName: 'Food & drink', description: 'Coffee', vendor: '—',
    stated: '—', actual: '—', typedActual: '$13.00', match: '$12.50', state: 'done', id: 'rec-coffee',
  });
  const gym = words(rowOf(answer.rows, 'task:rec-gym'));
  assert.equal(gym.account, NO_ACCOUNT_GROUP_WORDS);
  assert.equal(gym.book, '—');
  assert.equal(gym.accountName, '—');
  assert.equal(gym.typedActual, '$5.00');
  assert.equal(gym.match, '—');
  assert.equal(answer.said.noAccount, 1);
  assert.equal(noAccountCountWords(1), '1 record with no account — no plan line matched');
});

test('B the travel ledger: the rows the ledger builds, on the day by ITS date rule — a booking at 01:00Z is the day in Manila and the day before in Los Angeles; a typed expense by its paid_on', () => {
  const manila = homeLedgerOf(input(MANILA));
  const booking = words(rowOf(manila.rows, 'travel:booking:res-php'));
  assert.deepEqual(booking, {
    date: `${DAY}${JOIN_WORDS}your day`, source: 'travel ledger', book: 'Personal', account: 'P-9100', accountName: 'Flights', description: 'booking · unattached', vendor: 'liteapi · Manila hotel',
    stated: '1500.00 PHP', actual: '—', typedActual: '—', match: 'not matched', state: 'confirmed', id: 'res-php',
  });
  const visa = words(rowOf(manila.rows, 'travel:typed:te-visa'));
  assert.equal(visa.date, `${DAY}${JOIN_WORDS}paid on`);
  assert.equal(visa.account, 'no account');
  assert.equal(visa.book, '—');
  assert.equal(visa.stated, '350.00 PHP');
  assert.equal(visa.vendor, 'BI Manila');
  assert.equal(visa.state, 'stated');
  assert.equal(rowOf(manila.rows, 'travel:booking:res-php').instant, '2026-11-20T01:00:00.000Z', 'the instant rides the row for the CSV');

  const la = homeLedgerOf(input(LOS_ANGELES));
  assert.equal(la.rows.some((r) => r.rowKey === 'travel:booking:res-php'), false, 'placed by the zone: the 19th in Los Angeles');
  assert.equal(la.rows.some((r) => r.rowKey === 'travel:typed:te-visa'), true, 'a DAY is a day in every zone');
  assert.equal(la.rows.length, manila.rows.length - 1);
});

test('B the bank, not yet in the books: each in its account\'s currency through bankMoneyWords; no COA; never in ACTUAL; an unstated currency named, never summed', () => {
  const answer = homeLedgerOf(input(MANILA));
  const usd = words(rowOf(answer.rows, 'bank:t-usd'));
  assert.deepEqual(usd, {
    date: `${DAY}${JOIN_WORDS}bank date`, source: 'bank — not yet in the books', book: '—', account: '—', accountName: '—', description: 'grocery', vendor: 'Market',
    stated: '$42.10', actual: '—', typedActual: '—', match: '—', state: 'pending_review', id: 't-usd',
  });
  const unstated = words(rowOf(answer.rows, 'bank:t-null'));
  assert.equal(unstated.stated, '7.00 (currency not stated)');
  assert.equal(unstated.vendor, '—');
  assert.equal(answer.said.currencyNotStated, 1);
  // The figure stays on the row with no currency (the travel ledger's own CSV shape); the sums count it by name and never add it.
  assert.deepEqual(rowOf(answer.rows, 'bank:t-null').stated, { cents: 700, currency: null }, 'the unstated row keeps its figure, with no code to sum under');
  assert.equal(rowOf(answer.rows, 'bank:t-null').notWholeCents, false);
});

test('C the columns, Alex\'s order, exact; every empty cell is "—"; DATE says its rule', () => {
  assert.deepEqual([...HOME_LEDGER_COLUMNS], ['date', 'source', 'book', 'account', 'accountName', 'description', 'vendor', 'stated', 'actual', 'typedActual', 'match', 'state', 'id']);
  assert.deepEqual(HOME_LEDGER_TABLE.map((c) => c.label), ['DATE', 'SOURCE', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'DESCRIPTION', 'VENDOR', 'STATED', 'ACTUAL', 'TYPED ACTUAL', 'MATCH', 'STATE', 'ID']);
  assert.deepEqual(HOME_LEDGER_TABLE.map((c) => c.kind), ['value', 'value', 'value', 'value', 'value', 'text', 'value', 'value', 'money', 'money', 'value', 'value', 'text']);
  assert.deepEqual(Object.values(SOURCE_WORDS), ['books', 'task ledger', 'travel ledger', 'bank — not yet in the books']);
  assert.deepEqual(Object.values(DATE_RULE_WORDS), ['journal date', "routine's day", 'your day', 'paid on', 'bank date']);
  assert.equal(HOME_LEDGER_HEAD_WORDS.typedActual, 'TYPED ACTUAL');
  assert.equal(HOME_LEDGER_DAY_HEADING, 'HOME LEDGER · DAY');
  assert.equal(HOME_LEDGER_ROUTE, '/api/home-ledger');
});

// ── D. THE SUMMARY — BOOK → ACCOUNT, every sum per currency, MATCH never summed ──

test('D the groups in the model\'s order — Business · Personal · no account · the bank — each line with ACTUAL, TYPED ACTUAL and STATED per currency, naming its rows', () => {
  const answer = homeLedgerOf(input(MANILA));
  assert.deepEqual(answer.groups.map((g) => g.label), ['Business', 'Personal', NO_ACCOUNT_GROUP_WORDS, BANK_GROUP_WORDS]);
  const [biz, personal, none, bank] = answer.groups;

  assert.deepEqual(biz.lines.map((l) => [l.label, l.accountName, l.rows, actualSumWords(l.actualCents), sumsWords(l.typedActual), sumsWords(l.stated)]), [['B-6000', 'Advertising', 1, '$20.00', '—', '—']]);
  assert.deepEqual(biz.lines[0].rowKeys, ['books:l-ads']);

  // P-6150 holds the coffee line AND the record matched to it: ACTUAL $12.50 once (the books), TYPED $13.00 (the record) — never added.
  assert.deepEqual(personal.lines.map((l) => [l.label, l.rows, actualSumWords(l.actualCents), sumsWords(l.typedActual), sumsWords(l.stated)]), [
    ['P-6150', 2, '$12.50', '$13.00', '—'],
    ['P-9100', 1, '—', '—', '1500.00 PHP'],
  ]);
  assert.deepEqual(personal.lines[0].rowKeys, ['books:l-coffee', 'task:rec-coffee']);
  assert.equal(actualSumWords(personal.actualCents), '$12.50', 'the book\'s ACTUAL is the books alone');
  assert.equal(sumsWords(personal.typedActual), '$13.00');
  assert.equal(sumsWords(personal.stated), '1500.00 PHP');
  assert.equal(personal.rows, 3);

  assert.deepEqual(none.lines.map((l) => [l.label, l.rows, actualSumWords(l.actualCents), sumsWords(l.typedActual), sumsWords(l.stated)]), [[NO_ACCOUNT_GROUP_WORDS, 2, '—', '$5.00', '350.00 PHP']]);
  assert.deepEqual(none.lines[0].rowKeys, ['task:rec-gym', 'travel:typed:te-visa']);

  assert.deepEqual(bank.lines.map((l) => [l.label, l.rows, actualSumWords(l.actualCents), sumsWords(l.typedActual), sumsWords(l.stated)]), [[BANK_GROUP_WORDS, 2, '—', '—', '$42.10 · 1 currency not stated']]);
  assert.equal(BANK_SIGN_WORDS, 'Plaid signs outflows positive');

  // MATCH is per row, never a sum: no group, no line carries one.
  for (const g of answer.groups) {
    assert.deepEqual(Object.keys(g).sort(), ['actualCents', 'key', 'label', 'lines', 'rowKeys', 'rows', 'stated', 'typedActual']);
    for (const l of g.lines) assert.deepEqual(Object.keys(l).sort(), ['accountName', 'actualCents', 'key', 'label', 'rowKeys', 'rows', 'stated', 'typedActual']);
  }
  // A currency is never added to another: a second PHP row and a USD row on one line stay two figures.
  const two = homeLedgerGroupsOf(homeLedgerRowsOf(input(MANILA, {
    expenses: [VISA, { ...VISA, id: 'te-esim', kind: 'esim', amount_minor: 1200, currency: 'USD', vendor: 'eSIM' }],
  })).rows);
  const noneLine = two.find((g) => g.label === NO_ACCOUNT_GROUP_WORDS)?.lines[0];
  assert.equal(noneLine === undefined ? null : sumsWords(noneLine.stated), '350.00 PHP · $12.00');
  assert.deepEqual(noneLine === undefined ? null : noneLine.stated.byCode, [{ code: 'PHP', cents: 35000, count: 1 }, { code: 'USD', cents: 1200, count: 1 }]);
});

test('D what is said: the counts by name, and trading not connected — its own line, never a figure', () => {
  const answer = homeLedgerOf(input(MANILA));
  assert.deepEqual(answer.said, { noAccount: 1, reversedByStatus: 1, voided: 0, priceNotStated: 0, amountNotStated: 0, currencyNotStated: 1, notWholeCents: 0, trading: TRADING_NOT_CONNECTED_WORDS });
  assert.deepEqual(saidLines(answer.said), [
    '1 record with no account — no plan line matched',
    reversedByStatusWords(1),
    '1 currency not stated',
    'trading — not connected',
  ]);
  assert.equal(reversedByStatusWords(2), '2 books lines left out — their entries are reversed by status (REVERSED_POSTING_WHERE)');
  // A voided typed row stays a row, struck, out of every sum, counted; a bank row not in whole cents is shown as stated and counted.
  const edge = homeLedgerOf(input(MANILA, {
    expenses: [{ ...VISA, voided_at: '2026-11-21T00:00:00.000Z', void_reason: 'typed twice' }],
    bank: [{ id: 't-frac', day: DAY, amount: 1.005, currency: 'USD', name: 'odd', merchantName: null, reviewStatus: 'pending_review' }],
  }));
  assert.equal(rowOf(edge.rows, 'travel:typed:te-visa').voided, true);
  assert.equal(words(rowOf(edge.rows, 'travel:typed:te-visa')).state, 'voided — typed twice');
  assert.equal(rowOf(edge.rows, 'bank:t-frac').notWholeCents, true);
  assert.equal(words(rowOf(edge.rows, 'bank:t-frac')).stated, '1.005 USD (not whole cents)');
  assert.equal(edge.said.voided, 1);
  assert.equal(edge.said.notWholeCents, 1);
  const bank = edge.groups.find((g) => g.label === BANK_GROUP_WORDS);
  assert.equal(bank === undefined ? null : sumsWords(bank.stated), '1 not whole cents');
});

test('D an empty day: no rows, no groups, the trading line alone', () => {
  const answer = homeLedgerOf(input(MANILA, { lines: [], reversedEntryIds: [], taskRows: [], bookings: [], expenses: [], bank: [] }));
  assert.deepEqual(answer.rows, []);
  assert.deepEqual(answer.groups, []);
  assert.deepEqual(saidLines(answer.said), [TRADING_NOT_CONNECTED_WORDS]);
});

test('B a fact off the day, or on a book the viewer does not own, is the route\'s error — refused by name, never placed', () => {
  assert.throws(() => homeLedgerRowsOf(input(MANILA, { lines: [{ id: 'l-x', journalEntryId: 'je-x', entityId: 'ent-p', code: '6150', entryType: 'D', cents: 1, day: '2026-11-21', description: 'late' }] })), /dated 2026-11-21, not the day 2026-11-20/);
  assert.throws(() => homeLedgerRowsOf(input(MANILA, { lines: [{ id: 'l-x', journalEntryId: 'je-x', entityId: 'ent-ghost', code: '6150', entryType: 'D', cents: 1, day: DAY, description: 'ghost' }] })), /entity ent-ghost, which is not one of the viewer's books/);
  assert.throws(() => homeLedgerRowsOf(input(MANILA, { lines: [{ id: 'l-x', journalEntryId: 'je-x', entityId: 'ent-p', code: '4242', entryType: 'D', cents: 1, day: DAY, description: 'unknown' }] })), /account "4242" of Personal, which its chart does not hold/);
  assert.throws(() => homeLedgerRowsOf(input(MANILA, { taskRows: [record({ id: 'rec-late', description: 'Late', day: '2026-11-21' })] })), /the task ledger handed a record on 2026-11-21/);
  assert.throws(() => homeLedgerRowsOf(input(MANILA, { bank: [{ id: 't-x', day: '2026-11-19', amount: 1, currency: 'USD', name: null, merchantName: null, reviewStatus: 'pending_review' }] })), /bank row t-x is dated 2026-11-19/);
});

// ── THE CSV and THE READ ────────────────────────────────────────────────────

test('the CSV: the head line, then the PHP booking with its instant and its code as the travel ledger writes them; the books line\'s cents bare', () => {
  const answer = homeLedgerOf(input(MANILA));
  const lines = homeLedgerCsv(answer.rows).split('\r\n');
  assert.equal(lines[0], 'DATE,SOURCE,BOOK,ACCOUNT,ACCOUNT NAME,DESCRIPTION,VENDOR,STATED,ACTUAL,TYPED ACTUAL,MATCH,STATE,ID');
  assert.equal(lines.find((l) => l.endsWith(',res-php')), '2026-11-20T01:00:00.000Z,travel ledger,Personal,P-9100,Flights,booking · unattached,liteapi · Manila hotel,1500.00 PHP,,,not matched,confirmed,res-php');
  assert.equal(lines.find((l) => l.endsWith(',l-coffee')), '2026-11-20,books,Personal,P-6150,Food & drink,coffee,,,12.50,,,in the books,l-coffee');
  assert.equal(lines.find((l) => l.endsWith(',t-null')), '2026-11-20,bank — not yet in the books,,,,unstated,,7.00 (currency not stated),,,,pending_review,t-null');
});

test('the read: a 200 carries every list it promises — rows, groups, said, the day and the zone — or fails by the one reader\'s words', () => {
  const answer = homeLedgerOf(input(MANILA));
  const read = homeLedgerReadOf(JSON.parse(JSON.stringify(answer)));
  assert.equal(read.rows.length, answer.rows.length);
  assert.equal(read.groups.length, 4);
  assert.throws(() => homeLedgerReadOf({ groups: [], said: {}, date: DAY, zone: MANILA }), new RegExp(missingListWords(HOME_LEDGER_ROUTE, 'rows').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.throws(() => homeLedgerReadOf({ rows: [], said: {}, date: DAY, zone: MANILA }), /"groups" list/);
  assert.throws(() => homeLedgerReadOf({ rows: [], groups: [], date: DAY, zone: MANILA }), /"said" block/);
  assert.throws(() => homeLedgerReadOf({ rows: [], groups: [], said: {} }), /its day and zone/);
});

// ── F. THE ROUTE (read through code) ────────────────────────────────────────

test('F the route: GET only, the cart-plan gate first, the query refused by name, the books through readActuals, reversals through REVERSED_POSTING_WHERE, the three answers as their routes’ functions (READS-01a, READS-01b)', () => {
  const route = code(ROUTE);
  assert.match(route, /export async function GET\(request: NextRequest\)/);
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.doesNotMatch(route, new RegExp(`export async function ${m}\\(`));
  const gateAt = route.indexOf('const userEmail = await getVerifiedEmail();');
  const userAt = route.indexOf('const user = await prisma.users.findFirst({');
  const queryAt = route.indexOf("homeLedgerQuery(request.nextUrl.searchParams.get('date'), request.nextUrl.searchParams.get('zone'))");
  const readsAt = route.indexOf('readActuals(prisma, user.id, entityIds, date, date)');
  assert.ok(gateAt > -1 && userAt > gateAt && queryAt > userAt && readsAt > queryAt, 'the cookie, the user, the query, then the reads');
  assert.match(route, /return NextResponse\.json\(\{ error: 'Validation', field: query\.field, message: query\.message \}, \{ status: 400 \}\);/);
  // HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): the bank rows come through the loader too — readBankNotInBooks joins the import.
  assert.match(route, /import \{ readActuals, readBankNotInBooks, readBudgetChart \} from '@\/lib\/budget\/reportReads';/);
  assert.match(route, /import \{ REVERSED_POSTING_WHERE \} from '@\/lib\/calendar\/postingAmount';/);
  assert.match(route, /where: \{ id: \{ in: entryIds \}, userId: user\.id, \.\.\.REVERSED_POSTING_WHERE \}/);
  // READS-01b (Alex, 2026-11-07, ruling C): the task ledger is its route's answer function too, for the one day through spanInput, the clock read once here.
  assert.match(route, /import \{ taskLedgerAnswerOf \} from '@\/lib\/operations\/ledgerAnswer';/);
  assert.match(route, /import \{ spanInput, type LedgerRow \} from '@\/lib\/operations\/ledger';/);
  // READS-01a (Alex, 2026-11-07, ruling D): the travel ledger's two answers are the routes' answer functions, called directly.
  assert.match(route, /import \{ reservationsAnswerOf \} from '@\/lib\/reservations\/reservationsAnswer';/);
  assert.match(route, /import \{ travelExpensesAnswerOf \} from '@\/lib\/travel\/travelExpensesAnswer';/);
  assert.doesNotMatch(route, /GET as reservationsGet|GET as travelExpensesGet/, 'no route calls a route');
  assert.match(route, /const span = spanInput\(date, date\);\n\s*if \(!span\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: span\.field, message: span\.message \}, \{ status: 400 \}\);\n\s*const now = new Date\(\);/); // READS-01b
  assert.match(route, /taskLedgerAnswerOf\(prisma, user\.id, \{ from: span\.from, to: span\.to \}, now\)/); // READS-01b (2026-11-07): the function, not the route
  assert.doesNotMatch(route, /GET as |new NextRequest\(|answerOf\(/, 'no route calls a route — READS-01b');
  assert.match(route, /travelLedgerReadsOf\(reservationsAnswer, expensesAnswer\)/);
  // The bank read is the report's own — HOME-LEDGER-02a (Alex, 2026-11-07, ruling C): ONE loader function both routes call
  // (reportReads.ts readBankNotInBooks holds the where and the select); neither route reads transactions itself.
  assert.match(route, /readBankNotInBooks\(prisma, user\.id, date, date\),/);
  assert.match(code('src/app/api/budget/report/route.ts'), /readBankNotInBooks\(prisma, user\.id, rangeFrom, through\),/, 'the report\'s read, through the same function');
  const reads = code('src/lib/budget/reportReads.ts');
  assert.match(reads, /where: \{ accounts: \{ userId \}, review_status: \{ not: 'committed' \}, date: \{ gte: dayStart\(from\), lte: new Date\(`\$\{through\}T23:59:59\.999Z`\) \} \}/);
  assert.match(reads, /accounts: \{ select: \{ isoCurrencyCode: true \} \}/);
  assert.doesNotMatch(route, /transactions\.findMany/);
  // An answer without its list fails by name (listOf). READS-01b (Alex, 2026-11-07): no sub-route is called, so no status is parsed —
  // answerOf is gone; a refusal thrown by an answer function (BudgetDaysError, BudgetInputError, a row naming no plan) reaches the catch.
  assert.doesNotMatch(route, /answered \$\{res\.status\}|res\.json\(\)/, 'no sub-route answer is parsed');
  assert.match(route, /\} catch \(error\) \{\n\s*if \(error instanceof HomeLedgerError\) \{/);
  assert.match(route, /listOf<LedgerRow>\(taskAnswer, '\/api\/operations\/ledger', 'rows'\)/);
  assert.match(route, /return failClosedResponse\('home-ledger', 'Could not build the home ledger', error\);/);
  // No paid call, no trading route, nothing calculated.
  for (const bad of ['stayCosts', 'livingBaseline', 'realized-pnl', 'TRADING_ENTITY_ID', 'budget_line_items', 'liteapi', 'fetch(']) assert.ok(!route.includes(bad), `the route names ${bad}`);
  // Not public.
  assert.doesNotMatch(code('src/middleware.ts'), /'\/api\/home-ledger'/);
});

// ── E. THE SCREEN AND THE MOUNT ─────────────────────────────────────────────

test('E the screen: the card\'s own day, the browser\'s zone, the one route, the heading constant, the idiom; mounted on /home once between the day card and the sheet', () => {
  const screen = code(SCREEN);
  assert.match(screen, /^'use client';/);
  assert.ok(screen.includes("const dateParam = search.get('date');"));
  assert.ok(screen.includes('const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;'), 'the day card\'s own expression');
  assert.ok(code('src/components/workbench/operations/day/DayCard.tsx').includes('const day = today === null ? null : dateParam !== null && isIsoDay(dateParam) ? dateParam : today;'), 'the card still takes its day that way');
  assert.ok(screen.includes('setToday(localToday());'));
  assert.ok(screen.includes('setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);'));
  assert.ok(screen.includes('fetch(`${HOME_LEDGER_ROUTE}?${new URLSearchParams({ date: day, zone }).toString()}`'));
  assert.ok(screen.includes('{HOME_LEDGER_DAY_HEADING}'));
  assert.ok(screen.includes('<DataTable'));
  assert.ok(screen.includes('name="home-ledger"'));
  assert.ok(screen.includes('const read = homeLedgerReadOf(data);'), 'the one reader, never a second');
  assert.ok(screen.includes('data-home-ledger-summary-table'));
  assert.ok(screen.includes('data-home-ledger-line-open={l.key}'), 'a sum opens to its rows');
  assert.ok(screen.includes('saidLines(loaded.said)'));
  assert.doesNotMatch(screen, /localStorage|sessionStorage|document\.cookie/);

  const host = code(HOST);
  assert.match(host, /import HomeLedger from '@\/components\/home\/HomeLedger';/);
  assert.equal((host.match(/<HomeLedger \/>/g) ?? []).length, 1, 'mounted once');
  assert.match(host, /<div className="mt-5 sm:mt-6" data-home-ledger-day-table>\n\s*<Suspense>\n\s*<HomeLedger \/>\n\s*<\/Suspense>\n\s*<\/div>/, 'the boundary');
  const answersAt = host.indexOf('<section aria-label="The four answers"');
  const netWorthAt = host.indexOf('data-net-worth');
  const cardAt = host.indexOf('<DayCard />');
  const ledgerAt = host.indexOf('<HomeLedger />');
  const sheetAt = host.indexOf('<TheSheet />');
  assert.ok(answersAt > -1 && netWorthAt > answersAt && cardAt > netWorthAt && ledgerAt > cardAt && sheetAt > ledgerAt, 'the four, Net worth, the card, the home ledger, the sheet');
  assert.equal((host.match(/<DayCard \/>/g) ?? []).length, 1, 'the card is still mounted once');
});

// ── G. THE LAWS ─────────────────────────────────────────────────────────────

test('G the laws: the home ledger law at the end of the script, above the second gate; the books currency lane names src/lib/home and the screen', () => {
  const laws = code(LAWS);
  const lawAt = laws.indexOf("lawGuard('The home ledger law', () => {");
  const readerAt = laws.indexOf('const READER_HELPER = \'src/lib/sourceText.ts\';');
  const gateAt = laws.indexOf('if (violations.length > raised) {');
  assert.ok(readerAt > -1 && lawAt > readerAt && gateAt > lawAt, 'after the reader law, before the second gate');
  assert.ok(laws.indexOf("lawGuard('The home ledger law'") === laws.lastIndexOf("lawGuard('The home ledger law'"), 'one law');
  for (const piece of [
    "const HL_ROUTE = 'src/app/api/home-ledger/route.ts';",
    "const HL_LEAF = 'src/lib/home/homeLedger.ts';",
    "const HL_SCREEN = 'src/components/home/HomeLedger.tsx';",
    "for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) if (new RegExp(`export async function ${m}\\\\(`).test(hlRoute)) hlFail(",
    "if (!/readActuals\\(prisma, user\\.id, entityIds, date, date\\)/.test(hlRoute)) hlFail(",
    "if (!/import \\{ REVERSED_POSTING_WHERE \\} from '@\\/lib\\/calendar\\/postingAmount';/.test(hlRoute) || !/\\.\\.\\.REVERSED_POSTING_WHERE/.test(hlRoute)) hlFail(",
    "for (const bad of ['stayCosts', 'livingBaseline', 'living_baselines', 'realized-pnl', 'TRADING_ENTITY_ID', 'budget_line_items', 'routinesMonthlyByCoa', 'buildRoutineBudgetLines', 'buildBudgetReport', 'buildTaskBudgetLines'])",
    "if (/\\|\\|/.test(body)) hlFail(",
    "if (/\\?\\? /.test(body)) hlFail(",
    "if (/readableMatchCents|matchTotalWords/.test(hlLeaf)) hlFail(",
    "if (!(answersAt > -1 && netWorthAt > answersAt && cardAt > netWorthAt && ledgerAt > cardAt && sheetAt > ledgerAt)) hlFail(",
    "if (TOOL_REGISTRY.some((t) => t.slug === 'home-ledger' || t.home === '/home')) hlFail(",
  ]) assert.ok(laws.includes(piece), `the law holds: ${piece.slice(0, 80)}`);
  assert.match(laws, /const FX_LANE_DIRS = \[[^\]]*'src\/lib\/home'\];/);
  // HOME-LEDGER-02a (Alex, 2026-11-07, ruling E): the month host and the travel plan's screen join the lane on the same line.
  assert.match(laws, /const FX_LANE_FILES = \['src\/components\/home\/HomeLedger\.tsx', 'src\/components\/home\/HomeMonth\.tsx', 'src\/components\/home\/TravelPlan\.tsx'\];/);
  assert.match(laws, /\.\.\.FX_LANE_COMPONENTS, \.\.\.FX_LANE_FILES,/);
  assert.match(laws, /for \(const f of \[\.\.\.FX_LANE_COMPONENTS, \.\.\.FX_LANE_FILES\]\) if \(!existsSync\(resolve\(ROOT, f\)\)\) fxFail\(/);
  assert.match(comments(LAWS), /HOME-LEDGER-01 \(Alex, 2026-11-06, ruling G\): the lane covers the home ledger/);
  // The two-lists law's own order (Net worth → the card → the sheet) stays true with the ledger between the card and the sheet.
  assert.match(laws, /if \(netWorthAt < 0 \|\| sheetAt < 0 \|\| cardAt < netWorthAt \|\| cardAt > sheetAt\) twoListsFail\(/);
});

// ── THE DOES-NOTS ───────────────────────────────────────────────────────────

test('the does-nots: no `$` outside the currency home\'s formatters, no `||`, no `?? <default>`, no "USD" literal, no CALCULATED import, MATCH never summed, the leaf pure', () => {
  for (const f of [LEAF, ROUTE, SCREEN]) {
    const body = code(f);
    assert.doesNotMatch(body, /\$(?!\{)/, `${f}: a \`$\` outside the formatters`);
    assert.doesNotMatch(body, /\|\|/, `${f}: a \`||\``);
    assert.doesNotMatch(body, /\?\? /, `${f}: a \`?? <default>\``);
    assert.doesNotMatch(body, /['"]USD['"]/, `${f}: a 'USD' literal`);
    assert.doesNotMatch(body, /Intl\.NumberFormat/, `${f}: Intl.NumberFormat`);
    for (const bad of ['stayCosts', 'livingBaseline', 'living_baselines', 'realized-pnl', 'TRADING_ENTITY_ID', 'budget_line_items', 'buildBudgetReport', 'routinesMonthlyByCoa']) assert.ok(!body.includes(bad), `${f} names ${bad}`);
  }
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /readableMatchCents|matchTotalWords/, 'MATCH never summed');
  assert.doesNotMatch(leaf, /@prisma\/client|from 'next|fetch\(|process\.env|new Date\(\)|Date\.now\(/, 'the leaf is pure');
  assert.match(leaf, /import \{ BOOK_WORDS, NO_BOOK_GROUP_WORDS, matchCellTitle, matchCellWords, type LedgerRow \} from '@\/lib\/operations\/ledger';/, 'MATCH as the task ledger prints it');
  assert.match(leaf, /ledgerRowsOf\(input\.bookings, input\.expenses, zone\)/, 'the travel ledger\'s own rows, in its own order');
  assert.match(leaf, /statedWords: statedCellWords\(t\),\n\s*actualCents: null,/, 'a stated figure is never an ACTUAL');
  assert.match(leaf, /statedWords: bankMoneyWords\(b\.amount, b\.currency\),\n\s*actualCents: null,/, 'a bank figure is never an ACTUAL');
  assert.match(leaf, /typedActualCents: r\.actualCents,\n\s*matchWords: matchCellWords\(r\.match\),/, 'a typed figure and its MATCH sit beside each other, never in ACTUAL');
  assert.deepEqual([...SUMMARY_HEAD_WORDS], ['BOOK · ACCOUNT', 'ACCOUNT NAME', 'ROWS', 'ACTUAL', 'TYPED ACTUAL', 'STATED'], 'no MATCH column in the summary');
});

// ── H ───────────────────────────────────────────────────────────────────────

test('H this test pins no line number of any file — every pin finds its line by content', () => {
  const me = code(THIS);
  assert.doesNotMatch(me, /\.tsx?:\d+/, 'a file:line pin');
  assert.doesNotMatch(me, /\.ts', \d+\)|lines\[\d{2,}\]/, 'a line-number read');
});
