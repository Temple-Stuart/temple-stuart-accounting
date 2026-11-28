/**
 * TIMESHEET-04b (Alex, 2026-11-25 + 2026-11-27) — THE SHEET'S TWO COLUMNS, A PLAN ROW'S PLANNED ITEMS, AND THE RECORD'S NOTES.
 *
 * TIMESHEET-04a put three columns in the database: a vendor's Instagram tag, a plan's planned items, a stop's notes. Here the
 * rules read them. THE RECORD HOLDS NOTES — the stops rule (stopRecord.ts stopInput) reads them as it reads the note, the row's
 * form has their box (ledger.ts recordInput), and every sender of a record's body says them. THE SHEET (ledger.ts ledgerOf) is
 * twenty-three columns — the tag after the vendor ("tag is own column"), the notes after the description — and a plan row (one
 * that holds no record) carries what its plan's vendor row holds as planned, at that row's own grain.
 *
 * HERMETIC, on timesheet02.test.ts's model: no database, no network, and the only clock is the `now` handed in. Every name,
 * place, tag and amount below is made up. The rules are DRIVEN over a fixture built the Budget's own way; the answer function
 * through a fake client; the screen files, the route, the paste and the registry are anchored to their source with comments
 * stripped (the reader law). No pin here names a line number of any file — a line is found by its content, a file's length is
 * counted, and a line the registry cites is read from the citation itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOnceRRule } from '../operations/rruleHelpers'; // EDIT-01 (2026-11-28): the fixture states each routine's one-off-ness by the rule's own test
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { RoutineWords } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import { NOTES_MAX, NOTE_MAX, SKIP_REASON_WORDS, stopInput, stopRecordRowOf, unchanged, type StopRecordRow, type StopRecordValues } from '../operations/stopRecord';
import { PLANNED_ITEMS_MAX, instagramTagWords } from '../operations/planVendor';
import { TOOL_REGISTRY } from '../toolRegistry';
import { taskLedgerAnswerOf } from '../operations/ledgerAnswer';
import {
  LEDGER_COLUMNS, LEDGER_CSV, LEDGER_HEAD_WORDS, LEDGER_TABLE, NOTES_CONTROL_WORDS, NOTES_LONG_WORDS, NO_COLUMN_FILTERS, NO_TEXT_FILTER, NO_VALUE_FILTER, PLANNED_ITEMS_TITLE_WORDS, RECORD_FIELDS, RECORD_FIELD_WORDS, TEXT_COLUMNS, VALUE_COLUMNS,
  applyColumnFilters, cellTextOf, cellWordsOf, columnKind, columnValues, descriptionOf, headWordOf, ledgerCsv, ledgerOf, planMinutesOf, plannedDescription, recordBody, recordDraftOf, recordInput, rowDraftOf, sortKeyOf, sortRows, tagCellWords,
  type ExpenseValues, type LedgerInput, type LedgerPlanRow, type LedgerRecordInput, type LedgerRecording, type LedgerRecordingTaken, type LedgerSheetRow, type LedgerVendorRow, type RecordDraft,
} from '../operations/ledger';

const RULES = 'src/lib/operations/ledger.ts';
const STOP_RULE = 'src/lib/operations/stopRecord.ts';
const VENDOR_RULE = 'src/lib/operations/planVendor.ts';
const PLAN_LINES = 'src/lib/budget/planLines.ts';
const ANSWER = 'src/lib/operations/ledgerAnswer.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const LEAF = 'src/components/workbench/operations/ledger/RecordForm.tsx';
const WRITES = 'src/components/workbench/operations/stops/stopWrites.ts';
const CARD_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';
const PASTE_RULE = 'src/lib/operations/pasteRows.ts';
const PASTE_SAVE = 'src/lib/operations/pasteSave.ts';
const PASTE_LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const LEDGER_WRITES = 'src/components/workbench/operations/ledger/ledgerWrites.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const THIS = 'src/lib/__tests__/timesheet04b.test.ts';

// ── THE FIXTURE (the Budget's own shapes, as timesheet02.test.ts builds them; every name, place and tag made up) ──

const NBO = 'Africa/Nairobi'; // UTC+3 the year round
const MON = '2027-08-09';
const TUE = '2027-08-10';
const WED = '2027-08-11';
/** Tue Aug 10, 12:00 in the zone: all of Monday and Tuesday's morning are past; Tuesday from 12:00 and all of Wednesday are ahead. */
const NOW = new Date('2027-08-10T09:00:00.000Z');
/** An occurrence's instant: a wall clock on a day in the zone (UTC+3), as the Budget's expansion gives it. */
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string; scheduleRrule: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: NBO, startDate: null, endDate: null, budgetAmount: null, coaCode: null, steps: [], startTime: null, endTime: null, role: 'place', ...over,
});
const ROUTINES: RoutinePlanInput[] = [
  // A lined place stop at 08:00: Eggs states its own time of day (08:10) and 25 minutes; Juice states neither.
  routine({ id: 'breakfast', name: 'Breakfast', scheduleRrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0', steps: [
    { id: 'eggs', stepOrder: 1, budgetAmount: 6.5, coaCode: '6150', durationMinutes: 25, timeOfDay: '08:10' },
    { id: 'juice', stepOrder: 2, budgetAmount: 3, coaCode: '6150', durationMinutes: null, timeOfDay: null },
  ] }),
  // A stepless place stop at 13:00 — its vendor is planned BY OCCURRENCE.
  routine({ id: 'noodles', name: 'Noodles', scheduleRrule: 'FREQ=DAILY;BYHOUR=13;BYMINUTE=0', budgetAmount: 8, coaCode: '6150' }),
  // A stepless place stop at 16:00 — its vendor is planned for EVERY occurrence, and holds no planned items.
  routine({ id: 'tea', name: 'Tea', scheduleRrule: 'FREQ=DAILY;BYHOUR=16;BYMINUTE=0', budgetAmount: 2.5, coaCode: '6150' }),
  // A stepless plain stop (role none) at 18:00 — no vendor.
  routine({ id: 'sauna', name: 'Sauna', scheduleRrule: 'FREQ=DAILY;BYHOUR=18;BYMINUTE=0', budgetAmount: 12, coaCode: '6200', role: 'none' }),
];
const ROLES = new Map(ROUTINES.map((r): [string, string] => [r.id, r.role]).concat([['kiosk', 'place']]));
const WORDS = new Map<string, RoutineWords>(ROUTINES.map((r): [string, RoutineWords] => [r.id, {
  name: r.name, timezone: NBO, steps: new Map(r.id === 'breakfast' ? [['eggs', { activity: 'Eggs', timeOfDay: '08:10' }], ['juice', { activity: 'Juice', timeOfDay: null }]] : []),
}]));

const EGGS_ITEMS = 'two eggs, rye toast';
const NOODLE_ITEMS = 'dry noodles, no chili';
/** The plan-vendor rows as the ledger reads them — each with its planned items and its vendor's tag, null where there is none. */
const VENDORS: LedgerVendorRow[] = [
  // EVERY occurrence of the eggs line: a vendor with a tag, and planned items.
  { id: 'pv-eggs', routine_id: null, step_id: 'eggs', task_id: null, occurrence_at: null, items: EGGS_ITEMS, vendor: { id: 'v-yolk', vendor_name: 'Yolk & Rye', entity_id: 'P', instagram_tag: 'made.up_yolk' }, routine: null, step: { activity: 'Eggs', routine_id: 'breakfast', routine: { name: 'Breakfast', timezone: NBO } }, task: null },
  // EVERY occurrence of tea: a vendor with a tag, and no planned items.
  { id: 'pv-tea', routine_id: 'tea', step_id: null, task_id: null, occurrence_at: null, items: null, vendor: { id: 'v-kettle', vendor_name: 'Kettle Nook', entity_id: 'P', instagram_tag: 'made.up_kettle24' }, routine: { name: 'Tea', timezone: NBO }, step: null, task: null },
  // Noodles BY OCCURRENCE: Monday's a vendor with no tag and no items; Tuesday's a vendor with a tag, and items; Wednesday holds no row.
  { id: 'pv-noodles-mon', routine_id: 'noodles', step_id: null, task_id: null, occurrence_at: new Date(at(MON, '13:00')), items: null, vendor: { id: 'v-broth', vendor_name: 'Broth Cart', entity_id: 'P', instagram_tag: null }, routine: { name: 'Noodles', timezone: NBO }, step: null, task: null },
  { id: 'pv-noodles-tue', routine_id: 'noodles', step_id: null, task_id: null, occurrence_at: new Date(at(TUE, '13:00')), items: NOODLE_ITEMS, vendor: { id: 'v-wok', vendor_name: 'Wok Window', entity_id: 'P', instagram_tag: 'made.up_wok' }, routine: { name: 'Noodles', timezone: NBO }, step: null, task: null },
];
/** Tuesday on — Monday has no stay. */
const STAYS: StayRow[] = [{ id: 'qh', place: 'Quillhaven, Ruritania', starts_on: TUE, ends_on: '2027-08-20' }];
const ACCOUNTS = [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Sport' }];
const BOOKS = [{ id: 'P', entityType: 'personal' }];

const record = (over: Partial<StopRecordRow> & { id: string; kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
const line = (r: StopRecordRow, activity: string, timeOfDay: string | null, durationMinutes: number | null): LedgerRecordInput => ({ record: r, routineId: 'breakfast', routineName: 'Breakfast', zone: NBO, role: 'place', activity, timeOfDay, durationMinutes });
const stop = (routineId: string, routineName: string, role: string, r: StopRecordRow): LedgerRecordInput => ({ record: r, routineId, routineName, zone: NBO, role, activity: null, timeOfDay: null, durationMinutes: null });
const EGGS_NOTES = 'window seat, cash only';
/** Monday's eggs: recorded with NOTES and no line of its own — though its plan holds planned items. */
const EGGS_MON = record({ id: 'r-eggs-1', kind: 'routine_line', target_id: 'eggs', occurrence_at: at(MON, '08:00'), done_at: at(MON, '08:20'), actual_cents: 700, rating: 4, notes: EGGS_NOTES, actual_minutes: 20 });
/** Tuesday's eggs: recorded with a line of its own, and no notes. */
const EGGS_TUE = record({ id: 'r-eggs-2', kind: 'routine_line', target_id: 'eggs', occurrence_at: at(TUE, '08:00'), done_at: at(TUE, '08:30'), actual_cents: 600, note: 'scrambled, no toast' });
/** Monday's juice: skipped with its reason — and notes besides. */
const JUICE_SKIPPED = record({ id: 'r-juice-1', kind: 'routine_line', target_id: 'juice', occurrence_at: at(MON, '08:00'), outcome: 'skipped', done_at: null, note: 'machine broken', notes: 'ask again on Friday' });
/** A one-off whose routine the loader no longer lists — a record no line matches. */
const KIOSK_DONE = record({ id: 'r-kiosk-1', kind: 'routine', target_id: 'kiosk', occurrence_at: at(MON, '10:00'), actual_cents: 150, notes: 'exact change' });
const RECORDS: LedgerRecordInput[] = [line(EGGS_MON, 'Eggs', '08:10', 25), line(EGGS_TUE, 'Eggs', '08:10', 25), line(JUICE_SKIPPED, 'Juice', null, null), stop('kiosk', 'Kiosk', 'place', KIOSK_DONE)];

const built = buildRoutineBudgetLines(ROUTINES, MON, WED);
const input = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: MON, to: WED, now: NOW, records: RECORDS, links: [], lines: built.lines, open: [], notPlaced: built.notPlaced, routines: WORDS, roles: ROLES, minutes: planMinutesOf(ROUTINES), vendors: VENDORS, stays: STAYS, accounts: ACCOUNTS, books: BOOKS, once: new Map(ROUTINES.map((r): [string, boolean] => [r.id, isOnceRRule(r.scheduleRrule)])), locations: new Map([...ROLES.keys()].map((id): [string, null] => [id, null])), subAccounts: [], ...over, // COALEVELS-01 (2026-11-27): the input grows additively — every routine's Location (none says one in this fixture) and the caller's sub-accounts (none) · PASTE-03 (2026-11-28): the input says its open occurrences — the lines that name their account and no amount; none here; EDIT-01 (2026-11-28): and each routine's one-off-ness — isOnceRRule over its own rule, as the answer builds it
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
/** What a call throws, in its own words — or the test fails. */
const thrownBy = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return assert.fail('nothing was thrown');
};
/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
/** How often a pattern stands in a text. */
const countOf = (text: string, re: RegExp): number => (text.match(re) ?? []).length;

// The six rows this file reads most: the two recorded eggs, the kiosk no line matches, and three rows with no record.
const eggsMon = rowAt(sheet, lineAt('eggs', MON, '08:00'));
const eggsTue = rowAt(sheet, lineAt('eggs', TUE, '08:00'));
const eggsWed = rowAt(sheet, lineAt('eggs', WED, '08:00'));
const kiosk = rowAt(sheet, stopAt('kiosk', MON, '10:00'));
const noodlesMon = rowAt(sheet, stopAt('noodles', MON, '13:00'));
const noodlesTue = rowAt(sheet, stopAt('noodles', TUE, '13:00'));
const noodlesWed = rowAt(sheet, stopAt('noodles', WED, '13:00'));
const teaWed = rowAt(sheet, stopAt('tea', WED, '16:00'));

// ── T1 · THE STOPS RULE READS THE NOTES (ruling A.1) ─────────────────────────

/** A done stop's body as a sender builds it, WITHOUT notes — Monday's eggs, as EGGS_MON holds them. */
const STOP_BODY = { kind: 'routine_line', id: 'eggs', instant: at(MON, '08:00'), outcome: 'done', done_at: at(MON, '08:20'), actual_cents: 700, rating: 4, note: null, actual_minutes: 20 } as const;
/** A skipped stop's body with its reason, without notes. */
const SKIP_BODY = { kind: 'routine_line', id: 'juice', instant: at(MON, '08:00'), outcome: 'skipped', note: 'machine broken' } as const;
/** The value of an accepted body — or the test fails with the refusal's words. */
const valueOf = (body: unknown): StopRecordValues => {
  const read = stopInput(body, NOW);
  if (!read.ok) return assert.fail(`refused: ${read.field} — ${read.message}`);
  return read.value;
};
/** A refusal's field and words — or the test fails. */
const stopRefusal = (body: unknown): [string, string] => {
  const read = stopInput(body, NOW);
  if (read.ok) return assert.fail('accepted');
  return [read.field, read.message];
};
/** Control characters a run of whitespace does not swallow — typed by their code, never raw. */
const CONTROLS: readonly (readonly [string, string])[] = [['\u0000', 'NUL'], ['\u0007', 'BEL'], ['\u001b', 'ESC'], ['\u007f', 'DEL'], ['\u0085', 'a C1 control'], ['\ud83d', 'a lone high half']];

test('T1 stopInput reads the notes after the note and before the minutes: absent, null and blank are none; trimmed, every run of whitespace one space; a control character and 2001 characters refused on `notes` in the rule’s words, 2000 lands; not a string refused; a skip may hold notes and never needs them', () => {
  // NONE: a body that names no notes, null, a blank — and the value always SAYS its notes.
  assert.equal(valueOf(STOP_BODY).notes, null, 'a body that names no notes writes none');
  assert.deepEqual(Object.keys(valueOf(STOP_BODY)), ['kind', 'id', 'instant', 'outcome', 'doneAt', 'actualCents', 'rating', 'note', 'notes', 'actualMinutes'], 'the notes after the note, before the minutes');
  for (const none of [undefined, null, '', '   ', ' \t \n ']) assert.equal(valueOf({ ...STOP_BODY, notes: none }).notes, null, `${JSON.stringify(none)} is none`);
  // TRIMMED, every run of whitespace one space — a tab and a line break among them, so the notes are one line.
  assert.equal(valueOf({ ...STOP_BODY, notes: '  window   seat,\tcash \n only ' }).notes, EGGS_NOTES);
  // A CONTROL CHARACTER: refused on `notes`, in the rule's words — wherever it stands.
  for (const [c, name] of CONTROLS) {
    assert.deepEqual(stopRefusal({ ...STOP_BODY, notes: `cash${c}only` }), ['notes', 'control characters are not notes'], name);
    assert.deepEqual(stopRefusal({ ...STOP_BODY, notes: `${c}` }), ['notes', 'control characters are not notes'], `${name}, alone`);
  }
  // THE LENGTH: NOTES_MAX is the column's own bound; counted after trimming and collapsing.
  assert.equal(NOTES_MAX, 2000);
  assert.deepEqual(stopRefusal({ ...STOP_BODY, notes: 'n'.repeat(NOTES_MAX + 1) }), ['notes', 'notes are at most 2000 characters (2001 given)']);
  assert.equal(valueOf({ ...STOP_BODY, notes: 'n'.repeat(NOTES_MAX) }).notes?.length, 2000, 'the edge is inside');
  assert.equal(valueOf({ ...STOP_BODY, notes: ` ${'a  '.repeat(1000)}` }).notes?.length, 1999, 'collapsed before it is counted — 3001 characters typed');
  // NOT A STRING.
  for (const raw of [7, 0, true, ['x'], { text: 'x' }]) assert.deepEqual(stopRefusal({ ...STOP_BODY, notes: raw }), ['notes', 'notes must be a string'], JSON.stringify(raw));
  // NEVER REQUIRED, done or skipped — and a skip may hold them. Its reason is still its note: notes are no reason.
  assert.equal(valueOf(SKIP_BODY).notes, null, 'a skip never needs notes');
  assert.deepEqual([valueOf({ ...SKIP_BODY, notes: 'ask again on Friday' }).outcome, valueOf({ ...SKIP_BODY, notes: 'ask again on Friday' }).notes], ['skipped', 'ask again on Friday'], 'and may hold them');
  assert.deepEqual(stopRefusal({ ...SKIP_BODY, note: null, notes: 'ask again on Friday' }), ['note', SKIP_REASON_WORDS], 'notes are no reason');
  // THE ORDER: the first bad field is named — the note, then the notes, then the minutes.
  const bad = { ...STOP_BODY, note: 7, notes: 7, actual_minutes: 'ten' };
  assert.equal(stopRefusal(bad)[0], 'note');
  assert.equal(stopRefusal({ ...bad, note: null })[0], 'notes');
  assert.equal(stopRefusal({ ...bad, note: null, notes: null })[0], 'actual_minutes');
  // THE RULE REFUSES MORE, NEVER LESS: the notes aside, a body with notes is read as the same body without them.
  assert.deepEqual({ ...valueOf({ ...STOP_BODY, notes: EGGS_NOTES }), notes: null }, valueOf(STOP_BODY));
  // In the source: the bound under the note's, the field after the note's, the notes read as the note is read.
  const rule = code(STOP_RULE);
  assert.match(rule, /export const NOTE_MAX = 280;\n\s*export const NOTES_MAX = 2000;/);
  assert.match(rule, /export type StopField = 'kind' \| 'id' \| 'instant' \| 'outcome' \| 'done_at' \| 'actual_cents' \| 'rating' \| 'note' \| 'notes' \| 'actual_minutes';/);
  assert.match(rule, /let notes: string \| null = null;\n\s*if \(given\(b\.notes\)\) \{\n\s*if \(typeof b\.notes !== 'string'\) return refuse\('notes', 'notes must be a string'\);\n\s*const n = b\.notes\.trim\(\)\.replace\(\/\\s\+\/g, ' '\);\n\s*if \(holdsControl\(n\)\) return refuse\('notes', 'control characters are not notes'\);\n\s*if \(n\.length > NOTES_MAX\) return refuse\('notes', `notes are at most \$\{NOTES_MAX\} characters \(\$\{n\.length\} given\)`\);\n\s*notes = n === '' \? null : n;\n\s*\}/);
  assert.ok(rule.indexOf("if (b.outcome === 'skipped' && note === null) return refuse('note', SKIP_REASON_WORDS);") < rule.indexOf('let notes: string | null = null;'), 'after the note and the skip’s reason');
  assert.ok(rule.indexOf('let notes: string | null = null;') < rule.indexOf('let actualMinutes: number | null = null;'), 'before the minutes');
  assert.match(rule, /return \{ ok: true, value: \{ kind: b\.kind, id: b\.id, instant, outcome: b\.outcome, doneAt, actualCents, rating, note, notes, actualMinutes \} \};/);
});

// ── T2 · THE ROW, AND `unchanged` (ruling A.1) ───────────────────────────────

test('T2 a record’s row carries its notes; `unchanged` is false when the notes alone differ — and a body that names no notes, written over a record that holds some, is a change', () => {
  // The row as the routes answer it, from the row as the database holds it.
  const held = { id: 'r-eggs-1', routine_id: null, step_id: 'eggs', occurrence_at: new Date(at(MON, '08:00')), outcome: 'done', done_at: new Date(at(MON, '08:20')), actual_cents: 700, rating: 4, note: null, notes: EGGS_NOTES, actual_minutes: 20 };
  assert.deepEqual(stopRecordRowOf(held), EGGS_MON);
  assert.equal(stopRecordRowOf({ ...held, notes: null }).notes, null);
  assert.deepEqual(Object.keys(stopRecordRowOf(held)), ['id', 'kind', 'target_id', 'occurrence_at', 'outcome', 'done_at', 'actual_cents', 'rating', 'note', 'notes', 'actual_minutes'], 'the notes after the note');
  // The same record written again changes nothing; the notes alone make a write a change.
  assert.equal(unchanged(EGGS_MON, valueOf({ ...STOP_BODY, notes: EGGS_NOTES })), true, 'every field as held');
  assert.equal(unchanged(EGGS_MON, valueOf({ ...STOP_BODY, notes: `  ${EGGS_NOTES}  ` })), true, 'as the rule keeps them — trimmed');
  assert.equal(unchanged(EGGS_MON, valueOf({ ...STOP_BODY, notes: 'window seat' })), false, 'the notes alone differ');
  assert.equal(unchanged(EGGS_MON, valueOf(STOP_BODY)), false, 'a record is written whole: a body that names no notes would clear the ones held');
  assert.equal(unchanged({ ...EGGS_MON, notes: null }, valueOf(STOP_BODY)), true, 'none held, none written');
  assert.equal(unchanged({ ...EGGS_MON, notes: null }, valueOf({ ...STOP_BODY, notes: 'first notes' })), false, 'none held, some written');
  // In the source: the three shapes hold the notes after the note; the row's reader carries them; the comparison reads them.
  const rule = code(STOP_RULE);
  assert.equal(countOf(rule, /readonly note: string \| null;\n\s*readonly notes: string \| null;\n\s*readonly (actual_minutes|actualMinutes): number \| null;/g), 3, 'StopRecordRow, StopRecordDbRow and StopRecordValues');
  assert.match(rule, /note: row\.note,\n\s*notes: row\.notes,\n\s*actual_minutes: row\.actual_minutes,/);
  assert.match(rule, /&& row\.note === v\.note\n\s*&& row\.notes === v\.notes\n\s*&& row\.actual_minutes === v\.actualMinutes;/);
});

// ── T3 · THE RECORD FORM'S RULE READS NOTES (ruling A.5) ─────────────────────

const BLANK_DRAFT: RecordDraft = { went: 'went', actual: '', stars: '', minutes: '', note: '', notes: '' };
/** A stop at a made-up address, its planned instant ten minutes after its occurrence. */
const ADDRESS = { kind: 'routine_line', id: 'eggs', instant: at(MON, '08:00') } as const;
const PLANNED = at(MON, '08:10');
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

test('T3 recordInput reads NOTES after DESCRIPTION: blank is none; trimmed, spaces collapsed; a control character and 2001 characters refused on `notes` in NOTES_CONTROL_WORDS and NOTES_LONG_WORDS, 2000 lands; never required, went or skipped; the body says its notes — and the stops rule reads that body the same', () => {
  // The body SAYS its notes, after the note — null from a blank box.
  assert.deepEqual(bodyOf(BLANK_DRAFT), { kind: 'routine_line', id: 'eggs', instant: at(MON, '08:00'), outcome: 'done', done_at: PLANNED, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null });
  assert.deepEqual(Object.keys(bodyOf(BLANK_DRAFT)), ['kind', 'id', 'instant', 'outcome', 'done_at', 'actual_cents', 'rating', 'note', 'notes', 'actual_minutes']);
  for (const blank of ['', '   ', ' \t ']) assert.equal(bodyOf({ ...BLANK_DRAFT, notes: blank }).notes, null, JSON.stringify(blank));
  // Typed: trimmed, its spaces collapsed — beside the note, never in its place.
  assert.deepEqual(bodyOf({ ...BLANK_DRAFT, note: ' scrambled,  no toast ', notes: '  window   seat,\tcash  only ' }), { kind: 'routine_line', id: 'eggs', instant: at(MON, '08:00'), outcome: 'done', done_at: PLANNED, actual_cents: null, rating: null, note: 'scrambled, no toast', notes: EGGS_NOTES, actual_minutes: null });
  // The two refusals, each on the NOTES box, each named by the column's own head word.
  for (const [c, name] of CONTROLS) assert.deepEqual(refusalOf({ ...BLANK_DRAFT, notes: `cash${c}only` }), ['notes', NOTES_CONTROL_WORDS], name);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, notes: 'n'.repeat(NOTES_MAX + 1) }), ['notes', NOTES_LONG_WORDS]);
  assert.equal(bodyOf({ ...BLANK_DRAFT, notes: 'n'.repeat(NOTES_MAX) }).notes?.length, 2000, 'the edge is inside');
  assert.equal(bodyOf({ ...BLANK_DRAFT, notes: ` ${'a  '.repeat(1000)}` }).notes?.length, 1999, 'collapsed before it is counted');
  assert.deepEqual([NOTES_LONG_WORDS, NOTES_CONTROL_WORDS], ['NOTES is at most 2000 characters', 'NOTES holds a control character — type it again without it']);
  assert.deepEqual([NOTES_LONG_WORDS, NOTES_CONTROL_WORDS], [`${headWordOf('notes')} is at most ${NOTES_MAX} characters`, `${headWordOf('notes')} holds a control character — type it again without it`], 'the column’s own head word');
  // NEVER REQUIRED — went or skipped. A skip's reason is still its DESCRIPTION: notes are no reason.
  assert.equal(bodyOf({ ...BLANK_DRAFT, went: 'skipped', note: 'machine broken' }).notes, null);
  assert.deepEqual([bodyOf({ ...BLANK_DRAFT, went: 'skipped', note: 'machine broken', notes: 'ask again on Friday' }).outcome, bodyOf({ ...BLANK_DRAFT, went: 'skipped', note: 'machine broken', notes: 'ask again on Friday' }).notes], ['skipped', 'ask again on Friday']);
  assert.deepEqual(refusalOf({ ...BLANK_DRAFT, went: 'skipped', notes: 'ask again on Friday' }), ['note', SKIP_REASON_WORDS]);
  // The boxes are read in their order — NOTES last, after DESCRIPTION: the first bad one is named.
  assert.deepEqual(RECORD_FIELDS, ['went', 'actual', 'stars', 'minutes', 'note', 'notes']);
  const bothLong: RecordDraft = { ...BLANK_DRAFT, note: 'n'.repeat(NOTE_MAX + 1), notes: 'n'.repeat(NOTES_MAX + 1) };
  assert.equal(refusalOf(bothLong)[0], 'note');
  assert.equal(refusalOf({ ...bothLong, note: '' })[0], 'notes');
  assert.equal(refusalOf({ ...bothLong, note: '', minutes: 'ten' })[0], 'minutes', 'a bad box before it is named first');
  // Its label is the column's own head word.
  assert.deepEqual([RECORD_FIELD_WORDS.notes, headWordOf('notes')], ['NOTES', 'NOTES']);
  assert.deepEqual(Object.keys(RECORD_FIELD_WORDS), [...RECORD_FIELDS], 'a label for every box');
  // THE ROUTE'S OWN RULE AGREES: a body this rule accepts is read by stopInput to the same notes; what this rule refuses, the route would refuse too.
  for (const notes of ['', EGGS_NOTES, 'n'.repeat(NOTES_MAX), '  spaced   out  ']) {
    const body = bodyOf({ ...BLANK_DRAFT, notes });
    assert.equal(valueOf(body).notes, body.notes, `${notes.length} characters typed`);
  }
  assert.equal(stopRefusal({ ...bodyOf(BLANK_DRAFT), notes: 'n'.repeat(NOTES_MAX + 1) })[0], 'notes');
  assert.equal(stopRefusal({ ...bodyOf(BLANK_DRAFT), notes: 'cash\u0007only' })[0], 'notes');
  // In the source: read after DESCRIPTION and the skip's reason, on the trimmed and collapsed text — controls, then length.
  const rules = code(RULES);
  assert.match(rules, /if \(draft\.went === SKIPPED_WORD && note === ''\) return refuseRecord\('note', SKIP_REASON_WORDS\);\n\s*const notes = draft\.notes\.trim\(\)\.replace\(\/\\s\+\/g, ' '\);\n\s*if \(holdsControl\(notes\)\) return refuseRecord\('notes', NOTES_CONTROL_WORDS\);\n\s*if \(notes\.length > NOTES_MAX\) return refuseRecord\('notes', NOTES_LONG_WORDS\);\n\s*return \{/);
  assert.match(rules, /note: note === '' \? null : note, notes: notes === '' \? null : notes, actual_minutes: actualMinutes \},/);
  assert.match(rules, /export const NOTES_LONG_WORDS = `\$\{headWordOf\('notes'\)\} is at most \$\{NOTES_MAX\} characters`;\n\s*export const NOTES_CONTROL_WORDS = `\$\{headWordOf\('notes'\)\} holds a control character — type it again without it`;/);
});

// ── T4 · THE DRAFT, AND "+ EXPENSE" (ruling A.5) ─────────────────────────────

test('T4 recordDraftOf reads the held record’s notes — a blank box with none — and keeps ONE argument; a draft built from a held record and saved untouched is `unchanged` against it, notes and all; recordBody says notes null', () => {
  assert.deepEqual(recordDraftOf(null), BLANK_DRAFT);
  assert.deepEqual(recordDraftOf(EGGS_MON), { went: 'went', actual: '7.00', stars: '4', minutes: '20', note: '', notes: EGGS_NOTES });
  assert.deepEqual(recordDraftOf(EGGS_TUE), { went: 'went', actual: '6.00', stars: '', minutes: '', note: 'scrambled, no toast', notes: '' }, 'no notes is a blank box');
  assert.deepEqual(recordDraftOf(JUICE_SKIPPED), { went: 'skipped', actual: '', stars: '', minutes: '', note: 'machine broken', notes: 'ask again on Friday' });
  assert.deepEqual(Object.keys(recordDraftOf(null)), [...RECORD_FIELDS], 'a box for every field, in the fields’ order');
  assert.equal(recordDraftOf.length, 1, 'ONE argument — the held record');
  // Saved untouched, a held record's draft writes that record again: nothing changes — its notes ride with the save.
  for (const held of [EGGS_MON, EGGS_TUE, JUICE_SKIPPED, KIOSK_DONE]) {
    const body = bodyOf(recordDraftOf(held), { plannedAt: held.occurrence_at, held });
    assert.equal(body.notes, held.notes, `${held.id}: the notes as held`);
    assert.equal(unchanged(held, valueOf(body)), true, `${held.id}: saved untouched`);
  }
  // Edited in the NOTES box alone, it is a change.
  assert.equal(unchanged(EGGS_MON, valueOf(bodyOf({ ...recordDraftOf(EGGS_MON), notes: 'window seat' }, { plannedAt: PLANNED, held: EGGS_MON }))), false);
  assert.equal(unchanged(EGGS_MON, valueOf(bodyOf({ ...recordDraftOf(EGGS_MON), notes: '' }, { plannedAt: PLANNED, held: EGGS_MON }))), false, 'cleared in the box');
  // "+ expense" has no NOTES box: the body of the record it writes says none.
  const expense: ExpenseValues = { day: MON, time: '10:00', allDay: false, zone: NBO, instant: at(MON, '10:00'), name: 'Kiosk', amount: '1.50', coa: '6150', bookId: 'P', location: null, vendor: { kind: 'none' }, actualCents: 150, rating: null, note: 'one coffee', ahead: false, minutes: null, tag: null, notes: null, logged: null }; // COALEVELS-01 (2026-11-27): an expense's value says its stop's Location — none here · PASTE-03 (2026-11-28): the value says whether the stop is all day — not here: a TIME is typed; SHEET-01 (2026-11-28): and the four new boxes' readings — none
  assert.deepEqual(recordBody(expense, 'line-1'), { kind: 'routine_line', id: 'line-1', instant: at(MON, '10:00'), outcome: 'done', done_at: at(MON, '10:00'), actual_cents: 150, rating: null, note: 'one coffee', notes: null, actual_minutes: null });
  assert.deepEqual(Object.keys(recordBody(expense, 'line-1')), Object.keys(bodyOf(BLANK_DRAFT)), 'the one writer’s body, from either form');
  // In the source.
  const rules = code(RULES);
  assert.match(rules, /export function recordDraftOf\(held: StopRecordRow \| null\): RecordDraft \{\n\s*if \(held === null\) return \{ went: WENT_WORD, actual: '', stars: '', minutes: '', note: '', notes: '' \};/);
  assert.match(rules, /note: held\.note === null \? '' : held\.note,\n\s*notes: held\.notes === null \? '' : held\.notes,\n\s*\};/);
  assert.match(rules, /rating: v\.rating, note: v\.note, notes: v\.notes, actual_minutes: v\.logged \}\);/); // SHEET-01 (2026-11-28): NOTES and LOGGED MIN ride the record
});

// ── T5 · THE DRAFT A ROW'S FORM OPENS WITH (ruling B.2) ──────────────────────

test('T5 rowDraftOf: a row with a record → that record’s draft; a plan row with planned items → the blank draft with DESCRIPTION holding them; a plan row with none → blank — and nothing is written by opening', () => {
  // A row that holds a record: the record's draft — its own line and its own notes. What was planned never stands in the box.
  assert.deepEqual(rowDraftOf(eggsMon, taken(recording[eggsMon.key], 'Monday’s eggs').held), recordDraftOf(EGGS_MON));
  assert.equal(rowDraftOf(eggsMon, EGGS_MON).note, '', 'the record has no line of its own: the box is blank, whatever the plan holds');
  assert.deepEqual(rowDraftOf(eggsTue, EGGS_TUE), { went: 'went', actual: '6.00', stars: '', minutes: '', note: 'scrambled, no toast', notes: '' });
  assert.deepEqual(rowDraftOf(kiosk, KIOSK_DONE), recordDraftOf(KIOSK_DONE));
  // A plan row that holds planned items: the blank draft, DESCRIPTION holding them — at either grain.
  assert.deepEqual(rowDraftOf(eggsWed, null), { ...BLANK_DRAFT, note: EGGS_ITEMS }, 'the every-occurrence grain');
  assert.deepEqual(rowDraftOf(noodlesTue, null), { ...BLANK_DRAFT, note: NOODLE_ITEMS }, 'the occurrence’s grain');
  for (const row of [eggsWed, noodlesTue]) assert.equal(taken(recording[row.key], row.key).held, null, 'the entry holds no record');
  // A plan row with none: blank — a vendor with no items, an occurrence whose row holds none, no vendor at all.
  for (const row of [teaWed, noodlesMon, noodlesWed]) assert.deepEqual(rowDraftOf(row, null), BLANK_DRAFT, row.key);
  // Every row of the sheet opens through it with its entry's own record: a recorded row never with planned items, a plan row never with a record's.
  for (const row of sheet) {
    const entry = recording[row.key];
    if (!entry.takes) continue;
    const draft = rowDraftOf(row, entry.held);
    assert.equal(draft.note, isPlan(row) ? (row.plannedItems ?? '') : (row.note ?? ''), `${row.key}: DESCRIPTION`);
    assert.equal(draft.notes, row.notes ?? '', `${row.key}: NOTES`);
  }
  // What the form opens with is never refused for its length: planned items are no longer than a note may be.
  assert.ok(PLANNED_ITEMS_MAX <= NOTE_MAX, `${PLANNED_ITEMS_MAX} ≤ ${NOTE_MAX}`);
  // Saved untouched once its time has come, the opening draft records the planned items as the record's own line.
  const later = new Date(at(WED, '09:00'));
  const wednesday = ledgerOf(input({ now: later }));
  const row = rowAt(wednesday.sheet, lineAt('eggs', WED, '08:00'));
  const entry = taken(wednesday.recording[row.key], 'Wednesday’s eggs');
  assert.deepEqual(recordInput(rowDraftOf(row, entry.held), row.address, entry, later), { ok: true, body: { kind: 'routine_line', id: 'eggs', instant: at(WED, '08:00'), outcome: 'done', done_at: at(WED, '08:10'), actual_cents: null, rating: null, note: EGGS_ITEMS, notes: null, actual_minutes: null } });
  // In the source: after recordDraftOf, two arguments, and nothing but the two drafts.
  const rules = code(RULES);
  assert.equal(rowDraftOf.length, 2);
  assert.match(rules, /export function rowDraftOf\(row: LedgerSheetRow, held: StopRecordRow \| null\): RecordDraft \{\n\s*if \(held !== null\) return recordDraftOf\(held\);\n\s*const blank = recordDraftOf\(null\);\n\s*return row\.id === null && row\.plannedItems !== null \? \{ \.\.\.blank, note: row\.plannedItems \} : blank;\n\}/);
  assert.ok(rules.indexOf('export function recordDraftOf(') < rules.indexOf('export function rowDraftOf('), 'after recordDraftOf');
});

// ── T6 · THE RULE: A VENDOR'S TAG ON ITS ROWS (ruling B.2) ───────────────────

test('T6 ledgerOf: a vendor’s tag stands on the recorded row of its line and on the plan rows of its lines, held without its @; null with no line, with no vendor, and with a vendor that has none — read off the plan-vendor rows, by the vendor’s id', () => {
  assert.equal(sheet.length, 16, 'four recorded rows and twelve without a record');
  // The recorded rows — `rows`, newest day first — each with its vendor, its tag, its own line and its notes.
  assert.deepEqual(ledger.rows.map((r) => [r.id, r.vendor, r.instagramTag, r.note, r.notes]), [
    ['r-eggs-2', 'Yolk & Rye', 'made.up_yolk', 'scrambled, no toast', null],
    ['r-juice-1', null, null, 'machine broken', 'ask again on Friday'],
    ['r-eggs-1', 'Yolk & Rye', 'made.up_yolk', null, EGGS_NOTES],
    ['r-kiosk-1', null, null, null, 'exact change'],
  ], 'the matched line’s vendor’s tag · a line with no vendor · the same vendor on another day · a record no line matches');
  for (const row of ledger.rows) assert.equal(rowAt(sheet, row.key), row, `${row.id}: the sheet’s row IS the row of \`rows\``);
  // The rows with no record — the sheet's order — each with its vendor, its tag and its planned items; a note and notes are a record's.
  assert.deepEqual(sheet.filter(isPlan).map((r) => [r.day, r.description, r.vendor, r.instagramTag, r.plannedItems, r.note, r.notes]), [
    [MON, 'Noodles', 'Broth Cart', null, null, null, null],
    [MON, 'Tea', 'Kettle Nook', 'made.up_kettle24', null, null, null],
    [MON, 'Sauna', null, null, null, null, null],
    [TUE, 'Juice', null, null, null, null, null],
    [TUE, 'Noodles', 'Wok Window', 'made.up_wok', NOODLE_ITEMS, null, null],
    [TUE, 'Tea', 'Kettle Nook', 'made.up_kettle24', null, null, null],
    [TUE, 'Sauna', null, null, null, null, null],
    [WED, 'Juice', null, null, null, null, null],
    [WED, 'Eggs', 'Yolk & Rye', 'made.up_yolk', EGGS_ITEMS, null, null],
    [WED, 'Noodles', null, null, null, null, null],
    [WED, 'Tea', 'Kettle Nook', 'made.up_kettle24', null, null, null],
    [WED, 'Sauna', null, null, null, null, null],
  ]);
  // The tag follows the VENDOR, never the plan: a row prints a tag exactly when it prints a vendor that has one.
  const tagOfVendor = new Map(VENDORS.map((v) => [v.vendor.vendor_name, v.vendor.instagram_tag]));
  for (const row of sheet) assert.equal(row.instagramTag, row.vendor === null ? null : tagOfVendor.get(row.vendor), `${row.key}: its vendor’s tag`);
  assert.equal(noodlesMon.vendor, 'Broth Cart', 'a vendor…');
  assert.equal(noodlesMon.instagramTag, null, '…that has no tag: null, said');
  // The fields' places: the tag after the vendor on either row; notes after the note; a plan row's planned items between them. A recorded row holds no planned items.
  assert.deepEqual(Object.keys(eggsMon), ['id', 'key', 'address', 'match', 'day', 'time', 'place', 'book', 'location', 'segments', 'coa', 'vendor', 'instagramTag', 'description', 'rating', 'note', 'notes', 'cents', 'budgetState', 'outcome', 'actualCents', 'varianceCents', 'plannedMinutes', 'loggedMinutes']); // COALEVELS-01 (2026-11-27): location and segments after book — the row's Location and its account's levels
  assert.deepEqual(Object.keys(eggsWed), ['id', 'key', 'address', 'match', 'day', 'time', 'place', 'book', 'location', 'segments', 'coa', 'vendor', 'instagramTag', 'description', 'rating', 'note', 'plannedItems', 'notes', 'cents', 'outcome', 'actualCents', 'varianceCents', 'plannedMinutes', 'loggedMinutes', 'allDay', 'went']); // COALEVELS-01 (2026-11-27): the same two, in the same place
  // Wire-shaped: strings, numbers, booleans and nulls — the sheet round-trips JSON unchanged.
  assert.deepEqual(JSON.parse(JSON.stringify(sheet)), sheet);
  // A task's vendor row is on no row of this sheet, and changes none.
  const taskRow: LedgerVendorRow = { id: 'pv-task', routine_id: null, step_id: null, task_id: 'task-1', occurrence_at: null, items: 'a ream of paper', vendor: { id: 'v-paper', vendor_name: 'Paper Shed', entity_id: 'P', instagram_tag: 'made.up_paper' }, routine: null, step: null, task: { title: 'Stock up' } };
  assert.deepEqual(ledgerOf(input({ vendors: [...VENDORS, taskRow] })).sheet, sheet);
  // In the source: the tag by the vendor's id, read off the rows handed in; a recorded row's from its matched line, null with none.
  const rules = code(RULES);
  assert.match(rules, /for \(const v of input\.vendors\) \{\n\s*tagByVendor\.set\(v\.vendor\.id, v\.vendor\.instagram_tag\);/);
  assert.match(rules, /vendor: line !== null && line\.vendor !== null \? line\.vendor\.name : null,\n\s*instagramTag: line === null \? null : tagOf\(line, key\),/);
  assert.match(rules, /vendor: l\.vendor !== null \? l\.vendor\.name : null,\n\s*instagramTag: tagOf\(l, key\),/);
  assert.match(rules, /export type LedgerVendorRow = PlanVendorRow & \{ readonly items: string \| null; readonly vendor: PlanVendorRow\['vendor'\] & \{ readonly instagram_tag: string \| null \} \};/);
  assert.match(rules, /readonly vendors: readonly LedgerVendorRow\[\];/);
  // The Budget's own row is as it was: it holds neither.
  assert.doesNotMatch(code(PLAN_LINES), /\bitems\b|instagram/, 'planLines.ts PlanVendorRow gains nothing');
});

// ── T7 · THE RULE: PLANNED ITEMS BY GRAIN, THE NOTES, AND WHAT IS NEVER GUESSED (ruling B.2) ──

/** A vendor row as a read that did not select `items` would hand it — the field absent. The type forbids it; the rule must not print it. */
const withoutItems = (row: LedgerVendorRow): LedgerVendorRow => {
  const copy: Record<string, unknown> = { ...row };
  delete copy.items;
  return copy as unknown as LedgerVendorRow;
};
/** A vendor row as a read that did not select the vendor's `instagram_tag` would hand it. */
const withoutTag = (row: LedgerVendorRow): LedgerVendorRow => {
  const vendor: Record<string, unknown> = { ...row.vendor };
  delete vendor.instagram_tag;
  return { ...row, vendor } as unknown as LedgerVendorRow;
};
const vendorsWith = (id: string, change: (row: LedgerVendorRow) => LedgerVendorRow): LedgerVendorRow[] => VENDORS.map((v) => (v.id === id ? change(v) : v));

test('T7 ledgerOf: a plan row’s planned items are its vendor row’s at that row’s own grain — every occurrence, or this one — null with none; a recorded row’s notes are its record’s; a line whose vendor the rows do not hold is thrown by name, never a blank', () => {
  // EVERY OCCURRENCE: the one row's items stand on every occurrence that has no record.
  const unrecorded = ledgerOf(input({ records: [] })).sheet;
  assert.deepEqual([MON, TUE, WED].map((day) => { const row = rowAt(unrecorded, lineAt('eggs', day, '08:00')); return isPlan(row) ? row.plannedItems : 'recorded'; }), [EGGS_ITEMS, EGGS_ITEMS, EGGS_ITEMS]);
  // …and null when that row holds none.
  assert.deepEqual([MON, TUE, WED].map((day) => { const row = rowAt(sheet, stopAt('tea', day, '16:00')); return isPlan(row) ? [row.vendor, row.plannedItems] : 'recorded'; }), [['Kettle Nook', null], ['Kettle Nook', null], ['Kettle Nook', null]]);
  // THIS OCCURRENCE: each occurrence reads its own row — items, none held, no row.
  assert.deepEqual([noodlesMon, noodlesTue, noodlesWed].map((row) => (isPlan(row) ? [row.vendor, row.plannedItems] : 'recorded')), [['Broth Cart', null], ['Wok Window', NOODLE_ITEMS], [null, null]]);
  // The same line planned BY OCCURRENCE instead: only that occurrence carries the vendor, its tag and its items.
  const byOccurrence = ledgerOf(input({ records: [], vendors: vendorsWith('pv-eggs', (v) => ({ ...v, occurrence_at: new Date(at(TUE, '08:00')) })) })).sheet;
  assert.deepEqual([MON, TUE, WED].map((day) => { const row = rowAt(byOccurrence, lineAt('eggs', day, '08:00')); return isPlan(row) ? [row.vendor, row.instagramTag, row.plannedItems] : 'recorded'; }), [[null, null, null], ['Yolk & Rye', 'made.up_yolk', EGGS_ITEMS], [null, null, null]]);
  // A RECORDED ROW holds no planned items — its plan's stand on no field of it; its notes are its record's.
  for (const row of ledger.rows) assert.equal('plannedItems' in row, false, `${row.id}: no planned items on a recorded row`);
  assert.deepEqual([eggsMon.notes, eggsTue.notes, kiosk.notes], [EGGS_NOTES, null, 'exact change']);
  for (const row of sheet.filter(isPlan)) assert.equal(row.notes, null, `${row.key}: notes are a record’s`);
  // NEVER GUESSED. A line's vendor comes from the plan-vendor rows; rows that hold that vendor without its tag, or without its items —
  // a read that did not select them — are this rule's error, thrown by the line's name. With the field said null, the rows above read null.
  assert.equal(thrownBy(() => ledgerOf(input({ vendors: vendorsWith('pv-eggs', withoutTag) }))),
    `ledger: line ${lineAt('eggs', MON, '08:00')} names vendor v-yolk, whose Instagram tag the plan-vendor rows do not hold — a tag is a text or null, never guessed`, 'a recorded row’s line');
  assert.equal(thrownBy(() => ledgerOf(input({ vendors: vendorsWith('pv-noodles-mon', withoutTag) }))),
    `ledger: line ${stopAt('noodles', MON, '13:00')} names vendor v-broth, whose Instagram tag the plan-vendor rows do not hold — a tag is a text or null, never guessed`, 'a plan row’s line');
  assert.equal(thrownBy(() => ledgerOf(input({ vendors: vendorsWith('pv-eggs', withoutItems) }))),
    `ledger: line ${lineAt('eggs', WED, '08:00')} holds a vendor for every occurrence, whose planned items the plan-vendor rows do not hold — planned items are a text or null, never guessed`, 'the every-occurrence grain');
  assert.equal(thrownBy(() => ledgerOf(input({ vendors: vendorsWith('pv-noodles-tue', withoutItems) }))),
    `ledger: line ${stopAt('noodles', TUE, '13:00')} holds a vendor at ${at(TUE, '13:00')}, whose planned items the plan-vendor rows do not hold — planned items are a text or null, never guessed`, 'the occurrence’s grain');
  // In the source: the items by the plan and its grain — '' for every occurrence, else the occurrence's instant; a plan row reads them at its vendor's grain.
  const rules = code(RULES);
  assert.match(rules, /const grainKeyOf = \(plan: string, grain: string\): string => `\$\{plan\}@\$\{grain\}`;/);
  assert.match(rules, /const plan = v\.step_id !== null \? planKeyOf\('routine_line', v\.step_id\) : v\.routine_id !== null \? planKeyOf\('routine', v\.routine_id\) : null;\n\s*if \(plan !== null\) itemsByGrain\.set\(grainKeyOf\(plan, v\.occurrence_at === null \? '' : v\.occurrence_at\.toISOString\(\)\), v\.items\);/);
  assert.match(rules, /const items = itemsByGrain\.get\(grainKeyOf\(plan, vendor\.grain === 'every' \? '' : instant\)\);/);
  assert.match(rules, /note: null,\n\s*plannedItems: plannedItemsOf\(l\.vendor, planKeyOf\(kind, id\), instant, key\),\n\s*notes: null,/);
  assert.match(rules, /note: r\.record\.note,\n\s*notes: r\.record\.notes,/);
  assert.equal(countOf(rules, /never guessed`\);/g), 2, 'the two throws — and no default beside them');
  assert.doesNotMatch(rules, /tagByVendor\.get\([^)]*\) \?\?|itemsByGrain\.get\([^)]*\)\) \?\?/, 'a lookup that misses is never read as none');
});

// ── T8 · THE TWENTY-THREE COLUMNS (ruling B.2) ───────────────────────────────

test('T8 the columns: twenty-five in the ruled order (COALEVELS-01, 2026-11-27 — twenty-three until then) — INSTAGRAM TAG after VENDOR, NOTES the last column, ITEMS (the description) after TYPE; the tag a VALUE column, notes a TEXT column, through the kinds, the filters map and the spec', () => {
  assert.deepEqual(LEDGER_HEAD_WORDS, ['DAY', 'DATE', 'START', 'END', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'INSTAGRAM TAG', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'COA', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER', 'NOTES']); // COALEVELS-01 (2026-11-27): his sheet's words and order — REGION and LOCATION new; CATEGORY, ENTITY, TYPE, ITEMS and COA where ACCOUNT NAME, BOOK, SUB ACCOUNT NAME, DESCRIPTION and ACCOUNT stood
  assert.deepEqual(LEDGER_COLUMNS, ['day', 'date', 'start', 'end', 'city', 'region', 'country', 'location', 'accountName', 'book', 'subAccountName', 'description', 'vendor', 'instagramTag', 'went', 'stars', 'plannedMinutes', 'loggedMinutes', 'account', 'budget', 'actual', 'variance', 'match', 'underOver', 'notes']); // COALEVELS-01 (2026-11-27): no key renamed — region and location new, the rest in the sheet's order
  assert.deepEqual([LEDGER_COLUMNS.length, LEDGER_HEAD_WORDS.length], [25, 25]); // COALEVELS-01 (2026-11-27): twenty-five — twenty-three until then
  assert.deepEqual([headWordOf('instagramTag'), headWordOf('notes')], ['INSTAGRAM TAG', 'NOTES']);
  // Each where the sheet has it: the tag right after the vendor; the description (ITEMS) right after the TYPE; the notes the last column. COALEVELS-01 (2026-11-27): the notes stood right after the description until then.
  assert.equal(LEDGER_COLUMNS.indexOf('instagramTag'), LEDGER_COLUMNS.indexOf('vendor') + 1);
  assert.equal(LEDGER_COLUMNS.indexOf('description'), LEDGER_COLUMNS.indexOf('subAccountName') + 1); // COALEVELS-01 (2026-11-27): re-pointed — ITEMS follows TYPE; NOTES is the last column (the next line), no longer the description's neighbour
  assert.equal(LEDGER_COLUMNS.indexOf('notes'), LEDGER_COLUMNS.length - 1);
  // Without the two, the twenty-three stand in the sheet's order (COALEVELS-01 (2026-11-27): twenty-one until then, in the app's words).
  assert.deepEqual(LEDGER_HEAD_WORDS.filter((h) => h !== 'INSTAGRAM TAG' && h !== 'NOTES'), ['DAY', 'DATE', 'START', 'END', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'WENT', 'STARS', 'PLANNED MIN', 'LOGGED MIN', 'COA', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH', 'UNDER / OVER']);
  // The kinds: the tag filters by a checklist of the tags present, the notes by a contains-text.
  assert.deepEqual([columnKind('instagramTag'), columnKind('notes'), columnKind('description'), columnKind('vendor')], ['value', 'text', 'text', 'value']);
  assert.equal(VALUE_COLUMNS[VALUE_COLUMNS.indexOf('vendor') + 1], 'instagramTag', 'after vendor, among the VALUE columns');
  assert.equal(VALUE_COLUMNS.length, 19); // COALEVELS-01 (2026-11-27): region and location joined the VALUE columns — seventeen until then
  assert.deepEqual(TEXT_COLUMNS, ['description', 'notes']);
  assert.deepEqual(LEDGER_COLUMNS.map(columnKind), ['value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'text', 'value', 'value', 'value', 'value', 'value', 'value', 'value', 'money', 'money', 'money', 'money', 'value', 'text']); // COALEVELS-01 (2026-11-27): the kinds follow the columns — region and location VALUE columns, the description's TEXT after the TYPE, the account before the money
  // The filters map: one per column, each of its kind's shape.
  assert.deepEqual(Object.keys(NO_COLUMN_FILTERS).sort(), [...LEDGER_COLUMNS].sort());
  assert.equal(NO_COLUMN_FILTERS.instagramTag, NO_VALUE_FILTER);
  assert.equal(NO_COLUMN_FILTERS.notes, NO_TEXT_FILTER);
  // The spec: every column's words, sort key and CSV field are the rule's own, for either kind of row; a TEXT column's text too.
  assert.deepEqual(LEDGER_TABLE.map((c) => c.key), [...LEDGER_COLUMNS]);
  assert.deepEqual(LEDGER_TABLE.map((c) => c.label), [...LEDGER_HEAD_WORDS]);
  assert.deepEqual(LEDGER_TABLE.filter((c) => c.kind === 'text').map((c) => c.key), ['description', 'notes']);
  for (const row of sheet) {
    for (const c of LEDGER_TABLE) {
      assert.equal(c.words(row), cellWordsOf(row, c.key), `${c.key} words of ${row.key}`);
      assert.deepEqual(c.sortKey(row), sortKeyOf(row, c.key), `${c.key} sort key of ${row.key}`);
      assert.equal(c.csv(row), LEDGER_CSV[c.key](row), `${c.key} csv of ${row.key}`);
      if (c.kind === 'text') assert.equal(c.text(row), cellTextOf(row, c.key === 'notes' ? 'notes' : 'description'), `${c.key} text of ${row.key}`);
    }
  }
  // A row's twenty-five cells, whole (COALEVELS-01 (2026-11-27): a blank REGION and LOCATION — no place names a region and no routine says a Location in this fixture; the COA cell is the row's whole code): a recorded row with a tag and notes, and a row with no record that holds a tag and planned items.
  assert.deepEqual(LEDGER_COLUMNS.map((c) => cellWordsOf(eggsMon, c)), ['Monday', MON, '08:10', '08:35', BLANK, BLANK, BLANK, BLANK, 'Dining Out', 'Personal', 'Eggs', BLANK, 'Yolk & Rye', '@made.up_yolk', 'went', '★★★★', '25', '20', 'P-6150', '$6.50', '$7', '+$0.50', BLANK, 'over', EGGS_NOTES]);
  assert.deepEqual(LEDGER_COLUMNS.map((c) => cellWordsOf(eggsWed, c)), ['Wednesday', WED, '08:10', '08:35', 'Quillhaven', BLANK, 'Ruritania', BLANK, 'Dining Out', 'Personal', 'Eggs', EGGS_ITEMS, 'Yolk & Rye', '@made.up_yolk', 'planned', BLANK, '25', BLANK, 'P-6150', '$6.50', BLANK, BLANK, BLANK, BLANK, BLANK]);
});

// ── T9 · WHAT THE THREE CELLS SAY (ruling B.2) ───────────────────────────────

/** A column's four faces of a row: the cell's words, the sort key's text, the CSV field — and, for a TEXT column, the text its filter reads. */
const facesOf = (row: LedgerSheetRow, column: 'description' | 'notes'): [string, string | null, string | null, string] => {
  const key = sortKeyOf(row, column);
  return [cellWordsOf(row, column), cellTextOf(row, column), key === null ? null : key.kind === 'text' ? key.t : String(key.n), LEDGER_CSV[column](row)];
};

test('T9 DESCRIPTION’s words, text, sort key and CSV field are a plan row’s planned items and a recorded row’s note — never one standing in for the other; NOTES are the record’s; the tag’s cell and CSV field carry the @, the row and its sort key do not', () => {
  // DESCRIPTION — one rule, four readers.
  assert.deepEqual(facesOf(eggsWed, 'description'), [EGGS_ITEMS, EGGS_ITEMS, EGGS_ITEMS, EGGS_ITEMS], 'a row with no record: what its plan holds as planned');
  assert.deepEqual(facesOf(noodlesTue, 'description'), [NOODLE_ITEMS, NOODLE_ITEMS, NOODLE_ITEMS, NOODLE_ITEMS]);
  assert.deepEqual(facesOf(eggsTue, 'description'), ['scrambled, no toast', 'scrambled, no toast', 'scrambled, no toast', 'scrambled, no toast'], 'a recorded row: the record’s own line — not the plan’s items');
  assert.deepEqual(facesOf(eggsMon, 'description'), [BLANK, null, null, ''], 'a recorded row with no line of its own is BLANK — whatever was planned');
  assert.deepEqual(facesOf(teaWed, 'description'), [BLANK, null, null, ''], 'a plan row with nothing planned');
  assert.deepEqual([descriptionOf(eggsWed), descriptionOf(eggsTue), descriptionOf(eggsMon), descriptionOf(teaWed)], [EGGS_ITEMS, 'scrambled, no toast', null, null]);
  for (const row of sheet) assert.equal(descriptionOf(row), isPlan(row) ? row.plannedItems : row.note, row.key);
  // "Planned" is said of a row with no record that holds planned items — and of no other.
  assert.deepEqual(sheet.filter(plannedDescription).map((r) => r.key), [stopAt('noodles', TUE, '13:00'), lineAt('eggs', WED, '08:00')]);
  for (const row of ledger.rows) assert.equal(plannedDescription(row), false, `${row.id}: a recorded row is never drawn as planned`);
  assert.equal(PLANNED_ITEMS_TITLE_WORDS, "planned — the record's own line stands here once this stop is recorded");
  // NOTES — the record's; a row with no record has none.
  assert.deepEqual(facesOf(eggsMon, 'notes'), [EGGS_NOTES, EGGS_NOTES, EGGS_NOTES, EGGS_NOTES]);
  assert.deepEqual(facesOf(eggsTue, 'notes'), [BLANK, null, null, ''], 'a record with none');
  assert.deepEqual(facesOf(eggsWed, 'notes'), [BLANK, null, null, ''], 'a row with no record');
  // THE TAG — the row holds it without its @; the cell and the CSV field print it with; the sort reads the tag itself.
  assert.equal(eggsMon.instagramTag, 'made.up_yolk');
  assert.deepEqual([cellWordsOf(eggsMon, 'instagramTag'), LEDGER_CSV.instagramTag(eggsMon), sortKeyOf(eggsMon, 'instagramTag')], ['@made.up_yolk', '@made.up_yolk', { kind: 'text', t: 'made.up_yolk' }]);
  assert.deepEqual([cellWordsOf(eggsWed, 'instagramTag'), LEDGER_CSV.instagramTag(eggsWed)], ['@made.up_yolk', '@made.up_yolk'], 'on the plan row of its line');
  assert.deepEqual([cellWordsOf(noodlesMon, 'instagramTag'), LEDGER_CSV.instagramTag(noodlesMon), sortKeyOf(noodlesMon, 'instagramTag')], [BLANK, '', null], 'a vendor with no tag: "—" on screen, an empty field in the file');
  assert.deepEqual([tagCellWords('made.up_yolk'), tagCellWords(null), instagramTagWords('made.up_yolk')], ['@made.up_yolk', BLANK, '@made.up_yolk']);
  for (const row of sheet) assert.equal(LEDGER_CSV.instagramTag(row), cellWordsOf(row, 'instagramTag') === BLANK ? '' : cellWordsOf(row, 'instagramTag'), `${row.key}: the screen and the file agree`);
  // THE CHECKLIST of the tags present, each with its count, in the column's own order — a blank last.
  assert.deepEqual(columnValues(sheet, 'instagramTag'), [{ key: '@made.up_kettle24', count: 3 }, { key: '@made.up_wok', count: 1 }, { key: '@made.up_yolk', count: 3 }, { key: BLANK, count: 9 }]);
  const keep = (over: Partial<typeof NO_COLUMN_FILTERS>): LedgerSheetRow[] => applyColumnFilters(sheet, { ...NO_COLUMN_FILTERS, ...over });
  assert.deepEqual(keep({ instagramTag: { dropped: [BLANK, '@made.up_kettle24'] } }).map((r) => r.key), [lineAt('eggs', MON, '08:00'), lineAt('eggs', TUE, '08:00'), stopAt('noodles', TUE, '13:00'), lineAt('eggs', WED, '08:00')]);
  // THE CONTAINS-TEXT reads what the cell prints: DESCRIPTION a plan row's planned items and a recorded row's line; NOTES the record's notes.
  assert.deepEqual(keep({ description: { contains: 'TOAST' } }).map((r) => r.key), [lineAt('eggs', TUE, '08:00'), lineAt('eggs', WED, '08:00')], 'Tuesday’s record says it, Wednesday’s plan holds it — Monday’s record says nothing, though its plan holds it');
  assert.deepEqual(keep({ description: { contains: 'noodles' } }).map((r) => r.key), [stopAt('noodles', TUE, '13:00')], 'the items planned — not the stop’s name, which is another column’s');
  assert.deepEqual(keep({ notes: { contains: ' cash ' } }).map((r) => r.key), [lineAt('eggs', MON, '08:00')]);
  assert.deepEqual(keep({ notes: { contains: 'a' } }).map((r) => r.key), [lineAt('juice', MON, '08:00'), lineAt('eggs', MON, '08:00'), stopAt('kiosk', MON, '10:00')], 'every row whose record holds notes with an a — a blank left out');
  // THE SORT: by the text, a blank last in both directions.
  const sorted = (column: 'notes' | 'instagramTag' | 'description', direction: 'asc' | 'desc'): string[] => sortRows(sheet, { column, direction }).map((r) => cellWordsOf(r, column));
  assert.deepEqual(sorted('notes', 'asc').slice(0, 4), ['ask again on Friday', 'exact change', EGGS_NOTES, BLANK]);
  assert.deepEqual(sorted('notes', 'desc').slice(0, 4), [EGGS_NOTES, 'exact change', 'ask again on Friday', BLANK]);
  assert.deepEqual(sorted('instagramTag', 'asc').slice(0, 8), ['@made.up_kettle24', '@made.up_kettle24', '@made.up_kettle24', '@made.up_wok', '@made.up_yolk', '@made.up_yolk', '@made.up_yolk', BLANK]);
  assert.deepEqual(sorted('description', 'asc').slice(0, 5), [NOODLE_ITEMS, 'machine broken', 'scrambled, no toast', EGGS_ITEMS, BLANK]);
  // In the source: the four readers of DESCRIPTION all read the one rule; the tag's words are planVendor.ts's.
  const rules = code(RULES);
  assert.match(rules, /export const descriptionOf = \(row: LedgerSheetRow\): string \| null => \(row\.id === null \? row\.plannedItems : row\.note\);/);
  assert.match(rules, /export const plannedDescription = \(row: LedgerSheetRow\): boolean => row\.id === null && row\.plannedItems !== null;/);
  assert.match(rules, /case 'description': return noteCellWords\(descriptionOf\(row\)\);\s*\n\s*case 'notes': return noteCellWords\(row\.notes\);/);
  assert.match(rules, /case 'description': return descriptionOf\(row\);\n\s*case 'notes': return row\.notes;/);
  assert.match(rules, /case 'description': return text\(descriptionOf\(row\)\);\n\s*case 'notes': return text\(row\.notes\);/);
  assert.match(rules, /description: \(row\) => descriptionOf\(row\) \?\? '',\n\s*notes: \(row\) => row\.notes \?\? '',/);
  assert.equal(countOf(rules, /\brow\.note\b(?!s)/g), 1, 'the record’s note is read in ONE place — descriptionOf');
  assert.match(rules, /export const tagCellWords = \(tag: string \| null\): string => \(tag === null \? BLANK : instagramTagWords\(tag\)\);/);
  assert.match(rules, /instagramTag: \(row\) => row\.instagramTag === null \? '' : instagramTagWords\(row\.instagramTag\),/);
  assert.match(rules, /import \{ instagramTagWords, readInstagramTag \} from '@\/lib\/operations\/planVendor';/); // SHEET-01 (2026-11-28): the import gains readInstagramTag, on its own line — "+ expense"'s INSTAGRAM TAG is the directory's own reading
  assert.match(code(VENDOR_RULE), /export const instagramTagWords = \(tag: string\): string => `@\$\{tag\}`;/);
  assert.equal(countOf(rules, /`@\$\{/g), 0, 'the @ is typed once, in the vendor’s rule file');
});

// ── T10 · THE CSV, WHOLE (ruling B.2) ────────────────────────────────────────

/** A CSV line's fields read back — RFC 4180's minimal quoting: a quoted field may hold a comma, and a doubled quote is one. */
const fieldsOf = (csvLine: string): string[] => {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < csvLine.length; i += 1) {
    const c = csvLine[i];
    if (quoted) {
      if (c === '"' && csvLine[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') quoted = false; else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { fields.push(field); field = ''; } else field += c;
  }
  fields.push(field);
  return fields;
};

test('T10 the CSV of this fixture — a tag, planned items and notes among its rows: the header’s twenty-five words and each line’s twenty-five fields, whole (COALEVELS-01, 2026-11-27 — twenty-three until then); a tag with its @, the planned items or the record’s line under ITEMS, the notes last', () => {
  const HEADER = 'DAY,DATE,START,END,CITY,REGION,COUNTRY,LOCATION,CATEGORY,ENTITY,TYPE,ITEMS,VENDOR,INSTAGRAM TAG,WENT,STARS,PLANNED MIN,LOGGED MIN,COA,BUDGET,ACTUAL,VARIANCE,MATCH,UNDER / OVER,NOTES'; // COALEVELS-01 (2026-11-27): the head words, and every line below in the columns' new order — an empty REGION after CITY and an empty LOCATION after COUNTRY; CATEGORY, ENTITY, TYPE, ITEMS; the COA before BUDGET
  const LINES = [
    // Monday — no stay covers it.
    'Monday,2027-08-09,08:00,,,,,,Dining Out,Personal,Juice,machine broken,,,skipped,,,,P-6150,3.00,,,,,ask again on Friday',
    'Monday,2027-08-09,08:10,08:35,,,,,Dining Out,Personal,Eggs,,Yolk & Rye,@made.up_yolk,went,4,25,20,P-6150,6.50,7.00,0.50,,over,"window seat, cash only"',
    'Monday,2027-08-09,10:00,,,,,,,,Kiosk,,,,went,,,,,,1.50,,,,exact change',
    'Monday,2027-08-09,13:00,,,,,,Dining Out,Personal,Noodles,,Broth Cart,,not recorded,,,,P-6150,8.00,,,,,',
    'Monday,2027-08-09,16:00,,,,,,Dining Out,Personal,Tea,,Kettle Nook,@made.up_kettle24,not recorded,,,,P-6150,2.50,,,,,',
    'Monday,2027-08-09,18:00,,,,,,Sport,Personal,Sauna,,,,not recorded,,,,P-6200,12.00,,,,,',
    // Tuesday — the clock handed in stands at 12:00.
    'Tuesday,2027-08-10,08:00,,Quillhaven,,Ruritania,,Dining Out,Personal,Juice,,,,not recorded,,,,P-6150,3.00,,,,,',
    'Tuesday,2027-08-10,08:10,08:35,Quillhaven,,Ruritania,,Dining Out,Personal,Eggs,"scrambled, no toast",Yolk & Rye,@made.up_yolk,went,,25,,P-6150,6.50,6.00,-0.50,,under,',
    'Tuesday,2027-08-10,13:00,,Quillhaven,,Ruritania,,Dining Out,Personal,Noodles,"dry noodles, no chili",Wok Window,@made.up_wok,planned,,,,P-6150,8.00,,,,,',
    'Tuesday,2027-08-10,16:00,,Quillhaven,,Ruritania,,Dining Out,Personal,Tea,,Kettle Nook,@made.up_kettle24,planned,,,,P-6150,2.50,,,,,',
    'Tuesday,2027-08-10,18:00,,Quillhaven,,Ruritania,,Sport,Personal,Sauna,,,,planned,,,,P-6200,12.00,,,,,',
    // Wednesday.
    'Wednesday,2027-08-11,08:00,,Quillhaven,,Ruritania,,Dining Out,Personal,Juice,,,,planned,,,,P-6150,3.00,,,,,',
    'Wednesday,2027-08-11,08:10,08:35,Quillhaven,,Ruritania,,Dining Out,Personal,Eggs,"two eggs, rye toast",Yolk & Rye,@made.up_yolk,planned,,25,,P-6150,6.50,,,,,',
    'Wednesday,2027-08-11,13:00,,Quillhaven,,Ruritania,,Dining Out,Personal,Noodles,,,,planned,,,,P-6150,8.00,,,,,',
    'Wednesday,2027-08-11,16:00,,Quillhaven,,Ruritania,,Dining Out,Personal,Tea,,Kettle Nook,@made.up_kettle24,planned,,,,P-6150,2.50,,,,,',
    'Wednesday,2027-08-11,18:00,,Quillhaven,,Ruritania,,Sport,Personal,Sauna,,,,planned,,,,P-6200,12.00,,,,,',
  ];
  const csv = ledgerCsv(sheet);
  const lines = csv.split('\r\n');
  assert.equal(lines.length, sheet.length + 2, 'the header, one line per row, and the last CRLF');
  assert.equal(lines[0], HEADER);
  assert.deepEqual(lines.slice(1, -1), LINES, 'one line per row, in the sheet’s order');
  assert.equal(csv, `${[HEADER, ...LINES].join('\r\n')}\r\n`, 'the file, whole');
  // The header's twenty-five words are the head's, and every line reads back to twenty-five fields (COALEVELS-01 (2026-11-27): twenty-three until then).
  assert.deepEqual(fieldsOf(HEADER), [...LEDGER_HEAD_WORDS]);
  for (const [i, csvLine] of LINES.entries()) {
    const fields = fieldsOf(csvLine);
    const row = sheet[i];
    assert.equal(fields.length, 25, `line ${i + 1}: twenty-five fields`);
    // Read back, the three fields are the row's own: the tag with its @, ITEMS (the description) by the one rule, the notes.
    assert.equal(fields[LEDGER_COLUMNS.indexOf('instagramTag')], row.instagramTag === null ? '' : `@${row.instagramTag}`, `line ${i + 1}: INSTAGRAM TAG`);
    assert.equal(fields[LEDGER_COLUMNS.indexOf('description')], descriptionOf(row) ?? '', `line ${i + 1}: ITEMS`);
    assert.equal(fields[LEDGER_COLUMNS.indexOf('notes')], row.notes ?? '', `line ${i + 1}: NOTES`);
    assert.equal(fields[LEDGER_COLUMNS.indexOf('vendor')], row.vendor ?? '', `line ${i + 1}: VENDOR, where it stood`);
  }
  assert.deepEqual([LEDGER_COLUMNS.indexOf('vendor'), LEDGER_COLUMNS.indexOf('instagramTag'), LEDGER_COLUMNS.indexOf('description'), LEDGER_COLUMNS.indexOf('notes')], [12, 13, 11, 24]); // COALEVELS-01 (2026-11-27): where the four stand among the twenty-five — [10, 11, 21, 22] among the twenty-three
  assert.doesNotMatch(csv, /—/, 'no "—" in the file — a null is an empty field');
  assert.equal(ledgerCsv([]), `${HEADER}\r\n`, 'no rows: the header alone');
  // The CSV's own null path — never a screen helper.
  const rules = code(RULES);
  const block = rules.slice(rules.indexOf('export const LEDGER_CSV'), rules.indexOf('export const LEDGER_TABLE'));
  assert.doesNotMatch(block, /CellWords|BLANK/, 'the CSV never calls a screen helper');
});

// ── T11 · THE ANSWER FUNCTION (ruling B.1) ───────────────────────────────────

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

test('T11 the answer function: the tag, the planned items and the notes ride the one answer from the reads it already makes — two columns more in the plan-vendor select, no query added; a read that hands a vendor row without them is refused by name, never printed blank', async () => {
  const a = code(ANSWER);
  assert.equal(linesOf(ANSWER).length, 171, 'the file’s length'); // PASTE-03 (2026-11-28): 169 — the occurrences that carry no money are built beside the lines and handed to the rule, the two not-placed lists together; 166 until then. COALEVELS-01 (2026-11-27): 166 — the caller's sub-accounts read and the Locations handed to the rule; 154 until then; EDIT-01 (2026-11-28): 171 — each routine's one-off-ness handed to the rule (two lines, below the two the registry cites); 169 until then
  assert.equal(countOf(a, /db\.[a-z_]+\.(findMany|findFirst)\(/g), 9, 'the nine reads'); // COALEVELS-01 (2026-11-27): nine — the caller's active sub-accounts joined the eight; no other query added
  assert.match(a, /select: \{\n\s*id: true, routine_id: true, step_id: true, task_id: true, occurrence_at: true, items: true,\s*\n\s*vendor: \{ select: \{ id: true, vendor_name: true, entity_id: true, instagram_tag: true \} \},\n\s*routine: \{ select: \{ name: true, timezone: true \} \},/);
  assert.equal(countOf(a, /\bitems: true\b/g), 1);
  assert.equal(countOf(a, /\binstagram_tag: true\b/g), 1);
  assert.match(a, /vendors: planVendors,/, 'the rows as read, handed to the rule');
  assert.doesNotMatch(a, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(|\$executeRaw|\$queryRaw|\$transaction/, 'writes nothing');
  const time = (clock: string): Date => new Date(`1970-01-01T${clock}:00.000Z`);
  // The rows as the client reads them: one routine row serves the loader's read and the roles read.
  const ROUTINE_ROWS = [
    { id: 'breakfast', name: 'Breakfast', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: null, coa_code: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null,
      steps: [{ id: 'eggs', is_active: true, budget_amount: 6.5, coa_code: '6150', step_order: 1, activity: 'Eggs', time_of_day: time('08:10'), duration_minutes: 25 }] },
    { id: 'noodles', name: 'Noodles', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 8, coa_code: '6150', schedule_rrule: 'FREQ=DAILY;BYHOUR=13;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null, steps: [] },
    { id: 'tea', name: 'Tea', role: 'place', location_class: null, is_active: true, end_date: null, start_date: null, budget_amount: 2.5, coa_code: '6150', schedule_rrule: 'FREQ=DAILY;BYHOUR=16;BYMINUTE=0', timezone: NBO, start_time: null, end_time: null, steps: [] }, // COALEVELS-01 (2026-11-27): each routine row says its Location (none), as the roles read selects it now
  ];
  const RECORD_ROW = {
    id: 'rec-eggs', routine_id: null, step_id: 'eggs', occurrence_at: new Date(at(MON, '08:00')), outcome: 'done', done_at: new Date(at(MON, '08:20')), actual_cents: 700, rating: 4, note: null, notes: EGGS_NOTES, actual_minutes: 20,
    routine: null, step: { activity: 'Eggs', time_of_day: time('08:10'), duration_minutes: 25, routine_id: 'breakfast', routine: { name: 'Breakfast', timezone: NBO, role: 'place' } },
  };
  const tables = (vendors: readonly LedgerVendorRow[]) => ({
    entities: [{ id: 'P', name: 'Personal', entity_type: 'personal' }], chart_of_accounts: [{ id: 'acct-6150', entity_id: 'P', code: '6150', name: 'Dining Out', account_type: 'expense', balance_type: 'D' }], chart_of_sub_accounts: [], // COALEVELS-01 (2026-11-27): the chart row's id (the read selects it now) and the caller's sub-accounts — none
    operations_routines: ROUTINE_ROWS, planned_item_vendors: vendors, operations_stays: [], operations_stop_records: [RECORD_ROW], planned_item_links: [],
  });
  const calls: Call[] = [];
  const answer = await taskLedgerAnswerOf(fakeDb(tables(VENDORS), calls), 'someone', { from: MON, to: TUE }, NOW);
  assert.deepEqual(calls.map((c) => `${c.table}.${c.method}`), ['entities.findMany', 'chart_of_accounts.findMany', 'operations_routines.findMany', 'operations_routines.findMany', 'chart_of_sub_accounts.findMany', 'planned_item_vendors.findMany', 'operations_stays.findMany', 'operations_stop_records.findMany', 'operations_stop_records.findFirst', 'planned_item_links.findMany'], 'the reads, in their order'); // COALEVELS-01 (2026-11-27): the sub-accounts read stands after the roles read — the one read added
  assert.deepEqual(Object.keys(answer), ['from', 'to', 'as_of', 'first_record', 'rows', 'sheet', 'tones', 'recording', 'editing', 'said'], 'the answer’s ten keys — `editing` after `recording`'); // EDIT-01 (2026-11-28): nine until then
  assert.deepEqual(answer.sheet.map((r) => [r.day, r.description, r.vendor, r.instagramTag, descriptionOf(r), plannedDescription(r), r.notes]), [
    [MON, 'Eggs', 'Yolk & Rye', 'made.up_yolk', null, false, EGGS_NOTES],
    [MON, 'Noodles', 'Broth Cart', null, null, false, null],
    [MON, 'Tea', 'Kettle Nook', 'made.up_kettle24', null, false, null],
    [TUE, 'Eggs', 'Yolk & Rye', 'made.up_yolk', EGGS_ITEMS, true, null],
    [TUE, 'Noodles', 'Wok Window', 'made.up_wok', NOODLE_ITEMS, true, null],
    [TUE, 'Tea', 'Kettle Nook', 'made.up_kettle24', null, false, null],
  ], 'the record’s notes and its vendor’s tag · each plan row’s tag and planned items, at its vendor row’s grain');
  assert.deepEqual(answer.rows.map((r) => [r.id, r.instagramTag, r.notes]), [['rec-eggs', 'made.up_yolk', EGGS_NOTES]], '`rows` carries the two as well');
  assert.deepEqual(JSON.parse(JSON.stringify(answer)), answer, 'wire-shaped as built');
  // A client whose rows lack a column the select names — the rule refuses by name; nothing is printed as none.
  await assert.rejects(taskLedgerAnswerOf(fakeDb(tables(vendorsWith('pv-tea', withoutItems)), []), 'someone', { from: MON, to: TUE }, NOW), /ledger: line routine:tea:\S+ holds a vendor for every occurrence, whose planned items the plan-vendor rows do not hold/);
  await assert.rejects(taskLedgerAnswerOf(fakeDb(tables(vendorsWith('pv-tea', withoutTag)), []), 'someone', { from: MON, to: TUE }, NOW), /ledger: line routine:tea:\S+ names vendor v-kettle, whose Instagram tag the plan-vendor rows do not hold/);
});

// ── T12 · THE SCREEN FILES, THE WRITER AND THE ROUTE (rulings A.2–A.4, A.6, B.4) ──

test('T12 in the source: LedgerSection.tsx is 488 lines with the tag’s cell on the vendor’s line, the description’s cell on the sub-account-name’s and the notes’ cell on a line of its own (COALEVELS-01, 2026-11-27), and the planned class; RecordForm.tsx is 164 with the NOTES box on DESCRIPTION’s line and its draft through rowDraftOf; stopWrites.ts is 60; the stops route’s data line names notes; the day card’s form shows the notes a record holds', () => {
  // THE SECTION — six edits in place: no line added, none removed.
  const s = code(SECTION);
  assert.equal(linesOf(SECTION).length, 625); // SHEET-01 (2026-11-28): 432 — the notes, the summary and the fold are gone, the TOTAL row sums the minutes; 488 until then; SHEET-01 (2026-11-28) (PART 3): 435 — the `adding` state and its note, the `first` prop; 432 until then; EDIT-01 (2026-11-28): 568 — a cell opens as its box; 435 until then; EDIT-01 (2026-11-28) (PART 3): 586 — the frame, below the section, reads the vendors once a VENDOR cell opens and hands the box what it lists; no cited line moved; 568 until then; EDIT-01 (2026-11-28) (PART 4): 625 — the ✕'s question, a row beneath the row, and the frame's question state below the section; 586 until then
  assert.match(s, /\n[ \t]*RECORD_WORDS, type LedgerRecording, PLANNED_ITEMS_TITLE_WORDS, descriptionOf, plannedDescription, tagCellWords,[ \t]*\n/, 'the new names on the import’s TIMESHEET-02 line');
  assert.match(s, /\nconst BLANK_CLASS = 'text-text-faint'; const PLANNED_CLASS = 'text-text-faint italic'; const CODE_CLASS = 'font-mono text-\[11px\] text-text-muted mr-1\.5 tabular-nums';[ \t]*\n/, 'the planned class on the blank class’s line — and the class of a level’s code after it'); // COALEVELS-01 (2026-11-27): CODE_CLASS joined the line
  assert.match(s, /\n[ \t]*<td className=\{`\$\{cell\} \$\{row\.vendor === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="vendor" title=\{titleOf\(row, 'vendor', row\.vendor \?\? undefined\)\} onClick=\{\(e\) => clickCell\(e, row, 'vendor'\)\}>\{boxIn\(row, 'vendor'\) \?\? vendorCellWords\(row\.vendor\)\}<\/td><td className=\{`\$\{cell\} whitespace-nowrap \$\{row\.instagramTag === null \? BLANK_CLASS : ''\}`\} data-ledger-cell="instagram-tag" title=\{titleOf\(row, 'instagramTag'\)\} onClick=\{\(e\) => clickCell\(e, row, 'instagramTag'\)\}>\{boxIn\(row, 'instagramTag'\) \?\? tagCellWords\(row\.instagramTag\)\}<\/td>[ \t]*\n/, 'the tag’s cell on the vendor cell’s line, after it'); // COALEVELS-01 (2026-11-27): the vendor's cell says itself whole in its title — the table's class cuts it; EDIT-01 (2026-11-28): every cell carries a title now — why it never opens, why it does not open here, or its own — and a cell he types its click and its box
  assert.match(s, /\n[ \t]*<td className=\{`\$\{cell\} font-semibold text-text-primary`\} data-ledger-cell="sub-account-name" title=\{titleOf\(row, 'subAccountName', row\.description\)\} onClick=\{\(e\) => clickCell\(e, row, 'subAccountName'\)\}>\{boxIn\(row, 'subAccountName'\) \?\? <>\{row\.segments !== null && row\.segments\.type !== null && <span className=\{CODE_CLASS\}>\{row\.segments\.type\}<\/span>\}\{row\.description\}<\/>\}<\/td><td className=\{`\$\{cell\} \$\{descriptionOf\(row\) === null \? BLANK_CLASS : plannedDescription\(row\) \? PLANNED_CLASS : 'text-text-muted'\}`\} data-ledger-cell="description" data-ledger-planned=\{plannedDescription\(row\) \? '' : undefined\} title=\{titleOf\(row, 'description', plannedDescription\(row\) \? `\$\{PLANNED_ITEMS_TITLE_WORDS\} — \$\{noteCellWords\(descriptionOf\(row\)\)\}` : descriptionOf\(row\) \?\? undefined\)\} onClick=\{\(e\) => clickCell\(e, row, 'description'\)\}>\{boxIn\(row, 'description'\) \?\? noteCellWords\(descriptionOf\(row\)\)\}<\/td>[ \t]*\n/, 'ITEMS — the description — by the one rule (blank, planned or the record’s), on the TYPE cell’s line, after it'); assert.match(s, /\n[ \t]*<td className=\{`\$\{cell\} \$\{row\.notes === null \? BLANK_CLASS : 'text-text-muted'\}`\} data-ledger-cell="notes" title=\{titleOf\(row, 'notes', row\.notes \?\? undefined\)\} onClick=\{\(e\) => clickCell\(e, row, 'notes'\)\}>\{boxIn\(row, 'notes'\) \?\? noteCellWords\(row\.notes\)\}<\/td>[ \t]*\n/, 'the notes’ cell, the row’s last, on a line of its own'); // COALEVELS-01 (2026-11-27): the description moved up to stand after the TYPE (its title says the text whole — a planned one after PLANNED_ITEMS_TITLE_WORDS); the notes' cell stays where the two stood; EDIT-01 (2026-11-28): every cell carries a title now — why it never opens, why it does not open here, or its own — and a cell he types its click and its box
  assert.match(s, /<th scope="row" colSpan=\{LEDGER_COLUMNS\.indexOf\('plannedMinutes'\)\} className=\{`\$\{cell\} text-left`\}>\{TOTAL_WORDS\}<\/th>/, 'TOTAL spans the nineteen columns before BUDGET, less the ones a single day folds'); // COALEVELS-01 (2026-11-27): nineteen — sixteen until then; SHEET-01 (2026-11-28): the label spans the columns before PLANNED MIN, worked out — nineteen less the fold until then
  assert.match(s, /\n[ \t]*<td className=\{cell\} data-ledger-total-notes \/>[ \t]*\n/, 'one cell after the five, under NOTES'); // COALEVELS-01 (2026-11-27): the description's cell left the TOTAL row — ITEMS stands before BUDGET now, under the label's span
  // One cell per head word, in the head's order; the TOTAL row's label and its six cells make the twenty-five (COALEVELS-01 (2026-11-27): seven and twenty-three until then).
  assert.deepEqual([...s.matchAll(/data-ledger-cell="([a-z-]+)"/g)].map((m) => m[1]), ['day', 'date', 'start', 'end', 'city', 'region', 'country', 'location', 'account-name', 'book', 'sub-account-name', 'description', 'vendor', 'instagram-tag', 'went', 'stars', 'planned-minutes', 'logged-minutes', 'account', 'budget', 'actual', 'variance', 'match', 'under-over', 'notes']);
  assert.deepEqual([...s.matchAll(/data-ledger-total-([a-z-]+)/g)].map((m) => m[1]), ['planned-minutes', 'logged-minutes', 'account', 'budget', 'actual', 'variance', 'match', 'under-over', 'notes']); // SHEET-01 (2026-11-28): nine — PLANNED MIN and LOGGED MIN, each its sum, and COA's empty cell before the six; the label spans sixteen
  assert.equal(LEDGER_COLUMNS.indexOf('plannedMinutes') + 3 + 6, LEDGER_HEAD_WORDS.length, 'the label’s span and the cells after it'); // SHEET-01 (2026-11-28): sixteen, the three, the six — 19 + 6 until then
  assert.equal(LEDGER_COLUMNS.indexOf('budget'), 19, 'nineteen columns stand before BUDGET');
  // The planned look is the rule's to decide, the class and the title are typed once; no cell asks which kind of row it draws.
  assert.equal(countOf(s, /PLANNED_CLASS/g), 2, 'defined, and read by the one cell');
  assert.equal(countOf(s, /PLANNED_ITEMS_TITLE_WORDS/g), 2, 'imported, and read by the one cell');
  assert.doesNotMatch(s, /row\.id (===|!==) null|plannedItems|row\.note\b(?!s)/, 'the section reads descriptionOf and plannedDescription — never the row’s kind, its planned items or its note');
  // THE LEAF — the NOTES box on DESCRIPTION's line, after it; the draft through rowDraftOf; nothing else moved.
  const f = code(LEAF);
  assert.equal(linesOf(LEAF).length, 164);
  assert.match(f, /\n[ \t]*\{field\('note', <input type="text" value=\{draft\.note\} onChange=\{\(e\) => set\('note'\)\(e\.target\.value\)\} className=\{`\$\{box\} w-64`\} maxLength=\{NOTE_MAX\} placeholder=\{draft\.went === SKIPPED_WORD \? SKIP_REASON_PLACEHOLDER_WORDS : undefined\} data-record-form-note \/>\)\}\{field\('notes', <input type="text" value=\{draft\.notes\} onChange=\{\(e\) => set\('notes'\)\(e\.target\.value\)\} className=\{`\$\{box\} w-96`\} maxLength=\{NOTES_MAX\} data-record-form-notes \/>\)\}[ \t]*\n/, 'the same box class, wider, at most NOTES_MAX — never required, so no placeholder');
  assert.deepEqual([...f.matchAll(/\{field\('([a-z]+)', <input type="text"/g)].map((m) => m[1]), ['actual', 'stars', 'minutes', 'note', 'notes'], 'the boxes in the rule’s order');
  assert.match(f, /const \[draft, setDraft\] = useState<RecordDraft>\(\(\) => rowDraftOf\(row, entry\.held\)\);/);
  assert.doesNotMatch(f, /recordDraftOf/, 'the draft is the row’s — never the bare record’s');
  assert.match(f, /import \{ NOTES_MAX, NOTE_MAX, SKIPPED_WORD, clearStopQuestion \} from '@\/lib\/operations\/stopRecord';/);
  assert.match(f, /\n[ \t]*recordInput, rowDraftOf, wentCellWords,[ \t]*\n/);
  assert.match(f, /if \(!read\.ok\) \{ setRefusal\(read\); return; \}\n\s*const body = read\.body;\n\s*void write\(\(\) => setStopRecord\(body\)\);/, 'save: the rule, then the one writer — as it was');
  // THE ONE WRITER — StopBody says its notes on the note's line; three requests, none added.
  const w = code(WRITES);
  assert.equal(linesOf(WRITES).length, 60);
  assert.match(w, /\n[ \t]*readonly note: string \| null; readonly notes: string \| null;[ \t]*\n/);
  assert.equal(countOf(w, /\bfetch\s*\(/g), 3);
  // THE STOPS ROUTE — the data line names notes after the note; the record is created and updated from that one object.
  const r = code(STOPS_ROUTE);
  assert.equal(linesOf(STOPS_ROUTE).length, 202);
  assert.match(r, /const data = \{ outcome: v\.outcome, done_at: v\.doneAt, actual_cents: v\.actualCents, rating: v\.rating, note: v\.note, notes: v\.notes, actual_minutes: v\.actualMinutes \};/);
  assert.equal(countOf(r, /\bnotes\b/g), 2, 'the route names notes on its data line and nowhere else — the rule reads them');
  assert.match(comments(STOPS_ROUTE), /POST \{ kind, id, instant, outcome, done_at\?, actual_cents\?, rating\?, note\?, notes\?,/);
  assert.match(r, /const userEmail = await getVerifiedEmail\(\);\n\s*if \(!userEmail\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);\n\s*const user = await prisma\.users\.findFirst\(/, 'the gate, as it stood');
  // THE DAY CARD'S FORM — no role asks for notes: the box shows only while the record holds some, and what it holds rides with every save.
  const c = code(CARD_FORM);
  assert.match(c, /note: r === null \|\| r\.note === null \? '' : r\.note,\n\s*notes: r === null \|\| r\.notes === null \? '' : r\.notes,/);
  assert.match(c, /note: asks\.note \|\| draft\.note !== '',\n\s*notes: draft\.notes !== '',\n\s*\};/);
  assert.match(c, /const notes = d\.notes\.trim\(\);/);
  assert.match(c, /note: note === '' \? null : note, notes: notes === '' \? null : notes, actual_minutes: actualMinutes \},/);
  assert.match(c, /\{shown\.notes && \(\n\s*<input type="text" value=\{draft\.notes\} onChange=\{\(e\) => setDraft\(\{ \.\.\.draft, notes: e\.target\.value \}\)\} placeholder="notes" aria-label="Notes" className=\{`\$\{box\} w-72`\} maxLength=\{NOTES_MAX\} data-stop-notes \/>\n\s*\)\}/);
  assert.ok(c.indexOf('data-stop-note />') > -1 && c.indexOf('data-stop-note />') < c.indexOf('data-stop-notes />'), 'after the note’s box');
  assert.equal(NOTES_MAX, 2000, 'at most 2000');
  // Every sender of a StopBody says its notes: the two forms' rules and "+ expense" — a body literal that names a note names its notes.
  for (const file of [RULES, CARD_FORM, PASTE_RULE]) {
    const text = code(file);
    assert.equal(countOf(text, /\bnote: [^,{}]+, actual_minutes\b/g), 0, `${file}: no body names a note and then the minutes without its notes between`);
  }
});

// ── T13 · THE PASTE (ruling D) ───────────────────────────────────────────────

test('T13 the paste (re-pointed by COALEVELS-01, 2026-11-27 — until that change it filled no notes and named no tag): pasteRows.ts fills the record’s notes from the row — RECORD_HEADS holds the box, and a refusal is thrown by name for stars and minutes alone — and the record’s draft it builds carries them; pasteSave.ts, PasteRows.tsx and ledgerWrites.ts each name the tag’s writer', () => {
  const p = code(PASTE_RULE);
  assert.equal(linesOf(PASTE_RULE).length, 1262, 'the file’s new length — 941 until COALEVELS-01'); // PASTE-03 (2026-11-28): 1246 — a row with no Start Time is a charge on its date, and the charge of its name takes the row; 1,188 until then; SHEET-01 (2026-11-28): 1250 — a charge says it takes no record, and its WENT is the sheet's blank; 1,246 until then; SHEET-01 (2026-11-28): 1260 — the Trip Name is read as the paste's trips; 1,250 until then; SHEET-01 (2026-11-28) (PART 3): 1262 — the paste hands "+ expense"'s four new boxes blank; 1,260 until then
  // 1. The boxes the paste fills: went, ACTUAL, DESCRIPTION and — COALEVELS-01 (2026-11-27) — the NOTES; no stars, no minutes.
  assert.match(p, /const RECORD_HEADS: Readonly<Record<Exclude<RecordField, 'stars' \| 'minutes'>, PasteHead>> = \{ went: 'Start Date', actual: 'Total \(USD\)', note: 'Items', notes: 'Notes' \};/);
  assert.match(p, /if \(field === 'stars' \|\| field === 'minutes'\) throw new Error\(`pasteRows: the record's rule refused \$\{field\}, which the paste never fills — \$\{message\}`\);/);
  // 2. The record's draft it builds carries the row's notes — blank with none.
  assert.match(p, /recordInput\(\{ went: WENT_WORD, actual: csvMoney\(happened\.cents\), stars: '', minutes: '', note: happened\.items === null \? '' : happened\.items, notes: happened\.notes === null \? '' : happened\.notes \}, stop\.address, \{ plannedAt: entry\.plannedAt, held: entry\.held \}, context\.now\);/);
  // …and the file's words about notes are no longer those three: it reads them, carries them, and says where they are not written. It names the tag's field, the bound on the notes and the planned items of a stop's row; it builds no row's draft.
  assert.equal(countOf(p, /\bnotes\b/g), 26, 'three until COALEVELS-01: the exclusion, the throw, the draft'); // PASTE-03 (2026-11-28): 24 — a charge on its date says its Notes as not written (CHARGE_NOTES_WORDS: "notes sit on a record", and its test of the row's notes in chargeHappened); 22 until then; SHEET-01 (2026-11-28): 26 — "+ expense"'s NOTES box under the Notes column, and handed blank; 24 until then
  for (const named of [/instagram_tag/, /readInstagramTag/, /plannedItems/, /NOTES_MAX/]) assert.match(p, named); assert.doesNotMatch(p, /rowDraftOf/);
  // The heads the paste reads no column from are two: the tag, the notes and the Location are read now.
  assert.match(p, /export const PASTE_NO_COLUMN_HEADS = \['Currency', 'Total'\] as const;/);
  // The three files TIMESHEET-04b did not edit, and this change does: each names the tag's writer.
  for (const file of [PASTE_SAVE, PASTE_LEAF, LEDGER_WRITES]) {
    assert.match(code(file), /\bsetVendorTag\b/, `${file}: names the tag’s writer`);
  }
});

// ── T14 · THE REGISTRY (ruling C) ────────────────────────────────────────────

test('T14 the registry’s Time row: its two cites into the rule file stand where the two lines now stand, said in a dated sentence on the row’s comment line; status, beats, why, note and customer line unchanged; the file keeps its length', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.beats, time.home, time.why], ['LIVE', { discover: true, decide: true, commit: true, record: true }, '/time', undefined]);
  assert.equal(time.customer, 'You can see every stop you logged, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.'); // SHEET-01 (2026-11-28): the customer line names no journal answer — the journal tables are mounted nowhere
  assert.match(time.note ?? '', /^HOME-03 \(2026-10-27\): the day itself is entered on the day card/);
  // The number a citation names, read from the citation itself — and the line it names, by content.
  const cited = (re: RegExp): number => { const m = time.citation.match(re); if (m === null) return assert.fail(`the citation names ${re}`); return Number(m[1]); };
  const lineOf = (file: string, n: number): string => linesOf(file)[n - 1] ?? '';
  const heads = cited(/src\/lib\/operations\/ledger\.ts:(\d+) \(LEDGER_HEAD_WORDS/);
  assert.doesNotMatch(time.citation, /the summary's sums|SUMMARY_HEAD_WORDS/, 'the summary’s words left the citation with the summary'); // SHEET-01 (2026-11-28): re-pointed to its absence
  assert.match(lineOf(RULES, heads), /^export const LEDGER_HEAD_WORDS = \[/);
  assert.ok(linesOf(RULES).some((l) => /^export const SUMMARY_HEAD_WORDS = \[/.test(l)), 'the words stay in the rule file, uncalled'); // SHEET-01 (2026-11-28): the words stay, uncalled
  assert.equal(countOf(time.citation, /src\/lib\/operations\/ledger\.ts:\d+/g), 1, 'the row cites the rule file once — LEDGER_HEAD_WORDS'); // SHEET-01 (2026-11-28): twice until then — the summary's cite left with the summary
  // Each cite says where the line stood until this change, in the row's own way.
  const was = [cited(/LEDGER_HEAD_WORDS — EDIT-01, 2026-11-28: was :(\d+)/)]; // COALEVELS-01 (2026-11-27): the cite's own "was" is this change's now — the rule file grew again and the two cites followed; TIMESHEET-04b's stood there until then. PASTE-03 (2026-11-28): and again — "COALEVELS-01, 2026-11-27: was" until then; SHEET-01 (2026-11-28): one cite — the summary's left with the summary; EDIT-01 (2026-11-28): and again — "PASTE-03, 2026-11-28: was" until then
  assert.ok(was[0] < heads, 'the rule file grew above it'); // SHEET-01 (2026-11-28): one cite
  assert.doesNotMatch(time.citation, /their coverage said at|PLANNED HOURS · LOGGED HOURS — the summary/, 'the summary’s hours and their coverage left the citation'); // SHEET-01 (2026-11-28): re-pointed to its absence
  // The dated sentence on the row's comment line: from which number to which, that what each cites is unchanged, and which cites did not move.
  const said = comments(REGISTRY).split('\n').find((l) => l.includes('EDIT-01 (Alex, 2026-11-28): ledger.ts grew')); // PASTE-03 (2026-11-28): that change's sentence — on the line COALEVELS-01 said its own (the match two lines below); 'COALEVELS-01 (Alex, 2026-11-27): ledger.ts grew' was looked for until then; EDIT-01 (2026-11-28): this change's sentence, on the same line
  assert.ok(said !== undefined, 'the sentence');
  assert.match(said, new RegExp(`ledger\\.ts :${was[0]} → :${heads} \\(LEDGER_HEAD_WORDS\\); what it cites unchanged\\.`)); // SHEET-01 (2026-11-28): the sentence is PASTE-03's history; EDIT-01 (2026-11-28): this change's sentence — one cite
  assert.match(said, /TIMESHEET-01 \(Alex, 2026-11-24\)[^\n]*TIMESHEET-04b \(Alex, 2026-11-27\)[^\n]*COALEVELS-01 \(Alex, 2026-11-27\)[^\n]*PASTE-03 \(Alex, 2026-11-28\)/, 'on the line where TIMESHEET-01, TIMESHEET-04b and COALEVELS-01 said their own');
  assert.match(said, /LedgerSection\.tsx:\d+, :\d+ and :\d+, ledgerReads\.ts:\d+, ledgerAnswer\.ts:\d+, :\d+, stops\/stopWrites\.ts:\d+, ledger\/RecordForm\.tsx:\d+, ledger\/ExpenseForm\.tsx:\d+ and stops\/route\.ts:\d+ did not move\./);
  // The cites that did not move hold what they cite: the writer's request, the leaf's save, the two selects, the read, the section's three lines.
  assert.match(lineOf(WRITES, cited(/through stops\/stopWrites\.ts:(\d+)/)), /await fetch\('/);
  assert.match(lineOf(LEAF, cited(/ledger\/RecordForm\.tsx:(\d+)/)), /setStopRecord\(body\)/);
  assert.match(lineOf(ANSWER, cited(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the line's duration\)/)), /duration_minutes: true/);
  assert.match(lineOf(ANSWER, cited(/src\/lib\/operations\/ledgerAnswer\.ts:(\d+) \(the routine's window\)/)), /start_time: true, end_time: true/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the two cells\)/)), /data-ledger-cell="planned-minutes"/);
  assert.match(lineOf(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the TOTAL row\'s two sums, PLANNED MIN · LOGGED MIN — over the rows shown, by any filter/)), /data-ledger-total-planned-minutes/); // SHEET-01 (2026-11-28): the hours are the TOTAL row's two sums — the summary's PLANNED HOURS · LOGGED HOURS until then
  assert.doesNotMatch(time.citation, /their coverage said at/, 'the coverage left with the notes'); // SHEET-01 (2026-11-28): re-pointed to its absence
  assert.equal(linesOf(REGISTRY).length, 761);
});

// ── T15 · NOTHING ELSE (ruling E) ────────────────────────────────────────────

test('T15 the rules stay pure and read no clock of their own; the Budget’s vendor row is as it was; this test reads no clock and pins no line number of any file', () => {
  for (const file of [RULES, STOP_RULE, VENDOR_RULE]) {
    assert.doesNotMatch(code(file), /\bfetch\b|@prisma\/client|from 'react'|from 'next/, `${file}: pure`);
    assert.doesNotMatch(code(file), /new Date\(\)|Date\.now\(/, `${file}: no clock of its own`);
  }
  // The rule file's one new import is the tag's words; the vendor's rule file gains ONE export, after readVendorId.
  assert.match(code(RULES), /import \{ instagramTagWords, readInstagramTag \} from '@\/lib\/operations\/planVendor';/); // SHEET-01 (2026-11-28): the import gains readInstagramTag, on its own line — "+ expense"'s INSTAGRAM TAG is the directory's own reading
  const vendorRule = code(VENDOR_RULE);
  assert.ok(vendorRule.indexOf('export function readVendorId(') < vendorRule.indexOf('export const instagramTagWords = ') && vendorRule.indexOf('export const instagramTagWords = ') < vendorRule.indexOf('export const PLANNED_ITEMS_MAX = '), 'after readVendorId, before the planned items');
  // The Budget, Expenses, bill pay and the month read PlanVendorRow as they did: the type is extended beside it, never edited.
  assert.match(code(PLAN_LINES), /export interface PlanVendorRow \{\n\s*readonly id: string;\n\s*readonly routine_id: string \| null;\n\s*readonly step_id: string \| null;\n\s*readonly task_id: string \| null;\n\s*readonly occurrence_at: Date \| null;\n\s*readonly vendor: \{ readonly id: string; readonly vendor_name: string; readonly entity_id: string \};\n\s*readonly routine: \{ readonly name: string; readonly timezone: string \} \| null;\n\s*readonly step: \{ readonly activity: string; readonly routine_id: string; readonly routine: \{ readonly name: string; readonly timezone: string \} \} \| null;\n\s*readonly task: \{ readonly title: string \} \| null;\n\}/);
  assert.equal(countOf(code(RULES), /\bLedgerVendorRow\b/g), 2, 'defined, and read by LedgerInput — nowhere else in the rule file');
  // The sheet sends neither a tag nor a plan's items: the section and the leaf name no vendor route.
  for (const file of [SECTION, LEAF]) assert.doesNotMatch(code(file), /\/api\/|\bfetch\s*\(|vendor-directory|plan-vendors/, `${file}: no route named`);
  assert.doesNotMatch(code(THIS), /new Date\(\)|Date\.now\(/, 'this test reads no clock');
  assert.doesNotMatch(code(THIS), /split\('\\n'\)\[\d+\]|\.tsx?:\d+/, 'no line-number pin');
});
