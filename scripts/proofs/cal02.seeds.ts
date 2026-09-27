/**
 * The calendar law's seeded regressions (CAL-02, 2026-09-27).
 *
 * The ruling says two things: EVERY LEG OF A BOOKING IS ON THE CALENDAR, AND A
 * BOOKING CAN BE TAKEN TO ANY CALENDAR APP. These seeds put back, one at a time,
 * each shape the ruling forbids:
 *
 *   · the segments are re-sorted, the key loses its index, a title guesses a field,
 *     the writer duplicates a pre-CAL-02 row, a leg of a cancelled booking stays
 *     live, a cancel misses a leg, a re-key loses a cancel mark, the refresh hands
 *     the writer the sorted outbound (clause 1);
 *   · an end, an instant or a zone is invented (clause 2);
 *   · a reader matches one key, or the list counts rows (clause 3);
 *   · the builder reads the clock, stops escaping, stops folding, or drops
 *     STATUS:CANCELLED (clause 4);
 *   · an export drops the owner scope, writes, or reaches a vendor (clause 5);
 *   · the retro calls the vendor (clause 6);
 *   · the receipt loses its door (clause 7).
 *
 * Each must fail THE CALENDAR LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LEAF = 'src/lib/calendar/bookingEvent.ts';
const CAL_IMPL = 'src/lib/calendar/prismaBookingCalendar.ts';
const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
const ICS = 'src/lib/calendar/ics.ts';
const EXPORT_PORTS = 'src/lib/calendar/prismaIcsPorts.ts';
const RES_ICS = 'src/app/api/reservations/[id]/ics/route.ts';
const TRIP_ICS = 'src/app/api/trips/[id]/ics/route.ts';
const LIST_ROUTE = 'src/app/api/reservations/route.ts';
const RETRO = 'scripts/cal-02-retro-segments.ts';
const RECEIPT_PAGE = 'src/app/booking/[id]/receipt/page.tsx';

const SEEDS: Seed[] = [
  {
    name: 'cal02-a the segments are re-sorted before they are keyed (clause 1)',
    file: LEAF,
    find: '  return input.segments.map((segment, index) => {',
    replace: '  return [...input.segments].sort((a, b) => String(a.departureTime).localeCompare(String(b.departureTime))).map((segment, index) => {',
    expect: 'flightSegmentsCalendarDecision re-sorts the segments',
  },
  {
    name: 'cal02-b a segment is keyed on the bare reservation id (clause 1)',
    file: LEAF,
    find: '  return `${reservationId}${SEGMENT_KEY_MARK}${index}`;',
    replace: '  return reservationId;',
    expect: 'the segment key is not <id>:seg:<index>',
  },
  {
    name: 'cal02-c a missing carrier is guessed into the title (clause 1)',
    file: LEAF,
    find: '  const carrier = stated(segment.carrierName);',
    replace: "  const carrier = stated(segment.carrierName) || 'Airline';",
    expect: 'the segment titles are not the stated fields alone',
  },
  {
    name: 'cal02-d the writer inserts beside a pre-CAL-02 row instead of re-keying it (clause 1)',
    file: LEAF,
    find: '    if (bare && (await port.rekey(BOOKING_CALENDAR_SOURCE, bareKey, rowOf(decision))) > 0) {',
    replace: '    if (false && bare) {',
    expect: 'writeFlightSegmentRows does not find the key, then re-key the bare row in place, then insert',
  },
  {
    name: 'cal02-e a leg first written for an already-cancelled booking is left live (clause 1)',
    file: LEAF,
    find: '  const marked = input.reservationCancelled ? await port.markCancelled(BOOKING_CALENDAR_SOURCE, bareKey) : null;',
    replace: '  const marked = null;',
    expect: 'a leg first written for an ALREADY-cancelled reservation is not marked',
  },
  {
    name: 'cal02-f a cancel marks the bare key only — the legs stay live (clause 1)',
    file: CAL_IMPL,
    find: '         WHERE source = ${source} AND (source_id = ${sourceId} OR left(source_id, char_length(${segmentPrefix})) = ${segmentPrefix}) AND title NOT LIKE ${prefixed}',
    replace: '         WHERE source = ${source} AND source_id = ${sourceId} AND title NOT LIKE ${prefixed}',
    expect: 'markCancelled does not match the bare key AND the segment prefix',
  },
  {
    name: 'cal02-g a re-keyed cancelled row loses its mark (clause 1)',
    file: CAL_IMPL,
    find: "               title = CASE WHEN status = 'cancelled' THEN ${CANCELLED_TITLE_PREFIX} || ${row.title} ELSE ${row.title} END,",
    replace: '               title = ${row.title},',
    expect: 'a re-keyed row that was marked cancelled would lose its mark',
  },
  {
    name: 'cal02-h the refresh hands the writer the sorted outbound, not the segments as stated (clause 1)',
    file: REFRESH,
    find: '    decisions: flightSegmentsCalendarDecision({ reservationId: row.id, userId: row.userId, segments: stated.segments }),',
    replace: '    decisions: flightSegmentsCalendarDecision({ reservationId: row.id, userId: row.userId, segments: outbound }),',
    expect: 'does not hand the one writer every segment AS STATED',
  },
  {
    name: 'cal02-i a leg with no stated arrival is given the departure as its end (clause 2)',
    file: LEAF,
    find: '        endTime: arrival !== null && arrivalDay ? statedClock(arrival) : null,',
    replace: '        endTime: arrival !== null && arrivalDay ? statedClock(arrival) : statedClock(departure),',
    expect: 'a segment with no stated arrival got an end',
  },
  {
    name: 'cal02-j a local clock is read as UTC — an invented instant (clause 2)',
    file: LEAF,
    find: '        startAt: statedInstant(departure),',
    replace: '        startAt: new Date(`${departure}Z`),',
    expect: 'a local clock with no offset was given an instant',
  },
  {
    name: 'cal02-k the insert writes a zone nothing resolved (clause 2)',
    file: CAL_IMPL,
    find: 'start_time, end_time, start_at, end_at, is_recurring)',
    replace: 'start_time, end_time, start_at, end_at, start_zone, is_recurring)',
    expect: 'writes a zone',
  },
  {
    name: "cal02-l the list reads a booking's rows by the bare key alone (clause 3)",
    file: LIST_ROUTE,
    find: '          where: { user_id: user.id, ...bookingCalendarRowsWhere(ids) },',
    replace: "          where: { user_id: user.id, source: 'reservation', source_id: { in: ids } },",
    expect: "reads a booking's calendar rows by one key",
  },
  {
    name: 'cal02-m the list keys its days by row, not by reservation (clause 3)',
    file: LIST_ROUTE,
    find: '    if (!dayOf.has(rid)) dayOf.set(rid, c.start_date);',
    replace: '    dayOf.set(c.source_id, c.start_date);',
    expect: "does not fold a booking's rows to ONE day per reservation",
  },
  {
    name: 'cal02-n DTSTAMP reads the clock (clause 4)',
    file: ICS,
    find: '      `DTSTAMP:${utcStamp(row.updated_at)}`,',
    replace: '      `DTSTAMP:${utcStamp(new Date())}`,',
    expect: 'reads a clock, the env, a database or the network',
  },
  {
    name: 'cal02-o a comma is no longer escaped (clause 4)',
    file: ICS,
    find: String.raw`    .replace(/,/g, '\\,')`,
    replace: String.raw`    .replace(/,/g, ',')`,
    expect: 'TEXT is not escaped per RFC 5545',
  },
  {
    name: 'cal02-p lines are no longer folded (clause 4)',
    file: ICS,
    find: String.raw`  return { text: ${'`'}${'$'}{lines.map(foldIcsLine).join('\r\n')}\r\n${'`'}, events:`,
    replace: String.raw`  return { text: ${'`'}${'$'}{lines.join('\r\n')}\r\n${'`'}, events:`,
    expect: 'the golden export drifted',
  },
  {
    name: 'cal02-q a cancelled row is exported without STATUS:CANCELLED (clause 4)',
    file: ICS,
    find: "      ...(row.status === 'cancelled' ? ['STATUS:CANCELLED'] : []),",
    replace: '      ...([] as string[]),',
    expect: 'the golden export drifted',
  },
  {
    name: "cal02-r the export reads any user's booking by id (clause 5)",
    file: EXPORT_PORTS,
    find: '    findReservation: (id, userId) => prisma.reservations.findFirst({ where: { id, userId }, select: { id: true } }),',
    replace: '    findReservation: (id) => prisma.reservations.findFirst({ where: { id }, select: { id: true } }),',
    expect: 'lacks the caller-scoped read',
  },
  {
    name: 'cal02-s the booking export writes (clause 5)',
    file: RES_ICS,
    find: '    const answer = await reservationIcs(',
    replace: "    await prisma.calendar_events.updateMany({ where: { source: 'reservation' }, data: { status: 'exported' } });\n    const answer = await reservationIcs(",
    expect: 'writes — an export reads only',
  },
  {
    name: 'cal02-t the trip export reaches a vendor (clause 5)',
    file: TRIP_ICS,
    find: "import { prismaIcsPorts } from '@/lib/calendar/prismaIcsPorts';",
    replace: "import { prismaIcsPorts } from '@/lib/calendar/prismaIcsPorts';\nimport { getFlightBooking } from '@/lib/liteapiFlightsClient';\nvoid getFlightBooking;",
    expect: 'reaches a vendor',
  },
  {
    name: 'cal02-w a booking with no row is served as an empty calendar file (clause 5)',
    file: 'src/lib/calendar/icsExport.ts',
    find: '  if (built.events === 0) return { status: 404, error: ICS_EXPORT_WORDS.noRows };',
    replace: '',
    expect: 'an export with no row is served as an empty file',
  },
  {
    name: 'cal02-u the retro calls the vendor instead of reading the landed read (clause 6)',
    file: RETRO,
    find: '    const segments = parseFlightBookingDetails(read.payload as Record<string, unknown>).segments;',
    replace: '    const segments = (await getFlightBooking(row.providerBookingId)).details.segments;',
    expect: 'calls the vendor (or the refresh that does)',
  },
  {
    name: 'cal02-v the receipt loses its "Add to calendar" door (clause 7)',
    file: RECEIPT_PAGE,
    find: '                  <a href={bookingIcsHref(id)} className',
    replace: '                  <a href="#" className',
    expect: 'the receipt carries no "Add to calendar" link',
  },
];

export default SEEDS;
