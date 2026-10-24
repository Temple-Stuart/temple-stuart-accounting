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
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { code } from '../sourceText';
import { ACCOUNT_CELL_WORDS, accountCell, type AccountCellBook } from '../coa/accountCell';
import { CADENCE_GROUP_ORDER } from '@/components/workbench/operations/routines/types';

const HELPER = 'src/lib/coa/accountCell.ts';
// WORK-01 (Alex, 2026-10-24): THE ROUTINES ARE ROWS OF THE WORK. RoutineList and RoutineRow left with the per-book tables;
// the routines are rows of /tasks' one DataTable (SectionE_Work over src/lib/operations/work.ts — one row per line), and the
// routine's editor (RoutineEditForm, RoutineRow's form lifted) draws its lines in the FORM-01 table through RoutineStepList.
// Every T2 pin below moved to the new files; none was loosened.
const SECTION_E = 'src/components/workbench/operations/SectionE_Work.tsx';
const EDIT_FORM = 'src/components/workbench/operations/routines/RoutineEditForm.tsx';
const LINES = 'src/components/workbench/operations/routines/RoutineStepList.tsx';
const WORK_LIB = 'src/lib/operations/work.ts';
// TIME-02 (2026-10-19): TakeifyButton.tsx and AvailableRoutinesList.tsx are deleted with the content pipeline — the two
// names stay so T2 can pin the absence.
const TAKEIFY = 'src/components/workbench/operations/content/TakeifyButton.tsx';
const CONTENT_LIST = 'src/components/workbench/operations/content/AvailableRoutinesList.tsx';
const TABLE = [SECTION_E, EDIT_FORM, LINES, WORK_LIB];

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

test('T2 one table: the routines are rows of THE WORK (the shared DataTable); the lines keep their FORM-01 table — Routine · Cadence · Days · Time · Amount · Account · controls — inside the editor', () => {
  const e = code(SECTION_E);
  assert.match(e, /<DataTable\n\s*name=\{name\}/, 'the shared table (IDIOM-01)');
  assert.doesNotMatch(e, /<table\b|<thead>/, 'no table of its own');
  const f = code(EDIT_FORM);
  assert.equal((f.match(/<table\b/g) ?? []).length, 1, 'the lines\' table, once, in the editor');
  assert.equal((f.match(/<thead>/g) ?? []).length, 1, 'one header');
  assert.doesNotMatch(code(LINES), /<table\b/, `${LINES} draws rows of the one table, not a table of its own`);
  const heads = [...f.matchAll(/<th\b[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(heads, ['Routine', 'Cadence', 'Days', 'Time', 'Amount', 'Account', ''], 'FORM-01 (2026-10-19): Routine · Cadence · Days · Time · Amount · Account — Where, Activity and Minutes are gone');
  const columns = Number(/export const ROUTINE_TABLE_COLUMNS = (\d+);/.exec(code(LINES))?.[1]);
  assert.equal(columns, heads.length, 'the column count is the header\'s');
  // ROUTINE-02a (2026-10-18): the editor is handed THE WORK's judgement of the end, and its lines are read-only then (routine02a T6).
  assert.match(e, /<RoutineEditForm routine=\{routine\} end=\{end\} entities=\{entities\} onChanged=\{onChanged\} onClose=\{\(\) => setEditing\(false\)\} \/>/);
  assert.match(f, /<tbody className=\{[^}]*\} data-routine-rows=\{routine\.id\} data-routine-is-ended=\{end\.ended \? 'true' : undefined\}>\n\s*<RoutineStepList routine=\{routine\} entities=\{entities\} onUpdate=\{onChanged\} routineCell=\{routineCell\} readOnly=\{end\.ended\} \/>/);
});

test('T2 the rows are in clock order — no cadence group rows (FORM-01); "+ routine", the STATUS chip and the create form stay where they are', () => {
  assert.deepEqual(CADENCE_GROUP_ORDER, ['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']);
  const w = code(WORK_LIB);
  assert.match(w, /for \(const routine of \[\.\.\.routines\]\.sort\(byClockThenName\)\) \{/, 'clock order then name, every book in one table (WORK-01)');
  for (const f of [SECTION_E, WORK_LIB]) assert.doesNotMatch(code(f), /CADENCE_GROUP_ORDER|data-cadence-group/);
  // ROUTINE-02a (2026-10-18): the ended routines are judged in THE WORK's rows (STATUS); the default STATUS filter drops them and its chip clears (work01 T3).
  assert.match(w, /const end = endedBy\(routine\.end_date, routine\.timezone, now\);/);
  const e = code(SECTION_E);
  assert.ok(e.indexOf('ADD_ROUTINE_WORDS}') < e.indexOf('statusChipWords('), '"+ routine", then the STATUS chip, in the controls row');
  assert.ok(e.indexOf('statusChipWords(') < e.indexOf('<RoutineCreateForm'), 'the create form opens under the controls');
  assert.match(e, /\{workCountWords\(shown\.length, rows\.length\)\}/, 'the count is of the rows shown over the rows loaded');
});

test('T2 nothing collapses on its own: no ▸/▾, no expanded row state, no click on a row — a row\'s "edit" opens its editor under it (WORK-01 ruling D), and that is the one fold', () => {
  for (const f of TABLE) {
    const body = code(f);
    assert.doesNotMatch(body, /[▸▾]/, `${f} draws no expand arrow`);
    // FORM-01 (2026-10-19): the forms' "more" block (aria-expanded) is the form's own fold; WORK-01 (2026-10-24): the row's "edit" is an a11y-expanded control over its editor.
    assert.doesNotMatch(body.replace(/aria-expanded=\{[^}]+\}/g, ''), /expanded|setExpanded|collapsed/i, `${f} holds no expanded state`);
    assert.doesNotMatch(body, /<(tr|tbody|td)\b[^>]*onClick/, `${f}: no row toggles on click`);
  }
});

test('T2 the editor says what the routine cell said beyond THE WORK\'s columns, in order; the RRULE, last evaluated and ideal time have left; the controls are the row\'s', () => {
  const f = code(EDIT_FORM);
  const cellAt = f.indexOf('data-routine-small-print-block>');
  assert.ok(cellAt > -1);
  const cell = f.slice(cellAt, f.indexOf('data-routine-lines-table', cellAt));
  const inOrder = [
    '{routine.name}',
    'inactive',
    '{routine.description}',
    '{book ? book.name : ACCOUNT_CELL_WORDS.bookNotLoaded}',
    '{canonicalZone(routine.timezone) ?? routine.timezone}',
    '`next: ${formatDateTime(routine.next_due_at, routine.timezone)}`',
    'formatDate(routine.start_date)',
    'fail threshold {routine.fail_threshold_minutes} min',
    '{plannedLine(planned)}',
    '{ignoredLine(planned)}',
    'last done {formatDateTime(routine.last_completed_at, routine.timezone)}',
  ];
  let at = -1;
  for (const piece of inOrder) {
    const next = cell.indexOf(piece, at + 1);
    assert.ok(next > at, `the editor's head draws ${piece} (in order)`);
    at = next;
  }
  assert.match(cell, /data-routine-next-due>\n\s*\{routine\.next_due_at === null && routine\.end_date !== null\n\s*\? endedWords\(formatDate\(routine\.end_date\)\)\n\s*: `next: \$\{formatDateTime\(routine\.next_due_at, routine\.timezone\)\}`\}/);
  assert.match(f, /const book = entities\.find\(\(e\) => e\.id === routine\.entity_id\);/);
  assert.match(f, /const planned = routinePlanned\(\{ budget_amount: routine\.budget_amount \?\? null, coa_code: routine\.coa_code \?\? null, steps: routine\.steps \}\);/);
  // The controls: edit · deactivate/reactivate · delete on THE WORK's row; "+ line" in the editor's routine cell.
  const e = code(SECTION_E);
  for (const piece of ['onClick={() => setEditing(!editing)}', 'onClick={handleToggleActive}', 'onClick={handleDelete}']) assert.ok(e.includes(piece), `the row draws ${piece}`);
  assert.match(f, /onClick=\{\(\) => addLine\?\.\(\)\}\n\s*disabled=\{addLine === null\}/);
  // What left the screen.
  assert.doesNotMatch(f, /\{routine\.schedule_rrule\}/, 'the raw RRULE');
  assert.doesNotMatch(f, /last_evaluated_at/, 'last evaluated');
  assert.doesNotMatch(f, /routine\.ideal_time_label/, 'the ideal time label');
  assert.doesNotMatch(cell, /schedule \(rrule\)|last evaluated|ideal time/);
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
  assert.equal((code(EDIT_FORM).match(/accountCell\(/g) ?? []).length, 1, 'the figure\'s account');
  assert.match(code(EDIT_FORM), /<AccountText cell=\{accountCell\(entities, routine\.entity_id, planned\.coaCode\)\} \/>/);
  // WORK-01: THE WORK's ACCOUNT column goes through the helper too (work.ts accountWordsOf) — the section draws no code.
  assert.equal((code(WORK_LIB).match(/accountCell\(/g) ?? []).length, 1);
  assert.match(code(WORK_LIB), /const cell = accountCell\(books, bookId, savedCodeOf\(row\)\);/);
  assert.doesNotMatch(code(SECTION_E), /coa_code|coaCode|accountCell\(/, 'the section draws no code');
  assert.match(code(LINES), /export function AccountText\(\{ cell \}: \{ cell: AccountCell \}\) \{\n\s*if \(cell\.state === 'blank'\) return null;/);
  assert.match(code(LINES), /data-account-state=\{cell\.state\}>\{cell\.text\}</);
  // The entity list is the tab's own — with entity_type — and nothing is fetched anew for it.
  assert.match(code(SECTION_E), /const \{ entities \} = useOperationsEntity\(\);/);
  assert.match(code(EDIT_FORM), /import type \{ Entity \} from '\.\.\/EntitySelector';/);
  const fetches = [EDIT_FORM, LINES].flatMap((f) => [...code(f).matchAll(/fetch\(\s*([`'][^`']*[`'])/g)].map((m) => m[1]));
  for (const url of fetches) assert.match(url, /^[`']\/api\/operations\/routines/, `the editor fetches only the routines routes, not ${url}`);
  // THE WORK reads the routines, the projects with their tasks and the books' charts, and writes through the routines and tasks routes alone.
  for (const url of [...code(SECTION_E).matchAll(/fetch\(\s*([`'][^`']*[`'])/g)].map((m) => m[1])) assert.match(url, /^[`']\/api\/operations\/(routines|projects)/, `not ${url}`);
  for (const url of [...code(SECTION_E).matchAll(/readJson\(\s*([`'][^`']*[`'])/g)].map((m) => m[1])) assert.match(url, /^[`']\/api\/(operations\/(routines|projects)|chart-of-accounts)/, `not ${url}`);
});

test('T2 editing is in place: the routine\'s editor opens under its row on THE WORK (ruling D); a line\'s edit is its row', () => {
  const e = code(SECTION_E);
  assert.match(e, /\{editing && \(\n\s*<tr \{\.\.\.dataAttr\(name, 'editing', row\.id\)\}>\n\s*<td colSpan=\{columns\.length \+ 1\}/, 'the editor row comes directly under the row');
  const f = code(EDIT_FORM);
  // The same form, seeded by routineToForm on open; the lines above it.
  assert.match(f, /const \[form, setForm\] = useState<RoutineForm>\(\(\) => routineToForm\(routine\)\);/);
  const linesAt = f.indexOf('<RoutineStepList');
  const editAt = f.indexOf('data-routine-editing>');
  assert.ok(linesAt > -1 && editAt > linesAt, 'the lines, then the form');
  const form = f.slice(editAt);
  // ROUTINE-02b (2026-10-18): the start and end times are the builder's fields now (RRULEBuilder.tsx) — the form carries them through it.
  // FORM-01 (2026-10-19): days and time are the builder's two fields; the once date is the days control's; the place left the form.
  for (const piece of ['value={form.name}', '<DaysField form={form} setForm={setForm} />', '<TimeField form={form} setForm={setForm} />', 'value={form.budget_amount ?? \'\'}', '<CoaSelect', 'value={form.entity_id}', 'value={form.timezone}', 'value={form.fail_threshold_minutes}', 'value={form.description}', 'value={form.ideal_time_label}']) {
    assert.ok(form.includes(piece), `the form carries ${piece}`);
  }
  // Its refusal is the route's own message, shown in the form.
  assert.match(f, /setError\(body\?\.message \?\? body\?\.error \?\? 'failed to save'\);/);
  assert.match(form, /\{error && \(\n\s*<div[^>]*>\n\s*\{error\}/);

  const lines = code(LINES);
  // A line's edit turns ITS row into the line inputs.
  assert.match(lines, /\{editingId === step\.id \? \(\n\s*inputCells\(editForm, setEditForm, step\.id, \{/);
  // "+ line" opens the input row at the end of the routine's rows; the routine's cell spans it.
  assert.match(f, /onClick=\{\(\) => addLine\?\.\(\)\}\n\s*disabled=\{addLine === null\}/);
  assert.match(lines, /const rowSpan = 1 \+ steps\.length \+ \(openAdd \? 1 : 0\);/);
  // ROUTINE-02a (2026-10-18): an ended routine (readOnly) is handed no "+ line" either.
  assert.match(lines, /const cell = routineCell\(rowSpan, openAdd \|\| readOnly \? null : startAdd\);/);
  assert.ok(lines.indexOf('{steps.map((step, index)') < lines.indexOf('{openAdd && ('), 'the new line\'s row is the last');
  assert.match(lines, /\{openAdd && \(\n\s*<tr[^>]*data-line-new>\n\s*\{inputCells\(addForm, setAddForm, NEW_LINE_ROW, \{/);
  // Today's line inputs, every one.
  const inputs = lines.slice(lines.indexOf('const inputCells = ('), lines.indexOf('const rowSpan ='));
  for (const piece of ['value={form.activity}', 'value={form.sub_activity}', 'value={form.notes}', 'type="time"\n          value={form.time_of_day}', 'value={form.budget_amount}', 'data-step-amount', '<CoaSelect\n          entityId={routine.entity_id}']) {
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

test('T2 Scenify and Take leave this screen; TIME-02 (2026-10-19): both are deleted with the content pipeline, mounted nowhere', () => {
  for (const f of TABLE) {
    const body = code(f);
    assert.doesNotMatch(body, /ScenifyButton|TakeifyButton|onScenify|onTakeify|handleScenify|handleTakeify|ContentTable|🎬/, `${f} carries no Scenify or Take`);
  }
  // ROUTINES-01 (2026-09-30) left Scenify on the Content tab and Take waiting there, unmounted; TIME-02 retired the
  // tab: the two files are gone, and no file under src/app or src/components names either button.
  for (const f of [TAKEIFY, CONTENT_LIST]) assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is deleted (TIME-02)`);
  const mounts = [...tsFilesUnder('src/app'), ...tsFilesUnder('src/components')].filter((f) => /TakeifyButton|ScenifyButton/.test(code(f)));
  assert.deepEqual(mounts, [], 'neither button is mounted anywhere');
});
