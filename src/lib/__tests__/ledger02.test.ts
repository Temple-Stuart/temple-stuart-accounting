/**
 * LEDGER-02 (Alex, 2026-10-19) — THE TASK LEDGER AS A REAL DATA TABLE. "It's
 * really a Task Ledger, not a City Ledger." Sixteen columns in Alex's order,
 * one fact per cell; the row's two new fields (book, varianceCents); the TOTAL
 * row's VARIANCE and UNDER / OVER from the two totals; a BOOK group in the
 * summary; the rename; and "download CSV" — the rows shown, RFC 4180.
 *
 * The rule (src/lib/operations/ledger.ts) is DRIVEN over a fixture built the
 * Budget's own way, as ledger01.test.ts builds its own; the section, the
 * registry, the law and the comments in the reach are anchored to their source
 * with comments stripped (TEST-TRUTH-01). ledger01.test.ts keeps every pin
 * that did not move; the ones that did carry a dated LEDGER-02 note there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { PlanVendorRow, RoutineWords } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import { TOOL_REGISTRY } from '../toolRegistry';
import {
  BOOK_WORDS, CSV_DOWNLOAD_WORDS, CSV_NO_ROWS_WORDS, EVEN_WORDS, GROUP_KEYS, GROUP_WORDS, LEDGER_HEAD_WORDS, LEDGER_TABLE, LEDGER_TITLE_WORDS, MONEY_HEAD_WORDS,
  NO_BOOK_GROUP_WORDS, OVER_WORDS, SUMMARY_HEAD_WORDS, SUMMARY_TITLE_WORDS, UNDER_WORDS,
  accountCellWords, accountNameCellWords, actualCellWords, bookCellWords, bookGroupWords, bookWordOf, dayLongWords, ledgerCsv, ledgerCsvFileName, ledgerOf, ledgerSummary, ledgerTotals,
  matchCellWords, matchCoverageWords, underOverWords, varianceCellWords, varianceCoverageWords, varianceSignWords,
  type LedgerInput, type LedgerRecordInput, type LedgerRow,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';
const EXPENSE_FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const DAY_WRITTEN = 'src/components/workbench/operations/dayWritten.ts';
const TIME_PAGE = 'src/app/time/page.tsx';
const NAV = 'src/lib/nav.ts';
// IDIOM-01 (Alex, 2026-10-24): the shared table the section renders through, and the idiom's CSV rules — the pins on the header, the CSV button and the quoting moved there.
const TABLE = 'src/components/table/DataTable.tsx';
const CSV = 'src/lib/table/csv.ts';

// ── FIXTURES (the Budget's own shapes, as ledger01.test.ts builds them) ─────

const BKK = 'Asia/Bangkok';
const FROM = '2026-10-11';
const TO = '2026-10-13';
const NOW = new Date('2026-10-14T00:00:00.000Z');
/** 07:00 Bangkok on each day — the morning routine's occurrence. */
const MORNING_11 = '2026-10-11T00:00:00.000Z';
const MORNING_12 = '2026-10-12T00:00:00.000Z';
const MORNING_13 = '2026-10-13T00:00:00.000Z';
/** 12:30 Bangkok Oct 13 — the client lunch, the business book's. */
const CLIENT_13 = '2026-10-13T05:30:00.000Z';

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: BKK, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  routine({ id: 'morning', name: 'Morning', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', steps: [
    { id: 'coffee', stepOrder: 1, budgetAmount: 10, coaCode: '5100' },
    { id: 'stretch', stepOrder: 2, budgetAmount: 8, coaCode: '5100' },
    { id: 'lunch', stepOrder: 3, budgetAmount: 15, coaCode: '5200' },
  ] }),
  routine({ id: 'client', name: 'Client lunch', scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', entityId: 'B', entityType: 'sole_prop', budgetAmount: 25, coaCode: '6100' }),
];
const ROLES = new Map([['morning', 'place'], ['client', 'place'], ['yoga', 'place']]);
const WORDS = new Map<string, RoutineWords>([
  ['morning', { name: 'Morning', timezone: BKK, steps: new Map([['coffee', { activity: 'Coffee', timeOfDay: '07:30' }], ['stretch', { activity: 'Stretch', timeOfDay: '06:30' }], ['lunch', { activity: 'Lunch', timeOfDay: '12:00' }]]) }],
  ['client', { name: 'Client lunch', timezone: BKK, steps: new Map() }],
]);
const VENDORS: PlanVendorRow[] = [
  { id: 'pv-every', routine_id: null, step_id: 'coffee', task_id: null, occurrence_at: null, vendor: { id: 'v1', vendor_name: 'Luka Café', entity_id: 'P' }, routine: null, step: { activity: 'Coffee', routine_id: 'morning', routine: { name: 'Morning', timezone: BKK } }, task: null },
];
/** Oct 13 only — Oct 11 and 12 have no stay. */
const STAYS: StayRow[] = [{ id: 'cnx', place: 'Chiang Mai, Thailand 🇹🇭', starts_on: '2026-10-13', ends_on: '2026-10-20' }];
const ACCOUNTS = [{ entityId: 'P', code: '5100', name: 'Meals' }, { entityId: 'B', code: '6100', name: 'Client meals' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }, { id: 'B', entityType: 'sole_prop' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: `${over.occurrence_at.slice(0, 11)}00:41:00.000Z`, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const morningLine = (r: StopRecordRow, activity: string, timeOfDay: string): LedgerRecordInput => ({ record: r, routineId: 'morning', routineName: 'Morning', zone: BKK, role: 'place', activity, timeOfDay });

const RECORDS: LedgerRecordInput[] = [
  // Oct 13, under a stay: the coffee under its budget by $1.02, with a note holding a comma and quotes.
  morningLine(record({ id: 'r-coffee-13', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_13, actual_cents: 898, rating: 4, note: 'khao soi, "the good one"' }), 'Coffee', '07:30'),
  // Oct 13: the stretch skipped (no actual), the lunch done with no amount — a variance needs both figures.
  morningLine(record({ id: 'r-stretch-13', kind: 'routine_line', target_id: 'stretch', occurrence_at: MORNING_13, outcome: 'skipped', done_at: null, note: 'rain' }), 'Stretch', '06:30'),
  morningLine(record({ id: 'r-lunch-13', kind: 'routine_line', target_id: 'lunch', occurrence_at: MORNING_13, rating: 3 }), 'Lunch', '12:00'),
  // Oct 13: the business book's stop, $5 over.
  { record: record({ id: 'r-client-13', kind: 'routine', target_id: 'client', occurrence_at: CLIENT_13, actual_cents: 3000, rating: 5 }), routineId: 'client', routineName: 'Client lunch', zone: BKK, role: 'place', activity: null, timeOfDay: null },
  // Oct 12, no stay: the coffee $2 over; a routine the loader no longer lists — its record stays with no line, no book.
  morningLine(record({ id: 'r-coffee-12', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_12, actual_cents: 1200, rating: 5, note: 'latte' }), 'Coffee', '07:30'),
  { record: record({ id: 'r-yoga-12', kind: 'routine', target_id: 'yoga', occurrence_at: '2026-10-12T10:00:00.000Z', actual_cents: 500, rating: 2 }), routineId: 'yoga', routineName: 'Yoga', zone: BKK, role: 'place', activity: null, timeOfDay: null },
  // Oct 11: the coffee on plan — a variance of exactly 0 is "even", never blank.
  morningLine(record({ id: 'r-coffee-11', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_11, actual_cents: 1000 }), 'Coffee', '07:30'),
];

const built = buildRoutineBudgetLines(ROUTINES, FROM, TO);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: FROM, to: TO, now: NOW, records: RECORDS, links: [], lines: built.lines, notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS, ...over,
});
const ledger = ledgerOf(input());
const rowOf = (id: string): LedgerRow => {
  const row = ledger.rows.find((r) => r.id === id);
  assert.ok(row !== undefined, `row ${id}`);
  return row;
};

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── R1 · THE ROW ────────────────────────────────────────────────────────────

test('R1 the row: book from the matched line’s book (personal → Personal, sole_prop → Business), null with no line; varianceCents = actual − budget only when both are known, else null — never 0', () => {
  assert.deepEqual(ledger.rows.map((r) => r.id), ['r-stretch-13', 'r-coffee-13', 'r-lunch-13', 'r-client-13', 'r-coffee-12', 'r-yoga-12', 'r-coffee-11'], 'newest day first, then the clock');
  const coffee = rowOf('r-coffee-13');
  assert.deepEqual([coffee.book, coffee.coa, coffee.cents, coffee.actualCents, coffee.varianceCents], ['Personal', { account: 'P-5100', name: 'Meals' }, 1000, 898, -102], 'under by $1.02');
  assert.deepEqual(coffee.place, { city: 'Chiang Mai', country: 'Thailand 🇹🇭' });
  const client = rowOf('r-client-13');
  assert.deepEqual([client.book, client.coa, client.cents, client.actualCents, client.varianceCents], ['Business', { account: 'B-6100', name: 'Client meals' }, 2500, 3000, 500], 'the business book, over by $5');
  const over = rowOf('r-coffee-12');
  assert.deepEqual([over.book, over.varianceCents, over.place], ['Personal', 200, null], 'over by $2, on a day no stay covers');
  assert.deepEqual([rowOf('r-coffee-11').varianceCents], [0], 'on plan is 0 — a known difference, not a blank');
  const yoga = rowOf('r-yoga-12');
  assert.deepEqual([yoga.book, yoga.coa, yoga.cents, yoga.actualCents, yoga.varianceCents], [null, null, null, 500, null], 'no line: no book, no budget — the variance is null, never 0 or −$5');
  const stretch = rowOf('r-stretch-13');
  assert.deepEqual([stretch.book, stretch.cents, stretch.outcome, stretch.actualCents, stretch.varianceCents], ['Personal', 800, 'skipped', null, null], 'skipped: a budget but no actual — null');
  const lunch = rowOf('r-lunch-13');
  assert.deepEqual([lunch.cents, lunch.actualCents, lunch.varianceCents], [1500, null, null], 'done without an amount — null');
  // The map is the letter's (accountString.ts ENTITY_LETTER): personal P, sole_prop B, trading T.
  assert.deepEqual(BOOK_WORDS, { personal: 'Personal', sole_prop: 'Business', trading: 'Trading' });
  assert.equal(bookWordOf('trading'), 'Trading');
  assert.throws(() => bookWordOf('corporation'), /entity type "corporation" is not one of personal, sole_prop, trading — no book word for it/, 'any other type stops the build by name — never mapped to a guess');
  assert.throws(() => ledgerOf(input({ books: [{ id: 'P', entityType: 'llc' }, BOOKS[1]] })), /entity type "llc" is not one of personal, sole_prop, trading/, 'through the rule too');
  // In the source: the two fields, each from the row's own figures.
  const rules = code(RULES);
  assert.match(rules, /readonly book: BookWord \| null;/);
  assert.match(rules, /readonly varianceCents: number \| null;/);
  assert.match(rules, /bookWord = bookWordOf\(book\.entityType\);/, 'the word from the same entity type the letter is drawn from');
  assert.match(rules, /varianceCents: cents === null \|\| actualCents === null \? null : actualCents - cents,/, 'arithmetic on the row’s own two figures, only when both are known');
  assert.match(rules, /export function bookWordOf\(entityType: string\): BookWord \{\n\s*const word = \(BOOK_WORDS as Readonly<Record<string, BookWord \| undefined>>\)\[entityType\];\n\s*if \(word === undefined\) throw new Error\(/, 'the throw, by name');
});

// ── R2 · THE COLUMNS AND THE CELLS ──────────────────────────────────────────

test('R2 the sixteen head words in Alex’s order; the cells each one fact: DAY the full weekday, DATE the day, BOOK the word, ACCOUNT the code with its letter, ACCOUNT NAME the chart’s, ACTUAL the amount alone, VARIANCE signed dollars or EMPTY, MATCH empty, UNDER / OVER the word or EMPTY', () => {
  // LEDGER-04 (Alex, 2026-10-20): SUB ACCOUNT NAME where DESCRIPTION stood (the stop's name IS the sub-account's) and DESCRIPTION where NOTES stood (the record's note). Moved, not loosened.
  assert.deepEqual(LEDGER_HEAD_WORDS, ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'STARS', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION']);
  assert.equal(LEDGER_HEAD_WORDS.length, 16);
  assert.equal(new Set(LEDGER_HEAD_WORDS).size, 16, 'no head word twice');
  assert.deepEqual(MONEY_HEAD_WORDS, ['BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH'], 'the money columns, right-aligned');
  assert.equal(dayLongWords('2026-10-13'), 'Tuesday');
  assert.equal(dayLongWords('2026-10-11'), 'Sunday');
  assert.equal(dayLongWords('2026-10-17'), 'Saturday');
  const coffee = rowOf('r-coffee-13');
  assert.equal(bookCellWords(coffee), 'Personal');
  assert.equal(bookCellWords(rowOf('r-yoga-12')), '—', 'no line: the text blank, as the other text cells');
  assert.equal(accountCellWords(coffee), 'P-5100', 'the code with its letter — the ACCOUNT NAME is its own cell');
  assert.equal(accountNameCellWords(coffee), 'Meals');
  assert.equal(accountCellWords(rowOf('r-client-13')), 'B-6100');
  assert.equal(accountNameCellWords(rowOf('r-client-13')), 'Client meals');
  assert.equal(accountCellWords(rowOf('r-yoga-12')), '—');
  assert.equal(accountNameCellWords(rowOf('r-yoga-12')), '—');
  assert.equal(accountNameCellWords(ledgerOf(input({ accounts: [] })).rows.find((r) => r.id === 'r-coffee-13') as LedgerRow), '—', 'a code the chart has no name for: the name cell blank, the code still in its own cell');
  assert.equal(actualCellWords(coffee), '$8.98', 'the amount alone — no delta in the cell');
  assert.equal(actualCellWords(rowOf('r-stretch-13')), 'skipped');
  assert.equal(actualCellWords(rowOf('r-lunch-13')), '—');
  assert.equal(varianceCellWords(-102), '−$1.02', 'dollars with its sign, two decimals (formatCents: U+2212 for the minus)');
  assert.equal(varianceCellWords(200), '+$2.00');
  assert.equal(varianceCellWords(0), '$0.00');
  assert.equal(varianceCellWords(null), '—', 'LEDGER-02 amended: "—" when unknown — one marker on screen, never 0 (the CSV keeps its empty field)');
  assert.deepEqual([UNDER_WORDS, OVER_WORDS, EVEN_WORDS], ['under', 'over', 'even']);
  assert.equal(underOverWords(-102), 'under');
  assert.equal(underOverWords(200), 'over');
  assert.equal(underOverWords(0), 'even');
  assert.equal(underOverWords(null), '—', 'LEDGER-02 amended: "—" with VARIANCE');
  // LEDGER-03 (Alex, 2026-10-19): the MATCH note is gone — the coverage line (matchCoverageWords) replaced it; ledger03.test.ts pins it.
  assert.equal(matchCoverageWords(0, 25), 'MATCH totals none of the 25 rows — no row is linked to the books');
  // The section: sixteen cells in the head's order, each printing its one fact; the money heads right-aligned; the MATCH note first under the table.
  const s = code(SECTION);
  const cells = [...s.matchAll(/data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  // LEDGER-04 (Alex, 2026-10-20): the cells carry the column's name — sub-account-name prints row.description, description prints row.note.
  assert.deepEqual(cells, ['day', 'date', 'city', 'country', 'book', 'account', 'account-name', 'sub-account-name', 'vendor', 'stars', 'budget', 'actual', 'variance', 'match', 'under-over', 'description'], 'one cell per head word, in its order');
  assert.equal(cells.length, LEDGER_HEAD_WORDS.length);
  assert.match(s, /data-ledger-cell="day">\{dayLongWords\(row\.day\)\}/, 'DAY the full weekday');
  assert.match(s, /data-ledger-cell="date">\{row\.day\}/, 'DATE the day alone — the weekday left the cell');
  assert.doesNotMatch(s, /dayShortWords/, 'no short weekday in any cell');
  assert.match(s, /data-ledger-cell="book">\{bookCellWords\(row\)\}/);
  assert.match(s, /data-ledger-cell="account">\{accountCellWords\(row\)\}/);
  assert.match(s, /data-ledger-cell="account-name">\{accountNameCellWords\(row\)\}/);
  assert.doesNotMatch(s, /CELL_WORDS\.coa\(row\)|data-ledger-cell="coa"/, 'the combined COA cell is gone');
  assert.match(s, /data-ledger-cell="actual">\{actualCellWords\(row\)\}/);
  assert.match(s, /className=\{`\$\{money\} \$\{row\.varianceCents === null \? BLANK_CLASS : `font-semibold \$\{actualTone\(delta\.over\)\}`\}`\} data-ledger-cell="variance">\{varianceCellWords\(row\.varianceCents\)\}/, 'VARIANCE in the row’s tone, the blank class when null (amended)');
  // LEDGER-03 (Alex, 2026-10-19): the MATCH cell prints the row's match (matchCellWords) — "—" with no link, as every cell was until then; ledger03.test.ts pins the cell.
  assert.match(s, /data-ledger-cell="match" title=\{matchCellTitle\(row\.match\) \?\? undefined\}>\n\s*<span data-ledger-match>\{matchCellWords\(row\.match\)\}<\/span>/, 'MATCH: the row’s match, "—" with no link (LEDGER-03)');
  assert.equal(matchCellWords(null), '—');
  assert.match(s, /data-ledger-cell="under-over">\{underOverWords\(row\.varianceCents\)\}/);
  // LEDGER-04 (Alex, 2026-10-20): one header per column (LEDGER_COLUMNS, its word by headWordOf), the money heads still right-aligned by the one list; the word is the sort button (ledger04.test.ts).
  // IDIOM-01 (Alex, 2026-10-24): the header is the shared DataTable's — a money head is right-aligned by the column's KIND; the ledger's money kinds are exactly MONEY_HEAD_WORDS' columns, pinned so the one list and the spec cannot drift.
  assert.match(code(TABLE), /<th key=\{c\.key\} className=\{c\.kind === 'money' \? `\$\{headClass\} text-right` : headClass\}>/, 'the money heads right-aligned, by the kind');
  assert.deepEqual(LEDGER_TABLE.filter((c) => c.kind === 'money').map((c) => c.label), [...MONEY_HEAD_WORDS], 'the money kinds are the one list');
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): the coverage line comes first; the MATCH line is second (A2 pins the pair).
  // LEDGER-03 (Alex, 2026-10-19): the MATCH line is its coverage now, in the same place.
  // LEDGER-04 (Alex, 2026-10-20): both lines inside the notes toggle's open state — still adjacent, the coverage line first.
  assert.match(s, /data-ledger-said-variance>[^\n]*<\/p>\}\n\s*\{shown\.length > 0 && <p data-ledger-said-match>\{matchCoverageWords\(totals\.withMatch, shown\.length\)\}<\/p>\}/, 'the MATCH line under the table, after the coverage line');
  assert.match(s, /<h2 className="text-lg font-bold text-brand-purple">\{LEDGER_TITLE_WORDS\}<\/h2>/);
});

// ── R3 · THE TOTAL ROW ──────────────────────────────────────────────────────

test('R3 the TOTAL row: colSpan the columns before BUDGET; VARIANCE the two totals’ difference only when both are known; UNDER / OVER its sign; MATCH blank; nothing summed from a blank', () => {
  const t = ledgerTotals(ledger.rows);
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): the column's sum — not the two totals' difference (which would be 6598 − 7800 = −1202).
  assert.deepEqual([t.budgetCents, t.actualCents, t.varianceCents, t.withVariance], [7800, 6598, 598, 4], '$10 + $8 + $15 + $25 + $10 + $10 budgets; $8.98 + $30 + $12 + $5 + $10 actuals; −$1.02 + $5 + $2 + $0 over the 4 rows that carry both');
  assert.equal(underOverWords(t.varianceCents), 'over');
  assert.equal(varianceCellWords(t.varianceCents), '+$5.98');
  assert.equal(ledgerTotals([rowOf('r-yoga-12')]).varianceCents, null, 'an actual with no budget: null — the $5 is not a variance');
  assert.equal(ledgerTotals([rowOf('r-lunch-13')]).varianceCents, null, 'a budget with no actual: null');
  assert.equal(ledgerTotals([]).varianceCents, null);
  assert.equal(ledgerTotals([rowOf('r-coffee-11')]).varianceCents, 0, 'on plan: 0, "even"');
  // A shown set with one row lacking a budget: the VARIANCE total is the sum of the other rows' variances, NOT ACTUAL total − BUDGET total (amended).
  const mixed = ledgerTotals([rowOf('r-coffee-13'), rowOf('r-yoga-12')]);
  assert.deepEqual([mixed.budgetCents, mixed.actualCents, mixed.varianceCents, mixed.withVariance], [1000, 1398, -102, 1], 'the yoga’s $5 is in the ACTUAL total but not in the VARIANCE total — its row has no variance (1398 − 1000 = 398 is NOT the answer)');
  const s = code(SECTION);
  assert.match(s, /<th scope="row" colSpan=\{10\} className=\{`\$\{cell\} text-left`\}>\{TOTAL_WORDS\}<\/th>/);
  assert.equal(LEDGER_HEAD_WORDS.indexOf('BUDGET'), 10, 'the colSpan is the columns before BUDGET');
  inOrder(s, ['data-ledger-total>', 'data-ledger-total-budget>{budgetCellWords(totals.budgetCents)}', 'data-ledger-total-actual>{budgetCellWords(totals.actualCents)}</td>', "data-ledger-total-variance>{varianceCellWords(totals.varianceCents)}", 'data-ledger-total-match>{matchTotalWords(totals.matchCents)}</td>', 'data-ledger-total-under-over>{underOverWords(totals.varianceCents)}', '<td className={cell} data-ledger-total-description />'], 'the TOTAL row’s cells, under their columns'); // LEDGER-04: the last cell is DESCRIPTION's
  assert.match(s, /const varianceTone = \(cents: number \| null\): string => \(cents === null \? BLANK_CLASS : actualTone\(cents > 0\)\);/, 'the sign’s tone (amended)');
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.equal((tfoot.match(/<td\b/g) ?? []).length, 6, 'BUDGET · ACTUAL · VARIANCE · MATCH · UNDER / OVER · NOTES — six cells after the span of ten');
  assert.doesNotMatch(tfoot, /totals\.words|totals\.over/, 'no delta words and no recorded-rows tone in the TOTAL row (amended: one truth per row)');
});

// ── R4 · THE SUMMARY ────────────────────────────────────────────────────────

test('R4 the summary: a seventh group, BOOK, after COA; rows with no book under "no account"; the title says by book; the math unchanged', () => {
  assert.deepEqual(GROUP_KEYS, ['day', 'week', 'month', 'city', 'country', 'coa', 'book']);
  assert.equal(GROUP_WORDS.book, 'Book');
  assert.equal(SUMMARY_TITLE_WORDS, 'over time, by place and by book');
  assert.equal(NO_BOOK_GROUP_WORDS, 'no account');
  assert.equal(bookGroupWords(rowOf('r-yoga-12')), 'no account');
  assert.equal(bookGroupWords(rowOf('r-client-13')), 'Business');
  const byBook = ledgerSummary(ledger.rows, 'book');
  assert.deepEqual(byBook.map((g) => [g.key, g.label, g.days]), [['Business', 'Business', 1], ['no account', 'no account', 1], ['Personal', 'Personal', 3]], 'the words’ order (localeCompare, as the place and COA groups)');
  const personal = byBook[2];
  assert.deepEqual([personal.totals.budgetCents, personal.totals.actualCents, personal.totals.varianceCents, personal.totals.withVariance, personal.perDayCents], [5300, 3098, 98, 3, 1033], 'the same rule as every group (ledgerTotals): −$1.02 + $2 + $0 over the three Personal rows that carry both');
  assert.deepEqual([byBook[0].totals.budgetCents, byBook[0].totals.actualCents, byBook[0].totals.words], [2500, 3000, '▲ $5 over']);
  assert.deepEqual([byBook[1].totals.budgetCents, byBook[1].totals.actualCents, byBook[1].totals.varianceCents], [null, 500, null], 'no book, no budget — nothing summed from a blank');
  assert.deepEqual(SUMMARY_HEAD_WORDS, ['DAYS', 'BUDGET', 'ACTUAL', 'UNDER / OVER', 'ACTUAL PER RECORDED DAY', 'STARS'], 'the summary’s columns unchanged');
  const rules = code(RULES);
  assert.match(rules, /by === 'book' \? bookGroupWords\(row\) : CELL_WORDS\[by\]\(row\)/, 'the group key');
  const s = code(SECTION);
  assert.match(s, /\{GROUP_KEYS\.map\(\(g\) => \(/, 'the chips from the one list');
  assert.match(s, /data-ledger-group-words>\{g\.totals\.words\}/, 'each group still prints its delta words');
});

// ── R5 · THE RENAME ─────────────────────────────────────────────────────────

test('R5 the rename: "Task ledger"; the Time row’s why and customer say "the task ledger"; the two-lists law’s messages say so; every comment in the reach carries a dated LEDGER-02 note, the history lines their words', () => {
  assert.equal(LEDGER_TITLE_WORDS, 'Task ledger');
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  // LEDGER-02 AMENDMENT (Alex, 2026-10-19): "the task ledger of every stop … by city, account and book" — "every stop" kept, the book added.
  assert.equal(time.why, 'the day, narrated: every stop in clock order with its budget, its vendor, what it cost and the verdict, the journal, the caption and script for the reel, and the task ledger of every stop by city, account and book; nothing yet adds up where the hours went');
  assert.equal(time.customer, 'You can see one day as a card — every stop with what it should cost and what it did, the journal, the caption and script for the day\'s reel — and the task ledger of every stop you logged by city, account and book; nothing yet adds up where your hours went.');
  assert.doesNotMatch(`${time.why} ${time.customer}`, /the ledger of every stop|city ledger/i);
  assert.match(comments(REGISTRY), /LEDGER-02 \(Alex, 2026-10-19\): THE CITY LEDGER IS THE TASK LEDGER/);
  const law = code(LAW);
  // JOURNAL-07 (Alex, 2026-10-24): the messages name the two journal tables too — the container is four; LEDGER-02's words stay inside them.
  assert.match(law, /the page is the day card, the task ledger and the two journal tables \(TIME-01; TIME-02; LEDGER-02 renamed it; JOURNAL-07 added the tables\)/);
  assert.match(law, /exactly the day card, the task ledger and the two journal tables, nothing beneath \(TIME-01; TIME-02 retired the content pipeline; LEDGER-02 renamed it; JOURNAL-07 added the tables\)/);
  assert.doesNotMatch(law, /city ledger/, 'no message of the law names the old name (the comments keep the history)');
  assert.match(comments(LAW), /LEDGER-02 \(Alex, 2026-10-19\): the city ledger is the TASK LEDGER — renamed; the mount is the same component/);
  assert.match(comments(LAW), /LEDGER-01 — the ruling \(Alex, 2026-10-16\): the city ledger is a fourth section, under Routines/, 'the history line keeps its words');
  assert.match(law, /const TIME_MOUNTS = \['<DayCard \/>', '<LedgerSection \/>', '<MorningJournalTable \/>', '<EveningJournalTable \/>'\];/, 'the mount unchanged; JOURNAL-07 (2026-10-24) added the two journal tables after it');
  for (const [file, note] of [
    [RULES, /LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger/],
    [SECTION, /LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger/],
    [READS, /the task ledger's one read \(LEDGER-01, Alex, 2026-10-16: the city ledger; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger\)/],
    [EXPENSE_FORM, /"\+ expense" on the task ledger \(RETRO-01, Alex, 2026-10-16: the city ledger; LEDGER-02, Alex, 2026-10-19: renamed — it is a task ledger\)/],
    [DAY_WRITTEN, /"\+ expense" on the task ledger \(the city ledger until LEDGER-02, Alex,\s*\n\s*\* 2026-10-19, renamed it\)/],
    [TIME_PAGE, /then the task ledger\s*\n\s*\* \(ledger\/LedgerSection\.tsx — the record of the day's stops, LEDGER-01; the\s*\n\s*\* city ledger until LEDGER-02, Alex, 2026-10-19, renamed it\)/],
    [NAV, /\/time is the day card\s*\n\s*\/\/ and the task ledger \(the city ledger until LEDGER-02, 2026-10-19, renamed it\), and draws no strip/],
    [NAV, /\/time is the day card and the task ledger \(the city ledger\s*\n\s*\/\/ until LEDGER-02, 2026-10-19, renamed it\) and draws no strip/],
  ] as const) {
    assert.match(comments(file), note, `${file} carries the dated note`);
  }
  // The section prints the rules file's title — no sentence of its own.
  assert.doesNotMatch(code(SECTION), /City ledger|Task ledger/, 'the title is LEDGER_TITLE_WORDS, not typed in the section');
});

// ── R6 · THE CSV ────────────────────────────────────────────────────────────

test('R6 ledgerCsv: the sixteen head words, one line per row in table order, RFC 4180 minimal quoting with doubled quotes, money as dollars with two decimals, null an EMPTY field, stars a number, dates YYYY-MM-DD, CRLF on every line, no BOM', () => {
  const csv = ledgerCsv(ledger.rows);
  const lines = csv.split('\r\n');
  assert.equal(lines[lines.length - 1], '', 'the last line ends CRLF too');
  lines.pop();
  assert.equal(lines.length, ledger.rows.length + 1, 'the header and one line per row');
  // LEDGER-04 (Alex, 2026-10-20): the header follows the heads — SUB ACCOUNT NAME and DESCRIPTION; the fields under them are as they were (row.description, row.note).
  assert.equal(lines[0], 'DAY,DATE,CITY,COUNTRY,BOOK,ACCOUNT,ACCOUNT NAME,SUB ACCOUNT NAME,VENDOR,STARS,BUDGET,ACTUAL,VARIANCE,MATCH,UNDER / OVER,DESCRIPTION');
  assert.equal(lines[0], LEDGER_HEAD_WORDS.join(','), 'the head words, none needing quotes');
  assert.deepEqual(lines.slice(1), [
    'Tuesday,2026-10-13,Chiang Mai,Thailand 🇹🇭,Personal,P-5100,Meals,Stretch,,,8.00,,,,,rain',
    'Tuesday,2026-10-13,Chiang Mai,Thailand 🇹🇭,Personal,P-5100,Meals,Coffee,Luka Café,4,10.00,8.98,-1.02,,under,"khao soi, ""the good one"""',
    'Tuesday,2026-10-13,Chiang Mai,Thailand 🇹🇭,Personal,P-5200,,Lunch,,3,15.00,,,,,',
    'Tuesday,2026-10-13,Chiang Mai,Thailand 🇹🇭,Business,B-6100,Client meals,Client lunch,,5,25.00,30.00,5.00,,over,',
    'Monday,2026-10-12,,,Personal,P-5100,Meals,Coffee,Luka Café,5,10.00,12.00,2.00,,over,latte',
    'Monday,2026-10-12,,,,,,Yoga,,2,,5.00,,,,',
    'Sunday,2026-10-11,,,Personal,P-5100,Meals,Coffee,Luka Café,,10.00,10.00,0.00,,even,',
  ], 'each field the table’s fact: the weekday, the day, the place (empty with no stay), the book, the code and the name, the stars as a number, the money, MATCH empty, the sign, the note');
  assert.doesNotMatch(csv, /(^|[^\r])\n/, 'no bare LF');
  assert.doesNotMatch(csv, /—/, 'no "—" in the file — a null is an empty field');
  assert.doesNotMatch(csv, /−/, 'an ASCII minus in money');
  assert.notEqual(csv.charCodeAt(0), 0xfeff, 'no BOM');
  assert.ok(csv.startsWith('DAY,'));
  // The comma and the quotes in a NOTES value survive: the field is quoted, its quotes doubled — read back, it is the note.
  const quoted = lines[2].slice(lines[2].indexOf('"khao'));
  assert.equal(quoted, '"khao soi, ""the good one"""');
  assert.equal(quoted.slice(1, -1).replace(/""/g, '"'), 'khao soi, "the good one"');
  // A CR or an LF in a field is quoted too; a bare field is written bare.
  const cr = ledgerCsv([{ ...rowOf('r-coffee-11'), note: 'line one\r\nline two', description: 'plain' }]).split('\r\n');
  assert.equal(cr[1], 'Sunday,2026-10-11,,,Personal,P-5100,Meals,plain,Luka Café,,10.00,10.00,0.00,,even,"line one');
  assert.equal(cr[2], 'line two"');
  assert.equal(ledgerCsv([]), `${LEDGER_HEAD_WORDS.join(',')}\r\n`, 'no rows: the header alone');
  assert.equal(ledgerCsvFileName('2026-10-01', '2026-10-31'), 'task-ledger_2026-10-01_2026-10-31.csv');
  assert.equal(CSV_DOWNLOAD_WORDS, 'download CSV');
  assert.equal(CSV_NO_ROWS_WORDS, 'no row shown — nothing to download');
  // Pure: the CSV block of the rules file knows no React, no DOM, no Blob.
  const rules = code(RULES);
  const block = rules.slice(rules.indexOf('export const dayLongWords'), rules.indexOf('export const EXPENSE_FIELDS'));
  assert.doesNotMatch(block, /document\.|window\.|Blob|createObjectURL|from 'react'/, 'pure');
  // IDIOM-01 (Alex, 2026-10-24): the quoting and the CRLF lines are src/lib/table/csv.ts's (csvField, csvText) — the same text, moved; pure there too.
  const csvRules = code(CSV);
  assert.doesNotMatch(csvRules, /document\.|window\.|Blob|createObjectURL|from 'react'/, 'pure');
  assert.match(csvRules, /export const csvField = \(text: string\): string => \(\/\[",\\r\\n\]\/\.test\(text\) \? `"\$\{text\.replace\(\/"\/g, '""'\)\}"` : text\);/, 'minimal quoting: a comma, a quote, a CR or an LF');
  assert.match(csvRules, /return `\$\{lines\.join\('\\r\\n'\)\}\\r\\n`;/, 'CRLF, the last line too');
  // The section: one button beside the period controls, the rows SHOWN, a Blob and an object URL, the file named by the period, the URL revoked; disabled with the reason when no row is shown.
  const s = code(SECTION);
  // LEDGER-04 (Alex, 2026-10-20): "clear filters" sits beside the CSV button (shown while a filter is on); the three dropdowns that followed are gone.
  // IDIOM-01 (Alex, 2026-10-24): the controls row is the shared DataTable's — the section hands it its period controls (controls), its no-first lines
  // (trailing) and the file's name (csv); the button, "clear filters" and the reason follow the controls there, in the order they always had.
  const t = code(TABLE);
  inOrder(s, ['controls={(', 'data-ledger-period-words>{periodWords(period)}</span>}', 'trailing={('], 'the period words end the controls the section hands over; the no-first lines follow the CSV');
  inOrder(t, ['{controls}', '<button type="button" className={chipClass} disabled={csv === null} title={csv === null ? CSV_NO_ROWS_WORDS : undefined} onClick={() => csv !== null && downloadCsv(csv.name)} {...dataAttr(name, \'csv\')}>{CSV_DOWNLOAD_WORDS}</button>', '{anyFilterOn(columns, filters) && <button type="button" className={chipClass} onClick={() => onFilters(noFilters)} {...dataAttr(name, \'clear-filters\')}>{CLEAR_FILTERS_WORDS}</button>}', "{loaded && shown.length === 0 && <span className=\"text-text-faint\" {...dataAttr(name, 'csv-why')}>{CSV_NO_ROWS_WORDS}</span>}", '{trailing}'], 'the button after the caller’s controls, then clear filters, then the reason');
  assert.match(s, /const csvPeriod: Period \| null = answer !== null && answer\.read\.ok && shown\.length > 0 \? answer\.period : null;/, 'nothing to download until a row is shown');
  assert.match(s, /const csv = csvPeriod === null \? null : \{ name: ledgerCsvFileName\(csvPeriod\.from, csvPeriod\.to\) \};/, 'the file named by the period read');
  assert.match(t, /const downloadCsv = \(fileName: string\): void => \{\n\s*const url = URL\.createObjectURL\(new Blob\(\[tableCsv\(columns, shown\)\], \{ type: 'text\/csv;charset=utf-8;' \}\)\);\n\s*const a = document\.createElement\('a'\);\n\s*a\.href = url;\n\s*a\.download = fileName;\n\s*a\.click\(\);\n\s*URL\.revokeObjectURL\(url\);\n\s*\};/, 'the rows shown, the GeneralLedger shape, the URL revoked');
  assert.equal((t.match(/dataAttr\(name, 'csv'\)/g) ?? []).length, 1, 'one button');
  assert.equal((s.match(/csv=\{csv\}/g) ?? []).length, 1, 'one name handed over');
  assert.match(code('src/components/dashboard/GeneralLedger.tsx'), /const blob = new Blob\(\[csv\], \{ type: 'text\/csv;charset=utf-8;' \}\);\n\s*const url = URL\.createObjectURL\(blob\);/, 'the precedent');
});

// ── R7 · NOTHING ELSE ───────────────────────────────────────────────────────

test('R7 nothing else: the route still answers ledgerOf’s rows whole; the said block, the filters and the period controls are as LEDGER-01 left them; the section fetches nothing itself', () => {
  const route = code('src/app/api/operations/ledger/route.ts');
  assert.match(route, /ledgerOf\(/, 'the route answers the rule’s rows — the two fields ride the payload without a route change');
  assert.doesNotMatch(route, /varianceCents|bookWordOf|BOOK_WORDS/, 'no route code for the two fields');
  const s = code(SECTION);
  // LEDGER-04 (Alex, 2026-10-20): the same lines, in the same order, inside the notes toggle; the rows shown are filtered by every column then sorted.
  inOrder(s, ['data-ledger-notes-toggle', 'data-ledger-said-match', 'data-ledger-said-no-line', 'data-ledger-said-no-stay', 'data-ledger-said-unplaced', 'data-ledger-said-not-recorded', 'data-ledger-said-left-out', 'data-ledger-said-not-placed', 'data-ledger-said-today-rule', 'data-ledger-said-every-book'], 'what is said, in order, the MATCH note first');
  assert.match(s, /const shown = sortRows\(applyColumnFilters\(rows, filters\), sort\);\n\s*const totals = ledgerTotals\(shown\);\n\s*const groups = ledgerSummary\(shown, by\);/);
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie/, 'no fetch of its own, nothing stored');
  assert.match(s, /<ExpenseForm onWritten=/, 'the "+ expense" form stands');
});

// ── THE AMENDMENT (Alex, 2026-10-19): one marker, one truth, "every stop" ───

test('A1 one marker: on screen every null cell prints "—" — VARIANCE, MATCH and UNDER / OVER as BOOK, ACCOUNT, ACCOUNT NAME, BUDGET and ACTUAL; the CSV keeps an empty field for each, through its own path', () => {
  const yoga = rowOf('r-yoga-12');
  assert.deepEqual([bookCellWords(yoga), accountCellWords(yoga), accountNameCellWords(yoga), varianceCellWords(yoga.varianceCents), matchCellWords(yoga.match), underOverWords(yoga.varianceCents)], ['—', '—', '—', '—', '—', '—'], 'the one marker, six cells of a row with no line (LEDGER-03: the MATCH cell through matchCellWords, no link)');
  assert.equal(varianceCellWords(null), '—');
  assert.equal(underOverWords(null), '—');
  assert.equal(matchCellWords(null), '—'); // LEDGER-03: no link is "—"
  // The CSV of the same row: empty fields where the screen prints "—".
  const line = ledgerCsv([yoga]).split('\r\n')[1];
  assert.equal(line, 'Monday,2026-10-12,,,,,,Yoga,,2,,5.00,,,,', 'BOOK · ACCOUNT · ACCOUNT NAME · BUDGET · VARIANCE · MATCH · UNDER / OVER each an empty field');
  assert.doesNotMatch(ledgerCsv(ledger.rows), /—/, 'no "—" anywhere in the file');
  // The sign rule is one function the screen and the CSV both call; the CSV calls it directly, never a screen helper.
  assert.deepEqual([varianceSignWords(-1), varianceSignWords(1), varianceSignWords(0)], ['under', 'over', 'even']);
  const rules = code(RULES);
  assert.match(rules, /export const underOverWords = \(varianceCents: number \| null\): string => \(varianceCents === null \? BLANK : varianceSignWords\(varianceCents\)\);/);
  assert.match(rules, /export const varianceCellWords = \(cents: number \| null\): string => \(cents === null \? BLANK : /);
  assert.match(rules, /export const matchCellWords = \(match: LedgerMatch \| null\): string => planDollars\(readableMatchCents\(match\)\);/, 'LEDGER-03: the MATCH cell through the one dollars rule — null is "—"');
  // IDIOM-01 (Alex, 2026-10-24): the CSV's fields are LEDGER_CSV — one reader per column, the same sixteen expressions ledgerCsv listed; ledgerCsv is the idiom's tableCsv over the spec. The block pinned is LEDGER_CSV.
  const block = rules.slice(rules.indexOf('export const LEDGER_CSV'), rules.indexOf('export const LEDGER_TABLE'));
  assert.match(block, /row\.varianceCents === null \? '' : varianceSignWords\(row\.varianceCents\),/, 'the CSV’s own null path for the sign');
  assert.doesNotMatch(block, /underOverWords|varianceCellWords|bookCellWords|accountCellWords|accountNameCellWords|budgetCellWords|actualCellWords|BLANK/, 'the CSV never calls a screen helper');
  // The section: the blank class on each of the three when null; the MATCH cell prints the one marker in every row and in the TOTAL row.
  const s = code(SECTION);
  assert.match(s, /row\.varianceCents === null \? BLANK_CLASS : `font-semibold \$\{actualTone\(delta\.over\)\}`\}`\} data-ledger-cell="variance"/);
  assert.match(s, /row\.varianceCents === null \? BLANK_CLASS : actualTone\(delta\.over\)\}`\} data-ledger-cell="under-over"/);
  // LEDGER-03 (Alex, 2026-10-19): the MATCH cell and the MATCH total print their match through matchCellWords / matchTotalWords — "—" when nothing is linked.
  assert.equal((s.match(/\{matchCellWords\(row\.match\)\}/g) ?? []).length, 1, 'the MATCH cell');
  assert.equal((s.match(/\{matchTotalWords\(totals\.matchCents\)\}/g) ?? []).length, 1, 'the MATCH total');
  assert.doesNotMatch(s, /data-ledger-cell="match" \/>|data-ledger-total-match \/>/, 'no empty MATCH cell');
});

test('A2 one truth: the VARIANCE total is the column’s sum over the rows that carry both; the TOTAL row’s ACTUAL tone and UNDER / OVER follow its sign; over and words stay for the summary; the coverage is said under the table', () => {
  const t = ledgerTotals(ledger.rows);
  assert.deepEqual([t.varianceCents, t.withVariance], [598, 4], 'Σ over the 4 of 7 rows: −102 + 500 + 200 + 0');
  assert.equal(t.varianceCents, ledger.rows.map((r) => r.varianceCents).filter((v): v is number => v !== null).reduce((sum, v) => sum + v, 0), 'the column’s sum, exactly');
  assert.notEqual(t.varianceCents, (t.actualCents as number) - (t.budgetCents as number), 'NOT the two totals’ difference (−1202)');
  assert.deepEqual([t.over, t.words], [true, '▲ $10.98 over'], 'the recorded-rows comparison stays as fields: $65.98 against the $55 budgeted on the rows that carry an actual (the yoga row has none) — a different figure from the column’s sum, which is why the TOTAL row prints only the one');
  // One row lacking a budget: the sum of the others, not ACTUAL − BUDGET; the recorded-rows words can disagree with the sign and the TOTAL row no longer prints them.
  const mixed = ledgerTotals([rowOf('r-coffee-13'), rowOf('r-yoga-12')]);
  assert.deepEqual([mixed.varianceCents, mixed.withVariance, mixed.over, mixed.words], [-102, 1, true, '▲ $3.98 over'], 'the VARIANCE total says under (−$1.02) while the recorded-rows words say over — the row prints the one truth');
  assert.equal(underOverWords(mixed.varianceCents), 'under');
  const none = ledgerTotals([rowOf('r-yoga-12'), rowOf('r-lunch-13')]);
  assert.deepEqual([none.budgetCents, none.actualCents, none.varianceCents, none.withVariance], [1500, 500, null, 0], 'a budget total and an actual total, but no row carries both: the VARIANCE total is null — "—", never 500 − 1500');
  assert.equal(varianceCellWords(none.varianceCents), '—');
  assert.equal(underOverWords(none.varianceCents), '—');
  // The coverage words.
  assert.equal(varianceCoverageWords(4, 7), 'VARIANCE totals the 4 of 7 rows that carry both a budget and an actual');
  assert.equal(varianceCoverageWords(7, 7), 'VARIANCE totals all 7 rows');
  assert.equal(varianceCoverageWords(1, 1), 'VARIANCE totals all 1 row');
  assert.equal(varianceCoverageWords(0, 2), 'VARIANCE totals none of the 2 rows — no row carries both a budget and an actual');
  assert.equal(varianceCoverageWords(0, 1), 'VARIANCE totals none of the 1 row — no row carries both a budget and an actual');
  assert.throws(() => varianceCoverageWords(3, 2), /3 of 2 rows is no coverage/);
  assert.throws(() => varianceCoverageWords(-1, 2), /is no coverage/);
  // The section: the ACTUAL total toned by the variance's sign (not totals.over), the VARIANCE and UNDER / OVER totals by the same; the coverage line first under the table, only while rows are shown.
  const s = code(SECTION);
  assert.match(s, /data-ledger-total-actual>\{budgetCellWords\(totals\.actualCents\)\}<\/td>/);
  assert.match(s, /className=\{`\$\{money\} \$\{totals\.actualCents === null \? BLANK_CLASS : totals\.varianceCents === null \? '' : varianceTone\(totals\.varianceCents\)\}`\} data-ledger-total-actual/, 'the ACTUAL total’s tone is the variance’s sign; no tone while the variance is unknown');
  assert.match(s, /className=\{`\$\{money\} \$\{varianceTone\(totals\.varianceCents\)\}`\} data-ledger-total-variance>\{varianceCellWords\(totals\.varianceCents\)\}/);
  assert.match(s, /className=\{`\$\{cell\} whitespace-nowrap \$\{varianceTone\(totals\.varianceCents\)\}`\} data-ledger-total-under-over>\{underOverWords\(totals\.varianceCents\)\}/);
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.doesNotMatch(tfoot, /totals\.over|totals\.words|delta\b/, 'nothing in the TOTAL row from the recorded-rows comparison');
  assert.match(s, /data-ledger-group-actual>\{budgetCellWords\(g\.totals\.actualCents\)\}/);
  assert.match(s, /actualTone\(g\.totals\.over\)\}`\} data-ledger-group-words>\{g\.totals\.words\}/, 'the summary keeps printing its words, in their tone');
  assert.match(s, /data-ledger-said>\n\s*\{shown\.length > 0 && <p data-ledger-said-variance>\{varianceCoverageWords\(totals\.withVariance, shown\.length\)\}<\/p>\}\n\s*\{shown\.length > 0 && <p data-ledger-said-match>/, 'the coverage line, before the MATCH line (LEDGER-03: the MATCH line is its own coverage)');
});

test('A3 the registry words keep "every stop": the why and the customer line say "the task ledger of every stop … by city, account and book", the rest unchanged', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time')!;
  assert.equal(time.why, 'the day, narrated: every stop in clock order with its budget, its vendor, what it cost and the verdict, the journal, the caption and script for the reel, and the task ledger of every stop by city, account and book; nothing yet adds up where the hours went');
  assert.equal(time.customer, 'You can see one day as a card — every stop with what it should cost and what it did, the journal, the caption and script for the day\'s reel — and the task ledger of every stop you logged by city, account and book; nothing yet adds up where your hours went.');
  assert.match(comments(REGISTRY), /the amendment\s*\n\s*\/\/ kept "every stop" and added the book/);
});
