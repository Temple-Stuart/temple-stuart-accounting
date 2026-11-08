/**
 * SUPERSEDE-01b (Alex, 2026-11-08, rulings A–L) — BUDGET STOPS COUNTING THE ROUTINE OCCURRENCES TRAVEL SUPERSEDES.
 *
 * The two Budget routes read the range's travel BLOCKS through one named read (src/lib/operations/travelBlocksReads.ts, on
 * READS-01a's functions) and the range's stop records through one indexed query (stopRecord.ts recordsWindowOf); the model marks
 * every superseded occurrence by the one rule (days.ts routineSupersessionOf → supersession.ts supersessionOf), sums WITHOUT the
 * marked lines and says the count and the cents per column; a DAY or WEEK carries a mark for every occurrence and the day card
 * TAKES its marks — it computes none; the #1886 gap line retires for a SUPERSEDED BY TRAVEL row.
 *
 * The rules are DRIVEN over fixtures (the read's flat list, the report, the drill, the card); the routes, the card and the screen
 * are read through code() (the reader law). Every figure is integer cents, worked by hand beside it. This file imports nothing
 * from @prisma/client.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { blocksOfRows, BOOKINGS_NEVER_A_BLOCK, type BlockPlannedRow, type BlockSegmentRow } from '../operations/travelBlocksReads';
import { recordWindow, recordsWindowOf } from '../operations/stopRecord';
import { occurrenceKey } from '../budget/days';
import { markLines, type BudgetLine } from '../budget/report';
import {
  budgetCellResponse, budgetReportResponse, parseCellQuery, YEAR_MARKS_WORDS, BudgetInputError,
  type BudgetChartRow, type EntityRow, type ReportRows, type RoutineRow, type StopRecordKeyRow,
} from '../budget/reportInputs';
import { SUPERSEDED_ROW_LABEL, drillSupersededWords, supersededCellWords } from '../budget/reportView';
import { supersededWords, type Supersession } from '../operations/supersession';
import { dayStops, marksOf } from '@/components/workbench/operations/day/dayCard';
import type { RoutineStep } from '@/components/workbench/operations/routines/types';
import { entry, input, routine as cardRoutine } from './fixtureReelDay';

const READS = 'src/lib/operations/travelBlocksReads.ts';
const ROUTE = 'src/app/api/budget/report/route.ts';
const CELL = 'src/app/api/budget/report/cell/route.ts';
const MODEL = 'src/lib/budget/report.ts';
const RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const SCREEN = 'src/components/budget/BudgetReport.tsx';
const INPUTS = 'src/lib/budget/reportInputs.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';

// ── FIXTURES — one day in Bangkok (UTC+7) and a planned flight 14:10–17:05 with both instants ──────────────────────────────

const DAY = '2026-10-15';
const ASOF = '2026-11-08';
/** A Bangkok wall clock on a day, as ISO instant text. */
const bkk = (clock: string, day: string = DAY): string => new Date(`${day}T${clock}:00.000+07:00`).toISOString();
const at = (iso: string): Date => new Date(iso);
const utcMidnight = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
/** A @db.Time as the loader reads it — a Date at 1970-01-01. */
const time = (clock: string): Date => new Date(`1970-01-01T${clock}:00.000Z`);

const plannedRow = (over: Partial<BlockPlannedRow> & { id: string }): BlockPlannedRow => ({
  category: 'flight', vendor: 'CNX → DPS', vendor_name: 'AirAsia', recurrence: 'once', homeTime: '14:10', start_at: at(bkk('14:10')), end_at: at(bkk('17:05')), ...over,
});
const segmentRow = (over: Partial<BlockSegmentRow> & { source_id: string | null }): BlockSegmentRow => ({
  title: 'AirAsia DPS → CNX (flight)', start_date: utcMidnight(DAY), start_time: time('09:00'), start_at: at(bkk('09:00')), end_at: at(bkk('11:00')), ...over,
});

/** The one block every report fixture reads — through the read's own flat list, as the route hands it over. */
const FLIGHT_READ = blocksOfRows([plannedRow({ id: 'ti-flight' })], []);
const FLIGHT = FLIGHT_READ.blocks[0];

const P: EntityRow = { id: 'ent-p', name: 'Alex', entity_type: 'personal' };
const CHART: BudgetChartRow[] = [
  { entity_id: 'ent-p', code: '6150', name: 'Meals', account_type: 'expense', balance_type: 'D', is_archived: false },
  { entity_id: 'ent-p', code: '6200', name: 'Cowork', account_type: 'expense', balance_type: 'D', is_archived: false },
];
const bkkRoutine = (over: Partial<RoutineRow> & { id: string; clock: string }): RoutineRow => {
  const { clock, ...rest } = over;
  return {
    name: rest.id, budget_amount: null, coa_code: null, schedule_rrule: `FREQ=DAILY;BYHOUR=${Number(clock.slice(0, 2))};BYMINUTE=${Number(clock.slice(3, 5))};BYSECOND=0`,
    timezone: 'Asia/Bangkok', start_date: utcMidnight('2026-01-01'), end_date: null, start_time: null, end_time: null, steps: [], role: 'none', ...rest, // SUPERSEDE-01c (2026-11-08): the role, stated
  };
};
const lineOf = (over: Partial<RoutineRow['steps'][number]> & { id: string; step_order: number }): RoutineRow['steps'][number] => ({
  is_active: true, budget_amount: null, coa_code: null, activity: over.id, time_of_day: null, duration_minutes: null, ...over,
});
/**
 * The day's routines, each with the case it proves:
 *   cowork 13:00–18:00 · $25.00 on 6200 — a window the flight overlaps → MARKED, its line out of the figure;
 *   dinner 19:00 · $30.00 on 6150 — a point after the flight → not marked;
 *   gym 15:00 · $20.00 on 6150 — a point inside the flight, but RECORDED → not marked (a record wins);
 *   day 07:00 · $10.00 on 6150 at the ROUTINE level, two uncosted lines (walk 15:00 for 30, read 20:00 for 60) — its walk is
 *     marked, its own figure never (routineFiguresUnmarked);
 *   lunch 12:00 · its line $12.00 on 6150 at 14:30 for 60 — a line window the flight overlaps → MARKED;
 *   nap 15:00 · no money — a window all the same, MARKED, on no line;
 *   lost — a zone that cannot be read: no window, counted unreadable.
 */
const ROUTINES: RoutineRow[] = [
  // SUPERSEDE-01c (2026-11-08): each with the role the card's fixture gives it (test G) — every one a stop.
  bkkRoutine({ id: 'cowork', clock: '13:00', role: 'execute', budget_amount: '25.00', coa_code: '6200', start_time: time('13:00'), end_time: time('18:00') }),
  bkkRoutine({ id: 'dinner', clock: '19:00', role: 'place', budget_amount: '30.00', coa_code: '6150' }),
  bkkRoutine({ id: 'gym', clock: '15:00', role: 'place', budget_amount: '20.00', coa_code: '6150' }),
  bkkRoutine({ id: 'day', clock: '07:00', role: 'execute', budget_amount: '10.00', coa_code: '6150', steps: [
    lineOf({ id: 'walk', step_order: 0, time_of_day: '15:00', duration_minutes: 30 }),
    lineOf({ id: 'read', step_order: 1, time_of_day: '20:00', duration_minutes: 60 }),
  ] }),
  bkkRoutine({ id: 'lunch', clock: '12:00', role: 'place', steps: [lineOf({ id: 'lunch-line', step_order: 0, budget_amount: '12.00', coa_code: '6150', time_of_day: '14:30', duration_minutes: 60 })] }),
  bkkRoutine({ id: 'nap', clock: '15:00', role: 'place' }),
  bkkRoutine({ id: 'lost', clock: '15:00', timezone: 'Mars/Olympus' }),
];
const RECORDS: StopRecordKeyRow[] = [{ routine_id: 'gym', step_id: null, occurrence_at: at(bkk('15:00')) }];
// SUPERSEDE-01c (2026-11-08, ruling B): and where the read reached — the DAY's range (Oct 1 … 15), two days each side; carried, never computed here.
const SUPERSESSION = { blocks: FLIGHT_READ.blocks, leftOut: FLIGHT_READ.leftOut, readFrom: '2026-09-29T00:00:00.000Z', readTo: '2026-10-18T00:00:00.000Z', records: RECORDS };

const rows = (over: Partial<ReportRows> = {}): ReportRows => ({
  entities: [P], chart: CHART, routines: [{ entityId: 'ent-p', rows: ROUTINES }], tasks: [], ledger: [],
  excludedLines: { reversalPairLines: 0, closingEntryLines: 0, linesAfterAsOf: 0 }, bank: [], planVendors: [], supersession: SUPERSESSION, ...over,
});
const key = (routineId: string, lineId: string | null, clock: string): string => occurrenceKey({ routineId, lineId, instant: at(bkk(clock)) });
const MARK: Supersession = { by: FLIGHT, more: 0 };

// ── A · THE BLOCKS READ ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('A the reads file: its four imports and no other — READS-01a\'s three reads, the travel leaf\'s helpers, the supersession leaf\'s rule words; no money column in its code or its comments; no ||, no ??; bookings never read', () => {
  const c = code(READS);
  assert.deepEqual(c.split('\n').filter((l) => /^import /.test(l)), [
    "import type { PrismaClient } from '@prisma/client';",
    "import { readOwnReservationIds, readPlannedTravel, readSegments } from '@/lib/operations/travelDayReads';",
    "import { clockOf, dayOf, instantOf, type InstantRange, type PlannedIn, type SegmentIn } from '@/lib/operations/travelDay';",
    "import { plannedKindOf, plannedNameOf, type TravelBlock, type TravelBlocksLeftOut } from '@/lib/operations/supersession';",
  ]);
  // The budget report route law's clause 2b reads the code; this reads the comments too — no money column is even named.
  assert.doesNotMatch(c + comments(READS), /\b(budget_line_items|cost|finalPriceCents|amount_minor|budget_amount|coa_code)\b/);
  assert.doesNotMatch(c, /\|\||\?\?/, 'no ||, no ?? — a row left out is counted by name');
  assert.doesNotMatch(c, /readBookingsOn|bookingsSelectionOf/, 'a booking carries no instants — never read for a block');
  assert.match(c, /type Db = Pick<PrismaClient, 'trip_itinerary' \| 'reservations' \| 'calendar_events'>;/);
  // SUPERSEDE-01c (Alex, 2026-11-08, ruling B): the reads take the range widened by BLOCK_REACH_DAYS each side and the answer says where it read (pin moved; supersede01c.test.ts drives it).
  assert.match(c, /export async function readTravelBlocks\(db: Db, userId: string, range: InstantRange\): Promise<TravelBlocksRead> \{\n\s*const reach: InstantRange = \{\n\s*from: new Date\(Date\.parse\(range\.from\) - BLOCK_REACH_DAYS \* DAY_MS\)\.toISOString\(\),\n\s*to: new Date\(Date\.parse\(range\.to\) \+ BLOCK_REACH_DAYS \* DAY_MS\)\.toISOString\(\),\n\s*\};\n\s*const planned = await readPlannedTravel\(db, userId, reach\);\n\s*const segments = await readSegments\(db, userId, \(await readOwnReservationIds\(db, userId\)\)\.map\(\(r\) => r\.id\), reach\);\n\s*return \{ \.\.\.blocksOfRows\(planned, segments\), readFrom: reach\.from, readTo: reach\.to \};\n\}/, 'the card\'s selections, through the three reads, over the reach — every where names the caller');
  assert.equal(BOOKINGS_NEVER_A_BLOCK, 'never a block');
});

test('A the flat list: a once row with both instants and a segment with both are blocks, ordered by start, end, key; every row left out is counted by its kind; bookings never a block', () => {
  const read = blocksOfRows(
    [
      plannedRow({ id: 'ti-flight' }),
      plannedRow({ id: 'ti-taxi', category: 'transfer', vendor: 'Airport taxi', vendor_name: null, homeTime: null, start_at: at(bkk('12:00')), end_at: at(bkk('13:00')) }),
      plannedRow({ id: 'ti-spa', category: 'wellness', vendor: 'Spa', vendor_name: 'Oasis Spa', homeTime: '18:00', start_at: at(bkk('18:00')), end_at: at(bkk('19:00')) }),
      plannedRow({ id: 'ti-hotel', recurrence: 'daily' }),
      plannedRow({ id: 'ti-none', start_at: null, end_at: null }),
      plannedRow({ id: 'ti-start', end_at: null }),
      plannedRow({ id: 'ti-end', start_at: null }),
    ],
    [segmentRow({ source_id: 'res-1:seg:0' }), segmentRow({ source_id: 'res-1:seg:1', start_at: null, end_at: null }), segmentRow({ source_id: 'res-1:seg:2', end_at: null })],
  );
  assert.deepEqual(read.blocks.map((b) => [b.key, b.kind, b.name, b.time, b.startAt, b.endAt]), [
    ['segment:res-1:seg:0:2026-10-15', 'flight', 'AirAsia DPS → CNX (flight)', '09:00', bkk('09:00'), bkk('11:00')],
    ['planned:ti-taxi', 'transfer', 'Airport taxi', null, bkk('12:00'), bkk('13:00')],
    ['planned:ti-flight', 'flight', 'AirAsia', '14:10', bkk('14:10'), bkk('17:05')],
    ['planned:ti-spa', 'other', 'Oasis Spa', '18:00', bkk('18:00'), bkk('19:00')],
  ], 'the kind by the one planned-category rule, the name as the card names a planned stop, the stated clock; by instant');
  assert.deepEqual(read.leftOut, { plannedDaily: 1, plannedNoInstants: 1, plannedOneInstant: 2, segmentsNoInstants: 1, segmentsOneInstant: 1 });
  assert.equal(read.bookings, 'never a block');
  // A tie on both instants falls to the key — the same order on every read.
  assert.deepEqual(blocksOfRows([plannedRow({ id: 'ti-y' }), plannedRow({ id: 'ti-x' })], []).blocks.map((b) => b.key), ['planned:ti-x', 'planned:ti-y']);
  // A row the selection never returns is the read's error, by name.
  assert.throws(() => blocksOfRows([plannedRow({ id: 'ti-w', recurrence: 'weekly' })], []), /trip_itinerary ti-w carries recurrence "weekly"/);
  assert.throws(() => blocksOfRows([], [segmentRow({ source_id: null })]), /no source_id/);
});

// ── B · THE ROUTES' TWO READS ───────────────────────────────────────────────────────────────────────────────────────────────

test('B the report route: after the gate, the range\'s blocks through the one read and its stop records by the one window — three columns, the caller\'s rows; both handed to the pure half', () => {
  const r = code(ROUTE);
  assert.match(r, /import \{ readTravelBlocks \} from '@\/lib\/operations\/travelBlocksReads';/);
  assert.match(r, /import \{ daysRangeOf \} from '@\/lib\/operations\/travelDay';/);
  assert.match(r, /import \{ recordsWindowOf \} from '@\/lib\/operations\/stopRecord';/);
  assert.match(r, /readTravelBlocks\(prisma, user\.id, daysRangeOf\(rangeFrom, rangeTo\)\),/, 'the view\'s range');
  assert.match(r, /prisma\.operations_stop_records\.findMany\(\{ where: \{ user_id: user\.id, occurrence_at: recordsWindowOf\(rangeFrom, rangeTo\) \}, select: \{ routine_id: true, step_id: true, occurrence_at: true \} \}\),/);
  // SUPERSEDE-01c (2026-11-08, ruling B): the hand-off carries where the read reached; the call is unchanged (pin moved).
  assert.match(r, /supersession: \{ blocks: travelBlocks\.blocks, leftOut: travelBlocks\.leftOut, readFrom: travelBlocks\.readFrom, readTo: travelBlocks\.readTo, records: stopRecords \},/);
  assert.equal((r.match(/readTravelBlocks\(/g) ?? []).length, 1);
  assert.equal((r.match(/operations_stop_records/g) ?? []).length, 1);
  assert.ok(r.indexOf("return NextResponse.json({ error: 'User not found' }, { status: 404 });") < r.indexOf('readTravelBlocks('), 'no read before the gate');
});

test('B the drill route: the same two reads over the figure\'s [from, to], after the book\'s defensive 404', () => {
  const c = code(CELL);
  assert.match(c, /readTravelBlocks\(prisma, user\.id, daysRangeOf\(query\.from, query\.to\)\),/);
  assert.match(c, /prisma\.operations_stop_records\.findMany\(\{ where: \{ user_id: user\.id, occurrence_at: recordsWindowOf\(query\.from, query\.to\) \}, select: \{ routine_id: true, step_id: true, occurrence_at: true \} \}\),/);
  // SUPERSEDE-01c (2026-11-08, ruling B): the same hand-off (pin moved).
  assert.match(c, /supersession: \{ blocks: travelBlocks\.blocks, leftOut: travelBlocks\.leftOut, readFrom: travelBlocks\.readFrom, readTo: travelBlocks\.readTo, records: stopRecords \} \}\)\);/);
  assert.ok(c.indexOf("if (book === null) return NextResponse.json({ error: 'unknown-book', message: UNKNOWN_BOOK_WORDS }, { status: 404 });") < c.indexOf('readTravelBlocks('), 'the book is the caller\'s first');
});

test('B recordsWindowOf: recordWindow\'s rule widened to the range — the first day\'s gte, the last day\'s lt — written once, beside it', () => {
  assert.deepEqual(recordsWindowOf(DAY, DAY), recordWindow(DAY), 'a day is the day\'s window');
  const october = recordsWindowOf('2026-10-01', '2026-10-31');
  assert.deepEqual([october.gte.toISOString(), october.lt.toISOString()], ['2026-09-30T10:00:00.000Z', '2026-11-01T12:00:00.000Z'], 'Oct 1 − 14h … Oct 31 + 36h: any zone\'s days');
  assert.throws(() => recordsWindowOf('2026-10-02', '2026-10-01'), /rangeFrom 2026-10-02 is after rangeTo 2026-10-01/);
  assert.equal((code('src/lib/operations/stopRecord.ts').match(/export function recordsWindowOf\(/g) ?? []).length, 1);
});

// ── C/D · THE MODEL AND THE REPORT ──────────────────────────────────────────────────────────────────────────────────────────

test('C markLines: a routine line takes the mark its key holds; a task line is never marked — by its branch, even if the map names it; nothing else changes', () => {
  const lines: BudgetLine[] = [
    { entityId: 'ent-p', code: '6150', day: DAY, cents: 500, source: 'routine', sourceId: key('gym', null, '15:00') },
    { entityId: 'ent-p', code: '6300', day: DAY, cents: 5000, source: 'task', sourceId: 'task:t1' },
    { entityId: 'ent-p', code: '6150', day: DAY, cents: 700, source: 'routine', sourceId: key('dinner', null, '19:00') },
  ];
  const marked = markLines(lines, new Map([[lines[0].sourceId, MARK], [lines[1].sourceId, MARK]]));
  assert.deepEqual(marked, [{ ...lines[0], superseded: MARK }, { ...lines[1], superseded: null }, { ...lines[2], superseded: null }]);
  assert.match(code(MODEL), /return lines\.map\(\(l\) => \(\{ \.\.\.l, superseded: l\.source === 'task' \? null : marks\.has\(l\.sourceId\) \? marks\.get\(l\.sourceId\)! : null \}\)\);/);
});

test('D figuresOf sums without the marked lines; ColumnTotals.superseded says how many left the budget and their cents', () => {
  const m = code(MODEL);
  assert.match(m, /const budgetFull = sumOrNull\(sel\.full\.filter\(\(l\) => l\.superseded === null\)\.map\(\(l\) => l\.cents\)\);/);
  assert.match(m, /const budgetToDate = sumOrNull\(sel\.toDate\.filter\(\(l\) => l\.superseded === null\)\.map\(\(l\) => l\.cents\)\);/);
  assert.match(m, /return \{ income, expense, net: netOf\(income, expense\), superseded: supersededOf\(placedLines, column\) \};/);
});

test('D THE DAY — its range is the month to date and the day (the MTD and the day columns): the marks list names every window of the day with its mark or null; the marked lines leave the figures and are counted in each column; the plan lines carry their marks', () => {
  const r = budgetReportResponse({ view: { kind: 'day', day: DAY }, asOf: ASOF }, rows());
  assert.deepEqual(r.report.columns.map((c) => [c.key, c.from, c.to]), [['mtd', '2026-10-01', DAY], [DAY, DAY, DAY]]);
  assert.ok(Array.isArray(r.supersession.marks));
  if (!Array.isArray(r.supersession.marks)) return;
  // Seven windows a day over October 1 … 15 (the lost routine contributes none); only the day's flight marks any.
  // SUPERSEDE-01c (Alex, 2026-11-08, ruling C): the list holds the DAY's own seven windows (was the range's 15 × 7) — `occurrences` still counts the range (pin moved).
  assert.equal(r.supersession.marks.length, 7);
  const onTheDay = r.supersession.marks.filter((m) => m.key.includes(`:${DAY}T`));
  assert.equal(onTheDay.length, r.supersession.marks.length, 'every listed window is on the day');
  assert.deepEqual(onTheDay, [
    { key: key('cowork', null, '13:00'), superseded: MARK },
    { key: key('dinner', null, '19:00'), superseded: null },
    { key: key('gym', null, '15:00'), superseded: null },
    { key: key('day', 'walk', '07:00'), superseded: MARK },
    { key: key('day', 'read', '07:00'), superseded: null },
    { key: key('lunch', 'lunch-line', '12:00'), superseded: MARK },
    { key: key('nap', null, '15:00'), superseded: MARK },
  ], 'the day\'s windows, routine by routine: cowork, dinner, gym (recorded — a record wins), the day\'s two lines, lunch\'s line, nap');
  assert.equal(r.supersession.marks.filter((m) => m.superseded !== null).length, 4, 'no other day is marked');
  assert.deepEqual({ ...r.supersession, marks: 'counted above' }, {
    // SUPERSEDE-01c (2026-11-08): where the read reached (carried), the list's length (the day's 7) and the all_day occurrences (none here) join.
    blocks: 1, leftOut: FLIGHT_READ.leftOut, readFrom: '2026-09-29T00:00:00.000Z', readTo: '2026-10-18T00:00:00.000Z', bookings: 'never a block', records: 1, occurrences: 15 * 7, listed: 7, allDay: 0, marked: 4, routineFiguresUnmarked: 1, unreadable: 1, marks: 'counted above',
  });
  // THE DAY: 6150 = dinner 3000 + gym 2000 + the day's own figure 1000 = 6000 — lunch's 1200 left; 6200: cowork's 2500 left, no line remains.
  // THE MTD: 15 days × (3000 + 2000 + 1000 + 1200) − 1200 on 6150; 15 × 2500 − 2500 on 6200.
  const cell = (codeOf: string, i: number) => r.report.books[0].rows.find((x) => x.code === codeOf)!.cells[i];
  assert.deepEqual([cell('6150', 1).budgetFull, cell('6200', 1).budgetFull], [6000, null]);
  assert.deepEqual([cell('6150', 0).budgetFull, cell('6200', 0).budgetFull], [15 * 7200 - 1200, 15 * 2500 - 2500]);
  for (const i of [0, 1]) {
    assert.deepEqual(r.report.totals[i].superseded, { count: 2, cents: 2500 + 1200 }, `${r.report.columns[i].key}: the marked LINES — cowork and lunch (the walk and the nap price nothing)`);
    assert.deepEqual(r.report.books[0].totals[i].superseded, { count: 2, cents: 3700 }, 'the book\'s own scope says the same');
  }
  assert.equal(r.records.budgetLines.routine, 15 * 5, 'every line still built: cowork, dinner, gym, the day\'s figure, lunch — fifteen days');
  assert.ok(r.plans.listed);
  if (!r.plans.listed) return;
  assert.deepEqual(r.plans.lines.map((l) => [l.label, l.cents, l.superseded === null ? null : l.superseded.by.key]), [
    ['day', 1000, null], ['cowork', 2500, 'planned:ti-flight'], ['lunch', 1200, 'planned:ti-flight'], ['gym', 2000, null], ['dinner', 3000, null],
  ], 'the day\'s plan lines by their own clocks (07:00, 13:00, the lunch line\'s 14:30, 15:00, 19:00) — the struck ones carried, never dropped');
});

test('D THE YEAR carries counts only; its month and YTD say the superseded occurrences and cents; the figures are the lines less the marked ones', () => {
  const r = budgetReportResponse({ view: { kind: 'year', year: 2026 }, asOf: ASOF }, rows({ planVendors: null }));
  assert.equal(r.supersession.marks, YEAR_MARKS_WORDS);
  assert.equal(YEAR_MARKS_WORDS, 'a year carries counts only');
  assert.deepEqual([r.supersession.occurrences, r.supersession.marked, r.supersession.unreadable], [365 * 7, 4, 1], 'seven windows a day, four of them on the one flight');
  const columns = r.report.columns.map((c, i) => [c.key, r.report.totals[i].superseded.count, r.report.totals[i].superseded.cents]);
  for (const [k, count, cents] of columns) {
    const expected = k === '2026-10' || k === 'ytd' ? [2, 3700] : [0, 0];
    assert.deepEqual([count, cents], expected, `${k}`);
  }
  const october = r.report.columns.findIndex((c) => c.key === '2026-10');
  const row = (codeOf: string) => r.report.books[0].rows.find((x) => x.code === codeOf)!.cells[october];
  // October: 31 days × (dinner 3000 + gym 2000 + the day's figure 1000 + lunch 1200) − lunch's 1200 on the 15th; cowork 31 × 2500 − 2500.
  assert.deepEqual([row('6150').budgetFull, row('6200').budgetFull], [31 * 7200 - 1200, 31 * 2500 - 2500]);
});

test('D a record naming neither a routine nor a line is the read\'s error, by name — never read as no record', () => {
  assert.throws(
    () => budgetReportResponse({ view: { kind: 'day', day: DAY }, asOf: ASOF }, rows({ supersession: { ...SUPERSESSION, records: [{ routine_id: null, step_id: null, occurrence_at: at(bkk('15:00')) }] } })),
    (e: unknown) => e instanceof BudgetInputError && e.code === 'record-unreadable',
  );
});

// ── E · THE DRILL ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('E THE DRILL lists the struck line with its mark, sums without it, counts it beside the sum, and prints the report\'s figure', () => {
  const report = budgetReportResponse({ view: { kind: 'year', year: 2026 }, asOf: ASOF }, rows({ planVendors: null }));
  const october = report.report.columns.findIndex((c) => c.key === '2026-10');
  for (const [account, printedCents, struck] of [['6200', 75000, { count: 1, cents: 2500 }], ['6150', 222000, { count: 1, cents: 1200 }]] as const) {
    const q = parseCellQuery(new URLSearchParams({ book: 'ent-p', account, from: '2026-10-01', to: '2026-10-31', asOf: ASOF }), ASOF);
    assert.ok(q.ok);
    if (!q.ok) return;
    const cell = budgetCellResponse(q, { book: P, chart: CHART, routines: ROUTINES, tasks: [], ledger: [], planVendors: [], supersession: SUPERSESSION });
    const marked = cell.budget.lines.filter((l) => l.superseded !== null);
    assert.deepEqual(marked.map((l) => [l.day, l.superseded]), [[DAY, MARK]], `${account}: one struck line, listed`);
    assert.deepEqual(cell.budget.superseded, struck);
    assert.equal(cell.budget.sum, printedCents, `${account}: the lines no block superseded`);
    assert.equal(cell.budget.cell, printedCents);
    assert.equal(report.report.books[0].rows.find((x) => x.code === account)!.cells[october].budgetFull, printedCents, `${account}: the figure the viewer clicked`);
  }
});

test('E the drill screen strikes a marked line through and says its mark after its label; the count under the lines, never in the sum', () => {
  const s = code(SCREEN);
  assert.match(s, /\{l\.superseded !== null && <span className="text-brand-amber" data-drill-superseded-words> · \{supersededWords\(l\.superseded\)\}<\/span>\}/);
  assert.match(s, /<td className=\{`\$\{num\}\$\{l\.superseded === null \? '' : ' line-through text-text-faint'\}`\}>\{formatCents\(l\.cents\)\}<\/td>/);
  assert.match(s, /\{b\.superseded\.count > 0 && <p className="text-xs text-brand-amber" data-drill-superseded-sum>\{drillSupersededWords\(b\.superseded\)\}<\/p>\}/);
  assert.equal(supersededWords(MARK), 'superseded by Flight AirAsia 14:10');
  assert.equal(drillSupersededWords({ count: 1, cents: 2500 }), '1 superseded by travel — $25.00 listed, not in the sum');
});

// ── F · THE SCREEN ──────────────────────────────────────────────────────────────────────────────────────────────────────────

test('F the gap line is gone from src — no file\'s code holds its constant, its sentence or its attribute', () => {
  const at_ = (rel: string) => resolve(process.cwd(), rel);
  const files = (dir: string): string[] =>
    readdirSync(at_(dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === '__tests__' ? [] : files(`${dir}/${d.name}`)) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []));
  const holding = files('src').filter((f) => /SUPERSEDED_GAP_WORDS|this table does not yet|data-budget-superseded-gap/.test(code(f)));
  assert.deepEqual(holding, []);
});

test('F the SUPERSEDED BY TRAVEL row: after the BANK row, under the book tables — one cell per column, the count and the plan cents or a dash', () => {
  const s = code(SCREEN);
  assert.match(s, /\{report\.books\.map\(\(book, i\) => \(\n\s*<BookTable [^\n]*\/>\n\s*\)\)\}\n(?:\s*\{\s*\}\n)?\s*<BankRow columns=\{report\.columns\} notInBooks=\{notInBooks\} \/>\n(?:\s*\{\s*\}\n)?\s*<SupersededRow columns=\{report\.columns\} totals=\{report\.totals\} \/>\n\s*<\/>/, 'the book tables, the BANK row, the SUPERSEDED row');
  assert.match(s, /\{columns\.map\(\(c, i\) => <td key=\{c\.key\} className=\{num\} data-budget-superseded-cell=\{c\.key\}>\{supersededCellWords\(totals\[i\]\.superseded\)\}<\/td>\)\}/);
  assert.doesNotMatch(s.slice(s.indexOf('function SupersededRow('), s.indexOf('export default function BudgetReport(')), /onClick|<button|href=/, 'the cells do not drill');
  assert.equal(SUPERSEDED_ROW_LABEL, 'SUPERSEDED BY TRAVEL — not counted');
  assert.equal(supersededCellWords({ count: 0, cents: 0 }), '—');
  assert.equal(supersededCellWords({ count: 2, cents: 3700 }), '2 · $37.00');
});

// ── G · THE CARD TAKES THE MARK ─────────────────────────────────────────────────────────────────────────────────────────────

test('G the card runs no rule and builds no block: each routine and line stop looks its mark up by the occurrence key; a key the report lacks, or no report, is undecided and counted', () => {
  const rules = code(RULES);
  assert.doesNotMatch(rules, /supersessionOf\(|travelBlocksOf/);
  assert.match(rules, /import \{ centsFromDecimalString, occurrenceKey, type NotPlaced \} from '@\/lib\/budget\/days';/);
  assert.equal((rules.match(/occurrenceKeyOf\.set\(key, occurrenceKey\(\{ routineId: r\.id, lineId: (?:null|step\.id), instant: occurrence \}\)\);/g) ?? []).length, 2, 'a stepless routine and each line');
  assert.match(rules, /if \(input\.marks === null \|\| !input\.marks\.has\(key\)\) \{\n\s*supersessionUndecided \+= 1;\n\s*return s;\n\s*\}/);
  const card = code(CARD);
  assert.match(card, /const marks = report !== null && report\.ok \? marksOf\(report\.value\.supersession\) : null;/, 'the report\'s marks, null while not read');
  assert.match(card, /dayStops\(\{ day, entries, lines, notPlaced, items: dayItems, viewerZone: zone, records: recordRows, travel: travelRows, marks \}\)/);
});

test('G the card takes the day report\'s marks — the stops a block supersedes are exactly the windows the report marked; nothing undecided', () => {
  const r = budgetReportResponse({ view: { kind: 'day', day: DAY }, asOf: ASOF }, rows());
  const marks = marksOf(r.supersession);
  const step = (over: Partial<RoutineStep> & { id: string; routine_id: string; step_order: number }): RoutineStep => ({
    user_id: 'u', entity_id: 'P', activity: over.id, time_of_day: null, sub_activity: null, location: null, duration_minutes: null, notes: null,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
  });
  const daily = (clock: string) => `FREQ=DAILY;BYHOUR=${Number(clock.slice(0, 2))};BYMINUTE=${Number(clock.slice(3, 5))}`;
  const entries = [
    entry(cardRoutine({ id: 'cowork', name: 'Coworking', role: 'execute', schedule_rrule: daily('13:00'), start_time: '1970-01-01T13:00:00.000Z', end_time: '1970-01-01T18:00:00.000Z' }), bkk('13:00')),
    entry(cardRoutine({ id: 'dinner', name: 'Dinner', role: 'place', schedule_rrule: daily('19:00') }), bkk('19:00')),
    entry(cardRoutine({ id: 'gym', name: 'Gym', role: 'place', schedule_rrule: daily('15:00') }), bkk('15:00')),
    entry(cardRoutine({ id: 'day', name: 'Day', role: 'execute', schedule_rrule: daily('07:00'), steps: [
      step({ id: 'walk', routine_id: 'day', step_order: 0, time_of_day: '1970-01-01T15:00:00.000Z', duration_minutes: 30 }),
      step({ id: 'read', routine_id: 'day', step_order: 1, time_of_day: '1970-01-01T20:00:00.000Z', duration_minutes: 60 }),
    ] }), bkk('07:00')),
    entry(cardRoutine({ id: 'lunch', name: 'Lunch', role: 'place', schedule_rrule: daily('12:00'), steps: [step({ id: 'lunch-line', routine_id: 'lunch', step_order: 0, time_of_day: '1970-01-01T14:30:00.000Z', duration_minutes: 60 })] }), bkk('12:00')),
    entry(cardRoutine({ id: 'nap', name: 'Nap', role: 'place', schedule_rrule: daily('15:00') }), bkk('15:00')),
  ];
  const result = dayStops(input({ day: DAY, entries, marks }));
  assert.deepEqual(result.stops.filter((s) => s.superseded !== null).map((s) => [s.key, s.status, s.statusSource, s.superseded]), [
    [`routine:cowork:${bkk('13:00')}`, 'skipped', 'travel', MARK],
    [`line:lunch-line:${bkk('12:00')}`, 'skipped', 'travel', MARK],
    [`line:walk:${bkk('07:00')}`, 'skipped', 'travel', MARK],
    [`routine:nap:${bkk('15:00')}`, 'skipped', 'travel', MARK],
  ], 'in clock order — 13:00, 14:30, 15:00 (Day, then Nap) — each skipped by the block the report named');
  assert.equal(result.supersessionUndecided, 0, 'the report listed every occurrence of the day');
});

// ── H4 · THE BUDGET ROW'S THREE RE-CITED LINES ──────────────────────────────────────────────────────────────────────────────

test('H4 the Budget row\'s three reportInputs.ts citations name the lines that hold what their words say — read back from the registry, not typed here', () => {
  const cite = /src\/lib\/budget\/reportInputs\.ts:(\d+) \(the rows → the model\\'s input, once\) · :(\d+) \(the drill\\'s query\) · :(\d+) \(the lines behind a figure\)/.exec(code(REGISTRY));
  assert.ok(cite, 'the Budget row cites the three');
  if (cite === null) return;
  const lines = code(INPUTS).split('\n');
  assert.match(lines[Number(cite[1]) - 1], /^function reportInputOf<L extends LedgerRow>\(view: BudgetView, rows: InputRows<L>\) \{$/);
  assert.match(lines[Number(cite[2]) - 1], /^export function parseCellQuery\(params: /);
  assert.match(lines[Number(cite[3]) - 1], /^export function budgetCellResponse\(query: /);
  assert.match(comments(REGISTRY), /SUPERSEDE-01b \(Alex, 2026-11-08, ruling H\): every number below re-cited to the line that holds what its words name — reportInputs\.ts :450\/:579\/:698 stale since BUDGET-02/);
});
