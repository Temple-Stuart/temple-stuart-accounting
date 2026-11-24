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
 * the one rule, supersession.ts plannedMinutesOf — SUPERSEDE-01a, 2026-11-07) and the record's actual_minutes
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
 * TIMESHEET-01 (Alex, 2026-11-24) — THE TIME SHEET, PART ONE: EVERY PRICED LINE
 * OF THE PERIOD, PLANNED AND RECORDED. "its so much more than trip sheet... this is just all time sheet...."
 * "I can even add in recurring expenses here, right???? like on date... all day, no time..."
 * "i think this master table can basically connect with the expenses tab.... where if something is added there, it adds here... and vice versa..."
 * The table stops being a list of what was recorded and becomes the sheet of
 * what was planned on Expenses, with what was recorded on it. ADDITIVE — the
 * old list stays: `rows` is as it was (one row per recorded expense, newest day
 * first, RETRO-01's rule; /api/home-ledger reads it), and the rule gains ONE
 * list, `sheet`, the table's rows. For every day of the span, every plan line
 * of that day (dayLines — the rule's own reader, read once a day) whose
 * routine's role asks an amount (asksAmount — place, none) or is all day; a
 * line of a role that takes no money (journal, plan, execute) is not listed,
 * priced or not — RETRO-01's rule, as the not-recorded count applies it. A
 * recorded expense whose key names exactly one plan line ('matched') is printed
 * on that line's row — the row of `rows` itself, its cells unchanged; one whose
 * key names no line, or two ('none', 'doubled'), is its own sheet row, and the
 * lines it could not be joined to are rows without a record. Every other line
 * carries the plan and nulls (LedgerPlanRow). Nothing recorded leaves the
 * table; no record is printed twice. An all-day line (a charge on a date) is a
 * row on its day and takes no record, as before. MATCH and "link" stand on
 * every row: a link is keyed on an occurrence, not on a record.
 *   Three facts, three columns, each beside the fact it extends — twenty-one
 * now: START and END after DATE, WENT after VENDOR. START is 'all day' on an
 * all-day line (work.ts ALL_DAY_WORDS, the one word), else the row's clock by
 * the rule `rows` uses for `time` (the line's own time, else the occurrence's
 * local time in the routine's zone). END is START plus the planned minutes,
 * the clock wrapping past midnight; blank on an all-day line or when the
 * minutes are not stated. WENT is went (the record is done) · skipped ·
 * planned (no record; the occurrence is at or after the clock handed in) ·
 * not recorded (no record; before it) · blank on an all-day line. All three
 * are VALUE columns; START and END sort by the clock, 'all day' first. The
 * sheet's own order is the day ascending, then the all-day rows, then the
 * clock (blank last), the routine's name, the line's activity, the key.
 *   The planned minutes of a line with no record are the one rule's
 * (supersession.ts plannedMinutesOf — a line's duration_minutes, a routine's
 * window length), handed in by plan (LedgerInput.minutes, planMinutesOf over
 * the routines the loader read): no query added. NO NEW ARITHMETIC: the TOTAL
 * row is ledgerTotals over the rows shown, as it stood — its BUDGET the
 * period's whole plan, its ACTUAL what was logged, its VARIANCE and UNDER /
 * OVER the rows that carry both, the coverage said under the table. The
 * summary's DAYS count only the days that carry a record, and ACTUAL PER
 * RECORDED DAY divides by those — never by a planned day. Every note under the
 * table keeps its rule and its words. The title reads 'Time sheet' and the CSV
 * is time-sheet_<from>_<to>.csv; no file, component, route, function or
 * attribute is renamed. NOT HERE: a stop with no amount (the Budget lists
 * nothing for a routine with no money — days.ts), a stop whose role takes no
 * money, filling a row in place.
 *
 * TIMESHEET-03 (Alex, 2026-11-24) — THE TIME SHEET'S LOOK: TODAY FIRST, PILLS, THE TINT.
 * "also we made it look like this before, i want this style table for sure...."
 * "the only thing that i see here is the COA column in the table, this would be great to include to how it SHOULD look..."
 * Nothing is renamed, moved, added or removed: the twenty-one columns, their
 * heads, their order, every cell's words, the filters, the sort, the totals,
 * the notes, the summary and the CSV's bytes are as they were — the COA columns
 * stay where they are. What changes is how the table is drawn, and this file
 * holds what it is drawn by.
 *   THE PILLS. BOOK and ACCOUNT NAME print their words in the app's pill
 * (PILL_CLASS — the shape of projects/TaskRowView.tsx's). A book's tone is by
 * its word (BOOK_TONES, one for each word of BOOK_WORDS). An account's tone is
 * by its PLACE (accountPlacesOf): the accounts the caller's ACTIVE plans use —
 * each routine's own code and each of its active lines' codes, a null code
 * skipped — as the label the ACCOUNT cell prints (accountString.ts
 * deriveAccountString over the routine's book and the code), distinct, in
 * ascending order of that label by plain code-unit comparison, no locale; each
 * takes its place, 0, 1, 2 … Its tone is the wheel's at that place
 * (ACCOUNT_TONES, thirteen), the wheel repeating after its last; an account no
 * active plan uses takes the neutral tone (NEUTRAL_TONE). So a tone does not
 * change with the period shown, and no two accounts share one until the plans
 * use more than thirteen. The places are built from the routines the loader
 * already read (ledgerAnswer.ts hands them in, as it hands planMinutesOf its —
 * no query added) and ride the answer as ONE key, `tones`, after `sheet`.
 * ledgerOf, `rows`, `sheet` and every row's own fields are as they were. Every
 * class string — the pill, the thirteen, the neutral, the three books' — is
 * typed WHOLE here: tailwind.config.ts scans src/lib, and a class assembled
 * from parts is never compiled.
 *   THE TINT'S WORDS. The four cells nobody types on a row — BUDGET, VARIANCE,
 * MATCH, UNDER / OVER — are tinted by the section, and one line above the table
 * says what the tint means (NOT_TYPED_WORDS). TODAY FIRST is the section's
 * alone: its period starts on Day.
 *
 * TIMESHEET-02 (Alex, 2026-11-24) — THE TIME SHEET, PART TWO: RECORD ON THE ROW.
 * "Id love to make sure I can add in the spending details into the time tab, and can cut out the spread sheets."
 * "can we build it, and once its built, we can make adjustments as needed?"
 * A row of the sheet takes its record where it is drawn — went or skipped, what
 * was paid, the stars, the minutes, what he had, the vendor — through the
 * writers that already exist (stops/stopWrites.ts; the stops routes stay the
 * authority). WHICH ROWS TAKE ONE is decided here, from what the rule already
 * holds, by the stops route's own refusals. Every recorded row takes one: it is
 * edited or cleared there. A plan row takes one unless its line is all day
 * (stopRole.ts NOT_A_STOP_RECORD_WORDS), or it is a routine's own line while
 * that routine has an active line (stopRecord.ts LINES_WORDS), or its address
 * is not its alone — a recorded expense that could not be joined to one line
 * holds its key, or another plan line of the sheet stands at the same (kind,
 * id, instant). The count decides, never a "#n" in a key: the first of two
 * lines at one stop keeps the bare key and takes none either. WENT on a plan
 * row that takes none is blank — the all-day blank's rule, now all three
 * causes'; 'planned' and 'not recorded' are for the rows that take one.
 *   WHAT THE FORM IS GIVEN RIDES THE ONE ANSWER — no read when a form opens. The
 * rule gains ONE key, `recording`, after `sheet`: an object keyed by the sheet
 * row's key, one entry for every row of the sheet (LedgerRecording). A row that
 * takes none: { takes: false, words } — the cause's one sentence. A row that
 * takes one: { takes: true, plannedAt, held, vendor } — the stop's planned
 * instant by the day card's own rule (dayCard.ts dayStops: a line whose step
 * states a time of day → that clock on the row's day in the routine's zone;
 * else the occurrence's instant itself), the row's record as the stops GET
 * answers it (or null), and the day card's own vendor slot (dayCard.ts
 * VendorSlot): the plan line as the Budget holds it, or the reason a recorded
 * row has no line to plan on. `rows` and every row's own fields are as they
 * were — nothing is added to LedgerRow — and LedgerInput gains nothing: the
 * rule already holds the lines, the records, the routines' zones and each
 * line's time.
 *   THE RULE THE FORM SAVES BY is here too, after "+ expense" (recordDraftOf,
 * recordInput): went | skipped and four boxes, every box a string; the body is
 * the stops POST's at the row's own address. A first went from the sheet is
 * done at the stop's planned instant, as "+ expense" records it; an edit keeps
 * the held record's own done time, which the sheet has no box for — neither
 * stands in for the other. A stop still ahead of the clock handed in (past the
 * route's own skew) is refused before the write. A blank box is null, never 0.
 *   THE REVIEW'S FIXES TO TIMESHEET-01. The all-day word is stopRole.ts's
 * (ROLE_SHORT_WORDS.all_day): this file no longer imports work.ts, which reads
 * the same word there, so it is typed once and the two files no longer import
 * each other. The notes that count rows count the rows the table lists — the
 * sheet's rows as the rule built them, whatever a filter hides: the rows that
 * read 'not recorded' (the separate count over the budget lines is gone), the
 * rows on a day no stay covers, and the reversed postings their MATCH left
 * out. The notes about records and lines (no line, doubled, unplaced, left
 * out, not placed) keep their rules and their words. Two plan lines at one
 * stop no longer read 'not recorded'.
 *
 * Here: the rule (ledgerOf — the route's pure half), the period (periodOf,
 * stepAnchor, the 400-day cap), the ledger's spec and its calls into the
 * idiom's filters and sort (LEDGER-04 → IDIOM-01), the totals and the summary
 * (the screen's pure half), the CSV's fields (LEDGER_CSV, LEDGER-02 → IDIOM-01),
 * the "+ expense" form's rule and bodies (RETRO-01, at the end), the record
 * form's rule and body after it (TIMESHEET-02), the pills' classes and tones
 * (TIMESHEET-03, after the inputs' mappers), and the words. No fetch, no
 * Prisma, no React; the clock is handed in (now). The tests drive every rule.
 */
import { centsFromDecimalString, isIsoDay, type NotPlaced, type RoutinePlanInput } from '@/lib/budget/days';
import { columnOf, type ColumnKind, type SortKey, type TableColumn } from '@/lib/table/columns';
import { csvMoney, tableCsv } from '@/lib/table/csv';
import { NO_MONEY_FILTER, NO_TEXT_FILTER, NO_VALUE_FILTER, anyFilterOn, columnValuesOf, filterOn, filterRows, rowPasses, type ColumnValue, type MoneyFilter, type TextFilter, type ValueFilter } from '@/lib/table/filters';
import { numberKey as num, sortRows as sortTableRows, textKey as text, type TableSort } from '@/lib/table/sort';
import { BLANK, formatCents } from '@/lib/budget/format';
import { markLines, type BudgetLine } from '@/lib/budget/report';
import { dayPlanOf, daysOf, type PlanLine, type PlanVendorRow, type RoutineWords } from '@/lib/budget/planLines';
import { shiftDay } from '@/lib/budget/reportView';
import { deriveAccountString } from '@/lib/accountString';
import { coveringStay, placeParts, type PlaceParts, type StayRow } from '@/lib/operations/stay';
import { DONE_AT_SKEW_MS, LINES_WORDS, MINUTES_MAX, NEGATIVE_AMOUNT_WORDS, NOTE_MAX, NOT_RECORDED_WORDS, RATING_WORDS, SKIPPED_WORD, SKIP_REASON_WORDS, amountWords, minutesTypedWords, recordKey, refusedWords, type StopOutcome, type StopRecordRow } from '@/lib/operations/stopRecord';
import { NOT_A_STOP_RECORD_WORDS, ROLE_SHORT_WORDS, isStop, isStopRole, type StopRole } from '@/lib/operations/stopRole';
// TIMESHEET-01 (2026-11-24): the planned minutes by the one rule (a pure leaf) and the clock's arithmetic (the calendar's minutesOf, the rule helpers' clockWords — reused,
// not rebuilt). TIMESHEET-02 (2026-11-24): the one all-day word is stopRole.ts's (ROLE_SHORT_WORDS.all_day, above) — this file imports nothing from work.ts, which reads it there too.
import { plannedMinutesOf } from '@/lib/operations/supersession';
import { clockWords } from '@/lib/operations/rruleHelpers';
import { minutesOf } from '@/lib/calendar/day';
import { asksAmount, dayShortWords, dayTotals, deltaWords, planDollars, stopName } from '@/components/workbench/operations/day/dayCard';
// TIMESHEET-02 (2026-11-24): the day card's own vendor slot — the shape a row's record form is handed (a type; nothing of the card runs here).
import type { VendorSlot } from '@/components/workbench/operations/day/dayCard';
import { instantToZoned, zonedToInstant } from '@/lib/time';
import { amountCentsOf, isReversedPosting, type LinkedPostingRow } from '@/lib/calendar/postingAmount';
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
  /** TIME-03: the day card's PLANNED minutes (dayCard.ts `minutes` — the one rule, supersession.ts plannedMinutesOf, SUPERSEDE-01a 2026-11-07: a line's duration_minutes; WORK-03b, a stepless routine's window length); null for a line that states none, or a stepless routine without a window. */
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
  /** LINK-LAW-01 (ruling C): the posting is a reversal or was reversed (postingAmount.ts isReversedPosting) — it pays nothing. */
  readonly reversed: boolean;
}

/**
 * A planned_item_links row as the ledger GET reads it → the rule's input, the
 * amount by LEDGER-03's one rule (postingAmount.ts amountCentsOf). ROUTINES-03
 * (Alex, 2026-10-25): moved here from the ledger route, unchanged, so the
 * routines' month route reads a link the same way — one mapper, two routes.
 * A kind the query did not ask for, or a routine kind with no instant, is the
 * database's error, thrown by name. LINK-LAW-01 (Alex, 2026-10-28, ruling C): the
 * routes select the posting's reversal state too (LINKED_POSTING_SELECT), and the
 * link says whether it was reversed — matchOf leaves a reversed one out.
 */
export function linkInputOf(row: { target_kind: string; target_id: string; target_instant: Date | null; journal_entry_id: string; journal_entry: LinkedPostingRow }): LedgerLinkInput {
  if (row.target_kind !== 'routine' && row.target_kind !== 'routine_line') throw new Error(`ledger GET: link ${row.journal_entry_id} is of kind ${JSON.stringify(row.target_kind)} — the query asked for routine or routine_line`);
  if (row.target_instant === null) throw new Error(`ledger GET: link ${row.journal_entry_id} of kind ${row.target_kind} has no instant — the migration's CHECK holds one`);
  return { kind: row.target_kind, targetId: row.target_id, instant: row.target_instant.toISOString(), journalEntryId: row.journal_entry_id, amountCents: amountCentsOf(row.journal_entry), reversed: isReversedPosting(row.journal_entry) };
}

/** TIMESHEET-01: a plan's key — its kind and its id, the two a record and a link address it by (the instant apart). */
export const planKeyOf = (kind: 'routine' | 'routine_line', id: string): string => `${kind}:${id}`;

/**
 * TIMESHEET-01 (Alex, 2026-11-24): EACH PLAN'S PLANNED MINUTES, BY PLAN — the rule's input for a line with no record (a
 * record carries its own, LedgerRecordInput.durationMinutes). The one planned-minutes rule (supersession.ts
 * plannedMinutesOf) over the routines the loader read (reportInputs.ts toRoutinePlanInput — the window's JSON and each
 * line's duration, carried as read): a routine's window length under the routine's key, each of its lines'
 * duration_minutes under the line's. null is STATED (a line that states none, a routine without a window), never absent:
 * the rule throws by name on a plan this map does not hold. One mapper — the answer function calls it with the routines
 * it already read (no query added), and a test builds its fixture's the same way.
 */
export function planMinutesOf(routines: readonly Pick<RoutinePlanInput, 'id' | 'startTime' | 'endTime' | 'steps'>[]): Map<string, number | null> {
  const minutes = new Map<string, number | null>();
  for (const routine of routines) {
    minutes.set(planKeyOf('routine', routine.id), plannedMinutesOf({ kind: 'routine', start_time: routine.startTime, end_time: routine.endTime }));
    for (const step of routine.steps) minutes.set(planKeyOf('routine_line', step.id), plannedMinutesOf({ kind: 'line', duration_minutes: step.durationMinutes }));
  }
  return minutes;
}

// ── TIMESHEET-03 (Alex, 2026-11-24): THE LOOK — THE PILLS AND THEIR TONES ───
//
// BOOK and ACCOUNT NAME are coloured pills; the words in them do not change. Every class string below is typed WHOLE:
// tailwind.config.ts scans src/lib, and a class assembled from parts is never compiled.

/** The app's pill (projects/TaskRowView.tsx pillClass — its shape), kept on one line. */
export const PILL_CLASS = 'inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap';
/** BOOK's tone, by the book's word — one for each word of BOOK_WORDS. */
export const BOOK_TONES: Readonly<Record<BookWord, string>> = {
  Personal: 'bg-gray-300 text-gray-900',
  Business: 'bg-violet-200 text-violet-950',
  Trading: 'bg-emerald-200 text-emerald-950',
};
/** THE WHEEL — an account's tone is the wheel's at the account's place: thirteen, in this order, repeating after its last. */
export const ACCOUNT_TONES = [
  'bg-blue-200 text-blue-950',
  'bg-orange-200 text-orange-950',
  'bg-green-200 text-green-950',
  'bg-pink-200 text-pink-950',
  'bg-teal-200 text-teal-950',
  'bg-amber-300 text-amber-950',
  'bg-purple-200 text-purple-950',
  'bg-cyan-200 text-cyan-950',
  'bg-rose-200 text-rose-950',
  'bg-lime-200 text-lime-950',
  'bg-indigo-200 text-indigo-950',
  'bg-yellow-200 text-yellow-950',
  'bg-sky-200 text-sky-950',
] as const;
/** The tone of an account no active plan uses. */
export const NEUTRAL_TONE = 'bg-gray-200 text-gray-800';

/** The answer's `tones`: an account's label, as the ACCOUNT cell prints it ("P-6150") → its place, 0, 1, 2 … among the accounts the caller's active plans use. Wire-shaped — an object of whole numbers. */
export type AccountPlaces = Readonly<Record<string, number>>;

/**
 * TIMESHEET-03 (Alex, 2026-11-24): EACH ACCOUNT'S PLACE — what an account's tone is decided by. The accounts the caller's ACTIVE
 * plans use: each routine's own code and each of its active lines' codes (a line the loader marks inactive is not one; a null code
 * is skipped), each as the label the ACCOUNT cell prints — accountString.ts deriveAccountString over the routine's book and the
 * code, the rule's own call for a row. Distinct; in ascending order of that label by plain code-unit comparison, no locale; each
 * takes its place, 0, 1, 2 … It reads nothing but the routines it is handed — no period, no row, no clock — so an account's place,
 * and its tone, do not change with the period shown. One mapper: the answer function calls it with the routines it already read
 * (no query added), as it calls planMinutesOf.
 */
export function accountPlacesOf(routines: readonly Pick<RoutinePlanInput, 'entityType' | 'coaCode' | 'steps'>[]): AccountPlaces {
  const labels = new Set<string>();
  for (const routine of routines) {
    if (routine.coaCode !== null) labels.add(deriveAccountString({ entityType: routine.entityType, code: routine.coaCode }));
    for (const step of routine.steps) {
      // An active line: absent means active (the loader filters on the server), false is honoured — days.ts RoutineLinePlanInput.
      if (step.isActive === false || step.coaCode === null) continue;
      labels.add(deriveAccountString({ entityType: routine.entityType, code: step.coaCode }));
    }
  }
  const places: Record<string, number> = {};
  [...labels].sort(cmp).forEach((label, place) => { places[label] = place; });
  return places;
}

/** An account's place among the places handed in — null when no active plan uses the account. */
export const placeOf = (places: AccountPlaces, label: string): number | null => (Object.prototype.hasOwnProperty.call(places, label) ? places[label] : null);

/**
 * THE TONE OF A PLACE: the wheel's at that place, the wheel repeating after its last (the fourteenth account is back on the first
 * tone); an account with no place — no active plan uses it — takes the neutral tone. A place that is no whole number 0 or above is
 * the read's error, thrown by name, never drawn in some tone.
 */
export function toneOfPlace(place: number | null): string {
  if (place === null) return NEUTRAL_TONE;
  if (!Number.isInteger(place) || place < 0) throw new Error(`ledger: ${JSON.stringify(place)} is no place — an account's place is a whole number, 0 or above`);
  return ACCOUNT_TONES[place % ACCOUNT_TONES.length];
}

/** BOOK's pill: its classes, toned by the row's book — null when the row has no book (the cell prints its blank, no pill). */
export const bookPillClassOf = (row: Pick<LedgerSheetRow, 'book'>): string | null => (row.book === null ? null : `${PILL_CLASS} ${BOOK_TONES[row.book]}`);
/** ACCOUNT NAME's pill: its classes, toned by the account's place — null when the cell has no name (its blank, no pill). The account is the label the ACCOUNT cell prints. */
export const accountPillClassOf = (row: Pick<LedgerSheetRow, 'coa'>, places: AccountPlaces): string | null =>
  (row.coa === null || row.coa.name === null ? null : `${PILL_CLASS} ${toneOfPlace(placeOf(places, row.coa.account))}`);

/** THE TINT'S LEGEND — one line above the table: the tinted cells (BUDGET, VARIANCE, MATCH, UNDER / OVER) are the ones nobody types on a row. */
export const NOT_TYPED_WORDS = 'not typed on a row — from your plan, from Books, or worked out';

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
  /** TIMESHEET-01: plan key (planKeyOf) → the plan's planned minutes by the one rule (planMinutesOf) — a sheet row with no record prints them. null is stated, never absent. */
  readonly minutes: ReadonlyMap<string, number | null>;
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
  /** The postings that enter the match — LINK-LAW-01: a reversed one does not. */
  readonly postings: number;
  readonly unreadable: number;
  /** LINK-LAW-01 (ruling C): linked postings left out because they are a reversal or were reversed — counted, never summed. */
  readonly reversed: number;
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
  /** TIME-03: PLANNED MIN — the day card's `minutes` (the one rule, supersession.ts plannedMinutesOf — SUPERSEDE-01a, 2026-11-07: a line's duration_minutes; WORK-03b, a stepless routine's window length); null for a line that states none or a stepless routine without a window. */
  readonly plannedMinutes: number | null;
  /** TIME-03: LOGGED MIN — the record's actual_minutes (the day card's `actualMinutes`); null when none was typed at the stop. */
  readonly loggedMinutes: number | null;
}

// ── TIMESHEET-01 (Alex, 2026-11-24): THE SHEET'S ROW ────────────────────────

/** WENT's two words of its own; "skipped" and "not recorded" are the stop record's (stopRecord.ts SKIPPED_WORD, NOT_RECORDED_WORDS — the card's words, reused). */
export const WENT_WORD = 'went';
export const PLANNED_WORD = 'planned';
/** What WENT says of a line the sheet lists: its record is done · its record is skipped · no record and the occurrence is at or after the clock handed in · no record and it is before it. */
export type Went = typeof WENT_WORD | typeof SKIPPED_WORD | typeof PLANNED_WORD | typeof NOT_RECORDED_WORDS;
/**
 * TIMESHEET-02 (Alex, 2026-11-24): why a plan row takes no record — one sentence per cause, and its WENT is blank. Two are the stops
 * route's own refusals, read where the route reads them (stopRole.ts NOT_A_STOP_RECORD_WORDS — the line is all day; stopRecord.ts
 * LINES_WORDS — a routine's own line while the routine has an active line). The two below are this file's: the row's address is not
 * its alone. A recorded expense that could not be joined to one line holds the same key; or another plan line of the sheet stands at
 * the same (kind, id, instant). Both hold → the first.
 */
export const RECORD_ON_OWN_ROW_WORDS = "this stop's record is on its own row — it could not be joined to one plan line";
export const TWO_LINES_NO_RECORD_WORDS = 'two plan lines stand at this stop — neither is taken, so this row takes no record';

/**
 * A PLAN LINE OF THE PERIOD WITH NO RECORD ON IT — the plan, and null where a record would be. The fields are LedgerRow's,
 * under LedgerRow's names, so every cell, filter, sort, total and CSV field reads either row by the one spec; the ones only
 * a record fills are typed null here (never 0, never a guess), and `id` — the record's id — is null: that is how the two are
 * told apart. A plan line always has its book, its account and its cents (the Budget's line holds them).
 */
export interface LedgerPlanRow {
  /** No record. */
  readonly id: null;
  /**
   * The row's own key — its line's key (lineKey: what a record at this occurrence would carry). Where that key is not its
   * alone — two plan lines at one stop, or a record that could not be joined to a line holds it — the row's count among the
   * rows without a record at that key is appended ("…#1", "…#2"), so every row of the sheet has a key of its own.
   */
  readonly key: string;
  /** The line's own (kind, id, instant) — what a link is keyed by; "link" stands on a row with no record. */
  readonly address: LedgerAddress;
  /** The books' link at that address; null when no posting is linked. */
  readonly match: LedgerMatch | null;
  /** The line's day (the occurrence's local day in the routine's zone — the Budget's), 'YYYY-MM-DD'. */
  readonly day: string;
  /** The line's clock by the rule `rows` uses (the line's own time, else the occurrence's local time in the routine's zone); null on an all-day line — a charge on a date has no clock. */
  readonly time: string | null;
  readonly place: PlaceParts | null;
  readonly book: BookWord;
  readonly coa: LedgerCoa;
  /** The planned vendor, by the plan's one grain. */
  readonly vendor: string | null;
  /** The card's bold name (stopName) — printed under SUB ACCOUNT NAME, as a recorded row's. */
  readonly description: string;
  readonly rating: null;
  readonly note: null;
  /** The line's cents — BUDGET. */
  readonly cents: number;
  readonly outcome: null;
  readonly actualCents: null;
  readonly varianceCents: null;
  /** PLANNED MIN — the plan's, by the one rule (LedgerInput.minutes). */
  readonly plannedMinutes: number | null;
  readonly loggedMinutes: null;
  /** The line's routine is all day (stopRole.ts — a charge on a date, not a stop): START says so, END and WENT are blank, and it takes no record. */
  readonly allDay: boolean;
  /** planned · not recorded, against the clock handed in — on a row that takes a record. TIMESHEET-02 (2026-11-24, ruling A): null on every row that takes none — an all-day line, a routine's own line while the routine has lines, an address that is not the row's alone (`recording` says which, in words). */
  readonly went: typeof PLANNED_WORD | typeof NOT_RECORDED_WORDS | null;
}

/** A row of the sheet: a recorded expense — the row of `rows`, itself — or a plan line with no record. `id === null` is the plan line. */
export type LedgerSheetRow = LedgerRow | LedgerPlanRow;

// ── TIMESHEET-02 (Alex, 2026-11-24): WHAT A ROW'S RECORD FORM IS GIVEN ──────

/** Why a recorded row has no plan line to plan a vendor on — one sentence per cause (its budgetState: 'none', 'doubled'). */
export const NO_LINE_NO_VENDOR_WORDS = 'no budget line matches this record — a vendor is planned on a line';
export const DOUBLED_NO_VENDOR_WORDS = 'two plan lines stand at this stop — neither is taken, so no vendor is planned here';

/**
 * A SHEET ROW'S ENTRY IN `recording` — whether the row takes a record and, when it does, everything its form is given, so a form
 * opens with no read. `takes: false` carries the one sentence saying why (the row's WENT is blank). `takes: true` carries the
 * stop's planned instant (ISO text — the day card's own rule: a line whose step states a time of day → that clock on the row's day
 * in the routine's zone; else the occurrence's instant itself), the row's record as the stops GET answers it (null on a plan row),
 * and the day card's own vendor slot: { kind: 'box', line } with the plan line as the Budget holds it — the plan row's own line, a
 * recorded row's matched line — or { kind: 'reason', words } on a recorded row with no line to plan on. Wire-shaped: strings,
 * numbers, booleans and nulls.
 */
export type LedgerRecording =
  | { readonly takes: false; readonly words: string }
  | { readonly takes: true; readonly plannedAt: string; readonly held: StopRecordRow | null; readonly vendor: VendorSlot };
/** The entry of a row that takes a record — what the form and its rule are handed. */
export type LedgerRecordingTaken = Extract<LedgerRecording, { readonly takes: true }>;

/** START: 'all day' on an all-day line (the one word — stopRole.ts ROLE_SHORT_WORDS.all_day; TIMESHEET-02, 2026-11-24: work.ts's until then); else the row's clock, 'HH:MM'; null when the row has none. */
export const startOf = (row: LedgerSheetRow): string | null => (row.id === null && row.allDay ? ROLE_SHORT_WORDS.all_day : row.time);

const DAY_MINUTES = 24 * 60;
/** Minutes past midnight of a row's clock ('HH:MM' — the loader's reading of a @db.Time, or lib/time.ts instantToZoned's); a text that is no clock is the read's error, thrown by name. */
const clockMinutesOf = (clock: string): number => {
  const minutes = minutesOf(clock);
  if (minutes === null) throw new Error(`ledger: ${JSON.stringify(clock)} is not a clock — a stop's time is HH:MM`);
  return minutes;
};
/**
 * END: START plus the row's planned minutes, 'HH:MM', when both are known — the clock wraps past midnight (22:00 and 240
 * minutes ends 02:00). null on an all-day line, with no clock, or when the minutes are not stated. Minutes that are not a
 * whole number 0 or above are the database's error (minutesCellWords' own refusal), never drawn.
 */
export function endOf(row: LedgerSheetRow): string | null {
  if (row.id === null && row.allDay) return null;
  if (row.time === null || row.plannedMinutes === null) return null;
  if (!Number.isInteger(row.plannedMinutes) || row.plannedMinutes < 0) throw new Error(`ledger: minutes are a whole number of minutes, not ${row.plannedMinutes}`);
  const end = (clockMinutesOf(row.time) + row.plannedMinutes) % DAY_MINUTES;
  return clockWords({ hour: Math.floor(end / 60), minute: end % 60 });
}

/** WENT: a recorded row by its outcome — went (done) or skipped; a plan row by what the rule found against its clock — planned or not recorded; null on an all-day line. */
export const wentOf = (row: LedgerSheetRow): Went | null => (row.id === null ? row.went : row.outcome === 'skipped' ? SKIPPED_WORD : WENT_WORD);

export interface LedgerSaid {
  /** Records no budget line matches (the doubled among them counted again, by name). */
  readonly noLine: number;
  readonly doubled: number;
  /** TIMESHEET-02 (2026-11-24, ruling F.2): the sheet's rows on a day no stay covers — the rows the table lists, planned and recorded (the recorded rows alone until then). */
  readonly noStay: number;
  /** Records whose routine's zone could not be read — named with the reason, never placed in UTC. */
  readonly unplaced: readonly { readonly record: StopRecordRow; readonly detail: string }[];
  /** Priced stops planned in the period, already past, with no record. TIMESHEET-02 (2026-11-24, ruling F.2): exactly the sheet's rows whose WENT reads 'not recorded' (a separate count over the budget lines until then). */
  readonly notRecorded: number;
  /** The Budget's routine lines in the period it could not place (days.ts NotPlaced). */
  readonly notPlaced: number;
  /** RETRO-01: records in the period left out because their plan's role takes no money, by role. */
  readonly leftOut: Readonly<Record<NoMoneyRole, number>>;
  /** LINK-LAW-01 (ruling C): linked postings the rows' MATCH left out because they are a reversal or were reversed. TIMESHEET-02 (2026-11-24, ruling F.2): over the sheet's rows — a link is keyed on an occurrence, recorded or not (the recorded rows alone until then). */
  readonly reversed: number;
}

/** RETRO-01: the roles that take no money (dayCard.ts asksAmount is false) — a record of one is not an expense. */
export type NoMoneyRole = Exclude<StopRole, 'place' | 'none'>;
export const NO_MONEY_ROLES: readonly NoMoneyRole[] = ['journal', 'plan', 'execute', 'all_day'];

export interface Ledger {
  readonly from: string;
  readonly to: string;
  /** Newest day first, then the card's clock order. */
  readonly rows: readonly LedgerRow[];
  /** TIMESHEET-01: the table's rows — every priced line of the period that takes money or is all day, planned and recorded, and each recorded expense no line's row took. Day ascending; within a day the all-day rows, then the clock. */
  readonly sheet: readonly LedgerSheetRow[];
  /** TIMESHEET-02 (2026-11-24): by the sheet row's key, one entry for EVERY row of `sheet`, in the sheet's order — whether the row takes a record, and what its form is given. */
  readonly recording: Readonly<Record<string, LedgerRecording>>;
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
  // SUPERSEDE-01b (Alex, 2026-11-08, CLOSED): the task ledger keeps its routine lines UNMARKED — it reads no travel block (a mark
  // is Budget's and the card's); stated as no marks (report.ts markLines over an empty map), never left absent. No row reads the mark.
  const plan = dayPlanOf({ view: { kind: 'day', day }, lines: markLines(input.lines, new Map()), notPlaced: input.notPlaced, routines: input.routines, tasks: new Map(), vendors: input.vendors });
  if (!plan.ok) throw new Error(`ledger: ${plan.code} — ${plan.message}`);
  if (!plan.plan.listed) throw new Error(`ledger: a DAY view lists its plan lines — ${plan.plan.words}`);
  return plan.plan.lines;
}

/** LEDGER-03: the join key — a record's (kind, target_id, occurrence_at) and a link's (target_kind, target_id, target_instant) are the same three strings. */
export const linkKeyOf = (kind: string, id: string, instant: string): string => `${kind}:${id}:${instant}`;

/**
 * TIMESHEET-02 (Alex, 2026-11-24): THE STOP'S PLANNED INSTANT, by the day card's own rule (dayCard.ts dayStops — "the line's own time
 * of day on the card's day in the routine's zone, else the occurrence"): a line whose step states a time of day → that clock on the
 * row's day in the routine's zone (lib/time.ts zonedToInstant); a line that states none, and a stepless routine → the occurrence's
 * instant itself. ISO text. `timeOfDay` is the line's own, 'HH:MM' or null — never a stepless routine's clock.
 */
const plannedAtOf = (day: string, timeOfDay: string | null, zone: string, instant: string): string => (timeOfDay === null ? instant : zonedToInstant(day, timeOfDay, zone).toISOString());

/**
 * LEDGER-03: a record's match from its links — null with none; the readable amounts summed, the unreadable counted, never summed as zero.
 * LINK-LAW-01 (Alex, 2026-10-28, ruling C): A REVERSED POSTING PAYS NOTHING — a link to a reversal, or to a reversed posting, is left out of
 * the sum and counted (reversed); with every link reversed the sum is null, never 0. The one rule the three MATCH reads share: the ledger,
 * ROUTINE EXPENSES (routineMonth.ts) and THE WORK (taskMatch.ts).
 */
export function matchOf(links: readonly Pick<LedgerLinkInput, 'amountCents' | 'reversed'>[]): LedgerMatch | null {
  if (links.length === 0) return null;
  const paying = links.filter((l) => !l.reversed);
  const readable = paying.map((l) => l.amountCents).filter((c): c is number => c !== null);
  return { cents: readable.length === 0 ? null : readable.reduce((sum, c) => sum + c, 0), postings: paying.length, unreadable: paying.length - readable.length, reversed: links.length - paying.length };
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

  // TIMESHEET-01: a day's plan lines are read ONCE (dayLines) — here for the days that have a record, and by the sheet below for every day of the span.
  const planRead = new Map<string, readonly PlanLine[]>();
  const planOn = (day: string): readonly PlanLine[] => {
    const held = planRead.get(day);
    if (held !== undefined) return held;
    const lines = dayLines(input, day);
    planRead.set(day, lines);
    return lines;
  };

  // The plan lines of each day that has a record, indexed by the card's key.
  const linesByDay = new Map<string, Map<string, PlanLine[]>>();
  for (const day of new Set(expenses.map((p) => p.day))) {
    const byKey = new Map<string, PlanLine[]>();
    for (const l of planOn(day)) {
      const key = lineKey(l.address);
      byKey.set(key, [...(byKey.get(key) ?? []), l]);
    }
    linesByDay.set(day, byKey);
  }

  // TIMESHEET-02 (Alex, 2026-11-24): what each sheet row's record form is given, by the row's key — a recorded row's entry is set where
  // its row is built (the record, its matched line and its line's time are in hand there); a plan row's by the sheet, below.
  const recordingAt = new Map<string, LedgerRecording>();

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
    // TIMESHEET-02 (ruling A): every recorded row takes a record — it is edited or cleared there. Its form is given the stop's planned
    // instant (the line's own time on the record's day in its routine's zone, else the occurrence), the record itself, and the vendor
    // slot: the Budget's box on the matched line, or the one reason there is no line to plan on.
    recordingAt.set(key, {
      takes: true,
      plannedAt: plannedAtOf(day, r.timeOfDay, r.zone, r.record.occurrence_at),
      held: r.record,
      vendor: line !== null ? { kind: 'box', line } : { kind: 'reason', words: budgetState === 'doubled' ? DOUBLED_NO_VENDOR_WORDS : NO_LINE_NO_VENDOR_WORDS },
    });
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

  // TIMESHEET-02 (Alex, 2026-11-24, ruling F.2): the priced stops past with no record are counted from the sheet's own rows, below — the
  // rows whose WENT reads 'not recorded'. The separate count over the budget lines that stood here (a key counted once, and never one a
  // record held) is gone with it: one rule says which rows read 'not recorded', and the note counts those rows.

  // ── TIMESHEET-01 (Alex, 2026-11-24): THE SHEET — every priced line of the period, planned and recorded ──
  // The rows above are untouched. For every day of the span: the day's plan lines (planOn — the rule's own reader) whose
  // routine's role asks an amount or is all day. A recorded expense whose key names exactly one line of its day ('matched') is
  // printed on that line's row — the row of `rows`, itself; every other listed line is a row without a record. Then each
  // recorded expense no line's row took ('none', 'doubled') is its own row, as `rows` gives it: nothing recorded leaves the
  // sheet, and none is on it twice.
  const recordedAt = new Map(rows.map((row) => [row.key, row]));
  const routineOfLine = new Map<string, string>();
  for (const [routineId, words] of input.routines) for (const stepId of words.steps.keys()) routineOfLine.set(stepId, routineId);
  const sheeted: { readonly row: LedgerSheetRow; readonly label: string; readonly line: string | null }[] = [];
  const onALine = new Set<string>();
  const withoutRecord = new Map<string, number>();
  // TIMESHEET-02 (ruling A.3): how many plan lines stand at each key, counted before any row is built — the count decides whether a row's
  // address is its alone, never a "#n" in its key (the first of two lines at one stop keeps the bare key). Two lines at one key are one
  // routine's, so its role lists both or neither.
  const standing = new Map<string, number>();
  for (const day of daysOf(from, to)) {
    for (const l of planOn(day)) {
      const key = lineKey(l.address);
      standing.set(key, (standing.get(key) ?? 0) + 1);
    }
  }
  for (const day of daysOf(from, to)) {
    const stay = coveringStay(input.stays, day);
    for (const l of planOn(day)) {
      const { kind, id, instant } = l.address;
      if (kind === 'project_task' || instant === null) throw new Error(`ledger: plan line ${JSON.stringify(l.label)} on ${day} is of kind ${kind} — no routine occurrence's`);
      const key = lineKey(l.address);
      const routineId = kind === 'routine' ? id : routineOfLine.get(id);
      const routine = routineId === undefined ? undefined : input.routines.get(routineId);
      if (routineId === undefined || routine === undefined) throw new Error(`ledger: plan line ${key} names no routine the loader read`);
      const role = input.roles.get(routineId);
      if (role === undefined) throw new Error(`ledger: plan line ${key} names routine ${routineId}, whose role was not read`);
      if (!isStopRole(role)) throw new Error(`ledger: routine ${routineId} carries role ${JSON.stringify(role)} — not one of the six`);
      // An all-day line is a charge on a date: listed, and it takes no record (the stops route refuses one).
      const allDay = !isStop(role);
      // RETRO-01: a line of a role that takes no money (journal, plan, execute) is not an expense — not listed here, priced or not.
      if (!allDay && !asksAmount(role)) continue;
      const taken = recordedAt.get(key);
      if (taken !== undefined && taken.day === day && taken.budgetState === 'matched') {
        onALine.add(taken.key);
        sheeted.push({ row: taken, label: l.label, line: l.line });
        continue;
      }
      const book = books.get(l.entityId);
      if (book === undefined) throw new Error(`ledger: line ${key} is on entity ${l.entityId}, which is not one of the user's books`);
      const stated = input.minutes.get(planKeyOf(kind, id));
      if (stated === undefined) throw new Error(`ledger: plan line ${key} names ${kind} ${id}, whose planned minutes were not read`);
      // The row's own key: the line's, with its count among the rows without a record there appended when the key is not its alone.
      const nth = (withoutRecord.get(key) ?? 0) + 1;
      withoutRecord.set(key, nth);
      // TIMESHEET-02 (Alex, 2026-11-24, ruling A): DOES THIS ROW TAKE A RECORD? By the stops route's own refusals, from what the rule
      // already holds — one sentence per cause, in this order: (1) its line is all day (the route's NOT_A_STOP_RECORD_WORDS); (2) it is a
      // routine's own line and that routine has an active line (the route's LINES_WORDS — the routine's active lines are RoutineWords.steps,
      // as the loader read them); (3) its address is not its alone — (a) a recorded expense that could not be joined to one line holds the
      // same key, or (b) another plan line of the sheet stands at the same (kind, id, instant); both hold → (a). null: it takes one.
      const lines = standing.get(key);
      if (lines === undefined) throw new Error(`ledger: plan line ${key} was not counted among the plan lines of ${day}`);
      const noRecordWords = allDay ? NOT_A_STOP_RECORD_WORDS
        : kind === 'routine' && routine.steps.size > 0 ? LINES_WORDS
          : recordedAt.has(key) ? RECORD_ON_OWN_ROW_WORDS
            : lines > 1 ? TWO_LINES_NO_RECORD_WORDS
              : null;
      const row: LedgerPlanRow = {
        id: null,
        key: nth === 1 && !recordedAt.has(key) ? key : `${key}#${nth}`,
        address: { kind, id, instant },
        match: matchOf(linksByKey.get(linkKeyOf(kind, id, instant)) ?? []),
        day,
        // The clock by the rule the recorded rows use: the line's own time, else the occurrence's local time in the routine's zone; an all-day line has none.
        time: allDay ? null : l.time !== null ? l.time : instantToZoned(new Date(instant), routine.timezone).time,
        place: stay === null ? null : placeParts(stay.place),
        book: bookWordOf(book.entityType),
        coa: { account: deriveAccountString({ entityType: book.entityType, code: l.code }), name: names.get(`${l.entityId}:${l.code}`) ?? null },
        vendor: l.vendor !== null ? l.vendor.name : null,
        description: stopName({ line: l.line, label: l.label }),
        rating: null,
        note: null,
        cents: l.cents,
        outcome: null,
        actualCents: null,
        varianceCents: null,
        plannedMinutes: stated,
        loggedMinutes: null,
        allDay,
        // The occurrence's instant against the clock handed in — on a row that takes a record. TIMESHEET-02 (ruling A): blank on every row
        // that takes none; the all-day blank's rule, now all three causes'.
        went: noRecordWords !== null ? null : Date.parse(instant) >= input.now.getTime() ? PLANNED_WORD : NOT_RECORDED_WORDS,
      };
      // TIMESHEET-02 (ruling B): the row's entry — its sentence, or what its form is given: the planned instant (a line's own time of day
      // on this day in the routine's zone, else the occurrence), no record held, and the Budget's box on the row's own plan line.
      recordingAt.set(row.key, noRecordWords !== null
        ? { takes: false, words: noRecordWords }
        : { takes: true, plannedAt: plannedAtOf(day, kind === 'routine_line' ? l.time : null, routine.timezone, instant), held: null, vendor: { kind: 'box', line: l } });
      sheeted.push({ row, label: l.label, line: l.line });
    }
  }
  for (const row of rows) {
    if (onALine.has(row.key)) continue;
    sheeted.push({ row, label: label.get(row.id)!.label, line: label.get(row.id)!.line });
  }
  // Day ascending; within a day the all-day rows, then the clock (a blank last), the routine's name, the line's activity, the key.
  const afterAllDay = (row: LedgerSheetRow): number => (row.id === null && row.allDay ? 0 : 1);
  sheeted.sort((a, b) => cmp(a.row.day, b.row.day) || afterAllDay(a.row) - afterAllDay(b.row) || cmpMaybe(a.row.time, b.row.time) || cmp(a.label, b.label) || cmpMaybe(a.line, b.line) || cmp(a.row.key, b.row.key));
  const sheet: readonly LedgerSheetRow[] = sheeted.map((s) => s.row);

  // TIMESHEET-02 (ruling B): `recording` — one entry for EVERY row of the sheet, by the row's key, in the sheet's order. A row with none
  // is this rule's error, thrown by name — never a row whose form opens on nothing.
  const recording: Record<string, LedgerRecording> = {};
  for (const row of sheet) {
    const entry = recordingAt.get(row.key);
    if (entry === undefined) throw new Error(`ledger: sheet row ${row.key} has no entry in recording — every row of the sheet has one`);
    recording[row.key] = entry;
  }

  return {
    from,
    to,
    rows,
    sheet,
    recording,
    said: {
      noLine: rows.filter((row) => row.budgetState !== 'matched').length,
      doubled: rows.filter((row) => row.budgetState === 'doubled').length,
      // TIMESHEET-02 (ruling F.2): the three notes that count rows count the rows the table lists — the sheet's rows as built here (the
      // period's, whatever a filter hides): on a day no stay covers; reading 'not recorded'; and the reversed postings their MATCH left out.
      noStay: sheet.filter((row) => row.place === null).length,
      unplaced,
      notRecorded: sheet.filter((row) => wentOf(row) === NOT_RECORDED_WORDS).length,
      notPlaced: input.notPlaced.length,
      leftOut,
      reversed: sheet.reduce((sum, row) => sum + (row.match === null ? 0 : row.match.reversed), 0),
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
export const cityWords = (row: LedgerSheetRow): string => (row.place === null ? BLANK : row.place.city);
export const countryWords = (row: LedgerSheetRow): string => (row.place === null || row.place.country === null ? BLANK : row.place.country);
export const coaWords = (row: LedgerSheetRow): string => (row.coa === null ? BLANK : row.coa.name === null ? row.coa.account : `${row.coa.account} · ${row.coa.name}`);
export type CellWordsKey = 'city' | 'country' | 'coa';
export const CELL_WORDS: Readonly<Record<CellWordsKey, (row: LedgerSheetRow) => string>> = { city: cityWords, country: countryWords, coa: coaWords };

// ── LEDGER-04 (Alex, 2026-10-20): THE COLUMNS — FILTERS THE SHEET'S WAY, AND SORT ──

/** The twenty-one columns by key, in the head's order — LEDGER_HEAD_WORDS[i] is LEDGER_COLUMNS[i]'s word (headWordOf). TIME-03 (2026-10-26): plannedMinutes and loggedMinutes after stars, nothing reordered; sixteen until then. TIMESHEET-01 (2026-11-24): start and end after date, went after vendor — each beside the fact it extends, nothing else moved; eighteen until then. */
export const LEDGER_COLUMNS = ['day', 'date', 'start', 'end', 'city', 'country', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'went', 'stars', 'plannedMinutes', 'loggedMinutes', 'budget', 'actual', 'variance', 'match', 'underOver', 'description'] as const;
export type LedgerColumn = (typeof LEDGER_COLUMNS)[number];
/** A VALUE column filters by a checklist of its cell words; a MONEY column by a min and a max; the TEXT column by a contains-text. TIME-03: the two minutes columns are VALUE columns — whole minutes as words, sorted as numbers. TIMESHEET-01: START, END and WENT are VALUE columns — START and END sorted by the clock. */
export const VALUE_COLUMNS = ['day', 'date', 'start', 'end', 'city', 'country', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'went', 'stars', 'plannedMinutes', 'loggedMinutes', 'underOver'] as const;
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
export function cellWordsOf(row: LedgerSheetRow, column: LedgerColumn): string {
  switch (column) {
    case 'day': return dayLongWords(row.day);
    case 'date': return row.day;
    case 'start': return startCellWords(row);
    case 'end': return endCellWords(row);
    case 'city': return cityWords(row);
    case 'country': return countryWords(row);
    case 'book': return bookCellWords(row);
    case 'account': return accountCellWords(row);
    case 'accountName': return accountNameCellWords(row);
    case 'subAccountName': return row.description;
    case 'vendor': return vendorCellWords(row.vendor);
    case 'went': return wentCellWords(row);
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
export const cellCentsOf = (row: LedgerSheetRow, column: MoneyColumn): number | null =>
  (column === 'budget' ? row.cents : column === 'actual' ? row.actualCents : column === 'variance' ? row.varianceCents : readableMatchCents(row.match));
/** The TEXT column's text — what its contains-text reads (IDIOM-01): DESCRIPTION is the record's note; null is a blank cell. */
export function cellTextOf(row: LedgerSheetRow, column: TextColumn): string | null {
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
/** The ledger's filters: one per column, by the column's kind — the idiom's three shapes in a typed map of twenty-one (sixteen until TIME-03; eighteen until TIMESHEET-01). */
export type ColumnFilters = { readonly [C in ValueColumn]: ValueFilter } & { readonly [C in MoneyColumn]: MoneyFilter } & { readonly [C in TextColumn]: TextFilter };
export const NO_COLUMN_FILTERS: ColumnFilters = Object.freeze({
  day: NO_VALUE_FILTER, date: NO_VALUE_FILTER, start: NO_VALUE_FILTER, end: NO_VALUE_FILTER, city: NO_VALUE_FILTER, country: NO_VALUE_FILTER, book: NO_VALUE_FILTER, account: NO_VALUE_FILTER, accountName: NO_VALUE_FILTER,
  subAccountName: NO_VALUE_FILTER, vendor: NO_VALUE_FILTER, went: NO_VALUE_FILTER, stars: NO_VALUE_FILTER, plannedMinutes: NO_VALUE_FILTER, loggedMinutes: NO_VALUE_FILTER, underOver: NO_VALUE_FILTER,
  budget: NO_MONEY_FILTER, actual: NO_MONEY_FILTER, variance: NO_MONEY_FILTER, match: NO_MONEY_FILTER,
  description: NO_TEXT_FILTER,
});
/** Whether a column's filter narrows anything — the mark on its header. */
export const columnFilterOn = (filters: ColumnFilters, column: LedgerColumn): boolean => filterOn(filters, column, columnKind(column));
export const anyColumnFilterOn = (filters: ColumnFilters): boolean => anyFilterOn(LEDGER_TABLE, filters);
/** One row against every column's filter: within a VALUE column the ticks are OR (the row's cell is not among the dropped); across columns AND. */
export const rowPassesFilters = (row: LedgerSheetRow, filters: ColumnFilters): boolean => rowPasses(row, filters, LEDGER_TABLE);
/** The rows shown, in the order given. Nothing else changes — the TOTAL row, the coverage, the summary and the CSV follow these. TIMESHEET-01: over the sheet's rows, or the recorded rows alone — what is handed in comes back. */
export const applyColumnFilters = <R extends LedgerSheetRow>(rows: readonly R[], filters: ColumnFilters): R[] => filterRows(rows, filters, LEDGER_TABLE);
/** The distinct values of a VALUE column among the rows loaded, each with its count, in the column's own sort order (sortRows ascending) — a blank last. */
export const columnValues = (rows: readonly LedgerSheetRow[], column: ValueColumn): ColumnValue[] => columnValuesOf(rows, ledgerColumnOf(column));

/** One column, ascending or descending; null is the ledger's own order (newest day first, then the card's clock). */
export type LedgerSort = TableSort<LedgerColumn>;
/** Monday 1 … Sunday 7, from the day's UTC parts (a calendar day, no zone). */
export const weekdayNumber = (day: string): number => ((new Date(utc(day)).getUTCDay() + 6) % 7) + 1;
/** TIMESHEET-01: START sorts by the clock — 'all day' before every clock (ALL_DAY_FIRST, under 00:00's 0), a blank last. */
const ALL_DAY_FIRST = -1;
/** A clock as its sort number — minutes past midnight; null for a blank. */
const clockSortNumber = (clock: string | null): number | null => (clock === null ? null : clockMinutesOf(clock));
/** What a column sorts by: a number (cents, stars, the weekday Mon…Sun as 1…7, a clock as minutes past midnight), a text (localeCompare, numeric), or null for a blank cell — last in both directions. */
export function sortKeyOf(row: LedgerSheetRow, column: LedgerColumn): SortKey {
  switch (column) {
    case 'day': return num(weekdayNumber(row.day));
    case 'date': return text(row.day);
    case 'start': return num(row.id === null && row.allDay ? ALL_DAY_FIRST : clockSortNumber(row.time));
    case 'end': return num(clockSortNumber(endOf(row)));
    case 'city': return text(row.place === null ? null : row.place.city);
    case 'country': return text(row.place === null ? null : row.place.country);
    case 'book': return text(row.book);
    case 'account': return text(row.coa === null ? null : row.coa.account);
    case 'accountName': return text(row.coa === null ? null : row.coa.name);
    case 'subAccountName': return text(row.description);
    case 'vendor': return text(row.vendor);
    case 'went': return text(wentOf(row));
    case 'stars': return num(row.rating);
    case 'plannedMinutes': return num(row.plannedMinutes);
    case 'loggedMinutes': return num(row.loggedMinutes);
    case 'budget': case 'actual': case 'variance': case 'match': return num(cellCentsOf(row, column));
    case 'underOver': return text(row.varianceCents === null ? null : varianceSignWords(row.varianceCents));
    case 'description': return text(row.note);
  }
}
/** The rows by one column; ties keep the order given (a stable sort), blanks last either way; null gives the rows as they came. The TOTAL row is not a row here. */
export const sortRows = <R extends LedgerSheetRow>(rows: readonly R[], sort: LedgerSort | null): R[] => sortTableRows(rows, sort, LEDGER_TABLE);

/** RETRO-01's left-out count, summed over the roles (leftOutWords prints it). */
export const leftOutTotal = (left: Readonly<Record<NoMoneyRole, number>>): number => NO_MONEY_ROLES.reduce((sum, role) => sum + left[role], 0);
/**
 * The notes under the TOTAL row that have something to say — the n of "n notes": the four coverage lines whenever a row is shown (VARIANCE,
 * MATCH, and TIME-03's PLANNED HOURS and LOGGED HOURS — two until then), and each
 * said line whose count is above 0 (no line, no stay, unplaced, not recorded, left out, not placed — and LINK-LAW-01's reversed). The TODAY
 * rule and the every-book line are shown only when open and never counted; a line whose count is 0 is neither counted nor shown.
 */
export const notesCount = (said: LedgerSaid, shownRows: number): number =>
  [shownRows, shownRows, shownRows, shownRows, said.noLine, said.noStay, said.unplaced.length, said.notRecorded, leftOutTotal(said.leftOut), said.notPlaced, said.reversed].filter((n) => n > 0).length;

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
export function ledgerTotals(rows: readonly LedgerSheetRow[]): LedgerTotals {
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
  /** The days the group has records on. TIMESHEET-01 (2026-11-24): a day that carries only planned rows is not one — 0 for a group with no record. */
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

const groupKeyOf = (row: LedgerSheetRow, by: GroupKey): string =>
  by === 'day' ? row.day : by === 'week' ? mondayOf(row.day) : by === 'month' ? monthOf(row.day) : by === 'book' ? bookGroupWords(row) : CELL_WORDS[by](row);
const groupLabelOf = (key: string, by: GroupKey): string => (by === 'day' ? dayShortWords(key) : by === 'week' ? weekWords(key) : by === 'month' ? monthWords(key) : key);

/**
 * The rows shown, grouped by one selector: time groups newest first, place, COA and book groups in their words' order.
 * TIMESHEET-01 (Alex, 2026-11-24): the rows are the sheet's, so a group may hold planned rows — its DAYS count only the days that
 * carry a record (a went or a skipped row), and ACTUAL PER RECORDED DAY divides by those, never by a planned day; a group with no
 * record has 0 days and no per-day figure (its actual is null — nothing was logged).
 */
export function ledgerSummary(rows: readonly LedgerSheetRow[], by: GroupKey): LedgerGroup[] {
  const groups = new Map<string, LedgerSheetRow[]>();
  for (const row of rows) {
    const key = groupKeyOf(row, by);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const byTime = by === 'day' || by === 'week' || by === 'month';
  const keys = [...groups.keys()].sort((a, b) => (byTime ? cmp(b, a) : a.localeCompare(b)));
  return keys.map((key) => {
    const members = groups.get(key) as LedgerSheetRow[];
    const days = new Set(members.filter((r) => r.id !== null).map((r) => r.day)).size;
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

/** LEDGER-02 (Alex, 2026-10-19): "It's really a Task Ledger, not a City Ledger." TIMESHEET-01 (Alex, 2026-11-24): the title is 'Time sheet' — the table is the sheet of what was planned, with what was recorded on it; 'Task ledger' until then. Nothing else is renamed. */
export const LEDGER_TITLE_WORDS = 'Time sheet';
/**
 * LEDGER-02: the sixteen columns in Alex's order — one fact each, nothing combined. LEDGER-04 (Alex, 2026-10-20): the stop's name is
 * the SUB ACCOUNT NAME (was DESCRIPTION) and the record's note is the DESCRIPTION (was NOTES); the CSV header follows (ledgerCsv).
 * TIME-03 (Alex, 2026-10-26): eighteen — PLANNED MIN · LOGGED MIN after STARS, nothing reordered (the day card's minutes, as the row holds them).
 * TIMESHEET-01 (Alex, 2026-11-24): twenty-one — START · END after DATE, WENT after VENDOR, each beside the fact it extends; no other column renamed, moved or restyled.
 */
export const LEDGER_HEAD_WORDS = ['DAY', 'DATE', 'START', 'END', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION'] as const;
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
/** TIMESHEET-01 (Alex, 2026-11-24): the sheet lists the plan too — an empty period has nothing planned and nothing recorded ('no stop recorded …' until then). */
export const noRowsWords = (p: Period): string => `nothing planned or recorded ${periodWords(p)}`;
export { NO_ROWS_SHOWN_WORDS } from '@/lib/table/words'; // IDIOM-01 (2026-10-24): the idiom's empty state — the table stays, the words say no row matches
/** "★★★★" — ★ × rating; a rating outside 1–5 is the database's error, never drawn. */
export function ledgerStarsWords(rating: number): string {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error(`ledger: a rating is 1 to 5, not ${rating}`);
  return '★'.repeat(rating);
}
/** "★ 3.8 (4 rated)" */
export const averageStarsWords = (stars: { readonly average: number; readonly rated: number }): string => `★ ${stars.average.toFixed(1)} (${stars.rated} rated)`;
/** The ACTUAL cell: "skipped" adds nothing; done without an amount is "—"; else the actual ALONE (LEDGER-02: the delta is the VARIANCE column's — one fact per cell). */
export const actualCellWords = (row: Pick<LedgerSheetRow, 'outcome' | 'actualCents' | 'cents'>): string =>
  (row.outcome === 'skipped' ? SKIPPED_WORD : row.actualCents === null ? BLANK : planDollars(row.actualCents));
/** LEDGER-02: the BOOK cell — the word, or "—" when no line matched. */
export const bookCellWords = (row: Pick<LedgerSheetRow, 'book'>): string => (row.book === null ? BLANK : row.book);
/** LEDGER-02: the BOOK group's key for a row with no book. */
export const NO_BOOK_GROUP_WORDS = 'no account';
export const bookGroupWords = (row: Pick<LedgerSheetRow, 'book'>): string => (row.book === null ? NO_BOOK_GROUP_WORDS : row.book);
/** LEDGER-02: the ACCOUNT cell — the code with its letter ("P-6150"), or "—"; the ACCOUNT NAME cell — the chart's name, or "—". */
export const accountCellWords = (row: Pick<LedgerSheetRow, 'coa'>): string => (row.coa === null ? BLANK : row.coa.account);
export const accountNameCellWords = (row: Pick<LedgerSheetRow, 'coa'>): string => (row.coa === null || row.coa.name === null ? BLANK : row.coa.name);
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
/** TIMESHEET-01: the START, END and WENT cells — the row's fact (startOf, endOf, wentOf), "—" for a blank: an all-day line's END and WENT, a clock or minutes not stated. */
const factCellWords = (fact: string | null): string => (fact === null ? BLANK : fact);
export const startCellWords = (row: LedgerSheetRow): string => factCellWords(startOf(row));
export const endCellWords = (row: LedgerSheetRow): string => factCellWords(endOf(row));
export const wentCellWords = (row: LedgerSheetRow): string => factCellWords(wentOf(row));
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
/** TIMESHEET-02 (2026-11-24, ruling F.2): the note counts the rows the table lists — "row" / "rows" ("record" / "records" until then). */
export const noStayWords = (n: number): string => `${n} row${n === 1 ? '' : 's'} on days no stay covers`;
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
/** "time-sheet_2026-10-01_2026-10-31.csv" — TIMESHEET-01 (Alex, 2026-11-24): the file is named for the sheet ("task-ledger_…" until then). */
export const ledgerCsvFileName = (from: string, to: string): string => `time-sheet_${from}_${to}.csv`;
/**
 * The CSV's field for each column — the table's fact and nothing combined: DAY the full weekday, DATE 'YYYY-MM-DD', the text cells as the
 * table prints them with '' where the table prints "—" (a null is an EMPTY field, never 0 or "—"), STARS the number, money as dollars with
 * two decimals (csvMoney — BUDGET, ACTUAL as held whether done or skipped, VARIANCE, and MATCH — LEDGER-03: the readable sum,
 * readableMatchCents, else empty), UNDER / OVER the sign rule's word (varianceSignWords) or empty. Never the screen's cell helpers, which
 * print "—" for a null (the amendment: one marker on screen, an empty field here). Pure: no React, no DOM.
 */
export const LEDGER_CSV: Readonly<Record<LedgerColumn, (row: LedgerSheetRow) => string>> = {
  day: (row) => dayLongWords(row.day),
  date: (row) => row.day,
  // TIMESHEET-01: the three facts bare — START the clock or the all-day word, END the clock, WENT the word; a null is an EMPTY field.
  start: (row) => startOf(row) ?? '',
  end: (row) => endOf(row) ?? '',
  city: (row) => row.place === null ? '' : row.place.city,
  country: (row) => row.place === null || row.place.country === null ? '' : row.place.country,
  book: (row) => row.book ?? '',
  account: (row) => row.coa === null ? '' : row.coa.account,
  accountName: (row) => row.coa === null || row.coa.name === null ? '' : row.coa.name,
  subAccountName: (row) => row.description,
  vendor: (row) => row.vendor ?? '',
  went: (row) => wentOf(row) ?? '',
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
 * IDIOM-01 (Alex, 2026-10-24): THE LEDGER'S SPEC for the shared idiom (src/lib/table/columns.ts TableColumn) — the columns (twenty-one since TIMESHEET-01, over the sheet's rows; eighteen since TIME-03, sixteen until then) in the
 * head's order, each its head word, its kind (columnKind), its cell words (cellWordsOf — what a filter matches and a checklist lists), what
 * it sorts by (sortKeyOf), its CSV field (LEDGER_CSV), and by kind its cents (cellCentsOf) or its text (cellTextOf). Built here, after the
 * words and the CSV fields it reads; every rule the ledger exports calls the idiom with it.
 */
export const LEDGER_TABLE: readonly TableColumn<LedgerSheetRow, LedgerColumn>[] = LEDGER_COLUMNS.map((key): TableColumn<LedgerSheetRow, LedgerColumn> => {
  const base = { key, label: headWordOf(key), words: (row: LedgerSheetRow) => cellWordsOf(row, key), sortKey: (row: LedgerSheetRow) => sortKeyOf(row, key), csv: LEDGER_CSV[key] };
  switch (columnKind(key)) {
    case 'money': return { ...base, kind: 'money', cents: (row) => cellCentsOf(row, key as MoneyColumn) };
    case 'text': return { ...base, kind: 'text', text: (row) => cellTextOf(row, key as TextColumn) };
    case 'value': return { ...base, kind: 'value' };
  }
});
/** The ledger's column of the spec, by key. */
export const ledgerColumnOf = (column: LedgerColumn): TableColumn<LedgerSheetRow, LedgerColumn> => columnOf(LEDGER_TABLE, column);
/**
 * The rows shown, as a CSV — the idiom's writer over the ledger's spec (csv.ts tableCsv): the head words (twenty-one since TIMESHEET-01; eighteen since TIME-03), then one line per row
 * in the table's order, each field LEDGER_CSV's; RFC 4180 with minimal quoting (a field holding a comma, a quote, a CR or an LF is
 * quoted, its quotes doubled); every line ends CRLF, the last one too; UTF-8 with no BOM (the screen writes it as a Blob of this string).
 */
export function ledgerCsv(rows: readonly LedgerSheetRow[]): string {
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

// ── TIMESHEET-02 (Alex, 2026-11-24): THE RECORD ON THE ROW ──────────────────
//
// A row of the sheet takes its record where it is drawn: LedgerSection.tsx opens
// RecordForm.tsx under the row, handed the row's entry in `recording`. Here: the
// form's draft (recordDraftOf — from the held record, or blank), the one rule
// for what the form is given (recordInput — the boxes read in their order, the
// first bad one named, nothing filled in, the clock handed in) with the stops
// POST's body at the row's own address, and the words. The vendor is not this
// rule's: it is planned through the Budget's own box, above the form
// (stops/StopVendor.tsx). The write is the one writer's (stops/stopWrites.ts
// setStopRecord, clearStopRecord) and the stops route stays the authority — a
// refusal of its own is shown in its own words.

/** The form's boxes, in the order they stand — the order the rule reads them in. */
export const RECORD_FIELDS = ['went', 'actual', 'stars', 'minutes', 'note'] as const;
export type RecordField = (typeof RECORD_FIELDS)[number];
/** went | skipped — the WENT column's own two words for a record. */
export type RecordWent = typeof WENT_WORD | typeof SKIPPED_WORD;

/** The form's draft — went or skipped, and every box a string. */
export interface RecordDraft {
  readonly went: RecordWent;
  readonly actual: string;
  readonly stars: string;
  readonly minutes: string;
  readonly note: string;
}

/**
 * The draft a form opens with. From the held record: its outcome, its dollars (csv.ts csvMoney — two decimals from the integer
 * cents, so centsOf reads them back to the same cents), its stars, its minutes, its note. With none: went, every box blank.
 */
export function recordDraftOf(held: StopRecordRow | null): RecordDraft {
  if (held === null) return { went: WENT_WORD, actual: '', stars: '', minutes: '', note: '' };
  return {
    went: held.outcome === 'skipped' ? SKIPPED_WORD : WENT_WORD,
    actual: csvMoney(held.actual_cents),
    stars: held.rating === null ? '' : String(held.rating),
    minutes: held.actual_minutes === null ? '' : String(held.actual_minutes),
    note: held.note === null ? '' : held.note,
  };
}

export type RecordInputResult = { readonly ok: true; readonly body: StopBody } | { readonly ok: false; readonly field: RecordField; readonly message: string };
const refuseRecord = (field: RecordField, message: string): RecordInputResult => ({ ok: false, field, message });

/** went on a stop whose done time would run past the clock handed in plus the route's own skew (stopRecord.ts DONE_AT_SKEW_MS — stopInput's test), said before the write. */
export const STOP_AHEAD_WORDS = "this stop is still ahead — went is saved at the stop's own time; skip it with its reason, or record it once that time has come";
/** The two boxes' bounds, each named by its own head word (stopRecord.ts MINUTES_MAX, NOTE_MAX — the route's). */
export const MINUTES_RANGE_WORDS = `${headWordOf('loggedMinutes')} is 0 to ${MINUTES_MAX}`;
export const NOTE_LONG_WORDS = `${EXPENSE_FIELD_WORDS.note} is at most ${NOTE_MAX} characters`;

/**
 * THE ONE RULE FOR WHAT THE RECORD FORM IS GIVEN (ruling C) — the boxes read in their order, the first bad one named, nothing filled
 * in; the body is the stops POST's (stops/stopWrites.ts StopBody) at the row's own address (kind, id, instant).
 *   went → outcome 'done'. Its done_at has two states, one source each. An EDIT of a done record keeps that record's own done_at —
 * the sheet has no box for it, so it is never rewritten unseen. A FIRST went from the sheet — no record held, or a held skip — is
 * done at the stop's planned instant (RETRO-01's rule: recordBody, "done at the stop's own instant"). Neither stands in for the
 * other: a held done record with no done_at, and a done time that is no instant, are the read's error, thrown by name. A done_at
 * later than the clock handed in plus DONE_AT_SKEW_MS — the route's own test (stopRecord.ts stopInput) — is refused before the write.
 *   skipped → done_at null, and DESCRIPTION is required (stopRecord.ts SKIP_REASON_WORDS).
 *   ACTUAL: blank → null, never 0; else dollars by this file's centsOf. STARS: blank → null; else 1 to 5. LOGGED MIN: blank → null;
 * else a whole number from 0 to MINUTES_MAX. DESCRIPTION: trimmed, spaces collapsed; blank → null; at most NOTE_MAX characters.
 */
export function recordInput(draft: RecordDraft, address: LedgerAddress, given: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'>, now: Date): RecordInputResult {
  let doneAt: string | null = null;
  if (draft.went === WENT_WORD) {
    if (given.held !== null && given.held.outcome === 'done') {
      // An edit: the held record's own done time, kept.
      if (given.held.done_at === null) throw new Error(`ledger: record ${given.held.id} is done with no done_at — the stops route holds one for every done record`);
      doneAt = given.held.done_at;
    } else {
      // A first went from the sheet — no record held, or a held skip: done at the stop's planned instant.
      doneAt = given.plannedAt;
    }
    const at = Date.parse(doneAt);
    if (!Number.isFinite(at)) throw new Error(`ledger: ${JSON.stringify(doneAt)} is no instant — a done time is ISO text`);
    if (at > now.getTime() + DONE_AT_SKEW_MS) return refuseRecord('went', STOP_AHEAD_WORDS);
  }
  let actualCents: number | null = null;
  if (draft.actual.trim() !== '') {
    const read = centsOf(draft.actual.trim());
    if (!read.ok) return refuseRecord('actual', read.message);
    actualCents = read.cents;
  }
  let rating: number | null = null;
  if (draft.stars.trim() !== '') {
    if (!/^[1-5]$/.test(draft.stars.trim())) return refuseRecord('stars', starsTypedWords(draft.stars));
    rating = Number(draft.stars.trim());
  }
  let actualMinutes: number | null = null;
  if (draft.minutes.trim() !== '') {
    if (!/^\d+$/.test(draft.minutes.trim())) return refuseRecord('minutes', minutesTypedWords(draft.minutes));
    const typed = Number(draft.minutes.trim());
    if (typed > MINUTES_MAX) return refuseRecord('minutes', MINUTES_RANGE_WORDS);
    actualMinutes = typed;
  }
  const note = draft.note.trim().replace(/\s+/g, ' ');
  if (note.length > NOTE_MAX) return refuseRecord('note', NOTE_LONG_WORDS);
  if (draft.went === SKIPPED_WORD && note === '') return refuseRecord('note', SKIP_REASON_WORDS);
  return {
    ok: true,
    body: { kind: address.kind, id: address.id, instant: address.instant, outcome: draft.went === SKIPPED_WORD ? 'skipped' : 'done', done_at: doneAt, actual_cents: actualCents, rating, note: note === '' ? null : note, actual_minutes: actualMinutes },
  };
}

/** The chip in the WENT cell, and the form's own words — RecordForm.tsx prints these and a rule file's, and no sentence of its own. "cancel" is CANCEL_EXPENSE_WORDS, above. */
export const RECORD_WORDS = 'record';
export const RECORD_TITLE_WORDS = "this row's record — went is saved at the stop's own time; a done time already recorded is kept";
export const SAVE_RECORD_WORDS = 'save';
export const CLEAR_RECORD_WORDS = 'clear';
/** DESCRIPTION's placeholder while skipped — a skip needs its reason. */
export const SKIP_REASON_PLACEHOLDER_WORDS = 'why — required';
/** The STARS box's title — the rubric (stopRecord.ts RATING_WORDS), five to one, so a star typed here means what it means on the card. */
export const STARS_RUBRIC_WORDS = ([5, 4, 3, 2, 1] as const).map((n) => `${n} — ${RATING_WORDS[n]}`).join(' · ');
/** The form's labels: a column's own head word, or the "+ expense" form's — no second word for a thing the table already names. */
export const RECORD_FIELD_WORDS: Readonly<Record<RecordField, string>> = { went: headWordOf('went'), actual: EXPENSE_FIELD_WORDS.actual, stars: EXPENSE_FIELD_WORDS.stars, minutes: headWordOf('loggedMinutes'), note: EXPENSE_FIELD_WORDS.note };

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
