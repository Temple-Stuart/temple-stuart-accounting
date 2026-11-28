/**
 * TIMESHEET-01 (Alex, 2026-11-24) — THE TIME SHEET, PART ONE: every priced line of the period, planned and recorded.
 *
 * /time's first table stops being a list of what was recorded and becomes the sheet of what was planned on Expenses, with
 * what was recorded on it. ADDITIVE: the answer's `rows` are what main gives for the same data, and it gains ONE list,
 * `sheet` — the table's rows — with three columns beside the facts they extend: START and END after DATE, WENT after VENDOR.
 *
 * The rule (src/lib/operations/ledger.ts ledgerOf) is DRIVEN over a fixture built the Budget's own way, as ledger01's and
 * ledger04's are: HERMETIC — no database, no network, and the only clock is the `now` handed in. Every name, place and
 * amount below is made up. The answer function is driven through a fake client; the read through a stubbed fetch; the
 * section, the route, the registry and the page are anchored to their source with comments stripped (the reader law).
 * No pin here names a line number of any file — every pin finds its line by content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import { buildRoutineBudgetLines, occurrenceKey, readOccurrenceKey, type RoutinePlanInput } from '../budget/days';
import type { BudgetLine } from '../budget/report';
import type { RoutineWords } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import { NOT_RECORDED_WORDS, SKIPPED_WORD, type StopRecordRow } from '../operations/stopRecord';
import { ALL_DAY_WORDS } from '../operations/work';
import { TOOL_REGISTRY } from '../toolRegistry';
import { homeLedgerOf } from '../home/homeLedger';
import { listOf } from '../reservations/travelLedger';
import { taskLedgerAnswerOf } from '../operations/ledgerAnswer';
import { readLedger } from '@/components/workbench/operations/ledger/ledgerReads';
import {
  LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, LEDGER_TABLE, LEDGER_TITLE_WORDS, MONEY_COLUMNS, NO_COLUMN_FILTERS, NO_VALUE_FILTER, PLANNED_WORD, TEXT_COLUMNS, VALUE_COLUMNS, WENT_WORD,
  applyColumnFilters, cellWordsOf, columnKind, columnValues, daysWords, endCellWords, endOf, headWordOf, ledgerCsv, ledgerCsvFileName, ledgerFailedWords, ledgerOf, ledgerSummary, ledgerTotals,
  noRowsWords, notRecordedWords, perDayWords, planKeyOf, planMinutesOf, sortKeyOf, sortRows, startCellWords, startOf, varianceCoverageWords, wentCellWords, wentOf,
  type LedgerInput, type LedgerLinkInput, type LedgerPlanRow, type LedgerRecordInput, type LedgerRow, type LedgerVendorRow, type LedgerSaid, type LedgerSheetRow,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const HOME_ROUTE = 'src/app/api/home-ledger/route.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';
const THIS = 'src/lib/__tests__/timesheet01.test.ts';

// ── THE FIXTURE (the Budget's own shapes, as ledger01.test.ts builds them; every name made up) ──

const MVD = 'America/Montevideo'; // UTC−3 the year round
const FROM = '2027-03-01'; // a Monday
const TO = '2027-03-03';
/** Tue Mar 2, 12:00 in the zone: all of Monday and Tuesday's morning are past; Tuesday's evening and all of Wednesday are ahead. */
const NOW = new Date('2027-03-02T15:00:00.000Z');
/** An occurrence's instant: a wall clock on a day in the zone (UTC−3), as the Budget's expansion gives it. */
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000-03:00`).toISOString();

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: MVD, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
/** A routine's window clock as the loader's mapper carries it (a @db.Time's JSON). */
const window = (clock: string): string => `1970-01-01T${clock}:00.000Z`;
const ROUTINES: RoutinePlanInput[] = [
  // A lined place stop at 08:00: Porridge states its own time and 30 minutes; Juice states neither.
  routine({ id: 'breakfast', name: 'Breakfast', scheduleRrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0', steps: [
    { id: 'porridge', stepOrder: 1, budgetAmount: 6.5, coaCode: '6150', durationMinutes: 30, timeOfDay: '08:15' },
    { id: 'juice', stepOrder: 2, budgetAmount: 3.25, coaCode: '6150', durationMinutes: null, timeOfDay: null },
  ] }),
  // A stepless place stop on the business book at 11:00, no window.
  routine({ id: 'print', name: 'Print shop', scheduleRrule: 'FREQ=DAILY;BYHOUR=11;BYMINUTE=0', entityId: 'B', entityType: 'sole_prop', budgetAmount: 7.5, coaCode: '6400' }),
  // A stepless plain stop (role none) at 19:00 with a 90-minute window.
  routine({ id: 'climbing', name: 'Climbing', scheduleRrule: 'FREQ=DAILY;BYHOUR=19;BYMINUTE=0', budgetAmount: 18, coaCode: '6200', startTime: window('19:00'), endTime: window('20:30'), role: 'none' }),
  // A stepless place stop at 22:00 whose window ends after midnight: 240 minutes.
  routine({ id: 'night', name: 'Night market', scheduleRrule: 'FREQ=DAILY;BYHOUR=22;BYMINUTE=0', budgetAmount: 9, coaCode: '6150', startTime: window('22:00'), endTime: window('02:00') }),
  // An all-day charge on the 2nd of the month.
  routine({ id: 'magazine', name: 'Magazine', scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=2;BYHOUR=0;BYMINUTE=0', budgetAmount: 4.75, coaCode: '7450', role: 'all_day' }),
  // A PRICED journal stop at 07:00 — a role that takes no money.
  routine({ id: 'diary', name: 'Diary', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', budgetAmount: 2, coaCode: '6300', role: 'journal' }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]).concat([['ferry', 'place']]));
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: MVD,
  steps: new Map(r.id === 'breakfast' ? [['porridge', { activity: 'Porridge', timeOfDay: '08:15' }], ['juice', { activity: 'Juice', timeOfDay: null }]] : []),
}]));
const VENDORS: LedgerVendorRow[] = [ // TIMESHEET-04b (2026-11-27): the ledger's vendor rows carry their planned items and their vendor's Instagram tag (ledger.ts LedgerVendorRow; PlanVendorRow until then) — none in this fixture
  { id: 'pv-every', routine_id: null, step_id: 'porridge', task_id: null, occurrence_at: null, items: null, vendor: { id: 'v1', vendor_name: 'Oat House', entity_id: 'P', instagram_tag: null }, routine: null, step: { activity: 'Porridge', routine_id: 'breakfast', routine: { name: 'Breakfast', timezone: MVD } }, task: null },
  { id: 'pv-once', routine_id: 'night', step_id: null, task_id: null, occurrence_at: new Date(at('2027-03-03', '22:00')), items: null, vendor: { id: 'v2', vendor_name: 'Stall Nine', entity_id: 'P', instagram_tag: null }, routine: { name: 'Night market', timezone: MVD }, step: null, task: null },
];
/** Tuesday and Wednesday only — Monday has no stay. */
const STAYS: StayRow[] = [{ id: 'np', place: 'Northport, Freedonia', starts_on: '2027-03-02', ends_on: '2027-03-09' }];
const ACCOUNTS = [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }, { entityId: 'B', code: '6400', name: 'Printing' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }, { id: 'B', entityType: 'sole_prop' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
const line = (r: StopRecordRow, activity: string, timeOfDay: string | null, durationMinutes: number | null): LedgerRecordInput => ({ record: r, routineId: 'breakfast', routineName: 'Breakfast', zone: MVD, role: 'place', activity, timeOfDay, durationMinutes });
const stop = (routineId: string, routineName: string, role: string, durationMinutes: number | null, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId, routineName, zone: MVD, role, activity: null, timeOfDay: null, durationMinutes });
const RECORDS: LedgerRecordInput[] = [
  // Monday: the porridge over its budget, the juice skipped, the climb on plan; the night market and the print shop not recorded.
  line(record({ id: 'r-porridge-1', kind: 'routine_line', target_id: 'porridge', occurrence_at: at('2027-03-01', '08:00'), actual_cents: 690, rating: 4, note: 'with fruit', actual_minutes: 25 }), 'Porridge', '08:15', 30),
  line(record({ id: 'r-juice-1', kind: 'routine_line', target_id: 'juice', occurrence_at: at('2027-03-01', '08:00'), outcome: 'skipped', done_at: null, note: 'none left' }), 'Juice', null, null),
  stop('climbing', 'Climbing', 'none', 90, record({ id: 'r-climbing-1', kind: 'routine', target_id: 'climbing', occurrence_at: at('2027-03-01', '19:00'), actual_cents: 1800, rating: 5 })),
  // Monday: a one-off whose routine the loader no longer lists — a record no line matches.
  stop('ferry', 'Ferry', 'place', null, record({ id: 'r-ferry-1', kind: 'routine', target_id: 'ferry', occurrence_at: at('2027-03-01', '15:00'), actual_cents: 1200 })),
  // Monday: the journal, recorded — not an expense; left out of `rows`, counted.
  stop('diary', 'Diary', 'journal', null, record({ id: 'r-diary-1', kind: 'routine', target_id: 'diary', occurrence_at: at('2027-03-01', '07:00'), actual_minutes: 10 })),
  // Tuesday morning: the porridge on plan, the print shop under; the juice not recorded.
  line(record({ id: 'r-porridge-2', kind: 'routine_line', target_id: 'porridge', occurrence_at: at('2027-03-02', '08:00'), actual_cents: 650 }), 'Porridge', '08:15', 30),
  stop('print', 'Print shop', 'place', null, record({ id: 'r-print-2', kind: 'routine', target_id: 'print', occurrence_at: at('2027-03-02', '11:00'), actual_cents: 600, note: 'forty copies' })),
];
const LINKS: LedgerLinkInput[] = [
  // A posting linked to a line with NO record (Monday's night market) — MATCH stands on its row.
  { kind: 'routine', targetId: 'night', instant: at('2027-03-01', '22:00'), journalEntryId: 'je-night-1', amountCents: 900, reversed: false },
  // A posting linked to the all-day charge.
  { kind: 'routine', targetId: 'magazine', instant: at('2027-03-02', '00:00'), journalEntryId: 'je-magazine', amountCents: 475, reversed: false },
  // A posting linked to a recorded line.
  { kind: 'routine_line', targetId: 'porridge', instant: at('2027-03-01', '08:00'), journalEntryId: 'je-porridge-1', amountCents: 690, reversed: false },
  // MUST NOT JOIN: Wednesday's night market, one millisecond off.
  { kind: 'routine', targetId: 'night', instant: '2027-03-04T01:00:00.001Z', journalEntryId: 'je-off-by-one', amountCents: 900, reversed: false },
];
const built = buildRoutineBudgetLines(ROUTINES, FROM, TO);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: FROM, to: TO, now: NOW, records: RECORDS, links: LINKS, lines: built.lines, notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS, locations: new Map([...ROLES.keys()].map((id): [string, null] => [id, null])), subAccounts: [], ...over, // COALEVELS-01 (2026-11-27): the input grows additively — every routine's Location (none says one in this fixture) and the caller's sub-accounts (none)
});
const ledger = ledgerOf(input());
const sheet = ledger.sheet;

const isRecord = (row: LedgerSheetRow): row is LedgerRow => row.id !== null;
const isPlan = (row: LedgerSheetRow): row is LedgerPlanRow => row.id === null;
/** The sheet's row at a key — one, or the test fails by name. */
const rowAt = (rows: readonly LedgerSheetRow[], key: string): LedgerSheetRow => {
  const found = rows.filter((r) => r.key === key);
  assert.equal(found.length, 1, `one row at ${key}`);
  return found[0];
};
const lineAt = (step: string, day: string, clock: string): string => `line:${step}:${at(day, clock)}`;
const stopAt = (id: string, day: string, clock: string): string => `routine:${id}:${at(day, clock)}`;
/** A recorded row in the ledger's own shape (ledger04's builder) — for the facts driven directly. */
const recorded = (over: Partial<LedgerRow> & { readonly id: string }): LedgerRow => ({
  key: `routine:${over.id}:2027-03-01T11:00:00.000Z`, address: { kind: 'routine', id: over.id, instant: '2027-03-01T11:00:00.000Z' }, match: null, day: '2027-03-01', time: '08:00',
  place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: 'Porridge', rating: null, note: null, notes: null, // TIMESHEET-04b (2026-11-27): the row's two new fields — no tag, no notes
  cents: null, budgetState: 'none', outcome: 'done', actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null, ...over,
});

// ── WHAT MAIN GIVES: ledgerOf(input()).rows and .said, computed on main 22e26f3 over this fixture (the rule before this
//    change, which reads no `minutes`) — pinned here so the old list cannot drift under the new one. ──

// TIMESHEET-04b (2026-11-27): a recorded row holds two fields more — instagramTag after vendor, notes after note. Each row below says them: null, for this fixture's
// vendors hold no tag and its records no notes. Every other field of every row is as it was pinned. COALEVELS-01 (2026-11-27): and two more, after book — location and segments (a row built by hand here says them too): no routine of this fixture says a Location and none of its accounts holds a sub-account, so a row with a line holds { entity, category, code } and null for the other two levels; a row with no line holds null for both.
const MAIN_ROWS: readonly LedgerRow[] = [
  { id: 'r-porridge-2', key: 'line:porridge:2027-03-02T11:00:00.000Z', address: { kind: 'routine_line', id: 'porridge', instant: '2027-03-02T11:00:00.000Z' }, match: null, day: '2027-03-02', time: '08:15', place: { city: 'Northport', region: null, country: 'Freedonia' }, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Oat House', instagramTag: null, description: 'Porridge', rating: null, note: null, notes: null, cents: 650, budgetState: 'matched', outcome: 'done', actualCents: 650, varianceCents: 0, plannedMinutes: 30, loggedMinutes: null },
  { id: 'r-print-2', key: 'routine:print:2027-03-02T14:00:00.000Z', address: { kind: 'routine', id: 'print', instant: '2027-03-02T14:00:00.000Z' }, match: null, day: '2027-03-02', time: '11:00', place: { city: 'Northport', region: null, country: 'Freedonia' }, book: 'Business', location: null, segments: { entity: 'B', location: null, category: '6400', type: null, code: 'B-6400' }, coa: { account: 'B-6400', name: 'Printing' }, vendor: null, instagramTag: null, description: 'Print shop', rating: null, note: 'forty copies', notes: null, cents: 750, budgetState: 'matched', outcome: 'done', actualCents: 600, varianceCents: -150, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-juice-1', key: 'line:juice:2027-03-01T11:00:00.000Z', address: { kind: 'routine_line', id: 'juice', instant: '2027-03-01T11:00:00.000Z' }, match: null, day: '2027-03-01', time: '08:00', place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: 'Juice', rating: null, note: 'none left', notes: null, cents: 325, budgetState: 'matched', outcome: 'skipped', actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-porridge-1', key: 'line:porridge:2027-03-01T11:00:00.000Z', address: { kind: 'routine_line', id: 'porridge', instant: '2027-03-01T11:00:00.000Z' }, match: { cents: 690, postings: 1, unreadable: 0, reversed: 0 }, day: '2027-03-01', time: '08:15', place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Oat House', instagramTag: null, description: 'Porridge', rating: 4, note: 'with fruit', notes: null, cents: 650, budgetState: 'matched', outcome: 'done', actualCents: 690, varianceCents: 40, plannedMinutes: 30, loggedMinutes: 25 },
  { id: 'r-ferry-1', key: 'routine:ferry:2027-03-01T18:00:00.000Z', address: { kind: 'routine', id: 'ferry', instant: '2027-03-01T18:00:00.000Z' }, match: null, day: '2027-03-01', time: '15:00', place: null, book: null, location: null, segments: null, coa: null, vendor: null, instagramTag: null, description: 'Ferry', rating: null, note: null, notes: null, cents: null, budgetState: 'none', outcome: 'done', actualCents: 1200, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-climbing-1', key: 'routine:climbing:2027-03-01T22:00:00.000Z', address: { kind: 'routine', id: 'climbing', instant: '2027-03-01T22:00:00.000Z' }, match: null, day: '2027-03-01', time: '19:00', place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Sport' }, vendor: null, instagramTag: null, description: 'Climbing', rating: 5, note: null, notes: null, cents: 1800, budgetState: 'matched', outcome: 'done', actualCents: 1800, varianceCents: 0, plannedMinutes: 90, loggedMinutes: null },
];
// TIMESHEET-02 (Alex, 2026-11-24, ruling F.2): the notes that count rows count the rows the table lists — noStay is the sheet's six rows on Monday, the day no stay covers (`noStay: 4`,
// the four recorded rows of that day, until then — what main 22e26f3 gave). notRecorded stands at 3: the same three rows read "not recorded" (T3). Every other count is as main gave it.
const MAIN_SAID: LedgerSaid = { noLine: 1, doubled: 0, noStay: 6, unplaced: [], notRecorded: 3, notPlaced: 0, leftOut: { journal: 1, plan: 0, execute: 0, all_day: 0 }, reversed: 0 };

// ── T1 · THE OLD LIST STAYS (ruling B.1) ─────────────────────────────────────

test('T1 `rows` and what is said are what main gives for the same fixture — one row per recorded expense, newest day first; the answer gains one list beside them', () => {
  assert.deepEqual(ledger.rows, MAIN_ROWS, 'the recorded expenses, cell for cell, in main’s order');
  assert.deepEqual(ledger.said, MAIN_SAID, 'every note keeps its count');
  assert.deepEqual(Object.keys(ledger), ['from', 'to', 'rows', 'sheet', 'recording', 'said'], 'ONE list more'); // TIMESHEET-02 (Alex, 2026-11-24, ruling B): and ONE key, `recording`, after `sheet` — five keys until then
  assert.deepEqual(ledger.rows.map((r) => r.id), ['r-porridge-2', 'r-print-2', 'r-juice-1', 'r-porridge-1', 'r-ferry-1', 'r-climbing-1'], 'newest day first, then the card’s clock');
  // A row of `rows` carries no new field: the three facts are read from the fields it always had.
  for (const row of ledger.rows) assert.deepEqual(Object.keys(row), Object.keys(MAIN_ROWS[0]), `${row.id}: the row’s shape is main’s`);
  // The rule's source: the rows builder and its sort stand as they stood.
  const rules = code(RULES);
  assert.match(rules, /const rows: LedgerRow\[\] = expenses\.map\(\(\{ r, day, time \}\) => \{/);
  assert.match(rules, /rows\.sort\(\(a, b\) => cmp\(b\.day, a\.day\) \|\| cmpMaybe\(a\.time, b\.time\) \|\| cmp\(label\.get\(a\.id\)!\.label, label\.get\(b\.id\)!\.label\) \|\| cmpMaybe\(label\.get\(a\.id\)!\.line, label\.get\(b\.id\)!\.line\) \|\| cmp\(a\.id, b\.id\)\);/, 'newest day first — untouched');
  assert.match(rules, /const sheet: readonly LedgerSheetRow\[\] = sheeted\.map\(\(s\) => s\.row\);/);
  assert.match(rules, /rows,\n\s*sheet,\n\s*recording,\n\s*said: \{/, 'the sheet beside the rows, in the one answer'); // TIMESHEET-02 (Alex, 2026-11-24): the sheet is named once, above (the notes count its rows), and `recording` stands after it — `rows,` / `sheet: sheeted.map((s) => s.row),` / `said: {` until then
});

// ── T2 · THE SHEET'S ROWS (ruling B.2) ───────────────────────────────────────

/** The keys of the Budget's lines the sheet lists — worked here from the lines themselves, by the routine's role. */
const listedKeys = (lines: readonly BudgetLine[]): string[] => lines.flatMap((l) => {
  const read = readOccurrenceKey(l.sourceId);
  assert.ok(read !== null && read.routineId !== null && read.address.instant !== null, `${l.sourceId} is a routine occurrence's key`);
  const role = ROLES.get(read.routineId);
  return role === 'place' || role === 'none' || role === 'all_day' ? [`${read.address.kind === 'routine_line' ? 'line' : 'routine'}:${read.address.id}:${read.address.instant.toISOString()}`] : [];
});

test('T2 the sheet is every plan line of every day whose role asks an amount or is all day, plus each recorded expense no line could be joined to — none twice', () => {
  assert.equal(built.lines.length, 19, 'five priced stops a day for three days, the journal’s three, the one all-day charge');
  const lines = listedKeys(built.lines);
  assert.equal(lines.length, 16, 'the fifteen and the charge — the journal’s three are not listed');
  const unjoined = ledger.rows.filter((r) => r.budgetState !== 'matched');
  assert.deepEqual(unjoined.map((r) => r.id), ['r-ferry-1'], 'the one record no line matches');
  assert.deepEqual(sheet.map((r) => r.key).sort(), [...lines, ...unjoined.map((r) => r.key)].sort(), 'every listed line and every unjoined record — nothing more, nothing less');
  assert.equal(sheet.length, 17);
  assert.equal(new Set(sheet.map((r) => r.key)).size, sheet.length, 'every row has a key of its own');
  // Nothing recorded leaves the table, and no record is printed twice.
  assert.deepEqual(sheet.filter(isRecord).map((r) => r.id).sort(), ledger.rows.map((r) => r.id).sort());
  assert.equal(sheet.filter(isPlan).length, 11, 'eleven lines with no record');
  // Every day of the span is on it — a day ahead with no record at all too.
  assert.deepEqual([...new Set(sheet.map((r) => r.day))], ['2027-03-01', '2027-03-02', '2027-03-03']);
  assert.equal(sheet.filter((r) => r.day === '2027-03-03').every(isPlan), true, 'Wednesday is all plan');
  // The answer is wire-shaped: strings, numbers, booleans and nulls — it round-trips JSON unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(sheet)), sheet);
});

test('T2 a recorded line is printed on its line’s row, its cells unchanged — the sheet’s row IS the row of `rows`; a line with no record carries the plan and nulls', () => {
  for (const row of ledger.rows) {
    const onSheet = rowAt(sheet, row.key);
    assert.equal(onSheet, row, `${row.id}: the same row, not a copy`);
    for (const c of LEDGER_COLUMNS) assert.equal(cellWordsOf(onSheet, c), cellWordsOf(row, c), `${row.id} ${c}`);
  }
  // A line with no record: Wednesday's porridge.
  const plan = rowAt(sheet, lineAt('porridge', '2027-03-03', '08:00'));
  assert.deepEqual(plan, {
    id: null, key: 'line:porridge:2027-03-03T11:00:00.000Z', address: { kind: 'routine_line', id: 'porridge', instant: '2027-03-03T11:00:00.000Z' }, match: null,
    day: '2027-03-03', time: '08:15', place: { city: 'Northport', region: null, country: 'Freedonia' }, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Oat House', instagramTag: null, description: 'Porridge',
    rating: null, note: null, plannedItems: null, notes: null, cents: 650, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 30, loggedMinutes: null, allDay: false, went: 'planned',
  } satisfies LedgerPlanRow, 'the plan — day, clock, place, book, account, name, the planned vendor, planned minutes, budget — and null where a record would be');
  // Its cells: the plan's words, and "—" where a record would be.
  assert.deepEqual(LEDGER_COLUMNS.map((c) => cellWordsOf(plan, c)), ['Wednesday', '2027-03-03', '08:15', '08:45', 'Northport', BLANK, 'Freedonia', BLANK, 'Dining Out', 'Personal', 'Porridge', BLANK, 'Oat House', BLANK, 'planned', BLANK, '30', BLANK, 'P-6150', '$6.50', BLANK, BLANK, BLANK, BLANK, BLANK]); // TIMESHEET-04b (2026-11-27): INSTAGRAM TAG after the vendor and NOTES at the end, both blank — the vendor holds no tag, and a row with no record has no notes · COALEVELS-01 (2026-11-27): twenty-five cells in the columns' new order — a blank REGION (the stay's place names none) and a blank LOCATION (its routine says none); the COA cell is the row's whole code
  // The planned vendor by the plan's one grain: the every-occurrence vendor on every porridge, the occurrence vendor on Wednesday's night market alone.
  assert.deepEqual(sheet.filter((r) => r.description === 'Night market').map((r) => r.vendor), [null, null, 'Stall Nine']);
  // The business book's line carries its book and its account with its letter; a code the chart has no name for prints the account alone.
  const print = rowAt(sheet, stopAt('print', '2027-03-03', '11:00'));
  assert.deepEqual([print.book, print.coa], ['Business', { account: 'B-6400', name: 'Printing' }]);
  assert.deepEqual(rowAt(sheet, stopAt('magazine', '2027-03-02', '00:00')).coa, { account: 'P-7450', name: null });
  // The covering stay: Monday has none.
  assert.deepEqual(sheet.filter((r) => r.day === '2027-03-01').map((r) => r.place), [null, null, null, null, null, null]);
});

// ── T3 · WENT (ruling B.4) ───────────────────────────────────────────────────

test('T3 WENT: went (the record is done) · skipped · planned (no record, the occurrence at or after the clock handed in) · not recorded (no record, before it) · blank on an all-day line', () => {
  assert.deepEqual([WENT_WORD, SKIPPED_WORD, PLANNED_WORD, NOT_RECORDED_WORDS], ['went', 'skipped', 'planned', 'not recorded'], 'two words of its own; the other two are the stop record’s');
  assert.equal(wentOf(rowAt(sheet, lineAt('porridge', '2027-03-01', '08:00'))), 'went');
  assert.equal(wentOf(rowAt(sheet, lineAt('juice', '2027-03-01', '08:00'))), 'skipped');
  assert.equal(wentOf(rowAt(sheet, stopAt('ferry', '2027-03-01', '15:00'))), 'went', 'a record no line matches: its own outcome');
  assert.equal(wentOf(rowAt(sheet, stopAt('night', '2027-03-01', '22:00'))), 'not recorded', 'Monday night: past, no record');
  assert.equal(wentOf(rowAt(sheet, lineAt('juice', '2027-03-02', '08:00'))), 'not recorded', 'Tuesday 08:00, before the clock (12:00)');
  assert.equal(wentOf(rowAt(sheet, stopAt('climbing', '2027-03-02', '19:00'))), 'planned', 'Tuesday 19:00, after the clock');
  assert.equal(wentOf(rowAt(sheet, stopAt('night', '2027-03-03', '22:00'))), 'planned');
  const charge = rowAt(sheet, stopAt('magazine', '2027-03-02', '00:00'));
  assert.equal(wentOf(charge), null, 'a charge on a date takes no record — though its date is past the clock');
  assert.equal(wentCellWords(charge), BLANK);
  assert.deepEqual(sheet.map((r) => wentCellWords(r)), ['skipped', 'went', 'not recorded', 'went', 'went', 'not recorded', BLANK, 'not recorded', 'went', 'went', 'planned', 'planned', 'planned', 'planned', 'planned', 'planned', 'planned']);
  // The clock is the `now` handed in, read by the not-recorded count's own test: AT the clock is planned; one millisecond past it, not recorded.
  const climbAt = (now: Date): string | null => wentOf(rowAt(ledgerOf(input({ now })).sheet, stopAt('climbing', '2027-03-02', '19:00')));
  assert.equal(climbAt(new Date(at('2027-03-02', '19:00'))), 'planned');
  assert.equal(climbAt(new Date(Date.parse(at('2027-03-02', '19:00')) + 1)), 'not recorded');
  const rules = code(RULES);
  assert.match(rules, /went: noRecordWords !== null \? null : Date\.parse\(instant\) >= input\.now\.getTime\(\) \? PLANNED_WORD : NOT_RECORDED_WORDS,/, 'against the clock handed in — no other'); // TIMESHEET-02 (Alex, 2026-11-24, ruling A): blank on every row that takes no record, the all-day line among them — `went: allDay ? null : …` until then
  assert.doesNotMatch(rules, /new Date\(\)|Date\.now\(/, 'the rule reads no clock of its own');
  assert.doesNotMatch(code(THIS), /new Date\(\)|Date\.now\(/, 'nor does this test');
});

test('T3 the rows that read "not recorded" are exactly the count said under the table, at any clock', () => {
  assert.equal(ledger.said.notRecorded, 3);
  assert.deepEqual(sheet.filter((r) => wentOf(r) === NOT_RECORDED_WORDS).map((r) => r.key), [stopAt('print', '2027-03-01', '11:00'), stopAt('night', '2027-03-01', '22:00'), lineAt('juice', '2027-03-02', '08:00')]);
  const counts: number[] = [];
  for (const now of [new Date('2027-02-28T00:00:00.000Z'), new Date(at('2027-03-01', '11:00')), NOW, new Date(at('2027-03-02', '19:00')), new Date('2027-03-10T00:00:00.000Z')]) {
    const l = ledgerOf(input({ now }));
    assert.equal(l.sheet.filter((r) => wentOf(r) === NOT_RECORDED_WORDS).length, l.said.notRecorded, `at ${now.toISOString()}`);
    counts.push(l.said.notRecorded);
  }
  assert.deepEqual(counts, [0, 0, 3, 3, 10], 'nothing past · the print shop AT the clock is not past yet · the three · the same at 19:00 sharp · every line without a record once the span is behind');
  assert.equal(notRecordedWords(3), '3 priced stops planned in the period, already past, with no record', 'the note keeps its words');
});

test('T3 a priced line of a role that takes no money is not a row — journal, plan and execute alike; the same line under a role that asks an amount is', () => {
  assert.equal(built.lines.filter((l) => l.sourceId.startsWith('routine:diary:')).length, 3, 'the journal is priced, on every day');
  assert.equal(sheet.some((r) => r.description === 'Diary'), false, 'priced or not — not listed');
  assert.deepEqual(ledger.said.leftOut, { journal: 1, plan: 0, execute: 0, all_day: 0 }, 'its record is still counted, by role');
  const unrecorded = RECORDS.filter((r) => r.record.id !== 'r-diary-1');
  for (const role of ['journal', 'plan', 'execute']) {
    const l = ledgerOf(input({ records: unrecorded, roles: new Map([...ROLES, ['diary', role]]) }));
    assert.equal(l.sheet.some((r) => r.description === 'Diary'), false, `${role}: not listed`);
    assert.equal(l.sheet.length, 17);
  }
  for (const role of ['place', 'none']) {
    const l = ledgerOf(input({ records: unrecorded, roles: new Map([...ROLES, ['diary', role]]) }));
    assert.deepEqual(l.sheet.filter((r) => r.description === 'Diary').map((r) => [r.day, startOf(r), r.cents]), [['2027-03-01', '07:00', 200], ['2027-03-02', '07:00', 200], ['2027-03-03', '07:00', 200]], `${role}: listed`);
  }
  // In the source: the role's two tests, in the sheet's loop.
  const rules = code(RULES);
  assert.match(rules, /const allDay = !isStop\(role\);\n\s*if \(!allDay && !asksAmount\(role\)\) continue;/, 'all day, or a role that asks an amount — the day card’s own rule');
});

// ── T4 · START AND END (ruling B.4) ──────────────────────────────────────────

test('T4 START: the line’s own time; else the occurrence’s local time in the routine’s zone; "all day" on an all-day line. END: START plus the planned minutes, wrapping past midnight; blank on an all-day line or with no minutes', () => {
  // The line's own time, and its 30 minutes.
  const porridge = rowAt(sheet, lineAt('porridge', '2027-03-03', '08:00'));
  assert.deepEqual([startOf(porridge), endOf(porridge)], ['08:15', '08:45'], 'the line’s own time — not the occurrence’s 08:00');
  // No time of its own: the occurrence's local time in the routine's zone (11:00Z is 08:00 there). No minutes: END blank.
  const juice = rowAt(sheet, lineAt('juice', '2027-03-03', '08:00'));
  assert.equal(juice.address.instant, '2027-03-03T11:00:00.000Z');
  assert.deepEqual([startOf(juice), endOf(juice), endCellWords(juice)], ['08:00', null, BLANK]);
  // A stepless routine: the occurrence's time, and its window's length.
  const climbing = rowAt(sheet, stopAt('climbing', '2027-03-03', '19:00'));
  assert.deepEqual([startOf(climbing), climbing.plannedMinutes, endOf(climbing)], ['19:00', 90, '20:30']);
  const print = rowAt(sheet, stopAt('print', '2027-03-03', '11:00'));
  assert.deepEqual([startOf(print), print.plannedMinutes, endOf(print)], ['11:00', null, null], 'no window: no planned minutes, no END');
  // The clock wraps past midnight.
  const night = rowAt(sheet, stopAt('night', '2027-03-03', '22:00'));
  assert.deepEqual([startOf(night), night.plannedMinutes, endOf(night)], ['22:00', 240, '02:00']);
  // An all-day line: the one word, no END — and no clock of its own, though its occurrence has an instant.
  const charge = rowAt(sheet, stopAt('magazine', '2027-03-02', '00:00'));
  assert.ok(isPlan(charge));
  assert.deepEqual([charge.allDay, charge.time, startOf(charge), endOf(charge), startCellWords(charge), endCellWords(charge)], [true, null, 'all day', null, 'all day', BLANK]);
  assert.equal(startOf(charge), ALL_DAY_WORDS, 'the one word (work.ts)');
  // A recorded row: by the row's own clock and its own planned minutes — the fields it always had.
  const done = rowAt(sheet, lineAt('porridge', '2027-03-01', '08:00'));
  assert.ok(isRecord(done));
  assert.deepEqual([startOf(done), endOf(done)], ['08:15', '08:45']);
  assert.deepEqual([startOf(rowAt(sheet, stopAt('ferry', '2027-03-01', '15:00'))), endOf(rowAt(sheet, stopAt('ferry', '2027-03-01', '15:00')))], ['15:00', null], 'a record no line matches keeps its occurrence’s clock');
  // The arithmetic, driven directly.
  const ends = (time: string | null, plannedMinutes: number | null): string | null => endOf(recorded({ id: 'x', time, plannedMinutes }));
  assert.deepEqual([ends('22:00', 240), ends('23:30', 30), ends('23:59', 1), ends('08:00', 0), ends('08:00', 1440), ends('08:00', 1500), ends('00:00', 59)], ['02:00', '00:00', '00:00', '08:00', '08:00', '09:00', '00:59']);
  assert.deepEqual([ends(null, 30), ends('08:00', null), ends(null, null)], [null, null, null], 'both must be known');
  assert.equal(startOf(recorded({ id: 'x', time: null })), null, 'blank when no clock is known');
  assert.equal(startCellWords(recorded({ id: 'x', time: null })), BLANK);
  assert.throws(() => ends('08:00', 1.5), /ledger: minutes are a whole number of minutes, not 1\.5/);
  assert.throws(() => ends('08:00', -5), /not -5/);
  assert.throws(() => ends('soon', 30), /ledger: "soon" is not a clock — a stop's time is HH:MM/);
  // In the source: the calendar's arithmetic and the rule helpers' clock, reused; the all-day word imported, not retyped.
  const rules = code(RULES);
  assert.doesNotMatch(rules, /from '@\/lib\/operations\/work'/); // TIMESHEET-02 (Alex, 2026-11-24, ruling F.1): the word is stopRole.ts's, read there by this file and by work.ts — `import { ALL_DAY_WORDS } from '@/lib/operations/work';` until then
  assert.match(rules, /row\.id === null && row\.allDay \? ROLE_SHORT_WORDS\.all_day : row\.time/);
  assert.match(rules, /import \{ minutesOf \} from '@\/lib\/calendar\/day';/);
  assert.match(rules, /import \{ clockWords \} from '@\/lib\/operations\/rruleHelpers';/);
  assert.doesNotMatch(rules, /'all day'/, 'the word is not typed in the rule');
  assert.match(rules, /time: allDay \? null : l\.time !== null \? l\.time : instantToZoned\(new Date\(instant\), routine\.timezone\)\.time,/, 'the rule `rows` uses for `time`');
});

test('T4 the planned minutes of a line with no record are the one rule’s, handed in by plan — null stated, a plan the map does not hold refused by name', () => {
  const minutes = planMinutesOf(ROUTINES);
  assert.deepEqual([...minutes].sort(([a], [b]) => (a < b ? -1 : 1)), [
    ['routine:breakfast', null], ['routine:climbing', 90], ['routine:diary', null], ['routine:magazine', null], ['routine:night', 240], ['routine:print', null], ['routine_line:juice', null], ['routine_line:porridge', 30],
  ], 'a routine’s window length under its key, each line’s duration under the line’s — null stated');
  assert.deepEqual([planKeyOf('routine', 'night'), planKeyOf('routine_line', 'juice')], ['routine:night', 'routine_line:juice']);
  assert.throws(() => ledgerOf(input({ minutes: new Map([...minutes].filter(([key]) => key !== 'routine:night')) })), /ledger: plan line routine:night:2027-03-02T01:00:00\.000Z names routine night, whose planned minutes were not read/, 'never read as none');
  assert.throws(() => ledgerOf(input({ minutes: new Map() })), /whose planned minutes were not read/);
  // A line whose record is on it asks nothing of the map: the record carries its own.
  const recordedOnly = input({ from: '2027-03-01', to: '2027-03-01', lines: buildRoutineBudgetLines(ROUTINES.filter((r) => r.id === 'climbing'), '2027-03-01', '2027-03-01').lines, minutes: new Map() });
  assert.deepEqual(ledgerOf(recordedOnly).sheet.filter((r) => r.description === 'Climbing').map((r) => [r.id, r.plannedMinutes]), [['r-climbing-1', 90]]);
});

// ── T5 · MATCH AND "link" ON EVERY ROW (ruling B.5) ──────────────────────────

test('T5 MATCH stands on a row with no record: a link is keyed on the occurrence — the line’s own (kind, id, instant) — byte for byte', () => {
  const night = rowAt(sheet, stopAt('night', '2027-03-01', '22:00'));
  assert.ok(isPlan(night));
  assert.deepEqual(night.address, { kind: 'routine', id: 'night', instant: '2027-03-02T01:00:00.000Z' }, 'the picker’s three props');
  assert.deepEqual(night.match, { cents: 900, postings: 1, unreadable: 0, reversed: 0 });
  assert.equal(cellWordsOf(night, 'match'), '$9');
  const charge = rowAt(sheet, stopAt('magazine', '2027-03-02', '00:00'));
  assert.deepEqual([charge.address, charge.match], [{ kind: 'routine', id: 'magazine', instant: '2027-03-02T03:00:00.000Z' }, { cents: 475, postings: 1, unreadable: 0, reversed: 0 }], 'the bank posting tied to the charge on its date');
  assert.equal(cellWordsOf(charge, 'match'), '$4.75');
  assert.equal(rowAt(sheet, stopAt('night', '2027-03-03', '22:00')).match, null, 'one millisecond off joins nothing');
  assert.equal(rowAt(sheet, stopAt('night', '2027-03-02', '22:00')).match, null);
  assert.deepEqual(rowAt(sheet, lineAt('porridge', '2027-03-01', '08:00')).match, { cents: 690, postings: 1, unreadable: 0, reversed: 0 }, 'a recorded row’s, as before');
  // An all-day line takes no record, as before: the stops route still refuses one.
  assert.match(code(STOPS_ROUTE), /NOT_A_STOP_RECORD_WORDS/);
});

// ── T6 · THE ORDER (ruling B.6) ──────────────────────────────────────────────

test('T6 the sheet’s order: day ascending; within a day the all-day rows first, then the clock, then the routine’s name, the line’s activity, the key', () => {
  assert.deepEqual(sheet.map((r) => `${r.day} ${startCellWords(r)} ${r.description}`), [
    '2027-03-01 08:00 Juice', '2027-03-01 08:15 Porridge', '2027-03-01 11:00 Print shop', '2027-03-01 15:00 Ferry', '2027-03-01 19:00 Climbing', '2027-03-01 22:00 Night market',
    '2027-03-02 all day Magazine', '2027-03-02 08:00 Juice', '2027-03-02 08:15 Porridge', '2027-03-02 11:00 Print shop', '2027-03-02 19:00 Climbing', '2027-03-02 22:00 Night market',
    '2027-03-03 08:00 Juice', '2027-03-03 08:15 Porridge', '2027-03-03 11:00 Print shop', '2027-03-03 19:00 Climbing', '2027-03-03 22:00 Night market',
  ], 'oldest day first — the old list’s order (newest first) is `rows`’ alone');
  // The ties, on one day: an all-day charge named to sort last by name still comes first; at one clock the routine's name decides, then the line's activity.
  const TIES: RoutinePlanInput[] = [
    routine({ id: 'zeta', name: 'Zeta', scheduleRrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', budgetAmount: 1, coaCode: '6150' }),
    routine({ id: 'pair', name: 'Pair', scheduleRrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', steps: [
      { id: 'pear', stepOrder: 1, budgetAmount: 2, coaCode: '6150', durationMinutes: null, timeOfDay: null },
      { id: 'apple', stepOrder: 2, budgetAmount: 3, coaCode: '6150', durationMinutes: null, timeOfDay: null },
    ] }),
    routine({ id: 'alpha', name: 'Alpha', scheduleRrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', budgetAmount: 4, coaCode: '6150' }),
    routine({ id: 'early', name: 'Early', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=0', budgetAmount: 5, coaCode: '6150' }),
    routine({ id: 'dues', name: 'Zz dues', scheduleRrule: 'FREQ=DAILY;BYHOUR=0;BYMINUTE=0', budgetAmount: 6, coaCode: '6150', role: 'all_day' }),
  ];
  const ties = ledgerOf({
    from: FROM, to: FROM, now: NOW, records: [], links: [], lines: buildRoutineBudgetLines(TIES, FROM, FROM).lines, notPlaced: [],
    routines: new Map(TIES.map((r): [string, RoutineWords] => [r.id, { name: r.name, timezone: MVD, steps: new Map(r.id === 'pair' ? [['pear', { activity: 'Pear', timeOfDay: null }], ['apple', { activity: 'Apple', timeOfDay: null }]] : []) }])),
    roles: new Map(TIES.map((r): [string, string] => [r.id, r.role])), minutes: planMinutesOf(TIES), vendors: [], stays: [], accounts: [], books: BOOKS, locations: new Map(TIES.map((r): [string, null] => [r.id, null])), subAccounts: [], // COALEVELS-01 (2026-11-27): the input grows additively — every routine's Location (none says one in this fixture) and the caller's sub-accounts (none)
  });
  assert.deepEqual(ties.sheet.map((r) => `${startCellWords(r)} ${r.description}`), ['all day Zz dues', '00:00 Early', '09:00 Alpha', '09:00 Apple', '09:00 Pear', '09:00 Zeta'], 'the charge first though its name is last and a stop shares its midnight; Alpha · Pair (Apple, Pear) · Zeta at 09:00');
  const rules = code(RULES);
  assert.match(rules, /sheeted\.sort\(\(a, b\) => cmp\(a\.row\.day, b\.row\.day\) \|\| afterAllDay\(a\.row\) - afterAllDay\(b\.row\) \|\| cmpMaybe\(a\.row\.time, b\.row\.time\) \|\| cmp\(a\.label, b\.label\) \|\| cmpMaybe\(a\.line, b\.line\) \|\| cmp\(a\.row\.key, b\.row\.key\)\);/, 'a blank clock last (cmpMaybe), the key last of all');
});

// ── T7 · THE TWENTY-ONE COLUMNS (ruling C) ───────────────────────────────────

test('T7 the columns: twenty-five, in order (COALEVELS-01, 2026-11-27; twenty-three until then) — START and END after DATE, WENT after the vendor and its tag; the three are VALUE columns through the spec, the filters and the CSV; the rest in his sheet’s words and order', () => {
  assert.deepEqual(LEDGER_HEAD_WORDS, ['DAY', 'DATE', 'START', 'END', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'INSTAGRAM TAG', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'COA', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'NOTES']); // TIMESHEET-04b (2026-11-27): twenty-three — INSTAGRAM TAG after VENDOR, NOTES after DESCRIPTION, nothing else moved; twenty-one until then · COALEVELS-01 (2026-11-27): twenty-five, in his sheet's words and order — REGION after CITY, LOCATION after COUNTRY; CATEGORY · ENTITY · TYPE · ITEMS where ACCOUNT NAME · BOOK · SUB ACCOUNT NAME · DESCRIPTION stood; COA (was ACCOUNT) before BUDGET; NOTES last — twenty-three until then
  assert.deepEqual(LEDGER_COLUMNS, ['day', 'date', 'start', 'end', 'city', 'region', 'country', 'location', 'accountName', 'book', 'subAccountName', 'description', 'vendor', 'instagramTag', 'went', 'stars', 'plannedMinutes', 'loggedMinutes', 'account', 'budget', 'actual', 'variance', 'match', 'underOver', 'notes']); // TIMESHEET-04b (2026-11-27): twenty-three — INSTAGRAM TAG after VENDOR, NOTES after DESCRIPTION, nothing else moved; twenty-one until then · COALEVELS-01 (2026-11-27): twenty-five — region and location new, no key renamed, in the sheet's order; twenty-three until then
  assert.equal(LEDGER_COLUMNS.length, 25); // TIMESHEET-04b (2026-11-27): twenty-three — 21 until then · COALEVELS-01 (2026-11-27): twenty-five — 23 until then
  assert.deepEqual([headWordOf('start'), headWordOf('end'), headWordOf('went')], ['START', 'END', 'WENT']);
  // Without the three (and the two below), the twenty stand in the sheet's order. COALEVELS-01 (2026-11-27): twenty, in his sheet's words — REGION and LOCATION among them; "nothing else moved … the eighteen" until then.
  // TIMESHEET-04b (2026-11-27): INSTAGRAM TAG and NOTES set aside with the three — the eighteen stand as they stood.
  assert.deepEqual(LEDGER_HEAD_WORDS.filter((h) => h !== 'START' && h !== 'END' && h !== 'WENT' && h !== 'INSTAGRAM TAG' && h !== 'NOTES'), ['DAY', 'DATE', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'COA', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER']);
  // The kinds.
  assert.deepEqual([columnKind('start'), columnKind('end'), columnKind('went')], ['value', 'value', 'value'], 'a checklist filter each');
  assert.deepEqual(VALUE_COLUMNS, ['day', 'date', 'start', 'end', 'city', 'region', 'country', 'location', 'book', 'account', 'accountName', 'subAccountName', 'vendor', 'instagramTag', 'went', 'stars', 'plannedMinutes', 'loggedMinutes', 'underOver']); // TIMESHEET-04b (2026-11-27): INSTAGRAM TAG is a VALUE column, after vendor · COALEVELS-01 (2026-11-27): region and location are VALUE columns — nineteen; seventeen until then
  assert.deepEqual([MONEY_COLUMNS, TEXT_COLUMNS], [['budget', 'actual', 'variance', 'match'], ['description', 'notes']], 'the money columns unchanged; NOTES a TEXT column beside DESCRIPTION'); // TIMESHEET-04b (2026-11-27): ['description'] alone, and 'the money and the text columns unchanged', until then
  assert.deepEqual(LEDGER_COLUMNS.map(columnKind), ['value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'text', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'money', 'money', 'money', 'money', 'value', 'text']); // TIMESHEET-04b (2026-11-27): one more value column before the money (INSTAGRAM TAG) and a second TEXT column at the end (NOTES) · COALEVELS-01 (2026-11-27): the kinds follow the columns' new order — the description's TEXT after the TYPE, the account's VALUE before the money, the notes' TEXT last
  // The spec, the filters map and the CSV follow.
  assert.deepEqual(LEDGER_TABLE.map((c) => c.key), [...LEDGER_COLUMNS]);
  assert.deepEqual(LEDGER_TABLE.map((c) => c.label), [...LEDGER_HEAD_WORDS]);
  assert.deepEqual(Object.keys(NO_COLUMN_FILTERS).sort(), [...LEDGER_COLUMNS].sort(), 'one filter per column');
  assert.deepEqual([NO_COLUMN_FILTERS.start, NO_COLUMN_FILTERS.end, NO_COLUMN_FILTERS.went], [NO_VALUE_FILTER, NO_VALUE_FILTER, NO_VALUE_FILTER]);
  assert.equal(ledgerCsv([]), 'DAY,DATE,START,END,CITY,REGION,COUNTRY,LOCATION,CATEGORY,ENTITY,TYPE,ITEMS,VENDOR,INSTAGRAM TAG,WENT,STARS,PLANNED MIN,LOGGED MIN,COA,BUDGET,ACTUAL,VARIANCE,MATCH,UNDER / OVER,NOTES\r\n'); // TIMESHEET-04b (2026-11-27): the header gains INSTAGRAM TAG after VENDOR and NOTES at its end · COALEVELS-01 (2026-11-27): the header is the twenty-five head words
  // The cell words, the sort key and the CSV field of every column come from the one spec, for either kind of row.
  for (const r of sheet) {
    for (const c of LEDGER_TABLE) {
      assert.equal(c.words(r), cellWordsOf(r, c.key), `${c.key} words of ${r.key}`);
      assert.deepEqual(c.sortKey(r), sortKeyOf(r, c.key), `${c.key} sort key of ${r.key}`);
      assert.equal(c.csv(r), LEDGER_CSV[c.key](r), `${c.key} csv of ${r.key}`);
      if (c.key === 'start' || c.key === 'end' || c.key === 'went') assert.equal(c.csv(r), c.words(r) === BLANK ? '' : c.words(r), `${c.key} of ${r.key}: the screen and the file agree — a null is "—" on screen and empty in the file`);
    }
  }
});

test('T7 the three columns filter and sort: a checklist of the cell words; START and END by the clock — "all day" first, a blank last both ways; WENT by its words', () => {
  // The checklists, each in its column's own order with its count.
  assert.deepEqual(columnValues(sheet, 'start'), [{ key: 'all day', count: 1 }, { key: '08:00', count: 3 }, { key: '08:15', count: 3 }, { key: '11:00', count: 3 }, { key: '15:00', count: 1 }, { key: '19:00', count: 3 }, { key: '22:00', count: 3 }], '"all day" before every clock');
  assert.deepEqual(columnValues(sheet, 'end'), [{ key: '02:00', count: 3 }, { key: '08:45', count: 3 }, { key: '20:30', count: 3 }, { key: BLANK, count: 8 }], 'by the clock (the wrapped 02:00 first), the blank last');
  assert.deepEqual(columnValues(sheet, 'went'), [{ key: 'not recorded', count: 3 }, { key: 'planned', count: 7 }, { key: 'skipped', count: 1 }, { key: 'went', count: 5 }, { key: BLANK, count: 1 }]);
  // The filters: OR within a column, AND across — what is handed in comes back, in order.
  const keep = (over: Partial<typeof NO_COLUMN_FILTERS>): LedgerSheetRow[] => applyColumnFilters(sheet, { ...NO_COLUMN_FILTERS, ...over });
  assert.equal(keep({}).length, 17);
  assert.equal(keep({ went: { dropped: ['planned', BLANK] } }).length, 9, 'what was lived, and what was missed');
  assert.deepEqual(keep({ went: { dropped: ['planned', 'went', 'skipped', BLANK] } }).map((r) => wentOf(r)), ['not recorded', 'not recorded', 'not recorded']);
  assert.deepEqual(keep({ start: { dropped: ['08:00', '08:15', '11:00', '15:00', '19:00', '22:00'] } }).map((r) => r.description), ['Magazine'], 'the charges alone');
  assert.deepEqual(keep({ end: { dropped: [BLANK] }, went: { dropped: ['planned'] } }).map((r) => `${r.day} ${r.description}`), ['2027-03-01 Porridge', '2027-03-01 Climbing', '2027-03-01 Night market', '2027-03-02 Porridge'], 'an END AND not planned');
  // The recorded rows alone go through the same functions and come back as recorded rows.
  const lived: LedgerRow[] = applyColumnFilters(ledger.rows, { ...NO_COLUMN_FILTERS, went: { dropped: ['skipped'] } });
  assert.deepEqual(lived.map((r) => r.id), ['r-porridge-2', 'r-print-2', 'r-porridge-1', 'r-ferry-1', 'r-climbing-1']);
  // The sort keys.
  const charge = rowAt(sheet, stopAt('magazine', '2027-03-02', '00:00'));
  const porridge = rowAt(sheet, lineAt('porridge', '2027-03-03', '08:00'));
  const night = rowAt(sheet, stopAt('night', '2027-03-03', '22:00'));
  const print = rowAt(sheet, stopAt('print', '2027-03-03', '11:00'));
  assert.deepEqual([sortKeyOf(charge, 'start'), sortKeyOf(porridge, 'start'), sortKeyOf(night, 'start')], [{ kind: 'number', n: -1 }, { kind: 'number', n: 495 }, { kind: 'number', n: 1320 }], 'minutes past midnight; the all-day word under 00:00');
  assert.equal(sortKeyOf(recorded({ id: 'x', time: null }), 'start'), null, 'no clock: a blank');
  assert.deepEqual([sortKeyOf(night, 'end'), sortKeyOf(porridge, 'end'), sortKeyOf(print, 'end'), sortKeyOf(charge, 'end')], [{ kind: 'number', n: 120 }, { kind: 'number', n: 525 }, null, null], 'END by its own clock — 02:00 is 120');
  assert.deepEqual([sortKeyOf(porridge, 'went'), sortKeyOf(charge, 'went')], [{ kind: 'text', t: 'planned' }, null]);
  // START: ascending the charge first, then the clock; descending the latest clock first, the charge last. The day's order breaks no tie here — ties keep the order given.
  const starts = (direction: 'asc' | 'desc'): string[] => sortRows(sheet, { column: 'start', direction }).map((r) => startCellWords(r));
  assert.deepEqual(starts('asc'), ['all day', '08:00', '08:00', '08:00', '08:15', '08:15', '08:15', '11:00', '11:00', '11:00', '15:00', '19:00', '19:00', '19:00', '22:00', '22:00', '22:00']);
  assert.deepEqual(starts('desc'), ['22:00', '22:00', '22:00', '19:00', '19:00', '19:00', '15:00', '11:00', '11:00', '11:00', '08:15', '08:15', '08:15', '08:00', '08:00', '08:00', 'all day']);
  // END: the blanks last in both directions.
  const ends = (direction: 'asc' | 'desc'): string[] => sortRows(sheet, { column: 'end', direction }).map((r) => endCellWords(r));
  assert.deepEqual(ends('asc').slice(0, 9), ['02:00', '02:00', '02:00', '08:45', '08:45', '08:45', '20:30', '20:30', '20:30']);
  assert.deepEqual(ends('desc').slice(0, 9), ['20:30', '20:30', '20:30', '08:45', '08:45', '08:45', '02:00', '02:00', '02:00']);
  for (const direction of ['asc', 'desc'] as const) assert.deepEqual(ends(direction).slice(9), [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK], `${direction}: the blanks last`);
  // WENT: by its words; the blank last.
  const went = sortRows(sheet, { column: 'went', direction: 'asc' }).map((r) => wentCellWords(r));
  assert.deepEqual([went[0], went[3], went[10], went[11], went[16]], ['not recorded', 'planned', 'skipped', 'went', BLANK]);
  // null is the sheet's own order, a copy.
  const own = sortRows(sheet, null);
  assert.deepEqual(own, sheet);
  assert.notEqual(own, sheet);
});

test('T7 the CSV carries the three in the same places: a planned row, the all-day charge and a recorded row, whole', () => {
  const lines = ledgerCsv(sheet).split('\r\n');
  assert.equal(lines.length, sheet.length + 2, 'the header, one line per row, and the last CRLF');
  const lineOf = (key: string): string => lines[1 + sheet.findIndex((r) => r.key === key)];
  assert.equal(lineOf(stopAt('night', '2027-03-03', '22:00')), 'Wednesday,2027-03-03,22:00,02:00,Northport,,Freedonia,,Dining Out,Personal,Night market,,Stall Nine,,planned,,240,,P-6150,9.00,,,,,', 'a row not lived yet: the plan, and an empty field where a record would be'); // TIMESHEET-04b (2026-11-27): an empty field after VENDOR (INSTAGRAM TAG) and one at the end (NOTES) — the line without the two until then · COALEVELS-01 (2026-11-27): the line's fields follow the columns' new order — an empty REGION after CITY and an empty LOCATION after COUNTRY (no place of this fixture names a region, no routine says a Location); CATEGORY · ENTITY · TYPE · ITEMS; the COA before BUDGET; NOTES last
  assert.equal(lineOf(stopAt('magazine', '2027-03-02', '00:00')), 'Tuesday,2027-03-02,all day,,Northport,,Freedonia,,,Personal,Magazine,,,,,,,,P-7450,4.75,,,4.75,,', 'the charge: START the all-day word, END and WENT empty, MATCH the posting linked to it'); // TIMESHEET-04b (2026-11-27): an empty field after VENDOR (INSTAGRAM TAG) and one at the end (NOTES) — the line without the two until then · COALEVELS-01 (2026-11-27): the line's fields follow the columns' new order — an empty REGION after CITY and an empty LOCATION after COUNTRY (no place of this fixture names a region, no routine says a Location); CATEGORY · ENTITY · TYPE · ITEMS; the COA before BUDGET; NOTES last
  assert.equal(lineOf(lineAt('porridge', '2027-03-01', '08:00')), 'Monday,2027-03-01,08:15,08:45,,,,,Dining Out,Personal,Porridge,with fruit,Oat House,,went,4,30,25,P-6150,6.50,6.90,0.40,6.90,over,', 'a recorded row: START, END and WENT beside the cells it always had'); // TIMESHEET-04b (2026-11-27): an empty field after VENDOR (INSTAGRAM TAG) and one at the end (NOTES) — the line without the two until then · COALEVELS-01 (2026-11-27): the line's fields follow the columns' new order — an empty REGION after CITY and an empty LOCATION after COUNTRY (no place of this fixture names a region, no routine says a Location); CATEGORY · ENTITY · TYPE · ITEMS; the COA before BUDGET; NOTES last
  assert.equal(lineOf(stopAt('night', '2027-03-01', '22:00')), 'Monday,2027-03-01,22:00,02:00,,,,,Dining Out,Personal,Night market,,,,not recorded,,240,,P-6150,9.00,,,9.00,,'); // TIMESHEET-04b (2026-11-27): an empty field after VENDOR (INSTAGRAM TAG) and one at the end (NOTES) — the line without the two until then · COALEVELS-01 (2026-11-27): the line's fields follow the columns' new order — an empty REGION after CITY and an empty LOCATION after COUNTRY (no place of this fixture names a region, no routine says a Location); CATEGORY · ENTITY · TYPE · ITEMS; the COA before BUDGET; NOTES last
  assert.doesNotMatch(ledgerCsv(sheet), /—/, 'no "—" in the file — a null is an empty field');
  assert.equal(ledgerCsvFileName('2027-03-01', '2027-03-31'), 'time-sheet_2027-03-01_2027-03-31.csv');
  // The CSV's own null path — never a screen helper.
  const rules = code(RULES);
  const block = rules.slice(rules.indexOf('export const LEDGER_CSV'), rules.indexOf('export const LEDGER_TABLE'));
  assert.match(block, /start: \(row\) => startOf\(row\) \?\? '',\n\s*end: \(row\) => endOf\(row\) \?\? '',/);
  assert.match(block, /went: \(row\) => wentOf\(row\) \?\? '',/);
  assert.doesNotMatch(block, /CellWords|BLANK/, 'the CSV never calls a screen helper');
});

// ── T8 · THE FIGURES — NO NEW ARITHMETIC (ruling D) ──────────────────────────

test('T8 the TOTAL row is ledgerTotals over the rows shown, as it stood: BUDGET the period’s whole plan, ACTUAL what was logged, VARIANCE and UNDER / OVER only the rows that carry both; its label spans the nineteen columns before BUDGET (COALEVELS-01, 2026-11-27; sixteen until then)', () => {
  const t = ledgerTotals(sheet);
  assert.equal(t.budgetCents, 13750, 'the whole plan: ($6.50 + $3.25 + $7.50 + $18 + $9) × 3 days + the $4.75 charge — the record with no line adds nothing');
  assert.equal(t.actualCents, 4940, 'what was logged: $6.90 + $18 + $12 + $6.50 + $6');
  assert.deepEqual([t.varianceCents, t.withVariance], [-110, 4], '+$0.40 + $0 + $0 − $1.50 over the 4 rows that carry both a budget and an actual');
  assert.deepEqual([t.matchCents, t.withMatch], [2065, 3], '$9 + $4.75 + $6.90 — two of them on rows with no record');
  assert.deepEqual([t.plannedMinutes, t.withPlanned, t.loggedMinutes, t.withLogged], [1080, 9, 25, 1], '(30 + 90 + 240) × 3 planned; the one logged');
  assert.deepEqual([t.over, t.words], [true, '▲ $10.90 over'], 'the recorded-rows comparison, as the day card makes it: $49.40 against the $38.50 budgeted on the rows that carry an actual');
  assert.equal(varianceCoverageWords(t.withVariance, sheet.length), 'VARIANCE totals the 4 of 17 rows that carry both a budget and an actual', 'the coverage, said under the table as today');
  // The same rule over the recorded rows alone gives what it gave: the totals of `rows` are main's.
  const old = ledgerTotals(ledger.rows);
  assert.deepEqual([old.budgetCents, old.actualCents, old.varianceCents, old.withVariance], [4175, 4940, -110, 4]);
  // The span.
  assert.equal(LEDGER_COLUMNS.indexOf('budget'), 19, 'the columns before BUDGET'); // TIMESHEET-04b (2026-11-27): INSTAGRAM TAG sits among them — 15 until then · COALEVELS-01 (2026-11-27): REGION, LOCATION and ITEMS sit among them too, and the COA stands before BUDGET — 16 until then
  const s = code(SECTION);
  assert.match(s, /<th scope="row" colSpan=\{19 - dayFoldCount\(period\)\} className=\{`\$\{cell\} text-left`\}>\{TOTAL_WORDS\}<\/th>/); // COALEVELS-01 (2026-11-27): nineteen less the folded — `16 - dayFoldCount(period)` until then. TIMESHEET-04b (2026-11-27): sixteen less the folded — `15 - dayFoldCount(period)` until then. TIMEDAY-01 (Alex, 2026-11-24): the label spans the columns before BUDGET less the four a single day folds — fifteen on every other period, eleven on one day (ledger.ts dayFoldCount; timeday01.test.ts); `colSpan={15}` until then
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.equal((tfoot.match(/<td\b/g) ?? []).length, 6, 'BUDGET · ACTUAL · VARIANCE · MATCH · UNDER / OVER · NOTES after the span'); // TIMESHEET-04b (2026-11-27): one more cell, under NOTES — six until then · COALEVELS-01 (2026-11-27): six again — the description's cell left the row (ITEMS stands before BUDGET now, under the label's span); seven until then
  // No new arithmetic: the totals' body is the one ledger01 pins; only what it is handed widened.
  assert.match(code(RULES), /export function ledgerTotals\(rows: readonly LedgerSheetRow\[\]\): LedgerTotals \{\n\s*const actuals = rows\.map\(\(r\) => r\.actualCents\)\.filter\(\(c\): c is number => c !== null\);\n\s*const totals = dayTotals\(\{ stops: rows, spentCents: actuals\.reduce\(\(sum, c\) => sum \+ c, 0\), withActual: actuals\.length \}, null\);/);
});

test('T8 the summary: a group’s DAYS count only the days that carry a record, and ACTUAL PER RECORDED DAY divides by those — never by a planned day; a group with none reads "0 days" and "—"', () => {
  // By day, newest first: Wednesday is all plan.
  const byDay = ledgerSummary(sheet, 'day');
  assert.deepEqual(byDay.map((g) => [g.key, g.days, g.totals.budgetCents, g.totals.actualCents, g.perDayCents]), [['2027-03-03', 0, 4425, null, null], ['2027-03-02', 1, 4900, 1250, 1250], ['2027-03-01', 1, 4425, 3690, 3690]]);
  assert.deepEqual([daysWords(byDay[0].days), perDayWords(byDay[0].perDayCents)], ['0 days', '—'], 'nothing logged on a planned day: no figure, never $0');
  // By week: three days on the sheet, two of them recorded — $49.40 over 2 days, not over 3.
  const week = ledgerSummary(sheet, 'week');
  assert.deepEqual(week.map((g) => [g.key, g.label, g.days, g.totals.actualCents, g.perDayCents]), [['2027-03-01', 'week of Mon Mar 1', 2, 4940, 2470]]);
  assert.notEqual(week[0].perDayCents, Math.round(4940 / 3), 'never divided by the planned day');
  // By book: the business book's stop is on three days and recorded on one.
  const byBook = ledgerSummary(sheet, 'book');
  assert.deepEqual(byBook.map((g) => [g.key, g.days, g.totals.budgetCents, g.totals.actualCents, g.perDayCents]), [['Business', 1, 2250, 600, 600], ['no account', 1, null, 1200, 1200], ['Personal', 2, 11500, 3140, 1570]]);
  // By city: Monday has no stay; the stay covers a recorded day and a planned one.
  assert.deepEqual(ledgerSummary(sheet, 'city').map((g) => [g.key, g.days, g.totals.actualCents, g.perDayCents]), [['—', 1, 3690, 3690], ['Northport', 1, 1250, 1250]]);
  // The stars and the hours follow the rows shown, as they did.
  assert.deepEqual(week[0].stars, { average: 4.5, rated: 2 });
  assert.deepEqual([week[0].totals.plannedMinutes, week[0].totals.loggedMinutes], [1080, 25]);
  // Over the recorded rows alone the summary is what it was: every day of a group carries a record.
  assert.deepEqual(ledgerSummary(ledger.rows, 'week').map((g) => [g.days, g.totals.actualCents, g.perDayCents]), [[2, 4940, 2470]]);
  assert.deepEqual(ledgerSummary(ledger.rows, 'day').map((g) => [g.key, g.days]), [['2027-03-02', 1], ['2027-03-01', 1]]);
  assert.match(code(RULES), /const days = new Set\(members\.filter\(\(r\) => r\.id !== null\)\.map\(\(r\) => r\.day\)\)\.size;/, 'the days that carry a record');
});

test('T8 the words: the title reads "Time sheet", the file is time-sheet_<from>_<to>.csv, an empty period reads "nothing planned or recorded <period>" — and nothing else is renamed', () => {
  assert.equal(LEDGER_TITLE_WORDS, 'Time sheet');
  assert.equal(ledgerCsvFileName('2027-03-01', '2027-03-03'), 'time-sheet_2027-03-01_2027-03-03.csv');
  assert.equal(noRowsWords({ from: '2027-03-01', to: '2027-03-03' }), 'nothing planned or recorded Mon Mar 1 – Wed Mar 3');
  assert.equal(noRowsWords({ from: '2027-03-02', to: '2027-03-02' }), 'nothing planned or recorded Tue Mar 2');
  // A period with no plan and no record: no row, and the section says so.
  const empty = ledgerOf(input({ records: [], links: [], lines: [] }));
  assert.deepEqual([empty.rows, empty.sheet], [[], []]);
  const s = code(SECTION);
  assert.match(s, /\{answer !== null && answer\.read\.ok && rows\.length === 0 && <div className="text-xs text-text-muted" data-ledger-none>\{noRowsWords\(answer\.period\)\}<\/div>\}/);
  assert.match(s, /<h2 className="text-sm font-bold text-brand-purple" data-ledger-title>\{LEDGER_TITLE_WORDS\}<\/h2>/); // COALEVELS-01 (2026-11-27): the title stands at the head of the controls row, one size down, named by its attribute — `text-lg` on a line of its own above the table until then
  assert.doesNotMatch(s, /Time sheet|Task ledger/, 'the title is the rule’s word, not typed in the section');
  // Nothing else renamed: the component, its mount, the route, the functions, the attributes.
  assert.match(s, /export default function LedgerSection\(\)/);
  assert.match(code(TIME_PAGE), /<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>/);
  assert.match(code(READS), /readJson\(`\/api\/operations\/ledger\?/);
  assert.match(code(ANSWER), /export async function taskLedgerAnswerOf\(db: Db, userId: string, span: \{ from: string; to: string \}, now: Date\)/);
  assert.match(code(RULES), /export function ledgerOf\(input: LedgerInput\): Ledger \{/);
  for (const attr of ['data-ledger>', 'data-ledger-row={row.key}', 'data-ledger-day={row.day}', 'data-ledger-total>', 'data-ledger-notes>', 'data-ledger-summary>']) assert.ok(s.includes(attr), `the section still carries ${attr}`);
  // The registry's Time row: its status, beats, why, note and customer line as they were.
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.beats, time.home, time.why], ['LIVE', { discover: true, decide: true, commit: true, record: true }, '/time', undefined]);
  assert.equal(time.customer, 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.');
  assert.match(time.note ?? '', /^HOME-03 \(2026-10-27\): the day itself is entered on the day card/);
});

// ── T9 · THE READ (ruling E) ─────────────────────────────────────────────────

test('T9 one answer, one read — { from, to, as_of, first_record, rows, sheet, said }: no query added; the client reads `sheet`; an answer without it is a failure in words', async () => {
  const a = code(ANSWER);
  assert.match(a, /return \{ from, to, as_of: now\.toISOString\(\), first_record: firstRecord, rows: ledger\.rows, sheet: ledger\.sheet, tones: accountPlacesOf\(routineInputs\), recording: ledger\.recording, said: ledger\.said \};/); // TIMESHEET-02 (Alex, 2026-11-24): and ONE key, `recording`, after `tones` — `tones: accountPlacesOf(routineInputs), said: ledger.said` until then. TIMESHEET-03 (Alex, 2026-11-24): the answer gains ONE key, `tones`, after `sheet` — `sheet: ledger.sheet, said: ledger.said` until then
  assert.equal((a.match(/db\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 9, 'the nine reads'); // COALEVELS-01 (2026-11-27): nine — the caller's active sub-accounts joined the eight (ledgerAnswer.ts); no other query added
  assert.match(a, /minutes: planMinutesOf\(routineInputs\),/, 'the planned minutes from the routines the loader already read');
  assert.match(a, /const routineInputs = routineGroups\.flatMap\(\(group\) => group\.rows\.map\(\(row\) => toRoutinePlanInput\(row, bookOf\(group\.entityId, `the routines of entity \$\{group\.entityId\}`\)\)\)\);/);
  assert.doesNotMatch(a, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, 'writes nothing');
  assert.equal((code(ROUTE).match(/prisma\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 1, 'the route’s only read is the gate’s');
  assert.match(code(ROUTE), /return NextResponse\.json\(await taskLedgerAnswerOf\(prisma, user\.id, \{ from, to \}, new Date\(\)\)\);/, 'the route’s code is unchanged');
  // The client's read: the sheet beside the rows.
  const reads = code(READS);
  assert.match(reads, /readonly rows: readonly LedgerRow\[\];\n\s*readonly sheet: readonly LedgerSheetRow\[\];/);
  assert.match(reads, /if \(!Array\.isArray\(read\.value\.sheet\)\) return \{ ok: false, words: ledgerFailedWords\('the ledger came back without its sheet'\) \};/);
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const answers = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    g.fetch = answers({ from: FROM, to: TO, as_of: 'x', first_record: null, rows: [], sheet: [], tones: {}, recording: {}, said: {} }); // TIMESHEET-02 (Alex, 2026-11-24): and its `recording` — one without it is a failure in words (timesheet02.test.ts); `tones: {}, said: {}` until then. TIMESHEET-03 (Alex, 2026-11-24): the answer carries its `tones` too — one without them is a failure in words (timesheet03.test.ts); `sheet: [], said: {}` until then
    assert.equal((await readLedger(FROM, TO)).ok, true);
    g.fetch = answers({ from: FROM, to: TO, as_of: 'x', first_record: null, rows: [], said: {} });
    assert.deepEqual(await readLedger(FROM, TO), { ok: false, words: ledgerFailedWords('the ledger came back without its sheet') }, 'never read as an empty period');
    g.fetch = answers({ from: FROM, to: TO, as_of: 'x', first_record: null, sheet: [], said: {} });
    assert.deepEqual(await readLedger(FROM, TO), { ok: false, words: ledgerFailedWords('the ledger came back without its rows') }, 'as one without its rows is');
  } finally {
    g.fetch = real;
  }
  assert.equal(ledgerFailedWords('the ledger came back without its sheet'), 'The ledger could not be read — the ledger came back without its sheet');
});

type Call = { readonly table: string; readonly method: string };
function fakeDb(rows: Readonly<Record<string, readonly unknown[]>>, calls: Call[]) {
  const db: Record<string, { findMany: () => Promise<unknown[]>; findFirst: () => Promise<unknown> }> = {};
  for (const table of Object.keys(rows)) {
    db[table] = {
      findMany: async () => { calls.push({ table, method: 'findMany' }); return [...rows[table]]; },
      findFirst: async () => { calls.push({ table, method: 'findFirst' }); return rows[table].length === 0 ? null : rows[table][0]; },
    };
  }
  return db as unknown as Parameters<typeof taskLedgerAnswerOf>[0];
}

test('T9 the answer function: the sheet rides the one answer from the reads it already makes — a line’s duration and a routine’s window become the planned minutes of a row with no record; it round-trips JSON', async () => {
  const day = (iso: string): Date => new Date(iso);
  const time = (clock: string): Date => new Date(`1970-01-01T${clock}:00.000Z`);
  // The rows as the client reads them: one routine row serves the loader's read and the roles read. COALEVELS-01 (2026-11-27): each row says its Location (none) — the roles read selects location_class now.
  const ROUTINE_ROWS = [
    { id: 'breakfast', name: 'Breakfast', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0', timezone: MVD, start_time: null, end_time: null,
      steps: [{ id: 'porridge', is_active: true, budget_amount: 6.5, coa_code: '6150', step_order: 1, activity: 'Porridge', time_of_day: time('08:15'), duration_minutes: 30 }] },
    { id: 'night', name: 'Night market', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 9, coa_code: '6150', schedule_rrule: 'FREQ=DAILY;BYHOUR=22;BYMINUTE=0', timezone: MVD, start_time: time('22:00'), end_time: time('02:00'), steps: [] },
    { id: 'magazine', name: 'Magazine', role: 'all_day', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 4.75, coa_code: '7450', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=2;BYHOUR=0;BYMINUTE=0', timezone: MVD, start_time: null, end_time: null, steps: [] },
  ];
  const RECORD_ROW = {
    id: 'rec-porridge', routine_id: null, step_id: 'porridge', occurrence_at: day(at('2027-03-02', '08:00')), outcome: 'done', done_at: day(at('2027-03-02', '08:20')), actual_cents: 680, rating: 4, note: null, notes: null, actual_minutes: 25, // TIMESHEET-04b (2026-11-27): the table holds a notes column — the fake row says it, as the database would
    routine: null, step: { activity: 'Porridge', time_of_day: time('08:15'), duration_minutes: 30, routine_id: 'breakfast', routine: { name: 'Breakfast', timezone: MVD, role: 'place' } },
  };
  const calls: Call[] = [];
  const db = fakeDb({
    entities: [{ id: 'P', name: 'Personal', entity_type: 'personal' }], chart_of_accounts: [{ id: 'acct-6150', entity_id: 'P', code: '6150', name: 'Dining Out', account_type: 'expense', balance_type: 'D' }], chart_of_sub_accounts: [], // COALEVELS-01 (2026-11-27): the chart row's id (the read selects it now) and the caller's sub-accounts — none
    operations_routines: ROUTINE_ROWS, planned_item_vendors: [], operations_stays: [{ id: 'np', place: 'Northport, Freedonia', starts_on: day('2027-03-02T00:00:00.000Z'), ends_on: day('2027-03-09T00:00:00.000Z') }],
    operations_stop_records: [RECORD_ROW], planned_item_links: [],
  }, calls);
  const answer = await taskLedgerAnswerOf(db, 'someone', { from: '2027-03-02', to: '2027-03-02' }, NOW);
  assert.deepEqual(Object.keys(answer), ['from', 'to', 'as_of', 'first_record', 'rows', 'sheet', 'tones', 'recording', 'said']); // TIMESHEET-02 (Alex, 2026-11-24): `recording` after `tones` — eight keys until then. TIMESHEET-03 (Alex, 2026-11-24): `tones` after `sheet` — seven keys until then
  assert.deepEqual(JSON.parse(JSON.stringify(answer)), answer, 'wire-shaped as built');
  assert.deepEqual(calls.map((c) => `${c.table}.${c.method}`), ['entities.findMany', 'chart_of_accounts.findMany', 'operations_routines.findMany', 'operations_routines.findMany', 'chart_of_sub_accounts.findMany', 'planned_item_vendors.findMany', 'operations_stays.findMany', 'operations_stop_records.findMany', 'operations_stop_records.findFirst', 'planned_item_links.findMany'], 'the reads, in their order — the loader’s (once an entity) among them'); // COALEVELS-01 (2026-11-27): the sub-accounts read stands after the roles read — the one read added; 'the same reads, in the same order' until then
  assert.deepEqual(answer.rows.map((r) => r.id), ['rec-porridge'], 'the recorded expense, as before');
  assert.deepEqual(answer.sheet.map((r) => [r.id, startOf(r), endOf(r), r.description, r.plannedMinutes, wentOf(r), r.cents]), [
    [null, 'all day', null, 'Magazine', null, null, 475],
    ['rec-porridge', '08:15', '08:45', 'Porridge', 30, 'went', 650],
    [null, '22:00', '02:00', 'Night market', 240, 'planned', 900],
  ], 'the charge, the recorded line on its row, and the stop still ahead with its window’s 240 minutes');
  assert.equal(answer.sheet[1], answer.rows[0], 'the recorded line’s row is the row of `rows`');
  assert.deepEqual(answer.sheet[2].place, { city: 'Northport', region: null, country: 'Freedonia' });
});

// ── T10 · THE HOME LEDGER DOES NOT CHANGE (ruling B.1) ───────────────────────

test('T10 the home ledger’s leaf, handed the new answer, returns what it returned: it reads `rows` through the one reader and never the sheet', () => {
  const dayInput = input({ to: FROM, lines: buildRoutineBudgetLines(ROUTINES, FROM, FROM).lines });
  const day = ledgerOf(dayInput);
  const main = MAIN_ROWS.filter((r) => r.day === FROM);
  assert.deepEqual(day.rows, main, 'Monday’s recorded expenses — main’s');
  /** The answer as the route builds it now, and as main built it. */
  const now = { from: FROM, to: FROM, as_of: NOW.toISOString(), first_record: { day: FROM }, rows: day.rows, sheet: day.sheet, said: day.said };
  const before = { from: FROM, to: FROM, as_of: NOW.toISOString(), first_record: { day: FROM }, rows: main, said: MAIN_SAID };
  const leaf = (taskAnswer: unknown) => homeLedgerOf({
    date: FROM, zone: MVD,
    books: [{ id: 'P', name: 'Personal', entityType: 'personal' }, { id: 'B', name: 'Studio', entityType: 'sole_prop' }],
    chart: [{ entityId: 'P', code: '6150', name: 'Dining Out', accountType: 'expense', balanceType: 'D' }, { entityId: 'P', code: '6200', name: 'Sport', accountType: 'expense', balanceType: 'D' }],
    lines: [], reversedEntryIds: [], taskRows: listOf<LedgerRow>(taskAnswer, '/api/operations/ledger', 'rows'), bookings: [], expenses: [], bank: [],
  });
  const home = leaf(now);
  assert.deepEqual(home, leaf(before), 'the same answer, whole');
  assert.deepEqual(home.rows.filter((r) => r.source === 'task').map((r) => r.id).sort(), ['r-climbing-1', 'r-ferry-1', 'r-juice-1', 'r-porridge-1'], 'the four recorded on the day — no planned line among them');
  assert.equal(day.sheet.length, 6, 'while the sheet of the same day holds six rows');
  // The route: the one reader over `rows`; it names no sheet.
  const h = code(HOME_ROUTE);
  assert.match(h, /taskRows: listOf<LedgerRow>\(taskAnswer, '\/api\/operations\/ledger', 'rows'\),/);
  assert.doesNotMatch(h, /sheet/i, 'the home ledger reads no sheet');
  assert.doesNotMatch(code('src/lib/home/homeLedger.ts'), /LedgerSheetRow|LedgerPlanRow|\.sheet\b/);
});

// ── T11 · THE SECTION (rulings B.5, C) ───────────────────────────────────────

test('T11 the section draws `sheet`: three cells more in their places, each the rule’s words with the blank class when null; each row keyed by its own key; "link" on every row', () => {
  const s = code(SECTION);
  assert.match(s, /const rows: readonly LedgerSheetRow\[\] = answer !== null && answer\.read\.ok \? answer\.read\.value\.sheet : \[\];/, 'the rows loaded are the sheet');
  assert.doesNotMatch(s, /answer\.read\.value\.rows/, 'the old list is the home ledger’s — not drawn here');
  assert.match(s, /const shown = sortRows\(applyColumnFilters\(rows, filters\), sort\);\n\s*const totals = ledgerTotals\(shown\);\n\s*const groups = ledgerSummary\(shown, by\);/, 'filtered, sorted, totalled and summed as before');
  const cells = [...s.matchAll(/data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(cells, ['day', 'date', 'start', 'end', 'city', 'region', 'country', 'location', 'account-name', 'book', 'sub-account-name', 'description', 'vendor', 'instagram-tag', 'went', 'stars', 'planned-minutes', 'logged-minutes', 'account', 'budget', 'actual', 'variance', 'match', 'under-over', 'notes'], 'one cell per head word, in its order'); // TIMESHEET-04b (2026-11-27): the instagram-tag cell after vendor's, the notes cell after description's — twenty-three cells · COALEVELS-01 (2026-11-27): twenty-five cells in the head's new order — region and location new; account-name, book, sub-account-name, description; the account before the budget; the notes last
  assert.equal(cells.length, LEDGER_HEAD_WORDS.length);
  assert.match(s, /data-ledger-cell="date">\{row\.day\}<\/td>\n(?:\s*\{\s*\}\n)?\s*<td className=\{`\$\{cell\} whitespace-nowrap tabular-nums \$\{startOf\(row\) === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="start">\{startCellWords\(row\)\}<\/td>\n\s*<td className=\{`\$\{cell\} whitespace-nowrap tabular-nums \$\{endOf\(row\) === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="end">\{endCellWords\(row\)\}<\/td>\n\s*<td [^\n]*data-ledger-cell="city">/, 'DATE, then START and END, then CITY');
  assert.match(s, /data-ledger-cell="vendor" title=\{row\.vendor \?\? undefined\}>\{vendorCellWords\(row\.vendor\)\}<\/td><td className=\{`\$\{cell\} whitespace-nowrap \$\{row\.instagramTag === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="instagram-tag">\{tagCellWords\(row\.instagramTag\)\}<\/td>\n(?:\s*\{\s*\}\n)?\s*<td className=\{`\$\{cell\} whitespace-nowrap \$\{wentOf\(row\) === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="went" title=\{entry\.takes \? undefined : entry\.words\}>\n\s*<span data-ledger-went>\{wentCellWords\(row\)\}<\/span>\n\s*\{entry\.takes && <button [^\n]*data-ledger-record=\{row\.key\}[^\n]*>\{RECORD_WORDS\}<\/button>\}\n\s*<\/td>\n\s*<td [^\n]*data-ledger-cell="stars">/, 'VENDOR, then INSTAGRAM TAG on its line, then WENT, then STARS'); // COALEVELS-01 (2026-11-27): the vendor's cell says itself whole in its title (the table's class cuts it) — no title until then. TIMESHEET-04b (2026-11-27): the tag's cell stands on the vendor cell's line, after it — the tag with its @, the blank class when null ('VENDOR, then WENT, then STARS' until then). TIMESHEET-02 (Alex, 2026-11-24, ruling E): the word, then the "record" chip on a row that takes one; a row that takes none says why in the cell's title — `data-ledger-cell="went">{wentCellWords(row)}</td>` until then
  // Each row keyed by its own key — a plan row has no record id.
  assert.match(s, /<Fragment key=\{row\.key\}>\n\s*<tr className="border-t border-border" data-ledger-row=\{row\.key\} data-ledger-day=\{row\.day\}>/);
  assert.doesNotMatch(s, /key=\{row\.id\}/);
  // "link" and the picker stand on every row, by the row's own address — nothing asks whether the row carries a record.
  assert.match(s, /<button type="button" className=\{`\$\{chip\} ml-1 font-normal`\} onClick=\{\(\) => setPicking\(picking === row\.key \? null : row\.key\)\} data-ledger-link=\{row\.key\} aria-expanded=\{picking === row\.key\}>\{LINK_WORDS\}<\/button>/);
  assert.match(s, /<LinkPicker kind=\{row\.address\.kind\} id=\{row\.address\.id\} instant=\{row\.address\.instant\} near=\{row\.day\} onChanged=\{\(\) => setWrites\(\(n\) => n \+ 1\)\} onClose=\{\(\) => setPicking\(null\)\} \/>/);
  assert.doesNotMatch(s, /row\.id (===|!==) null/, 'no cell asks which kind of row it draws — the rule’s words decide');
  // A null cell wears the blank class, as today: the record's cells on a plan row are the same expressions.
  assert.match(s, /className=\{`\$\{money\} \$\{row\.outcome === 'skipped' \? 'text-text-muted' : row\.actualCents === null \? BLANK_CLASS : `font-semibold \$\{actualTone\(delta\.over\)\}`\}`\} data-ledger-cell="actual">\{actualCellWords\(row\)\}<\/td>/);
  // Nothing fetched, nothing stored, nothing written here that was not written before; no sentence of its own.
  assert.doesNotMatch(s, /\bfetch\s*\(|\/api\/|localStorage|sessionStorage|document\.cookie|method:/);
  const printed = [...s.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  for (const p of printed) assert.doesNotMatch(p, /^'[^']*'$|^"[^"]*"$|^`[^`]*`$/, `${p} is not a literal sentence`);
  assert.doesNotMatch(s, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  assert.match(comments(SECTION), /TIMESHEET-01 \(Alex, 2026-11-24\): THE TIME SHEET, PART ONE\./);
  assert.match(comments(RULES), /TIMESHEET-01 \(Alex, 2026-11-24\) — THE TIME SHEET, PART ONE: EVERY PRICED LINE/);
});

// ── T12 · A KEY OF ITS OWN ───────────────────────────────────────────────────

test('T12 two plan lines at one stop: the record that names them both is its own row, each line a row without a record, every key its own — and the note keeps its own count', () => {
  /** Monday's climb twice — two plan lines at one stop, which the rule names and never picks from. */
  const climb = built.lines.find((l) => l.sourceId === occurrenceKey({ routineId: 'climbing', lineId: null, instant: new Date(at('2027-03-01', '19:00')) }));
  assert.ok(climb !== undefined);
  const doubled = ledgerOf(input({ lines: [...built.lines, climb] }));
  const K = stopAt('climbing', '2027-03-01', '19:00');
  const there = doubled.sheet.filter((r) => r.day === '2027-03-01' && r.description === 'Climbing');
  assert.deepEqual(there.map((r) => [r.key, r.id, r.cents, wentOf(r)]), [[K, 'r-climbing-1', null, 'went'], [`${K}#1`, null, 1800, null], [`${K}#2`, null, 1800, null]], 'the record as `rows` gives it (BUDGET "—", neither taken), then the two lines it could not be joined to'); // TIMESHEET-02 (Alex, 2026-11-24, rulings A.3 and F.3): the two lines' rows take no record, so their WENT is blank — 'not recorded' on each until then
  assert.equal(doubled.rows.find((r) => r.id === 'r-climbing-1')?.budgetState, 'doubled');
  assert.equal(new Set(doubled.sheet.map((r) => r.key)).size, doubled.sheet.length, 'every row has a key of its own — the row’s key, the picker’s and the list’s');
  assert.equal(doubled.sheet.length, 19);
  assert.deepEqual(doubled.sheet.filter(isRecord).map((r) => r.id).sort(), doubled.rows.map((r) => r.id).sort(), 'nothing recorded leaves, none twice');
  // TIMESHEET-02 (Alex, 2026-11-24, ruling F.2): the note counts exactly the rows that read "not recorded" — three here, the two doubled lines' rows blank now. Until then the note's own
  // rule counted a key once and never a key a record held, so it stood at 3 while five rows read "not recorded" (the count below was 5).
  assert.deepEqual([doubled.said.notRecorded, doubled.said.noLine, doubled.said.doubled], [3, 2, 1]);
  assert.equal(doubled.sheet.filter((r) => wentOf(r) === NOT_RECORDED_WORDS).length, 3);
  // Two lines at one stop and no record: the first keeps the line's key.
  const unrecorded = ledgerOf(input({ lines: [...built.lines, climb], records: RECORDS.filter((r) => r.record.id !== 'r-climbing-1') }));
  assert.deepEqual(unrecorded.sheet.filter((r) => r.day === '2027-03-01' && r.description === 'Climbing').map((r) => r.key), [K, `${K}#2`]);
});

test('T12 this change adds no route, no migration and no write; this test pins no line number of any file', () => {
  for (const f of [RULES, ANSWER, ROUTE, READS, SECTION]) assert.doesNotMatch(code(f), /prisma\.\$executeRaw|ALTER TABLE|migrations|\$transaction/, `${f}: no migration, no raw SQL`);
  assert.doesNotMatch(code(RULES), /\bfetch\b|@prisma\/client|from 'react'|from 'next/, 'the rule stays pure');
  assert.doesNotMatch(code(THIS), /split\('\\n'\)\[\d+\]|\.tsx?:\d+/, 'no line-number pin');
});
