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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
import { code, comments, rejoin } from '../sourceText';
import type { PlaceParts } from '../operations/stay';
import { dataAttr } from '@/components/table/dataAttr';
import {
  DAY_FOLD_CLASS, DAY_FOLD_COLUMNS, LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, PLANNED_WORD,
  dayFoldClass, dayFoldCount, dayPlaceWords, isOneDay, ledgerCsv, periodOf, periodWords,
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

const NORTHPORT: PlaceParts = { city: 'Northport', country: 'Freedonia' };
const NORTHPORT_ALONE: PlaceParts = { city: 'Northport', country: null };
const SOUTHGATE: PlaceParts = { city: 'Southgate', country: 'Freedonia' };
const NORTHPORT_ELSEWHERE: PlaceParts = { city: 'Northport', country: 'Ruritania' };

/** A recorded row in the ledger's own shape (timesheet01.test.ts's builder) — the day and the place are what each case sets. */
const recorded = (id: string, day: string, place: PlaceParts | null): LedgerRow => ({
  id, key: `routine:${id}:${day}T03:00:00.000Z`, address: { kind: 'routine', id, instant: `${day}T03:00:00.000Z` }, match: null, day, time: '11:00',
  place, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Oat House', instagramTag: null, description: 'Porridge', rating: 4, note: 'with fruit', notes: null, // TIMESHEET-04b (2026-11-27): the row's two new fields — no tag, no notes
  cents: 650, budgetState: 'matched', outcome: 'done', actualCents: 690, varianceCents: 40, plannedMinutes: 30, loggedMinutes: 25,
});
/** A plan row — a priced line with no record on it. */
const planned = (id: string, day: string, place: PlaceParts | null): LedgerPlanRow => ({
  id: null, key: `routine:${id}:${day}T12:00:00.000Z`, address: { kind: 'routine', id, instant: `${day}T12:00:00.000Z` }, match: null, day, time: '20:00',
  place, book: 'Personal', coa: { account: 'P-6200', name: 'Recreation' }, vendor: null, instagramTag: null, description: 'Climbing', rating: null, note: null, plannedItems: null, notes: null, // TIMESHEET-04b (2026-11-27): a plan row's three new fields — no tag, nothing planned to be had, and no notes (a row with no record has none)
  cents: 1800, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 90, loggedMinutes: null, allDay: false, went: PLANNED_WORD,
});

// ── T1 · THE FOUR COLUMNS (ruling A.1) ───────────────────────────────────────

test('T1 DAY_FOLD_COLUMNS are LEDGER_COLUMNS’ own keys, in its order, all before BUDGET — DAY, DATE, CITY and COUNTRY, typed as keys and never as head words', () => {
  assert.deepEqual([...DAY_FOLD_COLUMNS], ['day', 'date', 'city', 'country']);
  const places = DAY_FOLD_COLUMNS.map((key) => LEDGER_COLUMNS.indexOf(key));
  assert.ok(places.every((at) => at >= 0), 'each is a key of the sheet');
  assert.deepEqual([...places].sort((a, b) => a - b), places, 'in the sheet’s own order');
  assert.equal(new Set(DAY_FOLD_COLUMNS).size, DAY_FOLD_COLUMNS.length, 'none twice');
  assert.deepEqual(DAY_FOLD_COLUMNS.map((key) => LEDGER_HEAD_WORDS[LEDGER_COLUMNS.indexOf(key)]), ['DAY', 'DATE', 'CITY', 'COUNTRY'], 'the heads they stand under');
  assert.ok(places.every((at) => at < LEDGER_COLUMNS.indexOf('budget')), 'all four sit before BUDGET — so the TOTAL’s label loses all four');
  // In the source: the list is typed as keys of the sheet.
  assert.ok(code(RULES).includes("export const DAY_FOLD_COLUMNS: readonly LedgerColumn[] = ['day', 'date', 'city', 'country'];"));
  // Each key is the word its cell and its head carry in the document — what the class finds them by.
  for (const key of DAY_FOLD_COLUMNS) {
    assert.match(key, /^[a-z]+$/, `${key}: one lower-case word — the cell's own attribute word`);
    assert.deepEqual(dataAttr('ledger', 'sort', key), { 'data-ledger-sort': key }, `${key}: the head's sort button carries the key`);
  }
});

// ── T2 · ONE DAY (ruling A.2) ────────────────────────────────────────────────

test('T2 isOneDay: a period whose from is its to, whatever chip it was reached by, and no other; no period is not one', () => {
  assert.equal(isOneDay(ONE_DAY), true);
  assert.equal(isOneDay(WEEK), false);
  assert.equal(isOneDay(MONTH), false);
  assert.equal(isOneDay({ from: MON, to: TUE }), false, 'two days are not one');
  assert.equal(isOneDay(null), false);
  // By the chip: Day is one day; a week and a month are not; ALL is one day when the first record's day is today.
  assert.equal(isOneDay(periodOf('day', TUE, TUE, null)), true);
  assert.equal(isOneDay(periodOf('week', TUE, TUE, null)), false);
  assert.equal(isOneDay(periodOf('month', TUE, TUE, null)), false);
  assert.equal(isOneDay(periodOf('all', TUE, TUE, TUE)), true, 'reached by ALL: from the first record’s day to today, the same day');
  assert.equal(isOneDay(periodOf('all', TUE, TUE, MON)), false);
  assert.equal(isOneDay(periodOf('all', TUE, TUE, null)), false, 'nothing recorded: no period');
  assert.ok(code(RULES).includes('export const isOneDay = (period: Period | null): boolean => period !== null && period.from === period.to;'));
});

// ── T3 · THE CLASS, TYPED (ruling A.3) ───────────────────────────────────────

const FOLD_LITERAL = '[&_th:has([data-ledger-sort=day])]:hidden [&_th:has([data-ledger-sort=date])]:hidden [&_th:has([data-ledger-sort=city])]:hidden [&_th:has([data-ledger-sort=country])]:hidden [&_td[data-ledger-cell=day]]:hidden [&_td[data-ledger-cell=date]]:hidden [&_td[data-ledger-cell=city]]:hidden [&_td[data-ledger-cell=country]]:hidden';

test('T3 DAY_FOLD_CLASS is the whole literal, typed once on one line — eight classes, a head cell and a body cell for each folded column; tailwind scans the file', () => {
  assert.equal(DAY_FOLD_CLASS, FOLD_LITERAL);
  const rules = code(RULES);
  assert.equal(rules.split(`export const DAY_FOLD_CLASS = '${FOLD_LITERAL}';`).length - 1, 1, 'typed once, whole, on one line');
  assert.equal(rules.split('\n').filter((line) => line.startsWith('export const DAY_FOLD_CLASS = ')).length, 1);
  assert.equal(countOf(rules, /\bDAY_FOLD_CLASS\b/g), 2, 'typed once, and read once — by dayFoldClass');
  // Eight classes: for each folded column, its head cell, then its body cell — in the columns' own order.
  const classes = DAY_FOLD_CLASS.split(' ');
  assert.deepEqual(classes, [...DAY_FOLD_COLUMNS.map((key) => `[&_th:has([data-ledger-sort=${key}])]:hidden`), ...DAY_FOLD_COLUMNS.map((key) => `[&_td[data-ledger-cell=${key}]]:hidden`)]);
  assert.equal(new Set(classes).size, 2 * DAY_FOLD_COLUMNS.length, 'each once');
  assert.doesNotMatch(DAY_FOLD_CLASS, /^\s|\s$|\s\s/, 'single spaces, none at either end');
  // Typed whole where tailwind reads whole class strings: a plain string literal, nothing joined.
  assert.doesNotMatch(rules, /DAY_FOLD_CLASS = (?!')/);
  assert.ok(code(TAILWIND).includes('"./src/lib/**/*.{js,ts,jsx,tsx,mdx}"'), 'tailwind scans src/lib — a class typed in the rule file is compiled');
});

// ── T4 · WHAT THE CLASS COMPILES TO (ruling A.3) ─────────────────────────────

test('T4 compiled with the repo’s own Tailwind config, the class is eight rules, each `display: none`, a class and an element each — four on th:has([data-ledger-sort=<key>]) and four on td[data-ledger-cell=<key>], one per folded column', async () => {
  const built = await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: DAY_FOLD_CLASS, extension: 'html' }] })]).process('@tailwind utilities;', { from: undefined });
  const compiled = [...built.css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].replace(/\s+/g, ' ').trim(), body: m[2].replace(/\s+/g, ' ').trim() }));
  assert.equal(compiled.length, 2 * DAY_FOLD_COLUMNS.length, 'eight rules — every class compiled, none a silent no-op');
  for (const rule of compiled) assert.equal(rule.body, 'display: none', rule.selector);
  // Each selector is ONE class and then ONE element: it works from any element above the table.
  const targets = compiled.map((rule) => {
    const m = /^\.\S+ (th:has\(\[data-ledger-sort=[a-z]+\]\)|td\[data-ledger-cell=[a-z]+\])$/.exec(rule.selector);
    if (m === null) return assert.fail(`${rule.selector} is a class and an element`);
    return m[1];
  });
  assert.deepEqual([...targets].sort(), [...DAY_FOLD_COLUMNS.map((key) => `td[data-ledger-cell=${key}]`), ...DAY_FOLD_COLUMNS.map((key) => `th:has([data-ledger-sort=${key}])`)].sort());
  assert.equal(targets.filter((target) => target.startsWith('th:has(')).length, DAY_FOLD_COLUMNS.length, 'four head cells');
  assert.equal(targets.filter((target) => target.startsWith('td[')).length, DAY_FOLD_COLUMNS.length, 'four body cells');
  // No rule reaches any other column: every target names a folded key, and nothing else is hidden.
  assert.doesNotMatch(built.css, /visibility|opacity|position|width|height/, 'taken off the screen by display alone');
});

// ── T5 · THE ELEMENT'S CLASS (ruling A.4) ────────────────────────────────────

test('T5 dayFoldClass: the own class alone for no period and for a week; on one day the own class, one space, DAY_FOLD_CLASS — never a trailing space', () => {
  assert.equal(dayFoldClass('space-y-3', null), 'space-y-3');
  assert.equal(dayFoldClass('space-y-3', WEEK), 'space-y-3');
  assert.equal(dayFoldClass('space-y-3', MONTH), 'space-y-3');
  assert.equal(dayFoldClass('space-y-3', ONE_DAY), `space-y-3 ${DAY_FOLD_CLASS}`);
  assert.equal(dayFoldClass('space-y-3', ONE_DAY), `space-y-3 ${FOLD_LITERAL}`, 'the whole string, as the element gets it');
  for (const period of [null, WEEK, MONTH, ONE_DAY]) assert.doesNotMatch(dayFoldClass('space-y-3', period), /\s$|\s\s/, 'no trailing space, no doubled one');
  // The own class is handed in and comes back first, whatever it is.
  assert.equal(dayFoldClass('flex gap-2', ONE_DAY).split(' ').slice(0, 2).join(' '), 'flex gap-2');
  assert.equal(dayFoldClass('flex gap-2', WEEK), 'flex gap-2');
  assert.ok(code(RULES).includes('export const dayFoldClass = (own: string, period: Period | null): string => (isOneDay(period) ? `${own} ${DAY_FOLD_CLASS}` : own);'));
});

// ── T6 · THE COUNT (ruling A.5) ──────────────────────────────────────────────

test('T6 dayFoldCount: 0 for no period and for a week, DAY_FOLD_COLUMNS.length on one day — so 23 and 19 columns are shown and the TOTAL’s label spans 16 and 12, worked from LEDGER_COLUMNS', () => {
  assert.equal(dayFoldCount(null), 0);
  assert.equal(dayFoldCount(WEEK), 0);
  assert.equal(dayFoldCount(MONTH), 0);
  assert.equal(dayFoldCount(ONE_DAY), DAY_FOLD_COLUMNS.length);
  // The columns shown: every one, less the folded.
  const shown = (period: Period | null): number => LEDGER_COLUMNS.length - dayFoldCount(period);
  assert.deepEqual([shown(null), shown(WEEK), shown(MONTH), shown(ONE_DAY)], [23, 23, 23, 19]); // TIMESHEET-04b (2026-11-27): twenty-three columns, nineteen on one day — [21, 21, 21, 17] until then
  assert.equal(LEDGER_HEAD_WORDS.length, LEDGER_COLUMNS.length, 'the section spans the rows beneath by the head words’ count — the same count');
  // The TOTAL's label spans the columns before BUDGET: sixteen (TIMESHEET-04b, 2026-11-27 — INSTAGRAM TAG among them; fifteen until then), less the folded — all of which sit before BUDGET (T1).
  const beforeBudget = LEDGER_COLUMNS.indexOf('budget');
  assert.equal(beforeBudget, 16, 'the sixteen the section types'); // TIMESHEET-04b (2026-11-27): INSTAGRAM TAG sits before BUDGET, after VENDOR — 15 until then
  assert.deepEqual([beforeBudget - dayFoldCount(WEEK), beforeBudget - dayFoldCount(ONE_DAY)], [16, 12]); // TIMESHEET-04b (2026-11-27): [15, 11] until then
  assert.equal(DAY_FOLD_COLUMNS.filter((key) => LEDGER_COLUMNS.indexOf(key) < beforeBudget).length, dayFoldCount(ONE_DAY), 'the label loses exactly the folded columns before it');
  // The cells after the label are the same on every view: the TOTAL row still adds up to the columns shown. TIMESHEET-04b (2026-11-27): seven — one more, under NOTES; the six they were until then.
  assert.equal(LEDGER_COLUMNS.length - beforeBudget, 7);
  assert.deepEqual([(beforeBudget - dayFoldCount(WEEK)) + 7, (beforeBudget - dayFoldCount(ONE_DAY)) + 7], [shown(WEEK), shown(ONE_DAY)]);
  // Never typed as a number: the count is the list's length.
  assert.ok(code(RULES).includes('export const dayFoldCount = (period: Period | null): number => (isOneDay(period) ? DAY_FOLD_COLUMNS.length : 0);'));
});

// ── T7 · THE DAY'S PLACE (ruling A.6) ────────────────────────────────────────

test('T7 dayPlaceWords: one place on every row of the day → "· City, Country"; a stay that names no country → "· City"; a recorded row and a plan row are read alike', () => {
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT)]), '· Northport, Freedonia');
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT), recorded('print', TUE, NORTHPORT)]), '· Northport, Freedonia');
  assert.equal(dayPlaceWords(ONE_DAY, [planned('climbing', TUE, NORTHPORT)]), '· Northport, Freedonia', 'a day of planned rows alone');
  // No country: the city alone — a null country is a value, and every row holds it.
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT_ALONE), planned('climbing', TUE, NORTHPORT_ALONE)]), '· Northport');
  // The place is equal by its words, not by the object: two rows built apart agree.
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, { city: 'Northport', country: 'Freedonia' }), planned('climbing', TUE, { city: 'Northport', country: 'Freedonia' })]), '· Northport, Freedonia');
  // Beside the period's own words it reads as the line above the table.
  assert.equal(`${periodWords(ONE_DAY)} ${dayPlaceWords(ONE_DAY, [planned('climbing', TUE, NORTHPORT)])}`, 'Tue Mar 2 · Northport, Freedonia');
  // It changes nothing it is handed.
  const rows: readonly LedgerSheetRow[] = Object.freeze([Object.freeze(recorded('porridge', TUE, NORTHPORT))]);
  assert.equal(dayPlaceWords(Object.freeze({ ...ONE_DAY }), rows), '· Northport, Freedonia');
});

test('T8 dayPlaceWords says nothing unless every row of the day holds one same place: no row, a row with no place, two cities, one city with two countries, a week, no period → null; a row of another day is never read', () => {
  // No row of the day.
  assert.equal(dayPlaceWords(ONE_DAY, []), null);
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', MON, NORTHPORT)]), null, 'the only row is another day’s — the answer of the period before, still in hand');
  // A row with no place — a day no stay covers — even beside rows that have one.
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, null)]), null);
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, null)]), null);
  assert.equal(dayPlaceWords(ONE_DAY, [planned('climbing', TUE, null), recorded('porridge', TUE, NORTHPORT)]), null, 'whichever comes first');
  // Two rows that differ: two cities; one city with two countries; a country and none.
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, SOUTHGATE)]), null);
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT_ELSEWHERE)]), null);
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT_ALONE)]), null, 'a null country is a value: it differs from a named one');
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('porridge', TUE, NORTHPORT_ALONE), planned('climbing', TUE, NORTHPORT)]), null);
  // A period that is not one day, and no period — whatever the rows hold.
  const agreeing = [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT)];
  assert.equal(dayPlaceWords(WEEK, agreeing), null);
  assert.equal(dayPlaceWords(MONTH, agreeing), null);
  assert.equal(dayPlaceWords(null, agreeing), null);
  // A row of another day is not read: it neither gives the day a place nor takes one away.
  assert.equal(dayPlaceWords(ONE_DAY, [recorded('ferry', MON, SOUTHGATE), ...agreeing, planned('print', '2027-03-03', null)]), '· Northport, Freedonia');
  assert.equal(dayPlaceWords({ from: MON, to: MON }, [recorded('ferry', MON, SOUTHGATE), ...agreeing]), '· Southgate, Freedonia', 'each day reads its own rows');
  // In the source: the day's rows alone, and nothing stands in for a missing place.
  const body = code(RULES).slice(code(RULES).indexOf('export function dayPlaceWords('));
  assert.match(body, /^export function dayPlaceWords\(period: Period \| null, rows: readonly LedgerSheetRow\[\]\): string \| null \{\n\s*if \(period === null \|\| !isOneDay\(period\)\) return null;\n\s*const ofDay = rows\.filter\(\(row\) => row\.day === period\.from\);\n\s*if \(ofDay\.length === 0\) return null;/);
  const own = body.slice(0, body.indexOf('\n}\n'));
  assert.doesNotMatch(own, /\?\?|\|\| ['"`]|BLANK|—/, 'no word stands in for a place that is not there');
  assert.equal(countOf(own, /return null;/g), 4, 'no period or not one day · no row · no place · rows that differ');
});

// ── T9 · WHERE THE BLOCK STANDS (ruling A) ───────────────────────────────────

test('T9 the new block stands between the picker’s words and the table’s class block: six exports in the ruled order, its code naming no table class, pure — and the file’s last line is what it was', () => {
  const all = whole(RULES).replace(/\n$/, '').split('\n');
  const codeLines = linesOf(RULES);
  assert.equal(all.length, codeLines.length, 'the reader keeps every line in its place');
  const from = all.findIndex((line) => line.startsWith('// ── TIMEDAY-01 (Alex, 2026-11-24): THE DAY VIEW IS A DAY '));
  const to = all.findIndex((line) => line.startsWith('// ── TIMEWIDE-01 (Alex, 2026-11-24): '));
  assert.ok(from > 0 && to > from, 'a dated heading, above the table’s class block');
  assert.equal(all.filter((line) => line.startsWith('// ── TIMEDAY-01')).length, 1);
  // Right under the last word of the picker's block.
  assert.match(all[from - 2], /^export const postingDateWords = /);
  assert.equal(all[from - 1], '');
  // The block's code: the six exports, in order — and nothing else exported from it.
  const block = codeLines.slice(from, to).join('\n');
  assert.deepEqual([...block.matchAll(/^export (?:const|function) (\w+)/gm)].map((m) => m[1]), ['DAY_FOLD_COLUMNS', 'isOneDay', 'DAY_FOLD_CLASS', 'dayFoldClass', 'dayFoldCount', 'dayPlaceWords']);
  assert.doesNotMatch(block, /LEDGER_TABLE_CLASS|min-w-/, 'its code names no table class');
  assert.doesNotMatch(block, /\bfetch\b|new Date\(|Date\.now\(|document\.|window\.|localStorage|sessionStorage/, 'pure: no read, no clock, no browser');
  // The table's class is still the file's last export and last line.
  assert.match(all.at(-1) ?? '', /^export const LEDGER_TABLE_CLASS = '/);
  assert.match(codeLines.filter((line) => /^export /.test(line)).at(-1) ?? '', /^export const LEDGER_TABLE_CLASS = '/);
});

// ── T10 · THE SECTION (ruling B) ─────────────────────────────────────────────

const kebab = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

test('T10 the section: the five lines as ruled and the three names on one import line; the mount untouched; the twenty-three cells of a row still drawn, in order; 488 lines', () => {
  const s = code(SECTION);
  assert.equal(linesOf(SECTION).length, 488, 'no line added, none removed — the registry cites three of its lines');
  // The import: the three names on the line that held their neighbours, in its alphabetical order.
  assert.ok(s.includes('\n  accountCellWords, accountNameCellWords, actualCellWords, applyColumnFilters, averageStarsWords, bookCellWords, budgetCellWords, dayFoldClass, dayFoldCount, dayLongWords, dayPlaceWords, daysWords, firstRecordUnplacedWords,\n'));
  assert.deepEqual([countOf(s, /\bdayFoldClass\b/g), countOf(s, /\bdayFoldCount\b/g), countOf(s, /\bdayPlaceWords\b/g)], [2, 4, 3], 'each imported once; read once, three times and twice');
  // 1 · the section's class — its own, and on one day the fold beside it.
  assert.ok(s.includes("\n    <section className={dayFoldClass('space-y-3', period)} data-ledger>\n"));
  assert.equal(countOf(s, /<section\b/g), 1);
  // 2 · the line above the table: the period's span, character for character, then the day's place — the last thing in the controls.
  const PERIOD_SPAN = '{period !== null && <span className="font-semibold text-text-secondary" data-ledger-period-words>{periodWords(period)}</span>}';
  const PLACE_SPAN = '{dayPlaceWords(period, rows) !== null && <span className="font-semibold text-text-secondary" data-ledger-day-place>{dayPlaceWords(period, rows)}</span>}';
  assert.ok(s.includes(`\n            ${PERIOD_SPAN}${PLACE_SPAN}\n          </>\n        )}\n        trailing={(`), 'on the one line, after the period’s words');
  assert.equal(countOf(s, /data-ledger-day-place/g), 1);
  assert.doesNotMatch(PLACE_SPAN, /\bshown\b/, 'the place is read from the answer’s sheet — whatever a filter hides');
  assert.match(s, /const rows: readonly LedgerSheetRow\[\] = answer !== null && answer\.read\.ok \? answer\.read\.value\.sheet : \[\];/);
  // 3, 4 · the two rows beneath span the columns still shown.
  assert.equal(countOf(s, /<td colSpan=\{LEDGER_HEAD_WORDS\.length - dayFoldCount\(period\)\} className=\{cell\}>/g), 2);
  // 5 · the TOTAL's label.
  assert.ok(s.includes('<th scope="row" colSpan={16 - dayFoldCount(period)} className={`${cell} text-left`}>{TOTAL_WORDS}</th>')); // TIMESHEET-04b (2026-11-27): sixteen less the folded — `15 - dayFoldCount(period)` until then
  assert.equal(countOf(s, /colSpan=/g), 3, 'the three spans, and no other');
  // The section types no fold of its own: the class, the count and the words are the rule's.
  assert.doesNotMatch(s, /:hidden|data-ledger-sort|isOneDay|DAY_FOLD/, 'no class, no selector and no test of the period typed here');
  // THE MOUNT IS NOT TOUCHED: the shared table is handed every column on every view — its CSV is built from them.
  assert.match(s, /<DataTable\n\s*name="ledger"\n\s*columns=\{LEDGER_TABLE\}\n\s*rows=\{rows\}\n\s*shown=\{shown\}\n\s*loaded=\{answer !== null && answer\.read\.ok\}\n\s*tableClassName=\{LEDGER_TABLE_CLASS\}\n\s*filters=\{filters\}\n\s*onFilters=\{setFilters\}\n\s*noFilters=\{NO_COLUMN_FILTERS\}\n\s*sort=\{sort\}\n\s*onSort=\{setSort\}\n\s*openFilter=\{openFilter\}\n\s*onOpenFilter=\{setOpenFilter\}\n\s*csv=\{csv\}\n\s*controls=\{\(/);
  // The twenty-three cells of a row are drawn on every view, in the columns' order — the fold removes none from the document.
  const row = s.slice(s.indexOf('data-ledger-row={row.key}'), s.indexOf('{picking === row.key && ('));
  const cells = [...row.matchAll(/<td className=\{[^\n]*? data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(cells, LEDGER_COLUMNS.map(kebab));
  assert.equal(cells.length, 23); // TIMESHEET-04b (2026-11-27): twenty-three cells — the instagram-tag and the notes cells among them; 21 until then
  assert.equal(countOf(row, /<td\b/g), 23, 'no cell is left out for a view');
  assert.doesNotMatch(row, /dayFold|isOneDay|period\b/, 'a row is drawn the same whatever the period');
  // The four the class finds are td cells carrying the folded keys themselves.
  for (const key of DAY_FOLD_COLUMNS) assert.equal(countOf(row, new RegExp(`<td className=\\{[^\\n]*? data-ledger-cell="${key}">`, 'g')), 1, `${key}: one td, found by its key`);
});

// ── T11 · THE CSV (ruling B) ─────────────────────────────────────────────────

test('T11 ledgerCsv for a one-day fixture has the twenty-three head words and twenty-three fields a row, the four folded columns among them — the fold is on the screen only', () => {
  const rows: readonly LedgerSheetRow[] = [recorded('porridge', TUE, NORTHPORT), planned('climbing', TUE, NORTHPORT)];
  assert.equal(dayPlaceWords(ONE_DAY, rows), '· Northport, Freedonia', 'a day the line above the table gives a place');
  assert.equal(dayFoldCount(ONE_DAY), 4, 'and on which the screen folds four columns');
  const csv = ledgerCsv(rows);
  const lines = csv.split('\r\n');
  assert.equal(lines.at(-1), '', 'every line ends CRLF, the last one too');
  assert.equal(lines.length, 4, 'the head, the two rows, and the end');
  // The head: all twenty-three words, in order (TIMESHEET-04b, 2026-11-27: twenty-one until then).
  assert.equal(lines[0], LEDGER_HEAD_WORDS.join(','));
  assert.equal(lines[0].split(',').length, 23); // TIMESHEET-04b (2026-11-27): twenty-three head words — 21 until then
  for (const key of DAY_FOLD_COLUMNS) assert.ok(lines[0].split(',').includes(LEDGER_HEAD_WORDS[LEDGER_COLUMNS.indexOf(key)]), `${key}: its head is in the file`);
  // Each row: twenty-three fields, the folded columns' own among them, in their places.
  for (const [i, sheetRow] of rows.entries()) {
    const fields = lines[i + 1].split(',');
    assert.equal(fields.length, 23, 'no field of this fixture holds a comma'); // TIMESHEET-04b (2026-11-27): twenty-three fields a row — 21 until then
    for (const key of DAY_FOLD_COLUMNS) assert.equal(fields[LEDGER_COLUMNS.indexOf(key)], LEDGER_CSV[key](sheetRow), `${key}: the cell's own word`);
  }
  assert.deepEqual(DAY_FOLD_COLUMNS.map((key) => lines[1].split(',')[LEDGER_COLUMNS.indexOf(key)]), ['Tuesday', TUE, 'Northport', 'Freedonia']);
  // The CSV is a function of the rows alone — it is handed no period, so no view can change it.
  assert.equal(ledgerCsv.length, 1);
  assert.equal(ledgerCsv(rows), csv);
});
