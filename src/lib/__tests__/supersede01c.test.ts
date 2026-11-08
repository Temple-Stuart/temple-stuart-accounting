/**
 * SUPERSEDE-01c (Alex, 2026-11-08, rulings A–F) — THE SCOPE OF A MARK.
 *
 *   A · an all_day routine is never superseded — the card's rule (stopRole.ts isStop), one owner: the role rides into the plan
 *       input through the one role rule (isStopRole — a role outside the six refused by name, 'role-unreadable'), and
 *       days.ts routineSupersessionOf builds no window for it, counting its occurrences (allDay);
 *   B · a travel block is read wherever it can reach the range — the read widens the range it is handed by BLOCK_REACH_DAYS
 *       each side and says where it read (readFrom, readTo); the routes' call text is unchanged;
 *   C · the DAY/WEEK marks list carries the view's own days — a DAY its day (the card's keys), a WEEK its seven; `listed`
 *       says how many, `occurrences` still counts the range;
 *   D · the ledger answer's records window is stopRecord.ts recordsWindowOf — one owner.
 *
 * The rules are DRIVEN over fixtures (the read over a recording fake db, the model, the report); the source is read through
 * code() and comments() (the reader law). Every figure is integer cents, worked by hand beside it. This file imports nothing
 * from @prisma/client and pins no line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLOCK_REACH_DAYS, blocksOfRows, readTravelBlocks, type BlockPlannedRow, type BlockSegmentRow } from '../operations/travelBlocksReads';
import { readPlannedTravel } from '../operations/travelDayReads';
import { daysRangeOf } from '../operations/travelDay';
import { STOP_ROLES } from '../operations/stopRole';
import { occurrenceKey, routineSupersessionOf, type RoutinePlanInput } from '../budget/days';
import {
  budgetReportResponse, toReportEntity, toRoutinePlanInput, BudgetInputError, YEAR_MARKS_WORDS,
  type BudgetChartRow, type EntityRow, type ReportRows, type RoutineRow,
} from '../budget/reportInputs';
import type { Supersession } from '../operations/supersession';

const THIS = 'src/lib/__tests__/supersede01c.test.ts';
const DAYS = 'src/lib/budget/days.ts';
const INPUTS = 'src/lib/budget/reportInputs.ts';
const READS = 'src/lib/operations/travelBlocksReads.ts';
const ROUTE = 'src/app/api/budget/report/route.ts';
const CELL = 'src/app/api/budget/report/cell/route.ts';
const LEDGER_ANSWER = 'src/lib/operations/ledgerAnswer.ts';

/** The doc comment directly above the first code line that starts with `head` — read through comments(), never a line number. */
const docAbove = (file: string, head: string): string => {
  const codeLines = code(file).split('\n');
  const at = codeLines.findIndex((l) => l.startsWith(head));
  assert.ok(at > 0, `${file}: ${head} is there`);
  const commentLines = comments(file).split('\n');
  const doc: string[] = [];
  for (let i = at - 1; i >= 0 && commentLines[i].trim() !== ''; i -= 1) doc.unshift(commentLines[i]);
  return doc.join('\n');
};

// ── FIXTURES — Bangkok (UTC+7) and a planned flight 14:10–17:05 on 2026-10-15 with both instants ───────────────────────────

const DAY = '2026-10-15';
const ASOF = '2026-11-08';
const bkk = (clock: string, day: string = DAY): string => new Date(`${day}T${clock}:00.000+07:00`).toISOString();
const at = (iso: string): Date => new Date(iso);
const utcMidnight = (day: string): Date => new Date(`${day}T00:00:00.000Z`);
const plannedRow = (over: Partial<BlockPlannedRow> & { id: string }): BlockPlannedRow => ({
  category: 'flight', vendor: 'CNX → DPS', vendor_name: 'AirAsia', recurrence: 'once', homeTime: '14:10', start_at: at(bkk('14:10')), end_at: at(bkk('17:05')), ...over,
});
const FLIGHT_READ = blocksOfRows([plannedRow({ id: 'ti-flight' })], []);
const MARK: Supersession = { by: FLIGHT_READ.blocks[0], more: 0 };

const P: EntityRow = { id: 'ent-p', name: 'Alex', entity_type: 'personal' };
const CHART: BudgetChartRow[] = [
  { entity_id: 'ent-p', code: '6150', name: 'Meals', account_type: 'expense', balance_type: 'D', is_archived: false },
  { entity_id: 'ent-p', code: '6300', name: 'Subscriptions', account_type: 'expense', balance_type: 'D', is_archived: false },
];
const bkkRoutine = (over: Partial<RoutineRow> & { id: string; clock: string; role: string }): RoutineRow => {
  const { clock, ...rest } = over;
  return {
    name: rest.id, budget_amount: null, coa_code: null, schedule_rrule: `FREQ=DAILY;BYHOUR=${Number(clock.slice(0, 2))};BYMINUTE=${Number(clock.slice(3, 5))};BYSECOND=0`,
    timezone: 'Asia/Bangkok', start_date: utcMidnight('2026-01-01'), end_date: null, start_time: null, end_time: null, steps: [], ...rest,
  };
};
/**
 * The day's routines, each with the case it proves:
 *   gym 15:00 · place · $20.00 on 6150 — a point inside the flight → MARKED, out of the figure;
 *   fee 15:00 · all_day · $1.00 on 6300 — the same instant, but no stop → NO window, counted (allDay); its dollar stays in;
 *   early 05:00 · journal · no money — 22:00Z the UTC day before, listed on its LOCAL day;
 *   coffee 08:00 · place · $5.00 on 6150 — before the flight → listed, unmarked.
 */
const ROUTINES: RoutineRow[] = [
  bkkRoutine({ id: 'gym', clock: '15:00', role: 'place', budget_amount: '20.00', coa_code: '6150' }),
  bkkRoutine({ id: 'fee', clock: '15:00', role: 'all_day', budget_amount: '1.00', coa_code: '6300' }),
  bkkRoutine({ id: 'early', clock: '05:00', role: 'journal' }),
  bkkRoutine({ id: 'coffee', clock: '08:00', role: 'place', budget_amount: '5.00', coa_code: '6150' }),
];
const READ_ENDS = { readFrom: '2026-09-29T00:00:00.000Z', readTo: '2026-10-18T00:00:00.000Z' };
const rows = (over: Partial<ReportRows> = {}): ReportRows => ({
  entities: [P], chart: CHART, routines: [{ entityId: 'ent-p', rows: ROUTINES }], tasks: [], ledger: [],
  excludedLines: { reversalPairLines: 0, closingEntryLines: 0, linesAfterAsOf: 0 }, bank: [], planVendors: [],
  supersession: { blocks: FLIGHT_READ.blocks, leftOut: FLIGHT_READ.leftOut, ...READ_ENDS, records: [] }, ...over,
});
const key = (routineId: string, clock: string, day: string = DAY): string => occurrenceKey({ routineId, lineId: null, instant: at(bkk(clock, day)) });

// ── A · AN ALL_DAY LINE IS NEVER SUPERSEDED ───────────────────────────────────────────────────────────────────────────────

test('A days.ts imports isStop and type StopRole from the one role module; RoutinePlanInput.role is required, never optional', () => {
  const days = code(DAYS);
  assert.match(days, /import \{ isStop, type StopRole \} from '@\/lib\/operations\/stopRole';/);
  assert.match(days, /readonly role: StopRole;/);
  assert.doesNotMatch(days, /readonly role\?:/, 'never optional');
  assert.match(days, /if \(!isStop\(routine\.role\)\) \{\n\s*allDay \+= 1;\n\s*continue;\n\s*\}/, 'the one rule — no window, counted');
  // @ts-expect-error — a plan input without its role does not compile (tsc --noEmit reads this file).
  const noRole: RoutinePlanInput = { id: 'r', name: 'r', entityId: 'e', entityType: 'personal', timezone: 'UTC', scheduleRrule: 'FREQ=DAILY', startDate: null, endDate: null, budgetAmount: null, coaCode: null, startTime: null, endTime: null, steps: [] };
  assert.equal('role' in noRole, false);
});

test('A toRoutinePlanInput carries the role through isStopRole — every one of the six as read; a role outside them refused by name, \'role-unreadable\'', () => {
  const row = bkkRoutine({ id: 'r-1', clock: '09:00', role: 'none' });
  for (const role of STOP_ROLES) assert.equal(toRoutinePlanInput({ ...row, role }, toReportEntity(P)).role, role);
  assert.throws(
    () => toRoutinePlanInput({ ...row, role: 'driver' }, toReportEntity(P)),
    (e: unknown) => e instanceof BudgetInputError && e.code === 'role-unreadable' && /routine r-1 carries role "driver" — not one of the six/.test(e.message),
  );
  assert.match(code(INPUTS), /import \{ isStopRole \} from '@\/lib\/operations\/stopRole';/);
  // The report refuses the same row the same way — never read as a stop, never defaulted.
  assert.throws(
    () => budgetReportResponse({ view: { kind: 'day', day: DAY }, asOf: ASOF }, rows({ routines: [{ entityId: 'ent-p', rows: [{ ...row, role: '' }] }] })),
    (e: unknown) => e instanceof BudgetInputError && e.code === 'role-unreadable',
  );
});

// ── B · A BLOCK IS READ WHEREVER IT CAN REACH THE RANGE ───────────────────────────────────────────────────────────────────

/** A recording fake of the three tables the read reads — each where kept; the once rows and the segments answered by the where's window. */
const fakeDb = (planned: readonly (BlockPlannedRow & { homeDate: Date })[], segments: readonly (BlockSegmentRow & { start_date: Date })[]) => {
  const wheres: { readonly table: string; readonly where: Record<string, unknown> }[] = [];
  type Window = { gte: Date; lt: Date };
  const db = {
    trip_itinerary: {
      findMany: async (args: { where: { OR: [{ homeDate: Window }, unknown] } }) => {
        wheres.push({ table: 'trip_itinerary', where: args.where as unknown as Record<string, unknown> });
        const w = args.where.OR[0].homeDate;
        return planned.filter((r) => r.recurrence === 'once' && r.homeDate >= w.gte && r.homeDate < w.lt);
      },
    },
    reservations: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        wheres.push({ table: 'reservations', where: args.where });
        return [{ id: 'res-1' }];
      },
    },
    calendar_events: {
      findMany: async (args: { where: { start_date: Window } }) => {
        wheres.push({ table: 'calendar_events', where: args.where as unknown as Record<string, unknown> });
        const w = args.where.start_date;
        return segments.filter((s) => s.start_date >= w.gte && s.start_date < w.lt);
      },
    },
  };
  return { db: db as unknown as Parameters<typeof readTravelBlocks>[0], wheres };
};
const mks = (day: string, clock: string): Date => new Date(`${day}T${clock}:00.000+08:00`); // Asia/Makassar
/** The red-eye: 31 Oct 23:30 → 1 Nov 06:30 Makassar — dated the day before the range it reaches. */
const RED_EYE = { ...plannedRow({ id: 'ti-red-eye', vendor: 'DPS → SIN', vendor_name: 'Night flight', homeTime: '23:30', start_at: mks('2026-10-31', '23:30'), end_at: mks('2026-11-01', '06:30') }), homeDate: utcMidnight('2026-10-31') };

test('B BLOCK_REACH_DAYS is 2 — its doc names the longest flight (19 h) and the widest pair of zones (26 h)', () => {
  assert.equal(BLOCK_REACH_DAYS, 2);
  const doc = docAbove(READS, 'export const BLOCK_REACH_DAYS = 2;');
  assert.match(doc, /19 h/);
  assert.match(doc, /26 h/);
  assert.match(doc, /routineSupersessionOf still builds\s*\*?\s*windows for \[rangeFrom, rangeTo\] only/);
});

test('B readTravelBlocks reads [from − 2 d, to + 2 d) for BOTH reads — every where the caller\'s — and says where it read; the red-eye dated the day before is read', async () => {
  const { db, wheres } = fakeDb([RED_EYE], [{ source_id: 'res-1:seg:0', title: 'SQ 939 (flight)', start_date: utcMidnight('2026-11-03'), start_time: null, start_at: mks('2026-11-03', '10:00'), end_at: mks('2026-11-03', '12:00') }]);
  const read = await readTravelBlocks(db, 'u-1', daysRangeOf('2026-11-01', '2026-11-01'));
  const reach = { gte: utcMidnight('2026-10-30'), lt: utcMidnight('2026-11-04') };
  assert.deepEqual([read.readFrom, read.readTo], ['2026-10-30T00:00:00.000Z', '2026-11-04T00:00:00.000Z'], 'Nov 1 … Nov 1 is [Nov 1, Nov 2) — two days each side');
  assert.deepEqual(wheres.map((w) => w.table), ['trip_itinerary', 'reservations', 'calendar_events']);
  const planned = wheres[0].where as { trip: unknown; OR: [{ recurrence: string; homeDate: unknown }, { recurrence: string; homeDate: unknown; destDate: unknown }] };
  assert.deepEqual(planned.trip, { userId: 'u-1' });
  assert.deepEqual(planned.OR[0], { recurrence: 'once', homeDate: reach });
  assert.deepEqual(planned.OR[1], { recurrence: 'daily', homeDate: { lt: reach.lt }, destDate: { gte: reach.gte } });
  assert.deepEqual(wheres[1].where, { userId: 'u-1' });
  assert.equal((wheres[2].where as { user_id: string }).user_id, 'u-1');
  assert.deepEqual((wheres[2].where as { start_date: unknown }).start_date, reach);
  assert.deepEqual(read.blocks.map((b) => b.key), ['planned:ti-red-eye', 'segment:res-1:seg:0:2026-11-03'], 'the red-eye of Oct 31 and a segment two days on');
  // As main read it — the range as given — the red-eye is never read.
  const narrow = fakeDb([RED_EYE], []);
  assert.deepEqual(await readPlannedTravel(narrow.db, 'u-1', daysRangeOf('2026-11-01', '2026-11-01')), []);
  // Reading wider never marks a window no block overlaps: the 06:00 Makassar occurrence of Nov 1 is inside the red-eye; 07:00 is not.
  const at6 = { id: 'walk', name: 'Walk', entityId: 'ent-p', entityType: 'personal', timezone: 'Asia/Makassar', scheduleRrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0;BYSECOND=0', startDate: '2026-01-01', endDate: null, budgetAmount: null, coaCode: null, startTime: null, endTime: null, role: 'none', steps: [] } as const satisfies RoutinePlanInput;
  const at7 = { ...at6, id: 'run', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0' } as const satisfies RoutinePlanInput;
  const s = routineSupersessionOf([at6, at7], '2026-11-01', '2026-11-01', read.blocks, new Set());
  assert.deepEqual([...s.marks.keys()], [occurrenceKey({ routineId: 'walk', lineId: null, instant: mks('2026-11-01', '06:00') })]);
  assert.deepEqual(s.occurrences.map((o) => o.day), ['2026-11-01', '2026-11-01'], 'windows for the range only — never the reach');
});

test('B the routes\' call text is unchanged — the read owns its reach; their hand-off carries where it read', () => {
  const r = code(ROUTE);
  const c = code(CELL);
  assert.match(r, /readTravelBlocks\(prisma, user\.id, daysRangeOf\(rangeFrom, rangeTo\)\),/);
  assert.match(c, /readTravelBlocks\(prisma, user\.id, daysRangeOf\(query\.from, query\.to\)\),/);
  for (const src of [r, c]) assert.match(src, /readFrom: travelBlocks\.readFrom, readTo: travelBlocks\.readTo/);
  assert.doesNotMatch(r + c, /BLOCK_REACH_DAYS/, 'no route widens the range itself');
});

// ── C · THE MARKS LIST IS THE VIEW'S DAYS ─────────────────────────────────────────────────────────────────────────────────

test('C a DAY lists only its own day\'s windows (the card\'s keys) — each local day, so the 05:00 window of 22:00Z the day before is on it; `occurrences` still counts the range; `listed`, `allDay`, `readFrom`/`readTo` said', () => {
  const r = budgetReportResponse({ view: { kind: 'day', day: DAY }, asOf: ASOF }, rows());
  assert.deepEqual(r.supersession.marks, [
    { key: key('gym', '15:00'), superseded: MARK },
    { key: key('early', '05:00'), superseded: null },
    { key: key('coffee', '08:00'), superseded: null },
  ], 'gym, early, coffee — by routine; the fee is no stop: never listed');
  assert.equal(key('early', '05:00'), 'routine:early:routine:2026-10-14T22:00:00.000Z', 'its instant is on the UTC day before');
  assert.deepEqual({ ...r.supersession, marks: 'above' }, {
    blocks: 1, leftOut: FLIGHT_READ.leftOut, ...READ_ENDS, bookings: 'never a block', records: 0,
    occurrences: 15 * 3, listed: 3, allDay: 15, marked: 1, routineFiguresUnmarked: 0, unreadable: 0, marks: 'above',
  }, 'the range is Oct 1 … 15: three stops a day; the fee fifteen times, never a window');
  // The fee's dollar stays in its figure — a membership is paid while you fly; the gym's $20.00 leaves the day.
  const cell = (codeOf: string, i: number) => r.report.books[0].rows.find((x) => x.code === codeOf)!.cells[i];
  assert.deepEqual([cell('6150', 1).budgetFull, cell('6300', 1).budgetFull], [500, 100], 'the DAY: coffee alone on 6150; the fee on 6300');
  assert.deepEqual([cell('6150', 0).budgetFull, cell('6300', 0).budgetFull], [15 * 2500 - 2000, 15 * 100], 'the MTD: less the one gym');
  assert.deepEqual(r.report.totals.map((t) => t.superseded), [{ count: 1, cents: 2000 }, { count: 1, cents: 2000 }], 'one struck line in each column — never the fee');
});

test('C a WEEK lists its seven days — its range, every window; a YEAR says the words and lists none', () => {
  const week = budgetReportResponse({ view: { kind: 'week', weekOf: DAY }, asOf: ASOF }, rows());
  assert.ok(Array.isArray(week.supersession.marks));
  if (!Array.isArray(week.supersession.marks)) return;
  assert.deepEqual([week.supersession.occurrences, week.supersession.listed, week.supersession.marks.length, week.supersession.allDay], [7 * 3, 7 * 3, 7 * 3, 7], 'Mon Oct 12 … Sun Oct 18');
  assert.deepEqual(week.supersession.marks.filter((m) => m.superseded !== null).map((m) => m.key), [key('gym', '15:00')]);
  const year = budgetReportResponse({ view: { kind: 'year', year: 2026 }, asOf: ASOF }, rows({ planVendors: null }));
  assert.equal(year.supersession.marks, YEAR_MARKS_WORDS);
  assert.deepEqual([year.supersession.occurrences, year.supersession.listed, year.supersession.allDay, year.supersession.marked], [365 * 3, 0, 365, 1]);
});

// ── D · THE RECORDS WINDOW, ONE OWNER ─────────────────────────────────────────────────────────────────────────────────────

test('D ledgerAnswer.ts reads its records and their links by stopRecord.ts recordsWindowOf — no inline window, no HOUR_MS', () => {
  const a = code(LEDGER_ANSWER);
  assert.match(a, /import \{ recordsWindowOf, refusedWords, stopRecordRowOf \} from '@\/lib\/operations\/stopRecord';/);
  assert.match(a, /db\.operations_stop_records\.findMany\(\{\n\s*where: \{ user_id: userId, occurrence_at: recordsWindowOf\(from, to\) \},/);
  assert.match(a, /target_instant: recordsWindowOf\(from, to\), journal_entry: \{ userId: userId \}/);
  assert.doesNotMatch(a, /14 \* HOUR_MS|36 \* HOUR_MS|\bHOUR_MS\b|recordsFrom|recordsTo/);
  assert.match(a, /const vendorsFrom = new Date\(Date\.parse\(`\$\{from\}T00:00:00\.000Z`\) - DAY_MS\);/, 'DAY_MS stays for the vendors\' window');
});

// ── THIS TEST ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('this test pins no line number of any file', () => {
  assert.doesNotMatch(code(THIS), /split\('\\n'\)\[\d+\]|\.ts:\d+/);
});
