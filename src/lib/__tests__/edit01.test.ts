/**
 * EDIT-01 (Alex, 2026-11-28) — TYPE IN A CELL, DELETE A ROW: a cell he types opens as its box on any row of the time sheet and saves where
 * its value lives; every row has a ✕ that deletes it, asked in place first.
 *
 * PART 1 — what a row can change, in the answer (src/lib/operations/ledger.ts `editing`, the input's `once`; ledgerAnswer.ts; ledgerReads.ts).
 * PART 2 — the cell opens; the record's cells. PART 3 — a one-off's plan cells, the vendor, its tag and its items. PART 4 — every row's ✕.
 * Each part's tests land in the commit that builds it.
 *
 * HERMETIC, on sheet01.test.ts's model — no database, no network, the only clock the one handed in. The rules are DRIVEN directly over
 * made-up rows; the screens are anchored to their source with comments stripped (the reader law). Every plan, vendor, day, account and
 * amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React }); // PART 2 draws the one box of a column — its JSX reads React as a global under tsx (booksPipe.test.ts's way)
import { code, comments } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { RoutineWords } from '../budget/planLines';
import { isOnceRRule } from '../operations/rruleHelpers';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  routineClocksOf, CELL_KEYS_WORDS, CELL_REACH_WORDS, CELL_WENT_NONE_WORDS, CLEAR_CELL_QUESTION, KEEP_WORDS, LEDGER_COLUMNS, NEVER_OPENS_WORDS, NO_PLAN_LINE_WORDS, RECORD_CELLS, STOP_AHEAD_WORDS, TWO_LINES_NO_PLAN_WORDS, TYPED_COLUMNS,
  boxTextOf, cellOpens, cellReachWords, isTypedColumn, ledgerFailedWords, ledgerOf, nextOpeningColumn, planMinutesOf, recordCellDraft, recordInput, rowDraftOf, starsTypedWords, tagReachWords,
  type LedgerEditing, type LedgerInput, type LedgerRecordInput, type LedgerRecordingTaken, type LedgerSheetRow, type LedgerVendorRow, type TypedColumn,
  CHARGE_HAS_RECORD_WORDS, END_AT_START_WORDS, END_NEEDS_START_WORDS, ITEMS_CELL_NO_VENDOR_WORDS, LINE_CELLS, NAME_LONG_WORDS, ONE_OFF_NAME_MAX, PLAN_CELLS, RECORD_ON_OWN_ROW_WORDS, REPEATING_DATE_WORDS,
  TAG_NEEDS_VENDOR_WORDS, VENDORS_LOADING_WORDS, isRecordCell, nameNotPutBackWords, planCellWrite, requiredWords, timeTypedWords, vendorAddedNotSetWords, type LedgerEditingPlan, type LedgerPlanRow,
  DELETE_ROW_WORDS, DELETE_WORDS, deleteOneOffQuestion, deletePlanQuestion, deleteRecordQuestion, rowDeleteOf,
} from '../operations/ledger';
import { VENDORS_NO_LIST_WORDS, vendorsUnreadWords } from '../operations/pasteRows';
import { readLedger } from '../../components/workbench/operations/ledger/ledgerReads';
import ColumnBox from '../../components/workbench/operations/ledger/ColumnBox';
import { clearRecordCell, deleteRow, readCellVendors, saveCell, savePlanCell, saveRecordCell, saveVendorCell, type CellVendors } from '../../components/workbench/operations/ledger/cellSaves';
import { routineHoldsLinksWords } from '../operations/linkHold';
import { clearVendor, patchLine, patchRoutine, setVendor } from '../../components/workbench/operations/ledger/ledgerWrites';

const SHEET_RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const BOX = 'src/components/workbench/operations/ledger/ColumnBox.tsx';
const SAVES = 'src/components/workbench/operations/ledger/cellSaves.ts';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';
const WRITERS = 'src/components/workbench/operations/ledger/ledgerWrites.ts';

// ── THE FIXTURE — every plan, vendor, day and amount made up ─────────────────

const NBO = 'Africa/Nairobi'; // UTC+3 the year round
const THU = '2027-03-04';
const FRI = '2027-03-05';
/** Thursday 18:00 in the zone: Thursday's stops are past, Friday's ahead. */
const NOW = new Date('2027-03-04T15:00:00.000Z');
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: NBO, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  // A ONE-OFF, as "+ expense" writes one: named for its day and time, one line — Lunch at Harbor Cafe, planned at this occurrence.
  routine({ id: 'lunch', name: 'Lunch · 2027-03-04 12:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', startDate: THU, endDate: THU, steps: [
    { id: 'lunch-line', stepOrder: 1, budgetAmount: 15, coaCode: '6150', durationMinutes: 45, timeOfDay: null },
  ] }),
  // A one-off with no vendor.
  routine({ id: 'dinner', name: 'Dinner · 2027-03-05 19:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=19;BYMINUTE=0', startDate: FRI, endDate: FRI, steps: [
    { id: 'dinner-line', stepOrder: 1, budgetAmount: 25, coaCode: '6150', durationMinutes: null, timeOfDay: null },
  ] }),
  // A REPEATING plan, stepless — its own line; Iron Works is its vendor for EVERY occurrence.
  routine({ id: 'gym', name: 'Morning Gym', scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', budgetAmount: 20, coaCode: '6200' }),
  // A repeating plan whose every line is handed in twice below — two plan lines at one stop.
  routine({ id: 'tea', name: 'Tea', scheduleRrule: 'FREQ=DAILY;BYHOUR=16;BYMINUTE=0', budgetAmount: 3, coaCode: '6150' }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]).concat([['kiosk', 'place']]));
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: NBO, steps: new Map(r.steps.map((s) => [s.id, { activity: s.id === 'lunch-line' ? 'Lunch' : 'Dinner', timeOfDay: null }])),
}]));
const ONCE = new Map(ROUTINES.map((r): [string, boolean] => [r.id, isOnceRRule(r.scheduleRrule)]));
const VENDORS: LedgerVendorRow[] = [
  { id: 'pv-lunch', routine_id: null, step_id: 'lunch-line', task_id: null, occurrence_at: new Date(at(THU, '12:00')), items: 'soup and bread', vendor: { id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: 'harbor.cafe' }, routine: null, step: { activity: 'Lunch', routine_id: 'lunch', routine: { name: 'Lunch · 2027-03-04 12:00', timezone: NBO } }, task: null },
  { id: 'pv-gym', routine_id: 'gym', step_id: null, task_id: null, occurrence_at: null, items: null, vendor: { id: 'v-iron', vendor_name: 'Iron Works', entity_id: 'P', instagram_tag: null }, routine: { name: 'Morning Gym', timezone: NBO }, step: null, task: null },
];
const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
const stop = (routineId: string, routineName: string, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId, routineName, zone: NBO, role: 'place', activity: null, timeOfDay: null, durationMinutes: null });
const RECORDS: LedgerRecordInput[] = [
  // Thursday's gym, recorded on its line.
  stop('gym', 'Morning Gym', record({ id: 'r-gym', kind: 'routine', target_id: 'gym', occurrence_at: at(THU, '07:00'), actual_cents: 2000 })),
  // A record of a plan the loader no longer lists — no line is joined to it.
  stop('kiosk', 'Kiosk', record({ id: 'r-kiosk', kind: 'routine', target_id: 'kiosk', occurrence_at: at(THU, '10:00'), actual_cents: 150 })),
  // Thursday's tea, recorded at a stop where two plan lines stand.
  stop('tea', 'Tea', record({ id: 'r-tea', kind: 'routine', target_id: 'tea', occurrence_at: at(THU, '16:00'), actual_cents: 300 })),
];
const built = buildRoutineBudgetLines(ROUTINES, THU, FRI);
const teaLines = built.lines.filter((l) => l.sourceId.startsWith('routine:tea:'));
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: THU, to: FRI, now: NOW, records: RECORDS, links: [], lines: [...built.lines, ...teaLines], open: [], notPlaced: built.notPlaced, routines: WORDS, roles: ROLES,
  locations: new Map(ROUTINES.map((r): [string, null] => [r.id, null])), once: ONCE, clocks: routineClocksOf(ROUTINES), subAccounts: [], minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: [],
  accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }], books: [{ id: 'P', entityType: 'personal' }], ...over,
});
const ledger = ledgerOf(input());
const rowOf = (description: string, day: string, recorded: boolean) => {
  const found = ledger.sheet.filter((r) => r.description === description && r.day === day && (r.id !== null) === recorded);
  if (found.length === 0) return assert.fail(`no ${recorded ? 'recorded' : 'plan'} row ${description} on ${day}`);
  return found;
};
const thrown = (run: () => unknown): string => { try { run(); } catch (error) { return error instanceof Error ? error.message : String(error); } return assert.fail('it did not throw'); };

// ── E1 · EACH ROUTINE'S ONE-OFF-NESS (ruling 1.1) ────────────────────────────

test('E1 the input’s `once`: each routine’s id → rruleHelpers.ts isOnceRRule over its rule — the answer builds it from the routines it already read, no query added; a routine a line is of that it does not hold is thrown by name', () => {
  assert.deepEqual([...ONCE], [['lunch', true], ['dinner', true], ['gym', false], ['tea', false]]);
  const a = code(ANSWER);
  assert.match(a, /import \{ instantToZoned \} from '@\/lib\/time'; import \{ isOnceRRule \} from '@\/lib\/operations\/rruleHelpers';/, 'imported on a line that stood — the two lines the registry cites below hold');
  assert.match(a, /locations: new Map\(roles\.map\(\(r\) => \[r\.id, locationClassOf\(r\.location_class, `routine \$\{r\.id\}`\)\]\)\),\n\s*subAccounts,\n\s*once: new Map\(routineInputs\.map\(\(r\): \[string, boolean\] => \[r\.id, isOnceRRule\(r\.scheduleRrule\)\]\)\),/);
  assert.equal((a.match(/\.findMany\(|\.findFirst\(/g) ?? []).length, 9, 'the nine reads as they were — none added');
  assert.match(thrown(() => ledgerOf(input({ once: new Map([...ONCE].filter(([id]) => id !== 'lunch')) }))), /^ledger: line line:lunch-line:\S+ is of routine lunch, whether it is a one-off was not read$/);
  assert.match(code(SHEET_RULES), /readonly once: ReadonlyMap<string, boolean>;/);
});

// ── E2 · ONE ENTRY A ROW (ruling 1.2) ────────────────────────────────────────

test('E2 `editing`: ONE entry for EVERY sheet row, by its key, in the sheet’s order — a row with its plan line names its routine, its line, whether it is a one-off, its name, its book and its vendor; a row with no plan line to change says why, in one sentence', () => {
  assert.deepEqual(Object.keys(ledger.editing), ledger.sheet.map((r) => r.key), 'one entry a row, in the sheet’s order');
  assert.deepEqual(Object.keys(ledger), ['from', 'to', 'rows', 'sheet', 'recording', 'editing', 'said'], '`editing` after `recording`');
  const entryOf = (description: string, day: string, recorded: boolean): LedgerEditing[] => rowOf(description, day, recorded).map((r) => ledger.editing[r.key]);
  // A one-off's plan row: its line, a one-off, its name, its book, the vendor planned at this occurrence.
  assert.deepEqual(entryOf('Lunch', THU, false), [{ plan: true, routineId: 'lunch', lineId: 'lunch-line', once: true, routineName: 'Lunch · 2027-03-04 12:00', entityId: 'P', vendor: { id: 'v-harbor', name: 'Harbor Cafe', every: false }, start: null, end: null, trip: null }]); // EDIT-02 (2026-11-28): and its routine's own clock and its day's trip — none here
  // A one-off with no vendor.
  assert.deepEqual(entryOf('Dinner', FRI, false), [{ plan: true, routineId: 'dinner', lineId: 'dinner-line', once: true, routineName: 'Dinner · 2027-03-05 19:00', entityId: 'P', vendor: null, start: null, end: null, trip: null }]);
  // A repeating plan's row: its own line (no line id), not a one-off, the vendor for every occurrence.
  const gym = { plan: true, routineId: 'gym', lineId: null, once: false, routineName: 'Morning Gym', entityId: 'P', vendor: { id: 'v-iron', name: 'Iron Works', every: true }, start: null, end: null, trip: null };
  assert.deepEqual(entryOf('Morning Gym', FRI, false), [gym]);
  // A recorded row joined to its line: that line's entry — the same as its plan row would carry.
  assert.deepEqual(entryOf('Morning Gym', THU, true), [gym]);
  // A recorded row joined to none.
  assert.deepEqual(entryOf('Kiosk', THU, true), [{ plan: false, words: NO_PLAN_LINE_WORDS, trip: null }]); // EDIT-02 (2026-11-28): the trip on both kinds of entry
  // Two plan lines at a stop: each plan row, and the record that stands there on its own row.
  assert.deepEqual(entryOf('Tea', FRI, false), [{ plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: null }, { plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: null }]);
  assert.deepEqual(entryOf('Tea', THU, false), [{ plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: null }, { plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: null }]);
  assert.deepEqual(entryOf('Tea', THU, true), [{ plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: null }]);
  // The words, typed whole; wire-shaped as built.
  assert.equal(NO_PLAN_LINE_WORDS, 'no plan line is joined to this record — it has no plan to change here');
  assert.equal(TWO_LINES_NO_PLAN_WORDS, "two plan lines stand at this stop — neither is this row's alone, so no plan is changed here");
  assert.deepEqual(JSON.parse(JSON.stringify(ledger.editing)), ledger.editing);
});

// ── E3 · WHERE IT IS BUILT (ruling 1.2) ──────────────────────────────────────

test('E3 in the source: `editing` is built where `recording` is — a recorded row’s entry beside its record’s, a plan row’s beside its own, the two lists in one loop with a missing entry thrown by name — and the line’s routine is its occurrence key’s, never guessed', () => {
  const rules = code(SHEET_RULES);
  assert.match(rules, /readonly recording: Readonly<Record<string, LedgerRecording>>;\n\s*readonly editing: Readonly<Record<string, LedgerEditing>>;\n\s*readonly said: LedgerSaid;/, 'Ledger: `editing` after `recording`');
  assert.match(rules, /const recordingAt = new Map<string, LedgerRecording>\(\);\n\s*const editingAt = new Map<string, LedgerEditing>\(\);/);
  assert.match(rules, /\n\s*\}\);\n\s*editingAt\.set\(key, line !== null \? editingOf\(line, key, stay\) : \{ plan: false, words: budgetState === 'doubled' \? TWO_LINES_NO_PLAN_WORDS : NO_PLAN_LINE_WORDS, trip: editingTripOf\(stay\) \}\);\n\s*return \{\n\s*id: r\.record\.id,/, 'a recorded row’s, after its `recording` entry');
  assert.match(rules, /vendor: \{ kind: 'box', line: l \} \}\);\n\s*editingAt\.set\(row\.key, lines > 1 \? \{ plan: false, words: TWO_LINES_NO_PLAN_WORDS, trip: editingTripOf\(stay\) \} : editingOf\(l, key, stay\)\);\n\s*sheeted\.push\(\{ row, label: l\.label, line: l\.line \}\);/, 'a plan row’s, after its own');
  assert.match(rules, /recording\[row\.key\] = entry;\n\s*const can = editingAt\.get\(row\.key\);\n\s*if \(can === undefined\) throw new Error\(`ledger: sheet row \$\{row\.key\} has no entry in editing — every row of the sheet has one`\);\n\s*editing\[row\.key\] = can;/);
  assert.match(rules, /const routineId = kind === 'routine' \? id : routineOfLine\.get\(id\);/, 'the line’s routine: its own on a routine’s own line, else the routine whose active lines hold it — the key’s');
  assert.match(rules, /lineId: kind === 'routine_line' \? id : null, once, routineName: routine\.name, entityId: l\.entityId, vendor: l\.vendor === null \? null : \{ id: l\.vendor\.id, name: l\.vendor\.name, every: l\.vendor\.grain === 'every' \}/);
  assert.equal((rules.match(/\breadOccurrenceKey\(/g) ?? []).length, 1, 'the one reader of an occurrence’s key, still called once');
  assert.match(thrown(() => ledgerOf(input({ routines: new Map([...WORDS].filter(([id]) => id !== 'dinner')) }))), /^ledger: plan-line-unreadable — budget line routine:dinner:line:dinner-line:\S+ names routine dinner, which the loader did not read$/, 'the Budget’s own refusal comes first');
});

// ── E4 · THE READ (ruling 1.2) ───────────────────────────────────────────────

test('E4 the read carries `editing` as it carries `recording` — an answer without it, or whose `editing` lacks a sheet row’s key, is a failure in words, never a guess', async () => {
  const reads = code(READS);
  assert.match(reads, /readonly recording: Readonly<Record<string, LedgerRecording>>; readonly editing: Readonly<Record<string, LedgerEditing>>;/, 'on the recording’s line — the read the registry cites does not move');
  assert.match(reads, /if \(typeof editing !== 'object' \|\| editing === null \|\| Array\.isArray\(editing\)\) return \{ ok: false, words: ledgerFailedWords\('the ledger came back without its editing'\) \};/);
  assert.equal((reads.match(/readJson\(/g) ?? []).length, 1, 'still one read');
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const answers = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const whole = { from: THU, to: FRI, as_of: NOW.toISOString(), first_record: { day: THU }, rows: ledger.rows, sheet: ledger.sheet, tones: {}, recording: ledger.recording, editing: ledger.editing, said: ledger.said };
  try {
    g.fetch = answers(whole);
    const ok = await readLedger(THU, FRI);
    assert.equal(ok.ok, true);
    if (ok.ok) assert.deepEqual(ok.value.editing, ledger.editing, 'as the rule built it, through the wire');
    const { editing: _gone, ...without } = whole;
    void _gone;
    g.fetch = answers(without);
    assert.deepEqual(await readLedger(THU, FRI), { ok: false, words: ledgerFailedWords('the ledger came back without its editing') });
    g.fetch = answers({ ...whole, editing: [] });
    assert.deepEqual(await readLedger(THU, FRI), { ok: false, words: ledgerFailedWords('the ledger came back without its editing') });
    const lacking = { ...ledger.editing };
    const first = ledger.sheet[0].key;
    delete lacking[first];
    g.fetch = answers({ ...whole, editing: lacking });
    assert.deepEqual(await readLedger(THU, FRI), { ok: false, words: ledgerFailedWords(`the ledger came back with no editing for the row ${JSON.stringify(first)}`) });
  } finally {
    g.fetch = real;
  }
});

// ── PART 2 — THE CELL OPENS; THE RECORD'S CELLS ──────────────────────────────

const takenOf = (row: LedgerSheetRow): LedgerRecordingTaken => { const e = ledger.recording[row.key]; if (!e.takes) return assert.fail(`${row.key} takes no record`); return e; };
const opensWhich = (row: LedgerSheetRow): TypedColumn[] => TYPED_COLUMNS.filter((c) => cellOpens(c, row, ledger.recording[row.key], ledger.editing[row.key]).refusal === null); // PART 3: by the row's `editing` entry too; EDIT-02 (2026-11-28): every typed cell opens — these are the ones whose save is not refused before any typing
const drawBox = (props: Parameters<typeof ColumnBox>[0]): string => renderToStaticMarkup(createElement(ColumnBox, props));
const noop = () => undefined;

// ── E5 · THE ONE BOX OF A COLUMN (ruling 2.1) ────────────────────────────────

test('E5 the box is ONE renderer — ColumnBox — drawn by the blank row under every column he types and by a cell of the sheet when it opens: one set of words, one data attribute per column; WENT a choice; the blank row draws nothing of its own', () => {
  const f = code(FORM);
  // The blank row: every box is ColumnBox's — handed its draft's box; no input or select of its own but TRIP ENDS.
  assert.deepEqual([...f.matchAll(/<ColumnBox column="(\w+)"/g)].map((m) => m[1]), ['date', 'start', 'end', 'city', 'region', 'country', 'location', 'accountName', 'book', 'subAccountName', 'description', 'vendor', 'instagramTag', 'stars', 'loggedMinutes', 'budget', 'actual', 'notes']);
  assert.equal((f.match(/<input\b/g) ?? []).length, 1, 'TRIP ENDS alone — its box is the trip line’s, under the row');
  assert.equal((f.match(/<select\b|<CoaSelect\b/g) ?? []).length, 0);
  assert.ok(f.includes('<ColumnBox column="vendor" value={vendorTyped} onChange={setVendorTyped} vendors={vendors} listId="ledger-expense-vendors" />'));
  assert.ok(f.includes('<ColumnBox column="date" value={draft.day} onChange={setDay} />'), 'TRIP ENDS still follows DATE');
  assert.match(comments(FORM), /EDIT-01 \(Alex, 2026-11-28\): the boxes' two classes stood here; they went with the boxes to ColumnBox\.tsx/);
  // A cell of the sheet: the same box, handed the open cell's text, its keys, its leaving and its focus.
  assert.ok(code(SECTION).includes('<ColumnBox column={column} value={text} onChange={typeInCell} {...listsOf(row, column)} onKeyDown={(e) => keyOf(e, row, column)} onBlur={() => void commit()} autoFocus />'), 'PART 3: with what it lists');
  // One renderer: the same box in either place — the cell's adds only its focus (keys and leaving are handlers, drawn by no attribute).
  const plain = drawBox({ column: 'stars', value: '4', onChange: noop });
  assert.equal(plain, '<input type="text" inputMode="numeric" maxLength="1" aria-label="STARS" class="w-full min-w-[3.5rem] px-1 py-0.5 border border-border rounded text-xs bg-white" data-ledger-expense-box="stars" value="4"/>');
  assert.equal(drawBox({ column: 'stars', value: '4', onChange: noop, onKeyDown: noop, onBlur: noop, autoFocus: true }), plain.replace(' value="4"/>', ' autofocus="" value="4"/>'));
  // WENT — the sheet's alone: went · skipped · none (no record).
  assert.equal(drawBox({ column: 'went', value: '', onChange: noop }), '<select aria-label="WENT" class="w-full min-w-[3.5rem] px-1 py-0.5 border border-border rounded text-xs bg-white" data-ledger-expense-box="went"><option value="went">went</option><option value="skipped">skipped</option><option value="" selected="">none</option></select>');
  assert.equal(CELL_WENT_NONE_WORDS, 'none');
  // A box that lists something is handed it — never drawn on a guess.
  assert.throws(() => drawBox({ column: 'accountName', value: '', onChange: noop }), /^Error: ColumnBox: CATEGORY lists a book’s chart — no book was handed in$/);
  assert.throws(() => drawBox({ column: 'vendor', value: '', onChange: noop }), /^Error: ColumnBox: VENDOR lists the book’s vendors — none were handed in$/);
  assert.throws(() => drawBox({ column: 'book', value: '', onChange: noop, books: [] }), /^Error: ColumnBox: ENTITY lists the books — none were handed in$/);
  assert.doesNotMatch(code(BOX), /\bfetch\s*\(|localStorage|sessionStorage|document\.cookie|indexedDB/, 'the box reads, writes and stores nothing');
});

// ── E6 · THE FRAME (ruling 2.2) ──────────────────────────────────────────────

test('E6 the frame: the open cell is React state — one at a time — opened on a click where its row’s entries allow; Enter saves, Tab saves then opens the next cell that opens, Esc puts it back, leaving saves only a change; the line beneath names the column, its reach and the keys; nothing is stored', () => {
  const s = code(SECTION);
  assert.match(s, /const editing: Readonly<Record<string, LedgerEditing>> = answer !== null && answer\.read\.ok \? answer\.read\.value\.editing : \{\};/, '`editing` read from the answer');
  assert.match(s, /const \{ open, clearing, cellRefusal, setOpenCell, titleOf, clickCell, boxIn, clearCell, asking, questionOf, askDelete, keepRow, deleteAsked \} = useCellFrame\(rows, recording, editing, \(day\) => \{ setWrites\(\(n\) => n \+ 1\); announceDayWritten\(day\); \}\);/, 'an accepted save reads the span again and announces the day');
  const frame = s.slice(s.indexOf('function useCellFrame('));
  assert.match(frame, /const \[open, setOpen\] = useState<OpenCell \| null>\(null\);/, 'ONE open cell: its row’s key and its column, or none');
  assert.match(s, /type OpenCell = \{ readonly key: string; readonly column: TypedColumn \};/);
  // A click opens a typed cell where the rule allows — the open one saved first; a chip in the cell and the box keep their clicks.
  assert.match(frame, /const openCell = async \(row: LedgerSheetRow, column: TypedColumn\) => \{\n\s*const at = openRef\.current;\n\s*if \(at !== null && at\.key === row\.key && at\.column === column\) return;\n\s*if \(at !== null && !\(await commit\(\)\)\) return;\n\s*setOpenCell\(\{ key: row\.key, column \}, boxTextOf\(row, column, editing\[row\.key\]\), refusalOf\(row, column\)\);/); // EDIT-02 (2026-11-28): every typed cell opens — with the refusal the rule knows before any typing
  assert.match(frame, /if \(\(e\.target as HTMLElement\)\.closest\('button, input, select, a'\) !== null\) return;/);
  // The keys.
  assert.match(frame, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); setOpenCell\(null\); return; \}/, 'Esc: closed, nothing written');
  assert.match(frame, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); void commit\(\); return; \}/);
  assert.match(frame, /if \(e\.key === 'Tab' && !e\.shiftKey\) \{\n\s*e\.preventDefault\(\);\n\s*const next = nextOpeningColumn\(column\);\n\s*void commit\(\)\.then\(\(closed\) => \{ if \(closed && next !== null\) setOpenCell\(\{ key: row\.key, column: next \}, boxTextOf\(row, next, editing\[row\.key\]\), refusalOf\(row, next\)\); \}\);/); // EDIT-02 (2026-11-28): the next typed cell — every one opens
  // Leaving saves only a change: an unchanged text closes, nothing sent; a refused text is not sent again until it changes; one save at a time.
  assert.match(frame, /if \(row === undefined \|\| textRef\.current === heldRef\.current\) \{ setOpenCell\(null\); return Promise\.resolve\(true\); \}/);
  assert.match(frame, /if \(refusedRef\.current === typed\) return Promise\.resolve\(false\);/);
  assert.match(frame, /if \(savingRef\.current !== null\) return savingRef\.current;/);
  assert.match(frame, /if \(!saved\.ok\) \{ refusedRef\.current = typed; setCellRefusal\(saved\.words\); return false; \}\n\s*setOpenCell\(null\);\n\s*written\(row\.day\);/, 'refused: the words, the box open with the text; accepted: closed, and the day told');
  // Tab's next cell — the next one to the right on the row that opens.
  const recorded = rowOf('Morning Gym', THU, true)[0];
  assert.deepEqual(opensWhich(recorded), TYPED_COLUMNS.filter((c) => c !== 'date'), 'EDIT-02 (2026-11-28): every cell of a repeating plan’s recorded row saves but DATE (its days are how it repeats)'); assert.deepEqual(['description', 'vendor', 'instagramTag', 'went', 'stars', 'loggedMinutes', 'actual', 'notes'].filter((c) => !opensWhich(recorded).includes(c as TypedColumn)), [], 'a held record: ITEMS is its note; PART 3: its plan repeats — VENDOR and its tag open, the plan’s own cells do not');
  assert.equal(nextOpeningColumn('went'), 'stars'); // EDIT-02 (2026-11-28): every typed cell opens — Tab goes to the next typed column
  assert.equal(nextOpeningColumn('actual'), 'notes');
  assert.equal(nextOpeningColumn('notes'), null, 'none to the right: it closes');
  // The line beneath: the column's head word, its reach, the keys — and the refusal in red; WENT none asks first.
  assert.match(s, /<tr className="border-t border-border" data-ledger-cell-said=\{row\.key\}>\n\s*<td colSpan=\{LEDGER_COLUMNS\.length\} className=\{cell\}>/);
  assert.ok(s.includes('<span className="font-semibold text-text-primary" data-ledger-cell-head>{headWordOf(open.column)}</span><span data-ledger-cell-reach>{cellReachWords(open.column, editing[row.key])}</span><span className="text-text-muted" data-ledger-cell-keys>{CELL_KEYS_WORDS}</span>'));
  assert.ok(s.includes('{cellRefusal !== null && <span className="text-brand-red" data-ledger-cell-refused>{cellRefusal}</span>}'));
  assert.equal(CELL_REACH_WORDS, 'this row');
  assert.equal(CELL_KEYS_WORDS, 'Enter saves · Tab saves and opens the next cell · Esc puts it back');
  assert.equal(cellReachWords('stars', ledger.editing[recorded.key]), 'this row');
  const lunch = rowOf('Lunch', THU, false)[0];
  assert.equal(cellReachWords('instagramTag', ledger.editing[lunch.key]), 'the tag of Harbor Cafe — every row with Harbor Cafe');
  assert.equal(tagReachWords('Harbor Cafe'), 'the tag of Harbor Cafe — every row with Harbor Cafe');
  assert.equal(cellReachWords('instagramTag', ledger.editing[rowOf('Dinner', FRI, false)[0].key]), 'this row', 'EDIT-02 (2026-11-28): a tag with no vendor opens and saves nothing (its line says why) — it reaches this row; thrown by name until then, when no such cell opened');
  assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie|indexedDB|window\.confirm|confirm\(/, 'nothing stored in the browser; no browser pop-up');
});

// ── E7 · THE RECORD'S CELLS (ruling 2.3) ─────────────────────────────────────

test('E7 the record’s cells — WENT, STARS, LOGGED MIN, ACTUAL, NOTES, and ITEMS on a held record — open on a row that takes a record and go through the record form’s own rule and writer: rowDraftOf with the one box replaced, recordInput, setStopRecord; WENT none is a clear, asked first; a row that takes none says why', async () => {
  assert.deepEqual([...RECORD_CELLS], ['went', 'stars', 'loggedMinutes', 'actual', 'notes']);
  const recorded = rowOf('Morning Gym', THU, true)[0];
  const lunch = rowOf('Lunch', THU, false)[0];
  const dinner = rowOf('Dinner', FRI, false)[0];
  const teaRow = rowOf('Tea', FRI, false)[0];
  // Which are the record's, and open, by the row's entry in `recording`.
  assert.deepEqual(TYPED_COLUMNS.filter((c) => isRecordCell(c, ledger.recording[lunch.key])), [...RECORD_CELLS], 'a plan row with no record: ITEMS is its planned items — not a record cell');
  assert.deepEqual(TYPED_COLUMNS.filter((c) => isRecordCell(c, ledger.recording[recorded.key])), ['description', ...RECORD_CELLS], 'a held record: ITEMS is its note');
  assert.deepEqual(opensWhich(lunch).filter((c) => isRecordCell(c, ledger.recording[lunch.key])), [...RECORD_CELLS]);
  assert.deepEqual(opensWhich(teaRow), ['city', 'region', 'country'], 'a row that takes no record, with no plan: only the trip’s cells save — EDIT-02 (2026-11-28): none until then (they did not open)');
  const why = ledger.recording[teaRow.key];
  assert.ok(!why.takes);
  for (const c of RECORD_CELLS) assert.deepEqual(cellOpens(c, teaRow, why, ledger.editing[teaRow.key]), { refusal: why.words }, `${c}: the entry’s own sentence — EDIT-02 (2026-11-28): said as the cell opens`);
  // The text each box opens with.
  assert.deepEqual(['went', 'stars', 'loggedMinutes', 'actual', 'notes', 'description'].map((c) => boxTextOf(recorded, c as TypedColumn, ledger.editing[recorded.key])), ['went', '', '', '20.00', '', '']); // EDIT-02 (2026-11-28): the box's text reads the row's entry (ENTITY's is its plan's book)
  assert.deepEqual(['went', 'actual', 'description'].map((c) => boxTextOf(lunch, c as TypedColumn, ledger.editing[lunch.key])), ['', '', 'soup and bread']);
  // The draft: the record form's own, the one box replaced.
  assert.deepEqual(recordCellDraft(recorded, takenOf(recorded).held, 'stars', '4'), { ...rowDraftOf(recorded, takenOf(recorded).held), stars: '4' });
  assert.deepEqual(recordCellDraft(lunch, null, 'actual', '7.50'), { went: 'went', actual: '7.50', stars: '', minutes: '', note: 'soup and bread', notes: '' }, 'a first record, as the form writes one — ITEMS holding what was planned');
  assert.deepEqual(recordCellDraft(recorded, takenOf(recorded).held, 'went', 'skipped').went, 'skipped');
  assert.deepEqual(recordCellDraft(recorded, takenOf(recorded).held, 'description', 'two sets').note, 'two sets');
  assert.throws(() => recordCellDraft(recorded, takenOf(recorded).held, 'went', ''), /WENT is went or skipped in a record's draft — "" is a clear, asked first/);
  // The rule's refusals stand, in its words — a bad value, a stop ahead.
  const ruled = (row: LedgerSheetRow, column: TypedColumn, text: string) => recordInput(recordCellDraft(row, takenOf(row).held, column, text), row.address, takenOf(row), NOW);
  assert.deepEqual(ruled(recorded, 'stars', '9'), { ok: false, field: 'stars', message: starsTypedWords('9') });
  assert.deepEqual(ruled(dinner, 'actual', '25'), { ok: false, field: 'went', message: STOP_AHEAD_WORDS });
  // Through the one writer — the stops POST with the rule's body; WENT none through its clear.
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const sent: { url: string; method: string; body: unknown }[] = [];
  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  try {
    g.fetch = async (url: string, init: RequestInit) => { sent.push({ url, method: init.method ?? 'GET', body: init.body === undefined ? null : JSON.parse(String(init.body)) }); return answer(201, { record: {}, changed: true }); };
    assert.deepEqual(await saveRecordCell(lunch, takenOf(lunch), 'actual', '7.50', NOW), { ok: true });
    assert.deepEqual([...sent], [{ url: '/api/operations/stops', method: 'POST', body: { kind: 'routine_line', id: 'lunch-line', instant: lunch.address.instant, outcome: 'done', done_at: takenOf(lunch).plannedAt, actual_cents: 750, rating: null, note: 'soup and bread', notes: null, actual_minutes: null } }]);
    sent.length = 0;
    assert.deepEqual(await saveRecordCell(recorded, takenOf(recorded), 'stars', '9', NOW), { ok: false, words: starsTypedWords('9') });
    assert.equal(sent.length, 0, 'refused by the rule: nothing sent');
    g.fetch = async () => answer(400, { error: 'Validation', field: 'instant', message: 'the route’s own words' });
    assert.deepEqual(await saveRecordCell(recorded, takenOf(recorded), 'stars', '4', NOW), { ok: false, words: 'the route’s own words' });
    g.fetch = async () => { throw new Error('offline'); };
    assert.deepEqual(await saveRecordCell(recorded, takenOf(recorded), 'stars', '4', NOW), { ok: false, words: 'offline' }, 'a request that never reached the route: its words');
    g.fetch = async (url: string, init: RequestInit) => { sent.push({ url, method: init.method ?? 'GET', body: null }); return answer(200, { deleted: true }); };
    const held = takenOf(recorded).held;
    if (held === null) return assert.fail('the recorded row holds its record');
    assert.deepEqual(await clearRecordCell(held), { ok: true });
    assert.deepEqual([...sent], [{ url: '/api/operations/stops/r-gym', method: 'DELETE', body: null }]);
  } finally {
    g.fetch = real;
  }
  // In the source: the leaf goes through the rule and the one writer; the frame asks before a clear.
  const saves = code(SAVES);
  assert.match(saves, /read = recordInput\(recordCellDraft\(row, entry\.held, column, text\), row\.address, entry, now\);/);
  assert.match(saves, /const answer = await setStopRecord\(read\.body\);/);
  assert.match(saves, /const answer = await clearStopRecord\(held\.id\);/);
  assert.doesNotMatch(saves, /\bfetch\s*\(|\/api\//, 'no request of its own');
  const s = code(SECTION);
  assert.match(s, /if \(at\.column === 'went' && typed === ''\) \{ setClearing\(true\); return Promise\.resolve\(false\); \}/, 'WENT none: asked, nothing written');
  assert.ok(s.includes('{clearing && <><span className="text-brand-red" data-ledger-cell-clear>{CLEAR_CELL_QUESTION}</span><button type="button" className={chip} onClick={() => void clearCell(row)} data-ledger-cell-clear-yes>{CLEAR_RECORD_WORDS}</button><button type="button" className={chip} onClick={() => setOpenCell(null)} data-ledger-cell-keep>{KEEP_WORDS}</button></>}'));
  assert.match(s, /const cleared = await clearRecordCell\(entry\.held\);/);
  assert.equal(CLEAR_CELL_QUESTION, "clear this row's record?");
  assert.equal(KEEP_WORDS, 'keep');
});

// ── E8 · CELLS THAT NEVER OPEN (rulings 2.2, 2.3) ────────────────────────────

test('E8 (re-pointed by EDIT-02 (2026-11-28) — nineteen columns he types and six that never open; fourteen and eleven until then) the columns he types, in the sheet’s order; the ones that never open each say why on hover; every cell of the sheet carries a title, and a typed one its click and its box', () => {
  assert.deepEqual([...TYPED_COLUMNS], ['date', 'start', 'end', 'city', 'region', 'country', 'location', 'accountName', 'book', 'subAccountName', 'description', 'vendor', 'instagramTag', 'went', 'stars', 'loggedMinutes', 'budget', 'actual', 'notes']); // EDIT-02 (2026-11-28): DATE, CITY, REGION, COUNTRY and ENTITY joined
  assert.deepEqual(LEDGER_COLUMNS.filter((c) => isTypedColumn(c)), [...TYPED_COLUMNS], 'in the sheet’s order');
  assert.deepEqual(NEVER_OPENS_WORDS, {
    day: 'worked out from DATE', // EDIT-02 (2026-11-28): the six alone — DATE, CITY, REGION, COUNTRY and ENTITY open
    plannedMinutes: 'worked out from START and END',
    account: 'worked out from the codes of LOCATION, CATEGORY, ENTITY and TYPE',
    variance: 'worked out — ACTUAL less BUDGET',
    match: 'the postings linked in Books — changed by its "link"',
    underOver: 'worked out from the sign of VARIANCE',
  });
  assert.deepEqual(LEDGER_COLUMNS.filter((c) => !isTypedColumn(c)), Object.keys(NEVER_OPENS_WORDS), 'the six, in the sheet’s order');
  const s = code(SECTION);
  const row = s.slice(s.indexOf('data-ledger-row={row.key}'), s.indexOf('{open !== null && open.key === row.key && ('));
  assert.deepEqual([...row.matchAll(/ title=\{titleOf\(row, '(\w+)'/g)].map((m) => m[1]), [...LEDGER_COLUMNS], 'every cell titled, in the sheet’s order');
  assert.deepEqual([...row.matchAll(/onClick=\{\(e\) => clickCell\(e, row, '(\w+)'\)\}/g)].map((m) => m[1]), [...TYPED_COLUMNS], 'a typed cell’s click — and no other cell’s');
  assert.deepEqual([...row.matchAll(/\{boxIn\(row, '(\w+)'\) \?\? /g)].map((m) => m[1]), [...TYPED_COLUMNS], 'a typed cell’s box, else what it printed');
  assert.match(s, /if \(!isTypedColumn\(column\)\) return own === undefined \? NEVER_OPENS_WORDS\[column\] : `\$\{own\} — \$\{NEVER_OPENS_WORDS\[column\]\}`;/, 'MATCH says its postings first, then why');
  assert.match(s, /if \(ruled === null\) return own;\n\s*return own === undefined \? ruled : `\$\{own\} — \$\{ruled\}`;/, 'PART 3: a typed cell that does not open says why — after its own title, as MATCH does; EDIT-02 (2026-11-28): a typed cell whose save is refused before any typing');
});

// ── PART 3 — A ONE-OFF'S PLAN CELLS, THE VENDOR, ITS TAG AND ITS ITEMS ───────

const planOf = (row: LedgerSheetRow): LedgerEditingPlan => { const e = ledger.editing[row.key]; if (!e.plan) return assert.fail(`${row.key} has no plan`); return e; };
type Sent = { readonly url: string; readonly method: string; readonly body: unknown };
/** A stand-in fetch: every request recorded, each answered in turn from the queue handed in — and every answer queued is asked for. */
async function standIn<T>(queue: readonly (readonly [number, unknown])[], run: () => Promise<T>): Promise<{ readonly result: T; readonly sent: readonly Sent[] }> {
  const g = globalThis as unknown as { fetch: unknown };
  const real = g.fetch;
  const sent: Sent[] = [];
  const left = [...queue];
  g.fetch = async (url: string, init?: RequestInit) => {
    sent.push({ url, method: init?.method ?? 'GET', body: init?.body === undefined ? null : JSON.parse(String(init.body)) });
    const next = left.shift();
    if (next === undefined) throw new Error(`no answer queued for ${url}`);
    return new Response(JSON.stringify(next[1]), { status: next[0], headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await run();
    assert.equal(left.length, 0, 'every queued answer was asked for');
    return { result, sent };
  } finally {
    g.fetch = real;
  }
}
const OK: readonly [number, unknown] = [200, {}];

// ── E9 · WHICH OPEN, AND WHY NOT (rulings 3.1, 3.2) ──────────────────────────

test('E9 (re-pointed by EDIT-02 (2026-11-28) — every typed cell opens on every row; until then the plan’s own cells opened on a one-off alone, and a cell that could not save did not open) a one-off’s cells all save; a repeating plan’s own cells save, its DATE alone refused; INSTAGRAM TAG and ITEMS ask for a vendor where they need one; a row with no plan says why its plan’s cells, VENDOR, TAG, ENTITY and DATE save nothing; the trip’s cells save on every row', () => {
  assert.deepEqual([...PLAN_CELLS], ['start', 'end', 'location', 'accountName', 'subAccountName', 'budget']);
  assert.deepEqual([...LINE_CELLS], ['end', 'accountName', 'subAccountName', 'budget']);
  const lunch = rowOf('Lunch', THU, false)[0];
  const dinner = rowOf('Dinner', FRI, false)[0];
  const gymFri = rowOf('Morning Gym', FRI, false)[0];
  const gymThu = rowOf('Morning Gym', THU, true)[0];
  const kiosk = rowOf('Kiosk', THU, true)[0];
  const teaRows = [...rowOf('Tea', THU, true), ...rowOf('Tea', THU, false), ...rowOf('Tea', FRI, false)];
  const closedOf = (row: LedgerSheetRow): Record<string, string> => Object.fromEntries(TYPED_COLUMNS.flatMap((c) => { const refusal = cellOpens(c, row, ledger.recording[row.key], ledger.editing[row.key]).refusal; return refusal === null ? [] : [[c, refusal]]; }));
  // A one-off with its vendor — every cell he types saves.
  assert.deepEqual(opensWhich(lunch), [...TYPED_COLUMNS]);
  // A one-off with no vendor, ahead: its tag and its planned items ask for one.
  assert.deepEqual(closedOf(dinner), { description: ITEMS_CELL_NO_VENDOR_WORDS, instagramTag: TAG_NEEDS_VENDOR_WORDS });
  // A day of a repeating plan — its row with no record, and its recorded row: every cell saves (its own reach every row of the plan) but DATE.
  for (const row of [gymFri, gymThu]) assert.deepEqual(closedOf(row), { date: REPEATING_DATE_WORDS('Morning Gym') }, `${row.key}: DATE alone`);
  assert.ok(opensWhich(gymFri).includes('description'), 'ITEMS on a row with no record, ahead: the planned items, with its vendor');
  // A row with no plan: its plan's cells, VENDOR, TAG, ENTITY and DATE say the entry's own sentence; its record's cells by its record; the trip's save.
  assert.deepEqual(closedOf(kiosk), Object.fromEntries(['date', ...PLAN_CELLS, 'book', 'vendor', 'instagramTag'].map((c) => [c, NO_PLAN_LINE_WORDS])));
  for (const row of teaRows) for (const c of ['date', ...PLAN_CELLS, 'book', 'vendor', 'instagramTag'] as const) assert.deepEqual(cellOpens(c, row, ledger.recording[row.key], ledger.editing[row.key]), { refusal: TWO_LINES_NO_PLAN_WORDS }, `${row.key} ${c}`);
  // A one-off with no line of its own — its routine's own line: every cell saves (its line's four write the routine's own fields).
  const noLine = { ...planOf(lunch), lineId: null };
  assert.deepEqual(TYPED_COLUMNS.filter((c) => cellOpens(c, lunch, ledger.recording[lunch.key], noLine).refusal !== null), []);
  assert.deepEqual([...LINE_CELLS], ['end', 'accountName', 'subAccountName', 'budget']);
  // The words, typed whole.
  assert.equal(CHARGE_HAS_RECORD_WORDS, "a charge takes no record — clear this row's record first, then its START");
  assert.equal(ITEMS_CELL_NO_VENDOR_WORDS, "planned items sit with the stop's vendor — give it a VENDOR first");
  assert.equal(TAG_NEEDS_VENDOR_WORDS, "an INSTAGRAM TAG is the vendor's — pick a VENDOR or name a new one");
  assert.equal(RECORD_ON_OWN_ROW_WORDS, "this stop's record is on its own row — it could not be joined to one plan line");
  // In the source: the frame asks the rule with the row and both entries; a cell refused before any typing says why after its own title.
  const s = code(SECTION);
  assert.match(s, /const refusalOf = \(row: LedgerSheetRow, column: TypedColumn\): string \| null => cellOpens\(column, row, recording\[row\.key\], editing\[row\.key\]\)\.refusal;/);
  assert.match(s, /if \(ruled === null\) return own;\n\s*return own === undefined \? ruled : `\$\{own\} — \$\{ruled\}`;/);
});

// ── E10 · THE PLAN'S CELLS — EACH WRITER AND ITS BODY (ruling 3.1) ───────────

test('E10 each plan cell’s writer and its body: START (the clock and the one-off’s name; a charge becomes a place; cleared, a charge — refused while the row holds a record), END (its minutes, cleared, refused), LOCATION, CATEGORY, TYPE (the name first; refused there, nothing written; the line refused, the name put back), BUDGET', async () => {
  const lunch = rowOf('Lunch', THU, false)[0];
  const dinner = rowOf('Dinner', FRI, false)[0] as LedgerPlanRow;
  const gymThu = rowOf('Morning Gym', THU, true)[0];
  const L = planOf(lunch);
  const D = planOf(dinner);
  const write = (row: LedgerSheetRow, e: LedgerEditingPlan, c: TypedColumn, text: string) => planCellWrite(row, e, c, text);
  // START — the routine's start time and the name with that clock.
  assert.deepEqual(write(lunch, L, 'start', '13:30'), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { start_time: '13:30', name: 'Lunch · 2027-03-04 13:30' } } });
  // …typed on a charge (START "all day"): role place.
  const charge: LedgerPlanRow = { ...dinner, allDay: true, time: null, went: null };
  assert.deepEqual(write(charge, D, 'start', '09:15'), { ok: true, write: { to: 'routine', routineId: 'dinner', body: { role: 'place', start_time: '09:15', name: 'Dinner · 2027-03-05 09:15' } } });
  // …cleared on a timed row: role all day, the name of a charge — refused first when the row holds a record.
  assert.deepEqual(write(lunch, L, 'start', ''), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { role: 'all_day', name: 'Lunch · 2027-03-04' } } });
  assert.deepEqual(write(gymThu, L, 'start', '  '), { ok: false, words: CHARGE_HAS_RECORD_WORDS });
  assert.deepEqual(write(lunch, L, 'start', '25:00'), { ok: false, words: timeTypedWords('25:00') });
  // END — the minutes from START; cleared, the line's minutes cleared; with no START, or at START, refused.
  assert.deepEqual(write(lunch, L, 'end', '13:15'), { ok: true, write: { to: 'minutes', lineId: 'lunch-line', minutes: 75 } });
  assert.deepEqual(write(lunch, L, 'end', '00:30'), { ok: true, write: { to: 'minutes', lineId: 'lunch-line', minutes: 750 } }, 'across midnight');
  assert.deepEqual(write(lunch, L, 'end', ''), { ok: true, write: { to: 'line', lineId: 'lunch-line', body: { duration_minutes: null } } });
  assert.deepEqual(write(charge, D, 'end', '10:00'), { ok: false, words: END_NEEDS_START_WORDS });
  assert.deepEqual(write(lunch, L, 'end', '12:00'), { ok: false, words: END_AT_START_WORDS });
  assert.deepEqual(write(lunch, L, 'end', 'noon'), { ok: false, words: timeTypedWords('noon') });
  // LOCATION, CATEGORY, BUDGET — as the box holds them; the route reads them.
  assert.deepEqual(write(lunch, L, 'location', 'travel'), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { location_class: 'travel' } } });
  assert.deepEqual(write(lunch, L, 'accountName', '6200'), { ok: true, write: { to: 'line', lineId: 'lunch-line', body: { coa_code: '6200' } } });
  assert.deepEqual(write(lunch, L, 'budget', '18.50'), { ok: true, write: { to: 'line', lineId: 'lunch-line', body: { budget_amount: '18.50' } } });
  assert.deepEqual(write(lunch, L, 'budget', ''), { ok: true, write: { to: 'line', lineId: 'lunch-line', body: { budget_amount: '' } } }, 'blank names no amount');
  // TYPE — trimmed, its spaces one; the name with it, the line's TYPE, and the name it held; blank or too long refused in the blank row's words.
  assert.deepEqual(write(lunch, L, 'subAccountName', '  Late   lunch '), { ok: true, write: { to: 'type', routineId: 'lunch', name: 'Late lunch · 2027-03-04 12:00', lineId: 'lunch-line', activity: 'Late lunch', nameBack: 'Lunch · 2027-03-04 12:00' } });
  assert.deepEqual(write(lunch, L, 'subAccountName', '   '), { ok: false, words: requiredWords('name') });
  assert.deepEqual(write(lunch, L, 'subAccountName', 'x'.repeat(ONE_OFF_NAME_MAX + 1)), { ok: false, words: NAME_LONG_WORDS });
  // No such cell opens: thrown by name.
  assert.throws(() => write(lunch, { ...L, lineId: null }, 'budget', '5'), /^Error: ledger: BUDGET of a routine with no line of its own is not written yet — the row line:lunch-line:\S+$/); // EDIT-02 (2026-11-28): such a cell opens now; its write is PART 2's
  assert.throws(() => write(lunch, L, 'stars', '4'), /^Error: ledger: STARS is no plan cell/);
  // Through the writers: each request, its method and its body.
  const routes = { routine: '/api/operations/routines/lunch', line: '/api/operations/routines/steps/lunch-line' };
  let run = await standIn([OK], () => savePlanCell(lunch, L, 'start', '13:30'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: routes.routine, method: 'PATCH', body: { start_time: '13:30', name: 'Lunch · 2027-03-04 13:30' } }]);
  run = await standIn([[409, { error: 'Conflict', field: 'start_time', message: 'the route’s refusal of the move' }]], () => savePlanCell(lunch, L, 'start', '13:30'));
  assert.deepEqual(run.result, { ok: false, words: 'the route’s refusal of the move' }, 'the route refuses by name');
  run = await standIn([], () => savePlanCell(gymThu, L, 'start', ''));
  assert.deepEqual([run.result, run.sent.length], [{ ok: false, words: CHARGE_HAS_RECORD_WORDS }, 0], 'refused before any write');
  run = await standIn([OK], () => savePlanCell(lunch, L, 'end', '13:15'));
  assert.deepEqual(run.sent, [{ url: routes.line, method: 'PATCH', body: { duration_minutes: 75 } }]);
  run = await standIn([OK], () => savePlanCell(lunch, L, 'end', ''));
  assert.deepEqual(run.sent, [{ url: routes.line, method: 'PATCH', body: { duration_minutes: null } }]);
  run = await standIn([OK], () => savePlanCell(lunch, L, 'location', ''));
  assert.deepEqual(run.sent, [{ url: routes.routine, method: 'PATCH', body: { location_class: '' } }], 'none — read by the route as none');
  run = await standIn([[400, { error: 'Validation', field: 'coa_code', message: 'P-9999 is not an account in the book’s chart' }]], () => savePlanCell(lunch, L, 'accountName', '9999'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: false, words: 'P-9999 is not an account in the book’s chart' }, { url: routes.line, method: 'PATCH', body: { coa_code: '9999' } }]);
  run = await standIn([OK], () => savePlanCell(lunch, L, 'budget', '18.50'));
  assert.deepEqual(run.sent, [{ url: routes.line, method: 'PATCH', body: { budget_amount: '18.50' } }]);
  // TYPE: the name first, then the line's TYPE.
  run = await standIn([OK, OK], () => savePlanCell(lunch, L, 'subAccountName', 'Brunch'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: routes.routine, method: 'PATCH', body: { name: 'Brunch · 2027-03-04 12:00' } }, { url: routes.line, method: 'PATCH', body: { activity: 'Brunch' } }]);
  // …the name refused (one name a user): said, and nothing else written.
  run = await standIn([[409, { error: 'Duplicate', field: 'name', message: 'a routine with this name already exists' }]], () => savePlanCell(lunch, L, 'subAccountName', 'Brunch'));
  assert.deepEqual([run.result, run.sent.length], [{ ok: false, words: 'a routine with this name already exists' }, 1]);
  // …the line refused: said, and the routine's name put back by the same writer — the row never holds two names.
  run = await standIn([OK, [400, { error: 'Validation', field: 'activity', message: 'activity exceeds 200 characters' }], OK], () => savePlanCell(lunch, L, 'subAccountName', 'Brunch'));
  assert.deepEqual([run.result, ...run.sent], [{ ok: false, words: 'activity exceeds 200 characters' }, { url: routes.routine, method: 'PATCH', body: { name: 'Brunch · 2027-03-04 12:00' } }, { url: routes.line, method: 'PATCH', body: { activity: 'Brunch' } }, { url: routes.routine, method: 'PATCH', body: { name: 'Lunch · 2027-03-04 12:00' } }]);
  // …and a name that could not be put back is said with the refusal.
  run = await standIn([OK, [400, { message: 'activity exceeds 200 characters' }], [409, { message: 'a routine with this name already exists' }]], () => savePlanCell(lunch, L, 'subAccountName', 'Brunch'));
  assert.deepEqual(run.result, { ok: false, words: `activity exceeds 200 characters — ${nameNotPutBackWords('Lunch · 2027-03-04 12:00', 'a routine with this name already exists')}` });
  assert.equal(nameNotPutBackWords('Lunch · 2027-03-04 12:00', 'w'), 'the routine\'s name was not put back to "Lunch · 2027-03-04 12:00" — w');
  run = await standIn([], () => savePlanCell(lunch, L, 'subAccountName', ''));
  assert.deepEqual([run.result, run.sent.length], [{ ok: false, words: requiredWords('name') }, 0], 'refused by the rule: nothing sent');
});

// ── E11 · THE VENDOR, ITS TAG, ITS ITEMS (ruling 3.2) ────────────────────────

test('E11 the vendor’s three cells: VENDOR at the row’s address — one of the book’s set, a new one added then set, blank cleared, unread vendors refused; the tag the vendor’s; the planned items on the vendor plan at its own grain; the vendors read once a VENDOR cell opens', async () => {
  const lunch = rowOf('Lunch', THU, false)[0];
  const gymFri = rowOf('Morning Gym', FRI, false)[0];
  const L = planOf(lunch);
  const G = planOf(gymFri);
  const read: CellVendors = { kind: 'read', vendors: [
    { id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: 'harbor.cafe' },
    { id: 'v-iron', vendor_name: 'Iron Works', entity_id: 'P', instagram_tag: null },
    { id: 'v-deli-b', vendor_name: 'Corner Deli', entity_id: 'B', instagram_tag: null },
  ] };
  const lunchAt = { kind: 'routine_line', id: 'lunch-line', instant: lunch.address.instant };
  assert.equal(lunch.address.instant, '2027-03-04T09:00:00.000Z');
  // One of the book's — by the directory's name rule — set at the row's address.
  let run = await standIn([[200, { outcome: 'replaced' }]], () => saveVendorCell(lunch, L, '  iron   works ', read));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/plan-vendors', method: 'POST', body: { ...lunchAt, vendorId: 'v-iron' } }]);
  // A new one — another book's of the same name is not this book's: added to the book, then set.
  run = await standIn([[201, { id: 'v-deli', vendor_name: 'Corner Deli', entity_id: 'P' }], [201, { outcome: 'set' }]], () => saveVendorCell(lunch, L, 'Corner Deli', read));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/vendor-directory', method: 'POST', body: { entityId: 'P', name: 'Corner Deli' } }, { url: '/api/operations/plan-vendors', method: 'POST', body: { ...lunchAt, vendorId: 'v-deli' } }]);
  // …added, then refused on the row: the add that stands is said with the route's words.
  run = await standIn([[201, { id: 'v-deli', vendor_name: 'Corner Deli', entity_id: 'P' }], [409, { error: 'grain', message: 'the route’s grain refusal' }]], () => saveVendorCell(lunch, L, 'Corner Deli', read));
  assert.deepEqual(run.result, { ok: false, words: vendorAddedNotSetWords('Corner Deli', 'the route’s grain refusal') });
  assert.equal(vendorAddedNotSetWords('Corner Deli', 'w'), "Corner Deli was added to the book's vendors — not set on this row: w");
  // Blank: the vendor at the row's address cleared — the address in the query.
  run = await standIn([[200, { outcome: 'cleared' }]], () => saveVendorCell(lunch, L, '  ', read));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/plan-vendors?kind=routine_line&id=lunch-line&instant=2027-03-04T09%3A00%3A00.000Z', method: 'DELETE', body: null }]);
  run = await standIn([[404, { error: 'not-found', message: 'No vendor at that address' }]], () => saveVendorCell(gymFri, G, '', read));
  assert.deepEqual([run.result, run.sent[0].url], [{ ok: false, words: 'No vendor at that address' }, '/api/operations/plan-vendors?kind=routine&id=gym&instant=2027-03-05T04%3A00%3A00.000Z'], 'an every-occurrence vendor is not this row’s address: the route says so');
  // Vendors unread: a name is refused, never guessed — nothing sent.
  run = await standIn([], () => saveVendorCell(lunch, L, 'Harbor Cafe', { kind: 'reading' }));
  assert.deepEqual([run.result, run.sent.length], [{ ok: false, words: VENDORS_LOADING_WORDS }, 0]);
  run = await standIn([], () => saveVendorCell(lunch, L, 'Harbor Cafe', { kind: 'failed', words: 'the vendors could not be read — offline' }));
  assert.deepEqual(run.result, { ok: false, words: 'the vendors could not be read — offline' });
  // The read: the directory's GET by the paste's own rule; an answer that is not the list, said.
  const listed = await standIn([[200, { vendors: [{ id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: 'harbor.cafe' }] }]], () => readCellVendors());
  assert.deepEqual([listed.result, ...listed.sent], [{ kind: 'read', vendors: [{ id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: 'harbor.cafe' }] }, { url: '/api/operations/vendor-directory', method: 'GET', body: null }]);
  const unlisted = await standIn([[200, { nope: [] }]], () => readCellVendors());
  assert.deepEqual(unlisted.result, { kind: 'failed', words: vendorsUnreadWords(VENDORS_NO_LIST_WORDS) });
  // INSTAGRAM TAG — the vendor's, by its id; blank clears it.
  run = await standIn([OK], () => savePlanCell(lunch, L, 'instagramTag', '@harbor_cafe'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/vendor-directory', method: 'PATCH', body: { id: 'v-harbor', instagramTag: '@harbor_cafe' } }]);
  run = await standIn([OK], () => savePlanCell(lunch, L, 'instagramTag', ''));
  assert.deepEqual(run.sent, [{ url: '/api/operations/vendor-directory', method: 'PATCH', body: { id: 'v-harbor', instagramTag: '' } }]);
  // ITEMS on a row with no record — the row's vendor plan, at its grain: this occurrence, or every one (the instant null).
  run = await standIn([OK], () => savePlanCell(lunch, L, 'description', 'soup only'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/plan-vendors', method: 'POST', body: { ...lunchAt, vendorId: 'v-harbor', items: 'soup only' } }]);
  run = await standIn([OK], () => savePlanCell(gymFri, G, 'description', 'a towel'));
  assert.deepEqual(run.sent, [{ url: '/api/operations/plan-vendors', method: 'POST', body: { kind: 'routine', id: 'gym', instant: null, vendorId: 'v-iron', items: 'a towel' } }]);
  // The writers, at every grain: the vendor cleared from every occurrence names no instant.
  const cleared = await standIn([OK], () => clearVendor({ kind: 'routine', id: 'gym', instant: null }));
  assert.deepEqual([cleared.result, ...cleared.sent], [{ ok: true, value: null }, { url: '/api/operations/plan-vendors?kind=routine&id=gym', method: 'DELETE', body: null }]);
  // In the source: the vendors read once a VENDOR cell opens; the box lists the row's book's; CATEGORY its chart.
  const s = code(SECTION);
  assert.match(s, /if \(next !== null && next\.column === 'vendor'\) readTheVendors\(\);/);
  assert.match(s, /void readCellVendors\(\)\.then\(\(read\) => \{ if \(vendorsAsked\.current !== asked\) return; vendorsRef\.current = read; refusedRef\.current = null; setVendors\(read\); \}\);/, 'a name refused while the vendors were read may be sent again once they are');
  assert.match(s, /if \(column === 'accountName'\) return \{ entityId: can\.plan \? can\.entityId : '' \};\n\s*return \{ vendors: can\.plan && vendors\.kind === 'read' \? vendors\.vendors\.filter\(\(v\) => v\.entity_id === can\.entityId\) : \[\], listId: 'ledger-cell-vendors' \};/); // EDIT-02 (2026-11-28): a row with no plan opens these too — it has no book
  assert.doesNotMatch(s, /vendor-directory|plan-vendors|\/api\//, 'the frame names no route');
});

// ── E12 · ONE SAVE, SORTED (rulings 2.3, 3.1, 3.2) ───────────────────────────

test('E12 every save goes through saveCell, sorted by the rule’s own test and the row’s entries — the record’s cells to the record’s writer, VENDOR to its box, the rest to the plan’s rule; a cell on a row that cannot take it is the frame’s error, thrown by name', async () => {
  const lunch = rowOf('Lunch', THU, false)[0];
  const gymThu = rowOf('Morning Gym', THU, true)[0];
  const teaRow = rowOf('Tea', FRI, false)[0];
  const save = (row: LedgerSheetRow, c: TypedColumn, text: string) => saveCell(row, ledger.recording[row.key], ledger.editing[row.key], c, text, { kind: 'reading' }, NOW);
  let run = await standIn([[200, { record: {}, changed: true }]], () => save(gymThu, 'stars', '4'));
  assert.deepEqual([run.sent[0].url, run.sent[0].method], ['/api/operations/stops', 'POST'], 'a record’s cell');
  run = await standIn([[200, { record: {}, changed: true }]], () => save(gymThu, 'description', 'two sets'));
  assert.deepEqual([run.sent[0].url, (run.sent[0].body as { note: string }).note], ['/api/operations/stops', 'two sets'], 'ITEMS on a held record: its note');
  run = await standIn([OK], () => save(lunch, 'description', 'soup only'));
  assert.deepEqual([run.sent[0].url, run.sent[0].method], ['/api/operations/plan-vendors', 'POST'], 'ITEMS on a row with no record: the planned items');
  run = await standIn([OK], () => save(lunch, 'budget', '9'));
  assert.deepEqual([run.sent[0].url, run.sent[0].method], ['/api/operations/routines/steps/lunch-line', 'PATCH']);
  run = await standIn([OK], () => save(lunch, 'vendor', ''));
  assert.deepEqual([run.sent[0].url.split('?')[0], run.sent[0].method], ['/api/operations/plan-vendors', 'DELETE']);
  assert.throws(() => save(teaRow, 'budget', '9'), /^Error: cellSaves: budget of \S+ is the plan's, and the row has none to change$/);
  assert.throws(() => save(teaRow, 'stars', '4'), /^Error: cellSaves: stars of \S+ is the record's, and the row takes no record$/);
  assert.match(code(SECTION), /const saveOf = \(row: LedgerSheetRow, column: TypedColumn, typed: string\): Promise<CellSave> => saveCell\(row, recording\[row\.key\], editing\[row\.key\], column, typed, vendorsRef\.current, new Date\(\)\);/);
});

// ── E13 · THE WRITERS FILE (ruling 3.1's writers) ────────────────────────────

test('E13 the writers file: patchRoutine, patchLine and clearVendor through the one helper — which takes DELETE, sending no body with it — and setVendor at every occurrence; still one request in the file; the leaf names no route; nothing stored', async () => {
  const w = code(WRITERS);
  assert.equal((w.match(/\bfetch\s*\(/g) ?? []).length, 1, 'one request in the file');
  assert.match(w, /async function send\(method: 'POST' \| 'PATCH' \| 'DELETE', url: string, body: unknown\)/);
  assert.match(w, /readonly instant: string \| null; readonly vendorId: string; readonly items\?: string \}\)/, 'setVendor: an instant, or none — every occurrence');
  assert.deepEqual([...w.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]).slice(7), ['patchRoutine', 'patchLine', 'clearVendor', 'readVendors', 'deleteRoutine'], 'after the seven that stood — PART 4’s deleteRoutine last');
  let run = await standIn([OK], async () => patchRoutine('lunch', { location_class: 'homebase' }));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true, value: null }, { url: '/api/operations/routines/lunch', method: 'PATCH', body: { location_class: 'homebase' } }]);
  run = await standIn([[400, { error: 'Validation', field: 'activity', message: 'activity cannot be empty' }]], async () => patchLine('lunch-line', { activity: ' ' }));
  assert.deepEqual(run.result, { ok: false, words: 'activity cannot be empty' }, 'the route’s own words');
  const everyOne = await standIn([[200, { outcome: 'set' }]], () => setVendor({ kind: 'routine', id: 'gym', instant: null, vendorId: 'v-iron', items: 'a towel' }));
  assert.deepEqual(everyOne.sent, [{ url: '/api/operations/plan-vendors', method: 'POST', body: { kind: 'routine', id: 'gym', instant: null, vendorId: 'v-iron', items: 'a towel' } }]);
  const saves = code(SAVES);
  assert.doesNotMatch(saves, /\bfetch\s*\(|\/api\//, 'the leaf names no route');
  for (const file of [SAVES, WRITERS, SECTION]) assert.doesNotMatch(code(file), /localStorage|sessionStorage|document\.cookie|indexedDB/, `${file}: nothing stored in the browser`);
});

// ── PART 4 — EVERY ROW'S ✕ ───────────────────────────────────────────────────

// ── E14 · WHAT A ✕ DELETES, AND WHAT IT ASKS (ruling 4.1) ────────────────────

test('E14 the ✕’s three questions, by the row’s entries: a one-off — this row, with its record and its vendor; a day of a repeating plan — the plan, every row of it; no plan and a held record — the record; no plan and no record — no ✕', () => {
  const lunch = rowOf('Lunch', THU, false)[0];
  const dinner = rowOf('Dinner', FRI, false)[0];
  const gymFri = rowOf('Morning Gym', FRI, false)[0];
  const gymThu = rowOf('Morning Gym', THU, true)[0];
  const kiosk = rowOf('Kiosk', THU, true)[0];
  const teaRecorded = rowOf('Tea', THU, true)[0];
  const teaPlans = [...rowOf('Tea', THU, false), ...rowOf('Tea', FRI, false)];
  const del = (row: LedgerSheetRow) => rowDeleteOf(row, ledger.recording[row.key], ledger.editing[row.key]);
  // A one-off: its routine — the row, with its record and its vendor.
  assert.deepEqual(del(lunch), { kind: 'routine', routineId: 'lunch', question: 'delete this row — Lunch on 2027-03-04, with its record and its vendor?' });
  assert.deepEqual(del(dinner), { kind: 'routine', routineId: 'dinner', question: deleteOneOffQuestion('Dinner', FRI) });
  // A day of a repeating plan — its row with no record, and its recorded row: the plan, every row of it.
  const plan = { kind: 'routine', routineId: 'gym', question: 'delete the plan "Morning Gym" — every row of it, before and after this day, with their records and vendors?' };
  assert.deepEqual([del(gymFri), del(gymThu)], [plan, plan]);
  // No plan and a held record: the record, by its id.
  const kioskHeld = takenOf(kiosk).held;
  assert.deepEqual(del(kiosk), { kind: 'record', held: kioskHeld, question: 'delete this record — Kiosk on 2027-03-04?' });
  assert.deepEqual(del(teaRecorded), { kind: 'record', held: takenOf(teaRecorded).held, question: deleteRecordQuestion('Tea', THU) });
  // No plan and no record: no ✕.
  for (const row of teaPlans) assert.equal(del(row), null, `${row.key}: nothing to delete`);
  // The words, typed whole.
  assert.equal(DELETE_ROW_WORDS, 'delete this row');
  assert.equal(DELETE_WORDS, 'delete');
  assert.equal(KEEP_WORDS, 'keep');
  assert.equal(deletePlanQuestion('Morning Gym'), plan.question);
  assert.equal(deleteRecordQuestion('Lunch', THU), 'delete this record — Lunch on 2027-03-04?');
});

// ── E15 · ASKED IN PLACE, THEN DELETED (ruling 4.1, the HARD GATE) ───────────

test('E15 the ✕ asks in place and only then deletes — the routine through the routines DELETE that stands, a record with no plan through the stops’ one writer; a refusal is the route’s words, nothing changed; one question at a time, closed by a cell or another ✕; no confirm(), nothing stored', async () => {
  const lunch = rowOf('Lunch', THU, false)[0];
  const kiosk = rowOf('Kiosk', THU, true)[0];
  const del = (row: LedgerSheetRow) => { const d = rowDeleteOf(row, ledger.recording[row.key], ledger.editing[row.key]); if (d === null) return assert.fail(`${row.key} has no ✕`); return d; };
  // delete → the routine, through the routines DELETE that stands; its answer read the file's one way.
  let run = await standIn([[200, { deleted: true, id: 'lunch' }]], () => deleteRow(del(lunch)));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/routines/lunch', method: 'DELETE', body: null }]);
  // …refused while a posting is linked in Books — the route's words, and nothing else sent.
  run = await standIn([[409, { error: routineHoldsLinksWords(1) }]], () => deleteRow(del(lunch)));
  assert.deepEqual([run.result, run.sent.length], [{ ok: false, words: routineHoldsLinksWords(1) }, 1]);
  // …or a record with no plan, through the stops' one writer's clear.
  run = await standIn([[200, { deleted: true }]], () => deleteRow(del(kiosk)));
  assert.deepEqual([run.result, ...run.sent], [{ ok: true }, { url: '/api/operations/stops/r-kiosk', method: 'DELETE', body: null }]);
  run = await standIn([[404, { error: 'Not found' }]], () => deleteRow(del(kiosk)));
  assert.equal(run.result.ok, false, 'a refusal is said');
  // The writer: the routines DELETE, through the one helper — at the file's end.
  const w = code(WRITERS);
  assert.match(w, /export async function deleteRoutine\(routineId: string\): Promise<WriteAnswer<null>> \{\n\s*const answer = await send\('DELETE', `\/api\/operations\/routines\/\$\{routineId\}`, undefined\);/);
  assert.equal([...w.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]).pop(), 'deleteRoutine');
  assert.equal((w.match(/\bfetch\s*\(/g) ?? []).length, 1, 'still one request in the file');
  // THE ✕: the DAY cell starts with it — the app's faint chip, red on hover and focus — on a row that has something to delete.
  const s = code(SECTION);
  assert.ok(s.includes('data-ledger-cell="day" title={titleOf(row, \'day\')}>{questionOf(row) !== null && <button type="button" className={`${chip} mr-1 text-text-faint hover:text-brand-red focus:text-brand-red`} aria-label={DELETE_ROW_WORDS} aria-expanded={asking !== null && asking.key === row.key} onClick={() => askDelete(row)} data-ledger-delete={row.key}>✕</button>}{dayLongWords(row.day)}</td>'));
  // ITS QUESTION — a row beneath, spanning every column, in red: delete · keep, and a refusal on that line.
  assert.match(s, /\{asking !== null && asking\.key === row\.key && \(\n\s*<tr className="border-t border-border" data-ledger-delete-ask=\{row\.key\}>\n\s*<td colSpan=\{LEDGER_COLUMNS\.length\} className=\{cell\}>\n\s*<span className="inline-flex flex-wrap items-center gap-2 text-brand-red"><span data-ledger-delete-question>\{questionOf\(row\)\}<\/span><button type="button" className=\{`\$\{chip\} text-brand-red`\} onClick=\{\(\) => void deleteAsked\(row\)\} data-ledger-delete-yes>\{DELETE_WORDS\}<\/button><button type="button" className=\{chip\} onClick=\{keepRow\} data-ledger-delete-keep>\{KEEP_WORDS\}<\/button>\n\s*\{asking\.refusal !== null && <span data-ledger-delete-refused>\{asking\.refusal\}<\/span>\}/);
  // Nothing is deleted on the first tap: the ✕ asks; delete is the answer.
  const frame = s.slice(s.indexOf('function useCellFrame('));
  assert.match(frame, /const askDelete = \(row: LedgerSheetRow\) => setAsking\(\{ key: row\.key, refusal: null \}\);/, 'the ✕ only asks');
  assert.match(frame, /const keepRow = \(\) => setAsking\(null\);/);
  assert.match(frame, /const done = await deleteRow\(target\);\n\s*if \(!done\.ok\) \{ setAsking\(\{ key: row\.key, refusal: done\.words \}\); return; \}\n\s*setAsking\(null\);\n\s*written\(row\.day\);/, 'refused: the words, nothing changed; accepted: the span read again and the day told');
  assert.equal((frame.match(/deleteRow\(/g) ?? []).length, 1, 'the one delete — behind the question');
  // One question at a time: ONE state; a cell opening closes it; so does its row leaving the sheet.
  assert.match(frame, /const \[asking, setAsking\] = useState<\{ readonly key: string; readonly refusal: string \| null \} \| null>\(null\);/);
  assert.match(frame, /if \(next !== null\) setAsking\(null\);/, 'opening a cell closes the question');
  assert.match(frame, /setAsking\(\(held\) => \(held === null \|\| rows\.some\(\(r\) => r\.key === held\.key\) \? held : null\)\);/);
  // No browser pop-up, nothing stored — in the frame, the leaf or the writers.
  for (const file of [SECTION, SAVES, WRITERS]) assert.doesNotMatch(code(file), /window\.confirm|\bconfirm\(|\balert\(|\bprompt\(|localStorage|sessionStorage|document\.cookie|indexedDB/, `${file}: no pop-up, nothing stored`);
});
