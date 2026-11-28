/**
 * TIMESHEET-04c, carried by COALEVELS-01 (Alex, 2026-11-27) — THE PASTE READS THE NOTES, THE TAG AND THE LOCATION, PLANS A STOP'S
 * ITEMS, CODES ITS ROWS AND ADDS TO THE CHART.
 *
 * TIMESHEET-04b gave the time sheet a vendor's Instagram tag, a plan's planned items and a record's notes; the paste read none of
 * the three. Here it does (src/lib/operations/pasteRows.ts): the Notes ride the record a row makes; the Items of a row that makes
 * no record are its stop's planned items, written with the stop's vendor for the day; the tag is set on the row's vendor, asked
 * last. On top of that: the Location is read, and a new one-off carries it; a kind's pick starts where its book's chart carries
 * its Category's name; and a save gives the chart a sub-account for each new one-off's Type, before any row (src/lib/operations/pasteSave.ts). The
 * writers (ledger/ledgerWrites.ts) gain the tag's and the chart's; the leaf (ledger/PasteRows.tsx) hands eight to the one runner
 * and gives where a row lands a line of its own.
 *
 * HERMETIC, on paste02.test.ts's model — no database, no network, and the only clock is the `now` handed in. The two rules are
 * DRIVEN directly over made-up rows; the runner over writers that record their calls and hold nothing; the writers file over a
 * stand-in fetch. Every name, day, account, tag and amount below is invented. The leaf and the vendor rule are anchored to their
 * source with comments stripped (the reader law). No pin here names a line number of any file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { BLANK } from '../budget/format';
import type { PlanLineVendor } from '../budget/planLines';
import { SUB_CODES_USED_UP_WORDS } from '../coa/subAccounts';
import { locationUnknownWords } from '../operations/locationClass';
import { instagramTagKey, readInstagramTag } from '../operations/planVendor';
import { NOTES_MAX, NOT_RECORDED_WORDS, type StopRecordRow } from '../operations/stopRecord';
import { PLANNED_WORD, oneOffBody, recordBody, type LedgerPlanRow, type LedgerRecording, type LedgerRow, type LedgerSheetRow } from '../operations/ledger';
import {
  CHART_NO_ACCOUNTS_WORDS, CHART_NO_SUB_ACCOUNTS_WORDS, ITEMS_EVERY_TIME_WORDS, ITEMS_NO_VENDOR_WORDS, ITEMS_OTHER_VENDOR_WORDS, NOTES_AHEAD_WORDS, NOTES_CELL_CONTROL_WORDS, NOTES_CELL_LONG_WORDS,
  NOTES_NO_TOTAL_WORDS, PASTE_ADDS_WORDS, PASTE_NO_COLUMN_HEADS, PASTE_PICKS_WORDS, PASTE_READ_HEADS, PASTE_REQUIRED_HEADS, PLANNED_ITEMS_SET_WORDS, RECORDED_NOT_WRITTEN_WORDS, TAG_NO_VENDOR_WORDS,
  TAG_VENDOR_NOT_ADDED_WORDS, TOTAL_AHEAD_WORDS, VENDORS_NO_LIST_WORDS, YOUR_SHEET_COLUMNS,
  chartAddWords, chartAddsOf, chartOf, itemsStandWords, kindKeyOf, locationStandsWords, namedPicksOf, noStopWords, pasteKindsOf, pasteShown, picksAtRead, placePaste, readPaste, subAccountsOf, subAccountsUnreadWords,
  tagSetWords, tagStandsWords, tagTakenWords, vendorNotWrittenWords, vendorsOf,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement, type PasteRow, type PasteSubAccount, type PasteVendor,
} from '../operations/pasteRows';
import {
  NOTHING_TO_SAVE_WORDS, PASTE_STEPS, PASTE_STEP_WORDS,
  addOutcomeWords, pasteAddsOf, pasteOutcomeWords, pasteWritesOf, runPaste, runStopped, runWords, saveWords,
  type PasteProgress, type PasteStep, type PasteWrite, type PasteWriters,
} from '../operations/pasteSave';

import { addSubAccount, setVendor, setVendorTag } from '@/components/workbench/operations/ledger/ledgerWrites';

const RULES = 'src/lib/operations/pasteRows.ts';
const SAVE = 'src/lib/operations/pasteSave.ts';
const LEAF = 'src/components/workbench/operations/ledger/PasteRows.tsx';
const VENDOR_RULE = 'src/lib/operations/planVendor.ts';

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

// ── THE PASTE — a sheet's rows as it copies them, every cell made up ─────────

const TAB = '\t';
type Typed = Partial<Record<PasteHead, string>>;
const lineOf = (heads: readonly PasteHead[], typed: Typed): string => heads.map((head) => (head in typed ? typed[head] : '')).join(TAB);
/** The sheet's text under the heads given — all fourteen, unless a test leaves some out. */
const sheetText = (rows: readonly Typed[], heads: readonly PasteHead[] = PASTE_READ_HEADS): string => [heads.join(TAB), ...rows.map((row) => lineOf(heads, row))].join('\n');
/** A paste that is read — or the test fails with the refusal's words. */
const pasteOf = (...rows: readonly Typed[]): Paste => {
  const read = readPaste(sheetText(rows));
  if (!read.ok) return assert.fail(`refused: ${read.words}`);
  return read.value;
};
/** The one row of a one-row paste, read — or the test fails with what it is. */
const readRowOf = (typed: Typed): Extract<PasteRow, { readonly kind: 'read' }> => {
  const row = pasteOf(typed).rows[0];
  if (row.kind !== 'read') return assert.fail(`the row is ${row.kind}${row.kind === 'refused' ? ` — ${row.head}: ${row.why}` : ''}`);
  return row;
};
/** The one row of a one-row paste, refused: the head it is refused on, and why. */
const refusedRowOf = (typed: Typed): [string, string] => {
  const row = pasteOf(typed).rows[0];
  if (row.kind !== 'refused') return assert.fail(`the row is ${row.kind}`);
  return [row.head, row.why];
};

// ── THE PAGE'S OWN — books, the time sheet's rows, charts and vendors, all made up ──

const NBO = 'Africa/Nairobi'; // three hours ahead of UTC the year round
const SUN = '2027-06-13';
const MON = '2027-06-14';
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();
/** Monday noon in the zone: Sunday is past, Monday's 12:30 is half an hour ahead. (A row typed 6/12/27 is the Saturday before — a day the time sheet here holds no stop on.) */
const NOW = new Date('2027-06-14T09:00:00.000Z');

/** A plan row of the sheet — a priced stop with no record on it — at a line's address. It says no vendor, no tag, no Location and nothing planned to be had, unless a test says so. */
const planned = (id: string, day: string, clock: string, name: string, over: Partial<LedgerPlanRow> = {}): LedgerPlanRow => ({
  id: null, key: `routine_line:${id}:${at(day, clock)}`, address: { kind: 'routine_line', id, instant: at(day, clock) }, match: null, day, time: clock,
  place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: name, rating: null, note: null, plannedItems: null, notes: null,
  cents: 650, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: 30, loggedMinutes: null, allDay: false, went: NOT_RECORDED_WORDS, ...over,
});
/** A record as the stops GET answers one, and the recorded row that holds it. */
const recordOf = (id: string, target: string, day: string, clock: string, over: Partial<StopRecordRow> = {}): StopRecordRow => ({
  id, kind: 'routine_line', target_id: target, occurrence_at: at(day, clock), outcome: 'done', done_at: at(day, clock), actual_cents: 1500, rating: null, note: 'the set menu', notes: null, actual_minutes: null, ...over,
});
const recorded = (record: StopRecordRow, day: string, clock: string, name: string, over: Partial<LedgerRow> = {}): LedgerRow => ({
  id: record.id, key: `routine_line:${record.target_id}:${at(day, clock)}`, address: { kind: 'routine_line', id: record.target_id, instant: at(day, clock) }, match: null, day, time: clock,
  place: null, book: 'Personal', location: null, segments: { entity: 'P', location: null, category: '6150', type: null, code: 'P-6150' }, coa: { account: 'P-6150', name: 'Dining Out' }, vendor: null, instagramTag: null, description: name, rating: record.rating, note: record.note, notes: record.notes,
  cents: 1500, budgetState: 'matched', outcome: record.outcome, actualCents: record.actual_cents, varianceCents: null, plannedMinutes: null, loggedMinutes: record.actual_minutes, ...over,
});
/** The vendor a plan line names: for this day alone ('occurrence'), or every time ('every'). */
const lineVendor = (id: string, name: string, grain: PlanLineVendor['grain']): PlanLineVendor => ({ id, name, entityId: 'P', grain });
/** A sheet row's entry: it takes a record, planned at its own instant; the record it holds; and its vendor slot — none, or the day card's box on a plan line that names the vendor. */
const entryOf = (row: LedgerSheetRow, held: StopRecordRow | null = null, vendor: PlanLineVendor | null = null): LedgerRecording => ({
  takes: true, plannedAt: row.address.instant, held,
  vendor: vendor === null ? { kind: 'none' } : {
    kind: 'box',
    line: { entityId: 'P', code: '6150', day: row.day, cents: 650, source: 'routine', label: row.description, line: row.description, time: row.time, address: { kind: row.address.kind, id: row.address.id, instant: row.address.instant }, vendor, superseded: null },
  },
});

/** Sunday's stops, and Monday's two that are still ahead. */
const SWIM_SUN = planned('line-swim', SUN, '07:00', 'Swim', { vendor: 'Bean Bar' }); // prints a vendor — and its entry's slot holds none
const WALK_SUN = planned('line-walk', SUN, '09:00', 'Walk', { location: 'homebase', segments: { entity: 'P', location: 'HOM', category: '6150', type: null, code: 'P-HOM-6150' } });
const SOUP_SUN = planned('line-soup', SUN, '12:30', 'Soup');
const TEA_SUN = planned('line-tea', SUN, '16:00', 'Tea', { vendor: 'Bean Bar' }); // its vendor for the day stands, and it plans no items
const CAKE_SUN = planned('line-cake', SUN, '17:00', 'Cake', { vendor: 'Bean Bar' }); // its vendor is planned every time
const DINNER_RECORD = recordOf('rec-dinner', 'line-dinner', SUN, '19:00', { notes: 'a long table by the door' });
const DINNER_SUN = recorded(DINNER_RECORD, SUN, '19:00', 'Dinner', { vendor: 'Oat House' });
const SOUP_MON = planned('line-soup', MON, '12:30', 'Soup', { went: PLANNED_WORD });
const TEA_MON = planned('line-tea', MON, '16:00', 'Tea', { went: PLANNED_WORD, vendor: 'Bean Bar', plannedItems: 'one pot of mint' }); // …and already plans items
const SHEET: readonly LedgerSheetRow[] = [SWIM_SUN, WALK_SUN, SOUP_SUN, TEA_SUN, CAKE_SUN, DINNER_SUN, SOUP_MON, TEA_MON];
const RECORDING: Readonly<Record<string, LedgerRecording>> = {
  [SWIM_SUN.key]: entryOf(SWIM_SUN),
  [WALK_SUN.key]: entryOf(WALK_SUN),
  [SOUP_SUN.key]: entryOf(SOUP_SUN),
  [TEA_SUN.key]: entryOf(TEA_SUN, null, lineVendor('v-bean', 'Bean Bar', 'occurrence')),
  [CAKE_SUN.key]: entryOf(CAKE_SUN, null, lineVendor('v-bean', 'Bean Bar', 'every')),
  [DINNER_SUN.key]: entryOf(DINNER_SUN, DINNER_RECORD, lineVendor('v-oat', 'Oat House', 'occurrence')),
  [SOUP_MON.key]: entryOf(SOUP_MON),
  [TEA_MON.key]: entryOf(TEA_MON, null, lineVendor('v-bean', 'Bean Bar', 'occurrence')),
};

const BOOKS = [{ id: 'P', name: 'Home', entityType: 'personal' }, { id: 'B', name: 'Shop', entityType: 'sole_prop' }];
const CHARTS = { P: [{ id: 'acct-6150', code: '6150', name: 'Dining Out' }, { id: 'acct-6200', code: '6200', name: 'Recreation' }], B: [{ id: 'acct-6400', code: '6400', name: 'Supplies' }] };
const OAT: PasteVendor = { id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P', instagram_tag: null };
const BEAN: PasteVendor = { id: 'v-bean', vendor_name: 'Bean Bar', entity_id: 'P', instagram_tag: 'Bean.Bar' };
const INK: PasteVendor = { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B', instagram_tag: null };
const CONTEXT: PasteContext = { books: BOOKS, sheet: SHEET, recording: RECORDING, charts: CHARTS, subAccounts: { P: [], B: [] }, vendors: [OAT, BEAN, INK], zone: NBO, now: NOW };

const ON_PLAN = (plan: string): PastePick => ({ kind: 'plan', plan });
const ONE_OFF = (account: string): PastePick => ({ kind: 'oneOff', code: account });
const kindOf = (category: string, type: string, entity = 'Personal'): string => kindKeyOf({ entity, category, type });
/** A paste placed, every row's kind given the one pick handed in. */
const placedWith = (paste: Paste, pick: PastePick, context: PasteContext = CONTEXT): PastePlacement[] => {
  const picks: Record<string, PastePick> = {};
  for (const row of paste.rows) if (row.kind === 'read') picks[kindKeyOf(row.cells)] = pick;
  return placePaste(paste, picks, context);
};
/** One row, placed with its pick: its placement, where it lands in words, and what it writes. */
const landed = (typed: Typed, pick: PastePick, context: PasteContext = CONTEXT) => {
  const paste = pasteOf(typed);
  const placements = placedWith(paste, pick, context);
  return { paste, placement: placements[0], lands: pasteShown(paste, placements)[0].lands, writes: pasteWritesOf(paste.rows, placements) };
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

/** A past soup, on a plan's stop — its Items, its Notes, its vendor and the vendor's tag all typed. */
const SOUP: Typed = { 'Start Date': '6/13/27', 'Start Time': '12:30 PM', Category: 'Dining Out', Entity: 'Personal', Type: 'Soup', Items: 'two bowls', Notes: 'sat by the window', Vendor: 'Oat House', 'Instagram Tag': '@oat.house', 'Total (USD)': '6.90' };
/** The same soup with only its Items and its vendor — a row that plans. */
const SOUP_PLAN: Typed = { ...SOUP, Notes: '', 'Instagram Tag': '', 'Total (USD)': '' };
/** A past tea with only its Items — on a stop whose vendor for the day already stands. */
const TEA: Typed = { 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Tea', Items: 'a pot of mint' };
/** A past dinner that says what its stop's record says. */
const DINNER: Typed = { 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Dinner', Items: 'the set menu', Notes: 'a long table by the door', 'Total (USD)': '15' };
/** A past evening out of a kind picked a one-off — nothing of its name on the time sheet. */
const BOWLING: Typed = { 'Start Date': '6/13/27', 'Start Time': '8:00 PM', 'End Time': '9:30 PM', Location: 'Travel', Category: 'Recreation', Entity: 'Personal', Type: 'Bowling', Items: 'two games', Notes: 'lane four', Vendor: 'Pin Palace', 'Instagram Tag': 'pin_palace', 'Total (USD)': '18', 'Budget (USD)': '20' };
/** A second Type under the same account, later the same evening. */
const DARTS: Typed = { ...BOWLING, Type: 'Darts', 'Start Time': '10:00 PM', 'End Time': '', Items: '', Notes: '' };

// ── THE WRITERS — stand-ins that record their calls and hold nothing ─────────

/** What a writer is asked to refuse with: the route's own words. */
type Refusals = Partial<Record<PasteStep, string>>;
/** Each answers as its route would — ids made up, in the order asked — unless `refuse` names its step. */
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
    setVendorTag: async (vendorId, tag) => { calls.push(['setVendorTag', vendorId, tag]); return refuse.tag !== undefined ? no('tag') : { ok: true, value: null }; },
    addSubAccount: async (accountId, name, subCode) => { calls.push(['addSubAccount', accountId, name, subCode]); return refuse['sub-account'] !== undefined ? no('sub-account') : { ok: true, value: null }; },
    setRecord: async (body) => { calls.push(['setRecord', body]); return refuse.record !== undefined ? { ok: false, message: refuse.record } : { ok: true }; },
  };
  return { calls, writers };
}
const names = (calls: readonly (readonly [string, ...unknown[]])[]): string[] => calls.map((call) => call[0]);
/** The one call a writer got — or the test fails with how many it got. */
const callOf = (calls: readonly (readonly [string, ...unknown[]])[], name: string): readonly [string, ...unknown[]] => {
  const got = calls.filter((call) => call[0] === name);
  if (got.length !== 1) return assert.fail(`${name} was called ${got.length} times`);
  return got[0];
};
/** One row's writes run through recording writers: the calls, and how the row came out. */
const ran = async (typed: Typed, pick: PastePick, refuse: Refusals = {}, context: PasteContext = CONTEXT) => {
  const { writes } = landed(typed, pick, context);
  const { calls, writers } = recorder(refuse);
  const outcomes = await runPaste(writes, writers, () => undefined, []);
  return { writes, calls, outcome: outcomes[0] };
};

// ── T1 · THE COLUMNS (ruling A) ──────────────────────────────────────────────

test('T1 the columns: the fourteen read and the two with no column, in order; a row reads its tag without the @ and prints it as typed, and its notes cleaned; a paste whose header carries neither reads none; what is no tag refuses the row on Instagram Tag in the tag rule’s own words; a control character and 2001 characters of Notes are refused on Notes, 2000 are read', () => {
  assert.deepEqual([...PASTE_READ_HEADS], ['Start Date', 'Start Time', 'End Time', 'Location', 'Category', 'Entity', 'Type', 'Items', 'Notes', 'Vendor', 'Instagram Tag', 'Total (USD)', 'Budget (USD)', 'Days']);
  assert.deepEqual([...PASTE_NO_COLUMN_HEADS], ['Currency', 'Total']);
  // A row: the tag as the directory would keep it — no @ — and as he typed it; the notes cleaned.
  const row = readRowOf({ ...SOUP, 'Instagram Tag': '  @oat.house ', Notes: '  sat   by the   window ' });
  assert.deepEqual([row.cells.tag, row.typed.tag, row.cells.notes, row.typed.notes], ['oat.house', '@oat.house', 'sat by the window', 'sat by the window']);
  assert.equal(readRowOf({ ...SOUP, 'Instagram Tag': 'oat.house' }).cells.tag, 'oat.house', 'typed with no @: the same tag');
  assert.equal(readRowOf({ ...SOUP, 'Instagram Tag': '@Oat.House' }).cells.tag, 'Oat.House', 'kept as typed — nothing is lower-cased');
  // Blank cells: none of either.
  const bare = readRowOf({ ...SOUP, 'Instagram Tag': '', Notes: '' });
  assert.deepEqual([bare.cells.tag, bare.typed.tag, bare.cells.notes, bare.typed.notes], [null, '', null, '']);
  // A paste whose header carries neither column reads none, and refuses nothing.
  const without = readPaste(sheetText([SOUP], PASTE_READ_HEADS.filter((head) => head !== 'Notes' && head !== 'Instagram Tag')));
  assert.ok(without.ok);
  const lean = without.value.rows[0];
  assert.ok(lean.kind === 'read');
  assert.deepEqual([lean.cells.tag, lean.cells.notes, lean.typed.tag, lean.typed.notes, lean.cells.items, lean.cells.vendor], [null, null, '', '', 'two bowls', 'Oat House']);
  assert.deepEqual([...PASTE_REQUIRED_HEADS], ['Start Date', 'Category', 'Entity', 'Type', 'Vendor'], 'neither is a required head');
  // What is no tag refuses the row, on Instagram Tag, in the directory's own rule's message.
  const noTag = readInstagramTag('oat house!');
  assert.ok(!noTag.ok);
  assert.deepEqual(refusedRowOf({ ...SOUP, 'Instagram Tag': 'oat house!' }), ['Instagram Tag', noTag.message]);
  assert.equal(noTag.message, 'an Instagram tag is letters, digits, dots and underscores, 30 at most — "oat house!" is not one');
  assert.equal(refusedRowOf({ ...SOUP, 'Instagram Tag': `@${'t'.repeat(31)}` })[0], 'Instagram Tag');
  // The Notes, read as the Items are: a control character, and one character over the record's own bound.
  assert.deepEqual(refusedRowOf({ ...SOUP, Notes: 'sat by\u0007the window' }), ['Notes', NOTES_CELL_CONTROL_WORDS]);
  assert.deepEqual(refusedRowOf({ ...SOUP, Notes: 'n'.repeat(NOTES_MAX + 1) }), ['Notes', NOTES_CELL_LONG_WORDS]);
  assert.deepEqual([NOTES_CELL_CONTROL_WORDS, NOTES_CELL_LONG_WORDS, NOTES_MAX], ['Notes holds a control character', 'Notes is at most 2000 characters on a row', 2000]);
  assert.equal(readRowOf({ ...SOUP, Notes: 'n'.repeat(NOTES_MAX) }).cells.notes?.length, 2000);
  // The first cell that cannot be read is the one named: the Items before the Notes, the Notes before the tag.
  assert.equal(refusedRowOf({ ...SOUP, Items: 'two\u0007bowls', Notes: 'n'.repeat(NOTES_MAX + 1) })[0], 'Items');
  assert.equal(refusedRowOf({ ...SOUP, Notes: 'n'.repeat(NOTES_MAX + 1), 'Instagram Tag': 'oat house!' })[0], 'Notes');
});

// ── T2 · THE DIRECTORY'S ANSWER (ruling A.4) ─────────────────────────────────

test('T2 vendorsOf reads each vendor’s tag — text, or none; an entry without the key, or holding a number there, is not the directory’s answer', () => {
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P', instagram_tag: 'oat.house', category: null }, { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B', instagram_tag: null }] }), {
    ok: true, vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P', instagram_tag: 'oat.house' }, { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B', instagram_tag: null }],
  });
  const refused = { ok: false, words: VENDORS_NO_LIST_WORDS };
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P' }] }), refused, 'an entry without the key');
  assert.deepEqual(vendorsOf({ vendors: [{ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P', instagram_tag: 7 }] }), refused, 'a number is neither text nor none');
  assert.deepEqual(vendorsOf({ vendors: [OAT, { id: 'v-ink', vendor_name: 'Ink Works', entity_id: 'B', instagram_tag: false }] }), refused, 'one bad entry refuses the list');
});

// ── T3 · THE NOTES RIDE THE RECORD (ruling B.1) ──────────────────────────────

test('T3 the notes: a row that went carries them into what happened and into the record’s body — on a stop that stands, and on a new one-off; a stop still ahead, and a row with no Total (USD), each say them, after the Total’s sentence; a record that stands is quiet when it says the row’s amount, line and notes, and said when the notes alone differ', async () => {
  // On a stop that stands: what happened holds them, and so does the record form's own body.
  const went = onStop(landed(SOUP, ON_PLAN('Soup')).placement);
  assert.deepEqual(went.happened, { kind: 'went', cents: 690, items: 'two bowls', notes: 'sat by the window' });
  assert.deepEqual(went.record, { kind: 'routine_line', id: 'line-soup', instant: at(SUN, '12:30'), outcome: 'done', done_at: at(SUN, '12:30'), actual_cents: 690, rating: null, note: 'two bowls', notes: 'sat by the window', actual_minutes: null });
  assert.deepEqual(went.notWritten, []);
  const bare = onStop(landed({ ...SOUP, Notes: '' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([bare.happened, bare.record === null ? 'no record' : bare.record.notes], [{ kind: 'went', cents: 690, items: 'two bowls', notes: null }, null], 'no Notes typed: the body says none');
  // On a new one-off: what happened holds them, the write carries them, and the runner sends them on the record — "+ expense"'s own body holds none.
  const fresh = landed(BOWLING, ONE_OFF('6200'));
  const bowling = oneOff(fresh.placement);
  assert.deepEqual(bowling.happened, { kind: 'went', cents: 1800, items: 'two games', notes: 'lane four' });
  const write = fresh.writes[0];
  assert.ok(write.kind === 'oneOff');
  assert.deepEqual([write.went, write.notes], [true, 'lane four']);
  assert.equal(recordBody(bowling.values, 'line-of-rt-1').notes, null, '"+ expense" has no NOTES box');
  const { calls, writers } = recorder();
  await runPaste(fresh.writes, writers, () => undefined, []);
  assert.deepEqual(callOf(calls, 'setRecord'), ['setRecord', { ...recordBody(bowling.values, 'line-of-rt-1'), notes: 'lane four' }]);
  // A one-off that makes no record carries none, and says its Notes.
  const noTotal = landed({ ...BOWLING, 'Total (USD)': '' }, ONE_OFF('6200'));
  const unrecorded = noTotal.writes[0];
  assert.ok(unrecorded.kind === 'oneOff');
  assert.deepEqual([unrecorded.went, unrecorded.notes, oneOff(noTotal.placement).notWritten], [false, null, [NOTES_NO_TOTAL_WORDS]]);
  // A stop still ahead: the Total (USD), then the Notes — each said only if typed. A past row with no Total (USD): its Notes.
  const ahead = onStop(landed({ ...SOUP, 'Start Date': '6/14/27' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([ahead.happened, ahead.record, ahead.notWritten], [{ kind: 'planned' }, null, [TOTAL_AHEAD_WORDS, NOTES_AHEAD_WORDS]]);
  assert.deepEqual(onStop(landed({ ...SOUP, 'Start Date': '6/14/27', 'Total (USD)': '' }, ON_PLAN('Soup')).placement).notWritten, [NOTES_AHEAD_WORDS]);
  assert.deepEqual(onStop(landed({ ...SOUP, 'Start Date': '6/14/27', Notes: '' }, ON_PLAN('Soup')).placement).notWritten, [TOTAL_AHEAD_WORDS]);
  const past = onStop(landed({ ...SOUP, 'Total (USD)': '' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([past.happened, past.record, past.notWritten], [{ kind: 'not recorded' }, null, [NOTES_NO_TOTAL_WORDS]]);
  assert.deepEqual([TOTAL_AHEAD_WORDS, NOTES_AHEAD_WORDS, NOTES_NO_TOTAL_WORDS], [
    'Total (USD) — not written: the stop is still ahead', 'Notes — not written: the stop is still ahead — notes sit on its record', 'Notes — not written: the row holds no Total (USD), so no record is made',
  ]);
  // A RECORD THAT STANDS is kept. Quiet when it says the row's amount, its line and its notes…
  const same = onStop(landed(DINNER, ON_PLAN('Dinner')).placement);
  assert.deepEqual([same.happened, same.record, same.items, same.notWritten], [{ kind: 'recorded' }, null, null, []]);
  // …said when the notes alone differ — another text, or none typed where the record holds some.
  assert.deepEqual(onStop(landed({ ...DINNER, Notes: 'a table outside' }, ON_PLAN('Dinner')).placement).notWritten, [RECORDED_NOT_WRITTEN_WORDS]);
  assert.deepEqual(onStop(landed({ ...DINNER, Notes: '' }, ON_PLAN('Dinner')).placement).notWritten, [RECORDED_NOT_WRITTEN_WORDS]);
  assert.equal(RECORDED_NOT_WRITTEN_WORDS, 'Total (USD), Items, Notes — not written: this stop is already recorded — the paste does not write over a record');
  // None is equal to none: a record with no notes is quiet for a row with none, and said for a row that types some — even alone.
  const noNotes: PasteContext = { ...CONTEXT, recording: { ...RECORDING, [DINNER_SUN.key]: entryOf(DINNER_SUN, { ...DINNER_RECORD, notes: null }) } };
  assert.deepEqual(onStop(landed({ ...DINNER, Notes: '' }, ON_PLAN('Dinner'), noNotes).placement).notWritten, []);
  assert.deepEqual(onStop(landed({ 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Dinner', Notes: 'a table outside' }, ON_PLAN('Dinner'), noNotes).placement).notWritten, [RECORDED_NOT_WRITTEN_WORDS]);
  // A row that holds none of the three says nothing of a record that stands.
  assert.deepEqual(onStop(landed({ 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Dinner' }, ON_PLAN('Dinner')).placement).notWritten, []);
});

// ── T4 · THE PLANNED ITEMS, ON A STOP THAT STANDS (ruling B.2) ───────────────

test('T4 the Items of a row that makes no record are its stop’s planned items: written with the vendor the row plans — ahead, and past with no Total (USD); no vendor, said; on the vendor that stands when the row names none or the same one; the same words quiet, other words said; a vendor planned every time said; another vendor named, both sentences; a row that went writes none; a stop that prints a vendor with no slot throws', () => {
  // The stop has no vendor planned, and the row plans one: the items are written WITH that vendor — the book's own, or one new to it.
  const ahead = landed({ ...SOUP_PLAN, 'Start Date': '6/14/27' }, ON_PLAN('Soup'));
  assert.deepEqual([onStop(ahead.placement).happened, onStop(ahead.placement).vendor, onStop(ahead.placement).items, onStop(ahead.placement).notWritten], [{ kind: 'planned' }, { kind: 'own', id: 'v-oat', name: 'Oat House' }, 'two bowls', []]);
  assert.equal(ahead.lands, `on "Soup", its 12:30 stop · vendor: Personal's own · planned: still ahead · ${PLANNED_ITEMS_SET_WORDS}`);
  const past = landed(SOUP_PLAN, ON_PLAN('Soup'));
  assert.deepEqual([onStop(past.placement).happened, onStop(past.placement).vendor, onStop(past.placement).items, onStop(past.placement).notWritten], [{ kind: 'not recorded' }, { kind: 'own', id: 'v-oat', name: 'Oat House' }, 'two bowls', []]);
  assert.equal(past.lands, 'on "Soup", its 12:30 stop · vendor: Personal\'s own · not recorded: no Total (USD) · items: planned');
  const added = onStop(landed({ ...SOUP_PLAN, Vendor: 'Fern Room' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([added.vendor, added.items], [{ kind: 'new', name: 'Fern Room' }, 'two bowls']);
  // The row names no vendor: there is none to plan them with — said.
  const none = onStop(landed({ ...SOUP_PLAN, Vendor: '' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([none.vendor, none.items, none.notWritten], [{ kind: 'none' }, null, [ITEMS_NO_VENDOR_WORDS]]);
  // The stop's vendor for the day stands, and it plans nothing yet: the items are written on THAT vendor — the row naming none, or the same one. Nothing of the vendor is written, and nothing is said of it.
  const standing = { kind: 'standing', id: 'v-bean', name: 'Bean Bar' };
  const unnamed = landed(TEA, ON_PLAN('Tea'));
  assert.deepEqual([onStop(unnamed.placement).vendor, onStop(unnamed.placement).items, onStop(unnamed.placement).notWritten], [standing, 'a pot of mint', []]);
  assert.equal(unnamed.lands, 'on "Tea", its 16:00 stop · not recorded: no Total (USD) · items: planned');
  const renamed = onStop(landed({ ...TEA, Vendor: 'bean  BAR' }, ON_PLAN('Tea')).placement);
  assert.deepEqual([renamed.vendor, renamed.items, renamed.notWritten], [standing, 'a pot of mint', []]);
  // The stop already plans items: the same words are quiet and nothing is written; other words are said.
  const quiet = onStop(landed({ ...TEA, 'Start Date': '6/14/27', Items: 'one pot of mint' }, ON_PLAN('Tea')).placement);
  assert.deepEqual([quiet.vendor, quiet.items, quiet.notWritten], [{ kind: 'none' }, null, []]);
  const other = onStop(landed({ ...TEA, 'Start Date': '6/14/27', Items: 'two pots' }, ON_PLAN('Tea')).placement);
  assert.deepEqual([other.vendor, other.items, other.notWritten], [{ kind: 'none' }, null, [itemsStandWords('one pot of mint')]]);
  assert.equal(itemsStandWords('one pot of mint'), 'Items — not written: this stop already plans "one pot of mint" — the paste does not change planned items');
  // A vendor planned EVERY time: planned items for one day sit with a vendor for that day — said.
  const every = onStop(landed({ ...TEA, Type: 'Cake', Items: 'a slice' }, ON_PLAN('Cake')).placement);
  assert.deepEqual([every.vendor, every.items, every.notWritten], [{ kind: 'none' }, null, [ITEMS_EVERY_TIME_WORDS]]);
  // Another vendor named: the Items' sentence, then the vendor's own.
  const another = onStop(landed({ ...TEA, Vendor: 'Oat House' }, ON_PLAN('Tea')).placement);
  assert.deepEqual([another.vendor, another.items, another.notWritten], [{ kind: 'none' }, null, [ITEMS_OTHER_VENDOR_WORDS, vendorNotWrittenWords('Bean Bar')]]);
  // A row that went writes none: its Items are its record's line.
  const went = onStop(landed({ ...TEA, 'Total (USD)': '4' }, ON_PLAN('Tea')).placement);
  assert.deepEqual([went.happened, went.items, went.vendor, went.record === null ? null : went.record.note, went.notWritten], [{ kind: 'went', cents: 400, items: 'a pot of mint', notes: null }, null, { kind: 'none' }, 'a pot of mint', []]);
  // A stop that prints a vendor, and whose entry's slot holds none, is the rule's error — thrown by name, never guessed around.
  assert.throws(() => landed({ ...TEA, Type: 'Swim', Items: 'a towel' }, ON_PLAN('Swim')), /pasteRows: the stop "routine_line:line-swim:[^"]+" prints the vendor "Bean Bar", and its entry's vendor slot holds none/);
  // …and only when the row has items to plan there: the same row with none is placed.
  assert.equal(landed({ ...TEA, Type: 'Swim', Items: '' }, ON_PLAN('Swim')).placement.kind, 'plan');
  // The four sentences, each typed once.
  assert.deepEqual([ITEMS_NO_VENDOR_WORDS, ITEMS_EVERY_TIME_WORDS, ITEMS_OTHER_VENDOR_WORDS], [
    "Items — not written: this row makes no record, so its Items are planned items — and planned items sit with the stop's vendor for the day: the stop has none, and the row names none",
    "Items — not written: this stop's vendor is planned every time — planned items for one day sit with a vendor for that day",
    "Items — not written: they are planned with the row's Vendor, which is not written",
  ]);
});

// ── T5 · THE PLANNED ITEMS, ON A NEW ONE-OFF (ruling B.2) ────────────────────

test('T5 a new one-off that makes no record plans its Items with the vendor it names; with no vendor they are said; a one-off that went writes none — its Items are its record’s line', () => {
  const planning = landed({ ...BOWLING, Notes: '', 'Instagram Tag': '', 'Total (USD)': '' }, ONE_OFF('6200'));
  const past = oneOff(planning.placement);
  assert.deepEqual([past.happened, past.vendor, past.items, past.notWritten], [{ kind: 'not recorded' }, { kind: 'new', name: 'Pin Palace' }, 'two games', []]);
  assert.equal(planning.lands, 'a one-off at 20:00, under P-6200 Recreation · vendor: new to Personal · not recorded: no Total (USD) · items: planned');
  // Still ahead: planned with its vendor, and the Total (USD) said.
  const ahead = oneOff(landed({ ...BOWLING, 'Start Date': '6/14/27', Notes: '', 'Instagram Tag': '' }, ONE_OFF('6200')).placement);
  assert.deepEqual([ahead.happened, ahead.items, ahead.notWritten], [{ kind: 'planned' }, 'two games', [TOTAL_AHEAD_WORDS]]);
  // No vendor: none to plan them with — the Items' sentence stands first.
  const alone = oneOff(landed({ ...BOWLING, Vendor: '', 'Instagram Tag': '', 'Total (USD)': '' }, ONE_OFF('6200')).placement);
  assert.deepEqual([alone.vendor, alone.items, alone.notWritten], [{ kind: 'none' }, null, [ITEMS_NO_VENDOR_WORDS, NOTES_NO_TOTAL_WORDS]]);
  // Went: no planned items — the Items are the record's line, in "+ expense"'s own values.
  const went = oneOff(landed(BOWLING, ONE_OFF('6200')).placement);
  assert.deepEqual([went.happened.kind, went.items, went.values.note], ['went', null, 'two games']);
});

// ── T6 · THE TAG (ruling B.3) ────────────────────────────────────────────────

test('T6 the tag is its vendor’s, asked last: set on the book’s own by its id, and on the vendor the row adds with no id; the same handle in another case is quiet; another handle is said and not written; a second row of the paste is quiet with the same handle and said with another, naming the first row; no Vendor is said; a vendor new to the book that the row does not add is said; a recorded stop still sets it, and is a write for it alone; a refused row gives none', async () => {
  // The book's own, by its id.
  const own = landed(SOUP, ON_PLAN('Soup'));
  assert.deepEqual([onStop(own.placement).tag, onStop(own.placement).notWritten], [{ vendorId: 'v-oat', tag: 'oat.house' }, []]);
  assert.equal(own.lands, `on "Soup", its 12:30 stop · vendor: Personal's own · ${tagSetWords('oat.house')} · recorded: went, $6.90`);
  assert.equal(tagSetWords('oat.house'), 'tag: @oat.house');
  // The vendor THIS row adds: no id yet — the add answers it.
  const added = oneOff(landed(BOWLING, ONE_OFF('6200')).placement);
  assert.deepEqual([added.vendor, added.tag, added.notWritten], [{ kind: 'new', name: 'Pin Palace' }, { vendorId: null, tag: 'pin_palace' }, []]);
  // A tag that stands is never written over: the same handle — in any case — is quiet; another is said.
  assert.equal(instagramTagKey('Bean.Bar'), instagramTagKey('bean.BAR'));
  const sameHandle = onStop(landed({ ...SOUP, Vendor: 'Bean Bar', 'Instagram Tag': '@bean.bar' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([sameHandle.vendor, sameHandle.tag, sameHandle.notWritten], [{ kind: 'own', id: 'v-bean', name: 'Bean Bar' }, null, []]);
  const otherHandle = onStop(landed({ ...SOUP, Vendor: 'Bean Bar', 'Instagram Tag': '@beans' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([otherHandle.tag, otherHandle.notWritten], [null, [tagStandsWords('Bean Bar', 'Bean.Bar')]]);
  assert.equal(tagStandsWords('Bean Bar', 'Bean.Bar'), 'Instagram Tag — not written: "Bean Bar" already carries @Bean.Bar — the paste does not change a tag');
  // Two rows of one paste give one vendor a tag once: the second is quiet with the same handle, and said with another — naming the first row.
  const paste = pasteOf(SOUP, { ...SOUP_PLAN, 'Start Date': '6/14/27', Vendor: 'oat  HOUSE', 'Instagram Tag': 'OAT.HOUSE' }, { ...BOWLING, Vendor: 'Oat House', 'Instagram Tag': 'oats', Notes: '' });
  const placements = placePaste(paste, { [kindOf('Dining Out', 'Soup')]: ON_PLAN('Soup'), [kindOf('Recreation', 'Bowling')]: ONE_OFF('6200') }, CONTEXT);
  assert.deepEqual([onStop(placements[0]).tag, onStop(placements[1]).tag, oneOff(placements[2]).tag], [{ vendorId: 'v-oat', tag: 'oat.house' }, null, null]);
  assert.deepEqual([onStop(placements[1]).notWritten, oneOff(placements[2]).notWritten], [[], [tagTakenWords(2, 'oat.house')]]);
  assert.equal(tagTakenWords(2, 'oat.house'), 'Instagram Tag — not written: row 2 of the paste gives this vendor @oat.house');
  // No Vendor: said.
  const noVendor = onStop(landed({ ...SOUP, Vendor: '', Items: '' }, ON_PLAN('Soup')).placement);
  assert.deepEqual([noVendor.tag, noVendor.notWritten], [null, [TAG_NO_VENDOR_WORDS]]);
  // A name new to the book that this row does not add — the stop's own vendor stands — is said, after the vendor's sentence.
  const notAdded = onStop(landed({ ...TEA, Items: '', Vendor: 'Fern Room', 'Instagram Tag': 'fern.room' }, ON_PLAN('Tea')).placement);
  assert.deepEqual([notAdded.vendor, notAdded.tag, notAdded.notWritten], [{ kind: 'none' }, null, [vendorNotWrittenWords('Bean Bar'), TAG_VENDOR_NOT_ADDED_WORDS]]);
  assert.deepEqual([TAG_NO_VENDOR_WORDS, TAG_VENDOR_NOT_ADDED_WORDS], ['Instagram Tag — not written: the row names no Vendor', 'Instagram Tag — not written: its Vendor is new to the book, and this row does not add it']);
  // A RECORDED stop still sets its vendor's tag — the tag is the vendor's, not the stop's — and the row is a write for it alone.
  const tagged = landed({ 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Dinner', Vendor: 'Oat House', 'Instagram Tag': '@oat.house' }, ON_PLAN('Dinner'));
  const dinner = onStop(tagged.placement);
  assert.deepEqual([dinner.happened, dinner.vendor, dinner.record, dinner.items, dinner.tag, dinner.notWritten], [{ kind: 'recorded' }, { kind: 'none' }, null, null, { vendorId: 'v-oat', tag: 'oat.house' }, []]);
  assert.deepEqual(tagged.writes, [{ kind: 'stop', row: 2, day: SUN, book: { id: 'P', word: 'Personal' }, vendor: { kind: 'none' }, tag: { vendorId: 'v-oat', tag: 'oat.house' }, items: null, address: DINNER_SUN.address, record: null }]);
  const { calls, writers } = recorder();
  assert.deepEqual(await runPaste(tagged.writes, writers, () => undefined, []), [{ row: 2, state: 'written', steps: ['tag'] }]);
  assert.deepEqual(calls, [['setVendorTag', 'v-oat', 'oat.house']]);
  // The same row with no tag has nothing to write.
  assert.deepEqual(landed({ 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Dinner', Vendor: 'Oat House' }, ON_PLAN('Dinner')).writes, []);
  // A REFUSED row gives none and takes no vendor's turn: the next row's tag is the one written.
  const turn = pasteOf({ ...SOUP, 'Start Date': '6/12/27', 'Instagram Tag': 'first.tag' }, { ...SOUP, 'Instagram Tag': 'second.tag' });
  const turned = placedWith(turn, ON_PLAN('Soup'));
  assert.deepEqual(turned[0], { kind: 'refused', head: 'Start Date', why: noStopWords('Soup') });
  assert.deepEqual([onStop(turned[1]).tag, onStop(turned[1]).notWritten], [{ vendorId: 'v-oat', tag: 'second.tag' }, []]);
});

// ── T7 · THE RUNNER (rulings C.2 to C.4) ─────────────────────────────────────

test('T7 the runner, over writers that record their calls: the nine steps and their words; the vendor’s call carries the items, and no `items` key without any; a standing vendor is ONE call whose step is ‘items’, and its refusal fails ‘items’; the tag is set after the vendor — on the book’s own id, and on the id the add answered; a refused tag fails ‘tag’ with the steps before it, and no record is tried; a one-off’s record carries the row’s notes', async () => {
  assert.deepEqual([...PASTE_STEPS], ['sub-account', 'stop', 'line', 'minutes', 'directory', 'vendor', 'items', 'tag', 'record']);
  assert.deepEqual(PASTE_STEPS.map((step) => PASTE_STEP_WORDS[step]), [
    'the sub-account', 'the one-off stop', "the stop's line, read back", "the stop's minutes", 'the vendor, added to the book', 'the vendor, on the stop', 'the planned items', "the vendor's Instagram tag", 'the record',
  ]);
  // The vendor's call carries the row's planned items — ONE call, two steps.
  const planning = await ran({ ...SOUP_PLAN, 'Start Date': '6/14/27' }, ON_PLAN('Soup'));
  assert.deepEqual(planning.calls, [['setVendor', { kind: 'routine_line', id: 'line-soup', instant: at(MON, '12:30'), vendorId: 'v-oat', items: 'two bowls' }]]);
  assert.deepEqual(planning.outcome, { row: 2, state: 'written', steps: ['vendor', 'items'] });
  assert.equal(pasteOutcomeWords(planning.outcome), 'written: the vendor, on the stop · the planned items');
  // A row that writes no planned items: the body has no `items` key at all — it says nothing of them.
  const plain = await ran({ ...SOUP, Notes: '', 'Instagram Tag': '' }, ON_PLAN('Soup'));
  const body = callOf(plain.calls, 'setVendor')[1];
  assert.deepEqual(body, { kind: 'routine_line', id: 'line-soup', instant: at(SUN, '12:30'), vendorId: 'v-oat' });
  assert.ok(typeof body === 'object' && body !== null && !('items' in body), 'no items key');
  assert.deepEqual(plain.outcome, { row: 2, state: 'written', steps: ['vendor', 'record'] });
  // A STANDING vendor: ONE call — the stop's own vendor id and the items; its step is 'items' alone.
  const standing = await ran(TEA, ON_PLAN('Tea'));
  assert.deepEqual(standing.calls, [['setVendor', { kind: 'routine_line', id: 'line-tea', instant: at(SUN, '16:00'), vendorId: 'v-bean', items: 'a pot of mint' }]]);
  assert.deepEqual(standing.outcome, { row: 2, state: 'written', steps: ['items'] });
  // …and a refusal of that call fails 'items' — nothing of the vendor was being written.
  const refusedItems = await ran(TEA, ON_PLAN('Tea'), { vendor: 'No such plan' });
  assert.deepEqual(refusedItems.outcome, { row: 2, state: 'failed', steps: [], step: 'items', words: 'No such plan' });
  assert.equal(pasteOutcomeWords(refusedItems.outcome), 'not written: the planned items — No such plan');
  // A refusal of a vendor's own write fails 'vendor', the items with it.
  assert.deepEqual((await ran({ ...SOUP_PLAN, 'Start Date': '6/14/27' }, ON_PLAN('Soup'), { vendor: 'No such plan' })).outcome, { row: 2, state: 'failed', steps: [], step: 'vendor', words: 'No such plan' });
  // THE TAG: after the vendor, before the record — on the book's own id…
  const own = await ran(SOUP, ON_PLAN('Soup'));
  assert.deepEqual(names(own.calls), ['setVendor', 'setVendorTag', 'setRecord']);
  assert.deepEqual(callOf(own.calls, 'setVendorTag'), ['setVendorTag', 'v-oat', 'oat.house']);
  assert.deepEqual(own.outcome, { row: 2, state: 'written', steps: ['vendor', 'tag', 'record'] });
  // …and, for the vendor the row adds, on the id the add answered.
  const fresh = await ran(BOWLING, ONE_OFF('6200'));
  assert.deepEqual(names(fresh.calls), ['createOneOff', 'readOneOffLine', 'setLineMinutes', 'addVendor', 'setVendor', 'setVendorTag', 'setRecord']);
  assert.deepEqual(callOf(fresh.calls, 'addVendor'), ['addVendor', 'P', 'Pin Palace']);
  assert.deepEqual(callOf(fresh.calls, 'setVendorTag'), ['setVendorTag', 'v-new-1', 'pin_palace']);
  assert.deepEqual(fresh.outcome, { row: 2, state: 'written', steps: ['stop', 'line', 'minutes', 'directory', 'vendor', 'tag', 'record'] });
  // A one-off's record carries the row's notes; its line is the row's Items.
  const record = callOf(fresh.calls, 'setRecord')[1] as { readonly note: unknown; readonly notes: unknown; readonly id: unknown };
  assert.deepEqual([record.id, record.note, record.notes], ['line-of-rt-1', 'two games', 'lane four']);
  // A refused tag fails 'tag', with the steps written before it — and the record is not tried.
  const refusedTag = await ran(SOUP, ON_PLAN('Soup'), { tag: 'that handle could not be kept' });
  assert.deepEqual(refusedTag.outcome, { row: 2, state: 'failed', steps: ['vendor'], step: 'tag', words: 'that handle could not be kept' });
  assert.deepEqual(names(refusedTag.calls), ['setVendor', 'setVendorTag']);
  assert.equal(pasteOutcomeWords(refusedTag.outcome), "written: the vendor, on the stop · not written: the vendor's Instagram tag — that handle could not be kept");
  // Two writes this file's own rule never makes are its errors, thrown by name: a tag on the vendor a row adds when the row plans no vendor; a standing vendor named with no items.
  const address = { kind: 'routine_line' as const, id: 'line-soup', instant: at(SUN, '12:30') };
  const book = { id: 'P', word: 'Personal' as const };
  const orphanTag: PasteWrite = { kind: 'stop', row: 9, day: SUN, book, vendor: { kind: 'none' }, tag: { vendorId: null, tag: 'oat.house' }, items: null, address, record: null };
  await assert.rejects(runPaste([orphanTag], recorder().writers, () => undefined, []), /pasteSave: row 9 sets a tag on the vendor it adds, and its vendor step ended on no vendor/);
  const bareStanding: PasteWrite = { kind: 'stop', row: 9, day: SUN, book, vendor: { kind: 'standing', id: 'v-bean', name: 'Bean Bar' }, tag: null, items: null, address, record: null };
  await assert.rejects(runPaste([bareStanding], recorder().writers, () => undefined, []), /pasteSave: row 9 names its stop's standing vendor and writes no planned items/);
});

// ── T8 · THE WORDS (rulings B.5, C.5) ────────────────────────────────────────

test('T8 the words: the button counts the tags set and the stops given planned items — a standing vendor is not a vendor set on a stop; the words of nothing to save; YOUR SHEET’s eleven heads and a row’s eleven cells', () => {
  // Row 2: the book's own vendor, its tag and a record. Row 3: a stop ahead — a vendor new to the book, its tag, and planned items. Row 4: planned items on the vendor that stands.
  const paste = pasteOf(SOUP, { ...SOUP_PLAN, 'Start Date': '6/14/27', Vendor: 'Fern Room', 'Instagram Tag': 'fern.room' }, TEA);
  const picks = { [kindOf('Dining Out', 'Soup')]: ON_PLAN('Soup'), [kindOf('Dining Out', 'Tea')]: ON_PLAN('Tea') };
  const writes = pasteWritesOf(paste.rows, placePaste(paste, picks, CONTEXT));
  assert.deepEqual(writes.map((write) => [write.row, write.vendor.kind, write.tag, write.items]), [
    [2, 'own', { vendorId: 'v-oat', tag: 'oat.house' }, null], [3, 'new', { vendorId: null, tag: 'fern.room' }, 'two bowls'], [4, 'standing', null, 'a pot of mint'],
  ]);
  assert.equal(saveWords(writes, []), 'save 3 rows — 0 sub-accounts added to the chart · 1 vendor added to a book · 2 vendors set on a stop · 2 tags set on a vendor · 2 stops given planned items · 1 record · 0 one-offs');
  // The singulars — and the standing vendor alone: a stop given planned items, and no vendor set.
  assert.equal(saveWords(writes.slice(1, 2), []), 'save 1 row — 0 sub-accounts added to the chart · 1 vendor added to a book · 1 vendor set on a stop · 1 tag set on a vendor · 1 stop given planned items · 0 records · 0 one-offs');
  assert.equal(saveWords(writes.slice(2), []), 'save 1 row — 0 sub-accounts added to the chart · 0 vendors added to a book · 0 vendors set on a stop · 0 tags set on a vendor · 1 stop given planned items · 0 records · 0 one-offs');
  assert.equal(NOTHING_TO_SAVE_WORDS, 'nothing to save — no placed row has a vendor to plan, a tag to set, planned items to write, a record to make or a one-off to add');
  // YOUR SHEET: eleven columns — LOCATION first of the row's own facts, INSTAGRAM TAG after VENDOR, NOTES after ITEMS.
  assert.deepEqual(YOUR_SHEET_COLUMNS.map((column) => column.head), ['ROW', 'DATE', 'TIME', 'ENTITY', 'LOCATION', 'CATEGORY › TYPE', 'VENDOR', 'INSTAGRAM TAG', 'ITEMS', 'NOTES', 'TOTAL (USD)']);
  assert.deepEqual(YOUR_SHEET_COLUMNS.filter((column) => !column.short).map((column) => column.head), ['CATEGORY › TYPE', 'VENDOR', 'ITEMS', 'NOTES'], 'the columns whose cells wrap');
  assert.deepEqual(YOUR_SHEET_COLUMNS.filter((column) => column.money).map((column) => column.head), ['TOTAL (USD)']);
  // A row's eleven cells, each as he typed it — the tag with the @ he typed, or without; a blank cell is the sheet's blank.
  const evening = pasteOf(BOWLING, { ...SOUP, Notes: '' }, TEA);
  const shown = pasteShown(evening, placePaste(evening, {}, CONTEXT));
  assert.deepEqual(shown[0].yours, ['2', '6/13/27', '8:00 PM – 9:30 PM', 'Personal', 'Travel', 'Recreation › Bowling', 'Pin Palace', 'pin_palace', 'two games', 'lane four', '18']);
  assert.deepEqual(shown[1].yours, ['3', '6/13/27', '12:30 PM', 'Personal', BLANK, 'Dining Out › Soup', 'Oat House', '@oat.house', 'two bowls', BLANK, '6.90']);
  assert.deepEqual(shown[2].yours, ['4', '6/13/27', BLANK, 'Personal', BLANK, 'Dining Out › Tea', BLANK, BLANK, 'a pot of mint', BLANK, BLANK]);
  for (const row of shown) assert.equal(row.yours.length, YOUR_SHEET_COLUMNS.length);
});

// ── T9 · THE WRITERS FILE (ruling D) ─────────────────────────────────────────

test('T9 the writers file, over a stand-in fetch: setVendorTag is one PATCH to the directory with { id, instagramTag }; setVendor’s body is sent with its items and without; addSubAccount is one POST to the chart’s sub-accounts with { accountId, name, code }; a refusal is the route’s own words', async () => {
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const sent: { readonly url: string; readonly init: RequestInit | undefined }[] = [];
  let answer: () => Response = () => json({});
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  try {
    answer = () => json({ id: 'v-oat', vendor_name: 'Oat House', entity_id: 'P', instagram_tag: 'oat.house' });
    assert.deepEqual(await setVendorTag('v-oat', 'oat.house'), { ok: true, value: null });
    answer = () => json({ error: 'bad-tag', message: 'an Instagram tag is letters, digits, dots and underscores, 30 at most — "oat house" is not one' }, 400);
    assert.deepEqual(await setVendorTag('v-oat', 'oat house'), { ok: false, words: 'an Instagram tag is letters, digits, dots and underscores, 30 at most — "oat house" is not one' });
    answer = () => json({ outcome: 'set' }, 201);
    assert.deepEqual(await setVendor({ kind: 'routine_line', id: 'line-soup', instant: at(MON, '12:30'), vendorId: 'v-oat', items: 'two bowls' }), { ok: true, value: { outcome: 'set' } });
    assert.deepEqual(await setVendor({ kind: 'routine_line', id: 'line-soup', instant: at(MON, '12:30'), vendorId: 'v-oat' }), { ok: true, value: { outcome: 'set' } });
    answer = () => json({ success: true, subAccount: { id: 'sub-1', accountId: 'acct-6200', accountCode: '6200', code: '10', name: 'Bowling', is_archived: false } }, 201);
    assert.deepEqual(await addSubAccount('acct-6200', 'Bowling', '10'), { ok: true, value: null });
    answer = () => json({ error: 'that name already stands under this account', field: 'name' }, 409);
    assert.deepEqual(await addSubAccount('acct-6200', 'bowling', '20'), { ok: false, words: 'that name already stands under this account' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => [s.url, s.init?.method, s.init?.body]), [
    ['/api/operations/vendor-directory', 'PATCH', JSON.stringify({ id: 'v-oat', instagramTag: 'oat.house' })],
    ['/api/operations/vendor-directory', 'PATCH', JSON.stringify({ id: 'v-oat', instagramTag: 'oat house' })],
    ['/api/operations/plan-vendors', 'POST', JSON.stringify({ kind: 'routine_line', id: 'line-soup', instant: at(MON, '12:30'), vendorId: 'v-oat', items: 'two bowls' })],
    ['/api/operations/plan-vendors', 'POST', JSON.stringify({ kind: 'routine_line', id: 'line-soup', instant: at(MON, '12:30'), vendorId: 'v-oat' })],
    ['/api/chart-of-accounts/sub-accounts', 'POST', JSON.stringify({ accountId: 'acct-6200', name: 'Bowling', code: '10' })],
    ['/api/chart-of-accounts/sub-accounts', 'POST', JSON.stringify({ accountId: 'acct-6200', name: 'bowling', code: '20' })],
  ]);
});

// ── T10 · IN THE SOURCE (rulings D.3, E) ─────────────────────────────────────

test('T10 in the source: the leaf hands eight writers to the one runner and calls none itself; its table has no LANDS head — each row is one <tbody> carrying the tone and the two data attributes, of two lines, the lands cell as ruled; planVendor.ts exports instagramTagKey between vendorNameKey and takenBy, and its TIMESHEET-04a section still lower-cases nothing', () => {
  const leaf = code(LEAF);
  // THE EIGHT WRITERS: imported — ledgerWrites.ts's seven on one line, the stops' one on its own — handed to the one runner in one object, and named nowhere else: none is called here.
  assert.match(leaf, /\nimport \{ addSubAccount, addVendor, createOneOff, readOneOffLine, setLineMinutes, setVendor, setVendorTag \} from '\.\/ledgerWrites';\n/);
  assert.match(leaf, /\nimport \{ setStopRecord \} from '\.\.\/stops\/stopWrites';\n/);
  for (const writer of ['createOneOff', 'readOneOffLine', 'setLineMinutes', 'addVendor', 'setVendor', 'setVendorTag', 'addSubAccount', 'setStopRecord']) {
    assert.equal(countOf(leaf, new RegExp(`\\b${writer}\\b`, 'g')), 2, `${writer}: imported, and handed to the runner`);
    assert.doesNotMatch(leaf, new RegExp(`\\b${writer}\\(`), `${writer} is not called here`);
  }
  assert.equal(countOf(leaf, /await runPaste\(placed\.writes, \{ createOneOff, readOneOffLine, setLineMinutes, addVendor, setVendor, setVendorTag, addSubAccount, setRecord: setStopRecord \}, /g), 1);
  assert.equal(countOf(leaf, /\brunPaste\b/g), 2, 'imported, and called once');
  assert.doesNotMatch(leaf, /\bfetch\s*\(/, 'the leaf sends no request of its own');
  assert.match(comments(LEAF), /handed the eight writers — ledgerWrites\.ts's seven and the stops' one/);
  // THE TABLE: two group heads and no third — LANDS is no column.
  const table = between(leaf, '<table className="w-full border-collapse text-xs" data-ledger-paste-table>', '</table>');
  assert.deepEqual([...table.matchAll(/data-ledger-paste-group="(\w+)"/g)].map((m) => m[1]), ['yours', 'sheet']);
  assert.doesNotMatch(table, /rowSpan/);
  // ONE <tbody> A ROW — it carries what the row's own <tr> carried: the key, the tone's class and the two data attributes — holding two lines.
  assert.equal(countOf(table, /<tbody\b/g), 1, 'the one <tbody> in the source is the row’s own, inside the map');
  inOrder(table, ['</thead>', '{shown.table.map((row) => {', '<tbody key={row.number} className={ROW_CLASS[row.tone]} data-ledger-paste-row={row.number} data-ledger-paste-tone={row.tone}>', '</tbody>'], 'the rows');
  const row = between(table, '<tbody key={row.number}', '</tbody>');
  assert.equal(countOf(row, /<tr>/g), 2, 'the row’s cells, then where it lands');
  assert.doesNotMatch(table, /<tr [^>]*data-ledger-paste-(?:row|tone)/, 'the two data attributes are the <tbody>’s');
  // WHERE IT LANDS: an empty cell under ROW, then ONE cell across the others — the word, the sentence, and the outcome after it on the same line.
  assert.match(row, /<tr>\n\s*<td \/>\n\s*<td colSpan=\{YOUR_SHEET_COLUMNS\.length \+ ON_TIME_SHEET_COLUMNS\.length - 1\} className=\{`\$\{cell\} pt-0`\} data-ledger-paste-lands>\n\s*<span className=\{`\$\{label\} uppercase mr-2`\}>\{LANDS_WORDS\}<\/span><span>\{row\.lands\}<\/span>\{outcome !== undefined && <span className=\{`\$\{SAVED_CLASS\[outcome\.state\]\} ml-3`\} data-ledger-paste-saved=\{outcome\.state\}>\{pasteOutcomeWords\(outcome\)\}<\/span>\}\n\s*<\/td>\n\s*<\/tr>/);
  assert.equal(countOf(leaf, /\bLANDS_WORDS\b/g), 2, 'imported, and printed once — in the lands cell');
  assert.equal(countOf(leaf, /data-ledger-paste-lands/g), 1);
  // THE TAG'S KEY: one export, directly after the name's key and before takenBy — and NOT in the TIMESHEET-04a section below, which lower-cases nothing.
  const rule = code(VENDOR_RULE);
  assert.match(rule, /\nexport const vendorNameKey = [^\n]+\n(?:[ \t]*\n)*export const instagramTagKey = \(tag: string\): string => tag\.toLowerCase\(\);\n(?:[ \t]*\n)*export function takenBy</);
  const exported = [...rule.matchAll(/^export (?:const|function|interface|type) (\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(exported.slice(exported.indexOf('vendorNameKey'), exported.indexOf('takenBy') + 1), ['vendorNameKey', 'instagramTagKey', 'takenBy']);
  const section = rule.slice(rule.indexOf('export function takenBy<'), rule.indexOf('export const PLAN_VENDOR_KINDS'));
  assert.ok(section.includes('export function readInstagramTag('), 'the section is the tag’s own');
  assert.doesNotMatch(section, /toLowerCase\(|instagramTagKey/, 'nothing is lower-cased there, and the key is not there');
});

// ── T11 · THE LOCATION, READ (3b.1) ──────────────────────────────────────────

test('T11 the Location is read by its one rule: each word in either case, and each key; a blank cell is none; a word that is neither refuses its row on Location in that rule’s own words; a paste without the column reads none — it is optional, as Items is', () => {
  for (const [typed, read] of [['Travel', 'travel'], ['travel', 'travel'], ['TRAVEL', 'travel'], ['Homebase', 'homebase'], ['homebase', 'homebase'], ['  HomeBase ', 'homebase']] as const) {
    const row = readRowOf({ ...BOWLING, Location: typed });
    assert.deepEqual([row.cells.location, row.typed.location], [read, typed.trim()], typed);
  }
  const none = readRowOf({ ...BOWLING, Location: '' });
  assert.deepEqual([none.cells.location, none.typed.location], [null, '']);
  // A word that is neither: refused on Location, in the rule's words — and never read as one it is not. A class's code is not its word.
  assert.deepEqual(refusedRowOf({ ...BOWLING, Location: 'Abroad' }), ['Location', locationUnknownWords('Abroad')]);
  assert.equal(locationUnknownWords('Abroad'), 'Location "Abroad" is not one this app knows — Travel or Homebase');
  assert.deepEqual(refusedRowOf({ ...BOWLING, Location: 'TRV' }), ['Location', locationUnknownWords('TRV')]);
  // Read in the heads' order: after the End Time, before the Category.
  assert.equal(refusedRowOf({ ...BOWLING, 'End Time': 'late', Location: 'Abroad' })[0], 'End Time');
  assert.equal(refusedRowOf({ ...BOWLING, Location: 'Abroad', Category: '' })[0], 'Location');
  // A paste without the column reads none on every row; the column is not a required head.
  const without = readPaste(sheetText([BOWLING], PASTE_READ_HEADS.filter((head) => head !== 'Location')));
  assert.ok(without.ok);
  const lean = without.value.rows[0];
  assert.ok(lean.kind === 'read');
  assert.deepEqual([lean.cells.location, lean.typed.location, lean.cells.type], [null, '', 'Bowling']);
  assert.ok(!PASTE_REQUIRED_HEADS.includes('Location'));
  assert.equal(PASTE_READ_HEADS.indexOf('Location'), PASTE_READ_HEADS.indexOf('Category') - 1, 'before Category');
});

// ── T12 · THE LOCATION, PLACED (3b.2) ────────────────────────────────────────

test('T12 a new one-off carries its Location into the stop’s body as location_class; a row on a stop that stands writes none — the same Location, or none typed, is quiet, and another is said, after the tag’s sentence', () => {
  const travel = oneOff(landed(BOWLING, ONE_OFF('6200')).placement);
  assert.deepEqual([travel.location, travel.values.location, oneOffBody(travel.values).location_class], ['travel', 'travel', 'travel']);
  const home = oneOff(landed({ ...BOWLING, Location: 'homebase' }, ONE_OFF('6200')).placement);
  assert.deepEqual([home.location, oneOffBody(home.values).location_class, oneOffBody(home.values).location], ['homebase', 'homebase', ''], 'the venue’s text is another box, and stays blank');
  const unsaid = oneOff(landed({ ...BOWLING, Location: '' }, ONE_OFF('6200')).placement);
  assert.deepEqual([unsaid.location, oneOffBody(unsaid.values).location_class], [null, null], 'none typed: not said');
  // A stop that stands keeps what its plan says. The same Location is quiet; none typed is quiet.
  const WALK: Typed = { 'Start Date': '6/13/27', Category: 'Dining Out', Entity: 'Personal', Type: 'Walk' };
  assert.deepEqual(onStop(landed({ ...WALK, Location: 'Homebase' }, ON_PLAN('Walk')).placement).notWritten, []);
  assert.deepEqual(onStop(landed(WALK, ON_PLAN('Walk')).placement).notWritten, []);
  // Another is said — with what the stop stands as: a class's word, or that it says none.
  assert.deepEqual(onStop(landed({ ...WALK, Location: 'Travel' }, ON_PLAN('Walk')).placement).notWritten, [locationStandsWords('homebase')]);
  assert.deepEqual(onStop(landed({ ...SOUP_PLAN, Location: 'Travel' }, ON_PLAN('Soup')).placement).notWritten, [locationStandsWords(null)]);
  assert.deepEqual([locationStandsWords('homebase'), locationStandsWords('travel'), locationStandsWords(null)], [
    'Location — not written: this stop already stands as Homebase — the paste does not change a plan',
    'Location — not written: this stop already stands as Travel — the paste does not change a plan',
    'Location — not written: this stop already stands as no Location — the paste does not change a plan',
  ]);
  // It stands LAST: after the vendor's sentence and the tag's.
  const last = onStop(landed({ ...TEA, Items: '', Vendor: 'Fern Room', 'Instagram Tag': 'fern.room', Location: 'Travel' }, ON_PLAN('Tea')).placement);
  assert.deepEqual(last.notWritten, [vendorNotWrittenWords('Bean Bar'), TAG_VENDOR_NOT_ADDED_WORDS, locationStandsWords(null)]);
  // Nothing of it is a write: a row whose Location alone differs has nothing to save.
  assert.deepEqual(landed({ ...WALK, Location: 'Travel' }, ON_PLAN('Walk')).writes, []);
});

// ── T13 · A KIND STARTS ON THE ACCOUNT ITS CATEGORY NAMES (3b.3) ─────────────

test('T13 namedPicksOf: a kind whose one book’s chart holds exactly one account of its Category’s name — compared as a sub-account’s name is — starts as a one-off under it; no such account, or two, and a book the paste cannot tell apart, start on none; a read keeps his picks and starts only the kinds with none standing', () => {
  const paste = pasteOf(BOWLING, { ...DARTS, Category: '  recreation ' }, { ...BOWLING, Category: 'Fun', Type: 'Quiz', 'Start Time': '6:00 PM' }, { ...BOWLING, Entity: 'Business', Category: 'Supplies', Type: 'Paper' }, SOUP);
  const kinds = pasteKindsOf(paste);
  assert.deepEqual(kinds.map((kind) => [kind.entity, kind.category]), [['Personal', 'Recreation'], ['Personal', 'recreation'], ['Personal', 'Fun'], ['Business', 'Supplies'], ['Personal', 'Dining Out']]);
  const [bowling, darts, quiz, paper, soup] = [kindOf('Recreation', 'Bowling'), kindOf('Recreation', 'Darts'), kindOf('Fun', 'Quiz'), kindOf('Supplies', 'Paper', 'Business'), kindOf('Dining Out', 'Soup')];
  // One account of the name, in the kind's own book: picked — ignoring case and spacing. No account of the name: no pick.
  assert.deepEqual(namedPicksOf(kinds, CONTEXT), { [bowling]: ONE_OFF('6200'), [darts]: ONE_OFF('6200'), [paper]: ONE_OFF('6400'), [soup]: ONE_OFF('6150') });
  assert.ok(!Object.prototype.hasOwnProperty.call(namedPicksOf(kinds, CONTEXT), quiz), 'no account is called Fun');
  // Two accounts of the name: the paste cannot tell which — no pick.
  const twoAccounts: PasteContext = { ...CONTEXT, charts: { ...CHARTS, P: [...CHARTS.P, { id: 'acct-6210', code: '6210', name: 'RECREATION' }] } };
  assert.deepEqual(namedPicksOf(kinds, twoAccounts), { [paper]: ONE_OFF('6400'), [soup]: ONE_OFF('6150') });
  // Another book's account of the name is not this book's.
  const elsewhere: PasteContext = { ...CONTEXT, charts: { P: CHARTS.P.filter((account) => account.code !== '6200'), B: [...CHARTS.B, { id: 'acct-6200b', code: '6200', name: 'Recreation' }] } };
  assert.deepEqual(namedPicksOf(kinds, elsewhere), { [paper]: ONE_OFF('6400'), [soup]: ONE_OFF('6150') });
  // A book the paste cannot tell apart — two books of one word — and a word no book carries: no pick.
  const twoBooks: PasteContext = { ...CONTEXT, books: [...BOOKS, { id: 'P2', name: 'Cabin', entityType: 'personal' }] };
  assert.deepEqual(namedPicksOf(kinds, twoBooks), { [paper]: ONE_OFF('6400') });
  assert.deepEqual(namedPicksOf(pasteKindsOf(pasteOf({ ...BOWLING, Entity: 'Nobody' })), CONTEXT), {});
  // AT A READ: his own picks are kept — a plan he picked stays, though the chart names an account — and each kind with none still standing starts on its named one. A pick of his that no
  // longer stands (its account left the chart) gives way; one for a kind this paste does not hold is kept as it is.
  const his = { [soup]: ON_PLAN('Soup'), [bowling]: ONE_OFF('9999'), 'another paste’s kind': ON_PLAN('Elsewhere') };
  assert.deepEqual(picksAtRead(his, kinds, CONTEXT), { [soup]: ON_PLAN('Soup'), [bowling]: ONE_OFF('6200'), 'another paste’s kind': ON_PLAN('Elsewhere'), [darts]: ONE_OFF('6200'), [paper]: ONE_OFF('6400') });
  assert.deepEqual(picksAtRead({}, kinds, CONTEXT), namedPicksOf(kinds, CONTEXT), 'with no pick of his, the read starts on the named ones');
  assert.deepEqual(his, { [soup]: ON_PLAN('Soup'), [bowling]: ONE_OFF('9999'), 'another paste’s kind': ON_PLAN('Elsewhere') }, 'the picks handed in are not changed');
  assert.equal(PASTE_PICKS_WORDS, 'where each kind of row goes — a kind starts on the account your chart names as its Category; change any');
});

// ── T14 · THE CHART'S ADDITIONS (3b.4) ───────────────────────────────────────

test('T14 chartAddsOf: each new one-off’s Type under its pick’s account takes the next ten — two Types under one account take 10 and 20; a Type the account already holds, and the same Type on a second row, add none; with no ten left the addition is listed with no code, said, and not handed to the save; a row on a stop that stands adds none', () => {
  // Rows 2 and 3: two Types under one account. Row 4: the first Type again, another day and spelled in another case. Row 5: the other book. Row 6: on a plan's stop.
  const paste = pasteOf(BOWLING, DARTS, { ...BOWLING, 'Start Date': '6/12/27', Type: 'bowling' }, { ...BOWLING, Entity: 'Business', Category: 'Supplies', Type: 'Paper' }, SOUP);
  const picks = { [kindOf('Recreation', 'Bowling')]: ONE_OFF('6200'), [kindOf('Recreation', 'Darts')]: ONE_OFF('6200'), [kindOf('Supplies', 'Paper', 'Business')]: ONE_OFF('6400'), [kindOf('Dining Out', 'Soup')]: ON_PLAN('Soup') };
  const placements = placePaste(paste, picks, CONTEXT);
  assert.deepEqual(placements.map((placement) => placement.kind), ['oneOff', 'oneOff', 'oneOff', 'oneOff', 'plan']);
  const adds = chartAddsOf(placements, CONTEXT);
  assert.deepEqual(adds, [
    { accountId: 'acct-6200', rendered: 'P-6200', code: '10', name: 'Bowling' },
    { accountId: 'acct-6200', rendered: 'P-6200', code: '20', name: 'Darts' },
    { accountId: 'acct-6400', rendered: 'B-6400', code: '10', name: 'Paper' },
  ]);
  assert.deepEqual(adds.map(chartAddWords), ['P-6200 › 10 Bowling', 'P-6200 › 20 Darts', 'B-6400 › 10 Paper']);
  assert.equal(PASTE_ADDS_WORDS, 'adds to the chart:');
  assert.deepEqual(pasteAddsOf(adds), adds, 'each took a code: each is handed to the save');
  // What the account already holds is not added — by the name, ignoring case and spacing; the next ten is over the account's own codes; another account's sub-account of the name is not this one's.
  const holding = (subs: readonly PasteSubAccount[]): PasteContext => ({ ...CONTEXT, subAccounts: { P: subs, B: [] } });
  const held = holding([{ accountId: 'acct-6200', code: '10', name: 'Quiz' }, { accountId: 'acct-6200', code: '20', name: '  BOWLING ' }, { accountId: 'acct-6150', code: '40', name: 'Darts' }]);
  assert.deepEqual(chartAddsOf(placements, held), [{ accountId: 'acct-6200', rendered: 'P-6200', code: '30', name: 'Darts' }, { accountId: 'acct-6400', rendered: 'B-6400', code: '10', name: 'Paper' }]);
  // No ten left under the account: listed with no code — said, and not written. The other account still takes its ten.
  const full = holding([10, 20, 30, 40, 50, 60, 70, 80, 90].map((ten) => ({ accountId: 'acct-6200', code: String(ten), name: `Lane ${ten}` })));
  const usedUp = chartAddsOf(placements, full);
  assert.deepEqual(usedUp, [
    { accountId: 'acct-6200', rendered: 'P-6200', code: null, name: 'Bowling' },
    { accountId: 'acct-6200', rendered: 'P-6200', code: null, name: 'Darts' },
    { accountId: 'acct-6400', rendered: 'B-6400', code: '10', name: 'Paper' },
  ]);
  assert.equal(chartAddWords(usedUp[0]), `P-6200 › Bowling — ${SUB_CODES_USED_UP_WORDS}`);
  assert.deepEqual(pasteAddsOf(usedUp), [{ accountId: 'acct-6400', rendered: 'B-6400', code: '10', name: 'Paper' }]);
  // A row on a stop that stands adds none: its stop's name is the plan's.
  assert.deepEqual(chartAddsOf(placedWith(pasteOf(SOUP), ON_PLAN('Soup')), CONTEXT), []);
  // A book whose sub-accounts were not read is the caller's error, thrown by name — never taken as a book with none.
  assert.throws(() => chartAddsOf(placements, { subAccounts: { B: [] } }), /pasteRows: the sub-accounts of the book "Home" were not read/);
});

// ── T15 · THE SAVE WRITES THE ADDITIONS FIRST (3b.4) ─────────────────────────

test('T15 the runner writes the additions first, one call each, before any row; one a route refuses is said on its line and stops nothing — every row is still saved; the button counts them first', async () => {
  const paste = pasteOf(BOWLING, DARTS);
  const placements = placedWith(paste, ONE_OFF('6200'));
  const writes = pasteWritesOf(paste.rows, placements);
  const adds = pasteAddsOf(chartAddsOf(placements, CONTEXT));
  assert.deepEqual(adds, [{ accountId: 'acct-6200', rendered: 'P-6200', code: '10', name: 'Bowling' }, { accountId: 'acct-6200', rendered: 'P-6200', code: '20', name: 'Darts' }]);
  // THE BUTTON: the sub-accounts first. (The second row's vendor is the one the first adds, and its tag the same handle: one vendor added, one tag set.)
  assert.equal(saveWords(writes, adds), 'save 2 rows — 2 sub-accounts added to the chart · 1 vendor added to a book · 2 vendors set on a stop · 1 tag set on a vendor · 0 stops given planned items · 2 records · 2 one-offs');
  assert.equal(saveWords(writes.slice(0, 1), adds.slice(0, 1)), 'save 1 row — 1 sub-account added to the chart · 1 vendor added to a book · 1 vendor set on a stop · 1 tag set on a vendor · 0 stops given planned items · 1 record · 1 one-off');
  // THE RUN: each addition, in its order — its account's id, its name, its code — and only then the first row.
  const first = recorder();
  const told: PasteProgress[] = [];
  const outcomes = await runPaste(writes, first.writers, (progress) => told.push(progress), adds);
  assert.deepEqual(first.calls.slice(0, 3).map((call) => (call[0] === 'addSubAccount' ? call : call[0])), [['addSubAccount', 'acct-6200', 'Bowling', '10'], ['addSubAccount', 'acct-6200', 'Darts', '20'], 'createOneOff']);
  assert.equal(countOf(names(first.calls).join(' '), /addSubAccount/g), 2, 'one call an addition');
  assert.deepEqual(told[0], { adds: [{ state: 'written' }, { state: 'written' }], outcomes: [], at: { i: 1, of: 2, row: 2 } }, 'before the first row is written, both additions have come out');
  assert.deepEqual(told[told.length - 1].adds, [{ state: 'written' }, { state: 'written' }]);
  assert.deepEqual(outcomes.map((outcome) => outcome.state), ['written', 'written']);
  assert.equal(addOutcomeWords({ state: 'written' }), 'written: the sub-account');
  // A REFUSAL stops nothing: it is said on the addition's line, the next addition is still asked, and every row is saved — a stop's name is its Type either way.
  const second = recorder({ 'sub-account': 'that name already stands under this account' });
  const said: PasteProgress[] = [];
  const saved = await runPaste(writes, second.writers, (progress) => said.push(progress), adds);
  assert.equal(countOf(names(second.calls).join(' '), /addSubAccount/g), 2);
  assert.deepEqual(said[said.length - 1].adds, [{ state: 'failed', words: 'that name already stands under this account' }, { state: 'failed', words: 'that name already stands under this account' }]);
  assert.deepEqual([saved.map((outcome) => outcome.state), runStopped(saved), runWords(saved)], [['written', 'written'], false, '2 rows saved']);
  assert.deepEqual(names(second.calls).slice(2), names(first.calls).slice(2), 'the rows are written as they are with no refusal');
  assert.equal(addOutcomeWords({ state: 'failed', words: 'that name already stands under this account' }), 'not written: the sub-account — that name already stands under this account');
  // No addition: the runner asks the chart nothing.
  const none = recorder();
  await runPaste(writes, none.writers, () => undefined, []);
  assert.ok(!names(none.calls).includes('addSubAccount'));
});

// ── T16 · THE SAME ROWS, PASTED AGAIN (rulings B, 3b.4) ──────────────────────

test('T16 the same rows pasted again over a time sheet, a directory and a chart that hold what the save wrote: every row lands on its own stop, nothing is said, nothing is written and nothing is added', () => {
  const rows: readonly Typed[] = [SOUP, { ...SOUP_PLAN, 'Start Date': '6/14/27', 'Instagram Tag': '@oat.house' }, TEA, BOWLING];
  const picks = { [kindOf('Dining Out', 'Soup')]: ON_PLAN('Soup'), [kindOf('Dining Out', 'Tea')]: ON_PLAN('Tea'), [kindOf('Recreation', 'Bowling')]: ONE_OFF('6200') };
  const paste = pasteOf(...rows);
  // BEFORE: four writes, and one addition.
  const before = placePaste(paste, picks, CONTEXT);
  assert.deepEqual(before.map((placement) => placement.kind), ['plan', 'plan', 'plan', 'oneOff']);
  assert.equal(pasteWritesOf(paste.rows, before).length, 4);
  assert.deepEqual(chartAddsOf(before, CONTEXT).map(chartAddWords), ['P-6200 › 10 Bowling']);
  // AFTER — the page as it stands once those are saved: Sunday's soup recorded with its notes, its vendor planned and tagged; Monday's soup planning its items with that vendor; the tea
  // planning its items with the vendor that stood; the evening out a stop of its own name, recorded, with its Location, its minutes, its vendor and the vendor's tag; the Type under its account.
  const soupRecord = recordOf('rec-soup', 'line-soup', SUN, '12:30', { actual_cents: 690, note: 'two bowls', notes: 'sat by the window' });
  const soupSaved = recorded(soupRecord, SUN, '12:30', 'Soup', { vendor: 'Oat House', instagramTag: 'oat.house' });
  const soupAhead = planned('line-soup', MON, '12:30', 'Soup', { went: PLANNED_WORD, vendor: 'Oat House', instagramTag: 'oat.house', plannedItems: 'two bowls' });
  const teaSaved = planned('line-tea', SUN, '16:00', 'Tea', { vendor: 'Bean Bar', instagramTag: 'Bean.Bar', plannedItems: 'a pot of mint' });
  const bowlingRecord = recordOf('rec-bowling', 'line-bowling', SUN, '20:00', { actual_cents: 1800, note: 'two games', notes: 'lane four' });
  const bowlingSaved = recorded(bowlingRecord, SUN, '20:00', 'Bowling', {
    location: 'travel', segments: { entity: 'P', location: 'TRV', category: '6200', type: '10', code: 'P-TRV-6200-10' }, coa: { account: 'P-6200', name: 'Recreation' }, vendor: 'Pin Palace', instagramTag: 'pin_palace', cents: 2000, plannedMinutes: 90,
  });
  const after: PasteContext = {
    ...CONTEXT,
    sheet: [soupSaved, teaSaved, bowlingSaved, soupAhead],
    recording: {
      [soupSaved.key]: entryOf(soupSaved, soupRecord, lineVendor('v-oat', 'Oat House', 'occurrence')),
      [teaSaved.key]: entryOf(teaSaved, null, lineVendor('v-bean', 'Bean Bar', 'occurrence')),
      [bowlingSaved.key]: entryOf(bowlingSaved, bowlingRecord, lineVendor('v-pin', 'Pin Palace', 'occurrence')),
      [soupAhead.key]: entryOf(soupAhead, null, lineVendor('v-oat', 'Oat House', 'occurrence')),
    },
    vendors: [{ ...OAT, instagram_tag: 'oat.house' }, BEAN, INK, { id: 'v-pin', vendor_name: 'Pin Palace', entity_id: 'P', instagram_tag: 'pin_palace' }],
    subAccounts: { P: [{ accountId: 'acct-6200', code: '10', name: 'Bowling' }], B: [] },
  };
  const again = placePaste(paste, picks, after);
  assert.deepEqual(again.map((placement) => (placement.kind === 'plan' ? [placement.stop.key, placement.standing] : placement.kind)), [[soupSaved.key, false], [soupAhead.key, false], [teaSaved.key, false], [bowlingSaved.key, true]]);
  for (const placement of again) {
    const stood = onStop(placement);
    assert.deepEqual([stood.vendor, stood.tag, stood.items, stood.record, stood.notWritten], [{ kind: 'none' }, null, null, null, []], stood.stop.key);
  }
  assert.deepEqual(pasteShown(paste, again).map((row) => row.lands), [
    'on "Soup", its 12:30 stop · already recorded',
    'on "Soup", its 12:30 stop · planned: still ahead',
    'on "Tea", its 16:00 stop · not recorded: no Total (USD)',
    'on the stop "Bowling" at 20:00, already on the time sheet · already recorded',
  ]);
  assert.deepEqual(pasteWritesOf(paste.rows, again), [], 'what is in is never written twice');
  assert.deepEqual(chartAddsOf(again, after), [], 'and nothing is added to the chart');
  // The chart alone holding the Type — the stop not yet written — is still nothing to add, though the row is a new one-off.
  const charted = placePaste(paste, picks, { ...CONTEXT, subAccounts: after.subAccounts });
  assert.deepEqual([charted[3].kind, chartAddsOf(charted, { subAccounts: after.subAccounts })], ['oneOff', []]);
});

// ── T17 · THE CHART'S ANSWERS, AND THE LEAF (3b.3, 3b.4) ─────────────────────

test('T17 the chart’s answers, read: chartOf takes each account’s id — an entry without one is not the chart’s answer; subAccountsOf reads { accountId, code, name } and refuses an answer without its list, by name; in the source the leaf reads each book’s sub-accounts beside its chart, starts the picks at a read, lists the additions under the picks and hands them to the runner; the two rules are still pure', () => {
  assert.deepEqual(chartOf({ accounts: [{ id: 'acct-6150', code: '6150', name: 'Dining Out', is_archived: false }] }), { ok: true, accounts: [{ id: 'acct-6150', code: '6150', name: 'Dining Out' }] });
  assert.deepEqual(chartOf({ accounts: [{ code: '6150', name: 'Dining Out' }] }), { ok: false, words: CHART_NO_ACCOUNTS_WORDS }, 'no id');
  assert.deepEqual(subAccountsOf({ subAccounts: [{ id: 'sub-1', accountId: 'acct-6200', accountCode: '6200', entityId: 'P', code: '10', name: 'Bowling', is_archived: false }] }), { ok: true, subAccounts: [{ accountId: 'acct-6200', code: '10', name: 'Bowling' }] });
  assert.deepEqual(subAccountsOf({ subAccounts: [] }), { ok: true, subAccounts: [] }, 'a list that holds none is a list');
  const refused = { ok: false, words: CHART_NO_SUB_ACCOUNTS_WORDS };
  assert.deepEqual(subAccountsOf({}), refused, 'no list is never an empty one');
  assert.deepEqual(subAccountsOf({ subAccounts: [{ accountId: 'acct-6200', code: 10, name: 'Bowling' }] }), refused, 'a code that is not text');
  assert.deepEqual(subAccountsOf({ subAccounts: [{ code: '10', name: 'Bowling' }] }), refused, 'no account');
  assert.equal(CHART_NO_SUB_ACCOUNTS_WORDS, 'the chart came back without its sub-accounts');
  assert.equal(subAccountsUnreadWords('Home', CHART_NO_SUB_ACCOUNTS_WORDS), 'the sub-accounts of Home could not be read — the chart came back without its sub-accounts');
  // THE LEAF: one read a book, inside the one read function, beside the chart's — a list that cannot be read is said with the book's name.
  const leaf = code(LEAF);
  const reads = between(leaf, 'async function readAgainst(', '\nfunction placedOf(');
  inOrder(reads, [
    'const answer = await readJson(`/api/chart-of-accounts?entity_id=${encodeURIComponent(book.id)}`);',
    'charts[book.id] = chart.accounts;',
    'const listedSubs = await readJson(`/api/chart-of-accounts/sub-accounts?entity_id=${encodeURIComponent(book.id)}`);',
    'if (!listedSubs.ok) return { ok: false, words: subAccountsUnreadWords(book.name, listedSubs.words) };',
    'const subs = subAccountsOf(listedSubs.value);',
    'if (!subs.ok) return { ok: false, words: subAccountsUnreadWords(book.name, subs.words) };',
    'subAccounts[book.id] = subs.subAccounts;',
  ], 'the one read function');
  assert.equal(countOf(leaf, /\/api\/chart-of-accounts\/sub-accounts/g), 1);
  // A READ starts the picks, once, by the rule's own function — and "clear" still forgets them.
  assert.equal(countOf(leaf, /picksAtRead\(/g), 1);
  assert.match(leaf, /setPicks\(\(held\) => picksAtRead\(held, pasteKindsOf\(paste\.value\), against\.value\)\);\n\s*setRows\(\{ paste: paste\.value, context: against\.value \}\);/);
  assert.match(leaf, /setPicks\(\{\}\);/);
  // THE ADDITIONS: worked by the rule, listed under the picks and over the save box — no line when there is none — and handed to the runner and to the button.
  assert.match(leaf, /const adds = chartAddsOf\(placed, read\.context\);/);
  inOrder(leaf, ['data-ledger-paste-picks>', '{shown.adds.length > 0 && (', 'data-ledger-paste-adds>', '{PASTE_ADDS_WORDS}', '<span>{chartAddWords(add)}</span>', '{addOutcomeWords(outcome)}', 'data-ledger-paste-save-box>', 'data-ledger-paste-table>'], 'the box, in order');
  assert.match(leaf, /\}, placed\.saveAdds\);/);
  assert.match(leaf, /data-ledger-paste-save>\{saveWords\(shown\.writes, shown\.saveAdds\)\}<\/button>/);
  // The two rules are still pure: no request, no clock of their own, neither writer's file.
  for (const rule of [RULES, SAVE]) assert.doesNotMatch(code(rule), /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|from 'next|localStorage|sessionStorage|document\.|stopWrites|ledgerWrites/, rule);
});
