/**
 * SHEET-01 (Alex, 2026-11-28) — THE TIME SHEET IS ONE TABLE, LIKE HIS SHEET: every column on every view, the place on every row from
 * the Trip Name, "+ expense" a blank row with a box under every column, and nothing else on the page.
 *
 * PART 0 — what a charge says happened (src/lib/operations/pasteRows.ts): a placement that is a CHARGE says it takes no record, and its
 * WENT is the sheet's blank. PART 1 — the paste reads the Trip Name as trips, written first. PART 2 — the page is the table. PART 3 —
 * "+ expense" is the sheet's blank row. Each part's tests land in the commit that builds it.
 *
 * HERMETIC, on paste03.test.ts's model — no database, no network, and the only clock is the `now` handed in. The rules are DRIVEN
 * directly over made-up rows; the screens and the files that must not change are anchored to their source with comments stripped (the
 * reader law). PART 3 also DRAWS the blank row and the shared table to static markup (react-dom/server) — no effect runs there, so
 * nothing is read and nothing is written. Every place, trip, name, day, account and amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React }); // PART 3 draws the blank row and the shared table — their JSX reads React as a global under tsx (booksPipe.test.ts's way)
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import * as ledgerRule from '../operations/ledger';
import {
  CANCEL_EXPENSE_WORDS, EMPTY_EXPENSE, EMPTY_ROW_TRIP, END_AT_START_WORDS, END_NEEDS_START_WORDS, EXPENSE_FIELDS, EXPENSE_FIELD_WORDS, EXPENSE_STEPS, EXPENSE_WORDS, LEDGER_COLUMNS, LEDGER_TABLE, LEDGER_TABLE_CLASS,
  LOCATION_CLASSES, LOCATION_WORDS, MINUTES_RANGE_WORDS, NOTES_CONTROL_WORDS, NOTES_LONG_WORDS, NO_BOOK_WORDS, NO_COLUMN_FILTERS, NO_LOCATION_WORDS, PLACE_NEEDS_CITY_WORDS, PLANNED_WORD, REGION_NEEDS_COUNTRY_WORDS,
  ROW_LATER_MARK, ROW_LATER_WORDS, ROW_TRIP_FIELD_WORDS, SAVE_EXPENSE_WORDS, STEP_WORDS, TAG_NEEDS_VENDOR_WORDS, TAG_SAME_WORDS, TAG_STANDS_WORDS, TRIP_ENDS_WORDS, WENT_WORD,
  aheadFieldWords, applyColumnFilters, cellWordsOf, chargeFieldWords, coveringTripWords, dayTypedWords, expenseInput, headWordOf, ledgerTotals, minutesCellWords, minutesFromTo, noTripRowWords, outcomeWords,
  recordBody, rowPlannedMinutes, rowTripInput, timeTypedWords, tripEndsBeforeWords, withNotTried,
  type ColumnFilters, type ExpenseDraft, type ExpenseField, type LedgerColumn, type LedgerPlanRow, type LedgerRecording, type LedgerRow, type LedgerSheetRow, type RowTripDraft,
} from '../operations/ledger';
import { TOOL_REGISTRY } from '../toolRegistry';
import { MINUTES_MAX, NOTES_MAX, NOT_RECORDED_WORDS, minutesTypedWords } from '../operations/stopRecord';
import { NOT_A_STOP_RECORD_WORDS } from '../operations/stopRole';
import { overlapWords, placeParts, stayInput, type StayRow } from '../operations/stay';
import { INSTAGRAM_TAG_WORDS, readInstagramTag } from '../operations/planVendor';
import DataTable from '../../components/table/DataTable';
import ExpenseRow, { ExpenseOpen } from '../../components/workbench/operations/ledger/ExpenseForm';
import { OperationsEntityContext, type Entity } from '../../components/workbench/operations/EntitySelector';
import {
  CHARGE_HAPPENED_WORDS, CHARGE_TOTAL_WORDS, NO_TOTAL_WORDS, ON_TIME_SHEET_KEYS, PASTE_READ_HEADS, PASTE_TRIP_HEAD, PASTE_WORKED_OUT_HEADS, PLANNED_AHEAD_WORDS,
  headTwiceWords, isChargePlacement, kindKeyOf, notReadLines, pasteShown, placePaste, readPaste, recordedWentWords,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement, type PasteShownRow,
} from '../operations/pasteRows';
import { PASTE_STEPS, PASTE_STEP_WORDS, pasteWritesOf, runPaste, saveWords, tripOutcomeWords, type PasteProgress, type PasteWriters } from '../operations/pasteSave';
import {
  PASTE_TRIPS_WORDS, TRIP_NO_DATES_WORDS, pasteTripMeetsWords, readTripName, tripAddWords, tripAddsOf, tripBackwardsWords, tripDatesWords, tripDayWords, tripMonthWords, tripRefusedWords, tripWords, tripsOf,
} from '../operations/tripName';

const LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const SHEET_RULES = 'src/lib/operations/ledger.ts';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const TIME_PAGE = 'src/app/time/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const linesOf = (file: string): string[] => code(file).replace(/\n$/, '').split('\n');
const TRIP_RULE = 'src/lib/operations/tripName.ts';
const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;
const inOrder = (text: string, parts: readonly string[], what: string): void => {
  let from = 0;
  for (const part of parts) {
    const at = text.indexOf(part, from);
    assert.ok(at >= 0, `${what}: ${part} — not found after the part before it`);
    from = at + part.length;
  }
};

// ── THE ROWS — every name, day, account and amount made up ──────────────────

const NBO = 'Africa/Nairobi'; // three hours ahead of UTC the year round
const MON = '2027-08-09';
const WED = '2027-08-11';
/** Tuesday noon in the zone: Monday is past; Wednesday is ahead. */
const NOW = new Date('2027-08-10T09:00:00.000Z');
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();

const TAB = '\t';
type Typed = Partial<Record<PasteHead, string>>;
const pasteOf = (...rows: readonly Typed[]): Paste => {
  const read = readPaste([PASTE_READ_HEADS.join(TAB), ...rows.map((typed) => PASTE_READ_HEADS.map((head) => (head in typed ? typed[head] : '')).join(TAB))].join('\n'));
  if (!read.ok) return assert.fail(`refused: ${read.words}`);
  return read.value;
};
const CONTEXT: PasteContext = {
  books: [{ id: 'P', name: 'Home', entityType: 'personal' }], sheet: [], recording: {}, charts: { P: [{ id: 'acct-6200', code: '6200', name: 'Recreation' }] }, subAccounts: { P: [] },
  vendors: [], zone: NBO, now: NOW,
};
const ONE_OFF: PastePick = { kind: 'oneOff', code: '6200' };
const placedAll = (paste: Paste, context: PasteContext = CONTEXT): PastePlacement[] => {
  const picks: Record<string, PastePick> = {};
  for (const row of paste.rows) if (row.kind === 'read') picks[kindKeyOf(row.cells)] = ONE_OFF;
  return placePaste(paste, picks, context);
};
const landOne = (typed: Typed, context: PasteContext = CONTEXT): { readonly placement: PastePlacement; readonly shown: PasteShownRow } => {
  const paste = pasteOf(typed);
  const [placement] = placedAll(paste, context);
  return { placement, shown: pasteShown(paste, [placement])[0] };
};
const wentOf = (shown: PasteShownRow): string => shown.sheet[ON_TIME_SHEET_KEYS.indexOf('went')];
const partsOf = (shown: PasteShownRow): readonly string[] => shown.lands.split(' · ');

/** A charge with no Start Time; the same with a Total (USD); the same on a day ahead. */
const LANTERN: Typed = { 'Start Date': '8/9/27', Category: 'Recreation', Entity: 'Personal', Type: 'Lantern walk' };
const LANTERN_TOTAL: Typed = { ...LANTERN, 'Total (USD)': '9' };
const LANTERN_AHEAD: Typed = { ...LANTERN, 'Start Date': '8/11/27' };
/** A timed row of the same kind. */
const KAYAK: Typed = { 'Start Date': '8/9/27', 'Start Time': '3:00 PM', Category: 'Recreation', Entity: 'Personal', Type: 'Kayak' };

/** A charge on a date as the sheet lists it: an all-day plan row — no time, no WENT, no budget; it takes no record. */
const chargeRow = (day: string): LedgerPlanRow => {
  const instant = at(day, '00:00');
  return {
    id: null, key: `line:lantern-line:${instant}`, address: { kind: 'routine_line', id: 'lantern-line', instant }, match: null, day, time: null, place: null, book: 'Personal', location: null,
    segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Recreation' }, vendor: null, instagramTag: null, description: 'Lantern walk',
    rating: null, note: null, plannedItems: null, notes: null, cents: null, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null, allDay: true, went: null,
  };
};
const onSheet = (rows: readonly LedgerPlanRow[]): PasteContext => ({
  ...CONTEXT, sheet: rows, recording: Object.fromEntries(rows.map((r): [string, LedgerRecording] => [r.key, { takes: false, words: NOT_A_STOP_RECORD_WORDS }])),
});

// ── T1 · A NEW CHARGE (ruling 0.1) ───────────────────────────────────────────

test('T1 a new charge says it takes no record — with a Total (USD) and without, past and ahead — and its WENT is the sheet’s blank; what the placement holds as happened stands', () => {
  assert.equal(CHARGE_HAPPENED_WORDS, 'a charge on its date: no record');
  for (const [typed, happened] of [[LANTERN, 'not recorded'], [LANTERN_TOTAL, 'not recorded'], [LANTERN_AHEAD, 'planned']] as const) {
    const { placement, shown } = landOne(typed);
    assert.ok(placement.kind === 'oneOff' && placement.start === null, `placed: ${placement.kind}`);
    assert.equal(placement.happened.kind, happened, 'the placement’s happened is chargeHappened’s, as it was');
    assert.equal(isChargePlacement(placement), true);
    assert.equal(wentOf(shown), BLANK, 'the sheet’s blank, as the time sheet prints an all-day line');
    const parts = partsOf(shown);
    assert.equal(parts.filter((p) => p === CHARGE_HAPPENED_WORDS).length, 1, shown.lands);
    for (const not of [NO_TOTAL_WORDS, PLANNED_AHEAD_WORDS]) assert.equal(parts.includes(not), false, `${not} — ${shown.lands}`);
  }
  // With a Total (USD): the Total is still said as not written, beside the charge's own words — the two no longer disagree.
  const parts = partsOf(landOne(LANTERN_TOTAL).shown);
  assert.ok(parts.includes(CHARGE_TOTAL_WORDS) && parts.includes(CHARGE_HAPPENED_WORDS), parts.join(' · '));
});

// ── T2 · A CHARGE THAT STANDS (ruling 0.1) ───────────────────────────────────

test('T2 a row on the charge of its own name that stands says it takes no record, past and ahead, with a Total (USD) or none; its WENT is the stop’s own cell, the sheet’s blank', () => {
  for (const [day, typed, happened] of [[MON, LANTERN, 'not recorded'], [MON, LANTERN_TOTAL, 'not recorded'], [WED, LANTERN_AHEAD, 'planned']] as const) {
    const stop = chargeRow(day);
    const { placement, shown } = landOne(typed, onSheet([stop]));
    assert.ok(placement.kind === 'plan' && placement.standing && placement.record === null, `placed: ${placement.kind}`);
    assert.equal(placement.happened.kind, happened);
    assert.equal(isChargePlacement(placement), true);
    assert.equal(wentOf(shown), cellWordsOf(stop, 'went'));
    assert.equal(wentOf(shown), BLANK);
    const parts = partsOf(shown);
    assert.equal(parts.filter((p) => p === CHARGE_HAPPENED_WORDS).length, 1, shown.lands);
    for (const not of [NO_TOTAL_WORDS, PLANNED_AHEAD_WORDS]) assert.equal(parts.includes(not), false, `${not} — ${shown.lands}`);
  }
});

// ── T3 · A TIMED ROW IS AS IT WAS (ruling 0.1) ───────────────────────────────

test('T3 a timed row’s words and WENT are as they were — not recorded with no Total (USD), recorded went with one, planned ahead; none is a charge, nor is a row placed nowhere', () => {
  const past = landOne(KAYAK);
  assert.equal(isChargePlacement(past.placement), false);
  assert.ok(partsOf(past.shown).includes(NO_TOTAL_WORDS), past.shown.lands);
  assert.equal(wentOf(past.shown), NOT_RECORDED_WORDS);
  const went = landOne({ ...KAYAK, 'Total (USD)': '14' });
  assert.ok(partsOf(went.shown).includes(recordedWentWords(1400)), went.shown.lands);
  assert.equal(wentOf(went.shown), WENT_WORD);
  const ahead = landOne({ ...KAYAK, 'Start Date': '8/11/27' });
  assert.ok(partsOf(ahead.shown).includes(PLANNED_AHEAD_WORDS), ahead.shown.lands);
  assert.equal(wentOf(ahead.shown), PLANNED_WORD);
  for (const shown of [past.shown, went.shown, ahead.shown]) assert.equal(partsOf(shown).includes(CHARGE_HAPPENED_WORDS), false);
  // Placed nowhere: a date with nothing on it, and a row with no Start Date — neither is a charge.
  const [blank, refused] = placedAll(pasteOf({ 'Start Date': '8/9/27' }, { ...LANTERN, 'Start Date': '' }));
  assert.deepEqual([blank.kind, isChargePlacement(blank)], ['blank', false]);
  assert.deepEqual([refused.kind, isChargePlacement(refused)], ['refused', false]);
});

// ── T4 · ONE TRIP NAME, READ (ruling 1.1) ────────────────────────────────────

const read = (text: string) => readTripName(text);
const days = (text: string): readonly [string, string, string] => {
  const r = read(text);
  return r.ok ? [r.place, r.startsOn, r.endsOn] : assert.fail(`refused: ${r.why}`);
};

test('T4 a Trip Name is read in its three shapes, the dash with or without spaces, the month in any case — the place before the LAST " (" by the stay’s own place rule, a first day with no year taking the last day’s, or the year before', () => {
  assert.deepEqual(days('Pine Cove, Lake District, Norland (April 2 - 6, 2028)'), ['Pine Cove, Lake District, Norland', '2028-04-02', '2028-04-06']);
  assert.deepEqual(days('  Pine   Cove  (april 2-6, 2028) '), ['Pine Cove', '2028-04-02', '2028-04-06'], 'trimmed, runs of spaces one, the dash bare, the month in small letters');
  assert.deepEqual(days('Pine Cove (APRIL 2 -6, 2028)'), ['Pine Cove', '2028-04-02', '2028-04-06']);
  assert.deepEqual(days('Pine Cove (April 28 - May 3, 2028)'), ['Pine Cove', '2028-04-28', '2028-05-03'], 'Month D - Month D, YYYY');
  assert.deepEqual(days('Pine Cove (December 28, 2027 - January 3, 2028)'), ['Pine Cove', '2027-12-28', '2028-01-03'], 'Month D, YYYY - Month D, YYYY');
  // The year rule: a first day with no year takes the last day's — or the year before, when its month comes after the last day's.
  assert.deepEqual(days('Pine Cove (December 28 - January 3, 2028)'), ['Pine Cove', '2027-12-28', '2028-01-03']);
  assert.deepEqual(days('Pine Cove (March 30 - April 2, 2028)'), ['Pine Cove', '2028-03-30', '2028-04-02']);
  assert.deepEqual(days('Pine Cove (May 9 - May 9, 2028)'), ['Pine Cove', '2028-05-09', '2028-05-09'], 'a one-day trip');
  // The place is what stands before the LAST " (" — a parenthesis inside it is its own.
  assert.deepEqual(days('Old Mill (East), Lake District, Norland (April 2 - 6, 2028)'), ['Old Mill (East), Lake District, Norland', '2028-04-02', '2028-04-06']);
});

// ── T5 · A TRIP NAME REFUSED, BY NAME (ruling 1.1) ───────────────────────────

test('T5 a Trip Name that is not one is refused by name — no dates in parentheses, a fourth shape, a word that is not a month, a day that is not one, a last day before the first, the stay’s own place rule — and nothing is guessed: "???" is no day', () => {
  const why = (text: string): string => { const r = read(text); return r.ok ? assert.fail(`read: ${text}`) : r.why; };
  assert.equal(TRIP_NO_DATES_WORDS, 'no dates in parentheses after the place');
  assert.equal(why('Pine Cove'), TRIP_NO_DATES_WORDS);
  assert.equal(why('Pine Cove (April 2 - 6, 2028) and more'), TRIP_NO_DATES_WORDS, 'the closing parenthesis ends the text');
  assert.equal(why('(April 2 - 6, 2028)'), TRIP_NO_DATES_WORDS, 'no place before the parenthesis');
  for (const dates of ['April 2, 2028', 'April 2 - ???', '??? - 6, 2028', 'April 2, 2028 - 6, 2028', '2 April - 6, 2028', 'April 2 - 6 2028', 'April 2 - 6, 28', 'April 2 - May 3 - 6, 2028']) {
    assert.equal(why(`Pine Cove (${dates})`), tripDatesWords(dates), dates);
  }
  assert.equal(tripDatesWords('April 2 - ???'), '"April 2 - ???" is not "Month D - Month D, YYYY"');
  assert.equal(why('Pine Cove (Aprl 2 - 6, 2028)'), tripMonthWords('Aprl'));
  assert.equal(why('Pine Cove (April 28 - Mai 3, 2028)'), tripMonthWords('Mai'));
  assert.equal(tripMonthWords('Mai'), '"Mai" is not a month');
  assert.equal(why('Pine Cove (February 30 - March 2, 2028)'), tripDayWords('2028-02-30'));
  assert.equal(why('Pine Cove (April 2 - 31, 2028)'), tripDayWords('2028-04-31'));
  assert.equal(tripDayWords('2028-04-31'), '2028-04-31 is not a day');
  assert.equal(why('Pine Cove (April 6 - 2, 2028)'), tripBackwardsWords('2028-04-06', '2028-04-02'));
  assert.equal(why('Pine Cove (December 28, 2028 - January 3, 2028)'), tripBackwardsWords('2028-12-28', '2028-01-03'));
  assert.equal(tripBackwardsWords('2028-04-06', '2028-04-02'), 'its last day 2028-04-02 is before its first 2028-04-06');
  // The place, by stay.ts stayInput's own rule — its message, after "the place — ".
  assert.equal(why(`${'x'.repeat(81)} (April 2 - 6, 2028)`), 'the place — at most 80 characters (81 given)');
  assert.equal(why('Pine\u0001Cove (April 2 - 6, 2028)'), 'the place — control characters are not a place');
});

// ── T6 · THE PASTE'S TRIPS AND THE SHARED DAY (ruling 1.1) ───────────────────

test('T6 tripsOf: the distinct names in order, read or refused; THE SHARED DAY — a trip longer than one day ends the day before another trip begins on its last day, a read one or a refused name whose first day reads; a one-day trip keeps its day', () => {
  const { trips, refused } = tripsOf([
    'Pine Cove (April 2 - 9, 2028)', 'Ridge Camp (April 9 - 12, 2028)', 'Pine Cove (April 2 - 9, 2028)', 'Shell Bay (April 12, 2028 - ???)',
    'Fern Hollow (April 20 - 20, 2028)', 'Moss Glen (April 20 - 23, 2028)', 'Dune Field (April 23 - ???)',
  ]);
  assert.deepEqual(trips.map((t) => [t.name, t.place, t.startsOn, t.endsOn]), [
    ['Pine Cove (April 2 - 9, 2028)', 'Pine Cove', '2028-04-02', '2028-04-08'], // Ridge Camp begins on its last day
    ['Ridge Camp (April 9 - 12, 2028)', 'Ridge Camp', '2028-04-09', '2028-04-11'], // a refused name whose first day reads begins on its last day
    ['Fern Hollow (April 20 - 20, 2028)', 'Fern Hollow', '2028-04-20', '2028-04-20'], // one day: it keeps it
    ['Moss Glen (April 20 - 23, 2028)', 'Moss Glen', '2028-04-20', '2028-04-23'], // a refused name whose first day does not read (no year) moves nothing
  ]);
  assert.deepEqual(refused, [
    { name: 'Shell Bay (April 12, 2028 - ???)', why: tripDatesWords('April 12, 2028 - ???') },
    { name: 'Dune Field (April 23 - ???)', why: tripDatesWords('April 23 - ???') },
  ]);
  assert.deepEqual(tripsOf([]), { trips: [], refused: [] });
});

// ── T7 · EACH TRIP AGAINST THE STAYS THAT STAND (ruling 1.1) ─────────────────

test('T7 tripAddsOf: a trip stands (a stay of that place, that first day and that last day), meets a stay (said in the stay’s own words) or a trip of this paste added before it, else it is added — and the words of each', () => {
  const stays: StayRow[] = [
    { id: 'st-1', place: 'Pine Cove', starts_on: '2028-04-02', ends_on: '2028-04-08' },
    { id: 'st-2', place: 'Old Quay', starts_on: '2028-05-01', ends_on: '2028-05-10' },
  ];
  const { trips } = tripsOf(['Pine Cove (April 2 - 9, 2028)', 'Ridge Camp (April 9 - 12, 2028)', 'Gull Point (May 8 - 14, 2028)', 'Fern Hollow (April 20 - 20, 2028)', 'Moss Glen (April 20 - 23, 2028)']);
  const adds = tripAddsOf(trips, stays);
  assert.deepEqual(adds.map((a) => [a.trip.place, a.kind]), [['Pine Cove', 'stands'], ['Ridge Camp', 'add'], ['Gull Point', 'meets'], ['Fern Hollow', 'add'], ['Moss Glen', 'meets']]);
  const gull = adds[2];
  assert.ok(gull.kind === 'meets');
  assert.equal(gull.words, overlapWords({ startsOn: '2028-05-08', endsOn: '2028-05-14' }, stays[1]));
  const moss = adds[4];
  assert.ok(moss.kind === 'meets');
  assert.equal(moss.words, pasteTripMeetsWords(trips[4], trips[3]));
  assert.equal(moss.words, '2028-04-20 to 2028-04-23 meets the trip "Fern Hollow" of this paste (2028-04-20 to 2028-04-20)');
  // A stay of the same days and another place is no standing trip: it meets.
  assert.equal(tripAddsOf(tripsOf(['Pine Grove (April 2 - 8, 2028)']).trips, stays)[0].kind, 'meets');
  // The words.
  assert.equal(PASTE_TRIPS_WORDS, 'adds these trips — the place of every row on their days:');
  assert.equal(tripWords(trips[1]), 'Ridge Camp · 2028-04-09 → 2028-04-12');
  assert.deepEqual(adds.map(tripAddWords), [
    'Pine Cove · 2028-04-02 → 2028-04-08 — already a trip',
    'Ridge Camp · 2028-04-09 → 2028-04-12',
    'Gull Point · 2028-05-08 → 2028-05-14 — not written: 2028-05-08 to 2028-05-14 meets the stay "Old Quay" (2028-05-01 to 2028-05-10)',
    'Fern Hollow · 2028-04-20 → 2028-04-20',
    'Moss Glen · 2028-04-20 → 2028-04-23 — not written: 2028-04-20 to 2028-04-23 meets the trip "Fern Hollow" of this paste (2028-04-20 to 2028-04-20)',
  ]);
  assert.equal(tripRefusedWords({ name: 'Dune Field (April 23 - ???)', why: tripDatesWords('April 23 - ???') }), 'Trip Name "Dune Field (April 23 - ???)" — not read as a trip: "April 23 - ???" is not "Month D - Month D, YYYY"');
});

// ── T8 · THE PASTE READS THE TRIP NAME (ruling 1.2) ──────────────────────────

const HEADS_WITH_TRIP = [...PASTE_READ_HEADS, PASTE_TRIP_HEAD] as const;
const pasteText = (heads: readonly string[], rows: readonly Readonly<Record<string, string>>[]): string =>
  [heads.join(TAB), ...rows.map((typed) => heads.map((head) => typed[head] ?? '').join(TAB))].join('\n');

test('T8 the paste reads the Trip Name column as its trips — the distinct cells, cleaned, in the paste’s order, from rows that are not blank; none when the header has none; a known head, never "not one of the sheet’s columns"; twice is refused', () => {
  assert.equal(PASTE_TRIP_HEAD, 'Trip Name');
  assert.equal((PASTE_WORKED_OUT_HEADS as readonly string[]).includes(PASTE_TRIP_HEAD), false, 'no longer worked out by the app');
  const typed = { ...LANTERN } as Record<string, string>;
  const text = pasteText(HEADS_WITH_TRIP, [
    { ...typed, 'Trip Name': 'Pine Cove (April 2 - 9, 2028)' },
    {},
    { ...typed, 'Trip Name': '  Ridge   Camp (April 9 - 12, 2028) ' },
    { ...typed, 'Trip Name': 'Pine Cove (April 2 - 9, 2028)' },
    { ...typed },
    { 'Trip Name': 'Shell Bay (April 12, 2028 - ???)' },
  ]);
  const pasted = readPaste(text);
  assert.ok(pasted.ok, pasted.ok ? '' : pasted.words);
  assert.deepEqual(pasted.value.trips, ['Pine Cove (April 2 - 9, 2028)', 'Ridge Camp (April 9 - 12, 2028)', 'Shell Bay (April 12, 2028 - ???)']);
  assert.deepEqual([pasted.value.unknown, pasted.value.workedOut], [[], []]);
  assert.equal(notReadLines(pasted.value).some((line) => line.includes(PASTE_TRIP_HEAD)), false, 'the Trip Name is read — no line names it as not read');
  assert.equal(pasted.value.rows.length, 5, 'the blank row is skipped; a row with only its Trip Name is a row');
  // The head word by the paste's own rule: case and spacing aside.
  const lower = readPaste(pasteText([...PASTE_READ_HEADS, '  trip   NAME '], [{ ...typed, '  trip   NAME ': 'Pine Cove (April 2 - 9, 2028)' }]));
  assert.ok(lower.ok && lower.value.trips.length === 1 && lower.value.trips[0] === 'Pine Cove (April 2 - 9, 2028)');
  // No Trip Name column: no trips.
  assert.deepEqual(pasteOf(LANTERN).trips, []);
  // Twice: refused, as a read head twice is.
  const twice = readPaste(pasteText([...HEADS_WITH_TRIP, PASTE_TRIP_HEAD], [{ ...typed }]));
  assert.deepEqual(twice, { ok: false, words: headTwiceWords(PASTE_TRIP_HEAD) });
  assert.equal(headTwiceWords(PASTE_TRIP_HEAD), 'the header row has "Trip Name" twice');
});

// ── T9 · THE SAVE WRITES THE TRIPS FIRST (ruling 1.3) ────────────────────────

test('T9 the runner writes the trips FIRST — before the chart’s additions and any row, one call each; a trip refused, or one whose request never reached the route, is its outcome and stops nothing; the button counts the trips first', async () => {
  assert.deepEqual([...PASTE_STEPS], ['stay', 'sub-account', 'stop', 'line', 'minutes', 'directory', 'vendor', 'items', 'tag', 'record']);
  assert.equal(PASTE_STEP_WORDS.stay, 'the trip');
  const paste = pasteOf({ ...KAYAK, 'Total (USD)': '14' });
  const writes = pasteWritesOf(paste.rows, placedAll(paste));
  assert.equal(writes.length, 1);
  const calls: string[] = [];
  const writers: PasteWriters = {
    addStay: async (place, startsOn, endsOn) => {
      calls.push(`addStay ${place} ${startsOn} ${endsOn}`);
      if (place === 'Pine Cove') return { ok: false, words: 'meets another stay' };
      if (place === 'Ridge Camp') throw new Error('the request never reached the route');
      return { ok: true, value: null };
    },
    addSubAccount: async () => { calls.push('addSubAccount'); return { ok: true, value: null }; },
    createOneOff: async () => { calls.push('createOneOff'); return { ok: true, value: { routineId: 'rt-1' } }; },
    readOneOffLine: async () => { calls.push('readOneOffLine'); return { ok: true, value: { lineId: 'line-1' } }; },
    setLineMinutes: async () => { calls.push('setLineMinutes'); return { ok: true, value: null }; },
    addVendor: async () => assert.fail('no vendor named'), setVendor: async () => assert.fail('no vendor named'), setVendorTag: async () => assert.fail('no tag named'),
    setRecord: async () => { calls.push('setRecord'); return { ok: true }; },
  };
  const trips = [
    { place: 'Pine Cove', startsOn: '2028-04-02', endsOn: '2028-04-08' },
    { place: 'Ridge Camp', startsOn: '2028-04-09', endsOn: '2028-04-11' },
    { place: 'Fern Hollow', startsOn: '2028-04-20', endsOn: '2028-04-20' },
  ];
  const adds = [{ accountId: 'acct-6200', rendered: 'P-6200', code: '6201', name: 'Kayak' }];
  const told: PasteProgress[] = [];
  const outcomes = await runPaste(writes, writers, (progress) => told.push(progress), adds, trips);
  assert.deepEqual(calls, ['addStay Pine Cove 2028-04-02 2028-04-08', 'addStay Ridge Camp 2028-04-09 2028-04-11', 'addStay Fern Hollow 2028-04-20 2028-04-20', 'addSubAccount', 'createOneOff', 'readOneOffLine', 'setRecord']);
  const tripOutcomes = [{ state: 'failed', words: 'meets another stay' }, { state: 'failed', words: 'the request never reached the route' }, { state: 'written' }];
  assert.deepEqual(told[0], { trips: tripOutcomes, adds: [{ state: 'written' }], outcomes: [], at: { i: 1, of: 1, row: 2 } }, 'before the first row: every trip and every addition has come out');
  assert.deepEqual(told[told.length - 1].trips, tripOutcomes);
  assert.deepEqual(outcomes.map((o) => o.state), ['written'], 'a refused trip stops nothing');
  // A save of trips alone: they are written, and no row is asked.
  calls.length = 0;
  assert.deepEqual(await runPaste([], writers, () => undefined, [], trips.slice(2)), []);
  assert.deepEqual(calls, ['addStay Fern Hollow 2028-04-20 2028-04-20']);
  // The words: a trip's outcome on its line, and the button.
  assert.equal(tripOutcomeWords({ state: 'written' }), 'written: the trip');
  assert.equal(tripOutcomeWords({ state: 'failed', words: 'meets another stay' }), 'not written: the trip — meets another stay');
  assert.ok(saveWords(writes, adds, trips).startsWith('save 1 row — 3 trips added · 1 sub-account added to the chart · '), saveWords(writes, adds, trips));
  assert.ok(saveWords([], [], trips.slice(2)).startsWith('save 0 rows — 1 trip added · 0 sub-accounts added to the chart · '), saveWords([], [], trips.slice(2)));
});

// ── T10 · THE LEAF (ruling 1.4) ──────────────────────────────────────────────

test('T10 the leaf reads the stays by the day card’s own reader in its one read function, works the trips by tripName.ts, lists them above the sub-accounts, saves when there are writes OR trips, and hands the runner a tenth writer over the stays’ one writer — sending no request of its own', () => {
  const leaf = code(LEAF);
  assert.match(leaf, /import \{ readStays \} from '\.\.\/day\/dayReads';/);
  assert.match(leaf, /import \{ createStay \} from '\.\.\/stays\/stayWrites';/);
  assert.match(leaf, /import \{ PASTE_TRIPS_WORDS, tripAddWords, tripAddsOf, tripRefusedWords, tripsOf \} from '@\/lib\/operations\/tripName';/);
  assert.doesNotMatch(leaf, /\bfetch\s*\(|\bmethod\b|\/api\/operations\/stays/, 'no request of its own; the stays route is named by its reader and its writer alone');
  // The one read function: the stays first — a read that fails is said, and nothing is placed; never an empty list.
  assert.match(leaf, /async function readAgainst\(paste: Paste, books: readonly PasteBook\[\], zone: string\): Promise<Read<Omit<ReadRows, 'paste'>>> \{\n\s*const now = new Date\(\);\n\s*const listedStays = await readStays\(instantToZoned\(now, zone\)\.date\);\n\s*if \(!listedStays\.ok\) return \{ ok: false, words: listedStays\.words \};\n\s*const stays = listedStays\.value\.stays;/);
  assert.equal(countOf(leaf, /readStays\(/g), 1, 'one read of the stays, in the one read function — "read the rows" and the save each call it');
  assert.equal(countOf(leaf, /await readAgainst\(/g), 2);
  // The trips, worked by the rule — read, refused, set against the stays; the added ones are the save's.
  assert.match(leaf, /const trips = tripsOf\(read\.paste\.trips\);\n\s*const tripAdds = tripAddsOf\(trips\.trips, read\.stays\);\n\s*const tripWrites: PasteTripWrite\[\] = tripAdds\.flatMap\(\(entry\) => \(entry\.kind === 'add' \? \[\{ place: entry\.trip\.place, startsOn: entry\.trip\.startsOn, endsOn: entry\.trip\.endsOn \}\] : \[\]\)\);/);
  // The tenth writer: createStay's answer, its message the words — handed to the runner with the trips; the leaf calls it nowhere else.
  assert.match(leaf, /const addStay = async \(place: string, startsOn: string, endsOn: string\): Promise<PasteAnswer<null>> => \{\n\s*const answer = await createStay\(\{ place, starts_on: startsOn, ends_on: endsOn \}\);\n\s*return answer\.ok \? \{ ok: true, value: null \} : \{ ok: false, words: answer\.message \};\n\s*\};/);
  assert.match(leaf, /await runPaste\(placed\.writes, \{ createOneOff, readOneOffLine, setLineMinutes, addVendor, setVendor, setVendorTag, addSubAccount, addStay, setRecord: setStopRecord \}, /);
  assert.match(leaf, /\}, placed\.saveAdds, placed\.tripWrites\);/);
  assert.equal(countOf(leaf, /\baddStay\b/g), 2, 'defined, and handed to the runner');
  assert.equal(countOf(leaf, /\bcreateStay\b/g), 2, 'imported, and called in addStay alone');
  // The save: when there are writes OR trips; nothing to save only when neither.
  assert.match(leaf, /spent \|\| \(shown\.writes\.length === 0 && shown\.tripWrites\.length === 0\)\) return;/);
  assert.match(leaf, /\{!spent && \(shown\.writes\.length > 0 \|\| shown\.tripWrites\.length > 0\) && <button[^\n]*\{saveWords\(shown\.writes, shown\.saveAdds, shown\.tripWrites\)\}<\/button>\}/);
  assert.match(leaf, /\{!spent && shown\.writes\.length === 0 && shown\.tripWrites\.length === 0 && <p className="text-text-muted" data-ledger-paste-nothing>\{NOTHING_TO_SAVE_WORDS\}<\/p>\}/);
  // The trips' block, above the sub-accounts': its words, a line a trip by its kind — meets amber, stands muted — each added one's outcome, the refused names under them.
  inOrder(leaf, ['data-ledger-paste-picks>', 'data-ledger-paste-trips>', '{PASTE_TRIPS_WORDS}', 'data-ledger-paste-trip={entry.kind}', '<span>{tripAddWords(entry)}</span>', '{tripOutcomeWords(outcome)}', 'data-ledger-paste-trip="refused">{tripRefusedWords(refused)}', 'data-ledger-paste-adds>', 'data-ledger-paste-save-box>'], 'the box, in order');
  assert.match(leaf, /className=\{entry\.kind === 'meets' \? 'text-brand-amber' : entry\.kind === 'stands' \? 'text-text-muted' : undefined\}/);
  assert.match(leaf, /<p key=\{refused\.name\} className="text-brand-amber" data-ledger-paste-trip="refused">/);
  // The rule is pure: no request, no clock, no database, no screen file.
  assert.doesNotMatch(code(TRIP_RULE), /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|from 'next|localStorage|sessionStorage|document\.|Writes'/);
});

// ── T11 · NO FOLD (ruling 2.1) ───────────────────────────────────────────────

test('T11 no fold export is left in ledger.ts — the TIMEDAY-01 block is deleted, a dated note where it stood — and the section passes its own class alone: every view draws the twenty-five columns', () => {
  for (const name of ['DAY_FOLD_COLUMNS', 'isOneDay', 'DAY_FOLD_CLASS', 'dayFoldClass', 'dayFoldCount', 'dayPlaceWords']) {
    assert.equal(name in ledgerRule, false, `${name} is no export`);
    assert.doesNotMatch(code(SHEET_RULES), new RegExp(`\\b${name}\\b`), `${name} is typed nowhere in the rule file's code`);
    assert.doesNotMatch(code(SECTION), new RegExp(`\\b${name}\\b`), `${name} is read nowhere in the section`);
  }
  assert.match(comments(SHEET_RULES), /SHEET-01 \(Alex, 2026-11-28\): THE DAY VIEW FOLDS NOTHING — the TIMEDAY-01 block stood here/);
  assert.doesNotMatch(comments(SHEET_RULES), /── TIMEDAY-01/, 'its heading went with it');
  const s = code(SECTION);
  assert.match(s, /<section className="space-y-1\.5 \[&_div:has\(>\[data-ledger-table\]\)\]:max-h-\[calc\(100vh-8rem\)\] \[&_div:has\(>\[data-ledger-table\]\)\]:overflow-y-auto" data-ledger>/, 'its own class — a plain literal, handed no period');
  assert.doesNotMatch(s, /:hidden|data-ledger-day-place/, 'no class takes a column off the screen; no place line above the table');
  assert.equal(LEDGER_COLUMNS.length, 25);
});

// ── T12 · NOTHING UNDER THE TABLE (ruling 2.2) ───────────────────────────────

/** The rule file's exports only the deleted notes and summary called — they stay in ledger.ts, with their tests; the page stops calling them. */
const UNCALLED = [
  'BY_WORDS', 'EVERY_BOOK_WORDS', 'GROUP_KEYS', 'GROUP_WORDS', 'SUMMARY_HEAD_WORDS', 'SUMMARY_TITLE_WORDS', 'TODAY_RULE_WORDS', 'averageStarsWords', 'daysWords', 'ledgerSummary', 'leftOutTotal', 'leftOutWords',
  'matchCoverageWords', 'noLineWords', 'noStayWords', 'notPlacedWords', 'notRecordedWords', 'notesCount', 'notesToggleWords', 'perDayWords', 'unplacedWords', 'varianceCoverageWords', 'hoursWords', 'loggedCoverageWords', 'plannedCoverageWords',
] as const;

test('T12 the section draws no notes and no summary — nothing stands under the table; the state and the imports only they used are gone; a dated comment stands where they stood; their words stay in ledger.ts, uncalled by the page', () => {
  const s = code(SECTION);
  for (const gone of ['data-ledger-notes', 'data-ledger-said', 'data-ledger-summary', 'data-ledger-group', 'data-ledger-by', 'notesOpen', 'setNotesOpen', 'setBy', 'useState<GroupKey>', 'const groups', 'headClass as head', 'reversedLinkedWords']) {
    assert.equal(s.includes(gone), false, `${gone} — gone with the notes and the summary`);
  }
  // Nothing after the shared table but the section's end and the dated comment.
  const after = code(SECTION).slice(code(SECTION).indexOf('</DataTable>') + '</DataTable>'.length);
  assert.match(after, /^\n\s*\{\s*\}\n\s*<\/section>\n\s*\);\n\}\n?$/, 'only the dated comment stands under the table');
  assert.match(comments(SECTION), /SHEET-01 \(Alex, 2026-11-28\): "just one, bad ass table … built like an excel table"\. THE NOTES stood here/);
  // The words stay, each still the rule file's export — and the page calls none.
  for (const name of UNCALLED) {
    assert.ok(name in ledgerRule, `${name} stays in ledger.ts`);
    assert.doesNotMatch(s, new RegExp(`\\b${name}\\b`), `${name} — the page calls it no more`);
  }
  assert.ok(code(SHEET_RULES).includes('export type GroupKey'), 'the summary’s key type stays too');
});

// ── T13 · THE TOTAL ROW SUMS THE MINUTES (ruling 2.2) ────────────────────────

/** A plan row — its planned minutes, no logged ones; and a recorded row — both. */
const planRow = (key: string, city: string, planned: number | null): LedgerPlanRow => ({
  ...chargeRow(MON), key, allDay: false, time: '09:00', place: { city, region: null, country: 'Norland' }, plannedMinutes: planned, went: NOT_RECORDED_WORDS,
});
const recordedRow = (id: string, city: string, planned: number | null, logged: number | null): LedgerRow => ({
  id, key: `routine:${id}:${MON}T06:00:00.000Z`, address: { kind: 'routine', id, instant: `${MON}T06:00:00.000Z` }, match: null, day: MON, time: '09:00',
  place: { city, region: null, country: 'Norland' }, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Recreation' },
  vendor: null, instagramTag: null, description: 'Kayak', rating: null, note: null, notes: null, cents: 650, budgetState: 'matched', outcome: 'done', actualCents: 690, varianceCents: 40, plannedMinutes: planned, loggedMinutes: logged,
});

test('T13 the TOTAL row: its label spans LEDGER_COLUMNS.indexOf(\'plannedMinutes\') — the sixteen before PLANNED MIN, worked out — then PLANNED MIN and LOGGED MIN, each ledgerTotals’ sum over the rows shown (filter a city: that city’s minutes; "—" when no row shown carries one), then COA’s cell empty, then BUDGET … NOTES', () => {
  const s = code(SECTION);
  const tfoot = s.slice(s.indexOf('<tfoot>'), s.indexOf('</tfoot>'));
  assert.ok(tfoot.includes("<th scope=\"row\" colSpan={LEDGER_COLUMNS.indexOf('plannedMinutes')} className={`${cell} text-left`}>{TOTAL_WORDS}</th>"), 'the span worked out, never typed');
  assert.doesNotMatch(tfoot, /colSpan=\{\d/, 'no number typed for the span');
  assert.equal(LEDGER_COLUMNS.indexOf('plannedMinutes'), 16);
  assert.deepEqual([...tfoot.matchAll(/data-ledger-total-([a-z-]+)/g)].map((m) => m[1]), ['planned-minutes', 'logged-minutes', 'account', 'budget', 'actual', 'variance', 'match', 'under-over', 'notes']);
  assert.match(tfoot, /data-ledger-total-planned-minutes>\{minutesCellWords\(totals\.plannedMinutes\)\}<\/td>/);
  assert.match(tfoot, /data-ledger-total-logged-minutes>\{minutesCellWords\(totals\.loggedMinutes\)\}<\/td>/);
  assert.match(tfoot, /<td className=\{cell\} data-ledger-total-account \/>/, 'COA’s cell, empty');
  assert.equal(LEDGER_COLUMNS.indexOf('plannedMinutes') + [...tfoot.matchAll(/<td\b/g)].length, LEDGER_COLUMNS.length, 'the label and its cells fill the twenty-five');
  assert.match(s, /const shown = sortRows\(applyColumnFilters\(rows, filters\), sort\);\n\s*const totals = ledgerTotals\(shown\);/, 'the totals are the rows shown’s');
  // The sums, over the rows shown — by any filter.
  const rows: readonly LedgerSheetRow[] = [planRow('a', 'Pine Cove', 30), recordedRow('b', 'Pine Cove', 45, 20), planRow('c', 'Ridge Camp', 60), recordedRow('d', 'Ridge Camp', null, 50), planRow('e', 'Ridge Camp', null)];
  const all = ledgerTotals(rows);
  assert.deepEqual([all.plannedMinutes, all.loggedMinutes], [135, 70], 'every row shown: the planned and the logged, each summed where a row carries one');
  const pine = ledgerTotals(applyColumnFilters(rows, { ...NO_COLUMN_FILTERS, city: { dropped: ['Ridge Camp'] } }));
  assert.deepEqual([pine.plannedMinutes, pine.loggedMinutes], [75, 20], 'filter a city: that city’s minutes');
  const none = ledgerTotals([planRow('e', 'Ridge Camp', null)]);
  assert.deepEqual([minutesCellWords(none.plannedMinutes), minutesCellWords(none.loggedMinutes)], [BLANK, BLANK], '"—" when no row shown carries one');
});

// ── T14 · /time IS THE TABLE (rulings 2.3, 2.4) ──────────────────────────────

test('T14 /time mounts LedgerSection alone — the journal tables imported and mounted nowhere there, kept as files; its dated paragraph says why; the law’s TIME_MOUNTS is the ledger alone and its container check wants the ledger', () => {
  const page = code(TIME_PAGE);
  const box = page.slice(page.indexOf('data-tool-page="Time"'), page.indexOf('</OperationsEntityProvider>'));
  assert.deepEqual([...box.matchAll(/<([A-Z]\w*)\b/g)].map((m) => m[1]), ['LedgerSection']);
  assert.doesNotMatch(page, /MorningJournalTable|EveningJournalTable/);
  assert.match(comments(TIME_PAGE), /SHEET-01 \(Alex, 2026-11-28\) — THE PAGE IS THE TABLE\. "we dont want this on here\n \* either!" — of the summary under the sheet and the two journals\./);
  assert.match(comments(TIME_PAGE), /journal is still written on the day card, on the\n \* home page \(\/home\)/);
  for (const table of ['MorningJournalTable', 'EveningJournalTable']) {
    assert.match(code(`src/components/workbench/operations/journal/${table}.tsx`), new RegExp(`export default function ${table}\\(\\)`), `${table} is kept`);
  }
  const law = code(LAW);
  assert.match(law, /const TIME_MOUNTS = \['<LedgerSection \/>'\];/);
  assert.match(law, /if \(timeMounts\.join\(' '\) !== 'LedgerSection'\) twoListsFail\(`\$\{TIME_PAGE\} mounts \[\$\{timeMounts\.join\(' '\)\}\] in the Time container — the page is the table: exactly the task ledger, nothing else \(SHEET-01, 2026-11-28; the two journal tables beside it until then — HOME-01;/);
  assert.match(comments(LAW), /SHEET-01 \(Alex, 2026-11-28\): the page is the table — the task ledger alone; the morning and the evening journal tables after it until then \(HOME-01\)/);
  assert.equal(linesOf(LAW).length, 11254, 'the law edited in place');
});

// ── T15 · THE REGISTRY'S TIME ROW (ruling 2.5) ───────────────────────────────

test('T15 the registry’s Time row: LIVE with its four beats; the customer line verbatim; no journal cite; the hours the TOTAL row’s two sums; every re-cited line holds what it names; the dated note on the slug line; the file’s line count unchanged', () => {
  const time = TOOL_REGISTRY.find((t) => t.name === 'Time');
  assert.ok(time);
  assert.deepEqual([time.status, time.beats, time.home, time.why], ['LIVE', { discover: true, decide: true, commit: true, record: true }, '/time', undefined]);
  assert.equal(time.customer, 'You can see every stop you logged, day by day — what each cost, how long it took against its plan, and where the hours went over any period — filter and export them; the day itself is entered on the home dashboard.');
  assert.doesNotMatch(time.citation, /journalReads|MorningJournalTable|EveningJournalTable|JournalDayTable|SUMMARY_HEAD_WORDS|their coverage said at|PLANNED HOURS · LOGGED HOURS — the summary/, 'no journal read, no journal table, no summary cite');
  assert.match(time.citation, /decide: src\/app\/api\/operations\/journal\/route\.ts:61 \(PUT/, 'decide stands: the journal’s PUT from the day card');
  const cited = (re: RegExp): number => { const m = time.citation.match(re); if (m === null) return assert.fail(`the citation names ${re}`); return Number(m[1]); };
  const at = (file: string, n: number): string => linesOf(file)[n - 1] ?? '';
  assert.match(at('src/components/workbench/operations/ledger/ledgerReads.ts', cited(/ledger\/ledgerReads\.ts:(\d+)/)), /readJson\(`\/api\/operations\/ledger\?/);
  assert.match(at(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the two cells\)/)), /data-ledger-cell="planned-minutes"/);
  assert.match(at(SECTION, cited(/LedgerSection\.tsx:(\d+) \(the TOTAL row's two sums, PLANNED MIN · LOGGED MIN — over the rows shown, by any filter — the summary's PLANNED HOURS · LOGGED HOURS until SHEET-01\)/)), /data-ledger-total-planned-minutes/);
  assert.match(at(SHEET_RULES, cited(/src\/lib\/operations\/ledger\.ts:(\d+) \(LEDGER_HEAD_WORDS/)), /^export const LEDGER_HEAD_WORDS = \[/);
  assert.match(code(REGISTRY), /slug: 'time', status: 'LIVE', beats: ALL, home: '\/time',/);
  assert.match(comments(REGISTRY), /SHEET-01 \(Alex, 2026-11-28\): the page is the table — the journal's read and its two tables leave the citation/);
  assert.equal(linesOf(REGISTRY).length, 761, 'no line added or removed — Landing.tsx cites lines of this file');
});

// ── PART 3 — "+ EXPENSE" IS THE SHEET'S BLANK ROW ────────────────────────────

const FORM = 'src/components/workbench/operations/ledger/ExpenseForm.tsx';
const TABLE = 'src/components/table/DataTable.tsx';
const rx = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A row as he types it — Monday at nine, past; every box the rule requires, and none of the four new ones. */
const ROW: ExpenseDraft = { ...EMPTY_EXPENSE, day: MON, time: '09:00', name: 'Kayak', coa: '6200', book: 'P' };
const readRow = (boxes: Partial<ExpenseDraft>) => expenseInput({ ...ROW, ...boxes }, NBO, NOW);
const valueOf = (boxes: Partial<ExpenseDraft>) => {
  const read = readRow(boxes);
  if (!read.ok) return assert.fail(`refused on ${read.field}: ${read.message}`);
  return read.value;
};
const refusedOn = (boxes: Partial<ExpenseDraft>): readonly [ExpenseField, string] => {
  const read = readRow(boxes);
  if (read.ok) return assert.fail(`read: ${JSON.stringify(boxes)}`);
  return [read.field, read.message];
};

// ── T16 · THE BOXES ARE THE SHEET'S HEAD WORDS (ruling 3.2) ──────────────────

test('T16 EXPENSE_FIELDS are fifteen boxes in the sheet’s order, each worded by its own column’s head word (headWordOf) — none typed; the draft gains END, INSTAGRAM TAG, NOTES and LOGGED MIN, each blank in EMPTY_EXPENSE', () => {
  assert.deepEqual(EXPENSE_FIELDS, ['day', 'time', 'end', 'location', 'coa', 'book', 'name', 'note', 'vendor', 'tag', 'stars', 'logged', 'amount', 'actual', 'notes']);
  const COLUMN_OF = {
    day: 'date', time: 'start', end: 'end', location: 'location', coa: 'accountName', book: 'book', name: 'subAccountName', note: 'description', vendor: 'vendor', tag: 'instagramTag',
    stars: 'stars', logged: 'loggedMinutes', amount: 'budget', actual: 'actual', notes: 'notes',
  } as const satisfies Record<ExpenseField, LedgerColumn>;
  for (const field of EXPENSE_FIELDS) assert.equal(EXPENSE_FIELD_WORDS[field], headWordOf(COLUMN_OF[field]), field);
  assert.deepEqual(EXPENSE_FIELDS.map((f) => EXPENSE_FIELD_WORDS[f]), ['DATE', 'START', 'END', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'INSTAGRAM TAG', 'STARS', 'LOGGED MIN', 'BUDGET', 'ACTUAL', 'NOTES']);
  const at = EXPENSE_FIELDS.map((f) => LEDGER_COLUMNS.indexOf(COLUMN_OF[f]));
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'the boxes run left to right as the sheet’s columns do');
  const words = code(SHEET_RULES).match(/^export const EXPENSE_FIELD_WORDS: Readonly<Record<ExpenseField, string>> = \{[^\n]*\};/m)?.[0] ?? assert.fail('EXPENSE_FIELD_WORDS on its one line');
  assert.equal(countOf(words, /headWordOf\('\w+'\)/g), EXPENSE_FIELDS.length);
  assert.doesNotMatch(words, /'[A-Z]/, 'no head word typed');
  for (const box of ['end', 'tag', 'notes', 'logged'] as const) assert.equal(EMPTY_EXPENSE[box], '', `${box}: blank`);
});

// ── T17 · END (ruling 3.2) ───────────────────────────────────────────────────

test('T17 END, read after ITEMS: blank is none; typed with no START, refused — a charge has no clock; not HH:MM, timeTypedWords; at START, refused; else the minutes START to END, across midnight, by minutesFromTo — the one arithmetic', () => {
  assert.equal(END_NEEDS_START_WORDS, 'END needs a START — with no START this is a charge on its date, and a charge has no clock');
  assert.equal(END_AT_START_WORDS, 'END is START — give the stop a length, or leave END blank');
  assert.equal(valueOf({}).minutes, null);
  assert.equal(valueOf({ end: '   ' }).minutes, null, 'spaces are blank');
  assert.deepEqual(refusedOn({ time: '', end: '10:00' }), ['end', END_NEEDS_START_WORDS]);
  for (const typed of ['9:30', '24:00', '10:60', 'noon', '10.30']) assert.deepEqual(refusedOn({ end: typed }), ['end', timeTypedWords(typed)], typed);
  assert.deepEqual(refusedOn({ end: '09:00' }), ['end', END_AT_START_WORDS]);
  assert.equal(valueOf({ end: '10:30' }).minutes, 90);
  assert.equal(valueOf({ time: '22:30', end: '01:15' }).minutes, 165, 'across midnight');
  assert.equal(valueOf({ end: '08:59' }).minutes, 1439, 'a minute short of a day');
  assert.deepEqual([minutesFromTo('09:00', '10:30'), minutesFromTo('22:30', '01:15'), minutesFromTo('09:00', '09:00'), minutesFromTo('00:00', '23:59')], [90, 165, 0, 1439]);
  assert.throws(() => minutesFromTo('9:00', '10:00'), /^Error: ledger: "9:00" is not a time \(HH:MM\)$/);
  assert.equal(refusedOn({ note: 'two\u0001paddles', end: 'noon' })[0], 'note', 'ITEMS first');
  assert.equal(refusedOn({ end: 'noon', vendorName: 'Cove Kayaks', tag: 'cove kayaks' })[0], 'end', 'then END, before INSTAGRAM TAG');
});

// ── T18 · INSTAGRAM TAG (ruling 3.2) ─────────────────────────────────────────

test('T18 INSTAGRAM TAG, read after END: blank is none; typed with no VENDOR, refused — the tag is the vendor’s; else planVendor.ts readInstagramTag, its words — for a vendor of the book and for a new name alike', () => {
  assert.equal(TAG_NEEDS_VENDOR_WORDS, "an INSTAGRAM TAG is the vendor's — pick a VENDOR or name a new one");
  assert.equal(valueOf({ vendorName: 'Cove Kayaks' }).tag, null);
  assert.deepEqual(refusedOn({ tag: '@cove.kayaks' }), ['tag', TAG_NEEDS_VENDOR_WORDS]);
  for (const vendor of [{ vendorId: 'vendor-cove' }, { vendorName: 'Cove Kayaks' }]) {
    assert.equal(valueOf({ ...vendor, tag: '@cove.kayaks' }).tag, 'cove.kayaks', 'the @ is the handle’s mark');
    assert.equal(valueOf({ ...vendor, tag: ' cove_kayaks ' }).tag, 'cove_kayaks');
    for (const bad of ['cove kayaks', '@cove-kayaks', 'c'.repeat(31)]) {
      const read = readInstagramTag(bad);
      if (read.ok) return assert.fail(`${bad} read`);
      assert.match(read.message, new RegExp(`^${rx(INSTAGRAM_TAG_WORDS)} — `));
      assert.deepEqual(refusedOn({ ...vendor, tag: bad }), ['tag', read.message], bad);
    }
  }
  assert.equal(refusedOn({ vendorName: 'Cove Kayaks', tag: 'cove kayaks', notes: 'calm\u0007water' })[0], 'tag', 'before NOTES');
});

// ── T19 · NOTES (ruling 3.2) ─────────────────────────────────────────────────

test('T19 NOTES, read after INSTAGRAM TAG: trimmed, its spaces one; for a charge, chargeFieldWords(\'notes\') — the sentence names START; ahead, aheadFieldWords(\'notes\'); then the record form’s own reading — a control character, then longer than NOTES_MAX', () => {
  assert.equal(valueOf({}).notes, null);
  assert.equal(valueOf({ notes: '  calm   water\tall day ' }).notes, 'calm water all day');
  assert.deepEqual(refusedOn({ time: '', notes: 'calm water' }), ['notes', chargeFieldWords('notes')]);
  assert.equal(chargeFieldWords('notes'), "NOTES is the record's, and with no START this is a charge on its date — it takes no record; give it a START, or leave this blank");
  assert.deepEqual(refusedOn({ day: WED, notes: 'calm water' }), ['notes', aheadFieldWords('notes')]);
  assert.equal(aheadFieldWords('notes'), "NOTES is the record's, and this stop is still ahead — leave it blank, and record it on its row once its time has come");
  assert.deepEqual(refusedOn({ notes: 'calm\u0007water' }), ['notes', NOTES_CONTROL_WORDS]);
  assert.deepEqual(refusedOn({ notes: 'w'.repeat(NOTES_MAX + 1) }), ['notes', NOTES_LONG_WORDS]);
  assert.deepEqual(refusedOn({ notes: `\u0007${'w'.repeat(NOTES_MAX + 1)}` }), ['notes', NOTES_CONTROL_WORDS], 'controls before length');
  assert.equal(valueOf({ notes: 'w'.repeat(NOTES_MAX) }).notes, 'w'.repeat(NOTES_MAX), 'NOTES_MAX itself is read');
  assert.equal(refusedOn({ notes: 'calm\u0007water', logged: 'many' })[0], 'notes', 'before LOGGED MIN');
});

// ── T20 · LOGGED MIN (ruling 3.2) ────────────────────────────────────────────

test('T20 LOGGED MIN, read last: blank is none; for a charge and ahead, refused by name; not a whole number, minutesTypedWords; above MINUTES_MAX, MINUTES_RANGE_WORDS — the record form’s own reading', () => {
  assert.equal(valueOf({}).logged, null);
  assert.deepEqual(refusedOn({ time: '', logged: '45' }), ['logged', chargeFieldWords('logged')]);
  assert.deepEqual(refusedOn({ day: WED, logged: '45' }), ['logged', aheadFieldWords('logged')]);
  for (const typed of ['1.5', 'many', '-3', '45 min', '4 5']) assert.deepEqual(refusedOn({ logged: typed }), ['logged', minutesTypedWords(typed)], typed);
  assert.deepEqual(refusedOn({ logged: String(MINUTES_MAX + 1) }), ['logged', MINUTES_RANGE_WORDS]);
  assert.equal(MINUTES_RANGE_WORDS, `LOGGED MIN is 0 to ${MINUTES_MAX}`);
  assert.deepEqual([valueOf({ logged: '0' }).logged, valueOf({ logged: ' 75 ' }).logged, valueOf({ logged: String(MINUTES_MAX) }).logged], [0, 75, MINUTES_MAX]);
});

// ── T21 · IN ORDER, AND THE RECORD CARRIES THEM (ruling 3.2) ─────────────────

test('T21 the four new boxes are read after ITEMS in the ruled order — END, INSTAGRAM TAG, NOTES, LOGGED MIN — the first bad one named; the value carries them last; recordBody carries NOTES and LOGGED MIN', () => {
  const bad: Partial<ExpenseDraft> = { end: '09:00', tag: 'cove kayaks', notes: 'calm\u0007water', logged: 'many' };
  const fixed = { end: '10:30', tag: '@cove.kayaks', notes: 'calm water', logged: '75' } as const;
  let boxes: Partial<ExpenseDraft> = { vendorName: 'Cove Kayaks', ...bad };
  const named: ExpenseField[] = [];
  for (const box of ['end', 'tag', 'notes', 'logged'] as const) {
    named.push(refusedOn(boxes)[0]);
    boxes = { ...boxes, [box]: fixed[box] };
  }
  assert.deepEqual(named, ['end', 'tag', 'notes', 'logged']);
  assert.equal(refusedOn({ vendorName: 'Cove Kayaks', ...bad, note: 'two\u0001paddles' })[0], 'note', 'ITEMS before all four');
  const v = valueOf({ vendorName: 'Cove Kayaks', ...fixed, actual: '7.50', stars: '4', note: 'two paddles' });
  assert.deepEqual(Object.keys(v).slice(-4), ['minutes', 'tag', 'notes', 'logged']);
  assert.deepEqual([v.minutes, v.tag, v.notes, v.logged], [90, 'cove.kayaks', 'calm water', 75]);
  assert.deepEqual(recordBody(v, 'line-kayak'), {
    kind: 'routine_line', id: 'line-kayak', instant: v.instant, outcome: 'done', done_at: v.instant, actual_cents: 750, rating: 4, note: 'two paddles', notes: 'calm water', actual_minutes: 75,
  });
  const bare = valueOf({});
  assert.deepEqual(recordBody(bare, 'line-kayak'), {
    kind: 'routine_line', id: 'line-kayak', instant: bare.instant, outcome: 'done', done_at: bare.instant, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null,
  }, 'none typed: null and null');
});

// ── T22 · THE EIGHT STEPS (ruling 3.2) ───────────────────────────────────────

test('T22 the writes are eight steps — the trip first, END’s minutes after the line, the tag after the vendor; a tag that stands is said in its own words — the same handle, or the one the vendor carries; every step after a failure, not tried', () => {
  assert.deepEqual(EXPENSE_STEPS, ['trip', 'stop', 'line', 'minutes', 'directory', 'vendor', 'tag', 'record']);
  assert.deepEqual([STEP_WORDS.trip, STEP_WORDS.minutes, STEP_WORDS.tag], ['the trip — the place of every row on its days', "the stop's END", "the vendor's Instagram tag"]);
  assert.equal(TAG_STANDS_WORDS('cove.paddles'), 'not written — the vendor already carries @cove.paddles');
  assert.equal(TAG_SAME_WORDS('cove.kayaks'), "@cove.kayaks — already the vendor's");
  assert.equal(outcomeWords({ step: 'tag', state: 'stands', words: TAG_SAME_WORDS('cove.kayaks') }), "the vendor's Instagram tag — @cove.kayaks — already the vendor's");
  assert.equal(outcomeWords({ step: 'tag', state: 'stands', words: TAG_STANDS_WORDS('cove.paddles') }), "the vendor's Instagram tag — not written — the vendor already carries @cove.paddles");
  assert.deepEqual(withNotTried([{ step: 'trip', state: 'failed', words: 'refused' }]).map((o) => `${o.step}:${o.state}`),
    ['trip:failed', 'stop:not tried', 'line:not tried', 'minutes:not tried', 'directory:not tried', 'vendor:not tried', 'tag:not tried', 'record:not tried']);
});

// ── T23 · PLANNED MIN AS HE TYPES (ruling 3.2) ───────────────────────────────

test('T23 rowPlannedMinutes — PLANNED MIN as he types: START and END both HH:MM and not the same, their minutes (across midnight); else none — the sheet’s blank', () => {
  const planned = (time: string, end: string): number | null => rowPlannedMinutes({ time, end });
  assert.deepEqual([planned('09:00', '10:30'), planned('22:30', '01:15')], [90, 165]);
  for (const [time, end] of [['09:00', '09:00'], ['09:00', ''], ['', '10:30'], ['', ''], ['9:00', '10:30'], ['09:00', '10:3'], ['09:00', 'noon']] as const) {
    assert.equal(planned(time, end), null, `${time} → ${end}`);
  }
  assert.equal(minutesCellWords(planned('09:00', '')), BLANK);
  assert.equal(minutesCellWords(planned('09:00', '10:30')), minutesCellWords(90));
});

// ── T24 · THE ROW'S TRIP (ruling 3.2) ────────────────────────────────────────

test('T24 rowTripInput, each branch: none typed is none; CITY blank with another typed, refused on CITY; REGION with no COUNTRY, refused on COUNTRY; TRIP ENDS not a day or before DATE, refused on TRIP ENDS; the place by stay.ts stayInput, its words on CITY; else a trip to add, DATE to TRIP ENDS', () => {
  const DAY = '2027-03-03';
  const trip = (boxes: Partial<RowTripDraft>) => rowTripInput({ ...EMPTY_ROW_TRIP, endsOn: DAY, ...boxes }, DAY);
  assert.equal(TRIP_ENDS_WORDS, 'TRIP ENDS');
  assert.equal(PLACE_NEEDS_CITY_WORDS, "a trip's place starts with its CITY");
  assert.equal(REGION_NEEDS_COUNTRY_WORDS, 'REGION needs its COUNTRY — a place of two parts reads as a city and a country');
  assert.equal(tripEndsBeforeWords(DAY, '2027-03-01'), "TRIP ENDS 2027-03-01 is before the row's DATE 2027-03-03");
  assert.deepEqual(ROW_TRIP_FIELD_WORDS, { city: 'CITY', region: 'REGION', country: 'COUNTRY', endsOn: 'TRIP ENDS' });
  // None typed.
  assert.deepEqual(trip({}), { kind: 'none' });
  assert.deepEqual(trip({ city: '  ', region: '\t', country: ' ', endsOn: 'soon' }), { kind: 'none' }, 'spaces are blank; TRIP ENDS is not read for no trip');
  // CITY first.
  assert.deepEqual(trip({ region: 'Coast Province', country: 'Examplia' }), { kind: 'refused', field: 'city', message: PLACE_NEEDS_CITY_WORDS });
  assert.deepEqual(trip({ country: 'Examplia' }), { kind: 'refused', field: 'city', message: PLACE_NEEDS_CITY_WORDS });
  // REGION needs its COUNTRY — stay.ts placeParts reads a place of two parts as a city and a country.
  assert.deepEqual(trip({ city: 'Harbor Town', region: 'Coast Province' }), { kind: 'refused', field: 'country', message: REGION_NEEDS_COUNTRY_WORDS });
  assert.deepEqual(placeParts('Harbor Town, Coast Province'), { city: 'Harbor Town', region: null, country: 'Coast Province' }, 'why: the region would be read as the country');
  // TRIP ENDS.
  for (const endsOn of ['', 'soon', '2027-02-30', '3/9/27']) assert.deepEqual(trip({ city: 'Harbor Town', endsOn }), { kind: 'refused', field: 'endsOn', message: dayTypedWords(endsOn) }, endsOn);
  assert.deepEqual(trip({ city: 'Harbor Town', endsOn: '2027-03-02' }), { kind: 'refused', field: 'endsOn', message: tripEndsBeforeWords(DAY, '2027-03-02') });
  // The place, by stayInput — its words, on CITY.
  assert.deepEqual(trip({ city: 'Harbor\u0001Town' }), { kind: 'refused', field: 'city', message: 'control characters are not a place' });
  const long = { city: 'H'.repeat(40), region: 'C'.repeat(30), country: 'E'.repeat(20) };
  const said = stayInput({ place: [long.city, long.region, long.country].join(', '), starts_on: DAY, ends_on: DAY });
  if (said.ok) return assert.fail('a place of 94 characters read');
  assert.deepEqual(trip(long), { kind: 'refused', field: 'city', message: said.message });
  // A trip to add: DATE to TRIP ENDS, the typed parts joined.
  assert.deepEqual(trip({ city: ' Harbor   Town ', region: 'Coast  Province', country: 'Examplia', endsOn: '2027-03-09' }), { kind: 'add', place: 'Harbor Town, Coast Province, Examplia', startsOn: DAY, endsOn: '2027-03-09' });
  assert.deepEqual(trip({ city: 'Harbor Town', country: 'Examplia' }), { kind: 'add', place: 'Harbor Town, Examplia', startsOn: DAY, endsOn: DAY }, 'a one-day trip, a place of two parts');
  assert.deepEqual(trip({ city: 'Harbor Town' }), { kind: 'add', place: 'Harbor Town', startsOn: DAY, endsOn: DAY });
  assert.throws(() => rowTripInput(EMPTY_ROW_TRIP, ''), /^Error: ledger: the row's trip is read for a day — "" is not one$/);
  // What the row says of a trip.
  const covering: StayRow = { id: 'stay-harbor', place: 'Harbor Town, Coast Province, Examplia', starts_on: DAY, ends_on: '2027-03-09' };
  assert.equal(coveringTripWords(covering), 'TRIP Harbor Town, Coast Province, Examplia · 2027-03-03 → 2027-03-09');
  assert.equal(noTripRowWords(DAY), 'no trip covers 2027-03-03 — a CITY typed in the row is written as a trip, 2027-03-03 to');
});

// ── T25 · THE BLANK ROW, DRAWN (ruling 3.4) ──────────────────────────────────

/** Four made-up books: one personal, two of one type (they say their names), one of a type the sheet has no word for (it says its name). */
const BOOKS: Entity[] = [
  { id: 'P', name: 'Home', entity_type: 'personal', is_default: true },
  { id: 'B1', name: 'Cove Studio', entity_type: 'sole_prop', is_default: false },
  { id: 'B2', name: 'Ridge Works', entity_type: 'sole_prop', is_default: false },
  { id: 'L', name: 'Pine Holdings', entity_type: 'llc', is_default: false },
];
const drawRow = (entities: Entity[]): string => renderToStaticMarkup(createElement('table', null, createElement('tbody', null,
  createElement(OperationsEntityContext.Provider, { value: { entities, selectedEntityId: null, setSelectedEntityId: () => undefined, selectedEntity: null } },
    createElement(ExpenseRow, { onWritten: () => undefined, close: () => undefined })))));
const cellIn = (row: string, key: LedgerColumn): string => {
  const at = row.indexOf(`data-ledger-expense-cell="${key}"`);
  assert.ok(at >= 0, `the ${key} cell`);
  return row.slice(at, row.indexOf('</td>', at));
};

test('T25 the blank row, drawn: one cell under every column, in LEDGER_COLUMNS’ order — a box under every column he types, each labelled by its word; DAY and PLANNED MIN worked out as he types; WENT, COA, VARIANCE, MATCH and UNDER / OVER the sheet’s blank until saved; the row beneath, one cell across the twenty-five', () => {
  const html = drawRow(BOOKS);
  const row = html.slice(html.indexOf('data-ledger-expense-form'), html.indexOf('data-ledger-expense-said'));
  const beneath = html.slice(html.indexOf('data-ledger-expense-said'));
  assert.deepEqual([...row.matchAll(/data-ledger-expense-cell="(\w+)"/g)].map((m) => m[1]), [...LEDGER_COLUMNS], 'one cell a column, in its order');
  assert.equal(countOf(row, /<td\b/g), LEDGER_COLUMNS.length);
  // A box under every column he types — the rule's fifteen and the trip's three — each labelled by its word.
  assert.deepEqual([...row.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]),
    ['DATE', 'START', 'END', 'CITY', 'REGION', 'COUNTRY', 'LOCATION', 'CATEGORY', 'ENTITY', 'TYPE', 'ITEMS', 'VENDOR', 'INSTAGRAM TAG', 'STARS', 'LOGGED MIN', 'BUDGET', 'ACTUAL', 'NOTES']);
  const words = new Set<string>([...Object.values(EXPENSE_FIELD_WORDS), ...Object.values(ROW_TRIP_FIELD_WORDS)]);
  for (const m of row.matchAll(/aria-label="([^"]+)"/g)) assert.ok(words.has(m[1]), `${m[1]} is a box’s word`);
  assert.deepEqual([...row.matchAll(/data-ledger-expense-box="(\w+)"/g)].map((m) => m[1]).sort(), [...EXPENSE_FIELDS, 'city', 'region', 'country'].sort());
  // No trip read yet (no DATE): the trip's three are boxes, 80 at most.
  for (const key of ['city', 'region', 'country'] as const) assert.match(cellIn(row, key), new RegExp(`<input type="text" maxLength="80" aria-label="${ROW_TRIP_FIELD_WORDS[key]}"`));
  // DAY nothing until DATE is a day; PLANNED MIN the sheet's blank until START and END are typed.
  assert.equal(cellIn(row, 'day'), 'data-ledger-expense-cell="day">');
  assert.match(cellIn(row, 'plannedMinutes'), new RegExp(`<span data-ledger-expense-planned-minutes="true">${BLANK}</span>$`));
  // The five the rule works out once saved.
  for (const key of ['went', 'account', 'variance', 'match', 'underOver'] as const) {
    assert.match(cellIn(row, key), new RegExp(`><span title="${rx(ROW_LATER_WORDS)}" data-ledger-expense-later="true">${rx(ROW_LATER_MARK)}</span>$`), key);
  }
  assert.equal(countOf(row, /data-ledger-expense-later/g), 5);
  // LOCATION: none, then the rule file's classes in its words. ENTITY: each book by its sheet word.
  const options = (cell: string): string[][] => [...cell.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(options(cellIn(row, 'location')), [['', NO_LOCATION_WORDS], ...LOCATION_CLASSES.map((c) => [c, LOCATION_WORDS[c]])]);
  assert.deepEqual(options(cellIn(row, 'book')), [['P', 'Personal'], ['B1', 'Business — Cove Studio'], ['B2', 'Business — Ridge Works'], ['L', 'Pine Holdings']]);
  assert.match(cellIn(drawRow([]), 'book'), new RegExp(`data-ledger-expense-no-book="true">${rx(NO_BOOK_WORDS)}</span>$`));
  // CATEGORY: the book's chart, in a group that carries the box's word. VENDOR: ONE typed box over the book's vendors.
  assert.match(cellIn(row, 'accountName'), /<div role="group" aria-label="CATEGORY" data-ledger-expense-box="coa"><select /);
  const vendor = cellIn(row, 'vendor');
  assert.equal(countOf(vendor, /<input\b/g), 1);
  assert.doesNotMatch(vendor, /<select\b/);
  assert.match(vendor, /<input type="text" list="ledger-expense-vendors" aria-label="VENDOR"[^>]*\/><datalist id="ledger-expense-vendors" data-ledger-expense-vendors="true"><\/datalist>$/);
  // The row beneath: one cell across the twenty-five — save (waiting for the zone, read on mount) and cancel; nothing read yet, nothing said.
  assert.equal(countOf(beneath, /<td\b/g), 1);
  assert.match(beneath, new RegExp(`<td colSpan="${LEDGER_COLUMNS.length}" `));
  assert.match(beneath, new RegExp(`disabled="" aria-busy="false" data-ledger-expense-save="true">${rx(SAVE_EXPENSE_WORDS)}</button>`));
  assert.match(beneath, new RegExp(`data-ledger-expense-cancel="true">${rx(CANCEL_EXPENSE_WORDS)}</button>`));
  assert.doesNotMatch(beneath, /data-ledger-expense-(zone|trip|refused|outcome|landed)/);
  assert.equal(countOf(html, /<tr class="border-t border-border bg-amber-50"/g), 2, 'both rows in the light tint');
});

// ── T26 · THE FORM'S SOURCE (rulings 3.4, 3.5) ───────────────────────────────

test('T26 the form: "+ expense" opens and shuts the row; the cells drawn from the list; the vendors by the directory’s GET and vendorsOf, the trip by readStays — both again after a save; VENDOR one of the book’s by pastedVendorOf; the writes in EXPENSE_STEPS’ order — the trip first and only on add, END’s minutes by setLineMinutes, the tag never over a standing one; nothing stored in the browser', () => {
  // "+ expense", drawn shut and open: pressed while open, outlined — no dark fill.
  const shut = renderToStaticMarkup(createElement(ExpenseOpen, { open: false, onToggle: () => undefined }));
  const open = renderToStaticMarkup(createElement(ExpenseOpen, { open: true, onToggle: () => undefined }));
  assert.match(shut, new RegExp(`aria-pressed="false" data-ledger-expense-open="true">${rx(EXPENSE_WORDS)}</button>$`));
  assert.match(open, new RegExp(`aria-pressed="true" data-ledger-expense-open="true">${rx(EXPENSE_WORDS)}</button>$`));
  assert.notEqual(shut.match(/class="([^"]+)"/)?.[1], open.match(/class="([^"]+)"/)?.[1], 'the pressed class while open');
  assert.doesNotMatch(open, /bg-brand-purple|text-white/);
  const f = code(FORM);
  assert.match(f, /export function ExpenseOpen\(\{ open, onToggle \}: \{ open: boolean; onToggle: \(\) => void \}\) \{\n\s*return <button type="button" className=\{open \? chipOn : chip\} onClick=\{onToggle\} aria-pressed=\{open\} data-ledger-expense-open>\{EXPENSE_WORDS\}<\/button>;/);
  assert.match(f, /export default function ExpenseRow\(\{ onWritten, close \}: \{ onWritten: \(day: string\) => void; close: \(\) => void \}\) \{/);
  assert.match(f, /onClick=\{close\} data-ledger-expense-cancel>/, 'cancel shuts the row');
  // The cells drawn from LEDGER_COLUMNS — never a retyped list; a case a column, in its order; a column with no case is the file's error.
  assert.ok(f.includes('{LEDGER_COLUMNS.map((key) => <td key={key} className={`${cell} align-middle`} data-ledger-expense-cell={key}>{cellOf(key)}</td>)}'));
  assert.doesNotMatch(f, /data-ledger-expense-cell="/, 'no cell typed by hand');
  assert.deepEqual([...f.matchAll(/^\s*case '(\w+)':/gm)].map((m) => m[1]), [...LEDGER_COLUMNS]);
  assert.ok(f.includes('default: { const none: never = key; throw new Error(`ExpenseForm: no cell for the column ${String(none)}`); }'));
  // The reads — again after a save.
  assert.match(f, /const listed = await readJson\('\/api\/operations\/vendor-directory'\);\n\s*if \(!live\) return;\n\s*if \(!listed\.ok\) \{ setVendorsRead\(\{ kind: 'failed', words: vendorsUnreadWords\(listed\.words\) \}\); return; \}\n\s*const read = vendorsOf\(listed\.value\);/);
  assert.match(f, /setVendorsRead\(read\.ok \? \{ kind: 'read', vendors: read\.vendors \} : \{ kind: 'failed', words: vendorsUnreadWords\(read\.words\) \}\);/);
  assert.doesNotMatch(f, /useDirectory/, 'the Budget’s directory reader is read no more');
  assert.match(f, /const read = await readStays\(draft\.day\);\n\s*if \(!live\) return;\n\s*setTripRead\(read\.ok \? \{ kind: 'read', covering: read\.value\.covering \} : \{ kind: 'failed', words: read\.words \}\);/);
  assert.match(f, /\}, \[reads\]\);/);
  assert.match(f, /\}, \[draft\.day, reads\]\);/);
  // TRIP ENDS follows DATE, in its box — never a hidden choice.
  assert.ok(f.includes('const setDay = (value: string) => { setDraft((d) => ({ ...d, day: value })); setTrip((t) => ({ ...t, endsOn: value })); };'));
  assert.ok(f.includes('<input type="date" value={draft.day} onChange={(e) => setDay(e.target.value)}'));
  // The save.
  const save = f.slice(f.indexOf('const save = async () => {'), f.indexOf('const onKeyDown = ('));
  assert.match(save, /if \(tripRead\.kind === 'failed'\) \{ refuse\('city', tripRead\.words\); return; \}\n\s*if \(tripRead\.kind !== 'read'\) \{ refuse\('city', STAY_LOADING_WORDS\); return; \}\n\s*if \(tripRead\.covering === null\) \{\n\s*const read = rowTripInput\(trip, draft\.day\);\n\s*if \(read\.kind === 'refused'\) \{ refuse\(read\.field, read\.message\); return; \}\n\s*if \(read\.kind === 'add'\) tripToAdd = read;/);
  assert.equal(countOf(save, /\bcreateStay\(/g), 1);
  assert.match(save, /if \(tripToAdd !== null\) \{[\s\S]*?added = await createStay\(\{ place: tripToAdd\.place, starts_on: tripToAdd\.startsOn, ends_on: tripToAdd\.endsOn \}\);[\s\S]*?\} else \{\n\s*done\.push\(\{ step: 'trip', state: 'not asked', words: '' \}\);/, 'the trip only on add; else not asked');
  assert.match(save, /if \(vendorsRead\.kind === 'reading'\) \{ refuse\('vendor', VENDORS_LOADING_WORDS\); return; \}\n\s*if \(vendorsRead\.kind === 'failed'\) \{ refuse\('vendor', vendorsRead\.words\); return; \}\n\s*const picked = pastedVendorOf\(typed, \{ id: draft\.book \}, vendorsRead\.vendors\);/, 'never guessed while unread');
  assert.match(save, /carries = own\.instagram_tag;/, 'what the vendor carries is the directory’s, as read');
  assert.match(save, /if \(v\.minutes !== null\) \{\n\s*const timed = await setLineMinutes\(line\.value\.lineId, v\.minutes\);[\s\S]*?\} else \{\n\s*done\.push\(\{ step: 'minutes', state: 'not asked', words: '' \}\);/);
  assert.equal(countOf(save, /\bsetVendorTag\(/g), 1);
  assert.match(save, /\} else if \(carries !== null\) \{\n\s*done\.push\(\{ step: 'tag', state: 'stands', words: instagramTagKey\(carries\) === instagramTagKey\(v\.tag\) \? TAG_SAME_WORDS\(v\.tag\) : TAG_STANDS_WORDS\(carries\) \}\);\n\s*\} else \{\n\s*const tagged = await setVendorTag\(onStop, v\.tag\);/, 'the tag only on a vendor that carries none');
  inOrder(save, [
    'rowTripInput(trip, draft.day)', 'pastedVendorOf(typed', 'expenseInput({ ...draft, vendorId, vendorName }, zone, new Date())', 'createStay(', 'createOneOff(oneOffBody(v))', 'readOneOffLine(created.value.routineId)',
    'setLineMinutes(line.value.lineId, v.minutes)', 'addVendor(v.bookId, v.vendor.name)', 'setVendor(vendorBody(v, line.value.lineId, onStop))', 'setVendorTag(onStop, v.tag)', 'setStopRecord(recordBody(v, line.value.lineId))',
    'setOutcome(done);', 'setDraft((d) => ({ ...EMPTY_EXPENSE, book: d.book }));', 'setVendorTyped(\'\');', 'setTrip(EMPTY_ROW_TRIP);', 'setReads((n) => n + 1);', 'onWritten(v.day);',
  ], 'the save');
  // Enter in a box saves; nothing is stored in the browser.
  assert.match(f, /const onKeyDown = \(e: KeyboardEvent<HTMLTableRowElement>\) => \{\n\s*if \(e\.key !== 'Enter'\) return;[\s\S]*?void save\(\);\n\s*\};/);
  assert.ok(f.includes('<tr className={`border-t border-border ${ROW_TINT}`} onKeyDown={onKeyDown} data-ledger-expense-form>'));
  assert.doesNotMatch(f, /localStorage|sessionStorage|indexedDB|document\.cookie/);
});

// ── T27 · THE SHARED TABLE'S ONE NEW PROP (rulings 3.1, 3.5) ─────────────────

test('T27 DataTable’s `first`: drawn before the rows shown; while given, the table stands once loaded with no row loaded; not given, the table draws what it drew; the time sheet alone passes it — the blank row, while "+ expense" is open', () => {
  const draw = (rows: readonly LedgerSheetRow[], first: ReactNode, loaded = true): string => renderToStaticMarkup(createElement(DataTable<LedgerSheetRow, LedgerColumn, ColumnFilters>, {
    name: 'ledger', columns: LEDGER_TABLE, rows, shown: rows, loaded, tableClassName: LEDGER_TABLE_CLASS, renderRow: (row: LedgerSheetRow) => createElement('tr', { key: row.key, 'data-ledger-row': row.key }), foot: null,
    filters: NO_COLUMN_FILTERS, onFilters: () => undefined, noFilters: NO_COLUMN_FILTERS, sort: null, onSort: () => undefined, openFilter: null, onOpenFilter: () => undefined, csv: null, controls: null, first,
  }));
  const body = (html: string): string => html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>') + '</tbody>'.length);
  const FIRST = createElement('tr', { 'data-sheet01-first': '' });
  const kayak = recordedRow('kayak', 'Pine Cove', 30, 20);
  assert.equal(body(draw([], FIRST)), '<tbody><tr data-sheet01-first=""></tr></tbody>', 'given, with no row loaded: the table stands, the blank row in its body');
  assert.equal(body(draw([kayak], FIRST)), `<tbody><tr data-sheet01-first=""></tr><tr data-ledger-row="${kayak.key}"></tr></tbody>`, 'drawn before the rows shown');
  assert.equal(body(draw([kayak], undefined)), `<tbody><tr data-ledger-row="${kayak.key}"></tr></tbody>`, 'not given: as it was');
  assert.doesNotMatch(draw([], undefined), /<table\b/, 'not given, no row loaded: no table, as it was');
  assert.doesNotMatch(draw([], FIRST, false), /<table\b/, 'not loaded: no table, given or not');
  // The source: one optional prop, destructured with the rest; the table's condition; the body.
  const t = code(TABLE);
  assert.match(t, /readonly children\?: ReactNode;\n\s*readonly first\?: ReactNode;\n\}/);
  assert.ok(t.includes('onOpenFilter, csv, controls, trailing, children, first } = props;'));
  assert.ok(t.includes('{loaded && (rows.length > 0 || first !== undefined) && ('));
  assert.match(t, /<tbody>\n\s*\{first\}\n\s*\{shown\.map\(renderRow\)\}\n\s*<\/tbody>/);
  // Every caller: the time sheet alone passes it.
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : n.endsWith('.tsx') ? [p] : []; });
  const callers = walk('src').filter((file) => /<DataTable\b/.test(code(file)));
  assert.ok(callers.includes(SECTION) && callers.length > 1, callers.join(', '));
  for (const file of callers) assert.equal(countOf(code(file), /\bfirst=\{/g), file === SECTION ? 1 : 0, file);
  // The section: `adding`, shut at first; the chip in the controls; the blank row handed in while open.
  const s = code(SECTION);
  assert.ok(s.includes("import ExpenseRow, { ExpenseOpen } from './ExpenseForm';"));
  assert.ok(s.includes('const [adding, setAdding] = useState(false);'));
  const mount = s.slice(s.indexOf('<DataTable'), s.indexOf('</DataTable>'));
  assert.ok(mount.includes('first={adding ? <ExpenseRow onWritten={(day) => { setWrites((n) => n + 1); announceDayWritten(day); }} close={() => setAdding(false)} /> : undefined}'));
  assert.ok(mount.includes('<ExpenseOpen open={adding} onToggle={() => setAdding((open) => !open)} />'));
  assert.equal(countOf(s, /<ExpenseRow\b/g), 1);
  assert.equal(countOf(s, /<ExpenseOpen\b/g), 1);
});
