/**
 * TRIPDATE-01 (2026-10-01) — A DATE EDIT MOVES THE DAY: seeded regressions.
 *
 * The ruling: an itinerary date edit moves the item’s calendar row in the same transaction;
 * a range stays ordered; a clock a vendor fixed does not move in place; the timeline never
 * hides an item. Each seed puts back, one at a time, a shape the trip date law forbids —
 * at least one per clause:
 *
 *   1. one transaction, two rows: the calendar move outside the transaction, the where
 *      without the caller, the key from the URL, a key that does not parse back, dates
 *      that are not the row’s after the edit, a move gated on a date key, a datesAfterEdit
 *      that invents a date, the registry no longer naming the PATCH (R7);
 *   2. the range: the refusal logged instead of answered; a rule that compares instants;
 *   3. the fixed clock: the rule blind to start_at, a refusal of the time keys alone, the
 *      HOTEL-02 words changed, a key list missing date;
 *   4. one rule: a second definition, an ungated ledger cell, the timeline’s edit control
 *      offered on a fixed clock, the budget route not selecting start_at, a fourth caller;
 *   5. booked stays: a reservation’s calendar row moved too, vendor-commit’s delete changed;
 *   6. the timeline: the trip’s stated start alone decides the range again;
 *   7. the answer: no calendar outcome; moved 0 not logged.
 *
 * Each must fail the build by name. Every find occurs exactly once in its file, which the
 * harness enforces first.
 */
import type { Seed } from '../prove';

const LEAF = 'src/lib/trips/itineraryEdit.ts';
const PATCH = 'src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts';
const BUDGET = 'src/app/api/trips/[id]/budget/route.ts';
const LEDGER = 'src/components/trips/TripBudgetActual.tsx';
const TIMELINE = 'src/components/trips/TripTimelineView.tsx';
const SOURCES = 'src/lib/calendar/sources.ts';
const COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';

const SEEDS: Seed[] = [
  // ── 1. ONE TRANSACTION, TWO ROWS ──
  {
    name: 'tripdate01-a the itinerary write leaves the transaction',
    file: PATCH,
    find: '    const [updated, calendar] = await prisma.$transaction([\n      itineraryWrite,\n      prisma.calendar_events.updateMany({',
    replace: '    const updated = await itineraryWrite;\n    const [calendar] = await prisma.$transaction([\n      prisma.calendar_events.updateMany({',
    expect: 'it holds the itinerary write and the calendar updateMany, those two',
  },
  {
    name: 'tripdate01-b the calendar where no longer names the caller',
    file: PATCH,
    find: "        where: { user_id: user.id, source: 'trip', source_id: calendarKey },",
    replace: "        where: { source: 'trip', source_id: calendarKey },",
    expect: 'the calendar where does not name user_id: user.id, source trip and the row’s own key',
  },
  {
    name: 'tripdate01-c the key is built from the URL’s trip, not the row’s own',
    file: PATCH,
    find: '    const calendarKey = tripVendorSourceId(existing.tripId, existing.vendorOptionId);',
    replace: '    const calendarKey = tripVendorSourceId(tripId, existing.vendorOptionId);',
    expect: 'does not build the calendar key once, from the row’s own tripId and vendorOptionId',
  },
  {
    name: 'tripdate01-d the leaf’s key no longer parses back',
    file: LEAF,
    find: '  return `trip:${tripId}:vendor:${vendorOptionId}`;',
    replace: '  return `trip:${tripId}:${vendorOptionId}`;',
    expect: 'does not parse back through parseTripVendorSourceId',
  },
  {
    name: 'tripdate01-e the calendar row takes the body’s dates, not the row’s after the edit',
    file: PATCH,
    find: '        data: { start_date: after.homeDate, end_date: after.destDate },',
    replace: '        data: { start_date: data.homeDate as Date, end_date: data.destDate as Date },',
    expect: 'the calendar row’s start_date and end_date are not the row’s after the edit',
  },
  {
    name: 'tripdate01-f a time-only edit skips the calendar row',
    file: PATCH,
    find: '    const calendarKey = tripVendorSourceId(existing.tripId, existing.vendorOptionId);\n',
    replace: '    if (dateKey === undefined) {\n      const itinerary = await itineraryWrite;\n      return NextResponse.json({ itinerary, calendar: { moved: 0 } });\n    }\n    const calendarKey = tripVendorSourceId(existing.tripId, existing.vendorOptionId);\n',
    expect: 'it runs on every edit (a time-only one included)',
  },
  {
    name: 'tripdate01-g datesAfterEdit invents an end from the start',
    file: LEAF,
    find: '    destDate: set.destDate !== undefined ? set.destDate : stored.destDate,',
    replace: '    destDate: set.destDate !== undefined ? set.destDate : (set.homeDate ?? stored.destDate),',
    expect: 'datesAfterEdit replaced a date the body did not set',
  },
  {
    name: 'tripdate01-h the calendar registry no longer names the PATCH (R7)',
    file: SOURCES,
    find: " · src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts:233 (PATCH — TRIPDATE-01: an itinerary edit moves the row\\'s dates with its itinerary row, in one transaction)",
    replace: '',
    expect: 'the calendar registry’s trip source does not name the PATCH',
  },
  // ── 2. THE RANGE ──
  {
    name: 'tripdate01-i a reversed range is logged, not refused',
    file: PATCH,
    find: "      if (refused) return NextResponse.json({ error: 'Validation', field: dateKey, message: refused }, { status: 400 });",
    replace: '      if (refused) console.log(refused);',
    expect: 'does not refuse a date edit that leaves the end before the start, by name, before any write',
  },
  {
    name: 'tripdate01-j the range compares instants, not UTC days',
    file: LEAF,
    find: '  return end < start ?',
    replace: '  return after.destDate.getTime() < after.homeDate.getTime() ?',
    expect: 'rangeRefusal on one UTC day, the end earlier in it answered',
  },
  // ── 3. THE FIXED CLOCK ──
  {
    name: 'tripdate01-k the rule no longer sees a stated start_at (a timed tour)',
    file: LEAF,
    find: '  return row.start_at !== null && row.start_at !== undefined;',
    replace: '  return false;',
    expect: 'clockIsFixed reads a timed tour as false',
  },
  {
    name: 'tripdate01-l the PATCH refuses only the time keys on a fixed clock',
    file: PATCH,
    find: '      const sent = ITINERARY_DATE_TIME_KEYS.find((k) => body[k] !== undefined);',
    replace: "      const sent = (['startTime', 'endTime'] as const).find((k) => body[k] !== undefined);",
    expect: 'does not refuse every date and time key on a row whose clock a vendor fixed',
  },
  {
    name: 'tripdate01-m the HOTEL-02 refusal is reworded',
    file: PATCH,
    find: 'with their zones; re-commit the flight to change them" },',
    replace: 'with their zones; re-commit it" },',
    expect: 'HOTEL-02 refusal no longer stands word for word',
  },
  {
    name: 'tripdate01-n the key list loses date',
    file: LEAF,
    find: "export const ITINERARY_DATE_TIME_KEYS = ['date', 'startDate',",
    replace: "export const ITINERARY_DATE_TIME_KEYS = ['startDate',",
    expect: 'the date and time keys are',
  },
  // ── 4. ONE RULE ──
  {
    name: 'tripdate01-o the timeline defines its own rule',
    file: TIMELINE,
    find: "import { CLOCK_FIXED_WORDS, clockIsFixed } from '@/lib/trips/itineraryEdit';",
    replace: "import { CLOCK_FIXED_WORDS } from '@/lib/trips/itineraryEdit';\nconst clockIsFixed = (row: { vendorOptionType?: string | null }) => row.vendorOptionType === 'flight';",
    expect: 'clockIsFixed is defined in',
  },
  {
    name: 'tripdate01-p the ledger’s end-time cell is not gated',
    file: LEDGER,
    find: 'value={it.endTime} editable={!!it.itineraryId && it.clockFixed !== true}',
    replace: 'value={it.endTime} editable={!!it.itineraryId}',
    expect: 'the endTime cell is not gated on the rule',
  },
  {
    name: 'tripdate01-q the timeline offers its edit control on a fixed clock',
    file: TIMELINE,
    find: ') : clockIsFixed(row) ? (',
    replace: ') : false ? (',
    expect: 'offers its edit control on a row whose clock a vendor fixed',
  },
  {
    name: 'tripdate01-r the budget route stops selecting start_at',
    file: BUDGET,
    find: '            start_at: true,\n',
    replace: '',
    expect: 'does not select the two fields the rule reads',
  },
  {
    name: 'tripdate01-s a fourth file calls the rule',
    file: LEDGER,
    find: "import { CLOCK_FIXED_WORDS } from '@/lib/trips/itineraryEdit';",
    replace: "import { CLOCK_FIXED_WORDS, clockIsFixed } from '@/lib/trips/itineraryEdit';\nvoid clockIsFixed({});",
    expect: 'the rule’s callers are',
  },
  // ── 5. BOOKED STAYS KEEP THE VENDOR’S DATES ──
  {
    name: 'tripdate01-t the PATCH moves a reservation’s calendar row too',
    file: PATCH,
    find: '      itineraryWrite,\n',
    replace: "      itineraryWrite,\n      prisma.calendar_events.updateMany({ where: { user_id: user.id, source: 'reservation', source_id: existing.vendorOptionId }, data: { start_date: after.homeDate } }),\n",
    expect: 'touches calendar_events through',
  },
  {
    name: 'tripdate01-u vendor-commit’s calendar delete changes',
    file: COMMIT,
    find: "DELETE FROM calendar_events WHERE source = 'trip' AND source_id = ",
    replace: 'DELETE FROM calendar_events WHERE source_id = ',
    expect: 'calendar insert and delete changed',
  },
  // ── 6. THE TIMELINE ──
  {
    name: 'tripdate01-v the trip’s stated start alone decides the range again',
    file: TIMELINE,
    find: '  const rangeStart = startBounds[0] ?? null;',
    replace: '  const rangeStart = startDate ? dateOnly(startDate) : (startBounds[0] ?? null);',
    expect: 'range does not take every item’s days',
  },
  // ── 7. THE ANSWER ──
  {
    name: 'tripdate01-w the answer drops the calendar outcome',
    file: PATCH,
    find: '    return NextResponse.json({ itinerary: updated, calendar: { moved: calendar.count } });',
    replace: '    return NextResponse.json({ itinerary: updated });',
    expect: 'each names the calendar outcome',
  },
  {
    name: 'tripdate01-x moved 0 is no longer logged',
    file: PATCH,
    find: '    if (calendar.count === 0) {\n      console.log(',
    replace: '    if (calendar.count === 0) {\n      void (',
    expect: 'does not log moved 0 by name',
  },
];

export default SEEDS;
