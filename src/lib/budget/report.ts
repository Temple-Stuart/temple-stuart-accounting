/**
 * TAB13-01 — THE BUDGET REPORT, AS A PURE MODEL.
 *
 * /budget (Tab 13) is a read-only BUDGET vs ACTUAL report, ruled 2026-09-26:
 * rows BOOK · ACCOUNT, lines Budget / Actual / Variance, views DAY [MTD, the
 * day] · WEEK [WEEK, Mon … Sun] · YEAR [YTD, Jan … Dec], and an overview of
 * TOTAL INCOME · TOTAL EXPENSES · NET. This file is that report and nothing
 * else: every figure it prints arrives from the caller (TAB13-02 feeds it from
 * the database; TAB13-03 draws it). It imports no database client, no
 * framework, no network, no clock and no environment — a build law holds it to
 * that (scripts/assert-tool-registry.ts, the budget report purity law).
 *
 * WHAT TODAY'S BUDGET TABLE DOES, AND WHY THIS COPIES NONE OF IT. The Personal
 * budget route (src/app/api/hub/year-calendar/route.ts, main 7689c9c8) makes
 * four choices this model refuses:
 *   1. DEBITS ONLY — `SUM(CASE WHEN le.entry_type = 'D' …)` (:115). A refund
 *      credited to an expense account never lowers what was spent. Here the
 *      actual is NET in the account's normal direction: a 'D' account is
 *      debits − credits, a 'C' account credits − debits (R2).
 *   2. BY POSTING MONTH ONLY — `EXTRACT(MONTH FROM je.date)` (:114, :127). Here
 *      any column is a closed range of days, so a day, a week, a month and a
 *      year-to-date are all the same sum. Postings are still dated by
 *      journal_entries.date: moving a linked posting to its planned item's date
 *      is ruling 6, and it is not built.
 *   3. FLOAT DOLLARS — `Math.round(Number(row.debits) / 100 * 100) / 100`
 *      (:137). Here money is INTEGER CENTS end to end; nothing is divided,
 *      rounded or formatted — that is the screen's job (R1).
 *   4. UNKNOWN CODES SKIPPED — `if (!COA_NAMES[coa]) continue;` (:97). Here
 *      nothing is dropped: a budget line or posting that cannot be placed on an
 *      income or expense account is returned UNPLACED, with its reason and its
 *      ids, and is in no total (R9).
 *
 * BLANK IS NOT ZERO (src/lib/calendar/day.ts:6-10). A cell with no budget
 * lines has budget null; a cell with no postings has actual null; lines or
 * postings that sum to zero are 0. The variance is src/lib/calendar/links.ts
 * variance() (:81) — null unless both sides are known — and is never restated
 * here. Every total carries the coverage that earned it (day.ts CoveredTotal
 * :64-71), and actual on a row with no budget to date is reported as
 * unbudgetedActual, never folded into a variance.
 *
 * NET IS STRICT. A NET figure is income − expense (and NET variance is income
 * variance + expense variance) only when BOTH sides are known; with either side
 * null it is null — the same rule variance() holds, with no side imputed as 0.
 * Until income has a budget source (ruling 4), a column with no income budget
 * has no NET budget, and the screen can read why from the income section.
 *
 * A CONTRA P&L ACCOUNT IS REFUSED. A row's actual is netted in the account's
 * stored balance_type, but the row's section and its variance sign follow its
 * account_type. Where the two disagree — a revenue account stored as 'D', an
 * expense account stored as 'C' — the row would land in its section with the
 * wrong sign. No writer creates one (src/lib/coa/accounts.ts:122, :152, :180
 * take balance_type from FAMILY_RULES), so one is refused by name:
 * BudgetReportError('balance-disagrees-with-family'), naming the entity, the
 * code, the family and the balance type. Asset, liability and equity accounts
 * are not checked — they never become rows.
 *
 * BOOKS. Every entity is its own book, labelled from its code letter
 * (src/lib/coa/scheme.ts letterFor :81 over src/lib/accountString.ts
 * ENTITY_LETTER :25-29): P → PERSONAL, B → BUSINESS, T → TRADE. An entity type
 * with no letter is a book labelled with its own name and raw type — never
 * folded into another. Two entities are never merged, and the same code in two
 * entities is two rows (chart_of_accounts @@unique([userId, entity_id, code])).
 *
 * THE VIEW'S RANGE. DAY d covers [1st of d's month … d], WEEK [Monday …
 * Sunday], YEAR [Jan 1 … Dec 31]. A budget line or posting outside that range
 * is outside the view: it makes no row and is not unplaced. Every input is
 * still validated, wherever it falls.
 *
 * DATES are 'YYYY-MM-DD' strings compared as text (fixed width, so text order
 * is date order) and converted to day numbers by integer arithmetic for the
 * week. No Date object, no time zone and no clock enters this file.
 *
 * BUDGET-02 (2026-10-20) — Budget is one page, ruled by Alex:
 *   · ROWS (ruling C): every ACTIVE revenue and expense account of a book's chart
 *     is a row, with or without a figure; an ARCHIVED one only when it has a
 *     figure in the view. Asset, liability and equity accounts are never rows.
 *     So the chart hands in each account's archived flag (ChartAccount).
 *   · COLUMNS (ruling C): a YEAR is Jan … Dec, then YTD.
 *   · BOOKS (ruling B): Business · Personal · Trading (sole_prop B, personal P,
 *     trading T — by the stored entity type, never re-typed here), then any other
 *     book under its own name. Two books of one type are two books.
 *   · NO BUDGET (ruling D): a book with no plan line in the view says so
 *     (ReportBook.hasPlanLines) — its Budget rows print "no budget", never a 0.
 *   · THE DRILL (rulings E, G): buildBudgetCell() returns the lines and postings
 *     behind one row's figures over one range — the SAME selection every cell is
 *     the sum of (selectionOf), never a second rule — and shownBudget() is the one
 *     rule of which budget a cell prints (format.ts writes it, the drill lists it).
 */
import { variance } from '@/lib/calendar/links';
import { FAMILY_RULES, letterFor, isFamily, type EntityLetter } from '@/lib/coa/scheme';

// ── INPUT ───────────────────────────────────────────────────────────────────

/** A calendar day, 'YYYY-MM-DD'. */
export type IsoDay = string;

/** The planner a budget line came from. */
export type BudgetSource = 'routine' | 'task' | 'trip' | 'plan';
export const BUDGET_SOURCES: readonly BudgetSource[] = ['routine', 'task', 'trip', 'plan'];

export type BudgetView =
  | { readonly kind: 'day'; readonly day: IsoDay }
  | { readonly kind: 'week'; readonly weekOf: IsoDay }
  | { readonly kind: 'year'; readonly year: number };

export interface ReportEntity {
  readonly id: string;
  readonly name: string;
  /** entities.entity_type, raw. */
  readonly entityType: string;
}

export interface ReportAccount {
  readonly entityId: string;
  /** chart_of_accounts.code — the bare four digits. */
  readonly code: string;
  readonly name: string;
  /** chart_of_accounts.account_type — one of the five families, lower case. */
  readonly accountType: string;
  /** chart_of_accounts.balance_type — the account's normal direction. */
  readonly balanceType: 'D' | 'C';
}

/** BUDGET-02: a chart account as the report takes it — with chart_of_accounts.is_archived (ruling C: archived rows only with a figure). */
export interface ChartAccount extends ReportAccount {
  readonly archived: boolean;
}

export interface BudgetLine {
  readonly entityId: string;
  readonly code: string;
  readonly day: IsoDay;
  /** Integer cents. */
  readonly cents: number;
  readonly source: BudgetSource;
  readonly sourceId: string;
}

export interface Posting {
  readonly entityId: string;
  readonly code: string;
  /** journal_entries.date. */
  readonly day: IsoDay;
  readonly entryType: 'D' | 'C';
  /** Integer cents, never negative — the direction is entryType. */
  readonly cents: number;
  readonly journalEntryId: string;
}

export interface BudgetReportInput {
  /** The last day actuals cover. */
  readonly asOf: IsoDay;
  readonly view: BudgetView;
  readonly entities: readonly ReportEntity[];
  readonly accounts: readonly ChartAccount[];
  readonly budgetLines: readonly BudgetLine[];
  readonly postings: readonly Posting[];
}

// ── OUTPUT ──────────────────────────────────────────────────────────────────

export type ColumnKind = 'mtd' | 'day' | 'week' | 'ytd' | 'month';
export type ColumnState = 'closed' | 'inProgress' | 'future';

export interface ReportColumn {
  /** Unique within the view: 'mtd' · 'week' · 'ytd' · a day · 'YYYY-MM'. */
  readonly key: string;
  readonly kind: ColumnKind;
  /** 'MTD' · 'WEEK' · 'YTD' · 'Mon' … 'Sun' · 'Jan' … 'Dec'. */
  readonly label: string;
  readonly from: IsoDay;
  readonly to: IsoDay;
  /** closed: to ≤ asOf · inProgress: from ≤ asOf < to · future: from > asOf. */
  readonly state: ColumnState;
}

/** One row's figures in one column. Integer cents; null is blank, never 0. */
export interface ReportCell {
  /** Budget lines dated in [from, to]. */
  readonly budgetFull: number | null;
  /** Budget lines dated in [from, min(to, asOf)]. */
  readonly budgetToDate: number | null;
  /** Net postings in [from, min(to, asOf)] in the account's normal direction; null for a future column. */
  readonly actual: number | null;
  /** Revenue: actual − budgetToDate · expense: budgetToDate − actual. Positive is favorable. */
  readonly variance: number | null;
}

export type RowFamily = 'revenue' | 'expense';

export interface ReportRow {
  readonly entityId: string;
  readonly code: string;
  readonly name: string;
  readonly family: RowFamily;
  readonly balanceType: 'D' | 'C';
  /** One per column, in column order. */
  readonly cells: readonly ReportCell[];
}

export interface ReportBook {
  readonly entityId: string;
  readonly entityName: string;
  readonly entityType: string;
  readonly letter: EntityLetter | null;
  /** BUDGET-02 (ruling B): 'Business' · 'Personal' · 'Trading' · or the book's own name for a type with no letter. */
  readonly label: string;
  /**
   * Revenue before expense, code ascending. BUDGET-02 (ruling C): every active
   * revenue and expense account of the book's chart, with or without a figure,
   * and an archived one only when it has a figure in the view.
   */
  readonly rows: readonly ReportRow[];
  /** BUDGET-02 (ruling D): true when any budget line of this book is dated in the view's range, placed on a row or not. */
  readonly hasPlanLines: boolean;
  /**
   * TAB13-03: this book's own totals, one per column — built by the SAME function
   * as the report's (totalsOf), over this book's rows only. A book with no rows
   * has totals of zero coverage and nulls, never zeros.
   */
  readonly totals: readonly ColumnTotals[];
}

/** How many rows a total was built from (day.ts CoveredTotal's idea). */
export interface Coverage {
  readonly rows: number;
  readonly withBudget: number;
  readonly withBudgetToDate: number;
  readonly withActual: number;
  readonly withVariance: number;
}

export interface SectionTotal {
  readonly budgetFull: number | null;
  readonly budgetToDate: number | null;
  readonly actual: number | null;
  readonly variance: number | null;
  /** Σ actual on rows whose budgetToDate is null — shown, never folded into a variance. */
  readonly unbudgetedActual: number | null;
  readonly coverage: Coverage;
}

export interface ColumnTotals {
  readonly income: SectionTotal;
  readonly expense: SectionTotal;
  readonly net: SectionTotal;
}

export type UnplacedReason = 'not in chart' | 'not an income or expense account';

export type UnplacedItem =
  | { readonly kind: 'budgetLine'; readonly reason: UnplacedReason; readonly line: BudgetLine }
  | { readonly kind: 'posting'; readonly reason: UnplacedReason; readonly posting: Posting };

export interface BudgetReport {
  readonly asOf: IsoDay;
  readonly view: BudgetView;
  readonly columns: readonly ReportColumn[];
  /** P, B, T, then entities with no letter by name. */
  readonly books: readonly ReportBook[];
  /** One per column, in column order. */
  readonly totals: readonly ColumnTotals[];
  /** In the view's range, not placeable on an income or expense account. In no total. */
  readonly unplaced: readonly UnplacedItem[];
}

// ── FAIL LOUD ───────────────────────────────────────────────────────────────

export type BudgetReportErrorCode =
  | 'malformed-day'
  | 'bad-view'
  | 'code-not-four-digits'
  | 'bad-cents'
  | 'negative-posting-cents'
  | 'bad-entry-type'
  | 'posting-after-as-of'
  | 'duplicate-account'
  | 'account-for-unknown-entity'
  | 'duplicate-entity'
  | 'bad-balance-type'
  | 'bad-account-type'
  | 'balance-disagrees-with-family'
  | 'bad-source'
  | 'missing-id'
  | 'unsafe-sum'
  // BUDGET-02: an archived flag that is not a boolean; a column state that is not one; a drill the model cannot honour.
  | 'bad-archived'
  | 'bad-column-state'
  | 'cell-account-not-in-chart'
  | 'cell-account-not-a-row'
  | 'bad-cell-range';

/** Bad input is refused by name — never coerced into something the model can use. */
export class BudgetReportError extends Error {
  readonly code: BudgetReportErrorCode;
  constructor(code: BudgetReportErrorCode, message: string) {
    super(`BUDGET REPORT: ${message}`);
    this.name = 'BudgetReportError';
    this.code = code;
  }
}

// ── DAYS (UTC, integer arithmetic, no Date) ─────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number): number => (m === 2 ? (isLeap(y) ? 29 : 28) : [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]);
const pad = (n: number, width: number): string => String(n).padStart(width, '0');
const iso = (y: number, m: number, d: number): IsoDay => `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;

function parts(day: IsoDay): { y: number; m: number; d: number } {
  const match = DAY_RE.exec(day) as RegExpExecArray;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Days since 1970-01-01 (proleptic Gregorian), by integer arithmetic. */
function ordinal(day: IsoDay): number {
  const { y, m, d } = parts(day);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** The day a day number names. */
function fromOrdinal(n: number): IsoDay {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return iso(yoe + era * 400 + (m <= 2 ? 1 : 0), m, d);
}

/** 0 = Monday … 6 = Sunday. 1970-01-01 (day 0) was a Thursday. */
const weekdayIndex = (day: IsoDay): number => (((ordinal(day) + 3) % 7) + 7) % 7;
const minDay = (a: IsoDay, b: IsoDay): IsoDay => (a < b ? a : b);
const within = (day: IsoDay, from: IsoDay, to: IsoDay): boolean => from <= day && day <= to;

// ── VALIDATION ──────────────────────────────────────────────────────────────

function checkDay(value: unknown, where: string): IsoDay {
  if (typeof value !== 'string' || !DAY_RE.test(value)) {
    throw new BudgetReportError('malformed-day', `${where} ${JSON.stringify(value)} is not a 'YYYY-MM-DD' day`);
  }
  const { y, m, d } = parts(value);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new BudgetReportError('malformed-day', `${where} "${value}" is not a day on the calendar`);
  }
  return value;
}

function checkId(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') throw new BudgetReportError('missing-id', `${where} is not a non-empty string`);
  return value;
}

function checkCode(value: unknown, where: string): string {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) {
    throw new BudgetReportError('code-not-four-digits', `${where} ${JSON.stringify(value)} is not the bare four digits of a chart code`);
  }
  return value;
}

function checkCents(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new BudgetReportError('bad-cents', `${where} ${JSON.stringify(value)} is not a safe integer number of cents`);
  }
  return value;
}

function checkView(view: BudgetView): BudgetView {
  if (view && view.kind === 'day') return { kind: 'day', day: checkDay(view.day, 'view.day') };
  if (view && view.kind === 'week') return { kind: 'week', weekOf: checkDay(view.weekOf, 'view.weekOf') };
  if (view && view.kind === 'year') {
    if (!Number.isInteger(view.year) || view.year < 1 || view.year > 9999) {
      throw new BudgetReportError('bad-view', `view.year ${JSON.stringify(view.year)} is not a year from 1 to 9999`);
    }
    return { kind: 'year', year: view.year };
  }
  throw new BudgetReportError('bad-view', `view ${JSON.stringify(view)} is not a day, week or year view`);
}

// ── INTEGER SUMS ────────────────────────────────────────────────────────────

function safe(n: number, what: string): number {
  if (!Number.isSafeInteger(n)) throw new BudgetReportError('unsafe-sum', `${what} left the safe integer range`);
  return n;
}

/** Σ of the values, or null when there are none. */
function sumOrNull(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) total = safe(total + v, 'a sum of cents');
  return total;
}

/** a − b when both are known; null otherwise. */
const strictDiff = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : safe(a - b, 'a NET figure'));
/** a + b when both are known; null otherwise. */
const strictSum = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : safe(a + b, 'a NET figure'));

// ── COLUMNS ─────────────────────────────────────────────────────────────────

function stateOf(from: IsoDay, to: IsoDay, asOf: IsoDay): ColumnState {
  if (from > asOf) return 'future';
  if (to <= asOf) return 'closed';
  return 'inProgress';
}

/** The days a view reads: DAY [1st of d's month … d] · WEEK [Monday … Sunday] · YEAR [Jan 1 … Dec 31]. The one copy. */
function rangeOfView(view: BudgetView): { rangeFrom: IsoDay; rangeTo: IsoDay } {
  if (view.kind === 'day') {
    const { y, m } = parts(view.day);
    return { rangeFrom: iso(y, m, 1), rangeTo: view.day };
  }
  if (view.kind === 'week') {
    const monday = ordinal(view.weekOf) - weekdayIndex(view.weekOf);
    return { rangeFrom: fromOrdinal(monday), rangeTo: fromOrdinal(monday + 6) };
  }
  return { rangeFrom: iso(view.year, 1, 1), rangeTo: iso(view.year, 12, 31) };
}

/**
 * TAB13-02a (R9): the model's own range, exported so the route loads exactly
 * the days the model reads — no second copy of the range logic. A view that is
 * not a day, week or year is refused by name (BudgetReportError 'bad-view').
 */
export function viewRange(view: BudgetView): { rangeFrom: IsoDay; rangeTo: IsoDay } {
  return rangeOfView(checkView(view));
}

function columnsFor(view: BudgetView, asOf: IsoDay): { columns: ReportColumn[]; rangeFrom: IsoDay; rangeTo: IsoDay } {
  const col = (key: string, kind: ColumnKind, label: string, from: IsoDay, to: IsoDay): ReportColumn =>
    ({ key, kind, label, from, to, state: stateOf(from, to, asOf) });

  const { rangeFrom, rangeTo } = rangeOfView(view);
  if (view.kind === 'day') {
    return {
      columns: [
        col('mtd', 'mtd', 'MTD', rangeFrom, view.day),
        col(view.day, 'day', WEEKDAY_LABELS[weekdayIndex(view.day)], view.day, view.day),
      ],
      rangeFrom,
      rangeTo,
    };
  }
  if (view.kind === 'week') {
    const monday = ordinal(rangeFrom);
    const days = WEEKDAY_LABELS.map((_, i) => fromOrdinal(monday + i));
    return {
      columns: [col('week', 'week', 'WEEK', days[0], days[6]), ...days.map((d, i) => col(d, 'day', WEEKDAY_LABELS[i], d, d))],
      rangeFrom,
      rangeTo,
    };
  }
  const jan1 = rangeFrom;
  const dec31 = rangeTo;
  const months = MONTH_LABELS.map((label, i) =>
    col(`${pad(view.year, 4)}-${pad(i + 1, 2)}`, 'month', label, iso(view.year, i + 1, 1), iso(view.year, i + 1, daysInMonth(view.year, i + 1))));
  // YTD ends at min(asOf, Dec 31). For a year that begins after asOf that is
  // before Jan 1: the column is future, its range is empty and every figure in it is null.
  // BUDGET-02 (ruling C): Jan … Dec, then YTD.
  return { columns: [...months, col('ytd', 'ytd', 'YTD', jan1, minDay(asOf, dec31))], rangeFrom, rangeTo };
}

/**
 * BUDGET-02 — WHICH BUDGET A CELL PRINTS, by its column's state (ruled
 * 2026-09-27): a CLOSED or IN-PROGRESS column prints the budget to date, a
 * FUTURE one the full budget. The one rule: format.ts formatBudget writes it,
 * and the drill lists the lines behind whichever it is.
 */
export type ShownBudget = 'toDate' | 'full';

export function shownBudget(state: ColumnState): ShownBudget {
  if (state === 'closed' || state === 'inProgress') return 'toDate';
  if (state === 'future') return 'full';
  throw new BudgetReportError('bad-column-state', `${JSON.stringify(state)} is not a column state (closed, inProgress, future)`);
}

// ── BOOKS AND ORDER ─────────────────────────────────────────────────────────

// BUDGET-02 (ruling B): Business · Personal · Trading — by the stored entity type's letter, never re-typed.
const BOOK_LABEL: Readonly<Record<EntityLetter, string>> = { B: 'Business', P: 'Personal', T: 'Trading' };
const LETTER_RANK: Readonly<Record<EntityLetter, number>> = { B: 0, P: 1, T: 2 };
const cmp = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

const keyOf = (entityId: string, code: string): string => `${entityId}\u0000${code}`;

function compareUnplaced(a: UnplacedItem, b: UnplacedItem): number {
  if (a.kind !== b.kind) return a.kind === 'budgetLine' ? -1 : 1;
  const ia = a.kind === 'budgetLine' ? a.line : a.posting;
  const ib = b.kind === 'budgetLine' ? b.line : b.posting;
  const head = cmp(ia.day, ib.day) || cmp(ia.entityId, ib.entityId) || cmp(ia.code, ib.code) || cmp(a.reason, b.reason);
  if (head !== 0) return head;
  if (a.kind === 'budgetLine' && b.kind === 'budgetLine') {
    return cmp(a.line.source, b.line.source) || cmp(a.line.sourceId, b.line.sourceId) || cmp(a.line.cents, b.line.cents);
  }
  if (a.kind === 'posting' && b.kind === 'posting') {
    return cmp(a.posting.journalEntryId, b.posting.journalEntryId) || cmp(a.posting.entryType, b.posting.entryType) || cmp(a.posting.cents, b.posting.cents);
  }
  return 0;
}

// ── TOTALS ──────────────────────────────────────────────────────────────────

function sectionOf(cells: readonly ReportCell[]): SectionTotal {
  const known = (pick: (c: ReportCell) => number | null): number[] =>
    cells.map(pick).filter((v): v is number => v !== null);
  return {
    budgetFull: sumOrNull(known((c) => c.budgetFull)),
    budgetToDate: sumOrNull(known((c) => c.budgetToDate)),
    actual: sumOrNull(known((c) => c.actual)),
    variance: sumOrNull(known((c) => c.variance)),
    unbudgetedActual: sumOrNull(known((c) => (c.budgetToDate === null ? c.actual : null))),
    coverage: {
      rows: cells.length,
      withBudget: known((c) => c.budgetFull).length,
      withBudgetToDate: known((c) => c.budgetToDate).length,
      withActual: known((c) => c.actual).length,
      withVariance: known((c) => c.variance).length,
    },
  };
}

function netOf(income: SectionTotal, expense: SectionTotal): SectionTotal {
  return {
    budgetFull: strictDiff(income.budgetFull, expense.budgetFull),
    budgetToDate: strictDiff(income.budgetToDate, expense.budgetToDate),
    actual: strictDiff(income.actual, expense.actual),
    variance: strictSum(income.variance, expense.variance),
    unbudgetedActual: strictDiff(income.unbudgetedActual, expense.unbudgetedActual),
    coverage: {
      rows: income.coverage.rows + expense.coverage.rows,
      withBudget: income.coverage.withBudget + expense.coverage.withBudget,
      withBudgetToDate: income.coverage.withBudgetToDate + expense.coverage.withBudgetToDate,
      withActual: income.coverage.withActual + expense.coverage.withActual,
      withVariance: income.coverage.withVariance + expense.coverage.withVariance,
    },
  };
}

/**
 * TAB13-03: the totals of a set of rows, one per column — income, expense, NET.
 * ONE function, two scopes: the report's totals over every book's rows, and each
 * book's over its own. Because a section sums only the known values of its cells
 * (sumOrNull), a report figure is the sum of the books' figures, and is null only
 * when every book's is. NET is strict — both sides or nothing — so a report's NET
 * need not be the sum of the books' NETs.
 */
function totalsOf(rows: readonly ReportRow[], columns: readonly ReportColumn[]): ColumnTotals[] {
  return columns.map((_, i) => {
    const income = sectionOf(rows.filter((r) => r.family === 'revenue').map((r) => r.cells[i]));
    const expense = sectionOf(rows.filter((r) => r.family === 'expense').map((r) => r.cells[i]));
    return { income, expense, net: netOf(income, expense) };
  });
}

// ── THE REPORT ──────────────────────────────────────────────────────────────

/** One account's budget lines and postings in the view's range — the very objects handed in. */
interface Slot {
  readonly account: ChartAccount;
  readonly lines: BudgetLine[];
  readonly postings: Posting[];
}

/** The input checked and placed: what buildBudgetReport and buildBudgetCell both stand on. */
interface Placed {
  readonly asOf: IsoDay;
  readonly view: BudgetView;
  readonly entities: ReadonlyMap<string, ReportEntity>;
  readonly accounts: ReadonlyMap<string, ChartAccount>;
  readonly columns: readonly ReportColumn[];
  readonly rangeFrom: IsoDay;
  readonly rangeTo: IsoDay;
  readonly slots: ReadonlyMap<string, Slot>;
  readonly unplaced: readonly UnplacedItem[];
  /** BUDGET-02: the entities with a budget line dated in the view's range, placed or not. */
  readonly planned: ReadonlySet<string>;
}

function placeInput(input: BudgetReportInput): Placed {
  const asOf = checkDay(input.asOf, 'asOf');
  const view = checkView(input.view);

  const entities = new Map<string, ReportEntity>();
  input.entities.forEach((e, i) => {
    const id = checkId(e.id, `entities[${i}].id`);
    if (typeof e.name !== 'string') throw new BudgetReportError('missing-id', `entities[${i}].name is not a string`);
    if (typeof e.entityType !== 'string') throw new BudgetReportError('missing-id', `entities[${i}].entityType is not a string`);
    if (entities.has(id)) throw new BudgetReportError('duplicate-entity', `entities[${i}] repeats entity ${id}`);
    entities.set(id, { id, name: e.name, entityType: e.entityType });
  });

  const accounts = new Map<string, ChartAccount>();
  input.accounts.forEach((a, i) => {
    const entityId = checkId(a.entityId, `accounts[${i}].entityId`);
    const code = checkCode(a.code, `accounts[${i}].code`);
    if (!entities.has(entityId)) throw new BudgetReportError('account-for-unknown-entity', `accounts[${i}] (${code}) names entity ${entityId}, which is not in entities`);
    if (a.balanceType !== 'D' && a.balanceType !== 'C') throw new BudgetReportError('bad-balance-type', `accounts[${i}] (${code}) balanceType ${JSON.stringify(a.balanceType)} is not D or C`);
    if (!isFamily(a.accountType)) throw new BudgetReportError('bad-account-type', `accounts[${i}] (${code}) accountType ${JSON.stringify(a.accountType)} is not asset, liability, equity, revenue or expense`);
    if ((a.accountType === 'revenue' || a.accountType === 'expense') && a.balanceType !== FAMILY_RULES[a.accountType].balanceType) {
      throw new BudgetReportError('balance-disagrees-with-family', `accounts[${i}] ${code} in entity ${entityId} is a ${a.accountType} account stored with balance type ${a.balanceType}; a ${a.accountType} account's normal balance is ${FAMILY_RULES[a.accountType].balanceType} — a contra P&L account would be netted one way and signed the other, so it is refused`);
    }
    if (typeof a.name !== 'string') throw new BudgetReportError('missing-id', `accounts[${i}] (${code}) name is not a string`);
    if (typeof a.archived !== 'boolean') throw new BudgetReportError('bad-archived', `accounts[${i}] (${code}) archived ${JSON.stringify(a.archived)} is not true or false`);
    const key = keyOf(entityId, code);
    if (accounts.has(key)) throw new BudgetReportError('duplicate-account', `accounts[${i}] repeats ${code} in entity ${entityId}`);
    accounts.set(key, { entityId, code, name: a.name, accountType: a.accountType, balanceType: a.balanceType, archived: a.archived });
  });

  input.budgetLines.forEach((l, i) => {
    checkId(l.entityId, `budgetLines[${i}].entityId`);
    checkCode(l.code, `budgetLines[${i}].code`);
    checkDay(l.day, `budgetLines[${i}].day`);
    checkCents(l.cents, `budgetLines[${i}].cents`);
    if (!(BUDGET_SOURCES as readonly string[]).includes(l.source)) throw new BudgetReportError('bad-source', `budgetLines[${i}].source ${JSON.stringify(l.source)} is not one of ${BUDGET_SOURCES.join(', ')}`);
    checkId(l.sourceId, `budgetLines[${i}].sourceId`);
  });

  input.postings.forEach((p, i) => {
    checkId(p.entityId, `postings[${i}].entityId`);
    checkCode(p.code, `postings[${i}].code`);
    checkDay(p.day, `postings[${i}].day`);
    const cents = checkCents(p.cents, `postings[${i}].cents`);
    if (cents < 0) throw new BudgetReportError('negative-posting-cents', `postings[${i}].cents ${cents} is negative — a posting's direction is its entryType`);
    if (p.entryType !== 'D' && p.entryType !== 'C') throw new BudgetReportError('bad-entry-type', `postings[${i}].entryType ${JSON.stringify(p.entryType)} is not D or C`);
    if (p.day > asOf) throw new BudgetReportError('posting-after-as-of', `postings[${i}] is dated ${p.day}, after asOf ${asOf}`);
    checkId(p.journalEntryId, `postings[${i}].journalEntryId`);
  });

  const { columns, rangeFrom, rangeTo } = columnsFor(view, asOf);

  // Place everything in the view's range: on a row, or unplaced with its reason.
  const slots = new Map<string, Slot>();
  const unplaced: UnplacedItem[] = [];
  const planned = new Set<string>();
  const reasonFor = (account: ChartAccount | undefined): UnplacedReason | null => {
    if (!account) return 'not in chart';
    if (account.accountType !== 'revenue' && account.accountType !== 'expense') return 'not an income or expense account';
    return null;
  };
  const slot = (account: ChartAccount): Slot => {
    const key = keyOf(account.entityId, account.code);
    let s = slots.get(key);
    if (!s) { s = { account, lines: [], postings: [] }; slots.set(key, s); }
    return s;
  };
  for (const line of input.budgetLines) {
    if (!within(line.day, rangeFrom, rangeTo)) continue;
    planned.add(line.entityId);
    const account = accounts.get(keyOf(line.entityId, line.code));
    const reason = reasonFor(account);
    if (reason) unplaced.push({ kind: 'budgetLine', reason, line: { ...line } });
    else slot(account as ChartAccount).lines.push(line);
  }
  for (const posting of input.postings) {
    if (!within(posting.day, rangeFrom, rangeTo)) continue;
    const account = accounts.get(keyOf(posting.entityId, posting.code));
    const reason = reasonFor(account);
    if (reason) unplaced.push({ kind: 'posting', reason, posting: { ...posting } });
    else slot(account as ChartAccount).postings.push(posting);
  }

  return { asOf, view, entities, accounts, columns, rangeFrom, rangeTo, slots, unplaced, planned };
}

/** The lines and postings behind one cell — THE selection every figure is the sum of. */
interface Selection {
  /** Budget lines dated in [from, to]. */
  readonly full: readonly BudgetLine[];
  /** Budget lines dated in [from, min(to, asOf)]. */
  readonly toDate: readonly BudgetLine[];
  /** Postings dated in [from, min(to, asOf)]; none for a future column. */
  readonly postings: readonly Posting[];
}

function selectionOf(s: Slot, column: Pick<ReportColumn, 'from' | 'to' | 'state'>, asOf: IsoDay): Selection {
  const toDate = minDay(column.to, asOf);
  return {
    full: s.lines.filter((l) => within(l.day, column.from, column.to)),
    toDate: s.lines.filter((l) => within(l.day, column.from, toDate)),
    postings: column.state === 'future' ? [] : s.postings.filter((p) => within(p.day, column.from, toDate)),
  };
}

/** A selection's figures: the sums, the net actual, the variance. */
function figuresOf(account: ChartAccount, sel: Selection): ReportCell {
  const budgetFull = sumOrNull(sel.full.map((l) => l.cents));
  const budgetToDate = sumOrNull(sel.toDate.map((l) => l.cents));
  let actual: number | null = null;
  if (sel.postings.length > 0) {
    // The normal side adds, the other side subtracts: a 'D' account is
    // debits − credits, a 'C' account credits − debits.
    let net = 0;
    for (const p of sel.postings) net = safe(net + (p.entryType === account.balanceType ? p.cents : -p.cents), 'an actual');
    actual = net;
  }
  // links.ts variance(a, b) is a − b, null unless both are known. Revenue is
  // favorable when actual exceeds budget, so the actual goes first.
  const v = account.accountType === 'revenue' ? variance(actual, budgetToDate) : variance(budgetToDate, actual);
  return { budgetFull, budgetToDate, actual, variance: v === null ? null : safe(v, 'a variance') };
}

const emptySlot = (account: ChartAccount): Slot => ({ account, lines: [], postings: [] });
const hasFigure = (c: ReportCell): boolean => c.budgetFull !== null || c.budgetToDate !== null || c.actual !== null;

export function buildBudgetReport(input: BudgetReportInput): BudgetReport {
  const { asOf, view, entities, accounts, columns, slots, unplaced, planned } = placeInput(input);

  // BUDGET-02 (ruling C): a row for every revenue and expense account — an archived one only with a figure.
  const rowsByEntity = new Map<string, ReportRow[]>();
  for (const account of accounts.values()) {
    if (account.accountType !== 'revenue' && account.accountType !== 'expense') continue;
    const s = slots.get(keyOf(account.entityId, account.code)) ?? emptySlot(account);
    const cells = columns.map((c) => figuresOf(account, selectionOf(s, c, asOf)));
    if (account.archived && !cells.some(hasFigure)) continue;
    const row: ReportRow = {
      entityId: account.entityId,
      code: account.code,
      name: account.name,
      family: account.accountType,
      balanceType: account.balanceType,
      cells,
    };
    const list = rowsByEntity.get(row.entityId) ?? [];
    list.push(row);
    rowsByEntity.set(row.entityId, list);
  }

  const books: ReportBook[] = [...entities.values()]
    .map((e) => ({ e, letter: letterFor(e.entityType) }))
    .sort((a, b) =>
      cmp(a.letter ? LETTER_RANK[a.letter] : 3, b.letter ? LETTER_RANK[b.letter] : 3) || cmp(a.e.name, b.e.name) || cmp(a.e.id, b.e.id))
    .map(({ e, letter }) => {
      const rows = [...(rowsByEntity.get(e.id) ?? [])].sort((a, b) =>
        cmp(a.family === 'revenue' ? 0 : 1, b.family === 'revenue' ? 0 : 1) || cmp(a.code, b.code));
      return {
        entityId: e.id,
        entityName: e.name,
        entityType: e.entityType,
        letter,
        label: letter ? BOOK_LABEL[letter] : e.name,
        rows,
        hasPlanLines: planned.has(e.id),
        totals: totalsOf(rows, columns),
      };
    });

  const totals = totalsOf(books.flatMap((b) => b.rows), columns);

  return { asOf, view, columns, books, totals, unplaced: [...unplaced].sort(compareUnplaced) };
}

// ── THE DRILL (BUDGET-02) ───────────────────────────────────────────────────

/** One row's figures over one range of the view — what a click on a figure asks for. */
export interface CellRequest {
  readonly entityId: string;
  /** The bare four digits, as a row gives them. */
  readonly code: string;
  readonly from: IsoDay;
  readonly to: IsoDay;
}

export interface BudgetCell {
  readonly asOf: IsoDay;
  readonly account: { readonly entityId: string; readonly code: string; readonly name: string; readonly family: RowFamily; readonly archived: boolean };
  /** The range asked for, with its state by the columns' own rule. */
  readonly range: { readonly from: IsoDay; readonly to: IsoDay; readonly state: ColumnState };
  /** The figures a column of exactly this range prints — the same function as every cell. */
  readonly cell: ReportCell;
  /** Which budget the cell prints (shownBudget): to date, or the full budget for a future range. */
  readonly shown: ShownBudget;
  /** The budget lines behind the PRINTED budget figure — the very objects handed in, in input order. */
  readonly budgetLines: readonly BudgetLine[];
  /** The postings behind the actual — the very objects handed in, in input order; none for a future range. */
  readonly postings: readonly Posting[];
}

/**
 * BUDGET-02 (rulings E, G): the lines and postings behind one row's figures over
 * one range of the view, by the SAME placement and the SAME selection as
 * buildBudgetReport — so the drill's lines sum to the cell by construction. The
 * input is checked exactly as the report's. Refused by name: an account that is
 * not in the book's chart, an account that is no row (not revenue or expense),
 * and a range that is not inside the view's or runs backwards.
 */
export function buildBudgetCell(input: BudgetReportInput, request: CellRequest): BudgetCell {
  const placed = placeInput(input);
  const entityId = checkId(request.entityId, 'request.entityId');
  const code = checkCode(request.code, 'request.code');
  const from = checkDay(request.from, 'request.from');
  const to = checkDay(request.to, 'request.to');
  const account = placed.accounts.get(keyOf(entityId, code));
  if (!account) throw new BudgetReportError('cell-account-not-in-chart', `account ${code} is not in the chart of book ${entityId}`);
  if (account.accountType !== 'revenue' && account.accountType !== 'expense') {
    throw new BudgetReportError('cell-account-not-a-row', `account ${code} of book ${entityId} is in the ${account.accountType} family — only revenue and expense accounts are rows`);
  }
  if (from > to || from < placed.rangeFrom || to > placed.rangeTo) {
    throw new BudgetReportError('bad-cell-range', `[${from}, ${to}] is not a range inside the view's [${placed.rangeFrom}, ${placed.rangeTo}]`);
  }
  const range = { from, to, state: stateOf(from, to, placed.asOf) };
  const sel = selectionOf(placed.slots.get(keyOf(entityId, code)) ?? emptySlot(account), range, placed.asOf);
  const shown = shownBudget(range.state);
  return {
    asOf: placed.asOf,
    account: { entityId, code, name: account.name, family: account.accountType, archived: account.archived },
    range,
    cell: figuresOf(account, sel),
    shown,
    budgetLines: shown === 'full' ? sel.full : sel.toDate,
    postings: sel.postings,
  };
}
