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
 */
import { deriveAccountString } from '@/lib/accountString';
import { centsFromDecimalString, isIsoDay } from '@/lib/budget/days';
import { BLANK, formatCents } from '@/lib/budget/format';
import {
  BOOK_WORDS, PLANNED_WORD, WENT_WORD, bookWordOf, budgetCellWords, cellWordsOf, headWordOf,
  type BookWord, type LedgerColumn, type LedgerRecording, type LedgerSheetRow,
} from '@/lib/operations/ledger';
import { readVendorName, vendorNameKey } from '@/lib/operations/planVendor';
import { CENTS_MAX, DONE_AT_SKEW_MS, NOTE_MAX, NOT_RECORDED_WORDS, holdsControl } from '@/lib/operations/stopRecord';
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
export const ALREADY_ON_SHEET_WORDS = 'already on the time sheet — a stop of this name stands at this day and time';

/** What is typed on a row and not written, each said by its head word. */
export const RECORDED_NOT_WRITTEN_WORDS = 'Total (USD), Items — not written: this stop is already recorded — the paste does not write over a record';
export const vendorNotWrittenWords = (standing: string): string => `Vendor — not written: this stop already has the vendor ${JSON.stringify(standing)} — the paste does not change a vendor`;
export const ITEMS_AHEAD_WORDS = 'Items — not written: the stop is still ahead, and a planned stop holds none yet';
export const TOTAL_AHEAD_WORDS = 'Total (USD) — not written: the stop is still ahead';
export const ITEMS_NO_TOTAL_WORDS = 'Items — not written: the row holds no Total (USD), so no record is made';

/** THE VENDOR of a placed row: none; the book's own, by the directory's own name rule; or new to the book. */
export type PastedVendor = { readonly kind: 'none' } | { readonly kind: 'own'; readonly id: string; readonly name: string } | { readonly kind: 'new'; readonly name: string };

/** WHAT HAPPENED at a placed row's stop that has no record: recorded went with this row's amount and items · planned, still ahead · no record is made. */
export type PastedOutcome =
  | { readonly kind: 'went'; readonly cents: number; readonly items: string | null }
  | { readonly kind: 'planned' }
  | { readonly kind: 'not recorded' };
/** …or, on a plan's stop alone, the stop's own record stands. A one-off is a new stop: it has no record to stand. */
export type PastedHappened = PastedOutcome | { readonly kind: 'recorded' };

/** Where a row lands — one placement a row. */
export type PastePlacement =
  | { readonly kind: 'refused'; readonly head: PasteHead; readonly why: string }
  | { readonly kind: 'blank' }
  | { readonly kind: 'booking' }
  | { readonly kind: 'pick'; readonly words: string }
  | { readonly kind: 'plan'; readonly book: OfferedBook; readonly plan: string; readonly stop: LedgerSheetRow; readonly instant: string; readonly vendor: PastedVendor; readonly happened: PastedHappened; readonly notWritten: readonly string[] }
  | {
    readonly kind: 'oneOff'; readonly book: OfferedBook; readonly account: PasteAccount;
    /** The new stop's own facts, as the row holds them: its Start Time and End Time ('HH:MM'), its name (the row's Type) and its Budget (USD), above 0. */
    readonly start: string; readonly end: string | null; readonly name: string; readonly budgetCents: number;
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

/**
 * WHERE EVERY ROW LANDS — one placement a row, in the paste's order, decided in this order and nothing guessed:
 *   a. its unread cell → refused, that cell named;       b. a date with nothing on it → blank;
 *   c. Days more than 1 → a booking;                      d. no book, or two, carry its Entity's word → refused on Entity;
 *   e. no pick for its kind → waiting for a pick;         f. picked on a plan → that plan's one stop of the day;
 *   g. picked a one-off → a new stop at its day and Start Time in the viewer's zone;
 *   h. the vendor;                                        i. what happened.
 * The paste never writes over what stands: a stop that already has a record keeps it, and a stop whose planned vendor is
 * another name keeps it — each said. A stop an earlier row of the paste already holds is not taken twice.
 */
export function placePaste(paste: Pick<Paste, 'rows'>, picks: Readonly<Record<string, PastePick>>, context: PasteContext): PastePlacement[] {
  const offered = offeredBooksOf(context.books);
  /** The stops rows of this paste already hold, by the sheet row's key → the paste row's number. */
  const held = new Map<string, number>();
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
      const stop = stops[0];
      const entry = entryOf(stop, context.recording);
      if (!entry.takes) return { kind: 'refused', head: 'Type', why: entry.words };
      const earlier = held.get(stop.key);
      if (earlier !== undefined) return { kind: 'refused', head: 'Type', why: stopTakenWords(earlier, pick.plan) };
      held.set(stop.key, row.number);
      // The vendor: the stop's own planned vendor stands — another name is kept and said, the same name is nothing to write.
      const standing = stop.vendor;
      const vendorSaid = standing !== null && cells.vendor !== null && vendorNameKey(standing) !== vendorNameKey(cells.vendor) ? [vendorNotWrittenWords(standing)] : [];
      const vendor = standing === null ? pastedVendorOf(cells.vendor, book, context.vendors) : { kind: 'none' as const };
      // A stop that already has a record keeps it — said, when the row holds a Total (USD) or Items.
      if (entry.held !== null) {
        const typed = cells.totalCents !== null || cells.items !== null;
        return { kind: 'plan', book, plan: pick.plan, stop, instant: entry.plannedAt, vendor, happened: { kind: 'recorded' }, notWritten: [...(typed ? [RECORDED_NOT_WRITTEN_WORDS] : []), ...vendorSaid] };
      }
      const { happened, notWritten } = happenedAt(entry.plannedAt, cells, context.now);
      return { kind: 'plan', book, plan: pick.plan, stop, instant: entry.plannedAt, vendor, happened, notWritten: [...notWritten, ...vendorSaid] };
    }

    const account = chartFor(book, context.charts).find((listed) => listed.code === pick.code);
    if (account === undefined) return { kind: 'refused', head: 'Category', why: noAccountWords(pick.code) };
    if (cells.start === null) return { kind: 'refused', head: 'Start Time', why: ONE_OFF_NO_START_WORDS };
    if (cells.budgetCents === null || cells.budgetCents === 0) return { kind: 'refused', head: 'Budget (USD)', why: ONE_OFF_NO_BUDGET_WORDS };
    if (context.sheet.some((stop) => stop.book === book.word && stop.day === cells.day && stop.time === cells.start && stop.description === cells.type)) return { kind: 'refused', head: 'Type', why: ALREADY_ON_SHEET_WORDS };
    const instant = zonedToInstant(cells.day, cells.start, context.zone).toISOString();
    const { happened, notWritten } = happenedAt(instant, cells, context.now);
    return { kind: 'oneOff', book, account, start: cells.start, end: cells.end, name: cells.type, budgetCents: cells.budgetCents, instant, vendor: pastedVendorOf(cells.vendor, book, context.vendors), happened, notWritten };
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
    // A new stop: its own Start Time and End Time, the account's label and name, its Type, what happened, and its two amounts.
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
    case 'plan': return [onPlanWords(placement.plan, cellWordsOf(placement.stop, 'start')), ...vendorPart(placement.vendor, placement.book), happenedWords(placement.happened), ...placement.notWritten].join(' · ');
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

/** The one line that counts the paste. */
export function countsWords(placements: readonly PastePlacement[]): string {
  const count = (kind: PastePlacement['kind']): number => placements.filter((placement) => placement.kind === kind).length;
  const said = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  return [
    said(placements.length, 'row read', 'rows read'),
    `${count('plan')} on a plan`,
    said(count('oneOff'), 'one-off', 'one-offs'),
    said(count('booking'), 'booking', 'bookings'),
    `${count('pick')} waiting for a pick`,
    `${count('refused')} that cannot be placed`,
    said(count('blank'), 'date with nothing on it', 'dates with nothing on them'),
  ].join(' · ');
}

// ── THE LEAF'S OWN WORDS ────────────────────────────────────────────────────

export const PASTE_OPEN_WORDS = '+ paste rows from a sheet';
export const PASTE_TITLE_WORDS = 'rows from your sheet — read and placed here; nothing is written';
export const PASTE_HOW_WORDS = 'copy the rows in your sheet with its header row, and paste them here';
export const PASTE_READ_WORDS = 'read the rows';
export const PASTE_CLEAR_WORDS = 'clear';
export const PASTE_CLOSE_WORDS = 'close';
export const PASTE_PICKS_WORDS = 'where each kind of row goes — nothing is chosen for you';
export const PASTE_NO_PICK_WORDS = '— pick —';
export const PASTE_ON_PLAN_WORDS = 'on your plan';
export const PASTE_ONE_OFF_WORDS = 'a one-off, under';
