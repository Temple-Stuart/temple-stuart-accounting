/**
 * FORM-BOUNDS-01 (Alex, 2026-11-25) — "+ EXPENSE" PLANS A STOP STILL AHEAD, AND THE TWO FORMS REFUSE FIRST WHAT THE RECORD STEP WOULD.
 *
 * "+ expense" is handed the clock: a stop still ahead of it is PLANNED — the stop and its vendor are written and the record is not
 * asked — and a box of the record typed for it is refused by name before anything is written. In "+ expense" and in the row's record
 * form, an ACTUAL past the column's range and a DESCRIPTION that holds a control character are refused in the form, naming the box.
 * The stops rule (src/lib/operations/stopRecord.ts stopInput) takes and refuses exactly what it did: its control test has a name now
 * (holdsControl), and the two forms read the same one.
 *
 * HERMETIC, on timesheet02.test.ts's model — no database, no network, and the only clock is the `now` handed in. The three rules are
 * DRIVEN directly; every name, day, place and amount below is made up. The rule files, the form and the route are anchored to their
 * source with comments stripped (the reader law). The one line number named here is the form's create, which the registry cites —
 * it is read from the citation itself and held to what main cites.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, functionBody, rejoin } from '../sourceText';
import { CENTS_MAX, DONE_AT_SKEW_MS, MINUTES_MAX, NOTE_MAX, SKIP_REASON_WORDS, amountWords, holdsControl, stopInput, type StopRecordRow } from '../operations/stopRecord';
import { TOOL_REGISTRY } from '../toolRegistry';
import {
  ACTUAL_RANGE_WORDS, EMPTY_EXPENSE, EXPENSE_STEPS, NOTE_CONTROL_WORDS, NOTE_LONG_WORDS, NOT_ASKED_WORDS, NOT_TRIED_WORDS, RECORD_AHEAD_WORDS, STOP_AHEAD_WORDS, VENDOR_BOTH_WORDS, WRITTEN_WORDS,
  aheadFieldWords, expenseInput, outcomeWords, recordBody, recordInput, requiredWords, starsTypedWords, withNotTried,
  type ExpenseDraft, type ExpenseOutcome, type ExpenseValues, type LedgerAddress, type LedgerRecordingTaken, type RecordDraft,
} from '../operations/ledger';

const STOPS = 'src/lib/operations/stopRecord.ts';
const RULES = 'src/lib/operations/ledger.ts';
const FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const LEAF = 'src/components/workbench/operations/ledger/RecordForm.tsx';
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';

/** A whole file, comment and code alike (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));
/** A file's lines as the reader gives them (comments stripped, every line kept in its place). */
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;
/** One exported function of a file, comments stripped — or the test fails by name. */
const bodyOfFunction = (file: string, name: string): string => {
  const body = functionBody(code(file), name);
  if (body === null) return assert.fail(`${file} exports the function ${name}`);
  return body;
};

// ── THE FIXTURE — a stop on a made-up day, in a zone three hours ahead of UTC the year round ──

const NBO = 'Africa/Nairobi';
const MON = '2027-05-10';
/** Monday 12:30 in the zone. */
const STOP = '2027-05-10T09:30:00.000Z';
const STOP_MS = Date.parse(STOP);
const MINUTE_MS = 60_000;
/** By this clock the stop has come — an hour ago. */
const AFTER = new Date(STOP_MS + 60 * MINUTE_MS);
/** The stop is ahead of this clock by exactly the skew the stops rule allows a done time: the edge, on the taken side. */
const AT_SKEW = new Date(STOP_MS - DONE_AT_SKEW_MS);
/** One millisecond, and one minute, further back: the stop is past the skew. */
const A_TICK_SHORT = new Date(STOP_MS - DONE_AT_SKEW_MS - 1);
const A_MINUTE_SHORT = new Date(STOP_MS - DONE_AT_SKEW_MS - MINUTE_MS);
/** The day before: the stop is plainly still ahead. */
const DAY_BEFORE = new Date(STOP_MS - 24 * 60 * MINUTE_MS);

/** "+ expense", every box of the plan typed and no box of the record. */
const DRAFT: ExpenseDraft = { ...EMPTY_EXPENSE, day: MON, time: '12:30', name: 'Soup', amount: '6.50', coa: '6150', book: 'P' };
const PLANNED_VALUE: ExpenseValues = { day: MON, time: '12:30', zone: NBO, instant: STOP, name: 'Soup', amount: '6.50', coa: '6150', bookId: 'P', location: null, vendor: { kind: 'none' }, actualCents: null, rating: null, note: null, ahead: true }; // COALEVELS-01 (2026-11-27): the value says the stop's Location — null: the draft's box is left at none
const expense = (over: Partial<ExpenseDraft>, now: Date) => expenseInput({ ...DRAFT, ...over }, NBO, now);
/** An accepted "+ expense" — or the test fails with the refusal's words. */
const expenseValue = (over: Partial<ExpenseDraft>, now: Date): ExpenseValues => {
  const read = expense(over, now);
  if (!read.ok) return assert.fail(`refused: ${read.field} — ${read.message}`);
  return read.value;
};

/** The row's record form: a stop at the same instant, nothing held. */
const ADDRESS: LedgerAddress = { kind: 'routine_line', id: 'soup', instant: STOP };
const FIRST: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'> = { plannedAt: STOP, held: null };
const BLANK: RecordDraft = { went: 'went', actual: '', stars: '', minutes: '', note: '', notes: '' }; // TIMESHEET-04b (2026-11-27): the draft holds a NOTES box — blank in these drafts
const record = (over: Partial<RecordDraft>, now: Date, given: Pick<LedgerRecordingTaken, 'plannedAt' | 'held'> = FIRST) => recordInput({ ...BLANK, ...over }, ADDRESS, given, now);

/** The stops POST's body for that stop, done at its own instant — what the route's rule is handed. */
const BASE = { kind: 'routine_line', id: 'soup', instant: STOP, outcome: 'done', done_at: STOP } as const;

/** One of each kind the control test refuses: C0, DEL, C1, and a surrogate half with no partner — high, then low. */
const CONTROLS: readonly (readonly [string, string])[] = [
  ['\u0000', 'NUL'], ['\u0007', 'BEL'], ['\u001b', 'ESC'], ['\u001f', 'the last C0 control'], ['\u007f', 'DEL'],
  ['\u0080', 'the first C1 control'], ['\u0085', 'NEL'], ['\u009f', 'the last C1 control'], ['\ud83d', 'a high half alone'], ['\ude00', 'a low half alone'],
];
const WHOLE_PAIR = '😀';

// ── T1 · THE ONE NAMED TEST (ruling A) ───────────────────────────────────────

test('T1 holdsControl: a C0 control, DEL, a C1 control, a lone high half and a lone low half → true, wherever they stand; a whole pair, plain words, a space → false', () => {
  for (const [c, name] of CONTROLS) {
    assert.equal(holdsControl(c), true, name);
    assert.equal(holdsControl(`so${c}up`), true, `${name}, among words`);
    assert.equal(holdsControl(`${c}soup`), true, `${name}, first`);
    assert.equal(holdsControl(`soup${c}`), true, `${name}, last`);
  }
  // A half is alone unless its partner stands on its own side of it.
  assert.equal(holdsControl('\ude00\ud83d'), true, 'low then high: two halves, no pair');
  assert.equal(holdsControl(`\ud83d${WHOLE_PAIR}`), true, 'a high half before a whole pair');
  assert.equal(holdsControl(`${WHOLE_PAIR}\ude00`), true, 'a low half after a whole pair');
  for (const [text, name] of [[WHOLE_PAIR, 'a whole pair'], [`soup ${WHOLE_PAIR} bread`, 'a whole pair among words'], ['plain words', 'plain words'], [' ', 'a space'], ['', 'nothing'], ['two kinds — of soup · 2', 'dashes and dots'], ['~', 'the last printable ASCII'], [' ', 'a no-break space, past the C1 block'], ['crème brûlée', 'accents']] as const) {
    assert.equal(holdsControl(text), false, name);
  }
  // A tab and a line break ARE controls to the test itself — which is why every reader collapses a note's spaces before asking it.
  assert.deepEqual([holdsControl('\t'), holdsControl('\n'), holdsControl('two\tkinds'.replace(/\s+/g, ' '))], [true, true, false]);
});

test('T1 in the source: stopRecord.ts holds each of the two regexes once, in the one exported function directly under CENTS_MAX; stopInput calls it on the collapsed note, for the same field and the same words', () => {
  const stops = code(STOPS);
  const C0_C1 = '/[\\u0000-\\u001f\\u007f-\\u009f]/';
  const HALF = '/[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]/';
  assert.equal(stops.split(C0_C1).length - 1, 1, 'the controls’ regex, once');
  assert.equal(stops.split(HALF).length - 1, 1, 'the lone half’s regex, once');
  assert.ok(stops.includes(`export const holdsControl = (text: string): boolean => ${C0_C1}.test(text) || ${HALF}.test(text);`), 'the two, joined as they were');
  assert.match(stops, /export const CENTS_MAX = 2_147_483_647;\n(?:[ \t]*\n)*export const holdsControl = /, 'directly under CENTS_MAX');
  assert.match(comments(STOPS), /FORM-BOUNDS-01 \(Alex, 2026-11-25\): does the text hold a character a note may not/);
  assert.match(whole(STOPS), /\n\/\/ eslint-disable-next-line no-control-regex\nexport const holdsControl = /, 'its lint line right above it');
  // stopInput: the note trimmed and collapsed, the one named test, then the length — three lines, in this order.
  const rule = bodyOfFunction(STOPS, 'stopInput');
  assert.match(rule, /const n = b\.note\.trim\(\)\.replace\(\/\\s\+\/g, ' '\);\n\s*if \(holdsControl\(n\)\) return refuse\('note', 'control characters are not a note'\);\n\s*if \(n\.length > NOTE_MAX\) return refuse\('note', `note is at most \$\{NOTE_MAX\} characters \(\$\{n\.length\} given\)`\);\n\s*note = n === '' \? null : n;/);
  assert.equal(countOf(stops, /\bholdsControl\b/g), 3, 'defined once, and called twice — by stopInput, on the note and on the notes'); // TIMESHEET-04b (2026-11-27): stopInput reads the notes as it reads the note, by the same one test — 2, 'defined once, and called once — by stopInput', until then
  assert.match(rule, /const n = b\.notes\.trim\(\)\.replace\(\/\\s\+\/g, ' '\);\n\s*if \(holdsControl\(n\)\) return refuse\('notes', 'control characters are not notes'\);\n\s*if \(n\.length > NOTES_MAX\) return refuse\('notes', `notes are at most \$\{NOTES_MAX\} characters \(\$\{n\.length\} given\)`\);\n\s*notes = n === '' \? null : n;/, 'the notes: trimmed and collapsed, the one named test, then the length — the note\'s own three lines');
  assert.doesNotMatch(rule, /\\u0000|\\ud800/, 'no second test left in the rule');
});

// ── T2 · THE STOPS RULE IS WHAT IT WAS (ruling A) ────────────────────────────

test('T2 stopInput takes and refuses what it did: a control in the note → "control characters are not a note"; a tab and a line break → a space, taken; 281 characters → refused; an actual of CENTS_MAX taken, one past it refused; a done_at at the skew taken, a minute past it refused', () => {
  const read = (over: Record<string, unknown>, now: Date = AFTER) => stopInput({ ...BASE, ...over }, now);
  // Taken.
  const collapsed = read({ note: '  two\tkinds\nof  soup ' });
  assert.equal(collapsed.ok && collapsed.value.note, 'two kinds of soup', 'a tab and a line break are spaces, collapsed');
  const longest = read({ note: 'n'.repeat(NOTE_MAX) });
  assert.equal(longest.ok && longest.value.note?.length, 280);
  const pair = read({ note: `soup ${WHOLE_PAIR}` });
  assert.equal(pair.ok && pair.value.note, `soup ${WHOLE_PAIR}`, 'a whole pair is a character');
  const most = read({ actual_cents: CENTS_MAX });
  assert.equal(most.ok && most.value.actualCents, 2_147_483_647);
  assert.equal(read({}, AT_SKEW).ok, true, 'a done time ahead of the clock by exactly the skew');
  assert.equal(read({}, new Date(STOP_MS)).ok, true);
  // Refused, each in the rule's own words.
  const refused = (over: Record<string, unknown>, now: Date = AFTER): [string, string] => {
    const r = read(over, now);
    if (r.ok) return assert.fail(`taken: ${JSON.stringify(over)}`);
    return [r.field, r.message];
  };
  for (const [c, name] of CONTROLS) assert.deepEqual(refused({ note: `so${c}up` }), ['note', 'control characters are not a note'], name);
  assert.deepEqual(refused({ note: 'n'.repeat(NOTE_MAX + 1) }), ['note', 'note is at most 280 characters (281 given)']);
  assert.deepEqual(refused({ note: `${'n'.repeat(NOTE_MAX)}\u0000` }), ['note', 'control characters are not a note'], 'controls, then length');
  assert.deepEqual(refused({ actual_cents: CENTS_MAX + 1 }), ['actual_cents', "actual_cents 2147483648 is past the column's range (2147483647)"]);
  assert.deepEqual(refused({}, A_MINUTE_SHORT), ['done_at', `done_at ${STOP} is in the future`]);
  assert.deepEqual(refused({}, A_TICK_SHORT), ['done_at', `done_at ${STOP} is in the future`], 'one millisecond past the skew');
  assert.deepEqual(refused({ outcome: 'skipped', done_at: null }), ['note', SKIP_REASON_WORDS], 'a skip still needs its reason');
  assert.equal(DONE_AT_SKEW_MS, 10 * MINUTE_MS);
});

// ── T3 · "+ EXPENSE" AND THE CLOCK (ruling B.3) ──────────────────────────────

test('T3 expenseInput and the clock: a stop at exactly the skew is not ahead; a millisecond or a minute past it is — and at each clock stopInput takes recordBody’s done_at exactly when the stop is not ahead: the two tests agree at the edge', () => {
  assert.equal(expenseValue({}, AT_SKEW).ahead, false, 'ahead by exactly the skew: the stops rule would take its done time');
  assert.equal(expenseValue({}, A_TICK_SHORT).ahead, true);
  assert.equal(expenseValue({}, A_MINUTE_SHORT).ahead, true);
  assert.equal(expenseValue({}, DAY_BEFORE).ahead, true);
  assert.equal(expenseValue({}, new Date(STOP_MS)).ahead, false, 'at its own instant');
  assert.equal(expenseValue({}, AFTER).ahead, false);
  // At every clock: the record "+ expense" would ask is taken by the stops rule exactly when the stop is not ahead.
  for (const now of [DAY_BEFORE, A_MINUTE_SHORT, A_TICK_SHORT, AT_SKEW, new Date(STOP_MS), AFTER]) {
    const value = expenseValue({}, now);
    const route = stopInput(recordBody(value, 'line-1'), now);
    assert.equal(route.ok, !value.ahead, `at ${now.toISOString()}`);
    if (!route.ok) assert.deepEqual([route.field, route.message], ['done_at', `done_at ${STOP} is in the future`]);
  }
  // The value: the instant read once — the day and time in the zone — and `ahead`, last.
  assert.deepEqual(expenseValue({}, AFTER), { ...PLANNED_VALUE, ahead: false });
  assert.deepEqual(expenseValue({}, DAY_BEFORE), PLANNED_VALUE);
  assert.equal(Object.keys(expenseValue({}, AFTER)).at(-1), 'ahead');
  // In the source: one read of the instant, before the record's boxes; the test is stopInput's own, term for term.
  const rule = bodyOfFunction(RULES, 'expenseInput');
  assert.match(rule, /^export function expenseInput\(draft: ExpenseDraft, zone: string, now: Date\): ExpenseInputResult \{/);
  assert.equal(countOf(rule, /zonedToInstant\(/g), 1, 'the instant is read once');
  assert.match(rule, /const instant = zonedToInstant\(draft\.day, draft\.time, zone\);\n\s*const ahead = instant\.getTime\(\) > now\.getTime\(\) \+ DONE_AT_SKEW_MS;\n\s*let actualCents: number \| null = null;/);
  assert.match(rule, /instant: instant\.toISOString\(\),/);
  assert.match(bodyOfFunction(STOPS, 'stopInput'), /if \(doneAt\.getTime\(\) > now\.getTime\(\) \+ DONE_AT_SKEW_MS\) return refuse\('done_at', /);
  assert.doesNotMatch(code(RULES), /new Date\(\)|Date\.now\(/, 'the rule file reads no clock of its own');
});

// ── T4 · A STOP STILL AHEAD (ruling B.3) ─────────────────────────────────────

test('T4 a stop ahead with nothing typed is taken — planned: ahead true, actualCents, rating and note null; with ACTUAL, STARS or ITEMS (COALEVELS-01, 2026-11-27 — DESCRIPTION until then) typed it is refused by aheadFieldWords, the first typed box named, before that box’s own reading', () => {
  // Nothing of the record typed: the stop is planned.
  assert.deepEqual(expense({}, DAY_BEFORE), { ok: true, value: PLANNED_VALUE });
  assert.deepEqual(expense({ actual: '  ', stars: ' ', note: ' \t ' }, DAY_BEFORE), { ok: true, value: PLANNED_VALUE }, 'a box of spaces is a blank box');
  // The vendor is the plan's, not the record's: given for a stop ahead, it is kept.
  assert.deepEqual(expenseValue({ vendorId: 'v1' }, DAY_BEFORE), { ...PLANNED_VALUE, vendor: { kind: 'existing', id: 'v1' } });
  assert.deepEqual(expenseValue({ vendorName: ' Oat  House ' }, DAY_BEFORE), { ...PLANNED_VALUE, vendor: { kind: 'new', name: 'Oat House' } });
  // A box of the record, typed: refused by name — the first typed box, in the boxes' order.
  const typed: readonly (readonly [Partial<ExpenseDraft>, 'actual' | 'stars' | 'note'])[] = [
    [{ actual: '7' }, 'actual'], [{ stars: '4' }, 'stars'], [{ note: 'thick' }, 'note'],
    [{ actual: '7', stars: '4', note: 'thick' }, 'actual'], [{ stars: '4', note: 'thick' }, 'stars'], [{ actual: '0' }, 'actual'],
    // Before that box's own reading: what is typed is not read at all.
    [{ actual: 'lots' }, 'actual'], [{ actual: '-1' }, 'actual'], [{ actual: '21474836.48' }, 'actual'], [{ stars: '9' }, 'stars'], [{ stars: 'four' }, 'stars'],
    [{ note: 'so\u0000up' }, 'note'], [{ note: 'n'.repeat(NOTE_MAX + 1) }, 'note'],
  ];
  for (const now of [DAY_BEFORE, A_MINUTE_SHORT, A_TICK_SHORT]) {
    for (const [over, field] of typed) assert.deepEqual(expense(over, now), { ok: false, field, message: aheadFieldWords(field) }, `${JSON.stringify(over)} at ${now.toISOString()}`);
  }
  // The same boxes once the stop's time has come: each read by its own rule.
  assert.deepEqual(expenseValue({ actual: '7', stars: '4', note: 'thick' }, AFTER), { ...PLANNED_VALUE, actualCents: 700, rating: 4, note: 'thick', ahead: false });
  assert.deepEqual(expenseValue({ actual: '7', stars: '4', note: 'thick' }, AT_SKEW), { ...PLANNED_VALUE, actualCents: 700, rating: 4, note: 'thick', ahead: false }, 'at the skew’s edge the record is still the form’s to ask');
  assert.deepEqual(expense({ actual: 'lots' }, AFTER), { ok: false, field: 'actual', message: amountWords('lots') });
  assert.deepEqual(expense({ stars: '9' }, AFTER), { ok: false, field: 'stars', message: starsTypedWords('9') });
  // The plan's own boxes are read first, ahead or not — the first bad box is still the one named.
  assert.deepEqual(expense({ name: '  ', actual: '7' }, DAY_BEFORE), { ok: false, field: 'name', message: requiredWords('name') });
  assert.deepEqual(expense({ amount: '', note: 'thick' }, DAY_BEFORE), { ok: false, field: 'amount', message: requiredWords('amount') });
  assert.deepEqual(expense({ vendorId: 'v1', vendorName: 'Oat House', stars: '4' }, DAY_BEFORE), { ok: false, field: 'vendor', message: VENDOR_BOTH_WORDS });
  // The words, as they read.
  assert.equal(aheadFieldWords('actual'), "ACTUAL is the record's, and this stop is still ahead — leave it blank, and record it on its row once its time has come");
  assert.equal(aheadFieldWords('stars'), "STARS is the record's, and this stop is still ahead — leave it blank, and record it on its row once its time has come");
  assert.equal(aheadFieldWords('note'), "ITEMS is the record's, and this stop is still ahead — leave it blank, and record it on its row once its time has come"); // COALEVELS-01 (2026-11-27): the form says the sheet's word for the note's box — "DESCRIPTION is the record's…" until then
});

// ── T5 · THE TWO BOUNDS, IN BOTH FORMS (rulings B.3 and B.5) ─────────────────

test('T5 both forms: ACTUAL 21474836.47 is taken — the column’s whole range — and 21474836.48 is refused by ACTUAL_RANGE_WORDS; an amount that is none, and a negative one, keep their own words', () => {
  assert.equal(ACTUAL_RANGE_WORDS, 'ACTUAL is at most $21,474,836.47');
  assert.equal(CENTS_MAX, 2_147_483_647);
  // "+ expense", a stop whose time has come.
  assert.equal(expenseValue({ actual: '21474836.47' }, AFTER).actualCents, CENTS_MAX);
  for (const past of ['21474836.48', '21474837', '99999999999']) assert.deepEqual(expense({ actual: past }, AFTER), { ok: false, field: 'actual', message: ACTUAL_RANGE_WORDS }, past);
  assert.deepEqual(expense({ actual: 'lots' }, AFTER), { ok: false, field: 'actual', message: amountWords('lots') });
  assert.deepEqual(expense({ actual: '-1' }, AFTER), { ok: false, field: 'actual', message: 'an amount is 0 or more' });
  // The row's record form.
  const most = record({ actual: '21474836.47' }, AFTER);
  assert.equal(most.ok && most.body.actual_cents, CENTS_MAX);
  for (const past of ['21474836.48', '21474837', '99999999999']) assert.deepEqual(record({ actual: past }, AFTER), { ok: false, field: 'actual', message: ACTUAL_RANGE_WORDS }, past);
  assert.deepEqual(record({ actual: 'lots' }, AFTER), { ok: false, field: 'actual', message: amountWords('lots') });
  assert.deepEqual(record({ went: 'skipped', actual: '21474836.48', note: 'closed' }, AFTER), { ok: false, field: 'actual', message: ACTUAL_RANGE_WORDS }, 'skipped or went');
  // It is the stops rule's own bound: what the forms take at the edge the rule takes, and what they refuse it would refuse.
  assert.equal(stopInput({ ...BASE, actual_cents: CENTS_MAX }, AFTER).ok, true);
  assert.equal(stopInput({ ...BASE, actual_cents: CENTS_MAX + 1 }, AFTER).ok, false);
  // In the source: the one comparison, in each form's rule, after the amount's own reading.
  for (const [name, refuse] of [['expenseInput', 'refuseExpense'], ['recordInput', 'refuseRecord']] as const) {
    const rule = bodyOfFunction(RULES, name);
    assert.match(rule, new RegExp(`const read = centsOf\\(draft\\.actual\\.trim\\(\\)\\);\\n\\s*if \\(!read\\.ok\\) return ${refuse}\\('actual', read\\.message\\);\\n\\s*if \\(read\\.cents > CENTS_MAX\\) return ${refuse}\\('actual', ACTUAL_RANGE_WORDS\\);\\s*\\n\\s*actualCents = read\\.cents;`), name);
  }
});

test('T5 both forms: a control in ITEMS (COALEVELS-01, 2026-11-27 — DESCRIPTION until then) is refused by NOTE_CONTROL_WORDS, before its length; a tab and a line break are read as a space and taken; "+ expense" refuses 281 characters by NOTE_LONG_WORDS', () => {
  assert.equal(NOTE_CONTROL_WORDS, 'ITEMS holds a control character — type it again without it'); // COALEVELS-01 (2026-11-27): the sheet's word — 'DESCRIPTION holds a control character…' until then
  assert.equal(NOTE_LONG_WORDS, 'ITEMS is at most 280 characters'); // COALEVELS-01 (2026-11-27): 'DESCRIPTION is at most 280 characters' until then
  for (const [c, name] of CONTROLS) {
    assert.deepEqual(expense({ note: `so${c}up` }, AFTER), { ok: false, field: 'note', message: NOTE_CONTROL_WORDS }, `+ expense: ${name}`);
    assert.deepEqual(record({ note: `so${c}up` }, AFTER), { ok: false, field: 'note', message: NOTE_CONTROL_WORDS }, `the record form: ${name}`);
  }
  // A tab and a line break: spaces, collapsed — taken, and stored as the stops rule would store them.
  assert.equal(expenseValue({ note: '  two\tkinds\nof  soup ' }, AFTER).note, 'two kinds of soup');
  const collapsed = record({ note: '  two\tkinds\nof  soup ' }, AFTER);
  assert.equal(collapsed.ok && collapsed.body.note, 'two kinds of soup');
  // A whole pair is a character, not a control.
  assert.equal(expenseValue({ note: `soup ${WHOLE_PAIR}` }, AFTER).note, `soup ${WHOLE_PAIR}`);
  const pair = record({ note: `soup ${WHOLE_PAIR}` }, AFTER);
  assert.equal(pair.ok && pair.body.note, `soup ${WHOLE_PAIR}`);
  // The length: 280 taken, 281 refused — in "+ expense" too, now.
  assert.equal(expenseValue({ note: 'n'.repeat(NOTE_MAX) }, AFTER).note?.length, 280);
  assert.deepEqual(expense({ note: 'n'.repeat(NOTE_MAX + 1) }, AFTER), { ok: false, field: 'note', message: NOTE_LONG_WORDS });
  assert.deepEqual(record({ note: 'n'.repeat(NOTE_MAX + 1) }, AFTER), { ok: false, field: 'note', message: NOTE_LONG_WORDS });
  // The stops rule's own order: controls, then length.
  assert.deepEqual(expense({ note: `${'n'.repeat(NOTE_MAX)}\u0000` }, AFTER), { ok: false, field: 'note', message: NOTE_CONTROL_WORDS });
  assert.deepEqual(record({ note: `${'n'.repeat(NOTE_MAX)}\u0000` }, AFTER), { ok: false, field: 'note', message: NOTE_CONTROL_WORDS });
  // A skip's reason is read the same way: a control is no reason.
  assert.deepEqual(record({ went: 'skipped', note: '\u0001' }, AFTER), { ok: false, field: 'note', message: NOTE_CONTROL_WORDS });
  assert.deepEqual(record({ went: 'skipped', note: ' \t ' }, AFTER), { ok: false, field: 'note', message: SKIP_REASON_WORDS }, 'spaces alone are still no reason');
  // In the source: the collapse, the one named test, then the length — in each form's rule; the rule file holds no regex of its own for it.
  assert.match(bodyOfFunction(RULES, 'expenseInput'), /const note = draft\.note\.trim\(\)\.replace\(\/\\s\+\/g, ' '\);\n\s*if \(note !== '' && ahead\) return refuseExpense\('note', aheadFieldWords\('note'\)\);\n\s*if \(holdsControl\(note\)\) return refuseExpense\('note', NOTE_CONTROL_WORDS\);\n\s*if \(note\.length > NOTE_MAX\) return refuseExpense\('note', NOTE_LONG_WORDS\);/);
  assert.match(bodyOfFunction(RULES, 'recordInput'), /const note = draft\.note\.trim\(\)\.replace\(\/\\s\+\/g, ' '\);\n\s*if \(holdsControl\(note\)\) return refuseRecord\('note', NOTE_CONTROL_WORDS\);\s*\n\s*if \(note\.length > NOTE_MAX\) return refuseRecord\('note', NOTE_LONG_WORDS\);/);
  assert.equal(countOf(code(RULES), /\bholdsControl\(/g), 3, 'the one test, read by the two rules — the record form on DESCRIPTION and on NOTES'); // TIMESHEET-04b (2026-11-27): recordInput reads NOTES by the same test — 2, 'the one test, read by the two rules', until then
  assert.doesNotMatch(code(RULES), /\\u0000|\\u001f|\\ud800/, 'no second test in the rule file');
});

// ── T6 · THE CLOSURE (rulings B.3 and B.5) ───────────────────────────────────

const ACTUALS = ['', '0', '6.9', '21474836.47', '21474836.48', 'lots', '-1'];
const STARS = ['', '1', '5', '6'];
const NOTES = ['', 'thick', 'two\tkinds\nof soup', 'n'.repeat(NOTE_MAX), 'n'.repeat(NOTE_MAX + 1), 'so\u0000up', 'so\u0085up', 'so\ud83dup', `soup ${WHOLE_PAIR}`];

test('T6 THE CLOSURE, the record form — over a table of drafts, clocks and held records: every body recordInput accepts, stopInput accepts with the same clock, and stores what the form sent', () => {
  const HELD_DONE: StopRecordRow = { id: 'r-soup', kind: 'routine_line', target_id: 'soup', occurrence_at: STOP, outcome: 'done', done_at: STOP, actual_cents: 600, rating: 4, note: 'with rice', notes: null, actual_minutes: 18 };
  const HELD_SKIP: StopRecordRow = { ...HELD_DONE, outcome: 'skipped', done_at: null, actual_cents: null, rating: null, note: 'closed', actual_minutes: null };
  let accepted = 0;
  let refused = 0;
  for (const now of [AFTER, AT_SKEW, A_MINUTE_SHORT]) {
    for (const given of [FIRST, { plannedAt: STOP, held: HELD_DONE }, { plannedAt: STOP, held: HELD_SKIP }]) {
      for (const went of ['went', 'skipped'] as const) for (const actual of ACTUALS) for (const stars of STARS) for (const minutes of ['', '0', String(MINUTES_MAX), String(MINUTES_MAX + 1), 'x']) for (const note of NOTES) {
        const read = record({ went, actual, stars, minutes, note }, now, given);
        if (!read.ok) { refused += 1; continue; }
        accepted += 1;
        const route = stopInput(read.body, now);
        if (!route.ok) return assert.fail(`the form accepted ${JSON.stringify({ went, actual, stars, minutes, note: note.slice(0, 12) })} at ${now.toISOString()} and the stops rule refused it — ${route.field}: ${route.message}`);
        assert.deepEqual([route.value.outcome, route.value.doneAt === null ? null : route.value.doneAt.toISOString(), route.value.actualCents, route.value.rating, route.value.note, route.value.actualMinutes], [read.body.outcome, read.body.done_at, read.body.actual_cents, read.body.rating, read.body.note, read.body.actual_minutes]);
      }
    }
  }
  assert.ok(accepted > 1000 && refused > 1000, `both sides of the rule are driven (${accepted} accepted, ${refused} refused)`);
  // The two bounds are among the refusals — until this change the form accepted them and the route refused.
  assert.deepEqual(record({ actual: '21474836.48' }, AFTER), { ok: false, field: 'actual', message: ACTUAL_RANGE_WORDS });
  assert.deepEqual(record({ note: 'so\u0000up' }, AFTER), { ok: false, field: 'note', message: NOTE_CONTROL_WORDS });
  // A went still ahead was already the form's to refuse.
  assert.deepEqual(record({}, A_MINUTE_SHORT), { ok: false, field: 'went', message: STOP_AHEAD_WORDS });
});

test('T6 THE CLOSURE, "+ expense" — over a table of drafts and clocks: recordBody of every value expenseInput accepts that is not ahead, stopInput accepts with the same clock; a value that is ahead carries no box of the record, and its record is the one the form does not ask', () => {
  let asked = 0;
  let planned = 0;
  let refused = 0;
  for (const now of [AFTER, new Date(STOP_MS), AT_SKEW, A_TICK_SHORT, A_MINUTE_SHORT, DAY_BEFORE]) {
    for (const vendor of [{}, { vendorId: 'v1' }, { vendorName: 'Oat House' }]) for (const actual of ACTUALS) for (const stars of STARS) for (const note of NOTES) {
      const read = expense({ ...vendor, actual, stars, note }, now);
      if (!read.ok) { refused += 1; continue; }
      const route = stopInput(recordBody(read.value, 'line-1'), now);
      if (read.value.ahead) {
        planned += 1;
        assert.deepEqual([read.value.actualCents, read.value.rating, read.value.note], [null, null, null], 'a planned stop carries no box of the record — nothing typed is dropped, because nothing typed is taken');
        assert.equal(route.ok, false, 'its record is the one the stops rule would refuse — so the form does not ask it');
        continue;
      }
      asked += 1;
      if (!route.ok) return assert.fail(`"+ expense" accepted ${JSON.stringify({ actual, stars, note: note.slice(0, 12) })} at ${now.toISOString()} and the stops rule refused its record — ${route.field}: ${route.message}`);
      assert.deepEqual([route.value.outcome, route.value.doneAt?.toISOString(), route.value.actualCents, route.value.rating, route.value.note, route.value.actualMinutes], ['done', STOP, read.value.actualCents, read.value.rating, read.value.note, null]);
    }
  }
  assert.ok(asked > 100 && planned > 0 && refused > 100, `every side is driven (${asked} asked, ${planned} planned, ${refused} refused)`);
  // Ahead, only the draft with no box of the record typed is taken: three clocks, three vendors.
  assert.equal(planned, 9);
});

// ── T7 · THE WORDS OF THE OUTCOME (ruling B.4) ───────────────────────────────

test('T7 outcomeWords says RECORD_AHEAD_WORDS for the record ahead; the four states that were, EXPENSE_STEPS and withNotTried are what they were', () => {
  assert.equal(RECORD_AHEAD_WORDS, 'not asked — this stop is still ahead; record it on its row once its time has come');
  assert.equal(outcomeWords({ step: 'record', state: 'ahead', words: '' }), 'the record — not asked — this stop is still ahead; record it on its row once its time has come');
  // As they were.
  assert.equal(outcomeWords({ step: 'stop', state: 'written', words: '' }), `the one-off stop — ${WRITTEN_WORDS}`);
  assert.equal(outcomeWords({ step: 'record', state: 'failed', words: 'the route’s own words' }), 'the record — not written: the route’s own words');
  assert.equal(outcomeWords({ step: 'record', state: 'not tried', words: '' }), `the record — ${NOT_TRIED_WORDS}`);
  assert.equal(outcomeWords({ step: 'directory', state: 'not asked', words: '' }), `the vendor, added to the book — ${NOT_ASKED_WORDS}`);
  assert.equal(NOT_ASKED_WORDS, 'none given');
  assert.deepEqual(EXPENSE_STEPS, ['stop', 'line', 'directory', 'vendor', 'record']);
  assert.deepEqual(withNotTried([{ step: 'stop', state: 'written', words: '' }, { step: 'line', state: 'failed', words: 'x' }]).map((o) => `${o.step}:${o.state}`), ['stop:written', 'line:failed', 'directory:not tried', 'vendor:not tried', 'record:not tried']);
  // A planned stop, as the form says it: all five steps, the record last and not asked — nothing left to mark "not tried".
  const plannedStop: readonly ExpenseOutcome[] = [{ step: 'stop', state: 'written', words: '' }, { step: 'line', state: 'written', words: '' }, { step: 'directory', state: 'not asked', words: '' }, { step: 'vendor', state: 'not asked', words: '' }, { step: 'record', state: 'ahead', words: '' }];
  assert.deepEqual(withNotTried(plannedStop), plannedStop);
  assert.deepEqual(plannedStop.map(outcomeWords).at(-1), 'the record — not asked — this stop is still ahead; record it on its row once its time has come');
  // In the source: the state, the words under "none given", the value's `ahead` last — and recordBody as it was.
  const rules = code(RULES);
  assert.match(rules, /export type ExpenseState = 'written' \| 'failed' \| 'not tried' \| 'not asked' \| 'ahead';/);
  assert.match(rules, /export const NOT_ASKED_WORDS = 'none given';\n(?:[ \t]*\n)*export const RECORD_AHEAD_WORDS = 'not asked — this stop is still ahead; record it on its row once its time has come';\n/);
  assert.match(rules, /readonly note: string \| null;\n(?:[ \t]*\n)* {2}readonly ahead: boolean;\n\}\n\nexport type ExpenseInputResult/);
  assert.ok(rules.includes("({ kind: 'routine_line', id: lineId, instant: v.instant, outcome: 'done', done_at: v.instant, actual_cents: v.actualCents, rating: v.rating, note: v.note, notes: null, actual_minutes: null });"), 'recordBody: done at the stop’s own instant, as it was — and it says its notes: none'); // TIMESHEET-04b (2026-11-27): "+ expense" has no NOTES box, so its body says null — the body without "notes: null" until then
});

// ── T8 · WHERE THE RULE FILE'S WORDS STAND (ruling B) ────────────────────────

test('T8 the rule file: the import gains CENTS_MAX and holdsControl in place; the three words stand in one dated block under VENDOR_BOTH_WORDS, typed as ruled', () => {
  const rules = code(RULES);
  assert.ok(rules.includes("import { CENTS_MAX, DONE_AT_SKEW_MS, LINES_WORDS, MINUTES_MAX, NEGATIVE_AMOUNT_WORDS, NOTES_MAX, NOTE_MAX, NOT_RECORDED_WORDS, RATING_WORDS, SKIPPED_WORD, SKIP_REASON_WORDS, amountWords, holdsControl, minutesTypedWords, recordKey, refusedWords, type StopOutcome, type StopRecordRow } from '@/lib/operations/stopRecord';"), 'one import line, as it was, with the two names in their places'); // TIMESHEET-04b (2026-11-27): the line gains NOTES_MAX, before NOTE_MAX — every other name where it stood
  assert.equal(countOf(rules, /from '@\/lib\/operations\/stopRecord';/g), 1);
  // The block: a dated heading right under VENDOR_BOTH_WORDS, then the three words in order, then the rule's own helper.
  const file = whole(RULES);
  assert.match(file, /\nexport const VENDOR_BOTH_WORDS = '[^\n]*';\n\n\/\/ ── FORM-BOUNDS-01 \(Alex, 2026-11-25\): [^\n]*\n\/\/\n/);
  const block = rules.slice(rules.indexOf('export const VENDOR_BOTH_WORDS'), rules.indexOf('function centsOf('));
  assert.deepEqual([...block.matchAll(/^export const (\w+)/gm)].map((m) => m[1]), ['VENDOR_BOTH_WORDS', 'ACTUAL_RANGE_WORDS', 'NOTE_CONTROL_WORDS', 'aheadFieldWords']);
  assert.ok(block.includes('export const ACTUAL_RANGE_WORDS = `${EXPENSE_FIELD_WORDS.actual} is at most ${formatCents(CENTS_MAX)}`;'));
  assert.ok(block.includes('export const NOTE_CONTROL_WORDS = `${EXPENSE_FIELD_WORDS.note} holds a control character — type it again without it`;'));
  assert.ok(block.includes("export const aheadFieldWords = (field: 'actual' | 'stars' | 'note'): string => `${EXPENSE_FIELD_WORDS[field]} is the record's, and this stop is still ahead — leave it blank, and record it on its row once its time has come`;"));
  assert.equal(countOf(file, /── FORM-BOUNDS-01 /g), 1, 'one block');
});

// ── T9 · THE FORM (ruling C) ─────────────────────────────────────────────────

test('T9 the form’s source: the rule is handed the browser’s clock, once; the record is asked only when the stop is not ahead and said as "ahead" otherwise; the tail runs after both; the create the registry cites has not moved', () => {
  const f = code(FORM);
  // The rule's call, with the clock — the only clock the form reads.
  assert.equal(countOf(f, /const read = expenseInput\(draft, zone, new Date\(\)\);/g), 1);
  assert.equal(countOf(f, /new Date\(/g), 1);
  assert.equal(countOf(f, /\bexpenseInput\(/g), 1);
  assert.match(f, /if \(busy \|\| zone === null\) return;\n\s*const read = expenseInput\(draft, zone, new Date\(\)\);\n\s*if \(!read\.ok\) \{ setRefusal\(read\); return; \}/, 'a refusal — a box of the record typed for a stop ahead among them — returns before any write');
  // The record step: not asked for a stop ahead; otherwise exactly what it was. Then the tail, after both.
  assert.match(f, /if \(v\.ahead\) \{\n\s*done\.push\(\{ step: 'record', state: 'ahead', words: '' \}\);\n\s*\} else \{\n\s*let record: Awaited<ReturnType<typeof setStopRecord>>;\n\s*try \{\n\s*record = await setStopRecord\(recordBody\(v, line\.value\.lineId\)\);\n\s*\} catch \(error\) \{\n\s*failed\('record', error instanceof Error \? error\.message : String\(error\)\);\n\s*return;\n\s*\}\n\s*if \(!record\.ok\) \{ failed\('record', record\.message\); return; \}\n\s*done\.push\(\{ step: 'record', state: 'written', words: '' \}\);\n\s*\}\n\s*setOutcome\(done\);\n\s*setLanded\(v\.day\);\n\s*setDraft\(\(d\) => \(\{ \.\.\.EMPTY_EXPENSE, book: d\.book \}\)\);\n\s*onWritten\(v\.day\);\n\s*\} finally \{/);
  assert.equal(countOf(f, /setStopRecord\(/g), 1, 'one write of the record — inside the branch of a stop that is not ahead');
  assert.equal(countOf(f, /state: 'ahead'/g), 1);
  assert.equal(countOf(f, /\bv\.ahead\b/g), 1, 'the form reads the rule’s answer — it works out no clock test of its own');
  assert.doesNotMatch(f, /DONE_AT_SKEW_MS|getTime\(\)|\/api\//, 'no test of the clock and no route named in the form');
  // The stop and its vendor are written before it, as they were: the planned stop is a real stop.
  const save = f.slice(f.indexOf('const save = async () => {'), f.indexOf('const field = ('));
  const order = ['createOneOff(oneOffBody(v))', 'readOneOffLine(created.value.routineId)', 'addVendor(v.bookId, v.vendor.name)', 'setVendor(vendorBody(v, line.value.lineId, vendorId))', 'if (v.ahead) {', 'setStopRecord(recordBody(v, line.value.lineId))', 'setOutcome(done);', 'onWritten(v.day);'];
  assert.deepEqual([...order].sort((a, b) => save.indexOf(a) - save.indexOf(b)), order, 'the same routes in the same order');
  for (const step of order) assert.ok(save.includes(step), step);
  // 'ahead' reads in the muted colour: the list's classes are as they were.
  assert.ok(f.includes("className={o.state === 'failed' ? 'text-brand-red' : o.state === 'written' ? 'text-brand-green' : 'text-text-muted'}"));
  // The create is where the registry cites it — the number read from the Time row's own citation, and it is main's.
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  const cited = /ledger\/ExpenseForm\.tsx:(\d+)/.exec(time.citation);
  if (cited === null) return assert.fail('the Time row cites the form’s create');
  assert.equal(Number(cited[1]), 87);
  assert.match(linesOf(FORM)[Number(cited[1]) - 1] ?? '', /const created = await createOneOff\(oneOffBody\(v\)\);/, 'no line was added above it');
});

// ── T10 · WHAT IS NOT EDITED (ruling D) ──────────────────────────────────────

test('T10 the stops route still reads its body with stopInput, against its own clock; the record form’s file is as it was — its rule changed, not its call; this change names no route and adds no write', () => {
  const route = code(STOPS_ROUTE);
  assert.match(route, /const now = new Date\(\);\n\s*const read = stopInput\(raw, now\);\n\s*if \(!read\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: read\.field, message: read\.message \}, \{ status: 400 \}\);/);
  assert.equal(countOf(route, /\bstopInput\(/g), 1);
  assert.doesNotMatch(route, /holdsControl|FORM-BOUNDS/, 'the route file is not edited — its rule is the same test under a name');
  assert.doesNotMatch(whole(STOPS_ROUTE), /FORM-BOUNDS/);
  // The record form hands its rule the browser's clock, as it did; a refusal of the rule's shows in the form.
  const leaf = code(LEAF);
  assert.match(leaf, /read = recordInput\(draft, row\.address, entry, new Date\(\)\);/);
  assert.match(leaf, /if \(!read\.ok\) \{ setRefusal\(read\); return; \}/);
  assert.doesNotMatch(whole(LEAF), /FORM-BOUNDS|holdsControl|CENTS_MAX/, 'RecordForm.tsx is not edited');
  // The three rules are pure, and nothing here writes: no fetch, no Prisma, no storage in the rule files.
  for (const file of [STOPS, RULES]) assert.doesNotMatch(code(file), /\bfetch\b|@prisma\/client|localStorage|sessionStorage/, file);
  assert.doesNotMatch(code(STOPS), /new Date\(\)|Date\.now\(/, 'the stops rule reads no clock of its own');
});
