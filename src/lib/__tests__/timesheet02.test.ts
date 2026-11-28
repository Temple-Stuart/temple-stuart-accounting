/**
 * TIMESHEET-02 (Alex, 2026-11-24) — THE TIME SHEET, PART TWO: record on the row.
 *
 * A row of /time's sheet takes its record where it is drawn — went or skipped, what was paid, the stars, the minutes, what he
 * had, the vendor — through the writers that already exist. The rule (src/lib/operations/ledger.ts ledgerOf) decides which rows
 * take one and hands each row's form what it needs on the ONE answer (`recording`, after `sheet`); the form's own rule
 * (recordDraftOf, recordInput) builds the stops POST's body. With it, the review's fixes to TIMESHEET-01: the all-day word typed
 * once, the notes counting the rows the table lists, two plan lines at one stop no longer reading "not recorded".
 * It stands ON TOP OF TIMESHEET-03 (the look): on the answer `recording` follows `tones`, and the look's cells are as they were.
 *
 * The rule is DRIVEN over a fixture built the Budget's own way, on timesheet01.test.ts's model: HERMETIC — no database, no
 * network, and the only clock is the `now` handed in. Every name, place and amount below is made up. The answer function is
 * driven through a fake client; the read through a stubbed fetch; the leaf, the section, the routes and the registry are anchored
 * to their source with comments stripped (the reader law). No pin here names a line number of any file — every pin finds its
 * line by content, and a line the registry cites is read from the citation itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { buildRoutineBudgetLines, occurrenceKey, type RoutinePlanInput } from '../budget/days';
import type { BudgetLine } from '../budget/report';
import type { RoutineWords } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import {
  DONE_AT_SKEW_MS, LINES_WORDS, MINUTES_MAX, NEGATIVE_AMOUNT_WORDS, NOTE_MAX, NOT_RECORDED_WORDS, RATING_WORDS, SKIPPED_WORD, SKIP_REASON_WORDS, amountWords, minutesTypedWords, stopInput, unchanged,
  type StopRecordRow,
} from '../operations/stopRecord';
import { NOT_A_STOP_RECORD_WORDS, ROLE_SHORT_WORDS } from '../operations/stopRole';
import { ALL_DAY_WORDS } from '../operations/work';
import { TOOL_REGISTRY } from '../toolRegistry';
import { taskLedgerAnswerOf } from '../operations/ledgerAnswer';
import { readLedger } from '@/components/workbench/operations/ledger/ledgerReads';
import {
  ACCOUNT_TONES, BOOK_TONES, CANCEL_EXPENSE_WORDS, CLEAR_RECORD_WORDS, DOUBLED_NO_VENDOR_WORDS, EXPENSE_FIELD_WORDS, LEDGER_COLUMNS, MINUTES_RANGE_WORDS, NEUTRAL_TONE, NOTE_LONG_WORDS, NOT_TYPED_WORDS, NO_LINE_NO_VENDOR_WORDS, PILL_CLASS, PLANNED_WORD, RECORD_FIELDS, RECORD_FIELD_WORDS,
  RECORD_ON_OWN_ROW_WORDS, RECORD_TITLE_WORDS, RECORD_WORDS, SAVE_RECORD_WORDS, SKIP_REASON_PLACEHOLDER_WORDS, STARS_RUBRIC_WORDS, STOP_AHEAD_WORDS, TWO_LINES_NO_RECORD_WORDS, WENT_WORD,
  accountPlacesOf, headWordOf, ledgerFailedWords, ledgerOf, noStayWords, notRecordedWords, notesCount, planMinutesOf, recordBody, recordDraftOf, recordInput, startOf, starsTypedWords, wentCellWords, wentOf,
  type LedgerInput, type LedgerLinkInput, type LedgerPlanRow, type LedgerRecordInput, type LedgerRecording, type LedgerRecordingTaken, type LedgerRow, type LedgerVendorRow, type LedgerSaid, type LedgerSheetRow, type RecordDraft,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const WORK = 'src/lib/operations/work.ts';
const ROLE = 'src/lib/operations/stopRole.ts';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const ROUTE = 'src/app/api/operations/ledger/route.ts';
const HOME_ROUTE = 'src/app/api/home-ledger/route.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const LEAF = 'src/components/workbench/operations/ledger/RecordForm.tsx';
const WRITES = 'src/components/workbench/operations/stops/stopWrites.ts';
const VENDOR_BLOCK = 'src/components/workbench/operations/stops/StopVendor.tsx';
const TABLE = 'src/components/table/DataTable.tsx';
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/timesheet02.test.ts';

// ── THE FIXTURE (the Budget's own shapes, as timesheet01.test.ts builds them; every name made up) ──

const NBO = 'Africa/Nairobi'; // UTC+3 the year round
const MON = '2027-05-10';
const TUE = '2027-05-11';
const WED = '2027-05-12';
/** Tue May 11, 12:00 in the zone: all of Monday and Tuesday's morning are past; Tuesday from 12:00 and all of Wednesday are ahead. */
const NOW = new Date('2027-05-11T09:00:00.000Z');
/** An occurrence's instant: a wall clock on a day in the zone (UTC+3), as the Budget's expansion gives it. */
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: NBO, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  // A lined place stop at 12:30: Soup states its own time of day (12:45) and 20 minutes; Bread states neither.
  routine({ id: 'lunch', name: 'Lunch', scheduleRrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', steps: [
    { id: 'soup', stepOrder: 1, budgetAmount: 5.5, coaCode: '6150', durationMinutes: 20, timeOfDay: '12:45' },
    { id: 'bread', stepOrder: 2, budgetAmount: 2.25, coaCode: '6150', durationMinutes: null, timeOfDay: null },
  ] }),
  // A stepless plain stop (role none) at 07:00.
  routine({ id: 'swim', name: 'Swim', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', budgetAmount: 4, coaCode: '6200', role: 'none' }),
  // A stepless place stop at 15:00 — the stop two plan lines will stand at, on Monday and on Tuesday.
  routine({ id: 'tea', name: 'Tea', scheduleRrule: 'FREQ=DAILY;BYHOUR=15;BYMINUTE=0', budgetAmount: 3, coaCode: '6150' }),
  // A routine's OWN amount while it has two active lines that carry none: the Budget's line is the routine's, and the stops route records its lines.
  routine({ id: 'market', name: 'Market', scheduleRrule: 'FREQ=DAILY;BYHOUR=17;BYMINUTE=0', budgetAmount: 12, coaCode: '6150', steps: [
    { id: 'stall-a', stepOrder: 1, budgetAmount: null, coaCode: null, durationMinutes: null, timeOfDay: null },
    { id: 'stall-b', stepOrder: 2, budgetAmount: null, coaCode: null, durationMinutes: null, timeOfDay: null },
  ] }),
  // An all-day charge on the 11th of the month.
  routine({ id: 'locker', name: 'Locker', scheduleRrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0', budgetAmount: 9.75, coaCode: '7450', role: 'all_day' }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]).concat([['kiosk', 'place']]));
/** Each routine's active lines, as the loader reads them — with an amount or without. */
const STEP_WORDS: Readonly<Record<string, readonly [string, { activity: string; timeOfDay: string | null }][]>> = {
  lunch: [['soup', { activity: 'Soup', timeOfDay: '12:45' }], ['bread', { activity: 'Bread', timeOfDay: null }]],
  market: [['stall-a', { activity: 'Stall A', timeOfDay: null }], ['stall-b', { activity: 'Stall B', timeOfDay: null }]],
};
const wordsOf = (steps: typeof STEP_WORDS): Map<string, RoutineWords> => new Map(ROUTINES.map((r): [string, RoutineWords] => [r.id, { name: r.name, timezone: NBO, steps: new Map(r.id in steps ? steps[r.id] : []) }]));
const WORDS = wordsOf(STEP_WORDS);
const VENDORS: LedgerVendorRow[] = [ // TIMESHEET-04b (2026-11-27): the ledger's vendor rows carry their planned items and their vendor's Instagram tag (ledger.ts LedgerVendorRow; PlanVendorRow until then) — none in this fixture
  { id: 'pv-soup', routine_id: null, step_id: 'soup', task_id: null, occurrence_at: null, items: null, vendor: { id: 'v1', vendor_name: 'Ladle & Co', entity_id: 'P', instagram_tag: null }, routine: null, step: { activity: 'Soup', routine_id: 'lunch', routine: { name: 'Lunch', timezone: NBO } }, task: null },
];
/** Tuesday on — Monday has no stay. */
const STAYS: StayRow[] = [{ id: 'em', place: 'Eastmere, Sylvania', starts_on: TUE, ends_on: '2027-05-20' }];
const ACCOUNTS = [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
const line = (r: StopRecordRow, activity: string, timeOfDay: string | null, durationMinutes: number | null): LedgerRecordInput => ({ record: r, routineId: 'lunch', routineName: 'Lunch', zone: NBO, role: 'place', activity, timeOfDay, durationMinutes });
const stop = (routineId: string, routineName: string, role: string, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId, routineName, zone: NBO, role, activity: null, timeOfDay: null, durationMinutes: null });
/** Monday's soup: done twenty minutes after its stop — a done time of its own, which is neither the occurrence (12:30) nor the planned instant (12:45). */
const SOUP_DONE = record({ id: 'r-soup-1', kind: 'routine_line', target_id: 'soup', occurrence_at: at(MON, '12:30'), done_at: at(MON, '12:50'), actual_cents: 600, rating: 4, note: 'with rice', actual_minutes: 18 });
const BREAD_SKIPPED = record({ id: 'r-bread-1', kind: 'routine_line', target_id: 'bread', occurrence_at: at(MON, '12:30'), outcome: 'skipped', done_at: null, note: 'sold out' });
const TEA_DONE = record({ id: 'r-tea-1', kind: 'routine', target_id: 'tea', occurrence_at: at(MON, '15:00'), actual_cents: 300 });
/** A one-off whose routine the loader no longer lists — a record no line matches. */
const KIOSK_DONE = record({ id: 'r-kiosk-1', kind: 'routine', target_id: 'kiosk', occurrence_at: at(MON, '10:00'), actual_cents: 150 });
const RECORDS: LedgerRecordInput[] = [line(SOUP_DONE, 'Soup', '12:45', 20), line(BREAD_SKIPPED, 'Bread', null, null), stop('tea', 'Tea', 'place', TEA_DONE), stop('kiosk', 'Kiosk', 'place', KIOSK_DONE)];
const LINKS: LedgerLinkInput[] = [
  // A REVERSED posting linked to a row with no record (Monday's swim), and one linked to the all-day charge.
  { kind: 'routine', targetId: 'swim', instant: at(MON, '07:00'), journalEntryId: 'je-swim-rev', amountCents: 400, reversed: true },
  { kind: 'routine', targetId: 'locker', instant: at(TUE, '00:00'), journalEntryId: 'je-locker-rev', amountCents: 975, reversed: true },
  // A recorded line: one posting that pays it, and a reversed one beside it.
  { kind: 'routine_line', targetId: 'soup', instant: at(MON, '12:30'), journalEntryId: 'je-soup', amountCents: 600, reversed: false },
  { kind: 'routine_line', targetId: 'soup', instant: at(MON, '12:30'), journalEntryId: 'je-soup-rev', amountCents: 600, reversed: true },
];
const built = buildRoutineBudgetLines(ROUTINES, MON, WED);
/** The Budget's tea line of a day — handed in twice below: two plan lines at one stop, which the rule names and never picks from. */
const teaOn = (day: string): BudgetLine => {
  const found = built.lines.find((l) => l.sourceId === occurrenceKey({ routineId: 'tea', lineId: null, instant: new Date(at(day, '15:00')) }));
  if (found === undefined) return assert.fail(`the Budget lists tea on ${day}`);
  return found;
};
/** Monday's tea twice (and a record there), Tuesday's tea twice (and none). */
const LINES: readonly BudgetLine[] = [...built.lines, teaOn(MON), teaOn(TUE)];
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: MON, to: WED, now: NOW, records: RECORDS, links: LINKS, lines: LINES, open: [], notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS, locations: new Map([...ROLES.keys()].map((id): [string, null] => [id, null])), subAccounts: [], ...over, // COALEVELS-01 (2026-11-27): the input grows additively — every routine's Location (none says one in this fixture) and the caller's sub-accounts (none) · PASTE-03 (2026-11-28): the input says its open occurrences — the lines that name their account and no amount; none here
});
const ledger = ledgerOf(input());
const { sheet, recording } = ledger;

const isPlan = (row: LedgerSheetRow): row is LedgerPlanRow => row.id === null;
/** The sheet's row at a key — one, or the test fails by name. */
const rowAt = (rows: readonly LedgerSheetRow[], key: string): LedgerSheetRow => {
  const found = rows.filter((r) => r.key === key);
  assert.equal(found.length, 1, `one row at ${key}`);
  return found[0];
};
const lineAt = (step: string, day: string, clock: string): string => `line:${step}:${at(day, clock)}`;
const stopAt = (id: string, day: string, clock: string): string => `routine:${id}:${at(day, clock)}`;
/** An entry that takes a record — or the test fails by name. */
const taken = (entry: LedgerRecording | undefined, what: string): LedgerRecordingTaken => {
  if (entry === undefined || !entry.takes) return assert.fail(`${what} takes a record`);
  return entry;
};
/** An entry that takes none — its one sentence. */
const refusedWith = (entry: LedgerRecording | undefined, what: string): string => {
  if (entry === undefined || entry.takes) return assert.fail(`${what} takes no record`);
  return entry.words;
};

// ── WHAT MAIN GIVES: ledgerOf(input()).rows, computed on main e0fd7bf over this fixture (the rule before this change) — pinned here so
//    the old list cannot drift under the new key. On main the same fixture said noStay 4, notRecorded 3 and reversed 1 (T4). ──

// TIMESHEET-04b (2026-11-27): a recorded row holds two fields more — instagramTag after vendor, notes after note. Each row below says them: null, for this fixture's
// vendors hold no tag and its records no notes. Every other field of every row is as it was pinned. COALEVELS-01 (2026-11-27): and two more, after book — location and segments: no routine of this fixture says a Location and none of its accounts holds a sub-account, so a row with a line holds { entity, category, code } and null for the other two levels; a row with no line (or with two) holds null for both.
const MAIN_ROWS: readonly LedgerRow[] = [
  { id: 'r-kiosk-1', key: 'routine:kiosk:2027-05-10T07:00:00.000Z', address: { kind: 'routine', id: 'kiosk', instant: '2027-05-10T07:00:00.000Z' }, match: null, day: '2027-05-10', time: '10:00', place: null, book: null, location: null, segments: null, coa: null, vendor: null, instagramTag: null, description: 'Kiosk', rating: null, note: null, notes: null, cents: null, budgetState: 'none', outcome: 'done', actualCents: 150, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-bread-1', key: 'line:bread:2027-05-10T09:30:00.000Z', address: { kind: 'routine_line', id: 'bread', instant: '2027-05-10T09:30:00.000Z' }, match: null, day: '2027-05-10', time: '12:30', place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: 'Bread', rating: null, note: 'sold out', notes: null, cents: 225, budgetState: 'matched', outcome: 'skipped', actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
  { id: 'r-soup-1', key: 'line:soup:2027-05-10T09:30:00.000Z', address: { kind: 'routine_line', id: 'soup', instant: '2027-05-10T09:30:00.000Z' }, match: { cents: 600, postings: 1, unreadable: 0, reversed: 1 }, day: '2027-05-10', time: '12:45', place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: 'Ladle & Co', instagramTag: null, description: 'Soup', rating: 4, note: 'with rice', notes: null, cents: 550, budgetState: 'matched', outcome: 'done', actualCents: 600, varianceCents: 50, plannedMinutes: 20, loggedMinutes: 18 },
  { id: 'r-tea-1', key: 'routine:tea:2027-05-10T12:00:00.000Z', address: { kind: 'routine', id: 'tea', instant: '2027-05-10T12:00:00.000Z' }, match: null, day: '2027-05-10', time: '15:00', place: null, book: null, location: null, segments: null, coa: null, vendor: null, instagramTag: null, description: 'Tea', rating: null, note: null, notes: null, cents: null, budgetState: 'doubled', outcome: 'done', actualCents: 300, varianceCents: null, plannedMinutes: null, loggedMinutes: null },
];

// ── T1 · THE OLD LIST STAYS; ONE KEY MORE (ruling B) ─────────────────────────

test('T1 `rows` is what main gives for the same fixture and no field is added to a row of it; the rule gains ONE key, `recording`, after `sheet` — exactly the sheet’s keys, in its order', () => {
  assert.deepEqual(ledger.rows, MAIN_ROWS, 'the recorded expenses, cell for cell, in main’s order');
  for (const row of ledger.rows) assert.deepEqual(Object.keys(row), Object.keys(MAIN_ROWS[0]), `${row.id}: the row’s shape is main’s — nothing added to LedgerRow`);
  assert.deepEqual(Object.keys(MAIN_ROWS[0]), ['id', 'key', 'address', 'match', 'day', 'time', 'place', 'book', 'location', 'segments', 'coa', 'vendor', 'instagramTag', 'description', 'rating', 'note', 'notes', 'cents', 'budgetState', 'outcome', 'actualCents', 'varianceCents', 'plannedMinutes', 'loggedMinutes']); // TIMESHEET-04b (2026-11-27): a recorded row holds two fields more — instagramTag after vendor, notes after note (the twenty without them until then). TIMESHEET-02 itself added none. COALEVELS-01 (2026-11-27): and two more — location and segments after book (the twenty-two without them until then).
  assert.deepEqual(Object.keys(ledger), ['from', 'to', 'rows', 'sheet', 'recording', 'said'], 'ONE key more, after the sheet');
  // One entry for EVERY row of the sheet, by the row's key, in the sheet's order — and no entry besides.
  assert.equal(sheet.length, 20);
  assert.deepEqual(Object.keys(recording), sheet.map((r) => r.key));
  assert.equal(new Set(sheet.map((r) => r.key)).size, sheet.length, 'every row has a key of its own, so every row has an entry of its own');
  for (const r of sheet) assert.equal(typeof recording[r.key].takes, 'boolean', `${r.key} says whether it takes a record`);
  // The sheet's own rows are the rows they were: a recorded row is the row of `rows`, itself.
  for (const row of ledger.rows) assert.equal(rowAt(sheet, row.key), row, `${row.id}: the same row, not a copy`);
  // Wire-shaped: strings, numbers, booleans and nulls — it round-trips JSON unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(recording)), recording);
  // In the source: the key beside the sheet, in the one answer; the rows builder as it stood.
  const rules = code(RULES);
  assert.match(rules, /rows,\n\s*sheet,\n\s*recording,\n\s*said: \{/, 'rows, then the sheet, then recording, then what is said');
  assert.match(rules, /const rows: LedgerRow\[\] = expenses\.map\(\(\{ r, day, time \}\) => \{/);
  assert.match(rules, /export interface LedgerInput \{\n\s*readonly from: string;\n\s*readonly to: string;\n\s*readonly now: Date;\n\s*readonly records: readonly LedgerRecordInput\[\];\n\s*readonly links: readonly LedgerLinkInput\[\];\n\s*readonly lines: readonly BudgetLine\[\];\n\s*readonly open: readonly OpenLine\[\];\n\s*readonly notPlaced: readonly NotPlaced\[\];\n\s*readonly routines: ReadonlyMap<string, RoutineWords>;\n\s*readonly roles: ReadonlyMap<string, string>;\n\s*readonly locations: ReadonlyMap<string, LocationClass \| null>;\n\s*readonly subAccounts: readonly LedgerSubAccount\[\];\n\s*readonly minutes: ReadonlyMap<string, number \| null>;\n\s*readonly vendors: readonly LedgerVendorRow\[\];\n\s*readonly stays: readonly StayRow\[\];\n\s*readonly accounts: readonly LedgerAccount\[\];\n\s*readonly books: readonly LedgerBook\[\];\n\}/, 'LedgerInput, key by key'); // PASTE-03 (2026-11-28): the input gains ONE key, right after `lines` — `open`, the occurrences that carry no money (a line that names its account and no amount). COALEVELS-01 (2026-11-27): the input gains two keys, after roles — every routine's Location and the caller's sub-accounts; 'LedgerInput gains no key' until then. TIMESHEET-04b (2026-11-27): the vendors' rows are LedgerVendorRow — the Budget's row with its planned items and its vendor's tag. "readonly PlanVendorRow[]" and 'LedgerInput gains nothing' until then
});

// ── T2 · WHICH ROWS TAKE A RECORD (ruling A) ─────────────────────────────────

test('T2 every recorded row takes a record; a plan row takes one unless its line is all day, it is a routine’s own line while that routine has an active line, or its address is not its alone — one sentence per cause, and WENT blank on each', () => {
  // Every recorded row: edited or cleared there — matched, no line, or doubled alike.
  for (const row of ledger.rows) assert.equal(recording[row.key].takes, true, `${row.id} (${row.budgetState})`);
  // 1. An all-day line: the stops route's own refusal.
  const charge = rowAt(sheet, stopAt('locker', TUE, '00:00'));
  assert.ok(isPlan(charge) && charge.allDay);
  assert.deepEqual(recording[charge.key], { takes: false, words: NOT_A_STOP_RECORD_WORDS });
  assert.equal(NOT_A_STOP_RECORD_WORDS, 'the routine is all day — not a stop, so it takes no record');
  // 2. A routine's own line while the routine has an active line: the route records its lines, not the routine.
  for (const day of [MON, TUE, WED]) {
    const market = rowAt(sheet, stopAt('market', day, '17:00'));
    assert.ok(isPlan(market));
    assert.deepEqual([market.address.kind, market.cents, market.went, recording[market.key]], ['routine', 1200, null, { takes: false, words: LINES_WORDS }], `${day}: the routine’s own amount, and its two lines carry none`);
  }
  assert.equal(LINES_WORDS, 'the routine has lines — record each line, not the routine');
  // The same routine with no active line takes one — the routine's active lines are RoutineWords.steps, as the loader read them.
  const noLines = ledgerOf(input({ routines: wordsOf({ lunch: STEP_WORDS.lunch }) }));
  const bare = rowAt(noLines.sheet, stopAt('market', WED, '17:00'));
  assert.equal(noLines.recording[bare.key].takes, true, 'no active line: the routine itself is the stop');
  assert.equal(wentOf(bare), PLANNED_WORD);
  // A line of a routine is never the routine's own: the lunch's lines take one though the lunch has lines.
  assert.equal(recording[lineAt('soup', WED, '12:30')].takes, true);
  // 3b. Two plan lines at one stop and no record (Tuesday's tea): BOTH rows — the first keeps the bare key and takes none either.
  const K2 = stopAt('tea', TUE, '15:00');
  const two = sheet.filter((r) => r.day === TUE && r.description === 'Tea');
  assert.deepEqual(two.map((r) => [r.key, r.id, r.cents, wentOf(r), recording[r.key]]), [
    [K2, null, 300, null, { takes: false, words: TWO_LINES_NO_RECORD_WORDS }],
    [`${K2}#2`, null, 300, null, { takes: false, words: TWO_LINES_NO_RECORD_WORDS }],
  ], 'decided by the count — not by a "#n" in the key');
  // 3a. Two plan lines at one stop WITH a record (Monday's tea): the record is its own row and takes one; neither line's row does.
  const K1 = stopAt('tea', MON, '15:00');
  const three = sheet.filter((r) => r.day === MON && r.description === 'Tea');
  assert.deepEqual(three.map((r) => [r.key, r.id, r.cents, wentOf(r)]), [[K1, 'r-tea-1', null, 'went'], [`${K1}#1`, null, 300, null], [`${K1}#2`, null, 300, null]]);
  assert.equal(recording[K1].takes, true, 'the record’s own row');
  assert.deepEqual([recording[`${K1}#1`], recording[`${K1}#2`]], [{ takes: false, words: RECORD_ON_OWN_ROW_WORDS }, { takes: false, words: RECORD_ON_OWN_ROW_WORDS }], 'both causes hold — the first is said');
  // 3a alone: a record holds a line's key and one line stands there, but the two could not be joined (the record is placed on another day than the line's).
  const WEDS = at(WED, '07:00');
  const apart = ledgerOf(input({ records: [...RECORDS, { record: record({ id: 'r-swim-3', kind: 'routine', target_id: 'swim', occurrence_at: WEDS, actual_cents: 400 }), routineId: 'swim', routineName: 'Swim', zone: 'Etc/GMT+12', role: 'none', activity: null, timeOfDay: null, durationMinutes: null }] }));
  const swims = apart.sheet.filter((r) => r.address.id === 'swim' && r.address.instant === WEDS);
  assert.deepEqual(swims.map((r) => [r.day, r.key, r.id, wentOf(r), apart.recording[r.key].takes]), [[TUE, `routine:swim:${WEDS}`, 'r-swim-3', 'went', true], [WED, `routine:swim:${WEDS}#1`, null, null, false]]);
  assert.equal(refusedWith(apart.recording[`routine:swim:${WEDS}#1`], 'the line’s row'), RECORD_ON_OWN_ROW_WORDS, 'one line stands there — the record holding its key is the cause');
  // The two new sentences are the rule's own, word for word.
  assert.equal(RECORD_ON_OWN_ROW_WORDS, 'this stop\'s record is on its own row — it could not be joined to one plan line');
  assert.equal(TWO_LINES_NO_RECORD_WORDS, 'two plan lines stand at this stop — neither is taken, so this row takes no record');
  // WENT on a plan row: blank exactly on the rows that take none; 'planned' and 'not recorded' only on rows that take one.
  for (const r of sheet.filter(isPlan)) assert.equal(r.went === null, !recording[r.key].takes, `${r.key}: WENT is blank exactly when the row takes no record`);
  assert.deepEqual(sheet.map((r) => wentCellWords(r)), [
    'not recorded', 'went', 'skipped', 'went', 'went', '—', '—', '—',
    '—', 'not recorded', 'planned', 'planned', '—', '—', '—',
    'planned', 'planned', 'planned', 'planned', '—',
  ], 'Monday · Tuesday · Wednesday');
  assert.deepEqual(sheet.map((r) => recording[r.key].takes), [
    true, true, true, true, true, false, false, false,
    false, true, true, true, false, false, false,
    true, true, true, true, false,
  ]);
  // Two plan lines at one stop no longer read 'not recorded', at any clock (ruling F.3): by Wednesday night Tuesday's tea is past, and still blank.
  const later = ledgerOf(input({ now: new Date('2027-05-13T00:00:00.000Z') }));
  assert.deepEqual(later.sheet.filter((r) => r.day === TUE && r.description === 'Tea').map((r) => wentOf(r)), [null, null]);
  assert.equal(wentOf(rowAt(later.sheet, stopAt('tea', WED, '15:00'))), NOT_RECORDED_WORDS, 'one line at its stop, past, no record');
  // In the source: the decision, in its order; the count before any row is built; WENT follows it.
  const rules = code(RULES);
  assert.match(rules, /const noRecordWords = allDay \? NOT_A_STOP_RECORD_WORDS\n\s*: kind === 'routine' && routine\.steps\.size > 0 \? LINES_WORDS\n\s*: recordedAt\.has\(key\) \? RECORD_ON_OWN_ROW_WORDS\n\s*: lines > 1 \? TWO_LINES_NO_RECORD_WORDS\n\s*: null;/);
  assert.match(rules, /const standing = new Map<string, number>\(\);\n\s*for \(const day of daysOf\(from, to\)\) \{\n\s*for \(const l of planOn\(day\)\) \{\n\s*const key = lineKey\(l\.address\);\n\s*standing\.set\(key, \(standing\.get\(key\) \?\? 0\) \+ 1\);/);
  assert.match(rules, /went: noRecordWords !== null \? null : Date\.parse\(instant\) >= input\.now\.getTime\(\) \? PLANNED_WORD : NOT_RECORDED_WORDS,/, 'against the clock handed in — on a row that takes a record');
  assert.doesNotMatch(rules, /#\d|includes\('#'\)|endsWith\('#/, 'no "#n" in a key decides anything');
  // The two refusals of the route's own are read where the route reads them.
  assert.match(code(STOPS_ROUTE), /if \(r\.steps\.length > 0\) return NextResponse\.json\(\{ error: 'Validation', field: 'id', message: LINES_WORDS \}, \{ status: 400 \}\);/);
  assert.match(code(STOPS_ROUTE), /if \(!isStop\(routine\.role\)\) return NextResponse\.json\(\{ error: 'Validation', field: 'id', message: NOT_A_STOP_RECORD_WORDS \}, \{ status: 400 \}\);/);
});

// ── T3 · WHAT THE FORM IS GIVEN (ruling B) ───────────────────────────────────

test('T3 plannedAt by the day card’s own rule: a line with its own time of day → that clock on the row’s day in the routine’s zone; a line without one, and a stepless routine → the occurrence itself', () => {
  // A line whose step states a time of day (12:45) at an occurrence of 12:30: the planned instant is 12:45 on the row's day.
  const soup = rowAt(sheet, lineAt('soup', WED, '12:30'));
  assert.equal(soup.address.instant, at(WED, '12:30'));
  assert.equal(taken(recording[soup.key], 'Wednesday’s soup').plannedAt, at(WED, '12:45'), 'the line’s own time — not the occurrence’s');
  // A line that states none: the occurrence.
  const bread = rowAt(sheet, lineAt('bread', WED, '12:30'));
  assert.equal(taken(recording[bread.key], 'Wednesday’s bread').plannedAt, at(WED, '12:30'));
  // A stepless routine: the occurrence — though the plan line prints a clock (the occurrence's local time), it states no time of day of its own.
  const swim = rowAt(sheet, stopAt('swim', WED, '07:00'));
  assert.equal(swim.time, '07:00');
  assert.equal(taken(recording[swim.key], 'Wednesday’s swim').plannedAt, at(WED, '07:00'));
  assert.equal(taken(recording[swim.key], 'Wednesday’s swim').plannedAt, swim.address.instant);
  // A recorded row, by the same rule over the record's own plan words: the soup's line states 12:45; the bread's, the tea's and the kiosk's state none.
  assert.equal(taken(recording[lineAt('soup', MON, '12:30')], 'Monday’s soup').plannedAt, at(MON, '12:45'));
  assert.equal(taken(recording[lineAt('bread', MON, '12:30')], 'Monday’s bread').plannedAt, at(MON, '12:30'));
  assert.equal(taken(recording[stopAt('tea', MON, '15:00')], 'Monday’s tea').plannedAt, at(MON, '15:00'));
  assert.equal(taken(recording[stopAt('kiosk', MON, '10:00')], 'the kiosk').plannedAt, at(MON, '10:00'));
  // ISO text on every row that takes one.
  for (const r of sheet) {
    const entry = recording[r.key];
    if (entry.takes) assert.match(entry.plannedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, r.key);
  }
  // In the source: the one helper, and the day card's own line beside it.
  assert.match(code(RULES), /const plannedAtOf = \(day: string, timeOfDay: string \| null, zone: string, instant: string\): string => \(timeOfDay === null \? instant : zonedToInstant\(day, timeOfDay, zone\)\.toISOString\(\)\);/);
  assert.match(code(RULES), /plannedAt: plannedAtOf\(day, kind === 'routine_line' \? l\.time : null, routine\.timezone, instant\)/, 'a plan row: the line’s own time, never a stepless routine’s clock');
  assert.match(code(RULES), /plannedAt: plannedAtOf\(day, r\.timeOfDay, r\.zone, r\.record\.occurrence_at\),/, 'a recorded row: the record’s own plan words');
  assert.match(code('src/components/workbench/operations/day/dayCard.ts'), /const planned = step\.time_of_day === null \? occurrence : zonedToInstant\(input\.day, time, r\.timezone\);/, 'the day card’s rule, as it stands');
});

test('T3 `held` and the vendor slot: a matched recorded row holds its record and the Budget’s box on its matched line; one no line matches, and a doubled one, hold the reason; a plan row holds no record and the box on its own line', () => {
  // Matched: the record as the stops GET answers it — the input's own row — and the plan line as the Budget holds it.
  const soup = taken(recording[lineAt('soup', MON, '12:30')], 'Monday’s soup');
  assert.equal(soup.held, SOUP_DONE, 'the record itself');
  assert.deepEqual(soup.vendor, { kind: 'box', line: {
    entityId: 'P', code: '6150', day: MON, cents: 550, source: 'routine', label: 'Lunch', line: 'Soup', time: '12:45',
    address: { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30') }, vendor: { id: 'v1', name: 'Ladle & Co', entityId: 'P', grain: 'every' }, superseded: null,
  } }, 'the matched line — its book, its address and the vendor it already plans');
  const bread = taken(recording[lineAt('bread', MON, '12:30')], 'Monday’s bread');
  assert.equal(bread.held, BREAD_SKIPPED);
  assert.equal(bread.vendor.kind, 'box');
  // No line matches: the reason — a vendor is planned on a line.
  const kiosk = taken(recording[stopAt('kiosk', MON, '10:00')], 'the kiosk');
  assert.equal(kiosk.held, KIOSK_DONE);
  assert.deepEqual(kiosk.vendor, { kind: 'reason', words: NO_LINE_NO_VENDOR_WORDS });
  // Doubled: the other reason — neither line is taken.
  const tea = taken(recording[stopAt('tea', MON, '15:00')], 'Monday’s tea');
  assert.equal(tea.held, TEA_DONE);
  assert.deepEqual(tea.vendor, { kind: 'reason', words: DOUBLED_NO_VENDOR_WORDS });
  assert.equal(NO_LINE_NO_VENDOR_WORDS, 'no budget line matches this record — a vendor is planned on a line');
  assert.equal(DOUBLED_NO_VENDOR_WORDS, 'two plan lines stand at this stop — neither is taken, so no vendor is planned here');
  // A plan row: no record held, and the box on the row's own line — the line at the row's own address, with the row's own cents and vendor.
  for (const r of sheet.filter(isPlan)) {
    const entry = recording[r.key];
    if (!entry.takes) continue;
    assert.equal(entry.held, null, `${r.key}: no record`);
    assert.equal(entry.vendor.kind, 'box');
    if (entry.vendor.kind !== 'box') continue;
    assert.deepEqual([entry.vendor.line.address, entry.vendor.line.cents, entry.vendor.line.day, entry.vendor.line.vendor === null ? null : entry.vendor.line.vendor.name], [r.address, r.cents, r.day, r.vendor], `${r.key}: its own plan line`);
  }
  // Every recorded row holds its own record, by id.
  for (const row of ledger.rows) assert.equal(taken(recording[row.key], row.id).held?.id, row.id);
  // The slot is the day card's own shape, and the reason never stands in for a line.
  assert.match(code(RULES), /import type \{ VendorSlot \} from '@\/components\/workbench\/operations\/day\/dayCard';/);
  assert.match(code(RULES), /vendor: line !== null \? \{ kind: 'box', line \} : \{ kind: 'reason', words: budgetState === 'doubled' \? DOUBLED_NO_VENDOR_WORDS : NO_LINE_NO_VENDOR_WORDS \},/);
});

// ── T4 · THE NOTES COUNT THE ROWS THE TABLE LISTS (ruling F.2) ───────────────

/** What is said over this fixture now. On main (e0fd7bf) the same fixture said noStay 4, notRecorded 3, reversed 1 — the recorded rows, and a count over the budget lines. */
const SAID: LedgerSaid = { noLine: 2, doubled: 1, noStay: 8, unplaced: [], notRecorded: 2, notPlaced: 0, leftOut: { journal: 0, plan: 0, execute: 0, all_day: 0 }, reversed: 3 };

test('T4 the three notes that count rows count the sheet’s rows: the rows that read "not recorded" are said.notRecorded; a reversed posting linked to an unrecorded row and to an all-day row is counted; noStay counts plan rows — and the words say "row"', () => {
  assert.deepEqual(ledger.said, SAID);
  // notRecorded: exactly the rows whose WENT reads 'not recorded' — the market's own line and the two-line tea are not among them.
  const reading = sheet.filter((r) => wentOf(r) === NOT_RECORDED_WORDS);
  assert.deepEqual(reading.map((r) => r.key), [stopAt('swim', MON, '07:00'), stopAt('swim', TUE, '07:00')]);
  assert.equal(ledger.said.notRecorded, reading.length);
  const counts: number[] = [];
  for (const now of [new Date('2027-05-09T00:00:00.000Z'), new Date(at(MON, '07:00')), NOW, new Date(at(TUE, '12:30')), new Date(Date.parse(at(TUE, '12:30')) + 1), new Date('2027-05-20T00:00:00.000Z')]) {
    const l = ledgerOf(input({ now }));
    assert.equal(l.said.notRecorded, l.sheet.filter((r) => wentOf(r) === NOT_RECORDED_WORDS).length, `at ${now.toISOString()}`);
    counts.push(l.said.notRecorded);
  }
  // The last, counted by hand over the twenty rows once the span is behind: Monday's swim (1); Tuesday's swim, bread and soup (3); Wednesday's swim, bread, soup and tea (4) — eight.
  // The kiosk, Monday's bread, soup and tea hold a record; the four tea rows at a doubled stop, the three market rows and the locker take none.
  assert.deepEqual(counts, [0, 0, 2, 2, 4, 8], 'nothing past · Monday’s swim AT the clock is not past yet · the two swims · the lunch AT 12:30 not past · its two lines one millisecond on · every row that takes a record and has none, once the span is behind');
  assert.equal(notRecordedWords(2), '2 stops planned in the period, already past, with no record', 'the note keeps its words'); // PASTE-03 (2026-11-28): a stop with no budget is counted too — '2 priced stops …' until then
  // reversed: over the sheet's rows — the reversed posting on a row with NO record, the one on the all-day charge, and the one beside a recorded line's paying posting.
  const swim = rowAt(sheet, stopAt('swim', MON, '07:00'));
  const charge = rowAt(sheet, stopAt('locker', TUE, '00:00'));
  assert.deepEqual([swim.id, swim.match], [null, { cents: null, postings: 0, unreadable: 0, reversed: 1 }], 'an unrecorded row, its one link reversed');
  assert.deepEqual([charge.id, isPlan(charge) && charge.allDay, charge.match], [null, true, { cents: null, postings: 0, unreadable: 0, reversed: 1 }], 'the all-day charge');
  assert.deepEqual(rowAt(sheet, lineAt('soup', MON, '12:30')).match, { cents: 600, postings: 1, unreadable: 0, reversed: 1 });
  assert.equal(ledger.said.reversed, 3);
  assert.equal(ledger.said.reversed, sheet.reduce((sum, r) => sum + (r.match === null ? 0 : r.match.reversed), 0));
  assert.equal(ledger.rows.reduce((sum, r) => sum + (r.match === null ? 0 : r.match.reversed), 0), 1, 'the recorded rows alone carry one — what main counted');
  // noStay: the sheet's rows on a day no stay covers — Monday's eight, four of them plan rows.
  const uncovered = sheet.filter((r) => r.place === null);
  assert.deepEqual([uncovered.length, uncovered.filter(isPlan).length, [...new Set(uncovered.map((r) => r.day))]], [8, 4, [MON]]);
  assert.equal(ledger.said.noStay, uncovered.length);
  assert.equal(ledger.rows.filter((r) => r.place === null).length, 4, 'the recorded rows alone — what main counted');
  assert.equal(ledgerOf(input({ records: [], links: [] })).said.noStay, 6, 'with nothing recorded at all, Monday’s six plan rows are still said');
  // The words: "row" / "rows".
  assert.deepEqual([noStayWords(1), noStayWords(8), noStayWords(0)], ['1 row on days no stay covers', '8 rows on days no stay covers', '0 rows on days no stay covers']);
  // The notes about records and lines keep their rules: no line and doubled are counted over `rows`.
  assert.deepEqual([ledger.said.noLine, ledger.said.doubled], [ledger.rows.filter((r) => r.budgetState !== 'matched').length, ledger.rows.filter((r) => r.budgetState === 'doubled').length]);
  assert.equal(notesCount(ledger.said, sheet.length), 8, 'four coverage lines, then no line, no stay, not recorded and reversed');
  // In the source: the three read the sheet; the separate count over the budget lines is gone.
  const rules = code(RULES);
  assert.match(rules, /noStay: sheet\.filter\(\(row\) => row\.place === null\)\.length,/);
  assert.match(rules, /notRecorded: sheet\.filter\(\(row\) => wentOf\(row\) === NOT_RECORDED_WORDS\)\.length,/);
  assert.match(rules, /reversed: sheet\.reduce\(\(sum, row\) => sum \+ \(row\.match === null \? 0 : row\.match\.reversed\), 0\),/);
  assert.match(rules, /noLine: rows\.filter\(\(row\) => row\.budgetState !== 'matched'\)\.length,\n\s*doubled: rows\.filter\(\(row\) => row\.budgetState === 'doubled'\)\.length,/);
  assert.doesNotMatch(rules, /missing\.size|const missing\b/, 'no second count over the budget lines'); assert.equal((rules.match(/\breadOccurrenceKey\(/g) ?? []).length, 1, 'the one reader of an occurrence’s key is called ONCE — to hold the open occurrences’ keys, never to count'); assert.match(rules, /for \(const o of input\.open\) \{\n\s*const read = readOccurrenceKey\(o\.sourceId\);/); // PASTE-03 (2026-11-28): the rule file reads an occurrence's key again — each open occurrence's, into the card's key for its line, so a line's cents are read as none there. It counts nothing: the note still counts the sheet's rows. 'readOccurrenceKey' was forbidden here outright until then
  assert.match(rules, /export const noStayWords = \(n: number\): string => `\$\{n\} row\$\{n === 1 \? '' : 's'\} on days no stay covers`;/);
});

// ── T5 · THE DRAFT (ruling C) ────────────────────────────────────────────────

const BLANK_DRAFT: RecordDraft = { went: 'went', actual: '', stars: '', minutes: '', note: '', notes: '' }; // TIMESHEET-04b (2026-11-27): the draft holds a NOTES box — blank in these drafts
/** A stop at a made-up address, its planned instant fifteen minutes after its occurrence. */
const ADDRESS = { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30') } as const;
const PLANNED = at(MON, '12:45');
const first: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'> = { plannedAt: PLANNED, held: null };
/** The body of an accepted draft — or the test fails with the refusal's words. */
const bodyOf = (draft: RecordDraft, given: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'> = first, now: Date = NOW) => {
  const read = recordInput(draft, ADDRESS, given, now);
  if (!read.ok) return assert.fail(`refused: ${read.field} — ${read.message}`);
  return read.body;
};
/** A refusal's box and words — or the test fails. */
const refusalOf = (draft: RecordDraft, given: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'> = first, now: Date = NOW): [string, string] => {
  const read = recordInput(draft, ADDRESS, given, now);
  if (read.ok) return assert.fail('accepted');
  return [read.field, read.message];
};

test('T5 the draft: from a held record its outcome, dollars, stars, minutes and note; with none — went, every box blank; the dollars read back to the held cents', () => {
  assert.deepEqual(recordDraftOf(null), { went: 'went', actual: '', stars: '', minutes: '', note: '', notes: '' }); // TIMESHEET-04b (2026-11-27): the draft holds a NOTES box — the held record's notes, '' with none (these records hold none); this draft and the three below without it until then
  assert.deepEqual(recordDraftOf(SOUP_DONE), { went: 'went', actual: '6.00', stars: '4', minutes: '18', note: 'with rice', notes: '' });
  assert.deepEqual(recordDraftOf(BREAD_SKIPPED), { went: 'skipped', actual: '', stars: '', minutes: '', note: 'sold out', notes: '' }, 'a null is a blank box, never 0');
  assert.deepEqual(recordDraftOf(record({ ...SOUP_DONE, actual_cents: 0, actual_minutes: 0 })), { went: 'went', actual: '0.00', stars: '4', minutes: '0', note: 'with rice', notes: '' }, 'a held 0 is a 0, not a blank');
  assert.deepEqual([WENT_WORD, SKIPPED_WORD], ['went', 'skipped'], 'the WENT column’s own two words for a record');
  // The dollars a draft opens with read back to the held cents — to the cent, at every size.
  for (const cents of [0, 1, 5, 50, 99, 100, 101, 600, 1234, 99999, 100000, 2147483647]) {
    const held = record({ ...SOUP_DONE, actual_cents: cents });
    assert.equal(bodyOf(recordDraftOf(held), { plannedAt: PLANNED, held }).actual_cents, cents, `${cents} cents`);
  }
  assert.match(code(RULES), /actual: csvMoney\(held\.actual_cents\),/, 'two decimals from the integer cents — the file’s own money text, no float');
});

// ── T6 · THE RULE THE FORM SAVES BY (ruling C) ───────────────────────────────

test('T6 the body: a first went is done at the planned instant; an edited went keeps the held done time; a went over a held skip is done at the planned instant; a skip has no done time and needs its reason; every blank box is null', () => {
  // A first went from the sheet: the stops POST's body at the row's own address, done at the stop's planned instant.
  assert.deepEqual(bodyOf(BLANK_DRAFT), { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30'), outcome: 'done', done_at: PLANNED, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null }, 'every blank box null — never 0'); // TIMESHEET-04b (2026-11-27): the body says its notes — null, the draft's NOTES box is blank
  assert.deepEqual(Object.keys(bodyOf(BLANK_DRAFT)), ['kind', 'id', 'instant', 'outcome', 'done_at', 'actual_cents', 'rating', 'note', 'notes', 'actual_minutes'], 'the one writer’s body'); // TIMESHEET-04b (2026-11-27): the body says its notes, after the note — the nine keys without it until then
  // What "+ expense" records at a stop is the same shape, done at the stop's own instant.
  assert.deepEqual(Object.keys(recordBody({ day: MON, time: '12:30', allDay: false, zone: NBO, instant: at(MON, '12:30'), name: 'x', amount: '1', coa: '6150', bookId: 'P', location: null, vendor: { kind: 'none' }, actualCents: null, rating: null, note: null, ahead: false }, 'soup')), Object.keys(bodyOf(BLANK_DRAFT))); // COALEVELS-01 (2026-11-27): and its Location — none. FORM-BOUNDS-01 (Alex, 2026-11-25): an expense's value says whether its stop is still ahead (ledger.ts ExpenseValues) — this one, built by hand, is not; no `ahead` until then (the test passed without it and the type check did not) · PASTE-03 (2026-11-28): the value says whether the stop is all day — not here: a TIME is typed
  // Every box typed.
  assert.deepEqual(bodyOf({ went: 'went', actual: ' 6.9 ', stars: ' 5 ', minutes: ' 25 ', note: '  two   kinds\tof  soup ', notes: '' }), { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30'), outcome: 'done', done_at: PLANNED, actual_cents: 690, rating: 5, note: 'two kinds of soup', notes: null, actual_minutes: 25 }, 'trimmed; the note’s spaces collapsed'); // TIMESHEET-04b (2026-11-27): the body says its notes — null, the draft's NOTES box is blank
  assert.equal(bodyOf({ ...BLANK_DRAFT, actual: '0', minutes: '0' }).actual_cents, 0, 'a typed 0 is 0');
  assert.equal(bodyOf({ ...BLANK_DRAFT, actual: '0', minutes: '0' }).actual_minutes, 0);
  // An EDIT of a done record keeps that record's own done time — the sheet has no box for it, so it is never rewritten unseen.
  const edit = { plannedAt: PLANNED, held: SOUP_DONE };
  assert.notEqual(SOUP_DONE.done_at, PLANNED);
  assert.equal(bodyOf({ ...recordDraftOf(SOUP_DONE), actual: '7' }, edit).done_at, at(MON, '12:50'), 'the held done_at, kept');
  // A went over a held SKIP is a first went: done at the planned instant.
  const overSkip = { plannedAt: at(MON, '12:30'), held: BREAD_SKIPPED };
  assert.deepEqual(bodyOf({ ...recordDraftOf(BREAD_SKIPPED), went: 'went' }, overSkip), { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30'), outcome: 'done', done_at: at(MON, '12:30'), actual_cents: null, rating: null, note: 'sold out', notes: null, actual_minutes: null }); // TIMESHEET-04b (2026-11-27): the body says its notes — null, the draft's NOTES box is blank
  // A skip: no done time — over a held done record too — and its reason required.
  assert.deepEqual(bodyOf({ ...BLANK_DRAFT, went: 'skipped', note: 'closed' }), { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30'), outcome: 'skipped', done_at: null, actual_cents: null, rating: null, note: 'closed', notes: null, actual_minutes: null }); // TIMESHEET-04b (2026-11-27): the body says its notes — null, the draft's NOTES box is blank
  assert.equal(bodyOf({ ...recordDraftOf(SOUP_DONE), went: 'skipped' }, edit).done_at, null);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, went: 'skipped' }), ['note', SKIP_REASON_WORDS]);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, went: 'skipped', note: '   ' }), ['note', SKIP_REASON_WORDS], 'spaces are no reason');
  assert.equal(SKIP_REASON_WORDS, 'a skipped stop needs its reason (note)');
  // Neither done time stands in for the other: a held done record with no done time is the read's error, by name.
  assert.throws(() => recordInput(BLANK_DRAFT, ADDRESS, { plannedAt: PLANNED, held: record({ ...SOUP_DONE, done_at: null }) }, NOW), /ledger: record r-soup-1 is done with no done_at — the stops route holds one for every done record/);
  assert.throws(() => recordInput(BLANK_DRAFT, ADDRESS, { plannedAt: 'soon', held: null }, NOW), /ledger: "soon" is no instant — a done time is ISO text/);
  // From the sheet itself: a row's own address and its own entry.
  const row = rowAt(ledgerOf(input({ now: new Date(at(WED, '13:00')) })).sheet, lineAt('soup', WED, '12:30'));
  const read = recordInput(BLANK_DRAFT, row.address, taken(recording[row.key], 'Wednesday’s soup'), new Date(at(WED, '13:00')));
  assert.deepEqual(read, { ok: true, body: { kind: 'routine_line', id: 'soup', instant: at(WED, '12:30'), outcome: 'done', done_at: at(WED, '12:45'), actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null } }); // TIMESHEET-04b (2026-11-27): the body says its notes — null, the draft's NOTES box is blank
});

test('T6 each refusal by name — the amount, a negative one, the stars, the minutes typed, the minutes’ range, the long note — the first bad box named, nothing filled in', () => {
  // ACTUAL: dollars by the file's own rule.
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, actual: 'six' }), ['actual', amountWords('six')]);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, actual: '6.905' }), ['actual', amountWords('6.905')], 'at most two decimals');
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, actual: ' 6,90 ' }), ['actual', amountWords('6,90')]);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, actual: '-1' }), ['actual', NEGATIVE_AMOUNT_WORDS]);
  assert.deepEqual([amountWords('six'), NEGATIVE_AMOUNT_WORDS], ['"six" is not an amount (dollars, at most two decimals)', 'an amount is 0 or more']);
  // STARS: 1 to 5.
  for (const typed of ['0', '6', '4.5', 'x', '44']) assert.deepEqual(refusalOf({ ...BLANK_DRAFT, stars: typed }), ['stars', starsTypedWords(typed)], typed);
  assert.equal(starsTypedWords('6'), '"6" is not 1 to 5');
  for (const typed of ['1', '2', '3', '4', '5']) assert.equal(bodyOf({ ...BLANK_DRAFT, stars: typed }).rating, Number(typed));
  // LOGGED MIN: a whole number, then its range.
  for (const typed of ['1.5', '-3', 'ten', '1e2']) assert.deepEqual(refusalOf({ ...BLANK_DRAFT, minutes: typed }), ['minutes', minutesTypedWords(typed)], typed);
  assert.equal(minutesTypedWords('1.5'), '"1.5" is not a number of minutes');
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, minutes: String(MINUTES_MAX + 1) }), ['minutes', MINUTES_RANGE_WORDS]);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, minutes: '9'.repeat(40) }), ['minutes', MINUTES_RANGE_WORDS], 'however long');
  assert.equal(bodyOf({ ...BLANK_DRAFT, minutes: String(MINUTES_MAX) }).actual_minutes, 1440, 'the edge is inside');
  assert.deepEqual([MINUTES_MAX, MINUTES_RANGE_WORDS], [1440, 'LOGGED MIN is 0 to 1440']);
  assert.equal(MINUTES_RANGE_WORDS, `${headWordOf('loggedMinutes')} is 0 to ${MINUTES_MAX}`, 'the column’s own head word');
  // DESCRIPTION: at most NOTE_MAX characters, counted after trimming and collapsing.
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, note: 'n'.repeat(NOTE_MAX + 1) }), ['note', NOTE_LONG_WORDS]);
  assert.equal(bodyOf({ ...BLANK_DRAFT, note: 'n'.repeat(NOTE_MAX) }).note?.length, 280, 'the edge is inside');
  assert.equal(bodyOf({ ...BLANK_DRAFT, note: ` ${'a  '.repeat(140)}` }).note?.length, 279, 'collapsed before it is counted');
  assert.deepEqual([NOTE_MAX, NOTE_LONG_WORDS], [280, 'ITEMS is at most 280 characters']); // COALEVELS-01 (2026-11-27): the form says the sheet's word — the description's head word is ITEMS now; 'DESCRIPTION is at most 280 characters' until then
  assert.equal(NOTE_LONG_WORDS, `${EXPENSE_FIELD_WORDS.note} is at most ${NOTE_MAX} characters`);
  // The first bad box is named — in the boxes' own order: went, ACTUAL, STARS, LOGGED MIN, DESCRIPTION, NOTES.
  assert.deepEqual(RECORD_FIELDS, ['went', 'actual', 'stars', 'minutes', 'note', 'notes']); // TIMESHEET-04b (2026-11-27): NOTES last, after DESCRIPTION — the five without it until then
  const all: RecordDraft = { went: 'went', actual: 'six', stars: '9', minutes: 'ten', note: 'n'.repeat(NOTE_MAX + 1), notes: '' };
  const ahead = new Date(Date.parse(PLANNED) - DONE_AT_SKEW_MS - 1);
  assert.equal(refusalOf(all, first, ahead)[0], 'went');
  assert.equal(refusalOf(all)[0], 'actual');
  assert.equal(refusalOf({ ...all, actual: '' })[0], 'stars');
  assert.equal(refusalOf({ ...all, actual: '', stars: '' })[0], 'minutes');
  assert.equal(refusalOf({ ...all, actual: '', stars: '', minutes: '' })[0], 'note');
  assert.deepEqual(refusalOf({ ...all, went: 'skipped', actual: '', stars: '', minutes: '', note: '' }), ['note', SKIP_REASON_WORDS]);
});

test('T6 a stop still ahead cannot be saved as went — by the route’s own test, at the skew’s edge on either side; it can be skipped with its reason', () => {
  assert.equal(DONE_AT_SKEW_MS, 600000, 'ten minutes — the route’s own allowance');
  const edge = new Date(Date.parse(PLANNED) - DONE_AT_SKEW_MS);
  const before = new Date(edge.getTime() - 1);
  // AT the edge — the planned instant is exactly the clock plus the skew — went is accepted, as the route accepts it.
  assert.equal(bodyOf(BLANK_DRAFT, first, edge).done_at, PLANNED);
  assert.equal(stopInput(bodyOf(BLANK_DRAFT, first, edge), edge).ok, true);
  // One millisecond earlier the stop is still ahead: refused before the write, in the rule's own sentence — where the route would refuse the same body.
  assert.deepEqual(refusalOf(BLANK_DRAFT, first, before), ['went', STOP_AHEAD_WORDS]);
  assert.equal(STOP_AHEAD_WORDS, 'this stop is still ahead — went is saved at the stop\'s own time; skip it with its reason, or record it once that time has come');
  const sent = { kind: 'routine_line', id: 'soup', instant: at(MON, '12:30'), outcome: 'done', done_at: PLANNED, actual_cents: null, rating: null, note: null, actual_minutes: null };
  const routes = stopInput(sent, before);
  assert.deepEqual([routes.ok, routes.ok ? null : routes.field], [false, 'done_at'], 'the route’s own test, on the same body and the same clock');
  // It can be skipped with its reason at that same clock.
  assert.equal(bodyOf({ ...BLANK_DRAFT, went: 'skipped', note: 'rained off' }, first, before).outcome, 'skipped');
  // An edit keeps a done time long past; nothing about the planned instant refuses it.
  assert.equal(bodyOf(recordDraftOf(SOUP_DONE), { plannedAt: at(WED, '12:45'), held: SOUP_DONE }, new Date(at(MON, '13:00'))).done_at, at(MON, '12:50'), 'the held done time decides — never the planned instant');
  // On the sheet: at the clock handed in, Tuesday's soup (planned for 12:45, the clock at 12:00) is still ahead; Monday's swim is not.
  const soup = rowAt(sheet, lineAt('soup', TUE, '12:30'));
  assert.deepEqual(recordInput(BLANK_DRAFT, soup.address, taken(recording[soup.key], 'Tuesday’s soup'), NOW), { ok: false, field: 'went', message: STOP_AHEAD_WORDS });
  const swim = rowAt(sheet, stopAt('swim', MON, '07:00'));
  assert.equal(recordInput(BLANK_DRAFT, swim.address, taken(recording[swim.key], 'Monday’s swim'), NOW).ok, true);
  // In the source: the route's own constant and comparison; the clock handed in, never read.
  assert.match(code(RULES), /if \(at > now\.getTime\(\) \+ DONE_AT_SKEW_MS\) return refuseRecord\('went', STOP_AHEAD_WORDS\);/);
  assert.match(code('src/lib/operations/stopRecord.ts'), /if \(doneAt\.getTime\(\) > now\.getTime\(\) \+ DONE_AT_SKEW_MS\) return refuse\('done_at', `done_at \$\{doneAt\.toISOString\(\)\} is in the future`\);/);
  assert.doesNotMatch(code(RULES), /new Date\(\)|Date\.now\(/, 'the rule reads no clock of its own');
  assert.doesNotMatch(code(THIS), /new Date\(\)|Date\.now\(/, 'nor does this test');
});

// ── T7 · THE ROUTE'S OWN RULE AGREES (ruling C) ──────────────────────────────

test('T7 every body the rule accepts here, stopInput accepts with the same clock; a draft built from a held record and saved untouched is `unchanged` against that record', () => {
  const accepted: { readonly draft: RecordDraft; readonly given: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'>; readonly now: Date }[] = [
    { draft: BLANK_DRAFT, given: first, now: NOW },
    { draft: { went: 'went', actual: '6.9', stars: '5', minutes: '25', note: 'two   kinds of soup', notes: '' }, given: first, now: NOW },
    { draft: { went: 'went', actual: '0', stars: '1', minutes: '0', note: '', notes: '' }, given: first, now: NOW },
    { draft: { went: 'went', actual: '', stars: '', minutes: String(MINUTES_MAX), note: 'n'.repeat(NOTE_MAX), notes: '' }, given: first, now: NOW },
    { draft: { went: 'skipped', actual: '', stars: '', minutes: '', note: 'closed', notes: '' }, given: first, now: NOW },
    { draft: { went: 'skipped', actual: '4', stars: '2', minutes: '5', note: 'left early', notes: '' }, given: first, now: NOW },
    { draft: BLANK_DRAFT, given: first, now: new Date(Date.parse(PLANNED) - DONE_AT_SKEW_MS) },
    { draft: { ...recordDraftOf(SOUP_DONE), actual: '7' }, given: { plannedAt: PLANNED, held: SOUP_DONE }, now: NOW },
    { draft: { ...recordDraftOf(BREAD_SKIPPED), went: 'went' }, given: { plannedAt: at(MON, '12:30'), held: BREAD_SKIPPED }, now: NOW },
    { draft: { ...recordDraftOf(SOUP_DONE), went: 'skipped' }, given: { plannedAt: PLANNED, held: SOUP_DONE }, now: NOW },
  ];
  for (const [i, c] of accepted.entries()) {
    const body = bodyOf(c.draft, c.given, c.now);
    const routes = stopInput(body, c.now);
    assert.equal(routes.ok, true, `case ${i}: the route’s rule accepts it${routes.ok ? '' : ` — ${routes.field}: ${routes.message}`}`);
    if (!routes.ok) continue;
    // What the route would store is what the rule sent.
    assert.deepEqual([routes.value.outcome, routes.value.doneAt === null ? null : routes.value.doneAt.toISOString(), routes.value.actualCents, routes.value.rating, routes.value.note, routes.value.actualMinutes], [body.outcome, body.done_at, body.actual_cents, body.rating, body.note, body.actual_minutes], `case ${i}`);
  }
  // Over the sheet: every row that takes a record, saved as it opens — accepted by the rule exactly when the route's rule accepts the same went.
  let saved = 0;
  for (const r of sheet) {
    const entry = recording[r.key];
    if (!entry.takes) continue;
    const read = recordInput(recordDraftOf(entry.held), r.address, entry, NOW);
    if (read.ok) { assert.equal(stopInput(read.body, NOW).ok, true, r.key); saved += 1; } else assert.deepEqual([read.field, read.message], ['went', STOP_AHEAD_WORDS], `${r.key}: the only refusal a row opens with`);
  }
  assert.equal(saved, 6, 'Monday’s five and Tuesday’s swim — every other row that takes one is still ahead at the clock');
  // A draft built from a held record and saved untouched changes nothing: the route would write nothing and audit nothing.
  for (const held of [SOUP_DONE, BREAD_SKIPPED, TEA_DONE, KIOSK_DONE]) {
    const routes = stopInput(bodyOf(recordDraftOf(held), { plannedAt: PLANNED, held }), NOW);
    if (!routes.ok) return assert.fail(`${held.id}: ${routes.message}`);
    assert.equal(unchanged(held, routes.value), true, `${held.id}: untouched is unchanged`);
  }
  // And one box changed is a change.
  const changed = stopInput(bodyOf({ ...recordDraftOf(SOUP_DONE), stars: '5' }, { plannedAt: PLANNED, held: SOUP_DONE }), NOW);
  assert.equal(changed.ok && unchanged(SOUP_DONE, changed.value), false);
});

// ── T8 · THE ALL-DAY WORD, TYPED ONCE (ruling F.1) ───────────────────────────

test('T8 the all-day word is stopRole.ts’s: ledger.ts imports nothing from work.ts, and work.ts ALL_DAY_WORDS is that same word, read there', () => {
  assert.equal(ALL_DAY_WORDS, ROLE_SHORT_WORDS.all_day);
  assert.equal(ROLE_SHORT_WORDS.all_day, 'all day');
  const charge = rowAt(sheet, stopAt('locker', TUE, '00:00'));
  assert.equal(startOf(charge), ROLE_SHORT_WORDS.all_day, 'START on a charge');
  const rules = code(RULES);
  const work = code(WORK);
  assert.doesNotMatch(rules, /from '@\/lib\/operations\/work'/, 'the rule imports nothing from work.ts');
  assert.match(rules, /export const startOf = \(row: LedgerSheetRow\): string \| null => \(row\.id === null && row\.allDay \? ROLE_SHORT_WORDS\.all_day : row\.time\);/);
  assert.match(work, /import \{ ROLE_SHORT_WORDS \} from '@\/lib\/operations\/stopRole';/);
  assert.match(work, /export const ALL_DAY_WORDS = ROLE_SHORT_WORDS\.all_day;/);
  assert.match(work, /import \{ varianceCellWords \} from '@\/lib\/operations\/ledger';/, 'work.ts still reads the ledger — one way now');
  // Typed once: in the leaf, and in neither reader.
  assert.equal((code(ROLE).match(/'all day'/g) ?? []).length, 1);
  assert.doesNotMatch(rules, /'all day'/);
  assert.doesNotMatch(work, /'all day'/);
  assert.doesNotMatch(code(ROLE), /^import /m, 'the leaf imports nothing');
});

// ── T9 · THE ANSWER AND THE READ (ruling B) ──────────────────────────────────

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

test('T9 the answer function: `recording` rides the one answer after `tones` — nine keys — from the reads it already makes: no query added, removed, widened or reordered; it round-trips JSON', async () => {
  const a = code(ANSWER);
  assert.match(a, /return \{ from, to, as_of: now\.toISOString\(\), first_record: firstRecord, rows: ledger\.rows, sheet: ledger\.sheet, tones: accountPlacesOf\(routineInputs\), recording: ledger\.recording, said: ledger\.said \};/);
  assert.equal((a.match(/db\.[a-z_]+\.(findMany|findFirst)\(/g) ?? []).length, 9, 'the nine reads'); // COALEVELS-01 (2026-11-27): nine — the caller's active sub-accounts joined the eight (ledgerAnswer.ts); no other query added
  assert.doesNotMatch(a, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, 'writes nothing');
  assert.match(code(ROUTE), /return NextResponse\.json\(await taskLedgerAnswerOf\(prisma, user\.id, \{ from, to \}, new Date\(\)\)\);/, 'the route’s code is unchanged');
  const day = (iso: string): Date => new Date(iso);
  const time = (clock: string): Date => new Date(`1970-01-01T${clock}:00.000Z`);
  // The rows as the client reads them: one routine row serves the loader's read and the roles read. COALEVELS-01 (2026-11-27): each row says its Location (none) — the roles read selects location_class now.
  const ROUTINE_ROWS = [
    { id: 'lunch', name: 'Lunch', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30', timezone: NBO, start_time: null, end_time: null,
      steps: [{ id: 'soup', is_active: true, budget_amount: 5.5, coa_code: '6150', step_order: 1, activity: 'Soup', time_of_day: time('12:45'), duration_minutes: 20 }] },
    { id: 'market', name: 'Market', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 12, coa_code: '6150', schedule_rrule: 'FREQ=DAILY;BYHOUR=17;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null,
      steps: [{ id: 'stall-a', is_active: true, budget_amount: null, coa_code: null, step_order: 1, activity: 'Stall A', time_of_day: null, duration_minutes: null }] },
    { id: 'locker', name: 'Locker', role: 'all_day', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 9.75, coa_code: '7450', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null, steps: [] },
    { id: 'swim', name: 'Swim', role: 'none', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 4, coa_code: '6200', schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null, steps: [] },
  ];
  const RECORD_ROW = {
    id: 'rec-swim', routine_id: 'swim', step_id: null, occurrence_at: day(at(TUE, '07:00')), outcome: 'done', done_at: day(at(TUE, '07:40')), actual_cents: 400, rating: 3, note: null, notes: null, actual_minutes: 35, // TIMESHEET-04b (2026-11-27): the table holds a notes column — the fake row says it, as the database would
    routine: { name: 'Swim', timezone: NBO, role: 'none', start_time: null, end_time: null }, step: null,
  };
  const calls: Call[] = [];
  const db = fakeDb({
    entities: [{ id: 'P', name: 'Personal', entity_type: 'personal' }], chart_of_accounts: [{ id: 'acct-6150', entity_id: 'P', code: '6150', name: 'Dining Out', account_type: 'expense', balance_type: 'D' }], chart_of_sub_accounts: [], // COALEVELS-01 (2026-11-27): the chart row's id (the read selects it now) and the caller's sub-accounts — none
    operations_routines: ROUTINE_ROWS, planned_item_vendors: [], operations_stays: [], operations_stop_records: [RECORD_ROW], planned_item_links: [],
  }, calls);
  const answer = await taskLedgerAnswerOf(db, 'someone', { from: TUE, to: TUE }, NOW);
  assert.deepEqual(Object.keys(answer), ['from', 'to', 'as_of', 'first_record', 'rows', 'sheet', 'tones', 'recording', 'said'], 'nine keys: `recording` after `tones`, before what is said');
  assert.deepEqual(answer.tones, { 'P-6150': 0, 'P-6200': 1, 'P-7450': 2 }, 'the accounts’ places, as they were — the lunch’s line and the market share one');
  assert.deepEqual(JSON.parse(JSON.stringify(answer)), answer, 'wire-shaped as built');
  assert.deepEqual(calls.map((c) => `${c.table}.${c.method}`), ['entities.findMany', 'chart_of_accounts.findMany', 'operations_routines.findMany', 'operations_routines.findMany', 'chart_of_sub_accounts.findMany', 'planned_item_vendors.findMany', 'operations_stays.findMany', 'operations_stop_records.findMany', 'operations_stop_records.findFirst', 'planned_item_links.findMany'], 'the reads, in their order — the loader’s (once an entity) among them'); // COALEVELS-01 (2026-11-27): the sub-accounts read stands after the roles read — the one read added; 'the same reads, in the same order' until then
  assert.deepEqual(answer.rows.map((r) => r.id), ['rec-swim'], 'the recorded expense, as before');
  assert.deepEqual(Object.keys(answer.recording), answer.sheet.map((r) => r.key));
  const said = (key: string) => { const e = answer.recording[key]; return e.takes ? [true, e.plannedAt, e.held === null ? null : e.held.id, e.vendor.kind] : [false, e.words]; };
  assert.deepEqual(answer.sheet.map((r) => [r.description, wentOf(r), ...said(r.key)]), [
    ['Locker', null, false, NOT_A_STOP_RECORD_WORDS],
    ['Swim', 'went', true, at(TUE, '07:00'), 'rec-swim', 'box'],
    ['Soup', 'planned', true, at(TUE, '12:45'), null, 'box'],
    ['Market', null, false, LINES_WORDS],
  ], 'the charge · the recorded stop with its record · a line planned at its own time of day, as the loader read it · a routine’s own line while it has an active line');
});

test('T9 the read: the client carries `recording`; an answer without it, or whose `recording` lacks a sheet row’s key, is a failure in words — never a row with no form', async () => {
  const reads = code(READS);
  assert.match(reads, /readonly sheet: readonly LedgerSheetRow\[\];\s*\n\s*readonly tones: AccountPlaces;\s*\n\s*readonly recording: Readonly<Record<string, LedgerRecording>>;\s*\n\s*readonly said: LedgerSaid;/, 'rows, sheet, tones, recording — in that order');
  // The refusals stand in the same order: rows, the sheet, the tones, then the recording.
  const order = ['the ledger came back without its rows', 'the ledger came back without its sheet', 'the ledger came back without its tones', 'the ledger came back without its recording', 'the ledger came back with no recording for the row'].map((words) => reads.indexOf(words));
  assert.ok(order.every((at) => at > -1), 'the five refusals');
  assert.deepEqual([...order].sort((x, y) => x - y), order, 'the recording’s after the tones’');
  assert.match(reads, /if \(typeof recording !== 'object' \|\| recording === null \|\| Array\.isArray\(recording\)\) return \{ ok: false, words: ledgerFailedWords\('the ledger came back without its recording'\) \};/);
  assert.equal((reads.match(/readJson\(/g) ?? []).length, 1, 'still one read — none when a form opens');
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const answers = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const tones = accountPlacesOf(ROUTINES);
  const whole = { from: MON, to: WED, as_of: NOW.toISOString(), first_record: { day: MON }, rows: ledger.rows, sheet, tones, recording, said: ledger.said };
  try {
    g.fetch = answers(whole);
    const ok = await readLedger(MON, WED);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.value.recording, recording, 'as the rule built it, through the wire');
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], sheet: [], tones: {}, recording: {}, said: {} });
    assert.equal((await readLedger(MON, WED)).ok, true, 'an empty period: no row, no entry');
    // Without it.
    const { recording: _left, ...without } = whole;
    void _left;
    g.fetch = answers(without);
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its recording') });
    for (const bad of [null, [], 'yes', 7]) {
      g.fetch = answers({ ...whole, recording: bad });
      assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its recording') }, JSON.stringify(bad));
    }
    // Lacking one sheet row's key.
    const lacks = sheet[7].key;
    g.fetch = answers({ ...whole, recording: Object.fromEntries(Object.entries(recording).filter(([key]) => key !== lacks)) });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords(`the ledger came back with no recording for the row ${JSON.stringify(lacks)}`) });
    g.fetch = answers({ ...whole, recording: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords(`the ledger came back with no recording for the row ${JSON.stringify(sheet[0].key)}`) }, 'the first row it lacks is named');
    // The earlier refusals stand, in their order — the tones' before the recording's: an answer lacking both is refused for its tones.
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], sheet: [], said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its tones') });
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], sheet: [], tones: {}, said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its recording') }, 'with its tones and no recording');
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, rows: [], tones: {}, recording: {}, said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its sheet') });
    g.fetch = answers({ from: MON, to: WED, as_of: 'x', first_record: null, sheet: [], tones: {}, recording: {}, said: {} });
    assert.deepEqual(await readLedger(MON, WED), { ok: false, words: ledgerFailedWords('the ledger came back without its rows') });
  } finally {
    g.fetch = real;
  }
  // The home ledger reads `rows` through the one reader — not the sheet, not what is said, not recording.
  const h = code(HOME_ROUTE);
  assert.match(h, /taskRows: listOf<LedgerRow>\(taskAnswer, '\/api\/operations\/ledger', 'rows'\),/);
  assert.doesNotMatch(h, /recording|\.sheet\b/);
});

// ── T10 · THE LEAF AND THE SECTION (rulings D, E) ────────────────────────────

test('T10 the leaf: the vendor’s block above the form and outside it; went | skipped and five boxes (TIMESHEET-04b: NOTES; four until then) in a <form> that Enter saves; save and clear through the one writer; every word the rule’s — no route named, nothing fetched, nothing stored', () => {
  const f = code(LEAF);
  assert.match(f, /^'use client';/m);
  // Its imports: the one writer's two, and the day card's own vendor block.
  assert.match(f, /import \{ clearStopRecord, setStopRecord \} from '\.\.\/stops\/stopWrites';/);
  assert.match(f, /import StopVendor from '\.\.\/stops\/StopVendor';/);
  assert.match(f, /import \{ useOperationsEntity \} from '\.\.\/EntitySelector';/, 'the provider’s list — ExpenseForm’s own source');
  assert.match(f, /import \{ ACCOUNT_CELL_WORDS \} from '@\/lib\/coa\/accountCell';/);
  assert.doesNotMatch(f, /VendorBox|StopForm|dayCard|useDirectory/, 'the Budget’s box is mounted by the block, not here; this is not the day card’s form');
  // No route named, nothing fetched, nothing stored — in the leaf or the section.
  for (const file of [LEAF, SECTION]) assert.doesNotMatch(code(file), /\/api\/|\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|indexedDB|method:/, `${file}: no route, no request, no browser storage`);
  // The Budget's vendor box is still mounted by one file — the block this leaf mounts.
  const walk = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(`${dir}/${e.name}`)) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  const files = walk('src');
  assert.deepEqual(files.filter((file) => /<VendorBox\b/.test(code(file))), [VENDOR_BLOCK], 'one file mounts the vendor box');
  assert.deepEqual(files.filter((file) => /<StopVendor\b/.test(code(file))).sort(), ['src/components/workbench/operations/day/DayCard.tsx', LEAF].sort(), 'the card and this leaf mount the block');
  // PASTE-02 (Alex, 2026-11-27): the paste's leaf joins — it hands setStopRecord to the one runner (pasteSave.ts runPaste) and calls it nowhere. Five files until then.
  assert.deepEqual(files.filter((file) => /from '(\.\.\/stops|\.|@\/components\/workbench\/operations\/stops)\/stopWrites'/.test(code(file))).sort(), [
    'src/components/workbench/operations/ledger/ExpenseForm.tsx', LEAF, 'src/components/workbench/operations/ledger/PasteRows.tsx', 'src/components/workbench/operations/stops/AttachRecord.tsx', 'src/components/workbench/operations/stops/StopForm.tsx', RULES,
  ].sort(), 'who reads the one writer: the card’s form, the attach, "+ expense", this leaf, the paste’s leaf — and the rule, for the body’s type');
  assert.equal((code(WRITES).match(/\bfetch\s*\(/g) ?? []).length, 3, 'three requests, in the one writer — none added');
  // The vendor's block: mounted once, handed the entry's slot, ABOVE the form and never inside it.
  assert.equal((f.match(/<StopVendor /g) ?? []).length, 1);
  assert.match(f, /<StopVendor slot=\{entry\.vendor\} bookName=\{bookName\} reload=\{onVendor\} \/>/);
  const formAt = f.indexOf('<form ');
  const formEnd = f.indexOf('</form>');
  assert.ok(formAt > -1 && formEnd > formAt, 'a <form>');
  assert.equal((f.match(/<form /g) ?? []).length, 1);
  assert.ok(f.indexOf('<StopVendor ') > -1 && f.indexOf('<StopVendor ') < formAt, 'the block stands above the form');
  const form = f.slice(formAt, formEnd);
  assert.doesNotMatch(form, /StopVendor/, 'never inside it — Enter in the vendor’s box cannot save the record');
  // The book's name, as the card names it; a book the list does not hold by the card's own words.
  assert.match(f, /const book = entities\.find\(\(e\) => e\.id === entityId\);\n\s*return book === undefined \? ACCOUNT_CELL_WORDS\.bookNotLoaded : book\.name;/);
  assert.match(f, /const bookName = entry\.vendor\.kind === 'box' \? bookNameOf\(entry\.vendor\.line\.entityId\) : ACCOUNT_CELL_WORDS\.bookNotLoaded;/);
  // The leaf bounds its own width.
  assert.match(f, /<div className="max-w-3xl [^"]*" data-record-form=\{row\.key\}>/);
  // The title line, always.
  assert.match(f, /<p className="[^"]*" data-record-form-title>\{RECORD_TITLE_WORDS\}<\/p>/);
  assert.equal(RECORD_TITLE_WORDS, 'this row\'s record — went is saved at the stop\'s own time; a done time already recorded is kept');
  // The form: Enter saves; went | skipped are buttons that save nothing; the five boxes (TIMESHEET-04b, 2026-11-27: NOTES after DESCRIPTION — four until then); save, clear only when a record is held, cancel.
  assert.match(f, /<form className="[^"]*" onSubmit=\{\(e\) => \{ e\.preventDefault\(\); save\(\); \}\} data-record-form-boxes>/);
  assert.match(form, /<button type="button" className=\{draft\.went === WENT_WORD \? chipOn : chip\} disabled=\{busy\} aria-pressed=\{draft\.went === WENT_WORD\} onClick=\{\(\) => went\(WENT_WORD\)\} data-record-form-went=\{WENT_WORD\}>\{WENT_WORD\}<\/button>/);
  assert.match(form, /<button type="button" className=\{draft\.went === SKIPPED_WORD \? chipOn : chip\} disabled=\{busy\} aria-pressed=\{draft\.went === SKIPPED_WORD\} onClick=\{\(\) => went\(SKIPPED_WORD\)\} data-record-form-went=\{SKIPPED_WORD\}>\{SKIPPED_WORD\}<\/button>/);
  assert.deepEqual([...form.matchAll(/\{field\('([a-z]+)', <input type="text"/g)].map((m) => m[1]), ['actual', 'stars', 'minutes', 'note', 'notes'], 'ACTUAL, STARS, LOGGED MIN, DESCRIPTION, NOTES — in the rule’s order'); // TIMESHEET-04b (2026-11-27): the NOTES box, on DESCRIPTION's line after it — the four without it until then
  assert.match(form, /\{field\('notes', <input type="text" value=\{draft\.notes\} onChange=\{\(e\) => set\('notes'\)\(e\.target\.value\)\} className=\{`\$\{box\} w-96`\} maxLength=\{NOTES_MAX\} data-record-form-notes \/>\)\}/, 'the NOTES box: the same box class, wider, at most NOTES_MAX — never required, so no placeholder');
  assert.match(form, /maxLength=\{1\} title=\{STARS_RUBRIC_WORDS\} data-record-form-stars/, 'a box, 1 to 5, its title the rubric');
  assert.match(form, /maxLength=\{NOTE_MAX\} placeholder=\{draft\.went === SKIPPED_WORD \? SKIP_REASON_PLACEHOLDER_WORDS : undefined\} data-record-form-note/);
  assert.equal((form.match(/type="submit"/g) ?? []).length, 1, 'one submit — save');
  assert.match(form, /<button type="submit" className=\{chip\} disabled=\{busy\} aria-busy=\{busy\} data-record-form-save>\{SAVE_RECORD_WORDS\}<\/button>\n\s*\{entry\.held !== null && <button type="button" className=\{chip\} disabled=\{busy\} onClick=\{clear\} data-record-form-clear>\{CLEAR_RECORD_WORDS\}<\/button>\}\n\s*<button type="button" className=\{chip\} disabled=\{busy\} onClick=\{onClose\} data-record-form-cancel>\{CANCEL_EXPENSE_WORDS\}<\/button>/);
  // A refusal, in the form, in red — and the form stays (nothing closes it but an accepted write or cancel).
  assert.match(form, /\{refusal !== null && <span className="text-brand-red" data-record-form-refused=\{refusal\.field === null \? '' : refusal\.field\}>\{refusal\.message\}<\/span>\}/);
  // Save: the rule with the clock handed in, then the ONE writer; clear: asks first, by the rule file's question over the row's WENT words, then the same writer.
  assert.match(f, /read = recordInput\(draft, row\.address, entry, new Date\(\)\);/);
  assert.match(f, /if \(!read\.ok\) \{ setRefusal\(read\); return; \}\n\s*const body = read\.body;\n\s*void write\(\(\) => setStopRecord\(body\)\);/);
  assert.match(f, /if \(held === null \|\| busy \|\| !window\.confirm\(clearStopQuestion\(wentCellWords\(row\)\)\)\) return;\n\s*void write\(\(\) => clearStopRecord\(held\.id\)\);/);
  assert.match(f, /const answer = await send\(\);\n\s*if \(!answer\.ok\) \{ setRefusal\(\{ field: null, message: answer\.message \}\); return; \}\n\s*onWritten\(row\.day\);/, 'the route’s refusal in its own words; accepted, the caller is told the day');
  assert.match(f, /const \[draft, setDraft\] = useState<RecordDraft>\(\(\) => rowDraftOf\(row, entry\.held\)\);/, 'it opens with what the row holds'); // TIMESHEET-04b (2026-11-27): the row's own draft — its record's, or the blank draft with DESCRIPTION holding the row's planned items (ledger.ts rowDraftOf); "recordDraftOf(entry.held)" until then
  // No sentence of its own: every printed word is an identifier of the rule's, and no prose stands between tags.
  const printed = [...f.matchAll(/>\{([^}]+)\}<\//g)].map((m) => m[1]);
  assert.deepEqual(printed, ['RECORD_FIELD_WORDS[name]', 'RECORD_TITLE_WORDS', 'RECORD_FIELD_WORDS.went', 'WENT_WORD', 'SKIPPED_WORD', 'SAVE_RECORD_WORDS', 'CLEAR_RECORD_WORDS', 'CANCEL_EXPENSE_WORDS', 'refusal.message'], 'as the source prints them — a box’s label first: its helper stands above the markup that calls it');
  assert.doesNotMatch(f, />[A-Za-z][^<>{}]*[a-z][^<>{}]*</, 'no bare prose between tags');
  assert.doesNotMatch(f, /placeholder="|title="|aria-label="/, 'no word typed in an attribute');
  // The words themselves.
  assert.deepEqual([RECORD_WORDS, SAVE_RECORD_WORDS, CLEAR_RECORD_WORDS, CANCEL_EXPENSE_WORDS, SKIP_REASON_PLACEHOLDER_WORDS], ['record', 'save', 'clear', 'cancel', 'why — required']);
  assert.deepEqual(RECORD_FIELD_WORDS, { went: 'WENT', actual: 'ACTUAL', stars: 'STARS', minutes: 'LOGGED MIN', note: 'ITEMS', notes: 'NOTES' }, 'a label is the column’s own head word — no second word for a thing the table already names'); // TIMESHEET-04b (2026-11-27): NOTES, the new column's own head word · COALEVELS-01 (2026-11-27): the note's box is labelled ITEMS — the description's head word in his sheet's words; DESCRIPTION until then
  for (const column of ['went', 'actual', 'stars', 'loggedMinutes', 'description', 'notes'] as const) assert.ok(Object.values(RECORD_FIELD_WORDS).includes(headWordOf(column)), `${column}: the head word`);
  assert.equal(LEDGER_COLUMNS.length, 25, 'TIMESHEET-02 added no column; TIMESHEET-04b two; COALEVELS-01 two'); // TIMESHEET-04b (2026-11-27): twenty-three — 21, and 'no column is added', until then · COALEVELS-01 (2026-11-27): twenty-five — REGION and LOCATION; 23 until then
  assert.equal(STARS_RUBRIC_WORDS, [5, 4, 3, 2, 1].map((n) => `${n} — ${RATING_WORDS[n as 1 | 2 | 3 | 4 | 5]}`).join(' · '), 'the rubric, five to one');
  assert.match(comments(LEAF), /RecordForm — A ROW'S RECORD, ON THE TIME SHEET \(TIMESHEET-02, Alex, 2026-11-24\)\./);
});

test('T10 the section: the "record" chip in the WENT cell on every row whose entry takes one; the row beneath and its one mount; a write no longer takes the table away — the answer is blanked only on a new span', () => {
  const s = code(SECTION);
  assert.match(s, /import RecordForm from '\.\/RecordForm';/);
  // Its own state — the row's key, React state only — beside the picker's, which is untouched.
  assert.match(s, /const \[picking, setPicking\] = useState<string \| null>\(null\);\n\s*const \[entering, setEntering\] = useState<string \| null>\(null\);\n\s*const \[reading, setReading\] = useState\(false\);/);
  // It reads `recording`; it asks no row which kind it is.
  assert.match(s, /const recording: Readonly<Record<string, LedgerRecording>> = answer !== null && answer\.read\.ok \? answer\.read\.value\.recording : \{\};/);
  assert.match(s, /const entry = recording\[row\.key\];/);
  assert.doesNotMatch(s, /row\.id (===|!==) null|allDay/, 'no cell asks which kind of row it draws');
  // The chip: in the WENT cell, after the word, on a row that takes one; a row that takes none has no chip and its title is the entry's words.
  assert.match(s, /<td className=\{`\$\{cell\} whitespace-nowrap \$\{wentOf\(row\) === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="went" title=\{entry\.takes \? undefined : entry\.words\}>\n\s*<span data-ledger-went>\{wentCellWords\(row\)\}<\/span>\n\s*\{entry\.takes && <button type="button" className=\{`\$\{chip\} ml-1 font-normal`\} onClick=\{\(\) => setEntering\(entering === row\.key \? null : row\.key\)\} data-ledger-record=\{row\.key\} aria-expanded=\{entering === row\.key\}>\{RECORD_WORDS\}<\/button>\}\n\s*<\/td>/);
  // The row beneath, as the picker's: its own <tr> spanning the columns, the leaf keyed by the row's key — mounted once.
  assert.match(s, /\{entering === row\.key && entry\.takes && \(\n\s*<tr className="border-t border-border" data-ledger-recording=\{row\.key\}>\n\s*<td colSpan=\{LEDGER_HEAD_WORDS\.length - dayFoldCount\(period\)\} className=\{cell\}>\n\s*<RecordForm key=\{row\.key\} row=\{row\} entry=\{entry\} onWritten=\{\(day\) => \{ setEntering\(null\); setWrites\(\(n\) => n \+ 1\); announceDayWritten\(day\); \}\} onVendor=\{\(\) => setWrites\(\(n\) => n \+ 1\)\} onClose=\{\(\) => setEntering\(null\)\} \/>/); // TIMEDAY-01 (Alex, 2026-11-24): the row beneath spans the columns still shown — every one, less the four a single day folds (ledger.ts dayFoldCount; timeday01.test.ts); `colSpan={LEDGER_HEAD_WORDS.length}` until then
  assert.equal((s.match(/<RecordForm /g) ?? []).length, 1);
  // After an accepted write the section does what it does after "+ expense": the span is read again and the day is announced.
  assert.match(s, /<ExpenseForm onWritten=\{\(day\) => \{ setWrites\(\(n\) => n \+ 1\); announceDayWritten\(day\); \}\} \/>/);
  // The "link" chip, the picker's row and its state are untouched.
  assert.match(s, /<button type="button" className=\{`\$\{chip\} ml-1 font-normal`\} onClick=\{\(\) => setPicking\(picking === row\.key \? null : row\.key\)\} data-ledger-link=\{row\.key\} aria-expanded=\{picking === row\.key\}>\{LINK_WORDS\}<\/button>/);
  assert.match(s, /\{picking === row\.key && \(\n\s*<tr className="border-t border-border" data-ledger-picker=\{row\.key\}>\n\s*<td colSpan=\{LEDGER_HEAD_WORDS\.length - dayFoldCount\(period\)\} className=\{cell\}>\n\s*<LinkPicker kind=\{row\.address\.kind\} id=\{row\.address\.id\} instant=\{row\.address\.instant\} near=\{row\.day\} onChanged=\{\(\) => setWrites\(\(n\) => n \+ 1\)\} onClose=\{\(\) => setPicking\(null\)\} \/>/); // TIMEDAY-01 (Alex, 2026-11-24): the row beneath spans the columns still shown — every one, less the four a single day folds (ledger.ts dayFoldCount; timeday01.test.ts); `colSpan={LEDGER_HEAD_WORDS.length}` until then
  assert.equal((s.match(/<LinkPicker /g) ?? []).length, 1);
  // THE READ EFFECT: the answer on screen is blanked only when the span changes; a re-read of the same span leaves it drawn.
  assert.match(s, /useEffect\(\(\) => \{\n\s*if \(period === null\) return;\n\s*let live = true;\n\s*setAnswer\(\(held\) => \(held !== null && held\.period\.from === period\.from && held\.period\.to === period\.to \? held : null\)\);\n\s*setReading\(true\);\n\s*\(async \(\) => \{\n\s*const read = await readLedger\(period\.from, period\.to\);\n\s*if \(!live\) return;\n\s*setAnswer\(\{ period, read \}\);\n\s*setReading\(false\);\n\s*if \(read\.ok\) setFirstRecord\(read\.value\.first_record\);\n\s*\}\)\(\);\n\s*return \(\) => \{ live = false; \};\n\s*\}, \[period\?\.from, period\?\.to, writes\]\);/);
  assert.doesNotMatch(s, /setAnswer\(null\)/, 'never blanked outright');
  // While that read is in flight the loading words stand where the loading line stood; the table's own conditions are as they were.
  assert.match(s, /\{period !== null && \(answer === null \|\| reading\) && <div className="text-xs text-text-muted" data-ledger-loading>\{LEDGER_LOADING_WORDS\}<\/div>\}/);
  assert.match(s, /loaded=\{answer !== null && answer\.read\.ok\}\n\s*tableClassName=\{LEDGER_TABLE_CLASS\}/, 'loaded as it was; the table’s floor as it was, inside the rule’s class'); // TIMEWIDE-01 (Alex, 2026-11-24): the table's class is the rule file's LEDGER_TABLE_CLASS — its floor still min-w-[96rem] (timewide01.test.ts); `tableClassName="min-w-[96rem]"`, 'the table’s width as it was', until then
  assert.match(code(TABLE), /\{loaded && rows\.length > 0 && \(\n\s*<div className="overflow-x-auto border border-border rounded bg-white">/, 'the shared table still draws only while loaded — it is not edited');
  // One cell per head word, in its order — TIMESHEET-02 added no column. TIMESHEET-04b (2026-11-27): twenty-three — the instagram-tag cell after vendor's, the notes cell after description's; 21 until then. COALEVELS-01 (2026-11-27): twenty-five — the region's and the location's cells; 23 until then.
  const cells = [...s.matchAll(/data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]);
  assert.equal(cells.length, 25);
  assert.equal((s.match(/colSpan=\{LEDGER_HEAD_WORDS\.length - dayFoldCount\(period\)\}/g) ?? []).length, 2, 'the two rows beneath span every column shown'); // TIMEDAY-01 (Alex, 2026-11-24): both rows span the columns still shown, the same way — `/colSpan=\{LEDGER_HEAD_WORDS\.length\}/g`, 'the two rows beneath span every column', until then
  assert.match(comments(SECTION), /TIMESHEET-02 \(Alex, 2026-11-24\): THE TIME SHEET, PART TWO — RECORD ON THE ROW\./);
  assert.match(comments(RULES), /TIMESHEET-02 \(Alex, 2026-11-24\) — THE TIME SHEET, PART TWO: RECORD ON THE ROW\./);
});

test('T10 on top of TIMESHEET-03: the answer’s nine keys in order, `tones` built as it was; the look’s cells as main has them — Day first, the two pills, the tint on its four cells and not on WENT, the legend through a re-read', () => {
  // The answer's keys, read off its own return: `recording` after `tones`, before what is said (ruling J.2).
  const a = code(ANSWER);
  const returned = /return \{ ([^}]+) \};\n\}/.exec(a);
  if (returned === null) return assert.fail('the answer function ends on its return');
  assert.deepEqual(returned[1].split(', ').map((part) => part.split(':')[0]), ['from', 'to', 'as_of', 'first_record', 'rows', 'sheet', 'tones', 'recording', 'said']);
  // `tones` is built as it was — by the places' own function over the routines already read, never by the rule.
  assert.match(a, /sheet: ledger\.sheet, tones: accountPlacesOf\(routineInputs\), recording: ledger\.recording, said: ledger\.said/);
  assert.deepEqual(accountPlacesOf(ROUTINES), { 'P-6150': 0, 'P-6200': 1, 'P-7450': 2 }, 'the fixture’s accounts: the lunch’s lines, the tea and the market share one; the stalls carry no code');
  assert.equal('tones' in ledger, false, 'the rule returns no tones — its six keys are from, to, rows, sheet, recording, said');
  // The look's own rule, as it was.
  assert.equal(PILL_CLASS, 'inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap');
  assert.deepEqual([ACCOUNT_TONES.length, ACCOUNT_TONES[0], ACCOUNT_TONES[12], NEUTRAL_TONE], [13, 'bg-blue-200 text-blue-950', 'bg-sky-200 text-sky-950', 'bg-gray-200 text-gray-800']);
  assert.deepEqual(BOOK_TONES, { Personal: 'bg-gray-300 text-gray-900', Business: 'bg-violet-200 text-violet-950', Trading: 'bg-emerald-200 text-emerald-950' });
  assert.equal(NOT_TYPED_WORDS, 'not typed on a row — from your plan, from Books, or worked out');
  // The section: the period still starts on Day.
  const s = code(SECTION);
  assert.match(s, /const \[kind, setKind\] = useState<PeriodKind>\('day'\);/);
  // The two pills, and the places they are toned by.
  assert.match(s, /const tones: AccountPlaces = answer !== null && answer\.read\.ok \? answer\.read\.value\.tones : \{\};/);
  assert.match(s, /const bookPill = bookPillClassOf\(row\);\n\s*const accountPill = accountPillClassOf\(row, tones\);/);
  assert.match(s, /<td className=\{`\$\{cell\} whitespace-nowrap \$\{row\.book === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="book">\{row\.segments !== null && row\.segments\.entity !== null && <span className=\{CODE_CLASS\}>\{row\.segments\.entity\}<\/span>\}\{bookPill === null \? bookCellWords\(row\) : <span className=\{bookPill\} data-ledger-pill="book">\{bookCellWords\(row\)\}<\/span>\}<\/td>/); // COALEVELS-01 (2026-11-27): the entity's letter before the pill, in the code's class, where the row's levels hold one — the pill and its words as they were
  assert.match(s, /<td className=\{`\$\{cell\} \$\{row\.coa === null \|\| row\.coa\.name === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="account-name">\{row\.segments !== null && <span className=\{CODE_CLASS\}>\{row\.segments\.category\}<\/span>\}\{accountPill === null \? accountNameCellWords\(row\) : <span className=\{accountPill\} data-ledger-pill="account-name">\{accountNameCellWords\(row\)\}<\/span>\}<\/td>/); // COALEVELS-01 (2026-11-27): the category's code before the pill, in the code's class, on every row that has a line — the pill and its words as they were
  // The tint: on BUDGET, VARIANCE, MATCH and UNDER / OVER and on no other cell — WENT, where the chip stands, is not tinted.
  const cells = [...s.matchAll(/<td className=\{`([^\n]*?)`\} data-ledger-cell="([a-z-]+)"/g)].map((m) => ({ name: m[2], tinted: m[1].includes('${NOT_TYPED_TINT}') }));
  assert.equal(cells.length, 25); // TIMESHEET-04b (2026-11-27): twenty-three cells, the two new ones untinted (a tag and notes are typed, not worked out) — 21 until then · COALEVELS-01 (2026-11-27): twenty-five — the region's and the location's cells, untinted (a place and a Location are the plan's own, typed); 23 until then
  assert.deepEqual(cells.filter((c) => c.tinted).map((c) => c.name), ['budget', 'variance', 'match', 'under-over']);
  assert.match(s, /const NOT_TYPED_TINT = 'bg-blue-50';/);
  // The legend: on the same condition — it does not read `reading`, so it stays while a re-read of the same span is in flight (rows are still shown). COALEVELS-01 (2026-11-27): the legend is its swatch at the head of the controls row's trailing, its meaning in its label and title — a separate line beneath the table, the sentence beside the swatch, until then.
  const legend = /\n\s*<>(\{answer !== null && answer\.read\.ok && shown\.length > 0 && <span className=\{`inline-block h-3 w-3 rounded-sm border border-border \$\{NOT_TYPED_TINT\}`\} role="img" aria-label=\{NOT_TYPED_WORDS\} title=\{NOT_TYPED_WORDS\} data-ledger-legend data-ledger-legend-swatch \/>\})/.exec(s);
  if (legend === null) return assert.fail('the legend — its swatch — stands first in the controls row’s trailing');
  assert.ok(legend[1].includes('aria-label={NOT_TYPED_WORDS} title={NOT_TYPED_WORDS}'));
  assert.doesNotMatch(legend[1], /reading/);
  // The form's row is the leaf's mount — no box in the section's own row.
  const row = s.slice(s.indexOf('renderRow={(row) => {'), s.indexOf('foot={('));
  assert.doesNotMatch(row, /<input|<select|<textarea|<form|contentEditable/);
});

// ── T11 · THE REGISTRY (ruling H) ────────────────────────────────────────────

/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');

test('T11 the registry’s Time row: status, beats, why, note and customer line unchanged; the commit beat names the sheet’s door beside the card’s; every line it cites holds what it cites; the two pinned files keep their line counts', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.beats, time.home, time.why], ['LIVE', { discover: true, decide: true, commit: true, record: true }, '/time', undefined]);
  assert.equal(time.customer, 'You can see every stop you logged and every journal answer, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.');
  assert.match(time.note ?? '', /^HOME-03 \(2026-10-27\): the day itself is entered on the day card/);
  // The number a citation names, read from the citation itself — and the line it names, by content.
  const cited = (re: RegExp): number => { const m = time.citation.match(re); if (m === null) return assert.fail(`the citation names ${re}`); return Number(m[1]); };
  const lineOf = (file: string, n: number): string => linesOf(file)[n - 1] ?? '';
  // The commit beat: the stops POST through the one writer, from the card AND from the sheet's row — in the citation's own form.
  assert.match(time.citation, /commit: src\/app\/api\/operations\/stops\/route\.ts \(POST — the record at a stop, through stops\/stopWrites\.ts:\d+, from the card[^)]*ledger\/RecordForm\.tsx:\d+\)/);
  assert.match(lineOf(WRITES, cited(/through stops\/stopWrites\.ts:(\d+)/)), /await fetch\('/, 'the one writer’s request');
  assert.match(lineOf(LEAF, cited(/ledger\/RecordForm\.tsx:(\d+)/)), /setStopRecord\(body\)/, 'the sheet’s door: the leaf’s save');
  assert.match(lineOf('src/components/workbench/operations/ledger/ExpenseForm.tsx', cited(/ledger\/ExpenseForm\.tsx:(\d+)/)), /createOneOff\(oneOffBody\(v\)\)/, '"+ expense", where it was');
  // Every citation this change moved, re-cited: each line is what it says.
  assert.match(lineOf(RULES, cited(/src\/lib\/operations\/ledger\.ts:(\d+) \(LEDGER_HEAD_WORDS/)), /^export const LEDGER_HEAD_WORDS = \[/);
  assert.match(lineOf(RULES, cited(/the summary's sums, src\/lib\/operations\/ledger\.ts:(\d+)/)), /^export const SUMMARY_HEAD_WORDS = \[/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the two cells\)/)), /data-ledger-cell="planned-minutes"/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(PLANNED HOURS · LOGGED HOURS/)), /data-ledger-group-planned-hours/);
  assert.match(lineOf(SECTION, cited(/their coverage said at LedgerSection\.tsx:(\d+)/)), /data-ledger-said-planned/);
  // And the ones that did not move.
  assert.match(lineOf(READS, cited(/discover: src\/components\/workbench\/operations\/ledger\/ledgerReads\.ts:(\d+)/)), /readJson\(`\/api\/operations\/ledger\?/);
  assert.match(lineOf(ANSWER, cited(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the line's duration\)/)), /duration_minutes: true/);
  assert.match(lineOf(ANSWER, cited(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the routine's window\)/)), /start_time: true, end_time: true/);
  // The dated note on the row says what moved.
  assert.match(comments(REGISTRY), /TIMESHEET-02 \(Alex, 2026-11-24\): [^\n]*RecordForm\.tsx/);
  // The two files other tests pin by line number keep their line counts (ruling H).
  assert.equal(linesOf(REGISTRY).length, 761);
  assert.equal(linesOf(LAW).length, 11254);
});

// ── T12 · NOTHING ELSE ───────────────────────────────────────────────────────

test('T12 this change adds no route, no migration and no writer; the rule stays pure; this test pins no line number of any file', () => {
  for (const f of [RULES, ANSWER, ROUTE, READS, SECTION, LEAF]) assert.doesNotMatch(code(f), /prisma\.\$executeRaw|ALTER TABLE|migrations|\$transaction/, `${f}: no migration, no raw SQL`);
  assert.doesNotMatch(code(RULES), /\bfetch\b|@prisma\/client|from 'react'|from 'next/, 'the rule stays pure');
  assert.doesNotMatch(code(LEAF), /prisma|NextResponse|getVerifiedEmail/, 'the leaf is a screen file — the routes gate');
  // The routes the writes go through still gate before any read or write (FIRST a).
  for (const route of [STOPS_ROUTE, 'src/app/api/operations/stops/[id]/route.ts']) {
    assert.match(code(route), /const userEmail = await getVerifiedEmail\(\);\n\s*if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);\n\s*const user = await prisma\.users\.findFirst\(/, `${route}: the signed cookie, then the user`);
    assert.match(code(route), /await writeAuditLog\(\{/, `${route}: audited`);
  }
  assert.doesNotMatch(code(THIS), /split\('\\n'\)\[\d+\]|\.tsx?:\d+/, 'no line-number pin');
});
