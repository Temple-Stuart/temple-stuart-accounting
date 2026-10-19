/**
 * LEDGER-04 (Alex, 2026-10-20) — THE TASK LEDGER AFTER ALEX'S FIRST READ: SUB
 * ACCOUNT NAME and DESCRIPTION, Excel-style filters and sort on every column,
 * the declarations folded into one closed "notes" toggle.
 *
 * "The ledger's rows are right; three things about the table are not. (1) The
 * stop's name IS the sub-account name — Brunch and Dinner under 6150 Dining Out
 * — so the column says so; what was NOTES is the description of the row. (2)
 * Filtering should work like a sheet: every column filterable, several at
 * once, and sortable — not three dropdowns. (3) The sentences under the table
 * read as noise next to the data; they fold into one closed toggle."
 *
 * The rules (src/lib/operations/ledger.ts) are DRIVEN over rows built in the
 * ledger's own shape: applyColumnFilters (OR within a column, AND across,
 * "(blank)" in and out, money bounds inclusive, contains-text), columnValues
 * (value · count, in the column's sort order), sortRows (every column's order,
 * blanks last both ways, the third click), boundCentsOf, nextSort and
 * notesCount. The section, the popover leaf, the expense form and the stop
 * form are anchored to their source with comments stripped (TEST-TRUTH-01).
 * The pins that moved in ledger01 and ledger02 carry dated notes there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  ALL_WORDS, BLANK_CHOICE_WORDS, CLEAR_FILTERS_WORDS, CLOSE_FILTER_WORDS, CONTAINS_WORDS, EXPENSE_FIELD_WORDS, FILTER_ON_MARK, FILTER_OPEN_WORDS, GROUP_WORDS, LEDGER_COLUMNS, LEDGER_HEAD_WORDS,
  MAX_WORDS, MIN_WORDS, MONEY_COLUMNS, NARROW_FROM, NARROW_WORDS, NONE_WORDS, NOTES_CLOSED_MARK, NOTES_OPEN_MARK, NO_COLUMN_FILTERS, NO_MONEY_FILTER, NO_TEXT_FILTER, NO_VALUE_FILTER, SORT_MARKS,
  TEXT_COLUMNS, VALUE_COLUMNS,
  anyColumnFilterOn, applyColumnFilters, boundCentsOf, boundDollarsOf, boundTypedWords, cellCentsOf, cellWordsOf, choiceWords, columnFilterOn, columnKind, columnValues, containsNeedle,
  filterLabelWords, headWordOf, ledgerCsv, leftOutTotal, nextSort, notesCount, notesToggleWords, requiredWords, rowPassesFilters, sortKeyOf, sortLabelWords, sortRows, weekdayNumber,
  type ColumnFilters, type LedgerColumn, type LedgerRow, type LedgerSaid, type LedgerSort,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const LEAF = 'src/components/workbench/operations/ledger/ColumnFilter.tsx';
const EXPENSE_FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const REGISTRY = 'src/lib/toolRegistry.ts';

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

// ── THE FIXTURE: five rows in the ledger's own shape and order (newest day first) ──

const row = (over: Partial<LedgerRow> & { readonly id: string }): LedgerRow => ({
  key: `routine:${over.id}:2026-10-13T00:30:00.000Z`, address: { kind: 'routine', id: over.id, instant: '2026-10-13T00:30:00.000Z' }, match: null, day: '2026-10-13', time: '07:30',
  place: { city: 'Chiang Mai', country: 'Thailand 🇹🇭' }, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, description: 'Brunch', rating: null, note: null,
  cents: null, budgetState: 'none', outcome: 'done', actualCents: null, varianceCents: null, ...over,
});
/** Saturday: the gym, skipped — a budget, no actual, no variance. */
const GYM = row({ id: 'e', day: '2026-10-17', coa: { account: 'P-5300', name: 'Fitness' }, vendor: 'Fitness First', description: 'Gym', rating: 3, note: 'leg day', outcome: 'skipped', cents: 1500, budgetState: 'matched' });
/** Tuesday: brunch at Luka Café, under, linked and readable. */
const BRUNCH = row({ id: 'a', vendor: 'Luka Café', description: 'Brunch', rating: 4, note: 'khao soi, worth it', cents: 2500, actualCents: 2200, varianceCents: -300, budgetState: 'matched', match: { cents: 2200, postings: 1, unreadable: 0 } });
/** Tuesday: dinner, over, no vendor, no link. */
const DINNER = row({ id: 'b', description: 'Dinner', rating: 5, note: 'Pad thai', cents: 3000, actualCents: 3500, varianceCents: 500, budgetState: 'matched' });
/** Monday: yoga on a day no stay covers — no place, no book, no COA, no budget, no note. */
const YOGA = row({ id: 'c', day: '2026-10-12', place: null, book: null, coa: null, description: 'Yoga', rating: 2, actualCents: 500 });
/** Sunday: a client lunch in Bangkok on the business book, even, linked but unreadable, no stars. */
const CLIENT = row({ id: 'd', day: '2026-10-11', place: { city: 'Bangkok', country: 'Thailand 🇹🇭' }, book: 'Business', coa: { account: 'B-6100', name: 'Client meals' }, vendor: 'Som Tam Nua', description: 'Client lunch', note: 'with Pim', cents: 2500, actualCents: 2500, varianceCents: 0, budgetState: 'matched', match: { cents: null, postings: 1, unreadable: 1 } });
const ROWS: readonly LedgerRow[] = [GYM, BRUNCH, DINNER, YOGA, CLIENT];
const ids = (rows: readonly LedgerRow[]): string[] => rows.map((r) => r.id);
const withFilter = (over: Partial<ColumnFilters>): ColumnFilters => ({ ...NO_COLUMN_FILTERS, ...over });
const record = (id: string): StopRecordRow => ({ id, kind: 'routine', target_id: 'gym', occurrence_at: '2026-10-12T05:00:00.000Z', outcome: 'done', done_at: '2026-10-12T05:00:00.000Z', actual_cents: 100, rating: null, note: null, actual_minutes: null });
const NOTHING_SAID: LedgerSaid = { noLine: 0, doubled: 0, noStay: 0, unplaced: [], notRecorded: 0, notPlaced: 0, leftOut: { journal: 0, plan: 0, execute: 0, all_day: 0 } };

// ── R1 · THE RENAMES ────────────────────────────────────────────────────────

test('R1 the heads: SUB ACCOUNT NAME where DESCRIPTION stood, DESCRIPTION where NOTES stood; the CSV header follows; the fields keep their names and say which column each prints to; the expense form and the stop form say the same; the summary’s groups and the registry untouched', () => {
  assert.deepEqual(LEDGER_HEAD_WORDS, ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'STARS', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION']);
  assert.equal(ledgerCsv([]).split('\r\n')[0], 'DAY,DATE,CITY,COUNTRY,BOOK,ACCOUNT,ACCOUNT NAME,SUB ACCOUNT NAME,VENDOR,STARS,BUDGET,ACTUAL,VARIANCE,MATCH,UNDER / OVER,DESCRIPTION');
  // The row's fields keep their names; the CSV line is as LEDGER-02 wrote it — description eighth, note sixteenth.
  const line = ledgerCsv([BRUNCH]).split('\r\n')[1];
  assert.equal(line, 'Tuesday,2026-10-13,Chiang Mai,Thailand 🇹🇭,Personal,P-6150,Dining Out,Brunch,Luka Café,4,25.00,22.00,-3.00,22.00,under,"khao soi, worth it"', 'the stop’s name eighth, the note (quoted — it holds a comma) last');
  const rules = code(RULES);
  assert.match(rules, /readonly description: string;\n\s*readonly rating: number \| null;\n\s*readonly note: string \| null;/, 'no field rename — the route’s payload is unchanged');
  assert.match(comments(RULES), /LEDGER-04 \(Alex, 2026-10-20\): printed under SUB ACCOUNT NAME/);
  assert.match(comments(RULES), /LEDGER-04 \(Alex, 2026-10-20\): printed under DESCRIPTION — what was ordered/);
  assert.doesNotMatch(code('src/app/api/operations/ledger/route.ts'), /subAccount|SUB ACCOUNT/, 'the route knows nothing of the rename');
  // The "+ expense" form's labels — the ledger's own heads for the stop's name and the note; the refusal names the field by its label.
  assert.deepEqual([EXPENSE_FIELD_WORDS.name, EXPENSE_FIELD_WORDS.note], ['SUB ACCOUNT NAME', 'DESCRIPTION']);
  assert.equal(requiredWords('name'), 'SUB ACCOUNT NAME is required');
  assert.match(code(EXPENSE_FORM), /<span className=\{label\}>\{EXPENSE_FIELD_WORDS\[name\]\}<\/span>/, 'the form prints the one map');
  // The stop form's note box: the aria-label says Description; its placeholder words are the role's, unchanged.
  const stop = code(STOP_FORM);
  assert.match(stop, /placeholder=\{draft\.outcome === 'skipped' \? 'why — required' : NOTE_PROMPT_WORDS\[role\]\} aria-label="Description" className=\{`\$\{box\} w-56`\} maxLength=\{280\} data-stop-note \/>/);
  assert.doesNotMatch(stop, /aria-label="Note"/);
  // Untouched: the summary's group words and the registry's Time row.
  assert.deepEqual(GROUP_WORDS, { day: 'Day', week: 'Week', month: 'Month', city: 'City', country: 'Country', coa: 'COA', book: 'Book' });
  assert.doesNotMatch(code(REGISTRY), /SUB ACCOUNT|LEDGER-04/);
});

// ── R2 · THE COLUMN FILTERS ─────────────────────────────────────────────────

test('R2 the columns: sixteen keys in the head’s order, each a VALUE, MONEY or TEXT column; the cell key is the words the table prints, "—" for a blank; the money figure is the CSV’s own', () => {
  assert.equal(LEDGER_COLUMNS.length, 16);
  assert.deepEqual(LEDGER_COLUMNS.map(headWordOf), [...LEDGER_HEAD_WORDS], 'LEDGER_COLUMNS[i] is LEDGER_HEAD_WORDS[i]');
  assert.deepEqual([...VALUE_COLUMNS, ...MONEY_COLUMNS, ...TEXT_COLUMNS].sort(), [...LEDGER_COLUMNS].sort(), 'every column has one kind');
  assert.deepEqual(VALUE_COLUMNS, ['day', 'date', 'city', 'country', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'stars', 'underOver']);
  assert.deepEqual(MONEY_COLUMNS, ['budget', 'actual', 'variance', 'match']);
  assert.deepEqual(TEXT_COLUMNS, ['description']);
  assert.deepEqual(LEDGER_COLUMNS.map(columnKind), ['value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'money', 'money', 'money', 'money', 'value', 'text']);
  assert.deepEqual(LEDGER_COLUMNS.map((c) => cellWordsOf(BRUNCH, c)), ['Tuesday', '2026-10-13', 'Chiang Mai', 'Thailand 🇹🇭', 'Personal', 'P-6150', 'Dining Out', 'Brunch', 'Luka Café', '★★★★', '$25', '$22', '−$3.00', '$22', 'under', 'khao soi, worth it']);
  assert.deepEqual(LEDGER_COLUMNS.map((c) => cellWordsOf(YOGA, c)), ['Monday', '2026-10-12', BLANK, BLANK, BLANK, BLANK, BLANK, 'Yoga', BLANK, '★★', BLANK, '$5', BLANK, BLANK, BLANK, BLANK], 'a blank cell is BLANK, as the table prints it');
  assert.equal(cellWordsOf(GYM, 'actual'), 'skipped', 'the ACTUAL cell’s own words');
  assert.deepEqual(MONEY_COLUMNS.map((c) => cellCentsOf(BRUNCH, c)), [2500, 2200, -300, 2200]);
  assert.deepEqual(MONEY_COLUMNS.map((c) => cellCentsOf(CLIENT, c)), [2500, 2500, 0, null], 'an unreadable posting: no MATCH figure (readableMatchCents)');
  assert.deepEqual(MONEY_COLUMNS.map((c) => cellCentsOf(GYM, c)), [1500, null, null, null]);
  assert.deepEqual([choiceWords(BLANK), choiceWords('Chiang Mai')], ['(blank)', 'Chiang Mai']);
});

test('R2 applyColumnFilters: all ticked is no filter; within a column the ticks are OR; across columns AND; "(blank)" dropped and kept; money bounds inclusive, blanks kept or dropped; DESCRIPTION contains, case-insensitive and trimmed', () => {
  assert.deepEqual(ids(applyColumnFilters(ROWS, NO_COLUMN_FILTERS)), ['e', 'a', 'b', 'c', 'd'], 'nothing filtered: every row, in the order given');
  assert.deepEqual(Object.keys(NO_COLUMN_FILTERS).sort(), [...LEDGER_COLUMNS].sort(), 'one filter per column');
  assert.ok(Object.isFrozen(NO_COLUMN_FILTERS) && Object.isFrozen(NO_VALUE_FILTER) && Object.isFrozen(NO_MONEY_FILTER) && Object.isFrozen(NO_TEXT_FILTER));
  assert.deepEqual([NO_VALUE_FILTER, NO_MONEY_FILTER, NO_TEXT_FILTER], [{ dropped: [] }, { minCents: null, maxCents: null, blank: true }, { contains: '' }]);
  // A VALUE column: the values dropped are out; the rest (OR) stay — a blank cell among them until "(blank)" is dropped too.
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ city: { dropped: ['Bangkok'] } }))), ['e', 'a', 'b', 'c']);
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ city: { dropped: ['Bangkok', BLANK] } }))), ['e', 'a', 'b'], '"(blank)" dropped: the row with no place is out');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ city: { dropped: ['Bangkok', 'Chiang Mai'] } }))), ['c'], 'only the blank kept');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ city: { dropped: ['Bangkok', 'Chiang Mai', BLANK] } }))), [], '"none": every value present dropped');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ day: { dropped: ['Tuesday'] } }))), ['e', 'c', 'd']);
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ stars: { dropped: ['★★★★★', BLANK] } }))), ['e', 'a', 'c']);
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ underOver: { dropped: ['over', 'even', BLANK] } }))), ['a']);
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ subAccountName: { dropped: ['Brunch', 'Dinner'] } }))), ['e', 'c', 'd']);
  // Across columns: AND.
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ city: { dropped: [BLANK] }, vendor: { dropped: [BLANK] } }))), ['e', 'a', 'd'], 'a city AND a vendor');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ city: { dropped: ['Bangkok', BLANK] }, book: { dropped: ['Personal'] } }))), [], 'Chiang Mai AND not Personal: none');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ book: { dropped: ['Business', BLANK] }, actual: { minCents: 1000, maxCents: null, blank: false } }))), ['a', 'b'], 'Personal AND an actual of $10 or more');
  // A MONEY column: min and max inclusive, either side open; blank cells kept at first, dropped by the tick.
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ actual: { minCents: 2200, maxCents: 2500, blank: true } }))), ['e', 'a', 'd'], 'both bounds inclusive; the blank (skipped) kept');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ actual: { minCents: 2200, maxCents: 2500, blank: false } }))), ['a', 'd'], 'the blank dropped');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ actual: { minCents: 1000, maxCents: null, blank: true } }))), ['e', 'a', 'b', 'd'], 'a min alone');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ actual: { minCents: null, maxCents: 2200, blank: true } }))), ['e', 'a', 'c'], 'a max alone');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ actual: { minCents: null, maxCents: null, blank: false } }))), ['a', 'b', 'c', 'd'], 'no bound — the blank tick alone');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ variance: { minCents: -300, maxCents: 0, blank: false } }))), ['a', 'd'], 'a negative bound');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ match: { minCents: 2200, maxCents: null, blank: false } }))), ['a'], 'MATCH by the readable sum — the unreadable is a blank');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ budget: { minCents: 2500, maxCents: 2500, blank: false } }))), ['a', 'd']);
  // DESCRIPTION: contains, case-insensitive, trimmed; a blank description never matches a non-empty text.
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ description: { contains: ' KHAO ' } }))), ['a']);
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ description: { contains: 'pad' } }))), ['b']);
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ description: { contains: 'a' } }))), ['e', 'a', 'b'], 'every description with an a ("with Pim" has none) — the blank left out');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ description: { contains: '   ' } }))), ['e', 'a', 'b', 'c', 'd'], 'blank text is no filter');
  assert.deepEqual(ids(applyColumnFilters(ROWS, withFilter({ description: { contains: 'xyz' } }))), []);
  assert.deepEqual([containsNeedle('  Khao '), containsNeedle('   ')], ['khao', '']);
  assert.equal(rowPassesFilters(BRUNCH, withFilter({ description: { contains: 'khao' }, city: { dropped: ['Chiang Mai'] } })), false);
  // Which columns are on — the header's mark and the "clear filters" chip.
  assert.equal(anyColumnFilterOn(NO_COLUMN_FILTERS), false);
  for (const c of LEDGER_COLUMNS) assert.equal(columnFilterOn(NO_COLUMN_FILTERS, c), false, `${c} off at first`);
  assert.equal(columnFilterOn(withFilter({ city: { dropped: ['Bangkok'] } }), 'city'), true);
  assert.equal(columnFilterOn(withFilter({ actual: { minCents: null, maxCents: null, blank: false } }), 'actual'), true, 'the blank tick alone is a filter');
  assert.equal(columnFilterOn(withFilter({ actual: { minCents: 100, maxCents: null, blank: true } }), 'actual'), true);
  assert.equal(columnFilterOn(withFilter({ description: { contains: '   ' } }), 'description'), false, 'blank text is no filter');
  assert.equal(columnFilterOn(withFilter({ description: { contains: 'a' } }), 'description'), true);
  assert.equal(anyColumnFilterOn(withFilter({ vendor: { dropped: [BLANK] } })), true);
});

test('R2 columnValues: every distinct cell word among the rows loaded with its count, in the column’s own sort order, the blank last; the money bound parser; the leaf', () => {
  assert.deepEqual(columnValues(ROWS, 'city'), [{ key: 'Bangkok', count: 1 }, { key: 'Chiang Mai', count: 3 }, { key: BLANK, count: 1 }]);
  assert.deepEqual(columnValues(ROWS, 'day'), [{ key: 'Monday', count: 1 }, { key: 'Tuesday', count: 2 }, { key: 'Saturday', count: 1 }, { key: 'Sunday', count: 1 }], 'DAY in weekday order, Monday first');
  assert.deepEqual(columnValues(ROWS, 'stars'), [{ key: '★★', count: 1 }, { key: '★★★', count: 1 }, { key: '★★★★', count: 1 }, { key: '★★★★★', count: 1 }, { key: BLANK, count: 1 }]);
  assert.deepEqual(columnValues(ROWS, 'book'), [{ key: 'Business', count: 1 }, { key: 'Personal', count: 3 }, { key: BLANK, count: 1 }]);
  assert.deepEqual(columnValues(ROWS, 'account'), [{ key: 'B-6100', count: 1 }, { key: 'P-5300', count: 1 }, { key: 'P-6150', count: 2 }, { key: BLANK, count: 1 }]);
  assert.deepEqual(columnValues(ROWS, 'underOver'), [{ key: 'even', count: 1 }, { key: 'over', count: 1 }, { key: 'under', count: 1 }, { key: BLANK, count: 2 }]);
  assert.deepEqual(columnValues(ROWS, 'date').map((v) => v.key), ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-17']);
  assert.deepEqual(columnValues([], 'city'), []);
  // A money bound as typed: dollars, a sign allowed, two decimals at most; empty is no bound; anything else is refused by name and sets nothing.
  assert.deepEqual([boundCentsOf(''), boundCentsOf('  '), boundCentsOf(' 12 '), boundCentsOf('8.5'), boundCentsOf('8.50'), boundCentsOf('-3'), boundCentsOf('0.05'), boundCentsOf('0')],
    [{ ok: true, cents: null }, { ok: true, cents: null }, { ok: true, cents: 1200 }, { ok: true, cents: 850 }, { ok: true, cents: 850 }, { ok: true, cents: -300 }, { ok: true, cents: 5 }, { ok: true, cents: 0 }]);
  for (const bad of ['1.234', '$12', 'abc', '1,000', '--3', '.5', '12.']) assert.deepEqual(boundCentsOf(bad), { ok: false, words: boundTypedWords(bad) }, bad);
  assert.equal(boundTypedWords('$12'), '"$12" is not dollars — 12, 8.50 or -3');
  assert.deepEqual([boundDollarsOf(1200), boundDollarsOf(850), boundDollarsOf(-350), boundDollarsOf(0), boundDollarsOf(null)], ['12.00', '8.50', '-3.50', '0.00', '']);
  // The words.
  assert.deepEqual([ALL_WORDS, NONE_WORDS, FILTER_OPEN_WORDS, FILTER_ON_MARK, CLEAR_FILTERS_WORDS, BLANK_CHOICE_WORDS, NARROW_FROM, NARROW_WORDS, MIN_WORDS, MAX_WORDS, CONTAINS_WORDS, CLOSE_FILTER_WORDS],
    ['all', 'none', '▾', '●', 'clear filters', '(blank)', 10, 'type to narrow', 'min $', 'max $', 'contains', 'close']);
  assert.deepEqual([filterLabelWords('CITY'), sortLabelWords('ACTUAL')], ['filter CITY', 'sort by ACTUAL']);
  // The leaf: one popover by the column's kind — the checklist with its links, counts and narrow box (over NARROW_FROM values); the two bounds and the blank tick; the contains box; closed by its button, Escape, a click outside or a scroll; fixed at the point given; nothing stored.
  const leaf = code(LEAF);
  assert.match(leaf, /^'use client';/m);
  assert.doesNotMatch(leaf, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie/, 'nothing fetched, nothing stored');
  assert.match(leaf, /\| \{ readonly kind: 'value'; readonly values: readonly ColumnValue\[\]; readonly filter: ValueFilter; readonly onChange: \(filter: ValueFilter\) => void \}\n\s*\| \{ readonly kind: 'money'; readonly filter: MoneyFilter; readonly onChange: \(filter: MoneyFilter\) => void \}\n\s*\| \{ readonly kind: 'text'; readonly filter: TextFilter; readonly onChange: \(filter: TextFilter\) => void \}/, 'the rule’s own shapes, by kind');
  for (const attr of ['data-ledger-popover={column}', 'data-ledger-popover-head', 'data-ledger-popover-close', 'data-ledger-choice-all', 'data-ledger-choice-none', 'data-ledger-narrow', 'data-ledger-choices', 'data-ledger-choice={v.key}', 'data-ledger-choice-words', 'data-ledger-choice-count', 'data-ledger-min', 'data-ledger-max', 'data-ledger-blank', 'data-ledger-popover-words', 'data-ledger-contains']) {
    assert.ok(leaf.includes(attr), `the leaf carries ${attr}`);
  }
  assert.match(leaf, /onClick=\{\(\) => onChange\(\{ dropped: \[\] \}\)\} data-ledger-choice-all>\{ALL_WORDS\}<\/button>/, '"all" ticks every value');
  assert.match(leaf, /onClick=\{\(\) => onChange\(\{ dropped: values\.map\(\(v\) => v\.key\) \}\)\} data-ledger-choice-none>\{NONE_WORDS\}<\/button>/, '"none" drops every value present');
  assert.match(leaf, /\{values\.length > NARROW_FROM && <input type="text" value=\{narrow\}/, 'the narrow box only past ten values');
  assert.match(leaf, /const listed = needle === '' \? values : values\.filter\(\(v\) => choiceWords\(v\.key\)\.toLowerCase\(\)\.includes\(needle\)\);/, 'it narrows the list, not the rows');
  assert.match(leaf, /<input type="checkbox" checked=\{!filter\.dropped\.includes\(v\.key\)\} onChange=\{\(e\) => tick\(v\.key, e\.target\.checked\)\} data-ledger-choice=\{v\.key\} \/>/, 'ticked unless dropped');
  assert.match(leaf, /const read = boundCentsOf\(typed\);\n\s*if \(!read\.ok\) \{ setWords\(read\.words\); return; \}\n\s*setWords\(null\);\n\s*onChange\(\{ \.\.\.filter, \[which\]: read\.cents \}\);/, 'a refusal is said and sets nothing');
  assert.match(leaf, /<input type="checkbox" checked=\{filter\.blank\} onChange=\{\(e\) => onChange\(\{ \.\.\.filter, blank: e\.target\.checked \}\)\} data-ledger-blank \/>/);
  assert.match(leaf, /onChange=\{\(e\) => onChange\(\{ contains: e\.target\.value \}\)\} className=\{`\$\{box\} w-48`\} data-ledger-contains \/>/);
  assert.match(leaf, /const follow = \(\) => setAt\(below\(anchor\)\);\n\s*document\.addEventListener\('mousedown', onDown\);\n\s*document\.addEventListener\('keydown', onKey\);\n\s*window\.addEventListener\('scroll', follow, true\);\n\s*window\.addEventListener\('resize', follow\);/, 'closed by a click outside or Escape; follows its ▾ on a scroll or a resize');
  assert.match(leaf, /export const POPOVER_WIDTH = 352;\nexport const below = \(anchor: HTMLElement\): PopoverAt => \{ const r = anchor\.getBoundingClientRect\(\); return \{ left: Math\.max\(8, Math\.min\(r\.left, window\.innerWidth - POPOVER_WIDTH - 8\)\), top: r\.bottom \+ 2 \}; \};/, 'just under the ▾, kept on screen (22rem = 352px, the popover’s max width)');
  assert.match(leaf, /max-w-\[22rem\]/);
  assert.match(leaf, /style=\{\{ position: 'fixed', left: at\.left, top: at\.top \}\}/, 'fixed under the ▾ — never clipped by the table’s scroll box');
  assert.match(leaf, /role="dialog" aria-label=\{filterLabelWords\(headWordOf\(column\)\)\}/);
  const printed = [...leaf.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.ok(printed.length >= 6);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(leaf, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
});

// ── R3 · THE SORT ───────────────────────────────────────────────────────────

test('R3 sortRows: one column, ascending then descending, blanks last both ways; money by cents, dates by day, DAY by weekday number, STARS by number, text by localeCompare with numeric; ties keep the ledger’s order; the third click is the ledger’s own order', () => {
  const by = (column: LedgerColumn, direction: LedgerSort['direction']) => ids(sortRows(ROWS, { column, direction }));
  assert.deepEqual(by('actual', 'asc'), ['c', 'a', 'd', 'b', 'e'], '$5 · $22 · $25 · $35 · the blank last');
  assert.deepEqual(by('actual', 'desc'), ['b', 'd', 'a', 'c', 'e'], 'the blank still last');
  assert.deepEqual(by('budget', 'asc'), ['e', 'a', 'd', 'b', 'c'], '$15 · $25 · $25 (ties in the ledger’s order) · $30 · the blank');
  assert.deepEqual(by('variance', 'asc'), ['a', 'd', 'b', 'e', 'c'], '−$3 · $0 · +$5 · the blanks in the ledger’s order');
  assert.deepEqual(by('match', 'desc'), ['a', 'e', 'b', 'c', 'd'], 'the one readable sum, then every blank (the unreadable among them)');
  assert.deepEqual(by('day', 'asc'), ['c', 'a', 'b', 'e', 'd'], 'Monday · Tuesday · Tuesday · Saturday · Sunday — by weekday number, not by name');
  assert.deepEqual(by('day', 'desc'), ['d', 'e', 'a', 'b', 'c'], 'Sunday first; the two Tuesdays keep their order');
  assert.deepEqual(by('date', 'asc'), ['d', 'c', 'a', 'b', 'e']);
  assert.deepEqual(by('date', 'desc'), ['e', 'a', 'b', 'c', 'd']);
  assert.deepEqual(by('stars', 'asc'), ['c', 'e', 'a', 'b', 'd'], '2 · 3 · 4 · 5 · no stars last');
  assert.deepEqual(by('stars', 'desc'), ['b', 'a', 'e', 'c', 'd']);
  assert.deepEqual(by('city', 'asc'), ['d', 'e', 'a', 'b', 'c'], 'Bangkok · Chiang Mai ×3 (the ledger’s order) · no place last');
  assert.deepEqual(by('city', 'desc'), ['e', 'a', 'b', 'd', 'c']);
  assert.deepEqual(by('country', 'asc'), ['e', 'a', 'b', 'd', 'c'], 'one country, ties in order; the blank last');
  assert.deepEqual(by('book', 'asc'), ['d', 'e', 'a', 'b', 'c']);
  assert.deepEqual(by('account', 'asc'), ['d', 'e', 'a', 'b', 'c'], 'B-6100 · P-5300 · P-6150 ×2 · blank');
  assert.deepEqual(by('accountName', 'asc'), ['d', 'a', 'b', 'e', 'c'], 'Client meals · Dining Out ×2 · Fitness · blank');
  assert.deepEqual(by('subAccountName', 'asc'), ['a', 'd', 'b', 'e', 'c'], 'Brunch · Client lunch · Dinner · Gym · Yoga');
  assert.deepEqual(by('vendor', 'asc'), ['e', 'a', 'd', 'b', 'c'], 'Fitness First · Luka Café · Som Tam Nua · the two blanks in order');
  assert.deepEqual(by('vendor', 'desc'), ['d', 'a', 'e', 'b', 'c']);
  assert.deepEqual(by('underOver', 'asc'), ['d', 'b', 'a', 'e', 'c'], 'even · over · under · the blanks');
  assert.deepEqual(by('description', 'asc'), ['a', 'e', 'b', 'd', 'c'], 'khao soi · leg day · Pad thai (case does not order) · with Pim · the blank');
  assert.deepEqual(by('description', 'desc'), ['d', 'b', 'e', 'a', 'c']);
  // Numeric text: "P-10" after "P-9", not before.
  const ten = row({ id: 't', coa: { account: 'P-10', name: null } });
  const nine = row({ id: 'n', coa: { account: 'P-9', name: null } });
  assert.deepEqual(ids(sortRows([ten, nine], { column: 'account', direction: 'asc' })), ['n', 't']);
  // The ledger's own order: null gives the rows as they came, a copy.
  const own = sortRows(ROWS, null);
  assert.deepEqual(ids(own), ['e', 'a', 'b', 'c', 'd']);
  assert.notEqual(own, ROWS);
  assert.deepEqual(ROWS.map((r) => r.id), ['e', 'a', 'b', 'c', 'd'], 'the rows given are not reordered');
  // The clicks: ascending, descending, then the ledger's order; another column starts ascending.
  const first = nextSort(null, 'actual');
  assert.deepEqual(first, { column: 'actual', direction: 'asc' });
  const second = nextSort(first, 'actual');
  assert.deepEqual(second, { column: 'actual', direction: 'desc' });
  assert.equal(nextSort(second, 'actual'), null, 'the third click');
  assert.deepEqual(nextSort(second, 'city'), { column: 'city', direction: 'asc' }, 'one column at a time');
  assert.deepEqual([weekdayNumber('2026-10-12'), weekdayNumber('2026-10-17'), weekdayNumber('2026-10-18')], [1, 6, 7], 'Monday 1 … Sunday 7');
  assert.deepEqual([sortKeyOf(GYM, 'actual'), sortKeyOf(GYM, 'day'), sortKeyOf(CLIENT, 'underOver'), sortKeyOf(YOGA, 'city')], [null, { kind: 'number', n: 6 }, { kind: 'text', t: 'even' }, null]);
  assert.deepEqual(SORT_MARKS, { asc: '▲', desc: '▼' });
});

// ── R4 · THE NOTES ──────────────────────────────────────────────────────────

test('R4 notesCount: the lines with something to say — the two coverage lines while a row is shown, each said line whose count is above 0; the TODAY rule and the every-book line never counted; the toggle’s words', () => {
  assert.equal(notesCount(NOTHING_SAID, 0), 0, 'nothing shown, nothing said');
  assert.equal(notesCount(NOTHING_SAID, 3), 2, 'rows shown: the VARIANCE and MATCH coverage lines');
  assert.equal(notesCount({ ...NOTHING_SAID, notRecorded: 2 }, 0), 1, 'the one fact the table cannot show');
  assert.equal(notesCount({ ...NOTHING_SAID, noLine: 2, doubled: 1, noStay: 3, unplaced: [{ record: record('r-mars'), detail: 'x' }], notRecorded: 2, notPlaced: 1, leftOut: { journal: 1, plan: 0, execute: 0, all_day: 0 } }, 7), 8, 'every line');
  assert.equal(notesCount({ ...NOTHING_SAID, doubled: 1 }, 0), 0, 'doubled rides the no-line words — not a line of its own');
  assert.equal(leftOutTotal({ journal: 1, plan: 2, execute: 0, all_day: 0 }), 3);
  assert.deepEqual([notesToggleWords(0, false), notesToggleWords(1, false), notesToggleWords(3, true)], ['0 notes ▸', '1 note ▸', '3 notes ▾']);
  assert.deepEqual([NOTES_CLOSED_MARK, NOTES_OPEN_MARK], ['▸', '▾']);
});

// ── THE SECTION ─────────────────────────────────────────────────────────────

test('the section: no dropdown; every header a sort button and a ▾; one popover at a time, built from the rows LOADED; the rows shown filtered then sorted, feeding the TOTAL row, the coverage, the summary and the CSV; the filters reset with the period, not with a write; "clear filters" beside the CSV; the notes toggle closed on every load, its lines guarded by their counts; nothing stored', () => {
  const s = code(SECTION);
  assert.doesNotMatch(s, /<select|<option|FILTER_KEYS|choicesOf|filterRows|NO_FILTERS/, 'the three dropdowns are gone');
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie/, 'nothing fetched here, nothing stored');
  assert.match(s, /const \[filters, setFilters\] = useState<ColumnFilters>\(NO_COLUMN_FILTERS\);\n\s*const \[sort, setSort\] = useState<LedgerSort \| null>\(null\);\n\s*const \[openFilter, setOpenFilter\] = useState<LedgerColumn \| null>\(null\);\n\s*const \[notesOpen, setNotesOpen\] = useState\(false\);\n\s*const filterButtons = useRef\(new Map<LedgerColumn, HTMLButtonElement>\(\)\);/, 'React state only: the filters, the sort, the column open, the toggle — closed at first; the ▾ buttons in a ref map');
  assert.match(s, /const shown = sortRows\(applyColumnFilters\(rows, filters\), sort\);\n\s*const totals = ledgerTotals\(shown\);\n\s*const groups = ledgerSummary\(shown, by\);/, 'filtered, then sorted; the totals and the summary follow');
  assert.match(s, /new Blob\(\[ledgerCsv\(shown\)\]/, 'the CSV in the shown order');
  // The filters reset when the period changes — its own effect; the read effect (a write re-reads the same period) no longer touches them.
  assert.match(s, /useEffect\(\(\) => \{\n\s*setFilters\(NO_COLUMN_FILTERS\);\n\s*setOpenFilter\(null\);\n\s*\}, \[period\?\.from, period\?\.to\]\);/);
  const readEffect = s.slice(s.indexOf('const read = await readLedger(period.from, period.to);'), s.indexOf('return () => { live = false; };'));
  assert.doesNotMatch(readEffect, /setFilters|setSort/, 'a re-read keeps the filters and the sort');
  assert.match(comments(SECTION), /THE\s*\n?\s*\*?\s*FILTERS RESET WHEN THE PERIOD CHANGES/, 'the doc says so, and why');
  // The headers: the head word sorts (nextSort), the mark shows the direction; the ▾ opens the popover at its corner; a mark while the filter is on.
  assert.match(s, /\{LEDGER_COLUMNS\.map\(\(c\) => \{\n\s*const h = headWordOf\(c\);\n\s*const on = columnFilterOn\(filters, c\);\n\s*const sorted = sort !== null && sort\.column === c;/);
  assert.match(s, /<button type="button" className="hover:text-text-primary" onClick=\{\(\) => setSort\(nextSort\(sort, c\)\)\} aria-label=\{sortLabelWords\(h\)\} data-ledger-sort=\{c\} data-ledger-sort-direction=\{sorted \? sort\.direction : undefined\}>\{h\}<\/button>/);
  assert.match(s, /\{sorted && <span data-ledger-sort-mark>\{SORT_MARKS\[sort\.direction\]\}<\/span>\}/);
  assert.match(s, /<button type="button" ref=\{\(el\) => \{ if \(el === null\) filterButtons\.current\.delete\(c\); else filterButtons\.current\.set\(c, el\); \}\} className=\{on \? 'text-brand-purple' : 'hover:text-text-primary'\} onClick=\{\(\) => setOpenFilter\(c\)\} aria-label=\{filterLabelWords\(h\)\} aria-expanded=\{openFilter === c\} data-ledger-filter=\{c\} data-ledger-filter-on=\{on \? '' : undefined\}>/);
  assert.match(s, /\{on && <span data-ledger-filter-mark>\{FILTER_ON_MARK\}<\/span>\}\n\s*<span data-ledger-filter-open>\{FILTER_OPEN_WORDS\}<\/span>/);
  // One popover: the leaf by the column's kind, the checklist over the rows LOADED (not the rows shown), the filter handed back whole.
  assert.match(s, /const anchor = filterButtons\.current\.get\(c\);\n\s*if \(anchor === undefined\) return null;/, 'under its own ▾');
  assert.match(s, /if \(kind === 'value'\) return <ColumnFilter kind="value" column=\{c\} anchor=\{anchor\} values=\{columnValues\(rows, c as ValueColumn\)\} filter=\{filters\[c as ValueColumn\]\} onChange=\{\(f\) => setFilters\(\{ \.\.\.filters, \[c\]: f \}\)\} onClose=\{closeFilter\} \/>;/);
  assert.match(s, /if \(kind === 'money'\) return <ColumnFilter kind="money" column=\{c\} anchor=\{anchor\} filter=\{filters\[c as MoneyColumn\]\}/);
  assert.match(s, /return <ColumnFilter kind="text" column=\{c\} anchor=\{anchor\} filter=\{filters\[c as TextColumn\]\}/);
  assert.match(s, /\{openFilter !== null && popover\(openFilter\)\}/);
  assert.match(s, /const closeFilter = useCallback\(\(\) => setOpenFilter\(null\), \[\]\);/);
  assert.equal((s.match(/<ColumnFilter /g) ?? []).length, 3, 'one mount per kind, one open at a time');
  assert.match(s, /\{rows\.length > 0 && \(\n\s*<div className="overflow-x-auto border border-border rounded bg-white">\n\s*<table className="w-full min-w-\[96rem\] border-collapse text-xs" data-ledger-table>/, 'the table — its headers hold the filters — stays while rows are loaded, even when a filter leaves none shown');
  assert.match(s, /\{rows\.length > 0 && shown\.length === 0 && <div className="text-xs text-text-muted" data-ledger-none-shown>\{NO_ROWS_SHOWN_WORDS\}<\/div>\}/, 'and says no row matches');
  // "clear filters" beside "download CSV", only while a filter is on.
  assert.match(s, /data-ledger-csv>\{CSV_DOWNLOAD_WORDS\}<\/button>\n\s*\{anyColumnFilterOn\(filters\) && <button type="button" className=\{chip\} onClick=\{\(\) => setFilters\(NO_COLUMN_FILTERS\)\} data-ledger-clear-filters>\{CLEAR_FILTERS_WORDS\}<\/button>\}/);
  // The cells: row.description under SUB ACCOUNT NAME, row.note under DESCRIPTION; the TOTAL row's last cell.
  assert.match(s, /data-ledger-cell="sub-account-name">\{row\.description\}<\/td>/);
  assert.match(s, /data-ledger-cell="description">\{noteCellWords\(row\.note\)\}<\/td>/);
  assert.match(s, /<td className=\{cell\} data-ledger-total-description \/>/);
  // The notes: the toggle under the TOTAL row with the count's words; open, the lines each guarded by its count; the two uncounted lines unguarded.
  assert.match(s, /<button type="button" className="hover:text-text-primary" onClick=\{\(\) => setNotesOpen\(!notesOpen\)\} aria-expanded=\{notesOpen\} data-ledger-notes-toggle>\{notesToggleWords\(notesCount\(answer\.read\.value\.said, shown\.length\), notesOpen\)\}<\/button>/);
  inOrder(s, ['</table>', 'data-ledger-notes>', 'data-ledger-notes-toggle', '{notesOpen && (', 'data-ledger-said>',
    '{shown.length > 0 && <p data-ledger-said-variance>{varianceCoverageWords(totals.withVariance, shown.length)}</p>}',
    '{shown.length > 0 && <p data-ledger-said-match>{matchCoverageWords(totals.withMatch, shown.length)}</p>}',
    '{answer.read.value.said.noLine > 0 && <p data-ledger-said-no-line>{noLineWords(answer.read.value.said.noLine, answer.read.value.said.doubled)}</p>}',
    '{answer.read.value.said.noStay > 0 && <p data-ledger-said-no-stay>{noStayWords(answer.read.value.said.noStay)}</p>}',
    '{answer.read.value.said.unplaced.length > 0 && <p data-ledger-said-unplaced>{unplacedWords(answer.read.value.said.unplaced)}</p>}',
    '{answer.read.value.said.notRecorded > 0 && <p data-ledger-said-not-recorded>{notRecordedWords(answer.read.value.said.notRecorded)}</p>}',
    '{leftOutTotal(answer.read.value.said.leftOut) > 0 && <p data-ledger-said-left-out>{leftOutWords(answer.read.value.said.leftOut)}</p>}',
    '{answer.read.value.said.notPlaced > 0 && <p data-ledger-said-not-placed>{notPlacedWords(answer.read.value.said.notPlaced)}</p>}',
    '<p data-ledger-said-today-rule>{TODAY_RULE_WORDS}</p>', '<p data-ledger-said-every-book>{EVERY_BOOK_WORDS}</p>', 'data-ledger-summary'], 'the toggle after the table, the lines in their order, the summary after');
  assert.equal((s.match(/data-ledger-said>/g) ?? []).length, 1, 'one block');
  // No sentence of its own.
  const printed = [...s.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.ok(printed.length > 20);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(s, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  // R5 nothing else: the period controls, the picker, the route, the schema and the day card (beyond the one aria-label) are untouched.
  assert.match(s, /\{PERIOD_KINDS\.map\(\(k\) => \(/);
  assert.match(s, /disabled=\{kind === 'all' \|\| anchor === null\}/);
  assert.match(s, /<LinkPicker kind=\{row\.address\.kind\} id=\{row\.address\.id\} instant=\{row\.address\.instant\} near=\{row\.day\} onChanged=\{\(\) => setWrites\(\(n\) => n \+ 1\)\} onClose=\{\(\) => setPicking\(null\)\} \/>/);
  for (const f of ['src/app/api/operations/ledger/route.ts', 'src/components/workbench/operations/ledger/LinkPicker.tsx', 'src/components/workbench/operations/day/DayCard.tsx', 'src/components/workbench/operations/day/dayCard.ts']) {
    assert.doesNotMatch(code(f), /ColumnFilter|applyColumnFilters|sortRows|notesCount|SUB ACCOUNT/, `${f} knows nothing of LEDGER-04`);
  }
  assert.match(comments(RULES), /LEDGER-04 \(Alex, 2026-10-20\) — THE TABLE AFTER THE FIRST READ/);
  assert.match(comments(SECTION), /LEDGER-04 \(Alex, 2026-10-20\): AFTER THE FIRST READ/);
});
