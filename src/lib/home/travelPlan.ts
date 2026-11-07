/**
 * travelPlan — THE TRAVEL PLAN TABLE, PURE (HOME-LEDGER-02a, Alex, 2026-11-07, ruling B).
 *
 * The trip budget lines — budget_line_items with source 'trip' — of the caller, for the year the month table shows, ONE
 * ROW PER LINE, NEVER SUMMED. They sit in their own table under HOME LEDGER · MONTH on /home (home/HomeMonth.tsx mounts
 * home/TravelPlan.tsx under Budget's own report), because Budget's files may not read them (the budget report route
 * law, clause 2) and because a line states no currency (FX-00: budget_line_items has no currency column) — so not even
 * two lines of one month on one code are added. HOME-LEDGER-00's decision 3, read as ruled in HOME-LEDGER-01.
 *
 * THE COLUMNS, in Alex's order:
 *   MONTH          'YYYY-MM' as the line stores it — a line carries no day (said once, under the heading);
 *   SOURCE         'trip';
 *   BOOK           the code's letter through the one scheme (accountString.ts entityTypeOfLetter; ledger.ts bookWordOf
 *                  words the type — Personal · Business · Trading); no letter, or one no type draws → 'no book stated';
 *   ACCOUNT        the code as stored; an empty code → 'no code' — NEVER '9950' (the hub's nomad-budget route turns an
 *                  empty code into 9950; that retires in 02b and is never copied);
 *   ACCOUNT NAME   the caller's chart (reportReads.ts readBudgetChart), matched the way homeLedger.ts matches a travel
 *                  row's account string (chartByAccount: the chart row whose book letter and code spell the stored code);
 *                  no match → 'not in your chart';
 *   DESCRIPTION    as stored; null → '—';
 *   TRIP           trips.name through the relation; a line whose trip is gone (tripId null — SetNull) → 'trip gone';
 *   TRIP BUDGET    the Decimal dollars as cents with the point placed, then '(currency not stated)' — the stored text is
 *                  read by the books' typed-dollars rule (functionalCurrency.ts centsOfTypedDollars) and refused by name
 *                  when it is not whole cents; never a `$`;
 *   ID             the line's id.
 * NO TOTAL ANYWHERE: nothing in this file adds a figure to another.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock, no React, no env. The route (src/app/api/home-travel-plan/route.ts)
 * reads; this file words. No `$` outside the currency home's formatters; no `||`, no `?? <default>`; no 'USD' literal.
 */
import { deriveAccountString, entityTypeOfLetter } from '@/lib/accountString';
import { CURRENCY_NOT_STATED_WORDS, centsOfTypedDollars, decimalStringOfCents } from '@/lib/books/functionalCurrency';
import type { HomeBook, HomeChartAccount } from '@/lib/home/homeLedger';
import { bookWordOf } from '@/lib/operations/ledger';
import { listOf } from '@/lib/reservations/travelLedger';
import { columnOf, type SortKey, type TableColumn } from '@/lib/table/columns';
import { tableCsv } from '@/lib/table/csv';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';

export class TravelPlanError extends Error {
  constructor(message: string) {
    super(`TRAVEL PLAN: ${message}`);
    this.name = 'TravelPlanError';
  }
}

// ── THE WORDS (ruling B) ─────────────────────────────────────────────────────

export const TRAVEL_PLAN_HEADING = 'TRAVEL PLAN · trip budget lines (not in Budget)';
export const TRAVEL_PLAN_KICKER_WORDS = 'Travel plan';
export const TRAVEL_PLAN_ROUTE = '/api/home-travel-plan';
export const TRAVEL_PLAN_CSV_FILE_NAME = 'travel-plan.csv';
export const TRAVEL_PLAN_LOADING_WORDS = 'reading the trip budget lines…';
export const TRAVEL_PLAN_UNREADABLE_WORDS = 'the trip budget lines could not be read';
/** Said once under the heading: why there is no total — not even two lines of one month on one code are added. */
export const NO_TOTAL_WORDS = 'no total — a trip budget line states no currency (FX-00), so no figure here is added to another, not even two lines of one month on one code';
/** Said once under the heading: MONTH is the line's own, stored as a month — a line carries no day. */
export const MONTH_RULE_WORDS = 'MONTH as the line stores it — a trip budget line carries no day';
export const noLinesWords = (year: string): string => `no trip budget line in ${year}`;
export const TRIP_SOURCE_WORDS = 'trip';
export const NO_BOOK_STATED_WORDS = 'no book stated';
export const NO_CODE_WORDS = 'no code';
export const NOT_IN_CHART_WORDS = 'not in your chart';
export const TRIP_GONE_WORDS = 'trip gone';
export const YEAR_REQUIRED_WORDS = "year is required — the month table's year, YYYY";
export const yearNotAYearWords = (raw: string): string => `year ${JSON.stringify(raw)} is not a year (YYYY)`;

// ── THE QUERY (ruling B: a bad year → 400 by name) ───────────────────────────

/** Four digits and nothing else — written without a `$` anchor, so no `$` sits in this file outside the currency home's words. */
const isYear = (s: string): boolean => s.length === 4 && /^\d{4}/.test(s);

export type TravelPlanQuery =
  | { readonly ok: true; readonly year: string }
  | { readonly ok: false; readonly field: 'year'; readonly message: string };

export function travelPlanQuery(year: string | null): TravelPlanQuery {
  if (!(year !== null && year !== '')) return { ok: false, field: 'year', message: YEAR_REQUIRED_WORDS };
  if (!isYear(year)) return { ok: false, field: 'year', message: yearNotAYearWords(year) };
  if (Number(year) < 1) return { ok: false, field: 'year', message: yearNotAYearWords(year) };
  return { ok: true, year };
}

// ── THE INPUT AND THE ROWS ───────────────────────────────────────────────────

/** A budget_line_items row with source 'trip', as the route reads it: the amount is the Decimal's text, never a float. */
export interface TravelPlanLineIn {
  readonly id: string;
  /** coaCode as stored — 'P-9200', '9300', '' … */
  readonly coaCode: string;
  readonly year: number;
  readonly month: number;
  /** The Decimal(12,2) as text ('300', '120.5', '45.00'). */
  readonly amount: string;
  readonly description: string | null;
  readonly tripId: string | null;
  /** trips.name through the relation; null when the trip is gone. */
  readonly tripName: string | null;
}

export interface TravelPlanInput {
  readonly year: string;
  readonly lines: readonly TravelPlanLineIn[];
  readonly books: readonly HomeBook[];
  readonly chart: readonly HomeChartAccount[];
}

export interface TravelPlanRow {
  readonly id: string;
  /** 'YYYY-MM' as stored. */
  readonly month: string;
  readonly source: 'trip';
  readonly book: string;
  readonly account: string;
  readonly accountName: string;
  readonly description: string | null;
  readonly trip: string;
  /** The line's dollars as integer cents — shown, sorted, written; never added. */
  readonly tripBudgetCents: number;
  /** '300.00 (currency not stated)'. */
  readonly tripBudgetWords: string;
}

/** BOOK from the code's letter: 'P-9200' → P → personal → 'Personal'; no letter, or a letter no type draws → 'no book stated'. */
export function bookWordsOfCode(code: string): string {
  const m = /^([A-Z])-/.exec(code);
  if (m === null) return NO_BOOK_STATED_WORDS;
  const entityType = entityTypeOfLetter(m[1]);
  return entityType === null ? NO_BOOK_STATED_WORDS : bookWordOf(entityType);
}

/** TRIP BUDGET's figure: the stored text read by the books' typed-dollars rule — refused by name when it is not whole cents. */
export function tripBudgetCentsOf(line: Pick<TravelPlanLineIn, 'id' | 'amount'>): number {
  let cents: bigint;
  try {
    cents = centsOfTypedDollars(line.amount);
  } catch (error) {
    throw new TravelPlanError(`trip budget line ${line.id} states ${JSON.stringify(line.amount)}, which is not whole cents — ${error instanceof Error ? error.message : String(error)}`);
  }
  const n = Number(cents);
  if (!Number.isSafeInteger(n)) throw new TravelPlanError(`trip budget line ${line.id} states ${JSON.stringify(line.amount)}, past the safe integer range of cents`);
  return n;
}

export const tripBudgetWordsOf = (cents: number): string => `${decimalStringOfCents(cents)} (${CURRENCY_NOT_STATED_WORDS})`;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The rows, one per line, by month then id — nothing added. */
export function travelPlanRowsOf(input: TravelPlanInput): TravelPlanRow[] {
  const { year } = input;
  if (!isYear(year)) throw new TravelPlanError(`${JSON.stringify(year)} is not a year`);
  const bookById = new Map(input.books.map((b) => [b.id, b]));
  // The chart by its account string, the way the home ledger names a travel row's account ('P-9200' → the personal chart's 9200).
  const chartByAccount = new Map<string, HomeChartAccount>();
  for (const a of input.chart) {
    const book = bookById.get(a.entityId);
    if (book === undefined) throw new TravelPlanError(`chart row ${JSON.stringify(a.code)} is on entity ${a.entityId}, which is not one of the viewer's books`);
    chartByAccount.set(deriveAccountString({ entityType: book.entityType, code: a.code }), a);
  }
  const rows = input.lines.map((line): TravelPlanRow => {
    if (String(line.year) !== year) throw new TravelPlanError(`trip budget line ${line.id} is in ${line.year}, not the year ${year} asked for`);
    if (!(Number.isInteger(line.month) && line.month >= 1 && line.month <= 12)) throw new TravelPlanError(`trip budget line ${line.id} stores month ${JSON.stringify(line.month)}, not 1 to 12`);
    const code = line.coaCode.trim();
    const chart = chartByAccount.get(code);
    const cents = tripBudgetCentsOf(line);
    return {
      id: line.id,
      month: `${year}-${String(line.month).padStart(2, '0')}`,
      source: 'trip',
      book: bookWordsOfCode(code),
      account: code === '' ? NO_CODE_WORDS : code,
      accountName: chart === undefined ? NOT_IN_CHART_WORDS : chart.name,
      description: line.description === null ? null : line.description,
      trip: line.tripName === null ? TRIP_GONE_WORDS : line.tripName,
      tripBudgetCents: cents,
      tripBudgetWords: tripBudgetWordsOf(cents),
    };
  });
  return rows.sort((a, b) => (a.month !== b.month ? cmp(a.month, b.month) : cmp(a.id, b.id)));
}

export interface TravelPlanAnswer {
  readonly year: string;
  readonly rows: TravelPlanRow[];
}

export const travelPlanOf = (input: TravelPlanInput): TravelPlanAnswer => ({ year: input.year, rows: travelPlanRowsOf(input) });

// ── THE TABLE (the one idiom — src/lib/table) ────────────────────────────────

export const TRAVEL_PLAN_COLUMNS = ['month', 'source', 'book', 'account', 'accountName', 'description', 'trip', 'tripBudget', 'id'] as const;
export type TravelPlanColumn = (typeof TRAVEL_PLAN_COLUMNS)[number];

export const TRAVEL_PLAN_HEAD_WORDS: Readonly<Record<TravelPlanColumn, string>> = {
  month: 'MONTH',
  source: 'SOURCE',
  book: 'BOOK',
  account: 'ACCOUNT',
  accountName: 'ACCOUNT NAME',
  description: 'DESCRIPTION',
  trip: 'TRIP',
  tripBudget: 'TRIP BUDGET',
  id: 'ID',
};

export function travelPlanCellWords(row: TravelPlanRow, column: TravelPlanColumn): string {
  switch (column) {
    case 'month': return row.month;
    case 'source': return TRIP_SOURCE_WORDS;
    case 'book': return row.book;
    case 'account': return row.account;
    case 'accountName': return row.accountName;
    case 'description': return row.description === null ? BLANK : row.description;
    case 'trip': return row.trip;
    case 'tripBudget': return row.tripBudgetWords;
    case 'id': return row.id;
  }
}

export function travelPlanSortKey(row: TravelPlanRow, column: TravelPlanColumn): SortKey {
  switch (column) {
    case 'tripBudget': return numberKey(row.tripBudgetCents);
    case 'description': return textKey(row.description);
    default: return textKey(travelPlanCellWords(row, column));
  }
}

/** The CSV's fields — the fact bare, '' for a blank; TRIP BUDGET as the cell prints it (the figure and its missing code). */
export const TRAVEL_PLAN_CSV: Readonly<Record<TravelPlanColumn, (row: TravelPlanRow) => string>> = {
  month: (row) => row.month,
  source: () => TRIP_SOURCE_WORDS,
  book: (row) => row.book,
  account: (row) => row.account,
  accountName: (row) => row.accountName,
  description: (row) => (row.description === null ? '' : row.description),
  trip: (row) => row.trip,
  tripBudget: (row) => row.tripBudgetWords,
  id: (row) => row.id,
};

/**
 * THE SPEC: VALUE columns, DESCRIPTION and ID as TEXT (a contains-text). TRIP BUDGET is a VALUE column, as the home
 * ledger's STATED is: a money popover would put the functional currency's sign beside a figure whose currency nobody stated.
 */
export const TRAVEL_PLAN_TABLE: readonly TableColumn<TravelPlanRow, TravelPlanColumn>[] = TRAVEL_PLAN_COLUMNS.map((key): TableColumn<TravelPlanRow, TravelPlanColumn> => {
  const base = { key, label: TRAVEL_PLAN_HEAD_WORDS[key], words: (row: TravelPlanRow) => travelPlanCellWords(row, key), sortKey: (row: TravelPlanRow) => travelPlanSortKey(row, key), csv: TRAVEL_PLAN_CSV[key] };
  if (key === 'description') return { ...base, kind: 'text', text: (row) => row.description };
  if (key === 'id') return { ...base, kind: 'text', text: (row) => row.id };
  return { ...base, kind: 'value' };
});
export const travelPlanColumnOf = (column: TravelPlanColumn): TableColumn<TravelPlanRow, TravelPlanColumn> => columnOf(TRAVEL_PLAN_TABLE, column);

/** The rows shown, as a CSV — the idiom's writer over this spec. */
export const travelPlanCsv = (rows: readonly TravelPlanRow[]): string => tableCsv(TRAVEL_PLAN_TABLE, rows);

// ── THE READ (the screen's parse of the route's 200 — no silent empty) ───────

/** A 200 carries its "rows" list and its year, or the read fails by name (travelLedger.ts missingListWords — the one reader). */
export function travelPlanReadOf(answer: unknown): TravelPlanAnswer {
  const rows = listOf<TravelPlanRow>(answer, TRAVEL_PLAN_ROUTE, 'rows');
  const record = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>) : {};
  if (typeof record.year !== 'string') throw new TravelPlanError(`${TRAVEL_PLAN_ROUTE} answered without its year`);
  return { year: record.year, rows };
}
