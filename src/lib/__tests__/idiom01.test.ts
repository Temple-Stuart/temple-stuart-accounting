/**
 * IDIOM-01 (Alex, 2026-10-24) — THE TABLE IDIOM BECOMES ONE SHARED COMPONENT.
 *
 * Ruling A — PURE EXTRACTION: the task ledger's rules (the column kinds, the
 * filters, the sort, the null word, the CSV, the empty state, the one popover)
 * moved into shared modules with their words and rules unchanged; the ledger's
 * screen, its CSV bytes and its behaviour stay identical (ruling, 2026-10-24:
 * "A's 'tests identical' yields to 'behaviour identical, proven'" — the DOM
 * snapshot and the CSV byte diff are in the PR; the pins that moved carry dated
 * notes in ledger01, ledger02 and ledger04).
 * Ruling B — SHAPE: src/lib/table/ (columns · filters · sort · csv · words,
 * generic over a column spec { key, label, kind }, kind ∈ value | money | text —
 * `date` is NOT a kind: the ledger sorts DATE by its ISO text, so a date column
 * stays a VALUE column) and src/components/table/DataTable.tsx (+ ColumnFilter);
 * the ledger keeps its sixteen-column spec, its row builder, its totals and its
 * summary in ledger.ts and renders through DataTable.
 * Ruling C — the three Books tables with their own filter code are untouched.
 * Ruling D — no migration, no route change, no new words on screen.
 *
 * Here: the generic rules DRIVEN over a three-column spec of their own and over
 * the ledger's spec; the ledger's functions proven to be the idiom's with its
 * spec (same answers, same bytes); and the extraction pinned to source
 * (TEST-TRUTH-01: code() and comments()).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { BLANK as FORMAT_BLANK } from '../budget/format';
import { columnOf, type SortKey, type TableColumn } from '../table/columns';
import { csvField, csvMoney, csvText, tableCsv } from '../table/csv';
import {
  NO_MONEY_FILTER, NO_TEXT_FILTER, NO_VALUE_FILTER, anyFilterOn, boundCentsOf, boundDollarsOf, choiceWords, columnValuesOf, containsNeedle, filterOn, filterRows, moneyFilterOf, noFilters,
  rowPasses, textFilterOf, valueFilterOf, withFilter, type TableFilters,
} from '../table/filters';
import { compareSortKeys, nextSort, numberKey, sortRows, sortRowsBy, textKey } from '../table/sort';
import * as WORDS from '../table/words';
import * as LEDGER from '../operations/ledger';
import { LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, LEDGER_TABLE, NO_COLUMN_FILTERS, applyColumnFilters, cellCentsOf, cellWordsOf, columnKind, columnValues, ledgerColumnOf, ledgerCsv, sortKeyOf, type LedgerRow, type MoneyColumn } from '../operations/ledger';
import { dataAttr } from '@/components/table/dataAttr';

const COLUMNS = 'src/lib/table/columns.ts';
const FILTERS = 'src/lib/table/filters.ts';
const SORT = 'src/lib/table/sort.ts';
const CSV = 'src/lib/table/csv.ts';
const TABLE_WORDS = 'src/lib/table/words.ts';
const RULES = 'src/lib/operations/ledger.ts';
const TABLE = 'src/components/table/DataTable.tsx';
const LEAF = 'src/components/table/ColumnFilter.tsx';
const ATTR = 'src/components/table/dataAttr.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const OLD_LEAF = 'src/components/workbench/operations/ledger/ColumnFilter.tsx';
const BOOKS_TABLES = ['src/components/dashboard/SpendingTab.tsx', 'src/components/dashboard/CommittedInvestmentsTable.tsx', 'src/components/dashboard/JournalEntryEngine.tsx'];

// ── A SPEC OF ITS OWN: three columns over plain rows ────────────────────────

interface Item { readonly id: string; readonly city: string | null; readonly cents: number | null; readonly note: string | null }
const SPEC: readonly TableColumn<Item, 'city' | 'cents' | 'note'>[] = [
  { key: 'city', label: 'CITY', kind: 'value', words: (r) => r.city ?? WORDS.BLANK, sortKey: (r) => textKey(r.city), csv: (r) => r.city ?? '' },
  { key: 'cents', label: 'AMOUNT', kind: 'money', words: (r) => (r.cents === null ? WORDS.BLANK : `$${r.cents / 100}`), sortKey: (r) => numberKey(r.cents), csv: (r) => csvMoney(r.cents), cents: (r) => r.cents },
  { key: 'note', label: 'NOTE', kind: 'text', words: (r) => r.note ?? WORDS.BLANK, sortKey: (r) => textKey(r.note), csv: (r) => r.note ?? '', text: (r) => r.note },
];
const ITEMS: readonly Item[] = [
  { id: 'a', city: 'Chiang Mai', cents: 2200, note: 'khao soi, worth it' },
  { id: 'b', city: 'Chiang Mai', cents: 3500, note: 'Pad thai' },
  { id: 'c', city: null, cents: 500, note: null },
  { id: 'd', city: 'Bangkok', cents: 2500, note: 'with Pim' },
  { id: 'e', city: 'Chiang Mai', cents: null, note: 'leg "day"\nline two' },
];
const ids = (rows: readonly Item[]): string[] => rows.map((r) => r.id);
const OFF = noFilters(SPEC);
const f = (over: Record<string, TableFilters[string]>): TableFilters => ({ ...OFF, ...over });

// ── A LEDGER FIXTURE (ledger04's five rows, the ledger's own shape) ─────────

const row = (over: Partial<LedgerRow> & { readonly id: string }): LedgerRow => ({
  key: `routine:${over.id}:2026-10-13T00:30:00.000Z`, address: { kind: 'routine', id: over.id, instant: '2026-10-13T00:30:00.000Z' }, match: null, day: '2026-10-13', time: '07:30',
  place: { city: 'Chiang Mai', country: 'Thailand 🇹🇭' }, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, description: 'Brunch', rating: null, note: null,
  cents: null, budgetState: 'none', outcome: 'done', actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null, ...over, // TIME-03: the row's two minutes fields
});
const GYM = row({ id: 'e', day: '2026-10-17', coa: { account: 'P-5300', name: 'Fitness' }, vendor: 'Fitness First', description: 'Gym', rating: 3, note: 'leg day', outcome: 'skipped', cents: 1500, budgetState: 'matched' });
const BRUNCH = row({ id: 'a', vendor: 'Luka Café', description: 'Brunch', rating: 4, note: 'khao soi, worth it', cents: 2500, actualCents: 2200, varianceCents: -300, budgetState: 'matched', match: { cents: 2200, postings: 1, unreadable: 0, reversed: 0 } });
const DINNER = row({ id: 'b', description: 'Dinner', rating: 5, note: 'Pad thai', cents: 3000, actualCents: 3500, varianceCents: 500, budgetState: 'matched' });
const YOGA = row({ id: 'c', day: '2026-10-12', place: null, book: null, coa: null, description: 'Yoga', rating: 2, actualCents: 500 });
const CLIENT = row({ id: 'd', day: '2026-10-11', place: { city: 'Bangkok', country: 'Thailand 🇹🇭' }, book: 'Business', coa: { account: 'B-6100', name: 'Client meals' }, vendor: 'Som Tam Nua', description: 'Client lunch', note: 'with Pim', cents: 2500, actualCents: 2500, varianceCents: 0, budgetState: 'matched', match: { cents: null, postings: 1, unreadable: 1, reversed: 0 } });
const ROWS: readonly LedgerRow[] = [GYM, BRUNCH, DINNER, YOGA, CLIENT];
const rowIds = (rows: readonly LedgerRow[]): string[] => rows.map((r) => r.id);

// ── T1 · THE KINDS, AND WHY date IS NOT ONE ─────────────────────────────────

test('T1 the kinds are value | money | text — exactly the ledger’s; `date` is not a kind: the ledger’s DATE column is a VALUE column whose sort key is its ISO text (it orders by day because the ISO form sorts so), and the spec’s comment says why', () => {
  assert.match(code(COLUMNS), /export type ColumnKind = 'value' \| 'money' \| 'text';/);
  assert.doesNotMatch(code(COLUMNS), /'date'/, 'no date kind in the code');
  assert.match(comments(COLUMNS), /`date`\s*\n?\s*\*?\s*is NOT a kind: the ledger's DATE column sorts by its 'YYYY-MM-DD' text/, 'the report, in the spec');
  assert.equal(ledgerColumnOf('date').kind, 'value');
  assert.equal(columnKind('date'), 'value');
  assert.deepEqual(sortKeyOf(BRUNCH, 'date'), { kind: 'text', t: '2026-10-13' }, 'the ISO text');
  assert.match(code(RULES), /case 'date': return text\(row\.day\);/, 'the ledger’s own key: the day’s text');
  assert.deepEqual(rowIds(sortRows(ROWS, { column: 'date', direction: 'asc' }, LEDGER_TABLE)), ['d', 'c', 'a', 'b', 'e'], 'by day — through the text');
  // The ledger's ColumnKind is the idiom's.
  assert.match(code(RULES), /export type \{ ColumnKind \} from '@\/lib\/table\/columns';/);
});

// ── T2 · THE LEDGER'S SPEC ──────────────────────────────────────────────────

test('T2 LEDGER_TABLE: the eighteen columns (TIME-03; sixteen until then) in the head’s order — key, head word, kind, the cell words (cellWordsOf), the sort key (sortKeyOf), the CSV field (LEDGER_CSV); money columns carry cellCentsOf, the text column the note; columnOf throws on a key the spec does not name', () => {
  assert.deepEqual(LEDGER_TABLE.map((c) => c.key), [...LEDGER_COLUMNS]);
  assert.deepEqual(LEDGER_TABLE.map((c) => c.label), [...LEDGER_HEAD_WORDS]);
  assert.deepEqual(LEDGER_TABLE.map((c) => c.kind), LEDGER_COLUMNS.map(columnKind));
  for (const r of ROWS) {
    for (const c of LEDGER_TABLE) {
      assert.equal(c.words(r), cellWordsOf(r, c.key), `${c.key} words of ${r.id}`);
      assert.deepEqual(c.sortKey(r), sortKeyOf(r, c.key), `${c.key} sort key of ${r.id}`);
      assert.equal(c.csv(r), LEDGER_CSV[c.key](r), `${c.key} csv of ${r.id}`);
      if (c.kind === 'money') assert.equal(c.cents(r), cellCentsOf(r, c.key as MoneyColumn), `${c.key} cents of ${r.id}`);
      if (c.kind === 'text') assert.equal(c.text(r), r.note, `${c.key} text of ${r.id}`);
    }
  }
  assert.deepEqual(LEDGER_TABLE.filter((c) => c.kind === 'money').map((c) => c.key), ['budget', 'actual', 'variance', 'match']);
  assert.deepEqual(LEDGER_TABLE.filter((c) => c.kind === 'text').map((c) => c.key), ['description']);
  assert.equal(ledgerColumnOf('city').label, 'CITY');
  assert.throws(() => columnOf(SPEC, 'stars' as 'city'), /no column "stars" among \[city cents note\]/);
  // The spec is built after the words and the CSV fields it reads, and it is the one list every ledger rule calls the idiom with.
  const rules = code(RULES);
  assert.ok(rules.indexOf('export const LEDGER_HEAD_WORDS') < rules.indexOf('export const LEDGER_CSV') && rules.indexOf('export const LEDGER_CSV') < rules.indexOf('export const LEDGER_TABLE'), 'the head words, then the CSV fields, then the spec');
  for (const call of ['filterOn(filters, column, columnKind(column))', 'anyFilterOn(LEDGER_TABLE, filters)', 'rowPasses(row, filters, LEDGER_TABLE)', 'filterRows(rows, filters, LEDGER_TABLE)', 'columnValuesOf(rows, ledgerColumnOf(column))', 'sortTableRows(rows, sort, LEDGER_TABLE)', 'tableCsv(LEDGER_TABLE, rows)']) {
    assert.ok(rules.includes(call), `the ledger calls the idiom: ${call}`);
  }
});

// ── T3 · THE FILTERS, GENERIC ───────────────────────────────────────────────

test('T3 the filters over a spec of their own: all off is every row; within a VALUE column OR, across columns AND; "(blank)" dropped and kept; money bounds inclusive, the blank tick; contains trimmed and case-insensitive; noFilters by kind; withFilter keeps the rest; a missing or mis-shaped filter throws', () => {
  assert.deepEqual(OFF, { city: NO_VALUE_FILTER, cents: NO_MONEY_FILTER, note: NO_TEXT_FILTER });
  assert.ok(Object.isFrozen(OFF));
  assert.deepEqual(ids(filterRows(ITEMS, OFF, SPEC)), ['a', 'b', 'c', 'd', 'e'], 'nothing filtered: every row, in the order given');
  assert.deepEqual(ids(filterRows(ITEMS, f({ city: { dropped: ['Bangkok'] } }), SPEC)), ['a', 'b', 'c', 'e']);
  assert.deepEqual(ids(filterRows(ITEMS, f({ city: { dropped: ['Bangkok', WORDS.BLANK] } }), SPEC)), ['a', 'b', 'e'], '"(blank)" dropped');
  assert.deepEqual(ids(filterRows(ITEMS, f({ city: { dropped: ['Bangkok', 'Chiang Mai'] } }), SPEC)), ['c'], 'only the blank kept');
  assert.deepEqual(ids(filterRows(ITEMS, f({ city: { dropped: ['Bangkok', 'Chiang Mai', WORDS.BLANK] } }), SPEC)), [], '"none"');
  assert.deepEqual(ids(filterRows(ITEMS, f({ city: { dropped: [WORDS.BLANK] }, cents: { minCents: 2500, maxCents: null, blank: true } }), SPEC)), ['b', 'd', 'e'], 'a city AND an amount of $25 or more (the blank amount kept)');
  assert.deepEqual(ids(filterRows(ITEMS, f({ cents: { minCents: 2200, maxCents: 2500, blank: true } }), SPEC)), ['a', 'd', 'e'], 'both bounds inclusive; the blank kept');
  assert.deepEqual(ids(filterRows(ITEMS, f({ cents: { minCents: 2200, maxCents: 2500, blank: false } }), SPEC)), ['a', 'd'], 'the blank dropped');
  assert.deepEqual(ids(filterRows(ITEMS, f({ cents: { minCents: null, maxCents: null, blank: false } }), SPEC)), ['a', 'b', 'c', 'd'], 'no bound — the blank tick alone');
  assert.deepEqual(ids(filterRows(ITEMS, f({ note: { contains: ' PAD ' } }), SPEC)), ['b'], 'trimmed, case-insensitive');
  assert.deepEqual(ids(filterRows(ITEMS, f({ note: { contains: 'a' } }), SPEC)), ['a', 'b', 'e'], 'the blank note never matches ("with Pim" has no a)');
  assert.deepEqual(ids(filterRows(ITEMS, f({ note: { contains: '   ' } }), SPEC)), ['a', 'b', 'c', 'd', 'e'], 'blank text is no filter');
  assert.equal(rowPasses(ITEMS[4], f({ cents: { minCents: null, maxCents: null, blank: false } }), SPEC), false, 'the blank amount dropped by the tick alone');
  assert.equal(rowPasses(ITEMS[2], f({ cents: { minCents: null, maxCents: null, blank: false } }), SPEC), true, '$5 is not a blank');
  // On and off.
  assert.equal(anyFilterOn(SPEC, OFF), false);
  assert.equal(filterOn(f({ cents: { minCents: null, maxCents: null, blank: false } }), 'cents', 'money'), true, 'the blank tick alone is a filter');
  assert.equal(filterOn(f({ note: { contains: '  ' } }), 'note', 'text'), false);
  assert.equal(anyFilterOn(SPEC, f({ city: { dropped: ['Bangkok'] } })), true);
  // withFilter: one column replaced, the rest kept, the caller's shape.
  const one = withFilter(OFF, 'city', { dropped: ['Bangkok'] });
  assert.deepEqual(one, { city: { dropped: ['Bangkok'] }, cents: NO_MONEY_FILTER, note: NO_TEXT_FILTER });
  assert.deepEqual(OFF.city, NO_VALUE_FILTER, 'the one given is not changed');
  // Reading by kind: the shape held must be the kind's; a missing filter is a bug, never "no filter".
  assert.deepEqual(valueFilterOf(one, 'city'), { dropped: ['Bangkok'] });
  assert.deepEqual(moneyFilterOf(one, 'cents'), NO_MONEY_FILTER);
  assert.deepEqual(textFilterOf(one, 'note'), NO_TEXT_FILTER);
  assert.throws(() => valueFilterOf(one, 'cents'), /the filter held for "cents" is not a value filter/);
  assert.throws(() => moneyFilterOf(one, 'note'), /not a money filter/);
  assert.throws(() => textFilterOf(one, 'city'), /not a text filter/);
  assert.throws(() => valueFilterOf(one, 'stars'), /no filter held for column "stars"/);
  // The words and the bounds.
  assert.equal(containsNeedle('  Pad '), 'pad');
  assert.deepEqual([choiceWords(WORDS.BLANK), choiceWords('Chiang Mai')], ['(blank)', 'Chiang Mai']);
  assert.deepEqual([boundCentsOf(''), boundCentsOf(' 12 '), boundCentsOf('8.5'), boundCentsOf('-3')], [{ ok: true, cents: null }, { ok: true, cents: 1200 }, { ok: true, cents: 850 }, { ok: true, cents: -300 }]);
  assert.deepEqual(boundCentsOf('$12'), { ok: false, words: '"$12" is not dollars — 12, 8.50 or -3' });
  assert.deepEqual([boundDollarsOf(1200), boundDollarsOf(-350), boundDollarsOf(null)], ['12.00', '-3.50', '']);
  // The checklist: every distinct value with its count, in the column's ascending order, the blank last.
  assert.deepEqual(columnValuesOf(ITEMS, SPEC[0]), [{ key: 'Bangkok', count: 1 }, { key: 'Chiang Mai', count: 3 }, { key: WORDS.BLANK, count: 1 }]);
  assert.deepEqual(columnValuesOf(ITEMS, SPEC[1]), [{ key: '$5', count: 1 }, { key: '$22', count: 1 }, { key: '$25', count: 1 }, { key: '$35', count: 1 }, { key: WORDS.BLANK, count: 1 }], 'by cents, not by the words');
});

test('T3b the ledger’s filter functions ARE the idiom’s with its spec: the same answers over the same rows; NO_COLUMN_FILTERS is noFilters(LEDGER_TABLE)', () => {
  assert.deepEqual(noFilters(LEDGER_TABLE), NO_COLUMN_FILTERS, 'the typed map of eighteen (TIME-03) and the spec’s every-filter-off are one value');
  const cases = [
    { ...NO_COLUMN_FILTERS, city: { dropped: ['Bangkok', WORDS.BLANK] } },
    { ...NO_COLUMN_FILTERS, actual: { minCents: 2200, maxCents: 2500, blank: false } },
    { ...NO_COLUMN_FILTERS, book: { dropped: ['Business', WORDS.BLANK] }, actual: { minCents: 1000, maxCents: null, blank: false } },
    { ...NO_COLUMN_FILTERS, description: { contains: ' KHAO ' } },
    { ...NO_COLUMN_FILTERS, match: { minCents: 2200, maxCents: null, blank: false } },
  ];
  for (const filters of cases) {
    assert.deepEqual(rowIds(applyColumnFilters(ROWS, filters)), rowIds(filterRows(ROWS, filters, LEDGER_TABLE)));
    assert.equal(LEDGER.anyColumnFilterOn(filters), anyFilterOn(LEDGER_TABLE, filters));
    for (const c of LEDGER_COLUMNS) assert.equal(LEDGER.columnFilterOn(filters, c), filterOn(filters, c, columnKind(c)));
  }
  assert.deepEqual(rowIds(applyColumnFilters(ROWS, cases[0])), ['e', 'a', 'b'], 'the ledger04 answer');
  for (const c of ['city', 'vendor', 'day', 'stars', 'underOver'] as const) assert.deepEqual(columnValues(ROWS, c), columnValuesOf(ROWS, ledgerColumnOf(c)));
  assert.deepEqual(columnValues(ROWS, 'city'), [{ key: 'Bangkok', count: 1 }, { key: 'Chiang Mai', count: 3 }, { key: WORDS.BLANK, count: 1 }]);
});

// ── T4 · THE SORT, GENERIC ──────────────────────────────────────────────────

test('T4 the sort: ascending, then descending, then the table’s own order; blanks last both ways; numbers by difference, texts by localeCompare with numeric; ties keep the order given; null is a copy; the ledger’s sortRows is the idiom’s with its spec', () => {
  const first = nextSort(null, 'cents');
  assert.deepEqual(first, { column: 'cents', direction: 'asc' });
  const second = nextSort(first, 'cents');
  assert.deepEqual(second, { column: 'cents', direction: 'desc' });
  assert.equal(nextSort(second, 'cents'), null, 'the third click');
  assert.deepEqual(nextSort(second, 'city'), { column: 'city', direction: 'asc' }, 'one column at a time');
  assert.deepEqual(ids(sortRows(ITEMS, { column: 'cents', direction: 'asc' }, SPEC)), ['c', 'a', 'd', 'b', 'e'], '$5 · $22 · $25 · $35 · the blank last');
  assert.deepEqual(ids(sortRows(ITEMS, { column: 'cents', direction: 'desc' }, SPEC)), ['b', 'd', 'a', 'c', 'e'], 'the blank still last');
  assert.deepEqual(ids(sortRows(ITEMS, { column: 'city', direction: 'asc' }, SPEC)), ['d', 'a', 'b', 'e', 'c'], 'Bangkok · Chiang Mai ×3 in the order given · the blank');
  assert.deepEqual(ids(sortRows(ITEMS, { column: 'note', direction: 'desc' }, SPEC)), ['d', 'b', 'e', 'a', 'c'], 'case does not order');
  const own = sortRows(ITEMS, null, SPEC);
  assert.deepEqual(ids(own), ['a', 'b', 'c', 'd', 'e']);
  assert.notEqual(own, ITEMS, 'a copy');
  assert.deepEqual(ids(ITEMS), ['a', 'b', 'c', 'd', 'e'], 'the rows given are not reordered');
  assert.deepEqual(ids(sortRowsBy(ITEMS, 'asc', (r) => numberKey(r.cents))), ['c', 'a', 'd', 'b', 'e']);
  assert.throws(() => sortRows(ITEMS, { column: 'stars' as 'city', direction: 'asc' }, SPEC), /no column "stars"/);
  // The keys.
  assert.deepEqual([numberKey(5), numberKey(null), textKey('x'), textKey(null)], [{ kind: 'number', n: 5 }, null, { kind: 'text', t: 'x' }, null]);
  const P9: SortKey = { kind: 'text', t: 'P-9' };
  const P10: SortKey = { kind: 'text', t: 'P-10' };
  assert.ok(compareSortKeys(P9, P10, 'asc') < 0, 'numeric text: P-9 before P-10');
  assert.ok(compareSortKeys(null, P9, 'asc') > 0 && compareSortKeys(null, P9, 'desc') > 0, 'a blank after, both ways');
  assert.equal(compareSortKeys(null, null, 'asc'), 0);
  // The ledger's: every column, both ways, the same order as the idiom's with LEDGER_TABLE.
  for (const c of LEDGER_COLUMNS) {
    for (const direction of ['asc', 'desc'] as const) {
      assert.deepEqual(rowIds(LEDGER.sortRows(ROWS, { column: c, direction })), rowIds(sortRows(ROWS, { column: c, direction }, LEDGER_TABLE)), `${c} ${direction}`);
    }
  }
  assert.deepEqual(rowIds(LEDGER.sortRows(ROWS, { column: 'actual', direction: 'asc' })), ['c', 'a', 'd', 'b', 'e'], 'the ledger04 answer');
  assert.deepEqual(rowIds(LEDGER.sortRows(ROWS, null)), ['e', 'a', 'b', 'c', 'd']);
  assert.equal(LEDGER.nextSort, nextSort, 'one function');
});

// ── T5 · THE CSV, GENERIC ───────────────────────────────────────────────────

test('T5 the CSV: RFC 4180 minimal quoting (a comma, a quote, a CR or an LF — quotes doubled), money as dollars with two decimals and an ASCII minus, every line CRLF (the last too), no BOM; tableCsv writes the labels then each row’s csv fields; the ledger’s ledgerCsv IS tableCsv over LEDGER_TABLE, byte for byte', () => {
  assert.deepEqual(['a', 'a,b', 'say "hi"', 'two\nlines', 'cr\rhere', ''].map(csvField), ['a', '"a,b"', '"say ""hi"""', '"two\nlines"', '"cr\rhere"', '']);
  assert.deepEqual([csvMoney(1000), csvMoney(898), csvMoney(-102), csvMoney(0), csvMoney(5), csvMoney(null)], ['10.00', '8.98', '-1.02', '0.00', '0.05', '']);
  assert.equal(csvText(['A', 'B'], [['1', 'x,y'], ['', 'z']]), 'A,B\r\n1,"x,y"\r\n,z\r\n');
  assert.equal(csvText(['A'], []), 'A\r\n', 'no rows: the header alone');
  const csv = tableCsv(SPEC, ITEMS);
  assert.ok(!csv.startsWith('﻿'), 'no BOM');
  assert.equal(csv, 'CITY,AMOUNT,NOTE\r\nChiang Mai,22.00,"khao soi, worth it"\r\nChiang Mai,35.00,Pad thai\r\n,5.00,\r\nBangkok,25.00,with Pim\r\nChiang Mai,,"leg ""day""\nline two"\r\n');
  // The ledger's bytes.
  assert.equal(ledgerCsv(ROWS), tableCsv(LEDGER_TABLE, ROWS));
  assert.equal(ledgerCsv([]), `${LEDGER_HEAD_WORDS.join(',')}\r\n`);
  // TIME-03 (Alex, 2026-10-26): Time is LIVE — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; the summary adds up the hours; 4 · 8 · 13 → 5 · 7 · 13. The byte pins MOVE to the new shape — two bare fields after STARS, empty here (null); time03.test.ts proves the
  // DOM and the CSV agree on the eighteen (each column's words and its csv field from the one spec), not identity with the sixteen-column bytes.
  assert.equal(ledgerCsv([BRUNCH]).split('\r\n')[1], 'Tuesday,2026-10-13,Chiang Mai,Thailand 🇹🇭,Personal,P-6150,Dining Out,Brunch,Luka Café,4,,,25.00,22.00,-3.00,22.00,under,"khao soi, worth it"', 'the ledger04 line');
  assert.equal(ledgerCsv([YOGA]).split('\r\n')[1], 'Monday,2026-10-12,,,,,,Yoga,,2,,,,5.00,,,,', 'the ledger02 line — a null is an EMPTY field');
  assert.match(code(RULES), /export function ledgerCsv\(rows: readonly LedgerRow\[\]\): string \{\n\s*return tableCsv\(LEDGER_TABLE, rows\);\n\}/);
});

// ── T6 · THE WORDS ──────────────────────────────────────────────────────────

test('T6 the words: BLANK is the one definition (budget/format.ts), re-exported, never a second "—"; the empty state and every filter, sort and CSV word the ledger re-exports IS the idiom’s (the same binding); no new word', () => {
  assert.equal(WORDS.BLANK, FORMAT_BLANK);
  assert.equal(WORDS.BLANK, '—');
  assert.match(code(TABLE_WORDS), /export \{ BLANK \} from '@\/lib\/budget\/format';/, 'one definition');
  assert.doesNotMatch(code(TABLE_WORDS).replace(/export \{ BLANK \} from '@\/lib\/budget\/format';/, ''), /'—'/, 'no second definition of the null word');
  assert.equal(WORDS.NO_ROWS_SHOWN_WORDS, 'no row matches the filters');
  for (const name of ['NO_ROWS_SHOWN_WORDS', 'ALL_WORDS', 'NONE_WORDS', 'FILTER_OPEN_WORDS', 'FILTER_ON_MARK', 'SORT_MARKS', 'CLEAR_FILTERS_WORDS', 'BLANK_CHOICE_WORDS', 'NARROW_FROM', 'NARROW_WORDS', 'MIN_WORDS', 'MAX_WORDS', 'CONTAINS_WORDS', 'CLOSE_FILTER_WORDS', 'filterLabelWords', 'sortLabelWords', 'boundTypedWords', 'CSV_DOWNLOAD_WORDS', 'CSV_NO_ROWS_WORDS'] as const) {
    assert.equal((LEDGER as Record<string, unknown>)[name], (WORDS as Record<string, unknown>)[name], `${name}: the ledger’s and the idiom’s are one`);
  }
  assert.deepEqual([WORDS.ALL_WORDS, WORDS.NONE_WORDS, WORDS.FILTER_OPEN_WORDS, WORDS.FILTER_ON_MARK, WORDS.CLEAR_FILTERS_WORDS, WORDS.BLANK_CHOICE_WORDS, WORDS.NARROW_FROM, WORDS.NARROW_WORDS, WORDS.MIN_WORDS, WORDS.MAX_WORDS, WORDS.CONTAINS_WORDS, WORDS.CLOSE_FILTER_WORDS, WORDS.CSV_DOWNLOAD_WORDS, WORDS.CSV_NO_ROWS_WORDS],
    ['all', 'none', '▾', '●', 'clear filters', '(blank)', 10, 'type to narrow', 'min $', 'max $', 'contains', 'close', 'download CSV', 'no row shown — nothing to download']);
  assert.deepEqual(WORDS.SORT_MARKS, { asc: '▲', desc: '▼' });
  assert.deepEqual([WORDS.filterLabelWords('CITY'), WORDS.sortLabelWords('ACTUAL'), WORDS.boundTypedWords('$12')], ['filter CITY', 'sort by ACTUAL', '"$12" is not dollars — 12, 8.50 or -3']);
  // dataAttr: the caller's name, the part, the value; undefined is no attribute.
  assert.deepEqual([dataAttr('ledger', 'csv'), dataAttr('journal', 'cell', 'goals'), dataAttr('ledger', 'sort-direction', undefined), dataAttr('ledger', 'filter-on', '')], [{ 'data-ledger-csv': true }, { 'data-journal-cell': 'goals' }, {}, { 'data-ledger-filter-on': '' }], 'a bare attribute is true — React writes data-ledger-csv="true", as the bare JSX attribute did (the DOM proof)');
});

// ── T7 · THE EXTRACTION, PINNED TO SOURCE ───────────────────────────────────

test('T7 the extraction: the five modules are pure; ledger.ts imports the rules from src/lib/table and no longer defines them; the section imports DataTable from src/components/table and the old leaf is gone; the shared files know no ledger; the three Books tables keep their own filter code untouched (ruling C); no route, no migration', () => {
  for (const file of [COLUMNS, FILTERS, SORT, CSV, TABLE_WORDS]) {
    assert.doesNotMatch(code(file), /from 'react'|from 'next|\bfetch\b|document\.|window\.|Blob|localStorage|new Date\(\)|Date\.now\(|@prisma\/client/, `${file} is pure`);
    assert.match(comments(file), /IDIOM-01 \(Alex, 2026-10-24\)/, `${file} names the ruling`);
  }
  assert.doesNotMatch(code(FILTERS) + code(SORT) + code(CSV) + code(COLUMNS) + code(TABLE_WORDS), /operations\/ledger|LedgerRow|LedgerColumn/, 'the idiom knows no ledger');
  const rules = code(RULES);
  for (const imp of ["from '@/lib/table/columns';", "from '@/lib/table/csv';", "from '@/lib/table/filters';", "from '@/lib/table/sort';", "from '@/lib/table/words';"]) assert.ok(rules.includes(imp), `ledger.ts reads ${imp}`);
  for (const gone of ['const csvField', 'const csvMoney', 'const BOUND_RE', 'const compareSortKeys', "export const ALL_WORDS = 'all'", "export const NO_ROWS_SHOWN_WORDS = '", "export const CSV_DOWNLOAD_WORDS = '", 'export function rowPassesFilters(', 'export function columnValues(', 'export function boundCentsOf(', 'export interface ValueFilter', 'export interface LedgerSort']) {
    assert.ok(!rules.includes(gone), `ledger.ts no longer defines ${gone} — it is the idiom’s`);
  }
  assert.match(comments(RULES), /IDIOM-01 \(Alex, 2026-10-24\): THE FILTERS AND THE SORT ARE THE SHARED IDIOM'S/);
  // The screens.
  const section = code(SECTION);
  assert.match(section, /import DataTable, \{ cellClass as cell, chipClass as chip, headClass as head, moneyClass as money \} from '@\/components\/table\/DataTable';/, 'the section renders through DataTable and wears its classes under the names it always used');
  assert.doesNotMatch(section, /<ColumnFilter kind=|from '\.\/ColumnFilter'|filterButtons|useCallback|ledgerCsv\(|headWordOf|columnKind|MONEY_HEAD_WORDS|LEDGER_COLUMNS/, 'the section mounts no popover, holds no ▾ map, writes no CSV, draws no header of its own');
  assert.equal(existsSync(resolve(process.cwd(), OLD_LEAF)), false, 'the ledger’s leaf moved — its one importer moved with it; no re-export left behind');
  assert.match(code(TABLE), /import ColumnFilter from '\.\/ColumnFilter';/);
  assert.match(code(TABLE), /^'use client';/m);
  assert.doesNotMatch(code(TABLE) + code(LEAF) + code(ATTR), /operations\/ledger|workbench\/|data-ledger|LedgerRow|LedgerColumn/, 'the shared table knows no ledger — the name is handed in');
  assert.match(comments(TABLE), /IDIOM-01, Alex, 2026-10-24/);
  assert.match(comments(LEAF), /IDIOM-01, Alex,\s*\n?\s*\*?\s*2026-10-24: moved here from the task ledger's leaf/);
  // DataTable's shape: the controls row, the children, the empty state, the table with the caller's rows and foot, the one popover — in that order.
  const t = code(TABLE);
  for (const prop of ['readonly name: string;', 'readonly columns: readonly TableColumn<Row, Key>[];', 'readonly rows: readonly Row[];', 'readonly shown: readonly Row[];', 'readonly loaded: boolean;', 'readonly tableClassName: string;', 'readonly renderRow: (row: Row) => ReactNode;', 'readonly foot: ReactNode;', 'readonly filters: F;', 'readonly onFilters: (next: F) => void;', 'readonly noFilters: F;', 'readonly sort: TableSort<Key> | null;', 'readonly onSort: (next: TableSort<Key> | null) => void;', 'readonly openFilter: Key | null;', 'readonly onOpenFilter: (column: Key | null) => void;', 'readonly csv: { readonly name: string } | null;', 'readonly controls: ReactNode;', 'readonly trailing?: ReactNode;', 'readonly children?: ReactNode;']) {
    assert.ok(t.includes(prop), `DataTable takes ${prop}`);
  }
  const steps = ["{...dataAttr(name, 'controls')}", '{controls}', "{...dataAttr(name, 'csv')}", "{...dataAttr(name, 'clear-filters')}", "{...dataAttr(name, 'csv-why')}", '{trailing}', '{children}', "{...dataAttr(name, 'none-shown')}", "{...dataAttr(name, 'table')}", '<thead>', '{columns.map((c) => {', '<tbody>', '{shown.map(renderRow)}', '</tbody>', '{foot}', '</table>', '{openFilter !== null && popover(openFilter)}'];
  let at = 0;
  for (const step of steps) { const i = t.indexOf(step, at); assert.notEqual(i, -1, `DataTable renders ${JSON.stringify(step)} after the step before it`); at = i + step.length; }
  // Ruling C: the three Books tables carry their own filter code, untouched by this PR.
  for (const file of BOOKS_TABLES) {
    assert.doesNotMatch(code(file), /components\/table|lib\/table/, `${file} does not read the idiom (a later BOOKS PR)`);
    assert.match(code(file), /ColumnFilterValue|applyColumnFilters/, `${file} keeps its own filter code`);
  }
  // Ruling D: no route change, no migration — the ledger's route and its reads name nothing of the idiom.
  for (const file of ['src/app/api/operations/ledger/route.ts', 'src/components/workbench/operations/ledger/ledgerReads.ts', 'src/components/workbench/operations/ledger/ExpenseForm.tsx', 'src/components/workbench/operations/ledger/LinkPicker.tsx']) {
    assert.doesNotMatch(code(file), /lib\/table|components\/table|DataTable|dataAttr/, `${file} is untouched by the idiom`);
  }
});
