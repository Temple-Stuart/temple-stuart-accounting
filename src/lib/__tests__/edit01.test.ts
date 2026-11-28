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
import { code } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { RoutineWords } from '../budget/planLines';
import { isOnceRRule } from '../operations/rruleHelpers';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  NO_PLAN_LINE_WORDS, TWO_LINES_NO_PLAN_WORDS, ledgerFailedWords, ledgerOf, planMinutesOf,
  type LedgerEditing, type LedgerInput, type LedgerRecordInput, type LedgerVendorRow,
} from '../operations/ledger';
import { readLedger } from '../../components/workbench/operations/ledger/ledgerReads';

const SHEET_RULES = 'src/lib/operations/ledger.ts';
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
