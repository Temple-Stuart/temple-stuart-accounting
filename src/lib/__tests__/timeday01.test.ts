/**
 * TIMEDAY-01 (Alex, 2026-11-24) — THE DAY VIEW IS A DAY.
 *
 * On one day, DAY, DATE, CITY and COUNTRY say the same thing on every row of the time sheet: the day and its place go in the line
 * above the table, and those four columns leave the screen on that view (ledger.ts — DAY_FOLD_COLUMNS, isOneDay, DAY_FOLD_CLASS,
 * dayFoldClass, dayFoldCount, dayPlaceWords; ledger/LedgerSection.tsx reads them on five lines). Week, Month and All draw every
 * column; the CSV holds all twenty-one on every view.
 *
 * HERMETIC — no database, no network, no clock. The rule is DRIVEN directly over rows built in the ledger's own shape; every name,
 * place and amount below is made up. The class is compiled with the repo's own Tailwind config (as timewide01.test.ts compiles the
 * table's class); the rule file and the section are read through the reader with their comments stripped. No pin here names a line
 * number of any file — every pin finds its line by content. The shared table's file is pinned whole by timewide01.test.ts and is
 * not read here.
 *
 * SHEET-01 (Alex, 2026-11-28) — THE DAY VIEW FOLDS NOTHING. The fold is deleted with its block (ledger.ts — a dated note stands where it stood)
 * and with the five lines that read it in the section: every view draws the twenty-five columns, and the place stands on every row in its
 * own three cells. Each test below keeps its number and its title, and is re-pointed to the fold's ABSENCE: it pins that the thing it
 * pinned is gone, and what stands in its place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
import { code, comments, rejoin } from '../sourceText';
import type { PlaceParts } from '../operations/stay';
import { dataAttr } from '@/components/table/dataAttr';
import { BLANK } from '../budget/format';
import * as rule from '../operations/ledger';
import {
  LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, PLANNED_WORD,
  cellWordsOf, ledgerCsv, periodOf, periodWords,
  type LedgerPlanRow, type LedgerRow, type LedgerSheetRow, type Period,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TAILWIND = 'tailwind.config.ts';

/** A whole file, comment and code alike (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));
/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;

// ── THE PERIODS AND THE ROWS — every day, place and name made up ─────────────

const MON = '2027-03-01';
const TUE = '2027-03-02';
const ONE_DAY: Period = { from: TUE, to: TUE };
const WEEK: Period = { from: MON, to: '2027-03-07' };
const MONTH: Period = { from: MON, to: '2027-03-31' };
void WEEK; void MONTH; // SHEET-01 (2026-11-28): the periods the fold was read over — kept, every view the same now

const NORTHPORT: PlaceParts = { city: 'Northport', region: null, country: 'Freedonia' };
const NORTHPORT_ALONE: PlaceParts = { city: 'Northport', region: null, country: null };
const SOUTHGATE: PlaceParts = { city: 'Southgate', region: null, country: 'Freedonia' };
const NORTHPORT_ELSEWHERE: PlaceParts = { city: 'Northport', region: null, country: 'Ruritania' };

/** A recorded row in the ledger's own shape (timesheet01.test.ts's builder) — the day and the place are what each case sets. COALEVELS-01 (2026-11-27): either builder's row says its location (none) and its segments — its entity's letter and its account's code. */
const recorded = (id: string, day: string, place: PlaceParts | null): LedgerRow => ({
  id, key: `routine:${id}:${day}T03:00:00.000Z`, address: { kind: 'routine', id, instant: `${day}T03:00:00.000Z` }, match: null, day, time: '11:00',
  place, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Oat House', instagramTag: null, description: 'Porridge', rating: 4, note: 'with fruit', notes: null, // TIMESHEET-04b (2026-11-27): the row's two new fields — no tag, no notes
  cents: 650, budgetState: 'matched', outcome: 'done', actualCents: 690, varianceCents: 40, plannedMinutes: 30, loggedMinutes: 25,
});
/** A plan row — a priced line with no record on it. */
const planned = (id: string, day: string, place: PlaceParts | null): LedgerPlanRow => ({
  id: null, key: `routine:${id}:${day}T12:00:00.000Z`, address: { kind: 'routine', id, instant: `${day}T12:00:00.000Z` }, match: null, day, time: '20:00',
  place, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Recreation' }, vendor: null, instagramTag: null, description: 'Climbing', rating: null, note: null, plannedItems: null, notes: null, // TIMESHEET-04b (2026-11-27): a plan row's three new fields — no tag, nothing planned to be had, and no notes (a row with no record has none)
  cents: 1800, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 90, loggedMinutes: null, allDay: false, went: PLANNED_WORD,
});

// ── T1 · THE FIVE COLUMNS (ruling A.1) — SHEET-01: none folds ────────────────

/** The five TIMEDAY-01 folded on one day — keys of LEDGER_COLUMNS; drawn on every view now. */
const FIVE = ['day', 'date', 'city', 'region', 'country'] as const;
/** A row's place, its three cells. */
const placeOf = (row: LedgerSheetRow): readonly string[] => [cellWordsOf(row, 'city'), cellWordsOf(row, 'region'), cellWordsOf(row, 'country')];

test('T1 DAY_FOLD_COLUMNS are LEDGER_COLUMNS’ own keys, in its order, all before BUDGET — DAY, DATE, CITY, REGION and COUNTRY (COALEVELS-01: five), typed as keys and never as head words — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: no column folds — the five are LEDGER_COLUMNS’ own keys, drawn on every view, and no fold list is exported or typed', () => {
  assert.equal('DAY_FOLD_COLUMNS' in rule, false, 'no fold list exported');
  assert.doesNotMatch(code(RULES), /\bDAY_FOLD_COLUMNS\b/, 'nor typed in the rule file');
  const places = FIVE.map((key) => LEDGER_COLUMNS.indexOf(key));
  assert.ok(places.every((at) => at >= 0), 'each is a column of the sheet — of every view');
  assert.deepEqual([...places].sort((a, b) => a - b), places, 'in the sheet’s own order');
  assert.deepEqual(FIVE.map((key) => LEDGER_HEAD_WORDS[LEDGER_COLUMNS.indexOf(key)]), ['DAY', 'DATE', 'CITY', 'REGION', 'COUNTRY'], 'the heads they stand under');
  for (const key of FIVE) assert.deepEqual(dataAttr('ledger', 'sort', key), { 'data-ledger-sort': key }, `${key}: the head's sort button carries the key, as every head's does`);
});

// ── T2 · ONE DAY (ruling A.2) — SHEET-01: nothing asks ───────────────────────

test('T2 isOneDay: a period whose from is its to, whatever chip it was reached by, and no other; no period is not one — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: nothing asks whether a period is one day — the rule file and the section hold no such test; the periods are what they were', () => {
  assert.equal('isOneDay' in rule, false);
  assert.doesNotMatch(code(RULES), /\bisOneDay\b/);
  assert.doesNotMatch(code(SECTION), /\bisOneDay\b|period\.from === period\.to/);
  const day = periodOf('day', TUE, TUE, null);
  assert.ok(day !== null && day.from === TUE && day.to === TUE, 'Day is one day, as it was');
  const week = periodOf('week', TUE, TUE, null);
  assert.ok(week !== null && week.from !== week.to, 'a week is not');
  const all = periodOf('all', TUE, TUE, TUE);
  assert.ok(all !== null && all.from === TUE && all.to === TUE, 'reached by ALL: from the first record’s day to today, the same day');
  assert.equal(periodOf('all', TUE, TUE, null), null, 'nothing recorded: no period');
});

// ── T3 · THE CLASS, TYPED (ruling A.3) — SHEET-01: typed nowhere ─────────────

const FOLD_LITERAL = '[&_th:has([data-ledger-sort=day])]:hidden [&_th:has([data-ledger-sort=date])]:hidden [&_th:has([data-ledger-sort=city])]:hidden [&_th:has([data-ledger-sort=region])]:hidden [&_th:has([data-ledger-sort=country])]:hidden [&_td[data-ledger-cell=day]]:hidden [&_td[data-ledger-cell=date]]:hidden [&_td[data-ledger-cell=city]]:hidden [&_td[data-ledger-cell=region]]:hidden [&_td[data-ledger-cell=country]]:hidden'; // COALEVELS-01 (2026-11-27): ten variants — region's head cell and its body cell joined the eight

test('T3 DAY_FOLD_CLASS is the whole literal, typed once on one line — ten classes (COALEVELS-01; eight until then), a head cell and a body cell for each folded column; tailwind scans the file — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: the class is typed nowhere — not in the rule file, not in the section; no variant takes a head or a cell of the sheet off the screen', () => {
  assert.equal('DAY_FOLD_CLASS' in rule, false);
  for (const file of [RULES, SECTION]) {
    assert.equal(code(file).includes(FOLD_LITERAL), false, `${file} types the fold no more`);
    assert.doesNotMatch(code(file), /\bDAY_FOLD_CLASS\b|:hidden/, `${file}: no class that takes a column off the screen`);
  }
  assert.ok(code(TAILWIND).includes('"./src/lib/**/*.{js,ts,jsx,tsx,mdx}"'), 'tailwind still scans src/lib — nothing typed there hides a column');
});

// ── T4 · WHAT THE CLASS COMPILES TO (ruling A.3) — SHEET-01: nothing hidden ──

test('T4 compiled with the repo’s own Tailwind config, the class is ten rules (COALEVELS-01; eight until then), each `display: none`, a class and an element each — five on th:has([data-ledger-sort=<key>]) and five on td[data-ledger-cell=<key>], one per folded column — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: compiled with the repo’s own Tailwind config, the section’s own class takes nothing off the screen — no rule reaches a head or a cell, none is display: none', async () => {
  const own = /<section className="([^"]+)" data-ledger>/.exec(code(SECTION));
  assert.ok(own !== null, 'the section’s class is a plain literal');
  const built = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: own[1], extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  assert.ok(built.css.length > 0, 'the class compiles');
  assert.doesNotMatch(built.css, /display:\s*none/, 'nothing taken off the screen');
  assert.doesNotMatch(built.css, /data-ledger-sort|data-ledger-cell/, 'no rule reaches a head or a body cell');
});

// ── T5 · THE ELEMENT'S CLASS (ruling A.4) — SHEET-01: its own alone ──────────

test('T5 dayFoldClass: the own class alone for no period and for a week; on one day the own class, one space, DAY_FOLD_CLASS — never a trailing space — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: the section’s class is its own alone, on every view — a plain literal, handed no period', () => {
  assert.equal('dayFoldClass' in rule, false);
  const s = code(SECTION);
  assert.ok(s.includes('\n    <section className="space-y-1.5 [&_div:has(>[data-ledger-table])]:max-h-[calc(100vh-8rem)] [&_div:has(>[data-ledger-table])]:overflow-y-auto" data-ledger>\n'));
  assert.equal(countOf(s, /<section\b/g), 1);
  assert.doesNotMatch(s, /\bdayFoldClass\b/);
});

// ── T6 · THE COUNT (ruling A.5) — SHEET-01: nothing counted off ──────────────

test('T6 dayFoldCount: 0 for no period and for a week, DAY_FOLD_COLUMNS.length on one day — so 25 and 20 columns are shown and the TOTAL’s label spans 19 and 14 (COALEVELS-01; 23 and 19, 16 and 12 until then), worked from LEDGER_COLUMNS — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: nothing is counted off — the rows beneath a row span every column, and the TOTAL’s label the sixteen before PLANNED MIN, worked from LEDGER_COLUMNS, on every view', () => {
  assert.equal('dayFoldCount' in rule, false);
  const s = code(SECTION);
  assert.doesNotMatch(s, /\bdayFoldCount\b/);
  assert.equal(countOf(s, /<td colSpan=\{LEDGER_COLUMNS\.length\} className=\{cell\}>/g), 2, 'the picker’s row and the record’s row span every column');
  assert.ok(s.includes("<th scope=\"row\" colSpan={LEDGER_COLUMNS.indexOf('plannedMinutes')} className={`${cell} text-left`}>{TOTAL_WORDS}</th>"));
  assert.equal(countOf(s, /colSpan=/g), 3, 'the three spans, and no other');
  assert.deepEqual([LEDGER_COLUMNS.length, LEDGER_COLUMNS.indexOf('plannedMinutes')], [25, 16]);
  // The TOTAL row adds up to the columns: the label, then its cells — the two minutes, COA's, and the six.
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.equal(LEDGER_COLUMNS.indexOf('plannedMinutes') + countOf(tfoot, /<td\b/g), LEDGER_COLUMNS.length);
  assert.equal(LEDGER_HEAD_WORDS.length, LEDGER_COLUMNS.length);
});

// ── T7, T8 · THE DAY'S PLACE (ruling A.6) — SHEET-01: on every row ───────────

test('T7 dayPlaceWords: one place on every row of the day → "· City, Country"; a stay that names no country → "· City"; a recorded row and a plan row are read alike — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: the place stands on every row, in its own three cells — a recorded row and a plan row alike; a stay that names no country leaves that cell blank', () => {
  assert.equal('dayPlaceWords' in rule, false);
  for (const row of [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT), recorded('print', TUE, NORTHPORT)]) assert.deepEqual(placeOf(row), ['Northport', BLANK, 'Freedonia']);
  assert.deepEqual(placeOf(planned('climbing', TUE, NORTHPORT_ALONE)), ['Northport', BLANK, BLANK]);
  assert.deepEqual(placeOf({ ...recorded('porridge', TUE, { city: 'Northport', region: null, country: 'Freedonia' }) }), ['Northport', BLANK, 'Freedonia'], 'by its words, not by the object');
  // The period's own words stand alone above the table.
  assert.equal(periodWords(ONE_DAY), 'Tue Mar 2');
});

test('T8 dayPlaceWords says nothing unless every row of the day holds one same place: no row, a row with no place, two cities, one city with two countries, a week, no period → null; a row of another day is never read — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: the section prints no line of the day’s place — each row says its own: a row no stay covers blank, two rows of two places each their own, a row of another day its own', () => {
  const s = code(SECTION);
  assert.doesNotMatch(s, /data-ledger-day-place|dayPlaceWords/, 'no place line above the table');
  const PERIOD_SPAN = '{period !== null && <span className="font-semibold text-text-secondary" data-ledger-period-words>{periodWords(period)}</span>}';
  assert.ok(s.includes(`\n            ${PERIOD_SPAN}\n          </>\n        )}\n        trailing={(`), 'the period’s words, the last thing in the controls');
  assert.deepEqual(placeOf(recorded('porridge', TUE, null)), [BLANK, BLANK, BLANK], 'a day no stay covers');
  assert.deepEqual([placeOf(recorded('porridge', TUE, NORTHPORT)), placeOf(planned('climbing', TUE, SOUTHGATE))], [['Northport', BLANK, 'Freedonia'], ['Southgate', BLANK, 'Freedonia']]);
  assert.deepEqual(placeOf(planned('ferry', MON, NORTHPORT_ELSEWHERE)), ['Northport', BLANK, 'Ruritania']);
});

// ── T9 · WHERE THE BLOCK STOOD (ruling A) — SHEET-01: a note ─────────────────

test('T9 the new block stands between the picker’s words and the table’s class block: six exports in the ruled order, its code naming no table class, pure — and the file’s last line is what it was — SHEET-01 (Alex, 2026-11-28): re-pointed to its absence: the block is deleted — a dated note stands where it stood, under the picker’s words and above the table’s class block; none of its six names is exported or typed; the table’s class is still the last line', () => {
  const all = whole(RULES).replace(/\n$/, '').split('\n');
  assert.equal(all.length, linesOf(RULES).length, 'the reader keeps every line in its place');
  assert.equal(all.filter((line) => line.startsWith('// ── TIMEDAY-01')).length, 0, 'no heading — the block is gone');
  const note = all.findIndex((line) => line.startsWith('// SHEET-01 (Alex, 2026-11-28): THE DAY VIEW FOLDS NOTHING — the TIMEDAY-01 block stood here'));
  const to = all.findIndex((line) => line.startsWith('// ── TIMEWIDE-01 (Alex, 2026-11-24): '));
  assert.ok(note > 0 && to > note, 'the note, above the table’s class block');
  assert.match(all[note - 2], /^export const postingDateWords = /);
  assert.equal(all[note - 1], '');
  for (const name of ['DAY_FOLD_COLUMNS', 'isOneDay', 'DAY_FOLD_CLASS', 'dayFoldClass', 'dayFoldCount', 'dayPlaceWords']) {
    assert.equal(name in rule, false, `${name} is no export`);
    assert.doesNotMatch(code(RULES), new RegExp(`\\b${name}\\b`), `${name} is typed nowhere in the rule file’s code`);
  }
  assert.match(all.at(-1) ?? '', /^export const LEDGER_TABLE_CLASS = '/);
  assert.match(linesOf(RULES).filter((line) => /^export /.test(line)).at(-1) ?? '', /^export const LEDGER_TABLE_CLASS = '/);
});

// ── T10 · THE SECTION (ruling B) — SHEET-01: reads no fold ───────────────────

const kebab = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

test('T10 the section: the five lines as ruled and the three names on one import line; the mount untouched; the twenty-five cells of a row (COALEVELS-01; twenty-three until then) still drawn, in order; 488 lines — SHEET-01 (Alex, 2026-11-28): re-pointed: the section reads none of the fold’s names and prints no place line; the mount untouched; the twenty-five cells of a row drawn, in order, on every view; 432 lines', () => {
  const s = code(SECTION);
  assert.equal(linesOf(SECTION).length, 432, 'SHEET-01 (2026-11-28): 432 — the notes, the summary and the fold are gone, the TOTAL row sums the minutes; 488 until then');
  assert.doesNotMatch(s, /dayFoldClass|dayFoldCount|dayPlaceWords|isOneDay|DAY_FOLD|:hidden|data-ledger-day-place/, 'no fold, no class, no place line');
  assert.match(s, /const rows: readonly LedgerSheetRow\[\] = answer !== null && answer\.read\.ok \? answer\.read\.value\.sheet : \[\];/);
  // THE MOUNT: the shared table is handed every column on every view — its CSV is built from them.
  assert.match(s, /<DataTable\n\s*name="ledger"\n\s*columns=\{LEDGER_TABLE\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n/);
  const row = s.slice(s.indexOf('data-ledger-row={row.key}'), s.indexOf('{picking === row.key && ('));
  const cells = [...row.matchAll(/<td className=\{[^\n]*? data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(cells, LEDGER_COLUMNS.map(kebab));
  assert.equal(countOf(row, /<td\b/g), 25, 'no cell is left out for a view');
  assert.doesNotMatch(row, /dayFold|isOneDay|period\b/, 'a row is drawn the same whatever the period');
});

// ── T11 · THE CSV (ruling B) — SHEET-01: the file and the screen agree ───────

test('T11 ledgerCsv for a one-day fixture has the twenty-five head words and twenty-five fields a row (COALEVELS-01; twenty-three until then), the five folded columns among them — the fold is on the screen only — SHEET-01 (Alex, 2026-11-28): re-pointed: the file and the screen hold the same twenty-five columns — the five among them, on a day as on any', () => {
  const rows: readonly LedgerSheetRow[] = [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT)];
  const csv = ledgerCsv(rows);
  const lines = csv.split('\r\n');
  assert.equal(lines.at(-1), '', 'every line ends CRLF, the last one too');
  assert.equal(lines.length, 4, 'the head, the two rows, and the end');
  assert.equal(lines[0], LEDGER_HEAD_WORDS.join(','));
  assert.equal(lines[0].split(',').length, 25);
  for (const [i, sheetRow] of rows.entries()) {
    const fields = lines[i + 1].split(',');
    assert.equal(fields.length, 25, 'no field of this fixture holds a comma');
    for (const key of FIVE) assert.equal(fields[LEDGER_COLUMNS.indexOf(key)], LEDGER_CSV[key](sheetRow), `${key}: the cell's own word`);
  }
  assert.deepEqual(FIVE.map((key) => lines[1].split(',')[LEDGER_COLUMNS.indexOf(key)]), ['Tuesday', TUE, 'Northport', '', 'Freedonia']);
  // The screen draws them too: the section types no fold.
  assert.doesNotMatch(code(SECTION), /dayFold|DAY_FOLD/);
  assert.equal(ledgerCsv.length, 1);
  assert.equal(ledgerCsv(rows), csv);
});
