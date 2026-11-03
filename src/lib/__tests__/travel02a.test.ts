/**
 * TRAVEL-02a (Alex, 2026-11-02, rulings A–G) — THE TRAVEL LEDGER'S REAL ROWS: every booking and every money event of the
 * caller, in the one table idiom, in Alex's column order, stated in its own currency and settled in the bank's, posted or
 * not, the booking its own document; sums per currency, never converted.
 *
 * The leaf (travelLedger.ts) is pure and driven over fixtureTravelLedger.ts; the route, the view and the launcher are read
 * through code() (the reader law) — a route cannot run outside a Next request scope, so its scope is pinned by text and
 * proven on the wire in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { entityTypeOfLetter } from '../accountString';
import { CURRENCY_NOT_STATED_WORDS, bankCentsWords, bankMoneyWords } from '../books/functionalCurrency';
import { BOOKING_WORDS } from '../reservations/bookingRow';
import {
  AMOUNT_NOT_STATED_WORDS, KIND_WORDS, LEDGER_MONEY_EVENT_KINDS, NO_BOOK_LETTER_WORDS, THE_BOOKING_WORDS, TRAVEL_LEDGER_COLUMNS, TRAVEL_LEDGER_CSV_FILE_NAME,
  TRAVEL_LEDGER_HEADING, TRAVEL_LEDGER_HEAD_WORDS, TRAVEL_LEDGER_TABLE, TravelLedgerError, UNATTACHED_WORDS, bookOfCoaCode, cellWordsOf, dayInZone,
  settledSumLineWords, settledSums, statedSumLineWords, statedSums, travelLedgerColumnOf, travelLedgerCsv, travelLedgerRows, type LedgerBookingIn, type TravelLedgerColumn,
} from '../reservations/travelLedger';
import { filterRows, noFilters, withFilter } from '../table/filters';
import { sortRows } from '../table/sort';
import { ACTIVITY_UNPRICED, FLIGHT_USD, HOTEL_CANCELLED, HOTEL_PHP, LEDGER_FIXTURE, VIEWER_ZONE } from './fixtureTravelLedger';

const LEAF = 'src/lib/reservations/travelLedger.ts';
const ROUTE = 'src/app/api/reservations/route.ts';
const VIEW = 'src/components/trips/AllBookings.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const ROW_LEAF = 'src/lib/reservations/bookingRow.ts';
const FX_HOME = 'src/lib/books/functionalCurrency.ts';
const SCHEME = 'src/lib/accountString.ts';
const SIBLINGS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx', 'src/components/trips/TripBudgetActual.tsx'];

const rows = travelLedgerRows(LEDGER_FIXTURE, VIEWER_ZONE);
const rowOf = (id: string) => {
  const row = rows.find((r) => r.id === id);
  if (row === undefined) throw new Error(`no row ${id}`);
  return row;
};
const cells = (id: string): Record<TravelLedgerColumn, string> => {
  const row = rowOf(id);
  const out = {} as Record<TravelLedgerColumn, string>;
  for (const c of TRAVEL_LEDGER_COLUMNS) out[c] = cellWordsOf(row, c);
  return out;
};

// ── C · THE COLUMNS, in Alex's order ─────────────────────────────────────────

test('C the fifteen columns in Alex\'s order — when → kind → classification coarse to fine → who\'s paid → schedule → money → state → id; the head words; every column a VALUE column but ID (a TEXT column)', () => {
  assert.deepEqual([...TRAVEL_LEDGER_COLUMNS], ['date', 'kind', 'lane', 'trip', 'book', 'account', 'vendor', 'confirmation', 'dates', 'stated', 'settled', 'posted', 'document', 'status', 'id']);
  assert.deepEqual(TRAVEL_LEDGER_TABLE.map((c) => c.label), ['DATE', 'KIND', 'LANE', 'TRIP', 'BOOK', 'ACCOUNT', 'VENDOR', 'CONFIRMATION', 'DATES', 'STATED', 'SETTLED', 'POSTED', 'DOCUMENT', 'STATUS', 'ID']);
  assert.deepEqual(TRAVEL_LEDGER_TABLE.map((c) => c.key), [...TRAVEL_LEDGER_COLUMNS]);
  for (const c of TRAVEL_LEDGER_TABLE) assert.equal(c.kind, c.key === 'id' ? 'text' : 'value', c.key);
  assert.equal(TRAVEL_LEDGER_HEAD_WORDS.stated, 'STATED');
  assert.equal(travelLedgerColumnOf('settled').label, 'SETTLED');
  assert.equal(TRAVEL_LEDGER_HEADING, 'TRAVEL LEDGER');
  assert.equal(TRAVEL_LEDGER_CSV_FILE_NAME, 'travel-ledger.csv');
  // TRAVEL-02b (2026-11-03, ruling F): the typed rows' three kinds and their words followed (travel02b.test.ts). Moved, not loosened.
  assert.deepEqual(KIND_WORDS, { booking: 'booking', refund: 'refund', fee: 'fee', voucher: 'voucher', visa: 'visa', esim: 'eSIM', other: 'other' });
  assert.deepEqual([...LEDGER_MONEY_EVENT_KINDS], ['refund', 'cancellation_fee', 'voucher_issued']);
});

// ── B · THE ROWS ARE REAL ────────────────────────────────────────────────────

test('B one row per booking and under it one per money event, in the route\'s order; the kinds; the shared columns are the booking\'s', () => {
  assert.deepEqual(rows.map((r) => r.rowKey), [
    'booking:res-activity', 'booking:res-hotel-cancelled', 'event:me-refund', 'event:me-fee', 'event:me-voucher-null', 'booking:res-flight-usd', 'event:me-voucher-flight', 'booking:res-hotel-php',
  ]);
  assert.deepEqual(rows.map((r) => r.kind), ['booking', 'booking', 'refund', 'fee', 'voucher', 'booking', 'voucher', 'booking']);
  assert.deepEqual(rows.map((r) => r.bookingId), ['res-activity', 'res-hotel-cancelled', 'res-hotel-cancelled', 'res-hotel-cancelled', 'res-hotel-cancelled', 'res-flight-usd', 'res-flight-usd', 'res-hotel-php']);
  // A money event's classification columns are its booking's — a filter by TRIP or VENDOR keeps a refund with its booking.
  const booking = cells('res-hotel-cancelled');
  const refund = cells('me-refund');
  for (const c of ['lane', 'trip', 'book', 'account', 'vendor', 'confirmation', 'dates'] as const) assert.equal(refund[c], booking[c], c);
});

test('C the hotel in PHP, matched to a USD bank row and posted with two receipts: every cell word', () => {
  assert.deepEqual(cells('res-hotel-php'), {
    date: '2026-10-21', // 20:30Z is 03:30 the next day in Asia/Bangkok — the viewer's day, not the UTC day
    kind: 'booking',
    lane: 'Hotel',
    trip: 'Bali 2026',
    book: 'Personal',
    account: 'P-9200',
    vendor: 'liteapi · Hotel PHP Proof',
    confirmation: 'HCC-4421',
    dates: '2026-10-31 → 2026-11-02',
    stated: '12345.00 PHP',
    settled: '$212.34 · 2026-10-21',
    posted: '2026-10-22',
    document: 'the booking + 2 receipts',
    status: 'confirmed',
    id: 'res-hotel-php',
  });
});

test('C the flight in USD, unmatched: departs its calendar day, no budget line, the confirmation not yet stated; its voucher negative in its code', () => {
  assert.deepEqual(cells('res-flight-usd'), {
    date: '2026-10-21', kind: 'booking', lane: 'Flight', trip: 'Bali 2026', book: '—', account: BOOKING_WORDS.noBudgetLine, vendor: 'liteapi · AirAsia CNX → DPS',
    confirmation: BOOKING_WORDS.notYetStated, dates: 'departs 2026-10-31', stated: '$189.50', settled: BOOKING_WORDS.notMatched, posted: BOOKING_WORDS.notPosted,
    document: THE_BOOKING_WORDS, status: 'confirmed', id: 'res-flight-usd',
  });
  assert.equal(BOOKING_WORDS.noBudgetLine, 'no budget line');
  assert.equal(BOOKING_WORDS.notYetStated, 'not yet stated');
  assert.equal(BOOKING_WORDS.notMatched, 'not matched');
  assert.equal(BOOKING_WORDS.notPosted, 'not posted');
  assert.equal(THE_BOOKING_WORDS, 'the booking');
  const voucher = cells('me-voucher-flight');
  assert.equal(voucher.date, '2026-10-26');
  assert.equal(voucher.kind, 'voucher');
  assert.equal(voucher.stated, '-$50.00');
  assert.equal(voucher.settled, BOOKING_WORDS.notMatched);
  assert.equal(voucher.posted, '—', 'no posting is read for a money event');
  assert.equal(voucher.document, '—');
  assert.equal(voucher.status, 'stated');
  assert.equal(voucher.id, 'me-voucher-flight');
});

test('C the cancelled hotel, unattached, named by the one lane reader: its refund stated and negative, its fee settled and positive, its amountless voucher said', () => {
  assert.deepEqual(cells('res-hotel-cancelled'), {
    date: '2026-10-23', kind: 'booking', lane: 'Hotel', trip: UNATTACHED_WORDS, book: 'Business', account: 'B-6100', vendor: 'liteapi · Hotel booking HCC-7',
    confirmation: 'HCC-7', dates: '2026-11-10 → 2026-11-12', stated: '$300.00', settled: '$300.00 · 2026-10-18', posted: BOOKING_WORDS.notPosted,
    document: THE_BOOKING_WORDS, status: 'cancelled', id: 'res-hotel-cancelled',
  });
  assert.equal(UNATTACHED_WORDS, 'unattached');
  const refund = cells('me-refund');
  assert.equal(refund.kind, 'refund');
  assert.equal(refund.date, '2026-10-25');
  assert.equal(refund.stated, '-$300.00');
  assert.equal(refund.settled, BOOKING_WORDS.notMatched);
  assert.equal(refund.status, 'stated');
  const fee = cells('me-fee');
  assert.equal(fee.kind, 'fee');
  assert.equal(fee.stated, '$25.00');
  assert.equal(fee.settled, '$25.00 · 2026-10-29');
  assert.equal(fee.status, 'settled');
  const voucher = cells('me-voucher-null');
  assert.equal(voucher.kind, 'voucher');
  assert.equal(voucher.stated, AMOUNT_NOT_STATED_WORDS);
  assert.equal(AMOUNT_NOT_STATED_WORDS, 'amount not stated');
  assert.equal(voucher.status, 'stated');
});

test('C the unattached activity the vendor priced not: price not stated, no dates, pending in the status words', () => {
  assert.deepEqual(cells('res-activity'), {
    date: '2026-10-24', kind: 'booking', lane: 'Activity', trip: 'unattached', book: '—', account: 'no budget line', vendor: 'viator · Ubud Rice Terrace Walk',
    confirmation: 'VT-1', dates: '—', stated: 'price not stated', settled: 'not matched', posted: 'not posted', document: 'the booking', status: 'pending with the vendor', id: 'res-activity',
  });
  // An unknown recorded status renders as itself — never a guess (bookingRow.ts' rule).
  assert.equal(travelLedgerRows([{ ...ACTIVITY_UNPRICED, status: 'mystery_state' }], VIEWER_ZONE)[0].status, 'mystery_state');
  // A stated amount with no currency is the figure with the code's absence named.
  const bare = travelLedgerRows([{ ...FLIGHT_USD, moneyEvents: [{ ...FLIGHT_USD.moneyEvents[0], currency: null }] }], VIEWER_ZONE)[1];
  assert.equal(cellWordsOf(bare, 'stated'), `-50.00 (${CURRENCY_NOT_STATED_WORDS})`);
});

// ── C · THE DATE RULE — the viewer's day on screen, the instant in the CSV ──

test('C the DATE rule: an EVENT INSTANT (createdAt; a money event\'s statedAt) drawn in the viewer\'s day on screen and written as the instant in the CSV; sorted by the instant', () => {
  assert.equal(dayInZone('2026-10-20T20:30:00.000Z', 'Asia/Bangkok'), '2026-10-21');
  assert.equal(dayInZone('2026-10-20T20:30:00.000Z', 'UTC'), '2026-10-20');
  assert.equal(dayInZone('2026-10-20T20:30:00.000Z', 'America/Los_Angeles'), '2026-10-20');
  const hotel = rowOf('res-hotel-php');
  assert.equal(hotel.instant, '2026-10-20T20:30:00.000Z');
  assert.equal(hotel.day, '2026-10-21');
  assert.equal(travelLedgerColumnOf('date').words(hotel), '2026-10-21');
  assert.equal(travelLedgerColumnOf('date').csv(hotel), '2026-10-20T20:30:00.000Z');
  assert.deepEqual(travelLedgerColumnOf('date').sortKey(hotel), { kind: 'text', t: '2026-10-20T20:30:00.000Z' });
  const inUtc = travelLedgerRows([HOTEL_PHP], 'UTC')[0];
  assert.equal(inUtc.day, '2026-10-20', 'the same instant, another viewer\'s day');
  assert.equal(travelLedgerColumnOf('date').csv(inUtc), hotel.instant, 'the CSV cell is the instant whatever the zone');
  // Sorted by DATE: the instants ascending; two rows on one instant keep their order.
  const byDate = sortRows(rows, { column: 'date', direction: 'asc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(byDate.map((r) => r.id), ['res-hotel-php', 'res-flight-usd', 'res-hotel-cancelled', 'res-activity', 'me-refund', 'me-fee', 'me-voucher-null', 'me-voucher-flight']);
  assert.throws(() => dayInZone('2026-10-20T20:30:00.000Z', ''), /ianaZone/);
});

test('C sorted by STATED: each row\'s own minor units, blanks last — an order, never a converted figure; a filter by KIND keeps a value column\'s checklist words', () => {
  const asc = sortRows(rows, { column: 'stated', direction: 'asc' }, TRAVEL_LEDGER_TABLE);
  // TRAVEL-02b item 0 (Alex, 2026-11-03; this PR's call 5 was NO): STATED sorts by the currency CODE first (A→Z), then by the minor units
  // within it — PHP before USD, never a PHP figure ranked against a USD one; blanks last both ways. Moved by the ruling.
  assert.deepEqual(asc.map((r) => r.id), ['res-hotel-php', 'me-refund', 'me-voucher-flight', 'me-fee', 'res-flight-usd', 'res-hotel-cancelled', 'res-activity', 'me-voucher-null']);
  const desc = sortRows(rows, { column: 'stated', direction: 'desc' }, TRAVEL_LEDGER_TABLE);
  // TRAVEL-02b item 0: descending is the idiom's reverse — USD (Z→A) first, its largest first. Moved by the ruling.
  assert.deepEqual(desc.slice(0, 2).map((r) => r.id), ['res-hotel-cancelled', 'res-flight-usd']);
  assert.deepEqual(desc.slice(-2).map((r) => r.id), ['res-activity', 'me-voucher-null'], 'blanks last both ways');
  const bySettled = sortRows(rows, { column: 'settled', direction: 'desc' }, TRAVEL_LEDGER_TABLE);
  assert.deepEqual(bySettled.slice(0, 3).map((r) => r.id), ['res-hotel-cancelled', 'res-hotel-php', 'me-fee']);
  const off = noFilters(TRAVEL_LEDGER_TABLE);
  const refundsOnly = filterRows(rows, withFilter(off, 'kind', { dropped: ['booking', 'fee', 'voucher'] }), TRAVEL_LEDGER_TABLE);
  assert.deepEqual(refundsOnly.map((r) => r.id), ['me-refund']);
  const bali = filterRows(rows, withFilter(off, 'trip', { dropped: ['unattached'] }), TRAVEL_LEDGER_TABLE);
  assert.deepEqual(bali.map((r) => r.id), ['res-flight-usd', 'me-voucher-flight', 'res-hotel-php']);
});

// ── D · THE SUM LINES ───────────────────────────────────────────────────────

test('D STATED per currency — the stated minor units summed by code, a refund and a voucher reducing theirs, what could not be summed counted; SETTLED per ACCOUNT currency; never one figure across currencies', () => {
  const stated = statedSums(rows);
  assert.deepEqual([...stated.byCode.entries()], [['USD', 16450], ['PHP', 1234500]]);
  assert.equal(stated.priceNotStated, 1);
  assert.equal(stated.amountNotStated, 1);
  assert.equal(stated.currencyNotStated, 0);
  assert.equal(statedSumLineWords(rows), 'STATED: 12345.00 PHP · $164.50 · 1 price not stated · 1 amount not stated');
  const settled = settledSums(rows);
  assert.deepEqual([...settled.byCode.entries()], [['USD', BigInt(53734)]]);
  assert.equal(settled.notMatched, 5);
  assert.equal(settled.notWholeCents, 0);
  assert.equal(settledSumLineWords(rows), 'SETTLED: $537.34 · 5 not matched');
  // The lines follow the rows SHOWN: the PHP hotel alone.
  const php = rows.filter((r) => r.id === 'res-hotel-php');
  assert.equal(statedSumLineWords(php), 'STATED: 12345.00 PHP');
  assert.equal(settledSumLineWords(php), 'SETTLED: $212.34');
  // A PHP bank account: its own sum, beside the USD one — two parts, never added.
  const phpBank = travelLedgerRows([{ ...HOTEL_PHP, charge: { ...HOTEL_PHP.charge, bank: { amount: 12345, currency: 'PHP', date: '2026-10-21' } } }, HOTEL_CANCELLED], VIEWER_ZONE);
  assert.equal(settledSumLineWords(phpBank), 'SETTLED: 12345.00 PHP · $325.00 · 2 not matched');
  // An account that states no currency is its own group, named; a stated amount with no code is counted, never summed.
  const noCode = travelLedgerRows([{ ...HOTEL_CANCELLED, charge: { ...HOTEL_CANCELLED.charge, bank: { amount: 7, currency: null, date: '2026-10-18' } }, moneyEvents: [{ ...HOTEL_CANCELLED.moneyEvents[0], currency: null }] }], VIEWER_ZONE);
  assert.equal(settledSumLineWords(noCode), `SETTLED: 7.00 (${CURRENCY_NOT_STATED_WORDS}) · 1 not matched`);
  assert.equal(statedSumLineWords(noCode), 'STATED: $300.00 · 1 currency not stated');
  // Nothing shown: the lines say so.
  assert.equal(statedSumLineWords([]), 'STATED: —');
  assert.equal(settledSumLineWords([]), 'SETTLED: —');
  // Every row priced not: the count alone.
  assert.equal(statedSumLineWords(travelLedgerRows([ACTIVITY_UNPRICED], VIEWER_ZONE)), 'STATED: 1 price not stated');
});

test('D bankCentsWords — the bank words from cents the ledger added, the one shape bankMoneyWords writes; bankMoneyWords unchanged', () => {
  assert.equal(bankCentsWords(123456, 'USD'), '$1,234.56');
  assert.equal(bankCentsWords(BigInt(53734), 'usd'), '$537.34');
  assert.equal(bankCentsWords(252000, 'THB'), '2520.00 THB');
  assert.equal(bankCentsWords(700, null), `7.00 (${CURRENCY_NOT_STATED_WORDS})`);
  assert.equal(bankCentsWords(-5000, 'USD'), '-$50.00');
  assert.equal(bankMoneyWords(1234.5, 'USD'), '$1,234.50');
  assert.equal(bankMoneyWords(2520, 'THB'), '2520.00 THB');
  assert.equal(bankMoneyWords(12.345, 'USD'), '12.345 USD (not whole cents)');
  assert.match(code(FX_HOME), /return bankCentsWords\(centsOfTypedDollars\(String\(amount\)\), code\);/, 'bankMoneyWords hands its cents to the one shape');
});

// ── C · BOOK and ACCOUNT through the one scheme ──────────────────────────────

test('C BOOK is the linked budget line\'s COA code letter through the one scheme (accountString.ts ENTITY_LETTER read backwards; ledger.ts bookWordOf); ACCOUNT the code verbatim; not linked: — and no budget line; a code with no drawn letter says so', () => {
  assert.equal(entityTypeOfLetter('P'), 'personal');
  assert.equal(entityTypeOfLetter('B'), 'sole_prop');
  assert.equal(entityTypeOfLetter('T'), 'trading');
  assert.equal(entityTypeOfLetter('X'), null);
  assert.equal(entityTypeOfLetter('p'), null, 'the letter as drawn, no case folding');
  assert.equal(bookOfCoaCode('P-9200'), 'Personal');
  assert.equal(bookOfCoaCode('B-6100'), 'Business');
  assert.equal(bookOfCoaCode('T-1200'), 'Trading');
  assert.equal(bookOfCoaCode('9100'), NO_BOOK_LETTER_WORDS);
  assert.equal(bookOfCoaCode('X-9100'), NO_BOOK_LETTER_WORDS);
  assert.equal(NO_BOOK_LETTER_WORDS, 'no book letter');
  const bare = travelLedgerRows([{ ...FLIGHT_USD, budgetLine: { coaCode: '9100' } }], VIEWER_ZONE)[0];
  assert.equal(cellWordsOf(bare, 'book'), 'no book letter');
  assert.equal(cellWordsOf(bare, 'account'), '9100');
  assert.match(code(SCHEME), /export function entityTypeOfLetter\(letter: string\): string \| null \{\n\s*for \(const \[entityType, drawn\] of Object\.entries\(ENTITY_LETTER\)\) if \(drawn === letter\) return entityType;\n\s*return null;\n\}/);
  assert.match(code(LEAF), /import \{ bookWordOf \} from '@\/lib\/operations\/ledger';/);
  assert.match(code(LEAF), /return entityType === null \? NO_BOOK_LETTER_WORDS : bookWordOf\(entityType\);/);
});

// ── F · THE CSV ─────────────────────────────────────────────────────────────

test('F the CSV through tableCsv: the head words, one line per row shown, DATE the instant, the figures bare with their code, CRLF', () => {
  const csv = travelLedgerCsv(rows);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'DATE,KIND,LANE,TRIP,BOOK,ACCOUNT,VENDOR,CONFIRMATION,DATES,STATED,SETTLED,POSTED,DOCUMENT,STATUS,ID');
  assert.equal(lines[lines.length - 1], '', 'the last line ends CRLF too');
  assert.equal(lines.length, 2 + rows.length);
  assert.equal(lines[8], '2026-10-20T20:30:00.000Z,booking,Hotel,Bali 2026,Personal,P-9200,liteapi · Hotel PHP Proof,HCC-4421,2026-10-31 → 2026-11-02,12345.00 PHP,212.34 USD · 2026-10-21,2026-10-22,the booking + 2 receipts,confirmed,res-hotel-php');
  assert.equal(lines[6], '2026-10-21T00:00:00.000Z,booking,Flight,Bali 2026,,no budget line,liteapi · AirAsia CNX → DPS,,departs 2026-10-31,189.50 USD,,,the booking,confirmed,res-flight-usd'.replace(',no budget line,', ',,'));
  assert.equal(lines[3], '2026-10-25T09:00:00.000Z,refund,Hotel,unattached,Business,B-6100,liteapi · Hotel booking HCC-7,HCC-7,2026-11-10 → 2026-11-12,-300.00 USD,,,,stated,me-refund');
  assert.equal(lines[4], '2026-10-25T09:00:00.000Z,fee,Hotel,unattached,Business,B-6100,liteapi · Hotel booking HCC-7,HCC-7,2026-11-10 → 2026-11-12,25.00 USD,25.00 USD · 2026-10-29,,,settled,me-fee');
  assert.equal(lines[5], '2026-10-25T09:00:01.000Z,voucher,Hotel,unattached,Business,B-6100,liteapi · Hotel booking HCC-7,HCC-7,2026-11-10 → 2026-11-12,,,,,stated,me-voucher-null');
  assert.doesNotMatch(csv, /\$/, 'no symbol in the CSV — the figure with its code');
  assert.match(code(LEAF), /export const travelLedgerCsv = \(rows: readonly TravelLedgerRow\[\]\): string => tableCsv\(TRAVEL_LEDGER_TABLE, rows\);/);
});

// ── THE CONTRADICTIONS ARE NAMED ────────────────────────────────────────────

test('a matched charge with no bank row, a bank row with no match, a posting with no day, receipts unposted, a settled event with no bank row, an unnamed kind or status — each thrown by name', () => {
  const thrown = (input: LedgerBookingIn, re: RegExp) => assert.throws(() => travelLedgerRows([input], VIEWER_ZONE), (e: unknown) => e instanceof TravelLedgerError && re.test((e as Error).message));
  thrown({ ...HOTEL_PHP, charge: { ...HOTEL_PHP.charge, bank: null } }, /matched with no bank figure/);
  thrown({ ...FLIGHT_USD, charge: { ...FLIGHT_USD.charge, bank: { amount: 1, currency: 'USD', date: '2026-10-01' } } }, /not matched but carries a bank figure/);
  thrown({ ...HOTEL_PHP, charge: { ...HOTEL_PHP.charge, postedDay: null } }, /posted with no posting day or entry/);
  thrown({ ...FLIGHT_USD, receipts: 1 }, /not posted but carries receipts/);
  thrown({ ...FLIGHT_USD, charge: { ...FLIGHT_USD.charge, postedDay: '2026-10-01' } }, /not posted but carries a posting day/);
  thrown({ ...HOTEL_CANCELLED, moneyEvents: [{ ...HOTEL_CANCELLED.moneyEvents[1], settledBank: null }] }, /settled with no bank figure/);
  thrown({ ...HOTEL_CANCELLED, moneyEvents: [{ ...HOTEL_CANCELLED.moneyEvents[0], settledBank: { amount: 1, currency: 'USD', date: '2026-10-01' } }] }, /stated but carries a bank figure/);
  thrown({ ...HOTEL_CANCELLED, moneyEvents: [{ ...HOTEL_CANCELLED.moneyEvents[0], kind: 'change_fee' }] }, /"change_fee" is not one of refund \| cancellation_fee \| voucher_issued/);
  thrown({ ...HOTEL_CANCELLED, moneyEvents: [{ ...HOTEL_CANCELLED.moneyEvents[0], status: 'maybe' }] }, /"maybe" is not stated \| settled/);
  assert.throws(() => travelLedgerRows([{ ...HOTEL_PHP, lane: 'train' }], VIEWER_ZONE), /reservation lane "train"/);
});

// ── E · THE READ, ADDITIVE ──────────────────────────────────────────────────

test('E GET /api/reservations keeps `bookings` and gains `ledger`; every read names the caller — the links by the caller\'s ids and the reservation\'s owner, source_documents by user_id; the same bank join as the travel-day route; no word, no vendor call, no write', () => {
  const route = code(ROUTE);
  assert.match(route, /return NextResponse\.json\(\{ bookings, ledger \}\);/);
  assert.match(route, /bookingRowOf\(\{\s*reservation: r,/);
  assert.match(route, /prisma\.reservations\.findMany\(\{\s*where: \{ userId: user\.id \},\s*orderBy: \{ createdAt: 'desc' \},/);
  assert.match(route, /trip: \{ select: \{ id: true, name: true \} \},/, 'the trip\'s name rides the reservation read');
  assert.match(route, /id: true, lane: true, provider: true, displayName: true, providerConfirmationCode: true, providerBookingId: true,/);
  // Every findMany's where names the caller (the bookings law's own regex).
  const reads = [...route.matchAll(/prisma\.(\w+)\.findMany\(\{\s*where: \{([^\n]*)\}/g)];
  assert.deepEqual(reads.map((m) => m[1]), ['reservations', 'transaction_reservation_links', 'journal_entries', 'reservation_budget_links', 'calendar_events', 'money_events', 'source_documents']);
  for (const m of reads) assert.match(m[2], /\b(userId|user_id): user\.id\b/, `${m[1]} names the caller`);
  assert.match(route, /where: \{ reservation: \{ userId: user\.id \}, reservationId: \{ in: ids \}, kind: \{ in: \[\.\.\.LEDGER_MONEY_EVENT_KINDS\] \} \},\s*orderBy: \{ statedAt: 'asc' \},/, 'the money events: the caller\'s own reservations, the three kinds that are rows');
  assert.match(route, /where: \{ user_id: user\.id, kind: 'receipt', superseded_by: null, journal_entry_id: \{ in: entryIds \} \},/, 'the receipts: current, on the posted entries, by user_id — the documents route\'s own read');
  assert.match(route, /select: \{ reservationId: true, transaction: \{ select: \{ amount: true, date: true, accounts: \{ select: \{ isoCurrencyCode: true \} \} \} \} \},/);
  assert.match(route, /settledTransaction: \{ select: \{ amount: true, date: true, accounts: \{ select: \{ isoCurrencyCode: true \} \} \} \},/);
  assert.match(route, /select: \{ id: true, date: true, document_reservation_id: true \},/);
  assert.match(route, /budgetLineItem: \{ select: \{ description: true, coaCode: true \} \}/);
  // A contradiction is named, never one picked.
  assert.match(route, /throw new Error\(`reservation \$\{l\.reservationId\} carries two accepted charge links — one bank figure cannot be named`\);/);
  assert.match(route, /throw new Error\(`reservation \$\{e\.document_reservation_id\} carries two posted charge entries — one posting cannot be named`\);/);
  // The facts, not words: no leaf word, no vendor client, zero writes, nothing divided.
  assert.doesNotMatch(route, /BOOKING_WORDS|STATUS_WORDS|'not |"not |travelLedgerRows|statedMoneyWords|bankMoneyWords/);
  assert.doesNotMatch(route, /liteapiClient|liteapiFlightsClient|viatorClient|\bfetch\s*\(|reserveTravelSearch|getFlightBooking|getHotelBooking/);
  assert.doesNotMatch(route, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/);
  assert.doesNotMatch(route, /Number\(|parseFloat|\* 100\b|\/ 100\b|toFixed/);
  // The shape the leaf reads: instants as ISO, days as 'YYYY-MM-DD'.
  assert.match(route, /createdAt: r\.createdAt\.toISOString\(\),/);
  assert.match(route, /statedAt: e\.statedAt\.toISOString\(\),/);
  assert.match(route, /const isoDayOf = \(d: Date\): string => d\.toISOString\(\)\.slice\(0, 10\);/);
  assert.match(route, /receipts: posting !== null && receiptsOf\.has\(posting\.id\) \? receiptsOf\.get\(posting\.id\)! : 0,/);
});

// ── A · THE TABLE in the idiom; the heading; the siblings ───────────────────

test('A the view draws the ledger through the shared DataTable over the leaf\'s spec, in the viewer\'s zone, the sum lines in the foot, the three doors kept on a booking\'s row; types no word; writes nothing', () => {
  const view = code(VIEW);
  assert.match(view, /fetch\('\/api\/reservations'\)/);
  assert.match(view, /Array\.isArray\(data\.ledger\) \? \(data\.ledger as LedgerBookingIn\[\]\) : \[\]/);
  assert.match(view, /setZone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\);/, 'the viewer\'s zone');
  // TRAVEL-02b (2026-11-03, ruling D): the bookings and the typed rows, merged by the leaf — moved, not loosened (travel02b.test.ts pins the merge).
  assert.match(view, /ledgerRowsOf\(loaded\.ledger, loaded\.expenses, zone\)/);
  assert.match(view, /const shown = sortRows\(filterRows\(rows, filters, TRAVEL_LEDGER_TABLE\), sort, TRAVEL_LEDGER_TABLE\);/);
  assert.match(view, /<DataTable\s+name="travel-ledger"\s+columns=\{TRAVEL_LEDGER_TABLE\}/);
  assert.match(view, /csv=\{shown\.length > 0 \? \{ name: TRAVEL_LEDGER_CSV_FILE_NAME \} : null\}/);
  for (const c of TRAVEL_LEDGER_COLUMNS.filter((k) => k !== 'id')) assert.ok(view.includes(`cell(b, '${c}'`), c);
  assert.match(view, /data-travel-ledger-cell="id"/);
  assert.match(view, /data-travel-ledger-sum="stated"[^]*?\{statedSumLineWords\(shown\)\}/);
  assert.match(view, /data-travel-ledger-sum="settled"[^]*?\{settledSumLineWords\(shown\)\}/);
  assert.match(view, /<Link href=\{b\.receiptHref\}[^>]*data-booking-receipt=\{b\.id\}>\s*\{BOOKING_WORDS\.receipt\}/);
  assert.match(view, /<a href=\{b\.icsHref\}[^>]*data-booking-ics=\{b\.id\}>\s*\{BOOKING_WORDS\.addToCalendar\}/);
  assert.match(view, /<Link href=\{b\.tripHref\}[^>]*data-booking-trip=\{b\.id\}>\s*\{BOOKING_WORDS\.trip\}/);
  assert.ok(!/>\s*[A-Za-z][^<{]*</.test(view), 'no typed word');
  assert.ok(!/\.(post|put|patch|delete)\(|method:\s*'(POST|PUT|PATCH|DELETE)'/i.test(view), 'read-only');
  assert.doesNotMatch(view, /localStorage|sessionStorage|document\.cookie/, 'React state only');
  // The heading, where BOOKING_WORDS.heading was.
  const launcher = code(LAUNCHER);
  const from = launcher.indexOf('data-travel-section="bookings"');
  const section = launcher.slice(from, launcher.indexOf('</section>', from));
  assert.match(section, /<TravelHeading>\{TRAVEL_LEDGER_HEADING\}<\/TravelHeading>/);
  assert.match(section, /<AllBookings key=\{`all-\$\{tripsRefresh\}`\} \/>/);
  assert.match(launcher, /import \{ TRAVEL_LEDGER_HEADING \} from '@\/lib\/reservations\/travelLedger';/);
  assert.ok(!('heading' in BOOKING_WORDS), 'BOOKING_WORDS.heading is gone');
  assert.match(comments(ROW_LEAF), /TRAVEL-02a \(Alex, 2026-11-02, ruling A\): `heading: 'Bookings'` was here/);
  assert.match(comments(LAUNCHER), /TRAVEL-02a \(Alex, 2026-11-02, ruling A\): the list is the TRAVEL LEDGER/);
});

test('A the siblings stand: TripBookings, UnattachedBookings and TripBudgetActual know nothing of the ledger and keep their mounts', () => {
  for (const f of SIBLINGS) {
    const src = code(f);
    assert.doesNotMatch(src, /travelLedger|TRAVEL_LEDGER|DataTable|components\/table/, `${f} is untouched by the ledger`);
    assert.match(src, /price not stated/, `${f} still words a NULL price its own way (sec03)`);
  }
  const launcher = code(LAUNCHER);
  assert.match(launcher, /<TripBookings\b/);
  assert.match(launcher, /<UnattachedBookings\b/);
  assert.match(launcher, /<TripBudgetActual key=\{tripsRefresh\} trip=\{currentTrip\} \/>/);
  const sections = [...launcher.matchAll(/data-travel-section="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sections.slice(-3), ['ledger', 'bookings', 'unattached']);
});

// ── G · THE DOES-NOTS ───────────────────────────────────────────────────────

test('G no `$` outside the three formatters in the leaf, the route and the view; no || and no ?? default in the new code; the leaf is pure and imports its words', () => {
  for (const f of [LEAF, ROUTE, VIEW]) {
    const src = code(f);
    assert.doesNotMatch(src, /\$(?!\{)/, `${f} writes no $ of its own`);
    assert.doesNotMatch(src, /\|\||\?\? /, `${f} has no || and no ?? default`);
    assert.doesNotMatch(src, /Intl\.NumberFormat|toLocaleString|formatCents|planDollars/, `${f} formats no figure of its own`);
  }
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /prisma|PrismaClient|\bfetch\s*\(|Date\.now|process\.env|from 'react'/, 'the leaf is pure');
  assert.match(leaf, /import \{\n\s*CURRENCY_NOT_STATED_WORDS, bankCentsWords, bankMoneyWords, centsOfTypedDollars, decimalStringOfCents, isWholeCents, statedMoneyWords,\n\} from '@\/lib\/books\/functionalCurrency';/);
  assert.match(leaf, /import \{ PRICE_NOT_STATED_WORDS \} from '@\/lib\/operations\/travelDay';/);
  assert.match(leaf, /import \{ BOOKING_WORDS, STATUS_WORDS, bookingIcsHref \} from '\.\/bookingRow';/);
  assert.match(leaf, /import \{ LANE_WORD, reservationIdentity \} from '\.\/lane';/);
  assert.doesNotMatch(leaf, /'price not stated'|'not matched'|'not posted'|'no budget line'|'not yet stated'|'departs'/, 'the siblings\' words are imported, never retyped');
  // The scheme and the currency home: the two additions, no || and no ?? in them.
  const scheme = code(SCHEME);
  assert.doesNotMatch(scheme.slice(scheme.indexOf('export function entityLetter')), /\|\||\?\? /);
  const home = code(FX_HOME);
  assert.doesNotMatch(home.slice(home.indexOf('const bankCodeOf'), home.indexOf('export interface PostingAccount')), /\|\||\?\? /);
});
