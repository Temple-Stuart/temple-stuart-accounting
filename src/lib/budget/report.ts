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
 */
import { variance } from '@/lib/calendar/links';
import { letterFor, isFamily, type EntityLetter } from '@/lib/coa/scheme';

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
  readonly accounts: readonly ReportAccount[];
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
  /** 'PERSONAL' · 'BUSINESS' · 'TRADE' · or '<name> (<entity type>)' for a type with no letter. */
  readonly label: string;
  /** Revenue before expense, code ascending. Empty when the entity has no activity in the view. */
  readonly rows: readonly ReportRow[];
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
  | 'bad-source'
  | 'missing-id'
  | 'unsafe-sum';

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

function columnsFor(view: BudgetView, asOf: IsoDay): { columns: ReportColumn[]; rangeFrom: IsoDay; rangeTo: IsoDay } {
  const col = (key: string, kind: ColumnKind, label: string, from: IsoDay, to: IsoDay): ReportColumn =>
    ({ key, kind, label, from, to, state: stateOf(from, to, asOf) });

  if (view.kind === 'day') {
    const { y, m } = parts(view.day);
    const first = iso(y, m, 1);
    return {
      columns: [
        col('mtd', 'mtd', 'MTD', first, view.day),
        col(view.day, 'day', WEEKDAY_LABELS[weekdayIndex(view.day)], view.day, view.day),
      ],
      rangeFrom: first,
      rangeTo: view.day,
    };
  }
  if (view.kind === 'week') {
    const monday = ordinal(view.weekOf) - weekdayIndex(view.weekOf);
    const days = WEEKDAY_LABELS.map((_, i) => fromOrdinal(monday + i));
    return {
      columns: [col('week', 'week', 'WEEK', days[0], days[6]), ...days.map((d, i) => col(d, 'day', WEEKDAY_LABELS[i], d, d))],
      rangeFrom: days[0],
      rangeTo: days[6],
    };
  }
  const jan1 = iso(view.year, 1, 1);
  const dec31 = iso(view.year, 12, 31);
  const months = MONTH_LABELS.map((label, i) =>
    col(`${pad(view.year, 4)}-${pad(i + 1, 2)}`, 'month', label, iso(view.year, i + 1, 1), iso(view.year, i + 1, daysInMonth(view.year, i + 1))));
  // YTD ends at min(asOf, Dec 31). For a year that begins after asOf that is
  // before Jan 1: the column is future, its range is empty and every figure in it is null.
  return { columns: [col('ytd', 'ytd', 'YTD', jan1, minDay(asOf, dec31)), ...months], rangeFrom: jan1, rangeTo: dec31 };
}

// ── BOOKS AND ORDER ─────────────────────────────────────────────────────────

const BOOK_LABEL: Readonly<Record<EntityLetter, string>> = { P: 'PERSONAL', B: 'BUSINESS', T: 'TRADE' };
const LETTER_RANK: Readonly<Record<EntityLetter, number>> = { P: 0, B: 1, T: 2 };
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

// ── THE REPORT ──────────────────────────────────────────────────────────────

export function buildBudgetReport(input: BudgetReportInput): BudgetReport {
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

  const accounts = new Map<string, ReportAccount>();
  input.accounts.forEach((a, i) => {
    const entityId = checkId(a.entityId, `accounts[${i}].entityId`);
    const code = checkCode(a.code, `accounts[${i}].code`);
    if (!entities.has(entityId)) throw new BudgetReportError('account-for-unknown-entity', `accounts[${i}] (${code}) names entity ${entityId}, which is not in entities`);
    if (a.balanceType !== 'D' && a.balanceType !== 'C') throw new BudgetReportError('bad-balance-type', `accounts[${i}] (${code}) balanceType ${JSON.stringify(a.balanceType)} is not D or C`);
    if (!isFamily(a.accountType)) throw new BudgetReportError('bad-account-type', `accounts[${i}] (${code}) accountType ${JSON.stringify(a.accountType)} is not asset, liability, equity, revenue or expense`);
    if (typeof a.name !== 'string') throw new BudgetReportError('missing-id', `accounts[${i}] (${code}) name is not a string`);
    const key = keyOf(entityId, code);
    if (accounts.has(key)) throw new BudgetReportError('duplicate-account', `accounts[${i}] repeats ${code} in entity ${entityId}`);
    accounts.set(key, { entityId, code, name: a.name, accountType: a.accountType, balanceType: a.balanceType });
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
  const placed = new Map<string, { account: ReportAccount; lines: BudgetLine[]; postings: Posting[] }>();
  const unplaced: UnplacedItem[] = [];
  const reasonFor = (account: ReportAccount | undefined): UnplacedReason | null => {
    if (!account) return 'not in chart';
    if (account.accountType !== 'revenue' && account.accountType !== 'expense') return 'not an income or expense account';
    return null;
  };
  const slot = (account: ReportAccount) => {
    const key = keyOf(account.entityId, account.code);
    let s = placed.get(key);
    if (!s) { s = { account, lines: [], postings: [] }; placed.set(key, s); }
    return s;
  };
  for (const line of input.budgetLines) {
    if (!within(line.day, rangeFrom, rangeTo)) continue;
    const account = accounts.get(keyOf(line.entityId, line.code));
    const reason = reasonFor(account);
    if (reason) unplaced.push({ kind: 'budgetLine', reason, line: { ...line } });
    else slot(account as ReportAccount).lines.push(line);
  }
  for (const posting of input.postings) {
    if (!within(posting.day, rangeFrom, rangeTo)) continue;
    const account = accounts.get(keyOf(posting.entityId, posting.code));
    const reason = reasonFor(account);
    if (reason) unplaced.push({ kind: 'posting', reason, posting: { ...posting } });
    else slot(account as ReportAccount).postings.push(posting);
  }

  const cellOf = (s: { account: ReportAccount; lines: BudgetLine[]; postings: Posting[] }, column: ReportColumn): ReportCell => {
    const toDate = minDay(column.to, asOf);
    const budgetFull = sumOrNull(s.lines.filter((l) => within(l.day, column.from, column.to)).map((l) => l.cents));
    const budgetToDate = sumOrNull(s.lines.filter((l) => within(l.day, column.from, toDate)).map((l) => l.cents));
    let actual: number | null = null;
    if (column.state !== 'future') {
      const hits = s.postings.filter((p) => within(p.day, column.from, toDate));
      if (hits.length > 0) {
        // The normal side adds, the other side subtracts: a 'D' account is
        // debits − credits, a 'C' account credits − debits.
        let net = 0;
        for (const p of hits) net = safe(net + (p.entryType === s.account.balanceType ? p.cents : -p.cents), 'an actual');
        actual = net;
      }
    }
    // links.ts variance(a, b) is a − b, null unless both are known. Revenue is
    // favorable when actual exceeds budget, so the actual goes first.
    const v = s.account.accountType === 'revenue' ? variance(actual, budgetToDate) : variance(budgetToDate, actual);
    return { budgetFull, budgetToDate, actual, variance: v === null ? null : safe(v, 'a variance') };
  };

  const rowsByEntity = new Map<string, ReportRow[]>();
  for (const s of placed.values()) {
    const row: ReportRow = {
      entityId: s.account.entityId,
      code: s.account.code,
      name: s.account.name,
      family: s.account.accountType as RowFamily,
      balanceType: s.account.balanceType,
      cells: columns.map((c) => cellOf(s, c)),
    };
    const list = rowsByEntity.get(row.entityId) ?? [];
    list.push(row);
    rowsByEntity.set(row.entityId, list);
  }

  const books: ReportBook[] = [...entities.values()]
    .map((e) => ({ e, letter: letterFor(e.entityType) }))
    .sort((a, b) =>
      cmp(a.letter ? LETTER_RANK[a.letter] : 3, b.letter ? LETTER_RANK[b.letter] : 3) || cmp(a.e.name, b.e.name) || cmp(a.e.id, b.e.id))
    .map(({ e, letter }) => ({
      entityId: e.id,
      entityName: e.name,
      entityType: e.entityType,
      letter,
      label: letter ? BOOK_LABEL[letter] : `${e.name} (${e.entityType})`,
      rows: [...(rowsByEntity.get(e.id) ?? [])].sort((a, b) =>
        cmp(a.family === 'revenue' ? 0 : 1, b.family === 'revenue' ? 0 : 1) || cmp(a.code, b.code)),
    }));

  const allRows = books.flatMap((b) => b.rows);
  const totals: ColumnTotals[] = columns.map((_, i) => {
    const income = sectionOf(allRows.filter((r) => r.family === 'revenue').map((r) => r.cells[i]));
    const expense = sectionOf(allRows.filter((r) => r.family === 'expense').map((r) => r.cells[i]));
    return { income, expense, net: netOf(income, expense) };
  });

  return { asOf, view, columns, books, totals, unplaced: unplaced.sort(compareUnplaced) };
}
