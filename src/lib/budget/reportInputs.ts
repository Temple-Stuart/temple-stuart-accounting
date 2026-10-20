/**
 * TAB13-02b — THE BUDGET REPORT ROUTE'S PURE HALF: the query, every row → input
 * mapping, and the response.
 *
 * GET /api/budget/report (src/app/api/budget/report/route.ts) authenticates,
 * reads the rows and hands them here. Everything between a row and the JSON the
 * screen reads happens in this file, so all of it is tested without a database:
 *
 *   · THE QUERY. view=day&day=YYYY-MM-DD · view=week&weekOf=YYYY-MM-DD ·
 *     view=year&year=YYYY, and asOf=YYYY-MM-DD — the VIEWER's local date. asOf
 *     is accepted only when it is the server's UTC date, the day before or the
 *     day after (every zone on Earth is within a day of UTC). Each bad parameter
 *     is refused by name.
 *   · THE MAPPING. Entities, the chart, routines (from the ONE loader,
 *     src/lib/operations/routineBudgetInputs.ts), tasks, ledger lines and bank
 *     rows each become the plain input the pure modules take. A @db.Date is its
 *     UTC 'YYYY-MM-DD' — Prisma reads a date column as UTC midnight.
 *   · THE CHART AS SAVED (TAB13-02c, ruled 2026-09-27). Before COA-01 a code was
 *     saved as typed ("B-5100"); since, as four digits ("5100"). Every chart code,
 *     and every ledger line's account code, is read by the rule plan codes use —
 *     parseBudgetCode (days.ts), with the entity type of the row's OWN book — so a
 *     row saved either way is one account. A chart row the rule cannot read, or
 *     two rows of one book that are the same account, are refused by name, every
 *     one at once. The chart is read, never changed.
 *   · THE CALLS. The day rules (src/lib/budget/days.ts) place routines and
 *     tasks on days; the model (src/lib/budget/report.ts) builds the report.
 *     Neither is restated here.
 *   · THE DAY'S PLAN (TAB13-04). For a DAY or WEEK view, the plan lines on the
 *     view's day columns, each with its vendor, and the vendors a day holds that
 *     no plan line matches — src/lib/budget/planLines.ts decides; a YEAR says in
 *     words that it lists none.
 *   · THE RESPONSE. The report plus what is NOT in it, always stated: plans not
 *     placed, costed tasks excluded by status (ALL TIME), bank rows not in the
 *     books yet per column (a row whose amount is not whole cents is listed as
 *     not totalled and left out of the totals — never fatal), ledger lines left
 *     out by name, how many records each source gave, and the travel budgets,
 *     which are not connected.
 *
 * BUDGET-02 (2026-10-20) — Budget is one page, its figures drill:
 *   · THE CHART carries is_archived (ruling C: archived rows only with a figure);
 *     a costed task carries its project (the drill links /tasks?project=<id>); a
 *     ledger line carries its id, its entry's description and source type.
 *   · ONE BUILDER, TWO ROUTES. reportInputOf() is the rows → the model's input,
 *     exactly once: the report (budgetReportResponse) and the drill
 *     (budgetCellResponse, GET /api/budget/report/cell) both stand on it, so a
 *     drill's lines are placed by the very rules the cell was.
 *   · THE DRILL'S QUERY. book, account (the four digits a row gives), from, to —
 *     one calendar year, from not after to — and asOf by the report's own window.
 *     Each bad parameter is refused by name.
 *
 * Structural row shapes, no Prisma import, no clock: the route reads the server's
 * date and passes it in. A build law holds this file pure (scripts/
 * assert-tool-registry.ts, the budget report purity law).
 */
import {
  buildBudgetCell, buildBudgetReport, viewRange,
  type BudgetLine, type BudgetReport, type BudgetSource, type BudgetView, type ChartAccount, type ColumnState, type IsoDay, type Posting,
  type ReportAccount, type ReportEntity, type RowFamily, type ShownBudget,
} from '@/lib/budget/report';
import {
  buildRoutineBudgetLines, buildTaskBudgetLines, centsFromDollars, isIsoDay, parseBudgetCode,
  type ExcludedByStatus, type NotPlaced, type ParsedCode, type RoutinePlanInput, type TaskPlanInput,
} from '@/lib/budget/days';
import { dayPlanOf, daysOf, planLinesOn, type DayPlan, type PlanLinesErrorCode, type PlanVendorRow, type RoutineWords } from '@/lib/budget/planLines';

// ── FAIL LOUD ───────────────────────────────────────────────────────────────

export type BudgetInputErrorCode =
  | 'bad-server-day' | 'unsafe-cents' | 'bank-row-outside-range' | 'unknown-entity'
  // TAB13-02c: a saved chart code the rule cannot read; two saved codes of one book that are one account.
  | 'chart-code-unreadable' | 'chart-codes-collide'
  // TAB13-04: the plan-vendor rows the route read, and the day's plan lines, refused by name (planLines.ts).
  | PlanLinesErrorCode
  // BUDGET-02: a line the model selected for the drill with no row the route read behind it.
  | 'drill-row-missing';

/** A row the route read that cannot become an input — named, never coerced. The route answers 500. */
export class BudgetInputError extends Error {
  readonly code: BudgetInputErrorCode;
  constructor(code: BudgetInputErrorCode, message: string) {
    super(`BUDGET INPUTS: ${message}`);
    this.name = 'BudgetInputError';
    this.code = code;
  }
}

// ── DAYS ────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

/** The UTC 'YYYY-MM-DD' of an instant — how a @db.Date column reads. */
export function utcDay(instant: Date): IsoDay {
  return instant.toISOString().slice(0, 10);
}

const midnight = (day: IsoDay): number => Date.parse(`${day}T00:00:00.000Z`);
const addDays = (day: IsoDay, n: number): IsoDay => utcDay(new Date(midnight(day) + n * DAY_MS));

/** The three days asOf may be: the server's UTC date, the day before and the day after. */
export function asOfWindow(serverToday: IsoDay): readonly [IsoDay, IsoDay, IsoDay] {
  if (!isIsoDay(serverToday)) throw new BudgetInputError('bad-server-day', `the server's date ${JSON.stringify(serverToday)} is not a 'YYYY-MM-DD' day`);
  return [addDays(serverToday, -1), serverToday, addDays(serverToday, 1)];
}

// ── THE QUERY ───────────────────────────────────────────────────────────────

export type QueryRefusalCode = 'bad-view' | 'bad-day' | 'bad-weekOf' | 'bad-year' | 'bad-asOf' | 'asOf-outside-window';

export interface QueryRefusal {
  readonly error: QueryRefusalCode;
  readonly message: string;
}

export type ParsedReportQuery =
  | { readonly ok: true; readonly view: BudgetView; readonly asOf: IsoDay }
  | { readonly ok: false; readonly refusal: QueryRefusal };

const refuse = (error: QueryRefusalCode, message: string): ParsedReportQuery => ({ ok: false, refusal: { error, message } });

/** The URL's parameters → a view and asOf, or the first bad parameter, by name. */
export function parseReportQuery(params: { get(name: string): string | null }, serverToday: IsoDay): ParsedReportQuery {
  const window = asOfWindow(serverToday);
  const kind = params.get('view');
  let view: BudgetView;
  if (kind === 'day') {
    const day = params.get('day');
    if (!isIsoDay(day)) return refuse('bad-day', `day ${JSON.stringify(day)} is not a 'YYYY-MM-DD' day — view=day needs day=YYYY-MM-DD`);
    view = { kind: 'day', day };
  } else if (kind === 'week') {
    const weekOf = params.get('weekOf');
    if (!isIsoDay(weekOf)) return refuse('bad-weekOf', `weekOf ${JSON.stringify(weekOf)} is not a 'YYYY-MM-DD' day — view=week needs weekOf=YYYY-MM-DD`);
    view = { kind: 'week', weekOf };
  } else if (kind === 'year') {
    const year = params.get('year');
    if (year === null || !/^\d{4}$/.test(year) || Number(year) < 1) return refuse('bad-year', `year ${JSON.stringify(year)} is not a year 0001 to 9999 — view=year needs year=YYYY`);
    view = { kind: 'year', year: Number(year) };
  } else {
    return refuse('bad-view', `view ${JSON.stringify(kind)} is not day, week or year`);
  }
  const asOf = params.get('asOf');
  if (!isIsoDay(asOf)) return refuse('bad-asOf', `asOf ${JSON.stringify(asOf)} is not a 'YYYY-MM-DD' day — it is the viewer's local date`);
  if (!window.includes(asOf)) {
    return refuse('asOf-outside-window', `asOf ${asOf} is not a day the viewer can be living today — it must be ${window[0]}, ${window[1]} or ${window[2]} (the server's UTC date and the days either side)`);
  }
  return { ok: true, view, asOf };
}

// ── ROWS (structural — what the route reads) ────────────────────────────────

export interface EntityRow {
  readonly id: string;
  readonly name: string;
  readonly entity_type: string;
}

export interface ChartRow {
  readonly entity_id: string;
  readonly code: string;
  readonly name: string;
  readonly account_type: string;
  readonly balance_type: string;
}

/** BUDGET-02: a chart row as the budget reads it — with is_archived (ruling C). */
export interface BudgetChartRow extends ChartRow {
  readonly is_archived: boolean;
}

/** What loadRoutineBudgetInputs() hands back for one routine. */
export interface RoutineRow {
  readonly id: string;
  readonly name: string;
  readonly budget_amount: number | string | null;
  readonly coa_code: string | null;
  readonly schedule_rrule: string;
  readonly timezone: string;
  readonly start_date: Date | null;
  readonly end_date: Date | null;
  /** TAB13-04: each line's activity and time_of_day ('HH:MM', read once by the loader) are the day's plan lines' words. */
  readonly steps: readonly { readonly id: string; readonly is_active: boolean; readonly budget_amount: number | string | null; readonly coa_code: string | null; readonly step_order: number; readonly activity: string; readonly time_of_day: string | null }[];
}

export interface TaskRow {
  readonly id: string;
  readonly title: string;
  /** BUDGET-02: the drill links a task's line to /tasks?project=<project_id>. */
  readonly project_id: string;
  readonly entity_id: string;
  readonly status: string;
  /** A Prisma Decimal — only its string is read. */
  readonly estimated_cost_usd: { toString(): string } | null;
  readonly coa_code: string | null;
  readonly daily_plan_items: readonly { readonly plan_date: Date; readonly calendar_blocks: readonly { readonly status: string }[] }[];
}

export interface LedgerRow {
  readonly journal_entry_id: string;
  readonly entry_type: string;
  /** ledger_entries.amount — BigInt cents. */
  readonly amount: bigint;
  readonly account: { readonly entity_id: string; readonly code: string };
  readonly journal_entry: { readonly date: Date };
}

/** BUDGET-02: a ledger line as the one actuals query reads it — with what the drill lists. */
export interface LedgerDetailRow extends LedgerRow {
  /** ledger_entries.id. */
  readonly id: string;
  readonly journal_entry: { readonly date: Date; readonly description: string; readonly source_type: string };
}

export interface BankRow {
  readonly id: string;
  /** transactions.date — Plaid's date, stored at UTC midnight. */
  readonly date: Date;
  /** Plaid's amount, dollars. Plaid signs outflows positive. */
  readonly amount: number;
}

/** Ledger lines in the view's range that the report leaves out, each counted once. */
export interface ExcludedLines {
  /** Lines of an entry that reverses another, or was reversed (is_reversal · reversed_by_entry_id). */
  readonly reversalPairLines: number;
  /** Lines of a year-end closing entry (source_type 'year_end_close'). */
  readonly closingEntryLines: number;
  /** Lines dated after asOf — actuals stop at asOf. */
  readonly linesAfterAsOf: number;
}

export interface ReportRows {
  readonly entities: readonly EntityRow[];
  /** Every chart row of those entities, archived included (BUDGET-02: with is_archived). */
  readonly chart: readonly BudgetChartRow[];
  /** One group per entity: that entity's routines, from the loader. */
  readonly routines: readonly { readonly entityId: string; readonly rows: readonly RoutineRow[] }[];
  /** Costed tasks, every status, each with EVERY daily-plan item. */
  readonly tasks: readonly TaskRow[];
  /** P&L ledger lines in [rangeFrom, min(rangeTo, asOf)], reversal pairs and closing entries left out. */
  readonly ledger: readonly LedgerRow[];
  readonly excludedLines: ExcludedLines;
  /** Bank rows not committed to the books, in [rangeFrom, min(rangeTo, asOf)]. */
  readonly bank: readonly BankRow[];
  /**
   * TAB13-04: the caller's plan-vendor rows — for a DAY or WEEK view, every
   * every-occurrence row and the occurrence rows in planLines.ts vendorWindow; for
   * a YEAR, null (not read). The other way round is the route's bug, refused by name.
   */
  readonly planVendors: readonly PlanVendorRow[] | null;
}

// ── ROW → INPUT ─────────────────────────────────────────────────────────────

export function toReportEntity(row: EntityRow): ReportEntity {
  return { id: row.id, name: row.name, entityType: row.entity_type };
}

/**
 * THE ONE READER of a saved chart code (TAB13-02c): the rule plan codes use,
 * parseBudgetCode (days.ts), with the entity type of the row's OWN book. "5100"
 * and "B-5100" in a sole_prop book both read as 5100; "P-5100" there, a letter
 * on a book that has none, or anything but four digits is not read.
 */
export function readChartCode(saved: string, book: ReportEntity): ParsedCode {
  return parseBudgetCode(saved, book.entityType);
}

/** TAB13-02d: a refusal names the rule's reason AND its detail — the chart's own words (scheme.ts parseCode). */
const refusal = (read: { readonly reason: string; readonly detail: string | null }): string =>
  read.detail === null ? read.reason : `${read.reason}: ${read.detail}`;

const unreadableLine = (row: ChartRow, book: ReportEntity, read: { readonly reason: string; readonly detail: string | null }): string =>
  `${book.name} (${book.entityType}): code ${JSON.stringify(row.code)}, ${JSON.stringify(row.name)} — ${refusal(read)}`;

/** A chart row → the model's account, its code read as saved. balance_type passes through: the model refuses anything but D or C by name. */
export function toReportAccount(row: ChartRow, book: ReportEntity): ReportAccount {
  const read = readChartCode(row.code, book);
  if (!read.ok) throw new BudgetInputError('chart-code-unreadable', `a chart code cannot be read: ${unreadableLine(row, book, read)}`);
  return { entityId: row.entity_id, code: read.code, name: row.name, accountType: row.account_type, balanceType: row.balance_type as ReportAccount['balanceType'] };
}

export function toRoutinePlanInput(row: RoutineRow, entity: ReportEntity): RoutinePlanInput {
  return {
    id: row.id,
    name: row.name,
    entityId: entity.id,
    entityType: entity.entityType,
    timezone: row.timezone,
    scheduleRrule: row.schedule_rrule,
    startDate: row.start_date === null ? null : utcDay(row.start_date),
    endDate: row.end_date === null ? null : utcDay(row.end_date),
    budgetAmount: row.budget_amount,
    coaCode: row.coa_code,
    steps: row.steps.map((s) => ({ id: s.id, isActive: s.is_active, stepOrder: s.step_order, budgetAmount: s.budget_amount, coaCode: s.coa_code })),
  };
}

export function toTaskPlanInput(row: TaskRow, entity: ReportEntity): TaskPlanInput {
  return {
    id: row.id,
    title: row.title,
    entityId: entity.id,
    entityType: entity.entityType,
    status: row.status,
    estimatedCostUsd: row.estimated_cost_usd === null ? null : row.estimated_cost_usd.toString(),
    coaCode: row.coa_code,
    planItems: row.daily_plan_items.map((item) => ({ planDate: utcDay(item.plan_date), blocks: item.calendar_blocks.map((b) => ({ status: b.status })) })),
  };
}

const MAX = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * A ledger line → a posting on its ACCOUNT's entity (book), the account's code
 * read as saved by the one reader. BigInt cents must be a safe integer;
 * entry_type passes to the model, which refuses anything but D or C.
 */
export function toPosting(row: LedgerRow, book: ReportEntity): Posting {
  if (row.amount > MAX || row.amount < -MAX) {
    throw new BudgetInputError('unsafe-cents', `journal entry ${row.journal_entry_id} carries a ledger amount of ${row.amount} cents, past the safe integer range`);
  }
  const read = readChartCode(row.account.code, book);
  if (!read.ok) {
    throw new BudgetInputError('chart-code-unreadable', `journal entry ${row.journal_entry_id} posts to an account whose code cannot be read: ${book.name} (${book.entityType}): code ${JSON.stringify(row.account.code)} — ${refusal(read)}`);
  }
  return {
    entityId: row.account.entity_id,
    code: read.code,
    day: utcDay(row.journal_entry.date),
    entryType: row.entry_type as Posting['entryType'],
    cents: Number(row.amount),
    journalEntryId: row.journal_entry_id,
  };
}

// ── THE RESPONSE ────────────────────────────────────────────────────────────

/** Bank rows not committed to the books, in one column of the report. */
export interface NotInBooksColumn {
  readonly key: string;
  readonly label: string;
  readonly from: IsoDay;
  /** The column's last day read: min(to, asOf). Null for a future column. */
  readonly through: IsoDay | null;
  readonly state: ColumnState;
  /** The rows totalled into bankCents. Null for a future column — nothing can have happened yet. */
  readonly transactions: number | null;
  /** Σ Plaid amount in cents (outflows positive), or null when there are none. A bank figure, not a ledger one. */
  readonly bankCents: number | null;
  /** Rows in this column LEFT OUT of bankCents — listed in notTotalled. Null for a future column. */
  readonly notTotalled: number | null;
}

/**
 * A bank row whose amount is not a whole number of cents (ruled 2026-09-27,
 * ruling 10's principle): listed with its raw amount and left out of every
 * column total — never rounded into one, never hidden, never fatal.
 */
export interface BankRowNotTotalled {
  readonly id: string;
  readonly day: IsoDay;
  /** Plaid's amount exactly as stored, as text. */
  readonly amount: string;
  /** Why it is not totalled. */
  readonly detail: string;
}

export interface BudgetReportResponse {
  readonly asOf: IsoDay;
  readonly view: BudgetView;
  readonly report: BudgetReport;
  /** Routines and tasks whose money is on no line: every undated entry, and the dated ones in the view's range. */
  readonly notPlaced: readonly NotPlaced[];
  /** Costed tasks set aside by status — counted across ALL TIME, not the view. */
  readonly excludedTasks: { readonly scope: 'ALL TIME'; readonly byStatus: readonly ExcludedByStatus[] };
  readonly notInBooks: {
    readonly basis: 'bank';
    readonly sign: 'Plaid signs outflows positive';
    readonly columns: readonly NotInBooksColumn[];
    /** Every bank row in range left out of the totals, by day then id. */
    readonly notTotalled: readonly BankRowNotTotalled[];
  };
  readonly excludedLines: ExcludedLines;
  /** How many records each source gave this report. */
  readonly records: {
    readonly entities: number;
    readonly accounts: number;
    readonly routines: number;
    readonly costedTasks: number;
    readonly ledgerLines: number;
    readonly bankRows: number;
    readonly budgetLines: { readonly routine: number; readonly task: number };
  };
  readonly travelBudgets: 'not connected';
  /** TAB13-04: the day's plan — its lines and their vendors, and the stranded vendors — or, for a YEAR, why none are listed. */
  readonly plans: DayPlan;
}

function notInBooksOf(report: BudgetReport, bank: readonly BankRow[], rangeFrom: IsoDay, rangeTo: IsoDay): { columns: NotInBooksColumn[]; notTotalled: BankRowNotTotalled[] } {
  const totalled: { day: IsoDay; cents: number }[] = [];
  const notTotalled: BankRowNotTotalled[] = [];
  for (const row of bank) {
    const day = utcDay(row.date);
    // A row the query should never have returned is the route's bug — a 500, by name.
    if (day < rangeFrom || day > rangeTo || day > report.asOf) {
      throw new BudgetInputError('bank-row-outside-range', `bank transaction ${row.id} is dated ${day}, outside [${rangeFrom}, min(${rangeTo}, asOf ${report.asOf})]`);
    }
    const cents = centsFromDollars(row.amount);
    if (cents.ok) totalled.push({ day, cents: cents.cents });
    else notTotalled.push({ id: row.id, day, amount: String(row.amount), detail: cents.detail });
  }
  notTotalled.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const columns = report.columns.map((column): NotInBooksColumn => {
    if (column.state === 'future') {
      return { key: column.key, label: column.label, from: column.from, through: null, state: column.state, transactions: null, bankCents: null, notTotalled: null };
    }
    const through = column.to < report.asOf ? column.to : report.asOf;
    const inColumn = totalled.filter((r) => column.from <= r.day && r.day <= through);
    let total = 0;
    for (const r of inColumn) {
      total += r.cents;
      if (!Number.isSafeInteger(total)) throw new BudgetInputError('unsafe-cents', `the bank rows of column ${column.key} left the safe integer range of cents`);
    }
    return {
      key: column.key, label: column.label, from: column.from, through, state: column.state,
      transactions: inColumn.length,
      bankCents: inColumn.length === 0 ? null : total,
      notTotalled: notTotalled.filter((r) => column.from <= r.day && r.day <= through).length,
    };
  });
  return { columns, notTotalled };
}

/** The rows reportInputOf() turns into the model's input — what both budget routes read. */
interface InputRows<L extends LedgerRow> {
  readonly entities: readonly EntityRow[];
  readonly chart: readonly BudgetChartRow[];
  readonly routines: readonly { readonly entityId: string; readonly rows: readonly RoutineRow[] }[];
  readonly tasks: readonly TaskRow[];
  readonly ledger: readonly L[];
}

/**
 * BUDGET-02 — THE ROWS → THE MODEL'S INPUT, ONCE. The day rules place routines
 * and tasks over the view's range; every chart code is read as saved (TAB13-02c:
 * every unreadable row, and every pair of rows that are one account, refused at
 * once); every ledger line becomes a posting on its account's book. The report
 * and the drill both call this — never a second copy. postingRow maps each
 * posting the model is handed back to the row it came from.
 */
function reportInputOf<L extends LedgerRow>(view: BudgetView, rows: InputRows<L>) {
  const { rangeFrom, rangeTo } = viewRange(view);
  const entities = rows.entities.map(toReportEntity);
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const entityOf = (entityId: string, what: string): ReportEntity => {
    const entity = entityById.get(entityId);
    if (!entity) throw new BudgetInputError('unknown-entity', `${what} names entity ${entityId}, which is not one of the viewer's entities`);
    return entity;
  };

  const routineInputs = rows.routines.flatMap((group) => {
    const entity = entityOf(group.entityId, `the routines of entity ${group.entityId}`);
    return group.rows.map((row) => toRoutinePlanInput(row, entity));
  });
  const taskInputs = rows.tasks.map((row) => toTaskPlanInput(row, entityOf(row.entity_id, `task ${row.id}`)));

  const routines = buildRoutineBudgetLines(routineInputs, rangeFrom, rangeTo);
  const tasks = buildTaskBudgetLines(taskInputs, rangeFrom, rangeTo);

  // THE CHART AS SAVED (TAB13-02c) — read every row before the model sees one.
  // R3: every row the rule cannot read, named at once — never only the first.
  const readable: { row: BudgetChartRow; book: ReportEntity; code: string }[] = [];
  const unreadable: string[] = [];
  for (const row of rows.chart) {
    const book = entityOf(row.entity_id, `chart row ${JSON.stringify(row.code)}`);
    const read = readChartCode(row.code, book);
    if (read.ok) readable.push({ row, book, code: read.code });
    else unreadable.push(unreadableLine(row, book, read));
  }
  if (unreadable.length > 0) {
    throw new BudgetInputError('chart-code-unreadable', `${unreadable.length} chart code${unreadable.length === 1 ? '' : 's'} cannot be read — ${unreadable.join('; ')}`);
  }
  // R4: two rows of one book that are one account are never merged — every pair named at once.
  const byAccount = new Map<string, { row: BudgetChartRow; book: ReportEntity }[]>();
  for (const r of readable) {
    const key = `${r.book.id}\u0000${r.code}`;
    const same = byAccount.get(key);
    if (same) same.push(r);
    else byAccount.set(key, [r]);
  }
  const pairs: string[] = [];
  for (const same of byAccount.values()) {
    for (let i = 0; i < same.length; i += 1) {
      for (let j = i + 1; j < same.length; j += 1) {
        const [a, b] = [same[i], same[j]];
        pairs.push(`${a.book.name} (${a.book.entityType}): code ${JSON.stringify(a.row.code)}, ${JSON.stringify(a.row.name)} and code ${JSON.stringify(b.row.code)}, ${JSON.stringify(b.row.name)}`);
      }
    }
  }
  if (pairs.length > 0) {
    throw new BudgetInputError('chart-codes-collide', `${pairs.length} pair${pairs.length === 1 ? '' : 's'} of chart rows are one account in one book — ${pairs.join('; ')}`);
  }

  const budgetLines: BudgetLine[] = [...routines.lines, ...tasks.lines];
  const accounts: ChartAccount[] = readable.map((r) => ({ ...toReportAccount(r.row, r.book), archived: r.row.is_archived }));
  const postingRow = new Map<Posting, L>();
  const postings = rows.ledger.map((row) => {
    const posting = toPosting(row, entityOf(row.account.entity_id, `journal entry ${row.journal_entry_id}`));
    postingRow.set(posting, row);
    return posting;
  });
  // TAB13-04: a plan line's words — the routine's name and zone, each line's activity and time.
  const routineWords = new Map<string, RoutineWords>(rows.routines.flatMap((group) => group.rows.map((row): [string, RoutineWords] => [row.id, {
    name: row.name,
    timezone: row.timezone,
    steps: new Map(row.steps.map((s) => [s.id, { activity: s.activity, timeOfDay: s.time_of_day }])),
  }])));
  return { rangeFrom, rangeTo, entities, routineInputs, taskInputs, routines, tasks, budgetLines, accounts, postings, postingRow, routineWords };
}

/** The rows the route read → the response the screen reads. */
export function budgetReportResponse(query: { readonly view: BudgetView; readonly asOf: IsoDay }, rows: ReportRows): BudgetReportResponse {
  const { rangeFrom, rangeTo, entities, routineInputs, taskInputs, routines, tasks, budgetLines, accounts, postings, routineWords } = reportInputOf(query.view, rows);
  const report = buildBudgetReport({ asOf: query.asOf, view: query.view, entities, accounts, budgetLines, postings });

  // TAB13-04: the day's plan — the lines handed to the model, their words, their vendors (planLines.ts decides).
  const plans = dayPlanOf({
    view: report.view,
    lines: budgetLines,
    notPlaced: [...routines.notPlaced, ...tasks.notPlaced],
    routines: routineWords,
    tasks: new Map(rows.tasks.map((t) => [t.id, t.title])),
    vendors: rows.planVendors,
  });
  if (!plans.ok) throw new BudgetInputError(plans.code, plans.message);

  return {
    asOf: report.asOf,
    view: report.view,
    report,
    notPlaced: [...routines.notPlaced, ...tasks.notPlaced],
    excludedTasks: { scope: 'ALL TIME', byStatus: tasks.excluded },
    notInBooks: { basis: 'bank', sign: 'Plaid signs outflows positive', ...notInBooksOf(report, rows.bank, rangeFrom, rangeTo) },
    excludedLines: rows.excludedLines,
    records: {
      entities: entities.length,
      accounts: rows.chart.length,
      routines: routineInputs.length,
      costedTasks: taskInputs.length,
      ledgerLines: rows.ledger.length,
      bankRows: rows.bank.length,
      budgetLines: { routine: routines.lines.length, task: tasks.lines.length },
    },
    travelBudgets: 'not connected',
    plans: plans.plan,
  };
}

// ── THE DRILL (BUDGET-02) ───────────────────────────────────────────────────

export type CellRefusalCode = 'bad-book' | 'bad-account' | 'bad-from' | 'bad-to' | 'range-outside-one-year' | 'bad-asOf' | 'asOf-outside-window';

export interface CellRefusal {
  readonly error: CellRefusalCode;
  readonly message: string;
}

export type ParsedCellQuery =
  | { readonly ok: true; readonly book: string; readonly account: string; readonly from: IsoDay; readonly to: IsoDay; readonly asOf: IsoDay; readonly view: BudgetView }
  | { readonly ok: false; readonly refusal: CellRefusal };

const refuseCell = (error: CellRefusalCode, message: string): ParsedCellQuery => ({ ok: false, refusal: { error, message } });

/**
 * BUDGET-02 (ruling G): GET /api/budget/report/cell?book=&account=&from=&to=&asOf=
 * → the drill's query, or the first bad parameter by name. The range is one
 * calendar year, from not after to (the year's view is the model's range); asOf
 * is the viewer's local date by the report's own window (asOfWindow).
 */
export function parseCellQuery(params: { get(name: string): string | null }, serverToday: IsoDay): ParsedCellQuery {
  const window = asOfWindow(serverToday);
  const book = params.get('book');
  if (book === null || book === '') return refuseCell('bad-book', 'book is missing — the drill reads one book (book=<its id>)');
  const account = params.get('account');
  if (account === null || !/^\d{4}$/.test(account)) return refuseCell('bad-account', `account ${JSON.stringify(account)} is not the four digits of a row's code, as 5100`);
  const from = params.get('from');
  if (!isIsoDay(from)) return refuseCell('bad-from', `from ${JSON.stringify(from)} is not a 'YYYY-MM-DD' day`);
  const to = params.get('to');
  if (!isIsoDay(to)) return refuseCell('bad-to', `to ${JSON.stringify(to)} is not a 'YYYY-MM-DD' day`);
  if (from > to || from.slice(0, 4) !== to.slice(0, 4)) {
    return refuseCell('range-outside-one-year', `[${from}, ${to}] is not a range inside one calendar year — a figure on /budget is a month or the year to date`);
  }
  const asOf = params.get('asOf');
  if (!isIsoDay(asOf)) return refuseCell('bad-asOf', `asOf ${JSON.stringify(asOf)} is not a 'YYYY-MM-DD' day — it is the viewer's local date`);
  if (!window.includes(asOf)) {
    return refuseCell('asOf-outside-window', `asOf ${asOf} is not a day the viewer can be living today — it must be ${window[0]}, ${window[1]} or ${window[2]} (the server's UTC date and the days either side)`);
  }
  return { ok: true, book, account, from, to, asOf, view: { kind: 'year', year: Number(from.slice(0, 4)) } };
}

/** The words of a book the viewer does not hold — the same for a book of another person and one that does not exist (a defensive 404). */
export const UNKNOWN_BOOK_WORDS = 'this book is not one of your books';

/** BUDGET-02: the book the drill names, among the viewer's entities — or null, said by the route in UNKNOWN_BOOK_WORDS. */
export function cellBookOf(entities: readonly EntityRow[], book: string): EntityRow | null {
  return entities.find((e) => e.id === book) ?? null;
}

/** What the drill reads — every row scoped to the viewer AND the one book. */
export interface CellRows {
  /** The one book, as cellBookOf found it. */
  readonly book: EntityRow;
  /** Every chart row of the book, archived included. */
  readonly chart: readonly BudgetChartRow[];
  readonly routines: readonly RoutineRow[];
  /** The book's costed tasks, every status, each with every daily-plan item. */
  readonly tasks: readonly TaskRow[];
  /** The book's P&L ledger lines in [Jan 1, min(Dec 31, asOf)] of the year — the one actuals query. */
  readonly ledger: readonly LedgerDetailRow[];
  /** Every every-occurrence row and the occurrence rows in vendorWindowOf(the listed days). */
  readonly planVendors: readonly PlanVendorRow[];
}

/** A plan line behind the printed Budget figure. */
export interface CellPlanLine {
  readonly day: IsoDay;
  readonly source: BudgetSource;
  /** The routine's name or the task's title. */
  readonly label: string;
  /** The routine line's activity, or null. */
  readonly line: string | null;
  readonly cents: number;
  /** The vendor by the plan's one grain, or null when the plan holds none. */
  readonly vendor: string | null;
  /** A routine → /tasks · a task → /tasks?project=<its project>. */
  readonly href: string;
}

/** A ledger line behind the Actual figure. */
export interface CellLedgerLine {
  readonly day: IsoDay;
  readonly description: string;
  readonly entryType: 'D' | 'C';
  /** The line's cents, never negative. */
  readonly cents: number;
  /** In the account's normal direction: + on its normal side, − on the other — the lines sum to the Actual. */
  readonly signedCents: number;
  readonly sourceType: string;
  readonly journalEntryId: string;
  readonly lineId: string;
}

export interface BudgetCellResponse {
  readonly asOf: IsoDay;
  readonly book: { readonly id: string; readonly name: string; readonly entityType: string };
  readonly account: { readonly code: string; readonly name: string; readonly family: RowFamily; readonly archived: boolean };
  readonly range: { readonly from: IsoDay; readonly to: IsoDay; readonly state: ColumnState };
  readonly budget: {
    /** Which budget the cell prints (report.ts shownBudget). */
    readonly shown: ShownBudget;
    /** The days listed: [from, min(to, asOf)] to date, [from, to] for the full budget. */
    readonly from: IsoDay;
    readonly through: IsoDay;
    readonly lines: readonly CellPlanLine[];
    /** Σ of the lines' cents; null when there are none. */
    readonly sum: number | null;
    /** The figure the cell prints, by the model's own cell function. */
    readonly cell: number | null;
  };
  readonly actual: {
    /** The days listed: [from, min(to, asOf)]; null for a future range. */
    readonly from: IsoDay;
    readonly through: IsoDay | null;
    readonly lines: readonly CellLedgerLine[];
    /** Σ of the lines' signed cents; null when there are none. */
    readonly sum: number | null;
    readonly cell: number | null;
  };
}

const sumCents = (values: readonly number[], what: string): number | null => {
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) {
    total += v;
    if (!Number.isSafeInteger(total)) throw new BudgetInputError('unsafe-cents', `${what} left the safe integer range of cents`);
  }
  return total;
};

/**
 * BUDGET-02 (rulings E, G) — the rows the drill read → the lines behind one
 * row's figures. reportInputOf() builds the model's input exactly as the report
 * does; buildBudgetCell() selects the lines by the model's own selection; the
 * plan lines get their words and vendors from planLinesOn() over the days the
 * printed Budget figure covers. The model refuses an account that is not in the
 * book's chart, or is no row, by name (the route answers 404).
 */
export function budgetCellResponse(query: Extract<ParsedCellQuery, { ok: true }>, rows: CellRows): BudgetCellResponse {
  const input = reportInputOf(query.view, {
    entities: [rows.book],
    chart: rows.chart,
    routines: [{ entityId: rows.book.id, rows: rows.routines }],
    tasks: rows.tasks,
    ledger: rows.ledger,
  });
  const cell = buildBudgetCell(
    { asOf: query.asOf, view: query.view, entities: input.entities, accounts: input.accounts, budgetLines: input.budgetLines, postings: input.postings },
    { entityId: rows.book.id, code: query.account, from: query.from, to: query.to },
  );
  const toDate = cell.range.to < cell.asOf ? cell.range.to : cell.asOf;
  const budgetThrough = cell.shown === 'full' ? cell.range.to : toDate;

  const matched = planLinesOn({
    days: daysOf(cell.range.from, budgetThrough),
    lines: cell.budgetLines,
    routines: input.routineWords,
    tasks: new Map(rows.tasks.map((t) => [t.id, t.title])),
    vendors: rows.planVendors,
  });
  if (!matched.ok) throw new BudgetInputError(matched.code, matched.message);
  const projectOf = new Map(rows.tasks.map((t) => [t.id, t.project_id]));
  const planLines = matched.lines.map((l): CellPlanLine => {
    let href = '/tasks';
    if (l.address.kind === 'project_task') {
      const project = projectOf.get(l.address.id);
      if (project === undefined) throw new BudgetInputError('plan-line-unreadable', `plan line of task ${l.address.id} names a task the route did not read`);
      href = `/tasks?project=${encodeURIComponent(project)}`;
    }
    return { day: l.day, source: l.source, label: l.label, line: l.line, cents: l.cents, vendor: l.vendor === null ? null : l.vendor.name, href };
  });

  const account = input.accounts.find((a) => a.entityId === rows.book.id && a.code === query.account);
  if (account === undefined) throw new BudgetInputError('drill-row-missing', `account ${query.account} of book ${rows.book.id} has no chart row the route read`);
  const { balanceType } = account;
  const ledgerLines = cell.postings.map((p): CellLedgerLine => {
    const row = input.postingRow.get(p);
    if (row === undefined) throw new BudgetInputError('drill-row-missing', `a posting of journal entry ${p.journalEntryId} has no ledger row the route read`);
    return {
      day: p.day,
      description: row.journal_entry.description,
      entryType: p.entryType,
      cents: p.cents,
      signedCents: p.entryType === balanceType ? p.cents : -p.cents,
      sourceType: row.journal_entry.source_type,
      journalEntryId: p.journalEntryId,
      lineId: row.id,
    };
  }).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.lineId < b.lineId ? -1 : a.lineId > b.lineId ? 1 : 0));

  return {
    asOf: cell.asOf,
    book: { id: rows.book.id, name: rows.book.name, entityType: rows.book.entity_type },
    account: { code: cell.account.code, name: cell.account.name, family: cell.account.family, archived: cell.account.archived },
    range: cell.range,
    budget: {
      shown: cell.shown,
      from: cell.range.from,
      through: budgetThrough,
      lines: planLines,
      sum: sumCents(planLines.map((l) => l.cents), 'the drill\'s plan lines'),
      cell: cell.shown === 'full' ? cell.cell.budgetFull : cell.cell.budgetToDate,
    },
    actual: {
      from: cell.range.from,
      through: cell.range.state === 'future' ? null : toDate,
      lines: ledgerLines,
      sum: sumCents(ledgerLines.map((l) => l.signedCents), 'the drill\'s ledger lines'),
      cell: cell.cell.actual,
    },
  };
}
