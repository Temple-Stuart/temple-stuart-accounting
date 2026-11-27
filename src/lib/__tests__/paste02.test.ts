/**
 * PASTE-02 (Alex, 2026-11-27) — THE SAVE: THE PASTED ROWS GO ONTO THE TIME SHEET, THROUGH THE WRITERS THAT EXIST.
 *
 * PASTE-01 reads the rows of a pasted sheet on /time and shows where each lands. This is the write: one button over the preview. The
 * rule file (src/lib/operations/pasteRows.ts) is refined so a placement is exactly what the save does — a row on a stop that stands
 * writes only what the stop lacks, its record is the record form's own body, a new one-off is "+ expense"'s own, and a stop of the
 * row's own name takes the row. The save's rule (src/lib/operations/pasteSave.ts) says what a paste writes, runs it a row at a time
 * through writers handed in, stops at the first refusal, and types every word the save prints. The writers
 * (ledger/ledgerWrites.ts) gain the line's minutes and a routine's address. The leaf (ledger/PasteRows.tsx) reads again before it
 * writes, compares, and hands the six writers to the one runner.
 *
 * HERMETIC, on paste01.test.ts's model — no database, no network, and the only clock is the `now` handed in. The two rules are DRIVEN
 * directly over made-up rows; the runner is driven over writers that record their calls and hold nothing; the writers file is driven
 * over a stand-in fetch. Every name, day, account and amount below is invented. The leaf and the section are anchored to their source
 * with comments stripped (the reader law). No pin here names a line number of any file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import { NOT_RECORDED_WORDS, stopInput, type StopRecordRow } from '../operations/stopRecord';
import {
  NAME_LONG_WORDS, NOT_TRIED_WORDS, PLANNED_WORD, STEP_WORDS, WENT_WORD, expenseInput, oneOffBody, recordBody, recordInput, vendorBody,
  type LedgerPlanRow, type LedgerRecording, type LedgerRow, type LedgerSheetRow,
} from '../operations/ledger';
import {
  END_IS_START_WORDS, END_STANDS_WORDS, ON_TIME_SHEET_KEYS, PASTE_READ_HEADS, PASTE_TITLE_WORDS, RECORDED_NOT_WRITTEN_WORDS, VENDORS_NO_LIST_WORDS,
  countsWords, kindKeyOf, pasteKindsOf, pasteShown, placePaste, readPaste, standingPicks, vendorsOf, vendorsUnreadWords,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement,
} from '../operations/pasteRows';

import {
  CHANGED_WORDS, CHECKING_WORDS, NOTHING_TO_SAVE_WORDS, PASTE_STEPS, PASTE_STEP_WORDS, SPENT_WORDS, VENDORS_STAY_WORDS,
  daysReached, newVendorLines, newVendorsOf, pasteOutcomeWords, pasteWritesOf, runPaste, runStopped, runWords, saveWords, savingWords, shownChanged,
  type PasteOutcome, type PasteProgress, type PasteStep, type PasteWrite, type PasteWriters,
} from '../operations/pasteSave';

import { addVendor, createOneOff, readOneOffLine, setLineMinutes, setVendor } from '@/components/workbench/operations/ledger/ledgerWrites';

const RULES = 'src/lib/operations/pasteRows.ts';
const SAVE = 'src/lib/operations/pasteSave.ts';
const WRITERS = 'src/components/workbench/operations/ledger/ledgerWrites.ts';
const LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';

const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
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

// ── THE PAGE'S OWN — books, the time sheet's rows, charts and vendors, all made up ──

const NBO = 'Africa/Nairobi'; // three hours ahead of UTC the year round
const SAT = '2027-06-12';
const SUN = '2027-06-13';
const MON = '2027-06-14';
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();
/** Monday noon in the zone: Saturday and Sunday are past, Monday's 12:30 is half an hour ahead. */
const NOW = new Date('2027-06-14T09:00:00.000Z');

/** A plan row of the sheet — a priced stop with no record on it — in the ledger's own shape, at a line's address or (kind 'routine') a routine's own. */
const planned = (kind: 'routine_line' | 'routine', id: string, day: string, clock: string, name: string, over: Partial<LedgerPlanRow> = {}): LedgerPlanRow => ({
  id: null, key: `${kind}:${id}:${at(day, clock)}`, address: { kind, id, instant: at(day, clock) }, match: null, day, time: clock,
  place: null, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: name, rating: null, note: null, plannedItems: null, notes: null, // TIMESHEET-04b (2026-11-27): a plan row's three new fields — no tag, nothing planned to be had, and no notes (a row with no record has none)
  cents: 650, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 30, loggedMinutes: null, allDay: false, went: NOT_RECORDED_WORDS, ...over,
});
/** A recorded row, and the record it holds as the stops GET answers one. */
const recordOf = (id: string, target: string, day: string, clock: string, over: Partial<StopRecordRow> = {}): StopRecordRow => ({
  id, kind: 'routine_line', target_id: target, occurrence_at: at(day, clock), outcome: 'done', done_at: at(day, clock), actual_cents: 1500, rating: null, note: 'the set menu', notes: null, actual_minutes: null, ...over,
});
const recorded = (record: StopRecordRow, day: string, clock: string, name: string, over: Partial<LedgerRow> = {}): LedgerRow => ({
  id: record.id, key: `routine_line:${record.target_id}:${at(day, clock)}`, address: { kind: 'routine_line', id: record.target_id, instant: at(day, clock) }, match: null, day, time: clock,
  place: null, book: 'Personal', coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: name, rating: record.rating, note: record.note, notes: record.notes, // TIMESHEET-04b (2026-11-27): the row's two new fields — no tag; the record's notes
  cents: 1500, budgetState: 'matched', outcome: record.outcome, actualCents: record.actual_cents, varianceCents: null, plannedMinutes: null, loggedMinutes: record.actual_minutes, ...over,
});

const LUNCH_SUN = planned('routine_line', 'line-lunch', SUN, '12:30', 'Lunch');
const LUNCH_MON = planned('routine_line', 'line-lunch', MON, '12:30', 'Lunch', { went: PLANNED_WORD });
const COFFEE_SUN = planned('routine_line', 'line-coffee', SUN, '08:00', 'Coffee', { cents: 250, vendor: 'Bean Bar' });
const GYM_SUN = planned('routine', 'rt-gym', SUN, '18:00', 'Gym', { cents: 900, coa: { account: 'P-6200', name: 'Recreation' } });
const CINEMA_SUN = planned('routine_line', 'line-cinema', SUN, '21:00', 'Cinema', { cents: 1200, plannedMinutes: 120, coa: { account: 'P-6200', name: 'Recreation' } });
const MARKET_SUN_1 = planned('routine_line', 'line-market-a', SUN, '10:00', 'Market', { cents: 2000 });
const MARKET_SUN_2 = planned('routine_line', 'line-market-b', SUN, '10:00', 'Market', { cents: 2000 });
const PARADE_SUN = planned('routine_line', 'line-parade', SUN, '15:00', 'Parade', { went: null });
const DINNER_RECORD = recordOf('rec-dinner', 'line-dinner', SUN, '19:00');
const DINNER_SUN = recorded(DINNER_RECORD, SUN, '19:00', 'Dinner');
const YOGA_RECORD = recordOf('rec-yoga', 'line-yoga', SUN, '07:00', { outcome: 'skipped', done_at: null, actual_cents: null, note: 'rained off' });
const YOGA_SUN = recorded(YOGA_RECORD, SUN, '07:00', 'Yoga', { cents: 800 });
const SHEET: readonly LedgerSheetRow[] = [YOGA_SUN, COFFEE_SUN, MARKET_SUN_1, MARKET_SUN_2, LUNCH_SUN, PARADE_SUN, GYM_SUN, DINNER_SUN, CINEMA_SUN, LUNCH_MON];

const PARADE_WORDS = 'the routine has lines — record each line, not the routine';
const taking = (row: LedgerSheetRow, held: StopRecordRow | null = null): LedgerRecording => ({ takes: true, plannedAt: row.address.instant, held, vendor: { kind: 'none' } });
const RECORDING: Readonly<Record<string, LedgerRecording>> = {
  ...Object.fromEntries(SHEET.map((row) => [row.key, taking(row)])),
  [DINNER_SUN.key]: taking(DINNER_SUN, DINNER_RECORD),
  [YOGA_SUN.key]: taking(YOGA_SUN, YOGA_RECORD),
  [PARADE_SUN.key]: { takes: false, words: PARADE_WORDS },
};

const BOOKS = [{ id: 'P', name: 'Home', entityType: 'personal' }, { id: 'B', name: 'Shop', entityType: 'sole_prop' }];
const CONTEXT: PasteContext = {
  books: BOOKS, sheet: SHEET, recording: RECORDING,
  charts: { P: [{ code: '6150', name: 'Dining Out' }, { code: '6200', name: 'Recreation' }], B: [{ code: '6400', name: 'Supplies' }] },
  vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P' }, { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B' }],
  zone: NBO, now: NOW,
};

const ON_PLAN = (plan: string): PastePick => ({ kind: 'plan', plan });
const ONE_OFF = (code: string): PastePick => ({ kind: 'oneOff', code });
/** A paste placed, every row's kind given the one pick handed in: its placements and the table's rows. */
const placedWith = (paste: Paste, pick: PastePick, context: PasteContext = CONTEXT) => {
  const picks: Record<string, PastePick> = {};
  for (const row of paste.rows) if (row.kind === 'read') picks[kindKeyOf(row.cells)] = pick;
  const placements = placePaste(paste, picks, context);
  return { placements, shown: pasteShown(paste, placements) };
};
/** One row, placed with its pick: its placement and the table's row for it. */
const landed = (typed: Typed, pick: PastePick, context: PasteContext = CONTEXT) => {
  const paste = pasteOf(typed);
  const { placements, shown } = placedWith(paste, pick, context);
  return { paste, placement: placements[0], shown: shown[0], counts: countsWords(placements) };
};
/** A placement on a stop that stands — or the test fails with what it is. */
const onStop = (placement: PastePlacement): Extract<PastePlacement, { readonly kind: 'plan' }> => {
  if (placement.kind !== 'plan') return assert.fail(`placed: ${placement.kind}${placement.kind === 'refused' ? ` — ${placement.head}: ${placement.why}` : ''}`);
  return placement;
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
/** The cells of ON THE TIME SHEET, by the time sheet's own column keys. */
const sheetCells = (cells: readonly string[]): Record<string, string> => Object.fromEntries(ON_TIME_SHEET_KEYS.map((key, i) => [key, cells[i]]));

/** A row every cell of which reads — a past lunch on a plan. */
const LUNCH: Typed = { 'Start Date': '6/13/27', 'Start Time': '12:30 PM', 'End Time': '1:00 PM', Category: 'Dining', Entity: 'Personal', Type: 'Lunch', Items: 'two kinds of soup', Vendor: 'Oat House', 'Total (USD)': '$6.90', 'Budget (USD)': '6.50' };
/** A row of a kind picked a one-off — a past evening out, with nothing of its name on the time sheet. */
const BOWLING: Typed = { 'Start Date': '6/13/27', 'Start Time': '8:00 PM', 'End Time': '9:30 PM', Category: 'Fun', Entity: 'Personal', Type: 'Bowling', Items: 'two games', Vendor: 'Pin Palace', 'Total (USD)': '18', 'Budget (USD)': '$20.00' };

// ── T1 · ON A STOP THAT STANDS — THE RECORD'S BODY (rulings A.1, A.2) ────────

test('T1 a row on a stop that stands, recorded went: its record is the record form’s own body — recordInput’s for that row, at the sheet row’s own address, done at the stop’s planned instant — and the stops rule takes it', () => {
  const went = onStop(landed(LUNCH, ON_PLAN('Lunch')).placement);
  assert.deepEqual([went.standing, went.plan, went.stop.key, went.happened], [false, 'Lunch', LUNCH_SUN.key, { kind: 'went', cents: 690, items: 'two kinds of soup' }]);
  // The body is the one rule's, handed the row as the record form's boxes: went, the Total (USD) as dollars, no stars, no minutes, the Items.
  const form = recordInput({ went: WENT_WORD, actual: '6.90', stars: '', minutes: '', note: 'two kinds of soup', notes: '' }, LUNCH_SUN.address, { plannedAt: at(SUN, '12:30'), held: null }, NOW);
  assert.ok(form.ok);
  assert.deepEqual(went.record, form.body);
  assert.deepEqual(went.record, {
    kind: 'routine_line', id: 'line-lunch', instant: at(SUN, '12:30'), outcome: 'done', done_at: at(SUN, '12:30'), actual_cents: 690, rating: null, note: 'two kinds of soup', notes: null, actual_minutes: null,
  }, 'done at the stop’s planned instant, as the row’s own form saves a first went; no stars, no minutes and no notes are filled'); // TIMESHEET-04b (2026-11-27): the body says its notes — null: the paste fills none until it reads a Notes column (TIMESHEET-04c)
  // The stops route's own rule takes that body, with the same clock, and stores what was sent.
  const taken = stopInput(went.record, NOW);
  assert.ok(taken.ok, taken.ok ? '' : `${taken.field}: ${taken.message}`);
  // No Items: the note is none. A Total (USD) of 0 is a Total.
  const bare = onStop(landed({ ...LUNCH, Items: '', 'Total (USD)': '0' }, ON_PLAN('Lunch')).placement);
  assert.deepEqual(bare.record === null ? null : [bare.record.actual_cents, bare.record.note, bare.record.done_at], [0, null, at(SUN, '12:30')]);
  // The planned instant is the entry's — not the occurrence's — when the two differ (a line whose step states its own time of day).
  const later: PasteContext = { ...CONTEXT, recording: { ...RECORDING, [LUNCH_SUN.key]: { takes: true, plannedAt: at(SUN, '13:15'), held: null, vendor: { kind: 'none' } } } };
  const moved = onStop(landed(LUNCH, ON_PLAN('Lunch'), later).placement);
  assert.deepEqual(moved.record === null ? null : [moved.record.instant, moved.record.done_at, moved.instant], [at(SUN, '12:30'), at(SUN, '13:15'), at(SUN, '13:15')], 'the address is the sheet row’s own; the done time is the planned instant');
  // A routine's own address is a routine's.
  const gym = onStop(landed({ 'Start Date': '6/13/27', Category: 'Sport', Entity: 'Personal', Type: 'Gym', 'Total (USD)': '9' }, ON_PLAN('Gym')).placement);
  assert.deepEqual(gym.record === null ? null : [gym.record.kind, gym.record.id, gym.record.instant], ['routine', 'rt-gym', at(SUN, '18:00')]);
  // No record to write → null: no Total (USD); a stop still ahead; a record that stands.
  assert.equal(onStop(landed({ ...LUNCH, 'Total (USD)': '' }, ON_PLAN('Lunch')).placement).record, null);
  assert.equal(onStop(landed({ ...LUNCH, 'Start Date': '6/14/27' }, ON_PLAN('Lunch')).placement).record, null);
  assert.equal(onStop(landed({ 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Dinner', 'Total (USD)': '15' }, ON_PLAN('Dinner')).placement).record, null);
});

// ── T2 · ON A STOP THAT STANDS — WHAT STANDS (ruling A.1) ────────────────────

test('T2 of the row, only what the stop lacks is written; what stands is said only where the row says something else: another vendor; a record that differs; a skipped record — and a record that says the same is quiet, a stop still ahead is planned with its vendor', () => {
  // Another vendor standing → kept and said; the record is still made.
  const coffee: Typed = { 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Coffee', Vendor: 'Corner Cup', 'Total (USD)': '2.50' };
  const other = onStop(landed(coffee, ON_PLAN('Coffee')).placement);
  assert.deepEqual([other.vendor, other.happened, other.notWritten], [{ kind: 'none' }, { kind: 'went', cents: 250, items: null }, ['Vendor — not written: this stop already has the vendor "Bean Bar" — the paste does not change a vendor']]);
  assert.deepEqual(other.record === null ? null : [other.record.id, other.record.actual_cents, other.record.done_at], ['line-coffee', 250, at(SUN, '08:00')], 'the record is the stop’s to take: it has none');
  // A record that says the same — done, its amount the row's Total (USD), its note the row's Items → nothing is said; the vendor the stop lacks is still planned.
  const dinner: Typed = { 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Dinner', Vendor: 'Oat House', Items: 'the set menu', 'Total (USD)': '$15.00' };
  const same = onStop(landed(dinner, ON_PLAN('Dinner')).placement);
  assert.deepEqual([same.happened, same.record, same.notWritten, same.vendor], [{ kind: 'recorded' }, null, [], { kind: 'own', id: 'v-oat', name: 'Oat House' }]);
  assert.equal(landed(dinner, ON_PLAN('Dinner')).shown.lands, 'on "Dinner", its 19:00 stop · vendor: Personal\'s own · already recorded');
  // None equal to none: a record with no note and a row with no Items say the same.
  const noNote: PasteContext = { ...CONTEXT, recording: { ...RECORDING, [DINNER_SUN.key]: taking(DINNER_SUN, { ...DINNER_RECORD, note: null }) } };
  assert.deepEqual(onStop(landed({ ...dinner, Items: '' }, ON_PLAN('Dinner'), noNote).placement).notWritten, []);
  // A record that differs → kept, and said: another Total (USD); other Items; Items where the record has none; a Total where the record's amount is none.
  for (const [over, context] of [
    [{ 'Total (USD)': '16' }, CONTEXT], [{ Items: 'the tasting menu' }, CONTEXT], [{ Items: 'the set menu' }, noNote],
    [{ 'Total (USD)': '15' }, { ...CONTEXT, recording: { ...RECORDING, [DINNER_SUN.key]: taking(DINNER_SUN, { ...DINNER_RECORD, actual_cents: null }) } }],
  ] as const) {
    const differs = onStop(landed({ ...dinner, ...over }, ON_PLAN('Dinner'), context).placement);
    assert.deepEqual([differs.happened, differs.record, differs.notWritten], [{ kind: 'recorded' }, null, [RECORDED_NOT_WRITTEN_WORDS]], JSON.stringify(over));
  }
  // The row holds neither a Total (USD) nor Items: it says nothing of the record, and nothing is said.
  assert.deepEqual(onStop(landed({ ...dinner, Items: '', 'Total (USD)': '' }, ON_PLAN('Dinner')).placement).notWritten, []);
  // A skipped record is a record: kept, and said — also when its note is the row's Items.
  const yoga: Typed = { 'Start Date': '6/13/27', Category: 'Sport', Entity: 'Personal', Type: 'Yoga', Items: 'rained off', 'Total (USD)': '8' };
  const skipped = onStop(landed(yoga, ON_PLAN('Yoga')).placement);
  assert.deepEqual([skipped.happened, skipped.record, skipped.notWritten], [{ kind: 'recorded' }, null, [RECORDED_NOT_WRITTEN_WORDS]]);
  assert.deepEqual(onStop(landed({ ...yoga, 'Total (USD)': '' }, ON_PLAN('Yoga')).placement).notWritten, [RECORDED_NOT_WRITTEN_WORDS], 'a skip is not done: its note being the row’s Items is not the same record');
  assert.equal(landed(yoga, ON_PLAN('Yoga')).shown.lands, `on "Yoga", its 07:00 stop · already recorded · ${RECORDED_NOT_WRITTEN_WORDS}`);
  // A stop still ahead → planned: its vendor is still set, and no record is made.
  const ahead = onStop(landed({ ...LUNCH, 'Start Date': '6/14/27' }, ON_PLAN('Lunch')).placement);
  assert.deepEqual([ahead.stop.key, ahead.happened, ahead.record, ahead.vendor], [LUNCH_MON.key, { kind: 'planned' }, null, { kind: 'own', id: 'v-oat', name: 'Oat House' }]);
  // Both at once: another vendor and a record that differs — the record's sentence, then the vendor's.
  const both: PasteContext = { ...CONTEXT, sheet: SHEET.map((row) => (row === DINNER_SUN ? { ...DINNER_SUN, vendor: 'Bean Bar' } : row)) };
  assert.deepEqual(onStop(landed({ ...dinner, 'Total (USD)': '16' }, ON_PLAN('Dinner'), both).placement).notWritten, [RECORDED_NOT_WRITTEN_WORDS, 'Vendor — not written: this stop already has the vendor "Bean Bar" — the paste does not change a vendor']);
});

// ── T3 · A STOP OF THE ROW'S OWN NAME (ruling A.4) ───────────────────────────

test('T3 a kind picked a one-off whose stop already stands — that book, day, Start Time and name — lands on it, by the one path: no Budget (USD) asked, at its own address; an End Time that is not its END is said; two of one name are refused; a second row on it is refused with the first row’s number', () => {
  const cinema: Typed = { 'Start Date': '6/13/27', 'Start Time': '9:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Cinema', Vendor: 'Oat House', 'Total (USD)': '12' };
  // It lands on the stop — with no Budget (USD), which a new one-off needs.
  const row = landed(cinema, ONE_OFF('6200'));
  const stood = onStop(row.placement);
  assert.deepEqual([stood.standing, stood.plan, stood.stop.key, stood.instant], [true, 'Cinema', CINEMA_SUN.key, at(SUN, '21:00')]);
  assert.deepEqual([stood.vendor, stood.happened, stood.notWritten], [{ kind: 'own', id: 'v-oat', name: 'Oat House' }, { kind: 'went', cents: 1200, items: null }, []]);
  assert.deepEqual(stood.record === null ? null : [stood.record.kind, stood.record.id, stood.record.instant, stood.record.done_at], ['routine_line', 'line-cinema', at(SUN, '21:00'), at(SUN, '21:00')], 'the record at the sheet row’s own address');
  // The preview: the stop's own cells — its END its own — and LANDS says it already stands.
  assert.deepEqual(sheetCells(row.shown.sheet), { start: '21:00', end: '23:00', account: 'P-6200', accountName: 'Recreation', subAccountName: 'Cinema', went: WENT_WORD, budget: '$12', actual: '$12' });
  assert.equal(row.shown.lands, 'on the stop "Cinema" at 21:00, already on the time sheet · vendor: Personal\'s own · recorded: went, $12.00');
  assert.equal(row.shown.tone, 'placed');
  // An End Time: the stop's own END → nothing said; another → said, and nothing of the stop's plan is written.
  assert.deepEqual(onStop(landed({ ...cinema, 'End Time': '11:00 PM' }, ONE_OFF('6200')).placement).notWritten, []);
  const otherEnd = landed({ ...cinema, 'End Time': '11:30 PM' }, ONE_OFF('6200'));
  assert.deepEqual(onStop(otherEnd.placement).notWritten, [END_STANDS_WORDS]);
  assert.equal(END_STANDS_WORDS, 'End Time — not written: this stop already stands, with its own end');
  assert.equal(sheetCells(otherEnd.shown.sheet).end, '23:00', 'the END shown is the stop’s');
  assert.equal(otherEnd.shown.lands, `on the stop "Cinema" at 21:00, already on the time sheet · vendor: Personal's own · recorded: went, $12.00 · ${END_STANDS_WORDS}`);
  // A plan's stop is found by its day and its plan — the row's End Time is not read for it, and nothing is said of it.
  assert.deepEqual(onStop(landed({ ...LUNCH, 'End Time': '3:00 PM' }, ON_PLAN('Lunch')).placement).notWritten, []);
  // What stands on it is kept by the same path: its record, its vendor.
  const recordedOn: PasteContext = { ...CONTEXT, recording: { ...RECORDING, [CINEMA_SUN.key]: taking(CINEMA_SUN, recordOf('rec-cinema', 'line-cinema', SUN, '21:00', { actual_cents: 1200, note: null })) } };
  assert.deepEqual([onStop(landed(cinema, ONE_OFF('6200'), recordedOn).placement).happened, onStop(landed(cinema, ONE_OFF('6200'), recordedOn).placement).notWritten], [{ kind: 'recorded' }, []], 'the row a save wrote, pasted again: quiet');
  assert.equal(landed({ ...cinema, Vendor: '' }, ONE_OFF('6200'), recordedOn).shown.lands, 'on the stop "Cinema" at 21:00, already on the time sheet · already recorded');
  // Two stops of one name at one day and time: the paste cannot tell which.
  assert.deepEqual(refusedAt(landed({ 'Start Date': '6/13/27', 'Start Time': '10:00 AM', Category: 'Food', Entity: 'Personal', Type: 'Market', 'Budget (USD)': '20' }, ONE_OFF('6150')).placement), ['Type', 'more than one stop named "Market" stands at this day and time — the paste cannot tell which']);
  // An entry that takes no record refuses on Type, in its own words.
  assert.deepEqual(refusedAt(landed({ 'Start Date': '6/13/27', 'Start Time': '3:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Parade' }, ONE_OFF('6200')).placement), ['Type', PARADE_WORDS]);
  // A second row of the paste on the stop: refused with the first row's number — a second one needs its own Start Time.
  const twice = placedWith(pasteOf(cinema, { ...cinema, Items: 'again' }, { ...cinema, 'Start Time': '9:30 PM', 'Budget (USD)': '12' }), ONE_OFF('6200'));
  assert.deepEqual(twice.placements.map((p) => p.kind), ['plan', 'refused', 'oneOff']);
  assert.deepEqual(refusedAt(twice.placements[1]), ['Type', 'row 2 of the paste is already on this day\'s stop of "Cinema" — a second one needs its own Start Time and a one-off']);
  // Another day, time, name or book is no such stop: a new one-off, which does need its Budget (USD).
  for (const over of [{ 'Start Date': '6/12/27' }, { 'Start Time': '9:05 PM' }, { Type: 'cinema' }] as const) {
    assert.deepEqual(refusedAt(landed({ ...cinema, ...over }, ONE_OFF('6200')).placement), ['Budget (USD)', 'a one-off needs a Budget (USD) above 0'], JSON.stringify(over));
  }
  // The account is asked first, and the Start Time: a standing stop is found by its Start Time.
  assert.deepEqual(refusedAt(landed(cinema, ONE_OFF('9999')).placement)[0], 'Category');
  assert.deepEqual(refusedAt(landed({ ...cinema, 'Start Time': '' }, ONE_OFF('6200')).placement), ['Start Time', 'a one-off needs a Start Time']);
});

// ── T4 · A NEW ONE-OFF (ruling A.3) ──────────────────────────────────────────

test('T4 a new one-off is "+ expense"’s: its values are that form’s one rule’s for the row; its minutes are End Time less Start Time — past midnight, and none when the two are one; a stop still ahead is planned; the form’s refusal is the row’s, under the column its box was filled from', () => {
  const went = oneOff(landed(BOWLING, ONE_OFF('6200')).placement);
  // The values are expenseInput's, handed the row as the form's boxes — the Budget (USD) and the Total (USD) as dollars, the record's two because the row is recorded went.
  const form = expenseInput({ day: SUN, time: '20:00', name: 'Bowling', amount: '20.00', coa: '6200', book: 'P', vendorId: '', vendorName: 'Pin Palace', actual: '18.00', stars: '', note: 'two games' }, NBO, NOW);
  assert.ok(form.ok);
  assert.deepEqual(went.values, form.value);
  assert.deepEqual(went.values, {
    day: SUN, time: '20:00', zone: NBO, instant: at(SUN, '20:00'), name: 'Bowling', amount: '20.00', coa: '6200', bookId: 'P',
    vendor: { kind: 'new', name: 'Pin Palace' }, actualCents: 1800, rating: null, note: 'two games', ahead: false,
  });
  assert.deepEqual([went.instant, went.name, went.start, went.end, went.minutes, went.budgetCents], [at(SUN, '20:00'), 'Bowling', '20:00', '21:30', 90, 2000], 'its instant and its name are the values’ own');
  assert.deepEqual([went.vendor, went.happened, went.notWritten], [{ kind: 'new', name: 'Pin Palace' }, { kind: 'went', cents: 1800, items: 'two games' }, []]);
  // Another day is another stop, on that day.
  assert.deepEqual([oneOff(landed({ ...BOWLING, 'Start Date': '6/12/27' }, ONE_OFF('6200')).placement).values.day, oneOff(landed({ ...BOWLING, 'Start Date': '6/12/27' }, ONE_OFF('6200')).placement).instant], [SAT, at(SAT, '20:00')]);
  // The book's own vendor goes in by its id; no vendor, none.
  assert.deepEqual(oneOff(landed({ ...BOWLING, Vendor: ' oat  HOUSE ' }, ONE_OFF('6200')).placement).values.vendor, { kind: 'existing', id: 'v-oat' });
  assert.deepEqual(oneOff(landed({ ...BOWLING, Vendor: '' }, ONE_OFF('6200')).placement).values.vendor, { kind: 'none' });
  // No Total (USD): not recorded — the record's boxes are not filled, and the Items is said.
  const none = oneOff(landed({ ...BOWLING, 'Total (USD)': '' }, ONE_OFF('6200')).placement);
  assert.deepEqual([none.values.actualCents, none.values.note, none.happened, none.notWritten], [null, null, { kind: 'not recorded' }, ['Items — not written: the row holds no Total (USD), so no record is made']]);
  // Still ahead → planned: no record's box is filled, and each one typed is said.
  const ahead = oneOff(landed({ ...BOWLING, 'Start Date': '6/14/27' }, ONE_OFF('6200')).placement);
  assert.deepEqual([ahead.values.ahead, ahead.values.actualCents, ahead.values.note, ahead.happened], [true, null, null, { kind: 'planned' }]);
  assert.deepEqual(ahead.notWritten, ['Items — not written: the stop is still ahead, and a planned stop holds none yet', 'Total (USD) — not written: the stop is still ahead']);
  // The clock decides by the form's own test: at the skew's edge the stop is not ahead; a minute past it, it is.
  const edge = (minutes: number) => oneOff(landed(BOWLING, ONE_OFF('6200'), { ...CONTEXT, now: new Date(Date.parse(at(SUN, '20:00')) - minutes * 60_000) }).placement);
  assert.deepEqual([[edge(10).values.ahead, edge(10).happened.kind], [edge(11).values.ahead, edge(11).happened.kind]], [[false, 'went'], [true, 'planned']]);
  // ITS MINUTES: End Time less Start Time; an End Time earlier than the Start Time ends the next day.
  const minutesOf = (start: string, end: string) => { const p = oneOff(landed({ ...BOWLING, 'Start Time': start, 'End Time': end }, ONE_OFF('6200')).placement); return [p.minutes, p.end, p.notWritten]; };
  assert.deepEqual(minutesOf('8:00 PM', '9:30 PM'), [90, '21:30', []]);
  assert.deepEqual(minutesOf('11:00 PM', '1:00 AM'), [120, '01:00', []], '23:00 to 01:00 is 120');
  assert.deepEqual(minutesOf('8:00 PM', '7:59 PM'), [1439, '19:59', []]);
  assert.deepEqual(minutesOf('8:00 PM', ''), [null, null, []], 'no End Time: none');
  // An End Time that IS the Start Time → none, and said; the END cell is blank.
  const flat = landed({ ...BOWLING, 'End Time': '20:00' }, ONE_OFF('6200'));
  assert.deepEqual([oneOff(flat.placement).minutes, oneOff(flat.placement).end, oneOff(flat.placement).notWritten], [null, null, [END_IS_START_WORDS]]);
  assert.equal(END_IS_START_WORDS, 'End Time — not written: it is the Start Time');
  assert.deepEqual(sheetCells(flat.shown.sheet), { start: '20:00', end: BLANK, account: 'P-6200', accountName: 'Recreation', subAccountName: 'Bowling', went: WENT_WORD, budget: '$20', actual: '$18' });
  assert.equal(flat.shown.lands, `a one-off at 20:00, under P-6200 Recreation · vendor: new to Personal · recorded: went, $18.00 · ${END_IS_START_WORDS}`);
  assert.equal(sheetCells(landed(BOWLING, ONE_OFF('6200')).shown.sheet).end, '21:30', 'the END is shown when its minutes are written');
  // The form's rule refusing: the row is refused under the column its box was filled from, in the form's own words.
  // PASTE-02b (Alex, 2026-11-27): a name is at most 181 characters — the one-off's routine is named for its day and time, and the name with that tail fits the column's 200. Until then
  // the refused Type was 201 characters, the words 'NAME is at most 200 characters', and the longest Type that landed 200.
  const long = landed({ ...BOWLING, Type: 'b'.repeat(182) }, ONE_OFF('6200'));
  assert.deepEqual(refusedAt(long.placement), ['Type', NAME_LONG_WORDS]);
  assert.equal(NAME_LONG_WORDS, 'NAME is at most 181 characters');
  assert.deepEqual([long.shown.lands, long.shown.tone], [`Type — ${NAME_LONG_WORDS}`, 'refused']);
  assert.equal(oneOff(landed({ ...BOWLING, Type: 'b'.repeat(181) }, ONE_OFF('6200')).placement).name, 'b'.repeat(181));
});

// ── T5 · THE COUNTS AND LANDS (ruling A.5) ───────────────────────────────────

test('T5 the counts: "on a plan" counts the rows on a plan’s stop; the one-offs are those on a stop that stands and the new ones, and say how many are new — with the zero and the singular; every row is counted once', () => {
  const cinema: Typed = { 'Start Date': '6/13/27', 'Start Time': '9:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Cinema' };
  const paste = pasteOf(LUNCH, cinema, BOWLING, { ...BOWLING, 'Start Date': '6/12/27' }, { 'Start Date': '6/12/27' }, { ...LUNCH, 'Start Date': 'soon' });
  const key = (category: string, type: string): string => kindKeyOf({ entity: 'Personal', category, type });
  const picks = { [key('Dining', 'Lunch')]: ON_PLAN('Lunch'), [key('Fun', 'Cinema')]: ONE_OFF('6200'), [key('Fun', 'Bowling')]: ONE_OFF('6200') };
  const placed = placePaste(paste, picks, CONTEXT);
  assert.deepEqual(placed.map((p) => (p.kind === 'plan' ? `plan${p.standing ? ', standing' : ''}` : p.kind)), ['plan', 'plan, standing', 'oneOff', 'oneOff', 'blank', 'refused']);
  assert.equal(countsWords(placed), '6 rows read · 1 on a plan · 3 one-offs (2 new) · 0 bookings · 0 waiting for a pick · 1 that cannot be placed · 1 date with nothing on it');
  // Every row once: the six after "rows read" add up to it.
  const numbers = countsWords(placed).split(' · ').map((part) => Number(part.split(' ')[0]));
  assert.equal(numbers.slice(1).reduce((sum, n) => sum + n, 0), numbers[0]);
  // The one-offs that are all on stops that stand: none new.
  assert.equal(countsWords(placePaste(pasteOf(cinema), picks, CONTEXT)), '1 row read · 0 on a plan · 1 one-off (0 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  // The singular, new; the zero.
  assert.equal(countsWords(placePaste(pasteOf(BOWLING), picks, CONTEXT)), '1 row read · 0 on a plan · 1 one-off (1 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  assert.equal(countsWords(placePaste(pasteOf(LUNCH), picks, CONTEXT)), '1 row read · 1 on a plan · 0 one-offs · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  assert.equal(countsWords(placePaste(pasteOf(BOWLING, { ...BOWLING, 'Start Time': '9:00 PM', Type: 'Cinema', 'End Time': '' }, { ...BOWLING, 'Start Date': '6/12/27' }), { ...picks, [key('Fun', 'Cinema')]: ONE_OFF('6200') }, CONTEXT)).split(' · ')[2], '3 one-offs (2 new)');
  // The title says a save exists.
  assert.equal(PASTE_TITLE_WORDS, 'rows from your sheet — read and placed here; nothing is written until you save');
});

// ── T6 · THE PICKS THAT STILL STAND (ruling A.6) ─────────────────────────────

test('T6 standingPicks: a pick is applied only while its kind is in the paste and what it names is still offered — kept; its kind gone from the paste; its plan no longer offered; its account no longer in the chart', () => {
  const paste = pasteOf(LUNCH, BOWLING);
  const kinds = pasteKindsOf(paste);
  const lunch = kindKeyOf({ entity: 'Personal', category: 'Dining', type: 'Lunch' });
  const bowling = kindKeyOf({ entity: 'Personal', category: 'Fun', type: 'Bowling' });
  const tea = kindKeyOf({ entity: 'Personal', category: 'Dining', type: 'Tea' });
  const picks = Object.freeze({ [lunch]: ON_PLAN('Lunch'), [bowling]: ONE_OFF('6200'), [tea]: ON_PLAN('Lunch') });
  // Kept: the plan among that book's plans, the account in that book's chart. The kind that is not in the paste is dropped.
  assert.deepEqual(standingPicks(picks, kinds, CONTEXT), { [lunch]: ON_PLAN('Lunch'), [bowling]: ONE_OFF('6200') });
  assert.deepEqual(standingPicks(picks, pasteKindsOf(pasteOf(BOWLING)), CONTEXT), { [bowling]: ONE_OFF('6200') }, 'its kind gone from the paste');
  // Its plan no longer offered: the time sheet read holds no row of that name that takes a record.
  const noLunch: PasteContext = { ...CONTEXT, sheet: SHEET.filter((row) => row.description !== 'Lunch') };
  assert.deepEqual(standingPicks(picks, kinds, noLunch), { [bowling]: ONE_OFF('6200') });
  assert.deepEqual(standingPicks({ [lunch]: ON_PLAN('Parade') }, kinds, CONTEXT), {}, 'a plan whose only stop takes no record is not offered');
  // Its account no longer in the chart.
  const noAccount: PasteContext = { ...CONTEXT, charts: { ...CONTEXT.charts, P: [{ code: '6150', name: 'Dining Out' }] } };
  assert.deepEqual(standingPicks(picks, kinds, noAccount), { [lunch]: ON_PLAN('Lunch') });
  // Another book's account is not this book's.
  assert.deepEqual(standingPicks({ [bowling]: ONE_OFF('6400') }, kinds, CONTEXT), {});
  // A kind whose Entity names no one book has nothing offered.
  const stranger = pasteKindsOf(pasteOf({ ...LUNCH, Entity: 'Estate' }));
  assert.deepEqual(standingPicks({ [stranger[0].key]: ON_PLAN('Lunch') }, stranger, CONTEXT), {});
  // A pick that does not stand is never applied unseen: its rows wait for a pick again.
  const placed = placePaste(paste, standingPicks(picks, kinds, noLunch), noLunch);
  assert.deepEqual(placed.map((p) => p.kind), ['pick', 'oneOff']);
  // Nothing handed in is changed, and no pick: none.
  assert.deepEqual(standingPicks({}, kinds, CONTEXT), {});
});

// ── T7 · THE VENDORS, READ (ruling A.7) ──────────────────────────────────────

test('T7 vendorsOf: the directory’s answer as the caller’s vendors — the list; an answer with no list, or an entry that lacks one of the three, is refused in words, never read as an empty list', () => {
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P', category: null }, { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B', category: 'print' }] }), {
    ok: true, vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P' }, { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B' }],
  }, 'the three the paste reads, and nothing else of the row');
  assert.deepEqual(vendorsOf({ vendors: [] }), { ok: true, vendors: [] }, 'a caller with no vendor is a list of none');
  const refused = { ok: false, words: 'the list came back without its vendors' };
  for (const bad of [{}, { vendors: null }, { vendors: 'none' }, { error: 'Failed to fetch vendors' }, { vendors: [null] }, { vendors: ['Oat House'] }]) assert.deepEqual(vendorsOf(bad), refused, JSON.stringify(bad));
  // An entry without its id; without its name; without its book.
  assert.deepEqual(vendorsOf({ vendors: [{ vendor_name: 'Oat House', entity_id: 'P' }] }), refused, 'an entry without its id');
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', entity_id: 'P' }] }), refused);
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: null }] }), refused);
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P' }, { id: 7, vendor_name: 'Ink Works', entity_id: 'B' }] }), refused, 'one bad entry refuses the list');
  assert.equal(VENDORS_NO_LIST_WORDS, 'the list came back without its vendors');
  assert.equal(vendorsUnreadWords(VENDORS_NO_LIST_WORDS), 'the vendors could not be read — the list came back without its vendors', 'as the leaf says it');
  // The rule file is still pure, and reads neither writer's file.
  const rules = code(RULES);
  assert.doesNotMatch(rules, /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|from 'next|localStorage|sessionStorage|document\./);
  assert.doesNotMatch(rules, /stopWrites|ledgerWrites/, 'the record’s body is typed from the record form’s rule');
  assert.equal(countOf(rules, /Extract<RecordInputResult, \{ readonly ok: true \}>\['body'\]/g), 1);
  assert.match(comments(RULES), /\n \* PASTE-02 \(Alex, 2026-11-27\) — THE SAVE EXISTS NOW/);
});

// ── THE SAVE — a paste of made-up rows with every kind of write in it ────────

const kindOf = (category: string, type: string, entity = 'Personal'): string => kindKeyOf({ entity, category, type });
/** Row 2: on a plan's stop — the book's own vendor, and its record. Row 3: on a routine's own stop — a vendor new to the book, and its record. Row 4: a new one-off — the same new name,
 * spelled another way, its minutes and its record. Row 5: a new one-off still ahead — another new name, no minutes, no record. Row 6: on a stop whose vendor is the row's and that holds
 * no Total — nothing to write. Row 7: the other book's new one-off — the same new name is new to that book too. Row 8: a kind with no pick. Row 9: a date with nothing on it. */
const SAVE_ROWS: readonly Typed[] = [
  LUNCH,
  { 'Start Date': '6/13/27', Category: 'Sport', Entity: 'Personal', Type: 'Gym', Vendor: 'Pin Palace', 'Total (USD)': '9' },
  { ...BOWLING, Vendor: 'pin   PALACE' },
  { 'Start Date': '6/14/27', 'Start Time': '8:00 PM', Category: 'Fun', Entity: 'Personal', Type: 'Bowling', Vendor: 'Corner Cup', 'Budget (USD)': '20' },
  { 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Coffee', Vendor: 'bean bar' },
  { 'Start Date': '6/13/27', 'Start Time': '11:00 AM', 'End Time': '11:00 AM', Category: 'Office', Entity: 'Business', Type: 'Paper', Vendor: 'Pin Palace', 'Total (USD)': '4.20', 'Budget (USD)': '5' },
  { 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Tea' },
  { 'Start Date': '6/12/27' },
];
const SAVE_PICKS: Readonly<Record<string, PastePick>> = {
  [kindOf('Dining', 'Lunch')]: ON_PLAN('Lunch'), [kindOf('Sport', 'Gym')]: ON_PLAN('Gym'), [kindOf('Fun', 'Bowling')]: ONE_OFF('6200'),
  [kindOf('Dining', 'Coffee')]: ON_PLAN('Coffee'), [kindOf('Office', 'Paper', 'Business')]: ONE_OFF('6400'),
};
const SAVE_PASTE = pasteOf(...SAVE_ROWS);
const SAVE_PLACED = placePaste(SAVE_PASTE, SAVE_PICKS, CONTEXT);
const SAVE_WRITES = pasteWritesOf(SAVE_PASTE.rows, SAVE_PLACED);
const stopWrite = (write: PasteWrite): Extract<PasteWrite, { readonly kind: 'stop' }> => (write.kind === 'stop' ? write : assert.fail(`row ${write.row} is a ${write.kind}`));
const oneOffWrite = (write: PasteWrite): Extract<PasteWrite, { readonly kind: 'oneOff' }> => (write.kind === 'oneOff' ? write : assert.fail(`row ${write.row} is a ${write.kind}`));

/** What a writer is asked to refuse with: the route's own words — or, for the record, an error to throw. */
type Refusals = Partial<Record<PasteStep, string>> & { readonly recordThrows?: string };
/** Writers that record their calls and hold nothing. Each answers as its route would — ids made up, in the order asked — unless `refuse` names its step. */
function recorder(refuse: Refusals = {}) {
  const calls: (readonly [string, ...unknown[]])[] = [];
  let routines = 0;
  let vendors = 0;
  const no = (step: PasteStep) => ({ ok: false as const, words: refuse[step] as string });
  const writers: PasteWriters = {
    createOneOff: async (body) => { calls.push(['createOneOff', body]); if (refuse.stop !== undefined) return no('stop'); routines += 1; return { ok: true, value: { routineId: `rt-${routines}` } }; },
    readOneOffLine: async (routineId) => { calls.push(['readOneOffLine', routineId]); return refuse.line !== undefined ? no('line') : { ok: true, value: { lineId: `line-of-${routineId}` } }; },
    setLineMinutes: async (lineId, minutes) => { calls.push(['setLineMinutes', lineId, minutes]); return refuse.minutes !== undefined ? no('minutes') : { ok: true, value: null }; },
    addVendor: async (entityId, name) => { calls.push(['addVendor', entityId, name]); if (refuse.directory !== undefined) return no('directory'); vendors += 1; return { ok: true, value: { vendorId: `v-new-${vendors}` } }; },
    setVendor: async (body) => { calls.push(['setVendor', body]); return refuse.vendor !== undefined ? no('vendor') : { ok: true, value: { outcome: 'set' } }; },
    setRecord: async (body) => {
      calls.push(['setRecord', body]);
      if (refuse.recordThrows !== undefined) throw new Error(refuse.recordThrows);
      return refuse.record !== undefined ? { ok: false, message: refuse.record } : { ok: true };
    },
  };
  return { calls, writers };
}
const names = (calls: readonly (readonly [string, ...unknown[]])[]): string[] => calls.map((call) => call[0]);

// ── T8 · THE WRITES AND THE BUTTON (rulings B.1, B.5) ────────────────────────

test('T8 the writes of a paste: the placed rows that have something to write, in the paste’s order — a row on a stop with a vendor to plan or a record’s body, every new one-off; a row with nothing to write is not one; the button counts them, with its singulars; the new vendors by book', () => {
  assert.deepEqual(SAVE_PLACED.map((p) => p.kind), ['plan', 'plan', 'oneOff', 'oneOff', 'plan', 'oneOff', 'pick', 'blank']);
  // Five writes, in the paste's order: row 6 lands on a stop and has nothing to write; a row waiting for a pick and a blank date are not placed.
  assert.deepEqual(SAVE_WRITES.map((write) => [write.row, write.kind, write.day, write.book, write.vendor]), [
    [2, 'stop', SUN, { id: 'P', word: 'Personal' }, { kind: 'own', id: 'v-oat', name: 'Oat House' }],
    [3, 'stop', SUN, { id: 'P', word: 'Personal' }, { kind: 'new', name: 'Pin Palace' }],
    [4, 'oneOff', SUN, { id: 'P', word: 'Personal' }, { kind: 'new', name: 'pin PALACE' }],
    [5, 'oneOff', MON, { id: 'P', word: 'Personal' }, { kind: 'new', name: 'Corner Cup' }],
    [7, 'oneOff', SUN, { id: 'B', word: 'Business' }, { kind: 'new', name: 'Pin Palace' }],
  ]);
  // On a stop: the sheet row's own address — a line's, a routine's — and the record's body.
  assert.deepEqual([stopWrite(SAVE_WRITES[0]).address, stopWrite(SAVE_WRITES[1]).address], [LUNCH_SUN.address, GYM_SUN.address]);
  assert.deepEqual([stopWrite(SAVE_WRITES[0]).record, stopWrite(SAVE_WRITES[1]).record], [onStop(SAVE_PLACED[0]).record, onStop(SAVE_PLACED[1]).record]);
  assert.deepEqual(stopWrite(SAVE_WRITES[1]).record, { kind: 'routine', id: 'rt-gym', instant: at(SUN, '18:00'), outcome: 'done', done_at: at(SUN, '18:00'), actual_cents: 900, rating: null, note: null, notes: null, actual_minutes: null }); // TIMESHEET-04b (2026-11-27): the body says its notes — null: the paste fills none until it reads a Notes column (TIMESHEET-04c)
  // A one-off: "+ expense"'s values for it, its minutes or none, and whether it is recorded went.
  assert.deepEqual(SAVE_WRITES.slice(2).map((write) => [oneOffWrite(write).values, oneOffWrite(write).minutes, oneOffWrite(write).went]), [
    [oneOff(SAVE_PLACED[2]).values, 90, true], [oneOff(SAVE_PLACED[3]).values, null, false], [oneOff(SAVE_PLACED[5]).values, null, true],
  ]);
  // A row with nothing to write is not one: its vendor the stop's own and no Total; its record the stop's own and no vendor; a stop still ahead with no vendor.
  const quiet = pasteOf(
    { 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Coffee', Vendor: 'Bean Bar' },
    { 'Start Date': '6/13/27', Category: 'Dining', Entity: 'Personal', Type: 'Dinner', Items: 'the set menu', 'Total (USD)': '15' },
    { ...LUNCH, 'Start Date': '6/14/27', Vendor: '' },
    { ...LUNCH, 'Total (USD)': '', Vendor: '' },
  );
  const quietPlaced = placePaste(quiet, { ...SAVE_PICKS, [kindOf('Dining', 'Dinner')]: ON_PLAN('Dinner') }, CONTEXT);
  assert.deepEqual(quietPlaced.map((p) => p.kind), ['plan', 'plan', 'plan', 'plan']);
  assert.deepEqual(pasteWritesOf(quiet.rows, quietPlaced), [], 'four rows on stops, and nothing to save');
  assert.equal(NOTHING_TO_SAVE_WORDS, 'nothing to save — no placed row has a vendor to plan, a record to make or a one-off to add');
  // A vendor alone is a write; a record alone is a write.
  const alone = pasteOf({ ...LUNCH, 'Start Date': '6/14/27' }, { ...LUNCH, Vendor: '' });
  assert.deepEqual(pasteWritesOf(alone.rows, placePaste(alone, SAVE_PICKS, CONTEXT)).map((write) => [write.row, write.vendor.kind, stopWrite(write).record === null]), [[2, 'own', true], [3, 'none', false]]);
  assert.throws(() => pasteWritesOf(SAVE_PASTE.rows, SAVE_PLACED.slice(1)), /pasteSave: 7 placements for 8 rows — one placement a row/);

  // THE BUTTON: what the save writes. A new vendor is counted once a book — "Pin Palace" twice in one book is one, and one more in the other.
  assert.equal(saveWords(SAVE_WRITES), 'save 5 rows — 3 vendors added to a book · 5 vendors set on a stop · 4 records · 3 one-offs');
  // The singulars: "row", "vendor", "record", "one-off" for 1.
  const one = pasteOf(BOWLING);
  assert.equal(saveWords(pasteWritesOf(one.rows, placePaste(one, SAVE_PICKS, CONTEXT))), 'save 1 row — 1 vendor added to a book · 1 vendor set on a stop · 1 record · 1 one-off');
  assert.equal(saveWords(pasteWritesOf(alone.rows, placePaste(alone, SAVE_PICKS, CONTEXT))), 'save 2 rows — 0 vendors added to a book · 1 vendor set on a stop · 1 record · 0 one-offs');

  // THE NAMES a save would add: a line a book, the books in the paste's order; each name once, as its first row spells it; a book's names in name order.
  assert.deepEqual(newVendorsOf(SAVE_WRITES), [{ book: { id: 'P', word: 'Personal' }, names: ['Corner Cup', 'Pin Palace'] }, { book: { id: 'B', word: 'Business' }, names: ['Pin Palace'] }]);
  assert.deepEqual(newVendorLines(SAVE_WRITES), ['new to Personal (2): Corner Cup · Pin Palace', 'new to Business (1): Pin Palace'], 'in name order — the paste names Pin Palace first; "pin PALACE" is the same name, and is not said');
  assert.deepEqual(newVendorLines(pasteWritesOf(alone.rows, placePaste(alone, SAVE_PICKS, CONTEXT))), [], 'no new name: no line');
  assert.equal(VENDORS_STAY_WORDS, 'a vendor added to a book is never renamed or removed — read the names before you save');
});

// ── T9 · THE ONE RUNNER — EVERY CALL, IN ORDER (rulings B.2, B.3, B.4) ───────

test('T9 the runner writes a row at a time, each step in its order with its own body: on a stop — the vendor added (a new name), the vendor at the sheet row’s own address, the record; a new one-off — the stop, its line, its minutes, the vendor, the record; a new vendor is added once a save', async () => {
  const { calls, writers } = recorder();
  const told: PasteProgress[] = [];
  const outcomes = await runPaste(SAVE_WRITES, writers, (progress) => told.push(progress));
  const bowling = oneOff(SAVE_PLACED[2]).values;
  const ahead = oneOff(SAVE_PLACED[3]).values;
  const paper = oneOff(SAVE_PLACED[5]).values;
  assert.deepEqual(calls, [
    // Row 2 — on a plan's stop: the book's own vendor, at the line's own address for that day; then the record form's body.
    ['setVendor', { kind: 'routine_line', id: 'line-lunch', instant: at(SUN, '12:30'), vendorId: 'v-oat' }],
    ['setRecord', onStop(SAVE_PLACED[0]).record],
    // Row 3 — on a routine's own stop: a new name, added to the book; set at the routine's own address; the record.
    ['addVendor', 'P', 'Pin Palace'],
    ['setVendor', { kind: 'routine', id: 'rt-gym', instant: at(SUN, '18:00'), vendorId: 'v-new-1' }],
    ['setRecord', onStop(SAVE_PLACED[1]).record],
    // Row 4 — a new one-off: the stop, its line read back, its minutes; the vendor a row before it added — the id that came back, and no adding step; its record.
    ['createOneOff', oneOffBody(bowling)],
    ['readOneOffLine', 'rt-1'],
    ['setLineMinutes', 'line-of-rt-1', 90],
    ['setVendor', vendorBody(bowling, 'line-of-rt-1', 'v-new-1')],
    ['setRecord', recordBody(bowling, 'line-of-rt-1')],
    // Row 5 — a new one-off still ahead: no minutes (no End Time), another new name, and no record.
    ['createOneOff', oneOffBody(ahead)],
    ['readOneOffLine', 'rt-2'],
    ['addVendor', 'P', 'Corner Cup'],
    ['setVendor', vendorBody(ahead, 'line-of-rt-2', 'v-new-2')],
    // Row 7 — the other book's one-off: the same name is new to that book, and is added to it; no minutes (its End Time is its Start Time); its record.
    ['createOneOff', oneOffBody(paper)],
    ['readOneOffLine', 'rt-3'],
    ['addVendor', 'B', 'Pin Palace'],
    ['setVendor', vendorBody(paper, 'line-of-rt-3', 'v-new-3')],
    ['setRecord', recordBody(paper, 'line-of-rt-3')],
  ]);
  // The bodies are "+ expense"'s own: a one-off of one line in the book, its vendor on that line's occurrence, its record done at the stop's own instant.
  assert.deepEqual(vendorBody(bowling, 'line-of-rt-1', 'v-new-1'), { kind: 'routine_line', id: 'line-of-rt-1', instant: at(SUN, '20:00'), vendorId: 'v-new-1' });
  assert.deepEqual(recordBody(bowling, 'line-of-rt-1'), { kind: 'routine_line', id: 'line-of-rt-1', instant: at(SUN, '20:00'), outcome: 'done', done_at: at(SUN, '20:00'), actual_cents: 1800, rating: null, note: 'two games', notes: null, actual_minutes: null }); // TIMESHEET-04b (2026-11-27): "+ expense"'s record body says its notes — null: that form has no NOTES box
  // PASTE-02b (Alex, 2026-11-27): the routine is named for its day and time — the bare name ('Bowling') until then; its one line keeps the bare name.
  const body = oneOffBody(bowling);
  assert.deepEqual([body.name, body.entity_id, body.cadence_mode, body.start_date, body.start_time, body.timezone, body.lines], [`Bowling · ${SUN} 20:00`, 'P', 'once', SUN, '20:00', NBO, [{ activity: 'Bowling', budget_amount: '20.00', coa_code: '6200' }]]);
  // Every record the save sends is one the stops rule takes, with the clock the rows were placed with.
  for (const call of calls) if (call[0] === 'setRecord') assert.ok(stopInput(call[1], NOW).ok, JSON.stringify(call[1]));
  // One outcome a write, in order: every step it had.
  assert.deepEqual(outcomes, [
    { row: 2, state: 'written', steps: ['vendor', 'record'] },
    { row: 3, state: 'written', steps: ['directory', 'vendor', 'record'] },
    { row: 4, state: 'written', steps: ['stop', 'line', 'minutes', 'vendor', 'record'] },
    { row: 5, state: 'written', steps: ['stop', 'line', 'directory', 'vendor'] },
    { row: 7, state: 'written', steps: ['stop', 'line', 'directory', 'vendor', 'record'] },
  ]);
  // `said`: before each row — the outcomes so far, and that row's place — and once at the end.
  assert.deepEqual(told.map((progress) => [progress.outcomes.length, progress.at]), [
    [0, { i: 1, of: 5, row: 2 }], [1, { i: 2, of: 5, row: 3 }], [2, { i: 3, of: 5, row: 4 }], [3, { i: 4, of: 5, row: 5 }], [4, { i: 5, of: 5, row: 7 }], [5, null],
  ]);
  assert.deepEqual(told[5].outcomes, outcomes);
  assert.deepEqual(told[2].outcomes, outcomes.slice(0, 2), 'the outcomes so far are a list of their own, not the one still being filled');
  // The days the writes reached, each once, in the paste's order.
  assert.deepEqual(daysReached(SAVE_WRITES, outcomes), [SUN, MON]);
  assert.equal(runWords(outcomes), '5 rows saved');
  assert.equal(runStopped(outcomes), false);
  // No write at all: nothing asked, and said once.
  const none = recorder();
  const quiet: PasteProgress[] = [];
  assert.deepEqual(await runPaste([], none.writers, (progress) => quiet.push(progress)), []);
  assert.deepEqual([none.calls, quiet], [[], [{ outcomes: [], at: null }]]);
});

// ── T10 · THE ONE RUNNER — A REFUSAL STOPS THE SAVE (ruling B.4) ─────────────

test('T10 a write a route refuses stops the save, at each of the six steps: that row is failed — the steps written before it, the step, the route’s own words — nothing is asked after it, and every later row is not tried; a record request that throws is that row’s refusal', async () => {
  const WORDS = 'the route said no, in its own words';
  /** The run with one step refused: what was asked, and how each row came out. */
  const stoppedAt = async (refuse: Refusals) => {
    const { calls, writers } = recorder(refuse);
    const told: PasteProgress[] = [];
    const outcomes = await runPaste(SAVE_WRITES, writers, (progress) => told.push(progress));
    return { asked: names(calls), outcomes, told };
  };
  const notTried = (...rows: number[]): PasteOutcome[] => rows.map((row) => ({ row, state: 'not tried' }));

  // The vendor, on the stop — the first step of the first row: nothing written, nothing asked after it.
  const vendor = await stoppedAt({ vendor: WORDS });
  assert.deepEqual(vendor.asked, ['setVendor']);
  assert.deepEqual(vendor.outcomes, [{ row: 2, state: 'failed', steps: [], step: 'vendor', words: WORDS }, ...notTried(3, 4, 5, 7)]);
  // The record — row 2's second step: its vendor is written, and said as written.
  const record = await stoppedAt({ record: WORDS });
  assert.deepEqual(record.asked, ['setVendor', 'setRecord']);
  assert.deepEqual(record.outcomes, [{ row: 2, state: 'failed', steps: ['vendor'], step: 'record', words: WORDS }, ...notTried(3, 4, 5, 7)]);
  // The vendor, added to the book — row 3's first step: row 2 is written whole.
  const directory = await stoppedAt({ directory: WORDS });
  assert.deepEqual(directory.asked, ['setVendor', 'setRecord', 'addVendor']);
  assert.deepEqual(directory.outcomes, [{ row: 2, state: 'written', steps: ['vendor', 'record'] }, { row: 3, state: 'failed', steps: [], step: 'directory', words: WORDS }, ...notTried(4, 5, 7)]);
  // The one-off stop — row 4's first step.
  const stop = await stoppedAt({ stop: WORDS });
  assert.deepEqual(stop.asked, ['setVendor', 'setRecord', 'addVendor', 'setVendor', 'setRecord', 'createOneOff']);
  assert.deepEqual(stop.outcomes.slice(2), [{ row: 4, state: 'failed', steps: [], step: 'stop', words: WORDS }, ...notTried(5, 7)]);
  // Its line, read back: the stop is written.
  const line = await stoppedAt({ line: WORDS });
  assert.deepEqual(line.asked.slice(5), ['createOneOff', 'readOneOffLine']);
  assert.deepEqual(line.outcomes.slice(2), [{ row: 4, state: 'failed', steps: ['stop'], step: 'line', words: WORDS }, ...notTried(5, 7)]);
  // The stop's minutes: the stop and its line are written; its vendor and its record are not asked.
  const minutes = await stoppedAt({ minutes: WORDS });
  assert.deepEqual(minutes.asked.slice(5), ['createOneOff', 'readOneOffLine', 'setLineMinutes']);
  assert.deepEqual(minutes.outcomes.slice(2), [{ row: 4, state: 'failed', steps: ['stop', 'line'], step: 'minutes', words: WORDS }, ...notTried(5, 7)]);
  // `said` is told of each row tried, and once at the end with every outcome — the rows not tried among them.
  assert.deepEqual(minutes.told.map((progress) => progress.at === null ? null : progress.at.row), [2, 3, 4, null]);
  assert.deepEqual(minutes.told[3].outcomes, minutes.outcomes);
  // A record request that throws — the stops' writer throws when the request never reached the route — is that row's refusal, with the error's words.
  const thrown = await stoppedAt({ recordThrows: 'Failed to fetch' });
  assert.deepEqual(thrown.asked, ['setVendor', 'setRecord']);
  assert.deepEqual(thrown.outcomes, [{ row: 2, state: 'failed', steps: ['vendor'], step: 'record', words: 'Failed to fetch' }, ...notTried(3, 4, 5, 7)]);
  // A save that stopped reached the days of the rows it tried — the failed one among them — and no other.
  assert.deepEqual(daysReached(SAVE_WRITES, minutes.outcomes), [SUN]);
  assert.deepEqual(daysReached(SAVE_WRITES, vendor.outcomes), [SUN]);
  assert.throws(() => daysReached(SAVE_WRITES, minutes.outcomes.slice(1)), /pasteSave: 4 outcomes for 5 writes — one outcome a write/);
  // The run's line, stopped: the rows saved, the row, the step and the route's own words, the rows not tried.
  assert.equal(runWords(minutes.outcomes), `2 rows saved · stopped at row 4: the stop's minutes — ${WORDS} · 2 rows not tried`);
  assert.equal(runWords(vendor.outcomes), `0 rows saved · stopped at row 2: the vendor, on the stop — ${WORDS} · 4 rows not tried`);
  assert.equal(runStopped(minutes.outcomes), true);
});

// ── T11 · THE WORDS (ruling B.5) ─────────────────────────────────────────────

test('T11 the save’s words: the six steps — "+ expense"’s own and one more; a row’s outcome — every step written, the steps written and the one refused, or not tried; the lines while it runs and after; the compare that stops a save', () => {
  assert.deepEqual([...PASTE_STEPS], ['stop', 'line', 'minutes', 'directory', 'vendor', 'record']);
  assert.deepEqual(PASTE_STEP_WORDS, { stop: STEP_WORDS.stop, line: STEP_WORDS.line, minutes: "the stop's minutes", directory: STEP_WORDS.directory, vendor: STEP_WORDS.vendor, record: STEP_WORDS.record });
  assert.deepEqual(PASTE_STEPS.map((step) => PASTE_STEP_WORDS[step]), ['the one-off stop', "the stop's line, read back", "the stop's minutes", 'the vendor, added to the book', 'the vendor, on the stop', 'the record']);
  // A row's outcome.
  assert.equal(pasteOutcomeWords({ row: 2, state: 'written', steps: ['vendor', 'record'] }), 'written: the vendor, on the stop · the record');
  assert.equal(pasteOutcomeWords({ row: 4, state: 'written', steps: ['stop', 'line', 'minutes', 'directory', 'vendor', 'record'] }), "written: the one-off stop · the stop's line, read back · the stop's minutes · the vendor, added to the book · the vendor, on the stop · the record");
  assert.equal(pasteOutcomeWords({ row: 4, state: 'failed', steps: ['stop', 'line'], step: 'minutes', words: 'must be a non-negative integer' }), "written: the one-off stop · the stop's line, read back · not written: the stop's minutes — must be a non-negative integer");
  assert.equal(pasteOutcomeWords({ row: 2, state: 'failed', steps: [], step: 'vendor', words: 'No such plan' }), 'not written: the vendor, on the stop — No such plan', 'with no step written before it, only the refusal');
  assert.equal(pasteOutcomeWords({ row: 5, state: 'not tried' }), NOT_TRIED_WORDS);
  assert.equal(NOT_TRIED_WORDS, 'not tried — stopped at the failure before it');
  assert.throws(() => pasteOutcomeWords({ row: 9, state: 'written', steps: [] }), /pasteSave: row 9 is written with no step — a write has at least one/);
  // While it runs, and after.
  assert.equal(CHECKING_WORDS, 'reading the time sheet again before anything is written…');
  assert.equal(savingWords(3, 12, 47), 'saving 3 of 12 — row 47…');
  assert.equal(CHANGED_WORDS, 'the time sheet changed since these rows were read — nothing was written; the rows are placed again below: look, then save');
  assert.equal(SPENT_WORDS, 'read the rows again before another save — what is in is never written twice');
  assert.equal(runWords([{ row: 2, state: 'written', steps: ['record'] }, { row: 3, state: 'written', steps: ['vendor'] }]), '2 rows saved');
  // THE COMPARE: the table's rows placed again against the rows on screen at the press — row for row.
  const shown = pasteShown(SAVE_PASTE, SAVE_PLACED);
  assert.equal(shownChanged(shown, pasteShown(SAVE_PASTE, placePaste(SAVE_PASTE, SAVE_PICKS, CONTEXT))), false, 'the same read, placed again: the same rows');
  // A stop that gained a record since: its row reads another way → changed.
  const since: PasteContext = { ...CONTEXT, recording: { ...RECORDING, [LUNCH_SUN.key]: taking(LUNCH_SUN, recordOf('rec-lunch', 'line-lunch', SUN, '12:30', { actual_cents: 700, note: null })) } };
  assert.equal(shownChanged(shown, pasteShown(SAVE_PASTE, placePaste(SAVE_PASTE, SAVE_PICKS, since))), true);
  // The clock moved past a stop that was still ahead: its row no longer reads "planned: still ahead" → changed.
  const later: PasteContext = { ...CONTEXT, now: new Date(Date.parse(at(MON, '20:00'))) };
  const afterItsTime = pasteShown(SAVE_PASTE, placePaste(SAVE_PASTE, SAVE_PICKS, later));
  assert.deepEqual([shown[3].lands, afterItsTime[3].lands], ['a one-off at 20:00, under P-6200 Recreation · vendor: new to Personal · planned: still ahead', 'a one-off at 20:00, under P-6200 Recreation · vendor: new to Personal · not recorded: no Total (USD)']);
  assert.equal(shownChanged(shown, afterItsTime), true);
  assert.equal(shownChanged(shown.slice(0, 2), shown.slice(0, 3)), true, 'another count of rows');
  for (const over of [{ number: 99 }, { lands: 'elsewhere' }, { tone: 'refused' as const }, { yours: [...shown[0].yours.slice(0, 7), 'other'] }, { sheet: [...shown[0].sheet.slice(0, 7), 'other'] }]) {
    assert.equal(shownChanged(shown, [{ ...shown[0], ...over }, ...shown.slice(1)]), true, Object.keys(over)[0]);
  }
  // The save's rule is pure, quotes his words in its header, and reads neither writer's file.
  const save = code(SAVE);
  assert.doesNotMatch(save, /\bfetch\b|new Date\(|Date\.now\(|@prisma\/client|from 'react'|from 'next|localStorage|sessionStorage|document\./, 'no fetch, no clock, no Prisma, no browser');
  assert.doesNotMatch(save, /stopWrites|ledgerWrites|\/api\//, 'the writers are handed in; no route is named');
  assert.equal(countOf(save, /^import /gm), 3);
  assert.match(comments(SAVE), /^\/\*\*\n \* pasteSave — THE SAVE: THE PASTED ROWS GO ONTO THE TIME SHEET, THROUGH THE WRITERS THAT EXIST \(PASTE-02, Alex, 2026-11-27\)\./);
});

// ── T12 · THE WRITERS (ruling C) ─────────────────────────────────────────────

test('T12 the writers, over a stand-in fetch: one request in the file, handed its method; setLineMinutes sends PATCH to the line’s own route with { duration_minutes }; setVendor sends a routine’s address as it sends a line’s; the POSTs as they were', async () => {
  const sent: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let answer: () => Response = () => json({ step: { id: 'line-9', duration_minutes: 90 } });
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  const bowling = oneOff(SAVE_PLACED[2]).values;
  try {
    // The line's minutes: PATCH, the line's own route; the route's refusals are its words.
    assert.deepEqual(await setLineMinutes('line-9', 90), { ok: true, value: null });
    answer = () => json({ error: 'Validation', field: 'duration_minutes', message: 'must be a non-negative integer' }, 400);
    assert.deepEqual(await setLineMinutes('line-9', 90), { ok: false, words: 'must be a non-negative integer' });
    answer = () => json({ error: 'Not found' }, 404);
    assert.deepEqual(await setLineMinutes('line-0', 15), { ok: false, words: 'Not found' }, 'a line that is not the caller’s: the route’s 404, in its word');
    answer = () => new Response('', { status: 401 });
    assert.deepEqual(await setLineMinutes('line-9', 90), { ok: false, words: 'You are signed out — sign in to add an expense.' });
    answer = () => new Response('<html>', { status: 502, headers: { 'content-type': 'text/html' } });
    assert.deepEqual(await setLineMinutes('line-9', 90), { ok: false, words: 'the route answered 502 with no JSON' });
    // The vendor on a stop: a routine's own address, and a line's.
    answer = () => json({ outcome: 'set' }, 201);
    assert.deepEqual(await setVendor({ kind: 'routine', id: 'rt-gym', instant: at(SUN, '18:00'), vendorId: 'v-oat' }), { ok: true, value: { outcome: 'set' } });
    assert.deepEqual(await setVendor(vendorBody(bowling, 'line-9', 'v-oat')), { ok: true, value: { outcome: 'set' } });
    answer = () => json({ error: 'not-found', message: 'No such plan' }, 404);
    assert.deepEqual(await setVendor({ kind: 'routine', id: 'rt-gym', instant: at(SUN, '18:00'), vendorId: 'v-oat' }), { ok: false, words: 'No such plan' });
    // The POSTs as they were: the one-off, the vendor added; the line read back by GET.
    answer = () => json({ routine: { id: 'rt-1' }, lines: 1, isCreate: true }, 201);
    assert.deepEqual(await createOneOff(oneOffBody(bowling)), { ok: true, value: { routineId: 'rt-1' } });
    answer = () => json({ id: 'v-9', vendor_name: 'Pin Palace', entity_id: 'P' }, 201);
    assert.deepEqual(await addVendor('P', 'Pin Palace'), { ok: true, value: { vendorId: 'v-9' } });
    answer = () => json({ error: 'vendor-exists', message: 'this book already has "Pin Palace" (archived) — the same vendor, ignoring case and spacing' }, 409);
    assert.deepEqual(await addVendor('P', 'pin palace'), { ok: false, words: 'this book already has "Pin Palace" (archived) — the same vendor, ignoring case and spacing' });
    answer = () => json({ routine: { id: 'rt-1', steps: [{ id: 'st-1', activity: 'Bowling' }] } });
    assert.deepEqual(await readOneOffLine('rt-1'), { ok: true, value: { lineId: 'st-1' } });
    // A request that never reached the server is said in words — these five never throw.
    globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); throw new Error('offline'); }) as typeof fetch;
    assert.deepEqual(await setLineMinutes('line-9', 90), { ok: false, words: 'the request did not reach the server: offline' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => [s.url, s.init?.method ?? 'GET']), [
    ['/api/operations/routines/steps/line-9', 'PATCH'], ['/api/operations/routines/steps/line-9', 'PATCH'], ['/api/operations/routines/steps/line-0', 'PATCH'],
    ['/api/operations/routines/steps/line-9', 'PATCH'], ['/api/operations/routines/steps/line-9', 'PATCH'],
    ['/api/operations/plan-vendors', 'POST'], ['/api/operations/plan-vendors', 'POST'], ['/api/operations/plan-vendors', 'POST'],
    ['/api/operations/routines', 'POST'], ['/api/operations/vendor-directory', 'POST'], ['/api/operations/vendor-directory', 'POST'],
    ['/api/operations/routines/rt-1', 'GET'],
    ['/api/operations/routines/steps/line-9', 'PATCH'],
  ]);
  assert.equal(sent[0].init?.body, JSON.stringify({ duration_minutes: 90 }), 'the minutes, and nothing else of the line');
  assert.equal(sent[2].init?.body, JSON.stringify({ duration_minutes: 15 }));
  assert.equal(sent[5].init?.body, JSON.stringify({ kind: 'routine', id: 'rt-gym', instant: at(SUN, '18:00'), vendorId: 'v-oat' }));
  assert.equal(sent[6].init?.body, JSON.stringify({ kind: 'routine_line', id: 'line-9', instant: at(SUN, '20:00'), vendorId: 'v-oat' }));
  assert.equal(sent[8].init?.body, JSON.stringify(oneOffBody(bowling)));
  assert.equal(sent[9].init?.body, JSON.stringify({ entityId: 'P', name: 'Pin Palace' }));
  // The file: ONE request, in the one helper, which takes the method; the three POSTs and the one PATCH go through it.
  const w = code(WRITERS);
  assert.equal(countOf(w, /\bfetch\s*\(/g), 1, 'still one request in the file');
  assert.match(w, /async function send\(method: 'POST' \| 'PATCH', url: string, body: unknown\)/);
  assert.match(w, /res = await fetch\(url, \{ method, headers: \{ 'Content-Type': 'application\/json' \}, body: JSON\.stringify\(body\), redirect: 'manual' \}\);/);
  assert.deepEqual([countOf(w, /await send\('POST', /g), countOf(w, /await send\('PATCH', /g), countOf(w, /\bpost\(/g)], [3, 1, 0]);
  assert.match(w, /export async function setVendor\(body: \{ readonly kind: 'routine_line' \| 'routine'; readonly id: string; readonly instant: string; readonly vendorId: string \}\)/);
  assert.match(w, /export async function setLineMinutes\(lineId: string, minutes: number\): Promise<WriteAnswer<null>> \{\n\s*const answer = await send\('PATCH', `\/api\/operations\/routines\/steps\/\$\{lineId\}`, \{ duration_minutes: minutes \}\);/);
  assert.deepEqual([...w.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]), ['createOneOff', 'readOneOffLine', 'addVendor', 'setVendor', 'setLineMinutes']);
  assert.doesNotMatch(w, /\/api\/operations\/stops/, 'the record is the stops’ one writer’s');
});

// ── T13 · THE LEAF (ruling D) ────────────────────────────────────────────────

test('T13 the leaf: the six writers handed to the one runner and called nowhere else; pressing save reads again before any write and compares before the writes; no save button after a run; a read keeps the picks and "clear" forgets them; nothing stored; the hooks the look reads', () => {
  const leaf = code(LEAF);
  // Its default export takes the one thing; the picks live in it, above the box, and are handed down with their setter.
  const outer = between(leaf, 'export default function PasteRows(', '\ninterface ReadRows');
  assert.match(outer, /^export default function PasteRows\(\{ onWritten \}: \{ onWritten: \(days: readonly string\[\]\) => void \}\) \{/);
  assert.match(outer, /const \[picks, setPicks\] = useState<Picks>\(\{\}\);/);
  assert.match(outer, /\{open && <Box close=\{\(\) => setOpen\(false\)\} picks=\{picks\} setPicks=\{setPicks\} onWritten=\{onWritten\} \/>\}/);
  const boxAt = leaf.indexOf('function Box(');
  assert.match(leaf, /function Box\(\{ close, picks, setPicks, onWritten \}: \{ close: \(\) => void; picks: Picks; setPicks: Dispatch<SetStateAction<Picks>>; onWritten: \(days: readonly string\[\]\) => void \}\) \{/, 'the box is handed the picks with their setter');
  assert.equal(countOf(leaf.slice(boxAt), /useState<Picks>/g), 0, 'the box holds no picks of its own: closing it keeps them');
  assert.match(leaf.slice(boxAt), /const pick = \(kind: string, value: string\) => setPicks\(\(held\) => \{/, 'a pick is set through the outer setter');

  // THE SIX WRITERS: handed to the one runner in one object, and named nowhere else — the leaf calls no writer itself, and sends no request of its own.
  for (const writer of ['createOneOff', 'readOneOffLine', 'setLineMinutes', 'addVendor', 'setVendor', 'setStopRecord']) assert.equal(countOf(leaf, new RegExp(`\\b${writer}\\b`, 'g')), 2, `${writer}: its import, and the runner's hand`);
  assert.equal(countOf(leaf, /await runPaste\(placed\.writes, \{ createOneOff, readOneOffLine, setLineMinutes, addVendor, setVendor, setRecord: setStopRecord \}, /g), 1);
  assert.doesNotMatch(leaf, /\bfetch\s*\(|\bmethod\b|\bPOST\b|\bPATCH\b|\bDELETE\b/, 'no request and no method of its own');
  assert.doesNotMatch(leaf, /localStorage|sessionStorage|document\.cookie|indexedDB|\bcookie\b/i, 'nothing stored in the browser');

  // ONE READ FUNCTION, called by "read the rows" and by the save — and by nothing else.
  assert.equal(countOf(leaf, /await readAgainst\(/g), 2);
  const read = between(leaf, 'const read = async () => {', '\n  const clear = ');
  const clear = between(leaf, 'const clear = () => {', '\n  const pick = (kind: string, value: string)');
  const save = between(leaf, 'const save = async () => {', '\n  return (\n    <div className="space-y-2 text-xs border');
  assert.match(read, /const against = await readAgainst\(paste\.value, booksNow\(\), zone\);/);
  // A read keeps the picks — it forgets the rows, the run and the changed line; "clear" forgets the picks too.
  assert.doesNotMatch(read, /setPicks/);
  inOrder(read, ['setRefusal(null);', 'setRows(null);', 'setRun(null);', 'setChanged(false);', 'const paste = readPaste(text);'], 'a new read');
  inOrder(clear, ["setText('');", 'setRefusal(null);', 'setRows(null);', 'setRun(null);', 'setChanged(false);', 'setPicks({});'], '"clear"');
  assert.doesNotMatch(save, /setPicks/, 'the save places the rows with the same picks');

  // PRESSING SAVE, in order.
  inOrder(save, [
    'if (busy || zone === null || rows === null || shown === null || spent || shown.writes.length === 0) return;',
    'setBusy(true);', // (1) busy from the press on
    "setSaving('checking');",
    'const against = await readAgainst(rows.paste, booksNow(), zone);', // (2) the one read function, again
    'if (!against.ok) { setRefusal(against.words); return; }', //     a read that fails: said, and nothing written
    'const again: ReadRows = { paste: rows.paste, context: against.value };',
    'const placed = placedOf(again, picks);', // (3) placed again with the same picks…
    'setRows(again);', //     …and shown
    'if (shownChanged(shown.table, placed.table)) { setChanged(true); return; }', // (4) not what was on screen: nothing written
    'const outcomes = await runPaste(placed.writes, ', // (5) the writes of the NEW placements
    'setRun({ outcomes, done: true });',
    'onWritten(daysReached(placed.writes, outcomes));', // (6) every day a write reached, once
    '} finally {', 'setSaving(null);', 'setBusy(false);',
  ], 'pressing save');
  // (1) Busy before the first await; (2) the second read before any write; (4) the compare before the writes.
  assert.ok(save.indexOf('setBusy(true);') < save.indexOf('await '), 'busy is set before the first await');
  assert.ok(save.indexOf('await readAgainst(') < save.indexOf('shownChanged(') && save.indexOf('shownChanged(') < save.indexOf('await runPaste('), 'read again, then compare, then write');
  assert.deepEqual([countOf(save, /await runPaste\(/g), countOf(save, /\bonWritten\(/g), countOf(save, /pasteWritesOf|placePaste\(/g)], [1, 1, 0], 'one run, the days handed up once, and the rows placed by the one helper');
  // The runner's progress is shown as it comes: each row's outcome so far, and the row being written.
  assert.match(save, /\(progress\) => \{\n\s*setRun\(\{ outcomes: progress\.outcomes, done: false \}\);\n\s*setSaving\(progress\.at\);\n\s*\}\);/);

  // AFTER A RUN THERE IS NO SAVE BUTTON until the rows are read again.
  assert.match(leaf, /const spent = run !== null && run\.done;/);
  assert.match(leaf, /\{!spent && shown\.writes\.length > 0 && <button type="button" className=\{chip\} disabled=\{busy\} aria-busy=\{saving !== null\} onClick=\{save\} data-ledger-paste-save>\{saveWords\(shown\.writes\)\}<\/button>\}/);
  assert.equal(countOf(leaf, /data-ledger-paste-save>/g), 1);

  // THE HOOKS THE LOOK READS. The zone, beside the title (D.4).
  assert.match(leaf, /<span className="font-semibold text-text-secondary">\{PASTE_TITLE_WORDS\}<\/span>\n\s*\{zone !== null && <span className="text-text-muted" data-ledger-paste-zone>\{zoneWords\(zone\)\}<\/span>\}/);
  // The save box (D.6): between the picks and the table, its lines in the ruled order, each in its colour.
  inOrder(leaf, ['data-ledger-paste-picks>', '<div className="space-y-1" data-ledger-paste-save-box>', 'data-ledger-paste-table>'], 'the save box, between the picks and the table');
  const saveBox = between(leaf, '<div className="space-y-1" data-ledger-paste-save-box>', '<div className="overflow-x-auto');
  inOrder(saveBox, [
    '{!spent && shown.newVendors.map((line) => <p key={line} className="text-text-muted" data-ledger-paste-new-vendors>{line}</p>)}',
    '{!spent && shown.newVendors.length > 0 && <p className="text-brand-amber" data-ledger-paste-vendors-stay>{VENDORS_STAY_WORDS}</p>}',
    'data-ledger-paste-save>{saveWords(shown.writes)}</button>}',
    '{!spent && shown.writes.length === 0 && <p className="text-text-muted" data-ledger-paste-nothing>{NOTHING_TO_SAVE_WORDS}</p>}',
    "{saving === 'checking' && <p className=\"text-text-muted\" data-ledger-paste-checking>{CHECKING_WORDS}</p>}",
    "{saving !== null && saving !== 'checking' && <p className=\"text-text-muted\" data-ledger-paste-saving>{savingWords(saving.i, saving.of, saving.row)}</p>}",
    '{changed && <p className="text-brand-red" data-ledger-paste-changed>{CHANGED_WORDS}</p>}',
    "{run !== null && run.done && <p className={runStopped(run.outcomes) ? 'text-brand-red' : 'text-brand-green'} data-ledger-paste-saved-line>{runWords(run.outcomes)}</p>}",
    '{spent && <p className="text-text-muted" data-ledger-paste-spent>{SPENT_WORDS}</p>}',
  ], 'the save box');
  assert.deepEqual([...saveBox.matchAll(/data-ledger-paste-([a-z-]+)/g)].map((m) => m[1]), ['save-box', 'new-vendors', 'vendors-stay', 'save', 'nothing', 'checking', 'saving', 'changed', 'saved-line', 'spent']);
  // A row's outcome (D.8): under its LANDS words, on its own line, in its state's colour — green · red · muted.
  assert.match(leaf, /<td className=\{`\$\{cell\} border-l border-border`\} data-ledger-paste-lands>\n\s*<span>\{row\.lands\}<\/span>\n\s*\{outcome !== undefined && <div className=\{SAVED_CLASS\[outcome\.state\]\} data-ledger-paste-saved=\{outcome\.state\}>\{pasteOutcomeWords\(outcome\)\}<\/div>\}\n\s*<\/td>/);
  assert.match(leaf, /const SAVED_CLASS: Readonly<Record<PasteOutcome\['state'\], string>> = \{\n\s*written: 'text-brand-green',\n\s*failed: 'text-brand-red',\n\s*'not tried': 'text-text-muted',\n\s*\};/);
  assert.match(leaf, /const outcome = run === null \? undefined : run\.outcomes\.find\(\(o\) => o\.row === row\.number\);/);
  // While it reads or saves, the textarea, the three buttons, the picks and the save button are off.
  assert.match(leaf, /<textarea value=\{text\} .* disabled=\{busy\} .*data-ledger-paste-text \/>/);
  for (const hook of ['read', 'clear', 'close']) assert.match(leaf, new RegExp(`<button type="button" className=\\{chip\\} disabled=\\{busy[^>]*data-ledger-paste-${hook}>`), hook);
  assert.match(leaf, /<select value=\{pickValueOf\(shown\.standing\[kind\.key\]\)\} disabled=\{busy \|\| offers === null\} /, 'each select shows its standing pick, and is off while busy');
  // The header: its first line kept, and the dated paragraph.
  assert.match(comments(LEAF), /^\/\*\*\n \* PasteRows — "\+ paste rows from a sheet" on the time sheet \(PASTE-01, Alex, 2026-11-25\)\./);
  assert.match(comments(LEAF), /\n \* PASTE-02 \(Alex, 2026-11-27\) — THE SAVE\./);
});

// ── T14 · THE MOUNT (ruling E) ───────────────────────────────────────────────

test('T14 the section hands the leaf what it does when a day is written — one line edited in place, 488 lines still; the expense form’s mount before it character for character; /time mounts what it did', () => {
  const s = code(SECTION);
  assert.equal(linesOf(SECTION).length, 488, 'no line added, none removed — the registry cites three of its lines');
  assert.ok(s.includes('\n      <ExpenseForm onWritten={(day) => { setWrites((n) => n + 1); announceDayWritten(day); }} /><PasteRows onWritten={(days) => { setWrites((n) => n + 1); days.forEach(announceDayWritten); }} />\n'), 'the line as ruled');
  assert.deepEqual([countOf(s, /<PasteRows\b/g), countOf(s, /<ExpenseForm\b/g), countOf(s, /days\.forEach\(announceDayWritten\)/g)], [1, 1, 1]);
  // The time sheet reads again once a save, however many days it reached; each day's card is told.
  assert.match(s, /<PasteRows onWritten=\{\(days\) => \{ setWrites\(\(n\) => n \+ 1\); days\.forEach\(announceDayWritten\); \}\} \/>/);
  // The section's file does not name this change, and names no writer and no route.
  assert.doesNotMatch(comments(SECTION), /PASTE-02/);
  assert.doesNotMatch(s, /pasteSave|runPaste|ledgerWrites|\/api\//);
  // /time mounts what it did — the two-lists law reads this page alone for its three.
  assert.match(code(TIME_PAGE), /data-tool-page="Time">\n\s*<LedgerSection \/>\n\s*<MorningJournalTable \/>\n\s*<EveningJournalTable \/>\n\s*<\/div>\n\s*<\/OperationsEntityProvider>/);
  assert.doesNotMatch(code(TIME_PAGE), /PasteRows|pasteRows|pasteSave/);
});
