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
 * LEDGER-04 (Alex, 2026-10-20) — THE TABLE AFTER THE FIRST READ. (1) The stop's
 * name IS the sub-account name (Brunch and Dinner under 6150 Dining Out), so
 * its column says so — SUB ACCOUNT NAME — and the record's note is the row's
 * DESCRIPTION (what was ordered); the fields keep their names (description,
 * note), the route's payload is unchanged, the CSV header follows the heads.
 * (2) Filters the sheet's way: every column filterable, several at once, and
 * sortable — not three dropdowns. ColumnFilters holds one filter per column
 * (a VALUE column: the cell words unticked, among the values present in the
 * rows loaded; a MONEY column: a min and a max in cents, inclusive, and
 * whether blank cells stay; DESCRIPTION: a contains-text, case-insensitive,
 * trimmed); applyColumnFilters is OR within a column and AND across them;
 * columnValues lists a column's distinct cell words with their counts, in the
 * column's sort order; every key is the SAME cell words the table prints, so a
 * filter matches what is seen. sortRows sorts by one column, ascending or
 * descending, blanks last in both directions (money by cents, dates by day,
 * DAY by weekday number Mon…Sun, STARS by number, text by localeCompare with
 * numeric); null is the ledger's own order. (3) The sentences under the TOTAL
 * row fold into one closed toggle — notesCount counts the lines that have
 * something to say. The three-dropdown rule (FILTER_KEYS, filterRows,
 * choicesOf) is gone with the dropdowns.
 *
 * IDIOM-01 (Alex, 2026-10-24) — THE TABLE IDIOM IS ONE SHARED COMPONENT. The
 * column kinds, the filters, the sort, the null word, the CSV's bytes and the
 * empty state left this file VERBATIM for src/lib/table/ (columns · filters ·
 * sort · csv · words), generic over a column spec { key, label, kind } — kind
 * ∈ value | money | text; `date` is not a kind, DATE sorts by its ISO text —
 * and the screen renders through components/table/DataTable.tsx. What stays
 * here is the ledger's: the sixteen columns (LEDGER_TABLE — each its words,
 * its sort key, its CSV field, its cents or its text), the row builder, the
 * totals, the summary and the CSV's file name; every function this file
 * exported keeps its name and shape by calling the idiom with that spec, and
 * the words are re-exported, so every import, every test and the CSV's bytes
 * are as they were (the DOM and CSV proofs are in the PR; idiom01.test.ts).
 *
 * TIME-03 (Alex, 2026-10-26) — WHERE THE HOURS WENT. Time is LIVE: the ledger
 * prints the minutes and the summary adds up the hours. Two columns after
 * STARS, nothing reordered — PLANNED MIN · LOGGED MIN: the day card's one
 * rule (dayCard.ts `minutes` — a line's duration_minutes; a stepless routine
 * without a window has none; WORK-03b, Alex, 2026-10-26: with one, its length —
 * the one rule, dayCard.ts plannedMinutesOf) and the record's actual_minutes
 * (dayCard.ts `actualMinutes`). The
 * record input grows additively (durationMinutes — the route reads the line's
 * duration_minutes with the record's plan words, RECORD_PLAN); the row gains
 * plannedMinutes and loggedMinutes. Both are VALUE columns: whole minutes as
 * the number alone, "—" for null, sorted as numbers, bare integers in the
 * CSV. The summary gains PLANNED HOURS · LOGGED HOURS — Σ minutes over the
 * group's rows that carry them, printed as hours to one decimal (hoursWords:
 * minutes ÷ 60, the screen's formatting only; LedgerTotals holds whole
 * minutes underneath), null when no row carries minutes — a group with none
 * says so, never 0.0 — each with its coverage said under the table
 * (plannedCoverageWords, loggedCoverageWords: the coverageWordsOf idiom, so
 * notesCount counts four coverage lines). Eighteen columns now. The journal
 * tables, the day card, the stops route and the minutes input are unchanged.
 *
 * Here: the rule (ledgerOf — the route's pure half), the period (periodOf,
 * stepAnchor, the 400-day cap), the ledger's spec and its calls into the
 * idiom's filters and sort (LEDGER-04 → IDIOM-01), the totals and the summary
 * (the screen's pure half), the CSV's fields (LEDGER_CSV, LEDGER-02 → IDIOM-01),
 * the "+ expense" form's rule and bodies (RETRO-01, at the end), and the
 * words. No fetch, no Prisma, no React; the clock is handed in (now). The
 * tests drive every rule.
 */
import { centsFromDecimalString, isIsoDay, readOccurrenceKey, type NotPlaced } from '@/lib/budget/days';
import { columnOf, type ColumnKind, type SortKey, type TableColumn } from '@/lib/table/columns';
import { csvMoney, tableCsv } from '@/lib/table/csv';
import { NO_MONEY_FILTER, NO_TEXT_FILTER, NO_VALUE_FILTER, anyFilterOn, columnValuesOf, filterOn, filterRows, rowPasses, type ColumnValue, type MoneyFilter, type TextFilter, type ValueFilter } from '@/lib/table/filters';
import { numberKey as num, sortRows as sortTableRows, textKey as text, type TableSort } from '@/lib/table/sort';
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
import { amountCentsOf, type PostingLines } from '@/lib/calendar/postingAmount';
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
  /** TIME-03: the day card's PLANNED minutes (dayCard.ts `minutes` — the one rule, plannedMinutesOf: a line's duration_minutes; WORK-03b, a stepless routine's window length); null for a line that states none, or a stepless routine without a window. */
  readonly durationMinutes: number | null;
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

/**
 * A planned_item_links row as the ledger GET reads it → the rule's input, the
 * amount by LEDGER-03's one rule (postingAmount.ts amountCentsOf). ROUTINES-03
 * (Alex, 2026-10-25): moved here from the ledger route, unchanged, so the
 * routines' month route reads a link the same way — one mapper, two routes.
 * A kind the query did not ask for, or a routine kind with no instant, is the
 * database's error, thrown by name.
 */
export function linkInputOf(row: { target_kind: string; target_id: string; target_instant: Date | null; journal_entry_id: string; journal_entry: PostingLines }): LedgerLinkInput {
  if (row.target_kind !== 'routine' && row.target_kind !== 'routine_line') throw new Error(`ledger GET: link ${row.journal_entry_id} is of kind ${JSON.stringify(row.target_kind)} — the query asked for routine or routine_line`);
  if (row.target_instant === null) throw new Error(`ledger GET: link ${row.journal_entry_id} of kind ${row.target_kind} has no instant — the migration's CHECK holds one`);
  return { kind: row.target_kind, targetId: row.target_id, instant: row.target_instant.toISOString(), journalEntryId: row.journal_entry_id, amountCents: amountCentsOf(row.journal_entry) };
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
  /** The card's bold name (stopName). LEDGER-04 (Alex, 2026-10-20): printed under SUB ACCOUNT NAME — the stop's name IS the sub-account's (numbered later, SUBACCT-01). The field keeps its name; the route's payload is unchanged. */
  readonly description: string;
  readonly rating: number | null;
  /** The record's note (280). LEDGER-04 (Alex, 2026-10-20): printed under DESCRIPTION — what was ordered. The field keeps its name. */
  readonly note: string | null;
  /** The matched line's cents — the card's BUDGET cell; null when none. */
  readonly cents: number | null;
  readonly budgetState: BudgetState;
  readonly outcome: StopOutcome;
  readonly actualCents: number | null;
  /** LEDGER-02: actualCents − cents when both are known; null otherwise — never 0 for a blank. */
  readonly varianceCents: number | null;
  /** TIME-03: PLANNED MIN — the day card's `minutes` (the one rule, dayCard.ts plannedMinutesOf: a line's duration_minutes; WORK-03b, a stepless routine's window length); null for a line that states none or a stepless routine without a window. */
  readonly plannedMinutes: number | null;
  /** TIME-03: LOGGED MIN — the record's actual_minutes (the day card's `actualMinutes`); null when none was typed at the stop. */
  readonly loggedMinutes: number | null;
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
      // TIME-03: the minutes — the day card's two rules, nothing computed: the line's duration and the record's own.
      plannedMinutes: r.durationMinutes,
      loggedMinutes: r.record.actual_minutes,
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

// ── THE CELL WORDS THE SUMMARY GROUPS BY (LEDGER-04: the three-dropdown filter that lived here is gone — the column filters below) ──

/** The cell's words — what the table prints, what the summary's place and COA groups are keyed by, and (LEDGER-04) what a column filter matches. */
export const cityWords = (row: LedgerRow): string => (row.place === null ? BLANK : row.place.city);
export const countryWords = (row: LedgerRow): string => (row.place === null || row.place.country === null ? BLANK : row.place.country);
export const coaWords = (row: LedgerRow): string => (row.coa === null ? BLANK : row.coa.name === null ? row.coa.account : `${row.coa.account} · ${row.coa.name}`);
export type CellWordsKey = 'city' | 'country' | 'coa';
export const CELL_WORDS: Readonly<Record<CellWordsKey, (row: LedgerRow) => string>> = { city: cityWords, country: countryWords, coa: coaWords };

// ── LEDGER-04 (Alex, 2026-10-20): THE COLUMNS — FILTERS THE SHEET'S WAY, AND SORT ──

/** The eighteen columns by key, in the head's order — LEDGER_HEAD_WORDS[i] is LEDGER_COLUMNS[i]'s word (headWordOf). TIME-03 (2026-10-26): plannedMinutes and loggedMinutes after stars, nothing reordered; sixteen until then. */
export const LEDGER_COLUMNS = ['day', 'date', 'city', 'country', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'stars', 'plannedMinutes', 'loggedMinutes', 'budget', 'actual', 'variance', 'match', 'underOver', 'description'] as const;
export type LedgerColumn = (typeof LEDGER_COLUMNS)[number];
/** A VALUE column filters by a checklist of its cell words; a MONEY column by a min and a max; the TEXT column by a contains-text. TIME-03: the two minutes columns are VALUE columns — whole minutes as words, sorted as numbers. */
export const VALUE_COLUMNS = ['day', 'date', 'city', 'country', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'stars', 'plannedMinutes', 'loggedMinutes', 'underOver'] as const;
export const MONEY_COLUMNS = ['budget', 'actual', 'variance', 'match'] as const;
export const TEXT_COLUMNS = ['description'] as const;
export type ValueColumn = (typeof VALUE_COLUMNS)[number];
export type MoneyColumn = (typeof MONEY_COLUMNS)[number];
export type TextColumn = (typeof TEXT_COLUMNS)[number];
export type { ColumnKind } from '@/lib/table/columns'; // IDIOM-01 (2026-10-24): the idiom's three kinds — value | money | text; `date` is none (columns.ts says why)
export const columnKind = (column: LedgerColumn): ColumnKind =>
  ((MONEY_COLUMNS as readonly string[]).includes(column) ? 'money' : (TEXT_COLUMNS as readonly string[]).includes(column) ? 'text' : 'value');
export const headWordOf = (column: LedgerColumn): string => LEDGER_HEAD_WORDS[LEDGER_COLUMNS.indexOf(column)];

/** A column's cell as the table prints it — the one key a VALUE filter matches and a checklist lists, so a filter matches what is seen; "—" (BLANK) for a blank cell. */
export function cellWordsOf(row: LedgerRow, column: LedgerColumn): string {
  switch (column) {
    case 'day': return dayLongWords(row.day);
    case 'date': return row.day;
    case 'city': return cityWords(row);
    case 'country': return countryWords(row);
    case 'book': return bookCellWords(row);
    case 'account': return accountCellWords(row);
    case 'accountName': return accountNameCellWords(row);
    case 'subAccountName': return row.description;
    case 'vendor': return vendorCellWords(row.vendor);
    case 'stars': return starsCellWords(row.rating);
    case 'plannedMinutes': return minutesCellWords(row.plannedMinutes);
    case 'loggedMinutes': return minutesCellWords(row.loggedMinutes);
    case 'budget': return budgetCellWords(row.cents);
    case 'actual': return actualCellWords(row);
    case 'variance': return varianceCellWords(row.varianceCents);
    case 'match': return matchCellWords(row.match);
    case 'underOver': return underOverWords(row.varianceCents);
    case 'description': return noteCellWords(row.note);
  }
}
/** A MONEY column's figure in cents — the CSV's own figure for the cell (ACTUAL as held whether done or skipped; MATCH the readable sum); null is a blank cell. */
export const cellCentsOf = (row: LedgerRow, column: MoneyColumn): number | null =>
  (column === 'budget' ? row.cents : column === 'actual' ? row.actualCents : column === 'variance' ? row.varianceCents : readableMatchCents(row.match));
/** The TEXT column's text — what its contains-text reads (IDIOM-01): DESCRIPTION is the record's note; null is a blank cell. */
export function cellTextOf(row: LedgerRow, column: TextColumn): string | null {
  switch (column) {
    case 'description': return row.note;
  }
}

// ── IDIOM-01 (Alex, 2026-10-24): THE FILTERS AND THE SORT ARE THE SHARED IDIOM'S ──
//
// "The table idiom becomes one shared component." The filter shapes, the filter rule (OR within a column, AND across; "(blank)" a
// value; money min/max, inclusive; a contains-text), the checklist values, the bound parser, the sort (one column, ascending then
// descending then the table's own order, blanks last both ways) and their words left for src/lib/table/ (filters.ts, sort.ts,
// words.ts, csv.ts), lifted verbatim — a second table (JOURNAL-07) reads them there. The ledger keeps what is its own: the sixteen
// columns, their cell words, what each sorts by and its CSV fields, as a spec the idiom reads (LEDGER_TABLE, with the CSV below);
// every function it exported keeps its name and its shape by calling the idiom with that spec, so the screen, the tests and the
// CSV bytes are as they were.
export type { ValueFilter, MoneyFilter, TextFilter, ColumnValue, BoundResult } from '@/lib/table/filters';
export { NO_VALUE_FILTER, NO_MONEY_FILTER, NO_TEXT_FILTER, containsNeedle, choiceWords, boundCentsOf, boundDollarsOf } from '@/lib/table/filters';
export type { SortDirection } from '@/lib/table/sort';
export type { SortKey } from '@/lib/table/columns';
export { nextSort } from '@/lib/table/sort';
/** The ledger's filters: one per column, by the column's kind — the idiom's three shapes in a typed map of eighteen (sixteen until TIME-03). */
export type ColumnFilters = { readonly [C in ValueColumn]: ValueFilter } & { readonly [C in MoneyColumn]: MoneyFilter } & { readonly [C in TextColumn]: TextFilter };
export const NO_COLUMN_FILTERS: ColumnFilters = Object.freeze({
  day: NO_VALUE_FILTER, date: NO_VALUE_FILTER, city: NO_VALUE_FILTER, country: NO_VALUE_FILTER, book: NO_VALUE_FILTER, account: NO_VALUE_FILTER, accountName: NO_VALUE_FILTER,
  subAccountName: NO_VALUE_FILTER, vendor: NO_VALUE_FILTER, stars: NO_VALUE_FILTER, plannedMinutes: NO_VALUE_FILTER, loggedMinutes: NO_VALUE_FILTER, underOver: NO_VALUE_FILTER,
  budget: NO_MONEY_FILTER, actual: NO_MONEY_FILTER, variance: NO_MONEY_FILTER, match: NO_MONEY_FILTER,
  description: NO_TEXT_FILTER,
});
/** Whether a column's filter narrows anything — the mark on its header. */
export const columnFilterOn = (filters: ColumnFilters, column: LedgerColumn): boolean => filterOn(filters, column, columnKind(column));
export const anyColumnFilterOn = (filters: ColumnFilters): boolean => anyFilterOn(LEDGER_TABLE, filters);
/** One row against every column's filter: within a VALUE column the ticks are OR (the row's cell is not among the dropped); across columns AND. */
export const rowPassesFilters = (row: LedgerRow, filters: ColumnFilters): boolean => rowPasses(row, filters, LEDGER_TABLE);
/** The rows shown, in the order given. Nothing else changes — the TOTAL row, the coverage, the summary and the CSV follow these. */
export const applyColumnFilters = (rows: readonly LedgerRow[], filters: ColumnFilters): LedgerRow[] => filterRows(rows, filters, LEDGER_TABLE);
/** The distinct values of a VALUE column among the rows loaded, each with its count, in the column's own sort order (sortRows ascending) — a blank last. */
export const columnValues = (rows: readonly LedgerRow[], column: ValueColumn): ColumnValue[] => columnValuesOf(rows, ledgerColumnOf(column));

/** One column, ascending or descending; null is the ledger's own order (newest day first, then the card's clock). */
export type LedgerSort = TableSort<LedgerColumn>;
/** Monday 1 … Sunday 7, from the day's UTC parts (a calendar day, no zone). */
export const weekdayNumber = (day: string): number => ((new Date(utc(day)).getUTCDay() + 6) % 7) + 1;
/** What a column sorts by: a number (cents, stars, the weekday Mon…Sun as 1…7), a text (localeCompare, numeric), or null for a blank cell — last in both directions. */
export function sortKeyOf(row: LedgerRow, column: LedgerColumn): SortKey {
  switch (column) {
    case 'day': return num(weekdayNumber(row.day));
    case 'date': return text(row.day);
    case 'city': return text(row.place === null ? null : row.place.city);
    case 'country': return text(row.place === null ? null : row.place.country);
    case 'book': return text(row.book);
    case 'account': return text(row.coa === null ? null : row.coa.account);
    case 'accountName': return text(row.coa === null ? null : row.coa.name);
    case 'subAccountName': return text(row.description);
    case 'vendor': return text(row.vendor);
    case 'stars': return num(row.rating);
    case 'plannedMinutes': return num(row.plannedMinutes);
    case 'loggedMinutes': return num(row.loggedMinutes);
    case 'budget': case 'actual': case 'variance': case 'match': return num(cellCentsOf(row, column));
    case 'underOver': return text(row.varianceCents === null ? null : varianceSignWords(row.varianceCents));
    case 'description': return text(row.note);
  }
}
/** The rows by one column; ties keep the order given (a stable sort), blanks last either way; null gives the rows as they came. The TOTAL row is not a row here. */
export const sortRows = (rows: readonly LedgerRow[], sort: LedgerSort | null): LedgerRow[] => sortTableRows(rows, sort, LEDGER_TABLE);

/** RETRO-01's left-out count, summed over the roles (leftOutWords prints it). */
export const leftOutTotal = (left: Readonly<Record<NoMoneyRole, number>>): number => NO_MONEY_ROLES.reduce((sum, role) => sum + left[role], 0);
/**
 * The notes under the TOTAL row that have something to say — the n of "n notes": the four coverage lines whenever a row is shown (VARIANCE,
 * MATCH, and TIME-03's PLANNED HOURS and LOGGED HOURS — two until then), and each
 * said line whose count is above 0 (no line, no stay, unplaced, not recorded, left out, not placed). The TODAY rule and the every-book
 * line are shown only when open and never counted; a line whose count is 0 is neither counted nor shown.
 */
export const notesCount = (said: LedgerSaid, shownRows: number): number =>
  [shownRows, shownRows, shownRows, shownRows, said.noLine, said.noStay, said.unplaced.length, said.notRecorded, leftOutTotal(said.leftOut), said.notPlaced].filter((n) => n > 0).length;

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
  /** TIME-03: Σ plannedMinutes over the rows that carry one — whole minutes (the summary prints hours, hoursWords); null when none does, never 0. */
  readonly plannedMinutes: number | null;
  /** TIME-03: how many of the rows carry planned minutes — the n of the PLANNED HOURS coverage line. */
  readonly withPlanned: number;
  /** TIME-03: Σ loggedMinutes over the rows that carry one — whole minutes; null when none does, never 0. */
  readonly loggedMinutes: number | null;
  /** TIME-03: how many of the rows carry logged minutes — the n of the LOGGED HOURS coverage line. */
  readonly withLogged: number;
}

/** LEDGER-03: a row's match as a figure that may be summed — the sum when every linked posting was readable; null with no link, or with any unreadable posting. */
export const readableMatchCents = (match: LedgerMatch | null): number | null => (match === null || match.unreadable > 0 ? null : match.cents);

/** The card's TOTAL-row rule over the rows shown (dayTotals, reused): the records are always read here, so the spent is the actuals summed. */
export function ledgerTotals(rows: readonly LedgerRow[]): LedgerTotals {
  const actuals = rows.map((r) => r.actualCents).filter((c): c is number => c !== null);
  const totals = dayTotals({ stops: rows, spentCents: actuals.reduce((sum, c) => sum + c, 0), withActual: actuals.length }, null);
  const variances = rows.map((r) => r.varianceCents).filter((c): c is number => c !== null);
  const matches = rows.map((r) => readableMatchCents(r.match)).filter((c): c is number => c !== null);
  // TIME-03: the minutes summed over the rows that carry them — nothing summed from a blank; null, not 0, when none does.
  const planned = rows.map((r) => r.plannedMinutes).filter((m): m is number => m !== null);
  const logged = rows.map((r) => r.loggedMinutes).filter((m): m is number => m !== null);
  return {
    budgetCents: totals.budgetCents,
    actualCents: totals.actualCents,
    over: totals.over,
    words: deltaWords(totals.actualCents, totals.recordedBudgetCents).text,
    varianceCents: variances.length === 0 ? null : variances.reduce((sum, c) => sum + c, 0),
    withVariance: variances.length,
    matchCents: matches.length === 0 ? null : matches.reduce((sum, c) => sum + c, 0),
    withMatch: matches.length,
    plannedMinutes: planned.length === 0 ? null : planned.reduce((sum, m) => sum + m, 0),
    withPlanned: planned.length,
    loggedMinutes: logged.length === 0 ? null : logged.reduce((sum, m) => sum + m, 0),
    withLogged: logged.length,
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
/**
 * LEDGER-02: the sixteen columns in Alex's order — one fact each, nothing combined. LEDGER-04 (Alex, 2026-10-20): the stop's name is
 * the SUB ACCOUNT NAME (was DESCRIPTION) and the record's note is the DESCRIPTION (was NOTES); the CSV header follows (ledgerCsv).
 * TIME-03 (Alex, 2026-10-26): eighteen — PLANNED MIN · LOGGED MIN after STARS, nothing reordered (the day card's minutes, as the row holds them).
 */
export const LEDGER_HEAD_WORDS = ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION'] as const;
/** The money columns — right-aligned in the table. */
export const MONEY_HEAD_WORDS = ['BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH'] as const;
export const PERIOD_WORDS: Readonly<Record<PeriodKind, string>> = { month: 'Month', week: 'Week', day: 'Day', all: 'All' };
// LEDGER-04 (Alex, 2026-10-20): the column filters' and the sort's words — the dropdowns' FILTER_WORDS went with them; ALL_WORDS is the checklist's "all" link now.
// IDIOM-01 (Alex, 2026-10-24): the words are src/lib/table/words.ts's — the same constants, re-exported, so the screen and the tests read them here still.
export { ALL_WORDS, NONE_WORDS, FILTER_OPEN_WORDS, FILTER_ON_MARK, SORT_MARKS, CLEAR_FILTERS_WORDS, BLANK_CHOICE_WORDS, NARROW_FROM, NARROW_WORDS, MIN_WORDS, MAX_WORDS, CONTAINS_WORDS, CLOSE_FILTER_WORDS, filterLabelWords, sortLabelWords, boundTypedWords } from '@/lib/table/words';
/** The notes toggle under the TOTAL row: "3 notes ▸" closed, "3 notes ▾" open. */
export const NOTES_CLOSED_MARK = '▸';
export const NOTES_OPEN_MARK = '▾';
export const notesToggleWords = (n: number, open: boolean): string => `${n} note${n === 1 ? '' : 's'} ${open ? NOTES_OPEN_MARK : NOTES_CLOSED_MARK}`;
export const PREVIOUS_WORDS = '‹';
export const NEXT_WORDS = '›';
export const SUMMARY_TITLE_WORDS = 'over time, by place and by book';
export const BY_WORDS = 'by';
export const GROUP_WORDS: Readonly<Record<GroupKey, string>> = { day: 'Day', week: 'Week', month: 'Month', city: 'City', country: 'Country', coa: 'COA', book: 'Book' };
/** TIME-03 (Alex, 2026-10-26): PLANNED HOURS · LOGGED HOURS after STARS — each group's minutes summed, printed as hours (hoursWords); six heads until then. */
export const SUMMARY_HEAD_WORDS = ['DAYS', 'BUDGET', 'ACTUAL', 'UNDER / OVER', 'ACTUAL PER RECORDED DAY', 'STARS', 'PLANNED HOURS', 'LOGGED HOURS'] as const;
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
export { NO_ROWS_SHOWN_WORDS } from '@/lib/table/words'; // IDIOM-01 (2026-10-24): the idiom's empty state — the table stays, the words say no row matches
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
/** TIME-03: the hours' coverage — n the rows that carry the minutes (totals.withPlanned / totals.withLogged), m the rows shown; the one words rule. */
export const plannedCoverageWords = (n: number, m: number): string => coverageWordsOf('PLANNED HOURS', { rows: 'that carry planned minutes', none: 'no row carries planned minutes' }, n, m);
export const loggedCoverageWords = (n: number, m: number): string => coverageWordsOf('LOGGED HOURS', { rows: 'that carry logged minutes', none: 'no row carries logged minutes' }, n, m);
/** TIME-03: a minutes cell — whole minutes as the number alone ("45"); "—" for null. A fractional or negative figure is the database's error (the migration's CHECK holds a day), never drawn. */
export const minutesCellWords = (minutes: number | null): string => {
  if (minutes === null) return BLANK;
  if (!Number.isInteger(minutes) || minutes < 0) throw new Error(`ledger: minutes are a whole number of minutes, not ${minutes}`);
  return String(minutes);
};
/** TIME-03: hours to one decimal from whole minutes — "0.8" for 45, "1.0" for 60 (minutes ÷ 60, the screen's formatting only; the figure underneath stays minutes); "—" for null — a group with no minutes says so, never 0.0. */
export const hoursWords = (minutes: number | null): string => (minutes === null ? BLANK : (minutes / 60).toFixed(1));
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
  const n = leftOutTotal(left);
  const parts = NO_MONEY_ROLES.filter((role) => left[role] > 0).map((role) => `${ROLE_SHORT_WORDS[role]} ${left[role]}`);
  return `${n} record${n === 1 ? '' : 's'} left out — not expenses (no money at a journal, plan or execute stop)${parts.length === 0 ? '' : `: ${parts.join(' · ')}`}`;
};
export const TODAY_RULE_WORDS = "budgets and COAs are the routines' as they stand today — editing a routine changes past rows until budget history exists";
export const EVERY_BOOK_WORDS = 'every book — the COA says which; the entity selector does not filter the ledger';

// ── LEDGER-02 (Alex, 2026-10-19): THE CSV — the rows shown, for a spreadsheet ──

const WEEKDAY_LONG_WORDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** "Saturday" — the full weekday of a 'YYYY-MM-DD' day, from its UTC parts (a calendar day, no zone). */
export const dayLongWords = (day: string): string => WEEKDAY_LONG_WORDS[new Date(utc(day)).getUTCDay()];
// IDIOM-01 (Alex, 2026-10-24): the CSV's bytes — the money field, the quoting, the CRLF lines — are src/lib/table/csv.ts's (csvMoney,
// csvField, csvText, tableCsv) and the button's words words.ts's. What stays is the ledger's: which fact each column writes (LEDGER_CSV),
// and the spec the idiom reads (LEDGER_TABLE).
export { CSV_DOWNLOAD_WORDS, CSV_NO_ROWS_WORDS } from '@/lib/table/words';
/** "task-ledger_2026-10-01_2026-10-31.csv" */
export const ledgerCsvFileName = (from: string, to: string): string => `task-ledger_${from}_${to}.csv`;
/**
 * The CSV's field for each column — the table's fact and nothing combined: DAY the full weekday, DATE 'YYYY-MM-DD', the text cells as the
 * table prints them with '' where the table prints "—" (a null is an EMPTY field, never 0 or "—"), STARS the number, money as dollars with
 * two decimals (csvMoney — BUDGET, ACTUAL as held whether done or skipped, VARIANCE, and MATCH — LEDGER-03: the readable sum,
 * readableMatchCents, else empty), UNDER / OVER the sign rule's word (varianceSignWords) or empty. Never the screen's cell helpers, which
 * print "—" for a null (the amendment: one marker on screen, an empty field here). Pure: no React, no DOM.
 */
export const LEDGER_CSV: Readonly<Record<LedgerColumn, (row: LedgerRow) => string>> = {
  day: (row) => dayLongWords(row.day),
  date: (row) => row.day,
  city: (row) => row.place === null ? '' : row.place.city,
  country: (row) => row.place === null || row.place.country === null ? '' : row.place.country,
  book: (row) => row.book ?? '',
  account: (row) => row.coa === null ? '' : row.coa.account,
  accountName: (row) => row.coa === null || row.coa.name === null ? '' : row.coa.name,
  subAccountName: (row) => row.description,
  vendor: (row) => row.vendor ?? '',
  stars: (row) => row.rating === null ? '' : String(row.rating),
  // TIME-03: whole minutes as bare integers; a null is an EMPTY field.
  plannedMinutes: (row) => row.plannedMinutes === null ? '' : String(row.plannedMinutes),
  loggedMinutes: (row) => row.loggedMinutes === null ? '' : String(row.loggedMinutes),
  budget: (row) => csvMoney(row.cents),
  actual: (row) => csvMoney(row.actualCents),
  variance: (row) => csvMoney(row.varianceCents),
  match: (row) => csvMoney(readableMatchCents(row.match)),
  underOver: (row) => row.varianceCents === null ? '' : varianceSignWords(row.varianceCents),
  description: (row) => row.note ?? '',
};
/**
 * IDIOM-01 (Alex, 2026-10-24): THE LEDGER'S SPEC for the shared idiom (src/lib/table/columns.ts TableColumn) — the columns (eighteen since TIME-03, sixteen until then) in the
 * head's order, each its head word, its kind (columnKind), its cell words (cellWordsOf — what a filter matches and a checklist lists), what
 * it sorts by (sortKeyOf), its CSV field (LEDGER_CSV), and by kind its cents (cellCentsOf) or its text (cellTextOf). Built here, after the
 * words and the CSV fields it reads; every rule the ledger exports calls the idiom with it.
 */
export const LEDGER_TABLE: readonly TableColumn<LedgerRow, LedgerColumn>[] = LEDGER_COLUMNS.map((key): TableColumn<LedgerRow, LedgerColumn> => {
  const base = { key, label: headWordOf(key), words: (row: LedgerRow) => cellWordsOf(row, key), sortKey: (row: LedgerRow) => sortKeyOf(row, key), csv: LEDGER_CSV[key] };
  switch (columnKind(key)) {
    case 'money': return { ...base, kind: 'money', cents: (row) => cellCentsOf(row, key as MoneyColumn) };
    case 'text': return { ...base, kind: 'text', text: (row) => cellTextOf(row, key as TextColumn) };
    case 'value': return { ...base, kind: 'value' };
  }
});
/** The ledger's column of the spec, by key. */
export const ledgerColumnOf = (column: LedgerColumn): TableColumn<LedgerRow, LedgerColumn> => columnOf(LEDGER_TABLE, column);
/**
 * The rows shown, as a CSV — the idiom's writer over the ledger's spec (csv.ts tableCsv): the head words (eighteen since TIME-03), then one line per row
 * in the table's order, each field LEDGER_CSV's; RFC 4180 with minimal quoting (a field holding a comma, a quote, a CR or an LF is
 * quoted, its quotes doubled); every line ends CRLF, the last one too; UTF-8 with no BOM (the screen writes it as a Blob of this string).
 */
export function ledgerCsv(rows: readonly LedgerRow[]): string {
  return tableCsv(LEDGER_TABLE, rows);
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

/** LEDGER-04 (Alex, 2026-10-20): the stop's name is the SUB ACCOUNT NAME and the note the DESCRIPTION — the ledger's own heads; the fields keep their names. */
export const EXPENSE_FIELD_WORDS: Readonly<Record<ExpenseField, string>> = { day: 'DAY', time: 'TIME', name: 'SUB ACCOUNT NAME', amount: 'AMOUNT', coa: 'COA', book: 'BOOK', vendor: 'VENDOR', actual: 'ACTUAL', stars: 'STARS', note: 'DESCRIPTION' };
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
