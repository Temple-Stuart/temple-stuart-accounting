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
 * TRAVEL-02b (Alex, 2026-11-03, rulings 0, D, F) — THE TYPED ROWS, AND THE SORT BY CODE.
 *   · ITEM 0 (02a's call 5 was NO): STATED and SETTLED sort by CURRENCY CODE first (A→Z), then by the minor units
 *     within the code; a blank last both ways — an order that never ranks a PHP figure against a USD one
 *     (codedSortText, below).
 *   · THE TYPED ROWS (ruling D): a travel expense the customer typed (travel_expenses — a visa, an eSIM, another
 *     one-off purchase; src/lib/travel/travelExpense.ts) is a row of kind visa | esim | other, its source 'typed', in
 *     the same columns: DATE its paid_on — a DAY, drawn as that day on screen and written as it in the CSV (the DAY
 *     rule: no zone moves a day); LANE '—'; TRIP the trip's name or 'unattached'; BOOK / ACCOUNT from its coa_code
 *     through the same scheme as a booking's budget line (else '—' / 'no account'); VENDOR as stored; CONFIRMATION and
 *     DATES '—'; STATED statedMoneyWords(amount_minor, currency); SETTLED the bank row of each posting linked to it
 *     (planned_item_links kind 'travel_expense' → the journal entry → its bank row, source_id) through bankMoneyWords
 *     with its day, joined by ' + ' when there are several, else 'not matched'; POSTED each posting's day, else 'not
 *     posted'; DOCUMENT 'typed' (+ 'n receipts' on the matched postings); STATUS 'stated', or 'voided — <reason>'.
 *     A REVERSED POSTING PAYS NOTHING (LINK-LAW-01): it leaves SETTLED and POSTED and is counted under the table in the
 *     link rule's own words (postingAmount.ts reversedLinkedWords). A VOIDED row stays, struck through on screen, and
 *     leaves both sum lines — counted '<n> voided'. A linked posting that names no bank row says 'matched — no bank row'.
 *   · THE ORDER: the bookings (each with its money events) and the typed rows, newest first, by the booking's instant
 *     and the typed row's day (its UTC midnight) — ledgerRowsOf.
 *
 * TRAVEL-02b-fix (Alex, 2026-11-03, rulings A and B): NO SILENT EMPTY — a 200 that lacks a list it promises fails the
 * read by name (THE READS, travelLedgerReadsOf); and VENDOR is as stored, which since ruling B is as typed, trimmed.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock (the instants are the rows' own), no React, no env.
 */
import { entityTypeOfLetter } from '@/lib/accountString';
import {
  CURRENCY_NOT_STATED_WORDS, bankCentsWords, bankMoneyWords, centsOfTypedDollars, decimalStringOfCents, isWholeCents, statedMoneyWords,
} from '@/lib/books/functionalCurrency';
import { isIsoDay } from '@/lib/budget/days';
import { reversedLinkedWords } from '@/lib/calendar/postingAmount';
import { bookWordOf } from '@/lib/operations/ledger';
import { PRICE_NOT_STATED_WORDS } from '@/lib/operations/travelDay';
import { columnOf, type SortKey, type TableColumn } from '@/lib/table/columns';
import { tableCsv } from '@/lib/table/csv';
import { textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';
import { instantToZoned } from '@/lib/time';
import { isTravelExpenseKind, type ChartChoice, type TravelExpenseKind, type TripChoice } from '@/lib/travel/travelExpense';
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
// TRAVEL-02b (ruling F): the typed rows' words.
/** A typed row's source, and its DOCUMENT: the customer typed it — no vendor document stands behind it. */
export const TYPED_WORDS = 'typed';
/** A voided row's STATUS: the words, then the reason as typed. */
export const VOIDED_WORDS = 'voided — ';
export const voidedStatusWords = (reason: string): string => `${VOIDED_WORDS}${reason}`;
/** A typed row's ACCOUNT when no chart account was chosen. */
export const NO_ACCOUNT_WORDS = 'no account';
/** A typed row's SETTLED part for a linked posting that names no bank row (a manual entry, say). */
export const NO_BANK_ROW_WORDS = 'matched — no bank row';
/** Between the parts of a typed row's SETTLED or POSTED — one per posting linked to it. */
export const PARTS_JOIN_WORDS = ' + ';
export const voidedCountWords = (n: number): string => `${n} voided`;
export const noBankRowCountWords = (n: number): string => `${n} matched with no bank row`;

/**
 * Ruling B/C: the kinds a row can be, and their words — a money event's kind through KIND_OF_EVENT. TRAVEL-02b (ruling F):
 * the typed rows' three kinds (travelExpense.ts TRAVEL_EXPENSE_KINDS) and their words.
 */
export type TravelLedgerKind = 'booking' | 'refund' | 'fee' | 'voucher' | TravelExpenseKind;
export const KIND_WORDS: Readonly<Record<TravelLedgerKind, string>> = {
  booking: 'booking', refund: 'refund', fee: 'fee', voucher: 'voucher', visa: 'visa', esim: 'eSIM', other: 'other',
};
/** Where a row comes from: a reservation (a booking and its money events) or a travel expense the customer typed. */
export type TravelLedgerSource = 'reservation' | 'typed';
/** The money_events kinds that are rows here (ruling B) — the read asks for exactly these. */
export const LEDGER_MONEY_EVENT_KINDS = ['refund', 'cancellation_fee', 'voucher_issued'] as const;
export type LedgerMoneyEventKind = (typeof LEDGER_MONEY_EVENT_KINDS)[number];
const KIND_OF_EVENT: Readonly<Record<LedgerMoneyEventKind, TravelLedgerKind>> = { refund: 'refund', cancellation_fee: 'fee', voucher_issued: 'voucher' };
/** Ruling C: a refund and a voucher are stated NEGATIVE on the ledger, a fee positive. */
const SIGN_OF_EVENT: Readonly<Record<LedgerMoneyEventKind, 1 | -1>> = { refund: -1, cancellation_fee: 1, voucher_issued: -1 };
/** A money event's status column, verbatim — the table admits these two (CHECK in SQL); a third is thrown. A typed row is 'stated' too. */
export const MONEY_EVENT_STATUS_WORDS = { stated: 'stated', settled: 'settled' } as const;
/** A money event's row: no posting is read for it, so its POSTED and DOCUMENT are '—'. */
const MONEY_EVENT_ROW_KINDS: readonly TravelLedgerKind[] = ['refund', 'fee', 'voucher'];
const isMoneyEventKind = (kind: TravelLedgerKind): boolean => MONEY_EVENT_ROW_KINDS.includes(kind);

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

/**
 * TRAVEL-02b: a posting linked to a typed expense (planned_item_links kind 'travel_expense'), as GET /api/travel-expenses
 * reads it — its day in the books, whether it was reversed (postingAmount.ts isReversedPosting), the bank row it names
 * (a bank posting's source_id is its transaction's transactionId — journal-entry-service.ts commitPlaidTransaction) or
 * null, and the current receipts on it.
 */
export interface TravelExpensePostingIn {
  readonly journal_entry_id: string;
  readonly posted_on: string;
  readonly reversed: boolean;
  readonly bank: LedgerBankIn | null;
  readonly receipts: number;
}

/** TRAVEL-02b: a typed travel expense as GET /api/travel-expenses answers it — the row's own columns, its trip, its linked postings. */
export interface TravelExpenseIn {
  readonly id: string;
  readonly kind: string;
  /** 'YYYY-MM-DD' — the DAY it was paid. */
  readonly paid_on: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly vendor: string;
  readonly note: string | null;
  readonly trip: { readonly id: string; readonly name: string } | null;
  readonly coa_code: string | null;
  readonly voided_at: string | null;
  readonly void_reason: string | null;
  readonly created_at: string;
  readonly postings: readonly TravelExpensePostingIn[];
}

// ── THE READS (TRAVEL-02b-fix, Alex, 2026-11-03, ruling A — no silent empty) ───
//
// The TRAVEL LEDGER reads two routes. A 200 whose JSON lacks a list it promises is a MALFORMED answer: the read fails
// by name (missingListWords) through the screen's existing error state, and nothing is shown as an empty ledger. A list
// that is truly empty ([]) stays a list. AllBookings.tsx parses both answers here, so the tests drive the same parse.

/** The routes the lists come from — the paths AllBookings.tsx fetches (the bookings law pins its literal fetch). */
export const RESERVATIONS_ROUTE = '/api/reservations';
export const TRAVEL_EXPENSES_ROUTE = '/api/travel-expenses';

/** Ruling A: a 200 that lacks the list it promises, named by route and list — and nothing shown as empty. */
export const missingListWords = (route: string, name: string): string =>
  `${route} answered without its "${name}" list — nothing is shown as empty`;

/** One list a 200 promises: the list as answered (a truly empty one stays a list), or the read refused by name. */
export function listOf<T>(answer: unknown, route: string, name: string): T[] {
  const list: unknown = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>)[name] : undefined;
  if (!Array.isArray(list)) throw new TravelLedgerError(missingListWords(route, name));
  return list as T[];
}

/** What the TRAVEL LEDGER holds once both reads answered 200: the bookings (with their money events), the typed rows, the form's two lists. */
export interface TravelLedgerReads {
  readonly ledger: LedgerBookingIn[];
  readonly expenses: TravelExpenseIn[];
  readonly trips: TripChoice[];
  readonly accounts: ChartChoice[];
}

/** Ruling A: both 200 answers, every list each promises — or the read fails by name (TravelLedgerError, missingListWords). */
export function travelLedgerReadsOf(reservations: unknown, travelExpenses: unknown): TravelLedgerReads {
  return {
    ledger: listOf<LedgerBookingIn>(reservations, RESERVATIONS_ROUTE, 'ledger'),
    expenses: listOf<TravelExpenseIn>(travelExpenses, TRAVEL_EXPENSES_ROUTE, 'expenses'),
    trips: listOf<TripChoice>(travelExpenses, TRAVEL_EXPENSES_ROUTE, 'trips'),
    accounts: listOf<ChartChoice>(travelExpenses, TRAVEL_EXPENSES_ROUTE, 'accounts'),
  };
}

// ── THE ROW ─────────────────────────────────────────────────────────────────

/** A stated figure in its own minor units and code (null code: the vendor stated an amount and no currency). A money event's is signed. */
export interface StatedFigure {
  readonly cents: number;
  readonly currency: string | null;
}

export interface TravelLedgerRow {
  /** `booking:<reservation id>` | `event:<money event id>` | `typed:<travel expense id>` — the React key and the row's attribute. */
  readonly rowKey: string;
  /** TRAVEL-02b (ruling D): where the row comes from — a reservation, or a travel expense the customer typed. */
  readonly source: TravelLedgerSource;
  readonly kind: TravelLedgerKind;
  /** The reservation a booking's row, or a money event's, belongs to; null on a typed row. */
  readonly bookingId: string | null;
  /** The ID column: the reservation id, the money event id, or the travel expense id. */
  readonly id: string;
  /** The DATE column's instant (the CSV's cell) — null on a typed row, whose DATE is a DAY. */
  readonly instant: string | null;
  /** The screen's DATE: the viewer's day of the instant; a typed row's own day. */
  readonly day: string;
  /** The lane word; null on a typed row ('—'). */
  readonly laneWord: string | null;
  /** The trip's name; null is unattached. */
  readonly trip: string | null;
  /** The book word through the one scheme, or 'no book letter'; null when no account is named. */
  readonly book: string | null;
  /** The linked budget line's COA code, or the typed row's coa_code; null when none is named. */
  readonly account: string | null;
  /** `<provider> · <name as stated>` — the name through the one lane reader (lane.ts reservationIdentity); a typed row's vendor as typed. */
  readonly vendor: string;
  readonly confirmation: string | null;
  readonly dates: string | null;
  readonly stated: StatedFigure | null;
  /**
   * The bank rows that settled it, in the order read: a booking's accepted charge link (none or one), a money event's
   * settled row (none or one), a typed row's linked postings that pay (null: a posting that names no bank row).
   */
  readonly settled: readonly (LedgerBankIn | null)[];
  /** The days it was posted in the books: a booking's charge entry (none or one), a typed row's paying postings; none read for a money event. */
  readonly posted: readonly string[];
  /** A booking's (or a typed row's) current receipts on its posting(s); a money event: null. */
  readonly receipts: number | null;
  readonly status: string;
  /** TRAVEL-02b: a voided typed row — struck through, out of both sum lines, counted. */
  readonly voided: boolean;
  /** TRAVEL-02b: the postings linked to it that were reversed — they pay nothing (LINK-LAW-01); counted under the table. */
  readonly reversedLinks: number;
  /** A booking's doors (RECEIPT-01, CAL-02, TRIPS-01); null on a money event's row and a typed row. */
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
      source: 'reservation' as const,
      bookingId: b.id,
      laneWord: LANE_WORD[identity.type],
      trip: b.trip === null ? null : b.trip.name,
      book: b.budgetLine === null ? null : bookOfCoaCode(b.budgetLine.coaCode),
      account: b.budgetLine === null ? null : b.budgetLine.coaCode,
      vendor: `${b.provider}${JOIN_WORDS}${identity.name}`,
      confirmation: confirmationOf(b.confirmation),
      dates: datesOf(b),
      voided: false,
      reversedLinks: 0,
    };
    rows.push({
      ...shared,
      rowKey: `booking:${b.id}`,
      kind: 'booking',
      id: b.id,
      instant: b.createdAt,
      day: dayInZone(b.createdAt, zone),
      stated: b.finalPriceCents === null ? null : { cents: b.finalPriceCents, currency: b.currency },
      settled: b.charge.bank === null ? [] : [b.charge.bank],
      posted: b.charge.postedDay === null ? [] : [b.charge.postedDay],
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
        settled: e.settledBank === null ? [] : [e.settledBank],
        posted: [],
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

/** TRAVEL-02b (ruling D): one typed travel expense as its row — its own facts and its linked postings; nothing filled in. */
export function typedExpenseRowOf(e: TravelExpenseIn): TravelLedgerRow {
  if (!isTravelExpenseKind(e.kind)) throw new TravelLedgerError(`travel expense ${e.id}: kind ${JSON.stringify(e.kind)} is not one of visa | esim | other — the table admits nothing else`);
  if (!isIsoDay(e.paid_on)) throw new TravelLedgerError(`travel expense ${e.id}: paid_on ${JSON.stringify(e.paid_on)} is not a day`);
  if ((e.voided_at === null) !== (e.void_reason === null)) throw new TravelLedgerError(`travel expense ${e.id} carries half a void — voided_at and void_reason go together`);
  const paying = e.postings.filter((p) => !p.reversed);
  let receipts = 0;
  for (const p of paying) receipts += p.receipts;
  return {
    rowKey: `typed:${e.id}`,
    source: 'typed',
    kind: e.kind,
    bookingId: null,
    id: e.id,
    instant: null,
    day: e.paid_on,
    laneWord: null,
    trip: e.trip === null ? null : e.trip.name,
    book: e.coa_code === null ? null : bookOfCoaCode(e.coa_code),
    account: e.coa_code,
    vendor: e.vendor,
    confirmation: null,
    dates: null,
    stated: { cents: e.amount_minor, currency: e.currency },
    settled: paying.map((p) => p.bank),
    posted: paying.map((p) => p.posted_on),
    receipts,
    status: e.void_reason === null ? MONEY_EVENT_STATUS_WORDS.stated : voidedStatusWords(e.void_reason),
    voided: e.voided_at !== null,
    reversedLinks: e.postings.length - paying.length,
    receiptHref: null,
    icsHref: null,
    tripHref: null,
  };
}

/** A typed row's DATE as an instant for the order: its day's UTC midnight — the day itself, no zone moving it. */
const dayStartInstant = (day: string): string => `${day}T00:00:00.000Z`;

/**
 * TRAVEL-02b: the TRAVEL LEDGER's rows in the table's own order — the bookings (each with its money events, as
 * travelLedgerRows builds them) and the typed rows, newest first: a booking by its instant, a typed row by its day's
 * UTC midnight; on a tie the booking first, and each source keeps the order its route gave.
 */
export function ledgerRowsOf(bookings: readonly LedgerBookingIn[], expenses: readonly TravelExpenseIn[], zone: string): TravelLedgerRow[] {
  const groups: { readonly at: string; readonly rows: readonly TravelLedgerRow[] }[] = [];
  for (const b of bookings) groups.push({ at: b.createdAt, rows: travelLedgerRows([b], zone) });
  for (const e of expenses) groups.push({ at: new Date(dayStartInstant(e.paid_on)).toISOString(), rows: [typedExpenseRowOf(e)] });
  const ordered = [...groups].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return tb - ta;
  });
  return ordered.flatMap((g) => g.rows);
}

// ── THE CELLS ───────────────────────────────────────────────────────────────

/** A stated figure's words: the one formatter in the functional currency, the figure with its code otherwise, the code's absence named. */
export function statedFigureWords(stated: StatedFigure): string {
  return stated.currency === null ? `${decimalStringOfCents(stated.cents)} (${CURRENCY_NOT_STATED_WORDS})` : statedMoneyWords(stated.cents, stated.currency);
}
/** The STATED cell: the figure, or the kind's own absence — a booking's 'price not stated', a money event's 'amount not stated'. */
export const statedCellWords = (row: TravelLedgerRow): string =>
  (row.stated === null ? (row.kind === 'booking' ? PRICE_NOT_STATED_WORDS : AMOUNT_NOT_STATED_WORDS) : statedFigureWords(row.stated));
/** One SETTLED part: the bank figure in the account's currency with its day — or, for a typed row's posting with no bank row, said so. */
const settledPartWords = (bank: LedgerBankIn | null): string =>
  (bank === null ? NO_BANK_ROW_WORDS : `${bankMoneyWords(bank.amount, bank.currency)}${JOIN_WORDS}${bank.date}`);
/** The SETTLED cell: each bank figure in its account's currency with its day (' + ' between several), or 'not matched'. */
export const settledCellWords = (row: TravelLedgerRow): string =>
  (row.settled.length === 0 ? BOOKING_WORDS.notMatched : row.settled.map(settledPartWords).join(PARTS_JOIN_WORDS));
/** The POSTED cell: a booking's or a typed row's posted day(s), or 'not posted'; a money event's '—'. */
export const postedCellWords = (row: TravelLedgerRow): string =>
  (isMoneyEventKind(row.kind) ? BLANK : row.posted.length === 0 ? BOOKING_WORDS.notPosted : row.posted.join(PARTS_JOIN_WORDS));
/** The DOCUMENT cell: 'the booking' or 'typed', '+ n receipts' when current receipts sit on its posting(s); a money event's '—'. */
export function documentCellWords(row: TravelLedgerRow): string {
  if (row.receipts === null) return BLANK;
  const document = row.source === 'typed' ? TYPED_WORDS : THE_BOOKING_WORDS;
  return row.receipts === 0 ? document : `${document} + ${receiptsWords(row.receipts)}`;
}

/** The CSV's figure: the minor units with the point placed, then the code (or the code's absence named) — no symbol, no grouping, no conversion. */
const figureWithCodeCsv = (cents: bigint | number, code: string | null): string =>
  `${decimalStringOfCents(cents)} ${code === null ? `(${CURRENCY_NOT_STATED_WORDS})` : code.toUpperCase()}`;
/** A bank row's CSV figure: whole cents as the figure with the account's code; a row that is not whole cents as bankMoneyWords names it. */
const bankCsv = (bank: LedgerBankIn): string => {
  const code = bank.currency !== null && bank.currency.trim() !== '' ? bank.currency : null;
  return isWholeCents(bank.amount) ? figureWithCodeCsv(centsOfTypedDollars(String(bank.amount)), code) : bankMoneyWords(bank.amount, bank.currency);
};
const settledPartCsv = (bank: LedgerBankIn | null): string => (bank === null ? NO_BANK_ROW_WORDS : `${bankCsv(bank)}${JOIN_WORDS}${bank.date}`);

// ── THE SORT (TRAVEL-02b item 0) ─────────────────────────────────────────────

const MAGNITUDE_OFFSET = BigInt(1000000000000000);
const SORT_DIGITS = 16;

/**
 * TRAVEL-02b item 0 (Alex, 2026-11-03; 02a's call 5 was NO) — a figure's sort text: its code, a space, then its minor
 * units offset by 10^15 and written as sixteen digits. The idiom compares it as it compares every text (sort.ts
 * compareSortKeys — localeCompare 'en', numeric), so the order is the code A→Z, then the magnitude within the code, a
 * refund (negative) below a fee — and no figure is ever ranked against another code's. Descending is the idiom's reverse
 * of that order. A figure beyond ±10^15 minor units cannot be placed — thrown by name, never clamped.
 */
export function codedSortText(code: string, minor: bigint | number): string {
  if (typeof minor === 'number' && !Number.isSafeInteger(minor)) throw new TravelLedgerError(`a figure of ${minor} minor units is not a whole number — it cannot be placed in the sort`);
  const units = typeof minor === 'bigint' ? minor : BigInt(minor);
  const placed = MAGNITUDE_OFFSET + units;
  const beyond = (): TravelLedgerError => new TravelLedgerError(`a figure of ${units.toString()} minor units is beyond ±10^15 — it cannot be placed in the sort`);
  if (placed < BigInt(0)) throw beyond();
  if (placed >= MAGNITUDE_OFFSET + MAGNITUDE_OFFSET) throw beyond();
  return `${code.toUpperCase()} ${placed.toString().padStart(SORT_DIGITS, '0')}`;
}

/** STATED's key: the figure's code then its minor units; a blank — or a figure whose currency is not stated, which no code's order can place — null. */
function statedSortKey(row: TravelLedgerRow): SortKey {
  if (row.stated === null) return null;
  if (row.stated.currency === null) return null;
  return textKey(codedSortText(row.stated.currency, row.stated.cents));
}

/**
 * SETTLED's key: the bank figures' account code then their cents summed — all of one code and all whole cents; else
 * null (with the blanks): no match, a part with no bank row, a part not in whole cents, an account that states no
 * currency, or parts in several codes — none can be placed in one code's order.
 */
function settledSortKey(row: TravelLedgerRow): SortKey {
  if (row.settled.length === 0) return null;
  let code: string | null = null;
  let cents = BigInt(0);
  for (const part of row.settled) {
    if (part === null) return null;
    if (!isWholeCents(part.amount)) return null;
    if (part.currency === null) return null;
    const partCode = part.currency.trim().toUpperCase();
    if (partCode === '') return null;
    if (code !== null && code !== partCode) return null;
    code = partCode;
    cents += centsOfTypedDollars(String(part.amount));
  }
  return code === null ? null : textKey(codedSortText(code, cents));
}

/** POSTED's key: the day(s) as written; a money event's, or one not posted, null. */
function postedSortKey(row: TravelLedgerRow): SortKey {
  if (isMoneyEventKind(row.kind)) return null;
  if (row.posted.length === 0) return null;
  return textKey(row.posted.join(PARTS_JOIN_WORDS));
}

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
    case 'lane': return row.laneWord === null ? BLANK : row.laneWord;
    case 'trip': return row.trip === null ? UNATTACHED_WORDS : row.trip;
    case 'book': return row.book === null ? BLANK : row.book;
    case 'account': return row.account !== null ? row.account : row.source === 'typed' ? NO_ACCOUNT_WORDS : BOOKING_WORDS.noBudgetLine;
    case 'vendor': return row.vendor;
    case 'confirmation': return row.confirmation !== null ? row.confirmation : row.source === 'typed' ? BLANK : BOOKING_WORDS.notYetStated;
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
 * What a column sorts by: DATE its instant (the true order — two instants on one day keep their order; a typed row's
 * day as its UTC midnight), STATED and SETTLED by code then magnitude (item 0 — no figure converted, none ranked across
 * codes), the words as text; a blank cell null — last in both directions.
 */
export function sortKeyOf(row: TravelLedgerRow, column: TravelLedgerColumn): SortKey {
  switch (column) {
    case 'date': return textKey(row.instant === null ? dayStartInstant(row.day) : row.instant);
    case 'stated': return statedSortKey(row);
    case 'settled': return settledSortKey(row);
    case 'book': return textKey(row.book);
    case 'account': return textKey(row.account);
    case 'trip': return textKey(row.trip);
    case 'confirmation': return textKey(row.confirmation);
    case 'dates': return textKey(row.dates);
    case 'posted': return postedSortKey(row);
    case 'document': return textKey(row.receipts === null ? null : documentCellWords(row));
    default: return textKey(cellWordsOf(row, column));
  }
}

/**
 * The CSV's field for each column — the fact bare, '' for a blank (never 0 or "—"): DATE the instant (ruling C) — a
 * typed row's day (the DAY rule), the figures as `<minor units with the point placed> <CODE>` (no symbol — '189.50 USD',
 * '12345.00 PHP', '-300.00 USD'), SETTLED with its day after the join (' + ' between a typed row's parts), the text
 * cells as the table prints them.
 */
export const TRAVEL_LEDGER_CSV: Readonly<Record<TravelLedgerColumn, (row: TravelLedgerRow) => string>> = {
  date: (row) => (row.instant === null ? row.day : row.instant),
  kind: (row) => KIND_WORDS[row.kind],
  lane: (row) => (row.laneWord === null ? '' : row.laneWord),
  trip: (row) => (row.trip === null ? UNATTACHED_WORDS : row.trip),
  book: (row) => (row.book === null ? '' : row.book),
  account: (row) => (row.account === null ? '' : row.account),
  vendor: (row) => row.vendor,
  confirmation: (row) => (row.confirmation === null ? '' : row.confirmation),
  dates: (row) => (row.dates === null ? '' : row.dates),
  stated: (row) => (row.stated === null ? '' : figureWithCodeCsv(row.stated.cents, row.stated.currency)),
  settled: (row) => row.settled.map(settledPartCsv).join(PARTS_JOIN_WORDS),
  posted: (row) => (isMoneyEventKind(row.kind) ? '' : row.posted.join(PARTS_JOIN_WORDS)),
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
  /** TRAVEL-02b: the voided typed rows — out of the sum, counted. */
  readonly voided: number;
}

export function statedSums(rows: readonly TravelLedgerRow[]): StatedSums {
  const byCode = new Map<string, number>();
  let priceNotStated = 0;
  let amountNotStated = 0;
  let currencyNotStated = 0;
  let voided = 0;
  for (const row of rows) {
    if (row.voided) {
      voided += 1;
      continue;
    }
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
  return { byCode, priceNotStated, amountNotStated, currencyNotStated, voided };
}

export interface SettledSums {
  /** The bank cents summed by the ACCOUNT's code; the key '' is the accounts that state no currency. */
  readonly byCode: ReadonlyMap<string, bigint>;
  readonly notMatched: number;
  readonly notWholeCents: number;
  /** TRAVEL-02b: a typed row's linked postings that name no bank row — counted, never summed. */
  readonly noBankRow: number;
  /** TRAVEL-02b: linked postings that were reversed — they pay nothing (LINK-LAW-01), counted. */
  readonly reversed: number;
  /** TRAVEL-02b: the voided typed rows — out of the sum, counted. */
  readonly voided: number;
}

export function settledSums(rows: readonly TravelLedgerRow[]): SettledSums {
  const byCode = new Map<string, bigint>();
  let notMatched = 0;
  let notWholeCents = 0;
  let noBankRow = 0;
  let reversed = 0;
  let voided = 0;
  for (const row of rows) {
    if (row.voided) {
      voided += 1;
      continue;
    }
    reversed += row.reversedLinks;
    if (row.settled.length === 0) {
      notMatched += 1;
      continue;
    }
    for (const part of row.settled) {
      if (part === null) {
        noBankRow += 1;
        continue;
      }
      if (!isWholeCents(part.amount)) {
        notWholeCents += 1;
        continue;
      }
      const code = part.currency !== null && part.currency.trim() !== '' ? part.currency.trim().toUpperCase() : '';
      byCode.set(code, (byCode.has(code) ? byCode.get(code)! : BigInt(0)) + centsOfTypedDollars(String(part.amount)));
    }
  }
  return { byCode, notMatched, notWholeCents, noBankRow, reversed, voided };
}

const codesInOrder = (codes: Iterable<string>): string[] => [...codes].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));

/** "STATED: 12345.00 PHP · $189.50 · 1 price not stated · 1 voided" — per currency, never one figure across them; '—' with no row. */
export function statedSumLineWords(rows: readonly TravelLedgerRow[]): string {
  const sums = statedSums(rows);
  const parts = codesInOrder(sums.byCode.keys()).map((code) => statedMoneyWords(sums.byCode.get(code)!, code));
  if (sums.priceNotStated > 0) parts.push(priceNotStatedCountWords(sums.priceNotStated));
  if (sums.amountNotStated > 0) parts.push(amountNotStatedCountWords(sums.amountNotStated));
  if (sums.currencyNotStated > 0) parts.push(currencyNotStatedCountWords(sums.currencyNotStated));
  if (sums.voided > 0) parts.push(voidedCountWords(sums.voided));
  return `${STATED_SUM_LABEL}: ${parts.length === 0 ? BLANK : parts.join(JOIN_WORDS)}`;
}

/** "SETTLED: $214.50 · 3 not matched · 1 voided" — per ACCOUNT currency through bankCentsWords; '—' with no row. */
export function settledSumLineWords(rows: readonly TravelLedgerRow[]): string {
  const sums = settledSums(rows);
  const parts = codesInOrder(sums.byCode.keys()).map((code) => bankCentsWords(sums.byCode.get(code)!, code === '' ? null : code));
  if (sums.notMatched > 0) parts.push(notMatchedCountWords(sums.notMatched));
  if (sums.noBankRow > 0) parts.push(noBankRowCountWords(sums.noBankRow));
  if (sums.notWholeCents > 0) parts.push(notWholeCentsCountWords(sums.notWholeCents));
  if (sums.reversed > 0) parts.push(reversedLinkedWords(sums.reversed));
  if (sums.voided > 0) parts.push(voidedCountWords(sums.voided));
  return `${SETTLED_SUM_LABEL}: ${parts.length === 0 ? BLANK : parts.join(JOIN_WORDS)}`;
}
