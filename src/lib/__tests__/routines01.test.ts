/**
 * ROUTINES-01 (2026-09-30) — THE ROUTINES ARE ONE TABLE.
 *
 * The Tasks tab's routines are one table: Routine · Where · Activity · When ·
 * Minutes · Amount · Account, every line of every routine on screen at once,
 * each code drawn as its account string. The account helper is pure and is
 * DRIVEN over fixtures (T1). The table is client components, so — the repo's
 * TEST-TRUTH-01 way — it is anchored to its source with comments stripped (T2).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { ACCOUNT_CELL_WORDS, accountCell, type AccountCellBook } from '../coa/accountCell';
import { CADENCE_GROUP_ORDER } from '@/components/workbench/operations/routines/types';

const HELPER = 'src/lib/coa/accountCell.ts';
const LIST = 'src/components/workbench/operations/routines/RoutineList.tsx';
const ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
const LINES = 'src/components/workbench/operations/routines/RoutineStepList.tsx';
const SECTION_E = 'src/components/workbench/operations/SectionE_Routines.tsx';
const TAKEIFY = 'src/components/workbench/operations/content/TakeifyButton.tsx';
const CONTENT_LIST = 'src/components/workbench/operations/content/AvailableRoutinesList.tsx';
const TABLE = [LIST, ROW, LINES];

const BOOKS: AccountCellBook[] = [
  { id: 'e_me', entity_type: 'personal' },
  { id: 'e_biz', entity_type: 'sole_prop' },
  { id: 'e_hold', entity_type: 'llc' },
];

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) out.push(...tsFilesUnder(rel));
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

// ── T1 · THE ACCOUNT HELPER ──────────────────────────────────────────────────

test('T1 blank draws nothing — absent, null, empty or spaces — whatever the book', () => {
  for (const saved of [null, undefined, '', '   ']) {
    assert.deepEqual(accountCell(BOOKS, 'e_me', saved), { state: 'blank' });
    assert.deepEqual(accountCell(BOOKS, 'e_missing', saved), { state: 'blank' }, 'a blank code needs no book');
  }
});

test('T1 bare, lettered and lowercase codes draw ONE letter — the book\'s', () => {
  // Bare: the book's letter is drawn — P-6110, never 6110.
  assert.deepEqual(accountCell(BOOKS, 'e_me', '6110'), { state: 'account', text: 'P-6110' });
  assert.deepEqual(accountCell(BOOKS, 'e_biz', '6110'), { state: 'account', text: 'B-6110' });
  // Lettered: saved with its letter, drawn with one letter — never B-B-5130.
  assert.deepEqual(accountCell(BOOKS, 'e_biz', 'B-5130'), { state: 'account', text: 'B-5130' });
  assert.deepEqual(accountCell(BOOKS, 'e_me', 'P-6110'), { state: 'account', text: 'P-6110' });
  // Lowercase and padded: read by the chart's rule, drawn in its case.
  assert.deepEqual(accountCell(BOOKS, 'e_me', 'p-6110'), { state: 'account', text: 'P-6110' });
  assert.deepEqual(accountCell(BOOKS, 'e_biz', ' b-5130 '), { state: 'account', text: 'B-5130' });
});

test('T1 a book whose type has no letter draws the four digits alone — and refuses a lettered code', () => {
  assert.deepEqual(accountCell(BOOKS, 'e_hold', '5100'), { state: 'account', text: '5100' });
  assert.deepEqual(accountCell(BOOKS, 'e_hold', 'B-5100'), { state: 'not-recognised', text: 'not recognised: B-5100' });
});

test('T1 a book not in the entity list is "book not loaded" — never a guessed letter', () => {
  assert.deepEqual(accountCell(BOOKS, 'e_missing', '6110'), { state: 'book-not-loaded', text: 'book not loaded' });
  assert.deepEqual(accountCell([], 'e_me', 'P-6110'), { state: 'book-not-loaded', text: 'book not loaded' }, 'the list not loaded yet');
});

test('T1 a code the chart\'s rule cannot read is "not recognised: <the code as saved>"', () => {
  assert.deepEqual(accountCell(BOOKS, 'e_me', 'B-5130'), { state: 'not-recognised', text: 'not recognised: B-5130' }, 'another book\'s letter');
  assert.deepEqual(accountCell(BOOKS, 'e_me', 'Software'), { state: 'not-recognised', text: 'not recognised: Software' }, 'shown as saved, not upper-cased');
  assert.deepEqual(accountCell(BOOKS, 'e_me', '0110'), { state: 'not-recognised', text: 'not recognised: 0110' });
  assert.deepEqual(accountCell(BOOKS, 'e_me', '61100'), { state: 'not-recognised', text: 'not recognised: 61100' });
  assert.deepEqual(accountCell(BOOKS, 'e_me', 'X-9999'), { state: 'not-recognised', text: 'not recognised: X-9999' });
});

test('T1 every state\'s words, and the helper takes a book list, a book id and a code — never a routine', () => {
  assert.deepEqual(ACCOUNT_CELL_WORDS, { bookNotLoaded: 'book not loaded', notRecognised: 'not recognised' });
  assert.equal(accountCell.length, 3);
  const helper = code(HELPER);
  assert.match(helper, /export function accountCell\(books: readonly AccountCellBook\[\], bookId: string, saved: string \| null \| undefined\): AccountCell/);
  assert.doesNotMatch(helper, /routine/i, 'the helper knows no routine');
  assert.match(helper, /parseCode\(saved, book\.entity_type\)/, 'the chart\'s own rule reads the code');
  assert.match(helper, /deriveAccountString\(\{ entityType: book\.entity_type, code: digits \}\)/, 'accountString draws it');
  // Only the chart rule's refusal is a state; anything else is thrown.
  assert.match(helper, /if \(error instanceof ValidationError\) return \{ state: 'not-recognised'[^\n]*\n\s*throw error;/);
  assert.ok(!HELPER.includes('/routines/'), 'the helper lives outside the routines folder');
});

// ── T2 · THE TABLE ───────────────────────────────────────────────────────────

test('T2 one table: Routine · Cadence · Days · Time · Amount · Account, and a controls column (FORM-01)', () => {
  const list = code(LIST);
  assert.equal((list.match(/<table\b/g) ?? []).length, 1, 'one table');
  for (const f of [ROW, LINES]) assert.doesNotMatch(code(f), /<table\b/, `${f} draws rows of the one table, not a table of its own`);
  const heads = [...list.matchAll(/<th\b[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(heads, ['Routine', 'Cadence', 'Days', 'Time', 'Amount', 'Account', ''], 'FORM-01 (2026-10-19): Routine · Cadence · Days · Time · Amount · Account — Where, Activity and Minutes are gone');
  const columns = Number(/export const ROUTINE_TABLE_COLUMNS = (\d+);/.exec(code(LINES))?.[1]);
  assert.equal(columns, heads.length, 'the column count is the header\'s');
  // ROUTINE-02a (2026-10-18): each row is handed the list's judgement of its end (routine02a T6).
  assert.match(list, /<RoutineRow\n\s*key=\{r\.id\}\n\s*routine=\{r\}\n\s*end=\{end\}\n\s*entities=\{entities\}\n\s*onUpdate=\{refresh\}\n\s*onDelete=\{refresh\}\n\s*\/>/);
  // ROUTINE-02a (2026-10-18): the rows say whether the routine has ended, and its lines are read-only then (routine02a T6).
  assert.match(code(ROW), /<tbody className=\{[^}]*\} data-routine-rows=\{routine\.id\} data-routine-is-ended=\{end\.ended \? 'true' : undefined\}>\n\s*<RoutineStepList routine=\{routine\} entities=\{entities\} onUpdate=\{onUpdate\} routineCell=\{routineCell\} readOnly=\{end\.ended\} \/>/);
});

test('T2 the current routines are one flat table in clock order — no cadence group rows (FORM-01)', () => {
  assert.deepEqual(CADENCE_GROUP_ORDER, ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']);
  const list = code(LIST);
  // FORM-01 (2026-10-19): the current routines are ONE FLAT TABLE in clock order — no cadence group rows; CADENCE_GROUP_ORDER stays
  // the list's vocabulary elsewhere (the move control) and the ended group keeps its own label row (routine02a T6).
  assert.doesNotMatch(list, /CADENCE_GROUP_ORDER|data-cadence-group/);
  assert.match(list, /const current = judged\.filter\(\(x\) => !x\.end\.ended\)\.sort\(\(a, b\) => byClockThenName\(a\.r, b\.r\)\);/);
  assert.match(list, /\{current\.map\(\(\{ r, end \}\) => \(\n\s*<RoutineRow/);
  // "+ new routine", "show inactive", the count and the create form stay where they are.
  const header = list.indexOf('show inactive');
  // ROUTINE-02a (2026-10-18): the count is of the rows shown — the current ones, and the ended while shown.
  assert.ok(list.indexOf("{shownCount === 1 ? 'routine' : 'routines'}") < header);
  assert.ok(header < list.indexOf('+ new routine'));
  assert.ok(list.indexOf('+ new routine') < list.indexOf('<RoutineCreateForm'));
  assert.ok(list.indexOf('<RoutineCreateForm') < list.indexOf('<table'));
});

test('T2 nothing collapses: no ▸/▾, no expanded state, no click on a row', () => {
  for (const f of [...TABLE, SECTION_E]) {
    const body = code(f);
    assert.doesNotMatch(body, /[▸▾]/, `${f} draws no expand arrow`);
    // FORM-01 (2026-10-19): the forms' "more" block (aria-expanded) is the form's own fold, not a row's — rows still never collapse.
    assert.doesNotMatch(body.replace(/aria-expanded=\{more\}/g, ''), /expanded|setExpanded|collapsed/i, `${f} holds no expanded state`);
  }
  for (const f of TABLE) assert.doesNotMatch(code(f), /<(tr|tbody|td)\b[^>]*onClick/, `${f}: no row toggles on click`);
});

test('T2 the routine cell holds what R2 names, and the RRULE, last evaluated and ideal time have left', () => {
  const row = code(ROW);
  const cellAt = row.indexOf('const routineCell = (rowSpan: number, addLine: (() => void) | null) => (');
  assert.ok(cellAt > -1);
  const cell = row.slice(cellAt, row.indexOf('\n  );\n', cellAt));
  assert.match(cell, /<td rowSpan=\{rowSpan\}[^>]*data-routine-cell>/, 'the cell spans the routine\'s line rows');
  const inOrder = [
    '{routine.name}',
    'inactive',
    '{routine.description}',
    '{book ? book.name : ACCOUNT_CELL_WORDS.bookNotLoaded}',
    // FORM-01 (2026-10-19): the time range left the small print — the Time column says the window.
    // ROUTINE-02a (2026-10-18): the zone as Intl's list spells it; "ended <date>" in place of a next once nothing remains before the end.
    '{canonicalZone(routine.timezone) ?? routine.timezone}',
    '`next: ${formatDateTime(routine.next_due_at, routine.timezone)}`',
    'formatDate(routine.start_date)',
    'fail threshold {routine.fail_threshold_minutes} min',
    '{plannedLine(planned)}',
    '{ignoredLine(planned)}',
    // FORM-01 (2026-10-19): the place block left the cell — the hub map keeps reading what is stored.
    'last done {formatDateTime(routine.last_completed_at, routine.timezone)}',
    'onClick={enterEdit}',
    'onClick={handleToggleActive}',
    'onClick={handleDelete}',
    '+ line',
  ];
  let at = -1;
  for (const piece of inOrder) {
    const next = cell.indexOf(piece, at + 1);
    assert.ok(next > at, `the routine cell draws ${piece} (in order)`);
    at = next;
  }
  assert.match(cell, /data-routine-next-due>\n\s*\{routine\.next_due_at === null && routine\.end_date !== null\n\s*\? endedWords\(formatDate\(routine\.end_date\)\)\n\s*: `next: \$\{formatDateTime\(routine\.next_due_at, routine\.timezone\)\}`\}/);
  assert.match(row, /const book = entities\.find\(\(e\) => e\.id === routine\.entity_id\);/);
  assert.match(row, /const planned = routinePlanned\(\{ budget_amount: routine\.budget_amount \?\? null, coa_code: routine\.coa_code \?\? null, steps: routine\.steps \}\);/);
  // What left the screen.
  assert.doesNotMatch(row, /\{routine\.schedule_rrule\}/, 'the raw RRULE');
  assert.doesNotMatch(row, /last_evaluated_at/, 'last evaluated');
  assert.doesNotMatch(row, /routine\.ideal_time_label/, 'the ideal time label');
  // FORM-01 (2026-10-19): the edit form's "more" block asks the ideal time label (moved there from the builder); the CELL still shows none of these.
  assert.doesNotMatch(cell, /schedule \(rrule\)|last evaluated|ideal time/);
  assert.doesNotMatch(row, /schedule \(rrule\)|last evaluated/);
});

test('T2 a line row: (blank under Cadence) · Activity (· sub-activity, notes) under Days · time of day under Time · Amount · Account · edit delete ↑ ↓ — FORM-01', () => {
  // FORM-01 (2026-10-19): Where and Minutes are gone; the activity sits under Days, the time of day under Time. Moved, never loosened.
  const lines = code(LINES);
  assert.doesNotMatch(lines, /data-line-where|data-line-minutes|step\.location|step\.duration_minutes/, 'Where and Minutes left the rows');
  const viewAt = lines.indexOf('data-line-activity>');
  assert.ok(viewAt > -1);
  const view = lines.slice(viewAt, lines.indexOf('{openAdd && (', viewAt));
  const cells = [
    '{step.activity}',
    '· {step.sub_activity}',
    '{step.notes}',
    'data-line-when>',
    '{step.time_of_day && step.time_of_day.slice(11, 16)}',
    'data-step-planned>',
    '{step.budget_amount != null && formatBudgetPerOccurrence(step.budget_amount)}',
    'data-step-coa>',
    '<AccountText cell={accountCell(entities, routine.entity_id, step.coa_code)} />',
    'onClick={() => enterEdit(step)}',
    'onClick={() => handleDelete(step)}',
    'onClick={() => handleMove(index, -1)}',
    'onClick={() => handleMove(index, 1)}',
  ];
  let at = -1;
  for (const piece of cells) {
    const next = view.indexOf(piece, at + 1);
    assert.ok(next > at, `the line row draws ${piece} (in order)`);
    at = next;
  }
  assert.ok(view.indexOf('↑') < view.indexOf('↓'));
  // Every line of every routine is a row under the routine's own row; the cell rides the routine's row and spans them all.
  assert.match(lines, /\{steps\.map\(\(step, index\) => \(\n\s*<tr key=\{step\.id\} data-routine-line=\{step\.id\}>\n\s*\{editingId === step\.id \? \(/);
  assert.match(lines, /<tr data-routine-main>\n\s*\{cell\}\n\s*<td[^>]*data-routine-cadence>\{cadenceWords\(routine\.schedule_rrule\)\}<\/td>\n\s*<td[^>]*data-routine-days>\{daysWords\(routine\.schedule_rrule, routine\.start_date\)\}<\/td>\n\s*<td[^>]*data-routine-time>\{timeWords\(routine\)\}<\/td>/);
  // A routine with no lines carries its own amount and account on its row; with lines, the lines carry them below.
  const main = lines.slice(lines.indexOf('<tr data-routine-main>'), lines.indexOf('</tr>', lines.indexOf('<tr data-routine-main>')));
  for (const piece of ['{steps.length === 0 ? (', 'data-routine-own-amount', 'formatBudgetPerOccurrence(routine.budget_amount)', 'data-routine-own-account', '<AccountText cell={accountCell(entities, routine.entity_id, routine.coa_code)} />', 'data-routine-lines-carry']) {
    assert.ok(main.includes(piece), `the routine's row draws ${piece}`);
  }
  assert.doesNotMatch(lines, /data-routine-no-lines/, 'the no-lines row is the routine\'s own row now');
});

test('T2 every code on the table is drawn through the one helper — never a bare code', () => {
  for (const f of TABLE) {
    const body = code(f);
    assert.doesNotMatch(body, /\{\s*(step|routine|planned|r|s)\.(coa_code|coaCode)\s*\}/, `${f} draws a saved code verbatim`);
    assert.doesNotMatch(body, /deriveAccountString|parseCode/, `${f} restates the helper`);
  }
  assert.equal((code(LINES).match(/accountCell\(/g) ?? []).length, 2, 'the line\'s code and the routine\'s own');
  assert.equal((code(ROW).match(/accountCell\(/g) ?? []).length, 1, 'the figure\'s account');
  assert.match(code(ROW), /<AccountText cell=\{accountCell\(entities, routine\.entity_id, planned\.coaCode\)\} \/>/);
  assert.doesNotMatch(code(LIST), /coa_code|coaCode|accountCell/, 'the list draws no code');
  // The helper's words are what renders — each state has its own look, blank renders nothing.
  assert.match(code(LINES), /export function AccountText\(\{ cell \}: \{ cell: AccountCell \}\) \{\n\s*if \(cell\.state === 'blank'\) return null;/);
  assert.match(code(LINES), /data-account-state=\{cell\.state\}>\{cell\.text\}</);
  // The entity list is the tab's own — with entity_type — and nothing is fetched anew.
  assert.match(code(SECTION_E), /const \{ entities \} = useOperationsEntity\(\);/);
  // TASKS-ONE-02 (2026-10-14): the section mounts the list alone now — Today, and the two refresh props it passed with
  // it, went with TodaysStrip (Alex's ruling) — so the props fit on one line. Moved: the entity list is still the tab's.
  assert.match(code(SECTION_E), /<RoutineList entities=\{entities\} \/>/);
  for (const f of [LIST, ROW]) assert.match(code(f), /import type \{ Entity \} from '\.\.\/EntitySelector';/, `${f} takes the entity list with its entity_type`);
  const fetches = TABLE.flatMap((f) => [...code(f).matchAll(/fetch\(\s*([`'][^`']*[`'])/g)].map((m) => m[1]));
  for (const url of fetches) assert.match(url, /^[`']\/api\/operations\/routines/, `the table fetches only the routines routes, not ${url}`);
});

test('T2 editing is in place: the routine\'s edit form is a full-width row under its rows; a line\'s edit is its row', () => {
  const row = code(ROW);
  const stepsAt = row.indexOf('<RoutineStepList');
  const editAt = row.indexOf('<tr data-routine-editing>');
  assert.ok(stepsAt > -1 && editAt > stepsAt, 'the edit row comes directly under the routine\'s rows');
  assert.match(row, /\{editing && \(\n\s*<tr data-routine-editing>\n\s*<td colSpan=\{ROUTINE_TABLE_COLUMNS\}/);
  // Today's edit form: the same fields, routineToForm, FindThisPlace.
  assert.match(row, /setForm\(routineToForm\(routine\)\);\n\s*setEditing\(true\);/);
  const form = row.slice(editAt);
  // ROUTINE-02b (2026-10-18): the start and end times are the builder's fields now (RRULEBuilder.tsx) — the row carries them through it.
  // FORM-01 (2026-10-19): days and time are the builder's two fields; the once date is the days control's; the place left the form.
  for (const piece of ['value={form.name}', '<DaysField form={form} setForm={setForm} />', '<TimeField form={form} setForm={setForm} />', 'value={form.budget_amount ?? \'\'}', '<CoaSelect', 'value={form.entity_id}', 'value={form.description}', 'onClick={handleSave}', 'onClick={cancelEdit}']) {
    assert.ok(form.includes(piece), `the edit row carries ${piece}`);
  }
  // Its refusal is the route's own message, shown in that row.
  assert.match(row, /setError\(body\?\.message \?\? body\?\.error \?\? 'failed to save'\);/);
  assert.match(form, /\{error && \(\n\s*<div[^>]*>\n\s*\{error\}/);

  const lines = code(LINES);
  // A line's edit turns ITS row into the line inputs.
  assert.match(lines, /\{editingId === step\.id \? \(\n\s*inputCells\(editForm, setEditForm, step\.id, \{/);
  // "+ line" opens the input row at the end of the routine's rows; the routine's cell spans it.
  assert.match(code(ROW), /onClick=\{\(\) => addLine\?\.\(\)\}\n\s*disabled=\{addLine === null\}/);
  assert.match(lines, /const rowSpan = 1 \+ steps\.length \+ \(openAdd \? 1 : 0\);/); // FORM-01 (2026-10-19): the routine's own row, then the lines
  // ROUTINE-02a (2026-10-18): an ended routine (readOnly) is handed no "+ line" either.
  assert.match(lines, /const cell = routineCell\(rowSpan, openAdd \|\| readOnly \? null : startAdd\);/);
  assert.ok(lines.indexOf('{steps.map((step, index)') < lines.indexOf('{openAdd && ('), 'the new line\'s row is the last');
  assert.match(lines, /\{openAdd && \(\n\s*<tr[^>]*data-line-new>\n\s*\{inputCells\(addForm, setAddForm, NEW_LINE_ROW, \{/);
  // Today's line inputs, every one.
  const inputs = lines.slice(lines.indexOf('const inputCells = ('), lines.indexOf('const rowSpan ='));
  // FORM-01 (2026-10-19): the location and duration inputs left the line editor with their columns.
  for (const piece of ['value={form.activity}', 'value={form.sub_activity}', 'value={form.notes}', 'type="time"\n          value={form.time_of_day}', 'value={form.budget_amount}', 'data-step-amount', '<CoaSelect\n          entityId={routine.entity_id}\n          value={form.coa_code}']) {
    assert.ok(inputs.includes(piece), `the line inputs carry ${piece}`);
  }
  // Refusals: the route's own message, on the row it refused.
  assert.match(lines, /setError\(\{ row: NEW_LINE_ROW, message: body\?\.message \?\? body\?\.error \?\? 'failed to create step' \}\);/);
  assert.match(lines, /setError\(\{ row: stepId, message: body\?\.message \?\? body\?\.error \?\? 'failed to save step' \}\);/);
  assert.match(lines, /setError\(\{ row: step\.id, message: body\?\.message \?\? body\?\.error \?\? 'failed to delete step' \}\);/);
  assert.match(inputs, /\{refusalOn\(row\)\}/);
  assert.match(lines, /\{step\.notes && \(\n\s*<div[^>]*>\{step\.notes\}<\/div>\n\s*\)\}\n\s*\{refusalOn\(step\.id\)\}/);
});

test('T2 a new line\'s time starts blank — nothing derives it', () => {
  const lines = code(LINES);
  assert.doesNotMatch(lines, /getAutoFillTime|STEP_DEFAULT_INTERVAL_MINUTES|routine\.start_time/);
  assert.match(lines, /const startAdd = \(\) => \{\n\s*setAddForm\(EMPTY_FORM\);\n\s*setError\(null\);\n\s*setOpenAdd\(true\);\n\s*\};/);
  assert.match(lines, /const EMPTY_FORM: StepForm = \{\n\s*activity: '',\n\s*time_of_day: '',/);
});

test('T2 Scenify and Take leave this screen; Scenify stays on the Content tab; Take waits there, unmounted', () => {
  for (const f of [...TABLE, SECTION_E]) {
    const body = code(f);
    assert.doesNotMatch(body, /ScenifyButton|TakeifyButton|onScenify|onTakeify|handleScenify|handleTakeify|ContentTable|🎬/, `${f} carries no Scenify or Take`);
  }
  assert.match(code(CONTENT_LIST), /<ScenifyButton routine=\{r\} onScenify=\{onScenify\} \/>/);
  const mounts = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components')].filter((f) => f !== TAKEIFY && /TakeifyButton/.test(code(f)));
  assert.deepEqual(mounts, [], 'TakeifyButton is mounted nowhere');
  assert.match(comments(TAKEIFY), /UNMOUNTED \(ROUTINES-01, 2026-09-30\)/);
  assert.match(comments(TAKEIFY), /waits for the Content tab/);
});
