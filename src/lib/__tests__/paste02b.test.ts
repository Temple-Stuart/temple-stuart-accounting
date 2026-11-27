/**
 * PASTE-02b (Alex, 2026-11-27) — A ONE-OFF'S ROUTINE IS NAMED FOR ITS DAY AND TIME, SO TWO OF ONE NAME CAN BOTH BE WRITTEN.
 *
 * The routines hold one name a user. A one-off was a routine named by the expense's own name, so the create route refused the second
 * expense of a name — in "+ expense", and in the paste's save at the second row of a kind sent to a one-off. Now the one body both
 * send (src/lib/operations/ledger.ts oneOffBody) names the ROUTINE for its day and time — the name, ' · ', the day, the time — and its
 * one LINE keeps the bare name, which is what the time sheet prints. A name is at most 181 characters, so the routine's name fits its
 * column. And two rows of one paste that would be the same new one-off are told apart first (src/lib/operations/pasteRows.ts): the
 * second is refused on Type, before anything is written. No route, no migration, no column.
 *
 * HERMETIC, on paste02.test.ts's model — no database, no network, and the only clock is the `now` handed in. The two rules are DRIVEN
 * directly over made-up rows: every name, day, account and amount below is invented. The files this change leaves alone are anchored
 * to their source with comments stripped (the reader law). No pin here names a line number of any file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, rejoin } from '../sourceText';
import { BLANK } from '../budget/format';
import { NOT_RECORDED_WORDS, type StopRecordRow } from '../operations/stopRecord';
import {
  EMPTY_EXPENSE, NAME_LONG_WORDS, ONE_OFF_NAME_MAX, ONE_OFF_NAME_TAIL, expenseInput, oneOffBody, oneOffRoutineName, recordBody, vendorBody,
  type ExpenseDraft, type ExpenseValues, type LedgerPlanRow, type LedgerRecording, type LedgerSheetRow,
} from '../operations/ledger';
import {
  ON_TIME_SHEET_KEYS, PASTE_READ_HEADS, countsWords, kindKeyOf, manyNamedWords, oneOffTwiceWords, pasteShown, placePaste, readPaste, stopTakenWords,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement,
} from '../operations/pasteRows';
import { pasteWritesOf, runPaste, saveWords, NOTHING_TO_SAVE_WORDS, type PasteWriters } from '../operations/pasteSave';

const LEDGER = 'src/lib/operations/ledger.ts';
const RULES = 'src/lib/operations/pasteRows.ts';
const SAVE = 'src/lib/operations/pasteSave.ts';
const FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const WRITERS = 'src/components/workbench/operations/ledger/ledgerWrites.ts';
const CREATE_ROUTE = 'src/app/api/operations/routines/route.ts';
const RENAME_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const SCHEMA = 'prisma/schema.prisma';

/** A whole file, comment and code alike (sourceText.ts rejoin). */
const whole = (file: string): string => rejoin(code(file), comments(file));
const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;
/** The text of `source` from `from` up to `to` — both must stand, in that order. */
const between = (source: string, from: string, to: string): string => {
  const start = source.indexOf(from);
  const end = start < 0 ? -1 : source.indexOf(to, start + from.length);
  if (start < 0 || end < 0) return assert.fail(`${JSON.stringify(from)} … ${JSON.stringify(to)} is not in the source`);
  return source.slice(start, end);
};
/** Each step stands in `body`, after the one before it. */
const inOrder = (body: string, steps: readonly string[], what: string): void => {
  let at = 0;
  for (const step of steps) {
    const i = body.indexOf(step, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(step)} comes after the step before it`);
    at = i + step.length;
  }
};

// ── THE EXPENSE — "+ expense"'s own boxes, every one made up ─────────────────

const NBO = 'Africa/Nairobi'; // three hours ahead of UTC the year round
const SAT = '2027-06-12';
const SUN = '2027-06-13';
const MON = '2027-06-14';
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();
/** Monday noon in the zone: Saturday and Sunday are past, Monday evening is still ahead. */
const NOW = new Date('2027-06-14T09:00:00.000Z');

const DRAFT: ExpenseDraft = { ...EMPTY_EXPENSE, day: SUN, time: '20:00', name: 'Bowling', amount: '20.00', coa: '6200', book: 'P', actual: '18', note: 'two games' };
/** The form's values for a draft — or the test fails with the refusal's words. */
const valuesOf = (draft: ExpenseDraft): ExpenseValues => {
  const read = expenseInput(draft, NBO, NOW);
  if (!read.ok) return assert.fail(`refused: ${read.field} — ${read.message}`);
  return read.value;
};

// ── THE PASTE — a sheet's rows as it copies them, every cell made up ─────────

const TAB = '\t';
type Typed = Partial<Record<PasteHead, string>>;
const cellsOf = (typed: Typed): string => PASTE_READ_HEADS.map((head) => (head in typed ? typed[head] : '')).join(TAB);
const sheetText = (...rows: readonly Typed[]): string => [PASTE_READ_HEADS.join(TAB), ...rows.map(cellsOf)].join('\n');
/** A paste that is read — or the test fails with the refusal's words. */
const pasteOf = (...rows: readonly Typed[]): Paste => {
  const read = readPaste(sheetText(...rows));
  if (!read.ok) return assert.fail(`refused: ${read.words}`);
  return read.value;
};

const BOOKS = [{ id: 'P', name: 'Home', entityType: 'personal' }, { id: 'B', name: 'Shop', entityType: 'sole_prop' }];
/** What a paste is placed against when nothing stands yet: an EMPTY time sheet. */
const EMPTY: PasteContext = {
  books: BOOKS, sheet: [], recording: {},
  charts: { P: [{ code: '6150', name: 'Dining Out' }, { code: '6200', name: 'Recreation' }], B: [{ code: '6400', name: 'Supplies' }] },
  vendors: [], zone: NBO, now: NOW,
};
const ONE_OFF = (account: string): PastePick => ({ kind: 'oneOff', code: account });
/** A paste placed, every row's kind picked a one-off — under the Personal book's account, or the Business book's for its rows. */
const placedOn = (paste: Paste, context: PasteContext) => {
  const picks: Record<string, PastePick> = {};
  for (const row of paste.rows) if (row.kind === 'read') picks[kindKeyOf(row.cells)] = ONE_OFF(row.cells.entity === 'Business' ? '6400' : '6200');
  const placements = placePaste(paste, picks, context);
  return { placements, shown: pasteShown(paste, placements), counts: countsWords(placements), writes: pasteWritesOf(paste.rows, placements) };
};
/** A new one-off's placement — or the test fails with what it is. */
const oneOff = (placement: PastePlacement): Extract<PastePlacement, { readonly kind: 'oneOff' }> => {
  if (placement.kind !== 'oneOff') return assert.fail(`placed: ${placement.kind}${placement.kind === 'refused' ? ` — ${placement.head}: ${placement.why}` : ''}`);
  return placement;
};
const refusedAt = (placement: PastePlacement): [string, string] => {
  if (placement.kind !== 'refused') return assert.fail(`placed: ${placement.kind}`);
  return [placement.head, placement.why];
};
const kindsOf = (placements: readonly PastePlacement[]): string[] => placements.map((p) => (p.kind === 'plan' ? `plan${p.standing ? ', standing' : ''}` : p.kind));

/** A row of a kind sent to a one-off — a past evening out. */
const BOWLING: Typed = { 'Start Date': '6/13/27', 'Start Time': '8:00 PM', 'End Time': '9:30 PM', Category: 'Fun', Entity: 'Personal', Type: 'Bowling', Items: 'two games', 'Total (USD)': '18', 'Budget (USD)': '$20.00' };

// ── T1 · THE NAME (ruling A.1) ───────────────────────────────────────────────

test('T1 a one-off’s routine name: the name, a space, a middle dot, a space, the day, a space, the time — the values’ own; one name on two days is two names, and at two times of one day two names; the tail is 19 characters and a name at most 181', () => {
  const name = oneOffRoutineName({ name: 'Bowling', day: SUN, time: '20:00' });
  assert.equal(name, 'Bowling · 2027-06-13 20:00');
  // Its parts, in order: the name; the separator — a space, U+00B7, a space; the day; a space; the time.
  assert.deepEqual([name.slice(0, 7), name.slice(7, 10), name.slice(10, 20), name.slice(20, 21), name.slice(21)], ['Bowling', ' · ', SUN, ' ', '20:00']);
  assert.deepEqual([name.charCodeAt(7), name.charCodeAt(8), name.charCodeAt(9)], [0x20, 0xb7, 0x20], 'a space, U+00B7, a space');
  // One name on two days → two names; one name at two times of one day → two names. The same day and time → the one name.
  const on = (day: string, time: string): string => oneOffRoutineName({ name: 'Bowling', day, time });
  assert.notEqual(on(SAT, '20:00'), on(SUN, '20:00'));
  assert.notEqual(on(SUN, '20:00'), on(SUN, '20:30'));
  assert.equal(on(SUN, '20:00'), on(SUN, '20:00'));
  assert.equal(new Set([on(SAT, '20:00'), on(SUN, '20:00'), on(MON, '20:00'), on(SUN, '20:30'), on(SUN, '08:00')]).size, 5);
  // The day and the time are the values' own — as the form read them, in the zone it read them in. Nothing else of the values is read, and nothing is looked up.
  const values = valuesOf(DRAFT);
  assert.equal(oneOffRoutineName(values), 'Bowling · 2027-06-13 20:00');
  assert.equal(oneOffRoutineName(valuesOf({ ...DRAFT, book: 'B', coa: '6400', amount: '5', actual: '', note: '', vendorName: 'Pin Palace' })), 'Bowling · 2027-06-13 20:00', 'the book, the account, the amounts and the vendor are not in the name');
  assert.equal(oneOffRoutineName(valuesOf({ ...DRAFT, name: '  Ten   pin  bowling ' })), 'Ten pin bowling · 2027-06-13 20:00', 'the name as the form keeps it: trimmed, its spaces collapsed');
  // THE TAIL is what follows the name — 19 characters — and a name is at most 200 less that: 181.
  assert.equal(ONE_OFF_NAME_TAIL, 19);
  assert.equal(ONE_OFF_NAME_MAX, 181);
  assert.equal(ONE_OFF_NAME_MAX + ONE_OFF_NAME_TAIL, 200, 'the routine’s name column holds 200');
  assert.equal(' · 2027-06-13 20:00'.length, ONE_OFF_NAME_TAIL);
  for (const typed of ['B', 'Bowling', 'n'.repeat(181)]) assert.equal(oneOffRoutineName({ name: typed, day: SUN, time: '20:00' }).length, typed.length + ONE_OFF_NAME_TAIL, `${typed.length} characters`);
});

// ── T2 · THE BODY (ruling A.3) ───────────────────────────────────────────────

test('T2 the create route’s body: the routine’s name is the dated one and its one line’s activity the bare name; the body is what it was in every other key; the vendor’s and the record’s bodies carry no name', () => {
  const v = valuesOf(DRAFT);
  const { name, ...rest } = oneOffBody(v);
  assert.equal(name, 'Bowling · 2027-06-13 20:00');
  assert.equal(name, oneOffRoutineName(v));
  // Every other key, as it was: a one-off — cadence once on the day, at the time, in the zone — role place, ONE line: the thing itself, with the amount and the COA.
  assert.deepEqual(rest, {
    description: '', entity_id: 'P',
    cadence_mode: 'once', days: 'once', weekly_byday: [], monthly_day_of_month: '1', monthly_nth: '1', monthly_weekday: 'MO', custom_rrule: '',
    byhour: '20', byminute: '00', timezone: NBO,
    ideal_time_label: '', fail_threshold_minutes: '0', role: 'place',
    start_date: SUN, end_date: '', start_time: '20:00', end_time: '', is_active: true,
    budget_amount: '', coa_code: '', location: '', latitude: '', longitude: '',
    lines: [{ activity: 'Bowling', budget_amount: '20.00', coa_code: '6200' }],
  });
  // The LINE keeps the bare name — what the time sheet prints under SUB ACCOUNT NAME, and Expenses under its own.
  assert.deepEqual(oneOffBody(v).lines.map((line) => line.activity), ['Bowling']);
  assert.notEqual(oneOffBody(v).lines[0].activity, name);
  // The same name on another day, or at another time, is another routine — and the same line.
  const other = oneOffBody(valuesOf({ ...DRAFT, day: SAT }));
  const later = oneOffBody(valuesOf({ ...DRAFT, time: '21:15' }));
  assert.deepEqual([other.name, later.name], ['Bowling · 2027-06-12 20:00', 'Bowling · 2027-06-13 21:15']);
  assert.deepEqual([other.lines[0].activity, later.lines[0].activity], ['Bowling', 'Bowling']);
  // The values are as they were: the form's `name` is the bare name — the paste's own stop of that name is found by it.
  assert.equal(v.name, 'Bowling');
  // The vendor's body and the record's are as they were, and carry no name.
  assert.deepEqual(vendorBody(v, 'line-1', 'v-1'), { kind: 'routine_line', id: 'line-1', instant: at(SUN, '20:00'), vendorId: 'v-1' });
  assert.deepEqual(recordBody(v, 'line-1'), { kind: 'routine_line', id: 'line-1', instant: at(SUN, '20:00'), outcome: 'done', done_at: at(SUN, '20:00'), actual_cents: 1800, rating: null, note: 'two games', actual_minutes: null });
});

// ── T3 · THE BOUND (ruling A.2) ──────────────────────────────────────────────

test('T3 the bound: a name of 181 characters lands and its routine’s name is exactly 200; 182 is refused on name, in the form’s own words — so the routine’s name always fits its column, and the form refuses first what the route would', () => {
  const longest = expenseInput({ ...DRAFT, name: 'n'.repeat(181) }, NBO, NOW);
  assert.ok(longest.ok);
  const body = oneOffBody(longest.value);
  assert.deepEqual([longest.value.name.length, body.name.length, body.lines[0].activity.length], [181, 200, 181], 'the routine’s name is exactly the column’s 200; the line holds the bare 181');
  assert.equal(body.name, `${'n'.repeat(181)} · 2027-06-13 20:00`);
  // One more is refused, on the name's box, in the form's words — before anything is sent.
  assert.deepEqual(expenseInput({ ...DRAFT, name: 'n'.repeat(182) }, NBO, NOW), { ok: false, field: 'name', message: NAME_LONG_WORDS });
  assert.deepEqual(expenseInput({ ...DRAFT, name: 'n'.repeat(200) }, NBO, NOW), { ok: false, field: 'name', message: NAME_LONG_WORDS }, '200 was taken until now');
  assert.equal(NAME_LONG_WORDS, `NAME is at most ${ONE_OFF_NAME_MAX} characters`);
  // The bound is on the name as the form keeps it: trimmed, its spaces collapsed.
  assert.equal(expenseInput({ ...DRAFT, name: `   ${'n'.repeat(181)}   ` }, NBO, NOW).ok, true);
  assert.equal(expenseInput({ ...DRAFT, name: `${'n'.repeat(90)}     ${'n'.repeat(90)}` }, NBO, NOW).ok, true, '90, one space, 90: 181');
  // Every name the form takes makes a routine name the create route's own bound (200) takes.
  for (const length of [1, 7, 100, 180, 181]) assert.ok(oneOffBody(valuesOf({ ...DRAFT, name: 'n'.repeat(length) })).name.length <= 200, `${length}`);
  // In the source: the bound and its words read the one constant; the tail is that text's own length.
  const ledger = code(LEDGER);
  assert.match(ledger, /\n {2}if \(name\.length > ONE_OFF_NAME_MAX\) return refuseExpense\('name', NAME_LONG_WORDS\);\n/);
  assert.doesNotMatch(between(ledger, 'export function expenseInput(', '\nexport const oneOffBody'), /name\.length > 200/);
  // The three new exports stand directly over NAME_LONG_WORDS, in this order, under one dated comment.
  assert.match(ledger, /\nexport const ONE_OFF_NAME_TAIL = ' · YYYY-MM-DD HH:MM'\.length;\nexport const ONE_OFF_NAME_MAX = 200 - ONE_OFF_NAME_TAIL;\nexport const oneOffRoutineName = \(v: Pick<ExpenseValues, 'name' \| 'day' \| 'time'>\): string => `\$\{v\.name\} · \$\{v\.day\} \$\{v\.time\}`;\nexport const NAME_LONG_WORDS = `NAME is at most \$\{ONE_OFF_NAME_MAX\} characters`;\n/);
  assert.equal(countOf(comments(LEDGER), /PASTE-02b \(Alex, 2026-11-27\)/g), 1, 'one dated comment over the three');
});

// ── T4 · ONE TYPE ON THREE DAYS (rulings A.3, B) ─────────────────────────────

test('T4 the paste, a kind sent to a one-off, an empty time sheet: one Type on three days is three new one-offs whose routines are three names and whose lines are the one bare name — and the save sends all three', async () => {
  const paste = pasteOf({ ...BOWLING, 'Start Date': '6/12/27' }, BOWLING, { ...BOWLING, 'Start Date': '6/14/27', 'Total (USD)': '', Items: '' });
  const { placements, counts, writes } = placedOn(paste, EMPTY);
  assert.deepEqual(kindsOf(placements), ['oneOff', 'oneOff', 'oneOff']);
  assert.equal(counts, '3 rows read · 0 on a plan · 3 one-offs (3 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  const bodies = placements.map((placement) => oneOffBody(oneOff(placement).values));
  // Three names — they were ONE until now, so the create route refused the second — and one bare name on each one's line.
  assert.deepEqual(bodies.map((body) => body.name), ['Bowling · 2027-06-12 20:00', 'Bowling · 2027-06-13 20:00', 'Bowling · 2027-06-14 20:00']);
  assert.equal(new Set(bodies.map((body) => body.name)).size, 3);
  assert.deepEqual(bodies.map((body) => body.lines[0].activity), ['Bowling', 'Bowling', 'Bowling']);
  assert.deepEqual(placements.map((placement) => oneOff(placement).name), ['Bowling', 'Bowling', 'Bowling'], 'the placement’s name is the values’ own: the bare name');
  // THE SAVE sends each of the three — through the one runner, over a writer that records what it is asked and holds nothing.
  const asked: string[] = [];
  let routines = 0;
  const writers: PasteWriters = {
    createOneOff: async (body) => { asked.push(body.name); routines += 1; return { ok: true, value: { routineId: `rt-${routines}` } }; },
    readOneOffLine: async (routineId) => ({ ok: true, value: { lineId: `line-of-${routineId}` } }),
    setLineMinutes: async () => ({ ok: true, value: null }),
    addVendor: async () => assert.fail('no row names a vendor'),
    setVendor: async () => assert.fail('no row names a vendor'),
    setRecord: async () => ({ ok: true }),
  };
  assert.equal(saveWords(writes), 'save 3 rows — 0 vendors added to a book · 0 vendors set on a stop · 2 records · 3 one-offs');
  const outcomes = await runPaste(writes, writers, () => undefined);
  assert.deepEqual(asked, ['Bowling · 2027-06-12 20:00', 'Bowling · 2027-06-13 20:00', 'Bowling · 2027-06-14 20:00']);
  assert.deepEqual(outcomes.map((outcome) => [outcome.row, outcome.state]), [[2, 'written'], [3, 'written'], [4, 'written']]);
});

// ── T5 · TWO ROWS THAT WOULD BE THE SAME NEW ONE-OFF (ruling B) ──────────────

test('T5 a second row that would be the same new one-off — one Type, one day, one Start Time — is refused on Type with the first row’s number, in one book or across two; a first row refused for another reason holds no name; one Type on one day at two Start Times is two one-offs', () => {
  // The same Type, day and Start Time, twice — whatever else the second holds.
  const twice = placedOn(pasteOf(BOWLING, { ...BOWLING, 'End Time': '', Items: 'a third game', 'Total (USD)': '9', 'Budget (USD)': '10' }), EMPTY);
  assert.deepEqual(kindsOf(twice.placements), ['oneOff', 'refused']);
  assert.deepEqual(refusedAt(twice.placements[1]), ['Type', oneOffTwiceWords(2, 'Bowling')]);
  assert.equal(oneOffTwiceWords(2, 'Bowling'), 'row 2 of the paste is already a new one-off named "Bowling" at this day and Start Time — a second one needs its own Start Time');
  // Its row in the table: refused, red, where it lands said by its head word; nothing on the time sheet's side.
  assert.deepEqual([twice.shown[1].tone, twice.shown[1].lands], ['refused', `Type — ${oneOffTwiceWords(2, 'Bowling')}`]);
  assert.deepEqual(twice.shown[1].sheet, ON_TIME_SHEET_KEYS.map(() => BLANK));
  assert.equal(twice.shown[0].tone, 'placed');
  // The counts: one new one-off, and one that cannot be placed.
  assert.equal(twice.counts, '2 rows read · 0 on a plan · 1 one-off (1 new) · 0 bookings · 0 waiting for a pick · 1 that cannot be placed · 0 dates with nothing on them');
  // Only the first is written.
  assert.deepEqual(twice.writes.map((write) => [write.row, write.kind]), [[2, 'oneOff']]);
  // A third the same: refused with the FIRST row's number — the row that holds the name.
  const thrice = placedOn(pasteOf({ 'Start Date': '6/12/27' }, BOWLING, BOWLING, BOWLING), EMPTY);
  assert.deepEqual(kindsOf(thrice.placements), ['blank', 'oneOff', 'refused', 'refused']);
  assert.deepEqual([refusedAt(thrice.placements[2]), refusedAt(thrice.placements[3])], [['Type', oneOffTwiceWords(3, 'Bowling')], ['Type', oneOffTwiceWords(3, 'Bowling')]]);
  // The same in TWO BOOKS: the routines hold one name a user, in any book — so the second is refused the same way.
  const books = placedOn(pasteOf(BOWLING, { ...BOWLING, Entity: 'Business' }), EMPTY);
  assert.deepEqual(kindsOf(books.placements), ['oneOff', 'refused']);
  assert.deepEqual(refusedAt(books.placements[1]), ['Type', oneOffTwiceWords(2, 'Bowling')]);
  assert.equal(oneOff(books.placements[0]).book.id, 'P');
  // …and the other way round: the first row holds the name, whichever book it is in.
  const reversed = placedOn(pasteOf({ ...BOWLING, Entity: 'Business' }, BOWLING), EMPTY);
  assert.deepEqual([kindsOf(reversed.placements), oneOff(reversed.placements[0]).book.id, refusedAt(reversed.placements[1])], [['oneOff', 'refused'], 'B', ['Type', oneOffTwiceWords(2, 'Bowling')]]);
  // A first row refused for another reason — no Budget (USD) — holds no name: the second is placed.
  const freed = placedOn(pasteOf({ ...BOWLING, 'Budget (USD)': '' }, BOWLING), EMPTY);
  assert.deepEqual(kindsOf(freed.placements), ['refused', 'oneOff']);
  assert.deepEqual(refusedAt(freed.placements[0]), ['Budget (USD)', 'a one-off needs a Budget (USD) above 0']);
  // …and so does a row the form's rule refuses, or one whose kind has no pick.
  const noPick = placePaste(pasteOf(BOWLING, BOWLING), {}, EMPTY);
  assert.deepEqual(kindsOf(noPick), ['pick', 'pick'], 'neither is placed, so neither holds a name');
  // One Type on one day at two Start Times → both placed: a second one needs its own Start Time, and has it.
  const times = placedOn(pasteOf(BOWLING, { ...BOWLING, 'Start Time': '10:00 PM', 'End Time': '' }), EMPTY);
  assert.deepEqual(kindsOf(times.placements), ['oneOff', 'oneOff']);
  assert.deepEqual(times.placements.map((placement) => oneOffBody(oneOff(placement).values).name), ['Bowling · 2027-06-13 20:00', 'Bowling · 2027-06-13 22:00']);
  // The same Type and Start Time on another day → both placed.
  assert.deepEqual(kindsOf(placedOn(pasteOf(BOWLING, { ...BOWLING, 'Start Date': '6/12/27' }), EMPTY).placements), ['oneOff', 'oneOff']);
  // The key is the routine's name as the save would send it — the Type as the row holds it, exactly; the Start Time however it was typed.
  assert.deepEqual(kindsOf(placedOn(pasteOf(BOWLING, { ...BOWLING, 'Start Time': '20:00' }), EMPTY).placements), ['oneOff', 'refused'], '8:00 PM and 20:00 are one Start Time');
  assert.deepEqual(kindsOf(placedOn(pasteOf(BOWLING, { ...BOWLING, Type: ' Bowling ' }), EMPTY).placements), ['oneOff', 'refused'], 'a cell is read trimmed');
  assert.deepEqual(placedOn(pasteOf(BOWLING, { ...BOWLING, Type: 'Bowling night' }), EMPTY).placements.map((placement) => oneOffBody(oneOff(placement).values).name), ['Bowling · 2027-06-13 20:00', 'Bowling night · 2027-06-13 20:00']);
  // A stop still ahead and its twin: the same.
  const ahead = placedOn(pasteOf({ ...BOWLING, 'Start Date': '6/14/27', 'Total (USD)': '', Items: '' }, { ...BOWLING, 'Start Date': '6/14/27', 'Total (USD)': '', Items: '' }), EMPTY);
  assert.deepEqual([kindsOf(ahead.placements), refusedAt(ahead.placements[1])], [['oneOff', 'refused'], ['Type', oneOffTwiceWords(2, 'Bowling')]]);
});

// ── T6 · AFTER A SAVE (ruling B — nothing else in the file changes) ──────────

test('T6 after a save, the one-off’s own row on the time sheet — its name the bare name — takes its row on a second paste: the placement is on the stop that stands, and nothing is a new one-off', () => {
  /** A one-off as the time sheet lists it once it is written: a plan row whose `description` is the LINE's name — the bare name. */
  const written = (id: string, day: string, clock: string, name: string, over: Partial<LedgerPlanRow> = {}): LedgerPlanRow => ({
    id: null, key: `routine_line:${id}:${at(day, clock)}`, address: { kind: 'routine_line', id, instant: at(day, clock) }, match: null, day, time: clock,
    place: null, book: 'Personal', coa: { account: 'P-6200', name: 'Recreation' }, vendor: null, description: name, rating: null, note: null,
    cents: 2000, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 90, loggedMinutes: null, allDay: false, went: NOT_RECORDED_WORDS, ...over,
  });
  const record = (id: string, day: string): StopRecordRow => ({ id: `rec-${id}`, kind: 'routine_line', target_id: id, occurrence_at: at(day, '20:00'), outcome: 'done', done_at: at(day, '20:00'), actual_cents: 1800, rating: null, note: 'two games', actual_minutes: null });
  const sat = written('line-sat', SAT, '20:00', 'Bowling');
  const sun = written('line-sun', SUN, '20:00', 'Bowling');
  const mon = written('line-mon', MON, '20:00', 'Bowling', { went: 'planned' });
  const sheet: readonly LedgerSheetRow[] = [sat, sun, mon];
  const taking = (row: LedgerSheetRow, held: StopRecordRow | null): LedgerRecording => ({ takes: true, plannedAt: row.address.instant, held, vendor: { kind: 'none' } });
  const after: PasteContext = { ...EMPTY, sheet, recording: { [sat.key]: taking(sat, record('line-sat', SAT)), [sun.key]: taking(sun, record('line-sun', SUN)), [mon.key]: taking(mon, null) } };
  // The same three rows, pasted again: each lands ON ITS OWN STOP — found by the bare name, its day and its Start Time — and none is a new one-off.
  const rows = [{ ...BOWLING, 'Start Date': '6/12/27' }, BOWLING, { ...BOWLING, 'Start Date': '6/14/27', 'Total (USD)': '', Items: '' }];
  const again = placedOn(pasteOf(...rows), after);
  assert.deepEqual(kindsOf(again.placements), ['plan, standing', 'plan, standing', 'plan, standing']);
  assert.deepEqual(again.placements.map((placement) => (placement.kind === 'plan' ? [placement.stop.key, placement.plan] : null)), [[sat.key, 'Bowling'], [sun.key, 'Bowling'], [mon.key, 'Bowling']]);
  assert.equal(again.counts, '3 rows read · 0 on a plan · 3 one-offs (0 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  assert.equal(again.shown[1].lands, 'on the stop "Bowling" at 20:00, already on the time sheet · already recorded');
  // What is in is never written twice: the same rows have nothing to save.
  assert.deepEqual(again.writes, []);
  assert.equal(NOTHING_TO_SAVE_WORDS, 'nothing to save — no placed row has a vendor to plan, a record to make or a one-off to add');
  // Before the save the same rows were three NEW one-offs: the time sheet alone tells the two apart.
  assert.deepEqual(kindsOf(placedOn(pasteOf(...rows), EMPTY).placements), ['oneOff', 'oneOff', 'oneOff']);
  // A fourth day is still a new one-off, beside the three that stand.
  const fourth = placedOn(pasteOf(...rows, { ...BOWLING, 'Start Date': '6/11/27' }), after);
  assert.deepEqual(kindsOf(fourth.placements), ['plan, standing', 'plan, standing', 'plan, standing', 'oneOff']);
  assert.equal(oneOffBody(oneOff(fourth.placements[3]).values).name, 'Bowling · 2027-06-11 20:00');
  // The earlier rules stand as they were. A second row on a stop that stands is refused by the stop's own rule — not as a new one-off…
  const second = placedOn(pasteOf(BOWLING, BOWLING), after);
  assert.deepEqual([kindsOf(second.placements), refusedAt(second.placements[1])], [['plan, standing', 'refused'], ['Type', stopTakenWords(2, 'Bowling')]]);
  // …and two stops of one name at one day and time still cannot be told apart.
  const twin = written('line-sun-b', SUN, '20:00', 'Bowling');
  const two: PasteContext = { ...after, sheet: [...sheet, twin], recording: { ...after.recording, [twin.key]: taking(twin, null) } };
  assert.deepEqual(refusedAt(placedOn(pasteOf(BOWLING), two).placements[0]), ['Type', manyNamedWords('Bowling')]);
});

// ── T7 · THE SOURCE (rulings A, B, C) ────────────────────────────────────────

test('T7 in the source: the dated name stands once, in the one body both callers send, and its line keeps the bare name; the paste’s refusal sits after the form’s rule and before the minutes; the two callers, the leaf, the writers, the routes and the one-name rule are as they were', () => {
  const ledger = code(LEDGER);
  // The dated name: once, in oneOffBody — and its ONE line the bare name, character for character.
  assert.equal(countOf(ledger, /name: oneOffRoutineName\(v\)/g), 1);
  const body = between(ledger, 'export const oneOffBody = (v: ExpenseValues): RoutineForm => ({', '\n});');
  assert.match(body, /\n {2}name: oneOffRoutineName\(v\), description: '', entity_id: v\.bookId,\n/);
  assert.match(body, /\n {2}lines: \[\{ activity: v\.name, budget_amount: v\.amount, coa_code: v\.coa \}\],$/);
  assert.equal(countOf(ledger, /\boneOffRoutineName\b/g), 2, 'declared, and called by the one body — nowhere else in the rule file');
  // The vendor's and the record's bodies are as they were.
  assert.match(ledger, /\({ kind: 'routine_line', id: lineId, instant: v\.instant, vendorId }\);/);
  assert.match(ledger, /\({ kind: 'routine_line', id: lineId, instant: v\.instant, outcome: 'done', done_at: v\.instant, actual_cents: v\.actualCents, rating: v\.rating, note: v\.note, actual_minutes: null }\);/);
  // Both callers still send that one body, and neither names this change: "+ expense"'s form and the save's rule were not edited.
  assert.equal(countOf(code(FORM), /await createOneOff\(oneOffBody\(v\)\);/g), 1);
  assert.equal(countOf(code(SAVE), /await writers\.createOneOff\(oneOffBody\(values\)\);/g), 1);
  for (const file of [FORM, SAVE, LEAF, WRITERS]) assert.doesNotMatch(whole(file), /oneOffRoutineName|oneOffTwiceWords|ONE_OFF_NAME|PASTE-02b/, `${file} does not name this change`);
  // THE PASTE: the import gains the one name; the map stands beside `held`; the refusal sits after the form's rule has read the row and the instant check has passed, before its minutes.
  const rules = code(RULES);
  assert.match(rules, /cellWordsOf, expenseInput, headWordOf, oneOffRoutineName, recordInput,\n/);
  assert.match(rules, /\n {2}const held = new Map<string, number>\(\);\n\s*\n {2}const fresh = new Map<string, number>\(\);\n/);
  inOrder(rules, [
    'const read = expenseInput({',
    'if (!read.ok) return refusedByExpense(read.field, read.message);',
    'const values = read.value;',
    "if (values.instant !== instant || values.ahead !== (happened.kind === 'planned')) {",
    'const routine = oneOffRoutineName(values);',
    'const first = fresh.get(routine);',
    "if (first !== undefined) return { kind: 'refused', head: 'Type', why: oneOffTwiceWords(first, values.name) };",
    'fresh.set(routine, row.number);',
    'const span = cells.end === null ? null : (clockMinutes(cells.end) - clockMinutes(start) + DAY_MINUTES) % DAY_MINUTES;',
  ], 'the new one-off branch');
  assert.deepEqual([countOf(rules, /\bfresh\.(get|set)\(/g), countOf(rules, /\boneOffRoutineName\(/g)], [2, 1], 'the map is read once and written once; the key is the routine’s name alone — no book in it');
  // The stop of a row's own name already standing is found by the bare name, as it was.
  assert.match(rules, /const own = context\.sheet\.filter\(\(stop\) => stop\.book === book\.word && stop\.day === cells\.day && stop\.time === start && stop\.description === cells\.type\);/);
  assert.match(comments(RULES), /\n \* PASTE-02b \(Alex, 2026-11-27\): a new one-off's routine is named for its day and time \(ledger\.ts oneOffRoutineName\)/);
  // THE ONE-NAME RULE STAYS: the table's own, the create route's check before it creates, and the rename's.
  assert.match(code(SCHEMA), /\n {2}@@unique\(\[user_id, name\]\)\n/);
  assert.match(code(SCHEMA), /\n {2}name\s+String\s+@db\.VarChar\(200\)\n\s*description\s+String\?\s+@db\.Text\n\s*schedule_rrule/);
  assert.match(code(CREATE_ROUTE), /const existing = await prisma\.operations_routines\.findFirst\(\{\n\s*where: \{ user_id: user\.id, name \},\n\s*\}\);\n\s*if \(existing\) \{/);
  assert.match(code(CREATE_ROUTE), /const name = requireString\(body\.name, 'name', 200\);/, 'the route’s own bound is the column’s 200');
  assert.match(code(RENAME_ROUTE), /where: \{ user_id: user\.id, name: trimmed, NOT: \{ id \} \},/);
  for (const file of [CREATE_ROUTE, RENAME_ROUTE]) assert.doesNotMatch(whole(file), /PASTE-02b|oneOffRoutineName/, `${file} is not edited`);
});
