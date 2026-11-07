/**
 * homeLedger — THE HOME'S DAY TABLE, PURE (HOME-LEDGER-01, Alex, 2026-11-06, rulings A–I).
 *
 * Every account with activity on the day card's day, by book, from REAL rows only — one row per fact, each from its
 * source's existing read, each naming its source and the rule that placed it on the day:
 *   · BOOKS — ledger lines on revenue and expense accounts, read by the budget's one actuals query (reportReads.ts
 *     readActuals: the viewer's entities, journal date = the day, reversal pairs and year-end closing entries left out by
 *     name); the amount NET in the account's direction as the budget model nets it (report.ts figuresOf — the normal side
 *     adds, the other subtracts); the book from the account's entity through the one scheme (accountString.ts);
 *     ACTUAL in the functional currency (functionalMoneyWords). A line whose entry the one reversal rule catches
 *     (postingAmount.ts REVERSED_POSTING_WHERE — the route asks the books by it) leaves the rows and is counted.
 *   · TASK LEDGER — the records the task ledger places on the day by its own rule (the routine's zone — ledger.ts
 *     ledgerOf, read through GET /api/operations/ledger for the one day); TYPED ACTUAL the record's own USD cents;
 *     MATCH as the task ledger prints it (matchCellWords); BOOK and ACCOUNT the matched line's; a record no line matches
 *     is 'no account' (decision 12), counted.
 *   · TRAVEL LEDGER — the rows the travel ledger builds (travelLedger.ts ledgerRowsOf over /api/reservations' facts and
 *     the typed travel expenses) whose day, by its own DATE rule (an instant in the viewer's zone; a typed expense's
 *     paid_on as a DAY), is the day; STATED in its own currency; SETTLED as that ledger shows it, in MATCH; BOOK and
 *     ACCOUNT as that ledger shows them ('no budget line' / 'no account' kept).
 *   · BANK, NOT YET IN THE BOOKS — the caller's transactions not committed, dated the day (the report's own read,
 *     budget/report/route.ts), each in its ACCOUNT's currency through bankMoneyWords; no COA; never in ACTUAL; a row
 *     whose currency is not stated is counted by name, never summed as the functional currency.
 *   · TRADING — one line, 'trading — not connected' (until TRADE-LEDGER-01).
 *
 * NEVER: a CALCULATED figure (STAYS · CALCULATED, a baseline, a per-night share), a plan or budget figure, MATCH added to
 * ACTUAL, a stated or typed figure added to ACTUAL. Every sum is per currency; a currency is never added to another;
 * MATCH is never summed. The summary (ruling D) groups BOOK → ACCOUNT in the model's order — Business · Personal ·
 * Trading (report.ts BOOK_LABEL / LETTER_RANK, mirrored here), a book with no letter by its name, then 'no account',
 * then the bank group — each line with ACTUAL, TYPED ACTUAL per currency, STATED per currency and its row count, every
 * sum naming the rows it adds (rowKeys).
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock (the day and the zone are handed in), no React, no env. The route
 * (src/app/api/home-ledger/route.ts) reads; this file words. No `$` outside the currency home's formatters; no `||`,
 * no `?? <default>`; no 'USD' literal — FUNCTIONAL_CURRENCY is the one declaration.
 */
import { deriveAccountString, entityLetter } from '@/lib/accountString';
import {
  CURRENCY_NOT_STATED_WORDS, FUNCTIONAL_CURRENCY, bankMoneyWords, centsOfTypedDollars, decimalStringOfCents, functionalMoneyWords, isWholeCents,
  statedMoneyWords,
} from '@/lib/books/functionalCurrency';
import { isIsoDay } from '@/lib/budget/days';
import { BOOK_WORDS, NO_BOOK_GROUP_WORDS, matchCellTitle, matchCellWords, type LedgerRow } from '@/lib/operations/ledger';
import {
  amountNotStatedCountWords, cellWordsOf, codedSortText, currencyNotStatedCountWords, ledgerRowsOf, listOf, notWholeCentsCountWords,
  priceNotStatedCountWords, settledCellWords, statedCellWords, voidedCountWords, type LedgerBookingIn, type TravelExpenseIn, type TravelLedgerRow,
} from '@/lib/reservations/travelLedger';
import { columnOf, type SortKey, type TableColumn } from '@/lib/table/columns';
import { csvMoney, tableCsv } from '@/lib/table/csv';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';

export class HomeLedgerError extends Error {
  constructor(message: string) {
    super(`HOME LEDGER: ${message}`);
    this.name = 'HomeLedgerError';
  }
}

// ── THE WORDS (rulings C, D, E, F) ───────────────────────────────────────────

/** Ruling E: the section's heading, a constant. */
export const HOME_LEDGER_DAY_HEADING = 'HOME LEDGER · DAY';
export const HOME_LEDGER_KICKER_WORDS = 'Home ledger';
export const HOME_LEDGER_LINE_WORDS = 'Every account with activity on the day — REAL rows from the books, the task ledger, the travel ledger and the bank, each naming its source; every sum per currency; nothing calculated.';
/** Ruling F: the route — not under /api/home, the legacy category API. */
export const HOME_LEDGER_ROUTE = '/api/home-ledger';
export const HOME_LEDGER_CSV_FILE_NAME = 'home-ledger-day.csv';
export const HOME_LEDGER_LOADING_WORDS = 'reading the day…';
export const HOME_LEDGER_UNREADABLE_WORDS = 'the home ledger could not be read';
export const NO_ROWS_WORDS = 'nothing on this day — no books line, no record, no travel row, no bank row';
export const DAY_WORDS = 'day';
export const ZONE_WORDS = 'your zone';

export type HomeLedgerSourceKey = 'books' | 'task' | 'travel' | 'bank';
/** Ruling C: SOURCE, one of four. */
export const SOURCE_WORDS: Readonly<Record<HomeLedgerSourceKey, string>> = {
  books: 'books',
  task: 'task ledger',
  travel: 'travel ledger',
  bank: 'bank — not yet in the books',
};
/** The sources whose rows carry a STATED figure (ruling B): a travel row states its own currency, a bank row its account's. */
const STATING_SOURCES: readonly HomeLedgerSourceKey[] = ['travel', 'bank'];
export type DateRuleKey = 'journal' | 'routine' | 'viewer' | 'paidOn' | 'bank';
/** Ruling C: DATE says its rule — the day each source places a row on, never re-placed here (decision 11). */
export const DATE_RULE_WORDS: Readonly<Record<DateRuleKey, string>> = {
  journal: 'journal date',
  routine: "routine's day",
  viewer: 'your day',
  paidOn: 'paid on',
  bank: 'bank date',
};
/** Between a DATE cell's day and its rule, and between the parts of a sum line. */
export const JOIN_WORDS = ' · ';
export const TRADING_NOT_CONNECTED_WORDS = 'trading — not connected';
/** A books row's STATE: the fact is that it is in the books (the one actuals query reads posted lines only by its own exclusions). */
export const IN_THE_BOOKS_WORDS = 'in the books';
/** Ruling D: the bank group — the SOURCE word; and the sign rule the report states for a Plaid amount. */
export const BANK_GROUP_WORDS = SOURCE_WORDS.bank;
export const BANK_SIGN_WORDS = 'Plaid signs outflows positive';
/** Decision 12: a record no line matches, and a travel row no account names — one group after the books. */
export const NO_ACCOUNT_GROUP_WORDS = NO_BOOK_GROUP_WORDS;
export const noAccountCountWords = (n: number): string => `${n} ${n === 1 ? 'record' : 'records'} with no account — no plan line matched`;
export const reversedByStatusWords = (n: number): string =>
  `${n} books ${n === 1 ? 'line' : 'lines'} left out — ${n === 1 ? 'its entry is' : 'their entries are'} reversed by status (REVERSED_POSTING_WHERE)`;
export const rowsCountWords = (n: number): string => (n === 1 ? '1 row' : `${n} rows`);

// Ruling A: the 400s, by name.
export const DATE_REQUIRED_WORDS = "date is required — the day card's day, YYYY-MM-DD";
export const dateNotADayWords = (raw: string): string => `date ${JSON.stringify(raw)} is not a day (YYYY-MM-DD)`;
export const ZONE_REQUIRED_WORDS = "zone is required — the browser's IANA time zone";
export const zoneNotIanaWords = (raw: string): string => `zone ${JSON.stringify(raw)} is not an IANA time zone`;

/** Ruling A: an IANA zone is one Intl accepts — a blank is refused (Intl would take the system zone for '' in silence). */
export function isIanaZone(zone: string): boolean {
  if (zone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    // Intl refuses an unknown zone by throwing; the answer to "is this a zone" is no — the caller refuses it by name.
    return false;
  }
}

export type HomeLedgerQuery =
  | { readonly ok: true; readonly date: string; readonly zone: string }
  | { readonly ok: false; readonly field: 'date' | 'zone'; readonly message: string };

/** Ruling A: ?date= the day card's day and ?zone= the browser's zone — each required and valid, or the first bad one by name. */
export function homeLedgerQuery(date: string | null, zone: string | null): HomeLedgerQuery {
  if (!(date !== null && date !== '')) return { ok: false, field: 'date', message: DATE_REQUIRED_WORDS };
  if (!isIsoDay(date)) return { ok: false, field: 'date', message: dateNotADayWords(date) };
  if (!(zone !== null && zone !== '')) return { ok: false, field: 'zone', message: ZONE_REQUIRED_WORDS };
  if (!isIanaZone(zone)) return { ok: false, field: 'zone', message: zoneNotIanaWords(zone) };
  return { ok: true, date, zone };
}

// ── THE FACTS (what the route hands over) ────────────────────────────────────

/** One of the viewer's books: entities.id, name, entity_type — as /api/budget/report reads them. */
export interface HomeBook {
  readonly id: string;
  readonly name: string;
  readonly entityType: string;
}

/** A chart row of the viewer's books (reportReads.ts readBudgetChart): the name and the normal direction of each account. */
export interface HomeChartAccount {
  readonly entityId: string;
  readonly code: string;
  readonly name: string;
  readonly accountType: string;
  readonly balanceType: string;
}

/** A ledger line as readActuals reads it, mapped by the route: integer cents, the journal day as its UTC 'YYYY-MM-DD'. */
export interface HomeBooksLine {
  readonly id: string;
  readonly journalEntryId: string;
  readonly entityId: string;
  readonly code: string;
  readonly entryType: string;
  readonly cents: number;
  readonly day: string;
  readonly description: string;
}

/** A bank row not committed to the books (the report's read), with its ACCOUNT's stated currency. */
export interface HomeBankRow {
  readonly id: string;
  /** transactions.date as its UTC 'YYYY-MM-DD'. */
  readonly day: string;
  /** Plaid's amount, dollars, as stored. */
  readonly amount: number;
  /** accounts.isoCurrencyCode — null when the bank stated none. */
  readonly currency: string | null;
  readonly name: string | null;
  readonly merchantName: string | null;
  readonly reviewStatus: string;
}

export interface HomeLedgerInput {
  readonly date: string;
  readonly zone: string;
  readonly books: readonly HomeBook[];
  readonly chart: readonly HomeChartAccount[];
  readonly lines: readonly HomeBooksLine[];
  /** The ids of the day's entries the one reversal rule catches (REVERSED_POSTING_WHERE) — their lines leave the rows, counted. */
  readonly reversedEntryIds: readonly string[];
  /** The task ledger's rows for the day, as GET /api/operations/ledger answered them (ledger.ts ledgerOf). */
  readonly taskRows: readonly LedgerRow[];
  /** The travel ledger's facts — /api/reservations' `ledger` and /api/travel-expenses' `expenses`. */
  readonly bookings: readonly LedgerBookingIn[];
  readonly expenses: readonly TravelExpenseIn[];
  readonly bank: readonly HomeBankRow[];
}

// ── THE ROW (ruling C) ────────────────────────────────────────────────────────

export interface StatedFigureIn {
  readonly cents: number;
  readonly currency: string | null;
}

export interface HomeLedgerRow {
  /** `<source>:<id>` — the React key and the row's attribute. */
  readonly rowKey: string;
  readonly source: HomeLedgerSourceKey;
  /** The row's own day, by its source's rule. */
  readonly day: string;
  readonly dateRule: DateRuleKey;
  /** The instant behind the day when the source has one (a booking, a money event) — the CSV writes it as the travel ledger does. */
  readonly instant: string | null;
  /** The book word, or the travel ledger's own word for a code the scheme does not draw; null when no account names one. */
  readonly book: string | null;
  /** The account string ('P-6150'); null when none is named. */
  readonly account: string | null;
  /** The ACCOUNT cell: the account, or the source's own absence words ('no account', 'no budget line'); BLANK for a bank row. */
  readonly accountWords: string;
  readonly accountName: string | null;
  readonly description: string;
  readonly vendor: string | null;
  /** A stated figure in its own minor units and code (a travel row; a bank row in whole cents) — null when none. */
  readonly stated: StatedFigureIn | null;
  /** The STATED cell as its source prints it (statedCellWords, bankMoneyWords) — BLANK when the source states none. */
  readonly statedWords: string;
  /** A books line's signed cents in the functional currency — null for every other source. */
  readonly actualCents: number | null;
  /** A task record's typed USD cents — null for every other source, and for a record with none typed. */
  readonly typedActualCents: number | null;
  /** MATCH as the source prints it: the task ledger's matchCellWords, the travel ledger's SETTLED; BLANK otherwise. */
  readonly matchWords: string;
  readonly matchTitle: string | null;
  readonly state: string;
  readonly id: string;
  /** A voided typed travel row: kept, struck, out of every sum, counted. */
  readonly voided: boolean;
  /** A bank row whose amount is not whole cents: shown as stated, out of the sums, counted. */
  readonly notWholeCents: boolean;
}

// ── THE SUMS (ruling D) ──────────────────────────────────────────────────────

export interface CodeSum {
  readonly code: string;
  readonly cents: number;
  readonly count: number;
}

/** A per-currency sum and what could not be summed, each counted by name. */
export interface Sums {
  readonly byCode: readonly CodeSum[];
  readonly notStated: number;
  readonly currencyNotStated: number;
  readonly notWholeCents: number;
  readonly voided: number;
}

export interface HomeLedgerLine {
  readonly key: string;
  /** The ACCOUNT words the rows share. */
  readonly label: string;
  readonly accountName: string | null;
  readonly rowKeys: readonly string[];
  readonly rows: number;
  /** Σ of the books lines' signed cents, in the functional currency; null when the line holds none. */
  readonly actualCents: number | null;
  readonly typedActual: Sums;
  readonly stated: Sums;
}

export interface HomeLedgerGroup {
  readonly key: string;
  readonly label: string;
  readonly lines: readonly HomeLedgerLine[];
  readonly rowKeys: readonly string[];
  readonly rows: number;
  readonly actualCents: number | null;
  readonly typedActual: Sums;
  readonly stated: Sums;
}

export interface HomeLedgerSaid {
  /** Decision 12: task records no line matched. */
  readonly noAccount: number;
  /** Books lines left out because REVERSED_POSTING_WHERE caught their entry. */
  readonly reversedByStatus: number;
  readonly voided: number;
  readonly priceNotStated: number;
  readonly amountNotStated: number;
  readonly currencyNotStated: number;
  readonly notWholeCents: number;
  readonly trading: string;
}

export interface HomeLedgerAnswer {
  readonly date: string;
  readonly zone: string;
  readonly rows: readonly HomeLedgerRow[];
  readonly groups: readonly HomeLedgerGroup[];
  readonly said: HomeLedgerSaid;
}

// ── THE RULE ─────────────────────────────────────────────────────────────────

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** The first comparison that decides, in order — a sort over several keys without a `||` chain. */
const firstOf = (...keys: readonly number[]): number => {
  for (const k of keys) if (k !== 0) return k;
  return 0;
};

/** The model's order of the books — report.ts LETTER_RANK, mirrored: B · P · T, then a book with no letter by its name. */
const BOOK_RANK: Readonly<Record<string, number>> = { B: 0, P: 1, T: 2 };

/** The book's word: the one map ledger.ts draws from accountString's letters; a type with no letter is labelled by the book's own name (report.ts). */
export function bookLabelOf(book: HomeBook): string {
  const letter = entityLetter(book.entityType);
  if (letter === null) return book.name;
  const word = (BOOK_WORDS as Readonly<Record<string, string | undefined>>)[book.entityType];
  if (word === undefined) throw new HomeLedgerError(`entity type ${JSON.stringify(book.entityType)} draws the letter ${letter} and has no book word`);
  return word;
}

/** A books line's signed cents — the model's netting (report.ts figuresOf): the normal side adds, the other side subtracts. */
export function signedCentsOf(line: Pick<HomeBooksLine, 'entryType' | 'cents' | 'journalEntryId'>, balanceType: string): number {
  if (!(Number.isSafeInteger(line.cents) && line.cents >= 0)) throw new HomeLedgerError(`journal entry ${line.journalEntryId} carries a line of ${line.cents} cents — not a whole, non-negative number of cents`);
  if (line.entryType !== 'D' && line.entryType !== 'C') throw new HomeLedgerError(`journal entry ${line.journalEntryId} carries a line of entry type ${JSON.stringify(line.entryType)} — not D or C`);
  if (balanceType !== 'D' && balanceType !== 'C') throw new HomeLedgerError(`journal entry ${line.journalEntryId} posts to an account with balance type ${JSON.stringify(balanceType)} — not D or C`);
  return line.entryType === balanceType ? line.cents : -line.cents;
}

const chartKey = (entityId: string, code: string): string => `${entityId}\u0000${code}`;

/** A bank row's stated figure in whole cents and its account's code — null when the amount is not whole cents (bankMoneyWords names it). */
const bankStatedOf = (row: HomeBankRow): StatedFigureIn | null => {
  if (!(Number.isFinite(row.amount) && isWholeCents(row.amount))) return null;
  const code = row.currency !== null && row.currency.trim() !== '' ? row.currency.trim().toUpperCase() : null;
  return { cents: Number(centsOfTypedDollars(String(row.amount))), currency: code };
};

/** The rows of the day, in source order: the books, the task ledger, the travel ledger, the bank. */
export function homeLedgerRowsOf(input: HomeLedgerInput): { readonly rows: HomeLedgerRow[]; readonly reversedByStatus: number } {
  const { date, zone } = input;
  if (!isIsoDay(date)) throw new HomeLedgerError(`${JSON.stringify(date)} is not a day`);
  const bookById = new Map(input.books.map((b) => [b.id, b]));
  const chartByKey = new Map(input.chart.map((a) => [chartKey(a.entityId, a.code), a]));
  // The chart by its account string, for a travel row's account name ('P-9100' → the personal chart's 9100).
  const chartByAccount = new Map<string, HomeChartAccount>();
  for (const a of input.chart) {
    const book = bookById.get(a.entityId);
    if (book === undefined) throw new HomeLedgerError(`chart row ${JSON.stringify(a.code)} is on entity ${a.entityId}, which is not one of the viewer's books`);
    chartByAccount.set(deriveAccountString({ entityType: book.entityType, code: a.code }), a);
  }
  const reversed = new Set(input.reversedEntryIds);

  const rows: HomeLedgerRow[] = [];
  let reversedByStatus = 0;

  // BOOKS.
  const lines = [...input.lines].sort((a, b) => firstOf(cmp(a.entityId, b.entityId), cmp(a.code, b.code), cmp(a.journalEntryId, b.journalEntryId), cmp(a.id, b.id)));
  for (const line of lines) {
    if (reversed.has(line.journalEntryId)) {
      reversedByStatus += 1;
      continue;
    }
    if (line.day !== date) throw new HomeLedgerError(`journal entry ${line.journalEntryId} is dated ${line.day}, not the day ${date} the books were asked for`);
    const book = bookById.get(line.entityId);
    if (book === undefined) throw new HomeLedgerError(`journal entry ${line.journalEntryId} posts to entity ${line.entityId}, which is not one of the viewer's books`);
    const account = chartByKey.get(chartKey(line.entityId, line.code));
    if (account === undefined) throw new HomeLedgerError(`journal entry ${line.journalEntryId} posts to account ${JSON.stringify(line.code)} of ${book.name}, which its chart does not hold`);
    const accountString = deriveAccountString({ entityType: book.entityType, code: line.code });
    rows.push({
      rowKey: `books:${line.id}`,
      source: 'books',
      day: line.day,
      dateRule: 'journal',
      instant: null,
      book: bookLabelOf(book),
      account: accountString,
      accountWords: accountString,
      accountName: account.name,
      description: line.description,
      vendor: null,
      stated: null,
      statedWords: BLANK,
      actualCents: signedCentsOf(line, account.balanceType),
      typedActualCents: null,
      matchWords: BLANK,
      matchTitle: null,
      state: IN_THE_BOOKS_WORDS,
      id: line.id,
      voided: false,
      notWholeCents: false,
    });
  }

  // TASK LEDGER — the rows as the task ledger placed them; a row off the day is the route's error, named.
  for (const r of input.taskRows) {
    if (r.day !== date) throw new HomeLedgerError(`the task ledger handed a record on ${r.day}, not the day ${date} it was asked for`);
    rows.push({
      rowKey: `task:${r.id}`,
      source: 'task',
      day: r.day,
      dateRule: 'routine',
      instant: null,
      book: r.book,
      account: r.coa === null ? null : r.coa.account,
      accountWords: r.coa === null ? NO_ACCOUNT_GROUP_WORDS : r.coa.account,
      accountName: r.coa === null ? null : r.coa.name,
      description: r.note === null ? r.description : `${r.description}${JOIN_WORDS}${r.note}`,
      vendor: r.vendor,
      stated: null,
      statedWords: BLANK,
      actualCents: null,
      typedActualCents: r.actualCents,
      matchWords: matchCellWords(r.match),
      matchTitle: matchCellTitle(r.match),
      state: r.outcome,
      id: r.id,
      voided: false,
      notWholeCents: false,
    });
  }

  // TRAVEL LEDGER — the ledger's own rows, in its own order, those on the day by its own DATE rule.
  for (const t of ledgerRowsOf(input.bookings, input.expenses, zone)) {
    if (t.day !== date) continue;
    const named = t.account === null ? undefined : chartByAccount.get(t.account);
    rows.push({
      rowKey: `travel:${t.rowKey}`,
      source: 'travel',
      day: t.day,
      dateRule: t.source === 'typed' ? 'paidOn' : 'viewer',
      instant: t.instant,
      book: t.book,
      account: t.account,
      accountWords: cellWordsOf(t, 'account'),
      accountName: named === undefined ? null : named.name,
      description: `${cellWordsOf(t, 'kind')}${JOIN_WORDS}${cellWordsOf(t, 'trip')}`,
      vendor: t.vendor,
      stated: t.stated,
      statedWords: statedCellWords(t),
      actualCents: null,
      typedActualCents: null,
      matchWords: settledCellWords(t),
      matchTitle: null,
      state: t.status,
      id: t.id,
      voided: t.voided,
      notWholeCents: false,
    });
  }

  // BANK, NOT YET IN THE BOOKS.
  const bank = [...input.bank].sort((a, b) => firstOf(cmp(a.day, b.day), cmp(a.id, b.id)));
  for (const b of bank) {
    if (b.day !== date) throw new HomeLedgerError(`bank row ${b.id} is dated ${b.day}, not the day ${date} the bank was asked for`);
    const stated = bankStatedOf(b);
    rows.push({
      rowKey: `bank:${b.id}`,
      source: 'bank',
      day: b.day,
      dateRule: 'bank',
      instant: null,
      book: null,
      account: null,
      accountWords: BLANK,
      accountName: null,
      description: b.name !== null && b.name.trim() !== '' ? b.name : BLANK,
      vendor: b.merchantName !== null && b.merchantName.trim() !== '' ? b.merchantName : null,
      stated,
      statedWords: bankMoneyWords(b.amount, b.currency),
      actualCents: null,
      typedActualCents: null,
      matchWords: BLANK,
      matchTitle: null,
      state: b.reviewStatus,
      id: b.id,
      voided: false,
      notWholeCents: stated === null,
    });
  }

  return { rows, reversedByStatus };
}

/** Σ by code over the figures given — a figure with no code counted, never summed; a voided row counted, never summed. */
function sumsOf(items: readonly { readonly figure: StatedFigureIn | null; readonly voided: boolean; readonly notWholeCents: boolean; readonly states: boolean }[]): Sums {
  const byCode = new Map<string, { cents: number; count: number }>();
  let notStated = 0;
  let currencyNotStated = 0;
  let notWholeCents = 0;
  let voided = 0;
  for (const item of items) {
    if (!item.states) continue;
    if (item.voided) { voided += 1; continue; }
    if (item.notWholeCents) { notWholeCents += 1; continue; }
    if (item.figure === null) { notStated += 1; continue; }
    if (item.figure.currency === null) { currencyNotStated += 1; continue; }
    const code = item.figure.currency.toUpperCase();
    const at = byCode.get(code);
    const next = at === undefined ? { cents: item.figure.cents, count: 1 } : { cents: at.cents + item.figure.cents, count: at.count + 1 };
    if (!Number.isSafeInteger(next.cents)) throw new HomeLedgerError(`the ${code} sum left the safe integer range`);
    byCode.set(code, next);
  }
  return {
    byCode: [...byCode.entries()].map(([code, v]) => ({ code, cents: v.cents, count: v.count })).sort((a, b) => cmp(a.code, b.code)),
    notStated,
    currencyNotStated,
    notWholeCents,
    voided,
  };
}

/** Σ of the books lines' signed cents; null when none — never 0 for a blank. */
function actualSumOf(rows: readonly HomeLedgerRow[]): number | null {
  const cents = rows.map((r) => r.actualCents).filter((c): c is number => c !== null);
  if (cents.length === 0) return null;
  let total = 0;
  for (const c of cents) {
    total += c;
    if (!Number.isSafeInteger(total)) throw new HomeLedgerError('the ACTUAL sum left the safe integer range');
  }
  return total;
}

/** A row's TYPED ACTUAL as a figure in the functional currency (a task record's USD cents), for the per-currency sum. */
const typedFigureOf = (r: HomeLedgerRow): StatedFigureIn | null => (r.typedActualCents === null ? null : { cents: r.typedActualCents, currency: FUNCTIONAL_CURRENCY });

function sumsForRows(rows: readonly HomeLedgerRow[]): { actualCents: number | null; typedActual: Sums; stated: Sums } {
  return {
    actualCents: actualSumOf(rows),
    // TYPED ACTUAL: only a task record states one; a record with none typed is not "not stated" — it simply adds nothing.
    typedActual: sumsOf(rows.map((r) => ({ figure: typedFigureOf(r), voided: false, notWholeCents: false, states: r.typedActualCents !== null }))),
    // STATED: a travel row (its own code) and a bank row (its account's code); the books and the task ledger state nothing here.
    stated: sumsOf(rows.map((r) => ({ figure: r.stated, voided: r.voided, notWholeCents: r.notWholeCents, states: STATING_SOURCES.includes(r.source) }))),
  };
}

/** The group a row belongs to: its book word, 'no account' when none names one, the bank group for a bank row. */
const groupKeyOf = (r: HomeLedgerRow): string => (r.source === 'bank' ? BANK_GROUP_WORDS : r.book === null ? NO_ACCOUNT_GROUP_WORDS : r.book);

/** The order of the groups: the lettered books in the model's order, other book words by name, 'no account', the bank group. */
function groupRank(key: string): [number, string] {
  if (key === BANK_GROUP_WORDS) return [3, key];
  if (key === NO_ACCOUNT_GROUP_WORDS) return [2, key];
  const letter = Object.entries(BOOK_WORDS).find(([, word]) => word === key);
  if (letter !== undefined) {
    const drawn = entityLetter(letter[0]);
    if (drawn !== null && drawn in BOOK_RANK) return [0, String(BOOK_RANK[drawn])];
  }
  return [1, key];
}

/** Ruling D: the DAY × COA summary — BOOK → ACCOUNT, each sum naming its rows; MATCH never summed; a currency never added to another. */
export function homeLedgerGroupsOf(rows: readonly HomeLedgerRow[]): HomeLedgerGroup[] {
  const byGroup = new Map<string, HomeLedgerRow[]>();
  for (const r of rows) {
    const key = groupKeyOf(r);
    const list = byGroup.get(key);
    if (list === undefined) byGroup.set(key, [r]);
    else list.push(r);
  }
  const keys = [...byGroup.keys()].sort((a, b) => {
    const [ra, ta] = groupRank(a);
    const [rb, tb] = groupRank(b);
    return ra !== rb ? ra - rb : cmp(ta, tb);
  });
  return keys.map((key) => {
    const groupRows = byGroup.get(key) as HomeLedgerRow[];
    const byLine = new Map<string, HomeLedgerRow[]>();
    for (const r of groupRows) {
      const label = r.source === 'bank' ? BANK_GROUP_WORDS : r.accountWords;
      const list = byLine.get(label);
      if (list === undefined) byLine.set(label, [r]);
      else list.push(r);
    }
    const lines: HomeLedgerLine[] = [...byLine.keys()].sort(cmp).map((label) => {
      const lineRows = byLine.get(label) as HomeLedgerRow[];
      const named = lineRows.find((r) => r.accountName !== null);
      return {
        key: `${key}\u0000${label}`,
        label,
        accountName: named === undefined ? null : named.accountName,
        rowKeys: lineRows.map((r) => r.rowKey),
        rows: lineRows.length,
        ...sumsForRows(lineRows),
      };
    });
    return { key, label: key, lines, rowKeys: groupRows.map((r) => r.rowKey), rows: groupRows.length, ...sumsForRows(groupRows) };
  });
}

/** A travel row that is a booking (its STATED absence is 'price not stated'); a money event's or a typed row's is 'amount not stated'. */
const isBookingRow = (r: HomeLedgerRow): boolean => r.rowKey.startsWith('travel:booking:');

/** The whole answer: the rows, the summary, what is said under the table. */
export function homeLedgerOf(input: HomeLedgerInput): HomeLedgerAnswer {
  const { rows, reversedByStatus } = homeLedgerRowsOf(input);
  const groups = homeLedgerGroupsOf(rows);
  const all = sumsForRows(rows);
  const travelUnstated = rows.filter((r) => r.source === 'travel' && !r.voided && r.stated === null);
  return {
    date: input.date,
    zone: input.zone,
    rows,
    groups,
    said: {
      noAccount: rows.filter((r) => r.source === 'task' && r.account === null).length,
      reversedByStatus,
      voided: all.stated.voided,
      priceNotStated: travelUnstated.filter(isBookingRow).length,
      amountNotStated: travelUnstated.filter((r) => !isBookingRow(r)).length,
      currencyNotStated: all.stated.currencyNotStated,
      notWholeCents: all.stated.notWholeCents,
      trading: TRADING_NOT_CONNECTED_WORDS,
    },
  };
}

// ── THE SUM WORDS (ruling D) ─────────────────────────────────────────────────

export const notStatedCountWords = (n: number): string => `${n} not stated`;

/** A per-currency sum as words — one figure per code through the one stated formatter, the counts after; BLANK when nothing was summed and nothing counted. */
export function sumsWords(s: Sums): string {
  const parts = s.byCode.map((c) => statedMoneyWords(c.cents, c.code));
  if (s.notStated > 0) parts.push(notStatedCountWords(s.notStated));
  if (s.currencyNotStated > 0) parts.push(currencyNotStatedCountWords(s.currencyNotStated));
  if (s.notWholeCents > 0) parts.push(notWholeCentsCountWords(s.notWholeCents));
  if (s.voided > 0) parts.push(voidedCountWords(s.voided));
  return parts.length === 0 ? BLANK : parts.join(JOIN_WORDS);
}

/** An ACTUAL sum as words — the one functional formatter; BLANK when the line holds no books line. */
export const actualSumWords = (cents: number | null): string => (cents === null ? BLANK : functionalMoneyWords(cents));

/** What is said under the table, one line each, in order — only the lines with something to say. */
export function saidLines(said: HomeLedgerSaid): string[] {
  const lines: string[] = [];
  if (said.noAccount > 0) lines.push(noAccountCountWords(said.noAccount));
  if (said.reversedByStatus > 0) lines.push(reversedByStatusWords(said.reversedByStatus));
  if (said.voided > 0) lines.push(voidedCountWords(said.voided));
  if (said.priceNotStated > 0) lines.push(priceNotStatedCountWords(said.priceNotStated));
  if (said.amountNotStated > 0) lines.push(amountNotStatedCountWords(said.amountNotStated));
  if (said.currencyNotStated > 0) lines.push(currencyNotStatedCountWords(said.currencyNotStated));
  if (said.notWholeCents > 0) lines.push(notWholeCentsCountWords(said.notWholeCents));
  lines.push(said.trading);
  return lines;
}

export const SUMMARY_HEAD_WORDS = ['BOOK · ACCOUNT', 'ACCOUNT NAME', 'ROWS', 'ACTUAL', 'TYPED ACTUAL', 'STATED'] as const;

// ── THE TABLE (ruling C; the one idiom, src/lib/table) ───────────────────────

export const HOME_LEDGER_COLUMNS = ['date', 'source', 'book', 'account', 'accountName', 'description', 'vendor', 'stated', 'actual', 'typedActual', 'match', 'state', 'id'] as const;
export type HomeLedgerColumn = (typeof HOME_LEDGER_COLUMNS)[number];
export const HOME_LEDGER_HEAD_WORDS: Readonly<Record<HomeLedgerColumn, string>> = {
  date: 'DATE',
  source: 'SOURCE',
  book: 'BOOK',
  account: 'ACCOUNT',
  accountName: 'ACCOUNT NAME',
  description: 'DESCRIPTION',
  vendor: 'VENDOR',
  stated: 'STATED',
  actual: 'ACTUAL',
  typedActual: 'TYPED ACTUAL',
  match: 'MATCH',
  state: 'STATE',
  id: 'ID',
};

/** The DATE cell: the day, then the rule that placed the row on it. */
export const dateCellWords = (row: Pick<HomeLedgerRow, 'day' | 'dateRule'>): string => `${row.day}${JOIN_WORDS}${DATE_RULE_WORDS[row.dateRule]}`;

export function homeLedgerCellWords(row: HomeLedgerRow, column: HomeLedgerColumn): string {
  switch (column) {
    case 'date': return dateCellWords(row);
    case 'source': return SOURCE_WORDS[row.source];
    case 'book': return row.book === null ? BLANK : row.book;
    case 'account': return row.accountWords;
    case 'accountName': return row.accountName === null ? BLANK : row.accountName;
    case 'description': return row.description;
    case 'vendor': return row.vendor === null ? BLANK : row.vendor;
    case 'stated': return row.statedWords;
    case 'actual': return row.actualCents === null ? BLANK : functionalMoneyWords(row.actualCents);
    case 'typedActual': return row.typedActualCents === null ? BLANK : functionalMoneyWords(row.typedActualCents);
    case 'match': return row.matchWords;
    case 'state': return row.state;
    case 'id': return row.id;
  }
}

/** STATED's key: the code then the minor units (the travel ledger's codedSortText) — a blank, or a figure whose code is not stated, null. */
function statedSortKey(row: HomeLedgerRow): SortKey {
  if (row.stated === null) return null;
  if (row.stated.currency === null) return null;
  return textKey(codedSortText(row.stated.currency, row.stated.cents));
}

export function homeLedgerSortKey(row: HomeLedgerRow, column: HomeLedgerColumn): SortKey {
  switch (column) {
    case 'date': return textKey(row.instant === null ? `${row.day}T00:00:00.000Z` : row.instant);
    case 'stated': return statedSortKey(row);
    case 'actual': return numberKey(row.actualCents);
    case 'typedActual': return numberKey(row.typedActualCents);
    case 'book': return textKey(row.book);
    case 'account': return textKey(row.account);
    case 'accountName': return textKey(row.accountName);
    case 'vendor': return textKey(row.vendor);
    default: return textKey(homeLedgerCellWords(row, column));
  }
}

/** The CSV's figure: the minor units with the point placed, then the code — as the travel ledger writes one; the code's absence named. */
const figureWithCodeCsv = (figure: StatedFigureIn): string =>
  `${decimalStringOfCents(figure.cents)} ${figure.currency === null ? `(${CURRENCY_NOT_STATED_WORDS})` : figure.currency.toUpperCase()}`;

/** The CSV's fields — the fact bare, '' for a blank: DATE the instant when the source has one (the travel ledger's rule), else the day. */
export const HOME_LEDGER_CSV: Readonly<Record<HomeLedgerColumn, (row: HomeLedgerRow) => string>> = {
  date: (row) => (row.instant === null ? row.day : row.instant),
  source: (row) => SOURCE_WORDS[row.source],
  book: (row) => (row.book === null ? '' : row.book),
  account: (row) => (row.account === null ? '' : row.account),
  accountName: (row) => (row.accountName === null ? '' : row.accountName),
  description: (row) => row.description,
  vendor: (row) => (row.vendor === null ? '' : row.vendor),
  stated: (row) => (row.stated === null ? (row.notWholeCents ? row.statedWords : '') : figureWithCodeCsv(row.stated)),
  actual: (row) => csvMoney(row.actualCents),
  typedActual: (row) => csvMoney(row.typedActualCents),
  match: (row) => (row.matchWords === BLANK ? '' : row.matchWords),
  state: (row) => row.state,
  id: (row) => row.id,
};

/**
 * THE SPEC for the shared idiom: VALUE columns, two MONEY columns (ACTUAL and TYPED ACTUAL — functional-currency cents, so the
 * money popover's dollars are theirs), DESCRIPTION and ID as TEXT (a contains-text). STATED is a VALUE column, as the travel
 * ledger's is: a money popover would put the functional currency's sign beside a PHP figure and compare across currencies.
 */
export const HOME_LEDGER_TABLE: readonly TableColumn<HomeLedgerRow, HomeLedgerColumn>[] = HOME_LEDGER_COLUMNS.map((key): TableColumn<HomeLedgerRow, HomeLedgerColumn> => {
  const base = { key, label: HOME_LEDGER_HEAD_WORDS[key], words: (row: HomeLedgerRow) => homeLedgerCellWords(row, key), sortKey: (row: HomeLedgerRow) => homeLedgerSortKey(row, key), csv: HOME_LEDGER_CSV[key] };
  if (key === 'actual') return { ...base, kind: 'money', cents: (row) => row.actualCents };
  if (key === 'typedActual') return { ...base, kind: 'money', cents: (row) => row.typedActualCents };
  if (key === 'description') return { ...base, kind: 'text', text: (row) => row.description };
  if (key === 'id') return { ...base, kind: 'text', text: (row) => row.id };
  return { ...base, kind: 'value' };
});
export const homeLedgerColumnOf = (column: HomeLedgerColumn): TableColumn<HomeLedgerRow, HomeLedgerColumn> => columnOf(HOME_LEDGER_TABLE, column);

/** The rows shown, as a CSV — the idiom's writer over this spec. */
export const homeLedgerCsv = (rows: readonly HomeLedgerRow[]): string => tableCsv(HOME_LEDGER_TABLE, rows);

// ── THE READ (the screen's parse of the route's 200 — no silent empty) ───────

/** Ruling F: a 200 carries every list it promises, or the read fails by name (travelLedger.ts missingListWords — the one reader). */
export function homeLedgerReadOf(answer: unknown): { readonly rows: HomeLedgerRow[]; readonly groups: HomeLedgerGroup[]; readonly said: HomeLedgerSaid; readonly date: string; readonly zone: string } {
  const rows = listOf<HomeLedgerRow>(answer, HOME_LEDGER_ROUTE, 'rows');
  const groups = listOf<HomeLedgerGroup>(answer, HOME_LEDGER_ROUTE, 'groups');
  const record = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>) : {};
  const said = record.said;
  if (!(typeof said === 'object' && said !== null)) throw new HomeLedgerError(`${HOME_LEDGER_ROUTE} answered without its "said" block — nothing is shown as empty`);
  if (!(typeof record.date === 'string' && typeof record.zone === 'string')) throw new HomeLedgerError(`${HOME_LEDGER_ROUTE} answered without its day and zone`);
  return { rows, groups, said: said as HomeLedgerSaid, date: record.date, zone: record.zone };
}

/** The travel ledger's row type is this file's input through ledgerRowsOf; exported for the tests' fixtures. */
export type { TravelLedgerRow };
