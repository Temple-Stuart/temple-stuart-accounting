/**
 * PASTE-01 (Alex, 2026-11-25) — PASTE ROWS FROM THE SHEET: EVERY ROW READ, PLACED AND SHOWN. NOTHING IS WRITTEN.
 *
 * On /time, under "+ expense", a box takes the rows of a spreadsheet pasted with its header row. The rule
 * (src/lib/operations/pasteRows.ts) splits the text, reads each row cell by cell, names the kinds of row, and — given the books,
 * the time sheet's rows for those days, the charts, the vendors, the zone and the clock — says where every row lands: on a plan's
 * stop, as a one-off, as a booking, waiting for a pick, or stopped at one named cell. The leaf (ledger/PasteRows.tsx) shows each
 * row as it was typed and as the time sheet would hold it. Nothing is written: the save is a later change.
 *
 * HERMETIC, on formbounds01.test.ts's model — no database, no network, and the only clock is the `now` handed in. The rule is
 * DRIVEN directly over made-up rows: every name, day, place, account and amount below is invented, and the only words of the real
 * sheet are its column head words. The leaf, the section and the page are anchored to their source with comments stripped (the
 * reader law). No pin here names a line number of any file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, rejoin } from '../sourceText';
import { BLANK } from '../budget/format';
import { CENTS_MAX, NOTE_MAX, NOT_RECORDED_WORDS, type StopRecordRow } from '../operations/stopRecord';
import { PLANNED_WORD, WENT_WORD, headWordOf, type LedgerPlanRow, type LedgerRecording, type LedgerRow, type LedgerSheetRow } from '../operations/ledger';
import * as rule from '../operations/pasteRows';
import * as saveRule from '../operations/pasteSave';
import {
  ALREADY_RECORDED_WORDS, AMOUNT_MOST_WORDS, BLANK_DATE_WORDS, BOOKING_WORDS, ITEMS_AHEAD_WORDS, ITEMS_CONTROL_WORDS, ITEMS_LONG_WORDS, ITEMS_NO_TOTAL_WORDS,
  LANDS_WORDS, NOTHING_PASTED_WORDS, NO_ROW_WORDS, NO_TOTAL_WORDS, ONE_OFF_NO_BUDGET_WORDS, ONE_OFF_NO_START_WORDS, ON_TIME_SHEET_COLUMNS, ON_TIME_SHEET_KEYS, ON_TIME_SHEET_WORDS,
  PASTE_NO_COLUMN_HEADS, PASTE_READ_HEADS, PASTE_REQUIRED_HEADS, PASTE_WORKED_OUT_HEADS, PLANNED_AHEAD_WORDS, RECORDED_NOT_WRITTEN_WORDS, TOTAL_AHEAD_WORDS, UNCLOSED_QUOTE_WORDS, YOUR_SHEET_COLUMNS, YOUR_SHEET_WORDS,
  accountWords, blankCellWords, bookNamed, chartOf, chartUnreadWords, countsWords, kindKeyOf, notReadLines, offeredBooksOf, pasteKindsOf, pasteShown, pasteSpanOf, pastedVendorOf,
  pickOfValue, pickOffersOf, pickValueOf, placePaste, plansOf, readAmountCell, readClockCell, readDayCell, readDaysCell, readPaste, splitPaste, vendorsUnreadWords,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement, type PasteRow,
} from '../operations/pasteRows';

const RULES = 'src/lib/operations/pasteRows.ts';
const LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';

/** A whole file, comment and code alike (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;

// ── THE PASTE — a sheet's rows as it copies them, every cell made up ─────────

const TAB = '\t';
type Typed = Partial<Record<PasteHead, string>>;
const cellsOf = (typed: Typed): string => PASTE_READ_HEADS.map((head) => (head in typed ? typed[head] : '')).join(TAB);
const sheetText = (...rows: readonly Typed[]): string => [PASTE_READ_HEADS.join(TAB), ...rows.map(cellsOf)].join('\n');
/** A paste that is read — or the test fails with the refusal's words. */
const pasteOf = (...rows: readonly Typed[]): Paste => {
  const read = readPaste(sheetText(...rows));
  if (!read.ok) return assert.fail(`refused: ${read.words}`);
  return read.value;
};
/** One row, read. */
const rowOf = (typed: Typed): PasteRow => pasteOf(typed).rows[0];
/** A row every cell of which reads — a past lunch on a plan, as a sheet would hold it. */
const LUNCH: Typed = { 'Start Date': '5/10/27', 'Start Time': '12:30 PM', 'End Time': '1:00 PM', Category: 'Dining', Entity: 'Personal', Type: 'Lunch', Items: 'two kinds of soup', Vendor: 'Oat House', 'Total (USD)': '$6.90', 'Budget (USD)': '6.50' };

// ── THE PAGE'S OWN — books, the time sheet's rows, charts and vendors, all made up ──

const NBO = 'Africa/Nairobi'; // three hours ahead of UTC the year round
const SUN = '2027-05-09';
const MON = '2027-05-10';
const TUE = '2027-05-11';
const WED = '2027-05-12';
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();
/** Tuesday noon in the zone: Sunday and Monday are past, Tuesday's 12:30 is half an hour ahead. */
const NOW = new Date('2027-05-11T09:00:00.000Z');

/** A plan row of the sheet — a priced line with no record on it — in the ledger's own shape. COALEVELS-01 (2026-11-27): a row says its location (none) and its segments — its entity's letter and its account's code, as its `coa` says them; a row whose `coa` is its own says its own segments too. */
const planned = (id: string, day: string, clock: string, name: string, over: Partial<LedgerPlanRow> = {}): LedgerPlanRow => ({
  id: null, key: `routine:${id}:${at(day, clock)}`, address: { kind: 'routine', id, instant: at(day, clock) }, match: null, day, time: clock,
  place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: name, rating: null, note: null, plannedItems: null, notes: null, // TIMESHEET-04b (2026-11-27): a plan row's three new fields — no tag, nothing planned to be had, and no notes (a row with no record has none)
  cents: 650, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 30, loggedMinutes: null, allDay: false, went: NOT_RECORDED_WORDS, ...over,
});
/** A recorded row — a stop that already has its record. */
const DINNER_RECORD: StopRecordRow = { id: 'r-dinner', kind: 'routine', target_id: 'dinner', occurrence_at: at(MON, '19:00'), outcome: 'done', done_at: at(MON, '19:40'), actual_cents: 1500, rating: 4, note: 'the set menu', notes: null, actual_minutes: 40 };
const DINNER: LedgerRow = {
  id: 'r-dinner', key: `routine:dinner:${at(MON, '19:00')}`, address: { kind: 'routine', id: 'dinner', instant: at(MON, '19:00') }, match: null, day: MON, time: '19:00',
  place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: 'Dinner', rating: 4, note: 'the set menu', notes: null, // TIMESHEET-04b (2026-11-27): the row's two new fields — no tag, no notes
  cents: 1500, budgetState: 'matched', outcome: 'done', actualCents: 1500, varianceCents: 0, plannedMinutes: null, loggedMinutes: 40,
};

const LUNCH_MON = planned('lunch', MON, '12:30', 'Lunch');
const LUNCH_TUE = planned('lunch', TUE, '12:30', 'Lunch', { went: PLANNED_WORD });
const TEA_MON = planned('tea', MON, '16:00', 'Tea', { cents: 300 });
const SWIM_MON_1 = planned('swim-a', MON, '07:00', 'Swim', { cents: 500 });
const SWIM_MON_2 = planned('swim-b', MON, '07:30', 'Swim', { cents: 500 });
const MARKET_MON = planned('market', MON, '10:00', 'Market', { cents: 2000 });
const MARKET_TUE = planned('market', TUE, '10:00', 'Market', { cents: 2000, went: null });
const COFFEE_SUN = planned('coffee', SUN, '08:00', 'Coffee', { cents: 250, vendor: 'Bean Bar' });
const COFFEE_MON = planned('coffee', MON, '08:00', 'Coffee', { cents: 250, vendor: 'Bean Bar' });
const CINEMA_MON = planned('cinema', MON, '21:00', 'Cinema', { cents: 1200, segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Recreation' } });
const PRINT_MON = planned('print', MON, '11:00', 'Print shop', { book: 'Business', location: null, segments: { entity: 'B', location: null, category: '6400', type: null, code: 'B-6400' }, coa: { account: 'B-6400', name: 'Supplies' }, cents: 750 });
const SHEET: readonly LedgerSheetRow[] = [COFFEE_SUN, SWIM_MON_1, SWIM_MON_2, COFFEE_MON, MARKET_MON, PRINT_MON, LUNCH_MON, TEA_MON, DINNER, CINEMA_MON, MARKET_TUE, LUNCH_TUE];

const MARKET_HAS_LINES_WORDS = 'the routine has lines — record each line, not the routine';
const taking = (row: LedgerSheetRow, held: StopRecordRow | null = null): LedgerRecording => ({ takes: true, plannedAt: row.address.instant, held, vendor: { kind: 'none' } });
const RECORDING: Readonly<Record<string, LedgerRecording>> = {
  ...Object.fromEntries(SHEET.filter((row) => row !== MARKET_TUE && row !== DINNER).map((row) => [row.key, taking(row)])),
  [DINNER.key]: taking(DINNER, DINNER_RECORD),
  [MARKET_TUE.key]: { takes: false, words: MARKET_HAS_LINES_WORDS },
};

const BOOKS = [{ id: 'P', name: 'Home', entityType: 'personal' }, { id: 'B', name: 'Shop', entityType: 'sole_prop' }, { id: 'X', name: 'Trust', entityType: 'estate' }];
const CONTEXT: PasteContext = {
  books: BOOKS, sheet: SHEET, recording: RECORDING,
  charts: { P: [{ code: '6150', name: 'Dining Out' }, { code: '6200', name: 'Recreation' }], B: [{ code: '6400', name: 'Supplies' }] },
  vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P' }, { id: 'v-gym', vendor_name: 'Summit Gym', entity_id: 'B' }],
  zone: NBO, now: NOW,
};

const ON_PLAN = (plan: string): PastePick => ({ kind: 'plan', plan });
const ONE_OFF = (code: string): PastePick => ({ kind: 'oneOff', code });
/** One row, placed: its placement and the table's row for it — the row's own kind given the pick handed in (none: no pick). */
const landed = (typed: Typed, pick: PastePick | null, context: PasteContext = CONTEXT) => {
  const paste = pasteOf(typed);
  const row = paste.rows[0];
  const picks = pick === null || row.kind !== 'read' ? {} : { [kindKeyOf(row.cells)]: pick };
  const placements = placePaste(paste, picks, context);
  return { placement: placements[0], shown: pasteShown(paste, placements)[0], counts: countsWords(placements) };
};
/** The cells of ON THE TIME SHEET, by the time sheet's own column keys. */
const sheetCells = (cells: readonly string[]): Record<string, string> => Object.fromEntries(ON_TIME_SHEET_KEYS.map((key, i) => [key, cells[i]]));
const refusedAt = (placement: PastePlacement): [string, string] => {
  if (placement.kind !== 'refused') return assert.fail(`placed: ${placement.kind}`);
  return [placement.head, placement.why];
};
/** A row stopped at one named cell, as the table shows it: LANDS says the head and the why, in the refused tone, and no cell of ON THE TIME SHEET is filled. */
const refusedRow = (row: ReturnType<typeof landed>): [string, string] => {
  const [head, why] = refusedAt(row.placement);
  assert.deepEqual([row.shown.lands, row.shown.tone, row.shown.sheet], [`${head} — ${why}`, 'refused', ON_TIME_SHEET_KEYS.map(() => BLANK)], `${head}: ${why}`);
  return [head, why];
};

// ── T1 · THE SPLIT (ruling A.2) ──────────────────────────────────────────────

test('T1 the split: a cell ends at a tab and a row at CRLF, CR or LF; a cell that opens with a quote runs to its closing quote — a tab, a line break and a doubled quote kept; a quote inside an unquoted cell is itself; an unclosed quote refuses the paste', () => {
  const rows = (text: string): readonly (readonly string[])[] => {
    const split = splitPaste(text);
    if (!split.ok) return assert.fail(split.words);
    return split.rows;
  };
  assert.deepEqual(rows('a\tb\tc'), [['a', 'b', 'c']]);
  assert.deepEqual(rows('a\tb\r\nc\td\re\tf\ng\th'), [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']], 'the three line breaks');
  assert.deepEqual(rows('a\t\tc\n\t\n'), [['a', '', 'c'], ['', ''], ['']], 'an empty cell is a cell; a last line break ends a row of one blank cell');
  // A quoted cell: tabs and line breaks kept, a doubled quote one quote.
  assert.deepEqual(rows('"soup\tand bread"\tx'), [['soup\tand bread', 'x']]);
  assert.deepEqual(rows('x\t"two\nlines"\ty\nz'), [['x', 'two\nlines', 'y'], ['z']]);
  assert.deepEqual(rows('"line one\r\nline two"\tx'), [['line one\r\nline two', 'x']]);
  assert.deepEqual(rows('"the ""house"" soup"'), [['the "house" soup']]);
  assert.deepEqual(rows('""\tx'), [['', 'x']], 'a quoted cell of nothing');
  assert.deepEqual(rows('"soup" and bread\tx'), [['soup and bread', 'x']], 'what follows the closing quote is kept after it');
  // A quote inside an unquoted cell is itself.
  assert.deepEqual(rows('a 12" plate\tthe "house" soup'), [['a 12" plate', 'the "house" soup']]);
  // An unclosed quote refuses the whole paste.
  assert.deepEqual(splitPaste('a\t"never closed\nb\tc'), { ok: false, words: UNCLOSED_QUOTE_WORDS });
  assert.deepEqual(splitPaste('"'), { ok: false, words: 'a quoted cell is never closed — copy the rows from the sheet again' });
  assert.deepEqual(readPaste(`${PASTE_READ_HEADS.join(TAB)}\n5/10/27\t"12:30`), { ok: false, words: UNCLOSED_QUOTE_WORDS }, 'and the paste with it');
});

// ── T2 · THE CELLS (ruling A.4) ──────────────────────────────────────────────

test('T2 a day: M/D/YY and M/D/YYYY as a real day — a two-digit year is 20YY; no day that is not one, no other way of writing one', () => {
  for (const [typed, day] of [['5/10/27', '2027-05-10'], ['05/09/27', '2027-05-09'], ['12/31/2027', '2027-12-31'], ['1/5/2028', '2028-01-05'], [' 2/29/28 ', '2028-02-29']]) assert.deepEqual(readDayCell(typed), { ok: true, value: day }, typed);
  for (const typed of ['2/30/27', '2/29/27', '13/1/27', '0/5/27', '5/0/27', '5/32/27', '2027-05-10', '5-10-27', '10 May 2027', '5/10', '5/10/127', 'tomorrow']) {
    assert.deepEqual(readDayCell(typed), { ok: false, why: `${JSON.stringify(typed)} is not a day (M/D/YY)` }, typed);
  }
  assert.deepEqual(readDayCell(''), { ok: false, why: 'Start Date is blank' });
  assert.deepEqual(readDayCell('   '), { ok: false, why: blankCellWords('Start Date') });
});

test('T2 a clock: H:MM AM or PM (1 to 12) and HH:MM (0 to 23), as HH:MM; a blank one is none', () => {
  for (const [typed, clock] of [['10:00 AM', '10:00'], ['12:00 PM', '12:00'], ['12:30 AM', '00:30'], ['7:00 pm', '19:00'], ['19:05', '19:05'], ['9:05', '09:05'], ['0:00', '00:00'], ['23:59', '23:59'], ['11:59 PM', '23:59'], ['1:07 am', '01:07'], ['  12:30   PM ', '12:30']]) {
    assert.deepEqual(readClockCell(typed), { ok: true, value: clock }, typed);
  }
  for (const typed of ['13:00 PM', '0:00 AM', '7pm', '24:00', '12:60', '7:5 PM', '7:00PM', '7', 'noon', '19:05:00']) assert.deepEqual(readClockCell(typed), { ok: false, why: `${JSON.stringify(typed)} is not a time (10:00 AM)` }, typed);
  assert.deepEqual(readClockCell(''), { ok: true, value: null });
  assert.deepEqual(readClockCell(' \t '), { ok: true, value: null });
});

test('T2 an amount: an optional $, digits with optional thousands commas, at most two decimals → cents, exactly; a blank one is none; one cent past the column’s range is refused', () => {
  for (const [typed, cents] of [['$612.40', 61240], ['1,234.56', 123456], ['$9', 900], ['9.6', 960], ['0', 0], ['$0.05', 5], ['12', 1200], ['$1,000', 100000], ['1,234,567.8', 123456780], ['21474836.47', CENTS_MAX], ['$21,474,836.47', CENTS_MAX]] as const) {
    assert.deepEqual(readAmountCell(typed), { ok: true, value: cents }, typed);
  }
  for (const typed of ['1,00', '9.633', '-5', '#N/A', '$', '9.', '.50', '1,2345', '12,34.00', '$ 9', '9 USD', 'nine', '1e3', '(5.00)']) assert.deepEqual(readAmountCell(typed), { ok: false, why: `${JSON.stringify(typed)} is not an amount in dollars ($12.50)` }, typed);
  for (const typed of ['21474836.48', '$21,474,836.48', '99999999999', '123456789012345678901234567890']) assert.deepEqual(readAmountCell(typed), { ok: false, why: AMOUNT_MOST_WORDS }, typed);
  assert.equal(AMOUNT_MOST_WORDS, 'an amount is at most 2147483647 cents');
  assert.deepEqual(readAmountCell(''), { ok: true, value: null }, 'blank is none — never 0');
  // Days: a whole number, 1 or more.
  for (const [typed, days] of [['1', 1], ['3', 3], ['30', 30]] as const) assert.deepEqual(readDaysCell(typed), { ok: true, value: days });
  for (const typed of ['0', '1.5', '-2', 'two', '3 nights']) assert.deepEqual(readDaysCell(typed), { ok: false, why: `${JSON.stringify(typed)} is not a number of days` }, typed);
  assert.deepEqual(readDaysCell(''), { ok: true, value: null });
});

// ── T3 · THE HEADER AND THE PASTE (rulings A.1 and A.3) ──────────────────────

test('T3 the columns: the eleven read, the five required, and the two lists named and not read — the sheet’s own head words', () => {
  assert.deepEqual([...PASTE_READ_HEADS], ['Start Date', 'Start Time', 'End Time', 'Category', 'Entity', 'Type', 'Items', 'Vendor', 'Total (USD)', 'Budget (USD)', 'Days']);
  assert.deepEqual([...PASTE_REQUIRED_HEADS], ['Start Date', 'Category', 'Entity', 'Type', 'Vendor']);
  assert.deepEqual([...PASTE_NO_COLUMN_HEADS], ['Instagram Tag', 'Currency', 'Total', 'Location', 'Notes']);
  assert.deepEqual([...PASTE_WORKED_OUT_HEADS], ['End Date', 'Trip Name', 'Covers From', 'Covers To', 'Daily Cost (USD)', 'Under/Over']);
  assert.ok(PASTE_REQUIRED_HEADS.every((head) => PASTE_READ_HEADS.includes(head)), 'a required head is a read one');
  const all = [...PASTE_READ_HEADS, ...PASTE_NO_COLUMN_HEADS, ...PASTE_WORKED_OUT_HEADS].map((head) => head.toLowerCase());
  assert.equal(new Set(all).size, all.length, 'no head word is in two lists');
});

test('T3 the paste refused whole, by name: nothing pasted; a read head twice; a required head missing; no row under the header', () => {
  for (const nothing of ['', '\n', ' \t \r\n\t\t\n']) assert.deepEqual(readPaste(nothing), { ok: false, words: NOTHING_PASTED_WORDS }, JSON.stringify(nothing));
  assert.equal(NOTHING_PASTED_WORDS, 'nothing was pasted');
  // A read head word twice — in any case and spacing.
  assert.deepEqual(readPaste(`${PASTE_READ_HEADS.join(TAB)}\tvendor\n5/10/27`), { ok: false, words: 'the header row has "Vendor" twice' });
  assert.deepEqual(readPaste(`start date\tSTART  DATE\tCategory\tEntity\tType\tVendor\n5/10/27`), { ok: false, words: 'the header row has "Start Date" twice' });
  // A required head missing: every one that is, in the required order.
  assert.deepEqual(readPaste('Start Date\tCategory\tType\tItems\n5/10/27\tDining\tLunch\tsoup'), { ok: false, words: 'the first row must be the sheet\'s header row — it has no "Entity", "Vendor"' });
  assert.deepEqual(readPaste('5/10/27\tDining\tPersonal\tLunch\tOat House'), { ok: false, words: 'the first row must be the sheet\'s header row — it has no "Start Date", "Category", "Entity", "Type", "Vendor"' }, 'a paste with no header row');
  // The header, and no row under it.
  assert.deepEqual(readPaste(PASTE_READ_HEADS.join(TAB)), { ok: false, words: NO_ROW_WORDS });
  assert.deepEqual(readPaste(`${PASTE_READ_HEADS.join(TAB)}\n\t\t\n   \n`), { ok: false, words: 'the header row was read, and no row under it' });
});

test('T3 the header is matched by the sheet’s own head words, ignoring case and spacing, in any order; a read column it does not carry is blank on every row; the columns not read are named — three lists', () => {
  const text = [
    ['notes', 'VENDOR', 'type', '  Entity ', 'CATEGORY', 'start  date', 'Total (usd)', 'Currency', 'End Date', 'Mood', 'under/over', 'mood', ''].join(TAB),
    ['a note', 'Oat House', 'Lunch', 'Personal', 'Dining', '5/10/27', '$6.90', 'USD', '5/10/27', 'good', 'under', 'again', 'stray'].join(TAB),
  ].join('\n');
  const read = readPaste(text);
  assert.ok(read.ok);
  const [row] = read.value.rows;
  assert.equal(row.kind, 'read');
  if (row.kind !== 'read') return;
  assert.deepEqual(row.cells, { day: MON, start: null, end: null, category: 'Dining', entity: 'Personal', type: 'Lunch', items: null, vendor: 'Oat House', totalCents: 690, budgetCents: null, days: null }, 'the optional columns the header does not carry are blank');
  // The columns not read: the sheet's own two lists by their head words and in their order; any other head as it was typed, once.
  assert.deepEqual([read.value.noColumn, read.value.workedOut, read.value.unknown], [['Currency', 'Notes'], ['End Date', 'Under/Over'], ['Mood']]);
  assert.deepEqual(notReadLines(read.value), [
    'no column for these yet — not read: Currency, Notes',
    "worked out by the app, or a booking's — not read: End Date, Under/Over",
    "not one of the sheet's columns — not read: Mood",
  ]);
  assert.deepEqual(notReadLines(pasteOf(LUNCH)), [], 'a line is said only when it names a column');
  assert.deepEqual(notReadLines({ noColumn: ['Notes'], workedOut: [], unknown: [] }), ['no column for these yet — not read: Notes']);
});

test('T3 a row’s number is its line in the paste, the header being row 1: a blank line is skipped and still counted; a row shorter than the header ends in blank cells', () => {
  const text = `\n\n${PASTE_READ_HEADS.join(TAB)}\n${cellsOf(LUNCH)}\n\t\t\n\n${cellsOf({ ...LUNCH, 'Start Date': '5/11/27' })}\n5/12/27\n`;
  const read = readPaste(text);
  assert.ok(read.ok);
  assert.deepEqual(read.value.rows.map((row) => [row.number, row.kind]), [[2, 'read'], [5, 'read'], [6, 'blank']], 'blank lines above the header are not the header; those under it keep their numbers');
  assert.deepEqual(pasteSpanOf(read.value), { from: MON, to: WED }, 'the days the readable rows cover — a blank date among them');
  assert.equal(pasteSpanOf(pasteOf({ ...LUNCH, 'Start Date': 'soon' })), null, 'no readable row: no days to read the time sheet for');
});

// ── T4 · A ROW, READ (ruling A.4) ────────────────────────────────────────────

test('T4 a row, read: every cell trimmed and its spaces collapsed; a blank cell is none — never 0, never an empty text', () => {
  const row = rowOf({ 'Start Date': ' 5/10/27 ', 'Start Time': '12:30  PM', 'End Time': '13:00', Category: ' Dining ', Entity: 'personal', Type: 'Lunch  special', Items: '"two   kinds\nof\tsoup"', Vendor: '  Oat   House ', 'Total (USD)': ' $6.90 ', 'Budget (USD)': '6.5', Days: '1' });
  assert.equal(row.kind, 'read');
  if (row.kind !== 'read') return;
  assert.deepEqual(row.cells, { day: MON, start: '12:30', end: '13:00', category: 'Dining', entity: 'personal', type: 'Lunch special', items: 'two kinds of soup', vendor: 'Oat House', totalCents: 690, budgetCents: 650, days: 1 });
  assert.deepEqual(row.typed, { date: '5/10/27', start: '12:30 PM', end: '13:00', entity: 'personal', category: 'Dining', type: 'Lunch special', vendor: 'Oat House', items: 'two kinds of soup', total: '$6.90' }, 'as he typed it, cleaned — what YOUR SHEET prints');
  const bare = rowOf({ 'Start Date': '5/10/27', Category: 'Dining', Entity: 'Personal', Type: 'Lunch' });
  assert.deepEqual(bare.kind === 'read' && bare.cells, { day: MON, start: null, end: null, category: 'Dining', entity: 'Personal', type: 'Lunch', items: null, vendor: null, totalCents: null, budgetCents: null, days: null });
});

test('T4 the first cell that cannot be read is named by its head word, and the row is placed nowhere; a date with nothing on it is read, and is no refusal', () => {
  const refusals: readonly (readonly [Typed, PasteHead, string])[] = [
    [{ 'Start Date': '' }, 'Start Date', 'Start Date is blank'],
    [{ 'Start Date': '2/30/27' }, 'Start Date', '"2/30/27" is not a day (M/D/YY)'],
    [{ 'Start Time': '25:00' }, 'Start Time', '"25:00" is not a time (10:00 AM)'],
    [{ 'End Time': '7pm' }, 'End Time', '"7pm" is not a time (10:00 AM)'],
    [{ Category: ' ' }, 'Category', 'Category is blank'],
    [{ Entity: '' }, 'Entity', 'Entity is blank'],
    [{ Type: '' }, 'Type', 'Type is blank'],
    [{ Items: 'so\u0000up' }, 'Items', ITEMS_CONTROL_WORDS],
    [{ Items: 'n'.repeat(NOTE_MAX + 1) }, 'Items', ITEMS_LONG_WORDS],
    [{ Vendor: 'v'.repeat(201) }, 'Vendor', 'a vendor name is at most 200 characters — this one is 201'],
    [{ 'Total (USD)': '9.633' }, 'Total (USD)', '"9.633" is not an amount in dollars ($12.50)'],
    [{ 'Total (USD)': '21474836.48' }, 'Total (USD)', AMOUNT_MOST_WORDS],
    [{ 'Budget (USD)': '-5' }, 'Budget (USD)', '"-5" is not an amount in dollars ($12.50)'],
    [{ Days: '0' }, 'Days', '"0" is not a number of days'],
    // The first bad cell wins, in the cells' order.
    [{ 'Start Time': 'late', 'Total (USD)': 'lots', Days: 'x' }, 'Start Time', '"late" is not a time (10:00 AM)'],
    [{ Type: '', Vendor: 'v'.repeat(201), 'Budget (USD)': 'lots' }, 'Type', 'Type is blank'],
    [{ Items: 'so\u0007up', 'Total (USD)': 'lots' }, 'Items', ITEMS_CONTROL_WORDS],
  ];
  for (const [over, head, why] of refusals) {
    const row = rowOf({ ...LUNCH, ...over });
    assert.deepEqual([row.kind, row.kind === 'refused' && row.head, row.kind === 'refused' && row.why], ['refused', head, why], `${head}: ${why}`);
    assert.deepEqual(landed({ ...LUNCH, ...over }, ON_PLAN('Lunch')).placement, { kind: 'refused', head, why }, 'and it is placed nowhere, whatever is picked');
  }
  assert.equal(ITEMS_CONTROL_WORDS, 'Items holds a control character');
  assert.equal(ITEMS_LONG_WORDS, 'Items is at most 280 characters on a row');
  // Items: 280 characters, a tab and a line break (spaces, collapsed) are read.
  assert.equal(rowOf({ ...LUNCH, Items: 'n'.repeat(NOTE_MAX) }).kind, 'read');
  // A date with nothing on it: a day, and no Category, Type, Vendor or Entity — whatever else the row holds.
  for (const over of [{}, { 'Start Time': '12:30 PM' }, { Items: 'a thought' }, { 'Total (USD)': 'lots', Days: 'x' }] as const) {
    const row = rowOf({ 'Start Date': '5/12/27', ...over });
    assert.deepEqual([row.kind, row.kind === 'blank' && row.day], ['blank', WED], JSON.stringify(over));
  }
  assert.equal(rowOf({ 'Start Date': '5/12/27', Vendor: 'Oat House' }).kind, 'refused', 'a vendor is something on the date: the row is read as a row, and its blank Category named');
  assert.equal(rowOf({ 'Start Date': 'soon' }).kind, 'refused', 'a date that is no day is refused before it can be a blank date');
});

// ── T5 · THE KINDS (ruling A.5) ──────────────────────────────────────────────

test('T5 the kinds: a row’s Entity, Category and Type, ignoring case and spacing — counted over the stops only, in the paste’s order, each printed Category › Type', () => {
  const paste = pasteOf(
    LUNCH,
    { 'Start Date': '5/10/27', Category: 'Fun', Entity: 'Personal', Type: 'Climbing' },
    { 'Start Date': '5/11/27', Category: ' DINING ', Entity: 'personal', Type: 'lunch' },
    { 'Start Date': '5/11/27', Category: 'Dining', Entity: 'Business', Type: 'Lunch' },
    { 'Start Date': '5/12/27' },
    { 'Start Date': '5/12/27', Category: 'Lodging', Entity: 'Personal', Type: 'Inn', Days: '3' },
    { 'Start Date': 'soon', Category: 'Dining', Entity: 'Personal', Type: 'Lunch' },
    { 'Start Date': '5/12/27', Category: 'Dining', Entity: 'Personal', Type: 'Lunch', Days: '1' },
  );
  const kinds = pasteKindsOf(paste);
  assert.deepEqual(kinds.map((kind) => [kind.label, kind.words, kind.entity, kind.rows]), [
    ['Personal · Dining › Lunch', 'Dining › Lunch', 'Personal', 3],
    ['Personal · Fun › Climbing', 'Fun › Climbing', 'Personal', 1],
    ['Business · Dining › Lunch', 'Dining › Lunch', 'Business', 1],
  ], 'the first row of a kind names it; a booking, a blank date and a refused row are not stops');
  assert.equal(new Set(kinds.map((kind) => kind.key)).size, 3);
  assert.equal(kindKeyOf({ entity: ' PERSONAL', category: 'dining  ', type: 'Lunch' }), kinds[0].key);
  assert.notEqual(kindKeyOf({ entity: 'Personal', category: 'Dining', type: 'Lunch box' }), kinds[0].key);
  assert.deepEqual(pasteKindsOf(pasteOf({ 'Start Date': '5/12/27' })), [], 'a paste of blank dates has no kind');
});

// ── T6 · THE BOOKS, THEIR PLANS AND THE PICK (ruling A.6) ────────────────────

test('T6 a book is named by its word — a book whose type has no word is not offered; an Entity names the one book of that word, or none, or two', () => {
  assert.deepEqual(offeredBooksOf(BOOKS).map((book) => [book.id, book.word]), [['P', 'Personal'], ['B', 'Business']], 'the trust has no word');
  assert.deepEqual(offeredBooksOf([{ id: 'T', name: 'Desk', entityType: 'trading' }]).map((book) => book.word), ['Trading']);
  const named = bookNamed('  personal ', BOOKS);
  assert.deepEqual(named.kind === 'one' && named.book.id, 'P', 'ignoring case and spacing');
  assert.deepEqual(bookNamed('Business', BOOKS).kind, 'one');
  assert.deepEqual(bookNamed('Trust', BOOKS), { kind: 'none' }, 'a book’s own name is not its word');
  assert.deepEqual(bookNamed('Estate', BOOKS), { kind: 'none' });
  assert.deepEqual(bookNamed('Personal', [...BOOKS, { id: 'P2', name: 'Second home', entityType: 'personal' }]), { kind: 'two' });
});

test('T6 the plans of a book: the names of the time sheet’s rows of that book whose entry takes a record — each once, in the sheet’s order; a pick offers them and the book’s accounts', () => {
  assert.deepEqual(plansOf('Personal', SHEET, RECORDING), ['Coffee', 'Swim', 'Market', 'Lunch', 'Tea', 'Dinner', 'Cinema'], 'each once; the print shop is another book’s');
  assert.deepEqual(plansOf('Business', SHEET, RECORDING), ['Print shop']);
  assert.deepEqual(plansOf('Trading', SHEET, RECORDING), []);
  // A plan whose only row takes no record is not offered.
  assert.deepEqual(plansOf('Personal', [MARKET_TUE], RECORDING), []);
  assert.throws(() => plansOf('Personal', SHEET, {}), /pasteRows: the time sheet's row .* has no entry in recording/, 'a row with no entry is the read’s error, by name');
  // What a kind's pick offers — or nothing, when its Entity names no one book.
  assert.deepEqual(pickOffersOf({ entity: 'personal' }, CONTEXT), { plans: ['Coffee', 'Swim', 'Market', 'Lunch', 'Tea', 'Dinner', 'Cinema'], accounts: [{ code: '6150', name: 'Dining Out' }, { code: '6200', name: 'Recreation' }] });
  assert.equal(pickOffersOf({ entity: 'Estate' }, CONTEXT), null);
  assert.equal(accountWords({ code: '6150', name: 'Dining Out' }), '6150 — Dining Out');
  // A pick as its select's value, and back; '' is no pick.
  for (const pick of [ON_PLAN('Lunch'), ON_PLAN('a plan: with a colon'), ONE_OFF('6200')]) assert.deepEqual(pickOfValue(pickValueOf(pick)), pick);
  assert.deepEqual([pickValueOf(undefined), pickOfValue('')], ['', null]);
  assert.throws(() => pickOfValue('somewhere'), /pasteRows: "somewhere" is not a pick/);
  // A chart, read from the route's answer — or said; never an empty list for an answer that holds none.
  assert.deepEqual(chartOf({ accounts: [{ code: '6150', name: 'Dining Out', id: 'a1', settledBalance: 0 }] }), { ok: true, accounts: [{ code: '6150', name: 'Dining Out' }] });
  assert.deepEqual(chartOf({ accounts: [] }), { ok: true, accounts: [] }, 'a book with no account is a list of none');
  for (const bad of [{}, { accounts: null }, { accounts: 'none' }, { accounts: [{ code: '6150' }] }, { accounts: [null] }]) assert.deepEqual(chartOf(bad), { ok: false, words: 'the chart came back without its accounts' }, JSON.stringify(bad));
  assert.equal(chartUnreadWords('Home', 'the route answered 500'), 'the accounts of Home could not be read — the route answered 500');
  assert.equal(vendorsUnreadWords('the route answered 500'), 'the vendors could not be read — the route answered 500');
});

// ── T7 · WHERE A ROW LANDS — ON A PLAN (ruling A.7 f, h, i) ──────────────────

test('T7 on a plan: recorded went with its amount and items when the stop is past and the row holds a Total (USD); planned when the stop is still ahead; not recorded when it is past and the row holds none', () => {
  // Recorded went.
  const went = landed(LUNCH, ON_PLAN('Lunch'));
  assert.equal(went.placement.kind, 'plan');
  if (went.placement.kind !== 'plan') return;
  assert.deepEqual([went.placement.stop.key, went.placement.instant, went.placement.plan, went.placement.book.id], [LUNCH_MON.key, at(MON, '12:30'), 'Lunch', 'P']);
  assert.deepEqual(went.placement.happened, { kind: 'went', cents: 690, items: 'two kinds of soup' });
  assert.deepEqual(went.placement.notWritten, []);
  assert.deepEqual(sheetCells(went.shown.sheet), { start: '12:30', end: '13:00', account: 'P-6150', accountName: 'Dining Out', subAccountName: 'Lunch', went: WENT_WORD, budget: '$6.50', actual: '$6.90' }, 'the stop’s own cells — WENT and ACTUAL this row’s');
  assert.equal(went.shown.lands, 'on "Lunch", its 12:30 stop · vendor: Personal\'s own · recorded: went, $6.90');
  assert.equal(went.shown.tone, 'placed');
  // Planned: the stop is still ahead — its Items and its Total (USD), typed, are each said as not written.
  const ahead = landed({ ...LUNCH, 'Start Date': '5/11/27' }, ON_PLAN('Lunch'));
  assert.deepEqual(ahead.placement.kind === 'plan' && [ahead.placement.stop.key, ahead.placement.happened, ahead.placement.notWritten], [LUNCH_TUE.key, { kind: 'planned' }, [ITEMS_AHEAD_WORDS, TOTAL_AHEAD_WORDS]]);
  assert.deepEqual(sheetCells(ahead.shown.sheet), { start: '12:30', end: '13:00', account: 'P-6150', accountName: 'Dining Out', subAccountName: 'Lunch', went: PLANNED_WORD, budget: '$6.50', actual: BLANK });
  assert.equal(ahead.shown.lands, 'on "Lunch", its 12:30 stop · vendor: Personal\'s own · planned: still ahead · Items — not written: the stop is still ahead, and a planned stop holds none yet · Total (USD) — not written: the stop is still ahead');
  const aheadBare = landed({ 'Start Date': '5/11/27', Category: 'Dining', Entity: 'Personal', Type: 'Lunch' }, ON_PLAN('Lunch'));
  assert.equal(aheadBare.shown.lands, 'on "Lunch", its 12:30 stop · planned: still ahead', 'nothing typed, nothing said');
  // Not recorded: past, and the row holds no Total (USD) — its Items, typed, is said. Never recorded on a guess.
  const none = landed({ 'Start Date': '5/10/27', Category: 'Dining', Entity: 'Personal', Type: 'Tea', Items: 'a pot' }, ON_PLAN('Tea'));
  assert.deepEqual(none.placement.kind === 'plan' && [none.placement.happened, none.placement.notWritten, none.placement.vendor], [{ kind: 'not recorded' }, [ITEMS_NO_TOTAL_WORDS], { kind: 'none' }]);
  assert.deepEqual(sheetCells(none.shown.sheet), { start: '16:00', end: '16:30', account: 'P-6150', accountName: 'Dining Out', subAccountName: 'Tea', went: NOT_RECORDED_WORDS, budget: '$3', actual: BLANK });
  assert.equal(none.shown.lands, 'on "Tea", its 16:00 stop · not recorded: no Total (USD) · Items — not written: the row holds no Total (USD), so no record is made');
  // A Total (USD) of 0 is a Total: recorded went, $0.00.
  assert.equal(landed({ 'Start Date': '5/10/27', Category: 'Dining', Entity: 'Personal', Type: 'Tea', 'Total (USD)': '0' }, ON_PLAN('Tea')).shown.lands, 'on "Tea", its 16:00 stop · recorded: went, $0.00');
  // The clock decides, by the stops rule's own test: at the skew's edge the stop is not ahead; a minute past it, it is.
  const edge = (minutes: number): string => {
    const { placement } = landed(LUNCH, ON_PLAN('Lunch'), { ...CONTEXT, now: new Date(Date.parse(at(MON, '12:30')) - minutes * 60_000) });
    if (placement.kind !== 'plan') return assert.fail(`placed: ${placement.kind}`);
    return placement.happened.kind;
  };
  assert.deepEqual([edge(10), edge(11)], ['went', 'planned']);
});

test('T7 on a plan, refused: the stop an earlier row of the paste already holds; no stop that day; two stops that day; a stop that takes no record', () => {
  // The same stop twice: the first row holds it.
  const paste = pasteOf(LUNCH, { ...LUNCH, Items: 'again' }, { 'Start Date': 'soon', Category: 'Dining', Entity: 'Personal', Type: 'Lunch' }, { ...LUNCH, 'Start Date': '5/11/27' });
  const picks = { [kindKeyOf({ entity: 'Personal', category: 'Dining', type: 'Lunch' })]: ON_PLAN('Lunch') };
  const placed = placePaste(paste, picks, CONTEXT);
  assert.deepEqual(placed.map((p) => p.kind), ['plan', 'refused', 'refused', 'plan'], 'another day’s stop of the same plan is its own');
  assert.deepEqual(refusedAt(placed[1]), ['Type', 'row 2 of the paste is already on this day\'s stop of "Lunch" — a second one needs its own Start Time and a one-off']);
  assert.deepEqual(pasteShown(paste, placed).map((row) => [row.number, row.tone]), [[2, 'placed'], [3, 'refused'], [4, 'refused'], [5, 'placed']]);
  assert.equal(pasteShown(paste, placed)[1].lands, 'Type — row 2 of the paste is already on this day\'s stop of "Lunch" — a second one needs its own Start Time and a one-off');
  assert.equal(pasteShown(paste, placed)[2].lands, 'Start Date — "soon" is not a day (M/D/YY)', 'a cell that cannot be read is said the same way');
  // A refused row holds no stop: the row after it lands.
  const afterRefused = placePaste(pasteOf({ ...LUNCH, 'Total (USD)': 'lots' }, LUNCH), picks, CONTEXT);
  assert.deepEqual(afterRefused.map((p) => p.kind), ['refused', 'plan']);
  // No stop of that plan on the row's day.
  assert.deepEqual(refusedRow(landed({ ...LUNCH, 'Start Date': '5/12/2027' }, ON_PLAN('Lunch'))), ['Start Date', 'the plan "Lunch" has no stop on this day']);
  assert.deepEqual(refusedRow(landed(LUNCH, ON_PLAN('Brunch'))), ['Start Date', 'the plan "Brunch" has no stop on this day']);
  // Another book's plan of that name is not this book's.
  assert.deepEqual(refusedRow(landed({ ...LUNCH, Entity: 'Business' }, ON_PLAN('Lunch'))), ['Start Date', 'the plan "Lunch" has no stop on this day']);
  // Two stops of the plan that day: the paste cannot tell which.
  assert.deepEqual(refusedRow(landed({ 'Start Date': '5/10/27', Category: 'Sport', Entity: 'Personal', Type: 'Swim' }, ON_PLAN('Swim'))), ['Start Date', 'the plan "Swim" has more than one stop on this day — the paste cannot tell which']);
  // A stop that takes no record: refused on Type, in that entry's own words.
  assert.deepEqual(refusedRow(landed({ 'Start Date': '5/11/27', Category: 'Food', Entity: 'Personal', Type: 'Market' }, ON_PLAN('Market'))), ['Type', MARKET_HAS_LINES_WORDS]);
  assert.equal(landed({ 'Start Date': '5/10/27', Category: 'Food', Entity: 'Personal', Type: 'Market' }, ON_PLAN('Market')).placement.kind, 'plan', 'the same plan’s stop that does take one');
});

test('T7 the paste never writes over what stands: a stop already recorded keeps its record, and a stop whose planned vendor is another name keeps it — each said where the row says something else; the same record and the same name are quiet', () => {
  // PASTE-02 (Alex, 2026-11-27, ruling A.1): what stands is said ONLY WHERE THE ROW SAYS SOMETHING ELSE. Until then the record's sentence was said whenever the row held a
  // Total (USD) or Items, and this test's first case — the record's own Total (USD) and Items — expected it. That case is quiet now; the said case types another Total (USD).
  const dinner: Typed = { 'Start Date': '5/10/27', Category: 'Dining', Entity: 'Personal', Type: 'Dinner' };
  // The record's own two — done, its amount the row's Total (USD), its note the row's Items: the row lands on the stop, and nothing is said.
  const quiet = landed({ ...dinner, Items: 'the set menu', 'Total (USD)': '$15' }, ON_PLAN('Dinner'));
  assert.deepEqual(quiet.placement.kind === 'plan' && [quiet.placement.stop.key, quiet.placement.happened, quiet.placement.notWritten], [DINNER.key, { kind: 'recorded' }, []]);
  assert.equal(quiet.shown.lands, `on "Dinner", its 19:00 stop · ${ALREADY_RECORDED_WORDS}`, 'the same rows pasted again are no warning');
  // Another Total (USD): the record is kept, and what the row typed for it is said as not written.
  const both = landed({ ...dinner, Items: 'the set menu', 'Total (USD)': '$16' }, ON_PLAN('Dinner'));
  assert.deepEqual(both.placement.kind === 'plan' && [both.placement.stop.key, both.placement.happened, both.placement.notWritten], [DINNER.key, { kind: 'recorded' }, ['Total (USD), Items — not written: this stop is already recorded — the paste does not write over a record']]);
  assert.deepEqual(sheetCells(both.shown.sheet), { start: '19:00', end: BLANK, account: 'P-6150', accountName: 'Dining Out', subAccountName: 'Dinner', went: WENT_WORD, budget: '$15', actual: '$15' }, 'the record that stands, as the time sheet prints it');
  assert.equal(both.shown.lands, `on "Dinner", its 19:00 stop · ${ALREADY_RECORDED_WORDS} · Total (USD), Items — not written: this stop is already recorded — the paste does not write over a record`);
  assert.equal(RECORDED_NOT_WRITTEN_WORDS, 'Total (USD), Items — not written: this stop is already recorded — the paste does not write over a record');
  // The one sentence, as ruled, in every other case where the row holds either of the two: the record's Total (USD) without its note, its note without its Total (USD).
  assert.equal(landed({ ...dinner, 'Total (USD)': '$15' }, ON_PLAN('Dinner')).shown.lands, `on "Dinner", its 19:00 stop · already recorded · ${RECORDED_NOT_WRITTEN_WORDS}`);
  assert.equal(landed({ ...dinner, Items: 'the set menu' }, ON_PLAN('Dinner')).shown.lands, `on "Dinner", its 19:00 stop · already recorded · ${RECORDED_NOT_WRITTEN_WORDS}`);
  assert.equal(landed(dinner, ON_PLAN('Dinner')).shown.lands, 'on "Dinner", its 19:00 stop · already recorded', 'nothing typed for the record: nothing said');
  // A recorded stop with no planned vendor still takes the row's vendor: the record is not the vendor.
  assert.equal(landed({ ...dinner, Vendor: 'Oat House' }, ON_PLAN('Dinner')).shown.lands, 'on "Dinner", its 19:00 stop · vendor: Personal\'s own · already recorded');
  // Another vendor standing: kept, and said.
  const coffee: Typed = { 'Start Date': '5/10/27', Category: 'Dining', Entity: 'Personal', Type: 'Coffee', 'Total (USD)': '2.50' };
  const other = landed({ ...coffee, Vendor: 'Corner Cup' }, ON_PLAN('Coffee'));
  assert.deepEqual(other.placement.kind === 'plan' && [other.placement.vendor, other.placement.notWritten], [{ kind: 'none' }, ['Vendor — not written: this stop already has the vendor "Bean Bar" — the paste does not change a vendor']]);
  assert.equal(other.shown.lands, 'on "Coffee", its 08:00 stop · recorded: went, $2.50 · Vendor — not written: this stop already has the vendor "Bean Bar" — the paste does not change a vendor');
  // The same vendor standing — ignoring case and spacing: no vendor to write, and nothing said.
  const same = landed({ ...coffee, 'Start Date': '5/9/27', Vendor: ' bean   BAR ' }, ON_PLAN('Coffee'));
  assert.deepEqual(same.placement.kind === 'plan' && [same.placement.stop.key, same.placement.vendor, same.placement.notWritten], [COFFEE_SUN.key, { kind: 'none' }, []]);
  assert.equal(same.shown.lands, 'on "Coffee", its 08:00 stop · recorded: went, $2.50');
  // No vendor typed on a stop that has one: nothing to write, nothing said.
  assert.equal(landed(coffee, ON_PLAN('Coffee')).shown.lands, 'on "Coffee", its 08:00 stop · recorded: went, $2.50');
});

// ── T8 · WHERE A ROW LANDS — A ONE-OFF (ruling A.7 g) ────────────────────────

test('T8 a one-off, under an account of the book: at its day and Start Time in the viewer’s zone — recorded went when past with a Total (USD), planned when still ahead', () => {
  const climbing: Typed = { 'Start Date': '5/10/27', 'Start Time': '8:00 PM', 'End Time': '9:30 PM', Category: 'Fun', Entity: 'Personal', Type: 'Climbing', Vendor: 'Summit Gym', 'Total (USD)': '18', 'Budget (USD)': '$18.00' };
  const went = landed(climbing, ONE_OFF('6200'));
  assert.equal(went.placement.kind, 'oneOff');
  if (went.placement.kind !== 'oneOff') return;
  assert.deepEqual([went.placement.book.id, went.placement.account, went.placement.instant], ['P', { code: '6200', name: 'Recreation' }, at(MON, '20:00')], 'the day and time in the zone handed in');
  assert.deepEqual([went.placement.happened, went.placement.notWritten, went.placement.vendor], [{ kind: 'went', cents: 1800, items: null }, [], { kind: 'new', name: 'Summit Gym' }]);
  assert.deepEqual([went.placement.start, went.placement.end, went.placement.name, went.placement.budgetCents], ['20:00', '21:30', 'Climbing', 1800], 'the new stop’s own facts, as the row holds them');
  assert.deepEqual(sheetCells(went.shown.sheet), { start: '20:00', end: '21:30', account: 'P-6200', accountName: 'Recreation', subAccountName: 'Climbing', went: WENT_WORD, budget: '$18', actual: '$18' });
  assert.equal(went.shown.lands, 'a one-off at 20:00, under P-6200 Recreation · vendor: new to Personal · recorded: went, $18.00');
  assert.equal(went.shown.tone, 'placed');
  // In another zone the same day and clock are another instant.
  const elsewhere = landed(climbing, ONE_OFF('6200'), { ...CONTEXT, zone: 'UTC' }).placement;
  assert.equal(elsewhere.kind === 'oneOff' && elsewhere.instant, '2027-05-10T20:00:00.000Z');
  // Planned: still ahead — its Total (USD), typed, is said; no End Time is a blank END.
  const ahead = landed({ ...climbing, 'Start Date': '5/11/27', 'Start Time': '19:00', 'End Time': '' }, ONE_OFF('6200'));
  assert.deepEqual(ahead.placement.kind === 'oneOff' && [ahead.placement.instant, ahead.placement.happened, ahead.placement.notWritten], [at(TUE, '19:00'), { kind: 'planned' }, [TOTAL_AHEAD_WORDS]]);
  assert.deepEqual(sheetCells(ahead.shown.sheet), { start: '19:00', end: BLANK, account: 'P-6200', accountName: 'Recreation', subAccountName: 'Climbing', went: PLANNED_WORD, budget: '$18', actual: BLANK });
  assert.equal(ahead.shown.lands, 'a one-off at 19:00, under P-6200 Recreation · vendor: new to Personal · planned: still ahead · Total (USD) — not written: the stop is still ahead');
  // Past with no Total (USD): not recorded.
  const none = landed({ ...climbing, 'Total (USD)': '', Vendor: '', Items: 'two routes' }, ONE_OFF('6200'));
  assert.deepEqual(sheetCells(none.shown.sheet), { start: '20:00', end: '21:30', account: 'P-6200', accountName: 'Recreation', subAccountName: 'Climbing', went: NOT_RECORDED_WORDS, budget: '$18', actual: BLANK });
  assert.equal(none.shown.lands, `a one-off at 20:00, under P-6200 Recreation · ${NO_TOTAL_WORDS} · ${ITEMS_NO_TOTAL_WORDS}`);
  // The business book's one-off wears its own letter.
  assert.equal(landed({ ...climbing, Entity: 'Business', Type: 'Paper' }, ONE_OFF('6400')).shown.lands, 'a one-off at 20:00, under B-6400 Supplies · vendor: Business\'s own · recorded: went, $18.00');
});

test('T8 a one-off, refused: no such account in the book’s chart; no Start Time; no Budget (USD), or 0 — and a stop of this name already on the time sheet at this day and time takes the row', () => {
  const climbing: Typed = { 'Start Date': '5/10/27', 'Start Time': '8:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Climbing', 'Total (USD)': '18', 'Budget (USD)': '18' };
  assert.deepEqual(refusedRow(landed(climbing, ONE_OFF('9999'))), ['Category', 'the book\'s chart has no account "9999"']);
  assert.deepEqual(refusedRow(landed(climbing, ONE_OFF('6400'))), ['Category', 'the book\'s chart has no account "6400"'], 'another book’s account is not this book’s');
  assert.deepEqual(refusedRow(landed({ ...climbing, 'Start Time': '' }, ONE_OFF('6200'))), ['Start Time', ONE_OFF_NO_START_WORDS]);
  assert.deepEqual(refusedRow(landed({ ...climbing, 'Budget (USD)': '' }, ONE_OFF('6200'))), ['Budget (USD)', ONE_OFF_NO_BUDGET_WORDS]);
  assert.deepEqual(refusedRow(landed({ ...climbing, 'Budget (USD)': '$0.00' }, ONE_OFF('6200'))), ['Budget (USD)', 'a one-off needs a Budget (USD) above 0']);
  assert.equal(ONE_OFF_NO_START_WORDS, 'a one-off needs a Start Time');
  // In the ruling's order: the account, then the Start Time, then the Budget.
  assert.deepEqual(refusedRow(landed({ ...climbing, 'Start Time': '', 'Budget (USD)': '' }, ONE_OFF('9999')))[0], 'Category');
  assert.deepEqual(refusedRow(landed({ ...climbing, 'Start Time': '', 'Budget (USD)': '' }, ONE_OFF('6200')))[0], 'Start Time');
  // PASTE-02 (Alex, 2026-11-27, ruling A.4): a stop of the row's own name already on the time sheet — that book, day, start time and name — TAKES the row. Until then the row was
  // refused on Type: 'already on the time sheet — a stop of this name stands at this day and time' (ALREADY_ON_SHEET_WORDS, which is gone).
  const cinema: Typed = { ...climbing, 'Start Time': '9:00 PM', Type: 'Cinema' };
  const taken = landed(cinema, ONE_OFF('6200'));
  assert.deepEqual(taken.placement.kind === 'plan' && [taken.placement.standing, taken.placement.plan, taken.placement.stop.key], [true, 'Cinema', CINEMA_MON.key]);
  assert.equal(taken.shown.lands, 'on the stop "Cinema" at 21:00, already on the time sheet · recorded: went, $18.00');
  assert.ok(!('ALREADY_ON_SHEET_WORDS' in rule), 'the refusal is gone from the rule file');
  for (const over of [{ 'Start Time': '9:30 PM' }, { 'Start Date': '5/11/27' }, { Type: 'Cinema club' }, { Entity: 'Business' }] as const) {
    assert.equal(landed({ ...cinema, ...over }, over.Entity === undefined ? ONE_OFF('6200') : ONE_OFF('6400')).placement.kind, 'oneOff', `another ${Object.keys(over)[0]} is another stop`);
  }
  // A chart that was not read is the caller's error, by name — never an empty list.
  assert.throws(() => landed(climbing, ONE_OFF('6200'), { ...CONTEXT, charts: {} }), /pasteRows: the chart of the book "Home" was not read/);
});

// ── T9 · PLACED NOWHERE (ruling A.7 a to e) ──────────────────────────────────

test('T9 placed nowhere, in the ruling’s order: a booking; a date with nothing on it; no book of that word; two books of one word; no pick — each with its words and its tone', () => {
  // A booking: its Days is more than 1 — whatever is picked, and before its book is looked for.
  const booking = landed({ 'Start Date': '5/12/27', Category: 'Lodging', Entity: 'Estate', Type: 'Inn', 'Total (USD)': '300', Days: '3' }, ON_PLAN('Lunch'));
  assert.deepEqual([booking.placement, booking.shown.lands, booking.shown.tone], [{ kind: 'booking' }, BOOKING_WORDS, 'quiet']);
  assert.equal(BOOKING_WORDS, 'a booking (its Days is more than 1) — bookings are not rows of the time sheet yet');
  assert.equal(landed({ ...LUNCH, Days: '1' }, ON_PLAN('Lunch')).placement.kind, 'plan', 'Days of 1 is a stop');
  // A date with nothing on it.
  const blank = landed({ 'Start Date': '5/12/27' }, null);
  assert.deepEqual([blank.placement, blank.shown.lands, blank.shown.tone], [{ kind: 'blank' }, BLANK_DATE_WORDS, 'quiet']);
  assert.equal(BLANK_DATE_WORDS, 'a date with nothing on it');
  // No book carries its Entity's word — before any pick is asked.
  const stranger = landed({ ...LUNCH, Entity: 'Estate' }, null);
  assert.deepEqual(refusedRow(stranger), ['Entity', 'no book is called "Estate" — the books here: Personal, Business']);
  assert.deepEqual([stranger.shown.lands, stranger.shown.tone], ['Entity — no book is called "Estate" — the books here: Personal, Business', 'refused']);
  assert.deepEqual(refusedRow(landed({ ...LUNCH, Entity: 'Trust' }, ON_PLAN('Lunch')))[0], 'Entity', 'a book with no word is not offered, even by its own name');
  // Two books of one word.
  const twins: PasteContext = { ...CONTEXT, books: [...BOOKS, { id: 'P2', name: 'Second home', entityType: 'personal' }] };
  assert.deepEqual(refusedRow(landed(LUNCH, ON_PLAN('Lunch'), twins)), ['Entity', 'two books are called "Personal" — the paste cannot tell them apart']);
  assert.deepEqual(refusedRow(landed({ ...LUNCH, Entity: 'Estate' }, null, twins)), ['Entity', 'no book is called "Estate" — the books here: Personal, Business'], 'a word two books share is said once');
  // No pick for its kind.
  const waiting = landed(LUNCH, null);
  assert.deepEqual([waiting.placement, waiting.shown.lands, waiting.shown.tone], [{ kind: 'pick', words: 'pick where Dining › Lunch goes — a plan, or a one-off under an account' }, 'pick where Dining › Lunch goes — a plan, or a one-off under an account', 'pick']);
  // A pick for another kind is not this kind's.
  const other = placePaste(pasteOf(LUNCH), { [kindKeyOf({ entity: 'Personal', category: 'Dining', type: 'Tea' })]: ON_PLAN('Tea') }, CONTEXT);
  assert.equal(other[0].kind, 'pick');
  // A row placed nowhere: every cell of ON THE TIME SHEET is blank.
  for (const nowhere of [booking, blank, stranger, waiting]) assert.deepEqual(nowhere.shown.sheet, ON_TIME_SHEET_KEYS.map(() => BLANK));
});

// ── T10 · THE VENDOR (ruling A.7 h) ──────────────────────────────────────────

test('T10 the vendor of a placed row: none typed → none; the book’s own, ignoring case and spacing; else new — another book’s vendor of the same name is not this book’s', () => {
  const home = { id: 'P' };
  assert.deepEqual(pastedVendorOf(null, home, CONTEXT.vendors), { kind: 'none' });
  assert.deepEqual(pastedVendorOf('Oat House', home, CONTEXT.vendors), { kind: 'own', id: 'v-oat', name: 'Oat House' });
  assert.deepEqual(pastedVendorOf(' oat   HOUSE ', home, CONTEXT.vendors), { kind: 'own', id: 'v-oat', name: 'Oat House' }, 'the directory’s own name rule');
  assert.deepEqual(pastedVendorOf('Corner Cup', home, CONTEXT.vendors), { kind: 'new', name: 'Corner Cup' });
  assert.deepEqual(pastedVendorOf('Summit Gym', home, CONTEXT.vendors), { kind: 'new', name: 'Summit Gym' }, 'the shop’s vendor is not the home book’s');
  assert.deepEqual(pastedVendorOf('Summit Gym', { id: 'B' }, CONTEXT.vendors), { kind: 'own', id: 'v-gym', name: 'Summit Gym' });
  assert.deepEqual(pastedVendorOf('Oat House', home, []), { kind: 'new', name: 'Oat House' });
  // On the row: the book's own, new to the book, or no vendor part at all.
  assert.match(landed(LUNCH, ON_PLAN('Lunch')).shown.lands, / · vendor: Personal's own · /);
  assert.match(landed({ ...LUNCH, Vendor: 'Corner Cup' }, ON_PLAN('Lunch')).shown.lands, / · vendor: new to Personal · /);
  assert.doesNotMatch(landed({ ...LUNCH, Vendor: '' }, ON_PLAN('Lunch')).shown.lands, /vendor/);
});

// ── T11 · THE ROW SHOWN AND THE COUNTS (rulings A.8 and A.9) ─────────────────

test('T11 the table: YOUR SHEET’s eight columns as he typed them, a blank cell the sheet’s blank; ON THE TIME SHEET’s eight by the time sheet’s own head words; LANDS last', () => {
  assert.deepEqual(YOUR_SHEET_COLUMNS.map((column) => column.head), ['ROW', 'DATE', 'TIME', 'ENTITY', 'CATEGORY › TYPE', 'VENDOR', 'ITEMS', 'TOTAL (USD)']);
  assert.deepEqual([...ON_TIME_SHEET_KEYS], ['start', 'end', 'account', 'accountName', 'subAccountName', 'went', 'budget', 'actual']);
  assert.deepEqual(ON_TIME_SHEET_COLUMNS.map((column) => column.head), ON_TIME_SHEET_KEYS.map(headWordOf));
  assert.deepEqual(ON_TIME_SHEET_COLUMNS.map((column) => column.head), ['START', 'END', 'COA', 'CATEGORY', 'TYPE', 'WENT', 'BUDGET', 'ACTUAL']); // COALEVELS-01 (2026-11-27): the time sheet's own head words are his sheet's now — COA, CATEGORY and TYPE where ACCOUNT, ACCOUNT NAME and SUB ACCOUNT NAME stood; the eight keys and their order as they were
  assert.deepEqual([YOUR_SHEET_WORDS, ON_TIME_SHEET_WORDS, LANDS_WORDS], ['YOUR SHEET', 'ON THE TIME SHEET', 'LANDS']);
  // Money set right; the long cells — names, items, where it lands — are the ones that may wrap.
  assert.deepEqual([...YOUR_SHEET_COLUMNS, ...ON_TIME_SHEET_COLUMNS].filter((column) => column.money).map((column) => column.head), ['TOTAL (USD)', 'BUDGET', 'ACTUAL']);
  assert.deepEqual([...YOUR_SHEET_COLUMNS, ...ON_TIME_SHEET_COLUMNS].filter((column) => !column.short).map((column) => column.head), ['CATEGORY › TYPE', 'VENDOR', 'ITEMS', 'CATEGORY', 'TYPE']); // COALEVELS-01 (2026-11-27): the same two long columns of the time sheet, under their new head words
  // YOUR SHEET: the row's number, then what he typed — TIME the start, or start – end.
  assert.deepEqual(landed(LUNCH, null).shown.yours, ['2', '5/10/27', '12:30 PM – 1:00 PM', 'Personal', 'Dining › Lunch', 'Oat House', 'two kinds of soup', '$6.90']);
  assert.deepEqual(landed({ ...LUNCH, 'End Time': '', Vendor: '', Items: '', 'Total (USD)': '' }, null).shown.yours, ['2', '5/10/27', '12:30 PM', 'Personal', 'Dining › Lunch', BLANK, BLANK, BLANK]);
  assert.deepEqual(landed({ 'Start Date': '5/12/27' }, null).shown.yours, ['2', '5/12/27', BLANK, BLANK, BLANK, BLANK, BLANK, BLANK]);
  // A refused row is still shown as it was typed — the cell that stops it among them.
  assert.deepEqual(landed({ ...LUNCH, 'Start Date': 'soon', 'Start Time': '', 'End Time': '2:00 PM', Category: '' }, null).shown.yours, ['2', 'soon', `${BLANK} – 2:00 PM`, 'Personal', `${BLANK} › Lunch`, 'Oat House', 'two kinds of soup', '$6.90']);
  assert.equal(BLANK, '—');
  // One row of the table a row of the paste, in its order, each with its number.
  const paste = pasteOf(LUNCH, { 'Start Date': '5/12/27' }, { ...LUNCH, 'Start Date': 'soon' });
  const placed = placePaste(paste, {}, CONTEXT);
  assert.deepEqual(pasteShown(paste, placed).map((row) => [row.number, row.tone, row.yours.length, row.sheet.length]), [[2, 'pick', 8, 8], [3, 'quiet', 8, 8], [4, 'refused', 8, 8]]);
  assert.throws(() => pasteShown(paste, placed.slice(1)), /pasteRows: 2 placements for 3 rows — one placement a row/);
});

test('T11 the counts, one line — every row counted once, under what became of it; "row read", "one-off", "booking" and "date with nothing on it" for one', () => {
  const paste = pasteOf(
    LUNCH,
    { ...LUNCH, Items: 'again' },
    { 'Start Date': '5/10/27', Category: 'Dining', Entity: 'Personal', Type: 'Tea' },
    { 'Start Date': '5/10/27', 'Start Time': '8:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Climbing', 'Budget (USD)': '18' },
    { 'Start Date': '5/11/27', 'Start Time': '7:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Climbing', 'Budget (USD)': '18' },
    { 'Start Date': '5/12/27', Category: 'Lodging', Entity: 'Personal', Type: 'Inn', Days: '2' },
    { 'Start Date': '5/12/27' },
    { 'Start Date': '5/9/27' },
    { 'Start Date': '5/10/27', Category: 'Sport', Entity: 'Personal', Type: 'Swim' },
    { 'Start Date': 'soon' },
  );
  const key = (category: string, type: string): string => kindKeyOf({ entity: 'Personal', category, type });
  assert.equal(countsWords(placePaste(paste, {}, CONTEXT)), '10 rows read · 0 on a plan · 0 one-offs · 1 booking · 6 waiting for a pick · 1 that cannot be placed · 2 dates with nothing on them');
  const picks = { [key('Dining', 'Lunch')]: ON_PLAN('Lunch'), [key('Dining', 'Tea')]: ON_PLAN('Tea'), [key('Fun', 'Climbing')]: ONE_OFF('6200') };
  const placed = placePaste(paste, picks, CONTEXT);
  assert.deepEqual(placed.map((p) => p.kind), ['plan', 'refused', 'plan', 'oneOff', 'oneOff', 'booking', 'blank', 'blank', 'pick', 'refused']);
  // PASTE-02 (Alex, 2026-11-27, ruling A.5): the one-offs say how many are new — '2 one-offs' and '1 one-off' until then; with none the line still reads '0 one-offs'.
  assert.equal(countsWords(placed), '10 rows read · 2 on a plan · 2 one-offs (2 new) · 1 booking · 1 waiting for a pick · 2 that cannot be placed · 2 dates with nothing on them');
  // The singulars.
  assert.equal(countsWords(placePaste(pasteOf({ 'Start Date': '5/12/27' }), {}, CONTEXT)), '1 row read · 0 on a plan · 0 one-offs · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 1 date with nothing on it');
  assert.equal(landed({ 'Start Date': '5/10/27', 'Start Time': '8:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Climbing', 'Budget (USD)': '18' }, ONE_OFF('6200')).counts, '1 row read · 0 on a plan · 1 one-off (1 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  assert.equal(landed(LUNCH, ON_PLAN('Lunch')).counts, '1 row read · 1 on a plan · 0 one-offs · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  // Every row is counted once: the six after "rows read" add up to it.
  const numbers = countsWords(placed).split(' · ').map((part) => Number(part.split(' ')[0]));
  assert.equal(numbers.slice(1).reduce((sum, n) => sum + n, 0), numbers[0]);
  // A pick places every row again: the same paste, the same context, another pick — and nothing handed in is changed.
  const frozen = Object.freeze({ ...picks });
  assert.deepEqual(placePaste(paste, frozen, CONTEXT), placed);
});

// ── T12 · THE RULE FILE (ruling A) ───────────────────────────────────────────

test('T12 the rule file is pure and names no function previewOf; its header quotes are its alone; every sentence is typed there', () => {
  const rules = code(RULES);
  assert.doesNotMatch(rules, /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|from 'next|localStorage|sessionStorage|document\./, 'no fetch, no clock, no Prisma, no browser');
  assert.doesNotMatch(rules, /\bpreviewOf\b/, 'src/lib/table/preview.ts owns that name');
  assert.match(comments(RULES), /^\/\*\*\n \* pasteRows — ROWS PASTED FROM A SHEET: EVERY ROW READ, PLACED AND SHOWN\. NOTHING IS WRITTEN \(PASTE-01, Alex, 2026-11-25\)\./);
  // What it reads from the rules that already stand — one import of each, none of a writer.
  // PASTE-02 (Alex, 2026-11-27): nine, not seven — @/lib/calendar/day (a one-off's minutes) and @/lib/table/csv (an amount as the two forms' rules read one) join.
  for (const from of ['@/lib/accountString', '@/lib/budget/days', '@/lib/budget/format', '@/lib/calendar/day', '@/lib/operations/ledger', '@/lib/operations/planVendor', '@/lib/operations/stopRecord', '@/lib/table/csv', '@/lib/time']) assert.equal(countOf(rules, new RegExp(`from '${from}';`, 'g')), 1, from);
  assert.equal(countOf(rules, /^import /gm), 9, 'and nothing else');
  // The leaf's own words, as they read.
  assert.deepEqual([rule.PASTE_OPEN_WORDS, rule.PASTE_TITLE_WORDS, rule.PASTE_HOW_WORDS, rule.PASTE_READ_WORDS, rule.PASTE_CLEAR_WORDS, rule.PASTE_CLOSE_WORDS, rule.PASTE_PICKS_WORDS, rule.PASTE_NO_PICK_WORDS, rule.PASTE_ON_PLAN_WORDS, rule.PASTE_ONE_OFF_WORDS], [
    '+ paste rows from a sheet', 'rows from your sheet — read and placed here; nothing is written until you save' /* PASTE-02 (2026-11-27): '… nothing is written' until then */, 'copy the rows in your sheet with its header row, and paste them here',
    'read the rows', 'clear', 'close', 'where each kind of row goes — nothing is chosen for you', '— pick —', 'on your plan', 'a one-off, under',
  ]);
  assert.equal(PLANNED_AHEAD_WORDS, 'planned: still ahead');
});

// ── T13 · THE LEAF (ruling B; PASTE-02 ruling D) ─────────────────────────────

test('T13 the leaf writes through the one runner alone: the six writers handed to it and called nowhere else, no request and no method of its own, nothing stored in the browser; it reads by the time sheet’s read, the one JSON reader and the provider’s list', () => {
  // PASTE-02 (Alex, 2026-11-27, ruling D): THE LEAF WRITES NOW. Until then this test was 'T13 the leaf writes nothing: …' and pinned no writer imported, the vendors read by the
  // Budget's hook (useDirectory), a new read forgetting the picks (setPicks({}) in it), the reads inside "read the rows" itself, and the box mounted with `close` alone.
  const leaf = code(LEAF);
  assert.match(leaf, /^'use client';/m);
  // No request of its own at all, and no method anywhere: every write is a writer's.
  assert.doesNotMatch(leaf, /\bfetch\s*\(|\bmethod\b|\bPOST\b|\bPUT\b|\bPATCH\b|\bDELETE\b/, 'no request and no method of its own');
  // The six writers: imported, handed to the ONE runner in one object — and named nowhere else, so the leaf calls none itself.
  assert.match(leaf, /import \{ setStopRecord \} from '\.\.\/stops\/stopWrites';/);
  assert.match(leaf, /import \{ addVendor, createOneOff, readOneOffLine, setLineMinutes, setVendor \} from '\.\/ledgerWrites';/);
  assert.match(leaf, /const outcomes = await runPaste\(placed\.writes, \{ createOneOff, readOneOffLine, setLineMinutes, addVendor, setVendor, setRecord: setStopRecord \}, \(progress\) => \{/);
  for (const writer of ['createOneOff', 'readOneOffLine', 'setLineMinutes', 'addVendor', 'setVendor', 'setStopRecord']) assert.equal(countOf(leaf, new RegExp(`\\b${writer}\\b`, 'g')), 2, `${writer}: imported, and handed to the runner`);
  assert.equal(countOf(leaf, /\brunPaste\(/g), 1, 'the one runner, once');
  assert.doesNotMatch(leaf, /clearStopRecord|moveStopRecord|clearVendor/, 'nothing is cleared, moved or undone');
  // Nothing stored in the browser.
  assert.doesNotMatch(leaf, /localStorage|sessionStorage|document\.cookie|indexedDB|\bcookie\b/i);
  // What it reads, and how: GET only, through the readers that already stand — the vendors by the one JSON reader now, through the rule; the Budget's hook is gone.
  assert.match(leaf, /import \{ readJson, type Read \} from '\.\.\/week\/weekReads';/);
  assert.match(leaf, /import \{ readLedger \} from '\.\/ledgerReads';/);
  assert.match(leaf, /import \{ useOperationsEntity \} from '\.\.\/EntitySelector';/);
  assert.doesNotMatch(leaf, /useDirectory|VendorBox/);
  assert.equal(countOf(leaf, /await readLedger\(days\.from, days\.to\);/g), 1);
  assert.equal(countOf(leaf, /await readJson\(`\/api\/chart-of-accounts\?entity_id=\$\{encodeURIComponent\(book\.id\)\}`\);/g), 1);
  assert.match(leaf, /const listed = await readJson\('\/api\/operations\/vendor-directory'\);\n\s*if \(!listed\.ok\) return \{ ok: false, words: vendorsUnreadWords\(listed\.words\) \};\n\s*const vendors = vendorsOf\(listed\.value\);\n\s*if \(!vendors\.ok\) return \{ ok: false, words: vendorsUnreadWords\(vendors\.words\) \};/);
  assert.deepEqual([...leaf.matchAll(/\/api\/[\w/-]+/g)].map((m) => m[0]), ['/api/chart-of-accounts', '/api/operations/vendor-directory'], 'the chart route and the directory route, each read — and no other');
  // ONE read function: the sheet's own span rule first — its refusal is the answer and nothing is sent; no readable row, nothing read.
  assert.equal(countOf(leaf, /async function readAgainst\(paste: Paste, books: readonly PasteBook\[\], zone: string\): Promise<Read<PasteContext>> \{/g), 1);
  assert.match(leaf, /const span = pasteSpanOf\(paste\);\n\s*if \(span === null\) return \{ ok: true, value: \{ books, sheet: \[\], recording: \{\}, charts: \{\}, vendors: \[\], zone, now \} \};\n\s*const days = spanInput\(span\.from, span\.to\);\n\s*if \(!days\.ok\) return \{ ok: false, words: days\.message \};\n\s*const ledger = await readLedger\(days\.from, days\.to\);/);
  // A chart that cannot be read is said with the book's name — never taken as an empty list.
  assert.match(leaf, /if \(!answer\.ok\) return \{ ok: false, words: chartUnreadWords\(book\.name, answer\.words\) \};\n\s*const chart = chartOf\(answer\.value\);\n\s*if \(!chart\.ok\) return \{ ok: false, words: chartUnreadWords\(book\.name, chart\.words\) \};\n\s*charts\[book\.id\] = chart\.accounts;/);
  // The clock is the browser's, read once per read — in the one read function; the zone is the browser's, read on mount.
  assert.equal(countOf(leaf, /new Date\(/g), 1);
  assert.match(leaf, /async function readAgainst\([^)]*\): Promise<Read<PasteContext>> \{\n\s*const now = new Date\(\);/);
  assert.match(leaf, /useEffect\(\(\) => \{ setZone\(Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone\); \}, \[\]\);/);
  // A new read forgets the rows, the run and the changed line — and KEEPS the picks; "clear" alone forgets them.
  assert.match(leaf, /setRefusal\(null\);\n\s*setRows\(null\);\n\s*setRun\(null\);\n\s*setChanged\(false\);\n\s*const paste = readPaste\(text\);\n\s*if \(!paste\.ok\) \{ setRefusal\(paste\.words\); return; \}/);
  assert.equal(countOf(leaf, /setPicks\(\{\}\)/g), 1, '"clear" alone forgets the picks');
  // A pick places every row again through the rule — with the picks that still stand.
  assert.match(leaf, /const standing = standingPicks\(picks, kinds, read\.context\);\n\s*const placed = placePaste\(read\.paste, standing, read\.context\);/);
  assert.match(leaf, /const shown = useMemo\(\(\) => \(rows === null \? null : placedOf\(rows, picks\)\), \[rows, picks\]\);/);
  // The box is mounted only while it is open — and its mount carries the picks, which live above it.
  assert.match(leaf, /\{!open && <button type="button" className=\{chip\} onClick=\{\(\) => setOpen\(true\)\} data-ledger-paste-open>\{PASTE_OPEN_WORDS\}<\/button>\}\n\s*\{open && <Box close=\{\(\) => setOpen\(false\)\} picks=\{picks\} setPicks=\{setPicks\} onWritten=\{onWritten\} \/>\}/);
  // The table wears the shared table's classes.
  assert.match(leaf, /import \{ cellClass as cell, chipClass as chip, headClass as head, moneyClass as money \} from '@\/components\/table\/DataTable';/);
});

test('T13 every sentence the leaf prints comes from the two rule files, and the zone’s line from ledger.ts: no text typed between its tags, no word of a rule typed again, and every printed expression is a rule’s own or a value it returned', () => {
  // PASTE-02 (Alex, 2026-11-27, ruling D.10): TWO rule files — pasteRows.ts and pasteSave.ts — and "+ expense"'s own zone line. Until then this test was 'T13 every sentence the
  // leaf prints comes from pasteRows.ts: …', the printed expressions were the read's alone, and the refusals were set one by one inside "read the rows".
  const leaf = code(LEAF);
  // No text between tags: every child that prints is an expression.
  assert.doesNotMatch(leaf, />[^<>{}()=]*[A-Za-z][^<>{}()=]*<\//, 'no sentence typed in the markup');
  // What is printed between tags, expression by expression.
  const printed = [...new Set([...leaf.matchAll(/>\{([^{}]+)\}<\//g)].map((m) => m[1]))].sort();
  assert.deepEqual(printed, [
    'LANDS_WORDS', 'ON_TIME_SHEET_WORDS', 'PASTE_CLEAR_WORDS', 'PASTE_CLOSE_WORDS', 'PASTE_HOW_WORDS', 'PASTE_NO_PICK_WORDS', 'PASTE_OPEN_WORDS', 'PASTE_PICKS_WORDS', 'PASTE_READ_WORDS', 'PASTE_TITLE_WORDS', 'YOUR_SHEET_WORDS',
    'accountWords(account)', 'column.head', 'kind.label', 'kind.rows', 'line', 'plan', 'refusal', 'row.lands', 'shown.counts', 'words',
    // The save's: the amber line, the button, nothing to save, the two lines while it runs, the changed line, the run's line, the read-again line, a row's outcome — and the zone.
    'VENDORS_STAY_WORDS', 'saveWords(shown.writes)', 'NOTHING_TO_SAVE_WORDS', 'CHECKING_WORDS', 'savingWords(saving.i, saving.of, saving.row)', 'CHANGED_WORDS', 'runWords(run.outcomes)', 'SPENT_WORDS', 'pasteOutcomeWords(outcome)', 'zoneWords(zone)',
  ].sort());
  // And in attributes: the box's label and the two groups of a pick.
  assert.deepEqual([...leaf.matchAll(/(?:aria-label|label)=\{([^{}]+)\}/g)].map((m) => m[1]), ['PASTE_HOW_WORDS', 'PASTE_ON_PLAN_WORDS', 'PASTE_ONE_OFF_WORDS']);
  assert.doesNotMatch(leaf, /(?:aria-label|label|title|placeholder|alt)="/, 'no word typed in an attribute');
  // Every refusal it shows: the rule's reading of the text, or the one read function's answer — in "read the rows", and again in the save.
  assert.deepEqual([...leaf.matchAll(/setRefusal\(([^;]*)\);/g)].map((m) => m[1]), ['null', 'paste.words', 'against.words', 'null', 'null', 'against.words']);
  // …and that answer's words are the span rule's, a read's own, or a rule's sentence over a read's own.
  assert.deepEqual([...leaf.matchAll(/return \{ ok: false, words: ([^;]*) \};/g)].map((m) => m[1]), [
    'days.message', 'ledger.words', 'chartUnreadWords(book.name, answer.words)', 'chartUnreadWords(book.name, chart.words)', 'vendorsUnreadWords(listed.words)', 'vendorsUnreadWords(vendors.words)',
  ]);
  // Each printed name is a rule file's — imported from it, and from nowhere else; the zone's line is ledger.ts's.
  const importedFrom = (module: string): string[] => {
    const found = new RegExp(`import \\{([^}]*)\\} from '@/lib/operations/${module}';`).exec(leaf);
    if (found === null) return assert.fail(`the leaf imports ${module}`);
    return found[1].split(',').map((name) => name.trim()).filter((name) => name !== '' && !name.startsWith('type '));
  };
  const names = importedFrom('pasteRows');
  for (const name of ['LANDS_WORDS', 'ON_TIME_SHEET_WORDS', 'PASTE_CLEAR_WORDS', 'PASTE_CLOSE_WORDS', 'PASTE_HOW_WORDS', 'PASTE_NO_PICK_WORDS', 'PASTE_ONE_OFF_WORDS', 'PASTE_ON_PLAN_WORDS', 'PASTE_OPEN_WORDS', 'PASTE_PICKS_WORDS', 'PASTE_READ_WORDS', 'PASTE_TITLE_WORDS', 'YOUR_SHEET_WORDS', 'accountWords', 'chartUnreadWords', 'vendorsUnreadWords', 'countsWords', 'notReadLines', 'pasteShown', 'placePaste', 'readPaste', 'standingPicks', 'vendorsOf']) {
    assert.ok(names.includes(name), `${name} is the rule's`);
  }
  for (const name of names) assert.ok(name in rule, `${name} is exported by the rule file`);
  const saveNames = importedFrom('pasteSave');
  assert.deepEqual([...saveNames].sort(), ['CHANGED_WORDS', 'CHECKING_WORDS', 'NOTHING_TO_SAVE_WORDS', 'SPENT_WORDS', 'VENDORS_STAY_WORDS', 'daysReached', 'newVendorLines', 'pasteOutcomeWords', 'pasteWritesOf', 'runPaste', 'runStopped', 'runWords', 'saveWords', 'savingWords', 'shownChanged'].sort());
  for (const name of saveNames) assert.ok(name in saveRule, `${name} is exported by the save's rule file`);
  assert.match(leaf, /import \{ spanInput, zoneWords \} from '@\/lib\/operations\/ledger';/, 'the zone’s line is "+ expense"’s own');
  // No sentence of either rule is typed again in the leaf: every one of their words of two or more is in its rule file alone.
  const sentences: [string, string][] = [];
  for (const exported of [rule, saveRule] as readonly Readonly<Record<string, unknown>>[]) {
    for (const [name, value] of Object.entries(exported)) if (typeof value === 'string' && /\s/.test(value)) sentences.push([name, value]);
  }
  assert.ok(sentences.length > 25, 'the two rule files type the sentences');
  for (const [name, words] of sentences) assert.ok(!leaf.includes(words), `${name} is typed in its rule file alone`);
  // The only words of the leaf's own are class names, test hooks, states and paths: no string in it reads as a sentence with a capital or a dash.
  for (const m of leaf.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
    const text = m[1] === undefined ? m[2] : m[1];
    assert.doesNotMatch(text, /[A-Z][a-z]+ [a-z]+|—| – |\.\s|,\s/, `${JSON.stringify(text)} is no sentence`);
  }
});

// ── T14 · THE MOUNT (ruling C) ───────────────────────────────────────────────

test('T14 the section mounts the leaf after the expense form, on the same line — at the head of the controls row (COALEVELS-01, 2026-11-27) — and imports it beside it — two lines, 488 lines still; the expense form’s mount is unchanged; /time mounts what it did', () => {
  const s = code(SECTION);
  assert.equal(linesOf(SECTION).length, 488, 'no line added, none removed — the registry cites three of its lines');
  assert.ok(s.includes("\nimport ExpenseForm from './ExpenseForm'; import PasteRows from './PasteRows';\n"), 'the two imports on the one line');
  // PASTE-02 (Alex, 2026-11-27, ruling E): the leaf is handed what the section does when a day is written — read the time sheet again, and tell the day's card — for every day a save
  // reached. Until then it was mounted bare (`<PasteRows />`): it wrote nothing, so the section had nothing to read again. ONE line edited in place; no line added.
  assert.ok(s.includes('<h2 className="text-sm font-bold text-brand-purple" data-ledger-title>{LEDGER_TITLE_WORDS}</h2><ExpenseForm onWritten={(day) => { setWrites((n) => n + 1); announceDayWritten(day); }} /><PasteRows onWritten={(days) => { setWrites((n) => n + 1); days.forEach(announceDayWritten); }} /><span className="h-4 w-px bg-border" aria-hidden="true" />\n'), 'the expense form’s mount, character for character, and the leaf after it'); // COALEVELS-01 (2026-11-27): the two mounts stand at the head of the shared table's controls row, after the title and before a divider — on a line of their own above the table until then
  assert.deepEqual([countOf(s, /import PasteRows from '\.\/PasteRows';/g), countOf(s, /<PasteRows\b/g), countOf(s, /\bPasteRows\b/g)], [1, 1, 3], 'imported once and mounted once — the name, its path and the mount, and nowhere else');
  assert.equal(countOf(s, /<ExpenseForm\b/g), 1);
  // The leaf is handed the one thing, and nothing else: the days a save reached — the time sheet reads again once, and each day's card is told.
  assert.match(s, /<PasteRows onWritten=\{\(days\) => \{ setWrites\(\(n\) => n \+ 1\); days\.forEach\(announceDayWritten\); \}\} \/>/);
  // Beside "+ expense", in the shared table's controls — above its rows. COALEVELS-01 (2026-11-27): 'Under "+ expense", above the table' (before the table's mount) until then.
  assert.ok(s.indexOf('<DataTable\n') > 0 && s.indexOf('<DataTable\n') < s.indexOf('<PasteRows ') && s.indexOf('<PasteRows ') < s.indexOf('renderRow={(row) => {'), 'in the controls, above the time sheet’s rows');
  // No other file mounts it.
  assert.doesNotMatch(code(TIME_PAGE), /PasteRows|pasteRows/);
  // /time mounts what it did: the time sheet, then the two journal tables — the leaf is the section's, not the page's.
  const page = code(TIME_PAGE);
  assert.match(page, /data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  // The section's file names neither change: the dated notes are the leaf's and the rules'.
  assert.doesNotMatch(whole(SECTION), /PASTE-01|PASTE-02/);
  assert.match(comments(LEAF), /PasteRows — "\+ paste rows from a sheet" on the time sheet \(PASTE-01, Alex, 2026-11-25\)\./);
});
