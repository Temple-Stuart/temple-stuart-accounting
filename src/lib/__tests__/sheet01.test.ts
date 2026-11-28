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
import { BLANK } from '../budget/format';
import { PLANNED_WORD, WENT_WORD, cellWordsOf, type LedgerPlanRow, type LedgerRecording } from '../operations/ledger';
import { NOT_RECORDED_WORDS } from '../operations/stopRecord';
import { NOT_A_STOP_RECORD_WORDS } from '../operations/stopRole';
import {
  CHARGE_HAPPENED_WORDS, CHARGE_TOTAL_WORDS, NO_TOTAL_WORDS, ON_TIME_SHEET_KEYS, PASTE_READ_HEADS, PLANNED_AHEAD_WORDS,
  isChargePlacement, kindKeyOf, pasteShown, placePaste, readPaste, recordedWentWords,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement, type PasteShownRow,
} from '../operations/pasteRows';

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
