/**
 * TRIPDATE-01 (2026-10-01) — A DATE EDIT MOVES THE DAY.
 *
 * The pure rules probed (src/lib/trips/itineraryEdit.ts), and the PATCH, the budget route,
 * the ledger, the timeline and the calendar registry read from source through the two
 * readers (TEST-TRUTH-01), for R1–R7.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  CLOCK_FIXED_WORDS,
  ITINERARY_DATE_KEYS,
  ITINERARY_DATE_TIME_KEYS,
  clockIsFixed,
  datesAfterEdit,
  rangeRefusal,
  tripVendorSourceId,
  utcDay,
  type ItineraryDates,
} from '../trips/itineraryEdit';
import { parseTripVendorSourceId } from '../calendar/tripItem';
import { CALENDAR_SOURCES } from '../calendar/sources';

const LEAF = 'src/lib/trips/itineraryEdit.ts';
const PATCH = 'src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts';
const BUDGET = 'src/app/api/trips/[id]/budget/route.ts';
const LEDGER = 'src/components/trips/TripBudgetActual.tsx';
const TIMELINE = 'src/components/trips/TripTimelineView.tsx';
const COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const LAW = 'scripts/assert-tool-registry.ts';

const day = (d: string) => new Date(`${d}T00:00:00Z`);

test('TRIPDATE-01 R4: clockIsFixed — a flight, stated or not, and any stated start_at; nothing else', () => {
  const table: Array<[string, Parameters<typeof clockIsFixed>[0], boolean]> = [
    ['a flight with start_at', { vendorOptionType: 'flight', start_at: new Date('2026-03-01T08:15:00Z') }, true],
    ['a flight without start_at', { vendorOptionType: 'flight', start_at: null }, true],
    ['a timed tour', { vendorOptionType: 'activity', start_at: new Date('2026-03-02T02:00:00Z') }, true],
    ['a timed tour, as JSON', { vendorOptionType: 'activity', start_at: '2026-03-02T02:00:00.000Z' }, true],
    ['an untimed activity', { vendorOptionType: 'activity', start_at: null }, false],
    ['a stay', { vendorOptionType: 'lodging', start_at: null }, false],
    ['a transfer', { vendorOptionType: 'transfer', start_at: null }, false],
    ['a vehicle', { vendorOptionType: 'vehicle', start_at: null }, false],
    ['a row with no vendor option', { vendorOptionType: null, start_at: null }, false],
    ['a row with neither field', {}, false],
  ];
  for (const [name, row, want] of table) assert.equal(clockIsFixed(row), want, name);
  assert.match(CLOCK_FIXED_WORDS, /re-commit the item to change its dates or times/);
  assert.deepEqual([...ITINERARY_DATE_TIME_KEYS], ['date', 'startDate', 'endDate', 'startTime', 'endTime', 'blockStartTime', 'blockEndTime']);
  assert.deepEqual([...ITINERARY_DATE_KEYS], ['date', 'startDate', 'endDate']);
});

test('TRIPDATE-01 R1: the calendar key round-trips through parseTripVendorSourceId and is the one vendor-commit writes', () => {
  for (const [tripId, optionId] of [['cm1trip0001', 'cm1opt0001'], ['trip-2', 'act:27424P2:TG1'], ['t', 'place-ChIJ123']]) {
    const key = tripVendorSourceId(tripId, optionId);
    assert.equal(key, `trip:${tripId}:vendor:${optionId}`);
    assert.deepEqual(parseTripVendorSourceId(key), { tripId, optionId });
  }
  const templates = [...code(COMMIT).matchAll(/const calSourceId = `([^`]*)`;/g)].map((m) => m[1]);
  assert.equal(templates.length, 2, 'the insert and the delete each build the key');
  for (const t of templates) assert.equal(t.replace('${id}', 'T').replace('${optionId}', 'O'), tripVendorSourceId('T', 'O'));
});

/** The PATCH’s date keys onto the row’s two dates, as it assigns them (asserted from source below). */
function setBy(body: { date?: string; startDate?: string; endDate?: string }): { homeDate?: Date; destDate?: Date } {
  const set: { homeDate?: Date; destDate?: Date } = {};
  if (body.date !== undefined) { set.homeDate = day(body.date); set.destDate = day(body.date); }
  if (body.startDate !== undefined) set.homeDate = day(body.startDate);
  if (body.endDate !== undefined) set.destDate = day(body.endDate);
  return set;
}

test('TRIPDATE-01 R3: the range rule on every key combination', () => {
  const stored: ItineraryDates = { homeDate: day('2026-03-05'), destDate: day('2026-03-08') };
  const refusal = (end: string, start: string) => `the end date ${end} is before the start date ${start} — a range runs forward; move the start or the end`;
  const cases: Array<[string, Parameters<typeof setBy>[0], string | null]> = [
    ['date (one day: always ordered)', { date: '2026-03-20' }, null],
    ['startDate alone, inside the range', { startDate: '2026-03-06' }, null],
    ['startDate alone, on the end', { startDate: '2026-03-08' }, null],
    ['startDate alone, past the stored end', { startDate: '2026-03-09' }, refusal('2026-03-08', '2026-03-09')],
    ['endDate alone, inside the range', { endDate: '2026-03-07' }, null],
    ['endDate alone, before the stored start', { endDate: '2026-03-04' }, refusal('2026-03-04', '2026-03-05')],
    ['both, forward (past the stored end — the start alone would be refused)', { startDate: '2026-03-10', endDate: '2026-03-12' }, null],
    ['both, reversed', { startDate: '2026-03-12', endDate: '2026-03-10' }, refusal('2026-03-10', '2026-03-12')],
  ];
  for (const [name, body, want] of cases) assert.equal(rangeRefusal(datesAfterEdit(stored, setBy(body))), want, name);
  // A date is compared as its UTC day.
  assert.equal(rangeRefusal({ homeDate: new Date('2026-03-01T23:00:00Z'), destDate: new Date('2026-03-01T01:00:00Z') }), null);
  assert.equal(rangeRefusal({ homeDate: new Date('2026-03-02T00:00:00Z'), destDate: new Date('2026-03-01T23:59:59Z') }), refusal('2026-03-01', '2026-03-02'));
  assert.equal(utcDay(new Date('2026-03-01T23:59:59Z')), '2026-03-01');
  // A time-only edit carries the stored dates.
  const timeOnly = datesAfterEdit(stored, {});
  assert.equal(timeOnly.homeDate, stored.homeDate);
  assert.equal(timeOnly.destDate, stored.destDate);
  // The PATCH assigns the keys the way setBy models them.
  const patch = code(PATCH);
  assert.match(patch, /data\.homeDate = d;\n\s+data\.destDate = d;/);
  assert.match(patch, /if \(body\.startDate !== undefined\) \{[\s\S]*?data\.homeDate = d;\n\s+\}/);
  assert.match(patch, /if \(body\.endDate !== undefined\) \{[\s\S]*?data\.destDate = d;\n\s+\}/);
});

test('TRIPDATE-01 R1: the PATCH writes the row and its calendar row in one array-form transaction, on every edit', () => {
  const patch = code(PATCH);
  assert.equal(patch.split('prisma.$transaction(').length - 1, 1);
  assert.equal(patch.split('prisma.trip_itinerary.update(').length - 1, 1, 'the one update the stay law and hotel02 read');
  assert.match(patch, /\n {4}const itineraryWrite = prisma\.trip_itinerary\.update\(\{ where: \{ id: itineraryId \}, data \}\);\n/);
  assert.match(patch, /\n {4}const calendarKey = tripVendorSourceId\(existing\.tripId, existing\.vendorOptionId\);\n/);
  assert.match(patch, /\n {4}const \[updated, calendar\] = await prisma\.\$transaction\(\[\n {6}itineraryWrite,\n {6}prisma\.calendar_events\.updateMany\(\{\n {8}where: \{ user_id: user\.id, source: 'trip', source_id: calendarKey \},\n {8}data: \{ start_date: after\.homeDate, end_date: after\.destDate \},\n {6}\}\),\n {4}\]\);/);
  // The row after the edit: computed once, before the write.
  const afterAt = patch.indexOf('const after = datesAfterEdit(\n      { homeDate: existing.homeDate, destDate: existing.destDate },');
  assert.ok(afterAt > 0 && afterAt < patch.indexOf('prisma.trip_itinerary.update('));
  // A row with no vendor option: the itinerary write alone.
  assert.match(patch, /if \(existing\.vendorOptionId === null\) \{\n\s+const itinerary = await itineraryWrite;\n\s+return NextResponse\.json\(\{ itinerary, calendar: \{ moved: 0, reason: 'no_vendor_option' \} \}\);\n\s+\}/);
  // No other calendar write, no reservation, no raw SQL.
  assert.deepEqual([...patch.matchAll(/calendar_events\.(\w+)\(/g)].map((m) => m[1]), ['updateMany']);
  assert.doesNotMatch(patch, /\$queryRaw|\$executeRaw|\breservations?\b/i);
});

test('TRIPDATE-01 R2: the answer names the calendar outcome; moved 0 is logged by name', () => {
  const patch = code(PATCH);
  assert.match(patch, /return NextResponse\.json\(\{ itinerary: updated, calendar: \{ moved: calendar\.count \} \}\);/);
  assert.match(patch, /if \(calendar\.count === 0\) \{\n\s+console\.log\(`\[Trip Itinerary PATCH\] TRIPDATE-01: itinerary \$\{itineraryId\} moved; no calendar row \$\{calendarKey\} to move/);
});

test('TRIPDATE-01 R3/R4: the refusals come before any write; the HOTEL-02 refusal stands ahead of the fixed clock', () => {
  const patch = code(PATCH);
  const write = patch.indexOf('prisma.trip_itinerary.update(');
  const hotel = patch.indexOf("if (existing.vendorOptionType === 'flight' && (body.blockStartTime !== undefined || body.blockEndTime !== undefined)) {");
  const fixed = patch.indexOf('if (clockIsFixed(existing)) {\n      const sent = ITINERARY_DATE_TIME_KEYS.find((k) => body[k] !== undefined);');
  const fixedAnswer = patch.indexOf("return NextResponse.json({ error: 'Validation', field: sent, message: CLOCK_FIXED_WORDS }, { status: 400 });");
  const range = patch.indexOf("if (dateKey !== undefined) {\n      const refused = rangeRefusal(after);\n      if (refused) return NextResponse.json({ error: 'Validation', field: dateKey, message: refused }, { status: 400 });");
  assert.ok(hotel > 0 && hotel < fixed && fixed < fixedAnswer && fixedAnswer < patch.indexOf('data.block_start_time =') && range > fixedAnswer && range < write, `${hotel} ${fixed} ${fixedAnswer} ${range} ${write}`);
  assert.ok(patch.includes('a flight has no block window — its departure and arrival were written by its commit with their zones; re-commit the flight to change them'));
});

test('TRIPDATE-01 R5: no screen offers what the route refuses — one rule, three callers', () => {
  const budget = code(BUDGET);
  assert.match(budget, /\bstart_at: true,/);
  assert.match(budget, /\n\s+clockFixed: itin \? clockIsFixed\(itin\) : null,\n/);
  const ledger = code(LEDGER);
  const cells = [...ledger.matchAll(/<EditableCell kind="(?:date|time)" value=\{it\.(\w+)\} editable=\{!!it\.itineraryId && it\.clockFixed !== true\} title=\{it\.clockFixed === true \? CLOCK_FIXED_WORDS : undefined\} onSave=\{\(v\) => saveCell\(it, '(\w+)', v\)\} \/>/g)];
  assert.deepEqual(cells.map((c) => c[1]), ['startDate', 'startTime', 'endDate', 'endTime']);
  assert.equal(ledger.split('<EditableCell ').length - 1, 4);
  assert.match(ledger, /if \(!editable\) return <span className="text-text-faint" title=\{title\}>\{display\}<\/span>;/);
  const timeline = code(TIMELINE);
  assert.match(timeline, /\) : clockIsFixed\(row\) \? \(\n\s+<span className="text-white whitespace-nowrap" title=\{CLOCK_FIXED_WORDS\} data-itinerary-clock-fixed>/);
  assert.ok(timeline.indexOf(') : clockIsFixed(row) ? (') < timeline.indexOf('onClick={() => setEditing(true)} title="Edit time"'));
  assert.equal(timeline.split('setEditing(true)').length - 1, 1);
  assert.match(timeline, /\n\s+start_at\?: string \| null;\n/);
  // Defined once, in the pure leaf.
  assert.match(code(LEAF), /export function clockIsFixed\(row: ClockRow\): boolean \{/);
  assert.doesNotMatch(code(LEAF), /^\s*import\b|\bprisma\b|\bfetch\(|process\.env/m);
  assert.match(comments(LEAF), /THIS FILE IS PURE/);
  for (const f of [PATCH, BUDGET, TIMELINE]) assert.match(code(f), /import \{[^}]*\bclockIsFixed\b[^}]*\} from '@\/lib\/trips\/itineraryEdit';/, f);
});

test('TRIPDATE-01 R6: the timeline’s range takes the trip’s days and every item’s', () => {
  const timeline = code(TIMELINE);
  assert.ok(timeline.includes('const startBounds = [startDate ? dateOnly(startDate) : null, itinSorted[0] ?? null].filter((d): d is string => !!d).sort();'));
  assert.ok(timeline.includes('const endBounds = [endDate ? dateOnly(endDate) : null, itinSorted.at(-1) ?? null].filter((d): d is string => !!d).sort();'));
  assert.ok(timeline.includes('const rangeStart = startBounds[0] ?? null;'));
  assert.ok(timeline.includes('const rangeEnd = endBounds.at(-1) ?? null;'));
  assert.doesNotMatch(timeline, /const rangeStart = startDate \? dateOnly\(startDate\) :/, 'the trip’s stated start alone no longer decides the range');
});

test('TRIPDATE-01 R7: the calendar registry names the PATCH beside vendor-commit’s insert', () => {
  const trip = CALENDAR_SOURCES.find((r) => r.source === 'trip');
  assert.ok(trip);
  const patch = code(PATCH);
  const line = patch.slice(0, patch.indexOf('prisma.calendar_events.updateMany(')).split('\n').length;
  assert.ok(trip.writtenBy.includes(`${PATCH}:${line} (PATCH — TRIPDATE-01`), trip.writtenBy);
  const commit = code(COMMIT);
  const insertLine = commit.slice(0, commit.indexOf('INSERT INTO calendar_events')).split('\n').length;
  assert.ok(trip.writtenBy.startsWith(`${COMMIT}:${insertLine} (`), trip.writtenBy);
});

test('TRIPDATE-01: the trip date law is its own guard', () => {
  assert.match(code(LAW), /lawGuard\('The trip date law', \(\) => \{/);
  assert.match(code(LAW), /trip date law: \$\{m\} \(TRIPDATE-01\)/);
});
