/**
 * TRAVEL-02a (Alex, 2026-11-02, rulings A–G) — THE TRAVEL LEDGER'S REAL ROWS, PURE.
 *
 * ONE TRAVEL LEDGER, CROSS-TRIP (ruling A): the Travel tab's AllBookings section is the TRAVEL LEDGER — the same
 * one authed GET (/api/reservations, its `ledger` answer), every booking of the caller, as a table in THE table
 * idiom (src/lib/table — columns, sort, filters, CSV). TripBookings, UnattachedBookings and TripBudgetActual (the
 * trip's BUDGET ledger — planned lines) stay as they are; only AllBookings' table is replaced.
 *
 * THE ROWS ARE REAL (ruling B): one row per booking (kind 'booking'), and under it one row per money event of that
 * booking (money_events kind refund | cancellation_fee | voucher_issued — each a REAL money fact), each stated in its
 * own currency; a money event with amountCents null says 'amount not stated'. Nothing calculated sits on this table.
 *
 * THE COLUMNS (ruling C), in Alex's order — when → kind → classification coarse to fine → who's paid → schedule →
 * money → state → id: DATE · KIND · LANE · TRIP · BOOK · ACCOUNT · VENDOR · CONFIRMATION · DATES · STATED · SETTLED ·
 * POSTED · DOCUMENT · STATUS · ID (TRAVEL_LEDGER_COLUMNS, TRAVEL_LEDGER_HEAD_WORDS). Every word is a constant here, or
 * the leaf's it belongs to (bookingRow.ts BOOKING_WORDS / STATUS_WORDS, lane.ts LANE_WORD, travelDay.ts
 * PRICE_NOT_STATED_WORDS, the currency home's).
 *
 * THE DATE RULE (ruling C; the task ledger's own, src/lib/operations/ledger.ts :16-17 — the record's local day by
 * instantToZoned): a booking's DATE is its createdAt — an EVENT INSTANT (the day the vendor confirmed it, Alex's
 * ruling 1); a money event's its statedAt. On screen the instant is drawn in the VIEWER's day (travelLedgerRows takes
 * the viewer's zone); in the CSV it is written as the instant itself. The column sorts by the instant.
 *
 * BOOK and ACCOUNT (Alex's ruling 3): from the booking's budget line when linked — ACCOUNT the line's COA code verbatim
 * ('P-9100'), BOOK the code's letter through the one scheme (accountString.ts ENTITY_LETTER read backwards,
 * entityTypeOfLetter; ledger.ts bookWordOf words the type — Personal · Business · Trading); a linked code whose letter
 * the scheme does not draw says 'no book letter'. Not linked: BOOK '—', ACCOUNT 'no budget line'. Never defaulted.
 *
 * MONEY (ruling C): STATED is statedMoneyWords(finalPriceCents, currency) — '$189.50' in the functional currency,
 * '12345.00 PHP' otherwise, 'price not stated' when the vendor stated none; a money event's amount the same way, in
 * its own code, a refund and a voucher NEGATIVE, a fee positive. SETTLED is the ACCEPTED link's bank row through
 * bankMoneyWords(amount, the account's currency) with its day ('$189.50 · 2026-10-31'), else 'not matched'; a money
 * event's settledTransactionId's bank row the same way. POSTED is the posted entry's day, else 'not posted'. DOCUMENT
 * is 'the booking' — a booking is its posting's source document by construction (src/lib/posting/documentGate.ts) —
 * '+ n receipts' when current source_documents receipts sit on the posted entry. A money event's POSTED and DOCUMENT
 * are '—': the read states no posting for one (its refund posting is a later PR's question).
 *
 * THE SUM LINES (ruling D): STATED per currency — statedMoneyWords of the sum of the stated minor units by code, a
 * refund and a voucher reducing their code's sum, with '<n> price not stated' / '<n> amount not stated' / '<n>
 * currency not stated' for what could not be summed; SETTLED per ACCOUNT currency — bankCentsWords of the bank cents
 * summed by the account's code, with '<n> not matched' (and '<n> not whole cents' should a bank row not be whole
 * cents). Never one figure across currencies; never converted.
 *
 * A CONTRADICTION IS NAMED, NEVER SMOOTHED: a matched charge with no bank row, a bank row with no match, a posting
 * with no day, receipts on an unposted charge, a settled money event with no bank row (or the reverse), a money event
 * kind or status the ruling does not name — each throws TravelLedgerError by name.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock (the instants are the rows' own), no React, no env.
 */
import { entityTypeOfLetter } from '@/lib/accountString';
import {
  CURRENCY_NOT_STATED_WORDS, bankCentsWords, bankMoneyWords, centsOfTypedDollars, decimalStringOfCents, isWholeCents, statedMoneyWords,
} from '@/lib/books/functionalCurrency';
import { bookWordOf } from '@/lib/operations/ledger';
import { PRICE_NOT_STATED_WORDS } from '@/lib/operations/travelDay';
import { columnOf, type SortKey, type TableColumn } from '@/lib/table/columns';
import { tableCsv } from '@/lib/table/csv';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { instantToZoned } from '@/lib/time';
import { BOOKING_WORDS, STATUS_WORDS, bookingIcsHref } from './bookingRow';
import { LANE_WORD, reservationIdentity } from './lane';

export class TravelLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TravelLedgerError';
  }
}

// ── THE WORDS ───────────────────────────────────────────────────────────────

/** Ruling A: the section's heading — where BOOKING_WORDS.heading ('Bookings') was. */
export const TRAVEL_LEDGER_HEADING = 'TRAVEL LEDGER';
export const TRAVEL_LEDGER_CSV_FILE_NAME = 'travel-ledger.csv';
export const UNATTACHED_WORDS = 'unattached';
export const NO_BOOK_LETTER_WORDS = 'no book letter';
export const AMOUNT_NOT_STATED_WORDS = 'amount not stated';
export const THE_BOOKING_WORDS = 'the booking';
export const STATED_SUM_LABEL = 'STATED';
export const SETTLED_SUM_LABEL = 'SETTLED';
/** Between a figure and its day in SETTLED, and between the parts of a sum line. */
export const JOIN_WORDS = ' · ';
export const receiptsWords = (n: number): string => (n === 1 ? '1 receipt' : `${n} receipts`);
export const priceNotStatedCountWords = (n: number): string => `${n} ${PRICE_NOT_STATED_WORDS}`;
export const amountNotStatedCountWords = (n: number): string => `${n} ${AMOUNT_NOT_STATED_WORDS}`;
export const currencyNotStatedCountWords = (n: number): string => `${n} ${CURRENCY_NOT_STATED_WORDS}`;
export const notMatchedCountWords = (n: number): string => `${n} ${BOOKING_WORDS.notMatched}`;
export const notWholeCentsCountWords = (n: number): string => `${n} not whole cents`;

/** Ruling B/C: the four kinds a row can be, and their words — a money event's kind through KIND_OF_EVENT. */
export type TravelLedgerKind = 'booking' | 'refund' | 'fee' | 'voucher';
export const KIND_WORDS: Readonly<Record<TravelLedgerKind, string>> = { booking: 'booking', refund: 'refund', fee: 'fee', voucher: 'voucher' };
/** The money_events kinds that are rows here (ruling B) — the read asks for exactly these. */
export const LEDGER_MONEY_EVENT_KINDS = ['refund', 'cancellation_fee', 'voucher_issued'] as const;
export type LedgerMoneyEventKind = (typeof LEDGER_MONEY_EVENT_KINDS)[number];
const KIND_OF_EVENT: Readonly<Record<LedgerMoneyEventKind, TravelLedgerKind>> = { refund: 'refund', cancellation_fee: 'fee', voucher_issued: 'voucher' };
/** Ruling C: a refund and a voucher are stated NEGATIVE on the ledger, a fee positive. */
const SIGN_OF_EVENT: Readonly<Record<LedgerMoneyEventKind, 1 | -1>> = { refund: -1, cancellation_fee: 1, voucher_issued: -1 };
/** A money event's status column, verbatim — the table admits these two (CHECK in SQL); a third is thrown. */
export const MONEY_EVENT_STATUS_WORDS = { stated: 'stated', settled: 'settled' } as const;

// ── THE INPUT — the facts the route's `ledger` answer carries (ruling E) ─────

/** A bank row as the route reads it: the amount as stored, the account's stated currency (null when it states none), the row's day. */
export interface LedgerBankIn {
  readonly amount: number;
  readonly currency: string | null;
  readonly date: string;
}

export interface LedgerMoneyEventIn {
  readonly id: string;
  readonly kind: string;
  readonly amountCents: number | null;
  readonly currency: string | null;
  readonly status: string;
  /** An ISO instant — the arrival's clock. */
  readonly statedAt: string;
  readonly settledAt: string | null;
  readonly settledBank: LedgerBankIn | null;
}

export interface LedgerBookingIn {
  readonly id: string;
  /** An ISO instant — the day the vendor confirmed the booking (Alex's ruling 1). */
  readonly createdAt: string;
  readonly lane: string;
  readonly provider: string;
  readonly displayName: string | null;
  readonly providerBookingId: string;
  readonly confirmation: string | null;
  readonly status: string;
  readonly finalPriceCents: number | null;
  readonly currency: string;
  /** 'YYYY-MM-DD' days, or null. */
  readonly checkinDate: string | null;
  readonly checkoutDate: string | null;
  /** A flight's service day from its earliest calendar row, or null. */
  readonly calendarDay: string | null;
  readonly trip: { readonly id: string; readonly name: string } | null;
  readonly budgetLine: { readonly coaCode: string } | null;
  readonly charge: {
    readonly matched: boolean;
    readonly posted: boolean;
    readonly bank: LedgerBankIn | null;
    readonly postedDay: string | null;
    readonly postedEntryId: string | null;
  };
  /** Current receipts (source_documents kind 'receipt', not superseded) on the posted entry — 0 when nothing is posted. */
  readonly receipts: number;
  readonly moneyEvents: readonly LedgerMoneyEventIn[];
}

// ── THE ROW ─────────────────────────────────────────────────────────────────

/** A stated figure in its own minor units and code (null code: the vendor stated an amount and no currency). A money event's is signed. */
export interface StatedFigure {
  readonly cents: number;
  readonly currency: string | null;
}

export interface TravelLedgerRow {
  /** `booking:<reservation id>` | `event:<money event id>` — the React key and the row's attribute. */
  readonly rowKey: string;
  readonly kind: TravelLedgerKind;
  readonly bookingId: string;
  /** The ID column: the reservation id, or the money event id. */
  readonly id: string;
  /** The DATE column's instant (the CSV's cell) and the viewer's day of it (the screen's cell). */
  readonly instant: string;
  readonly day: string;
  readonly laneWord: string;
  /** The trip's name; null is unattached. */
  readonly trip: string | null;
  /** The book word through the one scheme, or 'no book letter'; null when no budget line is linked. */
  readonly book: string | null;
  /** The linked budget line's COA code; null when none is linked. */
  readonly account: string | null;
  /** `<provider> · <name as stated>` — the name through the one lane reader (lane.ts reservationIdentity). */
  readonly vendor: string;
  readonly confirmation: string | null;
  readonly dates: string | null;
  readonly stated: StatedFigure | null;
  readonly settled: LedgerBankIn | null;
  /** A booking: the posted entry's day or null; a money event: null (no posting is read for one). */
  readonly postedDay: string | null;
  /** A booking: the current receipts on its posted entry; a money event: null. */
  readonly receipts: number | null;
  readonly status: string;
  /** A booking's doors (RECEIPT-01, CAL-02, TRIPS-01); null on a money event's row. */
  readonly receiptHref: string | null;
  readonly icsHref: string | null;
  readonly tripHref: string | null;
}

/** The viewer's day of an ISO instant — the task ledger's placing (time.ts instantToZoned). */
export const dayInZone = (instant: string, zone: string): string => instantToZoned(new Date(instant), zone).date;

/** The book a linked budget line names: its COA code's letter through the one scheme; 'no book letter' when the scheme draws none for it. */
export function bookOfCoaCode(coaCode: string): string {
  const letter = /^([A-Z])-/.exec(coaCode);
  const entityType = letter === null ? null : entityTypeOfLetter(letter[1]);
  return entityType === null ? NO_BOOK_LETTER_WORDS : bookWordOf(entityType);
}

const confirmationOf = (code: string | null): string | null => {
  const trimmed = typeof code === 'string' ? code.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

/** Ruling C: a stay's check-in → check-out; a flight's departs <its calendar day>; else null ('—'). */
function datesOf(b: LedgerBookingIn): string | null {
  if (b.checkinDate !== null && b.checkoutDate !== null) return `${b.checkinDate} → ${b.checkoutDate}`;
  if (b.lane === BOOKING_WORDS.flight && b.calendarDay !== null) return `${BOOKING_WORDS.departs} ${b.calendarDay}`;
  return null;
}

/** STATUS_WORDS for the recorded status; any other value renders AS ITSELF (bookingRow.ts' rule) — never a guess. */
const bookingStatusWords = (status: string): string => (Object.prototype.hasOwnProperty.call(STATUS_WORDS, status) ? STATUS_WORDS[status] : status);

function moneyEventStatusWords(status: string): string {
  if (status === 'stated') return MONEY_EVENT_STATUS_WORDS.stated;
  if (status === 'settled') return MONEY_EVENT_STATUS_WORDS.settled;
  throw new TravelLedgerError(`money event status ${JSON.stringify(status)} is not stated | settled — the table admits nothing else`);
}

function ledgerEventKindOf(kind: string): LedgerMoneyEventKind {
  if ((LEDGER_MONEY_EVENT_KINDS as readonly string[]).includes(kind)) return kind as LedgerMoneyEventKind;
  throw new TravelLedgerError(`money event kind ${JSON.stringify(kind)} is not one of ${LEDGER_MONEY_EVENT_KINDS.join(' | ')} — not a row of this ledger`);
}

/**
 * The rows, in the table's own order: the bookings as the route gives them (newest first), each followed by its money
 * events (as the route gives them — by statedAt). `zone` is the viewer's IANA zone: the DATE column's day on screen.
 */
export function travelLedgerRows(bookings: readonly LedgerBookingIn[], zone: string): TravelLedgerRow[] {
  const rows: TravelLedgerRow[] = [];
  for (const b of bookings) {
    const identity = reservationIdentity({ lane: b.lane, displayName: b.displayName, providerConfirmationCode: b.confirmation, providerBookingId: b.providerBookingId });
    if (b.charge.matched && b.charge.bank === null) throw new TravelLedgerError(`booking ${b.id} is matched with no bank figure`);
    if (!b.charge.matched && b.charge.bank !== null) throw new TravelLedgerError(`booking ${b.id} is not matched but carries a bank figure`);
    const postingNamed = b.charge.postedDay !== null && b.charge.postedEntryId !== null;
    if (b.charge.posted && !postingNamed) throw new TravelLedgerError(`booking ${b.id} is posted with no posting day or entry`);
    if (!b.charge.posted && b.charge.postedDay !== null) throw new TravelLedgerError(`booking ${b.id} is not posted but carries a posting day`);
    if (!b.charge.posted && b.charge.postedEntryId !== null) throw new TravelLedgerError(`booking ${b.id} is not posted but carries a posted entry`);
    if (!b.charge.posted && b.receipts !== 0) throw new TravelLedgerError(`booking ${b.id} is not posted but carries receipts`);
    const shared = {
      bookingId: b.id,
      laneWord: LANE_WORD[identity.type],
      trip: b.trip === null ? null : b.trip.name,
      book: b.budgetLine === null ? null : bookOfCoaCode(b.budgetLine.coaCode),
      account: b.budgetLine === null ? null : b.budgetLine.coaCode,
      vendor: `${b.provider}${JOIN_WORDS}${identity.name}`,
      confirmation: confirmationOf(b.confirmation),
      dates: datesOf(b),
    };
    rows.push({
      ...shared,
      rowKey: `booking:${b.id}`,
      kind: 'booking',
      id: b.id,
      instant: b.createdAt,
      day: dayInZone(b.createdAt, zone),
      stated: b.finalPriceCents === null ? null : { cents: b.finalPriceCents, currency: b.currency },
      settled: b.charge.bank,
      postedDay: b.charge.postedDay,
      receipts: b.receipts,
      status: bookingStatusWords(b.status),
      receiptHref: `/booking/${b.id}/receipt`,
      icsHref: bookingIcsHref(b.id),
      tripHref: b.trip === null ? null : `/travel?trip=${b.trip.id}`,
    });
    for (const e of b.moneyEvents) {
      const eventKind = ledgerEventKindOf(e.kind);
      const status = moneyEventStatusWords(e.status);
      if (status === MONEY_EVENT_STATUS_WORDS.settled && e.settledBank === null) throw new TravelLedgerError(`money event ${e.id} is settled with no bank figure`);
      if (status === MONEY_EVENT_STATUS_WORDS.stated && e.settledBank !== null) throw new TravelLedgerError(`money event ${e.id} is stated but carries a bank figure`);
      rows.push({
        ...shared,
        rowKey: `event:${e.id}`,
        kind: KIND_OF_EVENT[eventKind],
        id: e.id,
        instant: e.statedAt,
        day: dayInZone(e.statedAt, zone),
        stated: e.amountCents === null ? null : { cents: SIGN_OF_EVENT[eventKind] * e.amountCents, currency: e.currency },
        settled: e.settledBank,
        postedDay: null,
        receipts: null,
        status,
        receiptHref: null,
        icsHref: null,
        tripHref: null,
      });
    }
  }
  return rows;
}

// ── THE CELLS ───────────────────────────────────────────────────────────────

/** A stated figure's words: the one formatter in the functional currency, the figure with its code otherwise, the code's absence named. */
export function statedFigureWords(stated: StatedFigure): string {
  return stated.currency === null ? `${decimalStringOfCents(stated.cents)} (${CURRENCY_NOT_STATED_WORDS})` : statedMoneyWords(stated.cents, stated.currency);
}
/** The STATED cell: the figure, or the kind's own absence — a booking's 'price not stated', a money event's 'amount not stated'. */
export const statedCellWords = (row: TravelLedgerRow): string =>
  (row.stated === null ? (row.kind === 'booking' ? PRICE_NOT_STATED_WORDS : AMOUNT_NOT_STATED_WORDS) : statedFigureWords(row.stated));
/** The SETTLED cell: the bank figure in the account's currency with its day, or 'not matched'. */
export const settledCellWords = (row: TravelLedgerRow): string =>
  (row.settled === null ? BOOKING_WORDS.notMatched : `${bankMoneyWords(row.settled.amount, row.settled.currency)}${JOIN_WORDS}${row.settled.date}`);
/** The POSTED cell: a booking's posted day or 'not posted'; a money event's '—'. */
export const postedCellWords = (row: TravelLedgerRow): string =>
  (row.kind !== 'booking' ? BLANK : row.postedDay === null ? BOOKING_WORDS.notPosted : row.postedDay);
/** The DOCUMENT cell: 'the booking', '+ n receipts' when current receipts sit on its posted entry; a money event's '—'. */
export const documentCellWords = (row: TravelLedgerRow): string =>
  (row.receipts === null ? BLANK : row.receipts === 0 ? THE_BOOKING_WORDS : `${THE_BOOKING_WORDS} + ${receiptsWords(row.receipts)}`);

/** The CSV's figure: the minor units with the point placed, then the code (or the code's absence named) — no symbol, no grouping, no conversion. */
const figureWithCodeCsv = (cents: bigint | number, code: string | null): string =>
  `${decimalStringOfCents(cents)} ${code === null ? `(${CURRENCY_NOT_STATED_WORDS})` : code.toUpperCase()}`;
/** A bank row's CSV figure: whole cents as the figure with the account's code; a row that is not whole cents as bankMoneyWords names it. */
const bankCsv = (bank: LedgerBankIn): string => {
  const code = bank.currency !== null && bank.currency.trim() !== '' ? bank.currency : null;
  return isWholeCents(bank.amount) ? figureWithCodeCsv(centsOfTypedDollars(String(bank.amount)), code) : bankMoneyWords(bank.amount, bank.currency);
};

// ── THE SPEC — the idiom's columns in Alex's order ───────────────────────────

export const TRAVEL_LEDGER_COLUMNS = ['date', 'kind', 'lane', 'trip', 'book', 'account', 'vendor', 'confirmation', 'dates', 'stated', 'settled', 'posted', 'document', 'status', 'id'] as const;
export type TravelLedgerColumn = (typeof TRAVEL_LEDGER_COLUMNS)[number];
export const TRAVEL_LEDGER_HEAD_WORDS: Readonly<Record<TravelLedgerColumn, string>> = {
  date: 'DATE', kind: 'KIND', lane: 'LANE', trip: 'TRIP', book: 'BOOK', account: 'ACCOUNT', vendor: 'VENDOR', confirmation: 'CONFIRMATION',
  dates: 'DATES', stated: 'STATED', settled: 'SETTLED', posted: 'POSTED', document: 'DOCUMENT', status: 'STATUS', id: 'ID',
};

/** A column's cell as the table prints it — the one key a VALUE filter matches and a checklist lists; BLANK for a blank cell. */
export function cellWordsOf(row: TravelLedgerRow, column: TravelLedgerColumn): string {
  switch (column) {
    case 'date': return row.day;
    case 'kind': return KIND_WORDS[row.kind];
    case 'lane': return row.laneWord;
    case 'trip': return row.trip === null ? UNATTACHED_WORDS : row.trip;
    case 'book': return row.book === null ? BLANK : row.book;
    case 'account': return row.account === null ? BOOKING_WORDS.noBudgetLine : row.account;
    case 'vendor': return row.vendor;
    case 'confirmation': return row.confirmation === null ? BOOKING_WORDS.notYetStated : row.confirmation;
    case 'dates': return row.dates === null ? BLANK : row.dates;
    case 'stated': return statedCellWords(row);
    case 'settled': return settledCellWords(row);
    case 'posted': return postedCellWords(row);
    case 'document': return documentCellWords(row);
    case 'status': return row.status;
    case 'id': return row.id;
  }
}

/**
 * What a column sorts by: DATE its instant (the true order — two instants on one day keep their order), the figures
 * their own minor units or bank amount (an order by magnitude in each row's own currency — no figure is converted),
 * the words as text; a blank cell null — last in both directions.
 */
export function sortKeyOf(row: TravelLedgerRow, column: TravelLedgerColumn): SortKey {
  switch (column) {
    case 'date': return textKey(row.instant);
    case 'stated': return numberKey(row.stated === null ? null : row.stated.cents);
    case 'settled': return numberKey(row.settled === null ? null : row.settled.amount);
    case 'book': return textKey(row.book);
    case 'account': return textKey(row.account);
    case 'trip': return textKey(row.trip);
    case 'confirmation': return textKey(row.confirmation);
    case 'dates': return textKey(row.dates);
    case 'posted': return textKey(row.kind !== 'booking' ? null : row.postedDay);
    case 'document': return textKey(row.receipts === null ? null : documentCellWords(row));
    default: return textKey(cellWordsOf(row, column));
  }
}

/**
 * The CSV's field for each column — the fact bare, '' for a blank (never 0 or "—"): DATE the instant (ruling C), the
 * figures as `<minor units with the point placed> <CODE>` (no symbol — '189.50 USD', '12345.00 PHP', '-300.00 USD'),
 * SETTLED with its day after the join, the text cells as the table prints them.
 */
export const TRAVEL_LEDGER_CSV: Readonly<Record<TravelLedgerColumn, (row: TravelLedgerRow) => string>> = {
  date: (row) => row.instant,
  kind: (row) => KIND_WORDS[row.kind],
  lane: (row) => row.laneWord,
  trip: (row) => (row.trip === null ? UNATTACHED_WORDS : row.trip),
  book: (row) => (row.book === null ? '' : row.book),
  account: (row) => (row.account === null ? '' : row.account),
  vendor: (row) => row.vendor,
  confirmation: (row) => (row.confirmation === null ? '' : row.confirmation),
  dates: (row) => (row.dates === null ? '' : row.dates),
  stated: (row) => (row.stated === null ? '' : figureWithCodeCsv(row.stated.cents, row.stated.currency)),
  settled: (row) => (row.settled === null ? '' : `${bankCsv(row.settled)}${JOIN_WORDS}${row.settled.date}`),
  posted: (row) => (row.kind === 'booking' && row.postedDay !== null ? row.postedDay : ''),
  document: (row) => (row.receipts === null ? '' : documentCellWords(row)),
  status: (row) => row.status,
  id: (row) => row.id,
};

/**
 * THE SPEC for the shared idiom (src/lib/table/columns.ts TableColumn): fifteen VALUE columns and the ID as a TEXT
 * column (a contains-text). STATED and SETTLED are VALUE columns, not MONEY columns: the money popover reads cents as
 * dollars ('min $' / 'max $') and would put a `$` beside a PHP figure and compare across currencies — a checklist of
 * their own words does neither.
 */
export const TRAVEL_LEDGER_TABLE: readonly TableColumn<TravelLedgerRow, TravelLedgerColumn>[] = TRAVEL_LEDGER_COLUMNS.map((key): TableColumn<TravelLedgerRow, TravelLedgerColumn> => {
  const base = { key, label: TRAVEL_LEDGER_HEAD_WORDS[key], words: (row: TravelLedgerRow) => cellWordsOf(row, key), sortKey: (row: TravelLedgerRow) => sortKeyOf(row, key), csv: TRAVEL_LEDGER_CSV[key] };
  return key === 'id' ? { ...base, kind: 'text', text: (row) => row.id } : { ...base, kind: 'value' };
});
export const travelLedgerColumnOf = (column: TravelLedgerColumn): TableColumn<TravelLedgerRow, TravelLedgerColumn> => columnOf(TRAVEL_LEDGER_TABLE, column);

/** The rows shown, as a CSV — the idiom's writer over this spec (csv.ts tableCsv): the head words, then one line per row, CRLF, UTF-8, no BOM. */
export const travelLedgerCsv = (rows: readonly TravelLedgerRow[]): string => tableCsv(TRAVEL_LEDGER_TABLE, rows);

// ── THE SUM LINES (ruling D) ─────────────────────────────────────────────────

export interface StatedSums {
  /** The stated minor units summed by code (upper-cased), a refund and a voucher negative. */
  readonly byCode: ReadonlyMap<string, number>;
  readonly priceNotStated: number;
  readonly amountNotStated: number;
  readonly currencyNotStated: number;
}

export function statedSums(rows: readonly TravelLedgerRow[]): StatedSums {
  const byCode = new Map<string, number>();
  let priceNotStated = 0;
  let amountNotStated = 0;
  let currencyNotStated = 0;
  for (const row of rows) {
    if (row.stated === null) {
      if (row.kind === 'booking') priceNotStated += 1;
      else amountNotStated += 1;
      continue;
    }
    if (row.stated.currency === null) {
      currencyNotStated += 1;
      continue;
    }
    const code = row.stated.currency.toUpperCase();
    byCode.set(code, (byCode.has(code) ? byCode.get(code)! : 0) + row.stated.cents);
  }
  return { byCode, priceNotStated, amountNotStated, currencyNotStated };
}

export interface SettledSums {
  /** The bank cents summed by the ACCOUNT's code; the key '' is the accounts that state no currency. */
  readonly byCode: ReadonlyMap<string, bigint>;
  readonly notMatched: number;
  readonly notWholeCents: number;
}

export function settledSums(rows: readonly TravelLedgerRow[]): SettledSums {
  const byCode = new Map<string, bigint>();
  let notMatched = 0;
  let notWholeCents = 0;
  for (const row of rows) {
    if (row.settled === null) {
      notMatched += 1;
      continue;
    }
    if (!isWholeCents(row.settled.amount)) {
      notWholeCents += 1;
      continue;
    }
    const code = row.settled.currency !== null && row.settled.currency.trim() !== '' ? row.settled.currency.trim().toUpperCase() : '';
    byCode.set(code, (byCode.has(code) ? byCode.get(code)! : BigInt(0)) + centsOfTypedDollars(String(row.settled.amount)));
  }
  return { byCode, notMatched, notWholeCents };
}

const codesInOrder = (codes: Iterable<string>): string[] => [...codes].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));

/** "STATED: 12345.00 PHP · $189.50 · 1 price not stated" — per currency, never one figure across them; '—' with no row. */
export function statedSumLineWords(rows: readonly TravelLedgerRow[]): string {
  const sums = statedSums(rows);
  const parts = codesInOrder(sums.byCode.keys()).map((code) => statedMoneyWords(sums.byCode.get(code)!, code));
  if (sums.priceNotStated > 0) parts.push(priceNotStatedCountWords(sums.priceNotStated));
  if (sums.amountNotStated > 0) parts.push(amountNotStatedCountWords(sums.amountNotStated));
  if (sums.currencyNotStated > 0) parts.push(currencyNotStatedCountWords(sums.currencyNotStated));
  return `${STATED_SUM_LABEL}: ${parts.length === 0 ? BLANK : parts.join(JOIN_WORDS)}`;
}

/** "SETTLED: $214.50 · 3 not matched" — per ACCOUNT currency through bankCentsWords; '—' with no row. */
export function settledSumLineWords(rows: readonly TravelLedgerRow[]): string {
  const sums = settledSums(rows);
  const parts = codesInOrder(sums.byCode.keys()).map((code) => bankCentsWords(sums.byCode.get(code)!, code === '' ? null : code));
  if (sums.notMatched > 0) parts.push(notMatchedCountWords(sums.notMatched));
  if (sums.notWholeCents > 0) parts.push(notWholeCentsCountWords(sums.notWholeCents));
  return `${SETTLED_SUM_LABEL}: ${parts.length === 0 ? BLANK : parts.join(JOIN_WORDS)}`;
}
