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
  CELL_KEYS_WORDS, CELL_REACH_WORDS, CELL_WENT_NONE_WORDS, CLEAR_CELL_QUESTION, KEEP_WORDS, LEDGER_COLUMNS, NEVER_OPENS_WORDS, NO_PLAN_LINE_WORDS, RECORD_CELLS, STOP_AHEAD_WORDS, TWO_LINES_NO_PLAN_WORDS, TYPED_COLUMNS,
  boxTextOf, cellOpens, cellReachWords, isTypedColumn, ledgerFailedWords, ledgerOf, nextOpeningColumn, planMinutesOf, recordCellDraft, recordInput, rowDraftOf, starsTypedWords, tagReachWords,
  type LedgerEditing, type LedgerInput, type LedgerRecordInput, type LedgerRecordingTaken, type LedgerSheetRow, type LedgerVendorRow, type TypedColumn,
} from '../operations/ledger';
import { readLedger } from '../../components/workbench/operations/ledger/ledgerReads';
import ColumnBox from '../../components/workbench/operations/ledger/ColumnBox';
import { clearRecordCell, saveRecordCell } from '../../components/workbench/operations/ledger/cellSaves';

const SHEET_RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const BOX = 'src/components/workbench/operations/ledger/ColumnBox.tsx';
const SAVES = 'src/components/workbench/operations/ledger/cellSaves.ts';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const READS = 'src/components/workbench/operations/ledger/ledgerReads.ts';

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
  locations: new Map(ROUTINES.map((r): [string, null] => [r.id, null])), once: ONCE, subAccounts: [], minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: [],
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
  assert.deepEqual(entryOf('Lunch', THU, false), [{ plan: true, routineId: 'lunch', lineId: 'lunch-line', once: true, routineName: 'Lunch · 2027-03-04 12:00', entityId: 'P', vendor: { id: 'v-harbor', name: 'Harbor Cafe', every: false } }]);
  // A one-off with no vendor.
  assert.deepEqual(entryOf('Dinner', FRI, false), [{ plan: true, routineId: 'dinner', lineId: 'dinner-line', once: true, routineName: 'Dinner · 2027-03-05 19:00', entityId: 'P', vendor: null }]);
  // A repeating plan's row: its own line (no line id), not a one-off, the vendor for every occurrence.
  const gym = { plan: true, routineId: 'gym', lineId: null, once: false, routineName: 'Morning Gym', entityId: 'P', vendor: { id: 'v-iron', name: 'Iron Works', every: true } };
  assert.deepEqual(entryOf('Morning Gym', FRI, false), [gym]);
  // A recorded row joined to its line: that line's entry — the same as its plan row would carry.
  assert.deepEqual(entryOf('Morning Gym', THU, true), [gym]);
  // A recorded row joined to none.
  assert.deepEqual(entryOf('Kiosk', THU, true), [{ plan: false, words: NO_PLAN_LINE_WORDS }]);
  // Two plan lines at a stop: each plan row, and the record that stands there on its own row.
  assert.deepEqual(entryOf('Tea', FRI, false), [{ plan: false, words: TWO_LINES_NO_PLAN_WORDS }, { plan: false, words: TWO_LINES_NO_PLAN_WORDS }]);
  assert.deepEqual(entryOf('Tea', THU, false), [{ plan: false, words: TWO_LINES_NO_PLAN_WORDS }, { plan: false, words: TWO_LINES_NO_PLAN_WORDS }]);
  assert.deepEqual(entryOf('Tea', THU, true), [{ plan: false, words: TWO_LINES_NO_PLAN_WORDS }]);
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
  assert.match(rules, /\n\s*\}\);\n\s*editingAt\.set\(key, line !== null \? editingOf\(line, key\) : \{ plan: false, words: budgetState === 'doubled' \? TWO_LINES_NO_PLAN_WORDS : NO_PLAN_LINE_WORDS \}\);\n\s*return \{\n\s*id: r\.record\.id,/, 'a recorded row’s, after its `recording` entry');
  assert.match(rules, /vendor: \{ kind: 'box', line: l \} \}\);\n\s*editingAt\.set\(row\.key, lines > 1 \? \{ plan: false, words: TWO_LINES_NO_PLAN_WORDS \} : editingOf\(l, key\)\);\n\s*sheeted\.push\(\{ row, label: l\.label, line: l\.line \}\);/, 'a plan row’s, after its own');
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
const opensWhich = (row: LedgerSheetRow): TypedColumn[] => TYPED_COLUMNS.filter((c) => cellOpens(c, ledger.recording[row.key]).opens);
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
  assert.ok(code(SECTION).includes('<ColumnBox column={column} value={text} onChange={typeInCell} onKeyDown={(e) => keyOf(e, row, column)} onBlur={() => void commit()} autoFocus />'));
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
  assert.match(s, /const \{ open, clearing, cellRefusal, setOpenCell, titleOf, clickCell, boxIn, clearCell \} = useCellFrame\(rows, recording, editing, \(day\) => \{ setWrites\(\(n\) => n \+ 1\); announceDayWritten\(day\); \}\);/, 'an accepted save reads the span again and announces the day');
  const frame = s.slice(s.indexOf('function useCellFrame('));
  assert.match(frame, /const \[open, setOpen\] = useState<OpenCell \| null>\(null\);/, 'ONE open cell: its row’s key and its column, or none');
  assert.match(s, /type OpenCell = \{ readonly key: string; readonly column: TypedColumn \};/);
  // A click opens a typed cell where the rule allows — the open one saved first; a chip in the cell and the box keep their clicks.
  assert.match(frame, /const openCell = async \(row: LedgerSheetRow, column: TypedColumn\) => \{\n\s*const at = openRef\.current;\n\s*if \(at !== null && at\.key === row\.key && at\.column === column\) return;\n\s*if \(!opensOf\(row, column\)\.opens\) return;\n\s*if \(at !== null && !\(await commit\(\)\)\) return;\n\s*setOpenCell\(\{ key: row\.key, column \}, boxTextOf\(row, column\)\);/);
  assert.match(frame, /if \(\(e\.target as HTMLElement\)\.closest\('button, input, select, a'\) !== null\) return;/);
  // The keys.
  assert.match(frame, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); setOpenCell\(null\); return; \}/, 'Esc: closed, nothing written');
  assert.match(frame, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); void commit\(\); return; \}/);
  assert.match(frame, /if \(e\.key === 'Tab' && !e\.shiftKey\) \{\n\s*e\.preventDefault\(\);\n\s*const next = nextOpeningColumn\(column, \(c\) => opensOf\(row, c\)\.opens\);\n\s*void commit\(\)\.then\(\(closed\) => \{ if \(closed && next !== null\) setOpenCell\(\{ key: row\.key, column: next \}, boxTextOf\(row, next\)\); \}\);/);
  // Leaving saves only a change: an unchanged text closes, nothing sent; a refused text is not sent again until it changes; one save at a time.
  assert.match(frame, /if \(row === undefined \|\| textRef\.current === heldRef\.current\) \{ setOpenCell\(null\); return Promise\.resolve\(true\); \}/);
  assert.match(frame, /if \(refusedRef\.current === typed\) return Promise\.resolve\(false\);/);
  assert.match(frame, /if \(savingRef\.current !== null\) return savingRef\.current;/);
  assert.match(frame, /if \(!saved\.ok\) \{ refusedRef\.current = typed; setCellRefusal\(saved\.words\); return false; \}\n\s*setOpenCell\(null\);\n\s*written\(row\.day\);/, 'refused: the words, the box open with the text; accepted: closed, and the day told');
  // Tab's next cell — the next one to the right on the row that opens.
  const recorded = rowOf('Morning Gym', THU, true)[0];
  assert.deepEqual(opensWhich(recorded), ['description', 'went', 'stars', 'loggedMinutes', 'actual', 'notes'], 'a held record: ITEMS is its note');
  assert.equal(nextOpeningColumn('went', (c) => opensWhich(recorded).includes(c)), 'stars');
  assert.equal(nextOpeningColumn('actual', (c) => opensWhich(recorded).includes(c)), 'notes');
  assert.equal(nextOpeningColumn('notes', (c) => opensWhich(recorded).includes(c)), null, 'none to the right: it closes');
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
  assert.throws(() => cellReachWords('instagramTag', ledger.editing[rowOf('Dinner', FRI, false)[0].key]), /INSTAGRAM TAG is the vendor's — a row with no vendor opens no tag/);
  assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie|indexedDB|window\.confirm|confirm\(/, 'nothing stored in the browser; no browser pop-up');
});

// ── E7 · THE RECORD'S CELLS (ruling 2.3) ─────────────────────────────────────

test('E7 the record’s cells — WENT, STARS, LOGGED MIN, ACTUAL, NOTES, and ITEMS on a held record — open on a row that takes a record and go through the record form’s own rule and writer: rowDraftOf with the one box replaced, recordInput, setStopRecord; WENT none is a clear, asked first; a row that takes none says why', async () => {
  assert.deepEqual([...RECORD_CELLS], ['went', 'stars', 'loggedMinutes', 'actual', 'notes']);
  const recorded = rowOf('Morning Gym', THU, true)[0];
  const lunch = rowOf('Lunch', THU, false)[0];
  const dinner = rowOf('Dinner', FRI, false)[0];
  const teaRow = rowOf('Tea', FRI, false)[0];
  // Which open, by the row's entry in `recording`.
  assert.deepEqual(opensWhich(lunch), ['went', 'stars', 'loggedMinutes', 'actual', 'notes'], 'a plan row with no record: ITEMS is its planned items — not a record cell');
  assert.deepEqual(opensWhich(teaRow), [], 'a row that takes no record');
  const why = ledger.recording[teaRow.key];
  assert.ok(!why.takes);
  for (const c of RECORD_CELLS) assert.deepEqual(cellOpens(c, why), { opens: false, words: why.words }, `${c}: the entry’s own sentence`);
  for (const c of ['start', 'end', 'location', 'accountName', 'subAccountName', 'vendor', 'instagramTag', 'budget'] as const) assert.deepEqual(cellOpens(c, ledger.recording[lunch.key]), { opens: false, words: null }, `${c}: not this part’s`);
  // The text each box opens with.
  assert.deepEqual(['went', 'stars', 'loggedMinutes', 'actual', 'notes', 'description'].map((c) => boxTextOf(recorded, c as TypedColumn)), ['went', '', '', '20.00', '', '']);
  assert.deepEqual(['went', 'actual', 'description'].map((c) => boxTextOf(lunch, c as TypedColumn)), ['', '', 'soup and bread']);
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

test('E8 the fourteen columns he types, in the sheet’s order; the eleven that never open each say why on hover; every cell of the sheet carries a title, and a typed one its click and its box', () => {
  assert.deepEqual([...TYPED_COLUMNS], ['start', 'end', 'location', 'accountName', 'subAccountName', 'description', 'vendor', 'instagramTag', 'went', 'stars', 'loggedMinutes', 'budget', 'actual', 'notes']);
  assert.deepEqual(LEDGER_COLUMNS.filter((c) => isTypedColumn(c)), [...TYPED_COLUMNS], 'in the sheet’s order');
  assert.deepEqual(NEVER_OPENS_WORDS, {
    day: 'worked out from DATE',
    date: 'moving a row to another day carries its record and its vendor with it — that is not done in a cell yet',
    city: "the trip's — the trip that covers DATE", region: "the trip's — the trip that covers DATE", country: "the trip's — the trip that covers DATE",
    book: 'moving a row to another book carries its record and its vendor with it — that is not done in a cell yet',
    plannedMinutes: 'worked out from START and END',
    account: 'worked out from the codes of LOCATION, CATEGORY, ENTITY and TYPE',
    variance: 'worked out — ACTUAL less BUDGET',
    match: 'the postings linked in Books — changed by its "link"',
    underOver: 'worked out from the sign of VARIANCE',
  });
  assert.deepEqual(LEDGER_COLUMNS.filter((c) => !isTypedColumn(c)), Object.keys(NEVER_OPENS_WORDS), 'the eleven, in the sheet’s order');
  const s = code(SECTION);
  const row = s.slice(s.indexOf('data-ledger-row={row.key}'), s.indexOf('{open !== null && open.key === row.key && ('));
  assert.deepEqual([...row.matchAll(/ title=\{titleOf\(row, '(\w+)'/g)].map((m) => m[1]), [...LEDGER_COLUMNS], 'every cell titled, in the sheet’s order');
  assert.deepEqual([...row.matchAll(/onClick=\{\(e\) => clickCell\(e, row, '(\w+)'\)\}/g)].map((m) => m[1]), [...TYPED_COLUMNS], 'a typed cell’s click — and no other cell’s');
  assert.deepEqual([...row.matchAll(/\{boxIn\(row, '(\w+)'\) \?\? /g)].map((m) => m[1]), [...TYPED_COLUMNS], 'a typed cell’s box, else what it printed');
  assert.match(s, /if \(!isTypedColumn\(column\)\) return own === undefined \? NEVER_OPENS_WORDS\[column\] : `\$\{own\} — \$\{NEVER_OPENS_WORDS\[column\]\}`;/, 'MATCH says its postings first, then why');
  assert.match(s, /return can\.opens \|\| can\.words === null \? own : can\.words;/);
});
