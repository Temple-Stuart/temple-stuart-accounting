/**
 * ledger — THE CITY LEDGER'S RULES, PURE (LEDGER-01, Alex, 2026-10-16).
 *
 * Every day Alex records each stop — the vendor, the stars, a note, the budget
 * and the actual — in a city. The ledger is one table that keeps all of it:
 * one row per stop record in a period, filterable by city, country and COA,
 * with the totals and a summary over time and by place, so the most affordable
 * city is read from real data at the end of the trip.
 *
 * NOTHING NEW IS COMPUTED THAT THE DAY CARD DOES NOT ALREADY SHOW. A row's
 * BUDGET is the Budget's line matched to the record by the card's own key
 * (day/dayCard.ts matchLine: the exact instant, one line); its VENDOR the
 * matched line's, by the plan's one grain (budget/planLines.ts dayPlanOf);
 * its DESCRIPTION the card's bold name (stopName); its ACTUAL the row's words
 * (rowActualWords, the delta's tone); its DATE the record's local day by the
 * stops GET's placing (the routine's own zone, instantToZoned); its CITY and
 * COUNTRY the covering stay's place through the one split (stay.ts
 * placeParts). The TOTAL row and every summary group are the card's TOTAL-row
 * rule (dayTotals), reused — never rewritten.
 *
 * SAID, NOT HIDDEN. Records no line matches, records on days no stay covers,
 * records whose zone could not be read, and priced stops already past with no
 * record are each counted by name under the table; so are the Budget's lines it
 * could not place. The budgets and COAs are the routines' as they stand today —
 * said in words, because editing a routine changes past rows until budget
 * history exists.
 *
 * Here: the rule (ledgerOf — the route's pure half), the period (periodOf,
 * stepAnchor, the 400-day cap), the filters, the totals and the summary (the
 * screen's pure half), and the words. No fetch, no Prisma, no React; the clock
 * is handed in (now). The tests drive every rule.
 */
import { isIsoDay, readOccurrenceKey, type NotPlaced } from '@/lib/budget/days';
import { BLANK } from '@/lib/budget/format';
import type { BudgetLine } from '@/lib/budget/report';
import { dayPlanOf, type PlanLine, type PlanVendorRow, type RoutineWords } from '@/lib/budget/planLines';
import { shiftDay } from '@/lib/budget/reportView';
import { deriveAccountString } from '@/lib/accountString';
import { coveringStay, placeParts, type PlaceParts, type StayRow } from '@/lib/operations/stay';
import { SKIPPED_WORD, recordKey, refusedWords, type StopOutcome, type StopRecordRow } from '@/lib/operations/stopRecord';
import { isStop, isStopRole } from '@/lib/operations/stopRole';
import { dayShortWords, dayTotals, deltaWords, planDollars, rowActualWords, stopName } from '@/components/workbench/operations/day/dayCard';
import { instantToZoned } from '@/lib/time';

// ── INPUT ───────────────────────────────────────────────────────────────────

/** A record as the route read it, with its plan's words: the routine (a line's through its step), its zone, its role, the line's activity and time. */
export interface LedgerRecordInput {
  readonly record: StopRecordRow;
  readonly routineId: string;
  readonly routineName: string;
  readonly zone: string;
  readonly role: string;
  /** The line's activity; null for a stepless routine. */
  readonly activity: string | null;
  /** The line's own time, 'HH:MM' (the loader's reading of a @db.Time), or null. */
  readonly timeOfDay: string | null;
}

/** A chart row of the user's, its code read by the one reader (budget/reportInputs.ts readChartCode). */
export interface LedgerAccount {
  readonly entityId: string;
  readonly code: string;
  readonly name: string;
}

/** One of the user's books: its id and the entity type its codes are drawn with. */
export interface LedgerBook {
  readonly id: string;
  readonly entityType: string;
}

export interface LedgerInput {
  readonly from: string;
  readonly to: string;
  /** The route's clock, read once — "already past" is against it. */
  readonly now: Date;
  readonly records: readonly LedgerRecordInput[];
  /** buildRoutineBudgetLines over [from, to] — the routines' lines as they stand today. */
  readonly lines: readonly BudgetLine[];
  readonly notPlaced: readonly NotPlaced[];
  /** The loader's routines by id — the plan lines' words (planLines.ts). */
  readonly routines: ReadonlyMap<string, RoutineWords>;
  /** Routine id → role, for the lines: an all-day line is in the plan, not a stop. */
  readonly roles: ReadonlyMap<string, string>;
  /** The caller's plan-vendor rows: every every-occurrence row, and the occurrence rows in the span's window. */
  readonly vendors: readonly PlanVendorRow[];
  readonly stays: readonly StayRow[];
  readonly accounts: readonly LedgerAccount[];
  readonly books: readonly LedgerBook[];
}

// ── OUTPUT ──────────────────────────────────────────────────────────────────

/** Why BUDGET is what it is: the one line at this stop; none of its kind, id and instant; or two (named, never one picked). */
export type BudgetState = 'matched' | 'none' | 'doubled';

export interface LedgerCoa {
  /** The code with its book's letter (accountString.ts) — "P-5100". */
  readonly account: string;
  /** The account's name when the user's chart has it. */
  readonly name: string | null;
}

export interface LedgerRow {
  /** The record's id. */
  readonly id: string;
  /** The card's key for the record (stopRecord.ts recordKey). */
  readonly key: string;
  /** The record's local day, 'YYYY-MM-DD'. */
  readonly day: string;
  /** The stop's clock, as the card prints it (the line's own time, else the occurrence's) — the order within a day. */
  readonly time: string | null;
  /** The covering stay's place, split; null when no stay covers the day. */
  readonly place: PlaceParts | null;
  readonly coa: LedgerCoa | null;
  readonly vendor: string | null;
  readonly description: string;
  readonly rating: number | null;
  readonly note: string | null;
  /** The matched line's cents — the card's BUDGET cell; null when none. */
  readonly cents: number | null;
  readonly budgetState: BudgetState;
  readonly outcome: StopOutcome;
  readonly actualCents: number | null;
}

export interface LedgerSaid {
  /** Records no budget line matches (the doubled among them counted again, by name). */
  readonly noLine: number;
  readonly doubled: number;
  readonly noStay: number;
  /** Records whose routine's zone could not be read — named with the reason, never placed in UTC. */
  readonly unplaced: readonly { readonly record: StopRecordRow; readonly detail: string }[];
  /** Priced stops planned in the period, already past, with no record. */
  readonly notRecorded: number;
  /** The Budget's routine lines in the period it could not place (days.ts NotPlaced). */
  readonly notPlaced: number;
}

export interface Ledger {
  readonly from: string;
  readonly to: string;
  /** Newest day first, then the card's clock order. */
  readonly rows: readonly LedgerRow[];
  readonly said: LedgerSaid;
}

// ── THE RULE ────────────────────────────────────────────────────────────────

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** null sorts last. */
const cmpMaybe = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : cmp(a, b));
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The card's key for a plan line — the words recordKey gives a record (`line:<step>:<instant>` · `routine:<routine>:<instant>`). */
const lineKey = (address: PlanLine['address']): string => `${address.kind === 'routine_line' ? 'line' : 'routine'}:${address.id}:${address.instant}`;

/** The day's plan lines, their words and vendors — the one rule the day card's report reads (planLines.ts), for this day. */
function dayLines(input: LedgerInput, day: string): readonly PlanLine[] {
  const plan = dayPlanOf({ view: { kind: 'day', day }, lines: input.lines, notPlaced: input.notPlaced, routines: input.routines, tasks: new Map(), vendors: input.vendors });
  if (!plan.ok) throw new Error(`ledger: ${plan.code} — ${plan.message}`);
  if (!plan.plan.listed) throw new Error(`ledger: a DAY view lists its plan lines — ${plan.plan.words}`);
  return plan.plan.lines;
}

export function ledgerOf(input: LedgerInput): Ledger {
  const { from, to } = input;
  if (!isIsoDay(from) || !isIsoDay(to) || from > to) throw new Error(`ledger: ${JSON.stringify(from)}..${JSON.stringify(to)} is not a span of days`);
  const books = new Map(input.books.map((b) => [b.id, b]));
  const names = new Map(input.accounts.map((a) => [`${a.entityId}:${a.code}`, a.name]));

  // Each record on its routine's own local day (the stops GET's placing); the window the route read is a superset of the span.
  const placed: { readonly r: LedgerRecordInput; readonly day: string; readonly time: string }[] = [];
  const unplaced: { readonly record: StopRecordRow; readonly detail: string }[] = [];
  for (const r of input.records) {
    let local: { date: string; time: string };
    try {
      local = instantToZoned(new Date(r.record.occurrence_at), r.zone);
    } catch (error) {
      unplaced.push({ record: r.record, detail: refusedWords('timezone not recognised', `${JSON.stringify(r.zone)}: ${messageOf(error)}`) });
      continue;
    }
    if (local.date < from || local.date > to) continue;
    placed.push({ r, day: local.date, time: local.time });
  }
  const seen = new Set<string>();
  for (const p of placed) {
    const key = recordKey(p.r.record);
    if (seen.has(key)) throw new Error(`ledger: two records at ${key} — the database holds one per (plan, occurrence)`);
    seen.add(key);
  }

  // The plan lines of each day that has a record, indexed by the card's key.
  const linesByDay = new Map<string, Map<string, PlanLine[]>>();
  for (const day of new Set(placed.map((p) => p.day))) {
    const byKey = new Map<string, PlanLine[]>();
    for (const l of dayLines(input, day)) {
      const key = lineKey(l.address);
      byKey.set(key, [...(byKey.get(key) ?? []), l]);
    }
    linesByDay.set(day, byKey);
  }

  const rows: LedgerRow[] = placed.map(({ r, day, time }) => {
    const key = recordKey(r.record);
    const exact = linesByDay.get(day)?.get(key) ?? [];
    const line = exact.length === 1 ? exact[0] : null;
    const budgetState: BudgetState = exact.length === 1 ? 'matched' : exact.length > 1 ? 'doubled' : 'none';
    let coa: LedgerCoa | null = null;
    if (line !== null) {
      const book = books.get(line.entityId);
      if (book === undefined) throw new Error(`ledger: line ${key} is on entity ${line.entityId}, which is not one of the user's books`);
      coa = { account: deriveAccountString({ entityType: book.entityType, code: line.code }), name: names.get(`${line.entityId}:${line.code}`) ?? null };
    }
    const stay = coveringStay(input.stays, day);
    return {
      id: r.record.id,
      key,
      day,
      time: r.timeOfDay !== null ? r.timeOfDay : time,
      place: stay === null ? null : placeParts(stay.place),
      coa,
      vendor: line !== null && line.vendor !== null ? line.vendor.name : null,
      description: line !== null ? stopName({ line: line.line, label: line.label }) : stopName({ line: r.activity, label: r.routineName }),
      rating: r.record.rating,
      note: r.record.note,
      cents: line === null ? null : line.cents,
      budgetState,
      outcome: r.record.outcome,
      actualCents: r.record.actual_cents,
    };
  });
  // Newest day first; within a day the card's clock order: time, then the routine, then the line.
  const label = new Map(placed.map((p) => [p.r.record.id, { label: p.r.routineName, line: p.r.activity }]));
  rows.sort((a, b) => cmp(b.day, a.day) || cmpMaybe(a.time, b.time) || cmp(label.get(a.id)!.label, label.get(b.id)!.label) || cmpMaybe(label.get(a.id)!.line, label.get(b.id)!.line) || cmp(a.id, b.id));

  // Priced stops planned in the period, already past, with no record — an all-day line is in the plan, not a stop (it takes no record).
  const recorded = new Set(rows.map((row) => row.key));
  const missing = new Set<string>();
  for (const l of input.lines) {
    const read = readOccurrenceKey(l.sourceId);
    if (read === null || read.routineId === null || read.address.instant === null) throw new Error(`ledger: budget line ${JSON.stringify(l.sourceId)} is no routine occurrence's key`);
    const role = input.roles.get(read.routineId);
    if (role === undefined) throw new Error(`ledger: budget line ${l.sourceId} names routine ${read.routineId}, whose role was not read`);
    if (!isStopRole(role)) throw new Error(`ledger: routine ${read.routineId} carries role ${JSON.stringify(role)} — not one of the six`);
    if (!isStop(role)) continue;
    if (read.address.instant.getTime() >= input.now.getTime()) continue;
    const key = lineKey({ kind: read.address.kind, id: read.address.id, instant: read.address.instant.toISOString() });
    if (!recorded.has(key)) missing.add(key);
  }

  return {
    from,
    to,
    rows,
    said: {
      noLine: rows.filter((row) => row.budgetState !== 'matched').length,
      doubled: rows.filter((row) => row.budgetState === 'doubled').length,
      noStay: rows.filter((row) => row.place === null).length,
      unplaced,
      notRecorded: missing.size,
      notPlaced: input.notPlaced.length,
    },
  };
}

// ── THE PERIOD ──────────────────────────────────────────────────────────────

export const PERIOD_KINDS = ['month', 'week', 'day', 'all'] as const;
export type PeriodKind = (typeof PERIOD_KINDS)[number];

export interface Period {
  readonly from: string;
  readonly to: string;
}

/** The route refuses a span past this — read by name, never clamped. */
export const LEDGER_SPAN_MAX_DAYS = 400;

const DAY_MS = 86_400_000;
const utc = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);
/** How many days a span holds, both ends counted. */
export const spanDays = (from: string, to: string): number => (utc(to) - utc(from)) / DAY_MS + 1;

/** The Monday of the week a day is in (0 = Sunday in getUTCDay). */
export const mondayOf = (day: string): string => shiftDay(day, -((new Date(utc(day)).getUTCDay() + 6) % 7));
const firstOfMonth = (day: string): string => `${day.slice(0, 7)}-01`;
const lastOfMonth = (day: string): string => {
  const [y, m] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
/** 'YYYY-MM' — the month a day is in. */
export const monthOf = (day: string): string => day.slice(0, 7);

/**
 * The period a kind and an anchor name: the anchor's calendar month, its
 * Monday-to-Sunday week, the day itself, or ALL — the first record's day to
 * today (null when nothing was recorded yet: there is no first day to start from).
 */
export function periodOf(kind: PeriodKind, anchor: string, today: string, firstRecordDay: string | null): Period | null {
  if (!isIsoDay(anchor) || !isIsoDay(today)) throw new Error(`ledger: ${JSON.stringify(anchor)} / ${JSON.stringify(today)} is not a 'YYYY-MM-DD' day`);
  if (kind === 'day') return { from: anchor, to: anchor };
  if (kind === 'week') { const monday = mondayOf(anchor); return { from: monday, to: shiftDay(monday, 6) }; }
  if (kind === 'month') return { from: firstOfMonth(anchor), to: lastOfMonth(anchor) };
  return firstRecordDay === null ? null : { from: firstRecordDay, to: today };
}

/** ‹ › : a day by one, a week by seven, a month to the first of the month before or after; ALL does not step. */
export function stepAnchor(kind: PeriodKind, anchor: string, direction: -1 | 1): string {
  if (kind === 'day') return shiftDay(anchor, direction);
  if (kind === 'week') return shiftDay(mondayOf(anchor), 7 * direction);
  if (kind === 'month') {
    const [y, m] = anchor.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + direction, 1)).toISOString().slice(0, 10);
  }
  return anchor;
}

export type SpanField = 'from' | 'to';

export type SpanResult =
  | { readonly ok: true; readonly from: string; readonly to: string }
  | { readonly ok: false; readonly field: SpanField; readonly message: string };

/** The route's two parameters: real days, in order, at most LEDGER_SPAN_MAX_DAYS — the first bad one named. */
export function spanInput(from: unknown, to: unknown): SpanResult {
  if (!isIsoDay(from)) return { ok: false, field: 'from', message: dayParamWords('from', from) };
  if (!isIsoDay(to)) return { ok: false, field: 'to', message: dayParamWords('to', to) };
  if (to < from) return { ok: false, field: 'to', message: orderWords(from, to) };
  const days = spanDays(from, to);
  if (days > LEDGER_SPAN_MAX_DAYS) return { ok: false, field: 'to', message: spanWords(days) };
  return { ok: true, from, to };
}

// ── THE FILTERS ─────────────────────────────────────────────────────────────

export const FILTER_KEYS = ['city', 'country', 'coa'] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
/** null is "all". */
export type Filters = Readonly<Record<FilterKey, string | null>>;
export const NO_FILTERS: Filters = Object.freeze({ city: null, country: null, coa: null });

/** The cell's words — what the filters choose among and what the table prints. */
export const cityWords = (row: LedgerRow): string => (row.place === null ? BLANK : row.place.city);
export const countryWords = (row: LedgerRow): string => (row.place === null || row.place.country === null ? BLANK : row.place.country);
export const coaWords = (row: LedgerRow): string => (row.coa === null ? BLANK : row.coa.name === null ? row.coa.account : `${row.coa.account} · ${row.coa.name}`);
export const CELL_WORDS: Readonly<Record<FilterKey, (row: LedgerRow) => string>> = { city: cityWords, country: countryWords, coa: coaWords };

/** The values present among the rows, each once, in order — "—" among them when a row has none. */
export const choicesOf = (rows: readonly LedgerRow[], key: FilterKey): string[] => [...new Set(rows.map(CELL_WORDS[key]))].sort((a, b) => a.localeCompare(b));

/** The rows shown: every filter that is set must match its cell's words. Nothing else changes — the totals and the summary follow these. */
export const filterRows = (rows: readonly LedgerRow[], filters: Filters): LedgerRow[] =>
  rows.filter((row) => FILTER_KEYS.every((key) => filters[key] === null || CELL_WORDS[key](row) === filters[key]));

// ── THE TOTALS AND THE SUMMARY ──────────────────────────────────────────────

export interface LedgerTotals {
  /** The BUDGET cells shown summed; null when none shows one. */
  readonly budgetCents: number | null;
  /** The actuals summed; null when no row carries one — "—", never $0. */
  readonly actualCents: number | null;
  /** The tone (dayTotals): the actual against the budgets of the rows that carry an actual. */
  readonly over: boolean | null;
  /** "▼ $3 under" · "▲ $4.25 over" · "on plan" · "—" when either figure is unknown — by the same rule. */
  readonly words: string;
}

/** The card's TOTAL-row rule over the rows shown (dayTotals, reused): the records are always read here, so the spent is the actuals summed. */
export function ledgerTotals(rows: readonly LedgerRow[]): LedgerTotals {
  const actuals = rows.map((r) => r.actualCents).filter((c): c is number => c !== null);
  const totals = dayTotals({ stops: rows, spentCents: actuals.reduce((sum, c) => sum + c, 0), withActual: actuals.length }, null);
  return { budgetCents: totals.budgetCents, actualCents: totals.actualCents, over: totals.over, words: deltaWords(totals.actualCents, totals.recordedBudgetCents).text };
}

export const GROUP_KEYS = ['day', 'week', 'month', 'city', 'country', 'coa'] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export interface LedgerGroup {
  readonly key: string;
  readonly label: string;
  /** The days the group has records on. */
  readonly days: number;
  readonly totals: LedgerTotals;
  /** The actual over the days it has records on, whole cents; null while the actual is unknown. */
  readonly perDayCents: number | null;
  /** The ratings' mean and how many stops were rated; null when none was. */
  readonly stars: { readonly average: number; readonly rated: number } | null;
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
/** "Oct 2026" */
export const monthWords = (month: string): string => MONTH_FORMAT.format(new Date(utc(`${month}-01`)));
/** "week of Mon Oct 12" */
export const weekWords = (monday: string): string => `week of ${dayShortWords(monday)}`;

const groupKeyOf = (row: LedgerRow, by: GroupKey): string =>
  by === 'day' ? row.day : by === 'week' ? mondayOf(row.day) : by === 'month' ? monthOf(row.day) : CELL_WORDS[by](row);
const groupLabelOf = (key: string, by: GroupKey): string => (by === 'day' ? dayShortWords(key) : by === 'week' ? weekWords(key) : by === 'month' ? monthWords(key) : key);

/** The rows shown, grouped by one selector: time groups newest first, place and COA groups in their words' order. */
export function ledgerSummary(rows: readonly LedgerRow[], by: GroupKey): LedgerGroup[] {
  const groups = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const key = groupKeyOf(row, by);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const byTime = by === 'day' || by === 'week' || by === 'month';
  const keys = [...groups.keys()].sort((a, b) => (byTime ? cmp(b, a) : a.localeCompare(b)));
  return keys.map((key) => {
    const members = groups.get(key) as LedgerRow[];
    const days = new Set(members.map((r) => r.day)).size;
    const totals = ledgerTotals(members);
    const ratings = members.map((r) => r.rating).filter((r): r is number => r !== null);
    return {
      key,
      label: groupLabelOf(key, by),
      days,
      totals,
      perDayCents: totals.actualCents === null ? null : Math.round(totals.actualCents / days),
      stars: ratings.length === 0 ? null : { average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length, rated: ratings.length },
    };
  });
}

// ── WORDS ───────────────────────────────────────────────────────────────────

export const LEDGER_TITLE_WORDS = 'City ledger';
export const LEDGER_HEAD_WORDS = ['DATE', 'CITY', 'COUNTRY', 'COA', 'VENDOR', 'DESCRIPTION', 'STARS', 'NOTES', 'BUDGET', 'ACTUAL'] as const;
export const PERIOD_WORDS: Readonly<Record<PeriodKind, string>> = { month: 'Month', week: 'Week', day: 'Day', all: 'All' };
export const FILTER_WORDS: Readonly<Record<FilterKey, string>> = { city: 'CITY', country: 'COUNTRY', coa: 'COA' };
export const ALL_WORDS = 'all';
export const PREVIOUS_WORDS = '‹';
export const NEXT_WORDS = '›';
export const SUMMARY_TITLE_WORDS = 'over time and by place';
export const BY_WORDS = 'by';
export const GROUP_WORDS: Readonly<Record<GroupKey, string>> = { day: 'Day', week: 'Week', month: 'Month', city: 'City', country: 'Country', coa: 'COA' };
export const SUMMARY_HEAD_WORDS = ['DAYS', 'BUDGET', 'ACTUAL', 'UNDER / OVER', 'ACTUAL PER RECORDED DAY', 'STARS'] as const;
export const TOTAL_WORDS = 'TOTAL';
export const LEDGER_LOADING_WORDS = 'reading the ledger…';
export const ledgerFailedWords = (words: string): string => `The ledger could not be read — ${words}`;
/** ALL with nothing recorded: there is no first record to start from. */
export const NO_FIRST_RECORD_WORDS = 'no stop recorded yet — ALL starts at the first record';
/** The first record's zone could not be read, so ALL has no first day. */
export const firstRecordUnplacedWords = (detail: string): string => `ALL has no first day — ${detail}`;
/** "Oct 1 – Oct 31" as the period's own words: the card's day words at both ends. */
export const periodWords = (p: Period): string => (p.from === p.to ? dayShortWords(p.from) : `${dayShortWords(p.from)} – ${dayShortWords(p.to)}`);
export const noRowsWords = (p: Period): string => `no stop recorded ${periodWords(p)}`;
export const NO_ROWS_SHOWN_WORDS = 'no row matches the filters';
/** "★★★★" — ★ × rating; a rating outside 1–5 is the database's error, never drawn. */
export function ledgerStarsWords(rating: number): string {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`ledger: a rating is 1 to 5, not ${rating}`);
  return '★'.repeat(rating);
}
/** "★ 3.8 (4 rated)" */
export const averageStarsWords = (stars: { readonly average: number; readonly rated: number }): string => `★ ${stars.average.toFixed(1)} (${stars.rated} rated)`;
/** The ACTUAL cell: "skipped" adds nothing; done without an amount is "—"; else the actual with the row's delta words (the card's). */
export const actualCellWords = (row: Pick<LedgerRow, 'outcome' | 'actualCents' | 'cents'>): string =>
  (row.outcome === 'skipped' ? SKIPPED_WORD : row.actualCents === null ? BLANK : rowActualWords(row.actualCents, row.cents));
export const starsCellWords = (rating: number | null): string => (rating === null ? BLANK : ledgerStarsWords(rating));
export const noteCellWords = (note: string | null): string => (note === null ? BLANK : note);
export const vendorCellWords = (vendor: string | null): string => (vendor === null ? BLANK : vendor);
export const budgetCellWords = (cents: number | null): string => planDollars(cents);
export const daysWords = (days: number): string => (days === 1 ? '1 day' : `${days} days`);
export const perDayWords = (cents: number | null): string => planDollars(cents);
/** The route's refusals. */
export const dayParamWords = (field: SpanField, raw: unknown): string => `${field} ${JSON.stringify(raw)} is not a 'YYYY-MM-DD' day`;
export const orderWords = (from: string, to: string): string => `to ${to} is before from ${from}`;
export const spanWords = (days: number): string => `from and to span ${days} days — at most ${LEDGER_SPAN_MAX_DAYS}`;
/** Under the table, by name and count — nothing is hidden. */
export const noLineWords = (n: number, doubled: number): string =>
  `${n} record${n === 1 ? '' : 's'} no budget line matches${doubled === 0 ? '' : ` (${doubled} with two plan lines at one stop — neither taken)`}`;
export const noStayWords = (n: number): string => `${n} record${n === 1 ? '' : 's'} on days no stay covers`;
export const unplacedWords = (list: readonly { readonly record: StopRecordRow; readonly detail: string }[]): string =>
  `${list.length} record${list.length === 1 ? '' : 's'} whose routine's zone could not be read${list.length === 0 ? '' : ` — ${list.map((u) => `${u.record.id}: ${u.detail}`).join('; ')}`}`;
export const notRecordedWords = (n: number): string => `${n} priced stop${n === 1 ? '' : 's'} planned in the period, already past, with no record`;
export const notPlacedWords = (n: number): string => `${n} routine line${n === 1 ? '' : 's'} the Budget could not place in the period (no budget here for its stops)`;
export const TODAY_RULE_WORDS = "budgets and COAs are the routines' as they stand today — editing a routine changes past rows until budget history exists";
export const EVERY_BOOK_WORDS = 'every book — the COA says which; the entity selector does not filter the ledger';
