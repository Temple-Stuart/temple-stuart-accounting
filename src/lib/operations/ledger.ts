/**
 * ledger — THE TASK LEDGER'S RULES, PURE (LEDGER-01, Alex, 2026-10-16: the city ledger; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger).
 *
 * Every day Alex records each stop — the vendor, the stars, a note, the budget
 * and the actual — in a city. The ledger is one table that keeps all of it:
 * one row per stop record in a period, filterable by city, country and COA,
 * with the totals and a summary over time, by place and (LEDGER-02) by book, so the most affordable
 * city is read from real data at the end of the trip.
 *
 * NOTHING NEW IS COMPUTED THAT THE DAY CARD DOES NOT ALREADY SHOW. A row's
 * BUDGET is the Budget's line matched to the record by the card's own key
 * (day/dayCard.ts matchLine: the exact instant, one line); its VENDOR the
 * matched line's, by the plan's one grain (budget/planLines.ts dayPlanOf);
 * its DESCRIPTION the card's bold name (stopName); its ACTUAL the amount alone
 * since LEDGER-02 (planDollars; until then the row's words, rowActualWords —
 * the delta is the VARIANCE column's now); its DATE the record's local day by the
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
 * RETRO-01 (Alex, 2026-10-16) — EXPENSES ONLY. The ledger is an expense ledger:
 * a record stays only when its plan's role takes money (dayCard.ts asksAmount —
 * place, none); a journal, plan, execute or all-day record leaves the rows and
 * every total, counted by role under the table (said.leftOut). The priced
 * stops past with no record are counted by the same rule.
 *
 * LEDGER-02 (Alex, 2026-10-19) — A REAL DATA TABLE. "It's really a Task Ledger,
 * not a City Ledger." Sixteen columns, one fact each, in Alex's order: DAY ·
 * DATE · CITY · COUNTRY · BOOK · ACCOUNT · ACCOUNT NAME · DESCRIPTION · VENDOR ·
 * STARS · BUDGET · ACTUAL · VARIANCE · MATCH · UNDER / OVER · NOTES. The row
 * gains two fields: `book` (the matched line's book as a word — Personal,
 * Business, Trading — from the same map accountString.ts draws the letter
 * from; null when no line matched) and `varianceCents` (actual − budget when
 * both are known, else null — never 0 for a blank). UNDER / OVER is the sign of
 * varianceCents, printed by the section. MATCH is the amount the books hold —
 * LEDGER-03's; here a column with nothing in it, said under the table. The
 * ACTUAL cell is the amount alone now (the delta moved to its own column). The
 * summary gains a BOOK group; ledgerCsv writes the rows shown as a CSV (RFC
 * 4180, CRLF, UTF-8 with no BOM) for a spreadsheet.
 *
 * LEDGER-02 AMENDMENT (Alex, 2026-10-19) — ONE MARKER, ONE TRUTH. On screen
 * every null cell prints BLANK ("—"): VARIANCE, MATCH and UNDER / OVER too; the
 * CSV keeps an EMPTY field for a null, through its own path (csvMoney, the sign
 * rule called directly), never the screen helpers' words. The VARIANCE total is
 * the COLUMN'S SUM — Σ varianceCents over the rows that carry both figures, null
 * when none does (withVariance counts them) — and the TOTAL row's tone and its
 * UNDER / OVER follow that sign; `over` and `words` (the recorded-rows
 * comparison the day card makes) stay as fields for the summary's words. The
 * coverage is said under the table (varianceCoverageWords).
 *
 * LEDGER-03 (Alex, 2026-10-19) — MATCH READS THE BOOKS' LINK. "Match — amount
 * from Books … never auto link due to risk for error." A record's Match is the
 * posting that settled it, linked BY HAND on planned_item_links (LINK-01) — the
 * link the books already hold for a routine occurrence or a line. The route
 * reads the caller's links in ONE query (ledger/route.ts); the rule joins each
 * record to its links by the record's own three fields (kind, target_id,
 * occurrence_at) = the link's (target_kind, target_id, target_instant) —
 * linkKeyOf. The row gains `address` (those three — the picker's props) and
 * `match` (matchOf: null with no link; the readable amounts summed; the
 * unreadable counted, never summed as zero). The MATCH cell prints the sum, "—"
 * with any unreadable posting (the cell's title names them) or with no link; its
 * tone is a cue — equal to ACTUAL to the cent, or not (matchState). The TOTAL
 * row's MATCH is Σ over the rows with a readable sum, its coverage said under
 * the table (matchCoverageWords, the same words rule as the variance's); the
 * CSV writes the readable sum or an empty field. The picker's words are here
 * too (LinkPicker.tsx prints them): LINK-01's list, date order, nothing
 * pre-selected, nothing ranked.
 *
 * Here: the rule (ledgerOf — the route's pure half), the period (periodOf,
 * stepAnchor, the 400-day cap), the filters, the totals and the summary (the
 * screen's pure half), the CSV (ledgerCsv, LEDGER-02), the "+ expense" form's
 * rule and bodies (RETRO-01, at the end), and the words. No fetch, no Prisma, no
 * React; the clock is handed in (now). The tests drive every rule.
 */
import { centsFromDecimalString, isIsoDay, readOccurrenceKey, type NotPlaced } from '@/lib/budget/days';
import { BLANK, formatCents } from '@/lib/budget/format';
import type { BudgetLine } from '@/lib/budget/report';
import { dayPlanOf, type PlanLine, type PlanVendorRow, type RoutineWords } from '@/lib/budget/planLines';
import { shiftDay } from '@/lib/budget/reportView';
import { deriveAccountString } from '@/lib/accountString';
import { coveringStay, placeParts, type PlaceParts, type StayRow } from '@/lib/operations/stay';
import { NEGATIVE_AMOUNT_WORDS, SKIPPED_WORD, amountWords, recordKey, refusedWords, type StopOutcome, type StopRecordRow } from '@/lib/operations/stopRecord';
import { ROLE_SHORT_WORDS, isStop, isStopRole, type StopRole } from '@/lib/operations/stopRole';
import { asksAmount, dayShortWords, dayTotals, deltaWords, planDollars, stopName } from '@/components/workbench/operations/day/dayCard';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import type { RoutineForm } from '@/components/workbench/operations/routines/types';
import type { StopBody } from '@/components/workbench/operations/stops/stopWrites';

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

/** LEDGER-02: the book as a word, from the entity type — the same map accountString.ts draws the letter from (ENTITY_LETTER: personal P, sole_prop B, trading T). */
export const BOOK_WORDS = { personal: 'Personal', sole_prop: 'Business', trading: 'Trading' } as const;
export type BookWord = (typeof BOOK_WORDS)[keyof typeof BOOK_WORDS];
/** An entity type outside the three is the database's error — thrown by name, never mapped to a guess. */
export function bookWordOf(entityType: string): BookWord {
  const word = (BOOK_WORDS as Readonly<Record<string, BookWord | undefined>>)[entityType];
  if (word === undefined) throw new Error(`ledger: entity type ${JSON.stringify(entityType)} is not one of personal, sole_prop, trading — no book word for it`);
  return word;
}

/** LEDGER-03: a link as the route read it — a record's own three fields, its posting, and the posting's amount by the one rule (postingAmount.ts amountCentsOf); null when unreadable. */
export interface LedgerLinkInput {
  readonly kind: 'routine' | 'routine_line';
  readonly targetId: string;
  /** The occurrence instant, ISO — the record's occurrence_at, byte for byte. */
  readonly instant: string;
  readonly journalEntryId: string;
  readonly amountCents: number | null;
}

export interface LedgerInput {
  readonly from: string;
  readonly to: string;
  /** The route's clock, read once — "already past" is against it. */
  readonly now: Date;
  readonly records: readonly LedgerRecordInput[];
  /** LEDGER-03: the caller's planned_item_links of a routine kind in the records' window. */
  readonly links: readonly LedgerLinkInput[];
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

/** LEDGER-03: a record's address — what a link is keyed by, and the picker's props. */
export interface LedgerAddress {
  readonly kind: 'routine' | 'routine_line';
  readonly id: string;
  readonly instant: string;
}

/** LEDGER-03: the postings linked to a record. cents: the readable amounts summed (null when none could be read); unreadable: how many carry no readable amount — never summed as zero. */
export interface LedgerMatch {
  readonly cents: number | null;
  readonly postings: number;
  readonly unreadable: number;
}

export interface LedgerRow {
  /** The record's id. */
  readonly id: string;
  /** The card's key for the record (stopRecord.ts recordKey). */
  readonly key: string;
  /** LEDGER-03: the record's own (kind, target_id, occurrence_at). */
  readonly address: LedgerAddress;
  /** LEDGER-03: the books' link, joined by address; null when no posting is linked. */
  readonly match: LedgerMatch | null;
  /** The record's local day, 'YYYY-MM-DD'. */
  readonly day: string;
  /** The stop's clock, as the card prints it (the line's own time, else the occurrence's) — the order within a day. */
  readonly time: string | null;
  /** The covering stay's place, split; null when no stay covers the day. */
  readonly place: PlaceParts | null;
  /** LEDGER-02: the matched line's book as a word; null when no line matched. */
  readonly book: BookWord | null;
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
  /** LEDGER-02: actualCents − cents when both are known; null otherwise — never 0 for a blank. */
  readonly varianceCents: number | null;
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
  /** RETRO-01: records in the period left out because their plan's role takes no money, by role. */
  readonly leftOut: Readonly<Record<NoMoneyRole, number>>;
}

/** RETRO-01: the roles that take no money (dayCard.ts asksAmount is false) — a record of one is not an expense. */
export type NoMoneyRole = Exclude<StopRole, 'place' | 'none'>;
export const NO_MONEY_ROLES: readonly NoMoneyRole[] = ['journal', 'plan', 'execute', 'all_day'];

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

/** LEDGER-03: the join key — a record's (kind, target_id, occurrence_at) and a link's (target_kind, target_id, target_instant) are the same three strings. */
export const linkKeyOf = (kind: string, id: string, instant: string): string => `${kind}:${id}:${instant}`;

/** LEDGER-03: a record's match from its links — null with none; the readable amounts summed, the unreadable counted, never summed as zero. */
export function matchOf(links: readonly Pick<LedgerLinkInput, 'amountCents'>[]): LedgerMatch | null {
  if (links.length === 0) return null;
  const readable = links.map((l) => l.amountCents).filter((c): c is number => c !== null);
  return { cents: readable.length === 0 ? null : readable.reduce((sum, c) => sum + c, 0), postings: links.length, unreadable: links.length - readable.length };
}

export function ledgerOf(input: LedgerInput): Ledger {
  const { from, to } = input;
  if (!isIsoDay(from) || !isIsoDay(to) || from > to) throw new Error(`ledger: ${JSON.stringify(from)}..${JSON.stringify(to)} is not a span of days`);
  const books = new Map(input.books.map((b) => [b.id, b]));
  // LEDGER-03: the links by the record's own key — no per-record query.
  const linksByKey = new Map<string, LedgerLinkInput[]>();
  for (const l of input.links) {
    const k = linkKeyOf(l.kind, l.targetId, l.instant);
    linksByKey.set(k, [...(linksByKey.get(k) ?? []), l]);
  }
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

  // RETRO-01: EXPENSES ONLY — a record stays when its plan's role takes money (asksAmount); the others are counted by role, never summed.
  const leftOut: Record<NoMoneyRole, number> = { journal: 0, plan: 0, execute: 0, all_day: 0 };
  const expenses = placed.filter((p) => {
    const role = p.r.role;
    if (!isStopRole(role)) throw new Error(`ledger: record ${p.r.record.id} names routine ${p.r.routineId}, whose role ${JSON.stringify(role)} is not one of the six`);
    if (asksAmount(role)) return true;
    leftOut[role as NoMoneyRole] += 1;
    return false;
  });

  // The plan lines of each day that has a record, indexed by the card's key.
  const linesByDay = new Map<string, Map<string, PlanLine[]>>();
  for (const day of new Set(expenses.map((p) => p.day))) {
    const byKey = new Map<string, PlanLine[]>();
    for (const l of dayLines(input, day)) {
      const key = lineKey(l.address);
      byKey.set(key, [...(byKey.get(key) ?? []), l]);
    }
    linesByDay.set(day, byKey);
  }

  const rows: LedgerRow[] = expenses.map(({ r, day, time }) => {
    const key = recordKey(r.record);
    const exact = linesByDay.get(day)?.get(key) ?? [];
    const line = exact.length === 1 ? exact[0] : null;
    const budgetState: BudgetState = exact.length === 1 ? 'matched' : exact.length > 1 ? 'doubled' : 'none';
    let coa: LedgerCoa | null = null;
    let bookWord: BookWord | null = null;
    if (line !== null) {
      const book = books.get(line.entityId);
      if (book === undefined) throw new Error(`ledger: line ${key} is on entity ${line.entityId}, which is not one of the user's books`);
      coa = { account: deriveAccountString({ entityType: book.entityType, code: line.code }), name: names.get(`${line.entityId}:${line.code}`) ?? null };
      // LEDGER-02: the book as a word, from the same entity type the letter is drawn from.
      bookWord = bookWordOf(book.entityType);
    }
    const stay = coveringStay(input.stays, day);
    const cents = line === null ? null : line.cents;
    const actualCents = r.record.actual_cents;
    // LEDGER-03: the record's own address, and its links by that address — byte for byte.
    const address: LedgerAddress = { kind: r.record.kind, id: r.record.target_id, instant: r.record.occurrence_at };
    return {
      id: r.record.id,
      key,
      address,
      match: matchOf(linksByKey.get(linkKeyOf(address.kind, address.id, address.instant)) ?? []),
      day,
      time: r.timeOfDay !== null ? r.timeOfDay : time,
      place: stay === null ? null : placeParts(stay.place),
      book: bookWord,
      coa,
      vendor: line !== null && line.vendor !== null ? line.vendor.name : null,
      description: line !== null ? stopName({ line: line.line, label: line.label }) : stopName({ line: r.activity, label: r.routineName }),
      rating: r.record.rating,
      note: r.record.note,
      cents,
      budgetState,
      outcome: r.record.outcome,
      actualCents,
      // LEDGER-02: arithmetic on the row's own two figures, only when both are known — never 0 for a blank.
      varianceCents: cents === null || actualCents === null ? null : actualCents - cents,
    };
  });
  // Newest day first; within a day the card's clock order: time, then the routine, then the line.
  const label = new Map(expenses.map((p) => [p.r.record.id, { label: p.r.routineName, line: p.r.activity }]));
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
    // RETRO-01: a stop whose role takes no money never records money — not an expense missing.
    if (!asksAmount(role)) continue;
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
      leftOut,
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
  /** LEDGER-02 (amended): the VARIANCE column's sum — Σ varianceCents over the rows that carry both a budget and an actual; null when no row does. Nothing summed from a blank. */
  readonly varianceCents: number | null;
  /** LEDGER-02 (amended): how many of the rows carry a variance — the n of "the n of m rows" said under the table. */
  readonly withVariance: number;
  /** LEDGER-03: the MATCH column's sum — Σ over the rows with a readable sum (readableMatchCents); null when none has one. */
  readonly matchCents: number | null;
  /** LEDGER-03: how many of the rows have a readable sum — the n of "MATCH totals the n of m rows". */
  readonly withMatch: number;
}

/** LEDGER-03: a row's match as a figure that may be summed — the sum when every linked posting was readable; null with no link, or with any unreadable posting. */
export const readableMatchCents = (match: LedgerMatch | null): number | null => (match === null || match.unreadable > 0 ? null : match.cents);

/** The card's TOTAL-row rule over the rows shown (dayTotals, reused): the records are always read here, so the spent is the actuals summed. */
export function ledgerTotals(rows: readonly LedgerRow[]): LedgerTotals {
  const actuals = rows.map((r) => r.actualCents).filter((c): c is number => c !== null);
  const totals = dayTotals({ stops: rows, spentCents: actuals.reduce((sum, c) => sum + c, 0), withActual: actuals.length }, null);
  const variances = rows.map((r) => r.varianceCents).filter((c): c is number => c !== null);
  const matches = rows.map((r) => readableMatchCents(r.match)).filter((c): c is number => c !== null);
  return {
    budgetCents: totals.budgetCents,
    actualCents: totals.actualCents,
    over: totals.over,
    words: deltaWords(totals.actualCents, totals.recordedBudgetCents).text,
    varianceCents: variances.length === 0 ? null : variances.reduce((sum, c) => sum + c, 0),
    withVariance: variances.length,
    matchCents: matches.length === 0 ? null : matches.reduce((sum, c) => sum + c, 0),
    withMatch: matches.length,
  };
}

/** LEDGER-02 (2026-10-19): a seventh group, BOOK — the row's book; rows with no book under NO_BOOK_GROUP_WORDS. */
export const GROUP_KEYS = ['day', 'week', 'month', 'city', 'country', 'coa', 'book'] as const;
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
  by === 'day' ? row.day : by === 'week' ? mondayOf(row.day) : by === 'month' ? monthOf(row.day) : by === 'book' ? bookGroupWords(row) : CELL_WORDS[by](row);
const groupLabelOf = (key: string, by: GroupKey): string => (by === 'day' ? dayShortWords(key) : by === 'week' ? weekWords(key) : by === 'month' ? monthWords(key) : key);

/** The rows shown, grouped by one selector: time groups newest first, place, COA and book groups in their words' order. */
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

/** LEDGER-02 (Alex, 2026-10-19): "It's really a Task Ledger, not a City Ledger." */
export const LEDGER_TITLE_WORDS = 'Task ledger';
/** LEDGER-02: the sixteen columns in Alex's order — one fact each, nothing combined. */
export const LEDGER_HEAD_WORDS = ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'DESCRIPTION', 'VENDOR', 'STARS', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'NOTES'] as const;
/** The money columns — right-aligned in the table. */
export const MONEY_HEAD_WORDS = ['BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH'] as const;
export const PERIOD_WORDS: Readonly<Record<PeriodKind, string>> = { month: 'Month', week: 'Week', day: 'Day', all: 'All' };
export const FILTER_WORDS: Readonly<Record<FilterKey, string>> = { city: 'CITY', country: 'COUNTRY', coa: 'COA' };
export const ALL_WORDS = 'all';
export const PREVIOUS_WORDS = '‹';
export const NEXT_WORDS = '›';
export const SUMMARY_TITLE_WORDS = 'over time, by place and by book';
export const BY_WORDS = 'by';
export const GROUP_WORDS: Readonly<Record<GroupKey, string>> = { day: 'Day', week: 'Week', month: 'Month', city: 'City', country: 'Country', coa: 'COA', book: 'Book' };
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
/** The ACTUAL cell: "skipped" adds nothing; done without an amount is "—"; else the actual ALONE (LEDGER-02: the delta is the VARIANCE column's — one fact per cell). */
export const actualCellWords = (row: Pick<LedgerRow, 'outcome' | 'actualCents' | 'cents'>): string =>
  (row.outcome === 'skipped' ? SKIPPED_WORD : row.actualCents === null ? BLANK : planDollars(row.actualCents));
/** LEDGER-02: the BOOK cell — the word, or "—" when no line matched. */
export const bookCellWords = (row: Pick<LedgerRow, 'book'>): string => (row.book === null ? BLANK : row.book);
/** LEDGER-02: the BOOK group's key for a row with no book. */
export const NO_BOOK_GROUP_WORDS = 'no account';
export const bookGroupWords = (row: Pick<LedgerRow, 'book'>): string => (row.book === null ? NO_BOOK_GROUP_WORDS : row.book);
/** LEDGER-02: the ACCOUNT cell — the code with its letter ("P-6150"), or "—"; the ACCOUNT NAME cell — the chart's name, or "—". */
export const accountCellWords = (row: Pick<LedgerRow, 'coa'>): string => (row.coa === null ? BLANK : row.coa.account);
export const accountNameCellWords = (row: Pick<LedgerRow, 'coa'>): string => (row.coa === null || row.coa.name === null ? BLANK : row.coa.name);
/** LEDGER-02: the VARIANCE cell — dollars with its sign and two decimals ("−$1.02", "+$2.00", "$0.00"); "—" when the variance is unknown (amended: ONE marker on screen), never 0. */
export const varianceCellWords = (cents: number | null): string => (cents === null ? BLANK : cents > 0 ? `+${formatCents(cents)}` : formatCents(cents));
/** LEDGER-03: the MATCH cell — the readable sum in the table's dollars; "—" with no link, or with any unreadable posting (the cell's title names them, matchCellTitle). */
export const matchCellWords = (match: LedgerMatch | null): string => planDollars(readableMatchCents(match));
export const unreadableWords = (n: number): string => `${n} posting${n === 1 ? '' : 's'} unreadable`;
export const matchCellTitle = (match: LedgerMatch | null): string | null => (match === null || match.unreadable === 0 ? null : unreadableWords(match.unreadable));
/** LEDGER-03: the cue — the readable sum against ACTUAL to the cent; null when either is unknown (no tone). */
export type MatchState = 'equal' | 'differs';
export const matchState = (match: LedgerMatch | null, actualCents: number | null): MatchState | null => {
  const cents = readableMatchCents(match);
  if (cents === null || actualCents === null) return null;
  return cents === actualCents ? 'equal' : 'differs';
};
/** LEDGER-03: the TOTAL row's MATCH — the column's sum over the rows with a readable sum, or "—". */
export const matchTotalWords = (cents: number | null): string => planDollars(cents);
export const UNDER_WORDS = 'under';
export const OVER_WORDS = 'over';
export const EVEN_WORDS = 'even';
/** The sign of a KNOWN variance as a word — the one rule the screen and the CSV both call. */
export const varianceSignWords = (varianceCents: number): string => (varianceCents < 0 ? UNDER_WORDS : varianceCents > 0 ? OVER_WORDS : EVEN_WORDS);
/** LEDGER-02: the UNDER / OVER cell — the sign of the variance as a word; "—" when the variance is unknown (amended: ONE marker on screen). */
export const underOverWords = (varianceCents: number | null): string => (varianceCents === null ? BLANK : varianceSignWords(varianceCents));
/**
 * The coverage of a column's total, said under the table — n the rows the total sums, m the rows shown. One words rule for the two
 * columns: "<HEAD> totals the 3 of 5 rows <rows>" · "<HEAD> totals all 5 rows" · n = 0: the cell is "—" and the line says so (<none>).
 */
const coverageWordsOf = (head: string, qualifiers: { readonly rows: string; readonly none: string }, n: number, m: number): string => {
  if (n < 0 || m < 0 || n > m || !Number.isInteger(n) || !Number.isInteger(m)) throw new Error(`ledger: ${n} of ${m} rows is no coverage`);
  if (n === 0) return `${head} totals none of the ${m} row${m === 1 ? '' : 's'} — ${qualifiers.none}`;
  if (n === m) return `${head} totals all ${m} row${m === 1 ? '' : 's'}`;
  return `${head} totals the ${n} of ${m} rows ${qualifiers.rows}`;
};
/** LEDGER-02 (amended): the VARIANCE total's coverage — n the rows that carry both a budget and an actual (totals.withVariance). */
export const varianceCoverageWords = (n: number, m: number): string => coverageWordsOf('VARIANCE', { rows: 'that carry both a budget and an actual', none: 'no row carries both a budget and an actual' }, n, m);
/** LEDGER-03: the MATCH total's coverage — n the rows with a readable sum (totals.withMatch); the line that replaced the LEDGER-02 note. */
export const matchCoverageWords = (n: number, m: number): string => coverageWordsOf('MATCH', { rows: 'linked to the books', none: 'no row is linked to the books' }, n, m);
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
/** RETRO-01: "2 records left out — not expenses (no money at a journal, plan or execute stop): journal 1 · plan 1". */
export const leftOutWords = (left: Readonly<Record<NoMoneyRole, number>>): string => {
  const n = NO_MONEY_ROLES.reduce((sum, role) => sum + left[role], 0);
  const parts = NO_MONEY_ROLES.filter((role) => left[role] > 0).map((role) => `${ROLE_SHORT_WORDS[role]} ${left[role]}`);
  return `${n} record${n === 1 ? '' : 's'} left out — not expenses (no money at a journal, plan or execute stop)${parts.length === 0 ? '' : `: ${parts.join(' · ')}`}`;
};
export const TODAY_RULE_WORDS = "budgets and COAs are the routines' as they stand today — editing a routine changes past rows until budget history exists";
export const EVERY_BOOK_WORDS = 'every book — the COA says which; the entity selector does not filter the ledger';

// ── LEDGER-02 (Alex, 2026-10-19): THE CSV — the rows shown, for a spreadsheet ──

const WEEKDAY_LONG_WORDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** "Saturday" — the full weekday of a 'YYYY-MM-DD' day, from its UTC parts (a calendar day, no zone). */
export const dayLongWords = (day: string): string => WEEKDAY_LONG_WORDS[new Date(utc(day)).getUTCDay()];
export const CSV_DOWNLOAD_WORDS = 'download CSV';
export const CSV_NO_ROWS_WORDS = 'no row shown — nothing to download';
/** "task-ledger_2026-10-01_2026-10-31.csv" */
export const ledgerCsvFileName = (from: string, to: string): string => `task-ledger_${from}_${to}.csv`;
/** A money field: dollars with two decimals from the integer cents, an ASCII minus, no symbol, no grouping — "10.00", "8.98", "-1.02"; null is the empty field. */
const csvMoney = (cents: number | null): string => {
  if (cents === null) return '';
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};
/** RFC 4180, minimal quoting: a field holding a comma, a quote, a CR or an LF is wrapped in quotes with its quotes doubled; any other field is written bare. */
const csvField = (text: string): string => (/[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
/**
 * The rows shown, as a CSV: the sixteen head words, then one line per row in
 * the table's order, each field the table's fact and nothing combined — DAY the
 * full weekday, DATE 'YYYY-MM-DD', the text cells as the table prints them with
 * '' where the table prints "—" (a null is an EMPTY field, never 0 or "—"),
 * STARS the number, money as dollars with two decimals (csvMoney — BUDGET,
 * ACTUAL as held whether done or skipped, VARIANCE, and MATCH — LEDGER-03: the
 * readable sum, readableMatchCents, else empty), UNDER / OVER the sign rule's word (varianceSignWords) or empty. The CSV never
 * calls the screen's cell helpers, which print "—" for a null (the amendment:
 * one marker on screen, an empty field here). Every line ends CRLF, the last
 * one too. The text is
 * UTF-8 with no BOM: the section writes it as a Blob of this string, which the
 * browser encodes as UTF-8 and prefixes with nothing. Pure: no React, no DOM.
 */
export function ledgerCsv(rows: readonly LedgerRow[]): string {
  const lines = [LEDGER_HEAD_WORDS.map(csvField).join(',')];
  for (const row of rows) {
    lines.push([
      dayLongWords(row.day),
      row.day,
      row.place === null ? '' : row.place.city,
      row.place === null || row.place.country === null ? '' : row.place.country,
      row.book ?? '',
      row.coa === null ? '' : row.coa.account,
      row.coa === null || row.coa.name === null ? '' : row.coa.name,
      row.description,
      row.vendor ?? '',
      row.rating === null ? '' : String(row.rating),
      csvMoney(row.cents),
      csvMoney(row.actualCents),
      csvMoney(row.varianceCents),
      csvMoney(readableMatchCents(row.match)),
      row.varianceCents === null ? '' : varianceSignWords(row.varianceCents),
      row.note ?? '',
    ].map(csvField).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

// ── RETRO-01 (Alex, 2026-10-16): "+ EXPENSE" ON THE LEDGER ──────────────────
//
// An expense typed on the ledger lands on that day's card: a one-off stop (the
// routine create route — cadence once, role place, ONE line, the thing itself,
// carrying the amount and the COA: a one-off is made of lines), its vendor on
// that line's occurrence when one is given (the directory route for a new
// name, then the plan-vendors route), then its record (the stops POST) — each
// through the existing route, in that order, each audited as today. The zone
// is the viewer's browser zone, shown; the stop is the day and time in it.
// Here: what the form is given (expenseInput — the first bad field named,
// nothing filled in), the bodies the routes read, and the words. A failure
// stops at its step and is said by name; nothing is retried, nothing is rolled
// back — what was written is said as written.

export const EXPENSE_FIELDS = ['day', 'time', 'name', 'amount', 'coa', 'book', 'vendor', 'actual', 'stars', 'note'] as const;
export type ExpenseField = (typeof EXPENSE_FIELDS)[number];

/** The form's draft — every box a string; vendorId '' and vendorName '' mean no vendor. */
export interface ExpenseDraft {
  readonly day: string;
  readonly time: string;
  readonly name: string;
  readonly amount: string;
  readonly coa: string;
  readonly book: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly actual: string;
  readonly stars: string;
  readonly note: string;
}
export const EMPTY_EXPENSE: ExpenseDraft = { day: '', time: '', name: '', amount: '', coa: '', book: '', vendorId: '', vendorName: '', actual: '', stars: '', note: '' };

export type ExpenseVendor = { readonly kind: 'none' } | { readonly kind: 'existing'; readonly id: string } | { readonly kind: 'new'; readonly name: string };

export interface ExpenseValues {
  readonly day: string;
  readonly time: string;
  readonly zone: string;
  /** The one-off's stop: the day and time in the zone, ISO text. */
  readonly instant: string;
  readonly name: string;
  /** The amount as typed (dollars) — the create route reads it by its own rule (planMoney). */
  readonly amount: string;
  readonly coa: string;
  readonly bookId: string;
  readonly vendor: ExpenseVendor;
  readonly actualCents: number | null;
  readonly rating: number | null;
  readonly note: string | null;
}

export type ExpenseInputResult = { readonly ok: true; readonly value: ExpenseValues } | { readonly ok: false; readonly field: ExpenseField; readonly message: string };

const refuseExpense = (field: ExpenseField, message: string): ExpenseInputResult => ({ ok: false, field, message });
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const EXPENSE_FIELD_WORDS: Readonly<Record<ExpenseField, string>> = { day: 'DAY', time: 'TIME', name: 'NAME', amount: 'AMOUNT', coa: 'COA', book: 'BOOK', vendor: 'VENDOR', actual: 'ACTUAL', stars: 'STARS', note: 'NOTE' };
export const requiredWords = (field: ExpenseField): string => `${EXPENSE_FIELD_WORDS[field]} is required`;
export const dayTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not a 'YYYY-MM-DD' day`;
export const timeTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not a time (HH:MM)`;
export const starsTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not 1 to 5`;
export const NAME_LONG_WORDS = 'NAME is at most 200 characters';
export const AMOUNT_ZERO_WORDS = 'an expense has an amount above 0';
export const VENDOR_BOTH_WORDS = 'pick a vendor or type a new name — not both';

/** Dollars typed → cents by the Budget's own rule, or the words. */
function centsOf(typed: string): { readonly ok: true; readonly cents: number } | { readonly ok: false; readonly message: string } {
  let read: ReturnType<typeof centsFromDecimalString>;
  try {
    read = centsFromDecimalString(typed);
  } catch {
    return { ok: false, message: amountWords(typed) };
  }
  if (!read.ok) return { ok: false, message: amountWords(typed) };
  if (read.cents < 0) return { ok: false, message: NEGATIVE_AMOUNT_WORDS };
  return { ok: true, cents: read.cents };
}

/**
 * The one rule for what the form is given: the day a real day; the time HH:MM;
 * the name 1–200 characters; the amount dollars above 0; the COA and the book
 * required; the vendor one of the two ways or none; the actual dollars 0 or more
 * or blank; the stars 1–5 or blank; the note trimmed or blank. The stop is the
 * day and time in the viewer's zone. The first bad field is named.
 */
export function expenseInput(draft: ExpenseDraft, zone: string): ExpenseInputResult {
  if (draft.day === '') return refuseExpense('day', requiredWords('day'));
  if (!isIsoDay(draft.day)) return refuseExpense('day', dayTypedWords(draft.day));
  if (draft.time === '') return refuseExpense('time', requiredWords('time'));
  if (!TIME_RE.test(draft.time)) return refuseExpense('time', timeTypedWords(draft.time));
  const name = draft.name.trim().replace(/\s+/g, ' ');
  if (name === '') return refuseExpense('name', requiredWords('name'));
  if (name.length > 200) return refuseExpense('name', NAME_LONG_WORDS);
  const amount = draft.amount.trim();
  if (amount === '') return refuseExpense('amount', requiredWords('amount'));
  const amountCents = centsOf(amount);
  if (!amountCents.ok) return refuseExpense('amount', amountCents.message);
  if (amountCents.cents === 0) return refuseExpense('amount', AMOUNT_ZERO_WORDS);
  const coa = draft.coa.trim();
  if (coa === '') return refuseExpense('coa', requiredWords('coa'));
  if (draft.book === '') return refuseExpense('book', requiredWords('book'));
  const vendorName = draft.vendorName.trim().replace(/\s+/g, ' ');
  if (draft.vendorId !== '' && vendorName !== '') return refuseExpense('vendor', VENDOR_BOTH_WORDS);
  const vendor: ExpenseVendor = draft.vendorId !== '' ? { kind: 'existing', id: draft.vendorId } : vendorName !== '' ? { kind: 'new', name: vendorName } : { kind: 'none' };
  let actualCents: number | null = null;
  if (draft.actual.trim() !== '') {
    const read = centsOf(draft.actual.trim());
    if (!read.ok) return refuseExpense('actual', read.message);
    actualCents = read.cents;
  }
  let rating: number | null = null;
  if (draft.stars.trim() !== '') {
    if (!/^[1-5]$/.test(draft.stars.trim())) return refuseExpense('stars', starsTypedWords(draft.stars));
    rating = Number(draft.stars.trim());
  }
  const note = draft.note.trim().replace(/\s+/g, ' ');
  return {
    ok: true,
    value: {
      day: draft.day, time: draft.time, zone, instant: zonedToInstant(draft.day, draft.time, zone).toISOString(),
      name, amount, coa, bookId: draft.book, vendor, actualCents, rating, note: note === '' ? null : note,
    },
  };
}

/** The create route's body: a one-off (cadence once on the day, at the time, in the zone), role place, one line — the thing itself, with the amount and the COA. */
export const oneOffBody = (v: ExpenseValues): RoutineForm => ({
  name: v.name, description: '', entity_id: v.bookId,
  cadence_mode: 'once', days: 'once' /* FORM-01 (2026-10-19): the form's days choice — a one-off */, weekly_byday: [], monthly_day_of_month: '1', monthly_nth: '1', monthly_weekday: 'MO', custom_rrule: '',
  byhour: v.time.slice(0, 2), byminute: v.time.slice(3, 5), timezone: v.zone,
  ideal_time_label: '', fail_threshold_minutes: '0', role: 'place',
  start_date: v.day, end_date: '', start_time: v.time, end_time: '', is_active: true,
  budget_amount: '', coa_code: '', location: '', latitude: '', longitude: '',
  lines: [{ activity: v.name, budget_amount: v.amount, coa_code: v.coa }],
});

/** The plan-vendors route's body: the vendor on the line's one occurrence. */
export const vendorBody = (v: ExpenseValues, lineId: string, vendorId: string): { readonly kind: 'routine_line'; readonly id: string; readonly instant: string; readonly vendorId: string } =>
  ({ kind: 'routine_line', id: lineId, instant: v.instant, vendorId });

/** The stops POST's body: the line's record at its occurrence — done at the stop's own instant, the actual, the stars, the note. */
export const recordBody = (v: ExpenseValues, lineId: string): StopBody =>
  ({ kind: 'routine_line', id: lineId, instant: v.instant, outcome: 'done', done_at: v.instant, actual_cents: v.actualCents, rating: v.rating, note: v.note, actual_minutes: null });

// The outcome: one line per step, each said by name.
export const EXPENSE_STEPS = ['stop', 'line', 'directory', 'vendor', 'record'] as const;
export type ExpenseStep = (typeof EXPENSE_STEPS)[number];
export type ExpenseState = 'written' | 'failed' | 'not tried' | 'not asked';
export interface ExpenseOutcome {
  readonly step: ExpenseStep;
  readonly state: ExpenseState;
  /** The route's words on a failure; '' otherwise. */
  readonly words: string;
}
export const STEP_WORDS: Readonly<Record<ExpenseStep, string>> = {
  stop: 'the one-off stop', line: "the stop's line, read back", directory: 'the vendor, added to the book', vendor: 'the vendor, on the stop', record: 'the record',
};
export const WRITTEN_WORDS = 'written';
export const NOT_TRIED_WORDS = 'not tried — stopped at the failure before it';
export const NOT_ASKED_WORDS = 'none given';
export const outcomeWords = (o: ExpenseOutcome): string =>
  `${STEP_WORDS[o.step]} — ${o.state === 'written' ? WRITTEN_WORDS : o.state === 'not tried' ? NOT_TRIED_WORDS : o.state === 'not asked' ? NOT_ASKED_WORDS : `not written: ${o.words}`}`;
/** Every step after a failure, not tried — so the list always names all five. */
export const withNotTried = (done: readonly ExpenseOutcome[]): ExpenseOutcome[] => {
  const said = new Set(done.map((o) => o.step));
  return [...done, ...EXPENSE_STEPS.filter((step) => !said.has(step)).map((step): ExpenseOutcome => ({ step, state: 'not tried', words: '' }))];
};
export const expenseLandedWords = (day: string): string => `the expense is on ${dayShortWords(day)}'s card and in the ledger`;

export const EXPENSE_WORDS = '+ expense';
export const EXPENSE_TITLE_WORDS = 'an expense on a day — a one-off stop, its vendor, its record: three writes, each said';
export const zoneWords = (zone: string): string => `times in ${zone} — your browser's zone`;
export const SAVE_EXPENSE_WORDS = 'save the expense';
export const CANCEL_EXPENSE_WORDS = 'cancel';
export const NO_VENDOR_WORDS = 'none';
export const NEW_VENDOR_WORDS = 'or a new vendor by name';
export const NO_BOOK_WORDS = 'no book — set one up in Books first';
export const VENDORS_LOADING_WORDS = 'reading the vendors…';
export const lineCountWords = (n: number): string => `the one-off came back with ${n} lines — one was written`;
export const ROUTINE_NO_ID_WORDS = 'the routine came back without its id';
export const VENDOR_NO_ID_WORDS = 'the vendor came back without its id';

// ── LEDGER-03 (Alex, 2026-10-19): THE PICKER'S WORDS — LINK-01's list, on the row ──
//
// LinkPicker.tsx prints these and nothing of its own: the linked postings with
// "unlink", the candidates as the links route answers them (date order, nothing
// pre-selected, nothing ranked, no amount closeness, no vendor match) with "link",
// and the drill panel's own sentence saying so.

export const LINK_WORDS = 'link';
export const UNLINK_WORDS = 'unlink';
export const PICKER_CANCEL_WORDS = 'cancel';
export const LINKS_LOADING_WORDS = 'reading the links…';
export const LINKED_POSTINGS_WORDS = 'linked postings';
export const NO_LINKED_POSTINGS_WORDS = 'no posting linked';
export const CANDIDATES_WORDS = 'your postings near this date';
/** The drill panel's sentence (hub/EventDetailPanel.tsx), word for word. */
export const NO_SUGGESTION_WORDS = 'In date order. Nothing is selected for you and no match is suggested — pick the one that settled this.';
export const NO_CANDIDATES_WORDS = 'No unlinked postings within the window. A posting already linked to another item is not offered.';
export const NO_READABLE_AMOUNT_WORDS = 'no readable amount';
/** A posting's amount as the books hold it, two decimals; an unreadable one is said, never shown as $0. */
export const postingAmountWords = (cents: number | null): string => (cents === null ? NO_READABLE_AMOUNT_WORDS : formatCents(cents));
export const postingDateWords = (date: string | null): string => (date === null ? BLANK : date);
