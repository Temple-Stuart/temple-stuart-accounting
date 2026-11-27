/**
 * pasteRows — ROWS PASTED FROM A SHEET: EVERY ROW READ, PLACED AND SHOWN. NOTHING IS WRITTEN (PASTE-01, Alex, 2026-11-25).
 *
 * "i gave you a spread sheet data i want to see, and im still seeing the old data" (2026-11-25) — and, the day before:
 * "Id love to make sure I can add in the spending details into the time tab, and can cut out the spread sheets."
 *
 * His spreadsheet has never been loaded into the app. This is the first of two steps: he pastes the sheet's rows on /time
 * (ledger/PasteRows.tsx) and sees each one twice on a line — as he typed it, and as the time sheet would hold it — with where
 * it lands, in words. The save is the next step; this one writes nothing.
 *
 * PURE: no fetch, no clock, no Prisma — the clock, the zone, the books, the time sheet's rows, the charts and the vendors are
 * handed in. Here, in order:
 *   1. THE COLUMNS — the sheet's own head words: the eleven read, the five required, the two lists named and not read.
 *   2. THE SPLIT — tab-separated text as a sheet copies it, quoted cells kept whole.
 *   3. THE PASTE, READ — its header, each row's number, each row cell by cell: the first cell that cannot be read is named.
 *   4. THE KINDS — a row's Entity, Category and Type; each kind is given one pick, by him.
 *   5. THE BOOKS AND THEIR PLANS — a book by its word; a book's plans from the time sheet's own rows.
 *   6. WHERE A ROW LANDS — one placement a row, decided in one order, nothing guessed and nothing written over.
 *   7. THE ROW SHOWN — YOUR SHEET, ON THE TIME SHEET, LANDS, a tone; and the one line of counts.
 * Every word the leaf prints is typed here, once. The only words of his sheet in this file are its column head words.
 *
 * PASTE-02 (Alex, 2026-11-27) — THE SAVE EXISTS NOW (its rule is src/lib/operations/pasteSave.ts; this file is still the read
 * and the placing), so a placement is exactly what the save does, and says no more than it does:
 *   · a row ON A STOP THAT STANDS writes only what the stop lacks — its vendor for the day, its record. What stands is kept,
 *     and is said only where the row says something else: a record that says what the row says is quiet (it was said on every
 *     such row until then — the same rows pasted after a save would have read as a warning a row);
 *   · that row's record is the record form's own body (ledger.ts recordInput), carried on the placement;
 *   · a NEW ONE-OFF is "+ expense"'s own (ledger.ts expenseInput): the placement carries that rule's values, and the stop's
 *     minutes — End Time less Start Time;
 *   · a stop of the row's own name already on the time sheet TAKES the row (it was refused until then);
 *   · the counts say how many one-offs are new; the picks that still stand after a read are worked here (standingPicks); and
 *     the vendor directory's answer is read here (vendorsOf).
 * Until then this file's title said nothing is written, and it was true. The file is still pure.
 */
import { deriveAccountString } from '@/lib/accountString';
import { centsFromDecimalString, isIsoDay } from '@/lib/budget/days';
import { BLANK, formatCents } from '@/lib/budget/format';
import { minutesOf } from '@/lib/calendar/day';
import {
  BOOK_WORDS, PLANNED_WORD, WENT_WORD, bookWordOf, budgetCellWords, cellWordsOf, expenseInput, headWordOf, recordInput,
  type BookWord, type ExpenseField, type ExpenseValues, type LedgerColumn, type LedgerRecording, type LedgerSheetRow, type RecordField, type RecordInputResult,
} from '@/lib/operations/ledger';
import { readVendorName, vendorNameKey } from '@/lib/operations/planVendor';
import { CENTS_MAX, DONE_AT_SKEW_MS, NOTE_MAX, NOT_RECORDED_WORDS, holdsControl } from '@/lib/operations/stopRecord';
import { csvMoney } from '@/lib/table/csv';
import { zonedToInstant } from '@/lib/time';

// ── 1 · THE COLUMNS ─────────────────────────────────────────────────────────

/** The sheet's columns this rule reads, by their own head words, in the order a row's cells are read. */
export const PASTE_READ_HEADS = ['Start Date', 'Start Time', 'End Time', 'Category', 'Entity', 'Type', 'Items', 'Vendor', 'Total (USD)', 'Budget (USD)', 'Days'] as const;
export type PasteHead = (typeof PASTE_READ_HEADS)[number];
/** The head words a paste must carry — without them the first row is not the sheet's header row. */
export const PASTE_REQUIRED_HEADS: readonly PasteHead[] = ['Start Date', 'Category', 'Entity', 'Type', 'Vendor'];
/** The sheet's columns the app has no column for yet — named, and not read. */
export const PASTE_NO_COLUMN_HEADS = ['Instagram Tag', 'Currency', 'Total', 'Location', 'Notes'] as const;
/** The sheet's columns the app works out itself, or that are a booking's — named, and not read. */
export const PASTE_WORKED_OUT_HEADS = ['End Date', 'Trip Name', 'Covers From', 'Covers To', 'Daily Cost (USD)', 'Under/Over'] as const;

/** A cell as it is read: trimmed, its runs of spaces (a tab and a line break among them) each one space. */
const clean = (cell: string): string => cell.trim().replace(/\s+/g, ' ');
/** Two words are one when, cleaned, they are equal ignoring case — the vendor names' own rule (planVendor.ts vendorNameKey), for head words, books and kinds. */
const keyOf = (text: string): string => clean(text).toLowerCase();

/** The three lines over the table: which of the pasted columns were not read, and why. A line is said only when it names a column. */
export const noColumnWords = (heads: readonly string[]): string => `no column for these yet — not read: ${heads.join(', ')}`;
export const workedOutWords = (heads: readonly string[]): string => `worked out by the app, or a booking's — not read: ${heads.join(', ')}`;
export const unknownHeadWords = (heads: readonly string[]): string => `not one of the sheet's columns — not read: ${heads.join(', ')}`;

// ── 2 · THE SPLIT ───────────────────────────────────────────────────────────

export const UNCLOSED_QUOTE_WORDS = 'a quoted cell is never closed — copy the rows from the sheet again';

export type PasteSplit = { readonly ok: true; readonly rows: readonly (readonly string[])[] } | { readonly ok: false; readonly words: string };

/**
 * Tab-separated text as a sheet copies it → its rows of cells. A row ends at a line break (CRLF, CR or LF), a cell at a tab.
 * A cell that OPENS with a double quote runs to its closing quote — tabs and line breaks kept, a doubled quote one quote; what
 * follows the closing quote, up to the next tab or line break, is kept after it. A quote inside an unquoted cell is itself. An
 * unclosed quote refuses the whole paste: nothing after it can be told apart.
 */
export function splitPaste(text: string): PasteSplit {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  const endCell = (): void => { row.push(cell); cell = ''; };
  const endRow = (): void => { endCell(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' && cell === '') {
      // A quoted cell: to its closing quote.
      i += 1;
      let closed = false;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          closed = true;
          i += 1;
          break;
        }
        cell += text[i];
        i += 1;
      }
      if (!closed) return { ok: false, words: UNCLOSED_QUOTE_WORDS };
      // Whatever stands between the closing quote and the cell's end is kept as typed.
      while (i < text.length && text[i] !== '\t' && text[i] !== '\n' && text[i] !== '\r') { cell += text[i]; i += 1; }
      continue;
    }
    if (ch === '\t') { endCell(); i += 1; continue; }
    if (ch === '\r') { endRow(); i += text[i + 1] === '\n' ? 2 : 1; continue; }
    if (ch === '\n') { endRow(); i += 1; continue; }
    cell += ch;
    i += 1;
  }
  endRow();
  return { ok: true, rows };
}

// ── 3 · THE PASTE, READ ─────────────────────────────────────────────────────

export const NOTHING_PASTED_WORDS = 'nothing was pasted';
export const NO_ROW_WORDS = 'the header row was read, and no row under it';
export const headTwiceWords = (head: PasteHead): string => `the header row has "${head}" twice`;
export const headsMissingWords = (heads: readonly PasteHead[]): string => `the first row must be the sheet's header row — it has no ${heads.map((head) => `"${head}"`).join(', ')}`;

/** A cell's refusals, each said after its head word. */
export const blankCellWords = (head: PasteHead): string => `${head} is blank`;
export const dayTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not a day (M/D/YY)`;
export const clockTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not a time (10:00 AM)`;
export const ITEMS_CONTROL_WORDS = 'Items holds a control character';
export const ITEMS_LONG_WORDS = `Items is at most ${NOTE_MAX} characters on a row`;
export const amountTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not an amount in dollars ($12.50)`;
export const AMOUNT_MOST_WORDS = `an amount is at most ${CENTS_MAX} cents`;
export const daysTypedWords = (typed: string): string => `${JSON.stringify(typed)} is not a number of days`;

/** A row's cells as he typed them — cleaned, '' for a blank one. What YOUR SHEET prints. */
export interface PasteTyped {
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly entity: string;
  readonly category: string;
  readonly type: string;
  readonly vendor: string;
  readonly items: string;
  readonly total: string;
}

/** A row's cells as they are read. A blank cell is null — never 0, never ''. */
export interface PasteCells {
  /** 'YYYY-MM-DD'. */
  readonly day: string;
  /** 'HH:MM', or none. */
  readonly start: string | null;
  readonly end: string | null;
  readonly category: string;
  readonly entity: string;
  readonly type: string;
  readonly items: string | null;
  /** The name as the directory would keep it (planVendor.ts readVendorName), or none. */
  readonly vendor: string | null;
  readonly totalCents: number | null;
  readonly budgetCents: number | null;
  readonly days: number | null;
}

/**
 * A row of the paste, read. `number` is its line in the paste, the header being row 1. `read`: every cell read — a stop, or
 * a booking when its Days is more than 1. `blank`: a date with nothing on it — read, and placed nowhere. `refused`: the FIRST
 * cell that could not be read, by its head word.
 */
export type PasteRow =
  | { readonly kind: 'read'; readonly number: number; readonly typed: PasteTyped; readonly cells: PasteCells }
  | { readonly kind: 'blank'; readonly number: number; readonly typed: PasteTyped; readonly day: string }
  | { readonly kind: 'refused'; readonly number: number; readonly typed: PasteTyped; readonly head: PasteHead; readonly why: string };

export interface Paste {
  readonly rows: readonly PasteRow[];
  /** The pasted columns that were not read — the sheet's own head words for the two known lists, the cell as typed for any other. */
  readonly noColumn: readonly string[];
  readonly workedOut: readonly string[];
  readonly unknown: readonly string[];
}

export type PasteRead = { readonly ok: true; readonly value: Paste } | { readonly ok: false; readonly words: string };

/** One cell, read: its value, or why it cannot be read. */
export type PasteCell<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly why: string };
const took = <T>(value: T): PasteCell<T> => ({ ok: true, value });
const not = <T>(why: string): PasteCell<T> => ({ ok: false, why });

const DAY_TYPED_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;
const two = (n: number): string => String(n).padStart(2, '0');

/** Start Date: M/D/YY or M/D/YYYY and a real day — a two-digit year is 20YY — as 'YYYY-MM-DD'. */
export function readDayCell(typed: string): PasteCell<string> {
  const text = clean(typed);
  if (text === '') return not(blankCellWords('Start Date'));
  const m = DAY_TYPED_RE.exec(text);
  if (m === null) return not(dayTypedWords(text));
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const day = `${String(year).padStart(4, '0')}-${two(Number(m[1]))}-${two(Number(m[2]))}`;
  return isIsoDay(day) ? took(day) : not(dayTypedWords(text));
}

const CLOCK_12_RE = /^(\d{1,2}):(\d{2}) (AM|PM)$/i;
const CLOCK_24_RE = /^(\d{1,2}):(\d{2})$/;

/** Start Time, End Time: blank → none; 'H:MM AM' or 'H:MM PM' (1 to 12), or 'HH:MM' (0 to 23), as 'HH:MM'. */
export function readClockCell(typed: string): PasteCell<string | null> {
  const text = clean(typed);
  if (text === '') return took(null);
  const twelve = CLOCK_12_RE.exec(text);
  if (twelve !== null) {
    const hour = Number(twelve[1]);
    const minute = Number(twelve[2]);
    if (hour < 1 || hour > 12 || minute > 59) return not(clockTypedWords(text));
    const pm = twelve[3].toUpperCase() === 'PM';
    return took(`${two((hour % 12) + (pm ? 12 : 0))}:${two(minute)}`);
  }
  const whole = CLOCK_24_RE.exec(text);
  if (whole !== null) {
    const hour = Number(whole[1]);
    const minute = Number(whole[2]);
    if (hour > 23 || minute > 59) return not(clockTypedWords(text));
    return took(`${two(hour)}:${two(minute)}`);
  }
  return not(clockTypedWords(text));
}

const AMOUNT_TYPED_RE = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** Total (USD), Budget (USD): blank → none; an optional $, digits with optional thousands commas, at most two decimals → cents, exactly. */
export function readAmountCell(typed: string): PasteCell<number | null> {
  const text = clean(typed);
  if (text === '') return took(null);
  const m = AMOUNT_TYPED_RE.exec(text);
  if (m === null) return not(amountTypedWords(text));
  const read = centsFromDecimalString(`${m[1].replace(/,/g, '')}${m[2] === undefined ? '' : `.${m[2]}`}`);
  // What the pattern above lets through has at most two decimals, so the one thing the cents rule can still refuse is an
  // amount past the safe range of cents — which is past the column's range too.
  if (!read.ok || read.cents > CENTS_MAX) return not(AMOUNT_MOST_WORDS);
  return took(read.cents);
}

/** Days: blank → none; a whole number, 1 or more. */
export function readDaysCell(typed: string): PasteCell<number | null> {
  const text = clean(typed);
  if (text === '') return took(null);
  if (!/^\d+$/.test(text)) return not(daysTypedWords(text));
  const days = Number(text);
  return Number.isSafeInteger(days) && days >= 1 ? took(days) : not(daysTypedWords(text));
}

/** One row's cells, read in the heads' order: the first that cannot be read is named and the row is placed nowhere. */
function readRow(number: number, cellOf: (head: PasteHead) => string): PasteRow {
  const typed: PasteTyped = {
    date: clean(cellOf('Start Date')), start: clean(cellOf('Start Time')), end: clean(cellOf('End Time')), entity: clean(cellOf('Entity')),
    category: clean(cellOf('Category')), type: clean(cellOf('Type')), vendor: clean(cellOf('Vendor')), items: clean(cellOf('Items')), total: clean(cellOf('Total (USD)')),
  };
  const refused = (head: PasteHead, why: string): PasteRow => ({ kind: 'refused', number, typed, head, why });
  const day = readDayCell(typed.date);
  if (!day.ok) return refused('Start Date', day.why);
  // A date with nothing on it: a day, and no Category, Type, Vendor or Entity. Read — and placed nowhere; not a refusal.
  if (typed.category === '' && typed.type === '' && typed.vendor === '' && typed.entity === '') return { kind: 'blank', number, typed, day: day.value };
  const start = readClockCell(typed.start);
  if (!start.ok) return refused('Start Time', start.why);
  const end = readClockCell(typed.end);
  if (!end.ok) return refused('End Time', end.why);
  if (typed.category === '') return refused('Category', blankCellWords('Category'));
  if (typed.entity === '') return refused('Entity', blankCellWords('Entity'));
  if (typed.type === '') return refused('Type', blankCellWords('Type'));
  if (holdsControl(typed.items)) return refused('Items', ITEMS_CONTROL_WORDS);
  if (typed.items.length > NOTE_MAX) return refused('Items', ITEMS_LONG_WORDS);
  let vendor: string | null = null;
  if (typed.vendor !== '') {
    const name = readVendorName(typed.vendor);
    if (!name.ok) return refused('Vendor', name.message);
    vendor = name.name;
  }
  const total = readAmountCell(typed.total);
  if (!total.ok) return refused('Total (USD)', total.why);
  const budget = readAmountCell(cellOf('Budget (USD)'));
  if (!budget.ok) return refused('Budget (USD)', budget.why);
  const days = readDaysCell(cellOf('Days'));
  if (!days.ok) return refused('Days', days.why);
  return {
    kind: 'read', number, typed,
    cells: { day: day.value, start: start.value, end: end.value, category: typed.category, entity: typed.entity, type: typed.type, items: typed.items === '' ? null : typed.items, vendor, totalCents: total.value, budgetCents: budget.value, days: days.value },
  };
}

/**
 * The paste, read. Rows with every cell blank are skipped; the first row left is the header, matched by the sheet's own head
 * words ignoring case and spacing. Refused whole, by name: an unclosed quote; nothing pasted; a read head word twice; a
 * required head missing; no row under the header. A row's number is its line in the paste, the header being row 1 — a blank
 * line under the header is skipped and still counted, so the numbers are the sheet's own.
 */
export function readPaste(text: string): PasteRead {
  const split = splitPaste(text);
  if (!split.ok) return { ok: false, words: split.words };
  const blank = (row: readonly string[]): boolean => row.every((cell) => clean(cell) === '');
  const headerAt = split.rows.findIndex((row) => !blank(row));
  if (headerAt < 0) return { ok: false, words: NOTHING_PASTED_WORDS };
  const header = split.rows[headerAt].map(keyOf);
  const at = new Map<PasteHead, number>();
  for (const head of PASTE_READ_HEADS) {
    const found = header.flatMap((cell, i) => (cell === keyOf(head) ? [i] : []));
    if (found.length > 1) return { ok: false, words: headTwiceWords(head) };
    if (found.length === 1) at.set(head, found[0]);
  }
  const missing = PASTE_REQUIRED_HEADS.filter((head) => !at.has(head));
  if (missing.length > 0) return { ok: false, words: headsMissingWords(missing) };
  // The columns not read, each named once: the sheet's own two lists by their head words, any other as it was typed.
  const read = new Set(PASTE_READ_HEADS.map(keyOf));
  const named = (list: readonly string[]): string[] => list.filter((head) => header.includes(keyOf(head)));
  const known = new Set([...PASTE_NO_COLUMN_HEADS, ...PASTE_WORKED_OUT_HEADS].map(keyOf));
  const unknown: string[] = [];
  for (const cell of split.rows[headerAt]) {
    const typed = clean(cell);
    if (typed === '' || read.has(keyOf(typed)) || known.has(keyOf(typed)) || unknown.some((seen) => keyOf(seen) === keyOf(typed))) continue;
    unknown.push(typed);
  }
  const rows: PasteRow[] = [];
  for (let i = headerAt + 1; i < split.rows.length; i += 1) {
    const cells = split.rows[i];
    if (blank(cells)) continue;
    rows.push(readRow(i - headerAt + 1, (head) => {
      const column = at.get(head);
      // A read column the header does not carry is a blank cell on every row; a row shorter than the header ends in blank cells.
      return column === undefined || column >= cells.length ? '' : cells[column];
    }));
  }
  if (rows.length === 0) return { ok: false, words: NO_ROW_WORDS };
  return { ok: true, value: { rows, noColumn: named(PASTE_NO_COLUMN_HEADS), workedOut: named(PASTE_WORKED_OUT_HEADS), unknown } };
}

/** The lines over the table for the columns not read — one for each list that names a column. */
export const notReadLines = (paste: Pick<Paste, 'noColumn' | 'workedOut' | 'unknown'>): string[] => [
  ...(paste.noColumn.length > 0 ? [noColumnWords(paste.noColumn)] : []),
  ...(paste.workedOut.length > 0 ? [workedOutWords(paste.workedOut)] : []),
  ...(paste.unknown.length > 0 ? [unknownHeadWords(paste.unknown)] : []),
];

/** The days the paste's readable rows cover — its first and last — or null when no row was read. The time sheet is read for these. */
export function pasteSpanOf(paste: Pick<Paste, 'rows'>): { readonly from: string; readonly to: string } | null {
  const days = paste.rows.flatMap((row) => (row.kind === 'read' ? [row.cells.day] : row.kind === 'blank' ? [row.day] : [])).sort();
  return days.length === 0 ? null : { from: days[0], to: days[days.length - 1] };
}

// ── 4 · THE KINDS ───────────────────────────────────────────────────────────

/** Category › Type — how a kind prints. */
export const kindWords = (category: string, type: string): string => `${category} › ${type}`;

/** A kind of row: its Entity, Category and Type, compared ignoring case and spacing. */
export interface PasteKind {
  /** What a pick is kept under. */
  readonly key: string;
  /** As the first row of the kind typed them. */
  readonly entity: string;
  /** Category › Type. */
  readonly words: string;
  /** Entity · Category › Type — the pick's label. */
  readonly label: string;
  /** How many rows of the paste are this kind's. */
  readonly rows: number;
}

/** A booking, not a stop: its Days is more than 1. */
const isBooking = (cells: PasteCells): boolean => cells.days !== null && cells.days > 1;
export const kindKeyOf = (cells: Pick<PasteCells, 'entity' | 'category' | 'type'>): string => JSON.stringify([keyOf(cells.entity), keyOf(cells.category), keyOf(cells.type)]);

/** The kinds of a paste: those of its rows that are STOPS — read, not a blank date, Days not more than 1 — in the paste's order, each with its count. */
export function pasteKindsOf(paste: Pick<Paste, 'rows'>): PasteKind[] {
  const kinds = new Map<string, PasteKind>();
  for (const row of paste.rows) {
    if (row.kind !== 'read' || isBooking(row.cells)) continue;
    const key = kindKeyOf(row.cells);
    const seen = kinds.get(key);
    const words = kindWords(row.cells.category, row.cells.type);
    kinds.set(key, seen === undefined ? { key, entity: row.cells.entity, words, label: `${row.cells.entity} · ${words}`, rows: 1 } : { ...seen, rows: seen.rows + 1 });
  }
  return [...kinds.values()];
}

// ── 5 · THE BOOKS AND THEIR PLANS ───────────────────────────────────────────

/** One of the user's books, as the provider lists it. */
export interface PasteBook {
  readonly id: string;
  readonly name: string;
  readonly entityType: string;
}
/** A book the paste can name: one whose entity type has a word (ledger.ts BOOK_WORDS). */
export interface OfferedBook extends PasteBook {
  readonly word: BookWord;
}

/** The books offered: named by their WORD. A book whose type has no word is not offered. */
export const offeredBooksOf = (books: readonly PasteBook[]): OfferedBook[] =>
  books.filter((book) => Object.prototype.hasOwnProperty.call(BOOK_WORDS, book.entityType)).map((book) => ({ ...book, word: bookWordOf(book.entityType) }));

/** The book an Entity cell names: the one book whose word it is, ignoring case and spacing — or that there is none, or two. */
export type NamedBook = { readonly kind: 'one'; readonly book: OfferedBook } | { readonly kind: 'none' } | { readonly kind: 'two' };
export function bookNamed(entity: string, books: readonly PasteBook[]): NamedBook {
  const named = offeredBooksOf(books).filter((book) => keyOf(book.word) === keyOf(entity));
  return named.length === 1 ? { kind: 'one', book: named[0] } : named.length === 0 ? { kind: 'none' } : { kind: 'two' };
}

/** The entry of a sheet row in the answer's `recording` — the read refuses an answer that lacks one, so a row without it is the caller's error, thrown by name. */
function entryOf(row: LedgerSheetRow, recording: Readonly<Record<string, LedgerRecording>>): LedgerRecording {
  if (!Object.prototype.hasOwnProperty.call(recording, row.key)) throw new Error(`pasteRows: the time sheet's row ${JSON.stringify(row.key)} has no entry in recording`);
  return recording[row.key];
}

/** THE PLANS of a book: the names of the time sheet's rows of that book whose entry takes a record — each once, in the sheet's order. */
export function plansOf(word: BookWord, sheet: readonly LedgerSheetRow[], recording: Readonly<Record<string, LedgerRecording>>): string[] {
  const plans: string[] = [];
  for (const row of sheet) {
    if (row.book !== word || !entryOf(row, recording).takes || plans.includes(row.description)) continue;
    plans.push(row.description);
  }
  return plans;
}

/** An account of a book's chart, as the chart route lists it. */
export interface PasteAccount {
  readonly code: string;
  readonly name: string;
}
/** code — name: an account as the pick offers it. */
export const accountWords = (account: PasteAccount): string => `${account.code} — ${account.name}`;

export const CHART_NO_ACCOUNTS_WORDS = 'the chart came back without its accounts';
/** A book's chart, read from the chart route's answer: `{ accounts: [{ code, name }] }` — or that it is not one. Never an empty list for an answer that holds none. */
export function chartOf(answer: Readonly<Record<string, unknown>>): { readonly ok: true; readonly accounts: readonly PasteAccount[] } | { readonly ok: false; readonly words: string } {
  const listed = answer.accounts;
  if (!Array.isArray(listed)) return { ok: false, words: CHART_NO_ACCOUNTS_WORDS };
  const accounts: PasteAccount[] = [];
  for (const account of listed as readonly unknown[]) {
    if (typeof account !== 'object' || account === null) return { ok: false, words: CHART_NO_ACCOUNTS_WORDS };
    const { code, name } = account as { readonly code?: unknown; readonly name?: unknown };
    if (typeof code !== 'string' || typeof name !== 'string') return { ok: false, words: CHART_NO_ACCOUNTS_WORDS };
    accounts.push({ code, name });
  }
  return { ok: true, accounts };
}
/** A read that failed, said with what it was for — never shown as an empty list. */
export const chartUnreadWords = (bookName: string, words: string): string => `the accounts of ${bookName} could not be read — ${words}`;
export const vendorsUnreadWords = (words: string): string => `the vendors could not be read — ${words}`;

/** One of the caller's vendors, as the directory lists it. */
export interface PasteVendor {
  readonly id: string;
  readonly vendor_name: string;
  readonly entity_id: string;
}

export const VENDORS_NO_LIST_WORDS = 'the list came back without its vendors';
/**
 * PASTE-02 (2026-11-27): the vendor directory's answer, read — `{ vendors: [{ id, vendor_name, entity_id }] }` as the caller's
 * vendors, or that it is not one: an answer that holds no list, or an entry that lacks one of the three. Never an empty list
 * for an answer that holds none. (The leaf read the list through the Budget's hook until then.)
 */
export function vendorsOf(answer: Readonly<Record<string, unknown>>): { readonly ok: true; readonly vendors: readonly PasteVendor[] } | { readonly ok: false; readonly words: string } {
  const listed = answer.vendors;
  if (!Array.isArray(listed)) return { ok: false, words: VENDORS_NO_LIST_WORDS };
  const vendors: PasteVendor[] = [];
  for (const vendor of listed as readonly unknown[]) {
    if (typeof vendor !== 'object' || vendor === null) return { ok: false, words: VENDORS_NO_LIST_WORDS };
    const { id, vendor_name, entity_id } = vendor as { readonly id?: unknown; readonly vendor_name?: unknown; readonly entity_id?: unknown };
    if (typeof id !== 'string' || typeof vendor_name !== 'string' || typeof entity_id !== 'string') return { ok: false, words: VENDORS_NO_LIST_WORDS };
    vendors.push({ id, vendor_name, entity_id });
  }
  return { ok: true, vendors };
}

// ── THE PICK ────────────────────────────────────────────────────────────────

/** Where he sends a kind: one of the book's plans, or a one-off under an account of the book. Nothing is picked for him. */
export type PastePick = { readonly kind: 'plan'; readonly plan: string } | { readonly kind: 'oneOff'; readonly code: string };

const PLAN_VALUE = 'plan:';
const ONE_OFF_VALUE = 'one-off:';
/** A pick as its select's value, and back. '' is no pick. A value that is neither is the caller's error, thrown by name. */
export const pickValueOf = (pick: PastePick | undefined): string => (pick === undefined ? '' : pick.kind === 'plan' ? `${PLAN_VALUE}${pick.plan}` : `${ONE_OFF_VALUE}${pick.code}`);
export function pickOfValue(value: string): PastePick | null {
  if (value === '') return null;
  if (value.startsWith(PLAN_VALUE)) return { kind: 'plan', plan: value.slice(PLAN_VALUE.length) };
  if (value.startsWith(ONE_OFF_VALUE)) return { kind: 'oneOff', code: value.slice(ONE_OFF_VALUE.length) };
  throw new Error(`pasteRows: ${JSON.stringify(value)} is not a pick — a plan, or a one-off under an account`);
}

/** What a kind's pick offers: its book's plans and its book's accounts — or nothing, when its Entity names no one book. */
export function pickOffersOf(kind: Pick<PasteKind, 'entity'>, context: Pick<PasteContext, 'books' | 'sheet' | 'recording' | 'charts'>): { readonly plans: readonly string[]; readonly accounts: readonly PasteAccount[] } | null {
  const named = bookNamed(kind.entity, context.books);
  if (named.kind !== 'one') return null;
  return { plans: plansOf(named.book.word, context.sheet, context.recording), accounts: chartFor(named.book, context.charts) };
}

/**
 * PASTE-02 (2026-11-27) — THE PICKS THAT STILL STAND. A pick is kept while the page is open, through a read and through closing
 * the box. After each read it is applied — and shown in its select — only while its kind is in the paste and what it names is
 * still offered (pickOffersOf): the plan among that book's plans, the account in that book's chart. A pick that no longer stands
 * is dropped here: never applied unseen.
 */
export function standingPicks(picks: Readonly<Record<string, PastePick>>, kinds: readonly Pick<PasteKind, 'key' | 'entity'>[], context: Pick<PasteContext, 'books' | 'sheet' | 'recording' | 'charts'>): Record<string, PastePick> {
  const standing: Record<string, PastePick> = {};
  for (const kind of kinds) {
    if (!Object.prototype.hasOwnProperty.call(picks, kind.key)) continue;
    const pick = picks[kind.key];
    const offers = pickOffersOf(kind, context);
    if (offers === null) continue;
    if (pick.kind === 'plan' ? offers.plans.includes(pick.plan) : offers.accounts.some((account) => account.code === pick.code)) standing[kind.key] = pick;
  }
  return standing;
}

// ── 6 · WHERE A ROW LANDS ───────────────────────────────────────────────────

/** What the page already holds, handed in: nothing here is read, and the clock and the zone are the caller's. */
export interface PasteContext {
  readonly books: readonly PasteBook[];
  /** The time sheet's rows for the days the paste covers, and each row's entry (ledgerReads.ts readLedger). */
  readonly sheet: readonly LedgerSheetRow[];
  readonly recording: Readonly<Record<string, LedgerRecording>>;
  /** Each offered book's chart, by the book's id. */
  readonly charts: Readonly<Record<string, readonly PasteAccount[]>>;
  readonly vendors: readonly PasteVendor[];
  /** The viewer's zone — a one-off's day and time are in it ("+ expense"'s own rule). */
  readonly zone: string;
  readonly now: Date;
}

/** A book's chart as it was read — a book whose chart was not read is the caller's error, thrown by name. */
function chartFor(book: OfferedBook, charts: PasteContext['charts']): readonly PasteAccount[] {
  if (!Object.prototype.hasOwnProperty.call(charts, book.id)) throw new Error(`pasteRows: the chart of the book ${JSON.stringify(book.name)} was not read`);
  return charts[book.id];
}

export const BOOKING_WORDS = 'a booking (its Days is more than 1) — bookings are not rows of the time sheet yet';
export const BLANK_DATE_WORDS = 'a date with nothing on it';
export const noBookWords = (typed: string, words: readonly string[]): string => `no book is called ${JSON.stringify(typed)} — the books here: ${words.join(', ')}`;
export const twoBooksWords = (typed: string): string => `two books are called ${JSON.stringify(typed)} — the paste cannot tell them apart`;
export const pickWaitingWords = (kind: string): string => `pick where ${kind} goes — a plan, or a one-off under an account`;
export const noStopWords = (plan: string): string => `the plan ${JSON.stringify(plan)} has no stop on this day`;
export const manyStopsWords = (plan: string): string => `the plan ${JSON.stringify(plan)} has more than one stop on this day — the paste cannot tell which`;
export const stopTakenWords = (row: number, plan: string): string => `row ${row} of the paste is already on this day's stop of ${JSON.stringify(plan)} — a second one needs its own Start Time and a one-off`;
export const noAccountWords = (code: string): string => `the book's chart has no account ${JSON.stringify(code)}`;
export const ONE_OFF_NO_START_WORDS = 'a one-off needs a Start Time';
export const ONE_OFF_NO_BUDGET_WORDS = 'a one-off needs a Budget (USD) above 0';
/** PASTE-02 (2026-11-27): one stop of the row's own name at its day and time takes the row; more than one cannot be told apart. ('already on the time sheet — …' refused the row until then.) */
export const manyNamedWords = (name: string): string => `more than one stop named ${JSON.stringify(name)} stands at this day and time — the paste cannot tell which`;

/** What is typed on a row and not written, each said by its head word. */
export const RECORDED_NOT_WRITTEN_WORDS = 'Total (USD), Items — not written: this stop is already recorded — the paste does not write over a record';
export const vendorNotWrittenWords = (standing: string): string => `Vendor — not written: this stop already has the vendor ${JSON.stringify(standing)} — the paste does not change a vendor`;
export const ITEMS_AHEAD_WORDS = 'Items — not written: the stop is still ahead, and a planned stop holds none yet';
export const TOTAL_AHEAD_WORDS = 'Total (USD) — not written: the stop is still ahead';
export const ITEMS_NO_TOTAL_WORDS = 'Items — not written: the row holds no Total (USD), so no record is made';
/** PASTE-02 (2026-11-27): the End Time of a one-off — a new one whose End Time is its Start Time has no minutes to write; one that already stands keeps its own end. */
export const END_IS_START_WORDS = 'End Time — not written: it is the Start Time';
export const END_STANDS_WORDS = 'End Time — not written: this stop already stands, with its own end';

/** THE VENDOR of a placed row: none; the book's own, by the directory's own name rule; or new to the book. */
export type PastedVendor = { readonly kind: 'none' } | { readonly kind: 'own'; readonly id: string; readonly name: string } | { readonly kind: 'new'; readonly name: string };

/** WHAT HAPPENED at a placed row's stop that has no record: recorded went with this row's amount and items · planned, still ahead · no record is made. */
export type PastedOutcome =
  | { readonly kind: 'went'; readonly cents: number; readonly items: string | null }
  | { readonly kind: 'planned' }
  | { readonly kind: 'not recorded' };
/** …or, on a stop that stands, the stop's own record stands. A new one-off is a new stop: it has no record to stand. */
export type PastedHappened = PastedOutcome | { readonly kind: 'recorded' };

/**
 * PASTE-02 (2026-11-27): the stops POST's body as the record form's rule reads it (ledger.ts recordInput) — typed from that rule's
 * result: neither this file nor pasteSave.ts reads the one writer's file.
 */
export type PasteRecordBody = Extract<RecordInputResult, { readonly ok: true }>['body'];

/** Where a row lands — one placement a row. */
export type PastePlacement =
  | { readonly kind: 'refused'; readonly head: PasteHead; readonly why: string }
  | { readonly kind: 'blank' }
  | { readonly kind: 'booking' }
  | { readonly kind: 'pick'; readonly words: string }
  | {
    /** ON A STOP THAT STANDS. `standing` false: the day's stop of the plan picked, `plan` that plan's name. `standing` true (PASTE-02): a kind picked a one-off whose stop — its own name, at its day and Start Time — already stood on the time sheet; `plan` is that stop's name. */
    readonly kind: 'plan'; readonly book: OfferedBook; readonly plan: string; readonly standing: boolean;
    readonly stop: LedgerSheetRow; readonly instant: string; readonly vendor: PastedVendor; readonly happened: PastedHappened;
    /** PASTE-02: the record the save sends when this row is recorded went — the record form's own body, done at the stop's planned instant; null when no record is written. */
    readonly record: PasteRecordBody | null;
    readonly notWritten: readonly string[];
  }
  | {
    /** A NEW ONE-OFF. */
    readonly kind: 'oneOff'; readonly book: OfferedBook; readonly account: PasteAccount;
    /** PASTE-02: what "+ expense"'s own rule read for this stop (ledger.ts expenseInput) — the bodies the save sends are built from it. */
    readonly values: ExpenseValues;
    /** The new stop's own facts: its Start Time ('HH:MM'); its End Time, when its minutes are written (PASTE-02), and those minutes; its name and its instant, the values' own; its Budget (USD), above 0. */
    readonly start: string; readonly end: string | null; readonly minutes: number | null; readonly name: string; readonly budgetCents: number;
    readonly instant: string; readonly vendor: PastedVendor; readonly happened: PastedOutcome; readonly notWritten: readonly string[];
  };

/** The vendor of a placed row: none typed → none; the book's own when the names are one (vendorNameKey) → that vendor; else new. Another book's vendor of the same name is not this book's. */
export function pastedVendorOf(name: string | null, book: Pick<OfferedBook, 'id'>, vendors: readonly PasteVendor[]): PastedVendor {
  if (name === null) return { kind: 'none' };
  const own = vendors.find((vendor) => vendor.entity_id === book.id && vendorNameKey(vendor.vendor_name) === vendorNameKey(name));
  return own === undefined ? { kind: 'new', name } : { kind: 'own', id: own.id, name: own.vendor_name };
}

/**
 * What happened at a stop that has no record, against the clock handed in: later than it plus DONE_AT_SKEW_MS — the stops
 * rule's own test for a done time — the stop is PLANNED, and the row's Items and Total (USD), if typed, are each said as not
 * written. Else, with a Total (USD), it is RECORDED WENT. Else NOT RECORDED, and its Items, if typed, is said. Never a guess.
 */
function happenedAt(instant: string, cells: PasteCells, now: Date): { readonly happened: PastedOutcome; readonly notWritten: readonly string[] } {
  const at = Date.parse(instant);
  if (!Number.isFinite(at)) throw new Error(`pasteRows: ${JSON.stringify(instant)} is no instant — a stop's time is ISO text`);
  if (at > now.getTime() + DONE_AT_SKEW_MS) {
    return { happened: { kind: 'planned' }, notWritten: [...(cells.items === null ? [] : [ITEMS_AHEAD_WORDS]), ...(cells.totalCents === null ? [] : [TOTAL_AHEAD_WORDS])] };
  }
  if (cells.totalCents !== null) return { happened: { kind: 'went', cents: cells.totalCents, items: cells.items }, notWritten: [] };
  return { happened: { kind: 'not recorded' }, notWritten: cells.items === null ? [] : [ITEMS_NO_TOTAL_WORDS] };
}

/** The record form's boxes the paste fills, each under the sheet column it is filled from. It fills no stars and no minutes. */
const RECORD_HEADS: Readonly<Record<Exclude<RecordField, 'stars' | 'minutes'>, PasteHead>> = { went: 'Start Date', actual: 'Total (USD)', note: 'Items' };
/** "+ expense"'s boxes the paste fills, each under the sheet column it is filled from. It fills no stars. */
const EXPENSE_HEADS: Readonly<Record<Exclude<ExpenseField, 'stars'>, PasteHead>> = {
  day: 'Start Date', time: 'Start Time', name: 'Type', amount: 'Budget (USD)', coa: 'Category', book: 'Entity', vendor: 'Vendor', actual: 'Total (USD)', note: 'Items',
};
/** A refusal of the record form's rule, in its own words, under the column its box was filled from. A box the paste never fills is this file's error, thrown by name. */
function refusedByRecord(field: RecordField, message: string): PastePlacement {
  if (field === 'stars' || field === 'minutes') throw new Error(`pasteRows: the record's rule refused ${field}, which the paste never fills — ${message}`);
  return { kind: 'refused', head: RECORD_HEADS[field], why: message };
}
/** A refusal of "+ expense"'s rule, in the form's own words, under the column its box was filled from. */
function refusedByExpense(field: ExpenseField, message: string): PastePlacement {
  if (field === 'stars') throw new Error(`pasteRows: "+ expense"'s rule refused stars, which the paste never fills — ${message}`);
  return { kind: 'refused', head: EXPENSE_HEADS[field], why: message };
}

const DAY_MINUTES = 24 * 60;
/** A row's clock ('HH:MM', as readClockCell reads one) as minutes past midnight (calendar/day.ts minutesOf); a text that is no clock is this file's error, thrown by name. */
const clockMinutes = (clock: string): number => {
  const minutes = minutesOf(clock);
  if (minutes === null) throw new Error(`pasteRows: ${JSON.stringify(clock)} is not a clock — a row's time is HH:MM`);
  return minutes;
};

/**
 * WHERE EVERY ROW LANDS — one placement a row, in the paste's order, decided in this order and nothing guessed:
 *   a. its unread cell → refused, that cell named;       b. a date with nothing on it → blank;
 *   c. Days more than 1 → a booking;                      d. no book, or two, carry its Entity's word → refused on Entity;
 *   e. no pick for its kind → waiting for a pick;         f. picked on a plan → that plan's one stop of the day;
 *   g. picked a one-off → the stop of its own name already standing at its day and Start Time (PASTE-02), else a new stop
 *      at its day and Start Time in the viewer's zone, read by "+ expense"'s own rule;
 *   h. the vendor;                                        i. what happened.
 * The paste never writes over what stands: a stop that already has a record keeps it, and a stop whose planned vendor is
 * another name keeps it — each said only where the row says something else (PASTE-02). A stop an earlier row of the paste
 * already holds is not taken twice.
 */
export function placePaste(paste: Pick<Paste, 'rows'>, picks: Readonly<Record<string, PastePick>>, context: PasteContext): PastePlacement[] {
  const offered = offeredBooksOf(context.books);
  /** The stops rows of this paste already hold, by the sheet row's key → the paste row's number. */
  const held = new Map<string, number>();

  /**
   * A ROW ON A STOP THAT STANDS (PASTE-02, ruling A.1) — ONE path for the day's stop of a plan and for a stop of the row's own
   * name already on the time sheet (`standing`). Of the row, only what the stop lacks is written: its VENDOR for this day when the
   * stop has none; its RECORD when the stop has none, the row holds a Total (USD) and its time has come. What stands is never
   * written over, and is said only where the row says something else.
   */
  const onStop = (number: number, cells: PasteCells, book: OfferedBook, stop: LedgerSheetRow, plan: string, standing: boolean): PastePlacement => {
    const entry = entryOf(stop, context.recording);
    if (!entry.takes) return { kind: 'refused', head: 'Type', why: entry.words };
    const earlier = held.get(stop.key);
    if (earlier !== undefined) return { kind: 'refused', head: 'Type', why: stopTakenWords(earlier, plan) };
    // The vendor: the stop's own planned vendor stands — another name is kept and said, the same name is nothing to write.
    const planned = stop.vendor;
    const vendorSaid = planned !== null && cells.vendor !== null && vendorNameKey(planned) !== vendorNameKey(cells.vendor) ? [vendorNotWrittenWords(planned)] : [];
    const vendor = planned === null ? pastedVendorOf(cells.vendor, book, context.vendors) : { kind: 'none' as const };
    // A stop of the row's own name keeps its own end: an End Time typed that is not its END cell is said. (A plan's stop is found by its day and its plan — the row's times are not read for it.)
    const endSaid = standing && cells.end !== null && cells.end !== cellWordsOf(stop, 'end') ? [END_STANDS_WORDS] : [];
    if (entry.held !== null) {
      // A record stands: kept. It is quiet when it says what the row says — done, the row's Total (USD) its amount, the row's Items its note (none equal to none). In every other
      // case where the row holds a Total (USD) or Items, it is said. A skipped record is a record: kept, and said.
      const same = entry.held.outcome === 'done' && entry.held.actual_cents === cells.totalCents && entry.held.note === cells.items;
      const recordSaid = !same && (cells.totalCents !== null || cells.items !== null) ? [RECORDED_NOT_WRITTEN_WORDS] : [];
      held.set(stop.key, number);
      return { kind: 'plan', book, plan, standing, stop, instant: entry.plannedAt, vendor, happened: { kind: 'recorded' }, record: null, notWritten: [...recordSaid, ...vendorSaid, ...endSaid] };
    }
    const { happened, notWritten } = happenedAt(entry.plannedAt, cells, context.now);
    // THE RECORD'S BODY IS THE RECORD FORM'S (ruling A.2): read by the one rule for a row's record, its boxes filled from the row — went, the Total (USD) as dollars, the Items — at
    // the sheet row's own address, with the entry's planned instant and the clock the rows are placed with. So it is done at the stop's planned instant, as the row's own form
    // saves a first went. A refusal of that rule refuses the row, in the rule's words, and the row holds no stop.
    let record: PasteRecordBody | null = null;
    if (happened.kind === 'went') {
      const read = recordInput({ went: WENT_WORD, actual: csvMoney(happened.cents), stars: '', minutes: '', note: happened.items === null ? '' : happened.items }, stop.address, { plannedAt: entry.plannedAt, held: entry.held }, context.now);
      if (!read.ok) return refusedByRecord(read.field, read.message);
      record = read.body;
    }
    held.set(stop.key, number);
    return { kind: 'plan', book, plan, standing, stop, instant: entry.plannedAt, vendor, happened, record, notWritten: [...notWritten, ...vendorSaid, ...endSaid] };
  };

  return paste.rows.map((row): PastePlacement => {
    if (row.kind === 'refused') return { kind: 'refused', head: row.head, why: row.why };
    if (row.kind === 'blank') return { kind: 'blank' };
    const cells = row.cells;
    if (isBooking(cells)) return { kind: 'booking' };
    const named = bookNamed(cells.entity, context.books);
    if (named.kind === 'none') return { kind: 'refused', head: 'Entity', why: noBookWords(cells.entity, [...new Set(offered.map((book) => book.word))]) };
    if (named.kind === 'two') return { kind: 'refused', head: 'Entity', why: twoBooksWords(cells.entity) };
    const book = named.book;
    const key = kindKeyOf(cells);
    if (!Object.prototype.hasOwnProperty.call(picks, key)) return { kind: 'pick', words: pickWaitingWords(kindWords(cells.category, cells.type)) };
    const pick = picks[key];

    if (pick.kind === 'plan') {
      const stops = context.sheet.filter((stop) => stop.day === cells.day && stop.book === book.word && stop.description === pick.plan);
      if (stops.length === 0) return { kind: 'refused', head: 'Start Date', why: noStopWords(pick.plan) };
      if (stops.length > 1) return { kind: 'refused', head: 'Start Date', why: manyStopsWords(pick.plan) };
      return onStop(row.number, cells, book, stops[0], pick.plan, false);
    }

    const account = chartFor(book, context.charts).find((listed) => listed.code === pick.code);
    if (account === undefined) return { kind: 'refused', head: 'Category', why: noAccountWords(pick.code) };
    const start = cells.start;
    if (start === null) return { kind: 'refused', head: 'Start Time', why: ONE_OFF_NO_START_WORDS };
    // PASTE-02 (ruling A.4) — A STOP OF THE ROW'S OWN NAME ALREADY ON THE TIME SHEET TAKES THE ROW: that book, that day, that Start Time and that name (the row's Type, exactly). One
    // such stop → the row lands on it, by the one path above, and needs no Budget (USD). More than one cannot be told apart. (The row was refused as 'already on the time sheet' until
    // then — so a one-off the save had written could never take its own row again.)
    const own = context.sheet.filter((stop) => stop.book === book.word && stop.day === cells.day && stop.time === start && stop.description === cells.type);
    if (own.length > 1) return { kind: 'refused', head: 'Type', why: manyNamedWords(cells.type) };
    if (own.length === 1) return onStop(row.number, cells, book, own[0], own[0].description, true);
    if (cells.budgetCents === null || cells.budgetCents === 0) return { kind: 'refused', head: 'Budget (USD)', why: ONE_OFF_NO_BUDGET_WORDS };

    // PASTE-02 (ruling A.3) — A NEW ONE-OFF IS "+ EXPENSE"'S: read by that form's ONE rule, its boxes filled from the row. The record's two boxes are filled only when the row is
    // recorded went — a stop still ahead, or a row with no Total (USD), has no record to make. A refusal of that rule refuses the row, in the form's words.
    const instant = zonedToInstant(cells.day, start, context.zone).toISOString();
    const { happened, notWritten } = happenedAt(instant, cells, context.now);
    const vendor = pastedVendorOf(cells.vendor, book, context.vendors);
    const read = expenseInput({
      day: cells.day, time: start, name: cells.type, amount: csvMoney(cells.budgetCents), coa: account.code, book: book.id,
      vendorId: vendor.kind === 'own' ? vendor.id : '', vendorName: vendor.kind === 'new' ? vendor.name : '',
      actual: happened.kind === 'went' ? csvMoney(happened.cents) : '', stars: '', note: happened.kind === 'went' && happened.items !== null ? happened.items : '',
    }, context.zone, context.now);
    if (!read.ok) return refusedByExpense(read.field, read.message);
    const values = read.value;
    // The form's rule reads the stop's instant, and whether it is still ahead, by the same test this file placed the row with. The two disagreeing is this file's error, thrown by name.
    if (values.instant !== instant || values.ahead !== (happened.kind === 'planned')) {
      throw new Error(`pasteRows: row ${row.number} was placed at ${instant} (${happened.kind}) and "+ expense"'s rule reads ${values.instant} (${values.ahead ? 'still ahead' : 'not ahead'})`);
    }
    // ITS MINUTES: End Time less Start Time; an End Time earlier than the Start Time ends the next day (23:00 to 01:00 is 120). No End Time → none. An End Time that IS the Start
    // Time → none, and said. The END cell shows the End Time only when its minutes are written.
    const span = cells.end === null ? null : (clockMinutes(cells.end) - clockMinutes(start) + DAY_MINUTES) % DAY_MINUTES;
    const minutes = span === null || span === 0 ? null : span;
    return {
      kind: 'oneOff', book, account, values, start, end: minutes === null ? null : cells.end, minutes, name: values.name, budgetCents: cells.budgetCents, instant: values.instant,
      vendor, happened, notWritten: span === 0 ? [...notWritten, END_IS_START_WORDS] : notWritten,
    };
  });
}

// ── 7 · THE ROW SHOWN ───────────────────────────────────────────────────────

/** The table's two group heads, and the last column's. */
export const YOUR_SHEET_WORDS = 'YOUR SHEET';
export const ON_TIME_SHEET_WORDS = 'ON THE TIME SHEET';
export const LANDS_WORDS = 'LANDS';

/** A column of the table: its head word, whether its cells are short (kept on one line), and whether it is money (set right). */
export interface PasteColumn {
  readonly head: string;
  readonly short: boolean;
  readonly money: boolean;
}
/** YOUR SHEET — the row as he typed it. */
export const YOUR_SHEET_COLUMNS: readonly PasteColumn[] = [
  { head: 'ROW', short: true, money: false }, { head: 'DATE', short: true, money: false }, { head: 'TIME', short: true, money: false }, { head: 'ENTITY', short: true, money: false },
  { head: 'CATEGORY › TYPE', short: false, money: false }, { head: 'VENDOR', short: false, money: false }, { head: 'ITEMS', short: false, money: false }, { head: 'TOTAL (USD)', short: true, money: true },
];
/** ON THE TIME SHEET — the time sheet's own columns, by its own head words. */
export const ON_TIME_SHEET_KEYS = ['start', 'end', 'account', 'accountName', 'subAccountName', 'went', 'budget', 'actual'] as const satisfies readonly LedgerColumn[];
type SheetKey = (typeof ON_TIME_SHEET_KEYS)[number];
const LONG_KEYS: readonly SheetKey[] = ['accountName', 'subAccountName'];
const MONEY_KEYS: readonly SheetKey[] = ['budget', 'actual'];
export const ON_TIME_SHEET_COLUMNS: readonly PasteColumn[] = ON_TIME_SHEET_KEYS.map((key) => ({ head: headWordOf(key), short: !LONG_KEYS.includes(key), money: MONEY_KEYS.includes(key) }));

/** A row's tone: placed · waiting for a pick · refused · quiet (a booking, a blank date). */
export type PasteTone = 'placed' | 'pick' | 'refused' | 'quiet';

/** A row of the table: the paste's row number, its two halves cell for cell, where it lands in words, and its tone. */
export interface PasteShownRow {
  readonly number: number;
  /** YOUR SHEET's eight cells. */
  readonly yours: readonly string[];
  /** ON THE TIME SHEET's eight cells. */
  readonly sheet: readonly string[];
  readonly lands: string;
  readonly tone: PasteTone;
}

const typedCell = (typed: string): string => (typed === '' ? BLANK : typed);
/** YOUR SHEET: ROW, DATE, TIME (start, or start – end), ENTITY, CATEGORY › TYPE, VENDOR, ITEMS, TOTAL (USD) — a blank cell is the sheet's BLANK. */
function yourCells(row: PasteRow): string[] {
  const t = row.typed;
  const time = t.start === '' && t.end === '' ? BLANK : t.end === '' ? t.start : `${typedCell(t.start)} – ${t.end}`;
  const kind = t.category === '' && t.type === '' ? BLANK : kindWords(typedCell(t.category), typedCell(t.type));
  return [String(row.number), typedCell(t.date), time, typedCell(t.entity), kind, typedCell(t.vendor), typedCell(t.items), typedCell(t.total)];
}

const NOWHERE_CELLS: readonly string[] = ON_TIME_SHEET_KEYS.map(() => BLANK);
/** WENT, for a stop that has no record — the time sheet's own three words. */
const OUTCOME_WORD: Readonly<Record<PastedOutcome['kind'], string>> = { went: WENT_WORD, planned: PLANNED_WORD, 'not recorded': NOT_RECORDED_WORDS };

/** ON THE TIME SHEET, for a placed row. A row placed nowhere: every cell blank. */
function sheetCells(placement: PastePlacement): readonly string[] {
  if (placement.kind === 'plan') {
    // The stop's own cells — but WENT reads went when this row is recorded and planned when its stop is still ahead, and ACTUAL reads this row's amount when it is recorded.
    const { stop, happened } = placement;
    return ON_TIME_SHEET_KEYS.map((key) => {
      if (key === 'went' && (happened.kind === 'went' || happened.kind === 'planned')) return OUTCOME_WORD[happened.kind];
      if (key === 'actual' && happened.kind === 'went') return budgetCellWords(happened.cents);
      return cellWordsOf(stop, key);
    });
  }
  if (placement.kind === 'oneOff') {
    // A new stop: its own Start Time and End Time (PASTE-02: the End Time only when its minutes are written — `end` is null otherwise), the account's label and name, its Type, what happened, and its two amounts.
    const cell: Readonly<Record<SheetKey, string>> = {
      start: placement.start,
      end: placement.end === null ? BLANK : placement.end,
      account: deriveAccountString({ entityType: placement.book.entityType, code: placement.account.code }),
      accountName: placement.account.name,
      subAccountName: placement.name,
      went: OUTCOME_WORD[placement.happened.kind],
      budget: budgetCellWords(placement.budgetCents),
      actual: budgetCellWords(placement.happened.kind === 'went' ? placement.happened.cents : null),
    };
    return ON_TIME_SHEET_KEYS.map((key) => cell[key]);
  }
  return NOWHERE_CELLS;
}

/** LANDS — a placed row's parts, joined by ' · '. */
export const onPlanWords = (plan: string, start: string): string => `on ${JSON.stringify(plan)}, its ${start} stop`;
/** PASTE-02 (2026-11-27): a kind picked a one-off whose stop already stands. */
export const onStandingWords = (name: string, start: string): string => `on the stop ${JSON.stringify(name)} at ${start}, already on the time sheet`;
export const oneOffWords = (start: string, label: string, name: string): string => `a one-off at ${start}, under ${label} ${name}`;
export const vendorOwnWords = (book: string): string => `vendor: ${book}'s own`;
export const vendorNewWords = (book: string): string => `vendor: new to ${book}`;
export const recordedWentWords = (cents: number): string => `recorded: went, ${formatCents(cents)}`;
export const PLANNED_AHEAD_WORDS = 'planned: still ahead';
export const ALREADY_RECORDED_WORDS = 'already recorded';
export const NO_TOTAL_WORDS = 'not recorded: no Total (USD)';
/** A refusal: its head word, then why. */
export const cellRefusedWords = (head: PasteHead, why: string): string => `${head} — ${why}`;

const vendorPart = (vendor: PastedVendor, book: OfferedBook): string[] => (vendor.kind === 'none' ? [] : [vendor.kind === 'own' ? vendorOwnWords(book.word) : vendorNewWords(book.word)]);
const happenedWords = (happened: PastedHappened): string => (happened.kind === 'went' ? recordedWentWords(happened.cents) : happened.kind === 'planned' ? PLANNED_AHEAD_WORDS : happened.kind === 'recorded' ? ALREADY_RECORDED_WORDS : NO_TOTAL_WORDS);

/** Where a row lands, in words: a placed row's parts — where, the vendor, what happened, each not-written sentence; a row placed nowhere, its reason. */
export function landsWords(placement: PastePlacement): string {
  switch (placement.kind) {
    case 'refused': return cellRefusedWords(placement.head, placement.why);
    case 'blank': return BLANK_DATE_WORDS;
    case 'booking': return BOOKING_WORDS;
    case 'pick': return placement.words;
    case 'plan': {
      const start = cellWordsOf(placement.stop, 'start');
      return [placement.standing ? onStandingWords(placement.plan, start) : onPlanWords(placement.plan, start), ...vendorPart(placement.vendor, placement.book), happenedWords(placement.happened), ...placement.notWritten].join(' · ');
    }
    case 'oneOff': {
      const label = deriveAccountString({ entityType: placement.book.entityType, code: placement.account.code });
      return [oneOffWords(placement.start, label, placement.account.name), ...vendorPart(placement.vendor, placement.book), happenedWords(placement.happened), ...placement.notWritten].join(' · ');
    }
  }
}

export const toneOf = (placement: PastePlacement): PasteTone => (placement.kind === 'plan' || placement.kind === 'oneOff' ? 'placed' : placement.kind === 'pick' ? 'pick' : placement.kind === 'refused' ? 'refused' : 'quiet');

/** The table's rows — one a row of the paste, in its order. The placements are placePaste's, row for row. */
export function pasteShown(paste: Pick<Paste, 'rows'>, placements: readonly PastePlacement[]): PasteShownRow[] {
  if (placements.length !== paste.rows.length) throw new Error(`pasteRows: ${placements.length} placements for ${paste.rows.length} rows — one placement a row`);
  return paste.rows.map((row, i) => ({ number: row.number, yours: yourCells(row), sheet: sheetCells(placements[i]), lands: landsWords(placements[i]), tone: toneOf(placements[i]) }));
}

/**
 * The one line that counts the paste — every row once. PASTE-02 (2026-11-27): "on a plan" counts the rows on a plan's stop; a row of
 * a kind picked a one-off that landed on its own stop, already on the time sheet, is a one-off — so the one-offs are those and the
 * new ones, and the new ones (which the save would add) are said: '3 one-offs (2 new)', '1 one-off (1 new)'; with none, '0 one-offs'.
 */
export function countsWords(placements: readonly PastePlacement[]): string {
  const count = (kind: PastePlacement['kind']): number => placements.filter((placement) => placement.kind === kind).length;
  const said = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  const standing = placements.filter((placement) => placement.kind === 'plan' && placement.standing).length;
  const fresh = count('oneOff');
  const oneOffs = standing + fresh;
  return [
    said(placements.length, 'row read', 'rows read'),
    `${count('plan') - standing} on a plan`,
    oneOffs === 0 ? '0 one-offs' : `${said(oneOffs, 'one-off', 'one-offs')} (${fresh} new)`,
    said(count('booking'), 'booking', 'bookings'),
    `${count('pick')} waiting for a pick`,
    `${count('refused')} that cannot be placed`,
    said(count('blank'), 'date with nothing on it', 'dates with nothing on them'),
  ].join(' · ');
}

// ── THE LEAF'S OWN WORDS ────────────────────────────────────────────────────

export const PASTE_OPEN_WORDS = '+ paste rows from a sheet';
/** PASTE-02 (2026-11-27): '… nothing is written' until then — there was no save. */
export const PASTE_TITLE_WORDS = 'rows from your sheet — read and placed here; nothing is written until you save';
export const PASTE_HOW_WORDS = 'copy the rows in your sheet with its header row, and paste them here';
export const PASTE_READ_WORDS = 'read the rows';
export const PASTE_CLEAR_WORDS = 'clear';
export const PASTE_CLOSE_WORDS = 'close';
export const PASTE_PICKS_WORDS = 'where each kind of row goes — nothing is chosen for you';
export const PASTE_NO_PICK_WORDS = '— pick —';
export const PASTE_ON_PLAN_WORDS = 'on your plan';
export const PASTE_ONE_OFF_WORDS = 'a one-off, under';
