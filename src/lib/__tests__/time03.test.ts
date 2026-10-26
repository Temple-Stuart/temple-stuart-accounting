/**
 * TIME-03 (Alex, 2026-10-26) — TIME IS LIVE: WHERE THE HOURS WENT.
 *
 * The task ledger gains two columns after STARS, nothing reordered — PLANNED
 * MIN · LOGGED MIN (ruling A): the day card's one rule (a line's
 * duration_minutes; a stepless routine has none) and the record's
 * actual_minutes; whole minutes, "—" for null, sorted as numbers, bare integers
 * in the CSV; the record read grows additively (durationMinutes, read with the
 * record's plan words). The summary gains PLANNED HOURS · LOGGED HOURS — the
 * sums over the rows shown, hours to one decimal from whole minutes, each with
 * its coverage words; a period with no minutes says so, never 0.0 (ruling B).
 * The registry: Time LIVE, no why, the customer line verbatim; the census
 * 5 · 7 · 13 (ruling C). No schema, no migration, no new route; the journal
 * tables, the day card, the stops route and the minutes input are unchanged
 * (ruling D). The plan row "Projects and routines, each with what it costs" is
 * backed by Tasks and Expenses (ruling E). The pure rules are driven over
 * fixtures; the route, the screen and the registry are pinned to their source
 * with comments stripped (TEST-TRUTH-01). The byte pins idiom01 held on the
 * sixteen-column CSV moved to the new shape there; here the DOM and the CSV are
 * proved to agree on the eighteen — each column's words and its CSV field from
 * the one spec — not to be the old bytes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import type { RoutineWords } from '../budget/planLines';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, LEDGER_TABLE, MONEY_COLUMNS, NO_COLUMN_FILTERS, NO_VALUE_FILTER, SUMMARY_HEAD_WORDS, VALUE_COLUMNS,
  applyColumnFilters, cellWordsOf, columnKind, columnValues, headWordOf, hoursWords, ledgerCsv, ledgerOf, ledgerSummary, ledgerTotals, loggedCoverageWords, minutesCellWords,
  notesCount, plannedCoverageWords, sortKeyOf, sortRows,
  type LedgerInput, type LedgerRecordInput, type LedgerRow, type LedgerSaid,
} from '../operations/ledger';
import { tableCsv } from '../table/csv';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, registryLaw, statusCounts } from '../toolRegistry';
import { navToolByName } from '../nav';
import { FREE_TOOLS, TOOL_GATE, claimForCockpit, claimForTool, freeSetLine, heroCountsLine } from '../offer';
import { CAPABILITY_GROUPS, PLANS, cellState } from '../offer/plans';
import { verificationEmail } from '../auth/welcomeEmail';

const RULES = 'src/lib/operations/ledger.ts';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const REGISTRY = 'src/lib/toolRegistry.ts';
const PLANS_FILE = 'src/lib/offer/plans.ts';
const DAY_CARD = 'src/components/workbench/operations/day/dayCard.ts';
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const UNCHANGED = [
  DAY_CARD, STOPS_ROUTE, STOP_FORM,
  'src/components/workbench/operations/journal/MorningJournalTable.tsx', 'src/components/workbench/operations/journal/EveningJournalTable.tsx',
  'src/components/workbench/operations/journal/JournalDayTable.tsx', 'src/lib/operations/journalTables.ts', 'src/app/time/page.tsx',
];

const SIXTEEN = ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'STARS', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION'];
const EIGHTEEN = ['DAY', 'DATE', 'CITY', 'COUNTRY', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'DESCRIPTION'];
const CUSTOMER = 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.';

// ── FIXTURE: four records over two Bangkok days — a line with both minutes, a stepless routine with logged minutes only, a line planned with nothing logged, a stop with neither ──
const BKK = 'Asia/Bangkok';
const MORNING_13 = '2026-10-13T00:00:00.000Z'; // 07:00 in Bangkok, Oct 13
const GYM_13 = '2026-10-13T13:00:00.000Z'; // 20:00
const GYM_12 = '2026-10-12T13:00:00.000Z';
const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: `${over.occurrence_at.slice(0, 11)}00:41:00.000Z`, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const WORDS = new Map<string, RoutineWords>([
  ['morning', { name: 'Morning', timezone: BKK, steps: new Map([['coffee', { activity: 'Coffee', timeOfDay: '07:30' }], ['lunch', { activity: 'Lunch', timeOfDay: '12:00' }]]) }],
  ['gym', { name: 'Gym', timezone: BKK, steps: new Map() }],
]);
const RECORDS: LedgerRecordInput[] = [
  { record: record({ id: 'r-coffee', kind: 'routine_line', target_id: 'coffee', occurrence_at: MORNING_13, actual_cents: 1200, actual_minutes: 50 }), routineId: 'morning', routineName: 'Morning', zone: BKK, role: 'place', activity: 'Coffee', timeOfDay: '07:30', durationMinutes: 45 },
  { record: record({ id: 'r-lunch', kind: 'routine_line', target_id: 'lunch', occurrence_at: MORNING_13, actual_cents: 900 }), routineId: 'morning', routineName: 'Morning', zone: BKK, role: 'place', activity: 'Lunch', timeOfDay: '12:00', durationMinutes: 60 },
  { record: record({ id: 'r-gym', kind: 'routine', target_id: 'gym', occurrence_at: GYM_13, actual_minutes: 30 }), routineId: 'gym', routineName: 'Gym', zone: BKK, role: 'place', activity: null, timeOfDay: null, durationMinutes: null },
  { record: record({ id: 'r-gym-12', kind: 'routine', target_id: 'gym', occurrence_at: GYM_12, actual_cents: 2000 }), routineId: 'gym', routineName: 'Gym', zone: BKK, role: 'place', activity: null, timeOfDay: null, durationMinutes: null },
];
const INPUT: LedgerInput = {
  from: '2026-10-12', to: '2026-10-13', now: new Date('2026-10-14T00:00:00.000Z'), records: RECORDS, links: [], lines: [], notPlaced: [], routines: WORDS,
  roles: new Map([['morning', 'place'], ['gym', 'place']]), vendors: [], stays: [], accounts: [], books: [{ id: 'P', entityType: 'personal' }],
};
const ledger = ledgerOf(INPUT);
const rowOf = (id: string): LedgerRow => {
  const row = ledger.rows.find((r) => r.id === id);
  assert.ok(row !== undefined, `row ${id}`);
  return row;
};
const ids = (rows: readonly LedgerRow[]): string[] => rows.map((r) => r.id);
const NOTHING_SAID: LedgerSaid = { noLine: 0, doubled: 0, noStay: 0, unplaced: [], notRecorded: 0, notPlaced: 0, leftOut: { journal: 0, plan: 0, execute: 0, all_day: 0 } };

// ── RULING A · THE TWO COLUMNS ───────────────────────────────────────────────

test('A the eighteen heads in Alex’s order — PLANNED MIN · LOGGED MIN after STARS, nothing reordered; both VALUE columns; the spec, the filters map and the CSV header follow', () => {
  assert.deepEqual(LEDGER_HEAD_WORDS, EIGHTEEN);
  assert.equal(LEDGER_HEAD_WORDS.length, 18);
  assert.deepEqual(LEDGER_COLUMNS, ['day', 'date', 'city', 'country', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'stars', 'plannedMinutes', 'loggedMinutes', 'budget', 'actual', 'variance', 'match', 'underOver', 'description']);
  assert.deepEqual([headWordOf('plannedMinutes'), headWordOf('loggedMinutes')], ['PLANNED MIN', 'LOGGED MIN']);
  const stars = LEDGER_HEAD_WORDS.indexOf('STARS');
  assert.deepEqual([LEDGER_HEAD_WORDS[stars + 1], LEDGER_HEAD_WORDS[stars + 2], LEDGER_HEAD_WORDS[stars + 3]], ['PLANNED MIN', 'LOGGED MIN', 'BUDGET'], 'inserted after STARS, before BUDGET');
  assert.deepEqual(LEDGER_HEAD_WORDS.filter((h) => h !== 'PLANNED MIN' && h !== 'LOGGED MIN'), SIXTEEN, 'nothing reordered: the sixteen stand in their order');
  assert.deepEqual([columnKind('plannedMinutes'), columnKind('loggedMinutes')], ['value', 'value'], 'value columns — a checklist filter, not a money min/max');
  assert.ok(VALUE_COLUMNS.includes('plannedMinutes') && VALUE_COLUMNS.includes('loggedMinutes'));
  assert.deepEqual(MONEY_COLUMNS, ['budget', 'actual', 'variance', 'match'], 'the money columns unchanged');
  assert.deepEqual(LEDGER_TABLE.map((c) => c.key), [...LEDGER_COLUMNS]);
  assert.deepEqual(LEDGER_TABLE.map((c) => c.label), [...LEDGER_HEAD_WORDS]);
  assert.deepEqual(Object.keys(NO_COLUMN_FILTERS).sort(), [...LEDGER_COLUMNS].sort(), 'one filter per column');
  assert.deepEqual([NO_COLUMN_FILTERS.plannedMinutes, NO_COLUMN_FILTERS.loggedMinutes], [NO_VALUE_FILTER, NO_VALUE_FILTER]);
  assert.equal(ledgerCsv([]), `${EIGHTEEN.join(',')}\r\n`, 'the CSV header is the eighteen heads');
  assert.equal(ledgerCsv([]).split('\r\n')[0], 'DAY,DATE,CITY,COUNTRY,BOOK,ACCOUNT,ACCOUNT NAME,SUB ACCOUNT NAME,VENDOR,STARS,PLANNED MIN,LOGGED MIN,BUDGET,ACTUAL,VARIANCE,MATCH,UNDER / OVER,DESCRIPTION');
});

test('A PLANNED MIN is the line’s duration_minutes (blank for a stepless routine), LOGGED MIN the record’s actual_minutes — whole minutes, "—" for null, sorted as numbers, bare integers in the CSV; the DOM and the CSV agree on the eighteen', () => {
  const coffee = rowOf('r-coffee');
  const lunch = rowOf('r-lunch');
  const gym = rowOf('r-gym');
  const gym12 = rowOf('r-gym-12');
  assert.deepEqual(ids(ledger.rows), ['r-coffee', 'r-lunch', 'r-gym', 'r-gym-12'], 'the ledger’s own order: newest day first, the card’s clock within');
  assert.deepEqual([coffee.plannedMinutes, coffee.loggedMinutes], [45, 50], 'a line planned 45, logged 50');
  assert.deepEqual([gym.plannedMinutes, gym.loggedMinutes], [null, 30], 'a stepless routine has no planned minutes; its logged minutes stand');
  assert.deepEqual([lunch.plannedMinutes, lunch.loggedMinutes], [60, null], 'planned, nothing logged');
  assert.deepEqual([gym12.plannedMinutes, gym12.loggedMinutes], [null, null]);
  // The cell words: the number alone, "—" for null; the one blank word.
  assert.deepEqual([cellWordsOf(coffee, 'plannedMinutes'), cellWordsOf(coffee, 'loggedMinutes'), cellWordsOf(gym, 'plannedMinutes'), cellWordsOf(gym, 'loggedMinutes'), cellWordsOf(gym12, 'plannedMinutes')], ['45', '50', BLANK, '30', BLANK]);
  assert.deepEqual([minutesCellWords(0), minutesCellWords(1440), minutesCellWords(null)], ['0', '1440', BLANK]);
  assert.throws(() => minutesCellWords(1.5), /ledger: minutes are a whole number of minutes, not 1\.5/);
  assert.throws(() => minutesCellWords(-1), /not -1/);
  // Sorted as numbers: 5 < 45 < 120 (as text "120" < "45" < "5"); blanks last both ways.
  assert.deepEqual(sortKeyOf(coffee, 'plannedMinutes'), { kind: 'number', n: 45 });
  assert.deepEqual(sortKeyOf(gym, 'loggedMinutes'), { kind: 'number', n: 30 });
  assert.equal(sortKeyOf(gym, 'plannedMinutes'), null);
  const r120: LedgerRow = { ...coffee, id: 'x120', key: 'k120', plannedMinutes: 120 };
  const r5: LedgerRow = { ...coffee, id: 'x5', key: 'k5', plannedMinutes: 5 };
  assert.deepEqual(ids(sortRows([r120, r5, coffee, gym], { column: 'plannedMinutes', direction: 'asc' })), ['x5', 'r-coffee', 'x120', 'r-gym']);
  assert.deepEqual(ids(sortRows([r120, r5, coffee, gym], { column: 'plannedMinutes', direction: 'desc' })), ['x120', 'r-coffee', 'x5', 'r-gym']);
  assert.deepEqual(ids(sortRows(ledger.rows, { column: 'loggedMinutes', direction: 'asc' })), ['r-gym', 'r-coffee', 'r-lunch', 'r-gym-12'], '30, 50, then the blanks in the order given');
  assert.deepEqual(ids(sortRows(ledger.rows, { column: 'loggedMinutes', direction: 'desc' })), ['r-coffee', 'r-gym', 'r-lunch', 'r-gym-12']);
  // The checklist and the filter: the distinct minutes in numeric order, the blank last; "(blank)" dropped keeps the rows that carry minutes.
  assert.deepEqual(columnValues(ledger.rows, 'loggedMinutes'), [{ key: '30', count: 1 }, { key: '50', count: 1 }, { key: BLANK, count: 2 }]);
  assert.deepEqual(columnValues(ledger.rows, 'plannedMinutes'), [{ key: '45', count: 1 }, { key: '60', count: 1 }, { key: BLANK, count: 2 }]);
  assert.deepEqual(ids(applyColumnFilters(ledger.rows, { ...NO_COLUMN_FILTERS, loggedMinutes: { dropped: [BLANK] } })), ['r-coffee', 'r-gym']);
  assert.deepEqual(ids(applyColumnFilters(ledger.rows, { ...NO_COLUMN_FILTERS, plannedMinutes: { dropped: ['45', BLANK] } })), ['r-lunch']);
  // The CSV: bare integers, an EMPTY field for null, in the head's places.
  const P = LEDGER_HEAD_WORDS.indexOf('PLANNED MIN');
  const L = LEDGER_HEAD_WORDS.indexOf('LOGGED MIN');
  assert.deepEqual([P, L], [10, 11]);
  const lines = ledgerCsv(ledger.rows).split('\r\n');
  const field = (id: string, i: number): string => lines[1 + ledger.rows.findIndex((r) => r.id === id)].split(',')[i];
  assert.deepEqual([field('r-coffee', P), field('r-coffee', L), field('r-gym', P), field('r-gym', L), field('r-lunch', P), field('r-lunch', L), field('r-gym-12', P), field('r-gym-12', L)], ['45', '50', '', '30', '60', '', '', '']);
  assert.equal(lines[1], 'Tuesday,2026-10-13,,,,,,Coffee,,,45,50,,12.00,,,,', 'the whole line — the minutes between STARS and BUDGET');
  assert.equal(lines[3], 'Tuesday,2026-10-13,,,,,,Gym,,,,30,,,,,,', 'a stepless routine: PLANNED MIN empty');
  assert.deepEqual([LEDGER_CSV.plannedMinutes(coffee), LEDGER_CSV.loggedMinutes(gym12)], ['45', '']);
  assert.doesNotMatch(ledgerCsv(ledger.rows), /—/, 'no "—" in the file');
  // IDIOM-01's byte proof, re-proved on the eighteen: the DOM's words and the CSV's field come from the one spec, column by column, and agree — a null is "—" on screen and empty in the file, a figure is the same digits in both.
  assert.equal(ledgerCsv(ledger.rows), tableCsv(LEDGER_TABLE, ledger.rows));
  for (const r of ledger.rows) {
    for (const c of LEDGER_TABLE) {
      assert.equal(c.words(r), cellWordsOf(r, c.key), `${c.key} words of ${r.id}`);
      assert.equal(c.csv(r), LEDGER_CSV[c.key](r), `${c.key} csv of ${r.id}`);
      if (c.key === 'plannedMinutes' || c.key === 'loggedMinutes') assert.equal(c.csv(r), c.words(r) === BLANK ? '' : c.words(r), `${c.key} of ${r.id}: the screen and the file agree`);
    }
  }
});

test('A the read grows additively: the route selects the line’s duration_minutes with the record’s plan words (no new query) and hands it to the rule as durationMinutes, null for a stepless routine; the rule copies the two figures onto the row', () => {
  const route = code(ROUTE);
  assert.match(route, /step: \{ select: \{ activity: true, time_of_day: true, duration_minutes: true, routine_id: true, routine: \{ select: \{ name: true, timezone: true, role: true \} \} \} \},/, 'RECORD_PLAN reads the duration with the step');
  assert.match(route, /readonly duration_minutes: number \| null; readonly routine_id: string;/, 'the row type');
  assert.match(route, /timeOfDay: row\.step\.time_of_day === null \? null : row\.step\.time_of_day\.toISOString\(\)\.slice\(11, 16\), durationMinutes: row\.step\.duration_minutes \};/);
  assert.match(route, /activity: null, timeOfDay: null, durationMinutes: null \};/, 'a stepless routine has none');
  assert.equal((route.match(/prisma\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 9, 'the same queries as before — the duration rides the record include');
  assert.doesNotMatch(route, /actual_minutes/, 'the record’s minutes were always in the row (stopRecordRowOf) — nothing added for them');
  assert.match(comments(ROUTE), /TIME-03 \(Alex, 2026-10-26\): the line's duration_minutes, read WITH the\s*\n?\s*\*?\s*record's plan words/);
  const rules = code(RULES);
  assert.match(rules, /readonly timeOfDay: string \| null;\n\s*readonly durationMinutes: number \| null;\n\}/, 'LedgerRecordInput grew by one field');
  assert.match(rules, /readonly varianceCents: number \| null;\n\s*readonly plannedMinutes: number \| null;\n\s*readonly loggedMinutes: number \| null;\n\}/, 'LedgerRow grew by two');
  assert.match(rules, /plannedMinutes: r\.durationMinutes,\n\s*loggedMinutes: r\.record\.actual_minutes,/, 'copied, nothing computed');
  assert.match(rules, /case 'plannedMinutes': return minutesCellWords\(row\.plannedMinutes\);\n\s*case 'loggedMinutes': return minutesCellWords\(row\.loggedMinutes\);/);
  assert.match(rules, /case 'plannedMinutes': return num\(row\.plannedMinutes\);\n\s*case 'loggedMinutes': return num\(row\.loggedMinutes\);/, 'sorted as numbers');
  assert.match(rules, /plannedMinutes: \(row\) => row\.plannedMinutes === null \? '' : String\(row\.plannedMinutes\),\n\s*loggedMinutes: \(row\) => row\.loggedMinutes === null \? '' : String\(row\.loggedMinutes\),/, 'the CSV’s own null path');
  // The day card's rules are the ledger's: the same two columns of the same tables.
  assert.match(code(DAY_CARD), /minutes: step\.duration_minutes,/);
  assert.match(code(DAY_CARD), /actualMinutes: record\.actual_minutes,/);
});

test('A the section: the two cells after STARS, each its words and the blank class when null; the TOTAL row spans the twelve columns before BUDGET (the minutes are the summary’s hours, not the TOTAL row’s)', () => {
  const s = code(SECTION);
  const cells = [...s.matchAll(/data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(cells, ['day', 'date', 'city', 'country', 'book', 'account', 'account-name', 'sub-account-name', 'vendor', 'stars', 'planned-minutes', 'logged-minutes', 'budget', 'actual', 'variance', 'match', 'under-over', 'description']);
  assert.match(s, /data-ledger-cell="stars">\{starsCellWords\(row\.rating\)\}<\/td>\n(?:\s*\{\s*\}\n)?\s*<td className=\{`\$\{cell\} whitespace-nowrap tabular-nums \$\{row\.plannedMinutes === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="planned-minutes">\{minutesCellWords\(row\.plannedMinutes\)\}<\/td>\n\s*<td className=\{`\$\{cell\} whitespace-nowrap tabular-nums \$\{row\.loggedMinutes === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="logged-minutes">\{minutesCellWords\(row\.loggedMinutes\)\}<\/td>\n\s*<td [^\n]*data-ledger-cell="budget">/, 'STARS, then the two minutes cells, then BUDGET');
  assert.match(s, /<th scope="row" colSpan=\{12\} className=\{`\$\{cell\} text-left`\}>\{TOTAL_WORDS\}<\/th>/);
  assert.equal(LEDGER_HEAD_WORDS.indexOf('BUDGET'), 12);
  assert.doesNotMatch(s, /data-ledger-total-planned|data-ledger-total-logged|totals\.plannedMinutes\)\}<\/td>\n\s*<td[^\n]*data-ledger-total/, 'no minutes in the TOTAL row');
  assert.match(comments(SECTION), /TIME-03 \(Alex, 2026-10-26\): WHERE THE HOURS WENT — Time is LIVE/);
  assert.match(code('src/components/table/DataTable.tsx'), /<th key=\{c\.key\} className=\{c\.kind === 'money' \? `\$\{headClass\} text-right` : headClass\}>/, 'a VALUE head is left-aligned, as the others');
});

// ── RULING B · THE SUMMARY ───────────────────────────────────────────────────

test('B the summary gains PLANNED HOURS · LOGGED HOURS — Σ minutes over the group’s rows that carry them, printed as hours to one decimal (minutes ÷ 60), whole minutes underneath; null when none does; each with its coverage words; a period with no minutes says so, never 0.0', () => {
  assert.deepEqual(SUMMARY_HEAD_WORDS, ['DAYS', 'BUDGET', 'ACTUAL', 'UNDER / OVER', 'ACTUAL PER RECORDED DAY', 'STARS', 'PLANNED HOURS', 'LOGGED HOURS']);
  const t = ledgerTotals(ledger.rows);
  assert.deepEqual([t.plannedMinutes, t.withPlanned, t.loggedMinutes, t.withLogged], [105, 2, 80, 2], '45 + 60 planned over 2 of 4 rows; 50 + 30 logged over 2 of 4');
  assert.deepEqual([hoursWords(t.plannedMinutes), hoursWords(t.loggedMinutes)], ['1.8', '1.3'], 'hours to one decimal — the screen’s formatting only');
  assert.deepEqual([hoursWords(45), hoursWords(60), hoursWords(30), hoursWords(90), hoursWords(0), hoursWords(null)], ['0.8', '1.0', '0.5', '1.5', '0.0', BLANK]);
  // By day: Oct 13 carries both; Oct 12 carries neither — null, never 0.
  const byDay = ledgerSummary(ledger.rows, 'day');
  assert.deepEqual(byDay.map((g) => [g.key, g.totals.plannedMinutes, g.totals.withPlanned, g.totals.loggedMinutes, g.totals.withLogged]), [['2026-10-13', 105, 2, 80, 2], ['2026-10-12', null, 0, null, 0]]);
  assert.deepEqual([hoursWords(byDay[1].totals.plannedMinutes), hoursWords(byDay[1].totals.loggedMinutes)], [BLANK, BLANK], 'a group with no minutes prints "—"');
  // A period with no minutes at all: null, the words say so, nothing is 0.0.
  const none = ledgerTotals([rowOf('r-gym-12')]);
  assert.deepEqual([none.plannedMinutes, none.withPlanned, none.loggedMinutes, none.withLogged], [null, 0, null, 0]);
  assert.deepEqual([hoursWords(none.plannedMinutes), hoursWords(none.loggedMinutes)], [BLANK, BLANK]);
  assert.deepEqual([plannedCoverageWords(none.withPlanned, 1), loggedCoverageWords(none.withLogged, 1)], ['PLANNED HOURS totals none of the 1 row — no row carries planned minutes', 'LOGGED HOURS totals none of the 1 row — no row carries logged minutes']);
  assert.deepEqual(ledgerTotals([]).plannedMinutes, null);
  // The coverage words — the one idiom the VARIANCE and MATCH lines use.
  assert.equal(plannedCoverageWords(t.withPlanned, ledger.rows.length), 'PLANNED HOURS totals the 2 of 4 rows that carry planned minutes');
  assert.equal(loggedCoverageWords(t.withLogged, ledger.rows.length), 'LOGGED HOURS totals the 2 of 4 rows that carry logged minutes');
  assert.equal(plannedCoverageWords(4, 4), 'PLANNED HOURS totals all 4 rows');
  assert.equal(loggedCoverageWords(0, 4), 'LOGGED HOURS totals none of the 4 rows — no row carries logged minutes');
  assert.throws(() => plannedCoverageWords(5, 4), /is no coverage/);
  const rules = code(RULES);
  assert.match(rules, /export const plannedCoverageWords = \(n: number, m: number\): string => coverageWordsOf\('PLANNED HOURS', \{ rows: 'that carry planned minutes', none: 'no row carries planned minutes' \}, n, m\);/);
  assert.match(rules, /export const loggedCoverageWords = \(n: number, m: number\): string => coverageWordsOf\('LOGGED HOURS', \{ rows: 'that carry logged minutes', none: 'no row carries logged minutes' \}, n, m\);/);
  assert.match(rules, /export const hoursWords = \(minutes: number \| null\): string => \(minutes === null \? BLANK : \(minutes \/ 60\)\.toFixed\(1\)\);/);
  assert.match(rules, /plannedMinutes: planned\.length === 0 \? null : planned\.reduce\(\(sum, m\) => sum \+ m, 0\),\n\s*withPlanned: planned\.length,\n\s*loggedMinutes: logged\.length === 0 \? null : logged\.reduce\(\(sum, m\) => sum \+ m, 0\),\n\s*withLogged: logged\.length,/, 'cents-style integers underneath — never 0 for none');
  // The notes count the four coverage lines while a row is shown.
  assert.equal(notesCount(NOTHING_SAID, 3), 4);
  assert.equal(notesCount(NOTHING_SAID, 0), 0);
  // The section: the two heads through the one list, the two cells after STARS in the money class (right-aligned, as the heads), the two coverage lines after the MATCH line.
  const s = code(SECTION);
  assert.match(s, /\{SUMMARY_HEAD_WORDS\.map\(\(h\) => <th key=\{h\} className=\{h === 'STARS' \|\| h === 'DAYS' \? head : `\$\{head\} text-right`\}>\{h\}<\/th>\)\}/, 'PLANNED HOURS and LOGGED HOURS right-aligned by the one rule');
  assert.match(s, /data-ledger-group-stars>\{g\.stars === null \? starsCellWords\(null\) : averageStarsWords\(g\.stars\)\}<\/td>\n(?:\s*\{\s*\}\n)?\s*<td className=\{`\$\{money\} \$\{g\.totals\.plannedMinutes === null \? BLANK_CLASS : ''\}`\} data-ledger-group-planned-hours>\{hoursWords\(g\.totals\.plannedMinutes\)\}<\/td>\n\s*<td className=\{`\$\{money\} \$\{g\.totals\.loggedMinutes === null \? BLANK_CLASS : ''\}`\} data-ledger-group-logged-hours>\{hoursWords\(g\.totals\.loggedMinutes\)\}<\/td>/);
  assert.match(s, /\{shown\.length > 0 && <p data-ledger-said-match>\{matchCoverageWords\(totals\.withMatch, shown\.length\)\}<\/p>\}\n\s*\{shown\.length > 0 && <p data-ledger-said-planned>\{plannedCoverageWords\(totals\.withPlanned, shown\.length\)\}<\/p>\}\n\s*\{shown\.length > 0 && <p data-ledger-said-logged>\{loggedCoverageWords\(totals\.withLogged, shown\.length\)\}<\/p>\}/, 'the coverage, said under the table');
  assert.doesNotMatch(s, /toFixed|\/ 60/, 'the section computes no hours — ledger.ts does');
});

// ── RULING C · THE REGISTRY ──────────────────────────────────────────────────

test('C Time is LIVE with four beats, no why, the customer line verbatim; the note’s "not done" sentence left; the citation names the minutes lines and they say what it says; the census is 5 · 7 · 13; the claim "built and running"; the opener prints no line', () => {
  const time = TOOL_REGISTRY.find((x) => x.name === 'Time');
  assert.ok(time);
  assert.equal(time.status, 'LIVE');
  assert.deepEqual(time.beats, { discover: true, decide: true, commit: true, record: true });
  assert.equal(time.home, '/time');
  assert.equal(time.why, undefined, 'a LIVE row carries no why');
  assert.equal(time.customer, CUSTOMER);
  assert.doesNotMatch(time.customer ?? '', /not yet|\.tsx?:|src\/|\b(discover|decide|commit|record)\b|founder|module|registry|beat|loop|_/i, 'the plan law’s words');
  assert.match(time.note ?? '', /^HOME-01 \(2026-10-24\): the day itself is entered on the day card/);
  assert.doesNotMatch(time.note ?? '', /Not done for a customer|nothing yet adds up/, 'the sentence left with the status');
  // The citation adds the minutes columns' lines — and each cited line is what it says.
  const cited = (re: RegExp): number => { const m = time.citation.match(re); assert.ok(m, `the citation names ${re}`); return Number(m[1]); };
  const lineOf = (file: string, n: number): string => code(file).split('\n')[n - 1] ?? '';
  assert.match(lineOf(RULES, cited(/src\/lib\/operations\/ledger\.ts:(\d+) \(LEDGER_HEAD_WORDS/)), /^export const LEDGER_HEAD_WORDS = \[/);
  assert.match(lineOf(ROUTE, cited(/src\/app\/api\/operations\/ledger\/route\.ts:(\d+)/)), /duration_minutes: true/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the two cells\)/)), /data-ledger-cell="planned-minutes"/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(PLANNED HOURS · LOGGED HOURS/)), /data-ledger-group-planned-hours/);
  assert.match(lineOf(RULES, cited(/the summary's sums, src\/lib\/operations\/ledger\.ts:(\d+)/)), /^export const SUMMARY_HEAD_WORDS = \[/);
  assert.match(lineOf(SECTION, cited(/their coverage said at LedgerSection\.tsx:(\d+)/)), /data-ledger-said-planned/);
  for (const beat of ['discover: src/components/workbench/operations/ledger/ledgerReads.ts:27', 'decide: src/app/api/operations/journal/route.ts:51 (PUT', 'commit: src/app/api/operations/stops/route.ts (POST', 'record: src/components/workbench/operations/ledger/LedgerSection.tsx']) {
    assert.ok(time.citation.includes(beat), `the citation keeps ${beat.split(':')[0]}`);
  }
  // The census.
  assert.match(comments(REGISTRY), /TIME-03 census \(Alex, 2026-10-26\): Time LIVE — the ledger prints planned and logged minutes and adds up the hours\./);
  assert.match(comments(REGISTRY), /4 · 8 · 13 → 5 · 7 · 13/);
  assert.match(comments(REGISTRY), /5 LIVE · 7 PARTIAL · 13 NOT_BUILT/);
  assert.match(comments(REGISTRY), /TIME-03 \(Alex, 2026-10-26\): TIME IS LIVE/);
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 7, NOT_BUILT: 13 });
  assert.deepEqual(statusCounts(), { LIVE: 5, PARTIAL: 7, NOT_BUILT: 13 });
  assert.deepEqual(TOOL_REGISTRY.filter((t) => t.status === 'LIVE').map((t) => t.name), ['Tasks', 'Time', 'Expenses', 'Travel', 'Bookkeeping']);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  // The law would refuse the row as LIVE with a why, or short of a beat, or a census left at 4.
  assert.match(registryLaw({ throwOnFail: false, registry: TOOL_REGISTRY.map((x) => (x.name === 'Time' ? { ...x, why: 'x' } : x)) }).join('\n'), /Time: why belongs only to a PARTIAL tool/);
  assert.match(registryLaw({ throwOnFail: false, registry: TOOL_REGISTRY.map((x) => (x.name === 'Time' ? { ...x, beats: { ...x.beats, record: false } } : x)) }).join('\n'), /Time: LIVE needs four beats and a home/);
  assert.match(registryLaw({ throwOnFail: false, registry: TOOL_REGISTRY.map((x) => (x.name === 'Time' ? { ...x, status: 'PARTIAL' as const, why: 'x' } : x)) }).join('\n'), /LIVE count 4 ≠ census 5/);
  assert.equal(claimForTool('Time'), 'built and running');
  assert.equal(claimForCockpit('content'), 'built and running');
  assert.equal(navToolByName('Time', TOOL_GATE).line, null);
  assert.equal(navToolByName('Time', TOOL_GATE).status, 'LIVE');
  assert.equal(navToolByName('Time', TOOL_GATE).href, '/time');
});

test('C the derived surfaces follow: Time joins the free set after Tasks; the hero counts five live, seven partial; the verification email names it', () => {
  assert.equal(TOOL_GATE.Time, null);
  assert.deepEqual(FREE_TOOLS.map((t) => t.name), ['Tasks', 'Time', 'Expenses', 'Travel']);
  assert.equal(freeSetLine(), "Free with an account, no module to buy: Tasks, Time, Expenses, Travel — the registry's live tools with no tab gate.");
  assert.equal(heroCountsLine(), 'Twenty-five tools, counted: five live, seven partial, thirteen on the blueprint.');
  const mail = verificationEmail({ name: 'Ada', verifyUrl: 'https://templestuart.com/api/auth/verify?token=t', baseUrl: 'https://templestuart.com/' });
  assert.ok(mail.text.includes('Free with your account: Tasks, Time, Expenses, Travel.'));
});

test('C the plan surfaces flip the one row standing on Time — "Where the hours went" — to ✓ by derivation, in every plan; no other cell changes; nothing typed', () => {
  const rows = CAPABILITY_GROUPS.flatMap((g) => g.rows.map((row) => ({ group: g.id, row })));
  const hours = rows.filter((r) => r.row.tools.includes('Time'));
  assert.equal(hours.length, 1, 'one row stands on Time');
  assert.deepEqual([hours[0].group, hours[0].row.label, hours[0].row.tools, hours[0].row.module], ['days', 'Where the hours went', ['Time'], 'personal']);
  for (const plan of PLANS) assert.equal(cellState(plan, hours[0].row), 'ready', `${plan.id} reads ✓`);
  // Until TIME-03 the cell read ◐ — the same mapping over the old status.
  const before = TOOL_REGISTRY.map((x) => (x.name === 'Time' ? { ...x, status: 'PARTIAL' as const, why: 'x' } : x));
  assert.equal(cellState(PLANS[0], hours[0].row, before), 'partial');
  const changed = rows.filter((r) => PLANS.some((plan) => cellState(plan, r.row) !== cellState(plan, r.row, before))).map((r) => r.row.label);
  assert.deepEqual(changed, ['Where the hours went'], 'the one row whose cells flipped, in all four plans');
});

// ── RULING D · UNCHANGED ─────────────────────────────────────────────────────

test('D the journal tables, the day card, the stops route and the minutes input are unchanged; no schema, no migration, no new route', () => {
  for (const f of UNCHANGED) assert.doesNotMatch(code(f) + comments(f), /TIME-03|plannedMinutes|loggedMinutes|hoursWords/, `${f} is untouched`);
  assert.match(code(STOPS_ROUTE), /actual_minutes: v\.actualMinutes \};/, 'the record stores its minutes as before');
  assert.match(code(STOP_FORM), /actualMinutes = Number\(d\.minutes\.trim\(\)\);/, 'the minutes input as before');
  assert.match(code(STOP_FORM), /minutes: r === null \|\| r\.actual_minutes === null \? '' : String\(r\.actual_minutes\),/);
  assert.doesNotMatch(code(RULES) + code(ROUTE) + code(SECTION), /prisma\.\$executeRaw|ALTER TABLE|migrations/, 'no migration, no raw SQL');
  assert.doesNotMatch(code(RULES), /from 'react'|from 'next|\bfetch\b|@prisma\/client/, 'the rule stays pure');
});

// ── RULING E · THE PLAN ROW ──────────────────────────────────────────────────

test('E "Projects and routines, each with what it costs" is backed by Tasks and Expenses — both LIVE, so its ✓ is unchanged; the label is unchanged; a dated comment says why', () => {
  const rows = CAPABILITY_GROUPS.flatMap((g) => g.rows.map((row) => ({ group: g.id, row })));
  const days = rows.filter((r) => r.row.label === 'Projects and routines, each with what it costs');
  assert.equal(days.length, 1);
  assert.deepEqual([days[0].group, days[0].row.tools, days[0].row.module], ['days', ['Tasks', 'Expenses'], 'personal']);
  for (const plan of PLANS) assert.equal(cellState(plan, days[0].row), 'ready', `${plan.id} reads ✓`);
  // The weakest tool wins: Expenses PARTIAL would read ◐ now, where ['Tasks'] alone would not have.
  assert.equal(cellState(PLANS[0], days[0].row, TOOL_REGISTRY.map((x) => (x.name === 'Expenses' ? { ...x, status: 'PARTIAL' as const, why: 'x' } : x))), 'partial');
  assert.equal(cellState(PLANS[0], days[0].row, TOOL_REGISTRY.map((x) => (x.name === 'Tasks' ? { ...x, status: 'PARTIAL' as const, why: 'x' } : x))), 'partial');
  assert.match(comments(PLANS_FILE), /TIME-03 \(Alex, 2026-10-26; TASKS-03 call 1, ruled in chat\): half this claim stands on Expenses/);
  assert.equal(rows.filter((r) => r.row.tools.includes('Expenses')).length, 2, 'Expenses backs two rows now — its own, and this one');
});
