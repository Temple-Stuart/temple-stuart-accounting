/**
 * TRAVEL-01c (Alex, 2026-10-31, rulings 0 and A–G) — SUPERSESSION, DERIVED: a routine occurrence whose window shares a
 * minute with a travel block (both instants) is marked "superseded by <block>", never missed; its plan cents leave the
 * day's TOTAL with the count declared; a record wins; nothing is written; a segment stop is named by its own title.
 *
 * The rule (dayCard.ts supersessionOf and the marks in dayStops) is driven over the travel leaf's own fixtures and the
 * reel fixture's routines; the card, the writers and the stops route are read through code() (the reader law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { dayRangeOf, travelDayOf, type BookingIn, type PlannedIn, type SegmentIn, type TravelDay } from '../operations/travelDay';
import type { StopRecordRow } from '../operations/stopRecord';
import {
  CANNOT_SUPERSEDE_NO_END_WORDS, CANNOT_SUPERSEDE_NO_INSTANT_WORDS, NOT_IN_PLAN_WORDS, SUPERSEDED_BY_TRAVEL_WORDS, SUPERSEDED_BY_WORDS,
  andMoreWords, cannotSupersedeWords, captionText, dayStops, dayTotals, dayVerdict, focusStop, scriptText, statusWords, stopSceneLines, supersededLineWords, supersededTotals,
  supersededWords, supersessionOf, travelBlocksOf, travelBookingLineWords, travelOf, travelSaidWords, withoutSuperseded, type OccurrenceWindow, type Stop, type TravelBlock,
} from '@/components/workbench/operations/day/dayCard';
import { BKK, DAY, STAY, entry, input, line, routine } from './fixtureReelDay';
import { reelDay } from './fixtureReelDay';

const DAY_DIR = 'src/components/workbench/operations/day';
const RULES = `${DAY_DIR}/dayCard.ts`;
const CARD = `${DAY_DIR}/DayCard.tsx`;
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';

// ── FIXTURES — the day's routines in Bangkok and the travel leaf's rows, through the leaf ──

const range = (() => { const r = dayRangeOf(DAY); if (!r.ok) throw new Error('fixture'); return r.range; })();
const dec = (text: string) => ({ toFixed: (dp: number) => { const [w, f = ''] = text.split('.'); return `${w}.${f.padEnd(dp, '0').slice(0, dp)}`; } });
const midnight = new Date(`${DAY}T00:00:00.000Z`);
/** A Bangkok wall clock on the day as an instant (UTC+7). */
const bkk = (clock: string): Date => new Date(`${DAY}T${clock}:00.000+07:00`);
const timeOf = (clock: string): string => `1970-01-01T${clock}:00.000Z`;

/** The planned flight 14:10–17:05 Bangkok, both instants stated. */
const flight: PlannedIn = {
  id: 'ti-flight', tripId: 'trip-1', category: 'flight', vendor: 'CNX → DPS', vendor_name: 'AirAsia', cost: dec('189.50'), coa_code: 'P-9100',
  recurrence: 'once', homeDate: midnight, homeTime: '14:10', destDate: midnight, destTime: '17:05', duration_minutes: 175, start_zone: 'Asia/Bangkok', end_zone: 'Asia/Bangkok',
  start_at: bkk('14:10'), end_at: bkk('17:05'), block_start_time: null, block_end_time: null, vendorOptionId: 'opt-f', vendorOptionType: 'flight', note: null,
};
/** Ground transit 15:00–17:00 Bangkok, both instants. */
const transit: PlannedIn = {
  ...flight, id: 'ti-transit', category: 'transfer', vendor: 'Airport transfer', vendor_name: 'Bali Transfers', cost: dec('25'), coa_code: null,
  homeTime: '15:00', destTime: '17:00', duration_minutes: 120, start_zone: null, end_zone: null, start_at: bkk('15:00'), end_at: bkk('17:00'), vendorOptionId: 'opt-t', vendorOptionType: 'transfer',
};
/** A transfer with a start instant and no end — no block. */
const openEnded: PlannedIn = { ...transit, id: 'ti-open', destTime: null, duration_minutes: null, end_at: null };
/** A daily planned row — the band, never a block even with instants. */
const hotel: PlannedIn = {
  ...flight, id: 'ti-hotel', category: 'lodging', vendor: 'Hotel Proof', vendor_name: null, cost: dec('1234.5'), coa_code: 'P-9200', recurrence: 'daily',
  homeDate: new Date('2026-10-13T00:00:00.000Z'), homeTime: '16:00', destDate: new Date('2026-10-17T00:00:00.000Z'), destTime: '11:00', duration_minutes: null,
  block_start_time: new Date(timeOf('16:00')), block_end_time: new Date(timeOf('11:00')), vendorOptionId: 'opt-h', vendorOptionType: 'lodging',
};
const reservation = (over: Partial<BookingIn['reservation']>): BookingIn['reservation'] => ({
  id: 'res-hotel', lane: 'hotel', displayName: 'Hotel PHP Proof', provider: 'liteapi', providerConfirmationCode: 'ABC123', providerBookingId: 'b-1',
  status: 'confirmed', tripId: 'trip-1', checkinDate: midnight, checkoutDate: new Date('2026-10-17T00:00:00.000Z'),
  ticketedAt: null, ticketLimitTime: null, cancelIntentAt: null, lastVendorReadAt: null, finalPriceCents: 1234500, currency: 'PHP', createdAt: new Date('2026-10-01T00:00:00.000Z'),
  ...over,
});
const booking = (over: Partial<BookingIn['reservation']>): BookingIn => ({ reservation: reservation(over), calendarDay: null, chargeMatched: false, chargePosted: false, chargeBank: null, budgetLine: null });
const hotelBooking = booking({});
const flightBooking = booking({ id: 'res-flight', lane: 'flight', displayName: 'AirAsia CNX → DPS', checkinDate: null, checkoutDate: null, finalPriceCents: 18950, currency: 'USD' });
/** The return leg as the airline states it: a title of its own, both instants (14:10–17:05 Bangkok, stated with offsets). */
const seg0: SegmentIn = {
  source_id: 'res-flight:seg:0', title: 'AirAsia DPS → CNX (flight)', status: 'committed', start_date: midnight, end_date: midnight,
  start_time: new Date(timeOf('14:10')), end_time: new Date(timeOf('17:05')), start_at: bkk('14:10'), end_at: bkk('17:05'), start_zone: null, end_zone: null,
};
/** A segment with a clock and no instant — no block. */
const seg1: SegmentIn = { ...seg0, source_id: 'res-flight:seg:1', title: 'AirAsia CNX → DPS (flight)', end_date: null, start_time: new Date(timeOf('21:30')), end_time: null, start_at: null, end_at: null };

const travelOf_ = (planned: PlannedIn[], bookings: BookingIn[], segments: SegmentIn[]): TravelDay => travelDayOf({ range, planned, bookings, segments });

/** The routines: Coworking 13:00–18:00 Bangkok (a window), Dinner at 19:00 (a point), Gym at 15:00 (a point), each priced on the day. */
const AT = { cowork: bkk('13:00').toISOString(), dinner: bkk('19:00').toISOString(), gym: bkk('15:00').toISOString() };
const cowork = routine({ id: 'cowork', name: 'Coworking', role: 'execute', schedule_rrule: 'FREQ=DAILY;BYHOUR=13;BYMINUTE=0', start_time: timeOf('13:00'), end_time: timeOf('18:00') });
const dinner = routine({ id: 'dinner', name: 'Dinner', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=19;BYMINUTE=0' });
const gym = routine({ id: 'gym', name: 'Gym', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=15;BYMINUTE=0' });
const lines = [
  line({ address: { kind: 'routine', id: 'cowork', instant: AT.cowork }, cents: 2500, label: 'Coworking' }),
  line({ address: { kind: 'routine', id: 'dinner', instant: AT.dinner }, cents: 3000, label: 'Dinner' }),
  line({ address: { kind: 'routine', id: 'gym', instant: AT.gym }, cents: 2000, label: 'Gym' }),
];
const record = (id: 'cowork' | 'dinner' | 'gym', actual: number): StopRecordRow => ({
  id: `rec-${id}`, kind: 'routine', target_id: id, occurrence_at: AT[id], outcome: 'done', done_at: AT[id], actual_cents: actual, rating: null, note: null, actual_minutes: null,
});
const day = (travel: TravelDay | null, over: { readonly records?: StopRecordRow[] | null; readonly entries?: ReturnType<typeof entry>[] } = {}) =>
  dayStops(input({ entries: over.entries === undefined ? [entry(cowork, AT.cowork), entry(dinner, AT.dinner), entry(gym, AT.gym)] : over.entries, lines, records: over.records === undefined ? [] : over.records, travel }));
const stopAt = (stops: readonly Stop[], key: string): Stop => {
  const s = stops.find((x) => x.key === key);
  if (s === undefined) throw new Error(`no stop ${key} among ${stops.map((x) => x.key).join(', ')}`);
  return s;
};
const COWORK = `routine:cowork:${AT.cowork}`;
const DINNER = `routine:dinner:${AT.dinner}`;
const GYM = `routine:gym:${AT.gym}`;

// ── A/B · WHAT SUPERSEDES, WHAT IS SUPERSEDED ──────────────────────────────────

test('A/B a planned flight 14:10–17:05 (instants) supersedes Coworking 13:00–18:00 in the same zone — the words; Dinner at 19:00 is not; a point stop (the Gym at 15:00, no length) inside the block is; the segment is named by its own title (item 0)', () => {
  const r = day(travelOf_([flight], [], []));
  const c = stopAt(r.stops, COWORK);
  assert.deepEqual([c.status, c.statusSource, c.cents, c.record], ['skipped', 'travel', 2500, null], 'skipped by the block, its plan figure kept for the struck cell');
  assert.deepEqual(c.superseded, { by: { key: 'travel:planned:ti-flight', kind: 'flight', name: 'AirAsia', time: '14:10', startAt: bkk('14:10').toISOString(), endAt: bkk('17:05').toISOString() }, more: 0 });
  assert.equal(supersededWords(c), 'superseded by Flight AirAsia 14:10');
  assert.equal(statusWords(c, DAY), 'skipped — superseded by Flight AirAsia 14:10');
  const d = stopAt(r.stops, DINNER);
  assert.deepEqual([d.status, d.statusSource, d.superseded], ['open', 'routine', null], 'Dinner at 19:00 shares no minute with 14:10–17:05');
  const g = stopAt(r.stops, GYM);
  assert.deepEqual([g.status, g.superseded === null ? null : g.superseded.by.key], ['skipped', 'travel:planned:ti-flight'], 'a point at 15:00 inside the block');
  // The segment, as the airline states it: named by its title, the booking's name on its BOOKING line.
  const withSegment = day(travelOf_([], [flightBooking], [seg0]));
  const seg = stopAt(withSegment.stops, 'travel:segment:res-flight:seg:0');
  assert.equal(seg.label, 'AirAsia DPS → CNX (flight)');
  assert.deepEqual([travelOf(seg).name, travelOf(seg).bookingName, travelBookingLineWords(seg)], ['AirAsia DPS → CNX (flight)', 'AirAsia CNX → DPS', 'AirAsia CNX → DPS']);
  assert.equal(supersededWords(stopAt(withSegment.stops, COWORK)), 'superseded by Flight AirAsia DPS → CNX (flight) 14:10');
  assert.equal(travelBookingLineWords(stopAt(day(travelOf_([], [hotelBooking], [])).stops, 'travel:booking:res-hotel:check-in')), null, 'a booking row’s name IS the booking’s — no second line');
  assert.equal(travelBookingLineWords(stopAt(r.stops, 'travel:planned:ti-flight')), null);
});

test('A ground transit 15:00–17:00 (instants) supersedes Coworking; a block with no end cannot supersede and says so; a booking is never a block; a daily planned row is never a block; a segment with no instant says so', () => {
  const transitDay = day(travelOf_([transit], [], []));
  assert.equal(supersededWords(stopAt(transitDay.stops, COWORK)), 'superseded by Transfer Bali Transfers 15:00');
  const open = day(travelOf_([openEnded], [], []));
  assert.equal(stopAt(open.stops, COWORK).superseded, null, 'no end: no window');
  const openStop = stopAt(open.stops, 'travel:planned:ti-open');
  assert.equal(cannotSupersedeWords(travelOf(openStop)), CANNOT_SUPERSEDE_NO_END_WORDS);
  assert.ok((travelSaidWords(openStop) as string).endsWith(` · ${CANNOT_SUPERSEDE_NO_END_WORDS}`), 'said on the stop');
  const booked = day(travelOf_([], [hotelBooking], []));
  assert.equal(stopAt(booked.stops, COWORK).superseded, null);
  const check = stopAt(booked.stops, 'travel:booking:res-hotel:check-in');
  assert.equal(cannotSupersedeWords(travelOf(check)), CANNOT_SUPERSEDE_NO_INSTANT_WORDS);
  assert.ok((travelSaidWords(check) as string).endsWith(` · ${CANNOT_SUPERSEDE_NO_INSTANT_WORDS}`));
  const daily = day(travelOf_([{ ...hotel, start_at: bkk('00:00'), end_at: bkk('23:59') }], [], []));
  assert.equal(stopAt(daily.stops, COWORK).superseded, null, 'the band is never a block, even with instants');
  assert.deepEqual(travelBlocksOf(daily.stops), [], 'the band never enters');
  assert.equal(stopAt(day(travelOf_([], [flightBooking], [seg1])).stops, COWORK).superseded, null);
  assert.equal(cannotSupersedeWords({ startAt: null, endAt: null }), CANNOT_SUPERSEDE_NO_INSTANT_WORDS);
  assert.equal(cannotSupersedeWords({ startAt: 'x', endAt: null }), CANNOT_SUPERSEDE_NO_END_WORDS);
  assert.equal(cannotSupersedeWords({ startAt: 'x', endAt: 'y' }), null);
  // The blocks of a day: the planned flight and the segment, both instants; the open-ended transfer and the bookings are not.
  const all = day(travelOf_([flight, openEnded], [hotelBooking, flightBooking], [seg0, seg1]));
  assert.deepEqual(travelBlocksOf(all.stops).map((b) => b.key), ['travel:planned:ti-flight', 'travel:segment:res-flight:seg:0']);
});

test('B a record at the occurrence wins — not marked; a routine the today read calls missed is skipped by the block, never missed; a stop whose window merely touches the block shares no minute', () => {
  const recorded = day(travelOf_([flight], [], []), { records: [record('cowork', 1200)] });
  const c = stopAt(recorded.stops, COWORK);
  assert.deepEqual([c.superseded, c.status, c.statusSource, c.actualCents], [null, 'done', 'record', 1200], 'reality wins');
  assert.equal(stopAt(recorded.stops, GYM).superseded === null, false, 'the Gym, unrecorded, is still marked');
  const missed = day(travelOf_([flight], [], []), { entries: [entry(cowork, AT.cowork), { ...entry(gym, AT.gym), status: 'missed' }, entry(dinner, AT.dinner)] });
  assert.deepEqual([stopAt(missed.stops, GYM).status, stopAt(missed.stops, GYM).statusSource], ['skipped', 'travel'], 'the today read’s miss (routineDay.ts routineStatus) never shows for a superseded stop');
  assert.doesNotMatch(statusWords(stopAt(missed.stops, GYM), DAY), /missed/);
  // Touching: a block 18:00–19:00 against Coworking 13:00–18:00 shares no minute; 17:59–18:30 shares one.
  const touching = day(travelOf_([{ ...transit, id: 'ti-touch', homeTime: '18:00', destTime: '19:00', duration_minutes: 60, start_at: bkk('18:00'), end_at: bkk('19:00') }], [], []));
  assert.equal(stopAt(touching.stops, COWORK).superseded, null);
  const sharing = day(travelOf_([{ ...transit, id: 'ti-share', homeTime: '17:59', destTime: '18:30', duration_minutes: 31, start_at: bkk('17:59'), end_at: bkk('18:30') }], [], []));
  assert.equal(stopAt(sharing.stops, COWORK).superseded === null, false);
  // The pure rule over its own inputs: instants compare as instants.
  const block: TravelBlock = { key: 'b', kind: 'flight', name: 'X', time: '14:10', startAt: bkk('14:10').toISOString(), endAt: bkk('17:05').toISOString() };
  const o = (key: string, at: string, minutes: number | null, hasRecord = false): OccurrenceWindow => ({ key, at: bkk(at), minutes, hasRecord });
  const marks = supersessionOf([block], [o('in', '13:00', 300), o('point', '15:00', null), o('zero', '16:00', 0), o('before', '10:00', 60), o('after', '17:05', null), o('rec', '15:00', null, true)]);
  assert.deepEqual([...marks.keys()], ['in', 'point', 'zero']);
  assert.throws(() => supersessionOf([{ ...block, endAt: block.startAt }], []), /not after its start/);
  assert.throws(() => supersessionOf([{ ...block, startAt: 'soon' }], []), /is not an instant/);
});

test('C two blocks over one stop: the earliest by instant is named, "and 1 more"; a tie by instant falls to the table’s order; the scene names the block; the deck card keeps its address (the record input mounts)', () => {
  const two = day(travelOf_([flight, transit], [], []));
  const c = stopAt(two.stops, COWORK);
  assert.deepEqual([c.superseded === null ? null : c.superseded.by.key, c.superseded === null ? null : c.superseded.more], ['travel:planned:ti-flight', 1]);
  assert.equal(supersededWords(c), 'superseded by Flight AirAsia 14:10 and 1 more');
  assert.equal(andMoreWords(2), 'and 2 more');
  assert.equal(SUPERSEDED_BY_WORDS, 'superseded by');
  const tie = day(travelOf_([flight], [flightBooking], [seg0]));
  assert.deepEqual(supersededWords(stopAt(tie.stops, COWORK)), 'superseded by Flight AirAsia 14:10 and 1 more', 'the same instants: the planned flight, first in the table, is named');
  assert.deepEqual(stopSceneLines(c, null), ['Coworking: skipped.', 'superseded by Flight AirAsia 14:10 and 1 more'], 'an execute stop with no length: no block line');
  assert.deepEqual(stopSceneLines(stopAt(two.stops, GYM)), ['Gym: skipped.', 'superseded by Flight AirAsia 14:10 and 1 more']);
  assert.notEqual(c.address, null, 'the record input stays — recording anyway is allowed');
  assert.throws(() => supersededWords(stopAt(two.stops, DINNER)), /is not superseded/);
  const script = scriptText(reelDay(two, { stay: STAY }));
  assert.ok(script.ok && script.text.includes('Coworking: skipped.\nsuperseded by Flight AirAsia 14:10 and 1 more'), 'the reel names the supersession');
  const caption = captionText(reelDay(two, { stay: STAY }));
  assert.ok(caption.ok && !caption.text.includes('Coworking'), 'no record, no money: no caption block, as any unrecorded stop');
});

// ── D · THE DAY'S PLAN ───────────────────────────────────────────────────────

test('D the TOTAL’s budget excludes the superseded cents; the hero follows; the declared line reads exactly; plan so far excludes them; the verdict uses the reduced plan and is held back by no superseded stop', () => {
  const none = day(null);
  assert.deepEqual([none.plannedCents, dayTotals(withoutSuperseded(none), none.plannedCents).budgetCents], [7500, 7500]);
  const r = day(travelOf_([flight], [], []));
  const t = supersededTotals(r.stops);
  assert.deepEqual(t, { count: 2, cents: 4500 }, 'Coworking $25 and the Gym $20');
  assert.equal(supersededLineWords(t), "2 routines superseded by travel — $45.00 not in today's plan");
  assert.equal(supersededLineWords({ count: 1, cents: 2500 }), "1 routine superseded by travel — $25.00 not in today's plan");
  assert.equal(supersededLineWords({ count: 0, cents: 0 }), null);
  assert.deepEqual([SUPERSEDED_BY_TRAVEL_WORDS, NOT_IN_PLAN_WORDS], ['superseded by travel', "not in today's plan"]);
  assert.equal(r.plannedCents, 3000, 'the hero: $75 less $45');
  const totals = dayTotals(withoutSuperseded(r), r.plannedCents);
  assert.deepEqual([totals.budgetCents, totals.beyondCents], [3000, null], 'the TOTAL row: Dinner alone; nothing off the table');
  assert.deepEqual(r.stops.map((s) => [s.key === COWORK ? 'cowork' : s.key === GYM ? 'gym' : s.key === DINNER ? 'dinner' : 'travel', s.cents]), [['cowork', 2500], ['travel', null], ['gym', 2000], ['dinner', 3000]], 'the struck figures stay on their rows');
  const last = focusStop(r, r.stops.length);
  assert.equal(last === null ? null : last.soFarCents, 3000, 'plan so far excludes the superseded');
  // The verdict: Dinner recorded, the two superseded stops unrecorded — the verdict computes on the reduced plan.
  const done = day(travelOf_([flight], [], []), { records: [record('dinner', 2800)] });
  const dt = dayTotals(withoutSuperseded(done), done.plannedCents);
  assert.deepEqual(dayVerdict(done, dt.budgetCents), { text: '▼ $2 under', over: false });
  assert.equal(dayVerdict(day(null, { records: [record('dinner', 2800)] }), 7500), null, 'without the block, Coworking and the Gym hold it back');
  // The record wins AND its cents return to the plan.
  const back = day(travelOf_([flight], [], []), { records: [record('cowork', 1200), record('gym', 2000), record('dinner', 2800)] });
  assert.deepEqual([supersededTotals(back.stops).count, back.plannedCents, dayTotals(withoutSuperseded(back), back.plannedCents).budgetCents], [0, 7500, 7500]);
  assert.deepEqual(dayVerdict(back, 7500), { text: '▼ $15 under', over: false });
});

// ── E/F/G · NEVER WRITTEN; THE WORDS; THE DOES-NOTS ─────────────────────────

test('E derived, never written: the rules fetch and write nothing; the stops route and the writers know no supersession; the card’s mark, line and strike are reads of dayStops’ output', () => {
  const rules = code(RULES);
  assert.doesNotMatch(rules, /\bfetch\s*\(|prisma|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/, 'pure');
  for (const f of [STOPS_ROUTE, 'src/app/api/operations/stops/[id]/route.ts', 'src/components/workbench/operations/stops/stopWrites.ts', 'src/components/workbench/operations/stops/journalWrites.ts', 'src/components/workbench/operations/stops/StopForm.tsx', 'src/app/api/audit-log/route.ts']) {
    assert.doesNotMatch(code(f), /supersed/i, `${f} knows no supersession`);
  }
  assert.doesNotMatch(comments(STOPS_ROUTE), /TRAVEL-01c|supersed/i, 'the stops route is untouched');
  assert.ok(code(STOPS_ROUTE).includes("export async function POST(") && code(STOPS_ROUTE).includes("export async function GET("), 'the one writer of stop records, as it was');
  const c = code(CARD);
  assert.doesNotMatch(c, /\bfetch\s*\(/, 'the card fetches nothing of its own');
  for (const site of c.split('\n').filter((l) => /supersed/i.test(l))) assert.doesNotMatch(site, /fetch\(|POST|PATCH|DELETE|write|setJournal|setStop|audit/, `a read, never a write: ${site.trim().slice(0, 80)}`);
  assert.match(c, /const totals = dayTotals\(withoutSuperseded\(result\), plannedCents\);/);
  assert.match(c, /const supersededLine = supersededLineWords\(supersededTotals\(result\.stops\)\);/);
  assert.match(c, /\{supersededLine !== null && \(\n\s*<tr className="border-t border-border align-top" data-day-superseded-line>\n\s*<td colSpan=\{5\}[^>]*>\{supersededLine\}<\/td>\n\s*<\/tr>\n\s*\)\}/, 'the declared line under the TOTAL row, before the TRAVEL lines');
  assert.ok(c.indexOf('data-day-superseded-line') > c.indexOf('data-day-total>') && c.indexOf('data-day-superseded-line') < c.indexOf('data-day-travel-line'));
  assert.match(c, /data-day-superseded=\{s\.superseded === null \? undefined : 'true'\}/);
  assert.match(c, /\$\{s\.superseded === null \? '' : 'line-through '\}/, 'the struck plan figure');
  assert.match(c, /\{f\.stop\.superseded !== null && <div [^>]*data-day-superseded-words>\{supersededWords\(f\.stop\)\}<\/div>\}/, 'the mark on the deck card');
  assert.match(c, /\{loaded && recordsOk && focus !== null && focus\.stop\.address !== null && \(\n\s*<StopForm/, 'the record input still mounts by address — a superseded stop has one');
  assert.match(c, /data-day-travel-booking>/, 'item 0: the BOOKING line on the travel card');
  assert.match(comments(CARD), /\/budget and ROUTINE EXPENSES' month are unchanged/, 'the header says so in one sentence');
});

test('F/G the words are constants or functions in dayCard.ts; the supersession section holds no || and no ?? default and never a wall clock; asksAmount and travelDay.ts’s shape are unchanged; a segment’s title is read, not a second shape', () => {
  const rules = code(RULES);
  const section = rules.slice(rules.indexOf("export const SUPERSEDED_BY_WORDS = 'superseded by';"), rules.indexOf('export type VendorSlot ='));
  assert.ok(section.length > 1500);
  assert.doesNotMatch(section, /\|\||\?\? /, 'no || and no ?? default');
  assert.doesNotMatch(section, /instantToZoned|zonedToInstant|getHours|getMinutes|toLocale|timezone|zone\b/i, 'instants compare as instants — no wall clock, no zone');
  assert.doesNotMatch(section, /new Date\(\)|Date\.now\(/, 'no clock');
  for (const word of ["export const CANNOT_SUPERSEDE_NO_END_WORDS = 'cannot supersede — no end stated';", "export const CANNOT_SUPERSEDE_NO_INSTANT_WORDS = 'cannot supersede — no instant';", "export const andMoreWords = (n: number): string => `and ${n} more`;"]) assert.ok(rules.includes(word), word);
  assert.match(rules, /export const asksAmount = \(role: StopRole\): boolean => role === 'place' \|\| role === 'none';/, 'unchanged');
  assert.match(rules, /export type StatusSource = 'record' \| 'routine' \| 'task' \| 'booking' \| 'travel';/);
  assert.match(rules, /readonly superseded: Supersession \| null;\n\s*\{\s*\}\n\s*readonly travel: TravelStop \| null;\n\}|readonly superseded: Supersession \| null;\n(?:\s*\{\s*\}\n)?\s*readonly travel: TravelStop \| null;\n\}/, 'the stop carries its mark');
  assert.match(rules, /source: 'segment', kind: 'flight', name: row\.title, bookingName: row\.row\.name,/, 'item 0: the segment’s own stated title; the booking’s name beside it');
  assert.match(rules, /if \(stop\.statusSource === 'travel'\) return skippedWords\(supersededWords\(stop\)\);/);
  assert.match(rules, /plannedCents: dayLines\.reduce\(\(sum, l\) => sum \+ l\.cents, 0\) - supersededTotals\(stops\)\.cents,/, 'the hero less the superseded cents');
  // The leaf's shape is untouched (01b's test pins its fields): title, startAt and endAt were already there.
  const leaf = code('src/lib/operations/travelDay.ts');
  assert.match(leaf, /export interface TravelSegmentRow extends BookingLinks \{[\s\S]*?readonly title: string;[\s\S]*?readonly startAt: string \| null;\n\s*readonly endAt: string \| null;/);
  assert.doesNotMatch(leaf, /supersed|TRAVEL-01c/i, 'the read’s shape is unchanged');
  assert.doesNotMatch(code('src/app/api/trips/day-blocks/route.ts'), /supersed/i);
  assert.equal(BKK, 'Asia/Bangkok');
});
