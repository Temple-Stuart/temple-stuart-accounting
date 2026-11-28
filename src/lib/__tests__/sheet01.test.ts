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
 * reader law). Every place, trip, name, day, account and amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import * as ledgerRule from '../operations/ledger';
import { LEDGER_COLUMNS, NO_COLUMN_FILTERS, PLANNED_WORD, WENT_WORD, applyColumnFilters, cellWordsOf, ledgerTotals, minutesCellWords, type LedgerPlanRow, type LedgerRecording, type LedgerRow, type LedgerSheetRow } from '../operations/ledger';
import { TOOL_REGISTRY } from '../toolRegistry';
import { NOT_RECORDED_WORDS } from '../operations/stopRecord';
import { NOT_A_STOP_RECORD_WORDS } from '../operations/stopRole';
import { overlapWords, type StayRow } from '../operations/stay';
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
